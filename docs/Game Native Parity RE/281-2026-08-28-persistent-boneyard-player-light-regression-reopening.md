# 2026-08-28 — Persistent Boneyard player-light regression reopening

## Reported smell and parity question

- Reported web behavior: a persistent bright white light surrounds every
  wizard in environment-mode Boneyards, independent of Damage x4 or any other
  temporary powerup. The user asks to return it to the subdued Website level
  used before roughly 2026-08-27, even if full brightness matches stock.
- Correct owner: the post-world DeadHawg-18 player aperture drawn by
  `paintBoneyardEnvironmentLight`, not Damage x4, the selected-element Staff
  orb, Region analytic lighting, a spell provider, or garment art.
- Reproduction inputs/scenes: environment modes `0`, `1`, and `2`; local and
  remote players; one and overlapping players; initial ready frame, ordinary
  presentation frames, movement/camera changes, materialization, death,
  disconnect, scene replacement, resize, and teardown.
- Falsifiers: mode `0` owns the same surface; hiding Damage x4 removes the
  persistent pool; the August 27 change did not remove an existing `0.14`
  Website scale; or restoring the scale changes Region sources, shadows,
  Staff/element VFX, far-field transparency, geometry, or player membership.

This reopens the 2026-08-21 **Party invitation denial and player presentation
correction** entry. That pass already recovered and dispositioned this entire
lighting branch after the user reported a “conspicuous white oval over every
player.” It deliberately retained native membership and geometry while making
the final Website opacity `0.14` of native. The 2026-08-27 Arena pixel-pipeline
pass violated that explicit product boundary: it removed the named Website
scale while treating the shared Arena shader closure as authority to overwrite
the previously recorded user-owned brightness policy.

