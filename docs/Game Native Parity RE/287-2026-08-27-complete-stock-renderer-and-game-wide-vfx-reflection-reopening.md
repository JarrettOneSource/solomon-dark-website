# 2026-08-27 — Complete stock renderer and game-wide VFX reflection reopening

> **2026-08-29 world-painter closure:** the low-level Graphics/D3D,
> texture, shader, sampler, blend, and child-local painter results in this file
> remain authoritative. [Entry 297](<297-2026-08-29-complete-region-world-painter-layering-audit.md>)
> supersedes and completes its parent-root topology: Region manager chronology,
> `PuppetPointer` insertion, `ZAnimSplit` clip slices, Goodie scenery ownership,
> and direct pre/post-world composition are exact-ported by that entry.

## 2026-09-01 — Sixth report: ExactText glyph logical-trim quad

### Reported smell and parity question

- A player reports that InventoryScreen text still looks subtly unlike stock
  after its font roles, case-sensitive strings, pen positions, point sampler,
  and surrounding chrome were corrected. In particular, `stats` looks less
  clean than retail and the `RESISTANCES`/row copy appears slightly misplaced.
- A fresh production Mac Chrome capture of current main reproduces the
  residual. The question is whether this is another Inventory call-site error
  or a shared ExactText raster-geometry defect.
- The falsifier for a shared correction is the complete glyph record: if the
  web preserves the atlas frame, logical canvas, trim origin, metric bearing,
  point filter, and pen advance at every output adapter, Inventory must not
  receive another local offset. If any adapter discards record geometry, every
  native bitmap-font consumer sharing it is reopened.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Clean stock | `SD original - image.png`, 679x694, SHA-256 `e84513ec46b23f893dff87a16eddf14f1b2f619c8346f1b0efae3adf3006c9af` | The lowercase menu-font `stats` ink has stable horizontal alignment inside its shaded header, while the medium/body page copy has the stock crisp point-sampled weight. | high |
| Current browser reproduction | Website `190f11293e90cf25e9670954e5f54b67f50bb472`; production Mac Chrome, 1600x900; diagnostic frame SHA-256 `3db232253d2ccd7e5f6c66c263c5284c1a4232cfe2ff02573abac59b8cb556f0` | The corrected Inventory composition and pens are present, but the reported slight glyph-position/weight residual remains with empty journey and browser error arrays. | high |
| Retail instructions | `DarkCloudBrowser_ExactTextRender 0x0043AFC0 -> Glyph_Draw 0x004143D0`, retail `SolomonDark.exe` 0.72.5 at preferred base `0x00400000` | ExactText computes the metric pen/bearing and `Glyph_Draw` submits the glyph sprite record's authored quad. The record's logical canvas and trimmed ink origin therefore remain part of final draw geometry; the native painter does not recenter the tight atlas frame. | high |
| Extracted asset data | tracked `native-ui-assets.json`; every `NativeUiGlyphRecord` has `frame`, `logicalSize`, `trimOrigin`, and `metrics` | The Website already owns all native inputs. Across 718 glyphs in all ten font families, 626 tight-frame centers differ from their authored logical/trim centers, usually by one half pixel and by as much as one pixel in `world-and-roster`. | high |
| Web causal trace | `native-ui-pixi.ts`, `NativeUiPlanView.tsx`, `NativeBitmapText.tsx` at the current-main identity above | The ordinary sprite path preserves Pixi `orig` and `trim`; `glyphTexture` supplies only a tight `frame`. Both DOM paths likewise place the tight frame at `center - frame/2`. All three discard `logicalSize`/`trimOrigin` after layout even though the catalog and glyph layout retain them. | high |
| Existing regression gap | `native-ui.test.ts`, native record texture tests, source contracts | Tests pin point filtering, advance, kerning, wrapping, alignment, centers, records, and tint, but none pins the final trimmed ink rectangle or glyph texture `orig`/`trim`. The false tight-frame implementation is therefore fully green. | high |

