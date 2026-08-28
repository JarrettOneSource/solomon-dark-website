# 2026-08-20 — Deployed revision title label

## Product intent and stock boundary

- This is an intentional web-product deviation, not a newly recovered retail
  behavior. Retail's extracted `V.0.72BETA` raster remains checked in as source
  evidence, but it is no longer part of the web runtime asset manifest.
- The existing native top-right version stage remains the geometry and screen-
  edge owner. Its runtime content is `BUILD ` followed by the first eight
  uppercase hexadecimal characters of the exact frontend build commit.
- The full 40-character revision is exposed on the title canvas as
  `data-build-revision`; the visible short form is identification chrome, not
  an independent version source.

## Ownership contract

- `deploy-main.sh` resolves and checks out one exact `origin/main` commit and
  passes that same revision into the canonical validation/build invocation.
- `vite.config.ts` independently resolves the checkout commit, rejects an
  invalid or mismatched deployment revision, and injects the verified value
  into the static bundle. The browser never asks current `main` or a mutable API
  what is deployed.
- `title-build-revision.ts` owns formatting and native bitmap-glyph layout.
  `title-menu-renderer.ts` owns only rendering that label in the retained
  top-right stage with the Hub HUD font atlas and retail gold tint.

## Validation contract

- Focused tests pin full-SHA validation, eight-character display formatting,
  the maximum 103-pixel painted width inside the stock 104-pixel slot, runtime
  removal of the beta raster, deployment SHA forwarding, and the Vite
  checkout-mismatch guard.
- The exact tree must pass `./scripts/validate.sh`. A real Chromium title-menu
  check must observe the expected visible label, the matching full canvas SHA,
  the native font-atlas source, and no page or console errors.

## Implementation validation receipt

- The implementation tree based on `d278ff8` passed `./scripts/validate.sh`
  with that full revision supplied through `SDR_BUILD_REVISION`: 24 backend and
  contract tests, 40 loot tests, 143 prerequisite tests, 988 broad frontend
  tests, five level-up tests, six diagnostics tests, 14 Hub UI tests, and five
  desktop tests. Formatting, lint, import boundaries, both production builds,
  the Game bundle budget (`209000` raw / `61338` gzip bytes), and production
  media policy passed.
- A separate production-build probe supplied an all-zero revision and failed
  before transformation because it did not match checkout `d278ff8`, proving
  that deployment cannot stamp an unrelated commit onto the bundle.
- Chrome `150.0.7871.124` loaded the production `/game` title at 1600 by 900.
  The visible top-right label was `BUILD D278FF88`; the canvas reported the
  matching full revision, loaded the Hub font atlas, did not load the beta
  version raster, presented frames, and produced no page or console errors.
  The settled receipt is `/tmp/solomon-dark-build-revision-title.png`.
