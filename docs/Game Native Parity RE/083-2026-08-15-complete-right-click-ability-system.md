# 2026-08-15 — Complete right-click ability system

## 2026-10-06 — Report 90: Iron Golem reflection multiplier wire domain

Report 90 reopens the Golem projection boundary. Earlier summon/contact recovery
correctly modeled a damage multiplier but the wire decoder incorrectly treated
it as a probability. The original message 1555582144053518459 is unchanged;
its screenshot names `golem.reflectFactor must be between zero and one`.
Six read-only production diagnostic records on 2026-10-02, protocol 143, confirm
the same failure class, including `d112b9d2-bea2-4b2b-8596-7014be509953`
at 14:06:02.951Z. Its same-session performance companion
`35d8d7e1-f132-4d4d-af2c-5abded6e1757` pins deployed revision `a8480b82`.
That historical revision already has the same `mReflect/100` producer and
`unitInterval` decoder, establishing the mismatch at the recorded failure.
The original failing frame/rank is unavailable.

Existing native evidence: Raise Golem branch `0x0054CC50` creates factory `0x7F4`;
learned Iron Golem 75 writes byte +0x210 and `mReflect/100` to +0x214. Contact
`0x00607F60` reflects physical incoming primary damage multiplied by +0x214
to a qualifying nearby actor source after age 400. The complete checked-in
native skill catalog row 75 is `mReflect = [0,25,50,75,100,125,150,175,250]`,
ranks 0..8; the legal stock factors are 0/.25/.5/.75/1/1.25/1.5/1.75/2.5.
These are retained extraction facts, not a new binary extraction. The current
authority in `game-simulation.ts` already divides the effective value by100,
and Golem construction/contact preserve it. The contradiction is confined to
the `unitInterval` decoder.

Boundary: Golem birth and lifetime state through secondary-actor projection,
welcome/full/incremental decode and save hydration. Physical reflection
ownership, assembly timing, contact eligibility, visuals/audio and cap rules
remain as recovered above.

| Member | Disposition before execution | Required proof |
| --- | --- | --- |
| Iron Golem 75 ranks 0..8 | recovered-pending-port | all nine authored factors survive actual summon-to-snapshot decode; factors above 1 retain their damage multiplier |
| Ordinary/iron summon, assembly/active/attack/provoke, one/two-Golem caps | verified-already-at-parity producers | existing Golem/secondary world tests; no lifecycle or painter changes |
| Physical reflection versus magic channel; near/source flag; age 400/death | verified-already-at-parity | existing native Golem/contact tests retain physical-only damage scaling |
| Player and observer full/incremental frames and save-derived snapshots | recovered-pending-port | same canonical secondary actor decoder; malformed negative/nonfinite factors still reject |

Implementation consequence: use existing `nonnegativeFinite` for reflectFactor,
as for the other damage scalars; preserve `unitInterval` for limb progress.
Do not clamp factors to 1 or change the authored ranks. Confidence is high for
the native/producer/decoder contradiction; original effective rank is unknown.
No browser constraint prevents exact admission. Record final dispositions and
M5/browser evidence after execution.

## 2026-09-30 — Conditional suppression survives anchor expiry

Task `87f1ead8` closeout review identified and reproduced one missed retirement
case in the approved shared timeline. Unconditional cyan100 suppresses
conditional black150. At202 the cyan fade is clear, but deleting its anchor
while retaining the conditional attempt let black reappear at203 with alpha
`.4700005054473877`. Both single admission and repeated canonical consumption
failed the public regression on published `b48`; its preceding acceptance remains
a dated valid receipt for the cases it covered.

The observer now retains the latest unconditional anchor after fade expiry.
It removes only its superseded predecessors, so every retained conditional
attempt is still evaluated at its original tick against its suppressing history.
This also preserves the earlier contract allowing late history to correct a
conditional-only provisional display. A later unconditional write still moves
the retirement watermark; source gain, float aging, reset and future eligibility
are unchanged. No protocol/save/producer/Ring/art/compositor changes are needed.

The current only-if-clear producer is Ultra Banish. Its normal birth in
`demon-skull-death.ts` also emits an unconditional flash, and the spell has
150/2000 remaining ticks. Conditional attempts are bounded by that finite spell
(one maximum per tick) and a subsequent unconditional anchor trims earlier
history. An old-schema restore can continue a conditional-only tail, also finite.
Arbitrary synthetic conditional-only histories remain retained for late-history
correction until a later unconditional write/reset; adding a timeout/cap would
change that contract. This correction adds one required anchor, rather than a
new indefinitely growing producer. Existing author history pruning already
retains that anchor. Supplemental exact M5 gate/browser/GPU, publication and
cleanup are recorded in REPORT-retirement-review.md and its compact receipts.


## 2026-09-29 — Approved shared flash authority and presentation repair

The user approved the concrete ordering/timing remedy for task `87f1ead8`.
`core-kernels/native-screen-flash.ts` now owns an immutable authority journal:
reset epoch, next execution order, and ordered tick/world/position/RGBA/loss/
conditional-write inputs. Actual writer execution allocates the order. This is
independent of secondary event IDs, enemy event IDs, primary actor IDs, packet
grouping and painter-registration order. No source-family precedence is inferred.

Closed current writer membership:

| Family | Actual write boundary and coverage |
| --- | --- |
| Secondary factories, cast/actor pulses and impacts | All 22 direct flash emissions call the canonical writer at `emitNativeSecondaryEvent`, through the existing tick/cast context. Includes fire, magic circle/trap, shield apply/explode, Mindstar, Planes/Planewalker/orb, both Rings, Stoneskin, both Teleport writes, Earthquake, Comet and Flash response. |
| Player contacts and poison | Shield explosion, reflected/player Flash response and Pike break pass the same transaction writer. Harden and other camera/audio-only events do not write a screen flash. |
| Enemy writes | `enemies/events.ts::emitEvent` admits Faculty death, Heartmonger Crow strike, boss spell impact, Demon Skull flash/death and conditional Ultra Banish in actual execution order. |
| Primary | Ether Blast writes at its actual birth, preserving point gain and `.025` loss; its particle lifetime no longer owns flash retention. Meteor and weld-flight feedback remain camera-only. |

`renderer/native-screen-flash.ts` consumes that one lane at the observer's
presentation tick. Future writes wait; eligible writes replay in authority order,
including the native only-if-clear predicate. A later overwrite, even with zero
observer gain or an expired alpha, prevents an old delivery from resurrecting.
Gain freezes on eligibility; aging uses the existing repeated float32 subtract
and clamp. Authoritative history retains per-world unconditional anchors for
conditional writes and interpolation; observer history drops superseded writes.
World resets advance an epoch and clear old lane state. Boneyard, courtyard and
all private Hub regions use this owner. Existing camera arbitration and final
reduced-flash alpha scaling remain in their existing owners.

Protocol `142` carries the journal through ordinary snapshot frames and entity
materialization. Interpolation admits the newer journal but eligibility uses the
sampled presentation clock. Save schema `47` preserves and validates epoch,
execution order, snapshot time and authored input values. Older saves start with
an empty transient flash lane because their independent IDs cannot recover
cross-family execution history. They retain their gameplay and visible actors.

Public regressions cover grouping/intake reversal, future/paused ticks,
same-tick actual Faculty/Ring writes, duplicates, late-old expiration,
conditional writes, zero gain, reset epochs, current/legacy save and wire trust,
and Ether Blast's actual birth. The existing all-secondary Inventory journey
asserts every flash-producing row's journal admission. Built acceptance uses
actual Ring and Faculty emitters on normal host/WebSocket/materializer/timeline
plumbing, with synchronous `readPixels` immediately after the actual render.
Exact final gate/browser/publication/cleanup receipts belong to this task's
implementation report; earlier membership and investigation receipts below
remain historical.

Ring's three edges, ground circle, snow branch, authored colors and lifetime
programs are unchanged. This repair does not reproduce the historical clip,
identify its exact blackout writer/sampler, force Ring black, or copy the native
texture-state quirk. The separately archived Ether Drain Report66 remains open;
bundled message `1554348964122202142` is not a whole-message completion target
until that independent issue is resolved.


## 2026-09-29 — Report20 shared flash consumer investigation, remedy pending

