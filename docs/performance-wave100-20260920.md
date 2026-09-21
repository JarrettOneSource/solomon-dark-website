# Solomon Darker performance and Windows/Mac endurance run

Work session: `6a583nbx`, 2026-09-20. Base revision:
`fb9ec4bf9486e0fac5f76e9648c043614bb4d373`.
Candidate branch: `perf/wave100-6a583nbx`.

## Latest recovery — September 21, 2026

See [the recovery record](performance-wave100-recovery-20260921.md) for the
sixth run's final outcome, source verification, 260 passing focused tests,
and current Windows-access blockers. Wave-100 acceptance remains incomplete.
No game source was changed during that continuation.

## Historical status before the latest recovery

Four real Windows/Mac party attempts remain incomplete: waves 17, 28, 33 and 32.
The third ran from 20:04:08.328 to 21:19:46.329 UTC and failed when both clients
rejected `frame.world.entities.samples` exceeding 8,192 rows. Both closed with
code 4008; the later renderer-presence assertion describes the disconnected
scene. Its complete archive is intact. The fourth attempt ended at
23:57:05.697 UTC after both clients rejected the generated Cloudcover Hood in
player-1's backpack: `named equipment identity is inconsistent`. Both sockets
again closed with code 4008. Its original archive and telemetry are preserved
in `/Users/jarrett/codex-acceptance/solomon-evidence-6a583nbx/fourth-wave32.zip`
(SHA-256 `8e855aee55340293ea83c78f5791c60e2f4f9263567c3724cbc5bd3a3f26adae`).
The wave-100 target remains unmet. The named-equipment producer, media response
framing, decoder allocation and diagnostic-trigger corrections are implemented;
the fifth candidate is undergoing full validation before another live run.

The third candidate passed the full repository gate at 20:02:20.776716 UTC,
job `job_20260920T192709Z_76bd7f967e`, exit 0, with all 47 source files matching
manifest `89fdc52533592ff6fbb6ac498b3163ba8f78ad486e8ed56d69b9e79a606345f3`.
That pass predates the subsequent protocol/save-capacity, particle-ownership
and pilot fixes. Their focused checks and independent source review now pass.
The complete 63-file candidate was frozen at 22:20:12.484777 UTC under manifest
`2cbf964732126731214f667ff87afe3e6c92f0ebfd2c757f0993d4cb31889965`.
Its canonical gate passed at 22:50:54.233208 UTC as
`job_20260920T222020Z_404ac2aae7`, exit 0. All 63 source hashes and the complete
source set were verified unchanged before the continuation fixes. Its selected renderer modules had 100% coverage,
441 killed mutations, one timeout, 142 compile errors, 23 existing ignored
equivalents and zero survivors. The client build records 155 files. The fourth
monitor started at 22:53:57.101 UTC, joined both players at 22:54:13.066 UTC,
and entered Boneyard at 22:54:17.151 UTC. At 23:24:28 UTC both clients were
at wave 21 near 60 FPS, with host cadence near 100 Hz and no Lua failures.
Those readings predate the fourth attempt's failure. Two combat-MP3 request cancellations
remain in the raw error record; Windows playback continued normally during
a passive 23:18:58.447–23:19:03.811 UTC observation. Mac playback continuity
is unverified. This does not establish the cause of either cancellation.

The corrected fifth candidate contains 67 non-documentation source files,
frozen at 01:19:21.032704 UTC on September 21 under manifest
`835c8b8d2f1c8b30b0084a93f441115cf7ee2496b1931ec244f2bc83f3c2224d`.
Canonical job `job_20260921T011922Z_359f785ac4` is running. Its preceding gate
stopped on a new container-test fixture that omitted normal inventory-slot
materialization; the fixture now uses the production insertion helper, with
its exact color and identity assertions preserved. All 47 named-recipe
creation tests and the corrected retention test pass in the restarted gate.

The full-message decoder comparison preserves all four native Faculty
keyframe/delta payloads and 146 malformed/boundary outcomes, while reducing
decode wall time by 22.79–24.58% and sampled collected allocation by 58.68%.
See [the scoped decoder evidence](performance-entity-decoding-20260921.md).
These are decoder measurements, not a claim about whole-game FPS.

## Changes and measured scope

The server avoids expensive ordinary death-effect object spreads, reuses
projections of immutable scenery tables, and constructs optional light fields
only if a consumer samples them. Two matched comparisons reduce process CPU
time by 68.2% and elapsed simulation time by 72.9%, with identical complete-state
and ordered-JSON hashes at twelve checkpoints and the final tick. The benchmark
covers 62,500 ticks through wave 9, not the final browser endurance run. See the
[detailed measurements and evidence](performance-light-query-20260920.md).

The renderer now explicitly unloads and destroys geometry and buffers owned by
secondary effect meshes, spider silk fragments, Hagatha seeker segments, enemy
underlays, and boss spell meshes. Shared textures retain their existing owners.
Tests exercise retirement, mesh-count shrinkage, scene destruction, and 100
repeated spider-fragment cycles. This fixes missed immediate resource release;
it is not evidence that an unbounded GPU leak had already occurred.

The client removes a per-quad captured writer, skips redundant public rain-tint
assignments, creates painter diagnostics only on failure, and avoids an
intermediate death-effect copy during interpolation. Matched isolated workloads
show less allocation with equal buffers, colors, diagnostics, and owned sample
values. These are path measurements, not a whole-game FPS comparison. See the
[client allocation receipt](performance-client-allocation-20260920.md).

