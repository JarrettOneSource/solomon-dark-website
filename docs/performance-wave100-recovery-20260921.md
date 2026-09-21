# Solomon Darker: September 21 recovery

## Latest terminal status — Windows performance investigation

The eleventh run stopped at wave 37 at 17:53 UTC and has been archived. It
is no longer running. See [Windows performance diagnosis](performance-windows-diagnosis-20260921.md)
for the measured CPU bottlenecks, reproduced Mage lighting ownership
boundary, late server overload, and recommended fixes. No game source was
changed or new endurance run started in that investigation. Earlier active
status entries below are historical checkpoints.

Fleet session: `6a583nbx` (reused; no replacement session).
Candidate: `perf/wave100-6a583nbx` in
`/Users/jarrett/codex-acceptance/solomon-perf-6a583nbx`.

## Latest change: free mana and automatic Fire/Water abilities

The user's unlimited-mana and automatic-ability changes are implemented and
passed the full canonical gate, including the real Lua controller tests.
The current run is the eleventh attempt, with Fire on Mac and Water on Windows.
Both clients reached wave 7 by 17:00:46 UTC with no reported client errors.
Wave-100 acceptance is still pending, and earlier navigation/Windows-renderer
failures remain recorded rather than declared fixed. See the complete current
[combat policy, validation, active jobs and evidence](performance-soak-combat-20260921.md).

The sections below preserve earlier recovery and run history.

## Earlier change: Fire and Water run

The user requested Water instead of Air. The seventh run was stopped
gracefully and its archive was preserved. A fresh Fire-on-Mac / Water-on-Windows
run is active and reached wave 3 with both players alive and zero recorded
client, host, or Lua errors at the latest early checks. See
[the Fire/Water continuation](performance-fire-water-20260921.md) for exact
job identities, verification, and the unarmed final-cleanup limitation.
Wave-100 acceptance remains incomplete.

## Previous retry: access recovered, seventh run subsequently stopped

At 2026-09-21 15:53:44 UTC, both real headed clients are alive in wave 6 of
the same new run, with zero client errors. The recorded bot-rule failure
count is one, with zero VM timeout messages. Both clients subsequently
report their pilot enabled with zero consecutive failures. The failure is
retained, and its exact cause has not been diagnosed. This is not a completed
wave-100 acceptance result.

Run: `97813583d20681c871accd67b921e494`.
Party: `party-BD-wEIyK0H5NQp6iwFtjNKb4`.
This is a fresh wave-1 start, not a restoration of the sixth run's checkpoint.
Evidence directory:
`/Users/jarrett/codex-acceptance/solomon-evidence-6a583nbx/seventh-run-20260921`.

All 67 candidate source hashes and the exact changed-source set still match.
All 155 built asset hashes also match. The earlier full validation and the
260-test recovery pass therefore remain the candidate's validation evidence;
no new full gate or gameplay source change is claimed in this retry.

### Connection recovery

Direct Fleet Windows access still timed out. The gateway-to-WSL path failed,
but the Mac could reach WSL's SSH service. Using Fleet's existing device
identities through the Mac established authenticated command access with a
smaller standard key exchange. A measured 512-byte response passed while a
4,096-byte response stalled. A task-local Mac TCP relay then eliminated the
stall in a 4,096-byte output test and an exact 1,048,576-byte round trip.
The latter SHA-256 was
`fbbab289f7f94b25736c58be46a994c441fd02552cc6022352e3d86d2fab7c83`.
This network evidence concerns that scoped connection, not a diagnosed carrier
or global network fault.

The relay uses Mac `TCP_NOOPT` before connect and reduces `TCP_MAXSEG` after
connect. Host-key verification and existing authentication remain enabled.
No global SSH configuration, interface MTU, firewall, credentials, or
production service was changed. Gateway wrapper:
`/tmp/solomon-ssh-retry-6a583nbx/home-pc` on NFO. Mac helper:
`/Users/jarrett/codex-acceptance/solomon-network-6a583nbx/ssh-relay.py`.
Do not remove these while the task's gateway jobs use them.

The game/CDP tunnel itself retains the original native Windows SSH connection
directly to the Mac. A real 508,126-byte built JavaScript asset downloaded
through it with an exact SHA-256 match in the Windows preflight.

The first replacement Chrome started in service session 0 and correctly
failed the existing desktop guard. Only that newly owned process tree, root
PID 2728, was stopped. A one-shot interactive scheduled task then launched
verified Chrome PID 17192 in desktop session 1. The one-shot task was removed.
No personal browser was stopped. Windows currently reports a 144 Hz display;
the conditional CPU-profile threshold is 90 FPS, not the prior 60 Hz run's 45.
Raw renderer callback rates have exceeded the display rate, so they must not
be represented as physical display presentation counts without further review.

### Active jobs and completion handling

| Role | Fleet job | Device process |
| --- | --- | --- |
| Windows game/CDP tunnel | `job_20260921T154646Z_4283e297b8` | Windows SSH 17412; job routed through NFO |
| Authoritative host | `job_20260921T154737Z_4851eec24e` | Mac Node 11842 |
| Two-client browser monitor | `job_20260921T154827Z_360be5632b` | Mac Node 13346 |
| Windows resource/awake monitor | `job_20260921T154849Z_566e54a9ea` | NFO relay; actual Windows PID must be freshly inspected |
| Mac resource sampler | `job_20260921T155005Z_e4c0ce58b4` | Mac Python 15473 |
| Host/archive finalizer | `job_20260921T155245Z_7521ff359f` | Mac Python 18869 |

