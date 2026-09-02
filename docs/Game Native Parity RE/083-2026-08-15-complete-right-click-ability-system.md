# 2026-08-15 — Complete right-click ability system

> **2026-08-30 correction:** the original closure recovered the three hoard
> writers but did not connect them to the shared `Skills::Tick` MP ceiling.
> It consequently treated hoarded MP as a second subtraction at cast/UI
> consumers while leaving authoritative current MP above the native ceiling.
> The affected Firewalker, Mindstar, Regenerate, recovery, affordability, and
> HUD dispositions are superseded by the final section of this file.

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
| `15` Phasing | Heading cast probes exactly 20 collision-safe destinations at distances `80..270` and relocates only to the first accepted probe. A fully blocked cast still spends mana and enters cooldown. | One additive BadGuys `53` traversal streak at old-position plus 10 units along the successful path, scale `2`, alpha `2` with loss `.1` and draw clamp `1`, 20-tick life; `phase` only on success; no Region flash. | exact-ported |
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
| `77` Turn Undead | Aimed area affects only Skeleton, Archer, Mage, and Zombie and assigns `mFlee*100` behavior. | 35 gray perspective BadGuys `48` fades born at scale `1+Float(.5)` with exact 20-tick growth; the same `levelup` sample at pitches 2, then 3. | exact-ported; birth-scale domain corrected by the 2026-09-02 reopening below |
| `78` Mindstar | Self toggle changes byte `+0x8DD`, reserves/removes mana, and refreshes temporary ranks immediately and on normal progression refresh. | Cyan Region feedback only; exact shared `mindstar__stream`; no actor or caster overlay. | exact-ported |
| `79` Regenerate | Self toggle changes byte `+0x8DE`, reserves/removes mana, heals `1.5/tickRate`, and stops on overload/death/session teardown. | Orange Region feedback only; exact shared `mindstar__stream`; no actor or caster overlay. | exact-ported |

Phasing helper `0x0052A0B0` is a post-payment relocation attempt, not a second
cast-acceptance gate. All twenty failed probes preserve the already accepted
mana debit and row-relative cooldown but emit no semantic presentation edge:
no fizzle, `phase` audio, or world actor. On success the helper
registers exactly one additive BadGuys record 53 actor at
`oldPosition + heading * 10`, aligned to the traversal, with initial scale `2`
and alpha `2`. Shared `Anim_FadeAdditive` update `0x00454000` subtracts the
constructor-default `.1` each tick; draw `0x004560A0` clamps alpha to one, so
the streak is fully bright for the first ten updates and fades for the final
ten before retirement. It does not create origin and destination bursts or
grow the sprite while it fades. Neither success nor failure writes Region
screen feedback: the Region vtable `+0x100` call in helper `0x0063FEE0`
computes point-audio gain consumed by `0x00407B70` for `phase`.

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
| Phasing `15` | no Region write; helper `0x0063FEE0` uses Region vtable `+0x100` only to compute point gain for the `phase` audio request |
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
`1+Float(.5)`, recur by `*1.1`, and lose `.05` alpha per tick. The first angle
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

## 2026-08-29 — Phasing facing-direction reopening

### Reported smell and parity question

- Reported web behavior: Phasing sometimes moves the player in a direction
  different from the direction the wizard is visibly facing.
- Stock behavior to recover: Phasing must consume the caster's current heading,
  probe only along that straight forward ray, and let static collision decide
  whether any of the twenty destinations is accepted.
- Reproduction: give the player a north-facing heading while retaining an east
  world-aim point, then cast Phasing through the ordinary category-2 edge.
- Falsifier: if stock Phasing consumes the aimed world point rather than actor
  heading, the current Website direction owner is correct. The authored skill
  description and recovered dispatcher/helper thread both refute that model.

