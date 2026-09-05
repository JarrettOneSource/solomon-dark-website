# 2026-08-15 — Air and Water learned-skill runtime closure

## Reported smell and parity question

- Reported web behavior: player skill/stat books and the level-up picker retain
  learned ranks, but Air 24..31 and Water 32..39 do not yet change gameplay.
  Rank-one Lightning/Frost Jet presentation and contact are present; all learned
  primary branches and both families' secondary actors are absent.
- Stock behavior to recover: actor-private ranks must resolve into per-cast
  payloads, authoritative contacts/modifiers/RNG, persistent secondary actors,
  and separately replicated presentation state for every family member.
- Reproduction inputs/scenes: hold Air or Water primary against multiple live
  Boneyard enemies; cast Magic Storm, Prismatic Shock, and Ring of Ice; release,
  disconnect, die, leave the run, and observe a second client.
- Falsifiers: a learned rank that changes only visuals, a client-selected random
  outcome, a lingering contact after release, a shared modifier/book between
  players, or an effect reconstructed only inside a renderer disproves parity.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Instructions | pinned retail `SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; Air handler `0x0053F9C0`, Water handler `0x00543860` | Both primaries are immediate 100 Hz queries. Air owns an ordered retained-target chain; Water owns an LOS-filtered cone plus cold/push/status branches. | high |
| Instructions | `0x006021A0`, `0x00645540`, `0x00644460`, `0x005FFDC0` | StormCloud, Prismatic cast wave, Ring-of-Ice factory, and FreezeWave own their state/lifetime rather than player render code. | high |
| Instructions | Hurricane source registration/painter `0x00548B00`/`0x0052C2A0`, lane init/step `0x00528DA0`/`0x00528E30`, target movement/contact `0x0047CB20`, Badguy/Maggot callers `0x004835F0`/`0x004881A0` | Hurricane owns a live target orbit/damage field, eight randomized presentation lanes, a refreshed release latch, and target-private contact cooldown. The `+0x8D4/+0x8D8` damage caches are consumed. | high |
| Static data | `native-skill-catalog.json` rows 24..39, 72, and 76 and Skills atlas records 51..66, 99, and 103 | Every rank property, cap, prerequisite, exclusion, advanced-root identity, and picker icon is fully catalogued. | high |
| Instructions | advanced dispatcher `0x0054CC50`; `AcidRain 0x7FE` constructor/tick `0x005E3540`/`0x00604E90`; shuffle `0x005E41F0`; `Comet 0x80C` constructor/tick/impact/factory `0x005F0C50`/`0x006220D0`/`0x0061E9C0`/`0x0063FD00` | Air-root Acid Rain is a 1,500-tick persistent direct-damage field with an exact 400-unit query, fixed-bound shuffle, and `floor(n/3)+1` target count. Water-root Call Comet falls for 400 ticks; its impact owns 400-unit damage plus the common FreezeWave helper. | high |
| Asset/data | BadGuys records 44, 84, 110, 1836..1839, 30, 28, 32, and 14; DeadHawg record 15; audio registry 54/162, 44/161, and ambient-loop entry 171 | Base Lightning/Frost art/audio is already exact; Hurricane uses DeadHawg 15 plus BadGuys 84 and renews `steadywind__loop`; learned Hail and Cold Aura are distinct records 32 and 14. | high |
| Existing browser proof | rank-one Air/Water receipts documented above, protocol 19, current Website tree | Base held lifecycle, world target geometry, audio ownership, and rank-one art are verified already; learned effects remain the boundary. | high |

## System boundary and membership inventory

Native system: player-owned Air/Water elemental spell runtime, from rank refresh
and input dispatch through transient/persistent actor creation, contact/modifier
merge, simulation tick, replication, presentation, audio, and teardown.

| Member | Native source | Current disposition | Required closure |
| --- | --- | --- | --- |
| 24 Lightning | `0x0053F9C0` | exact-ported | per-tick ranked damage/cost and typed electric contact |
| 25 Chaining | `0x0053F9C0`, `0x00641340` | exact-ported | exact distinct-target hop order and float32 `0.600000024` decay |
| 26 Stun | `0x1B6A`, `0x006231B0`, `0x00625850` | exact-ported | 25-tick minimum-factor merge and movement consumer |
| 27 Magic Storm | dispatcher `+0x6C`, `StormCloud 0x7F0` | exact-ported | paid secondary, persistent 1,000-tick actor, RNG strike and registered rain-child lifecycle |
| 28 Magic Tornado | `0x005E2440`, `0x006021A0` | exact-ported | frequency factor, extra duration, moving-cloud compositor and presentation controls |
| 29 Hurricane | `0x0053F9C0`, `0x00548B00`, `0x0047CB20`, `0x0052C2A0`, progression `+0x8D4/+0x8D8` | exact-ported | refreshed charge/release ordering, Region-equivalent source registration, strict 280-unit tangential field, charge-cubed random damage, target cooldown and low-charge sound suppression, exact 16-word eight-lane painter program, high/low draw branches, and shared `steadywind__loop`; explicitly no light provider |
| 30 Prismatic Shock | `0x00645540`, `Mod_Prismatic 0x1B76` | exact-ported | 350-unit circular application, duration merge, electric secondary-damage doubling, retained child fade/motion |
| 31 Disintegrate | `0x0053F9C0`, `Badguy_Contact 0x0048A290` | exact-ported | event-scoped percentile roll and strict post-hit 20% execute gate |
| 32 Frost Jet | `0x00543860`, `0x00641B10` | exact-ported | ranked damage/cost and cold modifier contact |
| 33 Chill Wind | `0x00543860`, target impulse vslot `+0x64` | exact-ported | distance-aware actor push plus hostile Arrow `Anim_SpinAway`; exact inner/outer squared-radius taper |
| 34 Cone of Ice | `0x00543860`, `0x00641B10` | exact-ported | reach `205 + 4*widen`, half aperture `15+widen`, visual density/speed inputs |
| 35 Ring of Ice | `0x00644460`, `FreezeWave 0x7E8` | exact-ported | paid expanding one-contact-per-target wave, freeze/cold application, three bursts, ring, and 100/200 WhirlSnow children |
| 36 Harden | Water handler, progression `+0x8B8/+0x8BC` | exact-ported | held physical armor/cap; coating and teardown corrected in the 2026-09-04 reopening below |
| 37 Cold Aura | Water handler, record 14, progression `+0x8AC/+0x8B0` | exact-ported | held radius query, six-tick presentation cadence, slow merge |
| 38 Hail | Water handler, `Anim_Hail 0x00454030`, record 32 | exact-ported | native 3,000-cell hit roll, event-time damage draw, presentation actor |
| 39 Permafrost | progression `+0x8B4`, cold/freeze modifier construction | exact-ported | slowdown scaling and 200-tick minimum-duration rule across both Water spells |
| 72 Acid Rain (advanced Air root) | dispatcher `0x0054CC50`, `AcidRain 0x7FE`, tick `0x00604E90` | exact-ported | paid aimed field, 1,500-tick activity, 25-tick authoritative direct-damage pulses, shuffled target subset, registered rain/splash children, field composite/light, audio, replication, teardown |
| 76 Call Comet (advanced Water root) | dispatcher `0x0054CC50`, factory `0x0063FD00`, `Comet 0x80C`, impact `0x0061E9C0` | exact-ported | paid aimed falling actor, impact-area damage/freeze contact, shared FreezeWave, burst/ring/debris children, audio, replication, teardown |

Sibling uses of Lightning/Frost/Freeze modifiers by welded spells, Magic Trap,
enemy projectiles, and Skeleton Mage are outside the player Air/Water cast
boundary, but their common modifier ABI is in-system. Call Comet is explicitly
inside this pass because advanced row 76 is the Water display root and reuses
the same FreezeWave/status ABI. The modifier seam must remain reusable rather
than becoming an Air/Water-only boolean.

## Native ownership thread

- Owner and construction path: rank books and cached derived values live on one
  wizard. A cast snapshots values into one channel contact, modifier, or world
  actor. StormCloud and FreezeWave are independent world actors; Stun,
  ColdSlow/Frozen, and Prismatic attach to the contacted target.
- Upstream producers: authoritative player input, selected primary/secondary,
  actor-private effective rank, Battle Mage mana factor, Siege Mage damage
  factor, and the active gameplay RNG. Offer RNG is never consumed by combat.
- State transitions: press starts a secondary only after payment; held primary
  emits exactly once per accepted tick; release stops primary queries at once.
  Modifier reapplication merges into one target-owned row. Persistent actors
  tick once per world tick and retire once.
- Downstream consumers: enemy HP/shield contact, enemy movement/action, player
  armor damage gate, entity snapshots, WebGL world views, resident audio, and
  run/owner teardown.
- Entry/reset/teardown: joining creates independent player ECS rows. Run entry
  resets transient armor/casts/effects. Owner removal, death, run exit, and
  world replacement retire owned actors and loops without replay.

## Recovered behavioral contract

- Lightning damage/cost and Frost damage/cost are ranked per-second values
  divided by 100 at the 100 Hz authoritative tick. Upgrade costs add before the
  actor mana factor.
- Chain hops exclude every earlier contact in the same tick and multiply the
  preceding hop damage by float32 `0.600000024`.
- Stun lasts 25 ticks; merge keeps greater remaining duration and the smaller
  movement factor. Disintegrate is event-local and executes only after ordinary
  damage leaves HP strictly below 20% of maximum. Its roll exists only when
  `globalTick % 40 == targetRegistrationOrder % 40`, uses `Integer(100) >=
  100-chance`, and is followed on every ordinary Air contact by the native
  `Float(0.5)` presentation-scalar draw.
- Frost cone reach is `205 + 4*mWiden`; half aperture is `15+mWiden`. Every
  candidate needs line of sight. Visual particles remain presentation-only.
- Native Hail tests an integer in `[0,2999]` against
  `round(mToHit*30)` for each gameplay contact and draws damage only on
  success. Before the target query, each shipped-default Frost visual child
  independently tests `Integer(250)` against the same threshold. A successful
  visual allocation consumes the `Anim_Bouncer` constructor draws
  `Float(3), Float(20), Float(360), Float(10)`, then `Anim_Hail` signed `Float(0.1)`,
  handler `Float(15)`, random-unit-vector `Integer(100001)`, and handler
  `Float(2)`, in that order. It uses
  BadGuys record 32, scale `0.5+Float(0.1,signed=true)`, speed `4+Float(2)`, initial height
  `-Float(20)`, rotation `Float(360)`, rotation step `1+Float(10)`, life `2`
  with `0.015` decay, and `0.65` bounce restitution. Cold Aura presentation
  emits every sixth tick and queries `mRadius*120` world units. Its parent-
  attached record-14 actor consumes `Float(1)` then `Float(360)`, follows the
  owner each tick, begins at alpha `0.5`, fades by `0.15/radius`, multiplies
  scale by float32 `1.0149999856948853`, rotates by its first draw, and fades
  red by `0.02` per tick while retaining green/blue.
- Acid Rain snapshots row-72 `mDamage` and caster/world identity into one
  `AcidRain (0x7FE)`. It remains active for 1,500 ticks, performs authoritative
  direct damage (not Poison) on a 25-tick pulse after an initial 50-tick
  counter, and retires only after ground alpha fades by `0.01` per tick and the
  remaining rain alpha fades by `0.0005` per tick. The pulse queries radius
  `400` with flags `2`, shuffles all candidates by drawing `Integer(n)` once
  for every list index, and damages exactly `floor(n/3)+1` candidates for
  `mDamage/6`. Its ordinary cadence creates two `Anim_AcidRaindrop` children,
  while the shipped Enhanced Effects default creates five per tick; the web
  port therefore materializes five. Each drop consumes `Float(200)` then
  random-unit-vector `Integer(100001)` and uses an ellipse with Y factor `0.8`.
  The subsequent `Integer(4)==3` splash branch consumes discarded
  `Float(360)`, rotation `Float(360)`, `Float(0.75)`, `Float(200)`, and another
  unit-vector draw. A positive pulse then consumes `Integer(2)` for its sound
  gate and, when one, `Float(0.5)` pitch plus `Float(0.45)` gain. Rainfall loop
  ownership belongs to the field actor. Acid uses BadGuys records `0` for the
  raindrop and `10` for the field/splash.
- Call Comet snapshots row-76 `mDamage` and `mFreeze` into one `Comet (0x80C)`.
  Factory `0x0063FD00` writes its fifth argument to actor `+0x140` and sixth to
  `+0x13C`; the dispatcher passes ranked `mDamage` fifth and the
  Permafrost-scaled `mFreeze` sixth. Therefore `+0x140` is impact damage and
  `+0x13C` is freeze seconds, correcting the earlier Loader field labels. The
  constructor consumes `Float(1)` for cosmetic heading and initializes an
  `8000` raw fall counter. Tick subtracts `20`, so impact occurs on tick `400`;
  the one-shot warning starts only once the post-decrement counter is strictly
  below `3500` (174 ticks remain). Every fall tick creates one BadGuys record
  `51` trail and consumes `Float(0.5)`, `Float(360)`, `Integer(2)`, then
  `Float(0.5)`; trail life is `0.5*(0.5+draw)` with `0.025` decay and scale
  `2.5`. At expiry, `0x0061E9C0` queries radius `400` with flags `2`, writes
  `+0x140` into each contact's secondary-damage field, and creates the same
  list-backed FreezeWave used by Ring of Ice with `+0x13C*200` ticks. The
  DeadHawg record `5` comet, impact burst/debris, world color restore, and
  retirement are presentation consequences of that single authoritative
  impact.
- Harden adds its cached per-tick increment while held, clamps to the cached
  maximum. The 2026-09-04 reopening corrects the earlier release claim: the
  active-primary dispatcher deletes coating and armor on release. Player
  contact `0x0052FCA5` resolves Deflect cancellation first, applies Resist
  Magic to surviving magic damage, then subtracts the actor-private armor at `+0x1E8` from physical damage;
  magic damage is separate. Hits do not consume the accumulator.
- StormCloud starts with 1,000 active ticks. Tornado adds
  `trunc(mDuration*100)` and resets strike delay to
  `trunc(IntegerInclusive(30,120)/(1+mSpeed/100))`.
- Ring of Ice creates one list-backed expanding FreezeWave so each target is
  contacted at most once by that wave. The FreezeWave query runs every tenth
  age tick as radius grows by six per tick and the wave retires after tick 93.
  A target with native flag `0x40` receives `Mod_ColdSlow`; otherwise it
  receives `Mod_Frozen` with movement factor zero. Current Boneyard hostiles
  take the Frozen branch. The player Ring factory does not set the optional
  FrostBurn bit. Permafrost scales cold strength and raises cold/freeze
  duration to at least 200 ticks.
- Hurricane is a player-owned Lightning extension with separate early-tick and
  late-handler edges. Byte `+0x310` retains the preceding Lightning refresh:
  when clear, early player tick subtracts `0.03`, removes a zero charge from the
  Region Hurricane list, registers every remaining positive charge, consumes
  `FloatRange(2,3)` for core phase, advances eight lane angles, renews ambient
  `steadywind__loop` at `charge*attenuation`, then clears the latch. The later
  normal Lightning handler sets the latch, initializes a zero charge with 16
  ordered RNG words, and adds `0.0015` up to one. Consequently first activation
  draws before its first contact tick, and release retains one full-charge tick
  before decay.
- Each Hurricane target movement update uses strict squared radius `78,400`.
  With `dx=source.x-target.x` and `dy=source.y-target.y`, stock normalizes the
  clockwise tangent `(dy,-dx)` and adds
  `falloff*targetMovementStep*charge*1.5`, where falloff is full through 100 and
  linearly reaches zero at 280 after the native one-iteration fast-square-root
  approximation. Ordinary targets move on their ten-tick object-serial phase.
  Target `+0x1DA` is initialized with `Integer(100)`, decreases by the movement
  step every tick, and resets to 100 after contact. The first eligible source in
  Region registration order consumes
  `FloatRange(cache+0x8D4,cache+0x8D8)` and deals float32
  `charge^3*randomDamage`; charge below `0.5` suppresses the ordinary target hit
  sound but not damage/death. The field affects Badguy subclasses and Maggots;
  GoodImp receives orbit force but its friendly contact override ignores damage.
- Hurricane presentation is not Lightning corona art. Each activation stores
  eight `Float(360)` angles and eight `Float(15)` vertical offsets, with authored
  velocities `10*0.75^i` and radii `1.5*1.2^i`. The owner-overlay painter draws
  source-over DeadHawg 15 at `(x,y-15)`, rotation `1.5*phase`, scale `(5,4)`,
  RGB `(0.95,1,1)`, alpha `0.75*charge`; then additive BadGuys 84 lanes at
  `(radius,0.8*radius)`, RGB `(0.8,1,1)`, alpha `0.4*charge`. Enhanced mode
  draws all eight plus copies at `0.75*angle`; low mode draws even lanes only.
  It creates no Region/Misc/manager light and casts no shadow.
- Chill Wind uses `mPushback` as its impulse scalar. At near range the applied
  vector has magnitude `mPushback*2.5`; squared-distance attenuation begins at
  half of `0.75*(180+4*mWiden)^2`, reaches zero at that outer squared radius,
  and target flag `0x40` multiplies the result by float32 `0.100000001`.
- Magic Storm queries a 500-unit hostile circle. A moving Tornado translates
  by float32 `0.349999994` per tick; `mSpeed` controls only strike frequency.
- Authority owns all combat RNG and results. Protocol sends semantic state;
  clients do not reroll, retarget, or author damage.

## Confidence and open questions

- Confirmed: rows 24..32 and 34..39 properties/ownership above; base
  primary visual/audio asset sets; typed native modifier IDs and merge rules.
- Exact child art: Ring uses DeadHawg records 114 (`+0xC78`) and 121
  (`+0xD3C`), while Hail/Aura use BadGuys records 32/14. Storm queries radius
  500 and owns its rain/wind ambience. Prismatic spray draws from BadGuys
  records 10, 11, and 110..112.
- The serialized actor pass closed Acid Rain's query, pulse, subset, child RNG,
  residue, sound gate and three direct draw layers; Call Comet's field split,
  fall/warning clocks, body/trail transforms, impact radius, and FreezeWave
  duration conversion; and Harden's production contact order. The Website
  shared secondary-action dispatcher owns press edge, payment, cast sequence,
  recharge, and Focus RNG; the Air/Water callback never latches input itself.
- The prior presentation-residual list is closed by the unified secondary
  actor/painter model. Storm registers and advances every `Anim_Raindrop`
  fall/puddle child. Prismatic retains the exact 19-word emission batches and
  replays their independently fading/moving records 10, 11, and 111 from the
  replicated pre-emission RNG state. Ring/FreezeWave creates the three
  DeadHawg-114 bursts, DeadHawg-121 ring, and 100/200 `Anim_WhirlSnow`
  children; constructor `0x004588E0`, vtable `0x007853A8`, and the native asset
  map pin WhirlSnow to BadGuys record 72. Call Comet owns BadGuys-15,
  DeadHawg-6, and Bouncer debris records 203..207 as separately retiring
  actors. Acid Rain owns its record-0 drops, record-10 parent/splash passes,
  actor-provider light, and the 350-unit `PuppetPointer` scene-submission
  extent at `0x005E3600 -> 0x0064E910`; that 350 scalar is not a second light
  radius.
- Chill Wind now queries the full native `0x1082` target membership. Arrow
  constructor `0x005E1000` writes flag `0x80`; the Water handler passes
  float32 `mPushback*0.3199999928474426` to Arrow vslot `+0x64`.
  Every learned rank crosses the Arrow's one-point accumulator on the first
  eligible contact, retires it, and creates one world-owned record-2
  `Anim_SpinAway`: life 6, loss 0.1, unit cast-direction velocity damped by
  float32 0.98, `Float(360)` rotation, and signed `1+Float(1)` angular speed.
  Firebolt/GuidedMissile use flag `0x100`, so they are intentionally outside
  this query branch; underpowered Water uses mask `0x2` and suppresses it.

## Web implementation consequence

- Player rank/runtime/armor stays in dense player ECS columns. Enemy modifiers
  are target-owned authoritative rows. Persistent spells are simulation-owned
  entities with stable IDs, owner/world identity, clocks, and contact ledgers.
  Deflect, resistance, and held physical Harden are applied by the central
  player harmful-contact seam; Harden is not depleted by
  damage.
- Existing rank-one Air and Water render plans remain their proven owners.
  Learned Hail/Aura and secondary art get separate presentation actors; combat
  never depends on a sprite lifetime.
- One combat RNG stream advances only on authoritative event draws. Offer and
  cosmetic deterministic streams remain separate.
- Protocol 36 validates every added numeric range, target owner, modifier,
  effect ID, sequence edge, and lifecycle field. Clients copy/interpolate the
  semantic state without rerolling combat or reconstructing lifetimes.

## Validation contract

- Focused tests: every ID 24..39 plus advanced Air/Water roots 72 and 76 has at
  least one property, transition, contact, merge, teardown, and invalid-wire
  assertion appropriate to its branch.
- Multiplayer test: two players with different ranks cast simultaneously and
  retain isolated mana, armor, targets, modifiers, RNG outcomes, and owned
  persistent actors.
- Browser/WebGL: real Air/Water primary and secondary casts show exact loaded
  records, balanced loop ownership, deterministic replicated geometry, no page
  or console errors, and no effect replay after a late snapshot.
- Full gate: only `./scripts/validate.sh` is a supported repository receipt.
  Solomon Dark completion additionally requires the decisive tests and browser
  journey to be run on the Mac mini; WSL and Windows runs are diagnostic only.
- Isolated implementation receipt, 2026-08-15: the 14-file Air/Water focused
  Node suite passed 155/155, `tsc -p tsconfig.test.json --noEmit` passed, and
  the production `tsc -b` project build passed. These are diagnostic WSL
  receipts, not the final Mac mini browser acceptance.


## 2026-09-04 — Hail constructor scale and signed RNG reopening

The report `SDB - Hail MASSIVE particles.mp4` (Windows Downloads, 1920x1080,
15.957556 seconds) shows oversized round Hail behind the Frost Jet. The earlier
closure incorrectly transcribed the constructor as unsigned `Float(1)+1` and
validated that assumption in tests. It skipped the raw constant/sign-argument
check; the later mesh work carried that wrong producer range into both decoders.

### Native evidence and ownership

Fresh read-only Ghidra replica queries used the canonical `SolomonDark` project,
`SolomonDark.exe` at preferred base `0x00400000`, SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`.
The existing Mod Loader wrapper was used without edits (SHA-256
`b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`).
Queries: `decompile_targets.py` for `0x00454030`, `0x00458D80`, `0x00543860`;
`dump_function_instructions.py 260` for the constructor, parent `0x00453060`,
painter `0x004540B0`, and RNG `0x00401310`; `refs_to_addr_decompile.py` for
constructor, vtable `0x0078501C`, and painter. Raw PE section reads independently
confirmed the following constants. These are instruction/data facts, not a
clean-stock screenshot claim.

