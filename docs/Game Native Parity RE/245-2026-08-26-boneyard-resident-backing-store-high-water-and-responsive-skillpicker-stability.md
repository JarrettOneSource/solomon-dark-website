# 2026-08-26 — Boneyard resident backing-store high water and responsive SkillPicker stability

## Physical reproduction and falsifiers

- Exact candidate `36606a2287fd54de91d2577f622d44636ef13087` on an iPhone XR
  running iOS 18.7.6 holds the optimized Hub at `60.00` FPS with p95/p99
  `18/19 ms`, zero frames over `34 ms`, and a `507,053,936`-byte WebContent
  footprint. The result SHA-256 is
  `a4a39c75d91610cca3c3d5f1f451692ff85b1e58016043bc9dd2098ebe3e2ca6`.
- The first complete physical stress path then measured empty Boneyard
  `57.46` FPS, SkillPicker `59.39`, Inventory `60.01`, Acid Rain `47.46`, the
  five-secondary overlap `54.07`, 87 active enemies `32.66`, and 83 enemies
  while moving/shooting `26.68`. A later fresh isolated control held 77 active
  enemies at `59.19` FPS. Enemy count alone is therefore falsified as the owner
  of the collapse; the slow rows require the preceding allocation-pressure
  path.
- During the next-session transition, iOS wrote
  `JetsamEvent-2026-08-26-155956.ips`. It names frontmost
  `com.apple.WebKit.WebContent` as the largest and killed process, reason
  `highwater`, at `98,529` 16-KiB pages (`1,614,299,136` bytes / about
  `1.50 GiB`) with zero purgeable pages. Report SHA-256 is
  `cb1b76379be4b557b0e4b64c9613e1710943e5de11485369e8b8be41d0fdd6ed`.
- A fresh Boneyard SkillPicker reproduction has exactly three page canvases:
  one `1574x675` Boneyard WebGL canvas, one `1574x675` environment-light
  Canvas2D surface, and one `1600x900` SkillPicker WebGL canvas. The scene
  explicitly reports `presentationPaused=false` while the settled picker owns
  gameplay input. WebContent reaches `1,054,820,768` bytes, then samples
  `1,180,928,656 -> 1,223,199,376 -> 1,256,704,656` over ten seconds while
  WebContent consumes about `38..48%` CPU and the GPU process `60..69%`.
  Inspector `Heap.gc` does not release the footprint. The picker and owner
  result SHA-256 values are
  `cdaf309f6e73dceab76d7993d7f592f47589f6bf87d415d2b4064075a87736b1`
  and `5fae9424cf1115c50307d13fa089f3b610e35a5675a27d8741f780047a4d576e`.
- Three one-second physical captures reproduce the reported background/picker
  instability. The middle frame is taken while Safari changes its visible
  viewport and loses most card/chrome pixels before the next frame restores
  them. Capture SHA-256 values are
  `1591b298999fb1b8083837c011873e6c7922040176e66d46479e1a7b582d0f9d`,
  `7d5b63efe088e58c6a9c3d07f8e31806259cda021bf533f6b6d3fe61e35d595b`,
  and `a97128833b51fffc0873561ce2ecf3b790ede145dd3a29c18b0e3c42e660cece`.

## Minimized owner and complete system boundary

The previously measured `100.29 MiB` Boneyard resident census understated its
browser cost. All 562 residents retain an independent `HTMLCanvasElement` plus
Canvas2D context as their Pixi texture resource. On macOS the same settled
Boneyard/picker path grows a previously idle WebContent process to about
`1.26 GiB` RSS. `vmmap -summary` attributes `928.0 MiB` of address space and
`773.8 MiB` resident memory to WebKit Malloc, with 712,561 allocations; the
resident RGBA payload is only `105,161,540` bytes. This disproves the remaining
pixel count as the sole owner and identifies retained Canvas2D backing-store
fan-out as the multiplicative cost. Mac result SHA-256 is
`c1f00af8277953abdc8f87177dd1de30ec76e93bdae0f9949d880350337477f7`.

