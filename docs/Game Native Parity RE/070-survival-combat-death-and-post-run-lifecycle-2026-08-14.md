# Survival combat, death, and post-run lifecycle — 2026-08-14

## Reported smell and parity question

The Solomon Dig and retail wave work materialized accurate encounter state and
enemy spawn compositions, but the spawned records were immutable presentation
snapshots. They had no evaluated stats, actor brain, locomotion pose, attacks,
projectiles, health, death, rewards, or natural retirement. The opening fifteen
Skeletons therefore could not reduce the live population below the TimeLine's
first `< 4` gate. In the same incomplete seam, player health/mana were inert
book values and `/game` had no player-death, spectator, Game Over, or new-run
owner.

The parity question is not merely how to make the actors move. It is which
owner advances the complete fixed-tick chain from Solomon contact through wave
spawning, enemy/player combat, death and retirement, all-dead arbitration, and
same-session post-run loadout without letting render cadence or sparse network
snapshots create gameplay events.

## Evidence and provenance

- Retail executable: Beta 0.72.5 `SolomonDark.exe`, SHA-256
  `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`.
- Static evidence: existing analyzed Ghidra project plus read-only replicas of
  `BuildEnemyConfig 0x0046B390`, default config constructor `0x00640240`,
  family ticks/actions/renderers, projectile owners, PlayerWizard damage/death,
  and Game Over functions.
- Live/durable evidence: the Mod Loader reports for Solomon/waves, enemy
  behavior, animation, targeting, movement, projectiles/spells, progression,
  player death/spectator, and Game Over/session semantics. Their integration
  synthesis is `docs/reverse-engineering/native-web-combat-lifecycle.md` in the
  Mod Loader repository.
- Asset evidence: complete checked-in BadGuys, Demon, and DeadHawg manifests;
  exact Solomon cue bytes; Clothes player-death records and GameOver record
  rectangles recovered from the stock bundles.

## Native ownership and fixed-tick relation

```text
late Dig contact
  -> target-only control lock and serialized Solomon dialogue
  -> SOLOMON RUNS event
  -> wave TimeLine emits spawn requests
  -> enemy actor store materializes evaluated configs
  -> targeting / motion / action marker / projectile / contact
  -> enemy HP <= 0
  -> family death outputs, reward, delayed retirement
  -> authoritative live count releases the wave gate
  -> player HP <= -10
  -> one player death epoch
  -> spectator while another eligible participant lives
  -> all-eligible-dead terminal event
  -> Boneyard Game Over
  -> automatic tick-1000 acceptance and 400-tick exit fade
  -> same-session return to retained-choice loadout
```

The wave director owns only schedule state and deterministic spawn intents.
The Boneyard enemy actor store owns live actors, children, projectiles, HP,
brains, death, rewards, and retirement. The session host owns player ECS,
eligible-run membership, the run nonce/phase, and once-only all-dead decision.
The protocol entity registry owns immutable descriptors and compact samples.
Clients interpolate continuous lanes only; they cannot select targets, infer a
contact/death/audio event, or reconstruct missed cadence.

The browser 100 Hz authority order is input gates; player movement/collision;
living-player-filtered Solomon/run edge; existing enemy brains, movement,
action markers, projectiles/effects, death outputs and retirement; wave gating
against that post-store live count and spawn-intent materialization; contacts,
mana and damage; player death epoch and all-dead evaluation; bounded snapshot
and semantic-event publication. Newly materialized actors begin stepping on
the following tick. Family marker ordering overrides any generic phase when
the recovered native action program requires it.

## Recovered combat contract

- Default HP/primary damage are Skeleton `5/3`, Archer `5/4`, Mage `5/3`,
  Imp `1/3`, Zombie `105/35`, Wraith `2/4`, Demon `400/20`, and Coffin
  `100/no default primary write`. Common chase/attack/scale are `1/1/1`; Mage
  chase is `0.8`. Coffin children default to max 20, HP 2, damage 2, poison 0.
