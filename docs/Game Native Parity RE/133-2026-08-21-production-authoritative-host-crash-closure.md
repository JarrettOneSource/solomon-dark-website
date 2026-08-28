# 2026-08-21 — Production authoritative-host crash closure

## Reported smell and parity question

- Reported smell: inspect the live server logs and fix every confirmed Solomon
  Dark problem. NFO production was deployed at exact Website SHA
  `0c49646702ad13ce72fef755fe4a3d7826c13cc4`, protocol
  `solomon-dark/49`.
- Live behavior: `solomon-dark-game.service` exited six times between
  `2026-08-21T19:53:41-04:00` and `2026-08-21T21:11:31-04:00`. The failures
  were one Fireball direct/splash invariant, three player movement-scale
  invariants, and two Skeleton-family head-facing invariants. Systemd restored
  the process after five seconds each time, but every exit disconnected the
  shared game world.
- Stock behavior to preserve: legal independent spell ranks never abort the
  world; positive native movement bonuses apply through the shared player
  movement lane in every ordinary scene; and the Skeleton/Mage head selector
  exists only for its action owner and is gone at death handoff.
- Falsifiers: a native instruction branch that traps or wraps nonpositive
  Fireball direct damage; a scene-specific native movement path that excludes
  Rush/equipment in Hub; or a native death frame that retains a nonzero
  `actor+0x224` selector would disprove the respective model. None was found.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Live production | NFO `journalctl -u solomon-dark-game.service`, deployed SHA `0c496467`, Node `22.17.0` | `simulation.tick_failed` and `process.uncaught_exception` paired for `Fireball explosion damage exceeds base damage` once, `player movement scale must be within [0, 1]` three times, and `Boneyard enemy head-facing offset requires an active Skeleton or Mage` twice | high |
