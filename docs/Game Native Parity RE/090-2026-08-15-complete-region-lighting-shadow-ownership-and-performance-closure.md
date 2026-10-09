# 2026-08-15 — Complete Region lighting, shadow ownership, and performance closure

## Reported symptom and preserved failure

After the first exact-outline shadow pass, the browser became substantially
slower and still disagreed with retail around fence silhouettes, shadow depth,
and spell illumination. The unchanged current renderer was measured against
the parent of the shadow integration in isolated worktrees. In the cleaner
deterministic generated-scene samples, current median direct render time was
`10.5 ms` versus `4.3 ms` before the integration, about `2.3x`, even though the
current frame emitted fewer quads (`50` versus `59`). System-wide rAF and
LongTask samples were heavily contaminated by concurrent host load and are not
used as the causal discriminator; final acceptance requires a quieter A/B/A
run with p50, p95, p99, maximum, long-task count/total/max, and heap.

The causal ownership mismatch is direct. Every frame, for every resident
caster, `BoneyardComplexShadowPresentation` destroyed all `FillGradient`
objects, cleared and retessellated `Graphics`, and created a fresh canvas-backed
gradient texture for each projected edge. It also retained one shadow display
root for every static caster, including invisible residents. Retail owns no
per-edge texture and no independently retained shadow actor. A second mismatch
made the raster light field more expensive: the browser allocated a full-DPR
viewport RenderTexture, while retail sizes a square target through
`Game.LightQuality`, `0.25f` on the shipped enhanced path.

## Binary identity and evidence boundary

