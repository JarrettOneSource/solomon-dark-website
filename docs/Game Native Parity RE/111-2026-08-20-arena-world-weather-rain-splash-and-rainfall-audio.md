# 2026-08-20 — Arena world weather: rain, splash, and rainfall audio

## Boundary and evidence

The right-click Storm/Acid rain actors are a separate closed system. The stock
Arena world-weather owner is `0x00468E50`, called from Arena tick `0x0046E570`,
and consumes serialized `environmentMode` byte `+518` / Arena `+0x8F20`.
The retail class census identifies `Anim_WeatherRaindrop` at vtable
`0x00785180`, constructor `0x00454B60`, tick `0x00454C00`, and draw
`0x00459B60`. Clean-stock executable identity is SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`.

| Member | Native contract | Disposition |
| --- | --- | --- |
| Clear mode 0 | no world drops, splashes, or rainfall request | exact-ported |
| Rainy mode 1 | 3 procedural drops per Arena tick | exact-ported |
| Stormy mode 2 | 10 drops, or 20 with Enhanced Effects | exact-ported with the existing enabled browser effect configuration |
| World streak | `20 + RandomFloat(10)`, width 1, cached world-light gradient, floor retirement | exact-ported after the 2026-08-22 render-boundary reopen |
| Spawn validity | visible-camera samples rejected only by `FUN_005238C0` with native radius 4; retry is unbounded | corrected after audit |
| Splash child | additive `Anim_FadeScale` with `DeadHawg:24` (`DAT_00819994 + 0x1298`), `life=0.75..1`, scaled loss, scaled growth, and pre-light-composite painter ownership | correction in the 2026-08-22 additive-painter reopen below |
| Complex Lighting on | splash manager, early Region light multiply, shared queue, then analytically lit streak manager | exact-ported after the 2026-08-22 render-boundary reopen |
| Complex Lighting off | white analytic tint, splash and streak managers, then the late Region light multiply | exact-ported after the 2026-08-22 render-boundary reopen |
| Ambient audio | shared `sounds\\rainfall__loop`, mode gain `0.4/1` times `1 - Arena+0x8E48` | corrected after audit |
| Mode-1/2 compact scenery 25..28 | serialized authored rows already use the shared compact pass | verified-already-at-parity |
| Snowy/Foggy labels, Hub/title scenes | not reachable from Boneyard's stock 0..2 authoring path | out-of-system |

Weather drops/splashes are peer-local presentation state. They do not enter
the protocol, collision actors, lighting sources, or the secondary-ability
actor list. The Arena resets its local `NativeRng` at `Arena+0x90` on every
tick from `MyApp+0x28 * 0xEF3` before the weather call; the browser does the
same from the presentation tick rather than deriving a run seed. The owner
samples the carried camera bounds, uses collision-only placement, caches the
drop's light scalar on its first draw, and submits the splash manager before
the streak manager with the Region light-composite boundary between them when
Complex Lighting is enabled.

## Re-check correction — 2026-08-20

The first web pass was not yet a stock-equivalent receipt. A fresh read-only
retail trace against the SHA above closed the whole world-weather membership:

- `CPU::Tick` `0x00427800` increments the owner age at `+0x28` before Arena
  tick, so `0x00468E50` begins on age 2, not immediately. `0x0046E570` derives
  `{left, top, width, height}` at `+0x8BCC..+0x8BD8` from the visible camera
  rectangle and calls the owner after that update.
- `0x0046E570` resets `Arena+0x90` through `0x00401120(MyApp+0x28 * 0xEF3)`;
  `0x00401310` then supplies the weather draw stream. This replaces the
  incorrect private run-seed model.
- `0x00468E50` uses a `do { sample } while (0x005238C0(..., radius=4, 0, 0))`
  loop. `0x005238C0` tests collision shapes only; an added web arena-boundary
  clearance and an invented retry cap were both wrong.
- `Anim_WeatherRaindrop` is constructed at `0x00454B60`, advances by its
  `20..30` length at `0x00454C00`, and retires only once `height > 0`. Its
  `0x00459B60` light query is a one-time cache, then draws alpha `0 -> 0.5`.
- The sibling `Anim_FadeScale` starts at scale `0.5..0.75`, alpha `0.75..1`,
  loss `(0.05..0.10) * factor`, and growth `1 + factor * 0.01`, where
  `factor=0.75..1`. The former half-life and fixed growth were wrong.
- Arena render submits splash manager `+0x2C4` at `0x0046F6C0` before the
  streak manager `+0x1E0` at `0x0046FFB7`; the web containers must preserve
  that order. `GameOver::Tick` `0x005CF4F0` writes `Arena+0x8E48` only during
  its 400-tick exit at `0.0025/tick`, and `0x00468E50` uses that field only to
  attenuate the rainfall request.

This correction intentionally keeps the right-click rain actor family outside
the world-weather owner: its native constructors, collision, damage, and local
effects remain a separate system.

## Renderer ownership and performance follow-up — 2026-08-20

The corrected fixed-tick model predicts a steady enhanced-storm population of
roughly 500–600 live streaks at the stock viewport. The first web painter gave
each streak a separate Pixi `Graphics` owner and `FillGradient`, then cleared
and rebuilt every path on every display frame. Those hundreds of heavyweight
display objects are not native ownership: stock submits the streak family as
one procedural primitive lane through manager `Arena+0x1E0`.

The web renderer therefore owns one shared vertical alpha-ramp texture and one
Pixi particle container for the complete streak lane. Each lightweight
particle preserves the recovered one-pixel width, `20..30` length, cached
grayscale light tint, `0 -> 0.5` endpoint alpha, world position, and manager
order. DeadHawg:24 splashes remain ordinary pooled sprites in the earlier
`Arena+0x2C4` lane. This changes no weather state, RNG consumption, timing,
collision, or asset membership; it removes per-streak gradient allocation and
collapses the streak lane to one batched render owner.

Performance acceptance must report the live drop/splash population together
with frame-gap p95, p99, and maximum, long tasks, and browser errors. Average
FPS alone is not a completion receipt.

## Render-boundary reopen and correction — 2026-08-22

### Reported smell and parity question

- Reported web behavior: rain looked plausible, but its circular ground
  splashes remained visible across completely dark/non-lit map regions.
- Stock behavior to recover: the complete splash, light-composite, shared
  queue, and streak painter boundary under both Complex Lighting settings.
- Reproduction: production `/game`, deterministic mode-2 Boneyard, 1600x900,
  Complex Lighting on; compare zero-light map pixels around the lit player.
- Falsifier: if `Anim_FadeScale` sampled the same analytic scalar as the streak
  or both managers lay on the same side of every light composite, separate web
  roots would be unnecessary.

This is a secondary report in an already-covered system. The 2026-08-20 pass
recorded only the relative splash-before-streak order and then put both under
one late Pixi parent. It did not inventory the intervening Region light-map
composite or the alternate Complex-Lighting-off location, so the prior
`corrected after audit` disposition for the splash painter was wrong.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Instructions | retail `Arena::Render 0x0046EC80`, sites `0x0046F6C0`, `0x0046FAFF`, `0x0046FDAF`, `0x0046FFB7`, `0x00470107` | splash, early multiply, shared queue, streak, and alternate late multiply are five distinct ordered phases | high |
| Instructions | `Anim_FadeScale::Draw 0x00455DF0`; `Anim_WeatherRaindrop::Draw 0x00459B60`; Region query `0x0057E490` | splash has no analytic query and relies on raster placement; streak caches analytic RGB because it follows the early multiply | high |
| Static setting | `Game.ComplexLighting` byte `0x00B3BCA8` | on selects the early multiply; off forces common scalar white and selects the late multiply after weather | high |
| Current web | `native-boneyard-weather-view.ts`, `boneyard-world-renderer.ts` at deployed `762b6067500d277fd1264c5c38eb1f2acf001744` and then-current main | one parent put both lanes at `foregroundZIndex+0.5`; splashes forced tint `0xffffff` | high |
| Browser | production private-session mode-2 capture `/tmp/solomon-rain-review-production.png` | Complex Lighting `true`, 568 drops, 304 splashes, light scalar range `0..1`; streaks vanished in black regions while white splash rings remained globally visible; zero page/console errors | high |

The executable is the preserved 4,723,200-byte retail image, preferred base
`0x00400000`, SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`.
No injected process or stale ASLR address supports this conclusion.

