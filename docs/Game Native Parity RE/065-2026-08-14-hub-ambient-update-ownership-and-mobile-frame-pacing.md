# 2026-08-14 — Hub ambient update ownership and mobile frame pacing

## Report and controlled red receipt

- The reported mobile symptom is intermittent `/game` stutter despite long
  stretches at the display's `60 Hz` cap. That points at frame-time variance,
  not merely low average throughput.
- A production-bundle Hub run used Windows Chrome's hardware WebGL renderer
  (`ANGLE`, Radeon RX 9070 XT, Direct3D 11), an `844 x 390` mobile viewport, a
  real `20 Hz` game-host connection, and `6x` CPU throttling to make
  phone-sized main-thread stalls deterministic. Over `15 s` it averaged
  `115.89 FPS` while still reaching a `50.7 ms` frame gap, with `7` gaps over
  `20 ms`, `2` over `34 ms`, and one `53 ms` long task. This reproduces the
  important contradiction in the report: ample average headroom together with
  visible isolated hitches.
- Holding the Hub population at `16` Students did not remove the stalls. That
  run averaged `91.64 FPS` but reached `46.4 ms`, including `4` gaps over
  `34 ms`. The slowest gaps followed `28.4 ms` and `32.1 ms` renderer callbacks;
  one coincided with an approximately `4.97 MiB` JavaScript-heap drop. Student
  creation/reuse counts were stable across those frames, ruling out Student
  lifecycle churn as the owning cause.

## Native ownership and web divergence

- Native `Astronomer` belongs to each Courtyard instance at `+0x9438`.
  `Astronomer::Update` (`0x00505950`) advances its stochastic pulses,
  transition, telescope, assistants, and pose state once per `10 ms` fixed
  Courtyard update. `Astronomer::Render` (`0x0051C790`) and the brown foreground
  pass (`0x0051DBB0`) consume that already-current state. Neither renderer
  reconstructs prior updates.
- Native `PotionGuy::Tick` (`0x0050B110`) likewise advances the inherited actor
  gesture and the separate balloon accumulator; `PotionGuy::Present`
  (`0x0051C1A0`) selects the current registered frames. These are update-owned
  states even though the web keeps their cosmetic RNG deterministic and local.
- The browser inverted that boundary. Every display callback called
  `hubAstronomerFrameAt(localTick)`, which loaded a `512`-tick checkpoint and
  replayed `localTick % 512` native steps before drawing. Each Astronomer step
  constructs a complete state, pulse array, pulse records, and RNG samples.
  Instead of the native one or two fixed updates between display frames, the
  renderer repeatedly performed an average of about `255` historical updates.
- A sampled-allocation profile mapped the dominant minified allocation site
  back to `stepAstronomer`: approximately `115.1 MB` of sampled allocations in
  an `8 s` diagnostic run, over ten times the next site. A CPU profile
  independently placed `stepAstronomer`, Pixi render collection, and garbage
  collection on the slow callbacks. The `512`-tick reset creates a recurring
  roughly `5.12 s` sawtooth, explaining why the game can report high average
  FPS yet hitch periodically.

## Adjacency sweep and implementation consequence

- The same render-time reconstruction pattern exists beside the Astronomer in
  `HubPotionTraderView`: the inherited gesture replays a `512`-tick remainder
  and the balloon animation replays a `398`-tick remainder on every display
  frame. No other Hub checkpoint-replay painter was found in the adjacency
  search.
- Each scene-owned view must instead retain the current deterministic state and
  advance it only to the requested integer tick. Repeated display samples of
  one fixed tick perform no state work; ordinary forward samples perform only
  the elapsed updates. A backward seek or discontinuous reconstruction may
  restore a checkpoint and replay once. The existing random-access functions
  remain pure parity oracles, and sequencer regression coverage must compare
  their output across long runs, repeated fractional samples, jumps, and
  rewinds.
- This changes neither simulation cadence nor authored animation. The host
  remains `100 Hz`, snapshots remain `20 Hz`, and rendering remains display
  paced. The correction restores stock's update/render ownership while
  removing historical work and its garbage from the hot draw path.