The first buffer-source candidate then exposed the upstream half of that same
owner. A genuinely fresh settled Mac process still contained 2,415
`HTMLCanvasElement` objects, 2,412 Canvas2D contexts and 2,412 remote image
buffers. The static builder created one scratch surface per painter row, while
the editor brightness-lift cache retained a separate filtered Canvas2D copy of
each decoded Boneyard source. Copying only the 562 final residents could not
release either producer family. The closed candidate reuses one alpha and one
opaque painter scratch surface, draws the exact `brightness(1.12)` filter
directly during one-time static painting, and converts the smaller dynamic
lifted-texture membership through one reusable scratch into detached RGBA
buffers.

Native/web system: Boneyard static painting from the exact editor document,
through alpha cropping, immutable resident texture upload, base cleanup,
building/tree/main/foreground consumers, and final renderer teardown; plus the
SkillPicker's full-browser curtain projection and frozen-world cosmetic clock.

| Member | Required invariant |
| --- | --- |
| Opaque base tiles | exact current Canvas2D paint pixels and world bounds; one-time off-camera cleanup still repaints the same source bytes |
| Main and foreground residents | exact crop bounds, RGBA bytes, positions, painter rows, nearest sampling, culling and teardown |
| Buildings | unchanged shared base/roof source pixels, 3x3/2x2 surface grids, vertex colors, shadow caster and painter ownership |
| Trees, fences, props and monuments | unchanged paired roots, tint/alpha/wobble, source keys and cleanup membership |
| Static painter inputs | unchanged decoded source art and 1.12 brightness result; no per-source lifted Canvas2D cache in the game runtime |
| Dynamic actors/VFX/weather/lights | no count, quality, renderer-resolution or device-specific reduction; their existing owners remain unchanged |
| SkillPicker curtain | one complete browser-viewport black surface driven by the existing reveal/close alpha lane; fixed 1600x900 cards remain centered above it |
| Frozen world behind picker | complete membership remains visible; authoritative state stays frozen; render-only world lighting/cosmetic sampling must not invent changing background frames while the barrier owns the tick |

## Implementation consequence and validation contract

- Replace every retained Boneyard resident Canvas2D texture resource with an
  immutable RGBA `BufferImageSource`. Canvas2D remains the exact painter but is
  scratch ownership only: extract/crop its bytes, release its backing store,
  and retain one byte buffer plus the WebGL texture. Base cleanup repaints into
  a scratch canvas, copies into the existing buffer, releases the scratch
  surface, and updates the same texture source.
- Reuse one alpha scratch and one opaque scratch across all static rows; do not
  create thousands of collect-later Canvas2D owners during construction. The
  native runtime painter applies the same `brightness(1.12)` filter directly;
  dynamic lifted sources use one reusable scratch and detached RGBA buffers.
- Preserve exact alpha-crop output, including empty/full/cropped rows, explicit
  `rgba8unorm`, premultiply-on-upload and nearest sampling. Destroying a
  resident must release both the Pixi source and the retained byte reference.
- Move the existing SkillPicker curtain out of the fixed native WebGL canvas
  into one viewport-sized DOM layer. Keep the exact native reveal/close clock
  and fixed card/ambient geometry. Stabilize the frozen world's presentation
  frame while `levelUpBarrier` owns the authoritative tick; do not hide world
  members or stop the separately owned level-up/picker clocks.
- Regression coverage must pin byte-exact crop rows, transparent/full cases,
  buffer-source format/lifecycle, zero retained resident Canvas2D sources,
  shared scratch ownership, absence of the lifted-source cache from game
  texture loading, cleanup updates, responsive curtain bounds/alpha, and
  stable barrier-owned cosmetic frames in Hub and Boneyard.
- Re-run the complete supported gate and Mac acceptance, then repeat fresh
  physical Hub/Boneyard/picker/Inventory, Acid, secondary overlap, dense
  enemies, moving/shooting, all elements, repeated level-ups, Acid/UI,
  Tutorial Inventory, installed-web-app, teardown and re-entry. Final physical
  acceptance requires a bounded footprint, no new Jetsam/resource report, and
  stable thermal/frame-time behavior.

