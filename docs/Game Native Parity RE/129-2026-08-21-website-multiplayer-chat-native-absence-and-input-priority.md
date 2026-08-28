# 2026-08-21 — Website multiplayer chat, native absence, and input priority

> **Superseded Website channel policy (2026-08-27):** the native negative
> census and input-priority findings below remain authoritative, but protocol
> 92 replaces Hub-resident Global, cross-transition Party, and Boneyard
> Party-only routing with process-host Global, Hub Party, and exact-run
> Boneyard chat. See the 2026-08-27 online communication entry.

## Reported smell and parity question

- Reported web behavior: `/game` has no player-to-player chat. The existing
  `T` edge opens SkillScreen in Hub and Boneyard, so there is no chat composer,
  activity log, party/global selector, authoritative text lane, or fade
  lifecycle.
- Requested behavior: `T` opens a polished chat box; inactive chat fades after
  a short readable hold; a grouped public-Hub player defaults to Party and can
  use `Tab` to swap to Global; a public-Hub singleton uses Global; Boneyard
  exposes Party only.
- Reproduction inputs/scenes: Windows Chrome at 1600x900, Website
  `1361f097cf9ff2676e5c01c7b822f44b52a1220a`; enter Hub and press `T`.
  The resulting Skills modal and absence of any `Game chat` landmark are
  captured at
  `C:/codex-validation/solomon-chat-baseline-t-opens-skills.png`.
- Falsifiable questions: does retail own any player-authored chat path hidden
  behind the trader `Chat` name; can an authenticated client forge another
  sender; can Party leak to a singleton/other party; can Global reach an
  active Boneyard; can typing also move/cast/open a book; can stale wall time
  make a newly arrived message instantly fade; can malformed, control-filled,
  or flooding text grow host/client state without bound?

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail binary | unmodified Beta `0.72.5` `SolomonDark.exe`, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred image base `0x00400000`, PE timestamp `2016-11-02 11:53:23` | Current binary identity matches the settled native input/class evidence. | high |
| Native input | `GameWindowProc 0x00443440`, `Input::Refresh 0x00429820`, preset initializer `0x005A8790`, Skills binding `0x00B3BCC8` | `T` / DirectInput `0x14` is the stock SkillScreen edge in both gameplay scenes. No player-chat action/binding row exists. | high |
| Native class/xref census | `Chat` vtable `0x0079061C`, ctor/update/render `0x004F5D90`/`0x004FFEE0`/`0x004F9380`; `ChatExtend` vtable `0x00790284`; `Notebox` vtable `0x007906DC`; Mod Loader `native-player-chat-boundary.md` | Chat-named classes are trader/book/note presentation. Ghidra string/xref searches found no player sender/recipient/transport owner. | high |
| Native/loader network census | Mod Loader `steamworks_abi.h`, `steam_bootstrap.cpp`, `steam_bootstrap_api.cpp` | `LobbyChatUpdate_t` is a membership-state callback. The loader imports no Steam lobby-chat send/read API and owns no text lane. | high |
| Native asset census | audio registry rows `131` `MessageDone__Stream` and `150` `yougotamessage__stream` | The assets are registered, but no player-chat call path consumes them. A suggestive filename is not authorization to attach them to this feature. | high |
| Current web causal trace | `game-protocol.ts` protocol 47; `game-host.ts`; `game-client-session.ts`; `MainMenuScene.tsx`; Hub/Boneyard `KeyT` handlers | The authenticated transport already owns player identity and party/world membership, but has no chat message. Scene-local `T` handlers own Skills and local input blocking. | high |
| Current Windows browser | clean Windows-native worktree at Website `1361f097`; Chrome; capture above | Pressing `T` opens `Skills`; `chatCount=0`; page and console error arrays are empty. | high |

## System boundary and membership inventory

Native system queried: **player-authored multiplayer text communication**, from
text ingress through identity, recipient selection, transport, presentation,
input priority, inactivity, and teardown. Retail has no such system; the web
contract below is an explicit product extension. The stock trader/dialogue
family, save data, gameplay snapshots, simulation ticks, moderation service,
voice chat, private messages, persistence, and mod/Lua chat APIs are outside
this boundary.

