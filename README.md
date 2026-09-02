# Watch Together

Watch Together is a privacy-focused, provider-neutral protocol for synchronizing
playback across compatible media clients. Every participant resolves and plays
their own local media source. The protocol coordinates room state, readiness,
pause, resume, seeking, and clock correction without transporting media or
content identity.

## Status

Pre-alpha. The initial implementation target is an iOS-to-iOS vertical slice in
the enhanced NuvioMobile fork, followed by Android and representative desktop
adapters.

## Repository boundary

This public repository will contain:

- the declarative Watch Together service-manifest specification;
- transport-neutral protocol schemas and versioning rules;
- the canonical room and playback state machine;
- synchronization algorithms and deterministic conformance fixtures;
- reusable SDK code where it does not depend on a media client;
- a deterministic in-memory reference relay for development and tests; and
- public privacy, security, and integration documentation.

This repository will not contain:

- media streams, media-proxy code, stream URLs, or content identifiers;
- Nuvio-specific player or user-interface code;
- production Supabase policies, migrations, administration, or credentials;
- tester-account data or operational dashboards; or
- a promise of compatibility with an unmodified Nuvio or Stremio client.

The Nuvio client adapter remains in the separate NuvioMobile fork. Private
hosted-pilot operations will be maintained separately from this public core.

## Privacy invariants

The protocol and hosted relay must not require titles, movie or episode IDs,
filenames, stream URLs, add-on identities, debrid providers, subtitle choices,
or viewing history. Compatibility is based on anonymous playback rounds,
transient duration information, readiness, timestamps, and client-local source
offsets.

## License

The public protocol, schemas, SDKs, conformance fixtures, and reference
implementation are licensed under the Apache License 2.0. Client code copied
into or derived within GPLv3 applications remains subject to the license of the
combined application.
