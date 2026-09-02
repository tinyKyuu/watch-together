// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import test from "node:test";
import {
  addParticipant,
  beginRound,
  createRoomState,
  rotateInvitation,
  setAdmissionState,
} from "../src/index.js";

function room() {
  return createRoomState({
    roomId: "room_test_0001",
    hostParticipantId: "host_test_0001",
    hostDisplayName: "Host",
    roundId: "round_test_0001",
    createdAtMs: 1000,
    expiresAtMs: 21601000,
    capacity: 2,
  });
}

test("room transitions are immutable and revisioned", () => {
  const original = room();
  const joined = addParticipant(original, "guest_test_0001", "Guest");
  const pausedAdmission = setAdmissionState(joined, "paused").state;
  const rotated = rotateInvitation(pausedAdmission);

  assert.equal(original.participants.length, 1);
  assert.equal(original.participants[0].displayName, "Host");
  assert.equal(original.revision, 1);
  assert.equal(rotated.participants.length, 2);
  assert.equal(rotated.participants[1].displayName, "Guest");
  assert.equal(rotated.admission.state, "paused");
  assert.equal(rotated.admission.inviteGeneration, 2);
  assert.equal(rotated.revision, 4);
});

test("a new round resets transient readiness without exposing content identity", () => {
  const joined = addParticipant(room(), "guest_test_0001", "Guest");
  const next = beginRound(joined, {
    roundId: "round_test_0002",
    acceptedAtMs: 5000,
  });

  assert.equal(next.round.generation, 2);
  assert.equal(next.round.playback.anchorPositionMs, 0);
  for (const participant of next.participants) {
    assert.deepEqual(participant.readiness, {
      roundId: "round_test_0002",
      sourceReady: false,
      viewerReady: false,
      durationMs: null,
      durationMismatchAcknowledged: false,
    });
  }
  assert.equal(JSON.stringify(next).includes("content"), false);
  assert.equal(JSON.stringify(next).includes("stream"), false);
  assert.throws(
    () =>
      beginRound(next, {
        roundId: "round_test_0002",
        acceptedAtMs: 6000,
      }),
    /roundId must be unique/,
  );
});

test("display names are room-scoped, trimmed, and bounded", () => {
  const joined = addParticipant(room(), "guest_test_0001", "  Friend  ");
  assert.equal(joined.participants[1].displayName, "Friend");
  assert.throws(
    () => addParticipant(room(), "guest_test_0001", "   "),
    /1 to 40 visible characters/,
  );
  assert.throws(
    () => addParticipant(room(), "guest_test_0001", "x".repeat(41)),
    /1 to 40 visible characters/,
  );
});
