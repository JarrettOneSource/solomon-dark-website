# 2026-08-20 — Player passive and equipment-effect consumers

## System boundary and evidence

This pass owns the complete Mind/Body passive rows 56..71 and the two-pass
equipment-FX refresh they depend on. The durable native authority is Mod
Loader `native-skills-and-spells.md` plus
`native-items-equipment-and-loot.md`: progression refresh
`0x0065F9A0/0x0065F5B0`, equipment passes `0x00656F60/0x00657310`, damage
resolver `0x0065FFF0`, mana resolver `0x006600F0`, and contact-time Deflect
owner `PlayerActorMagicDamage 0x00548150`. The machine-readable web table is
mechanically derived from the checked-in 47-recipe/7-set native item catalog;
it is not a second hand-maintained list.

| Skill | Native influence | Current disposition |
| ---: | --- | --- |
| 56 Mana Up | base max MP plus authored `mValue`, then equipment max-MP transform; refresh preserves current/max ratio | exact-ported in dense player skill state |
| 57 Channel Mana | base `0.1` MP/tick times `1+mValue/100`, concentrated `1+mConcentration/100`, then equipment recovery transform | exact-ported |
| 58 Meditation | idle counter, authored delay, total recovery multiplier, concentrated quarter-strength moving/acting ramp | exact-ported kernel and authoritative tick, including Staff-action activity admission |
| 59 Battle Mage | authored-row flag gate; applies after minimum-one/base reduction and before later flat/multiplier mana lanes | exact-ported for primary and all secondary value materializers |
| 60 Focus | global cooldown decrement factor; concentration owns one exact `Integer(100)` 75..99 instant-recharge branch at cooldown creation | exact-ported |
| 61 Siege Mage | authored-row flag gate; applies last after all damage flats, multipliers, per-skill, class, and element lanes | exact-ported for primary, secondary, DOT, summon, and Plane-Orb materialization boundaries |
| 62 Resist Magic | combined skill/concentration/equipment fraction before shield/Stoneskin interception | exact-ported |
| 63 Creativity | four-card/lower-requirement picker already owned by progression; fixed concentration slot A alone rolls `Integer(5)==1`, selects an eligible card, and applies it twice | exact-ported authority/protocol; full Skill Book UI follows in the loadout slice |
| 64 Health Up | base max HP plus authored `mValue`, then equipment max-HP transform; refresh preserves ratio | exact-ported |
| 65 Enchant Staff | `mDamage` adds to both melee lanes; concentration action-rate factor is shipped `1.75`, not CFG text `2x` | exact-ported through automatic StaffMelee/StaffSpin gameplay, animation, protocol, VFX, and audio; full browser receipt remains pending |
| 66 Telekinesis | pickup scalar `mValue*1.25`, doubled while concentrated | exact-ported through Orb pull/capture and Gold/Sack/Bonus pickup; full browser receipt remains pending |
| 67 Rush | movement factor `1+mValue/100`, then concentrated factor and equipment walk transform | exact-ported into authoritative movement |
| 68 Deflect | exact Staff type gate, one `Integer(100)` per deflectable contact, successful-only signed pitch, facing, global stock swipe, and nearby concentrated physical x5 reflection | exact-ported gameplay/event/audio; browser contact journey still required |
| 69 Resist Poison | skill/concentration/equipment fraction scales poison duration, not DPS | exact-ported |
| 70 Faster Caster | fractional Staff action progress; one-shot emission uses threshold crossing so faster rates cannot skip the marker | exact-ported primary authority and finite protocol clock |
| 71 Fortunate Flailing | Staff attack `Float(100)` plus four-way proc; concentrated non-normal damage x1.2 | exact-ported with all four contact branches and retained world effects; full browser receipt remains pending |

## Enchant Staff and Fortunate Flailing authority

`PlayerActorTick 0x00548B00 -> PlayerWizard_StartStaffAction 0x00537AA0`
scans the existing contact list in registration order and admits the first
target with strict absolute heading delta below 50 degrees, but only while the
equipped item is native Staff type `0x1B5C`. Every admitted action consumes
endpoint-inclusive `Float(100)`; `chance >= draw` consumes `Integer(4)` and
selects Knockback, Disable, Critical, or Whirl. Rank zero therefore retains
the native one-value zero-endpoint proc defect.