All addresses are preferred-image addresses in the canonical unmodified retail
image, 4,723,200 bytes, SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`.
No injected runtime evidence is used in this reopening.

### System boundary and membership inventory

Native system: final ExactText glyph geometry from extracted sprite-record
canvas/trim data through metric layout and every Pixi or DOM submission path.

| Member | Native/data source | Required disposition | Proof contract |
| --- | --- | --- | --- |
| `belt` font, 92 glyphs / 89 affected | complete extracted belt wrapper | `exact-ported` by this reopening | every glyph uses authored logical/trim geometry |
| `body` font, 92 glyphs / 81 affected | complete extracted body wrapper | `exact-ported` by this reopening | representative page labels plus complete manifest sweep |
| `control-panel` font, 92 glyphs / 63 affected | complete extracted control-panel wrapper | `exact-ported` by this reopening | representative settings/control copy plus manifest sweep |
| `heading` font, 42 glyphs / 38 affected | complete extracted heading wrapper | `exact-ported` by this reopening | representative heading copy plus manifest sweep |
| `medium` font, 92 glyphs / 81 affected | complete extracted medium wrapper | `exact-ported` by this reopening | `RESISTANCES`, values, and complete manifest sweep |
| `menu` font, 92 glyphs / 64 affected | complete extracted menu wrapper | `exact-ported` by this reopening | lowercase `stats` and complete manifest sweep |
| `skill-uppercase` font, 26 glyphs / 26 affected | complete extracted skill wrapper | `exact-ported` by this reopening | skill picker capture plus manifest sweep |
| `special-uppercase` font, 31 glyphs / 30 affected | complete extracted special wrapper | `exact-ported` by this reopening | representative title/special copy plus manifest sweep |
| `timeline` font, 92 glyphs / 90 affected | complete extracted timeline wrapper | `exact-ported` by this reopening | timeline capture plus manifest sweep |
| `world-and-roster` font, 67 glyphs / 64 affected | complete extracted world wrapper | `exact-ported` by this reopening | world/nameplate capture plus manifest sweep |
| shared layout, advance, kerning, alignment, bearings | `0x0043AFC0`; `native-ui-text.ts` | `verified-already-at-parity` | existing exact layout assertions stay unchanged |
| point-filtered wrap-addressed font page sources | ExactText filter owner; earlier entry-287 census | `verified-already-at-parity` | sampler/source-policy assertions stay unchanged |
| Pixi plan/text adapter | `native-ui-pixi.ts::text` | `exact-ported` by this reopening | trimmed texture has native `orig` and `trim` |
| Pixi direct glyph adapter | `native-ui-pixi.ts::glyph`; chat and styled-run callers | `exact-ported` by this reopening | direct glyph sprites share the same trimmed texture |
| DOM plan adapter | `NativeUiPlanView.tsx::renderText` | `exact-ported` by this reopening | CSS ink bounds derive from logical canvas and trim origin |
| DOM raw bitmap adapter | `NativeBitmapText.tsx` | `exact-ported` by this reopening | CSS ink bounds share the same geometry helper |
| Inventory, skills, settings, tabs, buttons, message boxes, noteboxes, tutorial, loot, spectator, game-over, title/create, Hub chat/NPC, HUD/world consumers | complete callers of the four adapters above | `exact-ported` through the shared correction | representative Pixi and DOM browser surfaces plus full gate |
| protocol, simulation, input, save, audio, RNG | no glyph-quad ownership | `out-of-system` — no state change | source boundary and unchanged suites |

No member is blocked by the browser platform.

### Native ownership thread

- ExactText selects a font wrapper, applies alignment width, kerning, advance,
  and the per-glyph metric bearing. `Glyph_Draw` then renders the glyph's
  authored sprite-record quad at that metric position.
- The extracted record represents that quad as an untrimmed logical canvas and
  a tight atlas frame at `trimOrigin`. These values remain immutable for the
  life of the font catalog; only the caller's position, scale, tint, alpha, or
  intentional italic transform changes per draw.
- Pixi text plans and direct glyph calls share one cached glyph texture. DOM
  plans and raw bitmap text share the same pure layout but currently duplicate
  the final tight-mask placement. Scene close destroys derived Pixi textures;
  DOM glyph elements leave with their owning component.

### Recovered behavioral contract

- A layout glyph centered at `(cx, cy)` and scaled by `s` submits tight ink at
  `left = cx + (trimX - logicalWidth/2) * s` and
  `top = cy + (trimY - logicalHeight/2) * s`, with the atlas frame's scaled
  width and height. Centering the tight frame instead is not equivalent.
- Pixi must encode the same rule as texture `orig = [0,0,logicalWidth,
  logicalHeight]` and `trim = [trimX,trimY,frameWidth,frameHeight]`; anchor
  `0.5` then remains the native logical-quad anchor.
- For menu `stats`, the current tight path shifts every glyph 0.5 pixel left;
  `s/a/s` also shift 0.5 pixel up. For medium `RESISTANCES`, nine of eleven
  glyphs shift in at least one axis. Body `HEALTH:` and medium `63/63` likewise
  have mixed half-pixel shifts, explaining the inconsistent apparent weight.
- Point sampling, native UV endpoints, kerning, advances, baselines, alignment
  modes, case-sensitive strings, tints, and caller-owned pen positions do not
  change. There is no font substitution or browser approximation.

### Nearby-system findings

- The regular native sprite adapter already preserves `logicalSize` and
  `trimOrigin` through the shared `nativeSpriteRecordTexture` constructor.
  ExactText diverged only because its point-filter source path rebuilt a
  frame-only texture instead of carrying the same record geometry.
- The DOM duplication is an independent output-adapter omission with the same
  root cause. A pure final-ink-bounds helper prevents Pixi truth and DOM truth
  from drifting again without changing the existing layout ABI.

### Confidence and open questions

- Confirmed: native draw ownership; complete authored glyph membership; exact
  current-web omission; all four output paths; affected-glyph distribution;
  stock/current visible residual.
- Inferred: the user's description of the text as a slightly different font
  is the perceptual result of inconsistent half-pixel point-sampled ink. This
  inference is accepted only if corrected browser captures remove the residual.
- Unknown: no native system member or unavailable browser capability. The
  final visual result remains subject to stock-versus-web browser review.

### Web implementation consequence

- Preserve logical size and trim origin when the point-filtered Pixi glyph
  texture is created; keep the shared cache, source policy, anchor, and layout.
- Add one pure native glyph ink-bounds calculation to `native-ui-text.ts` and
  make both DOM adapters consume it. Remove their tight-frame-centering math.
- Do not add Inventory offsets, change a font role, alter atlas pixels, soften
  the sampler, or introduce CSS/system-font fallbacks.

### Validation contract

- Focused tests must sweep all 718 extracted glyphs and prove final bounds from
  logical canvas/trim data, pin representative menu/medium/body/world glyphs,
  and assert that point-glyph Pixi textures retain `orig`/`trim`.
- Source/adapter coverage must prove both DOM paths consume the shared bounds
  helper and direct Pixi glyph callers share the corrected texture.
- Production Mac Chrome must capture Inventory page 1 and the native-UI
  workbench's Pixi and DOM surfaces with empty page, console, response, WebGL,
  and host-error arrays. Review `stats`, `RESISTANCES`, body values, and at
  least one non-Inventory font family against stock/extracted geometry.
- After the last source edit, run the complete canonical Mac gate. Publication
  and deployment are separate and are not authorized by this reopening.

### Implementation validation receipt

- `native-ui-glyph-texture.ts` now constructs every point-filtered Pixi glyph
  texture with the atlas frame plus native `orig` logical canvas and `trim`
  rectangle. `native-ui-pixi.ts` routes both planned text and direct styled/chat
  glyphs through that constructor; cache, sampler, UV, tint, alpha, scale, and
  anchor ownership are unchanged.
- `native-ui-text.ts` now owns the pure final-ink rectangle formula.
  `NativeUiPlanView.tsx` and `NativeBitmapText.tsx` both consume it, removing
  their duplicate tight-frame-centering math. No Inventory offset, font role,
  atlas asset, metric, pen, or layout contract changed.
- The focused regression was proven red on the Mac mini at the exact base
  `190f11293e90cf25e9670954e5f54b67f50bb472`, first failing because both new
  shared geometry exports were absent. After implementation,
  `npm run test:native-ui` passed `74/74`. Its new assertions sweep all 718
  glyph records, pin the 626 non-equivalent tight-frame centers, verify menu,
  medium, body, and world representatives, inspect actual Pixi
  `frame`/`orig`/`trim`, and require both DOM adapters to use the shared bounds.
  Additional Mac suites passed world nameplates/speech `20/20` and Hub UI
  `94/94`.
- The candidate was fast-forwarded without conflict through current
  `origin/main` `521776ac88d3c09af524862562b9c6460e176696`, including its independent
  primary-spell presentation quality suite. The production Mac build passed
  TypeScript, Vite, game-host construction, and the bundle budget. Entry
  `Game-w8dxC8Ou.js` is 263,678 raw / 80,067 gzip bytes, below the 524,288 /
  134,144 limits.
- Production Chrome at 1600x900 completed the built Inventory journey through
  Hub pages `0 -> 1 -> 2`, close/reopen reset, and Boneyard page 1. Page,
  console, and failed-response arrays were empty. The reviewed Hub and
  Boneyard attributes frames have SHA-256
  `65d53adda244c99b0916484ef48553740c2a4aec49cff22e937f970760f8d8d3`
  and `98c311dd9e83af42da37213bb78918b814dfd8f5d2822c68e23db47eff521d32`.
  At matched pane scale, `stats`, `RESISTANCES`, labels, and values retain the
  stock glyph shapes without the mixed half-pixel web shift.
- The Mac Chrome native-UI workbench exercised all 13 atlases and both Pixi and
  DOM output adapters with empty page/console/response arrays. Reviewed Pixi
  and DOM frame hashes are
  `7df5539579634108b595d212b0b7e7405bee371c9240f8b49fb17c318251a729`
  and `f0470963ac3fe5c79bffab118c258b01788779f141b15c7c0c6bc0a4dd89bcab`.
- The no-later-implementation-edit canonical Mac
  `/opt/homebrew/bin/bash ./scripts/validate.sh` gate passed every backend,
  frontend, desktop, lint/boundary, generated-artifact, production build,
  bundle-budget, media, and CSP stage on that current-main identity. Its
  16,759-line log SHA-256 is
  `339c4a0926a3d582b20f2e12ff712e31c2f66312d3abb7a1171d6aa952e9ae20`.
  No browser approximation, material in-system unknown, publication, or
  deployment remains hidden in this receipt; publication was not requested.

## Reported smell and parity question

- Reported web behavior: Acid Rain improved after recovering the Arena shader,
  but minor visual mismatches remain scattered through the current VFX. The
  earlier work explicitly stopped at the Arena/Boneyard pixel interval.
- Stock behavior to recover: the entire executable frame-to-pixel pipeline —
  application/surface scheduling, every primitive and state program, every
  shader and render target, all texture/sampler/alpha behavior, and every
  downstream scene/class consumer — then use that model to audit the complete
  Website presentation rather than tune isolated effects.
- Reproduction inputs/scenes: Loader, Title, Create, Courtyard and all private
  rooms, gameplay HUD/pickers/inventory, generated Arena/Tutorial, editor;
  player/enemy/loot/weather/status/death VFX; all primary/weld/secondary
  families; nested Region/Storm/Leviathan targets; desktop and mobile branches.
- Falsifiers: a raw D3D painter outside the catalog, an unlisted shader or
  state writer, any Website `screen`/blur/brightness approximation without a
  native selector, premultiplied RGB reaching native multiply, a VFX member
  missing from the reflection capture, or a browser capture with errors or a
  visible stock disagreement reopens this system.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Instructions | retail `SolomonDark.exe` 0.72.5, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; preferred base `0x00400000`; canonical Ghidra 12.0.3 replicas | 101 named pipeline targets, 4,009 xrefs, 562 callers, 404 selector writes, 129 device-global refs in 44 shared/device functions | high |
| Durable native catalogs | Mod Loader `native-full-render-pipeline.md`, `native-full-render-pipeline-xrefs.json`, `native-full-render-pipeline-membership.json`; complete class and atlas catalogs | 1,038 class relations, 451 atlas relations, 524 render-class rows, and 147 data/vtable xrefs all have dispositions; no scene/VFX class bypasses Graphics | high |
| Raw shader/data | `0x0043FD80`, `0x00B401F4`, `0x00B401F8`; embedded HLSL at `0x007DDB38/0x007DDCD8` | only Arena saturation is reachable; blur remains constructor-zero/unwritten and actually accumulates 24 taps divided by 20; no game vertex shader | high |
| Renderer dependency | pinned PixiJS `8.19.0`, `mapWebGLBlendModesToPixi` | Pixi multiply is `DST_COLOR, ONE_MINUS_SRC_ALPHA`; native selector two is `ZERO, SRC_COLOR`. Pixi NPM normal/add use Porter-Duff alpha factors `ONE`, while native non-separate D3D blending reuses `SRCALPHA`. Default `Texture.from(image)` uploads premultiplied data, while retail pages are unpremultiplied | high |
| Native alpha blend state | `D3D_ResetFixedFunctionState 0x0043FB60`; whole-image scalar-`206` census; Storm/Leviathan transparent target owners | no renderer write enables `D3DRS_SEPARATEALPHABLENDENABLE`; selector factors apply to RGBA, making target alpha part of the stock nested-composite contract | high |
| Native sampler state | reset `0x0041D000`, dispatcher `0x004208A0`, address helpers `0x00442E70/0x00442ED0`; complete `+0x239` displacement census | reset selects wrap and no retail request writer selects the compiled clamp alternative; all stock pages remain wrap-addressed | high |
| Current web source | `game-webgl.ts`, `native-ui-pixi.ts`, `boneyard-textures.ts`, `native-secondary-assets.ts`, Hub/Boneyard renderer roots, `hub-teacher.ts`, `hub-world-scene.ts`, `player-staff-vfx-presentation.ts` at task base `05f2232a` | Arena shader coverage is present, but stock pages still default to clamp, ExactText glyphs inherit linear sampling, non-Arena multiply differs, Teacher uses a false `screen` composite/timing, Staff Smoke has the wrong blend, and secondary membership stops at BadGuys 400 before the shared Fire explosion/Ember bank `401..433` | high |

## System boundary and membership inventory

Native system: the complete retail rendering system from `App_RenderFrame
0x0040D230` through Graphics/D3D state and `Present 0x00440B40`, including all
registered render classes and every Website consumer of their pixels.

The machine catalogs own every native function/class row. This table owns the
complete web-family join; “by this correction” is the required final
disposition and is not a completion claim until the receipt below is filled.

| Member family and complete web membership | Native source | Required disposition | Proof contract |
| --- | --- | --- | --- |
| App/Graphics lifecycle, WebGL creation, resize, frame/reset/teardown | `0x0040D230/2C0/310/350`, Graphics `0x0041C780..0x00421600` | `exact-ported` by shared pipeline correction | renderer-state unit contract plus every scene journey |
| all stock atlas/loose-image uploads and subtextures | `0x00420140`, `0x00440F70`; 28 atlases/12 loose images | `exact-ported` as unpremultiplied, linear, wrap-addressed sources; mod images remain `out-of-system` | source alpha/sample diagnostics |
| ExactText and bitmap-font glyph draws | `0x00421560`; 78 calls from 34 paired owners | `exact-ported` through wrap-addressed point-filtered font-source variants; nontext records retain linear sampling | source membership and scaled-glyph capture |
| all 13 quad/mesh/line primitives and sprite/text entry points | native full-pipeline primitive group | `verified-already-at-parity` for geometry; exact vertex-color paths retained | render-contract membership assertions |
| normal source-over members | selector `0`; 147 literal plus register-restored writes | `verified-already-at-parity` after shared texture representation cutover | class/VFX plans and screenshots |
| additive members: every cataloged Anim additive family, player/enemy spell glows, weather streaks, loot glows, seals and level-up art | selector `1`; 150 literal writes plus exact dynamic writers | `exact-ported`; Staff Smoke/`Anim_SmokePuff` is reopened from normal to additive | per-member blend inventory and VFX captures |
| multiply members: Region light target, College Statue/aura, Arena late multiply lanes, Inventory/HUD members | selector `2`; 14 exact writes | `exact-ported` through native `ZERO/SRCCOLOR`, never Pixi standard multiply | pixel equation test and Region/Hub/Inventory captures |
| selector alpha equations inside Storm/Leviathan/Region targets | separate-alpha disabled at `0x0043FB60` | `exact-ported` for opaque world renderers; transparent browser-overlay applications retain Porter-Duff alpha only as their required final CSS-composition adapter | blend-map tests and nested-target captures |
| Arena saturation and every nested Arena target | `0x0046ECA9..0x00470A76`, `0x00B401F4` | `verified-already-at-parity`; remains Arena-only | Acid/Storm/Leviathan/Building journeys |
| compiled blur capability | `0x00B401F8`, helper `0x00442AF0`, zero writers | `out-of-system` because unreachable retail code | absence contract; no web blur/bloom substitution |
| Loader, Title, Create, dialogs, settings, controls, Dark Cloud, Hall/GameOver | registered CPU surfaces and menu render roots | `verified-already-at-parity`; focus/accessibility-only CSS is `out-of-system` | stock layout replays and browser captures |
| Courtyard, Mortuary, Library, StoreRoom, Office fixed worlds | fixed Region render roots | `verified-already-at-parity` except shared multiply/source correction | Hub-room journey and visual reflection |
| Hub NPC/ambient VFX: seals, fountain, statue, traders, students, Astronomer, Teacher, Skorcha | exact Hub class renderers and child Anim classes | `exact-ported`; Teacher child program/timing/blends reopened | deterministic Teacher member assertions and Hub capture |
| HUD, belt, cooldowns, notifications, skill/inventory/book/picker overlays | `0x00512060`, `0x005D2520`, registered UI surfaces | `verified-already-at-parity` except shared multiply/source correction | HUD/inventory/picker journeys |
| Arena underlay, terrain, roads, scenery, gates, lanterns, trees, overlays, shadows, lighting, weather | Arena/queue/scenery catalogs | `verified-already-at-parity`; Tree/Lantern anonymous rows now identified | Boneyard render contract and stock draw-list replay |
| players, equipment, staff/orb, hit/death, level-up, nameplate/speech | Player/Wizard/Anim catalogs | `exact-ported`; Staff Smoke blend correction applies to Knockback/Critical | primary/staff/death/level-up captures |
| Skeleton, Archer, Mage, Imp/Green/GoodImp, Zombie, Wraith, Demon, Coffin/Maggot and every child effect | enemy and full state-write catalogs | `verified-already-at-parity`; dynamic aura blends are instruction-closed | enemy animation/projectile/death journey |
| Arrow, Firebolt, GuidedMissile, DemonBomb, PoisonPool and every impact/child | enemy projectile catalog | `verified-already-at-parity` | projectile-effect journey |
| five primaries and ten welded primaries, all persistent/impact/child actors | primary/weld catalogs and class-state programs | `verified-already-at-parity`; complete primary/reflection matrix closed | all-build deterministic capture set |
| every secondary/advanced member in `native-secondary-ability-catalog.json`, including Acid, Storm, Leviathan, Golem, Comet, Magic Circle/Trap/Shield and nested children | secondary catalog plus complete renderer membership | `exact-ported`; reflection reopened the missing Ring-of-Fire shared Fire explosion/Ember bank `401..433` | all-secondary deterministic capture set |
| Orb, Gold, Sack, Bonus, potion/powerup/item drops and pickup children | loot/reward renderers | `verified-already-at-parity` | loot journey and blend inventory |
| screen flashes, darkness, camera feedback and world shake | Region feedback plus camera `0x0063EEB0/0x0046F100..0x0046F276` | `exact-ported` by the 2026-08-31 reopening below, including the final vector reducer and Arena complex-light edge cover | camera/flash capture with settings gate and edge-pixel proof |
| Bonedit and portrait/offscreen capture | `0x004D5F40`, `0x005BED10` | `verified-already-at-parity` for active Website editor; portrait capture is `out-of-system` for `/game` | editor screenshot/contract |
| Website chat, party, diagnostics, mod panels/minimap/custom VFX | no retail member | `out-of-system` with separate browser/mod ownership | must not alter stock pixels when inactive |

There is no `blocked-by-platform` row. WebGL2 can express every active native
shader, primitive, sampler, target, and blend equation.

## Native ownership thread

- Owner and construction: `MyApp` embeds Graphics at `+0x1D0`; the application
  object manager schedules registered surfaces. Arena adds its world queue but
  concrete actors still enter shared Graphics.
- State representation: request/current pairs flush before blend, texture
  color, saturation, blur, address, filter, transform, clip, texture, or target
  changes. The frame reset returns to normal blend, textured modulation,
  unpremultiplied page samples, linear filtering, wrap, identity transforms,
  and no pixel shader.
- Downstream: every menu/world/HUD/editor/portrait primitive reaches one of
  `DrawPrimitiveUP` or `DrawIndexedPrimitiveUP`; the 129 direct device refs
  contain no scene painter bypass.
- Entry/teardown: device reset restores resources and fixed state centrally;
  scene/render-target teardown must not leave selector or shader state behind.

## Recovered behavioral contract and immediate falsifiers

- Native multiply is `destination.rgb *= source.rgb`; source alpha does not
  soften the RGB multiply. Pixi's standard multiply is therefore not parity.
- Native never enables separate-alpha blending, so the same selector factors
  also govern alpha. Pixi's default NPM normal/add alpha equations are not
  equivalent in transparent render targets even when their RGB equations are.
- Retail image RGB is not premultiplied. Normal/additive can be represented
  equivalently only with matching NPM blend modes; multiply requires raw RGB.
- Retail reset selects wrap on U/V and the complete address-request census has
  no later writer. Web stock pages must not retain Pixi's clamp-to-edge default;
  the compiled native clamp helper is dormant rather than a per-page policy.
- ExactText owners temporarily select point min/mag around glyph submission and
  restore the prior filter. A scaled bitmap glyph rendered from the ordinary
  linear source is not stock-equivalent; web font views need a point-filtered
  source variant without changing sibling art on the same native page.
- Teacher type 5008 uses the 100 Hz game clock. Cast releases after the native
  timer crosses 20 (`0.075` per tick), not a 60 Hz browser clock. Release
  `0x00505560` creates normal Anim_Fade records 15/82/81 and an additive
  Anim_SpriteArray over BadGuys `1823..1833`; no screen blend exists.
- Teacher core is fixed scale `(6,4)`, alpha `1`, loss `.1`; flare scale is
  `[1,1.1]`, alpha `1`, loss `.0075`; column alpha is `2`, loss `.04`; the
  additive 11-frame child has scale `[1.5,2]`, frame step
  `.75*(1+Float(.2))`, alpha loss `.02*(1+same draw)`, and one random mirror.
- Teacher's children are separate painter roots: flare is in pre-world manager
  `Region+0x278`, column then frames are shared-world children registered by
  `0x0063E5B0` at `teacher.y+15`, and core is in post-world manager
  `Region+0x22C`. Courtyard renders those lanes around queue flush `0x0068C480`;
  a single Teacher-child container is not stock-equivalent.

#### 2026-08-29 Region-queue follow-through

The complete layering residual sweep found that the browser still used that
forbidden single container: `worldRelease` had a raw row-derived Z and never
entered `applyNativeHubPainterOrder`. Fresh `0x00505560` decompilation confirms
two distinct `0x0063E5B0` calls—column/ZAnimLit first, SpriteArray wrapper
second. The correction moves their birth/order into authoritative Hub ambient
state as two transient registrations, presents them as two queue roots at
`teacher.y+15`, and drives the release from a Hub-local construction clock.
The already-correct flare/core direct lanes and every child formula/blend stay
unchanged.
- The column is structurally wrapped by `ZAnimLit`, but its light is dormant in
  Courtyard: reset/restore/composite `0x0057D4E0/0x0057D5E0/0x0057D670` and
  initializer `0x0057DF20` are Arena-only. The web Hub must not invent a radial
  light for it.
- Stock consumes the process-global RNG for Teacher frame, scale, rate, and
  mirror samples. Replicated web presentation supplies stable owner/cycle
  semantic words to the already established native mask, reduction, inclusive
  float lattice, and float32 store policy; it preserves every visible domain
  and draw relationship without claiming stock process-stream correlation.
- `Anim_SmokePuff::Render 0x00449840` is additive around its shared draw.
  The earlier Staff ledger's “normal-blend SmokePuff” statement is falsified
  and must die in the Staff implementation and tests.
- Burning Man's shared explosion and three Ember children reuse the already
  recovered Fire bank: array `401..419`, lit array `420..433`, plus the sibling
  Ember/body records. Primary Fire textures load this bank, but the secondary
  lookup rejects it because its closed membership ends at `400`. A dense wave
  can consume all three fragments in their ten constructor pre-ticks and hide
  the omission; an isolated child must render the whole `401..433` range.

## Confidence and open questions

- Confirmed: complete native target/xref/class/atlas/state membership; shader
  reachability; blend equations; Teacher and SmokePuff instruction programs.
- Inferred: none used to justify implementation.
- Unknown: none in native pipeline membership. Browser capture reflection may
  still reveal a web consumer violating a confirmed row; each such observation
  becomes a new concrete residual task rather than a tuned exception.

## Web implementation consequence

- Put unpremultiplied, linear, wrap-addressed stock texture creation and exact
  native multiply state in one shared WebGL module used by every game renderer.
- Install native normal/add alpha factors on opaque Hub/Boneyard renderers so
  nested targets are exact. Preserve Porter-Duff alpha only on zero-alpha
  browser overlay canvases, where CSS source-over is the final native-surface
  composition adapter rather than a stock render target.
- Route ExactText/bitmap glyph subtextures through wrap-addressed point variants
  of their source pages; do not switch nontext siblings on ControlPanel to point.
- Keep Arena saturation in its existing Arena-only deep module.
- Replace Teacher's normalized piecewise/screen composite with its exact
  100-Hz child programs and per-child normal/additive blend.
- Correct Staff Smoke through the shared native class rule, not a one-off
  color tweak.
- Join BadGuys `401..433` to the secondary texture membership so Ring of Fire
  shares the exact Fire explosion/Ember page records already owned by primary
  Fire; do not add duplicate crops or a Ring-only approximation.
- Remove only falsified presentation paths. Browser accessibility focus/chat
  effects and opt-in mod rendering remain separate and inactive in stock
  captures.

## Validation contract

- Focused tests: source alpha and native blend-map equations; full renderer
  membership; Teacher tick/member/RNG ranges; Staff Smoke and all sibling
  Staff members; absence of stock `screen`/blur paths.
- Browser: built Mac WebGL2 captures for every scene family and deterministic
  primary/secondary/enemy/loot/weather/status/death galleries; empty page,
  console, and failed-response arrays.
- Ring-of-Fire reflection must isolate its contact target, prove the explosion
  on the decoded wire, keep the three fragments alive long enough for a browser
  frame, and emit no closed-membership lookup errors for any record `401..433`.
- Reflection: inspect the complete capture set at native viewport against
  retained stock frames, exact stock assets, and recovered formulas. Record and
  execute every discrepancy, then repeat the sweep until it yields zero
  actionable residuals.
- Performance: measure p95/p99/max gaps and long tasks for dense Arena VFX;
  average FPS alone is not acceptance.

## Implementation validation receipt

- Implementation: `native-fixed-function-render-pipeline.ts` now owns every
  stock Pixi image source, exact native RGBA selector equations, wrap/linear
  defaults, point-filtered ExactText variants, render-target normalization, and
  context-restore replay. Opaque Hub/Boneyard renderers use native alpha
  factors; zero-alpha browser overlay canvases retain Porter-Duff alpha only at
  their final CSS-composition boundary. The complete source contract covers
  every game `Application`, `ImageSource`, `Texture.from`, blend, and
  `RenderTexture.create` owner and rejects stock clamp/screen/blur bypasses.
- Downstream corrections: Teacher now advances its exact 100 Hz core, flare,
  column, and 11-frame child programs in separate pre-world/world/post-world
  lanes with no invented light. Staff SmokePuff is additive. All stock bitmap
  glyph consumers use point-filtered source variants without changing sibling
  art. The secondary texture bank now closes BadGuys `401..433`, so Ring of
  Fire reuses the exact Fire explosion/Ember family rather than silently
  dropping it. Staff diagnostics expose the exact live VFX member name.
- Native completeness: the paired Mod Loader catalogs close `101` targets,
  `4,009` xrefs, `562` callers, `404` selector writes, `129` device-global
  references, `524` render-class rows, `1,038` class relations, `451` atlas
  relations, `147` orphan/data-vtable references, and `151` class state
  programs. The latest-tip Mac CI-safe registry passed `530/530`; log SHA-256
  is `6cc11c80669ceaa52537fe2e71e3a0d91c6def8a3c092bf21033b68d41185aa3`.
- Candidate/gate identity: Website source was rebased through current-main
  `a24bb5d02d37775612886e0aa912a5264a1732d6` and transferred with direct
  per-file SHA comparison reporting zero mismatches. The canonical Mac gate
  passed every backend, frontend, desktop, lint/boundary, Web Lua, production
  build, bundle-budget, media, and CSP stage. The production entry was
  `Game-BtzmG7Zv.js`, `259,898` raw / `78,549` gzip bytes; pre-receipt gate-log
  SHA-256 is `68c054a25f155395060857133560f39979448b6abfe24e0c461bfa8620b1b723`.
- Secondary/Acid proof: production Chrome/WebGL2 completed all `23/23`
  secondary rows with empty page, console, and response-error arrays. Acid
  Rain reached `176` actors / `224` primitives over `299` observed ticks; its
  3-second pacing sample recorded `181` frames, p95 `16.7 ms`, p99/max
  `16.8 ms`, and zero long tasks. The full-matrix log SHA-256 is
  `9853a6770f4a9c70da9b704c253aa947ad0d1273f6278e53376ae1367a4307af`.
- Independent Tutorial Acid proof captured natural browser input at exact age
  `60`: DeadHawg `4` normal underlay, BadGuys `78` normal/additive cloud, and
  BadGuys `10` additive streak, with empty error arrays. Screenshot SHA-256 is
  `21e673cba87d7b142135e00de033b9007689fd818ce93c91926d1d6ee6ec2fa1`;
  journey-log SHA-256 is
  `6a489124a6669c6a3039d2ba2808030d2edd294da1567426a8e864890b2ad5ea`.
- Scene/Staff proof: all four fixed Hub rooms entered and returned through
  native fades; Teacher release sampled age `2`, column alpha `1`, core
  `0.7999999523`, flare `0.9850000143`, frame alpha `0.9599790573`, with the
  player at `(516.523,722.720)` between its split painter lanes. Hub log
  SHA-256 is `8d98bb44726b1f7378e90bb8d2f8fecffc88cbf8fb75990c951b9fd4ef4a2257`.
  Production Staff proof rendered SmokePuff id `3` at age `2`, alpha `0.9`,
  scale `8`, while preserving movement, heading, two legal marker hits, damage,
  and audio; its log/screenshot SHA-256 values are
  `9c1a3aef65f82bbbf7f0f49b6b830ba885ee507e60f787ba6f21f0e92fe196d7`
  and `2bc0d3a4e49943a890f98bbb39aa7e74f0b5d4b78d332481ee26ae6f20ef9041`.
- Primary/enemy/environment proof: Ether fan/impact, Fire explosion/Ember,
  eight-lane Hurricane, Earth held/contact/terminal, and Water channel all
  completed with exact actor/audio contracts and empty errors. Fire's dense
  explosion sample held p95/max `16.7/16.8 ms`. Enemy/projectile, Frost/Stun
  recovery, four-building/21-monument lighting, and storm weather matrices also
  passed; their log SHA-256 values are respectively
  `3ccbbdfa72f866b35656b42a3e22da8b194e130c43d34ecdb60f9464dfac89a7`,
  `7a70f824058d96159f8dc08b507f0920af5bab7c66aa637703096943b2734f42`,
  `89715a00fbd0a7307a15352b758e1f37f8136cf2be06a496bbb7e1a75de670c7`,
  and `a2825ab91402f86ca43c1062060a67cbe1a0c6c10ffb107e11204a4da611fd11`.
- Built loot proof covered Gold, Sack/equipment, both Orbs, Bonus, open-goodie,
  and Damage-x4 active/fading/expired presentation with exact point-filtered
  labels and empty errors; log SHA-256 is
  `058a8785104122b40a628215e35b90fab94749f135b912f1f614878efe5c566f`.
- Reflection closure: every retained native-viewport capture was inspected
  after the final current-main rebase. Acid is pale, translucent, spatially
  bounded, and leaves terrain/enemies readable; other additive effects remain
  localized; multiply lanes preserve raw color; text edges are point sampled;
  nested targets, shadows, occlusion, and teardown remain intact. A final
  source/capture rescan found zero actionable render/VFX residuals, zero
  undispositioned native members, and no browser-platform blocker.
- Publication is authorized but remains a separate SHA receipt until the
  post-receipt exact gate and remote fast-forward proof complete. Deployment
  was not requested and is not part of this closure.

## 2026-08-28 — Secondary report: derived-page straight-alpha edge sampling

### Reported smell and parity question

- Reported web behavior: sprite and image boundaries are intermittently or
  persistently visible. The symptom follows camera/subpixel phase and is not
  confined to one actor or scene.
- Stock behavior to recover: preserve the retail renderer's linear/wrap
  sampling while giving every sampled page the alpha representation its pixels
  actually encode. Retail pages remain unpremultiplied; Website-precomposed
  pages must not masquerade as retail straight-alpha pages after their hidden
  transparent RGB has been discarded.
- Reproduction inputs/scenes: Loader, Title, Create, Hub, player portraits,
  Hub ambient actors, Boneyard players/Solomon/VFX, normal/additive/multiply
  passes, fractional camera translation, non-integral scale, and mirrored or
  rotated sprites.
- Falsifiers: changing native linear or wrap state; pixel snapping the world;
  applying one alpha policy to both original retail pages and Website-composed
  pages; allowing a premultiplied page into native `ZERO/SRCCOLOR` multiply;
  retaining a derived animation strip where the exact native atlas records are
  already resident; or accepting interior/hash tests without a transformed
  edge sample.

This reopens the complete-renderer entry. The prior reflection pass verified
page identity, blend selectors, and scene membership, but it did not inventory
the alpha representation of Website-generated pages or sample their borders at
fractional transforms. Its "zero actionable render/VFX residuals" conclusion
therefore did not cover the reported behavior.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail executable | unmodified `SolomonDark.exe` 0.72.5, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Same sealed renderer oracle as the complete pipeline recovery. | high |
| Retail pages | original `Clothes.png` `eaa1feb70362cf6dbc2068036f9cc9f77001d888e26cbd218c6144ebe63d6ac1`, `College.png` `34c10e60d30590b6211c678152d47cc30033679db5c986dc615d9923a71c43bd`, `BadGuys.png` `af5717b37c81306d515eed6d9f8717fa97bd1c63b9530a7079738c457c97443e`, and `Demon.png` `0a6feca43b7f1a35f09d43494a1c794c7962d555e52b13703439b72085529ae4` | Transparent texels adjacent to visible texels retain non-black source RGB on `340,694/340,715` Clothes pairs and `449,566/454,210` BadGuys pairs. This is the authored straight-alpha bleed consumed by native linear sampling. | high |
| Current Website pages | Website `6d712227`; player/hub packers, generated pages, Pixi texture frames | All `6,059/6,059` player rectangles and `572/572` Hub rectangles meet zero-RGBA gutters. Player pages have zero non-black transparent edge neighbors; Hub pages are overwhelmingly zero-RGB at derived edges. | high |
| Current sampling path | PixiJS 8.19.0 `TextureUvs`, `native-fixed-function-render-pipeline.ts`, Hub/Boneyard camera roots | Pixi emits exact frame-edge UVs without a half-texel inset; `roundPixels:false`, fractional camera positions, zoom feedback, rotation, and CSS scaling make bilinear samples cross the frame edge. | high |
| Blend equations | recovered selector `0/1/2`; Pixi PMA/NPM adjusted modes; Arena alpha-mode shader bit | With a black transparent neighbor, NPM normal/additive attenuates sampled RGB before source-alpha blending; native multiply ignores alpha and exposes the black sample directly. A PMA upload is algebraically equivalent for a Website-precomposed normal/additive surface, while multiply still requires raw NPM RGB. | high |
| Exact registered alternatives | BadGuys records `14/15/28/30/32/53/67/84/86/110..112/168..171/238..282/1836..1839/2002..2010` on the already resident native page | Current element, Fire impact/particle, Earth, Frost, shadow, and Hurricane assets need not use black-backed registered strips/canvases; exact native record textures already exist. | high |

The page pixel census is static-content evidence. No injected runtime or stale
ASLR address is used. The sampler/blend ownership remains instruction-derived
from the addresses already closed above.

### System boundary and membership inventory

Native system: **stock page representation through transformed sprite
sampling** — from an image's retail or Website-composed pixel ownership,
through Pixi source alpha mode and subtexture UVs, to normal/additive/multiply
blend and page teardown in every `/game` scene.

| Member family | Native/web source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Original retail atlas and loose pages | renderer uploads `0x00420140/0x00440F70`; 28 atlases/12 loose images | `verified-already-at-parity` as NPM, linear, wrap | pinned page/hash and source-policy tests |
| BadGuys/Demon combat pages and every registered subtexture | exact retail pages plus bundle rectangles | `verified-already-at-parity` as NPM | all record frames retain page source and native UVs |
| Native UI/font/inventory/skill/title page sources | exact tracked retail pages | `verified-already-at-parity`; ExactText point variants remain NPM | source identity and point/linear sibling tests |
| Loader composed logo/frame/fill/URL | Website registered/composed outputs | `exact-ported` as PMA linear composites | source policy plus scaled Loader capture |
| Title clouds, graves, Solomon layers, buttons, and labels | Website registered/composed outputs; native UI siblings remain exact pages | `exact-ported` as PMA linear composites | fractional backdrop/Solomon capture and NPM native-page negative assertion |
| Create hands, stars, element/discipline art, and name pieces | Website registered/composed outputs | `exact-ported` as PMA linear composites | entry/selection capture at non-integral display scale |
| Create element VFX | exact BadGuys registered families | `exact-ported` from the native BadGuys page, not derived strips | all five elements, frame membership, NPM page diagnostic |
| Hub compact visual pages | Website precomposed backgrounds, NPCs, props, students, particles | `exact-ported` as PMA linear composites | all 87 source families remain owned; fractional Hub capture |
| College Statue multiply aura | College registered art and selector `2` | `exact-ported` from a dedicated NPM loose source; never the PMA compact page | raw source/multiply diagnostic and perimeter pixel probe |
| Compact player pages in Hub/Boneyard | Website precolored/precomposed logical layers | `exact-ported` as PMA linear composites | all 84 sheets/8,563 frames; moving/fractional player and portrait captures |
| Element/Fire/Earth/Frost/selected-primary registered art in Hub/Boneyard | exact BadGuys records already resident in combat page | `exact-ported` from native record textures; derived runtime strips retired | record-by-record source and VFX matrix |
| Solomon Dig/dialogue/walk composite sheets | Website registered composites from Solomon records | `exact-ported` as PMA linear composites | Dig, dialogue, clipped hold, escape, and teardown capture |
| DeadHawg, Solomon Flydirt, roads, field textures, and other exact loose/crop sources | original page pixels or exact native crop | `verified-already-at-parity` as NPM | source-policy negatives and representative Boneyard samples |
| Region/Storm/Leviathan/weather/generated Buffer and RenderTexture sources | existing generated-target owners | `verified-already-at-parity` under their explicit alpha modes | existing target/weather contracts |
| DOM/CSS player portraits and other browser images | browser compositor | `verified-already-at-parity`; browser performs PMA interpolation before CSS composition | player-card/Hall/ally-chip capture |
| Mod-provided images | no retail source | `out-of-system` under the existing mod-image policy | stock path remains inactive when no mod is loaded |

There is no browser-platform blocker. WebGL2 and Pixi expose both alpha upload
modes, adjusted blend modes, exact source pages, and per-source policy.

### Native ownership thread and recovered behavioral contract

- Retail page loading owns unpremultiplied PNG RGB, including RGB beneath
  alpha zero. The renderer owns wrap/linear state globally; sprite records own
  only their frame UV and registration.
- Website extractors sometimes register, tint, resize, or alpha-composite
  several native records into one new bitmap. Those operations preserve the
  visible composite but erase the retail pages' hidden transparent RGB. Such a
  bitmap is a new precomposed surface, not an original retail page.
- PMA upload makes linear interpolation and normal/additive blending operate on
  the precomposed surface's coverage exactly once. Arena's existing per-texture
  alpha bit unpremultiplies the sample before the native saturation equation
  and premultiplies the final output again, preserving the recovered shader.
- Native multiply is the exception: `ZERO/SRCCOLOR` consumes raw RGB and
  ignores source alpha. The College Statue aura therefore remains NPM and must
  not share the PMA compact-page source used by ordinary Hub composites.
- Exact BadGuys records supersede registered strips/canvases wherever the
  native page is already a runtime resident. This removes both cross-frame
  sampling and duplicate decoded art without changing frame, registration,
  tint, blend, timing, or teardown.
- Source policy is fixed at page creation and ends when the owning scene
  destroys that source. It is presentation-local: no simulation, protocol,
  multiplayer, input, audio, or save state participates.

### Nearby-system findings

- The player compact pages decode to `34,889,728` bytes, over four times the
  original Clothes page. Replacing all precomposed player layers with live
  Clothes records remains a separate deep-module opportunity; it is not
  required to correct their current composite sampling and must not be mixed
  into this edge fix without its own complete player-painter migration.
- Create currently loads derived element strips even though the full native
  BadGuys page is the exact page/UV oracle. Using the resident page improves
  sampling truth but introduces a scene-local decoded-page cost that must be
  measured during acceptance.

### Confidence and open questions

- Confirmed: retail hidden-RGB representation; current compact-page zero-RGB
  borders; Pixi UV endpoints and alpha-mode routing; native blend equations;
  exact record membership; all current scene owners and teardown paths.
- Inferred: none used to choose the alpha policy.
- Unknown: none material to implementation. Create peak memory and frame pacing
  are validation measurements, not missing native facts.

### Web implementation consequence

- Add a named PMA-linear source policy beside the existing stock NPM-linear and
  point policies. Callers must opt in only for Website-precomposed sources.
- Route Loader, Title, Create, Hub visual pages, player pages, and Solomon
  composite sheets through that policy; keep exact native pages NPM.
- Keep the College Statue aura on a dedicated NPM loose source before assigning
  native multiply.
- Replace derived element/Fire/Earth/Frost/selected-primary runtime strips and
  logical canvases with their exact BadGuys record textures where already
  resident. Remove their preload/destruction ownership from the derived-frame
  path.
- Do not change filtering, wrap, camera rounding, sprite geometry, blend
  equations, native saturation, or browser UI scale.

### Validation contract

- Focused contracts must pin all three source policies, every scene's complete
  PMA/NPM membership, exact BadGuys record rows, absence of retired derived
  runtime strips, Statue multiply isolation, and teardown ownership.
- Pixel-formula tests must show a transformed transparent edge contributes the
  same RGB/alpha under retail straight-alpha-with-hidden-RGB and PMA composite
  sampling, and show why the PMA sample is illegal for multiply.
- Mac Chrome must render Loader, Title, Create, Hub, player portrait, moving
  Hub/Boneyard player, Hub Statue, Solomon, and representative normal/additive
  VFX at fractional positions/scales. Every journey records page, console, and
  failed-response arrays; all must be empty.
- Edge probes compare perimeter pixels across at least two subpixel phases and
  reject black/different-frame contamination outside the member's authored
  silhouette. Create and dense Hub/Boneyard journeys also record decoded source
  policy, p95/p99/max frame gaps, long tasks, and source counts.
- Run the exact candidate through the complete Mac `./scripts/validate.sh`
  gate, then repeat after any rebase required for publication.

### Implementation validation receipt

- Source ownership: `native-fixed-function-render-pipeline.ts` now defines the
  distinct PMA-linear composite policy beside unchanged NPM-linear retail and
  NPM-point text policies. `game-webgl.ts` applies it only to caller-declared
  composite sources. Loader, Title, Create, Hub, Hub Inventory, and Boneyard
  declare complete source membership; their canvases publish the effective
  alpha modes for browser proof.
- Exact record cutover: element VFX, Fire impact/particle, player shadow, and
  registered Earth/Frost/selected-primary rows resolve from the original
  BadGuys page. `nativeEnemyRegisteredFrame` restores logical origin/trim with
  tie-to-even registration. The combat-page owner resolves pages lazily so
  Create and Hub Inventory load only BadGuys, while Hub/Boneyard retain their
  established complete pages and teardown.
- Multiply isolation: Hub keeps exactly one loose original from the compact
  visual census, `hub-prop-statue-aura.png`, and uses it as NPM before native
  `ZERO/SRCCOLOR`. All other 86 Hub source families remain on the PMA compact
  pages; player pages are PMA in Hub, Hub Inventory, and Boneyard; Solomon Dig
  and encounter sheets are PMA only in Boneyard.
- Focused Mac contracts passed `92/92`, including all three source policies,
  all affected renderer families, exact record selection/registration, compact
  page ownership, and the multiply exception. The strengthened right-click
  atlas ownership test also passed independently.
- The pre-receipt canonical Mac gate passed backend build and `28/28`
  integration/contract tests, strict lint and architecture boundaries, every
  frontend suite including `1,693/1,693` Boneyard tests, desktop tests,
  production frontend/game-host builds, bundle budget, media policy, and CSP.
  Production entry `Game-Bm3WuAyc.js` measured `263,161` raw / `79,870` gzip
  bytes. Publication still requires the final exact-candidate gate after this
  receipt update.
- Built Mac Chrome/WebGL2 Hub proof traversed startup, Title, Create, and Hub,
  then proved `hubVisual/player = premultiply-alpha-on-upload` and
  `combat/statueAura = no-premultiply-alpha`. Acid remained authoritatively
  blocked in Hub; page, console, and response arrays were empty. Inspected
  screenshot SHA-256 is
  `d5373ebac9d1b84cd4b91777434f7e3171b819478d64e7bd9adddf04071399d1`.
- Built Mac Chrome/WebGL2 Boneyard proof proved
  `player/Solomon = premultiply-alpha-on-upload` and
  `combat = no-premultiply-alpha`, then naturally rendered Acid cloud, 174
  maximum actors, and 222 maximum primitives across 287 observed ticks. The
  three-second sample held 181 frames with p95 `16.7 ms`, p99/max `16.8 ms`,
  and zero long tasks. Page, console, and response arrays were empty; inspected
  screenshot SHA-256 is
  `9f75c1408a46ab120e75a93ac8dfb88bb7693d9ea219461875d40f8bf518f163`.
- Visual review of both retained native-viewport frames found clean player,
  spell, NPC, Statue-aura, and Acid silhouettes without black rectangular page
  edges or neighboring-frame contamination. The screenshots and raw browser
  logs are task evidence and must be deleted after their measurements/hashes
  are recorded.

## 2026-08-29 — Secondary report: straight-alpha draw opacity is squared

### Reported smell and parity question

- Reported web behavior: the recently updated Staff orbs look dull, flat, and
  wrong; Fire's additive yellow center is replaced by a muted green-yellow
  disk when the required half-alpha ordinary flame pass is present.
- Stock behavior to recover: retain exact straight-alpha retail page sampling,
  per-draw texture-factor RGBA, and selector `0/1/2` blending while applying
  texture alpha and draw alpha exactly once.
- Reproduction inputs/scenes: all five element painters in Create, Hub, Hub
  Inventory, Memorial portraits, and Boneyard; ordinary/additive/multiply
  draws; PMA Website composites; exact NPM native pages; batchable sprites and
  meshes; opaque and browser-overlay targets.
- Falsifiers: changing Staff scale, painter colors, painter order, source page
  alpha mode, wrap/filter state, or native blend factors; applying the fix to
  Fire only; changing the already-correct Arena shader; or accepting factor
  tests without a rendered fractional-alpha pixel.

This reopens the complete-renderer entry again. The original renderer closure
verified blend-state factors but did not compose them with Pixi's generated
batch shader. The derived-page correction then fixed page representation and
edge sampling, but intentionally kept exact native pages NPM. Neither pass
tested a straight-alpha texture with a fractional per-draw alpha through the
complete shader-plus-blend equation.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail executable | unmodified `SolomonDark.exe` 0.72.5, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000`, re-hashed 2026-08-29 | Sealed native renderer and painter oracle. | high |
| Fire instructions | Ghidra 12.0.3 read-only replica, `FUN_005360C0`, raw `0x005361F9..0x0053636E`; wrapper revision `08bfba9ef367f7b863848030d0a289dc31e33192` | Fire submits core, enables additive for BadGuys `255..266`, disables additive, sets texture-factor alpha `0.5`, submits the same frame normally, then restores white/alpha one. | high |
| Native constants | `0x007DE870 = 0.5`; `0x007DE918/0x00785860` form the `0.15 + 3.5` core scale terms; read-only `dump_floats_at.py` | The dimming normal pass is required native data, not a web opacity guess. | high |
| Pixi 8.19 shader/blend | pinned `pixi.js/dist/pixi.mjs`: `colorBitGl`, `fragmentGlTemplate`, `getAdjustedBlendModeBlend`, `mapWebGLBlendModesToPixi` | Batch vertex RGB is multiplied by vertex alpha before `finalColor = outColor * vColor`; an NPM normal/add draw then uses `SRC_ALPHA`, multiplying fractional draw alpha into source RGB a second time. | high |
| Current Website | `origin/main` `c3d10afca30b8d360bff69c6b79db1324535f3cc`; `native-fixed-function-render-pipeline.ts`, `native-element-vfx-view.ts`, exact BadGuys record cutover | Source policy, element records, painter programs, and blend maps are correct independently; the non-Arena default batch/mesh shader is the violating owner. | high |
| Mac WebGL2 differential | Chrome `151.0.7922.174`, 1600x900 Hub, 24 Fire frames on current main versus parent `559d2a06736047d7dcc0cc29ac58e00ee6249fb2` of NPM cutover `eb7772d07017e77bebdb7bca50104f7c95e35fda` | Current maximum green was exactly `191` in all 24 frames with zero stock-bright yellow pixels; the parent reached `254..255` and stock-bright pixels in all 24. Removing only the half-alpha normal flame restored brightness; removing additive left the expected faint normal/core result. | high |
| Clean stock corroboration | retained native Hub frame `Mod Loader/screenshots/hub_follow_20260417_194344_t00.png` | The stock Fire center reaches green `254` and visually agrees with the pre-cutover/additive-preserved result. | medium |

