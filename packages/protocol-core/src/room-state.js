// SPDX-License-Identifier: Apache-2.0

import {
  canonicalPositionAt,
  createPlaybackAnchor,
  pausePlayback,
  resumePlayback,
  seekPlayback,
} from "./canonical-clock.js";
import { ProtocolError } from "./errors.js";
import {
  requireBoolean,
  requireDisplayName,
  requireNonNegativeInteger,
  requireOpaqueId,
  requirePositiveInteger,
} from "./validation.js";

export const DEFAULT_COUNTDOWN_DURATION_MS = 5_000;
export const DEFAULT_DURATION_TOLERANCE_MS = 3_000;

function readinessFor(roundId) {
  return {
    roundId,
    sourceReady: false,
    viewerReady: false,
    durationMs: null,
    durationMismatchAcknowledged: false,
  };
}

function clone(value) {
  return structuredClone(value);
}

function incrementSafeInteger(value, fieldName) {
  requirePositiveInteger(value, fieldName);
  if (value >= Number.MAX_SAFE_INTEGER) {
    throw new ProtocolError("INVALID_COMMAND", `${fieldName} cannot be incremented`);
  }
  return value + 1;
}

function bump(state) {
  state.revision = incrementSafeInteger(state.revision, "revision");
  return state;
}

export function createRoomState({
  roomId,
  hostParticipantId,
  hostDisplayName,
  roundId,
  createdAtMs,
  expiresAtMs,
  capacity,
  initialPositionMs = 0,
}) {
  requireOpaqueId(roomId, "roomId");
  requireOpaqueId(hostParticipantId, "hostParticipantId");
  const validatedHostDisplayName = requireDisplayName(
    hostDisplayName,
    "hostDisplayName",
  );
  requireOpaqueId(roundId, "roundId");
  requireNonNegativeInteger(createdAtMs, "createdAtMs");
  requireNonNegativeInteger(initialPositionMs, "initialPositionMs");
  requirePositiveInteger(expiresAtMs, "expiresAtMs");
  if (expiresAtMs <= createdAtMs) {
    throw new ProtocolError("INVALID_COMMAND", "expiresAtMs must follow createdAtMs");
  }
  if (!Number.isInteger(capacity) || capacity < 2 || capacity > 8) {
    throw new ProtocolError("INVALID_COMMAND", "capacity must be between 2 and 8");
  }

  return {
    protocolVersion: "1.0",
    roomId,
    revision: 1,
    status: "open",
    createdAtMs,
    expiresAtMs,
    capacity,
    hostParticipantId,
    admission: {
      state: "open",
      inviteGeneration: 1,
    },
    participants: [
      {
        participantId: hostParticipantId,
        displayName: validatedHostDisplayName,
        role: "host",
        connection: "connected",
        readiness: readinessFor(roundId),
      },
    ],
    round: {
      roundId,
      generation: 1,
      status: "preparing",
      countdown: null,
      playback: createPlaybackAnchor(createdAtMs, initialPositionMs),
    },
  };
}

export function addParticipant(state, participantId, displayName) {
  requireOpaqueId(participantId, "participantId");
  const validatedDisplayName = requireDisplayName(displayName, "displayName");
  if (state.participants.some((participant) => participant.participantId === participantId)) {
    throw new ProtocolError("INVALID_COMMAND", "participant already exists");
  }
  if (state.participants.length >= state.capacity) {
    throw new ProtocolError("INVALID_COMMAND", "room capacity is full");
  }
  const next = clone(state);
  next.participants.push({
    participantId,
    displayName: validatedDisplayName,
    role: "guest",
    connection: "connected",
    readiness: readinessFor(next.round.roundId),
  });
  return bump(next);
}

export function setParticipantConnection(state, participantId, connection) {
  const next = clone(state);
  const participant = next.participants.find(
    (candidate) => candidate.participantId === participantId,
  );
  if (!participant) {
    throw new ProtocolError("PARTICIPANT_NOT_FOUND", "participant is not admitted");
  }
  if (!new Set(["connected", "disconnected"]).has(connection)) {
    throw new ProtocolError("INVALID_COMMAND", "invalid participant connection state");
  }
  if (participant.connection === connection) return { state, applied: false };
  participant.connection = connection;
  return { state: bump(next), applied: true };
}

