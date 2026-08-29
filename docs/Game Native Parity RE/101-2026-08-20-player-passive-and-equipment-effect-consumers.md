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
| 65 Enchant Staff | `mDamage` adds to both melee lanes; concentration action-rate factor is shipped `1.75`, not CFG text `2x`; every positive effective rank also supplies the selected-primary color to the persistent Staff attachment compositor | exact-ported through automatic StaffMelee/StaffSpin gameplay, action/contact presentation, and entry 010's always-on body/aura/hand correction with Mac browser proof |
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

The action/contact presentation set has no light-provider call or world-light
write. This does not exclude row 65's separately owned, always-on additive
Staff attachment geometry recovered by entry 010; that geometry is still not
a Region light. Knockback and Critical each birth additive BadGuys 15 SmokePuff at 25
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

## 2026-08-29 — Production Staff miss/proc wire reopening

### Reported smell and parity question

- Production Website `e7addc2b9ec7dfeed88d2208853150e976ab7979`, protocol
  105, remained active with zero game or Website process restarts, but four
  shared-Boneyard frames at `2026-08-29T17:37:31Z`, `17:39:15Z`,
  `17:39:53Z`, and `17:43:29Z` disconnected both connected browsers with code
  `4008`. Every close reason was
  `frame.primarySpells.transients[<index>] proc sound does not match its outcome`.
- Seven submitted protocol-105 diagnostic archives, `DiagnosticLogs` rows
  72..78, independently retain the same `client-error` at transient indexes
  13, 5, 2, and 12. The service journal contains no paired
  `simulation.tick_failed`, uncaught exception, or unhandled rejection.
- This is a secondary report in the already-covered automatic Staff contact
  system. The earlier closure recovered that action outcome is chosen at
  admission while marker-time targets are queried later, and explicitly
  dispositioned the target-departure branch. It nevertheless tested strict
  protocol only with a successful target, incorrectly making the proc cue a
  function of the earlier outcome alone. That omitted zero-accepted-target
  codec member is the process failure reopened here.
- Falsifiers: a full authoritative contact event with a mismatched cue; a
  targetless normal outcome that also fails; a correct name with only an
  invalid pitch; or failure limited to compact-delta/stale-baseline
  reconstruction would disprove the leading model.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Live production | NFO `chicago-quad36-h-10-m7b`; `solomon-dark-game.service`; deployed SHA above; protocol 105 | Four two-player close clusters share the exact Staff proc validator reason. The supervisor, Website, and Caddy remain active; both application units report `NRestarts=0`. | high-live |
| Submitted browser diagnostics | private `DiagnosticLogs` rows 72..78, captured `2026-08-29T17:37:34Z..17:43:32Z` | All seven archives report `client-error`, no dropped entries, and the same strict decoder stack in `game-protocol`; they differ only in the live transient index. | high-live |
| Existing retail instructions | sealed retail `SolomonDark.exe` 0.72.5, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; `PlayerWizard_StartStaffAction 0x00537AA0`, action callback `0x00550180`, `PlayerWizard_StaffContact 0x0053B9F0` | Outcome RNG belongs to action admission. Damage and physical target membership are re-queried at the later marker. A proc cue belongs only to a successful proc/contact, not to an outcome whose target set has become empty. | high-existing |
| Current producer trace | `stepPlayerStaffCombatSystem -> applyStaffContact -> createNativeStaffContactPresentation` at `e7addc2b` | The host preserves the action outcome but passes only accepted marker-time target IDs. The presentation producer correctly leaves `procSound` null, pitch list empty, and proc VFX absent when that list is empty. | high |
| Current decoder trace | `game-protocol.ts`, validator introduced by `ba77b8982` | The decoder derives expected cue and pitch count solely from `outcome`, so every legal targetless Knockback, Disable, Critical, or Whirl event is rejected before either client can present it. | high |

No new retail fact is required. The existing Staff/contact instruction record
already owns the complete action-versus-marker timing and successful-only cue
contract; this reopening corrects the Website protocol member that failed to
consume it.

