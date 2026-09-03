// SPDX-License-Identifier: Apache-2.0

import { randomBytes } from "node:crypto";
import { WebSocketServer } from "ws";
import { InMemoryRelay } from "./in-memory-relay.js";

const ROOM_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const ROOM_LIFETIME_MS = 6 * 60 * 60 * 1000;

function opaqueId(prefix) {
  return `${prefix}_${randomBytes(18).toString("base64url")}`;
}

function cleanDisplayName(value) {
  if (typeof value !== "string") throw new Error("displayName is required");
  const result = value.trim();
  if (result.length === 0 || [...result].length > 40) {
    throw new Error("displayName must contain 1 to 40 characters");
  }
  return result;
}

function cleanRoomCode(value) {
  if (typeof value !== "string") throw new Error("roomCode is required");
  const result = value.trim().toUpperCase().replaceAll("-", "");
  if (!/^[23456789A-HJ-NP-Z]{8}$/u.test(result)) {
    throw new Error("roomCode must contain 8 unambiguous letters or digits");
  }
  return result;
}

function cleanInitialPositionMs(value) {
  if (value === undefined) return 0;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("initialPositionMs must be a non-negative integer");
  }
  return value;
}

function send(socket, value) {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(value));
}

export class DevelopmentRelayServer {
  #host;
  #now;
  #port;
  #relay;
  #roomCodes = new Map();
  #roomConnections = new Map();
  #sessions = new Map();
  #server = null;

  constructor({ host = "127.0.0.1", port = 8787, now = () => Date.now() } = {}) {
    this.#host = host;
    this.#port = port;
    this.#now = now;
    this.#relay = new InMemoryRelay({ now });
  }

  async start() {
    if (this.#server) throw new Error("development relay is already running");
    const server = new WebSocketServer({
      host: this.#host,
      port: this.#port,
      maxPayload: 64 * 1024,
      perMessageDeflate: false,
    });
    this.#server = server;
    server.on("connection", (socket) => this.#handleConnection(socket));
    await new Promise((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
    return this.address();
  }

  address() {
    if (!this.#server) return null;
    const address = this.#server.address();
    if (!address || typeof address === "string") return null;
    return { host: this.#host, port: address.port };
  }

  async stop() {
    const server = this.#server;
    if (!server) return;
    this.#server = null;
    for (const socket of server.clients) socket.terminate();
    await new Promise((resolve) => server.close(resolve));
  }

  #handleConnection(socket) {
    socket.on("message", (data, isBinary) => {
      if (isBinary) {
        this.#sendError(socket, null, "INVALID_REQUEST", "binary frames are unsupported");
        return;
      }
      let request;
      try {
        request = JSON.parse(data.toString());
      } catch {
        this.#sendError(socket, null, "INVALID_REQUEST", "request must be valid JSON");
        return;
      }
      this.#handleRequest(socket, request);
    });
    socket.on("close", () => this.#disconnect(socket));
  }

  #handleRequest(socket, request) {
    const requestId = typeof request?.requestId === "string" ? request.requestId : null;
    try {
      switch (request?.type) {
        case "room.create":
          this.#createRoom(socket, request, requestId);
          break;
        case "room.join":
          this.#joinRoom(socket, request, requestId);
          break;
        case "session.reconnect":
          this.#reconnect(socket, request, requestId);
          break;
        case "room.command":
          this.#command(socket, request, requestId);
          break;
        case "clock.ping":
          this.#clockPing(socket, request, requestId);
          break;
        case "session.drop":
          this.#dropSession(socket);
          break;
        default:
          throw new Error("unsupported request type");
      }
    } catch (error) {
      this.#sendError(
        socket,
        requestId,
        "REQUEST_REJECTED",
        error instanceof Error ? error.message : "request rejected",
      );
    }
  }

  #createRoom(socket, request, requestId) {
    this.#requireUnbound(socket);
    const displayName = cleanDisplayName(request.displayName);
    const roomId = opaqueId("room");
    const participantId = opaqueId("participant");
    const sessionId = opaqueId("session");
    const reconnectToken = opaqueId("reconnect");
    const roundId = opaqueId("round");
    const roomCode = this.#createRoomCode();
    const nowMs = this.#now();
    const initialPositionMs = cleanInitialPositionMs(request.initialPositionMs);

    this.#relay.createRoom({
      roomId,
      hostParticipantId: participantId,
      hostDisplayName: displayName,
      hostSessionId: sessionId,
      roundId,
      capacity: 2,
      createdAtMs: nowMs,
      expiresAtMs: nowMs + ROOM_LIFETIME_MS,
      initialPositionMs,
    });
    this.#roomCodes.set(roomCode, roomId);
    this.#sessions.set(this.#sessionKey(roomId, participantId), reconnectToken);
    this.#bind(socket, { roomId, roomCode, participantId, sessionId });
    this.#sendReady(socket, requestId, reconnectToken);
    this.#broadcastSnapshot(roomId);
  }

  #joinRoom(socket, request, requestId) {
    this.#requireUnbound(socket);
    const displayName = cleanDisplayName(request.displayName);
    const roomCode = cleanRoomCode(request.roomCode);
    const roomId = this.#roomCodes.get(roomCode);
    if (!roomId) throw new Error("room was not found");
    const participantId = opaqueId("participant");
    const sessionId = opaqueId("session");
    const reconnectToken = opaqueId("reconnect");

    this.#relay.joinParticipant({ roomId, participantId, displayName, sessionId });
    this.#sessions.set(this.#sessionKey(roomId, participantId), reconnectToken);
    this.#bind(socket, { roomId, roomCode, participantId, sessionId });
    this.#sendReady(socket, requestId, reconnectToken);
    this.#broadcastSnapshot(roomId);
  }

