# 2026-08-21 — Native Settings system and browser display/accessibility extensions

## Reported smell and parity question

- The title and gameplay `GAME SETTINGS` actions currently open a generic DOM
  dialog containing only Enable Cheats and the then-existing web
  primary/concentration selectors. Stock's Settings root, Audio and Video
  controls, Customize Keyboard child, Performance child, context branches,
  persistence, native panel presentation, and live consumers are absent.
- The requested browser product surface must port the Settings menu and every
  native setting that has a coherent browser owner, omit screen resolution
  because the game fits the browser, and add Camera FOV plus UI Scale for
  desktop and mobile users.
- Reproduction membership is title, gameplay pause, Dark Cloud, Hub Courtyard,
  all four private rooms, Boneyard modes `0..2`, desktop keyboard/mouse,
  controller focus, coarse-pointer landscape, fullscreen-capable browsers,
  installed iOS/web-app display mode, live resize, cross-tab storage, and
  remount/reload.
- Falsifiers are a slider that changes only its label, audio affecting only
  future sources, FOV moving actors or hit projection away from rendering,
  HUD scaling moving its anchors offscreen, a key label that disagrees with
  input routing, a local graphics option changing authoritative simulation,
  Settings releasing another pause owner, or an omitted native row without an
  explicit disposition.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail binary and fresh static analysis | `SolomonDarkAbandonware/SolomonDark.exe`, 0.72.5, `4,723,200` bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; preferred image base `0x00400000`; Ghidra 12.0.3 read-only replica | `MyCPanel` vtable `0x0079BEDC` owns adjacent root/audio/controls slots `+0xB4/+0xB8/+0xBC`; `0x005A81A0` allocates it and `0x005D8DC0/0x005D8F30` acquire/release gameplay suspension. The 2026-08-23 selected-HUD entry supersedes the former `0x005D8120` ownership claim. | high |
| Root and controls instructions | builders `0x005D9A50` and `0x005DAEF0`; audio apply `0x005D8FC0`; display init/apply `0x0041CE20/0x0041D4A0`; config init `0x005BAB60` | The complete root, 15 key/mouse rows, nine Performance rows, globals, defaults, capability gate, and context-only Resolution branch are directly instruction-backed. | high |
| Live native menu fixtures | `../Mod Loader/tests/fixtures/webgame/menu-layouts/{game-settings-title,game-settings-gameplay,game-settings-dark-cloud,controls,performance}.json` and paired reference PNGs | All three root contexts and both child families have independent settled/confirmation captures bound to the same retail executable. Title Settings process `13876` settled for 40 samples and confirmation process `17980` reproduced the family. | high |
| Native persistence/audio/lighting reports | `native-settings-system.md`, `native-save-format.md`, `native-audio-system.md`, `native-lighting-and-shadow-system.md`, `native-input-model.md`, `native-camera-control.md` | Audio user gain is live and independent by lane; renderer settings are local process presentation state; camera projection and screen UI are separate from actors/collision; native Settings has no adjustable FOV or UI scale. | high |
| Current Website trace | `GameSettingsDialog.tsx`, `game-settings.ts`, `MainMenuScene.tsx`, `DarkCloudScene.tsx`, `game-audio-director.ts`, Hub/Boneyard scenes and renderers, `GameHud.tsx`, input modules | One local `enableCheats` Boolean is the only persisted Settings state. Audio, camera, HUD scale, fullscreen state, bindings, lighting quality, and camera-pulse consumers have no Settings owner. Dark Cloud has no Settings return edge. | high |

Reusable native findings from the fresh static pass are recorded first in
`../Mod Loader/docs/reverse-engineering/native-settings-system.md`; the menu
shell summary now links to that report.

## System boundary and membership inventory

Native/web system: the local Settings controller, its title/gameplay/Dark
Cloud context lifecycle, persisted browser preference record, root and child
controls, and every live local presentation/input consumer. Account authority,
screen-size negotiation, story difficulty, native texture-memory retention,
and authoritative multiplayer simulation remain outside this preference
owner.

The disposition column is the required final state. The implementation receipt
below records the completed proof contract.

