# Generated Boneyard entrance retirement and wave placement — 2026-08-16

## Problem and scope

The current `/game` host starts the reconstructed survival wave director when
Solomon runs, but it keeps camera, movement, collision, and spawn placement on
the complete generated Arena forever. Stock instead runs a generated
`SOLOMON RUNS` script that retires the entrance side of the Fence Gate. The
reported inability to go back is therefore a missing Arena-transition owner,
not a Gate-animation symptom. The adjacent wave-placement system had to be
reopened because the same camera target is consumed by native placement retry
logic.

Scope includes both generated entrance orientations, camera interpolation,
the delayed cleanup/seal boundary, Gate retention, authoritative movement and
spawn domains, near-player and anywhere placement, every native light-policy
branch, actor-radius collision retries, snapshots/protocol/interpolation,
renderer camera ownership, and default-versus-mod membership. It does not
invent this lifecycle for custom Boneyards.

## Evidence provenance

- Retail executable: 4,723,200 bytes, SHA-256
  `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`.
- Reference generated Arena:
  `Generated Boneyards/random seed.boneyard`, 266,811 bytes, SHA-256
  `dda683d9f9e34649b3a510b2790650fc99103e51316d4b95eb6593fe98d7d448`.
- Fresh read-only Ghidra instruction/decompile anchors:
  `BoneyardGenerator 0x006388B0`, camera action `0x00464B20`, Arena tick
  `0x0046E570`, cleanup `0x004728B0`, Spawner `0x0046D000`, near-player
  helper `0x00465E40`, policy adapter `0x00466200`, placement retry
  `0x00463D30`, and policy predicate `0x00463BE0`.
- One isolated authentic generated Default run on 2026-08-16 confirmed the
  target fields, 400-tick script, retained Gate manager membership, and first
  wave births. The task-owned retail process was stopped afterward; no foreign
  stock process was touched.

## Recovered transition contract

The generator appends a 400-unit entrance extension and writes exactly:

1. `LOCK/UNLOCK CAMERA` mode 0 with the combat rectangle;
2. `SLEEP(4.0)`; and
3. `DESTROY OFF-CAMERA OBJECTS`.

Only two vertical entry orientations are realized by this generated branch.
The combat height is `full.h - 400`. A south/bottom entry uses the full origin;
a north/top entry uses `full.y + 375` with the same reduced height. The
reference south Arena is `(0,0,2339.889892578125,3460.110107421875)`, spawns at
`(1323.68310546875,3310.110107421875)`, places the Gate at Y
`3160.10986328125`, and targets
`(0,0,2339.889892578125,3060.110107421875)`. The authentic north run used full
bounds `(0,0,3674.89013671875,2125.10986328125)`, spawn Y `150`, Gate Y
`300.00006103515625`, and target
`(0,375,3674.89013671875,1725.10986328125)`.

Camera action mode 0 intersects that authored target with the Arena and writes
Arena `+0x8E98..+0x8EA4`. It snapshots the current camera endpoints at
`+0x8EA8..+0x8EB4`, starts float32 factor `0.01`, recursively lerps each
endpoint on every 100-Hz tick, and multiplies the factor by exact double `1.01`
until capped at one. The player-follow viewport is clipped to this evolving
region. Generated survival never issues the mode-1 unlock.

After exactly 400 ticks, `0x004728B0` removes off-target scenery, roads,
compact/decor objects, bridges, and derived grid records and rebuilds their
caches. It does not visit the Fence manager. The two Gate leaves remain real;
the active region moves them out of the ordinary playable view. Player tick
does not read the camera target directly, so the Website's hard one-way sealed
boundary is explicitly a requested safety adaptation at the same active-region
owner, not a claim that native action 1065 writes collision.

## Recovered spawn-location and retry contract

`Spawner::Tick` has no runtime `MAXENEMIES` comparison. Location 1 samples a
uniform point over the original full Arena. The default location selects one
eligible player slot and adds a seeded random unit vector of length 100, with
camera-center fallback if no player exists. Native does not clamp that raw
near-player point.

Placement policy 0 requires dark, 1 light, 2 offscreen, 3 accepts directly,
and 4 applies the supplied edge/outside predicate. `0x00463D30` accepts the raw
point first when collision and policy pass. Otherwise it searches concentric
ellipse-compressed rings: radius starts at the actor collision radius and grows
by that radius, the sample count comes from circumference, spacing is
`360/count`, a native inclusive `RandomFloat(360)` chooses the starting angle,
and Y displacement is multiplied by exact `0.8`. Candidates normally must fit
inside the camera target inset by actor radius. Dark policy is the exception:
it bypasses that rectangle test, then changes to direct policy after exact
float radius `350`, resets to two actor radii, and continues.