The browser evidence is a rendered-pixel observation. The native order and
constants are instruction/data evidence. The equation that identifies the
double application is a direct consequence of the pinned Pixi shader and GL
blend program, not an inferred color adjustment. Raw task captures remain
disposable after their measurements are recorded.

### System boundary and membership inventory

Native system: **texture sample plus draw-color modulation through fixed-
function selector blending** — from retail/PMA page representation and per-draw
RGBA, through batched or mesh fragment output, selector `0/1/2`, render-target
alpha, context restoration, and renderer teardown in every `/game` WebGL app.

| Member family | Native/web source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Exact retail NPM pages and registered subtextures | native page loaders `0x00420140/0x00440F70`; current BadGuys/Clothes/College/Demon membership | `verified-already-at-parity` for bytes, wrap, filter, UV, and alpha representation | existing page/source/edge contracts remain unchanged |
| Website PMA composite pages | Loader, Title, Create, Hub, player, and Solomon composite policies | `verified-already-at-parity` | corrected shader must reproduce the existing PMA output exactly |
| Non-Arena batched Sprite/quad Mesh with NPM texture | Pixi default batch pipe in `game-webgl` and Hub | `exact-ported` by this correction | alpha-mode-aware batch shader and rendered fractional-alpha pixel |
| Non-Arena standalone or unbatchable Mesh with NPM texture | Pixi mesh adaptor in `game-webgl` and Hub primary/secondary families | `exact-ported` by this correction | alpha-mode-selected mesh shader and source-equation tests |
| Non-Arena PMA batch/mesh draw | Website composites and Texture.WHITE/UI geometry | `verified-already-at-parity` through the corrected shared shader | PMA path emits premultiplied RGB and one final alpha |
| Arena NPM/PMA batch and mesh draw | `NativeArenaBatcher` and alpha-selected mesh shaders | `verified-already-at-parity`; existing shader already separates texture and vertex alpha | Arena contracts plus unchanged Boneyard visual receipts |
| Arena NPM ParticleContainer | native weather particle shader | `verified-already-at-parity`; already emits raw RGB with combined alpha | existing weather pixel probe |
| Selector 0 normal | `SRCALPHA/INVSRCALPHA`, no separate alpha | `exact-ported` with raw NPM or premultiplied PMA fragment representation | equation and pixel tests |
| Selector 1 additive | `SRCALPHA/ONE`, no separate alpha | `exact-ported` with raw NPM or premultiplied PMA fragment representation | equation and pixel tests |
| Selector 2 multiply | `ZERO/SRCCOLOR`, no separate alpha | `verified-already-at-parity`; NPM fragment RGB remains raw and independent of draw alpha | College Statue and Region multiply probes |
| Transparent browser-overlay targets | final CSS-composited zero-alpha applications | `exact-ported` with existing Porter-Duff alpha exception and corrected fragment RGB | overlay alpha/pixel regression |
| Ether painter | `0x00535A30`, records `110..112`, fractional normal/additive cores, sparks, rays | `exact-ported` through shared shader | plan membership plus browser capture |
| Fire painter | `0x005360C0`, records `110`, `255..266`, additive then ordinary `0.5` | `exact-ported` through shared shader | 24-frame pixel threshold and stock frame comparison |
| Air painter | `0x00536380`, records `110`, `1836..1839`, fractional additive layers | `exact-ported` through shared shader | plan membership plus browser capture |
| Water painter | `0x005370D0`, records `110/112`, `271..282`, fractional additive/normal rays | `exact-ported` through shared shader | plan membership plus browser capture |
| Earth painter | `0x005374C0`, records `110`, `238..245`, fractional additive ring/cores | `exact-ported` through shared shader | plan membership plus browser capture |
| Selected-primary and all Weld Staff programs | dispatcher `0x00539B80` and the 15-row Weld switch already owned by entry 237 | `exact-ported` through the same five painter members | selected-primary swap and Weld contract coverage |
| Create, Hub, Hub Inventory, Memorial, Boneyard Staff contexts | `NativeElementVfxView` callers and retained-view teardown | `exact-ported`; Boneyard remains on its Arena shader | context/source diagnostics, lifecycle tests, browser journeys |
| Other NPM normal/add VFX consumers | complete class/atlas families already inventoried above: primary, secondary, enemy, loot, status, weather, Hub ambient, text | `exact-ported` by the shared non-Arena shader or `verified-already-at-parity` in Arena | canonical suites and representative pixel journeys per family |
| DOM/CSS and mod-provided image composition | browser compositor or no retail member | `out-of-system` for this WebGL fixed-function correction | existing inactive-stock/mod policy |

