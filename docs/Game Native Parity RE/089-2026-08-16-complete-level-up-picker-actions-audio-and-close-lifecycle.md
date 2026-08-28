# 2026-08-16 — Complete level-up picker actions, audio, and close lifecycle

This entry supersedes the older claims that stock has no reroll, that picker
hover/focus plays `pickskill`, and that card activation uses the generic click.
It keeps the 2026-08-15 PlayerActor threshold effect, reveal, pause, and modal
visibility findings unchanged. Evidence is read-only analysis of the same
retail Beta 0.72.5 `SolomonDark.exe`, preferred base `0x00400000`, size
`4,723,200`, SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`.
The durable native report is Mod Loader `docs/skill-picker-re.md`.

## Boundary and discovery passes

The system boundary is the complete local `LevelupScreen` lifecycle plus the
authoritative progression state it consumes: screen create, initial build,
reveal gate, card/side-control hit testing, offer rebuild, close, queued-choice
handoff, and final teardown. PlayerActor threshold sound/sparkles/light remain
an adjacent producer and are not moved into the screen.

The causal pass followed the reported hover sound from React through the
screen's active-`UiRect` query and every audio dispatch in ctor `0x00658620`,
create `0x0065F480`, tick/build `0x0066F920`, apply `0x00671470`, and render
`0x0067DF80`. The membership pass then swept all five card rectangles, both
special rectangles, the queued rebuild, normal/forced entry, three/four-card
layouts, and the compiled audio registry. That second pass exposed the missed
Sorceror's Charm state branches and falsified the old no-reroll conclusion.

## Recovered state and action chain

- Hagatha ownership is the durable byte span `progression + 0x7CC + selector`.
  Selector 17 `SORCEROR'S CHARM` is therefore byte `+0x7DD`.
- Pending choices are count `+0x44`; deferred choices are count `+0x48`.
  Screen create adds deferred into pending and clears deferred. Constructor
  byte `+0x838` marks the local screen active.
- Normal create clears current-offer byte `+0x839`, then sets it when the charm
  is owned. A queued-choice rebuild grants it again. Card activation, reroll,
  or save consumes it, so one offer cannot take two charm actions.
- Changing active card/side-control `UiRect` is silent. Browser pointer,
  keyboard, and gamepad focus are presentation-only equivalents and must also
  be silent.
- Card activation at `0x00671635` plays entry 1 `sounds\pickskill` at gain 1,
  applies the exact displayed option, decrements pending, and starts close at
  direction `-0.75`.
- ROLL AGAIN (`screen + 0x540`) writes
  `active_gameplay_rng.Integer(1_000_000)` to actor-private offer seed
  `+0x834`, clears `+0x839`, plays entry 93 `sounds\summon` at gain 1 and
  pitch `0.8` (`0x00671532`), and rebuilds after two ticks without consuming a
  pending choice.
- SAVE SKILL (`screen + 0x48C`) plays entry 0 `sounds\click`
  (`0x00671568`), moves one count from pending `+0x44` to deferred `+0x48`,
  clears `+0x838/+0x839`, and starts close at direction `-1`. If no other
  pending choice remains, normal play resumes; the saved choice returns only
  when a later level transition creates a picker.
- Initial build completion plays entry 64 `sounds\openpanel` at gain/pitch 1
  (`0x0066FAA4`). Starting a close from settled alpha plays the same entry at
  gain 1 and pitch `0.75` (`0x00670D35`). When close reaches zero and pending
  choices remain, `0x00670C9D..0x00670CC4` restores reveal alpha/direction to
  `1`, arms the 10-tick build delay, and sets hidden-content byte `+0x604`.
  Entry 102 `sounds\unlockskill` plays immediately (`0x00670CD3`); render
  `0x0067EAC1` withholds the offer/control content until the builder clears
  `+0x604` at `0x0066FCE4` 100 ms later. This is neither a second 40-tick
  reveal nor an immediate swap. It does not replay the PlayerActor level
  sound/VFX. Entry 53 `sounds\levelupskill` remains loaded and undispatched.

