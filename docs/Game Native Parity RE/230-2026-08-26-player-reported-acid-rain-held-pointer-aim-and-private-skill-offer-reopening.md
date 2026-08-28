# 2026-08-26 — Player-reported Acid Rain, held pointer aim, and private skill-offer reopening

## Reported smell and parity questions

- A player reported that Acid Rain looked different while its falling particles
  looked consistent. The owner suspected that the overhead cloud was missing.
- The same player reported that a primary cast initially used the click point
  but did not follow later cursor movement during the hold. Stock lets the
  current aim change while primary input remains held; the exact downstream
  effect depends on the selected primary family.
- The player also reported seeing some of the other participant's spell slots
  during the level-up menu and specifically wondered what selecting More
  Missiles would have done. The report does not distinguish a card in the
  private offer from live HUD art visible beneath the retained-world modal, so
  both ownership paths must be proved before calling this a mutation defect.
- Enemy response to both participants and Acid Rain child density were reported
  positively. Those observations are retained as supporting evidence, not used
  to waive authority or presentation checks.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity and existing native closure | retail Beta 0.72.5 `SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000`; `native-input-model.md`; `native-projectiles-and-effects.md`; existing Acid Rain entry above | The report touches three already recovered native owners. No new runtime address, loader-injected observation, or guessed constant is introduced. | high |
| Acid Rain instructions and prior closure | `AcidRain 0x005E3540/0x00604E90`; painter slots `+0x24 -> 0x005EB290`, `+0x28 -> 0x005EB1D0`; proxy `0x0064E910`; prior Website commits `1017c1f8`, `602e5b62`, `f200bbfe`, and `80d5fbc0` | The overhead cloud is two BadGuys-10 draws at local Y `-175` and `-175-50*s`, queued at proxy Y `groundY+350`. The residue is a separate pre-world pass. This correction is an ancestor of current main. | high |
| Current source/deployment identity | clean Website `origin/main` `5e1c9acddac8616c8a74f8b95d12f387f237c056`; live `https://solomondarker.com/deployment.json` observed 2026-08-26 at `fce78b6acfa868dd570391961d78318c556cc5eb` | Current main and production both include the Acid, Tutorial-decline, and projectile-effect corrections. The newer current-main commits close shared memorial persistence and its browser smoke, including adjacent host/protocol files, so the complete report journey is repeated on `5e1c9acd` even though they do not change the Acid painter or input message shape. | high for source and deployed revision |
| Current-main Mac Chrome Acid journey | detached Mac worktree at exact `ec9c16c0`; `SDR_SECONDARY_ABILITY_ID=72`, Boneyard `smoke-secondary-abilities.mjs`; screenshot SHA-256 `d17192989cce7d62c4d00b41d5c96d877ecc8770da2f009c8096c7ddc476d72c` | WebGL2 showed `acid-rain`, `acid-drop`, and `acid-splash`; cloud local Y range `[-225,-175]`, proxy world Y `2054.999249493634`, one residue primitive at depth `0.5`, 174 maximum actors, 221 maximum primitives, and empty page/console/response error arrays. The inspected frame visibly contains the green overhead cloud. | high |
| Native held-input contract | `GameWindowProc 0x00443440`; aim down/move/up `0x0042FF80/0x004301F0/0x004303D0`; reanchor `0x0042FE50`; `Game::Tick 0x005D7EF0`; `PlayerActor::Tick 0x00548B00` | Mouse move updates the current pointer; each fixed tick reanchors at `project(player)+(0,-25)` and consumes the latest direction while the level is held. Earth/Air/Water consume live held aim; Ether/Fire capture an action aim and a continued hold captures the latest aim for the next action. Born Fire/Earth projectiles do not steer toward later cursor motion; Ether steers toward its acquired actor target, not the cursor. | high |
| Current web input causal trace | `input/gameplay-input.ts`, `input/gameplay-pointer.ts`, both gameplay scenes, `game-client-session.ts`, `game-host.ts`, and `primary-spells.ts` at `5e1c9acd` | World `mousedown` owns capture; window `mousemove` updates `capturedPointer` and publishes immediately; each presentation sample reprojects held aim through the current camera; same-level aim updates coalesce while cast-level transitions retain distinct target ticks; the authority derives cast facing and spell behavior. | high source; browser journey reopened |
| Current focused baseline | exact `ec9c16c0` on the Mac mini; seven input/projection/primary/progression/simulation/client/host files | All `385/385` tests passed. Existing assertions cover held mouse reprojection, Earth retarget/release, Air browser retargeting in the primary smoke, per-player progression, local offer submission, and authenticated host validation. They do not form one two-participant browser receipt for this exact report. | high |
| Current level-up ownership trace | `MainMenuScene.tsx`, `SkillPicker.tsx`, `game-client-session.ts`, `game-host.ts`, `player-entity-store.ts`, and `player-progression.ts` | The picker receives `snapshot.players[session.playerId].progression.pendingOffer`; the client checks the chosen index/id/sequence against that same local offer; the host applies it as `client.playerId`. Shared milestones create separate offers from each participant's own skill book. More Missiles row 10 additionally requires learned Magic Missile row 8. | high source; multiplayer browser journey reopened |

