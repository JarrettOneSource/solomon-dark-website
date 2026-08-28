# 2026-08-22 — Website chat Tab focus-ownership reopening

## Reported smell and parity question

- Reported PC behavior: while the chat composer is open, pressing `Tab` moves
  keyboard focus out of the text box and onto `Send` instead of being captured
  by chat.
- This reopens the 2026-08-21 Website multiplayer-chat entry. That pass proved
  Tab cycling with two and three available channels, but skipped the
  one-channel membership branch while claiming singleton/grouped/run defaults
  and Tab cycling were closed. Its source-presence assertion only proved that a
  Tab handler existed; it did not prove that every available-channel cardinality
  retained focus.
- Reproduction: enter a desktop Hub session whose chat has one available
  channel, open chat with `T`, focus `Chat message`, and press `Tab` once.
- Falsifiers: if the browser keeps `document.activeElement` on the input, if a
  gameplay/global capture listener steals the event first, or if the channel
  list changes during the key press, the conditional composer handler is not
  the cause.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail boundary recheck | unmodified Beta `0.72.5` `SolomonDarkAbandonware/SolomonDark.exe`, size `4,723,200`, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred image base `0x00400000`, PE timestamp `2016-11-02 11:53:23`; `native-player-chat-boundary.md` at Mod Loader `origin/main` `4db72854` | Retail still has no player-chat input surface. The Website HTML composer and its Tab policy remain a designed browser extension; no new native fact is implicated. | high |
| Current web causal trace | Website `cfda6be4980059808d107746b7928e71be70d81a`; `GameChat.tsx` `handleInputKey`; `availableGameChatChannels` / `nextGameChatChannel` | The input cancels Tab only when `channels.length > 1`. For either one-element array, the handler merely stops React propagation; because it does not call `preventDefault()`, the browser performs ordinary focus traversal to the following `Send` button. `nextGameChatChannel` already maps a one-element array back to its sole member. | high |
| Real browser baseline | Linux Google Chrome `150.0.7871.124`, headless desktop `1600x900`, current Vite client plus authoritative local host; `/tmp/solomon-chat-tab-baseline-txs8wQ/single-channel-tab-focuses-send.png`, SHA-256 `38458cee9e32415abbd155f75083d44c135a03b5a13dd949f1fc7085824bdf0b` | The open composer exposed `data-chat-channels="party"`. Before Tab, the active element was `input.game-chat-input`; after one Tab it was `button.game-chat-send`, `inputFocused=false`. Page and console error arrays were empty. | high |

No new reusable native address, class, authored table, or lifecycle fact was
recovered, so the Mod Loader report remains unchanged.

## System boundary and membership inventory

System: **session-scoped Website chat-composer keyboard ownership**, from a
keydown delivered to the focused HTML input through channel selection, focus
retention, submission/close behavior, gameplay exclusion, and component
teardown. Transport routing, message bounds/history, chat visuals, Settings
binding selection, and native trader dialogue remain outside this reopening.

| Member (scene/channel branch/key) | Owner | Disposition | Proof contract |
| --- | --- | --- | --- |
| Ordinary text and IME input in Hub/Boneyard | native HTML input plus `onChange` | verified-already-at-parity | focused input remains the text producer and gameplay input stays blocked |
| `Enter` submission | composer form | verified-already-at-parity | existing send/authority journey |
| `Escape` close | `handleInputKey` / `closeChat` | verified-already-at-parity | existing close and open-button focus behavior |
| `Tab`, shared-Hub singleton `['global']` | composer input | exact-ported by this reopening | one-channel model assertion plus browser focus receipt |
| `Tab`, dedicated/non-shared Hub `['party']` | composer input | exact-ported by this reopening | one-channel model assertion plus browser focus receipt |
| `Tab`, Boneyard without a Whisper thread `['party']` | same composer input | exact-ported by this reopening | one-channel model assertion and shared handler contract |
| `Tab`, grouped Hub `['party','global']` | composer input/channel model | verified-already-at-parity | existing pure cycle test and multi-client browser journey |
| `Tab`, Hub/Boneyard with a Whisper thread | composer input/channel model | verified-already-at-parity | existing two-/three-channel cycle assertions and browser journey |
| Chat-disabled modal/loading/level-up states | `MainMenuScene` and `GameChat.disabled` | verified-already-at-parity | composer is closed/hidden and cannot own a keydown |
| Session/component teardown | `GameChat` effects and client session | verified-already-at-parity | existing listener/open-state teardown tests |

Every member is dispositioned and none is `blocked-by-platform`.

## Ownership and behavioral contract

- A keydown that reaches the focused composer input belongs to chat. The input
  cancels the browser default and stops propagation for every `Tab`, regardless
  of how many channel choices currently exist.
- `nextGameChatChannel` is the single transition rule. With multiple channels
  it advances and wraps; with one channel it returns the same channel. In both
  cases the composer remains focused and marks local chat activity.
