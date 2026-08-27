# Machine-local main deployment

This worker polls `origin/main` from its own bare mirror, validates the exact
commit with `./scripts/validate.sh`, publishes an immutable release archive,
and deploys it to NFO. The archive includes the checked-in Caddy site and game
systemd unit, whose live checksums are reconciled even when the runtime commit
is already current. It never reads or modifies a developer checkout.

The cutover is fail-closed: a changed `main` is not deployed until validation
passes, the SQLite database is backed up and checked, and an unhealthy release
is rolled back atomically. Active browser games do not defer a validated
release. The worker asks the supervisor to close admissions, freeze each host,
publish one final checkpoint per connected player, wait up to the bounded save
grace for cloud/IndexedDB acknowledgements, and disconnect players with the
`game updating` reason before restarting the Website and game units. Changed
Caddy configuration is validated before installation, reloaded gracefully, and
restored with a failed release. The game unit is verified, backed up, installed,
and daemon-reloaded before the candidate starts; rollback restores and reloads
the prior unit before restarting the prior release. Successful cutovers retain
the previous release, database backup, and any replaced Caddy site or game unit
on NFO.

The release also publishes `/deployment.json`. Connected players see the custom
update surface while saving and reload only when that manifest identifies the
announced target revision. Idle production `/game` tabs use the same manifest
to pick up a release without a game connection.

The worker is intentionally a fixed local systemd service instead of a GitHub
Actions self-hosted runner. This is a public repository, so a persistent Actions
runner would allow untrusted workflow code to target the deployment machine.
The worker fetches the public repository without GitHub credentials and only
executes commits that have reached `main`.

Every validated release contains the exact deployment worker that built it. If
that worker differs from the installed copy, the current run atomically installs
it, discards the old-format artifact, and exits before contacting production.
The next timer run validates and packages the commit again under the new worker.
This keeps machine-local deployment changes synchronized without executing an
unvalidated script from the public repository.

A remote cutover failure records its target SHA and suppresses further automatic
attempts for that same commit. The failed candidate's service status and recent
Website/game journals are included in the local deployment receipt before the
remote rollback. After correcting the cause, run `./ops/local-ci/install.sh`
from the exact intended checkout; explicit installation clears the failed-target
record and starts one fresh deployment attempt.

Install or refresh it on the deployment machine:

```bash
./ops/local-ci/install.sh
```

The first installation remains explicit because no validated worker exists yet.
After that bootstrap, validated releases own worker refreshes as described above.

On WSL, keep the user manager enabled with linger and launch the distribution
at Windows logon. This workstation uses a per-user Startup entry for Ubuntu, so
the timer starts after a reboot without requiring an elevated scheduled task.

Inspect the timer and recent deployment receipts:

```bash
systemctl --user status solomon-dark-main-deploy.timer
journalctl --user -u solomon-dark-main-deploy.service --since today
```

The service uses native Linux OpenSSH in batch mode, verifies the existing host
key, and defaults to the private key at
`~/.ssh/id_ed25519_nfoservers_root`. `SDR_DEPLOY_SSH_COMMAND`,
`SDR_DEPLOY_SCP_COMMAND`, `SDR_DEPLOY_SSH_IDENTITY`,
`SDR_DEPLOY_REMOTE_HOST`, `SDR_DEPLOY_REPOSITORY_URL`, and
`SDR_DEPLOY_PUBLIC_URL` may override those machine-local endpoints.
