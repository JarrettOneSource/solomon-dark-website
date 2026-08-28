# 2026-08-14 — Water primary Frost Jet presentation closure

## Reported mismatch and correction boundary

- Reported web behavior: Water looks closer than the other unfinished
  primaries, but its moving, single-sprite stream still does not resemble the
  stock cast.
- Reproduced Website baseline: commit `989aab3` emits one Water transient per
  held 100 Hz tick. `primary-spell-world-view.ts` cycles four sprites by
  `id % 4`, moves each sprite linearly through the full `205`-unit gameplay
  reach, grows it from `0.45` to `1`, and applies one additive fade. The prior
  browser Water receipt is SHA-256
  `b1dc67850d95ed11ab021c0251186a8cd76a640f9e694eaad861fa938586f36b`.
- Native correction boundary: close rank-1 Frost Jet creation, motion, update,
  draw, blend, tint, density, audio, contact ownership, release, and expiry.
  Hail, Cold Aura, Harden, Permafrost, damage/status authority, and an
  Enhanced Effects UI are adjacent evidence only and are not implemented here.

## Evidence and exact provenance

| Evidence class | Exact source | Water consequence | Confidence |
| --- | --- | --- | --- |
| Preserved retail image | `SolomonDarkAbandonware/SolomonDark.exe`, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` | Source of every address, constant, vtable, and settings default below. | high |
| Fresh static pass | read-only headless Ghidra 12.0.3 project `Decompiled Game/ghidra_project/SolomonDark`; handler `0x00543860`, constructors `0x00453550`/`0x00453840`, update `0x00453670`, renders `0x00457720`/`0x00457A00`, settings load `0x005BAB60`, settings builders `0x005D9A50`/`0x005DAEF0` | Closes the two Frost particle classes, field recurrences, all draw passes, option-controlled density, and shipped setting policy. | high |
| Preserved native runtime | `D:\codex-evidence\spellre-20260804\live\frost-rank1-queue150.raw.txt`, `frost-rank1-real-mouse.raw.txt`, lifecycle records beside them; G2 source commit `1b9d454da60afefa2cb5f01a0f6e8ce829efebe6` | Confirms held-tick contact cadence, start/stop selection, rank-1 reach, and visual lifetime band without turning particles into gameplay projectiles. | high |
| Preserved instrumented stock frame | `D:\codex-evidence\beta28-release-20260731\acceptance\screenshots\client-b-water-bot-retail-wave.png`, 1606 x 929 RGBA, SHA-256 `116eb2378541aef6c436f20fa03f7d62a5c83b6222b1e50ddffb35fe27f6eb3b` | Visually corroborates a short, layered blue-white spray near the caster rather than a sprite travelling to cone range. The frame is partly occluded and is not treated as clean-stock pixel geometry. | medium |
| Native sprite registration | `BadGuys.bundle`/`BadGuys.png` from the same retail tree, parsed by `tools/extract-hub-assets.py` | Rank-1 uses registered record 30 (`93 x 145`) and record 28 (`10 x 11`). Records 32 and 14 are learned Hail/Cold Aura branches, not Frost stream variants. | high |

A fresh direct-retail capture was intentionally deferred when read-only process
inventory found unrelated `SolomonDark.exe` PIDs `18792` and `23472` in two
foreign staged runtimes. Those processes were not focused, modified, or
terminated. Clean-stock Water On/Off image evidence remains a required final
receipt, not something inferred from the instrumented frame.

The first integrated browser receipt exposed a full-courtyard cyan wash and
triggered an operand-width audit of the raw x87 instructions. The earlier pass
had read the low four bytes of two eight-byte constants even though opcode
`DC` explicitly consumes a QWORD. At `0x004537E6`, bytes
`00 00 00 40 E1 7A 84 3F` decode as double
`0.009999999776482582`, not float `2`. At `0x004537B1`, bytes
`00 00 00 40 33 33 B3 3F` decode as double
`0.07500000298023224`, not float `2`. Constructor instruction
`0x00453622` also loads the four-byte bound at `0x007845E8`, bytes
`CD CC CC 3D`, or float32 `0.10000000149011612`; the previous `0.5`
color-ramp bound was wrong. The corrected values below are instruction- and
raw-byte-backed; this visual falsifier is why the initial green unit tests were
not accepted as final evidence.

The complete presentation-constant width audit is:

| Address | Storage | Exact value | Native role |
| --- | --- | ---: | --- |
| `0x007849F0` | DWORD | `0.05000000074505806` | lifetime random bound; Normal phase step |
| `0x00784740` | QWORD | `1.25` | lifetime base |
| `0x007DE934` | DWORD | `0.75` | additive alpha; core-scale random bound |
| `0x00784E7C` | DWORD | `0.03999999910593033` | lifetime decrement |
| `0x007DE808` | QWORD | `0.5` | core base; Over phase factor; wall-splay speed factor |
| `0x007DE838` | QWORD | `2` | glint-scale base only |
| `0x007845E8` | DWORD | `0.10000000149011612` | color-ramp random bound |
| `0x007DE8A0` | QWORD | `0.05000000074505806` | additive-alpha decrement |
| `0x00784EA8` | QWORD | `0.07500000298023224` | color-ramp decrement |
| `0x00784E20` | QWORD | `0.949999988079071` | late-life glint shrink |
| `0x00784D08` | QWORD | `0.009999999776482582` | late-life core growth |
| `0x00784970` | QWORD | `0.8999999761581421` | Normal glint opacity gate |
| `0x007DE910` / `0x007DE8F0` | QWORD | `3` / `0.25` | glint offset/Over alpha; Over scale |

## Pass 1: causal ownership from input to teardown

```text
world primary held level + current aim
  -> PlayerActor sustained dispatcher 0x00548A00
  -> Water skill 32 handler 0x00543860 each native tick
  -> exact Staff socket 0x0053B830 + current heading
  -> rank-1 cone/LOS contact query and independent render-particle creation
  -> Normal: ZAnim wrapper in the transient world Y-sort queue
  -> Over: direct Region ObjectManager rendered after the shared Y-sort queue
  -> Frost virtual update 0x00453670
  -> Normal render 0x00457720 or Over render 0x00457A00
  -> lifetime below zero removes each visual independently
