// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryRelay } from "../src/index.js";

function command(overrides = {}) {
  return {
    protocolVersion: "1.0",
    messageId: "message_test_0001",
    roomId: "room_test_0001",
    roundId: "round_test_0001",
    participantId: "host_test_0001",
    sessionId: "session_test_0001",
    sequence: 1,
    sentAtMs: 1000,
    type: "playback.resume",
    payload: {},
    ...overrides,
  };
}

test("the relay returns schema-compatible context for missing and expired rooms", () => {
  let nowMs = 1000;
  const relay = new InMemoryRelay({ now: () => nowMs });
  const missing = relay.applyCommand(command());
  assert.equal(missing.payload.code, "ROOM_NOT_FOUND");
  assert.equal(missing.revision, 0);

  relay.createRoom({
    roomId: "room_test_0001",
    hostParticipantId: "host_test_0001",
    hostDisplayName: "Host",
    hostSessionId: "session_test_0001",
    roundId: "round_test_0001",
    capacity: 2,
    createdAtMs: 1000,
    expiresAtMs: 2000,
  });
  nowMs = 2000;
  const expired = relay.applyCommand(command(), { acceptedAtMs: nowMs });
  assert.equal(expired.payload.code, "ROOM_EXPIRED");
  assert.equal(expired.revision, 1);
});

test("the relay rejects unsupported protocol versions", () => {
  const relay = new InMemoryRelay({ now: () => 1000 });
  relay.createRoom({
    roomId: "room_test_0001",
    hostParticipantId: "host_test_0001",
    hostDisplayName: "Host",
    hostSessionId: "session_test_0001",
    roundId: "round_test_0001",
    capacity: 2,
    createdAtMs: 1000,
    expiresAtMs: 2000,
  });

  const response = relay.applyCommand(command({ protocolVersion: "2.0" }));
  assert.equal(response.payload.code, "UNSUPPORTED_PROTOCOL");
  assert.equal(response.revision, 1);
});

test("paused admission blocks joins until the host reopens it", () => {
  const relay = new InMemoryRelay({ now: () => 1000 });
  relay.createRoom({
    roomId: "room_test_0001",
    hostParticipantId: "host_test_0001",
    hostDisplayName: "Host",
    hostSessionId: "session_test_0001",
    roundId: "round_test_0001",
    capacity: 2,
    createdAtMs: 1000,
    expiresAtMs: 2000,
  });
  relay.pauseAdmission("room_test_0001");

  assert.throws(
    () =>
      relay.joinParticipant({
        roomId: "room_test_0001",
        participantId: "guest_test_0001",
        displayName: "Guest",
        sessionId: "guest_session_0001",
      }),
    /admission is paused/,
  );

  relay.openAdmission("room_test_0001");
  const joined = relay.joinParticipant({
    roomId: "room_test_0001",
    participantId: "guest_test_0001",
    displayName: "Guest",
    sessionId: "guest_session_0001",
  });
  assert.equal(joined.participants.length, 2);
});

test("round identifiers cannot be reused within a room", () => {
  const relay = new InMemoryRelay({ now: () => 1000 });
  relay.createRoom({
    roomId: "room_test_0001",
    hostParticipantId: "host_test_0001",
    hostDisplayName: "Host",
    hostSessionId: "session_test_0001",
    roundId: "round_test_0001",
    capacity: 2,
    createdAtMs: 1000,
    expiresAtMs: 10000,
  });
  relay.startNextRound({
    roomId: "room_test_0001",
    roundId: "round_test_0002",
    acceptedAtMs: 2000,
  });

  assert.throws(
    () =>
      relay.startNextRound({
        roomId: "room_test_0001",
        roundId: "round_test_0001",
        acceptedAtMs: 3000,
      }),
    /already used/,
  );
});