Task `87f1ead8` rechecked the actual consumer rather than treating producer
RGB as final screen color. Retail 0.72.5 SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`,
preferred base `00400000`, was decoded on M5 through installed LLVM tools.
The ordered trace is: four-float copy `0040F9E0`; shared overwrite helper
`00448600` / inline writers into Region `+8E14..+8E24`; repeated alpha
subtraction at `0063F255`; Arena positive-alpha branch `004701C5`; RGBA
setter `0041FE50` called at `00470230`; filled rectangle `0041DD70` at
`00470279`; white restoration at `0047029E`. The rectangle appends the
current packed color through `0041C6A0`. This follows world/light/queue
painting and precedes later player overlays and the HUD.

The consumer has an additional material input. Graphics `+2AC` and current
texture `+2A4` control whether the rectangle retains a valid texture and
uses the UV center of its texture-object quad (`0041C460`), or uses the
unbound/zero-UV path. The Arena sets saturation float32 `.65`; embedded
shader at `007DDB38` samples sampler0, multiplies its RGB by vertex RGB and
its alpha by vertex alpha. Blend dispatcher `004208A0` retains selectors
zero `SRCALPHA/INVSRCALPHA`, one `SRCALPHA/ONE`, two `ZERO/SRCCOLOR`.
Thus a cyan producer is not proof of cyan final pixels. Unbound ps2.0
sampling is opaque black in Wine's native-compatibility
`dlls/d3d9/tests/visual.c::unbound_sampler_test`; no Wine/Windows code was
executed. The original clip's actual sampler, latest writer and complete
render state are not identified, so a null/stale-texture explanation is
conditional, not an established Ring-specific bug.

The current web has a separately proved temporal defect. Boneyard renderer
consumes queued enemy events, then secondary events, then primary feedback.
`NativeSecondaryScreenFeedbackPresentation` deduplicates within each lane
but lets an older write from another lane replace a newer write. A valid
Ring write at tick100 and black enemy write at tick101 produce cyan at
sample105 when received together; the identical inputs received in separate
frames produce black. Native four-float chronological storage keeps the
newer black write. The renderer also applies a queued future enemy write
before the sampled presentation tick in the controlled probe.

An M5 controlled WebGL2 diagnostic used the unchanged public feedback class,
the exact installed fixed-function/Arena pipelines and current flash
geometry. Synchronous `render` plus `readPixels` gave `[225,242,242,255]`
for one-batch ordering and `[1,2,3,255]` for the separate/chronological state
on the same background. Browser and GL error arrays were empty. This
demonstrates a real shared presentation defect independently of the
historical clip, not a replay of that clip or a fresh retail recording.

The proposed remedy is one presentation-clock-ordered flash write path
across secondary, enemy and primary writers, with actual authoritative
ordering for same-tick ties. Older or future writes must not win by category
or packet grouping. Preserve source RGB, trigger-time point gain, float32
loss, world identity, ordered overwrite, reduced-flash adaptation and all
Ring/Comet children/lifetimes. Do not fabricate more rings or force a black
overlay. No product implementation, protocol change, full gate, publication
or reaction occurred. User approval of the proved ordering remedy remains
required under the Report20 discrepancy hold. Exact clip attribution and
native sampler-state parity remain qualified open evidence.

The literal alpha-offset census found39 stores plus10 direct calls to the
common helper; the private receipt preserves preferred addresses/contexts.
These are investigation findings, not a new blanket closure of every writer.
All secondary writer rows below and enemy/primary/shared consumer paths are
the affected membership if the remedy is approved. Shared display changes
do not implement the separate Ether Drain gameplay allegations.

> **2026-09-24 correction — report 20:** historical Ring/Comet/Frost Missile
> Iceblast references to DeadHawg records 114/121 below are superseded by
> [ledger 084](084-2026-08-20-secondary-ability-native-ownership-correction.md).
> Fresh builder tracing proves inline fields +0C78/+0D3C bind records **16/17**;
> 114..144 is a different compact-decoration array. The Ring now separates
> background ice, direct additive bursts and fixed-root ZAnim snow, with the
> native float32 child clocks. Original historical receipts are retained, not
> evidence that the old artwork mapping was correct.


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
| `51` Dampen | Caster rectangle dispels shields on `RandomInt(100) < 0x33` (51/100 outcomes despite the 50% UI text) and appends mode-21 CastSpin for 73 strict-boundary ticks plus the shared weapon-selected Cast2 action. See the September 20 branch correction in entry 278. | 360 independently moving/fading BadGuys `10/11` rays plus 30 centered perspective `48` fades; `flash`, `dampen` stream. | exact-ported |
| `54` Magic Shield | Player-owned absorb state owns a 40-tick shell pulse. Break emits 20 particles and, when upgraded, applies one full `absorb*mDamage/100` contact over radius 110 plus a zero-damage Dazzle/push Shockwave, then clears both factors. | Clothes `2`, BadGuys `68,15,158..167,17,74`, DeadHawg `18`; exact up/hit/pop/explode sequence, 502-word explosion program, Region flash, and 1.25 camera pulse. | exact-ported |
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

**2026-09-19 correction:** the complete sine-fade sibling trace in entry 091
reopens the dust's first sample and painter owner. Raw `0x00613848` installs
the same `Anim_FadeSin_Move` vtable `0x00786B34` as Zombie gas;
`0x0061385D..0x00613863` installs phase speed `.5`, and
`0x006139D2..0x006139E5` appends it directly to `Region+0x278`.
That manager ticks later in the same Region update. Its first visible phase
is therefore `.5` degrees, opacity is `sin(.5 degrees) * quantity`, and its
position already includes one velocity step. The former constructor-alpha-one
sample and `zanim` main-queue presentation were incorrect. Use the existing
direct pre-world underlay path, before Region multiplication; no world-queue
submission is needed for this dust. Earthquake's record-62 Quake and lit
BoulderBit children are separate native classes and retain their own owners.

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
star. Their constructor advances the host stream once; each Bouncer then owns
mutable motion/life and an independent painter root. A renderer constructor
replay cannot represent field displacement or consumption (Report66 cutover below).

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
  other airborne updates rotate and subtract `0.015` life. Once settled, life
  decays every tick without motion/contact RNG. These actors and the two impact fades survive the
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
the presentation owner: additive Clothes `2` stays attached at `y-35`, scale
`2.1500000953674316`, with white tint and resting alpha `.25`. An absorbed hit
drives the recovered 40-tick alpha/sine-scale pulse. The September 4 reopening
below supersedes the earlier enemy-shell asset/geometry and RGB interpretation.
Break callback `0x00546650` consumes three words for each of 20
additive BadGuys `68` children: `Float(360)` rotation, `.5+Float(.75)` alpha,
and `2+Float(.25)` scale. They spawn at `y-35`, lose `.05` alpha per tick,
and account for an exact 60-word prefix.

When Explosive Shield is installed, helper `0x00648790` then registers one
normal scale-12 BadGuys `15` fade at `y-25`, one additive Clothes `2`
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


## 2026-09-04 — Magic Shield player-shell and shared ring-asset reopening

### Report and earlier closure failure

Soggy's supplied `SD shield original - image.png` and
`SD shield web - image.png` show a broad, faint stock shell versus a compact,
bright cyan web shell. The earlier closure copied the enemy-shell geometry and
asset into the player painter and mistook the fourth color argument (alpha)
for the red channel. Its test repeated those assumptions and its browser gate
only required a visible shell with scale at least 1.5. It did not verify the
sprite-register argument or actual opacity. This reopening replaces those
claims for the entire player-shell family and the shared Clothes-2 consumers.

### Evidence and provenance

- Fresh retail binary: 0.72.5, 4,723,200 bytes, SHA-256
  `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`,
  preferred base `0x00400000`. No injected process or stale runtime address is
  used. The user supplied the visual comparisons; their capture settings and
  exact frame phase are not known, so instructions and asset bytes determine
  numerical values.
- Ghidra 12.0.3, canonical `SolomonDark/SolomonDark.exe`, read-only replicas
  acquired through the existing Mod Loader wrapper. Wrapper SHA-256
  `b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`;
  `decompile_targets.py` SHA-256
  `899167ca42624e09f26d22233365631a6ee8b3d106e337e20b77574894e97465`.
  Task scratch logs: `/tmp/sd-magic-shield-re-20260904/`.
- Full draw decompiles `0x005468C0` and `0x0054BA80`, raw instructions
  `0x00547FC6..0x0054812D`, color setter `0x0041FE50`, uniform Sprite draw
  `0x00414EA0`, install `0x00529EE0`, common update `0x00533520`, contact
  `0x00534510`, break `0x00546650`, explosion `0x00648790`, and Clothes builder
  `0x004E4CA0` were reopened. The field census covered `+0x1C4/+0x1D0`.
- Instruction-level census of every direct reference to Clothes singleton
  `0x00819980` found six Clothes-2 consumer sites in four functions: player
  special painter `0x005480CB`, ordinary painter `0x0054C9E8`, explosion
  `0x00648902`, and Mindblast rings `0x00645D58/0x00645E57/0x00645F5F`.
  Every site selects singleton `+0x1C0`, which is Clothes record 2. The older
  decompiler-only asset-object map missed the implicit ECX player arguments.
- The complete consumed record is rectangle `(1093,85,81,81)`, logical cell
  `81x81`, origin `(0,0)`. Direct retail `Clothes.bundle`/`Clothes.png`
  extraction matches every RGBA byte of the existing
  `frontend/src/assets/game/player-mindblast-ring.png`. RGBA-byte SHA-256:
  `255ff1d068ba0cccb5200098df4462c097c017071bf01bd9cc23756f372ea855`.
  Reuse this asset; do not synthesize another shell or recolor enemy art.

### Boundary and complete membership

Native system: the player-owned Magic Shield shell, its absorption/break
lifecycle, and all consumers of its shared Clothes-2 art. The dispositions below describe this candidate; the validation receipt follows.
Pre-fix main did not meet this contract.

| Member | Source | Disposition | Required proof |
| --- | --- | --- | --- |
| ordinary player shell, all five elements, every rank/equipment appearance | `0x0054BA80`, Clothes 2 | exact-ported | one shared asset, offset, scale, white color and alpha formula; no element/rank size override |
| special/material player shell | `0x005468C0`; suppress duplicate body shell through `0x00819E5D` | exact-ported | same one shell after the body; Stoneskin/Planewalker do not tint or duplicate it |
| local player, remote participant and bot in Courtyard, private College and Boneyard | both PlayerWizard painters; shared web `PlayerWorldView` | exact-ported | both world consumers bind the same plan and texture; Mac scene journeys |
| no shield, applied/refreshed shield, hit pulse, depleted shield and world reset | `+0x1C4/+0x1C8/+0x1CC/+0x1D0`; install/update/contact/break functions above | verified-already-at-parity | authoritative absorb/reset and up/hit/pop audio regressions; shell absent when absorb is zero |
| pulse brightness and size | both player draw tails | exact-ported | brightness is alpha, not RGB; idle and high/low pulse branches covered |
| Explosive Shield ring | `0x00648902`, Clothes 2 | exact-ported | correct shared art; existing 2.5 scale, 1.01 recurrence, 1.5 alpha and .05 loss retained |
| Mindblast ring 0 | `0x00645D58`, Clothes 2 | verified-already-at-parity | existing ring program and exact asset hash |
| Mindblast ring 1 | `0x00645E57`, Clothes 2 | verified-already-at-parity | existing independent 1.05 recurrence |
| Mindblast ring 2 | `0x00645F5F`, Clothes 2 | verified-already-at-parity | existing independent 1.025 recurrence |
| 20 break children, explosion flash, both ten-frame arrays, 100 FuzzySpears, Shockwave, Region flash/camera and four audio edges | `0x00546650/0x00648790`; existing full programs above | verified-already-at-parity | retained construction-word, lifecycle, damage and presentation regressions |
| enemy shields | separate enemy owner and BadGuys 49 | out-of-system | different art, 1.5 scale and y-30 remain enemy-owned; no global replacement |
| HP/shield HUD, unrelated secondary abilities, unrelated Clothes records | separate consumers | out-of-system | no shell asset or geometry ownership |

No member requires a browser-platform approximation. Settings do not select a
second player shell; the same asset and state serve both enhanced-effects
settings and every camera zoom. Retained world reflections consume the same
player container and therefore the same corrected shell.

### Recovered contract

The render guard is positive absorb at player `+0x1C4`. Installation writes
remaining/capacity and the explosion factor, plays the up cue, and clears the
hit pulse. Absorbed contact writes pulse 2, common update subtracts .05 with a
zero floor, and depletion clears the absorb state and invokes the independent
break program. These authoritative lanes already exist in the web kernel.
The web's 40-tick pulse representation supplies the presentation pulse scalar.

Both native player draw tails select Clothes 2 with additive blend, position
`(player.x, player.y-35)`, and **white RGB**. Alpha is
`0.25 + 0.5 * (max(pulse,1)-1)`: idle .25, fresh hit .75, returning to .25 while
late-pulse scale wobble still decays. Scale is
`2.1500000953674316 + 0.10000000149011612 * sin(tick*20*pi/180) * min(pulse,1)`.
The base double at `0x00794118` and amplitude double at `0x007849E8` encode
float32 values 2.15 and .1. Offset 35 comes from `0x00785BB8`; alpha constants
are `0x007DE820` (1), `0x007DE808` (.5), `0x007DE8F0` (.25). The submitted
scale is stored as float32. Resting logical diameter is approximately 174.15
world units, versus the incorrect 121.5; camera scaling applies afterward.

`0x0054BA80` gates its shell on `0x00819E5D == 0`; material passes suppress that
inner draw and `0x005468C0` emits the shell once afterward. A body tint must not
become the shell tint. Explosive Shield's one expanding ring uses this same
Clothes-2 image, while its other independently owned children retain their
existing exact assets and lifetimes.

### Implementation and validation contract

Keep asset/offset/base-scale data together with the native shield plan and use
that descriptor in `PlayerWorldView`. Bind alpha to the Sprite alpha field,
retain white tint, and replace the Explosive Shield ring's incorrect DeadHawg
selection. Reuse the existing exact Clothes crop and registration helper.
Extend actual renderer diagnostics with shield alpha so the Mac browser gate
cannot repeat the former visibility-only false positive. Cover absent/idle,
bright and late pulse, material-independent tint, break/reset, and all three
Mindblast sibling rings. Run focused tests, `./scripts/validate.sh`, and built
Mac Chrome acceptance for College and Boneyard, including a shield hit/break
journey and page/console/failed-response capture.


### Mac implementation receipt

- Isolated Website branch `codex/magic-shield-parity-20260904-root`, based on
  fetched `origin/main` `3fa437374ffaae2849189c6a11404183dd5c5080`.
  Local worktree:
  `/home/user/.codex-worktrees/solomon-website-magic-shield-parity-20260904-root`.
  Mac candidate:
  `/Users/jarrett/codex-acceptance/magic-shield-parity-20260904-root/Website`.
  The shared primary checkout and all Mod Loader files were left untouched.
- The new regression first failed on Mac against the old implementation:
  actual scale `1.5`, tint `0x40FFFF`, and no alpha versus expected float32
  `2.15`, white tint, and `.25` alpha. After correction all **135** focused
  secondary presentation, asset, and authoritative ability tests passed.
- `/opt/homebrew/bin/bash ./scripts/validate.sh` passed **19 backend checks**
  and **2,646 frontend/desktop tests**, backend formatting, frontend
  lint/boundary/generated checks, both production builds, bundle budget and
  media policy. Gate log SHA-256:
  `de95b87c9d8d4ea8d9d5813475b9beba720e62b59882841ad6d36ba46a9dfbdc`.
  The subsequent smoke-driver corrections changed no production/runtime code;
  the final driver was checked again with canonical `validate.sh lint` and
  executed against that same production build.
- Built Mac Chrome, WebGL2, 1600x900: Boneyard cast through the actual belt and
  right mouse input, with `SDR_SECONDARY_ABILITY_ID=54`,
  `SDR_SECONDARY_ABILITY_SCENE=boneyard`, `SDR_SECONDARY_ABILITY_PRODUCTION=1`
  and `SDR_SECONDARY_ABILITY_NATIVE_VIEWPORT=1`. The single-shield run now uses
  a fixed 16-byte zero map seed. Resting Sprite scale was
  `2.1500000953674316` and Sprite alpha `.25`. The hit changed absorb `25 ->
  24` without health damage; 29 sampled frames observed alpha `.625 -> .25`
  and scale `2.052485227584839..2.2489776611328125`. Depletion removed the
  shell, emitted 20 break children, and played hit/pop audio. The upgraded
  break presented the explosion's 200-plus primitives and explosion audio.
  Boneyard receipt SHA-256:
  `5ade9ba5ce7ef9d48269ce787ad6e7e242de9db23f32693e39b575228fe4f59d`.
- College correctly rejected the cast with unchanged mana/cast sequence. A
  separately labeled authoritative shield fixture then exercised the College
  renderer without bypassing its input policy: scale `2.1500000953674316`,
  alpha `.25`, 46 sampled hit frames, alpha `.625 -> .25`, scale
  `2.052408456802368..2.2492547035217285`, 20 break children and an upgraded
  explosion. This is renderer/lifecycle fixture evidence, not a claim that
  ordinary College casting is enabled. Hub receipt SHA-256:
  `92a6116c21979c7e3db5073b08862908e9dba2c8805d57e211b653531f234cfb`.
- Both successful browser receipts have empty page-error, console-error and
  failed-response arrays. The resting screenshots were visually inspected
  against the supplied reference: broad translucent blue shell, visible
  ground through the shell, and unchanged body/weapon presentation. Different
  source-capture settings prevent a claim of matched-scene pixel identity.
- The driver now observes the brief cast flash from frames recorded during
  the cast instead of waiting for another flash after its screenshot. The
  burst check uses actual rendered kind and primitive count: explosion actors
  intentionally are not in the renderer's detailed diagnostic-kind set.
  Exact Clothes-2 ring selection is independently covered by the native
  instruction evidence and presentation/asset tests.
- One randomized Boneyard attempt aborted in the pre-existing enemy-placement
  path (`resolveNativeBoneyardSpawnPosition`, no dark collision-safe placement,
  radius `17.443894807249308`). This is a nearby generated-map/spawn finding,
  outside the shield painter change. The final fixed-seed run exercised the
  complete shield journey successfully; this pass makes no random-map spawn
  closure claim and changes no spawning code.
- No material shield-rendering unknown or browser-platform exception remains.
  The initial implementation phase ended without a commit, push, deployment,
  or production restart. Its focused worktrees were retained until the user
  authorized publication to main in the follow-up. Task-owned
  scratch Ghidra output, copied screenshots, and browser logs are disposable
  once their conclusions and hashes above have been recorded.

## 2026-09-06 — Faculty membership and flyout lifecycle correction

The Faculty encounter now adds the previously absent SkullMissile/DarkFireball
and DireFaculty caster branches. Fresh ASM also falsifies the August 30
source-age/heading/scale preservation, 40-pixel flyout velocity, fixed 100-tick
retirement, and immobilizing Mage disruption. The complete correction and
instruction-level facts are in [ledger 301](301-2026-09-05-generated-survival-boss-encounter-closure.md#dampen-caster-and-canceled-projectile-reopening). Earlier exact-port
claims for those paths are superseded pending this candidate's Mac/browser proof.
The explicitly accepted caster-pulse crash repair remains unchanged.

## 2026-09-26 — report 36: pre-Dire secondary-spell lag save audit

The reporter supplied one private save and suggested casting several secondary
spells before the Dire fights to expose lag. The archive ZIP is 1,555,903 bytes,
SHA-256 `a5bd9a47e3a74af277d212885235171706b3533b5f81c4df89f8984d39abbdfb`.
Its `browser-game-save.json` member is schema 39, 1,526,863 bytes, SHA-256
`6449d98d409d608239d6e3d961ce1fef7bda62a27681a3240d880dcfd7eebfb4`.
The original ZIP and source messages remain in the private report archive;
only a bounded working copy was restored on the M2. This is a distinct scene
from report 37's Dire Aliss death save; a shared cause is not assumed.

### Saved-state and membership evidence

The saved authoritative run is active at tick 1,071,755, wave 30, with one
level-31 wizard. It contains 124 enemies and 345 independent enemy death
bouncers. Its secondary store has two Magic Storm clouds, 132 Storm drops,
two Leviathans, eight appendages, eight motes and two Ether fades (154 actors
total). The hotbar carries Storm `27`, Leviathan `11` and Magic Shield `54`;
Storm and Leviathan are already running in the supplied state. The existing
complete native ability programs in this entry explain 66 Storm drops per
cloud and the authored Leviathan child population. These counts identify a
heavy valid workload; they do not by themselves prove a performance defect.

| Member | Investigation disposition |
| --- | --- |
| Magic Storm `27` cloud, 66-drop child/strike program, fade and audio | Existing native actor program and tests retained; no extra or permanently leaked Storm family established by this save. |
| Call Leviathan `11`, appendages, motes and Ether fade | Existing native lifetime/quantity ownership retained; no new parity difference established. |
| Enemy and death-effect population | Separate wave, enemy and effect owners; present in the save but not attributed to secondary spells without a controlled cause. |
| Schema-39 restore into current save schema | Current decoder restored the exact continuation; no source state was edited or published. |
| Renderer and game-host delivery | Measured on the exact saved workload in Mac Chrome and direct simulation; no current-version severe lag reproduced at the saved character's scale. |
| Dire Aliss death | Separate report 37 and save; excluded from this occurrence. |

### Reproduction and performance boundary

`restoreGameSaveDocument` accepted the original member in 36.5 ms. A direct
300-tick no-input M2 replay stayed active, with 1.55 ms median and 3.30 ms p95
simulation cost. Its first cold step took 443.6 ms in that direct stepping
harness; this is not a measured repeated spell-cast stall or a browser frame.
The production-client Mac Chrome restore held approximately 60 FPS during the
first five seconds with empty page, console, HTTP, request, wire and host error
arrays. The unmodified wizard died in the crowded scene before a sustained
15-second cast comparison, so later Game Over frames are excluded from active
combat acceptance.

A task-only controlled journey retained the same saved run and native actor
programs while refilling mana/health and bounding the diagnostic wizard's
maximum health at 500. It admitted a real Magic Storm hotbar cast and then a
real Call Leviathan hotbar cast, taking active parents from one of each to two
of each; the secondary population peaked at 386. The built Chrome client held
60.0 FPS in both the five-second pre-cast and ten-second post-cast windows,
with p95 frame intervals of 16.7 ms and empty error arrays. The run remained
active. A separate successful stock-health-refill attempt likewise held about
60 FPS before and after the two casts. Browser log SHA-256 for the bounded
500-health journey:
`02b68cf2a8e1e6a443938659480e946066571e8a3086b8cde0c2f28ce1c65db1`.
These are M2 observations, not measurements of the reporter's PC.

An exploratory one-million-health fixture produced 27–43 FPS and a long
snapshot gap. That value is outside this wizard's saved 79 maximum health,
and smaller bounded fixtures did not repeat the slowdown. Its result is
excluded from the report's performance claim; changing native spell visuals
or gameplay rules on that proxy would be unjustified. Repeated projection of
the saved state produced about 260 KB keyframes with sub-millisecond median
snapshot/projection/encoding phases on M2, also not a sustained cast-stall
signal. The controlled browser receipts, performance logs and extracted private
save copies are task scratch, not repository evidence.

No current gameplay defect or native data mismatch was established for this
specific save and cast sequence. The historical severity on the reporter's PC
remains unverified without that machine's timing/capture state; this
investigation does not claim a universal FPS speedup or that every secondary
combination is lag-free. No runtime, renderer, schema, protocol or asset change
is justified. The current runtime had already passed the complete canonical
M2 Website gate for report 35; this report adds documentation only, with
focused Storm/Leviathan tests and a real built-client save journey. There is no
browser-platform blocked member.


## 2026-09-30 — Report 66 Ether Drain target-system reopening

### Reported behavior and recovered boundary

Report 66 supplies one original 12-second Ether Drain clip and four connected
questions: radial attraction, pickup membership/consumption, Rush escape, and
lethal center damage. The reporter explicitly recalls rather than proves the
Sack/Key and Book/Quad Damage distinctions. The original retained clip is
6,405,516 bytes, SHA256
`df0cf83e6a1c55e9886b246adf21a2fbf4f9e90633d285117ee60179551b6e79`.
Its initial archive samples do not prove an exact force or damage contract.
The shared source message also contains accepted Report 20 Ring work; this
reopening does not reopen that presentation/flash system.

This entry reopens the earlier Ether Drain closure because it did not close
the complete target inventory: current `createNativeSecondaryTickContext`
feeds only `boneyardNativeSecondaryTargets` (living enemies), and the host
consumes only enemy damage/knockbacks. `stepBoneyardLootStore` has participant
collection and Orb attraction but no field-consumption path. Entry 176 already
recorded the missing player/corpse producer as future Ether Drain work.

Native system boundary: EtherDrain `0x807`, construction/payment/registration,
retained spatial target arrays, radial force callbacks, center damage and
capture, its independent children/presentation, and target lifetime through
field expiry or scene teardown. The existing authored rank row 74, scale/
countdown/child program and galaxy painter remain evidence to revalidate;
player/loot admissions cannot be inferred from the earlier enemy-only port.

### Initial evidence and membership inventory

The local stock executable was independently verified at 4,723,200 bytes and
SHA256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`,
preferred image base `0x00400000`. Existing read-only native catalog v3 row 74
identifies constructor `0x005F8360`, tick `0x0061CF20`, refresh `0x00606580`,
contact/force `0x005F8620`, destructor `0x005F84F0`, parent painter/light
`0x005EE120/0x005EE780`, and capture-presentation callback `0x005EE840`.
Existing raw decompilation of the last callback writes parent pulse `+0x19C`
and creates a fade; it does not itself establish the player corpse writer.
That older shorthand attribution must be retraced to the actual capture call.

