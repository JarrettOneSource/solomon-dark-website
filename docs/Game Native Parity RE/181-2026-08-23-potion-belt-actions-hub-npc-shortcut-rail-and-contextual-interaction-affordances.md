# 2026-08-23 — Potion belt actions, Hub NPC shortcut rail, and contextual interaction affordances

## Reported smell and parity question

- Reported web behavior: the visible Health/Mana potion controls work by click
  but the stock belt keys do not consume them; the Hub's five right-side NPC
  portraits are inert images; the existing nearby-trader semantic hit target is
  fully transparent and no interaction affordance exists for other named NPCs
  or locked Boneyard Goodies.
- Stock behavior to recover: the exact heterogeneous belt entries/default
  bindings and press-edge route; the complete five-member Hub shortcut rail and
  its service callbacks; every named Region actor/portrait hit circle and the
  locked-Goodie facing query/key transaction.
- Reproduction inputs/scenes: fresh WASD profile in Hub and active Boneyard;
  keys `3`/`4`; all five right-rail portraits; Courtyard/private-room NPCs and
  Mortuary portraits; an unopened Goodie with and without a recursive Wizard
  Key.
- Falsifiable questions: potion keys might be separate globals rather than
  belt slots; the portrait rail might be paint-only; its fifth portrait might
  be Teacher rather than Shlorio; trader shortcuts might retain world-distance
  gates; Goodies might accept a generic item-use target rather than the nearest
  authoritative facing query.
## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Executable identity | retail Beta 0.72.5 `SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Matches the canonical analyzed program and every cited durable native report | high |
| Instructions | canonical Ghidra replica; `0x005CFA80`, `0x005C7090`, `0x005CB360`, `0x005D8120`, `0x005D50E0`, recursive finders `0x005529A0/0x00552B70` | Starter Health/Mana entries occupy zero-based belt slots 3/4; binding edges route types `0x1B65/0x1B66` to recursive finders and then ordinary authoritative inventory use | high |
| Instructions/data | `0x00500250`, `0x005CBA00`, `0x005D2520`, `0x005D8120`, `0x00514A20`; `LevelPicker` records 0/6/4/5/2 | The Hub-only right rail is five live controls: Annalist, Hagatha, Luthacus, Fomentius, Shlorio. Four construct global Hub services without a distance test; Annalist only logs `Annalist?` in retail | high |
| Existing native reports/data | Mod Loader `native-input-model.md`, `native-hud.md`, `native-hub-and-economy.md`, `native-regions-npcs-and-world-props.md`, `native-loot-selector.md`, `native-hub-trader-catalog.json` schema 9 | Named-actor circles use the common engagement distance; Paintings have ten exact eulogy targets; Goodie uses the nearest strict facing query and consumes exactly one recursive Wizard Key | high |
| Current web causal trace | `GameHud.tsx`, `HubInventoryUi.tsx`, `hub-inventory-presentation.ts`, `HubScene.tsx`, `BoneyardScene.tsx`, `gameplay-input.ts`, `boneyard-loot-store.ts`, `game-simulation.ts` at base `ee7f8d44` | Potion actions exist only as direct button callbacks; keyboard slots continue into the skill cast lane. Five rail images have no hit targets. A trader prompt exists but CSS forces opacity zero. Goodies activate automatically during every loot tick | high |

## System boundary and membership inventory

Native system: the gameplay action-affordance family from a winning HUD/world
control edge through target resolution into its authoritative action. It
includes the default potion belt entries, all five Hub rail controls, every
currently materialized named Hub interaction circle/portrait, and unopened
Goodies. It excludes actors or controls which the native xref sweep proves
noninteractive.

