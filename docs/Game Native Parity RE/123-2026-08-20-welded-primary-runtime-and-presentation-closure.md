# 2026-08-20 — Welded-primary runtime and presentation closure

> **2026-10-13 correction — report 118:** the Flame Lash and Steam special-death
> contracts below are reopened. A live hit supplies a per-damage payload; only
> an admitted terminal death consumes it. The historical per-tick Steam-burst,
> half-total area damage, unrestricted Steam radius and closure claims are
> superseded by the report-118 recovery at the end of this entry and the shared
> receiver/area inventory in entry 162. Historical test/browser receipts remain
> evidence of what ran, not proof of those disproved semantics.

> **2026-10-13 native presentation correction — reports 116/118:** all earlier
> Flame record-44 glyph, optional record-375/376 branch, alternating-UV and
> complete geometry/fade/RNG closure assertions in this entry are superseded.
> Flame uses record **25 UVs**; its draw binds a shared atlas page through
> record 44's page pointer, which does not select that glyph. The corrected
> native chain and explicit open boundaries are recorded below. This narrow
> evidence correction does not change the verified terminal payload owner.

> **2026-09-24 correction — report 20:** historical Ring/Comet/Frost Missile
> Iceblast references to DeadHawg records 114/121 below are superseded by
> [ledger 084](084-2026-08-20-secondary-ability-native-ownership-correction.md).
> Fresh builder tracing proves inline fields +0C78/+0D3C bind records **16/17**;
> 114..144 is a different compact-decoration array. The Ring now separates
> background ice, direct additive bursts and fixed-root ZAnim snow, with the
> native float32 child clocks. Original historical receipts are retained, not
> evidence that the old artwork mapping was correct.


> **2026-08-29 split-painter closure:** the Region layering cutover in
> [entry 297](<297-2026-08-29-complete-region-world-painter-layering-audit.md>)
> supersedes only the Flame Lash and Blizzard Beam parent-layer closure. Both
> factories install `ZAnimSplit` and require clipped 25/50-unit
> `AnimPointer` queue slices instead of the former single origin-root mesh.
> The original claim that all recovered gameplay, geometry, art, timing,
> contact and audio contracts remain valid is historical. The 2026-10-13
> Flame presentation and death-payload corrections above supersede it within
> their stated scope.

## Reopened parity boundary

