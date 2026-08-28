# 2026-08-27 — Game supervisor unit deployment ownership

## Reported smell and feedback loop

- Owner request: inspect the production server error logs, fix every confirmed
  server defect, and push the validated fix to Website `main`.
- Live reproduction: query the structured `solomon-dark-game.service` journal,
  the unit result/restart state, deployed revision, and loopback supervisor
  health; then compare the live unit byte-for-byte with the unit in the exact
  `origin/main` tree. A corrected release must make the failed candidate start
  successfully and leave no matching post-start error.
- Scope boundary: this is Website deployment/runtime ownership, not a native
  mechanic. No stock executable fact, game protocol member, content catalog,
  or Mod Loader document changes.

## Evidence and root cause

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Production game journal | NFO `journalctl -u solomon-dark-game.service`, `2026-08-26T21:05:38Z..2026-08-27T11:40:51Z` | Thirteen candidate starts failed with `process.uncaught_exception`: `SDR_GAME_MEMORIAL_PATH must be configured`. Each failed unit and triggered atomic rollback. | high-live |
| Production identity and health | NFO at `2026-08-27T08:18:36-04:00` | Rollback kept Website/game/Caddy active at `fce78b6a`, protocol 81, zero occupancy, and zero restarts for the restored processes; production was 42 commits behind `origin/main`. | high-live |
| Live configuration differential | `/etc/systemd/system/solomon-dark-game.service`, `/etc/solomon-dark-game.env`, and `/var/lib/solomon-dark-game` | The live unit lacks the checked-in `Environment`, `StateDirectory`, and `StateDirectoryMode`. The protected env correctly has no duplicate memorial path, so the stale unit supplies no value and creates no state directory. | high-live |
| Deployment owner trace | `ops/local-ci/deploy-main.sh` at `f7e0b244`; `ops/nfo/solomon-dark-game.service` at `080b49e6+` | The release packages and reconciles Caddy but never packages or installs the game unit. The application therefore acquired a required persistent-state path while its systemd owner remained machine-local stale state. | high |
| Self-update receipt | local deployment journal and worker/cache state, `2026-08-27T08:42:43-04:00..08:48:32-04:00` | The exact `8826abcf` tree passed the worker gate and built; its new worker installed byte-for-byte, then the old worker exited 1 and retained the old-format artifact because one `unlink` invocation incorrectly received both artifact and checksum paths. Production was not contacted in that phase. | high-live |
| Regression seam | `tests/test_validation_contract.py` | The canonical Website gate can enforce artifact membership, live checksum ownership, install/daemon-reload order, and rollback-before-restart order without touching production. | high |

The root cause is deployment ownership, not a bad memorial path or transient
host failure. Defaulting the application path would still leave the service
without a systemd-managed writable state directory under `ProtectSystem=strict`;
editing only the protected env would likewise leave future checked-in unit
changes undeployed.

## Complete ownership contract

- The validated immutable release contains the exact checked-in game unit.
- Artifact and checksum cleanup uses two independently guarded single-path
  operations, including the worker self-update handoff; an old-format cache
  cannot survive into the replacement worker's cutover pass.
- Target and live unit checksums participate in both pre-build and post-build
  current-state detection; same-revision unit drift cannot be reported current.
- The remote candidate verifies the unit before draining players or swapping
  the release.
- Cutover backs up the live unit, atomically replaces it, and daemon-reloads
  systemd before starting the candidate. The unit creates the writable
  `solomon-dark-game` state directory and supplies the memorial path.
- Any later candidate failure restores and daemon-reloads the prior unit before
  restarting the prior release. Final health proves the live unit checksum,
  deployed SHA, unit restart counts, Website/game health, database integrity,
  Caddy checksum, and public deployment identity together.

## Validation contract

- Red regression: the canonical `./scripts/validate.sh` must fail specifically
  because the deployment worker does not own `ops/nfo/solomon-dark-game.service`.
- Green gate: the same complete canonical entrypoint passes with shell syntax,
  deployment ownership/order assertions, backend/frontend tests, lint, builds,
  and production media policy.
- Publication: rebase onto the then-current `origin/main`, rerun the exact-tree
  gate, push by fast-forward, and prove local `HEAD`, `origin/main`, and
  `git ls-remote` equality.
- Live follow-up is separate: observe the automatic worker self-update and next
  cutover; accept only the exact deployed SHA, matching live unit, active units
  with zero candidate restarts, healthy supervisor, and no new memorial-path
  exception.
