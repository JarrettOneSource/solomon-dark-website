# 2026-08-20 — Ether Magic Missile fixed-tick tracking correction

## Reported smell and parity question

- Reported web behavior: the Ether primary projectile tracking logic is wrong.
  The current kernel turns by the full signed angular error multiplied by its
  growing turn scalar, producing an aggressive correction and overshoot.
- Stock behavior to recover: the complete Magic Missile target acquisition,
  stable-handle retention, move/steer order, angular direction gate,
  accumulator recurrence, target-death/loss edge, and straight-flight branch.
- Reproduction inputs/scenes: cast rank-one Ether toward an off-axis live
  Boneyard enemy; repeat with low mana, a moving target, a target entering its
  dying state, no target in Hub, and desired headings on both sides of zero.
- Falsifiable questions: whether the helper returns a signed angular magnitude
  or only a direction; whether its zero band is strict or inclusive; whether
  the target root is sampled before or after movement; and whether liveness is
  tested before or after the final steering sample.

This reopens the 2026-08-14 targeting entry. That pass skipped the native
helper body and treated the untyped return from `0x00410D60` as a normalized
signed angular delta. The earlier focused test then encoded the same mistaken
`1.8..1.9`-degree first correction, so it protected the mismatch instead of
falsifying it.
## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Preserved retail binary | `SolomonDarkAbandonware/SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` | Same retail 0.72.5 image as the primary-spell campaign; identity was freshly re-hashed on 2026-08-20. | high |
| Instructions | read-only Ghidra 12.0.3 task replica; `0x005FD270`, especially `0x005FD408..0x005FD502` | Magic Missile moves and publishes first, resolves the target, computes desired heading from the post-move position, applies a sign-only step, advances the accumulator, then tests target `+0xF9`. | high |
| Instructions | `0x00410CF0`, `0x00410D60` complete bodies; constants at `0x007DE858`, `0x007DE878`, `0x007DE888`, `0x007DE8F8` | Inputs normalize modulo 360; result is `-1/0/+1`; zero is returned for gaps `<=1` or `>=359`; `180`-degree ties have deterministic numeric-order direction. | high |
| Instructions/data | constructor `0x005E4990`, handler `0x0053CFE0`, query `0x00641160`, resolver `0x0045ADE0`; doubles `0x007DE8A0=0.05000000074505806`, `0x0079D758=0.0020000000949949026`; float `0x007DE984=10` | Confirms target handle fields, speed/turn/accumulator inputs, forward-probe acquisition, recurrence, and cap. | high |
| Static xrefs | `0x00410D60` 26 callsites/21 functions; `0x005FD270` four refs; `0x00641160` 11 callsites/nine functions | Magic Missile is the only in-boundary call to the generic turn helper; three derived missile ticks call the base tick and are separately dispositioned below. | high |
| Existing web baseline | `origin/main` `28c1927a21199c4b300131115928f6fb2874adfd`; `primary-spell-targeting.ts` and its `moves on the old heading` test | Web computes `turnInput * accumulator * signedAngularDelta`; its test expects roughly `1.8..1.9` degrees where stock produces `0.02`. | high |

No injected loader or stale process address is used. All addresses are
preferred-image VAs in the pinned executable; no ASLR mapping is involved.

## System boundary and membership inventory

Native system: `MagicMissile 0x7D3` fixed-tick tracking, beginning with the
cast-time forward-probe query and ending when target identity is retained or
cleared after a tick. Contact payloads, painters/audio, learned-effect
construction, and non-Ether derived classes are adjacent but outside this
boundary. `exact-ported` rows below are the declared implementation
disposition; their concrete proof is completed in the validation receipt.

