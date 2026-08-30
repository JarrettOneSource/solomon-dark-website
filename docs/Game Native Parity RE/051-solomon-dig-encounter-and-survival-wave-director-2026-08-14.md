# Solomon Dig encounter and survival wave director — 2026-08-14

Reported web gap: the default Boneyard materializes an endlessly digging
Solomon, never reacts when a player reaches him, and has no authoritative
enemy-wave lifecycle. The stock behavior is one encounter chain: proximity
locks the found player, one Solomon hello plays, Solomon retreats and trips
the run trigger, and only then does the Arena-owned survival schedule begin
creating enemies. The existing web renderer's perpetual dig loop is therefore
a missing simulation owner, not an animation-timing defect.

## Native ownership trace

| Evidence | Source | Finding | Confidence |
| --- | --- | --- | --- |
| Fresh static actor trace | Retail `SolomonDark.exe` 0.72.5, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; constructors/dispatch at `0x00481C20`, `0x0048A8B0`, and state bodies `0x00481FC0`, `0x0047D0F0`, `0x0047D450`, `0x0047D570`, `0x004857B0` | The Arena actor owns a five-state dig/contact/dialogue/retreat/escape lifecycle. The browser must synchronize that state; a component-local timer cannot own the transition. | high |
| First-contact instructions | `0x00481FC0` | The ordinary scan is armed only while the animation cursor is strictly beyond `programLength - 10`. Closest same-Arena player then qualifies under the strict ellipse `((sx-px)/1.5)^2 + ((sy-10-py)/1.25)^2 < 10000`, fires FIND SOLOMON for local slot zero, and has movement/casting disabled. Contact frames `<6`, `6..15`, and `>=16` seed heading/vertical offset `(180,15)`, `(225,6)`, and `(270,0)` respectively. | high |
| Voice queue trace and stock PCM | state 1/2 bodies plus `SAY_SOLOMON_HELLO1..4.wav` | Survival chooses one of four exact cues. State 2 waits for the global dialogue owner and queue to empty, then restores controls. PCM durations are 7.826508, 5.695306, 5.539342, and 7.343220 seconds. | high |
| Retreat trace | `0x0047D570`, `0x004857B0` | After dialogue, a 25-tick hold precedes reverse/clamped heading, acceleration from -7 by +0.5/tick, laugh and `GETHIMBOYS`, then the positive-motion boundary samples a signed 15-degree deflection and fires SOLOMON RUNS. State 4 uses a clipped 4096-unit escape path, speed 2 increasing by 0.05/tick, a repeating `-3/+0.25/-2` vertical hop, and movement before retirement on lifetime tick 515. | high |
| Facing and mouth instruction trace | `0x0047D0F0`, `0x0047D450`, turn helper `0x00410D60` | Facing applies `trunc(turnRate) + 1` shortest-path one-degree turns, raises turn rate by 0.5 to 10, and continues tracking during speech. The helper's cyclic zero band and state's raw `abs <= 1` completion check differ, and exact 360 survives normalization, preserving the native rare 359/0 stall. The emergence offset decays by 0.9 per state-1/state-2 tick. Active speech changes to a different mouth pose 0..2 after 25 initial ticks and then `40 + 2 * RandomInt(25)` ticks. | high |
| Solomon render dispatch | `0x004A2610`, render bodies `0x004902C0`, `0x00490420`, `0x00490640`, `0x00490790`; clip owner `0x00420EC0`; asset builder `0x004ED980` | Survival uses dig records 2..19, six-by-fifteen walk records 95..184, dialogue body records 213..227, and three-by-fifteen mouth records 228..272. Direction is `trunc((heading + 12) / 24) % 15`; dig/dialogue draw DeadHawg shadow record 13 at `(-10,-113)`. States 1/2 and the state-3 hold clip body/mouth to the fixed 2000-by-1000 rectangle ending at grave-ground Y; accelerating state 3 retains it only while acceleration is negative. | high |
| Serialized schedule oracle | stock-generated `random seed.boneyard`, 266811 bytes, SHA-256 `dda683d9f9e34649b3a510b2790650fc99103e51316d4b95eb6593fe98d7d448` | The generator compiled one 594-event `Main Time line`: 394 spawn, 14 spawn-locating, 87 pause, 43 advance, 42 labels, and 14 jumps, plus 30 triggers/scripts and 15 monster recipes. | high |
| Retail schedule source | `data/wave.txt`, 29147 bytes, SHA-256 `363a985d79dc3ca28fb5ce519f56c436f5269a9bea1bedc7d1a825e8139499fc`; parser at `0x00632730` and generator at `0x006388B0` | Default survival has 42 records, signed relative NEXT edges, 918 spawn-budget units, 205 groups, eight enemy types, and seeded delay/group selection. Negative NEXT is valid. | high |
| TimeLine/Spawner trace | event activation `0x0046C9A0`, Spawner tick `0x0046D000`, TimeLine tick `0x0046E390`, Region tick `0x0063EFC0` | Due events activate in sorted graph order. Spawners exhaust compiled budgets without a global live-count cap. Pause modes observe authoritative live-monster/boss state, and mode 6 also reads Arena's low-population timer at `+0x88`; presentation time cannot satisfy them. | high |
| Arena director trace | `0x00465C00`, `0x00465D70`, `0x004625F0` | Wave start owns combat-active state, counters, trigger dispatch, and music. Advancement observes live enemies, Spawners, boss state, and wait mode; it has no living-human prerequisite. | high |
| HUD adjacency sweep | native HUD routines and prior live wave-counter mutation | Stock draws no wave number, score, or enemy-remaining badge. The web port must not invent one. | high |
| Current web owner trace | `core-server/boneyard-world.ts`, `host/game-snapshot.ts`, `protocol/game-state.ts`, `renderer/boneyard-world-renderer.ts`, `BoneyardScene.tsx` at base `999786e` | Host state contains gates only. Snapshots contain gates/run id only. The renderer advances Solomon Dig from global tick and has no enemy views or semantic audio event. | high |

The exact actor and wave evidence is preserved durably in the sibling Mod
Loader note
`docs/reverse-engineering/native-solomon-dig-and-wave-director.md`.

## Recovered encounter contract

- The fixed 100 Hz authoritative Boneyard world owns Solomon phase, position,
  heading, phase countdown, selected target, and cue-event sequence. The
  loaded scene remains immutable authored geometry.
- Before contact Solomon remains in the exact existing 29-entry dig program,
  advancing every five ticks. Proximity is ignored until its fractional cursor
  moves strictly into the final ten slots. Contact is evaluated after
  authoritative player movement using the strict native ellipse and
  closest-player rule; the active dig frame seeds the recovered heading and
  emergence-offset branch.
- Only the acquired player is input-locked. The host ignores that player's
  movement/cast plan while voice is active; it does not overwrite the browser
  input device state or lock unrelated peers.
- Cue selection is seeded and authoritative. A monotonically identified cue
  event is latched into snapshots. Each client consumes an event id once; a
  joining client observes the current state without replaying historical
  speech.
- Exact PCM duration is the deterministic web substitute for the native
  global voice-queue drain. The transition tick uses the duration rounded up
  to fixed ticks, so it cannot precede the end of the source sample.
- The 25-tick retreat hold and acceleration sequence belong to simulation.
  SOLOMON RUNS is emitted only at the recovered positive-motion boundary.
  That boundary consumes one seeded sign and deflects the clamped escape
  heading by exactly 15 degrees before state 4. The wave director starts from
  that event, not from visual off-screen status.
- Facing, mouth pose/countdown, vertical motion, and six-pose walk cycle are
  authoritative encounter fields. The browser interpolates continuous actor
  position/motion but keeps phase, body bank, mouth pose, and cue identity
  discrete.
- State 1/2 preserves exact 360 and the stock raw post-turn comparison at the
  359/0 boundary. The contact emergence offset decays by 0.9 per tick. Body
  and mouth render against the fixed grave-ground clip through dialogue and
  the hold; accelerating retreat keeps that clip only while rising.