There is no browser-platform blocker. WebGL2 exposes the required shader output
representation and all three native blend equations.

### Native ownership thread and recovered behavioral contract

- Native Graphics owns a straight-alpha texture sample, per-draw texture-factor
  RGBA, selector state, and target. Texture alpha and draw alpha combine once
  into source alpha; draw alpha does not separately attenuate RGB before the
  selector applies source alpha.
- For NPM input with sampled RGB `C`, sampled alpha `T`, tint RGB `V`, and draw
  alpha `A`, the fragment must emit `(C*V, T*A)`. Normal/add blending then
  contributes `C*V*T*A`; multiply consumes the raw `C*V` RGB.
- For PMA input the fragment must first recover the represented straight color,
  apply tint, combine alpha, then emit premultiplied RGB. Normal/add PMA factors
  consume that output exactly once.
- Pixi's default color bit instead emits vertex RGB already multiplied by `A`.
  Pairing that with NPM `SRC_ALPHA = T*A` produces `C*V*T*A^2`. At Fire's
  required `A=0.5`, the source term is one quarter instead of one half and the
  final ordinary pass visibly suppresses the prior additive flame.
- Arena's saturation shader already divides `vColor.rgb` by `vColor.a`, handles
  PMA/NPM texture samples separately, and recombines one final alpha. The shared
  correction must not wrap or replace that owner.
