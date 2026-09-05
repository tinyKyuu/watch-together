# Protocol core

`@watch-together/protocol-core` is the dependency-free JavaScript reference for
the canonical playback clock and immutable room-state transitions.

It also evaluates the content-blind readiness gate and provides deterministic
begin, cancel, and complete transitions for relay-timestamped countdowns. The
hosted adapter decides when to invoke those transitions; clients never author
canonical snapshots.

The JSON Schemas in `spec/` remain the wire contract. A transport validates an
incoming document before passing its values to this package. Media clients can
implement the same behavior in another language by consuming the conformance
fixtures instead of embedding JavaScript.
