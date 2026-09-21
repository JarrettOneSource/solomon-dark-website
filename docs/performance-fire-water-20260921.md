# Fire and Water endurance continuation

Fleet session: `6a583nbx`, reused. The user requested Water instead of Air.
The Mac remains Fire; the native Windows browser now starts as Water through
`SDR_SOAK_WINDOWS_ELEMENT=Water`. No game source, combat rule, Lua budget,
mana rule, or wave timing was changed. Incoming damage remains disabled as
in the preceding private endurance attempts.

## Verified early result

At 2026-09-21 15:59:26 UTC both headed clients were alive in wave 3 of the
same party and run, with zero recorded client errors. Both pilot reducers
were enabled with zero consecutive failures. At 15:59:39 UTC the host also
reported wave 3, both players alive at level 4, zero warnings, zero errors,
zero Lua rule failures and zero Lua timeouts. The server window measured
approximately 99.92 ticks/second. These are early observations, not a
completed wave-100 acceptance result.

The Windows entry screenshot was inspected and displays the Water spell
icon. Direct diagnostic-checkpoint inspection was blocked by the tool, so
no new checkpoint-decoder or checkpoint-restoration claim is made.

Run: `465985b5e62d5af8606e2283dc2e27c4`.
Party: `party-Z1sUP5q3TZHEsR-5E3GLcR-d`.
Output:
`/Users/jarrett/codex-acceptance/solomon-evidence-6a583nbx/eighth-water-20260921`.
The monitor started at approximately 15:57:34 UTC and both clients entered
the Boneyard at 15:57:51.559 UTC. This is a fresh start, not checkpoint resume.
All 67 source hashes were checked again and matched the previously fully
validated candidate. The existing validation receipts were copied into the
new evidence directory; no fresh full gate was needed or claimed for this
environment-only spell selection.

## Active jobs and process ownership

| Role | Fleet job | Device process |
| --- | --- | --- |
| Authoritative host | `job_20260921T155721Z_8717e94329` | Mac Node 24541 |
| Fire/Water browser monitor | `job_20260921T155733Z_45d5396802` | Mac Node 24801 |
| Mac resource sampler | `job_20260921T155812Z_17e737f99c` | Mac Python 25638 |
| Existing Windows game/CDP tunnel | `job_20260921T154646Z_4283e297b8` | Retained from seventh run |
| Existing Windows resource monitor | `job_20260921T154849Z_566e54a9ea` | Retained from seventh run |

The dedicated Windows Chrome process was rechecked: PID 17192, desktop
session 1, Chrome 153.0.8010.48, with its private task profile and CDP port
9431. The authenticated NFO-to-WSL wrapper remained usable and no new global
network or authentication changes were made.

The Windows resource log is still the continuous
`C:\Users\User\AppData\Local\Temp\solomon-soak-6a583nbx\windows-resources-seventh.jsonl`.
Separate this run using its start timestamp rather than attributing earlier
samples to Fire/Water. The Mac sampler writes a new `mac-system.jsonl`.

The browser target remains both clients naturally entering wave 101. Its
maximum is 12 hours, its wave-stall guard is 60 minutes, and the optional
Windows CPU diagnostic threshold remains 90 FPS for the recorded 144 Hz
display. Fleet job limits are 13 hours. No terminal result exists yet.

## Prior run and cleanup limitations

The seventh run was deliberately stopped to honor the element change, not
because it failed. Only its verified monitor PID 13346 received SIGTERM.
Its existing finalizer completed with exit 0 at 15:56:39 UTC, observing
graceful host and sampler exits. It wrote a 4,768,977-byte run archive plus
`archive-summary.json` in the seventh-run directory. Those originals remain
preserved; this continuation does not claim to have decoded that archive.

The tool blocked creation of a replacement process-specific finalizer. That
command did not execute: no eighth-run finalizer was installed or armed,
and the proposed `launch-metadata.json` from that blocked command was not
written. `preflight.json` was successfully written earlier and this document
records the actual active job identities.

After the browser reaches a terminal result, its host/archive shutdown and
remaining task-owned sampler/tunnel/browser cleanup still require review and
fresh process-identity checks. Do not reuse `finish-seventh.py`: it contains
the old process IDs. The active jobs are bounded, but a job time limit is
not proof of a gracefully flushed final archive. No promise of an installed
automatic finalizer is made.

No commit, push, deployment, or additional game optimization was performed.
Session `6a583nbx` remains open with the Fire/Water run active.
