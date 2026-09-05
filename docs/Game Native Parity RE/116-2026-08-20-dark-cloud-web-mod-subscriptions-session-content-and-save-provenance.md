# 2026-08-20 — Dark Cloud web-mod subscriptions, session content, and save provenance

## Reported smell and parity question

- Reported web behavior: the title rendered the stock **EXPLORE THE DARK
  CLOUD** control but did not open a scene. The Library still handed packages
  to the retired DLL launcher, accounts had no subscriptions, admissions used
  an empty content manifest, the Lua seam was one developer-console VM, and
  schema-one browser saves deliberately omitted mods.
- Stock behavior to recover: a full-screen `DarkCloud` owner entered from the
  title, with account status, Recent / Online Levels / My Levels / Multiplayer
  lanes, one selected-content list, search/sort/options actions, and modal
  interruption/return behavior. The Website extension must use that shell for
  subscribed mods, published Boneyards, and the shared Hub without reviving the
  Raptisoft service or native launcher.
- Reproduction inputs/scenes: anonymous and authenticated Title -> Explore;
  Library Subscribe; Dark Cloud enable/disable; new and resumed admissions;
  matching and mismatched shared-Hub parties; matching, added, removed, and
  version-changed save mod sets; Lua and Boneyard package members.
- Falsifiable questions: a title action with no scene, a subscription not bound
  to one Website account, a disabled mod entering a later admission, a welcome
  manifest differing from materialized content, two mods sharing one VM, a
  party launching with different manifests, or a mismatched save resuming
  without an explicit decision disproves the model.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Clean stock | Retail `SolomonDark.exe`, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; Mod Loader `tests/fixtures/webgame/menu-reference-captures/dark-cloud-*.png` and `menu-layouts/dark-cloud-*.json` at `f2f50f60` | One retained black/stone/leather/gold scene. Entry is Online Levels. It carries account status, Recent / Online Levels / My Levels / Multiplayer, one list, Play/Edit, Search, Sort, Options, and modal Account/Menu/Settings children. | high |
| Instructions | `DarkCloud` vtable `0x00797C44`; constructor `0x0058F0C0`; tick/init `0x0058F320` and `0x00592E40`; render `0x00594FC0`; action dispatch `0x005A5530`; `DarkCloudSwipebox` vtable `0x0079794C`; `DarkAccountPanel` vtable `0x00797A1C` | The scene owns list state, selected row, account state, child controls, fade/return, and action dispatch. Account render branches cover signing-in, guest, invalid, unactivated, and named-account states. | high |
| Asset/data | Mod Loader `native-asset-object-map.json`, `native-presentation-ui-fonts-and-loader.md`, and `native-menus-and-boot.md` at `f2f50f60` | `UI.8`, `UI.13`, `UI.21`, `UI.49`, `UI.75`, `UI.80`, `UI.81`, `UI.112`, `UI.115`, `UI.150`, and `UI.156` own the shell, brackets, cracked stone, buttons, search/sort, side figures, skull, and account flourishes. | high |
| Native sibling census | String/vtable/xref census in the existing read-only Ghidra project | Full family is `DarkCloud`, `DarkCloudSwipebox`, `DarkAccountPanel`, `DarkCloudDownload`, `DarkCloudUpload`, `DarkCloudUnshare`, `DarkCloudRating`, `DarkLoginWatcher`, and `DarkCreateAccountWatcher`; no sibling is silently omitted below. | high |
| Current web | Website shared-Hub party entry at `8f7c401`; `game-protocol.ts`, `game-save-document.ts`, `game-session-supervisor.ts`, `game-host.ts`, `WebGameSaveEndpoints.cs` | The protocol already owns exact content identities and the shared Hub already owns per-player admissions and party-scoped runs. The missing seam is account-resolved content carried by each ticket and frozen into a compatible party run. | high |

This pass used the existing read-only Ghidra project
`Decompiled Game/ghidra_project/SolomonDark.gpr`, preferred image base
`0x00400000`, to reconcile the already-curated native report. No live injected
process or ASLR address is evidence for this entry.

## System boundary and membership inventory

Native system: **Dark Cloud account/content browser** — title ingress through
retained list, account, child-operation, interruption, and return ownership.
The Website extension adds account subscriptions, immutable per-admission
content, compatible party-run materialization, isolated mod runtimes, and save
provenance to that boundary.