| Member / branch | Evidence thread | Investigation state / required proof |
| --- | --- | --- |
| Row 74 ranks 0..10 damage; all 13 mana entries | exact stock `ether_drain.cfg`, catalog v3 row 74 | Revalidate full row; no guessed force/damage constants. |
| Scale-in, active, final 50 ticks, scale-out, expiry | `0x0061CF20`, existing phase tests | Existing fixed-tick port; revalidate pressure start/stop and children. |
| Retained targets, strict broad ellipse, refresh ages | `0x00606580` | Recover all masks and both arrays before implementation. |
| Living enemies / Maggots / authored stationary branches | `0x005F8620`, enemy force and damage overrides | Existing enemy pressure/damage; prove callback behavior and material flags. |
| Living player, caster and other party members | refresh/contact plus Player force/damage slots | Missing from web field path; recover force accumulation, Rush and damage. |
| Dead player / captured corpse and terminal archive | native capture callback, Player `+0x1C0`, entry 176 | Reconcile actual writer, presentation, save/profile consequences. |
| Golem / GoodImp / other friendly bodies | actor flags and force/damage overrides | Determine exact field membership; do not apply enemy contact by family guesses. |
| Orb health / mana / experience | actor `0x7DB`, flag `0x400` and virtual force | Recover motion, consumption radius and lifetime. |
| Gold amount/tier/scatter/delay | `0x7DC`, force/capture and existing loot state | Recover delayed/empty/nonempty distinctions; no unconditional deletion. |
| Sack item carriers, including Key | `0x7DD`, held item and force/capture | Constructor confirms `0x400`; recover exact held-item rule. |
| Bonus Book / random-skill / Quad Damage | `0x7F6` constructor and refresh mask | Prove floaters from actual flags, not reporter memory. |
| Telekinesis / Orb participant attraction and pickup | stock actor pickup ticks / field update order | Collection remains owner-owned; prove rescue and field competition. |
| Parent galaxies, light, audio, SuckCloud, free SuckDebris, capture fade | existing full row 74 child program | Revalidate unchanged branch; recover actual captured-object handoff. |
| Shared/private/party Boneyard; Hub rejection; reset/continuation | authority/context, row 74 world ownership | Per-member public regressions and real built browser journeys. |

