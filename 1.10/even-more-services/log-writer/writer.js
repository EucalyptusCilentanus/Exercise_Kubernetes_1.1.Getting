"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function mustEnv(name, fallback) {
  const v = process.env[name];
  return (v && v.trim().length > 0) ? v : fallback;
}

const LOG_FILE = mustEnv("LOG_FILE", "/usr/src/app/files/log.txt");
const INTERVAL_SECONDS = Number.parseInt(mustEnv("INTERVAL_SECONDS", "5"), 10);
const INTERVAL_MS = Number.isFinite(INTERVAL_SECONDS) && INTERVAL_SECONDS > 0 ? INTERVAL_SECONDS * 1000 : 5000;

// Random string una sola volta all'avvio del container
const randomId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
const dir = path.dirname(LOG_FILE);

async function ensureDir() {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function appendLine() {
  const ts = new Date().toISOString();
  const line = `${ts} ${randomId}\n`;
  await fs.promises.appendFile(LOG_FILE, line, { encoding: "utf8" });
  process.stdout.write(line);
}

let timer = null;

async function start() {
  await ensureDir();
  await appendLine();

  timer = setInterval(() => {
    appendLine().catch((err) => {
      console.error("append failed:", err);
      process.exitCode = 1;
    });
  }, INTERVAL_MS);

  console.log(`writer started: id=${randomId} file=${LOG_FILE} every=${INTERVAL_MS}ms`);
}

function shutdown(sig) {
  console.log(`shutdown: ${sig}`);
  if (timer) clearInterval(timer);
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start().catch((err) => {
  console.error("startup failed:", err);
  process.exit(1);
});
