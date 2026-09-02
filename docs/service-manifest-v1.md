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

## Trust-sensitive changes

An installed service requires renewed user confirmation before accepting:

- a changed canonical origin or operator identity;
- a changed endpoint origin;
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
