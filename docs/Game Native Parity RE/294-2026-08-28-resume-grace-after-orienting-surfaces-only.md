## 2026-08-28 — Resume grace after orienting surfaces only

### Reported smell and parity question

- Reported web behavior: the two-second authoritative resume bar also appears
  after the compact hotbar skill selector and the mandatory level-up picker.
  Those short or compulsory choices interrupt the game again after the player
  has already completed the interaction.
- Requested Website behavior: retain resume grace after the multiplayer Pause
  Menu and Inventory, but resume directly after the compact hotbar selector
  and the final level-up choice. The independently owned full Skill Screen is
  not named by this correction and retains its existing grace.
- Reproduction inputs/scenes: an active multiplayer Boneyard with two
  materialized humans; close Pause, Inventory, the full Skill Screen, and the
  compact primary/concentration selector; then resolve the final member of a
  mandatory level-up cohort through choose, reroll/save, and bot choice paths.
- Falsifiers: any new `skill-selector-closed` grace or any positive-duration
  `skill-picker-closed` grace; simulation advancing before the relevant
  selector/picker owner actually closes; showing resume progress during the
  picker close hold; removing the loading/rejoin grace that was merely waiting
  behind a level barrier; changing Pause, Inventory, full Skill Screen,
  renderer readiness, restart, rejoin, disconnect, or solo behavior; or
  replaying held wall time as fixed ticks.

This reopens the 2026-08-26 resume-grace entry and the 2026-08-27 two-second
progress correction only at their source-admission policy. Their host-owned
deadline, presentation, renderer-readiness, isolation, and no-catch-up
contracts remain authoritative.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Product direction | user feature request, 2026-08-28 | Resume grace is wanted after Pause and Inventory, not after compact hotbar selection or level-up. | authoritative |
| Existing retail pause evidence | retail Beta 0.72.5 SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; `native-gameplay-pause.md`; suspension helper `0x005CBD40`; dispatcher `0x00427800` | Every final native modal/barrier release resumes on the next ordinary scheduler edge with no native post-close grace or catch-up. | high |
| Existing retail selector evidence | `native-skill-screen-and-quickbar.md`; compact constructor/builder/render/destructor `0x00657A70`/`0x0066F0B0`/`0x0066F330`/`0x00658DC0`; modal runner `0x004281F0` | The primary/concentration hotbar selector has no open/close animation and owns suspension only until teardown. It is distinct from the opaque full Skill Screen. | high |
| Existing retail LevelupScreen evidence | `native-progression-and-skills.md`; open `0x0067CAC0`; destructor/suspension balance `0x006588C0`; render `0x0067DF80` | The mandatory picker owns its barrier and live close presentation; final completion releases without a native post-close countdown. | high |
| Current Website causal trace | exact base `05f2232a87f3cb36bc01cec3296dd1b6afe6faa7`; protocol 98; `gameplay-resume-grace.ts`; `game-host.ts`; `MainMenuScene.tsx` | Every `GameplayPauseSource` maps to a grace reason. Host level-up select, reroll/save, and bot paths explicitly synthesize `skill-picker-closed`; the client then acknowledges only after the close presentation. | high |

No new retail instruction, address, authored table, asset, or runtime claim is
needed. The reusable native reports already close the relevant owner families
and remain unchanged; this is a Website product-policy correction.

### System boundary and membership inventory

System boundary: **run-scoped authoritative resume-grace admission** begins at
one source-qualified release/readiness edge. This pass changes only which
already-loaded modal/barrier releases may create a fresh record; it retains the
record's authority, two-second deadline, waiting phase, projection,
presentation, input/simulation hold, expiry, and teardown.