| Member (class/variant/scene/branch) | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| Health Potion belt entry | `0x1B65`; slot 3; default DirectInput `0x04` / key `3` | exact-ported | default/rebound edge and host consume tests |
| Mana Potion belt entry | `0x1B66`; slot 4; default DirectInput `0x05` / key `4` | exact-ported | default/rebound edge and host consume tests |
| Wizard Chug, Antidote, Mind Chug, Rejuvenation Potion | ordinary item entry via `0x005C7090/0x005D8120` | verified-already-at-parity for inventory activation; out-of-system for default shortcut because startup inserts only subtypes 0/1 | existing six-subtype consume contracts |
| Rail Annalist / LevelPicker 0 | `Game+0xF68`; `0x00500250`; retail log `Annalist?` | exact-ported art/control; requested web deviation opens the exact Annalist dialogue | rail source test and browser click |
| Rail Hagatha / LevelPicker 6 | `Game+0x101C` | exact-ported | direct PerkShop browser journey |
| Rail Luthacus / LevelPicker 4 | `Game+0x10D0` | exact-ported | direct InventoryShop browser journey |
| Rail Fomentius / LevelPicker 5 | `Game+0x1184` | exact-ported | direct Shop browser journey |
| Rail Shlorio / LevelPicker 2 | `Game+0x1238` | exact-ported; stale `teacher` web label removed | direct DowsingShop browser journey |
| Courtyard Hagatha, Fomentius, Annalist, Luthacus, Teacher | compiled actor circles in `native-hub-and-economy.md` | exact-ported | per-target geometry/prompt/dialogue tests |
| Library Librarian and Shlorio | types 5013/5016 and shared room layout | exact-ported | per-target geometry/prompt/dialogue tests |
| Mortuary Memorator and Paintings `0,1,100,3,4,5,6,7,8,9` | types 5017/5018; Painting callback `0x00506190` | exact-ported prompt membership; dynamic eulogy-100 content remains out-of-system because the web has no memorial-profile producer | ten-target geometry tests; nine exact static narration rows |
| Office Arch Chancellor | type 5012 | exact-ported | prompt/dialogue test |
| Optional Tyrannia | type 5007; regenerated one-in-three builder member | out-of-system because the current authoritative web Hub does not materialize this optional actor; the prompt layer must not synthesize one | native population report plus web actor census |
| Students and types 2007/2008/2041 scenery | no-op interaction slot / no control | out-of-system (native noninteractive) | vtable and factory sweep |
| Remote player cards | web product interaction outside native friendly-NPC family | verified-already-at-parity | existing player hit/profile tests |
| Unopened Goodie, every subtype/reward selector | collider callback `0x00646D00`; strict 25-forward/50-radius query; 18-row contents table | exact-ported target/key/phase authority; requested explicit-action deviation replaces automatic proximity activation | resolver, no-key, one-key, all-subtype and browser prompt tests |
| Active/exhausted Goodie | Goodie 100/200/250 phase lifecycle | exact-ported no-prompt state | lifecycle tests |
| Solomon Dig intro/contact and Courtyard map control | separate encounter/contact and `Game+0xE00` owners | out-of-system (not contextual interact-button members) | separate lifecycle/control ledgers |

## Native ownership thread

- Owner and construction path: `Game` owns eight `BeltButton` objects and seven
  Region/HUD controls. Each fixed Region owns its named actors/paintings.
  Arena owns Goodies and the participant-private inventory owns Wizard Keys.
- Upstream state producers/callers: fresh-game setup inserts starter potions;
  settings publish belt scan codes; HUD hit traversal or queued keyboard edges
  select controls; Region builders publish actors; Boneyard authoring publishes
  Goodies.
- State representation and transitions: belt type/UID selects a skill, special
  potion finder, or ordinary inventory item. Hub rail services construct modal
  owners and block during Region fade. An unopened Goodie consumes one key,
  enters active timer zero, then phases at 100/200/250.
- Downstream consumers/callees: the common inventory-use dispatcher mutates
  vitals/stacks/audio; trader services mutate participant economy; dialogue/UI
  owns input suspension; Goodie phase materializes its exact reward table.
- Entry, interruption, reset, and teardown: Hub rail is absent in Boneyard and
  local death branches; Region fade blocks service creation; dialogue closes on
  back/range/region change; contextual prompts disappear on modal, transition,
  target loss, active/exhausted Goodie, and scene teardown.

## Recovered behavioral contract

- Health/Mana are belt slots, not independent bindings. Defaults are keys `3`
  and `4`; live belt rebinding must be honored. A press is an edge and an empty
  recursive potion search cannot fall through to skill casting.
- The rail order and source records are exactly Annalist/Hagatha/Luthacus/
  Fomentius/Shlorio = `0/6/4/5/2`. It is Hub-only. Service rail actions do not
  require proximity, but still reject while leaving/transitioning out of Hub.
- World NPC selection retains exact actor hit circles and common engagement
  range `distanceSquared <= 5*radiusSquared + 1500`; closest eligible target
  wins. World-click hit and visible prompt must resolve the same declaration.
- Goodie selection remains host-owned: project 25 units along the current
  24-heading direction; choose the nearest unopened phase-zero Goodie at strict
  distance squared below `50^2`; consume exactly one recursive Wizard Key.
- Retail has no global keyboard `INTERACT` plaque. A visible click/touch/keyboard
  prompt and explicit Goodie edge are requested browser product extensions.
  They may change admission timing but may not change native target geometry,
  key ownership, reward membership, or phase timing.

## Nearby-system findings

- The existing `hub-hud-npc-teacher.png` is LevelPicker record 2 and belongs to
  Shlorio's `Game+0x1238` Dowsing control. This is an ownership correction, not
  a cosmetic rename.
- `0x00514A20` proves Hub rail services are globally reachable inside a live
  Region; the current server's trader-distance rejection incorrectly makes a
  correctly opened shortcut unusable.
- The native report/catalog were updated with the reusable slot/control map.

## Confidence and open questions

- Confirmed: executable identity, all potion/rail control fields, records,
  callbacks, default keys, NPC/painting geometry, Goodie query/key/phase rules.
- Inferred: none used for native implementation constants.
- Unknown: the profile-backed content behind Painting eulogy index 100 and the
  complete Annalist/Teacher/Librarian progression services remain separately
  unimplemented systems. Their dialogue/prompt membership does not invent
  rewards or offers.

## Web implementation consequence

- Give browser gameplay input one edge interceptor for heterogeneous belt
  slots, shared by Hub/Boneyard, and route slots 3/4 to the existing
  authoritative `consume` action using the first recursive stack.
