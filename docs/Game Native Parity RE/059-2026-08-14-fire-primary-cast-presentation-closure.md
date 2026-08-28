# 2026-08-14 — Fire primary-cast presentation closure

## Reported smell and bounded parity question

- Reported web behavior: Fire is a generic orange orb with two generic orbiting
  element sprites. It does not face along flight, emit the stock per-tick fire
  trail, reproduce the stock layered body draw, or contribute its native point
  light.
- Parity question: what does the retail rank-1 `Fireball` own from cast
  materialization through flight, drawing, lighting, contact, and teardown, and
  which adjacent fire objects must remain separate?
- This slice changes presentation only. The existing primary-cast PoC still has
  no actor/terrain contact authority, so the recovered impact burst and hit
  audio remain recorded but cannot be truthfully synthesized at an arbitrary
  flight timeout.

## Evidence and provenance

| Evidence class | Exact source | Finding | Confidence |
| --- | --- | --- | --- |
| Preserved retail binary | `SolomonDarkAbandonware/SolomonDark.exe`, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` | Exact executable used for every address and constant below. | high |
| Fresh static pass | read-only Ghidra replica; handler `0x0053DC60`, factory `0x005B7080`, constructor `0x005E0970`, tick `0x005FDD90`, body draw `0x006099C0`, light provider `0x005E50D0`, contact `0x005E5160`, deleting destructor `0x005E50A0` | Closes Fireball actor ownership, field use, pass ordering, particle creation, contact replacement, and teardown. | high |
| Render/light ownership audit | constructor instructions install vtable `0x0079C5BC`; its queue render slot `+0x0C` is direct draw `0x006099C0`; ordinary `ZAnim` slot `+0x0C` is `0x005E01E0`, which tail-jumps to child draw `0x0045E1B0`; common Puppet Region-light dispatcher is `0x00624B40` | Both the Fireball body and cosmetic trail bypass inbound Region-light sampling. Their draw functions install their own per-pass modulation. This is independent of the Fireball's outbound point-light provider. | high |
| Child-effect static pass | `Anim_FireParticle` constructor/tick/draw `0x00453290` / `0x004533A0` / `0x0045E1B0`; `Anim_FireBurst` constructor/tick/draw `0x00453470` / `0x004575B0` / `0x0045E2D0`; `ZAnimLit` builder/tick/light `0x005E03D0` / `0x005FD1D0` / `0x005E48E0` | Separates cosmetic flight particles, lit impact animation, and the damaging residual-fire actor family. | high |
| Registered art | Mod Loader `native-atlas-consumers.json` and Website BadGuys manifest | Singleton arrays `+0x478C`, `+0x479C`, and `+0x47AC` register impact `251..254`, Fireball `255..266`, and particle `267..270`; record `110` is the white core mask. | high |
| Existing native runtime image | loader-injected D3D9 backbuffer `/mnt/d/codex-evidence/spell-fx-20260726/post-fix-other-elements/fire-client-matrix/fire/client_casts/cast-01/chosen-client.png`, SHA-256 `0f4cc770c2ae3f86dc72f772acc2345d8a805a2cc68bd5196788dc74882cda07` | Supporting, not clean-stock, evidence for the bright yellow-white body, orange halo, trail, and local illumination. | medium |
| Existing web baseline | `/tmp/solomon-primary-fire-hub.png`, SHA-256 `02674c87a90f33d0ba90537f7d4326e21bf823b7f3e6cd5bdd35f037a230e906` | Confirms the generic round blob and missing stock trail/layering in the current port. | high |

The native image and extracted records were also inspected directly. The
existing `element-vfx-fire.png` is the exact registered 12-frame
`BadGuys[255..266]` strip, not placeholder art. The defect is its draw model and
missing child records, not the strip pixels.

## Native ownership thread

```text
Staff Cast 1 marker
  -> Fire primary handler 0x0053DC60
  -> GameObjectFactory_Create(0x7D4) 0x005B7080
  -> Fireball constructor 0x005E0970
  -> common actor tick 0x00624AC0 + Fireball tick 0x005FDD90
       -> one Anim_FireParticle/ZAnim child every Fireball tick
  -> render-queue slot +0x0C directly enters body draw 0x006099C0
       -> record 110 core
       -> selected record 255..266 additive
       -> same selected record source-over
  -> point-light provider 0x005E50D0
  -> first accepted actor/terrain contact 0x005E5160
       -> Anim_FireBurst/ZAnimLit + fireballhit
       -> remove Fireball
  -> deleting destructor 0x005E50A0
