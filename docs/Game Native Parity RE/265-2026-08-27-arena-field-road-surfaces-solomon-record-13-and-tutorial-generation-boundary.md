# 2026-08-27 — Arena field/Road surfaces, Solomon record 13, and Tutorial generation boundary

## Reported smell and parity question

- Reported web behavior: the Boneyard ground is visibly flatter and lower
  quality than stock; Road segments have dark lines at every joint; Solomon
  has an extra ground fragment at the Dig set piece; and Tutorial Sirmin is
  purple like his Ether spell instead of the stock tan wardrobe.
- Follow-up requirement: the post-Tutorial College walker must not be blocked
  by shared-Hub players or Students. Successful Office-owned loadout
  confirmation ends every Tutorial presentation/physics influence and restores
  the ordinary selected player generation.
- Explicit scope correction: the separately reported rain-puddle appearance is
  withdrawn for this pass. Weather state, assets, blend, recurrence, and tests
  remain unchanged.
- Reproduction scenes: clean retail Tutorial stage 0; current-main Mac Chrome
  Tutorial stage 5; every generated/default Boneyard Road chain; the opening
  Solomon state-0 and dialogue/escape branches; and the participant-local
  College Courtyard/Office/Create path in a populated shared Hub.
- Falsifiers: a loose retail ground texture; a Road renderer that draws a
  stroke/circle instead of the indexed mesh; a third object constructed by the
  Solomon set-piece builder; a second record-13 call in any Solomon state; a
  Tutorial wardrobe RNG draw; or a collision exemption that must disable
  architecture, portals, or Archchancellor contact.

The ground/Road issue reopens the original Boneyard renderer entry because it
accepted a derived WebP capture and only a four-point Road polygon after the
native reports already named the real field records and geometry builder. The
Solomon issue reopens the set-piece entry because coordinate identity was
mistaken for a second drawable owner. The Tutorial issue reopens the complete
controller entry because its two equipment writes were omitted. These were
system-boundary omissions, not values to retune.
## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail executable | `SolomonDarkAbandonware/SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` | Canonical 0.72.5 image for every preferred address below. | high |
| Clean stock | Mod Loader `docs/assets/tutorial-stock-20260823/stage-0.png`, SHA-256 `8b43df2d8bcaa5bd9d92894e31cf9dc749d67e4f5fa99ec1bac39c26b286829c` | Stock shows the authored high-detail surfaces and tan Sirmin clothing with an independent purple Ether effect. | high-visible |
| Current web | Mac Chrome capture copied as `/tmp/sdr-terrain-current-main-tutorial.png`, SHA-256 `4447b4be4745f87bfd6351bd6f1d12baa420381b065138deaf5608d1a8d22cd3`; source base `abd744d57e364d8337585f09c6285605664cacbe` | The runtime uses a flattened ground capture, dark segment outlines/caps, and an Ether-purple Hat/Robe. | high |
| Arena instructions/assets | `Arena::Render 0x0046EC80`; opacity write `0x0046EC9A..0x0046ECB7`; draw callsites `0x0046F528/0x0046F651`; `Sprite::Draw 0x004142E0`; `Bonedit::Render 0x004D5F40`; DeadHawg records 20/21 | Opaque-black clear precedes Roads/Terrain/compact detail. Modes 0/1/2 select a closed ring/inverse-oval overlay table on one 200-unit lattice at opacity `.65`; source-over RGBA is falsified. The user withdrew this puddle/overlay material from implementation scope. | high for ownership/opacity; deliberately unresolved material outside scope |
| Road instructions/data | builder `0x0064C1F0`; deduper `0x00428FA0`; renderer `0x00640750`; vtable `0x0079F348`; five retail loose PNGs | Every Road is an 18-input-vertex indexed mesh with authored side fades, endpoint-link alpha, world UVs, wrap, and no outline/circle. | high |
| Solomon instructions | builder `0x00465920`; renderers `0x004902C0/0x00490420/0x00490640/0x00490790`; DeadHawg singleton offset `+0xA2C` | Builder creates only Solomon and Lantern. Dig/dialogue draw record 13 once; walk branches draw it zero times. | high |
| Tutorial instructions | `Tutorial_CreateAndInstall 0x005D5CF0`, Hat/robe sinks `Game+0x1428/+0x142C`, accessor `0x00570D80`, color transform `0x0040FC60`, factor `0x007854D0` | Both primary clothing colors are overwritten from `(1,.5,0,1)` with factor `.6`; white secondary and the purple Staff effect remain independent. | high |
| Shared-Hub owner trace | `core-server/hub-world.ts`, `native-college-intro.ts`, `game-simulation.ts`, current tests | Onboarding players still enter every same-region player/Student physical pair; loadout confirmation refreshes skills/config but deliberately retains College clothing. | high |
| User product direction | follow-up report, 2026-08-27 | Shared-Hub blockers must be intangible only to the onboarding participant, and confirmation must restore normal selected appearance and collision immediately. | high-product |

