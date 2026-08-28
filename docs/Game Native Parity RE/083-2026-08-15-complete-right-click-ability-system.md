# 2026-08-15 — Complete right-click ability system

## Reported smell and supersession boundary

The Website currently accepts a semantic secondary-cast input but does not own
the native secondary belt or execute any category-2 skill. Its HUD displays a
fixed Acid Rain icon, `PlayerSkillBookComponent.secondarySkillId` never changes
after construction, and the host snapshots only primary-spell actors. This is
one missing native system, not 23 unrelated feature requests.

This entry supersedes only the earlier statements that learned category-2
effects and Turn Undead's pitched level-up reuse remain inert. It does not
weaken the actor-private skill/stat-book, mandatory picker, primary-spell, or
low-mana contracts. The current `origin/main` primary-rank implementation also
supersedes the earlier corrective slice's temporary rank-one production
baseline.

The source of truth is the generated
`Mod Loader/docs/reverse-engineering/native-secondary-ability-catalog.json`
with schema `solomon-dark-native-secondary-ability-catalog-v3`. It pins the
4,723,200-byte retail executable with SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, the
category-2 dispatcher at `0x0054CC50`, each exact authored rank table, and each
member's targeting, actors, timing, art, audio, authority, and teardown. The
Website must consume an equivalent checked-in contract and fail if membership
or provenance drifts.

## Shared BeltButton presentation contract

The complete system also owns the native presenter instead of treating its
icons as decorative React images. Game construction creates eight
`BeltButton` objects at `Game+0x5EC`, stride `0xEC`; byte `+0xE8` selects one
of the eight bindings. Their 53 x 53 logical boxes retain the stock 60 px pitch
and exact center-bottom anchors, including empty slots.

For a populated skill slot, `BeltButton::Present` (`0x005D3E10`) draws the
cooldown overlay before the skill icon. The overlay is the native dark red
RGBA `(0.5,0.1,0.1,0.75)` and its interval is
`[360*(1-remaining/capacity),360]`. Renderer helpers `0x00416330` and
`0x00416450` intersect rays with the 53 x 53 square and split the triangle fan
at every crossed 45-degree corner; a circular SVG sector is not equivalent.
The cooling icon then uses white base alpha `0.25`; the ready path enters with
white base alpha `0.75`. A clear `gameplay+0x1AC2` separately installs the Hub
RGB multiplier `(0.25,0.25,0.25)`. The presenter reads no secondary toggle
state, so active Planewalker, Firewalker, Mindstar, and Regenerate must not
gain a brightness treatment.

Input hints exist only for populated slots. The default binding table is right
mouse `0x201` followed by DirectInput keys `0x02..0x08`, which are number keys
`1..7`. Right mouse uses natural-size UI record `100`, centered at local
`(26.5,60)`, with white alpha `0.6`. Keyboard hints measure the stock binding
name in Fonts group 8 (`Fonts.535..626`, header `[10,3,28]`), size the
three-piece UI record `22` plaque to `text width + 6`, and center it from local
y `53`; black text is centered at x `26.5` on baseline y `64`. The default
single-digit plaque is 13 x 15. Native viewport clipping—not a raised browser
layout—owns the hint tails below the screen.

## Closed membership and implementation ledger

| ID / member | Native gameplay and lifecycle | Native presentation ownership | Website disposition |
| --- | --- | --- | --- |
| `11` Call Leviathan | Aimed Leviathan scales in for 40 ticks, attacks for 1,600 ticks, scales out for 25 ticks, and emits 100-tick EtherBolts. | BadGuys `343..372,11,39`; `LeviathanRoar`, `PlaneCross` loop. | exact-ported |
| `12` Planewalker | Self toggle installs `Mod_Planewalker`, forces Plane Orb `80`, preserves/restores the prior spell, and expires after `mDuration*100`. Each orb stores per-tick damage `2*sum(effective ranks 8,10,9,13,14,15,12)/100`; Call Leviathan `11` is deliberately excluded. | PlaneOrb actor; on/off streams and `PlaneCross` loop. | exact-ported |
| `15` Phasing | Heading cast probes exactly 20 collision-safe destinations at distances `80..270` and relocates only to the first accepted probe. A fully blocked cast still spends mana and enters cooldown. | One additive BadGuys `53` traversal streak at old-position plus 10 units along the successful path, scale `2`, 20-tick fade; `phase` only on success. | exact-ported |
| `21` Ring of Fire | Thirty MovingFire segments at 12-degree steps plus a unique-target Shockwave query every 10 ticks. | DeadHawg `46..77`; `bigfire`, then `nuke`. | exact-ported |
| `23` Firewalker | Toggle-on immediately creates one contact-enabled Fire_Goodguy, then global 10-tick trail births cycle contact geometry `true,false,false`; all births consume the exact seven-word program, and old patches outlive toggle-off. The toggle reserves an absolute 50 MP. | DeadHawg `46..77` only for the patch; target-owned Burn separately uses BadGuys `333..342`; `ignite` is toggle-on-only, toggle-off is silent, and retained patches renew the `lowfire` loop. | exact-ported |
| `27` Magic Storm | Aimed StormCloud lives 1000 active ticks, queries 500 units, rerolls strikes in `30..120`, then fades and stops querying. | Native cloud/lightning children and replicated three-point bolt geometry; `magicstorm`, `lightningstart`, `thunder`, rain/wind loops. | exact-ported |
| `30` Prismatic Shock | The cast helper immediately queries mask-`2` hostiles in a caster-centered radius 350 and applies/merges `Mod_Prismatic` for `mDuration*100`. | One caster-following BadGuys `58` core emits two `111` fades and one moving perspective `10/11` child per tick for 100 ticks; prismatic stream plus pitch-0.8 lightning start. | exact-ported |
| `35` Ring of Ice | Caster-centered FreezeWave grows from radius 75 by 6/tick, queries every 10 ticks, and retains one contact per target through its 93-tick life. | DeadHawg `114,121` three-burst and wave program; `ringofice`. | exact-ported |
| `41` Earthquake | Caster-centered actor runs `mDuration*100`, disrupts every 30 ticks without direct damage, and submits its stock displacement vector to the Region largest-shake reducer until retirement. | DeadHawg `200..202`, BadGuys `2008..2010,62`; quake/crack/rock audio. | exact-ported |
| `45` Raise Golem | Ignores cursor aim, consumes signed 45-degree placement 100 units from current facing, commits that facing, collision-adjusts with radius 25 against mask `0x205` but not actor bodies, then assembles at ages `0/50/100/200`; contact enables at 400 and there is no natural expiry. | Complete Golem `1..208` articulation plus exact BadGuys, DeadHawg, and UI children. Terminal audio is `stonebreak`, `flamelashstart`, `GolemDie__Stream`, then `rockhit`, after the separate assembly/provoke/knockback/step owners. | exact-ported |
| `46` Stoneskin | Self modifier sets actor material flag `0x1`, merges by maximum duration, and clears on expiry/teardown. | Every composed wizard body/equipment layer receives exact RGBA `(0.5,0.5,0.5,1)`; cast `StoneSkin__Stream`, and modifier apply, refresh, and removal callbacks use `stoneskin`, including exactly one natural-expiry request. | exact-ported |
| `48` Teleport | Arena ignores aim, shuffles a 100-unit bounds lattice, selects the first maximum actor-distance score, and runs the radius-40 collision-safe spiral; indoor Regions return `(0,0)`. The world callback has no rejection result. | Separate source/destination BadGuys `90` FadeScale actors and `teleport` requests; source grows from scale `1`, destination shrinks from `8`, both fade from alpha `2` over 20 ticks. | exact-ported |
| `49` Magic Circle | Aimed circle lives 1500 native updates, pulses immediately and every 10 ticks, slows targets, and executes the live MP-recovery branch inside exact half extents `210x168`. | One/two centered spinning BadGuys `48` fades per global-tick parity, a player-attached `7` only on successful recovery pulses, a flickering shadow-casting Region light, and `magiccircle`. | exact-ported |
| `50` Magic Trap | Choose the bound component before damage: selector `0..4` reads effective-rank primary `8,16,24,32,40`; Ether alone consumes inclusive `FloatRange(mDamage1,mDamage2)`, then the trap stores `f32(base*trap mDamage)`. Aimed trap adds a float32 charge increment through the update-800 clamp. Every age divisible by 25, a 130-wide arming query can trigger one separate 300-wide terminal payload query. Air payloads become one mergeable, target-following 100-update ElectricBurn at `payload/100` per update. | Armed body/shadow BadGuys `111,112,15,85`; 32 independently fading selector-tinted `16` shimmers; trigger `15,158..167,17,74`; set/trigger plus bound-primary start audio and 1.25 camera pulse. ElectricBurn adds only a non-shadow Region light with radius `.5+S(.25)` and intensity one plus `electric__loop`, never a lightning sprite at trap chain count zero. | exact-ported |
| `51` Dampen | Caster rectangle dispels shields on `RandomInt(100) < 0x33` (51/100 outcomes despite the 50% UI text) and owns mode-21 CastSpin for 73 strict-boundary ticks. | 360 independently moving/fading BadGuys `10/11` rays plus 30 centered perspective `48` fades; `flash`, `dampen` stream. | exact-ported |
| `54` Magic Shield | Player-owned absorb state owns a 40-tick shell pulse. Break emits 20 particles and, when upgraded, applies one full `absorb*mDamage/100` contact over radius 110 plus a zero-damage Dazzle/push Shockwave, then clears both factors. | BadGuys `49,68,15,158..167,17,74`, DeadHawg `2,18`; exact up/hit/pop/explode sequence, 502-word explosion program, Region flash, and 1.25 camera pulse. | exact-ported |
| `72` Acid Rain | Aimed rain lives 1500 active ticks plus residue; emits 2 drops/tick or 5 enhanced, owns a one-in-four splash gate, and every 25 ticks hits exactly `min(n,floor(n/3)+1)` shuffled targets for float32 `mDamage/6` direct damage each. | BadGuys `0,10` field, raindrop, and splash program; storm/sizzle/rain audio. | exact-ported |
| `73` Fire Wall | Builds one 300-unit aim-perpendicular line from exactly eleven independent Fire_Goodguy patches, spaced 30 units apart; life scalar `7` reaches zero after 700 ticks at `-0.01/tick`, with contact every 3 ticks. | DeadHawg `46..77`; ignite/hit plus `lowfire` loop. | exact-ported |
| `74` Ether Drain | Aimed field scales in for 40 ticks, owns 1,000 active ticks, scales out for 20 ticks, then releases both target arrays and ambient ownership. | DeadHawg `177..179`; distort/lightning plus plane/wind loops. | exact-ported |
| `76` Call Comet | Aimed countdown lasts 400 ticks, creates one trail per fall tick, starts the whistle below 175 ticks remaining, and impacts on tick 400 with damage/freeze, FreezeWave, debris, and world-color restoration. | DeadHawg `5,203..207,6`, BadGuys `51,15`; comet loop/whistle and four impact layers. | exact-ported |
| `77` Turn Undead | Aimed area affects only Skeleton, Archer, Mage, and Zombie and assigns `mFlee*100` behavior. | 35 gray perspective BadGuys `48` fades with exact 20-tick growth; the same `levelup` sample at pitches 2, then 3. | exact-ported |
| `78` Mindstar | Self toggle changes byte `+0x8DD`, reserves/removes mana, and refreshes temporary ranks immediately and on normal progression refresh. | Cyan Region feedback only; exact shared `mindstar__stream`; no actor or caster overlay. | exact-ported |
| `79` Regenerate | Self toggle changes byte `+0x8DE`, reserves/removes mana, heals `1.5/tickRate`, and stops on overload/death/session teardown. | Orange Region feedback only; exact shared `mindstar__stream`; no actor or caster overlay. | exact-ported |

