# 2026-08-15 — scenery complex-shadow silhouette closure

## Reopened failure and system boundary

The repeat report that some scenery silhouettes remained wrong reopens the
complex-shadow entry. The earlier pass violated the full-membership rule: it
ported exact tables for the reported Tree/Grave/Monument/Building families but
left an alpha-derived convex outline as the default for unknown objects,
broken FenceGrate, and Goodie states it did not recognize. Native never has a
generic "opaque sprite pixels cast" rule. That fallback made unsupported art
silently become a caster and selected Goodie geometry by visible atlas phase
instead of its stored subtype.

The system boundary is every direct reader of retail
`Game.ComplexShadows` at `0x00B3BCA9`, from common record production through
each class painter and the indexed-gradient submission. A fresh read-only
Ghidra xref census found 19 reads in 17 functions. Excluding settings UI and
four non-persistent actor/effect renderers, the scenery membership is:

| Member | Native owner | Disposition in this pass |
| --- | ---: | --- |
| Tree variants 0..14 | `0x00608AB0`, `0x0081B910` | `verified-already-at-parity` |
| Gravestone selectors 0..16 | `0x0060F260`, `0x0081BE50` | `verified-already-at-parity` |
| Fencepost selectors 0..6, styles 0..1 | `0x00612DC0`, `0x0081B0B8` | `verified-already-at-parity` |
| Monument selectors 0..20 | `0x0060E280`, `0x00819EE8` | `verified-already-at-parity` |
| Building selectors 0..3 | `0x0060EDC0`, `0x0081B430` | `verified-already-at-parity` |
| Goodie subtype 0, every visible phase | `0x0061F180`, `0x0081B390` | `exact-ported` — subtype, not atlas phase, selects the row |
| Intact FenceGrate | `0x00600ED0` | `verified-already-at-parity` |
| Moving Gate | `0x00600ED0` / `0x005ED100` | `verified-already-at-parity` |
| Rails | `0x00607440` | `verified-already-at-parity` |
| Wall | `0x0061E780` / `0x006561A0` | `verified-already-at-parity` |
| Broken FenceGrate | `0x00600ED0` / `0x005EC6E0` | `out-of-system` for the shipped `/game` templates: census is zero; its unrecovered shared-RNG half-segment is no longer replaced by an alpha hull |
| Scrub 2062 | `0x00620120` | `out-of-system` for the shipped `/game` templates: materialized census is zero; arbitrary imported/unknown objects no longer inherit an alpha hull |
| Road, Terrain, compact decoration, unknown object types | no persistent scenery xref | `out-of-system` — not native complex-shadow casters |

The current shipped membership census covers all twelve generated templates:
1,299 Trees (variants 0..6), 3,794 Graves (0..16), four Buildings (1..2),
44 subtype-zero Goodies, 230 intact grates, and 18 Gates. There are no Broken,
Rails, Wall, Monument, or Scrub members in those generated scenes; authored
content still uses the exact recovered programs where applicable.

