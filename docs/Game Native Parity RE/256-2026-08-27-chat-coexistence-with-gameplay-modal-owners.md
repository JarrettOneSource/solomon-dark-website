# 2026-08-27 — Chat coexistence with gameplay modal owners

## Reported smell and parity question

- Reported Website behavior: Inventory, full Skill Book, compact skill
  selector, mandatory level-up Skill Picker, and gameplay Pause all hide or
  reject player chat. Opening chat while Inventory owns the scene also feeds
  `chatOpen` into the same `inputBlocked` flag that tears Inventory down.
- Requested product behavior: every named menu remains visibly open while the
  session chat composer opens, routes a message, and closes. Chat temporarily
  owns keyboard and pointer input; it must not choose a skill, mutate
  Inventory, resume/close Pause, move, cast, or invoke another hotkey.
- Retail has no player-authored chat surface, so coexistence itself is an
  explicit Website multiplayer policy. The stock fact to preserve is modal
  input priority: the current top input owner consumes an edge before the
  retained world or another modal can act.
- Falsifiers: the host rejects `client-chat` while paused; a requested menu is
  actually unmounted rather than disabled; chat is already topmost and only a
  visibility flag is wrong; or an open chat can type `I`, `K`, `T`, digits,
  arrows, Enter, or Escape without a sibling menu also consuming the edge.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail boundary | unmodified retail Beta 0.72.5 `SolomonDark.exe`, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred image base `0x00400000`; `native-player-chat-boundary.md` | retail owns no player-chat widget, binding, route, or transport; no stock chat/menu coexistence constant exists | high |
| Native modal ownership | global exclusion `0x008203F0`; modal runner `0x004281F0`; gameplay nesting `0x005CBD40`; Inventory `0x005C6F10`; SkillScreen `0x005CA640`; compact selector `0x0066F0B0`; Skill Picker `0x0067CAC0`; Pause `0x005ABF10` | stock runs one active modal input owner while retaining application/UI service and, where appropriate, a frozen world; edges do not fall through to gameplay or another modal | high |
| Current Website causal trace | Website base `e8617e6f`; `MainMenuScene.tsx`, `GameChat.tsx`, `HubScene.tsx`, `BoneyardScene.tsx`, `HubInventoryUi.tsx` | `chatDisabled` names every requested modal. Separately, `sceneInputBlocked = chatOpen || ...` is passed as Inventory `disabled`, whose effect closes any live surface. This conflates gameplay suppression, modal retention, and modal interactivity. | high |
| Current focus/input trace | Inventory window-capture handlers; `SkillBook`, `SkillPicker`, `HudSkillSelector`, and `GameplayPauseMenu` focus/key owners; `game-chat.css` z-index 40000 | chat already paints above all requested modal roots, but desktop pixels outside its panel still reach them; several owners can also reclaim focus or consume global hotkeys while the composer is open | high |
| Host authority trace | `game-host.ts` client-message dispatch and `chatRecipients` | chat routing remains admitted during gameplay pause, level-up, and resume-grace filters. Sender identity, rate limiting, Party/Global/Whisper membership, ordering, and world-speech delivery need no protocol change. | high |

This reopening uses settled native reports and the current Website causal
trace. It recovers no new retail address, authored row, asset, or timing
constant; the Mod Loader player-chat boundary is updated only to replace the
obsolete Website modal-disabling consequence.

## System boundary and membership inventory

System: **session chat over retained gameplay modal surfaces**, beginning when
an already mounted Hub/Boneyard session admits a chat-open request and ending
when chat closes or a genuinely superseding application surface unmounts it.
The named gameplay modal stays mounted; chat becomes the temporary input owner;
authoritative world/menu ownership otherwise remains unchanged.

