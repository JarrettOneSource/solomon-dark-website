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
| Live environment grids | trace of `0x00588040` plus Arena `+0x8AF4/+0x8F24/+0x8F84` | Retail queries the general spatial grid and both player target grids every frame. Both target grids were empty in the generated run. Offset xrefs identify `Anim_DeadSpider::Tick 0x00461740` as their only concrete producer. | high |
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
| optional DeadHawg-9 target pass | Arena `+0x8F24/+0x8F84` | `out-of-system`: only `Anim_DeadSpider` populates these grids and Website has no Spider/DeadSpider actor | live target counts zero; no unconditional replacement mask |
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
| `Arrow 0x0079C7E4`, `Firebolt 0x0079CAD4`, `DarkFireball 0x0079D144`, `Silk 0x0079D294 -> 0x005E6140` | radius `.5+S(.25)` with class-owned intensity/flag | `exact-ported` by this correction for fire Arrow/Firebolt; dormant siblings remain catalogued |
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
- Intentional difference: the Website's post-world direct player aperture is
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
  Effects remains fixed on; Spider/DeadSpider target-grid masking has no web
  actor; and Wall silhouette/decor remains the already-recorded approximate
  geometry debt. No additional in-system lighting discrepancy remained after
  the final membership and callsite rescan.
- Publication state: implemented and validated in retained task worktrees only.
  No commit, push, deployment, or live-production claim is made.
