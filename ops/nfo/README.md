# NFO browser game runtime

The production website and browser game sessions are separate supervised
processes from the same release directory:

- `solomon-dark-revived.service` serves the site and provisions a private
  endpoint through the loopback supervisor;
- `solomon-dark-game.service` runs the bundled TypeScript authoritative host on
  the bundled Node runtime; and
- Caddy terminates TLS and forwards `/game-hub` and `/game-sessions/*` to the
  supervisor.

`/etc/solomon-dark-game.env` must be mode `0600`, owned by root, and contain:

```dotenv
SDR_GAME_SUPERVISOR_SECRET=<random 32-byte base64url value>
SDR_GAME_ALLOWED_ORIGINS=https://solomondarker.com
SDR_GAME_SUPERVISOR_HOST=127.0.0.1
SDR_GAME_SUPERVISOR_PORT=5222
SDR_GAME_MAX_SESSIONS=64
SDR_GAME_MAX_CONNECTIONS_PER_SESSION=16
SDR_GAME_DEPLOYMENT_SAVE_TIMEOUT_SECONDS=30
SDR_GAME_UNCLAIMED_TIMEOUT_SECONDS=120
SDR_GAME_LOG_LEVEL=info
SDR_GAME_ML_BOT_CHECKPOINT=/opt/solomon-dark-revived/GameHost/ml-bot-policy-v7-selected.sdml
SDR_RUNTIME_EVENT_ENDPOINT=http://127.0.0.1:5220/api/internal/runtime-events
SDR_RUNTIME_EVENT_SECRET=<a separate random 32-byte base64url value>
```

The checked-in game unit owns the fixed
`SDR_GAME_MEMORIAL_PATH=/var/lib/solomon-dark-game/memoratorium.json` value and
uses `StateDirectory=solomon-dark-game` to create its writable directory before
the supervisor starts. Do not duplicate that non-secret machine path in the
protected environment file.

During a versioned checkpoint cutover, the deployment worker backs up this
protected environment file, atomically installs the selected checkpoint path
after swapping in the matching release, and restores the prior file if release
health rolls back.
The supervisor reads its immutable generation directly from the release-owned
`/opt/solomon-dark-revived/DEPLOYED_GIT_SHA`; release identity is not duplicated
in the protected environment file.

The same secret is supplied to the website through its existing protected
environment file using these keys:

```dotenv
GameSessions__AdminSecret=<the same random value>
GameSessions__SupervisorUrl=http://127.0.0.1:5222
GameSessions__PublicWebSocketOrigin=wss://solomondarker.com
DeveloperAccess__UserIds=<comma-separated authenticated user IDs>
RuntimeEvents__Secret=<the same separate runtime-event value>
```

Runtime activity is retained in the Website SQLite `RuntimeEvents` outbox for
30 minutes, capped at 2,000 rows, and pruned by the Website every minute. The
game host submits selected transient party, run, session, observer, connection,
and player-death events through the authenticated loopback endpoint; external
consumers may read the outbox directly without receiving any Website or
game-session credential.

The supervisor also uses this secret as the key for domain-separated global
leaderboard receipts. The website verifies those receipts with the matching
protected value. Rotating it therefore requires restarting both services;
never expose it to the browser or a build-time variable.

Never place the supervisor secret or a provisioned session credential in a
build-time Vite variable. Clean New Game uses `POST /api/game/hub`; mods,
cheats, and local-only saves use `POST /api/game/sessions`. Party IDs and public
listings resolve through `/api/game/join/*` into memory-only intents, followed
by one single-use ticket after Create. There is no browser lobby namespace or
join URL. Private Colleges never receive the leaderboard signing secret.
Unused admissions and unclaimed private sessions expire after two minutes. A
used private session shuts down when its final authenticated player and
in-flight proxy have both left; the empty shared Hub host remains resident and
reports zero occupancy. The game host and browser-facing proxy send WebSocket
control pings every five seconds and close an unresponsive connection with an
explicit timeout code and reason.

`DeveloperAccess__UserIds` is a protected server allowlist, not a browser
secret. The Website resolves it from the authenticated JWT subject and seals
the result into the single-use ticket. Entitled users retain ordinary
shared-Hub routing with `Enable Cheats` off. In DevTools, summon one bot per
call with:

```js
await solomonDark.lua.execute('return sd.bots.summon()')
```

The checkpoint and inference worker are immutable release members under
`GameHost/`; neither is served by the static Website. A bot is a normal party
participant but is excluded from human occupancy, private-session teardown,
and deployment-save counts.

The supervisor writes structured JSON events to stderr, which systemd captures
in the `solomon-dark-game.service` journal. `info` records session and player
lifecycle events; `warning` records lag, heartbeat timeouts, abnormal
disconnects, rejected connections, and proxy failures; `error` records host,
simulation, and process failures. Set `SDR_GAME_LOG_LEVEL=debug` temporarily to
include connection and proxy-open events. Browser players see a plain-English
disconnect reason and may explicitly send the bounded in-memory client log to
the website. Those reports use the private diagnostic-log archive rather than
public uploads.

The guarded main deployment worker packages the checked-in Caddy site and game
systemd unit beside the runtime. It compares both live hashes even when the
deployed Git SHA is already current, validates each candidate before an atomic
install, retains the prior files in the release backup, gracefully reloads
Caddy, and daemon-reloads systemd before the candidate starts. Any later
release failure restores and reloads both backups. The active-session guard
is replaced by an authenticated deployment drain for runtime cutover: the
supervisor rejects new admissions, freezes every host, publishes a final
owner-only checkpoint to every connected player, waits for bounded browser
storage acknowledgements, and closes the clients with code `1012` and reason
`game updating`. Caddy-only reconciliation remains a graceful reload and does
not disconnect games. The Website stays live until the save grace completes so
authenticated cloud-slot writes can finish. The release manifest at
`/deployment.json` is `no-store` and owns the automatic browser reload edge.
Before rollback, candidate unit status and bounded journal tails are streamed to
the machine-local deployment receipt. That worker records the failed target and
will not drain players for the same SHA again until an operator explicitly
reinstalls the worker or a different commit reaches `main`.

Restart the game supervisor together with the website whenever the bundled game
protocol changes. A release is healthy only when all of these pass:

1. the website and game units are active with zero unexpected restarts;
2. `http://127.0.0.1:5222/health` reports the release protocol;
3. the live Caddy site checksum matches the release artifact, with
   `/game-hub` and `/game-sessions/*` before the Website fallback;
4. private, shared-Hub, and party admission responses are `no-store` and
   return same-origin `wss` URLs where applicable;
5. independently admitted clients enter one Hub with distinct singleton
   parties and authoritative movement; and
6. a real three-browser journey proves invite, accept, visibility, Party ID
   rotation, guest request approval, party-only Boneyard launch, and an
   unrelated player continuing in the Hub without console or page errors;
7. a private-College journey proves signed-in mod sync and guest session-only
   content, per-player tickets/checkpoints, and final-player teardown; and
8. `/health` reports shared and private occupancy without exposing Party IDs,
   credentials, manifests, or request tokens.
