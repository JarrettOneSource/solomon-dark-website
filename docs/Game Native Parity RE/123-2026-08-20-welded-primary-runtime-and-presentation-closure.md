# 2026-08-20 — Welded-primary runtime and presentation closure

> **2026-08-29 split-painter closure:** the Region layering cutover in
> [entry 297](<297-2026-08-29-complete-region-world-painter-layering-audit.md>)
> supersedes only the Flame Lash and Blizzard Beam parent-layer closure. Both
> factories install `ZAnimSplit` and require clipped 25/50-unit
> `AnimPointer` queue slices instead of the former single origin-root mesh.
> Their recovered gameplay, geometry, art, timing, contact, and audio contracts
> remain valid.

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

- Frost direct contact attaches 150-tick `.5` ColdSlow, applies direct damage,
  then helper `0x00643920` revisits every still-live root in its float32 radius:
  `push*120`, followed by fifteen multiplies by `1.024999976158142`. Each area
  hit receives damage `/20` and ColdSlow. Direct target participation is not
  deduplicated from damage.
- Ball/Ground ElectricBurn is a target-owned modifier. Each tick includes the
  source plus the configured nearest distinct roots inside 200, preserves
  registration order on distance ties, damages, and installs 25-tick Stun.
  Merge ownership follows the strongest damage payload; ticks and damage keep
  maxima.
- FireMissile directly uses the Fire body/impact records; Frost, Ball, and
  Ground own their concrete compositor/child programs. Flame Lash record-44
  mesh, Blizzard's `0x005308D0` beam, Steam record-76 normal/over actors,
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

- Flame Lash constructor `0x0045B810` uses the shared exact `0x0052E020`
  three-point QuickSpline ribbon builder, not the former generic six-vertex
  strip. Its record-44 body inherits the native sample spacing, wave envelope,
  private xorshift displacement, alternating UV rows, and optional independent
  record-375/376 branch. Normal width/alpha are `1/1`; weak uses `.75/.5`;
  phase is `-3*birthTick`. Main and chained contacts also own independently
  registered additive BadGuys-35 `Anim_FadeFlameLash` actors. Their constructor
  spends two overwritten `Float(360)` words; endpoint and chain programs then
  consume their exact color/offset/scale/wrapper lanes, retain `.2` alpha loss,
  and sample Region light without submitting a source.
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

Focused tests now pin the shared Flame ribbon, its 375/376 branch membership,
all Flame fade RNG/lifetimes, Blizzard's two quads and negative 6/31 census,
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
| 36 Harden | Selected pure-Water held armor accrual, cap, persistent flat incoming-damage consumer. | No stock independent sprite/light/audio; armor state is player-owned and survives release. | player skill runtime/contact — closed |
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
| Explosion radius positive | type-2 event plus `0x00643CA0` | `exact-ported` | one Steam detonation birth per live modifier tick; no guessed cooldown |
| orange record-15 core | `0x00643D8B..0x00643E3D`, BadGuys 15 | `verified-already-at-parity` through shared clock | ages 0..9, scale `visualScale*6`, alpha loss `.1` |
| gray first array | BadGuys 401..419, `Anim_SpriteArray_ColorOverlay` | `exact-ported` | tint `(.8,.8,.8,1)`, additive, `.75*.98^n`, ages 0..34 |
| gray rising lit array | BadGuys 420..433 plus `ZAnimLit` | `exact-ported` | tint `(.8,.8,.8,1)`, `.625*.97^n`, rise, ages 0..36, same provider light |
| Steam detonation audio | registry 27 at `MyApp + 0x4BC` | `exact-ported` | `explode-steam` only, signed `.1` pitch, doubled point gain, once per birth |
| learned fragment fan | `0x0064418D..0x00644438` | `exact-ported` | private `Float(360)` start; three normal Steam children per configured count; complete ten-word program per child |
| learned fragment motion | same range | `exact-ported` | signed `Float(25)` heading, `Float(10)` birth offset, speed `4*.9*1.5*(.9+Float(.1))`, Y times `.8`, stretch times `.6` |
| learned fragment contact | `0x006443B7..0x006443F2` | `exact-ported` | damage `fragmentDamage/100`, zero Explosion/fragment payload, non-recursive ten-tick `Steamed` install |
| ordinary shared Fire helper | `0x00642BF0` callers | `out-of-system` for build 1005; still exact for 1000/1003/1007 and Fire-family callers | negative 1005 caller test and unchanged ordinary fixtures |
| Hub/private rooms and Boneyard | Region helper and shared primary world view | `exact-ported` | same authoritative state, point gain, painter/light, and audio semantics in every world key |
| host, observers, late join | primary transient and secondary target-effect snapshots | `exact-ported` | strict protocol round-trip and no observer-side RNG/rerouting |
| expiry, target death, owner disconnect, world reset | modifier/transient owner removal and existing teardown | `exact-ported` | no retained modifier, child, view, light, or audio replay after owner/world removal |

