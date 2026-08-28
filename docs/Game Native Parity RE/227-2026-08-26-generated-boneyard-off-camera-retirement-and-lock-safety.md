# 2026-08-26 — Generated-Boneyard off-camera retirement and lock safety

## Reported smell and parity question

- Reported behavior: ordinary generated Boneyards contract the camera after
  Solomon runs but retain the entrance scenery/decoration scene graph instead
  of executing stock's off-camera destroy pass. A rare pre-existing enemy in
  that strip can also become unreachable behind the web-only active boundary.
- Stock question: close action 1066's exact manager membership, overlap test,
  timing, cache teardown, and Fence/enemy exclusions for both generated entry
  orientations; then disposition custom Boneyards and every live soft-lock
  body.
- Reproduction: generated south and north entries, one strict edge-touching
  record, scenery/compact/Road/Terrain/Fence families, an existing enemy and
  ground Sack outside the future combat rectangle, and a post-run external
  spawn request.
- Falsifiers: anchor-only cleanup, Fence/Gate deletion, cleanup before tick
  400, custom-arena ownership, enemy teleport/deletion, an entrance birth after
  the run edge, or camera lock while a required live circle remains outside.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | `SolomonDark.exe` 0.72.5, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Canonical read-only replica target. | high |
| Fresh instructions | `0x004728B0`; rectangle helpers `0x004036D0`, `0x0040F9E0`, `0x0040FD90` | Strict positive-area rectangle overlap; edge-only contact fails; failed members are removed/destroyed in-place before cache rebuild. | high |
| Owner layout | Arena managers `+0x87C4`, `+0x8810`, `+0x885C`, `+0x88A8`, `+0x8ADC`, `+0x8B54`, `+0x8F40`; target `+0x8E98..+0x8EA4` | Scenery, Road, Terrain, compact decoration, derived bridge, and derived spatial rows are visited; Fence is not. | high |
| Generated script | `0x006388B0`: 1065, `SLEEP(4.0)`, 1066 | Ordinary cleanup occurs after exactly 400 fixed ticks for north and south generated entrances. | high |
| Current Website | `boneyard-arena-transition.ts`, `boneyard-world.ts`, `boneyard-world-renderer.ts` at focused parent `0716303c` | Server seals/constrains and renderer viewport-culls, but the full authored static scene remains resident; the run edge has no existing-body safety gate. | high |

## System boundary and membership inventory

Native system: generated `SOLOMON RUNS` camera target plus the tick-400
off-camera static/derived retirement. Website extension: do not make a live
progression body unreachable while preserving the native static membership.

| Member | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| south-entry combat rectangle | generator `0x006388B0`, full height minus 400 | verified-already-at-parity | transition-kernel north/south geometry tests |
| north-entry combat rectangle | generator, Y plus 375 and height minus 400 | verified-already-at-parity | transition-kernel geometry tests |
| 400-tick action-1066 edge | `SLEEP(4.0)` at 100 Hz | exact-ported | tick 399 retains; tick 400 retires |
| Scenery visual records | Arena `+0x87C4` | exact-ported | strict visual-bounds overlap and active resident removal |
| Road records | Arena `+0x8810`, four-point AABB | exact-ported | retained/retired base-layer cases |
| Terrain records | Arena `+0x88A8`, four-point AABB | exact-ported | retained/retired base-layer cases; stock default bank has zero Terrain |
| compact/decor records | RegionLayout `+0x8ADC` | exact-ported | transformed art bounds and active resident removal |
| derived bridges | Arena `+0x8B54` | exact-ported through filtered Road/Terrain projection | no stale retired crossing art |
| derived spatial rows/caches | Arena `+0x8F40`, terminal rebuild calls | exact-ported through active resident/target cache replacement | diagnostics and target tests |
| Fence, posts, intact/broken grate, Gate leaves, rails, walls | Arena `+0x885C`, absent from action 1066 | verified-already-at-parity | every fence family survives cleanup; Gate identities stay replicated |
| player, Solomon, enemies, Maggots, projectiles/effects | no action-1066 iteration | verified-already-at-parity | no cleanup deletion/teleport |
| authored Goodie/scenery target outside target | Scenery owner | exact-ported | authoritative Goodie and spell-target row retires at seal |
| required ground Sack outside target | transient loot owner, absent from 1066 | Website safety extension | full camera remains until collected/retired |
| existing enemy/Maggot outside target | Badguy manager, absent from 1066 | Website safety extension | full camera/active area remains reachable until clear |
| post-run generated and external births | generated encounter owner | exact requested safety projection | every complete collision circle is inside combat bounds |
| default generated Boneyards | Solomon Dig plus default source | exact-ported | both orientations and browser journey |
| Tutorial | authored 300-tick sibling owner | verified shared renderer projection with distinct timing/authority | responsive Tutorial journey retires the same static families at its own cleanup edge |
| mod/custom Boneyards | no generated `SOLOMON RUNS` lifecycle | out-of-system | no cleanup preparation/application or safety gate |
| teardown/new run | renderer/world replacement | verified-already-at-parity | no retained cleaned scene or safety state |