- Context restoration must recreate both the exact blend maps and the corrected
  batch/mesh shader owners. Renderer destruction owns their teardown. No
  simulation, protocol, networking, input, audio, or save state changes.

### Nearby-system findings

- The 2026-08-28 exact-record/page cutover is correct and must remain: reverting
  the element textures to PMA derived strips would hide the scalar-alpha defect
  while reintroducing false edge sampling and losing authored hidden RGB.
- The checked-in Staff journey does not dismiss the stock Tutorial offer, so a
  fresh profile can time out before reaching the renderer. This is an
  acceptance-harness defect and must be corrected alongside pixel assertions.

### Confidence and open questions

- Confirmed: native Fire order and `0.5`; Pixi shader and adjusted blend maps;
  first bad commit; 24-frame differential; all five fractional-alpha painter
  membership; current source policies; Arena's already-correct alpha shader.
- Inferred: none used to select the renderer correction.
- Unknown: none material. Performance and exact browser pixel thresholds are
  validation measurements rather than missing native facts.

### Web implementation consequence

- Extend the shared fixed-function module with an alpha-mode-aware non-Arena
  batch shader and mesh shaders. NPM fragments emit raw RGB plus combined alpha;
  PMA fragments emit premultiplied RGB plus the same combined alpha.
- Keep existing source policies, exact record textures, wrap/filter state,
  selector factors, painter programs, scales, geometry, and ordering unchanged.
- Make Boneyard explicitly delegate batch/mesh fragment ownership to the Arena
  renderer so the two custom pipelines cannot replace one another.
- Do not add Staff-specific colors, opacity transforms, square roots,
  duplicated textures, or compatibility fallbacks.
- Repair the focused Staff journey's Tutorial dismissal and add a rendered
  Fire pixel receipt; retain its structural `3/6/3` submission assertions.

### Validation contract

- Focused unit tests must pin the NPM and PMA fragment equations, normal/add/
  multiply results, shader ownership, context restoration, and Boneyard Arena
  delegation. Tests must fail under the former `A^2` equation.
- Existing plan tests must continue to enumerate every fractional-alpha member
  of Ether, Fire, Air, Water, Earth and every selected-primary/Weld dispatch.
- Mac Chrome must run the focused Staff journey from a fresh profile, produce
  no page/console/response errors, preserve `3/6/3` Fire submission counts, and
  show stock-bright Fire pixels across the animation rather than a `191` cap.
- Browser captures must cover all five elements in Create/Hub and one Boneyard
  Staff pulse, plus representative PMA composite, NPM additive, and NPM
  multiply consumers. No painter-specific compensation is acceptable.
- Run the complete Mac `./scripts/validate.sh` gate on the exact candidate and
  repeat it after any publication rebase.

### Implementation validation receipt

- Implementation: `native-fixed-function-render-pipeline.ts` now installs a
  per-texture-alpha-mode batch shader and matching PMA/NPM mesh shaders for
  non-Arena WebGL applications. NPM fragments retain raw sampled/tinted RGB
  and publish `textureAlpha*drawAlpha`; PMA fragments publish the same color
  premultiplied by that one final alpha. Existing native blend maps, source
  policies, wrap/filter state, and context-restoration replay are unchanged.
  Boneyard explicitly disables this owner before installing its already-exact
  Arena batch/mesh pipeline.
- Regression coverage: the fixed-function tests reproduce the old squared-
  alpha source term, prove the corrected NPM contribution equals PMA normal/
  additive output, and retain raw RGB for multiply. Renderer contracts require
  the new batch and mesh owners plus explicit Arena delegation. The Staff smoke
  now dismisses the Tutorial offer, supports all five elements, captures Create
  and Hub, retains Fire's full Boneyard journey, and samples twelve rendered
  Fire frames instead of accepting sprite counts alone.
- Red/green pixel receipt on Mac Chrome `151.0.7922.174`: unchanged current main
  failed with `maximumGreenMinimum=191` and zero bright-yellow pixels across all
  twelve Hub Fire samples. The candidate passed with
  `maximumGreenMinimum=254` and at least `208` bright-yellow pixels per sample,
  while preserving idle/overlap/pose-9 counts `3/6/3`, weapon scale one, and
  empty page/console/failed-response arrays.
- Five-element browser membership: Create and Hub passed with exact NPM source
  diagnostics for Ether, Fire, Air, Water, and Earth. Ordinary/overlap counts
  were Ether `26/54` in its variable-particle sample, Fire `3/6`, Air `6/12`,
  Water `4/8`, and Earth `4/8`. Fire retained the required Boneyard pulse and
  pose-9 proof; an additional Ether Boneyard run retained its variable painter
  (`26` idle, `22` pose 9). All completed journeys had empty error arrays.
- Selected-primary/mesh receipt: the existing Skill Book Chrome journey passed
  Hub Ether/Fire/restored-Ether counts `19/3/25` and Boneyard Ether/Fire counts
  `30/3`, including its NPM Skills-page Weld meshes, selectors, hotbar drags,
  audio edges, and empty page/console/network arrays.
- Visual inspection: all five Create/Hub effects retain their distinct stock
  painter stacks; Fire again has the bright yellow additive center, Ether keeps
  separated sparks, and Air/Water/Earth retain their authored cyan/green
  layers. Fire Hub and Boneyard screenshots hash to
  `5a99ca188c4a3db603cee382171177ad9779cef7a485bebaf9151e07be465cb1`
  and `a530f524f255b2b42c75ead4aa215f87babd94548683037610c5379ab3a52a68`;
  the complete element evidence manifest hashes to
  `7bd17b6f07a9a93c8f0e69b7f8f0210e0a4cca5087ce099bdffadf03c2e9e7bb`.
  The retained stock Hub capture hashes to
  `0d636fbe09c21d6a8457b67d8e635a43c39c4f95ef3566f15dcf69b83f056a1`.
- Pre-publication validation at base
  `c3d10afca30b8d360bff69c6b79db1324535f3cc`: supported Mac lint passed;
  the complete canonical gate passed backend build, `29/29` Website/backend
  contracts, lint and architecture boundaries, every frontend group including
  the central renderer/Boneyard set `1696/1696`, desktop tests, production
  frontend/game-host builds, media policy, and CSP. Production game entry
  `Game-W9ZCuyD3.js` measured `263161` raw / `79877` gzip bytes. Publication
  still requires rebase onto the moving `origin/main` and a repeat of the exact
  candidate gate/browser receipt.
- Final rebased candidate: the focused commit was replayed without conflict on
  `origin/main` base `d01cb94f2290ec33d4c3ed0cb459f358631c31ac`, preserving the intervening Frost
  Jet and Solomon Dig painter corrections. Local/Mac SHA-256 manifests matched
  for all eight changed files before validation.
- Final exact-candidate browser proof repeated all five Create/Hub painters on
  Chrome `151.0.7922.174` with NPM native-page diagnostics and empty error
  arrays. Ether sampled `24/44`, Air `6/12`, Water `4/8`, Earth `4/8`, and Fire
  `3/6`; Fire's full Boneyard journey retained pose-8/pose-9 counts `3/3`,
  weapon scale one, and live primary/secondary actors. Its twelve-frame Hub
  probe again held `maximumGreenMinimum=254` and at least `208` bright-yellow
  pixels per frame. Final Fire Hub/Boneyard screenshots hash to
  `3340b4d21155564f6c15ee9f76ce5bbeed8fd8d77bb3e5fdb99470af6f348acd`
  and `0cefc2f8a81f1c76bbaa69eb95243042e5ab0710b977489e28c7c3b04982bd22`;
  the final five-element evidence manifest hashes to
  `a4c6a9cbf5091d0a8d506aac9612160ddba3a0864b0a19bbfcee16542f4b0c56`.
- The rebased Skill Book journey also passed with Hub Ether/Fire/restored-Ether
  counts `17/3/24` and Boneyard Ether/Fire `26/3`, proving the selected-primary
  and NPM mesh paths with empty page/console/network arrays.
- The complete final Mac gate passed backend build, `29/29` Website/backend
  contracts, strict lint and architecture boundaries, every frontend group
  including the central renderer/Boneyard set `1700/1700`, desktop tests,
  production frontend/game-host builds, bundle budget, media policy, and CSP.
  Production entry `Game-D8972pWC.js` measured `263161` raw / `79872` gzip
  bytes. The complete gate log SHA-256 is
  `e33a3bdb8010b8fc68d35ebcbb495a37537f492388a64ab83f1fd141d411f204`.
  Publication remains a separate fast-forward and remote-identity receipt.

## 2026-08-29 — Secondary correction: a record crop is not a wrapped page

The Title Solomon seam reported after the PMA correction falsifies one member
classification in the 2026-08-28 report. Title records 0..6, 8, 11..24 are
exact frames of the retail `Title.png` page, not Website-precomposed pages.
Uploading each tight crop as its own repeat-addressed source changes the wrap
domain: every cloak's mostly opaque dark left column becomes the bilinear
neighbor of its translucent right column. At the stock two-times scale this
produces the reproduced one-pixel line at x `325/326`.

The corrected ownership is recorded in
`006-2026-08-14-title-solomon-eye-and-hood-painter-order.md`. MainMenu now
requires the byte-identical full Title page as NPM/linear/wrap and exact record
frames into that page. This does not change the three global source policies:
retail pages remain NPM/wrap, genuine Website composites remain PMA/wrap, and
point fonts remain NPM/nearest/wrap. It also does not authorize clamp, invented
padding, geometry changes, or removal of native duplicate painter passes.

Acceptance must cover every active MainMenu Title record, all five cloak
frames and wrap, the exact right-edge interval, responsive Title layouts, empty
browser error arrays, and the canonical Mac gate. The earlier Title row that
classified these exact record crops as PMA composites is superseded by this
correction; Website-authored logo/chrome/labels remain PMA composites.

Implementation and acceptance are complete in the Title-system receipt. The
live built source census reports the exact Title page present, loose Title
crops absent, retail NPM and Website-composite PMA simultaneously active, and
empty errors across stock/mobile/ultrawide/tall journeys. The measured seam
collapsed from `5.7772/5.7089` adjacent-column RGB delta to
`0.4467/0.4539`, without changing the shared wrap policy or another scene.

### Publication-rebase finding: Sprite-only applications have no mesh pipe

Rebasing the Title correction onto `acad2d24` exposed a separate lifecycle
assumption in that commit's new non-Arena alpha shader installer. Built Chrome
reproduced the failure twice before mounting the Title canvas:
`Native fixed-function rendering requires Pixi WebGL batch and mesh owners.`
The DOM prompt remained, but the renderer error surface replaced the canvas.