This secondary report reopens the earlier `exact-ported` claim. The 2026-08-15
pass proved one successful aim-aligned cast and the effect lifecycle, but did
not include a heading-versus-aim differential or enumerate mouse, keyboard,
touch, and gamepad aim retention as independent input branches. That skipped
cross-input membership allowed an aimed-secondary convenience lane to replace
Phasing's actor-heading owner.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Player report | 2026-08-29 report | The displacement direction can disagree with visible wizard heading; the expected path is straight forward unless collision rejects it. | high for the web symptom |
| Authored retail data | retail `data/wizardskills/phasing.cfg`, SHA-256 `d2615aff242059299004ccd30bdb5cb90b029208742982319faf38748fb9bb39` | The stock description is "A quick and limited planar teleport in the direction you are facing." | high |
| Retail identity | 0.72.5 `SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | The binary matches the established secondary-system oracle. | high |
| Existing instruction recovery | dispatcher `0x0054CC50`, Phasing helper `0x0052A0B0`; Website ledger plus read-only Mod Loader report at revision `08bfba9ef367f7b863848030d0a289dc31e33192` | The dispatcher sends the cast heading to a helper that checks twenty forward destinations, commits the first clear point, and emits the traversal effect. | high |
| Existing clean/runtime differential | read-only `multiplayer_secondary_behavior_harness.py::run_phasing` | The stock harness plants heading `0`, drives the actor forward, casts row 15, and requires at least 60 units of added displacement plus owner/observer position convergence. | medium; it proves forward displacement but does not independently vary pointer aim |
| Current Website causal trace | `origin/main` `e7addc2b`; `native-secondary-abilities.ts`, `gameplay-input.ts`, `HubScene.tsx`, `BoneyardScene.tsx` | The common dispatcher computes `direction = unit(origin, input.aim)` and Phasing uses it for destination, streak position, and rotation. Default pointer-secondary input therefore overrides actor heading; keyboard and touch can reuse stale aim too. | high |

The canonical Ghidra wrapper could not be freshly invoked from this Linux
shell because Windows PowerShell interop is unavailable. No alternate project
was created. The material direction contract is nevertheless closed by the
matching retail binary and CFG plus the already-recorded instruction and stock
harness evidence above.

### System boundary and membership inventory

Native system: **Phasing row-15 heading-owned relocation**, from the current
authoritative player heading through collision probes, position commit,
traversal presentation, replication, and retirement.

| Member / branch | Native source | Disposition in this reopening | Proof contract |
| --- | --- | --- | --- |
| current actor heading | player facing lane; Phasing CFG; dispatcher `0x0054CC50` | `exact-ported` | mismatched aim cannot change the direction supplied to the helper |
| right-mouse pointer aim enabled | shared belt input, Website browser extension | `out-of-system` for Phasing direction; aimed secondary rows still consume it | mouse aim east plus heading south phases south |
| pointer aim disabled / facing projection | Website input extension | `verified-already-at-parity` | Phasing still consumes authoritative heading, not the projected world point |
| keyboard quickbar with retained aim | native belt keys `1..7` plus Website input state | `exact-ported` at the common Phasing consumer | stale pointer aim cannot redirect the cast |
| touch quickbar with retained/fallback aim | Website touch producer | `exact-ported` at the common Phasing consumer | touch cast follows the current replicated heading |
| standard gamepad quickbar/right-stick aim | Website gamepad producer | `exact-ported` at the common Phasing consumer | right-stick aim cannot bypass the heading owner |
| Hub Courtyard and four private rooms | Website shared-Hub combat seal | `verified-already-at-parity` Hub rejection | row 15 cannot spend mana, relocate, or emit presentation in the noncombat Hub; its dormant Region callback is not a live direction member |
| Boneyard generated arenas | Arena bounds/static collision branch | `verified-already-at-parity` for collision; direction owner corrected | every accepted destination remains collinear with heading |
| successful probe | helper `0x0052A0B0` | `exact-ported` | first accepted distance remains one of `80..270` in 10-unit steps |
| all twenty probes blocked | helper `0x0052A0B0` | `verified-already-at-parity` | mana/action/cooldown remain accepted; no relocation, streak, cue, or flash |
| traversal streak and `phase` cue; no Region flash | BadGuys `53`, source plus heading times 10; `0x0063FEE0` | `exact-ported` | position and rotation use the same heading vector as relocation; no screen-feedback event exists |
| host/observer snapshots and late join | authoritative player position plus semantic actor/event wire | `verified-already-at-parity` | host commits once; observers receive the same destination/effect |
| other 22 category-2 rows | dispatcher `0x0054CC50` membership | `out-of-system` because their recovered aimed/self/caster targeting remains distinct | closed contract enumeration remains unchanged |

No member is blocked by the browser platform.

### Native ownership thread and recovered contract

- Player movement/action logic owns the current facing before category-2
  dispatch. Phasing reads that actor state; it does not derive a new heading
  from the pointer or turn the wizard toward an aimed world point.
- The Phasing helper owns twenty straight-ray candidates at distances
  `80,90,...,270`. The active Arena callback decides whether each full
  player-radius destination is clear and never synthesizes a sideways
  fallback. Website's later shared-Hub policy rejects category-2 execution
  before the otherwise retained Region callback can run.
- Success commits the accepted point and creates one BadGuys-53 streak at
  `oldPosition + heading * 10`, rotated along the same heading, with scale two
  and the existing 20-tick fade. It also emits the existing `phase` cue. Fresh
  instruction recovery in the 2026-09-02 reopening proves there is no Region
  flash on this path.
- Failure after all probes preserves the already-paid cast, StaffCast2, row
  cooldown capacity, and common cooldown behavior, while emitting no semantic
  presentation edge.
- Direction, collision, mana, cooldown, relocation, and actor IDs remain host
  authoritative. Input-device aim is still transmitted for genuinely aimed
  abilities but is not Phasing state.

### Web implementation consequence and validation contract

- `native-secondary-abilities.ts` must derive a Phasing-local vector from
  `authority.character.headingIndex`; the shared `unit(origin, aim)` value
  remains untouched for every aimed secondary sibling.
- Destination probing, phase-marker placement, streak rotation, cue, cooldown,
  and replication must consume that one heading vector; no Region flash is
  emitted.
- A focused red/green regression must set heading north and aim east, observe
  the direction handed to `phasingDestination`, and assert northward
  relocation/streak geometry while retaining accepted-failure coverage.
- The existing closed 23-row contract tests must remain green so no aimed
  sibling inherits the Phasing rule.
- Real Mac Chrome must prove the Hub combat seal still rejects row 15, then
  cast in Boneyard with deliberately orthogonal heading and pointer aim and
  prove the accepted destination and streak are collinear with heading. The
  focused kernel retains the all-probes-blocked cast contract. Both journeys
  must retain empty page, console, response, protocol, and host-error lanes.

### Implementation validation receipt

- `native-secondary-abilities.ts` now derives row 15's one direction from
  `authority.character.headingIndex` and uses it for the collision callback,
  marker, and streak rotation. The shared aim vector remains the owner for the
  aimed sibling rows. The checked contract now names row 15
  `actor-heading-forward-probe`.
- The focused regression first failed with `{x:1,y:0}` entering the helper
  while a north-facing actor expected `{x:0,y:-1}`. It now passes and asserts
  an 80-unit north relocation, a 10-unit north marker, and matching rotation.
  The older success/failure test now declares its east-facing fixture instead
  of silently relying on aim; the no-destination branch still spends mana and
  arms its action/cooldowns without an actor, cue, or flash.
- The exact Mac candidate ran the canonical validation gate successfully:
  backend Release build and 29 contracts; clean formatting/lint/import
  boundaries; frontend groups `61,10,47,12,320,7,1721,5,76,9,61,14,47,7,36,80,5`
  all at zero failures; desktop tests; production frontend/game-host builds;
  game bundle `80,327 / 134,144` gzip bytes; and media policy.
- Mac Chrome/WebGL2 Boneyard acceptance used ordinary movement to make the
  visible and authoritative heading index `0` (north), then right-clicked an
  east aim point. Source `(1710.2249755859375,989.7750244140625)` moved exactly
  80 units north to `(1710.2249755859375,909.7750244140625)`; the traversal
  marker was exactly 10 units north at
  `(1710.2249755859375,979.7750244140625)`. One phase actor, one `phase` cue,
  an at-the-time cyan web flash, native square cooldown, and 65 presented
  ticks were observed. The 2026-09-02 instruction/pixel reopening below proves
  that flash was an invented web effect and supersedes it as parity evidence.
  Page, console, and response error arrays were empty. Log SHA-256 is
  `567bc7e4d39ae34ba929911478f718b7987a5f46e3ee3e22503b4098efb60df8`;
  the main capture hash is
  `0207a9db0c55d267e4bdfb334cb7d9d3c4b8c7315b365bb3bc1849f548cd3e6d`.
- A separate Mac Chrome/WebGL2 Hub journey retained position
  `(950.64,164.04)`, mana `100`, actor/event identities, and zero audio while
  the HUD reported Phasing unavailable. Its page, console, and response error
  arrays were empty. Log SHA-256 is
  `c3d3c99a1d843e7f9611ae9031ca6eadaac0a140e5a2c2abe3753632de4008e3`;
  capture hash is
  `3fb09d372ac4d6e1a11c9a120fa9ae3afc73ff9af42c1c6e8e44f3c41f863ad5`.
- No member is blocked by the browser platform and no approximation was added.

## 2026-08-30 — Mana-hoard ceiling and reserve-HUD reopening

### Reported smell and parity question

- Reported Website behavior: while a hoard toggle is active, the blue mana
  strip remains full beneath the gold reserve marker. The marker therefore
  appears blue/cyan-filled instead of enclosing the empty meter track shown by
  retail Solomon Dark.
- Stock behavior to recover: the complete hoard path from the three toggle
  writers, through refreshed maximum MP and the fixed-tick current-MP ceiling,
  to cast affordability and the `UI.40/UI.41` HUD consumer.
- Reproduction states: full 100/100 MP with 25 hoarded; current below the
  ceiling; Firewalker absolute reserve; every Mindstar/Regenerate percentage
  rank; stacked reserves; reserve equal to or greater than maximum; Mana Up,
  equipment, charm, Channel Mana, Meditation, direct recovery, toggle-off,
  death/reset, Hub, Boneyard, Tutorial combat, and multiplayer local HUD.
- Falsifiers: a retail tick that leaves current MP above `maxMP-hoardedMP`; a
  toggle dispatcher that debits `mHoard` as a mana cost; or a stock HUD that
  derives its blue width from a second `current-hoard` subtraction.

This is a secondary report in a system previously marked closed. The skipped
rule was producer/consumer ownership. The earlier pass recovered `+0x740` and
the three toggle bytes, but modeled reserve only in the secondary-ability
store. It never followed `Skills::Tick` through the current-MP writer, then
compensated by subtracting reserve again in spell, quickbar, and ML consumers.
The later vital-strip pass repeated the mistake: its smoke injected a reserve,
measured only the gold rectangle, and never asserted the blue endpoint or live
authoritative MP. Correct reserve geometry therefore hid an incomplete state
model.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| User stock/web comparison | `C:\Users\User\Downloads\stock - image.png`, 610x720, SHA-256 `36d100d7914aee222096007182358043c5d06509832b661b6518cb7fca35912c`; `web port - image.png`, 872x1156, SHA-256 `c794ffee1541bda84224762b8d94e4480f3c942f4fc904db27128ede7b1f43c3` | Stock blue ends where the gold hoard begins; Website blue continues through the hollow marker. | high visible |
| Retail identity | unmodified Beta 0.72.5 `SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Canonical image for all preferred addresses below. | high |
| Retail instructions: producer/tick | `Skills_Wizard::RebuildCaches 0x006623F0`; `Skills::Tick 0x00660220`, exact MP block `0x0066029F..0x006602C9`; `Skills_Wizard::Tick 0x006614D0`; Meditation recovery `0x00656640`; overload `0x006639D0` | Firewalker contributes its absolute `mHoard`; Mindstar/Regenerate contribute `maxMP*mHoard/100`. Every base tick stores `min(currentMP + recovery/tickRate, maxMP-hoardedMP)`. Meditation then owns a distinct post-base add capped at max MP. `hoard > max` clears all toggles, hoard, and current MP. | high |
| Retail instructions: activation/consumers | quickbar router `0x005D5600`; category-2 dispatcher `0x0054CC50`; ordinary debit `0x0052B150`; HUD `0x005D2520`, MP block `0x005D2C02..0x005D2F0A` | Rows 23/78/79 toggle and refresh without calling the debit helper: `mHoard` is not `mManaCost`. Ordinary casts consume already-capped current MP directly. HUD clips `UI.40` by `current/max` and places `UI.41` over the right-side hoard interval; it performs no second reserve subtraction. | high |
| Authored data/assets | complete checked-in skill catalog rows 23/78/79; `UI.40` blue strip, `UI.41` 21x10 hoard strip, `UI.70` frame in atlas SHA-256 `37d5e8fc543af12a9d8019e738dbe1e29b648211144a3782c3a32e71f76cd2eb` | Firewalker is absolute 50. Mindstar ranks are `60/40/30/25/20/15/10/5%`; Regenerate ranks are `25/21/18/15/12/10/8/6%`. All authored rows and HUD records are already extracted. | high |
| Loader-injected supporting runtime | staged retail PID `6784`, image base `0x00460000` (ASLR delta `+0x60000`), loader/tool revision `08bfba9ef367f7b863848030d0a289dc31e33192`; Lua writes on local progression followed by a four-byte write watch | At full 100/100 MP, setting `+0x740=25` made the next live tick store 75 MP and rendered the empty gold interval. Runtime EIP `0x006C02C9` maps to preferred `0x006602C9`. Repeated writes retained 75. | high supporting; injected state, reconciled with retail instructions and visible pixels |
| Ghidra provenance | canonical project `SolomonDark`, program `SolomonDark.exe`, Ghidra 12.0.3 replica pool; wrapper SHA-256 `b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`; `decompile_targets.py` `899167ca...e97465`, `dump_insns_around.py` `79249e8e...632b40` | Read-only canonical replica queries recovered the exact branches and float instruction order; no Mod Loader file changed. | high |
| Current Website | `origin/main` `ebf693b499aeca417ffe84c9ba0d0a305f55dd2a`; `native-secondary-abilities.ts`, `player-entity-store.ts`, `game-simulation.ts`, `SkillQuickbar.tsx`, `native-hud-presentation.ts`, `smoke-native-derived-hud.mjs` | Reserve is stored but recovery still caps at full maximum. Cast/quickbar/ML paths subtract it independently. The browser smoke sets `reservedMana=50` without constraining current MP and checks only reserve bounds, reproducing the reported blue overlap. | high |

The runtime capture is supporting diagnostic evidence, not a clean-process
claim. The user-supplied retail pixels establish the visible oracle and the
unmodified executable instructions independently establish the writer,
arithmetic, call order, and renderer inputs.

### System boundary and membership inventory

Native system: **wizard mana-hoard ceiling and local reserve presentation**,
from authored row/toggle state through refreshed reserve, fixed-tick MP
mutation, affordability consumers, replication, `UI.40/UI.41` painting, and
toggle/reset teardown.

