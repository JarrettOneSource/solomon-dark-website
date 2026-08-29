# 2026-08-21 — Local-player HP meter depletion direction audit

> **2026-08-29 reopening:** the 2026-08-21 geometry receipt below proved the
> left clip origin, widths, and painter order, but it did not prove the native
> blend operation or the poisoned-strip asset branch. Its Magic Shield
> `verified-already-at-parity` disposition is superseded by the corrective
> closure in the final section of this file.

## Reported smell and parity question

- Reported Website concern: the local player's red HP meter immediately left
  of the blue mana meter may be losing fill from the wrong end.
- Stock behavior to recover: distinguish the meter's **outer layout anchor**
  from its **current-health fill anchor**. The complete health track and core
  keep their right edges at native `x=750/745` and grow left when maximum HP
  increases, but current HP is a left-clipped `UI.26` strip. Damage therefore
  removes red pixels from the center-facing right end; the remaining red fill
  stays on the far-left end and its live right edge moves left.
- Reproduction states: local player alive in Hub and Boneyard at full, half,
  and near-zero health; default and increased maximum HP; Magic Shield shorter
  and longer than life; local death and return to an alive scene.
- Falsifier: a stock damaged frame with red pixels retained against the
  center-facing right end, or native clip instructions that move the fill's
  left edge while preserving its right edge, would require flipping the web
  implementation.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Native instructions | Clean retail `SolomonDark.exe` SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; fresh read-only Ghidra decompile/disassembly of HUD renderer `0x005D2520`, health block `0x005D2FDD..0x005D3403`, clip setter `0x00420EC0`, repeated strip `0x00415230` | Base/current/maximum are `+0x6C/+0x70/+0x74`; the renderer squares `current/maximum`, applies a clip whose width is `core_width * ratio^2`, and draws `UI.26` from the full core's left origin. | high |
| Clean stock capture | `/mnt/d/codex-evidence/uire-20260806/hud-crops/20260806T115705Z/damaged-health.png` SHA-256 `d5ea1e16a9305befb7b4f583202f8aa0f3ff85340bebc4cf3a1b2a7206b105b5`; `near-death-health.png` SHA-256 `9709208bbec1e2946e3cacb67cfe4bdeb758fcf25b7868b2f1043c4d90d31a3f` | Damaged and near-death red pixels remain against the core's left edge; the empty portion opens on the right. | high |
| Derived-stat capture | Mod Loader `tests/fixtures/webgame/native-derived-hud-goldens.json`, owned retail run `D:\codex-evidence\uire-derived-stats-20260821\live\20260821T155745Z` | Maximum-100 half-current case has core `[620,745]` and visible width about `31.27`; the visible rect begins at `620`, not at `745 - 31.27`. Magic Shield uses the same left origin. | high |
| Current Website | `GameHud.tsx`, `hub.css`, and `native-hud-presentation.ts` at Website `c9600ce1` | The health track is right-anchored, its fill image starts at the core's left inset, and `clip-path: inset(0 <missing>% 0 0)` clips the right side. The squared ratio and dynamic core width already match stock. | high |

## System boundary and membership inventory

Native system: the local-player top-center health meter owned by the ordinary
G9 gameplay HUD, from authoritative local HP/max HP and shield values through
dynamic geometry, clipping, render order, visibility, and teardown. Remote
ally rows, world nameplates, the featured-enemy prefix, mana, and XP have
separate native owners and are not members of this local meter.