All rows remain provisional investigation inventory. No final parity claim is
made here. Required acceptance uses the exclusive private M5 external-SSD
environment, meaningful red/green public simulation tests, the unchanged
canonical all-mode gate on exact reconciled main, real built browser paths,
normal publication, maintained deployment verification, and scoped cleanup.

### First bounded M5 recovery and public failure receipt

Before product implementation, an exclusive M5 Pro external-SSD lease ran
from 2026-09-30 20:05:14 through 20:17:53 UTC. Original Website commit
`cf82e7e3fa80bf41c94277dd0cac7a9ec70fa3e0` and tree
`6928d6f8d2e68db0df6046ba900d5c77b3b67891` were materialized from their
actual commit/tree bytes; all 7,239 indexed source files matched. The only
regression overlay was the two public caster cases in
`core-server/game-simulation.test.ts`; no product change existed. Both
failed with the intended `ERR_ASSERTION`: after a real admitted category-2
cast the idle caster received no inward movement over 100 steps, and the
center caster remained alive after 250 steps. There were two executions,
zero passes, two failures and zero skips. These prove the missing current
player path, not the still-unrecovered numerical force override.

Fresh sealed-image instructions correct two inherited recovery assumptions:

| Fresh evidence | Recovered consequence | Confidence / status |
| --- | --- | --- |
| `0x005F8712..0x005F873D` | Sack `0x7DD` checks positive signed timer `+0x14C`; Gold `0x7DC` checks positive timer `+0x144`. A positive timer returns before the force callback and before consumption. Held-item pointer or Gold amount is not this gate. | high; the older nonempty-container immunity note is false |
| `0x005F87D2..0x005F880E` | Eligible flag-`0x400` objects are retired through virtual `+0x18` strictly inside squared distance 100, then invoke parent callback `0x005EE840(1)`. They do not receive hostile damage. | high; radius-10 consumption, not an invented radius-20 deletion rule |
| `0x006065F0..0x006066A7` | Spatial refresh admits mask `0xC02` through the strict broad ellipse into retained group/slot references; `+0x168` starts from prefix count `+0x164`. | high for mask/representation; initialization/prefix membership still open |
| `0x006066AB..0x0060670E` | A second retained reference array admits mask `0x4` and owns a separate scenery-presentation path. | high; complete scenery variants/ordering still need recovery |
| `0x0061D503..0x0061D517` | Pressure processing is gated by post-update state not equal to scale-out and countdown above 50. Scale-in is not independently rejected. | high; inherited gameplay-age `41..990` claim cannot be used as the general gate |
| Primary RTTI/vtable census, virtual `+0x38` | PlayerWizard, Orb, Gold, Sack, Bonus, Badguy, Skeleton/Archer/Mage, Zombie, Maggot, Coffin, Portal, Spider and Cocoon use `0x00623C60`; Demon uses `0x0047A2E0`; Golem uses `0x005EE9B0`. | high for addresses; callback bodies remain open |
| `0x0061DC99..0x0061DE1E` | Capture art is selected only for Skeleton IDs 1001/1002/1003, Zombie 1006 and Demon 1009. It uses actual facing/body selectors/tint and the field's private animation manager. Unsupported classes select no capture image. | high; exact inherited fade/draw/destructor program and authored banks still open |
| `0x005EE8BF` and `0x0061DE52`, sealed audio registry rows 67 and 19 | Direct center/captured-fade callback (`parameter >= 1`) uses `phase` at `+0xB9C`; supported enemy capture-art birth uses `crunchdrain` at `+0x35C`. Neither establishes a spell-birth `crunchdrain` cue. | high for names/calls; exact callback playback parameters still need recovery |