- No Mod Loader native-RE document changes are needed: the relevant addresses,
  state fields, formulas, and update/present ownership were already recovered.
  This investigation adds a browser-side ownership diagnosis, not a new native
  fact.

Confidence is high for the causal web path and native ownership. A physical
phone was not attached for this controlled diagnosis, so device-specific
thermal scheduling and browser-process noise remain outside this receipt; the
hardware-browser throttle run isolates the deterministic application hitch the
report exposed.

## Implementation and validation receipt

- `HubAstronomerView` now owns one `HubAstronomerClock`, and
  `HubPotionTraderView` owns one clock for the actor and balloon states. Each
  clock caches its presented frame, returns it unchanged for repeated samples
  of one integer tick, and advances only the elapsed state updates. The pure
  checkpoint reconstructions remain available for deterministic parity checks
  and exceptional seeks, but the display renderer no longer calls them.
- The focused contract was red before those factories existed, then passed all
  `31/31` Hub tests after implementation. It compares clock output with the
  pure native-frame oracle across `1,025` sequential updates, repeat/fractional
  samples, checkpoint boundaries, a jump to tick `8,193`, a rewind to `37`, and
  a second forward jump. Existing roots, banks, telescope selection, actor
  pulse, balloon holds, and drift checks remain green.
- In a post-fix sampled-allocation profile, `stepAstronomer` disappeared from
  the top `40` allocation sites. Before the fix it alone accounted for about
  `115.1 MB` in `8 s`; afterward the largest game-owned site was Student
  interpolation at about `5.57 MB` over `12 s`. CPU sampling likewise no longer
  lists either ambient-history replay; normal Pixi collection/render and Hub
  interpolation are now the leading work.
- A clean `30 s` production-bundle receipt on the same hardware WebGL GPU,
  mobile viewport, real fixed-`16`-Student host, `20 Hz` snapshots, and `6x`
  CPU throttle averaged `143.75 FPS`, held p95/p99 frame gaps to `8.4/10.0 ms`,
  had no gap over `34 ms`, and emitted no long task or page error. A separate
  gated `30 s` run averaged `141.17 FPS`, p99 `13.1 ms`, one `38.5 ms` gap, no
  long tasks, and passed the explicit floor/tail/frequency limits of `60 FPS`,
  p99 at most `20 ms`, and at most two gaps over `34 ms`.
- These receipts improve the fixed-population red result from `91.64 FPS`, p99
  `26.8 ms`, and four gaps over `34 ms` in only `15 s`. They do not claim that
  Windows scheduling has no isolated outlier; they prove the deterministic
  `512`/`398`-tick replay stalls and their allocation sawtooth are absent.

## Adjacent deferred-texture residency finding

- Fresh-browser WebGL instrumentation exposed a second deterministic stall at
  the same page age across otherwise independent runs. Hub images were decoded
  before scene construction, but Pixi uploaded a source to the GPU only when a
  renderable sprite first selected it. Initial transition/assistant/telescope
  banks uploaded with the first Hub frame; stochastic branches reached other
  Astronomer banks several seconds later.
- Exact `texImage2D` receipts under the same `6x` throttle were green idle
  `21.7 ms` at page time `11,598.1 ms`, red gesture `26.7 ms` at `11,620.1 ms`,
  and green gesture `36.0 ms` at `15,357.0 ms`. The last upload occurred inside
  the `39.5 ms` renderer callback immediately preceding a `46.9 ms` frame gap at
  `15,401.2 ms`. Teacher burst art was another deferred source, though its
  largest observed upload was only `4.9 ms` at `19,681.7 ms`.
- Loaded CPU image state is therefore not sufficient readiness for a live
  animated scene. The Hub loading boundary must upload every
  Astronomer bank and Teacher burst source before publishing the renderer.
  This set is bounded to art that the already-live ambient actors can select;
  pre-uploading every element's large player robes would waste substantial
  mobile GPU memory and is not part of the correction.
- This adds no new stock mechanic or asset fact. It restores lifecycle parity:
  native registered art is resident before its painter selects a record, while
  display-time presentation remains a consumer rather than an upload owner.
