# Complete enemy animation and enemy-projectile VFX closure — 2026-08-15

> Reopened 2026-09-05: the historical Spider/Silk/Cocoon exclusions below are
> false for retail survival. The investigation at the end of this document
> supersedes those exclusions; implementation and browser receipts are recorded
> below, with the final publication gate tracked separately.

## Reported smell and system boundary

The current survival port can make an enemy behave correctly while drawing a
bounded presentation program that the retail renderer never used. Its five
enemy projectile views likewise select plausible shipped art without
reproducing the native compositor, and projectile retirement has no visual
handoff for trails or impacts. Those are not isolated sprite mistakes. The
missing unit is the complete G3-to-G4 enemy presentation boundary: fixed-tick
actor state, authored attachment geometry, live projectile art, and the
projectile-owned transient effects created before retirement.

The compiled enemy census contains nineteen runtime classes. This pass keeps
the whole membership explicit even though the Website currently implements
only the Boneyard survival spawn graph:

| Native type | Runtime class | Current Website disposition | Reason |
| ---: | --- | --- | --- |
| `1000` | `Badguy` | shared base, no body | The compiled body render slot is a no-op. |
| `1001` | `Skeleton` | in-system | Direct Boneyard wave family. |
| `1002` | `SkeletonArcher` | in-system | Direct Boneyard wave family; owns Arrow. |
| `1003` | `SkeletonMage` | in-system | Direct Boneyard wave family; owns Firebolt, GuidedMissile, and direct lightning VFX. |
| `1004` | `Imp` | in-system | Direct wave, Demon child, and recursive split family. |
| `1005` | `GoodImp` | out-of-system | Player ally factory is not reachable from the survival director. |
| `1006` | `Zombie` | in-system | Direct Boneyard wave family; rotten death owns PoisonPool. |
| `1007` | `Wraith` | in-system | Direct Boneyard wave family. |
| `1008` | `DemonSkull` | out-of-system | Story boss and Unholy child graph are not spawned by the Website director. |
| `1009` | `Demon` | in-system | Direct Boneyard wave family; owns DemonBomb and Imp children. |
| `1010` | `DireFaculty` | out-of-system | Story boss scene is not implemented. |
| `1011` | `Heartmonger` | out-of-system | Story boss scene is not implemented. |
| `1012` | `Crow` | out-of-system | Heartmonger-owned helper has no reachable parent. |
| `1013` | `Coffin` | in-system | Direct Boneyard wave family and Maggot owner. |
| `2044` | `GreenImp` | out-of-system | UnholySpit child has no reachable DemonSkull owner. |
| `2045` | `Maggot` | in-system child | Coffin-owned child is replicated independently from the eight parent wave families. |
| `2057` | `Spider` | exact-ported in the 2026-09-05 reopening | Native survival generation owns 23 Spider phases across the twelve supported templates. |
| `2058` | `Cocoon` | exact-ported in the 2026-09-05 reopening | Target-owned restraint created by three accumulated Spider/Silk web applications. |
| `5021` | `Portal` | out-of-system | Story Imp spawner is not spawned by the survival director. |

“Out-of-system” is a reachability statement, not permission to substitute a
generic animation. When a missing scene or spawn owner is ported, its complete
row and child/projectile graph must enter this ledger before it is exposed.
The present acceptance set is all eight parent families, Maggot, all payload
variants of the five reachable projectile classes, Mage direct lightning,
and every live/trail/impact layer those projectiles own.

## Native evidence and falsified web programs