The user then prioritized moving CI/CD compute to the M5. The Report 66 lease
was released after exact owner comparison with no owned process and no new,
missing or changed scoped real-home path. Pending source/tool/native evidence
is explicitly preserved. No original Report 66 media decoder or browser
acceptance was launched, and no complete native/Website acceptance or
publication is claimed. Remaining extractable callbacks, initialization,
constants, secondary-array behavior and original clip review still require
an actually granted M5 slot. This is an investigation checkpoint, not a final
member disposition.

### Light M2 preparation during migration

The original audio catalog binds `phase.wav` (11,244 bytes, SHA256
`cbd9572e6910191bab3b856120e39c67573efd708514b3443eac27bc0c6f48d3`)
to registry 67 / offset `+0xB9C`, and `crunchdrain.wav` (31,808 bytes, SHA256
`5885f636b67b20463c53db5ca4ffa8de9e32ba65724751a15dd20785bc441ddc`)
to registry 19 / `+0x35C`. Those data rows match the freshly extracted
callsite offsets above. The prior unresolved spell-birth association must
not hide the now-proved enemy-capture cue.

Prepared public fixtures now distinguish floating world Bonus books from
ordinary inventory skill books carried by Sacks. The native pressure path
checks the carrier type and delay, not the held inventory kind. Actual owned
`miscItem`/`potionItem` factories create Key, both inventory book classes and
Potion payloads for center-consumption tests; the Gold variant also checks
no pickup credit. A delayed-Gold/Key case preserves admission during positive
delay and requires consumption before the next native refresh opportunity.
These extra cases are prepared only, not executed red/green evidence.

The `0x800` member is the existing friendly/summoned target lane in the
Website (`enemies/puppet-hits.ts`), currently supplied by Golems. Their
`0x005EE9B0` force override and `0x00607F60` damage receiver must be recovered;
adding them to an enemy damage path by numeric ID would be incorrect.
Primary Arrow/Firebolt/Guided and Silk lanes have different flags and are
not automatically field targets merely because they are nearby.

