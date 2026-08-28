# 2026-08-22 — Held primary attack-pose continuity

## Reported smell and parity question

- Reported web behavior: holding mouse 1 with Ether repeatedly snaps the staff
  back through its opening poses while projectiles continue to fire, making the
  staff look as though the cast animation is constantly resetting.
- Requested behavior: play the first one-shot wind-up, then hold the actual
  release pose until the held attack and its already admitted action stop.
  Projectile cadence, aim, mana, damage, targeting, audio, and VFX lifetimes
  must remain unchanged.
- Native question: determine whether the reset is an authentic Staff Cast 1
  recurrence, a web-only idle insertion, or renderer-owned animation, then
  sweep every pure/welded primary and interruption branch sharing the player
  pose state.
- Falsifiers: a native action insertion writes `K=0`; a projectile handler or
  renderer owns the pose clock; a sustained cast shares the Cast 1 program; or
  holding the pose changes an emission tick/socket.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail instructions | `SolomonDark.exe` SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; `PlayerActorTick 0x0054961A..0x005496D6`; `0x0052DA80`; Staff Cast 1 constructor/tick `0x0044B170`/`0x0044B370` | Held input requeues the next one-shot action in the same player tick. Only released plus no action writes idle `K=0`; insertion retains the prior selector, then the successor replays its complete pose array. | high |
| Closed native animation corpus | Mod Loader `native-animation-state.md`; `animation-goldens.json` | One Staff Cast 1 action is fixed-tick state: insertion retains prior `K`, then branch A `1 -> 8 -> 7` or branch B `8 -> 7`; the live single-action witness starts from idle `K=0`. | high |
| Current web causal trace | Website `52146891c6ac00cd25face69628c1250b826969f`; `primary-spells.ts`, `player-character-presentation.ts` | Admission is decided from the previous action tick. Completion first publishes `-1`, the next tick admits at `0`, and `primaryCastPose` maps `-1`, `0`, and `1` to `K=0`; the full one-shot pose schedule then restarts. | high |
| Existing protocol/renderer contract | `PlayerPrimaryCastState.held`, exact snapshot decoder, Hub/Boneyard presentation timelines, shared `HubActorView` | The authority already replicates physical held state and discrete cast state to local and remote renderers. No React, input, or render-frame timer is needed. | high |

Native stock and the requested Website behavior are intentionally distinct.
Stock removes the web-only idle flash but still replays Cast 1 for each shot.
The user explicitly requested continuous attack-pose presentation, so this
entry records a narrow Website override instead of mislabeling it as native.

## System boundary and membership inventory

Native system: player primary action admission plus the actor-owned equipment
pose selector consumed by the shared Hub/Boneyard player renderer.

| Member (class/variant/scene/branch) | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| Ether `8` / Magic Missile held one-shot | `0x0052DA80`, `0x0044B170`, `0x0053CFE0` | `out-of-system` (explicit Website UX override holds release `K=8` after the first marker) | multi-cycle authority, draw-plan, and browser assertions |
| Fire `16` / Fireball held one-shot | same Cast 1 owner; `0x0053DC60` | `out-of-system` (same explicit pose override) | shared one-shot matrix |
| Welded one-shots `1000`, `1001`, `1002`, `1009` | `0x0052DA80`; concrete one-shot handlers | `out-of-system` (same explicit pose override) | all-four profile matrix |
| Air `24`, Water `32`, Earth `40` | `0x00548A00`; renewed Staff Constant | `verified-already-at-parity` | insertion `K=0`, then held `K=7`; regression matrix |
| Welded channel `1003..1005` and persistent `1006..1008` | sustained dispatcher and concrete handlers | `verified-already-at-parity` | all-six profile matrix |
| Staff Cast 1 first wind-up and first marker | `0x0044B170`/`0x0044B370` | `exact-ported` | existing pose/socket goldens plus first-cycle test |
| One-shot projectile cadence, marker/socket, mana, combat, VFX, and audio | concrete handlers and existing primary/weld ledgers | `verified-already-at-parity` | emission sequence/tick and unchanged-owner tests |
| Hub Courtyard/private-room primary input | Hub combat seal and `primaryCastingEnabled: false` | `verified-already-at-parity` | no Hub primary packet/action is admitted |
| Hub/Boneyard timelines and shared player renderer | replicated player state and `HubActorView` | `exact-ported` for the requested override | both discrete-timeline tests plus Boneyard browser journey |
| Release, input loss, ineligibility/death, owner removal, and scene teardown | player-cast reset/removal owners | `exact-ported` for the requested override | deterministic reset/teardown assertions |
| Simultaneous secondary/staff-melee action | higher-priority Staff Cast 2/melee transient | `verified-already-at-parity` | existing precedence plus retained regression |
| Native bare-hand Cast 1 mode `6` and Wand Cast 1 mode `9` | `0x0052DA80` item selection | `out-of-system` (the reported and current Website primary-pose owner is the staff attachment composite) | explicit boundary; no fabricated pose-bank substitution |