The final wave-17 archive contains 617 correctly bounded Maggots alongside 113
enemy actors. Enabling the existing ordered collision index reduces root pair
visits from 137,804 to 5,968 while preserving every overlap, recursive push,
contact, and full state hash. Matched heavy-state trials use 22.7% less process
CPU. This is a separate comparison with all preceding optimizations present in
both variants. A historical worst-tick fixture remains expensive. See the
[collision measurements and limits](performance-collision-grid-20260920.md).

## Test topology and pilot

Both clients use the built web port at a private loopback origin. The Mac mini
runs the authoritative Node host. A task-owned SSH tunnel connects native
Windows Chrome to that same host. Both browsers join the same party and run.
The public website and its services are not changed by this setup.

- Mac: Apple M2, 16 GiB RAM, 1920×1080 display at 60 Hz.
- Windows: Radeon RX 9070 XT, 31.8 GiB RAM, 1920×1080 display. The first
  three attempts reported 144 Hz; fourth-attempt startup reported 60 Hz.
  The timing and cause of this display-mode change are unestablished. Compare
  frame pacing with each attempt's recorded mode, not across these modes.
- Browser game viewport: 1600×900, headed Chrome with hardware acceleration.
- Server simulation: ordinary 100 Hz; replication: ordinary 20 Hz.
- Pilot modification: `incoming_damage=0` only. Mana use, damage dealt, skill
  offers, collision, enemy spawning, and wave timing retain normal game rules.

The isolated Lua pilot uses the supported `player.control` reducer. It walks
the normal entrance, aims and attacks through ordinary inputs, collects nearby
loot, and selects offered skills. It periodically releases its primary button:
Air and Water need a new press after an interrupted channel. The initial pilot
held that button through its skill selections and could not rearm Air. The
scenery target left in its inactive cast state was not proof of a target-lock
bug. No automatic channel rearming or native targeting rule was changed.

## Initial shakedown

The corrected status fixture completed wave 1 and entered wave 2 on both real
clients. Both remained alive, gained experience, and reached level 3. It was
deliberately stopped to obtain controlled CPU comparisons. This was not a pass
of the originally configured five-wave target.

Evidence: `/tmp/solomon-party-shakeout2-6a583nbx/planned-stop.json` and its
client/server JSONL files and archive. Steady samples showed approximately
60 FPS on Mac and 130 FPS on Windows, 100 simulation ticks/second, and 20
snapshots/second. No browser errors or Lua rule failures occurred in the
corrected fixture. A startup replication backpressure warning recovered; final
shutdown warnings belong to the deliberate early stop.

The first fixture attempts are retained separately: one incorrectly waited for
an invitation after automatic same-party admission; another used an unresolved
status handle. These were test-harness failures and are not counted as game
passes or production defects.

## First endurance attempt: wave 17, incomplete

The monitor ran from 15:10:14.832 to 15:28:54.151 UTC (18 minutes 39 seconds),
with both clients in the Boneyard by 15:10:34.207. Both reached wave 17 in party
`party-SM2KAcjQvs_WrClCuRkVQTF7`, run
`dde7bd4a64e2d4369f7d1722edbfb427`. The original `result.json` records
`completed=false`, `passed=false`, and `highestWave=17`. Both characters were
alive at level 17 when the fixture closed the host. This is an incomplete
endurance attempt, not a wave-100 pass.

The corrected Air button policy survived repeated skill offers. A passive
10-second inspection of existing renderer diagnostics at 15:15:48–15:15:59
showed visible Air bolts and nearby enemy health loss, including its
authoritative target while Fire was roughly 900 units away. Air's
`primaryEmissionSequence=0` is expected: the kernel emits its channel pulses
without incrementing that counter. Cast-sequence growth alone was not used as
proof of useful damage.

The party defeated Ironmaw (320 HP; no longer living by 15:21:18.673) and
Heartmonger (2,000 HP; no longer living by 15:27:28.718). Heartmonger's recurring
adds did not prevent boss damage or completion. The native recipe UID and
observed boss ordinals match map source
`efa240ce741df0f781228206d024bb1903c7210d1163eccf80c87e835365422f`.
Foulshaft at wave 20, Faculty at 32, and Discorporeal at 41 remain untested by
this attempt.

The host logged `mods.rule_failed` at 15:28:07.502, 15:28:07.510, and
15:28:49.001. Each message was
`local.performance.party-soak:pilot: thread timeout exceeded`; none was an
invalid intent or schema error. The first pair was followed by approximately
41 seconds of successful pilot activity. The fixture nevertheless treated the
third lifetime error as fatal and initiated graceful host shutdown. Both host
and browser-monitor jobs exited 1, and the archive was written. The 12 browser
error events all followed that shutdown, beginning with close code 1012
(`server shutdown`); subsequent font requests failed after the static server
closed. They remain in the original evidence and are not independent browser
crashes.

The archive contains 109,294 measured simulation ticks, mean 1.715 ms,
worst 77.669 ms, and 254 ticks over budget. Those timings exclude Lua dispatch
and replication. Immediately before shutdown, the host sample reached about
102% of one CPU core, event-loop p99 about 100 ms, and 113 living enemies;
observed tick cadence remained about 99 Hz. These are observations from this
attempt, not a controlled comparison against its predecessor.

Evidence directory: `/tmp/solomon-party-wave100-6a583nbx`. The original
`result.json`, `archive-summary.json`, full archive, client/server JSONL,
screenshots, and `abort-receipt.json` are retained. Host job:
`job_20260920T150951Z_e5e8a65bb2`; browser job:
`job_20260920T151012Z_1b252f1ada`; Mac system monitor:
`job_20260920T151055Z_1fc47d5adf` (stopped gracefully, exit 0).

