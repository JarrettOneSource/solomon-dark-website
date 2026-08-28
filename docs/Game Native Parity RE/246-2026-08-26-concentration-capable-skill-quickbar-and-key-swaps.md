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
