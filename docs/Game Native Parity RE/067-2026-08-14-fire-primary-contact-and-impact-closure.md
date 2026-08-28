# 2026-08-14 — Fire primary contact and impact closure

## Reproduction and parity question

- Fresh current-`origin/main` Hub reproduction on owned Vite `5417` returned
  `status: ok`, one `fire` projectile, 26 separately replicated
  `fire-particle` views, and `throw-fire`. The inspected 1600x900 WebGL frame
  shows the recovered layered body and trail, so the reported “missing
  Fireball VFX” is not an asset-loading failure.
- The causal defect at this baseline was authoritative lifecycle:
  `stepPrimarySpells` consulted world collision only for Earth. Fire always
  moved, emitted a trail, crossed terrain, and was silently deleted by the
  500-tick PoC containment rule. It could never publish the stock contact
  replacement or `fireballhit` event.
- This pass therefore reopens the complete Fire thread: targeting and range,
  cast/recast ownership, birth clipping, flight and collision order, contact
  replacement, render/light/audio ownership, and the Enhanced Effects branch.

## Pinned evidence and corrected native contract

Every address below was re-read through a read-only/no-analysis Ghidra replica
of the 4,723,200-byte retail `SolomonDark.exe`, SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`.

| Native owner | Instruction-backed contract | Confidence |
| --- | --- | --- |
| Staff Cast 1 `0x0044B170` / `0x0044B370`, PlayerWizard marker callback `0x00550180` | Float32 base rate is `0.075`; neutral cast-speed helper `0x00656580` returns one and Fire alone applies double `0.75`, yielding `0.05625` progress/tick. From action insertion, Fire crosses the marker on update 18, crosses strict end on update 72, and becomes next-ready on update 73. One marker dispatch occurs per occupied action; a still-held primary level queues the next action after the prior ends. Fireball skill 16 has no `mCooldown`, so this action program is the default repeat cadence. | high |
| Fire handler `0x0053DC60` | Samples actor heading `+0x6C`, creates type `0x7D4` at Staff emitter plus `(0,+10)+20*D`, and stores immutable unit direction. No target lookup, retained target, homing, spread, or range comparison exists. After registration it segment-tests player root to spawned root with mask `0x700`; a blocked birth contacts immediately at the spawned root before any trail child exists. | high |
| Fireball tick `0x005FDD90` | At `age % 5 == 0`, segment-tests current `P` through `P+5*(4.5*D)` before movement. Terrain failure contacts at current `P` and returns before trail birth. Otherwise common tick moves `4.5*D`, then the current-cell actor query uses radius 20/mask 6. Accepted actor contact falls through to one final cosmetic particle. No hard lifetime exists. | high |
| Contact `0x005E5160` | Eligible actor contact owns damage/status/upgrade branches; null terrain contact skips those. Both paths call the Fireball removal vslot first, then request registry 30 `sounds\\fireballhit` at point gain with pitch on inclusive `[0.9,1.1]`, and create `Anim_FireBurst` at `(P.x,P.y-10)`. | high |
| Burst `0x00453470` / `0x00457540` / `0x004575B0` / `0x0045E2D0` | Registered `BadGuys[251..254]`; exactly 16 visible ages `0..15`, four ticks/frame; moves up one unit/tick; scale on inclusive `[1,1.1]`, rotation on inclusive `[0,360]`, signed angular speed magnitude on inclusive `[0.5,1.5]` degrees/tick. Draw order is source-over record 110 orange core then additive impact frame tinted `(1,1,0.75)`. | high |
| `ZAnimLit` `0x005E03D0`, vtable `0x0079C4DC`, tick/light `0x005FD1D0` / `0x005E48E0` | Render slot `+0x0C = 0x005E01E0` directly dispatches the child, so the burst is self-lit for inbound Region tint. It independently emits a moving-position light at radius 1.5 and intensity `1-0.04*age`, Multiple Shadows false, depth bias 50. | high |

The exact native hit WAV is 30,530 bytes, SHA-256
`9bfad709cfb932b7e836c58f781a42ee78907a0211bac5d14a2583d721192738`.
The fresh base-animation trace corrects the earlier approximate “16--17 tick”
statement: phase increments by `0.25` and deletion occurs as soon as phase
reaches descriptor count four, giving exactly ages 0 through 15.

## Ownership, order, and adjacency

```text
accepted or held-repeat Fire action
  -> Staff Cast 1 marker at insertion-relative update 18
  -> Fire handler and initial player-root -> spawn-root segment clip
       blocked: remove Fireball -> fire-impact + fireballhit (no trail)
       clear: Fireball enters world
  -> every fifth pre-move age: P -> P + 5 velocity terrain segment
       blocked: remove Fireball -> fire-impact + fireballhit (no final trail)
  -> move 4.5 along immutable cast direction
  -> actor candidate contact (future combat-authority slice)
       accepted: remove Fireball -> fire-impact + fireballhit + one final trail
  -> successful tick: one authoritative cosmetic fire-particle birth