Phasing helper `0x0052A0B0` is a post-payment relocation attempt, not a second
cast-acceptance gate. All twenty failed probes preserve the already accepted
mana debit and row-relative cooldown but emit no semantic presentation edge:
no fizzle, `phase` audio, Region write, or world actor. On success the helper
registers exactly one additive BadGuys record 53 actor at
`oldPosition + heading * 10`, aligned to the traversal, with initial scale `2`
and alpha reduced by `0.05` for each of its twenty native ticks. It does not
create origin and destination bursts or grow the sprite while it fades.

Teleport dispatcher block `0x0054D625..0x0054D728` calls the source burst
before world virtual `+0x12C` and the destination burst after committing the
returned point. Arena vtable `0x00785934` resolves that slot to `0x00465440`.
It enumerates centers `bounds.min + 100` through `bounds.max - 100` at exact
100-unit steps. A cell's unsigned score is the maximum truncated squared
distance to live Region actors with collision flag `0x2`, capped at
`0x100000`. Native order then consumes one `RandomInt(cellCount)` for every
cell to swap it against an arbitrary list member; the first score strictly
greater than the current maximum wins. If none is positive, native draws Y
then X uniformly over the whole bounds. `0x00645910` tests the selected point
with radius 40, all collision flags, and actor exclusion `-1`. On collision,
each ring computes `round-even(pi*(searchRadius+40)/searchRadius)` samples,
stores float32 step `360/count`, consumes a new `RandomFloat(360)` phase, and
tests ellipse offsets `(sin*searchRadius,-cos*searchRadius*.8)` until clear. A
failed ring adds `expansionMultiplier*40`, then consumes `RandomFloat(1)` and
multiplies that factor by `1+draw`. The first ring has six samples; later
rings are not a fixed six-heading circle.
The base indoor Region slot is `0x00508900`, which writes `(0,0)`. Neither
implementation consumes aim or returns failure.

Each `0x00644A00` burst independently consumes `RandomFloat(360)`, requests
the exact `teleport` point sound, writes the shared Region lane, and registers
one additive BadGuys record 90 `Anim_FadeScale` at `y-15`. Both start at alpha
2 and subtract float32 `0.1` per tick. The source starts at scale 1 and
multiplies by `1.1`; the destination starts at scale 8 and multiplies by
`0.96`. Draw clamps alpha to one, so both remain fully bright for the first
half of their exact 20-tick life and fade over the second half.

Prismatic helper `0x00645540` constructs one `Anim_PrismaticSpray`, not a
fixed orbiting triangle. Constructor `0x004543B0` consumes one RNG sign word
for angular velocity `+/-1`, starts alpha zero, radius scalar two, and a
100-tick countdown. The helper requests `prismaticspray__stream` at point gain
and `lightningstart` at pitch `0.8` with the same gain, then consumes
`RandomInt(5)` for the Region red/orange/yellow/green/cyan write. Its gameplay
query passes center `(caster.x,caster.y)`, diameter `700`, mask `2`, and the
caster exclusion into `0x00642280`; that function halves the diameter before
its squared-distance test, proving an immediate radius-350 circle rather than
a deferred rectangle.

