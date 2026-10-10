# 2026-08-27 — Arena base-field omission and black Boneyard regression

## Current field-identity qualification

The 2026-08-27 account below is retained as historical regression evidence.
Its attribution of field globals to DeadHawg 20/21, the 200-unit lattice,
and the resulting white-rectangle explanation are **superseded** by the
[2026-10-10 recovery](#2026-10-10--recover-the-original-field-bank-and-shared-consumers).
The actual globals select opaque 350-by-350 records 11/12. The earlier
experiment used the wrong crops; it is not a failure of the native field.
The captured-ground override was the published implementation at the verified
baseline `8ee2fcae97018631215ae6bd145be57e646c08fc`. This candidate replaces it
in gameplay and authoring using the recovered records. Source, transport and
coverage qualification below do not establish whole-scene material parity.

## Reported smell and parity question

- Reported web behavior: a Boneyard that looked correct earlier in the day is
  now almost entirely black after a recent push. Props, actors, HUD, and small
  authored surface islands remain, but the lit ground disappears.
- Exact regression boundary: Mac Chrome rendered the same frozen mode-0
  Building/Monument fixture at `ced3632a` and `ec98c44e`. Before the latter
  commit, the player light reveals continuous ground. After it, identical
  Region-source diagnostics reveal only actors and props over black.
- Stock behavior to recover: Arena's complete base-field family — opaque clear,
  mode-selected DeadHawg 20/21 lattice, normal source-over fragment path,
  the immediately following Arena `+0x110` pass, both Region-composite
  branches, and teardown.
- Falsifiers: the `ec98c44e` boundary does not reproduce the black frame; the
  field calls select a non-normal blend; raw field submission restores the
  earlier Website visual without white mattes; or the tracked ground capture
  is a native runtime asset.

This reopens the 2026-08-27 Arena field/Road entry above. That pass correctly
removed Canvas2D Road approximations but removed the known-good continuous web
ground before the complete native Arena surface owner had been mirrored.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Mac differential | clean detached Website `ced3632acc5e87ae744dd7237031a3e258735433` versus `ec98c44ec5001802946289e833a3df5a0e8010fb`; `smoke-boneyard-building-lighting.mjs`; 1600x900 Chrome/WebGL2 | The same fixture changes from visible lit ground to black ground at the surface commit. Both runs retain one player source, Region multiply, four Buildings, 21 Monuments, and empty browser-error arrays. | high |
| Current source | `native-boneyard-surface-view.ts`, `boneyard-world-renderer.ts` at `origin/main 0bf893b6` | The surface root contains Roads only. The application clears opaque black, and the post-Road resident bank has only authored Terrain/compact pixels. DeadHawg 20/21 are neither preloaded nor submitted. | high |
| Retail identity | `SolomonDarkAbandonware/SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Matches the canonical analyzed retail 0.72.5 image. | high |
| Arena instructions | canonical read-only Ghidra replica; `Arena::Render 0x0046EC80`; calls `0x0046F528 -> 0x004142E0` and `0x0046F651 -> 0x004142E0`; Region composites `0x0046FAFA` and `0x00470102` | Mode 0 draws record 21; modes 1/2 draw record 20. Every field draw precedes RegionLayout and both Complex-Lighting composite branches. | high |
| Renderer state | reset `0x0041D000`; dispatcher `0x004208A0`; Arena writes `0x00470318/0x00470397`; main-target restore `0x0057D5E0` | Blend request starts at selector 0 (`SRCALPHA,INVSRCALPHA`). Arena's only blend writes select multiply later and restore selector 0 before return. No state write occurs between target restore and field draws, so the field is ordinary source-over, then Region-multiplied. | high |
| Asset/data | DeadHawg records 20/21, static Sprites `0x00B2F2A4/0x00B2F368`; tracked crops SHA-256 `0d82c1db7df1f92aaa7e0a34c79350fabbd6de24a4f97ae444cd8c3379a0a950` and `040c2efb55dd57daf68b52b8108aea98a7c053567cebcbd62a008107a5e33db5` | Record 20 is a 102x77 inverse oval used on a 200-unit lattice; record 21 is a 43x35 black alpha ring registered inside a 200x200 logical cell. | high |
| Native sibling | `Bonedit::Render 0x004D5F40`, draw `0x004D6223` | Bonedit always uses record 21 on the same 200-unit lattice. It confirms shared record/registration ownership but is not a Website `/game` scene. | high |
| Live debugger | task-owned loader session, retail image base `0x000C0000`; WinDbg breakpoints at runtime `0x0012F534/0x0012F65D` (preferred calls `0x0046F534/0x0046F65D`) | Both record-21 and record-20 calls have white `0xFFFFFFFF`, blend selector/cached selector zero, texture-stage selector zero, and saturation request/cached value `.65`. The source-over conclusion is confirmed live. | high |
| Browser falsification | first exact-field candidate in the frozen fixture and deterministic real Boneyard | Raw record 20 below the Region composite produces exposed white 102x77 rectangles in both frames. The candidate is rejected; the field call cannot be ported alone as the complete base surface. | high |
| Arena vslot ownership | live Arena vtable `+0x110` resolves to preferred `0x00470EE0`; caller `0x0046F6BE` is immediately after the field loop | `0x00470EE0` is not merely a late player aperture. It is a large Arena surface/object pass containing three manager families, compact spatial results, per-player environment work, nested targets, and restore paths before Region multiplication. The previous ownership statement was incomplete. | high |

The static addresses use the canonical read-only project. The live supporting
session used the same retail hash with image base `0x000C0000`; preferred and
runtime addresses are kept explicit above. Loader injection supplied debugger
access only and is not treated as clean visual evidence.

## System boundary and membership inventory

The native Arena surface system remains reopened because the complete
`0x00470EE0` membership is larger than the previously documented direct-light
branch. The user-requested repair boundary is the Website regression itself:
restore the exact pre-`ec98c44e` visible ground policy without reverting the
new exact Road mesh or mislabeling the policy as retail runtime parity.

| Member / branch | Source | Disposition for this repair | Proof contract |
| --- | --- | --- | --- |
| known-good continuous web ground | tracked `arena-ground.webp`, SHA-256 `dabc48e7af0220283889647f57cde6442aecc79629555ce9104815ebadbdb070` | exact-ported Website policy | one world-anchored repeat mesh under Roads and Region light |
| modes 0/1/2 | prior Website runtime behavior | exact-ported Website policy | the continuous web ground exists in every generated mode, as before the regression |
| Road styles 0..4 | `0x0064C1F0/0x00640750` | verified-already-at-parity | exact indexed meshes remain above the restored ground |
| Terrain and compact authored detail | existing post-Road resident bank | verified-already-at-parity | unchanged above ground/Road and below Region light |
| Region raster/analytic lighting and both composite branches | existing lighting owner | verified-already-at-parity | restored ground is multiplied and sampled by the existing paths |
| raw DeadHawg 20/21 field submission | live-confirmed native calls | out-of-system for this repair (incomplete without the full `0x00470EE0` pass) | rejected browser frames are retained as falsification, not shipped |
| complete `0x00470EE0` manager/compact/player/nested-target family | Arena vslot `+0x110` | out-of-system for this repair (separate reopened native closure) | no partial second port or completion claim |
| Bonedit record-21 sibling | `0x004D5F40/0x004D6223` | out-of-system (native authoring scene) | unchanged editor behavior |
| replacement/failure/destroy | Website surface owner | exact-ported Website policy | one mesh/texture owner, no per-frame allocation, exact teardown |

No member is browser-blocked. The predicted visible difference is explicit:
the repaired Website keeps the earlier continuous retail-editor-derived ground
in modes where a fully mirrored retail `0x00470EE0` surface may differ.

## Native ownership thread and corrected consequence

- The raw field facts are confirmed: mode 0 uses record 21; modes 1/2 use
  record 20; both are ordinary source-over under `.65` saturation.
- The prior ledger placed `0x00470EE0` late and described only its per-player
  light branch. The live vtable and caller prove it begins immediately after
  the field loop and before the Region compositor. Its earlier manager loops,
  compact spatial render, nested target work, and later player branches are one
  Arena owner.
- Porting only the raw field was therefore another partial-system mistake. Its
  white rectangles are not acceptable even though its individual Sprite call
  is instruction-accurate.
- The user's requested observable is the known-good earlier Website surface.
  This repair restores that tracked field capture as an explicitly named web
  policy layer, then preserves exact Roads, authored detail, Region lighting,
  shadows, saturation, HUD order, and teardown above it.

## Confidence and open questions

- Confirmed: regression commit, before/after pixels, field records/calls/state,
  live image base, immediate `0x00470EE0` ownership, raw-field visual failure,
  and exact prior Website ground bytes/order.
- Unknown outside this repair: the complete class/list disposition of every
  earlier and nested branch in `0x00470EE0`. No native-parity completion claim
  is made for that reopened system.

## Web implementation consequence

- Add one Arena-bounds mesh using the tracked 512x512 repeat texture before the
  exact Road root in `NativeBoneyardSurfaceView`.
- Run it through the existing Arena fragment shader and Region-light boundary;
  preload/destroy it under `BoneyardWorldTextures` with no frame allocations.
- Publish `retail-editor-field-capture-web-override` diagnostics so the policy
  cannot be mistaken for a newly extracted retail texture.
- Do not submit DeadHawg 20/21, reintroduce Canvas2D Road approximations, alter
  light constants, or disturb Terrain/compact, actor, shadow, HUD, gameplay,
  audio, or network owners.

## Validation contract

- Focused tests pin the ground SHA-256, Arena-bounds quad, world-anchored
  512-unit UV repeat, full-white vertex input, ground-before-Road order, native
  surface shader, and teardown.
- The 1600x900 WebGL2 differential must turn the exact lit empty sample from
  `0` non-black pixels into textured ground, require more than eight distinct
  RGB values, and reject maximum RGB totals at or above `700` so neither the
  black regression nor raw white record-20 mattes can pass.
- Real Tutorial/default Boneyard captures must show continuous textured ground
  with no white rectangles, while exact Road/Terrain/compact/Region diagnostics
  and empty page/console/failed-response arrays remain.
- The exact rebased Mac candidate must pass focused tests and
  `/opt/homebrew/bin/bash ./scripts/validate.sh`.

## Implementation validation receipt

- Causal result: Website `ec98c44e` removed the continuous web ground while
  deliberately excluding DeadHawg 20/21. The exact Mac A/B reproduced the
  user's black frame. Static and live tracing then proved the raw fields are
  source-over, but live vtable ownership reopened the much larger immediate
  `0x00470EE0` Arena pass. A raw-field candidate was rejected after both the
  empty fixture and real Boneyard exposed white 102x77 rectangles.
- `NativeBoneyardSurfaceView` now owns one immutable Arena-bounds ground mesh
  before its exact Road root. `BoneyardWorldTextures` preloads the tracked
  512x512 field capture once with repeat addressing. The mesh shares the Arena
  fragment shader and Region-light boundary; Terrain/compact, actors, shadows,
  weather, HUD, simulation, audio, protocol, and network code are unchanged.
  Diagnostics label it `retail-editor-field-capture-web-override`, and both
  mesh/texture owners are destroyed with the Boneyard renderer.
- Red/green Mac WebGL2 evidence is direct: the broken candidate sampled
  `0` non-black pixels and RGB total `0` at a lit empty point. The repaired
  candidate samples all `289` pixels as non-black, with `170` distinct RGB
  values, RGB total `40,196`, and maximum RGB total `291`; the same oracle
  rejects the raw white field at maximum `>=700`. Four Building variants and
  all 21 Monument variants retain their light-dependent pixel deltas and zero
  base/roof color mismatch. The reviewed focused frame SHA-256 is
  `56e74a3832e18a4156be7c7c74003bee8b7fd862f17c7d9c45329943b824da55`.
- The rebased Mac focused matrix passes 51/51 surface/render contracts plus the
  complete TypeScript test configuration. The first canonical
  `/opt/homebrew/bin/bash ./scripts/validate.sh` pass completed 27 backend/
  Website contracts, all registered frontend/host suites, 77 ML tests,
  production builds, media policy, and bundle budget (`251,319` raw /
  `76,426` gzip); log SHA-256 is
  `2cd7b7786e76c85acbb448cf8e7ea65d8605a0b0088e100da7eda2b438edf4ca`.
  The exact post-receipt/tool tree is rerun at
  `/Users/jarrett/codex-acceptance/boneyard-lighting-regression-20260827-final/validate-final.log`.
- The paired Mod Loader registered static RE suite passes 522/522 on the Mac;
  log SHA-256 is
  `bbcb34c3f86e64ddce1c5ef3beb584aa1123a8ca60aa1695b4267504da632f26`.
- Production-build Chrome completed the deterministic Solomon opening with
  status `ok`, 38 active Road meshes / 684 indices / 304 vertices, and empty
  page, console, failed-response, and wire-error arrays. The inspected speaking
  and dirt frames show continuous textured ground with no raw white rectangles;
  SHA-256 values are
  `4b2cc9f45ad11aa35e9b964ff6a14d8ec8c8f979014a1bbcce23cb1786982b8d`
  and `3292164046abe5edc14d11a6838ac5b41db2bfbdb2836fef87bc51dbeafe9805`.
  Browser-log SHA-256 is
  `2e483c989ede361a6ef2cb7d427bb17687f6f0f52187eafc1d8b6c0177c83170`.
- No browser constraint blocks this repair. The one explicit predicted stock
  difference is the restored, earlier Website continuous ground policy while
  the broader native `0x00470EE0` surface family remains reopened. No push,
  deployment, production cutover, or service restart was requested or
  performed.

## 2026-10-10 — Recover the original field bank and shared consumers

### Reported smell and parity question

The requested visual pass includes crisp faithful ground and smoothly blended
shadows. The published broad field still enlarges a 512-by-512 editor capture,
although the original gravel assets and exact atlas pages are available.
Recover the complete mode-selected field family in gameplay and its Bonedit
authoring sibling before replacing that override. A matching source image is
necessary but does not prove final native lighting or composition.

### Evidence and provenance

All instruction addresses below are preferred addresses in retail 0.72.5,
image base `0x00400000`, executable SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`.
Retained instruction bytes were rechecked against that exact executable.

| Evidence | Recovered fact | Qualification |
| --- | --- | --- |
| Asset initializer `0x004E8A90`, sequential Sprite loads `0x004E8D21/0x004E8D46` | DeadHawg's byte-zero bundle stream populates the field globals with its twelfth/thirteenth records: zero-based 11/12. | Instruction- and bundle-derived; live descriptor confirmation pending. |
| Complete bank audit | All 348 bundle rows parse to EOF; all 56 initialization destinations (33 embedded and 23 dynamic banks) agree with the existing object map. | No general off-by-nine correction. Other consumers of actual 20/21 and grave/tree banks must remain unchanged. |
| Bank layout | `0x00B2EA00 + 0x38 + 11 * 0xC4 = 0x00B2F2A4`; the next record is `0x00B2F368`. | The missing header caused the erroneous consumer narrative, not a special compiler-folded bank. |
| Original atlas | `boneyard-combat-atlas-2.png` is byte-identical to stock `images/DeadHawg.png`, 2048 by 2048, SHA-256 `3758ce24d516f0ca6349e57b988d8a84e8d6f89fb3827856d7bb521618281af0`. | Existing generated rows already preserve both exact source rectangles. No art regeneration is needed. |
| Resolution selector `0x004136F0` | This stock implementation destroys its string argument and unconditionally clears AL at `0x00413749`. The initializer therefore uses ordinary DeadHawg, not an inferred optional `@2X` path. | The stock folder contains only the ordinary bundle/page. The load routine's false return can also be a normal reuse gate when reference count exceeds one. |
| Field loop `0x0046F423..0x0046F6B2` | Mode byte `Arena+0x8F20`: 1/2 select record 11; all other bytes select record 12. Both branches step and cull using record 12's logical dimensions. | Known authored domain is 0..2; record-12 selection for other bytes is an observed native fallback, not a substitute texture. |
| Bonedit `0x004D5F40`, field draw `0x004D6223` | The authoring sibling uses record 12. | Editor document schema does not need a new environment-mode field to reproduce this contract. |

Static receipts retained in the authorized M2 evidence archive:

- `ground-field-record-mapping-correction-v3.json`, SHA-256
  `941af7d1eb27a1fe2b75361beb31fd78b2d3632065c8f1f179b63b2eea98fe2e`;
- `deadhawg-sibling-mapping-audit-v1.json`, SHA-256
  `7c53cbcb8450200fdf419638c5bd35612724fed55367ac11c594fdf309ecf73e`;
- `native-field-retained-mesh-contract-v1.json`, SHA-256
  `c2fad7022814f9eca1c6f97ffed0e873952c188840ac18e0681613fb8e2c3a60`;
- `native-field-implementation-boundary-v1.json`, SHA-256
  `c74271d43ad7228b9dcb58cae9d911af57d676a040c4145fbf3da4bf7673e065`.

### System boundary and membership inventory

Native system: the mode-selected broad field, its authored Sprite descriptors,
world-lattice submission, gameplay texture/view lifetime, and Bonedit field
painter. The immediately following Arena surface lists and Region compositor
remain downstream dependencies; their independent unknowns are not closed by
this field recovery.

| Member | Selection / owner | Current disposition |
| --- | --- | --- |
| Stock Tutorial, retained row 0 | Mode 1, record 11 | `recovered-pending-port` |
| Generated rows 0, 2, 5, 8, 10, 11 | Mode 2, record 11 | `recovered-pending-port` for each listed row |
| Generated row 4 | Mode 1, record 11 | `recovered-pending-port` |
| Generated rows 1, 3, 6, 7, 9 | Mode 0, record 12 | `recovered-pending-port` for each listed row |
| Native-file mods and private editor tests | Imported environment byte and authored bounds, shared world renderer | `recovered-pending-port` |
| Lua-defined `environment.mode` | Existing validated byte; 1/2 versus all-other selection | `recovered-pending-port` |
| Restore/restart and spectator camera | Same field owner, texture lifetime and visible lattice | `recovered-pending-port` |
| Resize/fullscreen/DPR and lighting/effects switches | Same field below Roads and both Region branches | `recovered-pending-port` |
| CanvasStage authoring, direct and cached pan/drag/append layers | Native Bonedit record 12; shared field descriptor/lattice | `recovered-pending-port` |
| BoneyardViewer schematic inspector | Marker/grid canvas has no captured-ground dependency | `out-of-system`: retain its diagnostic presentation |
| Road styles 0..4, Terrain 0/1, compact/scenery, masks, Region composition | Adjacent painter families; no descriptor-binding change required | `out-of-system` for this field candidate; regression-test ordering, retain separate native-composition questions |
| Actual DeadHawg 20/21 and dynamic grave/tree banks | Existing correct generated row mappings | `out-of-system`: do not renumber unrelated art |

All pending field rows above now share the implemented descriptor, recurrence
and source sampling. The thirteen retained stock rows are compared against the
actual Tutorial/generated scene exports, not just copied golden fixtures. Their
final `exact-ported` dispositions remain withheld until the listed acceptance
and native material/composition questions are closed; the bounded source fix
must not be reported as completion of that larger visual contract.

### Recovered geometry and asset contract

| Record / preferred address | Atlas rectangle | Logical size / local registration | Alpha |
| --- | --- | --- | --- |
| 11 / `0x00B2F2A4` | `(778, 859, 350, 350)` | 350 by 350; corners `(-175,-175),(175,-175),(-175,175),(175,175)` | 255 throughout |
| 12 / `0x00B2F368` | `(1399, 1069, 350, 350)` | Same | 255 throughout |

- World bounds come from `Arena+0x8BBC..0x8BC8`. Start at authored X/Y;
  store float32 endpoints of X+width and Y+height. Iterate X outer, Y inner,
  with a float32 store after every 350-unit increment. Do not camera-snap or
  re-anchor the lattice at world zero. Do not clip the final tile to bounds.
- Field culling uses the primary view at `Arena+0x8BCC..0x8BD8`, with strict
  overlap. Touching-only tiles are excluded. Preserve the native store
  boundaries: tile-origin plus logical width in the cull comparison is not
  independently rounded merely because the loop increment is.
- Float32 recurrence is significant for supported fractional bounds.
  For origin `1.0010000467300415`, index 47 is `16451` with iterative native
  stores, versus `16451.001953125` with one final rounding of origin+47*350.
  Build and retain the two axes rather than allocating the full world mesh.
- `Sprite::Draw` stores the origin plus integer half-size and then the
  Graphics-root translation before submitting local corners. Arbitrary
  fractional-origin/camera bit identity needs downstream transform evidence;
  source-correct lattice coordinates alone do not prove it.
- UV endpoints are `(atlasX+0.5)/pageWidth` through
  `(atlasX+cropWidth+0.25)/pageWidth`, and likewise Y. The Sprite byte order is
  TL, TR, BL, BR. The existing `nativeSpriteRecordUvs` helper uses Pixi's
  TL, TR, BR, BL order, so field mesh indices `[0,1,2,1,3,2]` need explicit
  `[0,1,3,2]` remapping. Use the full original page with identity texture
  matrix; absolute atlas UVs must not pass through a cropped-frame matrix.
- UV normalization reciprocals are retained at Sprite `+0xB4/+0xB8`.
  Runtime descriptors and texture rows can verify the expected 1/2048
  normalization without reading private configuration values.

### Shared web ownership and obsolete override propagation

Gameplay currently imports `GROUND_TEXTURE` from `editor/textures.ts` into
`boneyard-textures.ts`, then builds one bounds-clipped XY/512 repeat quad in
`NativeBoneyardSurfaceView`. It discards `environmentMode`. All original combat
atlas pages are already loaded, so the corrected field can borrow the existing
full DeadHawg texture instead of decoding another image. Field meshes own their
geometry/shader/buffers, not the shared source page.

The real authoring CanvasStage also imports `GROUND_TEXTURE` and tiles it from
world zero in `editor/render.ts`. It adds a field-only 10% green-black tint,
22% radial vignette and guessed gray fallback. Those are captured-field web
policies, not evidence of native Bonedit behavior. Selection/grid UI remains
outside the field. Asset readiness must invalidate both direct rendering and
cached gesture layers. Canvas2D fractional source-rectangle filtering must be
compared explicitly; identical atlas bytes do not prove Canvas/WebGL parity.

Use the world renderer's explicit zero-padding visible bounds for the field.
The default padded resident view and inclusive resident overlap predicate are
not substitutes for the native primary-view strict cull. Stable visible ranges
must keep the retained geometry/buffers without re-uploading each frame.
Finite but extremely large custom origins can make float32 +350 stagnate;
rejecting a non-progressing axis is a declared web input-safety measure, not
native visual evidence or a reason to alter ordinary authored coordinates.

### Nearby findings and remaining evidence

- Road style is a signed byte at object `+0x8C` (`MOVSX` in `0x00640759`).
  Old diagnostic i32 interpretations are invalid; retained raw bytes permit
  correction. This does not change the existing five Road programs.
- Terrain's two ordinary texture rows are `images/river` and `images/rise`,
  not gravel. Its local 256 target is derived geometry. Style-1 vertex colors
  are player-position dependent and may change despite stable pointers/counts.
  These facts remain a separate surface/composition investigation.
- The fresh 2026-10-10 v6 session produced only a pre-paint startup image.
  It closed before its deadline with zero clicks and zero material samples;
  all 16 protected profile entries remained unchanged. No field acceptance is
  inferred from that run. A strict, independently reviewed no-input menu-image
  stage is required before further navigation.
- The subsequent v7 clean-stock run obtained two accepted before/image/after
  brackets and closed at 07:33:43 UTC, before its 07:42 deadline. The exact
  owned game/adapter, scheduled tasks and desktop lease were absent at
  07:34:59. All four protected-profile hash inventories remained identical.
  Independent scoring passed all 40 declared descriptor checks: both globals
  contain the predicted record-11/12 local corners, UV bytes, 350-by-350
  logical dimensions and 1/2048 reciprocals before and after both images.
  Both select texture handle 20 with stored 2048-by-2048 registry dimensions;
  Tutorial field mode 1 selects record 11. The probe's legacy labels 20/21
  are selector labels only, not atlas record IDs.
- Both v7 images have physical outer size 1606-by-929, a 1600-by-900 client
  crop at (3,26), DPI 96 and identical unshaken primary camera at zoom
  1.350000023841858. Stored D3D presentation parameters report MSAA 0, but
  do not prove live render state or selected-draw material binding.
  Dynamic scene pixels differ: 23.5009% of client pixels changed, RGB MAE
  0.83179 and maximum 131. Visually selected client ground patches
  (790,610,64,48) and (840,416,40,40) differ by at most 2 and 1 respectively;
  an unstable third patch was rejected. No alignment or color fitting was
  used. This establishes useful stationary field patches, not a frozen scene
  or matched final RGB composition.
- The admitted M2-only custody contains 37 individual image/control/hash and
  descriptor-derivative files, 3,639,005 bytes. Manifest SHA-256:
  `1230012ec0ad4b39c43f6f8d52695fe2cb83ee0ab0a2f7b7703c2e4862231952`.
  Derivative SHA-256 values are
  `a3790893055fec66203d66ad797cd4c7bd4d935fe9bd619207c19753147e018d`
  and `4174199d3e6a83b925f8750d7ae0d3fa6c93d59a275458ed5c08020288019c8f`.
  They retain original snapshot hashes and explicitly exclude the denied
  runtimeSettings output and all unlisted sections. No omitted settings or
  graphics flags are inferred, relabeled, transferred or certified.
- Active lighting operands, selected-draw target/material composition,
  held-out rendered field pixels and complete game/editor browser journeys
  remain unproved. The published visual release
  at `8ee2fcae` passed its own canonical Mac gate, live browser acceptance and
  hosted CI; those passes do not validate an unimplemented field replacement.

### Independent integration checkpoint (2026-10-10)

The admitted field source, selector, exact UVs, lattice recurrence and full-page
transport are now implemented across gameplay and editor preview. Game owns one
retained visible mesh and borrows the already loaded original page; it updates
geometry only when the strict visible tile range changes. Editor draws its field
before a transparent foreground gesture cache, so field sampling is refreshed
at the current camera and actual device phase during gestures. Asset completion
still invalidates the cached foreground.

The editor's 63 field direct/cache/invalidation/fractional-pan comparisons are
bit-identical. Foreground recomposition normally differs by at most 2 channels;
an isolated padded cache case at DPR1.25 has a maximum39 edge difference.
Exact unmodified8ee replay reproduced the same fence edge, with
maximum77 versus candidate39. Neutral-ground controls had identical foreground
pixels and the same maximum64 cache edge in both versions; transparent-cache
compositing contributes at most2 channel values. The max39 fixture is the initial
padded cache at a stationary camera, not a pan-induced field error. The bounded
foreground discrepancy is therefore verified preexisting. Append retains an
explicit ordering approximation until invalidation; the
measured added-placement case has maximum21/mean0.0784 RGBA difference. These
foreground results are not field-source parity evidence or an all-editor
pixel-equivalence claim.

Independent actual Apple M2/ANGLE Metal gameplay replay passed 540 geometry,
UV, mode, color and retained mesh/buffer checks across60 cases. Captured-camera
and fractional/large-origin source and .65 material pixels agree with the
independent oracle within1LSB at DPR1/2/2.5. Exact integer tied horizontal rows
still differ from the documented D3D9 top-left oracle; they have not been
captured as exact ties on the Windows adapter. The full-frame score retains all
boundary failures rather than masking them. A field-only hard-coverage
prototype is under qualification; no global epsilon is justified. The first
GPU harness run accidentally wrapped the pre-install projection method and is
explicitly invalid for phase conclusions; corrected v2 asserts each bind.
GPU delivery SHA-256:
`cd95297a7b26af647d2ebac72917df08f036debaab495b737671f826f2a0de1c`.

The field-only hard-coverage prototype then qualified all42 full-frame cases
on the same Apple M2 GPU, maximum1LSB and zero pixels over2, including root and
full offscreen targets at densities1,2.5 and25/12. Its1,764 geometry, UV, slope
and uniform-lifetime checks passed. It preserves the existing +0.5 native
projection and moves only this field's raster boundaries to `ceil(device)`;
UVs are extrapolated by the same displacement using the source UV/world slope.
The device coordinates must come from the complete current CPU mesh-to-target
affine multiplied by actual destination resolution before float32 upload.
Reconstructing density from projection fails (2.5 becomes2.500000238); supplying
only exact density still leaves logical-affine roundoff at shared row381. No
epsilon or fitted transform is used. The score SHA-256 is
`b9b7f8300f23de228318c642ac65bed620dc0b5702da21b29a36c6bbe72f7d3a`;
delivery SHA-256 is
`17b9282fd1bc2cf22df5c248499d1c9f8861ce2ea803bc83fd4bacbf227777b8`.

Implementation admission is limited to the native-phase, full-target field
owner with an identity full-page texture matrix and finite positive axis-aligned
transform. Refresh the complete CPU parent transform after camera feedback and
shake, immediately before rendering and after target/resize changes. Unsupported
transforms leave the normal material/geometry path unchanged. This is a
source-defined transport and coverage qualification; exact tied edges have not
been observed on the stock Windows adapter, and native final lighting/Region
composition remains a separate unresolved gate. The integrated render tree and
its lifecycle still require independent replay before adoption.

That integrated replay is now complete:112 initial and112 density-resized
unmasked full frames all agree with the unchanged oracle within1LSB, zero pixels
over2. It exercised actual production factory/view code with gameplay and nested
render-group hierarchies, root/full offscreen targets, DPR1/2/2.5/25/12, retained
buffers, empty/re-enter/resize restoration, all1,680 geometry/lifetime checks and
40 unsupported-transform controls. The latter are byte-identical to the ordinary
native surface shader. Post-install projection was asserted at every target
bind. Score SHA-256:
`f0fd3df0a0b701e9a4924a76630ded6a6ded6c8462c9d8a69d3d04a8b542e761`;
delivery SHA-256:
`5bde8b566adb79797fa01bb52b33ee20bc66c0aae0e6076efb15c841c14edd73`.
The full-target owner has roundPixels disabled and renders its own app.stage;
cached/filter targets, external stage ancestors and render-transform overrides
are outside that admission contract. Per-mesh rounding and invalid transforms
disable the coverage bit. The material equation and all Road programs remain
unchanged. The canonical maintained eight-file coverage preflight reached100%
of statements, branches, functions and lines after updating its synthetic field
fixture to a full2048 page; this percentage does not claim coverage of every
new module or replace the full canonical gate.

Static coverage then proved both initially selected gravel ROIs are covered by
Road geometry at every projected pixel center. ROI1 is Roads8/15; ROI2 is
Roads4/9/10/13. The source/call-order receipt SHA-256 is
`a3e41146b334f02bc0584b54bf65e37333f9c9bf1aacc979c67a5c8a037c8d9f`.
The visual impression of exposed field is retracted without moving the saved
ROIs or discarding negative scores. Road code remains byte-identical to8ee.
Native material tracing proves a white base reset before field dispatch and the
.65 shader equation; packed diffuse still depends on inherited Graphics
multiplier/lock, and final Region composition is not closed by this evidence.

### Validation contract before adoption

#### Registration stores and editor sampling qualification

The pure lattice and strict cull retain each stepped float32 tile origin. Drawn
corners additionally preserve SpriteDraw's registration-center store:
`f32(f32(origin + 175) +/- 175)`. A source-derived example at origin
131071.8984375 moves the drawn left edge to 131071.90625; the raw origin remains
the cull input. Native then stores center plus Graphics root before adding local
corners. Pre-rounded retained world vertices do not make these additions
associative for all custom coordinates: the bounded 144-endpoint diagnostic
found five differences, maximum 0.015625 pre-scale units. At the captured v7
stock endpoints there was no difference under the declared saved-root-zero
hypothesis. Actual renderer qualification must retain this limitation.

The editor field sampler was qualified separately from final native lighting.
On Mac Chrome 154, six 800-by-600 same-source fixtures covered zooms
1, 1.35, 0.6, 0.4 and 0.12, DPR 1, 2 and 2.5, fractional origins and exact
integer device-edge ties. An independent CPU bilinear/integer-center/top-left
reference found that drawing the whole atlas through an affine transform,
then clipping each tile to device ranges `[ceil(left), ceil(right))` and
`[ceil(top), ceil(bottom))`, preserves all tested channels within 1 LSB.
Texture placement carries the established +0.5 physical-pixel phase. Ordinary
fractional drawImage cropping fails the integer edge case (maximum 122,
3,185 pixels over 2), while removing the phase produces maxima 50 through 115.
No tint, sharpness, gain or coordinate fit was used. The source endpoints come
from the exact record UVs, so adjacent atlas texels remain available to linear
filtering rather than being clamped to an artificial Canvas crop.

This reference follows [Microsoft's Direct3D 9 rasterization rules](https://learn.microsoft.com/en-us/windows/win32/direct3d9/rasterization-rules),
which specify integer centers and top-left coverage while warning that hardware
can vary. The actual WebGL control differed at tied top/bottom edges; gameplay
Mesh seam ownership remains an explicit independent GPU test rather than a
claim that the Canvas or CPU reference proves native final composition.
The sampler receipt SHA-256 is
`440effc6559311025a06ae30cfa6f9fc1c97049bf4badb092cffd2b4c79d95e5`.

The initial two frozen native gravel ROIs also fail the standalone field
source/white/.65 hypothesis (RGB MAE 42.6 and 32.2). They cannot establish
field-color parity merely because they are stable: later compact ground,
Terrain, additive painters or inherited material may own those visible pixels.
Those negative comparisons are retained without moving ROIs or fitting color;
their later Road ownership is now classified above. A separate source-only
coverage screen then froze one32-by32 exposed-field candidate at client
(896,704), plus ten16-by16 cells, before reading native RGB. All eleven failed
the predeclared repeat-stability gate (maximum1 and MAE0.1). The primary repeated
patch has MAE0.314/maximum2; its exact-source/UV/camera/white/.65 baseline differs
by MAE3.406 and3.720, maxima10 and11. No tint, gain, phase or coordinate was fit.
This useful negative result does not close selected-draw diffuse/material or
Region/local-mask contributions. Conservative full-quad exclusion had yielded
zero candidates; the later refinement uses only original source alpha support,
and Terrain exclusion remains conditional on the admitted source geometry.

1. Match the live raw field descriptors to the two source-derived records,
   with stable before/image/after identity and explicit camera/DPI/backing data.
2. Independently exercise every mode, strict edges, nonzero/negative/fractional
   origins, recurrence, overhanging last tiles, large custom bounds, UV corner
   order, and the full-page texture-matrix boundary.
3. Compare matched native/browser ground and tile seams, separately from the
   lighting/shadow composition. Cover both Region branches and unchanged Road,
   Terrain, grave/tree and compact-detail ordering.
4. Verify retained visible mesh cost, unchanged-frame uploads, borrowed-page
   ownership, early load failure/abort, repeated entry/exit, resize and DPR.
5. Exercise real gameplay Tutorial and modes 0/2 plus direct/cached authoring
   frames. Complete the exact candidate's canonical Mac validation and normal
   tested publication before changing any disposition to `exact-ported`.