The first two browser attempts against obsolete `d43fb6a3` stopped before
Create because the then-current Tutorial-decline admission bug was still in the
candidate. They did not reach or falsify Acid Rain. The owner confirmed that
intro loop as fixed; current main `ec9c16c0` contains the fix, and the successful
Acid journey above uses that exact tree. No intro workaround belongs in this
task.

## System boundary A and membership — Acid Rain field presentation

Native system: the complete skill-72 field from accepted aimed root through
parent/child painters, light/audio providers, damage footprint, replication,
and teardown. This is a validation reopening of the 2026-08-24 closure, not a
new cloud approximation.

| Member | Native source | Disposition | Current proof |
| --- | --- | --- | --- |
| accepted cast, ground root, mana/cooldown | `0x0054CC50`, `0x005E3540` | `verified-already-at-parity` | existing authority tests and current cast receipt |
| additive overhead cloud glyph | `0x005EB290`, translated Y `-175` | `exact-ported` | current-main plan plus Mac range `[-225,-175]` |
| source-over overhead cloud glyph | same painter, additional `-50*s` | `exact-ported` | same |
| proxy queue key/culling | `0x0064E910`, root Y `+350` | `exact-ported` | Mac proxy Y equals ground Y plus 350 |
| ground residue | `0x005EB1D0` | `exact-ported` | one pre-world primitive at depth `0.5` |
| ordinary/enhanced drop births | `0x00604E90`, two/five per tick | `verified-already-at-parity` | existing both-setting tests; current ordinary child census |
| falling drop/head/ground retirement | `0x004541A0/0x00459130` | `verified-already-at-parity` | current `acid-drop` receipt and existing recurrence tests |
| one-in-four splash and RNG suffix | `0x00604E90` | `verified-already-at-parity` | current `acid-splash` receipt and existing RNG tests |
| provider light and rainfall loop | `0x005EB5C0`, cloud-alpha tick tail | `verified-already-at-parity` | prior exact tests; current presenter unchanged |
| pulse query/shuffle/direct damage | `0x006052A1..0x006052D6`, `0x00642280`, `0x00523140`, `0x005E41F0` | `exact-ported` | center damaged; exact radius 200 unchanged in current journey |
| Tutorial and ordinary Boneyard consumers | shared Acid actor family | `verified-already-at-parity` | prior dual-scene receipt; current ordinary Boneyard rerun |
| snapshot, disconnect, reset, residue retirement | protocol/Region owner | `verified-already-at-parity` | existing round-trip/teardown coverage |
| Magic Storm | separate `0x005E8970/0x00602C30` painter | `out-of-system` (shares rain/light reducer, not Acid painter slots) | unchanged Storm sibling coverage |
| Rain of Bones | subclass `0x005E3780/0x0061C440/0x005EBAD0` | `out-of-system` (replaces Acid type/tick/painter/light) | prior complete vtable comparison |

There are no platform-blocked Acid members and no extractable unknowns. The
current evidence falsifies a missing-cloud defect on current main. A player may
still perceive the dark green composite as subtle against trees, but that is
not permission to brighten, enlarge, or move the recovered painter.

## System boundary B and membership — held primary pointer aim

Native system: desktop world mouse capture through current pointer/camera
projection, ordered network input, authoritative cast-facing, and every primary
spell family that consumes live or action-captured aim.

