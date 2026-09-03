# 2026-08-21 — Dark Cloud mobile composition and native-dialog mod viewer

> **2026-09-02 stock-composition correction.** Entry 116's complete visual
> reopening supersedes this pass's crop-owned painter model. The maintained
> scene now consumes the generated native UI atlas directly. The sixteen
> one-off chrome crops named below were removed after their source/tool consumer
> count reached zero; only the exact repeatable `leather.png` and
> `stone-wall.png` surfaces remain. Clean captures also prove Search and Sort
> close from their committing actions and have no green Done footer; the Done
> member belongs to account/settings-style and Website detail dialogs.

> **2026-08-21 mobile presentation pass.** The responsive reopening above gave
> the Dark Cloud a full-viewport shell, but on phones it still read as a
> shrunken desktop screen: per-row action strips squeezed under 44px, the tab
> strip and footer competed for the short axis, the landscape frame corners
> collided with the column header, and the `View mod` surface was a custom
> Website card dialog that shared nothing with the native `MyQuickCPanel`
> dialog family the rest of the screen reproduces. This pass recomposes the
> same screen for touch viewports and rebuilds the viewer on the native dialog
> vocabulary while changing no catalog, subscription, party, save, Lua, or Hub
> authority.

## Reported smell and parity question

- Reported web behavior: the Dark Cloud "looks and works poorly on mobile",
  and the `View mod` overlay is "completely custom, not based in native at
  all".
- Requested behavior: a phone-usable Dark Cloud that still reads as the native
  screen (framed leather list panel, gold filigree corners, crest Menu,
  bracketed Search/Sort plates, green stone DONE), and a mod viewer built from
  the same native dialog chrome as the native Options/Search/Sort panels.
- Reproduction inputs/scenes: Title -> Explore on `1600 x 900`, `768 x 1024`
  coarse-pointer tablet, `390 x 844` portrait phone, `844 x 390` landscape
  phone, and `320 x 568` small phone; Mods / Subscribed Mods / Parties lanes;
  row selection; View; detail scroll/close; Menu; Search entry and result; Sort.
- Falsifiable questions: any visible tab/footer/row-action control under
  `44 px` on a touch viewport, horizontal overflow, a scene that does not
  equal the viewport, frame art overlapping list content, a viewer that is not
  composed from the native dialog members (framed panel, header band, inset
  label/field boxes, full-width inset buttons, stone DONE), or any browser
  error disproves completion.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Native Dark Cloud screen ownership | Retail `SolomonDark.exe`, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; `DarkCloud` constructor `0x0058F0C0`, render `0x00594FC0`, vtable `0x00797C44`; `DarkCloudSwipebox` `0x0079794C`; `DarkAccountPanel` `0x00797A1C` (preferred image base `0x00400000`, read-only reuse of the 2026-08-21 reopening facts) | No new native fact is required: the screen, swipebox, search/sort dialog, and account band members were already inventoried; this pass changes only browser composition. | High |
