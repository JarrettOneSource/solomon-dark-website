# 2026-08-21 — Dark Cloud responsive catalog and public-party directory reopening

> **2026-08-21 product reopening.** The first web-mod cutover correctly closed
> native ownership and session-content authority, but retained the stock
> `1600 x 900` presentation box and then added Website product copy and lanes on
> top of it. The resulting shell is not the requested web catalog: it says
> `WEB`, adds `HOW DARK ARE YOU TODAY?`, separates Boneyards from mods, hides
> subscription removal behind Options, uses double-click to mutate activation,
> has no mod media/details/comments, and collapses to a `390 x 219.375` strip in
> a `390 x 844` portrait viewport. This pass reopens the complete Dark Cloud
> browser presentation boundary while preserving the already-accepted content,
> save, Lua, Boneyard, and shared-Hub authority beneath it.

## Reported smell and parity question

- Reported web behavior: the Dark Cloud shell is undersized and awkward,
  carries unwanted `WEB` and novelty account copy, has inward-facing corner
  legs, exposes Recent / Mods / Boneyards / Multiplayer instead of the requested
  catalog model, lacks row media and a real mod viewer, and is unusably small on
  portrait mobile.
- Requested behavior: a full-viewport responsive browser whose default Mods
  lane lists every mod newest-first; Subscribed Mods owns direct enable/disable
  and unsubscribe actions; Boneyards remain ordinary mods; Parties lists only
  safe public multi-member parties; rows show a thumbnail or `NO IMAGE`; and
  explicit View or double-click opens a gallery/details/version/comments
  surface without leaving the game.
- Reproduction inputs/scenes: authenticated and guest Title -> Explore; Mods,
  Subscribed Mods, and Parties with empty/nonempty/error results; media-present,
  media-absent, and media-load-failure rows; one/many screenshot details; comment
  add/delete; subscription enable/disable/unsubscribe; desktop, narrow landscape,
  and portrait mobile viewports.
- Falsifiable questions: any separate Boneyards lane, default lane other than
  Mods, order other than newest-first, double-click that mutates a subscription,
  missing media fallback, inaccessible details/comments, nested interactive
  controls, a private/internal singleton party in the directory, fixed-stage
  scaling on mobile, incorrect corner legs, clipped controls, or browser errors
  disproves completion.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Clean stock and instructions | Retail `SolomonDark.exe`, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; existing Mod Loader `native-menus-and-boot.md`; `DarkCloud` constructor `0x0058F0C0`, init/tick `0x0058F320` / `0x00592E40`, render `0x00594FC0`, dispatch `0x005A5530`, vtable `0x00797C44` | The native owner remains one retained full-screen content browser with an account band, list selection, search/sort/options children, and modal return. Its visible title is `THE DARK CLOUD`; neither `WEB` nor `HOW DARK ARE YOU TODAY?` belongs to the recovered native membership. | high |
| Native sibling and asset census | Prior complete census at the same retail build; `DarkCloudSwipebox` `0x0079794C`, `DarkAccountPanel` `0x00797A1C`, download/upload/unshare/rating and account watcher vtables; four committed `border-corner-*.png` crops | No new native sibling or table was discovered. Pixel and browser-canvas alpha inspection prove the file mounted at top-left has its vertical leg on the right and the file mounted at top-right has its leg on the left; only the top pair is assigned to the wrong frame sides. The bottom-left crop already has its vertical leg on the left and bottom-right already has its leg on the right. | high |
| Current web causal trace | Website `1361f097cf9ff2676e5c01c7b822f44b52a1220a`; `MainMenuScene.tsx`, `DarkCloudScene.tsx`, `dark-cloud.css`, `api.ts`, `ModEndpoints.cs`, `game-session-supervisor.ts`, `game-host.ts` | `MainMenuScene` gives Dark Cloud the same fixed native-stage transform as gameplay. The scene separately fetches recent and Boneyard lists, defaults authenticated users to subscriptions and guests to Boneyards, treats Multiplayer as one Shared Hub pseudo-row, and calls the subscription action on double-click. | high |
| Browser baseline | Headless Chrome on Linux from the exact clean worktree; `/tmp/dark-cloud-baseline-desktop.png` and `/tmp/dark-cloud-baseline-mobile.png` | At `1600 x 900`, scene/frame are `1600 x 900` and `[55,175,1490,620]`, title is `THE DARK CLOUD WEB`, and four old tabs render. At `390 x 844`, the transformed scene is `[0,312.3125,390,219.375]`; the full browser occupies only 26% of viewport height. | high |
| Website data ownership | `ModEndpoints.cs` list/detail/comment/screenshot endpoints and `api.ts`; shared-Hub `PartySystemState`, `SharedGameWorldsState`, `GameHost`, supervisor, provisioner | Mod summaries already expose first-screenshot `thumbnailUrl`; details expose ordered screenshots, description, versions, tags, author, counts, and comments. Shared-Hub parties are authoritative server state. Internal singleton parties are implementation membership, not public group listings; a safe directory can project only multi-member parties without restoring launcher lobbies or join URLs. | high |

