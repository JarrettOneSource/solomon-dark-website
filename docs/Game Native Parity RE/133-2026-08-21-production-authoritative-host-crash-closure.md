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

## 2026-08-30 — Protocol-109 production crash and durable-state reopening

### Reported smell and parity question

- Reported smell: inspect recent crashes in the live Website database and fix
  every actionable issue. Production was deployed at exact Website SHA
  `ebf693b499aeca417ffe84c9ba0d0a305f55dd2a`, protocol
  `solomon-dark/109`.
- Live behavior: submitted diagnostics recorded two Water painter-membership
  rejections, repeated fractional global-cooldown rejections, repeated legal
  enemy-projectile scale rejections, and four unclean disconnect reports.
  The service journal additionally recorded two process exits at
  `2026-08-30T14:24:01Z` and `14:24:17Z` from
  `death effect presentation owner is unsupported`.
- Required behavior: every native state produced by the authoritative host,
  including a migrated active save, must cross full and compact replication.
  A private session must not disconnect its player or abort the resident
  supervisor because the decoder or descriptor builder rejects legal state.
- Falsifiers: a current all-family death journey producing the owner failure
  would identify a live constructor gap instead of migration; integer-only
  native cooldown countdowns would invalidate fractional wire support; or a
  native projectile class outside the five-member census would invalidate the
  per-kind range correction.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Live production database | NFO `/var/lib/solomon-dark-revived/sdr.db`, `DiagnosticLogs` rows 90 through 97, captured `2026-08-30T04:31:41Z..15:11:31Z` | Protocol 109 rejected Water transients 56/77 without `painterRegistrations`, `globalCooldownTicks` as non-integer, and enemy-projectile `visualScale` outside `[1,1.25]`. Rows 94/95 coincide with the process exits; rows 96/97 instead follow heartbeat loss. | high-live |
