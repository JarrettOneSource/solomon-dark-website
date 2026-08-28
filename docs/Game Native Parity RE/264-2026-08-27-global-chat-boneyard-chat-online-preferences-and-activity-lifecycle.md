# 2026-08-27 — Global chat, Boneyard chat, online preferences, and activity lifecycle

## Reported smell and parity question

- Reported web behavior: protocol 49 names a `Global` channel, but the host
  admits and delivers it only while both sender and recipient are resident in
  the shared Hub. Entering any party Boneyard removes that connection from the
  route. Boneyards expose the cross-transition `Party` channel rather than a
  match-owned channel. There is no Global receive toggle, online-feature
  settings family, activity transcript, or per-player server-run-submission
  preference.
- Requested behavior: Global reaches every opted-in authenticated participant
  on the process-wide shared-Hub host, including participants in every active
  Boneyard. A Boneyard adds a match-scoped `Boneyard` tab and selects it on
  entry; a later manual selection survives chat close/reopen for that run.
  Global and Whisper delivery remain live while Boneyard is selected. Join,
  match-start, and disconnect edges publish the exact Global activity lines
  `X has entered the college.`, `X is searching for Solomon.`, and
  `X has left the game.`
- Settings add one master and four subordinate local preferences near the top:
  Online Features, Activity Messages, Global Chat, Shared Hub, and Submit Runs
  to Server. The master is an effective gate for all four children. Disabling
  activity prevents both emission and receipt; disabling Global also prevents
  activity receipt/emission. Disabling Shared Hub selects a private College on
  the next admission. Disabling Submit Runs prevents that player's future run
  from producing either a global leaderboard submission or Memoratorium row,
  without suppressing the local Hall or another party member's result.
- Reproduction: Website `c9373a65de29222acdf02453ddd3f8a1923abae9`;
  `game-host.ts:5016-5035` requires Global sender/recipients to have Hub world
  state; `game-chat.ts` returns Party alone for every Boneyard; Settings has no
  online fields; `stepSharedGameWorlds` archives every completed player while
  `publishLeaderboardReceipts` issues every otherwise eligible connected
  player's receipt.
- Falsifiers: the supervisor actually partitions Hub and Boneyard players into
  different hosts; a run has no stable identity independent of party; the
  current connection is replaced at world transition; Memoratorium and signed
  leaderboard output share one all-party eligibility bit; or the client can
  prevent a join activity edge with a post-welcome update alone.
## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Settled native negative census | retail Beta 0.72.5 `SolomonDark.exe`, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000`; Mod Loader `native-player-chat-boundary.md` | Retail owns no player-authored chat, party/global route, activity feed, or server-submission preference. These are explicit Website product rules; the native contribution remains modal input priority only. | high |
| Current host causal trace | Website `c9373a65`; `game-host.ts` authentication/client map, `beginSharedPartyRun`, close `release`, `chatRecipients`, `publishLeaderboardReceipts`; `shared-game-worlds.ts` | One process owns the shared Hub and every party run. The same authenticated socket moves between them. Global is artificially narrowed by `world.kind === 'hub'`; exact run state already identifies Boneyard recipients. Leaderboard and memorial outputs are separate per-player consumers. | high |
| Current client/UI trace | `game-client-session.ts`, `game-chat.ts`, `GameChat.tsx`, `MainMenuScene.tsx` | One session transcript already survives scene replacement and stores other-channel messages/unread counts. The world-change effect can select a Boneyard default while ordinary channel selection already survives close/reopen. A pre-welcome preference is required to suppress the join emission. | high |
| Current settings/admission trace | `game-settings.ts`, `GameSettingsDialog.tsx`, `MainMenuScene.tsx`, `Game.tsx`, `game-bootstrap.ts` | Settings are normalized browser-local state. Clean New Game/resume/Tutorial paths currently choose Global Hub directly; private College already exists as the correct no-shared-Hub destination. Runtime preference changes need one authenticated sideband update. | high |
| Existing completion authority | `shared-game-worlds.ts:424-512`; `game-host.ts:6077-6118`; local `HallOfFameRunRecorder` | Memoratorium archive, signed global receipt, and local Hall recording are three independent consumers. The requested preference gates only the first two server-owned outputs. | high |

## System boundary and membership inventory

