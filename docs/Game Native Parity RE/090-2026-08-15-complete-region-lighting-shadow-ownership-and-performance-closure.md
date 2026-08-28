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
