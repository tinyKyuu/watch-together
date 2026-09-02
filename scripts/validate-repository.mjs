import { access, readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const requiredFiles = [
  "LICENSE",
  "NOTICE",
  "README.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "plan.md",
  "docs/architecture.md",
  "spec/README.md",
  "conformance/README.md",
  "packages/README.md",
  "reference-relay/README.md",
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