| Member / branch | Native contract | Disposition | Required report-specific proof |
| --- | --- | --- | --- |
| world down/move/up and capture | `0x0042FF80/0x004301F0/0x004303D0` | `verified-already-at-parity` | move outside the canvas while held still publishes current aim |
| player/camera reanchor and 25-pixel torso origin | `0x0042FE50`, `0x005D7EF0` | `exact-ported` | pointer stationary while player/camera changes reprojects direction |
| client coalescing and cast-edge ordering | browser input state and host fixed-tick queue | `verified-already-at-parity` | multiple same-level aim updates reach the authority; release remains a later tick |
| Ether 8 Magic Missile | next StaffCast1 action captures current aim; born missile homes to actor target | `verified-already-at-parity` | hold through at least two emissions, move pointer between them, and compare both fan headings |
| Fire 16 Fireball | next StaffCast1 action captures current aim; born Fireball remains straight | `verified-already-at-parity` | same two-emission retarget check without expecting in-flight steering |
| Air 24 Lightning | live held aim/target query each tick | `verified-already-at-parity` | existing browser retarget plus refreshed current-main receipt |
| Water 32 Frost Jet | live held cone aim each tick | `verified-already-at-parity` | move pointer during one channel and compare wire direction/heading |
| Earth 40 Boulder | live held actor retarget; release freezes latest direction | `verified-already-at-parity` | browser move during charge and released velocity check |
| welds 1000..1009 | component-specific one-shot/channel/charge owner | `verified-already-at-parity` | shared input rule plus per-build kernel membership; no alternate DOM producer |
| mouse secondary cursor placement | `0x0054CC50`, `0x00B3BCF4` | `out-of-system` (separate right-click accepted-point contract) | Acid accepted root remains stationary after cast |
| touch right stick and standard gamepad | browser-only producers into the same aim/held state | `out-of-system` for this desktop report; `verified-already-at-parity` in their own entries | existing producer coverage remains unchanged |
| Hub primary suppression | stock noncombat scene policy | `out-of-system` (primary fire is intentionally disabled in the Hub) | Boneyard/Tutorial are the report's valid firing scenes |
| modal, level-up, death, blur, hidden, teardown barriers | native UI/input seal and browser lifecycle | `verified-already-at-parity` | no retained cast resumes after the barrier |

No new native extraction is needed unless the browser journey contradicts the
closed G14 input model. The prior process gap is end-to-end coverage: source and
unit tests proved every seam separately, while no current receipt holds a
one-shot primary through two emissions and visibly changes its pointer between
them.

## System boundary C and membership — private multiplayer skill offers

Native/web system: shared milestone barrier with actor-private offer generation,
local-only picker presentation, authenticated selection, and per-player skill
book mutation.

| Member / branch | Owner | Disposition | Required report-specific proof |
| --- | --- | --- | --- |
| milestone/barrier cohort | shared simulation barrier | `verified-already-at-parity` | both participants pause and each owns a pending offer |
| participant-private offer generation | player progression plus same-index skill book | `verified-already-at-parity` | use deliberately disjoint Ether/Air books and inspect both offers |
| local picker data | `runtimeSnapshot.players[session.playerId]` | `verified-already-at-parity` | each browser's cards equal only its wire offer |
| More Missiles row 10 eligibility | dependency row 8 Magic Missile | `verified-already-at-parity` | Air-only player cannot receive 10; Ether player may receive/select it |
| authenticated choice application | client local check; host `client.playerId` | `verified-already-at-parity` | cross-player index/id/sequence is rejected and cannot mutate either book |
| peer waiting surface after local choice | level-up barrier pending-player list | `verified-already-at-parity` | chosen player sees waiting status, not the peer's cards |
| retained-world HUD beneath picker | local `GameHud` plus SkillPicker modal composition | `verified-already-at-parity` | identify any visible slot art by local player ID; remote quickbar cannot substitute |
| queued, rerolled, deferred, automatic, late-join, disconnect, and rejoin offers | existing progression/host branches | `verified-already-at-parity` | existing focused coverage; report journey must not regress them |

No platform member is blocked. The source trace rejects the hypothesis that a
click on another participant's visible card can be applied to the local actor,
and the two-browser frame resolves the visual phrase "some of your spell
slots": the stock retained-world picker leaves the local belt visible beneath
the modal. It does not render the remote participant's belt or offer.

## Implementation and validation consequence

- Do not change Acid Rain art or constants: current main has the exact cloud
  and the current Mac frame proves it.
- Retain the integrated held-pointer browser matrix at the existing input and
  primary-spell seams. It confirms the shared producer/authority owner; no
  Ether-only turn patch or other gameplay mutation is warranted.
- For the requested literal cursor-position check, derive each browser target
  from the live 1600-by-900 logical viewport, camera, zoom, player position,
  and native 25-pixel torso anchor. Compare that normalized ray with both the
  authoritative character aim and the born Fire projectile / live Air channel
  direction within the native `0.001` input-golden tolerance; left/right sign
  checks alone are not a completion receipt.
