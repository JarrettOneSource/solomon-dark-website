# 2026-08-26 — Hub-wide Boneyard run-entry affordance and authority

## Reported smell and parity question

- Reported web behavior: the stock play triangle is absent from the map HUD,
  and pressing the map control outside the Courtyard does not start a run.
- Stock behavior to recover: the complete map-control presenter, its fixed
  tick, every visual branch, its one activation callback, room/radius gates,
  authority, picker split, and teardown.
- Reproduction surface: every stable Hub region (`courtyard`, `mortuary`,
  `library`, `storeroom`, `office`), pointer/touch and the controller fallback,
  default-only and multi-Boneyard catalogs, solo/private College and shared-Hub
  parties.
- Falsifiers: any ordinary frame with no College record 17 submission; a
  compass/play alpha pair outside the float32 complementary contract; a
  nominal cycle other than 360 authoritative ticks; any player-position or
  current-room test in the activation chain; or
  a shared party member being omitted from the frozen launch roster because
  they occupy another stable Hub room.
## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | unmodified Beta 0.72.5 `SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred image base `0x00400000`; canonical `SolomonDark` Ghidra project via replica wrapper | same retail image as the prior map-picker and HUD reports | high |
| Presenter instructions | complete `0x0050DBF0`; raw `0x0050DDB2..0x0050DF3B`; `sin` wrapper `0x007470D0`; constants float32 pi `0x00B4027C`, double 180 `0x007DE888`; Courtyard tick `0x0050C970` at `0x0050D3FA` | record 16 is fixed; record 18 compass alpha is `f32(0.5 + 0.5*f32(sin(f32(f32(tick)*f32(pi)/180))))`; record 17 play receives the float32 complement on the normal branch; Courtyard `+0x8EA4` increments once per 100 Hz tick, giving a nominal 360-tick/3.6-second sine cycle without resetting the counter | high, instruction-derived |
| Branch/xref sweep | `refs_to_addr_decompile.py` for `0x0050DBF0`, `0x0050E5E0`, and `0x00514A20`; `Game::RenderHud 0x005D2520`; `Game_AttachRegion 0x005CBA00`; `Game_HandleControlAction 0x005D8120` | the presenter has one caller (`0x005D3D02`); start/toggle has one caller (`0x00514AB9`); the control is attached and forwarded while persistent `DAT_00819A70` exists. No distance, player coordinates, or current fixed-room id is read; only the common region-fade gate `+0x8E48` blocks action | high, instruction-derived |
| Authored asset data | exact `College.png` SHA-256 `34c10e60d30590b6211c678152d47cc30033679db5c986dc615d9923a71c43bd`, `College.bundle` SHA-256 `30c4de0227568bc38db18afa37c689da7b511205549da4b2ae97149c93ca772c`; records 14..18; existing registered web extractions `hub-hud-parchment.png`, `hub-hud-map-play.png`, `hub-hud-map-compass.png` | record 14 is the return arrow, 15 unavailable, 16 parchment, 17 play, 18 compass. The exact record-17 web asset already exists (`d26b8703…`) but no current component consumes it | high |
| Current web causal trace | `GameHud.tsx`, `HubScene.tsx`, `host/game-host.ts`, `host/shared-game-worlds.ts` at Website `799691a9`; history `0cab1787` | `GameHud` hard-codes only `hub.hud.mapCompass`; the 2026-08-13 direct-start rewrite removed `mapActive` and made `mapPlay` unreachable. React pointer and controller paths, private-host message acceptance, and shared-party partition independently require `region === 'courtyard'`; the party layer requires every member there | high |

## System boundary and membership inventory

Native system: the persistent College HUD run-entry control from its fixed-tick
presenter and authored five-record state bank through UI activation, picker or
direct choice, authority validation, party roster freeze, Boneyard entry, and
Hub teardown. World portals and unrelated trader proximity interactions end
outside this boundary.