StaffMelee `0x0044AE50/0x0044B580` alternates the exact attachment programs
`0,4,5,6,6,6,6,6,6` and `0,1,2,3,3,3,3,3,3`. Its constructor consumes
`Float(.05000000074505806)` and then `Integer(8)`. The stored float32 action
rate begins from exact double `0.10000000149011612`; selector two alone
multiplies it by exact double `1.350000023841858`. Contact crosses progress
three once and the action retires only above progress eight. Concentrated
Enchant Staff multiplies the progress step by `1.75`. StaffSpin
`0x00448750/0x004487D0` instead consumes the one-word `RandomSign(1)` helper,
turns 20 degrees per tick at attachment pose three, and contacts exactly when
its 360 countdown reaches zero on tick 18; Enchant concentration does not
accelerate it. A live Staff action owns the player action slot, suppressing
competing cast inputs and duplicate Staff admission until the action retires,
but it does not suppress locomotion. The former claim that the action slot also
blocked movement, and the web input seal derived from it, are superseded by the
2026-08-28 instruction-closed correction below.

The marker always plays registry offset `0xEE0`, `sounds\\staffswoosh`, at
float32 pitch `1 + (storedActionRate - 0.10000000149011612)`. The earlier
`.05` subtraction was falsified by raw instructions `0x0055022A..0x0055024A`
and `.rdata` bytes at `0x007849E0..0x007849EF`; `.05` is only the jitter
bound. Each successful proc adds its own exact cue: Knockback offset `0x8B0`
and Critical offset `0x330` consume signed `Float(.1)` pitch, Disable offset
`0x3B4` uses pitch one, and Whirl offset `0xE5C` starts the same sample at
`1/.9/1.1`. All five untouched retail WAV hashes are pinned in the web
manifest and the retained contact actor is the one replay-resistant audio
identity.

`PlayerWizard_StaffContact 0x0053B9F0` owns the target and damage branch:

- Normal, Knockback, and Disable use rotated trapezoid
  `(-40,-70),(40,-70),(30,0),(-30,0)`. With effective Enchant rank zero the
  ordered result consumes `Integer(candidateCount)` and retains one; a learned
  rank retains all.
- Critical uses `(-60,-105),(60,-105),(45,0),(-45,0)` and retains every
  flag-2 center inside it.
- Whirl uses the strict native radius-100 query
  `distanceSquared < 100^2 + targetRadius^2`.
- Damage is `max(1, DamageResolver(row65,mDamage))`; Critical is times three
  and concentrated non-normal Flailing is another times `1.2`. Non-Whirl
  targets receive `min(total,2*total/count)` while Whirl applies full total to
  each target.

The same callback then performs a distinct physical-contact pass over the
player's stored contact list. It preserves list order and requires the same
strict below-50-degree heading gate. After the rank-zero damage-candidate
`Integer(candidateCount)` draw, when present, each physical contact consumes
`Float(1)` and writes target `+0x22C = -(1+draw)`; the recovered live consumer
is Imp vertical velocity. It then consumes signed `Float(.1)` and plays
registry offset `0xEB4`, `sounds\\staffhitwood`, at pitch `1+draw` and point
gain. Ether alone consumes another `Float(200)`, succeeding only when the draw
is nonzero and no greater than progression `+0xC8` (the secondary Staff damage
accumulator). Success attaches `Mod_Knockback 0x1B6D` with normalized
away-from-player displacement six for five collision-aware ticks.

If that successful Ether contact is a Skeleton whose live weapon selector is
five, `0x00484EA0` clears the selector and `0x00484B30` rebuilds its action
program as unarmed while retaining already-derived damage stats. It plays
`sounds\\pikebreak__stream` at registry offset `0x13E4`, emits one additive
perspective BadGuys 15 flash 75 units along the Skeleton heading at scale
three/alpha one/loss `.025`, and writes a white full-screen Region flash at
alpha one/loss `.1`. The Region flash is not a world light. Seven world-owned
BadGuys 55 `Anim_Bouncer` children consume one initial `Float(360)` plus seven
words apiece: constructor `Float(3),Float(20),Float(360),Float(10)`, radial
`Float(10)`, then signed `Float(10)` for the next angle. This is exactly 50
presentation RNG words. Each child is linked and ticked once immediately,
uses alpha timer `2*.75 = 1.5` with `.015` loss, normalized radial velocity
`(1.5x,1y)`, X-only two-velocity spawn lead, native gravity/bounce progress,
`.65` bounce and optional horizontal damping, and the generic conditional
bounce-audio draws. It draws BadGuys 55 once with no invented shadow, scale,
tint, or light and retires after its hundredth visible reconstructed state.