| Member (class/variant/scene/branch) | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Title Explore ingress and return | `MainMenu` / `main_menu.explore_dark_cloud` | `exact-ported` | Explore opens one retained scene; Menu returns without a second title owner. |
| `DarkCloud` shell and selected-tab geometry | `0x0058F0C0`, `0x00592E40`, `0x00594FC0`; exact layout fixtures | `exact-ported` | Full-stage shell, account band, list frame, footer actions, fixed tab x positions, and selected label/bracket rise use the captured contract. |
| `DarkCloudSwipebox` list/search/sort/selection | vtable `0x0079794C`, render `0x005946E0` | `exact-ported` | Pointer/keyboard selection, empty states, search, sort, selected row, and action availability cover every web lane. |
| Recent | native public recent branch | `exact-ported` | Mixed recently published mods/Boneyards, deterministically ordered. |
| Online Levels | native public Boneyard branch | `exact-ported` | Published playable Boneyards preserve name/author metadata. |
| My Levels | native local/user branch | `exact-ported` | Mods lists the current account's subscriptions and owns enable/disable controls. |
| Multiplayer label | permanently lit, noninteractive native label | `exact-ported` geometry; intentional web extension | The lane exposes one Shared College Hub destination and enters through the single-use admission path; browser lobbies are not restored. |
| Named/guest account status | account branches in `0x00594FC0` | `exact-ported` | Guest and authenticated username states render in the stock account band; Website authentication is authoritative. |
| `DarkAccountPanel`, `DarkLoginWatcher`, `DarkCreateAccountWatcher` | vtables `0x00797A1C`, `0x00797E74`, `0x00797F44` | `out-of-system` | Raptisoft credentials are retired; guest action routes to Website sign-in. |
| `DarkCloudDownload` | vtable `0x00797CFC` | `exact-ported` as Subscribe and admission materialization | Subscribe persists by account; admission resolves exact enabled versions/hashes and loads accepted web members. |
| `DarkCloudUpload` | vtable `0x0079857C` | `out-of-system` | Library publishing already owns uploads. |
| `DarkCloudUnshare` | vtable `0x00797FFC` | `out-of-system` | Library ownership already owns deletion/unpublishing. |
| `DarkCloudRating` | vtable `0x00797DBC` | `out-of-system` | This cutover has no rating domain; no inert control is rendered. |
| Search / Sort / Options modals | native fixtures and `MyQuickCPanel` family | `exact-ported` | Search and sort remain modal-owned; Options becomes selected-mod activation. |
| Shared Hub and in-world parties | Website shared-Hub supervisor/host | `out-of-system` native social policy; exact web extension | Multiplayer shows the resident Hub, not a lobby directory. Admissions retain per-account content; party launch requires exact manifest equality. |
| Lua package member | Mod Loader authoring contract plus Website `WebLuaRuntime` | `exact-ported` | One bounded VM per enabled Lua mod in a private session or party run; deterministic order and independent state/failure/teardown. |
| Boneyard package member | native overlay roots plus Website projector | `exact-ported` | Every accepted `.boneyard` is parsed at publish and materialized into only the owning private session or compatible party run. |
| Native `images/` replacement overlay | native compiled atlas destination model | `blocked-by-platform` | The browser bundle has content-addressed module assets, not mutable process-relative `images/`; publishing rejects these overlays. |
| Arbitrary native `data/` overlay other than Boneyards | process-relative native filesystem overlay | `blocked-by-platform` | The browser authority has typed state, not a mutable native data tree; publishing rejects untyped overlays. |
| Save content manifest and mod-owned state | Website extension; retail bytes contain no mod list | `exact-ported` web safety ownership | Schema two records exact identities and bounded per-mod state; mismatch requires Continue/Cancel; removed/changed state is discarded. |
| Legacy launcher resolver/update/protocol/download UI | Website-only legacy seam | `out-of-system` | DLL-loader endpoints, links, types, tests, and copy are removed rather than retained as compatibility code. |

## Native ownership thread

- Owner and construction path: Main Menu action dispatch constructs one
  `DarkCloud` owner. It constructs `DarkCloudSwipebox`, account state, child
  controls, and title assets; child modals return to the retained browser.
- Upstream producers: Website account state, subscription queries, public
  content queries, tab actions, selection, and search/sort controls write scene
  state. The backend alone resolves admission content.
- Transitions: entry -> selected lane; Recent, Mods, Boneyards, and Multiplayer
  replace the list while retaining the shell; Search/Sort/Options/account/menu
  suspend list input; launch tears down the browser.
- Downstream consumers: `DarkCloudBrowser_Render` paints the shell/account/list
  and footer. Website subscription actions mutate only future admission state.
  The supervisor ticket and host, never the scene, own materialized content.
- Siblings: Library publishing, account auth, shared-Hub admission and parties,
  game content handshake, Lua VM, Boneyard catalog, and save coordinator.
- Teardown: scene-owned queries/modals retire with the scene; tickets are
  single-use; private mod VMs retire with their host and party VMs retire with
  their run/party; no subscription mutation changes a live authority.

## Recovered behavioral contract

- The 1600 x 900 reference owns exact primary rectangles: Menu `[5,5,55,55]`,
  account `[586,58,1014,108]`, Recent `[460,128,630,197]`, Online
  `[630,128,970,197]`, My Levels `[970,128,1140,197]`, footer primary
  `[623.5,809.5,976.5,878.5]`, Search `[390,818,480,870]`, Sort
  `[495,818,585,870]`, and Options `[1017.5,818,1202.5,870]`.
- A selected tab raises its label 8 px and expands the `UI.13` bracket pair from
  y `136..187` to `128..193`; bracket x positions do not move.
- Native entry selects Online Levels. The web extension selects Mods for an
  authenticated player and Boneyards for a guest.
- Content order validates dependencies, then uses priority and package id. Each
  Hub ticket carries the exact id/version/content-hash payload materialized for
  that account. A party launch fails closed unless all member manifests match.
- Each party run owns its Boneyard catalog and Lua VMs. Commands enter only its
  authoritative tick after per-VM bounds; one VM cannot read another's globals,
  callbacks, timers, command queue, or `sd.state`.
- New packages may contain sandboxed Lua and typed Boneyards. DLL entry points,
  arbitrary data overlays, and mutable native image trees are rejected.
- Save schema two writes the exact manifest and per-mod state. Exact matches
  restore state; added mods start empty; removed or changed identities lose old
  state after explicit Continue. Cancel provisions no admission.

## Web implementation consequence

- `ModSubscription` owns account membership/enabled state. The backend content
  resolver owns latest-version selection, dependency validation, archive/hash
  verification, and the admission payload.
- `GameSessionSupervisor` binds immutable content to each one-use ticket.
  `GameHost` retains content per admitted player and creates party-scoped VMs
  and Boneyard catalogs only after exact manifest compatibility.
- `DarkCloudScene` owns presentation and subscription actions only. Library
  Subscribe replaces launcher install/download affordances.
- Native-lobby, native-save ZIP, Steam auth, launcher resolver/update, crash
  uploader, and raw launcher-download surfaces have no Website owner and are
  removed completely. Platform-blocked package members fail at publish time.

## Validation contract

- Focused automation: account isolation; idempotent subscribe/unsubscribe;
  enabled mutation; dependency order/failure; archive extraction; ticket and
  private-session payloads; manifest-compatible party launch; per-party VM
  isolation/entry/teardown; Boneyard enrollment; schema-two round trip; all
  mismatch classes; Dark Cloud membership/geometry; launcher-seam absence.
- Browser journey: authenticated Library Subscribe -> `/game` -> Explore ->
  disable/enable -> Shared Hub; Boneyards and Multiplayer lanes; matching
  resume; mismatch Cancel then Continue; named/guest account states; no page,
  console, request, protocol, asset, or WebGL errors.
