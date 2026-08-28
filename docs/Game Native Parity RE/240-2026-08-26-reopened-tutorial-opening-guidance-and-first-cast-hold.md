# 2026-08-26 — Reopened Tutorial opening guidance and first-cast hold

## Reported smell and parity question

- Requested behavior: after the stock prelude, show the exact gold arrow
  toward Solomon Dig until the encounter begins; show configured desktop
  movement keys or the mobile movement joystick until the player's first
  movement input; when the opening Skeletons appear, hold the hostile scene
  behind desktop/mobile primary-cast instructions until the player casts once,
  then continue the stock Tutorial.
- Reported defect: the opening Skeleton lesson flashes too quickly to read.
- Reopened system: the complete Tutorial opening from intro teardown through
  stages 0..3, including authoritative input evidence, Dig/encounter lifetime,
  pointer composition, device copy, wave-1 materialization, selective hostile
  hold, primary-cast release, replication, save/resume, and later-stage
  nonregression.
- Falsifiers: stage 2 remains visible for more than one tick on current main;
  the ten-Skeleton batch is not the `enemyCount > 5` writer; stock has a
  stage-0 pointer or stage-2 pause branch; forced intro movement is
  distinguishable from user input only by position; or ordinary gameplay
  pause admits a releasing primary cast.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | unmodified Beta 0.72.5 `SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | same pinned Tutorial/controller image as the complete stock session and pointer reports | high |
| Existing complete instructions/data | `Mod Loader/docs/re/tutorial-mechanics.md`; `Tutorial::Tick 0x005D6330`; `Tutorial::Render 0x005D08C0`; pointer primitive `0x005C9BB0`; exact `Tutorial.boneyard` SHA-256 `97802f2c…` | stage 0 has movement copy, distance `>40000`, and no pointer; stage 2 has mouse copy, two five-Skeleton groups, and completion on primary count **or** enemy count `>5`; it has no pause/mobile branch | high |
| Deterministic Mac reproduction | detached Website `207a6510`; Apple-arm64 Node 22; task-owned `reproduce-flashing-cast-lesson.mjs` | stage 1 starts ten Skeleton intents and enters visible stage 2; the next fixed tick with `enemyCount=10` and `primaryCastSequence=0` enters blank stage 3: `{"atSpawn":{"stage":2,"spawnCount":10},"afterOneTick":{"stage":3,"heading":null}}` | high |
| Current web causal trace | `native-tutorial.ts`, `game-simulation.ts`, `boneyard-world.ts`, `BoneyardScene.tsx`, `TutorialOverlay.tsx` at `207a6510` | stage 2 ports both retail completion branches exactly. Main copy has no coarse-pointer input. Tutorial world projection supplies only stage-8/17 Sacks. The existing gameplay pause/input-block owner would suppress the required cast. | high |
| Existing semantic seams | `boneyard-dig-indicator.ts`; `BrowserGameplayInput`; configured `GameControlBindings`; strict Tutorial protocol/save projection | the browser already has responsive Dig edge/target geometry, user-input movement levels, left-mouse primary and mobile primary joystick, and a host-owned resumable Tutorial state | high |

## System boundary and membership inventory

Native system: stock Tutorial intro/stages 0..3 plus the explicitly requested
browser guidance policy, ending when the first accepted primary cast releases
stage 2 into the unchanged stage-3 wave-clear owner.

| Member | Native/current source | Disposition | Proof |
| --- | --- | --- | --- |
| 475-tick prelude and forced north movement | Tutorial `+0x8C..+0x9C` | `verified-already-at-parity` | existing intro/kernel/browser receipts; no new arrow/copy paints above the active prelude |
| stage-0 configured desktop movement copy | stock movement heading plus `GameControlBindings.move*` | `exact-ported` requested projection | rebound-key unit matrix and desktop browser text |
| stage-0 mobile movement copy | no retail touch device | `out-of-system` native branch; exact requested web policy | coarse-pointer browser shows left-joystick copy |
| first user movement acknowledgement | no retail field; browser semantic input level | `out-of-system` native branch; exact requested web policy | forced movement does not acknowledge; first desktop or touch movement does; strict protocol/save round trip |
| stock stage-0 distance/narration progression | `0x005D6330`, strict squared distance `>40000`, delayed Sirmin cue | `verified-already-at-parity` | unchanged kernel boundary and narration tests |
| Solomon Dig world identity/position | START GAME script 10000, one authoritative Dig/encounter | `verified-already-at-parity` | exact scene record/hash and encounter state |
| opening Dig pointer sprite | shared UI record 28 / `0x005C9BB0` | `exact-ported` requested composition | existing extracted sprite/hash and pointer primitive |
| off-screen/visible Dig pointer placement | existing `boneyardDigIndicatorLayout`, live player/Dig camera projection | `exact-ported` web composition | target/edge geometry at desktop and mobile viewports |
| Dig pointer lifetime | encounter `digging -> turning` on first accepted contact | `exact-ported` requested policy | visible only after prelude in stages 0/1 while `digging`; absent on `turning` and every later phase |
| stage-1 Solomon/dialogue/run-event owner | stock encounter plus Tutorial stage 1 | `verified-already-at-parity` | no copy or pointer after contact; wave starts only on run event |
| two complete five-Skeleton groups | WAVE 1/group 10010, ten recipe-10004 actors | `verified-already-at-parity` | ten authored spawn intents/actors preserved |
| stage-2 desktop cast copy | stock mouse heading/subheading | `verified-already-at-parity` with durable visibility | exact bitmap copy remains until accepted cast |
| stage-2 mobile cast copy | no retail touch device | `out-of-system` native branch; exact requested web policy | coarse-pointer browser shows right-joystick copy |
| retail `enemyCount > 5` completion fallback | `0x005D6330` | `out-of-system` by explicit owner request | removed only from browser Tutorial; diagnosis test pins the superseded one-tick behavior |
| first accepted primary-cast release | stock primary-cast counter branch | `exact-ported` | primary cast remains admitted at stage 2; next fixed tick enters stage 3 and hides copy |
| selective hostile-scene hold | no retail pause in stage 2 | `out-of-system` native branch; exact requested web policy | actors, Maggots, hostile projectiles/effects, death effects, clocks, and hostile RNG do not advance; queued wave-1 spawns still materialize; no catch-up on release |
| player movement/primary action while held | ordinary player/cast owner | `verified-already-at-parity` | player input and primary simulation keep ticking so the release action can occur |
| overlay/narration/application tick while held | Tutorial/UI owners | `verified-already-at-parity` | text/pointer blink and narration continue; no generic gameplay pause is installed |
| stages 3..19, later waves, drops, modal lessons, protection, Game Over | complete stock Tutorial system | `verified-already-at-parity` | canonical Tutorial suites and full natural browser journey remain unchanged |
| solo authority | stock/global Tutorial singleton; current private run | `verified-already-at-parity` | no party/bot participant added |
| strict network state | exact-match gameplay protocol | `exact-ported` | protocol 84 carries movement acknowledgement; malformed/mixed versions fail closed |
| save/resume | browser slot continuation | `exact-ported` | schema 16 persists acknowledgement; schemas 1..15 normalize it false |

No member is blocked by the browser platform. Mobile wording and the hostile
hold are explicit requested policy, not approximations forced by the browser.

## Native ownership thread

- `Tutorial::Tick` remains the only stage owner. Stage 0 still completes by
  native distance and stage 1 still waits for Solomon's run event. One new
  boolean records only nonzero participant movement input; it never interprets
  forced intro velocity as user action.
- START GAME owns the Dig. `BoneyardScene` projects the authoritative encounter
  position through the live camera and existing Dig target/edge layout, then
  `TutorialOverlay` paints the exact UI-28 pointer until phase `turning`.
- Stage 2 remains the release owner. The requested browser contract deletes
  only its enemy-count shortcut. The first accepted primary cast increments
  the existing cast sequence; the following controller tick enters stage 3.
- The enemy store is the deepest cohesive hostile-freeze seam. Its paused tick
  accepts authored spawn intents and advances `lastStepTick`, but preserves
  every existing hostile actor/effect/projectile/RNG member so release has no
  elapsed-tick replay. Player, primary-spell, Tutorial, narration, UI, and
  application clocks remain live.
- Tutorial teardown, save retirement, world replacement, disconnect, and Game
  Over remove the new acknowledgement/pause condition with the existing
  controller state; there is no second timer or client-local objective owner.

## Recovered behavioral contract

- Desktop stage 0 resolves the current up/left/down/right key labels; mobile
  names the left joystick. Copy hides on the first nonzero user movement input,
  while native distance/narration progression continues independently.
- The gold Dig arrow starts only after the prelude, uses live responsive
  target/edge geometry, blinks on the stock application clock, and disappears
  at the first `digging -> turning` interaction edge.
- Ten authored opening Skeletons materialize at stage 2, then hostile
  simulation holds. Desktop retains stock point/click copy; mobile names the
  right joystick. The first accepted primary cast hides the lesson and releases
  hostile simulation on the next 100-Hz tick.
- Freeze means hostile-scene freeze, not global gameplay pause: the player must
  still aim/cast, and the overlay must remain readable. No elapsed hostile time
  is replayed after release.

## Nearby-system findings

- The flashing copy is not intermittent rendering. It is the exact consequence
  of faithfully porting retail's `enemyCount > 5` fallback together with the
  authored ten-Skeleton batch.
- The ordinary H-key Dig indicator already owns the correct responsive
  screen-edge geometry, but its SVG and user-toggle lifetime are not reused;
  the Tutorial consumes only its layout and paints exact UI record 28.
- Normal gameplay pause/resume grace is the wrong owner because both seal
  player primary input. No new pause protocol message or party hold is added.
- Reusable stock facts and the requested-policy boundary are also recorded in
  `Mod Loader/docs/re/tutorial-mechanics.md`.

## Confidence and open questions

- Confirmed: stage-0/2 instructions and completion branches, pointer-call
  membership, ten authored spawns, current one-tick reproduction, input/scene
  ownership, exact assets, protocol/save seams, and Dig encounter lifecycle.
- Inferred: none material.
- Unknowns: none. The requested web policy is fully representable.

## Web implementation consequence

- Extend the authoritative Tutorial state/input with movement acknowledgement;
  bump gameplay protocol 83 -> 84 and save schema 15 -> 16 with strict legacy
  normalization and backend inspector parity.
- Add pure desktop/mobile presentation planning using configured movement
  labels, and compose the opening Dig pointer from the live encounter plus the
  existing responsive Dig layout.
- Remove only stage 2's `enemyCount > 5` shortcut. Add a no-catch-up paused path
  to the enemy store and engage it only while the active Tutorial is at stage
  2. Do not set gameplay pause, resume grace, input blocked, or wall-clock
  timers.
- Remove the deterministic reproduction harness after the regression is
  promoted into repository tests.

## Validation contract

- Kernel: forced intro motion does not acknowledge; first nonzero desktop/touch
  movement does; stage 0 distance remains strict; ten Skeletons keep stage 2;
  first cast alone enters stage 3.
- Host/world: paused hostile store materializes initial spawns, then preserves
  actors/Maggots/projectiles/effects/death lanes/RNG and advances only its tick;
  release has no catch-up and primary cast is accepted.
- Protocol/save/backend: version 84/schema 16 exact round trip, malformed field
  rejection, current writer, schemas 1..15 migration, authenticated storage.
- Presentation: desktop rebound movement labels, mobile left/right joystick
  copy, exact UI-28 Dig pointer target/edge geometry, intro and encounter hide
  edges, accessible text, every later pointer/callout unchanged.
- Mac Chrome: natural desktop and mobile Tutorial runs capture stage-0 text and
  Dig arrow, move once, begin Solomon interaction, observe ten frozen Skeletons
  and durable cast copy, cast via mouse/right joystick, prove hostile release,
  then reach the unchanged Acid Rain lesson with empty page/console/network
  arrays. Run `/opt/homebrew/bin/bash ./scripts/validate.sh` on the exact tree.

## Implementation validation receipt

- `native-tutorial.ts` now records only authenticated nonzero movement input,
  projects configured desktop labels or mobile joystick copy, removes stage
  2's enemy-count shortcut, and releases that stage only after the existing
  primary-cast sequence advances. Protocol 84 carries the acknowledgement and
  save schema 16 persists it; current malformed saves fail closed and schemas
  1..15 migrate the absent field to false.
- `BoneyardScene` projects the authored Dig through the live camera only while
  the completed-prelude controller is in stage 0/1 and the encounter is still
  `digging`. `TutorialOverlay` paints exact UI record 28 on the stock blink
  clock. The ordinary Dig target/edge planner remains shared; its Tutorial
  wrapper clears a top-edge arrow to logical `y=230`, below both instruction
  baselines. The arrow is removed on the authoritative `turning` contact edge.
- `boneyard-enemy-store.ts` owns one selective paused tick. It materializes
  queued wave-1 intents and advances `lastStepTick`, but retains actors,
  Maggots, projectiles, projectile/death effects, lightning pulses, hostile
  clocks, and hostile RNG. Player movement, primary spell simulation,
  narration, UI, and pointer clocks remain live, and release performs no
  catch-up.
- The final local Website branch is based on `33543be5`; the detached Mac
  candidate is based on that exact commit. The local Mod Loader branch and Mac
  candidate share base `e9984747`. All 26 changed Website files and the one
  changed Mod Loader report were blob-identical before the final gates; this
  receipt is the only post-validation documentation write.
- The exact Mac Mod Loader candidate passed
  `tests/re/run_static_re_tests.py --ci` at `509/509`. The exact Website
  candidate passed `/opt/homebrew/bin/bash ./scripts/validate.sh`: backend
  Release build, 24 Website/backend contracts, lint/import/generated checks,
  all `2,353/2,353` frontend/desktop tests, production frontend and game-host
  builds, media policy, and bundle budget. `Game-CvZU2pDu.js` is `468,936`
  raw / `130,952` gzip bytes against `524,288` / `134,144` limits.
- Mac Chrome `151.0.7922.174` completed the combined stock desktop and mobile
  journeys. Desktop painted `Move with W, A, S, and D`; mobile painted left-
  joystick movement copy. Both painted a clear UI-28 Dig arrow at logical
  `y=230`, hid movement copy after the real movement action, and removed the
  arrow when Solomon contact began. The first ten Skeletons remained
  byte-stable across 25 authority ticks while stage 2 stayed visible. Mouse or
  right-joystick casting advanced primary sequence `0 -> 1`, released the hold,
  hid the cast copy, and entered stage 3. The stock path also retained the
  concurrently landed one-potion stage-18-to-19 correction. Page, console,
  failed-request, and failed-response arrays were empty in both scenarios.
- Manual inspection confirms that neither opening arrow intersects its
  instruction block and both cast lessons are legible over the retained
  Boneyard. Evidence SHA-256 values are `678aeb4c...fde46` (desktop opening),
  `fb48701d...eba3e` (desktop hold), `6a160f40...f183` (mobile opening), and
  `f4aaaf42...027d` (mobile hold). Full receipts and captures are retained at
  Mac `/Users/jarrett/codex-acceptance/tutorial-guidance-freeze-20260826-r3/evidence`
  and local `/home/user/.codex-evidence/tutorial-guidance-freeze-20260826/browser-r3`.
- No browser-platform exception or material unknown remains. The task is
  committed only on its isolated branches and remains unpushed; deployment was
  not requested.