Pixi installs render pipes from the renderable extensions present in an
application's module graph. Loader and Title are Sprite/Graphics applications;
they require the corrected texture-alpha batcher but do not own or submit a
Mesh pipe. Create/Hub contexts that import Mesh do own the adaptor. Requiring a
mesh adaptor from a renderer that cannot submit meshes is therefore a false
lifecycle invariant, not a missing native painter member.

The shared installer must always require and install the batch owner when
texture-alpha shaders are enabled. It must install the mesh owner when that
pipe exists, remain strict if an existing mesh pipe lacks its shader, and do
nothing mesh-specific when the application has no mesh pipe. This is capability
membership, not a fallback: no Mesh draw is admitted without a Mesh pipe, and
all existing Create/Hub mesh paths keep the corrected PMA/NPM shaders.

Acceptance adds a Sprite-only renderer-owner regression, repeats the built
Loader/Title journey with the exact Title source assertions, preserves the
upstream batch/mesh/Arena contracts, and reruns the canonical Mac gate after
the publication rebase.

Implementation keeps the corrected batch owner mandatory and returns before
mesh installation only when the renderer has no Mesh pipe. A present mesh pipe
still requires its initialized shader and receives the upstream PMA/NPM mesh
owners unchanged. The focused Sprite-only regression passes, and the rebased
complete Mac gate remains green through all contracts, frontend/desktop tests,
builds, budget, media, and CSP.

The rebased production Chrome journey now mounts Loader and Title across stock,
mobile, ultrawide, tall, and live-resize layouts with empty errors. Every live
receipt reports exact Title present, loose Title crops absent, Title/native NPM,
and Website-composite PMA. The right-edge measurement remains collapsed at
`0.4817/0.4106`, so the renderer-lifecycle correction does not reopen the
sampling fix. Exact post-receipt validation and remote SHA identity remain the
publication boundary.

## 2026-08-29 — Third edge report: artificial page addressing and source-policy net

### Reported smell and process failure

- Reported web behavior: Create hands retain visible straight edges after the
  Title Solomon correction. The user explicitly asks to turn the known examples
  into a net for unknown members.
- Stock behavior to recover: wrap belongs to complete retail pages. A Website-
  created bitmap or packed page has an artificial boundary and must not sample
  its unrelated opposite edge.
- Skipped rule: the 2026-08-28 pass separated PMA from NPM but copied retail
  wrap into the PMA composite policy. The Title correction removed one exact-
  crop family from that policy, but did not falsify composite `repeat` globally
  or remove the loader's implicit unclassified-stock default.
- Reproduction and falsifiers: the Create evidence in ledger 007; any composite
  source still reporting repeat; any requested source silently receiving a
  default policy; any source belonging to multiple policies; any active exact
  Create/UI record still loaded as a loose page; or any browser scene with a
  straight page-boundary residual.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Native sampler | reset/address census already closed above | Retail NPM pages remain linear/repeat. No finding changes native state. | high |
| Create asset/data | exact Create page and records 0..23; Website pose composites; pixel census in ledger 007 | The second reported seam is produced by opposite edges that exist only because the web manufactured a new repeating page. | high |
| Web policy | `NATIVE_COMPOSITED_TEXTURE_SOURCE_OPTIONS` at `41ec3c8f` | PMA upload is correct, but `addressMode: repeat` still folds artificial page edges together. | high |
| Web loader API | `loadGameTextureMap/Entries(requestedSources, options)` | Stock is an implicit fallback; composite/point sets are optional and overlaps are not rejected. A future source can silently enter the wrong policy. | high |
| Packed pages | Hub/player packers place every trimmed rectangle with a one-pixel zero-RGBA gutter | Internal composite-frame sampling is coverage-safe under PMA; clamp is required only at the artificial outer page boundary. | high |

### System boundary and membership inventory

Native/web system: **declared WebGL texture provenance through source construction**
— every `/game` WebGL image source must enter exactly one policy before decode/upload;
every scene consumes the resulting page and destroys it at its existing owner.

| Source family | Required policy/disposition | Proof contract |
| --- | --- | --- |
| complete retail linear pages | NPM, linear, repeat; `verified-already-at-parity` | exact hashes and full-page source identity |
| complete retail point-font views | NPM, nearest, repeat; `verified-already-at-parity` | exact font page plus point sibling |
| true Website composites and packed pages | PMA, linear, clamp-to-edge; `exact-ported` by this correction | policy equation, page-boundary capture, packer gutter contract |
| exact native record users | frame of the owning complete retail page; `exact-ported` | Title and Create/UI record maps; no loose-page runtime source |
| Loader composed/rotated art | true composite clamp | Loader scaled journey |
| Title Website logo/chrome/labels/Hall art | true composite clamp | Title policy and responsive journeys |
| Create rendered name labels | true composite clamp | Create name field and hand journeys |
| Hub visual pages and compact player pages | packed composite clamp | Hub rooms/player movement/portrait journeys |
| Boneyard player and Solomon composite pages | packed composite clamp | moving player/Solomon journeys |
| exact BadGuys/DeadHawg/College/Demon/native-UI pages | retail repeat | existing VFX/UI/multiply receipts |
| generated RenderTexture/Buffer resources | explicit owner policy, outside image-source classifier | existing Arena/Region contracts |
| mod-provided images | `out-of-system`; separate mod loader | inactive stock path and mod contracts |

### Recovered contract and implementation consequence

- Replace the optional-set loader with an explicit source-group plan. `stock`,
  `stockPoint`, and `composited` are a closed partition: duplicate membership
  throws, and there is no unclassified fallback.
- Keep stock policies unchanged. Define the composite policy independently as
  PMA/linear/clamp; it must not spread the stock repeat option.
- Migrate every loader caller in one cutover. A future asset cannot load until
  its owner chooses one provenance group, making wrong or missing membership a
  failing construction rather than a latent visual smell.
- Migrate all active Create and UI records to their complete native pages and
  assemble hands from exact record sprites. Do not solve the known line by
  masking, snapping, or padding invented colors.
- Publish per-scene policy diagnostics and strengthen menu/world browser
  journeys to require native repeat, composite clamp, zero policy conflicts,
  and the expected source-family counts.

### Validation contract

- Pure source-plan tests reject duplicate membership, preserve deterministic
  ordering, and prove every policy maps to the exact alpha/filter/address tuple.
- Static contracts enumerate every `loadGameTextureMap/Entries` owner and reject
  the former array-plus-optional-options API, implicit point source, composite
  repeat, and direct ImageSource bypasses.
- Per-member tests pin Create 0..23/UI 42/80, packed-page one-pixel gutters, and
  all Loader/Title/Create/Hub/Hub Inventory/Boneyard/skill-screen source groups.
- Built Mac browser acceptance covers Loader, Title, both Create phases, Hub,
  player portrait/movement, College Statue, Boneyard player/Solomon, and at
  least two fractional display scales. Error arrays and policy conflicts must
  be empty; known edge intervals must match their neighbors.
- Run the exact candidate through the canonical Mac gate, repeat browser
  acceptance after any publication rebase, then prove local/tracking/remote
  identities separately from deployment.

### Implementation and game-wide acceptance receipt

- `planGameTextureSources` now requires an explicit closed partition of
  `stock`, `stockPoint`, and `composited` sources. Empty plans, empty members,
  duplicate members, and cross-policy membership throw before image decode;
  no source receives a fallback policy.
- All eleven WebGL image-loading owners were migrated in the same cutover: Native UI
  workbench, Loader, Title, Create, Hub, Boneyard, gameplay pause, Hub
  inventory, HUD skill selector, Skill Book, and Skill Picker. Static coverage
  enumerates that owner list and rejects the former optional-set API or direct
  unclassified `ImageSource` construction.
- Stock linear and point pages remain NPM/repeat. The independently declared
  composite policy is now PMA/linear/clamp. The Hub and player atlas packers'
  one-pixel zero-RGBA gutters remain pinned so internal packed-frame filtering
  cannot pull a neighboring member.
- The first optimized-production journey proved the classifier itself: Vite
  content-deduplicated the byte-identical Hub and native Fonts PNGs to one URL,
  and Title failed closed when that URL appeared under both stock and point
  policies. Title and Create now consume the one canonical exact Fonts page as
  point/NPM/repeat; a contract forbids reintroducing the duplicate loose font
  source in either renderer.
- Production Chrome `151.0.7922.174` passed Title and both Create phases across
  four layouts with exact Title/Create/UI pages, no loose record crops,
  composite clamp, stock repeat, and empty error arrays. Title reports 19
  sources; Create reports its closed six-source membership.
- A production Hub journey reports player and Hub visual pages as
  clamp/PMA while combat and College Statue aura pages remain repeat/NPM. Its
  inspected screenshot hashes to
  `2d22545ebef8363c3368c9cecf95cd8beb68ec7d77789bf8820d4d7df7be959e`.
  A production Boneyard journey reports player and Solomon pages as clamp/PMA
  while the combat page remains repeat/NPM; its inspected Ring of Ice frame
  hashes to `514fb09505e7afc333db1911feb54789cd8fc84b8853c25643fd0d89ec721077`.
  Both journeys used WebGL2 and had empty page/console/response error arrays.

## 2026-08-30 — Fourth edge report: registered combat records across resize

### Reported smell and parity question

- Reported web behavior: straight or otherwise artificial lines have appeared
  over Water and Ether primary VFX and were seen earlier over Fire. The player
  has reproduced the artifact in both windowed and fullscreen presentation and
  suspects a fullscreen-to-window resolution transition.
- Stock behavior to recover: a complete retail page, its registered record
  rectangle, and the renderer's texture-coordinate convention must remain one
  stable sampling system through initial creation, resize, fullscreen entry and
  exit, backing-resolution changes, context restoration, and teardown. No page
  neighbor, stale batch data, or transient target edge may become a visible
  line.
- Skipped rule in the earlier closure: the source-policy net proved complete
  page provenance and artificial *outer-page* addressing, but did not exercise
  every registered subtexture boundary before and after a live renderer resize.
  Its Boneyard receipt sampled Ring of Ice rather than the Water/Ether/Fire
  record families named by this report. The earlier completion claim is
  therefore reopened rather than used to dismiss the new observation.
- Reproduction inputs/scenes: isolated full-power Water, Ether, and Fire in Hub
  and Boneyard; stock `1600 x 900`, fractional logical layouts, fullscreen
  entry/exit, repeated wide/narrow viewport transitions, and at least one DPR
  or backing-resolution transition when the browser exposes it.
- Ranked falsifiable causes before instrumentation: (1) registered subtexture
  UVs admit adjacent retail-page texels under linear filtering; (2) resize or
  context replay leaves stale texture/batch coordinates; (3) a resized
  RenderTexture is sampled for one frame with old geometry; (4) Region painter
  proxy/clip ordering exposes a narrow world band over translucent VFX. A
  source-policy label alone is not acceptance for any of these.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Player report | 2026-08-30 report quoted above | The symptom crosses Water, Ether, and Fire and correlates with display-mode changes; it is intermittent rather than one permanently corrupt loose image. | medium |
| Prior browser diagnosis | Codex thread `01a04b58-3714-7883-9ed1-57ed1688b128`; commits `1ec8b1f3`, `41ec3c8f`, and `9f26f3eb` | Earlier edge failures came from wrong alpha/page ownership, crop-level repeat, and artificial composite-page repeat. The final pass explicitly introduced a closed source-policy partition, but did not close record-edge sampling through resize. | high |
| Current asset path | `boneyard-combat-atlas.generated.ts`, `boneyard-combat-atlas.ts`, `boneyard-textures.ts`, `hub-textures.ts` at `a554ea73` | Combat sprites frame reconstructed complete BadGuys/Demon retail pages and correctly classify those pages NPM/linear/repeat. The initial hypothesis that these two pages escaped into the composite policy is falsified by their `native-pages` layout and pinned hashes. | high |
| Current lifecycle | `HubScene.tsx`, `BoneyardScene.tsx`, both world renderers, `BoneyardRegionLightField` at `a554ea73` | Scene-owned resize changes logical viewport and renderer resolution; Boneyard additionally resizes the Region light target. No existing browser test combines active primary VFX, live display transitions, and pixel-edge assertions. | high |
| Native record constructor | read-only Ghidra 12.0.3 replica; `Native_SpriteBundle_ReadRecord 0x00413B10` -> `0x00413DE0`; raw constants `0x007DE808 = double 0.5`, `0x007DE8F0 = double 0.25`; Mod Loader tool revision `08bfba9ef367f7b863848030d0a289dc31e33192` | Every common record passes atlas `x/y/w/h` through one constructor. Its unrotated branch writes `u0=(x+0.5)/pageWidth`, `v0=(y+0.5)/pageHeight`, `u1=(x+w+0.25)/pageWidth`, and `v1=(y+h+0.25)/pageHeight`. All 10,498 retail records have rotation byte zero, so this is the complete shipped table, not a sampled class. | high |
| Native record submission | `0x004143D0/0x00414540 -> TextQuad_Draw 0x0041E990`; decompile and raw instructions | Direct and transformed sprite paths pass the constructor's four UV pairs at descriptor `+0x4C` to `TextQuad_Draw`; that function copies them into four vertices without later normalization or inset. | high |
| Website record submission | PixiJS 8.19.0 `Texture.updateUvs`; `boneyard-combat-atlas.ts`, `native-ui-pixi.ts`, and sibling derived-record constructors | Pixi writes `x/pageWidth` through `(x+w)/pageWidth`. The prior ledger called these “native UVs,” but the native constructor above proves both endpoints differ. Renderer resize preserves the wrong values while changing the screen-space sampling phase. | high |
| Atlas-neighbor census | exact BadGuys page SHA-256 `af5717b37c81306d515eed6d9f8717fa97bd1c63b9530a7079738c457c97443e`; records `28`, `30`, `110..112`, `251..270` | Fire frame 258 has 29/29 opaque texels immediately above its record rectangle. Other named records have authored alpha-zero hidden-RGB neighbors. Pixi's missing top inset can therefore create an opaque foreign row for Fire and hard/colored record edges for Water/Ether as fractional transforms move the bilinear footprint. | high |

### System boundary and membership inventory

Native/web system: **registered retail-record sampling and display-resource
lifecycle** — from each authored atlas rectangle and full-page sampler through
derived Pixi `Texture` UVs, batch/mesh upload, scene render targets, display
resize/context replay, and destruction.