## Implementation validation receipt

- `BoneyardStaticPixelRegion` copies every tight/full/cropped ImageData result
  into detached RGBA storage. Each resident is a nearest-sampled
  `rgba8unorm` `BufferImageSource`; base cleanup repaints through one scratch,
  updates the same buffer/source, and teardown clears the retained byte
  reference after destroying the Pixi source. Empty and exact multi-row crop
  regressions cover the transfer boundary.
- Static construction now owns one alpha and one opaque scratch canvas instead
  of one Canvas2D context per row. The runtime base/main/foreground painter
  applies the existing 1.12 brightness result directly, while dynamic lifted
  texture sources use one reusable scratch and detached buffer upload. A fresh
  settled Mac heap drops from 2,412 live Canvas2D contexts/remote buffers to
  three contexts and six canvas elements.
- The responsive SkillPicker owns one full-browser DOM curtain driven directly
  by the unchanged `0..0.5` reveal/close alpha. Its fixed 1600x900 ambient,
  panels and actions remain in the independent WebGL stage. Hub and Boneyard
  keep complete world membership but sample render-only world cosmetics from
  the frozen authoritative tick while the level-up barrier is active, so
  lighting cannot invent changing background frames.
- Fresh settled Mac SkillPicker memory falls from about `1.26 GiB` WebContent
  RSS and `227 MiB` GPU RSS to a `611 MiB` construction sample followed by
  `518..523 MiB` WebContent and `65..66 MiB` GPU. The row holds `60.00` FPS,
  p95/p99 `18/19 ms`; result SHA-256 is
  `3f228fa1bc40219c6df0545ed60e24eb4651a861700646cee823ceac3187136a`.
- The complete seven-session Mac Safari matrix passes 21/21 rows with no
  browser errors. Minimum average FPS is `59.576`; maximum p95/p99 is `19/34`
  ms. Hub/Boneyard/picker/Inventory and restorations hold about 60 FPS; Acid
  with 175 actors is `59.59`; five-secondary overlap with 443 primitives is
  `60.02`; 90 enemies are `59.98`; 88 enemies while moving/shooting are
  `60.01`; all five max-rank primary rows are `59.58..59.74`. Result/log
  SHA-256 values are
  `23a4e8e6acbc326a1a4bb8fd30c1b530faeaaed85105f031ad60fffae227a955`
  and `f9c65801a1b3118ae7d9a606ac140d44566ead06fc55e14e68d6fbec1a3a47a2`.
- Eight consecutive SkillPickers hold `59.88..60.08` FPS and tear down to the
  two ordinary Boneyard canvases after every choice. Acid remains live through
  Inventory and four pickers at `59.60..60.08`, then fully retires and restores
  at `59.99`. The stage-9 Tutorial fixture opens Inventory, advances to stage
  10, closes into stage 11, resumes simulation and completes three reopens;
  final state is unblocked with no Inventory/error at tick 568. Result SHA-256
  values are
  `1f61cca7db4241a349c1b9900bb55173d6e90cdd6604a3edb8b23e0838689f79`,
  `74be390127f767cb310b3c66610ec33a213220e9629b695a0b730beaaa7ca46e`,
  and `cba5cf6123e32c1fe481a7c4b9dfc136347c09dc3ea0e70e7f8a73a5551be067`.
- Exact current-main canonical validation and the complete physical iPhone
  rerun remain required. Mac memory/FPS and source contracts do not substitute
  for bounded iPhone footprint, temperature, installed-web-app behavior and a
  no-new-Jetsam receipt.
