# Complete enemy animation and enemy-projectile VFX closure — 2026-08-15

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
| `2057` | `Spider` | out-of-system | Story enemy and Silk/Cocoon graph are not spawned by the Website director. |
| `2058` | `Cocoon` | out-of-system | Spider-owned modifier actor has no reachable parent. |
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
| Spider | `0x809` | out-of-system: story enemy | factory row retained |
| Cocoon | `0x80A` | out-of-system: Spider-owned restraint has no reachable parent | child row retained |
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

The following is the implementation disposition inventory. `exact-ported`
rows are the required end state of this reopening; until the final validation
receipt is recorded, they are not a completion claim.

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
assumption is corrected for both enemy and player consumers; no extra world
queue registration is synthesized for either direct-manager component.

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