The first welded-primary integration correctly recovered the ten stat-vector
recipes and much of their combat membership, but treated several constructor
draws as cosmetic and reused ordinary element views for mixed spell actors.
Fresh instruction-level review falsified those assumptions. This pass owns the
complete build-1000..1009 system: rebuilt vector, low-mana branch, actor RNG,
motion/contact, target modifiers, every child VFX owner, audio pitch/variant,
Region-light registration/submission, painter lane, release, and teardown.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail image | `SolomonDark.exe`, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` | Source of every address/constant below. | high |
| One-shot handlers | `0x0053E6A0`, `0x0053F3C0`, `0x0053EDB0`, `0x00545FC0`; raw instructions around every RNG/audio/factory call | Pins low-mana mutation, pitch-before-variant ordering, spawn offsets, fan geometry, constructor draws, Ball temporary acceleration, and GroundSpark private motion. | high |
| Concrete actors | Fire/Frost/Ball/Ground constructors and ticks `0x005E4990`, `0x005E4C50`, `0x005E4F30`, `0x005E4FB0`, `0x005E76F0`, `0x005FD550`, `0x005FD720`, `0x005FD7A0`, `0x00611EB0` | Actor fields—not the browser renderer—own phase, weak state, acceleration, Frost turn/pulses, private seed, random native age, and movement recurrence. | high |
| Draw/light vslots | `0x00608F80`, `0x006093B0`, `0x005E0670`, `0x005E1B00`, `0x005E4AF0`, `0x005E7800`, `0x005E5670`, `0x005E7040` | Closes direct atlas/procedural draw families and provider formulas/lane disposition. | high |
| Sustained/persistent handlers | `0x005408F0`, `0x00541870`, `0x00542D20`, `0x00545360`, `0x0052BB60`, `0x00545C20`; concrete animation/projectile vtables | Proves that Flame Lash, Blizzard Beam, Steam Jet, EBoulder, Meteor, and Hailstones are distinct actor families rather than recolored ordinary primaries. | high |
| Audio core | `Sound::Play(pitch,gain) 0x00407CD0 -> 0x00407DC0`; compiled registry | The first explicit float is pitch. Low-mana `.75` is pitch, not gain; random Frost/Ball/Ground pitch must be authoritative. | high |

## System membership and web disposition

| Member | Native ownership | Required web disposition |
| --- | --- | --- |
| 1000 Burning Bolt | FireMissile fan, per-tick fire fade, Fire impact helper | shared projectile authority, actor light, Fire child actors and two one-shots |
| 1001 Frost Missile | FrostMissile fan, two pulse lanes, turn overlay, ColdSlow and radial helper | replicated actor presentation fields, radial/contact authority, actor light |
| 1002 Ball Lightning | accelerated MagicMissile-derived actor, ElectricBurn, FadeLightning | replicated acceleration/phase, variant+pitch audio edge, actor light |
| 1003 Flame Lash | two-tick textured mesh plus Lightning chain/fades and Fire payload | dedicated Flame Lash view; replicated target/chain geometry; no invented light |
| 1004 Blizzard Beam | two-tick beam, widened Frost selection, Lightning chains | dedicated beam view; Cold-before-Stun target effects; no ordinary Frost-Jet substitution |
| 1005 Steam Jet | one normal/over stream actor selected per eligible tick and target-owned Steamed | independently retained moving particle plus ten-tick fire payload lifecycle |
| 1006 Ethereal Boulder | retained EBoulder and recursive separately registered children | actor-owned rock set/orientation/pools, provider registration, release/split cleanup |
| 1007 Meteor Swarm | retained channel owner, periodic Meteor actors, impact debris/fire | exact cadence/RNG, per-Meteor lifecycle/provider registration, final-descent/impact provider submission |
| 1008 Hailstones | retained rock carrier and independently retiring released rocks | exact bucket rebuild/release/contact state, actor light, held/flight renderer |
| 1009 Crawling Shock | center and two side GroundSparks, private movement and ElectricBurn | replicated private seed/native age/timer, exact 15-unit contacts, actor light |

## Corrected one-shot contract

- Fire/Frost/Ball spawn at Staff emitter `(0,+10)`; GroundSpark uses `(0,+15)`.
- One damage draw is shared by the whole fan. Fixed endpoints consume no word.
- Fire consumes inherited `Float(360)` then `Integer(100000)` per actor.
  Frost consumes cast `Float(.1)`, then inherited `Float(360)`, its second
  `Float(360)`, and `.5+Float(.25)` per actor. Ball consumes `Float(.25)`,
  `Integer(2)`, then inherited `Float(360)` per actor. Ground consumes signed
  `Float(.05)`, `Integer(3)`, then `Integer(1000000)` and `Integer(360)` per
  actor.
- Ball base speed is float32 `3 * vectorSpeed * .8500000238418579`.
  Acceleration starts at two, temporarily multiplies motion with a cap of six,
  and decays by `.8999999761581421`; the same cast draw initializes pitch and
  the fan turn multiplier.
- Ground begins at speed four for center and three for sides. After the first
  movement and each 20-tick expiry, three private xorshift/multiply words choose
  heading magnitude `17..37`, sign, and speed `1..4`. The original cast heading
  stays the reference.
- Underpowered Fire/Frost/Ball produce one actor at half damage and speed factor
  `.8`; all learned payloads are suppressed. Ball also uses turn/pitch `.75`.
  Ground produces only center, halves damage, removes arcs/extra contacts, sets
  movement factor one, and multiplies its sampled pitch by
  `.800000011920929`. The separate fizzle precedes the cast cue at gain one.

Protocol 42 carries cast playback rate, sound variant, weak state, mutable
base phase, Ball acceleration, both tick-owned Frost compositor lanes,
Ground private word/native age/turn timer and independent fade children,
effective per-actor vector, and provider registration. The
player cast edge retains pitch/variant so a same-tick obstruction/contact
cannot erase audio before the snapshot. Clients interpolate motion and the
continuous presentation fields but never reroll authority.

## Effects, VFX, and lighting contract

- Frost contact is corrected by the 2026-09-22 report-13 reopening below:
  zero widen installs direct ColdSlow; positive widen invokes the area helper.
  Chill Wind does not gate either branch. The old push-radius and `/20`
  description confused native fields and missed the helper's second division.
- Ball/Ground ElectricBurn is a target-owned modifier. Each tick includes the
  source plus the configured nearest distinct roots inside 200, preserves
  registration order on distance ties, damages, and installs 25-tick Stun.
  Merge ownership follows the strongest damage payload; ticks and damage keep
  maxima.
- FireMissile directly uses the Fire body/impact records; Frost, Ball, and
  Ground own their concrete compositor/child programs. Flame Lash uses its
  dedicated record-25-UV ribbon (the old record-44 glyph claim is retracted),
  Blizzard's `0x005308D0` beam, Steam record-76 normal/over actors,
  EBoulder 86/168..171/2008..2010, Meteor marker/fall/impact/debris, and Hail's
  Frost helper, record-18 rock-birth fades, release FadeFrost, and rocks
  168..171 each require separate plans and lifetimes.
- Fire/Frost/Ball light is intensity `.75`, radius `.75+Float(.1)`, actor lane,
  with Multiple Shadows. Ground is actor lane, intensity `.5+Float(.5)`, radius
  `.4`, no directional shadow. EBoulder/Hail are actor lane, intensity `.5`,
  radius `max(.5,scale*.75)`, with Multiple Shadows. Meteor `+0x13C` is fall
  height, not body size. Its registered `0x005E7040` provider is silent above
  height one, then submits a non-shadow source during final descent and impact.
- Render-global random samples are projected from stable actor/frame identity;
  this is the one explicit platform adaptation. Domains, recurrences, actor
  state, painter order, provider lane/order, and teardown remain native.

## 2026-08-20 v41 runtime/presentation checkpoint

The retained and presentation membership is now explicit rather than attached
to cast timers:

- Meteor emits one record-51 `Anim_Iceblast` marker every held tick before the
  gameplay draw. Cadence uses selected-primary age and the native
  `max(5,trunc((weak ? 35 : 25)/round(castFactor)))` branch. Normal spawn
  consumes seven words and weak spawn six. Impact consumes the camera vector,
  rotation/radius, five 13-word BoulderBit programs, and two-word signed sound
  pitch; normal additionally owns `throwfire` pitch `.8`. Direct radius is 45;
  recurring radius is the impact-created scalar times 45. Camera displacement
  decays by `.75` per update and preserves the largest vector.
- Weak EBoulder checks its pre-growth scale, emits the independently retained
  `round(max(scale*30,8))` BoulderBit program before collapsing quantity to one,
  and preserves the retail `MAX` macro's conditional second `.75` draw. Those
  children live for 80 alpha updates even when the boulder releases or dies.
- Hail bucket counts use native tie-to-even rounding. Enhanced rock creation
  emits an independent 400-tick record-18 fade for each new rock. Release moves
  the carrier back 20 on both axes, creates an independent 20-tick FadeFrost,
  recomputes each rock's falling offset from local Y/Z and `.95` decay, applies
  camera magnitude `.1`, and plays `icestart`/`rockhit` at pitch `1.5` followed
  by `hailshot` at pitch one. The checked-in `hailshot.wav` is the untouched
  registry-40 PCM, SHA-256
  `3190570e01141d2036b0aabc7fae77e70204ceaa7119e26e811f2a45a954b6a2`.
- Frost Missile owns two replicated compositor lanes. Each subtracts `.01`;
  below `.1`, the authority consumes aspect `.5+Float(.25)`, scale
  `.5+Float(.75)`, and rotation `Float(45)` in lane order. Ball/Frost/Ground
  contacts retain their FadeLightning/FadeFrost state and exact impact audio:
  Frost `icestart` pitch `1.5`, Ball `throwlightning1` pitch `1.5`, and Ground
  `1+Float(.1)` plus `Integer(3)` Shock selection.
- GroundSpark's tick creates an independent record-71 fade, then the native
  `abs(sin(nativeAge*12deg)) < .1` or one-in-six fork creates record
  1836..1839. Weak state halves record-71 alpha and loss, but only fork alpha.
  Steam is not a two-tick beam: the handler emits one particle on the even lane,
  consumes the one-in-seven Over selector plus its complete constructor program,
  and lets the normal/Over actor retain life, color, scale, and velocity decay.
- `primary-spell-weld-native.ts` and `primary-spell-weld-view.ts` now own one
  stock-atlas/painter route for every replicated Weld projectile, beam, Steam
  particle, persistent carrier, marker, impact, fade, and debris actor. The
  preload census includes every direct BadGuys row used by those plans.

Focused TypeScript, runtime, combat, protocol-v41, audio, lighting, camera,
asset-hash, painter, and Pixi routing coverage passes 248 tests; frontend lint
and the architecture-boundary checker are green. This is still not the final
Welding receipt: the stock-to-browser cast journey must now falsify and tune the
remaining draw-level translations (especially Flame Lash mesh curvature,
Blizzard enhanced children, Meteor's native primitive body, and Hail/Steam
contact children), followed by the canonical Website gate and real Mac mini
visual/audio/light diagnostics for all ten builds.

## 2026-08-21 v42 Meteor/Hail adjacency correction

The v41 checkpoint above is historical. A direct pass over Meteor provider
`0x005E7040`, Hail released tick `0x005FBDE0`, shared Boulder contact
`0x00620B60`, modifier constructors `0x00623050/0x006233B0`, and the concrete
child renderers corrected four conflations before browser acceptance:

- Meteor `+0x13C` is the falling-height scalar initialized in `[5,6.25)` and
  multiplied by `-768` for the falling glyph position. `+0x74` is the separate
  `[.75,1)` body scale. Provider radius state `+0x15C` begins at one, then
  becomes `bodyScale+Float(.5)` on impact. `0x005E7040` submits when fall
  height is at most one: intensity is
  `min(1,visibility*(1-fallHeight))`, where impact visibility is
  `min(impactTicksRemaining,50)/50`, radius is `+0x15C*.6`, and directional
  shadow is false. High fall is an empty provider submission, not permanent
  silence. Impact constructor `0x00610880` also registers its orange
  alpha-two/loss-`.1`, scale-six BadGuys-15 `Anim_FadeAdditive` as a separate
  world actor; it is not a nested layer of the retained Meteor.
- Hail does not use shared Boulder contact `0x00620B60`. A clear released tick
  performs three ordered ten-unit substeps. Each positive-widen substep grows
  carrier query radius and moves every rock's local and collision XY radially.
  Collision retains the release-time offset; `.95` decay changes draw Y only.
  Candidate targets are the outer loop and mutable rock identities the inner
  loop. The strict per-rock predicate is
  `distanceSquared < (targetRadius*1.5)^2`.
- Every accepted Hail rock contact installs 250-tick `.5` ColdSlow before
  damage. Positive push installs one resident `Mod_Knockback 0x1B6D` with a
  unit cast-direction displacement for round-to-even `push*20` ticks; a second
  Knockback is rejected while the first remains. Outgoing damage is
  `min(targetHealth,rockPool)`, while toughness divides only pool consumption.
  Pool exhaustion removes that rock, consumes one `Float(.25)` line-color
  word, and creates separate 14-tick `Anim_Line` and ten-tick BadGuys-15
  roots. It never creates a BoulderBit.
- Static Hail line termination replaces the carrier with sixteen independently
  registered children per remaining rock: fifteen additive moving BadGuys-45
  actors plus one BadGuys-32 bouncer. The program consumes exactly 83 RNG words
  per rock: five per moving child and eight for the bouncer/outer-angle path.
  Moving children own `.125` alpha loss and `.92` velocity damping. Bouncers
  own the native global-modulo-three pause, `.4` gravity, `.65` bounce/damping,
  rerolled spin, `-.75` settle threshold, and `.015` alpha loss. All contact and
  terrain children are self-lit/direct roots with no outbound Region light.

Protocol 42 carries stable Hail rock identities, the independent collision
radius/offset lanes, Knockback clocks, line/flash roots, and record-32/45
terrain children. Focused kernel, combat, protocol, renderer, TypeScript, lint,
and architecture checks cover the corrected state machine; canonical and Mac
browser receipts remain later gates for the combined skill tree.

The same adjacency sweep closes the three channel draw families:

- Flame Lash constructor `0x0045B810` calls dedicated builder `0x0052E020`.
  It has a six-vertex short-span branch and a three-point QuickSpline
  long-span branch. Record 25 supplies both branches' UVs. The prior
  record-44 glyph, alternating-UV and 375/376 branch claims are superseded
  by the correction below. Normal body width/alpha are `1/1`, weak `.75/.5`,
  and phase is `-3*birthTick`. Independently registered record-35 fades spend
  two overwritten `Float(360)` constructor words. Exact fade offsets, final
  scale, Enhanced-dependent losses, lighting and RNG parity remain open under
  report 116.
- Blizzard factory `0x005328D0` is called by welded handler `0x00541870` with
  source-glow flag one and endpoint/enhanced flag zero. Records 6 and 31 are
  therefore unreachable for this skill. Draw `0x005308D0` owns exactly a
  record-43 source cap and record-44 strip. Width is
  `widen==0?.75:widen*3+1`, halved when weak; longitudinal half-length is
  `width*30` and perpendicular half-width is `width*25*.908955`. A private
  `-3*birthTick` projection supplies the coupled radial/angle jitter. Normal
  tint is `(0.5435550212860107,1,1)` and weak tint `(.5,.75,1)`. Two separate
  one-frame variant-24 `Anim_SpellGlow` roots consume four RNG words at the
  source every emission.
- Steam constructor/handler now retain the actual `(Float(.1)+.01)*.5` life
  loss, signed `Float(4.5)` heading jitter, 15-unit backward birth socket,
  `5.4*(1+widen*.02)` Normal or `6*(1+widen*.02)` Over speed, weak quarter
  alpha, and birth-time terrain terminal. Tick owns remaining-distance snap,
  `.25` tint loss, `.125` secondary-color loss, and the complete long tail.
  Normal non-weak particles alone retain `Integer(10)` contact clocks; due
  contacts query `scale*50` and install ten-tick Steamed with the particle's
  stored Fire payload. Over and weak particles own no Steamed contact lane.
  Positive normal tint draws two additive record-76 copies; after tint reaches
  zero one ordinary copy remains. Over draws one ordinary quarter-alpha copy.

The historical focused tests pinned the then-current Flame ribbon and its
claimed 375/376 branch plus fade RNG/lifetimes. They are implementation
observations, not native proof; those Flame closure claims are superseded by
the 2026-10-13 correction. The tests also covered Blizzard's two quads and negative 6/31 census,
its four-word glow pair, Steam terminal/contact clocks, weak and Over branches,
protocol ownership, and renderer plans. The remaining welded draw work is the
Meteor ground primitive and independent debris painter/lifecycle audit before
browser comparison.

## 2026-08-21 v43 Ball/BoulderBit ownership correction

The next direct actor pass closes two presentation omissions without attaching
either one to a parent painter:

- Ball Lightning draw `0x005E0670` first applies the weak parent alpha, then
  calls the shared `0x00536380` Lightning-corona compositor. That compositor
  owns four BadGuys-110 circles and two independently selected BadGuys
  1836..1839 forks. The same actor then draws a direct BadGuys-70 sibling at
  local `(0,-10)`, with alpha `Float(1)` and uniform scale
  `1.25+Float(.1)`. The Website plan now carries the six exact shared corona
  members plus that direct record-70 body; weak alpha covers both branches.
  The later conditional `0x00535A30` turn overlay remains an explicit painter
  audit item rather than being silently approximated.
- `Anim_BoulderBit` is one registered world actor per fragment. Its inherited
  Bouncer tick skips planar motion, height integration, gravity, rotation, and
  the base `.015` fade while airborne on global ticks divisible by three; the
  subclass `.025` fade still executes. Other airborne ticks integrate planar
  and vertical motion, add `.4` gravity, and on ground crossing consume
  `Float(10)` then `Integer(2)`, multiply the stored bounce velocity by `.3`,
  optionally damp planar velocity by `.65`, and settle when the next bounce is
  greater than `-.75`. Non-skipped and settled ticks subtract `.015` followed
  by `.025` in float32 order. Weak/contact EBoulder fragments and Meteor's five
  impact fragments now use this same independent state/RNG/retirement path;
  each owns one Region-light sample and painter root at sort bias `-15`.

Protocol 42 now validates one dynamic BoulderBit state per debris actor instead
of a nested fragment array. Focused type, runtime, combat, protocol, and
renderer coverage passes 140 tests; lint and architecture boundaries are
clean. The remaining pixel-level adjacency is the native Bouncer shadow
primitive, Meteor's ground primitive, Frost's helper/turn primitives, and
Ball's conditional turn overlay before the ten-skill browser comparison.

## 2026-08-21 v44 direct-painter correction

The v43 residual names above are historical shorthand. Raw call-site operands,
atlas singleton offsets, and shared animation vtables resolve each path to
authored atlas draws rather than unknown primitives:

- Ball `0x005E0670` always owns three stacks in the welded case. Its Air corona
  uses global render phase and `.75+Float(.5)` scale; direct BadGuys 70 uses
  local Y `-10`, `1.25+Float(.1)` scale, and `Float(1)` alpha. Constructor byte
  `+0x168` stays zero because handler `0x0053EDB0` never writes it, so the final
  `0x00535A30` call always adds the complete two-pass Ether compositor. That
  stack uses inherited mutable phase `+0x154`, `1+Float(.5)` scale, and a `.1`
  graphics-alpha multiplier; it includes BadGuys 110, 111, and 112 cores,
  sparks, `2..11` particles per pass, and rays. It is not a turn-only overlay.
- Frost `0x006093B0` owns body records 271..282, additive BadGuys 5 and 110
  helpers, two dynamic BadGuys-16 lanes, and—when handler field `+0x16C` is
  positive—two BadGuys-87 affine draws. The lanes use tint `(.5,1,1)` and
  alpha one; the helper colors and exact affine matrices are recorded in the
  Mod Loader ledger. Weak graphics modulation covers the whole stack and the
  weak handler clears `+0x16C`. `Anim_FadeFrost 0x00457230` delegates to the
  full Water compositor, while `Anim_FadeLightning 0x004572C0` delegates to the
  full Air compositor with its retained/incrementing phase.
- Meteor main draw `0x005E16C0` uses BadGuys 15 plus BadGuys 50 with
  per-render signed X scale `+/-bodyScale`, not `sqrt(bodyScale)`. Auxiliary
  vslot `+0x28`, `0x005E6DE0`, draws normal DeadHawg 19 at the ground root
  during final descent (`scale 2/1.6`, alpha
  `max(0,1-fallHeight)*.5`), then additive BadGuys 67 during impact
  (`scale radius/.8*radius`, alpha `min(remaining,100)/100`). BadGuys 50 is not
  the impact disc.
- `Anim_BoulderBit 0x00457E40` passes its own atlas descriptor to shadow helper
  `0x00415020`. The enhanced airborne shadow is therefore the same fragment
  sprite, black, full `min(1,alpha)`, at local Y `+2`, with the same rotation
  and scale `(scale,scale*.75)`. Its colored copy remains at dynamic height
  with uniform scale. The ordinary BadGuys-32 Hail bouncer inherits the same
  geometry and retains normal blend.
- Held Hail draw `0x00611160` uses neither the Frost-Missile helper nor a
  generic glow. Its held-only preamble is ordinary BadGuys 15 at tint
  `(1,1,.9)`, alpha `.35+Float(.25)`, and scale
  `heldScale*4.099999904632568`, followed by the complete Water compositor at
  fixed scale `1.75` and global render phase. Released Hail skips both owners
  before painting its independently sorted rocks. Its inherited auxiliary
  vslot `0x005E5530` still paints held BadGuys 15 at actor XY, tint
  `(.85,1,.85)`, signed alpha `.5+Float(.25)`, scale `heldScale*2.5`, or
  flight BadGuys 67 at `flightScale*2.5`.
  Every retained rock is also a two-draw owner: opaque record 168..170 at
  `max(.45,storedScale)*.85` held or `*.75` flight, followed by a distinct
  white BadGuys-32 copy at the same projected XY, heading rotation, unit scale,
  and alpha `rockPhase*.8` held or `rockPhase` flight. Phase never substitutes
  for the rock body's alpha.
- EBoulder draw `0x0060C540` is not the ordinary Earth body with a different
  payload. Its main aura is BadGuys 15 at tint `(1,.9,1)` and scale
  `charge*4.099999904632568`; its body color after the opening mix is
  `(1-mix,.75*(1-mix),1,1)`. Every transformed zero-XY center becomes a full
  Ether compositor at `(1+Float(.1))*2*charge` scale, while shell records
  168..170 use `max(.25,storedScale*.75)`. Held quantity repeats that complete
  center/shell body over the native one-to-four offset template; flight uses
  one body. Auxiliary vslot `0x005E5530` separately draws held BadGuys 15 at
  actor XY, tint `(.85,1,.85)`, signed alpha `.5+Float(.25)`, scale
  `charge*2.5`, or flight BadGuys 67 at the same scale. Release does not apply
  the previously inferred visual shrink; its `.75/.95/.9` writes affect
  angular/gameplay fields.

These corrections expand the Weld preload census to BadGuys 5, 16, 67, and 87
plus DeadHawg 19. They also require affine sprite transforms for the two Frost
87 draws and exact reuse of the already recovered element-compositor plans.
Implementation and browser receipts follow this ledger update.

## 2026-08-21 v45 equipment-consumer residual

The all-skill census found four resolved-but-unconsumed equipment lanes:

- `FX_GOLDBONUS` must multiply every Gold materialization total before native
  rounding/chunking, in addition to the independent Gold Charm amount branch.
- `FX_MAXWELD` must promote zero effective ranks for exactly component IDs
  `9,10,17,18,25,26,33,34,42,43` to one while equipped. Permanent ranks,
  active build, and belt state do not change.
- `FX_WELDEFFECT` must enter `nativeWeldPrimaryVector` at materialization time;
  applying it after the vector or as a generic contact multiplier is wrong.
  `FX_WELDCALLING` must drive the already recovered welding-biased offer pool
  while the feature is equipped.
- Equipment HP recovery remains the independent ordinary
  `+0x9C/(100*10)` tick add. Active Regenerate adds `1.5/100` in the same tick;
  neither replaces nor multiplies the other.

An exhaustive `+0x878` access scan also closes five tempting false positives.
The executable writes feature bits `0x20/0x40/0x80/0x100/0x200` for named
Embers-to-Imps, Disintegration, Ether-Charge, Harden, and Rock-Surge maximum
effects, but contains no reader for any of them. They are shipped inert; the
Website must retain the catalog/bit identity without inventing gameplay or VFX.

## 2026-08-21 v46 Skill Screen and mixed quickbar closure

Clean stock capture plus the `SkillScreen`, `SkillPage`, `HoverButton`,
`SkillDragger`, `BeltButton`, and `Skills_Quickbar` call chains replace the
Website's secondary-only belt assumption:

- the native quickbar has eight slots and accepts learned category-1 primaries
  and category-2 secondary casts;
- duplicate skill IDs are valid; drop resolver `0x005C7090` overwrites only
  the destination `BeltButton` and never removes an earlier copy;
- new category-1/category-2 rows enter only the first empty slot when first
  learned; rank-ups do not auto-add another binding;
- a category-1 slot edge selects that primary, while a category-2 edge invokes
  the secondary ability and its shared skill-owned cooldown/toggle state;
- category-1 Skill Screen cards also select on an ordinary click through
  `0x00674110 -> 0x005D5600`; category-2 cards deliberately do not cast on
  click;
- learned Weld recipe identity is independent of the selected primary. Row 52
  selects the learned weld; selecting an elemental primary retains the recipe
  for later use;
- the selected primary can differ from the wizard's creation element. Spell
  cadence, Staff pose/socket, mana, projectiles, audio, HUD icon, and Magic
  Trap selector follow the selected row; robe/hat appearance stays with the
  creation element.

The authoritative component is now `skillQuickbar`; input is `cast.quickbar`,
protocol 44 replicates the selected primary, learned acquisition order,
concentrations, learned Weld recipe, and duplicate-capable quickbar, and the
host owns bind/select mutations. The stock `1600x900` Skill Screen uses the
native leather, chain, statue, card, dependency-arrow, icon-frame, font, and
bottom-HUD records, rebuilds pages from the complete learned dependency graph,
and exposes the authored hover tooltip. This screen is the user-facing owner of
the catalog audit rather than a static two-card mock.

At this entry's protocol-44 implementation cutoff, the separately recovered
`Skills_Quickbar` path was misattributed to Settings, and the Website exposed
learned category-1 `SELECT PRIMARY ATTACK` and category-3
`SELECT CONCENTRATION` lists there. The 2026-08-22 correction below removed the
wrong Settings placement. The 2026-08-23 selected-HUD trace supersedes the
remaining ownership claim: HUD buttons own the compact selectors and exact A/B
replacement, while SkillScreen retains its category-1 and general category-3
direct-selection paths.

## 2026-08-21 v47 Ether Blast closure

The every-skill residual scan found that Ether Blast `14` had a parsed
`blastChargeCapacity` but no runtime consumer. The full native chain is now
implemented instead of treating the row as inert:

- Player-owned protocol-v44 state retains the float32 charge, integer-crossing
  cue sequence, and shared equipped-effect pulse. Charge advances by
  `0.00700000022` only for a living Magic Missile owner with enough MP for the
  full cached cast, survives primary selection changes, resets on insufficient
  MP and Planewalker, and resumes after a Magic Missile release.
- Integer crossings play `magicshieldup` at pitch two and drive the recovered
  equipped-element-effect scale `1 + 10*pulse` plus the independent analytic
  light-radius contribution; pulse state decays by `0.899999976` per
  authoritative tick and is interpolated for both Hub and Boneyard clients.
  The 2026-08-22 consumer-census reopening below supersedes the earlier claim
  that this phase scales the staff/wand attachment itself.
- A positive rounded release runs before Magic Missile damage RNG. One
  replicated `ether-blast` owner preserves the pre-draw native RNG state, and
  its view reconstructs all 108 independent
  `Anim_FadeMoveAdditive_Perspective` children: 36 BadGuys-11 and 72
  BadGuys-45 sprites, 720 RNG words, individual world-depth roots, additive
  blend, native anchors, velocity damping, alpha loss, and the perspective
  `0.800000012` Y-scale.
- The release center is 100 units forward. The authoritative Boneyard contact
  query uses strict radius 175 and deals
  `min(charges*.150000006,.949999988) * currentHP`; maximum HP is not changed,
  matching the executable rather than its misleading tooltip.
- Every accepted contact installs one mergeable 300-tick `ether-burn` owner.
  It emits BadGuys 246..250 at the target, consumes the exact signed-scale and
  light-radius RNG words, owns no periodic damage, and appends its
  target-registered Region `MiscLight` after normal providers with no
  directional shadow.
- Release audio layers are `lightningstart` at pitch two and `gotorb` at
  pitches `.75` and `.5`. The point-attenuated purple Region flash loses
  `.025` alpha per tick; camera magnitude starts at `charges*.1` and follows
  the recovered `.94` decay.

The protocol parser, copy/interpolation lanes, audio synchronizer, Hub and
Boneyard feedback owners, global painter, texture preload, light tail,
contact/store integration, and disconnect cleanup all carry the new state.
Focused coverage pins charge/reset gates, release order, 108-particle and
720-word censuses, independent painter roots, current-HP contact, modifier
merge/fade, target VFX, MiscLight, audio, screen feedback, and strict wire
validation. The canonical `./scripts/validate.sh` gate passes, including 197
skill pretests, 1,182 Boneyard/runtime tests, production build, game-host
bundle, bundle budget, and media-policy checks.

## 2026-08-21 v48 Hurricane full-system correction

The every-property residual scan disproved the earlier “dead Hurricane damage
cache” conclusion. Native target helper `0x0047CB20` reads both progression
`+0x8D4/+0x8D8` values from the Region's active Hurricane sources, and is
called by ordinary Badguy movement plus the Maggot-specific path. The Website
visual-only lightning-corona surrogate has been replaced end to end:

- Player runtime now retains the native previous-frame refresh latch. Early
  contact/audio charge and later draw charge are separate protocol-v45 fields,
  preserving first activation, the one-full-tick release delay, `0.03` decay,
  zero-crossing removal, and fresh 16-word initialization.
- The host stores eight randomized angles/vertical offsets plus the authored
  `10*0.75^i` angular velocities and `1.5*1.2^i` radii. It consumes one
  `FloatRange(2,3)` word on each active early tick. Clients interpolate phase,
  lane angles, charge, and position without rerolling.
- The Boneyard resolver uses the native fast-distance approximation, strict
  radius 280, clockwise tangent `(dy,-dx)`, object-serial cadence, source-order
  force accumulation, charge-cubed ordered damage draw, Prismatic Air factor,
  target-owned randomized/raw cooldown, shields/death, and below-0.5 hit-sound
  suppression. Maggots share the target clock; GoodImp receives force but not
  damage.
- The painter is the stock owner overlay: source-over DeadHawg 15 core followed
  by additive BadGuys 84 lanes. Enhanced mode owns 17 draws; the recovered low
  branch owns the core plus even lanes. Native anchors, tint, alpha, rotation,
  anisotropic scale, and paint order are pinned. The old three-sprite Lightning
  corona reuse is gone.
- Hurricane renews the same maximum-gain `steadywind__loop` wrapper as Storm
  and Ether Drain from contact charge and positional attenuation. The ambient
  synchronizer now keeps one stable owner per native wrapper instead of
  accidentally starting one copy per producer.
- Lighting census is explicitly empty: no manager provider, Region MiscLight,
  shadow, or light-map write exists. The native positional Region query feeds
  loop attenuation only.
- Hurricane and Harden now follow selected pure primary rows 24 and 32 rather
  than the wizard creation element. Selecting another element or Weld cannot
  leak these learned branches; this closes the downstream selector seam opened
  by the stock Skill Screen cutover.

Canonical `./scripts/validate.sh` passes 24 backend contracts, lint and
architecture boundaries, 41 loot tests, 200 focused skill pretests, 1,189
Boneyard/runtime/render tests, every auxiliary suite, the production and game-
host builds, media policy, and the bundle gate at 287,819 raw / 79,099 gzip
bytes. Focused coverage pins both charge edges, 16+1 RNG budgets, fast-distance
force, strict boundary, hostile/Maggot target ownership, friendly GoodImp
force, cooldown decrement/reset, low-charge sound suppression, both painter
branches, exact atlas records, interpolation, protocol validation, and shared
ambient-loop start/stop. Rendered Windows and Mac receipts are recorded in the
v50 acceptance section below rather than inferred from the canonical gate.

## 2026-08-21 v49 complete 82-row effect and presentation ledger

This is the final row-by-row residual ledger against the 82 compiled native
IDs, not a family-level inference. “No independent” means the row modifies its
named parent/consumer and stock allocates no separate actor, light, or sound for
that upgrade. The detailed secondary art/audio/timing rows remain executable
contracts in `native-secondary-ability-contract.ts`; primary painter details
remain in the element-specific sections above.

| ID / skill | World, player, enemy, and additional effects | VFX, lighting, audio, and lifecycle disposition | Web owner / status |
| --- | --- | --- | --- |
| 0 Element of Ether | Creation root, default rows 8/11, offer/dependency family, wizard appearance identity. | Creation/Skills UI and Ether appearance only; no independent world light/audio. | config, progression, creation/Skill Screen — closed |
| 1 Element of Fire | Creation root, default rows 16/21, offer/dependency family, appearance identity. | Creation/Skills UI and Fire appearance only; no independent world light/audio. | config/progression/render — closed |
| 2 Element of Air | Creation root, default rows 24/27, offer/dependency family, appearance identity. | Creation/Skills UI and Air appearance only; no independent world light/audio. | config/progression/render — closed |
| 3 Element of Water | Creation root, default rows 32/35, offer/dependency family, appearance identity. | Creation/Skills UI and Water appearance only; no independent world light/audio. | config/progression/render — closed |
| 4 Element of Earth | Creation root, default rows 40/41, offer/dependency family, appearance identity. | Creation/Skills UI and Earth appearance only; no independent world light/audio. | config/progression/render — closed |
| 5 Body Discipline | Body offer bias/root and dependency page membership. | Skills/creation UI only; no world/player VFX, light, or audio. | progression/Skill Screen — closed |
| 6 Mind Discipline | Mind offer bias/root and dependency page membership. | Skills/creation UI only; no world/player VFX, light, or audio. | progression/Skill Screen — closed |
| 7 Arcane Discipline | Arcane offer bias/root and dependency page membership. | Skills/creation UI only; no world/player VFX, light, or audio. | progression/Skill Screen — closed |
| 8 Magic Missile | One-shot homing hostile projectile, damage/mana, terrain/actor contact. | Two-pass 110/111/112 Ether body; FadeMM/contact light and hit audio; cast `magicmissile`. | gameplay and shared selected-primary HUD owner — closed by v52 |
| 9 Smart Missiles | Reacquisition and turn/speed scaling of row 8. | No independent actor/light/audio; path changes the retained Missile owner. | native primary profile/targeting — closed |
| 10 More Missiles | Alternating fan quantity and added mana cost. | No independent VFX/light/audio family; each spawned row-8 actor owns the full body/contact stack. | primary emission — closed |
| 11 Call Leviathan | Persistent summon, appendage targeting, EtherBolt damage, quantity/max-equipment branch. | BadGuys 343..372/39/11/22 plus Ether compositor; Leviathan/PlaneCross audio and owned lights. | secondary actor contract — closed |
| 12 Planewalker | Toggle/hoard, timed modifier, saved primary, Plane Orb override and restore. | BadGuys 75, ether-plane mesh, birth/fade children; plane loop, toggle sounds, registered orb lights. | secondary player/actor + row 80 — closed |
| 13 Piercing | Row-8 pierce count and retained-damage factor; reacquires after exiting the contacted body. | Independent ten-tick additive BadGuys-53 streaks; no extra light/loop. | primary contact/pierce state — closed |
| 14 Ether Blast | Refreshed Magic Missile charge, rounded radial current-HP pulse, target EtherBurn. | 108 perspective particles, weapon pulse, Region flash/camera; EtherBurn 246..250 plus target MiscLight; three release sounds. | native Ether kernel/secondary target ECS — closed |
| 15 Phasing | Paid/cooldown heading probe and collision-authoritative relocation. | BadGuys-53 traversal; `phase` sound; no persistent light. | secondary action — closed |
| 16 Fireball | One-shot projectile, ranked damage/mana, terrain/actor contact. | 255..266 body, 267..270 trail, 251..254 impact; outbound point light; throw/hit audio. | gameplay and shared selected-primary HUD owner — closed by v52 |
| 17 Embers | Contact fragments with independent damage/count and spent-Ember follow-up. | Ember actors and their native Fire passes/lights; parent Fire contact audio. | Fire payload/transient ECS — closed |
| 18 Explode | Fire contact radial damage and radius payload. | Explosion/impact children, camera/light feedback, Fire hit audio; retires independently. | Fire detonation combat/view — closed |
| 19 Embers to Imps | Spent Ember becomes timed friendly GoodImp and Fire patch; takes precedence over Immolate. | GoodImp body/flame/contact banks, actor light and Imp/bite sounds. | Fire GoodImp runtime — closed |
| 20 Immolate | Spent Ember becomes damage explosion when row 19 is absent. | Fire explosion/burn presentation and ordinary Fire light/audio ownership. | Fire retirement/detonation — closed |
| 21 Ring of Fire | Paid 30-segment ring, Shockwave damage/push, Burning Man maximum branch. | DeadHawg fire ring, shockwave children, Region camera/light; `bigfire`/`nuke` audio. | secondary actor/wave — closed |
| 22 Burn | Target-owned timed Fire damage modifier and merge. | Target flames and MiscLight each tick; fire loop/contact sound ownership is shared with producer. | secondary target effect — closed |
| 23 Firewalker | Toggle/hoard, immediate and periodic trail patches, damage/duration/contact. | DeadHawg patch bank, registered patch light, `ignite` and shared `lowfire` loop. | secondary player + Fire patch ECS — closed |
| 24 Lightning | Sustained target/terrain beam, ranked per-tick damage/mana. | Dual record-44 ribbons, source/contact coronas, path/MiscLights; start and lightning loop. | gameplay and shared selected-primary HUD owner — closed by v52 |
| 25 Chaining | Ordered distinct-target hops and float32 damage decay. | Independent Lightning legs/contact fades and their existing light stack; no new cue. | Air combat/transients — closed |
| 26 Stun | Target-owned 25-tick minimum movement-factor merge. | No stock independent sprite, light, or audio; target motion is the presentation consequence. | secondary target effect — closed |
| 27 Magic Storm | Paid aimed StormCloud, strike damage range, target shuffle/query, active/fade lifecycle. | Native rain/cloud/bolt composite and lights; magic-storm/thunder plus shared rain/wind loops. | secondary Storm actor — closed |
| 28 Magic Tornado | Moves row 27, speeds strikes, adds duration/drops and maximum variant. | Moving spline/cloud branches reuse Storm light/audio with expanded children; no separate actor family. | Storm configuration/runtime — closed |
| 29 Hurricane | Refreshed Lightning aura, strict tangential Badguy/Maggot force, target cooldown, charge-cubed damage. | DeadHawg-15 core + BadGuys-84 high/low lane programs; shared steady-wind loop; explicitly no light/shadow. | Hurricane kernel/combat/view/audio — closed |
| 30 Prismatic Shock | Paid radius application and target-owned Prismatic merge; doubles later Air susceptibility. | Record-58 wave plus 110..112 children, cast sounds; no retained parent light beyond mapped children. | secondary actor/target effect — closed |
| 31 Disintegrate | Event-local Lightning percentile and strict post-hit 20-percent execute. | No independent actor/light/audio; ordinary hit/death presentation owns the result. | Air contact flag — closed |
| 32 Frost Jet | Sustained cone query, ranked per-tick damage/mana and cold contact. | BadGuys-30/28 Normal/Over particles; ice-start and ice loop; no invented emitter light. | gameplay and shared selected-primary HUD owner — closed by v52 |
| 33 Chill Wind | Distance-tapered target push and hostile Arrow tumble/removal. | Independent record-2 SpinAway for arrows; otherwise row-32 presentation/audio, no new light. | Water combat + arrow effect — closed |
| 34 Cone of Ice | Reach/aperture widening and particle width/density inputs. | Modifies row-32 geometry only; no independent actor/light/audio. | Water profile/emitter — closed |
| 35 Ring of Ice | Paid expanding one-contact FreezeWave, damage/freeze/cold branches and bursts. | DeadHawg 114/121, WhirlSnow/iceblast children and wave light; `ringofice` audio. | secondary wave/target effects — closed |
| 36 Harden | Selected pure-Water physical armor accrual/cap; release clears it. | Animated ice coating, three cyan passes, formation/shatter audio, and cosmetic fragments. | Earlier no-presentation/persistent-release claims were false; corrected by entry 121, 2026-09-04 reopening. |
| 37 Cold Aura | Held radius slow query and target merge. | Parent-following additive BadGuys-14 actor; no light/audio owner of its own. | Water channel/actor/target effect — closed |
| 38 Hail | Native hit gate, event-time damage range, bouncing actor and target contact. | BadGuys-32 Hail with bounce clocks/audio samples; no outbound light. | Water RNG/combat/actor audio — closed |
| 39 Permafrost | Scales Water cold strength/duration and Frozen/ColdSlow material/lifecycle. | No independent actor/light/audio; target material/status actors own visible consequences. | Water profile/secondary modifiers — closed |
| 40 Boulder | Persistent held/released rock carrier, gathered rocks, charge, collision, damage pool. | 168..171/2008..2010/86 body, CalledRock and fragments with Region-light sampling; start/gather/rolling audio. | gameplay and shared selected-primary HUD owner — closed by v52 |
| 41 Earthquake | Paid duration, shuffled enemy disruption, scenery wobble, world shake. | Floor copies, cracks/dust/lit debris; earthquake/rock/crack audio; mapped Region light/feedback. | secondary Earthquake actor — closed |
| 42 Hasten Rocks | Accelerates row-40 charge/gather recurrence and adds mana cost. | Inherited Boulder/CalledRock art and loops only; no independent light/audio. | Earth profile/charge kernel — closed |
| 43 Bind Rocks | Row-40 toughness/damage-pool retention and mana cost. | No independent actor/light/audio; retained rock/contact lifetime changes. | Earth contact pool — closed |
| 44 Rock Surge | Paid percentile branch creates an immediate full-charge moving Boulder. | Reuses complete Boulder body/light and start/rolling audio; no surrogate surge sprite. | Earth cast branch — closed |
| 45 Raise Golem | Paid collision-adjusted summon, HP/two damage lanes, AI, one/two-owner cap. | Complete Golem assembly/body/death banks, lights and crack/provoke/step/contact/death sounds. | secondary Golem runtime — closed |
| 46 Stoneskin | Paid timed invulnerability modifier and common damage interception. | Player stone-material treatment; on/apply/removal sounds; no world light. | secondary player modifier — closed |
| 47 Gargantuan | Raises row-40 maximum charge/size and resulting rock/body/contact scale. | Inherited Boulder/fragment painter/light/audio only. | Earth profile/Boulder runtime — closed |
| 48 Teleport | Paid/cooldown native destination policy and collision-authoritative relocation. | Two BadGuys-90 source/destination bursts; teleport sound; no light. | secondary action/transients — closed |
| 49 Magic Circle | Paid aimed field, ten-tick slow and player HP/MP pulses. | BadGuys-48/7 rings, flickering shadow-casting Region light; magic-circle sound. | secondary actor/target/player effects — closed |
| 50 Magic Trap | Paid weld/primary selector, charge, trigger queries, damage and elemental target modifier. | Native trap/shimmer/terminal banks, camera/light; selector cast sounds, trap/electric loops. | secondary trap/target ECS — closed |
| 51 Dampen | Paid caster rectangle, projectile removal, shield dispel, disruption, CastSpin. | 360 MoveFades + 30 additive fades; flash/dampen sounds; no invented light. | secondary action/world mutation — closed |
| 52 Spell Welding | Learned recipe/vector, selected-primary row, ten build dispatches and offer rules. | Special Skills selectors 108..117; each build owns its fully mapped native VFX/light/audio; no standalone cast actor. | gameplay, Skill Screen, and build-specific in-run HUD emblem — closed by v52 |
| 53 Flash | Defensive chance response, radius-100 Dazzle and duration. | 8 record-16 + 4 record-15 children, Region flash/camera, flash sound; no persistent light. | harmful-contact/secondary response — closed |
| 54 Magic Shield | Paid absorb state, hit pulse, break and optional row-55 payload. | Record-49 shell, break particles/FuzzySpears/shockwave, shield sounds and mapped light/camera. | secondary player/combat/view — closed |
| 55 Explosive Shield | Adds paid damage payload to row-54 break and radius-110 hostile contact. | Break explosion/502-word visual and `magicshieldexplode` audio; uses row-54 lifecycle/light owner. | Magic Shield payload — closed |
| 56 Mana Up | Adds configured maximum mana. | Dynamic mana-track/core and available-mana consequence only; no independent VFX/light/audio. | derived stat and dynamic maximum-meter geometry — closed by v52 |
| 57 Channel Mana | Multiplies mana recovery; concentration adds its second factor. | Meter recovery and selected-concentration emblem; no independent world VFX/light/audio. | gameplay and in-run concentration emblem — closed by v52 |
| 58 Meditation | Idle delay/recovery multiplier and concentrated acting/moving ramp. | Meter recovery and selected-concentration emblem; no independent world VFX/light/audio. | gameplay and in-run concentration emblem — closed by v52 |
| 59 Battle Mage | Reduces offensive mana costs; concentration composes. | Selected-concentration emblem; selected casts retain their own presentation; no independent world VFX/light/audio. | gameplay and in-run concentration emblem — closed by v52 |
| 60 Focus | Secondary recharge factor and concentrated instant-recharge percentile. | Selected-concentration emblem; affected skill's ordinary next cast owns feedback; no independent world VFX/light/audio. | gameplay and in-run concentration emblem — closed by v52 |
| 61 Siege Mage | Raises offensive damage; concentration composes. | Selected-concentration emblem; damage producer retains its own effects; no independent world VFX/light/audio. | gameplay and in-run concentration emblem — closed by v52 |
| 62 Resist Magic | Reduces incoming magic damage; concentration composes. | Selected-concentration emblem; no independent world VFX/light/audio. | gameplay and in-run concentration emblem — closed by v52 |
| 63 Creativity | Fourth offer, relaxed picker eligibility, concentrated Insight double-apply. | Selected-concentration emblem plus Skill picker Insight/shared audio; no world light. | gameplay and in-run concentration emblem — closed by v52 |
| 64 Health Up | Adds configured maximum health. | Dynamic health-track/core consequence only; no independent VFX/light/audio and no concentration emblem. | derived stat and dynamic maximum-meter geometry — closed by v52 |
| 65 Enchant Staff | Adds staff damage, rank changes target selection, concentration speeds melee by 1.75; positive effective rank continuously enables the selected-primary-colored Staff attachment glow. | Selected-concentration emblem plus Staff action/contact art/sounds and the always-on additive shaft/gradient compositor; the compositor is not a Region light. | closed by v52 gameplay/emblem plus entry 010's 2026-08-29 exact attachment correction and Mac browser receipt |
| 66 Telekinesis | Scales Orb/Gold/Sack/Bonus pull and pickup ranges; concentration doubles. | Selected-concentration emblem plus existing loot motion/pickup art/audio; no independent light. | gameplay and in-run concentration emblem — closed by v52 |
| 67 Rush | Player movement multiplier; concentration composes. | Selected-concentration emblem plus locomotion/gait consequence; no independent world VFX/light/audio. | gameplay and in-run concentration emblem — closed by v52 |
| 68 Deflect | Staff-gated chance cancels eligible contact; concentration reflects physical damage x5 in range. | Selected-concentration emblem, source-facing and pitched `swipe` audio; no actor/light. | gameplay and in-run concentration emblem — closed by v52 |
| 69 Resist Poison | Reduces poison duration; concentration composes. | Selected-concentration emblem plus status-duration consequence; no independent world VFX/light/audio. | gameplay and in-run concentration emblem — closed by v52 |
| 70 Faster Caster | Cast/action progress factor; concentration composes. | Selected-concentration emblem; existing Staff/cast animation and sound accelerate; no independent light. | gameplay and in-run concentration emblem — closed by v52 |
| 71 Fortunate Flailing | Staff proc selection; concentrated non-normal damage multiplier. | Selected-concentration emblem plus Knockback/Disable/Critical/Whirl children/sounds; no light. | gameplay and in-run concentration emblem — closed by v52 |
| 72 Acid Rain | Paid aimed persistent direct-damage field and shuffled subset pulses. | Native rain/field/splash passes and light; magic-storm/acid-sizzle/rain loop. | secondary Acid actor — closed |
| 73 Fire Wall | Paid aim-perpendicular eleven-patch field and contact damage. | DeadHawg patch bank/light; ignite, fire-hit and shared low-fire loop. | secondary Fire patches — closed |
| 74 Ether Drain | Paid aimed field, refreshed candidates, distance-tier damage and pull. | Ether-plane/BadGuys/DeadHawg children and Region light; distort/lightning plus plane/wind loops. | secondary Drain actor — closed |
| 75 Iron Golem | Adds row-45 mana cost, Iron presentation/state and physical reflection factor. | Iron Golem overlays/assembly/contact/death art and existing Golem sounds/lights; no separate summon. | Golem configuration/combat — closed |
| 76 Call Comet | Paid fall actor, radius-400 impact damage/freeze and shared FreezeWave. | DeadHawg-5 body, trails/debris/overlay/light; comet loop/whistle and impact sounds. | secondary Comet/wave — closed |
| 77 Turn Undead | Paid family-filtered flee/weaken for Skeleton/Archer/Mage/Zombie. | 35 gray record-48 fades; level-up audio sample pitches 2 then 3; no Region light. | secondary area/target effects — closed |
| 78 Mindstar | Toggle/hoard, temporary +1 effective rank across learned rows, overload cleanup. | Region toggle feedback and mindstar audio stream; no world actor/light. | secondary player/progression — closed |
| 79 Regenerate | Toggle/hoard and fixed `1.5/tickRate` HP recovery, overload cleanup. | Orange Region point feedback and shared mindstar audio stream; no world actor/light. | secondary player/tick — closed |
| 80 Plane Orb | Runtime primary forced by row 12; aimed orb, homing/acceleration, damage and fade. | BadGuys-75, repeating ether-plane mesh, 11/45 children, actor light; distort/lightning/plane audio; forced selected-primary emblem. | gameplay and forced in-run HUD emblem — closed by v52 |
| 81 Reserved | No CFG, rank, cast, player/enemy/world effect; selector storage boundary only. | Skills record 108 overlaps the first weld special selector; no independent audio/light/lifecycle. | catalog/Skill Screen negative disposition — closed |

The mechanical property audit covers every numeric CFG key. The apparent
unconsumed Water profile members (`armorMaximum`, `armorPerSecond`,
`auraSlowFactor`, `hailChance`, `minimumColdDurationTicks`, `slowdownScale`) are
not orphaned effects: Harden has its player-runtime cache, while the remaining
values are retained intermediates for consumed movement, threshold, duration,
and damage fields. CFG `mBonus` values are display-format strings, not missing
numeric gameplay inputs. No other property-only gap remains after Hurricane.

## 2026-08-21 v50 cross-platform all-skill acceptance

Commit `8b87f0ae2b190c0acfe6a94160c86ad4c765dc5a` was checked out independently
on native Windows and the arm64 Mac mini. Both platforms ran the unchanged
canonical `./scripts/validate.sh` entrypoint with the pinned Node `22.17.0`, npm
`10.9.2`, and .NET SDK `10.0.302` toolchain. Each passed:

- 24 backend contracts plus backend Release build/formatting;
- lint and game architecture boundaries (only the eight pre-existing Fast
  Refresh warnings);
- 41 loot tests and 201 focused pretests, including the enforced 82-row
  effect/light/audio ledger;
- all 1,189 broad Boneyard, host, protocol, combat, rendering, and lifecycle
  tests;
- level-up, diagnostics, Hub UI, and desktop auxiliary suites;
- production Vite and game-host builds, production media policy, and bundle
  budget at 287,819 raw bytes and 79,097 gzip bytes.

The first disposable Windows clone revealed one POSIX-only test fixture:
`file:///repo/...` is not an absolute Win32 file URL. Production resolver code
was unchanged; the test now constructs platform-native paths with
`pathToFileURL` and `resolve`. A fresh LF checkout then passed the complete
native Windows gate. The acceptance directory owns an isolated SDK install;
no system-wide SDK or shared Website checkout was changed.

