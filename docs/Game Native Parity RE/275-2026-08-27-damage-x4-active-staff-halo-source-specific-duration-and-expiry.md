# 2026-08-27 — Damage x4 active Staff halo, source-specific duration, and expiry

## Reported smell and parity question

- Reported web behavior: collecting the Damage x4 Bonus applies four-times
  damage but leaves the equipped player with no active native VFX. The user also
  asked that expiration be proved rather than inferred.
- Stock behavior to recover: both Damage x4 sources write one shared live timer;
  the active selected-primary Staff painter prepends two rotating gold additive
  halos, fades them over the final 100 fixed ticks, and removes presentation and
  damage together at zero.
- Reproduction scenes: local and remote equipped-Staff players in Boneyard,
  Hub continuation while the live timer remains, Bonus collection, Wizard Chug
  consumption, source replacement, final 100 ticks, death suppression, run
  reset, disconnect, and view destruction.
- Falsifiers: Bonus and Wizard Chug share one duration; time is added rather
  than replaced; the halo is a detached world actor or light; both layers do
  not use BadGuys 7; the last 100 ticks do not control alpha; damage remains x4
  after the painter disappears; or clients already receive the timer.

This reopens the 2026-08-16 loot entry. That pass followed Bonus kind 2 through
pickup and the offensive multiplier but skipped the downstream shared player
painter and did not compare the Bonus writer with the Wizard Chug writer. It
therefore marked an incomplete member `exact-ported` and assigned the Bonus the
Potion's 60-second web helper.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | 4,723,200-byte `SolomonDarkAbandonware/SolomonDark.exe`, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000`, reverified 2026-08-27 | Same retail 0.72.5 image as the canonical project and prior loot entry. | high |
| Complete `+0x824` instruction census | canonical Ghidra 12.0.3 read-only replica through `find_offset_accesses.py 0x824`; material hits in `0x00539B80`, `0x0056D1B0`, `0x005D5910`, `0x006594E0`, `0x0065F5B0`, and `0x00660220` | Closes construction, both writers, tick/expiry, damage refresh, and active rendering. `0x00506490` and `0x00674EE0` hits are stack-local displacement collisions, not progression consumers. | high |
| Source clocks | Bonus `0x005D59D9..0x005D5A1A`, Wizard Chug `0x0056D277..0x0056D2B1`; doubles `15` at `0x00784D80` and `60` at `0x007849A0`; timing scale `0x00820230` | Direct stores are `trunc(timingScale*15)` and `trunc(timingScale*60)`: 1,500 and 6,000 ticks at stock 100 Hz. A later store replaces the current value. | high |
| Tick and damage | `0x00660257..0x00660276`; refresh test `0x0065F76C` | Positive time decrements once, clamps at zero, and refreshes exactly on that edge. Positive state writes factor four; zero retains factor one. | high |
| Active painter instructions | shared selected-primary painter `0x00539B80`, exact range `0x00539C10..0x00539E1D` | Positive time draws BadGuys 7 twice additively before the normal element program; alpha is `min(remaining,100)/100`, rotations are `tick` and `-0.5*tick`, scales are `2.5*S` and `2*S`, RGB is `(.85,.73,.44)`. | high |
| Asset/data | BadGuys record 7 at inline field `0x594`; tracked extracted crop/manifest `badguys/0007.png`, logical cell `100x109`, crop `87x76`, origin `(.5,5.5)` | Exact native halo asset is already bundled by the secondary/loot asset family. | high |
| Current web baseline | Website `origin/main` base `4c608b42118d487a3eb2c6e1a8cb29c020df6479`; `player-progression.ts`, `game-simulation.ts`, `game-snapshot.ts`, protocol 95, `PlayerWorldView` | Server owns a 6,000-tick field and damage factor, but Bonus kind 2 calls the Potion helper. The strict player projection omits the field and the retained Staff compositor has no Damage x4 layers. | high |

No injected-loader observation supplies an implementation constant. Static
instructions and registered asset data own the full contract; the user's report
supplies the web symptom.

## System boundary and membership inventory

