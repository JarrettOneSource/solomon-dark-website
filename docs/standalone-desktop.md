# Solomon Darker standalone app

The desktop shell packages the Website's client, authoritative host and assets.
The shell owns launch mode, encrypted peer connectivity, update discovery and
process lifetime. Gameplay and save documents remain owned by the shared game.

## Delivery checks

- Publish Windows x64, macOS arm64/x64 and Linux x64 from the same source commit
  as the main application, after the canonical Website gate.
- Start solo without external networking; create a wizard, play, save, close,
  relaunch and resume the same local save.
- Host and join with two packaged clients using an encrypted direct connection;
  move both wizards and enter a shared Boneyard without the Website.
- Reject wrong invite keys and incompatible builds. Close all owned listeners
  and child processes when the app exits.
- Prompt for newer published desktop builds, tolerate an offline update check,
  and retain local saves when replacing the application.
- Run the relevant contracts and packaged acceptance on Windows, review the
  release workflow, then remove task checkouts on every device after publication.

## Implementation boundaries

`frontend/desktop` owns the launcher, isolated preload, local static origin,
Node host supervision, TLS peer tunnel and release checks. The game continues
to see its existing authenticated loopback WebSocket endpoint. The standalone
origin is stable across launches so IndexedDB and settings survive restarts.

`frontend/tools/package-desktop.mjs` owns platform packaging and source identity.
The Validate workflow owns desktop build jobs and GitHub release publication.
The main application's existing M5 deployment remains the Website publisher.

Packaged acceptance uses software rendering. On Windows, the harness confines
the renderer processes to two logical CPUs so the four-core CI runner can keep
the authoritative host and test driver responsive.

Peer play uses direct addresses on a LAN, VPN, or a forwarded internet TCP
port. Invites carry a random capability; share them only with intended players.
NAT traversal services, relays and host migration are outside this release.
Both players must use the same desktop build. The hosting player must keep the
app open while others play. Solo gameplay does not require an account or server.
