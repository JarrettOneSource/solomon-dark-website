# Air primary cast presentation correction — 2026-08-14

Reported mismatch: the first five-primary browser slice represents Air as ten
fading, fixed-width polylines. In retail Air is a short-lived pair of textured
triangle ribbons plus independently owned source and contact coronas. Treating
those objects as one fading line changes the bolt silhouette, overlap density,
color, texture, endpoints, and teardown at the same time.

## Question and falsifiers

This pass asks which native owners create, update, draw, and retire every
visible part of a rank-1 player Lightning hold, and which facts must cross the
authoritative/presentation boundary. The following explanations are falsified
by the executable:

- `0x00536380` is not the lightning-bolt mesh builder. It paints the source or
  contact corona. The actual ribbon tessellator is `0x00534510`.
- One bolt does not fade for ten ticks. `Anim_LightningBolt` lives for two
  native ticks and does not own a fade-alpha field.
- The contact flash is not the bolt's second stroke. It is an
  `Anim_FadeLightning` with a five-tick `1.0, 0.8, 0.6, 0.4, 0.2` alpha
  sequence and stock atlas art.
- The body is not a centerline with an outer glow. It is two independently
  tessellated, textured triangle ribbons built from the same three control
  points with different width, phase, color, and alpha inputs.

## Evidence provenance

- Retail executable: `SolomonDarkAbandonware/SolomonDark.exe`, Beta 0.72.5,
  `4,723,200` bytes, SHA-256
  `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`.
- Static project: `Decompiled Game/ghidra_project/SolomonDark.gpr`, program
  `SolomonDark.exe`, read-only replica pool under
  `Decompiled Game/ghidra_project_replicas`, Ghidra `12.0.3`. This pass used
  fresh headless decompilation, call-argument traces, instruction dumps, vtable
  catalogs, and literal byte/float reads.
  Preserved focused transcripts are
  `/tmp/sd-air-ghidra-tessellator-20260814.log` (SHA-256
  `79d830e17beef1737aefe0eb9a9e22321c2d19a7ccb1337dc436ddb8c7e43f47`)
  and `/tmp/sd-air-ghidra-corona-20260814.log` (SHA-256
  `0896a025f6b3a200d0cf35409ef263e6930b41615685ed3af59ed39455d79854`).
  The cadence/default-policy and `ZAnimLit` closure used read-only replica
  `ghidra_project_replicas/slot-06`, the same exact executable, PyGhidra
  `12.0.3`, and direct instruction/literal reads at
  `0x0053461C..0x00534756`, `0x00534A8A..0x00535182`,
  `0x00540072..0x005400F8`, `0x005E03D0`, `0x005FD1D0`, and `0x005E48E0`.
- Art oracle: retail `images/BadGuys.bundle`, SHA-256
  `a7b13b464e035e2099081ce942db4aa231fc7c20de1ecacbd9d0a590132c88d3`,
  and `images/BadGuys.png`, SHA-256
  `af5717b37c81306d515eed6d9f8717fa97bd1c63b9530a7079738c457c97443e`.
  The Website's extracted record PNGs and registration manifest are derived
  from those exact files.
  The consumed record hashes are: `44`
  `a940b0b66118b81df6199bea4361558c3037d57630f1329ff780d1254adc4438`,
  `110`
  `681388cc79153506329c762cb8d3ec0b5cd629d1e6098b86597d629a63ddd882`,
  `1836`
  `1cfac650a02c2bdee9575afd391b79535df2b3e7c64764016314ec11f218c1db`,
  `1837`
  `e43e83ff7fd834aee563dd7a8fc3781a24ddb094cf34d49215cee2ab40444c10`,
  `1838`
  `14ebfbe91ebf1c09d122d3f5274d96c72012e6ebdf16ad8fc49b56cee0e2c8c1`,
  and `1839`
  `90723bedc696c964165ed6e06d32f9834118f04ab53821d047d48ee3826a99da`.
- Current-web observation: headed Chromium receipt
  `/tmp/sdr-primary-a272433-live/solomon-primary-air-hub.png`, SHA-256
  `5b0643effe32832fdf4d4deb92a85351e7d5a688d0a7727d56219c190550b44d`,
  from Website `a272433`. It visibly shows the broad angular mass produced by
  accumulated ten-tick polylines and has no stock source/contact corona.
