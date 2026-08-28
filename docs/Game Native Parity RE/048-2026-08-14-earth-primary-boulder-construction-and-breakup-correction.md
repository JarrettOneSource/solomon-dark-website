# 2026-08-14 — Earth primary Boulder construction and breakup correction

## Reported smell, reproduction, and parity boundary

- Reported behavior: Earth primary shows a small white glimmer, but the stock
  rocks gathering and assembling into a Boulder are absent. The released web
  projectile remains that glimmer and has no stock breakup presentation.
- Reproduced on isolated Website commit `a272433` (which contains the initial
  primary-spell implementation `989aab3`) in real Chromium at 1600 x 900. Hub
  hold/release frames are
  `/tmp/sdr-primary-a272433-live/solomon-primary-earth-hub.png` and
  `...-hub-release.png`, SHA-256
  `0b4260e38319312b869c783a704a826a5203b5d7fea7d5e542026f45cd302bd8`
  and `98a9599361a30e232558cb9fe8f848ecef4e46b0d6a53457e572f38a32b7fbba`.
  Boneyard hold/release frames are
  `...-boneyard-held.png` and `...-boneyard-release.png`, SHA-256
  `7c415d46ac251c80cbcd9c0e809b27db7f9ba356eaff42a782400b9b93b08ba5`
  and `380d3bca9e4a699d1af45f8fa0a244474ceb6e09bebb4362c0403d35146e221b`.
  All four show record 86 as a solitary green-white orb; no main rocks or
  incoming called rocks exist. This is the exact current-web mismatch.
- This correction owns Earth construction, held/released body presentation,
  terrain-impact phase, and breakup. General cast-facing remains the shared
  player/cast owner. Native residual damage, actor-hit continuation, mana, and
  rank progression remain outside this visual correction unless their
  authoritative producers already exist.

## Evidence and executable/project/capture provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Preserved executable | `SolomonDarkAbandonware/SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` | Same retail image as the closed projectile/input corpus. | high |
| Fresh static pass 1 | Ghidra 12.0.3 existing analyzed project `Decompiled Game/ghidra_project/SolomonDark.gpr`, copied to disposable `/tmp/sd-earth-ghidra-id4935tL`, opened headless with `-readOnly -noanalysis`; dispatcher `0x00544C60`, ctor `0x005FA270`, tick `0x00609D30`, builder `0x005FE430`, draw `0x0060AC40`, release `0x005E5450`, contact `0x00620B60`, breakup `0x0060B700`, destructor `0x005FA3F0` | Closes the Boulder owner, fields, held/flight transition, persistent Rock collection, draw ordering, impact and teardown. | high |
| Fresh static pass 2 | Fibonacci builder `0x00411400`; `Anim_CalledRock` ctor/tick/draw `0x00453890/0x00457FF0/0x0045E440`, vtable `0x00784EE4`; `Anim_BoulderBit` ctor/tick/draw `0x00473290/0x00457E00/0x00457E40`, vtable `0x00785D68`; direct PE scalar reads | Closes exact shell distribution/count, body versus lit-rock banks, inward trajectory constants, crossfade, and fragment family. | high |
| Exact stock bundle | `SolomonDarkAbandonware/images/BadGuys.png` plus `BadGuys.bundle` | Persistent aura record 15 is 38 x 37; additive opening record 86 is 94 x 94. Main records 168..171 are 37 x 33, 33 x 32, 38 x 34, and 17 x 17 rocks. Lit records 2008..2010 are 37 x 33, 33 x 32, and 38 x 34. Optional dust record 18 is 40 x 34. | high |
| Historical stock observer | instrumented multiplayer host frame `/mnt/d/codex-evidence/spell-fx-20260726/investigation/boulder-observer-trace/earth/client_casts/cast-01/chosen-host.png`, SHA-256 `c0893564eb55353b02f28b9e70b97350f0ab1be6b6efa2b82df864ae99b5595b` | Shows a multi-rock cluster at the caster's right-hand/staff emitter with a bright center effect. Static instructions identify the mature effect as record 15; the frame corroborates composition/attachment, not exact cadence or count. | medium |
| Current web source | `primary-spell-world-view.ts`, `world-player-textures.ts`, `assets.ts`, and extractor at `a272433` | Extractor names record 86 `primary-spell-boulder`; `ProjectileSpellView` draws only that texture at `scale=charge` and rotates the flat sprite by `0.035` rad/tick. This precisely explains the symptom. | high |