Static evidence used the canonical read-only Windows Ghidra project and replica
wrapper. No runtime/ASLR address or injected process is used as instruction
truth. Reusable native findings were first added to Mod Loader
`native-boneyards-and-world.md`, `native-solomon-dig-and-wave-director.md`,
`tutorial-mechanics.md`, and `native-session-flow.md`.

## System boundary and membership inventory

Native/product system A: Arena clear and the explicit field-overlay exclusion
immediately before RegionLayout.

| Member | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| opaque-black Arena clear | `0x0057D4E0 -> 0x0041D840` | `exact-ported` | Pixi render-target clear; no captured ground tile |
| authored detailed ground | Road/Terrain/compact owners | `exact-ported` in their respective lanes | exact Road mesh plus retained compact/Terrain painters |
| mode 0 ring overlay | DeadHawg 21 / `0x00B2F368` | `out-of-system` for this pass by explicit user scope | documented, no new `/game` submission |
| mode 1/2 inverse-oval overlay | DeadHawg 20 / `0x00B2F2A4` | `out-of-system` for this pass by explicit user scope | source-over falsified; no guessed material |
| overlay lattice/opacity | loops `0x0046F467..0x0046F6AE`; `.65` at `0x00784DC0` | `out-of-system` with overlay | preserved native evidence only |
| Bonedit record-21 field | `0x004D6223` | `out-of-system` (authoring preview, not Website `/game`) | remains separately identified; no runtime fallback |
| `arena-ground.webp` | derived Website reference only | `out-of-system` (not a native runtime member) | absent from `/game` source/preload |

Native system B: Road 3004 serialized outer geometry, endpoint links, mesh
build, five textures, draw, and teardown.

| Member | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| style 0 / `road.png` | width 55, fade 30, UV 128 | `exact-ported` | per-style mesh golden |
| style 1 / `road2.png` | width 45, fade 20, UV 128 | `exact-ported` | per-style mesh golden |
| style 2 / `road3.png` | width 55, fade 20, UV 256 | `exact-ported` | per-style mesh golden |
| style 3 / `road4.png` | width 45, fade 10, UV 128 | `exact-ported` | per-style mesh golden |
| style 4 / `road5.png` | width 55, fade 10, UV 128 | `exact-ported` | per-style mesh golden |
| isolated hard endpoints | both link UIDs sentinel | `exact-ported` | endpoint-alpha assertion |
| first/middle/final chain endpoints | previous/next UID branches | `exact-ported` | projected semantic booleans and alpha assertions |
| 18 input records / deduplicated indexed output | `0x0064C1F0 -> 0x00428FA0` | `exact-ported` | 8 unique vertices / 18 indices |
| repeat/linear texture state | renderer state + 1x sampler branch | `exact-ported` | live texture diagnostics |
| Road order and teardown | RegionLayout Road list / `0x006497F0` | `exact-ported` | source-order views and destruction contract |
| Terrain 3009 and derived bridges | separate class/builders/renderer | `out-of-system` (not a Road style or ground fallback) | existing native report; untouched runtime path |
| Bonedit Road mutation callers | `0x004C17E0/0x004C88C0` | `out-of-system` (authoring controls) | shared constants documented; `/game` consumes final records |

Native system C: Solomon's selected grave root, actor state painter, Lantern,
Flydirt child manager, and teardown.

