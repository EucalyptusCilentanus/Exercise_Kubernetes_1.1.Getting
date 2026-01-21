"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

function mustEnv(name, fallback) {
  const v = process.env[name];
  return (v && v.trim().length > 0) ? v : fallback;
}

function normalizePort(value) {
  const port = Number.parseInt(value, 10);
  if (Number.isNaN(port)) return null;
  if (port < 1 || port > 65535) return null;
  return port;
}

const PORT = normalizePort(process.env.PORT) ?? 3000;
const COUNT_FILE = mustEnv("COUNT_FILE", "/usr/src/app/files/pingpong.txt");

const dir = path.dirname(COUNT_FILE);
let count = 0;

// serializza le scritture: niente corruzione file
let writeQueue = Promise.resolve();

async function ensureDir() {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function loadCount() {
  try {
    const raw = await fs.promises.readFile(COUNT_FILE, "utf8");
    const n = Number.parseInt(String(raw).trim(), 10);
    count = Number.isFinite(n) && n >= 0 ? n : 0;
  } catch (err) {
    if (err && err.code === "ENOENT") {
      count = 0;
      return;
    }
    throw err;
  }
}

async function writeCountAtomic(n) {
  const tmp = `${COUNT_FILE}.tmp`;
  await fs.promises.writeFile(tmp, `${n}\n`, { encoding: "utf8" });
  await fs.promises.rename(tmp, COUNT_FILE);
}

function enqueueWrite(fn) {
  writeQueue = writeQueue.then(fn, fn);
  return writeQueue;
}

function send(res, status, body, contentType) {
  res.statusCode = status;
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "no-store");
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET") {
    return send(res, 405, "Method Not Allowed\n", "text/plain; charset=utf-8");
  }

  const url = new URL(req.url || "/", "http://localhost");

  if (url.pathname === "/healthz") {
    return send(res, 200, JSON.stringify({ ok: true }), "application/json; charset=utf-8");
  }

  if (url.pathname === "/pingpong") {
    enqueueWrite(async () => {
      count += 1;
      await writeCountAtomic(count);
      return count;
    })
      .then((n) => send(res, 200, `pong ${n}\n`, "text/plain; charset=utf-8"))
      .catch((err) => {
        console.error("pingpong failed:", err);
        send(res, 500, "Internal Server Error\n", "text/plain; charset=utf-8");
      });
    return;
  }

  return send(res, 404, "Not Found\n", "text/plain; charset=utf-8");
});

async function start() {
  await ensureDir();
  await loadCount();
  console.log(`pingpong listening on 0.0.0.0:${PORT} (file=${COUNT_FILE}, startCount=${count})`);
  server.listen(PORT, "0.0.0.0");
}

server.on("error", (err) => {
  console.error("Server error:", err);
  process.exit(1);
});

start().catch((err) => {
  console.error("startup failed:", err);
  process.exit(1);
});