System: **Website online communication, activity, admission, and run-submission
preferences**, beginning at normalized local preference/admission and client
hello, continuing through authenticated host routing and Hub/run transitions,
and ending at disconnect or per-player run completion. Chat remains ephemeral
sideband state; preferences do not enter simulation snapshots or saves.

| Member / branch | Owner/source | Disposition | Proof contract |
| --- | --- | --- | --- |
| retail player chat/activity/settings | settled native negative census | `out-of-system` | no stock behavior is claimed for the Website extension |
| shared-Hub singleton Global send/receive | host authenticated client set | `exact-ported` requested policy | every opted-in connected shared-host participant receives one authoritative echo |
| grouped shared-Hub Party and Global | party system plus host client set | `exact-ported` requested policy | Party stays party-only; Global ignores party boundaries |
| Global sender/recipient in any active shared-host Boneyard | host client set, independent of active world | `exact-ported` requested policy | Hub and multiple-run participants exchange Global in both directions |
| private College / standalone Global branch | non-global session kind | `out-of-system` | Global remains unavailable because there is no process-wide shared Hub |
| Hub Party channel | authoritative current party | `verified-already-at-requested-policy` | remains scoped to members and defaults for a newly grouped Hub participant |
| Boneyard channel | exact authoritative run state / run id | `exact-ported` requested policy | sender and recipients must occupy the same live match; outsiders and other runs receive nothing |
| Boneyard entry default | session-scoped chat world edge | `exact-ported` requested policy | first open after Hub -> Boneyard selects Boneyard |
| manual Boneyard selection persistence | session-scoped channel state | `verified-already-at-requested-policy`, relabeled | Global/Boneyard/Whisper choice survives close/reopen while the world is unchanged |
| Whisper in Hub and Boneyard | explicit target resolved on the same host | `verified-already-at-requested-policy` | exact pair delivery remains independent of selected tab |
| Global receive checkbox beside tab | `GameChat` plus normalized settings owner | `exact-ported` requested policy | uncheck immediately prevents send/receive and activity; recheck persists and restores the lane |
| Global/Whisper arrival while Boneyard is selected | client session history and per-channel unread | `verified-already-at-requested-policy`, strengthened | event is retained/announced without changing selection |
| entered-college activity | successful non-replacement authentication materialized in the process-owned shared Hub world | `exact-ported` requested policy | opted-in peers in Hub and Boneyards receive the exact line; actor opt-out emits nothing |
| searching-for-Solomon activity | accepted ordinary Boneyard start after state partition succeeds | `exact-ported` requested policy | one line names the initiating leader; rejected starts and Tutorial do not emit |
| left-game activity | authenticated client release | `exact-ported` requested policy | remaining opted-in peers receive one line; resume takeover is not a false departure |
| activity sender opt-out | hello/runtime online preferences | `exact-ported` requested policy | no join/start/leave event is emitted for that actor |
| activity recipient opt-out / Global opt-out | host delivery filter plus client defensive filter | `exact-ported` requested policy | neither activity nor Global text is delivered or counted unread |
| Online Features master | normalized effective preference policy | `exact-ported` requested policy | all four subordinate behaviors are effectively off; stored child choices may resume when re-enabled |
| Activity Messages child | normalized setting plus host preference | `exact-ported` requested policy | independently gates activity emission and receipt |
| Global Chat child | normalized setting plus tab checkbox and host preference | `exact-ported` requested policy | independently gates Global text and also activity |
| Shared Hub child — fresh New Game | admission selection | `exact-ported` requested policy | clean vanilla play requests private College when disabled |
| Shared Hub child — ordinary resume fallback | admission selection | `exact-ported` requested policy | absent active-party rejoin falls back private when disabled |
| Shared Hub child — Tutorial and public-party admission | admission selection/policy | `exact-ported` requested policy | Tutorial remains playable privately; an explicit Global-Hub party join is not allowed to bypass the preference |
| Shared Hub child changed during a live session | session/admission lifetime | `out-of-system` for live migration | setting affects the next admission; it does not teleport an active authoritative wizard between hosts |
| Submit Runs child — signed leaderboard receipt | host per-player completion consumer | `exact-ported` requested policy | opted-out player receives no receipt/API submission; opted-in teammates remain eligible |
| Submit Runs child — shared Memoratorium portrait | shared-world per-player completion consumer | `exact-ported` requested policy | opted-out player adds no portrait; RNG advances only for actually archived portraits |
| local Hall of Fame | browser-local recorder | `out-of-system` from server-submission gate | local row remains available regardless of Submit Runs |
| preference change during a session | authenticated client preference message | `exact-ported` requested policy | host applies the newest complete preference set immediately; no snapshot/save mutation |
| initial hello and reconnect/rejoin | strict protocol plus new connection settings | `exact-ported` requested policy | initial opt-out precedes join activity; rejoin uses current local preferences |
| transcript, save, snapshot, Lua, logs, offline delivery | existing exclusion boundary | `verified-already-at-requested-policy` | no message content/preferences are persisted or exposed; activity is bounded sideband only |
| developer observer | existing read-only observed-run projection | `out-of-system` from requested participant settings | observers neither emit activity nor join Global membership; existing observed-run chat policy is unchanged |

