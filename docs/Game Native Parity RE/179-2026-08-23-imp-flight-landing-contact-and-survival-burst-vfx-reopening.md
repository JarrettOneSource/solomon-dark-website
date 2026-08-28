# 2026-08-23 — Imp flight, landing-contact, and survival burst-VFX reopening

## Reported smell and parity question

- Reported web behavior: the flying Imp enemies appear to be missing VFX and
  their animation may be wrong. If one gap is found, every other enemy must be
  checked for the same missing ownership.
- Stock behavior to recover: the complete Imp constructor, flight/bounce,
  contact, renderer, child-animation, audio, light, painter, and teardown
  thread, followed by the shared survival-enemy auxiliary and
  `Anim_FireBurst` membership.
- Reproduction: ordinary Boneyard Imp movement/contact plus the generated
  eight-family Mac Chrome compositor at `1600x900`.
- Falsifiers: body/upper records alone are insufficient if the landing edge
  owns another vtable child; one correct burst asset range is insufficient if
  caller plant, manager lane, scale, cadence, wrapper light, or painter bias
  differs; a named web action is invalid if the stock body never has that
  action state.

This is a secondary report in a system marked closed on 2026-08-20. The prior
pass skipped two whole-system rules: it stopped at the Imp burst's asset
membership without placing the landing and base-contact vcalls on opposite
sides of the distance test or recovering their manager lanes, and it did not
reconcile the durable native finding “no Imp contact action clock” with the
Website's still-present bounded timer. This section supersedes those claims.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | `SolomonDarkAbandonware/SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Matches the canonical analyzed 0.72.5 program. | high |
| Fresh instructions | canonical Ghidra `SolomonDark` project through read-only replica wrapper; Imp constructor `0x00473E30`, movement `0x00478560`, tick `0x00485DC0`, landing presenter `0x00478A20`, base contact `0x00474000`, render `0x00492E10`; burst ctor/tick/draw `0x00453470/0x004575B0/0x0045E2D0`; registration helpers `0x0063E5E0/0x0063E5B0`; Arena manager passes `0x0046F9AC/0x0046FDA4/0x0046FFB7` | Every landing owns the record-15 pre-world child; accepted contact separately owns one bias-zero `ZAnim` FireBurst; Demon direct bursts are post-world; no branch selects an Imp body action. | high |
| Shared xrefs | `refs_to_addr_decompile.py 0x00453470`, 11 xrefs plus raw windows | Survival reaches Imp contact, Demon muzzle/death, Fire Arrow, and Firebolt. Raw and `ZAnimLit` callers have different light/painter ownership. | high |
| Asset/data | BadGuys manifest records `15`, `110`, `251..254`, `285..342`; Demon authored controller points | All referenced rows exist with native registration/extras. | high |
| Mac baseline | exact Website `b57eab6f`, hardware Chrome WebGL2, `smoke-enemy-animation-projectile-vfx.mjs`; screenshot `/tmp/solomon-imp-enemy-vfx-base-20260823.png`, SHA-256 `4e6839967fd256d3a7a4e24f68b5a1f0025a2766b5f55fbcef9759199c31e0a4` | The oversized, low-planted burst obscures the Imp into an orange blob; all eight families otherwise render with zero page/console/network errors. | high |
| Current web | `boneyard-imp-flight.ts`, `boneyard-enemy-store.ts`, `native-enemy-attack-effect.ts`, `native-enemy-view.ts`, projectile-effect/light adapters | Imp uses an invented 6/11/18 contact program; phase uses quartered motion; record-15 child and Demon muzzle are absent; several burst plants/wrappers are partial. | high |

## System boundary and membership inventory

Native system: **Boneyard survival enemy animation and auxiliary transient
presentation**, from fixed-tick family state and action callbacks through raw
or wrapped animation children, audio/light registration, rendering, reset, and
teardown.