Tick `0x00460360` follows the caster at `y-25`, adds float32 `.025` alpha up to
one, advances heading by signed six degrees, grows radius by float32 `.065`
for 50 ticks, then shrinks by float32 `.075` for 50. Each tick consumes one
discarded signed `Float(5)`, then emits exactly two additive BadGuys `111`
fades and one moving additive-perspective BadGuys `10/11` fade. Each child
independently selects the five-color palette, multiplies RGBA by `1.5`, clamps
to one, then floors RGB at `.5`, yielding exact tints
`ff8080`, `ffbf80`, `ffff80`, `80ff80`, and `80ffff`. Record-111 children use
radius `waveRadius*[30,90]`, rotation `[0,360]`, scale `[.25,1]`, life
`[.25,1.25]`, and loss `.025/tick`. The 10/11 child uses radius
`waveRadius*[50,80]`, scale `[1,3]`, outward speed `[.15,1]`, life `[.5,1]`,
loss `.015/tick`, and Y perspective `.8`. This is exactly 19 RNG words per
emission tick. Parent draw `0x00459500` uses BadGuys `58`, alpha
`.5*parentAlpha*(.5+Float(.5))`, signed X scale `radius*1.5`, Y scale
`radius*1.2`, and signed heading rotation. Independently registered children
remain visible after the parent retires.

The spray's shared actor `slowFactor` lane carries that signed constructor
velocity and is exactly `-1` or `+1`; it is not globally a non-negative slow
multiplier. The snapshot contract must preserve any finite signed value and
leave kind-specific range interpretation to the actor owner. A global
non-negative decoder rejects half of valid Prismatic casts before their first
browser frame.

Magic Circle constructor/initializer `0x005E1BA0/0x005E1C20` sets native
counter 1500, scale 4, width 420, slow payload, and RGBA `(1,1,1,.5)`. Every
tick `0x006006E0` writes a shadow-casting Region light at the aimed center with
radius two and intensity `.75+Float(.25,signed=true)`, then emitter
`0x005F3CA0` creates one record-48 `Anim_SpinAwayAdditive` on even global ticks
and two on odd ticks. These are centered overlapping ring textures, not points
on an ellipse. Each starts at scale `(4,3.2)` times `[.975,1]`, life
`min(remaining/100,1)*[.5,1]`, loss `.05/tick`, random rotation, and angular
velocity `+/-[.5,1.5]` degrees/tick; each consumes five RNG words.

The effect counter is tested at zero before increment, so the first native
actor update and every tenth thereafter call `0x005FB020`. Enemies inside
half extents `(210,168)` receive `Mod_CircleSlow`; the local player receives
the stock MP branch while the positive HP branch remains inert. A successful
local-player pulse also creates one player-attached additive BadGuys `7`
`Anim_FadeScale` at local `(0,-15)`, tint `80ffff`, random rotation, scale
`[1,1.65]`, life `[.5,.75]`, loss `.05/tick`, and multiplicative scale growth
`1.1`. Record 7 never belongs at the circle center. The `magiccircle` sound and
Region cyan-white flash occur when the pre-decrement counter is 1498; under
the Website cast/update scheduler that is actor age two because the cast
transaction accounts for the stock first update.

The remaining Earth presentation fields were recovered directly from tick
`0x00613200`, draw `0x00613E10`, and Region reducer `0x00448590`. Each fixed
tick writes `intensity = min(remaining, 200) / 200` and proposes
`(RandomFloat(3, signed=true), sin(remaining * 20 degrees) * 10 * intensity)`.
The Region retains only the candidate with the greatest squared magnitude; it
does not sum concurrent shakes. The floor record draws at alpha
`0.75 * intensity`, rotation `+0x160`, and scale `(1.5,1.2)`: one copy always,
a second at `+170 degrees` above scalar `+0x16C > 0.6`, and a third at
`+305 degrees` above `+0x16C > 3.0`. Positive `+0x168` redraws that same stack
green with an additional `min(value,1)` alpha factor.

Earthquake construction `0x005E8EA0` also consumes `RandomFloat(360)` for the
floor rotation and initializes floor phase `-5`, birth flag one, green-overlay
scalar two, and a persistent scenery list. Initializer `0x005F45A0` queries
group `4` with supplied width 1,024; spatial helper `0x00523140` halves that
width and accepts strict center distance `<512`. Tree `2001`, Gravestone
`2029`, Building `2040`, and Goodie `2061` all match that group. The complete
pointer list is shuffled with one `RandomInt(N)` against the full bound for
every entry, preserving native list order rather than sorting identities.

Tick `0x00613200` advances the floor phase and drains the green overlay by
float32 `0.05`. Crossings at `0.6` and `3.0` reset the overlay to one; only the
`3.0` crossing requests the small-crack stream. The first live update requests
`rockhit` followed by the large crack stream, while every live update renews
the earthquake loop. Duration decrements before the 30-tick pulse test. On
`post-decrement remaining % 30 == 0`, a fresh strict-radius hostile query uses
the same full-bound shuffle and visits exactly `floor(N/2)` entries. Each
local entry cancels its non-pause action, consumes `RandomInt(2)`, optionally
installs a time-scale-adjusted `50 + RandomInt(50)` pause, and always consumes
`RandomSign(15)` to add exactly `-15` or `+15` degrees. There is no direct
damage lane.

At intensity at least `.99`, the pulse owns one independently registered
BadGuys `62` `Anim_Quake`: random rotation, integer-selected scale `(2+i,
.8*(2+i))`, two-degree sine phase, float32 `.005` growth per axis, and a
`Float(.75)+.25` scale jump plus `.95` alpha factor at sine-zero edges. It
retires at 360 degrees after 180 updates. Separately, one shuffled scenery
entry advances per tick; wrapping the cursor deliberately consumes a blank
tick. The entry receives exact `RandomSign(1)` wobble direction, clamped back
toward the native `[-2,2]` band, and `RandomFloat(1.5)` magnitude. Enhanced
Effects gates a 360-update brown BadGuys `10` `Anim_FadeSin_Move` dust child
with `RandomInt(30)==1`.

Every update, enhanced or not, also gates a lit BadGuys `2008..2010`
`Anim_BoulderBit` with `RandomInt(15)==1`. Its constructor preserves the
native hidden bouncer draws, radial placement, two-stage scale clamp, initial
height and velocity, and record selection. Its base tick skips translation,
rotation, and base alpha loss on global ticks divisible by three while height
is nonzero; other updates integrate float32 planar/vertical motion, add
gravity `.4`, bounce at `.3`, optionally damp planar velocity by `.65`, reroll
spin, and settle above vertical velocity `-.75`. The subclass independently
subtracts `.025` alpha every tick. Enhanced debris begins at alpha ten and
adds the dark `.75`-scale underlay; ordinary debris begins at alpha two. Both
receive normal Region lighting and retain their own depth/lifetime after the
parent retires.

Raise Golem's dispatcher branch `0x0054E678..0x0054E7C0` does not read the
world cursor. It consumes `RandomSign(45)`, adds exactly `-45` or `+45` to the
caster's current heading, and makes the unadjusted point 100 units away on
that heading. Native recomputes and commits caster facing from that
pre-adjustment vector. Shared collision helper `0x00645910` then receives
radius 25, scenery mask `0x205`, and actor exclusion zero; because the mask
omits actor flag `0x400`, living bodies do not block summon placement.

When the point is blocked, the shared helper starts `searchRadius=25` and
`expansionMultiplier=1`. Each ring computes
`count=round-even(pi*(searchRadius+25)/searchRadius)`, consumes one
`RandomFloat(360)` phase, and tests the same float32 X-radius/Y-`.8` ellipse as
Teleport. A failed ring adds `expansionMultiplier*25`, then consumes
`RandomFloat(1)` and applies `expansionMultiplier*=1+draw`. Golem construction
occurs only after that RNG stream, consumes `RandomInt(2)` for its alternating
limb selector, and sets initial body heading to committed caster facing plus
180 degrees.

Golem presentation is likewise an articulated actor, not a frame-count-sized
stack of arbitrary atlas records. Draw `0x00617820` quantizes
`heading + actionFacingOffset` into one of sixteen directional records using
native round and `(heading + 9) / 22`; it also computes the opposite-facing
record from heading plus 180 degrees. Four chassis banks (`113`, `129`, `145`,
`161`) exist throughout assembly. At age 100 the actor adds a procedural center
element, left/right limbs from banks `1` and `33`, and five pieces from bank
`65`, with the last two using the opposite-facing record. Limb modes above one
switch the two limb banks to `17` and `49`; mode one instead fixes their
rotations to `+45/-45` degrees. Iron uses exact base tint scalar `0.35` and
adds untinted side overlays from banks `177` and `193`.