- Retain the two-participant skill-picker receipt with disjoint books and the
  focused cross-offer selection test. They confirm the current source model,
  so no progression mutation is warranted.
- Refresh the Acid visual receipt as a labeled 1600-by-900 stock/web pair:
  stock must be the pinned retail executable in a copied sandbox with no
  loader modules, naturally advanced to Tutorial stage 5; web must be the
  exact current candidate in Mac Chrome/WebGL2. Compare the two-glyph overhead
  cloud, falling rain, ground field, and player-relative registration rather
  than treating different random particle phases as a mismatch.
- Reject an ordinary-Boneyard frame as the final size comparator even at the
  same viewport: its camera/world composition visibly renders the wizard and
  field at a different scale from the stock stage-5 lock. The final web panel
  must use the restored Tutorial owner at stage 5, accept a real right-click,
  advance through the normal cast gate, and retain the Tutorial camera. The
  ordinary frame remains useful only for complete actor/lane/combat telemetry.
- Keep Tutorial-decline routing outside this task. It is fixed on current main
  and was only an obsolete pre-mechanic blocker.
- Run all focused tests, full `./scripts/validate.sh`, and final browser journeys
  on a byte-identical Mac candidate. Publication and deployment remain separate
  and are not authorized by this report.

## Implementation validation receipt

- Outcome: current main does not reproduce any of the three suspected product
  defects. No gameplay, renderer, protocol, or progression implementation was
  changed. The durable change is the reopened ledger plus regression coverage
  in `game-client-session.test.ts`, `primary-spells.test.ts`,
  `game-simulation.test.ts`, and the existing multiplayer combat smoke's new
  `--player-report-only` mode.
- The input regressions prove that a same-level held aim update replaces the
  pending authoritative sample without collapsing the later release edge;
  repeated Ether/Fire actions capture the moved aim; Air/Water consume moved
  aim during one channel; existing Earth and every Weld-family contract remain
  in the same focused suite. The progression regression forces More Missiles
  for Ether and Air simultaneously: Ether receives/selects row 10, Air cannot
  receive or cross-select it, and only Ether's rank changes.
- Exact final base/candidate: Website `5e1c9acddac8616c8a74f8b95d12f387f237c056`
  plus the five file changes above, materialized in detached Mac worktree
  `/Users/jarrett/codex-acceptance/player-spell-report-20260826-root-r4`.
  Local/Mac SHA-256 manifests matched for every changed file. Focused Mac tests
  pass `147/147`.
- The complete Mac `/opt/homebrew/bin/bash ./scripts/validate.sh` gate passes:
  backend build with zero warnings/errors, 24 backend/contract tests,
  lint/architecture/generated checks, every registered frontend group including
  the complete Boneyard/game and ML suites, desktop tests, production builds,
  bundle budget, and media policy. Lint reports only the repository's existing
  warnings.
- Acid Rain Mac Chrome/WebGL2 receipt on the exact candidate: actor kinds
  `acid-rain`, `acid-drop`, and `acid-splash`; overhead local Y range
  `[-225,-175]`; proxy Y `1700.6069668985715`; one ground-residue primitive at
  depth `0.5`; 174 maximum actors; 221 maximum primitives; center-root damage
  accepted and exact radius 200 rejected; empty page, console, and response
  error arrays. The inspected cloud screenshot SHA-256 is
  `1411c491ed933876b03252f8fcf22f1302d88d70fa17221fd0eeba7311bf6872`.
- Chrome `151.0.7922.174` completed the two-player Fire/Air report journey on
  the same candidate. Fire first emitted left with aim X
  `-0.9999875774848839`, then accepted/emitted its continued-hold successor at
  aim X `0.9818466083617756`. Air changed during one held channel from aim X
  `-0.9999999914432693`, heading 18, to X `0.9999998548857443`, heading 6,
  then released cleanly. The inspected tracking screenshot SHA-256 is
  `c5cafac1ac19bc77f0db66f83e087176778a50e07ff5829d18177f6116200606`.
- The same two browsers received distinct settled private card sets: Air
  `[25,27,26]`, Fire `[49,16,67]`; each DOM set exactly equaled that browser's
  wire offer and neither contained More Missiles 10. Beneath the modal, Air's
  only populated belt member was `Magic Storm`; Fire's was `Ring of Fire`.
  After Fire chose, it saw only the shared waiting surface while Air retained
  its own picker. Page and console error arrays were empty. Inspected SHA-256
  values are Air picker
  `8be3f47dd55fae5c1be2b7525c88c19f6fe432df674083bb85db877b6d9e9888`,
  Fire picker
  `ae2b7d441cd47cc4636f311e5c815ee66fe50bd78c006292382829b62aca9b61`,
  and waiting surface
  `c6d1ff51bc2d791aaf97dffcf4eae191c77b437051c1436f1f220bd18c428f21`.
