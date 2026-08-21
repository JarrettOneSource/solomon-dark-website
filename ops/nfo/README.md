# NFO browser game runtime

The production website and browser game sessions are separate supervised
processes from the same release directory:

- `solomon-dark-revived.service` serves the site and provisions a private
  endpoint through the loopback supervisor;
- `solomon-dark-game.service` runs the bundled TypeScript authoritative host on
  pinned Node `22.17.0`; and
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
SDR_GAME_UNCLAIMED_TIMEOUT_SECONDS=120
SDR_GAME_LOG_LEVEL=info
```

The same secret is supplied to the website through its existing protected
environment file using these keys:

```dotenv
GameSessions__AdminSecret=<the same random value>
GameSessions__SupervisorUrl=http://127.0.0.1:5222
GameSessions__PublicWebSocketOrigin=wss://solomondarker.com
```

Never place the supervisor secret or a provisioned session credential in a
build-time Vite variable. `POST /api/game/sessions` retains the private
provisioning contract. New Game uses `POST /api/game/hub` to receive one
single-use admission to the process-wide Hub. Party discovery and invitations
happen inside that Hub; there is no browser lobby directory or join URL.
Unused admissions and unclaimed private sessions expire after two minutes. A
used private session shuts down when its final authenticated player and
in-flight proxy have both left; the empty shared Hub host remains resident and
reports zero occupancy. The game host and browser-facing proxy send WebSocket
control pings every five seconds and close an unresponsive connection with an
explicit timeout code and reason.

The supervisor writes structured JSON events to stderr, which systemd captures
in the `solomon-dark-game.service` journal. `info` records session and player
lifecycle events; `warning` records lag, heartbeat timeouts, abnormal
disconnects, rejected connections, and proxy failures; `error` records host,
simulation, and process failures. Set `SDR_GAME_LOG_LEVEL=debug` temporarily to
include connection and proxy-open events. Browser players see a plain-English
disconnect reason and may explicitly send the bounded in-memory client log to
the website. Those reports use the private diagnostic-log archive rather than
public uploads.

The guarded main deployment worker packages the checked-in Caddy site beside
the runtime. It compares the live site hash even when the deployed Git SHA is
already current, validates a candidate before an atomic install, retains the
prior site in the release backup, and gracefully reloads Caddy. Any later
release failure restores and reloads that backup. The active-session guard
still applies before either reconciliation or runtime cutover.

Restart the game supervisor together with the website whenever the bundled game
protocol changes. A release is healthy only when all of these pass:

1. the website and game units are active with zero unexpected restarts;
2. `http://127.0.0.1:5222/health` reports the release protocol;
3. the live Caddy site checksum matches the release artifact, with
   `/game-hub` and `/game-sessions/*` before the Website fallback;
4. private provisioning and shared-Hub admission responses are `no-store` and
   return same-origin `wss` URLs where applicable;
5. independently admitted clients enter one Hub with distinct singleton
   parties and authoritative movement; and
6. a real three-browser journey proves invite, accept, party-only Boneyard
   launch, and an unrelated player continuing in the Hub without console or
   page errors.
