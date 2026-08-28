# 2026-08-27 — Tutorial movement completion, moving Staff admission, and College-card timing

## Reported smell and parity question

- Reported web behavior: the opening movement instruction can disappear before
  the player completes movement; automatic Staff melee can begin while the
  player is merely standing beside a facing enemy; and the post-Tutorial
  `RAPTISOFT GAMES PRESENTS` / `SOLOMON DARK` cards need their scene and timing
  checked against retail.
- Reopened systems: the browser movement-copy acknowledgement, the complete
  PlayerWizard movement-to-Staff bridge, and the College admission title
  timeline. The earlier Staff closure proved two contact sources but omitted
  their shared outer movement gate. The earlier opening-guidance pass recorded
  a raw input level rather than the authoritative admitted movement epoch. The
  College implementation is re-audited as a complete sibling timeline rather
  than retimed by eye.
- Reproduction: natural idle Tutorial prelude and stage 0, desktop/mobile user
  movement, sealed input and forced intro movement, generated Boneyard and
  Tutorial lesson 11 with equipped Staff, stationary/approaching/departing
  enemies, Tutorial terminal Game Over, black handoff, Courtyard cards, Office
  entry, save/restore, and ordinary non-Tutorial Hub entry.
- Falsifiers: stock reaches Staff admission outside the strict movement branch;
  its fallback is a free-standing idle proximity query; a raw input component
  is equivalent to an admitted movement epoch; either title is rendered in the
  opening Boneyard; a wall clock or dialogue switches the title; or current web
  card state diverges from the recovered six-point spline.
## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | unmodified Beta 0.72.5 `SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Same sealed retail program as the Tutorial, movement, Staff, and College reports. | high |
| Fresh instructions | canonical Ghidra 12.0.3 read-only replica; `PlayerActor::Tick 0x00548B00`; raw windows `0x0054AD54..0x0054AD7B`, `0x0054AFF1..0x0054B336`; `PlayerActor_MoveStep 0x00525800`; Staff dispatcher `0x00537AA0` | The strict float `velocitySquared > 0.01` branch encloses capture, MoveStep, hostile result admission, and the GoodGuy-list fallback. Failure jumps to `0x0054B662`, past both action paths. Stationary proximity cannot start Staff melee. | high |
| Existing instruction/data closure | `Tutorial::Tick 0x005D6330`, `Tutorial::Render 0x005D08C0`; Courtyard `0x00506490/0x0050C970/0x0051EB60`; six-point title spline; Title records 7/9 | Retail stage 0 owns no acknowledgement field. College title cursor starts at zero, adds exact double `0.005200000014156103` at 100 Hz, selects record 7 through cursor 4 and record 9 afterward, and never uses a timeout. | high |
| Clean stock observation | `/mnt/d/codex-evidence/tutorial-college-student-20260826/native-title-walk-probe.mp4`, SHA-256 `fb4f8863456261facdfe1189ff78b337f17e1a8996059485a8cc2fb9efd8d589`; sampled retail frames 9.5..11.9 s | The capture orders Tutorial terminal world -> black handoff -> covered Courtyard title walk. Record 7 remains live in every named sample; neither College card appears in the opening Boneyard or ordinary title menu. | high-visible |
| Current web causal trace | exact Website base `6d3a1d7738ee425ee5876e9e1087afddc940ad0d`; `native-tutorial.ts`, `game-simulation.ts`, `player-character.ts`, `boneyard-world.ts`, `player-staff-combat-system.ts`, `native-college-intro.ts`, `hub-world.ts`, `hub-presentation-timeline.ts`, `CollegeIntroOverlay.tsx` | Movement copy consumes raw nonzero input before the movement planner. Staff receives collision identities but not the enclosing movement-epoch fact, so an empty list falls back to proximity even while idle. College authority already carries the recovered spline/step/card/cover model, but tests and browser smoke do not pin its complete tick timeline. | high |

