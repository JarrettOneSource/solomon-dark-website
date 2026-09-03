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

## 2026-09-03 — Proactive slow-peer flow-control reopening

### Reported smell and parity question

- The bounded recovery state above stopped the former infinite warning/send
  loop after a peer crossed the 64-baseline retention edge. It did not stop a
  healthy host from first placing 64 expensive snapshots into a browser's
  ordered application queue. In a live five-player run, four clients repeatedly
  reached that edge and spent seconds replaying already-obsolete snapshots
  before reaching the repair keyframe.
- The user authorized fixing the measured lag causes before reconsidering the
  renderer. This reopens the complete player/observer replication flow, not
  snapshot contents, authoritative timing, or native presentation membership.
- The parity question is whether the host can detect application-level ACK lag
  before baseline eviction, stop building snapshots only for that peer, and
  resume from current authority after the already-sent finite prefix drains.
- Falsifiers are: kernel/Caddy backpressure rather than application ACK lag; an
  unordered transport; a client which requires every intermediate snapshot for
  simulation truth; or a global sequence jump which the existing strict
  reconstructor cannot apply against an acknowledged baseline. Live and source
  evidence reject each falsifier.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Live five-player run | NFO run `adea92b9b842f8859f618f8a970fa2d8`, revision `a2b19c2f`, `2026-09-03T03:20:59Z..03:40:23Z` | 46 missing-baseline episodes affected four of five players. ACK distance was 63..74 snapshots (median 64); recovery was 168..20,754 ms (median 4,224 ms), with each episode consuming the same 63..74 stale ACK prefix. | high-live |
| Live recovered continuation | revision `de814b46`, three-player continuation to wave 29 | seven further episodes occurred without a private `simulation.tick_lag`; ACK distance was 63..67 and recovery was 3,111..10,694 ms (median 5,884 ms). Slow-client saturation therefore survives independently of authoritative tick health. | high-live |
| NFO TCP/process sampling | same run, four sustained browser lanes | public lanes carried about 195..209 KiB/s each at 33..72 ms RTT, loopback/public send queues repeatedly drained to zero, scheduler pressure was negligible, and the game service averaged far below one CPU core. Transport capacity did not own the multi-second application queue. | high-live |
| Current host source | `game-host.ts` at task base `f74a441c` | ordinary sends continue until an ACK names an evicted member of the 64-entry map. Only then does the existing recovery state append one keyframe and stop that peer. | high-static |
| Current client source | `game-client-session.ts`, `game-observer-session.ts`, and presentation timelines at `f74a441c` | each fully decoded snapshot is ACKed; timelines retain at most eight snapshots; authoritative simulation never runs in the browser. Intermediate snapshots are presentation samples, not required gameplay decisions. | high-static |
| Existing recovery proof | this entry's prior Mac two-browser five-second stall receipt | once a recovery keyframe is appended, pausing only that peer is valid over the reliable ordered WebSocket and a later global sequence/tick jump already reconstructs correctly. | high-existing |

This remains a Website transport adaptation with no retail multiplayer analogue.
No native executable fact, Mod Loader artifact, protocol message shape, or save
schema changes.

### System boundary and membership inventory

Website system: per-peer authoritative snapshot admission, retained baselines,
ACK processing, proactive high/low-water flow control, true-gap keyframe
recovery, logging, and teardown across every supported game-host topology.