A new clean-stock desktop capture was not safe: unrelated isolated stock
processes owned the desktop. No process was touched or launched. The static
facts above are independently closed; the historical frame is explicitly not
promoted to a clean timing oracle.

## Second-pass correction: persistent aura, assembly ownership, and flight

A fresh two-pass audit of the same retail image corrects one material error in
the first Earth implementation. Pass one decompiled Boulder constructor/tick/
release/builder/draw at `0x005FA270`, `0x00609D30`, `0x005E5450`,
`0x005FE430`, and `0x0060AC40`. Pass two checked their PE instructions plus
dispatcher `0x00544C60` and the asset-object offsets. The result is not a
styling preference:

- `BadGuys[15]`, object field `0x0BB4`, is a persistent green-white aura drawn
  in held and flight phases. Draw instructions `0x0060ACD0..0x0060AE04` set
  RGB `(0.9,1.0,0.9)`, alpha `random(0,0.25)+0.35`, and scale
  `4.099999904632568*charge`. The exact 38 x 37 extracted asset is
  `frontend/src/assets/game/boneyard/badguys/0015.png`, SHA-256
  `5abc42fa09f09a5fefe3df9281d2102e6b93a48249edb4e21f36f73e1a0011eb`.
- `BadGuys[86]`, object field `0x4210`, is only the additive opening flash.
  Instructions `0x0060B1BC..0x0060B2B3` set white, alpha `openingMix`, scale
  `2.5*openingMix`, and rotation `globalRenderTick*6` degrees. It fades by
  `0.03500000014901161` per simulation tick; body alpha is reciprocal
  `1-openingMix`. The previous `4.1*charge` record-86 scale belongs to record
  15 and is removed.
- Draw starts with a shared-random whole-assembly displacement: direction is a
  random unit vector and radius is `random(0,3)`. Visual local Y is
  `-(+0x1D4)*charge*0.75 + (+0x1E0)`. Constructor `+0x1D4=30` and held tick
  `+0x1E0=-20-10*charge` make it exactly `-20-32.5*charge`. Actor position and
  inbound Region-light sample remain authoritative Boulder XY. Tick
  `0x0060A548..0x0060A55E` publishes sort bias
  `(20+10*charge)*charge*1.5`.
- Initialization builds the Rock list once at charge `0.18`. Tick compares
  `floor(30*oldCharge)` and `floor(30*newCharge)` and replaces the list only
  when that bucket changes. Count, local positions, central scale, variants,
  and stored shell scales must use authoritative `assemblyCharge`; interpolated
  current charge may move/scale the aura and visual root but must not make the
  shell breathe between rebuild ticks.
- Matrix `+0x154` advances in both states. The held branch composes `0.75`
  degrees around the current aim-derived axis. Each surviving flight tick
  first advances position, then composes `hypot(storedDelta)/charge` degrees
  around the frozen flight-heading axis before contact. Opening record 86
  normally finishes before minimum release.
- Dispatcher `0x00544C60` owns one actor and resamples current world aim plus
  staff socket every held tick. This is aim retargeting, not enemy acquisition.
  Release freezes the last aim and flies straight at speed `3`; no homing,
  spread, arc, gravity, fixed range, or fixed lifetime was recovered. Earth
  must not inherit the web-only 500-tick Ether/Fire containment.