- Clean retail source-glow capture was later obtained in a loader-free Wine
  prefix on isolated Xvfb display `:98`, without touching the foreign Windows
  processes. The copied retail setting was `Game.FastCPU=false`, matching the
  user-selectable Enhanced Effects Off / `30`-unit tessellation branch; it is
  not the shipped new-profile default. The 132-frame, 60-fps held sequence
  `/tmp/sdr-stock-vfx-probe.9l2URj/stock-air-held-v2.mp4` has SHA-256
  `bd0fcc847fbc346cb4bd6b88cf602fcf1c679d24c68d91b065f0518da8907f10`;
  frame `stock-air-held-v2-0.25.png` has SHA-256
  `3c2bf4cd5440ee86d660cd4b44cdb8a3cfee30f172df840b740fcad77198583f`.
  The complete sequence shows the raised staff and sustained cyan-white source
  glow, but never materializes a bolt or contact endpoint. A derived every-
  other-frame sheet at `/tmp/stock-air-held-v2-contact-sheet.png`, SHA-256
  `d53244646e9bfa20a17a89e810b0ea8b356e05469d12e956788ff85227736d63`,
  confirms that absence across the window. This is clean support for the
  source-glow relationship, not bolt-body visual acceptance. [observation]
- A second clean Boneyard real-input sequence is preserved at
  `/tmp/sdr-stock-vfx-probe.9l2URj/stock-air-boneyard-real-input.mp4`
  (SHA-256
  `9c80098dfcbb1b9d3c3918a0b050db226277d2e782d2a581bdc4f529827d087a`);
  its `0.25`-second frame has SHA-256
  `73960095fe1befa25596955febe273aee19475db84c38af32b16c631e675fd63`.
  It has the same source-glow-only limitation. [observation]
- A real headless-Chromium WebGL cast journey after the initial Air asset/view
  cutover wrote
  `/tmp/sdr-air-native-20260814/solomon-primary-air-hub.png` (SHA-256
  `5c01f30d7d7c63a96ed54bc77a8210928786e87ad0e81da4092ce64fbedbffa6`).
  That run reached Ether, Fire, and Air cast-state/pose assertions and loaded
  the exact Air textures, but memory pressure stopped the larger smoke before
  its final JSON/audio/five-element completion. The frame also predates the
  final first-leg cadence and separate-root audit above. It is evidence of a
  real WebGL cast and asset path, not final bolt/contact pixel acceptance.
  [web observation]

Evidence labels below mean: **instruction** for direct native code/data,
**asset** for exact shipped bundle records, **runtime support** for the earlier
rank-1 hold fixtures, **web observation** for the current browser frame, and
**inference** only where the web protocol lacks a native value.

## Pass 1: causal ownership trace

```text
held primary / skill 24
  -> sustained player dispatcher 0x00548A00
  -> Lightning handler 0x0053F9C0 once per accepted held tick
     -> cast socket 0x0053B830 + retained target / clipped aim 0x00524D70
     -> bolt factory 0x00531640
        -> Anim_LightningBolt 0x0045B2C0
           -> ribbon builder 0x00534510 twice
           -> tick 0x00453BD0
           -> render 0x004575D0
        -> one-tick Anim_SpellGlow 0x00454AD0 at the staff source
           -> render 0x00459A00 -> corona painter 0x00536380
        -> ZAnimSplit wrapper registered at 0x0063F6D0
     -> Anim_FadeLightning 0x00452E20 at a contacted/clipped endpoint
        -> tick 0x00476230 -> base fade tick 0x00454000
        -> render 0x004572C0 -> corona painter 0x00536380
        -> attached ZAnimLit 0x005E03D0 for native lighting ownership
     -> contact/status lane, then optional chain selection 0x00641340
        -> repeat bolt + endpoint corona per hop, damage x 0.6 per hop
release / primary transition
  -> no new handler call, no new bolt/contact objects
  -> existing 2-tick bodies and 5-tick coronas retire through their owners
```

`0x0053F9C0` is the gameplay owner. It reacquires or retains a target in player
fields `+0x164/+0x166`, obtains the staff cast point through `0x0053B830`, and
clips an untargeted aim segment with `0x00524D70`. It applies contact during the
same sustained tick; there is no Air gameplay projectile, velocity, flight
tick, or later collision callback. Learned Chaining at player `+0x284` asks
`0x00641340` for the next eligible actor and multiplies the next hop damage by
native double `0.6` at `0x0078C6F0`. Stun and Disintegrate stay in that contact
lane. [instruction; runtime support]