Evidence provenance is the 4,723,200-byte retail `SolomonDark.exe`, SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`,
preferred image base `0x00400000`; fresh read-only pooled-Ghidra xrefs and
decompilation of `0x006046C0`, `0x00607440`, `0x006105F0`, `0x0061E780`, and
`0x00620120`; and the generated-template census at Website `origin/main`
`46b495b67a3d8e923e3535d1c3b26fdec4aea37a`.

Implementation consequence: the renderer has no alpha-derived fallback in the
complex-shadow caster selector. A class must select an extracted authored row
or one of the recovered custom programs. Goodie uses stored subtype zero even
when phase changes its visible DeadHawg record. Unsupported custom programs
remain non-casters instead of shipping a known-wrong silhouette.

## Validation contract

Regression coverage must prove every authored table cardinality, Goodie's
subtype/phase separation, all intact/Gate/Rails/Wall custom programs, and that
unknown objects and Broken bodies cannot fall through to alpha geometry. The
canonical Website gate and Windows Chrome/WebGL `/game` journey must then show
the generated-scene caster census, changing directional shadows, no page or
console errors, and no fallback caster marker.

Validation receipt: `./scripts/validate.sh` passed from the isolated Website
worktree (23 backend tests, 712 frontend tests, five desktop tests, production
build, and media-policy gate). Windows Node 22.17.0 driving Windows Chrome
through `smoke-boneyard-complex-shadows.mjs` passed in WebGL2 with no page,
console, or response errors. The synthetic scene produced five class-owned
casters; moving the light changed 1,245,758 pixels. The first generated stock
scene produced 14 visible casters and 50 projected quads. A second full gate
could not be executed natively on Windows because that host currently has only
.NET SDK 7.0.410 and 9.0.300 while the repository pins 10.0.302; this is an
environment limitation, not a Windows gate receipt.

## 2026-10-09 — Restore class masks and both scenery-shadow settings branches

### Reopened failure and evidence boundary

The owner reports overly square Grave, chest and Tree shadows. The earlier
closure recovered directional outlines but did not close the other branch of
the same class painters. Worse, runtime scenery still bakes the editor's
invented uniform ellipse beneath every object and post with either setting.
Tree's unconditional native root glyph is absent. This pass must preserve the
authored directional polygons while recovering their complete mask, settings,
and painter ownership. Polygon rounding, a blur, or an alpha-derived hull is
not justified by this report.

Evidence was re-read directly from the unchanged retail PE on the Mac mini,
without launching the executable or writing to the native workbench. Binary:
4,723,200 bytes, SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`,
preferred base `0x00400000`. Capstone x86-32 disassembly used PE section RVA
mapping. Existing ledgers 064/068/077/079/090 supply the previously extracted
tables, record rules and lifecycle; this section supersedes their claim that
the off branch was already represented by the browser's flat shadows.

| Source | Instruction-derived fact | Confidence |
| --- | --- | --- |
| Tree `0x00608AB0..0x00608F79` | Before the Complex Shadows test at `0x00608B20`, draw bank `manager+0x1A90`, index main variant, via `0x004143D0` at `0x00608B1B`: exact DeadHawg 228..242 root glyph. This is independent of canopy alpha, secondary selection, light records and the setting. | high |
| `0x004143D0..0x0041444C` | Ordinary registered glyph draw: bind texture, submit original vertices and UVs through `0x0041E990`, undo the temporary root translation. It is not only a bounds query. | high |
| Tree off `0x00608D11..0x00608F79` | Black opaque copy of main glyph 264+variant; optional secondary glyph 243+selector when enabled and main variant <=5, at root+(0,25). Each uses its own glyph height. | high |
| Grave `0x0060F461..0x0060F587`, Monument `0x0060E481..0x0060E5A7`, Building `0x0060EFC1..0x0060F0E7`, Goodie `0x0061F381..0x0061F4C0`, Fencepost `0x00612FF0..0x006131F5` | With Complex Shadows off, draw the class's actual glyph alpha, black with alpha 1; this is not a uniform oval or a directional polygon. Goodie indexes subtype*2+live phase; Building uses base glyph only; post style zero uses 36+selector, alternate style uses 320+selector. | high |
| Shared `0x00417060..0x004171E5`; constants `0x007DE8F0=.25`, `0x00784740=1.25` | Copy four registered glyph corners and all original UVs. Only top corners 0/1 receive `(height*.25,height*.3125)`; bottom corners 2/3 remain unchanged. Draw at the owner position. | high |
| FenceGrate off `0x0060180C..0x006018CA`, Rails off `0x00607A62..0x00607B17` | Bind loose fencegrate, retain class quad and UVs, shift top corners by `(10,10)`, draw black at alpha .5. Constants `0x007DE810=10` double and `0x007DE870=.5` float. | high |
| Intact builder `0x005E8100`, Rails builder `0x005F0EC0..0x005F16EA` | Intact retained quad is the already recovered inset-12, height-52 repeated surface. Rails uses inset-4 endpoints, three-unit heading+90 normal, a 14-unit top lift, original bottom edge and length/53.33333121405716 U span; preserve its top/bottom ordering test. | high |
| FenceGrate constructor `0x005E8065..0x005E808F`; Gate `0x005A9C60`, `0x005F73C0`, `0x005ED100`; Broken `0x005EC6E0` | Gate and Broken construction do not write inherited UV quad +0x18C, initialized to zero by the base constructor. Their off-branch uses the same loose texture, sampling transparent (0,0); all four wrap-neighbor corner texels are alpha zero. They do not gain a fabricated record-7/record-3 flat mask. Serialized raw runtime actor UV overrides are not an input of Website authored Fence records. | high |
| Wall builder `0x005EEF7E..0x005EF08D`, painter `0x0061E780..0x0061E85A` | Unconditional skirt uses connection-adjusted endpoints, then their copies shifted down 20; near color is opaque black and far color transparent black. It precedes the existing optional directional program and the Wall surface. | high |
| D3D device create `0x004400F9/FF`, `0x0044015C/62`; reset `0x0043FC43..48` | Windowed and fullscreen MultiSampleType and Quality are both zero. Native diffuse shade mode is Gouraud. There is no native multisampled mask target or active shadow blur to enable in the browser; ledger287's dormant blur remains dormant. | high |
| Website at `aff17b020941c5a200c9fadee5400b2f616c440e` | Editor runtime-base paints generic ellipses. Complex shadow presenter rejects Wall depth owners now under the pre-main base Container. Dynamic scene explicitly excludes Goodie placeholders; its live snapshot view has no directional or fallback shadow presenter. | high |
| Complete DeadHawg manifest, secondary bank 243..263 | Records243..250 contain the eight authored secondary glyphs;251..263 are empty. Native glyph helpers test enabled byte+4 and emit nothing for empty records. Every selector is retained in the inventory, including the no-op rows. | high |

