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