Record 15, record 86, and the Rock body are children of the one Boulder painter
root. They inherit the Region sample at actor XY and emit no outbound light.
The shared native RNG sequencing/interleaving for aura alpha and draw jitter is
still unrecovered; the browser uses isolated stable-ID/tick cosmetic samples
without consuming gameplay RNG and claims the exact domains, not retail sample
identity.

## Native causal model

```text
authoritative primary input + world aim
  -> PlayerActor sustained Earth dispatcher 0x00544C60
  -> one cached Boulder 0x7D5 / vtable 0x0079E014
  -> held tick 0x00609D30
       -> float32 charge recurrence
       -> persistent aura + opening-flash/body crossfade
       -> discrete shell rebuild vslot +0x68 / 0x005FE430
       -> separately registered Anim_CalledRock particles
  -> draw vslot +0x1C / 0x0060AC40
       -> aura, additive opening flash, then transformed/depth-sorted main rocks
  -> same-identity release 0x005E5450
  -> straight flight + per-tick contact 0x00620B60
  -> breakup vslot +0x6C / 0x0060B700
       -> registered lit Anim_BoulderBit fragments
       -> Boulder removal and rolling-loop loss
```

Input owns only the held level and aim. The player authority already quantizes
heading from that aim and computes the live Staff socket; Earth follows socket
bank 0 on insertion and bank 7 while sustained, plus native local `(0,+15)`.
The visual correction consumes that actor position/direction. It must not add
a renderer-owned facing timer or replace the cached actor on release.

The 0x218-byte Boulder owns charge `+0x74`, a smart Rock list `+0x13C`
(backing `+0x150`), orientation matrix `+0x154`, opening mix `+0x1EC`, saved
charge `+0x1F0`, max charge `+0x1FC`, held/flight bytes `+0x1DC/+0x1DD`, and a
separate contacted-target list `+0x200` (backing `+0x214`). Each 0x3C-byte Rock
stores local XYZ `+0x00..08`, transformed XYZ `+0x0C..14`, scale `+0x18`, and
sprite variant `+0x1C`.

## Held construction and exact visual constants

The body builder is deterministic in count and geometry:

```text
n = 30 * charge
main rock count = 1 + ceil(n)
shell radius = 30 * charge
for i in [0, ceil(n)):
  y = 2*i/n - 1 + 1/n
  theta = i*pi*(3-sqrt(5))
  point = radius * (cos(theta)*sqrt(1-y*y), y,
                    sin(theta)*sqrt(1-y*y))
```

- The first Rock is variant 3 (`BadGuys[171]`) at the origin with scale
  `4*charge`.
- Every shell Rock chooses variant `0..2` (`BadGuys[168..170]`) and scale
  `min(1, (random(0,0.75)+0.5)*min(charge,1))`.
- The builder replaces the whole list when `floor(30*charge)` changes and the
  list remains unchanged between those authoritative edges. At
  initial charge `0.18`, the body is one center plus six shell rocks; exactly
  `0.3` is one plus nine, while the observed float32 release row
  `0.3012498915` has one plus ten; full charge is one plus 30.
- Main draw transforms local XYZ by the Boulder matrix, keeps only strict
  `transformed_z > -40`, sorts ascending transformed Z, then draws. Constructor
  helper `0x00402CC0` initializes the matrix as identity with zero translation.
  Rank-1 shell radius never exceeds `30` and held updates are pure rotations,
  so the depth-plane branch cannot cull a valid rank-1 Rock; the implementation
  nevertheless retains the native predicate. Projection helper `0x0043A8A0`
  copies transformed X/Y exactly and never reads Z. Z therefore affects only
  culling/order, with no perspective displacement or registration offset.
  Sprite registration is Boulder actor position plus that orthographic XY
  offset. Main draw also applies `max(storedScale, float32(0.45))`; the float at
  `0x00785370` and comparison double at `0x00786C88` both resolve to
  `0.44999998807907104`. The main bank is normal world/lit sprite art, not an
  additive screen overlay or one flat rotated texture.
