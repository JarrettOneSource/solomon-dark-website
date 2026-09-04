# 2026-08-26 — Concentration-capable skill quickbar and key swaps

## Reported smell and parity question

- Reported web behavior: learned spells and concentrations cannot all be
  dragged onto the live eight-slot hotbar and selected with its configured
  bindings.
- Stock/native boundary: retail exposes card drag for learned category-1
  primaries and category-2 secondaries only. Category-3 concentration cards
  select through the shared router instead. The underlying BeltButton action
  dispatcher nevertheless routes category 3 through the same native
  concentration selection owner.
- Requested product behavior: deliberately broaden manual hotbar assignment to
  learned category 3, then make every existing slot input select that
  concentration through the ordinary A/B fill and Split Mind alternating-
  replacement rule. Do not change automatic population or turn a
  concentration into a cast.
- Falsifiers: a client-only selection; a concentration stored in a snapshot
  that strict decode/save restore rejects; repeated held ticks alternating A/B;
  bypassing Mind Chug, Tutorial, modal, Staff-action, death, or pause input
  gates; category-2 regression; or a direct slot-A-only shortcut.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | unmodified 0.72.5 `SolomonDark.exe`, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Same pinned image as the closed SkillScreen/BeltButton report. | high |
| Existing complete native report | Mod Loader `docs/reverse-engineering/native-skill-screen-and-quickbar.md`; `0x00656980`, `0x006564A0`, `0x005C7090`, `0x005D8120`, `0x005D5600` | Card drag admits categories 1/2; BeltButton activation classifies the stored row and contains category-1 select, category-2 invoke, and category-3 concentration routes. | high |
| Authored catalog | Website `native-skill-catalog.json` and Mod Loader `native-skill-catalog.json` | Primaries are `8,16,24,32,40,52`; category-2 has 23 rows; concentrations are every authored category-3 row `57..63,65..71`. | high |
| Current web causal trace | Website `b3c013b1`; `SkillBook.tsx`, `player-progression.ts`, `game-client-session.ts`, `game-protocol.ts`, `game-simulation.ts`, `SkillQuickbar.tsx` | Pointer drag, bind validation, wire decode, snapshot decode, and authoritative activation each stop at categories 1/2. The existing keyboard/mouse/touch/controller producer already addresses all eight slots. | high |
| Existing concentration authority | `setPlayerConcentration`, `selectPlayerEntityConcentration`, selected-skill messages and tests | Selection rejects unlearned rows and Mind Chug; no-ops when already selected; fills A then B and thereafter consumes the shared Split Mind A/B replacement cursor. | high |

No fresh Ghidra extraction is required: the current durable report already
drains the complete dispatcher, card, BeltButton, category, and selector xref
sets. This pass changes Website product admission, not a recovered retail fact.

## System boundary and membership inventory

Native system plus explicit web extension: learned skill-card pointer drag,
eight authoritative quickbar bindings, every slot-input producer, category
routing, concentration replacement state, replication/save, presentation, and
all lifecycle gates.

| Member | Source | Disposition | Proof contract |
| --- | --- | --- | --- |
| five pure primaries `8/16/24/32/40` | category 1 | `verified-already-at-parity` | drag/duplicate/replace and bound key select remain green |
| Spell Welding row `52` and builds `1000..1009` | category 1 plus active build | `verified-already-at-parity` | binding retains row 52 and selection resolves current build |
| all 23 category-2 secondaries | authored category table | `verified-already-at-parity` | held/edge cast, cooldown, mana, aim, and Hub disable remain unchanged |
| all fourteen concentrations `57..63,65..71` | category 3 and `0x005D5600` | `exact-ported` selection semantics behind an explicit web drag extension | every row binds, replicates, restores, and swaps from a slot input |
| passive categories 0/4 and internal row 80 | category predicates / Plane Orb override | `out-of-system` (not manually bindable skills) | strict negative model/wire tests |
| eight slots, null, occupied replacement, duplicates | `0x005C7090`, stride `0xEC` | `verified-already-at-parity` with broadened category admission | concentration duplicates are legal bindings; destination-only overwrite |
| SkillScreen mouse/touch Pointer Events | shared SkillDragger projection | `exact-ported` web extension for category 3 | strict greater-than-three threshold, painted-belt overlap, accepted sound, teardown |
| keyboard defaults and rebound bindings | shared `cast.quickbar` producer | `verified-already-at-parity` | physical key selects the bound primary/concentration or invokes secondary |
| mouse, touch, and controller slot producers | same addressed slot lane | `verified-already-at-parity` with category-3 consumer coverage | no input-source-specific routing branch |
| no Split Mind | concentration owner | `exact-ported` | key swap replaces A after initial fill; selected row is a no-op |
| Split Mind empty/partial/full A/B state | concentration owner and replacement cursor | `exact-ported` | fill A, fill B, alternate A/B; active duplicate is a no-op |
| Mind Chug | progression gate | `exact-ported` | bound row remains visible but key selection mutates nothing |
| Hub and active Boneyard | shared simulation/player entity | `exact-ported` | same authoritative mutation and snapshot in both worlds |
| Tutorial access, Staff action, level-up, pause, death/spectator, Game Over | existing input/edit gates | `verified-already-at-parity` | category 3 cannot open a new bypass |
| host, guest, late join, reconnect, save slot | protocol/snapshot/save owners | `exact-ported` | strict category-3 binding round trip and authoritative revision |
| automatic skill acquisition/population | `0x005C85E0` parity owner | `verified-already-at-parity` and intentionally unchanged | categories 1/2 only; concentration requires manual drag |
| selected-skill top HUD/compact modal | bindings 12/16/20 | `verified-already-at-parity` | remains an addressed A/B alternative, not replaced by the hotbar |