| Member (scene/state/branch) | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| Hub local-player health track/core | `0x005D2520`, `0x005D2FDD..0x005D3403` | verified-already-at-parity | shared `GameHud` geometry and damaged-fill browser receipt |
| Boneyard local-player health track/core | same ordinary HUD owner and health block | verified-already-at-parity | shared `GameHud` after real Boneyard entry |
| Full, damaged, near-death, over-range, and zero HP | squared clamped ratio in `0x005D3029..0x005D306F` | verified-already-at-parity | pure meter tests plus right-inset browser assertions |
| Default, upgraded, fractional, shrinking, and authored-maximum HP geometry | base/max width path `0x005D2FDD..0x005D3028` | verified-already-at-parity | existing v52 per-case meter tests and fixed-right-edge browser geometry |
| Health Up 64, `FX_MAXHP` 23, and Hagatha Life Charm 0 | shared authoritative maximum-HP producers | verified-already-at-parity | v52 producer census and shared meter consumer |
| Damage, poison, healing/orbs, health potion, Regenerate 79, refresh/reset | current-HP writers sampled every HUD render | verified-already-at-parity | no presentation smoothing; shared ratio path |
| Magic Shield 54 / Explosive Shield 55 | actor `+0x1C4/+0x1C8`, `0x005D30CA..0x005D3403` | verified-already-at-parity | same left clip origin, linear width, shorter-first/longer-last tests |
| Local death and respawn visibility | `actor+0x160` early branch to `0x005D3D48` | verified-already-at-parity | existing death/Game Over contracts; alive HUD rebuilds from current snapshot |
| Remote player/Golem ally rows | frame-local vector and shared row loop `0x005D3408..0x005D3669` | out-of-system (separate fixed-row producer/renderer) | native ally-roster report |
| Remote world nameplate health rail | post-world multiplayer presentation lane | out-of-system (camera-projected remote indicator) | 2026-08-20/21 world-nameplate entries |
| Featured-enemy/boss prefix | independent guarded prefix `0x005D257E..0x005D2AEF` | out-of-system (enemy-owned panel before the ordinary HUD) | fresh xref/disassembly sweep |
| Mana fill/reserve and vertical XP fill | independent meter/state fields and assets | out-of-system (not health consumers) | complete G9 element census |

There are no browser-blocked members. CSS clipping represents the native
left-origin strip exactly.

## Native ownership thread and recovered contract

- Owner and lifetime: `0x005D2520` owns the local top-center meter for every
  alive ordinary-HUD frame. It samples the observer's local progression object;
  it allocates no independent meter state and retains no delayed-damage value.
- Upstream state: base/current/maximum HP are progression `+0x6C/+0x70/+0x74`.
  Skill, equipment, charm, combat, potion, regeneration, reset, and refresh
  writers converge on those fields. Shield current/maximum are actor-local
  `+0x1C4/+0x1C8`.
- Geometry: `core_width = 2 * (base + 0.25 * (maximum - base))`;
  `track_width = core_width + 10`; track/core right edges are `750/745` at
  `1600x900`; `visible_width = core_width * clamp(current/maximum,0,1)^2`.
  The visible rect is `[745-core_width, 745-core_width+visible_width]`.
- Direction: as current HP falls, the left edge is invariant and the right edge
  retreats left. In UI terms the bar depletes **right-to-left**, beginning at
  the end nearest the central skill emblems/mana bar.
- Shield: its linear visible rect begins at the identical core left edge. Life
  and shield are ordered by visible width, shorter first, longer last; neither
  reverses direction.
- Timing and lifecycle: values are sampled per render with no smoothing, pulse,
  trailing layer, randomness, audio, input, or independent replication. Local
  death skips the ordinary HUD; respawn restores it from current state.

## Web implementation consequence

- No behavior correction is required. `hub-hud-meter-health` correctly fixes
  the complete track's right edge while `hub-hud-meter-fill` begins at the
  core's left inset. `GameHud` correctly clips the fill image's right side.
- Do not switch the health fill to `transform-origin: right`, left-side inset,
  `right: 3px`, row reversal, or a mirrored image. Those changes would make the
  local meter look superficially symmetric with its placement while contradicting
  the native damaged-health frames.
- Add browser assertions for half-health clipping and both Hub/Boneyard scene
  ownership so a later CSS cleanup cannot silently flip the axis.

## Validation contract

- Focused model: retain the existing exact squared ratio, dynamic widths,
  shield widths, and clamping cases.
- Browser: target half health, require a computed right inset near `75%` (with
  the exact value derived from the HP/max values sampled after native per-tick
  recovery), an invariant fill left edge, and a live right edge at
  `core_width * ratio^2` from that left edge. Repeat after entering the
  Boneyard using the same authoritative player state.
- Acceptance: full health reaches the core right edge; half health retains the
  leftmost quarter; zero health exposes no red fill; page, console, and network
  error lists remain empty.
- Canonical gate: `./scripts/validate.sh` from the isolated final Website tree.

## Implementation validation receipt

