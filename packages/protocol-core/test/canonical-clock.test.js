// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import test from "node:test";
import {
  ProtocolError,
  canonicalPositionAt,
  createPlaybackAnchor,
  pausePlayback,
  resumePlayback,
  seekPlayback,
} from "../src/index.js";

test("the canonical clock advances only while playing", () => {
  const initial = createPlaybackAnchor(1000);
  assert.equal(canonicalPositionAt(initial, 5000), 0);

  const resumed = resumePlayback(initial, 5000);
  assert.equal(resumed.applied, true);
  assert.equal(canonicalPositionAt(resumed.playback, 5250), 250);

  const paused = pausePlayback(resumed.playback, 6000);
  assert.equal(paused.playback.anchorPositionMs, 1000);
  assert.equal(canonicalPositionAt(paused.playback, 9000), 1000);
});

test("seek preserves mode and replaces the relay-owned anchor", () => {
  const playing = resumePlayback(createPlaybackAnchor(1000), 1000).playback;
  const sought = seekPlayback(playing, 42000, 2000);
  assert.equal(sought.playback.mode, "playing");
  assert.equal(canonicalPositionAt(sought.playback, 2250), 42250);
});

test("clock transitions reject a relay time before the current anchor", () => {
  const playback = createPlaybackAnchor(5000);
  for (const transition of [
    () => canonicalPositionAt(playback, 4999),
    () => pausePlayback(playback, 4999),
    () => resumePlayback(playback, 4999),
    () => seekPlayback(playback, 1000, 4999),
  ]) {
    assert.throws(
      transition,
      (error) => error instanceof ProtocolError && error.code === "INVALID_COMMAND",
    );
  }
});

test("the canonical position stays within the JSON safe-integer range", () => {
  assert.throws(
    () =>
      canonicalPositionAt(
        {
          mode: "playing",
          anchorPositionMs: Number.MAX_SAFE_INTEGER,
          anchorRelayTimeMs: 0,
          rate: 1,
        },
        1,
      ),
    /safe integer range/,
  );
});
