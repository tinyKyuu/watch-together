# Phase 3 two-iPhone demonstration

This checklist validates the first native, content-blind Watch Together path.
It uses the in-memory development relay and two iOS builds. It is not a public
pilot or an internet-facing deployment.

## Requirements

- A Mac and two iPhones on the same trusted Wi-Fi network.
- The Phase 3 Nuvio branch installed on both phones.
- Node.js 22 or newer.
- A playable local source selected independently on each phone. The sources may
  use different providers or quality levels, but should represent the same cut
  and have approximately the same duration.

## Start the relay

From the `watch-together` repository:

```sh
npm install
npm run dev:relay
```

Keep the process running. It prints one or more `iPhone relay URL` values. Use
the URL whose IP address belongs to the Wi-Fi network shared by the phones.
Do not expose the plain `ws://` development server to the public internet.

## Create and join

1. Open a source in the Nuvio player on each phone.
2. Open player controls and tap the **Watch Together** people icon.
3. Enter the same relay URL and a room-scoped display name on each phone.
4. On phone A, tap **Create room** and note the eight-character code.
5. On phone B, enter that code and tap **Join room**.

The development room starts paused at `00:00`. This intentionally provides a
deterministic baseline before the later readiness gate and countdown exist.
The panel should list both room-scoped names as connected. It must not display
or send a title, episode identifier, provider, debrid service, or source URL.

## Exercise collaborative controls

Perform each action from both phones:

1. Resume, wait at least ten seconds, then pause.
2. Seek forward with the timeline.
3. Seek backward with double tap or the ten-second button.
4. Trigger skip-intro if the selected source exposes one.

The relay is the single canonical clock. Both phones independently compare
their millisecond player position with that clock. A client within 250 ms does
nothing. Persistent drift from 251–1500 ms uses a temporary 0.97× or 1.03×
rate. Drift above 1500 ms uses an absolute seek. Only an off-target client
corrects; clients do not chase one another.

## Exercise reconnect

1. While playing, disable Wi-Fi on phone B for at least three seconds.
2. Confirm phone A shows phone B as disconnected and continues playing.
3. Re-enable Wi-Fi.
4. Confirm phone B changes from **Reconnecting** to **Connected**, keeps the
   same participant identity, and returns to the canonical position.
5. Repeat while paused and after an absolute seek.

An ordinary disconnect does not pause the room. This prevents a sleeping app,
brief radio change, or poor connection from repeatedly interrupting everyone.

## Record the result

Repeat the full flow three times and record:

| Run | Sources same/different | Relay RTT | Drift after 10 s | Largest drift | Correction used | Reconnect recovery | Notes |
| --- | --- | ---: | ---: | ---: | --- | ---: | --- |
| 1 |  |  |  |  |  |  |  |
| 2 |  |  |  |  |  |  |  |
| 3 |  |  |  |  |  |  |  |

Phase 3 is ready for approval when pause, resume, absolute seek, and reconnect
are repeatable in all three runs; the diagnostics contain enough evidence to
explain any correction; and inspecting relay frames finds no media identity or
source data.
