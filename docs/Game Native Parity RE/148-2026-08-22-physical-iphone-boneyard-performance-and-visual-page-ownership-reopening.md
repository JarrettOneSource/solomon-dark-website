# 2026-08-22 — Physical-iPhone Boneyard performance and visual-page ownership reopening

## Reported smell and parity question

- Requested review: inspect current production on an unlocked physical iPhone
  through the Mac mini, measure Title, Hub, and Boneyard, and correct every
  evidenced performance problem without weakening native presentation.
- The Title and Hub controls falsify a route-wide timing, transport, or WebKit
  refresh defect. The same visible tab becomes progressively CPU- and
  memory-bound only after constructing a Boneyard renderer.
- This reopens the 2026-08-20 Arena-weather and 2026-08-22 startup-residency
  entries. The weather pass replaced heavyweight `Graphics` streaks but still
  rebuilt an immutable object graph for every live drop and splash on every
  display frame. The startup pass corrected scene ownership but did not inspect
  representation inside a scene: one native `Clothes` page became 79 decoded
  padded browser sheets.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Physical device | paired iPhone XR `iPhone11,8`, iOS `18.7.6` build `22H320`; Safari/WebKit production Website `762b6067500d277fd1264c5c38eb1f2acf001744`; direct MobileDevice Web Inspector | Landscape viewport was `896x325`, DPR 2, visible throughout. Loader reached Title once with no page reload or error. | high |
| Physical Title control | direct rAF plus independent 25 ms timer probe | `59.92` FPS, frame p95/p99 `17/18 ms`, `59 ms` maximum, no gap above `100 ms`, no error. | high |
| Physical Hub active control | same tab and clocks; deterministic keyboard/mouse input through the existing browser input owner | `5,347` world units, every sampled frame moving, up to seven primary presentations; `59.75` FPS, p95/p99 `18/20 ms`, `89 ms` maximum, no gap above `100 ms`, no error. | high |
| Physical Boneyard reproduction | mode 2, continuous movement/casting, zero enemies, 20 complex-shadow casters, up to 586 drops/320 splashes/10 lights/151 visible residents | `34.52` FPS, p95/p99 `41/54 ms`, `311 ms` maximum, 374 gaps above `34 ms`, 11 above `100 ms`; independent timer max `290 ms`. A later idle pass fell to `22.63` FPS with p95/p99 `118/253 ms` and `920 ms` maximum. | high |
| Lighting differential | same live run; only `complexLighting` changed through the canonical settings subscriber, then original missing-settings state restored | Lighting-off did not recover the frame/timer tails and worsened with sustained load. Lighting and complex shadows are not the primary cause; elapsed heat/memory pressure is a confound for non-rested sequential samples. | high |
| Device process telemetry | personalized Apple DeveloperDiskImage, `pymobiledevice3 10.2.0` DVT sysmon | Active WebContent reached `70.35%` CPU and `1,269.27 MiB` physical footprint; WebKit GPU reached `19.41%` CPU and `76.63 MiB`. MobileSafari and Networking were small. | high |
| iOS resource report | device-generated `com.apple.WebKit.WebContent.cpu_resource` at `11:15:46` EDT during the reproduction | iOS recorded 90 CPU seconds over 172 seconds (`52%` average, over its `50%` limit). WebContent grew from `1,166.59` to `1,275.27 MB` with 23,772 page-ins while frontmost. | high |
| Current web weather path | `NativeBoneyardWeather.plan`, `NativeBoneyardWeatherView.update`, mode-2 physical diagnostics | Each display frame maps roughly 900 persistent actors into new plans, nested points, and arrays, then rewrites immutable sprite properties. The fixed-tick state itself is already persistent and exact. | high |
| Native visual-page owner | retail SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; `native-asset-system.md`; `Clothes` builder `0x004E4CA0`, page acquire `0x00413030`, release `0x00413760` | All 3,724 Clothes records share one `2048x1024` RGBA page: `8 MiB` decoded. Bundle refcount `+0x1C` retains that page once for all live consumers. | high |
| Current browser player art | 79 `player-character-*.png` files consumed by `playerWorldAssetSources`; exact PNG dimension census | The extracted padded sheets total `891,978,124` decoded bytes (`850.66 MiB`): `788.47 MiB` living and `62.19 MiB` death art. Staff sheets alone are `370.43 MiB`, robes `357.19 MiB`. | high |
| Compact-frame census | all 7,723 logical frames in those exact extracted outputs; transparent trim and byte-identity deduplication | 1,949 cells are empty. The 5,338 unique nonempty trimmed frames contain about `27.40 MiB` RGBA pixels and fit in two `2048x2048` pages with transparent gutters. | high |

