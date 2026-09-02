// SPDX-License-Identifier: Apache-2.0

import {
  ProtocolError,
  addParticipant,
  beginRound,
  createRoomState,
  reduceRoomCommand,
  rotateInvitation,
  setAdmissionState,
  setParticipantConnection,
} from "@watch-together/protocol-core";
import { stableStringify } from "./stable-json.js";

const opaqueIdPattern = /^[A-Za-z0-9_-]{8,128}$/;

function clone(value) {
  return structuredClone(value);
}

function requireSessionId(value) {
  if (typeof value !== "string" || !opaqueIdPattern.test(value)) {
    throw new ProtocolError(
      "INVALID_COMMAND",
      "sessionId must be an opaque identifier between 8 and 128 characters",
    );
  }
}

export class InMemoryRelay {
  #messageCounter = 0;
  #now;
  #rooms = new Map();

  constructor({ now = () => Date.now() } = {}) {
    this.#now = now;
  }

  createRoom({
    roomId,
    hostParticipantId,
    hostDisplayName,
    hostSessionId,
    roundId,
    capacity,
    createdAtMs = this.#now(),
    expiresAtMs,
  }) {
    requireSessionId(hostSessionId);
    if (this.#rooms.has(roomId)) {
      throw new ProtocolError("INVALID_COMMAND", "room already exists");
    }
    const state = createRoomState({
      roomId,
      hostParticipantId,
      hostDisplayName,
      roundId,
      capacity,
      createdAtMs,
      expiresAtMs,
    });
    this.#rooms.set(roomId, {
      state,
      sessions: new Map([
        [
          hostParticipantId,
          {
            activeSessionId: hostSessionId,
            lastSequence: 0,
          },
        ],
      ]),
      processedMessages: new Map(),
      usedRoundIds: new Set([roundId]),
    });
    return this.snapshot(roomId);
  }

  joinParticipant({ roomId, participantId, displayName, sessionId }) {
    const room = this.#requireRoom(roomId);
    requireSessionId(sessionId);
    if (room.state.admission.state !== "open") {
      throw new ProtocolError("INVALID_COMMAND", "room admission is paused");
    }
    room.state = addParticipant(room.state, participantId, displayName);
    room.sessions.set(participantId, {
      activeSessionId: sessionId,
      lastSequence: 0,
    });
    return this.snapshot(roomId);
  }

  disconnectParticipant({ roomId, participantId, sessionId }) {
    const room = this.#requireRoom(roomId);
    requireSessionId(sessionId);
    const session = room.sessions.get(participantId);
    if (!session) {
      throw new ProtocolError("PARTICIPANT_NOT_FOUND", "participant is not admitted");
    }
    if (session.activeSessionId !== sessionId) {
      throw new ProtocolError("SESSION_NOT_ACTIVE", "session is not active");
    }
    const result = setParticipantConnection(room.state, participantId, "disconnected");
    room.state = result.state;
    session.activeSessionId = null;
    return this.snapshot(roomId);
  }

  reconnectParticipant({ roomId, participantId, sessionId }) {
    const room = this.#requireRoom(roomId);
    requireSessionId(sessionId);
    const session = room.sessions.get(participantId);
    if (!session) {
      throw new ProtocolError("PARTICIPANT_NOT_FOUND", "participant is not admitted");
    }
    session.activeSessionId = sessionId;
    session.lastSequence = 0;
    const result = setParticipantConnection(room.state, participantId, "connected");
    room.state = result.state;
    return this.snapshot(roomId);
  }

  startNextRound({ roomId, roundId, acceptedAtMs = this.#now() }) {
    const room = this.#requireRoom(roomId);
    if (room.usedRoundIds.has(roundId)) {
      throw new ProtocolError("INVALID_COMMAND", "roundId was already used in this room");
    }
    room.state = beginRound(room.state, { roundId, acceptedAtMs });
    room.usedRoundIds.add(roundId);
    return this.snapshot(roomId);
  }

  pauseAdmission(roomId) {
    const room = this.#requireRoom(roomId);
    const result = setAdmissionState(room.state, "paused");
    room.state = result.state;
    return this.snapshot(roomId);
  }

  openAdmission(roomId) {
    const room = this.#requireRoom(roomId);
    const result = setAdmissionState(room.state, "open");
    room.state = result.state;
    return this.snapshot(roomId);
  }

  rotateInvitation(roomId) {
    const room = this.#requireRoom(roomId);
    room.state = rotateInvitation(room.state);
    return this.snapshot(roomId);
  }

  applyCommand(command, { acceptedAtMs = this.#now() } = {}) {
    const room = this.#rooms.get(command.roomId);
    if (!room) return this.#rejected(command, "ROOM_NOT_FOUND", 0, acceptedAtMs);
    if (acceptedAtMs >= room.state.expiresAtMs) {
      return this.#rejected(
        command,
        "ROOM_EXPIRED",
        room.state.revision,
        acceptedAtMs,
      );
    }
    if (command.protocolVersion !== "1.0") {
      return this.#rejected(
        command,
        "UNSUPPORTED_PROTOCOL",
        room.state.revision,
        acceptedAtMs,
      );
    }

    const fingerprint = stableStringify(command);
    const processed = room.processedMessages.get(command.messageId);
    if (processed) {
      if (processed.fingerprint !== fingerprint) {
        return this.#rejected(
          command,
          "MESSAGE_ID_REUSE",
          room.state.revision,
          acceptedAtMs,
        );
      }
      return clone(processed.response);
    }

    const session = room.sessions.get(command.participantId);
    if (!session) {
      return this.#rememberRejection(
        room,
        command,
        fingerprint,
        "PARTICIPANT_NOT_FOUND",
        acceptedAtMs,
      );
    }
    if (session.activeSessionId !== command.sessionId) {
      return this.#rememberRejection(
        room,
        command,
        fingerprint,
        "SESSION_NOT_ACTIVE",
        acceptedAtMs,
      );
    }
    if (
      !Number.isSafeInteger(command.sequence) ||
      command.sequence <= session.lastSequence
    ) {
      return this.#rememberRejection(
        room,
        command,
        fingerprint,
        "STALE_SEQUENCE",
        acceptedAtMs,
      );
    }
    if (command.roundId !== room.state.round.roundId) {
      return this.#rememberRejection(
        room,
        command,
        fingerprint,
        "ROUND_MISMATCH",
        acceptedAtMs,
      );
    }

    try {
      const result = reduceRoomCommand(room.state, command, acceptedAtMs);
      room.state = result.state;
      session.lastSequence = command.sequence;
      const response = this.#accepted(
        command,
        result.applied,
        room.state.revision,
        acceptedAtMs,
      );
      room.processedMessages.set(command.messageId, { fingerprint, response });
      return clone(response);
    } catch (error) {
      const code = error instanceof ProtocolError ? error.code : "INVALID_COMMAND";
      return this.#rememberRejection(room, command, fingerprint, code, acceptedAtMs);
    }
  }

  snapshot(roomId) {
    return clone(this.#requireRoom(roomId).state);
  }

  snapshotMessage(roomId, { relayTimeMs = this.#now() } = {}) {
    const state = this.snapshot(roomId);
    return {
      protocolVersion: "1.0",
      messageId: this.#nextMessageId(),
      roomId,
      revision: state.revision,
      relayTimeMs,
      type: "state.snapshot",
      payload: { state },
    };
  }

  #accepted(command, applied, revision, relayTimeMs) {
    return {
      protocolVersion: "1.0",
      messageId: this.#nextMessageId(),
      roomId: command.roomId,
      revision,
      relayTimeMs,
      type: "command.accepted",
      payload: {
        commandMessageId: command.messageId,
        applied,
      },
    };
  }

  #rejected(command, code, revision, relayTimeMs) {
    return {
      protocolVersion: "1.0",
      messageId: this.#nextMessageId(),
      roomId: command.roomId,
      revision,
      relayTimeMs,
      type: "command.rejected",
      payload: {
        commandMessageId: command.messageId,
        code,
      },
    };
  }

  #rememberRejection(room, command, fingerprint, code, relayTimeMs) {
    const response = this.#rejected(
      command,
      code,
      room.state.revision,
      relayTimeMs,
    );
    room.processedMessages.set(command.messageId, { fingerprint, response });
    return clone(response);
  }

  #nextMessageId() {
    this.#messageCounter += 1;
    return `server_msg_${String(this.#messageCounter).padStart(8, "0")}`;
  }

  #requireRoom(roomId) {
    const room = this.#rooms.get(roomId);
    if (!room) throw new ProtocolError("ROOM_NOT_FOUND", "room does not exist");
    return room;
  }
}
