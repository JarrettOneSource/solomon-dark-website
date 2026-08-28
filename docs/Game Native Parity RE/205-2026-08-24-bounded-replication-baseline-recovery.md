# 2026-08-24 — Bounded replication-baseline recovery

## Reported smell and parity question

- Reported production behavior: the seven-day game-host journal contained
  `24,073` `replication.baseline_missing` warnings. The warning was not a
  process-crash cause, but one stalled client emitted `14,155` rows over nearly
  eighteen minutes while remaining a median `1,128` and maximum `1,923`
  snapshot sequences behind the host.
- The user authorized fixing every currently confirmed Website `/game` fault
  after the crash-log review. All crash and submitted-client fault classes were
  already fixed on current production; this unbounded recovery episode was the
  sole unresolved log/runtime defect.
- Web behavior to preserve: every reconstructed client state is authoritative,
  a missing descriptor or baseline is replaced by a complete keyframe, one
  slow peer cannot pause the simulation or another peer, and malformed future
  acknowledgements still fail closed.
- Falsifiers: an unrelated warning producer; a host which already stops adding
  snapshots behind its recovery keyframe; a client acknowledgement outside the
  retained-history edge; or a transport that can deliver a later snapshot
  before the earlier recovery keyframe would disprove the causal model. None
  applies.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Live production | NFO `journalctl -u solomon-dark-game.service`, seven days ending `2026-08-24T21:16:52Z` | `24,073` missing-baseline warnings across 32 clients: `22,594` on Aug 22 and `1,011` on Aug 24; no paired `simulation.tick_failed`, process exit, or kernel OOM | high-live |
| Live episode distribution | same structured journal, grouped by player and sequence | largest episode emitted `14,155` warnings from `18:44:06Z..19:01:59Z`; another emitted `3,171` in 160 seconds; sequence lag was far beyond the 64-frame retention window | high-live |
| Current host path | `game-host.ts`: client/observer ACK handlers, `broadcastSnapshot`, and `pruneReplicationBaselines` | a missing ACK sets `forceReplicationKeyframe`, but every ACK logs independently and `broadcastSnapshot` clears the flag immediately after sending while continuing ordinary snapshots | high |
| Current client path | `game-client-session.ts`, `game-observer-session.ts`, `EntityReplicationReconstructor` | clients ACK every successfully reconstructed snapshot and request a keyframe on a gap; after a browser stall, already queued pre-recovery frames continue producing ordered stale ACKs | high |
| Transport contract | browser/Node WebSocket rails used by `GameTransport` and `ws` | each direction is reliable and ordered; pausing only new snapshot sends after one recovery keyframe leaves a finite queue whose last state message is that complete keyframe | high |
| Current clean production | deployed/current-main ancestor `9ddef4d3`, protocol 72, NFO health at `2026-08-24T21:16:52Z` | Website/game/Caddy active, two players, zero post-start errors/restarts and no new diagnostic upload; absence of a fresh stall does not invalidate the seven-day deterministic path | high-live |

This is a Website transport adaptation with no retail network analogue and no
new stock fact. The Mod Loader native reports therefore do not change.

## System boundary and membership inventory

Web system: per-peer compact-snapshot baseline retention, acknowledgement,
keyframe recovery, logging, and teardown from welcome through an arbitrary
browser/observer stall.

