# 2026-08-21 — Shared-Hub edge routing and diagnostic correlation closure

## Reported smell and parity question

- Reported web behavior: New Game reached the shared-Hub admission API, then
  rendered **Disconnected from server**. Explicit diagnostic submission failed
  with **Browser game diagnostic environment metadata is invalid.**
- Reproduction: production revision
  `17d69dd9fe68b7ce5fecd118958e3dfe2420911a` returned a valid one-use
  `/game-hub` admission, but its public WebSocket upgrade returned ordinary
  HTTP `200` instead of `101`. A local differential sent the same valid
  diagnostic report twice: `sessionId: "shared-hub"` returned `400`, while a
  private 32-character session id returned `201`.
- Falsifiable questions: is the supervisor unavailable, protocol-stale, or
  rejecting tickets after an upgrade; does the edge proxy route the new shared
  path; and do client and backend accept the same complete diagnostic session
  identity set?
- Stock boundary: none of this topology exists in retail Solomon Dark. The
  native Create, persistent-player, Hub-region, party-launch, and Boneyard
  lifecycle from the preceding shared-Hub entry remain unchanged. This is an
  explicit Website transport, deployment, and support-diagnostics system.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Production admission/upgrade probe | public `POST /api/game/hub` and `wss://solomondarker.com/game-hub`, deployed `17d69dd` | admission `201`; pre-fix upgrade HTTP `200` with no server messages | high |
| Production host state | `chicago-quad36-h-10-m7b`; loopback `:5220/:5222`; systemd and supervisor health | Website, supervisor, and Caddy active; protocol 37; zero sessions/Hub players/runs; both loopback listeners present | high |
| Edge configuration differential | checked-in `ops/nfo/solomon-dark-revived.caddy` versus `/etc/caddy/sites/solomon-dark-revived.caddy` | live file differed by exactly the missing `handle /game-hub` block; private-session route and fallback matched | high |
| Diagnostic differential | current backend on loopback; identical schema/failure/entry payloads | exact `shared-hub` sentinel rejected `400`; exact 32-character private id accepted `201` | high |
| Causal source trace | `game-diagnostics.ts`, `DiagnosticLogEndpoints.cs`, `deploy-main.sh` | client deliberately emits `shared-hub`; backend permits only null/32 characters; deploy artifact omits and never reconciles the Caddy site file | high |

## System boundary and membership inventory

Native system: none. Website browser-game edge routing owns API-issued
WebSocket paths through TLS termination to the resident supervisor. Browser
diagnostics own a credential-free correlation label for each supported endpoint
class. The deployment worker must atomically publish both runtime and edge
configuration or fail closed.

| Member / branch | Source owner | Disposition | Required proof |
| --- | --- | --- | --- |
| shared-Hub admission `POST /api/game/hub` | backend provisioner | verified-already-at-parity | `201`, no-store, same-origin WSS path |
| public `/game-hub` WebSocket edge | Caddy -> supervisor `:5222` | out-of-system — Website shared topology; live route restored exactly | public `101`, welcome, party state, clean close |
| private `/game-sessions/*` edge | Caddy -> supervisor `:5222` | verified-already-at-parity | route remains before fallback |
| ordinary Website fallback | Caddy -> backend `:5220` | verified-already-at-parity | remains last; `/game` HTTP stays 200 |
| resident shared host and ticket claim | supervisor protocol 37 | verified-already-at-parity | welcome plus one-use authentication |
| shared diagnostic identity | client sentinel `shared-hub` | out-of-system — Website support correlation policy | backend and stored archive accept exact sentinel |
| private diagnostic identity | 32 URL-safe characters | verified-already-at-parity | remains accepted |
| configured/no-session diagnostic identity | `null` | verified-already-at-parity | remains accepted |
| arbitrary short diagnostic label | backend validation boundary | verified-already-at-parity | remains rejected; no generic relaxation |
| diagnostic header, bounded report, failure, entries, rate limit, credential exclusion | client/backend diagnostics | verified-already-at-parity | existing consent and archive contracts |
| Caddy source in release artifact | deployment worker | out-of-system — production configuration ownership | immutable artifact member and checksum |
| same-revision Caddy drift | deployment worker early-exit branch | out-of-system — production reconciliation policy | mismatched site hash prevents false “already deployed” success |
| full-release Caddy install/reload | remote atomic deploy | out-of-system — production configuration ownership | staged validation, backup, atomic install, graceful reload |
| Caddy rollback | remote release rollback | out-of-system — production recovery ownership | prior site restored and reloaded on any later failure |
| active-session guard | supervisor health and worker | verified-already-at-parity | no game-service restart or release cutover with active sessions |
| raw-client acceptance protocol | party/Lua smoke tooling | out-of-system — Website verification transport | imports protocol identity; no numeric copy |
| empty-host save resume after ambient ticks | private host/session lifecycle | out-of-system — Website save ownership | zero clients and player entities define freshness; fixed-clock advance does not |

