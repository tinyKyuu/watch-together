# Architecture boundary

## Public core

The public core defines behavior rather than infrastructure:

1. a declarative service manifest discovers a compatible relay;
2. versioned messages mutate one authoritative room state;
3. the relay owns the canonical playback clock;
4. clients translate between canonical time and their private local source
   offset; and
5. conformance fixtures make independent implementations observable and
   comparable.

No public-core type may require a media title, content identifier, stream URL,
provider identity, or Supabase-specific object.

## Client adapters

Each media client owns its playback integration. An adapter reports player
snapshots and applies pause, resume, seek, and optional temporary rate
correction. Missing rate control degrades only that client to hard-seek
correction.

The current NuvioMobile fork is the first adapter and remains GPLv3. The public
protocol does not imply support in official Nuvio or Stremio clients.

## Hosted operations

The invitation-only pilot may use Supabase for authentication, persistence, and
Realtime transport, but those details remain behind a provider-neutral
boundary. Production authorization policies, migrations, tester
administration, abuse tooling, and credentials are not part of this public
repository during the pilot.
