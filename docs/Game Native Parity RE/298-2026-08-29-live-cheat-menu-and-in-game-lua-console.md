# 2026-08-29 — Live cheat menu and in-game Lua console

## Reported smell and parity question

- Reported web behavior: `Enable Cheats` installs a browser DevTools Lua API,
  but the game has no discoverable cheat menu. Using a supported cheat therefore
  requires leaving the game surface, knowing the private `window.solomonDark`
  entry point, and authoring Lua without any live target or result presentation.
- Requested behavior: add a proper debugging menu available while ordinary
  cheats are enabled, with a stable top bar, `Cheats` and `Console` tabs, direct
  controls for the supported semantic cheats, and a real multiline Lua console.
- Product boundary: retail Solomon Dark 0.72.5 has no Lua engine, browser
  account entitlement, or Website cheat panel. This is an explicit Website
  debugging extension over the already documented Web Lua authority; no retail
  cheat-menu behavior is claimed.
- Reproduction membership: private-College host and protected developer
  admissions; Hub and Boneyard; desktop keyboard, controller/menu navigation,
  and coarse-pointer landscape; authority migration, live cheat-policy changes,
  pause/modal overlap, disconnect, and runtime replacement.
- Falsifiers: a cheats-off ordinary player can open or execute the panel; a
  guest gains Lua authority; opening the panel pauses or advances a hidden local
  simulation; a pressed control injects raw browser state; the Console tab uses
  a fake command language; protected `sd.dev` catalogs leak to an ordinary host;
  disabling cheats leaves the panel or console callable; or input reaches the
  wizard beneath the panel.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Existing Website authority | `origin/main` `0c5f1577`; `game-lua-console.ts`, `game-client-session.ts`, `game-host.ts`, `host/lua/web-lua-{runtime,api,game-api,developer-grants}.ts` | One host-authoritative, bounded Lua 5.4 VM already owns all admitted console execution. Ordinary hosts receive semantic resource/XP/gold/seed/enemy commands; only a sealed developer admission receives `sd.dev` and `sd.bots`. | high |
