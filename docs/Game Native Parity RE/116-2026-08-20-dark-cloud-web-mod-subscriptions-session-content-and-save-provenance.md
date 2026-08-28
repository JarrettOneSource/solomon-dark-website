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