- State 4 resets vertical acceleration to `-3`, adds `0.25` per tick, clamps a
  positive render offset to zero, and resets acceleration to `-2` for the next
  hop. Its final lifetime tick still moves and advances speed/gait/hop before
  the actor becomes gone.
- The checked-in encounter sheet is a lossless registration-preserving
  extraction from `Solomon.png` SHA-256
  `057a3661340a3a099cf88c491d88c4268d82b8bb48ab29d214961ce701140126`
  and `Solomon.bundle` SHA-256
  `a4d85b56f79486361a4ae18a6b4bc2bc1c0e28ba1a57f96ef68cc64e09e9cafa`.
  Its 15-by-10 grid SHA-256 is
  `0db33945b1acf6e86832f942ad82679c1bc15e7ddd4fc7a633cd5d7b08d6e0ab`;
  every logical cell retains the stock 200-by-200 registration and bundle
  origin.
- Lantern and grave dirt remain at their authored set-piece positions. The
  moving Solomon actor leaves the dig sprite behind only by switching its
  actor pose; the renderer must not clone a second Solomon.

## Recovered wave contract

- Default runs use the exact retail schedule parsed at build time into a
  checked-in semantic module with source hash and record-count assertions.
  Compiler and live Spawner/placement draws use deterministic authoritative
  run streams; no client contributes randomness.
- `NEXT` is signed-relative native schedule data. The editor parser and
  validator must preserve negative edges instead of treating them as invalid
  absolute indexes.
- One director state owns current schedule index, wave ordinal, delay,
  remaining spawn budget, active group/member cursor, RNG state, and stable
  next enemy id. It is advanced once per Boneyard tick on the host.
- `SPAWN` is a group-cost compiler budget, not a literal actor count. The
  compiler expands it, selects whole GROUPs, applies wave-ordinal bonuses, and
  merges consecutive selections. `SPAWNDELAY` contributes half of one draw per
  consumed GROUP member to event spread.
- The compiler consumes one retained `WAVEDELAY` draw and a singleton `SPAWN`
  draw, but neither sampled value becomes a delay. `MAXENEMIES` round-trips as
  retail syntax but is likewise inert: native parser cleanup is its only
  post-parse consumer, and Spawner tick has no live-count cap.
- `FLAG_IGNITE` and `FLAG_IMMORTALIZE` remain in lossless source text, but the
  retail modifier parser logs and ignores them. Compiled bursts omit both so
  future combat cannot mistake source-only tokens for active configuration.
- An ordinary Spawner chooses a random event record for every actor. Sequential
  GROUP membership is a separate native mode. FORMATION remains the same
  parsed grouping surface until formation-specific movement belongs to the
  enemy system.
- Mode 3 waits on the strict live-count threshold. Mode 6 resumes when
  `storedTimer < Arena.lowPopulationTicks` or live count is below its second
  strict threshold, with no boss. Arena resets the timer at wave start and
  Region tick increments it while live enemies are below 11.
- Spawn placement chooses a living/available player and a seeded 100-unit
  radial offset, projects new actor roots through authoritative Boneyard
  collision, and records the location policy on the enemy snapshot. Native
  camera-dependent dark/light placement has no headless-host equivalent and
  remains an explicit placement projection, not a claimed exact camera query.
- Enemies are authoritative replicated actors with stable id, native type id,
  flags, position, heading, and spawn tick. Renderer lifetime follows that
  list exactly.
- Enemy combat owns damage/death. The director exports one retirement seam so
  that combat can remove an actor and unblock native live-count gates. The
  wave system must not auto-kill, auto-age, or infer death from visibility.
- Default stock enemy rows cover Skeleton 1001, Archer 1002, Mage 1003, Imp
  1004, Zombie 1006, Wraith 1007, Demon 1009, and Coffin 1013. Their visual
  families are a separate renderer lane: the director exposes exact stable
  actor identities and does not guess pose selection or fold presentation
  lifecycle back into scheduling.
- No visual wave HUD is added. Non-visual data attributes may expose encounter
  phase, wave ordinal, pending budget, and live count for browser proof.

## Geometry-bank and mod boundary

The twelve checked-in default geometry templates are exact stock layouts, but
their source runtime files are not twelve clean retail schedule oracles. At
least one was generated under a seven-event test override. The implementation
therefore attaches the untouched retail schedule to default choices rather
than copying each captured source TimeLine. This keeps the geometry provenance
true and the default encounter retail-authored.

The editor currently preserves mod TimeLines as opaque chunks. A mod-authored
Boneyard is not silently assigned the retail default schedule: general
Trigger/TimeLine interpretation is a larger Bonedit compatibility subsystem.
For this milestone, default Boneyards receive the survival director and custom
Boneyards remain pre-wave unless/until their scripting graph is supported.

## Adjacent systems and honest limits

This wave cut owns scheduling and spawning, not the entire combat game. Enemy
navigation, targeting, attacks, player spells/damage, family visuals, death
effects, drops, experience, boss recipe scripts, and game-over/respawn remain
adjacent native systems. Their absence cannot be hidden with stationary actors
that silently die. Focused director tests explicitly retire enemies through
the future combat seam to prove pause and next-wave behavior.

Native state 4 computes a long clipped path through Arena path/collision
helpers. The browser preserves boundary and obstacle clipping by projecting
each authoritative escape move through its Boneyard collision owner. It does
not claim byte-for-byte equivalence with the native 4096-unit waypoint query
or the generated four-second camera-lock/off-camera cleanup script.

The Website currently has no lifted browser renders of native `combatprelude`
or `combat` tracker modules. Prelude remains the entry track; this pass does
not substitute unrelated music. The six exact survival Solomon WAVs are
available and are the required encounter audio.

## Acceptance contract

- Kernel tests pin the late dig-cycle gate, three contact-frame emergence
  branches, strict contact ellipse, closest-target selection, per-target input
  lock, the native raw 359/360 facing boundary, hello cue tick durations,
  25-tick hold, strict retreat-heading discontinuity, signed 15-degree
  deflection, repeating state-4 hop,
  final-lifetime movement, retreat event order, and run trigger boundary.
- Schedule tests pin source SHA-256, 42 records, signed NEXT behavior, enemy
  type inventory, seeded reproducibility, group-cost expansion, per-actor
  record sampling, inert `MAXENEMIES`, low-population release, and
  retirement-driven continuation.
- Protocol tests round-trip every encounter/enemy field and reject unknown
  phases, cues, enemy types, duplicate ids, invalid positions, and oversized
  lists.
- Presentation tests prove snapshot interpolation does not interpolate
  discrete phase/cue/dig-frame identities and does interpolate Solomon/enemy
  positions and the emergence offset.
- Renderer tests pin the exact Solomon direction/body/mouth/walk record mapping,
  fixed grave-ground dialogue clip, emergence and state-4 vertical offsets,
  and shared painter ownership;
  enemy-family presentation remains separately scoped.
- Audio tests prove only the newest unseen semantic cue plays, sparse snapshots
  cannot burst historical speech, and run replacement clears consumption state.
- The canonical `./scripts/validate.sh` gate passes from the isolated Website
  worktree.
- A real Chromium session walks the player into the native ellipse, observes
  a hello event and control lock, waits for the retreat/run event, observes
  the first authoritative enemies, and records no page or console errors.

Exact-tree browser receipt, 2026-08-14: a clean `npm run dev:game` host and
headless Chrome at `1600 x 900` ran `npm run smoke:game:waves`. The browser
physically crossed the selected gate, then followed a 22-node route computed
from the loaded scene through the same collision resolver used by the host.
Contact occurred at `(2065.948,1171.127)` after 59 observed approach samples.
The run selected `solomon-hello-2`, rendered dialogue record 226, observed
mouth poses 0/1/2, then played `solomon-laugh-1` and
`solomon-get-him-boys`. The run edge reached authoritative opening state with
13 live plus two pending actors; the final receipt reached
`opening-threshold` with 15 live, zero pending, and wave ordinal zero. Page and
console error lists were empty. The screenshots are
`/tmp/solomon-waves-final-exact-speaking.png` and
`/tmp/solomon-waves-final-exact.png`; enemy-family art remains intentionally
absent from this renderer lane.

