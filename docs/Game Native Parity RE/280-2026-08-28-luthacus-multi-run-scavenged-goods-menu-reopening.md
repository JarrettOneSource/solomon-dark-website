# 2026-08-28 — Luthacus multi-run Scavenged Goods menu reopening

> **Partial supersession, 2026-08-28:** entry 295 restores ordinary completed-run
> carried-item archival. The storage-grid, transfer, Sack navigation, and
> multi-run ownership recovered here remain current.

## 2026-08-29 — Cross-surface native UI renderer lifetime reopening

### Reported smell and parity question

- Reported production behavior: while `HAGATHA'S CHARMS AND CURSES` was open
  in the College, selecting from the companion Inventory produced a visual
  failure. The prior Luthacus closure retained one WebGL application only for
  a named trader's Chat-to-service command replacement; it explicitly left
  standalone Inventory and a later service as distinct application lifetimes.
- Current-main reproduction: on exact Website tree `0c5f1577`, Mac Chrome 151
  opened and closed standalone Inventory, then opened Hagatha directly. The
  settled Hagatha surface remained semantically `ready`, retained its canvas,
  and reported no WebGL context loss, but became almost completely black within
  four seconds even without another click. Opening Hagatha without the prior
  Inventory lifetime stayed fully painted through the same interval.
- Stock behavior to preserve: native `Game` retains one graphics/application
  owner while optional InventoryScreen, Chat, Shop, PerkShop, InventoryShop,
  and DowsingShop objects replace one another. Screen replacement does not
  destroy and recreate the game's graphics device or shared native UI assets.
- Falsifiers: an item/model decoder defect would fail the direct-Hagatha
  control; a pointer/focus defect would require the click; a context-loss path
  would emit a loss event or leave the renderer non-ready. All three are
  falsified. The remaining causal boundary is per-surface WebGL/resource
  destruction between valid sequential owners.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail owner/instructions | retail Beta 0.72.5 `SolomonDark.exe`, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; Inventory opener `0x005C6F10`; service dispatcher `0x00514A20`; Hagatha `PerkShop` vtable `0x00790374` | Game retains the graphics owner; every service attaches a companion InventoryScreen and replaces logical UI objects without replacing the graphics device. | high |
| Existing durable stock UI evidence | this entry plus entries 087, 181, 255, and 262 | Standalone Inventory, all four services, their companion InventoryScreens, Game-owned modal HUD controls, selection, close, and teardown are already fully enumerated. | high |
| Current Mac failure | Apple M2, Chrome 151, exact current-main tree hash `798c999014dcf18253d70a86a4784104fd0b205e`; standalone Inventory then direct Hagatha | Hagatha is fully painted at settlement and two seconds, then black by four seconds while its DOM owner and canvas remain mounted. Reviewed black frame SHA-256 `d68304734830f75db8e12e5077ec028b3da029570fad461cf509847724992aaf`. | high |
| Differential control | same machine/tree/session path, direct Hagatha with no prior Inventory application | Hagatha remains fully painted after four seconds. Reviewed frame SHA-256 `1fc9980e12f315877b353ba52cb825c7507b549498f90d7a0b97aba500f280f3`. | high |
| Current web causal trace | `HubInventoryUi` and `hub-inventory-renderer` at `0c5f1577` | Each keyed `NativeHubSurface` owns `createHubInventoryRenderer()` and destroys the Pixi application, native UI adapters, atlases, textures, and mod textures on unmount. The earlier same-trader key protects Chat-to-service only; Inventory-to-service and service-to-unrelated-owner edges still destroy/recreate the complete GPU resource family. | high |
| Current pointer ownership | same Mac Hagatha surface; exact painted UI-47 backpack centre `(763,855)` | `document.elementFromPoint` resolves the full-stage `Deselect inventory item` action instead of the Game-owned backpack/game-back action. This does not cause the no-click black frame, but independently violates entry 262's shared service-root hit contract. | high |

The Mac tree was materialized from exact current-main content despite the Mac
checkout's stale remote ref; its written tree hash equals the Windows-side
`0c5f1577^{tree}` exactly. The captures are task-owned reproduction evidence,
not retained repository artifacts.

### System boundary and complete membership

Native/web system: the scene-local native gameplay UI renderer owner, from the
first optional surface open through every logical replacement and final scene
teardown. Logical modal objects remain distinct; only the browser WebGL and
texture-resource lifetime is shared.

