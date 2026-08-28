# 2026-08-22 — Building roof vertex lighting and Monument control-family audit

## Reported smell and parity question

- Reported web behavior: Building / Monument roof lighting is visibly wrong in
  the current `/game` Boneyard renderer.
- Stock behavior to recover: determine whether the large scenery families use
  the ordinary object-root scalar, the pre-main raster field, a late proxy
  exemption, or a class-owned surface-lighting program; recover every selector
  and setting branch before changing the browser.
- Reproduction inputs/scenes: all Building selectors `0..3`, all Monument
  selectors `0..20`, Complex Lighting on/off, Enhanced Effects on/off, and a
  moving player light whose field crosses each object's upper surface.
- Falsifiers: Building base and upper painters use only `+0xCC`; the upper
  painter supplies an independent color array; Monument calls the specialized
  query; the Building grid is inferred from PNG alpha instead of glyph data;
  or the browser already submits per-vertex Building colors.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail image | unmodified Beta `0.72.5` `SolomonDark.exe`, `4,723,200` bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred image base `0x00400000` | Same executable is present in the stock, staged, and Proton diagnostic copies; all hashes agree. | high |
| Fresh instructions/decompilation | Building `0x0060E5B0`, `0x0060E940`, `0x0060EC50`; tessellator/draw `0x00417510`, `0x00416B80`; specialized query `0x0057E640`; xrefs at `0x0060EA84`, `0x0061DF7E`, `0x0061DFBC` | Building lazily creates a 3x3/2x2 grid, samples every base-grid point, packs grayscale per vertex, draws its base with those colors, then reuses the same array for its late roof. | high |
| Fresh Monument negative trace | Monument main `0x0060E210`, shadow `0x0060E280`, common dispatcher `0x00624B40` | All 21 Monument rows remain one ordinary root-tinted main glyph; no Monument path calls `0x0057E640`. | high |
| Retail data/constants | DeadHawg base rows `148..151`, roof rows `152..155`, Monument rows `156..176`; floats `0x007925E8 == 135`, `0x007DE9B8 == 100`; doubles `0x007DE860 == 1.5`, `0x00794E50 == 145` | Every authored row and specialized-query constant is extracted; selectors 0/1 shift nonfinal sample rows, not geometry. | high |
| Current web causal trace | Website `origin/main` `0574fa68`; `boneyard-world-renderer.ts`, `native-render-plan.ts`, `render.ts`, `boneyard-lighting.ts` | Every visible main resident, including Building, receives one root tint at `layer.pos`; only Tree foreground residents have a lighting owner, leaving Building roof white. No vertex-color Building path exists. | high |

The stock conclusion is instruction/data-derived rather than a one-frame visual
guess. The pinned native report now owns the complete formulas and xrefs in
`../Mod Loader/docs/reverse-engineering/native-lighting-and-shadow-system.md`.

## System boundary and membership inventory

Native system: **Building elevated-surface lighting**, bounded from glyph-grid
initialization and specialized Region sampling through packed vertex color,
base/roof submission, setting gates, and teardown. Monument is the complete
reported sibling/control family. Every xref of the shared specialized query is
included below; Wall and ZFightHelper are dispositioned into their separate
generated-mesh system rather than silently omitted.