The original-media helper has also been prepared to await an actual
`requestVideoFrameCallback` after seek/play and record observed media time,
PNG hashes and nonblack pixels. A paused `seeked` event alone proved
insufficient in a sibling's review. No such modified helper has been run
for Report 66 yet.

### Owner ordering still to close

The already extracted parent tick places its free-debris gate at
`0x0061D93F` after retained-object pressure/contact and the
scenery branch. The broader gameplay gate is state not scale-out and
countdown above 50, so it cannot be grouped with the cloud gate's separate
state-at-entry active branch. The current kernel groups both gates before
pressure and currently advances no free-debris gate during scale-in.
This is a supported ordering/timing discrepancy in the same owner; the
precise program, callbacks and all RNG consumers must be reconciled before
changing it. The fresh assembly is available; no new M2 disassembly or
Website command was run for this review.

Scenery array indexing at `0x0061D642..0x0061D6E4` also reads a group byte
from the first array while taking its slot from the second. That requires
inspection against the initialized group/slot membership before any
translation. The user explicitly rejects copying native bugs; a suspicious
raw-array detail is not itself a supported gameplay rule.

### 2026-10-01 recovered field contract before implementation

The two subsequent exclusive M5 phases retained the same sealed executable.
Normal playback of the exact original clip presented all 359 frames, reached
`ended`, and reported zero dropped/corrupt frames or media errors. Six actual
presented-frame callbacks yielded distinct nonblack images. The late image
shows the wizard at a bright field with a lower health bar; it does not reveal
inputs, Rush rank, exact damage source, or pickup identities. Sparse images
are not a force/damage oracle.

| Field member | Instruction-backed disposition |
| --- | --- |
| PlayerWizard, including caster and party | Constructor `0x0052B559` writes flags `0x801`: admitted by query mask `0xC02`, with contact damage doubled by bit 1. Generic Force `0x00623C60` directly resolves collision displacement; it does not add velocity or advance gait. Existing incoming receiver `0x00548150` enters the already-ported health owner `0x0052F540`. |
| Gold and Sack, every payload | Flags `0x400`; positive activation timer exempts both pressure and retirement. A nonpositive timer permits pressure with the additional falloff factor, and strict squared distance below 100 retires the carrier without collection or credit. Key, Potion and inventory Books do not change this rule. |
| Orb and Bonus | Constructors and Orb reset retain flags 0. Transient registration `0x0063E5B0` attaches the actor/world without changing flags. All six direct `0x004683E0` notification callers are Gold/Sack materializers; the ordinary Orb death dispatcher registers without that notification. Orb and world Bonus books/Quad Damage therefore float outside this retail field query. Normal Orb attraction, Telekinesis and collection remain their own program. The report's recalled Orb deletion differs from this sealed build. |
| Golem | Constructor `0x005F58D8` writes `0x800`; Force `0x005EE9B0` applies factor 0.25 and translates articulation anchors by actual movement. Damage receiver `0x00607F60` rejects pre-assembly contacts and admits physical/magic damage afterward; only physical enemy damage can reflect. |
| Enemy force overrides | Generic factor 1; Demon `0x0047A2E0` factor 0.5 with articulation translation; DireFaculty `0x0047A420` float32 0.35; DemonSkull `0x0047A470` float32 0.1; Heartmonger `0x0047A4C0` factor 0.25. Other admitted enemy families use the generic Force slot. |
| GoodImp and projectiles | GoodImp constructor clears flags to 0 and has a no-op damage slot; primary/projectile flags are outside `0xC02`. Nearby presence alone does not admit them. |
| Player corpse | Actual writer is `0x00533AAA`, in maintenance `0x00533520`: while dying and native presentation timer `+0x1BC` at least 130, strict squared distance below 100 invokes parent callback `(2)` and writes consumed `+0x1C0=1`. This timer maps to the Website's `deathTick`, not its separate elapsed `deathAgeTicks`. Consumed body presentation stops and the ordinary terminal profile archive suppresses carried-item transfer. Death burst timer 159 is a separate owner. |
| Captured enemies | Common death admission `0x0047BF70` uses damage flag `0x100` and the first registered field strictly within 40. `0x0061DC20` clears the field's private capture animation before selection; Skeleton/Archer/Mage, Zombie and Demon select actual facing/body/tint art. Unsupported families select no captured image; the accepted Spider branch remains intact. |
| Captured animation and callbacks | Anim_Sucked starts alpha 1.25 and loses float32 0.2 each update. Draw uses the selected art and parent position, with the inherited mask/clip and body Y offset. Retirement calls the parent with 1.5. Supported-art birth plays `crunchdrain` at one FloatRange(float32 0.9, 1) pitch draw; callbacks with parameter at least 1 play `phase` at pitch 1.5 and create BadGuys36 with scale/alpha equal to the parameter. |
| Pressure/contact arithmetic | Float32 delta and squared distance; admitted at squared distance at most 262144. Normalize to one, store float32 `max(float32 .1, 1-d²/262144)`, then encoded 1.100000023841858, then intensity; loose carriers receive another falloff multiplication. Contact is strictly inside radii 20/15/10, with scalar `mDamage/100` and successive factors 1/2/4, then player bit-1 factor 2. Magic contact flags `0x10A` suppress ordinary hit redraw/audio. |
| Child ordering and scenery | Cloud gate remains in the state-at-entry active branch before pressure. Free-debris Integer(50) gate follows pressure and mask-4 scenery, and shares the scale-in-inclusive pressure gate. The actual scenery lookup reads its own group/slot array; the first array supplies only the suspicious invalidation precheck. That cross-array precheck is not a behavior to reproduce. Tree leaf selection uses secondary variants 0..2/3..5/7 for DeadHawg177/178/179; variant 6 selects no leaf. Existing exact Tree polygon data owns the spawn geometry. |

The additional two public Gold/Sack tests ran on unchanged `cf82e7e3`, with
only the test overlay, and both failed at the intended assertions. The first
payload loop stops at Gold on its red execution, so this is not a separate
red receipt for every held item. The original two caster reds were preserved
without replay. Implementation now has a proved complete target boundary:
typed generation-aware field references, existing physical/contact/loot
receivers, consumed-corpse persistence, captured-art ownership, and the
correct child RNG ordering. Required final acceptance/publication is pending.

### Private animation ownership and image-bank correction

Further sealed instructions close the private manager at `+0x1A0`:
Tree/free SuckDebris insert at `0x0061D8EF/0x0061DA47`, capture clears it at
`0x0061DC94`, and its tick occurs at `0x0061DC02`, after the parent pulse
decay. A new private debris therefore receives its three update draws on its
birth tick. A successful simultaneous Cloud/debris birth consumes 16 words
(8 Cloud, 5 debris birth, 3 private update), correcting the inherited 13-word
test. Private image replacement clears debris as well as the preceding image;
the independent phase flare registers through `0x0063E5E0` at `0x005EE985`.
This is why private state now belongs to the saved field rather than another
world actor kind. Old flat debris is converted to its matching field on save
migration, and orphaned old children are discarded instead of acquiring a
different parent.

The earlier body/DeadHawg shorthand was incorrect. Actual capture selection
uses Skeleton `+0x230` headgear and `+0x224` head-facing offset. The existing
six headgear banks are BadGuys `1477..1584`. Zombie `+0x24C` selects its three
head banks, BadGuys `2293..2346`. Demon lookup dereferences singleton
`0x00819998`, not DeadHawg `0x00819994`; native asset-object-map destination
`0x0140` and direct `0x0061DC20` consumer identify Demon `80..97`.
Those exact retained builder/consumer rows corroborate the sealed callsite.
The implementation reuses the existing Skeleton presentation color sampler;
it does not introduce another random material program.

Anim_Sucked `0x00455370` conditionally draws BadGuys 9, clips the selected
image to field-local `(-100,-110,200,110)` below alpha one, resets the clip,
then draws BadGuys 8 at Y -1. The image Y is
`bodyYOffset - 10 + 35*max(0,1-alpha)`, with bodyYOffset 23 for Skeleton
headgear and zero for the other selections. Original `crunchdrain.wav`
is retained unchanged at 31,808 bytes/SHA256
`5885f636b67b20463c53db5ca4ffa8de9e32ba65724751a15dd20785bc441ddc`.