| Member (class/variant/scene/branch) | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| `MyCPanel` construction, modal ownership, Done, destruction | `0x005A81A0`, `0x005D8DC0`, `0x005D8F30`, vtable `0x0079BEDC` | exact-ported | one root owner per invocation; child Back retains it; gameplay Done alone releases its Settings pause |
| title Settings context | `game-settings-title` | exact-ported | title retained/dimmed, root controls usable, Done restores Settings focus |
| gameplay Settings context | `game-settings-gameplay` | exact-ported | pause owner holds constant world state through root and every child; Done resumes without catch-up |
| Dark Cloud Settings context and return | `game-settings-dark-cloud`, native Dark Cloud menu Settings edge | exact-ported | Dark Cloud retained/dimmed, Done restores its menu/browser without title transition |
| Sound Vol | `0x005D8FC0 -> 0x004073A0`; `Audio.SoundVolume` | exact-ported | `0..1` slider changes active and future one-shots, loops, and streams without changing authored per-source gain |
| Music Vol | `0x005D8FC0 -> 0x00407340`; `Audio.MusicVolume` | exact-ported | `0..1` slider scales active crossfades and future scene music independently of sound |
| Fullscreen live state | `Graphics.Fullscreen`; `0x0041D4A0` | exact-ported | standard and WebKit enter/exit plus installed-display fallback use the existing browser owner |
| Fullscreen automatic persisted re-entry | stock persisted `Graphics.Fullscreen` | blocked-by-platform (Fullscreen API requires a current user activation; browsers prohibit automatic re-entry on reload) | row always reports actual document/display state and never claims a persisted mode was restored |
| Resolution | title enumeration/gameplay restriction at `0x005D9A50` | out-of-system (user-directed browser-fit viewport already owns size and FOV expansion) | no resolution row or stale `data-resolution` preference; renderer backing density remains independent |
| Login Info / native Dark Name and password | MyCPanel root/action family | out-of-system (the authenticated Website account owns identity; legacy credentials must never enter game-local storage) | Settings exposes no credential field or token copy |
| Move Up/Down/Left/Right | `0x00B3BCBC/C0/B4/B8` | exact-ported | persisted physical key codes drive the same movement state; controller/touch remain independent browser inputs |
| Open Menu/Inventory | `0x00B3BCCC/C4` | exact-ported | displayed bindings match every Hub/Boneyard key listener and modal gate |
| Open Skills | `0x00B3BCC8`; native fresh value `T` | exact-ported row with documented web-default adaptation | Website defaults this row to `K` because current-main browser chat owns `T`; rebinding either row conflict-swaps the other, and `T` remains selectable |
| Open Chat | no native player-chat row; current Website protocol 49 chat extension | exact-ported as designed-not-observed browser extension | defaults `T`, persists beside the fifteen native identities, updates the composer prompt, and cannot collide with Skills |
| Belt slots 1..8 | `0x00B3BCD0..0x00B3BCEC` | exact-ported | persisted keyboard/Right Mouse codes route slots `0..7` and update HUD binding labels |
| Complex Lighting On branch | `0x00B3BCA8`; early composite and analytic tint | verified-already-at-parity | shipped-default visuals/draw order remain the identity case |
| Complex Lighting Off branch | `0x00B3BCA8`; Arena late-composite branch | exact-ported | object tint is white, light field remains, and composite moves after the shared world queue |
| Complex Shadows On/Off | `0x00B3BCA9`; complete caster family | exact-ported | On preserves every authored caster; Off drains/hides all directional meshes without affecting flat class shadows |
| Multiple Shadows On/Off | `0x00B3BCAA`; complete `MS` provider family | exact-ported | only providers whose recovered flag is `MS` change; literal true/false providers retain their flag and containment rule |
| Light Quality | `0x00B3BCA4`; `0x0057DF20` | exact-ported | browser slider covers native low `0.06` through capable `0.25`; target pixels and manager visibility use the same value |
| Cast Secondary Spells at Mouse | `0x00B3BCF4` | exact-ported | On projects Right Mouse through the live camera; Off uses the actor's live heading; touch/gamepad directional intents are unchanged |
| Kid Mode (Story Games Only) | `0x00B3BCF5` | out-of-system (Website has no stock story-game simulation or difficulty consumer) | row absent; no inert stored Boolean |
| Enhanced Effects On branch | `0x00B3BCAD`, persisted as `Game.FastCPU` | verified-already-at-parity | current high-fidelity shipped-capability branch remains enabled |
| Enhanced Effects user toggle / Off branch | `0x00B3BCAD` consumers across authoritative effect actor births and peer-local presentation | out-of-system (current multiplayer snapshots authoritatively materialize optional effect actors; partial client culling or host-wide preference would not reproduce native per-process semantics) | no misleading toggle; fixed On policy stays explicit until optional actors are fully presentation-local |
| Save Memory (Requires Restart) | `Graphics.SaveVideoMemory`, application `+0x49C` | out-of-system (browser/WebGL owns texture eviction and device recovery; the native D3D retention switch has no coherent web value) | row absent; no restart placebo |
| Zoom Effects On/Off | `0x00B3BCAC` | exact-ported | Off suppresses native camera/world pulse magnitude while retaining screen flash, gameplay, audio, and ordinary FOV |
| Performance Back | MyCPanel child return | exact-ported | applies local values and restores root without releasing gameplay suspension |
| Select Primary Attack | Game HUD control `+0x3AC`, not MyCPanel | out-of-system (never a Settings member; superseded by the 2026-08-23 selected-HUD correction) | Settings remains loadout-free; HUD selector owns the native action |
| Select Concentration siblings | Game HUD controls `+0x46C/+0x52C`, not MyCPanel | out-of-system (never Settings members; superseded by the 2026-08-23 selected-HUD correction) | Settings remains loadout-free; HUD selectors own A/B mutation |
| Enable Cheats | Website semantic Lua setting | exact-ported as explicit browser extension | defaults off, host-only runtime gate remains live, and guest never gains a VM/API |
| Camera FOV | browser extension over Region camera projection | exact-ported as designed-not-observed | `75..125%`; actual zoom is native zoom divided by FOV factor in Hub, every private room, Boneyard, culling, lighting, hit projection, and audio viewport calculations |
| UI Scale | browser extension over screen-space HUD/touch presentation | exact-ported as designed-not-observed | `75..150%`; top/center/bottom/right anchors remain inside logical viewport and hit boxes scale with their visuals |
| `UI`, `ControlPanel`, and bitmap-font presentation family | fixture JSON; `UI.8,17,18,28,42,47,48,54,80/82,100,101,107..110`; `ControlPanel.0,8,9,18` | exact-ported with designed layout extension for added FOV/UI/Cheats rows | exact source atlas records and native labels/chrome; no PNG screenshot baked as state |
| keyboard/gamepad focus, slider adjustment, Back, modal trap | native mouse-only input plus documented G11 browser design | exact-ported as designed-not-observed accessibility policy | disabled/absent rows skipped; left/right adjusts; Back cancels capture then child then root; focus returns to invoker |

The three `out-of-system` native product domains and the Enhanced Effects Off
branch are intentional dispositions, not silent stubs. The one
`blocked-by-platform` member predicts a visible difference: after reload the
Fullscreen row may read Off even if the prior session ended fullscreen; the
user must activate it again.

## Native ownership thread

- `0x005A81A0` constructs one `MyCPanel`. Title and Dark Cloud install it as a
  retained-underlay modal; gameplay construction increments the shared nested
  suspension owner. Root and child panels are one lifetime.
- `Settings_Render 0x005D9A50` builds audio/video/account/controls/performance
  root rollouts and conditional gameplay skill actions. `Controls_Render
  0x005DAEF0` is both the concrete key/performance builder and their apply
  path. `0x005D8FC0` is the adjacent audio apply slot.
- Configuration initialization and persistence are upstream state owners.
  Audio's `Audio.*Volume` store is separate from the 37-row process
  `settings.txt`; display/input/performance globals use the process settings
  writer. Runtime audio, display, input, camera, lighting, shadow, skill, and
  gameplay systems are downstream consumers and do not become panel state.
- In Website, `MainMenuScene` owns the local preference snapshot and context
  lifecycle. The Audio director, Hub/Boneyard scene/input owners, WebGL
  renderers, HUD, and semantic panels subscribe through typed values. No
  preference enters the network protocol or authoritative save.
- Storage events update another tab; unmount destroys listeners/renderers.
  Corrupt or incomplete current-schema state falls back atomically. The
  existing one-field settings record is migrated once into the complete
  schema so deployed Enable Cheats preference is not silently lost.

## Recovered and designed behavioral contract

- Native root values apply live. Sound and music remain separate master lanes
  over authored cue gain/crossfade envelopes. Active continuous sources must
  change immediately.
- FOV is a local renderer projection factor, not native `Zoom Effects`, WebGL
  backing resolution, viewport CSS scale, or simulation state. With factor
  `f`, Hub uses `1.2/f` and Boneyard `1.35/f`; every projection, inverse
  projection, clamp, cull, light query, nameplate, environment-light, and
  positional-audio view consumer uses that same zoom.
- UI Scale changes screen UI only. World canvases, actor positions, collision,
  camera zoom, light targets, snapshot state, and fixed ticks are unchanged.
  HUD virtual dimensions contract by the reciprocal scale before a centered
  uniform transform, preserving edge and center anchors. Touch controls scale
  their rendered and measured input radius together.