| Member (role/branch/lifecycle) | Current owner | Disposition | Proof |
| --- | --- | --- | --- |
| player welcome baseline | `HostClient` construction and `EntityReplicationReconstructor.reset` | verified-already-at-parity | initial full snapshot and sequence remain the first retained/acknowledged baseline |
| observer welcome baseline | `HostObserver` construction and observer reconstructor | verified-already-at-parity | same complete baseline without participant mutation |
| ordinary retained player ACK | player `client-snapshot-ack` branch | verified-already-at-parity | advances monotonically and prunes only older history |
| ordinary retained observer ACK | observer ACK branch | verified-already-at-parity | same shared recovery owner, read-only role unchanged |
| duplicate/older ACK | shared acknowledgement owner | verified-already-at-parity | ignored without rewinding or logging |
| ACK ahead of the last sent sequence | host protocol boundary | verified-already-at-parity | remains an explicit invalid-message disconnect for both roles |
| 64-baseline memory bound | baseline pruning owner | verified-already-at-parity | acknowledged and pending recovery baselines remain protected within the fixed bound |
| player ACK for an evicted baseline | host recovery owner | exact-ported in this closure | starts one recovery episode and one warning rather than one warning per queued ACK |
| observer ACK for an evicted baseline | same shared owner | exact-ported in this closure | receives the same bounded recovery without player-only assumptions |
| client-requested keyframe after reconstruction gap | player and observer clients plus host ACK owner | exact-ported in this closure | coalesces repeated requests into the same pending episode |
| one recovery keyframe | per-peer snapshot sender | exact-ported in this closure | sends one complete state after the request, then records its sequence |
| stale pre-keyframe ACK backlog | per-peer recovery state | exact-ported in this closure | counts/ignores ordered stale ACKs without scheduling or logging another keyframe |
| recovery-keyframe ACK | per-peer recovery state | exact-ported in this closure | advances the baseline, emits one completion record, and resumes deltas |
| snapshots while recovery is pending | `broadcastSnapshot` player/observer loops | exact-ported in this closure | paused for only that peer so its finite WebSocket queue can drain |
| healthy sibling clients/observers | independent per-peer loop state | verified-already-at-parity; coverage expanded | continue receiving/ACKing snapshots throughout another peer's recovery |
| periodic five-second keyframes | shared snapshot clock | verified-already-at-parity | remain ordinary non-pausing refreshes outside a recovery episode |
| Hub/Boneyard world-identity keyframes | entity-frame constructor | verified-already-at-parity | strict identity changes remain complete frames and do not weaken validation |
| shared Hub, private College, standalone desktop | common `GameHost` transport owner | exact-ported through the shared state | no topology-specific recovery branch |
| connection replacement, disconnect, observed-run end, host teardown | client/observer map lifetime | verified-already-at-parity | pending recovery state dies with its socket owner |

No member is blocked by the browser platform. Ordered WebSocket delivery is
the existing supported transport contract, not a new approximation.

## Ownership thread and recovered behavioral contract

- The client ACK means that exact snapshot was completely reconstructed; the
  host alone owns which retained baseline future deltas use. At production's
  default 20 Hz, 64 retained frames cover about 3.2 seconds.
- A longer browser/main-thread stall allows the host to outpace the client. The
  server eventually receives an ACK for a sequence it sent but no longer
  retains. That edge requires a complete keyframe.
- The old boolean described only “force the next frame.” It forgot the rest of
  the recovery lifetime. Once the next broadcast cleared it, ordinary frames
  continued to accumulate behind the recovery keyframe and later stale ACKs
  reopened/logged the same condition. A client processing below ingress rate
  could therefore never reach the repair frame.
- Recovery is one per-peer state: queued before the keyframe, awaiting the exact
  keyframe sequence after send, and complete only when that sequence is ACKed.
  While awaiting it, the host skips snapshot sends to that peer. Fixed ticks,
  saves, sideband control messages, heartbeat control frames, and every other
  peer continue normally.
- Reliable ordered delivery makes the pending queue finite: all old frames
  precede the keyframe and no new snapshots are appended. Applying/ACKing that
  complete frame re-establishes the baseline; the next current-state delta may
  jump global sequence/tick values without replaying stale presentation frames.
- One `replication.baseline_missing` warning opens a host-detected episode. One
  `replication.baseline_recovered` info row closes either a host-detected or
  client-requested episode with cause, keyframe sequence, stale-ACK count, and
  duration. No credential, payload, or chat content enters either log.
- No protocol or save-schema bump is required: message shapes and authoritative
  state are unchanged. This closes host bookkeeping and send cadence only.

## Nearby-system findings

- Ordinary proxy/player close warnings were lifecycle consequences. The Website
  service had no process exits, and its transient supervisor connection-refused
  rows coincided exactly with already-fixed game-host crashes.
- Unlimited recovery-frame ingress, not the 64-frame bound itself, made the
  warning episode self-sustaining. Enlarging history or rate-limiting only the
  log would delay or hide the same failure and is intentionally rejected.
- No Mod Loader document changes: this system has no retail multiplayer owner
  and recovers no executable address, authored row, asset, or native lifecycle.

## Confidence and open questions

- Confirmed: production counts/timing/lag; player and observer call paths;
  retention/pruning; ACK and keyframe semantics; snapshot cadence; reliable
  ordered transport; logging amplification; and teardown ownership.
- Inferred: none material to the fix.
- Unknown: none inside the supported WebSocket recovery boundary. A transport
  that does not preserve reliable order remains outside the currently supported
  rails rather than receiving guessed compatibility behavior.

## Web implementation consequence

- Replace the one-tick force boolean with cohesive per-peer recovery state
  shared by player and observer ACK handlers.