| Member / branch | Native or Website source | Disposition | Required proof |
| --- | --- | --- | --- |
| Multiplayer Pause Menu Resume | `0x0058EA50 -> 0x005ABF10`; Website `pause-menu` owner release | `verified-already-at-parity` | still creates one `pause-menu-closed` two-second grace after actual close |
| Multiplayer gameplay Settings close under Pause | nested `SimpleMenu`/settings hold; same Website Pause owner | `verified-already-at-parity` | child close cannot release early; final outer release retains Pause grace |
| Multiplayer Inventory close | `0x00555810`/`0x005684C0`; Website `inventory` owner release | `verified-already-at-parity` | still creates one `inventory-closed` two-second grace |
| Multiplayer full Skill Screen close | `0x005CA640`, `0x006568E0`, `0x0066B200`; Website `skill-book` owner | `verified-already-at-parity` (outside requested correction) | 40-tick close completes, then existing `skill-book-closed` grace remains |
| Full Skill Screen to Inventory handoff | symmetric native exclusion; Website owner replacement | `verified-already-at-parity` | no intermediate grace; final Inventory release retains Inventory grace |
| Compact primary selector close/cancel/accept | `0x005D8120`, `0x00657A70`, `0x00658DC0`; Website `skill-selector` owner | `exact-ported` policy correction | releases directly after teardown and never creates a resume-grace record |
| Compact concentration A/B selector close/cancel/accept | same `Skills_Quickbar` family and Website source | `exact-ported` policy correction | every target/exit branch follows the same direct-release rule |
| Final ordinary SkillPicker `client-select-skill` | LevelupScreen owner and `levelUpBarrier` transition | `exact-ported` policy correction | final barrier removal creates only a nullable close hold; the final chooser's close-ready receipt clears it with no two-second deadline or progress |
| Final Sorceror reroll/save `client-level-up-action` | same LevelupScreen barrier owner | `exact-ported` policy correction | final saved choice uses the same no-timer close hold; reroll/intermediate offers remain held by the level barrier |
| Final Web Lua/mod replacement offer | `client-mod-action` `closedSkillBarrier` branch from the Web Lua 1.0 showcase integration | `exact-ported` shared correction | the newly rebased producer routes through the same pending-only picker close hold and can never create progress |
| Final bot level-up selection | host bot intent path sharing the same barrier | `exact-ported` policy correction | a bot has no picker presentation, so its final choice cannot synthesize either a close hold or a timer and merely unblocks the cohort |
| Earlier member or intermediate queued level choice | barrier remains non-null | `verified-already-at-parity` | no resume and no grace until the final cohort/offer edge |
| Level-up close while loading/rejoin/restart readiness is pending | existing non-picker grace record plus level barrier | `exact-ported` composition | final close may start the older eligible grace after readiness; it must not replace its reason with picker grace |
| Detached catch-up picker materialization | `partyRejoinSlot` materialization plus existing rejoin grace | `verified-already-at-parity` | retains `game-rejoined` readiness/grace; no independent picker reason |
| Initial Boneyard/Tutorial renderer readiness | `game-started`; 2026-08-28 fresh-match correction above | `verified-already-at-parity` | pending readiness clears directly at all-ready with no positive remainder; this rebase preserves that newer product rule |
| Active rejoin, restart, same-tab takeover, party-rejoin wait | `game-rejoined`, `game-restarted`, `party-rejoin-wait` | `verified-already-at-parity` | existing waiting/deadline transitions remain exact |
| Pause owner disconnect | disconnect-owned release | `verified-already-at-parity` | direct safe release; no grace synthesized |
| Solo Pause/Inventory/Skill Screen/selector/SkillPicker | connected materialized human count below two | `verified-already-at-parity` | immediate ordinary release remains unchanged |
| Late peer during an eligible active grace | strict welcome/live projection | `verified-already-at-parity` | receives the current remainder without extending it |
| Shared Hub, title, Create, loading UI, Game Over, loadout, observer, unrelated run | outside active-run grace admission | `out-of-system` (separate scene/session owners) | no new grace or cross-run hold |
| `skill-selector-closed` wire reason | protocol 98 reason family | `exact-ported` removal | combined protocol 104 removes the impossible state; strict decoder rejects it |
| `skill-picker-closed` nullable close hold | existing pending grace projection | `exact-ported` policy correction | reason remains strict, requires `remainingMs === null`, mounts no progress UI, and clears rather than starting a deadline after close-ready |

There is no browser-blocked member. A source-qualified host branch can express
the requested policy directly without timing or platform approximation.

### Native ownership thread

- Owner and construction path: retail modal owners balance the shared gameplay
  suspension depth. Website multiplayer projects those owners as
  `GameplayPauseState`; the game host alone may replace an eligible owner with
  a `HostGameplayResumeGrace` record.
- Upstream state producers: owner-resumed gameplay-pause release, final
  `levelUpBarrier` removal, renderer-ready/rejoin/restart readiness, and
  disconnect/teardown are separate producer families.
- State representation and transitions: a pause-source policy maps Pause,
  Inventory, and the unchanged full Skill Screen to grace reasons; the compact
  selector maps to no fresh grace. Final level-up release either asks whether
  an older readiness grace can now begin or creates a nullable picker-close
  hold whose ready edge clears immediately.
- Downstream consumers: the strict protocol, client input/prediction gates,
  `GameplayResumeProgress`, fixed-tick admission, late projection, logging,
  expiry, and scheduler reset consume an actual grace record and require no
  presentation special case.
- Sibling systems: compact primary and concentration selectors share one
  source; choose, Sorceror action, and Web Lua/mod replacement paths share the
  LevelupScreen barrier; bots share that barrier; full Skill Screen remains a
  distinct opaque modal.
