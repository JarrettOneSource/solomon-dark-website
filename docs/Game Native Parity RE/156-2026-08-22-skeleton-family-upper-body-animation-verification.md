# 2026-08-22 — Skeleton-family upper-body animation verification

> **Superseded the same day by the user-corrected walking-articulation audit
> below.** The attack and head evidence in this section remains valid. Its
> interpretation that stock walking leaves the torso static, and therefore its
> no-gameplay-change conclusion, are false.

## Reported smell and parity question

- Reported web behavior: Skeleton top-half animation appears not to play.
- Stock behavior to distinguish: ordinary locomotion advances the shared limb
  selector while the torso/equipment selector remains independent; the upper
  body visibly changes during claw, ordinary-weapon, Pike, Archer-shot, and
  Mage-cast actions. Skeleton/Mage also own an action-local head-facing lane.
- Reproduction: compare a pinned stock Skeleton action, the complete authored
  family tables, a synthetic WebGL compositor transition, and a real
  host-authoritative Skeleton action through protocol, presentation timeline,
  and Pixi WebGL on the Mac mini.
- Falsifiers: a live action whose `actionProgress` changes while `bodyPose` or
  the rendered crop stays fixed; a protocol/timeline sample that drops the
  selector; any stock locomotion frame that copies gait `+0x144` into torso
  `+0x150`; or a sibling action/table row absent from current coverage.