The initial follow-up incorrectly investigated Damage x4. Those changes were
never committed or pushed and have been discarded together with their task
worktrees/evidence before this correct reopening.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| User product direction | explicit clarification, 2026-08-28 | The issue is the persistent player-following white light, not the Damage x4 halo; restore the prior subdued web presentation. | authoritative |
| Retail identity/instructions | Solomon Dark 0.72.5, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000`; Arena environment owner `0x00470EE0`, direct draw `0x004713FF` | Modes `1/2` draw DeadHawg record 18 after the world with native `SRCALPHA,ONE`, alpha `.2375..25`; mode `0` has no pass. | high, previously recovered |
| Prior Website policy | commit `afbfb3b2`; `boneyard-environment-light-plan.ts`; 2026-08-21 ledger entry | The named `WEB_DIRECT_ENVIRONMENT_LIGHT_SCALE` was exactly `0.14`, producing effective alpha `.03325..035`, while preserving the native mode gate, flicker, order, geometry, and overlap. | high |
| Regression history | commit `e8ceddae`, 2026-08-27 | The Arena pixel-pipeline change deleted the scale and changed only the plan result to full `.2375..25`; its receipt explicitly claimed “no browser scale.” | high |
| Current source/callers | `BoneyardScene.tsx`, `boneyard-environment-light.ts`, `boneyard.css`, render contract and smoke tools at rebased base `54a9e54f` | One transparent Canvas2D surface exists only in modes `1/2`; it paints once before ready and once per presentation frame, omits materializing players on live frames, uses internal `lighter`, then CSS `plus-lighter`. | high |
| Existing browser contracts | `smoke-game-runtime.mjs`, `measure-boneyard-performance.mjs`, `smoke-shared-hub-parties.mjs` | The retained product acceptance already expects single-player center alpha `7..11`, far alpha/RGB zero, and overlapping-player maximum alpha `<=28`; current full-alpha implementation contradicts those browser contracts. | high |
| Current Mac baseline | built `daa6707a` two-client Boneyard frame, `/Users/jarrett/codex-acceptance/player-persistent-light-evidence-20260828/baseline/loot-families-visible.png`, SHA-256 `8014e927891d02d63d580910eea4d09ab430487ca3f2f1d583fe3afb6da81c32` | With no Damage x4 active, the local Fire wizard retains the broad gray-white player-following pool reported by the user. | high, direct observation |

## System boundary and membership inventory

Native/product system: **late Boneyard direct player aperture**, from the
environment-mode gate and synchronized player list through the record-18
Canvas2D draw, additive world composition, ready lifecycle, and teardown. The
native branch remains documented; final opacity is explicit Website policy.

| Member / branch | Native/web source | Disposition | Proof contract |
| --- | --- | --- | --- |
| environment mode `0` | `0x00470EE0` gate; `BoneyardScene` surface gate | `verified-already-at-parity` | no environment-light canvas or draw |
| environment modes `1/2` | native direct branch, record 18 | `exact-ported` membership/geometry; explicit Website opacity override | one bounded post-world surface at the restored `0.14` scale |
| native alpha/flicker | `.2375 + sin-lane*.0125`, player slot phase | `exact-ported` recurrence before Website scaling | full 360-frame/four-slot domain multiplied uniformly |
| local and remote synchronized players | initial snapshot and sampled player map | `exact-ported` | one draw per admitted player in stable object order |
| materializing players | live-frame `materializingPlayerIds` filter | `verified-already-at-parity` | no aperture until the player is presentable |
| overlapping players | Canvas `lighter` accumulation | `exact-ported` relationship under product scale | single alpha `7..11`; three-player maximum `<=28` |
| record-18 asset and registration | `boneyard/deadhawg/018.png`, native crop | `verified-already-at-parity` | unchanged image, center/root geometry, and alpha shape |
| camera, zoom, viewport, DPR, resize | `worldToScreen`, zoom `1.35`, shared viewport/resolution | `verified-already-at-parity` | unchanged projected center/extent and physical canvas size |
| DOM composition/order | transparent Canvas2D `lighter`; CSS `plus-lighter`, z-index `2` | `verified-already-at-parity` | unchanged additive overlap and HUD-above ordering |
| far field | transparent canvas outside bounded crops | `verified-already-at-parity` | alpha/RGB exactly zero |
| optional DeadHawg-9 target grids | `0x004714C8..0x00472828` | `out-of-system` (web actor model has no target-grid members) | no invented radial fallback |
| Region raster, analytic player/light-provider tint, Lantern/enemy/projectile/spell sources, directional shadows | separate Region owner | `out-of-system` for this correction | no source, scalar, radius, shadow, or composite change |
| selected-element/Staff VFX and Damage x4 halo | separate player child painters | `out-of-system` | unchanged assets, alpha, timing, and visibility |
| death/spectator/disconnect and scene replacement | synchronized player/session and scene owners | `verified-already-at-parity` | current membership semantics retained; stale surface removed on teardown |

No member is blocked by the browser platform. The predicted stock difference
is intentional: mode-`1/2` direct player apertures remain 14 percent of native
brightness in the Website.

## Native ownership thread and recovered behavioral contract

- Arena environment mode owns whether the late surface exists. Mode `0` never
  constructs it; modes `1/2` preload the resident record-18 image.
- `BoneyardScene` owns entry, initial paint-before-ready, frame updates, resize,
  and teardown. `paintBoneyardEnvironmentLight` owns player enumeration,
  camera projection, crop geometry, internal blend state, and state restore.
- `nativeDirectEnvironmentLightAlpha` preserves the native flicker/slot phase,
  then applies the named `0.14` Website product scale. Effective alpha is
  `.03325..035`; no client or host gameplay state is added.
- Multi-player accumulation, transparent far field, record art, camera zoom,
  painter order, materialization filter, and HUD ownership do not change.
- Authority/replication, collision, audio, RNG, Region lighting, shadows,
  spells, Staff orbs, and Damage x4 are unaffected.

## Nearby-system findings

- The August 27 shared Arena shader recovery is still valid for every native
  pixel-pipeline member. Its scope did not authorize deleting a separately
  documented user-requested Website opacity policy.
- Existing browser smoke/performance bounds still encode the August 21 policy,
  which is why they already reject the current full-alpha regression.
- No reusable retail fact changed. Mod Loader reports remain the native
  authority and require no update for this Website-only policy restoration.

## Confidence and open questions

- Confirmed: exact regression commit, prior web constant, native owner and
  branch membership, all current Website consumers, baseline pixels, and
  unaffected sibling systems.
- Product policy: restore `WEB_DIRECT_ENVIRONMENT_LIGHT_SCALE = 0.14` exactly.
- Unknown material to implementation: none.

## Web implementation consequence

- Restore the named `WEB_DIRECT_ENVIRONMENT_LIGHT_SCALE` in
  `boneyard-environment-light-plan.ts` and multiply the unchanged native alpha
  by it.
- Restore the focused contract to assert both the exact policy constant and
  effective `.03325..035` domain across all four slot phases.
- Do not touch `BoneyardScene`, canvas/CSS blend, geometry, assets, Region
  lighting, player state, Staff/element VFX, Damage x4, protocol, or gameplay.

## Validation contract

- Focused Mac red/green: current test fails the restored scale/domain contract;
  corrected plan passes the 360-frame/four-slot sweep and existing structural
  surface contracts.
- Complete Mac gate: `/opt/homebrew/bin/bash ./scripts/validate.sh` on the exact
  current-main candidate.
- Built Mac browser: mode-`2` Boneyard with no Damage x4 active; center alpha
  `7..11`, center RGB total `>=720`, far alpha/RGB zero, persistent light
  visibly subdued, movement/camera tracking retained, and empty page/console/
  failed-response arrays.
- Multi-player contract: additive overlap remains bounded (`<=28` for three
  coincident players) and each separated player retains one bounded aperture.

## Implementation validation receipt

- Implementation: `WEB_DIRECT_ENVIRONMENT_LIGHT_SCALE = 0.14` is restored in
  `boneyard-environment-light-plan.ts`; the unchanged native flicker is scaled
  only at its final opacity boundary. The render contract now pins both that
  exact policy constant and effective `.03325..035` output over 360 frames and
  all four player-slot phases. No Damage x4, Staff/element, Region, shadow,
  asset, geometry, membership, authority, protocol, audio, or gameplay source
  changed.
- Candidate identity: initial evidence was taken from base
  `daa6707a50b05d77b0b08ff4463de760c55605c8`. During its final gate,
  `origin/main` advanced to
  `54a9e54f7b73315b8e020e97afe916cefb61cdf2` with the independent trader-Chat
  renderer-lifecycle closure. The focused commit was rebased onto that tip;
  code and test applied cleanly, while the append-only ledger conflict was
  resolved by retaining both complete entries in landed order. The final local
  branch and Mac `player-persistent-light-20260828-root-r2` candidate contain
  only this ledger, the light plan, and its focused contract relative to the
  new base; temporary acceptance instrumentation was restored byte for byte.
- Focused Mac red/green: the untouched implementation failed because it did
  not export `WEB_DIRECT_ENVIRONMENT_LIGHT_SCALE`; the corrected direct suite
  passed `45/45`, including the exact scale/domain assertion and existing
  mode, ready-order, blend, geometry, and renderer-structure contracts.
- Complete Mac gate: macOS `26.6.2` build `25G83`, arm64, passed
  `/opt/homebrew/bin/bash ./scripts/validate.sh`, including backend build and
  integration, formatting/lint, all frontend/desktop suites, production build,
  bundle budget, and media policy. Initial-base pre-receipt stdout SHA-256 was
  `e0df7444bae223beaf2564c3d7ccd033fa0ea58b11b2941ff3bc487524a3b888`;
  its exact post-receipt tree also passed with stdout SHA-256
  `af5a09faa5428fd0e6d801acf080837dde5706f59958f842f2a4dd3747f58e04`.
  The exact rebased final tree repeats the gate after this conflict resolution;
  its hash belongs in the publication handoff rather than recursively changing
  this ledger.
- Built browser proof: Google Chrome `151.0.7922.174`, WebGL production build,
  two synchronized players, environment mode `2`, and no Damage x4 active at
  the light sample. The local player aperture measured center alpha `9`, RGB
  total `765`, CSS composite `plus-lighter`, and far alpha/RGB `0/0`. The full
  smoke passed with empty page/console/failed-response arrays while exercising
  both players and the later independent Damage x4 lifecycle. Receipt-log
  SHA-256: `252d12fe6ba2924b163744b22637004653cd1732f1999ad2405f7bb6abdb20e8`.
- Before/after visual evidence is under
  `/Users/jarrett/codex-acceptance/player-persistent-light-evidence-20260828/`.
  The full-alpha baseline frame SHA-256 is
  `8014e927891d02d63d580910eea4d09ab430487ca3f2f1d583fe3afb6da81c32`;
  the corrected mode-2 frame SHA-256 is
  `bc8c218a0da31bbbcd955756b566450113c2d65e6c026c497fca6d25d996aa14`.
  Direct inspection shows the broad gray-white pool removed from the local Fire
  wizard while world/Fire lighting and the remote Air wizard's separate blue
  Staff/element presentation remain intact.
- Browser constraints, inferred implementation facts, and remaining in-system
  omissions: none. Publication, remote verification, deployment, and cleanup
  remain separate receipts; deployment is not in this task's scope.