Static evidence is retail Beta 0.72.5 `SolomonDark.exe`, SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`,
joined to the preserved `BadGuys`, `Demon`, and `DeadHawg` manifests. The
reusable method and state reconstruction lives in the Mod Loader documents
`native-animation-state.md`, `native-enemies.md`, and
`native-projectiles-and-effects.md`.

- Imp renderer `0x00492E10` selects
  `285 + constructorVariant(+0x220)*12 + facing12`. Field `+0x220` is the
  constructor-selected four-way body variant, not a contact animation. The
  fixed tick owns bob, alpha, and the optional `333..342` upper effect at
  `(0,-10)`; adding BadGuys `251..254` during contact is a web invention.
- Zombie renderer `0x00493390` adds actor-local angle `+0x21C` before the
  18-way facing quantizer, then composes locomotion/body/rear arm/front arm/head
  through authored record points. Stacking every rotated limb at actor origin
  and driving it with sine waves discards the native skeleton.
- `Action_Zombie_Beat` constructor `0x0044A490` toggles the attacking arm and
  clears progress, then stores `(0.9 + RandomFloat(0.25)) * attackSpeed`.
  Tick `0x00449300` selects arm poses at progress thresholds 50 and 100, keeps
  locomotion live below 80, fires contact on crossing 100, and completes at
  125. It is not the bounded ten-index `zombie-swipe` array.
- Wraith renderer `0x00496220` always selects `2070 + facing18`, at scale `2`
  and local Y `+15`. Attack state changes movement and owned effects, while
  the body remains opaque; there is no multi-frame or fading `wraith-drain`
  body animation.
- Demon renderer `0x00498BA0` selects controller
  `19 + pose(+0x2DC)*18 + facing18`, reads six authored controller points, and
  composes the `1`, `62`, `80`, and `98` directional component banks around
  replicated joint state. A clamped two-pose body plus four origin-stacked
  sine-rotated limbs is not the native articulation.
- `Action_Demon_Spit` constructor/tick `0x0044DD40`/`0x0044DF00` writes the
  exact controller array `[0,0,0,1,1,1,1,1,0]` at
  `0.09375 * attackSpeed` progress per fixed tick, creates DemonBomb at marker
  4, and completes only when progress is greater than 8.
- Coffin `0x004A2760` owns the already recovered hidden/rise/hold/open state
  clock. It is a direct non-facing frame lane, not a generic action array.
- Maggot renderer `0x0049C190` has two disjoint lanes: grounded
  `202 + pose*18 + facing18`, and ballistic emergence
  `2013 + phase(0..4)*10 + orientation(0..9)`. Using grounded crawl/bite art
  during emergence is disproved by the renderer.
- Skeleton, Archer, and Mage retain their recovered native action arrays,
  strict completion comparisons, fixed-tick progress, and 18-facing
  articulated banks. Enemy death remains a handoff to the independent native
  death-effect store; a second renderer-only death clock is not a body
  animation.

The projectile compositor contract is finite and exact at its art/clock
boundary:

| Projectile | Native live presentation | Projectile-owned transient VFX |
| --- | --- | --- |
| Arrow `0x7DA` | BadGuys record `2` at native scale `1.25`, rotated by heading and planted at actor height. Additive fire overlays `255..266` at `(globalTick/5)%12`; additive poison overlays `271..282` at `(age/6)%12`, green-tinted. | `0x005E5EC0` is a force/deflection threshold handoff to record-2 `Anim_SpinAway`, not a periodic trail. Fire contact alone creates the separate `251..254` burst. |
| Firebolt `0x7EB` | Exact 400-tick remaining-life fade `min((400-age)/100,1)`; additive record-15 orange glow at Y `-15`, scale 2 and alpha `0.5`, plus additive `255 + age%12`, rotation `heading+180`, scale `[1,1.5)`. | Every even fixed tick, `0x006125B0` creates source-over fade children with radial jitter `[0,5)`, scale `[0.75,1)`, and alpha loss `[0.15,0.2)`. Impact is a 16-visible-tick two-pass `Anim_FireBurst`: fading record 110 plus four-ticks-per-frame additive `251..254`, moving upward one unit/tick. |
| GuidedMissile `0x7EC` | The hostile clock is 400 ticks and fades out through the final 100. Speed starts at 3, loses `0.075/tick` to `[0.75,1.2)`, and advances native phase by `6*speed`. At Y `-15`, additive cold main 110 or poison main 111 uses white alpha `[0.5,1)` and scale `1.1+abs(sin(p*15 degrees))*0.15*S`; additive aura 112 uses the authored cold/poison tint, `abs(sin(p*6 degrees))*0.55` alpha, `p*0.5` rotation, and `[1,1.3)*S`, with `S` in `[0.9,1.1)`. | `Anim_FadeGM` starts at scale/alpha 2, draws the selected main twice plus 111/112, and loses `0.1` alpha per tick for twenty visible states. |
| DemonBomb `0x7F7` | Straight launch at speed `[2,3)`, horizontal damping `0.995`, height `-35`, gravity `+0.1`, bounce multiplier `0.85`; three unrotated samples in `267..270` at scales `2,2,1.5`, latter two additive. DeadHawg `46..77` uses `(globalTick/2)%32` at Y `-20`, scale `(1,0.5)`, only at speed at most two. It is not homing. | Its inclusive 100..200 counter begins after speed settles below one. Terminal ownership creates two 500-tick Fire `0x7E3` actors at `(x,y-10)` and `(x +/- [10,20),y+5)`; there is no synthetic 32-tick impact strip. |
| PoisonPool `0x806` | Constructor `0x005E3B00` fixes scale/alpha at one and the damage clock at 3000 ticks. Two source-over passes use **DeadHawg record 0**. Scale grows `0.025/tick` to `1.6`; after damage lifetime, alpha loses `0.005/tick`. Pass one alpha is `0.5*a`; pass two alpha is `(sin(age degrees)*0.25+0.75)*a`, scale `max(s-0.6,0)*s*0.75`. | The fixed tick can emit small pool particles; pool fade remains visible for 200 ticks after its damage lifetime rather than disappearing at the contact edge. |

Arrow facing-bucket art or timed spin trails, Firebolt `251 + headingBucket`
or spawn fade-in, GuidedMissile `110 + age%3`, a homing/single-record
DemonBomb, and DeadHawg `46 + age` for PoisonPool are all directly falsified.
Asset residency must therefore add DeadHawg record 0 and keep impact/trail
records separate from live-body selection.

## Authority, geometry, and lifecycle contract

- The host fixed tick owns every actor/projectile animation input and transient
  birth/retirement. The renderer samples snapshots; it never advances a local
  animation clock or infers an impact from a missing projectile.
- Native constructor RNG that is not protocol state is projected
  deterministically from stable entity identity only inside the exact native
  selector domain. It is not described as retail RNG-sequence parity.
- Atlas `extras` are authored local points. Zombie and Demon composition must
  transform and plant child records from those points; no hand-tuned CSS/crop
  offsets or actor-origin stacking is allowed.
- Live projectiles and their transient children share the Boneyard painter and
  Region-light owners. Additive blend is layer-local and must not leak to
  siblings. Removing a projectile cannot remove an already-created trail or
  impact effect.
- Mage lightning is an enemy-owned direct effect rather than a projectile. Its
  per-tick source, midpoint, endpoint, contact attachment, and retirement remain
  in the authoritative pulse store rather than a renderer-local event clock.

## Pre-implementation acceptance contract

Focused coverage must enumerate every in-system enemy state/pose selector,
all Maggot emergence phases and orientations, every projectile payload, every
live frame boundary, deterministic compositor domains, poison-pool growth and
fade boundaries, and every referenced atlas record through the real asset
module. Tests must also prove authored Zombie/Demon point consumption, Wraith
body invariance during attack, strict snapshot retirement, and transient VFX
survival after the parent projectile disappears.

The exact tree must pass `./scripts/validate.sh` on the Mac mini. A Mac
mini-hosted real Chromium `/game` receipt must reach the ordinary wave flow,
observe all eight parent families plus Coffin-owned Maggots and every
projectile family, retain WebGL2 and shared painter/lighting behavior, and
report zero page or console errors. Static/unit evidence closes selector and
lifecycle math; the browser receipt closes actual texture, blend, transform,
and ownership integration.

## Website implementation and final Mac mini receipts

The combined Website boundary uses protocol 27. Replicated entity type 2 now
carries the authoritative Imp, Zombie, Wraith, Demon, Coffin, and shared action
state needed by the stock renderers; type 3 carries the five live enemy
projectiles; type 4 carries independent Coffin Maggots; and new type 6 carries
projectile-owned transients after their parent projectile retires. The host
creates and ages Firebolt trails/impacts, GuidedMissile impact layers,
DemonBomb fire, Arrow fire bursts, and PoisonPool fade layers. The client
timeline interpolates transforms and continuous alpha/scale lanes while
holding discrete art identity, native fixed-tick selectors, and the complete
720-degree GuidedMissile aura-rotation phase. The renderer consumes the exact
BadGuys, Demon, and DeadHawg records through the shared painter and Region
light owners.

The pre-rebase wire run exposed one integration boundary missed by the
in-memory entity tests: that revision's expanded enemy sample had 70
components while its generic JSON tuple guard allowed only 64. After merging
the newer lighting and hit-effect lanes, the exact enemy sample is 63
components, the repository-wide finite ceiling remains 72, and the type
registry still validates the exact 63-component shape. A protocol regression
round-trips 63 and rejects 73 at the generic bound. No compatibility path or
unbounded tuple was added.

The Mac mini canonical `./scripts/validate.sh` gate passed with the pinned
Node 22.17.0, npm 10.9.2, and .NET 10.0.302 toolchain. That receipt includes a
successful backend release build, 24 Website contract/backend integration
tests, 812 frontend Boneyard tests, four level-up tests, six diagnostics tests,
five desktop-shell tests, formatting and architecture checks, lint with zero
errors, the production frontend build, and the production media-policy check.

The focused Mac mini Chrome compositor receipt is
`tools/smoke-enemy-animation-projectile-vfx.mjs`. At fractional presentation
tick `121.75` it retained WebGL2 and `pixi-webgl`, rendered all eight families
(`COFFIN,DEMON,IMP,SKELETON,SKELETONARCHER,SKELETONMAGE,WRAITH,ZOMBIE`), one
Coffin Maggot, one authoritative Mage-lightning pulse, eight live
projectile/payload witnesses, and all nine projectile-effect kinds. Advancing
every enemy articulation and the projectile clocks changed 815,477 pixels
with channel delta 84,854,417. Page, console, and failed-response arrays were
empty. The visually inspected 1600x900 receipt is
`/tmp/solomon-dark-enemy-animation-projectile-vfx-mac-20260815.png` (SHA-256
`bef01acfbbd28c585c13372dea7704a4e2cf2e34e7553fe3d93d956844b9a18f`).

The authoritative ordinary Mac mini `/game` run used
`tools/smoke-boneyard-waves.mjs` against the real local host, WebSocket
transport, entity reconstructor, presentation timeline, and Chrome. It crossed
the authored entry gate, completed Solomon's speech and escape, killed 44
enemies to reach deterministic wave 2, and observed Skeleton claw A/B, Archer
shot, and the native Skeleton terminal handoff. Archer actor 61 created Arrow
entity 2 with descriptor `[3,2,0,2010,61,17690,300,8192,0,3,-1,-1]`; eight
changing compact samples were observed, the renderer owned the Arrow at
presentation tick `17692.44`, and retirement event 399 removed it at
authoritative tick 17727. The run completed player death, game over, retained
loadout, and a clean second Boneyard with no enemies, projectiles, or
projectile effects carried across. Wire and page error arrays were empty.
Visually inspected receipts are
`/tmp/solomon-dark-game-waves-mac-20260815-combat.png` (SHA-256
`e4a683876e792f4b513ffe1dec293567b1f6ae5d89c941404987d525250af3b8`) and
`/tmp/solomon-dark-game-waves-mac-20260815-archer-projectile.png` (SHA-256
`1272ce4664d66a9a84ee7bae28683389a98330af518f73e01d3e37c6e4a6bffe`).

The first task-tree Mac run failed closed after its combat driver kited back
across the authored entry gate and then aimed through the closed leaves. A
clean `origin/main` A/B run completed, isolating the failure to driver
navigation rather than game collision. The smoke now carries the observed
gate crossing direction into combat navigation and remains on the interior
side; no production movement, collision, or projectile fallback was added.

Pre-acceptance diagnostics on Windows Node 22.17.0 completed the full
`test:boneyard` command with 728/728
tests passing, zero failures, cancellations, or skips. The focused closure
set additionally covers all eight parent families, the two Maggot lanes,
every action/strict-end selector, authored Zombie/Demon attachment points,
every projectile payload and compositor, exact asset residency, protocol
spawn/delta/retirement, and transient survival after projectile retirement.
TypeScript and architecture boundaries are clean; lint has zero errors and
only the repository's eight existing React Fast Refresh warnings.

The diagnostic Windows Chrome compositor run is
`tools/smoke-enemy-animation-projectile-vfx.mjs`. At fractional presentation
tick `121.75` it retained WebGL2 and `pixi-webgl`, rendered all eight families
(`COFFIN,DEMON,IMP,SKELETON,SKELETONARCHER,SKELETONMAGE,WRAITH,ZOMBIE`), one
Coffin Maggot, Mage lightning, eight live projectile/payload witnesses, and
all nine projectile-effect kinds. Advancing every enemy articulation and the
projectile clocks changed 808,521 pixels with channel delta 71,963,133. Page,
console, and failed-response arrays were empty. Its 1600x900 visual receipt is
`C:\\Users\\User\\AppData\\Local\\Temp\\solomon-dark-enemy-animation-projectile-vfx-20260815.png`
(SHA-256 `4c26ab1ef991cb29b7f9533b55769205ff54fe6ac9e19b58e3d2067d589d7fa4`).

The diagnostic ordinary `/game` run used
`tools/smoke-boneyard-waves.mjs` against a real local host, transport,
replication reconstructor, presentation timeline, and Windows Chrome. It
crossed the authored gate, triggered Solomon, fought through wave 2, observed
Skeleton claw A/B, Archer shot, and the native Skeleton terminal handoff, then
captured Archer actor 76 creating Arrow entity 2. The type-3 descriptor was
`[3,2,0,2010,76,23407,300,8192,0,3]`; four changing compact samples were
observed, the renderer owned it at presentation tick `23417.61`, and retirement
event 479 removed it at authoritative tick 23426. The run completed player
death, game over, loadout, and a clean second Boneyard run with zero enemies or
projectiles carried across. Wire and page error arrays were empty. Visual
receipts are
`C:\\Users\\User\\AppData\\Local\\Temp\\solomon-dark-enemy-parity-waves-20260815-combat.png`
(`fdc2025fcba1671e557831cdeadabfc5d9523ec5086b6cbb7a71cf20967de0fd`)
and
`C:\\Users\\User\\AppData\\Local\\Temp\\solomon-dark-enemy-parity-waves-20260815-archer-projectile.png`
(`095930e1c06dcc7489123af3b34eeedaadd14b8d3f70c753aa6a6317c47bfdb6`).

## 2026-08-29 — Enemy construction, articulated body, and terminal-VFX seam reopened

### Reported smell and parity question

- Reported web behavior: Zombie still does not resemble stock. The torso,
  legs, arms, head, and flyblown cloud all require verification; nearby enemy
  families such as Imp may carry the same construction/presentation error.
- Expanded report: every reachable enemy death animation and terminal VFX must
  be verified because effects appear absent or incomplete.
- This is a secondary report against an entry previously called complete. The
  earlier passes catalogued record ranges and later patched individual selector
  omissions, but they did not walk the shared factory/config seam through every
  field that survives construction, did not enumerate every Zombie draw site,
  and retained explicitly `bounded-web` substitutes for native terminal
  animation classes. Those skipped system-membership rules are the cause of
  this reopening.
- Falsifiers were: Zombie has no separate continuous stride phase; its attack
  arm records advance `0 -> 1 -> 2`; body lean is not halved; special body type
  3 leaves the leg draw unchanged; terminal actors are genuinely short generic
  fades; or Imp/Demon terminal arrays advance at a fixed frame rate. Fresh
  instructions falsified every one of those assumptions.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | `SolomonDarkAbandonware/SolomonDark.exe`, Beta 0.72.5, preferred base `0x00400000`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, re-hashed 2026-08-29 | Matches the canonical analyzed image. | high |
| Ghidra/tool provenance | canonical `SolomonDark` project through the replica wrapper; read-only Mod Loader revision `08bfba9ef367f7b863848030d0a289dc31e33192`; wrapper SHA-256 `b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49` | All addresses below are preferred-image addresses; no canonical project or Mod Loader source was modified. | high |
| Construction seam | `GameObjectFactory 0x005B7080`, config allocator `0x00463B50`, config application `0x00462790`, `SpawnEnemy 0x00469580` | Type ID selects allocation size/constructor, actor `+0x1D0` retains the built config, family fields are applied, config `+0x74` overwrites constructor scale, then placement/registration and family vtable slots take ownership. A constructor write alone is therefore not a surviving spawn fact. | high |
| Zombie live instructions | constructor `0x004740C0`, tick `0x004863A0`, beat ctor/tick `0x0044A490/0x00449300`, render `0x00493390` | Recovers the missing stride phase, exact arm selector sequence, truncation, half-angle torso transform, body/head/arm draw geometry, body-type-3 leg/body/overlay transforms, and flyblown auxiliaries. | high |
| Terminal class instructions | `Anim_Bouncer 0x00453060/0x00456720/0x00456A60`, `Anim_SmokyBouncer 0x0045B0D0`, `Anim_Unbind 0x00453020/0x00455A20`, `Anim_Banish 0x00458D50/0x00454000/0x0045E600`, `Anim_SpriteArray 0x00453410/0x00457540/0x0045D6E0`, `Anim_MoveFade 0x00452FB0/0x00455A20`, `Anim_FadeScale 0x00452ED0/0x00455DF0`, `Anim_LateSplat 0x00454E40/0x00459DC0/0x00459E60`, `Anim_Fade_Perspective 0x00454000/0x00456340`, clipped draw `0x00456470` | The terminal system is a family of concrete state machines with distinct physics, blends, clocks, transforms, child births, and painter managers; generic fixed-lifetime rows are disproved. | high |
| Family death presenters | Skeleton `0x0048D2A0`, Imp `0x004824A0` plus vslot `+0x9C -> 0x00478860`, Zombie `0x004947B0`, Wraith `0x00495600` plus helper `0x0047F8D0`, Demon tick/render/death `0x00487300/0x00498BA0/0x00482930`, Coffin `0x0049B310`, Maggot `0x0049C830` | Recovers exact family recipes, spawn order, delayed births, post-body handoffs, and terminal audio edges. | high |
| Authored data | `BadGuys`, `DeadHawg`, and `Demon` bundle manifests; complete factory catalog | Every referenced record is extractable. Fresh membership adds DeadHawg record `31` and reclassifies several already-resident records from guessed roles to their true native classes. | high |
| Current Website baseline | Website `origin/main` `d43def16dd0df9558bb295ebf3359985bc1a40d8`; `boneyard-enemy-store.ts`, `boneyard-transient-effects.ts`, `native-enemy-presentation.ts`, `native-enemy-animation.ts`, death-effect projection/replication/view code | Zombie omits `+0x140`, uses the wrong three arm poses, round-to-even and full torso angles, and incomplete type-3 geometry. Terminal code uses fixed generic clocks, wrong art/counts/scales/painter lanes, and no concrete Banish/Smoky/LateSplat classes. | high |

### System boundary and membership inventory

Native system: **factory-constructed enemy presentation and terminal handoff**,
from parsed/built MonsterRecipe through factory construction and config
application, authoritative fixed-tick presentation fields, class render slots,
damage/death transition, concrete animation actors, audio/child births, painter
registration, replication, and teardown.

The complete compiled enemy census remains nineteen classes. Website survival
reachability and this reopening's disposition are:

| Native member | Factory/type and native owner | Disposition | Proof contract |
| --- | --- | --- | --- |
| `Badguy` base | `0x3E8`, ctor `0x00473390`, no-op body render | out-of-system: shared nonvisual base | factory/config/tick/death call graph only |
| Skeleton | `0x3E9`, render/death `0x0048DEE0/0x0048D2A0` | exact-ported by this correction | existing live articulation plus exact Bouncer/Unbind state and lanes |
| SkeletonArcher | `0x3EA`, render `0x0048F450`, shared death | exact-ported by this correction | held-arrow/live coverage plus shared terminal class coverage |
| SkeletonMage | `0x3EB`, render `0x00491720`, shared death | exact-ported by this correction | element/live coverage plus shared terminal class coverage |
| Imp | `0x3EC`, render/death `0x00492E10/0x004824A0`, vslot `0x00478860` | exact-ported by this correction | live flight retained; split/non-split Banish and SpriteArray branches separated |
| GoodImp | `0x3ED` | out-of-system: player-owned temporary ally is not a survival factory member | distinct owner/factory row retained |
| Zombie | `0x3EE`, render/death `0x00493390/0x004947B0` | exact-ported by this correction | every body/head/arm/gait bank, both action sides, normal/body-3/flyblown, and terminal branches |
| Wraith | `0x3EF`, render/death `0x00496220/0x00495600` | exact-ported by this correction | live body/wisps retained; MoveFade/FadeScale/Smoky/Bouncer/Unbind recipe exact |
| DemonSkull | `0x3F0` | out-of-system: story boss is not constructed by Website survival | factory row and child graph dispositioned |
| Lesser Demon | `0x3F1`, tick/render/death `0x00487300/0x00498BA0/0x00482930` | exact-ported by this correction | live articulation retained; 100-tick directional terminal body and delayed terminal handoff exact |
| DireFaculty | `0x3F2` | out-of-system: story boss | factory row retained |
| Heartmonger | `0x3F3` | out-of-system: story boss | factory row retained |
| Crow | `0x3F4` | out-of-system: Heartmonger-owned helper has no reachable parent | child row retained |
| Coffin | `0x3F5`, render/death `0x0049AC90/0x0049B310` | exact-ported by this correction | live state retained; exact ordered fragment populations and Unbind lane |
| GreenImp | `0x7FC` | out-of-system: Unholy story child | distinct renderer/factory row retained |
| Maggot | `0x7FD`, render/death `0x0049C190/0x0049C830` | exact-ported by this correction | constructor scale, crawl/emergence, and per-offset Bouncer/FadePerspective terminal actors |
| Spider | `0x809` | exact-ported in the 2026-09-05 reopening | Complete native survival and actor program below |
| Cocoon | `0x80A` | exact-ported in the 2026-09-05 reopening | Target-owned Webbed restraint and release lifecycle below |
| Portal | `0x139D` | out-of-system: story/spawner class is not a Website survival token | factory row retained |

Lateral branches are also explicit:

| Branch | Disposition | Reason |
| --- | --- | --- |
| Enhanced Effects ON | exact-ported | Website intentionally pins the shipped default ON; all doubled/shadow/Smoky/timer branches are the reachable product path. |
| Enhanced Effects OFF | out-of-system | Website exposes the stock label as fixed ON and has no mutable OFF producer. |
| Skeleton/Zombie alternate absorption flag `0x100` | out-of-system | no Website Boneyard damage producer authors that native transient component flag. |
| secondary-component lethal Unbind alpha `1.25` | out-of-system | current Website damage requests carry one primary health lane; the exact branch remains rejected until a component producer exists. |

No member is `blocked-by-platform`: every live/death mechanism is representable
with authoritative numeric state and ordinary WebGL sprites, gradients, meshes,
and painter lanes.

### Native ownership thread

```text
MonsterSetup_Parse 0x004AFBC0
  -> BuildEnemyConfig 0x0046B390
  -> GameObjectFactory 0x005B7080 / allocation wrapper 0x00463B50
  -> concrete constructor
  -> ApplyEnemyConfig 0x00462790
  -> SpawnEnemy 0x00469580 placement/register
  -> class tick + render + contact + death vtable slots
  -> shared death 0x004819D0
  -> concrete terminal animation actors / children / audio
  -> animation tick/render/destructor and manager teardown