- Entry, interruption, reset, and teardown: input is cleared on every release.
  Direct selector/picker release admits the next ordinary fixed tick only
  after their owner/close lifecycle ends. Existing loading/rejoin grace,
  disconnect release, run replacement, and host close retain their current
  ordering and cleanup.

### Recovered behavioral contract

- Timing: eligible grace remains exactly 2,000 monotonic milliseconds. Compact
  selector and ordinary level-up release add zero grace milliseconds and no
  catch-up ticks.
- Presentation: no progress overlay is mounted for direct releases, the
  picker-close hold, or fresh-match `game-started` readiness. A progress overlay
  may still follow Pause, Inventory, full Skill Screen, rejoin, or restart.
- Input/network authority: the authenticated host chooses the policy from its
  recorded pause source or barrier transition. Clients cannot request, skip,
  or fabricate grace.
- Boundary behavior: final level-up close preserves a waiting
  `game-started`/rejoin/restart record. `game-started` and an otherwise standalone
  picker-close hold both clear directly once their respective readiness rules
  are satisfied; rejoin/restart retain their timed grace. Stale selector reasons
  and positive-duration picker states fail closed under the new exact-match
  protocol.
- Assets/audio/randomness/geometry: unchanged. Selector/picker native close,
  sound, render, offer RNG, and layout owners are not modified.

### Nearby-system findings

- Durable finding: resume grace is a product-level reorientation policy, not a
  generic consequence of every suspension-depth decrement. Its admission must
  remain source-qualified at the host boundary.
- Evidence: retail immediately resumes every final modal release, while the
  Website already records independent pause sources and reason-qualified
  readiness records.
- Why it matters: another short overlay can share native suspension without
  silently inheriting a two-second multiplayer interruption.
- Native report/catalog update: none; no reusable retail fact changed.

### Confidence and open questions

- Confirmed: every current reason producer, pause-source member, final
  level-up writer, bot sibling, existing-grace composition edge, strict wire
  consumer, and presentation consumer.
- User-directed Website policy: selector/picker exclusion and retained
  Pause/Inventory grace.
- Explicit scope decision: full Skill Screen grace remains unchanged because
  the request identifies the compact hotbar selector, and native evidence
  confirms those are separate owners.
- Unknown: none material. If future product direction also excludes the full
  Skill Screen, that is a separate one-row admission change rather than an
  ambiguity in the native owner.

### Web implementation consequence

- Make the pause-source grace projector nullable and exclude only
  `skill-selector`.
- On owner release, create grace only for a projected reason; otherwise permit
  direct resume while still checking whether an older pending readiness record
  can start.
- Keep human `skill-picker-closed` as a nullable close hold, but make its valid
  all-ready edge clear the record and resume directly rather than install the
  two-second deadline. Bots only ask an older grace to start.
- Remove `skill-selector-closed` from the strict reason family, reject a
  positive remainder for `skill-picker-closed`, and increment the exact-match
  gameplay protocol. Do not add a compatibility decoder or client-side timer
  suppression.
- Keep `SkillPicker` close readiness calls: they release the no-timer close
  hold or start a pre-existing catch-up/rejoin/restart grace after the picker
  lifecycle is actually complete.

### Validation contract

- Focused automated tests: exact pause-source mapping; protocol reason family
  and picker-nullability; multiplayer Pause/Inventory/full Skill Screen
  positives; compact primary/A/B selector direct release; final choose/save
  close hold with no positive remainder or progress; reroll/intermediate hold;
  Web Lua/mod replacement producer; bot direct release; pending-only fresh
  readiness; existing rejoin/readiness composition; solo and disconnect
  negatives; no-catch-up bounds.
- Mac Chrome: in one two-client Boneyard, close Inventory and observe held
  authority plus progress; close the compact selector and observe no progress
  plus the next ordinary tick; resolve both players' level-up offers and
  observe no picker progress after the final close. Pause remains a positive
  control. Require empty page/console/failed-response/host-error arrays.
- Stock-versus-web comparison: native evidence supplies the zero-delay release
  baseline for selector and LevelupScreen. The requested retained Pause and
  Inventory delay remains explicitly Website-only.
- Exact candidate: byte-identical Mac worktree and
  `/opt/homebrew/bin/bash ./scripts/validate.sh` before completion.

### Implementation validation receipt

- Protocol 109 removes only the pending-only `game-started` restriction. The
  existing strict reason, sequence, duration cap, nullable readiness phase,
  client input/prediction gates, and save boundary remain unchanged.