## Native ownership thread and recovered behavioral contract

- `BoneyardGenerator 0x006388B0` authors the target and three-action script.
  Action 1065 owns camera interpolation; action 1066 separately owns static
  removal at tick 400. Neither owns movement collision.
- `0x004728B0` asks strict rectangle-overlap helper `0x004036D0` for each
  member. Source left/top must be below target right/bottom and source
  right/bottom must be above target left/top; equality at an edge is removed.
- Scenery uses its positioned visual rectangle. Road/Terrain and derived
  geometry use record AABBs. Fence is deliberately untouched. Static/spatial
  caches rebuild after removals; no player, enemy, or loot relocation follows.
- Web authority retains the existing one-way combat boundary only after its
  safety predicate clears. While a run has requested the transition but is
  waiting, the full area remains navigable and visible, while all new enemy
  placement is already restricted to the future combat rectangle.

## Nearby-system findings

- Durable finding: the stock cleanup's strict overlap is shared across every
  visited static/derived lane; using source anchors would misclassify tall
  scenery and rotated compact decoration near the boundary.
- Evidence: fresh read-only decompilation of `0x004728B0`, `0x004036D0`,
  `0x0040F9E0`, and `0x0040FD90` through the canonical replica wrapper.
- Why it matters: renderer retirement, authoritative Goodie/target retirement,
  and future authored Road/Terrain scenes must use one geometric contract.
- Native report also updated: `native-solomon-dig-and-wave-director.md`.

## Confidence and open questions

- Confirmed: complete visited manager set, Fence/actor exclusions, strict
  overlap, 400-tick timing, both entry geometries, and cache rebuild order.
- Inferred only at the browser projection boundary: resident alpha-cropped
  art bounds are the closest exact web representation of native visual
  rectangles; no platform mismatch changes membership for the supported
  generated bank.
- Unknowns: none material to the supported ordinary generated Boneyards.

## Web implementation consequence

- `boneyard-arena-transition.ts` owns one full-circle safety predicate.
  `boneyard-world.ts` retries a requested but blocked lock every tick, keeps
  existing actors/items untouched, and confines all subsequent births.
- At the first sealed frame, the renderer repaints its existing baked base in
  place with target-filtered Road/Terrain/compact/scenery membership, removes
  outside scenery residents from active painter/shadow/light inputs, and
  preserves every Fence resident without duplicating mobile texture residency
  or changing protocol state.
- At the authoritative seal edge, outside authored Goodies and scenery target
  rows retire so render, interaction, and spell ownership agree.
- The same renderer/target retirement helper is consumed by Tutorial only when
  its separate authored lock has remained safe through its 300-tick cleanup
  countdown; generated Boneyards retain their recovered 400-tick owner.
- No fallback, compatibility phase, enemy teleport, or custom-arena behavior is
  introduced.

## Validation contract

- Focused tests: strict overlap/equality, every manager family, Fence negative,
  both entry orientations, ticks 399/400, blocked existing actor/Maggot/Sack,
  clear retry, post-run spawn confinement, Goodie/target retirement, and custom
  negative.
- Browser journey: generated Boneyard must show a full/reachable entry while a
  synthetic required body is outside; after clearing it, observe tick-400
  static retirement, surviving Gate, reduced active resident/source counts,
  no outside enemy roots, and a blocked return across the web safety boundary.
