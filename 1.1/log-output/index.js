"use strict";

const crypto = require("crypto");

// Genera una stringa random UNA SOLA volta all'avvio e tienila in memoria
const randomId = crypto.randomUUID();

function logLine() {
  const ts = new Date().toISOString();
  console.log(`${ts}: ${randomId}`);
}

// stampa subito
logLine();

// poi ogni 5 secondi
setInterval(logLine, 5000);