### System boundary and membership inventory

Native system: persistent scenery auxiliary/shadow painters, their exact glyph
and custom-quad resources, both Complex Shadows branches, accepted Region
records and per-owner painter slot. It includes generated and imported authored
Fence/object members. The complete authored point tables remain unchanged.

| Member | Recovered correction / existing contract | Disposition after focused validation |
| --- | --- | --- |
| Tree main variants 0..14, root records 228..242 | Unconditional original root mask; on uses existing 15 outlines, off uses main glyph | native-parity ported; focused tests pass |
| Tree secondary selectors 0..20, main variants 0..5 enabled/disabled | Off adds own glyph with +(0,25); on does not add secondary mask; visibility fade does not scale shadows | native-parity ported; focused tests pass |
| Gravestone variants 0..16 / records 97..113 | Existing 17 outlines on; exact deformed glyph off | native-parity ported; focused tests pass |
| Monument variants 0..20 / records 156..176 | Existing 21 outlines on; exact deformed glyph off | native-parity ported; focused tests pass |
| Building variants 0..3 / records 148..151 | Existing four outlines on, including concave rows; base glyph only off | native-parity ported; focused tests pass |
| Goodie subtype zero, live phases 0/1/2 / records 145..147 | Same subtype outline on; current phase glyph off; live position/depth/removal ownership | native-parity ported; focused tests pass |
| Fencepost style zero selectors 0..6 and alternate glyph selectors 0..27 | Existing 14 direction-outline rows on (alternate selector modulo7); exact source glyph off | native-parity ported; focused tests pass |
| Intact FenceGrate | Existing custom bar/rail on; exact retained repeated textured quad off | native-parity ported; focused tests pass |
| Rails | Existing two-line directional program on; exact thin repeated quad off | native-parity ported; focused tests pass |
| Moving Gate, both leaves, every live endpoint pose | Existing directional program on; zero-UV transparent native off branch | verified-already-at-parity for off; existing moving-on program revalidated |
| Broken grate, both halves | Zero-UV transparent off branch; no invented hull. Exact local-RNG half geometry replaces guessed0.28/0.72 roots; original DeadHawg3 retained indexed main quad and stored directional endpoints share constructor state | native-parity ported; both halves and source-order goldens pass |
| Wall connected/disconnected endpoints, all orientations | Unconditional 20-unit gradient skirt and actual base-parent adjacency; existing custom directional program | native-parity ported; focused tests pass |
| Scrub2062 all19 glyph selectors, including Tree replacements15..18 | Existing exact glyph/deformation/reflection presenter from068; reuse shared flat-glyph corner helper | verified-already-at-parity; shared helper revalidated |
| Road, Terrain, compact decoration and unknown objects | No persistent scenery-shadow xref; runtime must not invent editor ellipses | native-parity ported; focused tests pass |
| Complex Shadows on/off/on, Complex Lighting on/off, Multiple Shadows | Root masks independent; exact branch selected per frame; no stale retained mesh after setting/owner/cull changes | native-parity ported; focused tests pass |
| Source/caster retirement, cull/reactivation, scene destroy | Current-frame accepted records; retained allocations only, borrowed native textures never destroyed by shadow views | native-parity ported; focused tests pass |
| Non-persistent actor/effect class-local underlays and masks | Separate actor systems, not this scenery dispatcher; unchanged | out-of-system |