- Stock comparison: at 1600 x 900 the shell/header/tab/frame/footer rectangles
  and selected-tab deltas match fixtures; shared-Hub and mod semantics are the
  documented Website extension rather than invented retail behavior.
- Acceptance: welcome manifest equals enabled subscriptions; every compatible
  party member has the same manifest; each enabled Lua entry runs once per
  scope; each enabled Boneyard is scope-local; checkpoint manifest equals host
  content; canonical validation and the Windows browser journey pass.

## Implementation validation receipt

- Implementation: account-owned `ModSubscription` rows and Library Subscribe
  actions replace launcher install state. `WebModContentService` reopens,
  verifies, dependency-orders, and bounds the exact enabled package set.
  Shared-Hub tickets carry that immutable payload; private sessions and
  compatible party runs materialize scope-local Boneyards and one VM per Lua
  member. Schema-two saves carry the host manifest and matching `sd.state`;
  the title requires Continue or Cancel for every added, missing, or changed
  identity.
- Shared-Hub integration: the upstream resident-Hub/party cutover remains the
  only multiplayer path. Supervisor coverage proves three compatible ticket
  manifests reach welcomes and launch one party run, while different manifests
  reject launch before world partition. Legacy browser lobbies and every
  Website Steam/DLL-launcher endpoint, service, link, type, and test are absent.
- Windows canonical gate: the LF-preserving Windows-native checkout used Node
  `22.17.0`, npm `10.9.2`, .NET SDK `10.0.302`, and unchanged
  `./scripts/validate.sh`. It passed the backend build/format, 11 backend
  contracts, frontend lint/import boundaries, 40 loot tests, 158 prerequisite,
  save, and secondary tests, 1,045 broad game tests, 13 party tests, 5 level-up tests, 7
  diagnostics tests, 14 Hub UI tests, 5 desktop tests, production builds, the
  bundle budget, and production media policy.
- Browser proof: Windows Chrome `151.0.7922.170` registered a fresh account,
  subscribed to `the-survival-grounds-as-shipped`, entered Explore, displayed
  the authenticated account and all four lanes, selected the subscribed row,
  disabled and re-enabled it, and observed the exact nonempty manifest
  `87f2c82f25811433fe66215f4b26e7b598b3fd4b781f7a626fa1a90c38ff1c4e`.
  The 1600 x 900 geometry matched the recovered shell; the first column label
  cleared its stock corner; page and console error lists were empty. Receipt:
  `C:/sdw/receipts/solomon-dark-cloud-web-mods-20260821.png`.
- Remaining scope: no required member remains. Deployment and production
  verification are separate from this implementation receipt.

## 2026-09-02 — Reopened: complete stock Dark Cloud scene composition

### Reported smell and parity question

- Owner report: make the web Dark Cloud look like the stock game under the same
  stock-asset/UI-system standard as Settings; current Website-only catalog
  content may remain.
- This is a secondary report against the earlier visual closures. Those passes
  proved full-viewport responsive behavior and reused several stock crops, but
  did not enumerate the complete stock scene painter membership. The browser
  accepted rounded CSS tabs, OS-font headings/rows, CSS-gradient footer plates,
  four list corners without the second gold corner set, only two of the six
  figure/side ornaments, and one-corner-set modals even though the settled
  fixtures contain all of those extractable members. The skipped rule was the
  complete asset/painter membership sweep.