## Native guard policy and fixture correction

The prepared Lua VM keeps its native 2 ms callback timeout and the mod dispatcher
keeps its 4 ms transaction budget. Native `ModRuleEngine` clears a reducer's
failure count after each successful invocation and disables it after three
consecutive failures. Its internal lifecycle reason is
`reducer-circuit-open`. The new fixture's cumulative three-error abort was
stricter than that policy and incorrectly ended a recovering session.

The host fixture now retains every `mods.rule_failed` event and records both
`ruleFailures` and `ruleTimeouts`, including their final values in the archive
summary. The browser monitor observes the actual native `disabled` flag in
ordinary `server-save-checkpoint` payloads:
`JSON.parse(message.save).modState[modId].runtime.reducer_health[]`.
It retains each reducer's mod ID, key, consecutive-failure count, and disabled
state, and fails if the pilot is disabled. Decoding happens in the monitor's
existing Node-side WebSocket listener; no full-save parsing was added to the
game page. GameHost does not publish a distinct circuit-open log event, so the
monitor does not infer one from a timeout count.

Periodic checkpoints occur every 30 simulation seconds, with additional
lifecycle checkpoints. In ordinary active play, the disabled flag is therefore
observed within that interval plus the five-second monitor sample. A frozen
simulation can delay periodic saves; the existing wave-stall, death, and
disconnect guards remain backstops. No native timeout, failure threshold,
combat rule, or prior failure log was changed.

The focused `guard-policy-check.json` used the real Wasmoon and ModRuleEngine
with unchanged native budgets. Three deliberately injected errors, each
followed by a successful invocation, left the reducer enabled and reset its
counter to zero. Three subsequent consecutive errors disabled it with a count
of three. This verifies the policy distinction; it is not a reproduction of
the timing cause of the original wall-clock overruns. Both edited fixture
scripts also passed Node syntax checks before the source freeze.

## Client allocation and frame-pacing follow-up

Most steady samples rendered approximately 60 FPS on Mac and 130–134 FPS on
Windows, with about 100 server ticks and 20 snapshots per second. Windows had
brief main-thread saturation: the 15:17:46/51 windows rendered 119/115 FPS,
with frame p99 of 13.1/16.3 ms, no long tasks, and CDP TaskDuration rates of
98%/95%. Those rates are CDP task time divided by observation duration, not OS
process CPU measurements. The wave-10 screenshot had completed at 15:17:26, followed by three
130–132 FPS windows before the dip; screenshot attribution is not supported.
Windows returned to 132 FPS in the next window while Mac stayed near 60 FPS.

A separate Windows hitch at approximately 15:21:44 had a 383 ms long task and
a 403 ms frame. Its five-second sample coincided with JavaScript heap falling
from about 800 to 250 MiB and DOM nodes from 11,794 to 1,109. Snapshot flow
control reached its eight-snapshot high-water mark, then recovered in 69 ms
after skipping two snapshots, without disconnecting. Mac's nearby natural
heap collection fell from about 657 to 223 MiB with a brief 58 FPS window.
These observations support allocation churn and garbage collection; they do
not establish persistent heap or DOM retention. Separate Mac samples record
machine contention and aggregate RSS of the owned Chrome descendants; that
RSS includes shared pages and is not private or physical browser memory.

A passive Windows CPU and allocation profile ran from 15:26:37.434 to
15:27:08.678 UTC. CPU sampling used a 1,000 microsecond interval; heap sampling
used 64 KiB and included collected allocations. No forced garbage collection
or full heap snapshot was used. This interval is explicitly marked as
profiling overhead in `windows-profile-events.jsonl` and must be separated
from ordinary performance comparisons.

The profile estimated about 4,379 MiB of allocation over 31.2 seconds, across
presentation interpolation, quad packing, rain/color normalization, painter
ordering, and render updates. That quantity is sampled allocation volume, not
retained heap. CPU self samples included approximately 1.90 seconds in native
`getGamepads`, 0.62 seconds in painter `append`, 0.56 seconds in a Boneyard
`update`, and 0.53 seconds in garbage collection. Production source maps were
absent; the saved summary retains built-file URLs, line/column locations, and
call paths for attribution. These measurements motivated the renderer
allocation follow-up; its validation and retry results are tracked separately.

Profile evidence in the attempt directory: `windows-cpu.cpuprofile`,
`windows-allocations.heapprofile`, `windows-profile-summary.json`, and
`windows-profile-events.jsonl`. The passive Air inspection is retained as
`air-damage-probe.json`.

## Final validation and endurance results

Complete validation job `job_20260920T142818Z_5be73fd746` passed on the Mac at
15:07:15 UTC, exit 0, using `./scripts/validate.sh`. The scoped renderer quality
gate reported 100% statement/branch/function/line coverage and no failures;
mutation results were 398 killed, one timeout, 142 compile errors, and 23
documented ignored mutations. No mutation survived. Follow-up
`./scripts/validate.sh lint` job `job_20260920T150735Z_bbcf54afd5` passed at
15:07:56 UTC after the fixture's bounded boss telemetry was added. The deployed
game service and Mac measurement runtime both use Node 22.17.0. Those successful
checks precede the four client reductions and collision-index change.