- The run host now sends fresh Arena all-ready through the ordinary two-second
  deadline path. The source-qualified surface owner admits Pause, Inventory,
  and full Skill Screen grace in standalone and multiplayer Arenas. Compact
  primary/concentration selectors still map to direct release, and
  `skill-picker-closed` remains a nullable close-only hold that cannot project
  progress.
- The test-only Mac candidate first failed exactly at the intended protocol
  assertion (`108 !== 109`) after all backend/contracts and 323 unrelated
  prerequisite tests passed. The implemented byte-identical candidate then
  passed the complete canonical gate: zero-warning backend build, all 28
  Website/backend contracts, lint/generated/boundary checks, every registered
  frontend/host/UI/desktop group, production builds, bundle budget, and media
  policy. The final exact-tree repetition is the publication gate below.
- Mac Chrome 151 completed one continuous shared/solo journey. Fresh Arena
  renderer readiness showed `Waiting on players ...`, then positive
  `game-started` progress while the authoritative tick remained held.
  Inventory, full Skills, multiplayer Pause, and solo Pause each showed the
  same held two-second progress. Compact primary and concentration-A selectors
  released directly with no grace surface. Pause owner disconnect remained
  direct, and active-save restart retained positive `game-restarted` progress.
  Example held ticks were multiplayer Pause `3689`, peer-owned Pause `3699`,
  and restart `3716`; every no-catch-up bound passed.
- A separate real Boneyard LevelupScreen journey retained the complete world,
  particles, enemy, audio, and close presentation at tick `1393`, selected a
  real offer, mounted zero `skill-picker-closed` progress surfaces, and resumed
  within the elapsed-wall-time no-catch-up bound. Page, console, response, and
  host error arrays were empty in both browser journeys.
- The inspected Arena waiting and progress frames have SHA-256
  `a12fc3f1da553fc3fe7968dc28f145f343ce1ed43d789544c29b0ed749cc598e`
  and `b4c4d6afb6e114d9ccc60e8bad10bbbae01d860151f221c3c562abfa167331e2`.
  No browser-platform exception, unresolved native fact, or material unknown
  remains. Push to `main` is authorized; deployment is not implied.

### Implementation validation receipt

- Protocol 104 combines upstream pending-only `game-started`, addressed
  inventory slots and effective secondary costs with removal of
  `skill-selector-closed` and rejection of any positive
  `skill-picker-closed` remainder. The pause-source policy maps only the compact
  selector to direct release; Pause, Inventory, and full Skill Screen retain
  their existing reasons and two-second authority. The host clears the
  human-only picker close hold on its close-ready edge, while the bot sibling
  can only unblock an older readiness grace. `MainMenuScene` suppresses the
  progress surface for that nullable close hold while retaining every input,
  prediction, and fixed-tick gate.
- The byte-identical test-only candidate on Mac base
  `05f2232a87f3cb36bc01cec3296dd1b6afe6faa7` produced the intended red
  receipt: 1,713 of 1,720 broad game tests passed and exactly seven failed on
  the old policy (selector mapping/UI/bot producer, selector host release,
  picker positive-timer release, strict picker state, and protocol version).
  No unrelated test failed.
- The implementation candidate adds host coverage for direct multiplayer
  compact-selector release, ordinary final choice, Sorceror deferred choice,
  Web Lua/mod replacement, and the bot producer; protocol/presentation
  contracts cover the removed reason and hidden close-only state. The final
  rebased runtime/test source was focused pre-receipt commit `ed513f27` over base
  `39228f6e`, copied byte-identically to the Mac under 13-path manifest SHA-256
  `9a05c62d629fe7d78f96b9f7d377eeb5fd4390353859838636d10a122100b3ac`.
- On arm64 macOS 26.6.2, `/opt/homebrew/bin/bash ./scripts/validate.sh`
  passed the complete supported gate. The broad game group passed all
  1,754 tests, including the source policy, strict protocol, ordinary and
  Sorceror final-choice, Web Lua/mod replacement, and bot siblings. Backend,
  remaining frontend groups, lint/import boundaries, desktop tests,
  production TypeScript/build, bundle budget, and media policy also passed.
  Production Game output was 262,008 raw / 79,508 gzip bytes against 524,288 /
  134,144. The validation-log SHA-256 is
  `73a68dc760df0238afcd438ec10acf85803458b681000cd9385b18355601ca17`.
- Mac Chrome 151.0.7922.174 passed the complete Pause journey. Inventory,
  Pause Menu, and full Skill Screen retained their authoritative progress;
  Hub and Boneyard compact selectors closed directly with no grace state;
  restart/readiness and peer ownership remained correct. Example held ticks
  were Pause owner `1788`, peer `1797`, and restart `1802`; failed responses
  and page/console errors were empty. The log SHA-256 is
  `1652413d9d21904fc418b2b4b29e235c60f65fe33218def9ce9304fcb0239004`;
  inspected Inventory/progress frames are
  `e25ffddb6b0c95911ca0da297c27dc6b0cb43fd7de6d08c4b80bb98fbf84af2e`
  and `b07929dd82081c47a15db2d9a9d3127fb9619d7583ce26ca334f172709af8a80`.