- `BuildEnemyConfig` applies exact flag transforms before actor materialization:
  HP up/down `1.5/0.5`, strong/weak `1.5/0.5`, fast chase `1.25`, slow
  chase/attack `0.5`, burning chase/attack `1.5`; recovered equipment,
  elemental-cast, rotten, split, arrow, and Maggot transforms retain their
  family lanes. Source-only `IGNITE` and `IMMORTALIZE` remain inert.
- Constructor collision radii are Skeleton `20-random(8)`, Archer 20, Mage 25,
  Imp `10-random(2.5)`, Zombie `25-random(8)`, Demon 35, and Coffin 45,
  followed by recipe scale. Wraith's inherited radius and family attack reach
  remain separate open evidence.
- Target choice is host-authored nearest living eligible participant, refreshed
  on recovered 3/10-tick modes plus missing-target/25-tick lanes. A target uses
  semantic participant identity, not a peer-local ActorWorld slot. Dead or
  disconnected targets are reacquired deterministically.
- Common motion scales the normalized direction by
  `0.25 * configChase * actorSpeed * actorScale * cadenceTicks` and passes
  actor separation/world collision. Client presentation may interpolate those
  authoritative positions.
- Exact nominal Skeleton action boundaries at attack speed one are claw first
  marker 32/completion 57, ordinary weapon 36/97, Pike 16/97; Archer is
  155/190. Fresh read-only decompilation of `SkeletonAction_Tick 0x0044BC20`
  shows inclusive circular crossing checks through `0x00410E40` for both claw
  markers `4.0` and `8.0`, after completion wraps progress by `end + 1.0`.
  Consequently the accepted claw action that begins at native fixture tick
  101 emits three independent 3-damage contacts at ticks 133, 134, and 161:
  arrival at marker 4, departure from the inclusive marker-4 boundary, and the
  marker-8 wrap edge. Each crossing must emit its own semantic marker and
  re-check the staged target/reach; an action pose or one-shot Boolean is not
  damage authority. Mage owns its variable short/long cast program. The other
  families retain distinct approach/special/cooldown/death brains; they must
  not become cosmetic Skeleton aliases.
- Enemy lethal is `HP <= 0`. Family terminal outputs and the one reward execute
  before retirement. Baseline XP is Skeleton/Archer/Mage 10, Imp 2, Zombie
  210, Wraith 4, Demon 800, Coffin 200, Maggot 0. Wave live count changes only
  after that terminal presentation/bookkeeping boundary.
- Fresh player HP/MP are 50/100. Native general recovery is `0.001` HP and
  `0.1` MP per tick, with MP capped by maximum minus hoarded mana; level-up
  refills both. Rank-one primary costs are Ether 6, Fire 12, Air 12/second,
  Frost 12.5/second, and Boulder 12/second. One-shot casts debit once;
  channels debit authoritatively per fixed tick and stop before materializing
  an unaffordable continuation.
- Internal player HP may cross zero. Only `HP <= -10` arms the one-tick terminal
  countdown. The wire/HUD may clamp display HP to zero only because explicit
  life state, death epoch, and death tick remain authoritative. Dead input and
  casts are rejected before dispatch or publication.
- Player corpse frame zero is held through death tick 152; frames 1, 2, and 3
  select at 153, 156, and 159. Tick 159 also owns the additive burst. One dead
  participant spectates while any other eligible player lives. Only all dead
  emits one replay-safe Game Over event for the run nonce.

## Animation, projectile, and asset consequence

BadGuys, Demon, and DeadHawg already contain the required enemy action,
projectile, and terminal records; extraction is not repeated. Runtime asset
selection/preload expands to the recovered ranges. Enemy samples carry action,
pose/gait, alpha/fade, articulation, hit overlay, death epoch/tick, and child/
effect identity so render code samples state instead of advancing it.

Skeleton/Archer/Mage consume their exact recovered action arrays and marker
boundaries. Imp retains flight/bob/effect state; Zombie retains body/head/arms
and Rotten branches; Wraith retains orbit/fade; Demon retains articulated
joints and bomb/split; Coffin retains hidden/rise/hold/open and Maggot child
states. Projectiles are stable authoritative actors: Arrow `0x7DA`, Firebolt
`0x7EB`, GuidedMissile `0x7EC`, DemonBomb `0x7F7`, and PoisonPool `0x806`.