Native system: **Damage x4 live state plus the equipped-Staff active painter**,
from either native writer through replacement, fixed-tick damage/presentation,
strict multiplayer projection, final fade, reset, and teardown.

| Member / branch | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Bonus kind 2 writer | `0x005D59D9..0x005D5A1A` | `exact-ported` | set exactly 1,500; replace active 6,000 with 1,500 |
| Wizard Chug writer | `0x0056D277..0x0056D2B1` | `verified-already-at-parity`, isolated from Bonus helper | set exactly 6,000; replace active 1,500 with 6,000 |
| Positive damage state | `0x0065F76C` | `verified-already-at-parity` | factor four while remaining is positive |
| Fixed tick `1500..101` / `6000..101` | `0x00660257..0x0066026C` | `exact-ported` | one decrement per authoritative 100-Hz tick; full-alpha halo |
| Final ticks `100..1` | `0x00539C3F..0x00539C92` | `exact-ported` | alpha sequence `1,.99,...,.01` |
| Zero transition | `0x0066026C..0x00660276` | `exact-ported` | same tick removes x4 damage and both halo layers |
| BadGuys-7 layer one | `0x00539D18..0x00539D72` | `exact-ported` | additive gold, `rotation=tick`, `scale=2.5*S` |
| BadGuys-7 layer two | `0x00539D77..0x00539DE1` | `exact-ported` | additive gold, `rotation=-.5*tick`, `scale=2*S` |
| painter state restore and order | `0x00539DE6..0x00539E1D` | `exact-ported` | halo precedes selected element; white/blend state restored |
| equipped Staff selectors `0..5`, headings, poses, base/overlay copies | `0x0053B1D0` Staff branch plus the closed 2026-08-22 submission program | `exact-ported` | every admitted native Staff helper copy prepends exactly two halo layers at the same socket/scale |
| Ether/Fire/Air/Water/Earth/Weld selected programs and Plane Orb 80 | complete `0x00539B80` switch already ported | `verified-already-at-parity` | Damage x4 prefix does not alter selected-program membership or order |
| local and remote Hub/Boneyard players | actor-private `+0x200` or slot progression resolution | `exact-ported` | strict protocol projection, both timelines, one view per player |
| death/dying/spectating | `PlayerWizard +0x160` helper guard | `exact-ported` | timer can continue, but no living Staff halo draws while death presentation owns the actor |
| fresh construction, new-run reset, disconnect, world/view teardown | `0x00659702` and established player/session/view owners | `exact-ported` | zero/stale-free state and destroyed retained sprites |
| Bonus kinds 0/1 and ground Bonus art/lifetime | `0x005D5910` other branches; `0x006039C0/0x0061A260` | `verified-already-at-parity`, out of active-timer branch | no active Damage x4 state or player halo |
| Mind Chug `+0x828` | adjacent tick lane, no `0x00539B80` read | `out-of-system` (concentration override, not Damage x4) | existing timer/concentration tests remain unchanged |
| equipped Wand and empty-hand selected-primary emitter geometry | `0x0053B321..0x0053B66B`, Clothes point families `796..867` and `484..579` | `out-of-system` (separately documented unported non-Staff selected-primary raster; this change neither guesses its sockets nor broadens the Staff compositor) | explicit no-Staff negative coverage; no false Staff-position halo |

No member inside the declared Staff system is browser-blocked. Pixi/WebGL can
retain two exact sprites per admitted painter call and express their blend,
rotation, scale, alpha, order, and teardown without approximation.

## Native ownership thread

- Owner and construction: `Skills` construction zeros progression `+0x824`.
  Bonus and inventory Potion dispatch directly replace that field and call the
  common progression refresh.
- Upstream writers: Bonus kind 2 and Wizard Chug are the complete material
  source set. Bonus ground lifetime is unrelated to the collected active timer.
- State/transition graph: `0 -> 1500|6000`; a later source replaces either
  positive value; every fixed tick decrements; `1 -> 0` refreshes derived stats.