- Send one complete keyframe, pause only that peer's snapshot lane until its
  ACK, suppress/count pre-keyframe ACKs, then resume from the recovered baseline.
- Preserve the 64-frame bound, five-second periodic keyframe, strict protocol
  validation, simulation cadence, and all other clients.
- Preserve one opening warning and add one bounded completion receipt. Do not
  add a log throttle, larger history, disconnect timer, compatibility mode, or
  client-side guessed state.

## Validation contract

- Red host regression on untouched current main: let a player fall beyond 64
  snapshots, replay its stale ACK backlog, and prove multiple warnings plus
  continued post-keyframe sends before the fix.
- Fixed player regression: exactly one warning; one recovery keyframe; no later
  snapshots before its ACK; a healthy sibling continues; ACK resumes a delta
  from the recovery baseline and produces one completion row.
- Observer regression: the read-only peer follows the same pause/recover/resume
  state without changing player count, party state, or the observed run.
- Existing branches: explicit client gap, retained/duplicate/future ACK,
  periodic/world keyframes, disconnect, replacement, and host teardown remain
  covered.
- Run the complete Mac `/opt/homebrew/bin/bash ./scripts/validate.sh` gate on a
  manifest-identical clean candidate.
- Built Mac Chrome/WebGL: keep a second player live, block one page longer than
  the 3.2-second history, then require one warning, one keyframe/completion,
  bounded recovery time, a current snapshot on both pages, and empty page,
  console, failed-response, disconnect, and host-error arrays.

## Implementation validation receipt

- `game-host.ts` now owns one shared player/observer recovery state instead of
  the one-broadcast `forceReplicationKeyframe` bit. The first missing baseline
  or explicit client gap queues a complete keyframe; after sending it, only
  that peer's snapshot lane stops until the exact keyframe ACK arrives. Ordered
  stale ACKs are counted without another warning or keyframe. Recovery advances
  the retained baseline, emits one bounded completion row, and resumes current
  deltas; heartbeat, control messages, fixed ticks, saves, and other peers never
  pause.
- The untouched-current-main Mac red gate passed the other `1,501` Boneyard
  tests and failed the two new player/observer regressions because both roles
  continued sending behind the recovery keyframe. The fixed tests pass in
  `967.5 ms` and `2,293.1 ms`, respectively, including one warning, one
  completion, exact keyframe baseline, healthy-player progress, observer
  isolation, and resumed deltas.
- The first complete green gate reached all new recovery assertions but one
  unrelated Web Lua timing sample reported p99 `22.714 ms` against its 20-ms
  environmental ceiling. No Lua source changed. The clean unchanged rerun
  passed that sample and the complete supported Mac gate. After concurrent main
  added save-provenance coverage and the shared Memorial, the recovery commit
  rebased onto exact base `ad668724092a0a6c88756349257d7947c1b796ca`;
  both systems' comments, tests, schemas, and ledger entries were preserved
  while only the superseded force-keyframe field was removed. The
  manifest-identical pre-Memorial tree passed backend build and 22 contracts;
  formatting/lint/import boundaries; every frontend and desktop group;
  production frontend/GameHost builds; media policy; and bundle budget. The
  final Game entry is `461,300` raw / `129,285` gzip bytes against `524,288` /
  `131,072`; that gate-log SHA-256 is
  `8ca8acd84011621cc156fa83bc5ab28d4933a1469e005e3f594a9a04b2d9830c`.
- Built Mac Chrome 151 used two independent contexts and production snapshot
  rate 20. Blocking player 1's renderer for five seconds advanced authority
  `1,965 -> 2,476` ticks and the healthy peer `1,960.03 -> 2,470`. The host
  opened exactly one warning at ACK 396 / last-sent 495, queued keyframe 496,
  suppressed 99 stale ACKs, and recorded recovery after 41 ms. The recovered
  page reached tick `2,468.79`, within eight ticks of authority, with both players
  still visible and zero page, console, failed-response, runtime-surface, or
  host errors.
- The inspected recovered-Hub frame visibly retains both participants and the
  complete WebGL Courtyard/HUD. Screenshot SHA-256 is
  `0f482588a78d857b9f0f90a98c513743a5c1fa0644520d64d20d62434b0ea2ce`;
  structured browser-receipt SHA-256 is
  `6a773b9d4ea65297f16bcc4d9d505375641d5a87f010089793bba2a2e1875c24`.
- No protocol/save schema, client decoder, native report, or browser-platform
  approximation changed. Publication and deployment remain separate receipts.