The earlier `08:31` Jetsam report named Twitter as its largest process and is
not attributed to this game. The decisive game evidence is the contemporaneous
WebContent CPU resource report and live DVT footprint above.

## System boundary and membership inventory

Native systems: Arena-local weather actors from fixed-tick creation through
pooled draw/retirement, and visual bundle page acquisition from the first live
wizard consumer through final scene release. Browser adaptation may repack
exact pixels, but cannot expand one native page into per-logical-cell decoded
residency or rebuild persistent actors every display frame.

| Member | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Clear weather mode 0 | Arena `environmentMode=0` | verified-already-at-parity | zero visitors/views and unchanged RNG |
| Rain mode 1 | `0x00468E50`, three drops/tick | exact-ported | persistent visitor counts and exact plan differential |
| Enhanced storm mode 2 | `0x00468E50`, 20 drops/tick | exact-ported | physical 500-600 drop / splash population without per-frame plan allocation |
| `Anim_WeatherRaindrop` state, light cache, retirement | ctor/tick/draw `0x00454B60/0x00454C00/0x00459B60` | exact-ported | fixed-tick state and allocation-free renderer visitor agree with diagnostic plan |
| `Anim_FadeScale` splash state | Arena manager `+0x2C4`, `DeadHawg:24` | exact-ported | persistent scale/life/alpha visitor and splash-before-streak order |
| Rainfall loop/audio attenuation | `sounds\\rainfall__loop`, Arena `+0x8E48` | verified-already-at-parity | audio owner remains independent of visual optimization |
| Diagnostic weather plan | no native duplicate graph; browser oracle | out-of-system — retained only for tests/debug snapshots | production renderer source cannot call `plan()` |
| Clothes base page and 3,724 record membership | builder `0x004E4CA0`, `Clothes.png` | exact-ported through compact browser page-set adaptation | every current logical frame reconstructs pixel-identically from at most two 2048 pages |
| Five elemental body/head/death families | Clothes record banks and runtime palette tints | exact-ported | all 5 variants and every heading/pose/death frame |
| Four hat, three robe, six staff, and wand families | Clothes authored selectors 0..3 / 0..2 / 0..5 / wand | exact-ported | every selector, primary/secondary layer, attachment depth pass and empty cell |
| Fixed robe and death equipment layers | Clothes fixed/death banks | exact-ported | all primary/secondary/facing/frame branches and special hat frame |
| Hub open participant/equipment membership | bundle refcount owner; shared Website Hub extension | exact-ported availability | arbitrary joining player/config uses the already-resident compact pages |
| Boneyard fixed party membership | Arena player actors | exact-ported availability | all party variants survive Hub-to-run transition without re-expanded sheets |
| Title/Create/other scenes | separate native owners | verified-already-at-parity | compact player pages remain absent outside Hub/Boneyard |
| Final renderer teardown | bundle release `0x00413760` -> page release `0x00420760` | exact-ported | derived frames then both base pages destroyed; image-promise entries absent |
| Device loss/restoration | native persistent-slot restoration vs WebGL context recovery | out-of-system — existing Pixi/WebGL owner unchanged | no new context-loss fallback or CPU copy |

No authored member is omitted and no new native address or record is claimed;
the reusable native truth already lives in `native-asset-system.md` and the
class/content catalogs, so the Mod Loader documents remain unchanged.

