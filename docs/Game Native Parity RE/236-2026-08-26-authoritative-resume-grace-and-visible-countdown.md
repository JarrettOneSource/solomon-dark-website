# 2026-08-26 — Authoritative resume grace and visible countdown

## Reported smell and parity question

- Requested browser behavior: keep an active match held for three seconds after
  multiplayer Pause Menu, Inventory, Skill Book, compact skill-selector, or
  mandatory SkillPicker release. Apply the same grace after an active game is
  rejoined or restarted, including solo play, and show a `3`, `2`, `1`
  countdown before simulation resumes.
- Scope distinction: menu/picker release receives grace only when more than one
  connected human is materialized in that active run. Active-run rejoin and an
  active saved-run restart receive grace for one or more players. Hub, title,
  Create, loading, Game Over, and loadout are not active-match consumers.
- Falsifiers: a client-only timer while authority continues ticking; a rejoin
  countdown that expires behind the loading screen; elapsed wall time replayed
  as catch-up ticks; a solo menu close receiving grace; a disconnect-owned
  pause release starting grace; or one party's hold freezing another shared
  world.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Existing retail pause evidence | retail Beta 0.72.5 SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; `0x005CBD40`, `0x00427800`, `0x005ABF10` | Gameplay modal suspension is nestable, wall-clock UI remains live, and final release resumes on the next ordinary scheduler edge with no native three-second grace. | high |
| Existing retail Inventory/SkillScreen evidence | Inventory `0x00555810`/`0x005684C0`; SkillScreen `0x006567E0`/`0x006588C0`; shared suspension xrefs in `native-gameplay-pause.md` | Inventory and SkillScreen independently balance the same region hold. Inventory's current web surface closes immediately; SkillScreen's web presentation closes over 40 10-ms ticks. Neither supplies a native grace countdown. | high |
| Existing retail LevelupScreen evidence | `0x0067CAC0`, `0x006588C0`, `LevelupScreen_Render 0x0067DF80`; durable SkillPicker entries above | The mandatory picker owns a separate actor/world barrier and live presentation clock. Choice completion releases that barrier without a native post-close countdown. | high |
| Existing active-rejoin evidence | `Gameplay_SwitchRegion 0x005CDDD0`, attach `0x005CBA00`, full reset `0x005CF920`; 2026-08-24 active-party entry above | A returning actor materializes into the retained active run with cleared transient input/action state. Browser renderer readiness is downstream of host attachment and is the correct edge before a user-visible countdown can start. | high |
| Current Website causal trace | original focused base `ec9c16c0f629d8fcb7fa61bb8fba81e9e023dbf3`, rebased over current `origin/main`; `game-host.ts`, `game-client-session.ts`, `MainMenuScene.tsx`, `GameplayPauseMenu.tsx`, `SkillPicker.tsx`, `SkillBook.tsx`, `HubInventoryUi.tsx` | Pause and modal release currently remove the host hold immediately; final level-up choice clears `levelUpBarrier`; resumed active saves and party rejoin can begin ticking as soon as transport is welcomed, while `MatchLoadingScreen` remains above the world until its renderer-ready callback. | high |

No new retail instruction, address, asset, or authored table is required. The
three-second policy and multiplayer scope are user-required Website behavior,
not a claim about retail. Existing Mod Loader reports remain authoritative and
unchanged.

## System boundary and membership inventory

System boundary: one run-scoped authoritative resume-grace owner begins at an
eligible release/materialization edge, holds fixed simulation and input while
application, transport, rendering, and its presentation clock remain live, and
ends after exactly 3,000 monotonic milliseconds. The client receives only a
strict projection and cannot shorten or release the hold.

