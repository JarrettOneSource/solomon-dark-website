# Client allocation review and local reductions — 2026-09-20

The Windows endurance profile showed substantial transient allocation in rendering and presentation. Four local changes reduce repeated allocation while preserving rendering values, painter diagnostics, and owned snapshot results. The matched measurements below establish improvements in those paths; they do not establish a whole-game FPS improvement or a wave-100 endurance result.

The raw receipt is [performance-client-allocation-20260920.json](performance-client-allocation-20260920.json). It records every timing sample, allocation estimate, source SHA-256 before and after, test source hashes, profile hashes, fixture sizes, and benchmark artifact paths. All four measured baseline source files match HEAD before these changes. The reviewed checkout is `perf/wave100-6a583nbx`, based on `fb9ec4bf9486e0fac5f76e9648c043614bb4d373`.

## Evidence from the live Windows capture

The passive capture ran from 15:26:37 to 15:27:08 UTC during wave 15. Its CPU profile spans 31.196 seconds and has 20,227 samples. Heap sampling used a 65,536-byte interval and included objects collected during the capture; 69,705 heap samples estimate 4,379.423 MiB allocated. This is allocation volume, not retained heap growth. The CPU profile attributes 531.861 ms to garbage collection. The capture followed the earlier 15:21 stall and therefore does not directly explain that individual stall.

Coarse stack classification assigns each allocation once:

| Enclosing path | Allocated MiB |
| --- | ---: |
| Page renderer and view updates | 2,454.631 |
| Pixi rendering | 930.470 |
| Presentation interpolation | 482.740 |
| Snapshot and input engine | 312.989 |
| React | 183.781 |
| Other | 14.812 |

The classification uses recognizable enclosing call frames and is an approximation of ownership. Minified functions were matched to the existing built bundle and source through their operations and field names; no source map or rebuild was required.

These specific inclusive subtrees supplied the patch candidates:

| Path | Allocated MiB | Sampled CPU ms | Action |
| --- | ---: | ---: | --- |
| `NativeMaterialBatcher.packQuadAttributes` | 419.513 | 679.727 | Remove its captured writer closure |
| `NativeBoneyardWeather.visitDrops` through its view | 246.738 | 294.867 | Skip unchanged public tint assignments |
| `NativeRegionPainterPlanner.build` | 236.758 | 1,132.939 | Construct entry diagnostic strings only on failure |
| `interpolateEnemyDeathEffects` | 204.401 | 67.126 | Remove the intermediate copy that is immediately copied again |
| `nativeEnemyDeathEffectPlan` | 109.521 | 121.155 | Unchanged; additional future candidate |
| `NativeUiTextGlyphs` | 45.833 | 31.449 | Unchanged; additional future candidate |

**The subtree rows are already included in the category table and total. Do not add the two tables together.** In particular, the presentation category contains death-effect interpolation, and the page renderer category contains rain updates and painter planning. The live subtree totals do not measure the exact savings from a proposed edit.

The DOM review found no recurring `innerHTML` or `replaceChildren` operation in the active Boneyard frame path. `BoneyardScene.tsx` attaches the canvas with `replaceChildren` during renderer initialization. `GameHud.tsx` schedules a new quickbar HUD state on every snapshot, approximately 20 Hz here; boss-name plans and bitmap glyph styles are recomputed through that tree. Glyph keys include both position and code point, so changing a character replaces that glyph. Existing stable keys preserve other glyph and strip elements. Loot messages mount and retire with events. None of this establishes which nodes accounted for the observed drops in total DOM node count, and the profile does not support treating DOM churn as the dominant allocation source.

Two separate CPU findings remain outside this patch. `input/gamepad-menu-navigation.ts:64–69` polls gamepads on every animation frame before checking whether navigation has an active scope; its native `getGamepads` call accounts for about 1,904 ms, compared with about 12 ms in gameplay input polling. Changing that requires preserving menu neutral-state transitions. The effect in `mod-ui/ModSkillQuickbar.tsx:29` has no dependency array and detaches/reinstalls its key handler after each render; `removeEventListener` accounts for about 153 ms. Neither was changed.

## Changes and preserved behavior