The primary `0x00531640` call receives the cast source, a direction-derived
half-distance midpoint, and the clipped/target endpoint. A contacted actor
uses a `-20` Y attachment offset; an untargeted clipped endpoint does not. The
primary call enables `Anim_SpellGlow` at the source. Chained calls disable that
source glow and perturb their midpoint with a random radial vector. The Air
direction is therefore the cast direction used to choose both the endpoint and
the native 24-way staff pose/socket. The general rule that the actor must face
the cast is owned by the player/cast system, not by this VFX module.
[instruction]

The render objects are presentation-only. Authoritative state decides that a
held tick happened, who owns it, its world, source, and cast direction. Native
geometry and corona randomness consume the active process RNG while each
presentation object is built or rendered; those samples are not serialized to
remote peers. A browser seed derived solely from the replicated semantic
transient id is therefore an explicit deterministic presentation projection,
not a claim to reproduce retail RNG stream position. [instruction; inference]

## Bolt body: exact native construction and draw contract

`0x00531640` allocates one `0x70`-byte `Anim_LightningBolt` with vtable
`0x0078556C`. Constructor `0x0045B2C0` calls `0x00534510` twice over the same
three points:

| Layer | Native inputs | Consequence |
| --- | --- | --- |
| first | width scalar `1.0`, phase `-3 * native render tick`, RGBA white | full-width bright textured ribbon |
| second | width scalar `0.75`, phase `first + 15`, RGBA `(0,1,1,0.5)` | narrower cyan half-alpha ribbon, separately tessellated |

The tessellator appends all three points to `QuickSpline` (`0x00629EF0`,
`0x0062BCA0`, coefficient builder `0x0062A9E0`, evaluator `0x0062B2F0`), so
the middle point is native-significant even though the rank-1 untargeted
primary supplies a collinear midpoint. Cadence deliberately measures only the
first source-to-middle leg at `0x0053461C..0x005346DA`. It does not call an
exact square root: `0x0053462A` seeds the Quake estimate with integer magic
`0x5F3759DF`, and `0x005346C6..0x005346DA` performs one Newton refinement.
The squared length, half-squared length, inverse estimate, recovered reciprocal
distance, distance/spacing ratio, step, and every loop increment are rounded
through native float32 stores. The refined distance is divided by Enhanced
Effects On spacing `15` (`0x005346F7`) or Off spacing `30`
(`0x005346FF`), then the builder computes
`step = splineDuration / (firstLegDistance / spacing)` at
`0x00534735..0x0053473D`. Float `0.5` at `0x007DE870` caps the step at
`0x00534741..0x00534756`; it is not a cap of `1`. The loop is strict
`t < duration - step` at `0x00534AD8..0x00534AEB`, advances by `step` at
`0x0053516D..0x00535182`, stores the new parameter as float32 at the loop head,
and appends the exact duration endpoint separately.

Global byte `0x00B3BCAD` is the Settings `ENHANCED EFFECTS` control persisted
under the misleading `Game.FastCPU` key. Loader
`0x005BB310..0x005BB34F` uses capability byte `0x00B3BCAE` when the key is
absent; the shipped defaults block omits the key and the recognized Windows
path initializes the capability to `1`. A new shipped profile therefore uses
Enhanced Effects On / spacing `15`. The preserved false-profile capture above
proves Off remains selectable, not that Off is the product default. Because
the Website has no owner or protocol field for this setting, its fixed policy
is the shipped default On until such a settings system exists. [instruction;
runtime support; implementation consequence]

For the current collinear rank-1 path, source is `0`, midpoint is `102.5`, and
endpoint is `205`. Float32 squared length is `10506.25`; the one-step inverse-
sqrt path recovers effective first-leg distance `102.67955780029297`, ratio
`6.845304012298584`, and step `0x3E959773` /
`0.29217109084129333`. With float32 accumulation, the strict loop plus final
append yields exactly
`[0, 0.29217109084129333, 0.5843421816825867, 0.8765132427215576, 1.1686843633651733, 1.460855484008789, 2]`.
The next candidate `1.7530266046524048` fails the strict
`t < 2 - step` comparison. Each layer consequently has seven vertex pairs,
fourteen native textured vertices, six neighboring segments, and thirty-six
indices (the web plan stores `28` XY floats and `28` UV floats). This is an
instruction-derived first-leg cadence, not `ceil(205 / 15)`. The explicit Off
branch remains capped at step `0.5`, producing four pairs/eight vertices/three
segments/eighteen indices. [instruction]

