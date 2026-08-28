# 2026-08-23 — Staff orb phase, one-shot cadence, and retained-view performance reopening

## Reported smell and parity question

- Reported web behavior: the Staff orb VFX is too large again; Ether may also
  be firing too quickly. A performance pass is required with the correction.
- Stock behavior to recover: the complete event-writer/decay program for the
  single PlayerWizard equipped-element/light phase, exact Cast 1 marker and
  held-repeat timing, every primary/Cast 2 sibling, and the minimum retained
  renderer work required for the native zero/one/two-copy orb program.
- Reproduction inputs/scenes: all five primary elements; ordinary, held, low
  mana, Faster Caster, welded one-shot/Constant, secondary Cast 2, Ether Blast,
  all Staff headings/poses and copy-count thresholds; Hub idle and active
  Boneyard; baseline/held/restored frame measurements on Mac hardware.
- Falsifiers: any active-action boolean repeatedly writes a one-shot pulse; the
  analytic light and orb consume different phase samples; default Ether emits
  more often than every 55 ticks; a hidden retained VFX owner still builds and
  applies a painter plan; or a performance claim lacks controlled before,
  stress, and restoration samples.

This is a secondary report in the same Staff system. The 2026-08-22 submission
count correction correctly removed a nonexistent third painter owner, but it
stopped at downstream call membership. It did not reopen the upstream web
phase writers even though `player-lighting.ts` refreshed `0.15/0.25` from
action occupancy, and it did not reconcile that component with the separate
`primaryCast.weaponPulse` field. The earlier timing pass also copied absolute
capture indices `19/74` and inferred Ether `15/56`, instead of subtracting the
action insertion row. Those skipped owner/timing steps let the corrected copy
count continue drawing an oversized held effect.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail image | unmodified Beta `0.72.5` `SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000`, re-hashed 2026-08-23 | Exact image behind every address and recurrence below. | high |
| Fresh instructions | Ghidra 12.0.3 read-only replica; Cast 1 `0x0044B170/0x0044B370`, progress `0x004486E0`, callback `0x00550180`, admission `0x0052DA80`, decay `0x00548FFC..0x00549012`, Constant `0x0044C600/0x0044C810`, Cast 2 `0x0044B7E0/0x0044B770` | Mode 3 writes `0.15` only on marker callback `0x005502F6`; mode 5 conditionally writes `0.25` at `0x00550317`; the actor field then decays by `0.899999976`. Cast 1 progress is float32 rate `0.075`, marker `1`, strict end `4`; Fire alone applies `0.75`. | high |
| Existing native fixed-tick golden | `Mod Loader/tests/fixtures/webgame/animation-goldens.json`, `idle_cast_idle`, pinned retail hash | Fire insertion `15981`, marker/pose edge `15999`, last occupied row `16053` at progress `4.05000257`, idle `16054`: relative marker `18`, completion `72`, next-ready `73`. | high |
| Supporting runtime write watch | task-owned staged byte-identical Ether PID `2424`, runtime base `0x00960000`; Air PID `2088`, runtime base `0x00460000`; loader-injected read-only `sd.debug.watch_write` | Ether marker runtime `0x00AB02F6` writes `9A 99 19 3E` once, then runtime `0x00AA9012` only decays. A held burst marker-index gaps resolve to `55/55` ticks. Air runtime `0x005B0317` writes `0.25` once, then runtime `0x005A9012` only decays. | high supporting evidence |
| Current web causal trace | Website `origin/main` `a058a90a28ee1e7fa67b31f895d92ebebba7eff0`; `primary-spells.ts`, `player-lighting.ts`, `player-character-presentation.ts`, `game-snapshot.ts`, `hub-actors.ts`, `native-element-vfx-view.ts` | One-shot `weaponPulse` is correct at emission, but the second lighting field refreshes `0.15` for every occupied Ether/Fire tick and `0.25` for every held channel tick. Orb uses their max while analytic light sees only the lighting field. Both retained orb views update even while hidden. Default Ether repeats at 56 ticks. | high |
| User observation | 2026-08-23 report | The remaining pinned phase reads as an oversized orb despite the prior copy-count correction. | authoritative symptom |

No injected-loader observation is treated as clean-stock visual proof. The
instruction stream and pinned native fixed-tick golden own the conclusions;
the watches confirm the live write order and Ether interval.

## System boundary and membership inventory

Native system: **PlayerWizard equipped-element phase plus Cast 1 clock and its
retained renderer consumers**, from action/input admission through event writes,
float32 decay, Staff painter submission, analytic light, replication,
interpolation, hidden-view work, interruption, and teardown.

