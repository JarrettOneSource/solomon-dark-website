# 2026-08-22 — Full Game Over screen, Solomon Riff, and selectable post-run loadout

## Reported smell and parity question

- Reported web behavior: terminal death does not pop the recognizable Game
  Over screen with Solomon facing the player; post-Game-Over progression must lead
  back to a loadout picker where spell element and discipline can be chosen
  again.
- Stock behavior to recover: the complete `GameOver` family, including both
  visual branches, `Solomon_Riff`, narration/music/stream ownership, input and
  unattended continuation, fade teardown, and the next Create generation.
- Reproduction inputs/scenes: die as the final eligible player in a Boneyard;
  observe entry, hold, visual/audio actors, click and no-click exits, then
  choose the same and different element/discipline pairs. Repeat with a party
  so one participant cannot silently select another participant's loadout.
- Falsifiable questions: whether the Riff actor belongs to Game Over; whether
  `DeathGuitar__Stream` begins at player death; whether normal glyphs are one
  combined image; whether Boneyard acceptance owns the requested screen;
  whether retained Create choices are merely preselected or locked; and
  whether one party leader may confirm every member's choice.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail artifact | 4,723,200-byte `SolomonDark.exe`, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` | Same Beta 0.72.5 executable as the prior terminal lifecycle pass. | high |
| Fresh read-only instructions | `GameOver` constructor/render/tick/input `0x005CAD40` / `0x005C9030` / `0x005CF4F0` / `0x005C7910`; `Solomon_Riff` constructor/init/tick/render `0x004756C0` / `0x0047F480` / `0x004756F0` / `0x004A15E0` | Normal Game Over owns the Riff actor, normal glyphs, prompt, click exit, unattended Riff-completion exit, and delayed guitar stream. | high |
| Xref census | read-only Ghidra references to `0x004756C0`, `0x005CAD40`, and vtable `0x00786364` | `Solomon_Riff` has exactly the generic type-5019 factory and `GameOver` as constructor callers; `GameOver` has exactly `Game_OnGameOver` as constructor caller. | high |
| Authored data | stock `GameOver.png/.bundle`, SHA-256 `30c07de43c04b4b843ae85b52443d48087259cbd99992bbfaaa2f704d4884443` / `680d1503b42d0108b66dca28cdd5adc4d8de532a1d133eed730d70aa78881889`; `SolomonRiff.png/.bundle`, SHA-256 `944808bf6aa04acaa11e89535032754aecd04989962a7b198b512de1af2c36f4` / `387599fc560937de0ba27f1006c73e1ebe5eba8e384ba4d967636543fd570ac4` | GameOver records 0/1 are the separate `GAME` and `OVER` images; record 2 is dormant. Riff records 1..12 are fully extracted 200-by-200 rows; the actual writer selects 1..5 and 7..12, skipping record 6. | high |
| Audio data | `SAY_SOLOMON_LAUGHBIG1.wav` SHA-256 `579e3f1ba524644c50cb371ef481bf8960cca34f1eb6fcd694ce350889eee42b`; `DeathGuitar__Stream.wav` SHA-256 `67423fcd66ff8fba55acfb09f4dedb495754bfb962a90dc7ba1cbc0c28e353e8` | Constructor queues the huge laugh; only the normal Riff tick plays Death Guitar, at counter 550. | high |
| Clean/native captures | `/mnt/d/codex-evidence/suite-audit-20260725/live-wan/lifecycle/post-match/host-game-over.png` and the committed 1600-by-900 `game-over` menu golden | Normal mode places GAME at center Y minus 175, OVER at center Y plus 125, and the bitmap prompt at height minus 50 over the retained world. | high |

The reusable corrected native facts are recorded in Mod Loader
`native-game-over-session-semantics.md` and `native-audio-events.md` before
this Website implementation.

## System boundary and membership inventory

Native system: `GameOver` construction through post-run Create confirmation,
including every renderer/audio/actor/input branch and the party loadout barrier.