The first follow-up gate caught typing errors in two new test fixtures; those
were corrected and test typechecking passed. The next gate was deliberately
cancelled before the collision fix. The gate started at 16:11:05 then passed
2,379 Boneyard tests but timed out in the existing complete Sorceror action
sequence test. That exact case passed in isolation in 130 ms without a source
change, job `job_20260920T161743Z_5135cf6416`. The timeout has not been reproduced;
the unchanged complete gate restarted at 16:18:47 as
`job_20260920T161847Z_2f2bb67d9e`. That attempt stopped in an unrelated Lua
definition test after its 250 ms definition-script budget expired while the Lua
test files were running concurrently. The `test:web-lua` command now uses
`--test-concurrency=1`, matching the existing serial Lua runtime test command.
All tests and native runtime budgets remain in place. The final complete gate
restarted at 16:24:00 as `job_20260920T162400Z_ff859d3a49`. All ordinary tests
and the production build passed. Its mutation phase finished at 17:01:43 with
440 killed mutations, two timeouts, 142 compile errors, 23 existing documented
ignores, and one survivor. The sole survivor, ID 312, changed the last
`index++` to `index--` in the unrolled buffer writer. Both postfix operations
write to the same original index; the changed local counter is never read
again. This is an equivalent mutation, with no output difference.

The final store now uses `index` directly, removing the redundant update. The
two focused buffer-packing tests, including all 72 quad combinations, the full
test TypeScript check, and the diff check passed in
`job_20260920T170326Z_4337f3a20e`. No mutation ignore or threshold changed. The
proof and source hashes are retained in the retry directory as
`mutation-equivalence-162400.json`. Complete validation restarted at 17:04:18
as `job_20260920T170418Z_997281b37c` and passed at 17:36:32 UTC, exit 0.
The final renderer gate reports 100% coverage of 380 statements, 114 branches,
72 functions, and 353 lines; mutation results are 441 killed, one timeout,
142 compile errors, and 23 existing documented ignores, with no survivors and
no quality failures. `validation-receipt.json` retains the complete final
quality summary and the verified source-manifest SHA-256:
`b65a2ebbaf5d486359e57293e5368ded4f917e13060e9e69e58ab2081673f596`.

Second endurance outcome: failed at wave 28. The original candidate hashes remain in
`/tmp/solomon-candidate-manifest-6a583nbx.json`. The retry's 29 changed/new source
files are frozen in
`/tmp/solomon-party-wave100-retry-6a583nbx/source-manifest.json`, alongside
the prior attempt receipt and exact launch settings.

The retry uses party `party-gQNOsToIoEsnAemUYq5XDlMU` and run
`2f40b83ea5d1eabbf84442c74f680683`. Host job
`job_20260920T173731Z_ce064fafa7` started at 17:37:33 UTC; the active browser
monitor is `job_20260920T174148Z_870e57cfc4`, started at 17:41:50.620 UTC.
The first browser launch at 17:37:45 failed before either player joined because
the dedicated Windows browser had exited while idle. Its last live resource
sample was 17:11:30.993 and first absent sample was 17:12:01.775; no matching
Windows Application crash event was found, so its cause remains unknown.
The dedicated headed browser was restored at 17:40:44.532 UTC, retaining its
profile and GPU-enabled settings. `windows-browser-recovery.json` and
`setup-failure-173745/` preserve the setup failure separately from gameplay.

This retry generated a different native encounter layout, source SHA-256
`e62e5e847562d822382fba14709d5367c9cd7de40f8b4fa52ecea3bfc8d9a430`.
Its boss ordinals are Ironmaw 15, Heartmonger 17, Foulshaft 31, Faculty 33, and
Discorporeal 42. `source-identity.json` retains the ordinary save-checkpoint
evidence. An additional passive Windows checkpoint listener ran for about
30.5 seconds ending at 17:53:09.190 UTC; its start time was inferred from the
tool duration rather than explicitly recorded. No save, gameplay input, CPU
profile, or heap profile was requested during that inspection.

Both clients recorded `net::ERR_ABORTED` for the combat MP3 at
18:02:51.679/681 UTC. The raw monitor counter remains two, which will prevent
its strict zero-error criterion from passing even if both players complete
wave 100. Passive Windows media observations subsequently showed advancing,
fully buffered playback with no media error. The exact cancellation trigger
and Mac audio continuity remain unverified. These events are retained for
separate adjudication; they are not erased or treated as browser crashes.
The review also found a response-close/error cleanup gap in the shared static
file helper. The original frozen source remains attached to this failed attempt;
subsequent corrections are listed below and require another complete gate.

The authoritative fatal event occurred at 18:33:08.446 UTC, tick 332807, after
both clients entered wave 28. A radius-45 LIGHT spawn from
(1072.62109375, 550.5117797851562) exhausted placement. Both sockets then closed
with code 1011; the monitor's later renderer-disappearance assertion was a
consequence of that server failure. The monitor ended at 18:33:12.270 UTC after
51 minutes 21.650 seconds, with completed=false and passed=false. The two earlier
MP3 cancellations plus 16 disconnect/resource aftermath events account for the
raw client counter of 18. No native Lua failure or timeout occurred.

The two original archive files are zero bytes and unusable: the native fatal
path rethrew before the fixture's asynchronous writes flushed. The logs,
screenshots, narrow source/skill extracts, and failure-receipt.json remain intact;
none is described as a restorable final archive. The final valid client samples
both show wave 28 and alive level-31 characters. The last periodic host sample
was wave 27, shortly before the fatal tick.

Steady five-second samples, excluding the first 30 seconds after each stream's
first valid Boneyard sample, give 59.94 FPS on Mac, 134.54 FPS on Windows,
99.94 host ticks/s, and 45.06% host process CPU on a one-core basis. Windows also
had a sustained wave-22 slowdown: 95.23 seconds of windows below 90 FPS, with a
lowest five-second average of 50.77 FPS. The whole attempt has 100.23 seconds of
windows below 90 FPS. Those durations sum complete windows, not exact per-frame
time. Minute averages obscured that dip during monitoring; future status and
conditional CPU diagnostics must expose it directly. Stable DOM counts during
that dip do not establish a banish-canvas explanation.