```

- Factory type selection, allocation size, constructor, vtable, and config
  application are one seam. Constructor-only values are not ported when
  `0x00462790` overwrites them from the built recipe; Maggot is a notable child
  path whose constructor scale survives because Coffin does not reapply the
  wave config.
- Config `+0x74` is also the surviving composite render scale. The Website
  previously used it for movement and collision but dropped it at host
  projection, so every authored non-unit Skeleton, Imp, Zombie, Wraith,
  Demon, or Coffin remained visually unit-sized. Protocol 107 in this entry,
  retained by the combined protocol 108 cutover, carries
  that immutable construction result and the renderer applies it once at the
  complete articulated root; family-local scales remain relative to it.
- Render is read-only. Continuous phases, discrete selectors, death clocks,
  and terminal RNG are fixed-tick authority and must be replicated or projected
  from authoritative effect actors; renderer cadence never advances them.
- `Region+0x278`, the world-sorted/ZAnim managers, `Region+0x2C4`, and
  `Region+0x1E0` are distinct painter owners. LateSplat/SpriteArray pre-world,
  ordinary moving/bouncing/fading actors, and post-world Unbind/raw bursts may
  not be collapsed into one Y-sorted lane.

### Recovered Zombie live contract

- Facing is `trunc((heading + actor+0x21C + 10) / 20) mod 18`.
- `actor+0x140` is a separate continuous stride phase, initialized with
  `Float(360)` and advanced by movement scalar `*4`. Legs use
  `-abs(sin((phase * 0.5) degrees))`; `+0x144` independently chooses the eight
  `2365..2508` gait banks.
- Idle torso angle is `trunc(sin(bodyPhase) * 45 / 10) * 10`. Beat adds signed
  `swing/3`; the renderer applies **half** of the resulting angle. Web round-to-
  even and a full-angle transform are both wrong.
- Head angle is `trunc(sin(headPhase * 0.5) * 20 / 5) * 5 + baseHeadAngle`.
- Beat arm banks are `1` below progress 50, `2` from 50 through below 100, and
  `0` at/after 100. Side `0` applies the selector/swing to the rear arm; side
  `1` applies it to the front arm. Locomotion remains live below 80, contact
  crosses 100, and completion is 125.
- Ordinary body root is `(1,0)`. Body type 3 uses local scale `1.15`, root
  `(1,-8)`, a gait/leg draw at `forward(heading)*4` with scale `2`, body-only
  shift `forward(heading)*-5`, and two overlay shifts
  `forward(heading)*-4` from the transformed rear/front anchors. The head keeps
  actor scale rather than the body-3 scale.
- Body record points `0/1/2` remain the head/rear/front authored anchors and
  are transformed by the body root, `1.15` scale when selected, and half-angle
  torso rotation before child placement.
- Flyblown `+0x24E` is independent of body/head selectors. Its two record-65
  clouds, `5..20` record-26 flies, one-in-75 FadeSin children, and loop request
  remain after the articulated body; they do not select an arm bank.

### Recovered terminal-animation class contract

| Native class | Exact contract relevant to Website |
| --- | --- |
| `Anim_Bouncer` | Constructor RNG is `Float(3)`, `Float(20)`, `Float(360)`, then `Float(10)` before the family assigns its record, trajectory, and overrides. Family presenters register the object and immediately invoke its first tick. Airborne updates skip every third world tick; active ticks integrate XY, height, gravity `+0.4`, rotation, and timer `-0.015`. Ground contact retains vertical velocity by `0.65`, rerolls angular speed in `[1,11)`, independently has a 50% XY `*0.65` damping branch, and settles below `-0.75`. Enhanced timer is `10`; render alpha is `min(timer,1)` with optional black `(x,y+2)` shadow at Y scale `.75`. |
| `Anim_SmokyBouncer` | Runs Bouncer first. While still airborne, `Integer(3)==1` emits additive record `10` at radial distance `[0,10)`, tint `#BEBF8F`, scale `[.1,.35)`, alpha `[.25,.70)`, loss `.01`, and random rotation. |
| `Anim_Unbind` | Normal-blend record `86`, position `(x+1,y-15)`, then RNG in rotation, angular magnitude, signed-direction order; family alpha/loss and the post-world manager remain independent. It is not an additive world-sorted sprite. |
| `Anim_Banish` | Additive procedural six-gradient beam plus two record-15 copies and two `333..336` global-tick copies. The upper gradients use half the stock 900-pixel back buffer and the lower gradients use extracted constant `50`. State starts at `2`, loses `.02/scale`, and uses the caller scale; it is not a single record-15 fade. |
| `Anim_SpriteArray` | Additive pre-world array with continuous phase, phase velocity, and damping. Imp uses scale `2*s`, rate `.5/s`, damping `.98`; Demon uses scale `4`, rate `.25`, damping `.995`. It does not fade one frame per tick. |
| `Anim_MoveFade` | Normal-blend record `10/11`, alpha `1`, loss `.025`, scale `[1.5,2)`, initial position `origin + velocity*10`, velocity magnitude `[2,4)`, and per-tick velocity `*.8`. |
| `Anim_FadeScale` | Additive record `20`, alpha `2`, loss `.1`, initial scale `1`, multiplicative scale `1.02` per tick. |
| `Anim_LateSplat` | Pre-world DeadHawg `31`, delayed `25..100` ticks, rotation `[0,360)`, scale `[.75,1.5)`, timer `[3,6)`, loss `.01`, alpha `min(timer*.25,1)`, and perspective Y scale `.75`. |
| `Anim_Fade_Perspective[_Clipped]` | Normal blend, rotation plus X scale and `.75` Y scale. Zombie clipped DeadHawg `30` starts timer `10`, loss `.01` with Enhanced Effects, clip multiplier `.6`, scale `[1.5,1.875)`. Maggot DeadHawg `28` starts timer `2.5`, loss `.01`, scale `[.65,1)`, and tint `#828C6B` with authored alpha multiplier. |

All of these renderers explicitly install their own white/color/blend state and
perform no Region-light query. They emit no outbound light and bypass the
Website's per-object inbound Region tint.

### Family terminal recipes and corrected nearby findings

- Skeleton/Archer/Mage keep the previously recovered Enhanced 18-fragment
  shatter, equipment fragments, skull, feedback, and audio. The shared
  correction is native Bouncer contact state plus normal/post-world Unbind.
- Imp terminal scale is `s=0.25` when a permitted split creates the two child
  Imps and `s=1` otherwise. Banish duration is therefore 25 or 100 ticks;
  SpriteArray scale/rate are `.5/2` or `2/.5` respectively. The current fixed
  scale `1.25` and fixed 19-tick strip have no native branch.
- Zombie builds and shuffles base vector
  `[2094,2089,2092,2090,2091,2093,2093]`, adds Enhanced
  `[2090,2091,2090,2091,2094]`, and adds that five-row group twice again when
  flyblown, then creates one random `2365..2508` gait fragment. Record `2088`
  exists beside the vector but this presenter never inserts it. Flyblown death additionally creates `6..10`
  LateSplats at radial distance `[75,150)`. The clipped DeadHawg-30 actor lasts
  up to 1,000 ticks under the shipped Enhanced branch, not 36.
- Wraith calls the 12-MoveFade + FadeScale + 12-Bouncer dissolve helper before
  its shuffled body fragments. Enhanced body/skull fragments are
  `Anim_SmokyBouncer`; the skull uses speed `5`, height `-[10,20)`, and bounce
  retention `.7`. Helper record-27 bouncers retain timer `1.5`, not `10`.
- Demon lethal state retains a directional record
  `55 + trunc((heading+26)/52) mod 7` for 100 ticks at scale `1.2`, with alpha
  `1-deathTick/100`. All three ordered draws remain under native additive
  selector `0x3F1`: one opaque pass followed by two fading passes, with the
  third also setting `0x3F3`. Its composite root freezes at lethal entry rather
  than continuing the living sinusoidal bob. Fires birth
  at clocks `0/20/40/60/80`, flash/demon-die plus FireBurst at `95`, and only
  the clock-100 terminal handoff creates Banish, SpriteArray, split Imps,
  rewards, and removal. The current sequential 55..61 strip and tick-zero
  terminal handoff are false.
- Coffin order is shared bones, `40..50` main fragments, `12..15` extra
  fragments (BadGuys `2067..2069` only; corrected by entry 081's 2026-09-04
  reopening), skull, then post-world Unbind. Main/extra bouncers have distinct
  launch magnitudes and doubled bounce velocity; the current root-only generic
  launches and `12..16` count are wrong.
- Maggot constructor scale `1+Float(.25)` survives its child construction and
  applies to crawl/emergence art. Terminal output is one random `2013..2062`
  Bouncer plus one DeadHawg-28 FadePerspective at the body and each authored
  burst offset. Offset bouncer speed remains its own `[.5,1)` constructor-side
  draw and is not multiplied by the fade's independent `[.25,.5)` alpha. The
  fade lasts 250 ticks before retirement, not 12.

### Web implementation consequence

- Add authoritative Zombie stride phase and exact renderer geometry; replace
  the false arm/quantization/torso rules everywhere, including protocol and
  interpolation.
- Carry the factory-applied config scale through host projection, entity
  replication, strict JSON validation, and the complete articulated renderer
  root instead of treating the same field as movement-only state.
- Remove the unused `bounded-web` death-program catalog. Family terminal state
  belongs to the server effect actors and the exact Demon death owner.
- Deepen the terminal module around the concrete native animation classes,
  preserving their shared tick formulas while keeping family recipe assembly
  in the enemy store.
- Add the pre-world death lane, restore post-world Unbind, bypass Region tint
  for native terminal actors, and render Banish gradients/duplicate sprites
  instead of a surrogate record.
- Add DeadHawg record `31` to the closed runtime asset union. No generated art,
  guessed frame, compatibility schema, or fallback asset is permitted.

### Validation contract

- Focused authority tests: Zombie stride initialization/advance, both beat
  sides and `1/2/0` thresholds, truncation and half-angle, all body/head types,
  every facing, body-3 leg/body/overlay equations, and fixed-tick replication.
- Per-family terminal tests: exact actor counts/order/records, RNG domains,
  class clocks, bounces/child births, painter lane, blend, tint bypass, delayed
  births, terminal audio, children, and retirement for all eight parents plus
  Maggot.
- Protocol/timeline tests: strict new sample shapes, fractional interpolation,
  delayed actor birth, Demon 0..100 state, and no replay on late join.
- Mac Chrome WebGL2 generated compositor: normal/body-3/flyblown Zombies in
  idle and both beat sides; every terminal family at early/mid/late clocks;
  Banish gradients, Zombie LateSplats, Wraith smoke/core, Demon directional
  body, Coffin debris, Maggot perspective fades; empty page/console/response
  errors.
- Real `/game` journey: natural Zombie movement/contact/death, Imp split and
  non-split terminal branches, Wraith/Demon/Coffin/Maggot deaths, reset, and no
  retained terminal actor after its exact teardown edge.
- Exact candidate must pass focused suites and
  `/opt/homebrew/bin/bash ./scripts/validate.sh` on the Mac mini. A generated
  fixture alone is not the browser completion receipt.

### Reopened implementation and validation receipt — 2026-08-29

- Website implementation now carries native Zombie stride state, exact Beat
  selectors and articulation transforms, the body-3 root/leg/overlay geometry,
  independent flyblown auxiliaries, factory-applied composite scale, surviving
  Maggot constructor scale, and protocol 107 authority through interpolation
  and rendering. Combined protocol 108 retains that enemy wire unchanged.
- Terminal authority now models all thirteen reachable concrete effect kinds:
  Banish, Bouncer, SmokyBouncer, Fade, FadeAdditive, FadePerspective,
  FadePerspectiveClipped, FadeScale, FireArray, LateSplat, MoveFade,
  SpriteArray, and Unbind. The family assembly test independently covers
  Skeleton, Archer, Mage, split/non-split Imp, normal/flyblown Zombie, Wraith,
  Demon clocks `0/95/100`, Coffin, and Maggot.
- A final instruction audit confirmed the Banish `900/2` and `50` beam extents,
  corrected the Demon death body to three additive passes, and froze the
  Website's semantic articulated Demon root on the lethal edge.
- Integration with the later Region-painter closure keeps a registration on
  every world-sorted birth and null registration on native pre/post direct
  queues. The browser probe found that Imp attack-marker registration was
  previously inferred by searching the not-yet-appended actor list; the
  marker's known actor owner now allocates its transient registration directly.
- The exact candidate rebased on Website `origin/main`
  `13d5987966a58a31f362ac047ef126e21912ae78`. Local and Mac candidate indexes
  produced the same Git tree before validation. Focused Mac type-check and
  server/protocol/renderer suites passed, including 324 combined focused tests
  before the later full-gate run and the new all-family terminal inventory.
- `/opt/homebrew/bin/bash ./scripts/validate.sh` completed on the exact Mac
  candidate: backend build and 28 integration contracts, strict frontend lint
  with zero errors, generated-content checks, every frontend suite including
  the 1,200-plus Boneyard run, desktop tests, production build, media policy,
  and bundle budget all passed. Production `Game-QLnsKelv.js` measured 264,741
  raw / 80,353 gzip bytes against 524,288 / 134,144 limits.
- The Mac Chrome WebGL2 generated compositor rendered all eight live families,
  both Zombie gas clouds plus six flies, a visibly applied Zombie root scale
  of `1.25`, all thirteen death-effect kinds, and all three painter lanes. It
  reported 432,595 changed animation pixels, empty page/console/response
  errors, and a dedicated death-class screenshot SHA-256
  `596eda2e3b6e23450222517976d96f049637b10e3a46fc217cf216fb1beb90ce`.
- The production-built real `/game` journey naturally killed a Skeleton,
  observed the `skeleton-shatter` terminal output, retained nineteen Bouncers
  plus post-world Unbind, reconnected, and restored all twenty family death
  actors. Page, failed-response, and entity-wire error arrays were empty; the
  production combat screenshot SHA-256 is
  `b43e160b3fa7bf859d049501c2dc8b4c843405dbce64c73aafe8af11863cfe6a`.
- Visual inspection found the articulated scaled Zombie, flyblown cloud/swarm,
  procedural Banish beam, perspective splats/fades, SpriteArray, Unbind, and
  bouncing fragments visible without black quads, missing texture records, or
  painter starvation. No member is blocked by the browser platform and no
  remaining system unknown requires a web approximation.
- This receipt is committed only on the focused task branch. It is not pushed,
  deployed, or production-live.

## 2026-08-31 — Lesser Demon composite geometry reopening

### Reported smell and parity question

- The Website Lesser Demon is visibly too small while alive and appears to
  enlarge when its death presentation replaces the articulated body.
- The supplied `SDO - Demon Correct Size.mp4` is a `1600 x 900`, 30 fps,
  4.001944-second native reference (SHA-256
  `028946c85f8b55cc6fb90f2eda6f7b791b0905ebc179e5c062b0a82a81841f4e`).
  Its living Demons retain the broad two-extremity silhouette through movement
  and attacks; death is a distinct whole-body strip, not the first correctly
  sized live frame.
- This is a secondary report in a system previously called complete. The
  earlier pass found the correct record ranges and controller points, but did
  not drain the render instructions that scale those points, did not recover
  the planted-extremity writer, treated a stretched textured connector as an
  ordinary sprite, and omitted the mirrored upper-limb draw. Those skipped
  geometry and membership rules caused the false closure.
- Falsifiers were: all living parts use one scale; records `98..115` are
  ordinary joint sprites; each endpoint is drawn once; controller points are
  consumed raw; or the death scale is the same composite path as the living
  body. Fresh instructions falsified every one.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | `SolomonDarkAbandonware/SolomonDark.exe`, Beta 0.72.5, preferred base `0x00400000`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, re-hashed 2026-08-31 | Matches the canonical analyzed image. | high |