| Current setting/session trace | `game-settings.ts`, `GameSettingsDialog.tsx`, `MainMenuScene.tsx`, private-College cheat-mode protocol | Local `Enable Cheats` becomes an authoritative private-room policy. The host alone can execute ordinary Lua; developer access is independently authenticated and deliberately keeps the local setting off. Disable, authority change, and disconnect are already observable client lifecycle edges. | high |
| Current modal/input trace | `MainMenuScene.tsx`, `HubScene.tsx`, `BoneyardScene.tsx`, `GameplayPauseMenu.tsx`, `pause-menu-contract.ts` | One root owns scene input blocking, Hub occupied presence, optional books, pause, settings, chat, and social overlays. Lua is rejected while gameplay pause/resume grace owns the world, so a debugging panel must be a live local modal rather than an authoritative pause owner. | high |
| Existing semantic catalogs | `WEB_LUA_STOCK_ENEMIES`; `WEB_LUA_DEVELOPER_ITEMS`, `WEB_LUA_DEVELOPER_SKILLS`, `WEB_LUA_DEVELOPER_WELDS` | The complete stable catalogs are eight enemy families, 58 authored stock item keys, 72 skill rows, and ten Weld builds. The developer bot constructor accepts all three disciplines by all five elements. | high |
| Recovered native UI vocabulary | entries 103, 130, and 183; exact `UI`/`ControlPanel` atlases and ten bitmap fonts from retail executable SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` | Website extensions may reuse the exact panel, SimpleMenu button, tab, frame, and bitmap-text vocabulary while their screen owner retains actions, authority, input, and teardown. | high |

No new retail instruction or runtime claim is required. The stock executable
identity and complete UI building-block membership were already extracted and
validated in entries 103, 130, and 183; this entry consumes those facts without
creating a second asset or address ledger.

## System boundary and membership inventory

Website system: the presentation-local debugging panel from its admitted open
edge through tab state, typed semantic action construction, Lua execution,
result presentation, input exclusion, and teardown. The existing game host,
Lua sandbox, and typed gameplay stores remain the sole authority.

| Member (scene/branch/catalog) | Source/owner | Disposition | Proof contract |
| --- | --- | --- | --- |
| ordinary cheats-off admission | local setting plus authoritative session policy | `verified-already-at-parity` | no row, key edge, mounted dialog, or callable command surface |
| ordinary private-College host with cheats on | session host plus authoritative `cheatsEnabled` | `exact-ported` Website extension | configurable open edge and pause-menu row both open one panel |
| ordinary cheat-room guest | host authority boundary | `out-of-system` (guest cannot execute authoritative Lua) | no open affordance; crafted client calls retain existing rejection |
| protected developer admission | sealed backend/supervisor entitlement | `exact-ported` Website extension | panel remains available without enabling ordinary cheat mode and exposes protected catalog controls |
| title/Create/loading without a live session | application owner | `out-of-system` (no semantic frame or Lua authority) | no panel or inert placeholder |
| Hub/private rooms | live local modal plus Hub activity owner | `exact-ported` Website extension | world remains live, local input stops, and presence reports occupied |
| active Boneyard/Tutorial | live local modal plus Boneyard input owner | `exact-ported` Website extension | authority continues fixed ticks; local movement/casts stop; supported commands apply immediately |
| Game Over/loadout/non-active run phases | current semantic frame | `exact-ported` Website extension | console remains usable; phase-invalid cheat controls are disabled with an explicit reason |
| top bar and close action | new panel screen owner plus exact stock panel vocabulary | `exact-ported` designed Website extension | title, authority/scene status, tabs, and close remain visible at every scroll position and viewport |
| `CHEATS` tab | typed panel action owner | `exact-ported` Website extension | target/state, Player, World, and protected Developer groups have semantic labels and bounded controls |
| `CONSOLE` tab | existing `GameClientSession.executeLua` | `exact-ported` Website extension | multiline Lua, Ctrl/Cmd+Enter execution, in-memory history, prints, returns, and errors |
| target player selector | authoritative snapshot player identities | `exact-ported` Website extension | every live player appears once; departed targets fall back safely to the local player |
| player state readout | authoritative snapshot progression/economy/position | `verified-already-at-parity` with new presentation | HP, mana, XP/level, Gold, life state, and coordinates update behind the live panel |
| restore health | `sd.player.restore_health` | `exact-ported` Website extension | bounded typed Lua targets the selected live player |
| restore mana | `sd.player.set_mana` | `exact-ported` Website extension | server clamps to the selected player's current maximum |
| set Gold | `sd.player.set_gold` | `exact-ported` Website extension | integer `0..10,000,000`; no raw economy object crosses the boundary |
| grant experience | `sd.player.grant_experience` | `exact-ported` Website extension | finite `0..10,000,000`; ordinary progression and pending-offer owners consume it |
| next-run seed | `sd.rng.set_seed` | `exact-ported` Website extension | Hub-only integer `1..0x3fffffff`; disabled outside the Hub |
| eight stock enemy families | `sd.enemies.list/spawn`, complete `WEB_LUA_STOCK_ENEMIES` | `exact-ported` Website extension | each catalog row is selectable and spawns a bounded count around the target only in an active Boneyard |
| 58 developer stock items | `sd.dev.list_items/grant_item` | `exact-ported` protected extension | live catalog drives key/quantity; absent for ordinary cheat hosts |
| 72 developer skills | `sd.dev.list_skills/grant_skill` | `exact-ported` protected extension | every non-Weld row accepts a bounded rank count; Weld-only row remains excluded from this action |
| ten developer Weld builds | `sd.dev.list_welds/grant_weld` | `exact-ported` protected extension | every returned build can target a live player atomically |
| 15 developer bot configurations | `sd.bots.summon`; three disciplines by five elements | `exact-ported` protected extension | Hub-only selectors enumerate the complete product and retain host-side validation |
| arbitrary raw state editing, offline/cross-run targets, procedural equipment, mod-private registries | no admitted typed semantic owner | `out-of-system` (would bypass catalog/authority boundaries) | no JSON editor, raw protocol packet, or fallback mutation |
| unsafe Lua libraries, DOM, Node, filesystem, network, native memory/backbuffer | Web Lua sandbox and browser platform boundary | `verified-already-at-parity` | Console tab exposes the existing sandbox unchanged; absent namespaces stay absent |
| panel close, cheat disable, authority loss, session replacement, disconnect, unmount | `MainMenuScene` and client-session lifecycle | `exact-ported` Website extension | local input is released, pending UI state is retired, and no stale session remains callable |

No new member is blocked by the browser platform. Native memory/backbuffer APIs
remain the already documented platform-blocked Web Lua namespaces rather than
members of this presentation extension.

## Ownership thread

- Construction: `MainMenuScene` derives availability only from the connected
  session's sealed developer access or authoritative host cheat policy. A
  configurable key edge or the cheats-only Pause `SimpleMenu` row mounts one
  lazily loaded panel.
- Upstream state: the current snapshot supplies scene, phase, tick, player
  targets, resources, economy, and coordinates. The selected tab, form values,
  editor text, and transient history are presentation-local.
- Command path: controls compile only bounded literal Lua over existing `sd.*`
  functions. The Console editor passes the user's Lua unchanged through
  `GameClientSession.executeLua`; client and host recheck authority, size,
  pending-count, pause, and session lifetime before the VM accepts it.
- Downstream state: the host VM queues typed commands; the next 100 Hz boundary
  applies them through ordinary player/progression/economy/wave owners. Normal
  snapshots, saves, events, rendering, and multiplayer peers observe results.
- Presentation: the panel is a local modal, not a gameplay pause. Hub presence
  becomes occupied and both scene input owners receive `inputBlocked`, while
  transport, simulation, and snapshots remain live.
- Teardown: close, disable, authority loss, session replacement, and unmount
  destroy the panel state. Console history is memory-only and is not written to
  a save, profile, local storage, telemetry, or URL.

## Behavioral contract

- Availability is fail-closed. Ordinary access requires both authoritative
  cheats-on state and current host authority; developer access comes only from
  the existing sealed admission.
- The top bar never scrolls away. `CHEATS` and `CONSOLE` are the only two tabs;
  switching tabs preserves the current editor and action form values during
  that panel lifetime.
- The configurable open edge is ignored during unrelated modal, loading,
  orientation, pause, and resume-grace ownership. The same edge or Escape
  closes the active panel without leaking to scene input.
- Cheat buttons use fixed commands and validated numeric/catalog values. They
  never concatenate user-authored code. The Console tab is the only arbitrary
  Lua path and labels that fact directly.
- Console execution accepts multiline Lua, runs with Ctrl/Cmd+Enter or the Run
  control, keeps bounded in-memory command history, and renders each request's
  source, `print` output, structured return values, or error independently.
- Action controls remain single-flight while their request is pending. A host
  rejection is shown in the panel rather than converted into optimistic state.
- Opening the panel never pauses the authoritative world. The local input lane
  is stopped, so the selected wizard neither moves nor casts while the debugger
  is in use; multiplayer peers and enemies continue normally.

## Nearby-system findings

- Gameplay pause and Lua deliberately reject one another. Reusing the Pause
  owner for the panel would make every button fail or require a second mutation
  scheduler. The correct seam is a live modal with explicit local input
  exclusion.
- The developer catalogs are already complete and authority-protected. A menu
  must consume their returned semantic descriptors rather than importing host
  implementation tables into the browser bundle or duplicating 140 identities.
- The browser DevTools `window.solomonDark` surface remains useful for external
  automation. The in-game Console is a second presentation over the same
  `executeLua` owner, not a replacement VM or compatibility shim.

## Confidence and open questions

- Confirmed: authority provenance, cheats-on room policy, pause rejection,
  scene/modal ownership, all semantic cheat APIs, complete enemy/developer
  catalog membership, Lua bounds, fixed-tick command application, and teardown.
- Designed-not-observed: top-bar layout, two-tab interaction, configurable
  browser open binding, in-memory history, and responsive debug-form layout.
  These are explicit Website debugging policies, not retail claims.
- Unknown: none material. The product request defines the new presentation;
  existing typed APIs define every state mutation it may perform.

## Web implementation consequence

- Add a focused `CheatMenu` presentation module and a pure command/catalog
  helper. Keep arbitrary Lua only in the Console tab and keep fixed Cheats-tab
  actions generated from bounded typed values.
- Let `MainMenuScene` own availability, open/close, scene input exclusion, Hub
  occupied presence, pause-menu entry, and teardown. Do not add a second host
  VM, protocol message, save field, or simulation pause state.
- Extend the existing Settings binding record with `Open Cheats`, including a
  migration for every deployed complete-controls record. Keep the pause-menu
  row as the touch/controller discovery path.
- Reuse the exact Settings panel and shared SimpleMenu vocabulary. Do not copy
  atlas crops, introduce a generic design system, or bake a screenshot.

## Validation contract

- Focused contracts: availability matrix; deployed settings migration and key
  conflict swap; cheats-only Pause row; Lua literal/action construction and
  numeric bounds; complete eight/58/72/10/15 catalog dispositions; result
  formatting; history limits/navigation; and disable/authority/session teardown.
- Browser journey: ordinary private-College host toggles cheats, enters gameplay,
  opens by key and Pause row, switches both tabs, types and runs multiline Lua,
  proves print/return/error rendering, targets player resources, sets Hub seed,
  spawns each enemy family in an active Boneyard, and closes with stable input.
- Protected browser journey: developer admission lists and applies representative
  item/skill/Weld grants and summons representative bots while an ordinary host
  proves those groups and namespaces absent.
- Responsive acceptance: desktop and coarse-pointer landscape keep the top bar,
  tabs, editor Run/Close actions, target selector, and all touch controls inside
  the viewport with no horizontal page overflow.
- All page, console, failed-response, and host-error arrays are empty except the
  deliberately executed Lua error rendered as panel data. The exact candidate
  passes `/opt/homebrew/bin/bash ./scripts/validate.sh` on the Mac mini.

## Implementation validation receipt

- `CheatMenu.tsx` and `cheat-menu.css` now own one lazily loaded, responsive
  native-panel shell with a fixed top bar, exact `CHEATS`/`CONSOLE` tabs,
  authority/scene/tick identity, close action, live target state, bounded Player
  and World forms, protected Developer forms, multiline Lua editor,
  `Ctrl/Cmd+Enter`, memory-only history, and separate
  source/print/return/error records.
  Every form control has a concise explicit accessible name.
- `cheat-menu-contract.ts` is the pure boundary. It gates ordinary access to an
  authoritative cheats-on host, admits sealed developers independently, escapes
  all fixed-command identities, bounds every numeric value, decodes the complete
  dynamic catalogs, handles Lua's object-shaped empty protected tables without
  weakening nonempty rows, and formats console history/returns. Five focused
  tests cover authority, every action family, all 15 bot configurations,
  catalog decoding, empty ordinary developer catalogs, history, and output.
- `MainMenuScene` owns open/close, live snapshot projection while visible,
  input blocking, Hub occupied presence, authority/cheat/session teardown, and
  delayed Pause-menu handoff after Pause and resume grace release. Gameplay's
  native three rows remain unchanged when unavailable; `CHEAT MENU` is the
  explicit fourth Website row only for an admitted debugger. The panel stays
  live rather than taking gameplay Pause, so Lua applies immediately.
- Settings now owns `Open Cheats`, default `Backquote`, as the seventeenth
  persisted binding. Old sixteen-binding records migrate to Backquote or the
  first free `F1..F3` code, and conflict swapping remains global. The existing
  settings panel chrome was factored into `NativePanelArt` and reused without
  copying atlas coordinates.
- The local task worktree and detached Mac candidate at
  `/Users/jarrett/codex-acceptance/cheat-menu-20260829-root/website` were based
  on `origin/main` `0c5f1577c9cce0bfab5ad188e5830d992848a051`; checksum-only
  rsync comparison reported no changed-file difference before validation. The
  arm64 Apple-M2 Mac mini used Node `22.17.0`, npm `10.9.2`, and Chrome
  `151.0.7922.174`.
- The exact final Mac candidate passed
  `/opt/homebrew/bin/bash ./scripts/validate.sh`: 28 backend contracts, backend
  build/format with zero warnings or errors, frontend lint and architecture
  fences with zero errors and only 19 pre-existing warnings, every Web Lua,
  loot, renderer, 1,760-test game, five-test cheat menu, weather, party,
  level-up, Tutorial, diagnostics, Hall, Hub UI, and five-test desktop suite,
  both production builds, bundle budget, and media policy. The final Game entry
  was `266,208` raw / `80,882` gzip bytes; the lazy CheatMenu chunk was about
  `14.42` KiB raw / `4.61` KiB gzip. One unrelated prepared-session timing
  assertion and one unrelated private-College social timeout each failed once
  under separate earlier broad runs, passed immediately in their complete
  isolated files, and the final canonical run passed both without code changes.
- The ordinary built-Chrome journey passed protocol `solomon-dark/108`. It
  enabled cheats through real Settings, opened by Backquote and the four-row
  Pause surface, switched both tabs, ran multiline print/return and deliberate
  error Lua, set Gold, retained the top bar and all actions inside `844x390`,
  set seed 42, enumerated and issued all eight enemy-family menu spawns, ran the
  Boneyard Console, and removed both the in-game panel and DevTools API when
  cheats turned off. Lua initialization was `20.697 ms`, memory was `43,354`
  bytes, 120 callback samples were p50/p95/p99/max
  `0.348/0.555/0.604/0.871 ms`, with zero budget crossings or request failures.
  Page errors were empty; the sole browser console error was the smoke's
  intentional infinite-loop timeout, while the in-panel deliberate Lua error
  remained rendered data.
- The protected built-Chrome journey exposed exactly 58 Item options, 71
  non-Weld Skill controls from the complete 72-row catalog, ten Welds, all
  discipline/element bot selectors, and real `sd.dev` Lua in the Console. A
  menu-issued Item grant succeeded; the existing deeper journey then re-proved
  targeted Gold/item/equipment/skill/Weld grants and exact Hub-to-Boneyard
  retention. Page, console, request, host, and protocol error arrays were all
  empty.
- No member is browser-blocked and no material unknown remains. This receipt
  claims no deployment, production restart, or live-site mutation; Git
  publication is tracked separately by verified repository SHAs.
