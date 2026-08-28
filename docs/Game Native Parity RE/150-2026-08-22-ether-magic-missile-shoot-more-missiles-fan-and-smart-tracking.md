# 2026-08-22 — Ether Magic Missile Shoot, More Missiles fan, and Smart tracking

## Reported smell and parity question

- Reported web behavior: Ether projectile launch and homing do not look right,
  especially with the multiple-projectile skill.
- Stock behavior to recover: the complete row-8 one-shot `Shoot` path from
  action marker through socket placement, per-child launch heading, target
  acquisition, Smart Missiles loss/replacement, Pierce continuation, movement,
  presentation, replication, and teardown.
- Reproduction inputs/scenes: full- and low-mana Ether casts in Hub and
  Boneyard; More Missiles quantities `1..14`; odd/even quantities across the
  `N<4` step boundary; Smart Missiles with a live, inactive, removed, and
  replacement target; a surviving Pierce contact; held-repeat casting; and a
  multiplayer observer.
- Falsifiable questions: whether native offset and turn falloff advance every
  child or every left/right tier; whether every child probes from the caster's
  aim or its own fanned heading; whether Smart replacement reuses the 100-unit
  launch probe; whether a dying target steers before liveness is tested; and
  whether a missile born without a target searches again later.

This reopens both the 2026-08-15 learned-Magic-Missile entry and the
2026-08-20 fixed-tick tracking entry. The learned pass stopped at a collapsed
decompile and did not inspect the raw sign branch at `0x0053DC20`, so it
encoded `index*step` and `0.75^index`. The later tracking pass recovered the
inactive-target final sample, but the current `origin/main` integration again
filters the retained handle before steering and turns any null target into a
free-running forward-probe reacquisition. Those are process failures inside an
already covered system, not new stock variants.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Preserved retail binary | `SolomonDarkAbandonware/SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; freshly re-hashed with both runtime-stage copies | All three copies are byte-identical retail 0.72.5. | high |
| Instructions | read-only Ghidra 12.0.3 replica; dispatcher `0x0054CAF0`, handler `0x0053CFE0`, raw launch loop `0x0053D9CF..0x0053DC43` | One debit/damage roll/cue owns all children. Offset and turn falloff advance once per paired tier, not once per child. | high |
| Instructions | emitter `0x0053B830`, position writer `0x00622D90`, heading helper `0x00410500`, target query `0x00641160`, initial line test `0x00524D70` | Every child starts at the same current Staff emitter plus `(0,+10)`, receives its own fanned heading, probes 100 units along that heading, registers, then tests caster-root-to-birth obstruction with mask `0x380`. | high |
| Instructions | constructor `0x005E4990`, base tick `0x005FD270`, resolver `0x0045ADE0`, replacement helper `0x005E4B80`, contact `0x005F1F00` | Move-first sign steering, post-steer liveness, unresolved-handle replacement timing, current-root Smart/Pierce queries, and policy disable are instruction-complete. | high |
| Static xrefs/siblings | one ref to `0x0053CFE0`; four refs to `0x005FD270`; derived ticks `0x005FD550/0x005FD720/0x005FD7A0`; eleven `0x00641160` callsites | Pure Magic Missile is the only row-8 handler. FireMissile, BallLightning, and FrostMissile share the same base target-state transitions and require the same correction. | high |
| Authored data | `native-skill-catalog.json`, More Missiles row 10, SHA-256 `2c488abe54141a3f8933c575990eed632e1201e02d888197d30ae654ca038604` | `mQuantity` drains completely to `1..14`; mana additions are `0,4,8,15,20,25,30,32,34,36,38,40,42`. | high |
| Current web baseline | clean `origin/main` `0574fa68b6362f527d4fa85a8323c6ca5a797895`; `primary-spells.ts`, `primary-spell-targeting.ts`, `native-weld-primary-runtime.ts`, and focused tests | Pure four-shot launch is `+10,-10,+50,-50`, pure turn inputs decay every child, retained targets are prefiltered, null targets reacquire every tick, and Pierce replacement reuses the forward probe. Weld fans are already paired but their shared target-loss transition is not. | high |

No injected loader result, stale PID, runtime ASLR address, or screenshot guess
is used for the recovered formulas. Addresses are preferred-image VAs.

## System boundary and membership inventory

Native system: Player-owned MagicMissile launch and shared base tracking,
beginning when Staff Cast 1 dispatches selected row 8 and ending at contact,
removal, owner/scene teardown, or transfer to a class-owned impact actor.

| Member | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| Row 8 full-power one-shot, held repeat, one debit/damage roll/cue | `0x0054CAF0`, `0x0053CFE0` | verified-already-at-parity | existing action, mana, RNG, audio, and repeat tests |
| Row 9 Smart speed, turn, policy threshold, resolved-live target | handler tail, `0x005FD270` | exact-ported | focused full-power and Smart transition tests |
| Row 9 resolved inactive target | `0x005FD43D..0x005FD514` | exact-ported | final steering sample precedes clear |
| Row 9 unresolved target with/without replacement | `0x005FD514..0x005FD531`, `0x005E4B80` | exact-ported | no same-tick steering; current-root replacement; empty search disables policy |
| Row 10 quantities `1..14`; one, odd, even, `N<4`, and `N>=4` fans | authored table; `0x0053D9D8..0x0053DC43` | exact-ported | per-quantity formula assertions and four/five-shot browser samples |
| Per-child initial target probe | `0x0053DABC..0x0053DB3C` | exact-ported | target differs by each child's fanned direction and strict nearest query |
| Row 13 surviving-Pierce retarget | `0x005F1F00 -> 0x005E4B80` | exact-ported | current-root excluded-first/fallback query test |
| Row 14 Ether Blast pre-launch branch | handler head | verified-already-at-parity | v47 charge/pulse/order contracts |
| Underpowered Ether | `0x0053D95D..0x0053DBA7` | verified-already-at-parity | forced one, speed `2.4`, turn input `1.2`, no Smart/Pierce payload |
| Staff emitter, common spawn, initial obstruction | `0x0053B830`, `0x00622D90`, handler tail | verified-already-at-parity | exact socket table and terrain-birth tests |
| Movement, deadband, accumulator, contact cadence | `0x005FD270`, `0x00410D60`, `0x005F1F00` | exact-ported | existing recurrence plus new target-transition tests |
| Complete flight/contact compositor, one body per child, light/audio | `0x005E0460`, `0x00535A30`, `0x005F1F00` | verified-already-at-parity | native Ether renderer/assets/audio tests; visual scale remains one |
| Host authority, replication, interpolation, observer ownership | primary spell state/protocol/client timeline | exact-ported | protocol-v53 and multiplayer presentation tests |
| Hub no-target and Boneyard live/inactive/removed collections | Region query and web target projection | exact-ported | scene-specific target tests and browser receipt |
| FireMissile, FrostMissile, BallLightning shared base transitions | `0x005FD550`, `0x005FD7A0`, `0x005FD720` | exact-ported shared tracking; verified-already-at-parity class fan/payload/presentation | welded kernel/protocol tests |
| Other turn/query helper consumers | complete existing xref lists | out-of-system: independently owned enemy, NPC, player-brain, GuidedMissile, Golem, EBoulder, and query systems | none calls the Magic Missile web kernel |

There is no `blocked-by-platform` member and no authored table row is omitted.

## Native ownership thread

- Owner and construction path: the action marker enters PlayerWizard vslot
  `+0x58`, dispatcher `0x0054CAF0` calls the equipped-item vslot then selects
  row 8, and handler `0x0053CFE0` creates factory type `0x7D3`. The Region owns
  each registered child independently.
- Upstream state producers/callers: row 8 supplies damage/cost; row 9 supplies
  `smartFactor=1+mSpeed/100`; row 10 supplies rounded quantity; row 13 supplies
  Pierce count/retention; row 14 may emit its pulse before construction. Cast
  heading and the current Staff glyph own launch direction and socket.
- State representation and transitions: heading `+0x13C`, target handle
  `+0x140/+0x142`, speed `+0x144`, turn input `+0x148`, accumulator `+0x14C`,
  Smart policy `+0x150`, phase `+0x154`, damage `+0x158`, visual scale
  `+0x15C`, weak flag `+0x160`, Pierce count `+0x161`, and retention
  `+0x164`.
- Downstream consumers/callees: base tick moves, publishes, resolves, steers,
  tests liveness, then performs contact. Render consumes actor position/phase;
  protocol carries authoritative identity/tracking; impact actors own contact
  art/audio after the projectile retires.
- Sibling systems sharing ownership or data: FireMissile, BallLightning, and
  FrostMissile call the same base tick and use the same current-root
  replacement helper. Their constructors/payloads/painters remain class-owned.
- Entry, interruption, reset, and teardown: each accepted action marker emits
  once; held input queues another completed action. Blocked birth contacts
  immediately. Owner loss, scene reset, terrain/actor contact, and destructor
  remove the actor; no fixed flight timer exists.

## Recovered behavioral contract

- Timing/ticks/thresholds: `step=30` for `N<4`, otherwise `20`; even fans add
  `step/2`. Tier is `ceil(i/2)`. Smart policy is pure-Ether
  `smartFactor>1.01`; authored rank one Smart is `1.10`. Move uses the old
  heading; replacement never steers until the following tick.
- Geometry/transforms/coordinate spaces:

  ```text
  base = castHeading + (N even ? step/2 : 0)
  tier = ceil(i/2)
  heading[i] = base + (i even ? +1 : -1) * tier * step
  turnInput[i] = 2 * smartFactor * 0.75^tier
  spawn[i] = StaffEmitter + (0,10)
  launchProbe[i] = spawn[i] + direction(heading[i]) * 100
  ```

  Four neutral missiles are `+10,-10,+30,-30` with turn inputs
  `2,1.5,1.5,1.125`; five are `0,-20,+20,-40,+40`.
- Target/query order: launch query checks flag `0x2` and strict squared
  distance `<999999` in stored Region order; it does not check active,
  pending-remove, kind, LOS, body radius, or cells. Retained handles ignore
  flags. `+0xF9` clears only after a final resolved sample. Smart missing-handle
  and Pierce continuation query from current missile position; Pierce first
  excludes the contacted actor, then falls back without exclusion.
- Assets/audio/randomness: the fan consumes no per-child launch RNG. One
  cast-time damage draw is copied to every child. Each actor keeps the existing
  independent radial `110/111/112` compositor and visual scale one. One
  `magicmissile` cue belongs to the cast, not one cue per child.
- Input/network authority/replication: host fixed-tick authority owns all child
  headings, targets, Smart policy, accumulators, and teardown. Clients never
  infer homing or merge a fan into one render object.
- Boundary and failure behavior: a projectile born without a handle flies
  straight and does not search later. A missing Smart handle performs exactly
  one current-root replacement attempt and disables future replacement when
  empty. A resolved inactive target gets one final steer. Low mana forces one
  weak missile and suppresses Smart/Pierce payloads.

## Nearby-system findings

- The three welded Ether-derived launch handlers already implement the paired
  fan with `ceil(i/2)`. Pure Magic Missile drifted because it duplicated that
  loop as `index*step`. The shared web fan helper must now own both families.
- Welded policy writers are class-specific: FireMissile compares vector speed
  with `1.255`; FrostMissile compares with `1.0`; BallLightning compares its
  post-`0.85` speed factor with `0.860000014`. Underpowered `0.8` is false.
- Reusable facts and corrected prior formulas are recorded in Mod Loader
  `native-projectile-and-spell-mechanics.md`, `native-skills-and-spells.md`,
  and `native-progression-and-skills.md`.

## Confidence and open questions

- Confirmed: complete launch loop, paired branches, all constants, full row-10
  table, socket/spawn, per-child target probe, retained/lost/inactive ordering,
  Smart thresholds, Pierce fallback, shared base-tick siblings, dispatcher,
  initial obstruction, presentation ownership, and teardown.
- Inferred: Website `active` continues to project native `+0xF9`; this was the
  established target-row contract and the actor remains addressable while
  dying.
- Unknown: none material. Global cosmetic compositor samples remain the
  established stable-ID browser projection and do not alter the recovered
  launch/tracking state.

## Web implementation consequence

- Correct owner/module: one shared missile fan/target-transition kernel under
  `core-kernels` feeds pure Ether and welded Ether-derived missiles;
  `primary-spells.ts` and `native-weld-primary-runtime.ts` retain only their
  class payload assembly.
- Shared model change: correct pure fan tiers; retain mutable replacement
  policy for welded missiles; distinguish initial forward-probe acquisition,
  retained-handle steering, unresolved current-root replacement, and Pierce
  current-root continuation.
- Stock behavior preserved: socket, same-root births, one damage roll/debit/cue,
  speeds, float32 steering, body/contact presentation, contact cadence,
  authority, replication, and lifecycle.
- Browser-specific approximation: none added.
- Obsolete paths to remove: raw-index pure fan, per-child pure turn falloff,
  active/flag prefilter on retained handles, free-running null-target search,
  and Pierce reuse of the launch probe.

## Validation contract

- Focused automated tests: quantities `1..14`; exact four/five headings and
  paired turns; separate per-child probes; one damage roll/cue/debit; full and
  weak branches; resolved active/inactive, unresolved Smart replacement,
  empty replacement disable, born-null straight flight, and Pierce
  exclude/fallback; all three welded base-tick siblings; strict protocol state.
- Playwright/runtime journey: load a real More Missiles Ether profile, enter
  Boneyard, cast at off-axis enemies, capture at least four simultaneous
  authoritative child headings/turn inputs/targets and WebGL actors, then
  exercise a target loss without page/console/network errors.
- Stock-versus-web comparison: compare launch arrays and subsequent tracking
  transitions directly with the raw instruction oracle. Do not use a centered
  visual guess as acceptance.
- Measurable acceptance criteria: four-shot launch begins
  `+10,-10,+30,-30`; paired turn inputs are `2,1.5,1.5,1.125` before Smart
  scaling; each child separates from one socket along its own heading and owns
  one full Ether compositor; replacement does not turn on the acquisition
  tick; canonical gate and Mac browser acceptance are clean.

## Implementation validation receipt

- `primary-spell-targeting.ts` now owns the one paired fan formula, point-root
  target query, and resolved/inactive/unresolved target transition shared by
  pure Ether and all three MagicMissile-derived welded classes.
  `primary-spells.ts` copies exact More Missiles tiers and Smart state into each
  child. Pierce continuation performs the native current-root excluded-first
  query and no-exclusion retry. Welded actors retain their class thresholds;
  protocol 53 carries the mutable replacement-policy byte without client
  reconstruction.
- Regression membership covers all authored quantities `1..14`, exact four-
  and five-child fans, paired turn inputs, one damage roll, per-child launch
  probes, full/weak branches, resolved active and final inactive samples,
  unresolved Smart replacement, empty-search disable, born-null straight
  flight, Pierce fallback, welded thresholds, and strict protocol decoding.
  The corrected Mod Loader reports pass `491/491` static contracts on both WSL
  and the Mac mini.
- The exact Mac runtime tree was
  `edca28729dc35bc5b430f7271720af8dee89b50e` at Website commit
  `e713ee7`; it matched local commit `36b9b802` byte-for-byte by Git tree hash.
  On `Jarretts-Mac-mini.local`, arm64 macOS `26.6.2`, Node `22.17.0`, npm
  `10.9.2`, and .NET `10.0.302`, `./scripts/validate.sh` passed `15/15`
  backend/contracts, `4/4` library, `43/43` loot, `227/227` prerequisites,
  `1294/1294` gameplay, `8/8` weather, `29/29` party, `11/11` level-up,
  `7/7` diagnostics, `17/17` Hall, `21/21` Hub UI, and `5/5` desktop tests,
  plus production builds, media policy, and the game bundle budget
  (`394265` raw / `110662` gzip bytes).
- Physical-Mac Chrome `151.0.7922.170` at 1600 by 900 entered an authentic
  ten-enemy Solomon opening wave, then applied the controlled acceptance ranks
  Smart Missiles `1` and More Missiles `3`. One cast produced four consecutive
  actor IDs with shared damage `2`, visual scale `1`, speed
  `3.299999952316284`, and paired turn inputs
  `2.200000047683716, 1.649999976158142, 1.649999976158142,
  1.2374999523162842`. Around aim heading `52.136482384272654`, first
  authoritative headings were
  `62.11448287963867, 42.15298080444336, 82.11997985839844,
  22.14885711669922`: the exact `+10,-10,+30,-30` launch tiers after only
  their bounded first steering sample.
- The same actor IDs remained four separate WebGL views through browser flight
  tick 25. Actor 1 then retained its target through ticks `1..4`, with headings
  `62.11448287963867 -> 61.98248291015625 -> 61.740482330322266 ->
  61.38848114013672` and accumulators `0.06000000238418579 ->
  0.10999999940395355 -> 0.1599999964237213 -> 0.20999999344348907`;
  maximum instruction-oracle turn slack was `4.470348358154297e-8` degrees.
  Launch, impact, audio, and teardown completed with empty page/console error
  arrays. Hub remained correctly noncombat with zero primary actors.
- The visually inspected tick-25 flight capture is
  `/tmp/solomon-ether-fan-final-20260822/solomon-primary-ether-boneyard-fan-flight.png`,
  SHA-256 `0ba8eaf21bf01ff20e28bd35c8bcebd49f4e4d0219459ae1c6f1d3210cacc1c0`.
  It shows four separated magenta radial core/spark/ray composites curving from
  the common Staff socket; the former flat rotated streak and oversized
  `+50/-50` spacing are absent. The impact capture hashes to
  `4152ecbcc7d503c803c8bc2bea97a025a34667e13c0cff564a3dcf8cb4978c3b`.
- Final current-main rebase receipt: Website runtime tree
  `bb55e2ec5c4b3569b654fb56d388e21f938ee599` at commit `6586dc4a`,
  rebased on current-main `ba950926`, matched byte-for-byte on WSL and Mac;
  Mod Loader tree
  `7f84cf0b80b935ec121b9a3c992853a3c7507e72` at Mac commit `14efe194`
  matched local commit `62bc6a92`. The clean Mac canonical gate passed
  `15/15` backend/contracts, `4/4` library, `43/43` loot, `230/230`
  prerequisites, `1310/1310` gameplay, `9/9` weather, `30/30` party,
  `11/11` level-up, `7/7` diagnostics, `17/17` Hall, `21/21` Hub UI, and
  `5/5` desktop tests, plus production builds, media policy, and bundle budget
  (`397461` raw / `111575` gzip bytes). The validation log SHA-256 is
  `2259fc24062924ebb47d4778b85c290f780170fbcbad169930a2da3d19f5ef58`.
  The final acceptance releases left
  input only after the authoritative four-child birth, then follows those exact
  IDs; ordinary held-fire repeats cannot replace the sampled cast. It waits
  until Chrome presents the host-arranged wave, holds those controlled targets
  stationary, and chooses a native-collision-clear 110-unit fan corridor, so
  map scenery cannot censor the visual sample. Two consecutive physical-Chrome
  casts on independent authentic arena generations selected corridor heading
  `120`, reproduced aim `123.73726337981367`, first headings
  `133.7152557373047, 113.75376892089844, 153.72076416015625,
  93.74964141845703`, and the same paired Smart turn inputs. The same four IDs
  remained separately rendered through flight ticks 15 and 17 while curving
  onto `enemy:1`; instruction-oracle turn slack was zero and browser errors
  remained empty in both runs. The
  inspected rebased flight capture is
  `/tmp/solomon-ether-clear-corridor-frozen-2/solomon-primary-ether-boneyard-fan-flight.png`,
  SHA-256 `c081a00ad3e8f5ca0a560cba950fbf4e224cc9406fd82070d0cac13886b012e6`;
  its impact capture hashes to
  `8ff3c5f4c9ec6ce153ed9d81933ba7aef0000628605c074c71c20a8b0726291b`.
- There are no browser-platform-blocked members or material native unknowns.
  Website and Mod Loader changes are local commits only. Nothing was pushed,
  deployed, or restarted.