- Exact final candidate `da61a74613589438048ae061eefebee05bf796e3`, rebased
  onto current `origin/main` `5e1c9acddac8616c8a74f8b95d12f387f237c056`, is
  clean and passes the complete supported gate on Linux/WSL and in the detached
  Apple-arm64 worktree at
  `/Users/jarrett/codex-acceptance/iphone-performance-20260826-final-lifted/website`.
  Canonical log SHA-256 values are
  `afa3e2cbd8dad0c393911903c1535c69afd99f8c05c0470d9e5dde6cc5811066`
  and `9fb5d773f9b119c3bbf544a96a77446e181bb3882b0025fe5e13da897002ec85`.
  The production entry is `477,708` raw / `133,898` gzip against the unchanged
  `524,288` / `134,144` limits. Physical and installed-web-app acceptance remain
  unpublished requirements; no push or production deployment is claimed.

## Physical compact-page falsification and remaining combat-asset owner

- The first physical rerun of exact candidate
  `da61a74613589438048ae061eefebee05bf796e3` falsifies the Mac footprint as a
  sufficient completion receipt. The iPhone XR settled SkillPicker row holds
  `59.37` FPS with p95/p99 `20/24 ms`, but its frontmost WebContent process is
  still `1,160,743,768` bytes while the GPU process is `63,800,440` bytes.
  Battery and virtual temperatures are `37.69 C` and `37.39 C`. No crash or
  Jetsam report newer than the existing `2026-08-26 17:37` CPU-resource report
  appears, but this footprint remains too close to the already proven
  `1.50 GiB` high-water kill to run repeated level-ups safely.
- The live page still contains only the Boneyard WebGL surface, its environment
  light surface, and the SkillPicker WebGL surface. Three one-second device
  captures have SHA-256 values
  `12898a6bdb926ca7978bb619501e57915e8e11691c3c0b70f741eed48996a23b`,
  `8be66fb6fe8cafa78e7751ac83260ccf57036ed824b1e34c5669bfbd737a6738`,
  and `545bf15dfec30c18300741209a55539fbc1a4b33ac514c8126d302c8b00695e4`.
  The curtain keeps the authoritative world lighting stable, but the middle
  Safari capture again observes an incomplete SkillPicker WebGL presentation.
  This keeps the responsive compositor row open independently of simulation
  lighting.
- The remaining startup fan-out is now bounded statically. One Boneyard load
  requests `2,267` independently decoded native enemy sources: `2,087`
  BadGuys, `65` DeadHawg, and `115` Demon records. The complete BadGuys and
  Demon source directories contain `2,625` small PNGs whose combined decoded
  RGBA payload is only `15,013,700` bytes. The physical cost is therefore not
  explained by pixels; it is thousands of image, texture-source, upload, and
  decoded-cache owners created by `loadGameTextureEntries`. Removing the
  earlier Canvas2D cache did not remove this downstream fan-out.

Native/web system extension: exact BadGuys and Demon record pixels from the
extracted manifests through bounded shared atlas pages, per-record logical
origin/trim reconstruction, the existing `brightness(1.12)` browser filter,
nearest/native sampling, every enemy/loot/player-spell consumer, context loss,
and teardown.

| Member | Required invariant |
| --- | --- |
| BadGuys and Demon records | every non-empty extracted source reconstructs byte-for-byte at its original logical dimensions; record number and native anchor remain unchanged |
| Runtime brightness | the current Canvas2D `brightness(1.12)` result is applied once per shared page, not approximated with tint or a device-specific shader |
| Dynamic consumers | enemy bodies, deaths, projectiles, loot, player Fire/Weld actors and secondary/primary VFX keep complete existing membership and frame selection |
| DeadHawg/editor painter | remains on its current source path because the static painter requires the independently decoded source images; no duplicate atlas page is introduced for that family |
| Loading and teardown | stable atlas/record keys replace individual BadGuys/Demon URLs; derived frames die before their shared page sources |
| Responsive SkillPicker | full-viewport curtain and frozen-world clock remain; incomplete device captures must be retested after memory pressure is bounded rather than hidden by removing world/UI members |

Implementation contract: build deterministic, checked BadGuys/Demon pages from
the extracted PNG oracle; preserve transparent logical padding through Pixi
`orig`/`trim`; deduplicate identical crops; load and brightness-lift only the
bounded page sources; map every requested atlas/record key to a derived shared-page
texture; and prove reconstruction, source exclusion, destruction order,
browser errors, physical memory, repeated level-ups, and all stress rows.