- Falsifiers are any rounded tab or generic card skin, any visible primary
  chrome label in an OS font, any missing stock scene/frame/footer member, a
  Search/Sort sheet with an invented Done footer, a Website-only branch that
  abandons the shared native vocabulary, or a mobile projection that makes the
  exact members unusable.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | `SolomonDarkAbandonware/SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; preferred base `0x00400000` | Same retail 0.72.5 image as the recovered `DarkCloud` owner. | high |
| Clean-stock root | `dark-cloud-browser.png`, 1600 by 900, SHA-256 `6fcef51cb2071b117edd87b0a816caf9849562c2041464939a5e28d21f6cf4d1`, plus paired live layout JSON | The root is an authored scene: exact heading/account band, bracket tabs, framed Swipebox, simple bitmap rows, and three distinct footer control families. | high |
| Clean-stock children | `dark-cloud-search.png` `e61cf40e1ba4f4e8305a0967e4c36d1d400ba577b4bc290493b649cd0bdced58`; `dark-cloud-sort.png` `b6f25f0f312c4adcc8d4442cd536d15a51b6c3147aa47c6535249fc55902d880`; `dark-cloud-options.png` `9d385875a1aee88affec81099c8bc22fc5db838c1ff1fe3fb5b5bbad0de67e49`; `dark-cloud-login-settings.png` `27259c1b5936949030d24f11abaf3686aab75f008b6017d1a3b1c9c903de42fe` | Search and Sort are action-complete framed sheets with no green Done footer. Framed children use two nested `UI.17 x4` corner sets plus two `UI.18` side flourishes; account/settings-style children add the stock green footer. | high |
| Exact layout membership | `dark-cloud-browser.json` art/action census | Root art is `UI.29 x2`, `UI.31 x2`, `UI.32 x2`, `UI.20 x4`, `UI.107/.108/.109/.110`, `UI.17 x4`, `UI.13 x8`, `UI.101`, `UI.54 x2`, `UI.103 x3`, `UI.53 x6`, `UI.58`, `UI.66`, and `UI.42`; primary geometry is list `[55,173,1545,800]`, tabs `[460,128,1342,197]`, Search `[390,818,480,870]`, Sort `[495,818,585,870]`, primary `[623.5,809.5,976.5,878.5]`, Options `[1017.5,818,1202.5,870]`. | high |
| Font census | fixture text hooks and Website generated catalog | Root chrome uses `Fonts.308..349` (`heading`) for `THE DARK CLOUD` and `Fonts.216..307` (`menu`) for account, tabs, headings, and footer labels. | high |
| Current Mac browser baseline | Website `origin/main` `a2b19c2f5ab698fbc28e6e01d3cda94cfe025f1e`; Chrome captures: desktop root `b6dad37b284b1cfd269d8acc964a4a1b52fbec214b1c4da813a68d0046307c7d`, detail `38ff2a85c3c3a30f3897d1afba829b96c5c252d89443b62b86408537e387361b`, portrait `3e97e6886da43ae3b1d84f9995fd09d2b13d4b09d4b1c01abf7b5202a03c4c9a`, landscape `94e34fea3455a3bcf6a1f191eb51aa7bcd53d42c0ebf128bdbc197057c24a124` | The current root is recognizably themed but reads as a modern catalog: rounded border tabs, card rows/thumbnails, CSS button skins, missing stock background ornaments, and incomplete native frames. The journey completed; only Vite's expected missing `deployment.json` produced two 404s. | high |

### System boundary and membership inventory

Native system: **Dark Cloud presentation owner**, from full-stage background
composition through account heading, tab selection, Swipebox/list states,
footer controls, Search/Sort/Options/detail children, interruption, responsive
projection, and teardown. Subscription, party, layout-sharing, comment, and
content-download semantics remain with their current Website owners.

| Member / branch | Native source | Required disposition | Proof contract |
| --- | --- | --- | --- |
| full 1600 by 900 scene and stone/leather surfaces | `DarkCloud::Render 0x00594FC0`; root capture | `exact-ported` | desktop coordinates match; smaller viewports project the same vocabulary |
| top flourishes and six figure/side ornaments | `UI.29 x2`, `UI.31 x2`, `UI.32 x2`, `UI.20 x4` | `exact-ported` | every record exists once at each authored side/edge; responsive hiding is explicit platform projection |
| Swipebox outer stone and inner gold corners | `UI.107/.108/.109/.110` plus `UI.17 x4` | `exact-ported` | both corner families paint; neither is replaced by plain CSS borders |
| heading, beta, account, column, tab, and footer type | heading and menu bitmap wrappers | `exact-ported` | no second visible OS-font copy in primary chrome |
| four visible Website tabs | native `UI.13` tab family; native three controls plus Multiplayer label | `exact-ported` visual vocabulary; Website labels remain designed extensions | two exact brackets per tab, fixed X, selected eight-pixel rise |
| Mods, Subscribed, Parties, and Layouts list bodies | `DarkCloudSwipebox` plus Website data owners | `exact-ported` stock list vocabulary; Website content is `out-of-system` semantics | simple row stream, stock selection colour/order, no rounded/card container |
| loading, empty, error, retry, and developer-presence rows | Website states | `out-of-system` semantics; exact stock row/inset vocabulary | every branch stays inside the same Swipebox grammar |
| Search and Sort footer controls | `UI.103/.104`, `UI.53 x2`, `UI.58` or `.66` | `exact-ported` | exact idle/pressed art and HotRects `[390,818,480,870]` / `[495,818,585,870]` |
| primary footer control | `UI.101/.102`, `UI.54 x2` | `exact-ported` | exact 353 by 69 body, pressed offset/art, and semantic rectangle |
| Options footer control | `UI.103/.104`, `UI.53 x2`, menu label | `exact-ported` | exact 185 by 52 body and selected-content action without an inert row |
| Search child | clean Search capture, 520 by 205 inner panel | `exact-ported` | two frame-corner sets, two flourishes, field/action rows, no invented Done footer |
| Sort child | clean Sort capture, 320-pixel inner panel | `exact-ported` | two frame-corner sets, two flourishes, native inset options, no invented Done footer |
| selected-content Options and Website mod details | native Options/account dialog family plus Website content | `exact-ported` frame/control vocabulary; content semantics `out-of-system` | double frame, stock heading/inset/action/footer families; scroll remains browser policy |
| party and layout-sharing content | Website extensions | `out-of-system` semantics; exact stock list/panel vocabulary | no separate modern card skin |
| Esc menu | `SimpleMenu` entry 140 | `verified-already-at-parity` and out of this repaint | existing exact row/chrome/lifecycle path remains untouched |
| portrait and short-landscape touch projection | browser platform policy | `exact-ported` web projection | no horizontal overflow; visible actions at least 44 CSS pixels; stock members keep identity |

No member is blocked by the browser platform. Responsive reflow is a Website
projection because retail is fixed at 1600 by 900, but the browser can preserve
the exact assets, typography, state substitutions, and painter grouping.

### Native ownership thread and recovered contract

- `DarkCloud` owns one retained scene, its `DarkCloudSwipebox`, selection,
  account band, footer controls, and modal children. Search/Sort/Options return
  to that retained scene; Esc raises the independent shared `SimpleMenu`.
- The root's painter order is background stone, upper flourishes/figures,
  Swipebox surface and both frame families, tab brackets/text, list text, then
  footer bodies/surrounds/icons/text. Modal dim overlays the retained root and
  paints the double frame, body, inset controls, and any owned footer.
- Native tabs move only their label and bracket Y state. Footer families use
  distinct records; a CSS gradient cannot substitute for any of them.
- Website rows may contain thumbnails, versions, subscriptions, parties, and
  layouts, but those additions consume the stock row/inset vocabulary. Data
  fetching, mutations, download state, comments, input ownership, account
  authority, and teardown do not become UI-kit state.

### Web implementation consequence

- Add one pure Dark Cloud presentation contract and one semantic React module
  behind the maintained native UI kit. It owns exact record membership,
  desktop rectangles, tab state, double-frame children, and the three footer
  button families.
- Recompose `DarkCloudScene`, `DarkCloudPanel`, and the mod-detail shell through
  that module. Remove rounded CSS tabs, generic gradient plates, duplicated raw
  atlas-coordinate knowledge, and the incomplete one-corner-set panel path.
- Preserve every Website content/action branch. Search and Sort close from their
  committing action or Back/Escape and no longer grow an unobserved Done footer.

### Validation contract

- Focused tests pin every root/modal record, exact desktop rectangles, font
  wrappers, four-tab selected/resting geometry, idle/pressed footer art, and
  absence of generic tab/footer skins.
- Mac Chrome 1600 by 900 must exercise Mods, Subscribed Mods, Parties, Layouts,
  selection, Search, Sort, Options/detail, account state, and Esc Settings
  return. Root/list/tab/footer/modal bounds and record counts are compared with
  the clean stock fixtures; page, console, failed-response, and unsupported
  bitmap-glyph arrays must be empty.
- Mac Chrome DPR-2 portrait 390 by 844 and landscape 844 by 390 must retain zero
  horizontal overflow, list scrolling, and at least 44-pixel visible actions.
  The exact candidate must pass `/opt/homebrew/bin/bash ./scripts/validate.sh`.

### Implementation validation receipt

- `native-dark-cloud-contract.ts` now owns the complete root record inventory,
  exact 1600 by 900 rectangles, four Website-tab bands over the recovered
  `UI.13` grammar, and pure `UI.103/.104 + UI.53` tool-control plans.
  `NativeDarkCloudPresentation.tsx` is the semantic React owner for heading,
  bitmap text, stage art, both list-frame corner families, scaled tabs, exact
  Search/Sort/Options controls, the standard primary control, and double-frame
  child panels.
- `DarkCloudScene`, `DarkCloudPanel`, and `DarkCloudModDetail` now compose those
  modules. The rounded CSS tabs, CSS-gradient primary/tool/green controls,
  incomplete one-frame child, and raw per-crop imports are gone. Sixteen
  zero-consumer duplicate crops were deleted; the generated stock UI atlas is
  the sole chrome source, while exact `leather.png` and `stone-wall.png` remain
  only because CSS tiles those repeatable surfaces.
- Desktop Mac Chrome returned `status: ok` and exact recovered geometry: list
  `[55,173,1490,627]`, tabs `[460,128,882,69]`, selected/resting left brackets
  `[460,128,34,65]` / `[630,136,34,51]`, Search `[390,818,90,52]`, Sort
  `[495,818,90,52]`, primary `[623.5,809.5,353,69]`, and Options
  `[1017.5,818,185,52]`. The root exposed the full ten scene ornaments, eight
  list-corner records, eight tab brackets, and exact footer record families;
  Search/Sort had eight `UI.17` corners plus two `UI.18` flourishes and no
  invented Done, while detail used the same double frame plus `UI.105`.
- The same journey exercised idle/pressed substitutions for Search
  (`UI.103/.104`), primary (`UI.101/.102`), Options (`UI.103/.104`), all four
  tabs, selection, Search, Sort, Options and double-click detail entry,
  comments, subscribe/disable/enable/unsubscribe, Parties, Layouts, sign-out,
  guest re-entry, and the shared Esc menu. Page, console, failed-response, and
  unsupported-bitmap-glyph arrays were empty.
- DPR-2 portrait 390 by 844 measured list `[7,124,376,653]`, zero horizontal
  overflow, and 44-pixel minimum actions. Landscape 844 by 390 measured list
  `[12,96,820,236]`, zero overflow, and 44-pixel minimum actions. Final desktop,
  guest, detail, portrait, landscape, Layouts, and Parties captures hash to
  `25e65a4b1ada000950100aa3a10466c9b0ea158cdcc8faf9771d6eb25b8c9b98`,
  `a17192b349efcd89f8b0039f49f55dc21b48e5fef3b68dd67ab9cf84dadd7430`,
  `a0083af80655baaaf783edc0586b6336986393a3675173d137599bed6132c981`,
  `99be148f593b40aeab5db3ee30b86608d757350be116dccb4fc3034502b0b65f`,
  `5421e69d6040720eda720fe53957f1561833c6115c50d5e3142a5dd54dab8ab4`,
  `be636037fd8a0a87967a1ac7855894d6e93efbb508c16bebb66c0f6dc6e95456`,
  and `37e99e8ed504c946e9887ee3919502ad5321c9fcc8763addbe0a8529f7cd7853`.
- Stock-image comparison chose `(0,0)` for the top-left frame, Search, and Sort
  and `(0,-1)` for the bottom-left frame; mean absolute channel deltas were
  `12.48`, `13.16`, `13.29`, and `10.99`. Primary/Options content differs by
  design, but their DOM rectangles and native record memberships are exact.
- The shared validation manifest, focused suites, native-UI workbench, and full
  canonical-gate receipt are recorded in Settings entry 130. No presentation
  member is browser-blocked. Commit, push, deployment, and production restart
  were not requested or performed.

## 2026-09-05 — Reopened: missing tiled painters and mixed control vocabulary

The earlier closure counted individual Sprite draws and matched isolated corners.
It omitted the repeated draws, stretched edges, primitive shadows, and populated
Website content. That was an incomplete painter census. In particular, the
recorded second set of dialog corners is a **black shadow pass**, not another
gold frame. The previous double-gold-frame assertion is withdrawn.

### Evidence and causal trace

- Candidate base: Website `01f07fde`. A fresh Mac Chrome guest journey through
  `/game` reproduced the missing wall and rails, clipped resting tab tops,
  double gold dialog corners, and generic HTML controls in Search, Sort,
  mod details, and Layouts. No page or console errors were emitted.
- `stone-wall.png` was deleted by `6100d25f` while `dark-cloud.css` retained its
  URL. The generated UI atlas already contains the exact wall as `UI.30`.
  Restoring a second crop would preserve the duplicate asset ownership.
- Stock image identity was reverified: retail 0.72.5, 4,723,200 bytes,
  SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`,
  preferred image base `0x00400000`. Read-only Ghidra queries used the canonical
  `SolomonDark` project through the existing replica wrapper. No runtime PID or
  ASLR address is used here. Tool provenance: Mod Loader revision
  `08bfba9ef367f7b863848030d0a289dc31e33192`, wrapper SHA-256
  `b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`,
  and `decompile_targets.py` SHA-256
  `899167ca42624e09f26d22233365631a6ee8b3d106e337e20b77574894e97465`.
