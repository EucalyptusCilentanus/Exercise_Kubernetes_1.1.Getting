'use strict';

const http = require('http');
const crypto = require('crypto');

const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const APP_MESSAGE = process.env.APP_MESSAGE || 'Hello from Kubernetes!';
const APP_COLOR = process.env.APP_COLOR || '#198754';
const STARTUP_HASH = crypto.randomBytes(6).toString('hex');

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function send(res, statusCode, body, contentType) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET') {
    return send(res, 405, 'Method Not Allowed', 'text/plain; charset=utf-8');
  }

  if (req.url === '/healthz') {
    return send(res, 200, JSON.stringify({ ok: true }), 'application/json; charset=utf-8');
  }

  if (req.url !== '/') {
    return send(res, 404, 'Not Found', 'text/plain; charset=utf-8');
  }

  const requestHash = crypto.randomBytes(6).toString('hex');

  const html = `<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>DWK Step 3</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 2rem; }
    .card { border: 1px solid #ddd; border-radius: 12px; padding: 1.25rem; max-width: 760px; }
    .badge { display: inline-block; padding: 0.2rem 0.55rem; border-radius: 999px; color: white; background: ${escapeHtml(APP_COLOR)}; }
    code { background: #f6f8fa; padding: 0.15rem 0.35rem; border-radius: 6px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>DWK Project Step 3</h1>
    <p class="badge">GET / funziona Yeaaaaaah!!!!!</p>
    <p><strong>Message:</strong> ${escapeHtml(APP_MESSAGE)}</p>
    <p><strong>Startup hash:</strong> <code>${STARTUP_HASH}</code></p>
    <p><strong>Request hash:</strong> <code>${requestHash}</code></p>
    <p><strong>Hostname:</strong> <code>${escapeHtml(process.env.HOSTNAME || 'unknown')}</code></p>
    <p><strong>Time:</strong> <code>${new Date().toISOString()}</code></p>
  </div>
</body>
</html>`;

  return send(res, 200, html, 'text/html; charset=utf-8');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on 0.0.0.0:${PORT}`);
  console.log(`APP_MESSAGE=${APP_MESSAGE}`);
  console.log(`APP_COLOR=${APP_COLOR}`);
  console.log(`STARTUP_HASH=${STARTUP_HASH}`);
});