| Member | Native/current source | Disposition | Proof |
| --- | --- | --- | --- |
| parchment base | College 16, `Game+0xC78` | `verified-already-at-parity` | exact registered 121 x 118 asset, hash/dimension gate, unchanged anchor/hit rectangle |
| ordinary compass layer | College 18, `Game+0xE00` | `exact-ported` | authoritative-tick alpha kernel and per-tick/layer browser assertions |
| ordinary play layer | College 17, `Game+0xD3C` | `exact-ported` | exact existing asset becomes a live sibling with complementary alpha; browser pixel/layer receipt |
| open-picker return layer | College 14, `Game+0xAF0` | `out-of-system` (the browser mod-catalog picker is a centred modal with its own explicit Cancel owner; the covered HUD button cannot toggle it) | picker modal/cancel journey remains independently covered |
| unavailable/story layer | College 15, `Game+0xBB4` | `out-of-system` (the browser survival route has no stock story-unavailable mode) | no Website producer for the retail `+0x8EA0` story branch |
| transition suppression | Courtyard `+0x8EA8` | `exact-ported` | transition forces compass alpha one/play zero before scene teardown |
| optional `CLICK HERE / WHEN YOU ARE / READY TO PLAY` painter | `DAT_00B3BCA1`, application tick `% 200 > 20` inside `0x0050DBF0` | `out-of-system` (member of the separate global teaching-hint system, not a second run-entry target; browser has no retail teaching-hint global) | branch/global xrefs recorded in the Mod Loader map-picker report |
| pointer/touch activation in all five stable Hub regions | `Game+0xE00 -> 0x00514A20 -> 0x0050E5E0`; no radius/current-room read | `exact-ported` | source contract plus real browser launch from a private room |
| controller fallback after nearer player/NPC priority | Website controller extension over the same action owner | `exact-ported` browser policy | source contract and input test; region guard absent |
| default-only catalog | selected authoritative default | `verified-already-at-parity` apart from the room gate | map press sends one existing `client-start-match` intent directly |
| multi-Boneyard catalog | browser mod picker | `verified-already-at-parity` web extension | leader-only picker and cancel remain unchanged |
| private/standalone authority | `game-host.ts` `client-start-match` branch | `exact-ported` | stable `library`/other-room host test enters one Boneyard |
| shared-Hub leader and all current party members | `startSharedPartyRun` | `exact-ported` web extension | leader in one private room and member in another are frozen into the same run; nonleader and already-running rejection remain |
| room-fade/transient member | native `+0x8E48`; web participant transition | `verified-already-at-parity` | input remains blocked until the room transition is stable; no queued launch crosses the fade |
| connected nonauthority | loader suppression; browser party leader policy | `verified-already-at-parity` policy | only the current party leader/room host can author the selection; this change removes no authority gate |
| run scene and post-run return | Boneyard scene/loadout merge owners | `out-of-system` (downstream lifecycle unchanged) | existing loaded-scene, run, Game Over, and merge suites |

## Native ownership thread

- Owner/construction: the persistent Courtyard (`DAT_00819A70`, vtable
  `0x00792644`) owns the run-entry control at `Game+0xE00` and the phase at
  `Courtyard+0x8EA4`; `Game_AttachRegion 0x005CBA00` attaches that control with
  the Hub shortcut family.
- Producer/state: `Courtyard::Tick 0x0050C970` advances the integer phase. The
  normal presenter has no ready boolean: compass and play are simultaneous
  complementary draws. Picker presence/closing, unavailable byte `+0x8EA0`,
  and run-transition byte `+0x8EA8` select the other branches.
- Consumers: the sole HUD call is `0x005D3D02`; the sole activation call is
  `0x00514AB9`. `0x0050E5E0` toggles an existing MapPicker or constructs one,
  and the selected-path helpers retain the established Arena transition.
- Authority/replication: retail offline/loader authority chooses one path. The
  browser maps that seam to the current host/party leader, server materializes
  one choice/seed, freezes the complete stable Hub roster, then publishes the
  loaded scene and snapshot to that run only.
- Teardown: run transition suppresses the play layer; Hub unmount removes the
  control. Picker cancel and post-run Hub merge remain owned by their existing
  modal/run lifecycle.

## Recovered behavioral contract

- Timing: integer fixed tick at 100 Hz; float32 store boundaries as listed in
  the evidence table; play is the float32 complement of compass; nominal
  period 360 ticks without an artificial phase reset.
- Geometry/order: fixed `121 x 118` parchment at `right 17 / bottom 16`, then
  compass, then current action record, all at the same authored registration.
  The entire rectangle is the screen-space hit target; no world collision or
  distance participates.
- Input: pointer/touch activates from any stable Hub region. Controller A keeps
  nearer same-region player and NPC/service priority, then falls through to
  the same run-entry owner from any stable region.
- Network: selection remains leader-authoritative. Every current party member
  may occupy any stable Hub region and enters the same frozen run. A room fade,
  modal, gameplay pause, level barrier, nonleader, unavailable catalog entry,
  or already-running party remains rejected.

## Nearby-system findings

- The 2026-08-12 ledger incorrectly called College 17/18 mutually exclusive
  fresh/ready states. The 2026-08-13 direct-start correction removed the fake
  ready toggle correctly but replaced both native draws with a permanent
  compass, leaving the exact play asset imported yet unreachable.
- The global teaching-hint branch shares the renderer but has distinct global
  ownership and cadence. Its full membership is recorded rather than silently
  inferred to be part of the button state.
- Reusable retail findings are also recorded in
  `Mod Loader/docs/re/map-picker.md`; no new address or catalog row is needed.

## Confidence and open questions

- Confirmed: all presenter records/branches, exact alpha arithmetic and period,
  singular render/activation xrefs, absence of radius/current-room reads, and
  every web room guard that caused the regression.
- Inferred: `DAT_00B3BCA1` is the shared teaching-hint enable lane from its
  three xrefs; that label is immaterial to run-entry behavior and is kept
  outside this port boundary.