- Reference images are the existing `dark-cloud-{browser,search,sort,options}.png`
  fixtures. Their paired JSON identifies native UI/font/Sprite hooks; it also
  contains stale draws from previous panels. Treat that JSON as supporting
  instrumentation, not a complete clean-frame display list. Reconcile each
  entry with the image and instructions.
- `DarkCloudBrowser_Render 0x00594FC0` calls horizontal tiling `0x00415DE0`
  with `UI` singleton field `+0x1730` (`UI.30`), and vertical tiling
  `0x00415F00` with `+0x197C` (`UI.33`). These helpers repeat the source
  logical width/height; they are absent from the earlier Sprite-hook census.
  At 1600 by 900 the wall strips start at y=65 and y=800; filigree starts
  at x=-74 and x=1540, y=0. The top curtain is opaque through y=50 and
  fades out over the following 100 pixels (`0x00595753..0x00595812`).
- `UiPanel_Render 0x005C3F40` receives `(40,161,1520,651,0)` from the
  browser. Its `UI.10` horizontal rails are clipped to x=50..1550, with
  tops y=159 and y=797. `UI.79` vertical rails start at x=40 and x=1543,
  clipped to y=171..802. The four stone-corner centers are (77,198),
  (1523,198), (77,775), and (1523,775). The browser then tiles `UI.49`
  from (55,173), clips the leather to the inset (75,193,1450,587), shades
  its 85-pixel heading band at alpha 0.5, and invokes the shared `UI.17`
  nine-slice over (55,173,1490,627).