- Files/modules changed: `native-hud-presentation.ts` now owns the explicit
  `nativeHudLeftOriginClipPath` rule; `GameHud.tsx` consumes it for the native
  health, shield, and mana strips without changing rendered behavior;
  `native-hud-presentation.test.ts` pins full/quarter/empty and clamp cases;
  `smoke-native-derived-hud.mjs` measures the live clipped rect after actual
  damage in both Hub and Boneyard. This ledger and Mod Loader
  `docs/reverse-engineering/native-hud.md` record the recovered contract.
- Focused Website test: `npm run test:level-up` passed `11/11`, including the
  new exact rule `0.25 -> inset(0 75% 0 0)`. Mod Loader's complete registered
  static RE suite passed `504/504` on both local Linux and the arm64 Mac mini.
- Local canonical Website gate: `./scripts/validate.sh` exited `0`; backend
  build and `15/15` contracts, `4/4` library, `43/43` loot, `225/225`
  prerequisites, `1258/1258` broad game, `25/25` parties, `11/11` level-up/HUD,
  `7/7` diagnostics, `17/17` Hall, `16/16` Hub UI, `5/5` desktop, production
  build, bundle budget, and media policy passed. Only the eight existing Fast
  Refresh warnings remained. Game entry `Game-BwH8oFrg.js` was `384266` raw /
  `108111` gzip bytes.
- Local real-Chrome journey: default and maximum-125 geometry were exact; the
  damaged Hub frame sampled `62.575/125` HP with right clip `74.94%`, left edge
  fixed at `607.5`, and live right edge `641.9575`. After real Boneyard entry,
  `62.653/125` produced right clip `74.8774%`, the same left edge, and live
  right edge `642.043575`. Page, console, and network error lists were empty.
- Exact-tree Mac receipt: the Mac worktrees started at Website
  `c9600ce195a30989c7625bffd2368cc50acf8817` and Mod Loader
  `0173a543d7eb3324828303213850023b38c58a3c`; all six changed-file SHA-256
  values matched the local isolated worktrees before execution. macOS `26.4.1`
  arm64, Node `22.17.0`, .NET SDK `10.0.302`, and Google Chrome
  `151.0.7922.170` passed the same Website canonical gate/counts/build artifact
  and the `504/504` native registry.
- Mac Chrome journey: Hub and Boneyard each sampled `62.501/125` HP, right clip
  `74.9992%`, invariant left edge `607.5`, live right edge `641.8761`, and
  empty page/console/network error lists. The Boneyard capture is
  `.codex-evidence/health-bar-direction-20260821/mac-boneyard-half-health.png`,
  SHA-256 `555f5406149a750112b0d1b1ab3de64b32f0f6a248d9d6116f6c1d5a9e4c3956`;
  visual inspection shows red retained at the far-left end and the empty track
  opening toward the center.
- No member is blocked by the browser platform and no unknown remains inside
  the local-player HP-meter boundary. This validation receipt precedes
  publication; commit and push state are reported separately. No deployment,
  production change, or restart was performed.

## 2026-08-29 — Reopened local vital-strip compositing and Magic Shield crossover

### Reported smell and parity question

- Reported Website behavior: immediately after equipping Magic Shield, the
  health-bar cover is darker than the earlier/native presentation. After the
  first absorbed hit, the world shield remains active but the HUD cover can
  disappear. In the supplied witness, authoritative health is `36/50` while
  the visible covered bar reads closer to `45/50`.
- Stock behavior to recover: the complete local top-center vital compositor,
  including its authored frame/fill records, third-strip tiling, poison branch,
  health/shield width crossover, color, blend factors, draw order, scene
  ownership, and teardown.
- Reproduction states: no shield; shield wider than squared life; shield equal
  to squared life; shield narrower than squared life; the one-hit crossover
  `36/50 HP, 26/50 shield -> 25/50 shield`; shield break; poison with and
  without shield; Hub, ordinary Boneyard, Tutorial combat, and local death.
- Falsifiers: native `UI.26` passes using source-over instead of additive
  blending, a native frame in which the shorter strip is absent from the
  overlap, poison not selecting `UI.52`, or a Website snapshot that clears
  `magicShieldMaximum` before the shield actually breaks.

