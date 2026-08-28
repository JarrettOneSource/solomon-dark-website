# 2026-08-15 — Mobile ally-roster readability scale

## Reported smell and parity question

- Reported web behavior: ally health rows at the left edge of the HUD are too
  small to read on a phone, especially the exact participant names.
- Requested behavior: make the ally bar and name presentation approximately
  100 percent larger on mobile while retaining the recovered row model.
- Reproduction surface: the supported `844 x 390` coarse-pointer landscape
  viewport in Hub and Boneyard, with at least two remote participant rows.
- Falsifiers: changing participant identity/health ownership, replacing the
  stock bitmap font with a system font, changing desktop geometry, scaling only
  the bar or only the name, disturbing the account/skull stack, merging fixed
  HUD rows with world nameplates, or exposing the landscape game in portrait
  would disprove the implementation model.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Preserved retail binary | `SolomonDarkAbandonware/SolomonDark.exe`, reverified 2026-08-15 as 4,723,200 bytes and SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` | The stock reference remains the unmodified 0.72.5 32-bit executable. This browser adaptation introduces no new native address or runtime claim. | high |
| Clean-stock receipt | `/mnt/d/codex-evidence/uire-20260806/hud-crops/20260806T115705Z/two-participant-ally-bar.png`, 1600 x 900, SHA-256 `529a6f7fec4d973bada2140d57d542428d7e6eb4d25df5b152b7b2c69a8c7fe9` | Confirms the intentionally compact fixed-screen ally lane at the stock backbuffer. | high |
| Existing instruction report | Mod Loader `docs/reverse-engineering/native-ally-roster-hud-2026-08-14.md`; append `0x005CF480`, shared renderer `0x005D2520`, player producer call `0x0052D2A4`, Golem producer call `0x00617804` | Producers own eligibility, identity, and unsmoothed health ratio; the shared consumer owns the 50 x 5 bar, two-pixel identity gap, seven-pixel font lane, colors, and 10-pixel pitch. | high |
| Current Website causal trace | `AllyHud.tsx`, `ally-hud.ts`, `GameHud.tsx`, `hub.css`, `renderer/game-viewport.ts`, and `smoke-game-runtime.mjs` at `2851914` | Snapshot-derived rows are correct. The complete `hub-native-frame`/`boneyard-native-frame`, including the stock-sized roster, is uniformly reduced on small viewports. The sole coarse-pointer HUD rule scales only the loadout. | high |
| Existing mobile viewport receipt | 2026-08-13 responsive-game receipt at `844 x 390` | The supported landscape policy uses logical `1947.6923 x 900` and display scale `390 / 900 = 0.4333333`; portrait remains behind the rotate gate. | high |

No reusable native-system fact was recovered in this pass, so the Mod Loader
report/catalog does not receive a duplicate mobile-browser policy entry.

## Causal trace

```text
authoritative snapshot
  -> derivePlayerAllyHudRows (identity + health ratio)
  -> AllyHudRoster (shared semantic row list)
  -> stock-sized row CSS inside the scene's logical HUD frame
  -> fixedGameViewportLayout display transform
  -> physical phone pixels