### Implementation consequence and validation contract

Additional same-system extraction before the Broken port: vtable `0x00799AF4`
has builder `0x005EC6E0` and main painter `0x005E38C0`. The factory at
`0x0064AF29..0x0064B054` constructs the end half first, then the start half.
Each half creates a local RNG, seeded by hash `0x004FFFF0` of the low32 of
trunc64 `(postSelector+1+anchor.x+anchor.y)*(anchor.x*anchor.y)`. It consumes
signed Float20, signed Float20, unsigned Float18, exactly five words. There is
no unavailable global-RNG state. The selected endpoint sees post-selector
overrides through the current fence only. Its inward 52-unit tip plus first
perpendicular jitter is inset12 at both ends; the art quad applies second
along-line jitter and the32+third-draw top lift plus20. Shadow endpoints inset
that line another6, use step8 and trunc(length/stepLength)+1. The root is the
endpoint with greater Y (first on equality). The main painter draws only this
non-parallelogram DeadHawg3 quad with original UVs. The two instruction-derived
horizontal/oblique goldens supplied by the independent PE review pin every
float32 vertex, seed, shadow endpoint, step and root; these are source-derived
oracles, not a runtime screenshot. `0x0064B219..0x0064B233` also establishes
Rails' shared endpoint postStyle=1 regardless of which fence first introduced
the point, requiring shared census/main-art/on/off updates together.

- Add one retained scenery auxiliary presenter borrowing the already loaded
  original DeadHawg combat page and the exact loose fencegrate. No per-frame
  texture, canvas, alpha hull or blur creation.
- Remove the generic ellipse only from runtime-base; editor placement preview
  remains editor-owned. No stock runtime class receives that fallback.
- Keep authored directional geometry and alpha ramp unchanged. Support each
  owner's real parent (including Wall's pre-main parent) and insert masks,
  projected geometry, then the owner at the same depth and stable tie order.
- Goodie mask selection follows live phase while directional outline remains
  subtype-owned. Removing the live actor removes its shadows immediately.
- Pin every selector row, both settings branches, empty sources, Tree secondary
  gate and no fade dependency, custom fence orientations, Wall connections,
  equal-depth ordering, repeated on/off/on, cull/reactivation, moving Gate,
  dynamic Goodie phase/retirement and destruction of only owned buffers.
- Parent owns the exact-tree full Mac gate, browser masks/settings/imported
  scene journey, matched native-scale and responsive output, and performance.
  This instruction/asset investigation is not a new clean-stock runtime capture.