Seven death callers are covered: Imp/GoodImp/GreenImp `0x004824A0`, Demon
`0x00482930`, Spider `0x00482D60`, Skeleton/Archer/Mage `0x0048D2A0`, Zombie
`0x004947B0`, Wraith `0x00495600`, and Maggot `0x0049C830`. Their capture
branch returns before ordinary death effects and family child spawning;
the common death/drop work `0x004819D0` precedes that branch. Captured Imps
therefore do not split, and captured Rotten Zombies do not emit a PoisonPool.
Unsupported image classes still clear the private manager without a new
image or `crunchdrain` request. Bosses without this death helper retain their
ordinary programs.

Scenery uses the existing `0x004012C0` random-sign primitive and a separate
Float(1) step, forcing the sign back toward the interval beyond -1/+1.
The Tree helper `0x004054B0` obtains an area centroid from `0x00404F40`;
it is not another random point draw. Leaf birth adds Float(150) and a unit
heading to that center. Existing exact Tree polygons and the existing shared
scenery phase carrier are reused. Variant 6 has no leaf, while variants
0..2/3..5/7 select DeadHawg 177/178/179. The suspicious cross-array invalid
reference precheck is deliberately not implemented.

Protocol 145/save 48 carry the complete field references/private animation
state and consumed-corpse bit through the existing strict codecs, snapshot
and historical-save owners. Final compatibility, complete scoped tests and
built acceptance are still pending; the earlier focused green receipts describe
their recorded partial candidates, not this later private-owner cutover.


### 2026-10-01 — field notification and separate world-animation owner

New Gold/Sack notification `0x006064B0`, specifically the refresh write at
`0x00606509`, appends an eligible drop and resets the ordinary/scenery query
clock. The Website now refreshes those members in the same field tick. Its
public new-enemy/new-Gold regression failed at the actual membership assertion
before this correction and then passed. Positive pickup delay still protects
position/consumption; the manually advanced enemy fixture does not imply one
elapsed loot tick.

The independent animation-pointer list is `+0x1EC` (count `+0x1F4`, data
`+0x200`). `Anim_Bouncer` virtual `+0x1C` at `0x0045BCE0` tail-calls
`0x0045AE30`, which enumerates the Scene's Ether Drain registry
`+0x13A8/+0x13B4` and appends a reference under ordinary strict squared
radius `1048576`. Field initialization `0x0060642D/0x00606478` asks existing
world animations to register; birth `0x00456DFD..0x00456E04` invokes the
same virtual. This is a separate presentation-physics lane and provides no
Orb/Bonus membership rule.

**Layout correction:** eligibility `0x00453160` tests stored bounce velocity
`+0x2C`, not height. Bouncer tick `0x00456720` uses height `+0x38`; native
settling zeroes the stored bounce with planar/vertical/spin motion. The
Website's former grounded path rerolled contact RNG and left that bounce
value nonzero. The current correction skips grounded motion/contact RNG
while retaining fade and zeroes the bounce when settling. Historical saves
through47 repair only states with zero height and zero planar/vertical/spin
motion. These latest invariant/migration changes have written regressions
but await an actually granted M5 check; earlier greens do not cover them.

RTTI admits Bouncer, Additive/Colored/Smoky/BlackSmoky Bouncer, BoulderBit,
Hail, StaffBouncer and WandBouncer through that virtual. Scrap registers but
its virtual `+0x20` returns false. Private SuckCloud/SuckDebris/Sucked do not
participate. Pressure `0x0061DA9E..0x0061DB9F` uses fast normalization
`0x0043A8E0` (the established native Hurricane primitive), multiplies the
stored `falloff*1.100000023841858` strength twice and then field intensity,
and has no additional512-radius cutoff. Strict squared radius100 retires
an animation and writes pulse2 before parent fade, without pickup credit or
an independent phase flare. It retains the existing phase/countdown gate.

| Member | Website disposition | Current evidence boundary |
|---|---|---|
| Enemy Bouncer/Smoky/BlackSmoky/BoulderBit records | routed through existing authoritative death-effect store | corrected grounded public red/green; latest stored-bounce fix pending |
| Primary Hail, Weld Hail Bouncer and Weld BoulderBit | routed through existing primary transient owners | direct Hail/save/wire test prepared, pending |
| Secondary Earthquake/Comet/Stoneskin/Golem assembly pieces | routed through existing secondary actors | direct Stoneskin-chip test prepared, pending |
| World animation references and per-store birth cursors | retained in field state, strict wire/disk48; legacy47 rebinds | current strict-reference controls passed on the preceding candidate; latest controls pending |
| Scrap and private field animations | excluded by actual virtual eligibility/owner | raw RTTI/virtual readback, no fabricated field flag |
| Golem death fragments and dropped staff/wand | mutable affected-member cutover required by21:15 scope decision | source implemented, validation pending |
| Orb/Bonus, normal pickup and Telekinesis | unchanged by this lane | verified flags0/no Gold-Sack notification; reporter recollection remains qualified |

The private draw owner sets multiplicative RGBA `(1,1,1,field intensity)`
at `0x005EE70E..0x005EE73F` before manager draw `0x004023F0` and restores
it afterward. `0x0041FF60` stores modulation; `0x0041FE50` composes it with
ordinary draw RGBA. Private captured images/debris/rims therefore inherit
field opacity; the capture timer controls descent, clipping and lifetime,
not a second opacity fade. A new renderer regression and the corresponding
source correction are pending M5 validation. Skeleton captured art uses
YOffset23; Zombie/Demon use0, now enforced with the bank in the strict codec.

The preceding43-file candidate had26 distinct focused passing cases across
25/26 plus a corrected2/2 command and TypeScript0, not one26/26 receipt.
The first purported grounded red was an airborne fixture with an old stored
bounce and is excluded. A corrected grounded fixture reproduced a genuine
missing-force red against preserved own pre-animation files, which were
restored exactly before green. Latest settled-state/opacity/Hail/offset edits
are unverified M2 source work after SSH failed before lease acquisition.
No current retail input trace, full canonical gate, built journey, publication
or deployment is claimed by these partial receipts.


### 2026-10-01 — required replay-member cutover, pending validation

The21:15 scope decision closes the earlier follow-up proposal: Golem death
fragments and staff/wand drops are members of this field animation lane.
`Anim_BouncerColored`, `Anim_StaffBouncer` and `Anim_WandBouncer` all have
Bouncer tick `0x00456720`, registration `0x0045BCE0` and stored-bounce
eligibility `0x00453160`. Existing renderer-only age/seed replay prevented
real field displacement, retirement and deterministic mutable continuation.

- Golem death retains its existing actor kind/atlas/quality/short Unbind star,
  but now owns30 indexed nullable fragment slots. The canonical constructor
  consumes the recorded273 words once, and the shared Bouncer motion owner
  advances actual fragment state. The old replay's two-times integration and
  warming gravity are removed from runtime. Life retires each fragment;
  the parent persists through the remaining fragments/star. Wire lifetime
  envelopes710/177 account for native airborne skipped fades, rather than
  using667/134 active-update counts as a premature wall-tick deletion.
  The30 Bouncers and short star retain31 actor-lane painter registrations,
  allocated at production by the existing manager. Each live member reuses
  the established view/draw program with its own world-Y/depth/tint/teardown;
  the obsolete single-root batch path is bypassed. Current codecs require31
  roots; historical one-root saves allocate the extra roots without RNG draws.
- Staff/wand production `0x00534120` selects the existing Clothes appearance,
  creates one Bouncer per death epoch, sets life99999, registers at world
  `+0x2C4` and invokes `+0x1C`. A dedicated Boneyard world collection owns
  its position/motion/life, cached appearance, id and painter registration.
  Existing player lighting registration remains the one-shot producer marker.
  Consuming a corpse or removing its player does not erase an unconsumed
  independent drop; field consumption does not remove the equipped item or
  restart the epoch.
- The field stores Golem parent/index and weapon ids under the existing
  monotonic cursor contract. It applies the proved independent animation
  pressure to real positions and removes only the consumed slot/object.
  Golem fragments survive owner removal as independent world presentation;
  current validation permits an absent owner only for that exact actor kind.
- Renderers draw current state, not reconstructed age curves. Snapshot/frame,
  client copies and disk48 carry the mutable states with strict clocks,
  domains, unique ids/epochs/painter registrations and exact30 Golem slots.
  Historical saves through47 reconstruct retired replay inputs only inside
  the save owner. Historical constructor seeds cannot recover a past global
  bounce stream; migration reconstructs the corrected bounded recurrence
  without changing saved global RNG, then future ticks use the real owner.