The assembly body elevation is exactly `0` below age 100, `-20` through age
199, and `-40` thereafter. Before age 200 a textured green beam uses local
vertices `(-35,-200), (35,-200), (-40,25), (40,25)` and alpha
`sin(((200-age)/200) * pi) * 0.5`, which is zero at ages 0 and 200 and peaks
at age 100. All part sprites use stock scale
`1.1109999418258667` except the authored `0.8` center piece. Native stores each
part's effective Y, sorts the 0x1C-byte list through `0x00428A60`, and only
then calls `Text_Draw`; the Website therefore has to sort articulated layers
by their computed local Y before assigning Pixi child order.

From age 200, a separate connector pass precedes that sorted body list. It
draws directional Golem `97..112` at the two articulated endpoints, two
quarter-point `BadGuys[15]` green joints, and half-scale Golem `65..80`
endpoint caps; endpoint Y decides which side paints first. The front chassis
record's mode-one post-draw then temporarily switches to additive blend and
draws directional Golem `81..96` at the same point with green scalar
`0.5 + RandomFloat(0.3)`. These are required active-body layers in addition to
the twelve sorted records.

The procedural center entry in that same sorted list is a two-sprite draw, not
a generic primitive. Its null-sprite branch binds BadGuys singleton field
`+0xBB4`, mapped by the atlas census to exact `BadGuys[15]`, then draws it at
center Y with scale `2 + RandomFloat(0.25)` and again at center Y plus 5 with
scale `1.5 + RandomFloat(0.25)`. Both copies use RGB
`(0.5 + RandomFloat(0.3),1,0.5)`. The browser reproduces those cosmetic samples
from actor/frame identity so presentation never advances the host RNG stream.

Tick `0x00615CD0` owns the visible action program. The selected attacking limb
is mode one through impact tick 37, then mode two during recovery while the
other limb becomes mode one. The whole articulated heading offsets by
`+/-38` degrees during wind-up, returns to zero through impact, then uses the
opposite `-/+47` degrees during recovery. Provoke counts from 100 through a
negative 50-tick tail; its effect fires at zero and the tail holds both limbs
in mode three. Death `0x00619730` consumes exactly 273 RNG draws and leaves 30
world-owned `DeadHawg 78..87` bouncers plus a short additive `BadGuys 86`
star. Presentation must replay from the pre-consumption RNG snapshot while the
host advances the authoritative stream immediately.

The consolidated Air/Water actor pass must preserve the more detailed state
already recovered from `StormCloud 0x006021A0`, its draw at `0x005E8970`, the
Ring factory `0x00644460`, `FreezeWave 0x005FFDC0`, `AcidRain 0x00604E90`,
and `Comet 0x006220D0`/impact `0x0061E9C0`; the uniform secondary actor record
does not authorize collapsing their child programs:

- `StormCloud` construction `0x005E22E0` first consumes signed `Float(1)` for
  visual phase, then two draws for each of fifteen control points: `Float(360)`
  for angle and `Float(2)` for speed. Point `i` receives speed
  `(1 - i/15 * 0.95) * (2 + draw) * 4`. Magic Tornado initialization
  `0x005E2440` multiplies the phase by `15`, stores its separate strike-frequency
  factor, and only then consumes `Float(360)` for heading. This 31-draw visual
  constructor prefix is part of the authoritative RNG stream, not a client
  hash. Tick `0x006021A0` starts the first strike counter at 50, queries a
  500-unit hostile circle, grows alpha by `0.05` and scale from `0.01` by
  `1.2`, then takes 101 float32 `-0.01` fade updates after active expiry.
  Before movement and strike work it emits two `Anim_Raindrop` children per
  tick or five with Enhanced Effects; Tornado integer-halves those counts to
  one or two. Each child consumes `Float(200)` plus a unit-vector draw.
  `Anim_Raindrop 0x00454170/0x004541A0/0x00458F90` starts at height `-175`,
  advances height by 20 and streak length by four, then grows its ground mark
  from `0.1` by `1.1` until scale exceeds one. Its width-two streak grades from
  RGBA `(0.8,0.95,1,0.5)` to `(0.4,0.95,1,0)`; the ground sprite fades by
  `1-scale^2`. Tornado then consumes `Float(2)` per tick and translates itself
  and all control points by float32 `0.349999994`. A successful strike consumes
  target selection, two distance/unit-vector pairs for its stored source and
  midpoint, then the `mDamage1..mDamage2` draw. The replicated points use source
  height 175/radius 100, midpoint height 90/radius 200, and target height 15.
  Moving Enhanced draw `0x005E8970` samples a QuickSpline from root through
  root plus the unit vector at `globalTick*0.5` degrees times 30 to root minus
  175 Y, emitting two
  `BadGuys[84]` cloud arcs for each of fifteen `0.2` steps; scale begins `0.2`
  and recurs as `scale*1.1+0.1`, with rotations `angle` and `angle*1.35`, Y
  perspective `0.8`, and tint `(0.8,1,1)`. It finishes with `BadGuys[78]` at
  root minus `50*scale`, scale `3.75*cloudScale`, and half cloud alpha. The
  auxiliary painter `0x00602C30` additionally composites a shared weather
  render target in distinct moving/static branches and owns the strike flash;
  it cannot be replaced by one atlas sprite. Region light callback
  `0x005EB5C0` submits radius `2`, intensity `0.5*alpha`, without shadows.
  The auxiliary painter shifts its root up 175 and sources exact
  `BadGuys[78]` (`DAT_00819978+0x3BF0`). Its stationary branch clears a
  transparent target, draws three source-over layers, then composites the
  target at scale five: white alpha `cloudAlpha*2`, rotation
  `age*0.03125*phase`, scale `(scale,scale*0.8)`; cyan-white alpha
  `cloudAlpha*0.75`, rotation `age/48*phase`, scale
  `(scale*0.75,scale*0.8*0.75)`, target-local Y `-10*scale`; and cyan-white
  alpha `cloudAlpha*(0.5+sin(age*0.5 degrees)*0.5)*0.75`, rotation
  `age*0.125*phase`, scale
  `(scale*0.5,scale*0.8*(0.5+sin(age/6 degrees)*0.25))`, target-local Y
  `-6*scale`. After the outer five-times composite those last offsets are
  `-50*scale` and `-30*scale`. The moving branch instead draws another
  additive `BadGuys[78]` at local Y `-175-50*scale`, alpha `cloudAlpha*0.5`,
  rotation `age/48*phase`, and uniform scale `scale*3.75`.
  Cloud `+0x14C` is a branch gate shared by target strikes and ambient weather
  flashes: a successful target writes one, the same tick tail subtracts
  float32 `0.1`, and every tick then consumes `RandomInt(1000)`; result three
  consumes a further `Float(0.35)` for Thunder-stream volume and restores one
  after the decay. While nonzero the painter selects diffuse
  color instead of texture RGB and draws a white alpha-mask of `BadGuys[78]`
  at local Y `-175`, rotation `age*0.0625*phase`, and scale
  `(scale*4,scale*0.8*4)`. The two consecutive native color writes mean its
  actual queued alpha is `cloudAlpha*0.75`; the decaying field gates the
  roughly ten-tick flash branch rather than fading that opacity.
