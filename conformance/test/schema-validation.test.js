// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const repositoryRoot = new URL("../../", import.meta.url);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, repositoryRoot), "utf8"));
}

function validationMessage(validator) {
  return JSON.stringify(validator.errors, null, 2);
}

test("the pilot service manifest conforms to manifest v1", async () => {
  const schema = await readJson("spec/manifest/v1/manifest.schema.json");
  const manifest = await readJson("spec/manifest/v1/examples/pilot-service.json");
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  assert.equal(validate(manifest), true, validationMessage(validate));

  const contentAware = structuredClone(manifest);
  contentAware.privacy.contentBlind = false;
  assert.equal(validate(contentAware), false);

  const undeclaredData = structuredClone(manifest);
  undeclaredData.privacy.viewingHistory = true;
  assert.equal(validate(undeclaredData), false);

  const tokenizedEndpoint = structuredClone(manifest);
  tokenizedEndpoint.endpoints.relayWebSocketUrl =
    "wss://relay.watch.example.invalid/v1?token=secret";
  assert.equal(validate(tokenizedEndpoint), false);

  const credentialedEndpoint = structuredClone(manifest);
  credentialedEndpoint.endpoints.relayWebSocketUrl =
    "wss://username:password@relay.watch.example.invalid/v1";
  assert.equal(validate(credentialedEndpoint), false);

  const contradictoryAuthentication = structuredClone(manifest);
  contradictoryAuthentication.authentication.host = {
    mode: "none",
    accountRequired: true,
  };
  assert.equal(validate(contradictoryAuthentication), false);

  const accountlessService = structuredClone(manifest);
  accountlessService.authentication.host = {
    mode: "none",
    accountRequired: false,
  };
  delete accountlessService.endpoints.accountLinkUrl;
  assert.equal(
    validate(accountlessService),
    true,
    validationMessage(validate),
  );
});

test("every conformance fixture matches the language-neutral schemas", async () => {
  const [command, roomState, serverMessage, fixtureSchema] = await Promise.all([
    readJson("spec/protocol/v1/client-command.schema.json"),
    readJson("spec/protocol/v1/room-state.schema.json"),
    readJson("spec/protocol/v1/server-message.schema.json"),
    readJson("spec/conformance/v1/fixture.schema.json"),
  ]);
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  ajv.addSchema(command);
  ajv.addSchema(roomState);
  ajv.addSchema(serverMessage);
  const validate = ajv.compile(fixtureSchema);

  const fixtureDirectory = new URL("conformance/fixtures/v1/", repositoryRoot);
  const fixtureNames = (await readdir(fixtureDirectory))
    .filter((name) => name.endsWith(".json"))
    .sort();
  assert.ok(fixtureNames.length >= 4);

  let firstFixture;

  for (const fixtureName of fixtureNames) {
    const fixture = JSON.parse(
      await readFile(new URL(fixtureName, fixtureDirectory), "utf8"),
    );
    assert.equal(
      validate(fixture),
      true,
      `${fixtureName}: ${validationMessage(validate)}`,
    );
    firstFixture ??= fixture;
  }

  const unsafeIntegerFixture = structuredClone(firstFixture);
  const commandStep = unsafeIntegerFixture.steps.find((step) => step.op === "command");
  commandStep.command.sequence = 9007199254740992;
  assert.equal(validate(unsafeIntegerFixture), false);
});
