# 2026-08-24 — Stock title MsgBox prompts and direct tutorial entry

> This reopens the active-wizard title transition and the first-run tutorial
> offer. The preceding passes recovered the save/tutorial authority correctly,
> but both prompts remained synthetic React/CSS surfaces and the tutorial added
> a second web-authored control-selection screen.

## Reported smell and parity question

- Remove the control-pick prompt: accepting the tutorial must enter its stock
  prelude directly while retaining the player's already configured controls.
- Make the first-run tutorial offer look like a stock in-game menu.
- Make the current-wizard kill confirmation look and behave like the stock
  in-game prompt. The existing `RESUME LAST GAME` / `KILL WIZARD` adaptation is
  explicitly superseded; Last Game remains the separate Play-menu action.

Falsifiers: the retail Kill Character dialog uses bespoke title art rather
than the common MsgBox; omits its second question line; labels its actions
Resume/Kill; owns wizard resume as its negative branch; or the Website's
control picker is required by tutorial simulation/save authority.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | `SolomonDark.exe` 0.72.5, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Same canonical image as the title, save, tutorial, and complete native-UI corpora. | high |
| Concrete Kill prompt | fresh clean retail process with a task-owned current-wizard fixture; 1600x900 client capture SHA-256 `26a83bb43c05592fcf60ed9472ba1b2c4bfba14b06d8b28d77f5adc9f871f256`, tracked in Mod Loader `docs/assets/stock-prompts-20260824/kill-character.png` | Settled title scene is dimmed beneath a centered stock MsgBox. Visible content is title, a three-line warning, `Are you sure you want to do this?`, and `YES` / `NO`. No loader was injected. | high |
| Kill construction | canonical read-only Ghidra project; `0x0058E260`, caller `0x0058E600`; strings `0x00798474`, `0x00798408`, `0x007983E0`, `0x0078C4CC`, `0x0078C4C8` | Title uses Fonts group 3. Warning/question use group 1; the warning wraps at 400 px. Primary YES retires the wizard; secondary NO returns without mutation. | high |
| Shared MsgBox owner | ctor `0x004A98E0`, vtable `0x00788E04`, tick `0x005AB710`, render `0x005C4530`, layout `0x005AB060`, line `0x005BCCB0`, buttons `0x005AB7E0/0x005AB980`, finalize `0x005AB5C0`, finalizer `0x005AB2C0` | Common owner paints curtain, full stock frame/ornaments, bitmap lines, actions, pointer, and opacity. Finalize centers the content-sized dialog with a 25-pixel margin. | high |
| Family census | 25 `MsgBox` constructor references in 16 functions; 194 `Dialog_AddLine` references in 22 functions | Kill, selected-level resume, beta notice, account/error, editor/result, and related dialogs are sibling consumers of one closed primitive family, not separate chrome implementations. | high |
| Web causal trace | `MainMenuScene`, `TitleMenuPresentation`, `title-menu-renderer`, `ActiveWizardDialog`, `TutorialOfferDialog`, `TutorialControlPicker`, shared `native-ui-plan`/Pixi adapter | Title background is already WebGL, while both dialogs paint independent CSS approximations. Tutorial YES detours through `tutorial-controls` for one second before the real prelude. Neither detour owns save or simulation state. | high |

## System boundary and membership inventory

Native/web system: title-local modal presentation and input, plus the two
existing scene transitions it gates. Save detection, fresh-player tutorial
authority, wizard retirement, and tutorial simulation stay in their established
owners.