No member is blocked by the browser platform.

## Ownership thread and recovered contract

- Causal path: New Game requests a one-use ticket; the backend returns public
  `/game-hub`; Caddy must select that handler before the Website fallback; the
  supervisor upgrades, claims the ticket during hello, and publishes welcome.
  Falling through to `:5220` returns SPA HTML with status 200, so the browser
  never reaches protocol/authentication code.
- Diagnostics path: `GameClientDiagnostics.setEndpoint()` maps the public path
  to a stable noncredential identifier. The backend owns the exact accepted set:
  `null`, `shared-hub`, or a private 32-character id. General short labels
  remain invalid.
- Deployment path: one exact `origin/main` revision must produce runtime and
  Caddy configuration in the same checksummed artifact. “Already deployed” is
  true only when both the deployed SHA and live Caddy checksum match. Changed
  Caddy is validated before install, backed up, installed atomically, validated
  as part of the imported whole, and gracefully reloaded. A failed release
  restores both runtime and Caddy.
- Entry/teardown: Caddy reload does not recreate the supervisor or party state.
  Ticket expiry, private endpoints, control heartbeats, player teardown, and
  zero-occupancy resident Hub behavior retain their existing owners.

## Nearby-system finding and process failure

The 2026-08-20 shared-Hub pass changed the checked-in Caddy route but did not
make deployment consume that file, and its source-level cutover test could not
observe live drift. It also asserted the client’s `shared-hub` label without
submitting that label through the backend validator. Both were incomplete
membership closures in one control-plane system, not intermittent networking
or player-state failures.

The first post-fix Windows party journey also proved the committed raw party
smoke still sent protocol 35 after the product advanced to protocol 37. The
host correctly rejected it before authentication. All raw browser-game
acceptance tools are therefore sibling protocol consumers and must import the
authoritative identity rather than copy a version literal.

GitHub's first validation of the published fix exposed the adjacent private
resume race deterministically under slower scheduling: a new host's fixed clock
advanced before its first hello, so the old `state.tick === 0` proxy for
freshness rejected a valid save before reaching mod-mismatch validation.
Authenticated clients, Hub world, and player-entity population already own the
actual fresh-host boundary; an empty ambient tick is not an owner.

## Web implementation consequence

- Accept only the exact shared sentinel beside the existing null/private
  branches; do not hide the bug by dropping diagnostic correlation.
- Turn the browser diagnostic integration contract into the real shared-Hub
  payload, while retaining explicit null/private acceptance and invalid-label
  rejection.
- Package the checked-in Caddy site with every release. Compare its expected
  hash before the deployed-SHA early exit, reconcile a same-revision drift, and
  include Caddy backup/reload in remote rollback ownership.
- Add a deploy contract that locks shared/private/fallback order and requires
  artifact, validation, checksum, install, reload, and rollback seams.
- Make party and Lua acceptance tools consume `GAME_PROTOCOL_VERSION` /
  `GAME_PROTOCOL_NAME`; lock out numeric protocol copies in their source.
- Remove fixed-tick value from private-host freshness. Retain zero clients, Hub
  world, and zero player entities, and prove a delayed first hello still reaches
  the exact mod-mismatch confirmation branch.

## Validation contract

- Focused red/green: current shared-Hub report must fail before the backend
  change and pass after it; private/null pass and arbitrary labels fail.
- Deployment contract: source handler order plus artifact/reconcile/install/
  rollback ownership must fail against the pre-fix worker and pass afterward.
- Acceptance-tool contract: party and Lua smoke source must use the
  authoritative protocol exports; the complete party journey must authenticate
  and launch rather than wait on a stale-client timeout.
- Resume race contract: advance an empty private host beyond tick zero before
  hello; unconfirmed mismatch rejects for confirmation and explicit continuation
  resumes the saved owner.
- Canonical gate: Windows-native `./scripts/validate.sh` on the exact final
  revision.
- Browser/live: real production New Game reaches Hub without a connection
  report; explicit synthetic disconnect diagnostics using `shared-hub` are
  accepted and stored; private route remains reachable; no page/console errors.

## Implementation validation receipt

- Immediate production repair: with zero sessions/Hub players/runs, the exact
  checked-in site file was backed up to
  `/var/backups/solomon-dark-caddy/solomon-dark-revived.20260821T124330Z.pre-game-hub`,
  validated, atomically installed, and gracefully reloaded with Caddy
  `NRestarts=0`. A post-fix protocol-37 probe received `server-welcome`,
  `server-party-state`, and `server-save-checkpoint`, then closed cleanly
  with code 1000.