| Member (role/branch/lifecycle) | Current owner | Disposition | Required proof |
| --- | --- | --- | --- |
| player welcome baseline | host/client reconstructor | `verified-already-at-parity` | welcome remains a complete acknowledged starting point |
| observer welcome baseline | host/observer reconstructor | `verified-already-at-parity` | read-only role starts identically without participant mutation |
| healthy player ACK lane | shared replication peer | `verified-already-at-parity`; bounded admission added | 20-Hz production traffic continues while actual unacknowledged membership remains below high water |
| healthy observer ACK lane | same shared owner | `verified-already-at-parity`; bounded admission added | identical admission rule without player-only state |
| eight-frame high water | host sent-baseline membership plus client eight-snapshot history | `exact-ported` Website flow control | no ninth ordinary snapshot is built or sent for that peer |
| two-frame low water | per-peer flow-control state | `exact-ported` hysteresis | a paused lane stays closed until the finite prefix is almost drained, preventing start/stop oscillation |
| snapshots skipped while flow-controlled | `broadcastSnapshot` player/observer loops | `exact-ported` | other peers, fixed ticks, input, chat, saves, heartbeat, and control messages remain live |
| global sequence/tick jump after resume | existing frame/reconstructor contract | `verified-already-at-parity`; coverage expanded | first resumed delta names a retained acknowledged baseline and represents current authority without replay |
| client-requested keyframe during flow control | existing recovery owner | `exact-ported` precedence | true reconstruction gap supersedes admission pause and sends one complete keyframe |
| ACK for an actually evicted baseline | existing recovery owner | `verified-already-at-parity` fallback | one warning, one keyframe, finite stale prefix, one completion |
| periodic five-second keyframe | shared snapshot clock | `verified-already-at-parity` | remains a healthy-lane refresh; a paused lane does not receive it until admitted again |
| Hub/Boneyard identity keyframe | frame constructor | `verified-already-at-parity` | world transition remains complete and strict |
| shared Hub, private College, standalone desktop | common `GameHost` | `exact-ported` through shared flow state | no topology-specific exception |
| slow player beside healthy player/observer | per-peer admission | `exact-ported` isolation | healthy lanes keep current cadence and do not inherit the slow peer's backlog |
| connection replacement, disconnect, observed-run end, host close | peer lifetime | `exact-ported` | flow state and retained baselines die with the socket; no timer or reference survives |
| flow-control telemetry | structured game-host journal | `exact-ported` bounded evidence | one warning opens and one info row closes an episode with role, high water, skipped count, duration, and no credential/payload |

No member is blocked by the browser platform. Reliable ordered WebSocket
delivery is the existing supported rail, and the browser already treats
snapshots as authoritative presentation samples rather than simulation steps.

### Ownership thread and recovered behavioral contract

- The host owns authoritative fixed ticks and decides whether a current
  presentation sample is admitted to each peer. The client ACK owns proof that
  one exact frame was completely reconstructed.
- High water is counted from retained baseline entries newer than the current
  acknowledged sequence, not numeric sequence distance. This remains correct
  after one peer skips global broadcasts and later receives a noncontiguous
  current sequence.
- At eight actual unacknowledged frames, ordinary frame projection, JSON
  encoding, compression submission, and socket send stop for that peer. The
  already-sent prefix remains reliable and ordered. At two or fewer, the next
  admitted frame is current authority projected against the retained ACK.
- The true-gap recovery state from the earlier closure remains stronger than
  flow control: an explicit client keyframe request or genuinely evicted ACK
  sends one complete frame and then waits for its exact ACK.
- Flow control never slows fixed ticks or a healthy peer and never drops input,
  save checkpoints, chat, party state, heartbeat, disconnect, or deployment
  messages. It coalesces only replaceable world snapshots.

### Nearby-system findings

- Increasing the 64-frame map would enlarge heap and delay the same failure.
  The live ACK distances clustering exactly at 63..74 validate the earlier
  decision not to enlarge history.
- TCP `bufferedAmount`/kernel send queues are insufficient signals here: the
  network accepted bytes while browser main-thread decode/presentation fell
  behind. Host-visible ACK membership is the causal feedback loop.
- Per-session worker/process isolation would contain an arbitrary future
  synchronous stall but would not stop one slow browser's 3.2-second queue.
  Proactive admission is required regardless of process topology.

### Web implementation consequence

- Add one shared `ReplicationFlowControlState` to player and observer peers.
  Count actual unacknowledged sent baselines, pause at eight, and resume at two.
- Check admission before constructing a peer's frame. Recovery keyframes bypass
  ordinary high water; existing malformed/future/duplicate ACK behavior stays
  strict.
