# 2026-08-25 — SkillScreen ambient seal motion correction (reopens corrective renderer closure)

## Reported smell and parity question

- Reported web behavior: the large seal behind the open Skill Book spasms
  laterally instead of visibly rotating.
- Reopen statement: the earlier corrective SkillScreen closure called the
  `0x0065B550` sine lane "presentation-local random seal jitter" and excluded
  that phase from structural comparison. Raw instructions contain no RNG in
  this loop. Rule skipped: the x87 callee and argument expression were not
  identified before an approximation was implemented; the validation contract
  captured settled stills but no temporal continuity.
- Stock behavior to recover: all eight UI-record-3 arc transforms, their
  screen-local phase clock, logical trim/pivot, fade, blend, order, construction
  reset, Hub/Boneyard consumers, and close teardown.
- Falsifiers: any RNG call or time-dependent x coordinate in the stock loop; a
  phase sourced from application/page time instead of the SkillScreen object;
  a non-centred logical pivot; member count or angular spacing other than eight
  at 45 degrees.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| User/current web | report above; Website `origin/main` `142826915`; `nativeSkillScreenSealJitter` | the web hashes `(floor(nowMs*0.06), index)` into `[0,40)`, producing a measured `33.7753 px` adjacent-60-Hz jump while rotation advances only `1 degree/s` | high-live |
| Instructions | retail 0.72.5 SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; root `0x0065B550`, loop `0x0065B6DB..0x0065B7B0` | loop angle `theta=0..315` by 45; x lane is `_CIsin(2*theta*pi/180)*40`; y is 490; rotation is `theta-(SkillScreen+0x28)/60`; no RNG | high |
| Instructions | `_CIsin 0x007470D0` (`FSIN` at `0x00747128`); vtable `0x0079F72C`; base tick `0x00427800`; ctor `0x006576C0 -> 0x00427370` | `+0x28` starts at zero and the vtable's `+0x20` base tick advances it at 100 Hz, so phase resets per screen and rotates at `100/60 degrees/s` | high |
| Static constants | `0x007DE918=.15`, `0x00784650=40`, `0x007849A0=60`, `0x007DE9A0=45`, `0x0078453C=360`, `0x007A0014=1.9` | exact alpha, sine amplitude, phase divisor, member step/bound, and scale | high |
| Asset/helper | UI record 3; `Text_Draw 0x00415130`; native UI manifest | logical `1024x768`, frame `211x94`, trim `(405,108)`; logical-centre rotation maps to Pixi `orig`/`trim` with anchor `.5` | high |

## System boundary and membership inventory

Native system: the SkillScreen root's eight-member additive ambient-seal
compositor from screen construction through opening, settled rendering,
closing, and destruction.

| Member (class/variant/scene/branch) | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| arc `theta=0` | loop row 0 | exact-ported | centre `(800,490)`, rotation `-T/60` |
| arc `theta=45` | loop row 1 | exact-ported | centre `(840,490)`, rotation `45-T/60` |
| arc `theta=90` | loop row 2 | exact-ported | centre `(800,490)`, rotation `90-T/60` |
| arc `theta=135` | loop row 3 | exact-ported | centre `(760,490)`, rotation `135-T/60` |
| arc `theta=180` | loop row 4 | exact-ported | centre `(800,490)`, rotation `180-T/60` |
| arc `theta=225` | loop row 5 | exact-ported | centre `(840,490)`, rotation `225-T/60` |
| arc `theta=270` | loop row 6 | exact-ported | centre `(800,490)`, rotation `270-T/60` |
| arc `theta=315` | loop row 7 | exact-ported | centre `(760,490)`, rotation `315-T/60` |
| record/trim/pivot/scale | UI 3; `0x00415130`; `0x007A0014` | verified-already-at-parity | native-UI texture preserves logical orig/trim; anchor `.5`; scale 1.9 |
| additive blend and alpha | `0x0065B677..0x0065B7EE`; `.15*p^9` | verified-already-at-parity | persistent ambient layer, per-sprite `.15`, root `p^9` |
| screen-local 100 Hz phase/reset | ctor/base tick/read above | exact-ported | pure transform tests at ticks 0/60/100/21600 and reopen reset |
| Hub SkillScreen consumer | shared `SkillBook` component/renderer | exact-ported | browser temporal receipt |
| Boneyard SkillScreen consumer | same actor-owned component/renderer | exact-ported | shared-source assertion; no scene branch |
| opening/settled/closing/teardown | `0x006567E0`, `0x006568E0`, common destruction | verified-already-at-parity | persistent sprites, fade contract, renderer destruction |
| SkillPicker ambient effects | separate `SkillPicker` renderer/factory | out-of-system (different owner/assets/motion) | existing picker suite unchanged |
| touch vs pointer help branch | overlay text only | out-of-system (does not branch root seal render) | `0x0065B550` has no input-mode predicate in the loop |

No member is blocked by the browser platform. The finite transforms and
screen-relative fixed tick are exactly representable.

## Native ownership thread