No member is blocked by the browser platform.

## Native ownership thread and recovered behavioral contract

- SkillScreen remains the pointer owner. A category-3 card now opts into the
  existing web SkillDragger projection; successful release sends the same
  addressed slot mutation used by categories 1/2.
- The player skill book remains the sole quickbar owner. The accepted value is
  null or a permanently learned category 1/2/3 row. Bindings stay independent,
  permit duplicates, and overwrite only the addressed destination.
- `cast.quickbar` remains one held slot identity shared by keyboard, mouse,
  touch, and controller. Category 3 consumes only the existing secondary
  system's rising slot edge, preventing a held binding from re-running the
  selection owner every fixed tick.
- Category 1 still selects and resets the primary-cast lane. Category 2 still
  invokes the secondary system. Category 3 calls the ordinary non-addressed
  concentration owner: already-active row no-op; otherwise fill A, then Split
  Mind B, then the persisted alternating replacement cursor.
- Mind Chug rejection, modal/input suppression, Tutorial access, Staff-action
  input clearing, participant ownership, fixed-tick mutation, snapshot
  ordering, save checkpointing, world transfer, and teardown remain upstream
  or downstream of the same shared lane.

## Nearby-system findings

- The current Pixi SkillPage already paints category 3 with the actionable gold
  frame, so the requested drag behavior matches its visible affordance; only
  the semantic Pointer Events admission is missing.
- All configured quickbar keybinds already resolve to slots `0..7`. No new key
  settings, DOM listener, input message, or client-local selection store is
  needed.
- Retail's manual drag membership remains categories 1/2. The category-3 drag
  admission is an explicit Website convenience difference; Mod Loader native
  documentation remains unchanged.

## Web implementation consequence

- Broaden one shared quickbar-admission predicate/type to categories 1/2/3 and
  use it consistently in the model, client request, wire decoder, snapshot
  decoder, and save-restored state.
- Admit category-3 Pointer Events in `SkillBook` without changing ordinary
  click selection, drag geometry, sound, duplicates, pull-off, or automatic
  acquisition.
- On a rising quickbar slot edge, route a category-3 row through
  `selectPlayerEntityConcentrationSkill`; reject Mind Chug or invalid runtime
  state without crashing the authoritative tick. Leave categories 1/2 on
  their existing paths.
- Present a bound concentration as active when it occupies A or B. Keep
  cooldown and Hub-disable behavior exclusive to category 2.
- Bump the strict game protocol because category-3 quickbar values become a new
  accepted wire/snapshot shape. The save document schema need not change: its
  structural field is still an eight-entry nullable skill-id array validated
  by the current protocol projection.

## Validation contract

- Red/green model tests: all three accepted categories, unlearned/passive/row-80
  rejection, exact eight slots, duplicates, one-slot replacement, and
  category-3 drag admission.
- Simulation tests: keyboard-shaped press/release selects a concentration,
  repeated held tick is a no-op, no-Split-Mind replacement, Split Mind
  fill/alternate cursor, already-selected no-op, Mind Chug rejection, and
  category-1/2 non-regression.
