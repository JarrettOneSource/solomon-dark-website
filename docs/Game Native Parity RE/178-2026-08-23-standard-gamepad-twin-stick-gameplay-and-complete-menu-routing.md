# 2026-08-23 — Standard-gamepad twin-stick gameplay and complete menu routing

## Reported smell and parity question

- Reported web behavior: the `/game` README advertises a standard controller,
  but the shipped adapter only reads left-stick/D-pad movement. The title and
  Create flow have partial A/B navigation; right-stick aim, held casts,
  quickbar access, Start-to-pause, Hub interaction, controller lifecycle
  sealing, and gameplay-modal navigation are absent.
- Stock behavior to preserve: the native fixed-tick player consumes normalized
  movement, torso-anchored aim, and independent held primary/secondary levels;
  modal/HUD ownership blocks the lower world and drops held input at a barrier.
  Retail has no complete gamepad action path or menu focus graph, so button
  assignment and focus traversal are explicitly browser design, not invented
  native behavior.
- Reproduction inputs/scenes: standard-mapped Xbox/Steam-Deck layout at Title,
  Play, Create, Hall, Dark Cloud, Join Party, all settings pages and dialogs,
  Hub world/traders/player cards/party/map/inventory/skills/pause, Boneyard
  movement/combat/quickbar/inventory/skills/pause, level-up, and Game Over.
- Falsifiable questions: a rightward right stick must retain heading after
  release; RT must preserve Earth/Frost press-hold-release behavior; controller
  quickbar selection must address every slot `0..7`; Start must open the same
  pause owner as Escape; A/B must operate the active modal without also moving
  or casting; held barrier-time input must remain inert until a neutral sample
  and a fresh edge; disconnect must publish idle rather than latch movement or
  spells.
## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Native instructions and live goldens | retail `SolomonDark.exe` SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; `Mod Loader/docs/reverse-engineering/native-input-model.md` at `831960855dc908972e2cfae2fa5cc487f64b24ef`; `Input::Refresh` `0x00429820`, control synthesis `0x005C6D60`, `Game::Tick` `0x005D7EF0`, `PlayerActor::Tick` `0x00548B00` | Native owns normalized movement, aim reanchored at `project(player) + (0,-25)` screen pixels, and held cast levels on the nominal 10 ms tick. The closed negative census found only a partial joystick-axis substrate: no complete gamepad button preset, cast/interact mapping, or menu navigation. | high |
| Owner-approved browser contract | `Mod Loader/docs/browser-rebuild-roadmap.md` section 4.2 and `webgame/input/gamepad-producer.ts` at `83196085` | Standard-gamepad policy is twin-stick: left movement, right retained aim, RT primary, face-button quickbar cast, A interact, D-pad/left-stick menu navigation, B back, Start pause, and LB/RB previous/next. This is `DESIGN_NOT_OBSERVED`. | high |
| Existing Website causal trace | Website `d9dace8cfc6a32400b9b0491d64380ca010569f2`; `input/movement-input.ts`, `input/gameplay-input.ts`, `input/gamepad-menu-navigation.ts`, `MainMenuScene.tsx`, `HubScene.tsx`, `BoneyardScene.tsx` | Movement polls axes `0/1` and D-pad `12..15`; menu polling handles A/B and movement directions only while a narrow MainMenu effect is mounted. Gameplay never reads axes `2/3`, trigger `7`, face/center/shoulder buttons, or controller disconnect/barrier edges. | high |
| Existing Website presentation seam | `gameplay-pointer.ts`, `PlayerCharacterInput`, `GameHud`, `SkillQuickbar`, `GameplayPauseMenu`, and semantic HTML overlays at `d9dace8c` | The correct shared seams already exist: `projectNativeStickAim`, held `cast.primary/quickbar`, eight HUD slots, scene pause/inventory/skill callbacks, and real focusable buttons/inputs. No controller-only simulation or virtual cursor is needed. | high |
| Browser standard | W3C Gamepad Working Draft and editor draft, retrieved 2026-08-23, `https://www.w3.org/TR/gamepad/` and `https://w3c.github.io/gamepad/` | The canonical `standard` mapping fixes axes `0..3` and buttons `0..16`; axes/buttons are polled levels. `getGamepads()` may stay empty until a gamepad gesture and is permission-policy controlled, so polling must tolerate no exposed pad without treating it as an error. | high |

## System boundary and membership inventory

Native system: browser standard-gamepad producer and focus router, from
Gamepad-API polling through the existing device-independent player/menu seams;
simulation, spell rules, renderer ownership, and network protocol are consumers
but not controller-specific owners.

