# 2026-08-20 — Skeleton-family independent head-facing animation reopened audit

## Reported smell and parity question

- Reported web behavior: the stock animation visible on the upper part of a
  Skeleton is absent from `/game`; the skull/headgear remains locked to the
  body's facing even while the stock actor can turn it independently.
- Stock behavior to recover: the complete fixed-tick owner, random cadence,
  reset rule, renderer consumer, and sibling-family membership of the
  independent Skeleton-family head-facing lane.
- Reproduction inputs/scenes: an ordinary survival Skeleton with a live
  target and an active attack; compare the skull/headgear record at a fixed
  body facing before and after the stock `actor+0x224` edge.
- This is a secondary report in a system previously called closed. The prior
  pass recovered the independent locomotion (`+0x144`) and body/action
  (`+0x150`) selectors but stopped before inventorying the third independently
  selected articulated layer. The earlier all-family browser fixture therefore
  proved torso action frames while leaving the reported head animation absent.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Instructions | retail `SolomonDark.exe` SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; Skeleton tick `0x00484B90`, especially `0x00484BE9..0x00484C0E` and `0x00484DA7..0x00484DBA` | The eligible tick performs `Integer(300)==1`, then writes inclusive `Integer(-1,1)` to integer field `+0x224`. When the actor has no active action owner at `+0xE4`, it resets `+0x224` to zero. | high |
| Instructions | Skeleton renderer `0x0048DEE0`, Archer renderer `0x0048F450`, Mage renderer `0x00491720` | Each renderer computes `headFacing = wrap18(bodyFacing + actor+0x224)`. The result indexes only the selected skull/headgear bank at BadGuys owner `+0x4BA8`; limbs, torso, and weapon keep their existing independent selectors. | high |
| Instructions | Mage tick `0x00490860` at `0x00490894`; Archer tick `0x00485200` | Mage calls Skeleton tick and therefore owns the same writer/reset lifecycle. Archer calls the common Badguy tick instead; its constructor-inherited `+0x224=0` remains static in the stock tick path even though its renderer can consume the lane. | high |
| Runtime | `Mod Loader/tests/fixtures/webgame/animation-goldens.json`, Skeleton frames at ticks `19943` and `19948` | At the same base-facing region, stock head record `1485` becomes `1484` when the `+0x224` dword becomes `0xffffffff` (`-1`; the old recorder mislabeled it as float and serialized it as `NaN`). The articulated body simultaneously follows its separate action selector. | high, loader-instrumented supporting observation |
| Instructions and authored data | Archer tick `0x00485200` at `0x0048537A` and `0x0048560A`; renderer `0x0048F450` at `0x0048F496`; complete retail `data/wave.txt` | Archer copies movement heading into upper-body heading `+0x26C`; only optional MonsterRecipe byte `+0x95` can replace it with independently aimed heading. No retail wave row authors STRAFING, and the preserved 400-frame Archer golden has zero body/lower/head facing mismatches. | high |
| Pre-fix web source | `native-enemy-presentation.ts`, `NativeEnemyAnimationSample`, `BoneyardEnemyActor`, and protocol-30 sample | Web state had locomotion, body/action, Zombie articulation, Imp upper effect, and Demon joints, but no authoritative Skeleton-family head-facing field. Every Skeleton/Archer/Mage head layer therefore used the base body facing. | high |

## System boundary and membership inventory

Native system: enemy-local independent upper-component animation state, from
fixed-tick writers through authoritative replication and articulated renderer
selection. The survival membership and current disposition are:

| Member | Native source | Current disposition | Proof / required closure |
| --- | --- | --- | --- |
| Skeleton skull and all four headgear banks | `0x00484B90`, `0x0048DEE0`, `+0x224`, BadGuys `1477..1566` | exact-ported | records `1485 -> 1484`, fixed-tick cadence/reset, protocol round trip, hit redraw, browser pixels |
| Skeleton Mage skull/headgear | inherited `0x00484B90`; renderer `0x00491720` | exact-ported | same writer and reset, including cast lifetime; cloak changes body order but not head selector |
| Skeleton Archer skull/headgear | constructor `0x0048A6B0`; tick `0x00485200`; renderer `0x0048F450` | verified already at parity | stock constructor/tick leave offset zero; assert the web head remains base-facing through movement and shot |
| Skeleton Archer independent torso aim | MonsterRecipe `+0x95` -> actor `+0x268`; aimed heading `+0x26C`; `0x00485200` / `0x0048F450` | out-of-system | optional custom MonsterRecipe branch is absent from every retail survival wave row and from the Website's token-plus-wave-flag authoring schema; 400 stock default-Archer frames prove no shipped-survival divergence |
| Stock global head-turn RNG seed identity | `App+0x28 * 0xEF3`, shared native RNG | blocked-by-platform | browser runs have no retail App elapsed-tick identity; the port uses one run-seeded authoritative stream with the exact native generator and one/two-word call budget, so only the cross-launch random turn moments can differ |
| Imp upper effect | `0x00485DC0`, `0x00492E10`, `+0x214/+0x228` | verified already at parity | authoritative phase, alpha, body variant, rotation, and browser membership tests |
| Zombie head/arms/torso | `0x004863A0`, `0x00493390`, `+0x210..+0x23C` | verified already at parity | replicated angular offset, head/body phases, arm poses/rotations, beat program tests |
| Wraith | `0x00496220` | out-of-system | stock body is facing-only; no upper-component frame/rotation/alpha lane exists |
| Demon articulated joints | `0x00487300`, `0x00498BA0`, `+0x2D4/+0x2D8/+0x2DC` | verified already at parity | global-tick idle joints, bomb override, controller/limb browser tests |
| Coffin | `0x0049AC90` | out-of-system | non-articulated lid/body opening owner; no upper-facing component |
| Coffin-owned Maggot | `0x0049C190` | out-of-system | grounded/ballistic whole-body selectors; no upper component |

Other compiled enemy classes remain outside the Website survival factory and
do not share the Skeleton-family BadGuys headgear owner. They are not silent
rows in this system.

## Native ownership thread

- `Skeleton` construction through `0x004771B0` initializes integer
  `actor+0x224` to zero. Archer and Mage inherit that initialization.
- Skeleton tick owns the presentation-only random edge. Under its linked-target
  eligibility gates, it consumes one `Integer(300)` draw each fixed tick; only
  value one consumes the second inclusive `Integer(-1,1)` draw.
- The written value survives only while the native action owner at `+0xE4`
  remains present; the same tick resets it to zero otherwise. Death removes the
  articulated body through the existing death handoff.
- Mage tick calls Skeleton tick before its Mage-specific cast/shield work and
  therefore shares the lane. Archer deliberately does not.
- Render is read-only. It wraps `baseFacing + headFacingOffset` into `[0,17]`
  and uses that result solely for the skull/headgear record. The torso/action,
  weapon, and locomotion axes remain unchanged.

## Recovered behavioral contract

- State is a signed integer in `{-1,0,+1}`, not a float phase and not a new
  torso pose.
- The visible mapping is
  `headFacing = positiveMod(baseFacing + headFacingOffset, 18)`.
- A head turn neither advances nor restarts locomotion/action progress. Hits
  redraw the same selected articulated layers and death still retires them.
- The random edge is fixed-tick-owned and must be authoritative in multiplayer;
  clients must not roll it from render cadence or sparse snapshot arrival.
- The server owns one run-scoped native-algorithm presentation stream shared by
  Skeleton and Mage. A losing tick consumes one word and a winning tick two;
  Archer consumes none. The stream seed is derived from authoritative web run
  identity because the retail App elapsed-tick seed does not exist in a
  browser session.
- No new sprite assets are required. All output is already present in the four
  complete 18-facing BadGuys headgear banks.

## Nearby-system findings

- The prior “two independent axes” statement was incomplete, not wrong:
  `+0x144` still exclusively owns limbs and `+0x150` still owns torso/action.
  `+0x224` is a third axis for the skull/headgear only.
- The old golden recorder named `+0x224` as `pose_0x224_f32`; the instruction
  type and `NaN` sample prove it is a signed dword. Durable native documents
  must correct the type rather than normalize the `NaN` away.
- Archer's renderer support is not evidence of a writer. Its distinct tick
  establishes a verified static-zero sibling rather than permission to add a
  cosmetic Archer head turn.
