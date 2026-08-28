# 2026-08-14 — Ether primary Magic Missile presentation ownership

## Reported smell and parity question

- Reported web behavior: Ether's rank-1 primary is a narrow, flat magenta
  streak. It reads as one rotated projectile sprite and is not visually close
  to the stock Magic Missile.
- Stock behavior to recover: the complete in-flight compositor, its native
  owner and clock, all child textures and passes, per-frame randomness,
  world-painter placement, contact-adjacent animations, and teardown.
- Reproduction inputs/scenes: create an Ether wizard, left-click a world
  target in the Hub or Boneyard, and inspect the projectile after Ether's Staff
  Cast 1 marker at insertion-relative update 14.
- Falsifiable questions: whether `BadGuys[53]` is the in-flight body; whether
  the body rotates along travel; whether flight emits independent trail
  actors; whether records `110..112` are Fire-only; and whether the visual
  phase follows render time, projectile age, or heading.

## Evidence and provenance

| Preserved retail binary | `SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` | Same 0.72.5 image as the closed projectile and animation campaigns. | high |
| Fresh instructions | read-only headless Ghidra replica; handler `0x0053CFE0`, constructor `0x005E4990`, tick `0x005FD270`, draw `0x005E0460`, compositor `0x00535A30`, contact `0x005F1F00`, destructor `0x005E4F80` | The projectile draw never references record 53. It calls the full Ether compositor with three registered textures and a projectile-owned phase. | high |
| Fresh instructions | `Anim_FadeMM` vtable `0x007848C4`, tick `0x00454000`, render `0x00457110`; `Anim_FadeAdditive` vtable `0x007847F4`, tick `0x00454000`, render `0x004560A0`; `ZAnimLit` constructor `0x005E03D0`, tick `0x005FD1D0`, render `0x005E01E0` | Contact owns a large Ether fade; the pierce branch separately emits additive record-53 streaks. Neither object is a flight trail. | high |
| Asset/data | `BadGuys.bundle` SHA-256 `a7b13b464e035e2099081ce942db4aa231fc7c20de1ecacbd9d0a590132c88d3`; registrations `110..112` at app field `+0x46BC`; record 53 at `+0x28CC` | Flight uses core `110` (27 x 26), spark `111` (40 x 40), and ray `112` (40 x 40). Record 53 is a 28 x 58 contact streak. | high |
| Existing web capture | `/tmp/solomon-primary-ether-hub.png` on the pre-fix WebGL tree | The web renderer draws only the rotated record-53 streak, confirming the ownership mismatch. This is web-baseline evidence, not clean-stock evidence. | high |

No fresh clean-stock projectile frame was obtained in this pass. The visual
contract below is instruction- and asset-derived rather than calibrated from
one selected screenshot. That is stronger for object ownership and constants,
but native RNG sample-for-sample pixel identity remains explicitly open.

## Native ownership thread

- Owner and construction path: Staff Cast 1 crosses its marker, primary
  handler `0x0053CFE0` creates factory type `0x7D3`, and constructor
  `0x005E4990` installs `MagicMissile::vftable` at `0x0079C544`. The actor is
  0x168 bytes and is registered in the authoritative world.
- Upstream state producers/callers: the handler seeds the cast-glyph emitter
  plus `(0,+10)`, scalar heading at `+0x13C`, base speed `+0x144 = 3`, visual
  phase `+0x154 = RandomFloat(360)`, visual scale `+0x15C = 1`, optional
  half-alpha flag `+0x160`, and pierce count `+0x161`.
- State representation and transitions: tick `0x005FD270` advances position by
  the heading unit vector times `(+0x120 movement scalar) * (+0x144 speed)`.
  Its visual phase advances by the same scalar and speed times `3`; neutral
  rank 1 therefore adds 9 degrees each native tick. Homing and contact can
  alter heading but do not replace the presentation owner.
- Downstream consumers/callees: draw slot `+0x0C` at `0x005E0460` invokes
  compositor `0x00535A30` at local `(0,-10)`, with a new render-scale sample
  in `[scale, 1.5 * scale]` and the actor's phase. It does not submit record 53.
- Sibling systems sharing ownership or data: the same Ether compositor is used
  by `Anim_FadeMM` and other Ether-family objects. Fire-derived missiles also
  reuse records `110..112`, but with a different owning renderer and stack.
  Shared texture registration does not make their draw programs interchangeable.
- Entry, interruption, reset, and teardown: one actor is emitted on the
  one-shot marker; holding the press does not restart it. Flight has no fixed
  native timer. Accepted contact either removes it after creating the contact
  animation or consumes one pierce and continues. Deleting destructor
  `0x005E4F80` restores the Magic Missile vtable, calls the inherited object
  teardown, and optionally frees the allocation.