- The held tick rotates matrix `+0x154` by `0.75` degrees per tick: constructor
  angular field `+0x70` is float `3`, multiplied by double `0.25`, around the
  current heading-derived axis. Release preserves the accumulated matrix, but
  every surviving flight tick postmultiplies it again by the exact distance /
  charge roll before collision. The released 3D shell therefore keeps spinning.

Record 15 is the persistent charged aura at scale `4.1*charge` and randomized
alpha `[0.35,0.60]`. Record 86 is the separate crossfade source. Mix
`m = max(0, 1 - 0.035*ageTicks)`; the 94 x 94 flash draws additively with alpha
`m`, scale `2.5*m`, and global-render rotation `6` degrees/tick, then the main
collection draws with alpha `1-m`. The transition finishes in about 29 native
ticks (about 290 ms at the authoritative 100 Hz clock). The prior web omitted
record 15 and incorrectly assigned its charge scale to record 86.

Called rocks are distinct world animations, not members already sitting in
the shell. Below charge `0.25`, held tick emits one each tick; later it emits
when native `randInt(0,2)==1` until full charge. Each chooses lit
`BadGuys[2008..2010]`, starts on a random direction/radius around the current
Boulder with upper radius `clamp(50*charge,5,120)`, and stores that absolute
world position plus the same Boulder identity. It homes from float32 speed
`0.1`, multiplies speed by float32 `1.1` per tick to a cap of `5`, and removes
inside distance `5`. After that homing step, each tick derives the current
rock-to-parent heading, adds `90` degrees, and applies the fixed per-particle
`random(0,4)` lateral magnitude; there is no per-tick RNG sample. Its scale is
`0.75*min(charge,0.75)`, perspective height begins at `-2`, target height is
`boulder[+0x1E0] - 20 - 20*charge + random(0,5)`, and height approaches that
target by `1.5` per tick. Initial rotation is `0..360` degrees and its fixed
step is `-30..30` degrees.

If release wins first, the authoritative actor enters its fall branch: height
adds fall velocity, velocity adds `1`, positive height forces velocity to
`0.25`, and removal happens only after height is strictly greater than `10`.
There is no fixed twelve-tick fall, alpha fade, maximum homing lifetime, or
license for presentation to reconstruct old births from interpolated Boulder
age. Optional record-18 dust and occasional loose bits are separate sibling
actors.

Registration and lighting are also distinct per actor. CalledRock is inserted
directly in the world animation list; its full draw vslot `0x0045E440`
bypasses both `Puppet_RenderDispatch (0x00624B40)` and `ZAnimLitObject`, so it
has no inbound Region-light sample or outbound light. It must publish a direct
painter root with `regionLightPoint=null`. By contrast, the Boulder body's
vslot `+0x0C` is `Puppet_RenderDispatch`; its painter root samples Region light
at Boulder world XY. That inbound lane is independent from its recovered
outbound provider: vslot `+0x30` `0x005E5670` submits the actor root with radius
`max(1,2*charge)`, intensity `0.5`, and the retail Multiple-Shadows flag.

Stock consumes its shared RNG for variants/scales/emission/angles. Those
samples are cosmetic. The web analogue must use deterministic, isolated hashes
of spell ID, particle identity, and native tick so host and observers render
the same distribution without advancing gameplay/collision RNG. Shell point
geometry itself is the exact nonrandom Fibonacci sequence.

## Release, contact, breakup, order, and lighting

`0x005E5450` flips held to flight on the existing actor. It preserves charge,
Rock list, matrix, and identity and assigns straight speed `3`; there is no
arc or gravity. Held collision radius is `15`; immediate release/contact uses
`45*charge`, and `0x00620B60` updates normal-flight collision radius to
`75*charge` before asking world/actor contact every flight tick. No native
fixed flight expiry was recovered. At `0x00620C2D`, normal flight commits the
velocity step into actor position `+0x18/+0x1C` before those queries. Terminal
breakup is therefore registered at the advanced contact sample, not the prior
clear position.