| Member / branch | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| standalone College InventoryScreen | `0x005C6F10`, `InventoryScreen 0x00794F54` | exact-ported by this reopening | may close and precede any later College surface without invalidating its art |
| active-Boneyard InventoryScreen | same Game-owned screen pointer | verified-already-at-parity under the shared owner | retains its existing pause, selection, Sack, and teardown behavior |
| Hagatha PerkShop plus companion InventoryScreen | `0x00514A20`, `0x00790374` | exact-ported by this reopening | Inventory-first and Chat-first paths remain painted, selectable, and settled |
| Fomentius Shop plus companion InventoryScreen | `0x00514A20`, `0x00794D7C` | exact-ported through the shared correction | same sequential-open and selection proof |
| Luthacus InventoryShop plus companion InventoryScreen | `0x00514A20`, `0x0079044C` | verified-already-at-parity, broadened lifetime proof | same-canvas Chat replacement and cross-owner Inventory-first control both pass |
| both Shlorio DowsingShop states plus companion InventoryScreen | `0x00514A20`, `0x00790524` | exact-ported through the shared correction | pre-roll/result/MsgBox siblings retain art and flash lifecycle |
| trader Chat and selector-only College dialogues | `Chat 0x0079061C` and existing dialogue catalog | exact-ported through the shared correction | logical content/reveal resets without constructing another WebGL application |
| ItemInfo, HoverBox, StoreGrid selection, Sack pages, DyeClothing, notices, belt, stats pages, and modal HUD | existing renderer model members | verified-already-at-parity | model rebuilds cannot destroy the shared application or leave stale state |
| rapid open/close, focus, touch, keyboard, controller, range loss, and Region interruption | shared input and modal teardown owners | exact-ported by this reopening | no black frame, stale input owner, or delayed resource destruction |
| session content assets | immutable welcome-time mod asset list | verified-already-at-parity | one scene-local renderer is constructed from the exact admitted list |
| final Hub/Boneyard scene teardown | Game/Region destruction boundary | exact-ported by this reopening | renderer and every owned GPU resource are destroyed exactly once |
| Title, Create, SkillScreen, SkillPicker, Pause, loading, Game Over | separate native/web renderer families | out-of-system (not `HubInventoryUi` model members) | no lifetime or resource change in this pass |

No member is blocked by the browser platform.

### Recovered ownership and behavioral contract

- `HubInventoryUi`, not an individual `NativeHubSurface`, is the browser owner
  whose lifetime matches the scene-local native UI family. It retains one
  lazily created renderer promise across null gaps and keyed logical surfaces.
- Each surface mount attaches that retained canvas, installs its current model,
  resets the correct reveal clock, and subscribes its frame consumer. Surface
  cleanup detaches the canvas and subscription but does not destroy textures.
- Parent/scene cleanup destroys the retained renderer once. A later scene may
  create a new owner from its own immutable admitted mod-asset list.
- Inventory, dialogue, and service state, native reveal timing, selection,
  audio, authority, saves, protocol, and teardown semantics remain unchanged.
  Retaining the browser graphics owner is a resource-lifetime correction, not
  retained actionable Chat or a compatibility fallback.
- The Game-owned UI-47 backpack action remains above InventoryScreen content in
  every companion service, including the participant root. At a nested Sack it
  pops one root; at the service root it closes that service. The full-stage
  deselection action may own genuine empty Inventory pixels but never this
  visible Game control.

### Web implementation consequence

- Move renderer construction/destruction to one retained owner held by
  `HubInventoryUi`; pass that owner to each keyed `NativeHubSurface`.
- Replace per-surface `createHubInventoryRenderer()` and `destroy()` with
  retained `get()`, canvas attachment, and detachment. Keep logical owner keys
  and model/reveal resets so stock screen replacement semantics remain exact.
- Mount the existing inventory-resume action for every service root, not only
  nested Sack paths, so the painted UI-47 control routes to the existing shared
  back/close consumer. Leave the generic clipped close action to dialogue-only
  surfaces.
- Add no delay, retry, black fallback, Hagatha exception, texture substitution,
  protocol change, or economy mutation. The earlier same-trader correction was
  directionally correct but incomplete because its membership sweep stopped at
  Chat-to-service and excluded standalone Inventory-to-service edges.

### Validation contract

- Focused red/green coverage must prove a retained owner creates once across
  multiple `get()` calls, destroys once on owner cleanup, and can construct a
  fresh renderer after development cleanup.
- The Hub trader browser journey must mark the first standalone Inventory
  canvas, close it, then require that exact node/application across every
  dialogue and service sibling. After the reported Inventory-to-Hagatha path,
  wait beyond the four-second failure window, select a companion item, and
  require visibly nonblack native pixels with `ready`/`settled` state.