- `0x00417E30` draws whole tab brackets and stretches their last 5% column.
  The browser's resting pass translates down eight pixels and clips at y=187;
  it does not crop eight pixels from the source top. Correct source UVs are
  `(0,0,1,51/65)`. All consumers of the shared tab planner must use that rule.
  The native Dark Cloud text pens are y=173 selected / y=181 resting,
  heading y=50, account y=83 / y=101, and beta x=center+235, y=50.
- `MyQuickCPanel` vtable `0x0079C014`, background painter `0x005DB7A0`,
  paints an opaque black offset shadow using `+0x1F8`, including a black
  `UI.17` pass. The shadow is visible down/right of the foreground frame.
  `ControlPanel.3` supplies the beveled black rows, and `ControlPanel.5`
  the text-entry recess. These records and the stock bitmap faces already
  exist in the maintained UI kit.
- Foreground `0x005DBC30` expands the panel frame and places the side
  flourishes at the expanded edge centers plus/minus 45. `UI.18` has an
  86-pixel logical width with a 19-pixel trim; using its 67-pixel packed width
  as its logical size incorrectly moves the flourishes onto the frame.
- `UiUnlabeledControl_Render 0x005C6A50` and labeled sibling `0x005C65A0`
  clip the full `UI.103/.104` face at the control bounds, move pressed
  content by four pixels (`0x007DE8C8`), and keep the `UI.53` surround
  undimmed. Disabled content uses alpha 0.5 followed by a gray body overlay
  at alpha 0.25. The surround includes its stretched last-column connector.
- The reusable CPanel surface uses the existing `ControlPanel.3` six-pixel
  right/bottom bevel and `ControlPanel.5` three-pixel recess. Atlas inspection
  establishes these edge widths; the Website's variable-height content groups
  preserve those edges rather than stretching them with the group.

Measured reference/current mean RGB values establish a red-capable visual
oracle: top wall `[13.37,13.00,12.17]` / `[2.28,2.22,2.11]`; top chain
`[52.54,54.75,53.51]` / `[16.83,16.36,15.00]`; left chain
`[55.89,56.03,52.77]` / `[14.80,14.40,13.27]`; left filigree
`[34.53,31.81,25.03]` / `[2,2,2]`. Regions are respectively
`[260,95,140,50]`, `[270,160,160,13]`, `[40,285,15,135]`, and
`[5,275,30,145]`. A screenshot that only looks correct at the corners cannot
satisfy these checks.

### System boundary and membership

The work owns Dark Cloud presentation from title ingress through retained
catalog/selection, child dialogs, responsive projection, and teardown. Existing
API, subscription, party, comments, gallery, and layout-sharing behavior stays
with its current Website owners. The following are the implementation
dispositions; the validation receipt below records their actual proof.

| Member | Source | Disposition | Required proof |
| --- | --- | --- | --- |
| top/bottom wall and both filigree bands | `UI.30/.33`; `0x00595190..0x005952C3` | `exact-ported` | continuous native tiles and full-frame pixels |
| top curtain and outside-frame shading | `0x00595753..0x005958E3` | `exact-ported` | stock gradient extents and painter order |
| flourishes, four wizards, four side badges | `UI.29/.31/.32/.20` | `exact-ported` | native orientation and viewport-relative placement |
| both horizontal and vertical chains, four stone corners | `UI.10/.79/.107..110`; `0x005C3F40` | `exact-ported` | all four rails, native clip/centers |
| leather, header shade, complete gold frame | `UI.49/.17`; `0x005959CF..0x00595AEC` | `exact-ported` | continuous edges and textured center |
| selected/resting/disabled tabs and bitmap labels | `UI.13`; `0x00417E30` | `exact-ported` | whole rounded top, source UVs, selection rise |
| heading, beta, guest/named account | native heading/menu pens | `exact-ported` | authored baselines and guest link underline |
| Search/Sort/Options and primary footer states | `UI.101..104/.53/.54/.58/.66` | `exact-ported` | connected surround, pointer and keyboard press |
| Search/Sort/detail foreground, shadow, and flourishes | `MyQuickCPanel`, `UI.17/.18/.49` | `exact-ported` | one gold frame, black shadow, no overlapping corner duplicate |
| search input, clear/commit, sort choices | `ControlPanel.3/.5`, stock bitmap wrappers | `exact-ported` | keyboard and pointer actions through native control surfaces |
| mod/party rows and all inline actions | stock list text-selection plus Button family | `exact-ported` for presentation vocabulary | green selected text, native action art, preserved Website behavior |
| detail metadata, gallery, versions, subscription, comments | Website content in native panels/controls | `exact-ported` for presentation vocabulary | every fixed heading/action uses the kit; arbitrary content remains readable |
| loading, empty, download, refresh, retry/error states | bitmap status and native action vocabulary | `exact-ported` for presentation vocabulary | exercised state branches and no generic card skin |
| Layouts load/publish/code receipt | Website feature in native field/action vocabulary | `exact-ported` for presentation vocabulary | load, submit, copy, error, guest/auth states |
| developer party/match roster | Website data in the same list vocabulary | `exact-ported` for presentation vocabulary | native fixed labels and Observe action |
| account service, catalog data, subscriptions, parties, comments, shared layouts | existing Website domain | `out-of-system` for native data parity | preserve current endpoints and behavior |
| portrait/landscape/touch projection | browser viewport and input constraints | `exact-ported` for presentation vocabulary | zero overflow, scrolling, 44-pixel visible actions |
| skull and Esc/Settings lifecycle | stage-owned skull and existing SimpleMenu | `verified-already-at-parity` | retained scene on return and shared control ownership |

