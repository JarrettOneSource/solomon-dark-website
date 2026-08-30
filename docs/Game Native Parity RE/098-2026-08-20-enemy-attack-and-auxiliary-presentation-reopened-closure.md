# 2026-08-20 enemy attack and auxiliary-presentation reopened closure

The missing Skeleton attack pose on the published Website was not an isolated
sprite problem. It exposed an incomplete mirror of the native enemy
presentation owner: the server sampled the locomotion lane at actor `+0x144`
but the renderer selects attack bodies and equipment from the independent
action lane at `+0x150`. That selector is now fixed. This pass reopens the
whole owner and audits every sibling renderer branch, attached effect,
projectile, damage redraw, death program, and enemy-owned loop before the
system can be closed again.

The evidence source is retail `SolomonDark.exe`, SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`,
with atlas manifests and untouched PCM from the same installation. Addresses
below are image-base virtual addresses. Renderer-local random decoration is
allowed one documented deterministic multiplayer substitute where the stock
process-global RNG position is not replicated; gameplay state, timing, record
identity, placement geometry, ordering, and audio ownership remain exact.

## Causal trace and complete membership

`BoneyardSimulation` owns enemy action state and child projectile creation.
The replication descriptor fixes immutable recipe selectors, while the sample
carries mutable animation, effects, projectile, hit, death, and lighting
state. `NativeEnemyViews` consumes that authoritative sample, resolves atlas
records plus their authored points, and preserves the native internal painter
order. `BoneyardScene` separately consumes the same world snapshot for
one-frame enemy ambient-loop requests. A hit flash redraws the native
body/equipment membership in red; it does not recolor independently blended
ambient particles. A projectile retains its own lifetime and presenter after
the attack animation requested it.

| Native class / child | Website membership | Required disposition | Baseline finding |
| --- | --- | --- | --- |
| Skeleton | survival family; claw, sword, mace, flail, axe, pike | exact-ported | action selector fixed; mace head, flail chain/head, and pike shaft/head still absent |
| SkeletonArcher | survival family; normal/fire/poison shot | exact-ported | action body and projectile children present; held fire/poison arrow at the authored bow point absent |
| SkeletonMage | survival family; fire/lightning/frost/poison recipe and cloak recipe | exact-ported | action bodies and projectile children present; element charge attachments and custom-recipe cloak branch absent |
| Imp | survival family; contact attack and owned `Anim_FireBurst` | exact-ported | body `285..332` and upper effect `333..342` were correct; residual sweep found the marker-owned shared `251..254` burst missing |
| Zombie | survival family; normal/rotten, beat, fly swarm, gas cloud | exact-ported | articulated attack body present; records `26` and `65` plus Flyblown loop absent |
| Wraith | survival family; drain, burning soul wisps | exact-ported | action/contact state and opaque body present; record `21` wisps and Soul loop absent |
| Lesser Demon | survival family; bomb, five persistent flames, death fire handoff | exact-ported | articulated attack body and bomb child were present; five split-order flames and the delayed death fire/burst choreography were absent |
| Coffin | survival family; materialize/open/spawn Maggots | exact-ported | four-state body and Maggot children present; count-weighted Maggots loop absent |
| Maggot | Coffin-owned child; airborne/crawl/bite/hit/death | verified-already-at-parity | authoritative state, all 50 airborne records, hit flash, death fade, and impact cue already covered |
| Arrow / Fire Arrow / Poison Arrow | Archer-owned children | verified-already-at-parity | independent flight, impact, poison/fire visual and audio ownership already covered |
| Firebolt / Guided Missile / mage lightning | Mage-owned children | verified-already-at-parity | element-specific projectile/effect/audio paths already covered; charge-in-hand is the separate open renderer branch |
| Demon Bomb / Poison Pool | Demon/Zombie-owned children | verified-already-at-parity | independent trajectory, landing, pool lifetime, painter order, hit, and audio paths already covered |
| The Discorporeal | non-survival native class | out-of-system | no stock survival-wave token or Website factory member in this port |
| Dire Faculty | non-survival native class | out-of-system | boss class, outside the Boneyard survival factory membership |
| Heartmonger / Crow | non-survival native class and owned child | out-of-system | boss lifecycle is not constructed by the Website survival factory |
| Spider / Silk / Cocoon | non-survival native class and owned children | out-of-system | no Website survival token/factory member |
| Portal | non-survival native class | out-of-system | Portal's own lifecycle remains outside the survival factory; its use of shared `251..254` does not replace Imp's separately closed marker-owned burst |

All eight survival families and Maggot remain members of common damage/death
presentation. Their 20-tick red duplicate redraw, shield interception,
previously closed family death records/fragments/sounds, and once-only
lifecycle ownership remain regression members; Demon's omitted delayed death
fire handoff is the explicit reopened exception closed below. Player
damage is a separate presenter owner and remains in scope for acceptance: the
20-tick red duplicate player redraw, the three native Wizard ouch cues, poison
suppression, shield/terminal suppression, and exactly-once replicated event
must all remain visible and audible.

## Native auxiliary recipes being closed

- Zombie renderer `0x00493390` tints BadGuys record `65` RGBA
  `(0.05,0.1,0.05,0.5)`, rotates it by age times `0.25` degrees, draws a
  `(1.5,1.2)` copy at y `-15` and a mirrored copy another five pixels up,
  then seeds its private render RNG with `floor(age/10)`. It draws `5..20`
  record-`26` flies: alpha `.25..75`, radius `1..21` doubled on one of five
  rolls, circular angle, y radius multiplied by `.8`, and base y `-15..-25`.
  Rotten tick owner `0x004863A0` also renews Flyblown loop request 158 every
  tick at native point attenuation.
- Wraith tick owner `0x00486C30` renews Soul loop request 170 every tick. A
  burning Wraith emits additive BadGuys record `21` when `RandomInt(4)==1` or
  its action clock is positive, 15 pixels behind the actor and 15 pixels up,
  with randomized alpha. The opaque body `2070..2087`, scale two and y `+15`,
  remains independently readable.
- Lesser Demon constructor `0x00479150` seeds five flame phases and five
  offsets; tick advances every phase by `.25` modulo the 32 DeadHawg frames
  `46..77`. Scale membership is exactly `[0.5,1.1,0.5,0.8,0.8]`. Attachment
  bases are controller points 2, 3, 4, midpoint 0/1, and midpoint 1/2; flames
  behind point 5 draw before the body and the remaining flames after it.
  Its dead branch in tick `0x00487300` retains Demon `55..61`, emits
  DeadHawg fire at death clocks `0/20/40/60/80`, and creates shared
  `Anim_FireBurst` record `110` plus `251..254` at clock 95.
- Skeleton renderer `0x0048DEE0` adds BadGuys record `46` for mace and flail,
  a line between the flail overlay's two authored points, and BadGuys record
  `54` or `56` as the pike shaft/head depending on target/action state.
- Archer renderer `0x0048F450` attaches the animated fire records `255..266`
  at age/5 or poison records `271..282` at age/6 to body authored point zero
  while its action selector is nonzero. A normal arrow has no held overlay.
- Mage renderer `0x00491720` attaches fire `255..266`, lightning `1836..1839`,
  frost `381`, or poison `382` at the two authored casting points while charge
  is positive and cooldown permits it. Charge uses the squared native charge
  lane. The explicit custom MonsterRecipe cloak selector uses alternate body
  `1459..1476`; retail survival waves leave that selector false.
- Imp tick `0x00485DC0` creates one `Anim_FireBurst` from shared BadGuys
  `251..254` on successful contact. Those records are not Imp body or Portal
  ownership in this call path; the authoritative attack-marker edge owns the
  independent 16-tick child.
- Coffin tick owner `0x004A2760` requests loop 164 at native point attenuation
  times `min(live owned Maggots / 200, 1) * 0.5`.

The three ambient sounds use the native one-frame request-accumulator model:
all live producers submit gains, one global instance per registry entry takes
the maximum, starts on the zero-to-positive edge, updates gain in place, and
stops on the positive-to-zero edge. They are untouched `flyblown__loop.wav`
(11025 Hz mono 8-bit, 39976 frames), `maggots__loop.wav` (44100 Hz stereo
16-bit, 290305 frames with a full-file `smpl` loop), and `Soul__Loop.wav`
(44100 Hz stereo 16-bit, 420589 frames).

## Closure and proof contract

The implementation must select every newly named atlas record, preserve
nonuniform and mirrored transforms, keep ambient layers out of the hit-redraw
membership, synchronize the three global loops from authoritative snapshots,
and expose deterministic browser diagnostics for family/action/layer/loop
membership. Regression coverage must enumerate every survival family, every
action program, all weapon and element recipes, projectile children, common
hit/shield/death programs, Zombie/Wraith/Demon ambient branches, and player
damage visual/audio behavior. Completion requires the canonical
`./scripts/validate.sh` on the exact final tree and focused real-browser proof
on the Mac mini, followed by a focused fast-forward publication to `main`, CI
deployment of the same revision, and a clean production browser receipt.

## Implemented closure

This section supersedes earlier chronological notes that left survival-family
action presentation, auxiliary weapon shapes, or the 63-component protocol-29
enemy sample open. Protocol 30 carries a 53-component dynamic enemy sample and
an 11-component immutable descriptor after removing the generic fire effect
and adding Mage cloak. Older notes about exact melee collision reaches remain
simulation-geometry evidence outside this presentation/audio closure; they do
not describe an unimplemented attack sprite, attachment, projectile, hit/death
effect, or cue.

The renderer now owns explicit before-body, hit-reactive body/equipment, and
after-body memberships. Damage redrawing duplicates only the body/equipment
set; Zombie gas and flies, Wraith wisps, Demon flames, cast particles, burning
fire, and the independent shield shell retain their own blend/tint. Sprite
layers support mirrored/nonuniform scale and the Skeleton Flail owns a real
line primitive. The generic replicated `burning-fire` shell was removed.
DeadHawg fire is additively composited throughout the enemy and Demon-bomb
paths; the residual browser sweep caught and removed the otherwise-visible
black source rectangles.

The concrete family closure is:

- Skeleton now attaches record `46` to Mace/Flail authored points, draws the
  Flail chain, orients Pike record `54/56`, and retains the independent action
  selector for every claw/weapon pose.
- Archer holds only its configured fire `255..266` or poison `271..282` arrow
  while the attack body selector is nonzero.
- Mage attaches all four element recipes at both authored hand points, squares
  authoritative charge, reconstructs the two independent one-in-five
  record-`10/11` cast-particle lanes, and carries the custom MonsterRecipe cloak
  boolean in protocol 30's immutable enemy descriptor. Retail waves leave it
  false.
- Rotten Zombie draws the exact two record-`65` cloud transforms and private
  `floor(age/10)` native-RNG record-`26` swarm. Its one-in-75 record-`10/11`
  `Anim_FadeSin_Move` membership is also retained.
- Burning Wraith reconstructs recent additive record-`21` wisps, including
  every current drain-action emission; Lesser Demon carries five independently
  phased DeadHawg flames with the exact scales, controller attachments, `.25`
  frame rate, and behind/front split. Demon death now schedules its native
  body strip, five delayed additive Fire children, and clock-95 FireBurst;
  future children stay out of replication until their authored birth tick.
- Imp attack-marker events now construct one independent 16-tick
  `Anim_FireBurst`: fading record `110`, additive four-ticks-per-frame
  `251..254`, upward motion, and a deterministic cosmetic constructor domain.
  The body/upper effect remains separately verified.
- Coffin retains its body/Maggot state machine and now contributes the exact
  live-owned-Maggot-weighted ambient request.

Stock uses the process-global RNG for the Mage, Wraith, Demon, Zombie transient
births and Demon constructor offsets. Protocol 30 does not serialize that
global cursor. The Website uses an immutable actor-id/spawn-tick plus fixed-tick
cosmetic domain for those draws. This is the documented deterministic
multiplayer substitute: native membership, frequency gates, atlas records,
attachment geometry, phase rate, fade ownership, and painter order remain
fixed, without claiming the same retail global-RNG word position. The same
  policy applies to the random scale/rotation of Imp's event-owned burst.

`BoneyardEnemyAmbientAudioSynchronizer` reduces live authoritative producers to
one max-gain owner for each of Flyblown, Soul, and Maggots on every presentation
frame. It starts at the zero edge, updates volume in place, stops at zero, and
balances all three owners at teardown. The browser surface publishes the active
cue/gain set as bounded diagnostics. The checked-in WAV hashes are
`e4dd23bb...22d6`, `661515f9...50b4`, and `72533246...0db` respectively.

Regression coverage now explicitly enumerates every survival family hit body,
all Skeleton weapons, both Archer elemental holds, all Mage elements and cloak,
Zombie clouds/flies/record-10/11 particles, Wraith wisps, Demon flames, the
three loop reducers, every action/death program, every projectile/effect kind,
Maggot states, shield independence, and the separate player hit/ouch presenter.
The focused WSL WebGL preflight rendered all eight attacking families, all
eight projectile kinds and nine child effects, reported `804840+` changed
pixels between sampled action frames, proved a Skeleton claw body change of
875 pixels, and returned empty page-, console-, and response-error arrays. It
is diagnostic only; final acceptance remains the exact rebased Mac mini tree.

## Mac mini acceptance, 2026-08-20

The rebased implementation commit
`34da15e198a12e0dae0a85087c26b6fba85122b4` and Mod Loader evidence commit
`5f68accf73321edb0ca4290beb96bff9307aa04c` were transferred as verified Git
bundles into the fresh detached Mac worktrees under
`/Users/jarrett/codex-acceptance/enemy-presentation-native-parity-20260820-v2`.
The Website bundle SHA-256 was
`0f16540d085683ca928e493a3efbd7ebf94235429bfde467537516f5e6ad1534`.
Both worktrees were clean before and after acceptance. The host was `arm64`
macOS `26.4.1` with Node `22.17.0`, npm `10.9.2`, .NET `10.0.302`, and Google
Chrome `151.0.7922.138`.

`./scripts/validate.sh` exited zero on the exact Website tree. It passed the
Release backend build with zero warnings/errors, all 24 Website contracts,
formatting and architecture boundaries, lint with only the eight established
Fast Refresh warnings, 126 prerequisite tests, all 950 Boneyard/frontend
tests, 5 level-up tests, 6 diagnostics tests, 14 Hub UI tests, 5 desktop tests,
both production builds, and the production media-policy gate. The retained
`validate.log` SHA-256 is
`098153cd34f9630de0acd0750dec68a91e787838443f7386214151892b8c5ad2`.

The focused WebGL2 enemy proof exited zero with empty page-, console-, and
failed-response arrays. It rendered all eight survival families in attacking
state, eight projectile kinds, nine independent projectile effects, one
Maggot, one Mage lightning pulse, and one marker-owned Imp FireBurst. The
sampled frame changed 488,929 pixels / 15,284,284 RGB-channel units. Its
membership receipt includes Skeleton Mace plus burning fire, Archer's held
poison arrow, four Mage lightning-charge passes plus record-10/11 particles,
both Zombie gas clouds plus six flies, Wraith action wisps, and all five Demon
flames. The focused Skeleton crop changed 1,096 pixels / 90,877 channel units
and independently records body selector `1189 -> 1315` while gait limbs remain
`1693`.

The same real browser fetched and decoded all three untouched ambient WAVs,
started Flyblown/Soul at gain 1 and Maggots at the WebAudio float32 form of
`0.0025`, confirmed all three sources were looping, then observed one balanced
stop per cue. The JSON log SHA-256 is
`543e28f6e3fcbbe8a427453ad5afd1d226dc1bb5a04dcd41de315f3cb0c27bf1`.
The inspected combined VFX image contains no opaque black fire rectangles;
its SHA-256 is
`7e1d9820e9626cd613a2dbac72dc5be98d77c3361a99c5c7f3152a46b62189d3`.
The early/late Skeleton crop hashes are
`e5ae3a7b1985fa5c751c93ab63ea347eb01d8531662122ea5c61978cc34b4d04`
and `9b4715e0c425e84db1e469db2cd267af332255502f8000fcebd0cd24e7fb3d27`.

The independent player-damage browser proof also exited zero. It showed all
five body/equipment hit layers as a native-red duplicate, held midpoint alpha
`.5`, retired the overlay at the 20-tick boundary, suppressed it for poison and
death, and played untouched `wizard-ouch-2.wav` at pitch 1 / gain `.625`.
Its log and image SHA-256 values are
`080a221275ded1737140ee8c600866aa9aee56bdb38c43f19f53f470ef703ae4`
and `ea943b9bdb47e9fb7a27aecb6250d8a18883fdeeceb008acc51512ead5811cb5`.
Acceptance teardown left zero process whose command referenced the task root or
its Vite port.

## 2026-08-30 — Skeleton-family glow, articulation, and elemental-tip reopening

### Reported smell and parity question

- Reported web behavior: fire Archers look engulfed in fire instead of carrying
  fire-tipped arrows on glowing bodies; poison Archers show a dull tip and their
  arrow presentation appears disjointed; a nearby hat/headgear layer looks
  slightly misaligned. The supplied browser recording is
  `SDB - Fire Archers and some imp visual errors.mp4`, 15.429944 seconds,
  1854 by 1080, SHA-256
  `7c8648763773aa0ea5b8e000893f3afcd7479eb4425246022f79dfae3f7195e7`.
- Stock behavior to recover: the complete Skeleton, Archer, and Mage articulated
  compositor, constructor-owned cosmetic fields, `BURNING` passes, held
  fire/poison-tip lifetime and geometry, flying Arrow compositor, and nearby Imp
  body/upper-effect membership.
- Reproduction inputs: the supplied browser footage at approximately
  `11.0..15.4` seconds for burning Archers and `0.0..10.0` seconds for the
  alleged nearby Imp effects; deterministic renderer plans for idle, windup,
  release pose 8, projectile flight, and each `BURNING` sibling.
- Falsifiers: a native Archer draw that submits three independently planted
  DeadHawg flames without articulated redraws; elemental tips that exist only
  while a web action object is present; a fixed `-4` headgear offset; a poison
  tint other than native half-green; or an Imp body/upper transform that differs
  from the current Website plan.

This is a secondary report in a system called complete above. The prior pass
mistook the two native DeadHawg children plus three articulated color passes for
three arbitrary attachment flames, did not recover the constructor height and
stride-sine geometry, and tested one active held-arrow frame without checking
idle or release boundaries. Those skipped rules made the earlier
`verified-already-at-parity` Archer row false.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Browser reproduction | supplied MP4 and disposable 10 Hz/2 Hz frame extractions | Fire Archers carry three large, independently planted flame sprites which obscure the articulated body; the elemental hold visibly does not remain joined to the authored tip throughout the stock pose domain. | high for reported web output |
| Retail identity | unmodified `SolomonDarkAbandonware/SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Same sealed 0.72.5 image as the prior enemy ledgers. | high |
| Fresh instructions | canonical `SolomonDark` Ghidra project through the read-only replica wrapper; Skeleton ctor/render `0x004771B0/0x0048DEE0`, Archer ctor/render `0x0048A6B0/0x0048F450`, Mage ctor/render `0x0048ABB0/0x00491720`, Arrow draw `0x0060F590`, Imp draw `0x00492E10` | Recovers constructor colors/heights, shared stride-sine articulation, exact three-pass burn composition, held-tip pose/socket/color rules, Arrow flight composition, and unchanged Imp body/upper geometry. | high |
| Raw instructions/constants | Archer `0x0048F60B..0x0049024C`; `_CIsin 0x007470D0`; `RandomFloat 0x00401310`; doubles `0x007DE808=.5`, `0x007DE838=2`, `0x007DE8D8=5`, `0x007DE8E0=3`, `0x007DE8F0=.25`, `0x007DE910=3`, `0x007DE920=20`; floats `0x007DE934=.75`, `0x00785564=.35` | The relevant arithmetic, strict selector-8 exclusion, and transforms are instruction-derived rather than inferred from pixels. | high |
| Authored data | untouched `data/wave.txt` projection SHA-256 `363a985d79dc3ca28fb5ce519f56c436f5269a9bea1bedc7d1a825e8139499fc`; BadGuys records `2`, `255..266`, `271..282`, Skeleton-family banks; DeadHawg `46..77` | Retail contains 25 `BURNING` rows, including all eight burning Fire Archer rows; 40 Fire Arrow and 22 Poison Arrow rows cover every shipped flag combination. Archer body record extras provide tip point zero. | high |
| Existing accepted runtime | read-only `animation-goldens.json` at Mod Loader `origin/main`; stock Skeleton/Archer/Mage samples | Stock carries non-white constructor tint, persistent `+0x220` height, authoritative `+0x140` stride phase, and the expected body/head record ordering. | high-supporting |
| Current Website source | `native-enemy-presentation.ts`, `native-enemy-projectile-presentation.ts`, and exact fixed-function NPM/additive renderer | Web uses arbitrary three-point isotropic flames, fixed headgear `y=-4`, no constructor height/tint or stride articulation, and action-only tips without the native `-5Y` socket. Flying Arrow shaft/overlay state and poison color already match the recovered draw. | high |

