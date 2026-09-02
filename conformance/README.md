# Conformance fixtures

The version 1 fixtures define deterministic inputs, state assertions, clock
advances, and error outcomes for every implementation. They cover:

- collaborative pause and resume;
- absolute seek and exact-message replay;
- reconnects, replaced sessions, and stale sequences;
- room-lifetime message identity across playback rounds; and
- readiness reset and stale-round rejection.

`npm test -w @watch-together/conformance` validates each JSON fixture and runs
it through the in-memory relay. An independent consumer reads only versioned
state snapshots, calculates canonical playback position, and confirms that it
sees the same state as the relay.

Another language can consume the JSON files directly. It does not need Node.js
or any Supabase type. Fixtures must not depend on wall-clock execution, network
timing, or a media player.
