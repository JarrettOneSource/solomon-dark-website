# Standalone desktop distribution

## Acceptance and ownership

The desktop is the existing shared WebGL client plus the same authoritative
Node game host. No gameplay fork and no dependency on the owner's computer.
Work starts from `eca28fe4` in the isolated `feat/standalone-desktop-offline`
worktree; the active report-50 checkout is not modified.

Acceptance checks for this slice:

1. Launch the packaged app, enter the College, and move under a separate local
   authoritative process without contacting the website. Relaunch preserves
   the same storage origin; quitting reaps the child process.
2. A host can share an invite and another desktop can connect over encrypted
   WebRTC. The website service exchanges bounded connection introductions only;
   gameplay is not forwarded through the website's US-East game host. An
   optional operator-configured TURN service supports restrictive NATs.
3. Website and `/game` show **Download Offline** and link to actual published
   platform assets, or explicitly report that no desktop release exists yet.
4. Every packaged launch checks the release feed. Available updates require
   consent to download and a separate consent to restart/install. An offline
   launch remains playable; declining does not silently install at exit.
5. CI builds Windows x64, macOS Apple Silicon, and Linux x64 from one versioned
   source, uploads artifacts, and publishes tagged releases only after signing
   prerequisites and validation. Public release signing needs owner credentials.

Windows x64 is the provisional first-player target; macOS ARM64 exercises the
M2 build and Linux x64 retains the existing smoke target. Intel Mac support is
not claimed by this first release matrix.

## Connectivity contract

Solo is entirely local. Friend hosting is opt-in and retains one authoritative
host. Invitations authorize joining, not account access or global leaderboard
submission. Both peers must run the same revision and protocol. The invite
service is not a public match directory. Closing the host disconnects its
guests; automatic host migration is not implemented.

WebRTC uses ordered reliable data channels and bounded framing over the
unchanged game protocol. Host-side sockets remain authenticated loopback
connections. Credentials cross the encrypted peer channel, never the invite
service, URL query, process arguments, or release artifacts.

Direct connectivity is not guaranteed for every pair of home networks. TURN
fallback must be configured and deployed before advertising universal
no-port-forwarding support. Relaying through a distant region can still add
latency; a SEA host helps nearby friends, not a US-to-SEA physical path.

## Release operations

`frontend/desktop/package.json` is the single desktop version owner. Ordinary
push/PR builds upload unsigned test installers to GitHub Actions; they do not
publish a release or appear in the updater. To publish, bump that version and
its lockfile, merge the validated change, and create the matching `vX.Y.Z` tag.
The Desktop workflow builds each platform natively, runs packaged acceptance,
and requires the complete Website gate. It then assembles a draft with all
installers, update metadata and SHA-256 files, and only then makes it public.
An already-public version is immutable; use a new version rather than replacing
its installer underneath existing update metadata.

Configure these repository Actions secrets before a public release:

- `WINDOWS_CSC_LINK`, `WINDOWS_CSC_KEY_PASSWORD`: Windows signing certificate
  and password in electron-builder's supported form.
- `MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD`: Apple Developer ID Application
  certificate and password.
- `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`: notarization.

No signing material belongs in source, build logs, or installer archives.
The workflow uses its scoped `GITHUB_TOKEN` only in the final publishing job.
macOS requires both the DMG for installation and ZIP for auto-update metadata;
Windows uses NSIS and Linux uses AppImage. Until these operational gates pass,
the download page correctly says the first release is not published.

## Invitation service deployment

`npm run build:game-host` emits `dist-game-host/peer-signaling.mjs` alongside the
existing shared host. The website release must include that bundle. Install
`ops/nfo/solomon-dark-peer.service`, enable it, and apply the checked-in Caddy
`/desktop-signal` route only after the service's `http://127.0.0.1:5223/health`
returns `{"status":"ok"}`. These are separate operations from creating an
installer; this source change does not imply the live NFO service is installed.

Solo never needs this service. Desktop friend invitations use
`wss://solomondarker.com/desktop-signal` by default. A self-hosted deployment can
run `npm run desktop:signaling` behind its own TLS reverse proxy and launch
desktops with `SDR_DESKTOP_SIGNALING_URL` set to that WSS endpoint. The Node
service itself binds loopback, accepts only the desktop origin, and exposes no
public match directory, gameplay stream, save API, or account API.

Optional `/etc/solomon-dark-peer.env` settings:

```text
SDR_PEER_PORT=5223
SDR_PEER_TRUSTED_PROXY=1
SDR_PEER_ICE_SERVERS_JSON=[{"urls":["stun:stun.cloudflare.com:3478"]}]
```

For coturn-compatible TURN fallback, configure `SDR_PEER_TURN_URLS` with
comma-separated `turn:`/`turns:` URLs and `SDR_PEER_TURN_SECRET` with the relay's
shared authentication secret. The broker produces expiring per-admission
credentials and never sends that long-lived secret to a desktop. Use regional
relay capacity appropriate to the players; a US-East relay is not evidence of
good SEA latency. No paid relay or TURN service has been provisioned by this work.

## Local acceptance receipt — 2026-09-28

On the M2, the actual packaged Electron 43.4.0 application with verified bundled
Node 22.17.0 passed local play, authoritative movement, stable-origin IndexedDB
and localStorage relaunch, and child-process teardown. The two-app test passed
private invitation, exact shared two-player College identity, guest movement
observed by the host, continued movement after shutting down the invitation
service, and guest disconnection when the host app closed. Both app renderers
reported zero page errors. The tests use native Mac graphics; Linux CI uses
SwiftShader and frame-driven assertions rather than a fixed input sleep.

Evidence is emitted to `frontend/reports/desktop/` and CI artifact uploads.
This is local two-app evidence, not residential NAT/SEA qualification. Public
installer signing, an actual old-to-new installed update, all-platform CI, and
live website/invitation deployment must be reported separately from these checks.