## Native ownership and recovered behavioral contract

- Weather actors are constructed once, mutated on the 100 Hz presentation
  tick, drawn by two persistent managers, and retired. A display sample may
  visit those owners but does not create a second actor/point/plan graph.
- Clothes is positional record ABI over one reference-counted image page. All
  actor and equipment variants remain immediately addressable while the bundle
  is resident; availability does not require 79 separately decoded logical
  canvases.
- Browser-packed pages may trim transparent padding and deduplicate identical
  pixel rectangles. Each derived Pixi texture must restore the exact logical
  `orig` and `trim`, preserve transparent/empty cells, filter gutters, frame
  order, tinting, anchors and painter depth, and keep page dimensions within
  the conservative 2048 limit.
- Hub and Boneyard share the representation contract but own independent page
  lifetimes. Transition barriers still load before input, and renderer teardown
  destroys every derived texture before the base pages.

## Web implementation consequence

- Add a deterministic player-atlas packer and generated compact pages/manifest
  from the exact current extracted player pixels. Replace runtime imports of the
  79 padded sheets with those page sources and manifest-derived frame textures.
- Keep all elements/equipment/death variants available; do not substitute
  current-loadout-only loading, reduced resolution, missing animations, or a
  mobile quality switch.
- Add allocation-free weather visitors over persistent state. The Pixi view
  updates only mutable position/scale/alpha/tint fields and initializes labels,
  textures, anchors, rotation and constant tint once when a pooled view grows.
- Retain `plan()` as the parity oracle, but remove it from the display path.
  Protocol, RNG, collision, light caching, spawn counts, audio, render order and
  final pixels remain unchanged.

## Validation contract

- Red contracts: current renderer calls `weather.plan()` and the current player
  source membership decodes `850.66 MiB` across 79 files.
- Weather tests cover modes 0/1/2, visitor/plan equivalence for every drop and
  splash field, high-water pool reuse, immutable setup, and absence of `plan()`
  from production view source.
- Atlas tests cover every sheet/cell, two-page and dimension limits, transparent
  empty cells, complete family/selector membership, logical origin/trim
  reconstruction, frame ordering, teardown, and decoded-page budget at or below
  `32 MiB`.
- Canonical `./scripts/validate.sh` must pass on the exact local and Apple-arm64
  trees. Browser journeys must retain Title, Create, arbitrary Hub equipment,
  Boneyard, death, spells, weather, lighting, return/teardown, and zero errors.
- Rested physical-iPhone A/B uses the same mode-2 population and controlled
  movement/cast path. Acceptance requires materially lower WebContent footprint
  and CPU, frame/timer p95/p99/max reported together, no resource report, and
  no missing/changed pixel or lifecycle member.

## Implementation validation receipt

- `NativeBoneyardWeatherView.update` no longer calls the diagnostic `plan()`.
  It visits the persistent drop/splash state directly, grows bounded Pixi
  pools only when the active high-water count rises, and writes only the
  mutable position, scale, alpha, and tint fields. Splash asset identity,
  anchor, texture, rotation, and constant tint are initialized once. The
  visitor/plan differential covers every exposed primitive and the split
  splash-before-light/streak-after-light ownership remains intact.
- `pack-player-character-atlas.py` reconstructs all 7,723 logical frames from
  the 79 extracted source sheets, preserves all 1,949 transparent cells, and
  packs the 5,338 unique nonempty rectangles into two `2048x2048` pages. Those
  pages are `32 MiB` decoded instead of `850.66 MiB`. Pixi textures restore the
  exact logical origin/trim, and the Hub actor, ally chip, portrait, inventory
  preview, Hall of Fame, Boneyard actor, equipment, and death consumers all use
  the shared page set. The production build emits exactly those two
  `player-character-atlas-*` assets and none of the 79 padded sheets.
- The packer reconstructs every source cell byte-for-byte on Linux and macOS.
  `--check` compares committed page dimensions and RGBA pixels rather than PNG
  compressor bytes, because Pillow/zlib encoding differs across the two
  supported hosts while the decoded page is identical. The generated TypeScript
  manifest remains byte-exact. Focused renderer/atlas tests pass `28/28` on
  both hosts.
