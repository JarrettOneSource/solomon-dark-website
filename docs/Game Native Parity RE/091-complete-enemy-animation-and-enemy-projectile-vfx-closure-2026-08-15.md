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
