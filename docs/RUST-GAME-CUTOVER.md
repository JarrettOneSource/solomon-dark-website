# Parallel browser games and the Rust artifact boundary

Website supplies the latest retained PixiJS game at `/game` and mounts the
qualified Rust release at `/game-rust/`. PixiJS source and its Node authority
are restored from Website `093aee9938e0cae2fabfafc5403b01aed961397e`, whose gameplay
is identical to `fa08ae249ff5563570bdb2a653e2ef9358ce7b83`. Shared Website account,
content, authoring and operational fixes remain current.

Each runtime has its own authority, admission API and continuation saves.
Accounts, JWT configuration, published content, uploads and leaderboards remain
in the canonical Website storage. The C# source is shared by both API processes;
root authoring Test uses PixiJS, and mounted authoring Test uses the Rust iframe.
Desktop packaging and updates remain owned by the separate Rust repository.

## Build and artifact identity

Supply one completed Rust `/game` artifact using `SDR_GAME_DIST` and
`SDR_GAME_NATIVE_HOST`, or a pinned `SDR_GAME_ARTIFACT_URL` with its exact
`SDR_GAME_ARTIFACT_SHA256`. Website validation never builds Rust or downloads a
floating latest release. Local paths must identify the same artifact directory:

```text
game-artifact.json
bin/solomon-darker
client/index.html
client/deployment.json
client/<mounted modules, WASM and assets>
client/save-tools/solomon_save_tools.js
client/save-tools/solomon_save_tools_bg.wasm
client/editor-test/index.html
```

The original schema-1 manifest records the complete member SHA-256 map, full
Rust revision and native target. `frontend/tools/game-artifact.mjs` validates
all members, membership, document metadata and actual module/WASM references.
`build-parallel-apps.mjs` builds the root PixiJS site, its bundled host, and the
mounted Rust companion site from the same Website source.

The companion transformation changes mount references in HTML and bootstrap
modules and adds the one-time guest-save migration module. It preserves the
released WASM, native executable, save-tools JS and all asset bytes. A fresh
`game-artifact.json` describes the actual mounted bytes. Its `remountedFrom`
records the original manifest digest and mounts; `game-source-artifact.json`
retains the exact original manifest. These are derivative deployment files,
not a new Rust release. Package admission verifies both manifests and rejects
changes to the original binary/asset members.

The build produces:

| Installed path | Owner |
| --- | --- |
| `wwwroot/` | Root Website and PixiJS `/game` route |
| `GameHost/Pixi/` | Bundled PixiJS supervisor, Lua WASM and learned checkpoint |
| `wwwroot/game-rust/` | Remounted Rust client |
| `GameHost/solomon-darker` | Original released Linux Rust executable |
| `RustSite/` | Website bundle with `/game-rust` API, account and content URLs |
| `GameHost/release.env` | Rust revision, asset/checkpoint paths and port 5232 |
| `GameHost/rust-api.env` | Rust save namespace and supervisor URL |

## Save ownership and migration

Both public APIs expose slot zero. `GameSaves:Namespace=primary` maps it to
internal database slot zero; `rust` maps it to slot one. GET, PUT, revision
conflicts and DELETE use the same configured mapping. Browser requests cannot
choose an internal namespace.

After the old authorities finish their checkpoint/acknowledgement barrier,
the deployment backs up SQLite, checks integrity, and forks existing slot-zero
documents and revisions into absent Rust destinations. A durable migration
marker makes this a one-time operation. Existing Rust progress is preserved,
and later deletions are not recreated. Runtime rollback preserves database
contents, including the independently seeded namespace; it never overwrites
newer saved data from a whole-database backup.

Guest IndexedDB has the same split: `solomon-dark-game-saves` remains root,
and `solomon-dark-game-saves:/game-rust` belongs to Rust. Before either new game
can write, the bootstrap copies the old slot into an absent Rust destination.
The destination copy and migration marker commit atomically. Simultaneous tabs,
retries and intentional deletion cannot cause later root progress to be copied
again. Host-specific rejoin credentials are not copied.

A shared envelope is not a guarantee that every historical simulation payload
is accepted by both implementations. Keep originals and verify actual restores;
track format defects in their owning runtime. Save isolation prevents the two
live games from replacing each other's continuing progress.

## Deployment and publication

The existing M5 worker owns validation, packaging and deployment; its extracted
`deploy-runtime.sh` owns the NFO transaction. A changed Website revision drains
both production authorities before stopping either API. The first split drains
the old Rust authority at root, announcing the new root Website revision so its
saved clients can reload at `/game`. Later PixiJS drains use that Website
revision; the Rust companion uses the selected Rust revision and protocol-2
publication ID/sequence. A Rust artifact-only update at unchanged Website source
leaves the unchanged root processes running and drains/restarts the companion.

Root `wwwroot/deployment.json` identifies Website/PixiJS. Companion
`RustSite/deployment.json` identifies Website/Rust. Their respective no-store
`/api/game/deployment` routes return the matching publication. The Rust client's
own `/game-rust/deployment.json` remains an immutable artifact member. Root
legacy revision polls now stay at root; the obsolete TypeScript-to-Rust rewrite
is removed.

Each transaction stages both publications as pending with one fresh ID and
monotonic sequence. Authorities must pass health checks, then the primary API
completes schema initialization before the companion API starts. Pending API
publications reject new admission while allowing final saves and publication
reads. PixiJS reload polling also ignores pending publications. Only after all
health, database and configuration checks pass are both publications made ready.
A failed transaction restores prior runtime, units, Caddy and publication files,
then restarts the prior admission owners. Database saves remain in place.

Caddy-only drift reconciles without interrupting games. Ordinary worker
reconciliation checks both publications, the original artifact identity, all
three managed game/companion service units and canonical Caddy. `/game-stg`
retains its separate services, storage and artifact ownership.

## Validation

Run `./scripts/validate.sh` with the exact released Rust input. It checks the
backend, API/save/deployment contracts, frontend lint/types and tests, restored
PixiJS gameplay suites, both production bundles, media policy and the existing
renderer quality gates. The retired Website desktop shell is not restored.
Rust runtime and desktop qualification remain attached to the selected release.

Final acceptance uses real M2 browsers at both public routes, including actual
save restoration, independent save writes, world NPC interaction, combat,
party admission and authoring Test. Build tests alone do not establish those
outcomes. See [NFO operation](../ops/nfo/README.md) and
[M5 deployment](../ops/local-ci/README.md).
