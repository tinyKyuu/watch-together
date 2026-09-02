# Implementation plan

This plan begins from the approved Watch Together decision checkpoint dated
2026-09-02. Implement and review one phase at a time.

## Phase 0 — Repository foundation

Status: implemented — awaiting review

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

Exit evidence: a clean public repository whose documented boundaries match the
approved decision ledger, with a local validation command and passing CI.

## Phase 1 — Deterministic protocol core

Status: pending

- Define the service-manifest v1 schema and trust-sensitive fields.
- Define protocol envelopes, identifiers, ordering, and version negotiation.
- Model room, participant, playback-round, readiness, and invitation state.
- Implement the relay-owned canonical playback clock.
- Add deterministic fixtures for pause, resume, seek, reconnect, and stale-event
  rejection.
- Implement an in-memory reference relay without Supabase dependencies.

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