| Member / branch | Native source | Disposition in this reopening | Proof contract |
| --- | --- | --- | --- |
| Firewalker 23, every learned rank | `0x0054CC50`, `0x006623F0`, authored `mHoard=50` | `exact-ported` | free toggle; reserve 50; same-tick ceiling; no second affordability subtraction |
| Mindstar 78, ranks 1..8 | `+0x8DD`, `0x00661E40`, `0x006623F0`, complete percentage table | `exact-ported` | reserve uses the refreshed maximum after temporary-rank recomputation |
| Regenerate 79, ranks 1..8 | `+0x8DE`, `0x006623F0`, complete percentage table | `exact-ported` | every authored percentage reaches the shared ceiling and HUD |
| All stacked toggle combinations | additive `+0x740` cache | `exact-ported` | deterministic sum; order-independent reserve; one shared ceiling |
| `0 < hoard < max` | `0x0066029F..0x006602C9` | `exact-ported` | current above ceiling drops immediately; current below it receives base recovery only to the ceiling |
| `hoard == max` | same compare/store; overload is strict `>` | `exact-ported` | zero ceiling without premature overload |
| `hoard > max` | `0x0066399E -> vslot +0x54 0x006639D0` | `verified-already-at-parity` | all three toggles and reserve clear; MP goes to zero; one overload edge |
| Mana Up 56, Mindstar-effective rank, max-MP equipment, Mana Charm, unforge max MP | refresh `0x0065F9A0/0x00661530` before cache `0x006623F0` | `exact-ported` | reserve and ceiling recompute from the same refreshed maximum with no stale tick |
| Channel Mana 57 and equipment recovery | base scalar `+0x98`; `0x006602AB..0x006602C9` | `exact-ported` | transformed base recovery remains subject to `max-hoard` |
| Meditation 58 ordinary/concentrated branches | `0x006614D0 -> 0x00656640` after base tick | `exact-ported` | separate post-base add, its native activity factor, and max-MP cap remain ordered after the hoard ceiling |
| Primary/secondary debit and affordability | `0x0052B150`; dispatcher callers | `exact-ported` | already-capped current MP is the sole available value; reserve is not subtracted twice |
| BeltButton unavailable treatment and ML policy observation | row `+0x60`; authoritative current MP | `exact-ported` | hoard-only rows cost zero; all real mana costs compare directly with current |
| Mana potion/orb/Magic Circle and other direct positive writers | existing native writer inventory; next `Skills::Tick` ceiling | `verified-already-at-parity` with shared ceiling restored | direct write remains owned; following base tick enforces the hoard boundary |
| `UI.40` current fill and `UI.41` reserve | `0x005D2C02..0x005D2F0A`; exact repeated-strip helper | `exact-ported` | blue right edge never crosses gold left edge in a settled non-Meditation state; both retain authored strips/blend/order |
| default/dynamic/fractional maximum meter geometry | shared HUD compositor and `UI.70` | `verified-already-at-parity` | core/track anchors and third-strip construction unchanged |
| Hub, Boneyard, and Tutorial-combat local HUD | shared `Game::Render 0x005D2520` owner | `exact-ported` | same authoritative local current/reserve pair in every live scene |
| multiplayer local participant and snapshot restore | host-authored progression plus secondary player state | `exact-ported` | current and reserve publish together; clients perform no local ceiling arithmetic |
| toggle-off, local death/disconnect, Game Over, new run, save/resume | existing secondary owner cleanup and progression reconstruction | `verified-already-at-parity` with ceiling restored | no reserved amount is refunded; next ticks recover toward the unhoarded maximum; no stale gold strip |
| health/shield strips, selected skills, ally/nameplate/enemy meters | separate compositor/state owners | `out-of-system` | no mana-hoard state is consumed |

No member is blocked by the browser platform. The existing float state, exact
atlas strips, DOM clipping, and host snapshot can represent the native system
without an approximation.

### Native ownership thread and recovered contract

- Rows 23/78/79 own toggle bytes `+0x8DC/+0x8DD/+0x8DE` but do not debit
  `mHoard`. `Skills_Wizard::RebuildCaches` is the only reserve calculator and
  writes the additive result to `+0x740` after maximum-MP refresh.
- `Skills_Wizard` vtable tick `0x006614D0` calls base `Skills::Tick
  0x00660220`. At 100 Hz the base owner first computes
  `currentMP = min(currentMP + recoveryScalar/tickRate, maxMP-hoardedMP)`.
  It therefore clamps an over-ceiling value on the same recurring tick and
  never refunds hoard on toggle-off.
- Meditation is a lateral writer after that base store. When ready,
  `0x00656640` adds its separately calculated recovery and caps at full max MP;
  the ordering is native even where it leaves a subpixel amount beyond the
  base ceiling until the next tick.
- Ordinary spell debit `0x0052B150`, belt availability, and bot policy consume
  current MP directly. The old Website `current-reserve` calculation was a
  second reservation and is removed everywhere at once.
- `Game::Render` clips `UI.40` linearly by `current/max`. If reserve is
  positive it draws hollow `UI.41` from
  `coreLeft + coreWidth*(max-hoard)/max` to the core right edge. Correct blue
  termination is therefore a consequence of authoritative current state, not
  a CSS mask or marker-specific fill patch.
- Refresh, host replication, scene changes, and respawn rebuild from the same
  current/max/reserve facts. Rendering samples them and owns no delayed,
  interpolated, random, audio, input, or client-authoritative hoard state.

### Nearby-system findings

- The prior native report already stated the `maxMP-hoardedMP` cap, but the
  Website implementation and HUD receipt never connected that fact to the
  player combat tick. A documented fact without a producer-to-consumer test
  did not close the system.
- `mHoard` is reserve data, not a fallback mana-cost schedule. The dispatcher
  cases for 23/78/79 contain no `0x0052B150` debit, and router `0x005D5600`
  adds no separate resource gate.
- Native Meditation recovery is a distinct post-base write. Folding it into
  the base recovery delta erases its ordering against the hoard ceiling.

### Confidence and open questions

- Confirmed high: complete reserve writers/tables, strict overload edge,
  fixed-tick ceiling formula, toggle no-debit branches, Meditation ordering,
  HUD records/formulas, stock/web pixels, runtime current transition, scenes,
  and Website failure path.
- Inferred: none material to implementation.
- Unknown: none inside the declared system boundary.

### Web implementation consequence

- Make the player combat tick consume the current secondary reserve as its
  per-player base-recovery ceiling. Preserve the native separate Meditation
  add after that ceiling.
- Recalculate reserve from active toggles, the complete authored rank rows,
  and the refreshed authoritative maximum before the same tick's combat/HUD
  snapshot.
- Compare every real cast cost directly with authoritative current MP. Give
  the three hoard-only toggles zero mana cost; remove all second reserve
  subtractions from dispatcher, quickbar, primary authority, and ML policy.
- Keep `nativeManaHudPresentation`, `UI.40`, `UI.41`, repeated-strip geometry,
  additive composition, and CSS anchors unchanged. The reported pixels must
  emerge from corrected simulation state.

### Validation contract

- Pure contracts: all three reserve tables and stacks; refreshed maxima;
  below/at/above ceiling; strict overload; toggle-on/off without debit; base
  recovery ceiling; separately ordered Meditation; direct cast affordability;
  exact `UI.40/UI.41` endpoints at default, upgraded, and fractional maxima.
- Integration: a real authoritative toggle at full MP must publish
  `current=max-reserve` in the same completed tick; spending uses that current
  once; toggle-off refunds nothing and ordinary recovery resumes toward max.
- Mac Chrome: run natural Hub/Boneyard journeys through the affected HUD,
  measure blue clip right edge and gold left edge, sample the marker interior,
  exercise one absolute and one percentage reserve, then toggle off. Page,
  console, failed-response, protocol, and host-error arrays must be empty.
- Stock comparison: match the supplied state and require the Website gold
  interval to remain visibly unfilled, with the blue/gold boundary within one
  device pixel at the same 1600x900 logical viewport.
- Run `/opt/homebrew/bin/bash ./scripts/validate.sh` on the exact Mac candidate.

### Implementation validation receipt

- Implementation: `native-secondary-abilities.ts` now derives reserve from
  active rows 23/78/79 and their authored rank values, refreshes it against
  current maximum MP, exports the shared `max-reserve` ceiling, and compares
  real cast costs directly with current MP. Hoard-only rows now publish zero
  mana cost. `game-simulation.ts` reconciles reserve after Mindstar refresh and
  passes the per-player ceiling into the player combat owner; primary and ML
  affordability use current MP once. `SkillQuickbar` removes the second
  reserve subtraction.
- Tick ordering: `player-skill-runtime.ts` now exposes base and Meditation MP
  recovery as separate lanes. `player-entity-store.ts` applies transformed
  base recovery under the hoard ceiling, then applies the native Meditation
  add against full maximum MP. Existing poison, death, potion, direct recovery,
  Regenerate HP, and extension owners remain separate.
- HUD consequence: no marker-specific renderer or CSS patch was added.
  `native-hud-presentation.ts`, `GameHud`, `UI.40`, `UI.41`, `UI.70`, exact
  strip tiling, blend, and anchors are unchanged. Correct pixels now emerge
  from authoritative current MP. The derived-HUD smoke adds an endpoint and
  pixel regression over that existing compositor.
- Red receipt: the exact-base detached Mac candidate failed only the new
  contracts: missing `nativeSecondaryManaReserve`, hoard rows still exposing
  `[0,mHoard]` as cost, and the unsplit Meditation tick result. No product code
  existed for those assertions at that point.
- Focused/system coverage: pure tests pin all three toggle no-debit branches,
  Firewalker absolute reserve, every Mindstar/Regenerate rank table through
  the catalog, stacked/dynamic reserve, ceiling `75/0/0`, immediate above-cap
  correction, below-cap recovery, zero ceiling, direct-current affordability,
  base-before-Meditation ordering, and the exact blue/gold shared endpoint.
- Mac gate candidate: base `ebf693b499aeca417ffe84c9ba0d0a305f55dd2a`,
  all 16 changed files byte-identical between the isolated local and detached
  Mac worktrees. macOS `26.6.2` build `25G83` arm64, Node `22.17.0`, npm
  `10.9.2`, .NET `10.0.302`, and Chrome `151.0.7922.174` passed the supported
  `/opt/homebrew/bin/bash ./scripts/validate.sh`: backend build and 28
  contracts; frontend groups `61,10,47,17,327,7,1766,5,5,9,60,17,47,7,36,85,5`
  all at zero failures; production frontend/game-host builds; media policy;
  and game bundle `266,211` raw / `80,887` gzip bytes within budget.
