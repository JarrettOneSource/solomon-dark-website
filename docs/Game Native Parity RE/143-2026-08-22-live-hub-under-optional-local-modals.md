# 2026-08-22 — Live Hub under optional local modals

## Reported smell and parity question

- Reported web behavior: opening the Pause Menu or NPC dialogue in the Hub
  appears to pause the game. The requested Website behavior is for the Hub to
  keep advancing beneath either surface.
- Stock behavior to preserve where applicable: the retail Pause Menu still
  supplies the exact SimpleMenu presentation and action flow. Active
  Boneyard/Arena gameplay still uses the recovered region suspension owner.
- Requested web exception: the shared multiplayer Hub is a continuously live
  social world. Its optional, participant-owned Pause Menu and NPC surfaces
  block only the initiating participant's gameplay input; they do not acquire
  or advertise an authoritative world barrier.
- Reproduction inputs/scenes: Escape in every Hub region, Resume, Settings,
  Leave, all four reachable trader dialogues and services, a second Hub
  participant, a raw legacy Hub pause request, and Escape in an active
  Boneyard.
- Falsifiers: a constant Hub tick or canvas frame under either surface; a Hub
  peer receiving `server-gameplay-pause`; a raw Hub `pause-menu` request
  freezing the host; a Boneyard Pause Menu failing to freeze its party; or a
  modal leaking movement/cast input from its owner.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Existing retail instructions | retail 0.72.5 SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; `Gameplay::Tick 0x005D7EF0`, Pause action `0x0058EA50`, `SimpleMenu_ModalLoop 0x005ABF10`, suspension helper `0x005CBD40`, scene dispatcher `0x00427800` | Retail ESC owns a nestable active-region hold. That truth remains the Boneyard contract; the requested live-Hub rule is an explicit Website multiplayer exception, not a contrary claim about the executable. | high |
| Existing native Hub trace | `Mod Loader/docs/reverse-engineering/native-hub-and-economy.md`; NPC action `0x00501800`, common lifetime `0x00505010`, service dispatcher `0x00514A20`, Chat vtable `0x0079061C` | NPC dialogue is an actor-owned active-UI lifetime with back/completion/range teardown; a service replaces the dialogue rather than stacking under it. | high |
| Current web causal trace | Website `origin/main` `8b83ac328ed9bb82539bc6f7fa3e75f1b83fc476`; `MainMenuScene.tsx`, `HubScene.tsx`, `HubInventoryUi.tsx`, `game-client-session.ts`, `game-host.ts`, `shared-game-worlds.ts` | NPC dialogue/service is already scene-local and sends no gameplay-pause intent. Hub Escape instead sends source `pause-menu`; the host stores `sharedHubGameplayPause`, broadcasts it to every Hub client, and passes `hubPaused=true`, holding the entire Hub. | high |
| Existing web pause closure | this ledger's 2026-08-20 pause entry and 2026-08-21 book-pause entry; `native-gameplay-pause.md` | The three exact menu rows/rendering and the Boneyard/Inventory/SkillScreen authoritative barriers are already closed independently. | high |

This pass recovers no new retail address, table, or asset fact. The Mod Loader
reports remain the native authority; the live-Hub exception is documented only
in this Website ledger.

## System boundary and membership inventory

Web system: admission and lifetime of optional participant-owned modal surfaces
while the participant is in a Hub world. It begins at the local UI input edge,
blocks that participant's gameplay lane, keeps the Hub simulation and renderer
live, and ends at the surface's own Resume/Done/back/range/teardown action.

