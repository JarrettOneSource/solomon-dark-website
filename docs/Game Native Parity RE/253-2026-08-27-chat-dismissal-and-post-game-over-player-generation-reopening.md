# 2026-08-27 — Chat dismissal and post-Game-Over player-generation reopening

> **Partial supersession, 2026-08-28:** entry 295 restores ordinary carried
> equipment/backpack archival into Luthacus storage. Fresh active equipment and
> spell state still reset exactly as documented here.

## Reported smells and parity questions

- Chat remains open when `Escape` is pressed while its window is open but the
  text input no longer owns focus. A successfully submitted message also leaves
  the composer open.
- After Game Over, players report that the next wizard retains clothing colors
  and spells. The requested Website lifecycle is stronger than ordinary retail
  profile persistence: the completed-run character generation is disposable,
  while the browser account/session and its explicitly durable profile state
  remain separate owners.
- This is a secondary report in two ledgered systems. The 2026-08-22 chat
  reopening dispositioned `Escape` from an input-local handler and never tested
  the open panel's tab, button, scrim, or programmatic-focus branches. The
  2026-08-26 player-generation correction rebuilt skills and active inventory,
  but stopped before the ordinary Create-confirmation color handoff. It rolled
  replacement Hat/Robe colors during Game Over archival from the dead wizard's
  element, then preserved those colors when the player selected a different
  element.
