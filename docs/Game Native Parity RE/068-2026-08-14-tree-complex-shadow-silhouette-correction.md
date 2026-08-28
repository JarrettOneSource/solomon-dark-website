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