| Member (class/variant/scene/branch) | Native source | Disposition | Proof/required contract |
| --- | --- | --- | --- |
| Rank-one full-power launch acquisition | `0x0053CFE0 -> 0x00641160`; flag bit one, forward probe `100`, squared ceiling `999999` | `verified-already-at-parity` | Existing selection/order tests and Boneyard target projection. |
| Rank-one full-power live-target positive turn | `0x005FD43D..0x005FD4B6`; turn input `2` | `exact-ported` | First north-to-east correction must be `+0.02`, not proportional to the gap. |
| Rank-one full-power live-target negative/wrap turn | `0x00410D60` | `exact-ported` | Both shortest cyclic directions, zero crossing, and exact `180` tie branches. |
| Inclusive cyclic deadband | `0x00410DA5..0x00410DBF`; floats `1` and `359` | `exact-ported` | Gaps `<=1` and `>=359` return zero while a valid target still advances the accumulator. |
| Low-mana Ether branch | `0x0053CFE0`; speed `2.4`, effective turn input `1.2` | `exact-ported` | Same sign gate gives first correction `0.012` and preserves `2.4`-unit move-first travel. |
| Moving retained target | handle `+0x140/+0x142`, resolver `0x0045ADE0` | `exact-ported` | Recompute desired heading from the current post-move projectile and live target root every fixed tick without rerunning acquisition's actor-flag filter. |
| Resolved target entering inactive/dying state | liveness byte `+0xF9` read at `0x005FD502` after steering | `exact-ported` | One final steering/accumulator sample, then clear target identity for the next tick. |
| Missing/unresolvable rank-one target | `0x005FD514..0x005FD531`, policy `+0x150=0` | `verified-already-at-parity` | Clear identity, do not steer or advance accumulator, and never reacquire. |
| No target in Hub | invalid initial handle and same missing-target branch | `verified-already-at-parity` | Straight flight on stored heading; no browser-created target. |
| Boneyard target collection registration/liveness | Region collection consumed by `0x00641160` and `0x0045ADE0` | `exact-ported` | Keep dying actors addressable but inactive until retirement so retained handles receive the final sample; acquisition/contact still exclude them. |
| Learned multi-missile fan, faster/smart inputs, and non-rank-one reacquisition | upstream writes in `0x0053CFE0`; continuation `0x005E4B80` | `out-of-system` (learned primary-effect construction/progression, not the fixed-tick direction gate) | Fully extracted native fields remain in the Mod Loader report; any future activation must call the same exact sign gate. |
| `FireMissile 0x7DE`, `BallLightning 0x7DF`, `FrostMissile 0x7E0` base-tick callers | `0x005FD550`, `0x005FD720`, `0x005FD7A0 -> 0x005FD270` | `out-of-system` (class-owned non-primary-Ether projectile systems) | Complete class list recovered; no constructor, payload, contact, or renderer change in this fix. |
| Other `0x00410D60` consumers | 25 callsites outside `0x005FD491` | `out-of-system` (enemy/NPC facing, player control brain, GuidedMissile, Golem, and EBoulder owners) | Full callsite list is recorded in `native-projectile-and-spell-mechanics.md`; none consumes the Website Magic Missile kernel. |
| Assets, render order, lights, audio, collision/contact, and replication schema | existing Magic Missile presentation/contact system | `verified-already-at-parity` | Tracking changes only authoritative heading, direction, position, target identity, and accumulator already carried by protocol. |

There is no authored tracking table, setting gate, random draw, or browser
fallback. No member is `blocked-by-platform`.

## Native ownership thread

- Owner and construction path: Ether Staff Cast 1 marker calls handler
  `0x0053CFE0`, constructs factory type `0x7D3` through `0x005B7080`, writes
  target group/slot at `+0x140/+0x142`, then registers the actor in the Region.
- Upstream state producers/callers: launch heading/fan, speed, and turn input
  come from the handler; constructor `0x005E4990` owns accumulator `0.01`,
  target-loss policy, and invalid default handle; `0x00641160` chooses the
  nearest hostile actor to the 100-unit forward probe.
- State representation and transitions: current float32 heading `+0x13C`,
  speed `+0x144`, turn input `+0x148`, accumulator `+0x14C`, and stable target
  identity. A valid target samples each tick; inactive clears after one final
  sample; unresolved clears without a sample; rank one never reacquires.