The last host window measured approximately 99 ticks/s; the last Mac client
window approximately 60 renderer callbacks/s. Both clients received about
20 snapshots/s. These are early observations under concurrent OSRS/Clash
load, not an uncontended or complete-run performance comparison. Those
unrelated jobs were left untouched. The optional host Inspector watcher was
not started in this retry; the existing Windows conditional profiler is on.

The task-only `finish-seventh.py` passed syntax compilation and its process
identity preflight, then reported `finalizer.armed`. It waits for the browser
monitor to exit before sending SIGTERM to the verified host and Mac sampler.
That requests the host's existing archive shutdown path. It does not assert
that an archive has already been written, validate archive contents, or mark
the game test passed. Finalizer shutdown itself has not yet been exercised.

The Windows resource monitor retains its separate fresh log and
`stop-monitor-seventh` stop file. Its job, the Windows SSH tunnel, and the
dedicated Chrome still require identity-checked cleanup after terminal
acceptance review; do not use the old PID-hardcoded cleanup script. The new
jobs have bounded runtimes. Browser acceptance remains both clients naturally
entering wave 101, with normal combat, mana, wave timing and native Lua budgets;
only incoming damage is disabled as before.

Two further direct diagnostic calls were blocked by the tool during this
retry. They did not run. Live progress and bot-health statements above come
from the native Fleet job outputs. No commit, push, deployment, or gameplay
optimization was performed. Session `6a583nbx` remains open with the run active.

## Historical sixth-run outcome

The wave-100 acceptance target remains unmet. The sixth numbered launch
reached wave 33 and ended at 2026-09-21 02:44:43.262 UTC with
`completed=false`, `passed=false`, and four raw client error events.
Both clients recorded an unclean WebSocket close (1006). The subsequent
missing-renderer assertion is disconnect aftermath, not proof of a renderer
defect.

The host job `job_20260921T015422Z_1460e518f4` ended with Fleet exit code 125
and the explicit message `Remote command ended without a result (SSH exit
255)`. Its last gateway-retained host sample, at 02:44:22.969 UTC, records
wave 33, two alive level-34 players, approximately 99.93 ticks/second,
zero host error-level entries, and one lifetime Lua rule failure/timeout.
The browser result records both pilot reducers enabled with consecutive
failure counts of zero. The Lua timeout recovered; its timing cause is not
established. These observations support transport interruption, not a
demonstrated fatal simulation error. They do not establish the underlying
reason the machine connection was lost.

The original sixth-run files remain in
`/tmp/solomon-party-wave100-sixth-6a583nbx`. This directory includes
`result.json`, client/server JSONL, CPU profiles, screenshots, and both
`diagnostic-*-latest-owner-save.json` files. No complete final run diagnostic
archive was present in the recovered directory listing. The owner checkpoints
must not be represented as a complete final archive or as a verified restored
party. Their fresh-host restoration has not been tested in this continuation.

The previously preserved mid-run archive remains at
`/Users/jarrett/codex-acceptance/solomon-evidence-6a583nbx/sixth-checkpoint-20260921T022919Z.zip`.
It predates the final disconnect; do not confuse it with final-run evidence.
Do not share `runtime.json`, which contains the private bootstrap credential.

## Verification performed in this continuation

All 67 source files listed in the sixth-run source manifest matched their
recorded SHA-256 hashes. The manifest SHA-256 recorded by the earlier full
validation is
`835c8b8d2f1c8b30b0084a93f441115cf7ee2496b1931ec244f2bc83f3c2224d`.
That full `./scripts/validate.sh` gate passed as
`job_20260921T011922Z_359f785ac4` at 01:49:58 UTC. It was not rerun in full
during this continuation.

A fresh Mac-only focused check passed: **260 tests, zero failures, zero
skips**, exit code 0. Job: `job_20260921T151945Z_fdd0a0cfb1`, from
15:19:45.660 to 15:20:16.947 UTC. Command from `frontend`, with the pinned
toolchain PATH:

```sh
caffeinate -di node --experimental-strip-types --test --test-concurrency=1 \
  src/game/core-server/boneyard-enemy-store.test.ts \
  src/game/core-server/boneyard-world.test.ts \
  src/game/core-kernels/native-loot.test.ts \
  src/game/protocol/entity-replication.test.ts
```

## Earlier blockers and next work before the successful retry

The Mac responds to Fleet commands. Inspection found no surviving private
Solomon host or headed soak monitor, and no private host/CDP listeners. An
unrelated headless Chrome process was left alone.

Fleet lists the Windows and WSL devices online, but Windows SSH timed out and
WSL Fleet commands failed with SSH exit 255, including an explicit `user`
account attempt. A Mac-side port probe reached WSL port 22; Mac-to-WSL SSH
then failed authentication. No credentials, SSH configuration, firewall rules,
network settings, or unrelated processes were changed.

Two additional file-inspection calls were blocked by the tool. The planned
Maggot owner-lookup optimization was therefore not implemented or benchmarked.
The existing `host-incident-diagnosis.md` in the sixth-run directory retains
the source-backed performance opportunities and measurement limitations.
No new runtime optimization or restored-run success is claimed here.

Restore authorized Windows access, inspect the task-owned browser/tunnel
identities before changing them, and then continue the real two-device test.
Any checkpoint-based restart needs explicit restoration evidence and must be
reported separately from an uninterrupted wave-1-to-101 endurance pass.
Keep all original failures, native callback budgets, ordinary damage/mana,
and wave timing intact.

Only documentation was changed during this continuation. No commit, push,
deployment, or fresh endurance run was performed. The original Fleet session
remains open for continued work.