Player death additionally requires Clothes records 28..99 with registration,
extras, and points. Boneyard Game Over is natively fade-only; the separately
recovered GameOver records remain useful for story mode but are not inserted
into this survival surface. The exact DeathGuitar stream and existing `death`
module are semantic death/Game Over audio, not snapshot-derived ambience.

## Solomon failure and run-lifecycle correction

The already implemented strict final-ten-frame ellipse, target selection,
voice durations, turn, mouth, 25-tick hold, laugh/taunt, run event, and wave
handoff remain the authority. The repair adds deterministic handling when the
acquired target dies or disconnects, keys voice/event cursors by run nonce, and
stops encounter streams on run transition. The exact global dialogue-owner
interaction, 4096-unit preclipped escape ray, generated four-second camera
script, and host migration remain recorded fidelity limits rather than hidden
fallbacks.

## Deliberate post-run product deviation

Native Boneyard Game Over is a fade-only surface. Its tick method synthesizes
acceptance automatically when the surface counter becomes exactly 1000; no
player input owns that edge. The accepted state runs a 400-tick exit fade,
then traverses native cleanup, front-end/Hall of Fame/MainMenu ownership, and
finally Create. The preceding element and discipline are preselected but still
require confirmation.

For this requested web milestone, completed Game Over returns directly to the
retained-choice Create/loadout screen while keeping the authenticated
session/lobby alive. Skipping Hall of Fame/MainMenu is an explicit product
deviation, not a native-parity claim. A new run nonce resets Solomon, waves,
actors/children/projectiles, player placement/cast/life/status, replication
baselines, interpolation buffers, views, event cursors, and audio loops while
retaining identity and loadout preselection. The earlier progression-book
retention was superseded by the 2026-08-26 post-Game-Over generation correction:
the confirmed Create choice now owns a fresh skill/progression generation.

## Confidence, approximations, and open evidence

- Confirmed high: causal owners; Solomon handoff; wave/live-count split;
  default enemy stats and flag transforms; target authority; exact
  Skeleton/Archer action boundaries; HP thresholds; resource defaults and
  recovery; player corpse boundaries; spectator/all-dead semantics; native
  Boneyard Game Over automatic transition and retained-choice Create ownership.
- Safe bounded web contract: deterministic family-specific action timing where
  an exact native program remains unresolved; interpolation of authoritative
  continuous state; exact PCM duration for Solomon's isolated serialized cue;
  direct completed Game Over-to-loadout as the named product deviation.
- Still open: exact Imp/Zombie/Wraith/Demon/Coffin action programs and several
  terminal clocks; Wraith radius/attack reaches; upgraded HUD denominator;
  every welded spell debit edge; Solomon global-dialogue/camera/ray details;
  host migration; custom Boneyard script/boss execution.

## Pre-implementation falsifiers and acceptance contract

- The wave director has no mutable enemy records after the actor-store cutover.
  Spawn, retirement, and live-count gates are covered independently.
- Enemy entity replication covers descriptor/sample quantization, spawn,
  retire, periodic keyframe, missing baseline, stale/gap recovery, late join,
  and run-nonce reset.
- Fixed-kernel tests cover every flag, targeting/reacquisition, collision,
  per-family action/special/death state, projectiles, mana debit/recovery,
  spell contact/damage, lethal thresholds, once-only reward, delayed
  retirement, and wave continuation.
- Protocol/host tests cover dead/picker/Solomon input suppression, individual
  spectator versus all-dead terminal, automatic acceptance and exit-clock
  invariants, rejection of the retired terminal message, same-session retained
  loadout, and a clean second run.
- Render/asset/audio tests cover legal enemy records/layer order, locomotion and
  action poses, hit-without-body-reset, player corpse boundaries, semantic
  once-only audio, and no historical replay on late join.
