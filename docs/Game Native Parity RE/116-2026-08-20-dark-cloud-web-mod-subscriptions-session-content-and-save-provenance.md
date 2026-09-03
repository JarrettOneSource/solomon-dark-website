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