- FreezeWave begins with float32 life `0.924`, subtracts `0.01`, grows from
  radius 75 by six per tick, queries only at ages divisible by ten, fades by
  multiplying alpha by `0.9` below life `0.12375`, and retires on the 93rd
  update. Its vtable light callback is the same `0x005E7AA0` as Shockwave and
  submits radius `waveRadius/140`, intensity equal to current alpha, without
  shadows. The Ring factory registers presentation children independently of
  that gameplay actor: three additive `DeadHawg[114]` bursts start at life
  `4.5`, decay `0.05`, use one `Float(360)` rotation apiece, scale by `1.02`,
  `1.015`, and `1.01`, and use Y perspective `0.8`; one normal
  `DeadHawg[121]` fade starts at life `1.75`, decays `0.01`, and scale `1.5`.
  It then creates 100 `Anim_WhirlSnow` children, or 200 with Enhanced Effects,
  using `BadGuys[72]`, not records 203..207. Constructor/tick/draw
  `0x004588E0/0x00453F70/0x00458A00` consumes, in order, angle `Float(360)`,
  angular velocity `10+Float(10)`, radius `20+Float(40)`, radial velocity
  `1+Float(4)`, height `50+Float(250)`, scale `1-Float(0.5)`, rotation
  `Float(360)`, and life `2+Float(1.5)`. Each tick advances the angle, multiplies
  angular velocity by `0.975^2`, multiplies height by `0.99`, expands radius by
  `radialVelocity*min(angularVelocity,1)`, advances sprite rotation, and removes
  below life zero after `-0.02/tick`. The full factory therefore consumes
  `3+8*N` visual draws (803 normal or 1,603 enhanced), and its independently
  registered children outlive the 93-tick gameplay wave for as many as 175
  ticks. DeadHawg 16/17 are not this program.
- Acid Rain consumes `Float(1)` at construction for its private phase. The
  field starts at scale `0.01`, multiplies by `1.2`, waits 50 ticks before its
  first pulse, then resets to 25. Each active tick creates the configured two
  or enhanced five raindrops at height `-175`; they advance height by 20,
  increase streak velocity by four, then grow their ground sprite from `0.1`
  by float32 `1.100000023841858` until retirement. Falling
  `Anim_AcidRaindrop` uses an exact width-three procedural streak from RGBA
  `(0.7,0.95,0.75,1)` to `(0.4,0.95,1,0)`, plus the quarter-alpha
  `BadGuys[0]` head tinted `0xb3f2bf`; its ground sprite is tinted `0xccffcc`
  with alpha `1-scale^2`. After those drops, a
  one-in-four gate may create a BadGuys-10 splash with its recovered rotation,
  scale, velocity, `0.25` life, `0.0125` decay, and `0.95` damping.
  Parent painter `0x005EB290` owns two BadGuys-10 passes. For field scale `s`,
  ground scalar `g`, age `a`, and constructor phase `p`, the first is additive
  and uses tint
  `(0.41,0.55,0.32)`, alpha `0.75*g`, rotation `a*0.03125*p` degrees, and
  scale `(5*s,4*s)`. The second restores source-over blending and uses tint
  `(0.25,0.45,0.15)`, alpha `g`,
  rotation `-0.5*a` degrees, local Y `-50*s`, and scale `(7.5*s*p,6*s)`.
  Auxiliary `0x005EB1D0` paints positive rain alpha source-over at the root with tint
  `(0.05,0.1,0.05)` and uniform scale `4.5`. It is not a red quarter-scale
  residue sprite. Dispatcher `0x0054F331` stores ranked `mDamage` at actor
  `+0x154`; pulse
  `0x00604E90` divides it by compiled double `6.0` at `0x007852E0` and stores
  float32 direct contact with flags `0x18`. It does not use the generic `/100`
  fire/contact normalizer and does not create poison. Residue fades ground
  alpha for 100 ticks and then rain alpha for 2,000 ticks,
  giving the maximum 3,600-tick ownership window. It uses light callback
  `0x005EB5C0`: radius `2`, intensity `0.5*alpha`, no shadows.
- Comet construction consumes `Float(1)` for heading and stores ranked damage
  at `+0x140`, Permafrost-scaled freeze seconds at `+0x13C`. Every one of its
  400 fall updates consumes `Float(0.5), Float(360), Integer(2), Float(0.5)` and
  registers one BadGuys-51 trail. Trail scale is `2.5`, life is
  `0.5*(0.5+draw)` with `0.025` decay, and its rotation multiplies by `0.99` or
  `1.015`. The whistle edge occurs when the post-update counter first falls
  below 175, i.e. with 174 ticks left. The terminal update owns area damage,
  the shared FreezeWave, exact impact children/audio, a Region-owned white
  screen flash,
  and retirement. Fall painter `0x005F0DB0` submits a radius-2 light at constant
  intensity `0.5`. Impact `0x0061E9C0` creates additive perspective
  `BadGuys[15]` at scale `10`, gray `0.75`, life `5`, decay `0.01`; normal
  `DeadHawg[6]` at scale `2`, life `10`, decay `0.01`; then a full radial set of
  independent `Anim_Bouncer` records selected by `RandomInt(5)` from
  `DeadHawg[203..207]`. After one initial `Float(360)` angle, every bouncer
  consumes four constructor draws (vertical velocity `-(2+Float(3))`, initial
  height `-Float(20)`, rotation `Float(360)`, rotation speed `1+Float(10)`),
  then record selection, signed `Float(0.25)+0.8` scale, `Float(10)+80` radial
  offset, `Float(2.5)+0.5` horizontal-speed factor, signed `Float(1)+1` life
  factor, and signed `Float(3)+8` angular increment. X velocity alone has the
  native `1.5` anisotropy. Bouncer tick `0x00456720` skips translation every
  global tick divisible by three; otherwise it integrates height and horizontal
  velocity with gravity `0.4`, bounces at damping `0.65`, consumes a new
  `Float(10)` rotation speed and `Integer(2)` horizontal-damping gate at every
  bounce, and settles above velocity `-0.75`. While height is nonzero, global
  ticks divisible by three return before integration, rotation, or life decay;
  all other updates rotate and subtract `0.015` life. Once settled, life decays
  every tick. These actors and the two impact fades survive the
  parent (up to 1,000 ticks for `DeadHawg[6]`) and therefore require independent
  world ownership; a cycling parent sprite or hashed debris is not parity.
  Impact calls Region helper `0x00448600` with exact RGBA `(1,1,1,1)` and
  decay `0.005`. Region tick `0x0063EFC0` subtracts that decay from alpha and
  main render `0x0046EC80` paints the result as a screen-fixed rectangle, so
  this is a nominal 200-tick full-screen white fade rather than a tint attached
  to the Comet or an ambiguous "world-color restoration." Repeated float32
  subtraction leaves alpha `8.121132850646973e-7` at age 200 and clamps it to
  zero on update 201. Region field `+0x8E04`
  and vector `+0x8E0C/+0x8E10` are separate impact/camera-shake owners.

### Region screen-feedback ownership correction

The Comet receipt above was only one member of a shared Region system. A new
write census of `Region +0x8E14..+0x8E24`, followed by instruction-level
channel checks at every category-2 caller, closes the complete right-click
membership. Native owns exactly one screen-fixed RGBA plus alpha-loss lane.
`0x00448600` and its inlined equivalents replace that lane; Region tick
`0x0063EFC0` subtracts the stored loss once per 100 Hz update with float32
storage and clamps at zero; Region render `0x0046EC80` draws the viewport quad
after world/effect painting and below the HUD. Flashes are therefore ordered
overwrites, not actor-local fades, independent maximums, or additive sums.

Point-owned writes call Region vtable slot `+0x100` at the triggering world
position. With event point `P`, camera center `C`, and visible world width
`W`, initial alpha is one through `distance(P,C) <= 0.25W`, falls linearly to
zero at `1.1W`, and is multiplied by `0.1` when the local alternate/death byte
is set. Fixed writes bypass that attenuation. The host must replicate the
ordered semantic write and its RGB/loss, while each observing client computes
its own trigger-time point gain from its camera. The flash lane then advances
locally from the authoritative event tick; it is presentation state, not an
actor inferred from whatever happens to remain in the snapshot.

