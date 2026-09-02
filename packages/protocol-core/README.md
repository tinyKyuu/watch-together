# Protocol core

`@watch-together/protocol-core` is the dependency-free JavaScript reference for
the canonical playback clock and immutable room-state transitions.

The JSON Schemas in `spec/` remain the wire contract. A transport validates an
incoming document before passing its values to this package. Media clients can
implement the same behavior in another language by consuming the conformance
fixtures instead of embedding JavaScript.
