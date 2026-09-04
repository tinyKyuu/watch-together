# Service manifest v1

The Watch Together service manifest is a declarative installation contract for
compatible clients. It is not executable code, a Stremio content-add-on
manifest, an account credential, or a room invitation.

## Installation

A client fetches the manifest through HTTPS, validates it against
`spec/manifest/v1/manifest.schema.json`, verifies that it supports a compatible
protocol version, and shows the operator, origin, privacy, authentication,
capability, and operational-data declarations before installation.

The manifest URL and every endpoint must be free of account tokens, room codes,
invitation secrets, and device credentials.

## Transport profiles

The manifest declares one or more transport profiles. Protocol messages remain
the same across profiles, and clients use an isolated adapter for each profile
they support. A client must reject a manifest when none of its declared
profiles are supported.

The hosted pilot uses `supabase_direct_v1`. Its `projectUrl` identifies the
HTTPS service origin. Its `publishableKey` is Supabase's public client key,
which is intended to ship in clients and does not grant privileged database
access. The schema accepts only the `sb_publishable_` form and rejects secret
server keys. Authentication, row-level authorization, and private Realtime
policies remain mandatory even though the public key is visible.

`email_otp` means the compatible client collects an approved host email and a
typed one-time code. `email_otp_device_link` is a separate mode that requires
an `accountLinkUrl`. The hosted pilot starts with direct typed OTP and may add
device linking later without pretending that the linking page already exists.

## Trust-sensitive changes

An installed service requires renewed user confirmation before accepting:

- a changed canonical origin or operator identity;
- a changed transport profile, project origin, public client key, or endpoint
  origin;
- a new host or guest authentication requirement;
- an added capability;
- an added operational-data category; or
- a materially changed privacy disclosure.

Compatible same-origin endpoint paths, descriptions, support links, and status
information may update without a new prompt. A client keeps the last valid
compatible manifest during temporary fetch failures and never replaces it with
an invalid or unsupported document.

## Privacy

`contentBlind` is fixed to `true` in version 1. A service declares operational
data categories explicitly. The manifest cannot request titles, content IDs,
filenames, stream URLs, provider identities, subtitle selections, or viewing
history. A service that processes participant display names declares
`room_display_name`, even when those names exist only for one room.