On terminal contact, `0x0060B700` restores saved charge, creates
`floor(max(8,30*charge))` fragments, and removes the Boulder. Let
`q=min(charge,1)`, `r=max(8,30*charge)`, and `step=360/r`. A random initial
angle advances once per fragment by `step+random(-step/3,+step/3)`; direction
Y is scaled by `0.8`. Every fragment chooses lit `BadGuys[2008..2010]` and
uses the following recovered constructor/breakup state:

- perspective velocity and retained bounce seed begin at
  `-(random(0,3)+2)`, then both multiply by
  `random(0,1.5)*q+0.75`; height is `-random(0,50*q)`;
- radial placement is `random(0,45*charge)` and speed is
  `random(0,1.5*charge)+1.5` along the flattened direction;
- draw scale compares `(random(0,0.75)+0.5)*charge` to exact float32
  `0.44999998807907104`; the passing branch consumes a second independent
  `random(0,0.75)` before multiplying by float32 `0.65`, while the failing
  branch uses the floor. The result is capped at `0.75`;
- rotation begins at `random(0,360)` with step `random(0,10)+1`.

Base tick `0x00456720` first tests perspective height `+0x38`. Only while that
motion lane is nonzero does a global tick divisible by three branch directly
past motion, gravity, rotation, and the base fade. Other active-motion ticks
add XY velocity, add perspective velocity to height, add float32 `0.4`
gravity, and advance rotation. Crossing height zero rerolls the `1..11`
rotation step, damps the perspective velocity/bounce seed by float32 `0.3`,
conditionally damps XY by float32 `0.65`, and stops motion when perspective
velocity becomes greater than `-0.75`. Once that stop writes height zero, even
a tick divisible by three falls through to the base fade. Enhanced Effects
starts alpha at `10`; subclass tick `0x00457E00` subtracts float32 `0.025`
after every completed base call. Active every-third ticks therefore lose only
`0.025`; other active ticks and every settled tick also lose the base float32
`0.015`, for a two-subtraction total of `0.04`. The visible draw clamps alpha
to `1` and removal waits for non-positive alpha. The former forty-tick radial
burst is not native.

Each child is wrapped in its own world-registered `ZAnimLitObject`. The
wrapper copies child XY, sets native sort offset `-15`, and reaches the child
through `Puppet_RenderDispatch`, so its independent painter root samples
inbound Region light at fragment XY. `ZAnimLitObject` has no ZAnimLit
intensity/range tail and contributes no outbound light. The authority must
retain the single semantic Earth impact event plus its native global birth
tick; clients must not infer breakup from a missing sparse snapshot.

The existing terrain colliders are the available authoritative web contact
surface. Actor damage/contact continuation is not reconstructed here and must
not be faked. A terrain impact may publish the native visual breakup while the
ledger remains explicit that stock residual multi-target damage is absent.
The old 500-tick free-flight containment is not a stock Earth edge and must not
terminate the actor. Earth remains authoritative until terrain/contact or
owner/world teardown. The now-removed historical Ether/Fire PoC containment
was not evidence for an Earth range.

No direct `BadGuys[67]` shadow draw occurs in `0x0060AC40`; adding a bespoke
circle would invent stock art. Internally, aura/opening passes precede body rocks and body
rocks depth-sort by transformed Z. The Boulder body, every CalledRock, and
every fragment wrapper are separate painter roots, so scenery and other world
actors can interleave globally by full suffix. Region tint is applied only
when that root's explicit `regionLightPoint` is non-null: Boulder and fragment
wrapper use their actual XY; CalledRock remains self-colored. Grouping any of
those actors under the Boulder/impact parent violates native order and light
ownership.

## Audio, interruption, networking, and teardown adjacency

- Actor creation owns registry 87 `startboulder` once. Held/non-full owns
  registry 159 `gatherrocksloop__loop`; moving flight owns registry 168
  `rollingstoneloop__loop`. These historical audio findings identify lifecycle
  edges but do not prove visual construction.
