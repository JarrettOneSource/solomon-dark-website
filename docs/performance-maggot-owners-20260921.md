# Coffin/Maggot owner-index performance work — September 21, 2026

Baseline: `bfa35bd3dcc2f39a5141d873d2c34d975a7d84f6`.

Evidence archive (read-only):
`/Users/jarrett/codex-acceptance/solomon-evidence-6a583nbx/eleventh-free-mana-20260921/archive-d6991d9e-9a9d-4e41-9222-663ecff5097b.json`.
SHA-256: `d26cb663f7b1fabcde801b0e3d8626557cbd8bbef2768b820a45fb0d80ddd0d5`.

## Scope and causal model

`stepMaggots` currently performs a full `work.actors` scan for every Maggot's
owner-validity check and repeats that scan when an emerging child lands and
enters admission. The archived worst tick has 146 actors and 801 Maggots. The
largest saved last-alive checkpoint has 277 actors and 2,140 Maggots. Both
states have zero orphaned children, so population reduction or cleanup is not
an acceptable optimization.

The candidate replaces only those repeated scans with one method-local index
of the current live Coffins. The index is constructed after the store's actor
loop and its pre-Maggot materialization, immediately before ordered child
stepping. It is discarded before later manager/wave admission and store
finalization. Insert-if-absent preserves the old first-match result even for a
defensive duplicate actor ID.

No child emission, population cap, admission/tombstone count, RNG draw,
movement, damage, attack, hit feedback, animation, event, retirement, actor ID,
cell-binding, save/checkpoint, protocol, or renderer rule is changed. Normal,
MANYMAGGOTS, STRONGMAGGOTS, and combined Coffin configurations continue to use
their current immutable owner row.

## Ordering audit

The unpaused enemy-store order at the baseline is:

1. step ordinary actors in array order and splice terminal rows;
2. materialize actor-owned pending intents;
3. step Maggots in existing child order;
4. apply child cell rebind order;
5. step remaining projectile/silk/boss lanes;
6. resolve and materialize manager/wave spawn intents;
7. finalize the store.

The index belongs wholly inside step 3. Thus an owner that dies, changes away
from Coffin, or retires in step 1 is absent; an actor present by step 2 is
visible; and a later Coffin admitted in step 6 cannot retroactively rescue an
invalid child. Paused steps do not construct an index. Load, run replacement,
and reset cannot retain stale membership because no index is stored.

## Correctness and measurement contract

Focused regression coverage must prove:

- exact retained/retired child order and all semantic events;
- all emerging, inactive, active, and dying lanes;
- landing admission below/at the 20 and 50 active caps, the 30-inactive ceiling,
  and unchanged 1-in-5 RNG position;
- base, MANYMAGGOTS, STRONGMAGGOTS, and combined owner configurations;
- same-step death, non-Coffin conversion, terminal removal, post-manager spawn,
  duplicate-ID first-match behavior, and per-step reset/rebuild;
- state and RNG equality between baseline and candidate.

The external benchmark must use an isolated `git archive` of baseline
`bfa35bd3`, not a reconstructed old function. It must compare the archive's
worst tick and both last-alive player checkpoints plus generated owner-head,
owner-tail, missing/converted-owner, and admission-heavy workloads. Output must
include full state SHA-256, gameplay RNG, steering RNG, process CPU time, wall
time, sampled allocation, and retained heap. Warmup and alternating fresh
processes are required. No result in this document is a speedup claim until
that command has been run and its JSON receipt retained.

## Parent-owned commands and receipt

Run these sequentially on the Mac from the shared candidate tree:

```sh
cd /Users/jarrett/codex-acceptance/solomon-perf-6a583nbx/frontend
/opt/homebrew/bin/node --experimental-strip-types --test src/game/core-server/boneyard-enemy-store.test.ts
/opt/homebrew/bin/node ./node_modules/typescript/bin/tsc -p tsconfig.test.json --noEmit

cd /Users/jarrett/codex-acceptance/solomon-perf-6a583nbx
/opt/homebrew/bin/bash ./scripts/validate.sh

/opt/homebrew/bin/node --expose-gc --experimental-strip-types \
  /Users/jarrett/codex-acceptance/solomon-fixes-6a583nbx/benchmark-maggot-owner-index.mjs \
  > /Users/jarrett/codex-acceptance/solomon-fixes-6a583nbx/maggot-owner-benchmark.json
```

The focused test includes a proxy-backed complexity regression: 256 children
with 128 ordinary actors must cause exactly 128 indexed actor reads, not one
actor-array traversal per child. Behavioral cases cover the four Coffin flag
styles, first-match duplicate IDs, every child lane after an owner changes to a
non-Coffin actor, owner death/removal through the pre-existing regression, and
post-manager spawn followed by next-step index rebuild.

The external benchmark creates a temporary isolated baseline with `git archive`,
symlinks only the candidate dependency directory, and removes that
temporary directory when complete. It runs baseline and candidate in fresh,
alternating processes. The default receipt includes three captured full ticks,
three captured Maggot-only passes, owner-head, owner-tail, missing-owner,
converted-owner, the four-style/64-owner matrix, and a 64-owner landing-
admission workload. It aborts before summarizing if any complete output hash,
input hash, or RNG hash differs.

The parent owns sequential execution and retention of the JSON receipt. This
worker ran none of the commands and makes no speedup, allocation, or validation
claim.