- There are no browser-platform-blocked members, no remaining extractable
  unknowns, and no predicted current-main visual difference from retail in
  these systems. No new native fact was recovered, so the already-authoritative
  Mod Loader reports were not duplicated or changed.
- Commit/push/deployment remain separate: this report made no commit, push, or
  deployment. At the final observation, `origin/main` was `5e1c9acd` and live
  production served `fce78b6a`; the task worktrees and Mac evidence remain
  retained because publication/cleanup was not authorized.

## 2026-08-26 current-main stock comparison and exact-ray refresh

- Superseding comparison base: Website `origin/main`
  `799691a9732ec43f11e2c13b6f12ce308cdcc64d` plus seven documentation/test-
  harness files. No gameplay, renderer, protocol, progression, or asset source
  changed. The exact seven-file SHA-256 manifest matched between the Linux
  authoring worktree and detached Mac candidate.
- Clean retail was copied into a fresh task sandbox and naturally advanced to
  Tutorial stage 5. The running image was the pinned 4,723,200-byte executable
  with SHA-256
  `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`;
  the process had five modules and the only non-Windows module was that copied
  `SolomonDark.exe`. The unmodified 1600-by-900 client capture SHA-256 is
  `607a697578d1548181e86c8fce82218804f7e99cfcc4bb00ffa06a80bb9227f7`.
- Mac Chrome `151.0.7922.174` accepted a real right-click in the restored web
  Tutorial at the same 1600-by-900 intersection and advanced stage 5 to 6.
  At age 60/61 the frame contained `acid-rain`, `acid-drop`, `acid-splash`, and
  the authored `fire-patch`; the field root was `(1232.4074074074074,1350)`,
  proxy Y was `1700`, cloud offsets were exactly `[-175,-225]`, and the one
  residue primitive was at depth `0.5`. Page, console, and failed-response
  arrays were empty.
- A single stock/web bitmap pair cannot synchronize the private constructor
  draw after the fact. The native second cloud's horizontal scale is
  `7.5 * constructorPhase`: the natural deterministic web fixture uses phase
  `0.13107000291347504` and looks narrow, while native RNG seed 490 produces
  phase `0.9989299774169922` and the full wide cloud. Both casts retain the same
  two cloud glyphs, drops, splashes, ground residue, queue key, and lifecycle.
  Natural and wide web screenshot SHA-256 values are respectively
  `7263bfe86048eb3f909c12c15fbf06d582f110ae78563f6a8c30367b5b3f65c9`
  and
  `574e8a166b7524fd0e6fd6a1352d5d7004699458c250048ecdf064581189a35d`.
  The labeled three-panel comparison SHA-256 is
  `d348b825db47114c8ba2dccc70a28d1d20a543fbd3acfaa386fe9f08ace9ba30`.
  This proves the stock painter range and falsifies a missing-cloud defect; it
  is deliberately not described as a pixel-identical synchronized RNG frame.
- The refreshed two-browser report journey captures the actual browser
  `mousemove` coordinates and camera in the same event. Fire's first expected
  ray `(-0.9237069463148355,-0.3830998268463739)` matched its born projectile
  `(-0.9238978922973413,-0.38263910491288033)` inside the native `0.001`
  component tolerance; after the held cursor move, expected
  `(0.8475082680272982,0.5307821922647454)` equaled the successor projectile
  `(0.8475082680272981,0.5307821922647457)`. Air likewise matched
  expected/actual left and right rays to floating-point noise and released the
  channel cleanly. This closes the exact cursor-ray question more strongly
  than the previous sign-only receipt.
- The same browsers rendered different private settled offers: Air
  `[64,24,49]`, Fire `[56,16,18]`; each DOM set equaled only its local wire
  offer. Their retained belts contained only local `Magic Storm` and local
  `Ring of Fire` respectively. The focused forced-offer regression separately
  put More Missiles row 10 into Ether's eligible offer while Air lacked its
  Magic Missile prerequisite: Air could neither receive nor cross-select it,
  and only Ether's permanent rank changed.
- Focused Mac authority coverage passes `147/147`. Browser errors were empty;
  the exact-ray/private-offer receipt log SHA-256 is
  `6649024b5e4a99e28164b497abeec399153992f270867840f40a5daa0edfee04`.
  Publication and deployment remain unrequested and were not performed.