- Release loses gather and acquires rolling on the same cached identity.
  Impact/removal loses rolling once. Replayed or interpolated snapshots do not
  recreate old start/impact cadence.
- Player removal, disconnect, death when that state exists, scene replacement,
  Hub-region change, Boneyard exit, and simulation teardown remove the actor,
  called-rock/fragment presentation, and loop ownership. Native destructor
  `0x005FA3F0` clears both owned lists before `Puppet` teardown.
- The current web has no mana producer. Construction must not invent mana
  failure or consume mana in presentation. When authoritative mana/death
  systems arrive, cancellation belongs in the spell simulation and replicated
  lifecycle, not the renderer.
- Projectile/impact state remains host authoritative and exact-match protocol
  data. Clients interpolate world position only; kind, phase, charge threshold,
  impact tick, variants/seeds, and owner/world identity remain discrete.

## Pre-implementation regression and proof contract

1. A focused pure-presentation test must fail against the single-record model,
   then lock 7/11/31 total rocks at initial/observed float32 release/full
   charge, central record 171, deterministic Fibonacci positions, seeded
   variant/stored-scale lanes, draw-scale floor, unreachable rank-1 depth
   cull, orthographic XY projection, Z sorting, persistent record-15 aura, and
   the reciprocal record-86/body alpha curve.
2. Called-rock tests must prove strict exact-match protocol/copy/interpolation,
   stable identities, absolute position under a moving Boulder, sparse-snapshot
   survival, deterministic RNG domains, speed/height/fall recurrence, release,
   removal, and teardown. Presentation must contain no historical birth loop.
3. Impact tests must prove one authoritative Earth phase with global birth
   tick, fragment count `floor(max(8,30*C))`, exact angle/sample domains,
   modulo-three motion, bounce/fade recurrence, and eventual removal.
   Containment must impact rather than disappear.
4. Exact extracted assets and dimensions must be hash-locked. Record 15 must
   be the persistent aura and record 86 the additive opening flash; main/lit
   banks must not be conflated.
5. Hub and Boneyard real-browser frames must show rocks assembling inside the
   persistent aura, an opaque multi-rock held/released body, and a breakup when
   a reachable authoritative terrain/containment edge is exercised, with no
   console/page errors.
6. Focused TypeScript/lint/asset checks must pass. Integration owns the full
   canonical `./scripts/validate.sh` gate on the combined element tree.

## Bounded unknowns and falsifiers

The exact shared native RNG seed/order and its interleaving with unrelated
actors are the only remaining fragment/called-rock RNG unknowns; they are
intentionally not part of the web gameplay model, and only recovered domains
and recurrences are claimed. No clean-stock 2026-
08-14 capture was available, and the 2026-07-26 observer frame is not a cadence
oracle. Actor-hit residual damage, impact camera impulse, impact audio identity,
and mana/death producers remain unreconstructed in the Website.

Falsifiers are: record 15 absent in mature hold/flight; record 86 scaled by
charge or retained as the mature body; a fixed bitmap
instead of per-rock depth ordering; body variants drawn from the lit bank;
called rocks drawn from 168..171; random samples changing between clients or
consuming authoritative RNG; release allocating a replacement identity; a
silent disappearance on contact/containment; renderer-inferred impact; a fake
shadow; or called rocks/rolling audio surviving owner/world teardown.

## Implementation and validation receipt

The authority now owns each `earth-called-rock` as stable-ID replicated state
with absolute XY, parent identity, homing speed, fixed lateral magnitude,
target height, rotation, release/fall state, and removal. Presentation only
copies/interpolates that state; the old loop that reconstructed historical
births from Boulder age is gone. The one semantic `earth-impact` event retains
the authoritative global birth tick and derived native lifetime, while the
pure `primary-spell-earth.ts` recurrence produces independently expiring
`Anim_BoulderBit` state. `earth-boulder-presentation.ts` is consequently only
the Boulder body and exact fragment presentation, not an authority surrogate.