| Member | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Ether `8` Cast 1 marker/pulse | `0x0044B170`, `0x005502F6`, `0x0053CFE0` | `exact-ported` | phase stays zero through wind-up, becomes `0.15` exactly on emission, then decays without occupancy refresh |
| Fire `16` Cast 1 marker/pulse | shared Cast 1, Fire rate scalar, `0x0053DC60` | `exact-ported` | same edge/decay with Fire timing |
| Welded one-shots `1000,1001,1002,1009` | `0x0052DA80`, Cast 1 modes `3/6/9` | `exact-ported` | table-driven phase/cadence coverage |
| Ether default cadence | float32 `0.075`, marker `1`, strict end `4`; held re-admission | `exact-ported` | first marker update `14`, completion `54`, repeat/next insertion `55`; browser emission gaps `55` |
| Fire default cadence | float32 `0.075*0.75` | `exact-ported` | marker `18`, completion `72`, repeat `73` |
| Faster Caster and class/equipment multipliers | `0x00656580` | `exact-ported` | authored factor matrix agrees with direct float32 recurrence, including neutral through maximum Faster Caster |
| Air `24`, Water `32`, Earth `40` Constant start | modes `5/8/11`, Staff store `0x00550317` | `exact-ported` | one `0.25` start write, then decay while held; no active-level refresh |
| Welded Constant/channel/persistent `1003..1008` | sustained dispatcher and same modes | `exact-ported` | all six profiles share the one start edge |
| ordinary category-2 Cast 2 | modes `4/7/10`; Staff value `0.45` | `exact-ported` | first action update writes once, then decay; all action-owning category-2 rows covered |
| Dampen mode 21 and actionless/toggle-off secondary branches | callback has no matching `0x00550180` case | `verified-already-at-parity` as non-writers | negative matrix; no fabricated phase |
| Ether Blast integer crossings | `0x0054B9C8` | `verified-already-at-parity` writer, `exact-ported` shared consumer | each crossing writes `0.25`; orb and light use the same effective phase |
| fixed-tick decay and zero/reset | `0x00549012`, constructor/reset | `exact-ported` | float32 recurrence and idle/reset tests |
| five element painters | `0x00539B80` dispatch | `verified-already-at-parity` | Ether/Fire/Air/Water/Earth geometry, assets, blend, RNG ranges unchanged |
| Staff selectors and headings/poses/copy thresholds | prior complete submission ledger | `verified-already-at-parity` | zero/one/two-copy census remains unchanged; no scale compensation |
| equipped Wand and empty-hand branches | same phase field, distinct `0.6`/hand geometry | `verified-already-at-parity` phase/light; `out-of-system` for Staff orb raster | writer tests cover modes `6..11`; no Staff node when unarmed/Wand |
| analytic player light | `0x005299A0` | `exact-ported` | consumes the same effective phase as the orb, `(1+phase)*2.6` |
| Hub/Boneyard local and remote players | shared player snapshot/timelines/view | `exact-ported` | Hub remains noncombat/idle; Boneyard pulse round-trip and interpolation agree |
| retained base/overlay VFX views | `PlayerWorldView`, `NativeElementVfxView` | `exact-ported` performance ownership | hidden views allocate/apply no plan; visible native copies retain identical output |
| death, ineligibility, disconnect, world replacement, view destruction | established player/session/view teardown | `verified-already-at-parity` | no stale pulse/view survives owner teardown |

There is no `blocked-by-platform` member. WebGL/Pixi can express the native
event recurrence, copies, assets, blend modes, and retained visibility rules.

## Native ownership thread and recovered behavioral contract

- The action object owns progress and marker delivery. `PlayerWizard` owns one
  `+0x268` phase. Input owns only held level/aim and cannot write visual size.
- On a fixed tick without an event writer, phase becomes
  `float32(previous*0.8999999761581421)`. Cast 1 writes `0.15` once at its
  emission marker; Constant writes `0.25` once at start; Cast 2 writes `0.45`
  once; Ether Blast writes `0.25` at each integer crossing.
- The five-element helper and analytic player light consume that same sample.
  Staff geometry stays scale one. The proven painter transform remains
  `actorScale*(1+10*phase)`; the fix removes a false writer, not the scale.
- Neutral Ether crosses its marker on update 14, crosses strict end on update
  54, remains owned for that completion update, and held input inserts the next
  action on update 55. Current web `15/56` is not too fast; it is one fixed tick
  slower at both the first marker and repeat boundary.
- A retained VFX owner has no update work while invisible. Visibility becoming
  true reuses a same-tick valid plan or builds the current plan before draw;
  native-visible painter membership and order do not change.

