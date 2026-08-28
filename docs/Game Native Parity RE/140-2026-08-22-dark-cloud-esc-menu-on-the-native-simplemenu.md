# 2026-08-22 — Dark Cloud Esc menu on the native SimpleMenu

> The Dark Cloud's crest button and the OPEN MENU key now raise the same
> `SimpleMenu` owner surface the gameplay pause uses, carrying the Dark Cloud's
> own four native rows (`RESUME` / `GAME SETTINGS` / `SIGN OUT` / `MAIN MENU`).
> The custom plate panel, its `flourish.png` crest, and the RESUME / SIGN IN /
> TITLE plates recorded on 2026-08-21 are gone; that row is refuted below.

## Reported smell and parity question

Owner request: "Hit up the Esc menu in the Dark Cloud to match that of the
normal escape menu." The 2026-08-21 entry shipped a custom RESUME / SIGN IN /
TITLE plate panel behind the crest and recorded it as `exact-ported`. The
parity question is what the retail Dark Cloud actually raises on Esc and on the
crest, whether that is the same system as the gameplay pause, and what its row
table is.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Reopened capture | `.codex-windows-validation/loader-audio-census-20260816/webgame-contracts/baseline-snapshots/menu-reference-captures/dark-cloud-menu.png`, SHA-256 `39cca3bdc8e3605baed11b13263fb91cf7bdece6d677e29e0e2b269b32fff901`, 1600 by 900 | The retail Dark Cloud menu is the SimpleMenu chrome: `UI.17` frame outer gold columns `586-588` / `1012-1014` and outer gold rows `265` / `635`; four `UI.101` bodies `353` wide from `x 623` with tops `301 / 377 / 453 / 529` (`76 px` pitch, `69 px` bodies); `UI.18` header bright span `673..928` (centroid `801.58`); three `UI.8` arrows below the frame; labels `RESUME`, `GAME SETTINGS`, `SIGN OUT`, `MAIN MENU`. | high |
| Reopened capture | `pause-menu.png` (same directory), SHA-256 `a6a570223551dde9760a0ba2f02b7533005c5c54bfea7cf34b63742de1e78a6f` | The gameplay pause shares the same x-span (`586-588` / `1012-1014`), header span and centroid (`801.58`), and `76 px` row pitch; its three-row frame spans `y 303..597`. The owner surface grows vertically with the row count around the stage centre `(800, 450)`. | high |
| Reopened doc | Mod Loader `docs/ui-binary-map.md:73-82` | Dispatcher `0x005A5530` (= `DarkCloud::vftable 0x00797C44` slot `+0x10`) authors `RESUME[0]|GAME SETTINGS[1]|SIGN OUT[2]|MAIN MENU[3]`; title/profile follow-through menus resolve through the live `SimpleMenu` owner path (ctor `0x005BA4B0`, Tick `0x005A8950`, renderer `0x005C5A00`); OPEN MENU binding `0x00B3BCCC`. | high |
| Prior entry | 2026-08-21 membership row "Menu crest and menu panel … `exact-ported`" | Refuted: the native crest raises the SimpleMenu owner surface, not a plate panel, and `flourish.png` had no native counterpart. | high |
| Web source | `frontend/src/game/pause-menu-contract.ts`, `renderer/gameplay-pause-renderer.ts`, `GameplayPauseMenu.tsx` (gameplay pause entry) | The shared renderer already carried the exact chrome, reveal/close ticks, `0.85` dim, bitmap labels, and press art for the fixed three gameplay rows; only the row table and the union height were hard-wired. | high |
| Runtime receipt | scratchpad `shoot-esc2.mjs` harness against the worktree Vite (`127.0.0.1:5189`), headless Chrome, mocked API; six signed-in viewports and three guest viewports | Geometry, labels, focus, dim colour, host inertness, consumed second Escape, press art, settings handoff, MAIN MENU, SIGN OUT, and guest re-entry receipts (listed under the validation receipt). | high |
| Pixel diff | desktop `1600 by 900` web capture versus `dark-cloud-menu.png` (upsampled 4x cross-correlation per region) | Rows, labels, left frame, and arrows align within `0.25 px`; the right frame, right `UI.54` row ends, bottom frame line, and header sit `1 px` further out in native. The identical deficit is measured on the web gameplay capture versus `pause-menu.png`, so it belongs to the shared renderer (nearby finding), not to this port. | high |