The read-only Mod Loader checkout was not changed. Invocation provenance is
revision `08bfba9ef367f7b863848030d0a289dc31e33192`; wrapper SHA-256
`b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`;
`decompile_targets.py` SHA-256
`899167ca42624e09f26d22233365631a6ee8b3d106e337e20b77574894e97465`.

### System boundary and membership inventory

Native system: **Skeleton-family articulated draw composition**, from final
constructor cosmetic state and authoritative stride/action/head selectors
through ordered body/equipment/tip/burn submissions, common hit redraw, light
providers, and teardown. Flying Arrow and Imp are adjacent falsifier members,
not permission to merge their independent lifetimes into the body renderer.

| Member / branch | Native source | Disposition | Proof / consequence |
| --- | --- | --- | --- |
| Skeleton normal body, equipment, and four headgear banks | `0x004771B0`, `0x0048DEE0` | `exact-ported` by this reopening | constructor tint/height and stride-relative limbs/body/head geometry; all existing weapon selectors retained |
| Skeleton `BURNING` body | `0x0048DEE0`, actor `+0x240` | `exact-ported` by this reopening | one orange normal articulated pass, two additive articulated passes, and the two exact DeadHawg children replace guessed three-point flames |
| SkeletonArcher normal body/headgear | `0x0048A6B0`, `0x0048F450` | `exact-ported` by this reopening | same constructor/stride geometry; head relative to body is `-2-bob`, not fixed `-4` |
| Fire Archer hold, release, and burning body | `0x0048F450`, type byte `+0x24A=1` | `exact-ported` by this reopening | tip exists for every body selector except 8, uses `255..266`, point zero minus five Y, charge alpha; burning composition is shared body glow plus two bounded fire children |
| Poison Archer hold and release | `0x0048F450`, type byte `+0x24A=2` | `exact-ported` by this reopening | same pose/socket/charge rule using `271..282`; native tint is `(0,scale*.5,0)`, so no non-native brightening |
| SkeletonMage body, cloak, four charges, and headgear | `0x0048ABB0`, `0x00491720` | `exact-ported` by this reopening | body/limb passes precede charge; independently ordered headgear follows charge; existing cast particles remain after the articulated membership |
| SkeletonMage `BURNING` | `0x00491720`, actor `+0x240` | `exact-ported` by this reopening | same three body passes and two DeadHawg children; headgear repeats in its separate post-charge loop |
| DeadHawg burn children | singleton `0x00819994`, array `+0x19B0`, records `46..77` | `exact-ported` by this reopening | frame `(age/2)%32`; directional/top `(headingVector*2)+(0,-40)`, scale `(0.5,0.85)`; lower `(0,-20)`, scale `(0.4,0.75)`; additive pass-one tint |
| common burn light providers | existing enemy lighting owner, actor `+0x244/+0x24C` | `verified-already-at-parity` | Skeleton/Archer/Mage provider count, charge, glow, fixed-tick authority, and Region ordering are unchanged |
| normal/fire/poison flying Arrow | `0x005E1000`, `0x005FEA00`, `0x0060F590` | `verified-already-at-parity` | shaft and elemental overlay share one actor root; exact height, pitch countdown, alpha retirement, frame cadence, fire white, and poison half-green remain unchanged |
| Wraith `BURNING` | `0x00496220` and record-21 soul-wisp owner | `out-of-system` for Skeleton-family glow; `verified-already-at-parity` in its own renderer | same recipe flag does not imply the articulated three-pass compositor |
| Imp body and upper strip | `0x00492E10`, BadGuys `285..342` | `verified-already-at-parity` | body bank/facing/rotation/scale, authoritative vertical root, upper `-10Y`, frame and alpha agree with current code; no reported pink projectile is reclassified as Imp art |
| Imp landing/contact children | entry 179's `0x00478A20/0x00485DC0` closure | `verified-already-at-parity` | independent pre-world flare and bias-zero contact FireBurst retain their own lifetimes and painter lanes |
| cross-combined burning weapon recipes absent from retail wave rows | complete `wave.txt` row census | `out-of-system` for shipped survival authoring | no stock row combines `BURNING` with Sword/Mace/Flail/Axe/Pike; browser mods remain extension behavior rather than omitted stock membership |