- Mac Chrome derived-HUD receipt: the upgraded 137.5-pixel mana core had
  `UI.40` clip `inset(0px 20% 0px 0px)`. Its visible right edge was exactly
  `x=965`, identical to `UI.41` left edge; reserve occupied
  `[965,992.5]`. Available/hoarded sample pixels were respectively
  `[29,96,155,255]` and `[2,1,1,255]`. Page, console, and failed-response
  arrays were empty.
- Natural Boneyard journeys: Regenerate 79 committed at authoritative tick
  `2803`, changed current MP `100 -> 75`, exposed quickbar mana cost zero, kept
  the toggle/`mindstar`/orange Region path, and produced the empty 25-percent
  marker. Firewalker 23 committed at tick `2715`, changed `100 -> 50`, exposed
  cost zero, retained its native common cooldown, `ignite`, Region feedback,
  and live fire patches, and produced the empty absolute-50 marker. Both ran
  under WebGL2 with empty page/console/response-error arrays. The inspected
  capture SHA-256 values are Regenerate
  `5e46cadf09adfe302a76e57715fabc8eba2ded908579ded0d5e05517991b736e`
  and Firewalker
  `a46095aa081312d1e519c6b7663f14b78ece8d5bd65d5e615162d032fffe982e`.
- No member is browser-blocked and no implementation unknown remains. After
  the receipts above, `origin/main` advanced to
  `984f07e2449993a0595b435f653f1257563e8a98`; the focused patch was
  rematerialized cleanly on that exact base, including preservation of its
  overlapping crash-boundary additions in `native-secondary-abilities.test.ts`
  and `game-simulation.ts`. The completion handoff owns the unchanged-command
  current-base repeat and disposable evidence/worktree cleanup. No commit,
  push, deployment, production restart, or live-service claim is made.

## 2026-08-30 — Dampen crash-debt presentation and canceled-projectile reopening

### Reported smell and parity question

- A player supplied `SDB - Dampen Visual Glitch.mp4` (1,256,320 bytes,
  SHA-256 `75065366e18f0d79fda16d85a848d06486459103fdb2c176dd0995aaa864a3f7`).
  The 1920x1080, 3.034-second capture shows a Dampen cast producing a single
  oversized, bright white stack of concentric/partial loops around the caster,
  followed by the gray radial puffs. The loop stack is visible near 1.85
  seconds and is the Website's current 30-copy BadGuys-48 suffix, not video
  corruption or a missing texture.
- The report identifies this as the infamous stock Dampen path that crashed
  Solomon Dark. No surviving clean-SD footage establishes a successful
  intended final frame; reproducing the executable's corrupting allocation
  storm is therefore not an externally observable parity target.
- Falsifiers were: a Website-only transform or blend error; a safe stock
  animation with the wrong web scale; a separate intended stock owner hidden
  after the 390-child suffix; or a sibling-game implementation that retained
  the same 390-object construction. All four are false.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Player capture | Windows Downloads video above; H.264 1920x1080 at 29.65 average FPS | The bright loop stack is followed by the gray radial cloud exactly where `dampenDraws` paints its additive and MoveFade groups. | high |
