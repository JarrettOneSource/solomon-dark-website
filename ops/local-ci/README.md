# Machine-local main deployment

This worker polls `origin/main` from its own bare mirror, validates the exact
commit with `./scripts/validate.sh`, publishes an immutable release archive,
and deploys it to NFO. The archive includes the checked-in Caddy site, whose
live checksum is reconciled even when the runtime commit is already current.
It never reads or modifies a developer checkout.

The cutover is fail-closed: a changed `main` is not deployed until validation
passes, active browser-game sessions defer deployment, the SQLite database is
backed up and checked, and an unhealthy release is rolled back atomically.
Changed Caddy configuration is validated before installation, reloaded
gracefully, and restored with a failed release. Successful cutovers retain the
previous release, database backup, and any replaced Caddy site on NFO.

The worker is intentionally a fixed local systemd service instead of a GitHub
Actions self-hosted runner. This is a public repository, so a persistent Actions
runner would allow untrusted workflow code to target the deployment machine.
The worker fetches the public repository without GitHub credentials and only
executes commits that have reached `main`.

Install or refresh it on the deployment machine:

```bash
./ops/local-ci/install.sh
```

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