## Nearby-system findings

- The analytic-light path currently omits primary `weaponPulse`, while the orb
  merges it with `lighting.overlayEffectPhase`. This disproves the earlier
  claim that both web consumers already shared one replicated phase.
- The previous held-pose UX override remains presentation-only. Correcting the
  action progress thresholds changes marker/repeat timing but does not restore
  stock per-shot pose replay or move projectile sockets.
- Reusable instruction/runtime facts are recorded in Mod Loader
  `native-projectile-and-spell-mechanics.md` and
  `native-lighting-and-shadow-system.md` before implementation.

## Confidence and open questions

- Confirmed: complete direct phase-writer cases, exact values, decay, Cast 1
  recurrence, neutral Ether/Fire insertion-relative clocks, held Ether interval,
  Constant edge behavior, all primary/action siblings, current web causal
  divergence, and retained hidden-view work.
- Inferred: the user-perceived diameter comes from the continuously refreshed
  phase; the browser pixel/time feedback loop must falsify or confirm that
  before the implementation receipt is closed.
- Unknown: none material. Clean-stock appearance remains represented by the
  already pinned painter/assets and captures; timing and writer ownership are
  instruction/golden facts and are not inferred from pixels.

## Web implementation consequence

- Stop deriving phase writes from action occupancy. Keep event writes and one
  float32 decay clock; make the orb and analytic light consume the same
  effective replicated sample.
- Correct Cast 1 marker/ready thresholds from absolute capture indices to
  insertion-relative native progress while retaining the explicit held-pose UX
  override and all projectile/audio/gameplay owners.
- Keep the exact five painter plans, Staff scale formula, copy census, sockets,
  and render order unchanged.
- Make `NativeElementVfxView.update` a no-op while its retained container is
  invisible, so hidden copies do not build arrays or touch sprites.
- Repair the existing primary-spell browser wrapper's Lua WASM configuration,
  then add a controlled baseline/held/restoration measurement rather than
  calling source inspection a performance result.

## Validation contract

- Focused red/green: one-shot wind-up has phase/scale `0/1`; emission writes
  `0.15/2.5`; subsequent ticks follow exact float32 decay without refresh.
  Constant writes `0.25` once; Cast 2 writes `0.45` once; Ether Blast and every
  direct sibling have explicit assertions; orb/light phase values agree.
- Cadence: neutral Ether marker/repeat `14/55`, Fire `18/73`; all authored
  Faster Caster factors compare against a direct float32 recurrence oracle;
  held emission gaps remain exact after the pose override.
- Renderer: a hidden view allocates/applies no painter plan, all five visible
  elements still materialize their exact operation count, zero/one/two-copy
  diagnostics remain correct, and teardown destroys every retained sprite.
- Mac Chrome at 1600x900: capture wind-up, emission peak, decay below the
  `0.10000000149011612` extra-copy threshold, at least three Ether emissions,
  release/restoration, WebGL identity, phase/scale/light/copy diagnostics, and
  empty page/console/failed-response arrays.
- Performance on the same Mac candidate: controlled idle baseline, held-Ether
  stress, and post-release restoration with p95/p99/max presentation gaps,
  long tasks, browser task time, visible/updated orb counts, and unchanged
  scene population. Compare the same journey on the exact pre-fix base.
- Run the affected focused suites and `/opt/homebrew/bin/bash
  ./scripts/validate.sh` on the exact rebased Mac tree; run the complete Mod
  Loader static RE suite for the durable reports.

## Implementation validation receipt

- The authoritative primary clock now writes `0.25` once on every pure/welded
  Constant start, retains the existing `0.15` Cast 1 and `0.25` Ether Blast
  edges, and decays by the exact float32 factor without any action-occupancy
  refresh. The complete category-2 matrix reports the first Cast 2 action
  update and writes `0.45`; Dampen and every actionless branch remain negative
  members. Snapshot projection gives the orb and analytic light the same
  effective phase, and both presentation timelines interpolate only that
  numeric phase while retaining discrete light/action ownership.
- Cast 1 now uses insertion-relative native progress boundaries. Neutral Ether
  emits on update `14`, completes on `54`, and re-admits at `55`; Fire uses
  `18/72/73`. A direct float32 oracle covers every authored Faster Caster
  factor from `1` through `2`, all four welded one-shots, all six welded
  Constant profiles, release/re-press, the held-pose product override, and
  exact projectile sockets. Ether was not too fast: the pre-fix host cadence
  was `56` ticks, one tick slower than stock.
