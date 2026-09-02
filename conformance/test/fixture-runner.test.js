// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { runFixture } from "../src/run-fixture.js";

const repositoryRoot = new URL("../../", import.meta.url);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, repositoryRoot), "utf8"));
}

test("the reference relay and independent consumer pass every fixture", async (t) => {
  const [roomStateSchema, serverMessageSchema] = await Promise.all([
    readJson("spec/protocol/v1/room-state.schema.json"),
    readJson("spec/protocol/v1/server-message.schema.json"),
  ]);
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  ajv.addSchema(roomStateSchema);
  const validateRoomState = ajv.getSchema(roomStateSchema.$id);
  const validateServerMessage = ajv.compile(serverMessageSchema);
  const fixtureDirectory = new URL("conformance/fixtures/v1/", repositoryRoot);
  const fixtureNames = (await readdir(fixtureDirectory))
    .filter((name) => name.endsWith(".json"))
    .sort();

  for (const fixtureName of fixtureNames) {
    await t.test(fixtureName, async () => {
      const fixture = JSON.parse(
        await readFile(new URL(fixtureName, fixtureDirectory), "utf8"),
      );
      const finalState = runFixture(fixture, {
        onServerMessage(message) {
          assert.equal(
            validateServerMessage(message),
            true,
            JSON.stringify(validateServerMessage.errors, null, 2),
          );
        },
      });
      assert.equal(
        validateRoomState(finalState),
        true,
        JSON.stringify(validateRoomState.errors, null, 2),
      );
      const contentAwareState = structuredClone(finalState);
      contentAwareState.round.contentId = "forbidden_content_identifier";
      assert.equal(validateRoomState(contentAwareState), false);
    });
  }
});
