# 2026-08-16 — Boneyard first-frame lighting and run-reset consistency

## Reported smell and parity question

- Reported web behavior: some runs appear to begin with broken lighting even
  though later frames or other runs look correct.
- Stock behavior to recover: the complete first visible Arena frame, including
  Region target reset/source submission/composite, environment-mode darkness,
  shadow ownership, resize, run replacement, and teardown.
- Reproduction inputs/scenes: repeated generated Boneyard renderer creation,
  environment modes 0/1/2, repeated real local and production run entry,
  renderer destroy/recreate, and hardware-Mac first-frame pixel capture.
- Falsifiers: a failed first frame with zero provider/grid records would make
  replicated source state the owner; differing pixels after renderer reuse
  would make GPU resource teardown the owner; stable complete Region frames
  but a missing darkness canvas before `ready` makes React scene readiness the
  owner.

This reopens the Complete Region lighting entry above. The earlier pass proved
settled-frame formulas and resources but did not make the first environment
overlay part of the scene-ready contract. A correct settled frame does not
prove the first visible member of the same render system.
## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Native instruction ledger | retail SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; `Arena::Create 0x00470A90 -> 0x0057DF20`; reset/restore `0x0057D4E0/0x0057D5E0`; `Arena::Render 0x0046EC80`; multiply `0x0046FAFF`; queue flush `0x0046FDAF`; environment painter `0x00470EE0` | One Arena render call owns a complete Region plus environment composition. Stock exposes no ready interval between the world and mode-1/2 darkness. | high |
| Current web causal trace | `BoneyardScene.tsx` at `6826e62bc981c53b7c1f9800a6de1c97c6da18db` | `createBoneyardWorldRenderer` completes its first WebGL frame, then the scene mounts/resizes the canvas and publishes `rendererState='ready'`; `paintDarkness` is called only later from `startGamePresentationLoop`. The browser can therefore publish a ready mode-1/2 scene before its screen-space darkness owner has produced any frame. | high |
| Asset ownership trace | `loadGameStartupAssets`, `loadGameImage`, `spriteImage`, and `paintDarkness` | Resident startup awaits the two darkness sources through `loadGameImage`, but `paintDarkness` asks the editor's separate `spriteImage` cache for new `Image` objects. Fast browser resource reuse usually hides the duplicate owner; decode/scheduler delay is not covered by the ready barrier. | high |
| Repeated WSL WebGL probe | updated `smoke-boneyard-complex-shadows.mjs`, current-main generated scene | Six destroy/recreate starts retained two providers, two accepted sources, 34 active buckets, a 400-pixel native-quality target, and stable first-frame diagnostics. Three pixel-sampled starts were byte-signature identical (`465449` nonblack pixels, RGB total `38680129`). | high |
| Repeated Mac WebGL probe | Apple M2 Metal/ANGLE, Chrome 151, current-main isolated worktree | Eight destroy/recreate starts retained one identical first-frame pixel hash, `465516` nonblack pixels, RGB total `38690111`, two providers, and two accepted sources. GPU texture/RenderTexture poisoning is falsified for this path. | high |
| Real Mac local and production runs | seven loopback runs and three deployed `https://solomondarker.com` runs, generated environment modes 0/1/2 | The readiness race was real, but the old alpha `0/245` mode-1/2 oracle measured the later-disproven fullscreen inversion. Mode 0 correctly owned no environment-player-light canvas. | high for lifecycle only |

## System boundary and membership inventory

Native system: **first visible Boneyard lighting epoch** — from loaded resident
assets and authoritative initial snapshot through renderer/target construction,
current source collection, Region composite, environment overlay, ready
publication, resize, repeated run creation, and teardown.

