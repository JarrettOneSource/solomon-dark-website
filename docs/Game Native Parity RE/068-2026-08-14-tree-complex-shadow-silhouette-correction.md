# 2026-08-14 — Tree complex-shadow silhouette correction

## Reported discrepancy

Tree shadows in the browser visibly pop and spread from the canopy as large
black wedges. The first shared-shadow implementation deliberately used a
convex hull of each rendered main sprite while the class-authored outline
tables were still open. That approximation is not valid for Tree: stock casts
from a compact root/trunk footprint that is independent of the visible canopy.

## Native evidence and confidence

All static addresses below are from preserved retail `SolomonDark.exe`,
SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`.

| Finding | Evidence | Confidence |
| --- | --- | --- |
| Exact selector | `Tree::RenderBoundsAndShadow` `0x00608AB0` reads main selector `+0x140`, multiplies it by `0x34`, adds `0x0081B910` at `0x00608C85..0x00608C95`, and calls shared projector `0x00655970`. | high |
| Exact initialization | `0x005BF6A0` constructs fifteen shapes at `0x0081B910..0x0081BC1B`: vertices are appended by `0x006554B0`, translated by `0x006554F0`, then closed with edge normals by `0x00655570`. | high |
| Auxiliary-art relation | The same painter indexes manager bank `+0x1A90/+0x1A94` with the same main selector, proving the one-for-one `DeadHawg[228 + mainVariant]` mapping for variants `0..14`. | high |
| Secondary exclusion | The complex branch does not read secondary selector `+0x142`, secondary-enabled byte `+0x144`, or Tree visibility alpha `+0x150` to choose or scale the projected silhouette. | high |
| Variant lifecycle | Post-load materializer `0x006531B0` replaces stored Tree variants `15..18` with Scrub 2062, so an ordinary materialized Tree cannot index beyond the 15-entry table. | high |
| Browser fault reproduction | The focused WebGL proof at the current main revision shows the variant-0 shadow beginning at the full 204-by-271 main-art hull and projecting a canopy-width triangular wedge. The stock capture instead shows a narrow projection owned by the root footprint. | high |

The exact object-local Tree polygons are:

```text
 0: (-2,12)   (18,9)    (17,-8)   (-5,-4)
 1: (3,14)    (14,-3)   (-4,-13)  (-19,3)
 2: (1,9)     (15,-2)   (7,-13)   (-15,-3)
 3: (7,7)     (27,1)    (24,-16)  (4,-11)
 4: (5,10)    (12,-8)   (-3,-17)  (-20,-1)
 5: (-20,8)   (-12,-2)  (7,6)     (0,17)
 6: (-19.5,12.5) (-19.5,-12.5) (19.5,-12.5) (19.5,12.5)
 7: (-6,10)   (-6,-1)   (7,-1)    (8,10)
 8: (-6,10)   (-6,-1)   (7,-1)    (8,10)
 9: (-1.5,1.5) (-1.5,-1.5) (1.5,-1.5) (1.5,1.5)
