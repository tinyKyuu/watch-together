# Watch Together pilot privacy notice

Effective date: 2026-09-05

The Watch Together pilot synchronizes playback controls between invited
participants. It does not carry media and does not ask clients to send titles,
movie or episode identifiers, filenames, stream URLs, add-on or debrid provider
identities, subtitle choices, or viewing history.

## Data the pilot processes

The pilot processes only the data needed to authenticate hosts, admit guests,
keep a room synchronized, and investigate service failures:

- An approved host's email address and Supabase Auth identifier.
- Anonymous Auth, participant, and room-session identifiers for guests.
- The display name each participant chooses for a room.
- Room operations such as capacity, admission state, readiness, rounded media
  duration, playback timestamps, connection state, and invalid invitation
  attempts.
- Network address, user-agent or client-platform information, and request,
  authentication, database, or Realtime errors that Supabase may record while
  operating the service.

The Nuvio pilot client does not send custom analytics to the Watch Together
service. A participant's local source offset stays on that device.

## Why the data is used

The operator uses this data to provide the requested room, enforce invitations
and capacity, synchronize playback, reconnect participants, limit abuse, and
diagnose failures. The operator does not sell the data or use it for advertising
or content profiling.

## Service provider and access

Supabase hosts the pilot's authentication, database, API, and private Realtime
service. Supabase processes service metadata as the infrastructure provider.
Room state is protected by database permissions and private Realtime policies.
Pending and unrelated users cannot subscribe to a room's state.

The pilot operator can access operational records when needed for support,
security, abuse response, or cleanup. Participants should not use a real name as
their room display name if they do not want it stored with the room record.

## Retention

An active room lasts no more than six hours. Expiry stops access but does not by
itself delete every database or Auth record. During the small pilot, the
operator performs deliberate cleanup and will define automated retention before
a broader public test. Approved-host records remain until the approval is
disabled or removed. Supabase may retain infrastructure logs under the plan and
settings used by the project.

## Questions and deletion requests

Pilot participants should use the private contact channel through which they
received access. Do not put an email address, invitation secret, room code,
room traffic, or other personal data in a public GitHub issue.

This notice will be updated before the pilot expands if the service adds new
data, a public signup flow, analytics, payments, or a fixed retention schedule.