| Member (class/variant/scene/branch) | Native/design source | Disposition | Proof |
| --- | --- | --- | --- |
| keyboard/mouse/touch sibling producers | native input model plus current browser adapters | `verified-already-at-parity` | existing focused input and production touch receipts remain required |
| gameplay left stick and D-pad | owner section 4.2 plus existing Website movement adapter | `verified-already-at-parity` | radial movement/D-pad contracts and Steam Deck journey; outer dead-zone correction required by this pass |
| gameplay right stick and released-direction retention | section 4.2; torso anchor from `0x005D7EF0` | `exact-ported` | focused retained-aim contract plus Mac Chrome right-stick heading `6` |
| RT primary press/hold/release | section 4.2; native primary level | `exact-ported` | held-level unit contract plus distinct production-wire `primary:true` / `primary:false` edges |
| X quickbar cast plus LB/RB slot selection `0..7` | section 4.2 face-button/HUD-order rule; Website eight-slot quickbar | `exact-ported` browser policy | held-slot stability/wrap tests and Mac browser assertion of every HUD slot `0..7` |
| A interact | section 4.2; native first-hit interact verb | `exact-ported` browser policy | nearest Hub trader/player contracts; controller A enters the host map action without a world cast |
| View inventory, Y skills, Start pause | native inventory/skills/menu actions plus section 4.2 Start mapping | `exact-ported` browser policy | edge-only tests and Hub/Boneyard production modal round trips |
| Title/Play/Create/Hall/Join Party/Dark Cloud roots | G11 focus model, `DESIGN_NOT_OBSERVED` | `exact-ported` browser policy | one-press root/play/Create browser path plus persistent-root/static focus contracts |
| settings root/controls/performance in title, Dark Cloud, and gameplay | G11 focus model | `exact-ported` browser policy | range/toggle unit contracts and Boneyard Pause -> Settings controller round trip |
| Hub trader/inventory/dye, player card, party settings, Boneyard picker | native modal-first routing plus semantic web overlays | `exact-ported` browser policy | explicit Back-owner census; production Inventory B dismissal in both scenes |
| gameplay Pause Menu | native Pause Menu rows plus controller Start/B/A policy | `exact-ported` browser policy | Hub Start/B resume and Boneyard Start/D-pad/A Settings selection |
| Skill Book, compact HUD selector, and level-up Skill Picker | native modal surfaces plus G11 dynamic spatial focus | `exact-ported` browser policy | explicit Back policies, source census, and Hub/Boneyard Y/B Skill Book journeys; Skill Picker intentionally ignores B |
| Game Over prompt | native prompt input-ready gate | `exact-ported` browser policy | disabled-gate/custom-navigation-root source contract plus native Game Over readiness tests |
| loading, fade, remote-pause waiting, blur/hidden/pagehide, disconnect | native/loader blocking ownership and browser lifecycle | `exact-ported` | neutral-rearm unit contracts; held-across-load delta `0`; fresh movement `56.36` world units |
| multiple connected standard pads | browser producer ownership | `exact-ported` browser policy | idle-first/active-later unit contract and retained indexed owner until disconnect |
| raw/unmapped devices (`mapping !== "standard"`) | W3C exposes vendor-specific ordering without a canonical map | `blocked-by-platform` | predicted difference: requires browser/Steam Input remapping to `standard`; arbitrary raw indices are not guessed |
| player name, Party ID, search, and chat text composition | W3C Gamepad has buttons/axes, not a text-composition API | `blocked-by-platform` | real HTML inputs remain focusable so the platform keyboard can compose text; a bare gamepad cannot type characters |
| haptics | no native controller/feedback path in the closed census | `out-of-system` (no native feedback member to mirror) | no vibration side path is introduced |

## Native ownership thread

- Owner and construction path: retail `Input` refreshes before `Game` and
  `PlayerActor` on the fixed graph. The browser match is one standard-gamepad
  state owner per active scene plus one persistent menu router above all scene
  roots; both feed existing semantic state/callbacks.
- Upstream state producers/callers: `navigator.getGamepads()` standard axes and
  buttons, with the first active mapped controller retained until disconnect.
  Keyboard, mouse, and touch remain independent sibling producers.
- State representation and transitions: radial sticks use inner `.20` and
  outer `.95`; movement keeps analog magnitude, aim keeps normalized direction;
  primary and quickbar are held levels; actions and slot cycling are rising
  edges. A blocked/interrupted owner clears all lanes and requires a neutral
  controller sample before accepting a fresh level or edge.