| Member / branch | Owner/source | Disposition | Proof contract |
| --- | --- | --- | --- |
| standalone Inventory in Hub | actor Inventory owner `0x005C6F10`; Hub `HubInventoryUi` | `exact-ported` requested Website policy | opening/sending/closing chat preserves the same Inventory root/path and item state |
| standalone Inventory in active Boneyard | same Inventory owner plus party-run pause source | `exact-ported` requested Website policy | Inventory and authoritative world pause remain; chat routes to Party |
| companion service Inventory/dialogue | separate NPC/service surface | `verified-already-at-parity` through the same retained-surface suspension seam | chat does not close or activate the companion surface |
| full Skill Book in Hub | native SkillScreen `0x005CA640` | `exact-ported` requested Website policy | book page, drag state, and quickbar remain unchanged while chat owns input |
| full Skill Book in Boneyard | same owner plus `skill-book` pause source | `exact-ported` requested Website policy | party-run remains frozen and book remains mounted |
| compact primary selector | `0x0066F0B0`, Website `HudSkillSelector` | `exact-ported` requested Website policy | selector remains open; typed arrows/Enter/Escape cannot choose/close it |
| compact concentration A/B selectors | same native selector family | `exact-ported` requested Website policy | both target branches use the same suspension/focus contract |
| mandatory level-up Skill Picker owner | `0x0067CAC0`, Website `SkillPicker` | `exact-ported` requested Website policy | offer/selection/reveal remain; chat cannot choose, reroll, save, or close it |
| level-up waiting peer | authoritative level-up barrier status | `exact-ported` requested Website policy | waiting client can Party-chat without changing the barrier |
| local Hub Pause owner | Website local Hub `SimpleMenu` projection | `exact-ported` requested Website policy | Pause remains open; Escape closes chat first; a later Resume remains explicit |
| Boneyard Pause owner | native SimpleMenu plus authoritative party-run pause | `exact-ported` requested Website policy | chat routes while the exact world state stays frozen |
| remote peer waiting on another player's pause/book | source-aware waiting Pause presentation | `exact-ported` requested Website policy | peer chat stays usable; foreign pause release remains impossible |
| Global/Party/Whisper channels and own echo | existing Website host/session chat | `verified-already-at-parity` | routing, immediate submit-close, rejection reopen, and zero own unread stay unchanged |
| keyboard open, text, Tab, Enter/send, and Escape | `GameChat` plus retained modal key owners | `exact-ported` requested Website policy | chat open edge wins; all composer keys are isolated; Escape closes only chat |
| mouse/touch composer and desktop outside-panel input | chat panel plus retained modal roots | `exact-ported` requested Website policy | requested modal is inert for the chat lifetime and resumes afterward |
| focus acquisition and restoration | each modal's existing focus effect | `exact-ported` requested Website policy | a modal cannot steal focus from chat; closing chat restores that modal's native web focus target |
| movement, casting, interact, Inventory/Skills/menu hotkeys, menu skull, fullscreen | scene input/HUD owners | `verified-already-at-parity`, strengthened here | all remain suppressed while composing; no deferred action fires on close |
| Pause -> Game Settings and control rebinding | separate Settings modal and binding-capture owner | `out-of-system` | Settings remains exclusive and chat-disabled so text cannot be captured as a new binding |
| resume grace | post-modal synchronization surface, not an open menu | `out-of-system` | existing chat-disabled countdown boundary remains unchanged |
| loading, Tutorial, Create/loadout, Game Over, title, Hall, observer | application/session surfaces outside ordinary gameplay chat admission | `out-of-system` | existing disable or unmount lifecycle remains unchanged |

No member is blocked by the browser platform. HTML `inert`, focus control,
and the existing session chat layer can represent the requested ownership
without a stock approximation or protocol fork.

## Ownership thread and recovered behavioral contract

- `MainMenuScene` owns availability and separates three concerns: whether chat
  exists, whether gameplay input is blocked, and whether an already open modal
  is merely suspended. `chatOpen` continues to block world input, but it must
  no longer enter the destructive `HubInventoryUi.disabled` path.
- The retained modal remains mounted and continues its presentation clocks and
  authoritative pause/barrier lifetime. Its interactive root becomes inert
  only while chat is open. No Inventory close action, book close animation,
  picker selection, Pause release, or resume grace is synthesized.
- Chat remains the top requested-menu painter at z-index 40000. Its closed
  opener stays clickable above the requested modal roots. While open, the menu
  skull/fullscreen and underlying modal roots cannot receive pointer input.
- A requested modal's focus effect is conditional on chat not owning input.
  When chat closes, the still-mounted modal reacquires its established focus
  target: Inventory keeps its window owner, Skill Book/compact selector regain
  their root, Skill Picker its selected card, and Pause its first row.
- Host chat is deliberately independent of world suspension. Messages route
  immediately under existing membership/rate rules while the simulation tick,
  item state, offer, and pause source stay byte-for-byte unchanged. Chat does
  not become a pause source and adds no snapshot/save/Lua state.
- A genuinely superseding surface—loading, Tutorial policy, Settings binding,
  resume grace, Game Over, or session teardown—still closes/disables chat.

## Nearby-system findings

- The prior `sceneInputBlocked` boolean was too shallow: it encoded gameplay
  exclusion, modal admission, modal lifetime, and modal interactivity. The
  Inventory teardown made that ownership error visible, but every requested
  modal shared its focus/pointer consequence.
- Base Pause, book pauses, and level-up already leave transport and the client
  application loop alive. No host exception, pause-source value, protocol
  version, or transport heartbeat change is required.