| Member | Disposition | Proof / implementation consequence |
| --- | --- | --- |
| Region raster, analytic tint, and source grid on first frame | `verified-already-at-parity` | repeated WSL/Mac first-frame diagnostics and pixel signatures |
| directional shadows and same-depth caster ownership | `verified-already-at-parity` | repeated first-frame caster/record/quad/Z diagnostics |
| environment mode 0 | `verified-already-at-parity` | no late player environment-light owner by native design |
| environment modes 1 and 2 | `exact-ported` after the late-source correction below | bounded direct record-18 passes paint before ready and every later presentation frame |
| local and remote visible players in mode 1/2 | `exact-ported` after the late-source correction below | initial environment-light composition consumes the complete initial player snapshot, then sampled presentation players |
| resident record-18 aperture | `exact-ported` after the late-source correction below | use the already awaited game-resident image owner; optional record-9 target remains out-of-system with its target-grid actors |
| renderer creation and immediate resize | `exact-ported` after this pass | the first complete paint uses the final logical viewport before ready publication |
| Boneyard teardown and later run recreation | `exact-ported` after this pass | no old renderer/target/mask state survives; repeated create/destroy browser proof |
| Game Over return, reconnect, and new run | `exact-ported` after this pass | each Boneyard mount executes the same first-complete-frame barrier |
| Hub lighting | `out-of-system` | Hub has no Boneyard environment-player-light pass; its renderer lifecycle remains independently validated |
| WebGL unavailable | `blocked-by-platform` | the shipped web renderer intentionally fails closed instead of presenting a divergent CPU fallback |

Every persistent provider, MiscLight owner, setting branch, source formula, and
shadow caster remains dispositioned by the complete lighting entry above. No
source-family formula is reopened by this lifecycle defect.

## Native ownership thread and recovered contract

- Owner/construction: Arena owns its light target before rendering; the
  browser Boneyard scene owns both its WebGL renderer and later screen-space
  environment light.
- Producers: the authoritative initial snapshot supplies current players,
  provider registrations, sources, and run identity; resident startup supplies
  the already decoded record-18 asset.
- Transition: one first paint must finish Region and, for modes 1/2, player light
  before scene-ready. Later display frames resample presentation state without
  changing the readiness epoch.
- Consumers: the completed world/environment-light stack is placed below HUD and input
  surfaces. Loading transitions may not reveal a partial stack.
- Reset/teardown: unmount stops the presentation loop, destroys the renderer,
  and retires task-local mask resources. A replacement run repeats asset
  acquisition and the first complete paint.
- Randomness: the existing presentation-only flicker substitution remains;
  readiness must not depend on whether its image decoded between two frames.

## Web implementation consequence

- Replace the editor-owned `spriteImage` lookup with one awaited Boneyard
  environment-light resource built from `loadGameImage`.
- After mounting/resizing the WebGL canvas, synchronously paint the initial
  mode-1/2 record-18 light frame from the authoritative initial snapshot and camera.
- Publish `rendererState='ready'` and call the loading-barrier callback only
  after that complete paint.
- Keep mode 0 unchanged and do not force one authored environment mode merely
  to make screenshots look uniform.

## Validation contract

- Browser RED/GREEN: capture the environment-light canvas immediately when the
  scene first reports ready. Modes 1/2 require final viewport dimensions,
  direct alpha `.2375..25`, and zero far alpha/RGB; mode 0 requires no canvas.
- Lifecycle stress: repeatedly create/destroy generated renderers in one page;
  every first frame must retain identical provider/source/grid/target records
  and deterministic pixel signatures.
- Real scenes: run generated modes 0, 1, and 2 repeatedly on hardware Mac,
  then repeat against the exact deployed production SHA.
- Performance: compare FPS tails, LongTasks, direct render cost, heap/resource
  counts, and two-client network rates before and after; no fix may alter the
  100 Hz simulation or 20 Hz snapshot clocks.

## Implementation and pre-publication performance receipt

The Boneyard scene now awaits one scene-local environment-light presentation
built from the already resident `loadGameImage` source, mounts and resizes
WebGL, paints the initial mode-1/2 frame, and only then publishes `ready`. The
late-source correction below replaces that historical inverted mask with the
bounded direct record-18 draw. Mode 0 remains pass-free. The per-frame loops no longer allocate two
`Object.values(players)` arrays.

The complex-shadow browser proof was repaired against the current equipment and
secondary-state schemas and gained a configurable destroy/recreate stress lane.
On WSL, three pixel-sampled starts had one hash, 465,449 nonblack pixels, and
RGB total 38,680,129. On Apple M2 Metal/ANGLE, eight starts had one hash,
465,516 nonblack pixels, RGB total 38,690,111, exactly two providers, two
accepted sources, and no empty grid/target frame. Real Mac local runs covered
environment modes 0, 1, and 2. The corrected responsive receipt for `844x390`
mode 1 proved logical `1947.6923x900`, physical `2435x1125`, resolution `1.25`,
startup and settled alpha `0/245`; those historical values are retained only
as evidence of the now-removed inversion bug.