### Port and focused validation receipt

The complete in-boundary authored membership above is now implemented or
verified. The earlier Broken "out-of-system" claim is superseded: its
constructor-local RNG is reproducible, and both actual materialized halves are
supported. Native unsupported Goodie subtypes, invalid selectors and arbitrary
unknown-object silhouettes still fail closed or have no scenery painter. Raw
serialized actor-UV overrides are not an authored Region input supported here.

- Runtime base omits only the editor shadow loop, retaining Grave underlays and
  the same rule during cleanup repaint. No broad source-ID exclusion is used.
- The retained scenery presenter owns only its containers and geometry buffers;
  all original DeadHawg/loose-texture resources are borrowed. Tree root masks
  stay independent of main/proxy alpha, tint and wobble. Empty secondary records
  251..263 also no-op before proxy capture, avoiding imported empty-glyph errors.
- Live Goodie phase0/1/2, movement, depth, cull and retirement feed the actual
  owner, not the hidden static placeholder. A red on-only lifetime test exposed
  a retained-owner map leak; the corrected presenter has no dynamic map entry.
- Wall skirt and directional geometry use the actual nested pre-main owner.
  Auxiliary geometry precedes directional geometry and then the owner at equal
  depth. Stable repeated frames do not reorder both shadow layers back and forth.
- Shared Rails postStyle survives either fence source order and selects alternate
  main glyph320+selector, flat mask and modulo7 outline together. Broken uses
  construction-prefix selectors, not the later final post census.
- Broken runtime art is one retained native indexed mesh, using the original
  borrowed atlas glyph. No Canvas deformation/readback or separately antialiased
  triangle diagonal occurs in gameplay. Editor preview uses the exact two native
  triangle maps. The resident lifetime helper destroys every owned buffer while
  preserving borrowed texture ownership; owned pre-existing pixel textures still
  release normally.
- Existing directional tables, alpha ramp and stock no-MSAA raster contract are
  unchanged. Off-branch fence endpoint/vector stores now use the recovered
  float32 normalization boundaries.

Regression evidence: initial missing shared-mask module, missing Broken helper,
empty Tree proxy selector and default-on Goodie owner retention each produced a
focused red test before the correction. The final focused set includes
native-render-plan, native-broken-fence, boneyard-complex-shadows,
boneyard-scenery-shadow-presentation, native-scenery-shadow, native-scrub-shadow
and boneyard-scrub-shadow-presentation. Both added shadow suites and the Broken
suite are registered in canonical test:boneyard and tsconfig.test.json.

Live browser diagnostics at `window.__sdrBoneyardFrame.sceneryShadows` report
auxiliary familyQuads, directionalFamilyCasters, directionalCasterIds, live
Goodie ID/phase/branch/owner, active/pooled counts and painter-order mismatches.
Directional counts represent geometry actually admitted for current light
records; a selected on branch without a record correctly has no projected mesh.

Source inspection and focused tests establish the port, not a new native
runtime screenshot or end-to-end release certification. Parent-owned exact-tree
Mac gate, matched viewport/browser captures, settings/lifetime/imported fixture
and performance acceptance remain separately required. The shadow implementation
worker used no Windows or native executable launch; the later parent-owned
control-word observation is recorded separately below.


### Acceptance-driven corrections and precision qualification

The first parent-owned Mac Chrome candidate failed at startup because the new
Broken binding called nativeEnemySpriteRecord for DeadHawg3. That API is an
enemy-only selector allowlist, not the full original atlas census. The same
mistake would reject new Tree/root and flat-mask members. Both new binding sites
now use nativeSceneryGlyphTexture, validating source geometry and resolving
boneyardCombatAtlasSource against the already loaded original page. An exhaustive
binding regression covers every nonempty in-system glyph bank and confirms each
key is a nonempty generated atlas frame. No extra atlas pages or assets are
introduced. The focused atlas/mask/Broken/lifecycle20-test run and app/test type
checks pass after this correction; parent browser rerun owns runtime acceptance.