| Member (scene/branch/variant) | Owner/source | Disposition | Proof |
| --- | --- | --- | --- |
| Hub Escape / configurable `OPEN MENU` edge | `HubScene` -> `MainMenuScene`; native rows from `0x0058EA50` | `exact-ported` to requested live-Hub policy | local menu opens with no client pause intent or peer pause message; Hub tick and pixels advance |
| Hub Pause Menu Resume | local Hub menu owner | `exact-ported` | closes only the local surface and leaves the already-live Hub uninterrupted |
| Hub Pause Menu Settings / Done | local Hub menu owner -> gameplay settings | `exact-ported` | settings replaces the menu locally; Hub tick continues through both surfaces and Done releases no host barrier |
| Hub Pause Menu Leave | local Hub menu owner -> session teardown | `verified-already-at-parity` | existing Leave path destroys only the departing session; shared Hub continues for peers |
| Hagatha dialogue and charm service | `HubInventoryUi`, trader `hagatha` | `verified-already-at-requested-policy` | no pause intent; owner input blocked; tick/render continue |
| Fomentius dialogue and potion service | `HubInventoryUi`, trader `fomentius` | `verified-already-at-requested-policy` | same contract |
| Luthacus dialogue and storage service | `HubInventoryUi`, trader `luthacus` | `verified-already-at-requested-policy` | same contract |
| Shlorio dialogue and dowsing service | `HubInventoryUi`, trader `shlorio` | `verified-already-at-requested-policy` | same contract including Done/back teardown |
| Dialogue intro, accelerated text, choices, prices, service replacement, Done/back/range close | `NativeHubSurface`, `DialogueActions`, `0x00505010`/`0x00514A20` lifecycle evidence | `verified-already-at-requested-policy` | complete surface-state contract plus browser journey; no branch acquires gameplay pause |
| Dedicated and shared Hub simulation | singleton/shared Hub host tick | `exact-ported` to requested live-Hub policy | tick and participant/world state advance while local Pause Menu or dialogue is open |
| Hub world presentation under local modal | `HubScene` presentation loop and renderer | `exact-ported` to requested live-Hub policy | `data-presentation-paused=false` and changing WebGL frame diagnostics under both surfaces |
| Owner movement, cast, pointer, and touch input under a local modal | `HubScene.modalOpen`, root `sceneInputBlocked`, browser gameplay input | `verified-already-at-parity` | stopped input is sent/held for the owner; UI input does not leak to the world |
| Raw/legacy `pause-menu` request while requester is in Hub | authenticated client and host admission gates | `exact-ported` to requested live-Hub policy | client suppresses it; host independently rejects it; no pause state/message/tick hold |
| Hub InventoryScreen and SkillScreen | separate actor-book sources `inventory` and `skill-book` | `out-of-system` (separate optional-book policy explicitly closed on 2026-08-21) | existing source-qualified authoritative pause tests remain unchanged |
| mandatory level-up picker | `levelUpBarrier` | `out-of-system` (mandatory cohort barrier, not an optional local modal) | existing no-tick barrier and live-background presentation tests remain unchanged |
| Hub chat, player card, party controls, and Boneyard picker | independently owned Hub UI surfaces | `out-of-system` (no Pause Menu or NPC dialogue owner) | existing local input-routing contracts |
| active Boneyard/Arena Pause Menu, Settings, peer wait, late join, owner disconnect | party/dedicated authoritative pause owner | `verified-already-at-parity` | existing host/client/presentation tests plus Chrome Boneyard hold journey |
| title, Create, loading, Game Over, loadout, Dark Cloud | application/session surfaces outside a Hub world | `out-of-system` | existing admission gates and independent local menu owners |

There are no `blocked-by-platform` members. The browser can keep a WebGL world
advancing behind a modal while routing input exclusively to that modal.

## Ownership thread and recovered/requested contract

- `HubScene` owns the Escape edge and NPC proximity/hit admission. It must
  report Pause Menu intent to the root UI owner without entering the network
  pause lane. `HubInventoryUi` continues to own dialogue/service state locally.
- `MainMenuScene` owns the local Hub Pause Menu and its Settings handoff. That
  state participates in input/chat exclusion but never in
  `presentationPaused` and never becomes `GameplayPauseState` in the session.
- `game-client-session` rejects an attempted Hub `pause-menu` request before
  transport. `game-host` independently rejects the same authenticated legacy
  or modified-client request before first-owner arbitration.
- The Boneyard path continues to use the existing authoritative
  `GameplayPauseState`, party scoping, peer waiting presentation, no-timeout
  hold, disconnect release, input clearing, and no-catch-up deadline reset.
- A local Hub modal stops only its owner's movement/cast lanes. Hub actors,
  other participants, collisions, NPC gestures, particles, clocks, audio
  event production, snapshots, and WebGL presentation keep advancing.

## Confidence and open questions

- Confirmed: current client/host pause writers and readers; complete web trader
  surface membership; retail Pause/Boneyard suspension owner; Hub dialogue
  active-UI lifetime; and the requested Hub-local authority boundary.
- Inferred: none used for implementation.
- Unknown: none material. This is an explicit Website multiplayer product rule
  where it differs from retail's single-player Pause Menu suspension.