## System boundary and membership inventory

System A: **Tutorial opening movement-copy completion**, from authenticated
player input through the native movement planner, authoritative acknowledgement,
presentation, replication, save/resume, and teardown.

| Member / branch | Native/current source | Disposition | Proof contract |
| --- | --- | --- | --- |
| 475-tick intro and forced northward lane | Tutorial `+0x8C..+0x9C` | `verified-already-at-parity` | no acknowledgement without authenticated user movement |
| strict movement epoch | PlayerActor `0x0054AD54..0x0054AD7B`; shared web movement plan | `exact-ported` by this correction | raw input alone is insufficient; the admitted plan is authoritative |
| desktop movement copy and configured bindings | stock stage 0 plus web binding resolver | `verified-already-at-parity` after corrected lifetime | copy persists idle, then hides on the admitted user epoch |
| mobile left-joystick copy | explicit browser accessibility branch | `out-of-system` (retail has no touch device) | same authoritative hide edge as desktop |
| stock stage-0 distance and narration | `Tutorial::Tick 0x005D6330` | `verified-already-at-parity` | acknowledgement changes neither stage nor Dig/narration state |
| forced velocity without user input | native Tutorial owner | `exact-ported` negative branch | cannot acknowledge the browser copy |
| sealed/held input | action, modal, and Tutorial movement owners | `exact-ported` negative branch | cannot acknowledge before an admitted epoch |
| protocol 84 projection | strict Tutorial snapshot | `verified-already-at-parity`, semantics corrected | boolean remains exact and malformed values fail closed |
| save schema 16 and legacy migration | continuation owner | `verified-already-at-parity`, semantics corrected | false/true round trip; old absent field remains false |
| stage exit, Game Over, disconnect, replacement | Tutorial lifecycle | `verified-already-at-parity` | no standalone listener or page-local acknowledgement survives |

System B: **automatic PlayerWizard Staff admission**, from the strict movement
epoch through ordered contact sources, action/proc construction, marker contact,
authority, presentation, and teardown.

| Member / branch | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| below/equal `0.01` movement lane | `0x0054AD70..0x0054AD7B -> 0x0054B662` | `exact-ported` | stationary wizard creates no action, RNG, VFX, or audio |
| moving root collision-result capture | Region `+0x47C/+0x480/+0x484/+0x488` | `verified-already-at-parity` plus epoch propagation | identities retain solver order only inside a movement epoch |
| flags-`0x2` hostile result | `0x0054B0AB..0x0054B0B5` | `verified-already-at-parity` | moving collision admits without facing or attack input |
| nonhostile nonempty result | same loop | `verified-already-at-parity` | suppresses fallback for that movement epoch |
| zero-result GoodGuy current-contact fallback | `+0x13C/+0x144/+0x150`, `0x0054B28D..0x0054B32F` | `exact-ported` by this correction | reachable only while movement epoch is active; strict heading delta `<50` remains |
| stationary facing proximity | outer movement branch | `exact-ported` negative branch | never admits or repeats Staff action |
| Skeleton, Archer, Mage, Imp, Zombie, Wraith, Demon | flags-`0x2` family | `verified-already-at-parity` after shared gate | every family uses the same moving-only owner |
| hostile Coffin Maggot | GoodGuy/contact family | `verified-already-at-parity` after shared gate | moving contact admits; stationary adjacency does not |
| Coffin, other player, NPC interaction | nonhostile/contact siblings | `out-of-system` (not Staff targets) | movement identities remain non-attacking and preserve ordering |
| Staff/Wand/empty weapon | dispatcher item-type gate | `verified-already-at-parity` | only exact Staff `0x1B5C` constructs action |
| melee/spin outcomes, marker damage, Ether/Pike, knockback, VFX/audio | existing Staff action/contact closure | `verified-already-at-parity` | no timing, geometry, RNG, damage, or presentation change |
| Tutorial lesson 11, generated Arena, custom/mod Arena | shared PlayerWizard owner | `exact-ported` by the shared gate | real movement into hostile admits in every scene; idle does not |
| death, disconnect, world exit/replacement | existing action lifecycle | `verified-already-at-parity` | no epoch/contact/action survives owner teardown |

