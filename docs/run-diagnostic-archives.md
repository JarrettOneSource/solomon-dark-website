# Run diagnostic archives

The Website game supervisor automatically archives Boneyard runs from the
shared Hub and private Colleges. Each archive retains the whole party, world,
enemies, projectiles, spell effects, RNG state, loaded map and content identities.
It captures each player's last living world state, the last state with any living
wizard, the input and state associated with the slowest measured simulation tick,
the final state, and the most recent
60 simulation performance windows. Each player's checkpoint includes the whole
world at their own last living moment, even if they leave while teammates keep
playing. A window contains 100 steps; paused world time does not advance that
window. Ordinary player saves are unsuitable here:
their owner projection removes teammates and resets transient state.

These are diagnostic checkpoints, not recordings of an entire match. Repeating
the captured slow tick measures the simulation workload. Rendering the captured
scene measures the real world renderer at that population. Neither recreates a
player's hardware, browser history, network conditions, or the server's other
concurrent sessions. The recorded timings supply that missing context. Tick
timing covers the world simulation; it does not include the host's mod callback,
snapshot encoder, or other sessions' CPU time. Scheduler lateness helps identify
pressure outside that world step.

Capture starts at run creation, including runs abandoned during loading before
their first simulation tick. Such captures have an empty timing history.
Disconnect and shutdown also refresh state changed while play was paused.
Game Over archives immediately. World retirement and orderly host shutdown
archive unfinished run segments as well. A resumed suspended run may therefore
have several archive IDs sharing one run ID. Process kill, machine failure, and
disk failure cannot guarantee a final archive; storage failures emit
`run_archive.failed` without throwing into gameplay. The normal shutdown waits
for pending writes. No capture changes saves, scores, run eligibility or gameplay.

## Storage and retrieval

Server archives live in `run-archives/` beside the file configured by
`SDR_GAME_MEMORIAL_PATH`, outside release directories. Files are private to the
service account. `run_archive.saved` logs identify the archive file, run ID,
session, compressed size, SHA-256, and synchronous serialization time.

