# Indexed Boneyard root movement — September 21, 2026

Fleet continuation `492v95wn`. The existing single-root non-pushing solver scanned the whole crowd for each enemy/Maggot move. The new stable spatial-grid query retains the exact source-index order, re-queries after successful corrections, and updates/extends membership after movement/spawn. Native collision arithmetic is unchanged.

The profile of an archived 277-actor / 2,140-Maggot state identified this loop as the dominant cost. A matched comparison substitutes only the prior movement/grid modules and prior Maggot owner scan; all other current code and schemas are identical. Twelve captured/generated workloads retain identical complete-output and RNG hashes. All four compared implementation files are verified different between reference and candidate.

| Archived full-tick workload | Reference mean ms | Indexed mean ms | Reduction |
| --- | ---: | ---: | ---: |
| archive-worst-tick | 19.391 | 20.135 | -3.8% |
| archive-last-alive-player-1 | 24.524 | 22.113 | 9.8% |
| archive-last-alive-player-2 | 30.869 | 24.134 | 21.8% |

Repeated identical captured ticks, not a full live replay or a Windows FPS measurement. Garbage collection was forced before each timing block, never inside it. Lua decisions, transport and rendering are excluded. Both variants have identical schema and exact-owner legacy pulse adaptation.

Four alternating reference/candidate pairs use 15 measured full ticks per block after warmup; allocation sampling is separate. See `performance-movement-grid-20260921.json` for hashes, workload equality, CPU/allocation summaries and parameters. The raw final measurement is `movement-grid-benchmark-final-492v95wn.json` in the private `solomon-fixes-6a583nbx` evidence directory. An earlier reference-overlay setup was invalid for measuring the movement change; its preliminary result is superseded by this hash-verified run.

52 movement/world tests passed, including 120 randomized native-oracle cases at three cell sizes, correction re-query, append/growth, sequential movement, existing native strict-contact cases and Boneyard integration. The canonical release gate validates this change with the remaining repairs.