```

The handler starts at the native Staff emitter plus `(0,+10)` and then pushes
`20` along the normalized aim. It stores the unit direction at actor
`+0x13C/+0x140`; `0x00529380` also writes clockwise-from-up rotation degrees at
`+0x144`. Actor scale `+0x148` and movement scalar `+0x14C` both default to
`1`. The tick advances `4.5` world units with no angular spread. Contact probes
actors every tick and terrain every fifth tick. No fixed retail flight lifetime
exists: the first accepted contact removes the actor. At this historical
presentation-only baseline, the Website still had a 500-tick no-contact PoC
cleanup; the later contact closure removes it.

## Body registration, clock, transforms, and blend order

`0x006099C0` submits all body passes at actor translation `(x, y-10)` and the
stored heading rotation. The source art points screen-up, so the browser
rotation is `atan2(direction.y, direction.x) + pi/2`.

1. Draw `BadGuys[110]` with render color `(1, 0.5, 0, A)`, where
   `A = 0.2 + U(0.25)`. Scale is `(3.2 * actorScale,
   4.0 * actorScale)`. This pass does not set the renderer's additive flag.
2. Select `BadGuys[255 + floor(ageTicks/3) % 12]`. Draw it at scale
   `(2.0 * actorScale, 2.5 * actorScale)` with white color, alpha `1`, and the
   renderer additive flag set.
3. Clear the additive flag and draw the same frame and transform again with
   white color and alpha `0.5`.
4. Restore renderer color state. The optional actor modifier byte `+0x168`
   halves the outer alpha multiplier; rank-1 Fire has it clear.

The first pass consumes its alpha RNG on every native body draw. The web keeps
the cosmetic sample deterministic by projectile identity, but advances it with
the accepted presentation frame rather than fixed-tick projectile age.

This is a three-draw composite, not one additive sprite. The frame clock is
three native ticks per frame, 36 ticks per loop. Records `111` and `112` are
nearby shared spark/ray masks but are not drawn by the rank-1 Fireball body.

The Fireball is self-lit on the inbound side. Constructor `0x005E0970`
installs vtable `0x0079C5BC`, whose render-queue slot `+0x0C` is
`0x006099C0` itself, not common Puppet dispatcher `0x00624B40`. The direct
draw explicitly installs orange and white modulation for all three passes.
Consequently Boneyard Region light must not tint the body even though the same
actor independently publishes an outbound point light.

## Per-tick cosmetic trail

Every `0x005FDD90` tick allocates one 0x44-byte `Anim_FireParticle`, wraps it in
a world-owned `ZAnim`, and registers it through `0x0063E5B0`. The wrapper owns
the child and uses depth bias `30`. It is a presentation object, not protocol
damage state.

For a Fireball at position `P`, unit direction `D`, and actor scale `S`, birth
is:

```text
R = random unit vector
birthPosition = P + R * U(10*S) + (0,-10) - D*10
velocity      = D*2
rotation      = U(360) degrees
scale         = (U(1) + 0.5) * 1.25          # inclusive [0.625,1.875]
frame         = RandomInt(4)                  # BadGuys[267..270]
dBase         = (U(0.1) + 0.1) * 0.5         # inclusive [0.05,0.10]
d             = dBase * 0.5                   # Enhanced Effects: [0.025,0.05]
```

Each child tick adds `D*2` to position, adds one degree to rotation, multiplies
scale by `0.95`, subtracts `d` from red and alpha, and subtracts `2d` from green
and blue. It deletes after the new red value becomes negative. The trail thus
ages from white modulation through yellow/orange/red while shrinking. The
retail `ENHANCED EFFECTS` global `0x00B3BCAD` halves the base decrement. The
shipped Website-equivalent capability/default policy has Enhanced Effects on,
so Fire uses `d` in inclusive `[0.025,0.05]` and lasts roughly 20--40 ticks. Turning the
native setting off retains `dBase` in inclusive `[0.05,0.10]` and shortens the same
particle to roughly 10--20 ticks; it does not create a different actor family.
An older inspected performance-profile sample had that configurable alternate
off and is not a default claim. Particle draw uses the selected registered
record under the additive flag, then restores blend and color state.

The ordinary `ZAnim` wrapper is also self-lit on the inbound side. Its queue
render slot `+0x0C`, `0x005E01E0`, only loads the owned child at `+0x13C` and
tail-jumps to that child's slot `+0x0C`; it never enters `0x00624B40` or a
Region-light query. `Anim_FireParticle::Draw` `0x0045E1B0` clamps the child
RGBA at `+0x20..+0x2C`, installs it through `0x0041FE50`, enables additive
blending, draws `267..270`, then clears/restores state. Its painter root must
therefore advertise `regionLightPoint: null`, not sample the moving particle
position for inbound tint.

Native samples come from the process-global presentation RNG, including the
body alpha, every particle field, and the light radius. Replicating that exact
sequence would require the global RNG state and all intervening consumers. The
browser uses a stable semantic child id to project the same cosmetic
distributions; it does not advance simulation RNG or replicate those samples
as gameplay authority.

Sparse snapshots must not recreate missed particle births. The authoritative
primary-spell tick therefore latches one stable-id `fire` cosmetic transient at
the Fireball's post-move position on every Fireball tick, including its first
materialized tick. It owns immutable birth origin/direction/frame variant plus
age and deterministic lifetime. Protocol decoding validates it, snapshot
interpolation keeps birth fields discrete, and each transient enters the world
painter independently. The renderer only projects that already-owned semantic
birth through the recurrence above.

## Light, impact, audio, and teardown

The Fireball's actor-root light provider `0x005E50D0` submits position `P`,
radius `1 + U(0.25)`, intensity `0.75`, and the current retail
`MULTIPLE SHADOWS` byte `0x00B3BCAA`. The inspected sandbox profile stores an
explicit off override, while fresh shipped-Windows initialization defaults the
byte on through capability `0x00B3BCAE`. The browser Boneyard adapter must
include the Fireball among ordinary world-light candidates with deterministic
presentation-only flicker; Hub remains a full-bright world without the
Boneyard darkness compositor. This is outbound illumination only: neither the
Fireball body nor its `ZAnim` trail accepts Region light back as an inbound
tint.

On accepted contact, `0x005E5160` first owns gameplay/status dispatch and then
replaces the projectile presentation with `Anim_FireBurst`, not a final
Fireball body frame. The burst uses registered `BadGuys[251..254]`, phase
`+0.25` per tick (four ticks per frame, about 16--17 ticks total), moves
`y -= 1` per tick, starts at scale `1+U(0.1)`, and rotates from `U(360)` with
signed angular velocity magnitude `0.5+U(1)` degrees/tick. It draws an outer
record-110 core at `5 * mainScale`, orange `(1,0.5,0)`, and
`0.5 * (1-phase/4)` alpha, then the selected 251--254 frame additively under
color `(1,1,0.75,1)`. Its `ZAnimLit` wrapper starts radius `1.5`, intensity
`1`, intensity delta `-0.04` per tick, Multiple Shadows off, and depth bias
`50`; `0x005FD1D0` applies the intensity delta and `0x005E48E0` clamps submitted
intensity to at most `1`. Contact also requests `sounds/fireballhit`. None of
that can fire until Website collision produces a semantic contact event.

Fireball flight is otherwise silent; cast release already owns registry 97
`sounds/throwfire`. Removal tears down the actor through `0x005E50A0`, while
registered trail and burst wrappers own their independent child lifetimes.

## Adjacent-system audit

`Fire_Goodguy` type `0x7EE` is not the Fireball trail. It constructs at
`0x005E76C0`, ticks at `0x005FF050`, draws `DeadHawg[46..77]` at `0x00610F90`,
and applies damaging area contacts every third tick through `0x005FF1D0` for a
200-tick lifetime. Firewalker/Fire Wall and upgrade dispatchers may create that
gameplay actor. The rank-1 Fireball's `Anim_FireParticle` records `267..270`
never contact or damage actors. The Website must not fabricate
`Fire_Goodguy` state to make the primary look richer.

The complete Fire-family pass separates three more native owners. A naturally
spent Embers-to-Imps fragment creates an allied `GoodImp 0x3ED`, copies half
the row-19 damage into both attack endpoints, and gives it 300 ticks. Its tick
reuses Imp pursuit/contact, decrements life once plus once more while
targetless, and expires into a non-reward `Fire 0x7E3` release. The exact
outer tick is `GoodImp::Tick 0x0052C1A0`: a null retained target invokes
`0x0052A050` immediately, while a valid retained target is never periodically
reselected. It then calls shared `Imp::Tick 0x00485DC0` before either lifetime
decrement, so the terminal tick can still move, bounce, and contact.

The constructor chain `0x006287D0 -> 0x00473390 -> 0x00473E30 ->
0x00529FE0` consumes fourteen generic-Badguy RNG words followed by the Imp
fields: collision radius `2.5-Float(2.5)`, upper-effect phase `Float(10)`, one
of four body banks through `Integer(4)`, and signed body rotation
`Float(45,true)`. The retained body scale was created earlier as
`f32(0.9800000190734863 + Float(0.05,true))`; GoodImp does not replace it.
This is a 19-word constructor schedule. Its initial horizontal flight scalar
is `4.5`, while the team-zero base path samples a ten-tick movement interval;
the displacement budget is therefore `speed * 0.25 * 10` at each sampled
path step, not the former web-only two-tick approximation.

Every active Imp tick advances upper phase by `abs(speed)*0.25`, vertical
offset by velocity, velocity by `0.4`, and upper alpha toward zero by `0.05`.
Crossing positive vertical offset is the landing/bounce edge. It sets speed to
`4.5*(1+Float(1.5))`, vertical velocity to `-(3+Float(3))`, selects a new
body bank and signed `Float(60)` rotation, restores upper alpha to one, and
multiplies the vertical impulse by `1.5` exactly when `Integer(20)==3`.
That edge also owns an `Integer(8)` Imp vocal selection.

The landing contact threshold is
`distance <= (targetRadius + 45) * 1.25`. A successful contact consumes
`Float(0.25)` plus `Integer(3)` for the Bite sound, creates an independent
`BadGuys[251..254]` four-frame contact child at heading-offset distance `15`
and y `-15` with scale `0.5+Float(0.1)`, turns the Imp by
`180+Float(45)`, and consumes the two fade-child draws in inherited vslot
`+0xA0` (`0x00478A20`). There is no native 6/11/18 contact-action clock; that
was a named bounded web fallback and is removed. Ordinary Imp body/facing
remains `BadGuys[285..332]`, with upper fire `333..342`. Draw
`0x00492E10` keeps the body opaque at the retained scale/rotation and applies
`+0x228` alpha only to the upper flame, so fading the whole body is falsified.
The Imp bank plays at `1+Float(0.1)` pitch and the Bite bank at
`1+Float(0.25)`; host-owned monotonic landing/contact counters retain the
chosen row and pitch so sparse client snapshots neither replay nor invent
these sounds. All eleven untouched WAVs are hash-pinned to registry rows
`176..178` and `191..198`.
GoodImp also retains the shared Imp outbound-light provider `0x00478CC0`.
Actor glow `+0x230` rises by `0.01` to one; the provider submits intensity
`glow*(0.75+Float(0.25))`, radius `0.25+Float(0.1,true)`, current actor
position, and Multiple Shadows off. It remains independently Region-lit on
the inbound actor path; the two directions must not be conflated.

Ring of Fire helper `0x0063F920` creates 30 visual-only `MovingFire 0x7E6`
children at 12-degree base-heading intervals plus one damaging
`Shockwave 0x7E7`. MovingFire uses additive `DeadHawg[46..77]`, scale `2.75`,
life `1.05` decreasing `0.01` per tick, initial speed
`2.5*(1-U[0,0.025])`, and component acceleration `1.01`; the helper never
writes its damage lane. The Fire base constructor separately samples an atlas
phase with `RandomFloat(32)` and a horizontal-shape factor with
`RandomFloat(1)`. Tick adds `+0.25` to the phase for Fire/Fire_Goodguy or the
MovingFire override float32 `+0.12`; draw selects
`DeadHawg[46+round_to_even(phase)]`, positions the sprite at actor-local
`(0,-20)`, and scales it by
`(1.1*scale*fade*shape_sample, 1.1*scale*fade)`. This corrects the former web
model that collapsed atlas phase and fade into one lane. Shockwave begins at
radius `75`, grows by `6` before
each `0.01` life decrement, and starts with life `1.155`. Every ten ticks it
retains each newly intersected hostile once, deals half the row-21 damage,
runs Burn, and attaches the fixed 400-tick Dazzle response. It pushes retained
live contacts radially on its separate two-tick lane and multiplies push by
float32 `0.899999976` during the final `0.12375` life band.

Firewalker is a player/progression toggle, not a primary trail. While byte
`+0x8DC` is active, player mode is not `2`, and the global tick is divisible
by ten, `PlayerWizard::Tick 0x00548B00` creates one owned
`Fire_Goodguy 0x7EE`. Creation is not gated by nonzero movement. Movement only
drives signed `U[0,10]` perpendicular and unsigned `U[0,8]` longitudinal birth
offsets. Each patch copies row-23 damage, uses
`mDuration*(1.1-U[0,0.25])` life, and scales by `1-U[0,0.5]`. Its common Fire
tick advances atlas phase by `0.25`, life by `-0.01`, fade alpha by `+0.05`
capped at one, and
contacts a strict circular radius `32*scale` every third global tick. Each
accepted target consumes one unsigned `RandomFloat(0.5)` response draw before
damage is applied. The sole native
`Game+0xC00` initialization writes exact `100.0`, so that contact resolves as
`damage/100*3*0.5 = damage*0.015` per accepted pulse. Firewalker reserves
exactly 50 MP while active; that scalar is neither a percentage nor a cast
cost.

Upgrade fields at `+0x150..+0x16E` can add status, area, or ember work during
contact. Those branches are adjacent gameplay semantics, not rank-1 flight
presentation, and remain outside this no-contact slice.

## Implementation consequence, falsifiers, and acceptance

- Replace Fire's branch in the generic projectile view with a dedicated
  three-pass Fireball body view. Render each authoritative `fire` transient in
  a dedicated particle view; generic element core/spark orbiters are forbidden.
- Extend the native extractor with one registered four-frame particle strip;
  use existing record-110 and 255--266 extractions. Do not redraw native art.
- Emit one stable semantic particle birth per Fireball authority tick, include
  it in protocol/copy/interpolation/removal ownership, and never infer births
  from sparse projectile snapshots.
- Add Fireball Boneyard light candidates with the recovered radius, intensity,
  position, and fixed default-shadows policy.
- Mark Fireball and particle painter roots with `regionLightPoint: null` and
  make their tint setters inert. The Boneyard adapter must retain the
  Fireball's outbound candidate while skipping inbound tint for both families.
- Regression tests must pin frame boundaries `2 -> 3` and `35 -> 36`, pass
  order/blends/transforms, heading conversion, one birth per projectile tick,
  exact first particle update, color/scale/rotation recurrence, deletion
  boundary, protocol validation, discrete interpolation, deterministic cosmetic
  sampling, light bounds, and the two self-lit/null-Region-light contracts.
- Falsifiers include a circular/orbiting generic effect; one body sprite
  instead of the ordered three-pass composite; frames advancing every five
  ticks; no heading rotation; renderer-invented historical births; any damaging
  residual-fire actor used as trail; inbound Boneyard tint on either Fire
  family; or an impact played at the legacy 500-tick containment timeout.
- Run the canonical `./scripts/validate.sh` gate, then cast Fire in a real owned
  `/game` WebGL session on a unique port, inspect the captured image against the
  supporting native image, record hashes/errors, and tear down only owned PIDs.

## Implementation and validation receipt

- The authoritative primary-spell kernel now emits one distinct
  `PrimarySpellFireParticleState` at every Fireball post-move tick. Stable ids
  own immutable origin/direction and deterministic native-family variant/fade;
  protocol version 11 validates those fields and their identity-derived
  lifetime, and snapshot presentation interpolates age while keeping birth
  inputs discrete.
- Fire presentation is split into dedicated `FirePrimarySpellView` and
  `FireParticleSpellView` modules. The body uses the ordered 110/255..266
  three-pass plan and the trail uses registered 267..270 art from
  `primary-spell-fire-particles.png`, SHA-256
  `08a272090c4fd14b41a4f6ff990d4a1bb25ff1cf729f3e08098c8c35066cbd3c`.
  Both painter roots expose `regionLightPoint: null`; their tint methods are
  intentionally inert. The Fireball remains an actor-position outbound light
  candidate.
- Deterministic coverage pins body frame boundaries, order/blends/transforms,
  heading, particle birth and recurrence, Enhanced-Effects lifetimes,
  protocol rejection, interpolation ownership, and both self-lit/null inbound
  paths. `./scripts/validate.sh` passed on this exact worktree: all 363 Website
  tests and five desktop tests passed, production frontend/game-host builds
  completed, and deployment media policy passed. Lint retained only the
  repository's existing Fast Refresh warnings.
- An owned real Chromium/WebGL smoke ran on `127.0.0.1:5391` and returned
  `status: ok`, `errors: []` across all five primaries. The Fire receipt had
  cast pose 8, one `fire` actor plus 21 separately replicated
  `fire-particle` views, and the `throw-fire` release cue. Its inspected
  1600x900 capture is
  `/tmp/sdr-fire-proof-20260814.ha97nP/solomon-primary-fire-hub.png`, SHA-256
  `bf528c4f3a990d40687c6d2cd48e3362742a29ebf7c78bb2d17e658c8ce4c12b`.
  It shows the heading-aligned yellow-white layered body and tapered
  yellow/orange/red registered-particle trail instead of the old round generic
  orb/orbiters.
- A second owned Fire-in-Boneyard WebGL receipt also returned `status: ok` and
  `errors: []`: one Fireball plus 25 live trail children, 26 painter views, and
  three accepted light sources (player, lantern, and the now-separated
  Fireball candidate). The inspected capture is
  `/tmp/sdr-fire-proof-20260814.ha97nP/solomon-primary-fire-boneyard.png`,
  SHA-256
  `859035ecb5bfa3b185960165d9835f094cf860da92cb1e89849593c9dfca36d9`.
  The body/trail stay luminous in the dark field while the outbound Fireball
  light reveals nearby world geometry. The owned host, Vite server, and Chrome
  processes were then stopped; ports 5391 and its ephemeral host port were
  verified unowned.

## Bounded unknowns

- No new clean-stock Fire frame was captured in this pass. The existing D3D9
  image is loader-injected supporting evidence; exact implementation constants
  and ownership come from the preserved retail binary and registered art.
- Exact native global-RNG sequencing is intentionally not claimed. Only ranges,
  recurrence, frame families, and render ownership are native; browser cosmetic
  samples are deterministic presentation policy.
- Impact VFX/light/audio are closed by static RE but deferred until an
  authoritative contact lifecycle exists. No arbitrary visual timeout stands
  in for contact.