```

At the stock `1600 x 900` identity viewport, the 50 x 5 bar and roughly
6.5-to-7-pixel bitmap glyphs paint at their authored size. At `844 x 390`, the
outer frame scale is `0.4333333`, so the same bar becomes approximately
`21.67 x 2.17` physical pixels and a 6.5-pixel glyph becomes approximately
`2.82` physical pixels high. The unreadable name is therefore not bad player
data, font extraction, kerning, health math, or scene lifecycle. It is the
predictable composition of intentionally compact stock geometry with the
Website's uniform small-screen viewport reduction.

## Adjacency sweep and ownership boundaries

- Upstream participant membership, display names, progression health, stable
  ordering, self exclusion, disconnect removal, and Hub/Boneyard retention
  remain owned by the existing snapshot selector. Responsive presentation must
  not add a copied roster store or media-dependent game state.
- Downstream `AllyHudRoster` is the one shared fixed-screen consumer for player
  and future Golem rows. Magnifying this root preserves bar/name proportions,
  ratio clipping, bitmap registration, kerning, row order, and row pitch as one
  coherent surface.
- The account line at logical `(11,44)` owns Website identity; the ally roster
  begins at `(11,62)`. Scaling from the roster's top-left origin leaves the
  account, skull `(11,7,31 x 33)`, and diagnostics `(50,12)` unchanged.
- World-space participant labels follow actors and the camera. They are not a
  mobile replacement for the fixed ally list and receive no change.
- Local health/mana, inventory, map, touch joysticks, and future Golem producer
  state are sibling systems. None owns ally readability.
- The coarse-pointer landscape path already owns mobile touch presentation.
  The explicit portrait orientation boundary remains intact.
- Lifecycle is unchanged: rows enter/update/leave with authoritative snapshots;
  scene teardown removes the HUD; a Hub/Boneyard transition reconstructs the
  same presentation from the durable roster.

## Recovered browser contract

- Desktop and fine-pointer presentation remains the recovered stock-sized
  Website row: 50 x 5 bar, two-pixel internal identity gap, 10-pixel pitch,
  exact Fonts group-6 masks, and existing top-left anchor.
- On the supported coarse-pointer path, magnify the complete roster by exactly
  `2`. This makes the bar, bitmap name, Golem art, internal gap, clipping lane,
  and pitch 100 percent larger together without changing their logical model.
- Use a top-left transform origin. The anchor remains below the account/skull
  stack and growth proceeds only rightward/downward.
- At `844 x 390`, acceptance dimensions are approximately `43.33 x 4.33`
  physical pixels for the full bar and `8.67` physical pixels for row pitch.
  A 6.5-pixel glyph becomes approximately `5.63` physical pixels high.
- Keep the complete participant name as the accessible row label. Do not add a
  text fallback, substitute font, abbreviation, minimum-health fiction, or
  per-name exception.

## Confidence and explicit unknowns

- Confirmed: native producer/consumer ownership, stock row internals, current
  web snapshot flow, the mobile viewport scale, the absence of a responsive
  ally rule, and the independent account/skull/diagnostic/world-label lanes.
- Designed browser policy: exact `2x` coarse-pointer roster magnification. This
  is the requested accessibility deviation, not a claim about retail mobile
  behavior.
- Unknown but non-material: no physical-phone Safari/Chrome receipt is
  available in this Linux pass. Chrome mobile emulation can prove CSS media,
  geometry, names, scene continuity, and errors, but not physical panel
  sharpness. A real-device visual check can refine a later declared mobile
  support matrix without changing ownership.

## Web implementation consequence

- Correct owner: the `.hub-hud-allies` presentation root in `hub.css`, shared
  by Hub and Boneyard through `GameHud`/`AllyHudRoster`.
- Add one mobile coarse-pointer scale policy at that root with top-left origin.
  Do not branch `AllyHud` state, duplicate row dimensions, or alter protocol,
  simulation, renderer, font assets, account layout, or Mod Loader code.
- Retain the exact desktop identity case and remove no native geometry.

## Pre-implementation validation contract

1. Extend the existing multiplayer ally browser journey so one real client is
   an `844 x 390`, touch-enabled, mobile/coarse-pointer page.
2. Before the behavior change, preserve a failing receipt showing the mobile
   bar near `21.67 x 2.17`, row pitch near `4.33`, and the exact remote names.
3. After the behavior change, the same page must report scale `2`, a full bar
   near `43.33 x 4.33`, row pitch near `8.67`, nonempty native glyphs, exact
   names/health ratios/colors, and no overlap with the account line.
4. The desktop clients must retain the current 50 x 5 bar, two-pixel gap, and
   10-pixel pitch. The mobile row must remain present after Hub-to-Boneyard
   transition when exercised by the shared scene owner.
5. Capture and inspect a mobile Hub screenshot. Record page and console errors.
6. Run focused ally/viewport tests and the repository's sole full gate,
   `./scripts/validate.sh`, on the exact final tree.

## Preserved pre-implementation failure receipt

The extended three-client Playwright journey ran against unchanged `hub.css`
at `2851914` and failed exactly at the new mobile scale assertion. The third
client was Chrome 150 at `844 x 390` with `hasTouch: true` and `isMobile: true`.
Its coarse-pointer query matched, viewport scale was `0.4333333333`, and both
remote rows were semantically correct: names `Helvidius`, IDs `player-1` and
`player-2`, full health ratio `1`, nine native glyph spans each, pink bar fill,
and gold identity masks. The failing geometry was:

- roster scale `1`, bounds `(4.7667,26.8667,78 x 8.6667)`;
- each bar/fill `21.6667 x 2.1667` physical pixels;
- identity lane start `27.3000`, preserving the expected unscaled internal gap;
- row bounds/pitch `4.3333` physical pixels; and
- skull `(4.7667,3.0333,13.4333 x 14.3000)`, confirming the shared outer
  viewport transform rather than a page zoom anomaly.

The inspected baseline is
`/tmp/solomon-dark-mobile-ally-baseline-ally-mobile-hub.png`, 844 x 390,
SHA-256 `6e6785c4d51e83c6920e86b379ea979a905974c4da8913292cbbb8109a4c3b40`.
The rows are visible as tiny colored marks at the upper left, while their names
cannot be read from the full mobile frame. The browser closed through the
harness `finally` path immediately after the expected `1 !== 2` assertion; no
post-change or Boneyard claim is taken from this red run.

## Implementation validation receipt

Implementation is intentionally one presentation rule in `hub.css`: under the
existing `(hover: none) and (pointer: coarse)` mobile policy,
`.hub-hud-allies` now uses `transform: scale(2)` with `transform-origin: top
left`. No React state, snapshot selector, ratio math, font data, protocol,
simulation, renderer, account layout, asset, or Mod Loader file changed.

`smoke-game-runtime.mjs` now retains its existing two fine-pointer desktop
clients while making the temporary third participant a touch-enabled mobile
client at `844 x 390`. Its ally receipt records the CSS presentation scale,
scene viewport scale, media-query match, exact row identities, physical bounds,
colors, ratios, glyph count, skull, and diagnostics. The mobile client remains
connected through the shared Hub-to-Boneyard transition before the existing
disconnect convergence check. The stale desktop assertion from before the
account-label change was corrected from roster `y=46` to the current documented
`y=62`; desktop row internals were not changed.

Google Chrome `150.0.7871.124` completed the three-client journey against the
local authoritative host with status `ok`. The mobile Hub receipt reported:

- coarse-pointer matched, viewport scale `0.4333333333`, and roster scale `2`;
- exact names `Helvidius`, row IDs `player-1`/`player-2`, full health ratio `1`,
  and nine native glyph masks per name;
- roster bounds `(4.7667,26.8667,156 x 17.3333)`;
- each full bar/fill `43.3333 x 4.3333` physical pixels;
- identity start `x=49.8333`, yielding the expected `1.7333` physical gap;
- rows/pitch `8.6667` physical pixels; and
- unchanged pink `rgb(255,128,128)` bars and gold `rgb(217,186,112)` names.

The same mobile client entered the synchronized Boneyard with the same two
names/IDs, scale `2`, bar dimensions, pitch, colors, and ratios. After it
closed, both desktop clients converged from two rows to one. Desktop Hub and
Boneyard receipts retained scale `1`, roster `(11,62)`, 50 x 5 bars, identity
`x=63`, two-pixel internal gap, and 10-pixel pitch. All host, desktop-client,
and mobile-client page-error and console-error arrays were empty. The older
journey tail also completed a synchronized default-random Boneyard and physical
gate crossing; no lifecycle regression was hidden by stopping after the mobile
assertions.

The inspected green mobile artifact is
`/tmp/solomon-dark-mobile-ally-final-ally-mobile-hub.png`, 844 x 390, SHA-256
`9f69155d27b95162257542ed25ced3f70f7dcdf0d2e926f5e700bdd858f382b5`.
The matching unchanged desktop artifact is
`/tmp/solomon-dark-mobile-ally-final-ally-hub.png`, 1600 x 900, SHA-256
`d65f9e2b5bd12792b298f1eed6c9a384ac9c974a32a790a824ed688f0cc5cfb0`.

The final canonical `./scripts/validate.sh` exited 0 on the exact tree. It
restored pinned dependencies; built the backend with zero warnings/errors;
passed all 23 Website/backend contracts, frontend lint and architecture
boundaries, all 654 frontend tests including the five ally-HUD and eight
viewport contracts, and all five desktop tests; built the production frontend
and authoritative game host; and passed production CSP media policy. Output
contained only the repository's existing Fast Refresh warnings and Vite's
non-fatal large-chunk advisory.

Remaining boundary: this receipt is real Chrome/WebGL browser execution with
mobile emulation, not a physical-phone display inspection. The exact 2x CSS
geometry, semantics, lifecycle, and error-free rendering are proved; physical
Safari/Chrome panel sharpness remains an explicitly deferred device receipt.