## System boundary and membership inventory

Native system: **`SimpleMenu` owner surface (ctor `0x005BA4B0`, Tick
`0x005A8950`, renderer `0x005C5A00`) as raised by the Dark Cloud dispatcher
`0x005A5530`.**

| Member | Native or web source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Row authoring: four rows, labels, order | `0x005A5530` row table; `ui-binary-map.md:75` | `exact-ported` as `NATIVE_DARK_CLOUD_MENU_ROWS` | `pause-menu-contract.test.ts` pins labels and actions; the harness reads `RESUME / GAME SETTINGS / SIGN OUT / MAIN MENU` at every viewport. |
| Control union and row geometry for N rows | `0x005C5A00` layout; capture row tops `301 / 377 / 453 / 529` | `exact-ported` (`nativeSimpleMenuRowBounds(n)`: `353 by 69` bodies on a `76 px` pitch, union centred on `(800, 450)`, left `623.5`) | Four rows reproduce tops `301.5 / 377.5 / 453.5 / 529.5`; three rows reproduce `PAUSE_MENU_ACTION_BOUNDS` exactly (test). |
| Chrome (`UI.17` frame, `UI.54` row ends, `UI.18` header, `UI.8` arrows), reveal `29 x 0.035` / close `20 x 0.05`, `reveal * 0.85` dim, label tint and `(6, 6)` press shift | shared renderer (gameplay pause entry) | `verified-already-at-parity`, generalised to the row count with no art or motion change | Settled chrome `583.5-1016.5 x 261.5-638.5` (four rows) / `299.5-600.5` (three rows); opening chrome `25 px` wider on every side; header at `top - 42`; arrows at `bottom + 55` (`x1`) and `bottom + 42` (`x0.75`). |
| Open and consume input | OPEN MENU binding `0x00B3BCCC`; the native owner swallows the second OPEN MENU | `exact-ported` | Harness: Escape opens (reveal `1` after `450 ms`), a second Escape is consumed (reveal stays `1`, menu stays), RESUME closes (reveal falls through `0.6-0.7` and the stage unmounts); the crest (skull) button opens the same surface. |
| Pressed body hand-off (`UI.102` while held) | renderer | `exact-ported`; web defect fixed: the auto-focused first row released a press landing on any other row through its blur | Harness: mouse-down on SIGN OUT reads `pressed=sign-out` with the pressed-row record `102`; test pins the blur rule. |
| SIGN OUT | native ends the Dark account session | `web-adapted`: `useAuth().logout`; `Game.tsx` rebinds the save and mod stores to the guest identity and remounts the title root, so the Dark Cloud is re-entered as a guest | Harness: token cleared, title root with the Explore button, re-entry shows the guest band and the three-row menu. |
| Guest rows | native shows SIGN OUT against a signed-in account (guest band "You are signed in as a GUEST.") | `web-adapted`: guests get RESUME / GAME SETTINGS / MAIN MENU with no inert control; sign-in stays on the account band | Guest harness runs: three rows at tops `339.5 / 415.5 / 491.5` (gameplay geometry). |
| MAIN MENU | native returns to the title | `exact-ported` through action `leave` to the title root | Harness: Explore button back, `.dark-cloud-scene` gone, no menu stage. |
| GAME SETTINGS | native settings dialog raised from the Dark Cloud | `verified-already-at-parity` (`setSettingsContext('dark-cloud')`) | Harness: `.game-settings-dialog` opens after the close; Escape closes it; the Dark Cloud list is retained. |
| Phone placement | native is a fixed `1600 by 900` stage | `web-adapted` touch fit on the menu's own extent | `844 by 390`: scale `0.611`, rows `42.16 px`, arrow bottom on the `12 px` margin; `390 by 844`: scale `0.845`, rows `58.3 px`; `1024 by 768` and larger keep the gameplay display scale. |
| Plate panel, `flourish.png` crest, RESUME plate `data-game-back` target | web-only | removed; `out-of-system` and refuted | `dark-cloud-presentation.test.ts` asserts the shared menu mount; the asset is deleted; no native counterpart exists. |