Knockback, Critical, and Whirl create native type `0x7E9`. Their respective
queries are 80-degree/radius-100/push-150, 60-degree/radius-100/push-50, and
full-circle/radius-100/push-50. The retained actor moves its construction-time
targets collision-aware by `min(remaining,10)` per tick. Its terminal update
adds 200-tick Dazzle and consumes signed `Float(45)` per surviving target for
heading perturbation. Disable permanently multiplies target movement by
`.75` and the flag-2 action lane by `.5`; repeated hits compound as native.

The complete presentation set has no light-provider call or world-light
write. Knockback and Critical each birth additive BadGuys 15 SmokePuff at 25
units along heading, scale eight, alpha one, loss `.05`; renderer
`Anim_SmokePuff 0x00449840` selects additive around the shared Fade draw, then
restores normal. Its constructor still spends an overwritten `Float(.05)` and
`Float(2)` angular draw. Disable
births exactly 50 additive BadGuys 45 MoveFades at the damaged-target mean,
using one `Float(360)` seed followed per child by `Integer(5)`, `Float(3)`, and
`Float(.75)`, with scale `.25..1`, alpha `1.5`, loss `.05`, and velocity
factor `.92`. Critical additionally births additive BadGuys 40 at Y minus 15,
speed five, scale four, alpha two, loss `.25`. Whirl births additive BadGuys
88 at the player with `Float(360)` rotation, scale three, alpha `1.25`, and
loss `.1`. Each tinted member uses the caster element color.

The Website owns these as server-stepped transients sharing the existing
primary actor allocator and combat RNG, target-owned persistent Disable
factors, collision-resolved Knockback requests, strict protocol variants,
state interpolation, exact ten-pose Clothes attachment banks, pure VFX plans,
and semantic audio contacts. The physical-contact pass additionally owns Imp
vertical impulse, Ether's five-tick contact Knockback, Skeleton disarm/action
rebuild, replay-safe wood/Pike audio, the Region flash, and the exact retained
Pike debris presentation. Non-rendered action/contact/Knockback actors never
gain a placeholder sprite. Focused coverage pins RNG word counts, strict
geometry boundaries, target ordering, damage distribution, lethal-contact
Knockback ordering, persistent factors, actor lifetimes, all VFX records and
recurrences, protocol rejection, renderer/light disposition, animation poses,
audio hashes/order/no-replay, and an authoritative Boneyard contact journey.

## Telekinesis and ground-reward consumers

The executable-wide read census of refreshed progression `+0xCC` closes the
consumer set to exactly Orb `0x005E62E0`, Gold `0x005E66B0`, Sack
`0x005E6B50`, and Bonus `0x006039C0`. Row 66 stores float32
`mValue * 1.25`; its authored values are one at rank zero and five at rank one,
so the exact factors are `1.25` and `6.25`. Concentration doubles the stored
field to `2.5` or `12.5`. Goodie activation/materialization, item insertion,
and Ether Drain do not read this lane. Calling equipment FX owns the separate
Orb-pull scalar `+0xBC`; it never expands capture or non-Orb pickup radii.

The complete gameplay formulas are:

- Orb scans player slots `0..3` in stored order. Pull is strict within
  `60 * pickupFactor * orbPull`; capture is strict within
  `20 * pickupFactor`. Every qualifying non-capture candidate moves the same
  Orb another normalized `1.5` units during that tick, so later slots observe
  the updated position.
- Gold and Sack use strict `30 * pickupFactor`; Bonus uses strict
  `20 * pickupFactor`.
