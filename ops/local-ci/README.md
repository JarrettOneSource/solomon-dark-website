# M5 main deployment

The maintained worker runs from `/Volumes/Drive/solomon-cicd` under the one native
launchd job `gui/501/com.jarrett.solomon-dark-main-deploy`. WSL scheduling is
retired. The internal-disk LaunchAgents plist waits for the SSD entry point; the
launcher checks the installed external-volume UUID before creating task data.

The worker fetches published Website `origin/main` through its isolated mirror
without GitHub credentials. It holds a native deployment lock and the shared
exclusive lease `/Volumes/Drive/codex-acceptance/solomon-heavy-lease`. A foreign
lease or an already-running native Clang compiler defers admission without
stopping that work. Heavy work started later must use the same lease convention.
Signals terminate only the owned process group and release only its matching
lease. Each invocation has a 90-minute cap. Standard launchd classification,
existing nice level and I/O priority preserve the measured compute policy.

Pinned tools, caches, temporary files, source worktrees, artifacts, complete
worker versions, logs and status live on the SSD. Machine-local settings belong
in the protected `config.json` environment. Keep `HOME` unchanged. Reuse the
existing `SDR_DEPLOY_SSH_IDENTITY`, normal host-key verification and Tailscale
route. Secrets and machine configuration are never packaged. A launchd job
requires its own removable-volume access; SSH access does not prove it has that
permission. Check a fresh native invocation in `state/status.json`.

## Exact-source build and admission

Supply the qualified Linux x64 Rust `/game` artifact using exact
`SDR_GAME_ARTIFACT_URL` plus `SDR_GAME_ARTIFACT_SHA256`, or matching local
`SDR_GAME_DIST` and `SDR_GAME_NATIVE_HOST`. Preserve the selected Rust release
until a separate release qualification authorizes its replacement.

The worker runs the complete `./scripts/validate.sh` on exact published Website
source. It verifies a clean source/index and refreshes main before packaging or
upload. The macOS SDK publishes `linux-x64` managed dependencies without an
apphost. Linux package admission checks native SQLite and the original Rust
executable as ELF64 x86-64, all mounted payload hashes/membership and the
original-to-remounted provenance. The unchanged WASM, native executable and
assets must retain their original hashes.

The build restores PixiJS at root, packages its Node supervisor, mounts the
released Rust client at `/game-rust/`, and builds a companion Website bundle
with scoped APIs and browser storage. The root uses the installed pinned NFO
Node 22.17 executable; Rust starts its released native supervisor directly.
See [the complete artifact and save contract](../../docs/RUST-GAME-CUTOVER.md).

Artifact cache identity and failed-target suppression include the Website SHA
and original Rust manifest hash. A Rust artifact-only update cannot reuse a
payload from another artifact. Superseded owned artifacts are removed; unrelated
files are preserved. `state/last-success` identifies the deployed source;
`state/failed-target` prevents repeated failed drains until an explicit idle
installation clears it or a different source/artifact is selected.

## NFO transaction

`deploy-main.sh` owns build, validation and upload. The same validated source's
`deploy-runtime.sh` owns the NFO transaction:

1. Verify the archive, original and mounted game identities, all candidate
   systemd units, and Caddy with the active service executable.
2. Stage separate pending root and companion publications with one new
   publication ID and sequence. Drain each affected authority while its API
   remains available for final cloud saves. Check acknowledgement counts and
   protocol-2 publication identity where supported.
3. Stop affected processes, back up/check SQLite including final saves, and
   perform the one-time absent-destination save fork. Give the Rust authority a
   separate memorial snapshot and mutable state directory.
4. Exchange the release directory and install the versioned service files.
   Start/check both authorities; start the primary API and wait for schema
   setup, then start/check its companion. Pending publications reject new
   admissions. Validate/reload Caddy, check database and restart counts, then
   publish both ready documents.
5. On failure, restore the prior runtime, unit files, Caddy and publications.
   Restart the old admission owners, including an authority left draining by
   an uncertain request. Preserve current database content and any seeded Rust
   save namespace. Retain runtime/configuration/database recovery files.

For a source change both game servers are drained. A Rust artifact-only update
at unchanged Website source leaves the unchanged root services running. A
Caddy-only reconciliation preserves both games and reloads only Caddy. Root
legacy revision polling remains at root; the Rust companion polls its scoped
API. The first parallel cutover announces the new Website/PixiJS revision to
old Rust clients at `/game` so their acknowledged saves precede that reload.

Ordinary reconciliation compares source, original Rust artifact, all three
managed service units, canonical Caddy and both ready publications. Staging
`/game-stg` remains outside this transaction. See [NFO operation](../nfo/README.md)
for the port, service, state and credential boundaries.

## Complete worker version installation

A complete version contains `deploy-main.sh`, `run-worker.py`, `install.py`,
`deployment-publication.py`, `deploy-runtime.sh`, `parallel-game-saves.py` and
`check-linux-artifact.py`. `install.py` defines and hashes this complete set.
Versions are installed atomically behind `current`, retaining current and one
prior version. The stable launchd entry resolves `current/run-worker.py` each
invocation. Automatic self-update does not stop its own scheduler, preserves
failed-target state, discards an artifact built by older worker code, and defers
the actual cutover to the next invocation. Completed owned worktrees, build
outputs, artifacts and success logs are removed; bounded diagnostics remain.

The installed four-component worker cannot package the expanded seven-component
version for itself. Initial parallel deployment therefore needs one explicit
idle admission using the accepted published source, after its complete gate has
passed with the production Rust artifact. Hold the shared compute lease while
admitting this worker and any input configuration changes; release it only when
published source and configured input identity agree. Do not replace production
by an independent manual deployment path.

```sh
./ops/local-ci/install.sh --root /Volumes/Drive/solomon-cicd
launchctl print gui/501/com.jarrett.solomon-dark-main-deploy
cat /Volumes/Drive/solomon-cicd/state/status.json
```

Install while the existing worker is idle. The explicit installer clears a
failed target and refreshes the existing native registration. The next ordinary
scheduled invocation owns validation, drain and deployment. Preserve unrelated
report/model processes, staging and other project leases. Public staging
acceptance alone does not authorize or establish production admission.
