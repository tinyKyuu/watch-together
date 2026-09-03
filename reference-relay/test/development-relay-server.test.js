// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import test from "node:test";
import WebSocket from "ws";
import { DevelopmentRelayServer } from "../src/index.js";

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.once("open", () => resolve(socket));
    socket.once("error", reject);
  });
}

function inbox(socket) {
  const queued = [];
  const waiting = [];
  socket.on("message", (data) => {
    const message = JSON.parse(data.toString());
    const waiterIndex = waiting.findIndex((waiter) => waiter.predicate(message));
    if (waiterIndex >= 0) {
      const [waiter] = waiting.splice(waiterIndex, 1);
      waiter.resolve(message);
    } else {
      queued.push(message);
    }
  });
  return {
    next(predicate, timeoutMs = 2000) {
      const index = queued.findIndex(predicate);
      if (index >= 0) return Promise.resolve(queued.splice(index, 1)[0]);
      return new Promise((resolve, reject) => {
        const waiter = { predicate, resolve };
        waiting.push(waiter);
        setTimeout(() => {
          const pendingIndex = waiting.indexOf(waiter);
          if (pendingIndex >= 0) waiting.splice(pendingIndex, 1);
          reject(new Error("timed out waiting for relay frame"));
        }, timeoutMs).unref();
      });
    },
  };
}

function send(socket, value) {
  socket.send(JSON.stringify(value));
}

test("two clients can create, join, synchronize, and reconnect without media identity", async (context) => {
  let relayTimeMs = 10_000;
  const server = new DevelopmentRelayServer({ port: 0, now: () => relayTimeMs });
  const address = await server.start();
  context.after(() => server.stop());
  const url = `ws://127.0.0.1:${address.port}`;

  const host = await connect(url);
  context.after(() => host.terminate());
  const hostInbox = inbox(host);
  send(host, { type: "room.create", requestId: "create-1", displayName: "Host" });
  const hostReady = await hostInbox.next((message) => message.type === "session.ready");
  assert.match(hostReady.roomCode, /^[23456789A-HJ-NP-Z]{8}$/u);

  const guest = await connect(url);
  const guestInbox = inbox(guest);
  send(guest, {
    type: "room.join",
    requestId: "join-1",
    roomCode: hostReady.roomCode,
    displayName: "Guest",
  });
  const guestReady = await guestInbox.next((message) => message.type === "session.ready");
  const joined = await hostInbox.next(
    (message) =>
      message.type === "protocol.message" &&
      message.message.type === "state.snapshot" &&
      message.message.payload.state.participants.length === 2,
  );
  assert.equal(joined.message.payload.state.participants[1].displayName, "Guest");

  relayTimeMs = 12_000;
  send(guest, {
    type: "room.command",
    requestId: "resume-1",
    command: {
      protocolVersion: "1.0",
      messageId: "message_guest_resume_0001",
      roomId: guestReady.roomId,
      roundId: guestReady.roundId,
      participantId: guestReady.participantId,
      sessionId: guestReady.sessionId,
      sequence: 1,
      sentAtMs: 11_950,
      type: "playback.resume",
      payload: {},
    },
  });
  const resumed = await hostInbox.next(
    (message) =>
      message.type === "protocol.message" &&
      message.message.type === "state.snapshot" &&
      message.message.payload.state.round.playback.mode === "playing",
  );
  assert.equal(resumed.message.payload.state.round.playback.anchorPositionMs, 0);

  relayTimeMs = 14_000;
  send(host, {
    type: "room.command",
    requestId: "seek-1",
    command: {
      protocolVersion: "1.0",
      messageId: "message_host_seek_0001",
      roomId: hostReady.roomId,
      roundId: hostReady.roundId,
      participantId: hostReady.participantId,
      sessionId: hostReady.sessionId,
      sequence: 1,
      sentAtMs: 13_950,
      type: "playback.seek",
      payload: { positionMs: 90_000 },
    },
  });
  const sought = await guestInbox.next(
    (message) =>
      message.type === "protocol.message" &&
      message.message.type === "state.snapshot" &&
      message.message.payload.state.round.playback.anchorPositionMs === 90_000,
  );
  assert.equal(sought.message.payload.state.round.playback.mode, "playing");

  relayTimeMs = 15_000;
  send(guest, {
    type: "room.command",
    requestId: "pause-1",
    command: {
      protocolVersion: "1.0",
      messageId: "message_guest_pause_0001",
      roomId: guestReady.roomId,
      roundId: guestReady.roundId,
      participantId: guestReady.participantId,
      sessionId: guestReady.sessionId,
      sequence: 2,
      sentAtMs: 14_950,
      type: "playback.pause",
      payload: {},
    },
  });
  const paused = await hostInbox.next(
    (message) =>
      message.type === "protocol.message" &&
      message.message.type === "state.snapshot" &&
      message.message.payload.state.round.playback.mode === "paused" &&
      message.message.payload.state.round.playback.anchorPositionMs >= 90_000,
  );
  assert.equal(paused.message.payload.state.round.playback.anchorPositionMs, 91_000);

  const serializedFrames = JSON.stringify([hostReady, guestReady, joined, resumed, sought, paused]);
  assert.doesNotMatch(serializedFrames, /contentId|streamUrl|sourceUrl|movie|episode/iu);

  guest.terminate();
  await hostInbox.next(
    (message) =>
      message.type === "protocol.message" &&
      message.message.type === "state.snapshot" &&
      message.message.payload.state.participants.some(
        (participant) =>
          participant.participantId === guestReady.participantId &&
          participant.connection === "disconnected",
      ),
  );

  const reconnectedGuest = await connect(url);
  context.after(() => reconnectedGuest.terminate());
  const reconnectInbox = inbox(reconnectedGuest);
  send(reconnectedGuest, {
    type: "session.reconnect",
    requestId: "reconnect-1",
    roomId: guestReady.roomId,
    participantId: guestReady.participantId,
    reconnectToken: guestReady.reconnectToken,
  });
  const reconnected = await reconnectInbox.next((message) => message.type === "session.ready");
  assert.notEqual(reconnected.sessionId, guestReady.sessionId);
  assert.equal(reconnected.participantId, guestReady.participantId);
});