The largest Windows frame was 507.9 ms, coinciding with heap 1042 to 223 MiB and
DOM nodes 15010 to 923. Replication backpressure recovered in 162 ms after four
skipped snapshots. Mac's largest steady frame was 153.1 ms. These are real
observations, not profiler-attachment artifacts; no CPU or heap profiler was
attached during this attempt. Passive checkpoint and media inspections remain
included and documented. Source-level follow-up and the next run must establish
which remaining hitches improve.

Post-failure corrections now include:

- Shared native spawn retry: fresh retail instructions prove that LIGHT, policy
  1, changes to DIRECT only after the ring radius is strictly greater than 350,
  then restarts at twice the actor radius. The port had assigned that transition
  to DARK and used an inclusive comparison. The exact-map reproduction changes
  from 23/32 successful seeds to 32/32; the nine previously failing seeds also
  materialize the real first-phase Deep Portal through the full world path.
  Collision/navigation/world checks pass 74/74. The native upstream point
  selectors remain separately documented coordinate-parity limitations; this
  correction does not claim complete native spawn-coordinate equality.
- Static stream ownership: pipeline now closes the file when a download is
  aborted and handles source read errors. The original abort-under-backpressure
  case reproduced an open descriptor; the fix passes all seven Mac desktop
  tests. This does not prove the cause of the earlier MP3 cancellations.
- Banish gradients retain six canvas/texture owners per effect. Two independent
  real-browser comparisons each cover 3,144 view samples with exact output,
  while reducing canvas creation from 18,720 to 72. The pixel-readback
  instrumentation asymmetry and limits are documented in
  performance-banish-gradient-20260920.md.
- Air, Weld, and Water geometry owners now notify Pixi's resource manager before
  destroying owned buffers, preserving clipped-display reuse and shared
  shaders/textures. The coordinated renderer suites pass 39/39; the canonical
  test typecheck now explicitly includes all modified lifetime tests.
- Terminal fixture archive/error writes finish synchronously before the native
  fatal rethrow. A real-recorder forced-failure probe exited 1 with a complete
  3,313,370-byte archive and no post-error continuation. This separately verified
  correction does not repair the original empty files.
- Latest owner checkpoints are now saved with bounded coalescing, atomic
  replacement, mode 0600, and redaction of the rejoin credential. The writer
  reuses the monitor's existing decoded save and does not mutate game state.
  Its probe verifies final parseability and sticky write failures during flush.
- An opt-in Windows CPU diagnostic uses the existing CDP session after four
  consecutive healthy five-second windows below 90 FPS. It captures once for
  25 seconds at a 1,000-microsecond sampling interval, without heap profiling or
  forced GC. Sixteen lifecycle probe cases pass, including startup/shutdown
  races and command/write failures. The probe profile is explicitly synthetic.
  All failures remain counted. Trigger through finalization events delimit
  setup, capture, teardown and writing for separate performance summaries.

These checks are focused follow-up evidence. Complete validation of the new
combined tree started at 19:10:43 UTC as job
`job_20260920T191043Z_437a63b5f2`. Its 46 non-documentation source files were
frozen at 19:10:32 UTC with manifest SHA-256
`ffb3d070fe676226bf018b4b4cd6a69184dc94bc0dc69694f54d29f59f3d437a`.
An independent read-only review found no defects in the native retry,
gradient, geometry, or static-stream changes. This gate and the renewed
two-client wave-100 run were still pending at that review.

The gate then exited 1 at 19:14:28 UTC with two failures in
`game-simulation.test.ts`: same-tick wave registration and retail run-edge
combat admission could not place a DARK spawn in their test worlds. The
failed 46-file manifest is preserved as
`source-manifest-validation-failed-191043.json`. Investigation must distinguish
invalid fixture geometry from a runtime regression without restoring the
proven-wrong DARK fallback. No third gameplay attempt has started, and the
second attempt remains failed. Full validation must pass after the correction.

The fixture investigation proved both original combat domains were entirely
lit: 500-by-500 cleanup scenes left only a 500-by-100 spawn strip after the
native entrance exclusion. The player light ellipse contains all four corners
of each legal-center rectangle, and 31,824 indexed samples per fixture found
zero DARK points. A width-only trial remained unsuitable for the deterministic
ring search. The final change gives only these two tests complete 1000-by-1000
arenas. All actor coordinates, inputs, assertions, registration ordinals and
combat-admission checks remain intact. The changed entrance branch is outside
their asserted behavior and is recorded in parity entry 159.

All 156 simulation, collision, navigation, and world tests and the canonical
test typecheck pass in job `job_20260920T192416Z_8b5425e48f`, exit 0 at
19:25:09 UTC.
The runtime collision SHA remains
`36e1a53a3a1bc1445e71c1eadb80cc0bddbe2ad6a0d0edd1570b48eb52399d5f`.
The corrected 47-file candidate was frozen at 19:27:08 UTC with manifest SHA
`89fdc52533592ff6fbb6ac498b3163ba8f78ad486e8ed56d69b9e79a606345f3`.
Complete validation restarted at 19:27:09 UTC as
`job_20260920T192709Z_76bd7f967e` and passed at 20:02:20 UTC with exit 0.
All 47 source files and the complete changed source set still match the
manifest. The selected eight renderer quality modules have 100% measured
coverage: 380 statements, 114 branches, 72 functions and 353 lines. Mutation
results are 441 killed, one timed out, 142 compile errors, 23 existing ignored
equivalents and zero surviving mutations; the quality report has no failures.
The production build manifest additionally identifies its entry HTML and 154
JS, CSS and WASM files under assets. The third party attempt subsequently failed at wave 33; its source remained
frozen. The next candidate requires a separate full gate. Wave-100 acceptance
remains outstanding until both clients enter 101.

