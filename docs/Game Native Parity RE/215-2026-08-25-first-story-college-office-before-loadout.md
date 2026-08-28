# 2026-08-25 — First story-College Office before loadout

## Reported smell and parity question

- Reported production behavior: after Tutorial death, the web port opens the
  loadout/Create surface immediately. Stock first enters the College Office,
  exposes its dialogue, and opens loadout only when the player leaves.
- Publication finding: the earlier task commit was never on `origin/main`, so
  CI/CD could not deploy it. Its unpublished implementation is also wrong: it
  runs `Create -> automatic Office exit -> Courtyard`.
- Stock behavior to recover: the complete first story-Game admission from
  Tutorial terminal cleanup through interactive Office population, dialogue,
  physical exit, Create ownership, and Courtyard settlement.
- Falsifiers: Create owns a pre-Office step; Office entry forces southward
  movement; the initial spawn is `(512,924)`; the reveal uses `0.025`; the
  survival Archchancellor graph is selected; Polisher is absent; or the
  one-shot is profile rather than Game lifetime.

This is a secondary report in a system the 2026-08-24 pass claimed closed. That
pass stopped its causal trace at the region destination, did not drain Office
vtable slot `+0xC8`, treated held diagnostic input as native scripted input,
and did not sweep the story-mode fixed-region builder. The result inverted
Office/Create ownership and silently omitted every story-only Office member.
The previous implementation receipt is therefore superseded rather than
published.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| User clean-stock observation | current report, 2026-08-25 | Tutorial death is followed by an Office/College introduction and dialogue; loadout comes after leaving Office. | high-visible |
| Publication state | Website task commit `56398282`; current `origin/main 934b10ef` | The prior College commit is one unpublished task commit and cannot exist in production. | high |
| Retail artifact | `SolomonDark.exe` 0.72.5, preferred base `0x00400000`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` | Canonical image for the corrected trace. | high |
| Fresh read-only instructions | `GameOver::Tick 0x005CF4F0`; front-end dispatch `0x005A7F60`; story/survival selector writers `0x0058E8F6/0x0058F64A` | Tutorial completion clears/saves its profile gate and retains story mode 0; survival and editor paths explicitly write 1 and 2. | high |
| Fresh read-only instructions | `Game 0x005CC800`; finalizer `0x005CFA80`; `0x005CCE26`, `0x005D0141..0x005D0194` | `Game+0x87` starts zero; first story start selects Office 4, while survival or consumed story admission selects Courtyard 0. | high |
| Fresh read-only instructions | Office attach/tick/after-switch `0x005010C0/0x00509F10/0x00504AD0`; switch `0x005CDDD0` | Initial attach is `(512,562)` with `-0.01`; movement is free until physical exit contact; after covered switch the Office callback opens Create and consumes `Game+0x87`. | high |
| Fresh builder/content sweep | story builder `0x00513BE0`; `story.txt`; Office bundle 27 records; Polisher `0x0050B4F0/0x00505EB0/0x0051DD50` | Phase zero contains story Archchancellor and Polisher, their complete graphs, markers, art, Polisher animation, and wipe loop. | high |
| Exact audio data | `voices/ARCH_INTRO_0.wav`; `dynamic_sounds/wipeglass.wav` | Arch intro is the only shipped phase-zero voice; Polisher owns a distance-attenuated loop. | high |
| Reclassified prior diagnostic | `D:\codex-evidence\death-college-intro-20260824\native-onboarding` | The selected wizard at `(512,924)` was already at the exit and driven south; it is evidence for ordinary exit choreography, not initial story attach or automatic motion. | high-supporting |
| Current web branch | protocol 76/schema 12 candidate; `game-simulation.ts`, `hub-world.ts`, `MainMenuScene.tsx` | Durable eligibility exists, but Create precedes a 40-tick locked Office phase and all story dialogue/Polisher ownership is absent. | high |

Reusable corrected native facts are recorded first in Mod Loader
`native-session-flow.md`, `native-hub-npc-interactions.md`, and
`native-hub-npc-marker-catalog.json`.

## System boundary and membership inventory

Native system: first story-Game College admission, beginning when Tutorial
completion leaves the first normal Game eligible and ending when the first
selected wizard settles in the Courtyard.

| Member | Native source | Disposition / proof contract |
| --- | --- | --- |
| Tutorial terminal profile clear | `Game+0x1CD4`, `0x005CF4F0` | verified-already-at-parity; preserves College pending separately |
| omitted native Hall/title front-end | `0x005A7F60` | out-of-system by existing requested direct-continuation product policy; it may not reorder the subsequent Office/Create owners |
| story selector 0 after Tutorial | `DAT_00B3BEDC` writer sweep | exact-ported semantic mapping; no survival population |
| first-Game admission byte | `Game+0x87`, ctor/finalizer | exact-ported through durable pending projection |
| browser Tutorial `NO` first normal Game | browser-only offer, no stock skip | exact-ported mapping: Office still precedes the first Create |
| historical profile migration | schema 12 and older | exact-ported mapping: completed, never retroactive |
| initial Office attach | `0x005010C0` | exact-ported: `(512,562)`, alpha one, `-0.01`, 100 ticks |
| renderer-ready boundary | browser WebGL mount | exact-ported browser synchronization: authoritative alpha stays one until paintable, then native ticks begin |
| player movement/collision/camera | Office tick and Region base | verified-already-at-parity; input unlocks after reveal and remains live |
| pre-Create wizard presentation | unselected progression root `+0x82C=-1`, starter equipment | exact-ported presentation state: common wizard/equipment without selected-element effect |
| ordinary HUD/academy/footsteps | live Game/Region owners | verified-already-at-parity and instantiated during Office |
| story Archchancellor actor | type 5012, `(514,467)`, radius 55 | exact-ported story variant, body/desk and help-right marker 15 |
| `ARCH_INTRO_0` | `story.txt` | exact-ported all lines/emphasis and continuation |
| `ARCH_Q1_0/Q2_0/Q3_0` | `story.txt` | exact-ported all three choices/answers |
| `ARCH_DISMISS_0` | `story.txt` | exact-ported dismissal/close |
| Arch intro voice | `voices/ARCH_INTRO_0.wav` | exact-ported one-shot stream; no invented voice for silent rows |
| Polisher actor | type 5011, `(566,735)`, radius 15 | exact-ported actor and talk-left marker 14 |
| Polisher graph | `POLISHER_INTRO_0/Q1_0/Q2_0/DISMISS_0` | exact-ported every row |
| Polisher art/animation | Office 23..26; tick/render functions | exact-ported 4-frame phase, float draw, wrap, and 1-in-1500 reversal |
| Polisher wipe loop | `dynamic_sounds/wipeglass.wav` | exact-ported loop and 50..200 distance gain/teardown |
| Office props/flames/light/painter order | existing exact room composition | verified-already-at-parity; Polisher inserted at actor depth |
| ordinary Office exit contact | `0x00509F10` | verified-already-at-parity: inclusive segment `(412,924)..(612,924)` |
| post-contact scripted exit | `0x0063E4D0` | verified-already-at-parity: target `(512,2024)`, speed 1, input sealed only after contact |
| outgoing cover | `+0.01`, 100 ticks | verified-already-at-parity |
| covered `4 -> 0` switch | `0x005CDDD0` | verified-already-at-parity; no exposed swap |
| Office post-switch Create callback | vtable `+0xC8 -> 0x00504AD0` | exact-ported: loadout becomes visible only here |
| Create element/name/Discipline owners | existing Create system | verified-already-at-parity; first selection is not Tutorial Sirmin retention |
| Courtyard attach/motion/fade | `(952.5,67.5) -> (952.5,157.5)`, `-0.01` | verified-already-at-parity and resumed only after Create confirmation |
| completion/checkpoint | Courtyard settled edge | exact-ported: durable pending clears/revises once |
| disconnect/reload in Office or Create | browser persistence boundary | exact-ported mapping: replay from Office entry; never skip ahead |
| later same-Game/post-run Create | consumed `Game+0x87` | verified-already-at-parity: direct loadout/Courtyard, no Office replay |
| survival Office Arch graph | `ARCH_INTRO/ARCH_Q/ARCH_DISMISS` | out-of-system during admission; resumes on ordinary later Office visits |
| later story phase-one population | `Game+0x1CD8 == 1` | out-of-system: later story progression, not first admission |
| shared-Hub peers | browser authority projection | exact-ported isolation: one participant's Office/Create does not pause or relocate others |

No member is blocked by the browser platform.

## Native ownership thread

- Tutorial teardown owns eligibility input, but the new story `Game` owns the
  one-shot byte, Office Region owns entry/movement/exit, its phase-zero builder
  owns Archchancellor/Polisher, and Office post-switch `+0xC8` owns Create.
- `0x005010C0` positions the unselected actor at `(512,562)`; the 100-tick
  incoming fade is the only automatic entry program. Office tick does not
  synthesize movement.
- Chat uses the existing common scroll/choices/dismissal/range teardown. Story
  records are a state-selected graph, not replacements for survival rows.
- Exit contact alone begins the scripted south lane and outgoing cover. The
  covered region switch attaches Courtyard, then Office callback opens opaque
  Create and consumes the one-Game flag.
- Create confirmation finalizes the selected class and re-enters the existing
  Courtyard incoming choreography. Settlement is the portable completion edge.

## Recovered behavioral contract

- Fixed time: Office reveal 100 ticks at `0.01`; arbitrary interactive hold;
  exit cover 100 ticks at `0.01`; Courtyard reveal 100 ticks at `0.01`.
- Geometry: spawn `(512,562)`; Arch `(514,467)`; Polisher `(566,735)`;
  exit segment/target `(412,924)..(612,924) -> (512,2024)`; Courtyard
  `(952.5,67.5) -> (952.5,157.5)`.
- Input: player movement and NPC/modal actions work after the incoming cover;
  ordinary input seals only after exit contact and remains sealed through
  Create/Courtyard attach as appropriate.
- Render: complete Office and HUD beneath cover; both story actors participate
  in ordinary depth order; Create is opaque over the covered Courtyard; no
  automatic Office montage or duplicate renderer exists.
- Audio: academy and footsteps retain Region/player lifetime; Arch intro voice
  starts with that speech; Polisher wipe is actor-looped with exact distance
  gain and stops on actor/Office teardown.
- Authority: fixed ticks, participant position, transition, pending/completion,
  and Create confirmation are host-owned. Dialogue presentation remains local
  but cannot change the authoritative exit/loadout edge.

## Nearby-system findings

- The old `(512,924)` diagnostic is the exit line, explaining why its next
  frames looked automatic. It was a reproduction error, not a native constant.
- The first story Office reopens a subset deliberately excluded from the
  survival-NPC closure. Polisher and `_0` Arch rows must remain conditional;
  injecting them into every Office would break ordinary survival parity.
- Existing `collegeIntroPending` is still the right browser lifetime, but its
  state graph must be `Office -> Create -> Courtyard`, not a cinematic phase
  after Create.
- The admission request remains only a host-checked first-story intent, and
  `client-ready-college-intro` releases only the initial Office cover. Their
  former Create-first/automatic semantics and tests are replaced, not layered.

## Confidence and open questions

- Confirmed: production absence; mode and Game lifetime; exact owner/order;
  initial/exit/Courtyard geometry; all fade rates; free-input interval; both
  story actor rows, graphs, markers, art, animation, voice/loop audio; later
  bypass; and multiplayer/save boundaries.
- Inferred browser seam only: reloading an in-progress Office/Create replays
  the Office entry rather than serializing native transient Chat/cover state.
  This is the smallest faithful portable mapping and never skips visible stock
  behavior.
- Unknown: none material. The unselected native actor uses common starter
  equipment and no selected-element root; the browser carries a semantic
  placeholder config internally but suppresses its selected-element effect
  until Create commits the real pair.

## Web implementation consequence

- Protocol 78 owns the College transition/loadout messages after protocol 77's
  retained-party projection. Save schema 13 owns `collegeIntroPending` after
  schema 12's signed recovery claim; schemas 1 through 12 migrate completed.
- Replace the automatic `college-intro` transition with a host-owned
  first-admission run phase: renderer-ready 100-tick Office reveal, then normal
  controllable Office.
- Enter that phase after Tutorial Game Over and before the first normal Create;
  use the same path for browser Tutorial `NO`/fresh first Game.
- Add conditional story Office population and dialogue selection without
  changing the normal survival catalog. Add exact Polisher/marker assets,
  animation, wipe loop, and Arch intro stream.
- Let the existing Office portal start the outgoing transition. At covered
  `4 -> 0`, switch the run to loadout/Create; do not complete the Courtyard
  incoming ticks behind the opaque picker.
- On selection, replace the placeholder config, resume the existing Courtyard
  incoming transition, and clear pending only after settlement.
- Remove the obsolete Create-first meaning, 40-tick lock, forced `0.890625`
  admission lane, and tests/browser receipts built around them. Keep the
  admission intent strict, plus schema-12 migration and participant-local
  durability.

## Validation contract

- Focused authority tests: Tutorial preservation/entry; browser-`NO` entry;
  schema-12 migration; Office spawn and alpha ticks `0/1/99/100`; free input;
  Arch/Polisher range/actions; exit contact and post-contact input seal;
  covered loadout boundary; selection; Courtyard settle/one-shot checkpoint;
  reload replay; later-run bypass; shared-Hub isolation.
- Content/presentation tests: every story graph row and exact text; Office
  records `14,15,23..26`; Polisher phase/reversal/gain; exact WAV hashes;
  story-only conditional membership; normal survival Office unchanged.
- Mac browser journey: complete real Tutorial terminal flow; observe Office
  before any Create DOM; talk through Arch intro plus all three questions and
  dismissal; open Polisher and both questions; verify movement; cross the
  physical exit; then observe Create, choose a non-retained pair, and settle
  Courtyard. Repeat a later death to prove no Office replay.
- Require WebGL/Metal at `1600 x 900`, Office/Chat/Create/Courtyard captures,
  transition history, voice/wipe playback events and gain samples, empty
  page/console/failed-response/wire/runtime-error arrays, and the complete
  `/opt/homebrew/bin/bash ./scripts/validate.sh` gate on the exact candidate.

## Implementation validation receipt

- Exact rebased Website candidate `d00faad7c8eae93cdddeef0ac931f32ac2f6c34b`
  (tree `637726eeaab4be9cd6f2213293d74e128b6d22e4`, base `4688e31b`) passed
  `/opt/homebrew/bin/bash ./scripts/validate.sh` on the Mac mini. The production
  game entry is `473,187` raw / `132,699` gzip bytes within its
  `524,288` / `133,120` limits; media policy passed. Gate-log SHA-256 is
  `0b4122bf07507fa615a8f3bb9a8093367f4812f096904982bc6af7213f8f4b26`.
- Exact Mod Loader candidate `0e3dd4ce4b5c7776fa96d9b589873ae964cd8ac2`
  (tree `a15e08bf113dee9d6fb5474d1fe182f6fefe5572`, base `35d0941d`) passed the
  complete registered Mac static RE suite `502/502`; log SHA-256 is
  `a77caa5631efaf25cc45edc74af5193e6700b6534d450c1bf5ae0a77ad45e2ba`.
- Chrome `151.0.7922.174` at `1600 x 900` reported WebGL2 through
  `ANGLE Metal Renderer: Apple M2`. The full journey observed Office
  `college-intro` alpha `0.95` before Create, traversed all Arch and Polisher
  questions/dismissals, physically crossed the Office exit, observed the
  covered `college-loadout` boundary with Back disabled, selected
  Fire/Arcane as `SolonSolus`, and observed Courtyard `incoming` then settle.
  It recorded exact Arch voice playback, Polisher loop start gain
  `0.12512069940567017`, and loop stop. All page/console arrays were empty;
  browser-log SHA-256 is
  `2423a8d7928fe2bc72a8dd2d2678a166073a29eee595a54692e53e896c3f5157`.
- A separate authoritative saved-Tutorial terminal-tick Chrome journey entered
  the story Office at `(512,562)` with intermediate alpha
  `0.6282999999821183` and no Create DOM. All four responsive scenarios had
  empty console/page/failed-response arrays; log SHA-256 is
  `bddc8d82a99bd11b7bc21177801cfe60927a181fdc8b52a87a9ac8f929bf1f25`.
  Later-death bypass remains pinned by the complete authority gate.
- Reviewed Office screenshots are SHA-256
  `ed4e4d4c8ea3c91078f969610487ee449b0c9e035f9228cc9079c49137082b15`
  (full dialogue journey) and
  `b8726bc65eb2bb5d718c14ff05dcf9a3602dff47ef3b5c48445abfb174a9a331`
  (Tutorial terminal handoff). Evidence remains under
  `/Users/jarrett/codex-acceptance/death-college-intro-20260825-current-a7c2404d/`.
- Publication, CI observation, and production recurrence verification remain
  pending and are distinct from these exact-tree acceptance receipts.