- Emit one `replication.flow_control_started` warning and one
  `replication.flow_control_recovered` info record per episode. Do not add a
  polling timer, disconnect timeout, adaptive authority rate, guessed client
  state, larger baseline history, or protocol compatibility branch.
- Reuse the current snapshot projection for healthy peers sharing one
  world/authority so a slow peer also avoids work before JSON encoding.

### Validation contract

- Player red/green: untouched main exceeds eight unacknowledged frames; the
  candidate stops exactly at eight, logs once, lets a healthy sibling continue,
  resumes only after low water, emits a current noncontiguous sequence against
  the retained ACK, and never opens `baseline_missing`.
- Observer red/green: identical flow control while player count, party state,
  observed run, and healthy player cadence remain unchanged.
- Recovery precedence: a client-requested keyframe during admission pause still
  sends one complete frame, pauses behind it, and resumes only on its exact ACK.
- Existing strict branches: duplicate/older/future ACKs, periodic and world
  keyframes, true evicted-baseline recovery, disconnect/replacement, observer
  target end, and host teardown retain coverage.
- Projection equivalence: cached and uncached snapshot-frame construction are
  deeply equal for Hub/Boneyard keyframes and deltas; shared cache ownership
  never crosses different world states or authority players.
- Mac production-browser receipt: hold one page's main thread, require the host
  to cap its snapshot prefix at eight while a healthy page remains near 20 Hz,
  then require bounded current-state recovery with empty page, console,
  failed-response, disconnect, and host-error arrays.
- Controlled base/candidate Mac receipt records maximum pending snapshots,
  bytes, recovery duration, host ticks, healthy-peer cadence, process memory,
  and flow telemetry at production 20 Hz.
- Run the complete Mac `/opt/homebrew/bin/bash ./scripts/validate.sh` gate on
  the byte-identical final candidate.

### Implementation validation receipt for proactive admission

- Player and observer peers now share one high-water/low-water admission
  state. At eight actual retained baselines newer than the peer ACK, ordinary
  projection and send stop for that peer; at two or fewer, its next frame is
  current authority based on the retained ACK. True keyframe recovery remains
  stronger. One bounded start row and one recovery row record role, duration,
  skipped frames, and no payload or credential.
- One immutable entity projection is now reused for each shared
  state/authority/Hub-activity combination inside a broadcast. The projection
  cache also reuses Hub activity membership and avoids a per-peer serialized
  cache key. Hub/Boneyard keyframe and delta equivalence tests compare cached
  and uncached frames deeply. On the candidate's 256-student, five-peer A/B,
  median frame construction fell from `85.608 ms` uncached to `19.578 ms`
  cached, a `77.1%` reduction within the same candidate process.
- Three alternating base/candidate Mac samples held the healthy sibling at
  `22` frames in the benchmark window. The unacknowledged slow peer fell from
  `22` sent frames on base to the exact cap of `8`; it resumed across a
  current-state sequence gap of `17` without any `baseline_missing` event.
- The physical Mac Chrome stall journey held one renderer task for `1,200 ms`.
  The host opened flow control at eight outstanding frames, the healthy page
  received `21` consecutive snapshots in the measured window, and the stalled
  page resumed on sequences `64,65,66` across an 18-sequence current-state
  jump in the first receipt and a 17-sequence jump in the final clean-commit
  repeat. Page and console errors were empty. The final steady-state receipt
  delivered `101` snapshots and `101` ACKs to each of two pages in `5.002 s`
  (`20.192 Hz`), with zero sequence gaps and about `49.21 KiB/s` estimated
  compressed snapshots per lane.
- Back-to-back unacknowledged world changes exposed one older strictness gap:
  Hub -> Boneyard -> Hub could compare the new Hub only with the older ACKed
  Hub and emit a delta after the client had already seen Boneyard. The host now
  also compares the current world identity with the last sent baseline and
  forces a keyframe on either mismatch. The Tutorial Game Over regression
  asserts that exact Hub keyframe.
- The same exact source passed the canonical Mac gate described in entry 154,
  including `2601/2601` Node tests and the production builds. No protocol or
  save schema changed, and no production push or deployment was performed.
