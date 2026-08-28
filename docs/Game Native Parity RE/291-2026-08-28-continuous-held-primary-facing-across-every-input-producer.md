# 2026-08-28 — Continuous held-primary facing across every input producer

## Reported smell and parity question

- Reported web behavior: with one-shot primaries such as Ether selected, moving
  the aim while primary attack remains held does not continuously turn the
  wizard. Facing updates only when the next projectile action is admitted.
- Requested behavior: while primary attack is physically held, the player's
  authoritative rotation must follow current aim continuously for mouse 1,
  the touch attack joystick, and standard gamepad input. The rule must apply to
  every primary family, not Ether alone.
- Stock behavior to recover: determine whether the between-emission lock is a
  web defect or the native Staff Cast 1 action contract, and preserve the
  distinction if the requested behavior intentionally exceeds retail.
- Reproduction inputs/scenes: enter an active Boneyard with Ether, hold primary
  north through the first emission, move aim east without releasing, and
  inspect authoritative and rendered heading before cast sequence 2 begins.
  Repeat the kernel contract for Fire and every welded one-shot; retain existing
  held retarget behavior for sustained and persistent primaries.
- Falsifiers: a same-level aim update is lost in the browser/session queue; the
  native actor actually writes heading during occupied Staff Cast 1; only Ether
  owns the stale interval; or a renderer-local transform is the sole facing
  owner.

