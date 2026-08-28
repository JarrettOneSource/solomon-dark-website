# 2026-08-14 — Primary targeting, range, homing, and repeat-cast correction

## Superseded assumptions

- Air's prior fixed `205` endpoint was a Frost Jet constant, not Lightning
  ownership. Native untargeted Lightning extends by twice the active Region
  extent and clips to world geometry.
- Magic Missile's prior direction-locked advance omitted its native target
  handle, turn accumulator, and per-tick steering.
- Ether and Fire were press-edge-only. Native input is held-level: a finished
  one-shot Staff action is queued again while the button remains down.

## Recovered contract

- Lightning refreshes a 30-degree target cone every held tick. Candidates must
  be live and visible, are ordered by lower native priority then nearest
  distance, and include both combat actors (base priority `0`) and the Region
  special-scenery lane. Gravestone type `2029` belongs to that lane and sets
  priority `1000`, making it the native fallback when no combat actor qualifies.
  A retained target may survive a
  missed refresh while it remains alive and within the wider `dot>=0.71`
  heading gate.
- A targeted endpoint is the actor attachment plus its world position, clipped
  against the world, then shifted upward 20 units. Gravestone's attachment is
  exactly zero. With no target, the endpoint is the clipped Region-length ray.
  The first Lightning middle control point lies half the source/endpoint
  distance along the caster's original aim, so an off-axis target produces the
  stock curved QuickSpline rather than a straight target line.
- Native chain adjacency is radius `200`, nearest unused actor, with damage
  multiplied by float32 `0.600000024` per hop. Rank-1 currently has no extra
  hops, but the authoritative bolt representation preserves per-segment
  geometry rather than baking rank into presentation.
- Rank-1 Ether chooses the actor nearest a probe 100 units ahead of its launch
  socket (squared-distance ceiling `999999`, no LOS requirement). Speed is
  three units/tick. It moves on the current heading, then steers the next tick
  with initial turn accumulator `0.01`, turn input `2`, `+0.05` while the
  accumulator is at most one, `+0.002` above one, and cap `10`. Target loss
  clears rank-1 homing; there is no native fixed flight timeout.
- Staff Cast1 rate is float32 `0.075`. Neutral Ether keeps that rate. Neutral
  Fire applies an additional `0.75`, yielding `0.05625`. The shared native
  cast-speed helper uses equipment, Faster Caster, and element-class
  multiplier/flat lanes; it is not a damage scalar. Ether must therefore emit
  and finish sooner than Fire by default, and both restart while held after
  their action completes.

## Ownership and implementation boundary

Target acquisition, retention, clipped bolt points, Ether target identity,
heading, turn accumulator, and one-shot restart all belong to the authoritative
fixed tick and wire state. Boneyard world construction retains targetable
Gravestones and exposes active wave enemies; render code consumes the resulting
semantic geometry/state only. Hub has no target candidates and therefore uses
its clipped untargeted ray. The implementation retains the existing
deterministic cosmetic Lightning/Ether compositors while replacing their
incorrect gameplay inputs.

Evidence is static instruction/decompile work against retail
`SolomonDark.exe` SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`:
Air `0x00529AD0`, `0x0052BA80`, `0x0053F9C0`, `0x00641500`, `0x00641340`;
Ether `0x0053CFE0`, `0x005E4990`, `0x005FD270`, `0x005E4A80`, `0x005E4B80`,
`0x00641160`; Staff cadence `0x0044B170`, `0x004486E0`, `0x0052DA80`,
`0x00656580`.

## Integrated implementation receipt

- The authoritative fixed tick now performs the Region-bound Lightning query
  separately from world obstruction clipping. This prevents a targetable grave
  from shortening its own candidate range. Active enemies use native base
  priority zero; Gravestone `2029` uses priority `1000` and is the fallback.
  Each replicated bolt carries stable target identity and explicit source,
  original-aim control point, and clipped endpoint for the native QuickSpline.
- Rank-1 Ether now acquires once around its 100-unit forward probe, moves on its
  prior heading, steers with the float32 accumulator recurrence, clears a lost
  target without retargeting, performs its five-tick terrain lookahead, and has
  no invented fixed lifetime. Ether's neutral Staff marker/action program is
  15/56 ticks versus Fire's 19/74, and both one-shot actions requeue while held.
- Protocol v13 owns the retained Air target, explicit Air geometry, and Ether
  target/heading/turn state. Snapshot interpolation keeps those semantic fields
  discrete while interpolating only presentation-safe actor motion. Focused
  coverage pins enemy priority, Gravestone fallback, retained-target gating,
  off-axis bolt geometry, launch-probe selection, move-then-steer ordering,
  target-loss behavior, per-element pose/cadence, protocol strictness, and
  world collision/range separation.
- The currently materialized wave enemies use the native base attachment
  `(0,0)` and priority zero. Other stock actor subclasses are not exposed by the
  current Website world model; their class-specific `+0x34` attachment and
  `+0xFC` priority values remain bounded future work rather than guessed data.
- Isolated 1600x900 Chromium/WebGL journeys on the rebased integration tree returned
  `status: ok` and `errors: []` for all five elements. Air's Boneyard receipt
  acquired `scenery:object-140`: the player and bolt agreed on that id, and the
  wire published source `(396.24,171.5)`, original-aim control
  `(554.33,809.81)`, and grave endpoint `(656.83,1460.61)`. The control lies
  about 28.49 units from the geometric midpoint, directly proving the off-axis
  native arc. Its inspected capture is
  `/tmp/sdr-primary-vfx2-rebased-20260814/solomon-primary-air-boneyard-target.png`,
  SHA-256 `d78d8e8941b3d088d60f19b2d79008b43cdfa0abbed084b8b1cd0cb3042c115f`.
- The inspected Ether Hub compositor capture is
  `/tmp/sdr-primary-vfx2-rebased-20260814/solomon-primary-ether-hub.png`,
  SHA-256 `b5f39af035ecc160604241efeb7700aeb6c3fa64e242aad654be72aada102a43`.
  The scene has no eligible enemy, so this is flight/render/cadence proof;
  deterministic authority tests, not a fabricated browser target, prove the
  target-present homing and target-loss paths.
- The same exact-tree run observed 64 independently owned Water particles in
  Boneyard, and Earth progressed from the `0.18` opening assembly with seven
  body rocks and a `0.615` flash to `0.80` assembly with 26 rocks and 11
  CalledRocks, then produced 27 independently rooted impact fragments.