### System boundary and membership inventory

Native system: Arena world-weather presentation from `0x00468E50` allocation
through both local animation managers, Region lighting branches, rainfall
renewal, and Arena teardown. Right-click Storm/Acid Rain remains separate.

| Member | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| Clear mode 0 | `Arena+0x8F20 == 0` | verified-already-at-parity | no drops, splashes, or rainfall request |
| Rainy mode 1 | `0x00468E50`, count 3 | exact-ported | same shared split painter path at rainy density |
| Stormy mode 2, Enhanced Effects off/on | `0x00468E50`, count 10/20, `0x00B3BCAD` | exact-ported | both density branches use the same split painter path |
| Splash construction, recurrence, asset, and retirement | `0x00452E20`, `0x00452ED0`, `DeadHawg:24` | verified-already-at-parity | existing fixed-tick assertions remain unchanged |
| Splash painter, Complex Lighting on | `0x00455DF0`, manager `+0x2C4` at `0x0046F6C0`, multiply `0x0046FAFF` | exact-ported | pre-composite root and render-order contract |
| Streak painter, Complex Lighting on | `0x00459B60`, manager `+0x1E0` at `0x0046FFB7` | verified-already-at-parity | cached analytic tint plus particle alpha ramp |
| Splash and streak, Complex Lighting off | late multiply `0x00470107` | exact-ported | both roots precede the late Region composite; streak analytic tint is white |
| Rainfall loop and Game Over attenuation | `0x00468E50`, `0x005CF4F0`, `0x0081CBF0` | verified-already-at-parity | existing audio and lifecycle tests |
| Arena replacement/destruction | both local managers and rainfall renewal | exact-ported | both roots share one weather owner and teardown |
| Right-click StormCloud/AcidRain children | `0x006021A0`, `0x00604E90` | out-of-system (secondary-ability-owned rain family) | separate actor, damage, audio, and renderer contracts |
| Snowy/Foggy and non-Arena scenes | unreachable Boneyard authoring labels | out-of-system (no stock owner path) | existing authored-mode census |