- At every companion service root, the semantic resume rectangle must coincide
  with painted UI 47 and win `elementFromPoint` over the full-stage deselection
  action; activating it closes the service with the existing native cue.
- Retain the existing full Hagatha, Fomentius, Luthacus, Shlorio, Sack, Dye,
  item-selection, transaction, audio, and teardown journeys with empty page,
  console, request, response, host, and context-loss arrays.
- Run the complete supported `/opt/homebrew/bin/bash ./scripts/validate.sh` on
  the exact byte-identical Mac candidate. Publication and deployment remain
  separate and require explicit authorization.

### Implementation validation receipt

- The exact current-main Mac red path opened and closed standalone Inventory,
  then opened Hagatha. The service stayed logically `ready`/`settled` with no
  context loss but became black without another click; reviewed frame SHA-256
  is `d68304734830f75db8e12e5077ec028b3da029570fad461cf509847724992aaf`.
  The matching no-prior-Inventory control stayed fully painted at SHA-256
  `1fc9980e12f315877b353ba52cb825c7507b549498f90d7a0b97aba500f280f3`.
- `HubInventoryUi` now holds one lazy retained renderer owner for its complete
  scene lifetime. Keyed logical surfaces attach/detach that canvas and rebuild
  their model without destroying GPU resources; scene cleanup destroys it once.
  The shared service-root UI-47 semantic action now also wins over full-stage
  deselection. No economy, protocol, save, stock content, timing, or authority
  code changed.
- The browser regression failed red because Hagatha's canvas lacked the marker
  written onto standalone Inventory, then passed green. Focused Mac typecheck
  and Hub UI coverage passed `82/82`, including renderer reuse, reset, and
  in-flight cleanup races.
- Mac Chrome 151 at `1600x900` retained that exact canvas through standalone
  Inventory and Hagatha, Fomentius, Luthacus, and Shlorio. Every service's
  painted backpack centre resolved to its resume action and closed cleanly.
  After companion Mana Potion selection and 4.25 seconds, Hagatha's central
  crop retained `554827` nonblack pixels and RGB total `78952155`. Page,
  console, failed-request, failed-response, and WebGL-context-loss arrays were
  empty. Reviewed frame SHA-256 is
  `e0e33cad21b067c0b15677b12ab87105457110e0c9f9b32b43255acae47afd74`;
  receipt SHA-256 is
  `256ebf3b4e2dd6acd98b7b2597c88c496e7b5b8df110e2de20f7ef1b0f0ceb4f`.
- The production-bundle Sack/Dye journey passed all standalone, four companion
  service, Luthacus Chat replacement, nested Sack, item/belt, Dye, and active-
  Boneyard paths. It recorded 21 reviewed screenshots, exact Sack audio deltas
  `12` close / `26` open, UI-47 overlap `0.9677..1`, and empty page, console,
  and failed-response arrays. Log SHA-256 is
  `dbac99914f9f29312ddd27f0070682d4b00a6bd4ef4542080640ef8d545b1bf6`;
  Hagatha companion frame SHA-256 is
  `921566c028190d53e57d8dfb6432261a50f23730cbf68500f88a3ae2013662e8`.
- The canonical Mac gate passed the byte-identical pre-publication source tree:
  backend build zero warnings/errors; `28/28` Website contracts; all registered
  frontend groups including `1759/1759` game tests and `82/82` Hub UI tests;
  desktop `5/5`; production frontend/GameHost builds; bundle budget; and media
  policy. `Game-D8son2vD.js` measured `264830` raw / `80379` gzip bytes under
  `524288 / 134144`; validation log SHA-256 is
  `00e6600f9cb6cb86cef77a038c74abfd805082fbebde01494fe705be5485adfa`.
- The broader two-client-capable trader smoke passed the reported lifecycle and
  Fomentius companion branches, then its existing physical route to Luthacus
  timed out against unrelated Courtyard collision near Skorcha. That timeout
  has empty browser/request/response error arrays and does not replace the
  complete focused and production-bundle receipts above.
- No Mod Loader file or native report changed: the stock owners and assets were
  already complete. This pass corrects the Website's incomplete browser
  resource-lifetime membership. No member is browser-blocked.

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
- Retail and Website game-over archival build at most one nonempty retained
  Sack per completed wizard and insert it into profile storage. Terminal Game
  Over and explicit Kill/New Game retirement both scavenge eligible carried
  equipment/backpack; older profile roots and nested descendants remain intact.
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