| Member / branch | Disposition | Required contract |
| --- | --- | --- |
| Multiplayer Pause Menu owner selects Resume | `exact-ported` as Website extension | native close completes, surface pause atomically becomes a 3,000-ms run hold, all peers see `3,2,1` |
| Multiplayer gameplay Settings closes its retained Pause owner | `exact-ported` as Website extension | same Pause release edge and countdown; no nested-owner early release |
| Pause owner disconnects | `verified-already-at-parity`, explicitly no grace | clear owner, inputs, and hold immediately so a departed client cannot strand peers |
| Multiplayer Inventory close | `exact-ported` as Website extension | existing close/audio/Tutorial edge remains; run then holds for `3,2,1` |
| Multiplayer full Skill Book close and Inventory handoff | `exact-ported` as Website extension | 40-tick close remains live; grace begins only when the modal owner actually releases; handoff keeps the pause and starts no intermediate countdown |
| Multiplayer compact HUD skill-selector close | `exact-ported` as sibling Website extension | source-qualified pause release receives the same grace |
| Multiplayer mandatory SkillPicker final cohort release | `exact-ported` as Website extension | final barrier removal installs the run hold; the three-second clock starts after the final chooser's close presentation completes |
| Solo Pause/Inventory/Skill Book/selector/SkillPicker release | `verified-already-at-parity`, explicitly no grace | immediate next ordinary fixed tick, with existing input clear and no catch-up |
| Active-party rejoin with no catch-up picker | `exact-ported` as Website extension | host installs a pending hold before welcome; countdown starts only after the returning Boneyard renderer reports ready |
| Active-party rejoin with catch-up picker(s) | `exact-ported` as Website extension | rejoin hold composes with the level barrier; the three seconds start only after materialization, picker resolution, close presentation, and renderer readiness |
| Active saved-run resume after browser/app/server restart | `exact-ported` as Website extension | same pending-ready hold and countdown, including one-player standalone/private runs |
| Same-player active connection takeover | `exact-ported` as Website extension | treated as active rejoin; old socket cannot acknowledge or release the new sequence |
| Two simultaneous returners | `exact-ported` as Website extension | one run hold waits for every addressed renderer-ready acknowledgement, then emits one sequence/countdown |
| Rejoin while another gameplay pause or level barrier exists | `exact-ported` as composition rule | grace remains pending until all older run holds clear; no countdown burns under another modal |
| Late peer/observer during an active countdown | players `exact-ported`; observer `out-of-system` | player welcome carries current positive remaining milliseconds; observers remain read-only and do not own gameplay HUD |
| Shared Hub and unrelated party runs | `out-of-system` | the map key is the active party/run scope; one countdown never freezes Hub or another run |
| Initial new match/Tutorial entry | `out-of-system` | this request says rejoin/restart, not first start; existing authored entry/loading lifecycle remains |
| Hub, title, Create, ordinary loading, Game Over, loadout | `out-of-system` | no active-run grace admission or timer |

There is no browser-blocked member. `performance.now()` supplies a monotonic
host duration; the client presentation derives whole seconds from the
host-issued remaining duration and its own monotonic receipt time. Authority,
not the visual timer, owns expiry.

## Recovered ownership and implementation consequence

- Add a distinct `GameplayResumeGraceState` to the strict game protocol rather
  than overloading the player-owned Pause Menu record. It carries a monotonic
  sequence, enumerated reason, and nullable remaining milliseconds (`null`
  means renderer/picker readiness or an older hold is still pending).
- The host owns standalone and per-party grace records, target-ready sets,
  deadlines, expiry, input clearing, late-welcome projection, and fixed-tick
  admission. Shared-world stepping receives the union of paused and grace-held
  party IDs; standalone stepping admits neither while either owner exists.
- Add one authenticated, sequence-qualified presentation-ready intent. A
  client may acknowledge only its current pending rejoin/restart or final
  SkillPicker-close grace. A stale, unrelated, or repeated acknowledgement is
  inert and cannot release the hold. The host begins the clock only when all
  addressed clients are ready and no gameplay pause or level barrier remains.
- Pause/modal release atomically removes its surface owner and starts grace
  only when the active run has more than one connected materialized human.
  Disconnect release never enters grace. Final level-barrier removal installs
  the same run owner but waits for the final local close presentation.
- Keep local input, prediction, interpolation, chat, menu admission, and scene
  actions blocked for the complete grace. Continue presentation frames so the
  countdown and retained world render normally; expire by host wall clock,
  clear all queued input again, reset the standalone next-tick deadline, and
  never replay elapsed time.
- Render one noninteractive, screen-centered, accessible `RESUMING IN`
  `3`, `2`, `1` countdown above the retained game once authority starts the
  clock. Pending readiness stays behind loading/picker presentation and has no
  invented numeric value. The component clock cannot mutate authority.
- Bump the wire protocol to 83. No save-schema change is required: grace is
  ephemeral run/session state and every saved continuation still restores
  through the existing active-run ownership path.

