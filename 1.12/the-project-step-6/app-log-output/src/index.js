import express from "express";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const PORT = parseInt(process.env.PORT || "3000", 10);
const DATA_DIR = process.env.DATA_DIR || "/data";
const IMAGE_CACHE_URL = process.env.IMAGE_CACHE_URL || "http://127.0.0.1:3001/touch";
const PINGPONG_URL = process.env.PINGPONG_URL || "http://pingpong-svc/pingpong";

const imagePath = path.join(DATA_DIR, "image.jpg");
const metaPath = path.join(DATA_DIR, "meta.json");
const randomPath = path.join(DATA_DIR, "random.txt");

function nowMs() {
  return Date.now();
}

function htmlEscape(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function ensureDataDir() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
}

function genRandom() {
  return crypto.randomBytes(16).toString("hex");
}

async function loadOrCreateRandom() {
  await ensureDataDir();
  try {
    const val = await fsp.readFile(randomPath, "utf8");
    const trimmed = val.trim();
    if (trimmed.length > 0) return trimmed;
  } catch {}

  const r = genRandom();
  await fsp.writeFile(randomPath, r + "\n", { mode: 0o644 });
  return r;
}

async function safeReadJson(filePath) {
  try {
    const raw = await fsp.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function fileExists(filePath) {
  try {
    await fsp.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/*
  Chiama image-cache SOLO quando serve.
  Serve chiamare /touch se:
  - image.jpg non esiste
  - meta.json non esiste o è invalido
  - meta è scaduto (per gestire "old one more time" e poi refresh alla richiesta successiva)
*/
async function shouldTouchImageCache() {
  const hasImage = await fileExists(imagePath);
  if (!hasImage) return true;

  const meta = await safeReadJson(metaPath);
  if (!meta || typeof meta.expiresAtMs !== "number") return true;

  const t = nowMs();
  if (t > meta.expiresAtMs) return true;

  return false;
}

async function touchImageCache() {
  try {
    const controller = AbortSignal.timeout(8000);
    const res = await fetch(IMAGE_CACHE_URL, { signal: controller });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

async function fetchPingpong() {
  try {
    const controller = AbortSignal.timeout(2500);
    const res = await fetch(PINGPONG_URL, { signal: controller });
    const txt = (await res.text()).trim();
    return { ok: true, text: txt };
  } catch (e) {
    return { ok: false, text: `pingpong error: ${e?.message || e}` };
  }
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/*
  Endpoint immagine robusto:
  - se serve, trigger /touch
  - poi aspetta che image.jpg esista (download può richiedere un attimo)
*/
async function ensureImageReady() {
  const needTouch = await shouldTouchImageCache();
  let touchResult = null;

  if (needTouch) {
    touchResult = await touchImageCache();
  }

  const maxTries = 80; // 80 * 100ms = 8s
  const waitMs = 100;

  for (let i = 0; i < maxTries; i += 1) {
    if (await fileExists(imagePath)) return { ok: true, touched: needTouch, touchResult };
    await sleep(waitMs);
  }

  if (await fileExists(imagePath)) return { ok: true, touched: needTouch, touchResult };
  return { ok: false, touched: needTouch, touchResult };
}

async function main() {
  await ensureDataDir();
  const randomValue = await loadOrCreateRandom();

  const app = express();

  app.get("/healthz", async (_req, res) => {
    try {
      await ensureDataDir();
      res.status(200).type("text/plain").send("ok\n");
    } catch (e) {
      res.status(500).type("text/plain").send(`not ok: ${e?.message || e}\n`);
    }
  });

  app.get("/image.jpg", async (_req, res) => {
    const st = await ensureImageReady();

    if (!st.ok) {
      res.status(404).type("text/plain").send("no image yet\n");
      return;
    }

    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.sendFile(imagePath);
  });

  app.get("/", async (_req, res) => {
    const ts = new Date().toISOString();
    const ping = await fetchPingpong();

    const body = `
<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>DWK Project</title>
</head>
<body style="font-family: Arial, sans-serif; margin: 24px;">
  <h2>DWK Project</h2>

  <div style="margin-bottom: 12px;">
    <div><strong>Timestamp:</strong> ${htmlEscape(ts)}</div>
    <div><strong>Random:</strong> ${htmlEscape(randomValue)}</div>
    <div><strong>Ping / Pongs:</strong> ${htmlEscape(ping.text)}</div>
  </div>

  <div style="margin-top: 16px;">
    <img src="/image.jpg" alt="random" style="max-width: 100%; height: auto;" />
  </div>

  <div style="margin-top: 16px; font-size: 12px; color: #555;">
    Test crash: <a href="/shutdown">/shutdown</a>
  </div>
</body>
</html>
    `.trim();

    res.status(200).type("text/html").send(body);
  });

  app.get("/shutdown", (_req, res) => {
    res.status(200).type("text/plain").send("shutting down\n");
    setTimeout(() => process.exit(0), 200);
  });

  process.on("SIGTERM", () => process.exit(0));
  process.on("SIGINT", () => process.exit(0));

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`log-output listening on ${PORT} using ${DATA_DIR}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
