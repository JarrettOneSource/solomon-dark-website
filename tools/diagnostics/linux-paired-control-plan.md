# Predeclared same-runner original/passive Linux comparison

Status: local preparation only. Independent review is mandatory before the
coordinator publishes these four files. This document does not authorize a
push, hosted run, package execution on the M2, or production change.

## Fixed question and count

Run at most two package workloads in one Ubuntu hosted job on one recorded
numeric runner: exactly one original uninstrumented trial, then exactly one
existing passive-observer trial, provided the first trial and barrier are valid.
There is no randomization, order reversal, retry-until-green, automatic repeat,
additional variant, resource/affinity adjustment, or GPU-flag adjustment.

Decision value: prior original failures and observed successes used four
separate runners. A same-runner discordance would reduce runner identity,
image, region and machine-allocation variance as an explanation. The pair
cannot isolate the observer's effect or eliminate order, timing, warmed caches,
scheduling, background activity or observer confounds. Two outcomes cannot
estimate reliability, identify a root cause, certify a product fix or authorize
release. The existing original and passive findings remain intact.

## Predeclared interpretation matrix

- Original fails, passive passes: within-runner discordance. The independent
  reviewer must identify each failure stage from the retained evidence. If the
  original again fails at the host capture, this reproduces the relevant
  contrast on one runner. It still cannot distinguish observer effects from
  order, cache, timing or scheduling. An earlier-stage original failure does
  not reproduce the host-capture contrast.
- Original passes, passive fails: reverse discordance. Passive instrumentation
  is not uniformly beneficial. No observer, order or host cause is established.
- Both pass: the original failure did not recur on this runner. This does not
  explain earlier failures or establish a fix.
- Both fail: compare the actual failure sites and evidence. Shared failure does
  not establish a shared cause, especially if stages differ.
- Either trial has an invalid baseline, unsafe/uncertain cleanup, missing or
  contradictory evidence, provenance/inventory drift, infrastructure failure,
  unsupported ownership primitives or a fired outer safety ceiling: incomplete
  or invalid comparison. A first-trial problem blocks the second launch. Never
  relabel a missing second outcome as failure, success or a release pass.

A valid comparison and a passing workload are separate facts. The result keeps
comparisonComplete, allWorkloadsPassed, each outcome, each raw exit code and
full supervision/barrier status. The job remains failed if either workload
fails, even when the comparison is valid and complete. Its summary names both
outcomes so original failure cannot hide under a green comparison job. Even
two passing trials are diagnostic only: every result has releaseAcceptance:false.

## Immutable inputs

Product commit 39875413fa2d3313d5d42170993c7dfa3e885cd1, tree
4d921486310f73246c3adf92c0e84b9077112a68. Node 22.17.0, npm 10.9.2,
Playwright 1.61.1 with original package-lock SHA-256
39baac153d64862e69097379b82d53ce26ac5a1455990672a9a2ca7b288776a0.
Hosted Python is pinned to 3.12.15. Original harness SHA-256:
036d980d4147f03a9043f7800866bc5b9a283a86de5a8e12f51d1f5bbbf3d3e3.
Original Playwright core bundle SHA-256:
6be5c2ea035554e9b184b1dbc7aa5e7f1fb428dd1b5c202022858dcfae9bee27.

Reuse artifact 11997259442 from failed qualification 38787359411, job
116602702052, orchestration 0d8ae95e7af35d62464b5d80d6d2698bac43bae4.
No rebuild. Outer SHA-256:
70ca300f9cbf665c3700899a5b716153249d60c5dff496db40e625fd592defa7.
Inner SHA-256:
79edf19e60a82ff0ec5f4a512f9797e36ab6bc9269f5b9c87020e37a0dcc5a27,
330254721 bytes. Manifest SHA-256:
4aab907f1c26c352c0f733120e954c7dd480e369533b68169cb966fff4dd3864.
All 1081 package inventory rows must hash to
5039b8a9bec0168858befbb46ad836e4b5db6119d1b7ce3e22f0a58a44a040ad;
all 128 installed Playwright rows must hash to
fbc4fa90e621c5c93bc7c61699fb097cb533b2ddb35e8a892e61a3f81fb8027e.
Each check compares the complete inventory bytes, including modes, kinds,
paths and file contents, before and after each trial. These retained bytes are
not proof of the earlier unretained source-run 38766573551 package.