No member is `blocked-by-platform`. HTML controls and the existing strict
WebSocket sideband represent the requested policy directly.

## Ownership thread and behavioral contract

- Local ownership: `game-settings.ts` stores the master and four child choices
  and derives effective online preferences. The master gates all children;
  Global additionally gates activity. Shared-Hub choice is consumed at the
  next admission. The current client session receives effective activity,
  Global, and Submit Runs values at hello and on each settings change.
- Host ownership: an authenticated `HostClient` owns its current effective
  preferences. The client never supplies sender identity, activity text, run
  identity, leaderboard fields, or Memoratorium data. Global routing uses all
  open non-staging clients on a `global-hub` host. Boneyard routing uses exact
  live-world identity. Party and Whisper keep their existing authoritative
  membership/target owners.
- Activity lifecycle: join emits only after authentication and only for a
  real Hub participant; start emits only after `startSharedPartyRun` accepts;
  leave emits once after the socket ceases to be the live client. Resume
  takeover suppresses the superseded socket's release and does not describe a
  transport replacement as player activity. Activity shares the bounded,
  monotonic chat sequence and Global transcript but is not world speech.
- Completion lifecycle: Submit Runs is evaluated per player at the completion
  edge. It does not taint the party's score integrity, remove local Hall state,
  or change teammates. Memoratorium filtering happens before portrait RNG and
  persistence; receipt filtering happens before signing and delivery.
- UI lifecycle: a Global checkbox is a separate accessible control adjacent
  to the Global tab. Disabled Global cannot send and receives no new Global or
  activity entries. Entering a Boneyard resets selection once to Boneyard;
  subsequent close/open and unrelated deliveries do not reset it.
- Bounds and exclusions remain: normalized 180-code-unit/512-byte player text,
  five messages per five seconds, 80-entry client history, no content logs,
  no save/snapshot/Lua transcript, no offline/cross-host delivery.

## Nearby-system findings

- `sharedWorlds` is the stable process-wide topology already needed for truly
  Global routing; no new cross-supervisor broker or transcript service is
  required.
- Memoratorium eligibility cannot be inferred from `accountUsername` or
  `globalScoreEligible`: anonymous eligible players may still be memorialized,
  while Submit Runs is a separate voluntary per-player output gate.
- A protocol update after welcome cannot suppress the join event reliably.
  The complete effective preference set must therefore be required in
  `client-hello`; runtime updates cover later checkbox/settings changes.
- No prior `Enable Shared Hub` field exists in reachable Website history. The
  existing private-College admission path supplies the requested behavior
  without a compatibility session type.
- Native report/catalog update: none. The settled
  `native-player-chat-boundary.md` already dispositioned the complete absent
  stock family and this pass recovers no new retail fact.

## Confidence and open questions

- Confirmed: host topology, all current channel predicates, session continuity
  across Hub/run, settings/admission owners, activity entry/start/close edges,
  leaderboard receipt path, Memoratorium archive path, and local Hall
  independence.
- Designed, not native: channel names/order, exact activity copy, preference
  defaults, activity/global coupling, and per-player server-submission policy.
- Unknown material to implementation: none.
- Browser-specific approximation: none.

## Web implementation consequence

- Increment the strict gameplay protocol and add Boneyard channel membership,
  semantic activity metadata on authoritative Global events, required hello
  online preferences, and one authenticated runtime preference message.