- Hub renderer construction now initializes the twelve distinct source textures
  used by dormant Astronomer and Teacher-burst branches before publishing the
  canvas. It uses Pixi's immediate texture-system initialization because this
  renderer deliberately starts with its ticker stopped; the ticker-scheduled
  prepare queue cannot own this loading boundary. The selection remains narrow
  and does not make unused player-element robes resident.
- In a fresh browser, the filtered WebGL receipt placed all eight Astronomer
  sources and the Teacher burst sheet between page times `7,076.6` and
  `7,107.1 ms`, during Hub construction. None reappeared during the following
  `20 s` sample; the former `11.6 s` and `15.4 s` first-use uploads were gone.
- The final clean `30 s` production-bundle gate used the same hardware WebGL
  renderer, `844 x 390` mobile viewport, fixed `16` Students, real `20 Hz`
  host, and `6x` CPU throttle. It averaged `134.93 FPS`, with p95/p99 gaps of
  `11.9/15.2 ms`, a `31.0 ms` maximum, zero gaps over `34 ms`, zero long tasks,
  no tick rewind, stable Student ownership, and no browser error. It passed the
  explicit `60 FPS` floor, `20 ms` p99 ceiling, `40 ms` absolute ceiling, and
  zero-multiframe-stall threshold.

## 2026-09-02 reopening - shared-Hub age replay during late join

### Reported smell and controlled production reproduction

- Reported behavior: a shared Hub which remains live becomes slow to join and
  initially laggy. Restarting the Hub removes the delay.
- The production host was healthy at tick `1,441,232`, approximately four
  hours of `100 Hz` authority. Direct health sampling remained fast across
  `240` requests: median `0.578 ms`, p95 `1.315 ms`, and maximum `2.980 ms`.
  The process had no tick-lag event, failed tick, crash, socket imbalance, or
  replication-recovery backlog during the reproduction.
- A raw public admission completed the API request in `284.95 ms`, WebSocket
  open in `155.46 ms`, `client-hello` to `server-welcome` in `46.96 ms`, and
  welcome to the first snapshot in `25.16 ms`. The welcome was only `24,757`
  bytes. This falsifies the host, proxy, snapshot size, and transport as the
  owner of the visible pause.
- Two isolated production-browser journeys reproduced `18.19 s` and `20.05 s`
  from discipline confirmation to a ready Hub. The deep trace initiated zero
  network resources and zero audio decodes during that window. It recorded
  `36` main-thread long tasks totaling `11.672 s`, including one `7.364 s`
  block; JavaScript heap grew from `18.2 MB` to `107.3 MB` and peaked at
  `131.8 MB`.
- A sampled renderer CPU profile placed approximately `5.2 s` of self time in
  the Hub stochastic-state checkpoint expansion bundled in the production
  `native-world-speech` chunk. The hot `Hagatha` state function grows its
  checkpoint array to `floor(absoluteTick / 512)` and executes every omitted
  `stepHagatha` update. Static inspection found the same absolute-tick cold
  path in the common traders, Office polisher, and both PotionGuy clocks.

This is a second report in the system covered by this ledger entry. The 2026-08-14
pass correctly moved Astronomer and PotionGuy hot-frame work into retained
clocks, but it did not make the clock epoch part of the factory contract. The
Astronomer view later supplied a local Courtyard epoch externally; PotionGuy
continued to receive the absolute shared-Hub tick. Hagatha, Luthacus, Shlorio,
and the Office polisher were subsequently added with the same omitted epoch.
The earlier adjacency inventory was therefore incomplete.

### Reopened system boundary and membership

