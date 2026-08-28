# 2026-08-15 — Player damage presentation and Wizard ouch audio

## Reported smell and parity question

- Reported web behavior: enemy damage changes player health and can enter the
  existing death lifecycle, but the living Wizard gives no visual or audible
  reaction.
- Stock behavior to recover: the nonterminal PlayerWizard receiver, including
  ordinary hit redraw, animation continuity, poison/suppression branches,
  Wizard ouch selection/cooldown/volume, terminal handoff, replication, and
  run reset.
- Reproduction inputs/scenes: every reachable Boneyard damage producer—melee,
  Arrow, Firebolt, GuidedMissile, DemonBomb, Mage lightning, Maggot contact,
  and PoisonPool/poison status—against idle, moving, and casting local and
  remote participants.
- Falsifiable questions: whether stock selects a hurt body strip, whether
  poison flashes or speaks, whether lethal hits speak, whether repeated hits
  restart the action, whether the ouch cooldown is per player or shared, and
  whether clients may derive the reaction from health deltas.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Clean stock | retail Beta 0.72.5 `SolomonDark.exe`, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` | One PlayerWizard damage receiver is shared by all element/equipment compositions. | high |
| Instructions | `0x0063E7D0 -> PlayerWizard vtable +0x4C -> 0x00548150 -> 0x0052F540` | Melee, projectile, and modifier contexts converge on host-owned health acceptance and the `-10` terminal threshold. | high |
| Instructions | `0x00627F80`, `0x00624AC0`, `0x00624B40`, player call `0x0052FDF1` | Positive primary/secondary damage arms a 20-tick source-over red redraw of the exact current living pose. | high |
| Instructions | `0x00627160` | Poison sets flags `0x88`, writes only tertiary damage, and reaches health/death without a visible red latch or ouch request. | high |
| Instructions | call `0x0053074A` inside `0x0052F540` | Nonterminal direct damage uses `Integer(3)`, then inclusive `Integer(20,60)`, a strict shared deadline, and the post-hit health gain curve. | high |
| Runtime | contiguous stock Wizard `idle -> hit_overlay -> idle` fixture | Damage presentation is orthogonal to the body selector and decays without restarting locomotion/action state. | high |
| Asset/data | audio registry 228..230 and stock `sounds/Wizard_Ouch` WAVs | The pool is exactly `SAY_OUCH1..3`; no synthetic browser cue is needed. | high |

Reusable native ownership and the complete branch table are recorded in Mod
Loader `docs/reverse-engineering/native-player-damage-presentation-and-audio.md`.

## System boundary and membership inventory

Native system: accepted PlayerWizard health damage from context dispatch through
living hit/audio presentation or terminal handoff. Enemy attack/projectile
birth and player death effects remain sibling owners.

| Member | Native source | Disposition | Proof required |
| --- | --- | --- | --- |
| Ordinary melee/contact primary damage | Player receiver plus common Actor reaction | exact-ported | accepted health delta, full-alpha tick, 20-tick decay, audio event |
| Arrow, Firebolt, GuidedMissile, and DemonBomb direct contact | same receiver after projectile contact | exact-ported | each producer reaches the shared reaction once |
| Mage direct lightning | primary/secondary context | exact-ported | shared reaction without a renderer-local inference |
| Maggot bite | common player receiver | exact-ported | direct bite flashes/speaks; applied poison does not |
| PoisonPool and poison periodic tick | `0x00627160`, flags `0x88`, tertiary lane | exact-ported | health changes with no red redraw or ouch event |
| Repeated direct hits | `0x00627F80`, global ouch deadline | exact-ported | visual latch refreshes while audio remains independently throttled |
| Direct overkill above `-10` | `0x0052F540` health owner | exact-ported | visible/display-zero living state can still react |
| Terminal direct damage | same owner, actor `+0x94`, death virtual | exact-ported | no ouch; death presentation supersedes living redraw |
| Idle, walk, and primary-cast body states | `0x0054BA80` plus common Actor redraw | exact-ported | exact underlying textures/offsets remain unchanged |
| Five element and current equipment compositions | shared PlayerWizard class | exact-ported | common duplicate body pass, excluding independent orb/shadow |
| Local and remote participants | host receiver and snapshot owner | exact-ported | replicated hit tick and run-scoped sound event |
| Fresh run / reconnect snapshot | actor/run reconstruction | exact-ported | no stale hit latch, deadline, event, or replay |
| Magic Shield absorption/pulse/break | player `+0x1C4/+0x1D0`, skills system | out-of-system | right-click skill activation and capacity are not reachable in the current ordinary-damage task |

“Out-of-system” for Magic Shield is an ownership boundary, not a visual
fallback. Ordinary health damage must not draw the shield shell or pretend the
right-click ability exists.

## Native ownership thread

- Owner and construction path: the host PlayerActor receives a staged native
  damage context; PlayerWizard progression owns health and terminal state,
  common Actor owns the red latch, and the active gameplay audio owner holds a
  shared ouch deadline/RNG stream.
- Upstream producers: all reachable enemy contact/projectile/lightning paths
  already emit authoritative player-damage records. Poison status ticks are a
  distinct tertiary/suppressed producer.
- State and transitions: eligible direct damage refreshes the orthogonal latch
  to one; fixed ticks reduce it by `0.05`; body action state never changes;
  terminal health enters the existing death lifecycle at higher priority.
- Downstream consumers: the player compositor duplicates current living
  body/equipment layers red; the audio consumer plays one retained semantic
  cue at victim position with health gain times spatial attenuation.
- Entry/reset/teardown: new runs reconstruct the latch and deadline, client
  cursors consume each event once, and leaving/replacing the Boneyard destroys
  the presentation without replay.

## Recovered behavioral contract

- Timing: red alpha is `max(1 - (tick-lastDirectDamageTick)/20, 0)`;
  eligible ouch requests require `tick > deadline`, then store
  `tick + Integer(20,60)` inclusive.
- Rendering: append a normal-blend `#ff0000` duplicate of every visible living
  body/equipment sprite with identical texture, position, and order. Do not
  tint the shadow, element orb/VFX, shield shell, or death art.