| Native reference captures | `.codex-windows-validation/loader-audio-census-20260816/webgame-contracts/baseline-snapshots/menu-reference-captures/dark-cloud-browser.png` SHA-256 `dab6858709ffdc3fb1b094421a68d771cf5b349b5aa1ad6ebf435adc04f07505`; `dark-cloud-menu.png` `39cca3bdc8e3605baed11b13263fb91cf7bdece6d677e29e0e2b269b32fff901`; `dark-cloud-options.png` `3f82930deeeb4a65d46769be047287f867f985240be7ebbf41f4e5d021d6ad02`; `dark-cloud-search.png` `4663dc34eaea414012f218f60a703ac7c5305fa805bf93e411a15a0692decfef`; `dark-cloud-sort.png` `2b2f9687da097118863d0630a19ce7e54b4cd324e00b1d78dc7f924dfe746180` (all `1600 x 900`; `online-levels` duplicates `browser`) | The native dialog family is one framed leather panel with a thin outer and thicker inner gold line, filigree corners, side flourishes, a gradient header band, dark inset boxes carrying label/field rows separated by dividers, and full-width inset actions. Account/settings-style panels add a green stone Done; Search and Sort do not. The list screen uses a skull-vine crest Menu and bracketed Search/Sort icon plates. | High |
| Historical retail-derived crops | Former `frontend/src/assets/game/dark-cloud/` one-off chrome crops | This 2026-08-21 implementation painted from individual crops. Superseded 2026-09-02: the maintained semantic UI kit now paints their exact atlas records, and the zero-consumer duplicate files are deleted. `leather.png` and `stone-wall.png` remain as exact repeatable surfaces. | High |
| Current web causal trace | Website `dd78b726` (`origin/main`); `DarkCloudScene.tsx`, `DarkCloudModDetail.tsx`, `dark-cloud.css`, `main-menu.css`, `frontend/tools/smoke-dark-cloud.mjs` | Row action strips rendered on every row at phone widths and measured below `44 px`; the viewer was a bespoke card with its own palette; the landscape (`max-height: 620px`) frame kept desktop corner art over the column header; the smoke tool's touch audit reads each button's own computed `display`, so a strip hidden only at the container level is still counted as a `0 px` target. | High |
| Browser baselines (Chrome) | Headless Chrome `150.0.7871.124` on Linux from the worktree dev server, same mocked catalog in every run; before/after captures in the session scratchpad (`shots/before`, `shots/after`, `shots/after2`) | Before: portrait rows carried always-visible action strips with sub-44px targets and the custom viewer. After: see the receipt below. | High |
| Browser baseline (WebKit) | Safari `26.4` on the macOS `26.4.1` Mac mini through `safaridriver`, served as `http://localhost:5191` over an SSH reverse tunnel | Safari `26.4` (WebKit `605.1.15`) reproduces the Chrome composition: `390 x 844` list `376 x 653`, rows `134/82 px`; `844 x 390` list `820 x 236`, rows `62 px`; `336 x 568` (Safari's minimum window width stands in for `320`) list `322 x 424`, rows `118/68 px`; horizontal overflow `0`, minimum touch target `44 px`, viewer `390 x 844` with `907 px` internal scroll and `844 x 390` with `1252 px`; no page errors in any state. The Mac mini has no display, so the automation page is `document.hidden`: rAF and CSS animations/transitions are frozen, the WebGL title canvas stays black, and the title fade never fires `animationend`. The harness injected `transition: none`, synthesized the fade's `animationend`, and waited for loaded states; the Dark Cloud itself is DOM/CSS only, so its static rendering is unaffected. | High for static composition; Medium for WebKit transition states (not observable headless) |

## System boundary and membership inventory

Native system: **Dark Cloud browser presentation**, reopened only for touch
composition and for the mod viewer's dialog chrome. Catalog, subscription,
party, media, comment, save, Lua, Boneyard, and shared-Hub ownership stay with
the 2026-08-20 and 2026-08-21 entries above.

| Member (class/variant/scene/branch) | Native or web source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Framed leather list panel with gold double line and filigree corners | `0x00594FC0` layout; `dark-cloud-browser.png`; atlas `UI.107..110` and `UI.17` | `exact-ported` at every viewport | Panel art never overlaps the column header or rows; corners shrink with the frame on short viewports. |
| `THE DARK CLOUD` heading with wizard flankers | `dark-cloud-browser.png`; atlas `UI.31/.32` | `exact-ported`; flankers yield on narrow widths | Heading text stays visible at `320 px`; wizards return above `700 px`. |
| Tab strip (Mods / Subscribed Mods / Parties) | `DarkCloudSwipebox` lane selection | `exact-ported` lifecycle; touch sizing is `out-of-system` | Each visible tab is at least `44 px` tall on coarse-pointer viewports. |
| Catalog row (thumbnail, name, author, meta) | Website catalog projection | `out-of-system` (responsive Website presentation) | Rows reflow to a two-line phone layout without horizontal overflow. |
| Row action strip (View / Subscribe / Enable / Unsubscribe) | Website catalog interaction | `out-of-system`; select-to-reveal on `<= 700 px` | Only the selected row exposes actions on phones; hidden strips set `display: none` on the buttons themselves so touch audits see no `0 px` targets. |
| List status band | Website lane lifecycle | `out-of-system` | Loading/empty/error copy renders inside the frame without displacing rows. |
| Menu crest and menu panel | `dark-cloud-menu.png`; `flourish.png`, `skull.png` | `exact-ported` — **refuted 2026-08-22** by "Dark Cloud Esc menu on the native SimpleMenu": the native crest raises the `SimpleMenu` owner surface with `RESUME / GAME SETTINGS / SIGN OUT / MAIN MENU`, and `flourish.png` had no native counterpart | Superseded by the 2026-08-22 entry; the plate panel no longer exists. |
| Search and Sort icon plates with vine brackets | `dark-cloud-browser.png`; atlas `UI.103/.104`, `UI.53`, `UI.58`, `UI.66` | `exact-ported`; `44 px` minimum is `out-of-system` | Plates stay in the footer at every width and remain at least `44 px`. |
| Search / Sort dialogs | `dark-cloud-search.png`, `dark-cloud-sort.png`; native `MyQuickCPanel` family | `exact-ported` chrome and lifecycle | Double framed panel and inset rows; SEARCH NOW or a Sort choice commits and closes. There is no invented Done footer. |
| Mod viewer (`View mod`) | `dark-cloud-options.png` dialog vocabulary; Website detail/comments data | `exact-ported` chrome with `out-of-system` content | Viewer is composed of the native dialog members (framed panel, header band, inset label/field boxes with dividers, full-width inset buttons, stone DONE, close control); gallery, versions, and comments live inside inset boxes; it fills the viewport on phones and scrolls internally. |
| Footer status text | Website lane lifecycle | `out-of-system`; hidden on `<= 700 px` | Hidden footer status also hides its buttons (`display: none`) so no phantom targets remain. |
| Portrait orientation gate | `main-menu.css` rotate hint | `out-of-system` (Website platform); exempted for `[data-game-scene='dark-cloud']` | Portrait phone renders the Dark Cloud instead of the rotate hint; other scenes keep the gate. |
| Reduced-motion branch | browser preference | `out-of-system` | Row hover transitions collapse to none under `prefers-reduced-motion`. |
| Native rating, upload, unshare, Raptisoft account panel | vtables `0x00797DBC`, `0x0079857C`, `0x00797FFC`, `0x00797A1C` | `out-of-system` (unchanged from the reopening) | No inert duplicate control enters the phone layout. |

## Native and web ownership thread

- Construction/entry: unchanged. Title dispatch retains one `DarkCloudScene`;
  the new `DarkCloudPanel` is a pure chrome component (corners, flourishes,
  crest) shared by the menu, search, sort, and viewer dialogs.
- Producers: unchanged Website endpoints. The select-to-reveal action strip
  and the status band are derived from already-fetched lane state.
- Transitions: row tap selects (phones reveal that row's actions); View or
  double-tap opens the viewer; viewer close returns to the same selected row;
  Menu -> RESUME returns; Search -> SEARCH NOW applies the draft query and
  closes; selecting a Sort order commits and closes.
- Downstream: no subscription, activation, party, or save path changed.
- Teardown: unchanged; modals still restore focus and input to the scene.

## Recovered and requested behavioral contract

- The scene equals the viewport on every tested size; nothing scrolls
  horizontally; the framed list panel owns the remaining height.
- Touch viewports: every visible tab, footer, and row-action control is at
  least `44 px` tall; phones expose row actions only for the selected row.
- Landscape phones (`max-height: 620px`): the frame padding, header row, and
  corner art shrink together so the column header is never covered.
- The viewer uses only the native dialog vocabulary and fills the phone
  viewport with an internal scroll region; desktop keeps a centered
  `1100 x 820` dialog.
- Native chrome members (leather, gold lines, filigree corners, crest, vine
  brackets, stone DONE) paint from the committed crops at every breakpoint.

## Web implementation consequence

- `DarkCloudPanel.tsx` (new): shared framed-panel chrome.
- `DarkCloudModDetail.tsx`: rebuilt on the native dialog pattern.
- `DarkCloudScene.tsx`: status band, status controls, `statusLabel()`, menu /
  search / sort dialogs on `DarkCloudPanel`, SEARCH NOW applies and closes.
- `dark-cloud.css`: recomposed scene grid, rows, plates, dialog styles, and the
  `<= 1300 / 1180 / 980 / 880 / 760 / 700 px`, `<= 620 px` height, and combined
  phone-landscape breakpoints; hidden strips hide their buttons.
- `main-menu.css`: orientation-gate exemption for the Dark Cloud scene.

## Validation contract

- `frontend/src/game/dark-cloud-presentation.test.ts` passes.
- `npx tsc --noEmit -p tsconfig.app.json` exit `0`; `npm run lint` clean.
- `frontend/tools/smoke-dark-cloud.mjs` contract at `390 x 844` and
  `844 x 390`: scene = stage = viewport, horizontal overflow `0`, minimum touch
  target `>= 44 px` across tabs, footer, and row actions.
- `./scripts/validate.sh` from the worktree root.

## Implementation validation receipt

- Chrome `150.0.7871.124` headless, zero page/console errors in every state
  (mods, subscribed, parties, selected row, detail, detail bottom, menu,
  search, search result, sort):
  - `1600 x 900`: scene `1600 x 900`; list frame `[45,176,1510,629]`; rows
    `89 px`; viewer `1100 x 820` with `578 px` internal scroll.
  - `768 x 1024` coarse pointer: list `[12,187,744,738]`; rows `89 px`; rotate
    hint hidden.
  - `390 x 844`: list `376 x 653`; rows `[135,83,83,83]`; viewer `390 x 844`
    with `914 px` internal scroll.
  - `844 x 390`: list `820 x 236`; rows `62 px`; viewer `844 x 390` with
    `1257 px` internal scroll; column header clear of corner art.
  - `320 x 568`: list `306 x 424`; rows `[119,69,69,69]`; viewer `320 x 568`
    with `1351 px` internal scroll.
  - Horizontal overflow `0` and minimum touch target `44 px` at every size.
- Safari `26.4` on the macOS `26.4.1` Mac mini via `safaridriver`, same
  mocked catalog served through an SSH reverse tunnel as `http://localhost`
  (secure context), hidden-document caveats as in the evidence table; zero
  body errors in every captured state:
  - `390 x 844`: scene `390 x 844`; list `[7,124,376,653]`; rows
    `[134,82,82,82]`; selected row reveals its actions at `44 px`; viewer
    `390 x 844` with `907 px` internal scroll; gallery `1 / 3`, version history,
    and comments render inside the inset boxes.
  - `844 x 390`: list `[12,96,820,236]`; rows `62 px`; viewer `844 x 390` with
    `1252 px` internal scroll; corner brackets clear of the column header.
  - `336 x 568`: list `[7,90,322,424]`; rows `[118,68,68,68]`; viewer
    `336 x 568` with `1305 px` internal scroll; Parties lane and
    `ENTER SHARED HUB` footer render.
  - Horizontal overflow `0` and minimum touch target `44 px` at every size.
- The first two Safari attempts failed for harness reasons, not Dark Cloud
  reasons: a LAN-IP origin is an insecure context (see findings), and a
  mid-preload reload aborted the `/api/auth/me` fetch, which the auth provider
  treats as a sign-out. Both are recorded below for the platform owners.

## Nearby-system findings

- `frontend/src/game/client/game-diagnostics.ts:81` calls
  `crypto.randomUUID()`, which only exists in secure contexts; opening `/game`
  over a plain LAN IP crashes into the React Router error boundary. Not
  changed in this pass.
- `frontend/src/lib/auth.tsx:28` clears `sdr.token` whenever `api.me()`
  rejects, including aborted or offline fetches, so a transient network
  failure reads as a sign-out. Not changed in this pass.
- The startup audio preload (`game-audio-browser.ts` `loadMusicChannel`) has
  no timeout; a stalled music channel holds the title on `Loading game audio`
  indefinitely. Observed in the Chrome harness; not changed in this pass.
- Safari-only `EncodingError: Loading error.` unhandled rejections come from
  `fx/MenuSolomon.tsx:74` and `fx/BoneShatter.tsx:73` (`img.decode()` without
  a catch) on the Website pages, not from the game. Not changed in this pass.
