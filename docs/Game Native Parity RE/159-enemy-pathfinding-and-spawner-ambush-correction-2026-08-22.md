# Enemy pathfinding and Spawner ambush correction — 2026-08-22

## Reported smell and parity question

- Reported web behavior: verify that enemy pathfinding mirrors stock and audit
  enemy spawning, specifically whether the apparent opening ambush is a live
  retail mechanic.
- Stock behavior to recover: the complete common Badguy target/steering/flank/
  recovery pipeline plus generated TimeLine/Spawner count, location,
  position-policy, placement, and pause ownership.
- Reproduction: one generated stock Arena entered from a fresh temporary
  profile, direct native wave start after settling, and the current Website
  default Boneyard director/store on `origin/main`.
- Falsifiers: a dormant stock flanking field; a constant retail `10 + 5`
  opening; a dead `[near-player,dark]` event; or Website state that carries and
  consumes the same native fields and candidate predicates.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail executable | `SolomonDarkAbandonware/SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` | Same supported Beta 0.72.5 image as the existing enemy/wave reports. | high |
| Instructions | `WaveData_Parse 0x00632730`, especially `0x0063298F..0x006329BA`, `0x00632AE4..0x00632B0F`, and `0x00632C70..0x00632C93` | Opening is `8+RandomInt(5)`, then `3+RandomInt(3)` across four seconds, then mode-3 pause threshold `1+RandomInt(4)`. | high |
| Instructions | `MonsterRecipe::MonsterRecipe 0x006400C0`; `MonsterPathfinding_RefreshTarget 0x00483480`; `Badguy::Badguy 0x00473390`; chase `0x004835F0`; vector builder `0x004763E0`; flank selector `0x00473750`; stalled action `0x004737F0`, `0x00448A20`, `0x00449200`; movement executor `0x00525800` | Default `flanking/pathfinding=1/1`; live target period 300; gradual turn, target-relative flank point, 200..400-tick flank, 1.5 speed, float32 1.4 turn, 0.995 decay, random/stalled reroutes, and the 50..99-tick target-facing action-0D winner. | high |
| Serialized stock | Forty distinct generated `play.boneyard` files plus reference SHA-256 `dda683d9...` | All immediate counts 8..12 and follow-up counts 3..5 occur; every opening begins SPAWN LOCATING `[0,0]`. | high |
| Injected runtime diagnostic | isolated PIDs 21192 and 23988, audio disabled, temporary profiles, only `sample.lua.ui_sandbox_lab`; generated files SHA-256 `2d836901...` and control `play.boneyard` | The first run traced ten raw proposals at 100 units and live flanking; the untraced control generated 8+3/threshold 1 and registered all eleven Skeletons. | high-supporting |
| Current Website | `boneyard-wave-timeline.ts`, `boneyard-wave-director.ts`, `boneyard-enemy-config.ts`, `boneyard-enemy-store.ts`, `boneyard-collision.ts` | Hardcoded 10+5/threshold 4; only near-player/anywhere location; no position policy; semantic-hash retry angle; no flanking/path mode/turn/recovery state; direct normalized pursuit and fixed 25-tick valid-target refresh. | high |

The runtime diagnostics are loader-injected and therefore support rather than
replace the clean static/serialized evidence. Both owned processes were
verified by exact executable path, all traces were removed, and only those PIDs
were stopped.

## System boundary and membership inventory

Native systems:

1. `Badguy` path/steering owns target cadence, gradual heading, flank/wander
   state, speed/turn factors, stalled-motion recovery, collision submission,
   family adjustment, interruption, and reset.
2. Generated survival spawning owns the opening draws, TimeLine event order,
   Spawner record/budget/pacing, near-player versus anywhere raw points,
   dark/light/offscreen/direct/edge predicates, collision/ring retries,
   registration, and live-count pause gates.