No member is blocked by the browser platform.

### Native ownership thread and recovered behavioral contract

- Only a normal, full-power Steam particle owns the contact clock. Its first
  clock is `Integer(10)` and each due edge resets to ten while life remains
  above `.5`. Over and weak particles cannot install the modifier.
- `Mod_Steamed` begins with duration ten. Its tick sends direct Fire damage,
  then, only when stored Explosion radius is positive, writes event type 2 with
  visual scale `float32((radius-10)*.180000007+1)`, Explosion damage, fragment
  count/damage, source slot, and a private `Integer(1,000,000)` seed.
- Re-contact merges into the resident modifier. This is the stock recurrence
  control; there is no additional cooldown. A continuously contacted target may
  remain steamed, but it must run the Steam detonation family rather than birth
  ordinary Fire explosions.
- The type-2 receiver creates the same record-15 core and 401..433 clocks used
  by Fire, but both sprite arrays use `Anim_SpriteArray_ColorOverlay` with
  gray RGB `.8`. Explosion area damage is half the stored damage inside radius
  `visualScale*55`; the lit array owns the existing transient light.
- Each birth requests one positional `explodesteam` one-shot. The ordinary Fire
  pair (`fireballhit`, then `throwfire`) is unreachable from this branch.
- When the stored learned-fragment count is positive, the helper creates three
  normal `Anim_SteamJetEffect` children per count. Constructor and private fan
  RNG remain authoritative. Their payload fields are zero, so their later
  contacts may deal the stored fragment damage through `Mod_Steamed` but cannot
  recursively create another Explosion or fragment fan.
- Target/modifier state is host-owned. Explosion and child actors are stable
  replicated identities; clients render and play each birth edge once, then
  retire it on the fixed clocks. Owner/world teardown removes the whole family.

### Confidence and open questions

- Confirmed: owner, producer/consumer census, event discriminator, duration,
  merge fields, gate, area formula, full VFX records/classes/clocks, audio asset
  and call arguments, complete child RNG/motion/contact program, authority, and
  teardown consequence.
- No mechanism remains inferred. A clean-stock matched-loadout capture remains
  useful as a final visual/audio comparison receipt, but it cannot change the
  instruction-derived state model.

### Web implementation consequence and validation contract

- Keep `Mod_Steamed` and its per-tick pulse in the authoritative secondary
  kernel. Replace only the false pulse consumer with a cohesive Steam
  detonation factory in `native-weld-steam.ts`.
- Add a replicated Fire-explosion presentation variant so the shared clock,
  area mechanics, registration, and light remain one deep module while Steam
  owns gray array tint and `explode-steam` audio. Remove build 1005 from the
  ordinary Fire cue pair.
- Replace ordinary Fire Ember births on Steam pulses with the exact
  three-per-count normal Steam child program. Gate the whole detonation/fragment
  family on positive Explosion radius and preserve zero-payload non-recursion.
- Focused tests must cover normal/Over/weak contacts, all ten modifier ticks,
  merge/re-contact, radius-zero negative behavior, ten consecutive Explosion
  births without Fire cues, gray plans at all three lifetime boundaries,
  one/count/multiple fragment fans and RNG, fragment contact non-recursion,
  area damage, protocol/copy/interpolation, both scenes, and teardown.
- Mac Chrome acceptance must reproduce the reported held Steam+Explosion
  contact, record per-cue/per-kind birth counts, prove no `fireball-hit` or
  `throw-fire` request from this branch, show the gray stock family rather than
  an ordinary Fire wall, and return empty page/console/failed-response arrays.