There is no unextracted authored row and no browser-blocked member.

### Recovered contract and web consequence

With Complex Lighting on, stock draws the unlit `DeadHawg:24` splash into the
pre-main framebuffer, multiplies that framebuffer by the Region raster field,
flushes the shared world queue, then draws the streak with its cached analytic
scalar. With Complex Lighting off, analytic tint is white and the Region
multiply moves after the streak, so both weather families are raster-darkened.

The web owner must therefore expose two independent roots. The splash root
belongs immediately before the Region composite; the batched streak root stays
in the late weather lane. The settings owner must position the Region
composite between those roots when enabled and after both when disabled. A
splash scalar tint, spawn rejection, mask approximation, or one-parent z-order
nudge would not reproduce both native branches.

### Validation contract

- A render-contract regression must reject a shared splash/streak parent,
  assert distinct roots, and prove the on/off composite ordering.
- Focused weather tests must retain all mode, RNG, collision, recurrence,
  cached-streak-light, audio, and teardown assertions.
- A real mode-2 WebGL journey with Complex Lighting on must find visible
  splashes inside the light field and no visible splash contribution in a
  sampled zero-light region, while streak counts, splash counts, asset,
  rainfall owner/gain, and browser-error receipts remain valid.
- The same journey with Complex Lighting off must prove the Region composite
  is after both weather roots. The Website canonical gate remains mandatory.

