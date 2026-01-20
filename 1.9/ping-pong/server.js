"use strict";

const http = require("http");

function normalizePort(value) {
  const port = Number.parseInt(value, 10);
  if (Number.isNaN(port)) return null;
  if (port < 1 || port > 65535) return null;
  return port;
}

const PORT = normalizePort(process.env.PORT) ?? 3000;

// Counter in memoria (si resetta se il pod riparte)
let counter = 0;

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

  // Health endpoint (extra robustezza)
  if (url.pathname === "/healthz") {
    return send(res, 200, JSON.stringify({ ok: true }), "application/json; charset=utf-8");
  }

  // Richiesto da 1.9
  if (url.pathname === "/pingpong") {
    const current = counter;
    counter += 1;
    return send(res, 200, `pong ${current}\n`, "text/plain; charset=utf-8");
  }

  return send(res, 404, "Not Found\n", "text/plain; charset=utf-8");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`PingPong listening on 0.0.0.0:${PORT}`);
});

server.on("error", (err) => {
  console.error("Server error:", err);
  process.exit(1);
});