The exact-head `smoke:game:hurricane` journey also passed on both platforms.
It created a real Air wizard, refreshed learned Hurricane rank one through the
host-owned skill state, held real Lightning beyond charge `0.5`, inspected the
protocol-45 actor, rendered WebGL at `1600x900`, and released through complete
decay/teardown. Both receipts proved eight lanes, damage range `10..20`, the
one-step charge/contact split, positive phase, one shared steady-wind loop and
balanced stop, zero page/console/network errors, and no retained actor after
release. Windows sampled `125 FPS / 5 ms` in the visual receipt and wrote
`C:\Users\User\codex-acceptance\solomon-hurricane-win-final.png`; macOS
26.4.1 arm64 sampled `60 FPS / 0 ms` and wrote
`/Users/jarrett/codex-acceptance/solomon-hurricane-mac-final.png`.

## 2026-08-21 v51 current-main all-skill integration acceptance

Code cutoff `981fec5a6888af5b714456e9a5ce7762c6f2735c` rebases the complete
82-row skill closure onto Website main `afbfb3b20a8a96f24def9359f08048093ca1f31c`.
The merge retains party-invitation denial, the revised remote-player
presentation, shared-Hub/save ownership, Hall scoring, the mixed eight-slot
quickbar, and protocol 45 beside every skill runtime. No party or skill message
was dropped, and the superseded `client-assign-belt-skill` path is absent.

