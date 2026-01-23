import express from "express";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const PORT = parseInt(process.env.PORT || "3001", 10);
const DATA_DIR = process.env.DATA_DIR || "/data";
const IMAGE_URL = process.env.IMAGE_URL || "https://picsum.photos/1200";
const TTL_MS = parseInt(process.env.TTL_MS || "600000", 10); // 10 minutes

const imagePath = path.join(DATA_DIR, "image.jpg");
const metaPath = path.join(DATA_DIR, "meta.json");
const lockPath = path.join(DATA_DIR, ".download.lock");

function nowMs() {
  return Date.now();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureDataDir() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
}

async function safeReadJson(filePath) {
  try {
    const raw = await fsp.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function atomicWriteFile(filePath, data, mode = 0o644) {
  const tmp = `${filePath}.tmp-${process.pid}-${crypto.randomBytes(8).toString("hex")}`;
  await fsp.writeFile(tmp, data, { mode });
  await fsp.rename(tmp, filePath);
}

async function fileExists(filePath) {
  try {
    await fsp.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function statOrNull(filePath) {
  try {
    return await fsp.stat(filePath);
  } catch {
    return null;
  }
}

async function breakStaleLockIfNeeded() {
  const st = await statOrNull(lockPath);
  if (!st) return;
  const age = nowMs() - st.mtimeMs;
  if (age > 60_000) {
    await fsp.unlink(lockPath).catch(() => {});
  }
}

async function withLock(fn) {
  const start = nowMs();
  while (true) {
    await breakStaleLockIfNeeded();
    try {
      const handle = await fsp.open(lockPath, "wx");
      try {
        return await fn();
      } finally {
        await handle.close().catch(() => {});
        await fsp.unlink(lockPath).catch(() => {});
      }
    } catch (e) {
      if (e && e.code === "EEXIST") {
        if (nowMs() - start > 15_000) {
          throw new Error("Lock timeout: another download seems stuck");
        }
        await sleep(150);
        continue;
      }
      throw e;
    }
  }
}

async function downloadImageTo(imageFilePath) {
  const res = await fetch(IMAGE_URL, {
    redirect: "follow",
    headers: { "User-Agent": "dwk-image-cache/1.13" }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch image: ${res.status} ${res.statusText}`);
  }

  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (!ct.startsWith("image/")) {
    throw new Error(`Unexpected content-type: ${ct}`);
  }

  const ab = await res.arrayBuffer();
  const buf = Buffer.from(ab);
  if (buf.length < 1024) {
    throw new Error(`Image too small (${buf.length} bytes), refusing to write`);
  }

  const tmp = `${imageFilePath}.tmp-${process.pid}-${crypto.randomBytes(8).toString("hex")}`;
  await fsp.writeFile(tmp, buf, { mode: 0o644 });
  await fsp.rename(tmp, imageFilePath);
}

function newMeta() {
  const t = nowMs();
  return {
    createdAtMs: t,
    expiresAtMs: t + TTL_MS,
    afterExpiryServedOnce: false
  };
}

async function writeMeta(meta) {
  await atomicWriteFile(metaPath, JSON.stringify(meta, null, 2) + "\n", 0o644);
}

async function ensureImage() {
  await ensureDataDir();

  return await withLock(async () => {
    const hasImage = await fileExists(imagePath);
    const meta = await safeReadJson(metaPath);

    if (!hasImage || !meta || typeof meta.expiresAtMs !== "number") {
      await downloadImageTo(imagePath);
      const m = newMeta();
      await writeMeta(m);
      return { action: "downloaded-initial", meta: m };
    }

    const t = nowMs();
    if (t <= meta.expiresAtMs) {
      return { action: "kept-valid", meta };
    }

    if (meta.afterExpiryServedOnce !== true) {
      const updated = { ...meta, afterExpiryServedOnce: true };
      await writeMeta(updated);
      return { action: "expired-served-old-once", meta: updated };
    }

    await downloadImageTo(imagePath);
    const m = newMeta();
    await writeMeta(m);
    return { action: "downloaded-after-expiry", meta: m };
  });
}

async function metaView() {
  const meta = await safeReadJson(metaPath);
  const st = await statOrNull(imagePath);
  return {
    dataDir: DATA_DIR,
    imageUrl: IMAGE_URL,
    ttlMs: TTL_MS,
    meta: meta || null,
    image: st ? { size: st.size, mtimeMs: st.mtimeMs } : null
  };
}

const app = express();

app.get("/healthz", async (_req, res) => {
  try {
    await ensureDataDir();
    res.status(200).type("text/plain").send("ok\n");
  } catch (e) {
    res.status(500).type("text/plain").send(`not ok: ${e?.message || e}\n`);
  }
});

app.get("/touch", async (_req, res) => {
  try {
    const result = await ensureImage();
    res.status(200).json({ ok: true, ...result, view: await metaView() });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

app.get("/meta", async (_req, res) => {
  try {
    res.status(200).json({ ok: true, view: await metaView() });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

app.get("/shutdown", (_req, res) => {
  res.status(200).type("text/plain").send("shutting down\n");
  setTimeout(() => process.exit(0), 200);
});

process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));

app.listen(PORT, "0.0.0.0", async () => {
  await ensureDataDir();
  console.log(`image-cache listening on ${PORT} using ${DATA_DIR}`);
});