## Live-validation limitation

A read-only `sd.waves` Lua verification was attempted against the already
running stock process on 2026-08-14. The process was present, but the named
pipe `SolomonDarkModLoader_LuaExec` was unavailable because its loader Lua
runtime was not initialized. The process was not restarted or mutated. This
does not weaken the static actor trace, exact PCM evidence, retail schedule,
or serialized 594-event oracle; it only means no fresh live field sample was
added during this pass.

## 2026-08-28 — Solomon state-4 NavMesh and embedded-grave escape reopening

### Reported smell and parity question

- Reported web behavior: after `SOLOMON RUNS`, Solomon remains rooted against
  the grave while all six running poses cycle. Waves still begin and the actor
  eventually disappears, making the failure presentation-only to players.
- Stock behavior to recover: state 4 must retain its clipped 4096-unit escape
  target, blocked-path NavMesh route, collision-resolved movement, increasing
  speed, hop, gait, and 515-tick lifetime as one authoritative owner.
- Reproduction: all twelve stock-generated Boneyards and the four reachable
  post-deflection headings `30/60/300/330`; owning-grave-only and all-graves
  collision falsifiers; first 100 ticks and terminal tick 515.

This is a secondary report against the earlier entry. That pass documented the
native waypoint query but shipped the named per-step collision projection as
an approximation even though the browser can represent the already recovered
Arena NavMesh. It also reused the player radius `25` without extracting the
Solomon constructor's body radius. Both shortcuts are reopened here.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Current Mac authority/presentation matrix | Website `0c510ce3`; all 12 generated templates x headings `30/60/300/330` | All 48 full-collision runs kept exactly one position through tick 100 while exposing all six walk poses, then retired as `gone` at tick 515. Removing all Gravestones released all 48; removing only the owning grave released 36 because three templates begin inside more than one grave footprint. | high |
| Fresh constructor instructions | retail 0.72.5 SHA-256 `03a834...f1e3`; `Solomon_Dig::Ctor 0x00481C20` | Constructor writes type `0x1391`, static/dynamic masks `0x400/0x810`, collision radius `30` from `0x00784ED8`, resistance `90` from `0x00785D98`, and inherits the shared Badguy route/movement base. | high |
| Fresh transition/state-4 instructions | `0x0047D570`, `0x004857B0`; Arena vtable `0x00785934 + 0x10C -> 0x0063ED40`; rectangle expand `0x0042D1B0`; segment clip `0x00410FF0`; route wrapper `0x005DFF20`; LOS/movement `0x00524180/0x00524D70/0x00525800` | Transition builds a 4096-unit target along the signed-deflected heading, reads the Arena rectangle, expands it uniformly by 100, and clips the ray. State 4 reads the same Arena rectangle, expands it by 50, clips the active path again, tests direct clearance, and calls the persistent Arena NavMesh when blocked. `0x005DFF20` clears and rebuilds its NavMesh-owned scratch route on every call; state 4 tests later returned points with the point-width, mask-zero LOS call at `0x00485A1C`, selects the farthest visible waypoint for that tick, faces it, and submits movement before speed/gait/hop/lifetime updates. | high |
| Current web causal trace | `boneyard-encounter.ts`, `boneyard-world.ts` | Kernel advances a straight heading and gait; the world then resolves that delta with player radius 25 against every static collider. Solomon starts at grave `(gx+10,gy+113)`, already intersecting the promoted grave footprint, so the generic resolver returns the same root forever while clocks continue. | high |

Ghidra provenance: canonical `SolomonDark` project through the read-only replica
wrapper, preferred image base `0x00400000`; Mod Loader tool revision
`08bfba9ef367f7b863848030d0a289dc31e33192` was read-only and unchanged.

### System boundary and membership inventory

Native system: **Solomon direct-goal/NavMesh escape**, from state-3 target
construction through embedded-start admission, route selection, waypoint
advance, facing, collision, gait/hop, replication, save/restore, and teardown.

| Member / branch | Native source | Disposition required | Proof |
| --- | --- | --- | --- |
| state-3 target and signed heading | `0x0047D570` | `exact-ported` | target/heading goldens and all four headings |
| clipped 4096-unit target | `0x0047D862..0x0047D9AC` | `exact-ported` | durable target ends on the Arena rectangle expanded by 100 and survives restore |
| state-4 active path clip | `0x004857B0..0x0048587A` | `exact-ported` | route endpoint ends on the Arena rectangle expanded by 50 |
| direct clear route | `0x00524180` | `exact-ported` | clear template reaches target direction without NavMesh waypoint |
| blocked route and waypoint selection | `0x005DFF20`, `0x004857B0` | `exact-ported` through existing Arena NavMesh | every blocked tick rebuilds the scratch route and selects its farthest visible returned waypoint |
| embedded starting grave set | constructor geometry and `MoveStep` | `exact-ported` | only initially overlapping source ids are ignored until exited; later contact is restored |
| collision body | ctor `+0x30 = 30` | `exact-ported` | no player-radius reuse |
| speed, gait, hop, lifetime | state 4 `0x00485C48..0x00485D85` | `verified-already-at-parity` | existing clocks retained while resolved travel becomes nonzero |
| run trigger/wave admission | state-3 `FUN_0068B6D0(...,15)` | `verified-already-at-parity` | exactly one run event independent of route length |
| local/observer presentation | encounter snapshot and renderer | `verified-already-at-parity` | shared position/heading/pose route; no client pathfinding |
| save/restore during state 4 | Website continuation owner | `exact-ported` | durable target and initial-overlap set resume; ephemeral NavMesh scratch is rebuilt next tick |
| Tutorial and twelve generated default Arenas | shared Solomon_Dig class | `exact-ported` | per-template/scene coverage |
| mod Arenas | Website constructs no retail Solomon encounter for mod source | `out-of-system` | existing source gate remains explicit |
| Solomon_Riff, DriveBy, Memorator, GameNpc | other direct native solver callers | `out-of-system` — not constructed by Website survival factory | caller census remains documented in entry 273 |
| pause, Game Over, world replacement, disconnect | world lifecycle | `verified-already-at-parity` | no route state survives encounter/world teardown |

No member is `blocked-by-platform`.

### Native ownership and implementation consequence

- Keep timing, RNG, voice, wave start, gait, hop, renderer, and protocol-facing
  fields in the existing encounter kernel. Add only the internal authoritative
  escape target and embedded-source state. The NavMesh owns its ephemeral route;
  clients continue consuming only semantic position, heading, phase, and walk
  cycle.
- Use the existing persistent `findBoneyardEnemyRoute` service with native
  ordinary clearance 25 and Solomon body radius 30. The durable ray uses the
  full Arena rectangle expanded by 100; route selection and movement use that
  full rectangle expanded by 50, independent of the entrance/combat-boundary
  transition. Do not add a Solomon-only steering approximation or stop the
  running animation when blocked.
- At route birth, record every sourced collision primitive intersecting the
  intentional set-piece root. Ignore only those exact sources while the body
  exits them, then restore normal collision. Apply the exemption to direct,
  NavMesh endpoint/simplification, point-width waypoint-visibility, and final
  movement queries while retaining the one authored Arena NavMesh itself. This
  handles layouts where two graves overlap the root without rebuilding the
  mesh or granting permanent grave noclip.
- Remove the old straight-delta/player-radius collision projection once the
  route owner replaces it. No fallback path remains.

### Validation contract

- Red/green matrix: twelve generated templates x four headings must move from
  the first 100-tick root, visit all six poses, keep one run event, and retire
  on tick 515; the former implementation fails all 48 displacement rows.
- Geometry goldens must distinguish the 100-unit durable target clip from the
  50-unit per-state path clip and retain the final movement tick before route
  teardown.
- Route membership: direct-clear, blocked per-tick rebuild/farthest-visible
  selection, embedded one- and multi-grave starts, restored later grave
  collision, route failure, and durable target/overlap save/restore each
  receive focused assertions.
