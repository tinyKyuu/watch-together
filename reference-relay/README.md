# Reference relay

The first relay is deterministic and in-memory. It accepts versioned client
command envelopes, owns per-session ordering and message deduplication, and
produces canonical room snapshots. It exists for protocol tests, local client
development, and reproducible demonstrations. It is not the production
Supabase deployment and does not imply a supported self-hosting product.

The calling transport validates command JSON against the published schema and
authenticates the participant before calling the relay. The relay implements
semantic ordering and state transitions; it is not an HTTP or WebSocket server.