| Member (class/variant/scene/branch) | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| all-dead run/event authority, retained Arena, entry fade | existing host lifecycle plus `0x005CB570`, `0x005C9030` | verified-already-at-parity | existing run/protocol/death coverage; retained world remains mounted |
| ordinary HUD, quickbar, loot notices, spectator text, chat, and touch controls | `GameOver` application surface over sealed `Game+0x1ABD/+0x1ABE` controls | exact-ported | browser asserts all ordinary gameplay chrome is absent throughout Game Over |
| normal `GAME` and `OVER` records | `GameOver.0/.1`, renderer `0x005C9030` | exact-ported | separate hash-pinned assets and presentation assertions |
| normal Fonts-group-3 `CLICK TO CONTINUE...` | `0x005C91A7..0x005C92AC`, Fonts `216..307` | exact-ported | bitmap glyph layout and tick-alpha assertions |
| `GameOver.2` placeholder | bundle record 2, no consumer | out-of-system: stock-dormant | complete builder/consumer census |
| normal click acceptance and 20-tick exit | input `0x005C7910`, tick `0x005CF721..0x005CF751` | exact-ported | run/event-scoped protocol and lifecycle tests |
| normal unattended acceptance and 250-tick exit | Riff gate `0x005CF5EE..0x005CF650`, slow exit `0x005CF729` | exact-ported | tick-951 and complete-exit assertions |
| Boneyard fade-only tick-1000/400-tick sibling | mode branch `0x0081A434`, tick `0x005CF66C..0x005CF71F` | out-of-system: explicit request selects the normal full screen | retained as native sibling truth in the ledger and Mod Loader report |
| `Solomon_Riff` hidden/entry hop | type 5019 init/tick `0x0047F480` / `0x004756F0` | exact-ported | ticks 200/201, all motion constants, landing position tests |
| `Solomon_Riff` frame phases | tick `0x0047583D..0x00475988`, render `0x004A15E0` | exact-ported | records 1..5 and 7..12 plus every boundary tick covered |
| `SolomonRiff.0` placeholder and program-skipped record 6 | bundle rows 0/6; no reachable Game Over selection | out-of-system: stock-dormant in this program | complete record census and writer simulation |
| common huge laugh and immediate death song | constructor `0x005CAE3D..0x005CAFB9` | exact-ported | once-per-event audio synchronizer and exact source hashes |
| Boneyard-only queued `ANOTHERCORPSE` line | constructor `0x005CAE83..0x005CAECD` | out-of-system: selected visual/audio branch is normal Game Over | branch-specific instruction proof |
| normal Riff tick-550 Death Guitar | tick `0x004757CB..0x004757DD` | exact-ported | removed from individual death; crossing test at 549/550 |
| normal Mortuary/Hall/MainMenu destination | completion `0x005CF7EB..0x005CF8A4` | out-of-system: established Website direct-Create product route | runtime phase remains `loadout`, not title/front end |
| Create element/discipline preselection | `0x005A7F60`, `Create+0x1A4/+0x22C` | exact-ported | previous pair supplies semantic default focus |
| same/different post-run element and discipline | stock Create controls and per-participant owner | exact-ported | every choice remains interactive; submitted pair updates only that player |
| multiplayer loadout barrier and disconnect | local Create owners plus retained lobby | exact-ported | each current party member confirms once; final confirmation merges party; disconnect cannot strand the barrier |
| fresh post-Game-Over skill/progression generation | `0x005D0290`, `0x006594E0`, `0x00674EE0` | exact-ported by the superseding 2026-08-26 correction | selected roots and starting pair are rebuilt at rank 1; prior level/XP, learned ranks/order, offers, selections, and quickbar are discarded |

There are no `blocked-by-platform` members. The Website intentionally combines
the stock normal Game Over presentation/input owner with its established direct
Create destination; this does not claim retail Boneyard mode draws the normal
screen.

## Native ownership thread

- Owner and construction path: final eligible death -> host/run event ->
  `Game_OnGameOver 0x005CB570` -> `GameOver 0x005CAD40`; the normal constructor
  creates and registers `Solomon_Riff` in the retained world.
- Upstream state producers/callers: authoritative eligible/alive membership,
  run nonce, monotonic Game Over event, local player render anchor, GameOver
  tick, and participant-local continuation activation.
- State representation and transitions: entry/title/prompt alphas plus
  `(exitKind, exitTicks)`; Riff counter/visible/position/vertical velocity/frame
  phase; then per-participant loadout-ready membership.