- Downstream consumers/callees: heading creates the following tick's movement
  vector and replicated direction/velocity; target identity and accumulator
  remain discrete authoritative wire state; rendering consumes position/phase
  and never rebuilds homing.
- Sibling systems sharing ownership or data: three derived missile ticks call
  the base tick; the generic turn helper has 25 other callsites, all explicitly
  out of this Magic Missile boundary.
- Entry, interruption, reset, and teardown: initial acquisition happens once
  per emitted actor. Terrain/contact or owner loss retires it. Scene teardown
  removes the actor; no timer or browser frame clock controls tracking.

## Recovered behavioral contract

- Timing/ticks/thresholds: on each 100 Hz native update, move on the old
  heading; resolve and sample the target from the new position; use direction
  `-1/0/+1`; update heading; advance accumulator; then test liveness. The
  inclusive cyclic zero band is `[0,1] U [359,360)` degrees.
- Exact recurrence:

  ```text
  position += direction(currentHeading) * movementScalar * speed
  desiredHeading = heading(targetRoot - position)
  directionSign = nativeTurnDirection(currentHeading, desiredHeading)
  heading = f32(currentHeading + turnInput * accumulator
                * movementScalar * directionSign)
  accumulator = f32(min(10, accumulator
    + (accumulator > 1 ? 0.0020000000949949026
                       : 0.05000000074505806)))
  ```

- Geometry/transforms/coordinate spaces: target root and projectile center are
  Region/world coordinates; no attachment offset, camera transform, LOS, or
  body radius participates in steering.
- Render/hit/collision/traversal order: movement and steering precede the
  following tick's direction. Five-tick terrain lookahead and per-tick point
  contact remain separate consumers and are not retuned.
- Assets/audio/randomness: none in the steering recurrence. The launch cue,
  visual phase RNG, compositor, and contact cue remain unchanged.
- Input/network authority/replication: host fixed-tick authority owns all
  tracking state. Snapshot presentation interpolates position only and treats
  target/heading/accumulator as semantic fields.
- Boundary and failure behavior: no target means straight flight without
  accumulator growth. A retained target can die between ticks and still owns
  one last native sample while its object remains registered.

## Nearby-system findings

- The generic native helper `0x00410D60` has 26 callsites in 21 functions;
  only `0x005FD491` is Magic Missile. Its sign-only return was already modeled
  independently by the Solomon Dig facing system, demonstrating why the
  proportional Ether interpretation was anomalous. This pass does not widen
  into those independently owned state machines.
- `0x005FD270` is also the base tick called by FireMissile, BallLightning, and
  FrostMissile. Their class ticks are enumerated rather than silently assumed
  to be Ether variants.
- The reusable correction and full xref lists are recorded in
  `Mod Loader/docs/reverse-engineering/native-projectile-and-spell-mechanics.md`.

## Confidence and open questions

- Confirmed: owner, fields, current/desired argument order, all helper return
  branches, constants, move/steer/liveness order, acquisition query, target
  loss, low-mana inputs, base-tick siblings, and all direct xrefs.
- Inferred: the Website `active` target flag semantically projects native
  target byte `+0xF9`; this is already the project's live/dead query contract
  and the instruction order determines how it must be consumed.
- Unknown: none material to the fixed-tick tracking system.

## Web implementation consequence

- Correct owner/module: `core-kernels/primary-spell-targeting.ts` owns the pure
  native direction gate and homing step; `primary-spells.ts` owns retained
  identity/liveness ordering; `boneyard-world.ts` owns registered target rows.
- Shared model change: replace angular-error multiplication with the
  three-valued direction result, retain inactive-but-registered target rows,
  steer once before clearing an inactive retained identity, and preserve the
  no-handle no-accumulator branch.
- Stock behavior preserved: full and low-mana speeds/turn inputs, move-first
  integration, float32 state, target root, rank-one no-reacquire, terrain and
  contact ownership, render/audio, and protocol schema.