- Mac Chrome: enter the authentic Boneyard, trigger the dialogue/run edge, and
  record nonzero Solomon displacement through the same live action while waves,
  audio, camera, and renderer stay healthy with empty error arrays.
- Complete gate: `/opt/homebrew/bin/bash ./scripts/validate.sh` on the exact Mac
  candidate.

### Implemented result and browser acceptance

- The Website now retains the native +100 durable ray and +50 state-4 path
  clip, uses Solomon's radius 30, rebuilds the NavMesh scratch route on blocked
  ticks, applies the stock point-width/mask-zero later-waypoint visibility
  query, and resolves the selected direction through normal body collision.
- Only collision sources intersecting Solomon's intentional set-piece root are
  exempt during endpoint, visibility, and movement queries. Each exemption is
  discarded as soon as his radius-30 body leaves that source; the authored
  Arena NavMesh remains stable and later collision is normal.
- Mac typecheck plus the focused Hail/collision/navigation/Solomon/Boulder/save
  set passed `229/229`. The Solomon matrix covers all twelve generated Arenas
  at headings `30/60/300/330`, a sourced embedded grave plus blocking wall,
  the +50 path-edge hold, final-tick teardown, and continuation migration.
- Chrome `151.0.7922.174` production acceptance completed the authentic
  dialogue/run/opening journey in 97 seconds. The live run-edge assertion saw
  more than 20 units of immediate displacement; the escaping sample reached
  `(803.4416164459224,2508.9257586672406)` and the terminal +50-edge sample
  reached `(675.9001350277774,2793.6415342579367)`. Waves admitted eleven
  opening enemies, the renderer stayed at 60 FPS, and page, wire, and failed-
  response arrays were empty. Visual receipt:
  `.tmp-solomon-final/solomon-escape.png` (temporary acceptance capture).
- The exact Mac candidate passed `/opt/homebrew/bin/bash ./scripts/validate.sh`:
  backend build with zero warnings/errors, all backend/contracts, prerequisite
  and broad Boneyard/runtime tests, every auxiliary frontend and desktop suite,
  production frontend/game-host builds, CSP media policy, and bundle budget.
  The raw Game entry remains below both bundle limits.

## 2026-08-30 — Slumpgut high-Zombie trigger and authored boss recipe reopening

### Reported smell and parity question

- Reported web behavior: during one otherwise healthy multiplayer survival run,
  the expected first featured boss, `SLUMPGUT`, never appeared. Ordinary
  Zombies continued and the game remained operational. A later checkpoint from
  the same run still had ordinary Mage, Knight/Skeleton, Imp, Wraith/Ghost,
  Archer, and Coffin actors, including living Coffins from earlier spawns.
- Stock behavior to recover: determine whether Slumpgut is a wave-label member,
  a player-level event, or an independent trigger; recover its complete trigger,
  delay, placement, recipe, count, death, save, replication, and teardown path;
  and decide whether ordinary-wave continuation or retained Coffins are defects.
- Reproduction inputs: the reported Website director at base `ebf693b4`, with
  the completed implementation rebased onto `7b614e36`; exported
  browser-to-stock archives `solomon-dark-stock-save-1788059131795.zip`
  SHA-256 `6b7c949e...e5eac` and
  `solomon-dark-stock-save-1788061272587.zip` SHA-256
  `73584ff6...246a9`; twelve checked-in stock-generator source runs; and current
  stock `sandbox/play.boneyard` SHA-256 `64b5d591...e4030`.
- The exported archives decode the same wizard, `Soggy`, at levels 17 and 31,
  but the native portability contract intentionally carries permanent wizard
  progression only. It does not carry the live browser Boneyard, wave, or actor
  state, so it corroborates the run chronology but is not treated as a live
  enemy census.
- Falsifiers were: Slumpgut is selected by player level or ordinary wave row;
  the trigger uses total monster count rather than Zombie count; 75 is
  inclusive; the ten-second interval runs before the condition is admitted;
  the script pauses the ordinary timeline; Coffins or Maggots are forcibly
  retired for the boss; or the authored recipe is a normal Zombie row.

This is a secondary report against the original 2026-08-14 wave entry. That
pass recovered the ordinary `wave.txt` TimeLine and explicitly left "boss
recipe scripts" adjacent. It therefore stopped its membership sweep before
the hard-coded `WaveData_Parse` trigger/recipe tail even though the generated
default survival file and retail instructions were available. The web shipped
the ordinary schedule without the independent Slumpgut owner.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | Solomon Dark Beta 0.72.5, preferred image base `0x00400000`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, re-hashed 2026-08-30 | Same canonical executable as the earlier wave/enemy entries. | high |
| Current web causal trace | `boneyard-wave-director.ts`, `boneyard-wave-timeline.ts`, `boneyard-world.ts`, `boneyard-enemy-store.ts` at `ebf693b4` | Website compiles only the 42 `wave.txt` rows. The director receives total live actors only and has no trigger, Zombie-count, delayed script, authored boss recipe, or featured-boss state, so no path can emit Slumpgut. | high |
| Concurrent-main integration | Website `origin/main` `7b614e36`, `Optimize late-wave Boneyard presentation` | The final candidate retains the newer off-camera/painter presentation ownership and adds only semantic live-Zombie/Slumpgut diagnostics; it does not revert or bypass that late-wave renderer optimization. | high |
| Generator instructions | `WaveData_Parse 0x00632730`, Slumpgut recipe/script/trigger range `0x00636126..0x00636357`; strings `0x0079EC70/84/94` | Stock constructs one Zombie `MonsterRecipe`, one two-command script, and one type-9 interval Trigger. This is hard-coded generator membership outside the parsed 42-row table. | high |
| Trigger runtime | Trigger ctor `0x00684040`; Sync `0x00684360`; TriggerControl tick `0x0068BBC0`; interval enrollment `0x00681910`; trip `0x00686E70` | Trigger defaults are initially enabled and limited to one trip. TriggerControl round-robins four type-9 interval members in serialized order, with Slumpgut first. Its eligible turn evaluates the condition and, when true, enrolls a `10 * 100 = 1000` fixed-tick countdown; the countdown is not pre-running from scene entry. Expiry trips the script once and retires the Trigger. | high |
| Condition/UI dispatch | CodeLine command `6`; editor dispatcher `0x004DEDA0`; condition builder `0x004D1C30`; serialized operands `[2,1,75]` | Count selector `2` is `ZOMBIE COUNT`, comparator `1` is `IS GREATER THAN`, and threshold is `75`: admission is strict `Zombie count > 75`. | high |
| Script commands | Slumpgut Script serialized command ids `0x3EA,0x3EE`; builders `0x004BF790`, `0x004D28B0`; generated script UID references | After trigger expiry, `SLEEP FOR 15 SECONDS` owns another 1500 fixed ticks, then `SPAWN CUSTOM MONSTER` emits the Slumpgut recipe `IN THE LIGHT`. Total threshold-to-spawn delay is 2500 simulation ticks. | high |
| MonsterRecipe table | serializer `0x0063E890`; current generated file plus twelve source `.boneyard` files whose hashes are pinned by `native-generated-boneyards.ts` | All 15 generated recipe rows were decoded. Across all twelve sources, every Slumpgut field except allocation UID/on-death-link UID is byte-semantically identical. Ironmaw/Foulshaft UIDs, start-wave labels, and Ironmaw weapon selector are generator-variable and are not silently substituted for Slumpgut. | high |
| Slumpgut row | native type `1006`; generated `MonsterRecipe` fields | Name/archetype `Slumpgut`; boss mode `1`; HP `1575`; primary/secondary/tertiary/extra values `35/10/15/10`; chase/attack/move scale `1/1/1`; Zombie body mode `1`; flyblown true; flanking false; pathfinding mode `2`; XP field `-196.875`; linked manual miniboss-death trigger; drop selectors `4,4,4,0,4,4`; light placement. | high |
| Linked death program | type-8 `On Miniboss Die` Trigger; `Miniboss Die Script` construction `0x0063553E..0x00635732`; random-condition helper `0x0062C4F0`; command builders `0x004D12F0`, `0x004D4680`, `0x004D4500`, and `0x004D2370` | The recipe death link runs `if RANDOM (2) EQUALS 1`: the true branch drops an inclusive `300..600` Gold amount at location selector `7`, `TRIGGER FOCUS`, then jumps to `EXIT`; the false branch drops one random item with mode `0`, `ANY`, at the same dead-monster focus. This script reward is additional to the recipe's ordinary loot selectors. | high |
| Count and Coffin boundary | `0x004D1C30`; Website entry 254 and current `work.actors.length` count seam | Slumpgut reads Zombie actors, not total actors. A living Coffin remains one ordinary live actor; its Maggots cancel native Badguy-count admission and are already excluded from the Website count. Neither member is retired when Slumpgut arms or spawns. | high |