- Protocol/host/save tests: client bind plus snapshot decode for category 3,
  malformed/unlearned rejection, guest ownership, reconnect/save round trip,
  and protocol-version assertion.
- HUD tests: category-3 binding renders the authored icon/key plaque as active
  in A or B, has no secondary cooldown/Hub disable, and remains removable.
- Mac Chrome: open the real SkillScreen, drag a learned concentration to a
  painted occupied/empty belt slot, close the modal, use its configured key in
  Hub and Boneyard, observe authoritative A/B swaps, and restore the persisted
  binding document. Also select a primary and cast a secondary from sibling
  slots. Require empty page, console, failed-request, failed-response, and host
  error output plus a clean task-host shutdown.
- Run `/opt/homebrew/bin/bash ./scripts/validate.sh` on the byte-identical Mac
  candidate. The Mod Loader tree stays unchanged unless validation exposes a
  genuinely new retail fact.

## Implementation validation receipt

- Implementation: `player-progression.ts` owns the one categories-1/2/3
  admission predicate and the complete fourteen-row concentration type.
  SkillScreen admits category 3 to its existing Pointer Events dragger;
  client request, strict protocol 85, snapshot decode, host mutation, save
  projection, and the eight-entry tuple share that predicate. Automatic
  acquisition remains categories 1/2 only.
- Activation: the Hub combat seal now retains category-3 slot identity without
  admitting category-2 combat. `GameSimulation` consumes only a rising slot
  edge and calls the existing general concentration owner after learned,
  effective-rank, and Mind Chug gates. Categories 1/2 retain their prior
  select/cast paths. `SkillQuickbar` shows a concentration active exactly when
  it occupies A or B and gives it no secondary cooldown or Hub-disable state.
- Red receipt: the tests-only exact-base Mac tree failed the intended two
  contracts, `quickbar accepts learned primaries and concentrations while
  rejecting passives` and `concentration bindings use the ordinary slot input
  and selected-state treatment`; the surrounding group passed 282/284. Log
  SHA-256 is
  `62d9ff137827e2ccee6db6e135ccfa8c99b05652aedb7bbcd3bde3e714eb79f7`.
- Exact green candidate: local and Mac detached base are
  `b3c013b15a6e39e7a3651c4048accba8007d0647`; all 19 changed files are
  SHA-256-identical before validation. The Mac path is
  `/Users/jarrett/codex-acceptance/hotbar-concentration-20260826-final/Website`.
- Canonical Mac gate: `/opt/homebrew/bin/bash ./scripts/validate.sh` exits zero.
  All 2,369 reported Node tests pass across the complete groups, the backend
  Release build succeeds, TypeScript/lint/import boundaries pass, production
  frontend and game-host builds succeed, and media policy is clean. The Game
  entry is `469268` raw / `131060` gzip bytes against `524288` / `134144`.
  Log SHA-256 is
  `c0a71d6ce98c9652cc495cffb2966d0d3eb80751139de865aee35bbad10d4eb6`.
- Mac Chrome 151: the real `smoke:game:skill-book` journey drags Channel Mana
  `57`, Meditation `58`, Battle Mage `59`, Fireball `16`, and the existing
  Magic Missile `8` onto painted belt slots. IndexedDB restore observes every
  addressed binding. Configured keys swap Magic Missile/Fireball in the Hub,
  alternate A/B through `58 -> 59`, and then select Channel Mana in the live
  Boneyard, leaving authoritative `[57,59]`. Page, console, and
  request/response error arrays are empty; the task host closes normally. Log SHA-256 is
  `3786bb1348a5ec56004f1b9a68633120e0153dc8e9613f92f1c0a3f47e204878`.
- Visual inspection: the SkillScreen frame shows the live Channel Mana dragger
  over its accepting painted slot; the Hub frame shows the populated key
  plaques plus selected Meditation/Battle Mage pair; the Boneyard frame shows
  Channel Mana selected from key 1 while all bound icons remain in the belt.
  Screenshot SHA-256 values are
  `2e5619c856b3d05a9faa94ff0732a5db55b85dbae58c43a0502dd6ca26b1456f`,
  `a0b169ac24e988d5904d8126fe67277e8a88f36ab91e7b1ddf7a220035e57300`,
  and `1d5535a9d2b00cccc5ca6637bb8491463274c276c931155e2a983c96e03a334f`.
