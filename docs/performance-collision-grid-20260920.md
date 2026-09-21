# Boneyard root collision grid — 2026-09-20

The first two-client endurance attempt reached wave 17 before the test fixture's lifetime Lua-error guard stopped it. Host load also rose for a separate, real reason: the final state contained 113 ordinary enemy actors and 617 Coffin-owned Maggots. The Boneyard root motion solver scanned every body during each recursive push, although the shared solver already supports an ordered spatial index.

This change activates the existing `DynamicActorGrid(64)` at the `resolveActorMotion` call in `frontend/src/game/core-server/boneyard-world.ts`. The runtime change consists of one import and replacing the existing `undefined` fourth argument. All other optimizations in the performance candidate are present in both measured variants.

## Population and behavior contract

All 617 Maggots have live Coffin owners. Each of the 12 Coffins has 20 active and 30 inactive crawling children; 17 more children are emerging. The oldest is 17.42 seconds old. This is a bounded population under the existing native admission policy, not evidence of retained orphan actors. The admission cap, parent-loss retirement, and exclusion of Maggots from wave thresholds are documented in [native entry 254](<Game Native Parity RE/254-2026-08-27-coffin-maggot-retirement-zombie-composition-and-skill-acquisition-reseed-reopening.md>) and covered by enemy-store tests.

The solver rebuilds its fresh index from cloned body rows before movement, updates membership after world moves and accepted corrections, and consumes candidates in ascending source index. Recursive queries copy the index's reusable result buffer and refresh after membership changes. The caller's pair predicate is pure and its observer reports actual root contacts. Skipping disjoint cells therefore preserves the prior separation equations, source order, push epochs, and contact sequence. [Native entry 040](<Game Native Parity RE/040-2026-08-14-dynamic-actor-grid-ownership-and-ordering.md>) explicitly retains existing web source order for this broadphase cutover.

The patch preserves every root call, including zero displacement. In the archived final tick, two idle player roots still produce 186 recursive recipient moves. Maggot admission, lifetimes, collision bodies, damage, timing, and native ordering remain unchanged. The index lives only for this synchronous solver call and is not serialized or retained by a run.

## Measured work

A diagnostic instrumented replay of the same 733-body tick recorded:

| Work counter | All pairs | Existing grid |
| --- | ---: | ---: |
| Root moves, both zero displacement | 2 | 2 |
| Recursive attempts | 355 | 355 |
| Recursive recipient moves | 186 | 186 |
| Pair visits | 137,804 | 5,968 |
| Overlapping pairs | 355 | 355 |
| Separate unpushed-mover calls | 208 | 208 |
| Separate unpushed-mover pair visits | 152,464 | 152,464 |

Root pair visits decrease 95.7%. The baseline count includes one self-index visit per movement before the existing immediate skip; the grid skips the same self index before calling the pair resolver. This small counting difference does not explain the reduction. Full next-state JSON hashes match for both instrumented paths and both uninstrumented paths.

The separate unpushed-mover loop remains outside this patch. A short preliminary CPU profile identified the root solver as the largest single direct world-step subtree, approximately 758 ms across 200 repeated heavy ticks. That diagnostic competed with the earlier validation gate and is not used as the speedup baseline.

## Matched replay results

Node 22.17.0 ran four sequential processes in baseline/candidate/candidate/baseline order on the Mac mini, after root confirmed the previous validation workers were stopped. Unrelated machine work remained active. The temporary loader changes only the new index argument back to `undefined` for the baseline; the unused import remains in both variants. Source and effective-source hashes are in the [raw receipt](performance-collision-grid-20260920.json).

Heavy is the actual final tick 112880, with 113 enemy actors and 617 Maggots. Historical worst tick is the actual archived checkpoint at tick 28296, with 29 skeletons and no Maggots. Empty derives from that checkpoint by removing enemy/transient arrays and disabling wave spawning. These measure core simulation only: the pilot's zero incoming-damage extension is retained, while Lua dispatch, replication, network, and browser work are excluded.

