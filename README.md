# Solomon Darker Website

## Validation

Run the complete backend build, integration contracts, lint checks, frontend
tests, production build, and renderer quality checks from the repository root:

```bash
./scripts/validate.sh
```

For lint alone, use the same entrypoint:

```bash
./scripts/validate.sh lint
```

Validation requires the pinned .NET and Node/npm versions, Python 3.12 or newer
with `venv`, and installed stable Google Chrome for the renderer's WebGL tests.
The script restores .NET/npm dependencies and installs the pinned Python test
dependencies into the ignored `.venv` directory. It does not depend on globally
installed Pillow. Playwright selects Chrome for the current operating system;
`SDR_CHROME_PATH` overrides its executable when needed. See
[renderer quality checks](docs/renderer-quality.md) for mutation review policy.

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

The development script starts a separate Node server on an OS-assigned loopback
port, waits for its readiness message, gives Vite the URL and development
credential, and shuts both processes down together. This is the real socket
and protocol boundary; the browser never runs an in-tab server. Direct
`npm run dev` intentionally leaves `/game` without a session unless a trusted
platform shell supplies `VITE_GAME_SERVER_URL` and
`VITE_GAME_BOOTSTRAP_CREDENTIAL`.

For a LAN-visible development page, bind Vite to `0.0.0.0` and provide the
exact origin the browser will use, for example:

```bash
SDR_GAME_DEV_ORIGIN=http://192.168.1.50:4178 npm run dev:game -- --host 0.0.0.0 --port 4178
```

The authoritative host remains loopback-only; a browser on another machine is
not a desktop-local client and therefore needs a separately configured secure
remote development gateway.

The shared client accepts keyboard (`WASD` or arrows), a standard controller,
and Pointer Events joysticks on coarse-pointer mobile browsers. Controller
gameplay uses left stick or D-pad to move, right stick to aim, right trigger for
the primary spell, X to cast the selected quickbar slot, bumpers to select all
eight slots, A to interact, Y for Skills, View for Inventory, and Menu/Start to
pause. Menus use D-pad or left stick, A to confirm, B to go back, and bumpers to
move between adjacent controls. The game preserves
its `1600x900` native stage within wider `16:10` displays such as Steam Deck,
and asks portrait mobile devices to rotate before play.

Run only the headless host with `SDR_GAME_BOOTSTRAP_CREDENTIAL` set to a strong
secret and then `npm run game:host`. Its first stdout line is a machine-readable
readiness record for a desktop or cloud supervisor. See
`docs/game-runtime-architecture.md` for the supported solo, peer-hosted,
browser-provisioned, and dedicated topology. This standalone host ends its
current run when the final client leaves, so a desktop restart or browser
refresh begins from a fresh Hub and materializes a new random Boneyard.

The offline bot trainer, authoritative Boneyard rollout bridge,
checkpoint format, evaluation protocol, and diagnostics are documented in
`docs/ml-bot-training.md`.

Production browser sessions use the bundled `GameHost/game-session-supervisor.mjs`.
The website's `POST /api/game/sessions` adapter authenticates to that
loopback-only supervisor and returns a one-session `wss` endpoint; the static
client contains neither the supervisor secret nor a shared gameplay credential.
The same server-only boundary signs completed global Hall rows; the leaderboard
API rejects browser-authored score fields and receipts belonging to another
account.
The checked-in NFO unit, Caddy route, required environment, expiry policy, and
release health gates are documented in `ops/nfo/README.md`.

### Standalone desktop build

The desktop rebuild packages the same production browser client; it does not
contain a second renderer or gameplay implementation. Electron serves that
bundle through the stable `sdr://desktop` origin backed by an OS-assigned
loopback HTTP server, starts the bundled Node runtime as a
separate authoritative process, and injects its credentialed
`ws://127.0.0.1/...` endpoint through an isolated preload.

From `frontend/`:

```bash
npm run package:desktop:linux
xvfb-run -a npm run smoke:desktop
xvfb-run -a npm run smoke:desktop:peers

# On Apple Silicon macOS:
npm run package:desktop:mac
npm run smoke:desktop
npm run smoke:desktop:peers

# On Windows x64:
npm run package:desktop:windows
npm run smoke:desktop
npm run smoke:desktop:peers
```

Packaging verifies the official Node archive SHA-256, builds both the cloud
session supervisor and standalone Hub host, and writes installers and unpacked
applications under `dist-desktop/`. The smoke runs the real packaged Electron app,
enters the Hub, verifies WebGL and authoritative movement, proves the
host executable is the bundled Node runtime in a separate process, exits, and
checks that the child process was reaped and storage survives relaunch.
`npm run dev:desktop` exercises the
same boundary with the development machine's Node runtime.

Solo gameplay is local; packaged launches separately attempt a bounded update
check that never makes offline play mandatory-online. **Play with friends** on
the title screen hosts an invitation or joins a compatible desktop. Ordered,
encrypted WebRTC carries the existing protocol to the player's local authority.
The peer smoke launches two real packaged apps, proves guest movement reaches
the host, stops signaling while gameplay continues, and checks host departure.

Both website and browser `/game` expose **Download Offline**. `/download` lists
only actual published GitHub release assets, with an explicit unpublished state
before the first release. `.github/workflows/desktop.yml` builds Windows x64,
macOS ARM64, and Linux x64 installers. Tagged `v<desktop/package.json version>`
releases require platform signing, notarization where applicable, packaged
acceptance tests, and the complete Website gate before becoming public. See
[desktop release operations](docs/desktop-release.md) for secrets and deployment.

Local identity, saves and settings are separate from the website account. Cloud
subscriptions, publishing and global Hall submission are not proxied by the
offline app. Restrictive home networks may need an operator-provided TURN relay;
automatic host migration and universal NAT-connectivity claims remain out of scope.

## Mod packages

Community mod ZIPs require `manifest.json` at the archive root. Website
packages may contain typed Boneyards, sandboxed Lua, or both. Native DLL,
arbitrary data-tree, and `images/` replacement mods are not web-port content.
See the [authoring
guide](frontend/public/mod-package-format.md),
[JSON Schema](frontend/public/mod-manifest.schema.json), and the
[copyable examples](frontend/public/examples/).

Subscribe in the Library and enable mods from Explore the Dark Cloud. Session
provisioning resolves exact latest versions, validates dependencies and hashes,
starts one isolated Lua VM per active script, and adds active package
Boneyards to that session only. Browser lobby rows advertise the exact host
manifest before joining. Save documents record that manifest and bounded
per-mod state.

Published mods may be `public`, `unlisted`, or `private`. Unlisted mods stay
out of discovery but work for anyone with the direct link. Private mods are
visible and playable only by their author.

Run the backend integration contract with a .NET 10 SDK:

```bash
python3 -m unittest tests.test_mod_sync_contract -v
```