```

The flight child still uses the shipped Enhanced Effects-on decrement
inclusive `[0.025,0.05]` and one child per successful tick. The off branch is
inclusive `[0.05,0.10]` with unchanged cadence. The contact burst has no Enhanced
Effects branch. `Fire_Goodguy`, Ember/Explode upgrades, area damage, and status
payloads remain distinct actor/gameplay systems and are not visual substitutes.

## Implementation boundary and falsifiers

- Replace the silent terrain-crossing lifecycle with authoritative segment
  checks and a distinct replicated `PrimarySpellFireImpactState`. A stable
  event id owns the immutable contact root and deterministic projection of
  native cosmetic distributions; renderer snapshots may never infer missed
  impact births from a vanished Fireball.
- Initial obstruction and every-fifth-tick terrain obstruction produce the
  semantic replacement at the native Fireball root. They do not produce a
  flight particle. A plain containment expiry must never emit hit VFX/audio.
- Add exact 251..254 extraction, a dedicated two-pass impact view, self-lit
  painter root, moving outbound Boneyard light, and point-attenuated stock hit
  cue with deterministic `[0.9,1.1)` pitch projection.
- Preserve Fire's straight aim, speed 4.5, marker update 18, next-ready update 73, held
  requeue, no range cap, and no configured cooldown. Shared Staff cadence is
  root-owned; this Fire contact slice must not invent a second timer. Do not add
  targeting, homing, or an arbitrary “blast radius.”
- At this pass, the Website wave-enemy model published positions but no native body
  radius/category/contact flags or HP/damage authority. Actor contact remains
  explicitly bounded instead of guessing from those points; terrain contact is
  the instruction-backed presentation closure in this slice.
- Regressions must pin blocked-birth ownership, age-0 and age-5 terrain probe
  order, absence/presence of the final trail on terrain/actor-shaped paths,
  exact 16-tick burst frames/recurrence, protocol/interpolation identity,
  self-lit inbound and outbound-light separation, hit-audio de-duplication,
  and one-shot recast edges. Real Hub and Boneyard WebGL receipts must show the
  flight body/trail and the terrain-owned replacement respectively.

## Focused implementation and handoff receipt

- The authoritative kernel now performs the handler birth segment and the
  every-fifth-age pre-move lookahead, removes the PoC 500-tick retirement for
  Fire, and emits a stable `fire-impact` semantic replacement on terrain
  contact. The impact has an exact 16-tick protocol lifetime; snapshot copy and
  interpolation own its immutable contact root. Actor contact remains bounded
  as documented above.
- Dedicated Fire presentation now projects registered records `251..254` as
  the ordered source-over core/additive burst, moves the child one unit upward
  per tick, uses depth bias 50, refuses inbound Region tint, and exposes only
  the independently owned radius-1.5 fading Boneyard light. The extracted
  320x80 strip is SHA-256
  `0110a11af20da5053e63f0b0563e9deb2fa6ab63cf846e60645a13869271093d`.
- Contact audio is a new-event consumer, not a projectile-disappearance
  heuristic. It uses exact stock registry-30 WAV SHA-256
  `9bfad709cfb932b7e836c58f781a42ee78907a0211bac5d14a2583d721192738`,
  point attenuation, deterministic native-range pitch, de-duplication, and
  initial-snapshot suppression.
- Focused deterministic coverage passed 74/74, including the exact
  audio-manifest assertion. Both application and test TypeScript builds
  passed. Frontend lint and game
  architecture boundaries passed with only the repository's existing Fast
  Refresh warnings, and the full production frontend/game-host build completed.
- The owned pre-fix Hub WebGL baseline is
  `/tmp/sdr-fire-vfx2-baseline-20260814.1Zwlh7/solomon-primary-fire-hub.png`,
  1600x900, SHA-256
  `f095a08ac3755d7914db21d1bcaf6c01e950ce3cd8c5618c55e211eb82f09959`.
  It proves the recovered body/trail was already present and isolates the
  missing contact replacement.
- On the rebased five-element tree, the isolated Hub journey rendered one
  Fireball with 10 independently owned trail children and observed both
  `throw-fire` and `fireball-hit`. The Boneyard boundary journey then published
  a projectile-free `fire-impact` at age nine and the stock hit cue, with no page
  errors. The inspected impact capture is
  `/tmp/sdr-primary-vfx2-rebased-20260814/solomon-primary-fire-boneyard-impact.png`,
  SHA-256 `d34a904bbdcc629f1046db05619a04a701975c309a6b3da699c89411210e83ef`.