| Member (family/scene/branch) | Native/page source | Current disposition and required proof |
| --- | --- | --- |
| Water Frost Jet normal/over core and glint | BadGuys records `30` and `28`; Hub and Boneyard | reopened; pre/post-resize pixel and UV proof required |
| Ether flight/impact cores, sparks, rays, blast, and pierce | BadGuys `110..112`, `11`, `45`, and `53`; Hub and Boneyard | reopened; every pass/record family must remain line-free |
| Fire flight core/body, particles, impact, explosion, ember, and patches | BadGuys `110`, `251..270`, `401..433`; DeadHawg `46..77`; Hub and Boneyard | reopened; shared page and both blend paths required |
| Air, Earth, Frost, selected-primary, Weld, Staff, enemy, projectile, loot, status, weather, and ambient combat records | complete BadGuys/DeadHawg/Demon/College pages and existing catalogs | sibling sweep required; no untested registered-record class may retain a different UV/lifecycle path |
| Title/Create/native UI exact record textures | complete Title/Create/UI pages | sibling exact-record path; retain existing seam regressions across resize |
| ExactText point views | complete native font pages | sibling filter variant; retain point/repeat and resize proof |
| Website composites and packed player/Hub/Solomon pages | PMA/linear/clamp pages | adjacent source family; retain outer-boundary regressions and prove it does not share a record-edge correction illegally |
| Region/Arena/light and other generated render targets | explicit RenderTexture owners | reopened only for resize sequencing and one-frame stale-target falsification |
| Initial scene creation, live CSS resize, fullscreen entry, fullscreen exit, DPR/backing change, context restore, scene replacement, teardown | application/Graphics lifecycle and browser display adapter | reopened; state and resources must remain coherent at every transition |
| Mod-provided images and inactive browser-only UI | separate mod/browser owners | `out-of-system`; must remain inactive during stock acceptance |

### Native ownership thread and validation contract (open)

- Retail Graphics owns one sampler/UV convention for every record on a complete
  page; scene display changes do not mutate authored record rectangles.
- The common unrotated bundle constructor owns the exact UV rectangle. For an
  atlas record `(x,y,w,h)` on page `(W,H)`, its submitted corners are
  `((x+0.5)/W,(y+0.5)/H)`, `((x+w+0.25)/W,(y+0.5)/H)`,
  `((x+0.5)/W,(y+h+0.25)/H)`, and
  `((x+w+0.25)/W,(y+h+0.25)/H)`. The rotated branch exists, but all shipped
  records select the unrotated branch. The older statement that Pixi's exact
  frame-edge endpoints were native-equivalent is superseded.
- Website scene owners retain the loaded retail pages and derived record
  textures across resize. Hub changes the renderer backing store; Boneyard also
  resizes its Region light target. Context restoration replays fixed-function
  state, while teardown destroys derived frames before their owning sources.
- Instrumentation must capture the exact active record, frame rectangle, UVs,
  page dimensions/address/filter/alpha mode, renderer logical and physical
  size, resolution, render-target sizes, painter depth, and pixel interval for
  every suspect frame before and after each transition.
- A failing browser loop must be established before implementation. Acceptance
  requires repeated active Water/Ether/Fire transitions in both scenes, a
  sibling record sweep, zero straight-edge detections, stable UV/resource
  diagnostics, empty browser error arrays, and the complete Mac gate on the
  exact candidate. Findings and the final disposition of every row above will
  be recorded here before publication.

### Causal reproduction and completed membership sweep

- The reported screenshot class is reproduced in the stock-size Create element
  phase on untouched `a554ea73`, Chrome `151.0.7922.174`. At application tick
  `513`, Water uses record `275` and its ordinary/ray stack exposes a straight
  horizontal record boundary at output rows `555..556`; the mean RGB row deltas
  over X `560..709` are `17.9933` and `16.8267`, versus adjacent values below
  `3.66`. The screenshot SHA-256 is
  `a9fc1a5f8b1f1e3360a9fb92148b64da26d3e1d4939bbfa2e3e5c30e77f321e3`.
  Ether has the same straight top-edge residual. Fire does not show it in that
  sampled frame, matching the report that Fire was intermittent/earlier rather
  than permanently affected.
- Replacing only registered-record UV construction with the recovered native
  endpoints removes both visible lines. The candidate stock-size Create frame
  at tick `517` uses the same Water record `275`; row deltas collapse to
  `3.3044/3.4467`, and visual inspection shows no straight Water or Ether edge.
  Its screenshot SHA-256 is
  `c541417b860ffa21c54c6d84be279a05c437909256c2f371e17963ed147d6aae`.
  Fire remains visually stable. This falsifies stale resize resource, Region
  target, and painter-proxy causes for the reported line: Create owns no Region
  target or world queue, and the failing pixels follow exact record top edges.
- The same helper must own every full retail record texture, including native
  UI records/slices/glyphs, BadGuys/Demon combat records, and manual Fonts
  glyph consumers. Website PMA packed pages keep their existing artificial-page
  frame semantics and do not receive the retail-record transform.
- The remaining runtime record-crop census found three source classes. Exact
  BadGuys and Demon pages were already resident. DeadHawg and Golem still used
  hundreds of loose files despite exact full pages being available; they move
  to their pinned `2048x2048` and `512x512` retail pages. Clothes record `2`
  has an alpha-zero one-pixel visible-content inset, so its exact crop plus
  NPM/linear/clamp is sample-equivalent. College record `41` is opaque to every
  edge, and each immediate native-page neighbor equals the corresponding edge
  texel byte-for-byte, so its exact crop plus NPM/linear/clamp is also
  sample-equivalent. These two proven framed crops do not justify a fallback
  for any other record.

### Final recovered contract and implementation disposition

- `nativeSpriteRecordTexture` is the sole WebGL constructor for a retail bundle
  record. It applies the unrotated `0x00413DE0` UV endpoints, interpolates any
  native record-relative slice within that domain, and reapplies the values if
  Pixi updates the texture. The complete shipped rotation table is zero, so no
  active rotated branch remains undispositioned.
- The source partition now has four explicit members: complete retail pages are
  NPM/linear/repeat; sample-equivalent framed retail crops are
  NPM/linear/clamp; point-font page views are NPM/nearest/repeat; Website
  composites are PMA/linear/clamp. Duplicate or missing classification still
  fails before decode.
- BadGuys, Demon, DeadHawg, and Golem use four byte-identical retail pages with
  pinned hashes and all `3,164` non-empty record rectangles. Enemy, secondary,
  loot, Water/Fire/Ether/Air/Earth/Frost, Weld, Staff, weather, Region glyph,
  Gate, Solomon grave mark, and Golem consumers share those pages and the same
  record constructor. DeadHawg/Golem loose runtime URLs are retired from the
  GPU membership; static editor/Canvas2D extraction remains a separate CPU
  painter input.
- Native UI atlas records, full-record slices, point glyphs, Title/Create name
  glyphs, NPC prompts, world nameplates, and world speech use the same recovered
  record UV owner. Hub College record `41` and Clothes record `2` are the only
  `stock-framed` members, backed by the border proofs above.
- Display resize changes renderer backing dimensions only. It must retain the
  same texture objects, record UV values, source alpha/address/filter policy,
  and scene state. Context/source update replays the record UVs; scene teardown
  destroys derived records before their page sources as before.

### Exact-candidate implementation and acceptance receipt

- Focused Mac tests pass `92/92` across native record UV construction, fixed
  function/source policy, renderer ownership, four-page Boneyard atlas
  membership, Hub, enemy, secondary, and loot contracts. The atlas generator
  now pins all `3,164` non-empty records across BadGuys, Demon, DeadHawg, and
  Golem; the decoded page set is `35,651,584` bytes and no active WebGL
  DeadHawg/Golem member falls back to a loose record URL.
- The canonical Mac gate passes the complete exact candidate: backend `28/28`,
  central renderer/Boneyard `1,780/1,780`, every remaining frontend group,
  optimized build, media/CSP checks, and bundle budget. The optimized game
  chunk is `266,414` raw / `80,975` gzip. Combined gate-log SHA-256 is
  `2217f07a490004a9e019157ae947ac47de307cacdfe95f3654a105ccf2aff466`.
- Production Chrome `151.0.7922.174` passes Title/Create at stock, mobile,
  ultrawide, and tall layouts. Exact Ether-core/ray, Fire-258, and Water-275 UV
  tuples remain unchanged while one mounted mobile Create canvas resizes to
  `1200 x 1000` and back. All five element VFX remain clean and every page,
  console, and response error array is empty. Inspected stock and live-resize
  Create images hash to
  `54f48bb7f9de3167e763b93286a774f5adc1ca75cc8f7d3951212684d1ef7978`
  and `74d3a81941a64aca6b9b1b93dd66c060c8f2b541aecba8fa615a87d67e7c2c05`.
- Independent production journeys pass Hub policy replay, one active Golem,
  Ring of Fire, held Water, held-facing Ether, and Ether impact with empty
  browser error arrays. The representative inspected frames hash to
  `aed9b98600ae0837e7ef411cbb698ece9099f5cd5f525cc74a0e43a9ee49f4f8`,
  `118f02bf4d0cd62f7bbb66b60c6201716602857d00e8597ca64dde7469280be6`,
  `9bf9017f20c28d7b3801050fc1da1d99d57feb79e3ee3ab854496044092847a8`,
  `2c0c8da2c4733f6aaa771dd421048bf8e37f54b4136df7a50c81b69996c40c61`,
  `d575aaa4288fdc15cd7c5d5478e94217478bfd7b4fb0487999a284c36b652b86`,
  and `f1edc25b745244237575b1246a4d27d7c4a3c77ecce1b5943539984c2f6851f1`.
  Visual inspection finds no foreign horizontal record edge in the named
  Water/Ether/Fire family or the swept siblings.
- After successive publication rebases, a fresh detached Mac worktree on final
  parent `7d61602d` reran the canonical gate
  (`job_20260830T212915Z_24947d2806`), the complete responsive Title/Create
  journey (`job_20260830T213319Z_2c2cea6296`), held Water
  (`job_20260830T213411Z_c974f34e1e`), and held-facing/impact Ether
  (`job_20260830T213453Z_45029cba85`). Those final jobs all exit zero against
  the same runtime source tree. Two earlier gate attempts timed out in unrelated
  host-message tests while the Mac was under heavy contention; every failing
  test passed in isolation, untouched-main comparison passed `1,783/1,783`,
  the candidate's standalone suite passed `1,783/1,783`, and the complete
  canonical repeat then passed.
- Non-passing Water attempts exposed fixture races (ice-start audio and Solomon
  speaking state), not renderer failures. The fixture now keeps the player
  pinned only until Solomon enters speech, releases position before the combat
  wave, and repeated production runs pass. This change is test orchestration
  only; spell timing and rendering are unchanged.
- Disposition: record-UV admission was the cause of the reported line.
  Resize-target staleness and Region/painter layering are falsified for this
  symptom. Every system-boundary row above is now `exact-ported`,
  `verified-already-at-parity`, or explicitly `out-of-system`; no active stock
  record constructor, loose GPU crop family, resize branch, or lifecycle
  unknown remains open.

## 2026-08-31 — Fifth edge report: Arena displacement cover after Region light

### Reported smell and parity question

- Reported web behavior: a player capture titled
  `SDB - Earthquake Screen Edge Bug.mp4` shows thin bright bands at the gameplay
  viewport edge while Earthquake shakes the Arena.
- Stock behavior to recover: the final reduced Region displacement vector, the
  pre-main complex-light composite, and the native edge-cover pass that keeps
  the shifted light target from exposing fully bright world pixels.
- Reproduction inputs/scenes: generated Boneyard with Complex Lighting and
  Camera Shake enabled; Earthquake skill `41`; positive and negative vector
  components; squared magnitudes below, at, and above one; live resize; Camera
  Shake off; Flash and Meteor as the other current Website vector producers.
- Process failure: the original renderer closure classified camera feedback
  and world shake as verified after checking the displacement transform and
  settings gate, but it did not inspect Arena instructions
  `0x0046FB13..0x0046FC31` or assert viewport-edge pixels while the Region
  multiply target was displaced. The later record-edge passes exercised other
  lines and explicitly falsified Region layering only for those record-boundary
  symptoms; they did not cover this vector/light interaction.
- Falsifiers: a solid clear-color band instead of textured world; the artifact
  with no Region light target; a stock branch that pads or recenters the target
  rather than drawing cover geometry; a cover threshold other than squared
  length one; a Hub/private-room cover despite the absence of an Arena Region
  light manager; or a cover that paints above screen flash/HUD ownership.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Player capture | Windows Downloads video, 1920x1080, 15.379833 seconds, SHA-256 `8090726d8db157e305d05f1b13dd037c5fc68f92da3d0171360dacd5b8f63de2`; inspected frame at approximately 5.0 seconds SHA-256 `e15a9db57e0d607ad0982ce699c91c322428889b409270f944d82f3951db46b4` | The exposed left-edge band contains recognizable ground texture at far-field brightness. It is not the black Pixi clear color, so insufficient world geometry/culling is falsified; the pre-main multiply coverage ends inside the viewport. | high direct observation |