- Replace the five rail images with semantic buttons over the exact art and
  route four directly to existing services. Rename the fifth semantic member to
  Shlorio. Annalist opens exact stock dialogue per the user's requested useful
  behavior.
- Replace duplicated trader-only geometry with one declared interaction
  inventory consumed by nearest-target, world-hit, label, prompt, and range
  teardown logic. Keep unsupported progression service actions absent rather
  than fabricating them.
- Make the currently opacity-zero prompt visible and reusable. In Boneyard,
  render it for the authoritative Goodie query and send one validated
  interaction action. Remove automatic per-tick Goodie unlock.

## Validation contract

- Focused automated tests: exact keys/slots/rebinding/repeat/empty inventory;
  five rail records/actions/order; every named actor and ten Painting targets;
  strict range/tie boundaries; Goodie strict query/no-key/one-key/no-auto/
  active/exhausted branches; protocol decode and authority rejection outside an
  active run/Hub.
- Playwright journey: press `3` and `4` and observe quantity/vital mutation;
  click all five rail buttons; approach at least one Courtyard NPC, one private-
  room NPC, and one Painting; enter Boneyard and interact with a locked Goodie
  with and without a key. Capture prompt labels and modal/service state.
- Stock-versus-web comparison: matching `1600x900` rail order/art; exact potion
  defaults and Goodie target/key/phase results. The visible `INTERACT` plaque,
  explicit Goodie edge, and useful Annalist rail action are named requested
  differences.
- Measurable acceptance: one action per nonrepeat press, one item/key consumed,
  no cast on potion edges, correct service/dialogue for every button, no prompt
  during modal/transition/invalid target, and empty page/console/failed-response
  arrays.

## Implementation validation receipt

- Functional Website commit `9ef531fa` was rebased over current `origin/main`
  `a058a90a`; its receipt-only child retained tree
  `9553e92539aa5bbdb054701cf847379e9a8fbd86`. That tree was byte-identical at
  `/Users/jarrett/codex-acceptance/potion-hub-interact-20260823-rebased/website`
  on the Mac mini. The complete canonical `./scripts/validate.sh` gate passed
  with Node test-file concurrency fixed to one because unrelated ML training
  occupied seven of eight logical CPUs: backend build zero warnings/errors and
  `20/20` integration tests; all `1994/1994` frontend/desktop tests; lint and
  boundaries; production builds; media policy; and bundle budgets. The Game
  chunk was `448595` bytes raw / `126123` gzip, below `524288` / `131072`.
  Gate-log SHA-256 is
  `cccd63ed13947a71e1a7efa9f82494502df1b8d27498c52ed6facab37f0f5062`.
- Mod Loader commit `d90f9e87` retained tree
  `e85018eae61ad4f114e819a047904940cbaeaf55`, byte-identical at the matching
  `mod-loader` acceptance path. Its complete Python 3.12 static RE suite passed
  `509/509`; log SHA-256 is
  `234df7df4f518dbb1146e3f46c26feb2296fe94f00e0b58a30156a1493927257`.
- A headed Windows Chrome journey then ran the exact final Website tree from
  `C:\Users\User\codex-acceptance\solomon-potion-hub-interact-20260823-rebased\website`.
  Protocol 67 activated all rail records in native order `0/6/4/5/2`, opened
  Annalist and all four service owners, consumed the fresh Health/Mana stacks
  with keys `3`/`4`, opened Annalist through the visible `E` prompt, and
  reached a real authored Goodie in generated geometry
  `9b906dde2f28ebe9a6dabd983fddaf1543c462940069022453b125fa35a81f42`.
  The Goodie prompt resolved target `goodie:1`; clicking it with no Wizard Key
  retained the prompt/chest and emitted exact feedback `I need a key!`.
- The Windows receipt has empty page-error, console-error, failed-response, and
  unexpected-request-failure arrays. The only classified teardown aborts are
  the polled development revision manifest and the combat/death MP3 streams.
  Receipt SHA-256 is
  `e9f91bc81dedc8458cb60274062243030c0865643d694c95a992410862fc4b01`.
  Hub rail, NPC prompt, Goodie prompt, and no-key capture SHA-256 values are
  respectively
  `1d755cf6a80e4fc5a064e13fb646dfe1039a3ffc6b3195b2cbd4545afdaf910e`,
  `48700df9c2280152095405d810b1a0813f05d7384e7407f780cae4ee513b4982`,
  `09a6d367fb504fbac835506b4631f936df5d659d7834d3f4f9791e89b2f8bcfc`,
  and `184cf21dd4aa60d63722ce82d163bc432544e907aee3c3869b415c30f2ff5cd5`.
  The artifacts are retained under the Windows acceptance directory's
  `evidence` folder.
- The visible prompt/explicit Goodie action and useful Annalist rail dialogue
  remain intentional, user-confirmed web usability deviations. They retain the
  recovered stock hit/range/facing geometry and authoritative item ownership.
  The owner authorized normal fast-forward publication after validation.
  Production deployment and runtime restart remain separately unauthorized.
