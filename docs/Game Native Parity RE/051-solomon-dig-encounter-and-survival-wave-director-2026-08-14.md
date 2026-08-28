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
