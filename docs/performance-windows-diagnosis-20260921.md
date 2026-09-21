# Windows performance diagnosis — September 21, 2026

Fleet session: `6a583nbx`. Run: `d3fe51d75225332684c8becc81e91116`.
Evidence directory: `/Users/jarrett/codex-acceptance/solomon-evidence-6a583nbx/eleventh-free-mana-20260921`.

## Outcome and scope

The eleventh endurance attempt ended at **wave 37**, after approximately 57
minutes. The monitor failed at **17:53:51.395 UTC** because Mac snapshot
delivery stopped. Windows had separately reported an uncaught Mage Air
light-registration error at **17:53:16.991 UTC**. The console and page-error
records refer to that one error, not two independent root causes. The run
did not pass wave 100. Its finalizer archived the run and stopped the host and
Mac sampler, with a completion receipt at 17:54:04 UTC.

This investigation changed no gameplay, renderer, protocol, pilot, or test
source. All 70 source hashes still match the validated candidate. Only
diagnostic scripts/results and this document were added. No restart, driver
change, display setting change, or benchmark modification was made.

## 1. Sustained Windows slowdown is primarily client main-thread saturation

In the heavy interval, browser task time consumed approximately **98–99% of
one main thread**. The task's Windows resource log showed approximately
**4–9% GPU 3D utilization** and **9–10 GiB of available system RAM** before
the final fault. This supports a client CPU bottleneck, not GPU saturation
or system memory exhaustion as the explanation of that sustained decline.
These measurements do not exclude other forms of scheduling or graphics
latency during individual stalls.

The clients are not an equal-frame-rate comparison: Mac was rendering near
60 FPS while Windows initially rendered near its 144 Hz display rate. That
gives Windows about 6.94 ms per target frame versus 16.67 ms at 60 FPS.
Rendering the same scene at 144 FPS requires 2.4 times as many frame updates
as at 60 FPS. Stable Mac FPS does not establish that its CPU work is unchanged.

The saved Windows CPU profile was captured **17:17:18–17:17:44 UTC**, not at
the final failure. It contains 16,664 samples. The first sample spans setup
and was excluded; the remaining weighted interval is 25.088462 seconds.

| Recorded path | Share of sampled interval |
| --- | ---: |
| Presentation/render animation callback | 69.29% |
| Scene/view update, included in the callback above | 33.44% |
| Pixi render path, also included in the callback above | 24.81% |
| Separate menu gamepad animation callback | 7.43% |
| Native getGamepads inside that menu callback | 6.68% |
| Mod quickbar removeEventListener | 2.35% |
| Incoming WebSocket message callback | 6.64% |
| Garbage collection | 2.00% |

Inclusive rows overlap. These are sampling elapsed-time shares, not additive
independent savings or guaranteed FPS improvements. Minified frames were
mapped to the exact built asset positions and source operations.

The actual workload also grew. Excluding startup and profiler windows, the
first ten-minute bucket averaged about 131 FPS, 4.2 secondary actors/effects,
and 1,563 KiB/s ingress. Later buckets reached roughly 73–80 secondary
actors/effects on average. Immediately before the final fault, snapshots
carried roughly 5,000–5,250 KiB/s to each client. Enemy and Maggot populations
also grew. The preserved scene object count itself stayed around 488 after
entrance retirement; increasing transient actors and update work must not be
misreported as proof of an unbounded retained-renderer leak.

There was also an earlier low-FPS, low-CPU interval, including a saved wave-30
frame displaying 1 FPS. Main-thread saturation alone does not explain that
interval. The telemetry records document visibility but not native window
occlusion/minimization or presentation scheduling, so its cause is unproven.

## 2. Two concrete sources of unnecessary client work

`frontend/src/game/input/gamepad-menu-navigation.ts:64–70` calls
`getGamepads()` before checking whether menu navigation has an active scope.
This separate polling loop continues during gameplay. Its native call took
6.68% of the sampled interval; all getGamepads call sites together took 6.80%.
Consolidate gameplay/menu sampling or gate inactive-menu polling, preserving
held-button neutralization, scope transitions, and reconnect behavior.