The performance adjacency sweep fixed two additional evidence-backed defects:

- Hub visibility diagnostics still use a 120-frame steady-state census but
  refresh on a Student birth/retirement, eliminating stale `visible + outside
  != live` failures without adding per-frame work.
- Hub and Boneyard scene code now loads behind their existing transition
  barriers, and SkillPicker preloads on Boneyard entry. The production Game
  entry fell from 6,666,378 bytes / 4,165,490 gzip to 189,625 / 55,559. A build
  budget pins one entry below 512 KiB raw / 128 KiB gzip and requires separate
  HubScene, BoneyardScene, and SkillPicker chunks.

Hardware-Mac render samples after those changes retained 60 FPS and zero
LongTasks:

| Surface | Sample | p95 / p99 / max frame gap | Browser task time |
| --- | ---: | ---: | ---: |
| Title | 5 s | one frame over 20 ms; 1% low 52.26 FPS | 490.61 ms |
| Element picker | 5 s | zero frames over 20 ms; 1% low 53.19 FPS | 657.61 ms |
| Discipline picker | 5 s | zero frames over 20 ms; 1% low 57.03 FPS | 504.38 ms |
| Hub desktop | 3 s | 19.5 / 20.4 / 20.4 ms | 700.60 ms |
| Hub mobile emulation | 5 s | 16.9 / 18.8 / 20.1 ms | 1,136.20 ms |
| Boneyard desktop mode 2 | 3 s idle | 21.5 / 23.3 / 23.6 ms | 687.76 ms |
| Boneyard desktop mode 2 | 3 s moving | 22.7 / 23.7 / 23.8 ms | 667.59 ms |
| Boneyard mobile mode 1 | 2 s idle | 16.9 / 17.2 / 17.2 ms | 482.46 ms |
| Boneyard mobile mode 1 | 2 s moving | 16.9 / 17.0 / 17.4 ms | 450.76 ms |

The network pass crossed the architecture's prior compression trigger. Two
real Hub browsers with two players and 15..17 Students received 113.39 KiB/s
of logical JSON each; players were 45.56, secondary state 31.12, and world
entities 28.55 KiB/s. Direct and proxied browser sockets now negotiate bounded
`permessage-deflate`; no-context-takeover level-3/mem-7 estimation reduced the
same snapshots to 35.18 KiB/s (`68.97%`) while retaining 19.99 Hz snapshots and
acks, zero sequence gaps, and identical peer ticks. Loopback supervisor-to-host
traffic is deliberately not compressed a second time. The normal two-client
harness now requires negotiation, at least 60% reduction, and at most 64 KiB/s
estimated compressed snapshot ingress per client.

These are pre-publication candidate receipts. Final canonical Mac validation,
rebased commits, CI/CD cutover, NFO SHA/service/database/rollback evidence, and
deployed production browser repetition are recorded only after they complete.

The first exact-tree WSL canonical gate after rebasing onto `81f8e82` exited
zero. It passed the Release backend build, all 24 backend/route contracts,
formatting, lint and architecture boundaries, 122 prerequisite tests, all 943
Boneyard/frontend tests, 5 level-up tests, 6 diagnostics tests, 14 Hub UI
tests, 5 desktop tests, the split production frontend/game-host builds, the new
bundle budget, and media policy. Its log is
`/tmp/sdr-prod-lighting-perf-validate.log`, SHA-256
`93dc5b4cd5c7de79ecdd6d265302b1b797e45251256081b6e7f9ee4436add9e4`.
The companion Mod Loader static RE suite passed 502/502; its JSON receipt is
`/tmp/sdr-prod-lighting-re-tests.json`, SHA-256
`4739c83498d4722e917ffd76a9fbd4d75049034be5955ad81bca00eaa0004910`.

## Exact Mac candidate acceptance, 2026-08-20