| Member | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| state-0 body then record 13 | `0x004902C0` | `exact-ported` | one pass, shared actor depth/tint |
| dialogue/state-3 hold body/mouth then record 13 | `0x00490420` | `exact-ported` | one pass after body/mouth |
| accelerating/escaping walk | `0x00490640/0x00490790` | `exact-ported` | zero record-13 pass and phase visibility |
| `Anim_Flydirt` child | child manager / `0x00458300` | `verified-already-at-parity` | retained later two-pass child order |
| Lantern | type 5010 separate root | `verified-already-at-parity` | independent depth/light/lifecycle |
| standalone grave-ground Sprite | no builder/renderer producer | `out-of-system` (duplicate Website invention) | removed source/texture/layer |
| gone/run teardown | Solomon owner | `exact-ported` | no persistent record-13 fragment |

Native/product system D: disposable Tutorial appearance through shared College
admission and confirmed ordinary generation.

| Member | Source | Disposition | Proof |
| --- | --- | --- | --- |
| Tutorial Hat primary | `0x005D5DA1..0x005D5E08` | `exact-ported` | exact transformed tint |
| Tutorial Robe primary | `0x005D5E0E..0x005D5E75` | `exact-ported` | same tint and no RNG |
| white secondary layers/selectors 0 | starter items, no Tutorial writer | `verified-already-at-parity` | equipment projection |
| Ether Staff/material/effect | separate primary/effect owner | `verified-already-at-parity` | purple effect retained over tan clothes |
| Tutorial resume/death until Game end | disposable equipment generation | `exact-ported` | persisted tints and reset tests |
| College pre-Create green/no-element-effect path | existing native admission owner | `verified-already-at-parity` | retained through `college-loadout` |
| onboarding vs other players | shared-browser-only pair | `exact-ported` product policy | nonblocking in both mover orders |
| onboarding vs Students | shared-browser-only type-5002 pair | `exact-ported` product policy | blocker traversal |
| architecture/portals/Archchancellor/Polisher | ordinary static/contact owners | `verified-already-at-parity` | never admitted to bypass filter |
| acknowledgement, Office free interval/outgoing, `college-loadout` | participant state graph | `exact-ported` | exemption retained before confirmation |
| successful selected loadout | user-directed generation boundary | `exact-ported` product policy | selected appearance/effect and normal collision immediately |
| confirmed Courtyard incoming/settled completion | post-boundary phases | `verified-already-at-parity` | both durable onboarding bits are already clear |
| disconnect/reload before confirmation | save projection | `exact-ported` | exemption and special appearance resume only pre-confirmation |
| disconnect/reload after confirmation | ordinary profile/continuation projection | `exact-ported` product policy | selected generation resumes and onboarding cannot re-arm |
| other participants/later Hub visits | ordinary shared Hub | `verified-already-at-parity` | never acquire the exemption |

No member is blocked by the browser platform.

## Native ownership thread

- Arena owns the opaque-black clear and a separate mode-selected ring/oval
  overlay; RegionLayout owns Road/Terrain/compact ground detail. The user
  withdrew the overlay/puddle material, and a derived image cannot replace the
  ground owners that remain in scope.
- Road owns serialized endpoints, link identities, outer quad, style and width
  scales. Builder `0x0064C1F0` derives fades/UV/index buffers; renderer
  `0x00640750` owns texture selection and one mesh submission.
- Solomon builder owns only actor and Lantern construction. The actor state
  painter owns the one record-13 pass; its child manager owns Flydirt.
- Tutorial controller mutates the already equipped Hat/Robe. The disposable
  Tutorial economy carries that result. College admission replaces it with
  the existing special pre-Create appearance; Website loadout confirmation is
  the requested final generation/reset boundary.
- Hub authority owns dynamic physical response. Pair admission, not radius or
  movement geometry, is the smallest seam for making only onboarding
  player/Student/player pairs nonblocking while keeping native contacts.

## Recovered behavioral contract

- Arena ground: opaque-black clear, then exact Road meshes, Terrain, and
  compact authored detail before Region raster lighting. The adjacent native
  `21/20/20` ring/inverse-oval overlay uses a 200-unit lattice and renderer
  opacity `.65`, but its material is not source-over RGBA; it remains unchanged
  and unimplemented under the explicit puddle withdrawal.