- Audio/randomness: choose uniformly from exact WAVs `SAY_OUCH1..3` on the
  authoritative gameplay stream, fixed playback rate. Non-spatial gain is
  `0.25 + 0.75 * (1 - clamp((HP_after-25)/20,0,1))`.
- Authority/replication: replicate accepted hit timing and a monotonic
  run-scoped sound event. Health interpolation is not a hit oracle.
- Boundary behavior: poison/healing/zero/suppressed damage do not present;
  terminal direct damage makes no ouch request; death/reset removes the living
  pass immediately.

## Nearby-system findings

- Durable finding: native poison does not justify a perpetual red flash or
  repeated groaning even though it shares the health/death receiver.
- Evidence: `0x00627160` writes tertiary damage and context `0x88`; common red
  reaction requires positive primary/secondary damage and the ouch branch
  rejects the poison/suppressed lane.
- Why it matters later: future damage-over-time skills and environmental
  effects need an explicit presentation-suppression disposition rather than
  inheriting visuals from health loss.
- Native report also updated: Mod Loader
  `native-player-damage-presentation-and-audio.md`.

## Confidence and open questions

- Confirmed: all reachable damage-source dispositions, red tint/blend/lifetime,
  body-state continuity, poison suppression, terminal priority, the three-cue
  pool, draw order, strict deadline, inclusive delay, health-volume curve, and
  host ownership.
- Inferred: the Website uses the enemy store's existing deterministic active
  gameplay stream as the browser representation of the stock shared stream;
  exact retail seed-sequence identity is not claimed.
- Unknown: none material to the ordinary damage path. Magic Shield activation
  remains a separately owned right-click skill system.

## Web implementation consequence

- Correct owner/module: player combat owns the accepted direct-hit tick;
  Boneyard simulation/enemy event ownership emits audio after seeing post-hit
  health; the shared PlayerWorldView composes the duplicate red pass.
- Shared model change: add one replicated direct-hit timestamp to progression
  and one `player-damage-sound` event variant to the retained Boneyard combat
  event lane.
- Stock behavior preserved: motion/cast selectors continue; poison stays
  silent/unflashed; terminal damage enters the existing death flow; the audio
  deadline is shared and reset per run.
- Browser approximation: Web Audio/Pixi reproduce the recovered cue and
  source-over sprite contract directly; no platform approximation is needed.
- Obsolete path: no health-delta inference, local random cue selection,
  full-screen red CSS flash, or synthetic hurt animation may be added.

## Validation contract

- Focused automated tests: direct-hit latch boundaries/refresh/reset;
  poison/zero/terminal suppression; exact health gain; deterministic cue and
  inclusive deadline draws; protocol rejection/round-trip; once-only client
  event consumption; player compositor layer identity across idle/walk/cast;
  no shadow/orb/death recolor.
- Runtime journey: on the Mac mini, enter a real Boneyard, take ordinary enemy
  melee and projectile damage while moving/casting, observe exact red decay and
  one of the three cues, then observe poison health loss without the reaction
  and terminal damage without an ouch replay.
- Stock-versus-web comparison: current action/pose remains continuous, red
  source-over alpha follows 20 ticks, cue gain follows post-hit health, and a
  fresh run carries no stale reaction.
- Acceptance: canonical `./scripts/validate.sh` passes on the exact Mac tree;
  real Mac Chrome remains WebGL2 with zero page/console/network errors and
  produces inspectable audio/event and pixel receipts.

## Implementation validation receipt