| Supplied clean observation | `SDO - Demon Correct Size.mp4`, frames 1..120; representative unobscured living body at frame 45 | Living body has the controller, paired extended upper limbs, paired planted extremities/connectors, attached head, and five fires in one broad silhouette. | high for visible membership and relative size; capture-to-executable identity is not independently encoded in the MP4 |
| Ghidra/tool provenance | canonical `SolomonDark` project through the replica wrapper; read-only Mod Loader revision `08bfba9ef367f7b863848030d0a289dc31e33192`; wrapper SHA-256 `b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`; `decompile_targets.py` SHA-256 `899167ca42624e09f26d22233365631a6ee8b3d106e337e20b77574894e97465` | All addresses below are preferred-image addresses. The canonical project and Mod Loader checkout were not modified. | high |
| Construction/default scale | `MonsterRecipe::MonsterRecipe 0x006400C0`, config build/apply `0x0046B390/0x00462790`, Demon constructor `0x00479150` | Default recipe `+0x74` is exactly `1`; config application overwrites the constructor-only random scale. The visible mismatch is therefore inside the Demon family compositor, not a missing wave-recipe multiplier. | high |
| Planted-extremity state | Demon init `0x00487230`, target helper `0x00479620`, tick `0x00487300` | Init plants two endpoints at local `(12,-30)` and `(-12,-30)`, scaled by actor `+0x74` and rotated by the 20-degree facing bucket. Moving idle state replants them at staggered phases of a constructor interval `76..150`, advances `p=(p+.015)*1.06` to one, and adds lift `-6*sin(180*p)`; attacks and death freeze that lane. | high |
| Living draw instructions | Demon render `0x00498BA0`; scalar data `0x00784818=0.8`, `0x00785360=1.2`, `0x007DE860=1.5`, `0x007DE8D8=5` | Both record-`62..79` endpoint sprites draw at `0.8`; both record-`98..115` textures become stretched quads from the endpoint record's point zero to controller point `6/7`; controller `19..54`, both normal/mirrored `1..18` upper limbs, and attached `80..97` draw at `1.2`; controller attachment geometry and fire bases use the separate `1.5` lane. | high |
| Death draw instructions | `0x00498C8F..0x00498E49` within renderer `0x00498BA0` | The lethal branch selects `55 + trunc((heading+26)/52) mod 7` and draws three additive passes at actor scale times `1.2`. It never proves that the living composition is unit-sized. | high |
| Attack/muzzle instructions | `Action_Demon_Spit 0x0044DD40/0x0044DF00`, event `0x0049A270` | Selector sequence remains `[0,0,0,1,1,1,1,1,0]`. Muzzle ownership starts from the live endpoint midpoint plus controller point five before the heading offsets and child births. | high |
| Mac Website baseline | exact `origin/main` `41e1525491649235c00e82207f67803084138943`, Mac Chrome WebGL2, `smoke-enemy-animation-projectile-vfx.mjs`; live screenshot SHA-256 `9006e4365bf6507f5a05409d9611bde890789647cf68d9812fb71f0142dc11cd` | The real view reports every living Demon layer at scale one, uses raw point offsets, has only five body entries, and renders record 98 as a small sprite. Page, console, and failed-response arrays are empty, so this is a geometry defect rather than a failed asset load. | high |

The attempted supporting live-memory check found no running injected
`SolomonDark.exe`; no stale PID, ASLR base, or loader observation is used as
evidence. Static instructions fully determine the material geometry.

### System boundary and membership inventory

Native system: **Lesser Demon live composite, planted-extremity, auxiliary,
hit, and terminal presentation**, from factory scale and spawn initialization
through fixed-tick endpoint state, ordered atlas draws, attack muzzle, death
handoff, replication, and teardown.

| Member / branch | Native source | Disposition | Proof / consequence |
| --- | --- | --- | --- |
| Recipe/config scale | `0x006400C0`, `0x0046B390`, `0x00462790`, actor/config `+0x74` | verified-already-at-parity | immutable Website `config.scale` remains the one outer actor-scale lane; no Demon-only recipe patch |
| Spawn endpoint initialization | `0x00487230 -> 0x00479620` | exact-ported by this reopening | both sides, facing bucket, actor scale, current/start/target state, phase and interval are authoritative |
| Idle/moving endpoint update | `0x00487300` | exact-ported by this reopening | staggered replant, accelerating phase, lift, planted-world continuity, and base-angle reroll are fixed-tick state |
| Bomb-action freeze and controller selectors | `0x0044DD40/0x0044DF00` | exact-ported by this reopening | endpoint state freezes while the existing exact nine-selector program runs |
| Demon `1..18` | renderer `0x00498BA0`, complete 18-facing bank | exact-ported by this reopening | one ordinary upper limb plus one reversed-facing mirrored draw, both at `1.2` and controller points `0/1` scaled by `1.5` |
| Demon `19..36` | renderer controller pose zero | exact-ported by this reopening | every facing, native origin, actor scale times `1.2` |
| Demon `37..54` | renderer controller pose one | exact-ported by this reopening | every facing and attack selector, same `1.2` geometry |
| Demon `55..61` | lethal branch in `0x00498BA0` | verified-already-at-parity | seven directional death records, three additive passes, 100-tick fade, scale `1.2` |
| Demon `62..79` | endpoint sprites in `0x00498BA0` | exact-ported by this reopening | the selected facing record is drawn twice at the two planted endpoints, scale `0.8`, endpoint-Y order |
| Demon `80..97` | attached late draw in `0x00498BA0` | exact-ported by this reopening | selected facing record uses controller point five and scale `1.2`; it is not a point-six joint sprite |
| Demon `98..115` | `0x00498BA0 -> 0x0041F830` | exact-ported by this reopening | selected facing texture is drawn twice as endpoint-to-controller textured quads, not ordinary sprites |
| DeadHawg `46..77` five persistent fires | constructor/tick/render `0x00479150/0x00487300/0x00498BA0` | exact-ported by this reopening | all 32 records, five phase/offset lanes, scales `[.5,1.1,.5,.8,.8]`, controller points `2/3/4` and two midpoints scaled by `1.5`, point-five split order |
| Living hit redraw | common damage compositor plus Demon body membership | exact-ported by this reopening | all eight opaque living body/connector submissions redraw red; independent five fires do not |
| Demon bomb muzzle and DemonBomb child | `0x0049A270`, type `0x7F7` | exact-ported / verified-already-at-parity | muzzle now consumes the replicated live endpoint midpoint; existing burst/projectile clocks, art, light, collision, and teardown stay unchanged |
| Delayed death fires and clock-95 burst | `0x00487300` | verified-already-at-parity | existing five births and post-world FireBurst remain independent of body geometry |
| Clock-100 Banish, SpriteArray, split Imps, reward, removal | `0x00482930` and concrete terminal classes | verified-already-at-parity | existing authoritative terminal store and teardown remain unchanged |
| Skeleton/Archer/Mage, Imp, Zombie, Wraith, Coffin/Maggot, Portal | distinct render slots and authored banks | out-of-system for Demon family-local geometry | shared outer `config.scale`, hit, painter, replication, and teardown contracts remain regression witnesses; no Demon constants are applied to siblings |
| Enhanced Effects OFF | stock setting gate | out-of-system | Website pins the shipped Enhanced Effects default ON; no mutable OFF producer exists |

No member is blocked by the browser: Pixi/WebGL can represent the ordinary
sprites, mirrored transform, and textured connector quads exactly.

### Native ownership thread and recovered contract

```text
MonsterRecipe default/build -> factory/config apply
  -> Demon::init 0x00487230 (two planted endpoints)
  -> Demon::tick 0x00487300 (movement/replant/lift or frozen action/death)
  -> Action_Demon_Spit selector writer 0x0044DF00
  -> Demon::render 0x00498BA0
       endpoint sprite + textured connector, twice in endpoint-Y order
       controller + ordinary/mirrored upper limbs
       behind fires -> attached late record -> front fires
  -> event 0x0049A270 / DemonBomb
  -> lethal 0..100 body and delayed children
  -> terminal actors, split children, reward, removal
```

- Outer actor `config.scale` is applied exactly once. Family-local `0.8`,
  `1.2`, and `1.5` multipliers remain inside the Demon compositor.
- Endpoint state is simulation-owned and fixed-tick. The renderer samples
  offsets and angles; it does not advance phases from browser cadence.
- Connector geometry is one textured rectangle whose long axis joins the two
  recovered endpoints and whose cross-axis retains the selected record width.
  A generic line or an ordinary sprite cannot preserve its art or bounds.
- Endpoint sprites and connectors precede the controller. The two upper limbs
  follow the controller, with the rear copy using reversed facing and negative
  X scale. Behind fires precede record `80..97`; front fires follow it.
- Death, reset, disconnect, late join, and scene teardown retain the existing
  authoritative actor/effect lifecycle. A late client receives endpoint state
  rather than restarting the stepping cycle.
- Native uses the process-global RNG for constructor fire values and step-angle
  rerolls. Website retains the established actor-owned deterministic visual
  stream while preserving every native range, timing gate, membership, and
  ordering; cross-launch RNG word identity is the only substitution.

### Nearby-system findings

- `0x0041F830` is a general textured-quad-between-points primitive. This pass
  does not reclassify its unrelated callers; it ports the two Demon call sites
  through a cohesive enemy connector layer.
- Demon shadow/contact functions consume the endpoint midpoint, confirming
  that the two endpoint fields are durable actor state rather than temporary
  renderer locals. Existing collision radius and navigation clearance remain
  distinct gameplay bounds and are not resized with presentation.

### Web implementation consequence

- Deepen `boneyard-demon-articulation.ts` into the authoritative endpoint
  state/update owner and project its current offsets through the enemy sample.
- Replace the four false independent joint rotations with the native paired
  angle/endpoints contract, cut protocol cleanly, and interpolate continuous
  offsets without a compatibility decoder.
- Replace `demonLayers` with the complete ordered membership and exact scale
  lanes. Render `98..115` through a textured connector primitive and restore
  the missing mirrored `1..18` limb.
- Scale persistent-fire bases and split threshold in their authored controller
  coordinate space. Feed the live endpoint midpoint to the muzzle owner.
- Do not change Demon collision, navigation clearance, damage, projectile,
  lighting, terminal output, or any sibling family.

### Validation contract

- Focused kernel tests: both spawn targets for all eighteen facing buckets,
  actor-scale application, `76..150` interval domain, staggered replant,
  `(p+.015)*1.06`, `-6*sin(180p)`, planted continuity, action/death freeze,
  and deterministic base-angle reroll range.
- Renderer tests: every row in Demon `1..115` and DeadHawg `46..77` is reached;
  both endpoint sprites and both connector rectangles exist; exact
  `.8/1.2/1.5` scales, reversed facing/mirror, point indices, endpoint-Y order,
  fire split, hit membership, death branch, and muzzle midpoint are asserted.
- Protocol/timeline tests: strict new sample shape, round trip, fractional
  endpoint/angle interpolation, late join, and no renderer-owned phase advance.
- Mac Chrome WebGL2: dedicated living/death Demon crops, measurable opaque
  bounds larger than the old compact body, two visible textured connectors,
  stable attack transition, empty page/console/failed-response arrays, and the
  unchanged all-family/projectile/death inventory.
- Real `/game`: naturally observed living Demon, bomb marker/projectile,
  lethal `0..100` transition, terminal removal, and second-run reset.
- The exact rebased candidate must pass focused suites and
  `/opt/homebrew/bin/bash ./scripts/validate.sh` on the Mac mini before push.

## 2026-09-05 — Hostile projectile flight and lifetime reopening

### Reported failure and evidence boundary

The reported Archer arrow falls immediately after release. This is another
report against the supposedly closed projectile system. The earlier passes
recovered constants but skipped their enclosing branches: `Arrow+0x168` gates
**the entire descent/drag program**, not only its draw angle. They also called
bounded sibling launch, targeting, collision, and expiry programs verified.
The projectile dispositions and the 400-tick GuidedMissile claim above are
reopened. The earlier 273 Arrow flight and angle sections are superseded by
this instruction-derived contract.

Website investigation base: `f9d736bf03e3d917ce1cf31dd3778a4423b40f94`.
A deterministic Mac M2 / Node 22.17.0 replay releases an ordinary Archer arrow
from `(0,0)` toward a stationary player at `(0,-300)`, without obstacles. It
starts at `(0,-30)`, speed `5.826210021972656`, height `-25`, countdown `74`.
The uncorrected host lowers it on age 1, reaches height `-2.5` on age 30, and
stops at `(0,-185.96570253372192)` on age 31 with countdown `43`. No player
impact occurs. The unattended reproduction exits with
`Unobstructed Archer shot falls short of stationary target at 300 units`.
This directly reproduces the report in authoritative state; it is not a
camera, interpolation, texture orientation, or browser frame-rate defect.

Retail source: unmodified 0.72.5 `SolomonDark.exe`, 4,723,200 bytes, SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred
base `0x00400000`. Fresh static queries use canonical project `SolomonDark`,
program `SolomonDark.exe`, and the leased replica pool through the read-only
Mod Loader wrapper. Tool revision: `08bfba9ef367f7b863848030d0a289dc31e33192`;
wrapper SHA-256:
`b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`.
Queries include constructor/tick/render/contact decompiles, complete raw
instruction dumps, and the constructor/tick xref census below. Disposable
outputs are under `%LOCALAPPDATA%/Temp/sdr-enemy-projectile-flight-20260905-root`.

A separately copied, directly launched stock instance has PID `17360`, image
base `0x00E70000`, and no injected loader. A read-only process-memory probe
confirms `0x00820230=100` ticks/second and the copied profile's Enhanced Effects
byte is zero. These observations establish process/configuration provenance;
they are not a substitute for a projectile capture. Website's explicit
Enhanced Effects ON policy remains the contract in entry 130.

### System boundary and membership

Native system: the hostile projectile graph emitted by the current Boneyard
Archer, Mage, Demon, and rotten-Zombie factories, including launch inputs,
fixed-tick flight, contact admission, retirement, and their owned presentation
children. Existing primary spells, movement controllers, collision geometry,
status-modifier consumers, and the world painter are dependencies; their
interfaces are checked where these children cross them.

The following inventory records the completed implementation dispositions.
The verification receipt below covers the mechanical and presentation rows;
the render-owned Arrow visibility cleanup has its separate platform disposition.