- Gold alone, when `pickupFactor > 1.25999999`, consumes `Integer(15)` and
  captures only on result one. This is one of fifteen outcomes, not 1/16 and
  not a cosmetic roll. A failed roll leaves the actor live for the next tick.

Telekinesis has no constructor, animation, light registration, sound request,
or standalone world actor. Its visible/audio consequences are exclusively the
already-authoritative reward actors moving or retiring sooner and those
actors' existing exact pickup children/cues: Orb normal BadGuys 15/no light and
`gotorb`; Gold two additive BadGuys 83/no light and `pickupcoin`; Sack
`pickupbag`; Bonus result text/effect. No range ring, glow, particle, or loop
may be invented for the skill itself.

Stock is process-local: Orb attraction can be caused by any of four slots but
only slot zero receives HP/MP, while Gold/Sack/Bonus check slot zero. The web
multiplayer port retains its previously published host-authoritative ownership
adaptation: every eligible participant contributes its own exact factor in
stable participant order, and the participant whose strict capture succeeds
receives the reward. This deliberately avoids deleting a guest-attracted Orb
while crediting an unrelated host, without changing native geometry, ordered
motion, draw cadence, or single-retirement semantics.

The dense player runtime now projects both independent scalars into
`NativeLootModifiers` at the Boneyard world boundary. Tests pin rank-zero,
rank-one, concentrated, and Calling values; strict `375/125/187.5/125`
Telekinesis boundaries; Calling's `750` pull without capture expansion; all
four reward classes; the Gold three-word successful gate-plus-pitch sequence;
and a host GameSimulation rank-zero-versus-rank-one Orb trajectory. The exact
loot/runtime/simulation/protocol/timeline/presentation/audio slice passed
`157/157` with the test TypeScript build green.

## Equipment FX ownership

The generated resolver preserves native sink order (Hat, Robe, three Rings,
Amulet, Weapon), appends only completed exact-recipe set FX, moves any source
containing Grant Skill to the end of the skill pass, and then runs the passive
stat/feature pass. It covers all parsed IDs 1..39: skill rank grants/boosts,
global/class/per-skill damage and mana lanes, cast speed, recharge, recovery,
resistance, max resources, pull, walk, gold, melee, the twelve feature bits,
Weld Effect's unusual additive-percent rule, and Weld Calling. Random gear
uses its serialized `nativeEffects`; named gear resolves the authoritative
recipe table; recipe-less random gear never completes a set.

Current consumers are closed for effective ranks, primary/secondary damage and
cost, cast speed, recharge, max resources, recovery, movement, Staff melee,
Orb Pull, all three resistances, and the five shipped maximum-set branches.
Mindblast's retained world program is now also closed. Still-open adjacent
consumers are equipment Gold Bonus, HP recovery during Regenerate composition,
and Welding feature/scalar consumption. They stay explicit here rather than
being mistaken for completed because the pure resolver exists.

## Mindblowing Ring level-up event

`0x005C88B0` runs the ordinary 180-tick PlayerActor level-up effect first, then
tests equipment feature `FX_MINDBLAST = 0x400` and calls
`0x0052A220 -> 0x00645B50`. The call passes the player element in both element
slots, current position, exact float32 scale nine, current level, and the cyan
color vector. The factory requests `magicshieldexplode` at pitch one, then
`bigfire` at pitches one and `.8`, all at native point gain and in that order.

The complete retained presentation is:

- one normal BadGuys 15 fade at `(x,y-25)`, scale `9*6=54`, alpha one,
  loss `.025`;
- three additive cyan Clothes record 2 `Anim_FadeScale` rings at `(x,y-35)`, initial
  scale `4.5`, alpha `1.5`, loss `.025`, and independent scale multipliers
  `1.1`, `1.05`, and `1.025`;
- two additive BadGuys 158..167 sprite arrays at the origin, scale ten, with
  `Float(360)` rotations and frame steps `.075/.1125`;
- exactly 100 cyan FuzzySpears. Each consumes `Float(360)` heading,
  `Float(2)+3` speed, `Integer(5)` with result two doubling speed,
  `Float(1)+1` alpha, and `Float(1.5)+2` scale. It begins 75 units along the
  heading, multiplies velocity by `.95`, and loses `.00875` alpha per tick.