- The responsive Tutorial sibling must also report applied cleanup and reduced
  resident/source membership at its own tick-300 edge without deleting Fence.
- Run the complete Website Mac canonical gate and Mod Loader static RE suite on
  byte-identical candidates; inspect before/after ordinary-Boneyard frames and
  require empty page/console/network/host errors.

## Implementation validation receipt

- Implementation: generated lock admission now retries every authoritative tick
  after the Solomon run request and starts only when every eligible player,
  enemy actor, Maggot, and ground Sack circle fits the combat rectangle. While
  blocked, the full area remains visible/navigable and every new generated or
  external birth already resolves inside the future combat rectangle. Nothing
  is teleported, damaged, deleted, or silently completed.
- Static retirement: `boneyard-off-camera-cleanup.ts` owns the strict native
  positive-area overlap and complete scenery/Road/Terrain/compact source plan.
  At the authored cleanup edge, `boneyard-world-renderer.ts` repaints the
  existing base canvases in place with the filtered plan, updates their Pixi
  texture sources, and removes outside object residents from active visibility,
  painter, light, and complex-shadow inputs. Fence sources are never admitted
  to the retirement set. This does not allocate a duplicate mobile base.
- Authoritative retirement: outside authored Goodies and scenery spell /
  Earthquake target rows retire with the static edge. Ordinary generated
  Boneyards use their exact 400-tick phase; Tutorial shares the renderer/target
  projection only at its distinct safe 300-tick edge. Custom Boneyards retain
  full authored ownership.
- Red/green receipt: focused tests first failed on the missing safety export,
  an entrance-side post-run birth, unretired target/Goodie rows, and absent
  renderer plan. The implemented focused set passes `67/67`; changed-file
  oxlint, architecture boundaries, TypeScript test configuration, and
  `git diff --check` are clean.
- Performance-harness correction: the pre-existing Lua p99 microbenchmark was
  running inside the 1,579-test parallel pool and twice measured unrelated Mac
  worker contention (`25.247` and `25.809` ms) while three isolated reruns
  passed. `test:boneyard` now runs that unchanged seven-test file once with
  `--test-concurrency=1`, then runs the remaining suite normally. On the exact
  candidate, pretests pass `280/280`, isolated Lua passes `7/7`, and the
  remaining Boneyard/game suite passes `1572/1572`.
- Mac canonical gate: `/opt/homebrew/bin/bash ./scripts/validate.sh` exits zero
  with all backend/frontend/Tutorial/desktop/lint/type/build/media contracts.
  Production game entry is `474609` raw / `133075` gzip against `524288` /
  `133120`. Mod Loader static RE passes `507/507` under Homebrew Python 3.14.
  Logs: `evidence/final-canonical-website-validate-green.log` and
  `evidence/final-combined-loader-static-re-homebrew.log`.
- Ordinary generated-Boneyard production Chrome: the dedicated cleanup journey
  crosses the north Gate, starts Solomon, reaches sealed action 1066, and
  reports active residents `603 -> 561`, `42` retired residents, `104` retired
  static sources, both Gate leaves retained, eight sampled enemies with zero
  outside-combat violations, and empty page/response/wire errors. Log and frame:
  `evidence/final-ordinary-boneyard-cleanup-browser-receipt.log` and
  `evidence/ordinary-boneyard-cleanup-receipt-retired-entry.png`.
- Tutorial production Chrome: the existing unsafe enemy and ground-Sack probes
  keep the full camera; after both clear, the separate tick-300 cleanup reports
  `69` retired residents and `132` retired sources at target
  `(0,0,2043,849.91796875)`. All four spawn families, Staff melee, College
  admission, stock/75%/125%/mobile responsive layouts, and error arrays remain
  green. Log and frame: `evidence/final-tutorial-shared-cleanup-browser.log`
  and `evidence/tutorial-shared-cleanup-stock-camera-locked.png`.
- Visual inspection confirms that both sealed frames preserve coherent ground,
  scenery, actor ordering, lighting, complex shadows, weather, and HUD without
  stale entrance art, blank tiles, or texture corruption. No browser-platform
  member or material implementation unknown remains.