All static claims below come from read-only analysis of retail
`SolomonDark.exe`, 4,723,200 bytes, SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`,
using isolated Ghidra 12.0.3 replicas and raw PE instruction checks. The
complete address/formula/source chart is the Mod Loader ledger
`docs/reverse-engineering/native-lighting-and-shadow-system.md`; this Website
entry records the port contract and supersedes the older assumptions that
Multiple Shadows shipped off, generic edges were source-facing, alpha-hull
shapes were authoritative, or shadow roots belonged at `ownerDepth-0.001`.

## Four observable lanes

Native Arena lighting is one manager with four separate products:

1. Arena walks persistent provider owners through vslot `+0x30` in provider-list
   order.
2. Fixed-tick actions/effects append one-tick `MiscLight` records through
   `0x0044F4B0`; Arena replays this lane after all providers.
3. Accepted sources stamp DeadHawg record 18 into one quality-scaled raster
   target. `0x0057D670` composites it with `ZERO,SRCCOLOR`, so the pre-main
   framebuffer is multiplied by the light texture.
4. The same accepted records enter a 150-unit spatial grid. Main painters query
   a maximum analytic scalar for tint; true-flag sources additionally produce
   object-owned directional records through `0x0057F0E0`.

The lanes cannot be collapsed. A false-flag source can be suppressed by an
earlier accepted source, true-flag sources bypass containment, and a false-flag
source that survives still affects another record's one-unit-behind scalar and
can shorten its shadow tail.

Provider order is one authoritative manager order, not an ordering by protocol
array or source family. `Region::Tick 0x0063EFC0` clears the pointer count, then
walks the stable `+0x310` actor manager (`0x0063F127..0x0063F139`) before the
`+0x8B70` transient manager (`0x0063F162..0x0063F168`). Each actor tick appends
its provider pointer, including intentional duplicate Archer/Mage copies. Arena
then consumes `+0x8D80` index zero upward. Initial Boneyard player slots register
in slot order; the scripted Lantern follows Solomon_Dig; later actors and
projectiles retain their manager insertion order. A reconnect appends at the
tail, while cell rebind does not reorder the actor manager.

Wave creation is a separate pre-manager edge: Arena ticks TimeLine at
`0x0046E641..0x0046E646`, its Spawner manager at
`0x0046E483..0x0046E493`, and the Spawner registers the enemy through
`0x0046D313..0x0046D31C -> 0x0063F6D0` before Region begins the actor-manager
walk. Player spell births then occur at their earlier player slots; projectiles
created by later enemy actors append afterward. The web authority therefore
persists `{managerLane,registrationOrdinal}` and defers same-tick enemy
projectile tickets until earlier player spell births have claimed their native
ordinal. Renderer category buckets such as players-then-enemies-then-spells are
not evidence-equivalent.

The modeled Misc owners now include player and Mage Air factories, MagicCircle,
Mod_Burn, and Mod_ElectricBurn. Cross-owner order is the creator's actor-manager
registration. Within one creator, authority publishes a non-negative
`miscLightAppendOrdinal` for each synchronous producing batch; renderer-local
sample order resolves only the records inside that batch. All batches replay
after the complete persistent-provider pass. Mod_EtherBurn remains the dormant
sibling and must not be synthesized from another burn role.

## Settings and target quality

Initializer `0x005BAB60` derives platform capability `0x00B3BCAE`; shipped
Windows sets it to one. Missing-key defaults are therefore:

| Setting | Global | Fresh shipped-Windows default |
| --- | ---: | --- |
| Complex Lighting | `0x00B3BCA8` | true |
| Complex Shadows | `0x00B3BCA9` | true |
| Multiple Shadows | `0x00B3BCAA` | true through the capability byte |
| FastCPU / Enhanced Effects | `0x00B3BCAD` | true through the capability byte |
| Light Quality | `0x00B3BCA4` | `0.25f`; low-capability default is float32 `0.05999999865889549` |

The preserved sandbox settings are an override profile, not a default oracle:
they explicitly store Multiple Shadows false, FastCPU false, and Light Quality
`0.060000`. Browser receipts and policy must name which profile they compare.

`Arena::Create 0x00470A90 -> 0x0057DF20` makes the light target square with
side `trunc(max(logicalWidth,logicalHeight)*LightQuality)`. The web mapping is a
logical square covering the viewport with RenderTexture resolution
`deviceResolution*0.25`; source sprite scale remains `radius*cameraZoom`
because the target transform, not the glyph, supplies quality.

## Submission, falloff, and source families

Generic submitter `0x0057FE40` consumes source point, raster/query point,
radius, intensity, and a directional/containment-bypass flag. A false-flag
candidate is suppressed only when a prior accepted record has no lower
intensity, no smaller radius, and lies strictly inside the radius-difference
circle scaled by 145. Ordinary tint query `0x0057F980` takes the maximum source
contribution with plateau 75, outer radius 145, and vertical scale 0.85.

The 2026-09-07 enemy audit rechecked that ABI against raw Portal instructions
`0x0047BED0..0x0047BF6B`. After source and raster XY, `0x0057FE40` consumes
radius as parameter 6 and intensity as parameter 7. Portal stores its live
alpha in the intensity slot and its alpha-scaled random size in the radius
slot. The earlier Portal summary had those two fields reversed. The random
magnitude at `0x00786964` is float `0.3500000238418579`; the added double at
`0x00784970` is `0.8999999761581421`. Addition is stored as float before the
alpha multiplication and final float store. Both host queries and renderer
stamps use the shared corrected Portal source. Other provider families retain
their independently recovered parameter order; this correction does not swap
the general light ABI.

The static census closes all compiled provider families rather than only those
materialized by Website: player; DemonSkull; Skeleton, Archer, and
Mage; Imp variants; Wraith; Demon; Coffin; DireFaculty; Heartmonger; Portal;
GameNPC; ZAnimLit; missile families; Fireball; Boulder/Hailstones; Ember;
Arrow/Firebolt/DarkFireball/Silk; Lantern; Meteor; fire families; GroundSpark;
Shockwave/FreezeWave; Leviathan; EtherBolt/UnholySpit; Golem; MagicTrap; Bonus;
DemonBomb; weather; EtherDrain; Comet; and OffscreenMagic. The separate
MiscLight census closes DemonSkull MouthBeam, UltraBanish, three lightning
factories, MagicCircle, EyeLaser, ElectricBurn, Burn, and EtherBurn. Dormant
families remain ledger-only until their authoritative actors exist.

The active secondary persistent membership is exhaustive: actor-lane
MovingFire/Fire_Goodguy, Shockwave/FreezeWave, Leviathan, EtherBolt, Golem,
MagicTrap, StormCloud/AcidRain, EtherDrain, and Comet, plus transient-lane
variant-one EtherFade through its ZAnimLit wrapper. Their exact
radius/intensity/flag rows are respectively `.6/min(1,3*alpha)/MS`,
`waveRadius/140/alpha/false`, `1/1/MS`, `.5/1/MS`, `1/.75/MS`,
`.25/1/false`, `2/.5*alpha/false`, `2/min(scale,1)*(.5+U(.5))/MS`,
`2/.5/MS`, and `scale/min(alpha,1)/MS`. MagicCircle is not a provider: it
appends a true-flag MiscLight at radius `0.5*scale` and intensity
`.75+S(.25)`. Burn appends radius `.1+U(.1)` with terminal intensity
`min(remainingTicks/50,1)`; ElectricBurn appends radius `.5+S(.25)` at
intensity one. Treating those three one-tick records as provider rows changes
containment and replay order.

Currently modeled formulas remain exact. Player intensity is one, its true
flag bypasses containment, and its source is 15 units along heading. Its
analytic radius is `(1+overlayPhase)*2.5999999046325684` plus the active
local barrier presentation's 180-tick level-up sine pulse, while its
independent raster scale is `2.5999999046325684-U(0.2)`. The host simulation
does not advance or replicate a second level-up clock while the multiplayer
barrier is frozen, and remote players never receive the browser-local pulse.
Lantern radius is `0.65`, intensity
`0.55+U(0.2)`, and its flag is Multiple Shadows. Fireball radius is
`1+U(0.25)` with intensity `0.75`; ZAnimLit wrappers use their owned fields.
Air factory path lights remain a Misc tail, are enrolled at transient age zero
only, and use the exact two-leg 100-unit sampler, inclusive 220-unit
source-distance gate, `(0,+35)` offset, radius `0.75+U(0.25)`, one shared
intensity `0.25+U(0.75)`, and Enhanced Effects as their true flag.

The modeled enemy-projectile union is also exhaustively dispositioned. Fire
Arrow and Firebolt use the transient-provider lane with radius
`0.5+U(0.25)`, intensity `0.85`, and false flag; normal/poison Arrow emit no
source. Cold/poison Guided Missile uses the actor-provider lane with radius
`0.75+U(0.1)`, intensity `0.75`, and Multiple Shadows. Demon Bomb is an
actor provider with radius `0.6`, intensity `1-U(0.25)`, and false flag.
Poison Pool's provider slot is a native no-op. Actor-lane candidates must be
collected before transient-lane candidates in their replicated manager
registration order; presentation RNG samples by display frame and stable
projectile ID, not simulation age.

The modeled enemy families are also an exhaustive source union, and their
mutable light fields belong to simulation authority. Skeleton, Archer, Mage,
Imp, Wraith, Demon, and Coffin have native providers; Zombie has none. Exact
glow (`+0x244/+0x230`), Archer/Mage charge (`+0x24C`), and the post-gate copy
count must be stepped in the enemy store and replicated. Spawn-age or visible
pose reconstruction fails Archer pose-9 resets, Mage dispatch/lightning writes,
burning Mage's double update/copy, and mid-run joins. Burning Skeleton/Archer/
Wraith add `0.05` per active tick; burning Mage adds two clamped `0.05` steps;
Imp adds `0.01`. Archer/Mage charged radius is
`charge*(0.5+S(0.1))`, Imp radius is `0.25+S(0.1)`, and Demon radius is
`1.5+S(0.25)`. Coffin emits only in opening, transition-delay, or open state.
At that revision the static `burning-fire` role was treated as family-owned
presentation and did not imply the separate Mod_Burn MiscLight. The
2026-08-20 reopened closure below supersedes that projection: family-native
fire is now presentation-owned and the generic wire role no longer exists.
Mod_ElectricBurn and Mod_Burn are active
target-owned secondary snapshot members; Mod_EtherBurn remains catalogued but
dormant.

Other modeled members are explicitly negative. The `banish`, `bouncer`,
`fade`, `move-fade`, `sprite-array`, and `unbind` death-effect union emits no
outbound Region source; Bouncer's black copy is class-local flat art.
`Anim_UltraBanish` is a distinct dormant MiscLight, not Website `banish`.
`Solomon_Dig` emits no light, while its separate Lantern does. Generic GameNPC
has a native provider but is not a current snapshot member. The player
tick-159 death burst also emits no source.

The accepted-source list also retains the native distinction between world
source, camera-relative query, analytic radius, and raster scale. Arena vslot
`+0xF4 -> 0x004620D0` computes
`query=source-(Arena[+0x8BCC],Arena[+0x8BD0])`. Before containment,
`0x0057FE40/0x00580130` scale query and `145*analyticRadius` by
`float32(LightQuality*0.8)` and reject circles that do not strictly intersect
manager rectangle `(0,0,targetSide,targetSide+LightQuality*350)`. This is a
provider-stage cull, so it applies independently of resident visibility and to
true-flag sources as well.

PlayerWizard's `0x00580130` path is the one modeled source whose raster scale
is not its analytic radius. The analytic lane uses
`(1+overlayPhase)*2.5999999046325684 + sin(pi*localLevelUpFrame/180)` while the
DeadHawg-18 stamp uses `2.5999999046325684-U(0.2)`. Here
`localLevelUpFrame` is owned by the browser-local, barrier-keyed level-up
presentation above; it is not a replicated host timer. The presentation
random draw occurs before view rejection. The Website light record and raster
field must therefore carry the two values separately; using one `radius` for
both changes player illumination, shadow reach, and the visible glyph at once.

The provider's render-time gate is also authoritative: submit when native
animation drive `+0x160==0` or the actor is the process-local player
(`+0x5C==0`). The local exemption is per browser and must use `localPlayerId`,
never the authority host ID. Remote casting, dying, and spectating actors are
suppressed; the local actor remains eligible in those drive states. Overlay
phase is fixed-tick state, not a render-age reconstruction: native cast modes
reset it to `0.15`, `0.25`, or the dormant sibling value `0.45`, and every tick
stores `float32(phase*0.8999999761581421)`. That overlay phase and provider
registration survive snapshot, protocol, resync, and the presentation timeline
discretely. The separate 180-tick threshold effect is keyed to the local
barrier presentation so it continues while host simulation is frozen and
cannot replay after release or leak onto a remote actor.

Here `U(a)` is not a half-open JavaScript unit sample. Native RNG construction
`0x00401110` sets denominator state to `100000`; `RandomFloat 0x00401310`
draws `RandomInt(100001)`, stores the integer as float32, divides by 100000 and
stores float32, multiplies by float32 `a`, and stores float32 again. Its domain
therefore includes both zero and the exact maximum on a 100,001-point lattice.
Signed `S(a)` consumes an independent `RandomInt(2)` sign draw after the
magnitude. `RandomInt 0x00401170` reduces the generator word through the next
power-of-two mask and then modulo, so Coffin's `I(9)` is the biased native
integer reduction over `0..8`, never a scaled float.

The browser cannot reproduce stock's one process-global draw identity without
replicating every intervening native consumer. It instead hashes stable
semantic owner/frame inputs into a 32-bit word, then applies the exact native
mask/shift/reduction, inclusive float lattice, signed draw arity, and float32
store schedule. This is a bounded sample-identity substitution, not a domain
approximation. At the manager ABI boundary, source coordinates, analytic
radius, intensity, and optional raster scale are normalized to float32 once;
the normalized record is then used consistently by viewport rejection,
containment, raster stamping, grid coverage, scalar queries, and shadows.

Mage lightning is an Air-factory producer, not a `381/382` sprite effect.
Default dispatch owns a 50-tick channel and emits one factory birth per fixed
tick. Each pulse contributes its persistent body/source painters and its own
age-zero Air path-MiscLight tail; its contact corona is direct/self-lit and
never a ZAnimLit provider. Consequently provider collection must place the
Mage actor's ordinary/charged provider copies in actor-manager order, collect
all other persistent provider owners, and append every Mage/Air path source in
the Misc tail only afterward. Grouping by convenient snapshot arrays or placing
path lights adjacent to their actor changes asymmetric false-source
suppression and is observable.

The append order is now instruction-closed. `Region::Tick 0x0063EFC0` clears
the MiscLight count at `0x0063F078`, then ticks the actor manager at
`0x0063F127..0x0063F139` before the transient/ZAnim manager at
`0x0063F162..0x0063F168`. `ObjectManager::Tick 0x004022A0` walks its active
pointers in stored order and rereads the live count at `0x0040234B`; add
`0x00402720 -> 0x004013C0 -> 0x004013E0` appends, while remove
`0x00402450 -> 0x00402770` shifts left without reordering survivors. Player
and Mage Air factories therefore append their complete path-light batches
synchronously at the position of their creator in that one actor traversal.
The repeated midpoint from the two control legs remains an intentional pair
of adjacent records inside the batch. Arena `0x0046EC80` submits the rebuilt
persistent provider list at `0x0046ED2B` and only then replays the Misc array
at `0x0046EE58`; no Misc record can move beside its persistent owner.

Website authority now carries the complete key: every active secondary
persistent owner retains `{managerLane,registrationOrdinal}`; MagicCircle
retains its actor registration; Burn/ElectricBurn copy their target actor's
registration; and every Misc-producing actor carries the batch-local
`miscLightAppendOrdinal`. Player and Mage registrations remain the monotonic
cross-owner proxy, while factory birth tick and semantic ID only break ties
between otherwise identical batches. This is why player Air must not be grouped
before Mage Air categorically: a late-joined player may follow an existing
Mage. Same-tick wave births are also closed: Arena ticks TimeLine at
`0x0046E641` before Region at `0x0046E68D`; Spawner reaches Region add through
`0x0046D313..0x0046D31C`, so a newly spawned enemy is appended before that
Region actor pass and can precede a later player-cast child.

The target key belongs to actor-manager membership, not to whether that actor
currently emits a persistent source. Every Website hostile target therefore
retains an actor-lane registration, including Zombie and independently managed
Coffin Maggots, even though neither family has a native provider callback.
Their entity descriptors serialize that registration so joined and
resynchronized clients preserve attached Burn/ElectricBurn batch order.

Modifier ordering is instruction-closed. Common actor tick `0x00624AC0` calls
`0x006247A0` before its subclass body. That helper walks the target's embedded
Action manager at `actor+0x104` (count `+0x10C`) in stable order and invokes
each action tick slot `+0x08`; `0x00625150` and `0x006243C0` own attachment.
Burn/ElectricBurn therefore precede a same-target Mage Air factory, while
MagicCircle emits at its own actor-manager position and player Air emits from
the later transient pass. The serialized append ordinal is per synchronous
batch under one creator, not a global ordinal per light sample and not a reuse
of persistent-provider order. Protocol 30 carries the creator registration and
ordinal discretely through snapshot, resync, and presentation interpolation.

The target-attached corona's coordinate owner is not its painter owner.
`PlayerWizard` constructs an embedded animation `ObjectManager` at `+0x16C`
(`0x0052A539 -> 0x00402070`), and Mage appends the contact there at
`0x004911B2..0x004911C4`. Arena first flushes the entire shared world painter
queue at `0x0046FDAF`; only afterward does each player vslot `+0x24`
(`0x0052C2A0 -> 0x0052A640`) install that target's root transform and draw the
embedded manager at `0x0052A884`. Contact pulses retain insertion order, so a
newer pulse paints above an older one. The Website must therefore follow the
target position/lifetime while keeping the contact in a distinct post-main
overlay lane. Parenting it inside the player's ordinary world-sorted root
would incorrectly place it behind later main actors and scenery.

The surrounding Arena calls close that lane rather than merely bounding it as
"late." The foreground/proxy flush completes at `0x0046FDAA`; the immediately
preceding late manager finishes at `0x0046FED7`; player slots `0..3` then draw
their `+0x16C` managers through the call at `0x0046FEFE` (return
`0x0046FF00`). Arena's `+0x8D90`, `+0x8DA4`, and optional `+0x4B4` managers
follow, and Water Over's direct `+0x1E0` manager is last at
`0x0046FFB7..0x0046FFBD`. The exact relative order is therefore
`foreground/proxies < Mage target contact < post-world managers/Water Over`.
Within the Mage lane, player-slot order wins first and each target's embedded
manager draws oldest-to-newest. The web painter encodes that named interval as
`foregroundZIndex + 0.25`, reserving the established `+0.5` post-world lane for
Water Over rather than conflating the two.

## Directional records, exact geometry, and Z ownership

`0x0057F0E0` creates one 0x24-byte record per eligible true-flag source. It
stores direction/source, pairwise base attenuation, scalar one unit behind the
object, normalized elliptical distance, `(145-U(1))*radius` projection, and
radius. Complex Shadows gates painting, not source collection.

Analytic tint reaches the shared `0x0041FE50` color path and is packed through
`0x00747360` with truncation after multiplying by 255. The web grayscale lane
must therefore map scalar `0.5` to byte `127`, not rounded byte `128`.

Generic shape closer `0x00655570` preserves authored point order and stores
edge normal `(dy,-dx)` without polygon-winding normalization. Projector
`0x00655970` accepts strict `dot(normal, midpoint-source)>0`. Each accepted
edge is one four-vertex/six-index quad whose base vertices use record base alpha
and tips use `((1-behindScalar)*(1-distanceFraction))^3`. Alpha is packed by
truncation to eight bits and interpolated per vertex.

The recovered native catalog is Tree 15, Gravestone 17, Monument 21,
Building 4 including the concave row, Goodie subtype, Fencepost 14,
FenceGrate, Broken grate, moving Gate, Rails, Wall, and Scrub. The currently
materialized Website default path owns explicit programs for the authored
object rows, intact FenceGrate, moving Gate, Rails, and Wall. Broken grate and
Scrub remain catalogued but are absent from the shipped Website scene/model,
so their static selector returns no invented fallback until those exact actor
states exist. Grates use one separate tapered bar quad per bar plus their rail,
preserving visible gaps; moving Gate geometry follows live leaf endpoints.
Rails and Wall keep their class-specific programs rather than entering a
convex-hull fallback.

Native does not enqueue a separate shadow actor. Each caster rebuilds records,
draws its shadow immediately before its own main art inside the same painter,
then draws the owner. The shadow therefore has exactly the owner's painter row
and stable tie position. The Website mapping must insert each active shadow mesh
directly before its exact Sprite or Container at equal `zIndex`; subtracting an
epsilon can cross unrelated fractional slots and is not stock Z ownership.

## Required browser implementation and acceptance

- Replace per-frame `Graphics`/`FillGradient` churn with one shared 256-entry
  black-alpha ramp texture and pooled `MeshSimple` indexed buffers for currently
  visible casters. UV selects the packed alpha byte; buffers grow only on
  demand and update in place. Position/UV lanes update per frame, while index
  topology uploads only when active quad count or retained capacity changes.
- Materialize explicit quads for generic edges, grate bars/rail, Rails, and
  Wall. Do not retain a display root for an inactive static caster.
- Feed both complex-shadow projection and static painter ordering from the
  reused visible-main-resident list, plus live moving-Gate owners. The generated
  document has roughly 5,371 catalogued static casters; scanning or sorting all
  of them every frame is not native painter ownership. Offscreen layers remain
  materialized but perform no per-frame record, geometry, or sorting work.
- Keep dynamic counters in the existing structured `__sdrBoneyardFrame`
  receipt. Do not duplicate them into changing DOM `data-*` attributes every
  frame; only static renderer-capability markers belong there.
- Keep provider candidates and Misc tail separate until their native order is
  assembled, then run asymmetric containment once.
- Reuse a generation-tagged 150-unit light index across frames. Insert every
  accepted source through the cells touched by its conservative
  `145*radius` AABB; scalar and directional-record queries visit only the
  point's current bucket and still apply the exact 0.85-elliptical predicate.
  This preserves source order/output while removing the former
  `casters*sources^2` hot path. Match the native finite allocation rather than
  an infinite floor-divided map: `0x0057DB90` fixes two padding cells,
  `0x0057DF20` allocates `ceil(float32(worldExtent/150))+4`, and
  `0x0057D870/0x0057FC00` use
  `trunc0(float32(float32(value)/150))+2`. Negative fractions stay in logical
  cell zero, insertion clamps its AABB to the allocated grid, and point queries
  beyond the padded extent return empty. Do not linearly clear retained
  buckets.
- Render the Region raster at native default LightQuality while retaining its
  exact main-world multiply boundary and separate analytic tints.
- Expose diagnostics for active shadow meshes, allocated capacity, records,
  quads, accepted providers, and Misc-tail count.
- Prove stable same-depth immediate-before-owner ordering for static residents
  and moving Gate Containers; unrelated painter ordering must not change.
- Run canonical validation, a real WebGL visual receipt containing oblique
  player/Air light across gravestones and fences, and quiet A/B/A performance
  measurements with p50/p95/p99/max, long tasks, and heap. The final current
  median must remove the preserved roughly `2.3x` regression without deleting
  native fence gaps or directional records.

The performance harness must construct each authoritative snapshot before its
render timer, warm the renderer before capturing its resource baseline, and
count only LongTask entries whose start falls inside the measured interval.
Otherwise host/state-construction work is mislabeled as painter cost and a
buffered observer can report unrelated startup tasks.

## Remaining bounded unknowns

Exact process-global RNG interleaving for flicker and projection-distance
samples is not recovered end to end; browser presentation uses deterministic
semantic words with the exact native reducer, inclusive lattice, draw arity,
and float32 boundaries. D3D9 texel-center behavior at every
non-default LightQuality and fallback class painters used when Complex Shadows
is disabled remain outside the current on/default WebGL target. Neither permits
an approximation in the default geometry, lifecycle, source order, or painter
ownership documented above.

## 2026-08-28 — Solomon Dig Lantern level re-audit

The user requested a fresh check of the Solomon Dig Lantern's lighting level.
This audit finds no current Website defect and authorizes no tuning.

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | unmodified Beta `0.72.5` image, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Same sealed lighting oracle as the complete Region closure. | high |
| Fresh instructions | canonical Ghidra 12.0.3 read-only replica, Lantern provider `0x005E6220` | Provider reads actor root `+0x18/+0x1C`, calls `Float(.2)`, adds `.55`, passes radius `.65`, and forwards global Multiple Shadows to generic submitter `0x0057FE40`. | high |
| Fresh constants | `0x00784CE8=.2f`, `0x00785680=.5500000119` double, `0x00784DC0=.65f` | Native intensity domain is the inclusive float lattice `0.55..0.75`; radius is exactly `0.65`. | high |
| Current Website | `native-boneyard-lighting.ts`, `boneyard-lighting.ts`, `boneyard-world-renderer.ts` at `0c510ce3` | Constants are `0.55/.2/.65`; production uses float32 addition and the inclusive semantic native-random projection, submits at `dig.lanternPosition`, and preserves both Multiple Shadows branches. | high |
| Consumer/lighting census | Region raster stamp, analytic grid, directional records, `nativeSolomonSetPieceLighting` | Lantern is one actor-lane source. Solomon body, Flydirt, and Lantern art query their established separate roots; the late player-aperture policy does not alter it. | high |

Membership remains: one Lantern type `5010` for every materialized opening
Solomon set piece; no source with zero candidates; one provider at the actor
root; radius `0.65`; intensity `0.55+Float(.2)`; directional flag equal to
Multiple Shadows; Region raster/analytic/shadow consumers; teardown with the
run. All are `verified-already-at-parity`. Solomon_Dig itself remains a
non-provider, and the separate subdued late player aperture is out of this
source's system.

The final task acceptance must strengthen the existing contracts and capture a
real deterministic Boneyard frame with Lantern intensity inside the exact
inclusive domain, accepted-source diagnostics, unchanged actor/source root,
and empty browser error arrays. Unless that receipt falsifies this audit, no
Lantern radius, gain, falloff, position, render order, or product brightness
constant changes.

### Re-audit validation receipt

- No Lantern production file changed. Focused coverage now explicitly pins
  `0.55`, `0.2`, radius `0.65`, exact caller position, and both Multiple
  Shadows branches; the complete Mac gate passed it.
- In the built deterministic Solomon journey, the near-set-piece frame reported
  Lantern intensity `0.604095995426178`, two accepted sources, and one visible
  record-13 Solomon pass. The value lies on the recovered `0.55..0.75`
  inclusive domain; source collection, Region raster/analytic products,
  directional shadows, and visible Lantern art remained active. Page, console,
  failed-response, and wire-error arrays were empty.
- The reviewed frame SHA-256 is
  `967c734098f2cb204bcb50f16f3170afb8ff301ac8acd1545bee28361f6f3901`.
  No evidence falsified the current level, so radius, intensity, falloff,
  placement, and compositing remain unchanged.

## 2026-08-29 — Complete lighting-system audit reopening

### Reported smell and parity question

- Reported request: audit the complete lighting system, independently compare
  retail and Website behavior, and close every remaining discrepancy rather
  than retesting only the previously reported player or Lantern symptom.
- Stock behavior to recover: the complete Arena light-manager target,
  persistent-provider and `MiscLight` membership, native random-call arity,
  analytic consumers, elevated surfaces, environment-player pass, directional
  shadows, every settings branch, and entry/reset/resize/teardown.
- Reproduction inputs: retail 1600-by-900 high profile (`LightQuality=.25`,
  Multiple Shadows and Enhanced Effects on), preserved low profile
  (`.06`, both off), environment modes `0..2`, Complex Lighting/Shadows
  independently toggled, the complete callback/xref census, and current
  Website `origin/main` `acad2d24cd7d82550cb6ad3b6e54e62ab0026f76`.
- Falsifiers: any provider vtable or `MiscLight` caller absent from the
  inventory; a `RandomFloat` signed byte not checked in raw instructions; a
  non-power-of-two stock target; a Website source admitted outside the native
  active rectangle; a specialized-query xref left undispositioned; or a
  browser receipt that checks only counts rather than rendered pixels.

This is a secondary report against the same system. The earlier complete pass
made three process errors that this audit corrects everywhere:

1. it read decompiler expressions such as `base + RandomFloat(maximum)` but did
   not inspect the raw signed-byte argument to `RandomFloat 0x00401310`;
2. it treated the requested light side as the allocated texture side and
   omitted `nextPowerOfTwo 0x00410450`, the `0.8` manager transform, and the
   camera-relative active rectangle; and
3. the Building pass explicitly deferred the only other specialized-query
   consumer, Wall, even though a complete lighting census cannot omit it.

The 2026-08-28 Lantern re-audit above is therefore superseded specifically for
flicker signedness and its claimed `[.55,.75]` interval. Radius, position,
provider order, setting flag, and all downstream consumers remain valid.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail image | unmodified `SolomonDark.exe` 0.72.5, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000`, re-hashed 2026-08-29 | Same sealed executable backs every static and live row below. | high |
| Ghidra provenance | canonical `SolomonDark` project through read-only replica wrapper revision `08bfba9ef367f7b863848030d0a289dc31e33192`; wrapper SHA-256 `b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49` | Fresh xrefs found 36 direct generic-provider callbacks, 54 provider vtables, 13 `MiscLight` append callsites in ten functions, two ordinary-scalar callers, two specialized-scalar callers, one directional-record caller, one target initializer, and one compositor caller. | high |
| Raw provider instructions | `0x005E4AF0`, `0x005E50D0`, `0x005E6140`, `0x005E6220`; `RandomFloat 0x00401310` | Each call pushes signed byte `1`: Missile radius is `.75+S(.1)`, Fireball `1+S(.25)`, Arrow-family `.5+S(.25)`, Lantern intensity `.55+S(.2)`. Current Website uses unsigned samples for all four. | high |
| Target instructions | `0x0057DF20`, `nextPowerOfTwo 0x00410450`, reset/finalize/composite `0x0057D4E0/0x0057D5E0/0x0057D670`, Arena callsites `0x0046ECED..0x0046EE6C` | Allocation is the next power of two above the truncated requested side. Manager coordinates use float32 `LightQuality*.8`; the active square is camera-visible world width times Light Quality and extends downward by `LightQuality*350`. | high |
| High live diagnostic | injected task PID `22468`, runtime base `0x002A0000`, staged executable hash equal to retail; Lua exec against Arena `0x19A1C150` | `LQ=.25`, manager scale `.200000003`, allocation `512x512`, active rectangle `(0,0)..(296.296295,383.796295)`. | high supporting evidence |
| Low live diagnostic | injected task PID `26040`, runtime base `0x009D0000`, staged executable hash equal to retail; Lua exec against Arena `0x19AB9D68` | `LQ=.059999999`, manager scale `.048`, allocation `128x128`, active rectangle `(0,0)..(71.111107,92.111107)`, Multiple Shadows/Enhanced Effects off. | high supporting evidence |
| Live provider lane | high task PID `8212`, runtime base `0x002A0000`; persistent list `Arena+0x8D80/+0x8D8C`, accepted records `Arena+0x8C44 +0xFC/+0x108` | Player then Lantern vtables/callbacks were exact. Forty Lantern samples ranged `.364724010..749794006`; Multiple Shadows off changed only the Lantern record flag from one to zero. | high supporting evidence |
| Live environment grids | trace of `0x00588040` plus Arena `+0x8AF4/+0x8F24/+0x8F84` | Retail queries the general spatial grid and both player target grids every frame. Both target grids were empty in the observed run; that sample did not prove exclusion. The 2026-09-05 complete xref sweep identifies Terrain at `+0x8F24` and authored compact masks plus DeadSpider at `+0x8F84`. | high |
| Specialized consumer | Wall builder `0x005EEBB0`, Wall render `0x0061DF40`, wrappers `0x0061E780/0x0061E990`; Building `0x0060E940` | Wall samples its two materialized endpoints through `0x0057E640`, creates endpoint grayscale values, and interpolates them through its generated surface/decor program. Website bakes its fixed-color three-stroke approximation into the untinted pre-main base; because Wall is correctly excluded from actor occlusion, the runtime never materializes the otherwise-modeled Wall lighting or shadow program. | high |
| Current web differential | current Mac main; Building smoke and direct module probe | Default Website target is `400x400`/logical `1600`; low plan is `95x95`. Web source domains are Lantern `.550026..749932`, Missile `.750008..850000`, Fireball `1.000033..1.249970`, Arrow `.500030..749862`; a source past the native zoom-1.35 right edge remains admitted. | high |
| Current Mac browser baseline | macOS 26.6.2 arm64, Chrome/WebGL2, detached `acad2d24` | Four Building and 21 Monument member proof passed; Settings toggles passed with empty error arrays. The checked-in complex-shadow smoke failed before a lighting assertion because it omitted newly required empty `modAssets/modCatalog`, exposing a stale acceptance harness. | high |

