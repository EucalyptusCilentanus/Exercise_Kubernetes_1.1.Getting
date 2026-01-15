"use strict";

const http = require("http");

function normalizePort(value) {
  const port = Number.parseInt(value, 10);
  if (Number.isNaN(port)) return null;
  if (port < 1 || port > 65535) return null;
  return port;
}

const port = normalizePort(process.env.PORT) ?? 3000;

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end("OK\n");
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Server started in port ${port}`);
});

server.on("error", (err) => {
  console.error("Server error:", err);
  process.exit(1);
});