Linux, native Windows, and the arm64 Mac mini independently ran the canonical
`./scripts/validate.sh` gate on that exact code tree and exited zero. Each passed
13 backend contracts, Library `2/2`, loot `41/41`, focused/pretest `216/216`,
broad Boneyard/runtime `1230/1230`, parties `16/16`, level-up `5/5`, diagnostics
`7/7`, Hall `15/15`, Hub UI `14/14`, desktop `5/5`, lint/import boundaries,
production builds, bundle budget, and media policy. The eight existing Fast
Refresh warnings remain non-failing. The game entry is
`Game-DJCePvoy.js`, 344,882 raw / 97,474 gzip bytes. Receipts are:

- Linux: `/tmp/solomon-final-linux-981fec5.log`;
- Windows: `C:\Users\User\codex-acceptance\solomon-final-windows-981fec5.log`;
- Mac: `/Users/jarrett/codex-acceptance/solomon-final-mac-981fec5.log`.

The exact-code Mac Chrome matrix then passed every browser-owned skill surface:

- all 23 right-click abilities produced their mapped semantic world/player/
  target effects, VFX kinds, lights or explicit no-light branches, audio,
  maximum-equipment variants, cooldowns, and teardown in WebGL2, with empty
  page and console errors;
- all five ordinary primaries and all five forced-zero-MP primaries completed
  Hub and Boneyard presentation/audio/lifecycle journeys. The low-MP run forced
  75,073 authority samples and returned five zero-error receipts;
- the low-MP pass corrected two stale acceptance assumptions: Ether's recovered
  `Sound::Play(pitch,gain)` launch is `.75/1`, and its rank-one half-damage draw
  is the discrete `.5..1` range rather than a fixed one;
- a long-held weak Boulder proved that float32 repeated halving may reach
  `damage=0` and `remainingDamage=0`. Protocol now accepts that native held
  state, still rejects negative values, and release promotes the same actor to
  the native `.25` positive floor. Focused kernel and protocol regressions pass;
- the mixed Skill Screen/quickbar returned `duplicateSecondary=true`,
  `mixedQuickbar=true`, and selected Fireball; pause/settings completed both
  Hub and Boneyard owner/peer clocks; built-bundle Ether tracking recorded three
  nonzero authoritative turns with empty errors;
- Hurricane returned protocol 45, eight lanes, damage range `10..20`, contact
  charge `0.5010014772415161`, active charge `0.5025014877319336`, and empty
  page/console/network errors. Its screenshot is
  `/Users/jarrett/codex-acceptance/solomon-hurricane-mac-981fec5.png`.

Browser logs are under `/Users/jarrett/codex-acceptance/` with the
`*-981fec5.log` suffix. This v51 text is a documentation-only follow-up to the
tested code cutoff. The final membership rescan found no unresolved skill row,
effect owner, VFX/light/audio branch, cast gate, protocol member, or
platform-blocked implementation.

## 2026-08-28 — User-authorized Hail release cleanup QoL

### Reported smell and recovered cause

- Reported behavior: Hailstones now casts successfully, but stationary rock
  artifacts remain around the cast root after the carrier releases and its
  impact presentation finishes.
- Mac Chrome isolated eleven held rocks and eleven matching
  `weld-hail-rock-fade` actors. Terrain particles/bouncers retired first; all
  eleven fades remained visible before naturally reaching zero.
- Fresh retail instructions confirm this is not a Pixi leak. Hail rebuild
  `0x005F3090` constructs a separately registered `Anim_Fade 0x00452E20`,
  writes alpha `4.0` at `0x005F33E8` and loss `0.01` at `0x005F33F2`, and
  `Anim_Fade::Tick 0x00454000` subtracts until zero: 400 fixed ticks. The Hail
  release `Anim_FadeFrost` is the distinct 20-tick actor.

The user explicitly authorized visual cleanup after this native behavior was
identified. The Website therefore adopts a narrow QoL divergence: rock-birth
fades remain exact while the Hail carrier is held, then fades born by that cast
retire on its release. Gameplay, RNG, carrier/rock state, contact children,
terrain impact, audio, light, and all other welded builds stay native.

### System boundary and membership inventory

Native/QoL system: **Hail rock-birth child lifetime at the held-to-flight
boundary**.

| Member / branch | Source | Disposition | Proof |
| --- | --- | --- | --- |
| enhanced rock rebuild and `Float(20)` rotation | `0x005F3090` | `verified-already-at-parity` | every new rock still consumes the exact RNG and creates its held fade |
| record-18 fade alpha/loss | `0x005F33E8/0x005F33F2`, `0x00454000` | `verified native behavior; explicit user-authorized QoL at release` | held ages remain exact; release removes only same-cast children |
| release FadeFrost | `0x005FAC70` | `verified-already-at-parity` | independent 20-tick Water compositor remains |
| held normal/underpowered Hail | build 1008 owner | `exact-ported` | both retain visible birth fades until release |
| same-owner earlier Hail cast | actor birth ticks | `exact-ported QoL scoping` | older-cast children are not confused with the releasing carrier |
| terrain particles/bouncers and target line/flash | `0x005FBDE0` | `verified-already-at-parity` | no cleanup widening to impact actors |
| builds 1000..1007/1009 | separate welded actor families | `out-of-system` | no Hail rock-birth child |
| owner death/disconnect/world replacement | existing teardown | `verified-already-at-parity` | complete cleanup remains broader than release QoL |
| host, observer, late join | shared transient list | `exact-ported by authoritative removal` | no renderer-local suppression or protocol fork |

No member is `blocked-by-platform`.

### Implementation and validation contract

- In the persistent-weld release owner, associate a Hail rock fade with the
  releasing cast by world, owner, build, and birth interval. Remove those
  children atomically with the held carrier-to-flight transition. Do not add a
  timer, renderer filter, setting, or compatibility branch.
- Red/green coverage must retain held fade creation/RNG, release FadeFrost,
  Hail flight/impact children, earlier-cast independence, owner/world teardown,
  protocol round-trip, and audio loop balance.
- Mac Chrome must hold build 1008 until multiple rock births, release, observe
  the carrier/impact family, and prove zero rock-birth fades immediately after
  the release frame while all intended children render and error arrays remain
  empty.

### Implemented result and browser acceptance

- Release ownership now removes only `weld-hail-rock-fade` children matching
  the releasing Hail actor's owner, world, and birth interval. Earlier same-
  owner Hail children remain independent; the release carrier and native
  `weld-frost-fade:1008` actor are unchanged.
- Mac focused validation retained held fade creation, an earlier-cast fade,
  same-cast cleanup, and the distinct release fade.
- Chrome `151.0.7922.174` held until three current-cast rock-birth fades were
  both authoritative and rendered. The release frame reported
  `heldFadeCount=3`, `releasedFadeCount=0`, and retained kinds
  `weld-persistent:1008` plus `weld-frost-fade:1008`; page, console, and failed-
  response arrays were empty. Visual receipt:
  `.tmp-hail-final/hail-release-no-rock-fades.png` (temporary acceptance
  capture).
- The same exact candidate passed the complete Mac gate recorded in entry 051,
  including the broad Boneyard/runtime suite and production bundle budget.

## 2026-08-30 — Steam Jet learned-Fire detonation corrective reopening

### Reported smell and parity question

- A player reported that holding Steam Jet after learning Explosion creates
  overwhelming rapid audio and a visually distracting wall of explosions in
  the web port. The submitted 11.041-second H.264/AAC capture is
  `SDB - Bug Rapid Steam explosion fire example 2.mp4`, SHA-256
  `5a30faf413f42a1878262fbf2da6ec9f48f4a3e0ced167b751bdc0d1f49bc900`,
  at `1854x1080` and `179/6` FPS.
- The web causal path exported one pulse for every live `Steamed` modifier tick,
  then incorrectly passed every pulse to the ordinary Fire helper. That born
  `fire-explosion` used two Fire cues and could create ordinary Fire Embers on
  every pulse.
- The falsifiable native questions were whether `Mod_Steamed` really ticks for
  ten updates, whether it calls shared Fire helper `0x00642BF0`, whether stock
  owns a recurrence/cooldown outside the modifier clock, and which VFX, audio,
  child, collision, and teardown family consumes its stored Fire vector.

This is a secondary report in a system previously called closed. The earlier
pass followed the Steam particle into `Mod_Steamed` but stopped before the
damage event's type-2 consumer. It therefore treated the stored Fire vector as
an ordinary `0x00642BF0` payload and skipped the sibling helper, audio registry
member, color-overlay class, child factory, and non-recursive contact branch.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Submitted web capture | player capture above, received 2026-08-30 | A sustained target contact keeps large ordinary Fire stacks resident while the report identifies intolerable repeated audio. | high-web |
| Retail image | `SolomonDark.exe` 0.72.5, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Source of every address and constant below. | high |
| Steam actor and modifier | `Anim_SteamJetEffect::Tick 0x0045B940`; `Mod_Steamed` RTTI/vtable `0x0079E3C0`, type `0x1B6C`, constructor `0x006232F0`, tick `0x00625F40`, merge `0x00625C80` | Normal non-weak particles install a ten-tick target modifier. Each live modifier tick dispatches Fire damage and writes special event type 2 when stored Explosion radius is positive. | high |
| Event producer/consumer census | all five `DAT_0081C70C` xrefs; type-2 write `0x00625FDA`; receiver branch `0x0047704D..0x004770B7`; sole `0x00643CA0` xref at `0x004770B7` | Steam does not call shared Fire helper `0x00642BF0`. Type 2 has exactly one consumer: the distinct Steam detonation helper `0x00643CA0`. | high |
| Steam detonation instructions | `0x00643CA0..0x0064445D`; `Anim_SpriteArray_ColorOverlay::Draw 0x0045DA80`; `Anim_SteamJetEffect` constructor/tick/draw `0x00453CE0/0x0045B940/0x00458550` | The burst has the shared three visual clocks but gray overlays and optional normal Steam-particle children, not ordinary Embers. | high |
| Audio registry and call | `0x00643D35..0x00643D86`; registry offset `+0x4BC`, index 27, `sounds\\explodesteam`; source SHA-256 `f93fca2917072811b96f4ec4c3c864c66f0bb785f05c6113e1931661471df090` | Each Steam detonation birth requests only `explodesteam` with signed `Float(.1)+1` pitch and doubled point gain. It does not request `fireballhit` or `throwfire`. | high |
| Candidate Chrome protocol falsifier | Mac Chrome held-contact journey on protocol 112 | Repeated valid births reached the positive float32 endpoint `1.100000023841858`; the decimal `<=1.1` parser bound rejected it and disconnected the client. The native interval is `[f32(.9),f32(1.1)]`. | high-web |
| Current Website source | `native-secondary-abilities.ts`, `boneyard-spell-combat.ts`, `primary-spell-fire-effects.ts`, `primary-spell-audio.ts` at base `b023703c` | Correct modifier cadence and values are present, but every exported pulse is materialized as ordinary Fire VFX/audio/Embers. | high |

