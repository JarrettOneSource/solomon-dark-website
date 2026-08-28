# 2026-08-26 — Hub visual-page residency and physical WebContent high-water reopening

## Reported smell and falsifiers

- The shared-gradient candidate materially improves the physical Acid row:
  exact iPhone XR/iOS 18.7.6 Acid rises from `25.50` to `55.27` FPS at the same
  175 actors / 222 primitives, with p95/p99/maximum falling from `54/70/178`
  to `24/36/129` ms. Host cadence remains `99.85` Hz, blocked frames/errors
  remain zero, and post-cast restoration is `59.13` FPS. Result/log SHA-256
  values are
  `6362e88ecaa38cc8db01141ccdc90e3f923f2f28e50f1062256dcb7c3212216c`
  and `e8522c3eaa17bba5c8b633e7e832f614c5f4dff169140ad28fc59cfea47c02da`.
- That closes Acid's frame-submission owner, but not the installed-app heat or
  crash report. In the same fresh exact lifecycle, WebContent grows from
  `339.3 MB` at Title to `1.070 GB` after Acid/restoration and `1.237 GB`
  after another 30 seconds of ordinary active Boneyard. Battery temperature
  rises from `27.89` to `29.59 C`; no new crash occurs in this shorter sample.
  The two earlier frontmost WebContent high-water Jetsams remain the failure
  baseline.
- Falsifiers for decoded visual residency are a small Hub image census, a
  larger steady Boneyard canvas owner, or a fresh direct-Title-to-Boneyard path
  with the same footprint. Conversely, hundreds of MiB of transparent Hub
  source padding loaded before Boneyard predicts retained WebKit decode/cache
  pressure even after Pixi correctly destroys Hub textures.

## Evidence and minimized owner

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Physical resource census | exact `114404e9`, fresh Title -> Hub -> Boneyard, Web Inspector resource buffer | 1,035 resources include 776 image-like responses totaling `300.80 MiB` decoded RGBA; Hub-world files alone account for about `190.86 MiB` | high |
| Exact source-pixel census | all 87 reviewable non-HUD/non-primary/non-trader `hub-*.png` world sources selected by the Hub owner | current source dimensions decode to `190.45 MiB`; exact nonzero-channel trimming of each logical visual leaves `36.16 MiB` before deduplication | high |
| Logical-frame census | current Hub render callers and authored dimensions | 578 complete nonempty logical visuals: courtyard/room layers, props, actors, NPCs, marker art and every animation frame | high |
| Deterministic packing probe | the same exact RGBA cells, two-pixel filter gutters, shelf ordering, no pixel substitution | every visual fits in three pages no larger than 2048; tight page dimensions `2048x2041`, `2048x2046`, `2048x1068` total `40.27 MiB` decoded | high |
| Isolated Boneyard resident census | diagnostic fields over exact `114404e9`; fresh Mac Safari Hub -> mode-2 Boneyard | all 562 retained static canvas-backed residents total `105,161,540` bytes (`100.29 MiB`): `44,544,296` base and `60,617,244` non-base; largest single canvas is `4 MiB` | high |
| Native page owner | retail `SolomonDark.exe` SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; `native-asset-system.md`; builders `College 0x004E6450`, `Faculty 0x004E9EA0`, `Library 0x004EBCC0`, `Memoratorium 0x004EC3B0`, `NPCs 0x004EC890`, `Office 0x004ECDC0`, `Storage 0x004F2EB0` | these seven owner pages are one `2048x2048` page plus six `1024x1024` pages: exactly `40 MiB` decoded; each bundle is reference-counted and releases its page on the final owner | high |
| Current browser owner | `hubGameAssetSources`, `hubWorldAssetSources`, `loadHubWorldTextures` | one Hub construction loads every extracted world PNG separately and retains one Pixi source per padded image until scene teardown; source extraction expanded native packed records into sparse logical sheets/composites | high |

The static Boneyard resident set is real and remains in the acceptance memory
budget, but it is bounded and smaller than the avoidable `150 MiB` difference
between current Hub decoded sources and their exact compact page set. The first
representation fix therefore belongs to Hub visual pages, not gameplay density,
renderer resolution, room membership, static-scene deletion, or mobile quality.

