# Game renderer validation ownership

The Website maintains the TypeScript/Pixi game at `/game` and embeds the
independently built Rust game at `/game-rust`. Its complete gate is
`/opt/homebrew/bin/bash ./scripts/validate.sh` on the Mac mini. The gate includes
the Pixi renderer's scoped coverage, complexity, mutation and GPU checks,
alongside the shared editor, authoring shelf, frontend and backend checks.
`frontend/tools/quality/scope.mjs` defines the renderer scope; its results do not
claim coverage of every Website module.

Mutation runs use the same Node tests and GPU assertions as the complete renderer
checks. Compact batch and shader-reuse checks run before the material samples,
with atlas, authored-source and other broad asset probes after the focused
renderer checks. This catches mutations that repeatedly rebuild shaders before
that defect makes hundreds of later draws expensive. Material samples are also
validated as they are produced while a mutant is active. A detected failure
stops the remaining GPU work; all cases and assertions remain in the unmutated
coverage and browser run.
The existing Stryker event recorder writes each completed mutant to
`frontend/reports/renderer-quality/mutation/events`, retaining individual results
if a hosted job is interrupted before its final report. The source scope and
100% thresholds are unchanged.

The Rust repository owns its renderer, native/WASM checks, desktop packages and
browser/GPU acceptance. A Website artifact hash check verifies the supplied
Rust payload's identity; it does not replace those Rust checks. Each maintained
client also requires actual browser acceptance for affected game behavior.
