# Protocol v1

Protocol v1 coordinates anonymous playback rounds without transporting media
or identifying what participants watch.

## Transport boundary

Messages are JSON documents carried by an authenticated, ordered transport.
The protocol does not depend on Supabase, WebSocket libraries, Redis, WebRTC,
or a particular client. Transport adapters are responsible for authentication,
delivery, and reconnecting; the relay remains authoritative for accepted order.

## Identifiers and ordering

A client selects the highest exact protocol version that it and the service
manifest both list. Version `1.0` does not negotiate individual message fields.
Once a session selects a version, every command and server message in that
session uses it. A relay rejects another version instead of guessing or silently
downgrading it.

Room, round, participant, session, and message identifiers are opaque. A client
session sends a strictly increasing positive `sequence`. The relay rejects a
sequence that is not greater than the last accepted sequence for that active
session. Reconnecting creates a new session and restarts its sequence at one;
commands from the replaced session are rejected.

`messageId` provides room-lifetime idempotency. Replaying the same message and
payload returns the cached accepted or rejected outcome without changing state.
Reusing a message identifier for a different command is rejected, including
after the room starts another round.

Client `sentAtMs` is diagnostic only. It never determines authoritative order or
playback position.

Every protocol integer is at most `9007199254740991`, the largest integer that
JSON implementations based on IEEE-754 numbers can exchange without losing
precision.

## Canonical playback clock

Playback state is a relay timestamped anchor:

```text
paused:  position(t) = anchorPositionMs
playing: position(t) = anchorPositionMs + (t - anchorRelayTimeMs) × rate
```

Version 1 fixes the intentional room rate to `1`. The relay evaluates the
current position at command-acceptance time, atomically replaces the anchor,
and increments the room revision for every state mutation.

Pause anchors the position predicted at relay acceptance. Resume preserves the
paused position and replaces only relay time and mode. Seek replaces canonical
position and relay time while preserving the current mode.

## Rounds and readiness

Every command names a `roundId`. Commands for an older or unknown round are
rejected. A room never reuses a round identifier. Room snapshots expose only
transient, content-blind readiness:
source-ready, viewer-ready, rounded duration, and explicit duration-mismatch
acknowledgement. They never expose content identity.

Each admitted participant has a room-scoped participant ID and display name.
The name has at most 40 characters and helps people recognize each other during
admission and playback. It is not an account name, and a relay must not treat
either field as a stable identity across rooms.

## State snapshots

The canonical state includes room lifetime and capacity, host identity,
invitation generation and admission state, admitted participant connection and
readiness state, round generation and phase, and the playback anchor. Active
session identifiers, invitation secrets, credentials, network addresses, and
content data are not part of a public snapshot.