### Implementation validation receipt

- `native-boneyard-weather-view.ts` now owns independent splash and streak
  roots; `boneyard-lighting.ts` owns their shared on/off composite-order
  contract; `boneyard-world-renderer.ts` applies and publishes that order.
- The canonical `./scripts/validate.sh` gate exited zero. Its Boneyard suite
  passed 1,285 tests including the two new painter-boundary contracts, the
  newly canonical weather suite passed all eight tests, production build and
  bundle budgets passed, and media policy passed. Exact-tree
  `./scripts/validate.sh lint` also exited zero with only the repository's
  existing Fast Refresh warnings.
- Built-preview Chromium mode 2 produced 575 live streaks and 305 splashes,
  light scalar range `0..1`, rainfall gain `1`, `DeadHawg:24`, the particle
  batch, and zero page/console errors. Complex Lighting on reported exact
  order `0.25 < 0.5 < 11.5`; after the in-game setting toggle, the flattened
  branch reported `0.25 < 11.5 < 11.75`. Screenshot:
  `/tmp/solomon-rain-light-boundary-fixed-linux.png`.
- The before/after pixel comparison shows the globally bright splash field is
  gone: the rings remain visible inside the Region light and contribute no
  visible pixels across the surrounding black field. No member is
  browser-blocked and no unknown remains in the corrected boundary.

## Additive-painter reopen — 2026-08-22

### Reported smell and parity question

- Reported web behavior: rain ground splashes/puddles are black. A fresh built
  preview mode-2 capture reproduces a dark `DeadHawg:24` ring inside the
  player's partially lit terrain at `/tmp/solomon-rain-puddle-black-before.png`.
- Stock behavior to recover: the complete `Anim_FadeScale` painter state, its
  interaction with both Region-composite branches, and every sibling producer
  that installs the same concrete vtable.
- Falsifier: if `Anim_FadeScale::Draw` retained ordinary source-over blending,
  the current Pixi default would be correct and another light-boundary fact
  would have to explain the black ring.

This is a third report in the Arena-weather system. The earlier passes recovered
the splash asset, lifecycle, and position relative to the Region multiply, but
described only its RGB/alpha setup. They did not trace the renderer-state byte
written immediately before the sprite draw. The previous browser receipt then
accepted z-index metadata and disappearance in zero-light pixels without
asserting the splash's color or blend inside a nonzero light field.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Instructions | retail `Anim_FadeScale::Draw 0x00455DF0` | writes renderer blend byte `1`, flushes that state, draws the transformed sprite, restores white, then restores blend byte `0` | high |
| Instructions | renderer dispatcher `0x004208A0` | blend byte `1` writes Direct3D render states `SRCBLEND=5 (SRCALPHA)` and `DESTBLEND=2 (ONE)`: alpha-weighted additive composition | high |
| Instructions/data | vtable `0x00785A84`; class catalog and exact constructors `0x00468E50`, `0x0047F8D0`, `0x0050B390`, `0x005F7010`, `0x005FB020`, `0x00644A00`, `0x00645B50`, `0x00648790` | eight producers install this one shared additive painter; the associated records are fully enumerated below | high |
| Current web | `native-boneyard-weather-view.ts` at `origin/main d2ed2c31` | pooled splash sprites never set `blendMode`, leaving Pixi's inherited/default path instead of the native additive path | high |
| Browser | built preview, Chromium, 1600x900, mode 2, Complex Lighting on | 561 streaks, 305 splashes, light scalar range `0..1`, exact split order `0.25 < 0.5 < 11.5`, zero page/console errors, but a dark ring remains in the partially lit field | high |