No renderer member is blocked by the browser. Exact retail process-global RNG
cursor identity is not portable across separately launched stock and browser
sessions. Constructor values and per-frame burn hues therefore use the
established stable actor/tick cosmetic domain. The predicted visible difference
is only which legal orange hue appears on a particular frame, not membership,
range, geometry, ordering, or cadence.

### Native ownership thread and recovered behavioral contract

- Constructors retain neutral body tint
  `(1-U(.15),1-U(.15),1,1)` and a fixed body-height offset `U(3)`. Archer and
  Mage rerun those constructor draws, so each final class owns its final values.
- For all three renderers,
  `bob=abs(sin(stridePhaseDeg*.5 degrees))`. Limbs plant at `-bob`, torso and
  body-aligned equipment at `-height-2*bow`, and headgear at
  `-height-2-3*bow`; therefore headgear is `-2-bob` relative to the torso.
- `BURNING` first replaces the base tint with `(1,U(.5),0,1)`. Pass zero draws
  the articulated family normally. Pass one selects
  `(1,.25+U(.75),0,1)`, enables additive blend, draws the two exact DeadHawg
  frames, then redraws the articulated family. Pass two reuses that additive
  color and redraws the family once more. No third independently planted flame
  exists.
- Archer held art is body-owned but not a child of a projectile. Fire uses
  `255+(age/5)%12`; poison uses `271+(age/6)%12`. Both use body record point
  zero at `y-5`, charge alpha, and exist whenever body selector is not exactly
  release pose 8. A normal Archer has no held overlay.