- Chromium proof must physically trigger Solomon, hear/observe the ordered
  cues, see visible enemies move/attack, spend mana and damage/kill an enemy,
  observe enemy and player death, continue after one multiplayer death, reach
  all-dead Game Over, observe the input-free native hold and exit fade into
  retained-choice loadout, and begin a second clean run with no page/console
  errors.
- Completion requires `./scripts/validate.sh` plus the focused skill-picker,
  primary-spell, wave, collision, audio, and combat lifecycle smokes, followed
  by a residual scan for duplicate authorities, inert combat fields, generic
  enemy timing, local Game Over routing, stale run cursors, and PoC lifetime
  retirement.

## Implementation receipt (2026-08-14)

- Protocol 18 separates the wave schedule from replicated enemy actors and
  carries the bounded run-scoped enemy semantic-event lane.
  The director emits stable spawn intents; `boneyard-enemy-store.ts` owns
  evaluated actor configs, targets, brains, movement, contacts, projectiles,
  children, HP, death epochs, rewards, and delayed retirement. Enemy,
  projectile, and Maggot descriptors/samples use entity types 2, 3, and 4;
  snapshot interpolation never recreates attacks or lifecycle events.
- All eight retail families now pursue a nearest eligible target through the
  authoritative Boneyard collision resolver and use family-specific action,
  special, projectile, hit, and terminal presentation. Skeleton, Archer, and
  Mage retain recovered marker programs; Imp, Zombie, Wraith, Demon, Coffin,
  and Maggot use the explicitly named bounded programs recorded above. Coffin
  openings materialize combat Maggots, and Imp/Demon terminal splits are
  authoritative child events rather than renderer-only decoration.
- Wave threshold decisions consume the actor store's post-retirement and
  post-terminal-child live count in the same tick. The browser diagnostic count
  includes Coffin Maggots, and Maggots carry the same authoritative damage
  flash and once-only death-before-retirement lifecycle as the larger actors.
- Primary casts consume authoritative mana and preserve each native query
  family instead of routing spell actors through swept-circle contact. Fire
  and Ether use post-move, single-cell point queries with radii 20 and 6 plus
  the candidate body radius. Water uses the strict root-only 205-unit cone;
  Earth gathers distinct roots strictly inside `75*charge`; Air contacts only
  its selected flags-bit-two endpoint. Terrain remains core-owned at the
  recovered birth/lookahead/flight stage. No primary projectile retains the
  obsolete 500-tick PoC lifetime.
- Air and Water finite rays stop at the first authored world/gate contact,
  with terrain winning an exact path tie. Enemy arrows, bolts, missiles, and
  bombs likewise compare swept player contact against authoritative world
  contact before damage; stationary PoisonPool ownership remains a separate
  bounded status lane. Channel damage consumes one semantic Air/Water emission
  per authoritative cast tick rather than counting presentation actors, so the
  two native Water particles still apply one damage tick and Fire/Earth visual
  transients can never become phantom rays.
- Player combat now owns 50/100 fresh HP/MP, native recovery, poison, the
  `HP <= -10` lethal edge, corpse frames, once-only death events, input/cast
  suppression, spectator state, and all-dead arbitration. Overlapping poison
  pools currently merge by strongest DPS and longest remaining duration as a
  deterministic bounded web policy; exact native poison stacking is still
  open. Poison-created lethal pending state survives until the following tick
  begins the explicit death epoch, so Game Over cannot precede death. Wave
  scheduling pauses while there is no living eligible target.
- Game Over remains host/run-nonce authoritative and once-only. Automatic
  completion returns to retained-choice Create without closing the
  authenticated session; confirming the loadout creates a fresh run nonce and
  resets all run-scoped combat, replication, presentation, event, and audio
  state. This is the deliberate post-run product deviation documented above.
- Solomon contact is again a real gameplay edge: strict proximity triggers one
  seeded hello, the recovered turn/speech/hold cadence, laugh then
  `get-him-boys`, retreat/escape animation, and the wave handoff. Target loss
  reacquires an eligible player; dead and spectating participants cannot
  trigger or retain the encounter. Run-scoped voice cursors and streams are
  torn down instead of leaking into the next run.