This proves a subtle stock quirk. `anywhere` plus dark can accept a
collision-free entrance-strip raw point before target containment. The one
authentic run's 16 observed first-wave births all landed inside the target, but
that sample does not make the static reachable branch impossible.

## Website ownership and intentional safety policy

The correct web owner is an authoritative generated-Arena transition state,
created only for `choice.source === 'default' && scene.solomonDig !== null`.
It carries full/combat bounds, open/locking/sealed phase, current interpolated
camera bounds, blend factor, and cleanup countdown. Solomon's `runEventId`
starts it in the same tick as the wave director. Host movement, enemy movement,
spell clipping, and spawn placement consume the combat bounds once sealed;
the renderer consumes the replicated interpolated camera bounds.

The requested no-exterior-enemy rule is intentionally stricter than the stock
dark-policy accident: from transition start onward raw-point admission and
every retry candidate are confined to combat bounds. Native schedule,
near-player/anywhere selection, player-draw ownership, actor radius, and radial
retry topology remain intact. Custom Boneyards retain their authored full
bounds and have null transition state.

## Full-membership validation contract

- North and south generated scenes derive the exact target rectangles above;
  invalid/nonvertical/custom scenes do not synthesize the lifecycle.
- Transition factor begins at float32 `0.01`, compounds through float32 stores
  with double `1.01`, caps at one, and cleanup/seal occurs at 400 ticks.
- Gate leaf identities and motion remain replicated across the transition;
  the Gate is not deleted to fake retirement.
- After sealing, a player and knockback cannot cross into the entrance strip,
  while movement within the combat rectangle remains unchanged.
- Near-player raw points remain 100 units from their selected player; anywhere
  remains uniform without consuming a player draw; actor-radius radial retries
  use the recovered inclusive 360-degree start and 0.8 Y compression.
- Forced entrance-strip raw samples, including dark-policy cases, relocate to
  valid combat points, and every projected live enemy root remains within the
  combat rectangle.
- Snapshot JSON, compact frame, strict protocol, host clone, and presentation
  timeline preserve transition state; camera bounds interpolate continuously
  while phase/countdown remain discrete.
- Browser acceptance physically crosses the entry Gate, triggers Solomon,
  observes the camera contract, attempts and fails to return after sealing,
  waits for wave births, and checks every enemy root against combat bounds with
  no page or console errors.

## Browser acceptance receipt

The focused in-process host/WebGL journey is
`npm run smoke:game:boneyard-entrance`. Final acceptance ran on the arm64 Mac
mini on 2026-08-16. It crossed the generated north Gate, triggered the ordinary
Solomon dialogue and opening wave, and held reverse movement toward the retired
Gate. The live player advanced `176.97852742846294` units toward the entry while
remaining alive, but could neither cross combat Y `400` nor regain the Gate at
Y `310.236`; the focused kernel regression separately reaches and presses
against that exact boundary. The replicated transition was `locking`; all ten
materialized opening enemies and five pending births remained confined,
`outsideCombatEnemySamples` stayed empty through 1,754 wire snapshots, and
page/console errors were empty. The inspected 1600x900 WebGL frame is
`/tmp/sdr-boneyard-gate-wave-mac-final2-combat.png`, SHA-256
`020bdbafa3e7480c1cf327d5343a0dec9c147de5e595321ac27b564fd453f939`.

## Unresolved boundary

The Website retains semantic seeded RNG rather than the stock process-global
RNG stream, so exact stock sample identity and unrelated interleaved draws are
not claimed. Native placement policy 0 also consults the live Arena light
raster, which the authoritative Website server does not own. The confined web
resolver therefore uses the recovered collision/ring path but does not claim
the stock dark-versus-light candidate identity or its 350-unit fallback rerun;
its retained half-unit mobility probe compensates for the web collision
materializer's incomplete native body geometry. Native camera/light queries
likewise use runtime manager state; the browser maps their recovered ownership
onto authoritative world coordinates. The safety restriction removing the
stock-reachable exterior dark birth and the post-seal movement confinement are
declared web policies requested by the user, not hidden approximations.
