// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { InMemoryRelay } from "@watch-together/reference-relay";
import { ProtocolConsumer } from "./protocol-consumer.js";

function assertResponse(response, expectation, labels) {
  assert.equal(response.type, expectation.type);
  assert.equal(response.revision, expectation.revision);
  if (expectation.type === "command.accepted") {
    assert.equal(response.payload.applied, expectation.applied);
  } else {
    assert.equal(response.payload.code, expectation.code);
  }
  if (expectation.sameAs) {
    assert.deepEqual(response, labels.get(expectation.sameAs));
  }
}

function assertState(state, consumer, expectation, nowMs) {
  if (expectation.revision !== undefined) {
    assert.equal(state.revision, expectation.revision);
  }
  if (expectation.roundId !== undefined) {
    assert.equal(state.round.roundId, expectation.roundId);
  }
  if (expectation.roundGeneration !== undefined) {
    assert.equal(state.round.generation, expectation.roundGeneration);
  }
  if (expectation.roundStatus !== undefined) {
    assert.equal(state.round.status, expectation.roundStatus);
  }
  if (expectation.playbackMode !== undefined) {
    assert.equal(state.round.playback.mode, expectation.playbackMode);
  }
  if (expectation.canonicalPositionMs !== undefined) {
    assert.equal(consumer.canonicalPositionAt(nowMs), expectation.canonicalPositionMs);
  }
  if (expectation.participant) {
    const participant = state.participants.find(
      (candidate) => candidate.participantId === expectation.participant.participantId,
    );
    assert.ok(participant, "expected participant to exist");
    if (expectation.participant.connection !== undefined) {
      assert.equal(participant.connection, expectation.participant.connection);
    }
    if (expectation.participant.readiness !== undefined) {
      const { roundId: _roundId, ...readiness } = participant.readiness;
      assert.deepEqual(readiness, expectation.participant.readiness);
    }
  }
}

export function runFixture(fixture, { onServerMessage = () => {} } = {}) {
  let nowMs = fixture.clockStartMs;
  const relay = new InMemoryRelay({ now: () => nowMs });
  const consumer = new ProtocolConsumer();
  const labels = new Map();
  const room = fixture.room;

  relay.createRoom({
    roomId: room.roomId,
    hostParticipantId: room.hostParticipantId,
    hostDisplayName: room.hostDisplayName,
    hostSessionId: room.hostSessionId,
    roundId: room.roundId,
    capacity: room.capacity,
    createdAtMs: nowMs,
    expiresAtMs: nowMs + room.lifetimeMs,
  });
  for (const participant of fixture.participants) {
    relay.joinParticipant({ roomId: room.roomId, ...participant });
  }

  const syncConsumer = () => {
    const message = relay.snapshotMessage(room.roomId, { relayTimeMs: nowMs });
    onServerMessage(message);
    consumer.consume(message);
    assert.deepEqual(consumer.snapshot(), relay.snapshot(room.roomId));
  };
  syncConsumer();

  for (const [index, step] of fixture.steps.entries()) {
    try {
      switch (step.op) {
        case "advance":
          nowMs += step.byMs;
          assert.ok(Number.isSafeInteger(nowMs), "fixture clock exceeds safe integer range");
          break;
        case "command": {
          const response = relay.applyCommand(step.command, { acceptedAtMs: nowMs });
          onServerMessage(response);
          assertResponse(response, step.expect, labels);
          if (step.label) labels.set(step.label, response);
          syncConsumer();
          break;
        }
        case "disconnect": {
          const state = relay.disconnectParticipant({
            roomId: room.roomId,
            participantId: step.participantId,
            sessionId: step.sessionId,
          });
          assert.equal(state.revision, step.revision);
          syncConsumer();
          break;
        }
        case "reconnect": {
          const state = relay.reconnectParticipant({
            roomId: room.roomId,
            participantId: step.participantId,
            sessionId: step.sessionId,
          });
          assert.equal(state.revision, step.revision);
          syncConsumer();
          break;
        }
        case "nextRound": {
          const state = relay.startNextRound({
            roomId: room.roomId,
            roundId: step.roundId,
            acceptedAtMs: nowMs,
          });
          assert.equal(state.revision, step.revision);
          syncConsumer();
          break;
        }
        case "assert":
          assertState(relay.snapshot(room.roomId), consumer, step.expect, nowMs);
          break;
        default:
          assert.fail(`unsupported fixture operation: ${step.op}`);
      }
    } catch (error) {
      error.message = `${fixture.name} step ${index + 1}: ${error.message}`;
      throw error;
    }
  }

  return relay.snapshot(room.roomId);
}