- Unknowns/blockers: none. No browser platform approximation is required.

## Web implementation consequence

- Add the exact fixed-tick presentation calculation to the existing Hub
  presentation kernel and drive both exact image layers from authoritative
  snapshot tick; do not use CSS wall-clock animation or a ready-state toggle.
- Remove only the current-room checks from React pointer/controller activation,
  private host acceptance, and shared-party partition. Preserve host/leader,
  stable-transition, pause, level barrier, catalog, and run-state gates.
- Delete the now-dead `not-in-courtyard` rejection vocabulary. Do not add a
  portal, proximity sensor, second Start button, fallback, or compatibility
  path.

## Validation contract

- Kernel: tick `0/90/180/270/360`, float32 alpha/complement, the native
  rounding residual at 360, and transition suppression.
- Wiring: parchment/compass/play order, exact assets, authoritative tick use,
  and no current-region condition in pointer or controller entry.
- Authority: private host starts from a private room; shared leader/member in
  different stable rooms enter the same run; nonleader and transitions remain
  rejected.
- Mac Chrome/WebGL2: enter a private Hub room, capture the live map with both
  layers and changing complementary opacities, press it there, receive the
  exact loaded Boneyard, and require empty page/console/failed-response arrays.
- Run `/opt/homebrew/bin/bash ./scripts/validate.sh` on the byte-identical Mac
  candidate. Publication/deployment remain separate and are not authorized by
  this fix request.

## Implementation validation receipt

- Implementation: `hubRunEntryPresentation` in `hub-presentation.ts` mirrors
  the retail float32 angle/sine/complement stores from authoritative snapshot
  tick. `GameHud.tsx` now paints parchment, compass, then play at their shared
  121 x 118 registration and forces the native transition state through
  `mapTransitionActive`. `HubScene.tsx`, `game-host.ts`, and
  `shared-game-worlds.ts` remove only the Courtyard-room predicates; every
  host/leader, stable-transition, pause, barrier, catalog, and run-state gate
  remains. The dead `not-in-courtyard` rejection is removed.
- Coverage: the presentation test pins ticks 0/90/180/270/360, the native
  float32 residual/complement, and transition suppression; the Hub UI contract
  pins both exact layers and pointer/controller wiring without a room guard;
  private-host and shared-party tests start from `library`/`mortuary` while a
  member with a live room fade is still rejected.
- Exact candidate: local Website base and Mac detached base are both
  `799691a9732ec43f11e2c13b6f12ce308cdcc64d`; all 11 changed Website files
  were SHA-256 manifest-identical before validation. Local/remote Mod Loader
  base is `e6d87de2c35151ad4f8b8281dc017c91fc78564f`; its one changed report was
  manifest-identical.
- Mac validation: pinned Homebrew Python 3.14.7/Pillow 12.3.0 runs
  `tests/re/run_static_re_tests.py --ci` at 509/509. The canonical Website
  `/opt/homebrew/bin/bash ./scripts/validate.sh` passes 2,339/2,339 tests with
  zero failures, backend Release build zero warnings/errors, TypeScript/lint,
  production frontend and game-host builds, media policy, and bundle budget.
  `Game-Nohgobun.js` is 468,699 raw / 130,890 gzip bytes against 524,288 /
  134,144 limits.
- Browser evidence: Mac Chrome 151.0.7922.174 loads the production-built
  assets, enters `library`, and presents both exact assets at screen rectangle
  `(1462,766,121,118)`. The exact compass and play source hashes are
  `1b616416…` and `d26b8703…`. Three authoritative samples change from
  compass/play `0.0170372/0.982963` to `0.116978/0.883022`, with the pair
  remaining complementary. Clicking `Enter the Boneyard` from Library removes
  the Hub/map and leaves both browser and authority in `boneyard`. Page,
  console, and failed-response arrays are empty.
- Visual inspection: `library-map-play-crop.png` clearly shows the stock play
  triangle over its crossfaded compass/parchment; the full Library frame proves
  private-room ownership, and `library-map-boneyard.png` proves the resulting
  run. Receipt/evidence SHA-256 values are `a12d9ad8…` (JSON), `5d790b28…`
  (Library), `d6017381…` (map crop), and `ea413342…` (Boneyard).
- Prepublication evidence was retained under Mac
  `/Users/jarrett/codex-acceptance/boneyard-hub-play-button-20260826-root/evidence`
  and local `/home/user/.codex-evidence/boneyard-hub-play-button-20260826`.
  Their hashes above preserve the receipt after the authorized post-push
  cleanup removes those transient files. Every task-owned backend, host,
  Chrome, and acceptance process exited. There is no blocked-by-platform
  member or remaining material unknown.
- Publication: the owner authorized a normal fast-forward push to both mains
  and complete task-scaffolding cleanup on 2026-08-26. The final local,
  tracking, and remote commit identities are reported in the task completion
  receipt. Deployment remains a separate, unauthorized action.
