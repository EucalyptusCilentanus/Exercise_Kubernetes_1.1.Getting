import express from "express";

const PORT = parseInt(process.env.PORT || "3001", 10);
let counter = 0;

const app = express();

app.get("/healthz", (_req, res) => {
  res.status(200).type("text/plain").send("ok\n");
});

app.get("/pingpong", (_req, res) => {
  counter += 1;
  res.status(200).type("text/plain").send(`pong ${counter}\n`);
});

app.get("/shutdown", (_req, res) => {
  res.status(200).type("text/plain").send("shutting down\n");
  setTimeout(() => process.exit(0), 200);
});

process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`pingpong listening on ${PORT}`);
});
