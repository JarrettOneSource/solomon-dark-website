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
  fragments, skull, then post-world Unbind. Main/extra bouncers have distinct
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