`PrimarySpellWorldView` now exposes an explicit nullable Region-light point
for every painter root and routes depth/tint by its full suffix. Boulder is one
Region-lit root at body XY, CalledRock is one untinted direct root, and every
live fragment is its own `fragment-N` Region-lit root at absolute fragment XY
with native sort bias `-15`. The Boneyard renderer samples Region light only
for non-null roots. This lets scenery, players, enemies, called rocks, and
individual fragments interleave in the global painter rather than inheriting
one Boulder/impact parent depth or tint.

The focused authority/protocol/interpolation/presentation suite passes 40/40.
It pins moving-parent absolute state, fixed lateral magnitude, the simplified
target `-40-30*C+random(0,5)`, sparse snapshots, release/fall/removal and owner
teardown; exact fragment count/sample domains and recurrent angle distribution;
active global-modulo-three skips; sequential float32 `0.015` plus `0.025`
fade on settled ticks including ticks divisible by three; per-fragment death;
full-suffix tint/depth; nullable lighting; and unrelated-actor interleaving.
The canonical `./scripts/validate.sh` gate passes on the corrected tree:
backend build with 0 warnings/errors, 23 Website/backend contracts, frontend
lint and architecture boundaries, all 398 frontend tests, all 5 desktop tests,
production TypeScript/Vite/game-host builds, and production media policy.
Focused `oxlint`, `git diff --check`, production `npm run build`, and Loader
catalog JSON validation also pass.

Fresh WebGL evidence was captured from the owned
`http://127.0.0.1:52983` lane under
`/tmp/sdr-earth-ownership-proof-20260814`; the journey returned `status: ok`
and `errors: []`, and its host/server were stopped afterward:

| Frame | Authoritative/presentation state | SHA-256 |
| --- | --- | --- |
| `solomon-primary-earth-hub-opening.png` | early assembled stage (not the opening-glimmer tick): held age 49, charge `0.2412499487`, 9 body rocks, 13 authoritative CalledRocks | `ce5fcb981dfb2ea191d78cc603f7073528a6a458bd0b8a0f624628cdf355ca6f` |
| `solomon-primary-earth-hub-mid.png` | held age 319, charge `0.5787515044`, 19 body rocks, 9 authoritative CalledRocks | `541baeda11e98fd3bdbe5db755ecaff82808448249eca31afc54b7f9c6431047` |
| `solomon-primary-earth-hub-high.png` | held age 774, charge 1, all 31 body rocks; no new CalledRock emission at full charge | `8979a3ddcb926caab15a0fb9928917a7bd957214cd63476fb0259d27087f61d5` |
| `solomon-primary-earth-hub-release.png` | visible 30-fragment breakup from `earth-impact` id 255, birth tick 5664, age 16, lifetime 266 | `bcebb111c2b3b1d0ec12b5cbb81984b9bf609cc005e7b7d3ba55f4b46aa44a35` |
| `solomon-primary-earth-boneyard-held.png` | Earth body plus 7 authoritative CalledRocks under Boneyard lighting/painter ownership | `a4f7fa7668a27383397ab5f82eb7ee00f3dd33cf05c6b22cebe6990a8771852e` |
| `solomon-primary-earth-boneyard-release.png` | one semantic impact plus 11 independently falling CalledRocks; 10 painter bands and max dynamic Z 41 | `1e70f385d469300da6c2edefda76b89c22aa74887e83effee0655098721b46ab` |

This fresh browser run closes the former breakup-pixel gap and exercises the
new wire-owned CalledRock lane. The harness itself now counts CalledRocks from
authoritative transients rather than consulting renderer reconstruction. A
fresh exact opening-glimmer pixel and a clean-stock side-by-side remain proof
gaps; static instruction closure and deterministic regressions cover the
opening recurrence, but those gaps plus the explicitly unrecovered shared-RNG
sequence still preclude a literal pixel-for-pixel/exact-RNG claim.