Website mods, arbitrary Unicode prose, and shared mobile layouts have no retail
data counterpart. Their arrangement is a Website extension; their chrome must
use the recovered vocabulary. No unsupported-glyph substitution or invented
native content is an acceptable way to make the screenshot match.

### Implementation and validation plan

Keep native painter plans and semantic control surfaces inside `native-ui`.
The Dark Cloud files retain data/state. Separate the tab planner from
`native-ui-plan.ts` and update every caller; remove the superseded definitions.
Replace the 1,942-line stylesheet with cohesive scene, content, and dialog
styles, each including the responsive rules it owns. Remove the one-use panel
forwarder, dead asset URL, CSS frame substitutes, duplicate gold corner pass,
gradient action skins, and repetitive explanatory copy.

Use the established pure native-plan and browser seams. First demonstrate the
missing surfaces with the screenshot oracle, then validate all tabs, children,
action states, and desktop/portrait/landscape layouts on the exact Mac tree.
Run the canonical Website gate and available quality analyzers there. Record
unavailable measurements explicitly; do not manufacture proxy scores.

### Implementation validation receipt

Implemented in the focused Website worktree on base
`f9d736bf03e3d917ce1cf31dd3778a4423b40f94`. All execution below used the
Mac mini acceptance worktree and pinned Node/.NET toolchain; the primary
Website and Mod Loader checkouts were preserved.

- The scene owns catalog, selection, and API actions. Rows, child dialogs,
  gallery, comments, footer, and layout sharing have cohesive UI owners.
  Native painters, control state, layout measurement, and modality belong to
  the reusable kit. The 1,942-line CSS monolith is split into scene, content,
  and dialog styles. The obsolete panel forwarder and fake record inventory
  are removed, and all tab-planner callers use the canonical module.
- The four pure drawing modules have 100% Istanbul statements, branches,
  functions, and lines through the established Node tests. Their maximum
  method CRAP scores are 1 (frame), 9 (tools), 4 (CPanel), and 13 (tabs).
  This measurement does not cover React event handlers or browser lifecycle.
- Source metrics measured 22 materially changed production files / 212
  implementation units: maximum cyclomatic complexity 18, cognitive complexity
  20, Halstead difficulty 62.47, and no explicit `any` or `unknown` types.
  Every changed production file is below 1,000 handwritten lines, including
  the retained 903-line plan module after extraction. Scoped jscpd analysis
  over 27 changed production TS/TSX files found zero duplicated blocks.
- The native UI workbench passed all atlas pages and the DOM button, tab,
  Settings, and BoastMenu journeys with empty page/console/failed-response
  arrays. This checks the shared tab and button consumers as well as Dark Cloud.
- Production `build` passed TypeScript, Vite/game-host output, and the game
  bundle budget. `smoke:game:dark-cloud-presentation` passed 1600 by 900,
  DPR-2 390 by 844, 844 by 390, and 320 by 640 scenarios. Its controlled
  fixtures cover Unicode search/clear, selected Sort focus on open/reopen,
  controller bumper/d-pad/Back, Space press art, modal focus containment and
  restoration, gallery navigation, comments, subscription toggles, developer
  roster presentation, and guest/authenticated layout load/publish/copy UI.
  Each scenario has zero layout problems and unexpected browser errors;
  each intentionally returns one 503 before the Parties Retry regression.
- `smoke:game:dark-cloud` passed against the built frontend and task-owned
  Development API/database. Registration, comments, subscription mutations,
  layout publication and guest load use real endpoints. Party directory data
  remains an explicit browser fixture; this is not a live multiplayer receipt.
  Page errors, console errors, failed responses, and unsupported bitmap labels
  were empty. Seed content has no downloadable game assets (`cachedGameContent`
  is zero), so cold mod-content download UI is not live-proven by this journey.
- Built desktop geometry is list `[55,173,1490,627]`, tabs `[460,128,882,69]`,
  selected/rest brackets `[460,128,34,65]` / `[630,136,34,51]`, Search
  `[390,818,90,52]`, Sort `[495,818,90,52]`, primary
  `[623.5,809.5,353,69]`, and Options `[1017.5,818,185,52]`. All recovered
  record families and their connected slices are present. Stock-region
  brightness means are now 13.62 / 54.24 / 54.89 / 30.75 versus reference
  12.85 / 53.60 / 54.89 / 30.46; the original web values were
  2.20 / 16.06 / 14.16 / 2.00.
- Built portrait and landscape lists are `[12,140,366,629]` and
  `[12,94,820,234]`, with zero settled horizontal overflow and a minimum
  44-pixel visible action height. Phone gallery controls remain below the
  image. Native bitmap fixed text and arbitrary Unicode content both remain
  readable. The phone beta badge is hidden through its owning element so
  inline bitmap layout styles cannot override the responsive rule.

The canonical `/opt/homebrew/bin/bash ./scripts/validate.sh` run passed backend
build/format, 20 Python contracts/integration tests, 2,902 Node tests, frontend
lint, the production build/media checks, and renderer complexity, coverage,
CRAP, dead-code, and duplication checks. It exited **1** solely on renderer
mutation: 279 killed, 29 survived, one timeout, and 121 compile errors out of
430 generated mutants. The 29 surviving diagnostic-label mutations are the
existing baseline documented in entry 287 and `docs/renderer-quality.md`;
this task does not claim a green canonical gate. After the final UI changes,
frontend lint, all 118 native-UI/related tests, TypeScript/build, and both built
Dark Cloud journeys passed again.