- Falsifiers: a window-capture Escape owner already closing unfocused chat; an
  accepted send transition already closing before host echo; a post-run color
  roll after the new Create selection; or a current-main authority receipt in
  which old learned ranks survive `confirmGameSimulationLoadout`.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail boundary | unmodified Beta `0.72.5` `SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred image base `0x00400000`; `native-player-chat-boundary.md` | Retail still has no player-authored text-chat surface. Chat close/send behavior is Website-owned, while native modal input priority remains the protected sibling rule. | high |
| Current chat causal trace | Website `f7e0b244` (unchanged in rebased base `8826abcf`); `GameChat.tsx` `openFromKeyboard`, input-only `handleInputKey`, `submit`, and `onChatMessage` | Global capture opens chat but has no open-window Escape branch. Only the focused `<input>` closes on Escape, successful submit clears the draft without closing, and closing before the authoritative own echo would currently count that echo as unread. | high |
| Fresh static lifecycle xrefs | canonical read-only Ghidra replica; finalizer `0x005D0290`, starter `0x005CFA80`, startup `0x005D07D0`, Create tick `0x0058A820`, start owner `0x005D2380` | `0x005D0290` has exactly two callers (`0x0058A96D`, `0x005D0840`) and calls starter construction after the selected element/discipline grants. `0x005CFA80` has exactly two callers (`0x005D0756`, `0x005D24FF`) and creates Hat, Robe, Staff, and two Potions only while `Game+0x86` is clear. | high |
| Fresh root-grant helper | `ActorProgression_Grant 0x00660320` plus finalizer's ordered calls `0,2,1,3,4,6,5,7` | Every call increments that addressed row's permanent rank and clamps it to the row maximum. Fresh native construction therefore gives all eight root rows permanent rank 1, while only the selected element/discipline roots govern offers and only the starting pair belongs to learned display order. The 2026-08-14 ledger sentence claiming only selected roots receive rank is superseded. | high |
| Fresh static destruction trace | `Game` ctor/dtor `0x005CC800` / `0x005CD3A0`, deleting wrapper `0x005CFA60`; Game Over tick/archive `0x005CF4F0` / `0x005C9670` | A new native `Game` zero-initializes its selection/start flags and component owners. Destruction unregisters/destroys all six regions, auxiliary owners, inventory/progression containers, and clears the global Game pointer. `0x005C9670` only archives the completed run; it is not character destruction. | high |
| Starter-color branch | `0x005CFA80`, selected-primary rows `8/16/24/32/40`, College override `DAT_00B3BCA0`, three color draws and mix helper `0x0040FC60`; `native-session-flow.md` | Ordinary Create finalization selects the new element before first starter construction, so its new Hat/Robe use that selected family. The one-shot College path constructs green garments before Create, sets `Game+0x86`, and intentionally preserves them through later confirmation. | high |
| Current player-generation trace | `enterPostRunLoadout`, `gameSimulationDurableProfileEconomy`, `confirmGameSimulationLoadout`, `replacePlayerLoadout`; current Aug 26 contracts | Completed Game Over already discards carried active items, creates starter inventory, and confirmation rebuilds level/XP, the skill/stat books, runtime, selections, offers, and quickbar with a newer progression revision. The missing branch is a new-selection starter appearance plus a newer economy revision. | high |

Reusable native findings and the corrected caller/destructor membership are
recorded in Mod Loader `native-game-over-session-semantics.md`. The negative
chat census remains native truth; its Website lifecycle consequence is
clarified in `native-player-chat-boundary.md`.

## System A boundary and membership — session-scoped Website chat lifecycle

System A begins when the session-scoped `GameChat` admits an open request and
ends when it closes, is disabled, or unmounts. It includes keyboard ownership,
focus-independent dismissal, accepted submission, rejection feedback, unread
classification, scene input exclusion, and every channel. Transport routing,
message bounds, world speech, native trader dialogue, and Settings key capture
remain outside this reopening.

| Member / branch | Owner | Disposition | Proof contract |
| --- | --- | --- | --- |
| keyboard, touch/HUD, and Player-Card Whisper open | `GameChat` open owner | `verified-already-at-parity` | existing binding, pointer, and Whisper journeys |
| Escape with text input focused | open-window capture owner | `exact-ported` by this reopening | focused browser assertion and no Pause/Skills leak |
| Escape with channel tab, Send, Close, panel, scrim, or no chat descendant focused | same capture owner | `exact-ported` by this reopening | unfocused-control browser assertion; one shared close path |
| Escape in Hub singleton/grouped/Whisper and Boneyard Party/Whisper | same handler over current channel membership | `exact-ported` by this reopening | per-world/channel source contract plus Hub and Boneyard journeys |
| successful Global submit | composer form plus shared-Hub route | `exact-ported` by this reopening | closes in the submit commit, before authoritative echo |
| successful Party submit | same form plus party/active-run route | `exact-ported` by this reopening | same immediate close without widening recipients |
| successful Whisper submit | same form plus addressed-recipient route | `exact-ported` by this reopening | same immediate close while retaining the active Whisper thread |
| locally invalid empty/oversize/control text | protocol normalizer | `verified-already-at-parity` | remains open with local status; no message exists |
| asynchronous host rejection | client rejection listener | `exact-ported` by this reopening | reopens the composer so the existing rejection status remains visible |
| own authoritative echo after submit-close | ordered client message listener | `exact-ported` by this reopening | transcript/world speech/audio update once; no unread increment |
| remote event while closed or on another channel | unread owner | `verified-already-at-parity` | bounded unread increments and incoming reveal |
| scrim, close button, and disabled-state close | existing presentation/effects | `verified-already-at-parity` | all converge on closed state and restore gameplay admission |
| loading, Tutorial, Inventory, Skill Book, picker, Pause, resume grace, and Game Over | `MainMenuScene` disable/unmount gates | `verified-already-at-parity` | chat cannot retain input across a superseding surface |
| session replacement and component teardown | session effect cleanup | `verified-already-at-parity` | listener removal, open-state clear, no transcript persistence |

No chat member is browser-blocked. HTML focus is the intended Website text
platform; the repaired Escape owner sits above focus rather than attempting to
imitate a nonexistent native player-chat widget.

## System A recovered contract and implementation consequence

- While chat is open, an unmodified Escape edge belongs to chat before any Hub
  or Boneyard Pause Menu listener. It prevents the browser default and stops
  the same event from reaching competing input owners, then runs the one shared
  close routine regardless of `document.activeElement`.
- A locally valid submit is a close edge in the same React event. Host echo
  remains the sole delivery/audio/world-speech producer; submit does not create
  an optimistic message. The local sender's later authoritative echo is never
  unread merely because the requested close happened first.
- A local validation failure is not a send and stays open. A later host
  rejection must make its existing status visible again rather than leaving
  feedback inside a closed panel. Channel choice, draft normalization, rate
  authority, history bounds, fade, and recipient routing do not change.
- Put dismissal in the open-window capture owner and remove the focused-input
  Escape special case. Keep `Tab` input-local because it is a composer channel
  command. No protocol, CSS, snapshot, save, or native report shape changes.

## System B boundary and membership — terminal participant generation

System B begins at an individual death edge, crosses the all-dead Game Over
archive and direct Website Create route, and ends when every retained
participant has confirmed a newly materialized wizard generation. Stable
authenticated `playerId` and the dense Website entity row are transport
identity; they do not authorize any old character-owned component to survive.

| Member / branch | Native/product source | Disposition | Required result |
| --- | --- | --- | --- |
| individual death while an eligible peer lives | same native PlayerWizard corpse/spectator owner | `verified-already-at-parity` | keep that run's skills, inventory, colors, vitals, and effects until the run actually ends |
| all-dead Game Over archive | `0x005CF4F0 -> 0x005C9670`; Website terminal archive | `verified-already-at-parity` | archive only durable profile outputs; clear run/world spell actors and active carried state under existing Website policy |
| native Game destruction/new Game construction | `0x005CD3A0` / `0x005CC800` | `out-of-system` as literal browser objects; semantic lifetime is exact | browser session/socket survives, but no old character component is reused as the next wizard |
| retained name/element/discipline on Create | Create focus/default fields | `verified-already-at-parity` | convenience preselection only; every choice remains interactive |
| Ether/Arcane | `0x005D0290`, rows `0/8/11`, discipline root `7` | `exact-ported` | fresh rank-one roots and Magic Missile/Call Leviathan; fresh Ether Hat/Robe family |
| Ether/Body | rows `0/8/11`, discipline root `5` | `exact-ported` | same fresh Ether pair/color with Body offer family |
| Ether/Mind | rows `0/8/11`, discipline root `6` | `exact-ported` | same fresh Ether pair/color with Mind offer family |
| Fire/Arcane | rows `1/16/21`, discipline root `7` | `exact-ported` | fresh rank-one roots and Fireball/Ring of Fire; fresh Fire Hat/Robe family |
| Fire/Body | rows `1/16/21`, discipline root `5` | `exact-ported` | same fresh Fire pair/color with Body offer family |
| Fire/Mind | rows `1/16/21`, discipline root `6` | `exact-ported` | same fresh Fire pair/color with Mind offer family |
| Air/Arcane | rows `2/24/27`, discipline root `7` | `exact-ported` | fresh rank-one roots and Lightning/Magic Storm; fresh Air Hat/Robe family |
| Air/Body | rows `2/24/27`, discipline root `5` | `exact-ported` | same fresh Air pair/color with Body offer family |
| Air/Mind | rows `2/24/27`, discipline root `6` | `exact-ported` | same fresh Air pair/color with Mind offer family |
| Water/Arcane | rows `3/32/35`, discipline root `7` | `exact-ported` | fresh rank-one roots and Frost Jet/Ring of Ice; fresh Water Hat/Robe family |
| Water/Body | rows `3/32/35`, discipline root `5` | `exact-ported` | same fresh Water pair/color with Body offer family |
| Water/Mind | rows `3/32/35`, discipline root `6` | `exact-ported` | same fresh Water pair/color with Mind offer family |
| Earth/Arcane | rows `4/40/45`, discipline root `7` | `exact-ported` | fresh rank-one roots and Boulder/Raise Golem; fresh Earth Hat/Robe family |
| Earth/Body | rows `4/40/45`, discipline root `5` | `exact-ported` | same fresh Earth pair/color with Body offer family |
| Earth/Mind | rows `4/40/45`, discipline root `6` | `exact-ported` | same fresh Earth pair/color with Mind offer family |
| level/XP, learned order/ranks, advanced unlocks, selected primary/concentrations, quickbar, offers, stat/runtime caches | fresh `Skills 0x006594E0`, `Skills_Wizard 0x00674EE0`, finalizer `0x005D0290` | `verified-already-at-parity`, strengthened here | none can survive confirmation; replacement revision is newer than the dead generation |
| primary cast, locomotion, life/status/potion effects, lighting, mindstar, primary/secondary/world spell actors | Game/player/world teardown owners | `verified-already-at-parity` | idle living character at Hub spawn; no old action/effect or renderer cursor |
| active backpack/equipment | starter `0x005CFA80`, separate from Luthacus archival | `verified-already-at-parity`, color handoff corrected here | only Hat, Robe, Staff, Health Potion, and Mana Potion; archived dyed or run-looted items remain storage-only |
| ordinary post-run Hat/Robe primary and white trim | selected-primary branch in `0x005CFA80` | `exact-ported` by this reopening | fresh generation seed and newly confirmed element own both identical starter tints; economy revision advances |
| post-Tutorial College-green Hat/Robe | `DAT_00B3BCA0` override plus `Game+0x86` one-shot guard | `verified-already-at-parity` | preserve the authored College colors through that first Create; do not apply the ordinary post-run reroll |
| gold, Luthacus storage, owned Hagatha selectors/runtime, unforge bonuses, Tutorial/College flags, NPC/profile state | durable participant/profile owner | `verified-already-at-parity` | survive without becoming old active inventory or learned spell state |
| Last Word ground Sack/Gold recovery | selector 12 and archive scan | `verified-already-at-parity` | durable ground recovery composes with the ordinary carried archive; neither restores old gear or spells to the active wizard |
| completed Hall/Memorial portrait | death-tick-300 immutable archive before run retirement | `verified-already-at-parity` | keep the dead generation's frozen equipment colors/config/score in its portrait; later active-wizard replacement cannot recolor history |
| solo, multiplayer per-member confirmation, disconnect during loadout | host run/loadout barrier | `verified-already-at-parity` | replace each accepted participant exactly once; final current member releases Hub |
| resumable-run slot deletion and profile checkpointing | browser save owner | `out-of-system` for character lifetime | no save-schema/protocol change; character teardown must not be implemented as a save-file patch |
| voluntary retirement, explicit Kill Wizard, active-run rejoin/respawn | separate lifecycle owners | `out-of-system` | unchanged; they are not completed all-dead Game Over |

No generation member is browser-blocked. The Website's direct Create route and
stable authenticated identity remain named product differences from retail's
front-end/profile lineage; carried-item archival now follows retail.

## System B recovered contract and implementation consequence

- `0x005C9670` is archival, not deletion. Literal native lifetime closure
  occurs when `Game::~Game 0x005CD3A0` tears down the regions and component
  containers and a new `Game 0x005CC800` starts with cleared flags. Because the
  Website deliberately retains its host/session and skips Mortuary/MainMenu,
  `replacePlayerLoadout` is the semantic new-character constructor and must
  replace every character-owned column atomically.
- Ordinary post-run Create confirms the selected element before the first
  reachable `0x005CFA80` starter-color draw. In the web model, derive the new
  Hat/Robe appearance from the same fresh generation seed that owns the new
  offer stream, apply it only on the completed-Game-Over confirmation path,
  and advance economy revision. Reusing the archive-time old-element color is
  the refuted assumption.
- The special College path is the sibling falsifier: it intentionally creates
  green starter garments before Create and sets the one-shot guard, so its
  later confirmation must continue through the existing loadout replacement
  without the ordinary post-run appearance rewrite.
- Existing Aug 26 fresh skill/progression construction remains the correct
  shared mechanism. Strengthen its contract across all 15 loadouts and all
  learned/selected/runtime fields rather than adding a client UI clear. Stable
  `playerId`/ECS row identity is allowed; old component objects and revisions
  are not.
- The all-15 green regression exposed an older shared-constructor omission:
  `createPlayerSkillBook` ranked only the selected element and discipline
  roots. Fresh `0x00660320` decompilation proves every ordered root call writes
  permanent rank 1. Correct that shared constructor for initial, Tutorial,
  post-run, solo, and multiplayer generations at once, while keeping
  `learnedSkillOrder` limited to the displayed starting pair so SkillScreen
  does not invent seven unrelated pages.

## Confidence and open questions

- Confirmed: chat focus gap and submit state; unread-own-echo neighbor; exact
  native finalizer/starter caller sets; Game ctor/dtor lifetime; ordinary versus
  College color ownership; all 15 starting skill tuples; all-eight-root rank
  writes; current fresh-skill, starter-inventory, and durable-profile owners.
- Inferred: the Website generation seed is the deterministic host substitute
  for retail's process-global color draw position. This is an existing browser
  authority policy, not a newly claimed native RNG identity.
- Unknown material to implementation: none. No platform approximation is
  required.

## Validation contract

- Focused chat red/green: source and browser contracts for focus-independent
  Escape, no Pause leak, immediate successful-submit close, rejection-visible
  reopen, own-echo no-unread, remote unread, and Global/Party/Whisper plus
  Hub/Boneyard shared paths.
- Focused generation red/green: mutate old Hat/Robe tints, active inventory,
  level/XP, learned order/ranks, advanced unlocks, primary/concentrations,
  quickbar, offers, cast/status/runtime fields, then complete Game Over and
  confirm a different element. Assert fresh starter equipment/potions, exact
  selected starting pair, no old learned member, fresh selected-element color,
  newer progression/economy revisions, and preserved durable profile fields.
  Cover all fifteen element/discipline tuples and the negative College-green
  sibling.
- Mac browser chat: open in Hub, move focus from the input to a chat control,
  press Escape, and prove the composer closes without Pause. Reopen, send, and
  prove it closes before the ordered own echo, the transcript/world cue occurs
  once, and unread remains zero. Repeat the shared path in Boneyard and require
  empty page/console/failed-response arrays.
- Mac browser generation: the existing real two-client death/Game Over journey
  begins with different old elements, learns/mutates run state, confirms Water
  and Earth, then opens Inventory/Skill Book and records the selected-family
  Hat/Robe tints, starter-only inventory, level 1/XP 0, exact new starting pair,
  empty old ranks/selections, and durable-profile preservation.
- Run the exact rebased candidate through `/opt/homebrew/bin/bash
  ./scripts/validate.sh`; run Mod Loader `python3
  tests/re/run_static_re_tests.py --ci`; compare local/Mac changed-file
  manifests byte-for-byte before publication.