- `0x00454062` pushes signed flag `1`; `0x00454068` loads float32
  `0x007845E8 = 0.10000000149011612`; `0x00454085` calls the float RNG;
  `0x0045408A` adds double `0x007DE808 = 0.5`; `0x00454092` stores float32
  scale at `+0x54`. The exact stored range is
  `[0.4000000059604645, 0.6000000238418579]`.
- Parent `0x00453060` consumes four unsigned draws: `Float(3)`, `Float(20)`,
  `Float(360)`, `Float(10)`. The Hail scale consumes two words, magnitude then
  sign. Handler `0x00543860` follows with `Float(15)`, `Integer(100001)`,
  `Float(2)`: nine words total. The previous eight-word sequence also shifted
  radial spawn, speed, and subsequent shared random outcomes.
- Signed RNG `0x00401385..0x00401396` loads the positive magnitude, negates
  only when bit 6 of the second advanced word is `1`, and returns it otherwise.
  The shared Website helper already implements this correctly; Hail must use
  its signed branch so the extra word is consumed.
- The sole constructor xref is Water handler `0x00543F4C`. Its Normal-only
  branch tests `Integer(250)` against the learned Hail threshold; it writes
  BadGuys record 32 at `+0x24`, position, Region, and velocity, then registers
  the actor. It never overwrites scale.