- Flying Arrow remains an independent actor. Record 2 and its fire/poison
  overlay share position and vertical root. Poison's pure green half-scale
  modulation is stock behavior; changing it to cyan/white would create a new
  parity error.
- Mage body/limbs repeat before element charge; charge art draws next; headgear
  repeats afterward. Renderer-local Mage particles and every independent child
  lifetime remain in their previously recovered lanes.
- Death, run reset, snapshot removal, and scene teardown destroy the articulated
  view. Arrow and Imp child effects retain their separately owned lifetimes.

### Nearby-system findings

- The old fixed `-4` headgear correction accidentally approximated absolute
  root Y for some phases while leaving the torso at root zero. The native
  relationship is dynamic and shared by Skeleton, Archer, and Mage; an
  Archer-only `+2px` patch would remain wrong for every other stride phase.
- The supplied pink star-shaped bodies in the early footage are player Ether
  presentation, not records `285..342`. The fresh Imp renderer trace agrees
  with the current body/upper plan, so no Imp symptom patch is justified by
  this capture.
- The reported flight “tracking” is not a remaining target/pathfinding bug:
  entry 273 and fresh `0x0060F590` inspection retain separate travel heading and
  visual pitch exactly. The newly proven held-tip socket/lifetime is the
  falsified visual owner.