A final numerical challenge reopened Broken's seed precision claim: the earlier
instruction translation assumed intermediate x87 precision rather than observing
the active precision-control bits. For selector4 and anchor
(7979.3603515625,9309.3544921875), 64-bit-significand truncation differs from JS
double by one in the seed input. More importantly CreateDevice at0x004401E1
uses flags0x80 without D3DCREATE_FPU_PRESERVE; Microsoft's D3D9 contract sets
single-precision, round-to-nearest arithmetic by default. The executable's
FPU-write census only found game-side RC truncation scopes and a paired library
PC53 scope0x006C49DB/0x006C4A80, called within0x006A8F9E..0x006A9052. With PC24,
selector3 at(300,401) yields seed input84811504 rather than the current
intermediate-double84811500. The preceding universal Broken numeric-parity
claim was therefore qualified while awaiting a decisive native FPU observation
and the coherent instruction-rounding correction documented below. All earlier Python
goldens remain source-derived instruction translations, not native executions.

The separate parent-owned Windows observation subsequently measured the live
stock tutorial main-window owner thread: PID11844, HWND5637460, thread17456,
EIP0x7700379C. Both FloatSave and FXSAVE report CW0x007F, PC=0 (24-bit), RC=0
(nearest), WOW64 context flags0x10029. This is a post-D3D tutorial observation,
not a constructor-entry or geometry memory capture. The bounded observation
reported prior suspend-count0 and resume-count1; the capture owner separately
verifies UI resumed. Combined with shader-local paired PC53 scopes and no
persistent application reset, this establishes PC24 for the port. Two new
independently translated oracles at(300,401) and fractional coordinates around
(7979.3603515625,9309.3544921875) discriminate PC24 from the previous JS-double
expression. The implemented correction rounds seed adds/products, both squared
terms and their sum, sqrt and the count quotient, preserving explicit stores.
Both discriminating tests failed before that correction. Final focused result:
81 tests passed; app and canonical test TypeScript checks passed; focused lint
reported zero warnings/errors. The ordinary parent-owned Mac Chrome fixture
then admitted the expected live Goodie on/off/phase/removal states. Full final
browser/performance/gate receipts remain parent-owned.


### Directional raster and displayed-smoothness evidence boundary

The independent review re-read these instructions from the same hash-matched PE
on the Mac; these are source observations, not new GPU or framebuffer readbacks:

| Native range | Recovered raster contract |
| --- | --- |
| `0x00655970..0x00655F98` | Complete authored-outline projector submits black indexed quads directly. Endpoint alpha is multiplied by255 and truncated via `0x00747360` at `0x00655999..0x006559D0`; the packed byte occupies the color high byte. Four vertices retain base colors at+0x54 and tip colors at+0x78 (`0x00655DA2..0x00655F51`), then submit via`0x0041C540` at`0x00655F60`. There is no target allocation/bind or blur request in this complete function. |
| `0x006559E8..0x00655A09`, `0x00420030..0x00420138` | The projector requests texture-1 through`0x00420030(-1,0)`. The helper either binds null texture at`0x004200FE..0x00420110` or preserves a batchable atlas and its constant stored UV (`0x0042004F..0x004200C3`). All four vertices use that same constant UV. This is not a spatial soft-shadow texture. |
| `0x0046EE66..0x0046EE71`, `0x0057D5E0`, `0x00421430` | Arena finalizes the light target before directional object painters. Finalize calls`0x00421430` at`0x0057D5EF`; target-1 and normal viewport are restored at`0x00421442..0x00421452`. The scenery projector subsequently draws on the normal world target. |
| `0x0043FC43..0x0043FC49`, `0x0043FCB3..0x0043FCD1`, `0x0043FD11..0x0043FD2B` | Reset selects Gouraud shade mode, sampler0 MIN/MAG linear filtering, and SRCALPHA/INVSRCALPHA normal blending. Device creation's zero multisample type/quality is recorded above. |