- The sole vtable writer is the constructor; draw slot `0x00785028` points to
  `0x004540B0`, while update slot `0x00785024` points to `0x00458D80`.
  The painter passes stored scale unchanged, rotation `+0x3C`, `(x,y+height)`,
  white tint and `min(life,1)`. Record 32 is 19x20 with origin `(9.5,11)`:
  Hail covers 7.6–11.4 by 8–12 world units before rotation, throughout its life.
- The update never writes `+0x54`. Airborne, bounce, settled, and fade keep
  constructor size. Existing 134-tick retirement, bounce motion, native audio
  sequence, and post-release lifetime remain owned by the authoritative actor.

### Boundary and complete membership

The reopened system is the learned Hail actor's construction-to-presentation
contract and the signed-float primitive it consumes. It is distinct from the
welded Hailstones spell (build 1008).

| Member | Disposition | Proof / consequence |
| --- | --- | --- |
| Hail (skill 38), every rank, Normal Frost emission in Hub and Boneyard | exact-ported | one corrected shared constructor; same nine-word sequence |
| Frost Over / underpowered branch | verified-already-at-parity | handler does not allocate Hail; existing shared emission tests |
| Anim_Bouncer inherited birth, airborne, bounce, settled, fade, retirement | exact-ported | explicit float32 stores, retained settled bounce clock, unchanged scale through all live ticks |
| BadGuys record 32 / Sprite view in Hub | verified-already-at-parity | direct stored scale, authored 19x20 canvas and `(9.5,11)` origin |
| Record 32 / combined Water mesh in Boneyard | verified-already-at-parity | direct stored scale and exact per-vertex geometry |
| Compact Hail table and welcome snapshot decoder | exact-ported | both reject old oversized range and admit both exact float32 endpoints |
| Retained interpolation, actor order, snapshot hydration | verified-already-at-parity | carries authoritative scale unchanged; lifecycle/transport tests |
| Schema-29 save round-trip and older Hail retirement | exact-ported | preserves current Hail and the run; older cosmetic Hail alone retires on restore |
| Hail damage roll and release/world teardown | verified-already-at-parity | distinct event/lifetime ownership; scale does not control damage |
| Hail bounce pitch and sound-gated RNG consumption | exact-ported | signed Float(.2)+1; both endpoints, all four samples, six-word sounding bounce / three-word silent bounce |
| Signed `Float` magnitude/sign primitive and existing callers | verified-already-at-parity | bit-6 instruction comparison and fixed-word positive/negative checks; Hail now calls the existing signed branch |
| Unsigned `Float`, integer RNG, random-sign helper | verified-already-at-parity | separate branches; no change to draw counts or outputs |
| Welded Hailstones, Frost Jet core, Cold Aura, Hurricane | out-of-system | separate constructors/registrations; no size retuning |