- The canonical `./scripts/validate.sh` gate passes on the integrated tree:
  Release backend build, 23 backend/contract tests, formatting, lint and game
  boundaries, all `538/538` frontend game tests, production frontend/game-host
  build, and production-media policy. Standalone lint and production build
  also pass; lint reports only the repository's existing Fast Refresh warnings.
- A real Chromium single-player journey at `1600 x 900` physically reached
  Solomon, observed `hello-1`, `laugh-1`, and `get-him-boys`, then saw all 15
  opening Skeletons materialize with locomotion and both claw actions. A Fire
  cast spent mana from `100` to `89.4`, reduced one Skeleton from `2.5` to
  `-1.5`, and retained its death state. Enemy contact drove the player from
  positive HP through display zero, corpse/death audio, Game Over, the retained
  Fire loadout, and a second active run with a different nonce, restored
  `50/100` HP/MP, and no console or page errors. Captures are
  `/tmp/solomon-dark-final10-combat.png`,
  `/tmp/solomon-dark-final10-death.png`,
  `/tmp/solomon-dark-final10-game-over.png`, and
  `/tmp/solomon-dark-final10-loadout.png`.
- A separate real two-client Chromium journey physically crossed the gate and
  triggered Solomon before 15 Skeletons spawned. One player reached spectator
  while the survivor remained active at 20.922 HP; spectator movement and mana
  stayed unchanged. After the survivor died, both peers observed the same Game
  Over, both followed the host-authored automatic clock into retained loadouts,
  only the host could confirm, and both returned to a two-player Hub with empty
  console/page-error captures. Captures are
  `/tmp/solomon-dark-final-multiplayer.lEnWnX/solomon-dark-multiplayer-first-death.png`,
  `/tmp/solomon-dark-final-multiplayer.lEnWnX/solomon-dark-multiplayer-game-over.png`,
  `/tmp/solomon-dark-final-multiplayer.lEnWnX/solomon-dark-multiplayer-loadout.png`,
  and `/tmp/solomon-dark-final-multiplayer.lEnWnX/solomon-dark-multiplayer-returned-hub.png`.

## Residual combat audit correction (2026-08-14)

The implementation receipt above records the first integrated lifecycle pass,
not completion of every runtime consumer. A clean-tree residual audit found a
shared interpreter failure: several values were evaluated faithfully into the
enemy config or skill book but stopped at that boundary. The native evidence
and implementation consequences are now explicit before the repair:

- High confidence: retail Archer arrow payload, aim mode, and range; Mage
  element status, range, self shield, ally shield, strength, and interval; and
  Wraith Dazzle are live behavior fields, not definition-only metadata
  (`native-enemy-behavior.md`, fields 9, 10, 18, 20, 32, 33, 34, 36, and 42;
  Skeleton-family transition rows). Retail waves exercise these flags. The
  actor/projectile/status stores must consume them and replication must retain
  every presentation-relevant subtype. Exact closed-form Archer scatter/random
  aim and family range-mode formulas remain open; any temporary deterministic
  formula must be named and tested rather than leaving the mode inert.
- High confidence: Wraith tick `0x00486C30` constructs `Mod_Dazzle` type
  `0x1B6E`, initializes progress at modifier `+0x1C = 0`, and writes duration
  `+0x14 = 0x32` (50 ticks). `Mod_Dazzle::Tick 0x00623490` advances that
  progress by the merged `+0x20 = 1 / duration`, clamps it to one, and
  multiplies the target actor's shared movement/status scalar at `+0x120` by
  the recovering progress. The authoritative web consumer must therefore use
  a 50-tick movement recovery ramp; a diagnostic-only timer, stun, or constant
  slow is rejected.
- High confidence: a Coffin invokes its Maggot helper three times on the open
  edge, then replenishes owned children while below its configured maximum;
  Maggots have an emergence/ballistic phase, crawl, one bite, and self-death,
  and invalid parent ownership cleans them up. The one-shot golden-angle burst
  is rejected. Exact launch-vector distributions and every replenishment timer
  constant remain open, so their web bounds must be centralized and visible.