### System boundary and membership inventory

Native system: **automatic Staff action, marker-time accepted contact, and
retained presentation wire lifecycle**, from outcome selection through the
later damage/physical queries, cue/VFX construction, keyframe/delta decoding,
audio replay identity, observer hydration, and teardown.

| Member / branch | Native/web owner | Disposition | Proof contract |
| --- | --- | --- | --- |
| Normal outcome, zero accepted targets | action plus marker query | `verified-already-at-parity` | no proc cue/pitches/VFX; targetless event round-trips |
| Normal outcome, one or more accepted targets | marker damage owner | `verified-already-at-parity` | hit-wood physical cues remain independent; no proc cue |
| Knockback, Disable, Critical, or Whirl with accepted targets | `0x0053B9F0` successful proc branches | `verified-already-at-parity` | exact sound identity, pitch cardinality/range, VFX, damage, and retained actors remain strict |
| Same four non-normal outcomes after every target leaves, dies, or rejects damage before the marker | action outcome plus current marker target query | `exact-ported` by this reopening | outcome remains authored; target IDs, proc sound, proc pitches, and proc VFX are empty; frame decodes |
| Two players acting on the same short-lived target | Website multiplayer authority adaptation | `exact-ported` by the same rule | one player's earlier accepted action cannot make the other player's later miss protocol-invalid |
| Damage target query versus physical-contact query | separate native passes in `0x0053B9F0` | `verified-already-at-parity` | hit-wood/Ether/Pike sound indexes remain legal even when the damage/proc target list is empty |
| Staff contact full keyframe | host snapshot projection and shared decoder | `exact-ported` | targetless non-normal event survives full-frame validation without widening invalid combinations |
| Compact delta, baseline recovery, and late join | replication/reconstructor plus shared decoder | `exact-ported` | the same event identity and fields reconstruct; no index-based repair or fallback |
| Player and developer-observer recipients | shared projected frame | `exact-ported` | both recipients accept the same targetless event; truly invalid cue/outcome pairs still fail closed |
| Generated Boneyard, Tutorial lesson 11, and custom/mod Arena | shared Staff combat owner | `exact-ported` by shared validator rule | no scene exception; target departure/multiplayer race is safe in each combat-enabled scene |
| Cue playback and replay suppression | `primary-spell-audio.ts`, contact-event identity | `verified-already-at-parity` | null cue remains silent; successful cues play once at their exact pitches |
| action retirement, player death/disconnect, world replacement | existing Staff/transient teardown | `verified-already-at-parity` | no event, audio identity, or repair state crosses teardown |
| malformed targetless event carrying a proc cue, or targeted event carrying the wrong cue/pitches | strict protocol boundary | `verified-already-at-parity` after conditional correction | remains rejected; the fix admits only the recovered empty-target state |

There is no browser-platform exception or approximation.

### Native ownership thread and recovered contract

- `0x00537AA0` chooses the action outcome and owns its RNG before the action
  advances. The marker callback occurs later: melee crosses progress three;
  Whirl reaches countdown zero on tick 18.
- `0x0053B9F0` re-queries the current damage shape and the separate physical
  contact list. A target admitted at action start can legally be absent,
  already dying, or otherwise unaccepted at the marker.
- The retained contact event keeps the selected outcome for action/presentation
  provenance. A proc cue, proc pitch sequence, and proc VFX exist only when at
  least one marker-time damage target is accepted. Physical hit-wood and Pike
  cues are a separate list and do not synthesize a successful proc.
- Website authority constructs that exact state once. Player and observer
  decoders must validate it identically on full and reconstructed frames. No
  client may infer a missing cue, rewrite the outcome, drop the event, or
  suppress a protocol error for genuinely inconsistent fields.

### Nearby-system findings

- The one `simulation.tick_lag` warning and three ordinary code-`1001` browser
  departures in the same live window have no matching decoder failure or
  process crash. Baseline-missing warnings recovered through their existing
  keyframe path. They are not causal members of this crash.