## System boundary and complete membership

Native/web system: Hub-world visual pages from Hub renderer acquisition through
all Courtyard/private-room consumers and final renderer release. The compact
browser set contains all 87 current owner sources and all 578 logical visuals.

| Member family | Required compact membership and invariant |
| --- | --- |
| Courtyard field | complete `2000x1024` courtyard, foreground, four depth-prop frames, fountain, statue body/aura |
| Southern extension | battlement, tower, seam, east/west platforms at unchanged repeated placement and painter depth |
| Seal and Useful Thyngs | both pulse programs, back/front/shadow, five balloon frames and all existing logical bounds |
| Astronomer | 12 assistants; green/red gesture, idle and transition strips; five telescope frames |
| Courtyard actors | Annalist, potion actor, item/perk traders, Skorcha, teacher/rune/burst, all 24-heading Student head/prop and 5-by-24 read/walk frames |
| Private rooms | every Mortuary, Library, Storeroom and Office background/foreground/flame/layer; ten paintings; all room-prop frames; Memorator, Librarian, Dowser, Archchancellor and Polisher frames/markers |
| Marker/onboarding art | left/right help/talk markers plus directional and walk-to-talk cues |
| Separate owners | player Clothes pages, player/world spell VFX, native HUD/UI/trader atlases, level-up sparkle and shared actor shadow remain in their existing loaders and are not folded into the Hub-world page set |

All room visuals remain immediately available for shared-Hub region changes.
Packing changes only browser storage representation: each logical texture must
restore its original dimensions and transparent trim, and every later subframe
must retain the same local origin, anchor, transform, tint, alpha and sampling.

## Web implementation consequence and validation contract

- Add one deterministic Hub-world page packer whose source-of-truth remains the
  87 exact extracted PNGs. Encode every authored sheet geometry explicitly,
  alpha-trim and deduplicate complete logical frames, add transparent filter
  gutters, keep every page at or below 2048 pixels, and reconstruct every cell
  byte-for-byte before emitting pages/manifest.
- Replace Hub-world network membership with the compact page sources. Restore
  Pixi `orig`/`trim` for whole visuals and subframes; keep player/spell/HUD/UI
  sources and their lifetimes separate. Raw review-oracle PNGs must not be
  requested by a live Hub.
- Make one Hub atlas owner create/cache derived textures and destroy them before
  the three page textures. Preserve scene readiness, all-room availability,
  painter order, animation indices/clocks, geometry, collision, input, protocol,
  simulation and audio exactly. Do not lazy-drop rooms, reduce art, resize the
  renderer, lower native actor/VFX counts, or add a device-specific branch.
- Red/green coverage must pin 87 sources, 578 nonempty frames, page
  count/dimensions/decoded budget, source-to-page-only readiness, every family
  and selector above, byte-exact packer reconstruction, logical subframe trim,
  and derived-before-page teardown.
- Repeat exact Mac Hub/private-room/Boneyard/UI/combat/VFX/restoration journeys.
  Physical acceptance then requires a fresh bounded WebContent path through
  Hub, Acid, repeated level-ups and Tutorial Inventory, materially lower peak
  footprint, stable temperature/performance, and no new WebContent Jetsam or
  resource report. Installed-web-app acceptance remains a separate final row.

## Implementation and preliminary validation receipt

- `pack-hub-visual-atlas.py` explicitly owns every authored sheet geometry,
  preserves nonzero RGB even where alpha is zero, verifies all reconstructed
  logical RGBA bytes against the 87 review-oracle sources, and deduplicates six
  byte-identical frames. The result has 578 frames, 572 unique rectangles, and
  three transparent-guttered pages at `2048x2041`, `2048x2046`, and
  `2048x1068`. Their decoded total is `42,229,760` bytes (`40.27 MiB`) versus
  `199,698,704` bytes (`190.45 MiB`), a `157,468,944`-byte / `78.85%`
  reduction. The packer `--check` passes on Linux and Apple arm64.