| Live process and database health | NFO at `2026-08-30T17:56:02Z`; deployed SHA above | Website active with `NRestarts=0`; game active with `NRestarts=2`; SQLite integrity `ok`; supervisor idle and healthy on protocol 109. | high-live |
| Live journal | `solomon-dark-game.service`, `2026-08-30T14:24:01Z/14:24:17Z` | Both exits are the same descriptor-build exception. The first follows a private Earth/Mind run; systemd restarts the whole supervisor, including the resident Hub. | high-live |
| Current authoritative producers | `air-water-player-visual-system.ts`, `native-secondary-abilities.ts`, `boneyard-enemy-store.ts` at deployed SHA | Water Hail and Cold Aura are appended after the shared enrollment pass; the global counter subtracts the same finite recharge factor as per-skill counters; projectile classes author distinct scale/opacity ranges. | high |
| Current protocol and compact wire | `game-protocol.ts`, `boneyard-enemy-projectile-replication.ts`, `entity-replication.ts` | Full snapshots impose one false `[1,1.25]` projectile range and integer-only global cooldown. Compact projectile samples accept all five legal witnesses. | high |
| Mac red repros | exact detached `ebf693b4`, macOS arm64, Node 22.17.0 | Legal Arrow `5`, Guided Missile `0.9`, and Poison Pool `1.6` fail only full snapshots; Water Hail/Aura allocate zero painter roots; global `148.75` fails while per-skill `831.75` passes; a schema-21 Unbind restores without `presentationOwner` and then throws the exact production exception. | high |
| Mac current-state control | unchanged `smoke:game:boneyard-death-effects` on exact detached `ebf693b4` | Current Skeleton Bouncer/Unbind birth, compact replication, save, reload, and 19 retained effects pass with empty page/wire/response errors. This falsifies a current shared terminal-constructor defect. | high |
| Existing native evidence | entries 091, 101, and 297; retail Beta 0.72.5 SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` | The complete projectile family, concrete death classes/lanes, Focus/equipment recharge factors, and Region manager chronology are already instruction- and data-closed. No new native extraction is needed for these web wire/migration defects. | high |

### Causal model

There are four independent producer/transport defects and one non-defect
disconnect group:

1. `game-protocol.ts` copied the Maggot constructor-scale interval onto every
   enemy projectile. Arrow stores a fading opacity initialized to `5`; Guided
   Missile constructs in `[0.9,1.1]`; Poison Pool grows from `1` through
   `1.6`; Firebolt and Demon Bomb stay at `1`. Compact replication already
   carries those values, so a continuously connected peer can survive while a
   full welcome/resume snapshot rejects the same authoritative actor.
2. `stepPrimarySpells` enrolls its population, then the shared Air/Water pass
   births Hail and, after Boneyard contact, Cold Aura. Neither late constructor
   registers its native actor root. The strict full wire correctly rejects the
   missing arrays.
3. the global secondary cooldown starts at `150` but subtracts the finite
   native recharge factor. Legal equipment transforms include `1.1`, `0.6`,
   and class-specific `1.5`; per-skill cooldowns already retain fractions.
   Integer-only validation of the shared global counter contradicts its
   authoritative producer.
4. enemy terminal ownership landed while save schema 21 was current. The later
   schema-22 migration changes Hub painter topology only; Boneyard saves from
   schemas 1 through 22 can therefore retain death effects without
   `presentationOwner`, and schema-22 re-encoding can perpetuate that omission.
   Current constructors are correct. Restore must migrate the effect before it
   reaches the strict descriptor builder.
5. the 14:24 unclean closes are process-crash consequences. The later 1006
   closes have explicit heartbeat-timeout journal evidence and no paired host
   error; they are not changed by this closure.

### System boundaries and membership inventories

#### Enemy-projectile visual scalar through both wire forms

Native system: all five hostile projectile classes from authoritative birth
and fixed-tick update through full snapshot, compact descriptor/sample,
interpolation, presentation, contact, retirement, reconnect, and teardown.

| Member | Native/web range | Disposition | Proof contract |
| --- | --- | --- | --- |
| Arrow | opacity `(0,5]`, initialized `5`, loses `0.05` after landing | `exact-ported` by per-kind full/compact validation | birth, fading terminal sample, malformed zero/above-five rejection |
| Firebolt | visual scale exactly `1` | `verified-already-at-parity` with strengthened wire | full and compact round trip; non-unit rejection |
| Guided Missile | constructor scale `[0.9,1.1]` | `exact-ported` by per-kind full/compact validation | both endpoints and outside-range rejection |
| Demon Bomb | visual scale exactly `1` | `verified-already-at-parity` with strengthened wire | airborne/settled full and compact round trip |
| Poison Pool | growth interval `[1,1.6]` | `exact-ported` by per-kind full/compact validation | initial, growing, maximum, and outside-range rejection |
| player, observer, welcome, resume, keyframe, delta, baseline recovery | shared snapshot/entity owners | `exact-ported` for the corrected domain | all paths consume the same per-kind predicate |
| projectile effects and Maggot scale | separate entity types and native domains | `out-of-system` | their existing field-specific validators remain unchanged |

#### Primary-spell painter enrollment after staged combat

Native system: primary actor construction and exact Region manager insertion,
including births before and after Boneyard contact, persistence, save/reload,
replication, presentation, and retirement in Hub and Boneyard.

| Member | Owner | Disposition | Proof contract |
| --- | --- | --- | --- |
| ordinary primary projectiles/transients | `stepPrimarySpells` final enrollment | `verified-already-at-parity` | complete contract census remains strict |
| Hurricane | Air/Water synchronization, actor manager | `verified-already-at-parity` | explicit birth registration retained |
| Hail | Water pre-contact birth, actor manager | `exact-ported` at birth | every Hail receives one actor registration before combat/wire |
| Cold Aura | Water post-contact birth, actor manager | `exact-ported` at birth | every Aura receives one actor registration in native birth order |
| Boneyard combat impact/owned transients | combat enrollment and assertion | `verified-already-at-parity` | existing per-kind assertion retained |
| Hub and Boneyard Water paths | shared Air/Water owner | `exact-ported` | both scenes preserve registration and teardown |
| schemas 1 through 22 with missing primary roots | durable migration | `exact-ported` in schema 23 | contract-derived roots allocated once from the persisted manager order |

#### Secondary cooldown countdown and transport

Native system: category-2 cooldown creation and Focus/equipment/Hagatha
recharge through fixed-tick countdown, cast gate, HUD, save, replication, zero
crossing, interruption, and reset.

| Member | Authoritative factor/domain | Disposition | Proof contract |
| --- | --- | --- | --- |
| baseline and Focus | `1` or `2` from authored Focus row 60 | `verified-already-at-parity` | integer controls remain accepted |
| Arcanus set | absolute factor `3` | `verified-already-at-parity` | full global/per-skill countdown |
| Karen amulet | `+10%`, factor `1.1` | `exact-ported` through finite global wire | fractional countdown and zero crossing |
| Robe of Thaumic Unperturbability | `-40%`, factor `0.6` | `exact-ported` through finite global wire | fractional countdown and zero crossing |
| Potter's Apron | class-4 `+50%`, factor `1.5` | `exact-ported` for the affected class | class/global maximum selection and transport |
| Hagatha recharge factor composition | existing player-derived native factor | `verified-already-at-parity` producer; finite wire corrected | composed factor remains authoritative |
| per-skill cooldowns | finite `[0, authored capacity]` | `verified-already-at-parity` | existing finite decoder unchanged |
| global cooldown | finite `[0,150]` | `exact-ported` decoder correction | no rounding; cast remains blocked while positive |
| rejuvenation, instant Focus, owner removal, world reset | explicit zero/reset writers | `verified-already-at-parity` | zero stays exact and no stale cooldown survives |

#### Durable enemy death-effect presentation ownership

Native system: all thirteen concrete terminal classes and Goodie bouncers from
their native direct/queued manager owner through save migration, projection,
compact replication, render, and teardown.

| Member | Owner | Disposition | Proof contract |
| --- | --- | --- | --- |
| Bouncer, SmokyBouncer, Fade, FadeAdditive, FadePerspective, FadePerspectiveClipped, FadeScale, MoveFade | world-sorted actor manager | `verified-already-at-parity` current birth; `exact-ported` legacy migration | actor registration retained or allocated once |
| Unbind | direct post-world | `exact-ported` legacy migration | null actor registration and direct owner restored |
| Imp/Demon SpriteArray and Zombie LateSplat/Demon FireArray | pre-world queue | `exact-ported` legacy migration | null actor registration and pre-world owner restored |
| Demon raw FireBurst glow/frame | direct post-world | `exact-ported` legacy migration | both role variants restore direct ownership |
| enemy store effects | family terminal producers | `verified-already-at-parity` current births | all-family current control remains green |
| Goodie/loot bouncers | loot store world-sorted producer | `verified-already-at-parity` current birth; `exact-ported` legacy migration | one actor registration per effect |
| schemas 1 through 22 | save normalization before state admission | `exact-ported` in schema 23 | every retained effect has one legal owner disposition before baseline creation |
| malformed current schema 23 | strict save/descriptor boundary | `verified-already-at-parity` fail-closed behavior | no descriptor fallback or renderer inference |

No member is `blocked-by-platform`. The strict descriptor and protocol
boundaries remain; the fix changes their accepted domains only where the
authoritative native producer proves the state legal.

### Web implementation consequence and validation contract

- Share one per-kind enemy-projectile visual-domain predicate between full and
  compact materialization; do not clamp authoritative state or broadly relax
  unrelated fields.
- Register Hail and Cold Aura at their actual construction sites with the
  shared world-manager allocator. Keep the later enrollment assertion as a
  fail-fast invariant.
- Decode global cooldown as a nonnegative finite value capped at 150, matching
  the existing per-skill counter and producer. Do not round the countdown.
- Advance save schema to 23. Migrate missing primary painter roots and every
  death-effect owner from its concrete native role; direct/pre-world members
  must discard stale actor registrations, while world-sorted members retain or
  allocate exactly one.
- Advance the exact-match game protocol to 110. Add red/green coverage for all
  projectile classes, all recharge transforms, both late Water births, all
  death-owner lanes, schemas 1/20/21/22, compact/full/reconnect paths, and
  malformed current-state rejection.
- On the exact Mac candidate, run the focused suites and canonical
  `/opt/homebrew/bin/bash ./scripts/validate.sh`. Per-member full/compact tests
  must exercise all five hostile projectile rows. Built Chrome must exercise a
  hostile Arrow, a real Water Aura/Hail cast, current death-effect save/reload,
  and a fractional equipment cooldown with empty page, console, response,
  wire, and host-error arrays.

### Confidence and open questions before implementation

- Confirmed: all four causal paths, their production signatures, current
  deployed health, complete same-owner memberships, and deterministic Mac red
  repros.
- Confirmed non-defect: heartbeat-loss 1006 reports have no paired simulation
  or process failure.
- No material unknown remains and no new native fact is required. The
  implementation and exact-tree validation receipt remain to be appended.

### Implementation validation receipt

- The full and compact enemy-projectile paths now share one class-specific
  scalar predicate: Arrow `(0,5]`, Guided Missile `[0.9,1.1]`, Poison Pool
  `[1,1.6]`, and exact-one Firebolt/Demon Bomb. Compact samples are also
  bounded at the largest authored value before the descriptor-specific check.
  Authority, projection, interpolation, and retirement are unchanged.
- Hail registers its actor root at the pre-contact Water birth and Cold Aura
  registers its actor root at the post-contact birth. Both use the same
  authoritative world-manager allocator as their siblings. The final shared
  Air/Water call now requires that allocator instead of permitting an
  unowned late actor.
- The protocol admits finite global cooldowns through the unchanged
  `[0,150]` capacity, matching the already-finite per-skill lane and native
  producer. Protocol 110 is exact-match. Save schema 23 migrates schemas 1
  through 22, validates current painter membership, restores all direct,
  pre-world, and world-sorted death owners from the complete role/kind census,
  removes stale queue-external registrations, and allocates missing
  world-sorted/primary roots once from the persisted manager order. The
  backend accepts schema 22 as legacy and advertises 23 as current.
- Mac red on untouched `ebf693b4` failed exactly five new assertions: Hail
  registration, Aura registration, compact Arrow-zero rejection, legal full
  Arrow-five acceptance, and schema-22 Water/death ownership. The independent
  global-cooldown producer assertion stayed green and produced `148.9`,
  proving the bug was decoder-only. The five affected final suites passed
  `175/175` after implementation.
- Exact local/Mac changed-file identity before the gate was 15 files with
  aggregate Git-object manifest SHA-256
  `7eeb1330873ef285c27fa3a36305e218a1196004bbd98e951daa6dfcb5e4133e`.
  Mac mini arm64, macOS 26.6.2, Node 22.17.0, npm 10.9.2, .NET 10.0.302,
  and Chrome 151.0.7922.174 ran the complete supported
  `/opt/homebrew/bin/bash ./scripts/validate.sh` in
  `job_20260830T182447Z_6add1dba6f`. Backend build and 28 integration
  contracts passed; pre-Boneyard tests passed `325/325`; the broad Boneyard
  group passed `1,761/1,761`; every remaining frontend/host/desktop group,
  production frontend/GameHost builds, media policy, and bundle budget passed.
  `Game-IzV_Xdq-.js` measured 266,211 raw / 80,889 gzip bytes under
  524,288 / 134,144.
- Built-Chrome fractional proof
  `job_20260830T183025Z_5e718d6e58` ran Raise Golem in a real Boneyard with
  Potter's Apron. The finite recharge path produced row cooldown `2495.5`,
  remained connected for 281 observed ticks, rendered the cooldown HUD and
  Golem, and ended with empty page, console, response, and wire errors. Its
  inspected cooldown frame SHA-256 is
  `d301531a6af84217168d002acce23ee2f22d394ab7f8a26f5914a90437540e08`.
- Built-Chrome Water/Arrow proof
  `job_20260830T183746Z_f3037e90ff` retained a hostile Arrow through Chill
  accumulation/effect retirement, then authored and rendered Hail and Cold
  Aura with distinct authoritative and wire IDs. It observed 1,588 snapshots,
  one projectile sample, both rendered Water kinds, and empty page, console,
  response, and wire errors. The inspected Aura/Hail frame SHA-256 is
  `c2bbb9c96e35cff44f7d32b8ae3e7f72cbb3ddf56341933f85f132c1b3266312`.
- Built-Chrome current death/save proof
  `job_20260830T184033Z_ae1b985a1b` killed a Skeleton, rendered 19 terminal
  Bouncers, saved and reloaded while those actors remained live, reconstructed
  all 19 on a second socket, and reported empty page, response, and wire
  errors. The schema-22 regression separately covers every migrated owner lane
  and verifies the resulting baseline; malformed schema 23 fails during
  restore rather than reaching the process assertion.
- The broad all-waves attempt was not used as evidence: it timed out in an
  unrelated combat driver before Water. The first narrow Water attempt exposed
  a stale smoke-only Arrow object that lacked the current painter field. Its
  task-local correction enabled the successful focused journey and was then
  removed from both worktrees; no product behavior or final tracked file was
  changed for either harness issue.
- No member is browser-blocked and no material unknown remains. Production is
  still deployed at `ebf693b4`, protocol 109; this candidate has not been
  pushed or deployed at the time of this receipt.

## 2026-09-01 - Protocol-115 production crash census

Live NFO evidence from the prior incident cutoff through current deployment
found three protocol-113 process exits from a persisted non-finite enemy
sample, four late secondary-painter disconnects, one legacy Road `linkMask`
disconnect, one stale death-owner checkpoint error, one prepared-mod-host
cleanup consequence, and one protocol-115 enemy-feedback disconnect. Current
main `419699d10457a22897cdb3fdb8bb7938c5141117` is deployed and healthy on
protocol 115 with zero restarts and no failure event since its
`2026-09-01T12:42:01Z` start.

The protocol-113 painter and Road failures are already closed by entries 210
and 265. Current main restored and decoded every retained enemy sample across
all 11 production saves, including 37 live Boneyard enemies; this also
dispositions the older non-finite/death-owner signatures against the current
schema-27 Wraith/Demon/death-owner migrations. The prepared-mod-host error
followed the rejected Road restore and is not an independent current defect.

Two current defects reproduced and remain owned by their system ledgers:
entry 081 owns the decimal-versus-float32 terminal-feedback bound, and entry
249 owns the checkpoint writer that erased pending skill offers plus the one
retained legacy barrier it stranded. Their joint candidate is protocol 116,
save schema 28. Push, deployment, and post-deployment proof remain separate.

The candidate passed the complete Mac gate, the all-production-save
restore/checkpoint/reload census, an optimized Portal terminal journey, and an
optimized pending-picker checkpoint/restore/selection journey. Detailed
receipts and artifact hashes are recorded in entries 081 and 249. The receipt
lines are the only tracked post-gate change; final exact-tree repetition,
publication identity, and cleanup remain required before closure.