- Complex Lighting Off retains the native light field but does not analytically
  tint world objects and places the multiply composite in the recovered late
  band. Complex Shadows and Multiple Shadows remain independent settings.
  Light Quality affects both target resolution and manager visibility/cull
  math.
- Zoom Effects Off removes only optional camera/world magnification and
  displacement feedback. Damage, actors, screen-color flashes, sound, and the
  user's ordinary FOV remain.
- Key bindings are physical browser codes. The fifteen native identities remain
  complete; browser chat is an explicit sixteenth extension. Gamepad and touch
  mappings remain fixed input-family peers. Key capture conflict-swaps Chat and
  Skills, never steals a browser credential, and leaves no gameplay listener
  active beneath the modal.
- Native exact missing label rectangles remain an evidence limitation. The
  port consumes exact atlas records, labels, order, and live reference frames,
  while added browser rows require a documented responsive layout rather than
  invented native coordinates.

## Nearby-system findings

- `Select Primary Attack` and both `Select Concentration` actions were
  misattributed here. The 2026-08-23 correction proves `0x005D8120` is the Game
  HUD callback, not a MyCPanel callback. Their absence from Website Settings is
  native parity; the top-center HUD selectors retain the authoritative mutation
  behavior.
- The native fresh Windows default for Enhanced Effects is On even though the
  preserved sandbox profile is Off. The Website's current fixed-On policy is
  therefore the shipped-capability identity case, but it must remain visibly
  non-configurable until optional presentation actors leave authoritative
  state.
- Browser fullscreen persistence cannot be symmetric with native display
  persistence because activation is required. Persisting a desired Boolean
  would create a false state; actual `document.fullscreenElement`/installed
  display mode is authoritative.
- The existing renderer `data-resolution` value is device backing density,
  not the removed native Resolution row and not Camera FOV.

## Confidence and open questions

- Confirmed: owner/vtable/lifecycle, all semantic native members, context
  branches, globals, persistence keys/defaults, exact source asset families,
  browser owners, and every planned/out-of-system disposition.
- Designed-not-observed: FOV/UI ranges, responsive placement of added browser
  rows, physical-code conflict handling, and controller focus. Each is a web
  accessibility/product policy and is labeled as such.
- Unknown but non-material: exact native glyph/hit rectangles for old
  ControlPanel labels were not emitted by the stable hook. The fixture pixels,
  atlas records, builder strings, and values are exact; the browser layout does
  not claim those missing rectangles.
- No other native setting, authored table row, context branch, asset family,
  or persistence consumer remains undispositioned.

## Web implementation consequence

- Replace the one-field settings store with one typed local preference owner
  and a narrow legacy migration. Keep write normalization, storage
  subscription, defaults, formatting, camera zoom, and UI transform formulas
  in that cohesive module.
- Replace the generic dialog with the native Settings root and child-page
  hierarchy, exact source atlas chrome, semantic sliders/toggles/buttons,
  responsive scrolling, modal focus/Back behavior, and title/gameplay/Dark
  Cloud context return.
- Add master sound/music gain to the existing director rather than multiplying
  authored gains at dozens of callsites. Thread camera/display settings through
  scene-local renderer APIs; thread bindings through their actual input and HUD
  consumers.
- Do not add inert Resolution, Login Info, Kid Mode, Enhanced Effects, or Save
  Memory controls. Remove no active skill or Cheats functionality.

## Validation contract

- Focused contracts must cover strict storage/current-schema migration;
  default and boundary values; every membership row/disposition; active/future
  audio; native camera identity plus both FOV extremes in Hub/private rooms and
  Boneyard; pointer round trips; HUD/touch anchor and hit-size scaling; every
  binding; lighting/shadow/quality branches; Zoom Effects; fullscreen modes;
  context/Back/pause lifetime; and exact required atlas records.
- Browser journeys must exercise title root/children/reload, live audio,
  fullscreen, key capture and actual gameplay input, Hub and Boneyard FOV,
  UI Scale on desktop and coarse-pointer landscape, Performance toggles,
  gameplay skill selectors, Dark Cloud return, and zero page/console errors.
  This was the 2026-08-21 cutoff contract; the 2026-08-22 correction removes
  the selector interaction from the Settings journey.
- The exact final tree must pass the supported `./scripts/validate.sh`
  entrypoint. The same affected Settings/device/browser matrices must pass
  independently on the Mac mini, with its evidence reported separately.

## Implementation validation receipt

- `game-settings.ts` is the one normalized local preference owner. It keeps the
  deployed `solomon-dark-game-settings-v1` key, migrates the old Cheats-only
  record, rejects partial/corrupt current records atomically, and persists the
  complete audio, display, lighting, play-style, developer, and input state.
  The input census is the fifteen native identities plus the explicit Website
  Chat extension. Chat defaults to `T`, Skills defaults to `K`, and rebinding
  either conflict-swaps the other so one physical edge cannot open both.
- At the recorded implementation cutoff, one `GameSettingsDialog` owned title,
  gameplay, and redesigned Dark Cloud contexts plus Controls, Performance,
  primary, and concentration children. The primary/concentration children are
  superseded and removed by the 2026-08-22 product correction.
  It consumes the untouched stock `ControlPanel.png` atlas (SHA-256
  `d63bd3ac402fcbc00a60916b6f0aa79f662501acc8f6fbe88ee1676e69b43f86`),
  native UI chrome, semantic focus/Back behavior, responsive scrolling, and
  actual Fullscreen API state. Gameplay stays under the existing authoritative
  pause owner; Dark Cloud Done returns to the live catalog instead of title.
- Sound/Music values drive independent live Web Audio master lanes. Camera FOV
  drives the shared Hub/private-room/Boneyard camera and projection consumers.
  UI Scale drives centered virtual HUD geometry and the visual plus measured
  touch radii. The complete configurable key set drives movement, menus,
  Inventory, Skills, Chat, and all eight quickbar lanes. Performance values
  drive the recovered Complex Lighting composite branch, complete complex
  caster gate, `MS`-only Multiple Shadows flags, native `0.06..0.25` light
  target/query scale, pointer-versus-heading secondaries, and Zoom Effects.
- The intentional negative dispositions remain enforced: Resolution follows
  the browser; Website account authority replaces Login Info; Kid Mode has no
  story-game consumer; Enhanced Effects stays visibly fixed On while optional
  actors remain authoritative; and browser/WebGL owns texture memory. Automatic
  Fullscreen restoration remains the sole `blocked-by-platform` member because
  reload cannot supply the required user activation. The predicted visible
  difference is an Off row after reload until the user activates fullscreen.
