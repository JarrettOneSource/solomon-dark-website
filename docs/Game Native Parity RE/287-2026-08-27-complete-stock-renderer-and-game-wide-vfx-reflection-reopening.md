# 2026-08-27 — Complete stock renderer and game-wide VFX reflection reopening

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
| screen flashes, darkness, camera feedback and world shake | Region feedback plus camera `0x0063EEB0/0x0046F100..0x0046F276` | `verified-already-at-parity`; deterministic local-player pulse retained | camera/flash capture with settings gate |
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