Ghidra ran through read-only replicas 2 and 3 of canonical project
`SolomonDark`; replica 2 recovered the trigger/recipe owner and replica 3
closed the linked miniboss-death condition, script actions, and trigger-focus
placement.
Mod Loader checkout revision `08bfba9ef367f7b863848030d0a289dc31e33192`
was used only as the wrapper/script provider; wrapper SHA-256 was
`b0253061...e9d49` and no Mod Loader file was changed.

### System boundary and membership inventory

Native system: **the generated default-survival Slumpgut high-Zombie trigger**,
from authoritative Zombie-count admission through both fixed-tick delays,
light-valid materialization, authored Zombie-boss config, independent ordinary
wave continuation, actor retirement, and durable multiplayer state.

| Member / branch | Native source | Disposition for this correction | Proof contract |
| --- | --- | --- | --- |
| Trigger construction/default flags | `0x00636275..0x00636357`, `0x00684040` | `exact-ported` | initially enabled, one-trip limit, type 9, first of four interval members, interval 10 |
| Zombie-count condition | command 6 / `0x004D1C30`, operands `[2,1,75]` | `exact-ported` | 75 does not arm; 76 arms once; Coffin/Maggot/other families do not contribute |
| interval countdown | `0x0068BC90..0x0068BD13`, `0x0068BBC0` | `exact-ported` | 1000 fixed ticks begin only after threshold admission |
| script sleep | command `0x3EA`, `0x004BF790` | `exact-ported` | 1500 further fixed ticks; no render-clock ownership |
| custom spawn and placement | command `0x3EE`, `0x004D28B0`, policy 1 | `exact-ported` through existing authoritative placement resolver | one Zombie intent, anywhere/light-valid, no timeline budget debit |
| complete Slumpgut MonsterRecipe | `0x00636126..0x006361E9`, serializer `0x0063E890` | `exact-ported` | every serialized field above asserted, including boss/body/flyblown/poison/path modes and the linked death program |
| Slumpgut living Zombie family | type 1006 constructor/config/tick/render/attack paths already closed by entries 91/254 | `verified-already-at-parity` with authored recipe values now admitted | selector-3 body/head, flyblown auxiliaries, target/attack/death coverage |
| shared miniboss death trigger and script | type-8 Trigger plus `0x0063553E..0x00635732` | `exact-ported` for Slumpgut; reusable by the separately scoped Ironmaw/Foulshaft producers | one native `RANDOM(2)` branch; either inclusive 300–600 Gold or one `ANY` item at the retired boss position, never both |
| ordinary `wave.txt` TimeLine while countdown/boss is live | TimeLine and TriggerControl are independent owners | `verified-already-at-parity` | phase, schedule row, pending budget, and ordinary spawns continue unchanged |
| Coffin actor and children | entry 254 count/lifetime contract | `verified-already-at-parity` | living Coffin may persist; Maggots remain excluded; no boss-trigger teardown |
| trigger/script one-shot teardown | Trigger `+0x65/+0x68/+0x94`, `0x00686E70` | `exact-ported` | no second Slumpgut after spawn or death; world replacement resets the owner |
| save/restore mid-countdown and mid-script sleep | Website Boneyard continuation | `exact-ported` | both remaining counters and tripped state resume without replay/reset |
| multiplayer authority/replication | host-owned Boneyard world and wave snapshot | `exact-ported` | clients never evaluate Zombie count or schedule their own boss |
| Slumpgut native boss-prefix HUD | independent guarded HUD prefix `0x005D257E..0x005D2AEF`, already dispositioned in entry 132 | `out-of-system` — separate featured-enemy presentation owner, not a spawn producer or count consumer | this correction proves the actor and trigger state; it does not claim that separate HUD panel |
| Ironmaw and Foulshaft standard-family boss rows | same MonsterRecipe serializer but type-2 randomized start-wave programs | `out-of-system` — distinct start-wave trigger system, not the high-Zombie interval owner | complete rows and varying start-wave/weapon membership recorded by the twelve-file census; no guessed fixed label |
| Heartmonger, three Dire Faculty rows, The Discorporeal, and seven Deep Portals | remaining generated 15-row table | `out-of-system` — separate actor families and boss/portal programs | every row enumerated and decoded; none is used as a Slumpgut stand-in |
| custom/mod Boneyard TriggerControl bytecode | authored opaque section 1 | `out-of-system` — general Bonedit bytecode interpreter remains the declared mod boundary | default hard-coded Slumpgut program only; no custom trigger is inferred |

No member is `blocked-by-platform`.

### Native ownership and recovered behavioral contract

- `TriggerControl`, not the ordinary TimeLine, owns Slumpgut. The eligible
  trigger remains independent of `waveOrdinal`, player level, schedule index,
  and `pendingSpawnBudget`.
- The first Slumpgut round-robin turn observing more than 75 registered Zombie
  actors enrolls a 1000-tick interval. With four serialized interval triggers,
  admission is zero to three ticks after the threshold first becomes true. The
  script begins only at expiry, owns a second
  1500-tick sleep, then emits exactly one authored Zombie boss. The trigger's
  default limit retires it after the trip, so count oscillation, boss death,
  save/resume, or later Zombie surges cannot create another Slumpgut.
- The spawn command's policy is `IN THE LIGHT`. It does not require a fixed
  coordinate or a living-Coffin cleanup. The existing host placement resolver
  owns collision and light-valid retry; no client camera or render cadence may
  schedule the actor.
- Slumpgut is a type-1006 Zombie with authored boss mode and exact family
  overrides, not a wave flag bundle. In particular, body mode 1 selects the
  already recovered selector-3 Zombie banks; flyblown is true; poison punch,
  pool, and duration are authored `10/15/10`; pathfinding mode is 2; and the
  normal wave ordinal must not rescale the row.
- The linked type-8 death Trigger owns one additional script reward at the
  retired Slumpgut's position. Its one-in-two condition chooses the Gold branch
  only when `RANDOM(2) == 1`; that branch draws an inclusive 300–600 amount.
  Otherwise `DROP RANDOM ITEM` mode 0 materializes one `ANY` item. Both use
  `TRIGGER FOCUS`, and neither replaces the recipe's ordinary loot-policy pass.
- The report's continued ordinary waves and retained Coffins agree with stock.
  Slumpgut neither pauses the main TimeLine nor forces other enemies to die.
  Those observations are regression expectations, not additional fixes.
- The host owns count, countdowns, spawn intent, and persistence. A snapshot may
  expose semantic phase/countdown for acceptance, but peers never reconstruct
  the trigger from sampled enemy frames.

### Confidence and open questions

- Confirmed: trigger type/default flags; strict condition operands; both delay
  durations; one-trip teardown; light placement selector; every Slumpgut recipe
  field across twelve independent generated files; the complete linked
  miniboss-death branch and trigger-focus placement; ordinary-wave and Coffin
  non-interference; current web's complete absence of a producer.
- Inferred only for deterministic multiplayer: the web uses its established
  host run seed for the initial unconstrained placement candidate before the
  exact light/collision resolver, rather than reproducing an unrelated retail
  process-global RNG history. Branch order and policy are exact.
- No material unknown remains inside the declared high-Zombie trigger system.

### Web implementation consequence and validation contract