| Member | Native source | Pre-fix web finding | Disposition |
| --- | --- | --- | --- |
| Building base selector 0 / DeadHawg 148 | `0x0060E940`, `+135` nonfinal-row offset | one root tint | `exact-ported` retained vertex mesh |
| Building roof selector 0 / DeadHawg 152 | `0x0060EC50`, shared `+0x168` colors | white late sprite | `exact-ported` shared base colors |
| Building base selector 1 / DeadHawg 149 | `0x0060E940`, `+100` nonfinal-row offset | one root tint | `exact-ported` retained vertex mesh |
| Building roof selector 1 / DeadHawg 153 | `0x0060EC50`, shared `+0x168` colors | white late sprite | `exact-ported` shared base colors |
| Building base selector 2 / DeadHawg 150 | `0x0060E940`, zero offset | one root tint | `exact-ported` retained vertex mesh |
| Building roof selector 2 / DeadHawg 154 | `0x0060EC50`, shared `+0x168` colors | white late sprite | `exact-ported` shared base colors |
| Building base selector 3 / DeadHawg 151 | `0x0060E940`, zero offset | one root tint | `exact-ported` retained vertex mesh |
| Building roof selector 3 / DeadHawg 155 | `0x0060EC50`, shared `+0x168` colors | white late sprite | `exact-ported` shared base colors |
| Monument selector 0 / DeadHawg 156 | `0x0060E210` | ordinary root tint | `verified-already-at-parity` |
| Monument selector 1 / DeadHawg 157 | `0x0060E210` | ordinary root tint | `verified-already-at-parity` |
| Monument selector 2 / DeadHawg 158 | `0x0060E210` | ordinary root tint | `verified-already-at-parity` |
| Monument selector 3 / DeadHawg 159 | `0x0060E210` | ordinary root tint | `verified-already-at-parity` |
| Monument selector 4 / DeadHawg 160 | `0x0060E210` | ordinary root tint | `verified-already-at-parity` |
| Monument selector 5 / DeadHawg 161 | `0x0060E210` | ordinary root tint | `verified-already-at-parity` |
| Monument selector 6 / DeadHawg 162 | `0x0060E210` | ordinary root tint | `verified-already-at-parity` |
| Monument selector 7 / DeadHawg 163 | `0x0060E210` | ordinary root tint | `verified-already-at-parity` |
| Monument selector 8 / DeadHawg 164 | `0x0060E210` | ordinary root tint | `verified-already-at-parity` |
| Monument selector 9 / DeadHawg 165 | `0x0060E210` | ordinary root tint | `verified-already-at-parity` |
| Monument selector 10 / DeadHawg 166 | `0x0060E210` | ordinary root tint | `verified-already-at-parity` |
| Monument selector 11 / DeadHawg 167 | `0x0060E210` | ordinary root tint | `verified-already-at-parity` |
| Monument selector 12 / DeadHawg 168 | `0x0060E210` | ordinary root tint | `verified-already-at-parity` |
| Monument selector 13 / DeadHawg 169 | `0x0060E210` | ordinary root tint | `verified-already-at-parity` |
| Monument selector 14 / DeadHawg 170 | `0x0060E210` | ordinary root tint | `verified-already-at-parity` |
| Monument selector 15 / DeadHawg 171 | `0x0060E210` | ordinary root tint | `verified-already-at-parity` |
| Monument selector 16 / DeadHawg 172 | `0x0060E210` | ordinary root tint | `verified-already-at-parity` |
| Monument selector 17 / DeadHawg 173 | `0x0060E210` | ordinary root tint | `verified-already-at-parity` |
| Monument selector 18 / DeadHawg 174 | `0x0060E210` | ordinary root tint | `verified-already-at-parity` |
| Monument selector 19 / DeadHawg 175 | `0x0060E210` | ordinary root tint | `verified-already-at-parity` |
| Monument selector 20 / DeadHawg 176 | `0x0060E210` | ordinary root tint | `verified-already-at-parity` |
| Complex Lighting on | `0x0060E943`, `0x0060EC53` | Building wrong | `exact-ported`: grid plus specialized query |
| Complex Lighting off | same branches, plain `Glyph_Draw` | white base/roof | `verified-already-at-parity` after mesh colors force one |
| Enhanced Effects on | `0x0060E5B9..0x0060E5DC` | browser capability fixed on | `exact-ported`: 3x3 default path |
| Enhanced Effects off | same branch | no user-facing browser toggle | `exact-ported`: 2x2 pure contract retained for the native setting branch |
| Wall endpoint surface lighting | `0x0061DF40`, two `0x0057E640` calls | separate approximate generated-wall painter | `out-of-system`: non-roof generated mesh; retain xref/formula for its own full-system pass |
| ZFightHelper endpoint lighting | `ZFightHelper` slot `+0x1C -> 0x0061E990 -> 0x0061DF40` | no corresponding web object | `out-of-system`: internal helper absent from the web scene model |
| Tree secondary | `0x00608830` | shared Tree root tint/alpha | `verified-already-at-parity`; separate late-painter contract |

No member is blocked by the browser platform, and no authored Building or
Monument row remains unextracted.

## Native ownership thread and recovered behavioral contract

- Construction/lifetime: Building constructor `0x005F2C30` owns retained base
  positions/UVs, colors, sample offsets, roof positions/UVs, and grid
  dimensions. Arrays are created lazily on the first Complex-Lighting main
  draw and retire with the Building.
- State producer: the current Arena Region manager supplies the accepted-source
  grid each render. The specialized sample is presentation-local; it creates no
  gameplay, protocol, host-authority, or synchronized RNG state.
- Grid: `0x00417510` clamps dimensions to two, then emits row-major bilinear
  glyph positions/UVs. Enhanced Effects on uses nine vertices/eight triangles;
  off uses four vertices/two triangles.
- Query: for each point, ordinary maximum `r` and height-attenuated maximum `h`
  are accumulated independently; the output is `r*h`. A source below/equal to
  the point keeps full height contribution. A source above the point applies
  `max(0, 1 - verticalGap*1.5/145)`.
- Selector geometry: Building 0 adds `135` Y and Building 1 adds `100` Y to
  query points in every row except the last. Buildings 2/3 add zero. Raster
  positions and UVs never receive those offsets.
- Color/order: scalar channels clamp, multiply by 255, and truncate before GPU
  interpolation. Base art stays at its shared effective-Y depth; roof art stays
  in original foreground source order and reuses the base color array.
- Monument: one root sample from the common dispatcher colors its single main
  glyph; its complex-shadow painter remains immediately before that glyph.
- Settings/reset: Complex Lighting off bypasses grid sampling and draws both
  Building glyphs white. Scene replacement destroys meshes, buffers, textures,
  and per-Building maps; no result survives into another run.