test("clock pings return relay time only to active sessions", async (context) => {
  const server = new DevelopmentRelayServer({ port: 0, now: () => 42_000 });
  const address = await server.start();
  context.after(() => server.stop());
  const socket = await connect(`ws://127.0.0.1:${address.port}`);
  context.after(() => socket.terminate());
  const messages = inbox(socket);

  send(socket, { type: "clock.ping", requestId: "ping-0", clientSentAtMs: 5 });
  const rejected = await messages.next((message) => message.type === "relay.error");
  assert.equal(rejected.code, "REQUEST_REJECTED");

  send(socket, { type: "room.create", requestId: "create-2", displayName: "Host" });
  await messages.next((message) => message.type === "session.ready");
  send(socket, { type: "clock.ping", requestId: "ping-1", clientSentAtMs: 123 });
  const pong = await messages.next((message) => message.type === "clock.pong");
  assert.deepEqual(pong, {
    type: "clock.pong",
    requestId: "ping-1",
    clientSentAtMs: 123,
    relayTimeMs: 42_000,
  });
});

test("a development client can force a transport loss and reconnect", async (context) => {
  const server = new DevelopmentRelayServer({ port: 0, now: () => 55_000 });
  const address = await server.start();
  context.after(() => server.stop());
  const url = `ws://127.0.0.1:${address.port}`;

  const firstSocket = await connect(url);
  const firstInbox = inbox(firstSocket);
  send(firstSocket, { type: "room.create", requestId: "create-drop", displayName: "Host" });
  const firstReady = await firstInbox.next((message) => message.type === "session.ready");
  const closed = new Promise((resolve) => firstSocket.once("close", resolve));

  send(firstSocket, { type: "session.drop", requestId: "drop-1" });
  await closed;

  const reconnectedSocket = await connect(url);
  context.after(() => reconnectedSocket.terminate());
  const reconnectedInbox = inbox(reconnectedSocket);
  send(reconnectedSocket, {
    type: "session.reconnect",
    requestId: "reconnect-drop",
    roomId: firstReady.roomId,
    participantId: firstReady.participantId,
    reconnectToken: firstReady.reconnectToken,
  });
  const reconnected = await reconnectedInbox.next(
    (message) => message.type === "session.ready",
  );

  assert.equal(reconnected.participantId, firstReady.participantId);
  assert.notEqual(reconnected.sessionId, firstReady.sessionId);
});
