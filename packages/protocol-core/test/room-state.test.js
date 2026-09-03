// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import test from "node:test";
import {
  addParticipant,
  beginCountdown,
  beginRound,
  cancelCountdown,
  completeCountdown,
  createRoomState,
  evaluateReadinessGate,
  reduceRoomCommand,
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

test("a room starts paused at the host's current position", () => {
  const state = createRoomState({
    roomId: "room_test_0002",
    hostParticipantId: "host_test_0002",
    hostDisplayName: "Host",
    roundId: "round_test_0002",
    createdAtMs: 2000,
    expiresAtMs: 21602000,
    capacity: 2,
    initialPositionMs: 3_725_000,
  });

  assert.equal(state.round.playback.mode, "paused");
  assert.equal(state.round.playback.anchorPositionMs, 3_725_000);
  assert.equal(state.round.playback.anchorRelayTimeMs, 2000);
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

function readinessCommand({ participantId, sequence, durationMs, acknowledged = false }) {
  return {
    protocolVersion: "1.0",
    messageId: `message_${participantId}_${sequence}`,
    roomId: "room_test_0001",
    roundId: "round_test_0001",
    participantId,
    sessionId: `session_${participantId}`,
    sequence,
    sentAtMs: 10_000,
    type: "participant.readiness",
    payload: {
      sourceReady: true,
      viewerReady: true,
      durationMs,
      durationMismatchAcknowledged: acknowledged,
    },
  };
}

function readyRoom({ hostDurationMs = 3_600_000, guestDurationMs = 3_602_000 } = {}) {
  let state = addParticipant(room(), "guest_test_0001", "Guest");
  state = reduceRoomCommand(
    state,
    readinessCommand({
      participantId: "host_test_0001",
      sequence: 1,
      durationMs: hostDurationMs,
    }),
    10_000,
  ).state;
  state = reduceRoomCommand(
    state,
    readinessCommand({
      participantId: "guest_test_0001",
      sequence: 1,
      durationMs: guestDurationMs,
    }),
    10_000,
  ).state;
  return state;
}

test("readiness gates require connected viewers, loaded sources, and known durations", () => {
  const state = addParticipant(room(), "guest_test_0001", "Guest");
  const gate = evaluateReadinessGate(state);

  assert.equal(gate.ready, false);
  assert.deepEqual(gate.sourcePendingParticipantIds, [
    "host_test_0001",
    "guest_test_0001",
  ]);
  assert.deepEqual(gate.durationPendingParticipantIds, [
    "host_test_0001",
    "guest_test_0001",
  ]);
});

test("duration differences within three seconds can enter the shared countdown", () => {
  const state = readyRoom();
  const gate = evaluateReadinessGate(state);
  assert.equal(gate.ready, true);
  assert.equal(gate.durationSpreadMs, 2_000);
  assert.equal(gate.durationMismatch, false);

  const countdown = beginCountdown(state, { acceptedAtMs: 12_000 });
  assert.equal(countdown.round.status, "countdown");
  assert.deepEqual(countdown.round.countdown, {
    startedAtRelayTimeMs: 12_000,
    endsAtRelayTimeMs: 17_000,
  });
  assert.equal(countdown.round.playback.mode, "paused");

  assert.throws(
    () => completeCountdown(countdown, { acceptedAtMs: 16_999 }),
    /countdown has not finished/,
  );
  const active = completeCountdown(countdown, { acceptedAtMs: 17_250 }).state;
  assert.equal(active.round.status, "active");
  assert.equal(active.round.countdown, null);
  assert.equal(active.round.playback.mode, "playing");
  assert.equal(active.round.playback.anchorRelayTimeMs, 17_000);
});

test("any pending viewer can cancel a countdown without changing playback position", () => {
  const countdown = beginCountdown(readyRoom(), { acceptedAtMs: 12_000 });
  const cancelled = cancelCountdown(countdown);

  assert.equal(cancelled.applied, true);
  assert.equal(cancelled.state.round.status, "preparing");
  assert.equal(cancelled.state.round.countdown, null);
  assert.equal(cancelled.state.round.playback.mode, "paused");
  assert.equal(cancelCountdown(cancelled.state).applied, false);
});

test("duration mismatches require acknowledgement from every participant", () => {
  let state = readyRoom({ guestDurationMs: 3_606_000 });
  let gate = evaluateReadinessGate(state);
  assert.equal(gate.durationMismatch, true);
  assert.equal(gate.durationSpreadMs, 6_000);
  assert.equal(gate.ready, false);
  assert.deepEqual(gate.mismatchUnacknowledgedParticipantIds, [
    "host_test_0001",
    "guest_test_0001",
  ]);

  state = reduceRoomCommand(
    state,
    readinessCommand({
      participantId: "host_test_0001",
      sequence: 2,
      durationMs: 3_600_000,
      acknowledged: true,
    }),
    11_000,
  ).state;
  state = reduceRoomCommand(
    state,
    readinessCommand({
      participantId: "guest_test_0001",
      sequence: 2,
      durationMs: 3_606_000,
      acknowledged: true,
    }),
    11_000,
  ).state;
  gate = evaluateReadinessGate(state);
  assert.equal(gate.ready, true);
  assert.deepEqual(gate.mismatchUnacknowledgedParticipantIds, []);
});