| Member | Native owner | Current disposition before this cutover | Required proof |
| --- | --- | --- | --- |
| default config bytes and target period | `0x006400C0`, `0x00483480` | parity defect — exact port required | config and 10/100/300/1000 cadence tests |
| common gradual steering | `0x004763E0`, `0x00476B90` | parity defect — web snaps to direct vector | per-step heading/vector goldens |
| flank selection, active timer, and decay | `0x00473750`, `0x004835F0` | parity defect — no web state | RNG/order, timer, factor, decay tests |
| stalled-motion and 20-tick rerolls | `0x004835F0`, action `0x004737F0 -> 0x00448A20 -> 0x00449200` | parity defect — no web state | blocked mover, periodic roll, action RNG/duration, facing, and movement-suspension tests |
| nearest eligible target and host authority | `0x00481A60`, `0x00483480` | verified-already-at-parity except cadence | multi-target/tie/reacquisition tests |
| `PlayerActor_MoveStep` static/dynamic collision handoff | `0x00525800` family | verified-already-at-parity at shared actor-solver boundary | existing collision suite plus flank motion |
| Skeleton, Archer, Mage | family ticks/movers `0x00484B90`, `0x00485200`, `0x00490860` | common path defect; family range/action lanes already present | one stationary and one moving target per family |
| Imp and reachable allied GoodImp | `0x00485DC0`, `0x0052C1A0`, mover `0x00478560` | common path defect in two Website owners | hostile and reversed-allegiance target cases |
| Zombie | `0x004863A0`, common mover | common path defect | approach, flank, swipe interruption |
| Wraith | `0x00486C30`, mover `0x00478EA0` | common path defect; bounded orbit already present | approach/flank/orbit transition |
| Demon | `0x00487300`, common mover | common path defect | approach/flank/bomb transition |
| Coffin | `0x004A2760` | verified-already-at-parity as stationary Spawner family | no locomotion despite common base fields |
| Maggot | `0x0048B2A0`, common movement/contact | common direct-chase defect | emerge/crawl/flank/bite lifecycle |
| DemonSkull, DireFaculty, Heartmonger/Crow, GreenImp, Spider/Cocoon, Portal | native story/custom families | out-of-system — Website default survival factory does not construct their owners | negative factory inventory |
| opening count and threshold draws | `0x00632997`, `0x00632AEC`, `0x00632C78` | parity defect — hardcoded 10+5/4 | full endpoint and draw-order tests |
| opening immediate/spread event order | generated TimeLine | verified-already-at-parity except variable counts | 0/500..900 timing with variable follow-up |
| near-player raw proposal | Spawner `0x0046D000` | verified-already-at-parity | exact 100-unit tests |
| anywhere raw proposal | Spawner `0x0046D000` | verified-already-at-parity | full authored rectangle tests |
| dark, light, offscreen, direct, edge predicates | `0x00466200` | parity defect — field discarded | per-policy candidate tests; default survival reaches dark/light |
| radius rings, angular count, 0.8 Y | `0x00463D30` | partial parity — ring geometry present, native RNG/policy transitions absent | candidate-order goldens |
| post-retreat combat confinement | Website product rule | explicit product deviation from stock exterior births | regression and visible completion disclosure |
| no-player camera fallback and continued scheduler | Spawner/Arena evaluator | parity defect — web pauses with no living player | zero-player spawn/gating test |
| `MAXENEMIES` ignored and no Spawner live cap | parser/Spawner negative xrefs | verified-already-at-parity | existing cap-negative test |
| Imp/Demon/Coffin terminal children | family death/open helpers | verified-already-at-parity; not TimeLine placement members | existing family lifecycle tests |
| custom/mod-authored opaque TimeLines | Bonedit scripting ABI | out-of-system — Website currently runs retail director only for default source | default/custom negative ownership test |

No member is blocked by the browser platform. The existing combat-rectangle
confinement is a named product deviation, not a platform constraint or native
claim.

## Native ownership and behavioral contract

- Construction writes recipe defaults `+0xB8/+0xB9=1/1`; evaluated config and
  actor construction consume the same shared RNG stream before the actor joins
  insertion-order `ActorWorld` traversal.
- Normal common motion represents two 100 Hz ticks. It builds two gradually
  turned direction vectors, scales each by `0.25 * localSpeed * baseSpeed *
  status`, adds target-owned force, subdivides large submissions at radius
  minus one, and leaves collision/grid rebinding to the movement owner.