- Road: three strips, eighteen source vertices, eight ordinary unique vertices,
  eighteen indices; world UVs with style size and vertical `.8`; alpha-zero
  outer edges and native linked-end branches; wrap/linear sampling; no stroke,
  cap, join patch, or capture resampling.
- Solomon: body/mouth as applicable, then exactly one co-rooted record 13,
  then Flydirt child manager; one ordinary sort/tint owner; no record after the
  walk branch leaves the grave or after teardown.
- Tutorial color: base `(1,.5,0,1)`, luminance weights
  `.3086000085/.6093999743/.0820000023`, output `.6*luminance+.4*channel`,
  primary only, no RNG; purple Ether effect remains separate.
- Shared College policy: before confirmation, only pairs with another player
  or Student are nonblocking. At confirmation, selected config, fresh skills,
  selected-element clothing/effect, and normal collision become authoritative
  together, and both durable onboarding bits clear. The ordinary incoming fade
  cannot re-arm Tutorial or College behavior after a disconnect/reload.

## Nearby-system findings

- The Road style-1/style-3 half width is 45, while style 4 returns to 55. The
  old shared 55 constant was not a complete style table.
- The web's dark Road outlines and round end circles are not anti-seam helpers;
  they are the seams. Native joins emerge from overlapping indexed meshes and
  endpoint alpha.
- `gravePosition == actorPosition + (-10,-113)` is a coordinate proof, not two
  resident identities. Both old web Sprites occupied that exact root.
- Retail keeps the College-green item color through first Create. Rebuilding
  selected-element appearance there is an explicit user-directed Website
  product difference paired with the browser-only shared-Hub collision rule.
- Puddle/weather presentation remains an independent system and is unchanged.

## Confidence and open questions

- Confirmed: opaque clear, all overlay modes/records/calls and `.65` opacity;
  all Road builder xrefs, style rows, vertex/index/UV/alpha rules, renderer and
  assets; Solomon builder/state
  membership; Tutorial wardrobe writers/formula/sinks; current Hub collision
  and loadout owners.
- Inferred: none used for native implementation.
- Browser product policy: dynamic-pair exemption and selected appearance at
  first College confirmation are explicit user requirements, not stock claims.
- Unknown outside the declared boundary: the exact DeadHawg-20/21 ring/oval
  overlay material/blend. Direct browser source-over is refuted; the user
  explicitly excluded that puddle/overlay correction from this pass.

## Web implementation consequence

- Add a cohesive GPU Road surface view below the existing Terrain/pre-main
  canvas, over the exact opaque-black Arena clear. Remove the derived ground
  capture from `/game`, retain compact/Terrain detail, and do not add the
  withdrawn DeadHawg-20/21 overlay through a guessed source-over material.
- Preserve native Road link state as a two-bit endpoint mask when stripping
  process-local UIDs; make the strict protocol consume them and reject silent
  omission on projected native scenes.
- Delete the standalone Solomon grave Sprite, texture property, painter layer,
  and teardown. Put record 13 after body/mouth inside `actorRoot`, with shared
  tint/depth and phase visibility.
- Apply the Tutorial color through the authoritative equipment economy before
  snapshotting. Do not recolor the Staff or suppress its Ether effect.
- Filter only onboarding player/Student/player dynamic pairs in Hub authority.
  Pass selected element as the College loadout appearance owner so confirmation
  restores ordinary visuals and physics immediately.

## Validation contract

- Pure surface tests: all five Road style constants; 18-to-8/18 mesh result;
  world UV and `.8`; isolated, first/middle/final endpoint alpha; exact five
  PNG hashes; negative runtime ownership for the withdrawn field overlay and
  captured WebP.
- Projection/protocol tests: source UID sentinels become an endpoint link mask,
  all stock templates regenerate, malformed/missing fields are rejected under
  the new strict protocol, and round trips retain every Road row.
- Solomon tests: source contains no standalone grave Sprite/layer; actor order
  is body/mouth -> one record 13 -> Flydirt; phase matrix is `1/1/0/0`; shared
  tint/depth and teardown are pinned.
