<p align="center">
  <img src="custom_components/intelbras_dvr/brand/logo.png" width="240" alt="">
</p>

<h1 align="center">Intelbras DVR</h1>

<p align="center">
  Your Intelbras and Dahua DVR in Home Assistant: live channels, recordings in<br>
  the Media panel, and an address that fixes itself when DHCP moves it.
</p>

<p align="center">
  <a href="https://github.com/constantini-ha/intelbras_dvr/releases"><img src="https://img.shields.io/github/v/release/constantini-ha/intelbras_dvr?style=flat-square&color=41BDF5" alt="release"></a>
  <img src="https://img.shields.io/badge/Home_Assistant-2024.1+-41BDF5?style=flat-square" alt="Home Assistant">
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT">
</p>

<p align="center">
  <b>English</b> · <a href="README.pt-BR.md">Português</a> · <a href="README.es.md">Español</a>
</p>

> **Unofficial.** Intelbras® and Dahua® are registered trademarks of their owners.
> This is a community integration with no affiliation with, endorsement by, or
> support from Intelbras S.A. or Dahua Technology.

---

## What you get

```
  DVR ──┬── live      one camera entity per channel
        │             HTTP snapshot (digest) + RTSP stream
        │
        ├── recordings  Media → Intelbras DVR → channel → day → segment
        │               RTSP playback, turned into HLS by Home Assistant
        │
        └── itself      tracked by MAC, so a new IP is followed on its own
```

## The Cameras page and the card

The integration adds a **Cameras** entry to the sidebar: every channel live in a
grid, tap one to enlarge it, full screen, and the recordings a tap away. Admins
also get the credentials form and an **Add to dashboard** button there.

The same view is a dashboard card. Pick **Intelbras DVR cameras** in the card
picker, or write it by hand:

```yaml
type: custom:intelbras-dvr-card
columns: 2            # optional
title: Cameras        # optional
entities:             # optional, default is every DVR channel
  - camera.dvr_canal_1
```

No other card library is needed. The page and the card speak English,
Portuguese and Spanish, following Home Assistant.

## Installation

1. **HACS** (or Marketplace from 2026.11) → ⋮ → **Custom repositories**
2. URL `https://github.com/constantini-ha/intelbras_dvr`, category *Integration*
3. Install, restart, then **Settings → Devices & services → Add integration → Intelbras DVR**

Manually: copy `custom_components/intelbras_dvr/` into your `config/custom_components/`.

## Adding the DVR

| Field | Default | What it is |
| --- | --- | --- |
| `host` | — | the DVR's IP, for example `172.16.0.12` |
| `username` | `admin` | DVR user |
| `password` | — | DVR password |
| `channels` | `4` | how many camera entities to create |
| `rtsp_port` | `554` | RTSP port |
| `track_by_mac` | `true` | follow the DVR when its IP changes |
| `scan_interval` | `300` | how often to check, in seconds |

Submitting calls `snapshot.cgi?channel=1` with digest auth; on HTTP 200 the
channels are created.

## When the IP changes

Nothing to do. Every tick the integration reads the local ARP table, learns the
DVR's MAC the first time, and from then on looks the device up by that MAC —
which survives a lease change, unlike the address. When it moves, the entry is
updated, the integration reloads, and every `generic` camera entry pointing at
the old address is repointed at the new one.

This needs Home Assistant on the same L2 as the DVR, with `network_mode: host`
or on bare metal. A bridged container cannot see the host's ARP table.

## Changing credentials

```yaml
action: intelbras_dvr.apply_credentials
data:
  entry_id: <config_entry_id>   # optional when there is only one DVR
  host: 172.16.0.12
  username: admin
  password: new-password
```

Validates against the DVR, updates the entry and reloads in place — no restart.
The `last_apply_result` sensor reports what happened: `OK:`, `FAIL:` or `AUTO:`.

## What to expect

- **Lockout.** These DVRs block the client IP for around 30 minutes after 3 to 5
  failed logins. The integration notices HTTP 401 and pauses stream retries for
  5 minutes rather than making the ban worse.
- **Playback sessions.** Entry-level units allow one or two at a time. If a video
  will not start, close the others.
- **HEVC.** H.265 recordings play on Safari, Chrome and Edge. Firefox's support
  is weak — same as for live view.
- **Browse window.** The last 7 days, usually in 30-minute blocks.

For a dashboard, [advanced-camera-card](https://github.com/dermotduffy/advanced-camera-card)
accepts `folders:` pointing at `media-source://intelbras_dvr`.

## License

[MIT](LICENSE).