## Recovered behavioral contract

- Timing/ticks/thresholds: the flight compositor is drawn every accepted world
  render. The actor phase begins at a cosmetic random angle and advances by 9
  degrees per neutral fixed tick. Draw-time cosmetic RNG chooses the overall
  scale and each pass's alpha, particle count, offsets, scale, and rotation.
- Geometry/transforms/coordinate spaces: the compositor root is projectile
  world `(x, y-10)`. It is radial and does **not** rotate as one rigid sprite
  into the movement heading. Each of two identical painter passes emits:
  1. purple `(1,0.5,1)` core record 110 at scale
     `(2.5 + 0.15 * abs(sin(15 phase))) * S`, alpha `0.2 + U[0,0.25]`;
  2. the same core at `(1.5 + 0.15 * abs(sin(15 phase))) * S`, alpha
     `0.35 + U[0,0.55]`;
  3. additive white spark record 111, scale `(1 + U[0,0.1]) * S`, alpha
     `0.35 * abs(sin(5 phase))`, rotation `50 * S * sin(phase)` degrees;
  4. `Integer(10) + 2`, hence 2--11, additive record-111 sparks. Each uses
     radius `U[0,20*S]`, a random unit direction, scale
     `(0.25 + U[0,0.2]) * S`, alpha `U[0,0.75]`, and rotation `U[0,360]`;
  5. additive white ray record 112, scale `(1 + U[0,0.3]) * S`, alpha
     `0.55 * abs(sin(8 phase))`, rotation
     `50 * S * sin(0.5 phase)` degrees.
  `S` is the draw's sampled `[1,1.5]` actor scale. Both outer passes reuse the
  same phase but consume fresh random values.
- Render/hit/collision/traversal order: the complete compositor is one
  MagicMissile world-painter participant keyed by actor Y. Its normal cores
  precede the additive spark/ray lane within each pass. The Boneyard region
  light tints the participant at its actor position. Gameplay radius remains
  15 and does not derive from the much larger visible particles.
- Assets/audio/randomness: exact extracted flight PNG hashes are core
  `dc85c8e39483f4256ec7b28240d33a15b6966c0e997554598f19091d7a4c189f`,
  spark `3b02db24cc4caaad26432e4bf3e480c71c1a99e9cc8fb4fb4703077af22180c0`,
  and ray `d442af9ee058baceb7df36d682a4663cfd207818572fe77830833ef555802630`.
  Registry 57 `magicmissile.wav` plays once at birth; flight is silent.
  Registry 58 `magicmissilehit.wav` is contact-owned.
- Input/network authority/replication: the world actor's identity, position,
  phase age, and teardown are simulation-owned. Cosmetic draw samples are not
  replicated. A browser must seed them from stable actor identity/age instead
  of consuming authoritative gameplay RNG or frame-global mutable RNG.
- Boundary and failure behavior: rank-one homing and terrain/actor contact are
  now authority-owned. Pierce remains outside rank one. Magic Missile has no
  native fixed lifetime; its world/contact lifecycle is the boundary.

## Nearby-system findings

- Normal contact with no pierce constructs `Anim_FadeMM` at the missile
  position. It starts at fixed scale `2 * missileScale` and alpha scalar 2;
  shared tick `0x00454000` stores a float32 subtraction of 0.1 before removal.
  Same-tick registration leaves 19 drawable states `F[1]..F[19]`. Render
  `0x00457110` calls the same Ether compositor using fixed-tick sentinel
  `-9999`. A `ZAnimLit` wrapper owns radius `0.75`, intensity `1`, delta
  `-0.05`, and painter bias `100`; the bias is not a light radius.
- A surviving pierce contact advances in steps capped at 5 world units and
  creates one additive `Anim_FadeAdditive` per step. Each child draws
  `BadGuys[53]`, heading-aligned, alpha 1, with the shared 0.1 fade decrement
  for ten ticks. This is the only Magic Missile path in `0x005F1F00` that
  binds record 53.
- Rank-one FadeMM/light/audio now come only from an authoritative contact
  transient. Record-53 pierce children remain dormant because rank one does
  not own pierce.

## Confidence and open questions

- Confirmed: owner, constructor fields, phase recurrence, full two-pass flight
  stack, records and dimensions, normal/additive ordering, contact child
  classes, fade timing, audio triggers, painter ownership, and teardown.