### Confidence and open questions

- Confirmed: constructor fields/ranges, complete burn pass membership, tints,
  blend transition, DeadHawg records/cadence/geometry/scales, stride formula,
  head/body relationship, held-tip pose/socket/frame/color/alpha, complete
  authored row counts, flying Arrow composition, and Imp body/upper geometry.
- Browser adaptation: exact cross-launch RNG word identity is unavailable; the
  existing deterministic actor/tick cosmetic domain substitutes only within
  the recovered ranges.
- Material unknowns: none. If a later capture identifies a Wizard/player hat
  rather than Skeleton-family headgear, that belongs to the separately ledgered
  player-character compositor and must be reproduced as a distinct report.

### Web implementation consequence

- Replace arbitrary `burningLayers` attachments with one shared
  Skeleton-family articulation/compositor in `native-enemy-presentation.ts`.
- Derive fixed constructor tint/height from stable immutable actor identity and
  derive bob from authoritative `stridePhaseDeg`; do not add a render-cadence
  clock or protocol field.
- Preserve exact pass and Mage charge/head ordering. Keep only body/equipment
  members in the common red hit redraw; DeadHawg and elemental additive art
  retain their own modulation.
- Show fire/poison holds for every selector except 8 at point zero minus five Y
  and modulate them by authoritative Archer charge. Do not alter flying Arrow
  targeting, physics, poison tint, or Imp presentation.