- Add a cohesive fixed-tick Slumpgut program to the authoritative wave owner,
  with explicit `eligible`, interval-countdown, script-sleep, spawned, and
  retired state. Do not add a browser timer, player-level check, wave-number
  exception, or synthetic Coffin cleanup.
- Feed it the authoritative actor-only family census after terminal enemy
  updates. Keep Maggots outside every count. Emit an authored-recipe spawn
  intent through the existing materializer and light/collision placement seam.
- Extend authored Zombie recipe evaluation only for the extracted body,
  flyblown, poison, boss-mode, pathfinding, flanking, linked death program, and
  reward fields. Remove no existing ordinary-wave behavior.
- Focused red/green tests must cover counts 75/76; all four round-robin turns;
  999/1000 interval ticks;
  1499/1500 script ticks; exactly one spawn; world reset; save/restore in both
  waits; ordinary spawn continuation; Coffin persistence; Maggot exclusion;
  every Slumpgut recipe field; and both deterministic miniboss-death reward
  branches at trigger focus.
- Mac Chrome acceptance must force the authentic authoritative threshold,
  observe the two countdown boundaries and one selector-3 flyblown Zombie
  materialization, retain ordinary wave progression and a living Coffin, kill
  that exact actor, observe one script-owned Gold-or-item reward at its death
  focus, and record empty page/console/failed-response arrays. The exact
  candidate must then pass `/opt/homebrew/bin/bash ./scripts/validate.sh`.

## 2026-08-30 — Deep Portal phases, Portal-ejected Imps, and reachable placement reopening

### Reported smell and parity question

- Player report: Imps can occasionally appear outside the playable Boneyard;
  during the Hell/Deep Portal phase an unreachable Portal can prevent the wave
  from continuing. In the reported sample the affected actors appeared inside
  the visible bounds but remained stuck. The player also reports the defect in
  the original native game.
- Current Website behavior at base `a554ea73`: default survival has no type-5021
  Portal factory row, no Deep Portal start-wave triggers, no Portal actor or
  Portal-ejected Imp path, and therefore cannot yet reproduce or complete the
  phase. The new Slumpgut work intentionally dispositioned all seven Portal
  rows out of that smaller high-Zombie-trigger system.
- Native questions: recover every generated Portal recipe/trigger/script row,
  the first-phase timeline barrier, Portal construction/tick/render/light/
  damage/death/audio state, child-Imp construction and ejection geometry,
  boss-count ownership, save/replication/reset boundaries, and which stock
  placement omissions explain the reported exterior and stuck actors.
- Falsifiers: Portal children use the generic enemy placement retry; active
  Portal radius remains 45; Portal heading is fixed rather than target-owned;
  the phase waits on ordinary Imps; every collision-valid root is connected to
  a player; dark placement remains inside the post-entrance combat target; or a
  corrected child root changes already-valid native births.

This is another secondary report in the wave/enemy-placement system. Entry 51
left hard-coded boss and Portal programs adjacent. Entry 72 added local
collision validity and a half-unit mobility probe but did not prove
player-connected reachability. Entry 95 already proved the stock dark-policy
camera-target exception but no Portal consumer existed. Entry 273 recovered
the NavMesh, yet placement still accepted a valid root in a disconnected
component. Those incomplete dispositions are reopened together here.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | Solomon Dark Beta 0.72.5, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred image base `0x00400000`, re-hashed 2026-08-30 | Same canonical executable as the accepted enemy, wave, collision, and Slumpgut evidence. | high |
| Portal constructor/config | `Portal::Ctor 0x0047BD60`; generic config `0x00462790`; common init `0x00483480`; vtable `0x007868CC` | Native type `5021/0x139D`; construction radius 45; target-owned initial heading (random 0..360 only with no target); active radius rewrites to 5 on materialization tick 9; recipe `specialSpawnMode=2` contributes to global boss count. | high |
| Portal tick and child construction | `Portal::Tick 0x00489CC0`; `Imp::Tick 0x00485DC0`; registration `0x0063F6D0` | The first ten ticks materialize. Active portals decrement a frequency countdown, then build type-1004 Imp directly. Child root is `portal + heading(child)*30 + heading(portal)*(5 + childRadius)`, with child radius 7.5..10. The child gets horizontal speed 6.75, base speed 4.5, vertical offset `-0.1`, vertical velocity `-(10+U(5))`, inherits team and Portal primary damage, and is registered without any bounds, collision, mobility, or connectivity placement call. | high |
| Portal frequency table | `0x00462790`, `0x00489CC0`; all six editor/config enum rows | Seconds/tick ranges are Very Low `8..10` / `800..1000`, Low `6..8` / `600..800`, Normal `3..4` / `300..400`, High `2..3` / `200..300`, Very High `1..2` / `100..200`, You Will Die `.25..0.5` / `25..50`. Initial countdown is `450 + Integer(upper/3)`. Ordinary reset is inclusive lower..upper; a separate `Integer(8)==1` branch replaces it with `Integer(upper)`. | high |
| Portal presentation/light | main `0x004A1B30`; alternate `0x004A1CB0`; light provider `0x0047BED0`; DeadHawg builder map | `+0x220` grows by `.025` to one. `+0x214` advances by `.15+U(.15)` over DeadHawg 46..77; `+0x210` advances by `.05+U(.2)` over 180..199; fixed scale is `1.25+U(.5)`. The alternate pass also consumes inline DeadHawg 18 and 22. Light radius is the live `+0x220`; intensity is `+0x220*(.9+U(.35))`; Multiple Shadows owns the containment flag. | high |
| Damage/death/audio | damage presenter `0x0048C370`; death `0x004A1FA0`; audio registry singleton `DAT_008199D8` | Materialization tick 9 plays `OpenPortal.wav` at half gain. Each Imp ejection plays `fireballhit.wav`. Accepted Portal damage plays `hurtportal.wav` at `1+SignedFloat(.1)` and owns a 10..24-tick presentation latch using BadGuys 401..419. Death plays `PortalDie.wav`, consumes BadGuys 1823..1833, twelve BadGuys-27 black-smoky bouncers, and exactly two DeadHawg decals: array index 6 / record 120 and the final row / record 144, before common reward/drop retirement. | high |
| Phase script and gate | `WaveData_Parse 0x00632730`; CodeLine runtime `0x00689750`; condition builder/runtime `0x004D1C30/0x00681930`; Arena advance `0x00465C00` | Optional first `Deep Portal` trigger pauses the main timeline manually, preserves the recovered Solomon-command/sleep envelope, spawns three light Portals at 25-tick intervals, then polls `BOSS MONSTER COUNT > 0` every 200 ticks. Only after it reaches zero does the script start the next wave and unpause. Child Imps are ordinary monster-count members, not boss-count members. Later Portal 2..7 start-wave scripts run concurrently, select dark placement, and emit their authored counts at 25-tick intervals. | high |
| Authored source corpus | twelve `Mod Loader/runtime/instances/*/stage/sandbox/play.boneyard` sources whose SHA-256 values are pinned by `native-generated-boneyards.ts`; parsed read-only with Website's native SyncBuffer parser | Eight sources contain all seven phases; four omit optional phase 1 but contain phases 2..7. Across 80 Portal recipe rows, type, family, policies, frequency band, UIDs, HP, trigger wave, and loop count are extractable. No canonical-random stand-in is needed. | high |
| Corrected Mac geometry loop | exact Website `6063da56`; all twelve generated geometry templates; Portal placement radius 45, active radius 5, Imp radii 7.5/8.75/10, target-facing Portal heading, 40-unit legal-root lattice, 24 child headings | Among 2,201,112 native-form child roots, 4,624 were inside combat bounds but collision-invalid and 4,032 could move zero of four half-unit probes. A deterministic correction retained all 2,196,488 valid roots byte-identically and projected all 4,624 invalid roots to valid/mobile positions with zero failures. This is a reachability matrix, not a native frequency estimate. | high |
| Connectivity falsifier | same exact Mac templates and accepted clearance-25 NavMesh | Four of 7,926 collision-valid Portal roots were disconnected from a valid central player component. Six of 90,709 collision-valid child roots crossed into a disconnected component even though their Portal root was player-connected. The NavMesh correctly returned no route; the missing predicate is placement ownership, not an A* defect. | high |
| Exterior-stock branch | existing entry 95 static trace of `0x00463D30/0x00463BE0`; Portal 2..7 scripts use policy 0 (`IN THE DARK`) | Native dark placement can accept a collision-free raw point before camera-target containment and bypasses the retry rectangle until its fallback transition. A Portal and all children can therefore remain in the retired entrance/full-Arena strip that players perceive as out of bounds. Website already declares the stricter combat-bound domain and must route every new Portal/child through it. | high |