| Member | Owner/source | Disposition | Proof contract |
| --- | --- | --- | --- |
| common MsgBox curtain/chrome/ornaments | `0x005C4530`; `UI.49`, `.10/.79`, `.107..110`, `.17`, `.18`, `.8` | `exact-ported` through the shared native-UI plan | same atlas records, painter order, logical 1600x900 stage, and title-scene dim |
| common MsgBox bitmap lines/wrap | `0x005BCCB0`, Fonts groups 3/1, 400-pixel wrap | `exact-ported` | finite stock glyphs and kerning; no CSS or OS-font copy |
| common primary/secondary controls | `0x005AB7E0`, `0x005AB980`, `UI.101/.102/.54` | `exact-ported` | visible plan and semantic hit rectangles share one geometry; hover/press state selects stock art |
| Kill Character title/body/question | `0x0058E260` and four exact strings | `exact-ported` | all lines present with the native wrap and case |
| Kill primary YES | current-wizard retirement owner | `exact-ported` | busy state blocks duplicate input; existing profile-only persistence completes before Create |
| Kill secondary NO / Escape | MsgBox secondary result | `exact-ported` | closes only the modal and returns to Play; no resume or save mutation |
| Last Game | existing Play-menu row | `verified-already-at-parity` | remains independently reachable and loads the current wizard |
| first-run tutorial offer wording | Website first-run policy; no claimed retail prompt string | `out-of-system` content inside exact stock MsgBox presentation | offer still appears only when the selected online/cloud or offline/local store has no save |
| tutorial YES | existing tutorial prelude/host bootstrap | `exact-ported` transition after requested cleanup | enters `tutorial-prelude` directly; no intermediate picker or timer |
| tutorial NO / Escape | existing first-run decline path | `verified-already-at-parity` | persists/enters ordinary new-player Hub path without tutorial |
| tutorial control picker component, `tutorial-controls` screen, selection/fade timer | prior Website-only detour | `out-of-system`, removed by explicit user direction | no source, CSS, type, state, route, or test expectation remains |
| configured controls | existing Settings/runtime input mapping | `verified-already-at-parity` | tutorial uses current mapping; prompt removal does not rewrite settings |
| selected-level `RESUME PREVIOUS GAME?` | native `0x0058F500` | `out-of-system` for this title flow | remains distinct from current-wizard Kill and Last Game |
| remaining 15 native MsgBox constructors | beta/account/Dark Cloud/editor/result owners | `out-of-system` screen state; shared primitive `exact-ported` | complete constructor census recorded; no second title adapter or unresolved art member |
| existing Inventory/trader/unforge messages | scene-owned shared Pixi/native-UI consumers | `verified-already-at-parity` | no behavioral or authority change from title adoption |
| save codec/cloud/local detection, host protocol, gameplay tick, replay, RNG | existing durable/simulation owners | `out-of-system` for presentation change | zero schema, wire, authority, or randomness change |

No member is browser-blocked. The browser-authored tutorial offer cannot be
native-copy exact because no retail string/trigger is claimed; its requested
appearance is nevertheless the exact shared stock MsgBox composition.

## Native ownership thread and recovered contract

- `0x0058E600` decides whether New Game requires confirmation and calls only
  `0x0058E260`. The dialog returns a boolean result; it does not load Last Game.
- `0x0058E260` constructs one common MsgBox: group-3 title, group-1 warning,
  group-1 confirmation, primary YES, secondary NO, then centered finalization.
  The 400-pixel warning wrap is three exact visible lines.
- The shared MsgBox renderer owns all visible art and the modal curtain. Its
  owner supplies action meaning and transition state. The Website therefore
  keeps React only as an accessible semantic projection over renderer-returned
  rectangles; React does not paint a second frame or text layer.
- Both title prompts live in the existing title renderer and reuse its loaded
  source-page lifetime. Prompt containers/derived UI textures are destroyed
  with that renderer. Underlying title rows stay visible beneath the curtain
  but inert while a modal is active.
- The tutorial picker has no downstream authority. Its selection only rewrote
  the same settings already owned elsewhere and delayed entry by a one-second
  fade. Direct prelude entry removes the component, screen state, selection,
  timer, and control-atlas dependency together.

## Web implementation consequence

- Extend the title renderer frame with a nullable prompt description and two
  prompt action states. Render `planNativeUiMessage` through the shared Pixi
  adapter above the title scene, with `UI` and `Fonts` resident in the title
  asset batch.
- Use one semantic `StockPromptDialog` for both prompts. It derives button
  placement from the same pure plan and owns keyboard focus/Escape only.
- Restore the Kill dialog's exact question and `YES` / `NO` actions. YES calls
  the existing kill transaction; NO/Escape cancels. Remove `resumePromptWizard`.
- Delete `TutorialControlPicker`, its CSS, screen union member, selection/fade
  state, and transition effect. Tutorial YES goes directly to the existing
  prelude; tutorial NO is unchanged.

## Validation contract

- Pure plan: concrete stock Kill text wraps into its three native warning
  lines plus separate confirmation; one/two-action plans return their exact
  visible hit geometry and hover/pressed states.
