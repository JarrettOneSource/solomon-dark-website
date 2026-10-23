# Solomon Darker Website

The Website owns accounts, cloud saves, mod distribution, leaderboards and
Boneyard authoring. The separately built Rust game supplies `/game`, its native
authority, save tools and desktop runtime. See the [artifact and validation
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
editor/library/Boneyard and artifact tests, then produces the Website with the
verified Rust client. Lint alone is `./scripts/validate.sh lint`.

`npm --prefix frontend run dev` serves Website development pages. The game
artifact and Website API remain separate deployment inputs; no TypeScript
server is started by Vite. For a production build use the same artifact inputs
with `npm --prefix frontend run build`. Set `VITE_GAME_ARTIFACT_BASE` when the
artifact uses a mount other than `/game`.

## Boneyard authoring

`/boneyards` is the fullscreen local viewer for native `.boneyard` files.
`/boneyard` is the authoring workshop. The retained parser, scene model, canvas
renderer, editor state and tests are Website-owned. Local files stay in the
browser unless the user publishes or saves them to the cloud.

Explore the Dark Cloud's Boneyards shelf is the same-origin `/boneyard-library`
Website document. It retains local/cloud draft New, Import, Edit, Test and
Delete operations. A one-use tab-local request opens the workshop without
copying game authority into the editor. Test keeps the draft mounted while a
Rust editor-test iframe owns a disposable game session and its teardown.

Run the retained frontend contracts with `npm --prefix frontend test`.

## Runtime and deployment

The Rust repository owns native/browser builds, simulation and GPU Source
fixtures, ordinary gameplay browser checks, desktop packaging and the learned
bot runtime. Its source/acceptance guide is `docs/PORT-COMPLETION.md` in that
repository. The Website consumes exact artifact bytes; game and Website build
revisions remain distinct. Desktop downloads and updates must point to the
configured Rust release repository, never a Website-built game.

The existing C# provisioner authenticates to the native supervisor through the
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
Website resolves exact versions and dependencies; the Rust authority validates
and compiles their real definitions, assets and scoped state before admission.
Saves retain the accepted manifest and bounded mod state.

Public mods appear in discovery. Unlisted mods work through their direct link.
Private mods are visible and playable only by their author. Run the backend
contract with a .NET 10 SDK:

```sh
python3 -m unittest tests.test_mod_sync_contract -v
```