| Member (class/variant/scene/branch) | Native/web owner | Disposition | Proof contract |
| --- | --- | --- | --- |
| Retail player-authored text action/transport | complete native input, class, string, and network census | out-of-system (absent from retail) | durable negative census |
| Retail `T` SkillScreen binding | `0x005A8790`, `0x00B3BCC8` | out-of-system for chat (explicit requested web override) | stock evidence plus web hotkey test |
| Trader `Chat` | vtable `0x0079061C` and merchant dialogue tree | out-of-system (NPC-authored conversation) | native Hub/economy report |
| `ChatExtend`, `Boast`, `SellSpell`, `BookReview` | vtable `0x00790284`; ctors `0x004F7D20`, `0x004F82D0`, `0x004FA090` | out-of-system (merchant/book narrative) | Ghidra ctor/vtable census |
| `Notebox` | vtable `0x007906DC` | out-of-system (local note presentation) | class/vtable census |
| `MessageDone__Stream`, `yougotamessage__stream` | native audio registry 131/150 | out-of-system (no proved player-chat trigger) | registry plus negative consumer census |
| Steam `LobbyChatUpdate_t` / `chat_permissions` | Mod Loader Steam bootstrap | out-of-system (membership metadata, not text) | import/callback census |
| HTML composer and IME/Deck keyboard | session-scoped `GameChat` web presentation | out-of-system native extension | focusable-input and browser journey |
| authenticated sender identity and ordered echo | existing host/client protocol sideband | out-of-system native extension | codec/client/host integration tests |
| public-Hub Global recipients | shared-Hub host membership | out-of-system native extension | grouped/singleton/active-run isolation test |
| current Party recipients in Hub/Boneyard | authoritative party system | out-of-system native extension | two-party and run-transition routing test |
| singleton Hub channel default | party projection plus Hub world kind | out-of-system native extension | pure model and browser assertion |
| grouped Hub Party default plus `Tab` Global swap | party projection plus Hub world kind | out-of-system native extension | pure model and browser assertion |
| Boneyard Party-only branch | party-scoped run | out-of-system native extension | browser/run routing assertion |
| local compose input exclusion | root UI owner plus scene input adapters | exact-ported native input-priority rule | movement/cast/book exclusion test |
| bounded text, flood control, and rejection | protocol codec plus host connection state | out-of-system native extension | invalid/control/byte/rate tests |
| bounded local history, unread state, activity hold/fade/reveal | client presentation clock | out-of-system native extension | deterministic model and browser timing test |
| modal/loading/level-up interruption and session teardown | `MainMenuScene` and client-session lifecycle | exact-ported native ownership priority | close/unsubscribe and input-release tests |

No member is `blocked-by-platform`. The one predicted visible stock difference
is intentional: `T` opens chat in the Website instead of SkillScreen;
SkillScreen remains available from the tome HUD button and moves to `K`.

## Native ownership thread

- Owner and construction path: retail owns no player-chat object. For the web
  extension, `MainMenuScene` owns one `GameChat` for the connected session so
  history and selection survive Hub/Boneyard scene replacement. The
  `GameClientSession` owns transport listeners; `game-host` alone derives the
  authenticated sender and current recipients.
- Upstream state producers/callers: a real HTML input produces trimmed text and
  one requested `party` or `global` channel. Party projection and world kind
  determine which choices the UI may offer; neither sender name nor recipient
  IDs come from the client payload.
- State representation and transitions: closed-visible -> closed-faded and
  open-composing are presentation states. Opening, channel switching, sending,
  and an authoritative incoming message refresh local activity. Group entry
  selects Party by default; loss of a grouped party or entry into Boneyard
  reconciles to the only valid channel.
- Downstream consumers/callees: the host emits one ordered authoritative chat
  event to current recipients. Each client appends it once to a bounded local
  session history, filters the selected group, updates unread state, and
  announces the message through the semantic live region.
- Sibling systems sharing ownership or data: party membership, shared-Hub vs
  party-run world placement, WebSocket authentication, local scene input
  blocking, SkillScreen/pause/loading priority, and responsive HTML UI.
- Entry, interruption, reset, and teardown: chat appears only for a connected
  Hub/Boneyard session. Loading, SkillScreen, Inventory, Pause, and level-up
  owners hide/close the composer. Session destruction removes listeners and
  history. Messages are neither saved nor replayed after reconnect.

## Recovered and designed behavioral contract

- Native facts retained: active text input has UI priority over gameplay; the
  stock `T` Skills binding and its requested override remain explicit; the
  native trader classes and message-named audio are not reused.