- Downstream consumers: progression refresh owns the damage factor and shared
  selected-primary painter owns the two inline Staff layers. There is no halo
  Puppet, light provider, audio loop, collision, hit target, or separate RNG.
- Multiplayer authority: the host owns writer and countdown. Every client needs
  the bounded remaining field for local/remote presentation; clients never
  decrement authoritative state or infer activation from pickup text.
- Entry/interruption/teardown: death suppresses painter calls without creating
  a second timer; new-run reset clears live potion state; disconnect/view
  destruction removes retained Pixi owners; late join hydrates current time.

## Recovered behavioral contract

- Bonus duration is 1,500 ticks (15 seconds); Wizard Chug is 6,000 ticks
  (60 seconds). Refresh means replacement, not addition or `max`.
- Remaining values above 100 render at alpha one. Values 100 through one render
  `remaining/100`; zero renders nothing. Damage and presentation share the same
  strict-positive predicate.
- Each admitted equipped-Staff selected-primary call draws exact BadGuys 7 at
  the current Staff emitter before its normal program. Both layers use gold
  `(0.85,0.73,0.44)` and additive blending. Scales are `2.5*S` and `2*S`;
  rotation is global fixed tick degrees and its `-0.5` counter-rotation.
- Staff submission count, point-1 socket, pulse scale `S`, selected program,
  region/world tint boundary, and call order remain those already recovered.
  Damage x4 adds a prefix to each legal call; it does not create another call.
- The active halo emits no Region light, audio, collision, network event, or
  independent lifetime. Exact record origin/geometry owns placement.

## Nearby-system findings

- The previous shared `applyPlayerPotionEffect(...,2)` use for Bonus is a native
  duration bug, not merely a missing VFX projection.
- `+0x828` has the same decrement/refresh structure but no active draw in the
  selected-primary painter; timer adjacency does not make Mind Chug a gold-halo
  sibling.
- Durable native reports updated: Mod Loader
  `native-loot-selector.md` now owns the full Damage x4 membership, and
  `native-items-equipment-and-loot.md` compares both source writers.

## Confidence and open questions

- Confirmed: complete field-access census, both source constants/writers,
  replacement semantics, tick edge, damage consumer, exact renderer range,
  record, color, alpha, rotations, scales, order, and construction zero.
- Inferred: none used for a Staff implementation constant.
- Unknown outside the declared boundary: exact Wand and empty-hand
  selected-primary raster/socket programs remain their previously documented
  separate closure; this pass does not substitute Staff geometry for them.

## Web implementation consequence

- Give Bonus kind 2 its own exact 1,500-tick progression writer; retain Wizard
  Chug at 6,000 and prove both replacement directions.
- Add bounded `damageX4TicksRemaining` to the strict player projection and bump
  the incompatible protocol generation. Interpolate only presentation samples;
  the host remains the sole countdown owner.
- Add one retained two-sprite Damage x4 view for each retained Staff
  base/overlay compositor call. Reuse bundled BadGuys 7, native origin, and the
  current call's position/scale; update only visible owners.
- Keep the current Staff call census, selected-primary plans, damage formula,
  lighting, audio, loot actor, save, and gameplay RNG paths unchanged.

## Validation contract

- Pure progression: Bonus exactly 1,500, Potion exactly 6,000, both replacement
  directions, one-per-tick decrement, remaining `100/99/1/0`, reset, and damage
  factor transition.
- Presentation plan/view: exact record, RGB, additive blend, rotations, scales,
  alpha sequence, two layers per admitted Staff call, painter prefix order,
  death/no-Staff/zero suppression, and destroy.
- Protocol/timeline: required bounded field, protocol generation, host
  projection, local/remote Hub/Boneyard hydration, interpolation, malformed
  rejection, late join, and no client authority.
- Browser: collect a real kind-2 Bonus, inspect a visible two-layer-or-multiple
  Staff halo and full alpha, observe the final-100-tick fade, reach exact zero,
  prove the sprites disappear and damage returns to one, with page/console/
  failed-response arrays empty.
- Exact rebased Website candidate: focused matrix plus
  `/opt/homebrew/bin/bash ./scripts/validate.sh` and the production-build loot
  journey on the Mac mini.

