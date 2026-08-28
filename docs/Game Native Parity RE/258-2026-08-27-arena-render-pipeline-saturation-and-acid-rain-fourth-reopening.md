# 2026-08-27 — Arena render-pipeline saturation and Acid Rain fourth reopening

## Reported smell and parity question

- Reported web behavior: Acid Rain still does not look like stock after the
  prior cloud-record, blend-order, gradient-direction, and resource-lifetime
  corrections. The retained labeled comparison still shows a harder, brighter,
  much more saturated web field and brighter rain/ring pixels.
- This is a fourth report in a system previously called complete. The last
  visual pass traced Acid's painter inputs into the generic sprite and quad
  submitters, but stopped before the renderer's Direct3D pixel-shader state.
  It therefore treated requested tints as final colors and retained browser
  compensation paths whose assumptions the native shader now falsifies.
- Stock behavior to recover: every Arena-owned textured or vertex-colored
  fragment is processed by one exact `0.65` saturation shader before normal,
  additive, or multiply composition. Stock samples unpremultiplied native atlas
  pages with linear filtering, applies no `1.12` brightness lift, and uses the
  full `.2375..25` late player-light alpha.
- Falsifiers: Arena does not write `0.65` before its first target; the shader
  formula does not use separate texture/vertex averages; it is restored before
  Acid draws; the retail PNG upload premultiplies RGB; Acid's falling streak is
  a sampled texture; or current web already runs an equivalent per-fragment
  program before blending.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | `SolomonDarkAbandonware/SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Matches the canonical analyzed 0.72.5 image. | high |
| Shader construction | canonical read-only Ghidra; `0x0043FD80`; shader object `0x00B401F4` | Retail compiles `ps_2_0` HLSL which samples `DiffuseSampler`, computes `real=texture*vColor`, computes separate average greys, and lerps grey to real by `mSaturation`; alpha is `textureAlpha*vertexAlpha`. | high |
| Arena state interval | raw instructions `0x0046EC9A..0x0046ECB7`, float `0x00784DC0=0.65`; restore `0x00470A5B..0x00470A76` | Arena binds saturation before Region-light reset and removes it only at final return. Direct underlay, queue, late art, nested targets, mode light, and Arena feedback lie inside. | high |
| Texture/sampler/blend | page loader `0x00420140`, upload `0x00440F70`, reset `0x0041D000`, filter selector `0x00421560`, state dispatcher `0x004208A0` | Retail mode-zero pages are unpremultiplied A8R8G8B8; 1:1 stock uses linear min/mag and wrap addressing; selectors are normal `SRCALPHA/INVSRCALPHA`, additive `SRCALPHA/ONE`, multiply `ZERO/SRCCOLOR`. | high |
| Primitive closure | `Mod Loader/docs/reverse-engineering/native-render-pipeline-callers.json` | Canonical catalog drains all xrefs for 16 shared owners: 300 color-setter callers, 160 state-dispatch callers, 152 direct-glyph callers, 118 scaled-sprite callers, 74 solid-quad callers, 21 vertex-color-quad callers, and every exact callsite. | high |
| Acid primitive path | `0x005EB290/0x005EB1D0/0x00459130 -> 0x00414540/0x00414EA0/0x0041DF10` | All parent, residue, falling, marker, landed, and splash pixels lie inside the shader. The rain streak is a four-vertex interpolated-color quad, not a gradient texture. | high |
| Clean visual | stock capture SHA-256 `607a697578d1548181e86c8fce82218804f7e99cfcc4bb00ffa06a80bb9227f7`; labeled pair under `/home/user/.codex-artifacts/solomon-dark/acid-rain-comparison-20260826/` | Stock Acid is paler, softer, and less saturated. The exact shader predicts that direction for cloud, streak, marker, ring, and residue without tuning an Acid constant. | high |
| Current web pixel path | PixiJS `8.19.0` local sources; `game-webgl.ts`, `boneyard-textures.ts`, `editor/render.ts`, `native-secondary-world-view.ts`, `boneyard-building-surface-view.ts`, environment-light plan | Pixi default shader returns `texture*vColor` with no native saturation. Game images upload premultiplied alpha; combat/DeadHawg/static runtime art receives `brightness(1.12)`; static resident textures are nearest; secondary rain is `FillGradient`; late record 18 is multiplied by `0.14`. | high |

## System boundary and membership inventory

Native system: **Arena frame pixel production and sampling** — renderer state
from the `0.65` bind at Arena entry through the identity restore at Arena
return, including every texture/vertex primitive, native page/sample contract,
blend branch, nested Arena target, and the web abstractions that currently
alter those pixels. The dispositions below name the required closed candidate;
the implementation receipt remains open until exact Mac/browser proof lands.

| Member / branch | Native source | Disposition | Required proof |
| --- | --- | --- | --- |
| shader compile and failure path | `0x0043FD80`, `0x00B401F4` | exact-ported | exact formula constants and shader-source contract |
| Arena bind and final restore | `0x0046ECA9/0x00470A6A` | exact-ported | Boneyard renderer only uses `0.65`; Hub/menu/HUD remain identity |
| direct/transformed/scaled sprite families | `0x004143D0/0x00414540/0x00414EA0`, complete catalog | exact-ported | one Arena-owned batch program covers all ordinary/additive Boneyard sprites |
| arbitrary textured mesh/quad | `0x00414710/0x0041E990` and catalog | exact-ported | texture and vertex colors remain separate until native formula |
| solid and vertex-colored quad | `0x0041DD70/0x0041DF10` and catalog | exact-ported | native interpolation and exact saturation; no sampled rain substitute |
| requested/effective color and multipliers | `0x0041FE50/0x0041FF60` and catalog | exact-ported | packed tint/alpha plus parent tint retain exact order |
| native PNG page upload | `0x00420140/0x00440F70` | exact-ported | unpremultiplied page texture and native frame geometry |
| sampler address/filter | `0x0041D000/0x004208A0/0x00421560` | exact-ported | native page sampling is wrap/linear; text-only point branches stay separate |
| source-over and additive branches | renderer selector `0/1` | exact-ported | exact unpremultiplied blend at translucent edges and overlaps |
| Region multiply | selector `2`, `0x0057D670` | verified-already-at-parity | opaque grayscale target remains multiplication and saturation-invariant |
| Region stamps and black complex shadows | light/shadow reports | verified-already-at-parity | grayscale/black invariance and existing order stay green |
| static underlay/terrain/compact/fence art | Arena direct bands | exact-ported | remove all `1.12` preprocessing and nearest runtime sampling |
| BadGuys/Demon combat page family | native full pages and record UVs | exact-ported | rebuild native-layout pages, byte/UV/frame closure, no lifted pages |
| DeadHawg, player, Solomon, equipment, and loose-texture families | native bundle/pages | exact-ported | no brightness lift; same Arena shader and NPM blend |
| Building base/roof per-vertex surface | `0x0060E940/0x0060EC50` | exact-ported | custom mesh shader executes exact texture/vertex formula |
| nested Storm, Leviathan, Region, and class render targets | Arena target owners | exact-ported | inherit native shader at the same epoch; no accidental post-canvas filter |
| weather streak particle batch | grayscale over white alpha ramp | verified-already-at-parity | saturation identity, density/order/lifetime unchanged |
| colored weather splashes and all other effect sprites | shared sprite path | exact-ported | native shader and blend without density/resource change |
| Acid cloud records 78/78/10 | `0x005EB290` | exact-ported | requested inputs unchanged; pixel shader produces stock palette |
| Acid falling quad, marker, ring, splash, residue | `0x00459130/0x005EB1D0` | exact-ported | every primitive uses shared pipeline; no Acid-only color patch |
| all enemy, loot, primary/secondary VFX consumers | complete renderer caller/asset membership | exact-ported | representative pixels plus source-level shared-owner proof; no lifted exception |
| modes 1/2 late player aperture | `0x00470EE0`, record 18 | exact-ported | alpha `.2375..25`, additive, grayscale saturation identity, mode-0 absence |
| Arena-owned screen feedback | tail of `0x0046EC80` | exact-ported | remains inside shader interval and below HUD |
| Hub/fixed Regions, menus, and HUD after Arena return | separate top-level render owners | out-of-system (Arena restores saturation to `1.0`) | identity negative tests |
| renderer blur shader | `0x00B401F8`, request `+0x230` | out-of-system (separate renderer state not selected by Arena entry or Acid painters) | state remains distinct and untouched |

There are no browser-platform-blocked members and no extractable native
unknowns in this boundary.

## Native ownership thread and recovered behavioral contract

- Startup compiles saturation and blur as two independent pixel shaders.
  Renderer request/cache fields own activation, and every state transition
  flushes buffered primitives first.
- Arena writes constant `0.65` before even resetting the light target. It does
  not derive saturation from weather, ability, participant, setting, random
  state, or frame phase. Every Arena frame uses the same value.
- Let `T` be the unpremultiplied sampled texture RGB and `V` the interpolated
  vertex RGB. Native computes `G=avg(T)*avg(V)`, then
  `RGB=.35*G+.65*(T*V)` and `A=Ta*Va`. Blend consumes that output afterward.
- The formula is per primitive. Applying CSS `saturate(.65)` or a Pixi filter
  to the completed canvas is not equivalent because prior overlap/additive
  composition has already lost `T` and `V`.
- Retail mode-zero texture upload preserves unpremultiplied channels. Normal
  and additive blend selectors supply the one source-alpha multiplication.
  Premultiplying during upload changes bilinear translucent-edge samples even
  when opaque centres agree.
- Arena uses the original atlas page/UV record and linear filter. A web
  native-layout page is the clean exact representation; thousands of separate
  clamp-to-edge crops or content-bounds-only frames are not the native sampler.
- Acid's requested art, transform, alpha, blend order, queue lanes, combat,
  light, audio, and lifecycle remain as previously recovered. The shared shader
  is the missing owner that makes those correct inputs look stock.
- The direct environment aperture is a separate late additive native pass. Its
  grayscale RGB makes saturation an identity; the native `.2375..25` alpha
  cannot be replaced by a product brightness scale.

## Nearby-system findings

- The prior `brightness(1.12)` lane reaches both packed combat pages and
  Canvas2D-built static residents, so it changes enemies, loot, scenery,
  projectiles, spells, and Acid together. Removing it only from record 78 would
  repeat the earlier symptom patch.
- Static resident `scaleMode: nearest` and `ctx.imageSmoothingEnabled=false`
  during magnification contradict renderer reset's 1:1 linear min/mag path and
  explain part of the web's harder edge character.
- The two-page compact combat optimization is still a valid memory owner, but
  its layout must be native-page/record based rather than content-bound packing
  if it is also to be the sampler oracle. Native BadGuys `2048x2048` plus Demon
  `512x512` costs only 49,152 decoded bytes more than the current pages.
- Native saturation acts on custom Building vertex colors and nested Arena
  render targets too. A default-Sprite-only repair would leave whole renderer
  families outside the recovered state.
- Durable native facts and the complete xref catalog are owned by Mod Loader
  `native-arena-render-pipeline.md` and
  `native-render-pipeline-callers.json`.

## Confidence and open questions

- Confirmed: shader source, constant, bind/restore addresses, pass coverage,
  texture representation, sampler state, blend table, primitive membership,
  current web compensations, and predicted Acid color direction.
- Inferred: none used as implementation truth.
- Unknown material to implementation: none. Final pixel acceptance still must
  synchronize stock/web scene, viewport, camera, and cast phase; that is a
  validation task rather than missing native truth.

## Web implementation consequence

- Add one cohesive Arena pixel-pipeline module, scoped to the Boneyard Pixi
  renderer instance. Its batch shader must keep sampled texture and vertex
  color separate, execute the exact HLSL-equivalent formula, and preserve all
  three native blend equations. Do not install a CSS/full-canvas filter.
- Load Arena-owned texture pages without premultiplication, use native-layout
  BadGuys/Demon pages and record frames, and use linear sampling. Preserve
  identity behavior for fixed Hub/menu/HUD renderers.
- Extend the Building surface shader and every non-default/nested Arena path
  with the same fragment contract. Grayscale light and black-shadow paths may
  share an explicitly proved identity fast path.
- Replace secondary rain's texture-gradient abstraction with native vertex
  colors or an algebraically identical batched vertex program while preserving
  each child's geometry, sort position, density, and resource performance.
- Remove the Boneyard `brightness(1.12)` Canvas/Buffer preprocessing across
  every consumer, remove nearest runtime resident sampling, and delete the
  stale lifted-page/source tests and helpers in the touched scope.
- Restore the late environment record-18 alpha to the exact `.2375..25` range;
  remove `WEB_DIRECT_ENVIRONMENT_LIGHT_SCALE` rather than setting another
  compensating number.
- Keep Acid art/constants and every gameplay/network/audio/lifecycle owner
  unchanged. The Acid correction must emerge from the shared Arena pipeline.

## Validation contract

- Pure formula tests cover white/colored/transparent texture samples, colored
  vertex tints, alpha, saturation `0.65`, identity `1`, and the exact Acid
  parent/top/bottom/ring examples. They compare the web program to a CPU mirror
  of the native HLSL.
- Structural/render contracts require one Boneyard-owned native batch shader,
  unpremultiplied native-layout pages, linear runtime textures, the Building
  shader extension, native rain vertex colors, and complete removal of `1.12`,
  `FillGradient`, and the `0.14` scale. Hub/menu/HUD negative assertions remain.
- Asset tests reconstruct every BadGuys/Demon record from its native page and
  verify page dimensions, pixels, UV/frame/origin, ownership, context loss, and
  teardown. Every enumerated caller family reaches either the shared Arena
  shader or an explicit grayscale/black identity path.
- Mac focused/browser matrix covers: Acid in the real Tutorial and ordinary
  Boneyard; Magic Storm and a nested composite; one enemy, loot, primary spell,
  secondary spell, player/equipment, Building, terrain/fence, colored splash,
  grayscale weather, Region multiply, mode-0, and modes-1/2 direct light.
- Matched stock/web `1600x900` Acid frames use the same Tutorial camera, aim,
  cloud constructor phase, actor age, and scene settings. Compare cloud palette
  and bounds, streak endpoint colors, marker/ring/residue, unaffected alpha,
  and representative background/enemy pixels; do not excuse a color mismatch
  as private RNG.
- Run all focused tests and `/opt/homebrew/bin/bash ./scripts/validate.sh` on
  the exact rebased Mac candidate. Browser arrays for page, console, and failed
  responses must be empty. Measure p95/p99/max frame gaps and long tasks with a
  full-density Acid field; do not regress the shared-gradient memory/performance
  closure.
- Publication and deployment remain separate and unrequested.

## Implementation validation receipt

- `native-arena-render-pipeline.ts` now owns the Boneyard renderer instance's
  default batch, non-batched Graphics, non-batched Mesh, and particle shader
  families. Each path preserves raw texture RGB, effective vertex RGB, and
  alpha until it executes the recovered `0.65` formula before Pixi selects the
  matching premultiplied or unpremultiplied normal/additive blend. The custom
  Building mesh uses the same fragment contract. Pipeline teardown is
  instance-local and idempotent; fixed Hub/menu renderers are unchanged.
- Arena pages and static residents now upload without alpha premultiplication
  and sample linearly. BadGuys and Demon use their original `2048x2048` and
  `512x512` retail pages, with exact SHA-256 values
  `af5717b37c81306d515eed6d9f8717fa97bd1c63b9530a7079738c457c97443e`
  and `0a6feca43b7f1a35f09d43494a1c794c7962d555e52b13703439b72085529ae4`.
  The packer verifies all 2,625 record rectangles against tracked crops and
  will not regenerate a different page oracle.
- The `brightness(1.12)` Canvas/Buffer lane and its helper/test are deleted;
  runtime/editor static sampling is linear; Acid/Storm rain uses true
  four-corner vertex colors; Region, Storm, and Leviathan targets use the
  native alpha/sample contract; and the player aperture is restored to
  `.2375..25` with no browser scale.
- Mac Chrome `151.0.7922.174` on arm64 macOS `26.6.2` executed the built
  production Acid journey in WebGL2. It committed real skill `72`, damaged the
  exact-edge target, presented cloud/drop/splash/residue membership, reached
  174 actors and 222 primitives, and recorded empty page, console, and failed
  response arrays. Its three-second steady sample measured `16.7 ms` p95,
  `16.8 ms` p99, `83.3 ms` maximum, and one `87 ms` Long Task. Browser-log
  SHA-256 is
  `3f6229b88bdecddbb984baeee7ec0253de79daab8bcb503b1d71d43d89daba51`.
- The real Tutorial fixture then used browser gameplay input at requested age
  `60`, reached stage `6`, and retained the exact three cloud members plus the
  one DeadHawg-4 underlay. Visual review against the retained stock oracle
  confirms the former neon/hard web field is replaced by the predicted softer
  gray-green cloud and streak palette. Page, console, and response arrays were
  empty; capture SHA-256 is
  `e2f8d9a6208c9f87d5d375fe1276e5e64b0deb0a4fb4cceae513b9068a7f7caa`,
  and browser-log SHA-256 is
  `349cb6689d0bfd3f4c26e3ce45a48c1a3348210825f762492eb35d49ff6d33bb`.
- Production sibling journeys passed Call Leviathan (18 composite depth
  samples, up to six members) and Magic Storm (166 actors/167 primitives),
  both with empty browser errors. The Building WebGL2 fixture passed all four
  Building variants and all 21 Monument variants with zero base/roof color
  mismatches. Their log SHA-256 values are
  `4d04440362e2196bc8b9ddcbecdc1f947d242a79d8f29155be735763ede4442d`
  and `b9273bb750d46e82383baeded0941f3d7222c781b270512362253f9a0e78671d`.
- Mod Loader's complete Mac static RE suite passes `517/517`, including the
  registered shader/frame boundary, layout-address, and caller-catalog
  contracts. No deployment or production cutover was performed.