- `frontend/src/game/renderer/native-material-batch.ts`: the four vertex writes are direct. The order of multiplication, addition, Float32 stores, UV stores, packed color, texture ID, round-pixel bit, and native texture mode is unchanged. This removes one captured function per packed quad.
- `frontend/src/game/renderer/native-boneyard-weather-view.ts`: assign `particle.tint` only when its public getter differs from the desired color. The existing `alpha = 1` and inactive-drop `alpha = 0` behavior remains intact. This preserves Pixi's public tint, alpha, and packed color through reuse. Direct writes to `Particle.color` were deliberately avoided because they bypass the tint state used by subsequent alpha updates.
- `frontend/src/game/region-painter-order.ts`: valid entries no longer create the `world Y` and `sort bias` diagnostic strings. Invalid entries retain the same error class, message, and validation order: empty ID, world Y, then sort bias. The planner's retained collections and ordering algorithm are unchanged.
- `frontend/src/game/client/boneyard-enemy-samples.ts`: the root-owned change spreads the selected discrete effect directly, clones its painter registration, and creates the interpolated position once. The former code first cloned the effect and position, spread that clone, then replaced the position. Returned samples remain independently owned; no output pooling was added.

## Matched local measurements

The isolated Node v22.23.2 runner uses the saved pre-change modules and current modules with the same existing dependencies. Each variant warms once, followed by five paired timing rounds with alternating order. A separate run samples allocations at a 16,384-byte interval with collected objects included. No forced garbage collection was used. Timing runs do not include allocation sampling.

| Matched workload | Allocated MiB before | Allocated MiB after | Allocation reduction | Median ms before | Median ms after |
| --- | ---: | ---: | ---: | ---: | ---: |
| 300,000 quad writes over 128 prebuilt elements | 39.842 | No sampled allocation | — | 10.188 | 8.096 |
| 1,000 painter frames with 600 entries each | 227.383 | 187.899 | 17.36% | 143.668 | 135.452 |
| 1,040 rain frames, 532,468 drop visits | 162.260 | 128.484 | 20.82% | 45.188 | 39.150 |
| 1,000 enemy samples, 130 death effects per endpoint | 115.088 | 77.406 | 32.74% | 23.459 | 18.927 |

Rain replays a trace generated by the actual seeded storm simulation at 100 simulation ticks/second and 130 presentation frames/second, with lighting captured once per drop. The same recorded membership and colors feed both retained views. Actual color normalizations decrease from **528,952 to 404,640**, removing 124,312 calls. Active, hidden, and reused particle public state remains equal. The trace is a deterministic fixture, not a recording of the Windows endurance party.

The interpolation fixture has 122 matched effects, eight retired effects, eight spawned effects, null and non-null registrations, and six blend values including both endpoints. Other enemy collections are empty. Both implementations return equal complete enemy-sample values at those six blends.

The initial runner completed quad and painter measurements before an isolated Vite dependency-identity setup failure in the weather stage. Those completed outputs and profiles were preserved; only weather was rerun after resolving the baseline to the same installed Pixi module. The optional interpolation measurement used the same measurement procedure. The receipt documents those stages.

Other Mac workloads were active, and validation was started during this work. The timings are descriptive observations with that scheduling confounder. Node V8, these fixtures, and Windows Chromium have different optimization contexts. Zero sampled bytes in the quad workload means no allocation was observed at the configured sampling interval; it is not a universal zero-allocation claim. The allocation counts and equivalence checks are the strongest evidence here. A subsequent headed party run is still required to assess frame-time tails and endurance.

## Verification and remaining work

The three focused suites passed 28 tests. The first full gate subsequently caught a TypeScript mismatch in the new quad test's artificial element shape. The fixture now uses real installed Pixi `BatchableSprite` instances. After that correction, `tsc -p tsconfig.test.json --noEmit` completed without diagnostics, and both fixed-function tests passed again.

The quad test exercises the actual batcher through `installNativeBatchMaterial`, without adding a production export. It compares all 80 Uint32 slots against the former writer over 72 combinations of transform, color, alpha/diffuse mode, and output offset. This checks Float32 bits and untouched buffer prefix/suffix as well as the written attributes.

The weather test covers all 256 grayscale inputs, redundant normalization avoidance, active-to-hidden transitions, zero active drops, retained-object reuse, and cleanup. Existing painter tests cover order, nested insertions, failures, and retirement; added assertions pin the exact diagnostic classes, text, and ordering. The root expanded the existing interpolation timeline test to cover ownership and spawn/retirement boundaries.

The root owns the final full validation gate and the endurance retry. This receipt does not claim that either has completed.

The complete renderer mutation gate subsequently identified an equivalent
mutation of the final, unused buffer-index increment. That final store now
uses `index` directly. All 72 quad buffer combinations remain byte-identical.
This cleanup occurred after the allocation measurements above; it changes no
rendered output and introduces no new allocation. The exact source hashes and
proof are in the endurance receipt.