| Member | Native source | Disposition | Proof / consequence |
| --- | --- | --- | --- |
| Skeleton body, equipment, burning, hit/death | `0x0048DEE0` and shared presenters | verified-already-at-parity | complete claw/weapon/pike and auxiliary tests; Mac baseline witness |
| SkeletonArcher body/held arrows | `0x0048F450` | verified-already-at-parity | normal/fire/poison attachment tests |
| Archer Fire Arrow impact | `0x005E5D30 -> 0x00453470 -> ZAnimLit` | exact-ported | correct `(x,y-10)`, unsigned `0.5..0.6`, wrapper light/bias/self-lit child required |
| SkeletonMage body/charge/particles/lightning | `0x00491720`, `0x00490860` | verified-already-at-parity | all four elements and low-frequency particle lanes covered |
| Mage Firebolt impact | `0x005E7C20 -> 0x00453470 -> ZAnimLit` | exact-ported | correct `(x,y-10)` and wrapper light/bias/self-lit child required; signed `0.75±0.1` already correct |
| Imp constructor and flight | `0x00473E30`, `0x00478560`, `0x00485DC0` | exact-ported | native horizontal-speed lane, landing rerolls, upper phase/alpha, persistent escape heading |
| Imp body and upper strip | `0x00492E10`, BadGuys `285..342` | verified-already-at-parity | 12-way facing, four body banks, vertical transform, upper `(0,-10)` |
| Imp contact FireBurst | `0x00485DC0 -> 0x00453470 -> 0x0063E5E0` | exact-ported | 16-age bias-zero `ZAnim` child at `(0,-15)+heading*15`, scale `0.5+U(0.1)`, no light provider |
| Imp landing flare | vslot `+0x98 -> 0x00478A20` | exact-ported | previously absent BadGuys-15 additive 13-age pre-world perspective child on every landing, before the contact test |
| Imp bounce/contact audio | eight Imp rows and three Bite rows in `0x00485DC0` | exact-ported | bounce and accepted contact events with exact pitch bands |
| Zombie normal/rotten, gas, flies, beat/pool/death | `0x004863A0`, `0x00493390` | verified-already-at-parity | body/arm/head, gas/fly, loop and transient tests |
| Wraith body/drain/wisps/death | `0x00486C30`, `0x00496220` | verified-already-at-parity | opaque facing body and independent soul branches covered |
| Demon body and five persistent flames | `0x00479150`, `0x00498BA0` | verified-already-at-parity | controller points, articulation, behind/front split covered |
| Demon bomb muzzle FireBurst | `0x0049A270 -> 0x00453470` | exact-ported | previously absent raw child at controller point 5 plus heading `25`, scale one, phase step `0.1875` |
| Demon dead-clock FireBurst | `0x00487300 -> 0x00453470` | exact-ported | correct local `(0,-20)`, scale two, phase step `0.1875`, rotation and 22-age alpha/frame clock |
| DemonBomb live/terminal Fire actors | `0x00603CA0`, `0x005E9970` | verified-already-at-parity | projectile and persistent Fire handoff tests |
| Coffin body/loop and Maggot children | `0x004A2760`, `0x0049AC90`, `0x0049C190` | verified-already-at-parity | body states, both Maggot lanes, loop and teardown covered |
| Common hit redraw, shields, family terminal actors | shared damage/death presenters | verified-already-at-parity | per-family body-only red redraw and terminal-effect suites |
| Portal `0x139D` | `0x00489CC0` raw burst caller | out-of-system | no Website survival factory member; sharing burst art does not make it reachable |
| GoodImp / GreenImp | `0x3ED` / `0x7FC` | out-of-system | player Fire summon and Unholy story graph have separate owners |
| DemonSkull, DireFaculty, Heartmonger/Crow, Spider/Cocoon | compiled non-survival families | out-of-system | not reachable from the Website survival factory |

No member is browser-blocked. Deterministic cosmetic draw identity remains the
documented multiplayer substitution for the retail process-global RNG cursor;
record domains, formulas, lifetimes, and ownership are extractable and exact.

## Native ownership thread

- Imp constructor owns initial speed `4.5`, upper phase `Float(10)`, body bank
  `Integer(4)`, signed body angle `Float(45)`, zero height/vertical velocity,
  and zero upper alpha.
- Movement `0x00478560` uses target direction until contact latch `+0x235`,
  then retained escape heading `+0x238`. Motion remains
  `0.25*speed*recipe/status/scale` per represented native tick.