## Native and web ownership thread

- Native: crest press or OPEN MENU reaches `0x005A5530` slot `+0x10`, which
  constructs the SimpleMenu (`0x005BA4B0`) with the four authored rows;
  `0x005A8950` ticks the reveal and close and swallows the second OPEN MENU;
  `0x005C5A00` paints the dim, the row bodies and labels, the frame, the
  header, and the arrows; the selected row's action runs once the close
  completes.
- Web: `DarkCloudScene` skull button or Escape sets `darkCloudMenuOpen` in
  `MainMenuScene`, which mounts `<GameplayPauseMenu rows={darkCloudMenuRows}
  escapeAction={null} pause={DARK_CLOUD_PAUSE}>` in the owner presentation;
  `createGameplayPauseRenderer(rows)` paints the shared chrome from
  `nativePauseMenuRenderPlan(reveal, pressed, rows)`; `onSelect` fires after the
  close: `settings` sets the Dark Cloud settings context, `sign-out` calls
  `onSignOut` (`useAuth().logout` passed down by `Game.tsx`), `leave`
  transitions to the title root, `resume` only closes. Placement comes from
  `nativePauseMenuStagePlacement(fixedViewport, rows)`.

## Recovered and requested behavioral contract

- Rows: union height `69 + 76 * (n - 1)`, centred on `(800, 450)`, left
  `623.5`; `n = 4` gives top `301.5`, `n = 3` gives `339.5` (the gameplay
  pins). Labels are Fonts-group-3 bitmap text, tint `0xd9ba70`, shifted
  `(6, 6)` while pressed.
- Chrome: spread `(1 - reveal) * 25 + 40` around the union; header at
  `(800, top - 42)` rotated `pi / 2`; arrows at `(800, bottom + 55)` scale `1`
  and `(725 | 875, bottom + 42)` scale `0.75`.
- Input: the crest or OPEN MENU opens; while open the host is inert and corner
  hits land on the dim; the second Escape is consumed; click or Enter on a row
  begins the close and the action fires when the close completes.
- Account: SIGN OUT appears only when signed in; it ends the site session and
  returns to the title as a guest.
- Placement: the stage keeps the gameplay display scale while rows stay at
  least `44 px`; below that the rows' own extent is fitted inside the viewport
  with a `12 px` margin.

## Web implementation consequence

- `frontend/src/game/pause-menu-contract.ts`: row model
  (`NativeSimpleMenuAction`, `NativeSimpleMenuRow`, `NATIVE_PAUSE_MENU_ROWS`,
  `NATIVE_DARK_CLOUD_MENU_ROWS`, `NATIVE_DARK_CLOUD_GUEST_MENU_ROWS`),
  `nativeSimpleMenuRowBounds(n)`, and a `rows` parameter on the render plan,
  extent, and stage placement; `PAUSE_MENU_ACTION_BOUNDS` stays as the
  gameplay pin.
- `frontend/src/game/renderer/gameplay-pause-renderer.ts`:
  `createGameplayPauseRenderer(rows)`.
- `frontend/src/game/GameplayPauseMenu.tsx`: `rows` prop, `onSelect(action)`,
  host-authored `escapeAction` (gameplay defaults Resume; Dark Cloud consumes),
  first-row focus, pressed row taken from the plan, and the blur-release rule.
- `frontend/src/game/MainMenuScene.tsx`: the Dark Cloud mounts the shared menu
  with account-dependent rows, an explicit consumed Escape, and dispatches the
  four actions; new `onSignOut` prop wired from `frontend/src/pages/Game.tsx`
  (`useAuth().logout`).
- `frontend/src/game/DarkCloudScene.tsx`, `DarkCloudPanel.tsx`,
  `dark-cloud.css`: plate panel, crest, and menu-panel rules removed; the skull
  button raises the menu. Current main's full-display pause owner supplies the
  viewport dim; the Dark Cloud's computed inline style places only the inner
  native stage, with no overflow or oversized-dim workaround.
- `frontend/src/assets/game/dark-cloud/flourish.png` deleted.

## Validation contract