Ghidra used canonical read-only project `SolomonDark` through replicas 3 and 4.
The read-only Mod Loader wrapper revision was
`08bfba9ef367f7b863848030d0a289dc31e33192`; wrapper SHA-256 was
`b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`.
No Mod Loader file changed.

An earlier diagnostic matrix incorrectly kept Portal's constructor radius 45
in the child offset and enumerated arbitrary Portal headings. Static
instructions falsified both assumptions: active radius is 5 and common init
faces an available target. Its resulting 35,464 exterior-root count is not
used. The corrected matrix above is the only implementation evidence.

### Complete authored phase census

Each bracket is ordered by the phases present in that source. `waves` are
type-2 trigger labels, `counts` are script-loop Portal births, `freq` is the
Portal frequency enum, and `recipe UIDs` are the exact referenced rows. The
Website runtime catalog must additionally retain every exact float32 HP and
script/trigger UID from these same 80 rows.

| Source SHA-256 | Present phases | waves | counts | freq | recipe UIDs |
| --- | --- | --- | --- | --- | --- |
| `2118053783606f5ef9dc848671d6eecd8e87aa0a3610c8c2119f08452e15a22f` | 2..7 | `42,51,62,67,77,81` | `6,8,7,10,10,10` | `2,2,3,3,4,4` | `36822,36826,36830,36834,36838,36842` |
| `9e9e1bccd99babf99e190ae4acdae98d1fea2f782b60ba6d45a6b9eae6afe2d9` | 1..7 | `24,41,50,57,66,75,81` | `3,6,5,8,7,9,12` | `3,2,2,3,3,4,4` | `36814,36829,36833,36837,36841,36845,36849` |
| `bd3c38468481b7337b1e7382e5503cc214356906571763a68188b23e821e73fb` | 1..7 | `22,50,59,64,70,78,86` | `3,4,5,8,8,8,10` | `3,2,2,3,3,4,4` | `35010,35027,35031,35035,35039,35043,35047` |
| `8c2f97d2ed54431987e3cb54b7ae3c1098bf1c4517f59ade6aea57759187adb0` | 2..7 | `46,51,62,69,75,89` | `5,7,8,8,9,10` | `2,2,3,3,4,4` | `37334,37338,37342,37346,37350,37354` |
| `bec9377cf539bb193e8af6ad72fa78a5e47e44206a1fef4d6bf3bfbda3f04a08` | 1..7 | `23,40,54,57,64,72,84` | `3,4,8,7,10,8,12` | `3,2,2,3,3,4,4` | `36828,36845,36849,36853,36857,36861,36865` |
| `ec2b27a1415c944c233158da8c21324760cd896e1228143aa18d262f65fa2a45` | 1..7 | `24,42,49,59,65,74,86` | `3,4,5,9,9,8,9` | `3,2,2,3,3,4,4` | `37383,37400,37404,37408,37412,37416,37420` |
| `624b79ae325daa714b24017e0a308c64519f7481eb206e4489968217b1a2e123` | 2..7 | `46,54,64,69,80,83` | `6,6,8,10,8,11` | `2,2,3,3,4,4` | `37403,37407,37411,37415,37419,37423` |
| `e62e5e847562d822382fba14709d5367c9cd7de40f8b4fa52ecea3bfc8d9a430` | 1..7 | `28,46,53,61,72,76,84` | `3,7,6,6,7,10,11` | `3,2,2,3,3,4,4` | `37383,37400,37404,37408,37412,37416,37420` |
| `506200e6f89dd26150c7fcc76f5cddfdb321412657ac979ea5924b567b4a2933` | 1..7 | `26,51,59,61,73,83,86` | `3,4,5,9,7,8,10` | `3,2,2,3,3,4,4` | `37471,37488,37492,37496,37500,37504,37508` |
| `cd4d1ba948ca6624fffb967b02b7c93a6d00cbf9b5ec2c4541330b0616a1c239` | 1..7 | `27,48,53,59,71,79,85` | `3,7,8,8,7,10,9` | `3,2,2,3,3,4,4` | `37361,37376,37380,37384,37388,37392,37396` |
| `efa240ce741df0f781228206d024bb1903c7210d1163eccf80c87e835365422f` | 2..7 | `48,51,63,73,80,83` | `4,8,8,8,11,9` | `2,2,3,3,4,4` | `37348,37352,37356,37360,37364,37368` |
| `1be4c308ccd442d70060cc66e3daa7b073faf035fd92d6b49fad4c33a91ef0c1` | 1..7 | `22,42,54,58,67,77,88` | `3,6,5,6,7,8,11` | `3,2,2,3,3,4,4` | `37397,37416,37420,37424,37428,37432,37436` |

### System boundary and membership inventory

Native/web system: **default-survival Deep Portal objectives and their owned
Imp ejections**, from generated type-2 trigger admission through script timing,
Portal recipe/materialization, child creation, objective count, damage/death,
render/light/audio, save/replication, phase release, and run teardown.

| Member / branch | Native source | Disposition required by this pass | Proof contract |
| --- | --- | --- | --- |
| 80 generated Portal recipe rows | twelve-source SyncBuffer census; serializer `0x0063E890` | `exact-ported` | exact source SHA, name, recipe/script/trigger UID, float32 HP, frequency, start wave, count, policies, damage, drops, classification, and family fields |
| Optional phase-1 presence | generator branch `0x006365AF..0x0063694B` | `exact-ported` per source | eight sources include phase 1; four do not synthesize it |
| phase-1 manual timeline barrier | commands `0x42D`, `0x3EA`, `0x408/409`, `0x3EE`, `0x435/436`, `0x434`, `0x3EB` | `exact-ported` for Portal timing/count/release | pause before ordinary burst, exact 100/50/25/100/200-tick waits, three light births, boss-count polling, next-wave start, and unpause |
| Solomon_Dig cleanup and Solomon_DriveBy command | commands `0x43C/43D/43B`; DriveBy type 5020 | `out-of-system`: separate Solomon NPC/navigation/presentation system | preserve command envelope timing; do not describe omission of the flyby actor/`SAY_SOLOMON_TROUBLELAUGH` as Portal parity |
| phases 2..7 | source-specific type-2 triggers and six scripts | `exact-ported` | exact trigger labels; dark placement; exact counts and 25-tick cadence; ordinary timeline continues |
| Portal constructor/materialization | `0x0047BD60`, `0x00483480`, tick `<10` | `exact-ported` | radius 45 placement, target heading, tick-9 radius 5 rewrite, OpenPortal cue, active boundary |
| all six frequency presets | config/tick table | `exact-ported` | integer tick endpoints, initial offset, inclusive reset, and one-in-eight fast reset draw order |
| Portal child Imp | `0x00489CC0 -> 0x005B7080/0x0063F6D0` | `exact-ported` plus named safety correction | exact raw geometry, inherited damage/team, flight values, identity placement when valid, corrected domain/collision/connectivity only when invalid |
| Portal body render and light | `0x004A1B30`, `0x004A1CB0`, `0x0047BED0` | `exact-ported` | DeadHawg 18,22,46..77,180..199; exact phases, scales, alpha, light radius/intensity/flag |
| Portal damage presentation | `0x0048C370` | `exact-ported` | hurt cue pitch, latch, BadGuys 401..419, hit overlay, no movement/action invention |
| Portal terminal presentation | `0x004A1FA0` | `exact-ported` | PortalDie cue, BadGuys 27 and 1823..1833, DeadHawg records 120/144, reward/drop, boss-count decrement, retirement order |
| boss-count gate | `DAT_00819850`, `0x00681930`; common ctor/dtor writers | `exact-ported` | Portal classification increments/decrements; child Imps never contribute; no timeout or auto-kill |
| general spawn connectivity | entries 72/273 plus corrected Mac falsifiers | `exact-ported` Website safety invariant for every materialized hostile | valid root remains identity; invalid/disconnected root retries through the same world-owned resolver and actor clearance; no symptom-only Portal exception |
| generated combat-bound confinement | entry 95 active-region owner | `verified-already-at-parity`, now consumed by Portal/children | no parent or child enters retired entrance strip after transition start |
| protocol, late join, save/restore | authoritative store and entity replication | `exact-ported` | Portal actor/brain, countdown, phases, emitted child IDs, trigger cursor, pause state, and boss wait survive snapshots/continuation; clients never schedule |
| pause, level-up barrier, Game Over, new run, disconnect/rejoin | existing world lifecycle | `exact-ported` | every Portal/script/child clock holds with authority and no state crosses world replacement |
| Portal native boss-prefix HUD | separate guarded HUD owner already dispositioned in entry 132 | `out-of-system`: featured-enemy UI is not the Portal producer or phase gate | no invented Portal-only DOM badge |
| PortalGroan grouped variants | audio registry rows 201/202, no Portal method reference in the recovered call graph | `out-of-system`: dormant for this actor path | direct cues remain OpenPortal, fireballhit, hurtportal, PortalDie |
| custom/mod TriggerControl bytecode | opaque authored section 1 | `out-of-system`: general Bonedit interpreter remains separate | default extracted programs only; no inferred mod triggers |