## Implementation validation receipt

- `player-progression.ts` now gives Bonus kind 2 its native 1,500-tick writer
  while Wizard Chug retains 6,000. Both direct writers replace the shared
  remaining value. Pure coverage pins both replacement directions, every
  decrement through `100/99/1/0`, stable zero, and live-state reset. The full
  simulation observes 1,499 after pickup because the source writes 1,500 and
  the same authoritative game tick performs its first progression decrement.
- Strict protocol 97 adds bounded `damageX4TicksRemaining` to every player.
  This combines the task field with upstream protocol 96's enemy-route state;
  neither wire owner was discarded during rebase. The host projects the value;
  Hub/Boneyard timelines smooth only ordinary decreases of at most ten ticks
  and keep activation, source replacement, reset, and zero discrete. Values
  above 6,000 and missing fields fail closed.
- `PlayerDamageX4VfxView` retains two exact BadGuys-7 sprites per admitted Staff
  painter call. Both use additive blend, packed native gold `0xD8BA70`, record
  origin, shared final-100-tick alpha, and rotations/scales `tick/2.5*S` and
  `-.5*tick/2*S`. `PlayerWorldView` prefixes each legal base/overlay element
  call, suppresses death/no-Staff/nonselected/zero branches, exposes local and
  remote diagnostics, and destroys both retained owners before the element
  views. Existing selected-program, call-count, lighting, and world-tint paths
  remain unchanged.
- Local/Mac changed-file manifests were byte-identical for all four Mod Loader
  paths and all 21 Website paths. The Mac Mod Loader registered suite passed
  `524/524`; log SHA-256 is
  `c45531669d67d15d8025605032b718f2b7368d7ebab09c456cd96c9f852c6f04`.
- The first Mac Website gate passed 1,713 of 1,715 primary tests and exposed two
  focused expectation/order issues: the same-tick first decrement is 1,499,
  and an established Staff source-order assertion expected selected-primary
  resolution after scale calculation. The corrected byte-identical candidate
  then passed all `1,715/1,715` primary tests, every auxiliary suite, 27
  backend/contracts, formatting/lint/type/import/generated checks, production
  builds, media policy, and the bundle budget (`251,319` raw / `76,427` gzip).
  Green gate-log SHA-256 is
  `680d52790b2b5ff988257de3b00c911d47618c6d7923e68f768ba5794255d5fb`.
- Production-build Chrome `151.0.7922.174` / WebGL2 collected an actual kind-2
  Bonus. At authoritative tick 2,050, remaining time was 1,499; the inspected
  active sample had two Staff-halo sprites at alpha one. The final-fade sample
  retained two sprites at interpolated remaining `99.51` / alpha `0.9951`.
  At tick 3,549 — exactly 1,499 subsequent ticks — authoritative remaining,
  local and remote sprite counts, and halo alpha were all zero, and offensive
  damage had returned from four to one. The journey also retained the complete
  loot/Goodie/contention/audio assertions; page, console, failed-response, and
  runtime-error arrays were empty. Browser-log SHA-256 is
  `920d91c1f435ef476926334540437678a50f324f858362570786ed4622005624`.
- Reviewed active/fading/expired frame SHA-256 values are respectively
  `6374b63af185b84a640869329d2fd7ebf70667318f2b5b5445e3c0930378f8a6`,
  `5d83d924a7509ac95d57bd1a2c1acb867a19c898051d10e54674d74b46a317b9`,
  and `5ee4d8099bb86cd0eaabb3291f141ac90094f33c12db17398f5b73ca2bed2f06`.
  The gold starburst is visibly present while active and absent at expiry;
  the ordinary selected Fire orb correctly remains because it is a separate
  painter.
- No browser-platform exception exists inside the declared equipped-Staff
  boundary. Wand/empty-hand emitter raster remains the explicit separately
  documented out-of-system member; no Staff-position substitute was shipped.
  Publication to both `main` branches is authorized but remains pending this
  receipt's final exact-tree gate. Deployment and production cutover were not
  requested and remain separate.
