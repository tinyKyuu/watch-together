# Phase 4 hosted-pilot contract

Phase 4 turns the local two-client demonstration into a private,
invitation-only pilot without changing the public protocol's content-blind
boundary. This document records the implementation contract while the phase is
active. `plan.md` remains the approved phase checkpoint and is updated only
after review.

## Deployment boundary

The hosted service uses a dedicated Watch Together Supabase project. It does
not reuse Nuvio accounts, Nuvio infrastructure, or Nuvio supporter status.
Supabase authentication, tables, database functions, Realtime policies,
administrator tools, tester records, and secrets remain in a separate private
operations repository.

The public repository continues to own:

- transport-neutral messages and canonical state;
- deterministic readiness and countdown rules;
- conformance fixtures and reference behavior; and
- the privacy and integration contract presented to compatible clients.

The Nuvio fork owns only its client adapter, UI, secure local credentials, and
player integration.

## Hosted command path

An authenticated HTTPS command reaches a database function. The function
validates the active participant session, locks the room row, checks message
idempotency and sequence ordering, evaluates the command using database time,
commits the new canonical revision, and emits the resulting server message to a
private Realtime topic. Clients never write canonical snapshots directly.

Clients subscribe to private room topics under row-level authorization. A
fresh snapshot is fetched after reconnect, so correctness does not depend on
receiving every transient broadcast. Supabase-specific request and channel
envelopes stay inside the hosted and client transport adapters.

Long-lived custom WebSockets are not hosted in Edge Functions. Their hosted
runtime has finite wall-clock and idle limits; database functions plus Supabase
Realtime provide the atomic command path and persistent connection service
needed by the pilot.

## Identity and admission

- Hosts are manually approved before the pilot sends an email OTP. Account
  creation is disabled for unapproved email addresses.
- A linked device receives a revocable, device-scoped session. It is not a
  Nuvio login.
- Guests remain accountless in the product. The backend may issue a short-lived
  anonymous authorization principal solely to enforce private room access.
- A room invitation contains a short readable room code and a separate,
  unguessable invitation secret. QR codes and links carry both; manually typed
  joins may enter them separately.
- A guest first enters a pending state. The host sees the room-scoped display
  name and approves or rejects the request. Pending guests cannot subscribe to
  canonical room state.
- Admission closes automatically at the host-selected capacity. Rotating the
  invitation invalidates the previous secret without disconnecting admitted
  participants.
- Admitted participants receive revocable reconnect credentials scoped to one
  participant and room lifetime.

## Pilot limits and abuse controls

Rooms have a host-selected capacity from two through eight, one active room per
host, and a six-hour maximum lifetime. Closing a room immediately frees the
host to create another. The pilot does not impose a three-rooms-per-day quota.

Room creation, join attempts, OTP requests, and pending admissions are rate
limited by account, device credential, and coarse network signal. Repeated
invalid invitations receive increasing temporary delays. Logs retain only the
minimum operational categories declared by the service manifest and never
include content titles, IDs, source URLs, provider names, or viewing history.

The initial deployment must remain within the Supabase free-plan boundary. A
paid upgrade is a deliberate operator action, not automatic spend.

## Readiness, countdown, and rounds

Every admitted participant must be connected, have a loaded source, confirm
viewer readiness, and report a duration rounded to the nearest second. A
duration spread of at most three seconds is accepted. A larger spread is shown
as a warning and requires acknowledgement from every participant, unless the
host deliberately force-starts.

Once the gate passes, the relay creates a five-second countdown using relay
timestamps. Playback remains paused during the countdown. Any participant can
cancel it by pausing; the room returns to preparing. When the countdown ends,
the canonical playing anchor uses the scheduled end time, so a late completion
message does not move the shared timeline.

A new playback round resets readiness, duration, mismatch acknowledgement, and
countdown state while keeping the room and admitted participants. Local source
offsets remain only on each device and are never transmitted.

## Review checklist

- [x] Public readiness and countdown schemas, reducers, and conformance tests.
- [x] Nuvio shared models, validation, and readiness evaluation.
- [ ] Private Supabase schema, authorization, command functions, and tests.
- [ ] Approved-host OTP and device linking.
- [ ] Guest invitation, approval, reconnect, capacity, and rotation flows.
- [ ] Nuvio hosted transport adapter and secure credential storage.
- [ ] Readiness, countdown, mismatch, multiple-round, and local-offset UI.
- [ ] Privacy-preserving metrics and documented retention.
- [ ] Friends-and-family test evidence within the zero-cost boundary.
