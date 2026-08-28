# 2026-08-26 — Tutorial camera-lock live-enemy safety correction

## Reported smell and parity question

- Reported behavior: walking far enough north makes the previous Tutorial area
  visually off-limits; enemies left there are not forced out and can become
  unreachable, preventing the enemy-count stage from advancing.
- Stock question: determine whether trigger 642218 changes map/collision
  bounds or relocates live enemies, then close every existing/spawned/moving /
  resumed hostile branch around the camera transition.
- The 2026-08-24 entrance-fence pass explicitly made spawn admission safe but
  did not disposition an enemy already outside the future camera target or an
  enemy crossing it after lock. It also never closed hostile Gate contact.
- Falsifiers: a hidden native combat-wall write, enemy cleanup/teleport, a
  Badguy that can push the Gate, post-lock births guaranteed inside the target,
  or a web camera that stays full while a required enemy is outside.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail camera/cleanup | trigger 642218/script 642219; `0x00464B20`, `0x0046E570`, `0x004728B0` | Camera target becomes `(0,0,2043,849.91796875)` and remains. Cleanup omits Fence, player, and BadGuys; no movement-bound or relocation write exists. | high |
| Fresh Gate xrefs | `0x00646D00 -> 0x005E39B0`; Gate vtable `0x00799D9C`; Region collider vtable `0x0079F078` | Gate motion requires current actor flags bit 1. | high |
| Actor construction/collision | Player `0x0052B4C0` flags `0x801`; Badguy `0x00473390` flags `0x2`, exclusion mask `0x80`; Gate mask `0x100`; resolver `0x00522CE0` | Players push Gate. Badguys collide because `0x80 & 0x100 == 0`, but cannot push it and can be trapped behind a closing leaf. | high |
| Current Website | Tutorial camera depends only on trigger/state; world enemy movement remains full-bounds; locked spawn only target-bounds retry candidates while dark raw fast paths bypass | A live or newly accepted enemy can remain outside the camera indefinitely; current state has no safety release. | high |
| Existing stock observation | clean 1600x900 opening capture from the 2026-08-24 pass | Normal authored flow kept opening enemies on the combat side; it does not prove recovery from adversarial kiting. | high for observed flow |

## Direct answer and recovered contract

Stock does make the lower region leave the usable **camera**, but it does not
turn it into a new collision/map boundary. It removes off-target static scene
families after 300 ticks, keeps the Fence/Gate and every live enemy, and never
forces an enemy north. Because Badguys collide with but cannot push the Gate,
the reported rare soft lock is reachable as a stock edge case even though the
ordinary encounter avoids it.

## System boundary and membership inventory

Native system: Tutorial trigger-to-camera/cleanup plus all progression-relevant
hostiles and ground Sack carriers whose live circles can lie outside the
future camera target. Website safety extension: never hide a required enemy or
pickup.

| Member | Source | Disposition | Proof contract |
| --- | --- | --- | --- |
| authored trigger and persistent interpolation | 642218/642219, `0x00464B20/0x0046E570` | verified-already-at-parity | ordinary empty/clear transition unchanged |
| static/spatial cleanup membership | `0x004728B0` | verified-already-at-parity | no enemy/Fence deletion claim |
| PlayerWizard movement | full Arena; flags `0x801` | verified-already-at-parity | no invented target collision wall |
| Skeleton/Archer Tutorial actors | Badguy family flags/masks | exact safety projection | every registered circle, including dying rows, must fit target before retirement |
| Maggot/Coffin child family | no authored Tutorial producer | out-of-system for ordinary authored waves; generic safety member for loaded/extended state | current/save coverage |
| Tutorial and ordinary ground Sack carriers | death reward / linked Tutorial drop; radius 15 | exact safety projection | amulet, potion/equipment, key, nested, and mod-content Sacks remain reachable until pickup/retirement |
| Gate leaves/Fence | persistent manager; Gate contact rule | verified-already-at-parity | remain physical, player-pushable, enemy-nonpushable |
| pre-lock existing enemy outside target | browser safety extension | exact requested fix | camera remains/reopens full; no teleport/delete |
| pre-lock all enemy/loot bodies inside target | authored trigger plus Website safety | verified-already-at-parity for clear ordinary flow | lock starts normally |
| post-lock dark/offscreen/light births | all Tutorial batch policies | exact requested fix | full circle admitted inside target, including dark fast path |
| post-lock enemy movement/knockback outside target | native full movement | browser safety extension | immediately suspend camera lock so actor stays visible/reachable |
| save/resume or late snapshot with unsafe locked state | browser persistence boundary | exact requested fix | first authoritative tick restores full camera without schema change |
| ordinary generated/custom Boneyards | separate arena-transition/custom owner | out-of-system | unchanged |
| scene teardown/new Tutorial | existing world replacement | verified-already-at-parity | no safety state leaks |