Injected-loader data is supporting runtime evidence, not clean-image pixel
authority. Exact formulas, call membership, target allocation, and sign flags
come from the sealed instructions. The live runs prove those findings against
fresh PIDs and explicit ASLR mappings.

### System boundary and complete membership inventory

Native system: **Arena Region lighting and directional-shadow manager**, from
Arena construction and provider registration through raster target allocation,
provider/Misc replay, spatial indexing, analytic/elevated queries, surface and
actor consumers, environmental player masks, shadows, settings, reset, resize,
and destruction. Hub has no Region manager and is a negative scene member.

#### Manager, consumers, settings, and lifecycle

| Member / branch | Native source | Disposition required by this reopening | Proof contract |
| --- | --- | --- | --- |
| target construction and allocation | `0x0057DF20 -> 0x00410450` | `exact-ported` by this correction | `.25 -> 512`, `.06 -> 128`, DPR-scaled browser allocation with unchanged CSS result |
| manager coordinate transform | manager `+0xC4`, float32 `LQ*.8` | `exact-ported` by this correction | source world-query pixels and composite world coverage |
| active cull rectangle | reset arguments, manager `+0xE8..+0xF4` | `exact-ported` by this correction | zoom-1.35 high `296.296295 x 383.796295`; low `71.111107 x 92.111107`; strict tangency |
| reset, clear, finalize | `0x0057D4E0/0x0057D5E0` | `verified-already-at-parity` after target correction | one complete frame epoch; no stale accepted records |
| persistent provider registration/order | Arena `+0x8D80/+0x8D8C`; vslot `+0x30` | `verified-already-at-parity` | actor before transient, stable registration ordinal, late join and teardown |
| `MiscLight` append/replay | Arena `+0x8DF4/+0x8E00`; append `0x0044F4B0` | `verified-already-at-parity` | complete provider pass before ordered Misc batches |
| asymmetric false-source containment | `0x0057E2F0`, generic submitter `0x0057FE40` | `verified-already-at-parity` after signed radii | intensity/radius/strict-circle tests across source order |
| finite 150-unit analytic grid | `0x0057DB90/0x0057FC00/0x0057D870` | `verified-already-at-parity` | generation reuse, negative truncation, padding, finite bounds |
| Region raster stamp and multiply | DeadHawg 18; `0x0057D670`, selector 2 | `exact-ported` by target correction | full allocation, world-query stamp, native `ZERO/SRCCOLOR`, pre-main or late setting branch |
| ordinary analytic scalar | `0x0057F980`; callers `0x004881A0`, `0x00624B40` | `verified-already-at-parity` | plateau/falloff/vertical scale/max and byte truncation |
| Building elevated surface | `0x0060E940/0x0060EC50`; all eight art rows | `verified-already-at-parity` | 3x3/2x2 grids, four selector offsets, shared base/roof colors |
| Wall elevated endpoints | `0x0061DF40`; two `0x0057E640` calls | `exact-ported` by this correction for endpoint samples and interpolation | horizontal/vertical/diagonal, connected/unconnected, Complex Lighting off |
| native Wall generated geometry/decor | builder `0x005EEBB0` | `out-of-system` for this lighting correction: separate known Wall-geometry parity debt | Website retains its current stone-band silhouette; endpoint lighting becomes exact, but cap/detail geometry may remain visibly different |
| `ZFightHelper` endpoint wrapper | vslot `+0x1C -> 0x0061E990` | `out-of-system`: no corresponding Website helper object | Wall owner directly supplies the two materialized endpoints |
| directional records | `0x0057F0E0`, common dispatcher xref | `verified-already-at-parity` after signed sources | record membership, pairwise attenuation, behind scalar, distance and projection samples |
| generic authored shadow shapes | closer/projector `0x00655570/0x00655970` | `verified-already-at-parity` | exact point order, strict normal test, per-vertex alpha truncation |
| Tree 15, Gravestone 17, Monument 21, Building 4, Goodie, Fencepost 14 | authored outline tables | `verified-already-at-parity` | every table row and variant remains individually asserted |
| FenceGrate, moving Gate, Rails, Wall shadow programs | class programs | `verified-already-at-parity` | bar gaps, live leaves, dual rails, extended Wall endpoints |
| Broken grate and Scrub shadow programs | compiled class branches | `out-of-system`: corresponding Website actor states are absent | no invented generic fallback |
| Complex Lighting on/off | `0x00B3BCA8` | `verified-already-at-parity` after target correction | on pre-main plus analytic; off white analytic plus late raster composite |
| Complex Shadows on/off | `0x00B3BCA9` | `verified-already-at-parity` | off releases directional meshes without removing flat class shadows or providers |
| Multiple Shadows on/off | `0x00B3BCAA` | `verified-already-at-parity` after signed sources | only `MS` callbacks change flag; literal true/false remain fixed |
| Light Quality `.06..25` | `0x00B3BCA4` | `exact-ported` by target correction | allocation, transform, cull and resize consume one value |
| Enhanced Effects on/off | `0x00B3BCAD` | `verified-already-at-parity` for both Building grids; user toggle remains `out-of-system` per Settings authority | current browser policy stays visibly fixed on |
| modes `0/1/2` direct player pass | `0x00470EE0`, DeadHawg 18 | `verified-already-at-parity` for membership/geometry; final opacity is `out-of-system` by explicit user product policy | mode 0 absent; modes 1/2 bounded additive; Website remains 14 percent of native brightness |
| optional DeadHawg-9 target passes | Arena `+0x8F24/+0x8F84` | Compact masks `exact-ported` in the [Spider reopening](091-complete-enemy-animation-and-enemy-projectile-vfx-closure-2026-08-15.md); separate Terrain shape contribution is follow-up outside that system | Authored selectors 25..29 and DeadSpider share the compact target. Empty live grids did not prove no producer. |
| weather splash/streak order | Arena weather callers | `verified-already-at-parity` | splash before Region, streak after foreground; Complex Lighting off reorders composite |
| first frame, pause, reset, resize, scene replacement, destroy | Arena/Website scene owners | `exact-ported` after target resize correction | ready barrier, no hidden simulation clock, no stale textures/meshes/listeners |
| Hub/private-room rendering | no Region initialization/composite | `out-of-system` negative member | no invented Hub radial lighting; Staff/ambient self-lit painters remain separate |