Because this storage belongs to the shared `Region` base, the browser must
consume the same ordered event lane in the Courtyard and each private Hub room
as well as in the Boneyard. Each Hub region keeps its own locally decaying
lane keyed by `hub:<region>`; a room switch must neither replay another
region's write nor discard a still-live write owned by the entered region. The
screen-fixed quad is submitted after that region's world/effect painters and
before the transition cover and DOM HUD.

| Ability | Exact Region write(s) |
| --- | --- |
| Call Leviathan `11` | first scale-in update `(1,.5,1,pointGain)`, loss `.05` |
| Planewalker `12` | enable-only fixed `(1,0,1,1)`, loss `.1`; disable has none |
| Phasing `15` | accepted traversal `(0,1,1,pointGain)`, loss `.025` |
| Ring of Fire `21` | creation `(1,.5,0,pointGain)`, loss `.01` |
| Firewalker `23` | every toggle `(1,.5,0,pointGain)`, loss `.1` |
| Magic Storm `27` | no Region write; its cloud-owned weather compositor remains separate |
| Prismatic Shock `30` | after the spray constructor's angular sign, `RandomInt(5)` selects red/orange/yellow/green/cyan, then `pointGain`, loss `.05` |
| Ring of Ice `35` | creation `(.9,1,1,pointGain)`, loss `.01` |
| Earthquake `41` | fixed `(.8,1,.8,1)`, loss `.025` |
| Raise Golem `45` | no Region write |
| Stoneskin `46` | fixed white, loss `.1` |
| Teleport `48` | source fixed white then destination point-gain white, both loss `.025`; destination wins immediately |
| Magic Circle `49` | age two / native counter `1498`: `(.75,1,1,pointGain)`, loss `.1` |
| Magic Trap `50` | initialization selector RGB/fixed alpha/loss `.1`; trigger same RGB/point gain/loss `.05` |
| Dampen `51` | no Region write |
| Magic Shield `54` | apply `(.5,1,1,pointGain)`/`.1`; Explosive Shield break same color/`.05` |
| Acid Rain `72` | no Region write |
| Fire Wall `73` | creation `(1,.5,0,pointGain)`, loss `.1` |
| Ether Drain `74` | first scale-in update `(1,.5,1,pointGain)`, loss `.05` |
| Call Comet `76` | impact fixed white, loss `.005` |
| Turn Undead `77` | no Region write |
| Mindstar `78` | every toggle `(0,.5,1,pointGain)`, loss `.1` |
| Regenerate `79` | every toggle `(1,.5,0,pointGain)`, loss `.1` |

Magic Trap must bind the selected primary payload, not the wizard's character
element. Native ordinary selectors are Magic `0`, Fire `1`, Lightning `2`,
Ice `3`, and Earth `4`; welded primaries consume `RandomInt(2)` and choose one
of their two component selectors. Instruction range
`0x0054EB5C..0x0054ED04` proves that byte `7` is only the synthetic-build
sentinel: build IDs `1000..1009` dispatch the ten weld rows, while pure build
IDs `1010..1014` resolve fixed selectors `0,1,3,2,4`. Planewalker's Plane Orb
override does not replace that selected primary-build source. Static initializer
`0x00782C70..0x00782DBA` gives selector RGBA rows
`(1,.1,1,1)`, `(1,.35,.1,1)`, `(.1,1,1,1)`, `(.1,.5,1,1)`,
`(.1,1,.1,1)`, `(1,.5,.1,1)`, `(.1,.5,.5,1)`,
`(.75,.75,.75,1)`, and white. Selectors `1/2/3` respectively add Burn,
ElectricBurn, and ColdSlow; all other selectors dispatch direct contact only.
The same selector owns trap art tint, both Region writes, damage kind, and
modifier branch.

Damage lookup follows that selector, not the equipped primary summary.
Dispatcher `0x0054CC50` maps selector `0/1/2/3/4` to effective-rank primary
skill `8/16/24/32/40`. Selector zero loads Magic Missile `mDamage1` and
`mDamage2`, passes them in that order to inclusive float wrapper `0x00448480`,
and consumes one gameplay RNG word; selectors one through four read the
selected component's single `mDamage` with no damage draw. It then stores
`f32(baseDamage * MagicTrap.mDamage)` at trap `+0x140`. Welded traps therefore
consume their `RandomInt(2)` component choice first and use that component's
rank/value; Ether traps are not pinned to Magic Missile's maximum.

Terminal helper `0x005F5C80` writes
`f32(fullChargePayload*charge)` without a synthetic damage floor. Its water
branch installs ColdSlow at factor `f32(0.5/permafrostSlowScale)` for
`max(50,trunc(400*charge))` ticks. The conversion call at `0x005F6271`
truncates toward zero; `Math.round` is not equivalent once charge exceeds the
50-tick minimum.

The air branch's modifier contract comes from Magic Trap terminal helper
`0x005F5C80`, `Mod_ElectricBurn` constructor `0x006231D0`, merge callback
`0x00625A70`, and tick `0x00628F10`. The terminal edge zeroes direct trap
contact and attaches type `0x1B6B` with duration `100`, damage
`trapPayload/100`, chain count zero, scalar one, and the trap group byte.
Reattachment keeps the greater remaining duration while replacing the
payload/group fields; it does not stack parallel damage actors.

Every live modifier update follows its target, consumes signed `Float(.25)`,
and appends a non-shadow-casting misc light with radius `.5+jitter` and
intensity one, while renewing `electric__loop`. The authoritative contact path
then consumes `Integer(3)` and, only on result one, another `Float(.5)` for its
`.25+jitter` native contact scalar before applying the stored damage. Because
Magic Trap fixes the modifier's chain count to zero, the later
`Anim_FadeLightning` creation branch is unreachable. A target lightning sprite
is therefore an approximation to remove, not missing native art.

Magic Trap's remaining lifecycle is fixed by constructor/init
`0x005E2CC0/0x005E95D0`, tick `0x00603710`, draw `0x00619CD0`, auxiliary
shadow `0x005E9700`, and terminal helper `0x005F5C80`. Charge adds the
float32 result of `1/(8*100)` once per update and clamps to one on update 800.
The 25-age cadence first queries a 130-wide group-2 footprint; only after that
query finds a target does the helper query the separate 300-wide payload
footprint and dispatch `fullPayload*charge` to every returned target.

The shared actor `frame` lane is a continuous non-negative accumulator, not a
wire-level integer selector. Magic Trap adds float32 `.25` and wraps at eight;
Magic Storm separately stores its decaying ambient-flash scalar in the same
lane. Snapshot decoding must therefore preserve finite fractional values.
Only the individual draw owner may quantize a lane when it actually selects an
authored record. Rejecting fractional `frame` values disconnects a browser on
Magic Trap's first post-cast update and can do the same after a Storm flash.

The shipped armed draw does not submit the otherwise loaded records
`393..400`. It bobs by `5*sin(age degrees)-12`, computes base scale
`0.5+0.5*charge` and multiplies it by `.75` while charge is strictly below
float32 `.9900000095`, then draws additive BadGuys `111` and `112` at rotations
`+2*age` and `-3*age` with perspective Y `.8` and sine-pulsed alpha. A fixed
scale-two selector-colored additive record `15` follows at the unbobbed
position. Opaque normal record `85` owns the bobbed body with scales
`1-.1*sin(2*age)` and `1+.1*cos(age)`, while auxiliary slot `0x005E9700`
owns a black half-alpha record-15 shadow at scale `.75`.