- The sequential real two-client level-up journey held authoritative tick
  `9512` through both native close presentations, mounted no
  `skill-picker-closed` progress surface, and resumed on exactly `9513`.
  Both distinct offer sets, retained world/effects, level-up/panel audio, and
  waiting-peer presentation remained correct; host and guest page/console
  error arrays were empty. Its log SHA-256 is
  `d4df203c60dfc9f94e0a82cad8d0f790c1610ecb28245e55da9a7c163e4db19c`;
  inspected owner/waiting frames are
  `6f575904197226956833b39033ed4065823d9220fab2227b9bbe3aaf8fdbd288`
  and `e82f0731aefe8a4acdd11e5f1382cfcba30986c23f373bc8b22e980a36acb423`.
- This receipt is the sole post-validation documentation write; no runtime,
  test, build, or browser byte changed afterward. There is no browser-platform
  exception, unresolved native fact, or predicted visible discrepancy beyond
  the explicitly requested Website-only resume policy.

## 2026-08-29 — Arena-entry and orienting-surface resume-progress matrix

### Reported smell and parity question

- Product correction: show the existing two-second `RESUMING...` progress
  phase after a player finishes loading into an Arena and after Pause,
  Inventory, or the full Skill Screen releases gameplay. Do not show it for
  compact concentration changes or after LevelupScreen closes.
- Reopened boundaries: the 2026-08-28 fresh-entry correction made
  `game-started` pending-only, and the original surface policy made solo
  Pause/Inventory/Skill Screen release immediate. Both contradict the newly
  requested event matrix.
- Preserved boundaries: renderer readiness still precedes Arena progress;
  compact primary/concentration selectors still release directly; the hidden
  LevelupScreen close hold may finish its native presentation but never gains
  a positive remainder or progress surface; disconnect release remains direct.
- Falsifiers: progress burning behind loading; a fresh Arena beginning to tick
  before every expected renderer is ready; no progress after a solo eligible
  surface; progress after concentration A/B selection or an ordinary level-up;
  a click/input leak during progress; or held wall time replayed as catch-up.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Product direction | user feature request, 2026-08-29 | Arena entry, Pause, Skills, and Inventory are positive progress edges; concentration changes and level-up are explicit negatives. | authoritative |
| Existing retail lifecycle | retail `SolomonDark.exe` 0.72.5, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; session G13; pause `0x005CBD40`; Inventory `0x005C6F10`; SkillScreen `0x005CA640`; selector `0x0066F0B0`; LevelupScreen `0x0067CAC0` | Native loading and modal owners establish the input/readiness/retained-world boundaries. Stock supplies no post-release delay; the two-second phase remains an explicit Website policy. | high |
| Current Website causal trace | exact base `0c5f1577c9cce0bfab5ad188e5830d992848a051`, protocol 108; `game-host.ts`, `gameplay-resume-grace.ts`, `MainMenuScene.tsx`, `GameplayResumeProgress.tsx` | `game-started` clears directly after readiness; eligible surface grace requires at least two materialized humans; compact selector maps to direct release; LevelupScreen uses a nullable close-only hold and mounts no progress. | high |
| Existing browser evidence | entries 288 and 294 | The current direct fresh release and selector/level-up negatives were exercised independently. The same host record already owns readiness, exact duration, input clearing, no-catch-up expiry, and per-party isolation. | high |

No new retail address, authored asset, or save fact is introduced. This is a
Website admission-policy correction over the already recovered native
suspension and presentation boundaries.

### System boundary and membership inventory

System boundary: **run-scoped resume-progress admission**, from an Arena
renderer-ready or eligible modal-release edge through the existing 2,000-ms
host deadline, strict projection, input/simulation hold, visible progress,
expiry, and teardown.