- Tick `0x00485DC0` advances the upper phase from `abs(horizontalSpeed)`, not
  already-quarter-scaled world displacement. Landing rerolls horizontal speed
  as `base*(1+U(1.5))`, lift, body bank/angle, upper alpha, optional 1.5 lift,
  vocal audio, and the record-15 flare. Vslot `+0x98 -> 0x00478A20` runs
  before the target-distance branch and enrolls that flare in the pre-world
  `Region+0x278` manager.
- Only landing evaluates `(targetRadius+45)*1.25`. Accepted contact emits Bite
  audio, one ordinary bias-zero `ZAnim` FireBurst, and the escape heading
  before base-contact vslot `+0xA0 -> 0x00474000` dispatches damage. The body
  renderer remains the same flight state.
- Imp FireBurst uses the shared world-sorted `ZAnim` queue. Demon muzzle/death
  bursts instead enter direct `Region+0x1E0` after that queue and before
  foreground/overlay passes. Wrapped Fire
  Arrow/Firebolt impacts have one `ZAnimLit` owner in the shared queue:
  transient registration, radius `1.5`, intensity `1-0.04*age`, false
  Multiple Shadows, bias `50`, and direct/self-lit child draw. All three
  FireBurst ownership forms bypass inbound Region tint.
- Snapshot removal, run reset, or world teardown destroys the actor views and
  event children; replicated projectile effects retain independent lifetimes
  after their parent retires.

## Recovered behavioral contract

- Imp bounce upper-effect phase: `positiveMod(phase+abs(speed)*0.25,10)`.
- Imp landing: vertical offset greater than zero clamps to zero; horizontal
  speed `base*(1+U(1.5))`; vertical velocity `-(3+U(3))`, optionally times
  `1.5`; bank `Integer(4)`; signed angle `U(60)`; alpha one.
- Imp contact FireBurst: 16 ages, phase `0.25*age`, upward `age`, body-relative
  plant `(sin(h)*15, -15-cos(h)*15)`, scale `0.5+U(0.1)`.
- Imp landing flare: every landing, before contact; BadGuys 15, alpha
  `max(0,1-age*0.08)`, scale
  `0.5+U(0.6)`, anisotropic `(s,0.8s)`, additive orange
  `(1,0.25+U(0.5),0)`, actor-root plant, ages `0..12`, pre-world direct
  manager.
- Demon raw burst variants multiply phase rate by `0.75`; visible entry is
  `251+min(3,trunc(age*0.1875))`, and glow alpha follows the same phase rather
  than a forced 16-tick fade. Bomb-muzzle rotation/magnitude/sign draws precede
  the DemonBomb actor's countdown/speed draws.
- Wrapped Fire Arrow/Firebolt bursts plant at `y-10`; their split web sprites
  are one native `ZAnim` queue wrapper for ordering/light purposes and bypass
  inbound Region tint. Imp keeps the queue at bias zero without light; Demon
  raw bursts remain self-lit post-world children and must not acquire that
  wrapper source.
- There is no action body named `imp-contact`. An attack marker remains the
  semantic replay-safe birth edge for its independent children/audio/damage.

## Nearby-system findings

- The complete `Anim_FireBurst` constructor census has eleven callers. The
  other six are Portal, Fireball, FireMissile, Ember, EvilEmber, and
  DarkFireball; each is dispositioned in the Mod Loader report and cannot be
  silently copied into survival ownership.
- The previous full-lighting ledger correctly recovered `ZAnimLit` formulas
  but failed to join the Archer/Mage impact entities back to that wrapper.
  Asset correctness without wrapper registration/painter/tint ownership was a
  false closure.
- Native reports updated: `native-enemies.md` and
  `native-projectiles-and-effects.md`.

## Web implementation consequence

- Replace the Imp bounded action program with one host-authoritative flight
  state carrying current/base horizontal speed and optional escape heading.
  Contact and its semantic marker occur only on a landing edge.
- Keep the exact body/upper renderer; remove `imp-contact` from the action
  union rather than preserving a compatibility animation.