Ghidra ran read-only through the canonical replica wrapper at Mod Loader revision
`08bfba9e`, wrapper SHA-256
`b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`.
No runtime/ASLR address is used in this entry.

### System boundary and membership inventory

Native system: **Steam Jet contact through target-owned `Mod_Steamed`, event
type 2, Steam detonation, learned-Fire Steam children, audio, replication, and
teardown**.

| Member / branch | Native source | Required disposition in this pass | Proof contract |
| --- | --- | --- | --- |
| normal full-power Steam particle | `0x00453CE0`, `0x0045B940` | `exact-ported` | random `Integer(10)` contact clock, ten-tick recurrence, target query, modifier install |
| Over Steam particle | constructor/handler Over branch | `verified-already-at-parity` | no `Mod_Steamed` contact lane |
| underpowered normal particle | handler weak branch | `verified-already-at-parity` | quarter alpha and no `Mod_Steamed` contact lane |
| target-owned `Mod_Steamed` lifetime/tick | `0x006232F0`, `0x00625F40` | `exact-ported` | ten ticks, per-tick direct Fire damage, owner/source identity |
| repeated modifier merge | `0x00625C80` | `exact-ported` | maximum duration, damage, radius, fragment count, and fragment damage; strongest source ownership |
| Explosion radius zero | `0x00625FCE` strict positive gate | `exact-ported` | direct Steam damage only; no type-2 VFX, audio, or learned fragments |
| Explosion radius positive | type-2 damage event plus `0x00643CA0` | reopened 2026-10-13 | payload on each admitted modifier damage event; one detonation only on an eligible terminal death; no guessed cooldown |
| orange record-15 core | `0x00643D8B..0x00643E3D`, BadGuys 15 | `verified-already-at-parity` through shared clock | ages 0..9, scale `visualScale*6`, alpha loss `.1` |
| gray first array | BadGuys 401..419, `Anim_SpriteArray_ColorOverlay` | `exact-ported` | tint `(.8,.8,.8,1)`, additive, `.75*.98^n`, ages 0..34 |
| gray rising lit array | BadGuys 420..433 plus `ZAnimLit` | `exact-ported` | tint `(.8,.8,.8,1)`, `.625*.97^n`, rise, ages 0..36, same provider light |
| Steam detonation audio | registry 27 at `MyApp + 0x4BC` | `exact-ported` | `explode-steam` only, signed `.1` pitch with exact float32 endpoints, doubled point gain, once per birth |
| learned fragment fan | `0x0064418D..0x00644438` | `exact-ported` | private `Float(360)` start; three normal Steam children per configured count; complete ten-word program per child |
| learned fragment motion | same range | `exact-ported` | signed `Float(25)` heading, `Float(10)` birth offset, speed `4*.9*1.5*(.9+Float(.1))`, Y times `.8`, stretch times `.6` |
| learned fragment contact | `0x006443B7..0x006443F2`, merge `0x00625C80` | `exact-ported` | damage `fragmentDamage/100`; zero own payload cannot detonate alone, while max-merge refreshes and preserves a stronger resident Explosion until target loss |
| ordinary shared Fire helper | `0x00642BF0` callers | `out-of-system` for build 1005; still exact for 1000/1003/1007 and Fire-family callers | negative 1005 caller test and unchanged ordinary fixtures |
| Hub/private rooms and Boneyard | Region helper and shared primary world view | `exact-ported` | same authoritative state, point gain, painter/light, and audio semantics in every world key |
| host, observers, late join | primary transient and secondary target-effect snapshots | `exact-ported` | strict protocol round-trip and no observer-side RNG/rerouting |
| expiry, target death, owner disconnect, world reset | modifier/transient owner removal and existing teardown | `exact-ported` | no retained modifier, child, view, light, or audio replay after owner/world removal |

No member is blocked by the browser platform.

### Native ownership thread and recovered behavioral contract

- Only a normal, full-power Steam particle owns the contact clock. Its first
  clock is `Integer(10)` and each due edge resets to ten while life remains
  above `.5`. Over and weak particles cannot install the modifier.
- `Mod_Steamed` begins with duration ten. Before submitting direct Fire damage,
  its tick, only when stored Explosion radius is positive, writes event type 2 with
  visual scale `float32((radius-10)*.180000007+1)`, Explosion damage, fragment
  count/damage, source slot, and a private `Integer(1,000,000)` seed.
- Re-contact merges into the resident modifier. This controls direct-damage
  recurrence, not explosion recurrence. A continuously contacted survivor may
  remain steamed without any detonation. Only the admitted terminal-death
  receiver can consume the current event's type-2 payload.
- The type-2 receiver creates the same record-15 core and 401..433 clocks used
  by Fire, but both sprite arrays use `Anim_SpriteArray_ColorOverlay` with
  gray RGB `.8`. The area supplies half the stored damage to each of physical
  and magic lanes, giving full damage to a neutral unshielded target. Its mask-2
  query is limited by a root square of side `f32(visualScale*55)`, followed by
  the native distance test; it is not an unrestricted radius query. See entry
  162 for exact bounds, flags and receiver ordering. The lit array owns the
  existing transient light.
- Each birth requests one positional `explodesteam` one-shot. Pitch spans the
  inclusive float32 interval `0.8999999761581421..1.100000023841858`. The
  ordinary Fire pair (`fireballhit`, then `throwfire`) is unreachable from this
  branch.
- When the stored learned-fragment count is positive, the helper creates three
  normal `Anim_SteamJetEffect` children per count. Constructor and private fan
  RNG remain authoritative. Their own payload fields are zero, so a standalone
  child contact cannot create an Explosion or fragment fan. Contact with a
  still-resident stronger `Mod_Steamed` follows `0x00625C80`: duration refreshes
  and the maximum Explosion/fragment fields remain. The family can therefore
  sustain on that target until target death/removal, after which no new child
  contact is admitted and every actor retires on its own clock.
- Target/modifier state is host-owned. Explosion and child actors are stable
  replicated identities; clients render and play each birth edge once, then
  retire it on the fixed clocks. Owner/world teardown removes the whole family.

### Confidence and open questions

- Confirmed: owner, producer/consumer census, event discriminator, duration,
  merge fields, gate, area formula, full VFX records/classes/clocks, audio asset
  and call arguments, complete child RNG/motion/contact program, authority, and
  teardown consequence.
- The former claim that no mechanism remained inferred was false: this trace
  stopped before terminal-death admission and misread paired area lanes and
  query broadphase. The 2026-10-13 recovery below supersedes those conclusions.

### Web implementation consequence and validation contract

- Keep `Mod_Steamed` direct damage in the authoritative secondary kernel.
  Replace the unconditional presentation pulse with its ephemeral type-2
  damage payload and the common terminal-death consumer. The Steam factory
  retains its distinct children and presentation in `native-weld-steam.ts`.
- Add a replicated Fire-explosion presentation variant so the shared clock,
  area mechanics, registration, and light remain one deep module while Steam
  owns gray array tint and `explode-steam` audio. Remove build 1005 from the
  ordinary Fire cue pair.
- Replace ordinary Fire Ember births on admitted Steam terminal deaths with the exact
  three-per-count normal Steam child program. Gate the whole detonation/fragment
  family on positive Explosion radius and preserve zero-payload child semantics
  plus the resident modifier's maximum-field merge.
- Focused tests must cover normal/Over/weak contacts, all ten modifier ticks,
  strong/zero-payload merge and re-contact, radius-zero negative behavior, ten
  surviving modifier ticks with no explosion, one eligible terminal burst, gray plans at all three
  lifetime boundaries,
  one/count/multiple fragment fans and RNG, fragment contact merge behavior,
  area damage, protocol/copy/interpolation, both scenes, release, target-death
  teardown, and owner/world teardown.
- Mac Chrome acceptance must reproduce the reported held Steam+Explosion
  contact, record per-cue/per-kind birth counts, prove no `fireball-hit` or
  `throw-fire` request from this branch, show the gray stock family rather than
  an ordinary Fire wall, and return empty page/console/failed-response arrays.

### Implementation validation receipt

- `native-weld-steam.ts` now owns the type-2 Steam detonation constructor and
  its complete private fragment program. The combat bridge no longer admits
  build 1005 to the ordinary Fire helper. Shared explosion state carries an
  explicit `fire|steam` presentation family through protocol 113, render plans,
  interpolation/copy, audio, and all ordinary Fire/Ring callers.
- Steam births render the stock orange record-15 core plus gray
  `Anim_SpriteArray_ColorOverlay` 401..419 and 420..433 banks, retain the native
  light and area damage, play only `explode-steam`, and create three normal
  zero-own-payload Steam children per learned fragment. Stronger resident
  modifier fields survive zero-payload child refresh exactly as
  `0x00625C80` specifies.
- The first held-contact browser run falsified the decimal parser ceiling: a
  valid signed pitch reached float32 `1.100000023841858`. The Steam change
  first landed in protocol 112; current protocol 113 retains the exact
  inclusive float32 interval
  `0.8999999761581421..1.100000023841858` and rejects `1.1001`.
- The exact code candidate `3f8257ade8c7d07f58ba2ec6b9b4e70d7252aa3a`,
  tree `1e6e91430dc25e23e4d836fe9757238390efe25e`, rebased on
  `0bbd37fd491875f98463f1f96759c43955aea7f5`, was byte-identical across
  the local and detached Mac worktrees. On Apple M2/macOS 26.6.2 with Node
  22.17.0 and .NET 10.0.302, `./scripts/validate.sh`
  exited zero: 28 backend/repository contracts; frontend groups 61, 10, 49,
  18, 340, 7, 1,802, 6, 5, 5, 9, 60, 17, 47, 7, 36, and 86; desktop 5;
  formatting, lint/import boundaries, production frontend/game-host builds,
  bundle budget (`266594` raw / `81020` gzip), and CSP media policy. The
  complete captured gate log
  SHA-256 is
  `65d4321f14d169366e6de213578afb0773be84d1087dd774dc137ed03defda19`.
- Chrome 151.0.7922.174 then held Steam+Explosion on the same final tree. Its
  wire observed 69 distinct Steam explosions and 828 learned Steam children,
  with zero ordinary Fire explosions and zero Fire Embers. Audio observed 134
  `explode-steam` births at pitch `0.9023119807243347..1.098647952079773`,
  zero `fireball-hit`, and zero `throw-fire`. Release cleared the cast latch;
  target removal stopped refresh and the complete explosion/particle family
  retired. Page, console, failed-response, and runtime-error arrays were empty.
  The browser log SHA-256 is
  `053ba1de66f0f55d5485945482140ffd713a745eeddbfc98ea99631ed1d2e506`.
  The inspected `1600x900` capture
  `/tmp/solomon-steam-explosion-native-family-final5.png` has SHA-256
  `c736fd1f50ae2fbdc2c8de601aa391d88c34d0fe6ac2d5fb75c1db019d924974`.
- The correct `explode-steam.wav` is `-16.6 LUFS`, replacing the simultaneous
  wrong `fireball-hit` (`-13.4 LUFS`) and `throw-fire` (`-15.7 LUFS`) pair on
  every birth. Stock recurrence is preserved; the fix removes the falsely loud
  two-cue Fire stack instead of inventing a cooldown.
- No member is blocked by the browser platform and no behavior remains inferred.
  This receipt is a documentation-only follow-up to the validated code cutoff.
  Publication is pending; no push, deployment, or production restart occurred.

## 2026-09-05 — Retained Weld drawing resources during long Boneyard runs

The performance pass starts from Website `530b7d2a4e4859af9d8603a52ee0a30ef9ab6e3d`.
The user requires unchanged visuals. The supplied schema-28 browser continuation
at tick 53666 restores 29 enemies, 361 death fragments and 166 Storm actors.
A Mac M2 production-build journey holds 60 FPS at normal speed; diagnostic 6x
CPU pressure exposes rendering and allocation cost. A 62,500-tick simulation
replay reaches wave 12 and 100 simultaneous enemies with mean tick cost 0.301 ms.
These observations separate browser resource work from simulation cadence.

The causal source trace finds that `WeldPrimarySpellView` recreates every split
band's sprites, Graphics and MeshSimple geometry on every presentation update.
Unsplit Weld meshes are also rebuilt every update. Pixi 8.19.0 `Mesh.destroy()`
only detaches its geometry listener; it does not destroy the geometry's buffers.
A Mac constructor/destructor probe leaves all three mesh buffers undestroyed.
This is an ownership defect; retained GPU growth must be measured separately
rather than inferred from that probe alone.

The owning system is the Weld plan consumer, including every variant accepted
by `isNativeWeldPresentationState`, its split wrappers, and its resource teardown.
The existing native extraction above and entry 297 remain the visual authority:
`ZAnimSplit` (`0x005E0230`) draws one semantic child through ordered 25/50-unit
clips. It does not require cloned vertex storage or new display objects each
frame. This pass changes allocation and resource ownership only.

| Membership | Disposition / preservation requirement |
| --- | --- |
| 1000/1001/1002/1009 moving projectile and fade families | `exact-ported`: retain the existing unsplit sprite/line/mesh order and every plan value |
| 1003 Flame Lash and its fade | `exact-ported`: retain dynamic ribbon geometry, texture, alpha, clip rectangles and ordered painter insertions |
| 1004 Blizzard and source/contact/chain children | `exact-ported`: retain both beam passes and independently registered child effects |
| 1005 Steam | `verified-already-at-parity`: unchanged native plan and sprite presentation, using the same consumer |
| 1006 Boulder/debris, 1007 Meteor/markers/impacts, 1008 Hail/terrain/contact children | `exact-ported`: unchanged plan membership, transforms, topology and lifetime |
| Hub, tutorial, Boneyard and multiplayer observers | `exact-ported`: one shared consumer, no scene or quality branch |
| Ordinary Air and Water shared-geometry owners | `out-of-system`: already explicitly destroy their independently owned geometry |
| Secondary spell, scenery shadow and UI mesh consumers | `out-of-system` for Weld rendering; separate lifetime audit, no inferred visible change |

Implementation structure: `primary-spell-weld-view.ts` continues to own semantic
actor state, painter bands and transforms. A cohesive Weld drawing-resource
module owns the shared line context and per-plan mesh geometry, plus the
retained per-band Sprite/Mesh views. Each plan's buffers are updated once;
clipped views share them. All views detach before their owner frees geometry.
The old rebuilding paths are removed together. Texture ownership stays with
the scene atlas. No simulation, save, RNG, effect density, light, alpha,
resolution, frame cadence or clipping constants change.

Validation uses the public Weld view and existing primary-world renderer seams:
first failing repeated-update/shared-buffer/teardown tests, exact drawing-plan
comparisons, real WebGL captures of moving and retiring spells, a controlled
before/after/reverted-baseline comparison, and the complete Mac Website gate.

### Drawing and lifetime measurements

A real Mac Chrome WebGL comparison loads both implementations into the same
runtime with the actual packed stock atlas and native material pipeline. It
renders Flame Lash and Blizzard, normal and underpowered, at three angles with
moving endpoints, band tint and interleaved scenery. All 12 corresponding pixel
buffers are SHA-256 identical. Empty page/console error arrays accompany the
comparison. Shared geometry changes neither clipped view count nor painter
insertion order.

One 26-band Flame Lash instance previously owns 26 geometries / 78 buffers;
the candidate owns one geometry / three buffers. After its view is destroyed,
zero candidate buffers remain undestroyed, versus all 78 baseline buffers.
This is explicit resource-lifetime evidence, not a claim about a measured GPU
heap leak in every other renderer.

A repeated-update comparison uses 20 actors, each with 30 updates, in
baseline/candidate/candidate/baseline order. Median time for 30 Flame Lash
updates is 9.9 / 0.6 / 0.6 / 9.1 ms; Blizzard is 4.4 / 0.3 / 0.3 / 3.7 ms.
The drawing loop is over 90% cheaper. Real saved-scene Blizzard firing under
6x CPU pressure improves from 50.58 to 59.44 FPS; p95 frame interval improves
from 25.5 to 21.2 ms. These are diagnostic Mac measurements, not Windows FPS
predictions. Normal-speed production journeys through the supplied save hold
approximately 60 FPS during idle, firing and recovery for Air, Blizzard and
Flame Lash, with zero long tasks and empty page/console/HTTP/host-error arrays.

The Blizzard combat journey also passes direct and chained damage, ColdSlow,
Stun, accumulated push, source glows, fade children, 26 ordered clipping bands,
cast pose and replicated actor checks. No simulation or protocol production
code changes in this pass.

The wider audit finds fresh and dense simulation ticks comfortably below the
10-ms fixed-tick budget on the M2, and the original Air save remains at 60 FPS
without artificial CPU pressure. Repeated source-plan construction and
short-lived secondary sprites still consume time, but this pass does not
change their effects or assert an unmeasured GPU leak. The selected changes
are supported by reproducible costs, equivalent output and complete teardown.

### Final integration and quality checks