The final endurance test must observe both clients beyond wave 100 (entering
wave 101), remain in the same authoritative run, and record frame pacing,
long tasks, heap, process memory/CPU, snapshot cadence, server event-loop
delay, errors, disconnects, and final archive tick timings. Raw browser ingress
counts decoded payload bytes rather than compressed wire traffic. Existing
unrelated Mac work is preserved and its load remains a measurement limitation.

Both clients are observed through Chrome DevTools Protocol. The Windows
controller also transports observed WebSocket payload events over the SSH
tunnel, adding measurement overhead. The host archive measures the simulation
step itself; it excludes Lua dispatch and replication. Process CPU, event-loop
delay, and observed tick cadence cover that additional host work. Per-window
frame percentiles must not be described as a single percentile over every
frame in the session. Heap low watermarks are natural observations, not a
forced-garbage-collection retention test.

The host fixture records living enemy count, Maggots, death/projectile effects,
primary projectiles/transients, secondary actors, and a bounded list of authored
bosses with health. This exposes crowd load and distinguishes an add-clearing
bot from one making boss progress. Separate 30-second system samples record
competing machine load.

## Third endurance failure and remaining measurements

The third output is `/tmp/solomon-party-wave100-third-6a583nbx`. Its original
result is `completed=false`, `passed=false`, `highestWave=33`, `errorCount=6`.
The two early events are combat-MP3 cancellations; the other four are the two
protocol errors and resulting socket closes. Windows playback subsequently
continued in a passive observation. Mac audio continuity and the exact cause
of these cancellations remain unverified. No event has been suppressed.

Profile-excluded steady observations give 59.98 FPS on the 60 Hz Mac display and
133.75 FPS on the 144 Hz Windows display. The lowest five-second averages are
57.57 and 63.03 FPS; the largest frames are 147.3 and 80.2 ms. Windows has 160.36 s
in complete unprofiled windows averaging below 90 FPS and none below 60 FPS.
Natural client heaps span 100.2–739.6 MiB and 109.5–780.7 MiB; DOM nodes span
832–1,393 and 821–1,387. These different runs are not controlled before/after
FPS or memory comparisons.

The host averages 99.77 ticks/s and 49.82% process CPU on a one-core basis. An
incident near 20:52:43–20:53:25 falls to 53.91 ticks/s with 953.7 ms loop delay and
briefly about 0.8 received snapshots/s on both clients, then recovers. No host
CPU profile was started. The saved post-recovery owner projection is not the
exact stalled two-player state. The intact archive measures 450,727 core steps,
mean 2.428 ms, with 6,206 above 10 ms; its 99.921 ms worst step is near opening tick
4,626 and cannot explain the later host-loop incident. Core timing excludes
Lua dispatch and replication. Coarse unrelated machine load is preserved.

A real Windows CPU capture ran 20:40:00.660–20:40:26.178 including setup and
teardown. All overlapping windows are excluded from the separately named
steady summary and retained in raw data/plots. The 435.4 ms frame during setup
is not treated as ordinary gameplay. The 25.432341 s summed profile contains
16,682 samples. Dynamic scene update accounts for 36.14% inclusive time and
Pixi render-group update 25.75%; nested inclusive percentages are not additive.
Native gamepad polling accounts for 7.58%, mostly menu navigation. Its inactive
poll maintains input history; an early return would change modal behavior.
These attributions do not themselves demonstrate further safe optimizations.

All 77 native Lua failures were isolated 2 ms callback timeouts; final reducer
health was failures 0/disabledfalse for both pilots. A long Fire approach delay
at an obstacle eventually recovered without intervention. The subsequent pilot
change retains an escape direction and stops scanning distance-sorted loot
once no later row can qualify. Its focused proofs now pass, as recorded below;
native budgets, damage, mana and rules remain unchanged.

The final protocol burst is Faculty dying-bone smoke. A bounded native
lifecycle reproduction confirms effects retire, while current protocol caps
reject valid snapshots and compact frames. The subsequent finite-capacity fix and protocol-version bump pass focused
regressions, as recorded below. Smoke cadence, effect visibility and simulation
behavior remain intact.

The failure receipt, raw telemetry, archive, source/build/validation manifests,
CPU profile, screenshots and bounded read-only reviews have been copied with
checksums. Archive SHA-256:
`acecc9a0ed8d1daeb589eb3802042c5cb2ff2cab183271b0e9323ff5fa66c1ec`.
The evidence package retains this failure separately from any future run.

## Focused fixes after the third failure

The native Faculty lifecycle generates a large bounded population. Replaying
one death reaches 8,483 visible effects; three overlapping deaths reach
25,335. All effects retire. Both the former per-family and aggregate 8,192-row
limits reject this valid workload. Protocol version 128 admits a conservative
native-derived 62,156 death effects and the sum of all seven family capacities,
77,259 entity rows. The unrelated spider bounds remain 8,192. The 2,200-tick
one/three-Faculty replay passes actual JSON raw/keyframe/delta encode/decode
with no retirement failure. The exact originally rejected packet was not saved;
these are reproduced native peaks, not a claim about its exact population.

