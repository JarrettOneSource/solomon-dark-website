# 2026-08-14 — Fixed Hub-room contour coordinate-space correction

## Reported smell and parity question

- Reported web behavior: collision throughout the Office does not follow the
  visible room. The discrepancy is systemic rather than a single bad wall.
- Parity question: are the compiled private-room contour tables already in
  Region world space, or does each room builder transform its table-local
  endpoints while registering live collision segments?
- Reproduction surface: ordinary Office region `4`, especially the lower outer
  contour and the inner desk/prop boundary. The prior browser acceptance only
  proved entry/return and drew its overlay from the same web arrays as physics;
  it could not independently validate art-to-collision registration.
- Falsifier: if live Office segment objects retained the raw table endpoints,
  or if the native builder registered them without a room-specific translation,
  the missing-transform model would be false.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Clean retail image | `SolomonDarkAbandonware/SolomonDark.exe`, size `4,723,200`, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` | Static and live evidence use the same unmodified `0.72.5` executable. | high |
| Static Office setup | `FUN_00517D50`, table `DAT_00806930..DAT_00806C30`, segment registrar `FUN_005213C0`, doubles `0x00792140 = 409.5` and `0x007DE808 = 0.5` | For each endpoint the builder computes `viewOrigin + 0.5 * 1024 + (table - 409.5)`, then registers the result. Office therefore adds `(102.5,102.5)` to all 48 table records. | high |
| Live Office controller | isolated instance `office-collision-v2-re-0814`, PID `18792`, runtime image base `0x00E20000`; Office `0x15CB8FD8`, embedded controller `+0x378 = 0x15CB9350` | The controller owns 48 live segments, a `1024 x 1024` extent, a `7 x 7` grid of `150 x 150` cells, and slide flag `1`. Segment 0 is `(600.5,972.5)->(598.5,921.5)`, segment 38 is `(450.5,741.5)->(589.5,741.5)`, and segment 47 is `(416.5,733.5)->(451.5,741.5)`: every sampled endpoint is raw Office table data plus `(102.5,102.5)`. | high |
| Adjacent native builders | Mortuary `0x00515290`, StoreRoom `0x00517A30`, Library `0x00517F60`, Office `0x00517D50` | Every fixed-room builder uses the same center-and-local-origin pattern. Recovered table-to-world offsets are Mortuary `(27,57)`, StoreRoom `(0,72.5)`, Library `(16,102.5)`, and Office `(102.5,102.5)`. They exactly match the centered primary-art offsets. | high |
| Web source trace | Website base `2fc124f`; `hub-private-room-layout.ts`, `hub-regions.ts`, `hub-world.ts`, and `hub-collision.ts` | The layout copied raw table endpoints directly into architecture colliders. Region and world owners then consumed those values without a transform. The two-pass native slide kernel is already shared and does not cause this displacement. | high |

The previous raw-table comparison was accurate but answered the wrong question:
it proved transcription, not registration. The live controller list supplies
the missing coordinate-space boundary and directly explains why a collision
overlay sourced from the web collider could agree with web physics while both
missed the visible Office architecture.

## Native ownership thread and recovered contract

- Each fixed Region owns its world bounds and its architecture registration.
  The compiled contour table is authored in the primary room atlas's local
  coordinate space, not in Region world space.
- A room builder converts both endpoints before `FUN_005213C0` installs the
  segment in the Region movement controller. For a table origin `(ox,oy)` and
  current view `(left,top,width,height)`, the mapping is
  `world = (left + width/2 + tableX - ox, top + height/2 + tableY - oy)`.
- The normal fixed rooms use these exact values:

| Room | View size | Table origin | Table-to-world offset |
| --- | ---: | ---: | ---: |
| Mortuary | `1024 x 1024` | `(485,455)` | `(27,57)` |
| StoreRoom | `1075 x 800` | `(537.5,327.5)` | `(0,72.5)` |
| Library | `1024 x 1024` | `(496,409.5)` | `(16,102.5)` |
| Office | `1024 x 1024` | `(409.5,409.5)` | `(102.5,102.5)` |

- The resulting world segment chain, not the raw table, enters the spatial
  grid and the ordinary actor-movement collision path. Fixed NPC/prop circles
  are already declared in Region world coordinates and must not receive this
  architecture-only translation.
- `FUN_00525800`, the two-pass eight-iteration half-sweep at `0x005226F0`, and
  slide projection/push helper `0x00522020` remain the movement owner. This
  finding changes collision materialization, not response timing or math.

## Nearby-system findings, confidence, and open questions

- The same omitted transform affects all four fixed rooms, so an Office-only
  coordinate patch would preserve a false shared model. Correct the one layout
  seam used by every architecture collider.
- Portal contact segments, incoming/return scripted targets, fixed actor
  circles, camera bounds, painter order, and participant-local room ownership
  use Region world coordinates already. They remain unchanged.
- Confidence is high for the transform formula, all four offsets, Office's 48
  live registrations, and the existing response-kernel ownership. The complete
  live segment list was not dumped for all three sibling rooms because their
  instruction-identical builders and exact art-offset constants already bound
  the adjacent behavior; focused web regressions must nevertheless lock all
  four translations.
- Dialogue/service collision variants remain outside this correction. No
  evidence suggests a state-dependent architecture transform.

## Web implementation and validation contract

- Keep the raw recovered arrays recognizable, but materialize architecture
  segments through an explicit per-room `tableToWorldOffset`. The resulting
  declaration remains the single source used by rendering diagnostics,
  Region collision, and authoritative world movement.
- Do not translate prop or NPC circle colliders and do not alter the shared
  native slide kernel.
- Unit coverage must lock the four offsets, exact transformed Office samples,
  transformed-chain digests, and a northward Office movement that stops at the
  translated inner boundary rather than the raw-table Y.
- Browser acceptance must enter Office through the ordinary north-only Hub
  route, move within the visible room against that boundary, observe the
  authoritative stop at the translated contour, return normally, and emit no
  page or console errors. The canonical `./scripts/validate.sh` gate must pass
  on the same final tree.

## Web parity receipt

`hub-private-room-layout.ts` now keeps the recovered table arrays intact and
materializes only architecture segments through each room's explicit
`tableToWorldOffset`. Region collision receives those world segments through
the existing layout seam. Actor/prop circles, portals, camera state, and the
shared movement response are unchanged. The focused regression failed against
the former raw-space model, then locked all four offsets and transformed-chain
digests, the three sampled live Office segments, and the exact kernel stop
`(512,766.6)` from a northward move beginning at `(512,874)`.

The final browser receipt used an isolated `npm run dev:game` host at
`127.0.0.1:4287`, headless Google Chrome `150.0.7871.124`, a `1600 x 900`
viewport, and the Pixi WebGL Hub canvas. Starting at the actual Hub spawn
`(950.64,164.04)`, it used no route waypoint, observed the outgoing fade,
settled in Office at `(512,874)`, held north into live segment 38
`(450.5,741.5)->(589.5,741.5)`, and stopped the presented player at
`(512,766.5438419959912)`; the authoritative kernel result is exactly
`(512,766.6)`. It then observed the normal Office-to-Courtyard fade and return.
There were no page or console errors. Visual inspection of
`/tmp/solomon-dark-office-collision-v2-20260814-office-collision.png` placed
the stopped player directly below the visible inner desk/prop boundary.

The canonical `./scripts/validate.sh` gate passed on the final tree: all 23
Website/backend contracts, 360 frontend tests, 5 desktop tests, strict
lint/import boundaries, backend build, production frontend/game-host builds,
and production media policy. An optional combined sibling-room browser sweep
did not yield additional room receipts because its Courtyard navigator stalled
at `(836.56,362.32)` before entering StoreRoom. That failure occurred entirely
in Courtyard; no sibling-room browser claim is made from it. The exact static
builder evidence and transformed-chain regressions remain the acceptance basis
for the three adjacent room offsets.