There is no `blocked-by-platform` member. WebGL2 can express the native target,
blend, interpolation, and shadow programs. Two visible differences remain
intentional/outside this lighting correction: the subdued 14-percent late
player aperture and the current approximate Wall silhouette/decor geometry.

#### Persistent provider callbacks and every vtable row

| Callback / complete vtable membership | Native formula or branch | Disposition |
| --- | --- | --- |
| `PlayerWizard::vftable 0x00793F74 -> 0x005299A0 -> 0x00580130` | source `+15` heading, analytic `(1+phase)*2.6`, raster `2.6-U(.2)`, intensity one, literal true | `verified-already-at-parity` after target correction |
| `DemonSkull 0x00786074 -> 0x00474970` | capability-gated skull source | `out-of-system`: dormant Website enemy family |
| `Skeleton 0x00786604 -> 0x004779E0` | glow-scaled `.5+U(.5)`, radius `.5`, `MS` | `verified-already-at-parity` |
| `SkeletonArcher 0x00786CF4 -> 0x00478180` | burning Skeleton branch or charge `.75`, radius `charge*(.5+S(.1))`, `MS` | `verified-already-at-parity` |
| `SkeletonMage 0x00786DA4 -> 0x004783E0` | Archer sibling plus intentional duplicate enrollment | `verified-already-at-parity` |
| `Imp 0x00785E5C`, `GreenImp 0x007861B4`, `GoodImp 0x00793D9C -> 0x00478CC0` | glow-scaled `.75+U(.25)`, radius `.25+S(.1)`, literal false | `verified-already-at-parity`; GreenImp remains dormant |
| `Wraith 0x00785FAC -> 0x00478E00` | glow-scaled `.5+U(.5)`, radius `.5`, `MS` | `verified-already-at-parity` |
| `Demon 0x00786114 -> 0x00479470` | live intensity one/death `.5+U(.5)`, radius `1.5+S(.25)`, `MS` | `verified-already-at-parity` |
| `Coffin 0x00786744 -> 0x00479EA0` | state-gated radius `.65`, intensity `1-I(9)*.1`, `MS` | `verified-already-at-parity` |
| `DireFaculty 0x0078626C -> 0x00479F80` | signed radius/owned fields | `out-of-system`: dormant Website enemy family |
| `Heartmonger 0x00786E54 -> 0x0047A040` | class-state source | `out-of-system`: dormant Website enemy family |
| `Portal 0x007868CC -> 0x0047BED0` | portal-state source | `out-of-system`: no current Website Portal actor |
| `ZAnimLit 0x0079C4DC -> 0x005E48E0` | wrapper radius/intensity/owned flag and child position | `verified-already-at-parity` for active impact/fade wrappers |
| `MagicMissile 0x0079C544`, `FireMissile 0x0079D5F4`, `BallLightning 0x0079D66C`, `FrostMissile 0x0079D6E4`, `GuidedMissile 0x0079DA8C`, `SkullMissile 0x0079DCDC -> 0x005E4AF0` | intensity `.75`, radius `.75+S(.1)`, `MS` | `exact-ported` by this correction for every materialized sibling; unmaterialized rows remain catalogued |
| `Fireball 0x0079C5BC -> 0x005E50D0` | intensity `.75`, radius `1+S(.25)`, `MS` | `exact-ported` by this correction |
| `Boulder 0x0079E014`, `EBoulder 0x0079E08C`, `Hailstones 0x0079E104 -> 0x005E5670` | intensity `.5`, radius `max(1,2*charge)`, `MS` | `verified-already-at-parity` |
| `Ember 0x0079C624`, `EvilEmber 0x0079C694 -> 0x005E5960` | intensity `.25*min(life,1)`, radius `1-U(.25)`, literal false | `verified-already-at-parity` |
| `Arrow 0x0079C7E4`, `Firebolt 0x0079CAD4`, `DarkFireball 0x0079D144`, `Silk 0x0079D294 -> 0x005E6140` | radius `.5+S(.25)` with class-owned intensity/flag | `exact-ported` for fire Arrow/Firebolt; Silk is `verified-already-at-parity` with no light: its constructor/tick does not register the inherited provider. Other siblings remain catalogued |
| `Lantern 0x0079C854 -> 0x005E6220` | radius `.65`, intensity `.55+S(.2)`, `MS` | `exact-ported` by this correction; range `[.35,.75]` inclusive |
| `Meteor 0x0079C9F4 -> 0x005E7040` | fall/impact visibility and body-scaled radius, literal false | `verified-already-at-parity` |
| `GreenFire 0x0079DC2C -> 0x005E7420` | alpha-gated green-fire source | `out-of-system`: no current Website actor |
| `Fire 0x0079D76C`, `Fire_Goodguy 0x0079D7DC`, `MovingFire 0x0079D8BC`, `DireFire 0x0079DD64 -> 0x005E7610` | radius `.6`, `min(1,3*alpha)`, `MS` | `verified-already-at-parity` for active good/moving fire; dormant siblings catalogued |
| `GroundSpark 0x0079D84C -> 0x005E7800` | radius `.4`, intensity `.5+U(.5)`, literal false | `verified-already-at-parity` |
| `Shockwave 0x0079D92C`, `FreezeWave 0x0079D994 -> 0x005E7AA0` | radius `waveRadius/140`, intensity alpha, literal false | `verified-already-at-parity` |
| `Leviathan 0x0079DBAC -> 0x005E90C0` | radius/intensity one, `MS` | `verified-already-at-parity` |
| `EtherBolt 0x0079CCF4`, `UnholySpit 0x0079CF34 -> 0x005E9160` | radius `.5`, intensity one, `MS` | `verified-already-at-parity` for EtherBolt; UnholySpit dormant |
| `Golem 0x0079DE94 -> 0x005E94C0` | radius one, intensity `.75`, `MS` | `verified-already-at-parity` |
| `MagicTrap 0x0079CD84 -> 0x005E97A0` | radius `.25`, intensity one, literal false | `verified-already-at-parity` |
| `Bonus 0x0079CDEC -> 0x005E9840` | class scale/intensity, `MS` | `verified-already-at-parity` |
| `DemonBomb 0x0079CE54 -> 0x005E98E0` | radius `.6`, intensity `1-U(.25)`, literal false | `verified-already-at-parity` |
| `GameNPC 0x0079CEBC -> 0x005EA110` | class/state radius and `.9+U(.1)`, `MS` | `out-of-system`: no current Arena GameNPC snapshot member |
| `StormCloud 0x0079CC8C`, `AcidRain 0x0079CF9C -> 0x005EB5C0` | radius two, `.5*cloudAlpha`, literal false | `verified-already-at-parity` |
| `RainOfBones 0x0079D06C -> 0x005EBD90` | class-alpha random source | `out-of-system`: no current Website actor |
| `EtherDrain 0x0079DF1C -> 0x005EE780` | radius two, `min(scale,1)*(.5+U(.5))`, `MS` | `verified-already-at-parity` |
| `Comet 0x0079D304 -> 0x005F0DB0` | radius two, intensity `.5`, `MS` | `verified-already-at-parity` |
| `OffscreenMagic 0x0079D44C -> 0x005F18A0` | actor-scale source | `out-of-system`: no current Website actor |