Implementation follows the recovered ownership boundary rather than deriving a
reaction from client health changes. Player combat now retains the last
accepted direct-damage tick and clears it on terminal handoff/new-run reset.
The damage publication introduced protocol 26 for that tick alongside the
level-up and generated Arena-transition additions; the terminal lifecycle
integration below advances the final combined schema to protocol 27. `PlayerWorldView`
redraws exactly the five
living body/equipment layers (`staffBack`, `robe`, `fixed`, `staffFront`, and
`head`) in native red above the unchanged pose. Shadow, orb/VFX, death art, and
world lighting tint are outside that pass. Poison remains in its separate
unflashed lane.

The authoritative Boneyard damage owner now emits retained
`player-damage-sound` events only after accepted nonterminal direct health
loss. Cue and inclusive cooldown draws consume the existing gameplay/enemy RNG
stream in native order; the strict shared deadline, post-hit health gain,
victim position, fixed pitch, monotonic event identity, and fresh-run reset are
carried through the existing protocol/audio cursor. The exact three stock WAVs
are checked into the audio manifest with their recovered registry offsets and
SHA-256 identities.

The focused closure set type-checked and passed 147/147 tests. It covers full,
midpoint, expired, refreshed, terminal, poison, and reset latch states;
deterministic cue/deadline draws and gain thresholds; real Rotten Zombie
direct-plus-poison integration; terminal suppression; protocol 26
round-trip/rejection; discrete snapshot presentation; exact asset hashes; and
renderer membership/exclusions. The full enemy store, simulation, protocol,
audio, timeline, and animation/projectile presentation tests were included so
the damage receiver could not regress its upstream producers.

Before publication, the isolated task commit was rebased onto Website
`origin/main` `9e22a0e33cea1a7a5b772afb60a794c2ce4e88d4`, preserving the
current interaction-surface, level-up, Air contact-order, and generated
Boneyard entrance-retirement systems. The exact combined content was then
copied to
`Jarretts-Mac-mini.local` (`arm64`, macOS 26.4.1, Node 22.17.0, npm 10.9.2,
.NET SDK 10.0.302, Chrome 151). The canonical `./scripts/validate.sh` completed
24 backend contracts, all main frontend tests, the auxiliary and desktop
suites, formatting, frontend lint and module boundaries, production build, and
media policy with zero failures. The only lint output was the repository's
existing React Fast Refresh warnings.

The publication rebases exposed semantic overlaps that textual merging could
not diagnose: level-up and player damage had each independently extended
protocol 23 to 24, and current `main` then advanced the combined level-up/Arena
schema to 25. Adding player damage therefore advances the complete wire schema
to protocol 26. The shared audio registry likewise retains both level-up's
`unlock-skill` cue and all three Wizard ouch cues. A post-resolution typecheck
and focused Arena/combat/progression/simulation/audio/protocol/renderer run
passed 239/239 tests; the canonical exact-tree gate below owns the complete
combined result.

Focused real-Chrome/WebGL proof
`tools/smoke-player-damage-presentation.mjs` rendered a moving, actively
casting Ether Wizard at full red, retained the unchanged purple orb, measured
alpha `0.5` at the native midpoint, hid the pass at expiry/death and for poison,
and decoded `wizard-ouch-2.wav` at pitch `1` and gain `0.625`. Page errors,
console errors, and failed responses were empty. The visually inspected Mac
receipt is `/tmp/solomon-dark-player-damage-presentation-rebased-mac-20260816.png`
(SHA-256
`ea943b9bdb47e9fb7a27aecb6250d8a18883fdeeceb008acc51512ead5811cb5`).

The ordinary Mac `/game` journey used the real local host, WebSocket protocol,
entity reconstructor, presentation timeline, Pixi compositor, Web Audio, and
Chrome. It observed Skeleton claw A/B and Archer shot, killed 43 enemies,
reconstructed and retired Archer actor 76's Arrow entity 1, then let ordinary
enemy attacks drive the player through death/game-over. Fourteen monotonic
`player-damage-sound` wire events produced fourteen decoded browser plays across
all three Wizard ouch cues, each at pitch `1`; authoritative gain ranged from
`0.25` to `1` and browser volume additionally reflected native point
attenuation. The terminal hit emitted no extra ouch. A fresh second Boneyard
started alive at 50 HP with no enemies, projectiles, or stale damage events.
Wire and page error arrays were empty. Visually inspected receipts are
`/tmp/solomon-dark-player-damage-rebased-real-enemy-rerun-20260816-combat.png`
(SHA-256
`692d2f17e956cf94824f5db65ab0d7fe84b65589e7b0eb802fb7758a27b5016b`)
and
`/tmp/solomon-dark-player-damage-rebased-real-enemy-rerun-20260816-archer-projectile.png`
(SHA-256
`3efc7caec7892da8ede14a3daa713b7ff9f9de6e63d89779a0a874e69200466e`).

The first post-rebase ordinary journey failed closed in the smoke driver after
128 enemy retirements: its nearest-enemy heuristic selected a Fire engagement
point with no collision-safe route, so the planner rejected the route instead
of bypassing authored collision. Browser and wire error arrays were empty. An
unchanged exact-tree rerun completed the full journey above; no production
movement/collision fallback or test-only teleport was added.