Shimmer scalar `3` is multiplied by float32 `.8999999761581421` before each
emission and cleared below `.10000000149011612`; updates 1 through 32 each
consume `Float(360)` and `Float(.25)` and register one normal record-16
`Anim_Fade_Perspective`. It uses selector tint, scale `3*shimmer`, perspective
Y `.8`, alpha `.75+jitter`, and loss `.05`, and outlives an early terminal
trap removal independently. Initialization orders `settrap__Stream` before
the selector's bound-primary cue (`magicmissile`, `throwfire`,
`lightningstart`, `icestart`, or `startboulder`).

Terminal presentation is one normal record-15 fade at `(0,-25)`, scale six,
then two additive record-`158..167` arrays and 100 additive FuzzySpears at
`(0,-35)`. It is the Explosive Shield array/spear program without that
helper's DeadHawg ring: array frame rates are float32 `.15` and `.225`; every
spear consumes heading, speed, five-way double-speed gate, alpha, and scale
draws and emits records `17` and `74`. Construction consumes exactly 502 RNG
words. The terminal edge also owns `trap__stream`, selector-colored point-gain
Region feedback with loss `.05`, and camera magnitude `1.25` decaying by
float32 `*.94` until below `.001`.

Dampen helper `0x00648DF0` first consumes the dispatcher's sentinel-driven
`RandomInt(100000)` action word, resolves hostile magic and all shield rolls,
then creates 390 independent animation objects. Headings `0..359` each own one
source-over BadGuys `10/11` `Anim_MoveFade`: radial speed `6+Float(4)`, drag
`.96` or `.93` when `Integer(6)==3`, independent rotation `Float(360)`, scale
`1.5+Float(.5)`, alpha loss `.01+Float(.02)`, and grayscale
`Float(.25)`. Their final `Integer(5)` only selects a registration lane. The
remaining 30 centered, additive-perspective record-48 fades use rotation
`Float(360)`, scale `.75+Float(4.75)`, alpha `.5+Float(1)`, loss `.1`, and
vertical perspective `.8`. The visual suffix consumes exactly 2,970 native
RNG words and its children live independently for up to 100 ticks; the
73-update CastSpin is a separate player action, not an expanding-ring clock.

Magic Shield has no standalone cast actor. The player-owned absorb state is
the presentation owner: additive BadGuys `49` stays attached at `y-30`, scale
`1.5`, and an absorbed hit drives the recovered 40-tick brightness/sine-scale
pulse. Break callback `0x00546650` consumes three words for each of 20
additive BadGuys `68` children: `Float(360)` rotation, `.5+Float(.75)` alpha,
and `2+Float(.25)` scale. They spawn at `y-35`, lose `.05` alpha per tick,
and account for an exact 60-word prefix.

When Explosive Shield is installed, helper `0x00648790` then registers one
normal scale-12 BadGuys `15` fade at `y-25`, one additive DeadHawg `2`
FadeScale at `y-35` (scale `2.5`, factor `1.01`, alpha `1.5`, loss `.05`),
and two additive ten-frame BadGuys `158..167` arrays at `y-35`, scale `6`,
with frame rates `.15` and `.225`. Their two rotations consume two RNG words.
The helper next creates 100 additive `Anim_FuzzySpear` children. Each consumes
heading `Float(360)`, speed `3+Float(2)`, an `Integer(5)==2` double-speed gate,
alpha `1+Float(1)`, and scale `2+Float(1.5)`. It starts 75 units along the
native heading, moves before damping velocity by `.95`, and loses `.035`
alpha per tick. Draw `0x00458B70` emits authored-scale BadGuys `17` with a
presentation-time random horizontal sign, then scaled BadGuys `74`, using the
same position, rotation, white color, clamped alpha, and additive blend. The
construction suffix is therefore exactly `2+100*5 = 502` RNG words.

The helper queries hostiles once at fixed radius `2*55 = 110`. It writes half
of `installed_absorb*mDamage/100` to each native contact lane; target contact
sums those two halves, so Website damage is the full configured payload. A
separate Shockwave starts at radius `75`, grows by `6/tick`, has life `.35`,
fade threshold `.0375`, push/alpha one, and damage zero. It retains the native
ten-tick Dazzle and tracked push behavior and submits only the expanding Region
light—there is no main-pass wave sprite. The same helper writes cyan Region
feedback with loss `.05` and the Region camera/world magnitude directly to
`1.25`; that pulse decays by `*.94` per tick. The player shell, break children,
explosion composite, Shockwave, screen lane, camera lane, and four audio edges
are distinct owners and must not be collapsed into one expanding sprite.

Turn Undead helper `0x00647EF0` creates 35 source-over perspective record-48
children tinted `(0.5,0.5,0.5,1)`. They start at alpha one, scale
`1+Float(1)`, recur by `*1.1`, and lose `.05` alpha per tick. The first angle
is `Float(360)` and native consumes `Float(40)+20` after every child, including
one discarded final increment, so this VFX consumes 71 RNG words rather than
70.

Website protocol events therefore carry an optional explicit Region-flash
payload: normalized RGBA, per-tick loss, and whether alpha is client-local
point gain. A renderer-owned presentation object consumes each event ID once,
applies same-tick writes in event order, advances the one shared float32 lane,
and paints one normal-alpha viewport rectangle. Prismatic color selection and
welded Magic Trap selector selection consume the host RNG before their event
is emitted. Actor retention, interpolation, and distance from Comet actors are
not flash ownership.

Stoneskin's visual is likewise compositor-owned rather than a generic status
particle. Apply callback `0x00624490` sets `actor+0x138 |= 1`; player renderer
`0x0054BA80` carries it through global byte `0x00819E5D`, and the wizard
body/equipment paths (directly witnessed at `0x00538F30`) enable their material
pass, apply exact RGBA `(0.5,0.5,0.5,1)`, draw every selected robe/body/head and
equipped-item layer, then restore white and the prior renderer state. The web
painter must combine that half-intensity RGB treatment with scene lighting
rather than replacing either one.

Its audio follows modifier ownership as well. Accepted cast owns
`StoneSkin__Stream`; apply, refresh, and removal callbacks own `stoneskin`.
Consequently a natural duration transition from one tick remaining to zero
emits exactly one terminal callback event. Firewalker's similarly easy-to-fold
toggle edge is different: only toggle-on requests `ignite`; toggle-off retains
its Region color write but is audio-silent while existing patches keep the
`lowfire` loop alive.

No category-2 row is deferred, represented by substitute art, or collapsed into
a generic particle template. Rank arrays come from the native skill catalog;
the active rank is captured at the native creation/application boundary for
each actor or modifier rather than reread opportunistically by the renderer.

## Ownership, input, authority, and cleanup contract

- Each player owns an eight-slot belt. Right mouse is native slot zero;
  keyboard digits `1..7` address slots one through seven. Learned category-2
  skills populate and mutate that player-owned loadout only. Slot selection,
  skill identity, rank, cooldown current/cap, and toggle/reserve state are
  authoritative and replicated; DOM button numbers are never protocol data.
- A secondary cast is an edge/held intent resolved on the host from the
  current belt slot and world aim. Cast eligibility, MP debit/reserve,
  collision-safe placement, target query order, damage/status mutation,
  cooldown, and actor IDs all belong to the fixed-tick simulation. Clients
  render and interpolate the resulting semantic actors; they do not synthesize
  gameplay from local VFX clocks.
- One cohesive secondary-ability store owns stable actor IDs and separate
  modifier/toggle state. Family kernels may split by persistent fields,
  projectiles/summons, instant relocations, and player modifiers, but they
  share one dispatcher and one cleanup boundary. The primary-spell store and
  large enemy store are not extended into a second monolith.
- Death, disconnect, Game Over, Hub/Boneyard replacement, and run reset remove
  owner-bound modifiers, reserves, loops, summons, and persistent fields
  exactly once. Registered terminal particles/debris may finish independently
  only where the native contract says so. Toggle recasts follow each native
  on/off path and must not replay break/impact effects during generic teardown.