## First combat-atlas physical receipt and remaining Safari framebuffer edge

- Candidate `59f4764976ba4593cf026e38ee77070c71ad84a6` replaces the `2,202`
  selected BadGuys/Demon image requests with two exact pages. The pages decode
  to `17,776,640` bytes, reconstruct all `2,625` extracted source records
  byte-for-byte, and preserve logical origin/trim. The Boneyard scene chunk
  falls from `5,648.43 kB` to `205.95 kB`; the build transforms `2,541`
  modules instead of `7,422`. Hub and Boneyard both use the pages, with the
  Boneyard alone applying the pre-existing browser `brightness(1.12)` lane.
- A fresh unlocked iPhone SkillPicker sample holds `58.44` FPS with p95/p99
  `22/38 ms`; an earlier colder sample holds `56.25` with p95/p99 `24/46 ms`.
  The first settled process is `923,994,568` bytes, about `237 MB` below the
  prior candidate. A later two-minute unlocked sample reaches
  `1,018,497,600` bytes, so physical pressure is materially lower but the
  complete repeated-picker/stress gate remains required. Temperatures remain
  `34.09..37.09 C` rather than immediately climbing past the earlier
  `37.69 C` sample.
- `JetsamEvent-2026-08-26-201100.ips` (SHA-256
  `aa10afb652af81f5233f3d6a139b7a797b6cb06d5bd3c9b892dbfffd873302f1`)
  does not kill Safari or WebContent. It kills the `192`-page
  `containermanagerd` process for `vm-compressor-thrashing`; the largest
  suspended WebContent row is `15,456` pages. It is a new device pressure
  event and must remain in the ledger, but it is not an application crash or
  a recurrence of the prior `98,529`-page WebContent high-water kill.
- Unlocked one-second captures at the settled picker have SHA-256 values
  `75ef9eb4b7ad39b3b78c08f5209fc014ecd754a9eafb41d7a99feae2dd895def`,
  `b24dec0fd83107238238914ed09352006bcc642be5c87f0fb5f42f9fd92fb1ac`,
  and `0cc2282f1e18987d1bf19c3c287b528c6654f9ffe4d29fbee0e4c1905b4f9508`.
  The frozen world and full DOM curtain stay stable, but the middle capture,
  taken while Safari retracts its browser chrome and changes the visual
  viewport, observes a partially invalidated SkillPicker canvas. The renderer
  is manually painted every presentation frame into a default WebGL context
  whose `preserveDrawingBuffer` remains false. This is a browser transport
  edge, not a native screen membership or lighting-clock branch.

Candidate `d8e1f304f36191525f8205294e102f60177899f2` tested a modal-only
`preserveDrawingBuffer`. Physical capture falsifies it: hashes
`c5dfd3e461c2da54af8d46411b8250c1c126bda15430753cd46cb6cec5569fd1`,
`e6a8cf6ff9e3ab3a54f2dccb251dd6fe98e767d9d7736a4e4de21b7ddbe85046`,
and `139a8f356f67823a5df618ababa55b845e7ea65369dbb95828382a2c2dbc5700`
still include one partial card frame, while instrumentation stalls reach
`118 ms`. The flag is removed. The complete darkened/frozen world is stable in
all frames; only the DVT-triggered Safari chrome transition exposes the
manually painted UI buffer. That instrumentation edge is not evidence that the
reported world-light clock still advances, and it does not justify a permanent
buffer or removal of native picker animation.

Rebase integration with current main `dd845ddc` exposed a separate source-key
boundary. The selected-primary Staff-orb closure makes record 15 part of the
global `elementVfx` manifest, which Create preloads with ordinary browser image
URLs. Mapping that global value directly to `boneyard-combat:BadGuys:15`
caused the exact Mac browser error
`could not load game asset: boneyard-combat:BadGuys:15` before Create settled.
Global/Create manifests now retain their reviewable original PNG URLs. Only
the Hub/Boneyard texture-owner seam translates the eleven packed combat URLs
to atlas/record keys before load and lookup. Staff Steam `2002..2007` and all
other non-packed rows remain ordinary URLs, preserving the newly landed Staff
program without widening atlas brightness semantics.