- Remove the fixed `-4` headgear offsets and the three guessed family flame
  points across Skeleton, Archer, and Mage in one change.

### Validation contract

- Focused renderer tests must fail on the old tree and enumerate all three
  Skeleton-family normal/burning paths, exact pass order/tints/blends, both
  flame children, constructor-height and stride endpoints, four headgear banks,
  Mage charge/head ordering, idle/windup/release held tips, both elemental
  frame clocks, charge alpha, and hit-redraw membership.
- Preserve explicit negative tests for normal Archer, release pose 8, Wraith's
  separate burning owner, unchanged flying Arrow shaft/overlay composition, and
  unchanged Imp body/upper transform.
- Run the repository-supported Mac gate on a test-only red candidate, then on
  the implementation candidate. The final exact tree must pass
  `/opt/homebrew/bin/bash ./scripts/validate.sh`.
- Mac Chrome WebGL2 must render a burning Fire Archer, non-burning Fire Archer,
  Poison Archer, Skeleton, Mage, Wraith, and Imp in one deterministic gallery;
  prove body readability, exact layer/role counts and ordering, joined held
  sockets before pose 8, clean disappearance at pose 8, and empty page,
  console, failed-response, and wire arrays. A real Boneyard journey must
  witness one authored Fire or Poison Archer without synthetic projectile/path
  substitution.

