#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

import os from "node:os";
import process from "node:process";
import { DevelopmentRelayServer } from "./development-relay-server.js";

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const host = option("--host", "0.0.0.0");
const port = Number(option("--port", "8787"));
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new Error("--port must be an integer between 0 and 65535");
}

const server = new DevelopmentRelayServer({ host, port });
const address = await server.start();
console.log(`Watch Together development relay listening on ws://${host}:${address.port}`);
for (const addresses of Object.values(os.networkInterfaces())) {
  for (const candidate of addresses ?? []) {
    if (candidate.family === "IPv4" && !candidate.internal) {
      console.log(`iPhone relay URL: ws://${candidate.address}:${address.port}`);
    }
  }
}
console.log("This in-memory relay is for local Phase 3 testing; restarting it removes every room.");

async function stop() {
  await server.stop();
  process.exit(0);
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