The existing read-only Ghidra evidence uses preferred image base `0x00400000`.
No injected process, ASLR address, or new reusable native fact is used in this
reopening, so no Mod Loader report or catalog changes ownership in this pass.

## System boundary and membership inventory

Native system: **Dark Cloud account/content browser presentation**, reopened to
include the complete Website catalog projection and its responsive browser
lifecycle. Package materialization, save provenance, Lua execution, and
Boneyard runtime behavior remain downstream siblings already closed by the
2026-08-20 entry.

| Member (class/variant/scene/branch) | Native or web source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Title Explore ingress, retained owner, and Menu return | `DarkCloud` `0x0058F0C0` / `0x00797C44` | `verified-already-at-parity` | One retained scene opens and returns without duplicating title/runtime ownership. |
| Visible `THE DARK CLOUD` title | `0x00594FC0` and captured layouts | `exact-ported` | `WEB` is absent from rendered/source title membership. |
| Named and guest account band | account branches in `0x00594FC0` | `exact-ported` | Named identity or actionable guest sign-in renders; invented novelty tagline is absent. |
| `DarkCloudSwipebox` selection/search/sort | vtable `0x0079794C`, render `0x005946E0` | `exact-ported` lifecycle with Website data | Search/sort children suspend and return; selection never performs an unrelated mutation. |
| Mods default lane | Website public mod catalog | `out-of-system` (Website product taxonomy) | First render selects Mods and requests every mod newest-first; Boneyard-tagged packages remain in the same list. |
| Subscribed Mods lane | Website `ModSubscription` | `out-of-system` (Website account extension) | Only the current account's subscriptions render with direct enabled toggle and unsubscribe actions. |
| Separate Boneyards lane | former native Online Levels adaptation | `out-of-system` (retired by requested taxonomy) | No tab/type/list fetch preserves Boneyards as a separate product class. |
| Parties lane and directory | shared-Hub party owner | `out-of-system` (Website social extension) | Only safe public multi-member summaries are projected; internal singletons, invitations, credentials, manifests, private sessions, and join URLs are absent. Entry still uses the shared Hub. |
| Thumbnail-present row | first ordered Website screenshot | `out-of-system` (Website media extension) | Correct mod image is visible and cropped without distortion. |
| Thumbnail-absent/failed row | null/failed Website screenshot | `out-of-system` (Website media extension) | Stable `NO IMAGE` placeholder replaces broken-image chrome. |
| Explicit View and double-click | Website catalog interaction | `out-of-system` (Website detail extension) | Both open the same selected mod detail; neither subscribes, toggles, or launches. |
| Detail gallery and zero/one/many-image branches | Website ordered screenshots | `out-of-system` (Website media extension) | Placeholder, image, arrows, position, and thumbnail strip remain bounded and keyboard/touch usable. |
| Detail metadata/description/tags/version history | Website mod detail endpoint | `out-of-system` (Website catalog extension) | Author, summary, description, latest version, downloads, dates, tags, and versions use server truth. |
| Detail comments guest/authenticated/owner branches | Website comment endpoints | `out-of-system` (Website community extension) | Read, add, bounded body, reload, and authorized delete paths render with loading/empty/error states. |
| Subscribe/enable/disable/unsubscribe | `ModSubscription` endpoints | `out-of-system` (Website account extension) | Actions update server state once, expose busy/error state, refresh catalog membership, and do not alter an already-admitted session. |
| `DarkCloudDownload` | vtable `0x00797CFC` | `verified-already-at-parity` as Website subscription/admission | Subscription remains account-owned and future-admission-only. |
| `DarkCloudUpload` and `DarkCloudUnshare` | vtables `0x0079857C`, `0x00797FFC` | `out-of-system` (Library-owned publishing) | No inert duplicate upload/delete controls enter the game browser. |
| `DarkCloudRating` | vtable `0x00797DBC` | `out-of-system` (no Website rating domain) | No fabricated rating control or value renders. |
| `DarkAccountPanel`, login/create watchers | vtables `0x00797A1C`, `0x00797E74`, `0x00797F44` | `out-of-system` (Website authentication) | Guest action routes to Website sign-in; retired Raptisoft credentials remain absent. |
| Search/sort modal interruption and close | native `MyQuickCPanel` family | `exact-ported` lifecycle | Overlay owns focus/input and returns to the retained list. |
| Desktop/wide full-viewport composition | browser viewport | `out-of-system` (responsive Website presentation) | Scene consumes the available viewport rather than the gameplay fixed-stage transform; list/details use remaining height without ornamental dead space. |
| Narrow landscape and portrait mobile composition | browser viewport, safe-area insets | `out-of-system` (responsive Website presentation) | Tabs, rows, actions, detail gallery/comments, and close/menu controls reflow with 44px touch targets and no page overflow. |
| Four border-corner assets | committed retail-derived crops | `exact-ported` | The top pair is swapped to the side matching its outer vertical leg; the already-correct bottom pair retains its original sides. |
| Loading, empty, partial-error, and retry branches | Website requests | `out-of-system` (network platform lifecycle) | One failed directory does not erase successful catalog data; each lane names its own recoverable state. |
| Package content, save mod provenance, Lua/Boneyard materialization | preceding 2026-08-20 inventory | `verified-already-at-parity` | This presentation pass changes no authoritative manifest, VM, save, or run ownership. |
| Native `images/` and arbitrary `data/` overlays | preceding platform inventory | `blocked-by-platform` (immutable browser bundle and typed host state) | Existing publish-time rejection remains; predicted difference is unchanged from the preceding receipt. |