No member is blocked by the browser platform. The only visible stock
difference is deliberate: after the first one-shot marker, stock replays its
wind-up/release/recovery program per projectile while the Website holds `K=8`
through the held burst.

## Native ownership thread

- Owner and construction: the fixed-tick player action queue owns Cast 1;
  `actor+0x238` owns the visible equipment/body selector. Input owns only held
  level and aim.
- Producers: `PlayerActorTick` admits a Cast 1 action only when the current
  action slot is free; the action tick writes pose and calls the one-shot
  dispatcher at its progress marker.
- Consumers: the projectile handler samples the action-owned Staff socket;
  player drawing samples the replicated pose state. Renderer sampling never
  advances either clock.
- Interruption/teardown: release prevents another admission but does not cancel
  the already queued action. Death/ineligibility and owner/scene removal clear
  the cast presentation with the player owner.

## Recovered behavioral contract

- Keep the first native one-shot program through its release marker. At that
  marker, latch displayed Staff release pose `K=8` for the rest of the same
  held burst and any repeatedly admitted one-shot actions.
- Keep the latch through a mouse-up while the last admitted action finishes;
  clear it when that action becomes idle, or immediately on authority loss,
  death/reset, owner removal, or scene replacement. A later new press must play
  its first wind-up again.
- The latch is authoritative discrete presentation state. It is replicated and
  sampled by both scene timelines; it is not a Pixi/React timer or a local-only
  renderer memory.
- Projectile emission continues to sample the original Cast 1 action pose.
  The held display pose is also `K=8`, so the rendered orb and every repeated
  one-shot marker retain the same Staff socket without changing projectile
  geometry.
- Sustained/persistent primaries keep their native Staff Constant `K=7` rule.
  Secondary and melee actions retain their higher presentation priority.

## Nearby-system findings

- The existing web model has a separate native-parity defect even without the
  requested override: it publishes three `K=0` fixed ticks around a held
  one-shot requeue, while stock retains the prior selector on insertion.
- The durable native handoff finding is recorded in Mod Loader
  `docs/reverse-engineering/native-projectile-and-spell-mechanics.md`.

## Confidence and open questions

- Confirmed: native action/admission ordering, all pure and welded primary
  cast kinds, Website reset source, scene/replication owner, marker pose, and
  override boundary.
- Inferred: none material.
- Unknown: none for the requested Staff branch. Bare-hand and Wand Cast 1 art
  remain explicitly outside this staff-composite change rather than guessed.

## Web implementation consequence

- Add one discrete boolean to `PlayerPrimaryCastState`, set only when a
  one-shot crosses its first emission marker and cleared on the lifecycle above.
- Add a presentation-pose selector that consumes this latch. Keep
  `primaryCastPose` and `primarySpellEmitter` as the native action/socket model
  so combat geometry and cadence do not move.
- Use the selected displayed pose for both the staff textures and its orb
  attachment. Do not add renderer timers, per-element exceptions, cooldowns,
  delayed callbacks, or an input-side animation path.

## Validation contract

- Focused authority tests: Ether and Fire plus welded `1000/1001/1002/1009`
  play the first program, emit repeatedly at unchanged ticks, remain displayed
  at `K=8` after the first marker, finish the last admitted action on release,
  clear to idle, and replay the first wind-up on a new press.
- Sibling tests: pure Air/Water/Earth and welded `1003..1008` retain Constant
  pose `K=7`; secondary/melee precedence and reset/teardown stay intact.
- Protocol/timeline tests: the latch strict-round-trips and remains discrete
  across Hub and Boneyard interpolation.
- Browser: retain the Hub no-primary-input assertion. In a real active
  Boneyard, hold Ether across at least three emissions; after the first observed
  `K=8`, every held sample remains `8`, emission sequence continues, mouse-up
  settles to `0`, and all page, console, protocol, asset, and WebGL error arrays
  remain empty.
