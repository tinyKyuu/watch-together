# Phase 4 continuation checkpoint

Date: 2026-09-04

Phase 4 has a complete client-side hosted-pilot path and one pending database
migration. Do not mark the phase complete until the real hosted tests and the
friends-and-family run pass.

## Completed

- Operations PR 1 merged. The migrations through
  `20260904093000_fix_realtime_and_join_rate_limits.sql` are deployed. All 33
  database assertions, three live private-Realtime access cases, lint, and
  cleanup passed.
- Manifest v1 now declares provider-neutral transports. The pilot's
  `supabase_direct_v1` profile contains only an HTTPS project origin and public
  publishable key. The schema rejects credentials, URL tokens, and server keys.
- Direct typed email OTP is the pilot host mode. Guests use anonymous Supabase
  Auth, but do not create a Watch Together account.
- The Nuvio client has a dedicated Supabase transport, strict RPC response
  validation, private room subscriptions, ordered command delivery, relay
  clock estimation, reconnect handling, and hybrid drift correction.
- The hosted room UI covers installation by manifest URL, host OTP, room
  creation, accountless guest admission, approval and rejection, capacity,
  invitation rotation, readiness, duration warnings, five-second countdowns,
  local source offsets, multiple rounds, and connection metrics.
- The room session lives outside the player. A Settings entry lets people
  create or join before selecting a source. Attaching a player publishes fresh
  readiness while leaving the room intact.
- The client stores the installed service, service Auth session, and active
  room reconnect credentials on-device. iOS uses Keychain. Android encrypts
  values with an Android Keystore key. Guest invitation secrets are discarded
  after admission.
- A closed or expired room stops the client session, pauses local playback, and
  deletes its reconnect credential. Rotated host invitations replace the
  securely stored reconnect secret.
- The focused Watch Together suite passes on the iOS Simulator and Android host
  targets. The latest recorded run contains 42 tests per target.

## Pending database review

The operations branch `codex/phase-4-host-rejection` contains only the forward
migration `20260904130000_join_status_api.sql` plus its test and documentation
updates. The new `wt_join_status` function lets a pending guest observe host
approval or rejection without calling `wt_request_join` again. It binds the
room and participant IDs to the caller's Auth principal.

The join-status migration is deployed, but its first runtime validation stopped
at the RPC permission assertion. Supabase retained a direct `anon` execute
grant after the migration revoked `PUBLIC`. The test transaction removed all
fixtures, and Realtime and lint checks did not run after the database gate
failed.

The operations branch now needs a new reviewed forward migration that revokes
the role-specific grant without rewriting the deployed migration. Apply only
that correction, then rerun all 45 transactional assertions, the live private
Realtime test for admitted, pending, and unrelated principals, lint, and
cleanup.

## Next client validation

After the database gate passes:

1. Review the real pilot manifest URL and publishable key before exposing them
   in a public artifact.
2. Install the manifest through the Nuvio Settings entry on two simulators.
3. Verify host OTP, room creation before source selection, guest approval and
   rejection, reconnect after app restart, readiness, countdown, pause, resume,
   seek, duration mismatch acknowledgement, local offset, and a second round.
4. Record the results. Then invite the small friends-and-family group.

Invitation links and QR codes remain deferred until Nuvio has a reviewed deep
link route. The pilot can share the readable room code and invitation secret in
one copied block.

## Known unrelated issue

`compileCommonMainKotlinMetadata` fails in `PlayerSubtitleCueParser.kt` on
`RegexOption.DOT_MATCHES_ALL`. The focused iOS Simulator and Android host Watch
Together tests are unaffected. Keep that fix outside Phase 4 unless it receives
separate scope.