Construction therefore consumes exactly `2 + 100*5 = 502` active RNG words.
The native FuzzySpear draw also consumes globally interleaved per-frame signed
presentation jitter. The web preserves that visible signed lane through a
stable event/age hash rather than stealing words from combat RNG; constructor
identity, distributions, motion, alpha, and all 502 authoritative words remain
exact. Clothes record 2 is extracted as the exact 81x81 retail crop and pinned
at SHA-256
`9312387b1ba6a8eba523eaf955504c564f39aec89e1d67fbfd10e358991a627e`.
None of the burst children submits a world light.

The direct-damage branch is narrower than the earlier ledger claimed:
`0x00646345` requires the first element parameter to equal zero, and the stock
element catalog maps zero to Ether. Only an Ether bearer queries flag-2
targets at strict native radius `9*55 = 495` and applies `level*.5`; Fire, Air,
Water, and Earth still receive the complete audio/VFX/Shockwave without direct
damage. The web uses stable target order and the common strict circle rule
`distanceSquared < 495^2 + targetRadius^2`, routes damage through the ordinary
enemy shield/death/event authority, and retains its damage cues.

Every element also spawns Shockwave `0x7E7`: radius 75, growth eight per tick,
life `.35` with `.01` loss, fade below `.0375` by multiplying alpha `.9`, and
no damage. On each tenth post-birth age it admits each flag-2 target once and
installs 400-tick Dazzle. On every even age thereafter it collision-resolves a
normalized outward push of `alpha*8` for the retained target set. Provider
`0x005E7AA0` publishes one actor-manager Region light at wave position,
intensity alpha, radius `waveRadius/140`, and no directional shadow.

The multiplayer adaptation follows the already-authoritative level-up owner:
shared progression/offer state may advance the cohort, but only the credited
source player whose PlayerActor presentation was armed emits Mindblast. The
reward path consumes the 502 RNG words at the level event, registers the light
in native actor order, applies immediate Ether damage, and withholds the two
new actors from that tick's actor step so the first replicated state is age
zero. Public host-authored XP uses the same path. Strict protocol reserves
nullable skill ownership exactly for the burst and wave actors; audio is keyed
to burst identity and baselines live snapshots without replay.

Focused coverage pins the source-only multiplayer edge, reward-order RNG,
age-zero births, Ether-only strict boundary damage, target damage events,
Shockwave one-contact Dazzle and normalized eight-unit push recurrence,
provider light, 502-word construction, every visible layer and lifetime,
Clothes asset hash, strict actor protocol, interpolation/copy, and three-cue
audio ordering/no-replay. Browser/Mac receipt remains part of the final
all-skills gate.

## Corrected Deflect authority

The old ledger stopped at a harmless refresh-side missing-property read and
incorrectly called concentrated Deflect inert. Raw instructions prove the
separate event path: `0x005481A6` draws `RandomInt(100)`, `0x005481AF` reads
progression `+0xB8`, and `0x005481BC` rejects `draw >= trunc(chance)`. Success
faces the source and requests swipe feedback at `0x005481C4`.
`0x00548274..0x005482D7` checks concentration slots 16/20 for ID 68 or Mind
Chug; with a positive physical hit and nearby non-null source,
`0x0054837B` multiplies by the exact `5.0` constant and `0x005483A3` damages
the original source. The web attaches the successful pitch to the already
authoritative attack/projectile event ID, so audio cannot replay or spatially
drift from the cancelled contact.

## Verification status

The pure equipment catalog/resolver, all static passive formulas, native
offensive ordering, concentration selection, Mind Chug, Mindstar/equipment
rank composition, Meditation, and the complete automatic Staff action/contact
system have focused tests. On the exact integration tree, the Staff/passive/
simulation/protocol/presentation/audio set passed `174/174`, the complete
Boneyard command passed `996/996`, TypeScript and lint/import boundaries were
green, and the production frontend/game-host build plus bundle-budget gate
passed. Browser Staff/Deflect/cast-speed/equipment journeys, Mac mini, and
publication receipts remain deliberately pending until Skill Book, Welding,
the residual per-skill audit, and the final Mac/browser gate close.