The candidate was rebased onto `d617f28d6fe1bf97f4c271b9be9cdf213bcdbf40`,
including the concurrent native material correction. All 11 changed files on
the isolated local and Mac checkouts were byte-identical before acceptance.
The Mac canonical `/opt/homebrew/bin/bash ./scripts/validate.sh` passed all
2,694 Node tests and 19 backend integration tests, with no failed or skipped
Node tests. Formatting, lint, import boundaries, generated-content checks,
TypeScript, backend/frontend/game-host builds, bundle budgets and media policy
passed. Gate log SHA-256:
`b57037663528e45f3a1498b4939ce14ad4b7d32323abe08127dc63b2ba433f95`.
The production game entry is 262,313 raw / 79,055 gzip bytes.

Node's V8 coverage reports 100% lines, branches and functions for all three
changed production modules. The installed Oxlint cyclomatic-complexity rule
passes at maximum 21 with zero warnings/errors. Files contain 229, 146 and 313
lines, below the 1,000-line limit, and no explicit `any` or `unknown` types.
The old Weld rebuilding implementations were removed; shared geometry ownership
and texture lifetime have regression coverage. The existing Weld test fixture
was corrected to match its current skill-profile/vector types and included in
the TypeScript test gate.

Statement coverage is not separately reported by the installed Node analyzer.
Cognitive complexity, Halstead Difficulty, CRAP, mutation, automated duplication
and automated dead-code gates remain unmeasured because the repository has no
configured/installed analyzers for them. No analyzer dependency, metric
suppression or exclusion was added. Source/caller review found no unused new
production path or duplicate superseded implementation.

The 12 pixel comparisons were repeated successfully against the rebased native
material pipeline. The temporary isolated proof needed to register Pixi's
particle pipe, which the game already registers; this was a probe setup issue,
not a production change. All comparison error arrays are empty.

Production acceptance on that final integration holds 60.02 FPS idle and
59.90 FPS moving in a fresh stormy Boneyard. The imported original Air run,
Blizzard run and Flame Lash run each hold approximately 60 FPS through all
three eight-second idle/firing/recovery windows, with zero long tasks and
empty page, console, failed-response and host-error arrays. Final screenshots
were inspected. These measurements validate the Mac production build; the
Windows recording is reproduction context, not a Windows benchmark receipt.
No required behavioral member is blocked by the platform.


## 2026-09-20 — Spell geometry GPU-owner notification

This reopens the browser disposal portion of the 2026-09-05 ownership receipt.
That pass proved that owned buffers were destroyed but did not check whether
Pixi's GPU resource manager received the geometry unload event before listeners
were removed. Its statement that Air and Water explicitly destroy their geometry
remains true; it did not establish timely removal from GPU resource tracking.

The inspected candidate is Website base
`fb9ec4bf9486e0fac5f76e9648c043614bb4d373`, in the isolated
`perf/wave100-6a583nbx` worktree with the installed Pixi 8.19.0 dependency.
`Geometry.destroy(true)` emits `destroy`, removes all listeners, destroys owned
buffers, then calls `unload`. `GCSystem.addResource` registers its removal
callback on `unload`. Therefore direct destruction loses this notification.
This is a directly inspected JavaScript ownership issue; it does not establish
unbounded GPU memory growth or recover a new native gameplay rule.

The boundary is the three retained primary-spell mesh owners below. The existing
native spell plans, semantic actor lifetimes, clipping, materials and order remain
the authority. Only final disposal of explicitly owned geometry is corrected.

| Member | Ownership and disposition |
| --- | --- |
| Air ribbon and optional branch resources, split and unsplit | `exact-ported`: each body allocates its own MeshGeometry/buffers; its clipped displays share them. Unload once after all body displays detach, then destroy buffers. |
| Weld drawing mesh resources, all plans and clipped displays | `exact-ported`: WeldDrawingResources owns reusable per-plan geometry/buffers. Display removal and topology updates retain these resources until the drawing owner is destroyed. |
| Combined Water run capacity replacement | `exact-ported`: each run owns its Geometry and two buffers; dispose only the replaced run, retaining the shared shader/atlas and current painter position. |
| Combined Water final destruction | `exact-ported`: dispose every retained run before the owner destroys its shared shader. Hidden runs stay reusable until this boundary. |
| Atlas textures, native plans, shared Weld line context | `verified-already-at-parity`: their ownership and existing teardown are unchanged; geometry disposal must preserve textures and shader reuse. |
| Other mesh families | `out-of-system`: separately covered by the task's mesh ownership audit; this follow-up adds no inferred behavior or resource policy. |

The shared disposal helper will accept a geometry owner rather than require a
MeshSimple display. This lets Air resource records and Water run records use
it after their displays have detached without changing sharing. Regression
acceptance requires one observed `unload` before `destroy`, all owned buffers
released, resources retained through live/hidden updates, textures preserved,
and the Water shader destroyed only at the final owner boundary.

The implemented helper now covers every disposal boundary in the inventory.
The focused Mac run completed at 2026-09-20 18:49:49 UTC: all 39 tests passed
across Air, Weld, combined Water, and the shared renderer lifetime suite. The
new Air test runs 100 complete actor lifetimes across split and unsplit draws;
the Weld tests cover both retained channel families; the Water test grows four
run capacities, preserves the final run through smaller/hidden/reactivated
frames, and verifies replacement and final disposal independently. All observe
one `unload` before `destroy`, release owned buffers, and preserve atlas textures.
The Water shader remains alive through replacement and is destroyed once when
its owner retires. These are constructor/update/teardown tests with actual Pixi
objects, not measurements of GPU memory residency or browser frame time.

The canonical test TypeScript project also passed at 18:49:47 UTC. Its explicit
include list now covers the previously omitted Air, combined Water, and shared
mesh lifetime tests. This exposed and corrected test fixture types: Air now
returns its precise Air state type, and the separately owned mesh lifetime
fixture now uses its native callback signature, an uninitialized concrete
renderer, and the current Golem state fields. No casts or exclusions were added
to suppress these errors. Focused Oxlint reported zero warnings/errors, and
whitespace checks passed. Commands, timestamps, exit codes and complete logs are
in `/tmp/solomon-spell-geometry-6a583nbx/validation.json` and sibling logs on the
Mac. The first temporary typecheck configuration under `/tmp` failed dependency
resolution; a project-local configuration exposed the fixture errors above,
which were then resolved before the canonical project passed. The task's full
Website gate and long-session browser acceptance remain separate later checks.

## 2026-09-22 — Report 13: Frost Missile cold-contact ownership

### Report and evidence recorded before implementation

Report 13 tentatively says base Frost Jet welded with Magic Missile does not
slow, and asks whether Chill Wind is required. The original report and its
919x707 PNG were read in the user's archive. The image establishes the cast
appearance, not a timed slow measurement. No clean-stock GUI session was
commandeered; the contract below is instruction/data evidence, not a claimed
live-stock observation.

The previous closure skipped the branch/field ownership sweep: it tested an
invented positive-Chill vector and encoded that assumption in its tests. This
reopening owns **FrostMissile impact ColdSlow**, including direct, area,
scenery/terrain, weak cast, and target-effect expiry. Movement while the missile
is flying is a separate `+0x16C` push consumer, not the cold-contact predicate.

Retail 0.72.5 was hashed again: 4,723,200 bytes, SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`,
preferred base `0x00400000`. The existing read-only wrapper used the canonical
`Decompiled Game/ghidra_project/SolomonDark` project through replica `slot-01`.
Wrapper SHA-256 `b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`;
`decompile_targets.py` SHA-256
`899167ca42624e09f26d22233365631a6ee8b3d106e337e20b77574894e97465`.
The decompiler was checked against `dump_function_instructions.py` (950
instructions per target) for `0x005F25B0`, `0x00643920`, and `0x0053F3C0`.
`refs_to_addr_decompile.py` finds **one** caller of `0x00643920`, at
`0x005F276D`; no other spell owns this particular damage-area helper.

- Rebuild `0x00666020`'s existing seven-word ABI remains correct:
  damage min/max, mana, quantity, speed, Chill push, Cone widen.
  Handler `0x0053F3C0` copies vector `[6]` to actor `+0x168` and vector `[5]`
  (with fan/pitch scaling) to `+0x16C`. Constructor `0x005E4FB0` zeros both.
- Contact `0x005F2616..0x005F2625` compares **`+0x168 == 0`**. The equal
  branch constructs `Mod_ColdSlow 0x1B69`, sets duration `+0x14 = 150` and
  factor `+0x1C = .5`, then damages the direct hostile. No Chill prerequisite.
- `0x005F2711..0x005F276D` invokes the helper when **`+0x168 > 0`**, even
  without a hostile direct target. Thus scenery/terrain impacts can splash.
  Direct damage precedes the area query; surviving direct targets participate
  again, dead/pending-remove targets do not.
- Handler `0x005F2728` divides damage by the binary's double `10.0` at
  `0x007DE810`, stores float32, then helper `0x00643AF2` divides by that same
  constant and stores float32. Area damage is `f32(f32(damage/10)/10)`, not
  `/20`. The helper skips the gameplay area pass for nonpositive damage.
- Radius uses **widen** times double `120.0` (`0x0078E470`), then fifteen
  separate float32 multiplies by double `1.024999976158142`
  (`0x0079E1D8`). The query mask is `0x2`, without line-of-sight filtering.
  Every returned root receives `.5` ColdSlow for 1.5 seconds (150 stock ticks).
- Insufficient mana zeros push and widen (`0x0053F6D3` branch), halves damage,
  and retains the zero-widen direct slow; the weak byte is not a slow gate.
- Stock `chill_wind.cfg` drains ranks 0..10: push `[0,10,20,30,40,50,60,70,80,90,100]`.
  Stock `cone_of_ice.cfg` drains ranks 0..11: widen
  `[0,30,50,70,80,90,100,110,120,130,140,150]`. Their existing vector scalars
  are respectively float32 `push*.019999999552965164` and `widen/150`.
  Base Frost Jet and every primary rank retain zero widen without Cone.

### Membership and acceptance

| Member | Native source | Final disposition | Acceptance |
| --- | --- | --- | --- |
| Base and every Chill-only Frost Missile | zero-widen contact branch | exact-ported | direct 150-tick half-speed; no splash at every Chill rank |
| Every Cone rank, with/without Chill | positive-widen helper, all 12 CFG rows | exact-ported | radius, direct plus area damage, neighbor slow, outside exclusion |
| Low-mana Frost Missile | cast-time zeroed upgrades | exact-ported | direct slow survives; no learned splash |
| Scenery/terrain/blocked-birth impact | null/nonhostile contact reaches helper | exact-ported | area without direct hit; no replay on subsequent ticks |
| Dead direct target and zero-damage area | direct-before-query and helper damage gate | exact-ported | no dead-target reslow; positive-damage neighbor contact only |
| ColdSlow merge, movement, material, replication and expiry | existing target-effect owner | verified-already-at-parity | `.5` movement, frost material, 150-tick expiry and retirement |
| Frost impact FadeFrost and area Iceblast/audio | contact and `0x00643920`; Iceblast `0x00785514` | exact-ported | keep ordinary impact; recover area presentation below |
| Target-contact freeze sound, direct/area/weak/refresh | registry 36; `0x005F26F2` / `0x00643C25` | exact-ported | target position, native pitch/RNG, five real Chrome plays |
| Base Water, Blizzard, Hail and other modifier producers | their separate contact owners in entries 121/123 | out-of-system | they do not call `0x00643920`; existing common-status tests remain required |
| Flight Chill push/Arrow force | tick `0x005FD7A0`, `+0x16C` | out-of-system | independent movement path; does not produce ColdSlow |

Use the existing combat and target-effect owners, not a renderer-side slow.
Authoritative contacts must precede replicated presentation. Focused regression
and all final gates/browser checks run only on the isolated Mac candidate.

Area presentation recovery: `0x00643920` creates `Anim_Iceblast` (vtable
`0x00785514`) before the ordinary FadeFrost. Its DeadHawg record is 114
(singleton `0x00819994`, field `+0xC78`, independently mapped in entry 121), initial XY scale `2*widen`, alpha `1.5`, loss float32
`.1`, growth float32 `1.024999976158142`, white tint and zero rotation.
Tick `0x00452ED0` subtracts alpha, retires at `<=0`, and multiplies XY scale;
draw `0x00455B30` clamps alpha to one and uses Y scale `X*.800000011920929`.
The atlas is constructor-specific: the Meteor Iceblast uses a different
BadGuys asset; sharing the animation class does not share its image. It fits
inside the existing 20-tick impact owner with a separately expiring
presentation child. Raw `0x006439F9` registers that child in `Region+0x278`,
the direct pre-world interval established in entry 297. It must use the
existing underlay container, while FadeFrost remains world-sorted; combining
both in the same painter interval would incorrectly cover intervening actors. The helper and ordinary impact each play `icestart` at
pitch 1.5. Other Iceblast constructors (Meteor, Comet, Ring of Ice) supply
their own data; their existing programs remain unchanged.


### Implementation and Mac evidence

The initial mechanics receipt below predates restoration of target-contact
sound RNG draws. Those additional native draws change later random cast damage;
the final audio-inclusive receipt follows this table.

The authoritative projectile contact now selects direct versus area cold from
widen, and passes terrain/blocked-birth payloads from `stepPrimarySpells` to the
same combat resolver. No status is inferred by a client or renderer. The
existing impact lifetime carries the independent, shorter Iceblast visual and
both native impact sound requests. The existing enemy-event shape carries the added native freeze cue; its
expanded sound enum requires a protocol revision. No dependency is added. Base Water and the other Weld families retain their existing owners.

Mac focused acceptance: 200 tests across combat, primary casting, welded
runtime, welded rendering and primary audio pass. Test TypeScript, production
frontend/host builds, bundle budget, and frontend lint pass. The first new
base-contact regression failed against the unchanged implementation because
no ColdSlow was queued; it now passes. Regressions cover Chill ranks 0..10,
Cone ranks 1..11, weak casts, direct survival/death, scenery, terrain,
blocked birth, no impact replay, area float32 damage, Iceblast retirement,
and duplicate-free impact audio updates/hydration. The actual view test also
checks that Iceblast attaches to the pre-world root, FadeFrost remains in the
world root, and both owners detach/destroy when the impact retires.

Real Chrome 153.0.8010.53 on the Mac loaded the production build, traversed
Title → Create → College → Boneyard, and cast using browser mouse input.
Task-owned host fixtures supplied the rank matrix and three live Skeletons;
fixtures are test instrumentation, not clean-stock evidence. The browser and
host used their own random local ports, isolated profile/context, and no
production database or runtime. The host sampled actual emitted vectors,
damage, target effects and expiry. Every row reached exactly 150 slow ticks,
factor `.5`, frost material enabled, and expiry after the last live tick:

| Case | Cold targets | First / last cold tick | Damage result |
| --- | --- | --- | --- |
| Base, no Chill/Cone | direct only | 200 / 349 | direct `1.2842655181884766` |
| Chill rank 1, no Cone | direct only | 420 / 569 | direct `1.272083044052124` |
| Cone rank 1, no Chill | direct and neighbor | 639 / 788 | direct `1.2273075580596924`, plus `f32(f32(damage/10)/10)` on both |
| Weak, both upgrades learned | direct only | 865 / 1014 | weak damage `.804347038269043`; emitted push/widen zero |

The third, outside Skeleton remained undamaged in every case. Impact rendering
was observed, base/Cone screenshots inspected, and ten Frost/ice audio events
captured. Page, console, failed HTTP response and failed request arrays were
empty. The final publication candidate must repeat the complete canonical
Mac gate and this real-browser matrix after the campaign publication lock and
rebase; those exact-head receipts belong to the report outcome. Disposable
captures and probe scripts are removed after publication. No native behavior
was removed to satisfy the tentative report, and no platform approximation is
introduced for this cold-contact system.

The additional motion probe follows the **actually contacted** hostile (native
homing can select either nearby Skeleton), rather than assuming fixture ID 1.
On the same production tree its measured cold/baseline travel ratios were
`.466103`, `.466106`, `.466107`, and `.405069` for base, Chill, Cone, and weak
casts. These include native hit pauses and collision, so are not a replacement
for the exact `.5` status scalar. Every case still lasted ticks `t..t+149`;
the additional host-error array was empty. Post-impact material captures are
also inspected during final browser acceptance.


### Target-contact sound recovery

The final audio sweep distinguishes registry 36 `sounds/freeze.wav` from the
separate player-status `frosted.wav`. The stock freeze file is 15,384 bytes,
SHA-256 `6c224f2acbb7c0193cc0b75ae3eb3dc3f49070542f1de63a90f4aa7ab6db35f8`;
no existing Website WAV matches that hash. Registry singleton offset `+0x648`
selects this sound. Direct contact `0x005F26BD..0x005F26F2` and each area target
`0x00643BF0..0x00643C25` play it after attaching ColdSlow and before damage,
at the target position, with float32 `1 + Float(float32(.2), signed=true)`.
The amplitude is the directly extracted float at `0x00784CE8`. Refreshing an
existing slow still makes this contact request. The authority must consume
these RNG draws in target traversal order; a renderer must not reroll them.

This in-system member is ported through the existing enemy sound event, exact
stock WAV, and captured pitch. It applies to base/Chill-only/weak direct contact
and every positive-damage Cone area target, including terrain-impact neighbors.
The player `frosted` cue remains unchanged. The native cast cue, helper
`icestart`, and ordinary FadeFrost `icestart` retain their separate owners.
The new sound enum is versioned with the existing game protocol contract.
Regression acceptance includes cue count, actor/position ownership, bounded
pitch, and the exact subsequent RNG state; final Chrome acceptance must observe
all five target-contact play requests across the four-case matrix.


The audio-inclusive Mac run passed 302 combat, casting, renderer, audio, and
protocol tests, the test TypeScript project, production build and budget, and
the real Chrome matrix. Five registry-36 play requests were observed, at pitches
`1.0267540`, `.8902840`, `1.0188400`, `.9379840`, and `1.0433220`; each request
used volume one at these near-target distances. All page, console, failed HTTP,
failed-request, and host-error arrays were empty. The four slow cases still
lasted exactly 150 ticks with factor `.5`; all outside targets stayed untouched.
The sound enum uses protocol 130 (published base 129). The final rebased
candidate's canonical gate and repeat browser receipt remain publication gates.

## 2026-10-07 — Report 81: released Boulder painter identity

The report described a shared freeze when a welded spell was released. The clip
shows a rotating purple four-rock assembly and red/orange breakup, matching
build 1006's recovered rendering contract. This identifies the strongest
representative case, not the historical save or exact component ranks, which
were unavailable. The original was re-read unchanged before investigation.

### Evidence and recovered ownership

The existing stock contract above already records EBoulder as a retained actor
plus recursively constructed, separately registered children. Entry 134 pins
its stock handler at `0x00545360` and independent-child release at `0x005FA6D0`
(retail SHA-256 recorded above). This investigation reuses those established
instruction receipts rather than rerunning native extraction. Its recovered
split templates, geometry, light provider and actor lifetime are unchanged.
Entry 297's Region manager model assigns each concrete actor its own root;
`enrollPrimarySpellPainterRegistrations` correctly reuses that actor's light
registration when the one-root actor contract applies.

On unchanged main `2b9f5e17`, two M5 Chrome clients releasing a four-piece build
1006 in a prepared Slumpgut encounter both threw duplicate actor-registration
errors. A second two-client run without any enemy produced the same exception.
The authoritative host advanced normally and browser rAF callbacks continued,
but completed gameplay frames stopped while cloned registrations coexisted.
This is directly observed web behavior; no historical latency or reporter
hardware diagnosis is claimed.

The release helper spread the parent actor into every child. Since the earlier
Region cutover had enrolled a `painterRegistrations` array on that parent, the
new children inherited it while receiving distinct `lightRegistration` roots.
Final enrollment preserved the inherited one-root array after structural checks,
then the renderer correctly rejected duplicate manager membership. Earlier
release regressions checked actors, light roots and trajectories but omitted
painter identity after the full public tick enrollment.

### Narrow system boundary and membership

Boundary: painter identity at retained-primary release, including public tick
enrollment and both client projections. No authored spell values, rates,
collision rules, debris, assets, or network format are being changed.

| Member | Disposition | Contract |
| --- | --- | --- |
| Build 1006 original retained actor, quantities 1–4 | exact-ported | Preserve its actor ID and existing painter/light root on release |
| Build 1006 newly split actors, quantities 2–4 | exact-ported | Each new child enrolls from its own newly assigned light root, never the parent's painter array |
| Repeated release and forced/owner release through the shared helper | exact-ported | Same identity rule; no renderer workaround or new root allocation |
| Build 1008 Hail carrier and separate release fade | verified-already-at-parity | Carrier remains one actor; fade is a fresh literal without inherited painter metadata |
| Build 1007 Meteor channel owner | verified-already-at-parity | Release removes the retained owner and creates no split copy |
| Ordinary Earth, primary one-shots, beams and other actor births | out-of-system | Do not clone this retained multi-child release owner |

Implementation belongs in `releaseNativeWeldPersistentActor`: clear inherited
painter metadata only on genuinely new 1006 children so existing final enrollment
reuses their unique light registrations. Keep the original actor's registrations,
allocation order, RNG, release template and all native lifetimes intact.

Validation: public `stepPrimarySpells` quantities 1–4 and repeated releases;
existing sibling/native renderer suites; repeated two-client Slumpgut release
with no duplicate errors and continuously completed rendering; required final
Mac gate and deployed check. Prepared ranks, health/mana safety values, seed and
no original save remain explicit fixture qualifications.

### Focused and built-browser acceptance

The new public-tick regression failed on unmodified main with two simultaneous
actors sharing one ordinal. It now passes for all quantities 1–4, repeated casts,
original-root retention, child painter/light identity and next-tick stability.
The focused primary/native-weld/debris/renderer/Region group passed all 130 tests.

The built M5 Chrome Slumpgut journey then completed four actual charge/releases
across 1,406 server ticks. Caster and observer completed 853 and 844 rendered
frames respectively; both had a 16.8 ms maximum measured render-progress interval,
no long tasks, and no page, console or HTTP errors. Both rendered views were
inspected after the releases. The source fixture used two isolated browser
contexts, build 1006 ranks `[3,3,3,2,3,3]`, generated seed 42, authored Slumpgut
plus five Zombies, and 10,000 health/mana safety values. It is a controlled
reproduction rather than the unavailable historical save, hardware or network.
The earlier reproduction runs are causal evidence, not passing acceptance;
one initial setup attempt used the wrong case-sensitive New Game label.

No native spell parameter, protocol field, renderer duplicate-root invariant,
spell-effect quality setting or gameplay rate was relaxed. Final repository-gate
and publication receipts are tracked by the report's completion record.

## 2026-10-13 — Report 118: Flame Lash and Steam death-payload recovery

### Boundary, provenance and falsified assumptions

Report 118 calls build 1003 “Flame Leash”; the native/source name is **Flame
Lash**, rebuilt at `0x00666020`. This recovery begins at its authored vector,
continues through each per-damage event and the real terminal receiver, and
includes the shared Fire/Steam area and construction-contact consumers,
presentation RNG, audio and lifecycle. It does not infer a graphical repair
from the nearby Flame/Ember appearance reports.

The source baseline is isolated report-118 HEAD
`762f0c9c777345f733ae7635ffd4d1d66b20cbeb`. Fresh static reads used retail
0.72.5, 4,723,200 bytes, SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`,
preferred image base `0x00400000`. The checked-in
[report-118 evidence catalog](report118-native-death-payload-evidence.json)
contains PE-verified receiver slots, all direct helper CALLs, raw instruction
ranges, exact CFG text/hashes and the evidence provenance. No native executable
or Windows helper was run for this recovery.