At every loop sample, progress is `t / 2` and the taper envelope is
`sin(progress * pi)`. The center combines a normal wave
`envelope * sin(t * 360 degrees + phase) * 25`, a second normal wave
`envelope * sin(phase * 2.5 - t * 90 degrees) * 12`, and a tapered random
radial displacement with signed angle magnitude below `65` degrees and radius
below `30`. Half-width is
`((1 - envelope) * 0.75 + 0.5) * width * 25 * 0.5`; the separately appended
endpoint uses the untapered `width * 25 * 0.5`. Thus the full-width layer is
`15.625` half-width at the source and `12.5` at the appended endpoint. Tangent
normal helper `0x00529010` finite-differences the spline with `0.001`. Each
layer consumes independent RNG samples, so the cyan ribbon is not merely a
smaller copy of the white ribbon. Geometry is fixed after construction;
render does not re-jitter it. [instruction]

The normal renderer `0x004575D0` binds the texture held by BadGuys inline
record `44` (`BadGuys` object `+0x21E8`, texture pointer `+0x21F0`), submits
both triangle lists through `0x0041DA00`, and brackets them with the native
special/additive render-state byte at world renderer `+0x3F1`. Record `44` is
the exact shipped `17 x 14` cyan/white ribbon texture. The builder can append
a four-vertex flare/branch from the two-record BadGuys array at object
`+0x4818`; its selection, orientation, and presence are RNG-driven. [asset;
instruction]

Tick `0x00453BD0` decrements `+0x2C`, initialized to integer `2`, and destroys
the object when it falls below `1`. A fresh held tick therefore overlaps at
most the current and immediately previous bolt bodies. There is no body alpha
ramp. [instruction]

## Source and endpoint corona contract

The primary factory also creates `Anim_SpellGlow` (vtable `0x00785158`) at the
staff point with action `0x18`, scale `1 + Random(0.5)`, and angle
`Random(360)`. Its render `0x00459A00` dispatches action `0x18` to
`0x00536380`; its world registration is the one-shot presentation lane. This
is why the native cast has electrical activity at the hand/staff instead of a
line beginning at a clean pixel. [instruction]

When the handler has a non-sentinel endpoint it creates
`Anim_FadeLightning` (vtable `0x007865C8`) at endpoint plus a random radial
offset whose magnitude is `Random(10)`. Its uniform scale is
`1 + Random(0.5)`, starting alpha/lifetime is normally `1`, and decrement is
float32 `0.2` at `0x00784CE8`. Base fade tick `0x00454000` subtracts first and
destroys at `<=0`; subclass tick `0x00476230` also advances the corona angle by
`1` degree. Thus one endpoint object has five renderable alpha levels and a
held stream overlaps up to five contact coronas. Chain coronas use the same
owner but may substitute decrement `0.4` and a `0.2` pre-scale in the
low-detail/actor-flag branch. [instruction]

Corona painter `0x00536380` is additive and uses current object alpha as a
color multiplier. Although the registered BadGuys array contains sibling
records `110`, `111`, and `112`, all four Air circle calls at `0x005364FB`,
`0x005365DB`, `0x0053668C`, and `0x0053678B` check the same first entry and
pass the same `+0x46BC` record-`110` pointer to `0x00414EA0`.
Records `111` and `112` are consumed by neighboring effects, not selected by
this painter. The four record-`110` quads use pulse
`(abs(sin(angle * 15 degrees)) * 0.15 + 3.5) * objectScale`; their relative
scales are `1`, `0.75`, `0.5`, and `Random(0.2) + 0.2`. Their RGB is
`(0.5,0.75,0.75)`; alphas are `Random(0.25) + 0.2`, `0.5`, `0.5`, and `0.25`
before object fade alpha. [instruction]

Record `110` is an exact `27x26` crop with `(0,0)` registration. Object scale
is `1..1.5`, so the largest stock circle is numerically
`27 * (3.5..3.65) * (1..1.5) = 94.5..147.825` pixels wide and
`26 * (3.5..3.65) * (1..1.5) = 91..142.35` pixels high before contact jitter
and five-object held overlap. The visually dominant corona is therefore
consistent with the recovered stock constants; the source-only retail capture
still does not visually accept its endpoint composition. [asset; instruction]