- Painter roots use the recovered atlas registrations, native blend modes,
  authored tint/alpha, actor-local versus world-local coordinates, effective-Y
  ordering, lights, camera shake, and fixed-tick animation clocks. CSS shapes,
  gradients, emoji, and generic radial substitutes are prohibited.
- Audio uses the original extracted WAV bytes and native lifecycle trigger.
  Point sounds are owner/world positioned, streams are edge-triggered, and
  ambient loops are renewed by live actors then stop when the final owner
  retires. Shared samples such as `levelup`, `stoneskin`, and
  `mindstar__stream` remain shared rather than being renamed into inventions.

## Acceptance contract

Tests must enumerate the exact 23 IDs and cover every member's authored rank
fields, targeting shape, spawn/application edge, cadence, damage or modifier
effect, VFX record program, audio sequence, replication, and terminal cleanup.
Cross-member tests must cover all eight belt slots, simultaneous participants,
late join, disconnect/death/world replacement, deterministic RNG, ambient-loop
reference counts, and right-click suppression under modal/input barriers.

The decisive browser journey must run the real `/game` WebGL scene and cast
all 23 abilities through normal input against real authoritative targets. It
must inspect every distinct animation phase, persistent field/toggle state,
impact or modifier result, live HUD icon/cooldown, point/stream/loop audio
event, peer snapshot, and retirement edge, with no page, console, asset, or
protocol errors. Final completion additionally requires the canonical Website
gate and the decisive journey on the Mac mini; Windows and WSL runs are
diagnostic only.

## Website implementation closure and pre-final validation

The Website now owns this full closed membership. Protocol 30 carries the
authoritative eight-slot belt, casts, actors, modifiers, toggles, cooldowns,
audio requests, and native light-provider lane, registration, and attachment
ordering. The host owns gameplay and lifecycle; Hub and Boneyard share the
semantic presenter, original extracted art/audio, fixed-tick phase clocks, and
terminal cleanup. No category-2 member remains represented by the former Acid
Rain placeholder or a generic particle substitute.

The pre-final local canonical gate passed with 24 backend contracts, all 122
focused Boneyard/native-secondary contracts, all 939 broad frontend/game
contracts, the level-up, diagnostics, Hub UI, and desktop auxiliary suites,
and the production TypeScript, Vite, game-host, and media-policy builds. The
focused coverage enumerates all 23 IDs and their rank rows, authority,
targeting, actor/modifier phases, atlas programs, audio ownership, light
enrollment/order, replication, interpolation, and teardown. Final Mac-mini
browser acceptance remains the last publication gate and is intentionally not
claimed by this pre-final receipt.

## 2026-08-28 — Raise Golem assembly-audio reopening

### Reported smell and parity question

- Reported web behavior: the rise is dominated by several click-like crack
  streams and does not sound like stock.
- Stock behavior to recover: every assembly milestone's complete concurrent
  audio membership, including pitch, point/stream class, position, ordinary
  and Iron variants, activation, death, replacement, and teardown.
- Falsifier: if the four crack streams are the whole rise sequence, the
  existing web event list is correct. Fresh instruction evidence refutes it.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail instructions | `Golem::Tick 0x00615CD0`; raw `0x00615EAC..0x00616075` | Ages `0/50/100/200` all play registry `+0x1404` QuakeCrackSmall. Age zero additionally plays `+0x5C4` flamelashstart at pitch `.8`; the later three additionally play `+0xD54` rockhit at pitch one. | high |
| Audio registry | QuakeCrackSmall SHA-256 `bc66694a...ef09f`, flamelashstart `d563633c...db0a1dc`, rockhit `865484cf...de25b`; GolemProvoke `88394eab...15228` | All assets already exist in the Website manifest; no substitute or new media is required. | high |
| Current web | `native-secondary-golem.ts`, `native-secondary-abilities.ts` at `0c510ce3` | Kernel collapses all four milestones to boolean `assemblyImpact`; caller emits only QuakeCrackSmall. flamelashstart/rockhit are wired only to the separate death sequence. | high |

### System boundary and membership inventory

Native system: Golem assembly sound edges from creation through active
activation, including both presentation variants and all neighboring sound
owners.

| Member | Native source | Disposition required | Proof |
| --- | --- | --- | --- |
| age 0 ordinary/Iron | `0x00615ECB..0x0061605A` | `exact-ported` | crack stream plus flamelashstart point sound at pitch .8 |
| ages 50, 100, 200 ordinary/Iron | `0x00615ECB..0x00616075` | `exact-ported` | crack stream plus rockhit point sound at pitch one for each age |
| assembly placement/visual/debris | same tick and existing Golem painter | `verified-already-at-parity` | no timing or RNG change |
| first active provoke | `0x006164BF..0x00616507` | `verified-already-at-parity` | GolemProvoke remains its separate edge |
| footsteps/contact | existing tick branches | `verified-already-at-parity` | stone-step and knockback-golem unchanged |
| death sequence | `0x00619730` | `verified-already-at-parity` | stonebreak, flamelashstart, GolemDie, rockhit remain terminal-only events in addition to assembly use |
| replacement, owner death/disconnect, world reset | summon lifecycle | `verified-already-at-parity` | no assembly cue replay during generic retirement |
| host/guest, late join, interpolation | semantic event wire | `exact-ported` | each new event carries world point and pitch once; late join never replays old IDs |

No member is browser-blocked.

### Native ownership thread, implementation consequence, and validation

- Golem age advances by two during assembly. The pre-increment age owns the
  four sound milestones and must remain distinguishable instead of a boolean.
- Publish `0|50|100|200|null` from the Golem kernel. Emit the crack stream plus
  the milestone-specific point sound at the actor position. Preserve all
  existing visual, health, AI, cooldown, mana, and RNG state.
- Focused tests must assert kernel milestone identity, exact two-cue sequence
  and pitch at all four ages, ordinary/Iron equality, no replay at age 201,
  and unchanged four-cue death sequence.
- Mac browser must capture the real Raise Golem event IDs/play calls through
  all four ages and provoke with empty page/console/response/host errors.

### Implementation validation receipt

- `native-secondary-golem.ts` now publishes the exact pre-increment assembly
  milestone `0|50|100|200|null`; the common authoritative dispatcher emits
  QuakeCrackSmall plus flamelashstart at pitch `.8` for zero, then
  QuakeCrackSmall plus rockhit at pitch one for the later three. Provoke,
  footsteps, damage, cooldown/mana, ordinary/Iron presentation, and the
  terminal four-cue death sequence are unchanged.
- The focused regressions first failed against the boolean-only kernel, then
  passed with exact milestone identity and the eight-event sequence. The real
  production Boneyard journey observed semantic ticks
  `2417,2417,2442,2442,2467,2467,2517,2517`, therefore offsets
  `0,0,25,25,50,50,100,100`, and the matching eight Chrome audio starts:
  four QuakeCrackSmall at pitch one, one flamelashstart at `.8`, and three
  rockhit at one. Chrome's float32 playback parameter exposed `.8` as
  `.800000011920929`; the assertion normalizes only that browser precision.
- The same journey retained the stock assembly primitive counts
  `5/14/19/20`, one-Golem cap, real combat damage, ready/cooldown HUD, and
  captures through age 400. Page, console, and response error arrays were
  empty. Log SHA-256 is
  `7f51eb728938bd9e65c3f1ee74760079129048bf358035050a4f9fc774f539dc`;
  age-2/200/400 capture hashes are
  `e084bd52f59cd93f67a142c390f0f88827271d291ffab89c8bff4316a67b8f09`,
  `32d6e2700cbecbc5f6793a8a34530c9defce847c39fccffa749977b6f93029c9`,
  and
  `73855811bdce873fa3e1a29557e7ecad6324cb85c12c66b50daa20b06abe343b`.
- The publication pass reruns the complete canonical gate after this receipt
  and the browser-harness regressions are recorded.