## Nearby-system findings

- `0x0057E640` is also the endpoint-lighting query for Wall/ZFightHelper. That
  xref explains why the function must be owned as a reusable Region primitive,
  but Wall's generated geometry is a distinct full-system boundary.
- Building main initializes both base and roof tessellations; the roof painter
  cannot be implemented correctly as an independent late Sprite.
- The older Tree-lighting entry stopped at “caller-owned” and never traced the
  actual Building caller/color array. That skipped the full consumer census and
  is the process failure reopened here.
- No runtime architecture document changes: presentation ownership stays in
  the Boneyard renderer and Region-light modules.

## Confidence and open questions

- Confirmed: exact executable identity, complete specialized-query xrefs,
  formulas/constants, both grid densities, all Building/Monument rows, color
  packing, base/roof buffer sharing, setting branches, painter order, and
  current browser divergence.
- Inferred: none material to implementation.
- Unknown: exact D3D9 subpixel interpolation differences are already bounded by
  the existing WebGL renderer platform; they do not require a geometry or
  formula approximation.

## Web implementation consequence and validation contract

- Put the special query beside the existing Region scalar and put Building
  grid/mesh ownership in a focused static-scenery presentation module.
- Replace only Building base/roof Sprites with retained textured meshes carrying
  packed grayscale vertex color. Keep Monument and every ordinary resident on
  the root-scalar path.
- Share one computed scalar row across each Building's base/roof pair, preserve
  culling, complex-shadow depth ownership, foreground order, and deterministic
  teardown, and never allocate textures or geometry per frame.
- Focused tests must cover the two independent query maxima, height cutoff,
  byte truncation, exact 3x3/2x2 topology, all four selector offsets, all eight
  Building art rows, all 21 Monument root rows, Complex Lighting off, and
  base/roof color equality.
- Real WebGL proof must render every Building and Monument selector, move the
  player light across them, observe nonuniform Building vertices with matched
  base/roof buffers and root-uniform Monuments, capture changed pixels, and
  report zero page, console, shader, and network errors.
- Run `./scripts/validate.sh`, then repeat the exact-tree suite and browser
  journey on the Mac mini before publication.

## Implementation validation receipt

- `boneyard-static-surface-lighting.ts` owns all authored row membership,
  selector offsets, both grid densities, exact topology, and byte packing.
  `boneyard-building-surface-view.ts` owns one retained WebGL textured mesh and
  `unorm8x4` vertex-color buffer per base/roof glyph. The world renderer pairs
  both halves by Building identity, computes one nine-scalar row per visible
  Building, uploads it to both meshes, skips the ordinary root tint only for
  Building, and destroys buffers/shaders with the resident. Monument remains
  on the ordinary root-scalar path.
- Pre-implementation red proof failed because the specialized query and static
  surface module did not exist. The completed focused selection passes `72/72`
  across render-plan, Region-light, tessellation/packing, renderer ownership,
  all four Building selectors, all 21 Monument selectors, and both setting
  branches. Frontend type-check, lint/import boundaries, and Mod Loader's
  portable RE suite (`491/491`) pass.
- Linux Chrome WebGL2 at `1600x900` rendered every member with no page,
  console, shader, or failed-response errors. Building roof changed-pixel
  counts were `17,424`, `18,304`, `18,367`, and `16,828` for selectors `0..3`;
  each had a nonuniform vertex range and zero base/roof color mismatches.
  Complex Lighting off held every Building vertex at scalar one. All 21
  Monument rows were visible and individually changed through the retained
  root-scalar path.
- Apple-M2 Chrome `151.0.7922.170` repeated the exact focused suite and WebGL2
  journey on detached Website commit
  `fcc69ab9077d6cf31ccbfbc168010ede06c05c64`. Building selectors changed
  `17,271`, `18,285`, `18,474`, and `16,763` roof pixels with zero mismatches;
  every Monument row passed. The screenshot is
  `/tmp/solomon-roof-lighting-mac-fcc69ab9.png`, SHA-256
  `4b724c5ecc6f0551795014ede412ddb4c1dbe57212e4175e6f024530396d765d`.
  The task-owned host/Vite process was stopped and port `5197` closed.
- The full unchanged `./scripts/validate.sh` gate passed on that exact Mac tree:
  `15/15` backend/contracts, `4/4` library, `43/43` loot, `227/227`
  prerequisites, `1297/1297` game, `8/8` world weather, `29/29` party,
  `11/11` level-up, `7/7` diagnostics, `17/17` Hall, `21/21` Hub UI, and `5/5`
  desktop, followed by production TypeScript/Vite/game-host builds, media
  policy, and bundle budget (`394,179` raw / `110,639` gzip bytes). Linux
  concurrency diagnostics starved unchanged WebSocket heartbeat tests; both
  affected files pass `49/49` in isolation and are not used as the closure
  gate. Publication and deployment remain separate and pending.