10: (-1.5,1.5) (-1.5,-1.5) (1.5,-1.5) (1.5,1.5)
11: (0.5,2.5) (-2.5,-0.5) (0.5,-3.5) (3.5,-0.5)
12: (0.5,2.5) (-2.5,-0.5) (0.5,-3.5) (3.5,-0.5)
13: (-1.5,1.5) (-1.5,-1.5) (1.5,-1.5) (1.5,1.5)
14: (-1.5,1.5) (-1.5,-1.5) (1.5,-1.5) (1.5,1.5)
```

## Native contract and adjacent-system sweep

- Causal ownership: Tree main variant selects both the compact auxiliary/root
  art bank and the exact shape table; each accepted Region shadow record then
  flows through the existing shared radial projector immediately below Tree's
  main painter depth.
- Canopy separation: secondary art still owns viewer-local occlusion and
  lighting, but neither its variant nor its alpha participates in complex
  shadow geometry. Fading a canopy must not resize or fade its root projection.
- Variant adjacency: variants `0..14` are exact Tree selectors. Stored
  variants `15..18` cross the materialization boundary into Scrub and must use
  Scrub ownership rather than a Tree fallback or clamped Tree polygon.
- Setting adjacency: the secondary sprite can appear in the
  Complex-Shadows-disabled fallback for enabled variants below six. That
  fallback is a separate branch and is not evidence for canopy-shaped dynamic
  projections.
- Shared-caster adjacency: Gravestone, Fencepost, FenceGrate, and the remaining
  scenery family retain their common shadow records and painter-depth seam.
  This correction specializes only Tree's class-authored outline source.

## Implementation consequence and acceptance

- Export the exact 15-entry Tree table as immutable presentation data selected
  only by main variant. Reject unsupported Tree variants rather than silently
  clamping or reconstructing them from visible alpha.
- During resident construction, replace only a Tree main layer's alpha-derived
  outline with the exact variant polygon at the existing object position. This
  was the interim Tree-pass boundary; the later complete direct-reference
  census supersedes it and removes alpha-hull fallback from every materialized
  caster class.
- Add a red-first regression that pins all fifteen variant polygons, proves
  secondary variant/visibility cannot change the Tree caster, and proves an
  unsupported materialized Tree selector fails explicitly.
- Extend the real WebGL proof with Tree-specific diagnostics. Variant 0 must
  have a four-vertex `[-5,18] x [-8,12]` root outline, not a canopy-scale hull;
  moving the player across it must reverse a narrow projection with no page,
  console, or HTTP errors.
- Run canonical `./scripts/validate.sh` on the exact implementation tree and
  inspect the new screenshot beside the clean-stock capture.

## Bounded unknowns and falsifiers

- Exact Tree geometry is closed. Global stock presentation-RNG sequencing and
  the unextracted class-authored tables for other caster families remain the
  bounded unknowns from the shared-shadow entry.
- Falsifiers are any Tree shadow edge outside the selected four-point polygon,
  canopy/secondary art changing complex-shadow geometry, current Tree alpha
  fading the projection, clamping variants `15..18` to shape 14, a Tree-only
  simulation or protocol field, or regressions to non-Tree casters.

## Implementation validation receipt

- The focused regression was red first with the expected missing
  `nativeBoneyardTreeComplexShadowOutline` export. It now passes all seven
  shadow contracts, including every exact variant `0..14`, fresh owned return
  data, explicit rejection of variant 15 at the Tree-table boundary, and a
  32-frame proof that presentation jitter moves only projection tips while the
  root edges remain fixed.
- `boneyard-world-renderer.ts` now selects the exact table only for Tree main
  layers; alpha-derived convex silhouettes remain the bounded approximation
  for other caster classes. The observable renderer contract reports
  `treeComplexShadowOutline=native-main-variant-table`.
- On the exact working tree based on `19e9ac4`, canonical
  `./scripts/validate.sh` passed the backend build, all `23` Website/backend
  contracts, formatting, lint and architecture boundaries, all `466` frontend
  tests, all `5` desktop tests, both production builds, and production media
  policy.
- Chrome `150.0.7871.124` at `1600 x 900` exercised the actual Pixi WebGL2
  renderer. The focused variant-0 Tree reported the exact four-point
  `[-5,18] x [-8,12]` outline and reversed its narrow root projection as the
  player crossed it. The generated retail scene retained `14` casters and
  `14` records while dropping false canopy edges from `73` to `59` quads; its
  30-frame final-main average was `4.52 ms`. The direction change affected
  `1,264,443` pixels with `104,431,818` aggregate RGB-channel delta. Page,
  console, and HTTP error lists were empty.
- Visual inspection against stock
  `boneyard-re-direct-mode0-settled.png` confirms both now project from the
  Tree root rather than the canopy. Before/after receipts are
  `/tmp/solomon-dark-tree-shadow-before-left-20260814.png` and
  `/tmp/solomon-dark-tree-shadow-main-left-20260814.png`; the opposite-source
  and generated-scene receipts are
  `/tmp/solomon-dark-tree-shadow-main-right-20260814.png` and
  `/tmp/solomon-dark-tree-shadow-main-generated-20260814.png`.

## October 7 editor preview: missing post-load materialization

An actual imported Shrike Gardens2 file reached the Tree caster with main
variant17 and failed closed. The existing fifteen-shape table was correct; the
imported runtime projection had skipped the lifecycle rule already recorded
above. This reopens the materialization member, not Tree shadow geometry.

Fresh full006531B0 extraction from the same retail binary confirms: class2001
with signed short main selector15..18 creates a NEW class2062 Scrub, copies only
position, writes the same selector to its i32 variant field, assigns world
ownership and clears byte+36. The original Tree is retired through virtual+18.
The replacement is appended through the region object manager+2B4 virtual+10;
other original residents retain order and Scrubs append in original Tree
encounter order. Do not clamp selectors or reuse a Tree polygon.

Scrub constructor005E4040 has zero body radius and zero+13C/+144, false+14C,
ordinary white/unit Puppet appearance, and independent randomized phase+134.
Old Tree rotation, scale, tint, secondary art and other fields do not transfer.
Main sprite function006200B0 uses the same variant and DeadHawg bank264..282
with a position-only Glyph_Draw. Native editor storage remains class2001; only
the runtime projection changes. Runtime Scrub shadow function00620120 is a
separate branch, not permission to assume Tree complex shadows.

The correction must cover all four replacement variants, intact0..14 Trees,
ordering, non-mutation of authored data, no inherited Tree collision or primary
spell target, stable runtime hashes, imported maps, private tests and older web
save scene projections. Existing shadow polygons and invalid-Tree guards stay.

The exact Scrub function and raw PE constant evidence is retained in
[editor-native-scrub-projection-2026-10-07.json](editor-native-scrub-projection-2026-10-07.json).
Fresh00620120 confirms a dedicated same-glyph shadow family: a black flattened
sprite when Complex Shadows is off; otherwise per-ShadowData textured quads,
with lazy glyph-height initialization, a three-position surface predicate and
presentation-only sway. Class2062 must not be treated as a shadowless Tree fix.

### Scrub renderer ownership and freshly verified shadow facts

`0x00B3BCA9` is the Complex Shadows setting (entry130), independent of
Enhanced Effects. Scrub must preserve its basic class-shadow branch when this
setting is off. It must not retain the editor's generic baked oval, any Tree
caster polygon, or a Tree canopy/proxy. Runtime main art retains the full
registered glyph rectangle so the directional shadow samples original UVs
without a second alpha crop.

Fresh helper/assembly recovery confirms the advanced branch initializes+144
from UV height times float0.20000000298023224. For each 0x24-byte record it
starts a matrix, applies Scale(min(10*record+18,1),1,1), rotates by the source
vector heading, then applies Scale(1,0.800000011920929,1). It transforms only
glyph corners2/3. Their UV-y values lose+144. Each transformed near corner
receives20*direction; farcorners0/1 equal corresponding nearcorners2/3 plus
(10*record+18*record+18*record+1C)*direction. The helper0041EAE0 takes
transparent black for farcorners0/1 and opaque black for nearcorners2/3.
The subsequently recovered matrix composition, heading convention and
record-field mappings are recorded below and implemented without hulls.

Constructor005E4040 initializes phase+134 with Int(360); tick005E40D0 adds
Int(3) once per native tick after the common Puppet tick. This phase is visual
state, with no gameplay authority. Website may use its existing independent
presentation RNG convention, preserving the exact native integer draw kernel,
phase progression, fixed-tick freeze, and lifetime; matching the global retail
presentation stream is the existing explicit bounded difference.

Fresh0057F0E0 maps record+18 to distanceFraction and+1C to
projectionDistance.00402D40 pre-multiplies matrices and004031E0 applies
column-vector XY. With k=min(10*distanceFraction,1) and
θ=atan2(direction.x,-direction.y), normalized to0..360 degrees, an original
bottom glyph corner(x,y) becomes:

- nearX=cos(θ)*k*x-sin(θ)*y+20*direction.x
- nearY=0.800000011920929*(sin(θ)*k*x+cos(θ)*y)+20*direction.y
- far=near+10*distanceFraction²*projectionDistance*direction

Basic00417060 offsets only topcorners0/1 by(height*.25,height*.3125),
keeping bottomcorners2/3 and all original UVs. The three lazy cached surface
queries are position,(x,y+10),(x,y-10):007DE840 is exactlyzero. Reflection
uses a separate glyph (manager+104C), white alpha0.3499999940395355, and
uniformscale0.25*lookup00452C00(phase/3)+0.6000000238418579. The exact glyph mapping is closed below. Arena004677A0 Terrain production
and bridge subtraction are tracked separately by the shared surface port;
compact-only queries alone do not establish imported Terrain parity.


### Completed Scrub reflection recovery (October 7)

The exact bundle-stream trace of `004E8A90` through the read-only replica
wrapper maps call `004E8E93`, manager inline glyph `+104C`, to DeadHawg
record **21**, independent of the Scrub variant. The trace drains all 348
DeadHawg records and confirms the main bank `+1AB0` is records264..282.
`00452C00` returns the absolute value of float32 `_CIsin 007470D0`
(the sine identification and FSIN instruction are already independently
retained in ledger219). The input `006202EE..0062030B` is float32 of
integer phase divided by3, in radians. Reflection scale is
float32(abs(float32(sin(float32(phase/3))))*.25 + float32(.6));
alpha is float32(.35), tint white, position the owning Scrub origin.
The dedicated reflection plan and borrowed-texture delivery are exact-ported
and verified in the focused real-WebGL proof below.

`004677A0` first tests the Terrain quad grid `+8F24` with `004118B0`
(two triangles0/1/2 and1/3/2). On a hit, any admitted subtraction
quad from Arena `+8B54` (count+8B5C, buffer+8B68) returns false
immediately, otherwise true. Only without a Terrain hit does it test
compact grid `+8F84`. Existing compact contours remain exact. The
Terrain/subtraction producer and imported scene projection are being
closed before this wider surface query can claim parity.


The runtime projection also retains Terrain's already-decoded profileSamples
and sideSign. Dropping these native wire fields prevents exact shared surface
membership for the Scrub reflection predicate. Forwarding them does not itself
close the separate Terrain construction/subtraction recovery or visual gate.


### Scrub renderer verification (October 7, 22:16 UTC)

The dedicated `NativeScrubShadowState`/`BoneyardScrubShadowPresentation`
owns this complete branch inventory:

| Member | Disposition | Evidence |
| --- | --- | --- |
| Replacement variants15,16,17,18 / glyphs279..282 | exact-ported | Four explicit geometry/anchor/UV tests; all four actual textures in WebGL |
| Complex Shadows off, either lighting setting | exact-ported | Flat glyph corners/black opaque vertex colors; native top-corner offsets; screenshot `scrub-flat.png` |
| Complex Shadows on / accepted light records | exact-ported | Exact float32 directional transform, five source directions, near compression, opposing-light WebGL images |
| Zero lights / Complex Lighting off | exact-ported | Empty directional cohort; independently cached surface reflection remains |
| Lazy three-point query | exact-ported | All three points called once, cached across settings, exact center/(0,+10)/(0,-10) offsets |
| Native reflection record21 / scale / alpha | exact-ported | Independent glyph geometry, radians sine/f32 tests, frozen-tick and moving-tick tests, actual WebGL |
| Off-camera/retired owner / painter adjacency | exact-ported | Detach/restore with zero depth mismatches; no stale shadow source or generic oval |
| Teardown | exact-ported | Actual mesh destruction plus GPU unload then geometry destroy; all owned buffers destroyed, borrowed textures retained |
| Imported Terrain/bridge predicate | recovered-pending-port | Separate shared surface implementation owns exact production and acceptance; no fixed-width editor-stroke inference |

The exact M5 working tree passed24/24 focused Scrub/presentation/asset
contracts and `tsc -p tsconfig.app.json --noEmit`. The real Chrome-for-Testing
WebGL proof produced four directional quads plus one independent reflection,
then four flat quads when the setting was disabled, one reflection after all
light sources were removed, and zero quads when culled. Restoring visibility
reused the retained allocation with zero painter-order mismatches. Page,
console and failed-response arrays were all empty. Both directional and flat
screenshots were visually inspected; the projected images retain glyph alpha
silhouettes and contain no invented root/canopy hull.

Disposable evidence on M5 lives under the parent task's `browser/` directory:
`scrub-proof.json`, `scrub-complex-left.png`, `scrub-complex-right.png`, and
`scrub-flat.png`. Browser job `job_20261007T221541Z_3bdf799974` completed
exit0 at22:15:58UTC; its task-owned server and heavy lease were released.
A first harness attempt loaded Pixi twice via mismatched versioned URLs; it
was corrected in the disposable harness only, then the complete proof and
type gate passed. The parent owns the final integrated imported-map journey,
canonical gate and publication; this focused receipt does not claim those.

### Imported-map integration acceptance (2026-10-07)

The built editor loaded the original `Shrike Gardens 2 by soggy.boneyard` without
modifying its bytes:307 objects,351 sprites,59 roads,20 fences, no Terrain. Private
Test reached the ready renderer with geometry SHA
`430ff44c91c23e5a52836f8bc5f9a11210fd19bd801377c14fd584c6e0f2e705`,
then Return restored the complete draft exactly. The same built browser also
passed placement, movement, repeated Test/Return, admission cancel, service
failure, retained camera/history, narrow and short viewports, and quota-safe
export. The desktop editor and live imported-map screenshots were inspected.
Focused projection/catalog/Scrub/Terrain/asset tests, test TypeScript, frontend
lint, production frontend build and Release backend build passed together.
This verifies the disposable layout preview; full authored script/recipe/timeline
execution remains a separate active implementation slice.
