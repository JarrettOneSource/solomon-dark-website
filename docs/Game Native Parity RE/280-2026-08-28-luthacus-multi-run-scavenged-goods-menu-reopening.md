# 2026-08-28 — Luthacus multi-run Scavenged Goods menu reopening

## Reported smell and parity question

- Reported production behavior: Spookmiser cannot open the Scavenger NPC's
  menu and receives the same crash on each attempt. Soggy can reach the same
  service but sees no stored goods.
- Stock behavior to retain: Luthacus's `Examine Items` command replaces Chat
  with the participant-private `InventoryShop`. Its seven-by-four StoreGrid
  shows the 28 top-level objects in profile storage, including retained Sacks
  from earlier wizards; it does not flatten Sack children or invent stock.
- Reproduction boundary: an empty store, one ordinary item, one retained Sack,
  seven repeated-retirement Sacks with nested prior Sacks, all 28 top-level
  cells, storage transfer into the companion backpack, Sack entry/back, rapid
  dialogue-to-service replacement, range/region close, and desktop/coarse
  pointer presentation.
- Falsifiable questions: whether the reported failure is caused by the valid
  multi-archive item tree, service renderer construction, Chat-to-service
  teardown, storage/profile hydration, or a later unrelated shared-frame
  rejection; and whether current `origin/main` still reproduces the report.
## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- || Retail executable and durable reports | unmodified retail `SolomonDark.exe` 0.72.5, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000`; Mod Loader `native-hub-npc-interactions.md` and `native-hub-and-economy.md` | `SCAVENGER_INTRO -> Examine Items -> !INVENTORY` replaces Chat with `InventoryShop 0x004F59A0`; callback `0x0056CD00` moves exact top-level objects between profile `+0x8C` and the companion backpack without price or gold mutation. | high |
| Live deployment history | NFO `solomon-dark-game.service` journal and `/opt/solomon-dark-revived/DEPLOYED_GIT_SHA` | Website `9691cd7d` deployed at `2026-08-28T03:51:18Z`; Spookmiser connected at `04:00:23Z` and made a clean client-requested disconnect at `04:01:07Z`. Current production is `05f2232a` / protocol 98 from `06:02:20Z`. No browser diagnostic archive was submitted after midnight. | high for timestamps and disconnect; medium for correlating the clean disconnect with the Discord report |
| Read-only affected-save inspection | production SQLite slot 0, schema 18, inspected without modifying either account | Spookmiser's profile-only save has seven top-level retained Sacks, 68 valid recursive objects, maximum depth two. Current parser and `hubEconomyInventoryIsValid` accept the complete tree. Soggy's active continuation has zero storage roots; its latent retirement profile has one five-item Sack, so an empty service during that still-active wizard is consistent with the two save owners rather than missing StoreGrid rows. | high for structure and validation; medium for the active-wizard interpretation until browser reproduction |
| Current web trace | `hub-npc-dialogue.ts`, `HubInventoryUi.tsx`, `hub-inventory-renderer.ts`, `hub-economy.ts`, save/profile hydration, protocol snapshot projection at `05f2232a` | Dialogue command routing is shared and Luthacus alone substitutes storage for merchant stock. The existing browser fixture proves one nested storage Sack, but there is no per-member receipt for repeated retirement roots or the affected seven-Sack shape. | high |
| Controlled Mac WebGL differential | Apple M2 / Chrome 151 / ANGLE Metal; immutable report artifact `9691cd7d`; current production `05f2232a`; the same valid affected profile and exact Water/Arcane physical route | On `9691cd7d`, `Chat -> Skip -> Examine Items` produced a black native canvas while the surface still reported `ready`, reveal `settled`, and seven storage roots. Page, console, response, request, crash, and context-loss arrays were empty. Opening Luthacus directly on the same artifact/GPU/profile rendered the complete service. Current production happened to render both paths, so the defect is timing/lifetime-dependent rather than a deterministic item decoder failure. | high |
| Separate live failures | game-host journal at `04:16:36Z` and `04:57:18..22Z` | Both connected players were later rejected together for primary-spell rotation and registered entity-sample shapes. Those host-wide frame failures are not produced by the presentation-local `!INVENTORY` open edge and are dispositioned outside this menu system unless the controlled repro couples them. | high |