## Validation contract

- Protocol/client: strict reasons, duration/sequence bounds, welcome and live
  projection, malformed rejection, stale-ready suppression, input/prediction
  hold, listener cleanup, and `3 -> 2 -> 1` presentation boundaries.
- Host standalone/shared: every menu source, Settings release, disconnect
  release, solo negatives, level-barrier final/earlier choices, same-tab
  takeover, saved active restart, immediate and catch-up active rejoin,
  simultaneous returners, late join, other-party isolation, exact >=3,000-ms
  fixed tick, and no catch-up after expiry.
- Browser on the Mac mini: real two-client Boneyard journeys for Pause,
  Inventory, Skill Book, compact selector, and mandatory SkillPicker; one
  active-party rejoin and one solo saved active restart. Capture countdown
  digits and authoritative tick/player/enemy stability, then one ordinary
  resumed tick lane. Require empty page/console/network/host errors.
- Run the exact candidate through `/opt/homebrew/bin/bash
  ./scripts/validate.sh` and compare the Mac changed-file manifest byte-for-byte
  before publication.

## Implementation validation receipt

- Protocol 83 carries a distinct strict `gameplayResumeGrace` welcome/live
  projection and sequence-qualified `client-resume-grace-ready` intent. The
  host owns standalone and per-party pending/active grace records, input clear
  on both boundaries, wall-clock expiry, late welcome, disconnect cleanup, and
  the union of pause/grace party holds. Clients block input/prediction/menu
  admission and derive only the visible whole seconds.
- Pause Menu, Settings, Inventory, Skill Book, and compact selector release
  through the existing source-qualified pause owner. The mandatory
  SkillPicker waits for its final browser close. Rejoin/restart waits for
  renderer readiness and composes with catch-up offers and older barriers.
  Solo menu release stays immediate; solo active saved-run restart still gets
  grace. Raw acceptance peers now report their exact picker-close edge instead
  of leaving a synthetic pending waiter.
- The byte-identical Mac candidate passes the complete canonical Website gate:
  backend build with zero warnings/errors, 24 backend/contract tests, 282
  prerequisite tests, 1,591 Boneyard/game tests, every Web Lua/loot/ML/weather/
  party/level-up/tutorial/diagnostic/Hall/Hub UI/desktop group, lint and import
  boundaries, production TypeScript/build, bundle budget, and media policy.
  The production Game entry is 468,699 raw / 130,891 gzip bytes against
  524,288 / 134,144.
- Mac Chrome 151 `smoke:game:pause` observes ordered `3,2,1` values for
  multiplayer Inventory, Skill Book, compact selector, and Pause Menu while
  each authoritative Boneyard receipt remains exact. Owner disconnect resumes
  without grace. After both raw peers leave, the final browser saves/exits,
  reconnects through Last Game on a reset host, and holds restored solo tick
  `2475` for the `game-restarted` countdown. Page/console errors are empty.
- The multiplayer LevelupScreen journey holds tick `10287` through both clients'
  `skill-picker-closed` countdown and resumes on exactly `10288`; retained world,
  death effects, independent player VFX/audio, and both distinct offer sets
  remain correct with empty page/console errors.
- The active-party global-Hub journey leaves, advances live peers, rejoins the
  exact run/player, resolves eight ordered catch-up offers, holds tick `1355`
  through `game-rejoined` `3,2,1`, rotates the owner save token, and resumes
  normally. Page, console, request, response, and host-error arrays are empty.
  Private/standalone authority, staged rejoin, same-player replacement,
  disconnect, and saved restart are independently covered by the canonical
  host/client matrix.
- Visual inspection confirms the centered gold `RESUMING IN 3` panel over the
  retained multiplayer and restored-solo Boneyards. The inspected multiplayer
  evidence SHA-256 values are
  `c8c798cda623d0c8cc7699bdc3d8271ceb8f1af48904abd5bc7b5e81c3125570`
  (multiplayer) and
  `aedb2ee623cf1f4422fe1e70779bb81ad52d1834b072a920f8c90f39ae544ec0`
  (solo restart).
- No browser-platform exception, unresolved native fact, or material unknown
  remains. No reusable retail fact changed, so Mod Loader documentation stays
  unchanged. Publication is authorized; deployment is not implied.