No browser limitation requires a visual approximation. The cause is proven by
a pre-fix Mac constructor/lifecycle reproduction: seed 37 produces scale
`1.3328900337219238`, stays that size for 134 ticks, and fails the native
`0.4..0.6` envelope. Atlas magnification and lifetime growth are ruled out.

### Validation contract

Use public constructor tests with native fixed-word expectations, both wire
representations with exact endpoint acceptance and neighboring rejection,
and Sprite/mesh geometry from real constructed actors. Run the canonical Mac
Website gate and a 1920x1080 Mac Chrome Water journey with no Hail, Hail rank 10,
and restored no-Hail phases. Record frame times and actual actor sizes; distinguish
pixel-area reduction from measured whole-game performance.


### Existing save continuation

Save schema 28 can persist live Hail actors with the incorrect 1–2 scale.
Those actors would fail the corrected welcome decoder before a restored player
can resume. Schema 29 retires only Hail presentation actors from schema 28 and
older during the existing primary-spell normalization step. Their missing
native sign draw cannot be reconstructed from the saved state without guessing;
retirement preserves the run, player progress, all other spell actors, and RNG.
New schema 29 saves retain native Hail exactly. This is a one-time saved-data
migration, not a second runtime representation or a renderer scale fallback.


### Residual signed bounce-pitch correction