#### Complete `MiscLight` producer membership

| Producing function / family | Native source | Disposition |
| --- | --- | --- |
| DemonSkull MouthBeam | `0x0044FFE0 -> 0x0044F4B0` | `out-of-system`: dormant DemonSkull ability owner |
| UltraBanish | `0x00460AB0 -> 0x0044F4B0` | `out-of-system`: distinct dormant native effect, never substitute Website banish |
| normal/player/Mage Lightning factory | `0x00531640`, two append callsites | `verified-already-at-parity`: exact two-leg samples, one shared intensity, age-zero batch |
| chain Lightning factory | `0x00531F00`, two append callsites | `verified-already-at-parity` through shared Air factory contract |
| Blizzard/variant-24 Lightning factory | `0x005328D0`, two append callsites | `verified-already-at-parity` through welded Air/Blizzard contract |
| MagicCircle | `0x006006E0` | `verified-already-at-parity`: `.75+S(.25)`, radius `.5*scale`, literal true |
| EyeLaser | `0x006054F0` | `out-of-system`: dormant enemy ability owner |
| Mod_ElectricBurn | `0x00628F10` | `verified-already-at-parity`: target registration, radius `.5+S(.25)`, intensity one |
| Mod_Burn | `0x00629A40` | `verified-already-at-parity`: target registration, radius `.1+U(.1)`, terminal fade |
| Mod_EtherBurn | `0x00629CD0` | `verified-already-at-parity`: active skill-14 target modifier; prior dormant statement superseded |

Every compiled callback, vtable row, append callsite, setting, consumer, and
authored shadow family has one disposition. No `not-yet-extracted` member
remains.

### Native ownership thread and recovered corrective contract

- Arena owns one light manager at `+0x8C44`. Region tick rebuilds provider and
  Misc lists from authoritative actor/transient managers; Arena render resets
  the target, replays persistent callbacks in registration order, replays all
  Misc records, restores the backbuffer, then uses the same accepted records
  for analytic tints and directional records.
- Target request is
  `trunc(max(viewportPhysicalWidth,viewportPhysicalHeight)*LightQuality)`;
  allocation is `nextPowerOfTwo(max(1,request))`. Native high and low are
  `512` and `128`, not `400` and `96/95`.
- Manager world-to-target scale is float32 `LightQuality*.8`. Per render, query
  origin is the camera-visible world top-left. Active rectangle width is
  `float32(viewportWidth/cameraZoom*LightQuality)` and height is that width plus
  `float32(LightQuality*350)`. The full power-of-two texture composites from
  the same top-left; unused padding is black.
- A browser DPR multiplies both requested allocation and manager resolution,
  preserving native CSS/world coverage rather than changing the light radius.
- The four corrected signed calls each consume a magnitude word and a sign
  word. Website keeps its established semantic sample-identity substitution,
  but now preserves exact native signed domain, draw arity, float32 stores,
  culling, containment, raster size, scalar reach, and shadow reach.
- Wall samples the materialized shadow/program endpoints, not its midpoint.
  Complex Lighting off supplies endpoint scalars one; on uses the same
  elevated query as Building. The retained Website raster can carry the exact
  affine endpoint grayscale even while its separate silhouette/decor debt is
  explicitly preserved.
- The implementation probe exposed one deeper Wall ownership error: code-3
  Wall was baked into the tiled pre-main base. The correction must remove only
  Wall from that base tile, retain it as a distinct pre-main resident, and
  register its existing extended-endpoint shadow program. Promoting Wall into
  the actor/scenery main queue would violate its proven slot-`+0x28` ownership.
- Entry, pause, and teardown do not own new simulation state. Presentation RNG
  and targets remain local; provider order and mutable fields remain
  authoritative/replicated where already required.

### Confidence and explicit residual differences

- Confirmed: executable identity, all xrefs/vtables/callsites, signed flags,
  constants, target allocator, high/low live layouts, active rectangle,
  provider ordering, target-grid producer, all specialized consumers, current
  web divergence, and stale smoke failure.
- Intentional difference: the Website's direct player aperture is
  14 percent of native brightness by explicit prior user policy.
- Known separate debt: Website Wall art remains an approximate stone-band
  raster rather than the complete `0x005EEBB0` generated mesh/decor program;
  this correction makes its endpoint lighting exact but does not claim exact
  Wall pixels.
- Designed multiplayer substitution: semantic presentation words replace the
  process-global RNG stream. Domains and per-call relationships are exact;
  stock and Website flicker phases need not match frame-for-frame.
- Unknown material to this implementation: none.

### Web implementation consequence

- Correct the shared Region target plan, cull rectangle, source coordinate
  space, stamp scale, composite placement, resize, and diagnostics. Remove the
  screen-coordinate target path rather than layering padding around it.
- Replace unsigned samples for the complete shared Missile, Fireball,
  Arrow-family, and Lantern memberships with the native signed reducer and an
  independent semantic sign word. Rename the Lantern constant from misleading
  “minimum” to base intensity.
- Lift every Wall out of the tiled base into a retained pre-main
  two-endpoint surface-color mesh; sample its native extended shadow/program
  endpoints and register that same resident as the custom Wall shadow depth
  owner. Keep Wall out of the actor/scenery main queue and do not claim or
  invent exact decorative geometry here.
- Repair the checked-in complex-shadow browser harness to pass empty mod asset
  inputs, update its native target receipts, add low-quality and outside-native-
  rectangle falsifiers, and retain every existing shadow/performance check.
- Remove only falsified expectations (`400/95`, unsigned ranges, midpoint Wall
  tint). Provider order, falloff, shadow tables, Building, environment opacity
  policy, gameplay, protocol, and audio remain unchanged.

### Validation contract

- Focused contracts: high/low/DPR target allocation and logical coverage;
  active rectangle values and strict edges; source/stamp/composite world
  coordinates; all four signed inclusive domains with samples on both sides of
  base; every shared vtable family; Wall endpoint interpolation for horizontal,
  vertical, diagonal, connected and unconnected programs; Complex Lighting
  off; resize and destroy.
- Built Mac WebGL2: default target `512`, low target `128`, native logical
  coverage, one deliberately far provider candidate rejected before accepted
  source/index/shadow products, late Air admission retained, zero Z mismatches,
  every Building/Monument and Wall member visibly lit, and empty page/console/
  failed-response arrays.
- Settings journey: Complex Lighting, Complex Shadows, Multiple Shadows,
  Light Quality, environment mode, first frame, resize, scene replacement, and
  teardown remain independently exercised.
- Stock-versus-web: compare the recorded high/low target values and signed
  domains against the exact candidate diagnostics; inspect matching
  1600-by-900 frames for source softness, fence/tree shadows, Wall endpoint
  gradient, and bounded environment pass.
- Run `/opt/homebrew/bin/bash ./scripts/validate.sh` on the exact byte-identical
  Mac candidate, then repeat browser acceptance after any rebase.

### Implementation validation receipt

- Candidate base: current `origin/main`
  `bea74208839c6078f9a3dd83321041c089e2ca0e`, in isolated Website worktree
  `/home/user/.codex-worktrees/solomon-website-lighting-audit-20260829-root`.
  The exact uncommitted diff was applied to detached Mac worktree
  `/Users/jarrett/codex-acceptance/solomon-lighting-audit-20260829-root` and
  repeatedly proved byte-identical by SHA-256 before executable validation.
  This is the post-validation fast-forward over the independent Frost Jet
  parity commit; it had no file overlap with the lighting candidate.
- Focused Mac contracts: `tsc -p tsconfig.test.json --noEmit` passed and the
  two lighting suites passed `45/45`. Those contracts include strict manager
  edges, high/low/DPR allocation, both sides of every corrected signed domain,
  horizontal/diagonal Wall interpolation, Building grids, provider membership,
  containment, analytic/elevated queries, and Fire presentation ownership.
- Canonical Mac gate: `/opt/homebrew/bin/bash ./scripts/validate.sh` completed
  with exit zero after backend build/tests, strict lint, every frontend suite,
  desktop tests, production build, bundle budget, and production media policy.
  The first full attempt passed all tests but exposed the omitted Wall fields
  in the production-only `BoneyardPainterFrame` interface; the interface was
  completed, the focused production build passed, and the entire canonical
  gate was then repeated successfully on the corrected tree. After the
  independent Frost Jet fast-forward, the entire canonical gate passed again.
  Final post-rebase game entry bundle was `263457` raw / `79952` gzip bytes
  within budget.