- Active flank state aims at a target-relative offset for 200..400 eligible
  updates. Selection raises speed/turn to 1.5/1.4; inactive factors decay by
  0.995 to one. Twenty-tick random and 25-stall lanes can reselect it.
- At the 25-stall boundary, roll 3 of 15 retains the stall counter, consumes a
  second `RandomInt(50)`, and queues action `0x0D` for a status-scaled 50..99
  ticks. That action faces the current target each tick and suspends ordinary
  locomotion; the other fourteen outcomes select a flank and clear the stall
  counter.
- Opening generator draws count A, count B, and pause threshold in that order.
  Both events use near-player/dark. The first drains immediately; the second
  starts at tick 500 and spreads all births across ticks 500..900.
- “Near player” owns only the raw 100-unit point. Policy-zero dark search and
  collision retries own the final root. In two authentic generated runs final
  births were 228..463 and 271..414 units from the player, with 3/10 and 5/11
  outside the full Arena. Stock therefore executes the ambush but does not
  promise a visible 100-unit ring.
- Regular default bursts restore anywhere/dark. Coffin wrappers temporarily
  select near-player/light. Position policies 2/3/4 remain reachable through
  authored TimeLines even though the default retail generator uses 0/1.
- `MAXENEMIES` remains dead. Spawner budget completion and TimeLine live-count
  pause nodes are distinct owners.

## Web implementation consequence

- Replace the constant opening with generator-time draws and carry the
  resulting bursts/threshold in director state.
- Preserve both location and position policies through compiled burst, spawn
  intent, materializer, and world placement. Default opening is near/dark;
  ordinary waves anywhere/dark; Coffins near/light.
- Move retry-angle entropy onto the authoritative wave/placement RNG rather
  than a semantic hash. Keep the already documented combat-rectangle product
  confinement explicit.
- Add native path config and actor steering state. Common motion must own
  gradual turns, target-relative flanks, factor decay, periodic/stall rerolls,
  action-0D reorientation, wander on target loss, and native target cadence.
  Family brains request radial/tangent intent without bypassing that owner.
- Remove the fixed `25/3` target-clock interpretation and the global
  `faceTarget` snap before family movement.
- Consume the committed native behavior goldens as a differential contract;
  self-authored direct-vector tests alone cannot certify parity.

## Validation contract

- Focused tests cover every opening endpoint, threshold endpoint, exact draw
  order, both default position policies, zero-player fallback, native target
  periods, gradual turning, active/expired flank factors, both reroll lanes,
  target loss/wander, and every reachable family disposition above.
- The supported `./scripts/validate.sh` gate passes on the exact final tree.
- Browser acceptance enters a real generated Boneyard, triggers Solomon, and
  records generated opening counts, raw/final spawn geometry, moving/flanking
  enemies, wave release, page errors, and console errors.
- Final native-parity acceptance runs on the Mac mini; Windows is supporting
  native diagnostic evidence only.

## Implementation validation receipt

- `native-enemy-pathfinding.ts` now owns the recovered constructor fields,
  `1000/300/100/10` target periods, two-tick gradual steering, target-relative
  flank and ordinary wander points, 200..400-tick 1.5/float32-1.4 flank
  factors, exact 0.995 decay, 20-tick rerolls, 25-stall recovery, and the
  status-scaled action-`0x0D` facing hold. The authoritative enemy store uses
  it for every mobile survival family and Coffin Maggots; Fire GoodImp uses
  the same owner with its reversed-allegiance target query. The concurrent
  Skeleton-gait and temporary-status changes remain intact: gait advances
  from the native requested movement scalar, and status-scaled config is a
  current-tick view restored by the upstream store boundary.
- The wave compiler/director now generates `8..12`, then `3..5`, then a
  threshold `1..4` from the native RNG in source order. Spawn location and
  position policies survive compilation, intent transport, materialization,
  and placement. The opening is near-player/dark, ordinary generated groups
  are anywhere/dark, Coffins are near-player/light, and the scheduler retains
  its no-player camera-center fallback. Placement retries use a fresh native
  angle per radius ring and the shared recovered radial-light falloff. The
  already named Website rule still confines post-retreat births to the combat
  rectangle; that remains an explicit product deviation from stock exterior
  births.