System C: **post-Tutorial College title-card timeline**, from Tutorial terminal
handoff through Courtyard presentation destruction at Office entry.

| Member / branch | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Tutorial Game Over writer and ten-tick black bridge | `0x005CF8CB`, MainMenu `0x005A51B0` | `verified-already-at-parity` | no card in the opening Boneyard or ordinary title shell |
| client renderer-ready hold | browser loading boundary | `out-of-system` (network renderer readiness) | cursor remains zero until visible authority is ready; no skipped title |
| six authored alpha points | Courtyard constructor `0x00506490` | `verified-already-at-parity` | exact complete row `[0,1,1,0,0,1]` |
| exact cursor recurrence | Courtyard 100-Hz tick | `verified-already-at-parity`, coverage strengthened | tick 769 cursor `3.9988000108860433`; tick 770 cursor `4.004000010900199`; tick 962 clamps to 5 |
| Title 7 `RAPTISOFT GAMES PRESENTS` | `0x0051EB60`, cursor `<=4`, Y 250 | `verified-already-at-parity`, coverage strengthened | owns ticks 0..769 and uses spline X alpha |
| Title 9 `SOLOMON DARK` | same painter, cursor `>4`, Y 450 | `verified-already-at-parity`, coverage strengthened | begins tick 770; alpha is spline X times uncovered-region term |
| special cover `-0.0005f` | Courtyard admission cover | `verified-already-at-parity` | continues independently after cursor reaches five |
| Courtyard walk/portal and Office entry | authored path plus shared region transition | `verified-already-at-parity` | both cards die with Courtyard presentation; none leaks into Office |
| snapshot interpolation/local projection | Hub presentation timeline | `verified-already-at-parity`, coverage strengthened | display cadence follows bounded authoritative ticks, not CSS timers |
| save/reload before card switch or Office | schema-16 College state | `verified-already-at-parity` | exact cursor/cover resume without replay or skip |
| declined Tutorial, ordinary Create/Hub, existing save | pending=false branches | `verified-already-at-parity` | no College card is fabricated |

No member is `blocked-by-platform` and no authored row remains unextracted.

## Native ownership thread and recovered behavioral contract

- `PlayerActor::Tick` owns the shared movement truth. The strict movement test
  occurs before Region result capture and before either Staff contact source.
  The Website must project that one fact from `planPlayerCharacterTick` through
  `stepBoneyardWorldTick` to both the Tutorial acknowledgement and Staff system.
  Raw controls and final stationary proximity are not equivalent substitutes.
- The Tutorial acknowledgement remains host-owned and browser-specific. It
  needs both authenticated user movement and a movement epoch admitted by the
  native planner. The stock forced lane can create movement epochs but lacks
  the user half; sealed input has the user request but lacks the admitted-epoch
  half. Only their conjunction completes the copy.
- Staff movement results retain their native priority. A nonempty result list
  suppresses the fallback; a hostile member admits without heading; a zero
  list may scan current contacts with strict facing. The recovered correction
  adds the omitted outer epoch gate and changes nothing downstream.
- College construction owns one spline cursor and cover lane. At 100 Hz, the
  first record-9 tick is 770 and the cursor first clamps to five at tick 962.
  Record 9 continues brightening from the independent uncover term until the
  Courtyard owner exits. Renderer interpolation may sample fractional ticks but
  cannot advance cards from wall time beyond one network interval or invent a
  second lifecycle.

## Nearby-system findings

- The prior Staff entry's inference that legal settled proximity could project
  the GoodGuy list was incomplete only because it omitted the enclosing
  movement epoch. The list/facing fallback itself remains real and must not be
  deleted.