- Downstream consumers/callees: fixed-stage GameOver compositor, retained world
  renderer, stream/music director, server input validator, post-run Hub player
  entity store, and Create renderer/control tree.
- Sibling systems sharing ownership or data: fade-only Boneyard GameOver,
  normal Mortuary/Hall lineage, Fonts group 3, narration queue, type factory
  5019, party membership/disconnect, save deletion, and new-run reset.
- Entry, interruption, reset, and teardown: entering Game Over blocks gameplay
  and clears the resumable save; input or fallback begins an exact exit; the
  fully black following tick retires Boneyard state into Create; every current
  party member confirms one pair; the final confirmation merges the same party
  into shared Hub with run-scoped actors/audio removed.

## Recovered behavioral contract

- Timing/ticks/thresholds: entry black subtracts `0.025` for 40 ticks; title
  and prompt start at `-1.5` / `-2` and add `0.005`; input opens at tick 500;
  clicked exit adds `0.05` for 20 ticks. Riff appears at tick 201, uses hop
  `x += 4.4`, `y += vy`, `vy += 0.125` from `y=-5, vy=-4`, plays guitar at
  550, changes frame phase after 820 and 920, and makes unattended acceptance
  eligible at 951; that exit adds `0.004` for 250 ticks.
- Geometry/transforms/coordinate spaces: title and prompt remain viewport-fixed.
  Riff copies the local player's projected anchor, begins 375 world units left,
  consumes native 200-by-200 registration cells, and scales with world-camera
  zoom rather than UI scale.
- Render/hit/collision/traversal order: retained world -> Riff -> entry black ->
  title/OVER/prompt -> exit black. The full overlay is the semantic activation
  target only after tick 500. Riff is presentation-only during frozen Game Over
  and does not enter collision or target selection. Ordinary gameplay HUD,
  notices, chat, spectator UI, and touch controls are not members of the
  application-level Game Over compositor.
- Assets/audio/randomness: all asset rows are enumerated above. The program has
  no random branch. Huge laugh and death song are GameOver-entry edges; Death
  Guitar belongs only to the tick-550 Riff crossing.
- Input/network authority/replication: a client submits run ID/event ID for
  continuation and its own selected element/discipline for loadout. The server
  validates phase, identity, membership, one-shot readiness, and exact enum
  values. It never accepts a client-selected config for another player.
- Boundary and failure behavior: stale/replayed continuation is rejected;
  unattended progression prevents a stuck screen; duplicate loadout submission
  is rejected; departed members are removed from the barrier; the completed run
  remains non-resumable throughout Game Over/loadout.

## Nearby-system findings

- The earlier audio ledger and Website connected `0x004757DD` to individual
  player death. That address is inside `Solomon_Riff::Tick`; playing Death
  Guitar at every death epoch was a falsified ownership assumption and is
  removed everywhere in this pass.
- The current retained Create implementation visually preselected the prior
  pair by entering the discipline phase immediately, then disabled every other
  discipline and every element. Native preselection is a focus/default, not a
  lock. The post-run screen must reopen the element phase and allow a fresh
  pair.
- One host-only confirmation cannot represent participant-local Create owners.
  The party run remains in loadout until each connected member has submitted
  exactly one own-player pair.

## Confidence and open questions

- Confirmed: constructor/xref ownership; every GameOver and SolomonRiff record;
  render order; all alpha, motion, frame, input, fallback, and exit constants;
  audio call sites/assets; direct-Create product boundary; participant-local
  native Create selections.
- Inferred: the Website projects the copied native player render anchor through
  its current Boneyard camera. This is the existing world-coordinate equivalent
  of the native actor fields, not a guessed viewport-center placement.
- Unknown: none material. Browser audio decode latency does not change event
  identity or native-tick ownership.

## Web implementation consequence

- Correct owner/module: `game-over-presentation` owns the complete pure visual
  program; `GameOverOverlay` owns semantic activation; the run kernel and host
  own replicated continuation/loadout readiness; Create owns choice UI; the
  audio synchronizer owns once-only entry and tick-550 streams.
- Shared model change: add explicit clicked/automatic exit kind and
  participant-ready membership; carry selected element/discipline in the
  confirm message; update only the submitting player's character config,
  selected roots, active primary, starter secondary, and first quickbar slot.
