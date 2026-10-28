# Solomon Darker Website

The Website owns accounts, cloud saves, mod distribution, leaderboards and
Boneyard authoring. The latest retained PixiJS game runs at `/game`; the
qualified Rust release runs alongside it at `/game-rust/`. Each has its own
authority and continuing saves, while accounts and content are shared. See the [artifact and validation
boundary](docs/RUST-GAME-CUTOVER.md).

## Validation and development

Use the pinned .NET and Node/npm versions and Python 3.12+ with `venv`. Supply a
completed matching Rust artifact before the full gate:

```sh
export SDR_GAME_DIST=/absolute/rust-artifact/client
export SDR_GAME_NATIVE_HOST=/absolute/rust-artifact/bin/solomon-darker
./scripts/validate.sh
```

Alternatively configure an exact `SDR_GAME_ARTIFACT_URL` and
`SDR_GAME_ARTIFACT_SHA256`. The validator restores pinned dependencies, builds
and formats the backend, runs all Python contracts, frontend lint/type checks,
editor/library/Boneyard and artifact tests, restored PixiJS gameplay suites
and renderer quality gates, then builds both browser apps. Lint alone is `./scripts/validate.sh lint`.

`npm --prefix frontend run dev` serves Website development pages. The game
artifact and Website API remain separate deployment inputs. The restored
PixiJS host is built with `npm --prefix frontend run build:game-host`; Vite alone
does not start an authority. For a production build use the same artifact inputs
with `npm --prefix frontend run build`. The build remounts the qualified
`/game` Rust artifact to `/game-rust`, preserving binary and asset bytes.

## Boneyard authoring

`/boneyards` is the fullscreen local viewer for native `.boneyard` files.
`/boneyard` is the authoring workshop. The retained parser, scene model, canvas
renderer, editor state and tests are Website-owned. Local files stay in the
browser unless the user publishes or saves them to the cloud.

Explore the Dark Cloud's Boneyards shelf is the same-origin `/boneyard-library`
Website document. It retains local/cloud draft New, Import, Edit, Test and
Delete operations. A one-use tab-local request opens the workshop without
copying game authority into the editor. Test keeps the draft mounted while a
client for that Website mount owns a disposable game session and its teardown:
PixiJS at root and the Rust iframe under `/game-rust`.

Run the retained frontend contracts with `npm --prefix frontend test`.

## Runtime and deployment

The Rust repository owns native/browser builds, simulation and GPU Source
fixtures, ordinary gameplay browser checks, desktop packaging and the learned
bot runtime. Its source/acceptance guide is `docs/PORT-COMPLETION.md` in that
repository. The Website records original and remounted artifact manifests; Rust game and
Website/PixiJS build revisions remain distinct. Desktop downloads and updates must point to the
configured Rust release repository, never a Website-built game.

Each C# API process authenticates to its own supervisor through the
same protected administration boundary. The browser receives a single-use
admission ticket, never the supervisor or leaderboard-signing secret. See
[NFO operation](ops/nfo/README.md) and [the deployment worker](ops/local-ci/README.md).

## Mod packages

Community mod ZIPs require `manifest.json` at the archive root. Packages may
contain typed Boneyards, sandboxed Lua, or both. Native DLL, arbitrary data-tree
and `images/` replacement mods are not supported package content. See the
[authoring guide](frontend/public/mod-package-format.md),
[JSON Schema](frontend/public/mod-manifest.schema.json) and
[examples](frontend/public/examples/).

Subscribe in the Library and enable mods from Explore the Dark Cloud. The
Website resolves exact versions and dependencies; the selected authority validates
and compiles their real definitions, assets and scoped state before admission.
Saves retain the accepted manifest and bounded mod state.

Public mods appear in discovery. Unlisted mods work through their direct link.
Private mods are visible and playable only by their author. Run the backend
contract with a .NET 10 SDK:

```sh
python3 -m unittest tests.test_mod_sync_contract -v
```
