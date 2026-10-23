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
SQLite and the supplied Rust authority must be ELF64 x86-64. Configure an exact
`SDR_GAME_ARTIFACT_URL` plus `SDR_GAME_ARTIFACT_SHA256`, or explicit matching
`SDR_GAME_DIST` and `SDR_GAME_NATIVE_HOST` local paths, in the protected worker
configuration. The native artifact must target `x86_64-unknown-linux-gnu`.
A Mac native library, altered/unlisted client file or foreign runtime rejects
the release before upload. Node is still a pinned Website build tool; the
production game unit starts `GameHost/solomon-darker --supervisor` directly.
The release includes the checked-in Caddy site, game unit, original game
manifest, immutable native revision/asset environment, learned policy under
`wwwroot/game/assets/native`, and complete maintained worker components.
See [the artifact contract](../../docs/RUST-GAME-CUTOVER.md).

The NFO transaction is preserved: close admissions, freeze and checkpoint
players through their normal cloud/IndexedDB owners, wait for bounded save
acknowledgements, back up/check SQLite, install verified game/Caddy/model
configuration, atomically swap the release, and verify health. An unhealthy
candidate restores the prior release/configuration; successful cutovers retain
NFO rollback and database backups. The worker mints a fresh publication ID for
each cutover and sends it in the authenticated `X-Solomon-Deployment-Id` header.
The drain still targets the signed Rust revision. Website's no-store
`/api/game/deployment` exposes its root deployment document with Website revision,
game revision, publication ID and readiness; the mounted game's own deployment
document remains an immutable artifact member. Staging is pending. The worker
starts and verifies the replacement game before Website is exposed, then publishes
readiness atomically after all candidate health/integrity checks. Website-only
updates can therefore recover saved clients without changing the game revision.
Unchanged-game drains require the current supervisor's `deploymentProtocol: 2`;
the first changed-game legacy cutover retains its existing final-save handshake.

Complete worker versions are installed atomically behind `current`. A validated
component update is admitted only after the full gate, discards the artifact
built by the older worker, and defers deployment to the next invocation.
The installer in the admitted bundle constructs that version's complete
definition. Automatic self-update replaces worker components without stopping
its own scheduler; native registration policy is applied by an idle installation.
The replacement launcher and installer are part of the same version, so an old
Linux-only worker cannot overwrite the Mac installation. The bootstrap guard
waits when main lacks `ops/local-ci/run-worker.py`; it does not bridge the first
TypeScript-to-Rust production migration. Keep the current and one prior worker
version; the stable scheduler resolves `current/run-worker.py`
at each invocation, so replacing a complete version needs no competing refresh
job or scheduler restart. Completed source/build/artifact trees and full success
logs are deleted. `state/status.json` retains bounded diagnostics, while
`state/last-success` and `state/failed-target` preserve the deployed or suppressed
Website revision. Artifact cache, already-deployed admission and failed-target
suppression include the exact Rust manifest identity, so a deliberate game-only
artifact update cannot silently reuse or skip a different payload. A remote
cutover failure suppresses repeated drains for the same Website/artifact pair.
Cached artifacts for superseded targets are removed on the next fresh main read.

The first Rust production cutover needs a manual worker admission. The installed
TypeScript worker still publishes the old GameHost layout and checks removed
`GameHost/*.mjs` members before `install_validated_worker()`. Its publisher also
omits the Rust executable required by the new artifact check, so it cannot reach
automatic admission from the extraction source. Later compatible worker updates
can use the automatic admission described above.

This is a separate production migration; public `/game-stg` acceptance does not
install the production worker. For that separately authorized cutover:

1. Publish the accepted extraction to Website `origin/main` and use that exact
   accepted source tree on the M5.
2. Configure its reviewed production `/game` artifact inputs in the protected
   worker `config.json` environment, alongside the existing pinned SSD tools
   and authorized SSH identity. GitHub repository variables configure CI only;
   they do not configure the M5 worker.
3. Require a passing complete `./scripts/validate.sh` receipt for that exact
   source and artifact. The installer does not run the validation gate.
4. Run the installer below while the existing worker is idle. It installs the
   complete source worker and refreshes the existing native registration;
   subsequent invocations may perform the normal production drain and cutover.

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
