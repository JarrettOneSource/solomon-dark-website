# 2026-08-24 — Level-transition VFX visibility and complete offer-cap correction

## Reported smell and parity question

- Reported web behavior: level-up VFX appear not to work, and low-level skill
  pickers appear to omit much of the native skill/subskill membership.
- Stock behavior to recover: the complete local threshold transition—actor
  sound/sparkle/light, visible 40-tick screen reveal, all 72 authored offer
  rows, exact prerequisites and unlocks, offer-cap retirement, pool weighting,
  apply, queued handoff, and teardown.
- Reproduction inputs/scenes: a cold first picker in the Courtyard, a later
  Boneyard picker, every element/discipline root, category-0 dependency rows,
  rows at `mCapLevel - 1`, `mCapLevel`, and `mMaxLevel`, ordinary/Creativity
  three/four-card screens, queued choices, and a shared barrier.
- Falsifiers: live particles with no visible screen envelope implicate separate
  owners; equal `mCapLevel/mMaxLevel` on every row would falsify cap crowding;
  a second native subskill source would falsify the one-scan model; or a native
  screen tick before construction/attachment would justify the web cold-load
  clock.

This is a secondary report against a system previously marked closed. The
earlier pass skipped two required rules: it did not compare the implementation's
eligibility ceiling with every authored catalog row, and browser acceptance
recorded `earlyRevealObserved` without requiring it to be true. The prior
claim that the complete visible transition and offer membership were already
at parity is reopened and superseded here.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail image | Beta 0.72.5 `SolomonDark.exe`, preferred base `0x00400000`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` | Canonical analyzed image; identity rechecked on 2026-08-24 | high |
| Fresh instructions | read-only replica decompiles of offer builder `0x0067CB70`, eligibility `0x0065EBA0/0x0065ED00`, dependency/unlock `0x0065E830`, learned-prune `0x0066F840`, choice apply `0x00660320`, screen constructor/tick/render `0x00658620/0x0066F920/0x0067DF80` | Ordinary eligibility compares permanent rank with property-object `+0x58` (`mCapLevel`); apply clamps at `+0x5C` (`mMaxLevel`); actor and screen clocks are separate; attached screen owns all 40 visible reveal ticks | high |
| Authored data | Mod Loader `native-skill-catalog.json`, SHA-256 `7f1f777f738ed3fc1089a3c4f06ef0b8935cd2a3bc1b0fbcc671a0baff0e775b`; `progression-goldens.json`, SHA-256 `14693bbad7d1e1f62003c1380abe658a5f24c7a9863cab8048ed184166337f46` | 72 public rows `8..79`; 62 have `mCapLevel != mMaxLevel`; exact minimum/root/category/dependency matrix remains unchanged | high |
| Current Website trace | clean current-main revision `0d95bc27d9a9d71a80c96f9881969041f4adb6ac`; `player-progression.ts`, `SkillPicker.tsx`, `level-up-presentation.ts`, and world renderers | ordinary `isEligible` incorrectly tests `maximumLevel`; the picker subscription starts reveal time before asynchronous WebGL/atlas construction completes | high |
| Mac baseline | macOS 26.6.2, Chrome 151.0.7922.174/WebGL2, clean detached current main; `smoke:game:skill-picker` | actor lane reached 47 live Hub particles with presentation ID 1 and all audio/error checks passed, but the cold screen reported `earlyRevealObserved:false` and first appeared settled | high-live |
| Stock/browser frames | stock 1600x900 `skill-picker.png`, SHA-256 `96fa5827e56de2a274b44eb9e6ccc10ad6da27fe973c946d76febbb9f7612556`; Mac baseline reveal/settled/Boneyard frames | baseline hashes `dc5b01eff2519ff15c0cf7608f81b2d4ddbaa68f277307aaff385e367c1ab8c6`, `a98c017b918713df9d123c0dc0941ecbe26a32b06e9b78508d6b07732dc29523`, and `5bca7c80e7297ca30a9ac9b3391bcd188f0bacf2e85b85de3fe6ef91c8fa94e6`; actor sparkle pixels exist, while the separately owned screen reveal is skipped | high-live |

## System boundary and membership inventory

Native system: the local level transition from the first crossed XP threshold
through actor presentation, authoritative offer construction/application, all
queued choices, barrier release, and final screen/particle teardown.

| Member (complete IDs/branch) | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Primary rows `8,16,24,32,40` | common `8..81` scan; category 1 | exact-ported | per-row offer-cap matrix and primary collision tests |
| Spell Welding row `52` and builds `1000..1009` | special injection inside `0x0067CB70` | verified-already-at-parity | cadence, learned-pair, active-build, icon, and apply tests |
| Category-0 subskills `9,10,17,18,22,25,26,28,33,34,38,39,42,43,53,55,56,64,75` | common scan plus `0x0065E830` all/any/unlock predicates | exact-ported | all 19 rows eligible at their exact dependency/minimum boundary and retired at cap |
| Category-2 rows `11,12,15,21,23,27,30,35,41,45,46,48,49,50,51,54,72,73,74,76,77,78,79` | common scan, focus, and affordability lanes | exact-ported | all 23 cap rows plus root/general mana-rank asymmetry |
| Category-3 rows `57,58,59,60,61,62,63,65,66,67,68,69,70,71` | common scan; discipline roots | exact-ported | all 14 cap rows; Creativity three/four-card branch |
| Category-4 rows `13,14,19,20,29,31,36,37,44,47` | common scan plus forbidden/collision gates | exact-ported | all 10 cap rows and permanent one-per-offer collision |
| Rows whose cap already equals max `15,39,51,52,53,55,60,63,66,68` | authored cap/max table | verified-already-at-parity | same-field census keeps them unchanged |
| Remaining 62 public rows with distinct cap/max | authored cap/max table; `0x0065ED00` | exact-ported | ordinary offers stop at cap; direct grants, Mindstar, and Insight retain max |
| Runtime Plane Orb 80, reserved 81, allocated reserve 82, roots 0..7 | constructor/runtime rows outside ordinary public scan | out-of-system (not ordinary offer members) | never appear in ordinary offer output |
| Three-choice / Creativity four-choice pools | desired-count branch | exact-ported | both counts and every phase share the cap predicate |
| Root-priority/general pools, focus, affordability, forced prefix, Welding injection, learned prune, attempts 100/200, final shuffle | `0x0067CB70` | verified-already-at-parity except shared cap predicate corrected here | phase/regression matrix |
| Ordinary actor threshold sound | `0x005C88B0 -> 0x00528A20` | verified-already-at-parity | one rate/gain-one entry-52 request per barrier |
| BadGuys-73 sparkle births/tails | `0x00533520`, `0x00453980/0x00453A30/0x00458230` | verified-already-at-parity | 180 births, five RNG lanes, 36–60 tick tails, visible pixels |
| Player light-radius pulse | `0x005299A0 -> 0x00580130` | verified-already-at-parity in the implemented Boneyard light owner; no separate Hub light claim is introduced | analytic/raster radius diagnostics in the owning scene |
| Cold and warm initial `LevelupScreen` reveal; three/four-card variants | `0x00658620/0x0066F920/0x0067DF80` | exact-ported | first paint is noninteractive and the visible envelope spans 40 ticks |
| Queued offer rebuild | close, `unlockskill`, 10-tick hidden content | verified-already-at-parity | no second threshold/reveal replay |
| Forced picker `0x0067C320` | screen without `0x005C88B0` | verified-already-at-parity boundary; no Website producer | future producer cannot synthesize actor VFX |
| Hub/private-room/Boneyard local owner, shared participant, waiting peer, late join, bot/non-local | actor-local mode plus host barrier | verified-already-at-parity | only an owned local offer arms actor/screen presentation once |
| Sorceror reroll/save, focus, apply, close, and teardown | complete `LevelupScreen` action family | verified-already-at-parity | existing action/audio/authority tests remain green |
| Optional Mindblowing Ring burst | `0x005C88B0 -> 0x0052A220` feature `0x400` | verified-already-at-parity in the separate equipment/secondary actor system | existing burst/shockwave/audio/light coverage |

No member is blocked by the browser platform. Asynchronous renderer
construction is a lifecycle seam to synchronize, not a reason to omit native
visible time.

## Native ownership thread and recovered behavioral contract

- One award invocation arms one actor-local sound and 180-tick effect after all
  crossed levels, while each crossed level queues a choice at the final current
  level. Queued offers do not rearm the threshold lane.
- `LevelupScreen` owns a separate alpha lane. Construction initializes alpha
  zero and direction `+1`; attached ticks advance by `0.025` every 10 ms,
  clamp to `[0,1]`, and render curtain `0.5*a`, ambient `0.1*a`, and
  panel/content `a^3`. Input remains closed until `a == 1`.
- Browser GPU/atlas loading is construction, not native tick time. A
  presentation-frame callback before `createSkillPickerRenderer()` resolves
  must not consume reveal ticks. Once attached, cold and warm paths follow the
  same 40-tick envelope.
- Ordinary row eligibility ends at permanent rank `mCapLevel`. `mMaxLevel`
  remains the ceiling for choice apply, direct grants, effective ranks,
  Mindstar, and Creativity Insight. The fields cannot be collapsed.
- Category-0 rows are not sourced from a special subskill list. They enter the
  common scan after their exact any/all predicate, level, root/general, focus,
  and cap gates. Fixing the shared predicate retires stale repeat weights for
  every affected family at once.
- RNG order, with-replacement candidate weighting plus unique result insertion, native general-pool
  `mana_cost(skill, playerLevel+1)` oddity, root-priority
  `mana_cost(skill,effectiveRank+1)`, and all authority/lifecycle branches stay
  unchanged.

## Nearby-system findings

- The PlayerActor sparkle lane is not missing on current main; the Mac
  baseline observed 47 live particles. The visible defect is the independently
  owned screen reveal, so rearming or amplifying actor particles would duplicate
  native behavior.
- Existing browser smoke observed but did not require either the early reveal
  or a positive particle count. Those optional observations allowed the prior
  parity claim to survive the exact user-visible failure.
- The Mod Loader's `native-progression-and-skills.md` eligibility wording is
  corrected from “maximum” to “offer cap,” and `skill-picker-re.md` now records
  the asynchronous renderer consequence.

## Confidence and open questions

- Confirmed: executable identity; property-object offsets; all 72 cap/max rows;
  complete category/dependency membership; screen construction/tick/render
  ownership; current Website source fault; and clean Mac reproduction.
- Inferred: the user's “VFX not working” refers to the skipped screen envelope;
  the independent actor particles are live and remain covered explicitly.
- Unknown: none material inside the recovered system.

## Web implementation consequence

- Keep the picker presentation subscription inert until the WebGL renderer is
  ready; start `revealStartedAt` on the first paintable frame, not React mount.
  Do not delay or rearm the independent barrier-keyed actor effect.
- Replace only ordinary eligibility's `maximumLevel` comparison with
  `capLevel`. Keep every apply, grant, Mindstar, and Insight use of maximum.
- Expose the native common offer predicate as the focused kernel seam used by
  the builder and per-row regression; do not create a second eligibility table.
- Turn the existing browser observations into gates: require a cold early
  reveal, live Hub and Boneyard particles, visible WebGL frames, and empty
  page/console/network arrays.

## Validation contract

- Focused tests: all 72 public rows stop at cap; all 19 category-0 subskills
  pass at exact prerequisite/minimum boundaries; the 62 distinct cap/max rows
  remain distinct; direct grants and Insight/max behavior remain.
- Presentation tests: renderer-not-ready time cannot advance opening alpha;
  cold and warm mounts expose intermediate alpha/input states; queued rebuild
  remains settled; actor presentation identity never rearms from offer changes.
- Mac browser: cold first Hub and Boneyard pickers must observe early
  noninteractive reveal, intermediate alpha, positive actor particles, exact
  audio/action lifecycle, visible retained worlds, and empty error arrays.
- Full gates: Website `/opt/homebrew/bin/bash ./scripts/validate.sh` and Mod
  Loader `python3 tests/re/run_static_re_tests.py --ci` on manifest-identical
  Mac trees.

## Implementation validation receipt

- `SkillPicker.tsx` now leaves its presentation-frame subscription inert until
  `createSkillPickerRenderer()` has returned a paintable WebGL canvas. The
  first attached frame owns alpha zero and starts the native 40-tick clock;
  queued rebuilds, close directions, actor VFX identity, and audio edges remain
  unchanged.
- `player-progression.ts` exposes one common native offer predicate and uses
  `capLevel` only in that predicate. Initial root/general assembly, Welding
  adjacency, and attempt-100 fallback all consume it. Choice apply, direct
  grants, Mindstar, Revelation, and Creativity Insight continue to use
  `maximumLevel`.
- Regression coverage drains all 72 public rows, distinguishes all 62 unequal
  cap/max pairs, exercises the 19 category-0 subskills at their exact
  dependency/minimum edge, proves direct grants can still reach `mMaxLevel`,
  and makes renderer readiness plus positive Hub/Boneyard particles mandatory
  browser observations rather than optional diagnostics.
- The exact Website candidate was rebased over current-main Tutorial commit
  `993758a2de8bd8a7f7342f05c53024ec034691a4`; its six-file manifest matched
  the local task tree byte-for-byte on macOS 26.6.2.
  `/opt/homebrew/bin/bash ./scripts/validate.sh` passed the backend
  build and `22/22` contracts, formatting/lint/import boundaries, `1517/1517`
  broad game/Boneyard tests, `13/13` level-up tests, every remaining frontend
  and desktop suite, production builds, media policy, and bundle budget.
  `Game-9oPO4JDu.js` is 464,489 raw / 130,331 gzip bytes against 524,288 /
  131,072.
- The companion Mod Loader two-file manifest matched task commit
  `9d518f04` over base `4ac69a4e`; its registered Mac static-RE suite passed
  `500/500`.
- Chrome `151.0.7922.174`/WebGL2 at 1600 x 900 observed both cold initial
  reveals: Hub sampled alpha `0`, intermediate `0.025..0.975`, then `1`;
  Boneyard sampled alpha `0`, intermediate `0.05..0.975`, then `1`. The
  independent actor lane reached 48 Hub and 44 Boneyard particles with the
  expected presentation identities. The world remained live-rendered and
  authority stayed on one frozen tick during selection.
- Browser audio retained level-up rates `[1,1]`, open-panel rates
  `[1,0.75,0.75,0.75,1,0.75,0.75]`, unlock-skill rates `[1,1,1]`, and
  positive master gain for all 19 picker lifecycle requests. Page, console,
  and failed-response arrays were empty. Reveal/settled/Boneyard frame hashes
  are `0063197603a4de21f357b75c762d6d13fdc674b8233503f4e9e03126c9131468`,
  `da29e856f309ebec499a9ea969a44faefa88971e6bddfc013e332177d3820aee`,
  and `acd1b92360702b4024979be452086c4a80303361eb8eece540a5bbf4bc167101`.
- No member is browser-blocked and no material unknown remains. Publication
  and deployment are separate from this validation receipt.
