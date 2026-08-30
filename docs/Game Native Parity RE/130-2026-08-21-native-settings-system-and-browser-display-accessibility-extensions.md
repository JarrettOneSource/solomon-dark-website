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