| Member / branch | Source | Disposition | Required proof |
| --- | --- | --- | --- |
| Fresh standalone/private ordinary or custom Arena | `game-started` readiness owner | `exact-ported` requested Website policy | pending until the sole renderer is ready, then positive two-second progress before the next tick |
| Fresh shared-party ordinary or custom Arena | same expected-renderer cohort | `exact-ported` requested Website policy | all humans ready before one party-scoped deadline; every peer sees the same progress |
| Fresh stock Tutorial Arena | same `game-started` owner plus Tutorial renderer | `exact-ported` requested Website policy | authored Tutorial clock remains held through readiness and progress |
| Active save restart, active-party rejoin/takeover, coordinated recovery | `game-restarted` / `game-rejoined` | `verified-already-at-parity` | existing-run readiness and two-second progress remain unchanged |
| Standalone and multiplayer Pause Menu / nested Settings release | `pause-menu-closed` | `exact-ported` expanded policy | owner Resume begins progress after final surface release; no catch-up |
| Standalone and multiplayer Inventory close | `inventory-closed` | `exact-ported` expanded policy | native close completes, then progress begins |
| Standalone and multiplayer full Skill Screen close | `skill-book-closed` | `exact-ported` expanded policy | 40-tick close and Inventory handoff remain ordered; only final release begins progress |
| Compact primary selector | source `skill-selector` | `verified-already-at-requested-policy` direct release | no progress; same compact-family rule remains coherent |
| Compact concentration A and B selectors | source `skill-selector`, addressed slots 16/20 | `verified-already-at-requested-policy` direct release | explicit user negative; no positive grace state or progressbar |
| Mandatory LevelupScreen final close | nullable `skill-picker-closed` close hold | `verified-already-at-requested-policy` | close presentation may hold the world, then clears directly with no positive remainder or progress |
| Earlier/reroll/save level-up branches and bot choices | level barrier / picker producer family | `verified-already-at-requested-policy` | no synthetic progress; final simulation release remains ordered |
| Pause owner disconnect | disconnect teardown | `verified-already-at-parity` direct release | departed owner cannot impose a new timer |
| Slow/erroring renderer, stale or duplicate ready receipt | strict run/sequence readiness | `verified-already-at-parity` | fail closed while pending; cannot shorten or recreate progress |
| Bot, observer, detached nonmaterialized actor | no player renderer owner | `out-of-system` | never joins the ready cohort or creates a client progress owner |
| Hub Skills/Inventory/selectors, title, Create, Game Over, Hall, loadout | non-Arena scene owners | `out-of-system` | live Hub policy and unrelated scenes never acquire run progress |
| Run replacement, Game Over, empty retirement, host close | run teardown | `verified-already-at-parity` | pending/deadline state retires once; no late expiry or progress survives |

No member is blocked by the browser platform.

### Native ownership thread and recovered behavioral contract

- The host remains the deepest owner. Fresh entry first owns the exact expected
  human renderer cohort; only its all-ready edge may assign the deadline.
- Pause, Inventory, and full Skill Screen release use their existing
  source-qualified pause record. Eligibility now depends on an active Arena,
  not on a two-human minimum. Hub remains outside the run scope.
- Compact selector release remains null-mapped. LevelupScreen retains only its
  nullable presentation-close barrier, after which the next ordinary fixed
  tick is admitted directly.
- Every positive member uses the existing 2,000 monotonic milliseconds,
  progress projection, queued/held-input clearing, fixed-tick exclusion,
  late-peer projection, expiry, and standalone scheduler reset. No elapsed
  wall time becomes simulation.
- `game-started` is no longer pending-only on the strict wire. The same reason
  legitimately projects either `remainingMs=null` before renderer readiness or
  a bounded positive remainder afterward. This exact-match change requires a
  protocol increment but no save-schema change.

### Confidence and open questions

- Confirmed: every producer, exclusion, readiness edge, host scope, protocol
  projection, client gate, presentation branch, expiry, and teardown member.
- Inferred: none used for implementation.
- Unknown: none material.

### Web implementation consequence

- Let the all-ready `game-started` branch enter the ordinary deadline path;
  remove the strict pending-only decoder assertion.
- Generalize eligible pause-like surface grace from multiplayer-only to any
  active Arena while retaining disconnect, scene, selector, and picker
  negatives.
- Keep one shared reason map and host record. Do not introduce UI timers,
  scene-specific delays, or a second loading barrier.
- Advance the exact-match protocol and update every affected host/protocol/
  browser contract as one cutover.

### Validation contract

- Focused automated coverage: fresh standalone/shared/Tutorial readiness then
  positive progress; solo and multiplayer Pause/Settings, Inventory, and full
  Skill Screen positives; compact primary/A/B and LevelupScreen negatives;
  disconnect/stale-ready/teardown negatives; rejoin/restart nonregression;
  exact duration, held ticks/input, isolation, and no-catch-up.
- Mac Chrome: one fresh solo Arena and one delayed-peer shared Arena must show
  pending readiness followed by `RESUMING...`; solo and shared Pause,
  Inventory, and full Skills must show progress; both concentration selectors
  and a real two-player level-up must resume without progress. Require empty
  page, console, failed-response, and host-error arrays.
- Exact candidate: byte-identical Mac worktree and
  `/opt/homebrew/bin/bash ./scripts/validate.sh` before completion.


