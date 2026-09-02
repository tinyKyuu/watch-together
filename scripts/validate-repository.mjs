// SPDX-License-Identifier: Apache-2.0

import { access, readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const requiredFiles = [
  ".github/workflows/validate.yml",
  "LICENSE",
  "NOTICE",
  "README.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "package.json",
  "package-lock.json",
  "plan.md",
  "docs/architecture.md",
  "docs/protocol-v1.md",
  "docs/service-manifest-v1.md",
  "spec/README.md",
  "spec/manifest/v1/manifest.schema.json",
  "spec/manifest/v1/examples/pilot-service.json",
  "spec/protocol/v1/client-command.schema.json",
  "spec/protocol/v1/room-state.schema.json",
  "spec/protocol/v1/server-message.schema.json",
  "spec/conformance/v1/fixture.schema.json",
  "conformance/README.md",
  "conformance/package.json",
  "conformance/fixtures/v1/pause-resume.json",
  "conformance/fixtures/v1/readiness-next-round.json",
  "conformance/fixtures/v1/reconnect-stale-sequence.json",
  "conformance/fixtures/v1/seek-idempotency.json",
  "packages/README.md",
  "packages/protocol-core/README.md",
  "packages/protocol-core/package.json",
  "packages/protocol-core/src/index.js",
  "reference-relay/README.md",
  "reference-relay/package.json",
  "reference-relay/src/index.js",
];
const failures = [];

for (const requiredFile of requiredFiles) {
  try {
    await access(join(repositoryRoot, requiredFile));
  } catch {
    failures.push(`missing required file: ${requiredFile}`);
  }
}

const licenseText = await readFile(join(repositoryRoot, "LICENSE"), "utf8");
if (!licenseText.includes("Apache License") || !licenseText.includes("Version 2.0")) {
  failures.push("LICENSE is not the Apache License 2.0 text");
}

async function collectJsonFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectJsonFiles(path)));
    if (entry.isFile() && entry.name.endsWith(".json")) files.push(path);
  }
  return files;
}

for (const jsonFile of await collectJsonFiles(repositoryRoot)) {
  try {
    JSON.parse(await readFile(jsonFile, "utf8"));
  } catch (error) {
    failures.push(
      `invalid JSON in ${relative(repositoryRoot, jsonFile)}: ${error.message}`,
    );
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Repository validation passed (${requiredFiles.length} required files).`);
}