- Browser-specific approximation: none.
- Symptom patch or obsolete path to remove: private `signedHeadingDelta` and
  the regression that expects the proportional `1.8..1.9`-degree correction.

## Validation contract

- Focused automated test: exact first full/weak steps; positive, negative,
  wrap, inclusive deadband, and `180` tie outputs; move-first position;
  accumulator threshold/cap; no-target freeze; moving target; final inactive
  target sample; target clear; no rank-one reacquisition; Boneyard dying-row
  retention without acquisition/contact eligibility.
- Playwright/runtime journey: run a real Boneyard Ether cast against a live
  off-axis enemy, capture authoritative projectile samples across multiple
  host ticks, verify sign-sized monotonic heading steps and target identity,
  and record page/console errors.
- Stock-versus-web comparison: compare the first and subsequent numeric
  heading recurrence against the instruction-derived oracle under matching
  initial heading, target position, speed, turn input, and tick count.
- Measurable acceptance criteria: first neutral/weak corrections are
  `0.02/0.012` degrees; no per-tick correction exceeds
  `turnInput*accumulator`; the cyclic deadband returns zero; dead target gets
  exactly one final sample; no target does not grow the accumulator; full
  canonical gate and browser journey are clean.

## Implementation validation receipt

- Files/modules changed: `primary-spell-targeting.ts` replaces proportional
  angular-error multiplication with the exact `-1/0/+1` cyclic gate;
  `primary-spells.ts` resolves retained identity without rerunning acquisition
  flags and clears only after the inactive target's final sample;
  `boneyard-world.ts` keeps dying actors registered as inactive query rows.
  Focused kernel/world tests cover every in-boundary branch. The dedicated
  `smoke-ether-primary-tracking.mjs` production-preview fixture advances only
  the authentic Solomon opening by host-owned player placement, then lets the
  ordinary wave system, browser input, primary simulation, contact, renderer,
  and audio owners run unchanged.
- Test-first proof: the pre-implementation canonical run failed the new sign
  gate, dying-target, and registered-row contracts. After implementation, the
  final current-main canonical `./scripts/validate.sh` passed 25 backend
  contracts plus 40 loot, 150 prerequisite, 1,022 broad Boneyard/game, 5
  level-up, 6 diagnostics, 14 Hub UI, and 5 desktop tests; formatting, lint,
  architecture boundaries, backend/frontend/game-host builds, bundle budget,
  and CSP media policy also passed. The focused Mod Loader static RE contract
  rejects the superseded angular-delta formula and passed on the corrected
  report.
- Browser/native evidence: the 1600x900 production-preview journey created an
  Ether wizard, entered an authentic generated Boneyard, advanced the Solomon
  encounter into its ordinary ten-enemy opening wave, and browser-cast at live
  `enemy:8`. Consecutive authoritative flight ticks `1..4` retained that target while
  headings changed
  `329.9322814941406 -> 329.8122863769531 -> 329.59228515625 ->
  329.27227783203125` and accumulators changed
  `0.06000000238418579 -> 0.10999999940395355 ->
  0.1599999964237213 -> 0.20999999344348907`. Every turn exhausted the
  instruction-derived sign-step bound with maximum float32 slack
  `0.000004887580871582031` degrees; movement stayed inside the exact
  speed-by-tick bound. Launch and impact cues fired, the Ether impact rendered,
  and page/application-console errors were empty. The inspected capture is
  `/tmp/solomon-ether-tracking-20260820.FmuK7m/solomon-primary-ether-boneyard-impact.png`.
- Remaining implementation explicitly out of scope: learned multi-missile
  construction/reacquisition and the three non-primary derived missile
  classes listed in the membership table. They are separate owners rather
  than browser constraints; there are no `blocked-by-platform` members or
  material native unknowns in rank-one tracking.
- Git/publication state: the isolated Website and Mod Loader worktrees are
  based on current `origin/main` after the concurrent weather-parity and
  Create-name fast-forwards. No commit, push, deployment, or production
  change was made.