The complete lifecycle review also found the same omitted sign argument in
bounce audio. Matching-image instructions `0x00458E88` load float32
`0x00784CE8 = 0.20000000298023224`; `0x00458E8E` pushes `1`;
`0x00458E9A` calls `Float`; `0x00458EB8` adds double `1` and the result is
stored as float32. Thus pitch is `1+Float(.2,signed=true)`, with exact endpoints
`0.800000011920929` and `1.2000000476837158`. The sound-enabled bounce consumes
six words (rotation, sound gate, pitch magnitude, pitch sign, sample, horizontal
damping); a silent bounce consumes three. The earlier unsigned-pitch account
in ledger 299 is superseded. Both wire paths and audio-cursor tests must admit
the lower endpoint. The shared signed-float implementation itself remains exact.

The schema-29 change also pins the prior missing-offer repair cutoff at schema
28. Later schema bumps must not broaden that unrelated migration or reroll a
malformed schema-28 offer; only schema 27 and older retain that repair.


### Float32 placement and update boundaries

The same full-instruction review replaces two algebraically similar but
bit-different Hail recurrences. `0x00458DBE..CF` computes
`f32(f32(height + verticalVelocity) + verticalVelocity)`. At
`0x00458DD2..E8`, keep `a = bounceProgress * f32(.4)` in double precision,
then store `f32(a + f32(verticalVelocity + a))`. Do not double a rounded
product or fold the two height additions. Settlement `0x00458F25..3B`
clears velocities and rotation step, but retains the already-incremented
bounce clock at `+0x50`; the outer zero-height branch preserves it thereafter.

Random vector helper `0x00410C50` stores its angle, radians, and each sine/cosine
component before the caller multiplies by radial distance. It uses GMath's
authored float32 pi `3.141592502593994` (`0x007DE8A8`, constructor
`0x004100D0`), already recovered in ledger 100. Hail now preserves those
intermediate stores. A 90-degree vector at distance 7.5 gives
`(7.5, -0.0000005662342346113292)` before emitter addition. The original
`Math.PI` / unrounded-trig path erased that native component.