## System boundary and membership inventory

Native/web system: participant-private Luthacus InventoryShop from the named
actor's Chat command through top-level StoreGrid presentation, companion
InventoryScreen transfer/browse behavior, save/profile ownership, and teardown.
Rows marked `exact-ported` are the closing disposition required from this pass;
the implementation receipt must supply their proof before this entry closes.

| Member / branch | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Luthacus intro and `Examine Items` command | survival builder; `SCAVENGER_INTRO`; `0x004FB890` | `verified-already-at-parity` | complete graph catalog and existing dialogue tests |
| Chat replacement and actor engagement teardown | `0x00501800`, `0x004FCB40`, `0x00505010` | `verified-already-at-parity`, regression retained | command leaves one InventoryShop owner; close/range/Region leave no stale Chat or renderer |
| empty Scavenged Goods root | profile `+0x8C`; `InventoryShop 0x004F59A0` | `exact-ported` | menu opens with 28 empty cells and no invented goods |
| one through 28 top-level storage objects | common StoreGrid; seven columns by four rows, column-major | `exact-ported` | every capacity boundary opens and paints only direct roots |
| repeated-retirement retained Sacks | `0x005C9670 -> 0x005BE320`; `Integer(5)` suffix row | `exact-ported` | seven-Sack affected shape and 28-root boundary remain open, responsive, and selectable |
| nested and empty Sack children | type 7008 root at `+0x88`; `0x0056D920`, `0x00560D30` | `verified-already-at-parity`, affected-tree proof added | StoreGrid stays top-level; transferred Sack opens one direct child root at a time in the companion screen |
| storage-to-backpack double activation and drag | `0x0056CD00`, `0x0056F55A` | `verified-already-at-parity`, regression retained | exact object moves once; no gold or copy |
| backpack-to-storage drag and backpack ordinary activation | same callback plus InventoryScreen dispatcher | `verified-already-at-parity`, regression retained | drag deposits; second activation still uses/equips/opens the backpack object |
| profile-only New Game hydration | durable profile `+0x8C`; browser save profile owner | `exact-ported` | all prior storage roots hydrate into the fresh participant before service open |
| active continuation versus latent retirement profile | active Gameplay inventory/storage versus profile archival owner | `exact-ported` | resume exposes continuation storage; explicit retirement exposes the newly archived Sack exactly once |
| terminal Game Over ordinary carried archive | retail ordinary-transfer branch | `out-of-system` by the existing explicit Website product direction | pre-existing storage and Last Word remain unchanged |
| Last Word ground Sack/Gold recovery | progression `+0x7D8`, Arena actor sweep | `verified-already-at-parity` | recovered goods remain participant-private and visible through the same service |
| Fomentius, Hagatha, and both Shlorio service companions | sibling `InventoryScreen` hosts under the shared renderer | `verified-already-at-parity`, lifecycle regression retained | a shared renderer-lifecycle correction cannot regress any sibling service |
| rapid command, keyboard/touch/focus adapters, range/Region close, scene teardown | shared Chat/InventoryShop presentation owner | `exact-ported` | no page error, context loss, stale modal, or leaked input owner |
| dormant `Outfit me Randomly` / `!RANDOMEQUIP` | retained authoring row with no retail builder/dispatcher producer | `out-of-system` | remains absent |
| later shared primary-spell/entity-sample wire rejection | host frame validation, not `InventoryShop` | `out-of-system` for this boundary | controlled menu repro must remain connected; independent frame defects retain their own owners |

No native member is blocked by the browser platform.

## Native ownership thread and recovered behavioral contract

- The common actor action constructs Chat and engages that actor. A command
  answer beginning with `!` reaches the retail dispatcher; `!INVENTORY`
  destroys/replaces Chat rather than stacking a second actionable modal.
- `InventoryShop` attaches its own companion `InventoryScreen`. StoreGrid owns
  only the participant's direct profile-storage roots. A retained Sack remains
  one cell regardless of descendant count; only after transfer into the lower
  backpack can the ordinary Sack activation push its child root.
- The StoreGrid retains 28 objects, column-major. Luthacus clears the price
  flag, leaves gold unchanged, and uses the exact TAKE-selected and no-price
  HoverBox branches. Empty membership is a valid open surface.