- Generalize the event-owned raw burst view for Imp contact and Demon bomb
  muzzle, and add the independent every-landing Imp record-15 flare. Preserve
  its pre-world lane, Imp's bias-zero `ZAnim` lane, and Demon's post-world lane.
- Correct Demon death burst position, scale, rotation, phase/alpha cadence.
- Correct Fire Arrow/Firebolt impact plant and RNG domains/order. Replicate one
  transient light registration per wrapped burst, project its fading source,
  apply bias 50, and keep both child sprites self-lit.
- Emit replay-safe native Imp vocal/Bite audio from authoritative events.
- Do not change Zombie, Wraith, Coffin/Maggot, or already-correct
  Skeleton-family/Demon persistent layers.

## Validation contract

- Focused Imp tests: constructor draw count/state, speed reroll, upper phase,
  every-landing flare before contact, landing-only contact, exact threshold,
  immediate damage/event/audio, escape heading persistence, no action body,
  both child recipes, painter lanes, and teardown.
- Sibling tests: every one of the eleven constructor xrefs has one disposition;
  Archer/Mage wrapped bursts assert plant/scale/RNG order, registration,
  source intensity/radius, bias and tint bypass; Demon muzzle/death assert
  origin, scale, `0.1875` phase and lifetime.
- Complete eight-family auxiliary/asset tests remain green.
- Mac Chrome before/after generated compositor: body remains readable beside
  the smaller raised Imp burst, record-15 flare and Demon muzzle are visible,
  auxiliary lanes are exactly pre-world/world-sorted/post-world, wrapped source
  count increases exactly when active, WebGL2 remains selected, and
  page/console/failed-response arrays remain empty.
- Real Boneyard Mac journey: natural Imp landing/contact proves the marker,
  damage, both sounds, both VFX children, bounce speed/upper animation, turn
  away, teardown/reset, and at least one Archer/Mage/Demon sibling witness.
- Exact candidate must pass focused suites and the complete
  `/opt/homebrew/bin/bash ./scripts/validate.sh` on the Mac mini.

## Implementation validation receipt

- The final source candidates are Website base
  `534b8be835f316a3b6714977e85e5b1d851def12` plus 37 focused files and
  Mod Loader base `4e6b34cd2af686d3d5500072f6beb2f0bb2d527c` plus two reports. The
  pre-receipt Website patch SHA-256 was
  `705443f79088ec619af71c5cafc2670276fc12a2dc9f8886b10a33751cd1b576`;
  the Loader patch SHA-256 was
  `4309068a129b688bcf1689415939f09dd30106c8a968c234e42bd7597e9ded8d`.
  Local and Mac manifests matched byte-for-byte.
- Authority now retains base/current Imp horizontal speed and escape heading,
  emits the BadGuys-15 flare on every landing before the contact test, consumes
  exact constructor/audio RNG order, and has no `imp-contact` body action.
  Protocol 65 carries wrapped FireBurst light ownership and Demon death
  presentation ownership. Rendering preserves pre-world landing flare,
  bias-zero world-sorted Imp `ZAnim`, direct post-world Demon bursts, and
  bias-50/light-owning Archer/Mage `ZAnimLit`.
- Mac Mod Loader's registered static RE suite passed `495/495`.
- The complete Mac Website gate passed backend build with zero warnings/errors,
  17 backend/contracts, lint with zero errors and the eight existing warnings,
  architecture checks, frontend suites
  `4/44/249/1424/6/61/9/48/12/7/36/23`, desktop `5/5`, production build,
  bundle budget, and media policy. `Game-mCSCl9wC.js` was `439851` raw /
  `123892` gzip bytes under `524288` / `131072`; gate-log SHA-256
  `def952325362633d9aefccbc22e9d2bf0f596828877f464dcbf70eaa76034c6c`.
- Mac Chrome selected Pixi WebGL2. The eight-family compositor retained exactly
  eight enemies and reported auxiliary lanes
  `[pre-world-queue, world-sorted, post-world-queue]`. The controlled real
  Imp authority edge remained `action=null`, `phase=flight`, dealt one
  damage, emitted `imp-vocal-4`, `bite-2`, then the attack marker, rerolled
  horizontal speed to `10.022587699466385`, turned to
  `93.8615826156456`, and rendered two independently expiring children. Its
  crop changed 6,369 pixels / 909,190 channel units.