- The existing Tutorial browser smoke forced stage 0 after the prelude and
  immediately supplied movement. It proved copy and controls but did not prove
  idle persistence or a sealed-input negative branch.
- The existing College smoke waited for both card records and captured pixels,
  but did not record their authoritative tick edges. Visual presence alone
  could not catch an accidental timer regression.
- Durable native corrections are recorded before implementation in
  `Mod Loader/docs/reverse-engineering/native-skills-and-spells.md`,
  `native-movement-and-tick.md`, `native-session-flow.md`, and
  `docs/re/tutorial-mechanics.md`.

## Confidence and open questions

- Confirmed: executable identity; strict movement branch and jump target; both
  Staff source branches nested beneath it; stock stage-0 ownership; current web
  raw-input and idle-fallback defects; complete title rows, recurrence, switch,
  cover product, scene lifetime; and clean-stock scene order.
- Inferred: none material. The renderer-ready hold is a named browser network
  boundary and does not change visible fixed-tick timing after release.
- Unknowns: none. All requested behavior is representable without a platform
  approximation.

## Web implementation consequence

- Export the authoritative per-player movement-epoch result from the Boneyard
  movement owner. Staff admission must reject before inspecting either contact
  source when that result is false.
- Move Tutorial copy acknowledgement to the post-movement authority edge. It
  requires a nonzero authenticated movement request and the admitted movement
  epoch in the same tick; remove the raw-input update from the controller.
- Keep protocol 84 and save schema 16: the boolean shape and persistence owner
  do not change, only its corrected semantic writer. No compatibility branch or
  new client-local state is needed.
- Keep the recovered College production model unchanged unless a failing exact
  timeline test falsifies it. Add full tick-edge and browser-timing coverage;
  do not replace the spline with durations, CSS animation, or guessed delays.

## Validation contract

- Movement copy: kernel and integration tests prove idle/forced/sealed cases
  remain false, an admitted user movement epoch becomes true on that exact
  result tick, desktop/mobile copy follows the boolean, and protocol/save
  round trips remain strict.
- Staff: stationary facing contact stays actionless across multiple complete
  action durations; a real movement epoch with no result uses the facing
  fallback; moving hostile collision admits without facing; nonhostile result
  suppresses fallback; every hostile family, Tutorial lesson 11, generated and
  custom Arenas retain existing actions/damage/audio.
- College: deterministic tests pin ticks 0, 193, 385, 577, 769, 770, 962 and
  post-962 uncover behavior; renderer timeline pins bounded fractional sampling
  and save/restore preserves cursor/cover.
- Mac Chrome: natural desktop Tutorial holds opening copy while idle, hides it
  only after real movement, reaches lesson 11, proves no stationary melee then
  real walk-in melee, completes Game Over, observes black handoff, measures both
  card tick edges/alpha and Office teardown, with empty page/console/network
  error arrays. Repeat opening copy and Staff negative/positive edges on mobile.
- Run the byte-identical Mod Loader portable static-RE suite and the Website's
  complete `/opt/homebrew/bin/bash ./scripts/validate.sh` gate on the Mac mini.

## Implementation validation receipt

- `boneyard-world.ts` now exports one authoritative per-player movement-epoch
  result from the same `planPlayerCharacterTick` branch that owns translation
  and dynamic contacts. `player-staff-combat-system.ts` rejects automatic Staff
  admission before inspecting either native contact source unless that epoch is
  active. The ordered hostile-result path, nonhostile suppression, and
  facing-qualified zero-result fallback remain unchanged inside the gate.
- `native-tutorial.ts` no longer acknowledges from pre-step raw input.
  `game-simulation.ts` commits the boolean after Boneyard movement only when the
  authenticated input is nonzero and that same tick produced an admitted
  movement epoch. Forced Tutorial velocity, sealed input, idle recurrence,
  stage ownership, protocol 84, and the current schema-18 continuation shape
  retain their existing owners.