- Retail game-over archival builds at most one nonempty retained Sack per
  completed wizard and inserts it into profile storage. The Website separately
  keeps its already-documented product decision not to archive ordinary
  carried items on terminal Game Over, while explicit Kill/New Game retirement
  still scavenges carried equipment/backpack. That divergence does not permit
  dropping older profile roots or flattening their descendants.
- Dialogue/UI focus is local to the initiating browser; economy, storage, save
  hydration, and transfer mutation are authoritative and participant-private.
  Close, range loss, Region replacement, and scene teardown destroy the local
  service without changing stored goods.

## Confidence and open questions

- Confirmed: native owner, command graph, top-level membership, 28-cell order,
  transfer gestures, Sack child-root ownership, save-tree validity, affected
  account root/depth counts, deployment history, and the absence of a submitted
  browser diagnostic.
- Confirmed: Soggy's active continuation owns zero storage roots. The separate
  profile projection contains the same active wizard's possible retirement
  Sack and is consumed only by explicit New Game/retirement; it is not an older
  archived root that may be injected into a resumed continuation. The empty
  StoreGrid report is therefore expected for that save, independently of the
  black-canvas defect.
- Confirmed violated web owner: `HubInventoryUi` keys `NativeHubSurface` by
  `surface.kind`, then its renderer effect also depends on `surface.kind`.
  Every reachable trader command therefore unmounts the Chat Pixi application
  and constructs a second WebGL application even though both surfaces belong
  to the same named trader transition. The direct-service positive control
  removes only that predecessor/teardown edge and renders correctly. The
  absence of a WebGL context-loss event is expected evidence here: the failed
  application remains nominally ready and semantically populated while its
  rendered surface is black.
- Unknown material native facts: none. The remaining implementation falsifier
  is a stable single-canvas owner across all four trader command replacements;
  if that candidate still produces black pixels on the report artifact or a
  forced-slow transition, the lifetime model is false and must be reopened.

## Web implementation consequence

- Preserve the generated dialogue graph, authoritative item tree, 28-root
  StoreGrid, and save schema. Do not discard, flatten, truncate, or silently
  normalize the affected valid storage to make the menu open.
- Keep one `NativeHubSurface` and one Pixi/WebGL application for a named
  trader's Chat-to-service command replacement. Preserve the native logical
  owner replacement by rebuilding the renderer model in that application,
  restart the service reveal clock, and use the live model kind for per-frame
  reveal timing. Apply the same owner key to Fomentius, Hagatha, Luthacus, and
  Shlorio. Add the seven-Sack/capacity branches to the existing browser
  fixture. Do not add a Luthacus-only catch, blank fallback, delayed timer,
  account-specific migration, or retained Chat controls beneath the service.
- If current production does not reproduce, repeat the same manifest against
  the report-time `9691cd7d` tree and record the first nonfailing commit before
  deciding that another already-landed change closed it.

## Validation contract

- Red/green focused coverage must preserve the full valid 68-object affected
  shape or an equivalent generated seven-retirement manifest, then prove empty,
  one, seven, and 28 direct roots; nested/empty Sack transfer and browse; and
  profile-only New Game versus active-resume ownership.
- Every merchant/service sibling must still open, close, select, and teardown.
  Luthacus must show no price, retain exact transfer/audio rules, and never
  expose descendant items as direct StoreGrid cells.
- The exact Chat and service DOM canvases must be the same node/application for
  all four trader commands. Selector-only NPCs retain their existing dialogue
  owner. A forced-slow Chat-to-service transition must still paint nonblack
  service pixels after reporting `ready`/`settled`; direct-service and ordinary
  cached transitions remain positive controls.
- Mac Chrome production-bundle journeys must exercise the report-time and exact
  candidate trees at 1600 by 900 and coarse-pointer landscape, keep the client
  connected after service open, and capture empty page, console, crash,
  context-loss, failed-request, failed-response, wire, and host-error arrays.
- The exact candidate must pass `/opt/homebrew/bin/bash ./scripts/validate.sh`
  on the Mac mini. If reusable native truth changes, the matching Mod Loader
  report and registered static-RE suite must also be updated and run there.

## Implementation validation receipt

