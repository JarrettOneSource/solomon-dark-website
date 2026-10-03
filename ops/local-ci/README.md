# M5 main deployment

The maintained worker runs automatically on the M5 from
`/Volumes/Drive/solomon-cicd`. Its one native launchd job is
`gui/501/com.jarrett.solomon-dark-main-deploy`. WSL scheduling is retired.
The only internal-disk registration is a small native LaunchAgents plist. It
loads at login even if the SSD is absent and waits for the SSD entry point to
return. The launcher defers before creating data if the mounted external volume
does not match the installed volume UUID.

The worker fetches published `origin/main` from its own bare mirror without
GitHub credentials. It holds a native deployment lock and the shared exclusive
M5 lease at `/Volumes/Drive/codex-acceptance/solomon-heavy-lease`. A foreign lease
defers the invocation without starting validation or changing that ownership.
An already-running native Clang compiler also defers admission when no
cooperative lease exists. This check leaves foreign work untouched and ignores
idle agent servers. Heavy work started afterward must still use the shared
lease convention; the check cannot prevent a later nonparticipating start.
Signals terminate the owned process group, wait for bounded shutdown, and
release only the matching owned lease. The 90-minute invocation limit remains.
The native job uses Standard classification with the existing nice and I/O
priority. This retains macOS's light resource limits while avoiding the measured
Background-class slowdown in the canonical renderer workload.

Pinned tools, cache, temporary files, source worktrees, immutable release
artifacts, worker versions, logs and status all live on the SSD. Configure
machine-local endpoints under the protected `config.json` `environment` object.
Use `SDR_DEPLOY_SSH_IDENTITY` for the authorized private NFO key and retain
normal OpenSSH known-host verification. Keys and machine configuration are not
release members. `HOME` remains the user's home; tool-specific home/cache
variables select the SSD.

The background job needs macOS removable-volume access. Permission held by an
SSH session does not grant that access to a launchd job. Verify a fresh native
invocation in `state/status.json` after installation, including its foreign-lease
deferral when a report owns compute.

The exact source runs the unchanged all-mode `./scripts/validate.sh`. Clean
source/index identity and a fresh main check precede packaging. The macOS SDK
publishes `linux-x64` managed dependencies with no platform apphost; native
SQLite must be ELF64 x86-64. NFO keeps its existing verified pinned Linux Node
runtime, referenced by the unchanged game unit. A Mac native library or foreign
runtime dependency target rejects the
artifact before upload. The release includes the existing Caddy site, game
unit, ML checkpoint and complete maintained worker components.

The NFO transaction is preserved: close admissions, freeze and checkpoint
players through their normal cloud/IndexedDB owners, wait for bounded save
acknowledgements, back up/check SQLite, install verified game/Caddy/model
configuration, atomically swap the release, and verify health. An unhealthy
candidate restores the prior release/configuration; successful cutovers retain
NFO rollback and database backups. The public no-store `/deployment.json`
remains the automatic app reload edge.

Complete worker versions are installed atomically behind `current`. A validated
component update is admitted only after the full gate, discards the artifact
built by the older worker, and defers deployment to the next invocation.
The installer in the admitted bundle constructs that version's complete
definition. Automatic self-update replaces worker components without stopping
its own scheduler; native registration policy is applied by an idle installation.
The replacement launcher and installer are part of the same version, so an old
Linux-only worker cannot overwrite the Mac installation. The bootstrap launcher
waits while published main still predates this migration. Keep the current and
one prior worker version; the stable scheduler resolves `current/run-worker.py`
at each invocation, so replacing a complete version needs no competing refresh
job or scheduler restart. Completed source/build/artifact trees and full success
logs are deleted. `state/status.json` retains bounded diagnostics, while
`state/last-success` and `state/failed-target` preserve the deployed or suppressed
revision. A remote cutover failure suppresses repeated drains at the same SHA.
Cached artifacts for superseded targets are removed on the next fresh main read.

Install from an accepted source tree after staging the pinned SSD tools,
protected configuration and authorized SSH identity:

```sh
./ops/local-ci/install.sh --root /Volumes/Drive/solomon-cicd
launchctl print gui/501/com.jarrett.solomon-dark-main-deploy
cat /Volumes/Drive/solomon-cicd/state/status.json
```

Install only while the existing worker is idle. Explicit installation clears a
failed target; automatic validated self-update preserves that safety state.
The installer creates native scheduler registration for subsequent logins and
starts this same worker, rather than a parallel deployment path. Reinstalling or
refreshing the scheduler must not stop an unrelated report/model process.
