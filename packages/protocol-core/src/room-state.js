// SPDX-License-Identifier: Apache-2.0

import {
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
}) {
  requireOpaqueId(roomId, "roomId");
  requireOpaqueId(hostParticipantId, "hostParticipantId");
  const validatedHostDisplayName = requireDisplayName(
    hostDisplayName,
    "hostDisplayName",
  );
  requireOpaqueId(roundId, "roundId");
  requireNonNegativeInteger(createdAtMs, "createdAtMs");
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
      playback: createPlaybackAnchor(createdAtMs),
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
    playback: createPlaybackAnchor(acceptedAtMs),
  };
  next.participants = next.participants.map((participant) => ({
    ...participant,
    readiness: readinessFor(roundId),
  }));
  return bump(next);
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