The passive driver, observer, calibration and verification helpers come from a
separate checkout at ab612bbab50db542db7964ba79b80a6e02a7cdf3. Their
six SHA-256 bindings are embedded in the new wrapper and checked before use.
No existing helper or workflow is modified. The original-control helper is
imported only for read/verification and single fresh package materialization;
its overwriting CLI source/finish phases are not used. Existing workflow files
are never executed or dispatched.

## Runtime and evidence

Original: xvfb-run -a npm run smoke:desktop, using unchanged installed
Playwright and unchanged product harness. Keep its full original receipt,
six success screenshots, failure screenshots, stdout and stderr in its own
new evidence directory. A missing receipt is expected on a genuine original
failure, but its unmodified-harness error must be retained and identified.

Passive: xvfb-run -a node linux-launch-diagnostic.mjs --run using the exact
reviewed helpers. frameObservation remains false, with no added browser
requests. All 19 assertion sites, six success screenshot calls, launch options,
30-second launch/capture defaults and original explicit close deadlines remain.
The passive generator still replaces the original catch/finally behavior;
observer cleanup is not original acceptance cleanup. Its transient image
pixels and original success receipt are not retained. The new wrapper copies
the exact generated harness into diagnostic evidence after termination and
checks its source-binding digest, closing the previous path-dependent generated
harness review gap without altering its execution.

Each trial has a newly created runtime root and TMPDIR/TMP/TEMP. The unchanged
harness itself creates fresh solomon-darker-smoke-* profiles in that root, with
solo/resume sharing only within the trial and separate host/guest profiles.
The trials share only immutable package/dependency input paths. Runtime roots
and evidence roots are disjoint from product/tools and each other. Host-wide
caches and temporal state are not claimed isolated. No profile path is reused.

## Ownership barrier and ceilings

A fresh dedicated single-threaded Python supervisor enables only its own
PR_SET_CHILD_SUBREAPER state and verifies it. It requires the normal SIGCHLD
disposition and establishes default child-reaping semantics in this dedicated
parent, clearing any inherited no-child-wait flag. This is process-local lifecycle
handling; it does not create a cgroup, alter security settings or adjust CPU/GPU
resources. The supervisor launches one trial command in a fresh session, with
Xvfb included in the same owned descendant tree. Electron's unchanged
Playwright launcher still creates its own detached sessions. Session membership
of npm alone is never treated as ownership of those processes.

During the workload, the added supervisor opens one pidfd for its immediate
command, verifies current parent/PID/start identity and waits in a single
blocking kernel poll. It adds no active browser calls and no recurring process
sampler. The existing passive observer retains its reviewed scans and logging.
Differences from prior unsupervised runs include the extra parent/session, pidfd wait,
redirection to files, separate temp roots,
preflight work and post-trial inventories are interventions and overhead; they
are shared by the two trials but are not assumed neutral.

Only after the trial root exits naturally, or its 360-second outer safety
ceiling fires, does the supervisor drain children. Kernel orphan adoption covers
double-fork/new-session descendants. It waits 2 seconds for spontaneous exits,
then signals only currently proven direct/adopted children through pidfds with
SIGTERM. It rechecks live parent/start identity before opening each pidfd;
numeric PID reuse cannot retarget an already opened pidfd. No process-name,
stale-PID, pkill, killpg or machine-wide group signal is used. Reaping uses the
kernel's own child relationship. If necessary after 7 seconds, identity-bound
SIGKILL is cleanup-only and makes the trial invalid. The total drain budget is
15 seconds, with at most 256 distinct owned identities. Any unprovable identity,
unsupported primitive, bounded-out scan or remaining child invalidates cleanup.