- Archer also has a separate torso-aim field at `+0x26C`, but its only divergent
  writer is gated by optional MonsterRecipe STRAFING byte `+0x95`. The complete
  shipped survival table does not author that branch; it remains explicitly
  outside the current token-plus-wave-flag Website schema instead of being
  silently approximated.

## Confidence and open questions

- Confirmed: owner, integer type/domain, exact RNG calls, reset guard, all three
  renderer consumers, headgear-only selection, Mage inheritance, Archer
  non-inheritance, stock record edge, and full survival-family membership.
- Blocked browser identity: a separately launched stock process and web run do
  not share the retail App elapsed-tick seed, so the exact random tick on which
  a head turns is not cross-launch reproducible. The visible domain, cadence,
  shared-stream ordering, reset, renderer selection, and multiplayer authority
  are exact.

## Web implementation consequence

- Add one authoritative signed head-facing offset to the enemy actor and
  animation snapshot, serialize it in the replicated enemy sample, and bump
  the incompatible game protocol.
- Run the native cadence on the server for Skeleton and Mage only from one
  run-seeded native generator; clear it at the action-lifetime edge and keep
  Archer zero.
- Apply it only when resolving `skeleton-headgear`, `archer-headgear`, and
  `mage-headgear`; no body, limb, weapon, hit, auxiliary VFX, projectile, or
  gameplay branch changes.
- Remove no existing action animation. This closes the missing third selector
  instead of substituting another torso-frame patch.

## Validation contract

- A stock-golden differential must fail on the current head record `1485` and
  pass with `1484` for the recorded `-1` edge while limbs/body remain exact.
- Store tests must cover one-in-300 draw cadence, `-1/0/+1`, reset after the
  active action, Mage inheritance, and Archer static zero without changing
  attack markers or damage.
- Protocol/replication and presentation-timeline tests must prove a strict
  signed domain, exact round trip, discrete snapshot ownership, protocol 32,
  and the 54-component enemy sample.
- The all-family real-browser fixture must show a pixel-changing Skeleton and
  Mage head edge, unchanged Archer head, and unchanged Imp/Zombie/Wraith/
  Demon/Coffin/Maggot membership with no page, console, or response errors.

## Implementation validation receipt

- The authoritative actor/store, projection, protocol, reconstruction,
  timeline, and renderer now carry the signed selector without deriving it on
  clients. The incompatible combined pause-plus-head-facing schema is protocol
  32 and the dynamic enemy sample has 54 components. The focused combined
  suite passed 165/165, including the stock `1485 -> 1484` golden edge, all
  four headgear banks, Mage inheritance, Archer static zero, hit redraw,
  strict invalid-message paths, and server RNG/reset ownership.
- The complete Mod Loader CI-safe static RE suite passed 489/489 after the
  catalog and recorder regenerated with the corrected signed field. The
  complete Website gate passed on current `origin/main` base `47550034`, with
  40 loot tests, 140 prerequisite tests, 991 broad game/frontend tests, all
  auxiliary suites, production builds, bundle budget, and media policy green.
- A fresh Mac mini candidate built from that base plus the exact 18-file patch
  passed the same canonical gate. Hardware Chrome WebGL2 changed 583 head-crop
  pixels while retaining limb record `1693` and body record `1315`; only the
  headgear record changed from `1477` to `1494`. The same frame retained all
  eight survival families, eight projectile actors, nine projectile effects,
  Zombie gas clouds and flies, Wraith wisps, Imp upper effect, Demon flames,
  Mage lightning, and empty console/page/response error lists.
- The ordinary Mac mini `/game` journey then observed the server-selected lane
  naturally during live attacks: Skeleton actor 57 emitted `-1`, and actor 69
  emitted `+1` then `-1`. It also proved Skeleton and Archer attack actions,
  the Archer arrow lifecycle, player-damage audio, player death/Game Over
  presentation, and a clean second-run reset. No task Vite, game-host, Chrome,
  or Node listener remained afterward.
- Publication state at receipt time: this reopened correction was isolated and
  uncommitted. Subsequent publication state is established by Git and CI/CD,
  not inferred from this pre-publication validation snapshot.