- `pause-menu-contract.test.ts` (14 tests): the N-row plan, the four-row and
  guest geometry, phone fits, the blur-release rule, and the component wiring.
- `dark-cloud-presentation.test.ts`: the Dark Cloud mounts the shared menu with
  `darkCloudMenuRows`, the `onSelect` dispatch, and the `onSignOut` plumbing
  from `Game.tsx`.
- `game-settings.test.ts`: the Dark Cloud settings handoff and the `GAME
  SETTINGS` label living in the contract.
- Harness receipts per viewport, the pixel diff against the native capture,
  `tools/smoke-game-pause.mjs` on the final tree, and `./scripts/validate.sh`.

## Implementation validation receipt

- Signed-in harness (`shoot-esc2.mjs esc2`, six viewports, zero console
  errors): four rows `resume / settings / sign-out / leave` labelled
  `RESUME / GAME SETTINGS / SIGN OUT / MAIN MENU`; desktop `1600 by 900` scale
  `1`, row tops `301.5 / 377.5 / 453.5 / 529.5`; `1920 by 1080` scale `1.2`;
  `1024 by 768` scale `0.64` (`44.16 px` rows); `390 by 844` scale `0.845`
  (`58.3 px` rows); `844 by 390` scale `0.611` (`42.16 px` rows); `320 by 568`
  scale `0.684` (`47.2 px` rows). Every viewport: dim `rgba(0, 0, 0, 0.85)`,
  `.dark-cloud-stage` inert, six corner hits on the dim, first row focused,
  second Escape consumed, RESUME closes, skull reopens, GAME SETTINGS opens the
  dialog and Escape closes it, MAIN MENU returns to the title, SIGN OUT clears
  the token and lands on the title, guest re-entry shows the guest band and the
  three rows.
- Guest harness (`esc2-guest`, desktop / portrait / landscape): three rows at
  tops `339.5 / 415.5 / 491.5` (desktop), landscape scale `0.700` (`48.3 px`
  rows); same open, consume, resume, settings, and MAIN MENU receipts.
- Press hand-off after the blur fix (`esc3`, desktop and landscape): RESUME
  press `pressed=resume`, SIGN OUT press `pressed=sign-out`, pressed-row
  record `102`.
- Pixel diff against `dark-cloud-menu.png` (desktop capture): row bodies mean
  `4.5-5.1 / 255`, arrows `4.5`, whole extent `8.1`; per-region best shifts
  `0 / 0.25 px` for rows, labels, left frame, and arrows; `+1 px` for the right
  frame and header (nearby finding below).
- `tools/smoke-game-pause.mjs` on the final tree: status `0` in `148 s` at
  load `27`; the web gameplay capture it produced measures identically to the
  web Dark Cloud capture on the shared chrome.
- `./scripts/validate.sh` on the final tree: status `0` in `314 s`.

## Nearby-system findings

- Shared renderer far edges: the web chrome's right gold columns read
  `1011-1013` against native `1012-1014`, the bottom line `634` against `635`
  (Dark Cloud) and `596` against `597` (gameplay), the right `UI.54` row ends
  sit `1 px` left, and the header centroid reads `800.23` against `801.58`;
  left and top edges, rows, labels, and arrows match exactly. The pinned
  chrome `[583.5, y, 1016.5, y]` is `1 px` short on its far edges in both
  menus (a D3D9 half-pixel or inclusive-edge convention is the likely cause).
  This belongs to the gameplay pause system; resolving it there carries to the
  Dark Cloud automatically.
- The blur-release defect fixed here also affected the gameplay pause: with
  the first row auto-focused, a mouse press on any other row never showed
  `UI.102`.
- `tools/smoke-game-pause.mjs` failed twice at the Boneyard renderer-ready
  wait under machine load `10-16`, while the base commit, a snapshot of the
  pre-edit tree, and the final tree pass (load `3-4.5` and `27`); the wait is
  load-sensitive, not a regression.
- `data-gameplay-pause-renderer` lives on the canvas element, not on the stage
  host; probes that read it from `.gameplay-pause-stage` get `undefined`.
- After SIGN OUT the title shows the Game page's small "Not logged in" status
  text at the top-left; pre-existing and unrelated to the menu.