Following the corrected recurrence gives the closed height minimum
`-79.45001220703125` (native height draw 1/100000, initial saved bounce velocity
-5, tick 21). Both Hail decoders use this exact producer envelope. The old
`f32(-79.45)` bound was two float32 steps too high. A Mac instruction-recurrence
sweep covers all 100001 constructor height samples at the maximum bounce speed;
later bounces have both weaker upward velocity and no smaller acceleration.


### Initial implementation and Mac acceptance receipt

The initial candidate was base `a2197bf4a6b8bf8a5328030c63b555b269c65e65` plus the
focused uncommitted patch. All 13 changed frontend code/test files matched
between the local worktree and the Mac; their sorted compact JSON SHA-256
manifest is `8e5f4187652f5085822f7f33151aa4e15dc5b18489e88f88aeabbe93a098c81d`.
Protocol 118 admits the native scale/pitch bounds. Save schema 29 retires prior
Hail visuals and preserves the schema-28 missing-offer rejection boundary.
The existing finite-range validator replaces duplicated Hail scalar checks.

- Focused Mac suite: **119 passed, zero failed**. Regression tests first failed
  on oversized constructor/Sprite output, missing pitch sign consumption,
  float32 motion/placement, and the unrelated offer-migration cutoff.
- Final `/opt/homebrew/bin/bash ./scripts/validate.sh`: **passed**, including
  19 Website/backend tests and 2,679 frontend/desktop test executions, backend
  formatting, lint/import/generated checks, TypeScript, both production
  builds, bundle limits, and media/CSP policy. Backend: zero warnings/errors.
  Entry: 262,312 raw / 79,063 gzip bytes.
- Built Mac Chrome at 1920x1080 used Apple M2 Metal, seeded Boneyard
  `0123456789abcdef`, normal health/mana maxima, stationary combat enemies,
  a 15-second warmup, and five-second measurements. Real UI input selected
  Water and held/released Frost Jet; the authority fixture changed only Hail
  rank between the three measurement phases.

| Phase | FPS | p95 / p99 / maximum frame gap | Hail actors at capture |
| --- | ---: | --- | ---: |
| Water without Hail | 60.07 | 16.7 / 16.8 / 16.8 ms | 0 |
| Water with Hail rank 10 | 60.20 | 16.7 / 16.8 / 16.8 ms | 205 |
| Hail removed, Water still held | 60.13 | 16.7 / 16.8 / 16.8 ms | 0 |

All active Hail scales were within the recovered envelope; the captured range
was `0.40097498893737793..0.5972740054130554`. The observed native-size chips
replace the reported large circles. Page, console, failed-request, and HTTP-error arrays were empty. Removal let all prior Hail retire; final input
release stopped the Frost loop. This proves no Hail frame-rate drop in this
controlled Mac scenario; it does not claim a measured speedup on the user's
Windows hardware.

Earlier samples with the reused short-cast harness's million-point health/mana
fixture are discarded as performance evidence. Native HUD width grows with
those maxima, and CPU sampling showed React/strip/layout/GC overhead. Normal
stat maxima plus the existing stationary-combat/refill fixture removed that
measurement confound. Their images remain useful only as oversized-particle
reproduction, not as before/after FPS evidence.

Receipt hashes (disposable artifacts; results retained here): full gate
`0c1d7feff9122b0aa246d8c9f38cf11c310a1821e87f13a84156d3c4541a3559`,
focused tests `5c63a43e7e1eb436ba08f3dd6b54ea14102d9657f18341c4f1288952457a7c73`,
browser `e8410845646cdb9dae08fcef44abacd0bc10b8624ff8839a7174d04ba4e36bd1`,
Hail screenshot `2b7e16b25c0f1fe47c16c0167dafb34f46a0708764a55da9dd32ff5841494b4e`.

### Quality limits and initial handoff

The stricter quality gates are **not all satisfied**. Oxlint maximum
complexity 21 passes Hail construction/update, the compact Hail validator, and
primary-save normalization. The broader files retain 25 pre-existing
complexity violations; the unrelated transient dispatcher remains 153.
The pre-existing protocol and save-document files remain over the file-size
limit (12,250 and 2,458 authored lines with blank/comment lines omitted).
This focused patch does not restructure those full modules.

V8 reports every range hit in Hail construction (1/1), Hail update (12/12),
and primary-save normalization (3/3). That is not a claim of 100% statement,
branch, function, and line coverage for the entire changed-file scope.
Separate statement, cognitive-complexity, Halstead, CRAP, mutation, and dedicated
dead-code/duplication analyzers are not configured. Those gates remain
unmeasured; no analyzer dependency, exclusion, or suppression was added.
Normal lint/type checks pass; the changed production expressions introduce no
explicit `any`/`unknown`, scale fallback, compatibility renderer, or new wrapper.

Two-axis review closed all concrete Hail/native and save-cutover findings;
standards review retains the pre-existing file-size constraints above. At the
initial handoff the fix was not committed, pushed, or deployed. The shared
dirty checkout and Mod Loader files were preserved. Focused local/Mac source
worktrees were retained for review; task browser/host processes and disposable
captures, profiles, coverage output, scripts, and logs were removed.
## 2026-09-04 — Harden state, special painter, and breakup reopening

The report `SDB - Harden no effect.mp4` in Windows Downloads shows rank-2
Harden with Frost Jet firing and no ice coating. The earlier entries stopped
at the armor accumulator and ordinary PlayerWizard painter. They skipped the
flag-selected special painter and the upstream release branch. Consequently,
their claims that Harden has no independent presentation/audio and survives
release are false. The 2026-08-28 all-Water receipt inherited those assumptions.

### Evidence established before implementation