- `Enter`, `Escape`, ordinary text/IME input, scene input blocking, and host
  authority are unchanged. `Send` remains reachable by Enter and pointer/touch;
  Tab is the product's channel command rather than DOM focus traversal.
- Channel reconciliation before/after world or party changes remains owned by
  the existing effect. The Tab handler consumes the current render's complete,
  nonempty channel list and creates no second focus or channel state machine.

## Web implementation consequence

- Correct owner: `GameChat.tsx`'s input key handler. Remove the cardinality
  condition from Tab ownership and always pass the current list through the
  existing `nextGameChatChannel` / `chooseChannel` path.
- Strengthen the focused contract so one-element Global and Party lists are
  explicitly identity transitions and the component assertion rejects a
  cardinality-gated Tab handler.
- Extend the real shared-Hub browser journey before grouping so a singleton
  Global composer presses Tab and proves both focus and channel are retained.
  No protocol, host, renderer, CSS, native report, or architecture change is
  required.

## Validation contract

- Red focused regression: the current component must fail an assertion that
  Tab ownership is unconditional; the one-element channel model must return
  its sole current member.
- Browser journey: desktop singleton Hub opens chat with `T`, observes
  `data-chat-channels="global"`, presses Tab, and proves the input remains
  `document.activeElement` and the channel remains Global. The existing
  grouped/Whisper/Boneyard cycling assertions must continue to pass.
- Run the only supported canonical `./scripts/validate.sh` gate, then repeat a
  real desktop browser journey with empty page/console errors on the exact
  changed tree.

## Implementation validation receipt

- `GameChat.tsx` now owns every Tab delivered to the composer input. It always
  calls `preventDefault()` and `stopPropagation()`, then passes the complete
  current list through the existing `nextGameChatChannel` / `chooseChannel`
  path. One-element lists therefore retain both their channel and input focus;
  multi-channel lists keep their previous advance/wrap behavior. No transport,
  host, CSS, renderer, Settings, or native file changed.
- The focused regression was observed red through the supported gate: the old
  cardinality-gated handler failed the new unconditional-Tab assertion while
  the other 28 party/chat tests passed. After implementation, one-element
  Global and Party identity transitions plus the stronger handler assertion
  passed. The runtime-bearing file SHA-256 values are
  `GameChat.tsx=c110f775217892b059b41723446c6137b8b37f7db2ade79639f27440c16aacdd`,
  `game-chat.test.ts=5b4dff64b6bb44dda4f78fc54177a94ccd813d3a92e18ca008631b5166c180b9`,
  and
  `smoke-shared-hub-parties.mjs=92ed2a8194cb370fe82db07c9289b04eda0c907a74833c653c1d07581fe43f96`.
- Local Node `22.17.0`, npm `10.9.2`, and .NET SDK `10.0.302` passed the
  canonical `./scripts/validate.sh`: `15/15` backend/contracts, `4/4` library,
  `43/43` loot, `226/226` prerequisite, `1272/1272` broad game, `29/29`
  party/chat, `11/11` level-up/HUD, `7/7` diagnostics, `17/17` Hall, `16/16`
  Hub UI, `5/5` desktop, production build, media policy, and bundle budget.
  `Game-DZf515xj.js` was `392,974` raw / `109,946` gzip bytes.
- Local Chrome `150.0.7871.124` completed the real production-bundle backend ->
  supervisor -> protocol-52 desktop journey. Before grouping, its singleton
  Global composer pressed Tab and retained `document.activeElement` on the
  input. The journey then preserved Party/Global/Whisper cycling, Boneyard
  Party routing, fade/reveal, gameplay exclusion, and outsider isolation. It
  ended at zero sessions/players/parties/runs with empty page/console errors.
  The inspected singleton receipt is
  `/tmp/solomon-chat-tab-fixed-evidence-74qdNs/chat-hub-singleton-tab.png`,
  SHA-256
  `3a72fb984ddaa2f6e722bc93dbdafc53ed6e809bcdd572442db2140fc4ad1050`.
- The exact runtime-bearing files were copied byte-for-byte into a detached
  Apple-arm64 worktree at current Website `origin/main`
  `cfda6be4980059808d107746b7928e71be70d81a`. Mac Node `22.17.0`, npm
  `10.9.2`, and .NET SDK `10.0.302` passed the same canonical gate and counts.
  Mac Chrome `151.0.7922.170` passed the complete four-client desktop journey,
  including the singleton Global focus assertion, all multi-channel branches,
  Boneyard, WebGL, zero error arrays, and final zero occupancy. The inspected
  Mac singleton receipt is
  `/tmp/solomon-chat-tab-mac-evidence-20260822/chat-hub-singleton-tab.png`,
  SHA-256
  `1c92278500acf7107e9e796d0337b31afdf65895f02b8eea52b2e92b55556a9a`.
- Every temporary local and Mac backend/supervisor process was stopped after
  acceptance. No commit, push, deployment, or production restart was
  requested or performed.