| Retail SD instructions | unmodified 0.72.5 `SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; preferred base `0x00400000`; fresh replica-3 decompile of `0x00648DF0` and instruction window `0x0054F03F..0x0054F11B` | Accepted row 51 calls the helper, then separately creates mode-21 CastSpin and halves its action scalar. The helper first creates one `Anim_DampenedSpell` for each eligible projectile, then allocates 360 MoveFades and 30 additive-perspective fades. | high |
| Retail SD child lifecycle | fresh decompile of `Anim_DampenedSpell` constructor/update/draw `0x00455020/0x0045A030/0x00461100`; BadGuys registry rows `10/11`, `110..112`, `255..266` | Canceled projectiles retain their native family art, move away from the caster, and emit fading record-10/11 feedback before teardown. Firebolt is mode 0; GuidedMissile resolves cold/poison modes; SkullMissile and DarkFireball use mode 3. | high |
| Crash evidence | read-only Mod Loader revision `08bfba9ef367f7b863848030d0a289dc31e33192`; `stock_dampen_effect_context.inl`; two recorded Windows dumps | Both the helper and following stock presentation allocation path poisoned the shared pointer-list heap and later failed in `HookPointerListDeleteBatch`. The multiplayer workaround suppresses that block rather than invoking it. | high |
| Current sibling implementation | Boneyard `SB.exe`, 9,539,584 bytes, SHA-256 `b9322c6963ff03a9ff52dcb0789490b46510e4b78b1cbbda229ef1b0a173e9bb`; read-only `SolomonsBoneyard` Ghidra project | Skill `0x34` is `Unmagic`, the same area-cancel family. Cast dispatcher `0x1401F4F20` creates one `Anim_Unmagic` (`0x140016900`) and flings canceled magic through `Anim_Flinger` (`0x140017550`) rather than allocating a one-frame radial storm. | high |
| Sibling owner/lifetime | `Anim_Unmagic` update/draw `0x140016970/0x1400173A0`; `Anim_Flinger` update/draw `0x140017610/0x140017710`; decrypted `unmagic.txt` | One owner grows by `s=(s+0.01)*1.05` and retires after crossing one (36 updates), emits three caster-image wisps per update, and keeps canceled projectiles visibly moving outward through their own painter. The cast uses the Dampen sample; rank two expands shield removal to 100 percent. | high |
| Existing Website implementation | `native-secondary-abilities.ts`, `native-secondary-world.ts`, and `native-secondary-presentation.ts` at base `228c1fd8` | Website advances the 2,970-word stock suffix and paints all 390 children. It deletes every enemy projectile kind in the square, including Arrow, DemonBomb, and PoisonPool, and emits no canceled-projectile painter. | high |

The fresh SD queries used the required read-only wrapper and replica pool. The
wrapper and decompile script hashes were respectively
`b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`
and `899167ca42624e09f26d22233365631a6ee8b3d106e337e20b77574894e97465`.
No runtime address or injected observation is used as an instruction fact.

### System boundary and membership inventory

Native system: **Dampen admission, hostile-magic selection, canceled-magic
flyout, caster pulse, CastSpin, and audio**, beginning at accepted row 51 and
ending when its flyout/pulse painters and disruption state retire.

| Member / branch | Native source | Disposition in this reopening | Proof contract |
| --- | --- | --- | --- |
| row-51 admission, mana, global/row cooldown | dispatcher `0x0054CC50`, debit `0x0052B150` | `verified-already-at-parity` | rejected casts create no actor; accepted cast spends once and retains 20-second row cooldown |
| action identity and CastSpin | `0x0054F0FE..0x0054F11B`, mode `0x15/21`, half scalar | `verified-already-at-parity` | 73 strict-boundary ticks, independent from the pulse lifetime |
| Firebolt `0x7EB` | helper flag `0x100`, `Anim_DampenedSpell` mode 0, BadGuys `255..266` | `exact-ported` | selected in the 400-square, removed from combat, then visibly flung outward with Firebolt art |
| GuidedMissile `0x7EC`, cold and poison | helper flag `0x100`, mode `2-payload`, BadGuys `110..112` | `exact-ported` | both payload variants preserve their main/aura family during outward flyout |
| SkullMissile `0x800` and DarkFireball `0x804` | helper mode 3 | `out-of-system` — DireFaculty/story projectile owners are not in the maintained Website runtime | explicit negative inventory row; no fabricated Boneyard actor |
| Arrow `0x7DA`, DemonBomb `0x7F7`, PoisonPool `0x806` | absent from helper flag/mode membership | `exact-ported` negative branch | Dampen must not remove or repaint any of the three |
| SkeletonMage `0x3EB` disruption | helper type branch and six-second action reset | `verified-already-at-parity` | target effect remains 600 fixed ticks |
| DireFaculty `0x3F2` disruption | helper type branch | `out-of-system` — story boss is separately dispositioned outside the current runtime | no claim that SkeletonMage-only current scenes cover it |
| shield-bearing hostile with capability bit `0x2` | `RandomInt(100) < 0x33` and shield-clear virtual | `verified-already-at-parity` | 51 successful values out of 100; sorted deterministic targets; no UI-text correction to 50 |
| broken 360 MoveFade plus 30 arc allocation suffix | `0x00648DF0`, BadGuys `10/11/48`, 2,970 RNG words | `out-of-system` — crash-inducing executable debt, not a successful stock presentation | retain the authoritative RNG advance and full 360-degree asset domain, but never materialize the corrupt child count |
| repaired caster pulse | sibling `Anim_Unmagic`; SD `10/11/48`; loader safety pulse | `exact-ported` as the Website's explicit crash-debt repair contract | one owner, 36 evenly spaced radial wisps, three centered magical arcs, bounded one-second retirement, no light or camera invention |
| `flash` and `dampen` audio | SD dispatcher/helper registries | `verified-already-at-parity` | one flash cast edge followed by one Dampen pulse edge; no invented loop |
| Hub/non-combat rejection, teardown, multiplayer observer | existing secondary authority and actor snapshot lifecycle | `verified-already-at-parity` with the new transient members | no Hub world mutation; host owns targets/RNG; late renderers sample actor state without replaying a cast |

No member is blocked by the browser platform. The shipped SD child count is
deliberately excluded because it corrupts the stock heap; the replacement is
an explicit repair of executable debt, not a claim that footage proved an
unseen successful SD frame.

### Native ownership thread and recovered contract

- Accepted row 51 owns admission, cost, cooldown, the sentinel action-identity
  word, shield rolls, target mutation, mode-21 CastSpin, and two audio edges.
  Those facts remain host-authoritative and unchanged.
- `0x00648DF0` selects only magic actors carrying native flag `0x100`. Within
  the maintained Boneyard projectile set that means Firebolt and GuidedMissile,
  not every object in `enemies.projectiles`. The current all-projectile filter
  is a gameplay defect revealed by the visual-system sweep.
- Every selected projectile is handed to `Anim_DampenedSpell` before native
  teardown. Its family selector keeps Firebolt, cold Guided, poison Guided,
  and Dire projectile presentation distinct. Immediate array deletion loses a
  real native painter member.
- The final 390 allocations are not the clock for gameplay or CastSpin. They
  are a presentation-only suffix that consumes 2,970 RNG words, overwhelms the
  pointer-list owner, and maps directly to the captured Website loops/cloud.
- Modern Boneyard resolves the same design problem with one `Anim_Unmagic`
  owner and one `Anim_Flinger` per canceled spell. The Website repair follows
  that ownership shape while retaining SD's already bundled BadGuys art and
  the SD authoritative RNG advance.
- Scene exit, actor retirement, observer interpolation, and host reset remain
  generic secondary-actor lifecycle owners. No renderer-local timer or
  browser-frame RNG is introduced.

### Nearby-system findings

- The prior closure treated instruction-exact crash debt as presentation
  truth and stopped before the known `Anim_DampenedSpell` sibling. That is the
  skipped rule which caused this secondary report.
- The existing `radius=400` square query is the intended caster-area domain,
  but its projectile predicate is too broad. Projectile membership must be
  based on native family/capability, not mere presence in the store.
- The Mod Loader's multiplayer double-ring is useful crash evidence and a
  bounded-size witness, but it is not clean stock footage and does not become
  the Website asset recipe.

### Confidence and open questions

- Confirmed: capture/source correspondence; crash ownership; all four native
  projectile families; current Website over-removal; per-projectile flyout;
  CastSpin/audio separation; modern sibling owner, formula, and lifecycle.
- Inferred by necessity: the exact successful SD arc density is unrecoverable
  because the only shipped path corrupts the heap and no successful capture is
  known. The repair keeps the full angular domain and stock assets but samples
  one child per ten native headings and one per ten native arc rows. This is
  deliberately labeled repair policy rather than recovered SD pixels.
- Falsifier: a future clean recording or source archive showing a safe Dampen
  pulse supersedes only the 36/3 sampling policy; projectile membership,
  gameplay, CastSpin, audio, and crash findings remain established.

### Web implementation consequence

- Keep the 2,970-word authoritative RNG advance so later gameplay remains on
  the established SD stream. Render only headings `0,10,...,350` and additive
  rows `0,10,20`; do not create a second effect kind for each of the discarded
  presentation rows.
- Enrich Dampen candidates with the exact Firebolt/Guided presentation state,
  filter out Arrow/DemonBomb/PoisonPool, and create one host-owned
  `dampened-projectile` transient for every removed projectile.
- Move each transient radially away from the caster at the sibling's exact
  40-units-per-update flyout speed and retire it with the bounded repaired
  pulse. Render through the existing Firebolt/Guided native compositor so
  payload art, atlas membership, tint, heading, and phase stay cohesive.
- Preserve shield probability, mage disruption, cast admission, cooldown,
  action, audio, light-negative disposition, and multiplayer authority.

### Validation contract

- Kernel: Dampen selects Firebolt and both Guided payloads, excludes Arrow,
  DemonBomb, and PoisonPool, removes the selected IDs, spawns one outward
  transient per selected projectile plus one pulse, keeps the 2,970-word
  suffix advance, and retains 73-tick CastSpin.
- Renderer: the caster pulse has exactly 36 source-over MoveFades and three
  additive record-48 arcs at birth; no plan can reach the former 390 draws.
  Firebolt and cold/poison Guided flyouts reuse their exact existing native
  layer families and move farther from the caster on successive fixed ticks.
- Protocol/ownership: the new actor kind is accepted by the closed union,
  decodes for an observer, owns one transient painter, and owns no light.
- Mac Chrome: cast Dampen naturally in Boneyard with one Firebolt, one cold or
  poison GuidedMissile, and one negative projectile family in range. Require
  the positive projectiles to fly outward visibly, the negative family to
  remain, the loop stack to be absent, CastSpin/audio to remain, and all page,
  console, host, and failed-response arrays to be empty.
- Run `/opt/homebrew/bin/bash ./scripts/validate.sh` on the exact Mac candidate.

### Implementation validation receipt

- Implementation: Dampen candidates now carry only retail Firebolt `0x7EB`
  and cold/poison GuidedMissile `0x7EC` state in native registration order.
  Arrow, DemonBomb, and PoisonPool remain in the hostile projectile store.
  The dispatcher removes the selected IDs, advances the unchanged 2,970-word
  suffix, creates one host-owned `dampened-projectile` per removed spell, and
  keeps the existing pulse, 73-tick CastSpin, shield rolls, disruption, debit,
  cooldown, and audio owners.
- Presentation: each canceled spell moves radially outward at 40 world units
  per fixed update and reuses the existing Firebolt or Guided compositor. The
  pulse consumes the complete recovered RNG rows but materializes only 36
  evenly spaced record-10/11 puffs plus three record-48 arcs. Its birth ceiling
  is therefore 39 primitives instead of 390; it adds no light, camera, local
  clock, or new atlas art. Firebolt records `255..266` and Guided records
  `110..112` are now explicit members of the secondary renderer's closed asset
  set and reuse the already loaded Boneyard combat atlas.
- Ownership/protocol: `dampened-projectile` is in the kernel, protocol,
  renderer-diagnostic, and ML closed unions. Protocol version 113 combines the
  Dampen actor change with the concurrently published Hagatha capacity schema.
  Observer snapshots carry both flyouts and the pulse; teardown remains the
  generic secondary-world lifecycle.
- Red receipt: on detached base
  `228c1fd803feb0d2c2dfac15b69031ef269a8cf1`, the unchanged product failed only
  the new Dampen assertions: renderer birth counts were 375/390 rather than
  39, and candidate membership still included every projectile family. That
  established the pre-fix visual and gameplay defects before implementation.
- Browser diagnosis receipt: the first end-to-end candidates proved that the
  host and wire carried both flyouts plus the pulse, but the browser aborted
  their frames with `Native secondary sprite is outside the closed membership:
  BadGuys:255..266`. Adding the exact retail Firebolt rows, rather than a
  fallback, closed that renderer owner. A separate 36-tick flyout candidate
  also proved too short for the network presentation timeline; flyouts now
  share the bounded 100-tick repaired-pulse lifetime. The final smoke keeps
  these failure diagnostics and repeatedly stabilizes only fixture safety
  bodies/health while the authentic generated Arena completes its 400-tick
  seal; no product transition or hostile lifecycle is bypassed.
- Current-base integration: `origin/main` advanced through Coffin hostile
  activation, restored Archer/Arrow presentation, and replaced per-file sprite
  loading with native packed-record sampling while this work was in progress.
  The isolated patch was rebased onto
  `70c162a95f7a9933ec4172b7050da2f2e7eddb6f`; the only conflict preserved both
  Coffin rising-edge targetability and the Dampen projectile-membership test.
  The later Arrow and sampled-texture changes applied without conflict; Dampen
  records `255..266` now resolve through that packed owner. The Hagatha schema
  rebase retained both features and advanced their combined protocol to 113.
  All 16 changed files were checksum-identical in the detached Mac worktree
  `/Users/jarrett/codex-acceptance/dampen-vfx-20260830-green5-root/Website`.
- Final Mac gate: `/opt/homebrew/bin/bash ./scripts/validate.sh` passed on that
  current-base candidate after the final fixture change: backend build and 28
  contract/integration tests; lint and architecture/spec generation; every
  frontend, desktop, tutorial, mod, and protocol group; production frontend
  and game-host builds; CSP media policy; and bundle budget at 266,481 raw /
  80,994 gzip bytes. Earlier host-test timeout runs were rejected as receipts;
  inspection proved overlapping remote test trees, and the clean
  non-overlapping run passed unchanged.
- Final production Chrome receipt: WebGL2 rendered one pulse and two
  `dampened-projectile` actors, with maximum actor count 3 and maximum primitive
  count 43 (39 pulse plus two two-layer flyouts). Firebolt used
  `BadGuys:15 + BadGuys:264`; cold Guided used `BadGuys:110 + BadGuys:112`.
  Both moved 66.8 world units between sampled frames. Positive IDs 1/2 were
  removed, negative Arrow ID 3 remained, `flash` then `dampen` cues were
  published, and the `dampen` audio probe fired. Page, console, and failed
  response arrays were empty.
- Visual inspection: the current-base cancellation capture shows a compact
  gray magical cloud at the caster and separated outbound spell art, with no
  oversized white loop stack. Its SHA-256 is
  `268eb9247794377f6ccf98e16e5704e409cad25c3d733af0666466eacfd4469b`;
  the later Dampen frame is
  `fd06b8abd0cb7456cbeba1a3d5bab58dec5e28f9c2f1d9219e54e9608da6f3bd`.
- No implementation unknown remains inside the declared boundary. Git
  publication is a separate authorized receipt; a main push is not a
  deployment, and no deployment, production restart, or live-service claim is
  made here.

## 2026-09-02 — Turn Undead birth-scale domain reopening

### Reported smell and parity question

- The player supplied `SDB - Turn Undead Visual Bug.mp4` (2,603,585 bytes,
  SHA-256 `ac6143dacd41915ab93d7fb86faf071c8df9a9258bba789a4cd241ba23f6b6f8`)
  and `SDO - Turn Undead Original.mp4` (3,804,719 bytes, SHA-256
  `89f4f0143e15cb036edd6bf78778f94bb0b51448a5633ba4a1ed2a85db4c176d`).
  The Website capture is 1864x1080 for 5.013 seconds; the clean-stock capture
  is 1308x900 for 12.246 seconds. Both are H.264 at about 29.97 FPS.
- Matched 30-FPS cast sequences show the same record-48 arc, five captured
  frames of visible life, gray source-over color, and outward growth. The
  Website fans the arcs across a dense nest of separated radii; stock groups
  them into a much narrower set of coherent expanding bands.
- Falsifiers were the child count, lifetime, growth factor, alpha loss, blend,
  tint, record selection, record registration, and initial random scale domain.
  Only the scale domain differs: the Website sampled `Float(1)`, while retail
  instructions sample `Float(.5)` and then add one.
- This is a secondary report in a system previously marked closed. The earlier
  pass trusted a decompiler-level constant interpretation and did not inspect
  the raw x87 operand at the Turn Undead call site. That skipped raw-instruction
  check is the process failure reopened here.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Player comparison | the two Windows Downloads captures above; matched frames around Website 4.35--4.52 s and stock 11.18--11.35 s | Both effects occupy the same short clock, but Website arcs have the wider radial spread predicted by a doubled jitter bound. | high |
| Retail instructions | unmodified 0.72.5 `SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; preferred base `0x00400000`; helper `0x00647EF0`, instruction window `0x00648068..0x006480A4` | The scale call loads float `0.5` from `0x007DE870`, passes unsigned mode zero to `0x00401310`, adds double `1.0` from `0x007DE820`, and stores the one result into both scale axes. | high |
| Retail class lifecycle | base constructor `0x00452E20`; `Anim_FadeScale_Perspective` vtable `0x00785624`; update `0x00452ED0`; draw `0x00456340` | Birth alpha is one; constructor loss is halved to `.05`; update multiplies both axes by `1.1`; draw clamps alpha, uses normal/source-over blend, applies rotation, and applies `.8` only to Y scale. | high |
| Asset/data | BadGuys field `+0x24F8`, record 48; manifest rect `72x18` at `(1017,771)`, origin `(1,43.5)`; crop SHA-256 `ce2b3bd3a9ad81af9118c9992e6ec43573a256b49d3591fbc9de89f88342d0a0`; exact BadGuys page SHA-256 `af5717b37c81306d515eed6d9f8717fa97bd1c63b9530a7079738c457c97443e` | The arc pixels, native off-image pivot, complete-page sampling, and source registration are already exact and must not be replaced or masked. | high |
| Current Website | `native-secondary-abilities.ts` at base `8ac56e987ae98437b3e4320fc6a59672c017a08b` | Row 77 consumes the right 71 RNG words and creates the right 35 children, but uses `drawNativeFloat(state.rng, 1)`, yielding birth scales `[1,2]` instead of `[1,1.5]`. | high |
| Tool provenance | read-only Mod Loader revision `08bfba9ef367f7b863848030d0a289dc31e33192`; wrapper SHA-256 `b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`; decompiler SHA-256 `899167ca42624e09f26d22233365631a6ee8b3d106e337e20b77574894e97465`; instruction dumper SHA-256 `273f6426824849790041dcd0f7a0b25ad9e700458827f3a9db3c34ec3ad50cef` | Ghidra ran read-only through the canonical replica pool; no injected runtime address is used. | high |