## Web implementation consequence

- Add a root-owned local Hub Pause Menu state and use the existing exact
  `GameplayPauseMenu` renderer with a local owner record.
- Include that local state and its Settings child in input/chat exclusion, but
  exclude it from host pause requests and Hub presentation suspension.
- Reject Hub source `pause-menu` in both the client session and authoritative
  host. Do not change protocol shape or add a compatibility source.
- Preserve the existing dialogue/service code path; add regression evidence
  proving it stays live rather than introducing a second pause mechanism.
- Leave InventoryScreen, SkillScreen, mandatory picker, and every Boneyard
  pause branch unchanged.

## Validation contract

- Automated: client sends no Hub `pause-menu` message; host ignores a raw Hub
  request without broadcasting or holding the tick; MainMenu mounts a local
  Hub menu, blocks input, and does not mark Hub presentation paused; all four
  dialogue/service variants remain outside the pause lane; Boneyard pause and
  Hub book-pause tests stay green.
- Chrome: with two authenticated participants, open Hub Pause, its Settings
  child, and at least one NPC dialogue; require advancing Hub tick/world and
  changing renderer diagnostics, no peer pause message, stopped owner input,
  correct local close actions, and zero page/console errors. Then enter a
  Boneyard and require the existing exact authoritative hold/resume journey.
- Canonical gate: `./scripts/validate.sh` passes on the exact implementation
  tree.

## Implementation validation receipt

- `MainMenuScene.tsx` now owns a local Hub Pause Menu record and its Settings
  handoff. The state blocks the initiating participant's gameplay/chat input
  but is excluded from Hub `presentationPaused` and from the session pause
  lane. The existing native SimpleMenu renderer, rows, actions, dim, timing,
  and fixed-stage projection are unchanged.
- `game-client-session.ts` suppresses source `pause-menu` while its
  authoritative snapshot is a Hub; `game-host.ts` independently rejects the
  same authenticated raw request before source replacement or first-owner
  arbitration. Inventory/SkillScreen Hub barriers and every Boneyard pause
  path remain unchanged.
- Red/green coverage adds client transport suppression, raw-host rejection with
  an advancing Hub tick, root/UI ownership, and the complete dialogue
  no-pause seam. The exact Mac tree passed `15/15` backend/contracts, `4/4`
  library, `43/43` loot, `227/227` prerequisites, `1290/1290` broad runtime,
  `8/8` world-weather, `29/29` party, `11/11` level-up, `7/7` diagnostics,
  `17/17` Hall, `21/21` Hub UI, and `5/5` desktop tests, plus formatting,
  lint/import boundaries, production builds, the media policy, and bundle
  budget (`394185` raw / `110657` gzip bytes).
- Mac mini receipt: `Jarretts-Mac-mini.local`, arm64 macOS `26.6.2`, Node
  `22.17.0`, npm `10.9.2`, .NET `10.0.302`, Chrome `151.0.7922.170`, exact Git
  tree `8eb39d8bbf94d5ba0b8aa92ce295329e8f10b6df`. The two-peer WebGL journey
  advanced Hub Pause Menu tick `1487 -> 1543`; Settings and settled Fomentius
  dialogue also advanced tick and renderer diagnostics with
  `data-presentation-paused=false`; the peer received no pause edge; and a raw
  Hub `pause-menu` packet produced no pause state or waiting surface. Boneyard
  owner and peer holds remained exact at ticks `2482` and `2483`, then resumed
  at `2485`. Page and console error arrays were empty.
- Mac captures: Hub owner Pause Menu
  `/tmp/solomon-dark-pause-hub-owner.png`, SHA-256
  `704fae7b5ee0e8fb81bb23df07462c3ca7de97c5d645d4626bb0df55a9bf0799`;
  settled live Fomentius dialogue
  `/tmp/solomon-dark-pause-hub-dialogue-live.png`, SHA-256
  `a4032b976f9ce3a16db108a60827e90249d76f57fca48ac45ac3715b9bd0cd0e`;
  authoritative Boneyard waiting surface
  `/tmp/solomon-dark-pause-boneyard-waiting.png`, SHA-256
  `216f5fb07c756bdfeea4aa1df89ea9908095dfb32a9cb8989a66bf0190ab43ba`.
- No browser-platform approximation or open system member remains. The focused
  commit is local only; nothing was pushed, deployed, or restarted.
