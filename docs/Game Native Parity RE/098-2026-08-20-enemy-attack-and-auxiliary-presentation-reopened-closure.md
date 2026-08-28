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