release -> no new query/particle -> registry 161 loop owner released once
```

- Input and the sustained action own the held lifetime. Water retains the
  constant Staff action: insertion uses socket bank `K=0`, later held ticks use
  `K=7`. The emitter follows that exact socket and the aim sampled for the
  current authoritative tick; each born particle then folds in its native
  radial jitter. The player-facing consequence is upstream: heading must track
  the cast direction before socket selection; Water does not own a separate
  renderer-facing override.
- `0x00543860` performs gameplay contact immediately. At rank 1 it queries a
  `205`-unit cone (`180` base plus `25`) through `0x00641B10`, mask `0x1082`,
  then applies per-target line of sight. There is no Frost projectile radius,
  flight actor, gravity, pierce, or travel-to-range timer. Multiple targets
  may be contacted during one held tick.
- The visible objects are separate `0x5C`-byte transients. `FUN_00401170(4)`
  selects `Anim_FrostJetEffect_Over` only when it returns `1`, giving a 25%
  Over / 75% Normal class split. The class decision changes rendering and
  terrain behavior; it is not a frame selector.
- Start owns registry 44 `sounds/icestart.wav` and owner-keyed loop 161
  `sounds/iceloop__loop.wav`. Held ticks do not reacquire the loop. Release,
  selection change, player removal, world replacement, and presentation/audio
  teardown must balance it exactly once. Existing particles finish after the
  loop/contact channel stops.
- Authoritative simulation owns emission IDs, origin, direction, age, world
  key, and removal. Snapshots replicate those semantics. Presentation may
  interpolate a live particle but must not synthesize missed particles or
  replay historical audio.

## Particle creation, motion, and terrain nuance

For neutral rank-1 Water, `mWiden == 0`:

- query half-width/density use `mWiden + 15`, but visual direction does not;
- native heading is
  `casterHeading + sin((worldTick + ordinal * 65 / particleCount) * 65 deg)
  * effectiveWaterCastSpeed`, with neutral effective cast speed `1`, so the
  rank-1 stream wiggles only about one degree around aim;
- the handler advances its pre-multiply phase accumulator by
  `65 / particleCount` between particles created in the same tick;
- spawn is the exact Staff socket plus radius `U[0,10]` along
  `casterHeading +/- U[0,45 deg]`;
- velocity is the heading unit vector times exactly `4` world units/tick; and
- constructor lifetime is `L0 = 1.25 + U[0,0.05]`, then `L -= 0.04` per
  update. Removal below zero produces 32-33 completed native updates.

The intra-tick phase is instruction-closed, not inferred from the visual:
`0x005439D0..0x005439DA` loads the particle count, divides constant double
`0x00784D90` (fresh raw value `65`) by it, and stores the step;
`0x00543A86`/`0x00543BA3` consume the mutable phase for Over/Normal heading;
and loop tail `0x005440A2..0x005440AE` decrements the count and adds the stored
step before the next creation. The accumulator is multiplied by `65` only
after that addition. With the shipped count of two, the second particle is
therefore `32.5` accumulator units, or `2112.5` degrees modulo the sine,
ahead of the first -- not merely `32.5` degrees ahead.

The `205` gameplay reach is therefore not visual travel distance. A typical
particle moves about `128`-`132` world units before expiry. Replacing the
native spray with a sprite interpolated through `205` is the central current
web error.

Normal particles predict their path and call world clip `0x00524D70`. A
recovered contact distance and point are stored at `+0x50` and `+0x54/+0x58`.
When the remaining distance crosses zero, update snaps to the point, rotates
velocity to a randomly signed perpendicular, halves it, and clears the pending
distance. This is a cosmetic wall-splay/ricochet; it does not own Frost damage.
The Over creation path deliberately skips this clip setup. The original
presentation closure implemented only unobstructed motion; the second pass
below supersedes that limit with an authoritative Hub/Boneyard obstruction
snapshot and the recovered Normal splay recurrence.

## Exact update and render equations

`Anim_FrostJetEffect` construction/update fields are:

| Field | Construction | Per completed update |
| --- | --- | --- |
| lifetime `+0x1C` | `1.25 + U[0,0.05]` | `-0.04`; delete below `0` |
| opacity phase `+0x20` | `0` | Normal `+0.05`; Over `+0.025` |
| position `+0x14/+0x18` | registered socket plus radial jitter | `+= velocity` |
| heading/velocity `+0x2C`, `+0x24/+0x28` | native heading; speed `4` | wall-splay branch above |
| additive-core alpha `+0x3C` | `0.75` | `-0.05` |
| main scale `+0x40` | `S0 = 0.5 + U[0,0.75]` | if lifetime `< 1`, `+0.009999999776482582` |
| glint scale `+0x44` | `Q0 = (2 + U[0,1]) * S0` | if lifetime `< 1`, `*0.95` |
| color ramp `+0x48` | Normal `1 + U[0,0.10000000149011612]`; Over overrides it to `0` | `max(0, value - 0.07500000298023224)` |
| opacity multiplier `+0x4C` | `1` | unchanged |

Every persistent field above is rounded on its native `fstp DWORD` store.
That includes bounded random samples before their constructor additions,
velocity and every iterative position update, the `L * L` Normal alpha local,
and both multiply-then-add components of the forward glint position. Replacing
those recurrences with `origin + velocity * age` is measurably different for
non-axis-aligned particles.

The native draw color is `(max(0, 1 - colorRamp), 1, 1)`: Normal starts cyan
and restores red gradually over roughly 14-15 completed updates; Over is white
from construction. Core scale likewise grows by about `0.01` per late-life
update, never by whole sprite multiples. Registered full-canvas assets retain
native registration and are center-anchored. Their deterministic web files are:

Both rank-1 vtables prove that update ownership is shared: Normal
`0x00784E84 + 0x08` and Over `0x00784EB4 + 0x08` each contain
`0x00453670`. The adjacent wrapper at `0x00453870`, which subtracts `0.01`
from core scale after that shared update, belongs instead to
`Anim_FrostJetEffect_Chaining` (vtable `0x00793D74`, update slot
`0x00793D7C`; constructor vptr write at `0x00541870`). It is a learned-spell
class and must not be imported into the ordinary rank-1 Over recurrence.

| Native record | Role | Dimensions | SHA-256 |
| ---: | --- | ---: | --- |
| `BadGuys[30]` | Frost core used by both classes | `93 x 145` | `62aac46ed0f3436cf39023b2c93e8c02b8dee3c0611e74179cc5af92793470b5` |
| `BadGuys[28]` | forward glint used by both classes | `10 x 11` | `e118b2feb22c5ffd4c5f0981e20044b8df6181ead01c572965143ad959e24d60` |

Normal render `0x00457720` submits, in order:

1. ordinary-alpha record 30 at particle position/heading, scale `S`, alpha
   `min(L * L, phase)` and the cyan-to-white color;
2. while `additiveAlpha > 0`, additive record 30 at the same transform, scale
   `0.5 * S`, alpha `additiveAlpha`; and
3. when opacity multiplier `M >= 0.8999999761581421`, additive record 28 at
   `position + 3 * velocity`, scale `min(Q, 1)`, alpha
   `M * min(10 * L, 1)`.

Over render `0x00457A00` submits no half-core pass:

1. ordinary-alpha record 30, scale `S`, alpha
   `0.5 * min(L, phase)`, white; then
2. additive record 28 at `position + 3 * velocity`, scale `0.25 * Q`, alpha
   `min(3 * min(0.5 * phase, L), 1)`.

The draw state byte's value `1` maps to `SRCALPHA, ONE`; value `0` restores
`SRCALPHA, INVSRCALPHA`. Normal and Over use different world queues, and both
call the child renderer directly rather than entering the common local-light
dispatcher. The
camera only applies the normal world-to-screen translation and Hub/Boneyard
scale; neither sprite scale nor speed is multiplied into simulation state.
`Text_Draw` at `0x00415130` copies the submitted scale directly into all three
matrix diagonal entries before `0x00414540` transforms the registered
pixel-space quad. There is no texture-size normalization. Local float color is
multiplied by the renderer's restored white multiplier before the final byte
quantization. Native truncates each in-range channel after multiplication by
255; it does not round the red ramp or retain an unquantized sprite alpha.

## Pass 2: adjacent systems, density setting, and excluded records

- Global byte `0x00B3BCAD` is the literal `ENHANCED EFFECTS` control. The
  rank-1 count expression yields one particle per held tick when Off and two
  when On. This changes only visual density; the cone query still executes
  once per held tick.
- Stock persists that byte under the misleading `Game.FastCPU` key.
  `0x005BB310..0x005BB34F` loads the key with capability byte `0x00B3BCAE` as
  its fallback. The shipped `DEFAULTS|...|ENDDEFAULTS` block omits
  `Game.FastCPU`; the recognized Windows path seeds the capability byte to
  `1`, so a new shipped Windows profile defaults Enhanced Effects On. A
  preserved user settings sample has `Game.FastCPU=false` and the UI Off,
  proving it remains user-selectable rather than universally On.
- Website currently has no gameplay-performance settings owner and no
  Enhanced Effects control. This correction uses the evidence-backed shipped
  default, two particles per held tick. Adding a toggle or protocol field is
  outside scope; density is documented as fixed until that settings system
  exists.
- `BadGuys[32]` (`29 x 30`, handler address `0x00543F57`) belongs to the
  learned Hail branch guarded by progression `+0x8A8`. `BadGuys[14]`
  (`92 x 91`, handler address `0x00544870` vicinity) belongs to the learned
  Cold Aura branch guarded by radius `+0x8B0`. Neither is a rank-1 Frost Jet
  frame. Loading them may remain useful for future skills, but the primary
  renderer must never cycle them.
- Hail, Cold Aura, Harden armor, Permafrost slow, target pushback/damage, and
  impact/status presentation stay outside this visual correction.
  Discipline-screen Water orb frames are also a separate renderer family and
  are not evidence for primary-cast frames. Base Normal wall-splay is closed by
  the second pass below.

## Implementation consequence, regressions, and falsifiers

- The authority emits two independent Water transient identities per held
  tick, matching shipped Enhanced Effects On. It evaluates the native
  `(worldTick + ordinal * 65 / count) * 65 degrees` phase, scales the sine by
  neutral effective Water cast speed `1`, stores the resulting unit direction,
  and folds radial jitter around the caster's un-wiggled heading into the born
  origin. This keeps multiple casters on the same native world phase even when
  their spell IDs interleave.
  Deterministic identity-derived samples choose the class split, jitter,
  scales, and lifetime without consuming client-local RNG. This preserves
  native distributions, not the unrecovered retail RNG sequence for a
  particular session.
- A Water-specific presentation module owns the field recurrence and ordered
  sprite passes. The shared world-view factory only routes Water to it; Air's
  procedural renderer remains independent. The wrong record family, reach
  interpolation, one-pass additive blend, linear scale, and shared fade are
  removed from the Water path.
- Focused regressions must pin two emissions/tick, release/expiry, class split,
  speed `4`, 32-33 tick lifetime band, registered records 30/28 only, Normal
  versus Over pass counts/order/blends, exact representative alpha/scale/tint
  rows, heading conversion, glint lead, stable world Y, self-lit tint packing,
  identical world-tick wiggle for simultaneous casters despite interleaved
  spell IDs, and owner/world teardown.
- Falsifiers include: one particle/tick under the documented default; any
  record 14/32 in rank-1 spray; travel to `205`; one additive sprite per
  effect; Over drawing the Normal half-core; damage lasting with visual
  particles; particles or loop crossing world/owner teardown; renderer-local
  random samples diverging between peers; screen/HUD-space drawing; or late
  cores growing by whole multiples and washing the viewport cyan.
- Explicit unknowns at implementation start were clean-stock On/Off pixel
  receipts, exact per-session native RNG sequence, and a browser terrain query
  for cosmetic Normal wall-splay. The second pass below closes the browser
  terrain owner; retail RNG and clean-stock On/Off pixels remain open.

## Implementation validation receipt

- The first complete gate with the focused density regression failed against
  the superseded implementation at `4 !== 8`, proving that the old authority
  emitted only one particle per held tick. A later interleaved-two-caster
  regression failed while heading phase was identity-derived; it now pins the
  authoritative world-tick phase independently of global spell-ID allocation.
- `./scripts/validate.sh` passes on the completed Water tree: all 23 Website
  contracts/backend tests, 322 frontend tests, five desktop tests, frontend
  lint and game import boundaries, production frontend/game-host builds, and
  production media policy. The only diagnostics are the pre-existing Fast
  Refresh and large-chunk warnings.
- A focused 1600 x 900 WebGL cast receipt was saved at
  `D:\codex-evidence\primary-spell-water-20260814\web-smoke\solomon-primary-water-hub.png`,
  SHA-256
  `76dcb63afdff169d59807e9a553b1b0aed0e9a534ecfd39885bb4d69283d11cb`.
  It visually confirms the Water-specific registered core/glint path and
  short local spray, but it predates the final authority-only world-tick phase
  correction and therefore is not claimed as a final multiplayer-phase or
  clean-stock comparison receipt. The same targeted run observed cast pose,
  Water transients, and start/loop playback before its software-rendered
  one-frame-per-second page timed out awaiting the release-loop pause.

## Second-pass Water adjacency audit and correction boundary

- Fresh reproduction on isolated `origin/main` commit `386467d` used the
  Water-only Chromium smoke at 1600 x 900. The Hub receipt
  `/tmp/sdr-water-second-pass-baseline-20260814.7kRohW/solomon-primary-water-hub.png`
  has SHA-256
  `4fe8138f1194377f6a0db36dcef5df0084863e77ab3180ac5ee64cd254dc9b09`.
  Runtime state was otherwise healthy: cast pose `7`, player/aim/wire heading
  index `8`, 65 live Water transients, one `icestart`, and balanced `iceloop`
  play/pause ownership. The visible result was nevertheless a broad cyan
  cone/cloud. This isolates the defect to born particle direction and the
  still-omitted Normal terrain recurrence, not input, audio, density, asset
  registration, or teardown.
- A fresh read-only Ghidra adjacency pass closes the visual-heading operand.
  `0x00543895..0x005438AF` calls `0x00656580` for Water class index `3` and
  stores the returned effective cast speed at stack `+0x68`. That helper
  evaluates
  `(progression[+0x6AC] * progression[+0x94] + progression[+0x6B0])
  * progression[+0x6B4 + class*4] + progression[+0x6D4 + class*4]`, clamped
  at zero. The neutral rank-1 fixture has the established `+0x94 == 1` and no
  skill/equipment modifiers, hence an amplitude of exactly one degree.
  `mWiden + 15` instead feeds the wedge query and Enhanced Effects particle
  count; it never multiplies the visual sine.
- At both Over `0x00543A86..0x00543AD6` and Normal
  `0x00543BA3..0x00543C5C`, the handler loads the mutable accumulator,
  multiplies QWORD `0x00784D90 == 65`, multiplies the runtime float pi at
  `0x00B4027C`, divides QWORD `0x007DE888 == 180`, takes sine, multiplies the
  stored effective cast speed, and adds caster heading before
  `0x00453800`. `0x005439C9..0x005439CC` seeds that accumulator from the
  current world tick; `0x005439D0..0x005439DA` stores float32
  `65 / particleCount`; and `0x005440A2..0x005440AE` adds the step between
  births. Therefore the exact neutral formula is
  `(tick + ordinal * float32(65/count)) * 65 degrees`, not
  `tick * 65 degrees + ordinal * 32.5 degrees`.
- The handler's rank-1 gameplay query remains independent: `0x00641B10`
  builds a forward wedge with `205` reach and half-width `15`, enumerates all
  eligible actors, and the per-candidate `0x00524D70` line clip rejects
  obstructed contacts before status/damage. There is no travel projectile or
  impact-owned damage. The separate bot/alternate path is Normal-only, uses
  speed `0.5`, zero widen/push, a reduced count with a minimum of one,
  opacity multiplier `0.25`, and query mask `2`; those branches must not leak
  into the ordinary player cast.
- Constructor/caller/vtable xrefs rule out an omitted base VFX record.
  `0x00453550` is called only by Water, Water+Air, and the Over constructor;
  `0x00453840` only by Water. Normal/Over vtables route to shared update
  `0x00453670` and renders `0x00457720`/`0x00457A00`. The chaining wrapper
  `0x00453870` belongs to vtable `0x00793D74` and Water+Air construction at
  `0x00541870`. Hail `0x00454030`/record 32 and Cold Aura
  `0x0045AF20`/record 14 are learned Water branches. Adjacent record 31 is
  owned by `Anim_BlizzardBeam` render `0x00458470`, and record 29 by
  Heartmonger. Rank-1 Water has no source, contact, or terrain sprite beyond
  records 30/28; its terrain response is the Normal object's own motion.
- Normal creation predicts from the caster actor position, not the jittered
  socket: `predictionSteps = float32(lifetime / 0.04 + jitterRadius)` and
  `predictionEnd = caster + predictionSteps * velocity`. If the nearest
  `0x00524D70` hit lies in front of the jittered origin, the object stores its
  remaining distance and hit point. Shared update subtracts current speed;
  once negative it snaps to the hit, chooses an identity-stable random sign,
  changes velocity to that signed perpendicular at half speed, clears the
  pending hit, and then advances once with the new velocity. Rotation remains
  the born heading while the forward glint follows the new velocity. Over
  deliberately stores no obstruction.
- The implementation consequence is authoritative birth-time obstruction:
  snapshot a nullable hit point on each Normal Water transient from the owning
  Hub/Boneyard static collision model, then replay the exact motion recurrence
  in presentation. Screen-space probing or client-local collision would
  diverge across peers. Remaining unknowns are the retail RNG sequence and a
  clean-stock Enhanced Effects On/Off pixel pair; neither blocks the recovered
  formula, class ownership, terrain recurrence, render order, local lighting,
  or owner/world expiry.
- Completed WebGL proof uses the Water-only smoke against the restarted
  authoritative host, not the stale pre-change host. Hub and Boneyard both
  reported status `ok`, no console/page errors, cast pose `7`, player/wire
  heading index `8`, 64-65 live Water particles, and balanced ice start/loop
  play/pause ownership. The exact receipts are
  `/tmp/sdr-water-second-pass-final-20260814-proof/solomon-primary-water-hub.png`
  (SHA-256
  `a0569f0f37dabdf46061b7c4fcdd3dfc10739e0238bd4d45f978ef8a9dbf77b6`)
  and `.../solomon-primary-water-boneyard-held.png` (SHA-256
  `e14264cf55f4fa1a1ef08f29d4207da41118cfe3523c609cf3225312c0746c9f`).
  The wire receipt also round-tripped the Water-only `obstructionPoint`
  field, and the focused Water/kernel/protocol/collision battery passed 50/50.