### Implementation validation receipt

The exact final candidate is current Website base
`b023703c85ddf28a0791824bb60c5d3f74069df1` plus the three-file focused
change. Local and Mac SHA-256 manifests matched for the ledger, renderer test,
and renderer implementation. The candidate remains uncommitted in
`/home/user/.codex-worktrees/solomon-website-archer-imp-visual-20260830-root`;
no push, deployment, or production claim is implied.

- The test-only Mac candidate on base `228c1fd8` failed exactly the four new
  renderer contracts while 1,780 prior Boneyard tests passed. The failures were
  the intended red signal for articulation, idle/release tip ownership, burn
  composition, and sibling membership.
- `native-enemy-presentation.ts` now derives the constructor-neutral tint and
  inclusive `[0,3]` body height from stable actor identity, consumes
  authoritative stride phase for limb/body/head articulation, and centralizes
  the complete Skeleton-family composition. `hitBody` keeps body/equipment
  redraw membership separate from elemental/DeadHawg children.
- Fire/poison holds now use charge alpha, additive blend, point zero minus five
  Y, and the exact selector-8 exclusion. Poison remains native half-green.
  Flying Arrow and Imp files were not changed.
- The final current-base Mac gate ran from detached
  `/Users/jarrett/codex-acceptance/archer-imp-visual-20260830-root-r2/Website`.
  Backend Release built with zero warnings/errors; 28 Website/backend
  contracts, lint/architecture, all auxiliary suites, desktop `5/5`, all
  1,784 Boneyard tests, production builds, media policy, and bundle budget
  passed. `Game-KpKuofp4.js` measured 266,211 raw / 80,897 gzip bytes under
  524,288 / 134,144.
