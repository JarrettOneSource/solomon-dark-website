# NFO browser game runtime

The production website and browser game sessions are separate supervised
processes from the same release directory:

- `solomon-dark-revived.service` serves the site and provisions a private
  endpoint through the loopback supervisor;
- `solomon-dark-game.service` runs the bundled TypeScript authoritative host on
  pinned Node `22.17.0`; and
- Caddy terminates TLS and forwards only `/game-sessions/*` to the supervisor.

`/etc/solomon-dark-game.env` must be mode `0600`, owned by root, and contain:

```dotenv
SDR_GAME_SUPERVISOR_SECRET=<random 32-byte base64url value>
SDR_GAME_ALLOWED_ORIGINS=https://solomondarker.com
SDR_GAME_SUPERVISOR_HOST=127.0.0.1
SDR_GAME_SUPERVISOR_PORT=5222
SDR_GAME_MAX_SESSIONS=64
SDR_GAME_MAX_CONNECTIONS_PER_SESSION=16
SDR_GAME_UNCLAIMED_TIMEOUT_SECONDS=120
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
provisioning contract. New Game uses `POST /api/game/lobbies`, and `/parties`
reads `GET /api/game/lobbies`; both are projections of the same live supervisor
and do not write the Steam launcher lobby database. Joiners receive the guest
credential only from `POST /api/game/lobbies/{id}/join`. Unclaimed sessions
expire after two minutes. A used session shuts down when its final
authenticated player and in-flight proxy have both left. The game host and
browser-facing proxy send WebSocket control pings every five seconds and
terminate a peer after one unanswered interval, bounding half-open player
detection to ten seconds.

Deploy the checked-in unit and Caddy site, validate both before reloading, and
restart the game supervisor together with the website whenever the bundled game
protocol changes. A release is healthy only when all of these pass:

1. the website and game units are active with zero unexpected restarts;
2. `http://127.0.0.1:5222/health` reports the release protocol;
3. private provisioning and Web Rebuild Playtest create/list/join responses are
   `no-store` and return same-origin `wss` URLs where applicable;
4. a guest may complete Create first without becoming host, then both clients
   complete the protocol handshake and authoritative movement; and
5. a real two-browser `/parties` -> `/game?party=<id>` journey reaches one Hub
   without console or page errors.