The complete active shader/device xref inventory in canonical ledger287,
`287-2026-08-27-complete-stock-renderer-and-game-wide-vfx-reflection-reopening.md`,
provides the broader dormant-blur negative evidence; the projector reread alone
is not presented as an exhaustive search of unrelated call sites. Together the
pipeline and class evidence establish no separate low-resolution scenery-shadow
target or active soft-shadow blur to restore. The browser's existing256x1 alpha
ramp is an interpolation carrier for the packed endpoint alpha along each
projection. It does not create a spatially softened polygon boundary. Authored
straight edges remain with Complex Shadows on; arbitrary hull rounding, blur or
multisampling is not justified by these instructions.

A fresh parent-owned native screenshot establishes crisp composite foliage and
its layered source pixels. It is not a matched Grave/chest projected-shadow
comparison at identical light, camera and output scale. Instruction parity,
source pixels, matched browser baseline/candidate images and native screenshots
must retain their separate evidence roles. In particular, no claim of measured
native/browser Grave or chest shadow-edge smoothness equivalence is made from
that foliage screenshot.

Durable archive-relative references in the parent task evidence bundle:

- `native/evidence/x87-context.json`: the original stock tutorial control-word
  observation, including the executable SHA-256 and exact phase. Its initial
  resumed_verified=false records only the too-short 0.3-second CPU sample; it
  has not been overwritten or relabeled.
- `native/evidence/x87-resume-verification.json`: separate positive follow-up.
  The same HWND responds to WM_NULL, thread 17456 CPU ticks advance from
  2532343750 through 3274218750 to 4847187500, and resumed_verified=true.
  Prior suspend count 0 and resume count 1 balance. This closes the earlier
  observation uncertainty without altering the raw context receipt.
- `native/evidence/cleanup-receipt.json`: native process and adapter are gone;
  the original 16-file stock census is unchanged after private-copy cleanup.
- `native/evidence/windows-pe-range-hashes.json`: authoritative Windows byte
  hashes for Broken constructor 0x005EC6E0..0x005ECD29, factory
  0x0064AF29..0x0064B055 and Rails shared-post style 0x0064B219..0x0064B23A
  (exclusive ends). All three were independently recomputed from the Mac PE
  section mapping and matched byte-for-byte. The whole executable SHA-256
  likewise matches the source identity at the start of this reopening.
- `native/evidence/008-direct-input.png`: fresh native composite reference;
  use only for the screenshot conclusions above, not translated numeric
  constructor or projected Grave/chest pixel equivalence claims.

These paths refer to the copied task evidence/archive root, not to transient
M2 /tmp materializations or a modification of the protected native workbench.
The final runtime source remained frozen throughout this provenance update.

### Coordinated browser acceptance and release boundary (2026-10-09)

The maintained `tools/smoke-boneyard-complex-shadows.mjs` now hydrates its
fixtures from the current canonical simulation/snapshot defaults (the old
fixture omitted newer hit-feedback/puppet-hit fields). It exercises the real
renderer with six fixed states: on, off, opened-off, removed-off, removed-on,
and restored-on. Each checks actual root/mask family counts, live Goodie
phase/owner, admitted directional Goodie presence or absence, and zero painter
order mismatches. A removed live Goodie cannot pass by remaining in an on-only
caster set. Initial/restored pixel hashes are retained, but not asserted equal:
the untouched baseline itself has retained temporal pixel differences.

Uncommon members are exercised in a second scene with on/off/on and two
additional real player-light positions. The Broken-near position admits both
independent halves; the other positions cover Walls, Rails, FenceGrate,
Fencepost, Building and Monument. A distant family is not falsely required to
cast outside native light admission. Both branches and on/off/on restoration
pass in real M2 Chrome, including visible-window runs at density 1.5 and 2,
with no console/page/response errors. Original art pages remain unchanged.