The implementation candidate before this receipt was
`f6ee85b87e78f563f42a04560d07a42d4cb1e3da`, tree
`94ab77b22f6c34e391e043c984f9c3c11e9396a8`. It was transferred through the
incremental Git bundle SHA-256
`c62cd22bf2154020361a28d0e528a2d2b89fc6547da5b184e0c69fa61708d50c`
and checked out cleanly in
`/Users/jarrett/.codex-worktrees/solomon-website-prod-lighting-perf-candidate-20260820`.
This receipt changes documentation only; the implementation tree tested below
is unchanged.

On the arm64 Apple M2 Mac mini, `/opt/homebrew/bin/bash
./scripts/validate.sh` exited zero. It passed the same 24 backend contracts,
122 prerequisites, 943 Boneyard/frontend tests, 5 level-up tests, 6 diagnostics
tests, 14 Hub UI tests, 5 desktop tests, lint/boundaries, production builds,
the Game-entry budget (`189,505` raw / `55,521` gzip), and media policy. The
log SHA-256 is
`4d35797141a9fc0aef3ef06565b5a910a5725543ce1c9d776dd18940357ddf6c`.

The exact-tree first-frame stress then created and destroyed eight generated
Boneyard renderers in one hardware-Chrome page. Every start retained pixel hash
`3489673138`, 465,516 nonblack pixels, RGB total 38,690,111, two provider
candidates, and two accepted sources. Direct renderer p95/p99/max were
`2.8/3.0/3.1 ms`; LongTask count and duration were zero. The JSON log SHA-256
is `47e5b381521f94d39d9b5bd14709719859eca39417644addc5eca51c2a572b17`.

Seven further real run entries covered the random generated bank, including
mode 0 and multiple mode-2 runs. The decisive exact mode-2 start reported
startup and settled alpha `0/245`, p95/p99/max `21.3/22.4/22.4 ms` idle and
`20.4/21.7/21.7 ms` moving, 60 FPS, and no LongTasks. Its log SHA-256 is
`0d2b004b2c9996031f34dafe712468910bc079ce2a9eae6d008fd1c59d8fc21c`.
The inspected exact-tree frame is `/tmp/sdr-boneyard-final-exact.png`, SHA-256
`be8b03d995cef309722967609a3237a7882f0207888713efba24c2fd7b079af6`;
it retains the player/fire illumination, authored fence gaps, projected
bar/post shadows, gravestone silhouettes, Tree occlusion, and HUD order.

The exact-tree two-browser network run received 100 shared snapshots per page
over 5.002 seconds at `19.992 Hz`, with 100 acknowledgements per page, zero
sequence gaps, and identical ticks. Both sockets negotiated
`permessage-deflate; server_no_context_takeover; client_no_context_takeover`.
Logical snapshot ingress was `108.86 KiB/s` per client; the bounded independent
estimate was `33.15 KiB/s`, a `69.55%` reduction. Both clients remained below
the 64-KiB/s budget with 11..14 Students and no page/console errors. Its log
SHA-256 is
`c2bf51f9da19e68c53af0c5957a3532a6f29561e609fa18bace436b1c9cc8580`.

The final menu-tail harness now reports the same p95/p99/max and LongTask lanes
as world scenes. In a five-second exact-source Mac sample, Title was
`23.8/24.3/24.6 ms`, element selection `21.8/23.0/24.3 ms`, and discipline
selection `21.1/22.7/23.2 ms`, all at 60 FPS with zero LongTasks. Its log
SHA-256 is
`222017d5882228d2b8f686fd31283c691c6d9e012a90afadd5ec1f2bcb3f1b02`.
All task-owned Chrome, Vite, and game-host processes were stopped afterward;
the remaining Mac game-host process belongs to the unrelated inventory
acceptance worktree and was not touched.

## Published first-frame lighting and performance closure, 2026-08-20

The implementation was rebased with the complete enemy-presentation owner and
published to Website `main` as
`83daf5d4f57432a064e241755c13135533d954da`. Mod Loader evidence was rebased
and published as `ab9e933932e2630120fa0b6e47057057045d83cc`. GitHub run
`32366963477` passed the Website Validate workflow and run `32366965339` passed
the Loader Lua-authoring/contracts workflow. The final rebased WSL Website log
SHA-256 was
`abdb083887c9dc007cfdcac9c676a7b2f51305e15d42a8ea7fc3c4688bffe81b`;
the full Loader portable suite passed 87/87 modules and 795 tests with log
SHA-256
`0d0d00fc19bce238bf6456aa8936cc8c684c43978b52de99d81aace4675a8d6d`.

