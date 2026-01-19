"use strict";

const http = require("http");
const crypto = require("crypto");

const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const STARTUP_STRING = crypto.randomBytes(16).toString("hex"); // random string at startup (kept in memory)

function nowIso() {
  return new Date().toISOString();
}

function send(res, status, body, contentType) {
  res.statusCode = status;
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "no-store");
  res.end(body);
}

function statusPayload() {
  return {
    timestamp: nowIso(),
    startupString: STARTUP_STRING,
  };
}

// Log every 5 seconds as required by 1.1
setInterval(() => {
  const p = statusPayload();
  console.log(`${p.timestamp}: ${p.startupString}`);
}, 5000);

const server = http.createServer((req, res) => {
  if (req.method !== "GET") {
    return send(res, 405, "Method Not Allowed", "text/plain; charset=utf-8");
  }

  const url = new URL(req.url || "/", "http://localhost");

  // Health for probes (optional but robust)
  if (url.pathname === "/healthz") {
    return send(res, 200, JSON.stringify({ ok: true }), "application/json; charset=utf-8");
  }

  // Required endpoint for 1.7: return current timestamp + startup random string
  if (url.pathname === "/status") {
    return send(res, 200, JSON.stringify(statusPayload()), "application/json; charset=utf-8");
  }

  // Simple homepage for browser
  if (url.pathname === "/") {
    const p = statusPayload();
    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Log output (1.7)</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 2rem; }
    .card { border: 1px solid #ddd; border-radius: 12px; padding: 1.25rem; max-width: 820px; }
    code { background: #f6f8fa; padding: 0.15rem 0.35rem; border-radius: 6px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Log output (Exercise 1.7)</h1>
    <p><strong>Timestamp:</strong> <code>${p.timestamp}</code></p>
    <p><strong>Startup string:</strong> <code>${p.startupString}</code></p>
    <p>JSON endpoint: <a href="/status">/status</a></p>
    <p>Health endpoint: <a href="/healthz">/healthz</a></p>
  </div>
</body>
</html>`;
    return send(res, 200, html, "text/html; charset=utf-8");
  }

  return send(res, 404, "Not Found", "text/plain; charset=utf-8");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on 0.0.0.0:${PORT}`);
  console.log(`STARTUP_STRING=${STARTUP_STRING}`);
});
