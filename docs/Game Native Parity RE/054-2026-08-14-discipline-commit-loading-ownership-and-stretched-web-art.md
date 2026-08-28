# 2026-08-14 — Discipline-commit loading ownership and stretched web art

## Reported web mismatch

- At a `1200 x 900` browser viewport, the shipped `object-fit: cover` rule
  scales the `1920 x 1080` loading image to `1600 x 900` and crops `200 px`
  from both horizontal edges. The requested browser presentation instead
  stretches the complete image to the active viewport resolution.
- Instrumenting the accepted discipline click and loading-overlay mount in
  Chrome `150.0.7871.124` measured the hidden input barrier attaching
  `981.6 ms` after the click and the artwork becoming visible `1140.6 ms`
  after the click. The approximately `880 ms` native Create finalization was
  therefore exposed before the Hub loading presentation took ownership.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Mod Loader renderer | Mod Loader `504c5ad1424fdceead955b8764bf638eb3916fb7`; `SolomonDarkModLoader/src/loading_screen_renderer.cpp` | The injected renderer fills the viewport quad but adjusts UVs by viewport/image aspect ratio, producing a centered cover crop at non-`16:9` resolutions. It does not stretch the full image. | high |
| Native transition trace | `multiplayer_join_flow/loadout_picker.inl`, `phase_state.inl`, `tick_state_machine.inl`, and `loading_screen_progress.inl`; existing Create finalization trace in this ledger | A completed element/discipline choice remains in the Create final recurrence until that surface exits. The join flow begins `connecting_transport` only as the phase changes from loadout selection to connecting. | high |
| Website source | Website `f94d4f64e01d5ab883ca47943694e0fa1cfd341f`; `CreateMenuScene.tsx`, `MainMenuScene.tsx`, and `match-loading-screen.css` | `CreateMenuScene` waits `880 ms` before calling `onStart`; `MainMenuScene.startHub` then creates the Hub barrier. The image uses `object-fit: cover`. | high |
| Browser baseline | Chrome `150.0.7871.124`, local Vite/game host, `1200 x 900` | Natural image size was `1920 x 1080`; computed fit was `cover`. An event-to-mutation probe measured discipline click -> barrier attach at `981.6 ms` and click -> visible art at `1140.6 ms`. | high |
| Product direction | User correction, 2026-08-14 | On the Website, show loading from the accepted discipline choice while Hub loads and stretch the full image to the browser resolution. | authoritative |

## Ownership and intentional divergence

- The accepted discipline click is now the Website's Hub-transition ownership
  edge. It must begin the hidden loading/input barrier immediately, before the
  existing `880 ms` Create final recurrence, `catch-it` cue, WebSocket work,
  welcome snapshot, and Hub renderer initialization.
- The `880 ms` final recurrence remains part of the Create lifecycle. Moving
  presentation ownership earlier does not start the network request early and
  does not replace that recovered native timing with a fabricated delay.
- `MainMenuScene.startHub` must advance the barrier created at discipline
  commit rather than begin a second sequence. Otherwise its `150 ms` reveal
  timestamp would reset after Create finalization and re-expose the menu.
- The Website intentionally uses stretched full-image presentation at
  non-`16:9` resolutions. This differs from the Mod Loader's centered crop and
  can distort the artwork; it is an explicit product choice and must not be
  represented as recovered native behavior.
- Progress remains tied only to semantic lifecycle milestones. The earlier
  ownership edge holds `connecting_transport .44` during Create finalization;
  no timer advances the bar. The native `150 ms` visual reveal threshold and
  immediate input sealing remain unchanged.

## Adjacent-system and boundary audit

- Hub failure still cancels the same barrier and returns control to Create;
  successful teardown still waits for the Hub renderer's initial frame.
- The Hub -> Boneyard owner, stages, renderer-ready teardown, and loading art
  timing are unaffected by this correction.
- The stretch applies only to the full-screen loading image. Gameplay world
  units, camera field of view, HUD scaling, bar geometry, labels, and input
  ownership remain unchanged.
- Repeated discipline input is already rejected by `pendingDiscipline`; only
  the first accepted choice may create the Hub sequence.
- No Mod Loader source or report changes are required: centered cover-cropping
  is already implemented and documented there. This section records a
  Website-only divergence and a Website transition-owner correction.

## Validation contract

- Focused source coverage must pin `object-fit: fill`, immediate invocation of
  the discipline-commit owner, and a single Hub barrier begin site outside
  `startHub`.
- At `1200 x 900`, browser evidence must show the complete loading bitmap
  occupying the full viewport with computed `object-fit: fill`.
- The hidden Hub barrier must attach within `150 ms` of the accepted discipline
  click, become visible only after the existing `150 ms` reveal threshold,
  remain active through Create finalization and Hub loading, and clear only
  after the Hub renderer is ready.
- The real discipline -> Hub -> Boneyard journey must still complete with
  monotonic semantic progress, sealed transition input, and no page, console,
  or failed-response errors. The canonical `./scripts/validate.sh` gate must
  pass on the exact tree that is pushed to `main`.

## Implementation validation receipt

- `CreateMenuScene` now publishes one discipline-commit edge immediately after
  accepting the choice. `MainMenuScene` begins `connecting_transport .44` on
  that edge and no longer restarts the sequence when the preserved `880 ms`
  Create final recurrence calls `startHub`. Failure and renderer-ready teardown
  continue to operate on that same sequence.
- The loading bitmap uses `object-fit: fill`; its obsolete centering rule was
  removed. This is the user-directed Website divergence recorded above, not a
  change to native evidence or gameplay viewport scaling.
- The focused red phase failed both new presentation/ownership assertions on
  the prior implementation. After the correction, the complete frontend suite
  passed `376/376`.
- Chrome `150.0.7871.124` completed a fresh `1200 x 900` discipline -> Hub ->
  Boneyard journey through the real local WebSocket host and both production
  WebGL renderers. The hidden Hub barrier was first sampled `11.0 ms` after the
  discipline click, remained at `.44` across Create finalization, then advanced
  `.52 -> .92`. Boneyard advanced `.73 -> .92` and retained its existing
  renderer-ready teardown.
- Both captured art rectangles were exactly `[0,0,1200,900]`, computed
  `object-fit` was `fill`, and the viewport-relative track was
  `[239.5,832,720,8]`. Transition-time input did not replay; fresh input moved
  the player `58.0171978548169` world units. Page errors, console errors, and
  failed responses were empty. Captures are
  `/tmp/solomon-transition-loading-hub-final.png` and
  `/tmp/solomon-transition-loading-boneyard-final.png`.
- The canonical `./scripts/validate.sh` gate passed from the current
  `f94d4f64e01d5ab883ca47943694e0fa1cfd341f` `origin/main` base: Release backend
  build with zero warnings/errors, `23/23` Website/backend contracts, frontend
  lint and architecture boundaries, `376/376` frontend tests, production
  frontend/game-host builds, and deployment media policy. Diagnostics were
  limited to the repository's existing Fast Refresh and chunk-size warnings.