- Game Settings deliberately captures arbitrary keys during rebinding. Letting
  chat coexist there would make the two text/key owners ambiguous, so it is a
  separately dispositioned exclusive surface rather than a silent omission.

## Confidence and open questions

- Confirmed: complete requested menu membership, current disable/teardown
  path, z-order, global-key/focus owners, authoritative pause partitions, and
  host chat admission/routing.
- Inferred: none used as implementation truth.
- Unknown material to implementation: none. No platform approximation is
  required.

## Web implementation consequence and validation contract

- Narrow `chatDisabled` to genuine application-level exclusions. Preserve
  `chatOpen` in gameplay input blocking, but add a distinct chat-suspension
  input to both scenes and every requested modal root.
- Make retained modal roots inert and defer their focus effects while chat is
  open. Inventory key capture must ignore the chat lifetime without closing
  the Inventory surface. Hide/inert stage controls that could back out of a
  retained modal through the chat layer.
- Focused contracts cover every membership row, including Hub/Boneyard
  Inventory and Skill Book, all compact selector targets, owner/waiting Skill
  Picker, local/remote Pause, all channels, focus restoration, no mutation,
  no input leak, and unchanged host routing under a frozen tick.
- Mac Chrome acceptance opens each requested modal, opens chat by its binding,
  types hotkey-shaped text, sends, and verifies the modal stayed open with the
  same authoritative state. It must prove Escape closes only chat, the
  Boneyard tick remains frozen during paused-menu chat, messages reach the
  expected peer, and page/console/failed-response arrays are empty.
- Run the exact rebased tree through `/opt/homebrew/bin/bash
  ./scripts/validate.sh` and the corresponding Mod Loader portable static RE
  suite before the authorized fast-forward publication.

## Implementation validation receipt

- `MainMenuScene` now keeps chat admitted across every requested gameplay
  modal while retaining `chatOpen` in world-input blocking. A separate
  `sceneModalDisabled` lane owns destructive surface teardown. Hub and
  Boneyard pass chat suspension independently to `HubInventoryUi`; Inventory,
  Skill Book, both compact selector families, Skill Picker, and owner/waiting
  Pause roots become inert without unmounting and reacquire their established
  focus owner after chat closes. The menu skull and fullscreen control cannot
  back through an open chat layer. Game Settings/rebinding remains exclusive.
- Host contracts prove Party chat delivery while a Boneyard skill-book pause
  holds the exact tick/world/player state and while a mandatory level-up
  barrier owns the simulation. No protocol, pause source, snapshot, save, Lua,
  routing, rate, or world-speech shape changed.
- The exact Mac candidate based on Website `e8617e6f` passed
  `/opt/homebrew/bin/bash ./scripts/validate.sh`: 25/25 backend contracts and
  2,418/2,418 Node tests across every registered group, production build,
  media/CSP policy, and the 524,288/134,144-byte game budget. Production entry
  `Game-P116wIKd.js` is 477,175 raw / 133,411 gzip bytes. Gate-log SHA-256 is
  `eb7a7e8883e98586d45d3277b4a4c655ade0f62215bebc633312c16cf849d465`.
- The byte-identical Mod Loader documentation candidate passed 513/513
  portable static RE contracts. Its log SHA-256 is
  `630659514e22f57cb23f1d9ef78259d51b4e8ada4e3cbf91b927a87ce6bd4573`.
- Mac Chrome 151.0.7922.174 completed nine retained-modal branches: Hub and
  Boneyard Inventory, full Skill Book, compact selector, local Pause, and peer
  Pause waiting. Every branch accepted hotkey-shaped text, made Escape close
  only chat, retained the same modal, and restored interactivity; four sends
  delivered as ordered Party sequences 1..4. Owner and peer Boneyard pause
  ticks remained fixed, the nested Settings branch kept chat disabled, and the
  combined page/console error and failed-response arrays were empty.
- A separate Hub/Boneyard mandatory Skill Picker journey retained offer
  sequence 2 at frozen Hub tick 1155, delivered chat, restored first-card
  focus, and retained the Boneyard picker at frozen tick 1319 with one live
  Skeleton still rendered behind it. Pixi used WebGL2; page, console, and
  failed-response arrays were empty.
- Visual inspection confirmed a legible topmost composer over Inventory,
  Boneyard Pause, and Skill Picker. Reviewed SHA-256 values are
  `8395aec8c63fbc9cf3fee9b15933c304d1fb8c97349cafcf2f1d9e9850b0481d`,
  `0b00fb4f2f931ec48cd38c7ccadf621a47b263c334ff5f5d09fe8699afd71c6f`,
  and `7efd632d66c9b761701e419877262fb6e76852651ade043d747b7f7dedaaacb6`.
  No member is browser-blocked and no deployment was performed.
