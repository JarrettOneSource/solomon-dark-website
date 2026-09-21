# Boneyard runtime allocation measurements — 2026-09-20

The measured server workload uses **68.2% less process CPU** and
**72.9% less elapsed time** after three allocation fixes.
All complete-state and ordered-JSON hashes match the baseline at twelve
checkpoints and at the final tick. These are deterministic two-player server
measurements through wave 9, separate from the Windows/Mac wave-100 browser soak.

Baseline: `fb9ec4bf9486e0fac5f76e9648c043614bb4d373`. Machine: the M2 Mac mini, Node 22.17.0.
The [machine-readable receipt](performance-light-query-20260920.json) retains
all four raw reports, identical checkpoint hashes, source hashes, and the counting
probe result. Integrated build/soak acceptance belongs to
[the wave-100 receipt](performance-wave100-20260920.md).

## Findings and changes

1. **Death-effect copying:** the baseline CPU profile attributed 21.56 seconds
   of approximately 61 seconds to `cloneDeathEffect`. Two optional metadata
   spreads at the start of its large object literal had placed ordinary effects
   back on V8's expensive spread path. The common copy now has no spreads. When
   `painterSortBias` or `scrapOscillation` is present, the uncommon path restores
   their original prefix order before the unchanged required fields. Zero values,
   absence, optional data, source immutability, and serialized key order remain
   covered by regression checks.
2. **Authored scenery projection:** the same profile attributed approximately
   17.91 seconds to repeated immutable scenery-row spreads in
   `boneyardWorldSceneryTargets`. A WeakMap now reuses that projection by its
   authored target table. Arena cleanup and save normalization replace the table
   when its contents change; all audited consumers read these target rows.
   Every call still returns a fresh mutable result array, and Goodies are
   projected from current state. Weak keys let retired table projections be
   collected with their worlds. Tests prime the cache before arena cleanup and
   cover replacement tables, current Goodie positions, and retained older output.
3. **Optional light sampling:** the spell-contact phase and snapshot projection
   eagerly built full light fields even when their only consumers, silk-fragment
   lighting and Spider presentation, did not sample them. A 200-tick counting
   probe with two players and 40 starting Skeletons recorded 200 unused
   spell-contact fields and 40 unused snapshot fields. The 200 world-step fields
   still supply enemy visibility and remain eager. The new sampler captures
   world, player, enemy, spell, and tick values immediately and copies the
   environment envelope; it builds one field only on the first sample. Combat
   operations replace their state records instead of mutating those captured
   sources. This preserves the exact original phase even if later local
   variables or environment properties are reassigned. The regression compares
   eager/lazy output, checks no build before use, one build across multiple
   positions, and phase preservation after an environment property changes.

The light counting probe transformed a module only in memory and did not change
production source. Its instrumentation overhead is not a timing result. The
named CPU profile identifies where to optimize; its numbers are separate from
the unprofiled comparisons below.

## Matched measurements

Both versions ran the existing `frontend/tools/benchmark-boneyard-runtime.mjs`
for 62,500 ticks, seed 1372610135, generated Arena 0, and a checkpoint every
5,000 ticks. The fixture uses Ether/Body and Water/Mind players, suppresses
player damage, and resolves skill offers with the existing deterministic chooser.
It reached wave 9, with 83 live enemies and 425 dynamic actors at peak.

The order was baseline, candidate, candidate, baseline in separate Node processes.
One temporary loader was applied to both versions to measure `process.cpuUsage`
immediately around the existing loop. For baseline runs only, it substituted the
five original modules, whose bytes were checked against the baseline Git revision.
The candidate source did not need to be reverted. CPU is user plus system time,
including Node/V8 worker activity; elapsed time is wall time around the loop.

| Run | Elapsed seconds | CPU seconds | Mean tick ms | Tick p99 ms |
| --- | ---: | ---: | ---: | ---: |
| baseline-cpu-1 | 66.295 | 72.703 | 1.050 | 2.595 |
| candidate-cpu-1 | 18.414 | 23.752 | 0.284 | 0.939 |
| candidate-cpu-2 | 19.155 | 24.294 | 0.296 | 1.018 |
| baseline-cpu-2 | 72.295 | 78.148 | 1.145 | 2.933 |

Across the two samples per build, mean process CPU changed from 75.425 to
24.023 seconds, and elapsed time from 69.295 to 18.784 seconds.
The mean tick measurement changed from 1.097 to
0.290 ms. Both candidate p99 values
were near one millisecond. All runs still had isolated maximum tick times near
45 ms; this does not claim every tick stays below the 10 ms simulation budget.

Task-owned browser/host shakeouts were stopped for these four samples. Existing
OSRS/Clash compilation and analysis processes belonging to other sessions were
left running, so the Mac was not idle. The reversed run order, process CPU
measurement, and repeated outcome reduce that source of uncertainty but do not
establish results for every machine or concurrent server load. Earlier overlapping
browser/benchmark timings were inconsistent and are excluded from the improvement
claim.

## Correctness and acceptance

All four repeated runs match at ticks 5,000 through 60,000. Final tick 62,500:

- Complete-state hash: `66e4ff66b63abdc1`.
- Ordered JSON hash and serialized character count: `7ef46f08eea6b59c:695322`.

The focused server regressions reported 57 passes, zero failures, and zero skips.
They supplement the supported repository gate, `./scripts/validate.sh`, and do
not replace it. Canonical gate status and the two-device long-session outcome
are recorded separately in the integrated receipt. No gameplay cadence, RNG
sequence, collision rule, damage formula, wave schedule, or wire schema changed.

This note does not claim an unbounded memory leak, GPU/FPS improvement, production
deployment, or completion of the wave-100 soak. The separate renderer change
releases uniquely owned mesh geometry and buffers at effect retirement; its
resource ownership evidence is independent of these server timings.
