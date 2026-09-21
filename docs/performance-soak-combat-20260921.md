# Private Fire/Water stress-test controls

## Latest outcome

The eleventh run has now failed at wave 37 and been archived. See
[Windows performance diagnosis](performance-windows-diagnosis-20260921.md)
for measured client CPU bottlenecks, the Mage Air light-registration error,
a reproduced sampling ownership mismatch, and late high-Maggot host overload.
No gameplay code was changed during that investigation. Historical live
status below describes earlier checkpoints, not a currently running game.

Session `6a583nbx`; requested September 21, 2026.

The user changed the private endurance test to Fire on Mac and Water on
Windows, with unlimited mana and automatic ability use when cooldowns allow.
Invulnerability remains enabled. This is a modified stress workload, not an
ordinary-mana balance test, and must remain separately identified from earlier
attempts.

Implementation boundary: the private Lua pilot and its measurement tools,
plus read-only quickbar observations for the existing `player.control` API.
Do not bypass native cast actions, shared cooldowns, per-spell cooldowns,
normal quickbar input validation, damage, wave timing, or level-up offers.
Use the existing `mana_spend=0` status and full-mana resource intent. Expose
only owned, equipped secondary abilities; do not consume belt items or switch
the selected elemental primary. Keep sustained toggles active rather than
repeatedly turning them off. All ready secondary slots should be serviced
fairly at the existing 100 ms controller decision cadence, with normal input
press/release edges and without firing during entrance navigation.

Required checks: both Fire and Water keep their selected primary; mana
spending is zero under the private status; ready slots rotate without
starvation; cooling, unlearned, nonsecondary, and active sustained entries are
not activated; ordinary native shared/private cooldowns still block casting;
newly offered skills remain selected through normal admission. Verify the
actual Lua script and native host, not only a rewritten mock policy. Preserve
the interrupted earlier run before restarting with fresh evidence.

## Verified control checks

The updated `prepared-mod-player-control.test.ts` suite passes all 16 tests,
with no failures or skips. It executes the actual private pilot through
Wasmoon and the prepared host. Both Fire and Water run through native
secondary casting without mana loss in a controlled finite-capacity fixture,
and the unchanged 150-tick shared cooldown remains enforced. Additional
checks cover ready-slot fairness, active-toggle retention, held-slot release,
private cooldowns, unlearned/nonsecondary exclusion, owned observation rows,
and preservation of the chosen primary.

The private modifier uses the existing API's inexhaustible-mana behavior:
zero spending plus replenishment to the current maximum every decision.
It does not grant larger mana statistics or bypass native affordability and
mana-reservation checks. The unit fixture's larger finite capacity separates
spending from affordability; no ranks or extra capacity are granted in the
real endurance launch.

The controller state is version 2 with a pure version-1 migration that adds
the fair-slot cursor. The package version is `1.1.0`. Fire/Water defaults and
the modified-workload description are shared between runtime and monitor.
The monitor owns SIGINT/SIGTERM shutdown instead of competing with
Playwright's automatic browser-closing signal handlers. Its requested-stop
behavior still needs a separate live shutdown observation.

Complete validation passed as `job_20260921T160610Z_60faf5c3c4` against
the 70-file source manifest
`199fbbf82420f7584a9ef7870960d140afe97c6bb3250d2c5fdb5685e67c7adf`.
The gate ran from 16:06:10 to 16:42:37 UTC and exited 0. All ordinary test
stages and the production build passed. The scoped renderer suite retained
100% coverage, 441 killed mutations, one timeout, 142 compile errors,
23 pre-existing ignored equivalents, no survivors and no quality failures.
All 70 source hashes, the exact changed-source set and 155 built assets were
verified unchanged after completion. Evidence is under
`/Users/jarrett/codex-acceptance/solomon-evidence-6a583nbx/ninth-free-mana-20260921`.
Wave-100 acceptance remains unmet; the subsequent live outcomes follow.

## Live attempts and current continuation

The ninth attempt stopped during the opening after a zero-snapshot window.
Its intact archive contains 1,877 core ticks, a mean of 8.466 ms and a maximum
of 112.988 ms. A 60-iteration offline replay of the identical archived worst
tick averaged 37.990 ms, with no Lua dispatch, replication or network. Its
profile is dominated by spawn-placement and Solomon escape navigation,
including endpoint selection and collision-cell enumeration. This is a
reproduced core-workload issue, not a demonstrated mana-controller defect.
No navigation optimization or acceptance guard relaxation was applied.
`ninth-free-mana-20260921/failure-receipt.json` preserves the outcome,
and its archive and CPU profile remain intact.

The tenth attempt reached wave 1 on both clients; the host subsequently
reached wave 2. Windows stopped rendering while Mac rendering, host ticks,
and snapshot delivery continued. Its original monitor result is failed,
and its finalizer exited 0 after archiving and stopping only its host and
sampler. This does not establish the underlying rendering cause.

The dedicated Windows browser was then closed through its own CDP endpoint
and relaunched in interactive session 1 as PID 17448. Hardware-accelerated,
headed flags and the existing private profile were retained; background
throttling was already disabled. No personal browser, unrelated job, GPU
driver setting, network setting, native game rule, or test guard was changed.
The Windows resource sampler dynamically followed the replacement PID.

The eleventh attempt reuses the exact validated source and build and remains
active at the 16:59:51 UTC observation. Both clients were in wave 5, in party
`party-LMjXN8jTRGr8KvcKPdLLSqaU`, run
`d3fe51d75225332684c8becc81e91116`. Fire and Water retained full 100/100 mana,
with 23 and 22 secondary casts respectively. Both were alive; reported
client errors, host error-level entries, Lua failures and Lua timeouts were
all zero. The latest windows were approximately 60 FPS on Mac, 143 FPS on
Windows, 100 host ticks/second and 20 snapshots/second. These are current
observations, not full-run percentiles or proof that prior failures are fixed.

Active evidence directory:
`/Users/jarrett/codex-acceptance/solomon-evidence-6a583nbx/eleventh-free-mana-20260921`.
Its `live-settings-verification.json`, `launch-metadata.json`,
`candidate-reuse.json` and copied validation receipts retain the identities.

- Host: `job_20260921T165637Z_6533683fae`, Mac PID 17425.
- Browser monitor: `job_20260921T165655Z_e7bbea4ebb`, Mac PID 17835.
- Mac sampler: `job_20260921T165740Z_9e7d88f44d`, PID 18871.
- Identity-checked finalizer: `job_20260921T165821Z_fd6a3d2a7a`, PID 19808.
- Retained Windows tunnel: `job_20260921T154646Z_4283e297b8`.
- Retained Windows resource/awake monitor: `job_20260921T154849Z_566e54a9ea`.

The finalizer is armed to archive and stop only this run's host and Mac
sampler after the browser monitor ends. Check actual job and result status
on continuation; starting or arming these jobs is not wave-100 acceptance.
Do not share `runtime.json`, which contains the private bootstrap credential.
No commit, push, deployment, or public-service change was performed.