Retail image: `SolomonDark.exe` 0.72.5, 4,723,200 bytes, SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`,
preferred base `0x00400000`. Static work uses the canonical Ghidra 12.0.3
project through the read-only Mod Loader wrapper at revision
`08bfba9ef367f7b863848030d0a289dc31e33192`. No injected observations justify
the following instruction/data facts.

| Owner | Recovered contract |
| --- | --- |
| Water handler `0x00543860`, `0x00544A57..0x00544C3E` | Normal paid Water adds cached `progression+0x8BC` to physical armor `player+0x1E8`, clamps at `progression+0x8B8`, sets `player+0x138` bit `8`, and independently increases coating `player+0x2E0` by double `0.004999999888241291`, with a float32 store and cap one. |
| Water start and threshold | Zero coating requests `sounds\\harden` at pitch `0.800000011920929`; crossing `0.25` requests the same cue twice at pitch one. Point attenuation belongs to Region vtable `+0x100`. |
| Main player update `0x00548B00`, cleanup call `0x0054AD24` | No active primary calls the breakup helper when bit 8 is set, then clears coating and armor. Merely stopping accrual is incorrect. Weak Water reaches the same cleanup from `0x00544C20`. |
| Player damage `0x00548150 -> 0x0052F540` | Deflected contact does not chip Harden. Surviving positive physical contact can create a cosmetic chip once coating is strictly above `0.2`. The flat armor subtraction at `0x0052FCA5` applies to physical lane `0x0081C6E8`; the separate magic lane `0x0081C6EC` is not reduced by Harden. Hits do not consume the armor accumulator. |
| Special painter `0x005468C0`, PlayerWizard vtable `0x00793F74 + 0x20` | Region dispatch `0x00624B40` selects the special painter for flag mask `0x39`; bit 8 selects Harden below bit 1 and above bits `0x10/0x20`. Harden captures the animated ordinary player, multiplies the mask with Clothes record 1, draws the ordinary player, then submits the cyan result three times additively. |
| Coating draw `0x00546FBC..0x0054731E` | Clothes singleton `0x00819980 + 0xFC`; orientation `24 * ((trunc(heading)+7)/15 mod 24)` degrees; gait-dependent registration; composite offset `(0,-25)`, scale `1.1200000047683716`, RGB `(0.25,0.75,1)`, alpha `coating * 0.699999988079071`. No new light source is created. |
| Coating asset | Complete retail Clothes record 1 is rectangle `(494,0,130,130)`, logical size `130x130`, origin `(0,0)`. The existing bundle parser recovers these bytes directly. |
| Breakup `0x00529840 -> 0x00654A60` | Clear bit 8; request `sounds\\ice_shatter` at pitch `1 + Float(0.1,signed)` and gain `coating * pointGain`; emit radial additive fragments only above coating `0.1`; reset armor and coating to zero. Angular steps are 90 below `.2`, 60 below `.3`, 45 below `.4`, 35 below `.5`, and 20 thereafter. |
| Audio registry `0x004EE010` | `sounds\\harden` is registry field `+0x724`, loaded at `0x004EEE1C`; `sounds\\ice_shatter` is `+0x7D4`, loaded at `0x004EEF74`. Both are exact retail WAV assets. |

Mac baseline at `a2197bf4`: the production 200-tick Boneyard Water probe
reaches armor `24.000041961669922`, blocks a ten-point physical contact, also
incorrectly blocks a ten-point magic contact, and publishes no Harden state.
The focused release regression fails with armor `11.999990463256836` instead
of zero after 100 ticks followed by release. Thus the report is a missing
presentation/lifecycle implementation, rather than an absent numerical cache.

### System boundary and membership

This reopening owns Harden row 36, all eleven authored ranks, normal/weak
Water, active-primary/release transitions, physical and magic contact,
Deflect suppression, coating and chip/breakup presentation, audio,
replication, and player/world teardown. The inert equipment `FX_MAXHARDEN`
bit retains the already-recovered absence of native consumers; the tooltip
does not authorize inventing damaging retaliation. Other Water skills and
the unrelated bit-1/bit-`0x10`/bit-`0x20` effects retain their own owners.

The all-rank armor-per-second rows remain
`[0,8,12,18,25,30,35,40,45,50,60]`, caps
`[0,25,50,75,100,125,150,175,200,250,300]`, and added mana-per-second rows
`[0,5,8,10,15,25,32,45,50,55,58]`. Coating growth is independent of rank.

### Implementation and acceptance contract

Keep Harden state and native effect programs cohesive; remove the obsolete
test-only armor helper. Publish authoritative coating state to the shared
player view; both normal and late snapshots must display it. Use the exact
Clothes/WAV assets and existing Pixi render-target/native blend facilities.
Preserve host-owned random draws, world coordinates, painter ownership,
release/weak cleanup, death, and world changes. Validate every rank and state
branch through the real runtime/contact and snapshot interfaces, then prove
the animated coating and breakup through Mac Chrome. The canonical Mac gate
and final browser receipt are recorded below.


### Final recovered membership and implementation

| Member | Disposition | Evidence / production owner |
| --- | --- | --- |
| Row 36 ranks 0..10, armor rates/caps/mana | verified-already-at-parity for authored rows; exact-ported for held lifecycle | profile all-rank matrix plus `native-harden.ts` independent coating clock |
| Normal Water, weak Water, release, other held primary | exact-ported | `0x00544A57..0x00544C3E` and no-action `0x0054AD19..`; shared skill tick |
| Physical contact, magic exclusion, Deflect cancellation, chip chance | exact-ported | `0x00548150 -> 0x0052F540`; `player-harmful-contact.ts` |
| Start, formed threshold, release and chip audio | exact-ported | Sound fields `+0x724/+0x7D4`; builder supplies ten voices to both; shared event gain carries partial coating breakup volume |
| Animated head/body/equipment mask and Clothes-1 multiply | exact-ported | `0x005468C0`, all sprite and mesh native pipelines; 256-square NPM target; `D3DTOP_SELECTARG1` preserves diffuse RGB and texture alpha |
| Three cyan composites and final front Staff/orb submission | exact-ported | `0x00547222..0x00547355`; common player view, shader state restored between target submissions |
| Stoneskin precedence and dying/spectator suppression | exact-ported | bit-1 branch above bit 8; native death gate; shared player view |
| Breakup radial fragments and one Fade flash | exact-ported | `0x00654A60`; BadGuys builder `0x004E0DD0` maps `+0x48BC` to all five records 446..450; flash is ordinary `Anim_Fade` record 15 at scale 3.5, alpha decay .05 and sort bias 10 |
| Fragment construction / updates / landing / settlement | exact-ported | `Anim_Bouncer 0x00453060/0x00456720`, additive draw `0x00528D10`; four constructor float draws, record Integer(5), signed heading jitter, speed and lead; life 10 with .015 decay, skip airborne ticks divisible by three, gravity .4, restitution .65, strict -.75 settlement |
| Fragment painter and static-collision retirement | exact-ported | `Region+0x2C4` post-world owner; `0x004567C6..0x004567E2` queries the embedded Arena collision controller at `+0x378`; retire inside a shape and still consume the two landing random draws |
| Coating snapshots and both fragment families | exact-ported | protocol 119, strict record/field validation, independent players, late-state reconstruction and interpolation; release stays discrete |
| College and Boneyard transitions, death and owner removal | exact-ported | existing shared player view and reset owner; runtime and renderer regressions |
| FX_MAXHARDEN equipment feature | out-of-system: shipped inert | previous exhaustive `+0x878` read census; no native consumer for bit `0x100` |
| Other Water progression effects and other special material flags | out-of-system: distinct effect owners | preserved existing Water/secondary contracts and the incoming Hail/renderer fixes |

The first browser candidate exposed a real Pixi integration defect: batched
shader uniforms were uploaded only on the first bind, leaving the texture-color
selector in mask mode. `installNativeTextureColorSync` now updates this uniform
at each native batch start in both College and Arena, and restores its predecessor
when the Arena pipeline is destroyed. The smoke journey observes the actual GL
uniform returning to zero, normal detailed wizard art after release, three
coating layers while active, and native audio play requests.

Asset SHA-256: Clothes-1 PNG
`e02f6b79705e40702e6a8219dd959bfbd0ec6b2cbc87e497c0ffdaf24fea16ef`;
Harden WAV `47f01edbaa864239705de0be04e1fde25877d9e2e99f6edfc07e8c3656e48df9`;
Ice Shatter WAV `6c59e5456086dfd3c43ebc891ba6225d967c36f0a36d14a2a8fe48b3484321bd`.
The standalone extracted Clothes record uses the existing fixed-function
framed texture policy. No generated replacement art or audio is used.


### Save cutover and cloud admission

Schema 30 stores the canonical `{armor, coating}` pair. Schema 1..29 restores
retire the old erroneous persistent `hardenArmor` cache, remove that field, and
initialize the held-only pair to zero; the next accepted Water handler rebuilds
it. Current saves preserve both fields, and the input boundary rejects negative
armor, coating outside `[0,1]`, or nonzero armor with zero coating. Historical
secondary feedback events acquire their former implicit gain one in the same
versioned migration. This is the existing save-version migration path, not a
second runtime implementation. The cloud inspector's maximum schema was still
28 while the preceding Hail change wrote 29; it now admits current schema 30.
The authenticated cloud-slot integration test uses 30 and rejects 31.


### 2026-09-05 implementation validation receipt

- Candidate source `3c88b5c63a5fbefa143220d8749953e9479273d1`, based on
  `e75bfb4a28c408b55e013f6749841e53bd52013d`. A 64-file SHA-256 manifest
  matched the isolated Mac tree byte-for-byte before the final run. The receipt
  itself is a subsequent documentation-only edit; implementation bytes are
  unchanged.
- Mac complete gate: `/opt/homebrew/bin/bash ./scripts/validate.sh` exited zero.
  Backend Release build/format, 19 backend integration tests, frontend lint and
  boundary checks, 2,826 frontend/desktop tests, production build, bundle budget,
  and production media policy passed. Ten pre-existing lint warnings concern
  control-character regexes and React fast-refresh exports; there are no lint
  errors. The cloud-slot integration now accepts schema 30 and rejects 31.
- Mac targeted save suite: 57/57 passed, including both old Harden layouts,
  exact current state restoration, invalid-state rejection, and preservation
  of the run/economy.
- Mac built Chrome journey: `npm run smoke:game:harden`, 1920x1080. The real
  Title/Create/College/Boneyard/Solomon path reaches held Frost Jet, three
  textured cyan player layers, armor `24.12004280090332` and coating one.
  Movement retains the animated coating. Release publishes armor/coating zero
  and native shards/Fade; weak Water independently clears the coating and plays
  the attenuated breakup sound. The GL texture-color selector returns to zero.
  Page errors, console errors, and failed-request/HTTP-error arrays are empty.
- Actual native sound plays observed: Harden at `.800000011920929`, two
  pitch-one formation plays, release shatter pitch `1.0210349559783936` at gain
  one, and weak shatter pitch `.9137049913406372` at gain
  `.5049996972084045`. Screenshots were visually inspected for the textured
  coating and the restored detailed wizard after release; temporary captures
  are removed after publication.
- The independent-owner/death/removal/College-reset and late-client snapshot
  regressions pass through the production simulation and replication paths.
- Mac Hurricane regression: the extracted shared navigation completes the
  existing Air journey, reaches charge `.5010014772415161`, retains eight
  lanes and damage range 10..20, and starts/stops the wind audio. Page, console,
  and network errors are empty. The old smoke fixture wrote artificial resource
  maxima that the normal economy refresh immediately replaced with derived
  stats. It now grants Hurricane, Mana Up, and Health Up through the existing
  skill API and fills the resulting resources; the `.5` charge assertion is
  preserved.
- Focused Node coverage gate: 49/49 tests; 100% lines, branches, and functions
  for all seven new Harden/contact/presentation modules. Oxc's actual per-unit
  cyclomatic maximum is 18, with the `<22` gate passing. New module lengths are
  35..187 lines; the reorganized skill runtime is 863 lines and the shared
  player view is 980 lines. No explicit `any`/`unknown` types were added to those
  modules. The existing save JSON boundary retains its untrusted input type.
- Unmeasured: statement coverage (the built-in Node reporter does not expose
  it), full-file coverage of the existing integration modules, cognitive
  complexity, Halstead Difficulty, CRAP, mutation survival, and dedicated
  whole-scope dead-code/duplication analysis. The repository supplies no
  configured analyzers for those latter measures; no dependencies, exclusions,
  or suppressions were added to manufacture a result. Available TypeScript,
  Oxc unused-symbol checks, boundary checks, and a manual reference/diff sweep
  found no remaining defect in the Harden cutover.