- No browser-platform block or material unknown remains. The Mod Loader native
  report stays unchanged because category-3 drag is explicitly a Website
  convenience extension over already-settled retail routing. The work is
  local and uncommitted; nothing is pushed or deployed.

## 2026-08-28 — Same-tick primary-selection cast reset reopening

### Reported smell and parity question

- Production diagnostic row `71`, captured at `2026-08-28T23:46:32Z` on
  deployed Website `4204d3cccd43982fb1bbb851daf442b92b65c861`, records a
  protocol-105 shared-Hub client closing with code `4008` because
  `primaryCast.lastWeldPlaybackRate does not match the active build`.
  Website and game services remained active with `NRestarts=0`.
- The player had resumed the same Tutorial run across the deployment, opened
  the selected-skill, inventory, and SkillScreen modal owners, then remained
  connected for more than four minutes before the invalid frame. The failure
  is therefore a live selection/cast-state transition, not handshake or
  archive corruption.
- Stock behavior already recovered here and in the welded-primary ledger:
  every category-1 selection atomically changes the selected row/build and
  resets the incompatible Staff Cast 1/Constant state. Weld pitch and variant
  are retained only across the one authoritative cast edge that produced
  them; they do not survive selection of another primary.
- Falsifiers: every authoritative selection path reaches the shared reset and
  the reset survives the rest of the same fixed tick; a legal weld pitch lies
  outside `[0.5,1.5]`; save/rejoin alone reproduces the mismatch; or a current
  full-simulation snapshot accepts a quickbar switch away from a retained weld
  edge without additional synchronization.

This is a secondary report against the category-1 quickbar reset ownership
recorded above. The earlier component-level proof stopped at
`selectPlayerEntityPrimarySkill`; it did not follow that reset through the
remaining fixed-tick player projections and final snapshot. Production rows
`51/52` (`primaryCast.targetId is only valid for Air`) are the same omitted
membership class: another selection-owned cast field can outlive the selected
primary when a stale tick projection overwrites the reset.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Production diagnostic | NFO `/var/lib/solomon-dark-revived/sdr.db`, `DiagnosticLogs.Id=71`; protocol 105; current deployed SHA above | The client decoded one authoritative frame whose selected progression/build and retained weld pitch were mutually invalid, then closed cleanly with `4008`. | high-live |
| Production lifecycle | `solomon-dark-game.service` journal `2026-08-28T23:41:56Z..23:46:34Z` | The player resumed after the intentional deployment restart, used modal skill owners, then disconnected on the protocol reason; the host did not crash. | high-live |
| Existing native ownership | category-1 BeltButton/selector routing `0x005D8120`; welded `Sound::Play(pitch,gain) 0x00407CD0`; existing quickbar and welded-primary ledgers | Selection and incompatible action-state teardown are one owner; retained weld pitch/variant belong only to their producing cast edge. | high |
| Current web causal trace | `finishGameSimulationTick`, `selectPlayerEntityPrimarySkill`, `resetSelectedPlayerPrimaryCast`, `stepPrimarySpells`, `createGameSnapshot` at `4204d3cc` | The player store clears every selection-owned cast field, but `secondaryPlayers` is rebuilt later from the pre-selection `resolvedPlayers` projection. Final character replacement writes the stale cast component back beside the new skill book. | high |
| Existing range tests | welded one-shot and retained-rock constructor tests | Every native producer stays inside the current legal pitch lane: one-shots are `.75`, `[1,1.5]`, or weak Ground `[.76,.84]`; retained-rock starts are `[1,1.5]`. Range widening cannot repair the cross-owner state. | high |