### System boundary and membership inventory

Native system: **Turn Undead admission, target mutation, record-48 child
construction, shared perspective-fade lifecycle, painter registration, audio,
replication, and teardown**, including every native record-48 producer and
every `Anim_FadeScale_Perspective` construction sibling checked by the sweep.

| Member / branch | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| row-77 mana, common cooldown, row cooldown, and Cast2 admission | dispatcher `0x0054CC50` | `verified-already-at-parity` | existing admission/cooldown tests and unchanged cast path |
| Skeleton, SkeletonArcher, SkeletonMage, and Zombie target filter | helper `0x00647EF0`, types `0x3E9/0x3EA/0x3EB/0x3EE` | `verified-already-at-parity` | existing family and negative Demon regression |
| flee heading/timestamp and one-time weaken write | helper `0x00647EF0` | `verified-already-at-parity` | existing target-state and repeated-tick regressions |
| 35 Turn Undead record-48 children | `0x00647EF0`, `Anim_FadeScale_Perspective`, BadGuys `48` | `exact-ported` by this reopening | 71-word construction test with `[1,1.5]` birth-scale ceiling and browser capture |
| child update, draw, painter registration, and 20-tick teardown | `0x00452ED0/0x00456340`, world registration virtual `+0x10` | `verified-already-at-parity` | `.05` loss, `1.1` recurrence, `.8` Y perspective, normal blend, gray tint, actor-count and teardown checks |
| two `levelup` sample requests | `0x00647F6B/0x00647FBE` | `verified-already-at-parity` | pitches two then three; no Region light or screen write |
| Magic Circle record-48 producer | `0x005F3CA0`, `Anim_SpinAwayAdditive` | `verified-already-at-parity` | separate `[.975,1]` scale factor, additive blend, angular velocity, and persistent-circle tests; the Turn Undead bound does not flow here |
| TragicCircle record-48 producer | `0x005EBE20`, `Anim_SpinAway` | `out-of-system` — DireFaculty/story enemy ability is not a maintained Website actor | complete native xref is recorded; no fabricated current-scene producer |
| Dampen record-48 producer | `0x00648DF0`, `Anim_FadeAdditive_Perspective` | `verified-already-at-parity` under the 2026-08-30 crash-debt repair | separate `.75+Float(4.75)` program sampled to three bounded arcs; no shared Turn Undead bound |
| Golem record-62 perspective-scale sibling | `0x00615CD0`, same vtable | `verified-already-at-parity` | its independently authored integer scale and 180-tick quake program remain unchanged |
| common record-63 perspective-scale sibling | `0x00649D10`, same vtable; nine native callers | `verified-already-at-parity` | caller-supplied scale/life contract used by existing rain/impact families; no `0x007DE870` Turn Undead operand |
| Hub rejection, multiplayer observers, reset, and scene teardown | shared secondary authority/snapshot/world-view owners | `verified-already-at-parity` | no Hub mutation; host creates all 35 actors; observers consume snapshots; generic reset removes them |

No member is blocked by the browser platform.

### Native ownership thread and recovered behavioral contract

- Accepted row 77 calls `0x00647EF0`. The helper creates and registers all 35
  presentation actors, then applies the family-filtered hostile query and
  requests the two sounds. The Website keeps authority on the host and does not
  introduce renderer-local RNG or lifetime.
- Construction consumes `Float(360)` once for the first heading. Every child
  then consumes unsigned `Float(.5)` for scale, is born at `1+draw`, and
  consumes `Float(40)` for the next heading increment `20+draw`; the final
  increment is deliberately discarded. Total consumption remains 71 words.
- Each child uses exact BadGuys record 48, the manifest-derived off-image pivot,
  source-over blend, RGBA `(.5,.5,.5,1)`, alpha one, loss `.05`, growth `1.1`,
  and draw-time Y perspective `.8`. It retires after the twentieth update.
- The erroneous `[1,2]` birth domain widens the largest initial radius by one
  third relative to the native maximum and preserves that separation through
  every multiplicative growth tick. The corrected `[1,1.5]` domain lets the 35
  rotated arc segments overlap into the narrow coherent bands visible in the
  stock capture; child count, asset, anchor, and blend stay unchanged.
- Magic Circle, TragicCircle, and Dampen share record 48 but not this constructor
  argument. Golem and the record-63 helper share the class but not this call-site
  scale draw. The falsified constant therefore changes row 77 only.

### Nearby-system findings

- The tan straight segments visible before and during the Website cast are
  already-live Arrow projectiles held through the resume sequence. They are not
  record-48 pixels and are outside this Turn Undead correction.
- The Website's exact reconstructed BadGuys page, native UV endpoints, record
  pivot, normal blend, tint, and fixed-tick lifetime all predict the stock
  effect once the constructor domain is corrected. No texture replacement,
  clipping mask, opacity reduction, or child-count approximation is justified.

### Confidence and open questions

- Confirmed: capture mismatch; raw `.5` operand and added one; complete 35-child
  count; 71-word order; record/pivot; class lifecycle; blend/tint; record-48
  producers; perspective-scale constructor siblings; Website divergence.
- Inferred: none inside the implementation boundary.
- Unknown: none. The browser exposes every required transform and blend.

### Web implementation consequence

- Change the row-77 scale RNG bound from `1` to `.5` in the authoritative
  secondary kernel. Keep the returned RNG state and every later draw unchanged.
- Strengthen the existing construction regression to pin the first two exact
  scales and the complete 35-child `[1,1.5]` domain while retaining the 71-word
  terminal state.
- Do not alter record 48, `native-secondary-presentation.ts`, Magic Circle,
  Dampen, Arrow, protocol schema, audio, target mechanics, or painter order.

### Validation contract

- Red/green focused test on the Mac mini: the unchanged row-77 implementation
  must fail the `.5`-bound expected scales; the corrected implementation must
  pass exact first/second scales, all 35 bounds, and terminal RNG state.
- Run the renderer/secondary focused tests and the complete
  `/opt/homebrew/bin/bash ./scripts/validate.sh` gate on the exact Mac candidate.
- In Mac hardware Chrome, cast only Turn Undead in a real Boneyard scene. Require
  35 host-owned/replicated children, record-48 primitives during the five-frame
  visual window, two `level-up` cues, no Region flash, complete teardown, and
  empty page/console/failed-response arrays. Inspect the captured cast frame
  against the supplied stock sequence: narrow overlapping expanding bands,
  without the Website's former separated loop nest.

### Implementation validation receipt

- Implementation: row 77 now draws its second RNG word from the exact `.5`
  domain. The existing 35 actor births, 71-word terminal state, headings,
  growth, loss, art, blend, tint, authority, target mechanics, audio, protocol,
  painter order, and teardown are unchanged. The strengthened regression pins
  the first two exact scales and every child's inclusive `[1,1.5]` range.
- Red receipt: on detached current-main base
  `8efce567d5fb88506580a78bdd181b1407c0e8fb`, the Mac focused file passed 90
  tests and failed only the new Turn Undead assertion. The first child was
  `1.3102700114250183` under the old bound instead of native
  `1.1551350057125092`.
