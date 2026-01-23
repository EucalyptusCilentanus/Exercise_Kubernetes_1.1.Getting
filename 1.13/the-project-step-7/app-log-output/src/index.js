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
  Chiama image-cache SOLO quando serve:
  - image.jpg non esiste
  - meta.json non esiste o invalido
  - meta scaduto
*/
async function shouldTouchImageCache() {
  const hasImage = await fileExists(imagePath);
  if (!hasImage) return true;

  const meta = await safeReadJson(metaPath);
  if (!meta || typeof meta.expiresAtMs !== "number") return true;

  return Date.now() > meta.expiresAtMs;
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
  - poi aspetta che image.jpg esista
*/
async function ensureImageReady() {
  const needTouch = await shouldTouchImageCache();
  if (needTouch) await touchImageCache();

  const maxTries = 80; // 8s
  const waitMs = 100;

  for (let i = 0; i < maxTries; i += 1) {
    if (await fileExists(imagePath)) return true;
    await sleep(waitMs);
  }

  return await fileExists(imagePath);
}

function pageHtml({ randomValue, pingText }) {
  return `
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>The project App</title>
  <style>
    body { font-family: Georgia, serif; margin: 24px; }
    h1 { font-size: 64px; margin: 0 0 18px 0; }
    .wrap { max-width: 900px; }
    .imgbox { margin: 18px 0; }
    .imgbox img { width: 600px; max-width: 100%; height: auto; border: 1px solid #ddd; }
    .row { display: flex; gap: 10px; align-items: center; margin: 12px 0 8px 0; }
    input[type="text"] { width: 280px; padding: 8px; font-size: 16px; }
    button { padding: 8px 12px; font-size: 16px; cursor: pointer; }
    .hint { font-size: 12px; color: #555; margin: 0 0 16px 0; }
    ul { margin-top: 8px; padding-left: 26px; }
    li { font-size: 28px; }
    .footer { margin-top: 24px; font-size: 16px; color: #333; }
    .small { font-size: 12px; color: #666; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>The project App</h1>

    <div class="imgbox">
      <img src="/image.jpg" alt="hourly pic" />
    </div>

    <div class="row">
      <input id="todoInput" type="text" maxlength="140" placeholder="Write a todo (max 140 chars)" />
      <button id="createBtn" type="button">Create todo</button>
    </div>

    <div class="hint">
      <span id="charInfo">140 characters left</span>
      <span id="msg" style="margin-left: 10px;"></span>
    </div>

    <ul id="todoList"></ul>

    <div class="footer">
      <div><strong>Random:</strong> ${htmlEscape(randomValue)}</div>
      <div><strong>Ping / Pongs:</strong> ${htmlEscape(pingText)}</div>
      <div class="small">Crash test: <a href="/shutdown">/shutdown</a></div>
    </div>
  </div>

  <script>
    (function () {
      const MAX = 140;

      // Hardcoded todos richiesti dall'esercizio
      const todos = [
        "Learn JavaScript",
        "Learn React",
        "Build a project"
      ];

      const input = document.getElementById("todoInput");
      const btn = document.getElementById("createBtn");
      const list = document.getElementById("todoList");
      const charInfo = document.getElementById("charInfo");
      const msg = document.getElementById("msg");

      function setMsg(text, isError) {
        msg.textContent = text || "";
        msg.style.color = isError ? "#b00020" : "#0a7a0a";
        if (text) setTimeout(() => { msg.textContent = ""; }, 2500);
      }

      function render() {
        list.innerHTML = "";
        for (const t of todos) {
          const li = document.createElement("li");
          li.textContent = t;
          list.appendChild(li);
        }
      }

      function normalizeAndUpdateChars() {
        if (input.value.length > MAX) {
          input.value = input.value.slice(0, MAX);
        }
        const left = MAX - input.value.length;
        charInfo.textContent = left + " characters left";
        charInfo.style.color = left === 0 ? "#b00020" : "#555";
      }

      input.addEventListener("input", normalizeAndUpdateChars);

      // “Send button”: non deve inviare ancora (non backend), quindi resta UI-only.
      btn.addEventListener("click", function () {
        const v = (input.value || "").trim();
        if (v.length === 0) {
          setMsg("Todo is empty", true);
          return;
        }
        if (v.length > MAX) {
          setMsg("Todo too long (max 140 chars)", true);
          return;
        }
        setMsg("Todo ready (sending not implemented yet)", false);
        input.value = "";
        normalizeAndUpdateChars();
      });

      normalizeAndUpdateChars();
      render();
    })();
  </script>
</body>
</html>
  `.trim();
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
    const ok = await ensureImageReady();
    if (!ok) {
      res.status(404).type("text/plain").send("no image yet\n");
      return;
    }

    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.sendFile(imagePath);
  });

  app.get("/", async (_req, res) => {
    const ping = await fetchPingpong();
    res.status(200).type("text/html").send(
      pageHtml({ randomValue, pingText: ping.text })
    );
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