| Variant | State | Ticks | Mean ms | p95 ms | p99 ms | Max ms | Process CPU ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline 1 | heavy | 200 | 6.981 | 7.759 | 10.885 | 16.099 | 1952.9 |
| baseline 1 | historical worst tick | 40 | 35.571 | 36.042 | 36.235 | 36.235 | 1488.4 |
| baseline 1 | empty | 40 | 0.405 | 0.528 | 1.140 | 1.140 | 40.9 |
| candidate 1 | heavy | 200 | 5.385 | 5.867 | 6.762 | 14.228 | 1492.3 |
| candidate 1 | historical worst tick | 40 | 33.143 | 35.069 | 40.025 | 40.025 | 1381.8 |
| candidate 1 | empty | 40 | 0.384 | 0.506 | 0.947 | 0.947 | 33.6 |
| candidate 2 | heavy | 200 | 6.506 | 9.984 | 12.136 | 18.553 | 2039.6 |
| candidate 2 | historical worst tick | 40 | 36.760 | 41.916 | 51.199 | 51.199 | 1573.8 |
| candidate 2 | empty | 40 | 0.412 | 0.572 | 0.971 | 0.971 | 42.5 |
| baseline 2 | heavy | 200 | 10.233 | 13.968 | 15.526 | 17.646 | 2616.2 |
| baseline 2 | historical worst tick | 40 | 47.003 | 63.509 | 64.257 | 64.257 | 1977.3 |
| baseline 2 | empty | 40 | 0.422 | 0.578 | 1.415 | 1.415 | 46.3 |

Across the two heavy trials, mean process CPU falls from 2284.5 to 1765.9 ms (22.7%). Mean tick duration falls from 8.607 to 5.946 ms (30.9%). Machine load varied materially between trials; the exact candidate-count reduction and identical output are stronger evidence than any single wall-clock percentage. Both heavy comparisons favor the index. The empty-state checks show no observed setup regression, but their 40-tick samples cannot establish a precise tiny-overhead bound.

The low-population checkpoint deliberately preserves the original worst tick. Its repeated core work remains 33–47 ms per tick across variants; this is an isolated expensive archived state, not a normal low-population throughput estimate. An initial oversized combined trial requested 600 repeats of this state, exceeded 45 seconds, and was killed; it produced no accepted measurement. The bounded 40-iteration replacement completed.

## Verification and remaining scope

- All three next-state hashes match across all four trials. Input-state hashes remain unchanged. The heavy next-state hash is `8d3fc9f87b424e472c2183dc2b8a0933195d6f104ae85fed39f5ad5d1a170d1b`.
- Fixed-input forward replays through ticks 112905 and 112930 match complete ordered JSON hashes across all variants. The final hash is `e7f4bb78041454d28f7153985a8e3d96ae7e6720087237c31f6ec574cb414741`.
- Actor-physics and Boneyard-world suites pass 49/49. The added 614-body differential covers two idle roots, 12 Coffins, 600 passive children, three translations across cell boundaries, blocked corrections, recursive motion, ordered contacts, and input ownership. Existing seeded crowd and edge tests continue to pass.
- `node node_modules/typescript/bin/tsc -p tsconfig.test.json --noEmit` exits 0.
- The root-owned complete `./scripts/validate.sh` gate restarted as `job_20260920T161105Z_905b72e39b` at 16:11:05 UTC and is still running at this handoff. That gate and the fresh two-client wave 100 endurance run remain required. No long-session completion is claimed by this focused replay.

Raw profile, per-trial receipts, population archive, and diagnostic candidate counts remain under `/tmp/solomon-party-wave100-6a583nbx`. The temporary repeatable harnesses are `/tmp/solomon-heavy-grid-benchmark-6a583nbx.mjs`, `/tmp/solomon-heavy-collision-counts-6a583nbx.mjs`, and `/tmp/solomon-heavy-collision-grid-counts-6a583nbx.mjs`. No production service was restarted or modified for this investigation.