- Mac Chrome selected Pixi WebGL2. The broad gallery rendered all eight
  families with poison Archer record `275`, exactly two Skeleton DeadHawg-64
  children at X scales `.5/.4`, articulated burn copies, and unchanged Imp
  landing/contact ownership. Frame A/B changed 432,326 pixels / 14,147,025 RGB
  channel units; Imp contact changed 5,820 / 811,914. Page, console, and failed
  response arrays were empty. Reviewed image SHA-256 is
  `d68371575685947dee7935773f8894f762249822a32ff30b7beb25bcbe503390`.
- A task-only input substitution ran the same real renderer with authored
  `BURNING+FIREARROW`. Its exact ordered plan was base limbs/body, fire record
  `263`, headgear, two DeadHawg-64 children, then two articulated glow passes;
  frame A/B changed 433,053 pixels / 14,368,056 channel units. Page, console,
  and failed-response arrays were empty. Reviewed image SHA-256 is
  `b89f640aaae93d3f8dbb295bb86053ea1813a78b420e015a6c222a2c2b9b6449`.
- The visual review confirms the user-visible distinction: stock still has two
  narrow, vertically planted fire children, but the articulated orange body,
  headgear, bow, and held tip remain readable. The removed web path used three
  wider guessed attachment flames and no native body glow, which produced the
  reported engulfed silhouette.
- The final fetch proved local `HEAD` and `origin/main` both
  `b023703c85ddf28a0791824bb60c5d3f74069df1`. Task Vite listeners on ports
  4291 and 4292 and their exact npm parents were stopped; no task listener
  remained. Disposable screenshots and copied frame extractions are removed
  after this receipt records their results and hashes.