The exact rebased Website tree then passed the complete Apple-M2 Mac gate. Its
log SHA-256 was
`67c15421679d4015d5c95ed0c82d32503752254166aaa8e6e75f5bd22e9ef886`.
Eight hardware-Chrome create/destroy starts retained pixel hash `3489673138`,
465,516 nonblack pixels, RGB total 38,690,111, two provider candidates, two
accepted sources, zero shadow-Z mismatches, render p95/p99/max
`2.7/2.9/3.0 ms`, and zero LongTasks. That log SHA-256 was
`649f8a2f20ff48f398bc8fdc96a33c0580b848bf80d8b996ea5ba42568eb3ba6`.
The inspected merged frame SHA-256 was
`4ec6d399719d8541a9348ede704819ef6e7d5339afb8a93774f46e52a7930771`;
it retained localized player/fire light, transparent fence-bar gaps, projected
post/bar shadows, and correct Tree/foreground occlusion.

Four real prepublication Boneyard runs covered mode 0 and two mode-2 starts.
Every mode-2 run reported startup and settled darkness alpha `0/245`; all idle
and moving samples stayed near 60 FPS with zero LongTasks. The combined log
SHA-256 was
`8e53f735a9af557087d1c3a0af1b6a0068ae04964f9f5332898317f72b3bf37b`.
The direct-host two-browser receipt delivered 101 shared snapshots at
`20.19 Hz`, zero gaps, identical ticks, `33.41 KiB/s` estimated ingress, and
`69.56%` reduction; its log SHA-256 was
`dd698fe9dafbddbe2aaf73a24ee1532d72e40c10d013621ad7d712f6d56c1436`.
The merged menu receipt remained near 60 FPS with zero LongTasks and log
SHA-256
`08bbfb8082d92550a194f298a941f793055818a5cc22c4f661ecc84b9816daff`.

The machine-local fail-closed worker independently validated and published the
same Website revision. Artifact SHA-256 was
`c2b4e0b0f45cb39a65abe08dee6f72abc76de7a6189d21e19f840fda492971d9`;
the retained rollback is
`/opt/solomon-dark-revived.rollback-pre-83daf5d4f574-20260820T120850Z`,
and the WAL-aware backup is
`/var/backups/solomon-dark-revived/pre-83daf5d4f574-20260820T120850Z/sdr.db`.
NFO reported the exact deployed SHA, both services active with zero restarts,
protocol `solomon-dark/30`, zero sessions/lobbies, `ok` integrity for the live
and backup databases, and no warning-or-higher service journal entries from the
cutover.

Production was then exercised from the Mac rather than inferred from service
health. Two cleanly exiting Boneyard runs covered modes 0 and 2; both held 60
FPS with zero LongTasks, and mode 2 retained first-ready and settled alpha
`0/245`. Their log SHA-256 was
`6df68df47deb1ab2706930f82990a719a83a7f960cd5503ffd5f8a382dd9e771`.
The production menu pass held approximately 60 FPS with zero LongTasks; its log
SHA-256 was
`466e29cb4cbad2d0bafdd5fc4bc3dc83548a7c13bb8205ff1b5febcf71064511`.

Public New Game pages are intentionally separate supervised one-player
sessions, unlike the direct-host two-player benchmark. Tool commit
`9234b608bcd63b7537203043a809306e004482a8` makes that topology explicit while
preserving the strict direct-host defaults and makes launch-owned browser
teardown authoritative. The decisive five-second production network receipt
delivered 101 snapshots per client at `20.18 Hz`, zero per-session sequence
gaps, no page/console errors, Apple-M2 hardware rendering, negotiated
`permessage-deflate; server_no_context_takeover; client_no_context_takeover`,
about `31.88 KiB/s` estimated ingress, and `55.6%` reduction. It exited without
retaining Chrome or a supervisor session; its log SHA-256 was
`2344a09388273127b033530eda31c2c1c55b102bb014f6f64c53fa7b8c0123db`.
The acceptance-tool and ledger follow-up changes no gameplay, lighting,
simulation, snapshot, or transport runtime contract.