## Native and web ownership thread

- Construction/entry: title dispatch retains one `DarkCloudScene`. The Website
  scene owns only catalog selection, detail/modals, requests, and account
  actions; it does not own admitted content or live runtime state.
- Producers: `GET /api/mods?sort=newest`, account subscription endpoints,
  mod detail/comments endpoints, and the read-only public party endpoint write
  independent lane models. The party endpoint is projected from the
  authoritative shared-Hub host through the authenticated supervisor control
  plane and Website backend.
- Transitions: entry -> Mods; tab selection changes one list; row selection ->
  View/double-click detail; carousel/comment/subscription actions retain detail;
  close returns to the same selected row; Menu returns to title; Enter Hub uses
  the existing single-use admission path.
- Downstream: summary/media data paints rows; detail truth paints the overlay;
  subscription mutations affect only future admission resolution. Party rows
  are discovery summaries, not new join or authority paths.
- Teardown: in-flight fetch results are ignored after scene/detail unmount;
  modal focus and document input return to the scene; no timer, observer, or
  request-owned busy state survives close.

## Recovered and requested behavioral contract

- The native title/account/list/modal ownership is preserved, but exact stock
  rectangles are not a mobile contract. Dark Cloud alone leaves the fixed
  native-stage transform; title, Create, Hub, and Boneyard stage ownership do
  not change.
- Mods is selected unconditionally on entry. Its server order is `newest`, with
  a deterministic client tie-break only where presentation filtering needs it.
- Boneyard is a mod tag/content member, never a navigation class.
- A row's primary hit target selects it; View and double-click open detail.
  Subscription controls are distinct accessible actions and stop propagation.
- `thumbnailUrl === null` or an image error produces the same placeholder.
  Detail carousel order is the server's `sortOrder` order.
- The public party directory is a read-only safe projection of parties with at
  least two members. It exposes party id, leader/member display names, member
  count/capacity, Hub/playing status, and current Boneyard name when playing.
  It exposes no singleton internals, invitations, credentials, account ids,
  content hashes, or direct-join capability.
- Responsive acceptance is behavior, not a screenshot: available scene bounds
  equal the viewport; list/detail scrolling is internal; controls remain
  visible, focusable, and at least 44 CSS px on coarse/mobile layouts.

## Web implementation consequence

- `DarkCloudScene` becomes the catalog controller; a cohesive detail component
  owns detail/comment/gallery state; a shared media component owns image
  fallback. Nested buttons are prohibited.
- A pure host-side directory projector owns safe public party shape. `GameHost`
  exposes that projection to one bearer-protected supervisor endpoint;
  `GameSessionProvisioner` proxies it to public `GET /api/game/parties` without
  exposing the supervisor secret.
- `MainMenuScene` stops applying `nativeStageStyle` to Dark Cloud only. CSS owns
  the real viewport, safe areas, responsive grids, list/detail scroll, and
  ornament suppression where space is scarce.
- Obsolete four-lane, fixed-geometry, Boneyard-fetch, shared-Hub pseudo-row,
  Options-only subscription, and double-click mutation paths are removed rather
  than retained as compatibility code.

## Validation contract

- Focused automation: public-party projector and supervisor endpoint; backend
  unavailable/success schema; Mods default/newest request; exact three-lane
  membership; no Boneyards/Multiplayer/novelty copy; media fallback; detail
  membership; direct subscription actions; corner assignment; fixed-transform
  absence; desktop/mobile CSS contracts.