Actual owner saves exposed two independent limits: the single-death save has
430,524 JSON values and exceeds the old 250,000-value guard; the triple save is
23,201,670 bytes and exceeds the old 16 MiB guard. Frontend and backend now
share a finite 96 MiB / 3,000,000-value envelope, with matching scoped save and
rejoin HTTP transport capacity. Conservative native accounting is documented
in parity ledger 301 and `performance-faculty-protocol-20260920.json`. Native
peak checkpoints restore every death-effect value with exact deep equality
and matching canonical hashes. Real Kestrel save PUT/GET/rejoin and actual
signed Node HTTP/WebSocket recovery pass with a genuine peak save padded by
legal whitespace to 50 MiB. Above-node-limit input still rejects.

Authentic saved checkpoints also exposed ownership-classifier omissions. Four
Faculty smoke roles allow their native pre-world choice, and exact Zombie
rotten-gas / Wraith-wisp kind-role combinations now restore their fixed
pre-world ownership. Actual producer emissions and invalid-owner regressions
pass. These are save-admission corrections, with no particle producer changes.
The final 47 save tests, test typecheck and changed-file lint pass in
`job_20260920T221531Z_61ece1d49d`; the earlier actual transport checks have their
own receipts. Larger valid bursts retain their real runtime and save cost.

The pilot retains an escape vector for 30 decisions and bounds its scan of
already distance-sorted loot. With the exact captured wall geometry, actual
Lua and ordinary player acceleration/sweep/slide, the original stays within
8.43 units for 30 simulated seconds; the candidate escapes 150 units in 3.41 s
and reaches 866.73 units. Dynamic bodies and nonmovement state are frozen in
that probe, so it proves static navigation only. Six actual saved checkpoints
and eight boundary/tie cases produce identical loot inputs and reducer states
with zero Lua errors. Scanned rows in the six checkpoints fall from 383 to 44
(88.5%); this is not a measured runtime reduction. Pilot SHA-256 is
`42fe4b806b9376d203cb52b7891cfe89c044fa1bdd5bc98c77b61b8f4b1bd318`.

A one-shot host diagnostic is ready for the next real run. It triggers on a
fresh valid window below 90 ticks/s with loop delay above 500 ms and a nearby
host backlog/tick-lag event. The real 45-second Inspector start/stop/disable,
socket detach and port closure passed on an idle disposable Node process;
no game code was imported for that proof. Twelve watcher cases and eight
profile-exclusion cases pass. No real game-host profile has yet been captured.
The full diagnostic interval will be retained in raw observations and excluded
from separately named steady summaries. Normal host shutdown waits for its
cleanup receipt when profiling is active.

## Fourth endurance failure and continuation

The original `/tmp/solomon-party-wave100-fourth-6a583nbx/result.json` records
`completed=false`, `passed=false`, `highestWave=32`, and six raw errors: two
combat-MP3 cancellations, two matching equipment decoder errors, and two
socket closes. The renderer-presence assertion is the disconnect aftermath.
Both pilots retained zero Lua failures and timeouts. The intact archive has
376,129 core ticks, a mean of 2.201 ms, and 1,032 ticks over its 10 ms budget.
Its 327.978 ms worst tick overlaps Inspector startup and must not be presented
as an ordinary unprofiled worst tick.

With startup and both diagnostic intervals excluded, 738 complete five-second
windows per client average 59.971 FPS on Mac and 59.951 FPS on Windows, weighted
by duration. Their lowest window means are 54.05 and 53.81 FPS; largest frames
are 107.1 and 127.7 ms. Neither has an included window below 50 FPS. Natural
heap ranges are 117–724 and 125–747 MiB, with recurring later troughs around
130 and 158 MiB; this does not show monotone heap retention. The 741 included
host windows average 99.911 ticks/s and 49.45% of one CPU core. Three paired
replication-backpressure incidents last about 3.0–3.75 seconds and skip
58–64 snapshots per client before recovering. These are latency incidents
even though rendering generally stays near the two 60 Hz displays' cadence.

Host replication stalls before 23:56:53 were real and preceded the conditional
45-second profile. The profile started after recovery and continued mostly
in the empty hub after the equipment disconnect. It therefore cannot identify
the cause of the preceding stalls. Its cleanup receipt confirms stop, disable,
detach and inspector-port closure. The idle host and Mac resource sampler were
then stopped cleanly by the resumed session at 00:59:21 UTC on September 21;
the browser monitor had already exited 1. The Windows tunnel and resource
monitor remain available for the next run.

Windows was measured at 60 Hz at fourth-run launch. The prior fixed 90-FPS
diagnostic trigger therefore fired on normal display-limited rendering. The
monitor now accepts `SDR_SOAK_PROFILE_MIN_FPS` (default 90), records it and
passes it to the profiler. Use 45 for a confirmed 60 Hz display; retain 90 for
the earlier 144 Hz display. This only changes diagnostic admission, and
preserves every raw frame sample and error. Its configured-threshold and
lifecycle regressions are included in the canonical diagnostics gate.

The actual shared static file server now returns each file's `Content-Length`
for GET and HEAD, reusing its existing file stat. Two isolated native Mac
Chrome baselines with the real combat MP3 each reproduced a redundant second
download and `net::ERR_ABORTED` after the first native audio loop. Media state
remained healthy and playback continued. Both the length-only comparison and
a final replay against the patched server completed two loops with one
download and zero request or media failures. The test accelerated audio
playback to 16x and changed no game code. This proves a redundant-transfer
correction; it does not prove an acoustic dropout occurred or establish the
exact historical Windows cancellation trigger. Receipts and source hashes
are in `/tmp/solomon-audio-6a583nbx/summary.json`. The full canonical gate and
renewed ordinary Windows/Mac session remain the final checks.