- Owner/construction: gameplay owns `SkillScreen*` at `+0x1664`;
  `0x005CA640 -> 0x006576C0` constructs it and resets inherited `+0x28`.
- Producer: common base tick `0x00427800`, reached through SkillScreen vtable
  `+0x20`, increments the local animation tick at 100 Hz.
- Consumer: root painter `0x0065B550` drains eight rows in source order before
  fixtures/field/overlay/pages/HUD/hover.
- State/lifetime: phase starts at zero per screen, advances through opening and
  settled state, continues while closing, and disappears with renderer teardown.
- Siblings: both gameplay scenes share the same actor-owned screen; no network
  authority or replicated state is involved because this is presentation-local.

## Recovered behavioral contract

- For `theta_i=45*i`, `i in [0,7]`, and screen tick `T`:
  `x_i=800+40*sin(2*theta_i*pi/180)`, `y_i=490`,
  `rotation_i=theta_i-T/60 degrees`.
- Every row uses UI 3, logical-centre pivot, scale `1.9`, additive blend, and
  alpha `.15*p^9`, where `p` is the existing open/close progress.
- X is invariant over time. Motion is a shared smooth clockwise phase; there
  is no randomness, frame hash, lateral jitter, or absolute page-time phase.

## Nearby-system findings

- `_CIsin 0x007470D0` is already identified durably elsewhere (`FSIN` at
  `0x00747128`); treating an untyped x87 helper as RNG was avoidable.
- Current still-image SkillScreen acceptance could not falsify temporal
  defects. The browser journey must sample multiple animation times and assert
  stable centres plus monotonic shared rotation.
- Native report updated: Mod Loader
  `docs/reverse-engineering/native-skill-screen-and-quickbar.md`.

## Confidence and open questions

- Confirmed: loop membership/order, complete formula, constants, callee
  identity, clock field/writer/reset, asset registration, blend/fade, and
  lifecycle.
- Inferred: none material.
- Unknown: none.

## Web implementation consequence

- Replace `nativeSkillScreenSealJitter(nowMs,index)` with one pure native
  transform function of `(index, screenTick)`.
- Capture renderer construction time before async resource loading, derive the
  elapsed 100 Hz screen tick, and apply all x/y/rotation values together.
- Keep persistent sprites, native texture registration, alpha, blend, scale,
  root painter order, and all non-ambient SkillScreen members unchanged.

## Validation contract

- Pure regression: all eight tick-0 transforms; centres invariant at multiple
  ticks; common `-1 degree` phase after 60 ticks; full `-360` after 21600;
  invalid index/tick rejection; no hash/RNG/jitter path remains.
- Browser: extend the real Skill Book journey to sample the open WebGL renderer
  over time, proving zero centre jumps, a shared monotonic phase in Hub, reset
  on reopen, unchanged interaction flow, and empty page/console/network errors.
- Mac gates: focused Skill Book group, complete `./scripts/validate.sh`, and
  Mod Loader static RE suite on byte-identical trees.

## Implementation validation receipt

- Corrected production owner: `skill-book-render-contract.ts` now exposes the
  eight-row native transform from `(index, screenTick)`, and
  `skill-book-renderer.ts` captures construction time before resource loading,
  advances the screen-local phase at 100 Hz, and updates the persistent sprites
  only when that tick changes. The former hash/jitter function and absolute
  page-time phase were removed; alpha, additive blend, scale, painter order,
  and teardown were left with their existing native contracts.
- Regression proof: the pre-edit Mac gate failed the new temporal assertion in
  both consumers (`0 ms`, arc 0 x was `22.420179015025496` instead of `800`),
  while the corrected pure suite proves all eight rows at ticks
  `0/60/100/21600`, phase reset, and rejection of the old jitter source.
- Browser proof on the Mac mini exercised the real Office-to-Hub and Boneyard
  flows. Hub samples advanced tick `50 -> 113` and shared phase
  `-0.833333 -> -1.883333 degrees`; Boneyard advanced `41 -> 71` and
  `-0.683333 -> -1.183333 degrees`. Every sample retained the exact centres
  `(800/840/800/760/800/840/800/760, 490)`, reopening produced a fresh local
  tick (`85`, below the first screen's final `113`), existing selector/audio/
  quickbar checks passed, and page, console, and failed-response arrays were
  empty. Six screenshots were retained in the acceptance evidence root.
- Full byte-identical Mac Website validation passed: 16 Node runs / 2,285
  tests / 0 failures, 23 Python contracts, oxlint 0 errors (the existing
  warnings remain), production build and media policy clean, and game entry
  `474,599` raw / `133,077` gzip bytes within budget. The byte-identical Mod
  Loader static RE suite passed 503/503.
- Evidence root:
  `/Users/jarrett/codex-acceptance/skill-book-seal-motion-20260825/evidence/`.
  Unknowns/platform differences: none. Publication is pending the final
  fetch/rebase, repeated exact-tree gates, and fast-forward proof; deployment is
  separate and was not requested.
