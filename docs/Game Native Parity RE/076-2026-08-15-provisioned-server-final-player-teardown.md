# 2026-08-15 — Provisioned server final-player teardown

## Reported smell and parity question

- Reported web behavior: provisioned game servers remain live after every
  authenticated player has left. A half-open browser transport can also remain
  authenticated indefinitely because neither WebSocket boundary tests whether
  its peer still answers.
- Stock behavior to preserve: a participant departure tears down that
  participant's transport membership and actor without disturbing remaining
  participants. Stock has no separate remotely provisioned Node process, so
  destruction of an empty web host is control-plane policy rather than a
  guessed retail timer.
- Reproduction inputs/scenes: provision one private or discoverable browser
  session, complete one authenticated hello, close the final client from Hub or
  Boneyard, and inspect supervisor session ownership and endpoint reachability.
- Falsifiable questions: does final-player release reach the supervisor's
  teardown owner; can another authenticated or in-flight connection be closed
  accidentally; and does teardown close the per-session host rather than only
  hiding its directory record?

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Durable native evidence | Retail `SolomonDark.exe` SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; Mod Loader `docs/reverse-engineering/native-session-flow.md` at `d4331094` | Lobby disconnect is distinct from stock Leave Game. A departing participant retires its membership and actor while remaining participants continue. The retail executable has no remotely provisioned server lifetime to copy. | high |
| Client/host source trace | Website `4f92c93`; `game-client-session.ts` `destroy()`, `game-host.ts` socket `release()` | Client teardown sends `client-disconnect` and closes transport. The host then removes the exact authenticated player synchronously and knows when its player count transitions to zero. | high |
| Supervisor/proxy source trace | Website `4f92c93`; `game-session-supervisor.ts`, `run-game-session-supervisor.ts`, and `ops/nfo/README.md` | The supervisor does not consume that transition. A polling timer first observes an empty used session, starts `emptySince`, and closes only on a later poll after `idleTimeoutMs`; the shipped default is 300 seconds. | high |
| Transport-liveness source trace | Website `4f92c93`; `game-client-session.ts` application ping loop, `game-host.ts`, and `game-session-supervisor.ts` | The client sends a diagnostic `client-ping` every two seconds and expires its own RTT samples after ten seconds, but the host only echoes `server-pong`. Neither the direct host boundary nor the supervisor's browser-facing proxy sends WebSocket control pings or treats a missed pong as transport loss. | high |
| Focused runtime reproduction | Local Node `22.17.0`, real supervisor/game host/WebSocket proxy, 500 ms diagnostic idle timeout and 2,000 ms unclaimed timeout | After the only welcomed socket closed, `sessionCount()` remained `1` through 801 ms and became `0` at 902 ms. The two-poll delay reproduces the ownership defect without browser timing. | high |

This investigation recovers no new native address or reusable native-system
fact. The existing Mod Loader session report already owns participant departure,
so it does not receive a duplicate web-process policy entry.

## Native ownership thread

- Owner and construction path: the supervisor provisions and owns one
  `GameHost` and proxy path per browser session. The game host owns authenticated
  clients; the proxy owns browser/upstream socket pairs. Transport liveness is
  owned at each actual peer boundary: every game-host socket and every
  browser-facing supervisor socket.
- Upstream state producers/callers: `GameClientSession.destroy()` sends the
  explicit disconnect message and closes its transport. Abrupt browser/network
  loss reaches the same host socket release path.
- State representation and transitions: an unclaimed reservation has never had
  an authenticated player and may wait for its bounded claim timeout. A used
  session is live while it has an authenticated player or an in-flight proxy;
  it becomes terminal when both counts reach zero.
- Downstream consumers/callees: terminal empty state must remove the session
  from discovery and capacity accounting, close its `GameHost`, stop its 100 Hz
  timer/listener, and make the old proxy path reject future joins.
- Sibling systems sharing ownership or data: the standalone desktop/development
  host resets its run when empty but remains owned by its shell; externally
  managed dedicated servers retain their own process policy. Neither is a
  supervisor-provisioned browser session.
- Entry, interruption, reset, and teardown: an authenticated player can leave
  from any scene. Remaining players retain the exact session and host handoff.
  A pending proxy prevents teardown until it authenticates or releases. Once no
  authenticated player or proxy remains, the provisioned host is destroyed,
  not reset for reuse.

## Recovered behavioral contract

- Timing/ticks/thresholds: final-player teardown is event-driven. It has no
  gameplay-tick or arbitrary reconnect grace. Only never-claimed reservations
  retain the existing bounded wall-clock expiry. A transport control ping is
  sent every five seconds; one unanswered interval terminates the socket, so a
  newly half-open peer is detected within at most ten seconds. This operational
  liveness bound is independent of simulation and snapshot clocks.
- Input/network authority/replication: each socket release removes only its own
  actor. Authority handoff remains valid while another participant exists; no
  new host may join after terminal empty state.
- Boundary and failure behavior: an in-flight proxy counts as a potential join
  and must settle before the empty decision. Duplicate WebSocket close/error
  events and concurrent close requests are idempotent. Supervisor shutdown must
  still await all per-session hosts. A missed control pong force-terminates the
  dead boundary and enters the same socket release path as an explicit leave;
  it does not invent a second player-removal path.

## Nearby-system findings

- The existing five-minute delay is not reconnect support. The client does not
  persist its provisioned credential across page teardown, and the protocol's
  reserved resume token is not consumed by host authentication.
