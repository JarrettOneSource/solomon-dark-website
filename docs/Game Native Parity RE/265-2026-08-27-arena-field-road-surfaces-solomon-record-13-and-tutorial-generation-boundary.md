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

## 2026-08-31 — Reopened Road-link persistence and restored-run lifecycle

### Reported smell and parity question

- Reported production behavior: resuming an active run on iPhone Safari
  reached `connection.ready`, then the browser rejected the first restored
  Boneyard payload with
  `boneyard.scene.roads[0].linkMask must be finite` and closed the transport
  with code `4008`.
- This is a secondary report against the Road system closed above. The earlier
  pass made `linkMask` mandatory on fresh projected scenes and the strict wire,
  but did not enumerate persisted active-run scenes, schema migration,
  catalog reconciliation, or asynchronous restore teardown. Classifying the
  first protocol-94 occurrence as release-closed without tracing those owners
  was the skipped rule.
- Required behavior: every supported active-run save must recover the exact
  source-owned Road masks before the Boneyard enters shared/private authority
  or crosses the wire. A genuinely invalid or unavailable content identity
  must remain fail-closed; the decoder must not guess a value or relax the
  native Road contract.
- Falsifiers: a fresh current projector emitting a missing mask; frontend and
  host running different protocol revisions; a current checkpoint converting
  an integer mask to a non-finite JSON value; or persisted geometry alone
  recovering every native pointer branch exactly.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Live browser diagnostic | NFO SQLite `DiagnosticLogs` row 99 / public id `dd633f19-3fc2-4858-a571-601f8ba1f2df`, captured `2026-08-31T15:00:55.004Z` | Protocol 113 issued a resume admission, authenticated player `player-83hvvICTLsN2oRSf`, reached ready, then rejected `roads[0].linkMask`; the browser sent the bounded report after the clean code-4008 close. | high-live |
| Live game journal | `solomon-dark-game.service`, `2026-08-31T15:00:53.457Z..15:00:56.411Z`, deployed SHA `3304f22859786b1c15bb7d212632c8d0ad34fb03` | The same reason closed both proxy sides, retired run `72ae68dedb5c276e49fcff3af5dc23fd`, then a pending restore tried to activate a closed prepared-mod host. | high-live |
| Deployment identity | rollback metadata for the later `2bcbdcf69f6c61e1c8d61bbd531def848302c304` cutover | The incident release and its successor both use protocol 113; the successor changes UI only. Revision skew is falsified. | high-live |
| Introduction history | Website `ec98c44ec5001802946289e833a3df5a0e8010fb` | `projectRoad` added the exact two-bit mask and protocol 93 made it mandatory, but the commit did not change the save schema, save writer, or restore migration. | high |
| Current persistence trace | `game-save-document.ts`, `game-save-contract.ts`, `game-host.ts`, schema 24 at `3304f228`/`2bcbdcf` | Checkpoints embed `LoadedBoneyard` unchanged; restore validates its identity and scene only shallowly; `createGameSnapshot` does not consume the scene; the host sends it after welcome, where the browser first performs strict Road validation. | high |
| Mac catalog sweep | exact `2bcbdcf` detached arm64 worktree, Node 22.17.0; 12 generated templates, Tutorial, and five tracked `.boneyard` fixtures | Endpoint-geometry inference matches all 599 built-in Road rows, but disagrees on 8 of 61 `story0.boneyard` rows. Persisted geometry is therefore not a system-wide substitute for the stripped native UIDs. | high |
| Existing native evidence | Road builder `0x0064C1F0`, renderer `0x00640750`, and the complete system-B extraction above | Previous/next UID presence, not geometric coincidence, owns endpoint alpha. No new retail extraction is needed; the missing member is web persistence ownership. | high |

### Reopened system boundary and membership inventory

Native system: Road source identity from record-3004 previous/next UIDs through
projection, active-run checkpoint, catalog-backed resume, shared/private
authority, strict protocol, renderer, subsequent checkpoints, interruption,
and teardown.