The density experiment and its measured cap-2 decision are recorded in entry
026. A source-preserving diagnostic variant first proved that bound; the
untransformed final source must still pass the complete Mac gate and built
application journey before publication. The final gate, source identity,
browser acceptance, prior collision/status replay, and cleanup receipts are
external qualification artifacts under the M2-only archive
`20261009-sh9aksle-visual-parity`. They are the release authority; this document
does not turn a pending gate into a pass or claim publication occurred.

### 2026-10-09 — Retain unchanged live Goodie glyph plans

Allocation-only reopening of the restored Goodie OFF branch. Source review at
`d00d59b9` shows `BoneyardSceneryShadowPresentation.render` constructs a fresh
`nativeGoodieShadowPlan` for every visible chest on every frame. The existing
`paint` identity guard therefore misses even when subtype, phase and both
position coordinates are unchanged, issuing three Pixi buffer-update/revision
bumps. This establishes redundant CPU work, not three independent GPU uploads
or a measured frame-rate improvement.

The native contract above is unchanged: subtype zero, DeadHawg records
145/146/147 for phases 0/1/2, the exact flat-glyph fround deformation, original
texture/color/alpha, and the actual live painter owner. Unsupported subtypes
still throw in either setting. The bounded owner is the existing pooled
`ShadowView`; a scalar key may retain its immutable glyph plan only while that
same live depth owner owns the view. Pool activation clears the key. Native
simulation, assets, light/directional formulas and painter-slot logic remain
out of this allocation change.

Membership and validation contract:

- Phase 0/1/2 and independent x/y changes: recover the existing exact geometry,
  invalidate once per changed input, then keep stable buffer revisions.
- Fresh equal-valued snapshots and unrelated active/timer changes: reuse the
  same plan, typed arrays, meshes and buffers without revision bumps.
- ON/OFF, cull/return, removal/recreation, reused actor ID with a new owner,
  reparenting and equal-depth peers: preserve release, fresh native geometry,
  and current pre-main painter-slot work.
- Subtype zero and unsupported -1/1/2/NaN: preserve valid membership and the
  existing RangeError behavior, including immediately after a cached frame.
- Tree/Wall/static masks and all directional families: existing retained
  plans and shared pool behavior remain unchanged; existing regressions apply.

The implementation retains the scalar key only on the existing live pooled
view. Focused Mac tests first failed three new revision-stability assertions
on the unchanged baseline, then passed all 42 scenery/native/directional
shadow tests after the cache and a mixed chest-to-Tree-to-chest pool regression.
The repeated-frame test uses 240 fresh equal-valued snapshots; it checks all
three exact buffers, typed-array identities, revisions and native geometry.
Receipts are `chest-cache-red.log`, `chest-cache-green.log` (41 tests), and
`chest-cache-mixed-family-green.log` (42 tests) in the M2-only visual-tuneup
archive. These are focused receipts. Exact-candidate integrated qualification
and browser acceptance are owned by that archive's final report and receipts,
separately from this source-level contract.

The opt-in `SDR_SHADOW_PERF_FIXTURE=seven-chests-off` (or `seven-chests-on`)
extension to `tools/smoke-boneyard-complex-shadows.mjs` leaves the default dense
control and its native assertions intact. It adds seven visible
live chests with real snapshot/painter ownership in a labeled synthetic scene.
Seven matches the largest full-scene chest population in the 12 tracked native
generator outputs (3–7); concentrating them in one viewport is not claimed as
a native spawn arrangement. Compare exact RGBA, resource high water and native
lifetimes before timing a quiet same-machine ABBA run. Buffer-update reduction
is deterministic acceptance; report frame-time differences only when measured.
The probe archives RGBA SHA-256 and decoded-image-comparable PNGs for closed,
open, spent, moved, culled/returned, removed/recreated, directional and restored
states. Its exact-candidate browser execution and same-harness baseline pairing
belong to the archive qualification receipts; syntax or focused checks alone do
not establish runtime acceptance or an end-to-end performance improvement.