The painter then selects two electrical fork glyphs from exact BadGuys records
`1836..1839`: the second index is `3 - first`, so paired record ids sum to
`3675`, and its rotation is the first plus `90` degrees. The four PNGs are
`45x56`, `48x53`, `51x50`, and `31x41` crops inside logical `55x59` cells and
retain their native registration metadata. These sprites change selection as
the painter consumes RNG and rotation as the corona angle advances; they are
not a static halo texture. [asset; instruction]

Each endpoint fade is also parented by `ZAnimLit` (constructor `0x005E03D0`).
The Air call at `0x00540072..0x005400F8` writes radius `+0x140` as
`1 + Random(0.75)`, starting intensity `+0x144` as `1`, float32 per-tick
intensity delta `+0x148` as `-0.05`, and local Multiple Shadows byte `+0x14C`
as `0`. Tick `0x005FD1D0` follows the fade child's jittered position, performs
the float32 intensity recurrence, and enrolls the wrapper as a Region light
provider. Provider `0x005E48E0` passes `min(intensity, 1)`, radius, child
position, and `localMultipleShadows & globalMultipleShadows` to the Region
consumer. Air therefore always requests `multipleShadows=false`; its radius is
the inclusive native lattice `[1,1.75]`, its five renderable intensity values are the float32 recurrence
from `1` through four additions of `-0.05`, and its light center is exactly the
same sub-`10`-unit jittered center as the contact corona. Float `50` at
`0x00784CF8` is written to Puppet `+0xA0`, the painter sort bias; it is not a
light range. Region's existing light contract expands radius through its
native `75`-unit inner and `145`-unit outer distance constants, so no invented
`50`-unit range or web-only decay belongs in the Air plan. [instruction]

## Pass 2: adjacency sweep

- Factory xrefs are limited to player Lightning `0x0053F9C0`, Skeleton Mage
  lightning in `0x00490860`, `StormCloud` tick `0x006021A0`, and
  `Mod_ElectricBurn` `0x00628F10`. The latter siblings reuse the builder but
  own different endpoints, art flags, or gameplay cadence; none supplies a
  ten-tick player-bolt fade. [instruction]
- `Anim_DarkLightningBolt` installs sibling vtable `0x00785598`, uses the same
  two-layer tessellator and two-tick lifetime, stores an additional source
  point at `+0x70/+0x74`, and renders without the normal bolt's special-state
  bracket. It is not the Air-primary style. [instruction]
- `Anim_FadeLightning` xrefs also include Ball Lightning impacts and
  StormCloud/ElectricBurn paths. They prove the corona is a reusable impact
  presenter, not evidence that the player primary is a missile. [instruction]
- `ZAnimSplit` (vtable `0x00784664`) stores the bolt pointer at `+0x13C` and a
  transformed visibility quadrilateral at `+0x140`; it places the procedural
  object in the world visibility/split queue. The source `Anim_SpellGlow` and
  contact `Anim_FadeLightning` are separately registered world objects. The
  browser must therefore expose three independently depth-sorted direct roots
  (body at effective midpoint Y, source at cast Y, contact at jittered endpoint
  Y), never one midpoint-sorted group or a HUD overlay. Grouping them would
  force incorrect occlusion whenever scenery or an actor lies between source
  and endpoint. [instruction; implementation consequence]
- The three roots do not consume inbound Region tint. `ZAnimSplit` draw vcall
  `0x005E0230` bypasses the common Puppet local-light dispatcher; `ZAnim` and
  `ZAnimLit` both use direct child draw vcall `0x005E01E0`. Their child
  renderers install the recovered lightning RGBA themselves. The outbound
  `ZAnimLit` contact light above is distinct from tinting the lightning art.
  A browser API that applies `tintAt(effect.origin)` to all three roots both
  invents stock tinting and samples the wrong position for the contact source.
  [instruction; integration consequence]
- Audio is adjacent but already correctly separated: registry `54`
  `sounds\\lightningstart` fires on the start edge and registry `162`
  `sounds\\lightningloop__loop` is owned for the channel lifetime. Sustained
  VFX ticks do not restart either sound, and release stops only future visual
  emission plus the loop owner. [instruction; runtime support]

## Native invariants and web implementation consequence

1. One accepted Air held tick emits exactly one semantic presentation record;
   release emits none.
2. A record retains for five ticks only to carry the endpoint fade. Its two
   textured bolt meshes render while `ageTicks < 2`; its one-shot source glow
   renders only while `ageTicks < 1`.
