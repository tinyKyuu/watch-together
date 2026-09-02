# Watch Together

Watch Together is a privacy-focused, provider-neutral protocol for synchronizing
playback across compatible media clients. Every participant resolves and plays
their own local media source. The protocol coordinates room state, readiness,
pause, resume, seeking, and clock correction without transporting media or
content identity.

## Status

Pre-alpha. Protocol v1 schemas, the deterministic state machine, conformance
fixtures, the in-memory reference relay, and a local WebSocket development
transport are implemented for review. No production relay or media-client
adapter exists in this repository yet.

## Run the checks

Use Node.js 22 or newer:

```sh
npm ci
npm run check
```

The command validates the service manifest and protocol schemas, executes every
conformance fixture, tests the canonical clock and room transitions, and tests
the reference relay. It does not contact Supabase or play media.

## Protocol v1 files

- `spec/manifest/v1/manifest.schema.json` defines the installable service
  manifest.
- `spec/protocol/v1/` contains the client command, server message, and canonical
  room-state schemas.
- `spec/conformance/v1/fixture.schema.json` defines the fixture format.
- `conformance/fixtures/v1/` contains deterministic shared examples.
- `packages/protocol-core/` implements the dependency-free canonical clock and
  pure state transitions.
- `reference-relay/` implements the in-memory relay used by tests and client
  development.
- `docs/phase-3-two-iphone-demo.md` is the repeatable device checklist for the
  first native two-client demonstration.

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