- The exact rebased Website code commit was
  `8b9129f48f6731354ad9953ccb60e012f7b0cda1` (tree
  `90cf5271e68768b702a026696e8ecbf445514a59`) over status-lifecycle main
  `52146891c6ac00cd25face69628c1250b826969f`. Local canonical
  `./scripts/validate.sh` passed `16/16` backend contracts; frontend groups
  `4/4`, `43/43`, `233/233`, `1350/1350`, `9/9`, `42/42`, `11/11`, `7/7`,
  `17/17`, and `21/21`; desktop `5/5`; production build, media policy, and
  bundle budget (`417541` raw / `116923` gzip). Log SHA-256 is
  `fddf5be2c9fb6689f93537ef5b62135e4b24e483a97a2ffe93c6e45a66341793`.
- The exact rebased Mod Loader documentation commit was
  `673a196a1c7cad8af2183c6e1691b35c50e4ded4` (tree
  `635af19a0e311f7767eded6e79600c843838d704`). Its CI-safe native suite passed
  `491/491` locally (log SHA-256
  `766554cc66af623afee20eae6bd8d9663c943e1d59e0a05c6cdda3306951c884`)
  and on the Mac under Python 3.12 (`491/491`, log SHA-256
  `845daaa470d692ecfb70a5bea7c0167aa3b2521889ef574d646dd8f869e5fd49`).
  Apple system Python is not accepted because it lacks `zip(strict=...)`.
- Jarrett's arm64 Mac mini ran macOS `26.6.2`, Node `22.17.0`, npm `10.9.2`,
  .NET `10.0.302`, and Chrome `151.0.7922.170`. Its uncontended canonical
  Website gate passed the same counts and production checks; bundle budget was
  `417541` raw / `116924` gzip and the log SHA-256 is
  `db0cdf0d140519e3d2d972e48f61f6be19ff51cd8336490b5ad96f81d4431cca`.
- The built-production Chrome journey crossed the real entry Gate, completed
  Solomon's Dig/dialogue/run transition, and reached `opening-threshold` with
  exactly `8 + 3` Skeletons. The immediate births shared tick `7444`; delayed
  births occurred at `+500`, `+700`, and `+900` ticks. First-observed roots
  were `315.408..410.306` units from the player, proving that the 100-unit raw
  proposal is not the final ambush ring; no root escaped the Website combat
  rectangle. Across the next 25 ticks, ten actors moved `2.1875..20.375`
  units while one was collision-held, and every actor retained a
  `11.977..37.582` degree error from direct target heading. This is decisive
  browser evidence of gradual/offset steering rather than snap pursuit.
  Page, console, protocol, and combat-bound error arrays were empty.
- Task-specific browser log SHA-256 is
  `f284686aad86088ab75c89a89fff33a18fd905ae76c4b307ba27e8caa05c4442`.
  Inspected Mac captures are
  `/tmp/solomon-enemy-path-spawn-finalbase-opening-mac-combat.png` SHA-256
  `f0a0316bd4150b841b546ffd6c39827fb4cc9f95af23f1885ccca3eea6eee15b`,
  the speaking frame SHA-256
  `35b166053553bb4e972903ac1d925555beafca34a071a78ee7ed90f1e20fe41b`,
  and the run-edge frame SHA-256
  `bfbb4cd717575ee7d7fe6eb998775d28a109d697c5f641e73e502bd2645b6502`.
  A broader entrance smoke had already recorded the same clean opening before
  its unrelated retired-entry return-movement assertion was collision-held;
  the named `--opening-only` acceptance isolates this task and does not claim
  a new entrance-retirement result.
- Therefore the stock ambush is real and working. What is misleading is its
  name: stock proposes near the player, then dark/collision placement can move
  the actual roots hundreds of units away. No path/spawn member is blocked by
  the browser platform. Deployment remains separate and was not requested.