This is a secondary report against the 2026-08-26 held-pointer entry. That pass
proved pointer reprojection, same-level network ordering, and the aim captured
by consecutive Ether/Fire actions, but it did not sample player heading between
those action admissions. It conflated a live input sample with a live actor
heading. The system is reopened here across the missed interval and all
one-shot siblings.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | retail Beta 0.72.5 `SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Current on-disk executable matches the canonical G14/primary-spell evidence image. | high |
| Fresh canonical instructions | read-only Ghidra replica wrapper; `PlayerActor::Tick 0x00548B00`; vector producer `0x0052C910`; heading converter `0x0042D280`; ranges `0x00549347..0x005495ED` | The tick loads current movement, aim, and held level, then `CMP PlayerWizard+0x160,0` / `JNZ 0x005495F0` at `0x005493D3..0x005493DA` skips both movement and attack-facing writes while a one-shot action owns the actor. Retail retains action-entry heading until the next action. | high |
| Durable native system reports | `native-input-model.md`; `native-projectile-and-spell-mechanics.md`; `native-skills-and-spells.md` | Mouse capture/reanchor produces current held aim. Ether/Fire and welds 1000/1001/1002/1009 use one-shot Staff Cast 1; all other pure/welded primaries are channel or persistent consumers. | high |
| Current Website causal trace | `input/gameplay-input.ts` -> `game-client-session.ts` -> `game-simulation.ts` -> `primary-spells.ts` | Mouse move publishes immediately; touch direction and standard gamepad are sampled into the same `PlayerCharacterInput`; same-level updates reach authority. `aimSamplesInput = rawHeld && (sustainedPrimary || actionAvailable)` alone withholds new aim from occupied one-shot casts, and `primaryCast.aimDirection` owns both heading and later emission direction. | high |
| Existing focused coverage | `gameplay-input.test.ts`, `game-client-session.test.ts`, `primary-spells.test.ts`, and `smoke-primary-spells.mjs` | Producers, coalescing, sustained retargets, and next-action Ether/Fire aim are covered. No assertion requires heading to change while cast/emission sequences are still unchanged. | high |

The requested always-track behavior is an explicit Website policy divergence
from retail. The native evidence is retained because it predicts the exact
visible difference: retail one-shot wizards hold action-entry facing between
shots; the Website wizard will follow live held aim.

## System boundary and membership inventory

System: primary held-aim production, ordered delivery, authoritative cast aim
and heading, body/staff/socket consumption, later emission direction, snapshot
replication, and release/barrier teardown for all pure and welded primaries.

| Member / branch | Native or web owner | Disposition | Required proof |
| --- | --- | --- | --- |
| desktop left down/move/up and window capture | `0x0042FF80/0x004301F0/0x004303D0`; `gameplay-input.ts` | `verified-already-at-parity` producer | held mouse move publishes the new pointer outside the canvas; release remains ordered afterward |
| player/camera reprojection and torso anchor | `0x0042FE50`, `0x005D7EF0`; `gameplay-pointer.ts` | `verified-already-at-parity` | stationary pointer reprojects as actor/camera changes; exact 25-screen-pixel anchor remains |
| touch primary joystick | browser producer into shared aim/held fields | `verified-already-at-parity` | held direction updates and zero/cancel releases without touching movement |
| standard gamepad right stick plus primary trigger | browser producer into shared aim/held fields | `verified-already-at-parity` | changing right-stick direction while trigger remains held changes sampled aim and retains primary level |
| session coalescing and cast-edge ordering | `game-client-session.ts` | `verified-already-at-parity` | same-level aim replacement reaches authority; release occupies a later host tick |
| authoritative held-aim/facing owner | `primary-spells.ts` | `exact-ported` requested Website policy | every held cast samples current input regardless of one-shot action availability; authoritative heading changes before action/emission sequence advances |
| Ether 8 Magic Missile | one-shot Staff Cast 1 / `0x0053CFE0` | `exact-ported` requested divergence | north-to-east move turns body/staff during cast 1 recovery, before cast 2 or emission 2; emitted child fan uses latest aim |
| Fire 16 Fireball | one-shot Staff Cast 1 / `0x0053DC60` | `exact-ported` requested divergence | same pre-successor heading proof; born Fireball uses latest marker-time aim and remains straight afterward |
| Air 24 Lightning | sustained handler `0x0053F9C0` | `verified-already-at-parity` | live held ray and heading continue to retarget; no timing or target-retention change |
| Water 32 Frost Jet | sustained handler `0x00543860` | `verified-already-at-parity` | live held cone and heading continue to retarget; release stops channel |
| Earth 40 Boulder | persistent handler `0x00544C60` | `verified-already-at-parity` | held boulder tracks current aim; release freezes latest direction |
| welds 1000, 1001, 1002 | one-shot Ether-derived missile handlers | `exact-ported` requested divergence | each occupied action consumes changed held aim immediately, before the next cast sequence |
| weld 1009 GroundSpark | one-shot handler `0x00545FC0` | `exact-ported` requested divergence | same shared heading transition without changing spark count/geometry |
| welds 1003, 1004, 1005 | channel handlers | `verified-already-at-parity` | existing live held direction, collision, and teardown contracts remain |
| welds 1006, 1007, 1008 | persistent/charge handlers | `verified-already-at-parity` | existing actor/target updates and release behavior remain |
| body, robe, staff, orb, and emitter socket | authoritative `headingIndex` plus shared 24-way attachment selection | `exact-ported` through shared state | rendered heading equals wire heading; no CSS/Pixi-only rotation owner |
| born projectile in-flight steering | projectile-family state | `verified-already-at-parity` | Fire/Earth stay ballistic; Ether/welded missiles retain actor-target homing only; later cursor motion does not steer already-born actors |
| local/remote snapshot and presentation timelines | protocol player heading and primary cast | `verified-already-at-parity` | local and observer render the same updated heading; no new protocol field |
| release, mouse/touch cancel, trigger fall, blur, hidden, block, death, scene reset, disconnect | existing input and cast teardown owners | `verified-already-at-parity` | last held aim freezes only for an already-live action; no stale hold resumes across a barrier |
| Hub primary suppression and modal/level-up barriers | scene/combat admission policy | `out-of-system` (no admitted primary cast) | held-facing change cannot bypass existing seals |
| quickbar/secondary aimed placement | category-2 accepted-point owner | `out-of-system` (not primary held rotation) | no secondary placement or cooldown change |

No member is blocked by the browser platform. There is no new asset, authored
table, audio record, collision shape, random branch, or protocol field in this
system.

## Native ownership thread

- Owner and construction: mouse/touch/gamepad producers create one
  `PlayerCharacterInput`; the host primary-spell kernel owns accepted cast aim,
  heading, action state, and emission state.
- Upstream producers: window mouse capture, touch primary direction, and
  standard gamepad right-stick/trigger all publish the same world aim plus held
  Boolean. The session coalesces same-level aim but preserves level edges.
- State and transitions: press starts a cast when eligible; every held tick now
  refreshes authoritative aim. One-shot action availability still controls only
  cast-sequence admission, not facing. Release stops refreshing, leaving the
  last direction for any already-live action until its existing retirement.
- Downstream consumers: `headingIndex`, player body/robe/staff/orb composition,
  emitter socket, target queries, and marker-time projectile construction read
  the shared cast direction. Snapshot projection replicates it to all clients.
- Siblings: pure Ether/Fire and welded 1000/1001/1002/1009 share the formerly
  gated one-shot branch. Pure/welded sustained and persistent families already
  sample live held aim and serve as the reference behavior.
- Teardown: input interruption lowers levels; cast reset/death/world teardown
  clears primary state and owned spell actors through existing paths.

## Recovered and requested behavioral contract

- Timing: host-facing changes on the next authoritative 100 Hz tick that
  consumes a changed held aim. It must occur while the current one-shot
  `castSequence` and `emissionSequence` are unchanged, not merely at the next
  projectile marker.
- Geometry: keep the normalized world pointer ray from the 25-screen-pixel
  torso anchor. Direction magnitude and viewport scale do not change heading.
- Render/order: authority writes heading before snapshot publication; renderer
  and staff attachment consume that heading. No presentation interpolation may
  invent a different target.
- Spell behavior: the newest held direction is the later emission direction.
  Already-born projectile steering is unchanged and never follows the cursor.
- Input/replication: the policy is device-agnostic after
  `PlayerCharacterInput`; local and remote clients observe the same host state.
- Failure behavior: ineligible/sealed input cannot turn through this cast path;
  release and lifecycle barriers remain authoritative.

## Nearby-system findings

- Durable finding: retail loads the current aim before the `+0x160` action
  guard but does not apply it to actor heading while Staff Cast 1 is occupied.
- Evidence: instruction ranges `0x00549347..0x005495ED`, recorded in the
  updated native input and projectile reports.
- Why it matters: future retail-parity audits must distinguish current device
  state, accepted action aim, actor heading, and projectile steering rather
  than calling all four lanes “aim.”
- Native reports updated: `native-input-model.md` and
  `native-projectile-and-spell-mechanics.md`.

## Confidence and open questions

- Confirmed: native one-shot heading lock, full pure/weld cast-kind membership,
  current web gate, all browser input producers, authoritative/replicated
  heading owner, and projectile steering boundary.
- Inferred: none in the implementation path.
- Unknown: none material. The only intentional visible difference is named:
  Website one-shot wizards track held aim continuously while retail retains
  action-entry facing.

## Web implementation consequence

- Correct owner: simplify the shared aim-sampling condition in
  `core-kernels/primary-spells.ts`; do not special-case Ether or rotate a
  renderer object.
- Shared model: physical held state controls live aim sampling for every primary;
  action availability continues to control admission/cadence only.
- Preserve: mana, cast clocks, pose latch, projectile counts, target acquisition,
  collision, audio, RNG, replication schema, release, and teardown.
- Remove: only the one-shot `actionAvailable` restriction on held aim. Retain
  the `sustainedPrimary` classification for its separate Staff Constant
  weapon-overlay lifecycle.

## Validation contract

- Red/green kernel: for Ether, Fire, and welds 1000/1001/1002/1009, begin north,
  change held aim east on the next occupied-action tick, and require aim plus
  heading east while cast/emission sequences remain unchanged. Existing
  sustained/persistent and released one-shot suites remain green.
- Producer/session coverage: retain held mouse/touch projection and ordered
  same-level host delivery; explicitly move a standard gamepad right stick
  while its trigger remains held.
- Browser: real Mac Chrome/WebGL2 Boneyard Ether journey holds mouse 1 through
  emission 1, moves the cursor, and captures authoritative plus rendered east
  heading before cast sequence 2. Repeat the authority contract through the
  device-independent kernel; inspect a screenshot for body/staff alignment.
- Full gate: run `/opt/homebrew/bin/bash ./scripts/validate.sh` on the exact
  byte-identical Mac candidate with empty page, console, and failed-response
  arrays.

## Implementation validation receipt

- Implementation: `primary-spells.ts` now samples `input.aim` on every
  physically held primary tick. Action availability still owns one-shot cast
  admission/cadence, and `sustainedPrimary` still owns only the separate Staff
  Constant weapon-overlay branch. No renderer, protocol, projectile-flight,
  mana, audio, RNG, collision, or teardown rule changed.
- Complete membership regression: `primary-spells.test.ts` covers Ether 8,
  Fire 16, and welded one-shots 1000/1001/1002/1009. Each starts north, moves
  east on the next occupied-action tick, and reaches aim `(1,0)` / heading 6
  while cast and emission sequences remain unchanged; each later emission also
  retains the moved aim. Existing Air/Water/Earth and welded
  1003..1008 channel/persistent coverage remains unchanged. The standard
  gamepad producer now explicitly moves its right stick from east to west while
  the primary trigger stays held; existing mouse, touch, coalescing, barrier,
  and release tests retain the other producer/lifecycle rows.
- Red receipt: on the test-only Mac candidate, 1,733 existing Boneyard tests
  passed and only the new all-one-shot test failed. Ether 8 retained native/web
  old aim `{x:0,y:-1}` instead of expected `{x:1,y:0}` while its sequences were
  unchanged. This directly identified the removed `actionAvailable` sampling
  restriction rather than an Ether renderer symptom.
- Current integration bases are Website `8279c379901cc0d4bf7367dd529fd055c9b781d1`
  and Mod Loader `f31429459320a7ece21c98e3fc6c45afd747be6f`.
  All six Website files and both Mod Loader files were SHA-256-identical between
  local and detached Mac worktrees under Website r6 and Mod Loader r3 before
  their current-base validation.
- macOS `26.6.2` build `25G83` passed the complete Website gate on that rebased
  candidate: backend build with zero warnings/errors, all 29 Website/backend
  contracts, formatting, lint/boundaries/generated checks, `314/314`
  pre-Boneyard tests, `1,750/1,750` Boneyard tests, all other registered
  frontend groups, `86/86` Hub UI tests, `5/5` desktop tests, production
  frontend/game-host builds, bundle budget, and CSP/media policy. Production
  entry `Game-B_9XJXjd.js` measured `261,906` raw / `79,462` gzip bytes. The
  pre-receipt gate-log SHA-256 is
  `9f3f529085819249e62da09ff12d56c6b7e281a24ac0be6e2a4b092b149e84bd`;
  one final exact-tree gate follows this receipt edit, with no later tracked
  source/test/harness change permitted.
- The rebased Mod Loader portable static registry passed `530/530`; its log
  SHA-256 is
  `3bac54e9201a296af688fb269062eb6bd34e910e22fdcce376ff2686bb8665ab`.
- Chrome `151.0.7922.174` completed the real held-mouse Boneyard journey on the
  final shared-heading integration with empty page, console, and
  failed-response arrays. Cast/emission stayed `1/1` while aim moved from
  exactly `(0,-1)` at tick 905 to `(0.990783,0.135459)` at tick 910.
  Authoritative and rendered heading both changed `0 -> 7` at action tick 23,
  before the successor action. The held
  release pose remained live across 26 sampled authoritative ticks and three
  emissions, then retired to action `-1`, attachment pose 0, and
  `oneShotAttackPoseHeld=false`.
- Browser rendering was WebGL2 through ANGLE Metal on Apple M2. The final
  1600-by-900 held-facing screenshot was visually inspected: body, staff, and
  Ether glow share the new rightward heading while the current weather/render
  pipeline remains intact. Retained screenshot SHA-256 values are
  `1c4b99587db18974a8d06808470183a7fc411a32cd31e4e35bf4586a037cc057`
  (held facing),
  `2df99348d2344523a4b2b10074ec7f5ceea3401d98b307679e494f48d362548e`
  (multi-emission held pose), and
  `b9a72cfe84567aee01a312a73b088788f485d038ff3920842ac539379f8632e2`
  (impact). The final browser-receipt log SHA-256 is
  `42b42e76219bbf0b756f7ea6c9d1e19ff5f0fd85e0893db6bcf6bf55f9fd6ab4`.
- Browser setup provenance: two obsolete generated-route attempts stopped in
  the pre-cast horizontal gate alignment, so the final acceptance reuses the
  established host-opened combat fixture while retaining real Chrome mouse
  input and authoritative rendering. One first final-base sample timed out in
  the strict inter-snapshot wire/render wait; diagnostic capture was added
  without weakening the predicate, and that unchanged tree then passed twice
  consecutively. The later shared-heading rebase passed independently on its
  first complete browser run. On the final Insight rebase, diagnostics exposed
  another harness-only false rejection: the actor visibly changed heading
  `4 -> 6`, but an unrelated dot-product threshold demanded a larger angular
  turn. The final predicate now requires exactly the product contract—a changed
  24-way heading with matching wire/render state before either sequence
  advances—and the r5 journey passed. No setup-only stop was counted as product
  evidence.
- Platform constraints and unknowns: none. The sole predicted retail
  difference is intentional and requested: retail Staff Cast 1 locks
  action-entry facing, while Website one-shot casts continuously follow held
  aim. Publication and deployment were not requested and were not performed.