| Current Website causal trace | `nativeSecondaryWorldShake`, `NativeSecondaryScreenFeedbackPresentation`, `boneyard-world-renderer.ts`, `BoneyardRegionLightField` at final integrated base `b964dde51bd18041dd16ff08a5096db5c77cde3f` | Earthquake, Flash, and Meteor produce displacement consumed by `world.position`; the Region light composite is a child of that same shifted world. No stage or world child paints the newly exposed edge. Earthquake and event lanes are reduced separately and then added, so concurrent vectors also violate the one native reducer. | high |
| Retail identity and tooling | `SolomonDark.exe` 0.72.5, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000`; canonical Ghidra 12.0.3 read-only replica; Mod Loader revision `08bfba9ef367f7b863848030d0a289dc31e33192`; wrapper SHA-256 `b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49` | Same sealed executable and read-only toolchain as the renderer and Region-light closures. | high |
| Region reducer | `0x00448590`; fresh decompile and all-reference trace | The helper replaces `Region+0x8E0C/+0x8E10` only when the incoming vector has greater squared magnitude. The binary has 28 direct callsites in 24 functions; Earthquake `0x00613200` is one producer, not a special render branch. | high instruction-derived |
| Arena render order | `Arena::Render 0x0046EC80`; raw `0x0046F007..0x0046FC31`; light composite `0x0057D670`; rectangle helper `0x0041DD70` | Arena applies the vector to Graphics before world painting. With Complex Lighting on, it composites the Region target, tests `dx*dx + dy*dy >= 1`, selects opaque black, and submits two rectangles before restoring white. Complex Lighting off skips this block and composites the target later. | high instruction-derived |
| Exact cover geometry | raw `0x0046FB51..0x0046FC0C`; `0x0041DD70` decompile | Rectangle one is `(x=-dx, y=-dy, width=W+2*dx, height=dy)`. Rectangle two is `(x=-dx, y=-dy, width=dx, height=H+2*dy)`. Negative dimensions retain native signed geometry; there is no guessed padding, CSS mask, or zoom surrogate. | high instruction-derived |

No injected runtime or stale ASLR address is used. The player video proves the
web pixel result; the preferred-image instructions prove the stock owner,
threshold, geometry, setting branch, and painter order.

### System boundary and membership inventory

Native system: **Arena complex-light displacement edge cover**, beginning with
the already reduced Region vector at `+0x8E0C/+0x8E10`, continuing through the
Arena world transform and pre-main Region-light composite, and ending with the
two black cover rectangles before later screen/UI painters.

| Member / branch | Native source | Required disposition | Proof contract |
| --- | --- | --- | --- |
| largest-vector reducer and reset/decay lane | `0x00448590`, Region tick `0x0063EFC0` | `exact-ported` by this correction across current Website producers | one strict largest-squared reduction over decayed carry plus live Earthquake proposals; `.75` event decay |
| Earthquake continuous vector | `0x00613200 -> 0x00448590`; skill `41` | `verified-already-at-parity` for vector generation; consumer cover `exact-ported` by this correction | deterministic positive/negative components and edge pixels |
| Flash response vector | `0x00649890 -> 0x00448590`; skill `53` | `verified-already-at-parity` for event/decay; consumer cover `exact-ported` by this correction | magnitude-three event, decay, threshold crossing |
| Meteor impact vector | `0x00610880 -> 0x00448590`; Weld `1007` | `verified-already-at-parity` for impact event/decay; consumer cover `exact-ported` by this correction | magnitude-ten impact and retained cover during decay |
| other reducer callers: Demonskull Flair/Mouth Beam `0x00448BE0/0x0044FFE0`; UltraBanish/general fade `0x00460AB0`; Skeleton/Heartmonger `0x00477580`; Demon `0x00487300`; Portal `0x00489CC0`; DemonSkull `0x004963C0`; DireFaculty `0x0049D0D0`; Coffin `0x004A2760`; Flame Lash/Blizzard Beam `0x005408F0/0x00541870`; PlaneOrb `0x005FB460`; Shockwave/FreezeWave/Knockback `0x005FF8C0/0x005FFDC0/0x00600220`; DemonBomb `0x00603CA0`; OffscreenMagic `0x00607B60`; Leviathan/Golem/EtherDrain/Comet `0x006145D0/0x00615CD0/0x0061CF20/0x006220D0` | remaining 25 callsites in the complete 28-callsite xref set | `out-of-system` for this consumer correction: each producer formula/lifecycle belongs to its existing enemy, primary, secondary, or welded-effect owner; whenever that owner publishes a nonzero final Region vector, the shared cover consumes it without a member-specific branch | xref census remains closed; no producer-specific cover path exists |
| Complex Lighting on | global `0x00B3BCA8 != 0`; first `0x0057D670` call at `0x0046FAFA` | `exact-ported` by this correction | cover is present only after the pre-main multiply composite |
| Complex Lighting off | branch to late composite at `0x00470102` | `verified-already-at-parity`; no cover | no artificial black band when the pre-main target is absent |
| squared magnitude below one / at one | `0x0046FB13..0x0046FB26` | `exact-ported` by this correction | `<1` hidden, `==1` visible |
| signed X/Y geometry at every viewport size | `0x0046FB51..0x0046FC0C` | `exact-ported` by this correction | exact two-rectangle plan before/after resize |
| Boneyard generated modes and Tutorial Arena | shared `Arena::Render` | `exact-ported` through one Boneyard renderer owner | ordinary, generated, and Tutorial journeys |
| Hub Courtyard/private rooms | no Arena light manager/composite branch | `out-of-system`; displacement remains, cover does not | Hub negative assertion |
| Camera Shake off | Website adaptation of `Game.ZoomFX` | `verified-already-at-parity`; zero final vector means no cover | persisted setting journey |
| world nameplates/speech, screen flash, DOM HUD and modal UI | later stage/DOM painters | `verified-already-at-parity` after inserting cover directly above the world and below these consumers | stage-child order contract and browser capture |
| resize, scene replacement, context restore, destroy | Arena/application lifecycle | `exact-ported` by retained viewport-sized cover owner | redraw dimensions, no stale graphics/resources |

There is no browser-platform blocker. Pixi Graphics can express the exact two
signed black quads and stage order.

### Native ownership thread and recovered behavioral contract

- Region producers compete through one largest-squared-vector reducer. Arena
  consumes only the final vector; the cover has no actor, skill, or scene-asset
  switch.
- Arena applies the vector before its camera-scale/world transforms. The Region
  light target is composited on the complex-light path under that displaced
  transform, so its camera-visible top/left boundary can enter the viewport.
- Native does not resize, pad, recenter, or zoom the light target to hide the
  exposure. It paints two opaque-black signed rectangles after the multiply
  composite whenever squared displacement is at least one.
- The two rectangles share origin `(-dx,-dy)`. Their dimensions are
  `(W+2*dx,dy)` and `(dx,H+2*dy)`. This covers only the target-leading edge
  represented by the signed vector and preserves the stock black boundary;
  replacing it with duplicated world pixels or an arbitrary overscan would be
  visibly different.
- The block exists only when Complex Lighting is enabled. With Complex
  Lighting disabled, Arena skips it and performs the Region composite later.
- The cover is world-adjacent presentation state: it paints above Arena world
  pixels and the pre-main multiply result, but below nameplates, speech, screen
  flash, HUD, pause, and other browser UI. It has no gameplay, collision,
  audio, replication, save, or input state.
- Resize changes `W/H` on the next plan. Camera Shake off supplies a zero final
  vector. Scene destruction releases the one retained Graphics object with the
  renderer.

### Nearby-system findings

- The fresh reducer xref sweep found 28 native callsites in 24 functions. The
  earlier top-level renderer row did not record that producer membership. This
  correction closes the edge-cover consumer independently of those effects'
  already separate mechanic/presentation ledgers and records the complete xref
  set above so a later producer audit cannot mistake Earthquake for the only
  native vector writer.
- `NativeSecondaryWorldShake.magnitude` remains zero by construction. That is
  not this defect: the Region vector lane is a pixel displacement, while the
  separate scalar `+0x8E04` lane owns zoom feedback. Feeding raw vector length
  into scalar zoom would create a many-times world scale and is falsified by
  the native two-rectangle branch.

### Confidence and open questions

- Confirmed: reported pixel class; exact native branch, threshold, color,
  rectangles, setting gate, painter order, reducer xref count, current Website
  displacement/light ownership.
- Inferred: none used to choose implementation.
- Unknown: none material to this consumer correction. Per-producer mechanics
  remain governed by their existing owning ledgers rather than duplicated here.

### Web implementation consequence

- Add a pure native displacement-cover plan beside the shared camera-feedback
  presentation, preserving the exact squared threshold and two signed native
  rectangles.
- Give Boneyard one retained Pixi Graphics owner directly above the world and
  below nameplates, speech, and screen flash. Redraw it from the final gated
  displacement, current viewport, and live Complex Lighting setting each frame.
- Replace the current cross-lane sum with one native largest-squared reduction:
  seed it from the decaying event-owned displacement, then apply live
  Earthquake proposals in actor-manager order. Use that final vector for both
  world translation and cover; do not add an Earthquake-only cover branch.
- Clear the Graphics object for Complex Lighting off, Camera Shake off,
  squared magnitude below one, scene replacement, and destroy. Do not change
  Region target sizing, world culling, camera FOV/zoom, CSS, or assets.

### Validation contract

- Focused unit contract: exact two signed rectangles for all four sign
  quadrants; `<1` versus `==1`; Complex Lighting off; resize dimensions; zero
  vector; combined current Website displacement input.
- Renderer contract: cover stage order is world, cover, nameplates/speech,
  screen flash; one retained owner is redrawn rather than allocated per frame;
  settings and resize update it; destroy releases it.
- Mac Chrome/WebGL2: cast Earthquake naturally in a generated Boneyard with
  Complex Lighting and Camera Shake on; sample frames with positive X/Y;
  require the exposed edge interval to be predominantly opaque black rather
  than a bright textured world band. Repeat Camera Shake off and Complex
  Lighting off negative branches. Focused reducer contracts retain the
  already recovered Flash and Meteor event displacement as the shared seed.
- Capture page, console, failed-response, WebGL, vector, cover-rectangle, and
  edge-pixel diagnostics. All error arrays must be empty. Run the exact
  candidate through `/opt/homebrew/bin/bash ./scripts/validate.sh` on the Mac.

### Implementation validation receipt

- Implementation: `nativeArenaDisplacementCoverPlan` now owns the exact
  squared-length-one branch and both signed rectangles. Boneyard retains one
  Graphics owner at the Region-composite Z interval, after the composite and
  before the shared world queue; its screen geometry is inverse-projected into
  the transformed world so camera/FOV feedback cannot move it away from the
  viewport edge. Resize and live settings redraw or clear that owner, and
  renderer destruction releases it.
- Reducer correction: `nativeSecondaryWorldShake` now seeds from the decaying
  event displacement and applies live Earthquake proposals with the native
  strict largest-squared comparison. Boneyard no longer adds two independently
  reduced vectors, and the obsolete always-zero pseudo-magnitude no longer
  participates in scalar zoom.
- Red/green regression: the pre-fix Mac gate reached the new tests and failed
  exactly on the obsolete `{magnitude:0,x,y}` result and missing cross-lane
  reducer contract. The corrected focused contracts cover all four signed
  cover quadrants, `<1`/`==1`, Complex Lighting off, viewport dimensions, zero
  displacement, retained event-vector priority, and larger Earthquake
  replacement.
- Pre-final-rebase canonical Mac gate
  `job_20260901T002046Z_e5fecfeab6` exited zero. The central Boneyard group
  passed `1,752/1,752`; the renderer/UI group passed `92/92`; backend,
  remaining frontend, desktop, TypeScript, lint/boundary, optimized frontend
  and game-host builds, media, and CSP stages all passed. Production entry
  `Game-C2JcaZLz.js` measured `263,738` raw / `80,238` gzip bytes within
  budget. Combined log SHA-256 is
  `b0c2f0a4bb3a0ca0e198b6f2d26a04e1ab12a6d6117876059004c00d910f6cf7`.
  One immediately preceding unchanged attempt saw the unrelated
  `developer observer watches one private run` timing assertion observe tick
  `100` instead of `93`; that test passed in the canonical repeat and no
  unrelated source was changed.
- Built physical-Mac Chrome/WebGL2 acceptance
  `job_20260901T002435Z_3aa0729e7f` naturally cast Earthquake in a generated
  Boneyard and exited zero with empty page, console, HTTP-response, and WebGL
  error arrays. At final vector `(-0.1795605086, 8.3982518315)`, the renderer
  emitted native rectangles
  `(0.1795605123,-8.3982515335,1599.6408691406,8.3982515335)` and
  `(0.1795605123,-8.3982515335,-0.1795605123,916.7965087891)`.
  The resulting `1600x9` top-edge interval was `92.0556%` black, with mean
  maximum channel `1.49264`; sparse nonblack pixels are later queue/weather
  painters above the native cover rather than exposed bright terrain.
- The same browser journey proved both setting branches while the Arena was
  paused on the live effect: Complex Lighting off cleared the cover, Camera
  Shake off zeroed the final vector and cleared it, and both persisted settings
  were restored before resume. Earthquake audio, floor/child presentation,
  cooldown, and `27` observed animation ticks remained live. Acceptance log
  SHA-256 is
  `60f530141f40066261483701b0f339b3f0bb01b33225bd6637eed8c0cb8760e5`;
  the inspected frame SHA-256 is
  `e437dfebaf3511c31c767bd50090f01043021a64ee52386542ea454fb40cdfa2`.
- Final integration: `origin/main` advanced through the broad cleanup and
  Hagatha presentation commits while this task was being validated. The patch
  rebased cleanly onto final base
  `b964dde51bd18041dd16ff08a5096db5c77cde3f`; byte-identical files were
  transferred into a fresh detached Mac worktree. Canonical gate
  `job_20260901T003237Z_7dc429716b` exited zero with the integrated central
  Boneyard group `1,749/1,749`, renderer/UI `92/92`, every other gate stage,
  and production entry `Game-idbAKnzv.js` at `263,743` raw / `80,255` gzip.
  Combined log SHA-256 is
  `db37294ad88f0da3dd6965d4044f39273eec64dbd5e06f5d5b6b1ecb53506b08`.
- Final built Chrome/WebGL2 job `job_20260901T003618Z_4a6e9ebc76` also exited
  zero on that integrated bundle. Vector
  `(-0.7204929247,6.0073274422)` produced the exact signed rectangles and a
  `1600x7` top-edge sample that was `99.0982%` black with mean maximum channel
  `0.50545`; both settings-off branches passed and all browser error arrays
  remained empty. Log SHA-256 is
  `11565b7d937ed3774f594fa6f9275acc0f42b42bea9a36b847bd1969d6943746`;
  inspected frame SHA-256 is
  `2718c82cdddeef44ef7fed0e5e8d1ac883d3e846e9d6b053b592d4709552f266`.
- No browser-platform approximation or remaining consumer unknown exists.
  Commit and push were authorized by the subsequent user instruction;
  deployment and live-production proof remain separate and were not requested.

## 2026-09-02 — Secondary plane-galaxy primitive supersession

The renderer-wide `exact-ported` rows above are superseded for Plane Orb and
Leviathan by the final section of
`084-2026-08-20-secondary-ability-native-ownership-correction.md`. The earlier
reflection pass verified mesh geometry and the global NPM/blend pipeline but
did not prove that `NativeSecondaryMeshDraw` retained Plane Orb's native packed
vertex colors. It also accepted Leviathan's target owner without recovering
the complete direct record-75/38 parent program, record-39 multiply-mask role,
lower clear, and two target-output passes. The 2026-09-02 reopening owns the
complete membership, correction, and current validation receipt.