The physical Tutorial Inventory rerun then reproduced the reported softlock at
stage 10. The DOM dialog exists, but reports `Native inventory renderer
unavailable`, owns no inventory canvas, and leaves gameplay paused/input
blocked. The owning exception is a complete-membership mismatch introduced by
the selected-primary Staff-orb closure: `createNativeElementVfxTextures` now
materializes ordinary element rows plus the Staff-only aura and six Steam rows,
while `createHubInventoryRenderer` preloads only `elementVfx.common` and
`elementVfx.frames`. This is shared by Tutorial/ordinary Inventory and every
trader preview; it is not a Tutorial controller fault. The inventory renderer
must preload `elementVfx.special.aura` and every `elementVfx.special.steam`
member before constructing the shared VFX texture bank. No fallback or
Tutorial-only bypass is permitted.

## Final rebased physical acceptance receipts

- Exact candidate `ef771c4d506f6997372f0c50859723bd72ce2332`, based on current
  `origin/main` `dd845ddc`, is served only by the isolated Mac route on protocol
  83. Production and `origin/main` are unchanged. The production Game entry is
  `468,811` raw / `130,921` gzip against `524,288` / `134,144`.
- One clean physical Safari session covers the requested principal matrix with
  empty browser-error arrays: Hub `60.00` FPS, empty Boneyard `60.36`, settled
  SkillPicker `56.50`, Inventory `59.95`, Acid Rain with 174 actors / 221
  primitives `53.05`, five-secondary overlap with 242 actors / 449 primitives
  `54.19`, 89 enemies `52.45`, and movement/shooting with 87 enemies and 33
  primary actors `43.13`. The original corresponding Acid/enemy/movement rows
  were `47.46`, `32.66`, and `26.68` FPS. Result SHA-256 is
  `286ece6b31db2d4f48372cd611539138df620f6b91c8ef62e1ed4c196657ca20`;
  the file is deliberately labelled partial because a later cross-session
  Create-driver click ended the composed run after all requested first-session
  rows and one contaminated Fire session had already been recorded.
- Each max-rank primary was therefore measured from a genuinely fresh
  WebContent process. Idle/stress FPS are Fire `60.08/54.62`, Water
  `60.12/55.43`, Ether `60.24/58.39`, Air `60.16/55.11`, and Earth
  `60.00/55.09`; stress p95 frame times are `22/22/18/19/19 ms` with 41..43
  enemies and complete actor families. Result SHA-256 values are
  `9fca15845d2ec7dd8765c5eda4d61656f18bb6642d777a0851babbac69005590`,
  `7e78bea940a23f46bbbfa2e671f28583ee1dc61b18ba3a1113073fbeb5b54bbb`,
  `82fd977c748c68fdccec0c08dbd5fa65ecd2abc1c7c9b1c02b6a52df3e6eb48e`,
  `5331b17443f8b38a1ace98e9757793856e1175007eeb21698e7f50df0c54e0c0`,
  and `c438a325840bc55f0bb1175bd60b577f58b5c95f52fae99ac30fb75285875193`.
- The exact stage-9 Tutorial fixture now opens Inventory, advances to stage 10,
  closes to stage 11, resumes the fixed tick, and completes three more
  open/close cycles. The first cold open is `41.54` FPS while its newly complete
  VFX texture bank uploads; the three warmed reopens are `60.75..61.31` FPS.
  Final state is `inputBlocked=false`, no Inventory, stage 11, tick `3262.7`,
  with no browser errors. Result SHA-256 is
  `344c115a88db505240bec069589e270b644c6544057e9d103c59290d09eea917`.