- The generic validator error covers cue identity, pitch cardinality/range,
  and swoosh pitch. The seven diagnostics alone do not identify which
  subpredicate failed; the deterministic host producer and targetless branch
  provide the discriminating evidence. Broadly relaxing pitch checks would
  patch the message rather than the cause.

### Confidence and open questions

- Confirmed: production revision/protocol/timestamps, four shared two-client
  failures, seven matching archives, no host-process failure, the producer's
  target-conditioned cue construction, the decoder's outcome-only assertion,
  and the already-recovered retail action/marker ownership.
- Inferred: each production frame lost its last accepted damage target between
  Staff admission and marker. The bounded archives do not retain raw frames,
  but every reachable targetless non-normal event deterministically throws the
  exact reported predicate while successful events and targetless normal
  events do not.
- Unknowns material to implementation: none. A raw production frame is not
  needed to distinguish the validator bug once the exact producer state
  reproduces the same failure.

### Web implementation consequence and validation contract

- Keep host simulation, outcome RNG, target queries, damage, cue/VFX
  construction, audio, and lifecycle unchanged. Decode `targetIds` once and
  require a proc cue only when the accepted target list is nonempty and the
  outcome is non-normal.
- Preserve exact successful cue mappings and pitch contracts. Continue to
  reject targetless events that carry a proc cue and targeted events with a
  missing, wrong, or malformed cue.
- Red/green protocol seam: materialize each of the five outcomes with zero
  targets through the real presentation producer; protocol 105 must currently
  fail the four non-normal rows with the production error, then the corrected
  candidate must round-trip all five. Every targeted row and every invalid
  cross-pair remains asserted separately.
- System seam: start a non-normal Staff action, remove the target before its
  marker, and require the resulting retained event to preserve outcome while
  carrying no target/proc/VFX; project and decode the authoritative frame.
- Mac Chrome: in a real two-player generated Boneyard, overlap Staff actions on
  a short-lived enemy or otherwise remove the target before one marker. Require
  the miss event on both player/observer recipients, continued connection, and
  empty page, console, failed-response, wire-decode, and host-error arrays.
- Run the complete supported Mac gate
  `/opt/homebrew/bin/bash ./scripts/validate.sh` on the exact rebased candidate.

### Implementation validation receipt

- Implementation: `game-protocol.ts` now decodes the accepted marker-time
  Staff `targetIds` before validating proc presentation. Only a non-normal
  outcome with at least one accepted target requires its exact cue and pitch
  program. Targetless outcomes require null/empty proc presentation; targeted
  events with a missing or wrong cue and targetless events with a fabricated
  cue remain strict errors. Host simulation, outcome RNG, damage/physical
  queries, VFX/audio construction, event lifetime, protocol 105, and save
  schema are unchanged.
- Regression coverage: the protocol matrix drains Normal, Knockback, Disable,
  Critical, and Whirl with and without targets, and asserts both invalid
  cross-directions. The real Staff system starts each of the four non-normal
  action families, removes its target before the marker, and proves the
  retained outcome has no target, cue, pitch, proc VFX, or Knockback actor.
- Red Mac candidate `d778e002e7098b4263538aed8355cdb12d6a3564`
  over base `e1655aae529294963fea6f5b21408f1373531a66` matched the local
  two-file manifest byte-for-byte. The canonical gate reached the Boneyard
  group and failed the new targetless case at
  `game-protocol.test.ts:3346` with the exact production message. One
  independent developer-observer test also timed out and is not used as crash
  evidence. Red log SHA-256 is
  `bbfa0d281fa2eeb079dd338cff552b2558c5257e19ee2adb1160b2de000ecfc1`.