| Member / branch | Owner | Disposition | Proof contract |
| --- | --- | --- | --- |
| Twelve fresh default templates / 546 Road rows | immutable native catalog | `verified-already-at-parity` | every row carries its extracted mask and strict round-trip remains unchanged |
| Fresh stock Tutorial / 53 Road rows | immutable Tutorial catalog | `verified-already-at-parity` | all rows carry their extracted masks |
| Fresh same-content mod Boneyard | materialized session catalog | `verified-already-at-parity` | `projectRoad` derives masks from the source UIDs |
| Supported legacy default active-run saves | source identity and exact Road rows matched to immutable catalog | `exact-ported` | resume restores every canonical mask before authority or wire |
| Supported legacy Tutorial active-run saves | stock Tutorial identity | `exact-ported` | resume rebinds all 53 canonical rows |
| Supported legacy same-content mod saves | exact active mod entry | `exact-ported` | choice id and source hash select the catalog member; every saved Road row must match it exactly |
| Current saves that already contain masks | existing save and strict-wire owners | `verified-already-at-parity` | they remain unchanged and preserve same-tab duplicate-admission ordering |
| Save schemas 1 through 24 and schema-24 documents re-saved after the Road release | active-run continuation owner | `exact-ported` | data-shape recovery is independent of the historical schema number |
| Removed or changed mod content with an explicitly accepted mismatch | existing mod-mismatch branch | `verified-already-at-parity` | the run returns to Hub instead of inventing Road data |
| Unknown default identity or same-manifest mod with mismatched content hashes | save/content trust boundary | `exact-ported` | reject before shared/private state insertion or Boneyard wire output |
| Shared-Hub resume | authenticated per-player content catalog | `exact-ported` | production-shaped restore sends one decodable canonical Boneyard |
| Private-College resume | host catalog | `exact-ported` | same canonical reconciliation before private ownership |
| Active-party rejoin | resident run catalog and rejoin token owner | `verified-already-at-parity` | the resident canonical run remains authoritative; saved identity must still match |
| Developer observer and later party members | resident run projection | `verified-already-at-parity` | all consume the already reconciled scene |
| Strict protocol rejection of missing/null/out-of-range masks from an untrusted live message | browser/server decoder | `verified-already-at-parity` | malformed wire fixtures remain rejected |
| Checkpoint after a recovered resume | host save writer | `exact-ported` | the next document persists the recovered scene with canonical masks and cannot perpetuate omission |
| Disconnect/run retirement while mod/navigation restore is pending | party runtime lifecycle | `exact-ported` | stale completion observes that its scope/run is no longer current and performs no activation or error log |
| Road collision, simulation, UVs, mesh, styles, draw order, and renderer teardown | existing Road/runtime owners | `verified-already-at-parity` | no gameplay or fresh-scene behavior changes |

There is no `blocked-by-platform` member. Every exact source scene is already
available to the authoritative host for an admitted resume.

### Causal model and recovered contract

1. `ec98c44e` stripped process-local UIDs into the correct stable two-bit mask
   and deliberately kept the protocol strict, but an active save continued to
   embed whichever projected scene it first received. Later save-schema bumps
   migrated other state and carried that old scene forward unchanged.
2. Restore accepted the envelope because its `LoadedBoneyard` parser checked
   only outer identity strings and that `scene` was an object. Snapshot
   validation could not catch the omission because Road geometry travels in a
   separate `server-boneyard-loaded` message.
3. The browser decoded welcome successfully, rejected the following Boneyard,
   and closed. Run retirement then closed the party mod runtime while its
   navigation/mod initialization promise was still pending; the stale
   completion attempted activation and produced the later
   `prepared mod host is closed` error.
4. Geometry inference is exact for the bundled templates but refuted as a
   shared rule by tracked authored content. Recovery must select the already
   projected scene from the exact admitted catalog using choice/source identity
   plus an exact comparison of every saved Road row without its missing mask.
   It must not infer UIDs, default masks to zero, or mutate the strict decoder.
5. The reconciled `LoadedBoneyard` preserves the saved scene, run id, and seed;
   fills only the source-owned masks, canonicalizes the choice, and recomputes
   the derived geometry hash. The same object then owns every player/observer
   send and subsequent checkpoint.

### Confidence and open questions

- Confirmed: exact production symptom and order; implicated release; absence
  of revision skew; producer-to-save-to-wire path; missing migration; complete
  content classes and runtime consumers; insufficiency of geometry inference;
  and the closed-runtime error as teardown-after-disconnect.
- Unknown but immaterial: the submitted diagnostic does not retain whether the
  failed run selected a default or mod Boneyard. Both use the same missing
  persistence member and are separately covered by exact catalog resolution.
- No native or platform unknown remains. A save whose exact source is no
  longer admitted cannot be reconstructed and must follow the existing
  mismatch/rejection policy.

### Web implementation consequence

- Put canonical saved-run reconciliation beside Boneyard catalog
  materialization, where all default, Tutorial, and mod source identities are
  available.