The earlier closure was false in four coupled ways: Flame materialized a
death payload on nonlethal contacts; Steam materialized a live-modifier pulse
instead of a terminal payload; shared area handling dropped one native damage
lane and used the wrong query; Flame-owned newborns were appended after the
single fire-contact pass. The latter effects never received their required
age-zero area/construction contacts. Moving the same wrong pulse to a different
visual/audio family did not fix its owner.

The parent's restored original-save baseline on Node 22.17.0 produced 152
explosions, 456 Embers and 163 Fire impacts in 64 advanced 100 Hz ticks, despite
only seven lethal enemy transitions. The first two ticks each birthed four
explosions and twelve Embers with zero kills. Silent audio synchronization
recorded 315 fireball-hit and 152 throw-fire requests; peak resident explosion
count was 109. The later save, ranks `[5,5,0,6,0,3]`, produced no explosions or
Embers across 150 ticks. These are causal web observations, not measured native
audio or post-fix acceptance.

### Producer and branch inventory

| Member | Native owner | Recovered contract / disposition |
| --- | --- | --- |
| Flame authored inputs | rows 16/24/18/25/17/26, Welding 52; build 1003 | Exact authored row lengths and vector semantics retained; no guessed clamp |
| Main admitted Flame contact | `0x005408F0`, type-1 write `0x00540C6D` | Per-damage payload; Explode damage strictly positive is the gate even with radius zero; Embers alone do not arm it |
| Normal chain contact | target query `0x00641340`, write `0x00541710` | Valid first contact, positive arcs, nearest distinct mask-2 root within 200; direct damage multiplies by `0.6000000238418579`; visited membership preserved |
| Underpowered Flame | `0x005409ED..0x00540A05`, `0x00540CDE`, `0x005412BD..C2` | Direct damage and handler strength halve; main Stun and the entire chain loop are skipped; main type-1 payload remains eligible |
| Flame cached Ember count | conversion `0x0054A424`, store `0x0054A42D` | `trunc(vector[7])` is cached before use; chain uses `trunc(cachedInteger * .5)`, not truncation of an unrounded half vector |
| Normal Steam contact | `0x0045B940`, modifier `0x006232F0/0x00625F40` | Normal full-power particles install the ten-tick modifier; Over and weak particles have no modifier contact lane |
| Steamed type-2 event | `0x00625FDA` | Radius-positive per-damage payload; live surviving ticks never detonate |
| Steamed maximum merge | `0x00625C80` | Retain duration/damage/radius/count/fragment maxima and source ownership; zero-own-payload children can refresh a stronger resident modifier |
| Common terminal consumer | `0x0048A290 -> 0x00477020` | Actual terminal dispatch, family gate and target alignment are required; entry 162 has all 21 native vtable members and exceptions |
| No target / rejected target | main endpoint/factory branches | No damage event when producer admission fails; presentation follows endpoint availability and factory arguments, not the HP result |
| Authored-table siblings | ordinary Fire, Burning Bolt, Meteor adapter, Immolate, Ring | Shared changes require explicit compatibility; separate Ring defect remains open as recorded in entry 162 |
| World/lifecycle siblings | Hub/private rooms, Boneyard, owner and observers | One authoritative producer; stable replicated births; pause/release/death/disconnect/world removal and cue dedup remain required |

### Exact event, RNG and terminal contract

The main event resets damage context, writes flags `0x2A`, direct magic damage
and source, calls `0x00624300`, then samples `Float(.5)+.25` hit strength
(main `0x00540C4D`, chain `0x005416F0`). When Explode damage is positive it
writes type 1 and samples `Integer(1,000,000)` **before submitting damage**
(main `0x00540CCB`, chain `0x00541775`). Surviving, shielded and family-death
rejections still consume that draw when the producer gates admitted the hit.

The seed is stored as float `DAT_0081C720`; the terminal consumer converts
that stored value to integer at `0x004770C4..D4`. It neither draws a fresh
seed nor uses the victim's private seed. Main payload fields are cached
Explode damage `+0x2A8`, radius `+0x2AC`, Ember damage `+0x2B0` and cached
integer count `+0x2B4`. Scale is
`f32((radius - 10) * 0.18000000715255737 + 1)`. The cached-count recovery is
proved for build 1003 only; this entry does not generalize its constructor
conversion to builds 1000/1007.

Steamed first rejects its entire tick if target `+0x5C != 0` and source
`+0x30 != 0`. Otherwise it resets at `0x00625F5E`, samples `Float(.5)`
at `0x00625FBD`, adds `.25`, conditionally writes type 2 when radius is
positive, samples the private seed at `0x00626036`, then submits damage at
`0x00626052`. This is the same pre-damage seed discipline, not a kill-only
draw. The consumer separately requires victim `+0x5C == 0`.

Type 1 selects `0x00642BF0`; type 2 selects `0x00643CA0`. Both use the
victim's **root XY** at `+0x18/+0x1C`, not a head/impact socket. Context reset
`0x006246F0` writes type zero/source minus one at `0x0062478E`. Type zero
is inert; the separate type-3 disintegration writer at `0x0048A44F` is not a
Fire/Steam producer. There is no persistent “armed” status or extra rehit
cooldown.

### Main, chain, source-flare and no-target presentation phases

1. Main admission and damage/payload RNG occur first. Damage submission and
   any synchronous death burst complete before the next phase.
2. Main endpoint fade occurs only when endpoint X is greater than native
   sentinel `-9999` (`0x00540E91..0x0054108C`). The condition is endpoint
   availability, not a successful HP hit: terrain/fallback endpoints qualify.
3. Main calls factory `0x00531F00` at `0x005412B5` outside that condition.
   Factory arguments are source XY `+8/+C`, midpoint XY `+10/+14`, end XY
   `+18/+1C`, drawing offset XY `+20/+24`, weak byte `+28`, width `+2C`
   and source-flare flag `+30`. Main passes flag 1 at `0x005411D3`, width
   1 and its weak byte. Thus a missing endpoint does not suppress the source
   flare or its RNG.
4. Every found chain target first samples width
   `0.800000011920929 - Float(0.30000001192092896)` at `0x005413B7`.
   Its factory call `0x005414AA` also passes source-flare flag 1 and weak 0.
   Factory source flare, ribbon and path-light births precede the independent
   chain fade `0x005414B1..0x005416A3`, then chain damage/RNG/submission.
   A rejected HP hit does not retroactively suppress these presentations.
5. There is no extra “chain fade” at hop zero.

Factory `0x00531F00` gates the source flare only on argument `+0x30` at
`0x00531F77`; endpoint availability, weak state and hit result do not gate it.
Its RNG sequence is `Float(15)` at `0x0053206A`, a random unit direction
at `0x0053207F` (nested `Integer(max+1)` at `0x00410C74`), then
`Float(.5)+.75` at `0x005320DB`. It registers at `0x0053210E` before
ribbon construction. Ribbon registration is `0x00532456`; path-light
`Float(.75)+.25` is `0x0053246D`, followed by per-point draws
`0x0053269E/0x00532804`. Weak ribbon width is multiplied by `.75` and its
alpha by `.5`; this does not weaken or suppress the source flare. Preserve
the already recovered split-painter geometry in entry 297 and the later
quality/path-light ownership in entry 130.

The exact output of the existing clipping function `0x00410FF0` for a
missing endpoint was not recovered here. It does not affect the proved
source-flare gate/order. No new clipping or glyph geometry is justified.

### Shared children, presentation consumers and acceptance boundary

The type-1 burst owns Fire cue 30 then 97, records 15/401..419/420..433, the
lit rising array, Ember body 267..270/contact 251..254/glow 15 and the existing
Enhanced ground quad. Type 2 owns the gray arrays, registry-27
`explodesteam`, and three normal Steam children per configured count.
Their own payload is zeroed at `0x006443E2..EF`; base contact damage is
fragmentDamage divided by manager timestep at `0x006443DC`; registration is
`0x0064440A`. They do not receive the Ember ten-construction-tick loop.

Flame start cue 33 and held loop 157 remain source-owned. The dedicated
ribbon uses BadGuys record 25 UVs, while its draw binds the shared atlas page
through record 44's page pointer. The copied claim that Flame emits a
375/376 Enhanced branch is retracted. Fade 35, path lights, split-painter
lifetimes and release/cancel/death/scene/observer teardown remain in the
inventory with the report-116 geometry/fade/RNG boundaries below. The
reported clip does not establish captured audio loudness.

Independent native review approved a bounded shared-owner repair, not a
blanket damage multiplier, a second global fire pass or a `killed`-only
callback. The planned implementation must expose actual terminal-payload
admission, preserve Cocoon's nonterminal exception, carry Steam's typed payload
with its own damage event and synchronously finish a death burst before the
next chain query. Entry 162 owns the exact two-lane/query/contact contracts.

Required red-to-green coverage includes nonlethal contact with positive
Explode, eligible lethal contact, Embers-only, radius-zero positive Explode,
normal/weak and fractional cached counts, shield/armor/alignment/dead/Cocoon
rejections, pre-damage seed counts, main/chain/no-target presentation ordering,
surviving ten-tick Steam, strong/zero-payload merges, both area boundary
predicates, synchronous collateral removal before chain selection, consumed
Ember suppression, direct shared-consumer compatibility, replication/audio
dedup and lifecycle. Candidate review and Mac/browser/audio acceptance remain
pending. This recovery does not claim implementation closure or rerun accepted
full-release gates.

### Explicit residual boundaries after scoped recovery

- The native ribbon/path-light RNG sites and their position after source-flare and ribbon registration are recovered, but this task has not matched their geometry-dependent loop cardinality to the web presentation owner. That pre-existing presentation-RNG mismatch remains open. Preserve proved source/endpoint/chain ordering without claiming complete native global-RNG closure or inventing compensating draws.
- Imp receiver `0x0048B1C0` rejects native byte `+0x234`. Its semantic identity, constructor transitions and any correspondence to supported `BoneyardImpBrain` state are not established here. The current host store contains live hostile mask-2 actors and active Maggots, rather than arbitrary native alignment states. Record this native branch as unmapped; do not invent an Imp state or claim all native wrapper states are implemented.


### 2026-10-13 tracked presentation correction before report-118 publication

