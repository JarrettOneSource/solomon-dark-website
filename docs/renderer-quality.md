# Game renderer validation ownership

The Website maintains the TypeScript/Pixi game at `/game` and embeds the
independently built Rust game at `/game-rust`. Its complete gate is
`/opt/homebrew/bin/bash ./scripts/validate.sh` on the Mac mini. The gate includes
the Pixi renderer's scoped coverage, complexity, mutation and GPU checks,
alongside the shared editor, authoring shelf, frontend and backend checks.
`frontend/tools/quality/scope.mjs` defines the renderer scope; its results do not
claim coverage of every Website module.

The Rust repository owns its renderer, native/WASM checks, desktop packages and
browser/GPU acceptance. A Website artifact hash check verifies the supplied
Rust payload's identity; it does not replace those Rust checks. Each maintained
client also requires actual browser acceptance for affected game behavior.
