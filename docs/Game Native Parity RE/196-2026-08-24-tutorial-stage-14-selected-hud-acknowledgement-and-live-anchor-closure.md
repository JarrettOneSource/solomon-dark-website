# 2026-08-24 — Tutorial stage-14 selected-HUD acknowledgement and live-anchor closure

## Reported smell and parity question

- Reported web behavior: the stage-14 `click these icons to change ...`
  teaching copy does not line up with the selected-skill HUD control. Clicking
  the indicated control opens its selector but does not update the Tutorial,
  leaving the lesson visibly stuck.
- This is a secondary report against the Tutorial system closed on 2026-08-23.
  That pass claimed stage-14 primary/concentration callouts and every UI target
  arrow were exact, but it stopped its HUD action sweep before the two writes
  outside the Tutorial class, used guessed fixed overlay coordinates, and
  browser-proved only stage 0. Those skipped members caused this repeat report.
- Stock behavior to recover: the primary or concentration-A HUD click sets one
  Tutorial-owned acknowledgement byte before opening the compact selector.
  That byte suppresses the complete stage-14 teaching presentation without
  advancing stage 14; clearing wave 4 remains the stage completion predicate.
  The pointer and two text lines are derived from the live primary/A rectangles.
- Falsifiers: the model is wrong if selection acceptance rather than opening is
  required; if concentration B writes the byte; if a click advances stage 14;
  if the pointer/text use fixed viewport coordinates; or if the compact-selector
  pause remains after modal close.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| User/browser report | 2026-08-24 issue 6 | The indicated HUD target and teaching presentation disagree, and the presentation survives the click. | high |
