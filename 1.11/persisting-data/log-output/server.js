"use strict";

const http = require("http");
const fs = require("fs");
const crypto = require("crypto");

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

// random una sola volta all'avvio
const randomId = crypto.randomUUID();

async function readCount() {
  try {
    const raw = await fs.promises.readFile(COUNT_FILE, "utf8");
    const n = Number.parseInt(String(raw).trim(), 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch (err) {
    if (err && err.code === "ENOENT") return 0;
    throw err;
  }
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

  if (url.pathname === "/") {
    readCount()
      .then((n) => {
        const ts = new Date().toISOString();
        const body = `${ts}: ${randomId}.\nPing / Pongs: ${n}\n`;
        send(res, 200, body, "text/plain; charset=utf-8");
      })
      .catch((err) => {
        console.error("readCount failed:", err);
        send(res, 500, "Internal Server Error\n", "text/plain; charset=utf-8");
      });
    return;
  }

  return send(res, 404, "Not Found\n", "text/plain; charset=utf-8");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`log-output listening on 0.0.0.0:${PORT} (countFile=${COUNT_FILE}, id=${randomId})`);
});

server.on("error", (err) => {
  console.error("Server error:", err);
  process.exit(1);
});