| Live health | NFO systemd/curl at `2026-08-21T21:08:01-04:00` | Website, game, and Caddy were active; public root returned 200; supervisor health returned protocol 49 with one live session/player. No restart was authorized or performed. | high |
| Instructions | pinned retail `SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; `PlayerActor::Tick 0x00548B00`, `PlayerActor_MoveStep 0x00525800`, refresh `0x00661530/0x00661FD0` | The common player lane consumes refreshed movement scalar `+0x90`; Rush multiplies it above one, including concentration. The same PlayerActor tick owns clean Hub movement. | high |
| Instructions | Skeleton tick `0x00484B90`, Mage tick `0x00490860`, renderers `0x0048DEE0/0x00491720` | Signed `actor+0x224` belongs only to an active Skeleton/Mage action. The common tick resets it when the action owner is absent; death removes the articulated owner. | high |
| Fresh instructions | read-only Ghidra replica of the pinned executable; Fire handler `0x0053DC60`, `Fireball_Impact 0x005E5160` | Impact computes `direct=+0x150`; subtracts positive Explode `+0x154`; dispatches only when the result is strictly positive. Retirement, impact presentation, and the later radius-gated detonation remain outside that guard. | high |
| Static authored data | complete rows 16, 18, and 67 in `native-skill-catalog.json`; complete native equipment-effects catalog | Legal independent ranks include Fireball damage below Explode damage. Rush values are `0,10,20,25,30,35,40,45,50` percent, concentration is another 25 percent, and `Karen You Scandalous Wench` supplies the sole authored walk-speed equipment multiplier, 1.5. | high |
| Pre-fix web | `player-character.ts`, `hub-world.ts`, `hub-prediction.ts`, `primary-spell-fire-effects.ts`, `boneyard-spell-combat.ts`, `boneyard-enemy-store.ts`, `boneyard-enemy-replication.ts` | The planner rejected every scale above one; Hub authority/prediction hard-coded one; Fireball threw below zero; lethal enemy transition retained the action-only head selector until the next enemy tick, while snapshot creation occurred immediately. | high |

## Reopened system A — player movement multiplier composition and transport

Native system: the shared ordinary-player movement multiplier seam, from
refreshed passive/equipment/status scalars through authoritative fixed-tick
planning, scene collision, replicated local prediction, and teardown. Skill
and equipment rank generation is included where it writes this seam; unrelated
combat consequences of those skills are outside it.

| Member | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| Baseline scale one | `PlayerActor::Tick 0x00548B00` | verified-already-at-parity | ordinary Hub/Boneyard recurrence tests |
| Rush ranks 0..8 (`0,10,20,25,30,35,40,45,50` percent) | row 67, refresh `0x00661530` | exact-ported | full authored row and derived-stat tests |
| Concentrated Rush factor 1.25 | `0x00661FD0`, progression `+0x90` | exact-ported | concentration and combined-factor regression |
| Walk-speed equipment factor 1.5 | complete equipment catalog, kind 17 | exact-ported | sole authored consumer and maximum-composition regression |
| Cold/dazzle/lock scalar inputs | player combat component and encounter lock | verified-already-at-parity for composition into this seam | zero, fractional, and combined planner coverage; status creation/timing remains owned by its separate modifier system |
| Boneyard ordinary authority | `PlayerActor::Tick -> MoveStep` | exact-ported | boosted, slowed, and zero-locked world tests |
| Hub/Courtyard/private-room ordinary authority | same persistent PlayerActor path | exact-ported | per-player Hub movement-scale input and scene tests |
| Hub local prediction/reconciliation | multiplayer presentation of the same authoritative lane | exact-ported | protocol-50 scale plus predictor/server differential |
| Scripted room transition | authored transition target/speed | out-of-system — scripted motion replaces ordinary input and keeps its authored speed | transition regression |
| Nonfinite or negative scalar | no authored producer | out-of-system — rejected at the cohesive planner boundary | validation regression |

Recovered contract: the ordinary planner accepts every finite non-negative
factor. The factor multiplies input acceleration and the native movement-lane
cap; zero is a real lock and values above one are native speed bonuses, not
invalid input. The maximum currently authored positive composition is
`1.5 Rush * 1.25 concentration * 1.5 equipment = 2.8125` before target-owned
slow effects. Hub and Boneyard consume the same player-owned scalar. A scripted
portal transition continues to use its own fixed speed.

Web consequence: remove the refuted upper bound, carry the player-owned scalar
into Hub authority, replicate it for the local predictor, and bump the
incompatible protocol to 50. The server remains authoritative; the new field
exists only so browser prediction runs the same already-authoritative kernel.

Validation contract: cover zero, fractional, one, Rush, concentrated Rush,
equipment, their 2.8125 maximum composition, Hub authority, Boneyard authority,
scripted-transition exclusion, protocol rejection of negative/nonfinite data,
and exact local predictor/server agreement.

## Reopened system B — pure Fireball contact partition

Native system: pure row-16 Fireball impact ownership from cast-time payload
capture through direct contact, row-18 detonation, secondary Fire payloads,
impact presentation, and projectile retirement.

The complete consumed authored rows are Fireball damage ranks 0..25:
`0,4,7,10,14,18,22,26,30,35,40,45,50,60,70,80,90,100,110,125,150,175,200,225,250,300`;
Explode damage ranks 0..11:
`0,5,9,12,15,18,20,22,24,26,28,30`; and Explode radius ranks 0..11:
`0,10,11,12,13,14,15,16,17,18,19,20`.

| Member | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| Positive direct remainder | `0x005E5160`, `+0x150/+0x154` | verified-already-at-parity | 30 minus 12 equals 18 |
| Zero or negative direct remainder | same strict-positive branch | exact-ported | equal and greater Explode regressions skip direct contact without throwing |
| Direct target Burn/contact riders | same target dispatch | exact-ported | emitted only when the strict-positive direct dispatch occurs |
| Explode radius damage and Burn | later `+0x158` branch / `0x00642BF0` | verified-already-at-parity | detonation continues when direct is zero |
| Impact art/audio/light and retirement | Fireball impact callback | verified-already-at-parity | stable impact transient and consumed projectile |
| Embers, Embers-to-Imps, Immolate | row-17/19/20 payloads downstream of impact | verified-already-at-parity | existing full-family tests plus zero-direct lifecycle assertion |
| Underpowered Fireball | `0x0053DC60` weak branch zeros secondary payloads | verified-already-at-parity | no Explode subtraction in weak lane |
| Terrain-only impact | tick `0x005FDD90` | verified-already-at-parity | no actor direct contact, impact still retires |
| FireMissile and Meteor welded classes | distinct handlers/contact owners | out-of-system — they share payload fields, not this pure-Fireball subtraction | call-site census; `nativeFireDirectDamage` has one web consumer |

Recovered contract: `max(0, fireballDamage - positiveExplodeDamage)` is the
direct amount, but the zero result means “do not dispatch direct contact,” not
“deal zero damage” and not “abort impact.” Detonation and retirement remain
independent. No browser approximation or blocked member exists.

Web consequence: make the kernel return zero for the legal edge, gate only the
direct damage/Burn/hit event on strict positivity, and always continue the
impact/detonation path.

Validation contract: assert below/equal/above partitions, one direct Burn only
for positive direct contact, detonation/Burn/Ember continuation at zero direct,
projectile retirement, and unchanged RNG/light registration ordering.

## Reopened system C — Skeleton-family head-facing action lifetime

Native system: the signed Skeleton/Mage upper-component selector from fixed
tick writer through every action exit, death handoff, replication, renderer,
and teardown. This reopens the 2026-08-20 head-facing ledger because its web
implementation covered ordinary completion/reset but missed same-tick lethal
handoff before snapshot creation.

| Member | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| Skeleton attack selector | `0x00484B90`, `+0x224` | verified-already-at-parity | `-1/0/+1` RNG/action tests |
| Skeleton Mage cast selector | `0x00490860 -> 0x00484B90` | verified-already-at-parity | inherited writer/cast tests |
| Archer static zero | `0x00485200` | verified-already-at-parity | no RNG consumption or nonzero sample |
| Ordinary action completion/lost target | native missing-action reset | verified-already-at-parity | finalizer/reset tests |
| Disrupt/flee interruption | missing-action reset | verified-already-at-parity | explicit interruption clearing |
| Same-tick lethal Skeleton handoff | death removes action owner | exact-ported | lethal transition clears before immediate snapshot encoding |
| Same-tick lethal Mage handoff | inherited death lifecycle | exact-ported | lethal transition clears before immediate snapshot encoding |
| Protocol encoder/decoder invariant | only active Skeleton/Mage accepts nonzero selector | verified-already-at-parity | strict invariant remains; no sampler-side normalization |
| Run/world teardown | actor retirement | verified-already-at-parity | no retained selector after actor removal |
| Imp, Zombie, Wraith, Demon, Coffin, Maggot | distinct articulation/no upper-facing lane | out-of-system | complete enemy-family census in the 2026-08-20 entry |

Recovered contract: the action-only selector must be cleared atomically with
the transition that destroys its owner. Snapshot serialization remains a
strict assertion boundary; silently forcing zero there would hide another
upstream lifecycle defect. No browser approximation or blocked member exists.

Web consequence: clear `headFacingOffset` in the authoritative lethal actor
transition shared by Skeleton and Mage, while leaving the protocol invariant
and renderer read-only.

Validation contract: force a nonzero Skeleton and Mage selector, kill each
between enemy stepping and snapshot projection, assert immediate zero and a
valid replicated sample, and retain all ordinary reset/RNG/family assertions.

## Nearby server-log findings

- Ninety-five `replication.baseline_missing` warnings occurred across five
  clients. Each acknowledgement trailed the last sent sequence by roughly one
  retained-history window. The host already sets `forceReplicationKeyframe`
  and the clients recovered; no paired process error or disconnect reason
  implicated this path. It remains a useful severe-client-stall diagnostic,
  not one of the crash causes.
- Proxy close warnings and player disconnect warnings clustered around the
  six process exits or ordinary client closes. They are consequences, not
  additional root causes.
- The required Mac browser smoke exposed a stale acceptance assumption rather
  than a renderer defect: it demanded two telescope frames inside a fixed
  24-by-50-ms sample. The recovered Astronomer clock legitimately holds frame
  0 for ticks `0..380` and later endpoint frames for more than 300 ticks. The
  smoke now preserves the assertion but waits up to five seconds for the next
  native frame edge, while its fixed window continues to prove display-rate
  player motion and an unculled Astronomer root.
- The same smoke also retained a pre-name-parity assumption: helper clients
  left Create's stock-random draft untouched but asserted the former fixed
  `Helvidius` identity. The helper now fills `Helvidius` explicitly before
  committing its element/discipline, so the roster check proves replicated
  identity instead of depending on the Create RNG seed.
- Randomized mode-1/2 integrated runs exercised the environment-light pixel
  probe and exposed two stale harness assumptions. It scaled diagnostics
  against fixed `1600x900` instead of the renderer's published responsive
  viewport, and it allowed only one player's `7..11` backing-pixel alpha even
  when two participants overlapped at the Boneyard spawn. The probe now reads
  `data-viewport-width/height` and multiplies the unchanged per-player alpha
  interval by the exact same-root player count. White RGB, transparent
  far-corner, and plus-lighter assertions remain unchanged; the observed
  two-player center was alpha 17 / RGB 765 with a zero far sample.
- `minecraft-events-worker.service` was the host's only failed systemd unit,
  but it is a separate Minecraft service outside the Solomon Dark Website and
  this system boundary; it was not modified.

## Implementation validation receipt

- Website implementation removes the planner's false upper bound, threads the
  player-owned multiplier through Hub authority and protocol-50 prediction,
  skips only nonpositive Fireball direct contact while retaining detonation,
  and clears Skeleton/Mage head-facing at the lethal owner transition. The
  strict protocol assertions remain intact. The browser smoke additionally
  replaces four stale acceptance assumptions—telescope timing, random Create
  name, fixed viewport size, and single-player light alpha—without changing
  gameplay.
- The first canonical red run passed all pre-existing checks and failed exactly
  three new regressions: boosted movement, low-base/high-Explode contact, and
  lethal head-facing handoff. The completed WSL gate then passed 15 backend
  contracts, 4 library/mod tests, 43 loot tests, 226 prerequisite tests, 1,262
  broad game tests, 25 party/chat tests, 11 level-up tests, 7 diagnostics tests,
  17 Hall tests, 16 Hub UI tests, 5 desktop tests, production build, media
  policy, and bundle budget. `Game-D-Vdgf4y.js` is 384,398 raw / 108,146 gzip
  bytes. One heartbeat test returned abnormal close 1006 in the first loaded
  rerun, then passed in the complete rerun and on Mac; it did not reproduce as
  a product fault.
- Mac mini arm64/macOS 26.4.1 used Node 22.17.0, npm 10.9.2, .NET 10.0.302,
  and Chrome 151.0.7922.170. Its isolated Website worktree started at exact
  current `origin/main` `8cdad497b95c8ab131d241353c23ae30bb348834` and
  passed the same canonical gate and bundle budget. Real built-site Chrome
  journeys used a task-owned protocol-50 host and three clients across Hub and
  Boneyard. Both mode 0 and mode 1 completed; mode 1 exercised the corrected
  two-player environment-light probe. Each reported WebGL2 at resolution one,
  24 distinct local movement samples, all five walk poses, 13 Students,
  telescope frames `0,1`, gate crossing, and empty page/console error arrays
  for desktop and mobile. The host emitted no `simulation.tick_failed` or
  uncaught exception across the repeated runs.
- Mac evidence under
  `.codex-evidence/server-log-crash-20260821-v2-light/`: `boneyard.png`
  SHA-256 `0e32ca0e2edfae7a603f5b3ded7312e26f02ead08b312941c25585143e635f1e`,
  `boneyard-gate-open.png`
  `b6ea1e27cb4e79f380d0bdc63a531b1ce08521c165aeca3b74a9f6b6885c2423`,
  desktop ally `ab99aa7e90e7b2a8d8ace8f0de91c04860482dfa53569cc229c4ca57b617b835`,
  and mobile ally `677fccc0c4784bc42d3d99b68327f2eac82b04d713a116c70a29da26de4a3c34`.
  Every task-owned loopback listener and process was stopped after capture.
- Native durable evidence is also updated in Mod Loader
  `docs/reverse-engineering/native-skills-and-spells.md` with the full
  Fireball/Explode authored rows and `0x005E5160` strict-positive branch.
  There are no `blocked-by-platform` members or remaining unknowns in these
  three closures.
- Publication/deployment state: isolated Website and Mod Loader worktrees only;
  no commit, push, production copy, service restart, or session interruption.
  External deployment workers independently advanced production first to
  `c9600ce1` and then to `8cdad497` at `2026-08-21T21:54:05-04:00`; both
  Website/game units are active with zero restarts since that start, and final
  health is idle on protocol 49. That revision does not contain this
  uncommitted protocol-50 fix. A separately authorized publication and
  deployment is still required before the live service has the closure proven
  here.