No new native extraction is required. The pinned retail executable remains
0.72.5, SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`,
preferred image base `0x00400000`; the existing quickbar and welded-primary
entries already own the complete selection and audio contracts.

### System boundary and membership inventory

Native/web system: **category-1 primary selection and atomic selected-cast
state replacement**, from every authoritative selection producer through the
remaining fixed tick, spell authority, snapshot projection, strict player and
observer decode, save/rejoin, and teardown.

| Member / branch | Owner | Disposition | Proof contract |
| --- | --- | --- | --- |
| Pure primary rows `8/16/24/32/40` | category-1 selection | `verified-already-at-parity`; tick projection reopened | switching from any weld retains the new row and the reset cast component in the same snapshot |
| Spell Welding row `52`, builds `1000..1009` | category-1 selection plus active build | `verified-already-at-parity`; tick projection reopened | switching into Weld resolves its current build with no pure-row action residue |
| One-shot welds `1000/1001/1002/1009` | Cast 1 edge | `verified-already-at-parity` producer; reset `exact-ported` by this correction | playback rate and variants remain for their producing edge, then clear atomically on selection |
| Channel welds `1003/1004/1005` | Staff Constant | `verified-already-at-parity` producer; reset `exact-ported` | held/channel/target state cannot cross to another row |
| Persistent welds `1006/1007/1008` | retained actor/channel owner | `verified-already-at-parity` producer; reset `exact-ported` | randomized rock-start pitch and held state cannot cross selection; actor release/teardown stays independent |
| Reset-owned fields | `resetSelectedPlayerPrimaryCast` | `exact-ported` through final projection | `actionTick`, `channelActive`, `held`, weld pitch/variant, one-shot pose, selected age/id, target, and weak state survive no stale overwrite |
| SkillScreen and selected-HUD selector requests | host mutation between ticks | `verified-already-at-parity` | shared reset remains present on the next tick and snapshot |
| Keyboard/mouse/touch/controller quickbar row | same-tick `cast.quickbar` path | `exact-ported` by this correction | selection reset is the primary-spell input on that same fixed tick |
| Skill acquisition, automatic selection, Weld grant/rebuild, and mod replacement | player-skill refresh owner | `exact-ported` at the shared tick boundary | any primary/build change before spell stepping supplies its refreshed cast component |
| locomotion, Staff-facing, Deflect-facing, and secondary relocation | independent character lanes | `verified-already-at-parity` | refreshing primary cast does not overwrite current position, heading, gait, or secondary relocation |
| player, peer/observer, keyframe, late join, checkpoint/rejoin | shared strict snapshot | `exact-ported` by the same authoritative correction | every recipient sees one coherent selection/cast pair; genuine invalid combinations still fail closed |
| release, death, disconnect, run replacement, and title return | existing lifecycle owners | `verified-already-at-parity` | no retained cast field or spell actor crosses its established teardown boundary |

No member is blocked by the browser platform.

### Native ownership thread and recovered behavioral contract

- Category-1 selection owns one indivisible selected-row/build plus cast-state
  transition. Fixed-tick spell authority may consume that pair only after both
  halves have changed.
- `resolvedPlayers` owns the current locomotion/Staff-facing projection for the
  tick. `PlayerEntityStore.primaryCasts` owns primary selection resets. Merging
  the former wholesale after a selection reintroduces stale cast state; the
  spell input must take the current cast component without replacing unrelated
  movement and facing lanes.
- Weld pitch and sound variant remain authoritative because a projectile may
  collide on its birth tick. Their legal ranges and audio playback stay
  unchanged. Clearing them outside their producing selection is teardown, not
  normalization or decoder leniency.
- Save/rejoin, player/observer decoding, and invalid-frame closure remain
  strict. The fix makes the host stop producing an impossible combination; it
  does not catch, clamp, omit, or reinterpret it.

### Confidence and open questions

- Confirmed: exact current production symptom and lifecycle, legal pitch
  ranges, shared reset helper, stale-projection overwrite path, complete reset
  field membership, and every selection producer that can reach the fixed-tick
  boundary.
- Inferred: the live trigger was a quickbar primary switch after the player's
  SkillScreen interaction. The bounded diagnostic does not archive the input
  message, but the same-tick path deterministically produces the exact invalid
  selection/cast pair while between-tick selectors do not.
- Unknown material to implementation: none. A full-simulation red test can
  distinguish the same-tick path without reconstructing the private input
  sequence.

### Web implementation consequence

- Before secondary and primary spell stepping, combine the tick-current
  locomotion projection with the current player-store primary-cast component.
  Keep the player store as the sole owner of selection reset state.
- Do not widen the weld playback lane, clear fields in the decoder, add a
  build-specific exception, or reset unrelated locomotion/presentation state.
- Keep protocol 105 and the save schema unchanged: the legal wire shape and
  validation domain do not change; the authority stops emitting an already-
  illegal combination.

### Validation contract

- Red/green full-simulation test: start with a valid retained weld playback
  rate/variant/target/action state, select each pure primary through a bound
  quickbar edge without casting, and require the complete reset component in
  the resulting player state and strict snapshot.
- Sibling test: preserve current movement/heading while the cast component is
  refreshed, and retain an ordinary same-row weld edge when selection does not
  change.
- Protocol negative: manually reintroducing a weld playback rate beside a
  pure primary must still throw the production error.
- Mac browser: in a real generated Boneyard/Tutorial-capable session, cast a
  randomized-pitch weld, switch to a pure primary from the painted quickbar,
  and remain connected through player and observer snapshots. Require empty
  page, console, failed-response, protocol-close, and host-error arrays.
- Exact candidate: run `/opt/homebrew/bin/bash ./scripts/validate.sh` on the
  byte-identical Mac worktree.

### Implementation validation receipt

- Root cause: `selectPlayerEntityPrimarySkill` correctly reset the component,
  but `finishGameSimulationTick` later supplied `stepPrimarySpells` with the
  pre-selection `resolvedPlayers` cast and prior-tick cast baseline. The spell
  result then replaced `PlayerEntityStore.primaryCasts`, restoring the stale
  weld pitch/variant beside the newly selected pure primary. The same omitted
  boundary explains the earlier production `targetId is only valid for Air`
  sibling reports.
- Implementation: immediately before primary-spell stepping,
  `game-simulation.ts` combines the tick-current movement/Staff/secondary
  projection with the player store's current `primaryCast`. When that selected
  primary identity differs from the prior tick, the reset cast is also the
  primary kernel's previous-state baseline for this tick. No other character
  lane is overwritten. Protocol 105, save schema 20, pitch ranges, strict
  decoder errors, audio, spell constructors, and renderer paths are unchanged.
- Regression: the full-simulation test starts from a legal Ball Lightning
  Cast 1 edge with non-null pitch and variant, selects Fireball through a bound
  quickbar while moving, and requires the complete selection reset plus a
  strict snapshot round trip. It then deliberately reintroduces the production
  illegal combination and proves the decoder still rejects it with
  `lastWeldPlaybackRate does not match the active build`.
- Red Mac receipt: on exact base `4204d3cc`, the new full-simulation test was
  the sole failure in the Boneyard group (`1683/1684` passed). The actual state
  retained `actionTick=13`, playback rate `1.25`, sound variant `1`, held pose,
  and weak state after progression had already selected Fireball, reproducing
  the production owner mismatch. The first corrected run showed that the
  freshly reset selected-primary age advances to one on the same native fixed
  tick; the final assertion records that clock rather than freezing it at zero.
- Canonical Mac gate: the byte-identical corrected candidate passes
  `/opt/homebrew/bin/bash ./scripts/validate.sh`: backend Release build with
  zero warnings/errors; all `28/28` Website/backend contracts; formatting,
  lint, architecture, generated-content checks; corrected Boneyard/host group
  `1684/1684`; all ML, weather, party, level-up, Tutorial, diagnostic, Hall,
  Hub, desktop, and remaining registered suites; production frontend and game
  host builds; media policy; and bundle budget. The production Game entry is
  `262,499` raw / `79,617` gzip bytes against `524,288` / `134,144`.
- Built Mac Chrome receipt: Chrome served the canonical production
  `backend/wwwroot` bundle, connected one real protocol-105 player, and
  consumed a valid authoritative Ball Lightning edge with
  `actionTick=64`, `emissionSequence=2`, randomized playback rate
  `1.1767849922180176`, and sound variant `1`. Clicking the painted Fireball
  quickbar produced selected primary `16`, cleared both retained weld fields,
  returned action tick `-1`, and remained connected. Page, console, request,
  response, protocol-close, and host-error arrays were empty.
- Supplemental Mac Chrome scene receipt: the repository's real SkillScreen and
  quickbar journey entered an active Boneyard on the same exact source tree,
  switched the authoritative primary from Magic Missile `8` to Fireball `16`
  through the Boneyard selector, and observed the local and replicated orb
  programs agree at both edges. It also exercised the Boneyard SkillScreen /
  Inventory replacement lifecycle and a concentration hotbar selection. Page,
  console, request, and response error arrays were empty.
- No platform block or material unknown remains. The browser can represent
  the native state exactly, and no Mod Loader file or duplicated native report
  changed.

## 2026-09-04 — Production stale selected-skill request reopening

### Reported smell and parity question

- NFO browser diagnostics contain two new protocol-117 fatal returns from
  `/game`: `The primary skill is unavailable.` at
  `2026-09-03T00:48:47Z` and `The concentration is unavailable.` at
  `2026-09-04T04:14:29Z`. The host converted both into `invalid-message`,
  closed the only player, and retired that player's active run. Neither
  supervised process crashed or restarted.
- This is a secondary report against this selected-skill system. The earlier
  pass tested an unlearned selection as a fatal protocol violation, but did not
  inventory the asynchronous gap between a browser's last accepted snapshot
  and the authority's current pause, barrier, life, Mind Chug, College, or run
  state. It conflated a structurally invalid message with a well-formed player
  intent that became stale in transit.
- Stock behavior to preserve: selecting a currently available primary or
  concentration mutates the actor-owned book/runtime atomically. Clicking an
  unavailable row cannot end the game process or destroy the wizard/run.
- Falsifiable question: does a learned, structurally valid selection sent after
  its Skill Book pause releases or a level-up barrier begins reproduce the
  exact server disconnect? If so, treating rejected selected-skill edits as
  no-ops while retaining strict wire decoding must preserve authority without
  ejecting the player.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Production browser/host | `DiagnosticLogs` captures above plus `solomon-dark-game.service` journal at deployed `a7d470cd`, protocol 117 | Both clients sent a decodable selected-skill request; the host replied 1008/`invalid-message`. The shared-Hub client was repeatedly recovering old baselines and sent the primary request after its Skill Book pause had released. The private Air client had repeated flow-control pressure and several successful concentration checkpoints before the fatal rejection. | high-live |
| Current authority | `game-host.ts`, `game-simulation.ts`, `player-entity-store.ts` | Wire decode rejects malformed IDs/slots. The host then maps every null edit result—temporary lifecycle gate, stale learned state, Mind Chug, or illegal row—to the same fatal disconnect. | high |
| Existing native ownership | selected primary `0x005D8120`, concentration `0x005D5600`, SkillScreen/BeltButton report and complete authored catalogs already recorded above | Selection is actor-local and unavailable input is non-mutating. The native single-process UI has no network race or session to terminate. | high |
| Sibling web behavior | `client-hub-action` authority and host test `rejects stale inventory commands without disconnecting` | Another player-owned editor already returns authoritative rejected feedback/no mutation and keeps the same authenticated socket alive. | high |

### System boundary and membership inventory

Native system plus required network adaptation: authenticated selected-skill
configuration intents from browser producers through strict wire shape,
current authority gates, mutation, replication/checkpoint, and nonfatal stale
completion.

| Member / branch | Owner | Disposition | Proof |
| --- | --- | --- | --- |
| pure primary rows `8/16/24/32/40` and Weld row `52`/builds `1000..1009` | selected-primary owner | `verified-already-at-parity`; stale completion `exact-ported` here | accepted rows still reset cast state; a delayed learned row is a no-op, not a disconnect |
| all concentrations `57..63,65..71`, general selection and addressed A/B slots | concentration owner | `verified-already-at-parity`; stale completion `exact-ported` | accepted fill/replace stays unchanged; delayed request under a current gate keeps the socket alive |
| eight quickbar bindings and null removal | player skill book | `exact-ported` shared correction | stale/unlearned binding cannot mutate or disconnect; accepted binding still checkpoints |
| SkillScreen, selected-HUD primary/A/B selector, and quickbar producers | browser semantic input | `exact-ported` across asynchronous delivery | every producer may race a newer authority snapshot safely |
| Skill Book pause owner/release and resume grace | game host lifecycle | `exact-ported` race boundary | selection arriving after release/grace is ignored without reopening the modal or changing state |
| level-up barrier and pending offer | progression lifecycle | `exact-ported` race boundary | a newly raised barrier wins; old selector input cannot bypass it or eject the actor |
| death/spectator, Game Over/loadout replacement, Tutorial/College admission, and private-room transition | player/run lifecycle | `exact-ported` race boundary | current authority wins with no mutation and no disconnect |
| Mind Chug and Split Mind occupancy/exclusion | concentration runtime | `verified-already-at-parity`; stale rejection `exact-ported` | no bypass, fill, duplicate, or replacement occurs while unavailable |
| malformed JSON/message type, out-of-range slot, non-integer ID, and invalid protocol shape | protocol decoder | `verified-already-at-parity` | remains fatal `invalid-message`; this correction does not relax the wire |
| level-up offer choice/reroll/save sequences | separate sequenced offer lifecycle | `out-of-system`: not one of the selected-skill configuration messages or reported failures | existing offer-sequence authority remains unchanged |
| inventory, social, chat, Tutorial actions, and Boneyard selection | separate semantic action owners | `out-of-system` | no behavior changes |

No member is blocked by the browser platform.

### Recovered behavioral contract

- A decoded message proves only structural validity. Availability is evaluated
  against the current authoritative actor/run state at handling time and may
  legitimately differ from the browser snapshot used to render the control.
- An accepted edit remains atomic, clears active input, broadcasts the new
  snapshot, and checkpoints. A rejected edit changes nothing. The next normal
  snapshot reconciles the browser; it must not terminate the authenticated
  session or retire a run.
- Current pause/barrier/life/College/Mind Chug gates stay authoritative. This is
  not optimistic mutation, retry, clamping, or decoder leniency.

### Nearby-system findings

- The shared-Hub incident retained one active Boneyard behind the Hub session;
  fatal socket closure then retired that otherwise valid run. A nonfatal no-op
  preserves both the player and run without changing party ownership.
- Both incidents occurred under substantial replication backpressure. That
  pressure explains a wider browser/authority observation gap, but no amount of
  lag should turn an authenticated state race into malformed protocol data.
- The current Skill Book browser smoke still searched for
  `data-prompt-kind="tutorial"` on the dialog after native UI moved that owner to
  the enclosing stage. The real prompt correctly intercepted Play. Update only
  that locator so the maintained journey reaches the selected-skill system.

### Confidence and open questions

- Confirmed: exact live failures, service/run consequences, accepted protocol
  shape, current rejection collapse, all selected-skill producers and gates.
- Inferred: the precise gate that won each live race. The bounded report omits
  the request payload/current host progression, but reproducing multiple
  legitimate gates reaches the identical fatal branch and the correction is
  gate-independent.
- Unknown material to implementation: none.

### Web implementation consequence and validation contract

- Keep the strict protocol decoder unchanged. At the host's selected-primary,
  selected-concentration, addressed concentration, and quickbar-binding
  handlers, return without mutation when the current authority rejects a
  decoded request.
- Add host regressions that delay a learned primary past Skill Book pause
  release, delay a learned concentration into a level-up barrier and Mind Chug,
  and submit an unlearned binding. Assert state equality, an open socket, and a
  subsequent ping/pong for every branch. Retain accepted mutation/checkpoint
  coverage and strict malformed-wire tests.
- On the Mac mini, run the focused host/client/protocol/progression matrices,
  the complete Website gate, and a real built-site journey that repeatedly
  races selector actions with pause/picker edges under snapshot pressure.
  Require no fatal surface, protocol close, page/console error, or host error.

### Implementation validation receipt

- Red Mac receipt on exact `a7d470cd`: all three connection-survival cases
  reached WebSocket state 3 instead of the required open state 1. They
  reproduced unlearned quickbar/general concentration, a learned primary after
  a level-up barrier won, and addressed concentration during Mind Chug. The
  full focused run had only those three selection failures plus the two
  independent timeline failures.
- Implementation: the four host handlers keep strict message decoding but now
  return without mutation when current authority rejects a quickbar binding,
  primary selection, general concentration, or addressed A/B concentration.
  Accepted edits retain input clearing, snapshot broadcast, and checkpointing;
  no protocol or save-schema change is required.
- Green host receipt: all 88 host tests passed. Rejected edits preserved the
  exact belt/book/runtime values, every socket remained open, and each client
  completed a subsequent authenticated ping/pong. The 132-test Air/Storm/Mage,
  client, and protocol matrix separately retained all malformed-wire and
  accepted-selection checks.
- Real Mac Chrome 152 completed the full Skill Book/HUD journey through Hub and
  Boneyard: category-1 primary selection, all three tested concentration
  bindings, addressed A/B replacement, hotbar key swaps, pause/reopen/cancel,
  checkpoints, and replicated orb selection. Page, console, and network error
  arrays were empty; no fatal surface or protocol close occurred.
- The first complete Mac gate on the core eight-file candidate passed 19
  Website/backend contracts, 2,643 Node tests, Release build/format/lint,
  TypeScript, desktop tests, production frontend/game-host builds, media
  policy, and bundle budget. The final exact-tree gate after this ledger and
  smoke-locator correction is recorded in the external completion receipt so
  recording it cannot change the validated tree.
- No platform block or material unknown remains. The exact gate that won each
  historical live race is not needed: every current-authority rejection in the
  complete selected-skill configuration family now has the same safe outcome.