- Default Mac WebGL2 shadow/Region smoke: passed with target physical side
  `512`, logical side `2559.999961853028`, zero Z-order mismatches, late Air
  admission still visible, zero long tasks, and no page, console, or failed
  response errors. The stale fixture was repaired for current empty mod inputs,
  materialization state, and null tutorial ownership before it reached these
  lighting assertions.
- Building/Monument/Wall Mac WebGL2 smoke: all four Building selectors and all
  21 Monument selectors changed pixels under the light; base/roof color
  mismatch count remained zero. The synthetic pre-main Wall was materialized
  exactly once, Complex Lighting off produced vertex min/max `1/1`, lighting on
  produced `0.004239678382873535..0.16817410290241241`, and the Wall region
  changed `26105` pixels with channel delta `2451450`. Its custom Wall shadow
  program was active in the same frame. Error arrays were empty.
- Settings Mac Chrome journey: Complex Lighting, Complex Shadows, Multiple
  Shadows, and Zoom Effects all disabled cleanly; Light Quality stored
  `0.05999999865889549`; the paused-menu target receipt updated immediately to
  physical `128` / logical `2666.6666434870826`; error and failed-response
  arrays were empty.
- Built production proof: the canonical bundle was served by the real Release
  .NET backend and driven against the built `dist-game-host` artifact. The
  three-client desktop/mobile `/game` journey reached Boneyard with WebGL2 on
  Apple M2, populated both painter/light receipts, preserved Region multiply
  ordering, and returned empty host/client/mobile page and console error arrays.
  An initial run without an injected supervisor endpoint is excluded: it
  correctly failed at shared-Hub admission with HTTP 503 before Boneyard; the
  unchanged journey passed once wired to the task-owned built host.
- Post-rebase repeat: the default complex-shadow/Region smoke, the complete
  Building/Monument/Wall smoke, the low-quality Settings journey, and the
  built three-client production journey all passed again on `bea74208`; the
  numeric lighting receipts above were unchanged and every error array stayed
  empty.
- Stock-versus-web visual inspection used the separately captured 1600-by-900
  high/low/Multiple-Shadows-off stock frames and the final Mac WebGL2 frames.
  The Region footprint, soft radial edge, pre-main darkness, and directional
  fence/tree shadow behavior are qualitatively aligned. The frames use
  different generated arenas and are therefore supporting visual evidence,
  not pixel-equality authority; exact parity claims rest on the sealed
  instructions and numeric live/module receipts above.
- Residuals are explicit rather than unknown: the direct player aperture stays
  at the user-directed 14 percent of stock brightness; semantic presentation
  words intentionally replace the process-global RNG phase; browser Enhanced
  Effects remains fixed on; the former Spider/DeadSpider exclusion is superseded
  by the complete 2026-09-05 compact-mask port; and Wall silhouette/decor remains the already-recorded approximate
  geometry debt. No additional in-system lighting discrepancy remained after
  the final membership and callsite rescan.
- Publication state: implemented and validated in retained task worktrees only.
  No commit, push, deployment, or live-production claim is made.


The 2026-09-20 ground-fluid reopening in entry 297 corrects the direct aperture
and compact-mask painter interval: Arena `+0x110` draws both before
`Region+0x2C4`, the Region multiply, and the world queue. Earlier claims that
these player-local light targets execute after sorted actors are superseded.
The explicit 14-percent direct-aperture brightness policy is preserved.

## 2026-09-21 — Mage Air creator-registration lifetime repair

### Reported smell and parity question

- The eleventh Fire-on-Mac / Water-on-Windows wave-100 run stopped at wave 37
  after Windows raised `Mage Air factory 28139 emitted a light without native
  manager registration`.
- The native behavior is already closed above: every Mage Air birth appends its
  age-zero path-light batch at the Mage creator's stable actor-manager position,
  and the pulse's independently registered body/source/contact painters and
  contact attachment then finish their own lifetimes.
- The parity question is therefore a replication/presentation ownership
  question, not a request for new native behavior: can a pulse preserve the
  exact creator registration from authority through interpolation, keyframes,
  deltas, saves, simulation light queries, and rendering even while its Mage is
  not in the sampled enemy membership?
- Falsifiers are a synthesized ordinal, a dropped light, accepting an old wire
  shape in production, resolving through the sampled caster, mutating a shared
  registration object, or changing path geometry, age admission, painter
  registration, target attachment, or Misc-tail ordering.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Native instructions and prior ledger | this file's sealed `Region::Tick 0x0063EFC0`, `ObjectManager::Tick 0x004022A0`, Air factory `0x00531640`, and Arena replay `0x0046EC80` sections; retail 0.72.5 SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | A Mage's synchronous Air batch is keyed by its creator's existing actor-manager registration, while all Misc records replay only after the persistent-provider pass. Nothing in native rendering re-discovers that key from a later sampled actor list. | high |
| Failed browser run | `solomon-evidence-6a583nbx/eleventh-free-mana-20260921/client-events.jsonl`, Windows event at `2026-09-21T17:53:16.991Z` | Renderer lookup of Mage `28139` failed before the pulse's path light could be submitted. | high for the observed web failure |
| Bounded reproduction | same evidence directory, `reproduce-mage-owner-boundary.mjs` and `mage-owner-boundary-reproduction.json` | Actual `interpolateBoneyardEnemySamples` admitted one newer pulse and its path light at presentation tick 103 while `interpolateEnemies` still exposed zero enemies. | high for the component boundary; synthetic rather than the exact live frame |
| Current authority and renderer trace | `enemies/projectile-emission.ts`, `enemies/work.ts`, `host/project-boneyard-enemies.ts`, `boneyard-mage-lightning-replication.ts`, `boneyard-enemy-samples.ts`, `core-server/boneyard-world-light.ts`, `native-mage-lightning-pulse-view.ts`, and `boneyard-scene-lights.ts` at baseline `bfa35bd3` | The pulse owns `ownerActorId` and its separate painter registrations but not the creator light registration. Both simulation and renderer recover the latter from the current enemy array; the renderer additionally contains a forbidden painter-ordinal fallback. | high |

No new native address, class, formula, art record, or timing rule is recovered
here, so the Mod Loader native report remains unchanged. This entry corrects a
Website lifetime seam under the already-proven native ownership contract.

### System boundary and membership inventory

Native system: **Mage-generated Air pulse registration lifetime** — from the
authoritative Mage factory call through retained pulse age, snapshot/protocol/
save ownership, presentation admission, painter materialization, age-zero
MiscLight replay, contact attachment, and retirement. The sweep also checks
the other active MiscLight transient families at this owner-removal seam.

| Member (class/variant/scene/branch) | Native source | Disposition | Proof / required contract |
| --- | --- | --- | --- |
| Mage actor and ordinary/charged provider copies | Mage provider `0x004783E0`; actor-manager traversal | `verified-already-at-parity` | actor retains its existing immutable light registration; this repair does not allocate another one |
| Mage Air pulse construction | `Mage::Tick 0x00490860 -> 0x00531640` | `exact-ported` by this repair | copy the creator's exact actor-manager registration into every pulse at authoritative emission |
| New Mage and first pulse in the newer interpolation snapshot | same factory plus presentation birth admission | `exact-ported` by this repair | pulse renders and contributes its path batch before sampled enemy membership without a lookup |
| Retiring/dead/removed Mage with a still-live pulse | independent native child/contact lifetimes | `exact-ported` by this repair | creator registration remains pulse-owned through all retained ages and survives either interpolation direction |
| World-contact pulse | direct world corona branch | `exact-ported` by this repair | three painter registrations stay distinct; creator registration orders only the age-zero path batch |
| Target-attached pulse | player embedded-manager contact branch | `exact-ported` by this repair | two painter registrations and target-following contact stay distinct; the same creator registration orders the path batch |
| Age-zero path lights | Air factory two-leg sampler | `exact-ported` by this repair | exact creator registration, exact append ordinal, no early/duplicate/drop behavior |
| Ages one through four and finite retirement | native two-tick body, one-tick source, three/five-tick contact branches; retained five-age ledger | `verified-already-at-parity` after ownership propagation | no path batch after age zero; registration remains immutable until the pulse is retired |
| Authoritative simulation light query | Arena light-query equivalent | `exact-ported` by this repair | consumes the pulse-owned creator registration even after the actor row is absent |
| Host snapshot projection and presentation copy/interpolation | Website replication seam | `exact-ported` by this repair | each layer makes an owned registration copy and preserves it across future-birth filtering and pulse retirement |
| Object keyframe and compact keyframe/delta wire forms | Website protocol only | `exact-ported` by this repair | strict actor-lane field/frame column, immutable materialization, malformed/legacy production rejection, coupled protocol bump |
| Current and prior save documents | Website continuation only | `exact-ported` by this repair | current saves persist the field; the immediately prior schema migrates only from an exact saved owner row and rejects an unrecoverable orphan rather than guessing |
| Painter body/source/world-contact registrations | native child actor registrations | `verified-already-at-parity` after removing the renderer fallback | exact registration count/order is mandatory; no `pulse.id * 3` reconstruction |
| Player primary-Air age-zero path batch | shared `0x00531640` factory, player actor creator | `verified-already-at-parity` for this boundary | authority removes a player's transients atomically with its entity; the presentation keeps the older player through the same pre-boundary interval as the older transient, and a newly admitted player cannot cast while materializing. This branch is covered by a focused owner-removal audit and is not used to infer a Mage registration. |
| MagicCircle and target-owned Burn/ElectricBurn/EtherBurn Misc batches | `0x006006E0`, `0x00628F10`, `0x00629A40`, `0x00629CD0` | `verified-already-at-parity` | each replicated secondary actor already carries its own creator/target registration and append ordinal; no renderer lookup is performed |
| Chain and Blizzard Air factory geometry siblings | `0x00531F00`, `0x005328D0` | `verified-already-at-parity` | they share the exact path sampler but are owned by their existing primary/weld transient models; no Mage-enemy lookup exists |

There are no `blocked-by-platform` members and no authored table to extract for
this lifecycle correction.

### Native ownership thread and recovered contract

- The creator registration is an immutable value captured at pulse birth. It
  is neither a reference to the actor row nor one of the pulse's independently
  allocated painter registrations.
- `ownerActorId` remains semantic provenance for diagnostics, damage, and
  append-ordinal matching. It is not sufficient ownership for later light
  ordering and must never be dereferenced to recover registration.
- World and target-attached contacts share creator-registration ownership.
  Their separate painter counts and their target-following/post-main behavior
  remain unchanged.
- Only age zero contributes the Air path-light batch. The pulse ledger remains
  bounded by `NATIVE_MAGE_LIGHTNING_MAX_PULSE_AGES`; copies and interpolation
  must retain the registration even at ages that emit no path source so every
  representation has one stable shape.
- The registration travels as an actor-lane ordinal in the object snapshot and
  one required compact-frame column. A wire version that lacks the column is a
  different protocol, not an opportunity for production inference.
- Saves may recover a pre-field pulse only when its exact owner actor and exact
  actor-lane light registration are still present in that same authoritative
  document. An orphaned legacy pulse is unrecoverable and must be rejected.
  Historical diagnostic archives use an explicit offline adapter, never a
  permissive production decoder.

### Web implementation consequence and validation contract

- Add the creator light registration to the authoritative pulse and copy it at
  every store, projection, protocol, save, and presentation boundary.
- Pass it with the renderer's path-light batch and consume it directly in both
  `boneyardWorldLightQuery` and `BoneyardSceneLights`; keep `ownerActorId` only
  for the existing target-modifier append ordinal and diagnostics.