## 2026-10-08 — Report 103 solo resume admission

### Reported smell and evidence

Report 103 asks for no `RESUMING...` interruption in a solo match. Its original
message 1557566131907076097 was fetched directly on October 8 at 06:55:32 UTC,
alongside reply 1557566289256644741 and six surrounding messages. Both report
texts are unchanged and unedited. The reply specifically raises rejoining
while other players remain in the lobby. The current authenticated account
is the primary report's author; this latest direction supersedes the August 29
Website-only solo countdown policy above.

The retail 0.72.5 instruction evidence already recorded in this ledger and
entry 236 proves that final suspension release admits the next ordinary
scheduler edge without post-release grace (`0x005CBD40`, `0x00427800`,
`0x005ABF10`). Entry 236 also closes active attachment/reset ownership at
`0x005CDDD0`, `0x005CBA00`, and `0x005CF920`. No new native extraction, authored
table, asset, clock constant, or approximation is needed. The exact source
base for this reopening is `d10aa67ec5e537ad1baca64d9522c609dc7f0805`.

The previous policy generalized every eligible Arena surface and readiness
edge to solo players. The missed distinction is between a required renderer /
recovery handshake and the optional post-handshake two-second reorientation
phase. Removing the label alone would leave the reported interruption intact.

### System boundary and membership inventory

Boundary: run-scoped resume admission, from renderer/recovery readiness or
modal release through deadline creation, projection, input/tick hold, expiry
and teardown. The host counts connected materialized human players in the
specific active run. Party membership, lobby users, spectators, bots and
not-yet-materialized rejoin slots cannot create a multiplayer countdown.
Required absent recovery members still block readiness before this count is
consulted. The existing 2,000-ms phase remains for two or more active humans.

| Member / branch | Recovered contract | Focused implementation disposition |
| --- | --- | --- |
| Solo ordinary/custom/Tutorial entry | Retain pending renderer readiness; all-ready clears directly without a deadline | exact-ported |
| Solo Pause/nested Settings, Inventory and full Skill Screen close | Preserve full native close/owner lifecycle; release directly | exact-ported |
| Solo active save restart and same-tab takeover/rejoin | Preserve run/token restoration, materialization and readiness; skip only the post-ready deadline | exact-ported |
| Shared-host solo run with other humans in Hub or other runs | Run-local human count is one; entry, surfaces and restart/rejoin stay direct | exact-ported |
| Multiplayer fresh ordinary/custom readiness | All required renderers ready before one shared 2,000-ms deadline | verified-already-at-parity |
| Multiplayer Pause/Settings, Inventory/full Skills | Same source-qualified 2,000-ms deadline after final owner release | verified-already-at-parity |
| Multiplayer rejoin, catch-up picker and coordinated restart | Wait for readiness and materialization; required absent members remain required; retain shared countdown | verified-already-at-parity |
| Party-rejoin-wait with last living player absent | Preserve required-player hold even if only one human remains connected | verified-already-at-parity |
| Peer disconnect during pending readiness | Remove only non-required departed receipt; run may resume directly when the remaining solo renderer is ready | exact-ported |
| Peer disconnect during active countdown | Cancel obsolete multiplayer deadline when at most one materialized human remains; clear inputs and no catch-up | exact-ported |
| Compact primary/concentration selectors and final LevelupScreen close | Existing direct selector release and nullable picker-close barrier remain; no new timer | verified-already-at-parity |
| Pause-owner disconnect, stale/duplicate receipts, scene/run retirement | Preserve safe owner release, sequence checks and teardown | verified-already-at-parity |
| Bots, observers, detached slots and lobby players | Not human participants in this run; do not affect countdown admission | out-of-system |
| Hub/title/Create/Game Over/loadout | Separate scene owners; no active-run countdown | out-of-system |

### Ownership and implementation consequence

`game-host.ts` remains the sole owner. `beginRunLoadingResumeGrace` must still
create pending records and collect readiness for every run. Only
`maybeStartGameplayResumeGrace`, after all existing barrier/materialization
checks, may skip the deadline for a solo audience. `beginSurfaceResumeGrace`
applies the same audience rule to timer-producing surfaces while retaining
the human SkillPicker close hold. An existing timed record must retire if its
multiplayer audience shrinks to solo. Input clearing, scheduler reset and
run-scoped broadcasts remain at the same host boundaries. The protocol and
save shapes are unchanged; the client renders the authoritative state and
requires no locally guessed audience or hidden timer.

### Validation contract

