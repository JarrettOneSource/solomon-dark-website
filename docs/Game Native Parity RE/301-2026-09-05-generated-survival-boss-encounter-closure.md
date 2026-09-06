# 2026-09-05 — Generated survival boss encounters

Status: native recovery and candidate implementation complete; final Mac gate
and per-member browser acceptance are in progress.

## Reopened boundary and cause

The request is to find and implement every missing boss in the web port.
Website `9005eb99` constructs Slumpgut and Deep Portals but does not construct
Ironmaw, Foulshaft, Heartmonger, Dire Sirmin, Dire Aliss, Dire Lucritius, or The
Discorporeal. The eight ordinary `wave.txt` families do not enumerate survival
bosses: `WaveData_Parse 0x00632730` independently constructs their recipes,
start-wave triggers, scripts, and health-threshold triggers.

The earlier enemy census in entry 091 classified DemonSkull, DireFaculty, and
Heartmonger as story-only without following the generator's MonsterRecipe and
TriggerControl membership. That skipped the required lateral construction
sweep. The survival exclusion is falsified for all three classes. Entry 051's
Slumpgut and Portal passes recorded the other recipes but explicitly excluded
their producers. This investigation reopens that whole generated boss system.

The system boundary is the complete generated survival boss roster, its
trigger and script clocks, configuration, hostile actors, owned summons and
projectiles, damage and death, presentation and audio, featured-boss display,
wave release, save/restore, replication, and teardown. Ordinary Spider waves,
general Bonedit bytecode interpretation, and story scene progression have
independent producers and are outside this boundary. Existing ordinary enemy
implementations remain the owners of the Skeleton, Archer, Imp, and Zombie
behavior reused by boss recipes and summons.

## Evidence and provenance

