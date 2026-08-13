# Solomon Darker Website

## Validation

The repository pins its .NET, Node.js, npm, and frontend lint tool versions.
Run the complete backend build, integration contracts, lint checks, frontend
tests, and production build from the repository root:

```bash
./scripts/validate.sh
```

For lint alone, use the same entrypoint:

```bash
./scripts/validate.sh lint
```

Those are the only supported validation entrypoints for agents and CI.

## Boneyard viewer

`/boneyards` is a dedicated fullscreen, browser-local viewer for retail
`.boneyard` files. It decodes the native SyncBuffer and renders the actual
spawn, terrain polygons, road quads, fence segments, world-object positions,
and static sprite placements. Files opened from disk never leave the browser.

The parser, scene model, canvas renderer, and UI are separate so the workspace
can grow into a web editor without replacing the native document model. Run
its real-fixture contract with:

```bash
cd frontend
npm run test:boneyard
```

`/boneyard` is the authoring surface. Its large-map renderer keeps the same
art lift without applying a Canvas filter to every placed piece on every
frame: each decoded sprite is brightened once on a sprite-sized cache canvas.
Painter order is cached per immutable editor document, off-screen pieces are
culled, and ordinary pieces avoid unnecessary Canvas state stacks. Pans,
selection drags, brush strokes, and moving cursor chrome reuse an off-screen
scene layer; after the pointer settles, the editor restores the exact direct
render. Those are performance invariants; putting per-piece `filter` calls or
full-world hover paints back in the stage turns a dense retail-generated map
into multi-second frames.

The browser benchmark measures file load, hover, pan, and zoom against either
the bundled sample or a supplied dense `.boneyard`. Build and serve the site in
one terminal, then run the benchmark in another:

```bash
cd frontend
npm run build
npm run preview -- --host 127.0.0.1 --port 4175

BONEYARD_BENCH_URL=http://127.0.0.1:4175 \
BONEYARD_BENCH_FIXTURE="/path/to/large-map.boneyard" \
BONEYARD_BENCH_ROUTE=editor \
BONEYARD_BENCH_ASSERT=1 \
npm run benchmark:boneyard
```

`CHROME_PATH` can select a Chrome executable; otherwise the benchmark uses
the installed stable Chrome channel. The assertion budget intentionally
allows machine variance while still rejecting the former multi-second
interaction frames. Its hover traversal also rejects more than two complete
world paints: one interaction-layer paint and one settled direct frame.

## Rebuilt game development

The `/game` route is an ordinary client of the authoritative game host. Start
both from `frontend/`:

```bash
npm run dev:game -- --host 127.0.0.1 --port 4178
```

The launcher starts a separate Node server on an OS-assigned loopback port,
waits for its readiness message, gives Vite the URL and development credential,
and shuts both processes down together. This is the real socket and protocol
boundary the packaged desktop client will supervise; the browser never runs an
in-tab server. Direct `npm run dev` intentionally leaves `/game` without a
session unless a trusted launcher supplies `VITE_GAME_SERVER_URL` and
`VITE_GAME_BOOTSTRAP_CREDENTIAL`.

For a LAN-visible development page, bind Vite to `0.0.0.0` and provide the
exact origin the browser will use, for example:

```bash
SDR_GAME_DEV_ORIGIN=http://192.168.1.50:4178 npm run dev:game -- --host 0.0.0.0 --port 4178
```

The authoritative host remains loopback-only; a browser on another machine is
not a desktop-local client and therefore needs a separately configured secure
remote development gateway.

The shared client accepts keyboard (`WASD` or arrows), a standard controller
(left stick or D-pad, south button to confirm, east button to go back), and a
Pointer Events joystick on coarse-pointer mobile browsers. The game preserves
its `1600x900` native stage within wider `16:10` displays such as Steam Deck,
and asks portrait mobile devices to rotate before play.

Run only the headless host with `SDR_GAME_BOOTSTRAP_CREDENTIAL` set to a strong
secret and then `npm run game:host`. Its first stdout line is a machine-readable
readiness record for a desktop or cloud supervisor. See
`docs/game-runtime-architecture.md` for the supported solo, peer-hosted,
browser-provisioned, and dedicated topology.