- The exact College spline/card production code required no retiming.
  `native-college-intro.test.ts` now drains its full authoritative timeline:
  record 7 through tick 769, record 9 beginning tick 770, cursor clamp at tick
  962, and continued uncover brightening afterward. The previously dormant
  file is registered in the canonical Boneyard group, so these six College
  contracts now run on every complete gate.
- Regression coverage also pins stationary Staff silence, moving fallback,
  moving collision admission, the natural Boneyard repeat edge, held Tutorial
  movement, authenticated movement-copy completion, forced-epoch rejection,
  every existing hostile/contact sibling, protocol/save round trips, and the
  unmodified downstream action/contact system. The complete Mac Boneyard group
  passed `1,662/1,662`; the exact title timeline is canonical test 212, the
  stationary Staff unit is test 203, and the Tutorial integration movement
  edge is test 14.
- Exact local/Mac candidates are Website
  `604b13d78a25d7f2b19679eb03788e2f3bd30e15` (tree
  `910a6c7c6d69b5385d70285ea2596d6f03ebad64`) on base `ced3632a`, and Mod
  Loader `464decab2d7fb94befadf2598eb3c4697866a4e0` (tree
  `1172b6ac9cae1035382a0abb35775cce6d957619`) on base `4b44b9fa`. Changed-file
  blob-manifest SHA-256 values match across machines:
  `d671c673249d20aaa49c12a0ca96996d8280c9de98e6792d58c0e5c6e4db22b5`
  for Website and
  `73d2dd83fb894797c7a05dc66b590b20b1ac0fd42b584f8d0cf11157f5935487`
  for Mod Loader.
- The exact Mod Loader candidate passed the portable static-RE gate
  `518/518`; log SHA-256 is
  `ea9f278ec6f494ae41a3c126fbb5f57bd3cf1045ea7fd19248fb1b892f405389`.
  The exact Website candidate passed
  `/opt/homebrew/bin/bash ./scripts/validate.sh`: backend build with zero
  warnings/errors, `26/26` Website/backend contracts, formatting, lint,
  generated checks, every registered frontend/runtime/desktop group,
  production frontend and game-host builds, bundle policy, and media/CSP
  policy. Production entry `Game-kvLg2eUg.js` is `252,041` raw / `76,538`
  gzip bytes under `524,288 / 134,144`; gate-log SHA-256 is
  `6c9edcd73ea6e5709d498559910d5bd956ab6742bc06f84e80ea8fab1d1798d0`.
- Mac Chrome `151.0.7922.174` completed the stock desktop journey. The opening
  W/A/S/D copy survived 50 idle authority ticks and disappeared only after the
  real movement epoch. Tutorial lesson 11 produced no action during the
  stationary facing dwell; movement then created action/contact `3/4` at
  distance `43.030097004371214` versus legal
  `43.030097004398705`, reduced target HP `2 -> 1`, and kept mana `100`.
  After the Tutorial terminal/black handoff, Title 7 was visible at cursor
  `0.19760000053793192`, Title 9 at `4.180800011381507`, and the sequence
  continued through Office, Create, and returned Courtyard. Page, console, and
  failed-response arrays were empty.
- The touch/coarse-pointer journey repeated the 50-tick idle movement-copy
  dwell, acknowledged only the left-joystick movement, and used that same
  joystick to prove stationary Staff silence followed by action/contact `2/3`
  at distance `44.593816979202984` versus legal
  `44.59381697922945`, HP `2 -> 1`, mana `100`. It observed Title 7 at cursor
  `0.19240000052377582` and Title 9 at `4.186000011395663`, then completed the
  same College lifecycle with empty page, console, and failed-response arrays.