- Static/component: no CSS-drawn active-wizard/tutorial dialog and no control
  picker source, route, timer, or copy remain; exact Kill strings and YES/NO
  semantics are present; tutorial YES enters prelude directly.
- Renderer/assets: title batch contains the exact UI/Fonts pages; one shared
  Pixi adapter paints prompts above the title menu and tears down before source
  pages; underlying rows cannot receive pointer/keyboard actions while modal.
- Save regressions: current wizard NO leaves the document unchanged; YES still
  commits profile-only before Create; Last Game still resumes separately; new
  online/offline player offer rules remain exact.
- Mac: canonical Website gate, then headed Chrome at the exact commit for fresh
  offline, fresh authenticated/cloud, existing-current-wizard, and existing-
  profile paths. Review both prompt captures against the stock Kill reference;
  require WebGL2 and empty page/console/failed-response/application-error arrays.

## Implementation validation receipt

- Implementation source candidate `7fe6ea8b` is rebased on Website
  `d35a1e54`; its product tree is
  `7a0dd5cea8f38102243887128baca6708d923563`. The paired native-report
  candidate is Mod Loader `719ea43f` on `f9e8e52a`. Both were transferred by
  prerequisite-checked Git bundle into isolated Mac worktrees; their source
  trees matched the Windows/WSL candidates before validation.
- On Apple arm64 macOS `26.6.2`, the focused native-UI and tutorial suites
  passed `56/56` and `14/14`. The canonical Website gate passed backend build
  with zero warnings/errors, 22 backend contracts, formatting, lint with zero
  errors and the eight existing warnings, every frontend and desktop suite,
  TypeScript, production build, media policy, and bundle budget. The first
  full-gate log SHA-256 is
  `e28f2d3c44631611d171cb085834b9d8b33bff1f77a967bbceff7d9e41397504`;
  `Game-B0DdhnWY.js` measured 457,947 raw / 128,634 gzip bytes under the
  524,288 / 131,072 limits. Node `22.17.0`, npm `10.9.2`, .NET `10.0.302`,
  and Chrome `151.0.7922.170` were used.
- The save-backed Chrome journey passed anonymous/local and authenticated/
  cloud players, save/restart/drain, stock `NO` cancellation followed by the
  separate Last Game path, stock `YES` retirement, and profile-only New Game.
  Anonymous/authenticated saves resumed at Hub spawn `(950.64,164.04)` and
  reached revision 4 after a one-player deployment drain. Retirement reached
  profile-only revision 2 with 500 gold and all five carried items scavenged;
  the 12,345-gold profile-only case retained disabled Last Game. Page,
  console, failed-response, and application-error arrays were empty. Receipt
  log SHA-256 is
  `a9c2e6d9f78e38a4d56413edc48f7196aac47321c9c34701056c774f1b9637be`.
- Reviewed Kill prompt captures for local, cloud, and retirement paths have
  SHA-256 values
  `987ffe25805bf8cd858a4cdac712a3318d996548b8cf57e4fbb9c08e35021ffa`,
  `786913bb3034b99a87e37dbf88599b2bf0bd406e6cb79c5bb4a73de8f22eb205`,
  and `4f5a9f3823d553154a6ea62ff6e79786d3649c49afa7cca783e6311050d6edd5`.
  Side-by-side review against the clean retail capture confirms the same
  stock frame, ornaments, four-line text program, button art, and action
  placement; the recovered prompt aligns at zero horizontal and one vertical
  pixel after removing the native Windows frame.
- A separate headed real-Chrome journey opened a genuinely missing local slot,
  rendered the tutorial offer through WebGL2, clicked `YES`, and reached the
  stock prelude directly with zero control-picker element. Page, console, and
  failed-response arrays were empty. Tutorial prompt, direct-prelude, and log
  SHA-256 values are respectively
  `9630d979d7c9f5352646b82e1a2a2a4d44d6bdc35d9a02ed46d85740dcb2de27`,
  `666bbbac359a2de3f51ae0a1116a4515499c2867926fbfe61d5b3ae25a2672d2`,
  and `9ece905e270e769b724bc57089cb4c7074fb4a7685d56b025cfcc5401ea8d114`.
- Browser and validation children released their isolated ports. The user
  authorized publication to `main`; production deployment/restart was not
  requested and remains a separate operation.