- Downstream consumers/callees: `PlayerCharacterInput` and the authoritative
  session remain the only gameplay seam. Scene callbacks open the existing Hub
  interaction, inventory, skill, map, and pause owners. DOM `.click()` and
  focus operate only inside the active menu/modal root.
- Sibling systems sharing ownership or data: GameHud/SkillQuickbar,
  `projectNativeStickAim`, loading seals, GameplayPauseMenu, GameSettings,
  SkillBook/SkillPicker, Game Over, party/mod dialogs, and text fields.
- Entry, interruption, reset, and teardown: no pad is exposed before its first
  browser-recognized gesture; initial menu input may select the default action
  on one press. Scene/modal transitions retain button-edge history so one held
  A cannot activate two screens. Blur, hidden, pagehide, blocking, disconnect,
  and destroy publish idle and require neutral before rearming.

## Recovered behavioral contract

- Timing/ticks/thresholds: gamepads are polled at the presentation cadence and
  publish current held levels to the existing authoritative input stream. No
  controller timer changes native 100 Hz spell or movement behavior. Menu
  repeat retains the existing 320 ms first delay and 110 ms interval.
- Geometry/transforms/coordinate spaces: left/right stick axes are standard
  screen directions. Right aim reuses `projectNativeStickAim`, including the
  exact 25-pixel torso offset and viewport-derived reach.
- Render/hit/collision/traversal order: active modal roots trap focus and hide
  their underlay from controller navigation. With no modal, Hub/Boneyard D-pad
  and left stick remain gameplay movement. Controller quickbar selection is a
  local HUD highlight only; collision and painter order are unchanged.
- Assets/audio/randomness: no assets, audio, RNG, or controller-specific spell
  presentation. Existing action audio follows the same clicked callbacks.
- Input/network authority/replication: only ordinary player input and existing
  action messages cross the network. No gamepad identity, button index, focus,
  or selected local quickbar slot enters protocol state.
- Boundary and failure behavior: unsupported/unmapped pads are ignored without
  hiding keyboard/touch/mouse. Missing permission/exposure behaves as no pad.
  Controller-held input during a blocked period is dropped, never queued.

## Nearby-system findings

- Durable finding: the prior device smoke proved only Title/Create A and
  movement; its repeated double-A pulses encode the current bug where the first
  confirm merely focuses the default instead of activating it.
- Evidence: `smoke-game-devices.mjs` pulses A twice at each menu step, while
  `confirm()` only calls `focus()` when no active element exists.
- Why it matters or may matter later: a controller can appear absent even
  though axes work, and a held A may be sampled again after a React navigation
  effect remount. One persistent router plus edge history closes both failures.
- Native report/catalog also updated: no. `native-input-model.md` already owns
  the complete native negative census and exact input facts; this pass adds no
  executable address or retail mapping.

## Confidence and open questions

- Confirmed: native input owner/order, absence of a complete retail gamepad
  route, owner-approved twin-stick mapping, W3C standard indices, current web
  omissions, all semantic action seams, and lifecycle/barrier requirements.
- Inferred: none in the authoritative simulation path.
- Unknown: vendor-specific raw controller layouts and whether a platform shows
  its software keyboard after focusing a text field. Both are platform-owned
  and explicitly represented above rather than guessed.
- Next falsifying probe if the unknown becomes material: capture the reported
  device's `mapping`, axis/button counts, browser/OS, and Steam Input profile;
  add a named adapter only after that mapping is stable evidence.

## Web implementation consequence

- Correct owner/module: add one stateful standard-gamepad gameplay producer
  beside `movement-input.ts`; extend the existing persistent menu router rather
  than create scene-specific button listeners.
- Shared model change: merge controller aim/cast levels into
  `BrowserGameplayInput`, emit edge-only scene actions, and expose the local
  selected quickbar slot to the existing HUD.
- Stock behavior preserved: movement normalization, torso aim, primary and
  secondary fixed-tick semantics, modal first-hit ownership, spell simulation,
  network authority, and every mouse/keyboard/touch path.
- Browser-specific approximation: fixed standard-gamepad button assignment,
  focus graph, quickbar selection highlight, and platform keyboard handoff are
  `DESIGN_NOT_OBSERVED` browser policy.
- Symptom patch or obsolete path to remove: the scene-dependent gamepad menu
  effect and its double-confirm acceptance sequence.

## Validation contract