- The exact Apple-arm64 tree `2d07a872`, rebased on `origin/main` `43a0454a`,
  passes `./scripts/validate.sh`: 15 Website/backend contracts, frontend lint
  and game boundaries, 1,305 broad Boneyard/runtime tests, 21
  inventory/tooltip tests, desktop tests, production build, game bundle budget,
  and media policy. The only output is the repository's eight existing Fast
  Refresh warnings and Vite's non-fatal large-chunk advisory. A saturated
  concurrent pass timed out the existing shared-Hub chat test; that test passed
  unchanged in `0.91 s` in isolation and the load-controlled canonical rerun
  passed, so no timeout or production behavior was changed. The corrected mobile
  journey also passes Title, Hub input/lifecycle, Hub combat exclusion, Boneyard
  transition teardown, simultaneous Boneyard movement/casting, settings scaling,
  portrait handling, and empty browser error arrays.
- Physical fixed Title (`896x364`, DPR 2) held `59.92` FPS for `71.01 s` with
  frame p95/p99 `17/18 ms`, `56 ms` maximum, zero gaps above `100 ms`, and
  empty error/Long Task arrays. WebContent was `219 MB`; WebKit GPU was
  `31 MB`.
- Physical fixed Hub held `59.97` FPS for `82.55 s` while traversing `3,841`
  world units and rendering up to 18 students. Frame p95/p99 was `18/19 ms`,
  maximum `74 ms`, and there was no gap above `100 ms` or browser error.
  WebContent was `385 MB` at a sampled `32.31%` CPU; WebKit GPU was `36 MB` at
  `15.13%`.
- Physical fixed mode-2 Boneyard held `59.79` FPS for `107.71 s` across
  `9,643` world units and 18 real input-path cast pulses. The run reached 593
  drops, 319 splashes, 638 residents, 115 visible residents, 52 primary
  presentations, and 28 complex-shadow casters/105 quads. Frame p95/p99 was
  `17/19 ms`, maximum `184 ms`, with five gaps above `34 ms`, two above
  `50 ms`, and one above `100 ms`; the independent timer p95/p99 was
  `30/31 ms`, maximum `86 ms`. Error and Long Task arrays were empty.
- The same tab then remained idle in mode 2 for `79.80 s` at `59.96` FPS with
  frame p95/p99 `17/18 ms`, `47 ms` maximum, no gap above `50 ms`, and timer
  p95/p99/max `30/31/47 ms`. This directly closes the pre-fix late-idle
  degradation (`22.63` FPS, p95/p99 `118/253 ms`, `920 ms` maximum).
  WebContent was `816 MB` after entry, `883 MB` after the active run, and fell
  to `830 MB` after the idle restoration, versus the pre-fix `1,269-1,275 MB`.
  The sampled active WebContent CPU was `38.01%` versus pre-fix `70.35%`.
- After the Building-roof renderer landed on `main`, the final merged physical
  tree repeated mode 2 for `90.80 s` with `4,034` world units and 16 cast
  pulses: `59.96` FPS, frame p95/p99/max `17/18/48 ms`, timer p95/p99/max
  `30/31/46 ms`, no gap above `50 ms`, and empty error/Long Task arrays. It
  reached 588 drops/321 splashes/104 visible residents; this generated arena
  contains zero Building residents, so the upstream Building browser receipt
  remains the direct proof for that separate surface shader. WebContent was
  `828 MB` at sampled `32.82%` CPU and WebKit GPU was `85 MB`; no new CPU or
  Jetsam report appeared.
- The same Safari/WebContent process stayed alive through Title, Hub, active
  Boneyard, and restoration without a navigation reload. After the complete
  run, the device still listed only the pre-fix `11:15:46` WebContent CPU
  resource report and the unrelated `08:31` Twitter Jetsam event; no new CPU,
  jetsam, page, transport, or renderer failure was generated.