`frontend/src/game/mod-ui/ModSkillQuickbar.tsx:29–42` installs and removes its
keydown listener after every React render because the effect has no
dependency array. It does so even when the component subsequently returns
null for an empty mod quickbar. The captured removal call took 2.35%.
Use a stable listener with current data, and do not install one for an empty
quickbar. A dependency on a freshly recreated slots array would not solve
the repeated setup/teardown.

These are justified optimization targets. This investigation did not apply
or benchmark fixes. The larger remaining presentation/render cost should be
addressed through measured dirty updates, retained/batched work, and reduced
temporary allocation while preserving painter order and native effects.

## 3. Confirmed rendering failure and reproduced ownership boundary

Windows reported:

`Mage Air factory 28139 emitted a light without native manager registration`

`BoneyardSceneLights` resolves each Mage path-light creator's registration
only from the sampled enemy collection (`boneyard-scene-lights.ts:417–442`).
The pulse stores its owner ID but not that creator's light registration.
Meanwhile `interpolateEnemies` holds new enemy membership until blend 1,
whereas `mergeMageLightningPulses` merges pulse births from both snapshots
according to presentation tick. The lifetime contracts differ.

A diagnostic using the actual interpolation and pulse-plan functions
reproduced a boundary with **one admitted pulse, one generated path light,
and zero sampled owner enemies**. This proves a reachable interpolation
membership mismatch at the component boundary. It is a synthetic fixture,
not a reconstruction of the exact live frame or a complete native spawn
sequence. Other owner-retirement paths need regression coverage as well.

Fix the registration/lifetime contract end to end: keep the creator's
correct registration available for the lifetime of the pulse and align
sampling membership. Do not merely remove the assertion, invent an ordinal,
or silently discard the light. Add spawn, retirement, keyframe/delta, and
interpolation-boundary regression cases.

## 4. Late server overload is separate from the earlier Windows-only decline

At 17:53:10 the host was near 100 ticks/s with 596 Maggots. It then exceeded
1,900 Maggots and fell to approximately 40–60 ticks/s, with event-loop delays
approaching a second. The clients kept displaying frames while fresh world
updates became extremely sparse. Smooth render callbacks are not proof of
fresh simulation state.

`core-server/enemies/maggots.ts:67,122,477–486` still scans the ordinary enemy
array for each child's Coffin owner, with another search during admission.
A per-step live-owner index is a plausible bounded optimization; benchmark
it against the archived high-count state and preserve ordering, RNG,
admission counts, death/retirement semantics, and native spawn rules.
High-population snapshot creation, encoding, decoding, and replication are
additional targets. No specific speedup or complete cause of the terminal
snapshot starvation is established by this source inspection alone.

Client heaps spiked during the terminal incident (Windows reached roughly
2.2 GiB in a sampled page heap). Pre-fault heap values repeatedly fell after
GC and system RAM remained available. The evidence does not establish a
long-duration retained-memory leak; distinguish temporary allocation,
backlog retention, and live actor state with a dedicated comparison.

## Recommended order

First close the Mage light-registration lifetime defect. Then fix redundant
menu polling and quickbar listener churn. Next optimize the measured scene
update/Pixi paths and high-population server/replication work. Compare
identical scene captures at equal frame-rate targets; a 60 FPS diagnostic
comparison is useful but must not replace the requested stress workload or
be presented as an engine fix.

## Evidence and reproduction

- `client-events.jsonl`, `result.json`, `finalizer-receipt.json`, and
  `archive-summary.json` establish the terminal outcome.
- `windows.jsonl`, `mac.jsonl`, and `server.jsonl` establish frame cadence,
  task CPU, traffic, actor populations, and host cadence.
- Native Windows resource history:
  `C:\Users\User\AppData\Local\Temp\solomon-soak-6a583nbx\windows-resources-seventh.jsonl`.
  It continued across numbered attempts; use timestamps and browser PID
  17448 for the eleventh run, not the obsolete environment receipt's PID.
- `analyze-windows-profile.mjs` produces `windows-profile-analysis.json`
  with profile hash, weighted self/inclusive paths, and exact asset snippets.
- `reproduce-mage-owner-boundary.mjs` produces
  `mage-owner-boundary-reproduction.json`; the bounded reproduction exited 0.
- Full run archive:
  `archive-d6991d9e-9a9d-4e41-9222-663ecff5097b.json`.

Do not share `runtime.json`; it contains the private bootstrap credential.
