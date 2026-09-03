// SPDX-License-Identifier: Apache-2.0

import { ProtocolError } from "./errors.js";
import { requireNonNegativeInteger } from "./validation.js";

export function createPlaybackAnchor(relayTimeMs, initialPositionMs = 0) {
  requireNonNegativeInteger(relayTimeMs, "relayTimeMs");
  requireNonNegativeInteger(initialPositionMs, "initialPositionMs");
  return {
    mode: "paused",
    anchorPositionMs: initialPositionMs,
    anchorRelayTimeMs: relayTimeMs,
    rate: 1,
  };
}

export function canonicalPositionAt(playback, relayTimeMs) {
  requireNonNegativeInteger(relayTimeMs, "relayTimeMs");
  if (relayTimeMs < playback.anchorRelayTimeMs) {
    throw new ProtocolError(
      "INVALID_COMMAND",
      "relayTimeMs cannot precede the canonical anchor time",
    );
  }
  if (playback.mode === "paused") return playback.anchorPositionMs;
  const positionMs = Math.max(
    0,
    playback.anchorPositionMs +
      (relayTimeMs - playback.anchorRelayTimeMs) * playback.rate,
  );
  if (!Number.isSafeInteger(positionMs)) {
    throw new ProtocolError(
      "INVALID_COMMAND",
      "canonical playback position exceeds the safe integer range",
    );
  }
  return positionMs;
}

export function pausePlayback(playback, relayTimeMs) {
  canonicalPositionAt(playback, relayTimeMs);
  if (playback.mode === "paused") return { playback, applied: false };
  return {
    playback: {
      mode: "paused",
      anchorPositionMs: canonicalPositionAt(playback, relayTimeMs),
      anchorRelayTimeMs: relayTimeMs,
      rate: 1,
    },
    applied: true,
  };
}

export function resumePlayback(playback, relayTimeMs) {
  requireNonNegativeInteger(relayTimeMs, "relayTimeMs");
  canonicalPositionAt(playback, relayTimeMs);
  if (playback.mode === "playing") return { playback, applied: false };
  return {
    playback: {
      mode: "playing",
      anchorPositionMs: playback.anchorPositionMs,
      anchorRelayTimeMs: relayTimeMs,
      rate: 1,
    },
    applied: true,
  };
}

export function seekPlayback(playback, positionMs, relayTimeMs) {
  requireNonNegativeInteger(positionMs, "positionMs");
  requireNonNegativeInteger(relayTimeMs, "relayTimeMs");
  return {
    playback: {
      mode: playback.mode,
      anchorPositionMs: positionMs,
      anchorRelayTimeMs: relayTimeMs,
      rate: 1,
    },
    applied:
      positionMs !== canonicalPositionAt(playback, relayTimeMs) ||
      playback.anchorRelayTimeMs !== relayTimeMs,
  };
}