| Member | Native owner / source | Disposition | Required proof |
| --- | --- | --- | --- |
| Ordinary Arrow | Archer volley `0x00477B90`; Arrow `0x005E1000/0x005FEA00/0x0060F590` | `exact-ported` | Straight-flight hold, exact countdown edge, descent, planted fade, stationary-target hit |
| Fire Arrow | same owner; payload byte `+0x164=1`, impact `0x005E5D30` | `exact-ported` | Same complete flight; fire-only rotated overlay and independent burst/light handoff |
| Poison Arrow | same owner; payload byte `+0x164=2` | `exact-ported` | Same complete flight; unrotated poison overlay and poison contact |
| Archer direct/lead/scatter/random aim, all four range and multi-arrow modes | `0x00477B90`, existing complete `native-enemy-targeting.ts` tables | `exact-ported` | Reuse aim/range/fan rules and restore exact per-arrow speed constants and countdown; all payloads inherit the corrected flight |
| Arrow Enhanced Effects ON and settled fade | `0x005E1000`, `0x00B3BCAD` | `exact-ported` | Initial opacity 15; stable shaft opacity above one; fade and wire admission through the last positive sample |
| Arrow Enhanced Effects OFF | same constructor, opacity 5 | `out-of-system` | No mutable OFF producer in Website; native difference is documented, not silently selected |
| Arrow velocity streak and grounded contact gate | `0x0060F590`, `0x005FEA00` | `exact-ported` | Streak at height at most -20; grounded arrows cannot damage passing players |
| Arrow Chill/SpinAway handoff | `0x005E5EC0` | `exact-ported` | Strict accumulated force greater than one; child survives parent; native rotation/scaling/fade |
| Mage Firebolt | `0x0047FDE0`, `0x005E1D00/0x00600880/0x00612760` | `exact-ported` | Forward origin 20, speed 4, 400-tick lifetime; native contact and terrain cadence |
| Mage cold GuidedMissile | `0x0047FDE0`, `0x005E7E00/0x00600B40/0x005F42C0/0x005F3EE0` | `exact-ported` | Forward origin 5, speed decay/floor, constructor turn rate, movement-before-turn, 1300-tick lifetime, cold contact |
| Mage poison GuidedMissile | same owner, payload `+0x180=1` | `exact-ported` | Same complete flight; poison payload and color/impact branch |
| Mage direct lightning | `0x0047FDE0` case 1 and `boneyard-mage-lightning.ts` | `out-of-system` | A retained actor-owned beam/pulse, not an emitted flying projectile; existing per-tick target/LOS owner remains authoritative |
| DemonBomb launch, airborne, bounce, stop, and terminal branches | `0x0049A270`, `0x005E2F00/0x00603CA0/0x0061A690` | `exact-ported` | Exact launch origin/speed, float constants, strict contact/settled edges, immediate contact detonation, independent fire children |
| Rotten-Zombie PoisonPool | `0x005E3B00/0x005F8030/0x005EDFA0` | `exact-ported` | Stationary origin, growth, live/fade contact and retirement; never passed through moving-projectile homing or swept-hit admission |
| Firebolt trails / fire impacts / GuidedMissile impact / Demon fire / poison-pool presentation | owning callbacks and existing authored BadGuys/DeadHawg manifests | `exact-ported` | Native birth order, independent clocks, all authored records, painter/light ownership, parent retirement and reset |
| All generated Arenas, custom recipes, multiplayer, pause, late join, and save/restore | one authority-owned projectile store and strict entity codec | `exact-ported` | Same state and reducer in every scene; restored and remote clients do not restart flight |
| Silk | ctor `0x005F05D0` calls Arrow ctor, but own tick `0x005F8B50` | `out-of-system` | Spider/Cocoon emission graph is absent from this baseline; own update must not inherit the Archer descent gate by name alone |
| DarkFireball | ctor `0x005E3A10`, tick wrapper `0x00605C80` calls Firebolt tick | `out-of-system` | DireFaculty/story emission graph absent from baseline; fire contact replaces payload with DireFire |
| SkullMissile | ctor `0x005EB980`, tick wrapper `0x00605920` calls GuidedMissile tick | `out-of-system` | DemonSkull/story emission graph absent from baseline; inherited flight is a documented sibling, not an exposed stock recipe |
| Imp, GoodImp, Wraith, Maggot and Portal-owned Imp | separate living-actor/family movement virtuals | `out-of-system` | Their body flight/emergence is not a projectile descent program; do not apply Arrow constants to them |

Constructor xrefs are completely enumerated: Arrow has factory call
`0x005B7838` and Silk constructor call `0x005F05F9`; Firebolt has factory
`0x005B7CFA` and DarkFireball constructor `0x005E3A13`; GuidedMissile has factory
`0x005B7D34` and SkullMissile constructor `0x005EB983`; DemonBomb has only
factory `0x005B7FEC`; PoisonPool has only factory `0x005B7AB6`.
Tick xrefs: Arrow vtable cell `0x0079C7EC`; Firebolt vtable `0x0079CADC` and
DarkFireball call `0x00605C84`; GuidedMissile vtable `0x0079DA94` and
SkullMissile call `0x00605951`; DemonBomb vtable `0x0079CE5C`; PoisonPool vtable
`0x0079D1C4`. There is no shared Arrow tick inherited by Silk.

### Instruction-derived contract

- `0x005FED25..0x005FED46` subtracts Puppet `+0x120` from Arrow `+0x168`.
  A **positive** result jumps to `0x005FEEA2`, copying travel heading to draw
  heading without touching height or velocity. At zero or below, height less
  than -3 gains 0.75 and both stored velocity components damp by
  `0.9900000095367432`; only this descent branch computes the .25 pitch term.
  At height at least -3, velocity and height become zero and float opacity
  loses `0.05000000074505806`. Position movement precedes these transitions.
- Arrow contacts are admitted only while height is nonzero, at squared player
  center distance strictly below 400. Its terrain check occurs every fifth
  age tick, from the moved position through five more velocity steps. A
  landed Arrow is presentation state, not a stationary damage trigger.
- Arrow constructor opacity is 5 with Enhanced Effects off and 15 with it on.
  Shaft alpha is `min(opacity,1)`. The poison overlay is an unrotated sprite;
  the fire overlay alone adds 180 degrees. A velocity-aligned gray gradient
  streak precedes the shaft while height is at most -20, using age capped at
  35 and the native five-step near endpoint.
- Mage Firebolt dispatch multiplies its heading vector by 4 and then advances
  its birth position by five of those vectors: 20 units forward. Lifetime is
  400, contact is player-center distance strictly below 30, and terrain is
  checked every tenth age tick with ten movement steps of lookahead before
  current movement. Live art stays at -15 Y; those offsets are not flight
  gravity.
- GuidedMissile's MagicMissile base constructor draws its phase first. Its
  own constructor draws turn rate `0.5 + Float(0.75)`, speed floor
  `0.75 + Float(0.44999998807907104)`, then scale
  `0.8999999761581421 + Float(0.20000004768371582)`. Initial speed is 3.
  Mage dispatch advances origin by five units and multiplies the constructor
  `100*20` lifetime by float `0.6499999761581421`, yielding 1300 ticks.
  Each tick moves with the prior heading, advances phase by six times speed,
  then turns by its constructor rate times native signed turn direction.
  Target invalidation clears the retained identity; it does not select the
  nearest replacement. Speed loses `0.07500000298023224` down to its floor.
  Retained-target proximity uses a strict ten-unit center test, followed by
  the native radius-two actor query. Terrain lookahead is every fifth age tick.
- DemonBomb keeps its own ballistic program: speed `[2,3]`, damping
  `0.9950000047683716`, height -35, gravity `0.10000000149011612`, bounce
  multiplier `0.8500000238418579`, and settled damping `0.9800000190734863`.
  World contact at the current point and player center distance strictly below
  35 clear both speed and the terminal countdown. A naturally slowed bomb
  instead consumes its constructor's inclusive 100..200 countdown while speed
  is below one and clears its retained bounce velocity. Contact must not
  leave an invented 1..2 second fuse. Terminal explosion and two Fire actors
  remain separate outputs with their own lifetimes.
- PoisonPool grows by float 0.025 to float 1.6, retains a 3000-tick clock, then
  loses float 0.005 opacity per tick. Its contact loop continues while the
  actor remains alive, including fading states; it admits every overlapping
  player each tick in the exact ellipse `dx*dx + (dy/0.8)^2 < 4900`.
  A permanent hit-ID exclusion list and a frozen pair of fading sprites do
  not represent the native owner.

### Implementation and validation contract

Projectile construction, mutable flight state, contact, and terminal handoff
remain one authoritative subsystem. Class-specific programs reuse the existing
world geometry adapter. The store entry point coordinates transactions, while
cohesive enemy modules own construction, family actions/movement, projectile
emission/flight/effects, and death programs. Each responsibility moved with its
private helpers; callers import its owner directly.

Use established public store/projection/codec interfaces for regressions. The
Mac must first fail the stationary-target Arrow replay, then prove every
payload, countdown and contact edge, guided target loss and turn order,
Demon contact/fuse/bounce, child lifetime, and pool contact/fade. Require
byte-identical changed-file manifests, focused tests, configured quality
measurements, the full `/opt/homebrew/bin/bash ./scripts/validate.sh`, and a
built Chrome `/game` journey with page/console/failed-response arrays. Record
actual receipts here after the implementation; none is implied by this plan.

#### Further contact and birth checks before the contact cutover

The Arrow terrain call hardcodes exclusion mask `0x380` at `0x005FEC6E`;
Firebolt and GuidedMissile use `+0x38=0x700`. The Website already has the native
line-mask adapter in `firstBoneyardLineObstruction`; hostile projectiles were
incorrectly routed through inflated walking-body sweeps. Reuse the line
adapter at the recovered class cadence. DemonBomb instead requests its native
radius-one point overlap. The simulation-facing terrain query therefore needs
a boolean obstruction result, not an invented fraction used to move the
projectile to the future lookahead contact.

Archer volley additionally writes fire physical damage as
`primary + secondary*0.5` and magic damage as `secondary*0.5`. Ordinary and poison
physical lanes stay primary. The exact stored speed constants are double
`5.699999809265137` at `0x007866D8` and float `0.5999999046325684` at
`0x007866E0`. These constructor/payload details are also `exact-ported` targets
of this reopening; the earlier verified birth row does not waive them.

#### Bounds and view owner

Fresh downstream queries identify Firebolt culling as `Region::Visible`
`0x0064AA80`: its 100-by-100 footprint is tested against each local player's
clamped view. View normalization divides by `max(1, height/800)`; the double
800 is at `0x00785D10`. Arrow uses half-open Region bounds through
`0x00403DA0`, and GuidedMissile uses those bounds expanded by 500. These are
separate from terrain admission. The shared Website terrain callback is
replaced by one typed world-query interface with `line`, `point`, `bounds`,
and `view` requests. The existing line-mask, circle-overlap, and clamped-view
implementations supply the geometry; there is no walking-body sweep or
renderer-driven projectile clock.

#### Native child details

`Anim_PoisonBubble` uses vtable `0x00785204`, constructor `0x00454F10`, tick
`0x00454FD0`, and render `0x00459F90`. Radius starts at zero, grows by
`0.05 + Float(0.05)` to `0.5 + Float(0.75)`, then the inclusive 25..100 hold
counter decrements starting with the first full-radius tick. The pool emits
one when alpha is greater than .75 and `Integer(20)==3`, at radial distance
`Float(50)` with Y compressed by float .8. This is a native particle actor,
not the removed pair of invented pool-fade actors. Pool contact has no
projectile-impact VFX/audio event.

The finite pool opacity recurrence remains authority-age derived in a shared
kernel. It begins fading on update 3000 and retires on update 3200, because
201 float32 decrements are needed. The descriptor's lifetime now covers the
whole native actor; no separate fade clock is reconstructed in the browser.

The Bubble renderer's explicit asset address `BadGuys+0x2BDC` is record 57,
with alpha .75 and zero rotation. That record must be resident before birth.

The Fire child audit also falsifies the shared Fire constructor's web width
sample: `Fire::Fire 0x005E7130` calls signed `1` at `0x004012C0` for `+0x14C`.
It is a horizontal mirror sign, not a uniform float in [0,1]. Correct the one
shared Fire constructor and its Fire/Fire_Goodguy/MovingFire consumers;
GreenFire/DireFire are unreachable story subclasses in this baseline. The
native field becomes `horizontalSign` with the exact domain -1/+1.
Demon fires use this existing Fire owner with life 5, their authored scales,
three-tick strict radius-32-times-scale contact, and equal physical/magic
lanes of `damage/100*3*.5`. The previous enemy children were visual-only.

Arrow's `Anim_SpinAway` recipe at `0x005E5EC0` starts alpha 4, angular speed
`signed(10+Float(10))`, and velocity retention float .98; its fade is float .1.
The former web values alpha 6 and angular speed 1..2 belong to the separate
Silk deflection caller `0x005EBE20`. Keep the shared animation mechanism, but
use the correct per-caller recipe.

Additional instruction-derived findings (same retail image and replica provider):
`Fire::render 0x00610F90 -> scale 0x004030A0 -> matrix multiply 0x00402D40`
scales the initial `(0,-20)` translation, then adds `(rootX,rootY+10)`.
The final flame origin is therefore `(rootX,rootY+10-20*commonScale)`, where
`commonScale=f32(f32(1.100000023841858*scale)*fadeAlpha)`; horizontal scale
also consumes the constructor's signed unit. This corrects the shared Fire
presentation, including its already-supported goodguy and moving descendants.
Fire's actual light-provider callback is vslot `+0x30`, `0x005E7610`; its
colored ground submission is vslot `+0x28`, `0x005E7310`. They must not be
mistaken for the ordinary flame draw or omitted when the parent bomb retires.

`AnimPoisonBubble` (`0x00454F10/0x00454FD0/0x00459F90`) consumes BadGuys
record 57. Constructor draws are growth `0.05+Float(0.05)`, maximum scale
`0.5+Float(0.75)`, and hold `25+Integer(76)`; growth clamps, then the hold
clock decrements on the first clamped tick. Pool emission requires alpha
strictly above 0.75 and `Integer(20)==3`, then constructor draws precede
position radius `Float(50)` and angle `Float(360)`. Y displacement is scaled
by 0.8. The bubble is independent, ordinary blended, alpha 0.75, and unrotated.

Arrow launch speed uses the recovered double `5.699999809265137` plus a float
draw with magnitude `0.5999999046325684`. Fire-arrow physical damage is base
physical plus half its secondary fire damage; the other half is magic damage.
The Arrow Chill transfer uses opacity 4 and signed angular speed
`10+Float(10)`; the superficially similar Silk transfer has a different recipe.

Wire protocol 123 carries Fire fade and horizontal sign explicitly. Save schema
32 retains GuidedMissile's constructor turn rate. Prior-schema guided missiles
receive the native constructor draw from the restored enemy RNG and the native
1300-tick lifetime; other old projectiles receive zero turn rate. Older positive
Fire width samples become the corresponding positive horizontal orientation.
Legacy visual-only Demon fires and invented detached pool fades are retired on
migration because those records lack the native damage/constructor state; the
profile, encounter, enemies, and active projectile population remain resumable.

The DemonBomb's `Region::Explosion 0x006464E0` call uses size 1.5 and enables
knockback. Its three visual objects reuse the existing recovered Fire explosion
compositor: BadGuys 15 (10 ticks), 401..419 (35 ticks), and 420..433 (37 ticks).
The lit array carries the separate native light at the impact origin, radius
`2*RegionPointGain`, and the Multiple Shadows setting. The ordinary Fire actor
light at `0x005E7610` has radius float .6 and intensity `min(1,life*3)`;
its `0x005E7310` colored ground sprite is BadGuys 15, alpha `min(life,1)*.5`,
scale `2*scale`, and color `(1,Float(1),0)`. The bomb's audio is FireballHit at
pitch `1+Float(.1)`, then ThrowFire at float .8, both gain `2*RegionPointGain`.
These reuse existing assets and sound delivery. Explosion contact appends the
native ten-tick target knockback, normalized displacement times `size*3` per
tick. The action survives removal of the bomb. Its camera feedback is a
world-owned `4*RegionPointGain` impulse through `0x00448590`, separate from the
actor death feedback already supported by Website.