- Browser log SHA-256 values are
  `00ee4abcffc967cf56fc800e05ac5d87cf85dabb8c7032583b8694cabaf6e31a`
  (desktop) and
  `19aeda9963a7f77f4663db3db2a52d68733ab4836461f4430561233921f87f46`
  (mobile). Reviewed opening/Staff/card evidence is retained under Mac
  `/Users/jarrett/codex-acceptance/tutorial-input-intro-parity-20260827-root/evidence/`
  and local `/home/user/.codex-evidence/tutorial-input-intro-parity-20260827-root/`.
  Representative SHA-256 values are `5ea8783e...70089a` (desktop opening),
  `be19f437...daf6b` (desktop Staff), `32df5a5f...f39d` (mobile opening),
  `400a76ad...05b2` (mobile Staff), `f5e8e6ac...b6114` (Raptisoft), and
  `533ac045...ba89` (Solomon).
- No browser-platform exception or material unknown remains. All task-owned
  runtime/browser processes exited. Publication, deployment, production
  cutover, and service restart were not requested; both isolated local branches
  and both detached Mac acceptance worktrees remain retained for handoff.

## Publication rebase validation receipt

- Before the authorized push, Website `origin/main` advanced to
  `ec98c44ec5001802946289e833a3df5a0e8010fb` with the native Road/surface,
  Sirmin wardrobe, and College blocker/reset closure; Mod Loader `origin/main`
  advanced to matching report commit
  `f3fc7ff52805cd88aefd0a4e8c461bd842b677f9`. Both task branches were rebased,
  preserving the complete upstream implementation/tests/ledger entries and
  this entry's movement, Staff, and title contracts.
- The rebased runtime candidates are Website
  `f6a206ef3e7abd9eca7b95df1fc53c917841d9c0` (tree
  `649a375da1d823f6147a0623f8b7cfddba2e4ac0`) and Mod Loader
  `6ff32d0623c0fb5781be3ac90fdb16b9817ed9ba` (tree
  `4ca849ae654a88f6b32b759267e7040ea9851912`). Local/Mac changed-file blob
  manifests are identical at
  `2e16e1277ab0454a8a9ecaf3c97b3114e9a6f25b99f08a612250c079012d7fa5`
  for Website and
  `c0f3723a230e38e901f2bb9a2fed902f88beaf38e180b14607276eaaffb6284d`
  for Mod Loader.
- The rebased Mod Loader suite passed `521/521`; log SHA-256 is
  `2c1028ad01d5404f8fa1ed06543c77af0509cda77c052f935d3773caf7dd2851`.
  The rebased Website passed the complete canonical gate, including
  `1,667/1,667` in the largest Boneyard group, all later groups/builds/policies,
  and production entry `Game-AmVslleI.js` at `252,041` raw / `76,537` gzip.
  Gate-log SHA-256 is
  `ca7ac191f041ed9acb7355aabdaefd485463ceb5e272d6dff272c87ebc4392f1`.
- Rebased desktop Chrome retained the 50-tick idle movement-copy dwell,
  stationary Staff silence, movement action/contact `3/4`, HP `2 -> 1`, mana
  `100`, Title 7 cursor `0.19760000053793192`, Title 9 cursor
  `4.180800011381507`, and empty page/console/failed-response arrays. It also
  passed the upstream surface/onboarding receipt in the same journey. Log
  SHA-256 is
  `5e16f7db21e39945477a7402113b64b234991d9e6dd896ae8e6ca0e247daedd8`.
- Rebased touch Chrome retained the same prompt gate, then joystick-owned
  action/contact `2/3` at distance `39.97422473539427` versus legal
  `39.974224735423924`, HP `2 -> 1`, mana `100`, Title 7 alpha
  `0.232124` at cursor `0.19760000053793192`, Title
  9 cursor `4.186000011395663`, and empty error arrays. Log SHA-256 is
  `3bd36885b755674d6fe930d81ba117b403ed9b94fd7f24d2bb9dd4adab7e0dd3`.
- The earlier candidate SHAs remain historical pre-rebase evidence; this
  receipt supersedes them for publication. Deployment and production cutover
  remain outside the authorized push.