| Member | Current ownership finding | Disposition |
| --- | --- | --- |
| Astronomer crew, telescope, poses, and pulses | already subtracts Courtyard construction tick at its view call site, but the factory accepts an unsafe absolute tick | `exact-ported`: clock owns a required scene epoch |
| Hagatha body and cross-fade particle field | cold clock reconstructs every update from shared-Hub tick zero | `exact-ported`: clock advances only elapsed scene ticks |
| Luthacus and Shlorio inherited idle gestures | per-seed checkpoint maps expand to the absolute shared-Hub tick | `exact-ported`: both clocks own the same scene epoch |
| PotionGuy inherited gesture | global checkpoint array expands to the absolute shared-Hub tick | `exact-ported`: clock advances only elapsed scene ticks |
| PotionGuy balloon frame, endpoint holds, and drift | global checkpoint array and drift consume the absolute shared-Hub tick | `exact-ported`: both consume the same elapsed scene tick |
| Story Office polisher | per-seed checkpoint map expands on first Office presentation | `exact-ported`: private-room clock owns the renderer epoch |
| Empty shared Hub world | kept stepping for the process lifetime even with no resident actor | `exact-ported`: reconstruct once at tick zero and hold until admission; parties, active runs, and Memorial remain separate owners |
| Departed-player social reference | retained in a process-lifetime map after ordinary disconnect | `exact-ported`: delete on final membership release and recovery-lineage retirement |
| Teacher, fountain, seals, statue, Students, and Skorcha | bounded while occupied and replaced together at the empty-world lifecycle edge | `exact-ported` through the shared reset boundary |
| Pure random-access frame functions | test-only parity oracles and exceptional local seeks | `verified-already-at-parity`; retained outside the production late-join path |
| Hub/player texture catalog construction | fixed per-renderer cost which does not grow with Hub tick or uptime | `out-of-system`; no evidence supports changing asset membership in this closure |
| Occupied Hub, active Boneyards, parties, and Memorial | independent authoritative owners | `verified-already-at-parity`; never reset by an age threshold |
| GameHost process, WebSocket proxy, snapshots, and protocol | healthy and outside the reproduced long task | `verified-already-at-parity` |

No member is blocked by the browser platform.

### Corrected ownership contract and implementation consequence

- Every retained client-only stochastic Hub clock owns the absolute tick at
  which its renderer was constructed. Its public `advanceTo` input remains an
  authoritative snapshot tick, but the clock converts that value to
  nonnegative elapsed scene ticks before stepping or seeking.
- Clock factories require the epoch argument. An omitted epoch is a type error,
  preventing a later view from silently restoring absolute-uptime replay.
- Courtyard and private-room views share the initial Hub snapshot tick. Actors
  therefore retain their native scene-construction phase relationships while
  independent late joiners do no work proportional to server uptime.
- The process-wide shared host remains resident. Its Hub world is live only
  while at least one actor resides there. The first fixed step after the last
  resident leaves reconstructs a fresh empty Hub, preserves the ten-slot
  Memorial, leaves parties and active Boneyards untouched, and then holds the
  empty Hub at tick zero until the next admission.
- No arbitrary age threshold may reset an occupied Hub. The scene-epoch rule
  removes late-join age cost without interrupting players; the empty boundary
  resets Students, ambient actors, runtime grids, painter counters, and Hub RNG
  only when those transient owners have no consumer.
- The pure parity oracles, authored constants, RNG order, fixed update cadence,
  frames, particles, painter order, texture residency, `100 Hz` host, and
  `20 Hz` snapshots are unchanged while the Hub is occupied.

### Regression and validation contract

- At an initial snapshot tick of `1,500,000`, every affected late-join clock
  must match a fresh tick-zero clock at elapsed offsets `0`, `1`, `37`, `512`,
  and `1,025`. This covers Astronomer, Hagatha, both common-trader seeds,
  PotionGuy actor/balloon/drift, and the Office polisher.
- Existing sequential, repeated fractional, checkpoint-boundary, forward-jump,
  and rewind parity comparisons remain required with explicit epoch zero.
- Shared-world coverage must age an occupied Hub, move its last resident into
  an active Boneyard, then prove that the Hub resets once and remains at tick
  zero while the run advances. Memorial and party identity must survive, and a
  new Hub resident must begin advancing from zero.
- The exact candidate requires the complete Mac Website gate and a built Mac
  Chrome production journey against an artificially aged shared Hub. The
  browser receipt must show bounded discipline-to-ready time, no absolute-tick
  checkpoint expansion in the CPU profile, no long task attributable to these
  clocks, and empty page/console/network/host-error arrays.

Implementation in this source change is complete; validation, publication, and
deployment are separate receipts below.