The shared painter audit (entry 297) resolves the Explosion manager fields:
core `Anim_Fade` goes directly to post-world `Region+0x22C`; the ordinary
SpriteArray goes directly to pre-world `+0x278`; only the rising SpriteArray's
`ZAnimLit` goes to transient manager `+0x8B70`. Its light registration is
therefore transient, not actor. The existing player-Fire Explosion renderer
collapsed these three native intervals into one sorted container. This shared
assumption is corrected for both enemy and player consumers; no extra
sorted-queue submission is synthesized for either direct-manager component.

Raw instruction closure of the impact callbacks supersedes the provisional
unsigned Fire-arrow claim: `0x005E5E22` pushes signed flag 1, so its burst scale
is `0.5+S(.1)`; Firebolt uses `0.75+S(.1)`. Both play registry `+0x540`
(FireballHit) at pitch 2 with Region gain. Guided impact `0x005F3EE0` plays
registry `+0xA10` (MagicMissileHit) at `1+Float(.1)` before its phase draw;
a player hit additionally plays the same cue at float .85, unattenuated.
Registry membership is recorded by the stock audio registry builder
`0x004EE010`; the existing Website audio assets match those records.

`Anim_FireBurst` (`0x00453470/0x004575B0/0x0045E2D0`) is one object with two
draws, wrapped once by ZAnimLit (bias 50, radius 1.5, intensity decreases .04).
`Anim_FadeGM` (`0x00454000/0x0045DC90`) is one four-draw object: two identical
main submissions share one random alpha, followed by independently sampled
111/112 aura scales. Its single ZAnimLit has bias 100, radius .75, intensity
1 decreasing .05 per tick. The prior web representation invented independent
actor registrations for those layers and omitted the guided light. Each
native impact now owns one authoritative object, one wrapper registration,
and its complete draw list. On a same-tick guided actor plus wall hit, native
code runs the actor callback before the terrain callback; removal does not
short-circuit the second callback, so two independent impact objects can be
created while the projectile retires once.

