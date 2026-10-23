# Rust game artifact boundary

The Website owns accounts, authentication, cloud storage, content distribution,
leaderboards, the Boneyard library and editor. The separate Rust game owns the
canonical simulation, authoritative hosted supervisor, multiplayer protocol,
browser renderer, save tools, learned-bot inference and desktop game child.
The existing Electron/PSK/update shell is maintained with that Rust repository.
No Website TypeScript game or Node gameplay fallback is built or started.

## Required build input

Build one complete artifact from a clean Rust commit with
`scripts/package-hosted-game.py`. Its layout is:

```text
game-artifact.json
bin/solomon-darker                 # .exe for a Windows target
client/index.html
client/deployment.json
client/<complete mounted client and assets>
client/save-tools/solomon_save_tools.js
client/save-tools/solomon_save_tools_bg.wasm
client/editor-test/index.html
```

`game-artifact.json` has `schemaVersion: 1`, a full lowercase Git `revision`,
a Rust `target`, and `files`, a map of every payload path to its SHA-256.
The manifest excludes itself. Native and client files must come from this
same directory. The client deployment document and HTML build metadata must
identify that revision. The verifier checks every hash, complete client
membership, actual module/WASM references and the independent save/editor
entries before replacing Website output.

Local Website builds use explicit absolute paths:

```sh
export SDR_GAME_DIST=/absolute/rust-artifact/client
export SDR_GAME_NATIVE_HOST=/absolute/rust-artifact/bin/solomon-darker
./scripts/validate.sh
```

CI or the deployment worker can instead set `SDR_GAME_ARTIFACT_URL` and its
exact `SDR_GAME_ARTIFACT_SHA256`. The downloader checks the complete archive
before safe extraction. There is no floating latest URL, automatic source
checkout or game build in Website validation. Explicit local paths take
precedence; setting only one local path is an error. Configure the two GitHub
repository variables for the Website Validate workflow. Missing inputs fail
before a production build.

The artifact's URL mount must match `VITE_GAME_ARTIFACT_BASE` (default `/game`).
A staging artifact can use `/game-stg`; set that value explicitly, together
with the Website mount configuration. Mount changes require a new artifact.
The game and Website revisions are separate: `client/deployment.json` identifies
the Rust game; Website `/deployment.json` identifies the Website build.

A deployment publication identifies one actual cutover, independently of both
revisions. The worker mints a fresh 32-character hexadecimal `deploymentId` outside
the cached artifact and supplies it through the authenticated
`X-Solomon-Deployment-Id` drain header. A monotonic `deploymentSequence` travels
through `X-Solomon-Deployment-Sequence`, the announcement, receipt and publication. The JSON request body remains
`{"targetRevision":"<Rust revision>"}` for the first legacy-to-Rust cutover.
Publication-aware supervisors report `deploymentProtocol: 2` in health and echo
the ID in the restart announcement and final drain receipt. Recovery claims and
acknowledgements retain the signed target Rust revision and checkpoint sequence.

The worker stages Website `wwwroot/deployment.json` as
`{"revision":"<Website revision>","gameRevision":"<Rust revision>","deploymentId":"<ID>","deploymentSequence":<next>,"ready":false}`.
It starts and verifies the replacement game before exposing Website, then verifies
Website, service health and release integrity before atomically publishing
`ready: true`. Anonymous, no-store `GET /api/game/deployment` exposes this document
under the configured Website mount, including `/game-stg/api/game/deployment`.
The immutable game's own deployment document and all hashed artifact members are
unchanged. A saved active client reloads only after durable save, actual old
transport retirement and a healthy publication with the announced sequence or a
later sequence and the same signed target game revision. A later publication can
fulfill an update that a sleeping tab missed; a retry may use another transaction
UUID without stranding the saved client. Failed candidates restore the prior
publication. The worker's stdlib publication owner writes atomically and fsyncs
both file and directory; matching artifact hashes cannot skip pending metadata. Idle/title clients
observe healthy publication changes; this also covers unchanged-game deployments.
An unchanged-game drain against a legacy authority is rejected before retirement
because its immutable clients do not understand publication identities.

The last production TypeScript game, `093aee9938e0cae2fabfafc5403b01aed961397e`,
polls `/deployment.json?current=<that revision>` after its final save and only
reloads when the response matches the announced restart target. The Website
rewrites that exact legacy query to `/game/deployment.json`; ordinary root
requests still identify the Website build. Keep this bridge for waiting legacy
tabs during the first Rust cutover. The drain must announce the Rust revision,
which is also bound into signed party-recovery saves and checked by the new host.
The bridge ships with the new Website, after the old host's final-save drain;
do not replace or publish the old Website's root manifest before those saves.