Each `<archive-id>.sdrrun.gz` is an asynchronous gzip of the complete Node V8
serialization. Its adjacent `.sdrrun.gz.json` summary permits searches by run,
wizard name, time, map and worst tick without loading simulation data. Compression
and filesystem writes happen after the tick yields. The recorder retains
immutable state references during play rather than repeatedly copying worlds.
V8's serialization supports persisted structured data; equal values can have
different binary encodings, so replay tests compare decoded state, not serialized
bytes. See the [Node serialization API](https://nodejs.org/docs/latest-v22.x/api/v8.html#serialization-api).

Startup and hourly cleanup remove captures older than 30 days. To keep a reported
run, create an empty `<archive-id>.sdrrun.gz.keep` beside it; remove that marker
when the investigation is over. Copy an archive to the development machine using
the existing operator SSH access. There is no public archive download or import
endpoint. Do not commit player captures to the repository.
Incomplete write directories left by a terminated process expire on the same
retention schedule.

## Reproduction

From `frontend/` on the Mac mini:

```bash
node --experimental-strip-types tools/replay-run-archive.mjs inspect /path/to/capture.sdrrun.gz
node --experimental-strip-types tools/replay-run-archive.mjs render /path/to/capture.sdrrun.gz --player PLAYER_ID
node --experimental-strip-types tools/replay-run-archive.mjs benchmark /path/to/capture.sdrrun.gz --checkpoint worst-tick
node --experimental-strip-types tools/replay-run-archive.mjs render /path/to/capture.sdrrun.gz --headless --width 844 --height 390 --pixel-ratio 3
```

The archive records the full server Git revision and gameplay protocol. Use that
revision for the original behavior, then use `--compare-revision` deliberately
when measuring a candidate optimization. Protocol or archive schema mismatches
fail explicitly. The benchmark warms navigation and repeats the same captured
step, reporting p50/p95/p99/max and steps over the 10 ms budget. Node's ordinary
`--cpu-prof` option can profile that command. The renderer command uses the real
renderer in Chrome, reporting frame gaps, render submission time, dimensions and
browser errors; it closes its own browser and Vite server afterward. Set
`SDR_CHROME_PATH` when Chrome is installed elsewhere.
`inspect` lists player IDs, names and last-alive ticks. `--player` selects that
player's checkpoint and camera; without it, replay selects the party's last
living checkpoint. Entity data comes from those complete states rather than a
separate census schema that must track every new effect or enemy store.

Modded runs are archived with their simulation state and content identities, but
the reproduction command currently accepts stock runs only: it does not restore
the separate Lua runtime, mod reducers or mod assets. It refuses that case rather
than reporting an altered simulation as faithful replay. Archives do not contain
authentication tickets, reconnect capabilities, account saves or chat transcripts.

## Client correlation

Remote browser sessions automatically submit up to 60 recent one-second samples
to `/api/game/run-performance` when the local player dies, on Game Over, world
exit, connection close or page exit. Samples include frame p95/p99/max,
slow-frame counts, snapshot gaps and counts,
logical message character counts, ping, server tick, visibility and pause state.
Reports also record the run ID, player ID, browser build, browser/user agent and
viewport. Backgrounding resets timing baselines and marks the affected window
hidden. Returning from the browser's back-forward cache starts another report
segment when snapshots resume. A new diagnostic ID per report
prevents the existing error-report deduplication from discarding later runs.

The existing private `DiagnosticLogs` storage holds these reports in ZIP files
under `diagnostic-logs/`, with the run ID in `MetadataJson.performance.runId`.
Match that ID against server archive summaries. Their existing diagnostic-log
storage policy is independent of the server checkpoint retention described above.
The automatic report contains only its performance entry; manual error logs remain
explicit submissions. The dedicated endpoint has a 64 KiB limit and its own rate
limit so automatic reports do not consume the manual error-report allowance.
Uploads use keepalive for page exit, but an offline or terminated browser may
still fail to deliver its final report. A server archive remains useful on its own.

High client frame times with normal server tick times point toward presentation
work or the device. High server tick times identify a captured simulation load to
profile. Snapshot gaps and ping with otherwise healthy frame/tick timings suggest
transport or scheduling pressure; these signals are evidence to investigate, not
proof of a particular cause. Capture a reported run before changing performance
architecture, and compare the same archive before and after the fix.

## Validation — 2026-09-05

The candidate was tested on the M2 Mac mini against `e223eb9b` plus the archive
change. The canonical `scripts/validate.sh` passed 23 Python integration tests,
the Node suites (2,927 reported test executions including quality helpers),
backend formatting, frontend lint, type checks, both production builds, and media
policy. Its remaining renderer mutation stage reported three survivors among the
first 30 of 544 mutations. All eight mutation targets and their tests were
unchanged by this task. That unrelated stage was interrupted; the complete
repository gate is not claimed green.

Archive acceptance additionally proved:

- The built production supervisor created archives automatically for both shared
  and private runs and flushed both on normal shutdown.
- Four focused host scenarios covered shared-party isolation, Game Over, and
  abandonment during loading. Recorder tests cover individual deaths,
  disconnection, paused-state changes, retention, duplicate IDs, file permissions,
  corrupt captures, and matching simulation state after reload.
- Client tests cover repeated snapshots, frame and network gaps, pauses,
  backgrounding, page-cache restoration, death reports, repeated runs, upload
  failures, and listener cleanup. Backend integration accepts their error-free
  reports and rejects invalid or oversized sample sets.
- A two-player, 40-enemy combat capture reloaded and produced the same next
  simulation state. It compressed to 84,331 bytes; serialization took 2.507 ms.
  Across 300 samples, recording averaged 0.00417 ms per tick, p99 0.01758 ms.
  These are fixture measurements on the Mac, not production load guarantees.
- Chrome rendered the restored scene for 120 measured frames at 1600×900:
  frame p99 16.8 ms, render submission p99 5.0 ms, and zero page, console or
  failed-response errors. This measures a frozen captured world, not historical
  network playback or the reporting player's device.

The three new runtime modules had 100% statement, branch, function and line
coverage in their focused tests. Measured maxima were cyclomatic 13, cognitive 9,
Halstead Difficulty 36.24, and CRAP 13. Scoped dead-code and duplication checks
found no issues. C# coverage/mutation and complete CLI coverage were not measured.

An exploratory mutation run on an earlier archive implementation found 61
survivors. Meaningful gaps led to the lifecycle, timing and storage tests above;
redundant state and the separate entity census were removed. Choosing another
equally slow tick is equivalent for this diagnostic contract. A final exhaustive
archive mutation score was not obtained; no zero-survivor claim is made.

No production capture, lag root cause, performance fix, push, or deployment is
claimed by this validation. Follow-up performance work starts with a reported
real run. Mod-runtime restoration and renderer/device settings capture remain
separate extensions to the current stock-checkpoint reproduction tool.