- Web timing: a closed chat remains fully visible for `5,000 ms` after local or
  incoming activity, then transitions to its compact faded state over `650 ms`.
  An open composer never fades. Arrival time is client-local; server wall time
  and fixed simulation ticks do not drive presentation opacity.
- Web bounds: text is trimmed, nonempty, contains no C0/DEL control character,
  and is at most 180 UTF-16 code units and 512 UTF-8 bytes. Client history keeps
  at most 80 authoritative messages. The host accepts at most five messages per
  authenticated client in any rolling five-second window and returns a bounded
  rejection rather than disconnecting a valid but fast sender.
- Input: unmodified non-repeating `T` opens/focuses chat; `Enter` sends;
  `Escape` closes; `Tab` cycles only the channels available in the current
  scene. `K` becomes the Website SkillScreen shortcut. While composing, local
  movement/cast/hotkey input is stopped, but no authoritative world pause is
  requested and other players continue.
- Authority/routing: the client packet carries only `channel` and `text`.
  Server sequence, sender player ID, and sender display name are host-authored.
  Global is accepted only from the shared Hub and reaches only clients still
  in that Hub. Party reaches current members of the sender's authoritative
  party in Hub or its Boneyard; on a non-shared dedicated session it reaches
  that one connected world group.
- Privacy/lifecycle: content is not logged, saved, included in snapshots, or
  exposed to Lua/mod state. There is no history replay, whisper, cross-party
  delivery, or Global delivery into active runs in this boundary.
- Visual/accessibility: the log is an HTML live region, sender/channel state is
  textual as well as colored, the composer is a focusable `<input>`, and a
  small Chat control remains available to touch/Deck users after the log fades.

## Nearby-system findings

- `LobbyChatUpdate_t` is easy to misread: Steam uses it for lobby member state
  changes, not text payloads. The Mod Loader does not load the Steam lobby-text
  APIs.
- The native message-named streams are not evidence of chat ownership. Neither
  is selected for the web feature without a proved trigger.
- The current exact SkillScreen work correctly recovered `T`; this new feature
  intentionally supersedes only the Website hotkey, not SkillScreen content,
  timing, authority, or its HUD entry.
- Native report updated:
  `Mod Loader/docs/reverse-engineering/native-player-chat-boundary.md`, with a
  cross-reference added to `native-input-model.md`.

## Confidence and open questions

- Confirmed: retail has no player chat; native `T` owns Skills; the existing
  Website protocol has authenticated player/party/world identity but no text
  lane; current Windows Chrome opens Skills and exposes no chat surface.
- Designed, not native: channel policy, bounds, rate, local retention, fade,
  colors, `K` replacement shortcut, and nonpersistent history.
- Unknown: none material inside the declared chat boundary.
- Browser-specific approximation: none. HTML input is the accepted browser
  representation for user-authored text, not an approximation of a missing
  native widget.

## Web implementation consequence

- Correct owner/module: strict chat wire data in `game-protocol`; sender,
  recipient, sequence, and flood authority in `game-host`; listener/send
  lifecycle in `game-client-session`; pure availability/history/fade rules and
  one session-scoped `GameChat` presentation under `MainMenuScene`.
- Shared model change: protocol 49 adds client chat, authoritative server chat,
  and bounded rejection messages without placing chat in snapshots or
  simulation state.
- Stock behavior preserved: modal/input priority, all SkillScreen mechanics,
  and the tome control. Requested deviation: `T` becomes Chat and `K` becomes
  the Website Skills hotkey.
- Symptom patch to avoid: no scene-local duplicate logs, CSS-only fade timer,
  client-selected sender, broadcast-to-all helper, snapshot-carried text,
  persisted transcript, or trader `Chat` renderer reuse.

## Validation contract

- Focused automated tests: strict protocol round trips and malformed bounds;
  channel/default/reconciliation/history/fade rules; client send/receive/
  rejection/teardown; host sender identity, ordered echo, Hub Global reach,
  Party isolation, Boneyard Global denial, and rolling flood control; `K`
  Skills ownership in both scenes.
- Playwright journey: a real browser plus raw party/outsider peers enters the
  shared Hub, groups, opens with `T` on Party, sends without outsider leakage,
  swaps with `Tab` to Global, proves all Hub clients receive it, observes
  authoritative replies/unread state, proves fade and incoming reveal, then
  launches and proves Boneyard Party-only behavior and local input blocking.
- Stock-versus-web comparison: preserve the Windows baseline proving the
  intentional `T: Skills -> Chat` change; there is no stock player-chat pixel
  oracle.