- Delete the renderer's pulse painter-registration fallback. Missing or wrong
  counts/lanes remain hard errors; no ordinal may be invented and no light may
  be silently discarded.
- Bump the coupled game protocol and save schema. Protocol keyframes and deltas
  require the new compact column. The production decoder rejects the old frame
  length; any wave-100 archive replay must opt into a separately named offline
  conversion.
- Focused tests cover both contact variants, first-newer-snapshot admission,
  both retirement directions, every live pulse age, exact manager ordering,
  owned copies, host projection, compact/object malformed inputs, keyframes,
  deltas, current-save round trips, exact legacy-save migration, and orphaned
  legacy-save rejection.
- Final acceptance remains the Mac-only focused suites, complete
  `./scripts/validate.sh`, browser error-free Boneyard journey, and the restarted
  two-client wave-100 stress run owned by the parent.

### Implementation validation receipt

Implementation and validation receipts are intentionally pending while this
pre-code boundary declaration is recorded. They must be replaced with the exact
changed-file inventory and parent-run Mac results before publication.


## 2026-10-09 — Player aperture and compact-ground-mask RGB reopening

### Symptom, scope, and pre-code evidence

The residual-softness report includes pale gray/white irregular Tutorial
puddles where retained stock pixels are dark. These are compact authored
records, not rain splash `DeadHawg.24`: Tutorial `sprite-73` is `DeadHawg.141`
at `(942.6280517578125, 1744.4481201171875)` and `sprite-74` is
`DeadHawg.142` at `(996.6280517578125, 1693.4481201171875)`. Both source
rows have scale/alpha one; native startup normalizes selectors 25..28 to
alpha `.75`, already represented by both current base and mask consumers.
All five decoded compact crops `DeadHawg.139..143` have black RGB at every
nontransparent texel. Their alpha contours supply the shape. Thus the bright
patch cannot be attributed to pale RGB baked into those source crops.

The owning RGB callsite was omitted from the previous aperture/mask closure.
This reopening supersedes the claim above that no further in-system lighting
discrepancy remained, and qualifies entry 297's September 20 ordering closure:
pre-world order and mask membership were covered, final composite RGB was not.
It does not reopen unrelated tree/grave UV paths or authorize a global filter,
pixel snap, sharpening, mask deletion, or artistic brightness replacement.