export function beginRound(state, { roundId, acceptedAtMs }) {
  requireOpaqueId(roundId, "roundId");
  requireNonNegativeInteger(acceptedAtMs, "acceptedAtMs");
  if (roundId === state.round.roundId) {
    throw new ProtocolError("INVALID_COMMAND", "roundId must be unique within a room");
  }
  const next = clone(state);
  next.round = {
    roundId,
    generation: incrementSafeInteger(state.round.generation, "round generation"),
    status: "preparing",
    countdown: null,
    playback: createPlaybackAnchor(acceptedAtMs),
  };
  next.participants = next.participants.map((participant) => ({
    ...participant,
    readiness: readinessFor(roundId),
  }));
  return bump(next);
}

export function evaluateReadinessGate(
  state,
  { durationToleranceMs = DEFAULT_DURATION_TOLERANCE_MS } = {},
) {
  requireNonNegativeInteger(durationToleranceMs, "durationToleranceMs");
  const participants = state.participants;
  const disconnectedParticipantIds = participants
    .filter((participant) => participant.connection !== "connected")
    .map((participant) => participant.participantId);
  const sourcePendingParticipantIds = participants
    .filter((participant) => !participant.readiness.sourceReady)
    .map((participant) => participant.participantId);
  const viewerPendingParticipantIds = participants
    .filter((participant) => !participant.readiness.viewerReady)
    .map((participant) => participant.participantId);
  const durationPendingParticipantIds = participants
    .filter((participant) => participant.readiness.durationMs === null)
    .map((participant) => participant.participantId);
  const durations = participants
    .map((participant) => participant.readiness.durationMs)
    .filter((durationMs) => durationMs !== null);
  const durationSpreadMs = durations.length > 1
    ? Math.max(...durations) - Math.min(...durations)
    : 0;
  const durationMismatch = durationSpreadMs > durationToleranceMs;
  const mismatchUnacknowledgedParticipantIds = durationMismatch
    ? participants
      .filter((participant) => !participant.readiness.durationMismatchAcknowledged)
      .map((participant) => participant.participantId)
    : [];

  return {
    ready:
      disconnectedParticipantIds.length === 0 &&
      sourcePendingParticipantIds.length === 0 &&
      viewerPendingParticipantIds.length === 0 &&
      durationPendingParticipantIds.length === 0 &&
      mismatchUnacknowledgedParticipantIds.length === 0,
    durationToleranceMs,
    durationSpreadMs,
    durationMismatch,
    disconnectedParticipantIds,
    sourcePendingParticipantIds,
    viewerPendingParticipantIds,
    durationPendingParticipantIds,
    mismatchUnacknowledgedParticipantIds,
  };
}

export function beginCountdown(
  state,
  {
    acceptedAtMs,
    countdownDurationMs = DEFAULT_COUNTDOWN_DURATION_MS,
    durationToleranceMs = DEFAULT_DURATION_TOLERANCE_MS,
  },
) {
  requireNonNegativeInteger(acceptedAtMs, "acceptedAtMs");
  requirePositiveInteger(countdownDurationMs, "countdownDurationMs");
  if (state.round.status !== "preparing") {
    throw new ProtocolError("INVALID_COMMAND", "a countdown can only begin while preparing");
  }
  if (state.round.playback.mode !== "paused") {
    throw new ProtocolError("INVALID_COMMAND", "a countdown requires paused playback");
  }
  const gate = evaluateReadinessGate(state, { durationToleranceMs });
  if (!gate.ready) {
    throw new ProtocolError("READINESS_REQUIRED", "all participants must pass the readiness gate");
  }
  const endsAtRelayTimeMs = acceptedAtMs + countdownDurationMs;
  if (!Number.isSafeInteger(endsAtRelayTimeMs)) {
    throw new ProtocolError("INVALID_COMMAND", "countdown end exceeds the safe integer range");
  }
  const next = clone(state);
  next.round.status = "countdown";
  next.round.countdown = {
    startedAtRelayTimeMs: acceptedAtMs,
    endsAtRelayTimeMs,
  };
  next.round.playback = {
    ...next.round.playback,
    anchorPositionMs: canonicalPositionAt(next.round.playback, acceptedAtMs),
    anchorRelayTimeMs: acceptedAtMs,
  };
  return bump(next);
}