- Stock behavior preserved: exact normal screen, Riff, clocks, input/fallback,
  player-owned choice, retained party/session, and clean run teardown.
- Browser-specific approximation: none.
- Symptom patch or obsolete path to remove: fade-only empty overlay,
  tick-1000-only web acceptance, individual-death guitar playback, host-only
  locked retained selection, and same-loadout-only confirmation.

## Validation contract

- Focused automated test: every title/prompt/fade boundary; Riff visibility,
  hop, landing, all frame phases, every selected row, explicit record-6 absence,
  tick-550 audio crossing, clicked and
  unattended exits, stale continuation rejection, per-player changed pairs,
  all-ready barrier, replay rejection, and disconnect completion.
- Playwright or runtime journey: trigger organic final death, capture Riff
  entry/settled/final poses plus the full title and prompt, click Continue,
  select a different element and discipline, reach shared Hub, start another
  Boneyard, and prove the new config with no page/console/wire errors. Party
  coverage submits distinct pairs from two real clients before Hub return.
- Stock-versus-web comparison: use the exact 1600-by-900 native coordinates,
  authored pixels, 100 Hz clock samples, and matching retained-world phase.
- Measurable acceptance criteria: no title before tick 301; input at 500;
  separate 307-by-119 and 306-by-120 art; visible Riff after 200 with record
  indices 1..5 and 7..12 with record 6 absent; no guitar before 550 and one at
  550; 20-tick clicked
  fade or 250-tick fallback fade; changed element/discipline in the returned
  authoritative player snapshot; no party return before all current members
  confirm.

## Implementation validation receipt

- The Website implementation now uses exact extracted GameOver records 0/1,
  Fonts group 3, the twelve-cell SolomonRiff sheet, the recovered normal-mode
  fixed-tick program, run/event-scoped continuation, and protocol 57
  participant-owned loadout submissions. Ordinary gameplay chrome is absent
  while the application-level surface owns presentation. Selecting a new pair
  updates only that player's config, element/discipline roots, active primary,
  starter secondary, and quickbar slot zero while retaining the explicitly
  requested learned-progression deviation.
- Jarrett's arm64 Mac mini ran macOS `26.6.2`, Node `22.17.0`, npm `10.9.2`,
  .NET `10.0.302`, Homebrew Python `3.12.13`, and Chrome `151.0.7922.170` on
  the physical machine. Its complete canonical Website gate passed backend
  contracts, every frontend and desktop group, backend build/formatting,
  lint/import boundaries, production frontend/game-host builds, media policy,
  and bundle budgets. The same Mac ran the Mod Loader's complete CI-safe
  native suite under Homebrew Python 3.12 with `491/491` passing.
- The strict two-context Mac journey organically entered spectator death,
  sampled all four corpse frames for both deaths, reached all-dead Game Over,
  and returned both participants to the same Hub. At Game Over tick `501`, the
  DOM measured separate `307 x 119` and `306 x 120` title records, title alpha
  `1`, prompt alpha `0.505`, and Solomon Riff record `5`; no HUD or chat
  remained. Host input sampled clicked exit tick `3/20` at alpha `0.15`.
  Both Create owners were independently enabled, selected Water/Mind and
  Earth/Body, and the returned Hub contained both players with those distinct
  authoritative configs. Both browser contexts had empty page and console
  error arrays.
- Inspected Mac captures under
  `/Users/jarrett/codex-acceptance/game-over-loadout-20260822.xbhQot/browser/`
  are `solomon-dark-multiplayer-game-over.png` (SHA-256
  `b427b0956ceff9440630689049eff29545ab70545cde08fd12ed5571aa3f953e`),
  `solomon-dark-multiplayer-loadout.png`
  (`b16e2d4efda548201a149153d22a2e3f228052069d260ed21129911f6f9940f0`),
  and `solomon-dark-multiplayer-returned-hub.png`
  (`90b12bc386e02126cbec8f590447315d3330f35f0e9fbd93b75a1eccab35ce59`).
- No member is browser-platform blocked and no material unknown remains. The
  focused commits are approved for publication to `main`; deployment remains
  a separate operation and is not part of this receipt.