- `activeProxies` and authenticated player count intentionally differ during
  handshake and close propagation. Either event may arrive first, so both
  owners must re-evaluate the same terminal predicate.
- The existing JSON `client-ping`/`server-pong` exchange measures application
  RTT and remains protocol-visible. It is not a safe server watchdog because a
  background browser may throttle its JavaScript timer. WebSocket control pong
  is generated by the browser transport, below that timer.
- The game host sees the supervisor's upstream Node socket, not the browser.
  The supervisor must therefore monitor its downstream browser socket as well;
  an upstream auto-pong alone cannot prove that the player is still connected.
- Polling can miss a short-lived authenticated player entirely and later treat
  the used session as unclaimed. Event ownership removes that classification
  race as well as the delay.
- On Windows, the departing client's WebSocket close event can be observed
  before the host peer has dispatched its own close event. Tests and callers
  must observe the host-owned player-count transition rather than assume both
  sides of transport closure occur in one event-loop turn.

## Confidence and open questions

- Confirmed: client departure production, host player removal, proxy release,
  delayed supervisor expiry, standalone reset boundary, and lack of implemented
  resume authentication.
- Inferred policy: a never-claimed reservation should retain its current claim
  window so Create/loadout and initial connection are not raced.
- Unknown, non-material to this change: future reconnect leases. Adding one
  would require durable identity/token semantics and an explicit new lifetime
  contract rather than retaining an empty simulation accidentally.

## Web implementation consequence

- Correct owner/module: `GameHost` publishes authenticated player-count changes;
  `GameSessionSupervisor` combines them with proxy ownership and alone destroys
  provisioned hosts. A shared transport-heartbeat helper monitors each concrete
  WebSocket peer boundary and terminates a peer that misses its control pong.
- Shared model change: replace used-session polling and `idleTimeoutMs` with one
  event-driven terminal predicate evaluated after player and proxy release.
- Stock behavior preserved: a departing player's actor retires and remaining
  participants continue under authoritative host handoff.
- Symptom path to remove: `hadPlayer`, `emptySince`, the five-minute idle option,
  and its deployment setting. Unclaimed-session expiry remains timed.

## Validation contract

- Focused automated test: join two real proxied clients, prove the first leave
  retains the session, close the second, then prove session count/listing become
  empty and the old endpoint rejects a new upgrade. Cover a final player leaving
  while another proxy is still handshaking. Disable automatic pong on one real
  `ws` client, prove only that participant is removed while a healthy peer keeps
  the lobby live, then prove the healthy final leave destroys the session.
- Playwright/runtime journey: create and join a browser lobby through the real
  Website client path, close one browser while the peer remains, close the final
  browser, and verify the supervisor health count and party listing reach zero
  without page or console errors.
- Stock-versus-web comparison: stock evidence governs per-participant actor and
  membership retirement; web-only process destruction is accepted by exact
  session/endpoint closure rather than visual similarity.
- Measurable acceptance criteria: no close while any player or proxy remains;
  immediate event-loop teardown after the final releases; one awaited host
  close; zero discoverable/session records; and no change to 100 Hz simulation,
  20 Hz snapshots, or standalone/dedicated ownership.

## Implementation validation receipt

Implementation replaces the used-session idle poll with authenticated
player-count notifications and one shared terminal predicate over player and
proxy ownership. Session closure retains its record until the one shared host
close promise settles, so concurrent final-release and supervisor-shutdown
paths await the same teardown. A shared WebSocket control-heartbeat monitor now
owns direct game-host peers and the supervisor's downstream browser peers; a
missed pong force-terminates the socket and reuses its normal release path.

The two heartbeat regressions were captured red first: a direct authenticated
`ws` client and a proxied lobby participant with `autoPong: false` both timed
out waiting for removal before the monitor existed. With the implementation,
both focused cases passed. The complete host/supervisor run passed all 28 tests,
including healthy-peer retention, reserved-host handoff, standalone reset,
persistent-host behavior, pending-proxy protection, exact final-player close,
and rejection of the retired endpoint.

The final canonical `./scripts/validate.sh` exited 0 under Windows Git Bash on a
byte-identical Windows mirror of the exact authoritative tree. All test and
build executables were Windows-native: Node `22.17.0` with npm `10.9.2`, Python
`3.10`, and .NET SDK `10.0.302`. The gate built the backend with zero
warnings/errors; passed all 23 Website/backend contracts, frontend lint and
architecture boundaries, all 657 frontend tests, and all five desktop tests;
built the production frontend and game-host bundles; and passed production CSP
media policy. Output contained only the repository's existing Fast Refresh
warnings and Vite's non-fatal large-chunk advisory.

Windows Chrome `151.0.7922.138` then completed the real two-page Website journey
through the backend API, supervisor proxy, authoritative host, and WebGL Hub. It
proved two-player replication, `playersAfterGuestLeave: 1`, lobby and session
removal after the host page closed, `sessionsAfterFinalLeave: 0`, and empty
console/page error arrays. The captured Windows parties and Hub frames at
`C:\Users\User\AppData\Local\Temp\solomon-dark-server-lifecycle-parties-windows-20260815.png`
and
`C:\Users\User\AppData\Local\Temp\solomon-dark-server-lifecycle-hub-windows-20260815.png`
were visually inspected. Finally, a Windows Node probe (`process.platform ===
'win32'`) authenticated a real production-default proxied `ws` client with
automatic pong disabled: the transport closed in `10,012 ms` with close code
`1006`, and supervisor health reported `sessionsAfterDrop: 0`.