- Code cutoff `1d87eb978dcd736875308e30252637aad20dcf60` is one commit above
  Website `origin/main` `ff1a574422a8fcb645fe2488caf45be44d4a0883` and preserves the
  concurrent Dark Cloud, derived HUD, unforge, mod-consumable, and chat systems.
  The supported local `./scripts/validate.sh` passed `15/15` backend contracts,
  `4/4` library/mod, `43/43` loot/presentation, `225/225` prerequisites,
  `1258/1258` broad game, `25/25` party/chat, `10/10` level-up/HUD, `7/7`
  diagnostics, `17/17` Hall, `16/16` Hub UI, `5/5` desktop, production build,
  bundle budget, and media policy. Only the eight existing Fast Refresh
  warnings remain. The local game entry is `383177` raw / `107780` gzip bytes.
- Local Chrome Settings acceptance returned `status: ok` and empty browser
  errors. It proved title persistence/fullscreen, `K/T -> T/K` Skills/Chat
  conflict swapping, actual `K` chat focus after the swap, Move Right `Z`, Hub
  zoom `0.96`, UI scale `1.5`, Dark Cloud return/topmost paint, Boneyard zoom
  `1.08`, Complex Lighting/Shadows/Multiple Shadows Off, light quality
  `0.05999999865889549`, Zoom Effects Off, and zero complex-shadow records.
- The final tested local and Mac mini worktrees shared Git tree
  `dbc6344cda5520e317bf446d1ac664b92ebec1d4`. The results were then written into
  this receipt as a documentation-only change; no code, asset, or test changed.
  Apple arm64/macOS Chrome `151.0.7922.170` passed the same canonical gate
  with the counts above and entry `Game-BBMbsaWN.js`, `383177` raw / `107781`
  gzip bytes. Every final tmux session exited `0`.
- Mac Chrome Settings acceptance returned the same semantic receipt with Hub
  movement delta `31.789827660263995`, remapped Chat `KeyK`, and zero errors.
  The title, Dark Cloud, and Boneyard captures have SHA-256
  `f139a739dd30bd9f0638898a5cbf40e36248226b828464063c75e508188b941d`,
  `57dcb56d19ba6b14338ee898167cf0470108a62bdbf66760feaa1861bb50b909`,
  and `8766dd6ec94b7a0b61ee335ad21280c90a22a40d1b9d417f2265156f992872ba`.
  The Dark Cloud label probe was topmost, visible, opacity `1`, color
  `rgb(255, 240, 183)`, and measured `247x22` pixels.
- Mac pause acceptance held Hub tick `1256` and Boneyard owner/peer ticks
  `1681/1683`, then resumed at `1685` without catch-up. Settings, Hub-owner,
  and Boneyard-waiting captures hash to
  `427354dcbf7222ab8db29ad65bfb287c49e2914ac0138c4eaa05a6309927db34`,
  `6931e0543b3ea7159825913a689d1e0d351a2b292b0cafec8579f5fce1a06915`,
  and `2241b533024b5d2a763cf9227a92a7c0fb840c15df86d9964b56953db9bee86e`.
- Mac device acceptance passed Steam Deck `1280x800`, mobile `844x390`, and
  portrait surfaces. Both joysticks grew from about `82.333` to `123.5` pixels
  at UI Scale 150%, remained inside the viewport and clear of the map, and all
  normal/cancel/capture-loss/blur/reuse/visibility/teardown release paths
  reached `playerMoving=false` then stayed position-stable. Boneyard FOV was
  `1.08`. Deck, mobile Settings, Hub, and Boneyard captures hash to
  `477e0307b14b8e8a089125e4e5790e96001f8e7e7488d93aebee854bb746f3ae`,
  `bf4d0c900dbe8d53f1bb297db95c56e1fc25d1feac657e4db2587754c0ec069f`,
  `7aa62f86d720abe294bc7adafd673954de4c9c97b357e1afc31b9b22115b001a`,
  and `1a4775b1144a21ab0e7514e521c8ea75a75736cf1076322ef8e0d3f9a3e4c94d`.
- Mac live-audio acceptance returned `status: ok`: title/selection/academy/
  Boneyard tracks, one-shots and streams, semantic `25`-tick Hub and Boneyard
  footsteps, rainfall, Dig, and Teacher summon all retained their owners after
  the new master-gain seam. No push, deployment, or production restart was
  performed.

## 2026-08-28 mobile effective-consumer reopening

The owner report that `MUSIC VOL:` has no effect on mobile falsifies this
entry's earlier effective-output claim. The input and storage owners are
correct, but iOS does not apply `HTMLAudioElement.volume`; the prior acceptance
stopped at the abstract channel property instead of measuring the platform
sink. The full evidence, scene/crossfade/priming/mod/public-site membership,
and correction contract are recorded in
`019-native-audio-ownership-cues-and-clocks.md` under “2026-08-28 iPhone
streamed-music gain reopening.”

The renewed Settings membership is all five range controls (`SOUND VOL:`,
`MUSIC VOL:`, Camera FOV, UI Scale, and Light Quality), their active and future
consumers, the Performance toggles, root actions, scrolling, Back/Done, and the
mobile fullscreen capability branch. Only Music and its streamed-audio
siblings require an implementation change; the others are
`verified-already-at-parity` only after a touch-driven Mac journey re-proves
their live consumers. Automatic fullscreen re-entry remains the sole existing
`blocked-by-platform` row and predicts the same user-activation difference
documented above.

The renewed journey is complete. At `896x414` with touch and an iPhone user
agent, Sound, Music, FOV, UI Scale, and Light Quality each changed from a real
touch before the final value was applied. The effective game music/sound gains
were `0.40/0.65` with raw media fixed at one; Hub reported camera `0.96` and UI
scale `1.5`; Boneyard reported camera `1.08`, light quality `0.06`, every tested
Performance toggle Off, and zero complex-shadow records. Page, console, and
failed-response arrays were empty. The desktop sibling journey and complete
Mac validation gate also passed. The detailed output-graph and public-site
audio receipt remains in entry 019; no physical-iPhone receipt is claimed.

## 2026-08-29 Website Open Cheats binding extension

The live debugging menu adds one second browser-only input identity beside
Chat: `Open Cheats`, defaulting to physical `Backquote`. It participates in the
same persisted uniqueness and conflict-swap contract as every other keyboard
row, but its consumer is admitted only for an authoritative ordinary cheat
host or a sealed developer connection. Every deployed complete-controls record
is migrated by adding Backquote, or the first free `F1..F3` fallback if a user
already assigned Backquote; corrupt, partial, or duplicate records still fail
closed. This is a designed Website extension, not a newly attributed retail
setting. The complete input membership is now the fifteen native identities,
browser Chat, and browser Open Cheats.