- First corrected candidate `c20631f59aa787335b7b4ff57a0b86165c2dca46`,
  tree `817ab43fd1f08db117a0c3ee78b1dc043dce663a`, matched all four
  changed files byte-for-byte on a clean detached Mac worktree. macOS 26.6.2
  arm64 passed `/opt/homebrew/bin/bash ./scripts/validate.sh`: backend build
  had zero warnings/errors; `29/29` Website/backend contracts passed; strict
  formatting/lint/import/generated checks passed with 19 existing lint
  warnings and zero errors; the Staff system appeared green in the `320/320`
  prerequisite group; the protocol matrix appeared green in the complete
  `1720/1720` Boneyard/host group; ML passed `76/76`; every remaining
  frontend/desktop suite, production build, media policy, and bundle budget
  passed. Production `Game-DfQHUQiO.js` measured `264578` raw / `80327` gzip
  bytes against `524288` / `134144`. Green log SHA-256 is
  `475ef75518563e40cc8a742adae84622e467d91783ecad1b6367cecfce9ed642`.
- Mac Chrome `151.0.7922.174` loaded that production bundle, traversed the
  ordinary title/Create/Hub/generated-Boneyard/Gate/Solomon lifecycle, and
  admitted a rank-nine Staff action. A task-owned driver removed the staged
  hostile at action age three and fixed the already-selected outcome to
  Knockback. Host contact ID 2 and the independently reconstructed browser
  frame both carried `targetIds=[]`, `procSound=null`, and zero proc pitches;
  proc audio stayed at zero. The browser remained connected. Page/console,
  failed-response, and wire-decode arrays were empty. Browser log SHA-256 is
  `23337b8bf9d9655aa06c8411f61a83b9cacd745bf264c9f68fe96ed03d12ed76`;
  reviewed WebGL Boneyard screenshot SHA-256 is
  `8487200ada4a33286384e90a85cdbeee1cfbe7f24e01a7cda08efdd36a037e4a`.
- Publication rebase incorporated concurrent Phasing commit
  `6fb5551f079a20782a066600c2bb6f47afb29a59`. Exact pre-receipt
  candidate `d851d952482ec98fe4f52b598348981a90c8eb0c`, tree
  `3316f55ef0bcc958f0e72d04d0e09478e37aba4f`, and the clean detached
  final Mac worktree again matched all four changed files byte-for-byte. The
  first final gate attempt ran while Mac load exceeded 31 and hit three
  unrelated game-host/social/heartbeat timing failures; Staff regression 214
  and protocol regression 1372 remained green. That attempt changed no source;
  its log SHA-256 is
  `a28d51ce8ba18d33b612a0b7ba438e2adfa80d5c30bd4637511f8962b5bf43f5`.
- The unchanged rebased candidate then passed the complete canonical gate
  after the competing workflows cleared: `29/29` Website/backend contracts,
  strict checks, `321/321` prerequisites, `1721/1721` Boneyard/host tests,
  `76/76` ML tests, every remaining frontend/desktop suite, both production
  builds, bundle budget, and media policy. `Game-LknY2ugJ.js` measured
  `264578` raw / `80328` gzip bytes. Final gate-log SHA-256 is
  `df180da554acf504d8b69addb8d7a927a99a7edc07dd2ad54c5b01ce39434fbd`.
- The first final disposable driver attempt encountered a naturally selected
  StaffSpin and incorrectly rewrote it to Knockback; protocol correctly
  rejected that invalid kind/outcome pair. The corrected driver preserves
  Whirl for StaffSpin and uses Knockback only for StaffMelee; no repository
  source changed. Final Mac Chrome repeated the complete generated-Boneyard
  journey, removed the target at action age one, and carried contact ID 2 as
  targetless silent Knockback in both host state and the reconstructed browser
  frame. The browser stayed connected, proc audio remained zero, the runtime
  error surface stayed absent, and page/console, failed-response, and wire
  arrays were empty. Final browser-log SHA-256 is
  `9bd4c607283f30065f30ddafffb13032c764593574570861ea07da9257b93876`;
  reviewed WebGL screenshot SHA-256 is
  `2dbe2e56f61d68d0f6199c291cf412391d00c99364b01dfa8aa0db930fc9180d`.
- No browser-platform exception, material unknown, new retail fact, protocol
  version, save schema, or Mod Loader edit remains. This receipt is the sole
  post-validation documentation write; no runtime, test, build, asset, or
  protocol byte changed after the final green gate/browser candidate.
