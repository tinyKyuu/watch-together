# Implementation plan

This plan begins from the approved Watch Together decision checkpoint dated
2026-09-02. Implement and review one phase at a time.

## Phase 0 — Repository foundation

Status: complete — reviewed and approved 2026-09-02

- Establish Apache-2.0 licensing and project attribution.
- Document public, client-specific, and private-operations boundaries.
- Add protocol, conformance, SDK, and reference-relay directories.
- Select the smallest toolchain needed to validate schemas and fixtures.
- Add CI only after the validation command works locally.

Implementation evidence:

- `npm run check` validates the required repository boundary files and every
  checked-in JSON document without external dependencies.
- `.github/workflows/validate.yml` runs the same command for pushes to `main`
  and pull requests using Node.js 22.
- Local `npm run check` passed with Node.js 26.3.0 and npm 11.16.0.
- GitHub Actions run
  [33637707115](https://github.com/tinyKyuu/watch-together/actions/runs/33637707115)
  passed for commit `9ae9baf9247eb863fe3c075fd434ef22c429b912`.
- The requester reviewed and approved the Phase 0 repository foundation on
  2026-09-02.

Exit evidence: a clean public repository whose documented boundaries match the
approved decision ledger, with a local validation command and passing CI.

## Phase 1 — Deterministic protocol core

Status: complete — reviewed and approved 2026-09-03

- Define the service-manifest v1 schema and trust-sensitive fields.
- Define protocol envelopes, identifiers, ordering, and version negotiation.
- Model room, participant, playback-round, readiness, and invitation state.
- Implement the relay-owned canonical playback clock.
- Add deterministic fixtures for pause, resume, seek, reconnect, and stale-event
  rejection.
- Implement an in-memory reference relay without Supabase dependencies.

Implementation evidence:

- JSON Schema 2020-12 contracts define the service manifest, client commands,
  server messages, canonical room state, and conformance fixture format.
- The dependency-free protocol core implements immutable room transitions and a
  relay-owned millisecond playback anchor.
- Four deterministic fixtures cover pause and resume, seek and idempotency,
  reconnect and stale-event rejection, readiness, and multiple rounds.
- The in-memory relay and an independent snapshot consumer produce the same
  expected state for every fixture.
- Room snapshots remain content-blind. They expose room-scoped participant IDs
  and display names, connection state, readiness, duration, and playback state,
  but no content or stream identity.
- `npm run check` passes 18 reported tests with Node.js 26.3.0 and npm 11.16.0.
  The protocol-core package also passes `npm pack --dry-run`.
- `npm audit` reports zero known vulnerabilities for the pinned dependency set.
- GitHub Actions run
  [33642608811](https://github.com/tinyKyuu/watch-together/actions/runs/33642608811)
  passed for commit `1b0b028a740dee81480a883295c97e67fef06922`.
- GitHub Actions run
  [33642723531](https://github.com/tinyKyuu/watch-together/actions/runs/33642723531)
  passed for review head `d7a02f33ef3c451be091b1644dc6902dcaa0bb9a`.
- The requester reviewed and approved Phase 1 on 2026-09-03.

Exit evidence: identical expected state transitions across the reference relay
and at least one independent protocol consumer.

## Phase 2 — Shared Kotlin client core

Status: pending

- Add transport-neutral protocol types to the NuvioMobile fork.
- Consume the public conformance fixtures.
- Implement relay-clock estimation, source-offset translation, ordering,
  deduplication, and compatibility fallback.
- Keep player APIs behind a capability-based adapter.

Exit evidence: Kotlin conformance tests pass without launching a media player.

## Phase 3 — iOS-to-iOS vertical slice

Status: pending

- Connect two iOS clients through the deterministic development relay.
- Create and join one anonymous room.
- Synchronize pause, resume, absolute seek, and reconnect.
- Use independent local media sources and a relay-owned canonical clock.
- Measure player timestamp precision and correction behavior.

Exit evidence: a repeatable two-device demonstration with recorded drift and
recovery measurements.

## Phase 4 — Hosted invitation-only pilot

Status: pending

- Introduce the private Supabase deployment behind the provider-neutral
  transport boundary.
- Add approved-host email OTP and device linking.
- Add accountless guest admission, host approval, reconnect credentials,
  capacity enforcement, invitation rotation, and abuse controls.
- Add readiness gates, countdowns, duration warnings, local offsets, multiple
  rounds, and privacy-preserving operational telemetry.

Exit evidence: personal and friends-and-family testing completes within the
approved zero-cost and privacy boundaries.

## Phase 5 — Interoperability demonstration

Status: pending

- Implement and validate the Android adapter.
- Implement representative macOS and Windows desktop adapters.
- Complete the approved Mobile-plus-Desktop interoperability matrix.
- Publish only personally verified client artifacts and known limitations.
- Prepare the runnable Nuvio maintainer proposal.

Exit evidence: public protocol conformance plus the approved representative
cross-platform demonstration.

## Explicitly deferred

- public signup, anonymous room hosting, freemium pricing, and payments;
- self-hosting packages and long-term relay infrastructure;
- permanent store distribution and formal availability commitments; and
- Stremio outreach until the Nuvio proof is runnable.