The frontend build copies the verified `client` into `backend/wwwroot/game`.
The native deployment consumer additionally installs the supplied executable
at `GameHost/solomon-darker`, retains the original manifest and writes an
immutable `GameHost/release.env` with the Rust revision and asset directory.
Linux deployment rejects a non-Linux-x64 native host and verifies all published
client/native bytes again. It uses the Rust revision for the existing final-save
restart handshake and includes artifact identity in cache/skip/failure state.
The existing database backup, release swap and rollback remain Website-owned.
See [NFO operation](../ops/nfo/README.md) and [M5 deployment](../ops/local-ci/README.md).

Only the same-origin `/boneyard-library` authoring shelf and `/game/editor-test/`
document may be embedded. The checked-in Caddy rules include their `/game-stg`
equivalents. Other documents keep `frame-ancestors 'none'` and `DENY`. Another
mount must enumerate those same two document routes in its gateway configuration.
WASM execution uses the narrow `wasm-unsafe-eval` CSP permission.

## Validation ownership

`./scripts/validate.sh` remains the complete Website gate. It restores pinned
.NET/npm/Python dependencies and runs backend build/format, all Python contracts,
frontend lint/type checks, retained editor/Boneyard/library tests, artifact tests,
production build and media policy. Lint-only mode needs no game artifact.
The actual large-save transport test retains the unchanged current-source
23,296,828-byte Faculty fixture compressed with its source revision, length and
SHA-256; it still exercises HTTP/cloud/rejoin payload limits.

The removed game gates moved with their implementation:

| Replaced Website owner | Rust owner and acceptance |
| --- | --- |
| `core-server`, `core-kernels`, session/party/Lua/skill tests | `crates/sim`, `crates/launcher`, `crates/protocol`, `crates/modding`; workspace tests and committed independent Source fixtures |
| Pixi renderer, painter/material/allocation probes and renderer mutation harness | `crates/web`, canonical presentation kernels and Source render/GPU/browser fixtures; strict native/WASM Clippy and actual mounted browser journeys |
| TS save/native import implementation | `crates/assets`, `crates/save-tools`; whole-document current/historical migration, rejection and WASM ABI checks |
| `frontend/desktop`, desktop build/update/peer tools | Rust repository `desktop`, `tools/package-desktop.mjs`, transport/update tests and actual packaged Electron save/peer acceptance |
| `frontend/tools/sdmod` authoring CLI | Rust repository `tools/sdmod`; CLI/package fixtures |
| Website bot worker/checkpoint/inference | `crates/sim/ml_bot`, `crates/assets/ml_bot_checkpoint`, launcher bot owner and `web/assets/native/ml-bot-policy-v7-selected.sdml`; exact inference/controller fixtures and actual bot browser journey |

The Rust release must pass its declared gates before its artifact is admitted:
asset membership verification, `cargo fmt --all -- --check`, complete workspace
tests, strict native and WASM Clippy, Trunk/save-tools builds and the relevant
ordinary browser/desktop journeys. `docs/PORT-COMPLETION.md`, the Rust README
and desktop runtime guide own exact commands and accepted receipts. Website
CI verifies the selected completed artifact; a passing Website job alone does
not certify a new game build or a desktop acceptance run. The retired renderer
coverage/mutation inventory is not represented as a Rust result.

## Separate training migration follow-up

Gameplay acceptance retains the trained policy and actual learned runtime.
Training infrastructure is separate development work; no training run or partial
Rust rollout bridge is part of this cutover.

The reference is Website commit
`fa08ae249ff5563570bdb2a653e2ef9358ce7b83`. Its historical training closure is
`tools/train_bot_policy.py`, `tools/ml_bot/`,
`frontend/tools/ml-bot-rollout-server.mjs`,
`frontend/src/game/core-server/ml-bot-policy/policy-spec-v7.json`, and the
`solomon-dark-ml-rollout-v7-choice2` NDJSON contract. These source paths remain
recoverable from that commit; their dependent Website launchers and npm scripts
were removed together. A future native rollout migration must port environment
reset/step/choice/terminal metrics over the canonical Rust Session, establish
source-equivalent observations/rewards/action masks and asynchronous choice
semantics, then run a separately authorized training/evaluation campaign.
Independent Python asset/backend/CI diagnostic tools remain Website-owned.