- Page SHA-256 values are
  `471c261167a570de7962b6fba68d962f8f3c8d60ce99d60a7c118669c20267be`,
  `ba18049d15c80449e81e9e4df35de34dc6752c63b7828f1613aa0852307c377e`,
  and `88d50d244928669a0363bea6691296b1479800086289afd202c0e6a782869220`.
  The generated manifest and packer hash to
  `d93940b3a387ad5ca501df30fe8013587ff6eec43f954dd67fce42c7505e1a1a`
  and `718f9b11ff76de6552c1bec97230fadf551ae61be2490a67f23fa45392bcca7b`.
- `HubVisualAtlas` restores every frame's logical `orig`/`trim`, including
  intersections for the six authored whole-world crop bounds. Hub texture
  construction now requests the three page URLs plus unchanged player/spell/
  UI owners, materializes single logical textures and every animation from one
  atlas cache, destroys all derived frames once, then destroys only the actual
  loaded page/base sources. Courtyard and private-room scenes no longer create
  source-relative textures that could ignore a packed page offset.
- A Vite SSR membership probe reports all three page sources requested, zero
  of the 87 padded sources requested, and the unchanged complete secondary-
  texture membership. Exact pack/static/runtime-loader focused coverage passes
  `11/11`; Hub UI passes `81/81`; the broad Boneyard/runtime group passes
  `1,579/1,579`; TypeScript, lint/boundaries/generated checks, production media
  policy, and the production build all pass. After rebase onto current
  `origin/main`, the game entry is `476,216` raw / `133,481` gzip against the
  current protocol-80 limits `524,288` / `134,144`.
- The four performance commits were rebased without a product-code conflict
  onto current main `d43fb6a3534e7bc052ba60d0c31ab47525ced8d7`; the sole
  append-only RE-document conflict preserves both complete systems. Exact code
  candidate `36606a2287fd54de91d2577f622d44636ef13087` is detached and clean
  in the Apple-arm64 worktree and passes the complete canonical
  `./scripts/validate.sh` gate. Canonical log SHA-256 is
  `e67ffaecac0cc8ab51aae62a1e4ea71366b58a65b90c6db9882270a755fec1b2`.
- Exact Apple-arm64 Mac Safari covers 46 independently sampled rows across the
  current automatic College intro, Hub, Boneyard, SkillPicker, Inventory,
  Acid, 416-actor / 670-primitive five-secondary overlap, 90 active enemies,
  89 enemies while moving/shooting, all five primary families, teardown and
  restoration. Minimum average FPS is `58.02` on the initial Tutorial Inventory
  opening transition; maximum p95/p99 is `33/34` ms there. All other principal
  stress rows hold `58.63..60.08` FPS and every browser error array is empty.
  Composed result SHA-256 is
  `49a67caffcf2c5d0789a2f1b64c9e76749236f4911453b4ac9a917800d82242c`.
- Eight independent level-up pickers hold `59.90..60.02` FPS and each tears
  back down to two canvases with advancing world frames. Live Acid remains at
  `59.90..60.04` FPS through Inventory and four additional pickers, then fully
  retires and restores at `59.90` FPS. Result SHA-256 values are
  `b307b2827d59e15236455adda182c8214708d517e6a14e81c9ab80760bcc790e`
  and `f0a2955c5e009de6dc3b84ee852ad7de825610cf150ed9caeee2098f8616c688`.
- A freshly generated current-schema Tutorial stage-9 fixture (file SHA-256
  `5ff0a9595bb4f9782aef3b2c0553a32aa082093b0c833e47326e4be8b2239654`,
  document SHA-256
  `835d1fe2a43a2c42f9011fb0e7d4ca62f23b5601e59e258c0aebb81bf7589fd2`)
  opens Inventory into stage 10, closes into stage 11, resumes the fixed tick,
  and completes three more open/close cycles. Final state is stage 11,
  `inputBlocked=false`, no Inventory, advancing tick `490.2`, and no error.
  Result SHA-256 is
  `e961ce01c544ce4befd2364caf43b1b665dcab4124a2cadb903027017d7539a5`.
- Physical compact-page WebContent/thermal, repeated level-up, Tutorial
  Inventory, installed-web-app and teardown/re-entry rows remain required. The
  iPhone USB service became unavailable before the first compact-page physical
  sample; Mac and canonical receipts do not substitute for those rows.