The report-118 appendix and evidence JSON copied an incorrect historical
art-membership claim. Fresh independent instruction review supersedes it:

- Main and chain use factory `0x00531F00`, constructor `0x0045B810` and draw
  `0x004583E0`. Constructor call `0x0045B915` enters the dedicated
  `0x0052E020` Flame ribbon builder.
- The builder copies **BadGuys record 25 UVs** from singleton `0x00819978`
  plus `0x13A8` (record-25 descriptor plus `0x4C`) at
  `0x0052E2CD..0x0052E2E1` and `0x0052E947..0x0052E966`.
- Draw `0x004583E0` binds the shared atlas page through record 44's page
  pointer at singleton plus `0x21F0`. A texture-page binding does not select
  record 44's glyph. No record-375/376 fork is emitted by this
  constructor/builder/draw chain. Unrelated BadGuys 375..376 receiver art
  at `0x004963C0` is outside this retraction.
- Native chain fade initially multiplies fields `+0x2C/+0x30` by `.1` at
  `0x00541522..0x00541537`, then unconditionally overwrites both with
  `.5 + Float(.5)` at `0x005415F5..0x00541612`. Its final base-scale range
  is `[.5,1]`, not `[.05,.1]`. The inherited web fade helper still applies
  the `.1` factor and is unchanged by report 118.

The evidence is the same retail executable SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`
and retained raw disassembly SHA-256
`7b480045967ab622ed8885395176107ccbaf1c30802d5e37c750fdcc2c398158`.
Raw anchors are constructor line 128764, full builder lines 381811..383240,
record-25 UV references 381983..381984 and 382440..382441, and draw/page
binding lines 124514..124521. The original scratch report's Flame44 and
Enhanced375/376 assertion is explicitly superseded, not legitimized by its
retained provenance hash.

Geometry, final fade scale/lifetimes, global RNG and replication remain open
under report 116. Known gaps include the consumed-but-discarded chain-width
value, a missing short-range native RNG draw, and geometry-dependent path-light
RNG cardinality. The report-118 phase-order and death-dispatch recovery does
not establish complete Flame rendering or global-RNG parity. Terminal
callback owner `0x00477020` and the death-only payload contract remain valid.
This documentation-only correction does not change production or test bytes,
and no report-116 runtime repair is included in the urgent payload patch.


## 2026-10-14 — Report 116: retained Flame implementation contract

Status: `ported-local-browser-passed-pending-integration-and-qualified-gate`. The recovered membership
is implemented in the isolated report-116 branch, based on qualified
`553793d074038d60110f283c63ee164790c4ba32`. This is not a native-runtime or
publication receipt. Report-118 and report-119 worktrees remain separately owned.

The recovered contract v2 (SHA-256
`0b0787877075a09d0a45be795ebb1168b6d6b8bedea08758ef8debcf1d4b0c7a`)
and recovered addendum v2 (SHA-256
`aeedca858425e067d8afc1dfe9fed58ca203e0b0015404a65f82e9cafa3e4fcf`)
are the retained evidence. The addendum supersedes the old incoming-Region-light,
first-update, and unverified-spline statements. No static recovery is reopened.

Membership: normal main, weak main, successful normal chain hops; each factory
owns one retained record-25-UV ribbon and independent record-35 source fade,
plus admitted path-light records. Main endpoint fade is independent of accepted
HP damage when its pre-clipped sentinel passes; chain fade follows each
successful hop. No weak chains, record-44 glyph, record-375/376 forks, or extra
hop-zero fade. Enhanced changes birth spacing/loss/shadow and live split bands,
not artwork membership. Hub/private/Tutorial/Boneyard and owner/peer/observer
need the same complete retained birth contract, within existing scene adapters.

The native owner chain is handler 0x5408F0 -> factory 0x531F00 -> constructor
0x45B810 -> retained builder 0x52E020 -> draw 0x4583E0. Factory inputs are
S/M/E/O/W; extension is Eprime=E+15*normalize(E-M); body uses Eprime+O while
path lights and padded split bounds use Eprime. Short is final stored span<75,
including collapsed controls, with one shared width sample and exactly six
vertices/twelve indices. Long uses the recovered three-point open unweighted
QuickSpline, named f32 stores and zero normals, first-leg approximate-length
sampling, native phase-derived signed private mixer, transparent end caps,
first tangent-back 25, and BL/BR on every interior. It must have a dedicated
Flame implementation; unrelated Air and Blizzard retain their current owners.

The ribbon actor-manager lane precedes the fade transient-manager lane. Both
new children update on their birth tick. Ribbon life is two native updates.
Fade alpha subtraction and lit-wrapper -.05 intensity updates use repeated
f32 operations; retain positive final alpha even when packed alpha is zero.
All Flame fades draw white/current-alpha record 35 directly, without incoming
Region modulation, while retaining the ordinary graphics-state multiplier.
Source has no provider; lit endpoint/chain radius uses retained birth strength
and wrapper scalar, not current alpha or intensity.

Authoritative birth RNG programs remain source 5 / endpoint 7 / chain 6 words,
plus chain width, short width, always-sampled path intensity and one radius
word per admitted path point. Preserve synchronous damage/death ordering and
report 118's terminal-only Fire payload ownership. Main channel ID is reserved
once before contact; presentation samples do not allocate replacement IDs or
reroll gameplay RNG in views, snapshots, saves or observers. Render jitter uses
the existing stable semantic-word policy and native signed reduction.

Representation choice: a required nested discriminated Flame visual payload
retains only factory inputs and required birth samples. Legacy-suppressed
records keep their existing top-level channel fields, IDs, order, age 0 -> 1 ->
retirement and painter ownership. ML lifetime remains the existing 60-second
fallback/normalized 1; do not add top-level lifetime fields or rewrite ML
geometry. Complete new visuals apply the birth update separately from this
observation lifecycle. New and historical fade scale/registration domains are
separate strict branches. Protocol/save version integers are allocated only
after fresh integration checks. No protocol fallback invents absent samples.

Transport qualification: held Flame emits each admitted primary tick, but the
host defaults to 20 snapshots/second for a 100-tick world. A tick 1 channel is
removed by tick 3 and absent from ordinary snapshots at 0 and 5. Existing retained
primary presentation is Hail-only; ephemeral Flame emissions have no client
event lane. A bounded render-only birth recipe history is therefore required
for complete short-lived Flame membership, including fades/path lights. Its
recovery/backpressure integration now uses the existing acknowledged snapshot
baseline, keyframe recovery, retained-baseline pruning and payload limits.
World replacement/load/reconnect resets the connection epoch. Relevant
same-stopped-tick membership changes and reused-state rollback allocate a fresh
epoch, preserving complete current survivors while clearing obsolete recipes.
Fresh local timelines bootstrap at the supplied snapshot boundary, including
ordinary Hub Region re-registration. Early retirement receipts survive through
the bounded native maximum horizon to prevent stale duplicate resurrection;
they never extend the visible interval. Overflow forces existing snapshot
recovery. History is outside gameplay state, ML and saves; authoritative light
sampling remains on the original host clock.

The native pure geometry, source/endpoint/chain birth programs, first-update
fade clocks, retained light recipes, transient painter lane, split-band view,
strict object/compact/delta payloads and save migration are implemented.
Versions 153/51 are provisional reservations, to be reconciled against fresh
integration main before publication. Version <=50 saves receive the explicit
legacy-suppressed discriminator without inventing missing samples or changing
top-level fields, RNG, IDs, old update lifetime or ML observations. Current
saves retain complete live actors only, never connection recipe queues.

The normal-only camera prefix is now recovered and implemented: 0x540A2C
calls Float(4), then 0x540A49 calls unsigned UnitVector (0x410C50), before
staff/target preparation and receiver dispatch. Weak takes 0x540A05->0x540A76
and skips both words. The retained displacement has fixed gain1; there is no
position attenuation. Region sink 0x448590 uses stored-f32 squared lengths and
strict-greater replacement, with earlier writers winning ties. Region update
0x63F1D6 decays the combined displacement by .75 and clears only squared
length <.25. Flame's birth already owns that first decay. Existing staff,
secondary and enemy event-tick mappings remain unchanged; their phase has not
been globally reinterpreted. The common stored-f32 comparison/strict cutoff is
an intentional correction protected by mixed-family/tie regressions.

The independent camera-owner review found three integration defects: a
retained renderer could reject births after a backward world replacement;
the deferred Flame cutoff could erase an existing family's same-tick
post-update proposal; and independently aging a late Flame vector could
reverse a native f32 tie. The corrected owner retains a bounded seven-live-
tick phase journal plus a checkpoint. It replays strict shared arbitration
before the single native decay/cutoff, then applies existing families at
their established post-update intake phase. Same-phase proposals compress
to their strict-f32 winner, with Flame actor IDs preserving birth order.
Both actual renderers synchronize accepted epoch/world clock metadata before
feedback intake. A backward replacement clears retained feedback; a same-
tick transport reset preserves consumption and surviving impulses. The
client-only accepted-epoch scalar survives presentation-copy queue removal
and never widens the wire or save schema.

Camera age uses the continuing Region clock, distinct from stopped visual
age during GameOver. Ledger 052, `2026-08-14-boneyard-footsteps-and-tree-
visibility-lighting-parity`, lines552-563, establishes that GameOver appends
an overlay while the enabled Arena continues Region updates; ordinary pause
sets Region+0x68=-1 and suppresses its Tick. The retained Region tail
0x63F1D6 is unconditional after the actor/transient managers. Camera metadata
therefore expires against the live snapshot tick even while ribbon/fade
recipes remain on stopped world time. Ordinary pause retains the same tick.
Regression coverage protects this distinction without globally shifting
staff, secondary or enemy event phases.

Source: retained stock-03a8345-objdump.txt SHA256
7b480045967ab622ed8885395176107ccbaf1c30802d5e37c750fdcc2c398158,
lines403363-403405,23885-23931,103636-103673,700243-700304. Camera recipes
share the existing bounded birth history through their seven-tick maximum,
without lengthening ribbon/path visibility. Consumption keys exclude the
transport epoch: duplicate delivery and same-tick reset cannot reapply a
surviving impulse. Load/reconnect derives only current complete actors at
actual age; saves do not retain a connection queue. Fresh casts intentionally
correct the native birth-word trajectory, including the two camera words;
they do not claim byte identity with the formerly incomplete stream or
native-runtime/x87 numerical equality. Legacy load/update, decoding, migration
and rendering remain RNG-free at this boundary. Report-118's synchronous
terminal-death transaction and payload order remain protected.

Focused numerical/word-trace, negative-membership, first-update/provider,
strict codec/save, legacy-ML, real admitted Boneyard cast/targetless factory,
report-118 terminal payload, sparse 100-Hz/every-fifth-tick transport, pause,
load, rollback, Hub transition and duplicate-retirement regressions pass.
The independent lifecycle and corrected camera-owner closure checks pass.
The corrected candidate passes 637 scoped regressions plus four actual
admitted Flame input tests. Production build, host bundle/budget, focused
TypeScript and architecture boundaries pass. The focused TypeScript set
excludes `primary-spells.test.ts`, whose 85 diagnostics were independently
matched to the same pre-existing excluded-test errors on the qualified base.
Scoped lint has no errors and retains the pre-existing save-path control-regex
warning. Existing Hub combat admission stays sealed; no test-only gameplay
path was opened.

The current compatibility source check confirms bundled desktop client/host
pairing, exact-revision peer rejection, external Website/Dark Cloud entry,
exact protocol-version rejection, save-before-ready deployment coordination,
loop-free revision reload and old-save recovery. Focused compatibility tests
pass; this source check does not qualify a new package or live deployment.
Muted three-view Mac-browser attempt 12 passed on 2026-10-14 at 04:21 UTC,
against runtime aggregate `8bda50817038a54b560c1872794aeb48969a623d002192fd71f27aebe8c4bd66`
and the matching production build. Normal long/short chains, targetless,
weak targetless/short contact, and coarse targetless phases used actual browser
held input, unchanged host frames, and real owner/peer/true-observer renderers.
All three shared 2,490 identical retained births; 840 history-only births proved
coverage beyond endpoint live arrays. Real painter roots contained ribbons
and fades in every view; Hub combat remained sealed. All captured runtime
error arrays were empty. Owned browser, host, preview and runner teardown was
verified. Earlier failed attempts remain failed.

The harness's independent phase anchors were proven through complete held/
release sequences across all 12 stock Boneyards (84 phase checks). It submits
integer CSS coordinates and preflights the actual unmodified input against
the admitted authority. Earlier diagnostic-frame world aim is only diagnostic:
production samples a fresh camera/presentation snapshot for each input.
Terminal payload order is separately proved through actual-input simulation,
not claimed as a terminal browser phase. Account/directory/provisioning are
local fixtures; this is not live-TLS, audible-audio, performance, native-runtime,
x87 or pixel-equivalence qualification.

Independent acceptance review, report-119 reconciliation, and the final exact-
candidate M5 gate remain pending. Native-runtime comparison is unrun. No full
M2 gate or publication is authorized by this ledger entry.

## 2026-10-14 — Report 115: bounded projectile-target row reuse

### Evidence and preservation contract before implementation

A source-only profile of the report's unchanged save on released commit
`6a1827785167d83f6c7f7defcac17fd9a61b06dc` replayed the same retained
3,001-tick input sequence three times. All final serialized states were
identical. V8 sampling attributed 16.03% of sampled time inclusively to
`resolveProjectileContacts`, including 9.95% to `primaryTargetRows`.
These are unpaced source CPU observations, including profiler overhead, not
a reproduction of the reporter's browser lag or a browser frame-rate claim.
The private original save and profiling artifacts remain outside the repository.

The resolver rebuilt an identical enemy/Maggot target-row projection for each
flying projectile even when no preceding contact changed the enemy store.
The repair is scoped to reusing that derived projection within one resolver
invocation, keyed by the complete immutable enemy-store object identity.
Any new store, including a nonlethal hit, lethal hit, Maggot hit, or Frost sound
event update, requires a new projection before the next projectile. The cache
is discarded at the end of the resolver; it never crosses ticks or worlds.

The existing native contracts remain unchanged: ascending spell ID processing;
same-cell point lookup; strict radius and native cell-binding order; hostile
and scenery masks; direct Frost damage before its fresh area query; dead-target
exclusion; Boulder health/pool accounting; and piercing's existing per-contact
target snapshot. No projectile, enemy, effect, sound, quality setting, RNG draw,
saved field or snapshot is removed or downsampled.

Affected membership is every branch of this shared projection consumer:
Earth Boulder, Fireball, Ether Magic Missile, Fire Missile (1000), Frost Missile
(1001), Ball Lightning (1002), and Crawling Shock (1009). Persistent/channel
spells and Frost's independent radial projection are outside this local cache.
Each affected member requires unchanged-store reuse coverage; lethal transitions,
nonlethal-to-Boulder health accounting, Maggot transitions, scenery order, and
invocation-local lifetime require focused regressions. Existing Frost rank,
low-mana, radial and other projectile contract tests remain required.

Qualification is pending. Focused source replay and unit checks do not replace
the exact candidate's canonical Mac gate and affected real-browser acceptance.
No report-resolution or publication claim is made by this entry.

## 2026-10-19 — Report 115: share movement targets within a primary cast pass

The original report and supplied save were reread unchanged. A short replay of
the first 1,000 retained held-Frost inputs on `ed85cf1f` spent 139.68 ms of
2,373.46 ms in the primary cast's `spellTargets` callback, inclusively. This is
an offline V8 profile, not a browser frame-rate measurement.

The earlier contact-row cache does not cover this callback. Every moving
projectile still reconstructs the same scenery, goodies, enemies and Maggots
from `result.world`. That immutable world cannot change while `stepPrimarySpells`
runs; contacts are resolved afterward. Reuse one lazily created target list
for the invocation, then discard it. This covers all primary movement, cast
construction and channel target queries; Hub queries remain empty. Target
ordering, positions, active flags, RNG, damage, effects and save state must
remain unchanged. Fresh invocations must observe the new world.

This is a bounded allocation reduction, not a claim that all reported lag is
resolved. The original save and profiling outputs remain private on the M2.

The same 1,000-tick saved-input replay ends with an identical full serialized
state before and after the change. Sampled inclusive callback time falls from
139.68 to 9.58 ms; this small single-run comparison is not a general speedup
claim. All 66 matching existing primary/Frost/projectile/target/weld checks
pass, and the changed source passes scoped lint. No new test harness or full
gate was added or run for this focused change.

One actual-save Mac Chrome journey used the unchanged `ed85cf1f` production
client with the changed source host. Save import, Last Game, held Frost fire
(548 ticks, 97 impact births) and acknowledged pause worked. The paused frame
was visually inspected. Client console, page, HTTP and request-error arrays
are empty; the strict driver's only warning is the owned host's normal
server-shutdown disconnect, and all owned resources closed. Roughly 100 ms
headless frame intervals with most sampled CPU time idle remain an observation,
not a demonstrated client bottleneck or report-resolution claim.