- Green focused receipt: the same Mac worktree with the one-line kernel fix
  passed all 132 combined secondary-kernel and renderer tests. Magic Circle,
  Dampen, Golem record 62, weather/impact record 63, and every other closed
  secondary member remained green.
- Mac hardware-Chrome receipt: WebGL2 completed a natural Boneyard row-77 cast
  with 35 authoritative actors, 35 simultaneous record-48 primitives, 14
  observed animation ticks, exactly two `level-up` cues, no Region flash, and
  empty page, console, and failed-response arrays. The inspected corrected cast
  frame shows the 35 arcs confined to overlapping bands rather than the former
  wide separated nest; its SHA-256 is
  `acd1d2672f7d9e62ba857ff5901151208d4ecf44c6ab41516bc982e535b5230b`.
- Pre-receipt complete Mac gate: `/opt/homebrew/bin/bash ./scripts/validate.sh`
  passed the implementation candidate. It built the backend, passed 19 Python
  contracts/integration tests and 2,580 Node tests with zero failures, passed
  lint/boundaries/generated-spec checks, desktop tests, production frontend and
  game-host builds, media/CSP policy, and the bundle budget at 265,203 raw /
  80,814 gzip bytes. The 17,522-line gate log SHA-256 is
  `1dd25747023b4730b0a9e31ef9a6a2d9a80890307eef601481baef2456075b69`.
- A final exact-tree Mac gate follows this docs-only receipt update and is the
  handoff acceptance. Git publication and deployment remain separate and were
  not authorized by this report.

## 2026-09-02 — Phasing traversal-blip pixel reopening

### Reported smell and parity question

- Reported web behavior: a successful Phasing cast is missing the stock purple
  blip. The user supplied `SDO - Correct Phasing.mp4` as the original-version
  visual reference.
- Stock behavior to recover: successful row-15 traversal must paint its one
  heading-aligned magenta BadGuys-53 streak at the old position plus ten world
  units along the accepted path, with the `phase` cue, relocation, and exact
  twenty-tick retirement but no Region screen flash.
- Reproduction inputs/scenes: learn/equip Phasing, enter a generated Boneyard,
  stop on a collision-clear heading, cast through the ordinary category-2
  input edge, and inspect every presented frame from acceptance through actor
  retirement. Repeat with the default screen-flash setting and the optional
  reduced-flash browser extension to prove neither branch invents a Phasing
  overlay.
- Falsifiers: a pixel-visible magenta BadGuys-53 streak with no screen overlay
  on current `origin/main` would make this only an observation-timing problem;
  a missing semantic actor would move the defect back to host/wire ownership;
  any native instruction between dispatcher case 15 and retirement that writes
  Region feedback would preserve rather than remove the current web overlay.

This is a process-failure reopen of the earlier `exact-ported` presentation
claim. The prior acceptance proved a `phase-burst` actor, one renderer
primitive, audio, flash, and geometry, but never asserted that the primitive
produced the distinctive BadGuys-53 pixels during its short visible lifetime.
Its saved screenshot was not tied to a named actor age or a stock-versus-web
pixel criterion. Semantic existence was incorrectly treated as visual proof.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| User-supplied original capture | `/mnt/c/Users/User/Downloads/SDO - Correct Phasing.mp4`; SHA-256 `33a81d90726bafb671939132752056c5b4b735d01a988b32061eb0ae241dc221`; H.264 1600 x 900 at 30000/1001 fps; 15.982633 s | Exact audio correlation finds accepted `phase` samples at about 5.6615, 9.3315, and 14.8415 seconds. Matching frames stay dark and show a bright, heading-aligned magenta streak/blip behind the newly centered wizard; there is no cyan full-screen wash. | high for appearance and lifecycle; medium for executable provenance because the capture itself does not expose the running image hash |
| Authored asset/manifest | Website `frontend/src/assets/game/boneyard/badguys/0053.png`; SHA-256 `baf5c0c622972949604ba84525c0b76f6c31bbcab10fa910894ccd96e15b30ff`; `badguys.json` record 53 | The exact stock-framed member is a 28 x 58 magenta traversal glyph with origin `(0,0)`. The packed combat atlas retains the same logical 28 x 58 frame. | high |
| Retail identity | `SolomonDark.exe` 0.72.5, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | The local retail image still matches the established secondary-system oracle. | high |
| Fresh instructions | canonical Ghidra 12.0.3 read-only replica 3; dispatcher `0x0054CC50` around call `0x0054DA15`; relocation helper `0x0052A0B0`; sole-caller effect helper `0x0063FEE0`; Anim constructor/update/draw `0x00452E20/0x00454000/0x004560A0`; Region-effect registration `0x0063E5E0` | Case 15 calls only the relocation helper. On success it creates one `Anim_FadeAdditive`, binds `BadGuys[53]`, writes alpha and X/Y scale `2`, registers with sort bias `15`, computes point-audio gain through Region vtable `+0x100`, and calls audio path `0x00407B70`. No Region screen-feedback setter is called. | high |
| Region write census | direct xrefs to `0x00448600`: ten total; dispatcher callsites `0x0054CDAB`, `0x0054D8B5`, `0x0054DF84`, `0x0054F6E0`, `0x0054FF5E`, `0x0055002D` | The Phasing case at `0x0054D9A1..0x0054DA1F` has no direct or inlined Region write. The prior census mistook point-audio gain for screen feedback. | high |
| Static constants | `0x007DE810=10.0` double, `0x007852D0=7.0` double, `0x007DE9D0=2.0f`, `0x007845E8=.1f`, `0x00784998=15.0f` | Probes begin at 80; marker offset is 10; alpha/scale are two; fade loss is `.1`; ZAnim sort bias is 15. | high |
| Current Website causal trace | `origin/main` `8ac56e987ae98437b3e4320fc6a59672c017a08b`; `native-secondary-abilities.ts`, `native-secondary-presentation.ts`, `native-secondary-world-view.ts`, packed combat atlas | Host state creates one 20-tick `phase-burst`; the plan names BadGuys 53/additive/scale two and the shared renderer reports one primitive. Existing coverage stops before framebuffer pixels. | high |
| Mac baseline | detached Mac worktree at the exact SHA above; hardware Chrome WebGL2; `smoke-secondary-abilities.mjs` row 15; actor-age-7 capture SHA-256 `70053c91f5ce0b0aeff82179e337d2c6055c74acf9f7341aed07f13953bbd2a2` | Host/wire/browser diagnostics observe the actor and one primitive. At age seven, the invented cyan Region overlay remains about `.825` and turns the expected magenta glyph into a barely distinguishable cyan ghost. The stock frame at the same phase stays dark with a bright magenta glyph. | high |

The canonical wrapper was invoked through the absolute Windows PowerShell path
because it is not on this shell's `PATH`. It leased replica 3 read-only with
wrapper SHA-256 `b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`
and tool revision `08bfba9ef367f7b863848030d0a289dc31e33192`; no canonical project,
Mod Loader file, or replica lock was changed.

### System boundary and membership inventory

Native system: **Phasing row-15 successful-traversal presentation**, from the
accepted heading/collision probe through semantic actor registration, packed
record sampling, painter/Region ordering, observer presentation, and exact
retirement.

| Member / branch | Native source | Disposition in this reopening | Proof |
| --- | --- | --- | --- |
| heading-owned 80..270 relocation | `0x0054CC50 -> 0x0052A0B0` | `verified-already-at-parity` | retained orthogonal aim/heading differential |
| all twenty probes blocked | `0x0052A0B0` failure branch | `verified-already-at-parity` | debit/cooldown without actor, cue, or flash |
| successful semantic actor birth | helper success branch; one BadGuys-53 `Anim_FadeAdditive` | `verified-already-at-parity` for host/wire identity | exactly one row-15 actor at source plus heading times ten |
| BadGuys record 53 source and packed frame | `BadGuys[53]`, 28 x 58, origin `(0,0)` | `exact-ported` | source/packed-frame pixel equivalence plus rendered-pixel assertion |
| additive draw, heading rotation, scale two | `0x0063FEE0`, draw `0x004560A0` | `exact-ported` | actor-age-bound framebuffer crop matches the magenta glyph footprint |
| alpha two, draw clamp one, loss `.1`, twenty ticks | constructor/update/draw `0x00452E20/0x00454000/0x004560A0` | `exact-ported` | ages 0..10 stay fully bright, ages 11..19 fade, update 20 retires |
| transient-manager painter registration and sort bias 15 | `0x0063FEE0 -> 0x0063E5E0`, constant `0x00784998` | `exact-ported` | sprite remains visible at its world marker with nearby dynamic actors |
| absence of Region flash | dispatcher case 15 and sole helper/callee census | `exact-ported` | no screen-feedback event or full-screen color appears on success or failure |
| reduced-screen-flash preference | Website accessibility extension | `out-of-system` for Phasing because there is no native Region write to reduce | both setting branches retain the same world sprite and no overlay |
| `phase` point cue | helper success branch | `verified-already-at-parity` | one accepted-success request and none on blocked traversal |
| authoritative owner and observer snapshots | semantic actor/event wire | `verified-already-at-parity` | protocol carries the same actor ID, marker, age, and draw state to the shared renderer; the owner browser proves its pixels |
| Boneyard generated arenas | live combat scene | `exact-ported` | normal-input hardware-Chrome journey with exact-frame pixels |
| Hub Courtyard/private rooms | shared-Hub combat seal | `out-of-system` because category-2 casts are rejected before Phasing | retained no-spend/no-effect Hub contract |
| primary Ether pierce use of BadGuys 53 | separate Magic Missile contact family | `out-of-system`; shared packed-frame sampling must not regress | retained primary presentation contract |
| other 22 category-2 rows | dispatcher membership | `out-of-system`; they retain their recovered actor/self/area owners | closed 23-row regression stays green |
| death, disconnect, run replacement, reset | shared secondary-world teardown | `verified-already-at-parity` | no retained row-15 actor or replayed cue/flash |