Projectile constructors, impacts, trails, pool bubbles, and Demon fire now consume
the existing authoritative 55-word native enemy RNG (`steeringRngState`, also
used by Archer's shared draw lane). The former wave xorshift/unit-float helpers
were inappropriate for native `Float` and `Integer`: the binary uses a 100001
sample inclusive float domain, power-of-two integer reduction, and different
sign polarity for signed Float versus signed magnitude. Those already recovered
kernel operations are reused directly, preserving constructor draw order and
arity. Only render-only flicker retains the established deterministic semantic
word substitution; authoritative flight and child births consume the native RNG.

The contact membership sweep distinguishes Game's player list from Region's
actor grid. Arrow, Firebolt, DemonBomb proximity, and PoisonPool walk
`Game+0x1390/+0x139C`; summoned Golems are not player-list members. Guided
fallback `0x00641220` and Fire/Explosion region searches admit friendly summons
through their actual actor flags. Guided fallback visits the native cell
binding order, which changes when a target leaves and re-enters a cell. The
authority must retain those target bindings rather than reuse object-key order.
Pool bubbles register directly with pre-world manager `Region+0x278`, as shown
by `0x005F8030`, and therefore do not enter the sorted actor queue.

The reused Fire contact DTO carries total damage. Native `0x005FF1D0` assigns
`damage/100*3*.5` to both physical and magic lanes; the previous DTO contained
only one half while its player-spell caller treated it as the complete hit.
It now carries `damage*3/100`, and the hostile receiver divides that total into
the two native lanes. A public kernel-to-combat regression detects the former
half-damage result. Native per-contact response randomness is consumed after
the two lane values, before the next recipient or fire actor is stepped.

The final Arrow state audit confirms two independent float velocity components
at `+0x140/+0x144`. Descent multiplies each by float .99; recomputing a vector
from a repeatedly damped scalar speed loses that recurrence on oblique shots.
Arrow authority retains the vector, while the existing protocol projects its
travel heading and speed for interpolation. The launch vector at `+0x148/+0x14C`
remains unchanged and supplies the pitch calculation. No new wire layout is
needed for that server-only correction; the regression compares oblique travel
against the recovered per-component float recurrence.

Final caller/neighbor-slot closure:

- Archer release `0x00478139` and Mage Firebolt release `0x0047FFBF` register
  in the transient manager. Their painter and optional light belong to the
  same registration; normal/poison Arrows still own a transient painter.
  GuidedMissile and DemonBomb register as actors, each sharing its painter
  ticket with its light. The previous extra painter allocation was invented.
- Mage fire release plays ThrowFire (`registry+0x10C4`) at float 1.25. Cold and
  poison release play ThrowSpell (`+0x10F0`) at `1+S(.25)` before the missile
  constructor. Demon release plays SpitFire (`+0xE88`) at `1+S(.1)` before the
  raw FireBurst constructor. All use Region point gain. Exact WAVs are added
  through the existing extraction/asset-registration convention.
- DemonBomb's root is the current endpoint midpoint plus 35 units along
  `20*roundEven((heading+10)/20) mod 360`; its velocity uses the original
  heading. Raw instructions `0x0049A53F..0x0049A58A`, double 35 at
  `0x00785BB8`, prove the launch offset. The separate muzzle FireBurst adds
  controller point 5 and a 25-unit vector at the same quantized bearing.
- Arrow `+0x28 -> 0x005E6050` draws its black ground shadow at the planar
  root, launch heading, scale 1, alpha `min(opacity,1)`: BadGuys 2 while
  airborne and BadGuys 3 when landed. DemonBomb `+0x28 -> 0x005E9970` draws
  BadGuys 15 at the root, additive orange `(1,.5,0)`, alpha .25, scale `(1,.8)`.
  Its diffuse-only color selector is equivalent for this extracted record:
  every nontransparent texel has RGB `(255,255,255)`. Firebolt and Guided
  have no `+0x28` draw. PoisonPool's whole draw belongs to this pre-world
  slot, and its bubbles belong to direct pre-world `+0x278`.

The Fire light producer is shared by enemy Fire, primary Fire/Fire_Goodguy, and
secondary MovingFire. The same native `min(1,life*3)`/radius-float-.6 source is
used for all three. The primary Fire path previously omitted enrollment
entirely despite retaining its authoritative painter ticket; that omission is
fixed with the existing actor registration.

One native lifecycle branch has a platform disposition separate from flight:

| Member | Native evidence | Disposition | Predicted difference |
| --- | --- | --- | --- |
| Arrow's render-owned zero-visibility cleanup | `0x005E10D0 -> 0x00624B40`, base visibility `+0xCC`, count `+0x150`, seen flag `+0x154`; retire after 26 zero-visibility Present visits after being seen | `blocked-by-platform` | Separate browser clients and the headless authority do not share one native Present cadence or visibility field. Flight/contact and landed fading remain authoritative; an unseen Arrow may remain in the world until its physical/fade lifetime completes, so returning to an area can reveal a ground arrow that stock's local render loop already discarded. |

This is not a substitute for a missing extracted value: the condition and
counter are recovered. Making one client's render rate control shared damage
and object removal would violate the multiplayer authority contract. The
mechanical countdown, velocity, height, collision, and opacity branches are
ported; this observer-dependent optimization is explicitly separate.

The Explosion's explicit knockback exception is native type `0x7F4`, Golem
(constructor `0x005F57E0`). The currently admitted summon targets are Golems;
they receive explosion damage but no ten-tick knockback. Pending player
knockback state is persisted with validated identity, finite displacement,
clock, and remaining ticks 1..10, so malformed saves cannot become unchecked
runtime actions.

The existing hostile-scene pause contract holds actor state while the outer
clock advances. Projectile and child `lastStepTick` values must acknowledge
those paused ticks while preserving age, position, and remaining lifetime;
otherwise resume incorrectly replays the entire pause as projectile movement
and can discard live impact effects. The pause regression checks the existing
public enemy-store interface through hold and resume. Birth identities and
replicated spawn ticks remain unchanged.

#### 2026-09-06 verification receipt

The validated runtime implementation is `eff21b7cbf1e6e7ccfc864a745a43a205532a3d3`,
based on main `d31c155b6118bc797454d51fbaf3c3410ad4181c`. Local and detached
Mac source files were byte-identical. Publication adds this receipt without
changing the validated runtime, tests, or browser harness. Stock conclusions
remain instruction-derived from the retail 0.72.5 image identified above;
this pass did not obtain a paired clean-stock video or pixel comparison.

All validation ran on the Mac mini with Node 22.17.0, arm64 Chrome, and the
pinned repository toolchain:

- `/opt/homebrew/bin/bash ./scripts/validate.sh` completed successfully:
  23 Python checks, 2,977 reported Node test executions, backend/frontend
  builds, formatting/lint, protocol/save contracts, bundle/media policy,
  and configured renderer quality checks. The gate began on `c246d026a`.
  Main's subsequent `d31c155b` change touched only Lua rollback code, its
  tests, and documentation. The unchanged renderer run continued; the
  changed Lua dependency path was revalidated separately instead of
  restarting the renderer measurement.
- On the final merged runtime, all 20 tests in
  `prepared-mod-player-control.test.ts`, `prepared-mod-host.test.ts`, and
  `prepared-mod-session.test.ts` passed. The complete test TypeScript check,
  frontend lint, fresh production frontend/game-host build, bundle budget,
  and production media check also passed. No configured threshold was changed.
- Renderer quality finished at `2026-09-06T03:22:24.622Z` with no failures.
  Its eight configured files had 100% statement, branch, function, and line
  coverage; maximum cyclomatic complexity 20, cognitive complexity 10, and
  CRAP 20; no prohibited types, dead code, or duplicate blocks. Mutation
  results were 385 killed, one timeout, 129 compile errors, and 29 existing
  documented equivalents ignored; there were no survivors or uncovered mutants.

Chrome acceptance used isolated local ports and browser profiles:

| Scenario | Observable result |
| --- | --- |
| `smoke-enemy-animation-projectile-vfx.mjs` | WebGL2 rendered all eight projectile variants and nine effect cases, including all three Arrow payloads, both GuidedMissile payloads, Firebolt, DemonBomb, PoisonPool, impacts, bubbles, and independent Demon fire/explosion layers. Page errors, console errors, and failed responses were empty. |
| Built `smoke-boneyard-waves.mjs --archer-projectile-only` | Real Title/Create/Hub/Arena entry, combat, and natural wave-2 Archer 58 produced Arrow 1 with countdown 62. Moving samples at ages 3, 8, 13, 18, 23, and 28 all retained height -25. The Arrow retired at tick 17006. Death, native damage audio, Game Over, retained-loadout confirmation, and the next arena passed. The new run had 50 health, 100 mana, and zero enemies, projectiles, or projectile effects. Page/console/network errors were empty. |
| Built `smoke-boneyard-waves.mjs --arrow-tumble-only` | Actual Water casting accumulated Chill force to 0.9920001029968262 before the strict threshold transferred Arrow 1 into SpinAway 1 at tick 7999. The client received alpha 3.900390625 after one update, rendered BadGuys 2, and both host and client had retired the child by tick 8041. Error arrays were empty. |

The component and Chill checks ran on `c246d026a`; the Lua-only merge changed
none of their tested paths. The final Archer journey ran on the fresh
`eff21b7c` production build.

The Archer profile gives its test player extra health during shot observation,
then stages one-health contact with an existing enemy and holds the wave
schedule for the death transition. The Archer's factory, AI release, flight,
collision, rendering, and retirement execute normally. The Chill profile
stages a stationary Arrow along the actual cast direction and exercises the
normal contact/replication/presentation path. These controls belong only to
the browser harness.

The broader smoke's entrance-return navigation and Water fan/Cone/Aura checks
are outside this hostile-projectile acceptance profile. Their earlier route
and fan assertions did not pass in this run and are not claimed as evidence
here. The shared harness now also follows the current Game Over button,
retained-loadout element selection, and second-arena resume readiness.

The only platform-dispositioned member in this reopening remains Arrow's
render-owned visibility retirement: returning to an area can reveal a ground
Arrow that stock's local Present loop already discarded. Mechanical flight,
contact, and fading do not depend on client visibility or render rate.
Raw logs, captures, patches, and task worktrees are disposable after the
authorized main push is verified; this ledger retains their measured results.

## 2026-09-05 — Spider survival encounters and target-owned web restraint reopening

### Report and failure of the earlier boundary

The reported symptom is that no spiders appear. The earlier census used the
Website's missing factory entry as evidence that Spider was outside survival.
It did not follow `WaveData_Parse` beyond the ordinary `wave.txt` schedule.
The subsequent exclusions in entries 86, 98, 158, 159, 179, and 273 inherited
that unproved assumption. Retail constructs Spider encounters in a separate
trigger/script tail of the same survival generator. “Story-only” is false.

The native system is implemented. The per-member Mac and built-browser
receipts below cover the recovered behavior; the final canonical publication
gate is tracked separately.

### System boundary

The unit of work is the **native survival Spider encounter and restraint
system**: every generated Spider phase; Spider construction, movement,
light-dependent decisions, attacks, and death; Silk flight, rendering and
collision; Webbed stacking and expiration; target-owned Cocoon collision,
damage, rendering, release, and teardown; and the descendants and scene data
those owners consume. The ordinary wave scheduler, existing enemy families,
and other independently generated boss encounters remain neighboring systems.

The membership sweep includes all twelve generated layouts used by the
Website, all four native Spider script variants, all their repeat groups and
ordered setup flags, all six Spider action states, both spit-setting branches,
all three web severities, ordinary/fully webbed/dead/missing targets, the live
Silk limit and shared spit cooldown, both death eligibility branches, all
Spider/DeadSpider art banks, Silk and Cocoon fragments, and the temporary
DeadSpider compact and mask grids. The per-member dispositions and verification
receipts follow below.

### Evidence and provenance

| Evidence class | Source | Finding | Confidence |
| --- | --- | --- | --- |
| Retail image, rehashed 2026-09-05 | `SolomonDarkAbandonware/SolomonDark.exe`, 0.72.5, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Same exact retail image as the earlier census. | high |
| Native generator instructions | `WaveData_Parse 0x00632730`; Tiny construction `0x006357A3..0x00635A7C`; Small/Large/Huge strings `0x0079ECA0`, `0x0079EC14`, `0x0079EBC8` | Spider scripts are generated outside `wave.txt`; optional membership and trigger waves are selected during generation. | high |
| Native generated corpus | Read-only `Mod Loader/runtime/instances/*/stage/sandbox/play.boneyard` files selected by the twelve source hashes in `native-generated-boneyards.ts` | 23 Spider phases: three Tiny, twelve Small, four Large, four Huge. Trigger and script bytes, ordered operands, and flags were drained in full. These historical files are supporting data; generator instructions independently establish their meaning. | high |
| Current stock-generated file | `C:/SolomonDarkAbandonware/sandbox/play.boneyard`, 248,393 bytes, SHA-256 `f668ca2a9aa9e4e04295897a5d44d359b21febf11870f568daa7865756b151cb` | Contains all four Spider triggers at waves 4, 11, 34, and 44. No gameplay observation is inferred from the file alone. | high |
| Web reproduction on Mac mini | Website `01f07fde`, `createBoneyardWaveDirector` and `stepBoneyardWaveDirector`, source `8c2f97d2ed54431987e3cb54b7ae3c1098bf1c4517f59ade6aea57759187adb0`, native trigger wave 4, 250 ticks | The real director emits only type 1001 and zero type-2057 actors. The assertion requiring the source's three Tiny-wave spiders fails `0 !== 3`. | high |
| Native family factory | Common allocator `0x005B7080`; Spider constructor `0x004759A0`, type `0x809`, vtable `0x0078643C` | Spider is a concrete hostile family with its own action, damage and render slots. | high |
| Child ownership | Silk `0x005F05D0/0x005F8B50`; Webbed `0x00623B10/0x00627BD0`; player helper `0x0052C680`; Cocoon `0x0047BAE0/0x0048BCE0` | Silk applies a modifier. Reaching full severity creates one target-owned Cocoon; further hits cannot create duplicates. | high |
| Cocoon presentation owner | Cocoon render slot is no-op `0x0055C300`; player state `+0x208/+0x20C/+0x214`; release `0x00533350` | The player owns the visible restraint. The separate Cocoon supplies damage/collision and is excluded from the normal monster count. | high |

Ghidra used the canonical `SolomonDark` project through the existing replica
wrapper with explicit original Windows project and replica roots. The
read-only Mod Loader tool revision was
`08bfba9ef367f7b863848030d0a289dc31e33192`; wrapper SHA-256 was
`b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`.
No Mod Loader file was changed. The whole-generator decompile timed out;
the completed instruction dump and serialized programs are the evidence for
its branches. Task-owned scratch extracts are disposable after their durable
results have been recorded.

### Recovered encounter contract

- Each included phase has an initially enabled, one-trip, type-2 start-wave
  trigger. An omitted native phase stays omitted for that source.
- The script holds the main TimeLine with command `0x42D`, selects offscreen
  spawn placement (mode 2) with `0x3ED`, and spawns type 2057 via `0x43A`. These are real
  synchronous repeat groups, not `wave.txt` members or timed Portal births.
- Small waves contain groups of four and six. The four extracted Large waves
  contain groups `(6,7,4)`, `(6,7,3)`, `(6,10,3)`, and `(6,8,3)`. Tiny, Large,
  and Huge counts retain each generated source's operands.
- Setup flags retain order and repetition: flag 1 multiplies health by 1.5;
  3 multiplies all three damage fields by 1.5; 5 increases speed; 43 multiplies
  Cocoon HP by five; 44 disables spitting. Repeated flag 43 is intentional.
- Between groups the script waits while normal monster count is greater than
  zero, using a two-second fixed-tick sleep. The final group first sleeps one
  second, then uses the same wait, advances the wave, and releases the hold.
- Spider's `+0xCC` input is the native lighting/render scalar, not player
  distance or a replacement arbitrary attack timer. `+0x230` is a per-Spider
  spit cooldown; Arena `+0x9058` is shared. Global `0x00819848` counts live Silk,
  with a strict limit of four for the gated spit paths.
- `0x004A1670` uses the complete BadGuys leg bank 1840–1911, independent body
  bank 1912–1929, and proximity outline bank 1930–2001. Pose and both headings
  must be authoritative; renderer cadence must not advance them.
- Cocoon is a target identity/lifetime relation. Damage goes to the target's
  Cocoon HP, and release removes Webbed and the matching restraint actors.
  Player death also tears down the restraint. Its collider must not be counted
  as another hostile wave member or rendered as an independent enemy body.

### Validation contract

Retain the failing native-source director reproduction as a regression. Cover
all 23 source phases and every omitted phase, ordered flag multiplicity,
timeline holds, group counts, count polling, pause/save/resume/reset, every
Spider action branch, Silk cap and lifecycle, all web severities and Cocoon
release paths, complete sprite banks, and terminal effects. Run these checks,
the complete Website gate, and built Chrome `/game` acceptance on the Mac
mini. The completed runtime and browser receipts are recorded below.

### Completed instruction/data recovery and implementation

The [Spider native catalog](spider-native-catalog.json) retains the complete
five-class slot census, audio resource rows, and all 23 source-authored
programs, including every command and typed operand. There are no substituted
Spider phases for absent source rows. The implementation dispositions below
describe the implemented members. The final publication gate remains separate
from the focused behavior receipts below.

| Membership | Required disposition | Native contract / proof |
| --- | --- | --- |
| 3 Tiny, 12 Small, 4 Large, 4 Huge source phases | `exact-ported` | All source hashes, trigger/script UIDs, start-wave labels, commands, repeat counts and ordered flags in the catalog |
| Optional generation branches and all 25 absent phase/source pairs | `exact-ported` | Absent phases produce no trigger; no fixed-wave substitute |
| Script command budget, sleeps, repeats, count conditions, labels, hold/release | `exact-ported` | `0x0068B060` executes at most ten commands per tick; false conditions skip through ENDIF in `0x00681D40`; zero-return commands continue within that budget |
| Spider ordinary/custom construction and flags | `exact-ported` | HP 15, primary damage 8, Cocoon HP 10, suck DPS 2, spit enabled; ordered setup transforms in `0x0046B390` |
| All six Spider action states | `exact-ported` | `0x0047A580`: approach, close movement, lateral movement, spit hold, retreat, attachment; exact thresholds and RNG order |
| Shared navigation, target loss and native movement cadence | `exact-ported` through the shared route owner and Spider class branches | `0x004835F0`, Spider `+0x6C`, inherited `+0x70/+0x74`; UID phases at 2/5/10/15 ticks and distinct full/degraded movement |
| Local and shared spit cooldowns, live-Silk cap, no-spit setting | `exact-ported` | `0x00475DB0`, `0x00475AC0`, `0x0047A580`; `0x00819848` is a live-Silk count, not a Cocoon or Spider count |
| Target light scalar, directional/radial branches and missing target | `exact-ported` through the shared native light model | `0x00624B40 -> 0x0057F980/0x0057F0E0/0x0057E490`; the browser must not feed simulation from frame cadence |
| Spider legs, independent body, proximity outline, height | `exact-ported` | Complete BadGuys 1840–2001; 18 directions, four leg/outline poses; target-color outline at light > .5 and distance < 175 |
| Silk construction, both complete spline point arrays, active/end states | `exact-ported` | `0x005F05D0/0x005F0790/0x005F8B50`; shared QuickSpline `0x0062B2F0`; skip every fourth active tick; flight and fade are separate states |
| Silk full draw, inherited draw slot, tether, impact and audio | `exact-ported` | `0x00606A10/0x0060F590/0x005F92C0`; complete BadGuys/DeadHawg resources in the native catalog |
| Partial web severities, movement recovery, stationary persistence | `exact-ported` | `0x00623BA0`: partial severity decreases by .001 only when native movement-vector length squared is > .5; it does not clear merely because five seconds pass |
| Full web threshold, maximum Cocoon HP, duplicate identity suppression | `exact-ported` | `0x00627BD0`, `0x0052C680`: merge to integer severity capped at three, keep maximum payload, create one target-owned restraint |
| Cocoon collision, position, damage, release and target teardown | `exact-ported` | Radius 40; collider updated 60 units ahead of target heading; damage subtracts from target-owned web HP; `0x00533350/0x00533520/0x0048BCE0/0x00534120` |
| Partial/full player web presentation and hit flash | `exact-ported` | `0x005468C0`: additive player silhouettes at scales 1, 1.05, 1.10; fractional final alpha; full restraint uses DeadHawg 29 with quantized 30-degree heading offset and target hit pulse |
| Normal Spider death, corpse, temporary decal target records | `exact-ported` | `0x00482D60/0x00455730/0x00461740/0x00461B60`; DeadHawg 208–227 and decoration rows 26–28; compact grid +0x8AF4 and mask grid +0x8F84 insertions and removals |
| Ether Drain capture death branch | `exact-ported` | `0x0047BF70`: damage flag 0x100 and a registered Ether Drain field strictly within 40 units suppress SpiderDie and DeadSpider; Spider selects no Anim_Sucked art |
| All impact/release fragments and sound selection ranges | `exact-ported` | Silk hit: five BadGuys-27 bouncers; Cocoon release: twelve BadGuys-10/11 moving fades, seven BadGuys-27 bouncers, DeadHawg-14 flash; native audio rows retained |
| Save/restore, pause, host authority, replication and scene reset | `exact-ported` | Spider sync `0x00475BC0`, Cocoon sync `0x00475D60`, target identity fields and complete script state; no client-owned simulation |
| Other independent generated bosses and normal enemy families | `out-of-system` | Distinct recipe/program and class owners; their absence from the Website is not evidence about native eligibility |
| Unused inherited no-op slots | `verified-already-at-parity` | Catalog records each slot; Cocoon has no independent visible body |

No browser limitation requires a visible approximation in this recovered
system. Recovery corrected two additional historical claims: attached damage
is one quarter of configured suck DPS after a strict counter `>25` (26 movement
calls), not half every 25; and Webbed's nominal five-second allocation duration
is replaced by 9999 each player modifier tick. Full restraint therefore needs
the real damage/release path, and partial web is removed by movement.

Silk reuses the existing natural-spline implementation, which represents the
same cubic evaluator at `0x0062B2F0`, with all native-generated control points.

The enemy store was divided by its existing
responsibilities under `core-server/enemies/`: state model, construction,
incoming damage, movement, family actions, projectiles, emissions, terminal
effects, events, and registration. `boneyard-enemy-store.ts` owns store
creation and ordered stepping. Moved declarations keep their implementation;
consumers import the actual owner, without forwarding exports.
The enemy presentation file likewise separates family presentation
from its shared plan. The native Spider action/spline/status kernels and
presentation each have their own cohesive owner.

Further consumer tracing corrected the old name for command `0x3ED`: it is
spawn placement, not a Solomon speech command. Setter `0x00462680` writes
Arena `+0x8F00`; `0x00466200` dispatches mode 2 to offscreen placement. Every
Spider group therefore uses `offscreen`, not `dark`. The similarly named
Solomon-command description in the earlier Portal entry is historical wording
and does not establish a voice event. Arena `0x0046E570` also proves that the
shared spit cooldown saturates at zero and decrements once per fixed tick.

### Additional instruction-derived contracts (2026-09-05)

- Spider outline `0x004A1881..0x004A1899` uses settings array `0x00819E70`,
  integer slot `12 + player slot`, then `Skills_Wizard` vtable `0x007A0CD4`
  slot `+0x8C -> 0x00661260`. This is the selected primary spell colour,
  including all fifteen Weld choices, rather than the robe or starting element.
  Initializer `0x00782C70..0x00782DBA` drains the complete table at `0x0081CCA8`:
  eight RGBA root colours followed by the white sentinel. Root RGB rows are
  `(1,.1,1)`, `(1,.35,.1)`, `(.1,1,1)`, `(.1,.5,1)`, `(.1,1,.1)`,
  `(1,.5,.1)`, `(.1,.5,.5)`, `(.75,.75,.75)`; every alpha is one.
  Weld `1000..1014` RGB rows, in order: `(1,.1,.5)`, `(1,.5,1)`,
  `(1,.75,1)`, `(1,.75,.5)`, `(1,.75,1)`, `(.75,.75,.75)`,
  `(1,.75,1)`, `(1,.75,.5)`, `(.8,1,1)`, `(.9,1,1)`, `(1,.1,.5)`,
  `(1,.35,.1)`, `(.1,.5,1)`, `(.1,1,1)`, `(.1,1,.1)`.
- Cocoon release `0x0048BE59..0x0048BF3B` plays fixed registry `+0x3E0`
  (`sounds/disintegrate.wav`) at `1 + SignedFloat(.05)`, then one of both
  Webbed splats at FloatRange(.8,.9). It assigns Arena `+0x8E04 = .2`
  directly; it does not apply the generic death feedback accumulator.
  Player release `0x00533350` first moves the matching Cocoon to the player's
  root, so the release particles and audio use that final position.
- The inherited recipe XP documentation required correction across its consumers:
  `0x00463BA3` is **FMUL double ptr [0x00785858]**, whose value is
  `0.8500000238418579`. Reading only four bytes gives the misleading float 2.
  `0x00463B94..0x00463BCD` computes `(final actor max HP + recipe XP bonus)
  times that double, stores to float, then multiplies both HP and XP by
  Arena `+0x8FE4`. MonsterSetup flag 7 assigns bonus 2, and Arena `+0x9024`
  scales the bonus. The prior `2 * baseline` plus `.425` compensation happens
  to match unflagged enemies but loses HP-changing flags and recipe bonuses.
  Ledger 081 and the shared XP producer now apply the correction to ordinary,
  scripted, tutorial, and authored recipes.

- The Webbed draw branch shares PlayerWizard's existing 256-square diffuse
  capture with Harden. It draws `ceil(severity)` additive white silhouettes
  at scales `1`, `1.05`, `1.10`, each alpha `min(1, severity-index)`, then
  redraws the normal wizard. Full severity adds DeadHawg 29 (`117x129`,
  centered origin), before Magic Shield. `0x00547E10..0x00547FA9` quantizes
  heading by truncating `heading/30`, multiplies its unit vector by `-5`,
  then transforms the top two glyph corners: Y delta is halved at `<= -3`,
  otherwise `dy + abs(4*dy)`. The whole glyph is translated `(0,-20)`.
  The second identical glyph is red at player `+0x210` hit-pulse alpha.
  Stoneskin, Harden, and Planewalker precede the Webbed branch. Planewalker's
  separate body-material omission remains the already-recorded nearby finding
  in ledger 084; this change preserves that branch's priority over web layers.
- Membership expansion: Silk's inherited force callback `0x005F92C0` is
  reachable from the powered Frost Jet mask `0x1082`. Silk inherits radius 15
  from Puppet `0x006287D0`; ordinary damage `0x00627F80` applies modifiers but
  never decrements Silk HP. Force accumulates at `+0x178` and retires only
  above one, creating `Anim_FadeLine` (`0x0079DDE8`, size `0x5C`). Its sole
  constructor xref is this callback. Tick `0x004557A0` subtracts its authored
  fade loss and translates both endpoints and midpoint by the stored velocity;
  draw `0x0045AC40` emits two width-two white endpoint gradients. This child
  is part of the Spider closure and its per-member regression checks.

### Spider completion audit: force fragments and retained corpse rendering

Fresh instruction reads on the same sealed retail image distinguish float and
64-bit constants in `Silk::Force 0x005F92C0`. The callback accumulates its force
argument at `+0x178` and retires the Silk only when that sum is strictly greater
than one. Its remaining sixteen spline units are sampled backwards with step
`float(4 / waveScale) * 0.4000000059604645`; each fragment also samples the half
step. Both coordinates subtract the Silk height, exactly as the stock
instructions do. The force vector supplied to the callback determines heading
(`atan2(dx, -dy)`), with a signed five-degree draw per illuminated fragment.
Speed is `(1 - clamp(distance(endpointMean, silkPosition) / 300, 0, 1)) *
(1.9500000476837158 + U(0.09999990463256836))`. Initial opacity is
`(.949999988079071 + U(.550000011920929)) * localLight * .3499999940395355`;
loss per tick is the inherited float `.1` multiplied by
`(.20000000298023224 - U(.05000000074505806))`. Unlit fragments are omitted
before the fragment RNG draws. Blizzard's `0x00542086..0x005420BB` branch passes
force `100` and the channel heading vector to every target with mask `0x1080`.

`Anim_FadeLine` is an additional member of the Spider ownership inventory:
vtable `0x0079DDE8`, constructor at the sole allocation xref in `0x005F92C0`,
tick `0x004557A0`, render `0x0045AC40`, and shared line helper `0x00455840`.
Its Arena `+0x1E0` direct late animation manager owns the child after the Silk retires. Each
tick subtracts opacity loss and translates both endpoints and the separately
sampled middle by the constant velocity. Render uses two white, width-two
line gradients, transparent at the outer endpoints; the first middle alpha is
capped at one and the second uses the stored opacity. Its target disposition is
`exact-ported`; the force/lifecycle tests pass on Mac and the line material
uses the same shared vertex-color owner as the other native gradient meshes.

`Anim_DeadSpider::Render 0x00461B60` draws only while remaining life is at least
`10`, with opacity `clamp(life - 10, 0, 1)`. It draws the selected glyph once
black at `(x, y + 1)`, then white at `(x, y)`, independently of region tint.
The corpse's retained blood record continues through the full twenty-unit
lifetime in its compact and mask grids. These are distinct render consumers and require
separate acceptance assertions. The inclusive facing wrap can reach bank index
20; `Array<Glyph>::Resize 0x0043A6B0` constructs the extra entry with
`Glyph::Glyph 0x004138A0`, whose zeroed resource and geometry members confirm an empty draw.

The renderer module split moves existing light collection, surface lighting,
static construction, live views, and diagnostic state to their owning modules.
No native rendering order changes are inferred from that organization.

`Glyph::Glyph 0x004138A0` zeroes its dimensions, texture-resource words, and
geometry counts, confirming that DeadSpider's resized bank index 20 draws no
glyph. `Silk::Tick 0x005F8B7F..0x005F8B89` calls only the modifier helper and
clears its ordinary Arrow draw flag; it does not append the inherited light
provider. The inherited `0x005E6140` slot therefore supplies no Silk light.
Silk sparkle draws use the existing replicated-presentation rule: the native
integer/float domains are preserved, while an actor/frame seed separates
client render randomness from the authoritative combat stream. A browser
client cannot consume the native process-global renderer/physics RNG stream.

The lateral channel-mask audit found a third force consumer. Steam Jet handler
`0x00542D20`, specifically `0x00543581..0x005435CE`, uses mask `0x1082` when
fully powered and `0x2` when weak, then sends the current push factor times
`0.3199999928474426` to virtual slot `+0x64` for flags `0x1080`. Its ordinary
enemy push is a separate flags-two branch. The web's enemy-only Steam cone
therefore omitted both Arrow and Silk force targets; both memberships are
use the same recovered projectile-force dispatcher.

### Decal record layout and mask census correction

The earlier shorthand identifying both `+0x8F24/+0x8F84` as Spider-owned grids
was incorrect. Raw `0x00461A0A/0x00461A3C` inserts the same record into the
special compact-mask grid `+0x8F84` and ordinary compact grid `+0x8AF4`;
`0x00461AF4/0x00461B22` removes that pair. Terrain polygons own the distinct
`+0x8F24` mask grid. The record layout matches authored compact sprites:
entry `+0`, position `+4/+8`, rotation `+0xC`, scale `+0x10`, alpha `+0x14`.
Spider's scalar accumulator begins at `.35`, rises `.01` per tick to one,
and writes scale `accumulator * .9`; alpha stays one until remaining life
falls below one. Thus the decal grows, then fades during its final second.

`Arena::Initialize 0x00470A90` also enrolls every authored compact row 25..29
into `+0x8F84`. Seven of the twelve retained generated templates contain
these rows: counts 57, 47, 19, 37, 50, 39, and 41 in source order shown by the
catalog. Five mode-zero templates have none. All twelve generated templates
have zero terrain rows. Existing claims in entries 090/106 that these masks
are absent from the web's generated arenas are superseded. The shared compact
mask compositor must consume the authored rows and Spider's retained record.

Puppet's default camera box is exactly `(-100,-100,200,200)`. Static initializer
`0x007825F0..0x00782618` writes `0x0081C724` using float constants
`0x00785D04=-100` and `0x007852D8=200`; `0x00628951` installs its address in
Puppet `+0xC8`, and Spider does not replace it. This is instruction-derived
from the sealed PE, independently inspected with GNU objdump after the Ghidra
xref reported an initializer outside its existing function boundaries.

Schema 33 retains the complete Spider wave cursor and enemy-owned Silk,
Webbed, Cocoon, FadeLine, and DeadSpider state. The existing durable-save
contract requires a migration for older checkpoints. A pre-33 save gains empty
new actor cohorts and the exact source's Spider program; phases whose trigger
wave is already past are consumed so restoring an older run does not replay
historical encounters. Existing cached enemy rewards remain that checkpoint's
values. Death-effect Y scale migrates from its previously uniform scale.

The compact-mask port includes its complete authored selector bank 25..29 and
the dynamic Spider decal. Terrain polygons use a separate owning shape system
and do not occur in any of the twelve native survival templates; their existing
missing mask contribution is recorded as follow-up work outside this Spider
system. This is a scope boundary, not a claimed browser limitation. The compact
mask contribution renders after the world painters, while the dynamic decal's
normal dark glyph renders with the pre-main ground content. Native startup
sets compact selector 25..28 alpha to `.75` and selector 29 to `1` before both
normal and mask consumers.

Spider movement now places navigation before the final native speed cap and
heading recovery. Full `+0x6C` uses the class's base speed; degraded `+0x70`
uses chase speed as well. With no target, the full branch first projects a
10,000-unit wander goal, clips/routes it, and only then adds signed 45-degree
heading jitter and replaces the capped vector with `1.5 * baseSpeed`.
The degraded branch keeps its brain unchanged, pursues the target (or the
actor-UID times 225-degree bounded wander direction), and moves at one quarter
of `baseSpeed * chaseSpeed * statusFactor * cadence`.

The actor clock is phased by UID: 2 ticks with Enhanced Effects, 5 without,
10 while unlit, and 15 outside the default camera box. A server-authoritative
multiplayer scene uses the union of participant view rectangles derived from
accepted viewport inputs and the stock camera scale. Web-only display FOV does
not change authoritative enemy behavior; the dedicated context keeps the
native setting branches testable without taking control of a browser frame.

The painter audit distinguishes DeadSpider's `+0x278` pre-world manager from
FadeLine's `+0x1E0` late direct manager. The fading Silk fragments therefore
render after the sorted world, using the established direct-post-world lane;
the corpse body stays before the Region multiply.

The first Mac WebGL compact-mask readback exposed an integration defect: the
radial pass left all 65,536 target pixels with nonzero alpha, including corners
that the mask pass never touched. The radial Sprite was submitted as the render
root; its requested multiply blend was not applied as a child draw. The existing
Harden compositor submits its multiply Sprite beneath a Container. Compact
masks must use that same renderer contract and retain transparent pixels outside
the admitted mask shapes. This is a browser integration defect, not native
permission to draw an unconditional radial.

Mac Chrome's corrected compact target has zero alpha at center, corner, and
untouched edge samples. The five-static-mask plus one-decal test retains 10,271
nonzero-alpha pixels rather than incorrectly filling all 65,536. Runtime,
console, and HTTP-error arrays are empty. This focused component probe verifies
the correction. The later built-app journey below also verifies the complete
restraint lifecycle; its final canonical publication gate is separate.

### Ether Drain capture death audit

The earlier “shared banish already at parity” disposition was unsupported.
`0x0047BF70` checks global damage flag `0x100`, then walks Gameplay's registered
Ether Drain list at `+0x13A8/+0x13B4` and accepts the first field with squared
distance strictly below `1600`. Its seven direct callers are `0x004824A0`,
`0x00482930`, `0x00482D60` (Spider), `0x0048D2A0`, `0x004947B0`, `0x00495600`,
and `0x0049C830`. The 55-reference damage-global census identifies the capture
writer at `0x005F8844/0x005F8849`: Ether Drain contact `0x005F8620` ORs `0x10A`
before common damage dispatch. Ordinary magic does not set capture eligibility.

Spider death calls common death eligibility before this test, so reward and
retirement still occur. Capture skips both SpiderDie and DeadSpider. The selected
field's `0x0061DC20` only chooses Anim_Sucked art for Skeleton variants, Zombie,
and Demon; Spider has no image, sound, or capture-flare child. The initial
`0x00402220` call clears the field's previous sucked-animation manager. No
Spider-specific visual may be invented from the unused generic flare kind.

The host carries Ether Drain damage provenance through its existing contact
record and resolves the strict field-distance test against the same world.
The Spider death brain retains the capture decision until terminal processing;
the shared reward and retirement owners remain in control. The six non-Spider
death callers are outside the Spider encounter system. Their family-specific
Anim_Sucked integration remains follow-up work; the previous generic parity
claim does not prove it implemented. Confidence is high for these branches,
based on fresh instructions and complete direct-xref enumeration.

### Authoritative Spider light inputs

The initial host integration reused the spawn helper's coarse player, Lantern,
and enemy lights. That helper omitted primary and secondary spell providers,
ignored player overlay radius, and replaced enemy charge/glow with fixed
values. It cannot substantiate the earlier exact target-light disposition.
The native source query is the same Region light query already recovered for
rendering; Spider does not have a separate “combat darkness” approximation.

The correction moves the existing pure source factories out of renderer-only
modules and reuses them for authoritative queries at fixed simulation ticks.
The shared source inventory includes players, Lantern, all enemy and enemy
projectile providers, primary projectiles and light-emitting transients,
secondary providers and MiscLight, and Air path/contact lights. Pixel rendering
and target allocation remain renderer-owned. Browser frame cadence must never
write the authoritative Spider brain. Existing source-factory tests remain the
formula witnesses; host integration checks must prove the omitted spell lights
can change Spider illumination and disappear when their owners retire.

The compact target query has a further recovered boundary rule. Arena startup
`0x00470BCC..0x00470BEE` initializes `+0x8F84` with 50-unit cells and zero
origin. `MagicGrid::Init 0x00587C40` uses `trunc(extent/50 + .5) + 2` cells per
axis. Insertion `0x00587CF0` and query `0x00588040` truncate float rectangle
edges, divide nonnegative coordinates by 50, clamp to the outer cell, and
retain a separate negative border cell. Query collects whole cells without an
exact rectangle-intersection filter. The initial web rectangle filter can
therefore omit a scaled mask admitted by native at a cell boundary. Both the
authored compact rows and DeadSpider must use this recovered cell membership;
the cached insertion rectangle uses unscaled glyph width and height centered
on the record position. Arena cleanup remains a separate bounds-intersection
decision after sealing.

### Mac behavior and browser receipts

The twelve native generated source layouts have 23 Spider phases. Independent
catalog assertions execute every phase, its complete repeat groups, ordered
flags, pause/sleep/wait transitions, and single wave advance: 335 native births.
The actor, Silk, force, Webbed, Cocoon, corpse, save, and presentation suites
cover their distinct clocks, data rows, geometry, damage branches, and teardown.
The rebased Boneyard run passes 1,978 tests, plus its 365-test prerequisite run.
The focused light-source/capture suites pass 173 tests; world and Cocoon
integration pass 40 after giving the world fixtures their real light owners.

`tools/smoke-boneyard-waves.mjs --spider-only`, with
`SDR_GAME_WAVES_SMOKE_PRODUCTION=1`, passes in Mac Chrome against the production
build. It enters through Play, New Game, the College, and the Boneyard, then
uses the normal Solomon combat-start event. The generated Small Spider Wave
starts at wave 7 and produces its four-member first cohort. Three real Spider
spits replicate live Silk and apply severities 1, 2, and 3. Full Webbed stops
movement and creates exactly one Cocoon. Pause holds the authoritative state;
Leave Game and Last Game restore the same restraint and owner. A real mouse
primary cast breaks the restored Cocoon. Normal Spider death replicates both
DeadSpider and its decal. Actual audio playback includes ShootWeb,
Disintegrate, Webbed, and SpiderDie. Wire, page, console, and HTTP failure
arrays are empty. The screenshots were inspected after the resume overlay
cleared; they show the webbed wizard, live Silk, release, and corpse.

`tools/smoke-spider-masks.mjs` passes eight Mac WebGL cases: selectors 25..29,
DeadSpider, their combined target, and a scaled mask admitted through a shared
50-unit cell beyond the query rectangle. The seven ordinary targets retain
transparent corners; the combined target has 10,271 nonzero-alpha pixels out
of 65,536. The cell-boundary case has 29,874, including the expected clipped
edge contribution. Every case creates two player targets on join, destroys
the departed target, and leaves no owned children after destruction.

The complete implementation exceeded the existing game-entry bundle budget.
Dark Cloud now uses the same on-demand scene boundary as the other optional
scenes, preserving all of its current controls. The production entry is 131,311
gzip bytes against the unchanged 134,144-byte ceiling. The existing built
Dark Cloud browser suite passes desktop, portrait, landscape, and small-phone
scenarios, including its deliberate service-failure responses.

A matching clean-stock live capture was not feasible while the shared Windows
foreground was occupied. Native instruction, registry, and complete authored
corpus evidence remain the oracle; these receipts do not claim a pixel-equal
stock video comparison. Cosmetic draws retain the existing deterministic
browser seed policy, with the recovered native random domains and ranges.
The separate Terrain-mask producer and party-count changes between enemy birth
and reward credit remain the named neighboring follow-ups above.

Final canonical validation and publication: pending for the committed candidate.
