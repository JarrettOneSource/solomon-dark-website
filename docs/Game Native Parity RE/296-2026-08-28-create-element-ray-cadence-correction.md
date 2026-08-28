# 2026-08-28 — Create element-fork and ray cadence correction

## Reported smell and parity question

- Reported web behavior: the five primary-element choices in Create show a
  conspicuous three-pronged star. The report allows either a painter-order or
  lighting fault and says the stock effect was absent or materially less
  prominent.
- Complete asset identification: two stock element members can read as a
  three-pronged star. Air uses the fork bank at BadGuys `1836..1839`; record
  `1839` is the obvious Y-shaped frame seen in the built-candidate screenshot.
  Ether and Water separately use common ray record `112`. Neither is Create's
  falling-star field, a glyph highlight, CSS shadow, or light-map contribution.
  Deleting or globally dimming either would damage Staff, projectile, and Weld
  presentations.
- Stock behavior to recover: Create must pass the free-running 100 Hz
  application tick to all five shared element painters. Ether's ray opacity is
  `0.55 * abs(sin(8 * tick degrees))`; Water's independent row is
  `0.55 * abs(sin(11 * tick degrees))`. Air selects one complementary fork pair
  per `floor(tick/8)` bank and advances its opacity stage at `tick%8`; the bank
  therefore lasts `80 ms`, not the web's former `133.3 ms`. Picker scale remains
  `2`, selected-hand scale settles at `6`, and per-operation blend/order stays
  unchanged.
- Falsifiers: the Air fork bank or record `112` is absent from stock Create;
  Create passes a scene-local 60 Hz frame; Ether and Water share one `11`
  multiplier; Air's bank is not eight application ticks; the current WebGL
  layer/asset differs from retail; or Staff/actor consumers use the same
  erroneous scene-local clock.