The instruction evidence uses the preserved 4,723,200-byte retail executable,
preferred base `0x00400000`, SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`.
The read-only Ghidra queries used static addresses; no injected process, PID,
or ASLR mapping is involved. The reusable native fact is also recorded in Mod
Loader `docs/reverse-engineering/native-world-weather.md` and the affected
projectile/equipment/enemy reports.

### System boundary and membership inventory

Native system: Arena world-weather presentation plus the complete concrete
`Anim_FadeScale` vtable membership falsified by the missing blend-state trace.
Perspective, additive-perspective, and clipped FadeScale variants use distinct
vtables and are outside this shared-class boundary.

| Member | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| Arena rain/storm splash, all density branches | `0x00468E50`, `DeadHawg[24]` | `exact-ported` | immutable pooled-sprite additive blend contract plus Linux and Mac mode-2 Chrome receipts |
| Wraith dissolve core | `0x0047F8D0`, `BadGuys[20]` | `exact-ported` | host death-effect assertion pins record 20 and additive blend |
| Courtyard fountain transient | `0x0050B390`, `College[38]` | `exact-ported` | Hub renderer contract pins additive blend on pooled sprite creation |
| Tragic Circle player pulse | `0x005F7010`, `BadGuys[7]` | `verified-already-at-parity` | shared record-7 presentation plan was already explicitly additive |
| Magic Circle player pulse | `0x005FB020`, `BadGuys[7]` | `verified-already-at-parity` | Magic Circle presentation assertion retains the additive player pulse |
| Teleport source/destination | `0x00644A00`, `BadGuys[90]` | `verified-already-at-parity` | both source and destination remain pinned to additive blend |
| Mindblast rings | `0x00645B50`, three `Clothes[2]` actors | `exact-ported` | all three independent recurrence rows now assert additive blend |
| Explosive Shield ring | `0x00648790`, `DeadHawg[2]` | `exact-ported` | four-layer burst assertion pins only the ring additive and keeps the separate `BadGuys[15]` `Anim_Fade` source-over |

All vtable-install xrefs and associated authored records are dispositioned in
this inventory. Right-click Storm/Acid raindrop ground sprites do not install
`Anim_FadeScale` and retain their separately recovered tinted painter programs.
There is no browser-blocked member and no unextracted table row.

### Native ownership and recovered contract

`Anim_FadeScale` owns scale, recurrence, RGBA, sprite pointer, and lifetime.
Its vtable slot `+0x0C` is the painter `0x00455DF0`; therefore additive blend
is class behavior, not a weather special case. The Arena keeps the splash in
manager `+0x2C4`. Complex Lighting on still paints that manager, then multiplies
the framebuffer at `0x0046FAFA`, flushes the shared queue, and paints the
analytically tinted streak manager. Complex Lighting off still moves the same
multiply after both weather families. The new fact changes neither root order,
RNG, collision, alpha, scale, asset, audio, authority, nor teardown.

### Web implementation consequence and validation contract

- Set the weather splash sprite's immutable blend to `add` when its pooled view
  is created; do not tint it analytically or move it across the Region boundary.
- Replace the same falsified default/normal assumption for the Courtyard
  fountain, three Mindblast rings, Explosive Shield ring, and Wraith record.
  Preserve the three already-additive members and every unrelated sibling pass.
- Focused regressions must assert every inventory row: source-level immutable
  blend for both pooled sprite owners, exact Wraith record 20, all three
  Mindblast ring blends, the Explosive Shield ring blend, and unchanged
  Circle/Teleport additive draws.
- The browser weather journey must handle the local-cheats confirmation, retain
  modes 1/2 and both Complex Lighting orders, and inspect a real splash inside
  the nonzero Region field rather than accepting counts/z-index alone. The
  exact tree must then pass `./scripts/validate.sh`.

### Implementation validation receipt

- `NativeBoneyardWeatherView` and `HubWorldScene` set `blendMode='add'` once
  when growing their pooled FadeScale sprites. Secondary presentation marks
  only the three Mindblast rings and Explosive Shield ring additive, and the
  Wraith death owner now selects exact `BadGuys[20]`. No weather state, RNG,
  light sampling, root order, audio, collision, authority, or teardown changed.
- The new contracts first failed on both secondary blend families. After the
  correction, the complete Boneyard suite passed `1,326/1,326`, including the
  weather/fountain source owners and Wraith record assertion; the separately
  canonical weather suite passed `9/9` and retained modes 0/1/2, Enhanced
  Effects density, RNG, collision, recurrence, light caching, audio, and
  retirement.
- Exact rebased Website base `d8c9d14769210d7f8ae3ae321ced1245c79bd688`
  passed `./scripts/validate.sh` on the Mac mini (`macOS 26.6.2`, Apple
  hardware): backend build/contracts, lint/import boundaries, all frontend and
  desktop suites, production build, game-bundle budget, and media policy. The
  candidate tree is
  `/Users/jarrett/codex-acceptance/rain-puddle-additive-rebased-20260822.FYy8bR`;
  checksum dry-run confirmed its eleven changed Website files match this tree.
- Mac hardware Chrome mode 2 produced 560 streaks and 305 additive splashes,
  light scalar range `0..1`, rainfall gain `1`, `DeadHawg:24`, and empty
  page/console error arrays. Complex Lighting on retained
  `0.25 < 0.5 < 11.5`; the in-game off toggle retained
  `0.25 < 11.5 < 11.75`. The image visibly shows gray-white rings in the
  nonzero light field instead of the reproduced black mark:
  `/tmp/solomon-rain-puddle-additive-mac-20260822.png`, SHA-256
  `f6a5ba1ec09ac767aaa41da178f34c58041cad12e9c74d4d4b793201c3b61cb6`.
- Linux built-preview acceptance independently passed with 570 streaks, 306
  additive splashes, both lighting orders, rainfall gain one, and no browser
  errors. Before/after artifacts are
  `/tmp/solomon-rain-puddle-black-before.png` and
  `/tmp/solomon-rain-puddle-additive-after.png`.
- Every shared-class row is dispositioned above. There is no browser-blocked
  member, approximation, or remaining unknown in this reopened painter
  boundary. Validation processes were task-owned and stopped afterward.

## Same-frame pixel and sampler reopen — 2026-08-24

The published additive correction was reopened after the puddles were again
reported as black. The prior receipt asserted blend metadata and visually
compared different simulation frames; it never proved whether enabling a real
splash subtracts RGB from the same frozen framebuffer. It also attributed the
black-looking mark to source-over blending, although the retail record is white
and neither white source-over nor white additive composition can darken its
destination. That causal claim is withdrawn.

Fresh read-only instruction and asset checks close the nearby alternatives:

- Renderer reset `0x0041D000` uses Direct3D sampler states `6/5` with value `2`
  (`MINFILTER/MAGFILTER = LINEAR`) when render ratios
  `0x00818670/0x00818674` are both one. Both retail data values are `1.0`, and
  `0x00440890` derives them as target/backbuffer ratios. This is the stock
  1600-by-900 parity branch. `Anim_FadeScale::Draw 0x00455DF0` does not change
  filtering, so Pixi's inherited linear scale mode is correct for the reported
  comparison.
- Renderer byte `+0x239` is texture addressing, not filtering: state one calls
  `0x00442ED0` and writes sampler states `1/2` (`ADDRESSU/ADDRESSV`) to wrap.
  Misidentifying those enum slots as min/mag filtering would create an invalid
  nearest-sampling fix; no such change is permitted.
- Retail `images/DeadHawg.png` record 24 and web `deadhawg/024.png` decode to
  identical 20-by-17 RGBA pixels. The record has 110 fully transparent pixels,
  230 contributing pixels, maximum alpha 95/255, and a fully transparent black
  centre. A dark centre and a low-luminance rim in dim Region light are authored
  stock inputs, not evidence that the ring subtracts from the ground.
- The concrete `Anim_FadeScale` vtable still has exactly ten install references
  from the eight producers enumerated above. No blend, record, alpha, scale,
  recurrence, light-order, authority, audio, or teardown fact changed.

The system boundary remains the eight-member `Anim_FadeScale` painter family
plus Arena's two Complex Lighting branches. Every member retains its disposition
from the additive census above. Native texture-addressing and non-1x filter
branches are durable renderer findings but do not alter the 1x weather result.

The decisive validation is a Mac WebGL same-frame differential: synchronously
render one frozen frame with and without the current linear/additive splash
lane. Both Complex Lighting orders must show positive splash contribution and
zero negative RGB channels; absolute changed-pixel luminance must be reported
so transparent/dim authored pixels are not mislabeled as subtractive black. No
production rendering change is justified unless that measurement falsifies
the recovered model.

### Implementation validation receipt

- No production painter change is required. The current pooled sprite is
  additive, its source is linear-filtered like the stock 1x branch, and the
  exact retail crop/alpha, fixed-tick recurrence, and Region order remain in
  place. The actual defect was the acceptance gap: the prior smoke checked a
  blend label and visually compared different simulation frames.
- A development-only `__sdrWeatherSplashPixelProbe` now freezes the current
  Pixi display state and renders it synchronously with the splash root enabled
  and suppressed. Production builds tree-shake the probe behind
  `import.meta.env.DEV`. The weather smoke handles the current Tutorial and
  local-play prompts, stubs only the development deployment manifest, and
  fails on page errors, console errors, failed responses, a non-additive
  runtime blend, non-linear sampling, or any negative RGB contribution.
- Exact-current Mac base `7a352805dc81d75cea002c892082486eaab6ea32`
  passed 31 focused Boneyard renderer contracts, all 9 weather tests, and the
  complete `./scripts/validate.sh` gate including backend, lint/import
  boundaries, all frontend/desktop suites, production build, bundle budget,
  and media policy. The matching Mod Loader static RE suite passed 499/499.
- Mac hardware Chrome mode 2 measured 571 live streaks and 305 splashes with
  `DeadHawg:24`, additive blend, linear sampling, rainfall gain one, light
  scalar range `0..1`, and empty page/console/failed-response arrays. With
  Complex Lighting on, splashes changed and brightened 9,901 pixels, raised
  their average luminance from `30.494` to `37.491`, and produced zero
  darkened pixels and zero negative RGB channels. With Complex Lighting off,
  they changed and brightened 13,676 pixels, raised average luminance from
  `26.778` to `33.286`, and again produced zero darkened pixels and zero
  negative channels. Screenshot
  `/tmp/solomon-rain-puddle-current-main-20260824.png` has SHA-256
  `973a8427a2a7532da6d86b4d1144d45dd19c24400a7b0a5bdd7a70d7cddbe7e6`.
- The authored transparent centre and low-alpha pixels can remain visually
  dark in low Region light, exactly as the retail asset and compositor
  predict. Brightening or filling that centre would be a stock-parity
  regression, so no such symptom patch was made.

## Implementation and validation receipt

- `core-kernels/native-boneyard-weather.ts` owns the fixed-tick plan and
  private RNG; `renderer/native-boneyard-weather-view.ts` owns pooled Pixi
  streaks/splashes; `boneyard-world-renderer.ts` owns collision, lighting,
  camera bounds, ordering, and teardown; `boneyard-weather-audio.ts` owns the
  distinct `boneyard-weather:rainfall` loop channel; `boneyard-textures.ts`
  preloads exact `DeadHawg:24`.
- `npm run test:world-weather` passed 8 focused tests. `npm run build` passed
  typecheck, Vite, game-host bundling, and the 68,625-byte gzip game bundle
  budget. Lint and architecture boundaries passed with only existing Fast
  Refresh warnings.
- Production-preview Chromium receipt on the rebased tree: mode 2,
  `weatherDropCount=562`, `weatherSplashCount=153`,
  `weatherSplashAsset=DeadHawg:24`, rainfall gain `1`, source
  `rainfall-loop-D9cscZtS.wav`, and empty page/console errors. Screenshot:
  `/tmp/solomon-dark-world-weather-rebased.png`.
- Presentation samples can repeat, regress, or be fractional; the local
  owner floors and ignores non-forward samples without mutating authority.