- Confirmed: both the flight render slot and FadeMM/ZAnimLit child trampoline
  bypass common Region-light tint; the core formulas use the
  engine's degree-sine helper as expressed above.
- Unknown: the higher-skill writer and exact semantic name for `+0x160`; rank-1
  uses the normal branch. Native global RNG sample identity is deliberately
  not recreated in browser presentation. No clean-stock pixel frame closes
  the final screenshot-level color-management comparison.
- Next falsifying probe if material: clean stock with a rank-1 Ether caster,
  capture successive projectile frames, then compare core/ray extents and the
  9-degree phase recurrence against a deterministic browser sequence.

## Web implementation consequence

- Correct owner/module: a dedicated Ether primary presentation module owns the
  actor-local compositor; the shared primary-spell dispatcher only selects it.
- Shared model change: none. Stable projectile `id` and `ageTicks` are enough
  to derive a deterministic cosmetic phase and per-frame samples.
- Stock behavior preserved: radial two-pass records `110..112`, `(0,-10)`
  root, exact pulse/alpha/count/radius/rotation constants, normal/additive
  ordering, world-Y painter identity, and Boneyard tint.
- Browser-specific approximation: seed initial phase and per-draw random
  samples from `(projectile id, age tick, draw channel)`. This retains native
  distributions and stable multiplayer rendering without coupling cosmetics
  to authoritative simulation or browser frame rate.
- Symptom patch to remove: the heading-rotated `BadGuys[53]` flight sprite.
  Keep record 53 catalogued only for the unimplemented contact/pierce lane.

## Validation contract

- Focused automated test: pin two complete passes, records, exact deterministic
  draw count bounds, phase recurrence, both core formulas sharing `15*phase`,
  spark `5*phase`, ray `8*phase`, half-phase rotation, `(0,-10)` placement,
  and absence of record 53 from flight.
- Playwright or runtime journey: cast Ether in the real WebGL Hub, assert the
  actor exists as one painter participant using the Ether compositor, capture
  it after the action marker, and record page/console errors.
- Stock-versus-web comparison: compare the instruction-derived visible stack
  and exact extracted records; do not claim sample-for-sample native RNG.
- Measurable acceptance criteria: the flat oriented streak is gone; the live
  actor is a purple radial core with independently rotating spark/ray layers
  and a visible stochastic spark cloud; world painter and tint behavior remain
  unchanged.

## Implementation validation receipt

- `primary-spell-ether-native.ts` now owns the deterministic browser projection
  of the recovered two-pass flight compositor. `primary-spell-ether-view.ts`
  materializes those operations as one actor-local Pixi container, and the
  shared world dispatcher selects that view only for Ether. Record 53 remains
  loaded under the contact-specific `etherPierceStreak` name and is absent
  from the flight view.
- The focused contract passes inside the complete Website suite. It pins
  records `110/111/112` and their `27 x 26`, `40 x 40`, `40 x 40`
  registrations; both full pass counts and draw order; 2--11 radial sparks per
  pass; the `+9` degree phase recurrence; exact core/spark/ray phase lanes;
  `(0,-10)` root; deterministic cosmetic sampling; and no flight body, source
  glow, trail, or contact-streak operation. The primary asset manifest also
  pins all three flight PNG hashes.
- The canonical `./scripts/validate.sh` gate passes, including 363 frontend
  tests, desktop tests, production TypeScript/Vite/game-host builds, backend
  build/integration tests, lint, and production media policy. Existing
  Fast Refresh and Vite chunk-size warnings remain non-failing and unrelated.
- Real headless Google Chrome at `1600 x 900` used the Pixi WebGL canvas against
  an isolated authoritative host and Vite origin on `127.0.0.1:5298`.
  `SDR_PRIMARY_SPELL_KIND=ether npm run smoke:game:primary-spells` observed
  Staff pose 8, exactly one world participant labelled `ether`, the one-shot
  Magic Missile cue, and no page or console errors. The screenshot is
  `/tmp/solomon-ether-parity-20260814.dkQHRh/solomon-primary-ether-hub.png`,
  SHA-256
  `bce02392cae297c85b02ff335393e9067002265f91c72096ddc38addf21da4e3`.
  Visual inspection confirms a radial purple core, independently oriented ray,
  and stochastic spark cloud; the old heading-aligned flat streak is absent.
  The owned server and browser exited, and port 5298 was clear afterward.
- Remaining limit: this proves instruction/asset parity and browser ownership,
  not sample-for-sample native global RNG or clean-stock color-management
  calibration. Record-53 pierce streaks remain deliberately dormant because
  the modeled rank-one spell has no pierce upgrade.