| Evidence | Source | Confirmed result |
| --- | --- | --- |
| Executable identity | retail 0.72.5 `SolomonDarkAbandonware/SolomonDark.exe`, preferred base `0x00400000`, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` | Rehashed for this investigation. |
| Fresh static analysis | canonical `SolomonDark.gpr` and `SolomonDark.exe`, read-only replica pool | Recovered all three boss constructors, initializers, ticks, renderers, event dispatchers, deaths, and Crow ownership. |
| RE tool provider | read-only Mod Loader `scripts/Invoke-GhidraHeadless.ps1`, SHA-256 `b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`; `decompile_targets.py`, SHA-256 `899167ca42624e09f26d22233365631a6ee8b3d106e337e20b77574894e97465` | No Mod Loader source or repository state was changed. |
| Generator instructions | complete `WaveData_Parse` instruction listing `0x00632730..0x006384A2` | Whole-function decompilation exceeded its timeout; raw instructions provide the construction oracle. |
| Complete preserved source census | twelve exact `.boneyard` sources matching the twelve SHA-256 values in `native-generated-boneyards.ts` | 176 MonsterRecipe records: 84 newly in-scope boss rows, 12 Slumpgut rows, and 80 Portal rows. All trigger/script parameter lists decoded. |
| Web causal trace | `boneyard-wave-schema.ts`, `boneyard-wave-director.ts`, `boneyard-enemy-config.ts`, `boneyard-enemy-store.ts` | Only Slumpgut and Portal have independent boss producers; the three missing native classes are absent from the enemy type union. |

The preserved generated files are static serialized evidence, including files
originally saved by loader sessions. They are not labeled clean-stock captures.
The exact recipe/script facts are reconciled against fresh retail instructions.

## Membership census

The dispositions below record the completed native implementation. Final Mac
acceptance is recorded separately; intermediate receipts later in this document
retain their original investigation context.

| Member | Disposition | Native owner | Required behavior |
| --- | --- | --- | --- |
| Ironmaw | `exact-ported` | generated Skeleton recipe and randomized type-2 start-wave trigger | Four authored weapon variants across the twelve sources, armored body, headgear 4, independent spawn, linked miniboss death reward. |
| Foulshaft | `exact-ported` | generated Archer recipe and type-2 script | Headgear 5, attack speed 3, fire multishot, timeline hold, initial ten Archers and continuing Archer/Skeleton reinforcement pairs, linked miniboss death reward. |
| Heartmonger | `exact-ported` | type 1011; constructor `0x0048B970`, init `0x00488F20`, tick `0x00489000` | Five owned Crows, 5-percent blindness selector, skelefriends mode 3, boss-count wait, completion Skeleton spawns. |
| Heartmonger Crows | `exact-ported` | type 1012; constructor `0x00475480`, tick `0x0047EA70`, strike `0x0047A160`, render `0x004A1490` | Orbit, target acquisition, dive and strike, blindness, return, parent-owned updates, detached post-death flight. |
| Dire Sirmin | `exact-ported` | DireFaculty type 1010, primary 0 / secondary 0 | Death Missile and Acid Pain. |
| Dire Aliss | `exact-ported` | DireFaculty type 1010, primary 1 / secondary 1, female | Blightning and Tragic Circle. |
| Dire Lucritius | `exact-ported` | DireFaculty type 1010, primary 2 / secondary 2 | Direball and Ring of Dire. |
| Faculty shared controller | `exact-ported` | constructor `0x00474E50`, init `0x00488E90`, selection `0x00475340`, tick `0x0049D0D0`, event `0x004804D0`, render `0x0049DF30`, death `0x0049E8F0` | Three actors share one encounter barrier; each keeps independent cast and secondary cooldown state. |
| The Discorporeal | `exact-ported` | DemonSkull type 1008; constructor `0x00474660`, init `0x004871F0`, selection `0x00474930`, tick `0x004963C0`, render `0x004974D0`, event `0x00498180` | Starts with all four capability bits clear; health triggers enable the four attack capabilities. |
| Discorporeal health transforms | `exact-ported` | type-12 triggers at 80, 60, 40, 20 percent; `unholytransform=1..4` | One trip per threshold; immediate capability OR into all live DemonSkulls, independently of active actions. |
| Discorporeal attacks and children | `exact-ported` | EyeLaser 2047, UnholySpit 2043, GreenFire 2042, GreenImp 2044; mouth beam `0x0044FFE0`, spit action `0x00449A00`, spit impact `0x005EA6F0` | Eye pair, beam contacts, traveling spit, persistent fire, imp payload and inherited combat identity. Spit Imps augments spit; it is not a fourth scheduled ranged attack. |
| Faculty attack graph | `exact-ported` | SkullMissile 2048, RainOfBones 2049, TragicCircle 2050, DarkFireball 2052, DireFire 2053, EvilEmber children | Native geometry, contact effects, clocks, assets, and lifetime. |
| Stock inert Faculty selectors | `exact-ported` | primary 3 Faust Jet, secondary 3 Thing of Ice | Preserve the absence of event-dispatch behavior; compiled labels do not justify invented spells. |
| Slumpgut | `verified-already-at-parity` | 12 existing recipe rows and type-9 Zombie-count trigger | Verify existing behavior and shared boss accounting remain correct. |
| Deep Portal 1..7 | `verified-already-at-parity` | 80 existing recipe rows and independent scripts | Verify existing placement, ejection, boss barriers, and concurrent later phases remain correct. |
| Lesser Demon | `verified-already-at-parity` | type 1009 in ordinary wave table | Existing wave-owned enemy, already implemented; check shared factory/count/render effects of the roster extension. |
| Boss HUD and reward ownership | `exact-ported` | featured-enemy prefix `0x005D257E..0x005D2AEF`, common death/reward path, linked Miniboss Die script | Use authoritative boss identity and health; preserve ordinary and scripted rewards. |

## Fully extracted authored recipe facts

All newly in-scope recipe fields are identical across the twelve sources except
allocation/link UIDs and Ironmaw's weapon selector. Trigger wave labels and
post-boss Skeleton counts also vary with the source generator output. They
must remain associated with that source, rather than being copied from one map.

| Recipe | HP | Primary / secondary / tertiary / extra | XP bonus | Native family fields |
| --- | ---: | --- | ---: | --- |
| Ironmaw | 320 | 6 / 0 / 0 / 0 | -160 | weapon enum 0..3 in corpus, headgear 4, armor byte 1 |
| Foulshaft | 640 | 3 / 3 / 0 / 0 | -320 | headgear 5, arrow enum 1, range enum 3, extra arrows 2, volley enum 1, recipe byte `+0x95=1`, cast mode 3, attack speed 3 |
| Heartmonger | 2000 | 10 / 0 / 0 / 0 | -1000 | 5 Crows, blind enum 1, skelefriends enum 3 |
| Dire Sirmin | 2010 | 15 / 10 / 0 / 0 | -1005 | male; primary/secondary 0/0; body color `(1,.5,0,1)` |
| Dire Aliss | 2010 | 25 / 20 / 0 / 0 | -1005 | female; primary/secondary 1/1; body color `(1,.25,1,1)` |
| Dire Lucritius | 2010 | 45 / 60 / 0 / 0 | -1005 | male; primary/secondary 2/2; body color `(.75,0,0,1)` |
| The Discorporeal | 17500 | 45 / 45 / 20 / 10 | -1750 | capability bits initially zero; four threshold-triggered transformations |

The ambiguous parser field names `shield`, `shieldOthers`, and `behaviorCount`
are serialized offsets reused by different native classes. They must be
interpreted by the owning class; a Faculty gender byte is not a shield.

### Headgear and exact atlas membership

Fresh BadGuys builder `0x004E0DD0` reconstructs six headgear-array pointers at
manager `+0x4BA8..+0x4BBC`, in order `+0x4978`, `+0x49A8`, `+0x49B8`,
`+0x4988`, `+0x4998`, `+0x49C8`. The Skeleton/Archer/Mage renderers index this
table using the actual actor headgear byte at `+0x230`; they do not reconstruct
it from wave flags. The current Website's four-entry flag-derived lookup loses
the authored Ironmaw and Foulshaft selectors.

All records and attachment points from `Faculty.bundle` (523 records),
`Heartmonger.bundle` (380), and `Unholy.bundle` (219) were extracted through the
existing Website atlas extractor and read-only native bundle parser. Each
source atlas is `1024 x 1024`; none of the 1,122 records is empty. These are
exact source crops, not generated replacement art.

### Baseline validation

Before implementation, the detached Mac worktree at Website `9005eb99` passed
all 92 tests in `core-server/boneyard-enemy-store.test.ts` with Node 22.17.0.
This is a baseline receipt only; it does not prove any missing boss is ported.

### Equipment construction and destruction

`ApplyConfig 0x00462790` copies Skeleton recipe `+0x80/+0x83/+0x78`
into headgear `+0x230`, armor `+0x232/+0x233`, and weapon `+0x231`.
These are assignments after recipe HP/damage, not wave-flag stat upgrades.
`SkeletonArcher_Tick 0x00485200` reads `+0x268` for strafing; config
copies recipe `+0x95` into this byte. Recipe `+0xC0=3` enables the
range-easy first-shot range and restores it after the shot. The actor's
range-easy flag and strafing state are independent.

Common Skeleton death `0x0048D2A0` admits headgear 1, 2, 4, and 5.
It computes the fragment-pair index as `(headgear - (headgear > 3 ? 2 : 1))*2`
and draws one of the two records. In BadGuys these pairs begin at 92, 94,
96, and 98. Headgear 0 and cloth hood 3 do not emit a helmet fragment.
The same branch covers Skeleton, Archer, and Mage.

`FireArrow` is selector 1 and `PoisonArrow` is selector 2: the actual Arrow
constructor `0x00477B90` splits selector-1 damage between physical and fire,
whereas selector 2 writes poison damage. Foulshaft's serialized selector is 1,
so its arrows are fire arrows. The initial interpretation of this byte as
poison was rejected before implementation. Its chase-speed multiplier is 1.5,
its accuracy mode is 3, and its range-easy mode is independently 3.

The same flag-derived presentation assumption affects authored arrow payload,
Mage element, burning, and Zombie flyblown state. These evaluated selectors
are projected explicitly for every family alongside equipment. Rendering no
longer reconstructs the authored state from the wave-flag list.

### Archer strafing and Foulshaft reinforcements

`BuildEnemyConfig 0x0046B390`, internal code `0x30`, sets recipe `+0x95`.
Foulshaft's first ten reinforcement Archers therefore receive hood code 11
and strafing code 48, followed by HP-up code 1. Code 48 is a script-only modifier; the text wave parser
does not emit it. Later Archer/Skeleton reinforcement pairs retain HP-up code 1, with no hood or strafing modifier. `0x0046BB50` reads every positive variadic parameter from index 10 as a modifier; the final 1 is not a count.

The Archer constructor `0x0048A6B0` draws a signed unit into `+0x25C`, and
zeros turn blend `+0x260` and movement ramp `+0x264`. During action `0x11`,
`0x00485200` increases the ramp by .01 up to 1, constructs a point at the
current target distance and target-to-Archer angle plus `turnBlend * 10`
degrees, and tests that segment with native mask 0. A blocked segment zeros
the direction, blend, and ramp; the zero direction prevents further strafing.
An admitted movement is the normalized point delta times the native movement
scalar, ramp, and .25. Gait advances by `movementScalar * ramp^2 / 25`,
stride by `movementScalar * ramp * 4`, and turn blend moves .005 toward the
signed unit. Other actions clear blend/ramp while retaining direction.

The Archer's limb heading is independent from its shot/body heading:
`0x00485200` writes `+0x26C`, and renderer `0x0048F450` samples its eighteen-way
bucket independently. This requires an authoritative limb-heading sample.

### Web ownership cutover

The previous 7,696-line `core-server/boneyard-enemy-store.ts` was split before
adding boss behavior. The file remains the tick/store orchestration owner.
`boneyard-enemies/types.ts` owns durable actor and store contracts;
`spawn.ts` owns construction and child admission; `damage.ts`, `control.ts`,
and `death.ts` own their respective lifecycle transitions. Family modules
own Skeleton/Archer/Mage, Imp, Zombie, Wraith, Demon, Coffin, and Maggot state
updates. `movement.ts` owns steering, `projectiles.ts` owns projectile contact
and travel, and `projectile-effects.ts`/`particles.ts` own emitted presentation
objects. Consumers import these owners directly. No forwarding barrel or
second implementation remains.

The first split-only candidate was byte-identical across 61 changed files on
local and Mac worktrees. Its Mac enemy-store suite passed 92/92 and the
TypeScript project build passed. This proves the structural cutover's baseline,
not the missing-boss behavior or the final candidate.

The configuration cutover separates evaluated types, wave flags, and authored
recipe validation into `boneyard-enemy-types.ts`, `boneyard-enemy-flags.ts`, and
`boneyard-enemy-recipes.ts`. Presentation separates skeleton-family composition,
other creature composition, sprite transforms, and the plan dispatcher.

Boss identity and actual equipment must travel through the network snapshot.
Before extending the 12,671-line protocol decoder, its parsers will move by
owned contract: primitive JSON validation, client/server messages, player
state, inventory, hub state, scene/world frames, enemy actors, enemy events,
spell projectiles/transients, secondary abilities, and content. Each consumer
will import the actual moved owner. The wire version changes with the final
snapshot schema; older schemas are not retained as a parallel decoder.

### First encounter implementation receipt

The skeleton-boss recipes and independent generated-wave producers now bind all
24 Ironmaw/Foulshaft source rows. Ironmaw's one-shot producer leaves the timeline
running. Foulshaft's producer holds the timeline, creates its ten hooded,
strafing, HP-up Archers at ticks 0..900 in steps of 100, then emits HP-up
Archer/Skeleton pairs every 200 ticks while any boss remains. Release advances
one wave. Spawn intents use the existing dark-position resolver and the native
recipe pathfinding mode 2; ordinary reinforcements retain mode 1.

Fresh condition dispatcher `0x00689750` and integer comparator `0x006819C0`
prove that the single-argument generated start-wave condition uses comparator
0, exact equality. `0x00469580` also proves featured-enemy admission: nonzero
classification except 3 selects the actor only when game `+0x1C2C` is empty.
The remaining writers and teardown of that featured pointer still require
closure before the HUD implementation. Existing Portal catch-up comparisons
must be reviewed against the now-confirmed exact-equality trigger contract.

Mac focused suites passed 257/257 after the first encounter cutover: enemy
store, wave director, equipment, enemy presentation, compact entity replication,
and the strict game protocol. This is an intermediate receipt. Heartmonger,
Faculty, Discorporeal, the featured HUD, full validation, and browser acceptance
remain unfinished.

## Validation contract

Run all automated checks and acceptance on the Mac mini against the byte-exact
candidate. Use existing public configuration, enemy-store, wave-director,
save-document, protocol, and renderer-plan interfaces. Assert each of the
84 newly included source recipe rows, each encounter phase and interruption,
all native attack branches, summoned-child lifetime, per-boss damage/death and
reward behavior, and deterministic save/restore. Complete the canonical
`/opt/homebrew/bin/bash ./scripts/validate.sh` gate and a built-client Chrome
journey that observes every missing boss, its attacks, and encounter release,
capturing page/console/failed-response errors. Publish the validated candidate
through the subsequently authorized normal push to main, then remove this
task's temporary worktrees, processes, and files. Deployment is separate.

### Heartmonger and Crow causal closure before implementation

Fresh instruction/decompile continuation through `0x00624B40`, `0x0057F0E0`,
`0x0057F980`, `0x0063F850`, `0x00473220`, and the complete Heartmonger vtable
establishes the remaining ownership:

- Actor `+0xCC` is inbound light intensity; `+0xD4` is the render admission
  predicate, with both camera and lighting participating. Heartmonger latches
  `+0x2B4` after intensity **strictly above** 0.4000000059604645. It never
  clears the latch. Crow attack cooldown resets to 100 while admission is false.
- The summon counter starts at 200. Modes 0..4 map to disabled, 350, 250, 150,
  and 75 ticks at the native 100 Hz clock. The active counter decrements before
  testing `< 0`; mode 3 therefore repeats every 151 ticks after the first 201.
  The Archer draw is one of five; its independent one-of-five modifier draw
  adds both HOODED and LEADING. Skeleton instead receives HELM one of five.
  The first Imp roll is one of ten, and the second Imp roll occurs only after
  the first succeeds. Each successful Imp batch has an inclusive 1..2 members;
  the Skeleton equipment flag list is cleared before these Imp births.
- Crow target polling occurs every fifth Crow age tick, at shared parent
  cooldown zero and speed **at least** maximum. The decompiler's unordered
  float expression here means `>=`, not `>`. Eligible actors are visited in
  native player-list order. Squared distance is strictly between 10000 and
  22500, with heading error strictly below 20 degrees. The first match locks
  the target and its position, and sets parent cooldown to inclusive 50..125.
- Orbit uses shared turn helper `0x00410D60`'s -1/0/+1 result times 1.25,
  not proportional angular interpolation. Movement is speed times 2.5.
  Dive locks heading, starts at maximum speed times 2.5, integrates height
  slope per distance, and advances speed as `(speed + .1) * 1.01`. Crossing
  to height 15 or below applies the parent's primary damage to the locked target.
  Blindness requires local current HP > 10 after damage and no active shield;
  the selected chance is 0/5/10/30/100 percent, and the blindness setter adds
  one second to its sampled 1..2.5 second duration before converting to ticks.
- `0x0049FB60` creates one extra Crow at the dead parent's root, height 60 and
  speed -1, then detaches all Crows into the Arena effects list. Detached Crows
  spiral, accelerate, climb, and retire when their projected point leaves the
  native viewport. They have no enemy census, experience, loot, or hit body.
- Heartmonger inherits Skeleton action handlers but never schedules them: its
  `+0x8C` eligibility vtable entry `0x004745B0` returns false, which skips
  `+0x94` at `0x00483C20`. Its attacks are the Crows. Its own art banks are:
  Heartmonger 200..379 (10 x 18 legs), 146..199 (3 x 18 torso),
  110..145 (2 x 18 head). Crow bank 2..109 is 6 x 18. Attachments are authored
  points 2 on legs and 0 on torso, with native root-relative unscaled offsets;
  layers scale by actor scale * 1.05, and the head adds * 1.33.

Implementation ownership: `native-heartmonger.ts` owns summoning and the
parent's persistent counters; `native-crow.ts` owns Crow state and motion.
`boneyard-enemies/heartmonger.ts` connects these to the existing store, damage,
placement, and light queries. New presentation consumes those authoritative
samples and the complete extracted atlas. No renderer frame derives AI time.
These members remain in progress until integration and Mac acceptance pass.

The featured-boss field scan found eight consumers/writers of Game `+0x1C2C`.
Damage `0x0048A290` selects any nonzero classification, including classification
3, and lethal retirement clears the selected actor. Spawn `0x00469580` and
`0x0046D000` select only when empty and skip classification 3; `0x005D7EF0`
also clears marked-for-deletion actors. A strongest/nearest-boss heuristic
would violate this recovered ownership.

### Intermediate Heartmonger implementation receipt

The candidate now admits native type 1011 through the evaluated config, store,
Lua stock catalog, exact per-source wave trigger, and strict replication. Its
native Crow flight and summon kernels, composed leg/torso/head sprite banks,
parent lifetime, detached Crow handoff, and authoritative head selector are
implemented. The ten-pose leg phase remains Heartmonger-owned; it must not
replace Badguy's separate four-period locomotion phase. Crow flight is projected
through the existing independent effect descriptor/sample channel.

On the Mac mini, 263 focused store/director/flight/presentation/protocol checks
and twelve per-source completion-program checks pass. A targeted regression
also reproduced the old Pike-break writer updating only flags; it now updates
the canonical evaluated weapon selector and rejects a second break. TypeScript
passed before that final small writer correction; its final check is recorded
when complete. These are intermediate tests, not final browser acceptance.

The native atlas reconstruction command passed on Mac with 4,286 records on
seven original-layout pages. New page SHA-256 values are Faculty
`928cbadcb4d131927aa26ca041e5ecf1fbc8692327197cedfbcf5c68f3ded6a5`,
Heartmonger `4dce7164633a67a39a23b44b5ce5895930d5ed5d08c42821fe7173b56aaa9f5a`,
and Unholy `cd5fd533d0d2c20eb1cc55891a9d1d54841ac5ebab7a3497d880d696c116a5c1`.
The first four pages are unchanged. The maintained extractor and packer include
all three banks. Light production now lives in `boneyard-light-sources.ts`;
spatial light queries and Region target management remain in
`boneyard-lighting.ts`, both below 1,000 authored lines.

At this intermediate checkpoint, Heartmonger leg trails, blindness, full
death fragments, visibility, and browser proof were still open, together with
the Faculty/Discorporeal graphs and shared HUD/geometry. The subsequent
recovery and implementation sections close those items.

Further recovered facts: Heartmonger `+0x8C` returns zero, preventing inherited
melee scheduling. Its own light `0x0047A040` has radius .75 and intensity
`.5 + Float(.10000002384185791)`. Its two leg trails initialize with 7 and 4
points through `0x004F4D10`; a changed integral leg pose reanchors them at
leg-record points 0 and 1 via `0x004F4F40`, preserving each segment's measured
length. Every segment uses BadGuys record 19. The black shadow pass offsets by
three times the first inbound-light direction record before the lit pass.
The trails are absent from Heartmonger's serialization method `0x00475400`.

Health trigger `0x0068B7C0` requires a **strict** old-ratio-above/new-ratio-below
crossing. Equality at a threshold does not fire it. The four generated
Discorporeal transforms must use this predicate, not a `health <= threshold`
phase heuristic. Featured-boss helper `0x004651B0` additionally collects living
classifications 1 and 2 and randomly selects a member; its call ownership still
needs closure before implementing the HUD.

Heartmonger auxiliary closure, additional instruction pass `0x0049FB60`,
`0x004A0CC0`, `0x0048A600`, `0x00403120`: the tendrils belong to the direct
pre-world slot `+0x28`, independently of the world-sorted body. Their seven- and
four-point chains continue one eleven-point walk, each step `25 + signedFloat(4)`.
Only an integer leg-pose change reanchors authored points 0/1; recursive fixed
length constraints move subsequent points. Both passes use unscaled BadGuys 19,
with the black pass displaced by three times the first inbound light direction.
The native render-only random sequence is cosmetic; the web retains this state
per view, independent of simulation and save state as in the native serializer.

The complete death tail corrects the earlier partial interpretation: Heartmonger
**does** create `Anim_Unbind`, at root `(x, y-15)`, scale 3, initial alpha .75
(or 1.25 for actor flag 2), loss `.02250000089406967`. It creates 19 ordinary
bone fragments, 11 additional Enhanced Effects fragments, 20 pieces from
BadGuys 172..174, seven BadGuys 29 pieces, and one skull from 1819..1822. The
browser already fixes Enhanced Effects on (`game-settings.ts`). The shuffled
bone bank uses one whole-list swap per item, not Fisher-Yates; bone radial
placement uses a continuous float draw. Heartmonger hurt really is the inherited
bonecrack bank (`Sounds+0x228`) at pitch `1 + signedFloat(.1)`.

Crow blindness is now recovered through the complete player/Arena path:
`Player_Tick 0x00533520` subtracts one from player `+0x204`; Arena render
`0x0047089D..0x00470A57` draws a black cover at `min(ticks/100,1)`, followed by
DeadHawg 1 at scale 1.25 and alpha `cover^4 * (.8 + Float(.19999998807907104))`.
The stamp jitters on a radius `Float(2)` around the Arena rectangle center.
This belongs to the player lighting/presentation component, resets with the run,
and is separate from the Wraith movement modifier. Crow strike's Region
`+0x8E24=.1` is **alpha loss per tick**, not a .1-strength flash: its initial
black RGBA alpha is one. The shared screen-feedback owner must preserve that
single native flash lane alongside secondary and primary spells.

The inherited Badguy culling rectangle is fully resolved: base constructor
`0x00473390` stores `+0xC8=&0x00819928`; exactly two references exist, that
constructor and global initializer `0x00781DE0`. The initializer writes
`(-32,-44,64,56)` from `0x00784CE4/0x00787108/0x00784CD8/0x0078710C`.
Heartmonger retains this rectangle. Authority can reuse the existing
`nativePrimaryViewBounds` contract and player input viewport dimensions; Crows
use point admission after their height is projected. Complex light admission is
a world-space circle of radius `145*light.radius`; intensity remains the
existing elliptical Region maximum. The circle can admit an actor whose scalar
is zero. In shared play, any participant view retains the effect.

Faculty action ownership is now instruction-complete: Throw `0x0044E320`,
TwoHandThrow `0x0044E920`, CastLightning `0x0044ED20`, shared progress
`0x004486E0`, marker crossing `0x00410E40`, and lightning tick `0x00451DC0`.
Throw uses fourteen frames of the chosen hand, frame 14 zero, five frames of the
opposite hand, and terminal zero; marker 15, strict end 20. Two-hand construction
first consumes the Throw constructor draws, then replaces poses with twenty
3s and eight 4s followed by zero; marker 20, strict end 28. Lightning adds
`Integer(10)` holding frames after index 18; end `19+n`, marker 15; it dispatches
every tick in `[15,end)`, with heading locked from progress 9. All use
`Float(.05000000074505806)+.10000000149011612`, multiplied by
`1.350000023841858` when `Integer(8)==2`, then the actor time scale each tick.
The interval-crossing helper includes either endpoint, so an exact marker can
notify on two adjacent advancing ticks; a stopped clock never notifies.

Faculty tick `+0x25C` is a completed-dispatch count, not the secondary selector.
Secondary cooldown begins decrementing only after a dispatch. Initial attack
range is 250; a scheduled action replaces it with `350+Float(250)`. Action
selection polls every other global tick with strict `150^2 < distance^2 < range^2`
and mask-0x380 line of sight. `+0x214` ramps light intensity by .001 per tick,
not body alpha; its provider `0x00479F80` multiplies it by `Integer(2)` and uses
radius `.75+signedFloat(.1)`.

The controller registration `0x00467F20` appends the actor before examining
member count. Its secondary stagger is **added** to the constructor's
`500 + Integer(300)`: member 1 adds `100 + Integer(301)`, member 2 adds
`400 + Integer(401)`, and later members add `800 + Integer(201)`. Primary
poll values are 200, 300, and `Integer(300)`. The actor resets flank time to
100 each active tick, advances its signed orbit angle by `Range(1,2)`, and
clamps radius after `SignedFloat(2)` to 200..300. Lightning completion
`0x00451DC0` explicitly clears both heading lock and hand mask.

Faculty configuration color is now closed: `0x0040FC60` computes luminance
with `(0.3086000084877014, 0.6093999743461609, 0.0820000022649765)`, then
mixes each original channel with that luminance. `ApplyConfig` uses saturation
`0.699999988079071` (`0x0078542C`, bytes `33 33 33 3F`), clamps through
`0x0040F770`, and preserves alpha. The constructor uses saturation
`0.6000000238418579` on orange. This is not a brightness multiplier.

Faculty spell inheritance is closed through `0x005E4990`, `0x005E7E00`,
`0x00600B40`, `0x005E3540`, `0x005E1D00`, `0x00600880`, `0x005E7130`,
`0x005FF050`, `0x006006E0`, and `0x005E1C20`. GuidedMissile construction
consumes initial phase `Float(360)`, turn factor `.5 + Float(.75)`, speed
floor `.75 + Float(.44999998807907104)`, and visual scale
`.8999999761581421 + Float(.20000004768371582)`. Its life is 2,000 ticks.
It moves along its existing heading, then turns by the heading **sign** from `0x00410D60`
times turn factor times actor clock (one-degree dead zone), probes five steps ahead every fifth tick,
and loses `.07500000298023224` speed per actor tick down to its floor. A lost
target is cleared; this tick does not reacquire one. SkullMissile scales both
initial speed and floor by 1.5 and retains the common motion owner.

TragicCircle begins with 750 ticks. Its initializer overwrites the preliminary
`1 / secondaryDamage` slow value with `.5`, sets art scale 4 and query diameter
420, and retains a ten-tick contact cadence. The final inclusion predicate
`0x00410470` is an ellipse with half-axes 210 and `210*.800000011920929`,
each expanded by 2; it is not the rectangle used for broad-phase enumeration.
Contact calls the mana helper directly for `-18 * manaRecoveryPerTick`, then
adds a 20-tick, .5 CircleSlow. Native damage-context MP loss is a separate lane
inside `0x0052F540`, after Deflect and shield/Stoneskin cancellation.

The shared death-magic aura `0x0048C650` reads BadGuys 110..112: the BadGuys
builder has 92 fixed reads, the 18-record 92..109 bank, then this three-record
bank. The two native passes each include two black disks, an additive central
star, 2..11 additive sparks, and an additive rotating outer star. Faculty hand
anchors come from the selected Faculty body record, not guessed hand offsets.

Faculty intermediate implementation (still incomplete): all three named recipes
now reach a Faculty actor, its selected primary/secondary spell dispatcher,
strict full and incremental snapshots, and the retained renderer. The shared
encounter wait is reused by Heartmonger and the Faculty. The Mac mini passed
126 focused tests including both complete post-fight timelines for all twelve
sources, three distinct actor/dispatch programs, both wire forms, and every
Faculty robe pose/facing/head bank. The new mana-contact tests also pass (shield
cancellation and a separately owned Tragic Circle slow). This does not close
Faculty death/voice/beam effects, the Discorporeal, or browser acceptance.

Further lifecycle facts: `0x0049D0D0` sets body pose 3 on every dying tick, uses
its 250-tick terminal counter, removes the Faculty-controller membership at the
first dying tick, and advances heading by integer `(250-remaining)/20` after
the shared tick. Its render jitters the whole assembly by a radius bounded by
`(250-remaining)/25`. Final death `0x0049E8F0` uses the same 18-entry enhanced
Skeleton bone inventory, doubled bone velocities and vertical launch/height,
scale 1.2, and a skull at four times the unit heading velocity. Unbind uses
scale 2 with loss `.02250000089406967`; its black Banish child is light-wrapped
(radius 3, initial intensity 2, loss `-.004999999888241291`). The remainder
includes a black 19-frame Imp burst, 72 smoke children, and 72 colored children
from `0x00454C30`, which require their own recovered lifetime and geometry.

The final shared death helper `0x0063EEB0` is the Region shake writer:
it writes `min(accumulator,1)*argument` and increases the accumulator by .2,
capped at 3.5. Faculty's .2 argument therefore contributes a .2 impulse to
the existing world feedback kernel. It does not spawn EvilEmbers. The scalar
2059 sweep found EvilEmber construction only in the common `0x00642BF0`
emitter; its callers are `0x00466BC0`, `0x005E5160`, `0x005E4CA0`,
`0x005FF8C0`, `0x00477020`, and Ember tick `0x0060D7E0`. Direct Faculty
attack and death handlers do not call this producer; earlier unconditional
membership claims need those remaining caller chains checked.

Faculty audio closure: registry SoundStream offsets `0x137C/0x1384/0x138C`
are death, male No, and female No respectively (gender branch
`0x0049D450..0x0049D4C7`). Each plays through its own restartable stream
with Region point gain. Death begins at the first dying tick; the No cue
reads remaining counter 150 before the shared decrement. The eight JOINUS /
DEADISBETTER voices use the global narration queue through `0x004FCEC0`;
that function plays volume one, while its .5 argument is a separate queue field.
Cast Sound cues are spinattack + throwdark for the one-hand primary;
magicstorm / magiccircle + banshee for the first two secondaries; banshee +
bigfire for Ring of Dire. Lightning marker emits lightningstart at pitches
.5 and .75, flamelashstart at pitch one, and a point-attenuated black flash
with alpha one and loss .025. Falling bones use knock, not Knockback.

Exact extracted audio membership (WAV duration rounded up to the 100 Hz clock):

| Cue | Native file | SHA-256 | Ticks |
| --- | --- | --- | --- |
| knock | `sounds/knock.wav` | `72ac6f23341f310afed3bc38054c182ac79c4a0b33f51c8fbd74605d00b56b5f` | 5 |
| throw-dark | `sounds/throwdark.wav` | `26219e86eb1e46fefc43a2de3ea7d02adbea7d4602920d960026613c23681c5f` | 201 |
| chain-clank-1 | `sounds/Chain/clank1.wav` | `9388003628daeb6fe363edcb0fd37ce273bcbdc95526f1d9f2caecad7be1ad09` | 73 |
| chain-clank-2 | `sounds/Chain/clank2.wav` | `f7f21051e44100f91c39ff4f077e648807bb3c49f49027aee81fb3bc2e7287fa` | 110 |
| faculty-die | `sounds/FacultyDie__Stream.wav` | `facbf1e289dfd60172db64f2298669ec4184a73c1ac0b354133b4e333657260e` | 533 |
| faculty-no | `sounds/FacultyNo__Stream.wav` | `d40528aa86a1c6d05788b6735701aafff93c006d894d7573fce93a7db978a783` | 175 |
| faculty-no-female | `sounds/Faculty_NoF__Stream.wav` | `f0c39d640cbd5bbdf1b8e8d94dcffc022f208ab43b1c9ec233b59872180475a5` | 345 |
| heart-break | `sounds/BreakHeartmonger__Stream.wav` | `4b0c2ca276972def804ced32163a32d30061c75b7d40d70c152f77030b4b873d` | 894 |
| faculty-join-us-1 | `voices/SAY_JOINUS1.wav` | `ea5c004e0ed51562bb1c02bb21fd59387e80523d53602e229a8825f58597d25a` | 362 |
| faculty-join-us-1-female | `voices/SAY_JOINUS1F.wav` | `db879b0d07d5e469cea5f86bb4b5d2a6f7accda30fb581379936b1f4144ddd52` | 416 |
| faculty-join-us-2 | `voices/SAY_JOINUS2.wav` | `00784021a75e1d1aa9e53c9645f67a5fced0e85043977c3270762dbdb118a603` | 374 |
| faculty-join-us-2-female | `voices/SAY_JOINUS2F.wav` | `3118094f517483ac1dbaf95d0eaba7cc16faf8980144d29faee51c1757255f0f` | 347 |
| faculty-dead-is-better-1 | `voices/SAY_DEADISBETTER1.wav` | `b44715fe0ece479f97372eec1479ec969c52f942fb7f605653382a7bd14bf418` | 468 |
| faculty-dead-is-better-1-female | `voices/SAY_DEADISBETTER1F.wav` | `3f1ca3403d9d452ff1b82f08e11d73ef7837b84b1e88f3820b440af2a656e8d1` | 393 |
| faculty-dead-is-better-2 | `voices/SAY_DEADISBETTER2.wav` | `3a9a7b5c991810e6e8af88b737fe9d01d0f8ae5ed8a79abdb28ccf3c80f97474` | 390 |
| faculty-dead-is-better-2-female | `voices/SAY_DEADISBETTER2F.wav` | `ca398d9f16e752e1b13d0df116b147f2bf18918cdb3e680b661206647b4a6bec` | 505 |

RainOfBones painter lookup is already closed by entry 297: `0x0064E910`
registers the upper proxy at root Y+350, while its cloud artwork draws at
Y-175. This is the same admitted proxy used by Acid Rain and Storm.

Contact-source correction: Faculty descendants call the player damage receiver
with the descendant Puppet as the source. SkullMissile has collision radius zero;
DarkFireball, RainOfBones, and DireFire retain Puppet radius 20. The spell
source must survive as contact position/radius even when its parent retires.
Deflect faces that source and sends reflection to that object; these projectile
classes have no enemy-health receiver. Parent actor identity is retained only
for attribution. A Mac regression reproduced the old source error (facing west
toward the caster instead of east toward the projectile).

Faculty particle closure: `Anim_Scrap` constructor `0x00454C30`, tick
`0x00454D70`, and draw `0x00459CC0` use BadGuys 66. Construction draws
opacity 2+Float(2), scale .25+Float(.7999999523162842), phase Float(360),
oscillation amplitude 10+Float(40), then phase step 1+Float(4). Each tick moves,
damps velocity by .9200000166893005, advances the oscillation, and adds
.10000000149011612 downward drift. Only after squared speed falls below .25
it adds a second drift, SignedFloat(.2) sideways, and subtracts .01 opacity.
Finale creates 72 of these in five-degree steps: one-in-four head color,
otherwise body color, radius 30+Float(20) from root Y-35, speed 1+Float(9),
and a separate world-sort bias Float(100)-50.

Black Banish `0x00454000/0x0045F9D0` retains the common two-opacity linear
clock. Its six gradient rectangles use the same widths as Banish: 20*scale,
10*opacity*scale, 4*opacity*scale. Upper extent is half the native view height
(and .75 of that for the white core), lower extent 50*scale. The first two
colors are dark red (.25,0,0); the core is white. Its paired BadGuys 15 cores
and paired animated 333..336 stamps tint red by opacity*.15000000596046448.
The upper stamps are at X+0, Y-40*scale. Faculty scales it to 2 and halves
its loss to .01. Its ZAnimLit wrapper owns radius 3 and intensity
2-age*.004999999888241291. The view height belongs to presentation, and the
scrap's sort bias is independent of its visible position.

The black-smoky Bouncer override is tick `0x00456E40` (vtable `0x00786308`,
slot +8). After the inherited Bouncer tick it creates **one black smoke every
airborne tick**, without SmokyBouncer's one-in-three gate, and deletes itself
when no longer airborne. Child scale is .1+Float(.25), opacity
.25+Float(.44999998807907104), and loss .004999999888241291. Normal alpha
blend and black tint differ from ordinary SmokyBouncer's additive yellow smoke.

Speaker `0x004FDD50` resolves the Faculty queue's .5 parameter: it is the
target sound/music duck factor at +0x64, with the current factor at +0x68.
The current factor approaches the target by .025 per tick; 25 idle ticks
restore the target to one. The voice itself plays at volume one. Completion
`0x004FD510` immediately consumes the next queued voice. None of the eight
Faculty voice IDs appears in retail `data/dialogue/narration.txt`, so the
voice files play without an invented caption. Controller registration/deletion
and the global voice queue therefore require independent lifetimes.

Faculty parent-clock boundary: its outer active callback `0x0049D0D0` advances
orbit, smoke, light/gait clocks and the selection poll around the inherited
Badguy tick. `0x004835F0` returns before action/movement when actor time scale
is below `9.999999747378752e-05`; an active inherited action uses only residual
motion, not the walking steering branch. Therefore stasis must not suppress
the Faculty's outer clocks, and a casting Faculty must not keep walking its
orbit. These are separate admission rules from global scene pause.

The complete black-smoky Bouncer vtable also proves its own draw slot +0xC
is empty (`0x0055C300`): the bouncing state emits smoke but does not paint
a bone or a shadow. It remains server-owned; only its smoke children enter
presentation snapshots.

Blightning child graph: `0x00451DC0` uses the authored Faculty body hand
points, added unscaled to root Y-15, clips the 5,000-unit visual ray to the
primary view and mask-0x380 terrain, and constructs `Anim_DarkLightningBolt`
`0x0045B530`. Its shared `0x00534510` tessellator uses BadGuys 64 as ribbon
(`+0x3138`) and 373/374 as branch bank (`+0x4808`, immediately preceding
375/376 at +0x4818 in `0x004E2614..0x004E26DE`). Branch quads are respectively
(-49,-75)..(13,20) and (-49,-183)..(14,23), from the extracted records.
The two layers have widths 1/.75, phases -3*tick and -3*tick+15,
white/red colors, alpha 1/.5, and taper-width multipliers 1.75/1.25.
It shares the two-tick `0x00453BD0` clock and spline construction with Air,
but draw `0x00457690` omits Air's additive-state bracket. Native ZAnimSplit
retains the 25-unit depth bands (entry 297); it must not become one beam layer.

`Anim_FadeDM` (vtable 0x007849B8, draw 0x004571A0) calls the recovered
DeathMagic painter with the current fade as global alpha and phase sentinel -1
(the global presentation tick). Blightning creates two-opacity, one-loss
instances with scale Range(1.5,2) and sort bias 25 at the clipped source and
terrain endpoint. Beam geometry, corona children, root smoke, and endpoint
sprays keep independent lifetimes. The shared scene uses the union of active
participant views for the view clip; with one participant this is the retail
primary-view rectangle.

Ambient bindings are closed by `Game` initialization `0x00652830`: requested
maxima +8 before each stored SoundLoop pointer map Faculty `0x0081CBA0` to
Soul (`Sounds+0x1B8C`), `0x0081CC10` to SteadyWind (`+0x1BEC`), the nonzero
hand-mask lane `0x0081CBB0` to Beam (`+0x146C`), and held lightning
`0x0081CB80` to Electric (`+0x164C`). The first two use squared point gain;
hands and lightning use point gain. RainOfBones `0x0081CBC0` maps Eerie
(`+0x15EC`) at .5*cloudAlpha*pointGain. These reuse the shared maximum reducer,
not one simultaneously stacked loop per actor. Lightning's per-tick admission
is retained in the Faculty visual state so stasis cannot leave that loop on.

Eerie loop is exact `sounds/eerie__loop.wav`, SHA-256 `96b8681aef80986dd09d02a7f40d34dbbff0d1b432c2b14c314e2f5af0ff6ad2`.

Rain child correction: the constructor called at `0x0061C89F` is
`0x004594E0`, **Anim_FadeSin**, not an upward-moving fade. Vtable 0x0078545C
selects tick 0x004542E0 and ordinary draw 0x00455A20. Tick adds the caller's
2+Float(3) to phase, deletes at phase >=180, and overwrites alpha with
sin(phase*pi/180)*the constructor's multiplier one. It never moves the root.
The caller's inherited alpha/loss writes do not own this child's lifecycle.
Its parent +0x15C ObjectManager advances once in `RainOfBones::Render`
0x005E37F0 and paints under the enclosing Y-175 transform in 0x005EBAD0.
The web view owns these cosmetic phases and cleanup, with two births per
native active tick 20..1199 reconstructed between presented frames. Birth RNG
remains separate from the native combat RNG; the authoritative generator still
consumes the recovered calls before later gameplay draws. This uses the same
presentation-only ownership boundary as Heartmonger's unpersisted tendrils.
Rain's inherited +0x158 residue scalar has no consumer: its +0x28 draw is
0x0055C300. The web model omits that unused scalar instead of inventing a
residue painter.

The shared lightning adjacency check corrects one existing tessellator
assumption for all callers: `0x00535703` calls Float(45,true), so branch
rotation can vary on either side of the authored base angle. The old Air
presenter only varied it positively. Air and Dark both call `0x00534510`
(entry 058); the old code comment naming 0x0052E020 was stale. The shared
presenter now consumes the sign draw for both styles, including the existing
Flame Lash consumer of that presenter.

Ambient receiver `0x0040B120` consumes the preceding maximum, starts or stops
one SoundLoop on the zero/nonzero edges, writes its gain directly, and clears
the requested maximum for the next tick. The existing browser director made
one physical channel per logical owner, so Faculty wind/beam/electric sound
would stack with player spells. The director now keeps ownership for balanced
release but one physical channel per native cue, with the maximum requested
volume. A remaining owner keeps that channel playing when another retires.
For shared-play callers requesting different pitches, the loudest owner supplies
the pitch; native ambient producers here all request pitch one.

Heartmonger continuation: tick 0x00489000 updates summons/Crows and refreshes
flank time to 100 before the inherited Badguy tick. Its 1,000-age refresh
chooses either perpendicular side of the current target (or signed 45+Float(90)
without one), then radius 150+Float(100). Crossing torso phase 3 plays one of
Chain/clank1..2 at pitch one before subtracting 3. These outer owners continue
under parent movement stasis. The terminal path additionally plays both chain
samples and the BreakHeartmonger stream, then creates two independent effects.
`Anim_FlickerLight` 0x004550B0/0x004550D0/0x0045A510 advances phase by
.3333333432674408 and retires at 180; it paints normal BadGuys 15 at scale
sin(phase)*5*(.8999999761581421+Float(.30000007152557373)), Y scale *.8,
with sort bias -200. `Anim_Soul` 0x00455100/0x00455190/0x0045A660 starts
random bob phase, advances bob by 2 and life phase by .36666667461395264,
and retires at life phase >=180. It paints Heartmonger 0 twice additively,
alpha sin(life), scale X=(sin(life)*.25+.75)*1.600000023841858, scale Y=1.6,
at Y+sin(bob)*5-life*.5-50. Its independent ZAnimLit wrapper stays at the
root, radius one, initial intensity one and per-tick loss .03999999910593033.

The complete inherited damage receiver adds a required interruption rule:
`0x0048A290`, lethal branch for native type 0x3F2, calls Speaker stop
`0x004FC2B0(1)`. Killing **any** Faculty member cuts off the current global
voice and clears queued speech immediately. This supersedes the earlier
inference that a queued reply could finish after a Faculty death. Removing a
controller without that lethal callback still leaves the independent queue.
The same receiver also owns featured-boss selection: a health hit on any
non-ordinary classification selects that actor, while lethal damage clears
its selection. Spawn paths select classification 1/2 only when the slot is
empty; classification 3 minibosses become featured on a health hit.
`0x004651B0` is save/load reconstruction, not a running random-selection poll.

### Shared enemy integration and featured-boss HUD closure

The candidate is now integrated with Website `a993eef2` and its canonical
`core-server/enemies/` owners. The earlier `boneyard-enemies/` split described
above is superseded; that directory was removed. Production and test TypeScript
checks pass on the Mac, including all seventeen added boss suites. The merged
293-test encounter/configuration/save/protocol batch had ten outdated fixture
failures; all ten passed after updating the deferred Faculty death and expanded
wire expectations. These receipts do not claim final full-gate or browser proof.

The featured actor is one authoritative `Game+0x1C2C` pointer, independently of
live-boss counting. Spawn helpers `0x00469580/0x0046D000` select the first
classification 1 or 2 actor while empty. Classification 3 minibosses become
featured only on a health-lane hit. `Badguy::Damage 0x0048A290` selects any
nonnormal recipe after the shield-interception branch and clears selection on
lethal damage. `Game::Tick 0x005D7EF0` clears a deleted pointer; it does not
choose a surviving replacement automatically. `0x004651B0` is save/load code,
not a periodic selection loop; native save loading chooses a random surviving
classification 1/2 actor. Website continuation saves can preserve the exact
selected identity directly, including an intentionally empty selection.

Fresh complete instructions for HUD `0x005D2520..0x005D2AEF` establish:

- UI singleton `0x008199E4`: repeated strip record 7 is the 69x20 background;
  record 6 is the 60x11 fill. Both use existing helper `0x00415230`.
- `Fonts+0x1CFA34` is wrapper 6 (base `+0xFC`, stride `0x4D434`), already
  extracted as `world-and-roster`. The actual recipe name is measured through
  `0x0043B330`; fill width is measured advance plus 50 pixels.
- With fill width W and native viewport (width,height), background starts at
  `(width/2-(W+9)/2,height-113)` and repeats to width W+11. Fill starts at
  `(width/2-W/2,height-109)` and repeats to W, clipped from the left to
  `W*currentHealth/maximumHealth`. Shield is not a second HUD lane.
- Text baseline is `(width/2,height-118)`. Six black copies have offsets
  `(0,1),(2,1),(-2,1),(0,2),(2,2),(-2,2)`; the final copy uses native RGB .75
  and alpha 1. Earlier descriptions calling this white are superseded.
- The branch requires a nondeleted featured pointer and local Player `+0x160`
  false (outside the Hub); Game `+0x85` and global HUD suppression also hide
  the ordinary HUD. There is no inferred per-boss CSS placement or fixed bar
  width. The existing native UI kit owns strip and glyph projection.

The implementation boundary is store selection at spawn/damage/removal,
selected identity through raw and incremental snapshots and continuation saves,
and the existing GameHud/native UI path. Tests must cover every classification,
shield interception, a different boss taking damage, lethal clearing with a
surviving boss, clipping at partial HP, different name lengths, and frame/save
round trips. Browser acceptance must inspect the actual stock strips and name.

### Discorporeal capability gates are not transformation actions

Fresh reconciliation of `0x006824B0` with `0x004963C0/0x00474930` corrects an
ambiguous earlier label. `unholytransform=1..4` immediately ORs bits 1,2,4,8
into every live DemonSkull's `+0x264` capability byte. It does not invoke
`0x00474930`, queue four animations, or replace a pending transformation.
`0x00474930` belongs to ranged-attack selection: it targets speed float32(.0001), increments
the attack seed/counter `+0x1C0`, sets the pending flag `+0x230`, and stores the
chosen attack 1..3 at `+0x234`. Deceleration precedes EyeLasers (action 26),
MouthBeam (27), or SpitFire (28). The fourth capability augments SpitFire with
GreenImp payloads. This distinction is instruction-derived and must be retained
when implementing health gates and action interruption.

### Faculty descendant trails, impact ownership and bounds

Fresh inheritance reconciliation requires the following complete descendant
outputs, beyond the previously implemented contact geometry:

- SkullMissile `0x00605920` emits one BadGuys 10/11 normal-blend MoveFade after
  every inherited GuidedMissile tick. Velocity is random radial Float(4),
  damping .9 (one-in-six .95), opacity 1, scale .6+Float(.199999988), random
  rotation, loss .01+Float(.02), and red Float(.15). One-in-five children use
  ZAnim world sorting; the others join the post-world manager.
- DarkFireball's overridden Firebolt trail callback `0x005ED940` emits two
  similar children on even global ticks. Each is displaced by Float(10), then
  offset vertically by -15 (or -15-sin(arcPhase)*50); opacity 1.25 and scale
  multiplier 2.5. The inherited trail callback remains a global cadence,
  independently of the actor's age.
- Skull impact `0x005F6AC0` creates a scale-2 FadeDM with alpha 2 and default
  loss .02, wrapped in ZAnimLit (radius .75, intensity 1, delta -.05, sort 100).
  This is distinct from Blightning's two-tick FadeDM (loss 1, sort 25, no light).
  Both share one death-magic presentation. Impact also emits 72 red/black
  MoveFade children (0..710 step 10, velocity 3+Float(3) and heading plus
  signed Float(3)), half the ordinary alpha-loss rate, magic-missile-hit pitch
  1+Float(.1), throw-dark pitch 1, and the existing point-attenuated black flash.
- Dark impact `0x005F76B0` emits the same 72-child terminal smoke burst.
  The arced branch first emits 36 children with radial Float(6), opacity 2,
  scale 1.5+Float(.5), damping .95 (one-in-six .98), and ordinary loss; then
  creates the two previously recovered DireFires. Every impact plays
  fireball-hit at pitch 2 and throw-dark at pitch 1. The direct branch owns
  an additional light-wrapped SpriteArraySpell; its exact array is being
  reconciled with the already extracted BadGuys builder before implementation.
- The ambient census includes descendants: Skull updates `0x0081CBC0` with
  point gain*.5; Dark updates that same eerie loop and `0x0081CB50` (LowFire, `Sounds+0x18EC`) with full point gain. Rain contributes point gain*.5*alpha. Shared
  per-cue maximum mixing remains the owner, including after a caster dies.
- Both projectile birth segments use native exclusion mask 0x380 from caster
  root to spawn position and invoke the normal impact callback when blocked.
  Skull inherits bounds expanded by 500 and cell-ordered GuidedMissile
  contact; the selected target first has a strict 10-pixel test. Dark inherits
  Firebolt's viewport expanded by 50, ten-step pre-movement terrain probe
  every tenth actor tick, and strict 30-pixel player-centre contact. A bounds
  or lifetime retirement alone does not invent an impact.

These facts come from the recorded retail image and complete C/ASM pairs for
`0x00605920/0x005F6AC0/0x005ED940/0x005F76B0/0x00600880/0x00600B40`.
The ordinary GuidedMissile's existing cell-order contact helper and shared
`nativeHeadingTurnDirection` must serve the Skull sibling as well. The earlier
unconditional world-player traversal is superseded for these native callbacks.

The direct Dark impact child is the same `Anim_FireBurst` already owned by
ordinary Firebolt/Fire Arrow (`0x00453470/0x004575B0/0x0045E2D0`), using
BadGuys array `+0x4788`, records 251..254. Only the authored scale differs:
1.75+signed Float(.25). Its existing two-pass renderer, sixteen visible ticks,
upward motion and ZAnimLit (radius 1.5, intensity 1 decreasing .04, bias 50)
are reused. Constructor order is rotation, angular magnitude, angular sign,
then the caller's scale draw. LowFire/Eerie bindings were checked against
`Game::Init 0x00652830` and the exact stock sound registry offsets.

### Dampen caster and canceled-projectile reopening

The Faculty implementation pulls the complete existing Dampen family back into
scope. The August 30 receipt in ledger 083 incorrectly preserved projectile
age/heading/scale, invented a 40-pixel velocity and 100-tick flyout lifetime,
and represented Mage casting suppression as immobilization. Those assumptions
are superseded for every sibling. The explicit 36-wisp/three-arc crash repair
for the separate caster pulse remains the established product contract.

Instruction-derived facts from the same retail image and fresh full C/ASM:

- Selection `0x00648DF0` includes Firebolt, cold/poison GuidedMissile, SkullMissile
  and DarkFireball in the 400-square. Modes are 0,2/1,3/3. Cancellation invokes
  no impact callback. Caster callbacks are SkeletonMage and DireFaculty.
- Constructor `0x00455020` draws a new Float(360) phase and initializes heading
  to -1. Update `0x0045A030` derives heading from its outward unit vector, moves
  exactly seven pixels per native tick (`0x0045A0EB`, double 7), retires outside
  the native viewport plus 50, and increments phase by five. The final update
  still emits its child after marking the parent deleted. No source age,
  heading, scale, or arbitrary duration is inherited.
- Each update emits a stationary Fade through ZAnim at sort bias zero. Dark
  mode chooses normal BadGuys 10/11, alpha 1, rotation Float(360), scale
  Range(.6,.8), loss .01+Float(.02), red Float(.15). Other modes use additive
  BadGuys 10 at y-15, scale Range(.5,.8), random rotation, and loss .016, with
  orange (1,.5,0,.5), green (.25,1,.25,1), or blue (.25,.5,1,1). The call
  to `0x0040FD00(.75)` produces a discarded temporary, not an in-place
  saturation change; the subsequent sprite copies the original RGBA.
- Draw `0x00461100` uses fixed Firebolt record 255 regardless of age; the two
  Guided modes retain the existing main/aura compositor with fresh phase and
  unit scale. Dark mode uses the shared DeathMagic compositor at scale 1.25.
- Mage `0x0048AE50` clears the action list and writes 600 at +0x278; Faculty
  `0x0048B5E0` clears its action, body pose and hand mask and writes 500 at
  +0x26C. Walking remains active. Mage tick `0x00490860` decrements +0x278
  after the inherited tick, independently of the inherited stasis return.
- Both caster callbacks emit one pre-world normal BadGuys 15 fade (scale 2,
  alpha 1, loss .005) and 72 gray MoveFades. Each consumes entry Integer(2),
  radial speed Float(3), direction, damping .96 (one-in-six .93), rotation,
  scale 1.5+Float(.5), loss .01+Float(.02), gray Float(.25), and lane Integer(5)
  (value 3 is world-sorted; other values are post-world).

The integration contract covers all five projectile variants, both caster
clocks, movement under Dampen, stasis plus casting suppression, cancellation
without explosion, child survival after parent retirement, native body art,
and continuation save decoding. Mage suppressed-cast tick particles are being
reconciled with the inherited head/hand attachment tables before final proof.

Mage disabled-cast particles are now fully extracted from `0x0049124A..0x00491709`.
While alive, nonzero-scale, and +0x278 positive, each hand independently tests
Integer(5)==1. Every accepted child is a normal Fade (BadGuys 10 if Integer(2)
is one, otherwise 11), scale Range(.45,.65), gray Range(0,.1), rotation
Float(360), hand offset plus (0,-5) and a radial Float(5) jitter, alpha
Range(.25,1), and loss .02*.1=.002. The two points come from each of the
90 Mage body records 1729..1818 (five poses by 18 directions), slots 0 and 1.
All 90 records contain both points; the existing lightning kernel had loaded
only slot 0. These are stationary ZAnim children at sort zero, independent of
the Mage after birth, with both tests continuing under inherited stasis.

Continuation schema 34 preserves the new caster delay and flyout state. Older
Mage saves receive a zero casting delay because they did not store that owner.
An older canceled-projectile animation is reconstructed at its saved position
with its saved outward direction, a fresh native phase, seven-pixel movement,
and viewport retirement; this removes the obsolete 100-tick lifetime from
resumed animations. Existing historical movement effects keep their saved
meaning because older saves did not record which ability produced disruption.

A continuation regression exposed a second shared ownership assumption:
`normalizeDeathEffectOwnership` inferred a particle's queue from its animation
class and rejected real caller-selected queues. Native Fade/MoveFade objects
are wrapped or inserted by callers; Faculty, Dampen, and TragicCircle use
different queues for those same classes. Current saves must validate the
recorded queue enum and its matching registration. Only old saves missing
ownership fields may use the historical class/role inference for migration.

### Discorporeal controller and independent clocks

The complete DemonSkull vtable begins at `0x00786074` and ends after +0x94.
+0x6C/+0x70 are the shared Badguy movement functions `0x004763E0/0x00476B90`;
+0x7C is the flair request `0x00474960`, +0x94 schedules Bite, and +0x50
is the shared terminal reward callback. Constructor `0x00474660` sets radius
40, speed 4, melee reach 120, body offset (0,25), two Float(360) phases,
heading -1, light zero, pending false, and attack countdown 500. Init sets
target speed to recipe movement scale*4. Recipe `0x00462790` maps primary
to Bite (+0x1B4), secondary to EyeLaser (+0x258), tertiary to MouthBeam
(+0x25C), and extra to Spit (+0x260). The stock damage values are 45/45/20/10.

Raw operand-width reconciliation of `0x004963C0` supersedes earlier provisional
constant interpretations: light increases .005 each active outer tick, and
Scream speed increases .04 (neither increment is 2). Speed approaches its
target by .025 before inherited movement/action dispatch. Recoil moves while
length squared exceeds one, then halves. Body phase advances 3; the second
phase advances Range(3,6). Display heading follows after eleven differing
updates; light clamps at one. The first camera admission is latched.

- Ranged selection requires a target, first admission, no action, and ordinary
  player mode. At speed >= target speed and distance >400, Integer(100)==50
  can start Scream. The equality branch is included (`0x00497085..95`).
- Predecremented attack countdown must reach zero and speed must be strictly
  above target*.75. Reset is round-to-even(Range(1.5,3.75)*100), divided by
  four/three/two below 12.5/25/50 percent health respectively. Eye has weight
  one with LOS; Mouth has weight one with LOS plus two beyond 250; Spit has
  weight one without an LOS requirement plus one beyond 250. Capability bit
  eight augments Spit rather than adding an attack choice.
- Selecting ranged work increments the inherited action/loot seed, sets
  target speed to float32(.0001), and marks the pending action. Pending work
  removes another .025 speed after inherited work and starts its action only
  below .005. This is distinct from the health trigger's immediate bit write.
- Scream uses `UnholyScream__Stream.wav` (120835 stereo frames at 44100 Hz,
  SHA-256 `8120690162655d24f389ac363c70b9c1ff91fec3e8f6f758b64343e0479db16f`,
  275 fixed ticks). During playback speed caps at movementScale*10 and root
  jitter uses native point gain*8. Afterwards the actor closes its mouth,
  plays the landing cue once, and subtracts .1 each tick until speed drops
  below recipe movementScale; it then clears Scream. Ordinary acceleration
  toward movementScale*4 continues throughout this sequence.
- Death's independent `UnholyDie__Stream.wav` is 264230 stereo frames at
  44100 Hz (600 ticks, SHA-256
  `7b360a0f855eb79a0f4cf25da6c7b832158574f43b024448ae30d3e3049f0aae`). The
  stream normally ends before the fallback 1000-tick death counter. Stream
  completion creates BigBurst, sets the counter to zero, and the next
  inherited tick retires the enemy and releases its reward.

The action inventory is Bite 24, EyeLasers 26, MouthBeam 27, SpitFire 28,
Scream 29 and Flair 30. Eye owns 50 warmup ticks, three charge/discharge
cycles, and 50 recovery ticks. Its charge step is attackSpeed*.025*actorTime;
warmup/recovery counters are independent. Bite uses the first four pose-1
frames then pose zero, marker four, strict end 13, and rate attackSpeed*.125
scaled by current actor time. Spit owns a seeded action-local shot-count RNG
and a separate 75-tick inter-shot timer with a 35-tick mouth animation.
The remaining beam geometry/child programs and caller admission are tracked
with their direct C/ASM before their implementation below.

### Boss camera displacement and point-gain families

`Region::AddShake 0x00448590` replaces +0x8E0C/+0x8E10 only when the new
vector has strictly greater squared length. Equal vectors preserve the first
writer. This is the same Region lane used by existing primary/secondary
feedback; their prior greater-or-equal comparisons are superseded. The existing
.75 per-tick decay and squared-length .25 cutoff remain the shared owner.

Faculty alive callback `0x0049DCCE..0x0049DD6D` computes **hit-point gain**
through Region +0x104, squares it, updates Soul/SteadyWind loop maxima, then
submits a random unit camera vector times that square. It runs under inherited
stasis. Its hand loop also uses hit-point gain; lightning dispatch sound uses
ordinary point gain. These gains are distinct: +0x104 `0x004622D0` is full
inside width*.1 and zero beyond width*.5, with the alternate-player .1 factor
only in the middle branch. Ordinary +0x100 remains width*.25..width*1.1.
A single ordinary-point callback for all Faculty loops was therefore wrong.

Discorporeal Scream uses hit-point gain*8; its Flair uses random radius three
without point attenuation. MouthBeam uses ordinary point gain*Float(10).
Death uses a fixed-camera random radius `10*bodyPose^2*(1-clamp((remaining-500)/800,0,1))`.
These are camera displacements through the Region helper, not actor-root
jitter. The separately stored head jitter and body offset remain actor state.
All observing clients must attenuate the same authoritative world event using
their own native viewport, then arbitrate in the shared maximum-vector lane.

The health-trigger callback `0x0068B7C0` has no recipe-identity predicate.
Once the Discorporeal script enables its four conditionless type-12 triggers,
health damage to any classified boss can trip them. Each queues one script;
`unholytransform` applies its OR to every current DemonSkull. The shared
trigger's one-shot mask therefore belongs to the Region encounter, not an
individual DemonSkull. Triggered changes must be visible by the next NPC
traversal. Save state retains queued changes and the consumed trigger bits.

Flair is a separate instruction: opcode 1052 (`0x00689750` case 0x41C) calls
`0x00685100` on the trigger's recorded actor list. The four generated health
scripts contain only opcode 1051; none invokes Flair. Likewise `bossmegadeath`
is a separate opcode-1051 keyword, absent from the twelve generated survival
scripts. Their native state/render branches may be represented, but the
generated encounter must not invent either trigger.

Unholy builder `0x004F4750` drains five standalone records (0..4), then arrays
of 4 (5..8), 32 (9..40), 48 (41..88), 10 (89..98), 72 (99..170), and
48 (171..218). The body array is +0x44C, three poses by 24 directions; every
body row has two exact eye attachment points. The overlay array +0x45C has
two poses by 24 directions. All 219 source rows are extracted and retained.

DemonSkull action ownership is an ordered **list**, not a single action slot.
`0x0044F5F0` appends through actor+0xDC. `ActionManager::Tick 0x00483000`
visits every entry in insertion order and removes entries already marked
deleted before their tick; an action marking itself deleted remains until the
next admitted manager update. Inherited Badguy `0x004835F0` returns before
that manager under stasis. Pending DemonSkull ranged work is an outer branch
and does not test action count; it can append Eye/Mouth/Spit after the inherited
melee branch has started Bite while decelerating. The port must retain both
actions, their deterministic order, and their delayed-removal boundary.
Scream's constructor creates an already-deleted action plus its independent
playback flag. Whole-actor death clears the action list; it does not fabricate
a cast-recovery callback or clear unrelated constructor-owned visual scalars.

### Direct particle queues corrected against the Region render owner

Reconciliation with the complete Region painter ledger 297 exposed a mistaken
label in this investigation: direct `Region+0x278` is **pre-world**, not
post-world. It is rendered before the world queue and Region light multiply.
`+0x22C` is directly after the queue; `+0x1E0` is the later world overlay
manager, after player-attached effects and the other Arena late managers.

All Faculty smoke profiles, Skull/Dark trail and impact smoke, Blightning
source/path smoke, the Faculty terminal sprite array, and TragicCircle's
direct children must use their actual +0x278 pre-world lane. Dampen's
72 caster smoke children use that same lane when their ZAnim lottery fails.
Dampen's record-15 caster fade enters +0x1E0. Anim_Unbind also enters +0x1E0
for every caller; it requires a late overlay lane rather than the old
post-queue approximation. Current snapshots/save documents carry that caller
ownership explicitly; older Unbind saves migrate to the recovered lane.

The ambient sweep also recovered TragicCircle's omitted Eerie loop
(`0x00605C00`): hit-point gain*.5. RainOfBones `0x0061C440` likewise uses
hit-point gain*.5*alpha. Skull/Dark `0x00605920/0x00605C80` use ordinary
point gain, so these loops must retain their distinct attenuation functions.

The wrapper admission is now instruction-closed: `0x0063E5E0` constructs
ZAnim and appends to Region+0x8B70; `0x0063E5B0` appends an already wrapped
ZAnimLit to that same transient manager. The shared enemy/loot particle
helper's actor-manager registration was wrong for all Bouncer, Fade, Scrap,
shield-break, and child-smoke users. Their creators, raw/compact snapshots,
painter plans, and continuation validation move together to transient
registration. Old saves append these migrated particles in their saved array
order; the old format did not retain their correct cross-manager chronology.

Boss spells now name their common key `painterRegistration`, with one class
map selecting its manager. SkullMissile, DarkFireball, RainOfBones, TragicCircle
and DireFire are actor-manager objects. Blightning's wrapped body, FadeDM,
falling bones, and Heartmonger departure animations are transient-manager
objects. A light-producing wrapper uses that same registration when enrolled
in the light-provider census. Dampen's emitted Fade likewise belongs to the
transient manager. No second registration or compatibility alias is added.

MouthBeam's `0x00450C41` query is polygon helper `0x006427E0` with mask
0xFFFFFFFF and an explicit caster exclusion. It therefore includes other
enemies and eligible scenery/projectiles as well as players; it is not a
registered-player-only beam. The helper omits type 3001 and can append flagged
transient objects. Its native damage callback runs during the caster's turn.
The enemy step must retain one current actor list, update a hit victim in that
list immediately, and preserve insertion order before ticking later victims.
The existing damage receiver remains the sole HP, shield, attribution, boss
threshold, and lethal-state implementation.

### Discorporeal action and projection completion

The instruction checks at `0x0044A560`, `0x0044FFE0`, `0x00449A00` and
`0x00448BE0` pin the independent clocks. Eye increments charge glow by .025
on every admitted action tick, uses 50 warmup ticks, charges each of three
volleys by authored attack speed*.025*live actor time, then recovers for 50
steps. Its first charging volley still writes a random radius-three head
jitter; firing clears that jitter/charge and samples signed spin within 15
degrees. Warmup emits an Unholy record-2 fade into the late +0x1E0 manager,
scale 1..2, at radius 90..130 around root+(0,-60).

Mouth uses 300 fixed warmup steps, grows its jitter radius by .05, emits a
record-0 MoveFadeAdditive into +0x1E0 toward root+(0,-60), and reduces its
one-degree tracking speed by .004 only when a target exists. The active beam
sets pose one and body phase zero, randomizes the body offset within radius
three, waits 150 steps before tracking with a .01 ramp up to half a degree,
and decrements power 10 by .015 each step. Beam geometry is clipped from a
1500-unit ray and has half-width 48 for its five-tick damage polygon. It then
recovers through an 80 counter including zero: 81 updates. Both beam end and
recovery clear the body offset, preserving this difference from the initial
(0,25) offset. Spit waits 35 mouth ticks before resuming its 75 cooldown;
its turn uses the previous aim before computing target velocity*260, and
fires only on raw absolute angle error <3, including the native wrap seam.
Flair writes its prior glow, advances glow by .05, and uses
sin((remaining/200)*630 degrees)*40+saved heading for 200 updates. The settle
counter starts at one, then completes at 50. Bite's inclusive marker-four
interval and strict progress>13 retirement share the recovered action clock.

`TextQuad` vertex writer `0x00412D70` adds render-context +0x68/+0x6C to
all supplied vertices. Consequently the eye-charge draw really adds the
body offset/bob twice: once in its world attachment calculation and once
through the enclosing render offset. Root jitter is added once. The body
bob is sin(phase)*10-25; the older provisional -50 interpretation is
superseded by the double constant at 0x007DE960. Pose-two charge overlays
outside the 48-row overlay array remain blank through the native empty-record
guard; the port must not invent or clamp an additional pose.

The terminal animation is `Anim_UltraBanish` (`0x00454580`, tick
`0x00460AB0`, draw `0x0045C7E0`), superseding the provisional BigBurst label.
Its counter at `0x00819840` is read by `0x004547E0`, not by the world tick;
its remaining consumer and child details are recorded with the finale below.

The BeamSegment class is now closed: constructor `0x00454500`, tick
`0x00454560` (retire on its second update), draw `0x0045C430` (four vertices,
repeating raw texture, white endpoint colors, additive blend). Segment quads
are 64 by 128, rotated around root, advanced by 64 initially then 128 per
segment, and shifted by world Y=-40. Only the sorting/light root gets the
random unit offset. Both endpoints fade through the final 200 units; the
first segment's near pair is transparent. UVs scroll by (globalTick%25)/25.
Each segment contributes a radius-one/intensity-one light; the draw's one-in-
eight extra Unholy spark belongs to presentation.

The browser VFX review caught a reversed alpha assignment in that segment
adapter. Raw `0x00450F3C..0x00450F90` authors the far pair before the near pair;
draw `0x0045C430` reads packed color `+0x60` for the first pair and `+0x64`
for the second. `0x00451742` explicitly clears `+0x64` on segment zero.
The far pair must therefore receive the fade at distance+128 and the near
pair the fade at distance, with only the first near pair cleared. Reversing
those assignments creates a visible discontinuity at the first segment join.

Eye impact reuses the radius-query diameter 165 (radius 82.5), registered
players only, with equal physical and magic halves. Its NativeType 7021
knockback helper receives the **projectile velocity**, not the birth position,
and lives 3+Integer(8) ticks. The impact's parent source is null, so it must
not reflect damage onto the DemonSkull. GreenImp's spit overrides +0x1B4
(primary damage) and +0x1B8 (experience) with spitDamage/20; it retains its
ordinary Imp constructor health and whole Imp behavior. GreenFire remains
the shared Fire step, with a green atlas compositor. Mouth halves its initial
life scalar (2 to 1), not its decrement; spit fire sets life 20.

The shared SpriteArray draw `0x0045D8A0` rounds its frame with the native
half-to-even conversion. The prior floor assumption is superseded for every
SpriteArray child. A rounded frame outside its authored array stays blank
until the strict framePhase>count retirement. Eye/spit impact arrays 401..419
and 420..433 set additive blend. The latter's offset starts -22.5/-15 and
steps by -1.725/-1.15; those fields are draw offset and per-tick offset delta,
not a second-order acceleration. Their frame rate starts .625 and decays*.97.
The shared wrapper radius is 3, raw light intensity 2, loss .02, clamped only
when submitted to the light map.

### Discorporeal death owner

Death begins with the 600-tick UnholyDie stream at global gain one,
LightningStart pitches .5 and 1, and MagicShieldExplode at one. Two pre-world
DeadHawg:16 additive perspective scale-fades start at scale 2, opacity 3,
loss .005, and scale multipliers 1.025/1.035. Earthquake loop gain is one.
The authoritative death countdown starts 1000; pose changes from one to two
at remaining<=600, with a second green flash on exactly 600. It freezes the
alive phase counters and retains action-owned glow/jitter until native writes.
Each admitted dying tick randomizes body offset, submits the recovered
camera displacement, runs the inherited death decrement, rotates the heading,
and emits one green branch fade when pose two or Integer(4)==1. Those branch
fades are BadGuys:375/376 at root Y=-50 with radius 50..100, rotation perturbed
by signed 20, and scale 1..2. They enter the pre-world manager.

When the shared death stream ends, the actor sets its countdown to zero and
spawns UltraBanish with sort bias 50, then a (.25,1,.25,1) flash decaying .025.
Retirement/reward occurs on the following parent death update. A second
DemonSkull can restart the same stream; the 1000-tick inherited death fallback
remains effective and does not invent a finale when it retires first.
UltraBanish begins at remaining=150 (mega branch 2000), intensity one and
flash scalar 1.5. It releases the global UnholySoul hold at remaining=100,
then loses intensity .01 until retirement. Its six ambient channels use
unattenuated per-channel maxima. The global counter is exclusively a hold
for Anim_UnholySoul; it is not a world-pause flag.

The beam's raw texture is instruction-verified in the loose-image loader
`0x005BBD90`: `images/greenplasma` is written at MyApp+0x31C5E0, whose fixed
instance address is `0x00B3BC10`. BeamSegment is its sole direct consumer.
The retained PNG is byte-identical SHA-256
`463de5a10d3123395f38ddf01cdb2b450c58ffc06b7753b896b81940490bd84f`.
The renderer reuses the native material batch and per-vertex colors, with
linear filtering and repeat addressing. UltraBanish's gradients reuse the
same vertex-color mechanism with the platform's white texture; there is no
per-frame gradient image allocation. Its scale jitter is 5..9 and it shifts
all gradient strips by Y=-50*scale; the two central BadGuys:15 glows remain
at the world root. The extra flash scalar adds a second set of six strips.

The target membership is now separated using the same player-list proof as
entry 091: Blightning `0x004804D0` and RainOfBones `0x0061C440` traverse
Game+0x1390/+0x139C and exclude summoned Golems. Circle contact `0x005F7010`
uses Region mask 0x801 and includes Golems. Its MP decrement is confined to
the native local player; the multiplayer port retains each affected player's
own MP lane. Its target fade and 20-tick half-speed modifier also occur for
Golems. The target fade is BadGuys:7, green channel zero/half-red, at Y=-15,
scale 1+signedFloat(1)*.65, alpha .5+Float(.25), loss .01, scale multiplier
1.1, transient sort bias 50. The previous Circle implementation omitted that
child and the summon-side modifier, and is reopened here.

`Mod_CircleSlow` constructor `0x00623100` registers type 7024; its
`+0x1C` callback `0x006231B0` multiplies Puppet `+0x120` by the stored
factor. Golem `0x00615CD0` reads that scalar for the signed one-degree
heading step (`0x00617232`, with up to four additional steps during an
attack while the angle remains at least three degrees), root travel
(`0x006173A5`, unit heading times speed times .5), and foot progression
(`0x006174D0`, `(progress + .015*factor)*1.06`). Assembly/action counters
do not directly multiply by this scalar. The former direct movement toward
the destination skipped native turning and is replaced by travel along the
updated heading. Puppet modifier update `0x006247A0` decrements and removes
the timer; the derived scalar is recomputed on the next update after the
modifier count changes, so a newly applied 20-tick modifier affects twenty
updates. Golem owns this timer independently of the ordinary-enemy modifier
map: the two actor ID namespaces can overlap. It is saved and replicated;
pre-schema-34 saves default to zero. The Circle contact bypasses the Golem's
400-tick HP-damage gate, without adding an MP lane or reflected damage.

The complete enemy shadow sweep found every +0x2C slot empty, but +0x28
contains **both** simple and complex branches: Skeleton/Zombie/Faculty share
`0x004842A0`; Archer/Mage share `0x0048A260`; Heartmonger has `0x004A0CC0`,
Demon `0x00479540`, Coffin `0x0049AEE0`, Portal `0x004A1CB0`, and DemonSkull
its simple-only `0x00474A20`. Imp/GreenImp/Wraith slots are empty. Arena
`0x0046EC80` calls +0x28 for scenery, actors, then transients in manager order.
This supersedes any inference that an empty +0x2C means no complex shadow.
The callback is a pre-lighting pass: Arena's three calls are at `0x0046F8FE`,
`0x0046F947`, and `0x0046F98C`, followed by the Region light-map multiply.
The new enemy underlay owner therefore lives after direct background effects
and before that multiply, ordered by actor registration. It does not receive
the main sprite's analytic lighting tint a second time.

Common `0x004842A0` shifts the draw context backward five units along heading
(Archer/Mage wrapper `0x0048A260` uses the limb heading). The stored shadow
size `+0x13C` is one, except Heartmonger constructor `0x0048B970` sets two;
ApplyConfig changes actor scale `+0x74`, not this shadow size. Simple mode
draws BadGuys:67 at that size. Complex mode draws one BadGuys:80 quad per
native light record, then the same circle at .8 times its size. With light
direction `(dx,dy)`, perpendicular `(dy,-dx)`, distance fraction `d`, lateral
gait offset `g`, and shadow size `s`, near corners are `+/-10*s*perpendicular`.
Far corners are `min(projectionDistance,150)*direction + g*perpendicular`
plus/minus `(10*s + 10*(1-d)^3)*perpendicular`. Near alpha is the record's
base alpha times the actor's analytic light scalar; far alpha is
`(1-behindScalar)*(1-d)`. The general scenery projector's cubic far-alpha
formula does not apply to this textured enemy quad.

The lateral gait scalar is a separate writer: constructor `0x00473390`
initializes `+0x158=0`, and shared movement `0x004763E0` copies its advanced
body gait phase `+0x148` there. It persists while stationary. The host now
projects this value rather than reconstructing it from a rounded pose.
Demon's simple shadow `0x00479540` uses the unlifted endpoint midpoint,
BadGuys:67 size two and alpha .5; its grounded offset is projected separately
from the already lifted extremity draw coordinates. DemonSkull uses size
`4*actorScale`, at root plus body offset, without bob, jitter, or spin.
Imp, GreenImp, and Wraith have no shadow draw. Maggot `0x0049C350` starts
with a BadGuys:67 shadow of size `.44999998807907104`, independent of body
scale, including during its emerging phase.

Coffin `0x0049AEE0` draws its current BadGuys:383..392 image in black only
when emerged and Complex Shadows is off. It uses the same launch mirror and
rotation as the body, with both top vertices offset by `(h/4,1.25*h/4)`.
`Sprite::DrawQuad 0x00417060` adds those deltas to the authored quad;
`Sprite::SetImage 0x00413DE0` proves the queried `+0xA0` is rendered height.
The Maggot/Coffin colored-body painters remain their existing family owners;
this pass adds their missing shadow commands.

Portal `0x004A1CB0` has three underlay commands after materialization:
normal black DeadHawg:18 at fixed size .5, then additive DeadHawg:22 and
DeadHawg:180..199 at `(fixedScale,.8*fixedScale)`, all using live alpha.
Record 22's RGB is `(1,pulse/2,pulse/3)` with
`pulse=.5+.5*sin(age*3 degrees)`, desaturated by .5 using the recovered
`.3086000085/.6093999743/.0820000023` luminance coefficients at `0x0040FC60`.
Portal main `0x004A1B30` draws only additive DeadHawg:46..77 at scales
`(fixedScale,1+2*alpha)`, with Y `15-32*(1+2*alpha)`. The previous four
main-sprite layers put its ground disk in additive blend and lost the split
between pre-lighting and main passes. Its independent hit effect remains in
the existing damage presentation lane.

### Lethal damage provenance and shared Unbind

Badguy receiver `0x0048A290` sets `+0x9C & 2` only when the accepted lethal
contact contains the magic component at `0x0081C6EC`; the physical component
is `0x0081C6E8`. Shield-only and nonlethal hits do not set the death flag.
The death-function sweep covers Skeleton/Archer/Mage `0x0048D2A0`, Imp and
GreenImp `0x004824A0`, Zombie `0x004947B0`, Wraith `0x00495600`, Coffin
`0x0049B310`, Faculty `0x0049E8F0`, and Heartmonger `0x0049FB60`: every
magic-present Unbind begins at 1.25. The family-specific fade loss is unchanged.
The Mac Heartmonger magic-death browser check exposed a transport omission:
both full and compact death-effect decoders still limited BadGuys:86 Unbind
to alpha 1. The native 1.25 bound belongs to this exact normal-blended Unbind
shape as well as the existing additive BadGuys:69 fade. Both decoders must
share this shape rule; other effects retain their existing alpha bounds.
Portal `0x004A1FA0`, Demon `0x00482930`, and DemonSkull's separate finale do
not create Unbind. Their previous unused clock-table rows are not evidence of
a native star producer.

Fresh xrefs of both damage globals and the concrete vtables verify the source
classification. All ordinary primary damage contains magic except the Frost
Jet's additional Hail hit: `0x00543860` stages magic at `0x0054426B`, then
resets the context for physical-only Hail at `0x0054445F`. Boulder contact
`0x00620B60` explicitly splits accepted damage 50/50 into both lanes; welded
Hailstones `0x005FBDE0` do likewise. The other welded projectile, channel,
Meteor, and Fire-child contacts retain their magic component. The secondary
contact kind already distinguishes physical Golem strikes from the elemental
and magic contacts. Staff melee, Deflect's returned physical damage
(`0x0054838F..0x005483A3`), and Golem physical reflection remain physical;
Mindblast's shared blast and the Discorporeal mouth contact contain magic.
An amount-only authored mod request retains its established physical default.

The server damage request now carries this single provenance bit alongside
total HP damage. The accepted lethal actor owns it through delayed death and
save/restore; pre-schema-34 saves default to false. The death effect itself
continues through the existing replicated effect lane, without exposing
unconsumed actor state to the renderer.

GreenFire constructor `0x005EA4C0` calls Fire `0x005E7130`, then resamples
the same 32-frame phase and horizontal sign. Both constructors' random draws
must advance the authoritative stream; only the second pair is retained.
This preserves later Spit fire placement and GreenImp construction draws.

The live Spit case exposed a second ownership mismatch: the outer GreenFire
record retained the unrounded spread point while the embedded Fire rounded its
position on its first update. Puppet coordinates are native float fields. Fire
now stores that precision at birth, and GreenFire uses the embedded Fire's
canonical root at birth and on subsequent updates. This preserves one position
for contact, light, rendering, and strict snapshot validation.

### Mouth query membership and Puppet hit feedback — reopened

The merge with the published Spider/Cocoon encounters extends the shared
underlay inventory. Spider vtable `0x0078643C`, slot `+0x28`, calls
`0x00489620`: it saves position, adds the heading `+0x6C` unit vector times
double `10.0` (`0x007DE810`, stored to float components), calls the shared
`0x004842A0` shadow renderer, and restores position. The shared backward-five
offset therefore leaves its shadow five units ahead. Its constructor
`0x004759A0` retains the inherited unit shadow size. Spider uses both shared
simple and directional shadows; its body heading does not replace `+0x6C`.
Cocoon vtable `0x0078682C`, slot `+0x28`, points to the empty `0x0055C300`;
its player-owned web presentation supplies the visible restraint. These two
members are included in the underlay regression inventory. The retail image
was rehashed for this check and still matches the ledger SHA-256.

The same constructor/slot check resolves further Mouth candidates. Fireball
`0x005E0970` and GroundSpark `0x005E76F0` explicitly clear active byte `+0x36`.
Meteor `0x005E1540` and Leviathan `0x005E8FB0` retain Puppet's active default;
their vtables `0x0079C9F4` and `0x0079DBAC` retain grid bind `0x00622F90`,
unbind `0x00622FB0`, and damage `0x00627F80`. Their construction/registration
callers are `0x0052BB60` and secondary case B in `0x0054CC50`, respectively.
Both reach actor-manager registration `0x0063F6D0`; Meteor setup `0x005E1640`
and Leviathan segment setup `0x005F4750` leave active byte `+0x36` intact.
They therefore belong to the grid lane, including while Meteor is airborne.

The initial beam adapter incorrectly excluded Arrow and assigned every other
hostile projectile flag 0x100. Arrow constructor `0x005E1000` sets type 2010
and flag 0x80; type 3001 in the polygon helper is a separate exclusion.
The constructor census also proves that flags alone are insufficient:
Puppet bind callback `0x00622F90 -> 0x005212F0` only inserts objects with
active byte `+0x36` set. `0x006427E0` queries that grid first, then appends
transient-manager objects whose flags overlap 0x180, preserving each lane's
native order. A flag-8 primary projectile with grid admission disabled is not
a mouth target merely because the query mask is all bits.

Puppet `0x006287D0` defaults flags to zero. The five ordinary flagged scenery
families are Tree, Gravestone, Monument, Fencepost, and Building (flag 4).
Goodie `0x005E3D60` has flag 0x2004; Gold `0x005E12C0` and Sack
`0x005E1460` have 0x400. Lantern/Orb/Bonus, the Fire family, Ember/EvilEmber,
DemonBomb, UnholySpit, and PoisonPool keep zero. GoodImp `0x00529FE0`
explicitly clears inherited Badguy flags. Firebolt/EyeLaser/GuidedMissile use
0x100; SkullMissile inherits GuidedMissile and DarkFireball inherits Firebolt.
MagicMissile and its Fire/Frost/Ball descendants, Fireball, Meteor,
GroundSpark, and Hailstones use flag 8; their active byte and registration
path must also be honored. MagicTrap and Leviathan use 0x200, with MagicTrap
explicitly disabling grid admission. The shared query adapter carries those
admission and callback dispositions explicitly.

The non-HP targets have a real callback: `Puppet::Damage 0x00627F80` starts
the hit timer at one and stores DamageContext strength/color. Shared tick
`0x00624AC0` subtracts .05; `0x00628AD0` redraws the target with strength
times that timer (the cached-image branch cubes the timer). Context reset
`0x006246F0` defaults strength to one and red to `.6499999761581421`;
Mouth overwrites strength with Float(1). Render-state `0x004208A0` proves
flag `Context+0x223` selects diffuse RGB instead of modulating texture RGB,
while alpha and ordinary/additive blending retain their separate owners.
The existing red-tinted hit copies do not implement that RGB selection.
This source finding requires a shared hit-material correction and the
non-HP target feedback path; a contact sparkle alone is not that callback.

The setting branch must survive that correction. Complex Lighting
`0x00B3BCA8` enabled calls the virtual hit renderer at `0x00625036`, using
the stored context color (default red `.6499999761581421`). Disabled takes
`0x00625075..0x00625138`, which selects diffuse RGB but authors full red
`(1,0,0)` and the linear strength-times-timer alpha. Both redraw the current
Main callback; the hit dispatcher does not override blend modes authored
inside that callback. The renderer carries diffuse selection per drawable
in its existing texture-mode vertex word, independently of texture alpha
format, so ordinary and hit copies can remain in one batch. Whole-pass
diffuse captures retain their existing scoped uniform owner.

Registration closes the two query lanes. `0x0063E5B0` appends a Puppet to
the transient manager and sets its Region pointer, without calling bind.
Arrow and Firebolt use that path; their 0x80/0x100 flags select the appended
lane. GuidedMissile and SkullMissile retain active `+0x36=1` and use actor
registration, so they remain in column-first grid order despite flag 0x100.
DarkFireball inherits Firebolt's disabled grid byte but uses actor registration:
it belongs to neither query lane. The earlier shared query's rule that every
0x180 object belongs at the end is therefore false. Query candidates must carry
their actual grid/transient admission rather than infer it from flags.

The full constructors correct two candidate assumptions: Gold `0x005E12C0`
and Sack `0x005E1460` explicitly clear `+0x36`, and flag 0x400 is outside the
transient append mask. Ordinary pickups of those types are not Mouth targets.
Goodie `0x005E3D60` explicitly enables grid admission with flags 0x2004.
Fencepost is type **3006**, constructor `0x005E1E20`, flag 4; it was absent
from the prior scenery target adapter. Silk `0x005F05D0` is type 2056, flag
0x1000, active one, and actor-owned. Golem's actual constructor is
`0x005F57E0` (the older `0x005E91D0` address is its foot-placement helper):
type 2036, flag 0x800, inherited active grid admission. Damage `0x00607F60`
rejects assembly ages below 400, then changes HP and applies modifiers without
calling Puppet damage or arming a hit redraw.

The player-owned Cocoon overlay is a separate material branch. Raw
`0x00547F42..0x00547F84` authors full red and samples the original texture;
it never enables diffuse selection for that glyph. Its existing material
therefore remains unchanged. This differs from the generic Puppet callback.

ObjectManager `0x004022A0` only invokes the class tick; Region `0x0063EFC0`
does not add a second Puppet tick. Scenery and Goodie call `0x00624AC0` and
decay the latch by .05. Meteor and Leviathan omit that tick, retaining an
armed latch until retirement or another hit. GuidedMissile, SkullMissile,
EyeLaser and Silk replace the ordinary render entry; their shared Damage
callback does not by itself produce a generic red body pass. Meteor's Main
`0x005E16C0` is empty after landing and explicitly resets its global color
before its airborne drawing. Tree/Building Main callbacks append their usual
upper proxies again during a hit redraw; proxy delegate `0x0063ED70` retains
only the owner pointer and does not capture the temporary hit color.

The final Meteor ownership trace explains its unusual grid behavior.
`0x0052BB60` writes the landing point at `+0x140/+0x144`; constructor
`+0x18/+0x1C` remains zero when `0x0063F6D0` binds it. Its initializer is
empty `0x0055C300`. `0x00621590` directly writes the current root as landing
plus the **old** height times `(300*sin(heading), -75*cos(heading))`, with
float component stores, then decrements height. Neither that tick nor impact
`0x00610880` rebinds or replaces the root. Its grid cell consequently stays
the original zero cell, while point-in-polygon uses the moving root. The port
stores landing and current roots separately and keeps that native bound cell;
it must not substitute the landing point as the beam contact position.

`0x0041FE50` multiplies local RGBA by global RGBA; `0x0041FF60` replaces the
global factor. Wrappers `0x00452DB0/0x00452DE0` use that same global factor.
Meteor Main explicitly replaces it with white, so an armed hit repeats its
airborne Main with diffuse texture selection but its own orange/white colors
and alpha, independent of the sampled hit strength. First the orange record-15
corona uses normal blending, then record 50 uses additive blending. The
vertical offset is height times **double -768** at `0x0079CA58`; reading the
first four bytes as a float would incorrectly give zero. The impact-phase
ground image is outside Main and does not acquire a hit copy.

Firebolt's private children are part of its Main re-entry. Trail constructor
`0x006125B0` inserts directly into `Firebolt+0x150`; tick `0x00600880` steps
that manager before the even-tick birth, Main `0x00612760` draws it after the
two body layers, and destructor `0x005E7BB0` destroys it. A trail therefore
inherits the parent's painter and lifetime. It is not an independently sorted
Region actor. Main replaces global RGBA with white plus its lifetime alpha,
so a hit repeats the orange/white body and private trail with diffuse selection,
without applying the incoming hit strength or red color.

Arrow Main `0x0060F590` includes the fading velocity streak, the body, and
optional fire/poison layers. The body keeps the incoming hit color; the fire
layer replaces global RGBA with white/lifetime alpha, and poison replaces it
with `(0, .5*actorCC, 0, 1)`. The overlays therefore retain their own colors
during the hit pass. Neither Arrow's ground shadow nor Meteor's ground pass
belongs to this Main re-entry. Gravestone `0x0060F0F0`, Monument `0x0060E210`,
Fencepost `0x00612CF0`, and Goodie `0x0061F070` each submit their selected
main glyph through the same ordinary local/global color multiplication.

Render-target entry/exit `0x004214C0/0x00421430` changes the target and view
origin without replacing global RGBA or diffuse selection. Matrix saves
`0x0046C340/0x0046C390` preserve only the transform. Leviathan's hit re-entry
therefore runs its appendage/mask capture with the hit context, then submits
its normal/additive composites under that context again; tinting the completed
ordinary composite alone would lose this intermediate alpha behavior.

Explicitly colored primitives also preserve their own material. Building's
`0x00416B80` non-null color-array branch packs that array directly and does
not multiply global RGBA: with Complex Lighting on, its hit is a full-alpha
vertex-gray diffuse mask, not a red/strength-scaled mask. With lighting off,
its ordinary glyph branch uses the global hit color. Arrow's gradient helper
`0x00455840` multiplies supplied endpoints only by local RGBA `+0x1EC`, not
the global factor, so its hit re-entry repeats the ordinary streak. The
fire-overlay branch multiplies local and global lifetime alpha, yielding
`min(visualScale,1)^2`; Firebolt's private Fade children inherit its lifetime
alpha. Meteor's ground callback is vtable `+0x28 -> 0x005E6DE0`, while
`+0x20/+0x24/+0x2C` are empty. Its descent footprint and impact disc stay in
the ground pass and never become hit copies.

The private-trail blend is closed through `Anim_Fade` vtable `0x00784D9C`:
draw `0x00455A20` sets local RGBA and draws the glyph without changing blend.
Firebolt leaves additive blending enabled around its private manager, so these
Fade children inherit additive blending. `Anim_FadeAdditive` instead owns an
explicit mode switch in `0x004560A0`; these are separate caller contracts.

The saved Discorporeal continuation owns the complete private brain and ordered
action list, in addition to its replicated visual fields. Validation must retain
signed native state: Mouth's turn speed can cross zero by .004, beam power can
cross zero by .015, tracking delay keeps decreasing during the beam, recovery
retires at -1, and Spit starts with mouth timer -1 and can accumulate negative
cooldown while turning. The six action variants must retain their exact fields
and booleans. Capabilities use bits 0..5, including MegaSoul bit 16 and the
alternate controller bit 32. The shared death/scream stream clocks must resume
without replaying their birth sounds. Generic Puppet hit records must also
reference a live owner of the recorded kind; saving a timer alone cannot create
an orphan scene drawable.

Mac browser acceptance exposed two web-boundary defects in the Faculty path.
The client presents fractional frames, so the local visual RNG seed must use
the whole frame index while trigonometric phases retain interpolation. The
other boss presentation owners already make that distinction. SkullMissile
and DarkFireball impact/retirement events also require an explicit nullable
target in the existing event protocol: a terrain or area impact has `null`,
a direct SkullMissile contact carries its actual target, and retirement keeps
the missile's tracked target where one exists. An omitted field is invalid.

Fencepost query rows follow the Fence owner during arena cleanup. Entry 227's
action-1066 census excludes Arena `+0x885C`, including posts, so the new spatial
rows must survive even outside the sealed combat rectangle. Goodies instead
follow the live loot store, including exhausted objects until actual retirement;
their removed authored scenery row must not leave a second query target.

EyeImpact audio is FireballHit at .8+signedFloat(.1) and ThrowFire at .6,
both at twice point gain. Spit release plays UnholySpits and ThrowFire; its
impact plays three FireballHit copies (.8+signedFloat(.1),
1+signedFloat(.1), 1+signedFloat(.25)) and restarts the existing Trap stream
at ordinary point gain. Trap is the already retained `trap__stream.wav`,
59966 frames at 44100 Hz (136 ticks), not an additional asset or voice.
The mouth's obstructed endpoint is shifted by Y=-20 before length is read;
it emits a late green BadGuys:15 fade (scale 1.5..3, radius 50, loss .01)
around that point. Its obstruction query uses native mask 0x380. The shared
enemy segment adapter therefore retains the caller's exclusion mask.

### Missing boss HUD report: parent and browser recheck

The reported absent bar is an acceptance condition for this task. The native
placement was rechecked through Game vtable `0x0079B60C`, slot +0x28
`0x005D2520`, CPU draw dispatcher `0x004278C0`, manager `0x004285B0`,
CPU constructor `0x00427370`, and Game constructor `0x005CC800`. CPU creates
a full-viewport rectangle at (0,0) with flags 7; the centered-origin flag
0x10 is absent. The Game HUD therefore keeps the previously recovered
bottom-centered coordinates: fill Y=viewportHeight-109, background Y=H-113,
name baseline Y=H-118. It is not a fixed top-of-screen meter.

Visibility requires Game's HUD-suppression byte +0x85 clear, College flag
`0x00B3BCA0` clear, the local player's alternate/dead +0x160 clear, and a
non-null, non-retired featured pointer. The Website's mode=run gate covers
College exclusion; it now also hides the featured bar for a non-living local
player. Selection still belongs to the authoritative spawn/damage/death/save
owner. No always-visible or top-position workaround is retained.

Mac Chrome proof against the built candidate and an actual resumed generated
Boneyard: the full-health Discorporeal bar was visible after the resume gate
finished, x=671.5, y=791, width=257, height=11 at 1600x900; native expected
Y is 900-109=791. Its ARIA meter and authoritative featured actor both named
The Discorporeal, actor 1, HP 17500. Page-error, console-error and failed-request
arrays were empty. This is one current browser case, not the final all-boss
acceptance or the complete Website gate. Source provenance is the same retail
0.72.5 SHA-256 pinned above; the resume fixture uses the ordinary save protocol.

The first eight Mac Discorporeal runtime/presentation tests passed, including
all 72 body/attachment rows, ordered simultaneous actions, friendly mouth
contact, green descendants, and death-to-finale retention. A production build
also exposed eager connection-code loading in the route. Loading the existing
engine at connection time reduced the Game route from 136616 gzip bytes to
64338, below the unchanged 134144-byte budget. Lint and its boundary/schema
checks passed; the full Website gate remains pending.

UltraBanish's mega branch reuses Anim_Bouncer (`0x00453060`), rather than a
separate bone simulation. Under the retained Enhanced Effects policy it emits
one Bouncer each tick while remaining>100, selecting BadGuys 1819..1822,
setting opacity timer 20, multiplying only the stored bounce velocity by four,
and choosing radial speed 2..2.25 (one-in-twenty multiplier 1.5). The initial
vertical velocity is unchanged. These enter direct Region+0x2C4, before the
other pre-world children; they require an explicit background lane. Their
opacity can outlive the ordinary Bouncer's old 1000-tick bound, so the shared
Bouncer helper derives its non-truncating upper lifetime from the opacity and
known maximum skipped-tick cadence. Actual retirement remains opacity-driven.