- The installed `Solomon Darker` Home Screen clip was launched through iOS's
  standalone `com.apple.webapp` / `com.apple.SafariViewService` host. Its normal
  production URL was preserved; the same standalone process was temporarily
  navigated to the isolated candidate. It holds Hub `59.67` and Boneyard
  `60.14` FPS, then a fresh standalone host completes eight consecutive picker
  cycles at `59.06..60.02` FPS. Every close returns to two canvases with an
  advancing world frame and empty error array. Result SHA-256 values are
  `a683f0e2af517f72e45bdbaaac668ada37c08a1396b3307cec57b50571e562b5`
  and `c4a449ea40b9363bfba9971cb62da5408cacb93638b9936950f632e53ee3e36f`.
  The installed host was finally relaunched at its ordinary production title.
- Fresh single-session post-run WebContent footprints are `647..682 MB`; the
  standalone eight-picker run ends at `538 MB`. Phone temperature stays
  `31.7..35.6 C` through the final acceptance and ends at `32.8 C`. No crash
  report newer than `JetsamEvent-2026-08-26-212415.ips` appears during the
  final clean element or standalone runs. The `21:15:24` and `21:24:15`
  reports kill small system processes (`Safari.History` for compressor
  thrashing and `fileproviderd`/`audiomxd`), not Safari/WebContent.

The earlier diagnostic sequence intentionally retained one WebContent process
across several candidate builds and complete game sessions; it eventually hit
the iOS `98,304`-page (`1.50 GiB`) high-water in
`JetsamEvent-2026-08-26-203436.ips`, SHA-256
`772eaa7db2a7d529664021ceafa6502cc766fc0ee257170bb4d1bb36e9b58855`.
That receipt is not hidden: iOS does not promptly return WebKit allocator high
water after several destroyed SPA game generations. It contaminated a later
Fire row (`37.30` FPS at `1.155 GB`) and is why independent element acceptance
uses fresh processes. In-session product behavior is separately proven by the
eight-picker Safari and standalone runs; repeated complete game generations in
one long-lived WebContent process remain a documented browser endurance limit,
not a level-up leak or thermal failure.

## Final preservation-rebase receipt

- The detailed physical rows above belong to pre-rebase candidate
  `ef771c4d506f6997372f0c50859723bd72ce2332`. Final code candidate
  `ca4ca4f4d96f2ab92f0bd71e43a9a76b884edd01` preserves the same mobile
  atlas, backing-store, Inventory-membership, SkillPicker curtain and frozen
  clock changes while rebasing current-main Hub-wide run entry and spell
  parity through `40f300c7`.
- The only overlapping code conflict was the corrected native Acid/Storm
  top-to-bottom filled-quad geometry versus shared gradient ownership. The
  final plan retains exact new top/bottom colors, alpha, width and rectangle
  geometry while allocating exactly two world-owned immutable fills. TypeScript
  and the focused 74-row secondary/Boneyard set pass.
- Exact final canonical Website validation exits zero; log SHA-256 is
  `08cffd5ea4d336ea04d7b4f08996eebc59b0054bd5db914e77b4f59ea3028eea`.
  The Game entry is `468,811` raw / `130,925` gzip against `524,288` /
  `134,144`.
- Exact-final Mac Safari combat smoke holds `60.03` FPS for the five-secondary
  overlap with 408 actors / 663 primitives and `60.01` FPS with 36 enemies;
  p95 is `18 ms` in both rows and browser errors are empty. Result SHA-256 is
  `0dce5374fb8b767f45b2c29a4c7880373717983fead47d80e2effa0a2a3c4842`.
- The phone had already been unplugged after the completed physical matrix, so
  `ca4ca4f4` is Mac/focused/canonical-proven while `ef771c4d` is the exact
  detailed iPhone and installed-web-app receipt. A later unrelated Tutorial
  potion commit `33543be5` advanced the shared remote after the final gate; no
  push, merge, or production deployment is claimed.
## 2026-08-26 player-translation hold clarification