3. The bolt uses three control points and the recovered first-leg parameter
   cadence. With shipped-default Enhanced Effects On, the current
   `0 -> 102.5 -> 205` path uses the instruction-exact fast inverse square root
   and float32 loop to yield seven pairs and six segments per layer, plus the
   native sine envelope, exact BadGuys record `44`, additive blend, white
   full-width layer, and an independently generated narrower cyan half-alpha
   layer.
4. The endpoint is `origin + direction * 205` inside the current rank-1 PoC
   boundary. Target retention, terrain clipping, chains, contact, status, and
   damage remain excluded until the authoritative host publishes them; the
   renderer must not infer targets from screen pixels.
5. Exact BadGuys `110` and `1836..1839` art supplies the source/contact corona.
   No CSS glow, arbitrary stroke width, generated bitmap, or fallback asset is
   permitted.
6. Native RNG samples are presentation state. Stable transient id is the only
   permitted browser seed so interpolation, replication, reconnect, and visual
   receipts cannot regenerate a different object.
7. Body, source, and contact are separate direct world painter roots with
   their own Y keys. Camera transform, snapshot removal, and texture ownership
   continue through shared renderer contracts, but native Air art bypasses
   inbound Region tint. Neither geometry nor sprites own simulation,
   collision, audio, or replicated lifecycle.
8. The contact plan exposes its native outbound light source as pure semantic
   data: the jittered contact position, inclusive `[1,1.75]` radius, float32 intensity
   recurrence, and `multipleShadows=false`. Shared Boneyard/Hub enrollment is
   an integration responsibility; the Air view must not create a second light
   model.

The deepest cohesive implementation seam is an Air-specific native render-plan
module plus Air view. The shared primary renderer may only choose that view;
the shared texture factory may only expose the exact Air records; the core
simulation may only correct retained Air presentation lifetime from ten to
five ticks. Focused tests must first fail on the two/five-tick split, segment
count, independent layers, exact colors/widths/assets, deterministic geometry,
endpoint placement, and corona alpha/overlap.

## Unknowns and validation contract

The initial Air cutover tree passed `./scripts/validate.sh`: backend build and
23 contracts, lint/import boundaries, all `320/320` frontend tests (including
the original five focused Air plan/ownership regressions), all `5/5` desktop
tests, production build, game-host build, and production-media policy. The
preserved gate log is `/tmp/sdr-air-website-validate-20260814.log`, SHA-256
`718c9163678aefd14b1d596a52dc44bbdd354d97d94794732b50ce6c6738d635`.
The shipped-default cadence/lighting follow-up passed all six focused Air
tests, `tsc -p tsconfig.test.json --noEmit`, lint/import boundaries, the full
production `tsc -b` plus Vite/game-host build, and all ten contracts in the
Loader projectile/spell module. The multi-element integration owner retains
the canonical rebased full gate.
No final browser rerun was started while another element owned the constrained
Playwright lane; the earlier WebGL receipt above remains deliberately partial.

- The exact retail RNG stream position cannot be reconstructed from the
  semantic web snapshot and must not be claimed. The native algorithm and
  domains are recovered; the deterministic seed substitution is explicit.
- Rank/target/chaining endpoints are native facts but outside the current
  rank-1 no-combat Website protocol. The normal rank-1 `ZAnimLit` source
  mapping is closed as an Air render-plan output; feeding that output into the
  shared world-light collector remains deliberately deferred to the renderer
  integration that owns all element light sources.
- The optional per-layer branch quad is recovered structurally, but its full
  probability predicate and UV/orientation sequence remain too coupled to the
  active native RNG/texture record to claim pixel-exact browser parity. The
  implementation must not invent a replacement branch.
- A clean retail capture in which Lightning acquires or clips a real endpoint
  is still required for final bolt/contact pixel comparison. The isolated
  capture above reached and held the raised source-glow pose but did not
  materialize those owners. This pass must therefore prove the causal plan,
  exact assets, deterministic overlap counts, a real browser cast journey,
  WebGL renderer, and absence of page/console failures without claiming that
  the source-only retail sequence visually accepted the body.

Confidence is high for ownership, addresses, call order, control-point
construction, body/corona lifetimes, ribbon spacing/width/color layering,
blend mode, source/contact relationship, art records, audio edges, world
placement, and teardown. Confidence is medium for a deterministic web sample's
individual bends because native process-global RNG state is intentionally not
replicated.
