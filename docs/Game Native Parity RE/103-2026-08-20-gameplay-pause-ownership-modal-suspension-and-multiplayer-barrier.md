# 2026-08-20 — Gameplay pause ownership, modal suspension, and multiplayer barrier

## Reported smell and parity question

- Reported web behavior: gameplay has no authoritative ESC pause. A browser
  client can continue moving, casting, ticking actors, and advancing waves
  because no pause state reaches the host.
- Reopened report, 2026-08-20: after the authoritative pause landed, the user
  reported that the ESC menu looked very wrong. A stock-versus-web comparison
  confirms broken/gapped chrome, an invented CSS panel, the wrong font and
  interaction colors, a disabled native action, and missing pressed/motion
  states.
- Stock behavior to recover: the default Escape-bound `OPEN MENU` edge opens
  the native Pause Menu, holds the active gameplay world at one exact state,
  keeps the modal/application loop responsive, and resumes the retained world
  without catch-up.
- Reproduction inputs/scenes: a settled Hub region or active Boneyard, one
  rising Escape edge, all three native pause actions, nested modal lifetime,
  owner departure, a second connected browser, and a late join.
- Falsifiable questions: whether pause is a client presentation trick or a
  world-owner state; whether the outer scheduler stops; whether another Escape
  toggles the same modal; whether pause has a timeout; and whether a non-owner
  can replace or release a multiplayer pause.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Live native capture | `Mod Loader/tests/fixtures/webgame/menu-layouts/pause-menu.json` and `menu-reference-captures/pause-menu.png`; recorded 2026-08-09 at 1600 by 900 against retail SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` | Settled retained-world underlay, 0.85 black dim, centered three-row menu, exact action rectangles, and four independent captured instances. Capture-only loader hooks observed UI/Sprite/font calls without changing game or menu behavior. | high |
| Instructions | input branch `0x005CB3D4..0x005CB42A`, binding `0x00B3BCCC`, edge sampler `0x00429950` | `Gameplay::Tick` consumes the configurable `OPEN MENU` rising edge before the world tick. Both shipped presets bind Escape scan code `0x01`. | high |
| Instructions | action `0x0058EA50`, `SimpleMenu` ctor `0x005BA4B0`, modal `0x005ABF10` | Authored rows are exactly `RESUME GAME[1]|GAME SETTINGS[0]|LEAVE GAME[2]`; results 1/0/2 resume, open gameplay settings through `0x005A81A0`, or leave through `0x005A7F60`. | high |
| Instructions | suspension helper `0x005CBD40`, scene dispatcher `0x00427800` | Modal entry increments `Gameplay+0x80` and writes active-region `+0x68 = -1`; the scene dispatcher skips negative-delay scenes. Final release decrements without underflow and restores zero. | high |
| Instructions | modal runner `0x004281F0`, MyApp pump `0x0040D130`, scheduler `0x0040D3C0` | The application scheduler, window messages, modal input, and presentation remain live while the region/world is held. Pause has no timeout and does not add catch-up ticks. | high |
| Instructions/data | `SimpleMenu::Tick` `0x005A8950`, renderer `0x005C5A00`; doubles `0.035`, `0.05`, `0.85` at `0x00784888`, `0x007DE8A0`, `0x00785858` | Reveal reaches one in 29 fixed ticks, close reaches zero in 20, and the underlay dim is `reveal * 0.85`. | high |
| Existing web baseline | protocol 30 `game-host.ts`, `game-client-session.ts`, `MainMenuScene.tsx`, Hub/Boneyard scene loops | The server already owns fixed simulation and a no-tick level-up barrier, but exposes no gameplay pause request/owner lane. Browser interruption clears input only; it does not pause a shared world. | high |
| Reopened instructions | `SimpleMenu` build/render `0x005C5340`/`0x005C5A00`; row/frame compositors `0x00417E30`/`0x00417760`; Button constructor/state methods `0x00430430`, `0x00430890`, `0x00430A40`, `0x00430AC0`, `0x00430AE0`; UI loader `0x004F3590` | Idle/pressed rows are exact `UI.101`/`UI.102`; `UI.54` and `UI.17` use five-percent texture strips to close every edge; labels use Fonts group 3 in RGB `(0.85,0.73,0.44)`; press shifts text `(6,6)` while hover has no visual branch; outer chrome moves 25 pixels over reveal/close. | high |
| Reopened asset/data | retail `UI.bundle` SHA-256 `1db00ea8826e787ca9a320c90a33e726991cae00906baddfdc8bde31da697498`; `Fonts.bundle` SHA-256 `048aa22cc715ee633f5e31f0400b4a3a9c0a8c8b49d681419e19d5ff676c214a`; extracted Website atlases/catalogs | Complete pause membership is `UI.101 x3`, `UI.54 x6`, `UI.17 x4`, `UI.18 x1`, `UI.8 x3`, plus three Fonts-group-3 strings; a pressed row substitutes one `UI.102`. | high |
| Reopened web reproduction | unchanged `GameplayPauseMenu.tsx`, `gameplay-pause-menu.css`, and `pause-menu-contract.ts` at current `origin/main`; 1600 by 900 `/tmp/solomon-dark-pause-hub-owner-before-visual-fix.png` SHA-256 `53559d1e884e719a8833fbc78ec240685ae0a38ff92fb45d57846760993816be`; stock PNG SHA-256 `432da37dd7a23c937405991d6c50ecfab2d775cddfaf4353da6095a7ba244e52` | Web draws only raw corner/end sprites, guesses the missing texture strips with a CSS border, adds a non-native dark panel/shadow, uses Cinzel, auto-focuses Resume into a white highlight, dims Settings, and only fades opacity. The screenshot visibly diverges from the stock fixture. | high |

All native addresses are preferred-image VAs for the exact retail executable
above. No runtime ASLR address or stale PID is used. The reusable native report
is `Mod Loader/docs/reverse-engineering/native-gameplay-pause.md`; it also
records the complete `0x005CBD40` xref family.

## System boundary and membership inventory

Native system: the gameplay Pause Menu boundary begins at the admitted
`OPEN MENU` rising edge, owns the `SimpleMenu` surface and nestable active-region
suspension, and ends when Resume or teardown releases that exact region. The
Website extension adds authoritative player ownership and peer presentation;
it does not turn every independent inventory/picker modal into an ESC pause.

| Member (class/variant/scene/branch) | Native source (function/table row/record) | Disposition | Proof |
| --- | --- | --- | --- |
| default Escape / configurable `OPEN MENU` rising edge | `0x00B3BCCC`, `0x00429950`, `0x005CB3D4..0x005CB42A` | `exact-ported` | focused input and browser ESC journey; one non-repeat edge submits one host request |
| Hub gameplay, every current web Hub region | shared Game input path and active-region `+0x68` hold | `exact-ported` | two-browser Hub tick/position freeze and resume receipt |
| active Boneyard/Arena gameplay | same Game input path and active-region hold | `exact-ported` | two-browser Boneyard tick/enemy/player freeze and resume receipt |
| owner Pause Menu settled idle presentation | `0x005C5A00`; `UI.101 x3`, `UI.54 x6`, `UI.17 x4`, `UI.18 x1`, `UI.8 x3`; Fonts group 3 | `exact-ported` | render-plan contract and 1600 by 900 stock-versus-browser comparison cover every art/string member and edge strip |
| `UI.54` row and `UI.17` frame strip compositing | `0x00417E30`, `0x00417760`, UV edge `0.95` | `exact-ported` | focused geometry/UV contract plus browser pixels prove continuous native chrome without a guessed border/fill |
| Resume, Settings, and Leave pressed variants | `0x005C5A00`, `Button+0x78`, common-button records `101/102` | `exact-ported` | each row independently swaps to `UI.102` and shifts its bitmap label `(6,6)` on pointer/key press |
| hover and browser focus | Button hover byte `+0x79`, `0x00430AC0`/`0x00430AE0`; renderer `0x005C5A00` | `exact-ported` | hovered/focused screenshots and computed styles remain visually identical to idle, with no browser outline/brightness invention |
| Fonts-group-3 labels and exact gold RGBA | `0x005C5F06..0x005C608A`, `Fonts owner +0x0E7D98` | `exact-ported` | extracted glyph, bearing, advance, space, and 210-pair kerning contract; exact RGB `(0.85,0.73,0.44)` |
| `RESUME GAME` result 1 | authored row in `0x0058EA50` | `exact-ported` | only the authoritative owner can release; next fixed tick resumes with no catch-up |
| `GAME SETTINGS` result 0 handoff | `0x0058EA50 -> 0x005A81A0` | `exact-ported` | enabled native row closes the SimpleMenu and hands the still-held session to the existing Website settings owner; Done releases the pause |
| gameplay settings contents after the handoff | settings owner `0x005A81A0 -> 0x005D8DC0` | `out-of-system` (separately owned settings system, not a SimpleMenu style/member) | the pause boundary tests only the enabled handoff and balanced hold; it makes no native-parity claim for the existing Website settings contents |
| `LEAVE GAME` result 2 | `0x0058EA50 -> 0x005A7F60` | `exact-ported` | owner disconnect releases the barrier and returns that client to the title root |
| second Escape while Pause Menu owns input | global modal exclusion `0x008203F0` gates `0x005CB360` | `exact-ported` | owner menu consumes the edge without recursive open or release; Resume remains the close action |
| nested modal suspension depth | `0x005CBD40`, `Gameplay+0x80` | `verified-already-at-parity` | current mandatory level-up barrier already retains a no-tick state until its own owner cohort resolves; gameplay pause is kept as a separate session owner so the barriers cannot release one another |
| SimpleMenu reveal/close, chrome motion, and dim | `0x005A8950`, `0x005C5A00`; 29/20 ticks, 25-pixel outer motion, max dim 0.85 | `exact-ported` | fixed-step contract pins every reveal/close sample; browser receipt covers start, settled, and close geometry/alpha |
| application/transport service during pause | `0x004281F0 -> 0x0040D130 -> 0x0040D3C0` | `exact-ported` | pings, pause messages, joins, departure, and UI remain responsive while simulation tick is constant |
| multiplayer first-request owner | no retail member; explicit Website product extension | `exact-ported` | two clients racing/issuing requests retain the first authoritative owner |
| non-owner wait surface naming owner | no retail member; user-required Website presentation extension | `exact-ported` | second browser sees the exact replicated display name and no resume action |
| owner disconnect and late join | no retail member; host lifecycle extension | `exact-ported` | disconnect releases with cleared input; welcome carries an existing owner to a late joiner |
| title, play, Create, loading, Game Over, post-run loadout | outside native Game Pause Menu admission gates | `out-of-system` (separate application/session surfaces) | protocol and UI gates reject pause requests outside Hub/active-run gameplay |
| mandatory level-up picker | sibling `0x0066F920`/`0x0067CAC0` modal family; current `levelUpBarrier` | `out-of-system` (independent mandatory selection owner) | picker consumes Escape and host rejects pause stacking while the barrier is active |
| Inventory, trader, quick-panel, spell/book/settings modal xrefs of `0x005CBD40` | `0x004C2AA0`, `0x004C2E30`, `0x00555810`, `0x005684C0`, `0x005D8DC0`, `0x005D8F30`, `0x006588C0`, `0x0066B200`, `0x0066F0B0` | `out-of-system` (independently triggered modal/UI systems; enumerated because they share the native nesting helper, but they do not consume the ESC pause-menu owner or authored rows) | complete xref sweep in the native report; no symptom patch is applied to those systems |
| other shared `SimpleMenu` consumers | `0x004BB3F0`, `0x005A5530`, `0x005D8120` | `out-of-system` (Hub/profile, title/profile, and settings-owned menu instances with independent authored content) | complete constructor/modal xref sweep; none supplies a second pause style or fallback renderer |

There are no `blocked-by-platform` members. Browsers can represent the retained
frame, authoritative hold, exact timing, input ownership, and player-named
waiting surface.

## Native ownership thread

- Owner and construction path: `Gameplay::Tick 0x005D7EF0` owns admission;
  action `0x0058EA50` constructs `SimpleMenu 0x005BA4B0`; modal loop
  `0x005ABF10` owns the surface lifetime and balanced suspension depth.
- Upstream state producers/callers: the binding preset/config writer supplies
  `0x00B3BCCC`; `0x00429950` supplies a rising edge; gameplay modal and readiness
  gates decide whether that edge can dispatch.
- State representation and transitions: nesting depth is `Gameplay+0x80`;
  active region `+0x68` is zero normally and `-1` while suspended. Website
  state is a nullable host-owned `{ playerId, displayName }` with no client
  authority and no timer.
- Downstream consumers/callees: `0x00427800` suppresses region/world ticks;
  `0x004281F0` keeps application/UI service live; results 1/0/2 route Resume,
  Settings, or Leave.
- Sibling systems sharing ownership or data: all sixteen `0x005CBD40` xrefs
  and all four `SimpleMenu` consumers are enumerated above. They prove nesting
  and shared-renderer semantics but keep their independent modal triggers and
  content owners.
- Entry, interruption, reset, and teardown: pause clears every held/queued web
  gameplay input. Resume resets the host's next-tick deadline instead of
  catching up. Owner disconnect, session empty/reset, or host shutdown clears
  the barrier; a non-owner departure does not.

## Recovered behavioral contract

- Timing/ticks/thresholds: authoritative world tick and state remain byte-for-
  byte stable for an unbounded pause. Reveal adds `0.035` per 10 ms tick for
  29 ticks; close subtracts `0.05` for 20 ticks; dim is `reveal * 0.85`.
  Resume schedules the next ordinary 10 ms tick and never replays elapsed wall
  time.
- Geometry/transforms/coordinate spaces: the stock surface uses the retained
  1600 by 900 gameplay stage. Resume, Settings, and Leave rects are respectively
  `[623.5,339.5,976.5,408.5]`, `[623.5,415.5,976.5,484.5]`, and
  `[623.5,491.5,976.5,560.5]`; the existing fixed-stage viewport transform
  projects them to browser CSS space. The outer chrome rectangle moves from
  `[558.5,274.5,1041.5,625.5]` at reveal zero to
  `[583.5,299.5,1016.5,600.5]` settled; row geometry never moves.
- Render/hit/collision/traversal order: retain the last rendered world frame,
  apply the dim, paint each `UI.101/102` body, its exact `UI.54` strip-composed
  surround, and its bitmap label, then paint strip-composed `UI.17` frame,
  `UI.18` header, and three `UI.8` arrows. While held, no actor, collision, AI,
  wave, projectile, effect, lighting, or region traversal consumes a tick.
- Assets/audio/randomness: the pause frame consumes exact retail UI and Fonts
  bundle records with no CSS/OS-font substitute and no gameplay RNG. Native
  pause does not globally stop BASS; web event production stops with the
  authoritative world, while already playing scene music remains owned by the
  existing audio director.
- Input/network authority/replication: clients send intent only. First valid
  request wins; only that connection releases. Every peer and late joiner sees
  the authoritative id/name. Non-owner requests are inert. Pause and both
  release edges clear input lanes.
- Boundary and failure behavior: no timeout and no host override. The owner
  leaving is the fail-safe release. Malformed protocol payloads fail closed;
  valid but unauthorized pause/resume requests do not disconnect a peer.

## Nearby-system findings

- Durable finding: the earlier pause pass violated the system-membership rule
  by stopping at settled rectangles/art ids instead of tracing the shared
  renderer, both strip compositors, font wrapper, Button state writers, and
  reveal geometry. The guessed CSS border/panel and font are removed across the
  entire pause instance; no sibling retains that falsified path.
- Evidence: fresh `0x005C5A00`, `0x00417760`, `0x00417E30`, Button vtable, and
  `0x004F3590` traces reconciled with the exact stock PNG and full UI/Fonts
  bundle catalogs.
- Durable finding: the loader's earlier shared-menu pause is not this contract.
  It aggregates Pause Menu, SimpleMenu, QuickPanel, and Settings requests and
  expires them after 60 seconds. Copying it would violate both the native no-
  timeout modal lifetime and the requested owner-waits-until-resume behavior.
- Evidence: `Mod Loader/SolomonDarkModLoader/src/multiplayer_local_transport/shared_gameplay_pause_sync.inl` constants and request aggregation versus the retail causal trace above.
- Why it matters or may matter later: any future reconciliation of Inventory or
  Settings multiplayer behavior must decide its own authority instead of
  silently joining the ESC owner barrier.
- Native report/catalog also updated: `native-gameplay-pause.md`,
  `ui-binary-map.md`, and `[gameplay.pause]` in `config/binary-layout.ini`.

## Confidence and open questions

- Confirmed: complete native input-to-resume ownership, all pause-helper and
  SimpleMenu consumer xrefs, storage offsets, modal action rows/results,
  timing constants, no-timeout lifetime, exact idle/pressed art membership,
  texture-strip compositing, bitmap-font ABI/color, chrome motion, live
  geometry, and current web authority seam.
- Inferred: none used to choose implementation behavior.
- Unknown: retail supplies no multiplayer identity, arbitration, disconnect,
  or late-join rule because the build is single-player.
- Next falsifying probe if the unknown becomes material: none; the multiplayer
  rows are explicitly user-required product behavior, not claims about retail.

## Web implementation consequence

- Correct owner/module: game host session state owns pause identity and tick
  admission; the client session owns protocol projection; a focused pause
  renderer owns only exact SimpleMenu pixels/states and semantic actions.
- Shared model change: add one authenticated pause intent plus one authoritative
  pause state message/welcome field, block all input while present, and stop the
  fixed simulation loop without stopping heartbeat or UI service.
- Stock behavior preserved: default Escape entry, retained frame, 0.85 dim,
  exact three-row geometry, continuous strip-composited chrome, native bitmap
  text/color, idle/press/no-hover states, 25-pixel outer motion, Resume-only
  close, enabled Settings handoff, no timeout, input clearing, and no catch-up.
- Browser-specific approximation, if unavoidable: none.
- Symptom patch or obsolete path to remove: remove the invented CSS frame,
  fill, shadow, Cinzel labels, hover/focus highlight, disabled Settings style,
  and smooth opacity-only animation. No client-only `paused` boolean or
  per-scene timer is permitted.

## Validation contract

- Focused automated test: protocol round trips and rejects malformed pause
  records; host proves first-owner arbitration, constant tick/state, blocked
  input, owner-only release, late join, and disconnect release; client proves
  input clearing and pause listener lifetime; presentation contract pins every
  UI/font member, edge-strip source, idle/pressed row, exact text layout/color,
  fixed-step reveal/close geometry, no-hover branch, and enabled Settings
  handoff.
- Playwright or runtime journey: one real WebGL browser alternates between
  owner and waiting views while authenticated peers drive the opposite
  ownership, late-join, and disconnect edges in Hub and Boneyard. The owner
  gets the Pause Menu; the browser waiting peer gets `<display name> has paused
  the game`; neither canvas/world/tick changes during the hold; Resume and
  owner departure release; no page/console errors.
- Stock-versus-web comparison: match the checked-in 1600 by 900 pause fixture's
  retained underlay, dim, continuous row/frame chrome, bitmap labels, row
  order, action rectangles, and settled outer bounds; capture each pressed row
  plus reveal/close boundary frames.
- Measurable acceptance criteria: one pause message per edge; identical owner
  on both peers; zero authoritative tick delta and zero player/enemy position
  delta during at least 500 ms; first resumed tick occurs without a backlog;
  non-owner release has no effect; owner disconnect releases within one
  heartbeat/close event; focused tests and `./scripts/validate.sh` pass.

## Initial implementation validation receipt (superseded for visual fidelity)

- Files/modules changed: protocol 31 adds authenticated pause intent, welcome
  state, and authoritative pause broadcasts; `game-host.ts` owns first-request
  arbitration, no-tick hold, input clearing, owner-only release, late join,
  disconnect release, and no-catch-up deadline reset; `game-client-session.ts`
  owns projection and blocked input; `MainMenuScene.tsx`, `HubScene.tsx`, and
  `BoneyardScene.tsx` own stable Escape admission and frozen presentation;
  `GameplayPauseMenu.tsx`, `gameplay-pause-menu.css`, and
  `pause-menu-contract.ts` own the exact menu/waiting presentation.
- Tests and canonical gate: focused protocol/client/host/presentation contracts
  passed, including Hub and Boneyard state equality, first-owner arbitration,
  non-owner rejection, late welcome, mandatory-picker rejection, disconnect,
  and no catch-up. Final `./scripts/validate.sh` passed 24 backend/integration
  tests, 40 loot tests, 140 pretests, 978 broad frontend/game tests, five
  level-up tests, six diagnostics tests, 14 Hub UI tests, five desktop tests,
  strict formatting,
  lint/import boundaries, production TypeScript/Vite/game-host build, bundle
  budget (`207071` raw / `60236` gzip bytes for the Game entry), and production
  media policy.
- Browser/native evidence: `npm run smoke:game:pause` passed with Chrome
  `150.0.7871.124`, one real 1600 by 900 WebGL client, and two authenticated
  peers on the combined Golem-plus-loot-plus-pause tree. Hub held at tick
  `6571`; browser-owned Boneyard held at `8105` and peer-owned Boneyard at
  `8106`, with
  byte-equal authoritative world/player
  receipts and byte-equal renderer diagnostics through each 550 ms hold.
  Resume messages arrived before any replay backlog; owner departure resumed
  the remaining session to tick `8134`. Both owner directions, late join,
  non-owner rejection, and zero page/console errors passed. Settled screenshots
  are `/tmp/solomon-dark-pause-hub-owner.png` SHA-256
  `0f6e8707b70ef49739a4a11f98e1148472ad496b37af11b7a7b3988a27ecaba6`,
  `/tmp/solomon-dark-pause-hub-waiting.png` SHA-256
  `c9e84f2abd1e208a2bef654bfc27db80b8020b87cf8365b1271e6c05c9f14c7e`,
  and `/tmp/solomon-dark-pause-boneyard-waiting.png` SHA-256
  `90764c34d5995daad38209c9dd70fa69c17287f5d7f9282f1111d49ba798a880`.
- This receipt remains valid for authoritative pause ownership and world
  suspension. Its claim of exact menu presentation is superseded by the
  reopened evidence above.

## Reopened visual-parity implementation receipt

- Files/modules changed: `pause-menu-contract.ts` seals the recovered fixed
  tick plan, 1600 by 900 action rectangles, complete UI/font membership, atlas
  frames, and text layout; `gameplay-pause-renderer.ts` owns the immutable
  Pixi/WebGL reveal, settled, and close presentation; `GameplayPauseMenu.tsx`
  owns semantic input plus the exact `UI.102` pressed-row overlay above that
  immutable canvas. `MainMenuScene.tsx` hands enabled GAME SETTINGS to the
  existing settings dialog while authoritative pause remains held, and
  `gameplay-pause-menu.css` supplies only stage/input geometry rather than
  invented chrome or hover styling.
- Focused coverage: `pause-menu-contract.test.ts` pins all stock members,
  frame sources, bitmap glyph layout/color, exact action/frame geometry,
  29-tick reveal, 20-tick close, no-hover/focus branch, and pressed offset.
  `npm run smoke:game:pause` passed on Chrome `150.0.7871.124` with zero
  page/console errors. It exercised each pressed action from a fresh menu,
  Settings world hold and Done release, Hub and Boneyard owner/waiting views,
  late join, non-owner rejection, owner disconnect, and no catch-up. The Hub
  held at tick `5400`; Boneyard held at owner tick `8839` and peer tick `8881`,
  then resumed at tick `8935`.
- Canonical gate: `taskset -c 0-3 ./scripts/validate.sh` passed on the final
  implementation tree: 25 backend/integration tests, 40 loot tests, 150
  pretests, 1022 broad frontend/game tests, five level-up tests, six
  diagnostics tests, 14 Hub UI tests, five desktop tests, strict formatting,
  lint/import boundaries, production TypeScript/Vite/game-host builds, bundle
  budget (`242952` raw / `71424` gzip bytes), and production media policy. The
  complete log is `/tmp/solomon-esc-menu-validate-final-affinity-20260820.log`
  SHA-256 `ece27ee5ab9f6959eb4bedf376843de1b8ebe89401c6d7819172692316e42c9d`.
- Final browser evidence: settled captures are
  `/tmp/solomon-dark-pause-hub-owner.png` SHA-256
  `ac71565adf49625d4d998e1dbec31acfb33a9dce01a4c34c8803d38dbe7798b7`,
  `/tmp/solomon-dark-pause-hub-waiting.png` SHA-256
  `a6d333544c3c46a12b88b13c79d32a6607dba5c641ec3c59f786488dea98b977`,
  and `/tmp/solomon-dark-pause-boneyard-waiting.png` SHA-256
  `83fffef9dbf2c12ad15d692c5fa4871137bbfb37ac81c927e9da8466af9c716f`.
  Exact pressed-row captures are
  `/tmp/solomon-dark-pause-resume-pressed.png` SHA-256
  `de91816fac4c8b0b8f81381424695e1ff7a4e5283972456d931b91f9b3689133`,
  `/tmp/solomon-dark-pause-settings-pressed.png` SHA-256
  `06c4cce4b04514c556fd2ed2eef3caff064649dcb93bc5fc8c9467002e6f0f4f`,
  and `/tmp/solomon-dark-pause-leave-pressed.png` SHA-256
  `741bd671083fa63845d99b5b431811bd6ef6716ba60d96d41650e27ed8243b82`.
  The smoke log is `/tmp/solomon-esc-menu-smoke-final-20260820.log`
  SHA-256 `856774f67ccb6a48a9d7e18a832fcec17433011b09aaf97333cfa4b1f3bdc570`.
- Remaining implementation explicitly out of scope: native parity for the
  independently owned gameplay Settings contents after the now-enabled handoff.

## 2026-08-29 Website cheat-menu entry extension

The requested live debugging panel does not join the authoritative pause
owner: both the client and host deliberately reject Lua during Pause and resume
grace, while the panel must execute its commands immediately. Gameplay keeps
the exact native three-row menu when cheats are unavailable. An authoritative
ordinary cheat host or sealed developer admission instead authors one explicit
Website row, `CHEAT MENU`, between Resume and Settings through the already
validated variable-row `SimpleMenu` plan. Selecting it completes the native
close animation, releases Pause normally, and opens the input-blocking live
panel. The four-row geometry is the same shared plan already proved by the Dark
Cloud's native four-row menu; no native Pause row, action result, atlas member,
timing constant, or authority rule is reinterpreted.