This is a secondary report in a system previously marked closed. The skipped
rule was painter-state membership: the earlier pass measured rectangles and
clip paths but never captured or asserted the D3D blend tuple or overlap
pixels. It therefore mistook correct geometry for complete presentation
parity. The same pass also stopped at `UI.26` and silently omitted the
extractable poisoned sibling `UI.52`.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | unmodified Beta 0.72.5 `SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Canonical image for every preferred address below. | high |
| Native instructions | fresh read-only Ghidra 12.0.3 replica decompile/disassembly of `Game::Render 0x005D2520`, vital block `0x005D2FDD..0x005D3403`, repeated strip `0x00415230`, clip stack `0x00427300/0x00420EC0/0x00421380`, color setter/reset `0x0041FE50/0x0041C510` | Health remains squared and shield linear. Both are left-clipped. The shorter strip is submitted first; equality takes the shield-first branch. Shield uses RGBA multiplier `(0.5,1,1,1)`, then color resets to white. | high |
| Ghidra provenance | current read-only Mod Loader tool revision `08bfba9ef367f7b863848030d0a289dc31e33192`; wrapper SHA-256 `b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`; scripts `decompile_targets.py` `899167ca...e97465`, `dump_function_instructions.py` `273f6426...3ad50cef`, and `trace_call_arguments.py` `bc7185ba...3ad50a725` | Canonical project `SolomonDark`, program `SolomonDark.exe`, replica pool under the outer `Decompiled Game` workspace; no Mod Loader file was changed. | high |
| Native render capture | owned native HUD capture recorded `2026-08-06T11:57:27Z`, source commit `2686eaf9fb55b8c8d5aa3e5d95cba88c3045a91d`, loader SHA-256 `5bd48779...aefcc52`, process `54112`, staged retail executable above; fixture SHA-256 `358f1cd4ab3aa26a622b8f968fca0d986261314082f3f058a26af1a3e22ea52d` | D3D draw state for the vital strips is source `5` / destination `2` / add: `SRCALPHA, ONE`, not source-over. Native witnesses retain distinct life and shield pixels in both width orders: life `36.086426`, shield `50`; then shield `20`, life `36.081604`. | high supporting runtime evidence; reconciled with instructions and backbuffer pixels |
| Native backbuffer crops | `state-health-magic_shield.png` SHA-256 `d44541f3a6b4a27e8b6eeb2ecf0ac8c5feea0f27aaaf710d237134132c8cecf6`; `state-health-magic_shield_below_life.png` SHA-256 `897d7a064405c643a68f48ca622817219773e35584289a1c697f102d68184b46` | When shield is longer, the life overlap remains visibly brighter and the shield-only suffix is darker. When shield is shorter, its overlap remains visibly distinct under the longer life strip. | high visible |
| Authored assets/data | complete `UI.bundle` table already drained into Website `native-ui-assets.json`; `UI.26` red life/shield, `UI.40` mana, `UI.41` reserve, `UI.52` poisoned life/shield, `UI.70` vital frame; UI atlas SHA-256 `37d5e8fc543af12a9d8019e738dbe1e29b648211144a3782c3a32e71f76cd2eb` | `0x005D3077` selects `UI.52` when actor flag `+0x138 & 2`; `Mod_Poisoned` apply `0x00623850` sets that bit. All five consumed records are extractable and present. | high |
| Current Website | Website `e7addc2b9ec7dfeed88d2208853150e976ab7979`; `GameHud.tsx`, `hub.css`, `native-hud-presentation.ts`, `smoke-native-derived-hud.mjs` | Ratios, left clipping, and ordinary shorter-first sorting exist. DOM images use normal source-over, so the later opaque pass erases the earlier overlap. The frame is synthetic CSS, fill images stretch instead of using native third-strip tiling, poison never selects `UI.52`, and the equality tie follows stable health-first order. Existing smoke asserts rectangles only. | high |

The native capture is loader-instrumented supporting evidence rather than a
clean-process claim. The material conclusions do not depend on injection: raw
retail instructions establish the branch, records, tint, and calls, while the
recorded D3D tuple and backbuffer pixels establish the externally visible
blend result those calls produce.

### System boundary and membership inventory

Native system: the ordinary `Game::Render` local top-center vital-strip
compositor, from authoritative local progression/actor values through authored
record selection, dynamic third-strip construction, clipping, tint, additive
composition, painter order, visibility, and teardown. Mana is a member because
the same owner, frame record, strip constructor, blend state, and web CSS path
serve both local meters.

| Member (scene/state/branch) | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Health and mana frames | `UI.70`; `0x005D2A..0x005D30`; `0x00415230` | `exact-ported` by this reopening | exact record and third-strip segment plans at default, upgraded, fractional, shrinking, and authored maxima |
| Ordinary health fill | `UI.26`; progression `+0x70/+0x74` | `exact-ported` by this reopening | squared left-clipped width, additive pixels, no shield tint |
| Poisoned health fill | actor `+0x138 & 2`; `Mod_Poisoned 0x00623850`; `UI.52` | `exact-ported` by this reopening | green record in every poisoned life/shield composition and return to `UI.26` on expiry/cure |
| No-shield life | `actor+0x1C4 <= 0` branch | `exact-ported` by this reopening | one white additive life strip only |
| Shield wider than life | `0x005D313A..0x005D32B9` | `exact-ported` by this reopening | life first, tinted shield second; overlap brighter than shield-only suffix |
| Shield narrower than life | `0x005D32BE..0x005D3403` | `exact-ported` by this reopening | tinted shield first, life second; overlap remains visible under life |
| Equal life/shield widths | x87 compare at `0x005D315A..0x005D3169` | `exact-ported` by this reopening | shield-first tie followed by life; deterministic DOM order |
| First absorbed-hit crossover | shield damage receiver `0x0052F540`; HUD block above | `exact-ported` by this reopening | `36/50 HP, 26/50 -> 25/50 shield`: state remains nonzero and overlap pixels remain distinct after order flips |
| Shield break / Dampen clear | player shield receiver/break `0x0052F540/0x00546650`; Dampen | `verified-already-at-parity` | current and maximum become zero only on break/clear; HUD removes the shield strip on the next snapshot |
| Magic Shield 54 / Explosive Shield 55 | shared actor `+0x1C4/+0x1C8`; row 55 changes break payload only | `verified-already-at-parity` | both use the identical HUD compositor before break |
| Dynamic HP producers | Health Up 64, `FX_MAXHP` 23, Life Charm 0, damage, poison, healing, potion, Regenerate, reset | `verified-already-at-parity` | all converge on the same dynamic core and squared fill consumer |
| Mana fill and reserve | `UI.40/UI.41`; progression `+0x7C/+0x80/+0x740` | `exact-ported` by this reopening | linear fill, right-anchored reserve, exact third-strip construction, additive blend |
| Hub local HUD | Game vtable `0x0079B60C` slot `+0x28` -> `0x005D2520` | `exact-ported` by this reopening | real Hub state/pixels |
| Boneyard and Tutorial-combat local HUD | same ordinary Game owner and Website `BoneyardScene -> GameHud` | `exact-ported` by this reopening | real scene entry plus all crossover/poison branches |
| Multiplayer local participant on each client | local actor/progression selection; host-authored snapshot | `verified-already-at-parity` | no client-derived shield delta; each client renders its own local row from authoritative state |
| Fine/coarse pointer, responsive stage, and user-authored meter transform | one shared `GameHud` subtree | `verified-already-at-parity` | internal strip pixels/order survive scale, rotation, and translation |
| Zero/living-overkill and terminal death | health guard plus actor `+0x160` early HUD exit | `verified-already-at-parity` | living zero exposes no fill; terminal state removes ordinary HUD; respawn reconstructs from current state |
| World Magic Shield shell, pulse, break particles, explosion, light, camera, and audio | PlayerWizard/world secondary presentation owners | `out-of-system` (separate world compositor and audio lifecycle) | existing secondary-ability closure remains unchanged |
| Direct-hit red Wizard redraw and ouch audio | Player damage presenter | `out-of-system` (separate actor/world response) | no HUD tint inferred from hit timing |
| Ally rows, world nameplates, enemy HP/shields | fixed row, projected multiplayer, and enemy owners | `out-of-system` (not local vital-strip consumers) | no shared local-meter CSS or state |

No member is blocked by the browser platform. CSS `plus-lighter` can represent
the recovered additive tuple for these premultiplied-alpha bitmap strips; the
exact stock atlas can be sampled directly without an approximation.

### Native ownership thread

- Owner and lifetime: `Game` vtable `0x0079B60C` slot `+0x28` invokes
  `0x005D2520` for each visible ordinary-HUD render. It samples the current
  local actor at singleton `+0x1358` and progression at `+0x1654`; it owns no
  delayed display value.
- Upstream state: current/max HP and MP, reserve, poison flag, and shield
  current/max are authoritative simulation fields. Magic Shield installation
  writes current and maximum together; absorbed damage reduces current while
  preserving maximum until the break edge.
- Authored selection: `UI.26` is ordinary red and `UI.52` poisoned green. The
  same selected record is used for life and shield passes. `UI.70` frames both
  meters, `UI.40` is mana, and `UI.41` is reserve.
- Strip construction: `0x00415230` divides each record into three equal UV
  spans, draws the left third, repeats the center third with one partial tail,
  and draws the right third. Dynamic width changes the repeated center, not the
  cap art. The previous stretched `<img>` path was not this algorithm.
- Composition: every vital-strip/frame draw in the captured lane uses
  `SRCALPHA, ONE, ADD`. Health is white; shield is multiplied by
  `(0.5,1,1,1)`. Strips are ordered by visible width, shorter first; shield wins
  the equality tie. Additive overlap is therefore intentionally brighter and
  cannot be modeled by opaque source-over stacking.
- Entry/reset/teardown: Hub, Boneyard, and Tutorial combat share the owner.
  Poison cure/expiry swaps back to `UI.26`; shield break removes only the
  shield strip; local death skips the ordinary HUD; respawn/new run rebuilds
  directly from current state. There is no smoothing, transition timer, audio,
  randomness, or renderer-local authority in this compositor.

### Nearby-system findings

- The older ledger called `(0.5,1,1,1)` a “cyan shield” without accounting for
  the red/green source texture. The vector halves only the sampled red channel;
  the visible bright overlap comes from additive accumulation, not a cyan
  replacement image.
- The poisoned `UI.52` branch is shared by both life and Magic Shield. Fixing
  only the reported red-bar case would leave the same falsified source-over and
  stretched-strip model on its authored sibling.
- `UI.70` has a transparent center. The synthetic Website background hid the
  live world under the native frame and cannot remain once the exact record is
  used.

### Web implementation consequence

- Add one reusable DOM projection of native repeated strip `0x00415230` over
  the existing complete native UI atlas. Health, shield, mana, reserve, and
  both frames must consume it.
- Make the pure HUD presentation owner emit record selection and deterministic
  life/shield paint order, including the shield-first equality tie.
- Select `UI.52` while authoritative `poisonTicksRemaining > 0`; otherwise use
  `UI.26`. Apply the recovered half-red filter only to the shield strip.
- Composite the exact strips/frame with `mix-blend-mode: plus-lighter`. Remove
  the synthetic ridge/background/shadow and stretched fill-image path.
- Preserve all existing state, protocol, simulation, input, audio, and world
  shield owners. This is a presentation correction, not a shield-lifetime or
  health-value rewrite.

### Validation contract

- Pure strip tests: pin third-segment source/target intervals for `UI.26` core
  widths `80/100/125/425`, `UI.70` track widths `90/110/135/435`, and `UI.41`
  reserve `31.25`; pin no missing/extra authored record.
- Pure HUD tests: no shield, shield wider, shield narrower, equality, poison,
  poison-plus-shield, break, clamp, dynamic maxima, mana, and reserve. Assert
  record, tint role, progress, and exact paint order per member.
- Mac browser regression: in a real Hub set authoritative `36/50 HP` and
  `26/50 shield`, apply one nonbreaking damage point through the shared damage
  receiver, and prove `25/50` remains in snapshot/alt text, the shield DOM
  member remains, paint order flips, and overlap pixels remain distinct rather
  than becoming identical to no-shield life. Repeat after real Boneyard entry.
- Pixel evidence: compare initial and post-hit crops with the two native
  backbuffer witnesses above; require the bright overlap/darker suffix in both
  width orders, exact transparent `UI.70` frame interior, and green `UI.52`
  poison variants.
- Lifecycle: break removes the HUD strip and world shell together; cure/expiry
  restores `UI.26`; death/respawn and Hub/Boneyard transitions leave no stale
  strip or filter state. Page, console, and failed-response arrays stay empty.
- Run the complete Mac-only gate with
  `/opt/homebrew/bin/bash ./scripts/validate.sh` from the exact candidate
  worktree.

### Implementation validation receipt

- Implementation: `native-hud-presentation.ts` now owns the five exact record
  constants and emits deterministic life/shield layer plans, including the
  shield-first equality tie and shared poison record. New
  `native-ui/NativeUiStrip.tsx` projects repeated-strip helper `0x00415230`
  from the complete native atlas; `native-ui-plan.ts` owns its exact thirds.
  `GameHud.tsx` uses those strips for both `UI.70` frames, `UI.26/UI.52` life
  and shield, `UI.40` mana, and `UI.41` reserve. `hub.css` uses
  `plus-lighter` and no longer synthesizes an opaque ridge/background or
  stretches whole fill images.
- Focused regressions: `native-hud-presentation.test.ts` pins no-shield,
  wider, narrower, equality, first-hit crossover, and poisoned-shield record,
  tint, and order. `native-ui.test.ts` pins exact full/partial center repeats
  for `102 -> 125`, `21 -> 31.25`, and fractional `112 -> 135` strips. The
  exact-base Mac red gate failed before product code at the new missing
  `nativeUiStripPieces` contract, then the implemented tree passed it.
- Final base/provenance: the focused local worktree and clean detached Mac
  worktree were rebased/rematerialized after `origin/main` advanced, at Website
  base `cc8ce79698f0888c9dba393b91f340fbcce26004`. All ten changed-file SHA-256
  values matched across local and Mac before execution. Mac host was macOS
  `26.6.2` build `25G83`, arm64, Node `22.17.0`, npm `10.9.2`, .NET SDK
  `10.0.302`, and Google Chrome `151.0.7922.174`.
- Real Mac Chrome journey: the smoke declined the stock Tutorial prompt,
  created a real Earth/Mind wizard, entered Hub, then used the authoritative
  shield damage receiver for `36/50 HP, 26/50 -> 25/50 shield`. The HUD kept
  `UI.26`, kept `25/50` state, and flipped `[health,shield]` to
  `[shield,health]` without losing either `plus-lighter` layer. The same
  crossover passed after real Boneyard entry at the current dynamic maximum.
  Poison selected `UI.52` for both layers; `UI.70`, dynamic Health/Mana,
  reserve, selected-skill, and Plane Orb checks remained exact. Page, console,
  and failed-response arrays were empty.
- Pixel receipt: both width orders produced overlap RGBA
  `[255,114,114,255]`; the shield-only suffix was `[103,57,57,255]`, the
  life-only suffix `[206,57,57,255]`, and the empty interior
  `[57,56,50,255]`. This pins the bright additive overlap that source-over
  erased. The disposable Mac screenshot was SHA-256
  `22154d5abf2fe7c11248198dd860d315b0273991b788de958553d74c11561af5`.
- Canonical Mac gate: `/opt/homebrew/bin/bash ./scripts/validate.sh` exited
  zero on the rebased candidate. Backend build and 28 Website/backend
  contracts, lint and architecture checks, 61 Web Lua, 10 Hagatha, 47 loot,
  17 arena-render, 321 prerequisite, 1,730 broad game, 5 HUD selector,
  9 weather, 60 party, 16 level-up/HUD, 47 Tutorial, 7 diagnostics, 36 Hall,
  80 Hub UI, and 5 desktop tests passed. Production build, game-host build,
  media policy, and bundle budget passed; game entry `Game-DFKREVQP.js` was
  `264,587` raw / `80,327` gzip bytes against `524,288` / `134,144` limits.
  On an earlier intermediate base, one contended gate timed out only the
  unrelated detached-party catch-up message test after 11.7 seconds while its
  other 1,721 broad tests passed; the unchanged settled-machine complete rerun
  passed that test in 1.31 seconds. No timeout or product assertion was changed,
  and the final current-base gate above passed cleanly.
- No member is browser-blocked and no material unknown remains. No local
  commit, push, deployment, production restart, or live-service claim was made.