- Move Global recipient authority from Hub world membership to the complete
  opted-in shared-host client set. Add exact-run Boneyard routing and preserve
  Party/Whisper routing. Keep activities in the same bounded transcript lane
  while excluding them from world-speech presentation.
- Add normalized settings, effective gating, the top Settings group, and the
  adjacent Global checkbox. Route fresh/resume/Tutorial admissions through the
  Shared Hub preference and reject a requested Global-party bypass locally.
- Pass per-player Submit Runs eligibility into both completion consumers;
  retain local Hall recording and every teammate's independent eligibility.
- Remove the obsolete architecture claim that Global is Hub-resident-only and
  that a Boneyard is Party-only. Do not add a cross-host broker, persisted
  transcript, client-authored activity, all-party score taint, or live-host
  migration shim.

## Validation contract

- Focused protocol/model tests: strict new hello/update fields; Boneyard
  channel codec; activity constraints; Global/Boneyard/Party/Whisper channel
  membership/default/reconciliation; master/child settings persistence and
  effective gates.
- Host integration: at least one Hub participant, one two-player run, and one
  second run/outsider prove all-direction Global delivery; exact-run Boneyard
  isolation; Global/activity sender and recipient opt-outs; exact join/start/
  leave text and takeover suppression; preference updates; unchanged flood
  bounds and Whisper pair routing.
- Completion integration: mixed Submit Runs preferences in one party prove
  only the opted-in player receives a signed receipt and enters Memoratorium;
  both players retain local Hall behavior at the client boundary.
- Browser acceptance on Mac Chrome: Settings show the five top controls and
  persist; master effective-off state is visible; the Global-tab checkbox
  disables/re-enables live delivery; Boneyard opens on Boneyard and retains a
  manual Global selection across close/reopen; simultaneous browser clients
  in Hub/run receive the requested messages and activity with no page,
  console, or failed-response errors.
- Canonical gate: the exact candidate passes `/opt/homebrew/bin/bash
  ./scripts/validate.sh` on the Mac mini.

## Implementation validation receipt

- Protocol 92 now requires one complete effective online-preference set in
  `client-hello`, accepts authenticated live replacements, adds exact-run
  `boneyard` chat, and carries semantic host-authored Global activity. The
  shared host routes Global across Hub and every run, routes Boneyard by exact
  world identity, retains Hub Party and explicit Whisper authority, excludes
  activity from world speech, and suppresses false Tutorial and resume-takeover
  lifecycle lines.
- `game-settings.ts` owns the five persisted controls and migration from the
  prior complete/cheats-only records. The Settings root renders the master and
  four dependent rows first; the chat Global tab owns the same live persisted
  checkbox. New Game, clean resume fallback, Tutorial, and public-party entry
  consume Shared Hub policy. The host independently gates each player's signed
  leaderboard receipt and Memoratorium writer while the local Hall and opted-in
  teammates remain unchanged.
- Mac focused typecheck plus protocol/settings/chat/client/shared-world/host
  coverage passed `177/177`. This includes Hub <-> run and run <-> run Global,
  Boneyard isolation, all three exact activity lines, actor/recipient opt-outs,
  reconnect takeover, private Tutorial, and a mixed Submit Runs party. Focused
  log SHA-256 is
  `b4742498989a44a0260fef4a215ed586319dcf8ed91baba935227a3f35157fcc`.
- The exact Mac candidate based on Website `d62ed095` passed
  `/opt/homebrew/bin/bash ./scripts/validate.sh`: 26/26 backend contracts,
  2,437/2,437 frontend/desktop tests, lint and type checks, backend/frontend and
  game-host production builds, bundle policy, and media/CSP policy. Chat is a
  live-session lazy chunk (`3.20 kB` gzip); the Game entry is `251,909` raw
  / `76,518` gzip under the `524,288` / `134,144` limits. Gate-log SHA-256 is
  `8c7282b32dc51759b73248c657ccb401671b4793635d768dde9482e7472b4bc1`.
- Browser acceptance remains pending rather than claimed. The Mac browser lane
  stayed occupied by unrelated retained Vite, supervisor, Chrome, and canonical
  validation processes in other worktrees, including
  `render-pipeline-red-20260827-root`, `college-intro-scroll-facing-20260827-root`,
  and the iPhone aggressive acceptance stack. None was killed or reused. The
  updated settings and multiplayer smoke journeys are committed and ready to
  run when that shared lane is released. No deployment was performed.