- `NativeElementVfxView` now returns before plan creation or sprite mutation
  while its retained container is hidden. The focused renderer matrix covers
  Ether, Fire, Air, Water, and Earth; the existing zero/one/two-copy painter
  census, assets, scales, blend modes, sockets, and teardown are unchanged.
- The canonical red run on the pre-fix current-main tree failed the new Cast 2
  pulse seam (`staffCastPulsePlayerIds` absent) while the other `257/259`
  tests in that first group passed. Log SHA-256 is
  `d5fcf799b9887cf2533f983506e2f2a303ff086b286412839d2fca41466f607f`.
- Final Website validation rebased over spectator-current `origin/main`
  `e462cba704558800b6c51a7b3f359106e7d18f36`. Candidate
  `ece642d6bc9649dd5f8e336eb33f48196a369d43`, tree
  `32cf4db428a408bdbf2320853bed811a07fa2ab7`, and its detached Mac worktree
  had a byte-identical 23-file manifest with aggregate SHA-256
  `b67214e6e382bfeb5251cd85a6e16511c3067006830b5656576e5cbdc3008374`.
  `/opt/homebrew/bin/bash ./scripts/validate.sh` passed 21 backend contracts,
  zero-warning/error backend build, formatting, lint/import boundaries,
  frontend/desktop groups `9/4/45/260/1472/6/61/9/63/12/7/36/33/5`,
  production builds, media policy, and bundle budget (`448703` raw / `125817`
  gzip bytes). Log SHA-256 is
  `6eebf83b51a8ed5fd579e91b0b8bea5964a3a1727d916aa32fb75304afacb4f0bd`.
- Final Mac Chrome `151.0.7922.170` used WebGL2 through
  `ANGLE (Apple, ANGLE Metal Renderer: Apple M2)`, crossed the authored Gate,
  completed Solomon combat admission, held four Ether emissions, and returned
  exact observed gaps `55/55/55`. Wind-up scale fell from pre-fix
  `2.3500001430511475` to `1`; the minimum inter-shot scale fell from the same
  pinned `2.3500001430511475` to `1.0065745115280151`; final restored scale was
  `1.0000035762786865`. Orb and analytic-light peaks shared the same phase,
  release settled to action `-1`/pose `0`, and page/console/HTTP error arrays
  were empty. Browser-log SHA-256 is
  `d83d066a09d9339606b910c8d6fdc72d4ada463ef4373be4dfeeea851767d300`.
- The same-base `e462cba7` A/B used identical 800/1600/800 ms
  baseline/held/restoration windows and the same deterministic frozen-wave
  fixture. Both sustained approximately 60 FPS with zero long tasks. Browser
  main-thread task time changed from `177.41/394.83/178.70 ms` to
  `163.32/373.43/166.61 ms`, reductions of about `7.9%/5.4%/6.8%` for the
  three phases. Frame-gap percentiles were load-noisy rather than uniformly
  better (held p95 `20.2 -> 22.1 ms`, p99 `22.9 -> 23.8 ms`), so this receipt
  claims reduced hidden-view CPU work and no FPS/long-task regression, not a
  universal latency improvement. Base/final log SHA-256 values are
  `40f7c04e32a3f5eafe88801f7a44fc2463a1727d916aa32fb75304afacb4f0bd`
  and `d83d066a09d9339606b910c8d6fdc72d4ada463ef4373be4dfeeea851767d300`.
- Reviewed same-base held/base, final held-pulse, and final held-decay captures
  hash to `63afff05aaf83b933e8b90ee6f0afe8dab4fd2faa7412800f4b2f037dbb540ae`,
  `f96dbf474e386a1f61502c5bb6382b056866ada6181e01194d543fb17a64d418`,
  and `1ea73a348187ef43040145511d8a363f4e2a8ab771d879776cdd0e9eacd2097c`.
  The decay capture visibly restores the compact Staff orb between missiles.
- Mod Loader base `af637b41a8b1f6e0e3f0e80eea2a93af69b4bcb2`, candidate
  `5a60f108566e85922886a58a2ce3098c8f7e7108`, tree
  `a98c447839ca00a302b24500999f9e0740006d03`, and its Mac worktree had a
  byte-identical four-file manifest with aggregate SHA-256
  `70aa82b239098a1c63b219b2743d592c43aabc9d8e6468fa86d013e52f43fabf`.
  The complete CI-safe static RE suite passed `499/499`; log SHA-256 is
  `6f8a59c6e362a5ba1c58b23959a1396bc6cac03b0685cac2ff9e37535b1d0a9c`.
  No member is browser-blocked and no material unknown remains. Publication to
  `main` is authorized; deployment/restart remains separate and was not
  requested.