- The owner clarified the requested stage-2 freeze after the first publication:
  the player must stop translating with the ten Skeletons. The earlier policy
  kept player movement live so the previous receipt remains an accurate record
  of that pushed revision, but it is no longer the target contract.
- No native fact changed. Retail still has no stage-2 pause branch; this remains
  explicit browser policy. The relevant current web causal seam is
  `stepBoneyardWorldTick`: its player movement plan consumes both retained
  velocity and current movement input before hostile stepping. Zeroing only the
  input would still allow native-style velocity retention to drift the wizard.
- Complete clarified membership: existing hostile actors/effects/RNG remain
  held; the sole Tutorial player position and velocity are held from the first
  stage-2 tick; gate contact and footstep progression receive no movement;
  aim, primary-cast admission, primary spell actors, Tutorial/narration/UI, and
  the application pointer clock remain live; stage 3 releases player and
  hostile movement together without catch-up. Ordinary pause/resume grace,
  later Tutorial stages, multiplayer, and non-Tutorial Boneyards remain outside
  this rule.
- Correct owner: derive one stage-2 player-movement hold from the authoritative
  Tutorial controller and compose it into the Boneyard movement planner by
  supplying zero prior velocity, idle movement input, and movement scale zero.
  Do not block the complete `PlayerCharacterInput`, because that would also
  remove the primary cast required to release the lesson.
- Validation must begin stage 2 with retained velocity and held desktop/mobile
  movement, prove position and velocity stay exact while ten hostile actors
  remain byte-stable, prove primary sequence still advances, then prove both
  player and hostile translation resume after stage 3. The Mac desktop and
  mobile browser journeys must perform a real movement attempt during the hold
  and retain empty page/console/network error arrays.

- `stepBoneyardWorldTick` uses the same authoritative stage-2 predicate as the
  hostile hold, composes it with Solomon's existing movement lock, and feeds
  `planPlayerCharacterTick` zero prior velocity, idle movement input, and scale
  zero. Cast input never enters that movement-only seal.
- Focused Mac coverage begins stage 2 with velocity `(100,-50)` and held
  movement, then proves exact player position, zero velocity, unchanged gait
  and walk cycle, no movement contacts, ten byte-stable Skeletons, accepted
  primary sequence, and resumed player/hostile movement at stage 3. The typed
  Tutorial suite passes `58/58`.
- The final Website candidate is based on current main `6d87972b`; its nine
  changed files were blob-identical between the local and detached Mac trees.
  The Mod Loader candidate is based on `18acf6b8`; its one changed report was
  blob-identical. The complete Mac Loader static RE gate passes `509/509`.
- `/opt/homebrew/bin/bash ./scripts/validate.sh` passes on the combined Mac
  tree: backend Release build, 24 Website/backend contracts, lint/import/
  generated checks, all `2,364/2,364` frontend and desktop tests, production
  frontend/game-host builds, media policy, and bundle budget.
  `Game-Bec09s5v.js` is `468,952` raw / `130,947` gzip bytes against
  `524,288` / `134,144` limits.
- Mac Chrome desktop and mobile journeys each attempt real stage-2 movement
  and retain the player exactly at `(1025,1350)` with velocity `(0,0)` while
  the ten-enemy snapshot remains unchanged. Mouse and right-joystick actions
  still advance primary sequence `0 -> 1`, enter stage 3, hide the lesson, and
  release movement. Page, console, failed-request, and failed-response arrays
  are empty. Manual inspection confirms both cast lessons remain legible over
  the held player/world.
- Evidence SHA-256 values are `c910213f...b32d` (desktop held frame),
  `b34073ec...1f7f` (mobile held frame), `a54b2fd5...73c6` (desktop receipt),
  and `95117fe9...90be` (mobile receipt). Evidence is retained at Mac
  `/Users/jarrett/codex-acceptance/tutorial-player-hold-20260826-r2/evidence`
  and local `/home/user/.codex-evidence/tutorial-player-hold-20260826`.
- No browser-platform exception or material unknown remains. Publication is
  authorized and awaits the final immediately-before-push remote check.
