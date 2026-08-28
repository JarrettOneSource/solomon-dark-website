# 2026-08-15 — third-pass Water, Earth, Air-light, and complex-shadow closure

This pass was opened because the close web approximations still failed four
direct observations: Frost Jet layering/timing, Boulder roll after release,
Lightning's illumination of the world, and fence shadows with transparent bar
gaps. No renderer changes were made before following each native owner through
construction, manager registration, update, draw, and teardown. All addresses
below come from the preserved 4,723,200-byte retail executable, SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`,
using read-only Ghidra replicas and raw PE-byte checks. The findings supersede
the earlier common-queue Water claim, released-Boulder freeze claim, 50-unit
Lightning light-walk claim, and alpha-hull shadow approximation.

## Water v3: manager ownership, first update, obstruction state, and packing

The rank-1 handler still creates exactly the previously recovered two
Enhanced-Effects-On particles per held tick, 75 percent Normal and 25 percent
Over, using only `BadGuys[30]` plus `[28]`. The residual mismatch is not a
missing third sprite. It comes from native ownership and temporal state:

- Over registration at `0x00543B8A..0x00543B9C` calls vslot `+0x10` on the
  direct Region ObjectManager at `world+0x1E0`. Normal registration at
  `0x00543CF5..0x00543CFE` calls `0x0063E5E0`, wrapping the child in `ZAnim`
  and inserting it into the transient manager at `world+0x8B70`.
- Arena rendering flushes the shared Y-sort queue at `0x0046FDA4`, then draws
  the direct `world+0x1E0` manager at `0x0046FFB7..0x0046FFBD`. Normal is a
  world-Y-sorted child. Over is a later insertion-ordered scene pass. Merging
  them into one painter root changes both overlap and foreground relationships.
- `ZAnim` render `0x005E01E0` calls the Normal child directly, and the Over
  manager likewise calls its child. Neither traverses Puppet local-light
  dispatcher `0x00624B40`. Both Frost classes are self-lit for inbound Region
  purposes; the local cyan/white draw colors must not be multiplied by the
  Boneyard field.
- Region tick updates the player manager at `0x0063F127..0x0063F139`, the
  Normal transient manager at `0x0063F162..0x0063F168`, and the Over manager at
  `0x0063F16D..0x0063F173`. The player creates Frost children before those
  managers run, so a newborn is updated in the same native tick. Its first
  renderable state is completed update age `1`, never constructor age `0`.
  Native fields advance only for `floor(ageTicks)` completed updates; a
  fractional interpolation sample must not make a `for (tick < age)` replay
  perform a premature extra update. Visible ages are `1..31` or `1..32`, with
  removal on update 32 or 33 according to the sampled lifetime. Delete compare
  `0x00453780..0x00453797` is `lifetime <= 0`; the killing update never draws.

Normal's exact equal-row submission family is ordinary dynamic, then
static/scenery, then `ZAnim`. Over is not Y-sorted. In Arena/Boneyard it draws
after the complete shared world queue and intervening world foreground/postqueue
art but before screen feedback/HUD. In the Courtyard it belongs immediately
below the existing late College/southern foreground banks; private rooms also
retain later effect/foreground lanes. This needs an explicit world-sorted
versus post-world-queue painter lane, not a fabricated Y or giant bias.

Normal obstruction is a two-field contract. The handler stores the native
remaining distance at particle `+0x50` and the hit point at `+0x54/+0x58`.
At `0x00543E05..0x00543EB8`, it compares squared caster-to-hit and
caster-to-born-origin radii. Strict `originSq > hitSq` writes distance zero at
`0x00543EBA..0x00543EBC`; equality keeps the computed distance. The hit point
is copied in either case at `0x00543EBF..0x00543ED4`. Therefore retaining only
a nullable point and discarding a hit behind the jittered origin is not native.
Update `0x004536B8..0x004536D1` stores the post-speed remaining distance and
enters the perpendicular half-speed splay when it is less than or equal to
zero. A replicated Water Normal child needs both `obstructionPoint` and
nonnegative `obstructionDistance`; Over owns neither.

Prediction begins at caster position, uses mask `0x380`, and computes
`lifetime/0.04 + jitterRadius` without a float store between division and
addition. The stored distance itself uses float32 `dx`, `dy`, sum of squares,
square root, and result. After splay the particle's core/glint rotation remains
the born heading in fields `+0x2C/+0x30`, even though position and glint lead
use the perpendicular velocity. That born heading must be explicit snapshot
state rather than reconstructed from the changed direction.

The final Water color difference is byte packing. `0x0041FE50` performs the
float32 RGBA multiplications, then `0x0041FEEB..0x0041FF45` multiplies each by
double `255` from `0x007DE830` and reaches `CVTTSD2SI` in `0x00747360`.
In-range RGB bytes use truncation, and effective sprite alpha is
`trunc(alpha*255)/255`. `Math.round` tint and an unquantized Pixi alpha are
both observable deviations.

Required Water regressions are: semantic birth at age one; floor-only replay
for fractional snapshots; 31/32 visible states; retained hit plus zero
distance when jitter begins beyond a wall; splay on exactly zero; Normal
sorted and Over late; both roots `regionLightPoint=null`; records 30/28 only;
and native-truncated local RGB/alpha. These are presentation/lifecycle fields,
not inferred damage or a third effect.

## Earth v3: authoritative accumulated matrix and missing CalledRock pass

The Boulder vtable is `0x0079E014`; constructor `0x005FA270` initializes its
orientation matrix at `+0x154` to identity through `0x00402CC0`. Release
`0x005E5450` changes the held/flight bytes at `+0x1DC/+0x1DD` but neither
rewrites nor freezes that matrix.

Every tick `0x00609D84..0x00609E33` derives a normalized roll axis from live
heading `h`:

```text
a(h) = (cos(h), sin(h)/sqrt(1.64), 0.8*sin(h)/sqrt(1.64))
```

Equivalently, for movement `d=(sin(h),-cos(h))`, the axis is
`(-d.y,d.x/sqrt(1.64),0.8*d.x/sqrt(1.64))`. While held,
`0x00609E3D..0x00609E5D` postmultiplies the existing matrix by a row-vector
Rodrigues rotation of `0.75` degrees around that tick's live-aim axis. Aim
history is therefore part of presentation state.

On each surviving flight tick, `0x00620B60` performs this order:

1. pass the early arena/range retirement guard;
2. compute and float32-store `position += speed * (sin(h),-cos(h))`;
3. measure the actual stored delta and store
   `theta = float32(hypot(delta.x,delta.y)/charge)` degrees;
4. postmultiply `Mnext = float32(Mold * Rrow(a(h),theta))`; and
5. only then query terrain/actor contact and potentially break up.

Thus a terminal impact tick advances and rolls before fragment birth. An early
guard deletion does neither. At speed `3`, charge `1` rolls `3` degrees/tick;
minimum observed release charge `0.3012498915195465` rolls
`9.95850944519043` degrees/tick. Helper `0x00403340` constructs the row-vector
Rodrigues matrix and `0x00402D40` proves postmultiplication `Mold*R`, not
`R*M`. Drawing at `0x0060AC40` transforms local `[x y z 1]*M`, rejects strict
`z<=-40`, sorts ascending transformed Z, and submits orthographic transformed
X/Y. An age-derived axis or quaternion cannot preserve retarget order and
native float32 storage boundaries. The authoritative Earth state must carry
all nine finite row-major matrix components discretely across snapshots; it
must never component-interpolate them.

Two golden matrices pin multiplication order. Identity followed by held
heading zero gives approximately
`[1,0,0, 0,0.9999143481,0.01308959536, 0,-0.01308959536,0.9999143481]`.
Held heading zero followed by heading 90 gives approximately
`[0.9999143481,0.008177005686,-0.01022125687,
-0.008042513393,0.9998814464,0.01313068997,
0.01032741554,-0.01304737944,0.9998615980]`; reversing the products differs
and must fail.

The residual gathering effect is in `Anim_CalledRock::Render` `0x0045E440`.
With Enhanced Effects On and perspective height `+0x20 < 0`, it first draws an
auxiliary copy of the same chosen lit-rock record `BadGuys[2008..2010]` at the
base world XY, scale `mainScale*0.75`, then draws the rotating full-scale main
copy at `y+height`. At nonnegative height or Enhanced Effects Off only the main
copy exists. Record 18 belongs adjacent dust/fade actors and is not this pass.
Both CalledRock passes are direct/self-lit world-animation draws.

The Boulder body is an ordinary Puppet root registered after its owning
Player. Native Y rows can place the entire Boulder either behind or in front of
the entire Player; the Staff orb is nested inside the Player renderer and has
no independent native root. Consequently “Boulder always above its Staff orb”
is an explicit web presentation requirement rather than a stock invariant.
Its implementation must target only the owner's Earth body ordering and leave
other projectiles, scenery, and players on native row order.

Finally, presentation-local frame counters are invalid for the aura, root
jitter, and opening rotation: recreating a view currently resets them. Use an
authoritative semantic tick/age so reconnect and view replacement do not reset
the visible phase. Stable ID hashes remain a deterministic approximation of
the unrecovered shared global RNG sequence, not a claim of identical native
sample identity.

## Air v3: native branch mesh and factory-owned path lights

The existing dual ribbon, QuickSpline, and contact corona are only part of the
normal Lightning factory. Each call to tessellator `0x00534510` independently
gates one flare branch with `RandomInt(2)` at `0x00534A11`. A successful branch
appends four vertices and six indices into that same layer mesh and therefore
inherits its additive state, tint, and alpha. It attaches at `U(2)` spline
parameter and uses BadGuys records 375/376:

| geometry record | cropped image | native local quad |
| ---: | --- | --- |
| 375 | `39 x 73`, logical `90 x 146`, origin `(-18.5,-27.5)` | `(-38,-64),(1,-64),(-38,9),(1,9)` |
| 376 | `40 x 185`, logical `96 x 372`, origin `(-20,-77.5)` | `(-40,-170),(0,-170),(-40,15),(0,15)` |

Scale is `0.25+U(0.5)`, except `RandomInt(30)==1` forces one. X mirroring,
geometry choice, and texture/UV choice are independent, so all four 375/376
geometry-image pairings occur. Rotation derives from the selected geometry's
first coordinate pair with the second component negated, normalized to
degrees, then adds `U(45)`. The branch translates to the exact QuickSpline
point. The Website already ships both cropped PNGs but previously never loaded
them for Air.

Bolt construction uses phase `-3*nativeManagerTick` for the white layer and
that phase plus `15` for cyan. It is not keyed to transient ID or current
display frame. Geometry is fixed on construction. Deterministic browser
sampling may seed from semantic identity/birth tick, but its intra-layer state
must mirror the native unsigned mixer and signed-absolute normalization rather
than the previous xorshift.

Record 44 uses two mapped half-texture rectangles, not a binary `v=pair%2`
shortcut. For `N` ribbon pairs, normalized V is zero at both endpoints and
`i` odd ? `1` : `0.5` for interior pair `i`. The seven-pair shipped-rank-1
oracle is `[0,1,0.5,1,0.5,1,0]`; both vertices of a pair share that V.

Factory `0x00531640` also owns one-shot Region `MiscLight` objects along both
straight control legs, independently of the five-age contact `ZAnimLit`:

- advance each leg by exactly `100` while remaining distance is greater than
  `50`, and also consider the exact leg endpoint; the midpoint can be emitted
  once by each leg;
- emit only samples whose distance from the original source is at least `220`
  (`distanceSquared >= 48400`);
- publish at `(x,y+35)`, radius `0.75+U(0.25)`, and one shared factory-wide
  intensity `0.25+U(0.75)`; normal player casts use that full intensity;
- use Enhanced Effects, shipped On, as the directional-shadow flag. It is not
  the global Multiple Shadows option; and
- register the MiscLights once at transient age zero. Contact light continues
  through ages zero to four, while the two-age ribbon ends after age one.

For source `0`, midpoint `350`, and endpoint `650`, the path x samples are
`[350,350,450,550,650]`. Region render submits ordinary owner providers first
and replays MiscLights afterward. The web must preserve that tail-batch order:
inserting path lights beside the Air contact changes one-way containment and
can wrongly suppress a later flag-zero Lantern/contact source. Contact itself
has local Multiple Shadows false, so it creates no directional record, but all
accepted sources contribute to every directional record's `behindScalar` and
can shorten or remove the path-light shadow tails.

## Fixed-tick primary transient admission across sparse snapshots

The residual Air-light ordering audit exposed a shared presentation-clock
defect, not an Air-only renderer defect. The authority creates retained primary
transients at 100 Hz, while a normal 20 Hz pair at ticks `100` and `105`
contains five intervening birth cohorts. Holding the older transient array
until blend one freezes its members for five display ticks and then admits all
new Water/Fire members as one batch. For Air this also replays one old
age-zero path-MiscLight batch across multiple Region ticks while skipping the
intervening factory births.

Every fixed-lifetime transient must instead be merged from both bracketing
snapshots by semantic id, admitted at its owned fixed tick, and aged from the
fractional presentation target tick. The age-zero tick is explicit for Air,
Earth impact, and Ether impact. It is exactly reconstructible for retained
Fire particle, Fire impact, and Water snapshots as
`snapshotTick-ageTicks`; Water is the sole first-visible-age-one family, so its
actual admission tick is that reconstructed age-zero tick plus one. Admission
is `displayAge >= firstVisibleAge`, retirement is
`displayAge >= lifetimeTicks`, and stable painter order is birth tick then id.
Air exposes `floor(displayAge)` so its age-zero Misc queue exists for exactly
one 100 Hz interval; Water's native recurrence already floors completed
updates. Fire particle/impact motion and Earth impact fragment motion retain
their intentional fractional presentation age between fixed states, while
Ether's renderer performs its already recovered completed-update flooring.

`earth-called-rock` is deliberately outside that merge rule. Its lifetime and
mutable absolute pose depend on the parent Boulder, and a later snapshot
cannot reverse its current position/height/fall state into the missing birth
pose or recover its exact early removal tick. Matching CalledRock identities
continue to interpolate authoritative absolute state; closing their skipped
birth edge requires a retained semantic birth seed/history, not a guessed
fixed lifetime or a `birthTick` alone.

## Complex shadows v3: authored normals, real gradient meshes, and fence bars

The shared projector was still fundamentally inverted. Shape close helper
`0x00655570` stores every authored edge normal as `(dy,-dx)` and never
normalizes polygon winding. Projector `0x00655970` computes
`normalize(edgeMidpoint-source)` and accepts strict
`dot((dy,-dx), midpoint-source)>0`. Current web used `source-midpoint` plus a
signed-area winding correction. Remove both inventions: the native tables have
mixed winding and authored normals are intentional. For square
`[(-1,-1),(1,-1),(1,1),(-1,1)]` with source `(-10,0)`, native accepts top,
right, and bottom edges, not the left/source-facing edge.

Each accepted edge is one real four-vertex/six-index gradient quad. Root
vertices carry `baseAlpha`; projected vertices carry
`((1-behindScalar)*(1-distanceFraction))^3`. Twelve flat-alpha Graphics bands
are not a native equivalent and obscure both direction and gaps.

Recovered exact authored outlines are:

- Gravestone `0x0060F260`, table `0x0081BE50`: the 17 selector-specific
  quadrilaterals recorded in the Mod Loader ledger, selected directly by the
  stored short at `+140`.
- Fencepost `0x00612DC0`, table `0x0081B0B8`: selector plus `7*style`; style
  one uses the corresponding base quadrilateral scaled by `0.45` then shifted
  one unit upward in native local coordinates.
- Monument painter `0x0060E280` indexes 21 authored rows at `0x00819EE8` by
  selector. Row zero is `[(-51,22),(-51,-27),(50,-27),(50,22)]`; treating it
  as invariant silently breaks the other 20 rows.
- Goodie painter `0x0061F180` indexes `0x0081B390` by subtype rather than
  visible phase. Static analysis currently closes row zero only:
  `[(-33.5,22.5),(-33.5,-11.5),(34.5,-11.5),(34.5,22.5)]`.
- Building painter `0x0060EDC0` indexes four authored rows at `0x0081B430`.
  Variant zero is the recovered 12-point concave outline; the other variants
  are separately recorded in the Mod Loader ledger. None may be collapsed to
  a convex alpha hull.

FenceGrate is not a generic polygon. `FenceGrate::RenderShadow` `0x00600ED0`
is shared by intact FenceGrate, broken grate, and moving Gate. Builder
`0x005E8100` shortens the endpoints by inset `12` and stores a nominal
`13.333333` step/count. For each eligible shadow record, every bar center is
`shortStart + 0.5*step + i*step`. Each is projected away from that record's
source into a tapered quad: near half-width `2` at base alpha, far half-width
`8` at zero alpha. A separate width-four rail shadow uses alpha
`0.1*behindScalar + 0.9*baseAlpha` and the recovered one-eighth endpoint/source
offset. Transparent space between bar quads is required stock geometry; a
convex fence or solid Gate-leaf shadow cannot reproduce it.

Rails, Wall, and Scrub also own class-specific painters (`0x00607440`,
generated Wall shape through `0x006561A0`, and transformed Scrub asset quad).
Alpha-derived convex hulls are fallback-only for still-unrecovered classes,
never a universal native caster contract.

The implementation gate for this pass must therefore combine pure instruction
goldens with real WebGL evidence: long Air across graves and intact/moving
fence, exact accepted light counts/positions, self-lit Frost Normal/late Over,
released Boulder roll, the missing CalledRock base copy, correct far-edge
direction, per-bar transparent gaps, and shadow tails shortened or eliminated
under Air illumination. No screenshot can substitute for the semantic and
mesh assertions, and no unit-only result is final without the browser flow.

## Targeting/range and Fire adjacency audit at this baseline

This subsection is the pre-query snapshot at Website `5d532e4`; the
immediately following query and contact closures supersede its “currently
missing” statements.

The same exact-tree read-only audit separates already-correct targeting from
still-missing contact authority:

- Cast-facing is already authority-owned. `PlayerActor::Tick 0x00548B00` and
  heading helper `0x0042D280` keep attack facing separate from movement, and
  the Website now retains that ownership through one-shot actions and held
  channels.
- Rank-1 Air already reacquires the 30-degree Region-bound cone, prioritizes
  combat actors before priority-1000 Gravestones, preserves same-priority
  nearest ordering and LOS, retains a live prior target at dot at least
  float32 `0.71`, clips the target attachment, applies Y `-20`, and constructs
  the off-axis QuickSpline control point from original aim. The no-target ray
  and Gravestone fallback are not a remaining targeting defect.
- Ether already acquires the nearest flags-bit-one enemy to
  `spawn+aim*100` under squared distance `999999`, without LOS, moves on the
  old heading then steers the following tick, clears a lost rank-1 target, and
  uses neutral Staff rate `0.075` versus Fire `0.05625`, with held repeat.
- Fire's registered flight/body/trail/light and 16-age contact burst asset
  stack is complete. The remaining missing visual is lifecycle: the web checks
  terrain but not native post-move actor contact, so the otherwise-correct
  burst/light/hit cue does not appear when a Fireball crosses an enemy.

Full gameplay contact remains incomplete at this baseline: Air publishes ray
geometry but not per-held-tick damage/contact; Water lacks its native reach-205,
15-degree, mask-`0x1082` multi-target cone with per-target LOS; Earth lacks the
native actor-contact/distinct-target lane; Ether uses an approximate center
distance and silently deletes without the 20-tick `Anim_FadeMM`, light, or hit
audio. These are not licenses for guessed radius checks. The actor query/body,
eligibility, and contact contracts must be recovered and published before
their authoritative implementation.

## Third-pass closure: Fence builders and rank-one actor queries

The final FenceGrate builder trace changes the earlier shorthand. All three
families reach custom shadow renderer `0x00600ED0`, but they do not share one
endpoint/count builder:

- intact `0x005E8100` stores endpoints inset by 12, stores direction times
  float `13.333333015441895`, and sets
  `count=trunc(shortLength/storedStepLength)+1`. Exact multiples intentionally
  produce one more bar. The renderer samples centers at half a stored step;
- Broken `0x005EC6E0` chooses one endpoint by side, creates its own randomized
  roughly-52-unit half segment, insets it by 12 and then another 6 for working
  geometry, stores direction times 8, and uses the same truncation-plus-one
  count form. The serialized full fence endpoints are not its shadow segment;
  exact browser reconstruction remains tied to the unrecovered native shared
  RNG sample that also owns the broken art; and
- moving Gate helper `0x005ED100` copies the leaf's current endpoints every
  motion tick, insets them by 4, derives its step from shortened length divided
  by 4.5, and stores the same truncation-plus-one count (normally five). Gate
  shadow bars therefore rotate with each live leaf, rather than projecting a
  fixed solid leaf or the original full post span.

The shipped generated Boneyard used for the browser journey contains intact
grates and one Gate, so both exact implementable programs must be exercised.
Broken-grate native sample identity remains an explicit shared-RNG boundary;
it must not be mislabeled as the intact program.

The actor-query adjacency pass is now instruction-closed enough to separate
observable rank-one contact from unimplemented combat authority. Common
Puppet fields are actor flags `+0x14`, body radius `+0x30`, pending removal
`+0x05`, active/retention byte `+0xF9`, and priority `+0xFC`. Coffin constructor
`0x00479940` explicitly clears actor flags at `0x00479A34`; registration can
only add bit `0x40`. Coffin therefore fails Air/Fire/Ether/Earth mask 6,
Ether mask 2, and Water mask `0x1082`. Publishing every wave token as a
targetable generic enemy is wrong.

Point query `0x00641220` delegates to `0x00522E30`: each coordinate is divided
by the 100-unit cell size, stored as float32, and converted with truncation
toward zero (`0x00747360`), not floor. It inspects only that cell's live pointer
vector in ascending slot order and accepts strict
`distance < queryRadius + candidateBodyRadius`. Equality and even overlapping
geometry across a 100-unit cell boundary miss. This is not a nearest-target
search; for example, native `-0.25 / 100` selects cell zero rather than -1.

Rectangle/circle broadphases `0x00522F50` and `0x00523140` apply the same
float32/truncation conversion to both inclusive AABB endpoints. They traverse
cell X in the outer loop, cell Y in the inner loop, then the current cell
vector's slots in ascending order. The Website's `registrationOrder` is a
deterministic projection of that per-cell slot order. Exact native actor rebind
timing and slot identity remain an authority boundary; a global registration
sort must not be described as native traversal.

- Fire `0x005FDD90` performs its age-mod-five terrain lookahead before moving,
  then advances 4.5 and point-queries radius 20/mask 6. Actor contact removes
  the projectile, plays registry-30 `fireballhit`, creates the existing
  16-age burst/light, and still emits exactly one final regular trail child.
  Terrain contact returns before that final child.
- Ether moves and then point-queries radius 6. While age is below 200 and its
  original target remains active it uses mask 2; otherwise it uses mask 6.
  It can hit an intervening eligible actor. Normal rank-one contact
  `0x005F1F00` plays `magicmissilehit`, creates a construction-20-update
  `Anim_FadeMM` whose same-tick registration yields 19 drawable frames,
  using the full Ether compositor
  wrapped by its light, then removes the missile. Active `+0xF9` is ordinary
  world membership/retention, not Wraith invisibility.
- Water cone query `0x00641B10` processes every eligible root strictly inside
  reach 205 and the 30-degree full aperture, with pending/type/LOS filters.
  Candidate body radius is irrelevant. It owns gameplay contact but no
  target-local hit sprite or sound; the Frost children remain cast-owned.
- Earth's flight query uses root distance strictly below `75*charge`, ignores
  body radius, and holds a per-Boulder distinct-target set. Contact may shrink
  and rebuild the Boulder but is not terminal; fracture occurs only when its
  damage pool is exhausted.
- Air acquisition remains priority then distance and Gravestone fallback, but
  held-tick gameplay contact applies only to flags-bit-two actors. A Grave is
  a visual endpoint, and rank one has no chain hop.

The web can exactly model eligibility, Coffin exclusion, cell/order/radius
querying, Fire/Ether endpoint presentation, and observable contact event
ordering. It cannot claim exact HP, resistance, status/death/reward, native
recipe-scale RNG, actor rebind timing, Earth's damage-pool shrink/terminal
decision, or the bit-four scenery shape gate without additional authority.
Those boundaries must stay explicit rather than triggering guessed damage or
terminal Earth breakup.

## Fourth-pass closure: Rails, Wall, and Ether contact presentation

Rails and Wall are now instruction-closed custom shadow programs rather than
alpha-hull cases. Rails builder `0x005F0EC0` stores `P=A+4u`, `P1=B-4u`, and
`s=f32(u*13.333333015441895)`, with
`N=trunc(distance(P,P1)/length(s))+1`. Its renderer `0x00607440` deliberately
uses far baseline `Q=P+N*s`, not `P1` or `P+(N-1)s`. Per directional record it
draws exactly two width-10 black line quads: endpoints `P-(L-P)/5`,
`Q-(L-Q)/5`, then the corresponding divisor-1.5 pair. Both use alpha
`0.9*baseAlpha+0.1*behindScalar`. Construction-time visible-rail RNG never
enters this shadow painter.

Wall builder `0x005EEBB0` extends a disconnected start backward 15 units and a
disconnected end forward 15 units; connected ends remain at serialized A/B.
Renderer `0x0061E780` calls `0x006561A0` once per current-frame light record.
That helper emits `[S0,S1,E0,E1]`, with `E0/E1` projected radially by the
record distance, near alpha `baseAlpha`, far alpha
`((1-behindScalar)*(1-distanceFraction))^3`, and indices
`[0,1,2,2,1,3]`. Neither class persists a shadow lifetime: common wrapper
`0x00624B40` clears and rebuilds its records every render. The generated
acceptance Boneyard has no code-3 Wall or code-4 Rails segment, so their
browser-independent regressions use synthetic geometry while the shipped
journey exercises intact FenceGrate and Gate.

Ether contact is also closed precisely. `0x005F1F00` initializes FadeMM scalar
`2.0`, fixed compositor scale `2.0*missileVisualScale`, and decrement `0.1`.
Tick `0x00454000` stores `f32(F-0.1)` before testing `<=0`. Because the new
ZAnim child is updated later in the same Region tick, drawable web age zero
maps to native `F[1]=1.9`; drawable ages zero through 18 map to `F[1]..F[19]`.
The fixed scale does not decay. Each compositor pass alpha is multiplied by
that float32 fade.

FadeMM passes sentinel `-9999.0f` to compositor `0x00535A30`, which substitutes
the active Arena fixed-tick counter. Impact phase is therefore synchronized
world time (`+1` per 100-Hz tick), not missile phase or presentation frame.
ZAnimLit owns radius `0.75`, intensity `1.0` with float32 delta `-0.05` applied
in the same birth tick, local directional-shadow flag false, and painter bias
`100` (not light radius). First drawable light intensity is `0.95`; the last
is about `0.05`. Registry 58 `magicmissilehit` uses pitch
`f32(1+U(0.1))`. Flight and contact child renderers both install their own
colors and therefore expose no Region-light tint sample.

## Integrated implementation receipt and remaining authority boundary

The combined implementation carries the recovered actor flags, body radius,
priority, active/pending state, and a deterministic per-cell slot-order
projection together with primary spell state over protocol v18. Coffin is no
longer treated as a rank-one enemy
candidate. Air performs priority/LOS/Gravestone acquisition and renders the
exact semantic QuickSpline; Ether acquires, homes, contacts, and produces the
nineteen-frame FadeMM/light/hit cue; Fire contacts eligible actors and terrain,
retains the actor-hit final trail child, and produces its sixteen-age burst.
Earth orientation is an authoritative float32 matrix that keeps postmultiplying
in flight, including a terrain-contact tick. No one-shot projectile uses the
legacy 500-tick PoC retirement.

Frost Normal and Over retain their distinct owners: Normal is world-Y-sorted
through ZAnim and Over is a late post-world draw. Both are self-lit, begin at
their native same-tick-updated age, preserve obstruction point plus remaining
distance including the zero-distance case, use the recovered three-pass/two-
pass sprite programs, and truncate their packed color/alpha lanes. Static RE
found no third rank-one Frost sprite; the apparent residuals were ownership,
age, sine phase, obstruction, and quantization errors.

The Earth body uses record 15 as the persistent aura, record 86 only as the
opening flash, discrete `[168..171]` shell rebuilds, the Enhanced-Effects
CalledRock base copy, and independently rooted breakup fragments. Stock nests
the staff orb inside the Player root, so “always over the orb” is not a native
invariant. The requested web policy promotes only the owner's Earth Boulder
root above the owner; this necessarily also covers the owner's robe/head when
their painter rows would otherwise overlap, without changing other spells or
scenery.

Region lighting now preserves provider-before-MiscLight enrollment, Air's
age-zero path sources, the five-age non-directional contact source, containment
semantics, and behind-scalar shadow-tail removal. Generic complex shadows use
authored normals and indexed gradient quads. Grave, Fencepost, Monument,
Building, Tree, intact FenceGrate, moving Gate, Rails, and Wall select their
recovered authored/custom programs; fence gaps remain transparent. Sub-byte
shadow alpha is truncated through the native 8-bit packing boundary before
Pixi submission.

Water's strict reach-205/half-aperture-15-degree/LOS multi-target query,
Earth's strict root-distance-below-`75*charge` distinct-contact query, and
Air's selected hostile endpoint now feed the existing authoritative enemy
damage lifecycle. Fire and Ether do the same after their exact point-query
contact. This publishes the observable rank-one damage/contact edge, but it
does not claim native resistance/status/push math, recipe-scale RNG, or
Earth's pool/toughness/shrink and terminal-fracture decision. Actor contact
therefore never fabricates an Earth breakup. Fire's bit-four
scenery shape gate, Broken-Fence shared-RNG sample identity, Goodie authored
rows beyond subtype zero, and exact native global-RNG/recipe-scale identity
remain explicit boundaries. None is replaced with a guessed terminal burst,
damage radius, alpha hull, or private timeout.