The named-equipment regression was added before its producer correction.
Canonical job `job_20260921T010356Z_2288cc26a3` exited 1 in `test:loot` with
110 passing and exactly ten failing tests, all reproducing the strict named
identity error through actual loot creation, pickup and inventory decoding.

The producer now materializes named garment colors through the native clone
path: missing trim becomes white, missing primary colors consume the native
palette and jitter draws, and garment colors receive native desaturation.
Cloudcover Hood now carries `0x98c6c6` plus white with no random draws.
All 47 named recipes pass real drop, pickup and strict inventory decoding;
13 garment cases also cover replication, equip appearance, both dyes,
checkpoint/save restoration, storage and nested sacks. The strict protocol
and save validators are unchanged. A 1,000-item ordinary generated-loot
comparison retained identical outputs and RNG state. Native evidence and the
separate deferred Dowsing parity gap are recorded in ledger 100.

The entity decoder now copies healthy numeric rows directly into owned arrays.
Malformed inputs retain the original validation path and messages. Four real
one/triple-Faculty keyframe and delta payloads remain deeply equal, with owned
rows; 146 malformed and boundary cases retain the same outcomes. The bounded
ABBA comparison measured 22.79–24.58% lower decoding time and 58.68% fewer
cumulatively sampled allocation bytes in its separate allocation probe.
These are decoder measurements, not live server-tick or retained-heap claims.
See `performance-entity-decoding-20260921.md` and its JSON evidence.

The unchanged 67-source candidate passed the complete `./scripts/validate.sh`
gate in `job_20260921T011922Z_359f785ac4`, from 01:19:22 to 01:49:58 UTC on
September 21, with exit code 0. The scoped renderer quality suite reports
100% coverage, 441 killed mutations, one timeout, 142 compile errors,
23 pre-existing ignored equivalent mutations, no survivors and no failures.
All source hashes and the exact changed-source set were rechecked after the
gate, and all 155 built HTML/JS/CSS/Wasm files were recorded. Source manifest
SHA-256: `835c8b8d2f1c8b30b0084a93f441115cf7ee2496b1931ec244f2bc83f3c2224d`.

The fifth attempt then failed during Windows CDP connection at 01:51:21 UTC,
before creating a party or run. Its dedicated Windows Chrome PID 20964 had
exited; the existing SSH tunnel and resource monitor remained alive. The
browser monitor recorded wave zero and zero samples, the unused host watcher
exited without profiling, and the idle host closed cleanly with exit code 0
at 01:52:52 UTC. This startup failure is retained in the fifth directory.
The sixth attempt reuses the exact validated source and build, with fresh
gameplay output and a recovered dedicated Windows browser. Endurance
acceptance remains pending actual completion by both native clients.

## Reproducing the private party

Build with the repository validation entrypoint first. Arrange a dedicated
headed Windows Chrome with its DevTools endpoint reachable from the Mac at
`http://127.0.0.1:9431`; forward Windows loopback ports 4191 and 4192 to the
same ports on the Mac. Use fresh output directories for every attempt. From
`frontend`, start the host and wait for its ready event before the monitor.
This example uses the confirmed 60 Hz Windows display and a 45 FPS trigger:

```sh
SDR_SOAK_OUTPUT=/tmp/solomon-party-run node --experimental-strip-types tools/party-soak-runtime.mjs
SDR_SOAK_OUTPUT=/tmp/solomon-party-run SDR_SOAK_STALL_MS=3600000 SDR_SOAK_PROFILE_SLOW_WINDOWS=1 SDR_SOAK_PROFILE_MIN_FPS=45 caffeinate -di node tools/monitor-party-run.mjs
```

The monitor defaults to Fire on Mac, Air on Windows, a 12-hour maximum, a
20-minute wave-stall limit, and completion only after both clients enter wave
101. The retry uses a 60-minute stall limit because Discorporeal has 17,500 HP
and ordinary damage/mana progression can require more than 20 minutes of useful
combat. The total remains 12 hours. `SDR_SOAK_WAVE`, `SDR_SOAK_MAX_MS`, `SDR_SOAK_STALL_MS`, and
`SDR_SOAK_WINDOWS_CDP` can override those test settings. To stop early, send
SIGTERM to the emitted monitor Node PID, await its result and browser cleanup,
then send SIGTERM to the host PID to write the archive. An early stop is
recorded as incomplete. The generated `runtime.json` contains the private
bootstrap credential and must be excluded from shared evidence.

The third attempt enables `SDR_SOAK_PROFILE_SLOW_WINDOWS=1`; otherwise the
one-shot CPU diagnostic is disabled. Raw observations include diagnostic
overhead. The analysis excludes every window overlapping
`profiling.triggered` through `profiling.finished` in its separately named
profile-excluded summaries, while keeping those samples visible in the plots.
Both latest diagnostic owner saves redact their rejoin credential; inspect
and credential-scan the chosen evidence again before sharing it.

## Publication and cleanup

No commit, push, or deployment has been performed yet. Only task-owned test
processes and isolated browser contexts have been stopped. The private Windows tunnel and task-owned display-awake/resource monitor are
retained for the final endurance run. The dedicated Windows browser exited
while idle and was relaunched at 22:51:14 UTC as owned PID 20964, in the
interactive desktop. The Mac verified its endpoint before the fourth launch.
The original helpers remain owned by this task; final cleanup is pending.