| Untouched web base | Website `4a81a616`; `TutorialOverlay.tsx`, `MainMenuScene.tsx`, `GameHud.tsx`, `native-tutorial.ts` | Stage 14 always renders one viewport-fixed pointer `(800,70)->(800,25)` and one centered multiline block. The selector opener sends no Tutorial action, and Tutorial state has no native `+0xAC` analogue. | high |
| Retail executable | `SolomonDark.exe` 0.72.5, preferred base `0x00400000`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` | Exact selected-HUD acknowledgement, live geometry, compact-selector siblings, and stage transition owner. | high |
| Fresh canonical Ghidra replica | `decompile_targets.py` at `0x005D8120`, `0x005D08C0`, `0x005D50E0`, `0x00657A70`, `0x0066F0B0`, `0x0065F9A0`; raw instructions around `0x0065FA40/0x0065FB80/0x0065FE50`; `find_writes_to_offset.py 0xAC`; `dump_floats_at.py` on five render constants | Primary write `0x005D8281`, A write `0x005D8358`, reset `0x005D6016`, render read `0x005D1D29`; no B write; exact rectangle-derived pointer/text math; refresh auto-fills empty A/B and an invalid selected primary. | high |
| Existing selected-HUD RE | `Mod Loader/docs/reverse-engineering/native-skill-screen-and-quickbar.md` | Buttons 12/16/20, `40x65` hit rectangles, primary/A/B layouts, modal options, action sounds, and teardown are already closed. | high |
| Corrected native report | `Mod Loader/docs/re/tutorial-mechanics.md`, 2026-08-24 correction | Replaces the prior false “no writer” statement and records the complete input/render/lifetime thread. | high |

## System boundary and membership inventory

Native system: the selected-skill HUD teaching subgraph of the stock Tutorial,
from access-gated HUD action dispatch through acknowledgement state, stage-14
render suppression/live layout, compact-selector lifetime, authoritative
browser transport, save/resume, and wave-owned stage completion.

| Member | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| acknowledgement reset | `Tutorial::Activate 0x005D5FE0`, store `0x005D6016` | exact-ported | false on construction/new Tutorial only |
| primary HUD action | binding 12 / `Game+0x3AC`, store `0x005D8281` | exact-ported | acknowledgement occurs before selector result and Plane Orb guard |
| concentration-A HUD action | binding 16 / `Game+0x46C`, store `0x005D8358` | exact-ported | same open-edge acknowledgement |
| concentration-B HUD action | binding 20 / `Game+0x52C` | out-of-system for Tutorial acknowledgement; selector verified-already-at-parity | no native `+0xAC` write and no valid stock Tutorial Split Mind member |
| click before stage 14 | same two Game branches while any Tutorial object exists | exact-ported | acknowledgement is accepted after selected-spell access opens and survives into stage 14 |
| selector acceptance | compact selector `0x0066F0B0 -> 0x004281F0` | verified-already-at-parity; acknowledgement exact-ported | choosing a row is not required to suppress teaching copy |
| selector outside-click/cancel | compact selector pointer miss returns `-1` | verified-already-at-parity; acknowledgement exact-ported | cancel still leaves acknowledgement true |
| selector audio | primary/A open click; A accept click + concentrate | verified-already-at-parity | no new cue or replay |
| selector gameplay pause | compact modal loop; Website `skill-selector` pause source | verified-already-at-parity; late-stage lifecycle exact-ported | owner pause appears while open and clears after close |
| stage-14 render gate | `Tutorial::Render 0x005D1D29` reads `+0xAC` | exact-ported | false renders all three presentation members; true renders none |
| pointer | `0x005D1D36..0x005D1DE9`, `0x005C9BB0` | exact-ported | origin midpoint of live primary/A centers; target primary center plus `(30,50)` |
| first text line | `0x005D1DEE..0x005D1E48` | exact-ported | exact literal with center/baseline at primary center plus `(-220,50)` |
| second text line | `0x005D1E4D..0x005D1EAA` | exact-ported | exact literal with center/baseline at primary center plus `(-220,70)` |
| automatic concentration A after the forced level-up | `ActorProgressionRefresh 0x0065FA2D..0x0065FBA4` | exact-ported | newly learned forced row 65, 67, or 60 becomes A before stage 13/14 |
| automatic concentration B with Split Mind | `0x0065FBA7..0x0065FD36` | exact-ported shared behavior; out-of-system as a stock Tutorial loadout member | symmetric candidate/exclusion rule remains covered without inventing Tutorial Split Mind |
| invalid selected-primary replacement | `0x0065FD43..0x0065FE75` | exact-ported shared refresh sibling; verified-already-valid in Tutorial | preserve temporary Plane Orb 80; otherwise choose uniformly from learned category-1 rows after A/B |
| replaced-primary cast lane | primary selection consumer | exact-ported shared behavior; unchanged in valid Tutorial | cancel held/channel/target state and publish the replacement row consistently |
| Tutorial primary-plus-A layout | `0x005D50E0`; centers `(780,25.5)/(820,25.5)` | exact-ported | pointer `(800,25.5)->(810,75.5)` and line origins `(560,75.5)/(560,95.5)` |
| HUD hide/vertical offset | `0x005C7200` moves both controls | exact-ported | teaching geometry consumes the same live offset; no detached fixed overlay |
| stage-14 completion | `Tutorial::Tick 0x005D6330`; enemy count zero | verified-already-at-parity | HUD acknowledgement never changes stage; wave clear alone enters 16/starts wave 5 |
| authoritative input | retail local Game owner; browser singleton Tutorial host | exact-ported | client can report only bounded primary/A open actions, never set stage/state directly |
| full/delta snapshot | protocol 72 Tutorial state | exact-ported | acknowledgement reaches presentation monotonically |
| schema-8 continuation | Tutorial save owner | exact-ported | acknowledged and unacknowledged states resume without replay/reset |
| tutorial teardown/restart | controller removal/new activation | exact-ported | no acknowledgement leaks to another run or ordinary Boneyard |
| touch/pointer activation | browser semantic binding-12/A buttons | exact-ported browser input projection | same authoritative action and live logical geometry |

There are no browser-platform-blocked members. Every stock operation is a
boolean transition or existing 1600-by-900 UI rectangle operation directly
representable by the web runtime.

## Native ownership thread

- Tutorial activation owns the false acknowledgement state. The selected HUD
  remains Game-owned. When Game dispatches binding 12 or 16 and a Tutorial
  exists, it writes the Tutorial byte before allocating/running the modal.
- The compact selector owns only local modal input, option selection, sound,
  and teardown. It neither owns nor conditionally commits the Tutorial byte.
  An outside click and a successful choice have the same teaching consequence.
- Tutorial render owns the one read. At stage 14 and acknowledgement false it
  reads the live primary/A rectangles, draws one stock arrow, and draws two
  separate unframed menu-font lines. A true byte skips that complete block.
- Progression refresh owns the missing A control before that render. When the
  forced level-up teaches one category-3 row, native refresh validates A,
  enumerates learned category-3 candidates excluding B, and chooses through
  the active gameplay RNG. The Tutorial has exactly one candidate, so the new
  row deterministically occupies A and produces the primary-plus-A HUD.
- Tutorial tick never reads the acknowledgement. Its dialogue threshold and
  wave-4 enemy-zero edge remain independent. The browser host must therefore
  store acknowledgement without inventing a stage transition.
- Browser save/protocol state carries the byte because a page refresh between
  an early HUD click and stage 14, or during stage 14, must not replay the
  one-shot teaching presentation.

## Recovered behavioral contract

- Eligible actions are exactly primary/binding 12 and concentration A/binding
  16. Binding 20 is not an acknowledgement sibling.
- The transition occurs on selector open, before Plane Orb/modal/result
  branches. It is idempotent and remains true for the controller lifetime.
- Let primary and A rectangle centers be `P=(Px,Py)` and `A=(Ax,Ay)`. Pointer
  origin is `(P+A)/2`; pointer target is `P+(30,50)`; line centers/baselines are
  `P+(-220,50)` and `P+(-220,70)`.
- Instruction-read constants are doubles `0.5` (`0x007DE808`), `30`
  (`0x00784D50`), `50` (`0x007847C8`), `220` (`0x0079B860`), and `70`
  (`0x00787C40`). The pointer uses the shared record-28 rotation helper; both
  lines retain the existing exact group-3 gold/shadow renderer.
- A valid Tutorial stage 14 has the primary-plus-A selected cluster. The
  resulting stock logical coordinates are exact, not CSS tuning values.
- Shared concentration auto-fill uses the active gameplay RNG only when a lane
  needs a replacement: A candidates exclude B; Split Mind B candidates exclude
  A; an empty set leaves `-1`. The Tutorial's singleton candidate consumes the
  native draw but has no random visible result.
- The same refresh validates selected primary after A/B. Temporary Plane Orb 80
  is retained; an invalid ordinary primary consumes the next RNG word and is
  replaced from learned category-1 rows in ascending ID order. Tutorial Magic
  Missile 8 is valid and consumes no primary-replacement draw.
- The selector pauses gameplay only for its modal lifetime. A retained
  `skill-selector` pause after close is a separate failure and is not fixed by
  advancing Tutorial stage.

## Nearby-system findings

- The native Tutorial report already contained both missing writes in its raw
  `0x005D8120` decompile while its prose claimed there was no writer. The
  corrected report now makes the xref omission explicit so later ports do not
  repeat it.
- The selected-HUD layout report had already closed the exact button rectangles
  and all primary/A/B arrangements. The Tutorial port nevertheless copied a
  guessed viewport point instead of consuming that owner. The shared HUD
  geometry is the correct web seam.
- The original browser acceptance stopped at stage 0. Canonical validation and
  early-scene screenshots could not prove a stage-14 action/render lifecycle.
  Late-stage fixture acceptance is now a required Tutorial regression.

## Confidence and open questions

- Confirmed: both writers and their ordering, B non-membership, reset/read,
  lifetime, all geometry/constants, exact literals, modal result independence,
  stage completion, HUD layouts, and browser omission.
- Inferred only where browser ownership differs: two bounded semantic actions
  are the safe projection of native pointer identity into the solo host.
- No material native unknown remains. Built-browser acceptance falsified the
  pause-stuck hypothesis: both compact-selector paths release the replicated
  pause and retain stage 14 after close.

## Web implementation consequence

- Add one immutable Tutorial acknowledgement field initialized by the Tutorial
  kernel and carried by strict protocol/save decoders.
- Restore the shared progression-refresh selection auto-fill rule so the forced
  category-3 Tutorial choice occupies concentration A before stage 13/14. Use
  the authoritative simulation RNG and the same candidate/exclusion order;
  retain the primary sibling and A/B/primary draw order; do not special-case
  one Tutorial skill id or fabricate an icon client-side.
- Extend the bounded Tutorial surface-action union with primary and
  concentration-A selector-open actions. Emit the matching action from the
  shared selector opener only after the same local eligibility gates that open
  the real modal; do not expose an arbitrary boolean or stage setter.
- Derive stage-14 pointer and separate line geometry from the shared selected-
  HUD binding layout. Remove the hardcoded pointer and viewport-centered
  multiline approximation.
- Render the complete stage-14 block only while acknowledgement is false. Do
  not advance the stage on click and do not add a timeout or compatibility path.

## Validation contract

- On untouched `4a81a616`, a focused kernel/UI contract must reproduce that a
  binding-12/A selector open cannot mutate Tutorial state, the stage-14 block
  remains visible, and its hardcoded pointer differs from the live two-icon
  layout.
- After the fix, cover primary and A independently, pre-stage-14 persistence,
  cancel and accept equivalence, idempotence, B non-membership, stage staying
  14, enemy-zero transition staying 16, all 14 category-3 and six category-1
  auto-fill candidates, A/B exclusion, empty-set and RNG-order behavior, exact
  geometry, protocol full/delta, and schema-8 save/resume for both boolean
  values.
- Run `/opt/homebrew/bin/bash ./scripts/validate.sh` on a byte-identical Mac
  candidate.
- In built Mac Chrome/WebGL, resume a task-owned schema-8 Tutorial fixture at
  stage 14 with the real primary-plus-A HUD. Capture pre-click DOM/pixels and
  exact arrow/button bounds; click primary, cancel/close, prove the complete
  teaching block disappears while stage remains 14 and the replicated pause
  returns to null. Repeat from a fresh fixture for concentration A and accept a
  different learned skill. Require empty page, console, failed-response, wire,
  and host-error arrays.

## Implementation validation receipt

- The test-first Mac loop reproduced the omitted contract on untouched Website
  base `4a81a616`: the focused selected-HUD/concentration test file failed
  because no automatic selection owner existed, while the other `248/249`
  tests in that group passed. The original web source also had one fixed
  `(800,70)->(800,25)` stage-14 pointer and no Tutorial action on either HUD
  selector open.
- Protocol 72 now carries one host-owned
  `selectedSkillHudAcknowledged` boolean and two bounded semantic open actions.
  The Tutorial kernel accepts primary/binding 12 and concentration A/binding
  16 only after the stock selected-spell gate opens, persists the idempotent
  acknowledgement through schema-8 saves/full/delta frames, and never changes
  stage. Binding 20 remains outside the Tutorial acknowledgement membership.
- Shared progression refresh now auto-fills empty/invalid concentration A,
  optional Split Mind B, and invalid selected primary in the native A/B/primary
  RNG order. Coverage enumerates all fourteen category-3 rows, both slot
  exclusions, empty candidates, all learned category-1 replacement members,
  Plane Orb retention, and cast-lane reset. The forced Tutorial offer therefore
  produces its real A icon instead of a primary-only malformed HUD.
- Stage-14 presentation consumes the same selected-HUD binding layout that
  paints and hits the live buttons. For the Tutorial primary-plus-A cluster,
  tests and browser DOM agree on primary/A centers `(780,25.5)/(820,25.5)`,
  pointer `(800,25.5)->(810,75.5)`, and text centers/baselines
  `(560,75.5)/(560,95.5)`. Acknowledgement removes the pointer and both lines
  as one block. The incoming amulet-parity and audible-level-up changes at
  Website `918d66fb`/`b06129dc` and Mod Loader `09aa327a`/`1346f942` were
  rebased underneath this work; their live Boneyard-owned stage-10/13
  callouts, exact amulet FX/ItemInfo paths, and audible picker policy remain
  intact.
- The manifest-identical rebased Mod Loader candidate passed all `499/499`
  CI-safe static RE contracts on the Mac.
- The manifest-identical rebased Website candidate passed
  `/opt/homebrew/bin/bash ./scripts/validate.sh`: backend build and contracts;
  formatting/lint/import boundaries; every frontend and desktop test group;
  production frontend/GameHost builds; media policy; and bundle budget.
- Built-production Mac Chrome `151.0.7922.170` resumed two independent
  schema-8 stage-15 fixtures, naturally materialized wave 4, and reached live
  stage 14 with the exact two-icon HUD. The primary path opened binding 12,
  removed the full lesson, acquired/released the `skill-selector` pause,
  cancelled outside the option strip, retained concentration A `65`, and
  remained at stage 14. The independent concentration-A path did the same for
  binding 16, accepted learned row `67`, retained it in A, and remained at
  stage 14. Both receipts reported exact pointer geometry and empty page,
  console, failed-response, WebSocket, and structured host-error arrays.
- The four 1600x900 before/after captures were visually inspected from the
  task-owned final browser receipt. The browser harness was task-only
  acceptance scaffolding and is absent from the final diff. No member is
  browser-blocked; no material unknown remains. Publication is a separate
  repository operation; deployment remains outside this receipt.