- High confidence: hostile and player circles participate in the same actor
  contact domain, and an action marker stages contact against a still-valid
  target. Player movement must not pass through hostile bodies. Marker damage
  must re-check target identity and contact/reach at the marker tick; entering
  windup is not permanent authorization to hit a departed or newly acquired
  target. Exact per-family weapon shapes remain open, so the existing named
  center-distance reaches remain the temporary contact geometry.
- High confidence: each primary spell's effective skill-book rank indexes the
  catalog mana and damage arrays. One-shot payloads capture their value when
  emitted; channels consume rank-indexed per-second cost and damage at 100 Hz;
  Boulder multiplies its rank-indexed base damage by authoritative charge.
  Rank-one constants are valid fixtures, not a runtime authority after an
  upgrade.
- High confidence: semantic attack/death/projectile/terminal events are already
  host-authored and replay-safe, but a scene consumer is required for their
  once-only audio/effect consequences. Authoritative effect samples cannot
  remain permanently empty where the actor store has emitted a recovered
  terminal or attached-effect state. Exact unresolved family sprite clocks
  remain labelled bounded-web; that label is not permission for a dead event
  lane or an unreachable effect renderer.
- High confidence: multiplayer ally health is the remote participant's
  authoritative `currentHealth / maximumHealth`, clamped only for display; a
  constant-full bar discards already-replicated combat state. The native player
  corpse selector changes at death ticks `153`, `156`, and `159`, while the
  production transport normally samples every five simulation ticks. Client
  presentation may interpolate `deathTick` only when both snapshots already
  share the same non-alive death epoch. All other progression remains discrete,
  so the cadence repair cannot manufacture an alive-to-death transition.
- High confidence: native multiplayer spectator follow is client-local
  presentation, not host camera authority. `death_spectator_sync.inl:554-613`
  rebuilds living, ready, connected, same-run participants, sorts semantic
  IDs, preserves the current target, and cycles/wraps on either mouse edge;
  `:615-674` holds a selected participant through its replicated death
  presentation before retargeting; `:697-806` focuses that target's exact
  gameplay coordinates; and `:808-841` begins follow only after the local
  death-presentation phase completes. Organic host-death evidence in
  `native-player-death-spectator.md:817-824` confirms selection of the sole
  living client and exact-coordinate camera focus. New run, respawn, run end,
  and all-dead Game Over clear the local focus. A camera left on the local
  corpse after `spectating` is therefore an incomplete consumer, not an
  acceptable bounded parity gap.
- High confidence: the Skeleton, Archer, and Mage terminal paths call fixed
  registry sound `79`, `sounds\\skeleton_die` (`0x0048D368`, with the sibling
  Archer/Mage branches at `0x0049E9AF` and `0x0049FD5F`). The client must
  consume the host-authored family terminal-output edge once and play that cue;
  it must not infer a death edge from an interpolated health sample or replay
  retained history to a late joiner. The `/game` cue is backed by the untouched
  stock `sounds/skeleton_die.wav` PCM bytes, SHA-256
  `ab38f903e828bd695ffd153dfacea5701f36376ad24cb96be96d3d059f52fb18`,
  rather than the older resampled Website MP3.
- High confidence: the runtime architecture document must describe protocol 14
  (or its next deliberate bump) and replicated Boneyard entity types rather
  than the obsolete student-only protocol-11 state.

Acceptance for the correction is adversarial: an upgraded primary must change
both debit and damage; a target leaving melee reach before the marker must take
no damage; player/enemy circles must separate in both mover directions; every
retail Archer/Mage/Wraith modifier must have a runtime consumer test; Coffin
children must emerge in bounded batches, replenish, and retire with their
parent; and at least one real host-to-client semantic event must drive a
visible or audible scene effect exactly once.

### Cadence-safe Mage lightning and player death burst

The residual presentation audit found two fixed-tick edges that a five-tick
snapshot interval can skip even though their authoritative clocks are correct.
The first interpretation of the Mage edge was materially wrong and is
superseded here:

- A `FLAG_CASTLIGHTNING` Mage does not create one four-tick `381/382` sample.
  Dispatch writes `+0x280 = trunc((100*0.5)/attackSpeed)`, which is 50 ticks at
  the default attack-speed scalar. `Mage::Tick 0x00490860` invokes the common
  Air factory `0x00531640` once on every active tick, then decrements the
  counter. Each birth is therefore a distinct two-tick LightningBolt with its
  own one-tick source glow, independent ribbon/branch buffers, and one age-zero
  path-MiscLight tail. BadGuys `381/382` belong to GuidedMissile and are never
  Mage-lightning art.
- The factory source is attachment zero of the current Mage body record,
  transformed at the actor root, then shifted `y-5`. The midpoint is exactly
  `(mageRoot+targetBase)/2`; it deliberately ignores the source attachment and
  endpoint jitter. The body endpoint receives an independent radial
  `U(10)` displacement. A second independent radial `U(15)` displacement
  owns the corona. A clear actor hit attaches that corona to the live target,
  uses scale `0.5+U(0.25)`, and fades by `0.4*attackSpeed`; a blocked/world
  endpoint stores an absolute corona point, uses scale `1+U(0.25)`, and fades
  by `0.2*attackSpeed`. Neither Mage contact path has a `ZAnimLit` wrapper or
  outbound contact light.
- The authoritative store must retain the channel countdown and every semantic
  pulse needed by the body/contact lifetimes. The 20 Hz snapshot stream must
  carry the recent pulse ledger, while the delayed presentation timeline
  admits each pulse only when its 100 Hz birth tick is reached. Reconstructing
  one sample from `actionProgress`, stretching a pulse to the snapshot interval,
  or replaying a future pulse early is invalid. Pulse payloads own source,
  midpoint, independently jittered endpoint, world or target-attached contact,
  birth tick, and semantic seed.
- `PlayerWizard::Tick` / `FUN_00533520` selects corpse frame three and creates
  the stock additive death burst at death tick `159`. Static inspection shows
  finite `Anim_FadeMoveAdditive_Perspective` children using the BadGuys inline
  record at object `+0x7E0`: with the `0x38` header and `0xC4` record stride,
  this is exact BadGuys entry `10`. The same function disables the actor's grid
  byte `+0x36` and writes render bias `+0xA0 = -1000`. Direction, scale, and
  velocity are randomized radially, but their exact constants remain open.
  Because the existing presentation timeline interpolates `deathTick` only
  inside one non-alive death epoch, the client can consume the `158 -> 159`
  crossing without another wire event. Initial snapshots and first-seen
  players seed the crossing state, repeated frames are idempotent, and new
  runs clear it.

The authoritative Boneyard collision phase must consume the death state that
the current fixed tick will publish. A player entering the tick at death tick
`158` is therefore absent from player/enemy collision resolution during the
same simulation step that publishes tick `159`, emits the death-burst edge,
and retires corpse collision. The later MP-mod parity reopening separates the
five-second spectator edge from this presentation crossing. Collision
membership may project that one pending death-clock advance, but it must not
commit lifecycle state early or reorder damage, burst, spectator, or all-dead
Game Over ownership. Integrated acceptance
places a living actor against the tick-158 corpse and requires the living actor
to take its unobstructed movement while the corpse position remains unchanged.

Implementation receipt: `playerCollisionEnabledAfterCombatTick` projects only
the pending pure combat tick for Boneyard collision membership. The integrated
fixture failed first by pushing the tick-158 corpse from x `250` to `250.6`,
then passed with the corpse at x `250`, the living actor at x `200.5`, published
death tick `159` without corpse collision, and kept the surviving run active.
The then-current spectator-state assertion is superseded by the 2026-08-23
five-second MP death-spectator reopening below. The
focused combat/world/simulation tests pass `32/32`; app/test TypeScript and the
supported lint/boundary gate pass. No browser flow was run for this phase-only
correction.