No member is blocked by the browser platform.

### Native ownership thread and recovered behavioral contract

- The authoritative helper commits relocation first and creates a separate
  transient presentation object only on success. The sprite is not inferred
  from the position jump and is not a Teleport-style source/destination pair.
- The actor uses the exact BadGuys-53 raster, additive blend, scale `(2,2)`,
  and heading alignment. Its root is `oldPosition + heading * 10`; after the
  camera follows the destination, the blip therefore appears behind the
  player by `acceptedDistance - 10` world units.
- Alpha starts at two, is clamped to one for draw, loses float32 `.1` once per
  100 Hz native update, and retires after twenty updates. There is no Phasing
  Region screen state; the point-gain virtual is consumed only by audio.
- Host position, actor birth/age, event order, cue, and teardown remain
  authoritative. Rendering owns only atlas sampling, interpolation-free fixed
  actor state, painter placement, and blend; unrelated Region overlays remain
  a separate renderer owner.

### Confidence and open questions

- Confirmed: stock-visible magenta glyph; exact tracked record and dimensions;
  sole native helper/caller; alpha/scale/loss/sort constants; current host/wire
  actor; current WebGL primitive; invented web-only Region flash; incorrect web
  alpha curve and missing sort bias.
- No native data remains to approximate and no material unknown remains inside
  the declared boundary.

### Web implementation consequence

- Keep relocation, collision, mana, cooldown, cue, and the exact raster recipe
  in their current cohesive owners. Remove the invented row-15 Region flash.
- Start the phase actor at alpha two, retain `.1` fixed-tick loss and the native
  draw clamp, and give its ZAnim painter the recovered sort bias 15.
- Add an actor-age-bound renderer/browser assertion that proves magenta pixels
  at the projected world marker; actor kind and primitive count alone are no
  longer acceptable evidence for short-lived effects.
- Preserve packed record sampling and the separate primary-pierce BadGuys-53
  path; neither is the defect. Do not add a row-15 overlay or duplicate sprite.

### Validation contract

- Focused kernel/presentation tests retain one successful actor, zero blocked
  actors, exact record 53/additive/scale/rotation, alpha-two/.1-loss/clamp-one
  curve, sort bias 15, no Region flash, and twenty-tick retirement.
- A red/green Mac Chrome probe captures an early Phasing actor age before the
  screenshot harness advances past retirement. It projects the semantic marker
  into screen space and requires a magenta-dominant footprint of the expected
  scaled glyph size in default stock mode. The existing reduced-flash setting
  contracts prove that branch only scales a present Region overlay and cannot
  create one for Phasing.
- The same owner journey plus protocol/renderer contracts check exact
  destination/marker geometry, one cue, zero Region flashes, cooldown,
  observer-equivalent actor state, and absence after retirement, with empty
  page, console, host, protocol, and failed-response lanes.
- Run the closed 23-member focused suites and
  `/opt/homebrew/bin/bash ./scripts/validate.sh` on the exact Mac candidate.

### Implementation validation receipt

- Implementation: `native-secondary-abilities.ts` no longer emits the invented
  row-15 Region flash. Its one `phase-burst` now starts at alpha two and loses
  float32 `.1` per 100 Hz update. `native-secondary-presentation.ts` clamps the
  draw alpha to one and registers the ZAnim with native sort bias 15. Position,
  heading, collision, twenty-tick lifetime, cooldown, cue, packed record 53,
  protocol identity, and teardown are otherwise unchanged.
- Durable coverage: the kernel test now excludes Phasing from the complete
  23-row Region-writer matrix and locks alpha/loss/retirement; the renderer test
  locks record 53, additive blend, rotation, scale, draw clamp, sort bias, and
  fading alpha. The focused browser harness pins a deterministic valid
  Boneyard, captures before retirement, projects the semantic marker, measures
  magenta pixels, requires flash alpha zero, and retains the ordinary heading,
  cue, cooldown, wire, and error checks.
- Red Mac receipt on the untouched implementation: the focused pair ran
  131/133. Kernel row 15 produced alpha one instead of two; the renderer passed
  alpha two through unclamped and returned sort bias zero instead of 15. The
  earlier hardware-Chrome age-seven frame contained the actor/primitive but the
  `.825` cyan web overlay reduced the magenta streak to a pale cyan ghost;
  capture SHA-256
  `70053c91f5ce0b0aeff82179e337d2c6055c74acf9f7341aed07f13953bbd2a2`.
- Initial validation-base integration: `origin/main` advanced by two unrelated
  commits during investigation. The isolated branch rebased cleanly onto
  `f03d1d3a2cb9b5643476b32fa807f0c426822566`; all eight changed files were
  SHA-256-identical in detached Mac worktree
  `/Users/jarrett/codex-acceptance/phasing-blip-20260902-current` before those
  gates.
- Focused Mac green: the kernel and renderer pair passed 133/133. Hardware
  Chrome WebGL2 then cast Phasing through normal input with heading north and
  retained aim east. Source `(1050.7149658203125,2007.2149915769696)` moved
  exactly 80 north to `(1050.7149658203125,1927.2149915769696)`; the actor
  marker was exactly ten north of source at
  `(1050.7149658203125,1997.2149658203125)`. At age eight the actor retained
  alpha `1.1999998092651367`, the draw had zero screen-flash alpha, and the
  projected 180 x 180 marker crop contained 1,505 magenta-dominant pixels.
  One `phase` cue, one actor kind, one primitive, 78 presented ticks overall,
  and empty page/console/failed-response arrays were recorded. Crop SHA-256 is
  `2267fcbbed5837d11c676a424f544eded27128559ca417d05cf2f5995f6c2a73`;
  structured receipt SHA-256 is
  `c55d688fafba384aee056d22674202b3c32c748d70284ff29725d83c0153df01`.
- Canonical Mac gate: `/opt/homebrew/bin/bash ./scripts/validate.sh` exited zero
  on the exact current-base candidate. Backend Release build and 19 contracts,
  every frontend/desktop group (2,586 tests total), lint/boundary/generated
  checks, production frontend and game-host builds, bundle budget, and media
  policy passed. The Game entry is 265,203 raw / 80,825 gzip bytes. Gate log
  SHA-256 is
  `c083a23a46ce30738247bcf8347e44a9e7142e3e7fc54dac8dd990df33395b72`.
- Two browser attempts were rejected before Phasing because an unrelated live
  generated-wave path threw `no dark collision-safe spawn placement`. The
  final proof uses the repository's established all-zero deterministic
  Boneyard seed and changes no product spawn behavior.
- Publication-base integration: after push authorization, `origin/main`
  advanced again to Turn Undead commit
  `84ec6244e04303e1546c2796e06fab1a829fbb7b`. Kernel/test changes merged
  automatically. The sole ledger conflict was resolved by preserving the
  complete Turn Undead reopening first and the complete Phasing reopening
  second; normalized section hashes match both source stages exactly. The
  subsequent Seeker's Charm commit
  `b6e9c6bafe30ca1d5c7dab72697a2268cfc9cd43` rebased without conflict. This
  tree owns the recorded publication-step proof below. While that receipt was
  being recorded, the already-running native plane-portal publication advanced
  `origin/main` to `2922d56c1e934d9ce59239e4fe2457cef332a88d`; Phasing then rebased over
  it without conflict. That final fast-forward candidate owns the newest-base
  proof below.
- Publication-base revalidation: the focused kernel/renderer pair passed
  133/133 on the byte-identical detached Mac candidate. Hardware Chrome WebGL2
  repeated the ordinary-input cast with exact 80-unit north displacement and
  the marker ten units north of source. At actor age ten, alpha was
  `0.9999997615814209`, screen-flash alpha was zero, and the projected crop
  contained 2,121 magenta-dominant pixels. One `phase` cue, one actor/primitive,
  74 presented ticks overall, and empty page/console/failed-response arrays
  remained. Crop SHA-256 is
  `2c47fc8010c5419a0aac815c5689d2b944f3fe66c99293c5b9cd079767cf55fc`;
  structured receipt SHA-256 is
  `151ac3783667e5a2ef0d2d909e339771792e517d6d02202dcd7ef35f2874d687`.
  The complete Mac gate then passed 19 backend contracts and all 2,588
  frontend/desktop tests, lint/boundary/generated checks, both production
  builds, media policy, and a 265,203-raw / 80,817-gzip Game bundle. Gate log
  SHA-256 is
  `2b4ff304e195db465daad9821e84192910c8b8ea8578a759c1f6dc13c21acd6a`.
- Final publication-base revalidation: on top of plane-portal commit
  `2922d56c1e934d9ce59239e4fe2457cef332a88d`, the focused pair again passed
  133/133. Hardware Chrome WebGL2 repeated the exact 80-unit north cast and
  ten-unit marker. At age nine the actor held alpha `1.0999997854232788`, the
  screen-flash alpha remained zero, and the crop contained 1,897
  magenta-dominant pixels. One cue, one actor/primitive, 75 presented ticks,
  and empty page/console/failed-response arrays remained. Crop SHA-256 is
  `a1288bbd4764da4b9a956377090ee1076630108ba6c39df04fd3f4217be7b704`;
  structured receipt SHA-256 is
  `ca070fb2106166ba4b9a6d3642ee5c789ec7eb2e16b3a2107e45b7c71064a1aa`.
  The complete gate again passed 19 backend contracts, all 2,588
  frontend/desktop tests, lint/boundary/generated checks, both production
  builds, media policy, and a 265,203-raw / 80,820-gzip Game bundle. Gate log
  SHA-256 is
  `a705c1d50a91052b69ade4416e409c93be27eeaa5e6b06b3d888d30eb4c56d8d`.
- No member is blocked by the browser platform and no material implementation
  unknown remains. The initial focused commit was local and unpushed at the end
  of the implementation pass; deployment and production restart remain
  separate operations.