No member is blocked by the browser platform.

## Web implementation consequence and validation contract

- Add one pure full-circle predicate against
  `NATIVE_TUTORIAL_CAMERA_TARGET`. The authoritative Tutorial tick may retain /
  start its camera lock only while every registered actor/maggot and ground
  Sack carrier is safe.
- If a locked live/save state becomes unsafe, clear the lock/age/cleanup edge
  immediately; when clear again, the authored player trigger can restart it.
  Do not teleport, delete, damage, or retarget the hostile.
- While locked, combine the exact entrance-Fence birth domain with the camera
  target for every policy, including dark raw fast paths.
- Red tests: player inside trigger plus one living outside actor currently
  locks; an already locked unsafe state stays locked; a dark direct post-lock
  root outside target is accepted. Green tests invert all three, cover boundary
  equality/radius, dying and ground-Sack retention, re-lock, save-shaped state,
  and ordinary/custom negatives.
- Mac Chrome journey must show the full camera and reachable enemy while one
  living root remains outside, then remove/move that enemy, observe the normal
  lock, and prove representative post-lock births remain visible. Capture
  empty page/console/response/host error arrays.

## Implementation validation receipt

- Implementation: `nativeTutorialCameraLockSafetyClear` requires every current
  enemy actor, Maggot, and radius-15 ground Sack carrier to fit wholly inside
  `NATIVE_TUTORIAL_CAMERA_TARGET`. `GameSimulation` computes that participant-
  private authoritative predicate before the Tutorial tick. An unsafe pending
  or saved lock clears trigger/age/cleanup immediately without changing enemy,
  loot, Gate, player, RNG, damage, or stage state; the authored trigger starts
  it again once the world is safe.
- Post-lock births: `boneyard-world.ts` composes the exact entrance-Fence
  domain with the target-circle predicate for every Tutorial policy, including
  dark raw fast paths. Ordinary generated/custom Boneyards remain unchanged.
- Red receipts: the current browser locked while enemy 20 remained outside;
  `red-tutorial.log` records `true !== false` at the explicit safety assertion.
  The red canonical gate also rejected the absent safety exports/host owner.
- Mac Chrome: the final responsive stock journey holds the full camera at
  `(1025,800)` while enemy 20 remains reachable at
  `(1056.7906494140625,1444.8121337890625)`, then continues holding it for an
  authored amulet Sack at `(1100,1300)` after the enemy store clears. After the
  Sack retires, the ordinary 464-tick lock settles at target
  `(0,0,2043,849.91796875)` with
  rendered camera `(1025,516.5846354166667)`. All four Tutorial spawn families,
  stage/HUD geometry, Staff melee, College admission, and four responsive
  viewports retain empty page/console/response arrays. Log:
  `evidence/green-tutorial.log`.
- Visual inspection: `green-tutorial-unsafe-enemy-camera-full.png` retains the
  lower approach while the unsafe enemy exists; the later
  `green-tutorial-stock-camera-locked.png` shows the normal upper target only
  after safety clears.
- Stock answer remains explicit: this safety release is a Website extension.
  Retail locks only the camera/cleanup target, does not create a new collision
  boundary, does not relocate enemies, and lets Badguys collide with but not
  push the Gate.
- Automated and native-document acceptance is shared with the SkillDragger
  receipt above. No protocol/save schema change or browser-platform block was
  introduced. Changes are local; nothing was pushed or deployed.