export function cancelCountdown(state) {
  if (state.round.status !== "countdown") return { state, applied: false };
  const next = clone(state);
  next.round.status = "preparing";
  next.round.countdown = null;
  return { state: bump(next), applied: true };
}

export function completeCountdown(state, { acceptedAtMs }) {
  requireNonNegativeInteger(acceptedAtMs, "acceptedAtMs");
  if (state.round.status !== "countdown") return { state, applied: false };
  const countdown = state.round.countdown;
  if (!countdown || acceptedAtMs < countdown.endsAtRelayTimeMs) {
    throw new ProtocolError("COUNTDOWN_ACTIVE", "the countdown has not finished");
  }
  const next = clone(state);
  next.round.status = "active";
  next.round.countdown = null;
  next.round.playback = {
    ...next.round.playback,
    mode: "playing",
    anchorRelayTimeMs: countdown.endsAtRelayTimeMs,
  };
  return { state: bump(next), applied: true };
}

export function setAdmissionState(state, admissionState) {
  if (!new Set(["open", "paused"]).has(admissionState)) {
    throw new ProtocolError("INVALID_COMMAND", "invalid admission state");
  }
  if (state.admission.state === admissionState) return { state, applied: false };
  const next = clone(state);
  next.admission.state = admissionState;
  return { state: bump(next), applied: true };
}

export function rotateInvitation(state) {
  const next = clone(state);
  next.admission.inviteGeneration = incrementSafeInteger(
    next.admission.inviteGeneration,
    "invitation generation",
  );
  return bump(next);
}

export function reduceRoomCommand(state, command, acceptedAtMs) {
  requireNonNegativeInteger(acceptedAtMs, "acceptedAtMs");
  if (command.roundId !== state.round.roundId) {
    throw new ProtocolError("ROUND_MISMATCH", "command targets a stale playback round");
  }
  const participant = state.participants.find(
    (candidate) => candidate.participantId === command.participantId,
  );
  if (!participant) {
    throw new ProtocolError("PARTICIPANT_NOT_FOUND", "participant is not admitted");
  }

  const next = clone(state);
  let result;
  switch (command.type) {
    case "playback.pause":
      result = pausePlayback(next.round.playback, acceptedAtMs);
      next.round.playback = result.playback;
      break;
    case "playback.resume":
      result = resumePlayback(next.round.playback, acceptedAtMs);
      next.round.playback = result.playback;
      if (result.applied) next.round.status = "active";
      break;
    case "playback.seek":
      result = seekPlayback(next.round.playback, command.payload.positionMs, acceptedAtMs);
      next.round.playback = result.playback;
      break;
    case "participant.readiness": {
      const target = next.participants.find(
        (candidate) => candidate.participantId === command.participantId,
      );
      const durationMs = command.payload.durationMs;
      if (
        durationMs !== null &&
        (!Number.isSafeInteger(durationMs) || durationMs < 0 || durationMs % 1000 !== 0)
      ) {
        throw new ProtocolError(
          "INVALID_COMMAND",
          "durationMs must be null or a non-negative whole second",
        );
      }
      const readiness = {
        roundId: next.round.roundId,
        sourceReady: requireBoolean(command.payload.sourceReady, "sourceReady"),
        viewerReady: requireBoolean(command.payload.viewerReady, "viewerReady"),
        durationMs,
        durationMismatchAcknowledged: requireBoolean(
          command.payload.durationMismatchAcknowledged,
          "durationMismatchAcknowledged",
        ),
      };
      result = {
        applied: JSON.stringify(target.readiness) !== JSON.stringify(readiness),
      };
      target.readiness = readiness;
      break;
    }
    default:
      throw new ProtocolError("INVALID_COMMAND", `unsupported command: ${command.type}`);
  }

  if (!result.applied) return { state, applied: false };
  next.revision += 1;
  return { state: next, applied: true };
}