Production browser sessions use the bundled `GameHost/game-session-supervisor.mjs`.
The website's `POST /api/game/sessions` adapter authenticates to that
loopback-only supervisor and returns a one-session `wss` endpoint; the static
client contains neither the supervisor secret nor a shared gameplay credential.
The checked-in NFO unit, Caddy route, required environment, expiry policy, and
release health gates are documented in `ops/nfo/README.md`.

### Standalone desktop build

The desktop rebuild packages the same production browser client; it does not
contain a second renderer or gameplay implementation. Electron serves that
bundle on an OS-assigned loopback origin, starts the bundled Node `22.17.0`
runtime as a separate authoritative process, and injects its credentialed
`ws://127.0.0.1/...` endpoint through an isolated preload.

From `frontend/`:

```bash
npm run package:desktop:linux
npm run smoke:desktop
```

Packaging verifies the official Node archive SHA-256, builds both the cloud
session supervisor and standalone Hub host, and writes the Linux application
under `dist-desktop/`. The smoke runs the real packaged Electron app under
Xvfb, enters the Hub, verifies WebGL and authoritative movement, proves the
host executable is the bundled Node runtime in a separate process, exits, and
checks that the child process was reaped. `npm run dev:desktop` exercises the
same boundary with the development machine's already pinned Node runtime.

The website is not contacted during desktop solo. Encrypted direct peer
hosting/joining and save persistence are subsequent product slices; the one
client, protocol, and server bundle are already the shared foundation for
those modes.

## Mod packages

Community mod ZIPs require `manifest.json` at the archive root. Website
packages may contain data overlays/Boneyards, root `images/` art overlays,
sandboxed Lua, or any combination of those three. See the [authoring
guide](frontend/public/mod-package-format.md),
[JSON Schema](frontend/public/mod-manifest.schema.json), and the
[copyable examples](frontend/public/examples/).

Website Join Game links give the launcher the lobby directory origin. The
launcher fetches the host's exact active mod identities, reuses exact manual or
cached copies, downloads missing website versions, verifies both package and
content hashes, and stages only the host set. Direct Steam invites and direct
lobby-ID joins use the configured website the same way when its lobby metadata
is available. If it is unavailable, the launcher falls back to the locally
enabled set and the native exact-compatibility handshake, so manual P2P play
does not depend on this service.

Run the backend integration contract with a .NET 10 SDK:

```bash
python3 -m unittest tests.test_mod_sync_contract -v
```

## Crash reports

The launcher submits crash diagnostics only after explicit user consent. It
authenticates with a short-lived Steam directory session and posts a bounded
ZIP plus metadata to `POST /api/crash-reports`. The backend validates that the
embedded report matches the submitted metadata, stores the archive under the
private storage root at `crash-reports/<year>/<month>/`, and records the Steam
or linked website identity, submission/crash times, versions, enabled mods,
exit code, artifact counts, archive size, and SHA-256 in `CrashReports`.

Crash archives are not exposed by the static-file middleware. They may contain
minidumps and logs and must be handled as private diagnostics.

## Steam ticket authentication

The backend requires a standard Steam Web API user key to verify the tickets created by the mod loader. Register a key at [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey) using a real domain you control.

Configure the key only on the backend:

```env
Steam__WebApiKey=YOUR_STEAM_WEB_API_KEY
```

ASP.NET maps `Steam__WebApiKey` to `Steam:WebApiKey`. Never commit the key or expose it to the frontend or mod loader.

The backend validates launcher tickets through `ISteamUserAuth/AuthenticateUserTicket` for Steam AppID `3362180` with the ticket identity `solomon-dark-directory-v1`. If the key is missing, `POST /api/auth/steam/session` returns `503 Service Unavailable` and authenticated lobby discovery is unavailable.

The domain entered during key registration is the key's administrative association, not a request-origin restriction. Changing the website domain does not require an application change; the key may be regenerated later to keep that registration current.

## Launcher cloud saves

The launcher keeps eight save slots under its own local application-data root;
it never runs from or writes into the retail game's save directory. After a
local slot changes, the launcher obtains a short-lived Steam Web API session
and uploads a validated ZIP snapshot to `/api/saves/{slot}`.

Cloud backup turns on automatically when the active Steam ID is linked to an
Solomon Darker account on the Account page. The launcher does not receive the website
password or store a website bearer token. Cloud-save access from both the
launcher and the Account page remains disabled until that Steam link exists.

Cloud is a backup, not the live save location. Launches continue from local
disk when the website is unavailable, and cloud snapshots are restored only
after an explicit user action.