- Focused automated test: standard-only selection, later-pad activation,
  `.20/.95` radial mapping, retained right aim, RT/X held levels, LB/RB `0..7`
  wrap and held-slot stability, A/Y/View/Start edges, disconnect/blocked neutral
  rearm, one-press default confirm, modal-only gameplay routing, B dismiss, and
  LB/RB menu traversal.
- Playwright or runtime journey: a synthetic standard Steam Deck pad alone must
  traverse Title -> Play -> Create -> Hub with one A per choice; move with stick
  and D-pad; interact/open map; reach Boneyard; aim right, hold/release RT, cycle
  and cast quickbar, open/close inventory, skills, pause/settings, pass a
  level-up choice, and continue Game Over. Capture page, console, and failed
  response arrays.
- Stock-versus-web comparison: compare emitted movement/aim/cast state to the
  native G14 contract and controller focus to the declared G11 browser design;
  do not claim a nonexistent retail gamepad layout.
- Measurable acceptance criteria: right aim produces heading index `6`, primary
  and selected-secondary levels each rise/fall once, all eight slots are
  selectable with visible HUD state, blocked held input produces zero post-tail
  motion/cast, every interactive modal has a controller path, and all error
  arrays are empty on the exact final candidate.

## Implementation validation receipt

- `input/standard-gamepad.ts` owns standard mapping, controller selection,
  `.20/.95` radial lanes, retained aim, cast/action edges, eight-slot selection,
  disconnect, and neutral rearm. `gameplay-input.ts` merges those levels into
  the existing player contract. The persistent menu router owns A/B,
  D-pad/stick, bumpers, active-modal trapping, and one-press defaults.
- Hub/Boneyard route A/Y/View/Start through their existing action owners and
  expose a local-only gold quickbar selection. Every dismissible modal now has
  an explicit Back action; the rebased compact selected-skill selector is
  included. No simulation or protocol field is controller-specific.
- Before `origin/main` advanced, the byte-identical Mac candidate at
  `/Users/jarrett/codex-acceptance/controller-support-final-20260823/website`
  passed the then-current canonical gate and the complete controller/mobile
  browser journey. Its reviewed evidence remains under the sibling
  `evidence/r1/` directory; `devices.log` SHA-256 is
  `af46cff1b814fff13dd5040ee14c7a627985b0b40a2339493297ccdb81726dd9`.
- After rebasing through Hagatha `ee7f8d44`, durable saves `1a195086`, and
  inventory interactions `e3d50b0f`, the owner explicitly directed final
  validation on native Windows outside WSL.
  All `4,788` tracked files in
  `C:\Users\User\codex-acceptance\controller-support-publish-20260823-r3\website`
  byte-match the candidate. The complete canonical gate passes every backend,
  frontend, desktop, lint, architecture, and production-build member with zero
  failures; the retained log carries the exact suite totals. Media policy and
  the game bundle budget also pass.
- Rebased browser acceptance exposed one scope-barrier race: if a gameplay
  modal appeared after the router had already observed neutral, a fresh Back
  edge on its first visible frame could be discarded as held input. The router
  now records no-modal samples and requires rearm only when input was active
  both before and at the scope change. Held-across-modal input remains blocked;
  the focused fresh-edge/held-edge/neutral matrix passes `10/10`.
- Native Windows Chrome `151.0.7922.170` production controller journey passes
  Title -> Play -> Water/Arcane Create -> Hub -> Boneyard with one A per
  confirm, stick and D-pad movement, all eight quickbar slots, modal round
  trips, right-stick heading `6`, zero held-across-load travel, and fresh
  post-neutral Boneyard movement. Page, console, and failed-response arrays are
  empty. Evidence is retained under
  `C:\Users\User\codex-acceptance\controller-support-publish-20260823-r3\evidence\windows`.
- Rebase resolution preserved the complete selected-spell HUD, modal-audio,
  invitation-cue, world-speech, Hagatha, durable-save, and inventory-interaction
  sections before this controller section; Boneyard diagnostics retain both
  Hagatha Seeker segments and controller heading, save-profile routing remains
  intact, and every inventory Done owner keeps controller Back. The focused
  commit remains one commit atop current `origin/main`.
- The owner explicitly authorized a normal fast-forward push to `main` on
  2026-08-23 after the rebased exact-tree gate and browser journey pass.
  Deployment was not requested and remains a separate operation.
- Remaining implementation explicitly out of scope: raw vendor layouts,
  gamepad-only text composition, and haptics for which retail has no owner.