- Run the canonical `./scripts/validate.sh` gate and the final Mac-mini suite
  and hardware-browser acceptance on the exact integrated tree.

## Implementation validation receipt

- The player authority now carries `oneShotAttackPoseHeld`. The first one-shot
  marker latches it, repeated held actions are admitted on the same completion
  tick rather than publishing a web-only idle gap, release retains the latch
  through the last admitted action, and reset/ineligibility clears it. The
  action-owned `primaryCastPose` still owns projectile sockets and cadence;
  `primaryCastPresentationPose` alone selects held `K=8` for the shared player
  renderer and orb attachment.
- Protocol 59 strictly carries the boolean alongside the Fire-lifecycle and
  Game Over/loadout fields and rejects it outside Ether, Fire,
  or welded one-shot bursts. Hub and Boneyard presentation timelines retain it
  discretely. Focused matrices cover pure Ether/Fire, welded
  `1000/1001/1002/1009`, all nine sustained/persistent siblings, release,
  re-press, ineligibility, secondary/melee precedence, and exact socket
  separation.
- Local Linux Chrome Boneyard acceptance used deterministic generated template
  0 (run seed 12), crossed its real entry Gate, contacted Solomon, completed
  the greeting/run edge, and then held Ether from emission sequence `0` through
  `3`. After first `K=8`, all 9 rendered samples across 9 authoritative ticks
  remained `8`; 25 wire samples retained the latch without an idle action tick.
  Mouse-up completed the last action and published `actionTick=-1`, latch false,
  and attachment pose `0`. Page/console error arrays were empty. The inspected
  1600x900 impact capture is
  `/tmp/solomon-held-primary-pose-fnNOCd/solomon-primary-ether-boneyard-impact.png`,
  SHA-256 `7d6e51f652b4f5d29fad2845caa2fb42ea2e34e75dc6a1120c1c08a684419948`.
- The exact integrated Website tree is based on current `origin/main`
  `44e484e1172f537c9857f4decc6c2b0c2d966aa2`; the exact Mod Loader tree is
  based on `8384eaab53ae502077f7d871ef469bba2b926bca`. Every changed-file SHA-256
  matched between the Linux worktrees and their detached Mac validation
  worktrees. The rebased exact-tree Mac canonical Website gate passed: backend
  `17/17`; frontend groups `4/4`, `44/44`, `234/234`, `1374/1374`, `9/9`,
  `43/43`, `11/11`, `7/7`, `17/17`, and `21/21`; desktop `5/5`; strict lint
  and import boundaries; production backend/frontend/game-host builds; media
  policy; and bundle budget `420344` raw / `117565` gzip bytes. The affected
  Mac matrix separately passed `158/158`. Only the repository's existing Fast
  Refresh and chunk-size warnings remained.
- The exact Mod Loader tree passed its CI-capable static RE suite `492/492`
  on the Mac with Python 3.12.13, including the new action-handoff/membership
  contract.
- Final Mac hardware acceptance ran on macOS 26.6.2, Node 22.17.0, npm 10.9.2,
  .NET 10.0.302, Python 3.12.13, and Chrome 151.0.7922.170. The browser crossed
  the authored Gate, completed Solomon's Dig greeting/run edge, and held Ether
  from emission sequence `0` through `3`. All 29 rendered samples on 29 ticks
  stayed at `K=8`; all 24 wire samples retained the latch with no idle action
  tick. Release published `actionTick=-1`, latch false, and attachment pose
  `0`. Pixi used WebGL2 through
  `ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)`; page
  and console errors were empty. The inspected 1600x900 held-pose capture is
  `/Users/jarrett/codex-acceptance/evidence/held-primary-cast-pose-publish-20260822-root/solomon-primary-ether-boneyard-held-pose.png`,
  SHA-256 `76ea745cea7d0e79946e7459836ae16072021285a6dad8df48f7cbc98df61934`;
  the impact capture SHA-256 is
  `19e5ec7fd39b7734d1265a0aee35ed0625db4606c8420cf9837a731845b62785`.
- No member is blocked by the browser platform and no material unknown remains.
  The stock-per-shot pose replay remains the disclosed intentional Website
  difference requested here. Commit and fast-forward publication to `main`
  are authorized for this closure; deployment remains out of scope.