## 2026-08-31 — Reopened: complete stock Settings presentation vocabulary

### Reported smell and parity question

- Owner request: reverse engineer the stock Settings appearance more deeply,
  port that appearance, and make the maintained native UI framework the base
  for later custom-interface rebuilds. Custom tutorial, mod-selection, party,
  and directory redesigns are explicitly deferred.
- The 2026-08-21 pass closed Settings behavior and used several exact atlas
  snippets, but explicitly left native label/hit rectangles unresolved. The
  current DOM still approximates panel proportions, type, row chrome, header,
  and footer with CSS/OS fonts. The earlier receipt therefore proves behavior,
  not complete presentation parity.
- Falsifiers: the stock shell is responsive rather than fixed; Settings uses a
  second font or unlisted atlas family; ControlPanel records `.0/.3/.4/.5/.8/
  .9/.18` do not own navigation, rows, range tracks/values, toggles, and slider
  thumbs; or a current stock-semantic row cannot fit the recovered vocabulary.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Fresh static binary | canonical `SolomonDark`/`SolomonDark.exe` read-only replica 3; retail 0.72.5 SHA-256 `03a834566ce70fd808f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; preferred base `0x00400000`; `MyCPanel` vtable `0x0079BEDC` | Slots `+0xB4/+0xB8/+0xBC` are `Settings_Render 0x005D9A50`, audio apply `0x005D8FC0`, and `Controls_Render 0x005DAEF0`. Constructor/destructor remain `0x005D8DC0/0x005D8F30`; one panel lifetime owns root and children. | high |
| Fresh shell trace | `MyQuickPanel_Render 0x005D86E0`; `CPanel` setup/render `0x00434540/0x00434840`; shared control builders `0x00435B00/0x00435CA0/0x004366E0` | The native shell is one retained fixed panel; it builds controls through shared rollout/control objects rather than screen-specific paint code. Render constants resolve to 5/15/5/20-pixel shell insets and 10/70/140-pixel context offsets. | high |
| Fresh control-family trace | slider `0x00436160 -> 0x00438600`; toggle `0x00435DE0 -> 0x004380D0`; key binding `0x00436310 -> 0x00438F50`; action/button `0x00436750 -> 0x00437D90/0x004389C0`; ControlPanel control vtables | Root and child screens share one slider, checkbox/toggle, binding, navigation-action, and button family. `Controls_Render` enumerates the complete native row set through these builders. | high |
| Settled live native layouts | retained 1600 by 900 fixtures/captures `game-settings-title`, `game-settings-gameplay`, `game-settings-dark-cloud`, `controls`, and `performance`; capture tree `4ae5370977019c1c20813fa17d5141f32cd50968` | Every context uses panel `[500,100,1100,800]` (600 by 700); `UI.17` corners sit at `(490/1030,90/727)`; mirrored `UI.18` flourishes span y `319..581`; Done/Back is `[650,739.5,950,780.5]` (300 by 41). | high |
| Exact generated catalog | `native-ui-assets.json`; UI atlas SHA-256 `37d5e8fc543af12a9d8019e738dbe1e29b648211144a3782c3a32e71f76cd2eb`; ControlPanel atlas SHA-256 `d63bd3ac402fcbc00a60916b6f0aa79f662501acc8f6fbe88ee1676e69b43f86` | Shell uses `UI.17/.18`; ControlPanel `.0` is the 14 by 15 action arrow, `.3` the 315 by 44 row plate, `.4` the 106 by 29 range track, `.5` the 159 by 30 binding plate, `.8/.9` the 82 by 30 Off/On switches, and `.18` the 64 by 25 slider thumb. The finite ControlPanel wrapper supplies 92 glyphs, metrics `[14,4,29]`, and 39 kerning rows. | high |
| Tool provenance | read-only Mod Loader `08bfba9ef367f7b863848030d0a289dc31e33192`; wrapper SHA-256 `b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`; `decompile_targets.py` SHA-256 `899167ca42624e09f26d22233365631a6ee8b3d106e337e20b77574894e97465` | Existing tooling only; no Mod Loader file changed. | high |

### Presentation membership inventory

| Member | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| 600 by 700 shell and 70-pixel header/footer bands | settled layouts plus `MyQuickPanel_Render` | `exact-ported` | desktop geometry contract and matching capture |
| four `UI.17` frame corners | generated UI record 17 | `exact-ported` | shared native sprite adapter; no CSS crop constants |
| two mirrored `UI.18` side flourishes | generated UI record 18 | `exact-ported` | shared native sprite adapter and exact native anchors |
| dark cracked body, gold frame/header/footer treatment | settled captures and shared panel renderer | `exact-ported` | stock texture/paint composition, no invented generic dialog skin |
| title, section, row, value, and button type | finite ControlPanel bitmap wrapper | `exact-ported` | no OS-font visible Settings text; unsupported glyphs fail visibly |
| 44-pixel row plate | ControlPanel `.3` | `exact-ported` | shared row presentation across root, Controls, and Performance |
| slider track and thumb | ControlPanel `.4/.18` | `exact-ported` | range states retain semantic input with exact visible art |
| Off/On switches | ControlPanel `.8/.9` | `exact-ported` | exact record selected from authoritative Boolean and disabled alpha |
| navigation/action arrow | ControlPanel `.0` | `exact-ported` | every child-page action uses one shared arrow module |
| binding value plate | ControlPanel `.5` | `exact-ported` | complete keyboard rows share one value presentation |
| Done/Back footer | shared CPanel button, exact 300 by 41 HotRect | `exact-ported` | common footer module and semantic rectangle |
| title/gameplay/Dark Cloud contexts | same MyCPanel shell | `verified-already-at-parity` lifecycle; presentation re-proved | retained underlay and return behavior unchanged |
| Controls child native rows | complete native binding census | `exact-ported` presentation | one row vocabulary; web Chat/Cheats rows remain labeled extensions |
| Performance child native rows | complete native settings census | `exact-ported` presentation | supported rows use exact vocabulary; prior negative dispositions remain |
| Camera FOV, UI Scale, online, mobile UI, save transfer, Cheats, and browser notes | Website additions | `out-of-system` semantics; exact stock Settings presentation vocabulary | no false native attribution |
| Resolution, Login Info, Kid Mode, Enhanced Effects Off, Save Memory | prior explicit dispositions | unchanged | no inert rows restored merely for appearance |
| custom tutorial/mod/party/directory screens | no MyCPanel owner | `out-of-system` for this pass | owner-deferred |

### Recovered presentation contract

- Native coordinates are authored in a 1600 by 900 surface. The desktop shell
  is 600 by 700 at `(500,100)` with a 70-pixel header and a 300 by 41 centred
  footer control. Browser fit may clamp height and scroll content, but must not
  invent a different desktop proportion.
- Every visible Settings label comes from the finite ControlPanel bitmap font.
  Semantic HTML retains accessible copy but cannot paint a second OS-font label.
- Records `.3/.4/.5/.8/.9/.18/.0` remain distinct authored members. A CSS
  approximation cannot stand in for an extractable record.
- Browser-added rows use the recovered vocabulary without claiming native
  membership. Settings state, persistence, input, audio, renderer consumers,
  modal lifetime, and prior negative dispositions remain unchanged.

### Web implementation consequence

- Add a pure `native-settings-contract` beside the reusable catalog, pinning
  shell geometry, font, record membership, and row variants.
- Add one React Settings presentation module over `NativeUiSprite` and
  `NativeBitmapText`; move atlas-record knowledge out of `GameSettingsDialog`
  and `main-menu.css`.
- Recompose the existing semantic Settings controls through that module. Do
  not rewrite persistence, scene ownership, control actions, or custom-row
  semantics.
- Preserve mobile scrolling and minimum hit targets as explicit browser policy;
  desktop uses the exact 600 by 700 stock proportion.

### Validation contract

- Focused contract tests pin all shell coordinates, every required record and
  ControlPanel font metric, row membership, and prior negative dispositions.
- Mac Chrome at 1600 by 900 compares panel/corner/flourish/header/footer/row
  geometry and pixels against the retained stock captures. Title, gameplay,
  and Dark Cloud contexts must share one presentation.
- Controls and Performance journeys exercise slider, toggle, action, binding,
  Back, Done, focus, disabled, and scrolling states. Coarse-pointer 896 by 414
  retains fit, scroll, and at least 44-pixel semantic targets.
- Page, console, and failed-response arrays remain empty; the exact candidate
  passes `/opt/homebrew/bin/bash ./scripts/validate.sh` on the Mac mini.

### Implementation validation receipt

- `native-settings-contract.ts` now owns the 1600 by 900 design, 600 by 700
  shell, 70-pixel header/footer, 44-pixel row, ControlPanel font, and exact
  `.0/.3/.4/.5/.8/.9/.18` plus `UI.17/.18` membership.
  `NativeSettingsPresentation.tsx` projects those records through the shared
  native sprite, strip, plan, and bitmap-text modules.
- `GameSettingsDialog` retains all prior state, persistence, actions, context
  lifecycle, browser extensions, and negative dispositions, but its visible
  shell, headings, rows, sliders, binding plates, switches, action arrows, and
  footer now use the recovered vocabulary. Desktop geometry is exactly 600 by
  700; the coarse-pointer browser policy clamps only height and scrolls content.
- Mac Chrome desktop Settings passed title, Dark Cloud, Hub, and Boneyard
  contexts. The root exposed four action arrows, 15 row plates, four slider
  tracks, exact Off/On records, 28 ControlPanel bitmap-text runs, and exact
  `UI.17 x4 / UI.18 x2` shell art. The title capture hashes to
  `36c501a1670e23ee17c7b49832de567e6155088fd5fab01d1e842f69e5eff26c`.
- The 896 by 414 DPR-2 touch journey fit the 600 by 389.1875 clamped panel and
  exercised real touch changes on Sound `100 -> 0`, Music `100 -> 0`, Camera
  FOV `100 -> 75`, UI Scale `100 -> 75`, and Light Quality `100 -> 24` before
  applying the final values. Effective game music/sound returned `0.40/0.65`,
  Hub/Boneyard camera and renderer settings remained live, and errors were
  empty. The mobile title capture hashes to
  `c64f1e1ef79dc23e2b181cf24a8642ee5319b62fe2e90841c22fef2d4196ebb6`.
- Focused Settings/native-UI tests and the exact Mac canonical gate pass. The
  final gate includes 0 lint errors, every backend/frontend/desktop suite,
  production build, media policy, and bundle budget (`Game-CG_-oeee.js`,
  277,279 raw / 83,703 gzip bytes). Publication and deployment remain separate
  and were not requested.

## 2026-08-31 — Settings semantic ownership moved into the UI Kit

No native presentation fact changed. Entry 183's game-wide UI Kit reopening
removed a remaining web ownership split: the exact Settings records lived in
`native-ui/`, while the semantic shell, group, range, toggle, action, binding,
and static-row structures were private functions in `GameSettingsDialog`.

The semantic modules now live behind `native-ui/react.ts` as
`NativeUiSettingsPanel` and the `NativeUiSettings*` row family. The dialog owns
only Settings values, persistence, pages, browser extensions, and return
behavior. Save-transfer and mobile-layout actions use the same stock action row.
The complete desktop/mobile Settings journeys re-proved the prior exact record
counts, geometry, real-touch ranges, and empty error arrays; their current title
captures hash to
`d991afe1c307237317bb24ea5f12ab875bfaafee6c29defadcc5c29701b6bbd4`
and `fe9aa95e30ecc696a3337da2f3dd9d64daac5028596de526b2e265ae909ce93b`.

## 2026-09-02 — Reduced screen-flash accessibility extension

> **2026-09-02 Phasing correction:** fresh instruction recovery at
> `0x0054D9A1..0x0054DA1F`, `0x0052A0B0`, and sole helper `0x0063FEE0`
> proves row 15 never writes Region feedback. The earlier census mistook the
> Region vtable `+0x100` point-audio gain call for a screen flash. Phasing is
> outside this accessibility branch; its magenta BadGuys-53 traversal remains
> actor-local.

### Reported smell and parity question

- The owner reports that gameplay effects such as defensive Flash and Ring of
  Ice paint a bright near-white color over the whole screen and are difficult
  to look at. A persisted lowered-flash mode is requested in Settings.
- The stock behavior is already closed by entries 083, 101, 122, 123, and 287:
  one Region-owned RGBA lane is overwritten by ordered gameplay events, loses
  its stored alpha once per 100 Hz tick, and is painted after world/effects but
  below the HUD. The accessibility mode must not reinterpret that owner.
- Falsifiers are a local setting that changes authoritative events or protocol,
  changes flash color or duration, suppresses actor-local VFX/audio/camera
  feedback, affects only the two reported skills, misses a Hub region, or
  resets an existing deployed Settings record.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Settled native instruction evidence | entry 083, Region helper `0x00448600`, Region tick `0x0063EFC0`, Region render `0x0046EC80`; retail 0.72.5 SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Region owns one screen-fixed overwrite lane; point gain, RGBA, float32 decay, ordering, and the true category-2 writers are instruction-closed. Fresh row-15 recovery explicitly excludes Phasing. | high |
| Settled native sibling evidence | entries 101, 122, and 123 | Pike break, defensive Flash 53, and primary Ether Blast 14 also write or feed the same Region screen-feedback presentation. | high |
| Current Website causal trace | `game-settings.ts`, `GameSettingsDialog.tsx`, `MainMenuScene.tsx`, `HubScene.tsx`, `BoneyardScene.tsx`, `native-secondary-presentation.ts`, `hub-world-renderer.ts`, `boneyard-world-renderer.ts` at base `252ad56019e2e0e1eb2fd714fbf4d8c7783156b8` | Settings is persisted locally and passed live to both renderers. Both renderers consume the same native feedback state and assign its sampled alpha directly to one retained full-viewport white Graphics quad. | high |
| Current Website membership sweep | all `screenFlash` producers plus both `consumePrimaryEtherBlast` call sites at the same base | All gameplay full-screen flash producers converge before the two final alpha assignments. Actor-local sprite flashes and the Create-menu transition flash do not use the Region lane. | high |

No new native extraction is required: this is an explicitly designed browser
accessibility extension over a previously closed native owner. The stock lane
remains the identity branch and oracle.

### System boundary and membership inventory

Native/web system: the Region gameplay screen-feedback lane, every event that
writes it, each Region renderer that paints it, and the local Settings branch
that may reduce only its final presented alpha.

| Member (class/variant/scene/branch) | Native/current source | Disposition | Proof |
| --- | --- | --- | --- |
| Reduced Screen Flashes Off/default | stock Region lane; `DEFAULT_GAME_SETTINGS` | `verified-already-at-parity` | sampled alpha/color and exact float32 lifetime remain unchanged |
| Reduced Screen Flashes On | Website accessibility extension | `exact-ported as designed-not-observed` | final screen-quad alpha is `nativeAlpha * 0.2`; color and native lane state are unchanged |
| persisted current Settings record without the new key | deployed `solomon-dark-game-settings-v1` shape | `exact-ported` migration | record retains every existing value and gains `reducedScreenFlashes: false` |
| title, gameplay-pause, and Dark Cloud Settings contexts | shared `GameSettingsDialog` Performance page | `exact-ported as designed-not-observed` | one live toggle, same modal/Back/Done lifecycle in all contexts |
| primary Ether Blast 14 | entry 123; `consumePrimaryEtherBlast` | `exact-ported` | shared final-alpha policy covers the purple Region flash without changing charge/camera state |
| Call Leviathan 11 | entry 083 Region write census | `exact-ported` | shared point-gain flash path |
| Planewalker 12 and Plane Orb | entry 083 Region write census | `exact-ported` | shared fixed flash path, including Plane Orb alpha `.1` |
| Phasing 15 | entry 083 corrected instruction census | `out-of-system` (no Region screen flash; `+0x100` computes point-audio gain) | reduced-flash mode leaves its actor-local BadGuys-53 streak unchanged |
| Ring of Fire 21 | entry 083 Region write census | `exact-ported` | shared flash is reduced; separate `.25` camera magnitude is unchanged |
| Firewalker 23 | entry 083 Region write census | `exact-ported` | both toggle writes share the policy |
| Magic Storm 27 | entry 083 no-Region-write row | `out-of-system` (cloud-owned compositor, not the screen-feedback lane) | no invented reduction of local weather sprites |
| Prismatic Shock 30 | entry 083 five-color Region table | `exact-ported` | selected RGB is unchanged; only final alpha scales |
| Ring of Ice 35 | entry 083 Region write census | `exact-ported` | initial cyan-white overlay is presented at 20 percent of native alpha |
| Earthquake 41 | entry 083 Region write census | `exact-ported` | fixed green-white flash scales; separate displacement is unchanged |
| Raise Golem 45 | entry 083 no-Region-write row | `out-of-system` (no screen flash) | no new presentation branch |
| Stoneskin 46 | entry 083 Region write census | `exact-ported` | fixed white flash shares the policy |
| Teleport 48 source and destination | entry 083 ordered Region writes | `exact-ported` | destination still overwrites source; both use the final-alpha policy |
| Magic Circle 49 | entry 083 Region write census | `exact-ported` | age-two write and lifetime remain native |
| Magic Trap 50 initialization and trigger | entry 083 selector table and ordered writes | `exact-ported` | selector RGB, fixed/point gain, and trigger overwrite remain native |
| Dampen 51 | entry 083 no-Region-write row | `out-of-system` (actor-local additive VFX only) | no actor sprite suppression |
| defensive Flash 53 | entry 122 | `exact-ported` | white point-gain screen overlay scales; all 12 actors, Dazzle, displacement, and audio remain unchanged |
| Magic Shield 54 apply and Explosive Shield break | entry 083 ordered Region writes | `exact-ported` | both cyan-white writes scale; absorb/explosion/camera owners remain unchanged |
| Acid Rain 72 | entry 083 no-Region-write row | `out-of-system` (weather actors only) | no weather attenuation |
| Fire Wall 73 | entry 083 Region write census | `exact-ported` | point-gain orange overlay shares the policy |
| Ether Drain 74 | entry 083 Region write census | `exact-ported` | first scale-in write shares the policy |
| Call Comet 76 | entry 083 Region write census | `exact-ported` | long white fade keeps its 201-update retirement while every visible alpha is multiplied by `.2` |
| Turn Undead 77 | entry 083 no-Region-write row | `out-of-system` (no screen flash) | no unrelated effect change |
| Mindstar 78 | entry 083 Region write census | `exact-ported` | both toggle writes share the policy |
| Regenerate 79 | entry 083 Region write census | `exact-ported` | both toggle writes share the policy |
| Ether pike-break equipment response | entry 101; `emitNativePlayerScreenFlash` | `exact-ported` | fixed white Region write scales; debris/audio/knockback remain unchanged |
| Courtyard Region | `hub-world-renderer.ts`, `hub:courtyard` lane | `exact-ported` | live setting changes the retained quad only |
| Mortuary private Region | `hub-world-renderer.ts`, region-keyed lane | `exact-ported` | no cross-room replay or lane loss |
| Library private Region | `hub-world-renderer.ts`, region-keyed lane | `exact-ported` | no cross-room replay or lane loss |
| StoreRoom private Region | `hub-world-renderer.ts`, region-keyed lane | `exact-ported` | no cross-room replay or lane loss |
| Office private Region | `hub-world-renderer.ts`, region-keyed lane | `exact-ported` | no cross-room replay or lane loss |
| Boneyard modes 0, 1, and 2 | `boneyard-world-renderer.ts`, run-keyed lane | `exact-ported` | one shared final-alpha policy across every Arena mode |
| transition cover, HUD, modal UI, and actor-local hit/impact flashes | existing later painters and independent sprite owners | `out-of-system` (not Region full-screen flash) | stage order and local effect alpha remain unchanged |
| Create-menu entry/selection flash | `create-menu-renderer.ts` | `out-of-system` (menu transition owner, not a gameplay effect) | current reduced-motion contract remains its owner |

There is no `blocked-by-platform` member. The browser can scale the retained
screen quad's alpha directly.

### Native ownership thread and recovered contract

- Authoritative simulation and protocol continue to produce exact event RGBA,
  point attenuation metadata, event tick, world key, and overwrite order.
- `NativeSecondaryScreenFeedbackPresentation` continues to own trigger-time
  local point gain, float32 decay, late-event catch-up, region/run identity,
  and the separate camera magnitude/displacement lanes.
- The local renderer setting is read only after `sample(tick)`. Off returns the
  sampled native alpha exactly. On multiplies that final alpha by `0.2` for the
  retained viewport quad. It does not feed the scaled value back into lane
  state, so timing and later overwrites cannot drift.
- Both Hub and Boneyard update this display policy live through their existing
  `setSettings` lifecycle. Region replacement and renderer destruction retain
  their existing state and resource teardown.
- The preference never enters authoritative save data, session protocol, or
  host state. Each observer chooses its own local presentation independently.

### Nearby-system findings

- The Create-menu white rectangle is a transition presentation already gated
  by the separate reduced-motion contract. It does not consume Region events
  and is intentionally outside this gameplay-flash setting.
- Camera Shake remains orthogonal. Turning it off suppresses camera magnitude,
  displacement, and world shake while retaining full native screen flash;
  Reduced Screen Flashes suppresses only screen-quad alpha and retains camera
  feedback. Enabling both composes without a hidden shared gate.

### Confidence and open questions

- Confirmed: native Region ownership, complete category-2 writer census,
  defensive Flash, Ether Blast, pike-break siblings, Hub/Boneyard consumers,
  ordering, timing, persistence owner, and live renderer-setting seam.
- Designed-not-observed: the `0.2` accessibility multiplier and Settings label.
  They are Website policy, not attributed to retail Solomon Dark.
- Unknown: none material. A different preferred reduction strength would be a
  product choice, not missing native evidence.

### Web implementation consequence

- Add `reducedScreenFlashes` to the strict local Settings record with default
  Off and a one-step migration for every currently deployed complete record.
- Expose `REDUCED SCREEN FLASHES` beside Camera Shake under Special Effects.
- Put the alpha policy in one pure shared presentation function and consume it
  at both final Region quad assignments. Do not edit any event producer,
  protocol type, simulation rule, flash color, decay, or actor-local VFX.

### Validation contract

- Focused Settings contracts: default Off, exact persistence, current-record
  migration, corrupt-type rejection, and `1 -> 0.2` alpha policy while Off is
  the identity branch.
- Focused presentation contract: white Flash/Ring-of-Ice-equivalent, colored,
  partial point-gain, long-decay, and null overlays preserve color/lifetime and
  receive the same display multiplier; camera magnitude/displacement samples
  are unchanged.
- Renderer/source contract: Hub and Boneyard setting picks, live update paths,
  diagnostics, and canvas data expose the actually presented alpha.
- Mac Chrome journey: toggle the row in gameplay Settings, inject or naturally
  trigger one white Region flash, prove displayed alpha changes from `1` to
  `0.2` without changing color, camera state, or lane lifetime, reload and
  prove persistence, then repeat the consumer check in the sibling renderer.
  Page, console, and failed-response arrays must be empty.
- The exact candidate must pass `/opt/homebrew/bin/bash ./scripts/validate.sh`
  on the Mac mini.

### Implementation validation receipt

- Base `252ad56019e2e0e1eb2fd714fbf4d8c7783156b8` remained equal to current
  `origin/main` on both machines after validation. The local and Mac task
  worktrees had byte-identical SHA-256 manifests for all 11 changed files
  before the gates ran.
- `game-settings.ts` now owns `reducedScreenFlashes`, default Off, strict Boolean
  validation, normalization, and migrations for both the immediately previous
  complete record and the older pre-online record. `GameSettingsDialog` paints
  `REDUCED SCREEN FLASHES` in the shared Special Effects page.
- `presentNativeSecondaryScreenOverlay` is the only reduction rule. Hub and
  Boneyard call it after sampling the native Region lane and expose the actual
  presented alpha in their existing frame diagnostics. Both scene setting
  subscriptions update the rule live. No simulation, event, protocol, audio,
  camera, actor, color, point-gain, overwrite, or decay code changed.
- The final isolated Mac canonical gate exited zero. It included backend build
  and 19 backend contracts, lint with the same 11 existing warnings and zero
  errors, the 344-test prerequisite set, the 1,795-test broad game set, every
  remaining focused suite, four desktop tests, production build, media policy,
  and bundle budget. The built game entry was `Game-Bj0Et5Cx.js`, 265,204 raw
  and 80,811 gzip bytes. An earlier gate overlapped a foreign heavyweight test
  process and produced seven unrelated host/supervisor timeouts; the isolated
  rerun passed those tests and the complete gate.
- Mac Chrome at 1600 by 900 returned `status: ok`, empty page/console/failed-
  response arrays, persisted the toggle On, and presented injected white
  Region flashes at `0.1880000114440918` in Hub and `0.19200000762939454` in
  Boneyard while both renderers reported mode `true` and color `0xffffff`.
  Those samples are below the `0.2` ceiling because the authoritative lane had
  already consumed several 100 Hz decay ticks before the browser frame.
- Mac Chrome's DPR-2 touch journey at 896 by 414 also returned `status: ok` with
  empty errors. The clamped 600 by 389.1875 Settings panel kept the new row
  usable and persisted; Hub and Boneyard each presented the same white test
  flash at `0.19000000953674318`, with mode `true`. Existing real-touch range,
  audio, FOV, UI-scale, lighting, shadow, and camera-shake checks also passed.
- Desktop title/Dark Cloud/Boneyard capture SHA-256 values were respectively
  `0ee8487fcbc532bb2e64196ceced612529cc78c6e9ec058348e40b861df810d4`,
  `e04f1a527b1e605529a68485e09b2acc1907d11422c46ddfe731de80598844fc`,
  and `d5cccb25c8df49677d22c482eb73c7eea8fd19006788e6c77e446467b8d36ab7`.
  Mobile equivalents were
  `669a95317385c8842099449298f7414f34201491d477cbbc29efed7fcd12448e`,
  `bb2b8a753033a9dafb0bd59d5fe0f452f341f68228b8bf7cfad86e7e634dd89c`,
  and `44aaeb1bed5efaf7bf20c2edcb837634bd6a9126d65ffd4e0dfc977b8757b1ea`.
  They were temporary acceptance evidence and were deleted after these results
  were recorded.
- No push, deployment, or production restart was requested or performed. The
  focused local worktree remains the handoff owner.