No member is blocked by the browser platform.

### Recovered behavioral contract and correction

- Start-wave triggers are source-authored one-shots. They are independent of
  player level and of the 42 parsed `wave.txt` rows. The optional first phase
  is a real timeline barrier; later phases are concurrent scripted bursts.
- Portals are stationary bosses. Their initial 45-unit body is the placement
  body; tick 9 rewrites the active/contact body to 5. The boss count, not total
  monster count, releases the first phase. An unreachable Portal must never be
  hidden by auto-retirement, a watchdog, or counting its children instead.
- Native child ejection is preserved through the raw-root computation. The
  executable's missing post-ejection placement is incidental stock debt that
  the browser must not preserve: accept the raw root byte-identically only when
  it is within the authoritative combat domain, collision-valid, half-unit
  mobile, and connected to at least one eligible player/fallback focus.
  Otherwise perform the existing deterministic actor-radius placement retry.
- The same connectivity predicate applies to ordinary wave, terminal-child,
  custom-recipe, Coffin, Slumpgut, Portal, and Portal-child materialization.
  The report falsified local mobility as a complete shared admission contract.
  Demon uses clearance 50; ordinary mobile actors use 25; stationary Portal
  objectives prove player-radius-25 access to their accepted component.
- Existing active-region policy remains intentionally stricter than stock dark
  placement. It prevents a Portal root in the retired entrance strip before a
  child exists. This is the recovered cause class for the native exterior
  report; it is not evidence for clamping arbitrary live actors afterward.
- Valid placement consumes no correction RNG and changes no identity, target,
  heading, recipe, actor/event ID, or creation order. Invalid placement may
  consume the established placement RNG but may not drop an accepted Portal or
  child, advance the phase, or rewrite its authored recipe.

### Web implementation and validation contract

- Check in one complete source-SHA-keyed Portal catalog and closed kernel for
  phase triggers, script clocks, recipes, frequency state, raw ejection, and
  exact child flight initialization. Missing source SHA or missing authored row
  fails closed.
- Add Portal as a closed enemy family through config, store, renderer, assets,
  audio, protocol, save, Lua/ML observers, targeting, damage, rewards, and
  teardown. Do not special-case the reported scene in React or the camera.
- Red/green coverage must pin all 80 recipe rows and every trigger/count;
  optional phase-1 membership; pause/release and boss-only count; all six
  frequencies and reset branches; radius `45 -> 5`; target/no-target heading;
  Portal damage/death/audio/render/light; child inherited damage and flight;
  parent/child identity placement; all twelve geometry templates; disconnected
  Portal and child roots; every sibling spawn path; save/restore, late join,
  pause, Game Over, and new-run teardown.
- On the exact Mac candidate, rerun the corrected 2,201,112-root matrix and a
  source-catalog phase replay. The candidate must retain every valid raw root,
  correct every invalid/disconnected root, and never cross combat bounds.
- Built Mac Chrome must trigger one authentic source's optional first phase,
  observe timeline suspension, three rendered/lighted Portals, OpenPortal and
  fireballhit cues, independently replicated ejected Imps, damage/hurt audio,
  one Portal death/PortalDie path, boss-count release only after all three die,
  resumed ordinary waves, and empty page/console/response/wire arrays. It must
  then exercise one later dark multi-Portal phase and record no exterior or
  disconnected parent/child samples.
- The exact candidate must pass
  `/opt/homebrew/bin/bash ./scripts/validate.sh`. Push, deployment, and live
  production proof remain separately authorized receipts.

### Website implementation and validation receipts

- Implemented on the isolated Website branch
  `codex/imp-bounds-portal-wave-20260830-root`, rebased onto current
  `origin/main` `375b229d657a9151e0a4db0d792bd85d97577cf3`. Mod Loader remained
  read-only.
- The source-SHA catalog retains all twelve generated programs, 80 exact phase
  rows, eight optional first phases, six frequency presets, and canonical JSON
  SHA-256 `9cc23e2bf95af4779ce835c4199ab018483aa0259f046c8c067a94f3db9ea7f9`.
- Website runtime now owns type 5021 as a stationary multiple-boss family,
  the first-phase timeline barrier and later concurrent phases, boss-only
  release counting, 45-to-5 materialization, exact Imp frequency/reset state,
  raw child geometry and flight inheritance, reachable placement admission,
  Portal render/light/hurt/death state, exact stock WAVs, compact replication,
  save continuation, and protocol 113.
- A final read-only static spot-check of `0x004A1FA0` corrected the terminal
  decal census to exactly DeadHawg records 120 and 144. The twelve
  BadGuys-27 black-smoky bouncers and BadGuys 1823..1833 array remain separate
  native children.
- The final rebased candidate was staged byte-for-byte between the local
  commit and
  `/Users/jarrett/codex-acceptance/imp-portal-push-main2-20260830-root/Website`
  before the complete validation gate.
- The final 2,201,112-combination Mac geometry replay observed 30,571 legal
  Portal roots, 4,624 collision-invalid child roots, 4,032 roots immobile on
  all four half-unit probes, zero exterior roots, 2,196,488 byte-identical
  accepted roots, 4,624 corrected roots, and zero correction failures.
- Focused Mac typecheck, Portal kernel/store/director/world, audio, renderer,
  lighting, replication, save, and mod-host tests passed. The strict lint,
  architecture boundary, ML schema, and generated Web Lua checks passed with
  no errors.
- On the exact Mac candidate,
  `/opt/homebrew/bin/bash ./scripts/validate.sh` completed successfully through
  backend build, 28 Python contracts, every frontend/desktop suite, production
  frontend and game-host builds, the game bundle budget, and production media
  policy.
- Built-Chrome acceptance selected source
  `9e9e1bccd99babf99e190ae4acdae98d1fea2f782b60ba6d45a6b9eae6afe2d9`.
  `Deep Portal` produced three bosses exactly 25 ticks apart, held the ordinary
  timeline while any boss lived, ejected one independently replicated
  damage-2 Imp with a valid route, played `portal-open`, `fireball-hit`,
  `portal-hurt`, and `portal-die`, released after the final Portal despite the
  ordinary child class, then produced all six authored `Deep Portal 2` bosses
  without pausing. Page errors, failed responses, wire decode errors, and
  outside-combat enemy samples were all empty.
- This candidate is locally committed and validated. Publication is recorded
  separately by Git history and the task handoff; deployment and
  live-production proof remain separately authorized receipts.