- Browser journeys: desktop, narrow landscape, and portrait mobile; media and
  placeholder rows; explicit View and double-click; zero/many-image carousel;
  detail metadata/versions/comments; add/delete comment; subscribe,
  enable/disable, unsubscribe; public party and empty directory; modal close and
  Menu return. Capture page, console, failed-request, and overflow evidence.
- Full gate: unchanged `./scripts/validate.sh` from the exact implementation
  tree, then Windows browser acceptance and the requested separate Mac mini
  browser surface.
- Acceptance: every inventory row above has its proof, no required responsive
  or data branch is missing, and residual source/UI/diff sweeps find no old
  taxonomy or fixed-stage behavior.

## Implementation validation receipt

- Implementation: `DarkCloudScene` now owns an all-page newest-first mod
  catalog, Subscribed Mods activation/removal, the public-party lane, independent
  partial request failures, search/sort, retained selection, and detail entry.
  `DarkCloudMedia` owns valid/null/failed image presentation.
  `DarkCloudModDetail` owns the ordered carousel, metadata, tags, description,
  version history, comment read/add/delete, subscription actions, modal
  keyboard/backdrop lifecycle, and bounded internal scroll. Dark Cloud alone no
  longer receives `nativeStageStyle`; the title, Create, Hub, and Boneyard
  stages remain unchanged.
- Party authority: `public-party-directory.ts` projects only complete
  multi-member parties and never falls back to internal player ids. `GameHost`
  owns the projection; bearer-protected supervisor `GET /admin/hub/parties`,
  `GameSessionProvisioner`, and public no-store `GET /api/game/parties` carry
  only id, display names, count/capacity, Hub/playing status, and optional
  Boneyard name. Tests prove singletons, invitations, credentials, content
  manifests, and direct-join data are absent.
- Corner evidence: browser-canvas alpha sums are top-left `384480/0`, top-right
  `0/391605`, bottom-left `385403/0`, and bottom-right `0/375384` for the
  outer-leg halves. This falsified the initial assumption that both pairs were
  reversed: only the top pair changed; the bottom pair retains its original
  assignment.
- Focused automation: public-party projection `2/2`, combined party contracts
  `19/19`, Dark Cloud presentation plus supervisor changed-owner checks `14/14`,
  backend mod/session/public-party integration `8/8`, formatter/lint and import
  boundaries, production build, and the bundle budget passed. The one broad
  local Lua p99 failure under parallel saturation passed immediately in its
  isolated six-test owner and passed in the canonical Mac gate.
- Canonical Mac gate: Apple arm64 host, Node `22.17.0`, npm `10.9.2`, .NET SDK
  `10.0.302`; unchanged `./scripts/validate.sh` exited `0`. It passed 14 Website
  contracts, frontend groups `2 + 41 + 218 + 1241 + 19 + 10 + 7 + 17 + 15`, 5
  desktop tests, backend/frontend formatting and lint, production build, game
  bundle budget, and production media policy.
- Windows Chrome `151.0.7922.170` real-backend journey: registered a fresh
  account, opened default Mods, proved the removed copy/lanes, thumbnail
  placeholder, explicit/double-click detail, description/version/comments,
  comment add/delete, direct disable/enable/unsubscribe, and the bounded party
  row. Desktop `1600 x 900`, portrait `390 x 844`, and landscape `844 x 390`
  each equaled the full stage, had zero horizontal overflow and 44 px minimum
  targets, and produced empty page/console/failed-response arrays. Receipts are
  `C:/codex-validation/receipts/dark-cloud-{desktop,detail,mobile,landscape}-*.png`.
- Mac Chrome `151.0.7922.170` repeated the same real-backend journey and exact
  geometry/corner assertions on the detached candidate, with empty
  page/console/failed-response arrays. Receipts are
  `/tmp/dark-cloud-mac-{desktop,detail,mobile,landscape}-*.png`; portrait and
  detail copies were independently inspected after transfer.
- Media-branch browser proof additionally supplied newest-order, valid image,
  null image, decode-failure fallback, and three-image carousel fixtures. It
  observed order `newest-mod`, `failed-image`, `valid-image`, changed the active
  carousel source, rendered all three selectors, kept the portrait title clear
  of fullscreen chrome, and reported zero page/console errors.
- Remaining platform difference: only the preceding immutable-bundle and typed
  host-state limits on arbitrary native `images/` / `data/` overlays remain;
  this pass introduces no new `blocked-by-platform` member. The implementation
  is committed locally for exact-tree validation but is not pushed, deployed,
  or live-verified in production.