The barrier requires both an empty direct-child list and kernel ECHILD after
reaping, and no harness-created profile directories remaining. An original
runtime failure may still form a valid diagnostic first outcome if it ended
naturally and all ownership, cleanup and byte checks pass. Safe supplemental
SIGTERM teardown is explicitly reported; it is not original acceptance cleanup.
No second trial starts unless the barrier and post-trial checks pass.

A fired safety ceiling always invalidates the comparison, even if cleanup
succeeds. It cannot relax or replace an original internal deadline, turn a
truncated workload into a pass or justify another launch. The workflow has a
20-minute outer job budget; cancellation or lost final evidence is incomplete.
Before the original launch, the recorded GitHub job start time must leave time
for both 360-second ceilings, two 15-second drains, two 30-second check
allowances and 180 seconds for upload (990 seconds total). Before trial two,
the same clock must leave 585 seconds for its ceiling, drain, check allowance
and upload reserve. Otherwise the dependent launch is refused and the
comparison is incomplete. These checks do not weaken any harness deadline.

The 360-second ceiling exceeds the four previously observed workload-step
durations (254, 203, 161 and 122 seconds), but does not guarantee completion.

Before either package launch, a Linux-only benign Python fixture verifies
pidfds, exclusive root session, subreaper adoption of a double-fork child that
creates a new session, safe pidfd SIGTERM and complete reaping. It is not a
package workload. Unsupported or failed preflight blocks both package trials.
On M2, only synthetic tests, source generation and syntax checks are permitted;
the Linux lifecycle primitive and package execution remain untested locally.

## Workflow and stopping boundary

Only these four new paths trigger the new workflow on the existing diagnostic
branch. Guard repository, ref and run_attempt==1 in YAML and at runtime. Use
one Ubuntu job, read-only contents/actions permissions, exact product/helper
checkouts and retained package reuse. No dispatch input, matrix, rebuild,
software installation beyond the existing pinned runtime/dependency setup,
security mutation, retry or extra variant is present. Record numeric runner/job
identity, image, kernel, tool versions, lscpu context and bounded prelaunch CPU
calibration. CPU-role seconds are never GPU utilization, saturation, contention
or proof of the cause of a failure.

The local preparation boundary is these four uncommitted new files, sealed
hashes, synthetic/unit tests and launch-blocked generation evidence in the new
paired-linux-control-preparation-20261015 directory. Independent review precedes
coordinator publication. At the hosted boundary, stop after the ordered pair or
the first invalidating blocker. Preserve incomplete evidence. No continuation
of the completed passive job, retry, production change, M5 transfer, product
edit, shared archive STATUS edit or modification of protected refs is allowed.


## Ownership interface references

Linux's subreaper interface reparents orphaned descendants to the nearest live
ancestor subreaper, including double-forked processes. The attribute is local
to the calling process and is not inherited by children.
[Linux man-pages: PR_SET_CHILD_SUBREAPER](https://man7.org/linux/man-pages/man2/PR_SET_CHILD_SUBREAPER.2const.html)

A pidfd can be polled for process termination and remains bound to its original
kernel task. The supervisor preserves default child-reaping behavior and stays
single-threaded, avoiding competing reapers while binding direct children.
[Linux man-pages: pidfd_open](https://man7.org/linux/man-pages/man2/pidfd_open.2.html)
The standard Python interface sends the signal through that descriptor.
[Python 3.12: pidfd_send_signal](https://docs.python.org/3.12/library/signal.html#signal.pidfd_send_signal)

Action revisions are pinned to those recorded in the saved setup log of
reviewed run 38810090571: checkout d23441a48e516b6c34aea4fa41551a30e30af803,
setup-node 249970729cb0ef3589644e2896645e5dc5ba9c38, setup-python
ece7cb06caefa5fff74198d8649806c4678c61a1, and upload-artifact
ea165f8d65b6e75b540449e92b4886f43607fa02.