This reopens the ray-frequency and Create-clock claims in the existing
Create/loadout and Staff-orb entries. The earlier pass copied Water's `11`
multiplier into Ether and introduced a browser-frame conversion even though the
Create call sites load `App+0x28` directly. Those were extractable instruction
facts and must be corrected everywhere that shares them.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | unmodified Beta `0.72.5` `SolomonDark.exe`, preferred base `0x00400000`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` | Canonical sealed program for every preferred address below. | high |
| Fresh Ether instructions | canonical Ghidra 12.0.3 read-only replica; `0x00535A30`; raw ranges `0x00535A88..0x00535A9A`, `0x00535F39..0x00536063`; double `0x007847A8 = 8`, `0x007DE808 = .5`, `0x007847C8 = 50`; float `0x0078567C = .3`; double `0x00785680 = .5500000119` | Each of two Ether passes draws record `112` additively. Alpha uses the precomputed `phase*8`; rotation uses `phase*.5`; scale is `(1+Float(.3))*contextScale`. | high |
| Fresh Water instructions | `0x005370D0`; raw ranges `0x00537312..0x00537482`; double `0x00791438 = 11` | Water draws two independently scaled record-112 rays with ordinary alpha blending. Both reuse `phase*11` for alpha and `phase*.5` for rotation. | high |
| Fresh Air instructions | `0x00536380`, complete raw range through `0x00536C01`; stage split `0x005363B3..0x005363D5`; fork draws `0x005369A9..0x00536BBA` | Air enables additive blending once, selects `stage=tick%8` and hash seed `floor(tick/8)`, draws one `1836..1839` frame and complementary `3-frame`, and uses the recovered sine alpha plus quarter-alpha companion. No z-index or Region-light branch owns the fork. | high |
| Fresh Create call sites | `CreateMenu_Render 0x0059AD40`; Ether call `0x0059B98D`; sibling switch calls through `0x0059B94B..0x0059BAA3` | The renderer executes `FILD dword ptr [0x0081F658]` and passes that value as the element-painter phase. All five element rows share this source. | high |
| Application tick owner | static App object `0x0081F630`; `App+0x28 == 0x0081F658`; base tick `0x00427800`, increment `0x0042781E..0x00427824`; 100 Hz scheduler `0x0040D1B0` | The phase is a free-running 100 Hz application tick. It is not Create elapsed time, requestAnimationFrame cadence, or the gameplay simulation clock. | high |
| Asset/data | retail BadGuys records `110..112`, `1836..1839`; extracted ray `40x40`, SHA-256 `d442af9ee058baceb7df36d682a4663cfd207818572fe77830833ef555802630`; Air strip `220x59`, SHA-256 `113a8dcf8c0efa14a54ad534d9af8f8de6036184be0d640d5aa3ea08db0992a3` | Both three-pronged candidates are exact stock rasters and need no art edit. | high |
| Current web causal trace | Website `0c510ce3`; `create-menu-renderer.ts`, `element-vfx-native.ts`, `native-element-vfx-view.ts` | Create computes `floor(sceneElapsedMs*60/1000)` for all five programs and Ether uses `11`, while the view correctly preserves record, alpha, blend, scale, and painter order. | high |
| Mac baseline | exact Website `0c94685e`, Mac Chrome 151, 1600x900 current Create element frame, SHA-256 `70740e3acc3129680edf926d1786b7c9f18f5ccc1c77a5f313b23ac6243136f9` | The old clock visibly retains element prongs/forks for its slower stages. Empty page/console/failed-response arrays isolate presentation rather than an error fallback. | high |
| Clean-stock observation attempt | task-owned direct retail PID, no loader/proxy process, 2026-08-28 | D3D window captures remained black after focus, so they are rejected as pixel evidence. No visual conclusion depends on them; the process and disposable captures were removed. | high boundary |

Ghidra was invoked only through the read-only replica wrapper from Mod Loader
revision `08bfba9ef367f7b863848030d0a289dc31e33192` (wrapper SHA-256
`b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`).
No Mod Loader file or analyzed project was changed.

## System boundary and membership inventory

Native system: **the shared five-element raster painter from its phase input
through Create picker/held contexts and every sibling consumer of the Air fork
and Ether/Water ray rows**.

| Member / branch | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Ether picker | `0x0059B94B -> 0x00535A30`, scale `2` | `exact-ported` | 100 Hz application tick; two additive rays; `8`-degree alpha phase |
| Fire picker | Create switch -> `0x005360C0`, scale `2` | `exact-ported` clock; painter already exact | frame/pulse advances from the same application tick |
| Air picker | Create switch -> `0x00536380`, scale `2` | `exact-ported` clock; painter already exact | eight-tick/80-ms fork bank, `tick%8` alpha stage, complementary frame |
| Water picker | Create switch -> `0x005370D0`, scale `2` | `exact-ported` | 100 Hz tick; two ordinary rays; `11`-degree alpha phase |
| Earth picker | Create switch -> `0x005374C0`, scale `2` | `exact-ported` clock; painter already exact | ring/frame lane consumes the same application tick |
| selected-hand Ether/Fire/Air/Water/Earth | `0x0059B2F9` and sibling switch, scale `2*selectedScale`, endpoint `6` | `exact-ported` | same free-running tick continues through the phase handoff; no restart |
| common core/spark/ray `110/111/112` and Air forks `1836..1839` | BadGuys registration arrays `+0x46BC/+0x4A2C` | `verified-already-at-parity` | exact dimensions/hashes and per-operation additive/ordinary blend remain unchanged |
| Create glyphs, hand order, highlights, wheel, prompt, flash, falling stars | `0x0059AD40`, separate Create records/state | `out-of-system` (not record-112 phase production) | no geometry, z-index, alpha, or asset change |
| equipped pure Staff rows `8/16/24/32/40` in Hub/Boneyard | `0x00539B80 ->` five painters | `exact-ported` phase source already | authoritative 100 Hz snapshot tick; Ether inherits corrected `8` constant |
| learned/internal Weld rows `1000..1014` | row-52 jump table under `0x00539B80` | `exact-ported` shared subprogram | every Ether overlay inherits corrected phase; other row membership/order unchanged |
| Magic Missile, FadeMM, and other actor-owned Ether compositor callers | direct `0x00535A30` xrefs | `exact-ported` shared formula; actor phase remains owner | corrected Ether constant without substituting Create's clock |
| Hall-of-Fame element orb | Website static presentation counterpart | `verified-already-at-parity` clock | already advances at `HALL_TICK_MS = 10`; shared Ether formula corrected |
| inventory wizard preview | static tick-zero preview | `out-of-system` (authored still preview, no live clock) | retains deterministic tick zero; shared record membership unchanged |
| reduced-motion Create presentation | browser accessibility setting | `out-of-system` (explicit web accessibility behavior) | tick remains frozen only under the existing user preference |

No member is blocked by the browser platform. Browser time cannot reproduce
the retail process-start phase, but `nativeApplicationTick(performance.now())`
already owns the documented bounded substitution: exact rate, continuity, and
non-pausing behavior with an arbitrary initial phase.

## Native ownership thread

- Create owns positions, reveal, picker scale `2`, selected spline, and final
  scale `6`; it does not own a separate element animation clock.
- `App+0x28` is loaded immediately before every Create element-dispatch row.
  It increments once per 10 ms application tick and continues across Create
  entry and the element-to-discipline handoff.
- The five shared painter functions own their texture/pass/alpha/rotation
  programs. Air consumes the four-frame fork bank. Ether and Water both
  consume record `112`, but do not share the alpha multiplier or blend mode.
- `NativeElementVfxView` is the correct shared WebGL consumer. The defect is
  upstream phase/constant production, so changing z-index, texture, global
  opacity, or lighting would leave the model wrong and damage sibling scenes.
- Scene exit destroys the Create views. Staff/actor/Hall owners keep their own
  documented lifetimes and phase sources; they share formulas, not Create
  scene state.

## Recovered behavioral contract

- Timing: normal Create uses `floor(performanceNow/10)` as the web projection
  of `App+0x28`. Element selection does not reset it. Reduced motion keeps the
  existing explicit frozen presentation.
- Ether ray: two additive record-112 draws per painter call; independently
  sampled `(1+Float(.3))*scale`; shared alpha and rotation phases;
  `alpha=.55*abs(sin(8*tick degrees))`,
  `rotation=50*scale*sin(.5*tick degrees)`.
- Water ray: two ordinary record-112 draws; the same independent scale domain
  and half-phase rotation; `alpha=.55*abs(sin(11*tick degrees))`.
- Air fork: one hashed frame and complementary `3-frame`, both additive. The
  selection hash changes every eight application ticks; opacity advances on
  `tick%8`. At 100 Hz the conspicuous Y-shaped selection can persist for at
  most one 80-ms bank, versus 133.3 ms under the refuted 60 Hz conversion.
- Painter order remains each element container's VFX followed by glyph and
  hover-only glyph highlight, with the recovered left-hand/elements/right-hand
  Create ordering unchanged.
- Cosmetic random identity remains the established deterministic semantic
  projection. It must not consume gameplay RNG or add replicated state.

## Nearby-system findings

- The old Ether Magic Missile entry correctly listed `8*phase`; the later
  shared `element-vfx-native.ts` implementation and Create/Staff summary drifted
  to `11`. One raw-instruction pass reconciles those ledgers: Ether is `8`,
  Water is `11`.
- `native-application-tick.ts` already exists for Tutorial pointer blink and
  documents the same native global. Create should reuse it rather than add a
  second 100 Hz conversion.
- Neither the Air fork nor record-112 ray is a light provider or Region-light
  input. No Lantern, Staff light radius, Create background, z-index, or WebGL
  blend-pipeline change follows from this correction.

## Confidence and open questions

- Confirmed: executable identity; complete Air/Ether/Water instruction streams;
  constants; fork/ray assets; pass counts/blends; all five Create call-site
  clock sources; 100 Hz App owner; every shared web consumer; current Mac
  reproduction.
- Confirmed causal result: the 60 Hz conversion stretched Air's eight-tick
  selection bank from native 80 ms to 133.3 ms and slowed every opacity stage.
  The fork exists in stock; its persistence, not membership, was wrong.
- Unknown: the absolute process-start phase, which is already an explicitly
  bounded web substitution and has no effect on cadence, range, membership,
  or gameplay.

## Web implementation consequence

- Replace Create's `sceneElapsedMs*60/1000` VFX phase with a frame field
  produced by `nativeApplicationTick(now)` in `CreateMenuScene`.
- Change only Ether's ray alpha multiplier from `11` to `8`; keep Water at
  `11` and preserve ray assets, alpha maximum, pass count, scale, rotation,
  blend, and painter order.
- Expose the consumed application tick in existing Create diagnostics for a
  real-browser cadence receipt. Do not add a DOM animation or second timer.
- Remove no Air/ray asset and apply no global opacity, z-index, shader,
  lighting, or CSS workaround.

## Validation contract

- Focused contracts: exact Air paired frames/stages, Ether/Water alpha values
  at discriminating ticks, two ray passes/blend modes, all five shared rows,
  application tick
  `0/9.999/10` boundaries; Create source contract consumes the provided
  application tick and contains no `*60/1000` VFX conversion.
- Mac red/green: the supported complete `./scripts/validate.sh` gate must first
  fail on the old Ether/clock seams and then pass on the exact candidate.
- Mac Chrome: reach the settled element picker, sample the diagnostic tick for
  at least one wall-clock second, require approximately 100 ticks/second, and
  capture reviewed Air/Ether/Water frames with empty page, console, and failed-
  response arrays.
- Cross-surface: existing Staff, projectile, Weld, Hall, and inventory tests
  retain operation membership/order while every live Ether consumer receives
  the corrected shared formula.

## Implementation validation receipt

- `CreateMenuScene` now derives one phase with
  `nativeApplicationTick(now)` and supplies it to both picker and selected-hand
  painters. `create-menu-renderer.ts` consumes that field, preserves the
  reduced-motion zero phase, and exposes the exact consumed tick in its
  existing structured diagnostics. The scene-local `*60/1000` VFX clock is
  removed; hand/wheel/reveal clocks remain separate and unchanged.
- `element-vfx-native.ts` changes only Ether record-112 alpha from the
  Water-derived `11` to instruction-derived `8`. Water remains `11`; Air fork
  membership/alpha/blend remains exact. Every shared pure/Weld/Staff/Hall
  consumer inherits the corrected Ether formula without a renderer fork.
- The Mac red tree was byte-identical to the local red tree (binary diff
  SHA-256 `0a2f2ce028314a26f8660cc4092f8b29f4f9643a309ac95ed9bc64eff63119b7`).
  The supported complete gate reached the Boneyard group and failed exactly
  four intended seams: Ether/Water phase, retained-bank clutter, projected
  clutter, and Create application tick (`1668/1672` passed). Red combined-log
  SHA-256 is
  `1f84f7d04bd1f23ef94f742413862bb04ed5f626c7a187ce9a5cb05199ecd06a`.
- The first byte-identical implementation candidate passed the complete Mac
  `/opt/homebrew/bin/bash ./scripts/validate.sh` gate: 28 backend/Website
  contracts, every frontend group including `1672/1672` Boneyard tests, five
  desktop tests, lint/type/generated/boundary checks, production builds, bundle
  budget, and media policy. Gate-log SHA-256 is
  `92908112aeda30345b647a157300b19cd6259894de404e4ae7b532df800ccbfb`;
  production Game entry is `262,344` raw / `79,554` gzip bytes.
- Built Mac Chrome 151 on Apple M2 reached Title, the settled five-element
  picker, and settled Fire discipline with one WebGL canvas and no console/page
  errors. The Create diagnostic advanced `202` application ticks during the
  two-second sample, accepting the 100 Hz contract despite 60 Hz display
  presentation. Element and discipline screenshots are respectively SHA-256
  `dea5d6c791a29ca3fb6ddccbc4f4bf243acd24394e2c08fafa3e80ba99f5c9ed`
  and
  `9e336b667f0c80586bbe0f217906bbdfa206c39bb709da8fba131ea2a080a8c7`.
  The reviewed element frame includes a legitimate Air Y fork: stock
  membership remains, while its bank now advances on the recovered 80-ms
  cadence instead of the former 133.3-ms web dwell.
- The later Air sibling audit added a direct eight-tick/80-ms paired-fork
  contract; it changes no production code beyond the already-corrected shared
  application clock. No VFX asset, opacity maximum, z-index, lighting source,
  shader, or CSS was removed or tuned.
- Absolute process-start phase remains the documented browser substitution.
  There is no other platform-blocked member or material unknown. Publication
  and deployment were not requested and were not performed. The exact
  receipt-complete tree repeats the canonical gate in the task handoff.