One large XP grant leaves progression at its final crossed level before the
first builder call. All queued choices therefore roll and label against that
current final level; stock does not replay intermediate level numbers as offer
inputs. Deferred count is likewise merged into the next transition at its then
current level.

## Authored side-control geometry

For `n` choices, native `panelWidth = n * 200 + 60`. Both special hit boxes are
255 by 100 at y `322.5`. SAVE SKILL begins at
`800 - panelWidth / 2 - 140`; ROLL AGAIN begins at
`800 + panelWidth / 2 + 40`. Render draws exact UI record 57 in the left
rectangle and record 56 in the right rectangle. The existing full UI atlas is
authoritative; extraction must add those record descriptors rather than draw
replacement labels or dice in CSS.

## Complete membership and dispositions

| Member | Stock behavior | Website disposition |
| --- | --- | --- |
| Ordinary threshold | one PlayerActor level sound and 180-tick sparkle/light; screen opens once | retain barrier-keyed effect; add one initial `openpanel` request |
| Pointer/focus movement | active rectangle changes, no sound | semantic focus remains silent |
| Card activation | `pickskill`, apply displayed option, close `-0.75`, pitched close-panel cue | host-validated select request; local presentation emits only those two lifecycle cues |
| Queued choice | close to zero, restore the full curtain with content hidden, `unlockskill`, ten-tick rebuild, then expose the settled next offer; no threshold replay | hold the next snapshot offer through close and the 100 ms hidden-content rebuild, then expose it settled |
| Final choice | same close, then screen teardown | retain the modal through its close before exposing held dynamic world state |
| Sorceror ROLL AGAIN | one gameplay-stream seed draw, `summon` pitch 0.8, two-tick rebuild with the old offer still drawn | host draws from `playerOfferRng`, retains the old offer for 20 ms, rebuilds the same pending choice, and consumes availability |
| Sorceror SAVE SKILL | click, pending to deferred, close; later screen merges deferred | host stores deferred count, resolves the current barrier participant, restores the choice on a later threshold |
| No selector 17 | special controls not rendered or hittable | no protocol action is accepted and no side semantic button exists |
| Three/four cards | identical action family; Creativity row 63 selects count | geometry/actions cover both exact layouts |
| Forced picker `0x0067C320` | picker lifecycle without threshold PlayerActor effect | same screen cues/actions when a producer exists; never synthesize level VFX |
| Shared barrier | each participant owns private offer/charm state | host validates owner, offer sequence, action availability, and barrier membership |
| Modal world | non-player tick hold; browser hides transient clutter | keep the landed visibility policy through open, settled, and close phases |
| `levelupskill` entry 53 | registry member only, no dispatch | extracted only if another proven consumer appears; never substitute it |

## Implementation and proof contract

Progression owns current-offer charm availability and deferred-choice count.
The host alone draws a reroll seed, mutates pending/deferred state, and advances
the barrier; the client sends typed reroll/defer requests and cannot fabricate
availability. Protocol snapshots expose enough state to render the exact
controls and reconcile a response. The Pixi renderer owns records 56/57 and
the close/rebuild presentation; transparent React buttons supply accessible
hit regions and silent designed focus.

Regression coverage must fail on hover/focus audio, click-on-card, local RNG,
second rerolls, action without selector 17, wrong/stale offer sequence,
intermediate-level queued rolls, deferred choices reopening immediately,
missing 56/57 records, wrong side geometry, threshold replay, missing
open/close/queued cues, or premature world visibility. Browser acceptance must
exercise keyboard and pointer focus silently, select a card with `pickskill`,
observe the pitched close and queued rebuild, buy/own selector 17, reroll once,
reject a second reroll, save a choice, resume play, and recover that choice on
the next threshold with no page, console, network, or media error.

Confidence is high for state offsets, ownership mapping, branches, call sites,
sound members/parameters, settled hit boxes, and records 56/57. The browser's
designed keyboard/gamepad traversal remains a declared accessibility policy;
stock retail supplies pointer `UiRect` activation rather than a captured
keyboard focus graph.