Focused M5 tests must cover solo fresh entry, all three modal producers,
restart, same-tab takeover, lobby/other-run isolation, departing peers,
stale-ready rejection and no catch-up. Existing multiplayer renderer,
Pause, modded entry, SkillPicker, detached catch-up and recovery tests remain
positive controls. The maintained browser Pause journey must retain its
multiplayer progress checks and replace solo Pause/restart expectations with
direct release; a progress observer must reject even transient solo bars.
The parent coordinates the exact-tree canonical gate and built-browser
acceptance at the next shared M5 heavy-work boundary. No check is claimed by
this pre-implementation entry.


### Focused M5 implementation acceptance — October 8

Runtime and host-regression source were accepted at `24e38b14`; the browser
fixture's final accepted revision is `7e116af2`. These share byte-identical
runtime/test files. The later commit changes only this receipt. Canonical
validation of the composed candidate, built/live acceptance, publication,
completion reaction and cleanup remain owned by the coordinating report
campaign; none is claimed by this focused receipt.

- M2/M5 SHA-256 manifests matched every changed file before execution. All
  checks ran under the atomic shared heavy lease on M5, with source, temporary
  files, browser profiles and caches on `/Volumes/Drive`.
- The original runtime failed all 11 intentional solo regressions, exposing
  the prior two-second admission policy. The implemented host/recovery/policy
  set then passed 138/138 tests. App and Node TypeScript checks and touched-file
  lint passed. This retains multiplayer initial/modded renderer readiness,
  mandatory SkillPicker, detached catch-up, coordinated private/shared
  recovery, strict source ownership and required-player barriers.
- Chrome 153.0.8010.12 passed the maintained Pause journey. Multiplayer loading,
  Inventory, full Skills, Pause, primary selector and concentration selector
  controls remain accepted. Solo Pause, Inventory, full Skills and saved-run
  restart all release without a timed record or visible progress. A DOM
  observer saw zero transient solo progress bars. Browser page/console,
  failed-response and host-error arrays were empty.
- Measured direct-release tick/wall-time pairs were: primary selector 2 ticks
  in 14.37 ms; concentration selector 3 in 31.54 ms; solo Pause 6 in 314.43 ms;
  solo Inventory 36 in 793.01 ms; solo full Skills 36 in 839.34 ms; solo restart
  1 in 14.20 ms. Each satisfies the existing elapsed-time fixed-tick bound plus
  two ticks, including UI close/controller time; no fixed tick-count cap is
  substituted for elapsed time. Direct admission remains bounded below the
  old two-second grace and every positive solo projection is excluded.
- The fixture initially omitted the protocol's required `enhancedEffects`
  hello field and snapshot receipts. It now supplies the field, reports
  admission rejection immediately, and acknowledges successfully reconstructed
  snapshots. No production wire or recovery semantics changed. A subsequent
  fixed-20-tick sampling assertion was replaced by the existing elapsed-time
  contract, retaining its two-tick tolerance and recording the observed pair.
- Reviewed screenshots show the restored solo Boneyard with no resume bar and
  the intact multiplayer `RESUMING...` control. Their SHA-256 values are
  `10639d1c218fa0ff7080bf48617c97dbc9a15b6dff700eace057d9ed175ccbf0`
  and `ac0c9926e97ca31c7929e326a91ee76708541d9aa5c9dd2f3824f8438aa5de04`.
- Focused test-log SHA-256:
  `50b4a89f21bc6deb4cbd48fc9c29a4ac4e63ae53f315d4d9d5e6d61a85718bb5`.
  Final browser-log SHA-256:
  `8322c1d961fc237e1058f945956b6224ccb8a95a205f07fa89438c3acbb4b9ba`.
  All task browser/host groups stopped and exact-owner lease release completed
  at 07:24:46 UTC. No separate full gate or publication was started.


## October 8 composed canonical acceptance

Runtime/test candidate `cde84b13acd8bd95dfccd153be65bc0a59d0511f` passed the
unchanged complete M5 `scripts/validate.sh` at 07:46:07 UTC: 45 Python tests
and 4,414 Node executions across 22 batches, with no failures, skips or
cancellations. Configured renderer coverage is 100%; mutation acceptance
records 603 killed, 198 compile errors, two nonterminating timeouts, no
survivors, and the existing documented equivalents. Quality failures are empty.

The initial acceptance runner put HOME on an external volume without Unix
ownership, causing two native launchd fixture bootstrap errors. Matching the
maintained worker's real HOME corrected that test setup; source/build/cache/tmp
remained external and temporary test registrations were removed. No volume
security setting, test omission, product change or lowered gate was used.
Later acceptance/investigation edits are documentation only. Normal publication,
managed deployment and scoped live checks remain separate pending steps.

Scope: Report 103 solo resume policy; required multiplayer recovery/readiness remains preserved.