The initial Stryker run over the four pure UI modules generated 418 mutants:
157 killed, 63 survived, and 198 compile errors (no timeout). Meaningful
regressions were added for the tab routes/visible labels, missing selection
in a nonempty tab set, scaled label/edge positions, right-bracket mirroring,
and solid dialog-shadow bounds. The redundant `state ?? 'idle'` expression
was removed because absent state already yields the idle drawing conditions.
All 62 surviving locations still present in the source were rechecked with
Stryker ranges (64 generated mutants, including two nested locations). The
recheck killed 31 and left **33 diagnostic-label string mutations**: eight in
tools, 24 in frames, one in CPanel, and zero in tabs. No geometry or visible
label survivor remains in that recheck. This is a targeted recheck, not a
fresh whole-scope mutation score, and the zero-survivor gate remains unmet.

Knip's full production graph reports six files in the changed scope: the
development workbench entry, existing controller test-seam exports/types,
public React kit exports/types, and existing plan/party-menu test-seam types.
Unused row exports and the unused tab constant export were removed. The
remaining public and test entrypoints have actual workbench/test consumers,
which the production-only graph does not include; raw Knip findings were not
suppressed or presented as a zero-finding UI gate. Full React event/lifecycle
statement/branch coverage, UI-wide CRAP, and mutation coverage remain
unmeasured by the configured renderer-only collection. No quality exclusions,
ignore comments, artificial label assertions, or analyzer dependencies were
added to change those results.
This is an implementation and local acceptance receipt; no commit, push,
deployment, or production restart was requested or performed.


### Responsive and interaction closure

- The 60-pixel outer shadow belonged to the viewport-clipped scene pass. Putting
  it inside the list created a five-pixel scrollable overflow at 1600 by 900.
  Moving the same shadow to its owning scene clip restored the native bounds.
- Transformed fixed-width controls retained oversized layout boxes on phones.
  The kit now uses actual layout dimensions for buttons and tabs, uniform art
  scales, and full 44-pixel targets. The account action retains its 50-pixel
  target while its bitmap text scales. Scaled frame extents determine the
  12-pixel phone margin.
- Tablet columns now remove the version track with its label and value. Party
  columns preserve all membership/status/location fields, and their Refresh
  action occupies the action column. Modded/private/Cheats notices stay visible
  on phones.
- The gallery's automatic aspect-ratio width transferred its minimum height
  into an unwanted minimum width on 320-pixel screens. An explicit available
  width preserves the image area. Gallery navigation is below the image so its
  buttons cannot cover content. Stone Done buttons fit the available width.
- On small phones the two-column layout receipt allowed its bitmap share code
  to extend under Copy. One column keeps the code, author, and action separate;
  a production browser assertion checks their painted bounds for overlap.
- A pre-existing Retry wiring defect reloaded mods when the Parties directory
  failed. A controlled 503 reproduced the failure within two seconds; the
  shared refresh action now retries the active directory and updates its real
  loading state.
- Search and Sort use native dialog cancellation for controller Back as well
  as Escape. The old controller path required a declared back button, so B did
  nothing on these action-complete sheets. The real controller journey now
  closes them and preserves selection/focus.
- React attempted autofocus before the native dialog was visible. Chrome
  initially focused a transient scroll container, then lost focus when that
  container resized. Applying the existing default-focus target after
  `showModal()` restores the selected sort choice and the first controller
  navigation step. The production journey verifies open and reopen behavior.
- Mobile acceptance enters through the existing landscape title gate and then
  rotates inside Dark Cloud, where portrait is supported. No startup gate was
  removed to make the test pass.

### Copy cleanup

| Location | Before | After |
| --- | --- | --- |
| Layouts introduction | Load a shared mobile layout on any device. A Website account is required only to submit one. | Omitted; the two labeled actions carry the flow. |
| Layout load note | Loading replaces the mobile layout saved in this browser. No account is needed. | Replaces the layout saved on this device. |
| Layout publish introduction | Publish the mobile layout currently saved in Settings and receive an immutable share code. | Omitted. |
| Guest publish note | Sign in to submit. You can still load any shared code. | Sign in to submit. |
| Uncustomized layout note | Customize and save a mobile layout in Game Settings first. | Save a layout in Game Settings first. |
| Published-code note | Submitting creates a new code and does not change older shared layouts. | Each submission creates a new share code. |
| Layout footer | SHARE A CODE. LOAD IT ANYWHERE. | Omitted. |
| Comment placeholder | Share a useful note about this mod… | Write a comment... |
| Empty subscriptions | YOU HAVE NOT SUBSCRIBED TO ANY MODS. | NO SUBSCRIBED MODS. |
| Guest subscriptions | SIGN IN TO SEE SUBSCRIBED MODS. | SIGN IN TO SEE YOUR MODS. |
| Empty parties | NO PUBLIC PARTIES ARE FORMING RIGHT NOW. | NO PUBLIC PARTIES. |
| Download status | DOWNLOADING plus the internal mod ID | DOWNLOADING MOD CONTENT |
| Developer matches heading | ACTIVE MATCHES · ALL VISIBILITIES | ACTIVE MATCHES |
| Empty developer rosters | NO WIZARDS ARE CONNECTED RIGHT NOW. / NO BONEYARD MATCHES ARE ACTIVE. | NO CONNECTED WIZARDS. / NO ACTIVE MATCHES. |
| Fixed waiting/sort labels | Unicode ellipsis | Three supported ASCII periods. |
| Party mod notice | MODDED · count | MODDED (count) |
| Name/tag/progress separators | Middle dot | Supported comma punctuation. |
| Absent changelog | No changelog supplied. | No invented replacement text. |

Arbitrary descriptions, changelogs, comments, and names are preserved.
