# Hosted validation budget

The Validate workflow keeps the standard `ubuntu-latest` runner and the exact
all-mode `./scripts/validate.sh` gate. Its job budget is 150 minutes. It does not
use a larger paid runner, split or cache mutation results, skip browser probes,
change source/test scope, or relax thresholds.

## Why 150 minutes

[Validate #631](https://github.com/JarrettOneSource/solomon-dark-website/actions/runs/37996408935)
validated commit `612d57ee863a46aa9cc418679b44c75e53d29c9a`. The hosted job began
at 21:56:33 UTC on October 9, 2026. Mutation began after 11 minutes 6 seconds,
after all four coverage measures reached 100%. Mutation was still progressing
at 374/803 testable mutants when the old 60-minute budget canceled the run.
Stryker reported eight source files and 827 generated mutants. Its final
estimate suggested roughly 115 minutes total, including the prelude. Earlier
runs #626 and #630 also exceeded an hour while making mutation progress.

The 150-minute budget provides headroom over those estimates. Estimates are not
completion guarantees: acceptance still requires the complete gate to finish
successfully on the exact published commit. Incomplete progress reporting zero
survivors is never a passing mutation result.

## Observability and limits

Before validation, the workflow prints an allowlisted resource summary (Node
version, platform, architecture, logical CPUs, available parallelism and memory)
and GNU time version. It does not dump environment variables, credentials or
process command lines. GNU `/usr/bin/time -v` records elapsed time, CPU usage,
peak resident memory and exit status for the validation process. It runs the
existing validator directly and preserves its nonzero exit. Timestamped stage
logs remain the source for per-stage timing; this is not per-stage CPU profiling.

The final, `always()` diagnostic prints source hashes, all generated mutant
counts and statuses, and a canonical inventory SHA-256. Its inventory includes
every file/mutant ID, source hash, location, mutator and replacement, sorted as
canonical JSON independently of report insertion order. Outcomes are counted
separately so different kill/timeout classifications do not change inventory
identity. Compare this digest between completed runs of identical source and
configuration to detect accidental inventory changes. The diagnostic itself
makes no claim that an inventory is complete or a gate passed.

If validation fails before final reports, it explicitly prints that mutation
results are unavailable. A hard job timeout, termination or runner loss may
prevent both GNU time's final record and the `always()` diagnostic from running.
Inspect the terminal job conclusion and final logs. A stale in-progress log
download is not evidence of a hung browser or an idle mutation runner.

All acceptance logic remains in the existing renderer quality gate, including
all eight source modules, five test modules, the real material-browser probe,
100% statement/branch/function/line coverage, TypeScript accuracy checks, and
Stryker high/low/break thresholds of 100.