Existing Bouncer, Comet/Stoneskin and the two migrated members reuse a small
class-specific motion primitive; this is not a generic animation engine.
Original graphics, audio, existing Golem actor/model membership, shared
Webbed movement, normal Orb/Bonus/Telekinesis behavior and transport144 owners
are preserved. Public producer/field/owner-removal/save/wire tests and native
constructor/RNG/settling/current-invalid-state controls are prepared. All
cutover edits remain unverified M2 source work while the M5 is offline;
earlier26-case greens describe their recorded preceding candidate only.

The scoped motion primitive preserves the instruction's double gravity/planar
damping and float32 stored bounce damping. Exact-plane landings also settle,
avoiding the stock strict-plane test that strands nonzero motion at height0.
This deliberate ordinary bug correction has a prepared regression; no new
membership flag is introduced. Game Over keeps the existing gameplay-world
freeze: dropped weapons follow its continuing death clock, and that clock now
calls the same corpse maintenance130 check as the active path. Sealed maintenance
`0x005339E7..0x00533AAA` places capture directly after timer increment and before
the later ordinary death/Last Word disposition. A real terminal-control fixture
is prepared; no new retail Game Over runtime trace is claimed.

The existing secondary browser harness has a scoped compiled-client/live-host
member journey with actual quickbar casts and declared settled/position fixtures.
It checks Gold/carried-Key retirement without credit, Golem member motion/art/
independent roots, a real death-produced staff/wand retained after owner departure,
field consumption/painter retirement and hardware-renderer identity. It is unrun.


### 2026-10-02 — affected owners implemented, independent acceptance recorded

This supersedes the preceding offline and prepared-test status only. The native
instruction anchors, original media qualifications and earlier red/oracle history
remain intact. The candidate is based on real `cf82e7e3` (published transport 144)
and proposes protocol 145/save 48. No final current-main canonical gate,
publication, deployment or complete-parity outcome is claimed yet.

| Member | Implemented disposition and independent evidence |
| --- | --- |
| Living caster and party targets | Exact pressure/contact arithmetic and direct collision displacement; raw velocity/gait remain under their existing owners. Public caster/party/lethality and diagonal arithmetic regressions pass. Built rank-one held Rush stays inside from the deep start and escapes from the outer start over four seconds, with both raw vectors exactly `98.99996948242188,0`. |
| Gold/Sack and every carried payload | Exact native delay, notification and strict consumption path; no pickup credit. Public payload/delay/notification regressions pass; compiled Gold/carried-Key retirement passes. |
| Orb/Bonus and Telekinesis | Verified already outside field membership in the sealed build; no invented flag. Built ordinary floaters survive at the field, collect through the normal consumer, and Bonus0 completes the real picker/barrier UI. Telekinesis rank-zero/rank-one distances are 250 and 235.0136331 in the declared control. The reporter's recalled Orb deletion remains qualified. |
| Family force and inactive Maggots | Native family factors and existing collision/articulation owners; generic, Demon, Faculty, DemonSkull and Heartmonger constants are instruction-backed. The public inactive-Maggot/hidden-Coffin case passes; no hidden Coffin or Cocoon capture membership is added. |
| Supported captured images | Skeleton/Archer/Mage, Zombie and Demon retain exact authored bank/facing/body/tint, private manager, field opacity, native clipping/descent and callback lifetime. Public capture/save/retirement cases and renderer controls pass. Built art/rims/crunch pass for all five tokens; Zombie runs with Enhanced Effects off. Demon additionally exposes the actual attached Sprite mask `(-100,-110,200,110)`, its retirement detachment and phase pitch 1.5 through installed Pixi's initialization hook. |
| Unsupported captured images | Imp, Spider, Wraith and Maggot retire without a selected capture image. Public cases retain reward and suppress ordinary effects/splits/Rotten poison pool/crunch as applicable. Built Imp/Spider/Wraith retirement has no capture art, crunch, phase callback or clip; no new Spider/Cocoon teardown rule is introduced. |
| Consumed player corpse | Native maintenance timer 130 and strict radius 10 own the consumed bit in active and Game Over death-clock paths. Public carried-item archive, Last Word, death-burst, terminal and persistence controls pass. No fresh retail Game Over trace is claimed. |
| Ordinary world Bouncers, Hail and secondary chips | Exact stored-bounce eligibility and separate animation-reference list; existing death-effect/primary/secondary owners receive native pressure and retirement. Focused public movement/save/wire, settling and exact-plane correction controls pass. Scrap and private field animations remain excluded under their proved virtual/owner rules. |
| Golem death members | Mutable 30 indexed nullable fragments, native constructor 273-word order, 31 independent painter roots including the short star, native life envelopes and existing member art/depth/tint/teardown. Production, server, render and strict current/legacy save-wire controls pass. Built selected grounded/airborne/consumed members pass; this is not a claim of all 30 live pixels. |
| Dropped staff/wand | One native death producer per epoch with cached appearance and independent world motion/life/painter ownership. Obsolete runtime renderer replay is removed. Public production/owner-removal/consumption/save controls and a real compiled death-produced staff survive owner departure and then retire through the field. |
| Private debris and scenery | Existing authored Tree geometry and native float32 centroid/RNG program; private manager ordering and parent ownership are retained. Focused state/opacity/clip controls pass. The suspicious stock cross-array invalidation bug is not copied. |
| Wire/save/teardown | Current strict typed fields, 30 slots/31 roots, death-weapon clocks/ids/epochs and consumed/captured validation; historical <=47 migration is isolated in the save owner. The migration preserves saved global RNG but cannot recover a lost historical global bounce stream. Public current-invalid-state/legacy/RNG/reset/owner-lifetime coverage and built exact field save/owner projection/resume pass. |

Independent M5 receipts are scoped and kept distinct: TypeScript exit0; 21 distinct
motion cases across the recorded commands; Golem producer 1/1; server members 8/8;
renderer 4/4; save/wire 87/87; production Vite exit0. The compiled member journey
and later gameplay cases use the same runtime source identified by the
`c31b788c5fea0fcdb6ee324314a4e19bbe98a6deb92efe2d8b1d2adb312a9ba8`
manifest, not a commit of that name. The pre-ledger-update helper/source manifest
`d3f641c9c9d5d9799f792bc68f5461b0868490acff98e06f4322fc9077db03f3`
has 69 modified/new/deleted paths on the same real base.

The remaining-only compiled journey exits0 on Apple M5 Pro ANGLE Metal with page,
console and failed-response arrays empty. Its declared peer is an authoritative
actor fixture, not a second authenticated party/reentry receipt. Exact field
state survives the normal save codec and owner projection; the live compiled
host continues it. Real center pressure reaches dying state at
`-10.360000244379043` HP, and the retained screenshot is visible gameplay.
Original media still supplies the recorded 359-frame playback and six visible
samples, not exact inputs, Rush rank, hidden pickup identity or HP history.

Fixture/oracle corrections are explicit. The unchanged public 80-tick Rush test
keeps its x-distance-below10 oracle in its open collision fixture; the built scene
uses the established 512 pressure boundary and does not replace that regression.
The broader lane initially admitted only radius14 bodies; valid capture fixtures
now admit native Demon radius35 and existing enemy/Lantern bodies, with actual
spawned-body admission checked. A newly born fast Imp can leave contact range
before the next100-tick field query; the successful fixture waits the real query
boundary without altering field clocks, admission, flags or gameplay. Native
constructor seeding uses the maintained current-tick/lastStepTick-minus1 pattern.
Retirement assertions follow the seeded allocated identity while ordinary waves
continue. Normal Bonus offers are resolved through the picker UI before lethal
pressure rather than hiding their legitimate pause.

The two actual product reds in the later cutover were missing current-disk Golem
painter-root rejection and discarded captured-image clipping. Their strict
regressions pass after the shared decoder and draw-factory fixes. The former
mana fizzle, mismatched quickbar key, float32 position oracle and distant weapon
birth admission are separately qualified fixture failures, not product proof.
A receipt-printing Python error on scalar lines of pretty JSON was recovered from
the complete browser result without replay; the actual browser exit0 is distinct.

Report72's eventual integration must preserve its in-step webbedPlayers writeback
alongside these capture/maggot changes. Field position displacement remains
independent of raw Webbed walking decay/staff admission; captured Spider must not
clear a healthy Cocoon. Retain one painter stream and the highest strict transport
and save contracts. No unpublished sibling branch is adopted by these receipts.
The final immutable current-main canonical gate and normal deployment remain the
next boundary after the coordinator's actual publication-lock handoff.