Sealed authority: `SolomonDark.exe`, 4,723,200 bytes, preferred base
`0x00400000`, SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`.
This pass uses read-only raw PE constants plus LLVM instruction disassembly.
Retained source excerpts and numeric receipts are in
`/Users/jarrett/solomon-darker-bug-reports/20261009-sh9aksle-visual-tuneup/remaining-softness/native-source-audit/`.
The relevant files are `arena-surface-pass.asm`,
`primary-color-provider.asm`, `primary-palette-initializer.asm`,
`color-transforms.asm`, `color-setter.asm`,
`channel-integer-conversion.asm`, and `color-formula-receipt.json`.
The receipt is an independent formula calculation from sealed constants,
not a live native framebuffer measurement. `native-weld-constant-receipt.json`
also decodes every one of the 15 native branch argument tuples and asserts
that all match the formula receipt, independently of current Website tables.

| Evidence | Exact owner/callsite | Observed contract |
| --- | --- | --- |
| Direct player aperture | Arena `+0x110`, `0x0047126E..0x0047143E` | Mode 1/2 only; additive blender 1; resolve primary descriptor color, desaturate `.2`, darken `.25`, then draw record 18 |
| Compact target composite | Same Arena callback, `0x004726AC..0x0047282F` | Same RGB provider/transforms; additive blender 1; independently sampled alpha; draw bounded target at `0x00472817` |
| Descriptor provider | Skills_Wizard vtable `0x007A0CD4`, slot `+0x88 -> 0x00660760` | Ordinary root palette is already 85%-desaturated; valid Weld 1000..1014 use the same 85% transform of their own base tuples |
| Ordinary palette construction | `0x00782940..0x00782B38`, destination `0x0081CD38` | Eight root tuples transformed by `0x0040FC60` with float `.8500000238418579`; ninth sentinel is initialized separately |
| Final color stores | `0x004713A4` / `0x004727BE -> 0x0041FE50` | Computed RGB and separate flicker alpha reach renderer state; RGB is not overwritten with white before either draw |
| Packing | `0x0041FE50 -> 0x00747360` | Multiply RGB by current renderer modulation, multiply by double 255, truncate toward zero, pack channels; fast path is `CVTTSD2SI`, not round-to-nearest |

### Exact color formula and variants

Let `f` mean an IEEE float32 store. Base tuple components are stored as
float32. `S(c,a)` is the native `0x0040FC60` transform:

- `L = f(c.r * 0.3086000084877014 + c.g * 0.6093999743461609 + c.b * 0.0820000022649765)`.
- `S(c,a).channel = f(c.channel * (1 - a) + L * a)`, followed by
  `0x0040F770` channel clamping to `[0,1]`; alpha is copied/clamped.
  The clamp does not change any valid palette tuple in this system.
- Descriptor `p = S(base, 0.8500000238418579)`.
- Aperture/mask pre-modulation RGB is
  `f(S(p, 0.20000000298023224).channel * 0.75)`.
- With identity renderer modulation, packed tint bytes are
  `trunc(channel * 255)`. Do not quantize the descriptor first or reuse a
  rounded, already-packed Enchant Staff tint.

Raw factor addresses are `.85` at `0x00784D60`, `.2` at `0x00784CE8`,
`.25` at `0x007DE978`; the three double luminance constants are at
`0x007DE8C0`, `0x007DE8B8`, and `0x007DE8B0`.
The saturated `+0x8C -> 0x00661260` provider used by Spider outlines is a
separate owner and cannot substitute for `+0x88`.

| Selected primary | Base tuple | Final packed RGB |
| --- | --- | --- |
| Ether 8 / Plane 80 | `(1,.1,1)` | `0x624e62` |
| Fire 16 | `(1,.35,.1)` | `0x70615b` |
| Air 24 | `(.1,1,1)` | `0x7b9090` |
| Water 32 | `(.1,.5,1)` | `0x48515d` |
| Earth 40 | `(.1,1,.1)` | `0x6f846f` |

The complete Weld base bank, indexed by `buildId - 1000`, is
`(1,.1,.5)`, `(1,.5,1)`, `(1,.75,1)`, `(1,.75,.5)`, `(1,.75,1)`,
`(.75,.75,.75)`, `(1,.75,1)`, `(1,.75,.5)`, `(.8,1,1)`, `(.9,1,1)`,
`(1,.1,.5)`, `(1,.35,.1)`, `(.1,.5,1)`, `(.1,1,1)`, `(.1,1,.1)`.
Their final packed values in the same order are
`5c4750`, `8b808b`, `a59fa5`, `9e9893`, `a59fa5`, `8f8f8f`,
`a59fa5`, `9e9893`, `b0b4b4`, `b7baba`, `5c4750`, `70615b`,
`48515d`, `7b9090`, `6f846f`.

The color is selected each draw from the current primary selector and, for
52, the provider's current Weld build at `Skills_Wizard+0x750`. The outer
RGB calculation has no tick, weather, Region-mode, or position input.
Time/RNG separately affects opacity: direct aperture is `.25 * (.95 + U(.05))`
in stock, while compact composite is `.95 + U(.05)`. The existing web-only
14%-of-stock direct-aperture policy and semantic presentation RNG remain
explicit policies; neither permits white RGB. Mode zero skips the aperture,
but compact masks remain candidate-driven in all modes. Later Region multiply
and stock arena saturation still apply in their established painter interval.
Planewalker follows the effective selector: `0x00548927` saves the prior
selection at Wizard `+0x308`; `0x00548965` writes 80 into the same global
setting `12+slot` consumed by both lights; removal at `0x0052F509` restores
the saved primary. Therefore each browser player with positive
`secondary.planewalkerTicksRemaining` uses Plane 80/Ether color, and expiry
restores that same player's selected primary/Weld color. The retained raw
receipts are `planewalker-enable-selector.asm` and
`planewalker-primary-selector.asm`.

### Descriptor fallback boundary recovered before fallback tests

- `0x00660771..0x00660792` treats selector **-1** as an instruction to read
  the current selected-primary global setting 12. It is not a constant-white
  or constant-Ether default. A stateless helper cannot implement that implicit
  context; renderer callers must supply their player's effective selection.
  Other negative or noninteger JavaScript values have no established valid
  stock-input contract, and must not be described as native fallback behavior.
- For selected Welding 52 with a build outside 1000..1014 (including absent
  build in the browser representation), `0x006607A9..0x006607AC` falls through
  to the ordinary row descriptor. Row 52 is class/root 7, so the base is
  `(.75,.75,.75)` and final light tint is `0x8f8f8f`.
- For an unknown nonnegative row index, `0x00660C41..0x00660C67` grows the
  skill array and reads that row's class at `+0x1C`. The grower `0x0046D670`
  invokes default constructor `0x0046AF70`; instruction `0x0046AFC7` writes
  class **-1**. Class resolver `0x00656430` returns roots 1..7 only for those
  respective class codes, and returns root **0** for all other classes
  (`0x00656479`). Therefore a newly defaulted positive row resolves to Ether
  descriptor color and final `0x624e62`, not `0xbfbfbf`.
- This owner differs from the existing saturated `nativePrimarySpellTint`
  helper. Keep that existing helper's public fallback unchanged in this patch;
  the new ground-light resolver must not import its unsupported white fallback.
- Raw evidence is retained as `descriptor-class-resolver.asm`,
  `skill-row-default-and-grower.asm`, and `default-skill-row-constructor.asm`.
  Minimal red cases are Welding 52 with null/out-of-range build and unknown
  positive row 9000. Do not invent a constant result for selector -1.

### Full affected membership and current Website owners

- `renderer/boneyard-environment-light.ts`: `BoneyardEnvironmentLightView`
  creates additive `DeadHawg.18` per-player apertures. Its update currently
  sets position, alpha, and depth but never tint, so RGB remains white.
- `renderer/native-compact-mask-view.ts`: `PlayerMaskTarget` creates the
  256-square linear NPM target and additive `native-compact-player-mask`
  composite. Its update likewise sets visibility, alpha, position, and depth
  without tint. Target stamps deliberately select diffuse RGB while retaining
  source alpha, then multiply by `DeadHawg.9`; the missing color belongs on the
  final composite, not on the normal black base art or white mask stamps.
- All authored compact selectors 25..29 (`DeadHawg.139..143`) and retained
  Spider decal entries 140..142 share this composite. The exact same final
  color applies to static and dynamic members; grows/fades remain their own
  scale/alpha fields. Seven of twelve stock generated templates contain
  authored compact rows (counts 57, 47, 19, 37, 50, 39, 41); mode-zero templates
  can still acquire a dynamic Spider decal. Tutorial is also covered.
- Native Terrain polygons enter the same final target through a distinct
  `+0x8F24` owning grid, while compact records use `+0x8F84`. The browser's
  separately recorded missing Terrain contribution remains an explicit
  residual; every stock generated survival template has zero Terrain rows.
- `renderer/boneyard-dynamic-scene.ts` supplies both views with the same
  non-materializing player membership and places aperture then compact
  composite per player before Region/world. Existing black normal glyphs,
  `.75`/`1` source alpha normalization, sampler/UV, target dimensions, and
  painter ownership are not changed by the missing-RGB repair.
- `core-kernels/native-skill-colors.ts` owns reusable raw primary/Weld tables.
  `nativePrimarySpellTint` itself implements the other, saturated provider.
  `player-enchant-staff-presentation.ts` contains the same descriptor-family
  base tuples but packs too early (and rounds) for composing this formula.

### Native slot asymmetry and browser network boundary

Native Game has slot-indexed progression handles: Equip refresh
`0x00555999..0x005559A5` reads `Game + 0x1654 + 4 * Equip.slot` and then
that handle's Skills object. In the two Arena light callsites, however,
the provider is explicitly the slot-zero handle (`Game+0x1654` with no index),
while selected skill is global setting `12 + current player slot` and
position is `Game+0x1358+4*slot`. This is a real native caller asymmetry;
it is not proof that all native players share one Skills_Wizard instance.

The Website protocol retains distinct authoritative `player.progression`
records, and `world-player-view.ts` already computes Enchant Staff color from
that same player. The accepted network adaptation is to resolve effective
selected-primary and Weld build from the same stable player ID for both light
views, consistent with the existing per-player Enchant Staff adaptation.
This preserves the exact one-player contract without leaking the first
enumeration entry's or observer's Weld state into other participants. This is
explicitly a network ownership adaptation, not literal reproduction of the
native four-slot caller asymmetry. Tests must reorder/delete/re-add players
to reject accidental `Object.entries()[0]` ownership.

### Falsifiers and pre-code validation state

The parent-owned frozen Tutorial browser probe on baseline `1739a64` isolates
`native-compact-player-mask`: hiding only that composite changes 19,168 pixels
within `[625,275,988,527]`, concentrated on the visible puddles. Interior ROI
`[650,460,710,493]` falls from RGB mean `44.58/44.46/44.12` to
`6.68/6.55/6.19`; hiding only the aperture instead yields
`42.66/42.53/42.19`. Restore is pixel-identical and browser error arrays are
empty. Evidence: `remaining-softness/current-mask/receipt.json` and
`tutorial-pier-compact-mask-hidden.png`. This is an owner-isolation test,
not a matched native/generated-scene parity result.

Required minimal regressions before claiming closure:

1. Exact numeric table tests for five pure primaries, Plane, all 15 Weld builds,
   both sequential float32 desaturations, and truncating channel packing.
2. Both concrete consumers receive the same expected RGB; changing effective
   primary/Weld while resident changes tint without recreating or recoloring
   base/stamp art. Keep alpha/flicker, 14% aperture policy, target geometry,
   sampler, blend, region/mode gating, and ordering unchanged.
3. Cover all five authored selectors plus all three dynamic decal entries,
   mode zero dynamic masks, candidate-free removal, dead/materializing and
   re-entry lifecycle, and multiplayer identity/reordering.
4. Repeat the frozen Tutorial plate with only the source-derived RGB change;
   record tint, ROI delta, untouched control regions, full restoration, and
   empty browser errors. Compare a matched native state if available; the
   retained native Tutorial image has different dynamic tree/gate/light phases.

No production source edit, implementation pass, aggregate validation pass,
or publication is asserted by this pre-code evidence entry.


### RGB candidate disposition and bounded shared-sampling follow-up

The preceding pre-code state describes baseline `1739a64`. The coordinated
candidate now implements `nativePlayerGroundLightTint` in
`core-kernels/native-skill-colors.ts` and applies it on every update in both
`BoneyardEnvironmentLightView` and `PlayerMaskTarget`. The shared
`boneyard-dynamic-scene.ts` membership supplies each stable player's effective
Plane/primary selection and own Weld build. `boneyard-environment-light-plan.ts`
retains that progression ownership in its input type. The candidate includes
`native-skill-colors.test.ts` and `boneyard-player-ground-light.test.ts`, wired
through `frontend/package.json` and `frontend/tsconfig.test.json`.

Final source-level disposition for the recovered **RGB owner** is implemented
and focused-verified across both consumers, five pure primaries, Plane,
all 15 Weld branches, invalid-Weld ordinary-root fallthrough, and defaulted
nonnegative-row Ether fallthrough. All five compact records 139..143 and
Spider entries 140..142 retain the same final-composite color owner; base and
stamp alpha, target size, UV/filter/blend, 14% aperture policy, and flicker
remain the existing contracts. Per-player ownership remains the explicit
network adaptation above. The separately missing native Terrain-mask grid
is not repaired or claimed exact by this RGB correction. Full-system acceptance
is still pending the exact candidate's remaining canonical and real-journey
checks; focused verification is not a blanket native-parity closure.

Verified retained receipts, relative to `remaining-softness/`:

- `ground-light-tests-final.txt`: 16 tests, 16 pass, zero failures;
  `ground-light-tests-final-types-lint.txt` retains the focused type/lint run.
- `ground-light-colors-v2/receipt.json`: 31 real WebGL owner checks, including
  every palette, active/expired Planewalker, independent/reordered players,
  materializing/returning/departing peers, and context-loss recovery. All page,
  console, request, and response error arrays are empty; GL error is zero.
  `tutorial-pier-full.png` and `tutorial-pier-context-restored.png` are the
  associated plates in that same directory. Context recovery establishes
  retained tint/owner and a regenerated nonempty target; advancing flicker
  means this receipt does not claim identical before/after full-frame pixels.
- `canonical-receipt.json`: M2 `/opt/homebrew/bin/bash ./scripts/validate.sh`
  exited 1 at the known external-volume installation boundary, with source
  unchanged and lease released. This is a blocked aggregate gate, not a pass.
  No M5, built-game, deployment, or live acceptance is pre-claimed here.

#### Sealed native sampling and camera findings

The unrelated residual tree/grave/road softness question remains open at the
native-framebuffer comparison boundary. Raw evidence in `native-source-audit/`
now bounds the next test:

| Native evidence | Exact source | Supported conclusion |
| --- | --- | --- |
| Texture allocation | `0x00441180..0x00441329`, `CreateTexture` at `0x00441218` | Stock allocator explicitly requests one mip level; mode 0 is A8R8G8B8. A hidden native mip pyramid is not supported on this path. |
| Filtering | Device initialization `0x0043FCA6..0x0043FCD0`; reset `0x0041D108..0x0041D16B` | MIN and MAG sampler states are linear. At physical/logical ratio one, reset explicitly reinstalls linear; the alternate branch skips that reset rather than establishing nearest. This is not evidence for blanket native point filtering. |
| Vertex format and submission | FVF `0x142` at `0x0043FB71`; flush `0x0041D8F0`; append `0x00412D70..0x00412DE0` | XYZ + diffuse + one UV, stride 24. Append stores fractional float32 input x/y plus Graphics `+0x68/+0x6C`, then z/color/UV. No integer truncation or snapping occurs there. These are not pretransformed XYZRHW vertices. |
| Glyph UV and geometry | Constructor `0x00413DE0`; draw `0x004143D0` / transformed draw `0x00414450` | Leading source coordinates add `.5`; trailing coordinates are source extent plus `.25`. Draw offsets and transformed quads remain fractional. The current browser record UV helper preserves this source convention. |
| Screen projection | `0x00440890`, matrix stores `0x0044093F..0x004409D0`; submission `0x00440BA0` | The x/y orthographic terms are `2/W`, `-2/H`, translation `-1,+1`. There is no fixed half-pixel term in this matrix. Dispatcher index 2 sets D3D projection state 3. |
| Default Arena view restoration | Arena field restore call `0x0046EE6C -> 0x0057D5E0`; `0x0057D5EF -> 0x00421430`; `0x0057D658 -> 0x00420B10` | Restoring the default target rebuilds the screen projection, then installs centered scale one, which is the identity view. Centering by W/2,H/2 at scale one does not create a half-pixel offset. |
| Actual world-camera continuation | Arena renderer `0x0046EC80`, default-view branch `0x0046F081 -> 0x0046F32F`; camera translation `0x0046F333..0x0046F41A` | With feedback magnitude zero and base zoom one, the view update is skipped after identity restoration. Graphics translation receives authored Arena-center minus primary-view-center displacement, plus the separate world shake. No additional fixed half-pixel compensation appears in this default path. |

The raw receipts are `texture-allocation.asm`, `renderer-reset.asm`,
`vertex-append.asm`, `sprite-constructor.asm`, `native-quad-draw.asm`,
`d3d-device-initialization.asm`, `d3d-transform-dispatch.asm`,
`arena-render-entry.asm`, `region-field-restore-view.asm`, and
`renderer-view-scale.asm`. These are sealed-binary instruction findings, not
live transformed-vertex captures. The existing Mod Loader observation helper's
logical-to-screen scaling is derived capture metadata and must not be passed
off as a measured D3D device matrix or framebuffer sampling phase.

Browser `boneyard-world-renderer.ts` explicitly disables `roundPixels` and
installs the world transform from `nativeEnemyWorldFeedbackTransform` without
a fixed half-pixel correction. `native-sprite-record-texture.ts` preserves the
native record UV bias. Current Pixi `TextureSource` defaults are one mip level
and no auto-generated mipmaps, consistent with the stock allocation above.
The retained real-scene matrix `scene-reference-v2/receipt.json` passed direct
full-page tree/grave reference equality and compositor equality at all three
1600-by-900 physical rasters (1600x900/DPR1, 800x450/DPR2,
1280x720/DPR1.25), with source unchanged and no browser errors. Those controls
reject another browser cache/CSS resampling change; they do not compare the
browser sampling phase with D3D9.

A cross-API phase difference is therefore a **supported hypothesis**, not an
accepted fix. D3D9's screen pixel centers use integer coordinates, while the
normal OpenGL convention uses half-integer centers; unchanged projected
geometry and UVs can consequently sample a different point under linear
filtering. See the primary API references:
[Microsoft D3D9 texel/pixel mapping](https://learn.microsoft.com/en-us/windows/win32/direct3d9/directly-mapping-texels-to-pixels)
and [Khronos GLSL fragment-coordinate convention](https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.html).
The stock UVs are already center-biased, so copying a generic D3D9 tutorial's
negative-half-pixel fix would be an unjustified sign/ownership substitution.

Smallest falsifier: render one known stock glyph with recorded native final
quad, exact UVs, native raster dimensions, identity color/alpha, and no
secondary surface; preserve an actual native pixel crop. Reproduce that same
quad in the browser and compare current geometry against **only** a
`(+.5,+.5)` final-physical-pixel translation. At DPR other than one, convert
that physical offset at the final renderer boundary, not into a guessed
world-space anchor shift. Compare against native pixels and restore exactly;
then repeat one fractional/rotated quad before broadening membership. The
positive-half candidate follows from matching GL's half-integer samples to
D3D9 integer samples, but is not justified for product use until this isolated
native/browser reproduction passes. A browser-only image becoming sharper
is insufficient. No global offset, rounding, nearest-filter, or sharpening
change is authorized by this evidence.

Roads already use the native indexed owner mesh rather than a new browser
bake. Ground is the separately documented 512-square retail-editor field
capture/repeat policy (entry 272), not an exact native runtime field; authored
Terrain rendering is also a separately documented residual and absent from
all twelve stock generated templates. Neither supports treating every surface
as one texture-resolution defect. Large compact puddles are covered by the
proven RGB correction; rain `DeadHawg.24` is a separate additive actor.