- Recover every missing Road mask from an exact catalog entry before
  `restoreSharedGamePlayer`, private state adoption, or any
  `server-boneyard-loaded` send. Preserve the saved scene, run id, and seed;
  reject source identity, membership, or Road-geometry disagreement.
- Keep `game-protocol.ts` strict and keep all fresh projector/render behavior
  unchanged.
- Make the pending party restore completion conditional on its runtime scope
  and run still being current so ordinary disconnect/retirement is silent and
  idempotent.

### Validation contract

- Mac red/green gate: mutate a real current active-run checkpoint into the
  historical shape by removing every saved Road mask. Before the fix, the
  production-shaped shared-Hub resume must fail with the exact diagnostic;
  after the fix, default, Tutorial, and same-content mod saves must send their
  complete canonical masks and create the next corrected checkpoint.
- Catalog contracts: exhaust all built-in rows, preserve current identities,
  reject unknown/hash-mismatched content, and retain strict malformed-wire
  tests.
- Lifecycle contract: close the final restored actor while navigation/mod
  initialization is pending; assert one ordinary run retirement and no
  `mods.restore_initialization_failed`, uncaught rejection, or closed-host
  activation.
- Mac Chrome: load a built production client with a legacy-shaped active-run
  document on a task-owned protocol-113 host, enter the restored Boneyard, and
  observe nonzero linked endpoint masks, continuing snapshots, and empty
  page/console/failed-response/host-error arrays.
- Publication: rebase on the then-current `origin/main`, repeat the complete
  Mac gate/browser journey, fast-forward `main`, and verify CI/CD plus the live
  deployed revision, supervisor health, service restarts, warning/error
  journals, and an actual production legacy-resume journey separately.

### Implementation validation receipt

- `boneyard-catalog.ts` now owns legacy Road recovery. It accepts only the
  historical all-masks-omitted shape, resolves default/Tutorial/mod content by
  exact admitted source identity, requires every non-mask Road field and EID
  to match, restores the extracted masks, and updates the derived geometry
  hash. Current valid saves return unchanged; partial/null masks and changed or
  unavailable content remain fail-closed.
- `game-host.ts` performs recovery only when it will adopt a saved run. Live
  same-tab duplicate ownership is decided first, preserving its established
  rejection/replacement semantics. A pending party mod/navigation completion
  now activates only if its exact runtime scope and run remain current, so a
  retired final-player run cannot call a closed host.
- Catalog regressions drain all twelve generated templates and Tutorial—599
  Road rows total—plus a same-content mod entry, current-save identity,
  partial masks, changed Road geometry, missing content, strict protocol, and
  a production-shaped shared-Hub resume followed by a corrected leave
  checkpoint.
- The Mac red gate over exact Website `2bcbdcf69f6c61e1c8d61bbd531def848302c304`
  reproduced only the added host regression with
  `boneyard.scene.roads[0].linkMask must be finite`; red combined-log SHA-256
  was `68a449849f1974364501c527305ce04341ca104986022322c0c45d8d1df0e8de`.
- The byte-identical green candidate on arm64 macOS 26.6.2 passed
  `/opt/homebrew/bin/bash ./scripts/validate.sh`: 28 backend/contracts, strict
  formatting/lint/import/generated checks, the `1808/1808` broad game group,
  every registered auxiliary/desktop suite, production builds, media policy,
  and bundle budget (`277279` raw / `83702` gzip). Green combined-log SHA-256
  was `959d562a957c059ef18d2246108734e27990d73ba524c9e5cea876558348f928`.
- Real Chrome 151.0.7922.174 loaded the built production bundle with a
  schema-24 active run whose 36 masks were all removed. It mounted a WebGL2
  Boneyard, received mask census `1:3, 2:3, 3:30`, processed 48 continuing
  snapshots, and wrote a 36-row checkpoint with every mask finite in `0..3`.
  Page, console, failed-response, disconnect, and host-error arrays were empty;
  browser combined-log SHA-256 was
  `bbe019654e5e9fe2d36d1c40d7abbf55731d270de3ce7064f3ccb910d0cdc9f7`.
  The visually inspected Boneyard capture SHA-256 was
  `89c9d6a085b7760df14212eb6d736dfd1727cf45d28e554eb8bbb13b8fb9662a`;
  the temporary script, capture, browser, host, and preview listener were then
  removed or stopped.
- No browser-platform approximation, blocked member, native unknown, or
  retained task evidence remains from this pre-publication receipt. Commit,
  push, CI/CD, and live deployment verification remain separate pending steps.
