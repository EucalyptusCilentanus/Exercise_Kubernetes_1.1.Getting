"use strict";

const http = require("http");
const fs = require("fs");

function normalizePort(value) {
  const port = Number.parseInt(value, 10);
  if (Number.isNaN(port)) return null;
  if (port < 1 || port > 65535) return null;
  return port;
}

function mustEnv(name, fallback) {
  const v = process.env[name];
  return (v && v.trim().length > 0) ? v : fallback;
}

const PORT = normalizePort(process.env.PORT) ?? 3000;
const LOG_FILE = mustEnv("LOG_FILE", "/usr/src/app/files/log.txt");

function send(res, status, body, contentType) {
  res.statusCode = status;
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "no-store");
  res.end(body);
}

async function readLogFile() {
  try {
    return await fs.promises.readFile(LOG_FILE, "utf8");
  } catch (err) {
    if (err && err.code === "ENOENT") return "";
    throw err;
  }
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
    readLogFile()
      .then((content) => {
        if (!content) return send(res, 200, "No logs yet\n", "text/plain; charset=utf-8");
        return send(res, 200, content, "text/plain; charset=utf-8");
      })
      .catch((err) => {
        console.error("read failed:", err);
        return send(res, 500, "Internal Server Error\n", "text/plain; charset=utf-8");
      });
    return;
  }

  return send(res, 404, "Not Found\n", "text/plain; charset=utf-8");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`log-reader listening on 0.0.0.0:${PORT} (file=${LOG_FILE})`);
});

server.on("error", (err) => {
  console.error("Server error:", err);
  process.exit(1);
});