The named browser approximation for the open death-burst distribution is
`BOUNDED_PLAYER_DEATH_BURST_PROGRAM`: twelve deterministic radial copies of
exact BadGuys entry `10`, additive, lasting twenty presentation ticks, with
stable per-player/death-epoch phase, bounded radial speed, scale, and fade.
Those visual constants are not retail claims. The acceptance contract covers
all five default snapshot onset phases, strict protocol decode, every 100 Hz
Mage pulse without duplication or preplay, late-join reconstruction, run reset,
exact Mage Air-family records `44`, `110`, `375/376`, and `1836..1839`, exact
player-death record `10`, and finite teardown. GuidedMissile retains ownership
of `381/382`.

### Imp split depth and native live-cap correction

The protocol-capacity audit falsified the first Website interpretation of the
Imp family lane: `splitCount` was used as both the number of children and the
recursive generation count. At wave 42 that created a factorial expansion.
Fresh read-only Ghidra evidence against the supported retail executable closes
the causal chain:

- `BuildEnemyConfig 0x0046B390`, flag `0x16`, writes a remaining depth at
  recipe `+0x84`. With `q = trunc((wave - 25) / 5)`, it samples inclusive
  `[q + 1,q + 3]`; a first sample below two writes two, otherwise inclusive
  helper `0x00448450` supplies a second independent sample from the same range.
  The only retail uses are waves 35 and 42, so their depths are `3..5` and
  `4..6`.
- `Imp::Death 0x004824A0` reads live actor `+0x210`. It branches only when the
  depth is positive and live Imp global `DAT_00819914 <= 68`. The compiled
  angle loop starts at `-0x5A`, adds `0xB4`, and continues through `+0x5A`:
  exactly two children, not `depth` children.
- Both the raw Imp factory path `0x00462730(0x3EC)` and evaluated-recipe path
  `0x00463B50(parent +0x1D0)` explicitly overwrite child
  `+0x210 = parent +0x210 - 1` before `0x0063F6D0` registration. Both children
  therefore retain the same reduced recursive depth.
- `Imp::Imp 0x00473E30` increments `DAT_00819914` and marks constructions over
  70 deleted. Destructors `0x00473FA0`, `0x00474D90`, and `0x004784F0`
  decrement it. Because the death guard runs before the pair, 68 live Imps may
  become 70, after which further split attempts are suppressed.

The authoritative store must consequently keep depth separate from fan-out,
count dying Imps through retirement like the native constructor/destructor
counter, emit exactly two one-lower children when the 68 guard permits it, and
reject persistent Imp constructions above 70 from wave, Demon, and recursive
paths. Focused acceptance drives the worst retail wave-35 and wave-42 group
compositions through simultaneous recursive deaths and requires the live actor
array to remain below protocol capacity 8192, the Imp subset to remain at or
below 70, and nonzero reduced-depth grandchildren to remain observable.

The run-scoped `enemy-terminal-output.count` lane describes accepted terminal
child materializations, not an enemy recipe field. An Imp therefore publishes
two only when its remaining depth is positive and the live-counter guard admits
the native pair; depth zero or a suppressed split publishes zero. Demon outputs
likewise publish only the child Imps accepted beneath the shared construction
cap, which may be fewer than the configured five or fifteen. The terminal-output
event remains ordered before the corresponding child `enemy-spawned` events.
Focused event assertions must keep each published count equal to that step's
accepted `spawnedActorIds` for isolated Imp and Demon terminal paths.

Implementation receipt: the config evaluator now consumes the retail two-draw
formula and produces wave-35 depth `3..5` and wave-42 depth `4..6`. The enemy
store emits the two co-located children at parent heading `-90/+90`, carries
one-lower depth into both, counts dying Imps until retirement, suppresses a
split above 68, and refuses persistent Imp construction above 70 from every
spawn path. Its terminal event reports the accepted binary fan-out `2/0`
instead of remaining depth, while Demon reports its cap-clipped accepted child
count. Both outputs remain ordered before their child-spawn events. The
adversarial retail group fixtures reached exactly 70 Imps in both waves; total
retained actors peaked at 70 for wave 35 and 85 for wave 42, well below 8192.
Focused config/store tests pass `39/39`, test TypeScript is clean, the supported
Website lint/boundary gate passes with only the existing Fast Refresh warnings,
and the Loader lifecycle static contract passes.