- Measurable acceptance: exactly the intended recipients receive each message;
  sender identity is host-authored; history and text stay within bounds;
  chat fades after the declared hold and reappears on activity; no movement,
  cast, Skills, or pause edge leaks while typing; empty page/console errors;
  canonical `./scripts/validate.sh` passes.

## Implementation validation receipt

- Protocol 49 adds strict `client-chat`, authoritative `server-chat`, and
  bounded `server-chat-rejected` messages. The client sends only normalized
  channel/text. The host derives sender ID/name from the authenticated socket,
  allocates one monotonic sequence, admits five messages per rolling five
  seconds, routes Global only among current shared-Hub residents, and routes
  Party only among current authoritative party members. Chat is absent from
  snapshots, saves, logs, Lua, and leaderboard state.
- `GameClientSession` owns ordered receipt, stale-sequence rejection, an
  80-event session buffer, listener teardown, and normalized sending.
  `MainMenuScene` owns one `GameChat` across Hub/Boneyard replacement. The
  accessible HTML composer owns the configurable browser-chat binding (default
  `T`), `Enter`, `Escape`, `Tab`, touch opening,
  unread counts, channel reconciliation, and a five-second hold plus 650 ms
  fade. Composing stops only local gameplay input; no shared pause is acquired.
  SkillScreen content/authority is unchanged and remains reachable from the HUD
  tome plus its configurable binding (Website default `K`). The complete
  Settings owner conflict-swaps Chat and Skills, so neither edge can open both
  surfaces after rebinding.
- Focused coverage closes every membership branch: strict code-unit/byte/
  control bounds; authenticated sender identity; Party outsider isolation;
  Global Hub reach; Boneyard Global rejection; ordered echo; rolling flood
  rejection; client normalization/history/teardown; singleton/grouped/run
  defaults; Tab cycling; inactivity boundary; real HTML input and `T`/`K`
  ownership. The shared-Hub acceptance tool now pins the current hello and
  quickbar wire shape as well as the chat journey.
- The exact current-main tree at Website base
  `f0ab53043a14ad8c72fa1b9eaeb63b9f4dbbc9fb` passed the supported
  `./scripts/validate.sh` gate on Linux. The final counts are 15
  backend/contracts, 43 loot, 225 prerequisite/save/skill, 1,247 broad
  game/frontend, 25 party/chat, 10 level-up/HUD, 7 diagnostics, 17 Hall, 16 Hub
  UI, and 5 desktop tests, followed by the production browser/host builds,
  bundle budget, and media policy. The production game entry is 375,113 raw
  bytes and remains below 104 KiB gzip; only the eight pre-existing Fast
  Refresh warnings and Vite's large-chunk advisory remain. Windows native Node
  `22.17.0`, npm `10.9.2`, Python `3.13.5`, and .NET SDK `10.0.302` passed the
  Release backend build, TypeScript test typecheck, 4 library/mod tests, 25
  party/chat tests, and 86 protocol/client/host integration tests.
- Windows Chrome `151.0.7922.170` completed the real Website backend -> shared
  supervisor -> protocol-49 host journey with one browser participant, two raw
  same-party peers, and one outsider. It proved Party default, zero outsider
  delivery, Tab-to-Global delivery to all four Hub residents, host-authored
  sender identity/sequence, local movement exclusion while typing, opacity
  exactly `0` after inactivity, incoming-message reveal, Boneyard Party-only
  reconciliation, and zero outsider run delivery. During the run supervisor
  health was `players=4`, `hubPlayers=1`, `parties=2`, `runs=1`; teardown reached
  all zeros. Page and console error arrays were empty.
- Inspected Windows captures are
  `C:/codex-validation/solomon-chat-push-evidence/chat-hub-global.png` SHA-256
  `cb930eeff5d9283f1eafbd61cdd0d4a84d2f0c465ceba78cfbe92eb05a27146a`
  and `chat-boneyard-party.png` SHA-256
  `a8152da24a430b3f98b57b6f855ab11a9e22bf9c4ccbebbcf51008363a6ded7e`.
  The before-change `T -> Skills`, no-chat capture is
  `C:/codex-validation/solomon-chat-baseline-t-opens-skills.png` SHA-256
  `5cbc5c373965ff9f30ba7a522d698ef960856b3059e99a37c6595d883a57078d`.
  No member is browser-blocked. This receipt does not claim a deployment or
  production restart.