- Reviewed final compositor and authority captures are
  `/tmp/solomon-imp-enemy-vfx-final-20260823.png` SHA-256
  `a20fe567407c476bb204554022590f4db92374c8a4ac88fbb6aa06bc7e6f61e7`
  and `/tmp/solomon-imp-landing-contact-final-20260823.png` SHA-256
  `9304ce1d09e3c22a17d98220bc43a3c5f4231950e76432377bdc37ee516c747f`.
  Page, console, and failed-response arrays were empty.
- No member is browser-blocked and no material unknown remains. At the time of
  this validation receipt, no commit, push, or deployment was authorized or
  performed; task worktrees and named evidence remained retained for review.

### Publication authorization and latest-base revalidation

At 2026-08-23 20:12 EDT the owner explicitly authorized fast-forward
publication to both `main` branches. Deployment was not requested and remains
a separate operation. The focused changes are rebased onto Website
`03af48750e7252725f500b80ab98be543fb62d7f` and Mod Loader
`b1690ebef380ca1f56424b9ecf29c533cac9866e`. Upstream Hagatha owns protocol
64 and the durable-save lifecycle owns protocol 65, so the combined enemy
presentation schema is protocol 66. The focused candidates before this receipt
are Website `e4c613a30a02745b4e98ea237e9beac9fd2b944c` and Mod Loader
`d57eadd19c66d0e2dfd5a0f134fdac6e751b62f5`.

The owner explicitly directed that publication revalidation run natively on
this physical Windows computer outside WSL instead of waiting for the Mac mini.
Git for Windows and native Git Bash/PowerShell ran Node `22.17.0`, pinned npm
`10.9.2`, Python `3.13.5`, and task-local .NET SDK `10.0.302` against detached
LF worktrees of those exact commits.

- The native Windows Mod Loader static RE suite passed `496/496`; log SHA-256
  `6271b6c00aa655157dbae5a1c5ed3f695f2763e4db012b4bc36e0caff6dcda0a`.
- The complete native Windows Website gate passed backend build with zero
  warnings/errors, 17 backend/contracts, lint with zero errors and the eight
  existing warnings, architecture checks, frontend suites
  `9/4/45/255/1444/6/61/9/49/12/7/36/26`, desktop `5/5`, production build,
  bundle budget, and media policy. `Game-93B8BJDO.js` was `443784` raw /
  `125007` gzip bytes under `524288` / `131072`; gate-log SHA-256
  `17b771b7d26a52a4693233fa6e07968328b48efe0dc8fa479d197026df848445`.
  One prior run's desktop fetch hit a same-process Windows loopback
  `ETIMEDOUT` while another native test workload was active; the unchanged old
  tree reproduced it, native PowerShell and ten isolated reruns passed, and the
  final clean canonical run passed. No product source changed for that host
  artifact.
- Native Windows Chrome selected Pixi WebGL2 and retained all eight enemy
  families, eight projectiles, nine projectile effects, and exactly the
  `[pre-world-queue, world-sorted, post-world-queue]` auxiliary lanes. The
  controlled Imp edge remained `action=null`, `phase=flight`, dealt one damage,
  emitted `imp-vocal-4`, `bite-2`, then the attack marker, rerolled speed to
  `10.022587699466385`, turned to `93.8615826156456`, and rendered its two
  independent children. The reviewed contact crop changed 6,373 pixels /
  909,551 channel units. Page, console, and failed-response arrays were empty.
  Smoke-log SHA-256 is
  `26684248b2ff5c1c3cf0dd017facf5595c779d21eb822aef3437e49ddde9e14b`;
  reviewed compositor/contact image SHA-256 values are
  `d64aec0df5730aa544dd2287ff333d39c0dfce20317e16c1ffc209a147df9baa`
  and `b6139cd6f8f80700e07a9adaa4fdc4604f36e98a30a00c21fc88cc0ec19cb37d`.

This latest-base receipt supersedes the earlier publication proof. No
deployment was requested or performed.