This reopens the 2026-08-16 selector-axis and 2026-08-20 independent-head
entries. Those passes proved exact tables, synthetic Skeleton pixels, organic
action names, and organic head turns, but did not retain one deterministic
ordinary-game receipt that tied a real actor's authoritative torso poses to
pixels from the same action. That missing end-to-end acceptance seam allowed a
later observer reasonably to suspect the renderer even though the product path
was still correct.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Clean stock capture | `Mod Loader/tests/fixtures/webgame/animation-goldens.json`; instance `anm-g4`; contiguous Region renders; captured 2026-08-06; 10 ms fixed tick | Skeleton ticks `19934,19938,19943,19948` keep limb record `1629` while torso records change `1233,1233,1251,1269`; the head changes `1485 -> 1484` at the active edge. Archer's preserved attack frames contain body records `510,528,546,564,582,600,474,456`; Mage contains `1769,1805,1787,1733`. | high |
| Executable identity | capture header and existing native reports | Retail Beta 0.72.5 `SolomonDark.exe`, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`. | high |
| Instructions | renderers `0x0048DEE0`, `0x0048F450`, `0x00491720`; action ticks cataloged in `native-animation-state.md` | Locomotion reads `+0x144`; torso and Skeleton weapon overlays read `+0x150`; signed `+0x224` affects only skull/headgear. Action ticks write torso state, and render sampling advances none of these fields. | high |
| Mac synthetic WebGL | Website `ba950926ce3a5f14e0d874061230329c28719234`; macOS 26.6.2 arm64; Chrome 151.0.7922.170; `smoke-enemy-animation-projectile-vfx.mjs` | Claw body record `1189 -> 1315` with limbs `1693` and head `1477` fixed changed 1,096 pixels / 90,877 channels. Independent head record `1477 -> 1494` changed 583 pixels / 37,154 channels. Pixi WebGL2 and all error arrays were clean. | high |
| Mac live action | same exact Website base; task-owned Vite, host, Lua spawn, 20 Hz snapshots, real `/game`, Chrome/WebGL; `smoke-skeleton-upper-body.mjs` | Actor 1 ran `skeleton-claw-a`; browser samples covered progress buckets `0..6`, authoritative torso poses `4..9`, constant gait pose `0`, and actual renderer body records `1203,1221,1239,1257,1275,1293,1311`. Matching early/late actor crops changed 3,667 pixels / 144,413 channels. Page, console, and failed-response arrays were empty. | high |

The first WSL full-wave attempt is excluded from acceptance: software load held
the browser near 7 FPS and the test player died before its scripted cast. It
neither proved nor disproved the animation. All decisive browser evidence above
comes from the Mac mini as required.

## System boundary and membership inventory

Native system: Skeleton-family articulated presentation from constructor pose
through gait/action writers, target/action lifetime, replication and discrete
client sampling, ordered BadGuys layers, and death/teardown.

| Member | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| Skeleton locomotion limbs | `+0x144`; renderer `0x0048DEE0`; BadGuys `1585..1728` | verified-already-at-parity | gait remains independent in server/timeline/presentation tests; live Mac action held gait at zero while torso advanced |
| Unarmored claw | `+0x150`; poses `4..11`; body base `1117` | verified-already-at-parity | complete table test, synthetic records `1189 -> 1315`, live Mac records `1203..1311` and crop delta |
| Armored claw | poses `2..9`; body base `613` | verified-already-at-parity | complete table/server/presentation/asset tests |
| Sword body/overlay, unarmored and armored | ordinary-weapon table; bodies `1333/919`; overlay `1045` | verified-already-at-parity | full progress-table and both armor-branch presentation tests |
| Mace body/overlay/head, unarmored and armored | same torso table; overlay `847`; record `46` head | verified-already-at-parity | exact table, authored-point, auxiliary-plan, and asset residency tests plus Mac synthetic plan |
| Flail body/overlay/chain/head, unarmored and armored | same torso table; overlay `847`; record `46`; two authored chain points | verified-already-at-parity | full auxiliary compositor and authored-point tests |
| Axe body/overlay, unarmored and armored | same torso table; overlay `775` | verified-already-at-parity | full progress-table and armor-branch presentation tests |
| Pike, unarmored and armored | poses `[1,2x11,1]`; body bases `1405/991`; records `54/56` | verified-already-at-parity | complete strict-end/table and target-form auxiliary tests |
| Skeleton Archer retail shot | renderer `0x0048F450`; body `451..612`; shot poses `3..8` | verified-already-at-parity | complete table/strict-end tests; stock capture's eight body records; Mac synthetic Archer plan |
| Archer optional STRAFING torso heading | actor `+0x268/+0x26C`; no row in retail `wave.txt` | out-of-system — Website exposes no custom MonsterRecipe author for this non-retail branch | complete retail row census and preserved 400-frame default-Archer capture |
| Skeleton Mage short/long cast | renderer `0x00491720`; body `1729..1818`; exact short/long tables | verified-already-at-parity | both complete tables/strict ends, stock capture records, Mage charge/particle tests, Mac synthetic Mage plan |
| Mage cloak branch | recipe `+0x81`; body `1459..1476` | verified-already-at-parity | intentional fixed directional cloak body with independently animated casting effects; branch test |
| Skeleton/Mage action-local head facing | `+0x224`; Skeleton tick `0x00484B90`; Mage inheritance through `0x00490860` | verified-already-at-parity | RNG/reset/protocol tests and Mac synthetic head pixels |
| Archer constructor-zero head facing | Archer tick `0x00485200` lacks the Skeleton writer | verified-already-at-parity | no-RNG/static-zero tests and stock golden |
| Action completion, lost target, interruption, lethal handoff, and teardown | action owner `+0xE4`; death removes articulated owner | verified-already-at-parity | strict-end, target-loss, flee/disrupt, same-tick lethal, protocol-invariant, and run-reset tests |
| Protocol and presentation timeline | authoritative snapshot lane; protocol sample indices `6..10/43`; discrete selector sampling | verified-already-at-parity | descriptor/sample round trip, action progress interpolation, discrete body/head tests, and live Mac end-to-end receipt |
| Imp, Zombie, Wraith, Demon, Coffin, and Maggot | distinct renderers/state owners | out-of-system — they do not consume the Skeleton-family torso/head selector | complete enemy-family census from the 2026-08-15/20 audits |

All authored Skeleton-family body tables, equipment banks, headgear banks, and
reachable retail branches have a disposition. No member is blocked by the
browser platform.

## Native ownership thread and recovered contract

- Constructors seed the family body/head state. The authoritative fixed tick
  owns gait, action progress, torso selection, head rolls, completion, reset,
  and death handoff; the renderer is read-only.
- Movement advances only gait `+0x144`. Therefore a stationary-looking torso
  while a Skeleton walks is stock behavior, not an omitted top-half walk
  animation. Torso/equipment changes become visible when an action writes
  `+0x150`.
- Skeleton claw, weapon, and Pike use independent exact progress tables and
  strict completion comparisons. Archer and Mage use their own exact tables.
  Limb, torso/equipment, and head selectors remain separate throughout.
- The host replicates action state at 20 Hz from the 100 Hz simulation. The
  presentation timeline interpolates action progress, holds authored discrete
  selectors, and never advances an animation from display cadence. Pixi swaps
  the corresponding resident BadGuys textures in native layer order.
- Lost action ownership resets the action-local head lane; death removes the
  articulated body and hands presentation to the independent shatter store.

## Nearby-system findings

- `smoke-enemy-animation-projectile-vfx.mjs` had drifted behind the renderer
  constructor/snapshot contract: it omitted empty mod assets/catalog/effects
  and initialized the newly stateful weather owner at a fractional tick. That
  stale fixture failed before reaching its animation assertions. The fixture
  now supplies the current exact empty inputs and an integer initial tick.
- No new native fact was recovered. `Mod Loader/docs/reverse-engineering/native-animation-state.md`
  and `native-enemies.md` remain the durable native owners and require no
  duplicate edit.

## Web implementation consequence

- No Skeleton mechanic, action clock, protocol field, timeline rule, sprite
  selector, asset, or render layer changes: the reported product path is at
  parity.
- Retain a focused live `/game` acceptance that exposes action progress,
  authoritative torso/gait state, and the actual selected body record through
  renderer diagnostics, spawns one stock Skeleton through the authoritative
  Lua API, and compares early/late actor pixels. This closes the earlier
  verification gap without creating a second animation owner.
- Keep the repaired synthetic compositor smoke runnable against the current
  renderer contract.

## Validation contract

- Run all complete Skeleton/Archer/Mage action-table, server-transition,
  protocol, timeline, presentation, auxiliary, and asset tests through the
  repository's canonical `./scripts/validate.sh` entrypoint on the Mac mini.
- Run the repaired synthetic WebGL compositor smoke and require the exact
  Skeleton body/head record transitions plus nonzero pixel deltas.
- Run the focused live Mac journey and require at least two action-progress
  buckets and torso poses, unchanged gait during the action, a nonzero
  actor-crop delta, Pixi WebGL, and empty page/console/network errors.

## Implementation validation receipt

- Rebased Website base `ba950926ce3a5f14e0d874061230329c28719234`
  passed both Mac Chrome/WebGL journeys above. The synthetic proof covers all
  eight enemy-family renderer roots and the Skeleton/Archer/Mage plans; the
  focused live proof ties one ordinary authoritative claw action to browser
  torso pixels.
- Mod Loader base `44b776e8a9d800f555e4ed22a7d4b11a064b9a99`
  passed its registered CI-safe native-RE suite `491/491` under the provisioned
  Python 3.13/Pillow environment. The broader platform-agnostic unittest
  discovery is not a supported Mac gate and pulled in Windows-only modules.
- The post-rebase Mac canonical `./scripts/validate.sh` gate passed: backend
  build and `15/15` Website contracts; frontend groups `4/4`, `43/43`,
  `230/230`, `1304/1304`, `9/9`, `30/30`, `11/11`, `7/7`, `17/17`, and
  `21/21`; desktop `5/5`; production build, media policy, and bundle budget.
  `Game-2Wt6zFEw.js` is `397381` raw / `111565` gzip bytes. Only the eight
  existing Fast Refresh warnings remain. Publication and deployment are not
  authorized by this verification request and remain separate.