  #reconnect(socket, request, requestId) {
    this.#requireUnbound(socket);
    const roomId = request.roomId;
    const participantId = request.participantId;
    const reconnectToken = request.reconnectToken;
    const expected = this.#sessions.get(this.#sessionKey(roomId, participantId));
    if (!expected || reconnectToken !== expected) throw new Error("reconnect token is invalid");
    const roomCode = [...this.#roomCodes.entries()].find(([, id]) => id === roomId)?.[0];
    if (!roomCode) throw new Error("room was not found");
    const sessionId = opaqueId("session");
    this.#relay.reconnectParticipant({ roomId, participantId, sessionId });
    this.#bind(socket, { roomId, roomCode, participantId, sessionId });
    this.#sendReady(socket, requestId, reconnectToken);
    this.#broadcastSnapshot(roomId);
  }

  #command(socket, request, requestId) {
    const binding = this.#requireBound(socket);
    const command = request.command;
    if (!command || typeof command !== "object") throw new Error("command is required");
    if (
      command.roomId !== binding.roomId ||
      command.participantId !== binding.participantId ||
      command.sessionId !== binding.sessionId
    ) {
      throw new Error("command identity does not match the active socket session");
    }
    const message = this.#relay.applyCommand(command);
    send(socket, { type: "protocol.message", requestId, message });
    if (message.type === "command.accepted") this.#broadcastSnapshot(binding.roomId);
  }

  #clockPing(socket, request, requestId) {
    this.#requireBound(socket);
    if (!Number.isSafeInteger(request.clientSentAtMs) || request.clientSentAtMs < 0) {
      throw new Error("clientSentAtMs must be a non-negative integer");
    }
    send(socket, {
      type: "clock.pong",
      requestId,
      clientSentAtMs: request.clientSentAtMs,
      relayTimeMs: this.#now(),
    });
  }

  #dropSession(socket) {
    this.#requireBound(socket);
    socket.terminate();
  }

  #sendReady(socket, requestId, reconnectToken) {
    const binding = this.#requireBound(socket);
    const snapshot = this.#relay.snapshotMessage(binding.roomId);
    send(socket, {
      type: "session.ready",
      requestId,
      roomId: binding.roomId,
      roomCode: binding.roomCode,
      participantId: binding.participantId,
      sessionId: binding.sessionId,
      reconnectToken,
      roundId: snapshot.payload.state.round.roundId,
      snapshot,
    });
  }

  #broadcastSnapshot(roomId) {
    const frame = {
      type: "protocol.message",
      requestId: null,
      message: this.#relay.snapshotMessage(roomId),
    };
    for (const socket of this.#roomConnections.get(roomId) ?? []) send(socket, frame);
  }

  #disconnect(socket) {
    const binding = socket.watchTogetherBinding;
    if (!binding) return;
    socket.watchTogetherBinding = null;
    const connections = this.#roomConnections.get(binding.roomId);
    connections?.delete(socket);
    if (connections?.size === 0) this.#roomConnections.delete(binding.roomId);
    try {
      this.#relay.disconnectParticipant(binding);
      this.#broadcastSnapshot(binding.roomId);
    } catch {
      // A superseded connection can close after its reconnect session is active.
    }
  }

  #bind(socket, binding) {
    socket.watchTogetherBinding = binding;
    let connections = this.#roomConnections.get(binding.roomId);
    if (!connections) {
      connections = new Set();
      this.#roomConnections.set(binding.roomId, connections);
    }
    connections.add(socket);
  }

  #requireBound(socket) {
    const binding = socket.watchTogetherBinding;
    if (!binding) throw new Error("socket has no active room session");
    return binding;
  }

  #requireUnbound(socket) {
    if (socket.watchTogetherBinding) throw new Error("socket already has an active room session");
  }

  #sendError(socket, requestId, code, message) {
    send(socket, { type: "relay.error", requestId, code, message });
  }

  #createRoomCode() {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      let code = "";
      const bytes = randomBytes(8);
      for (const byte of bytes) code += ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length];
      if (!this.#roomCodes.has(code)) return code;
    }
    throw new Error("could not allocate a room code");
  }

  #sessionKey(roomId, participantId) {
    return `${roomId}:${participantId}`;
  }
}