- Tutorial/Hub tests: exact tan tint on Hat/Robe and purple effect independence;
  both mover orders through overlapping players and Students; ordinary peer
  collision unchanged; Arch contact still activates; exemption survives all
  pre-confirmation/reload phases; confirmation clears both durable onboarding
  bits, changes appearance, and restores collision before the incoming
  transition settles; post-confirm reload cannot re-arm either owner.
- Mac Chrome Tutorial: compare the same 1600x900 phase to clean stock; assert
  opaque-black clear, Road style-2 mesh, no segment dark lines or opaque field
  crop mattes, tan Hat/Robe, purple Ether effect, and empty
  page/console/failed-response arrays.
- Mac Chrome default Boneyard: inspect multiple connected Road endpoints and
  Solomon before/during/after contact; assert one record-13 pass and no
  persistent fragment.
- Mac Chrome shared Hub: put deterministic player and Student blockers on the
  College path, complete Arch/Office/Create, then prove the selected ordinary
  wizard collides again after confirmation. The exact candidate must pass the
  Mod Loader registered static suite and Website
  `/opt/homebrew/bin/bash ./scripts/validate.sh`.

## Implementation validation receipt

- The final runtime candidate is byte-identical between the isolated local and
  Mac worktrees at Website manifest
  `b63461359fd95d9745edb0bdf60ace5b27b14178ba0438e19ff006b6664e77b4`
  (34 changed files over `abd744d57e364d8337585f09c6285605664cacbe`).
  The registered Mod Loader tree has eight changed files over
  `16e5f5018afa24207b60d807ffe301b3f65643e4`.
- Mod Loader `python3 tests/re/run_static_re_tests.py --ci` passed `517/517`;
  log SHA-256
  `cb9ed9c39704cd648584b1bcfd138da41ecce5bd7e6bce911d83de712fd20c45`.
  The exact runtime tree passed Website
  `/opt/homebrew/bin/bash ./scripts/validate.sh`; its last pre-receipt-only log
  SHA-256 was
  `c70ff002aa91d74bd457b1c26076b72d84827bc6eb98f809e5814c4de1922221`.
- Production Mac Chrome Tutorial/College passed with surface receipt
  `opaque-black-clear+native-layout`, `53` Road meshes, `954` indices and `424`
  vertices; Hat/Robe primary was exact `0xC4915E`, Ether remained effect `8`,
  and page/console/failed-response arrays were empty. The deterministic player
  plus Student blockers were crossed by `710.88` signed units. Confirmation
  atomically cleared `tutorialPending` and `collegeIntroPending` in authority
  and schema-18 local save, selected Air reset Acid Rain rank to zero, and
  ordinary collision expanded an overlap from `40` to `50.1` units. Log
  SHA-256 is
  `4cb59ebb73ce1c3fdb7ce48fd364fe39a466a9f3dcf583e77191361c956eda30`.
- The visually inspected Tutorial capture is
  `/tmp/sdr-terrain-absolute-tutorial.png`, SHA-256
  `36b5c6c0a84befb8b9eb7379cb65c8195a7905193ec04e3812561a8ea06dde75`.
  Against clean stock `stage-0.png`, Roads retain detailed wrapped pixels with
  no per-segment dark lines, Sirmin is tan under the purple Ether effect, and
  the refuted white field-crop mattes are absent. The DeadHawg-20/21 overlay
  itself remains excluded under the user's withdrawn puddle scope.
- Production Mac Chrome default-Boneyard opening passed with `38` Road meshes,
  `684` indices, `304` vertices, production frontend true, grave-mark passes
  `1` while digging, `1` while speaking and `0` after escape, and empty
  page/failed-response arrays. Log SHA-256 is
  `ae2bcf50a331716cb9f8efe79b2bd7a2a8d1bd9fc5d358d6cf22fe48dccb0be0`;
  the inspected escape capture is
  `/tmp/sdr-terrain-absolute-waves.png`, SHA-256
  `d5f564faa5ef4d6054103279791c16c7290571a9a49644b582b24403fd15bf95`.
- No commit, push, deployment, or production cutover was requested or
  performed. Both isolated worktrees and their task-owned receipts remain for
  review.