- Source implementation: the backend accepts only `null`, exact
  `shared-hub`, or an exact 32-character private id. The deploy worker hashes
  the Caddy source from the target Git object, packages it under `Deploy/`,
  blocks both early-success branches on the live checksum, validates and
  atomically installs/reloads changed configuration, and restores it with a
  failed runtime release. Party and Lua acceptance tools now import protocol
  identity from the authoritative module.
- Red/green contracts: the pre-fix canonical run reproduced the shared report
  at `400` and all eight missing deployment-ownership seams. After the fix,
  backend integration covers shared/private/null/invalid identities and the
  deployment contract locks route order, artifact, hash, validation, install,
  reload, and rollback ownership.
- Canonical WSL receipt: `./scripts/validate.sh` exited zero with backend
  integration `13/13`, Library `2/2`, loot `40/40`, prerequisites
  `158/158`, broad game `1048/1048`, parties `14/14`, level-up `5/5`,
  diagnostics `7/7`, Hall `15/15`, Hub UI `14/14`, desktop `5/5`,
  lint/format/boundaries, production builds, `276116` raw / `82792` gzip
  game budget, and media policy.
- Final Windows-native canonical receipt on rebased commit `8c6be26`:
  backend `13/13`, Library `2/2`, loot `40/40`, prerequisites `158/158`,
  broad game `1048/1048`, parties `14/14`, level-up `5/5`, diagnostics
  `7/7`, Hall `15/15`, Hub UI `14/14`, desktop `5/5`, formatting/lint/
  boundaries, production builds, `276116` raw / `82789` gzip game budget,
  and media policy all passed.
- Windows Chrome diagnostic journey entered the shared Hub, terminated only
  the owned test supervisor, rendered the expected disconnect report, submitted
  exact `sessionId: "shared-hub"`, received `201` and reference
  `9b6bb2ad-de6d-45ad-9ca5-e3565ba6b75b`, and had zero page errors. The one
  console error was the intentionally induced code-1006 connection failure.
- The corrected Windows desktop party journey authenticated all four clients
  with protocol 37, entered run `d62fbdb9f24b318af9e7aeaf1982665d` with the
  three-member party, advanced the outsider in Hub, reported
  `hubPlayers=1/parties=2/runs=1/players=4`, then returned every count to zero
  with empty page/console errors.
- GitHub run `32485846215` then reproduced the empty-host resume race:
  `tick > 0` selected “fresh host owner” before mod mismatch. A deterministic
  delayed-hello regression failed before the fix and passes after removing only
  the tick proxy; zero clients, Hub world, and zero player entities remain
  mandatory.
- The follow-up Windows-native canonical gate passed the same complete matrix
  on code-identical pre-receipt commit `aaac1fc`, including the deliberately
  delayed resume under the broad suite; its game entry was `276116` raw /
  `82791` gzip bytes. A concurrent
  high-load WSL rerun also passed the resume regression but recorded one
  unrelated Lua p99 sample at `20.918 ms` against the `20 ms` limit; the
  isolated Lua timing suite immediately passed unchanged, so no performance
  threshold or Lua code was altered.
- Publication/deployment: `7572139` delivered the edge/diagnostic ownership
  fix; `a086325` delivered the deterministic resume-race closure. Local,
  tracking, remote `main`, worker last-success, and production matched
  `a086325579a5d2a1ed87808cd017663bb2d959b8` for the final code receipt.
  GitHub Validate run `32486805963` passed. The receipt text itself is a
  documentation-only follow-up with no runtime behavior change.
- The final guarded cutover retained rollback
  `/opt/solomon-dark-revived.rollback-pre-a086325579a5-20260821T133007Z`
  and database backup
  `/var/backups/solomon-dark-revived/pre-a086325579a5-20260821T133007Z/sdr.db`.
  Website, supervisor, and Caddy were active with zero restarts; live and
  backup database integrity returned `ok`; supervisor protocol 37 reported
  zero players/sessions/parties/runs; live/artifact Caddy SHA-256 was
  `d27a74bafa41ec7c7ea85d1bb352bcbfa0fa475a3283335d01b8d0f3859b89e9`.
- Final Windows production Chrome entered the Hub with one player, no page or
  console errors, and no unexpected request failures. The two observed
  `ERR_ABORTED` requests were expected cancelled optional MP3 preloads during
  the scene transition. Public, loopback, and deployed index SHA-256 matched at
  `b7ea3e059fe5be7044dd9454f59ba8b8f4dddc1ea4ca71863c9d81b4ffd235aa`.
- Final production diagnostic submission with exact `sessionId: "shared-hub"`
  returned `201`, reference
  `d42f1347-eb8a-4024-8f89-c254a4183458`, and one matching private database
  row. Both original repros are closed; no required member or platform-blocked
  branch remains.