- Red reproduction: the exact retained `9691cd7d` production artifact ran in
  isolated task-owned Mac ports with its matching protocol 96 supervisor and
  a byte-preserved affected profile. The physical Chat path produced a black
  frame SHA-256
  `6d053b3e9fae1092b6760527448a3f7588836ffda4839a6a58eac8b92c10dd38`;
  direct-service positive control rendered the full seven-Sack grid at
  `0612c1a8b6b6c8e828eac8eb37529b22b6a0f5a1cdbc60a4616e962eb5ab5c10`.
  Both reported renderer `ready`, reveal `settled`, seven storage roots, Metal,
  and empty error/context-loss arrays. The Linux replay independently produced
  the same black physical-path frame at
  `b2f3ac6363cd1d79171930b23bf3afcea2ba924789125a36e20d7c0429f0e6a8`.
- Current-production positive control: `05f2232a` on the same Mac/Profile/path
  visibly rendered the complete service at
  `88317c69b375fae68d0fb85144fe0f81afd81aa478a8b4486231be8abfc7c4be`.
  This establishes timing sensitivity; it is not accepted as structural
  closure while current source still forces the double-application lifetime.
- Implementation on rebased source base
  `e3eff7b4152c0709aeee107dd366236bf63e077c` gives dialogue/service pairs one
  `hubNativeSurfaceOwnerKey`. `NativeHubSurface` now keeps its Pixi/WebGL
  application across the command replacement, rebuilds only the logical model,
  resets the reveal clock on the kind edge, and reads the live model kind in
  the frame callback. Inventory and a later unrelated actor still receive
  distinct component/application lifetimes. No economy, item, save, protocol,
  authority, copy, audio, or native content changed.
- Regression coverage: the focused Mac source contract failed exactly `25/26`
  before implementation because the shared owner did not exist, then passed
  `26/26`. The complete Hub UI/typecheck group passed `86/86`. The Sack/Dye
  browser fixture now seeds seven direct archive Sacks, preserves nested
  contents, and marks the dialogue canvas before requiring that same node in
  Luthacus's service. Existing empty, one-root, 28-capacity, Last Word,
  transfer, profile/continuation, and save tests remain green.
- Exact-tree Mac canonical gate: `/opt/homebrew/bin/bash ./scripts/validate.sh`
  passed backend build with zero warnings/errors, all 28 Website/backend
  contracts, formatting/lint/import/generated checks, every frontend group
  including `1,719/1,719` Boneyard/game tests and the updated `86/86` Hub UI
  group, `5/5` desktop tests, production frontend/GameHost builds, bundle
  budget, and media policy. Production entry `Game-CBJ990_a.js` measured
  `258,251` raw / `78,104` gzip bytes under `524,288 / 134,144`. Log SHA-256 is
  `3f0963fbb60970ee5e4c5519c802fe6870984f242f248dfeaa3d949202e92b97`.
- Mac Chrome desktop acceptance: the built candidate completed standalone Hub,
  every companion service, the physical Luthacus Chat command, seven direct
  archive roots, selected/take transfer, recursive Sack browsing, item/belt,
  Dye, and active-Boneyard siblings. It retained exact cue deltas of 18
  `backpack_open` and 12 `backpack_close`; page, console, and failed-response
  arrays were empty. Browser log SHA-256 is
  `cb14a393736bbb6a75131cc77a8d4d0e9751bd15a6721f446abf413c1503055e`;
  reviewed recursive-storage frame SHA-256 is
  `21738baeb709fcda7d3ae9568f689311882a666bded9454b4f8797f0c4a2dab2`.
- Mac Chrome touch acceptance: a focused `896 x 414`, device-scale-two,
  touch-enabled built-candidate journey started beside Luthacus, opened Chat,
  replaced it with InventoryShop, retained the marked canvas node, rendered all
  seven roots visibly, and reported empty page, console, and failed-response
  arrays. Reviewed frame SHA-256 is
  `6af591c0a8dd39b10e62ae2c49fb55f4ba2f60b4591940c505f78e1f9bc7dca4`.
- No member is browser-blocked and no material unknown remains. The durable
  Mod Loader reports already owned every native fact used here, so no native
  report/catalog changed. Publication and deployment were not requested and
  were not performed.
