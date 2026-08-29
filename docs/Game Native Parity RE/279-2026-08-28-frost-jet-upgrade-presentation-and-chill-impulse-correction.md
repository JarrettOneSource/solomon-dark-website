# 2026-08-28 — Frost Jet upgrade presentation and Chill impulse correction

## Reported smell and parity question

- Reported web behavior: Frost Jet does not visibly respond to Chill Wind or
  Cone of Ice, and Chill Wind pushes enemies far enough away to make combat
  difficult.
- Reproduced `origin/main` cause: Water transients always emit exactly two
  particles at speed four. The host feeds authored Chill percentages directly
  into a handler formula that expects a normalized factor, and it feeds the
  authored Cone width directly into formulas that expect the native cached
  half-width.
- Stock behavior to recover: the complete pure-Water rows 32..34 path from
  authored rank refresh through held emission, actor/projectile contact,
  replicated transient state, renderer, release, and expiry.
- Falsifiers: any Cone rank retaining rank-one density/speed; any authored
  Chill value used without its upstream `0.01` cache store; any Cone geometry
  using authored `mWiden` where the handler reads cached half-width; or an
  invented Chill-only Frost sprite would disprove parity.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | `SolomonDarkAbandonware/SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Same retail 0.72.5 image as the prior Frost closure. | high |
| Instructions | canonical Ghidra 12.0.3 project `SolomonDark/SolomonDark.exe`, read-only replica; refresh `0x00548B00`, stores `0x00549CCF`/`0x00549D30`, handler `0x00543860`, movement helper `0x00525800` | Cone authored width is multiplied by `0.5` before player `+0x290`; Chill authored percent is multiplied by `0.009999999776482582` before player `+0x294`; the handler consumes those cached fields. | high |
| Instructions | Frost creation loop `0x005439D0..0x005440AE`, projectile callback `0x0054420A..0x00544229`, actor push `0x005444E1..0x0054473B` | Cached Cone width controls particle count, speed, aperture, and reach. Cached Chill factor controls Arrow accumulation and immediate collision-aware actor displacement. | high |
| Authored data | `native-skill-catalog.json` rows 32, 33, and 34 | Complete Chill percent rows are `0,10,...,100`; complete Cone width rows are `0,30,50,70,80,90,100,110,120,130,140,150`. | high |
| Web baseline | `origin/main` `05f2232a`; `primary-spells.ts`, `primary-spell-water.ts`, `native-primary-skill-profile.ts`, `boneyard-spell-combat.ts`, protocol 98 | Fixed count/speed omit Cone presentation; raw `pushbackPercent` makes actor displacement and Arrow accumulation 100 times stock; raw Cone geometry is twice the native delta. | high |

The native reusable correction is recorded first in Mod Loader
`docs/reverse-engineering/native-projectile-and-spell-mechanics.md`,
`docs/reverse-engineering/native-skills-and-spells.md`. This reopens the 2026-08-15 Water
`exact-ported` disposition because that pass followed the handler downstream
but skipped its upstream refresh writers.

## System boundary and membership inventory

Native system: pure player Water primary rows 32..34, from rank-derived cached
scalars through Frost visual birth and actor/projectile contact to presentation
expiry and release. Learned Water rows 35..39 and welded spell classes retain
separate owners.

| Member | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Frost Jet row 32, ranks 1..25 | `0x00543860`, row 32 damage/mana arrays | `verified-already-at-parity` | held cadence, Normal/Over art, damage/cold, audio, release, and expiry remain unchanged |
| Chill Wind row 33, ranks 0..10 | refresh store `0x00549D30`, actor branch `0x005444E1..0x0054473B` | `exact-ported` | every authored percent maps to float32 factor and near/attenuated displacement |
| Chill projectile callback | `0x0054420A`, Arrow vslot `0x005E5EC0`, flags `0x80/0x1000` | `exact-ported` | rank-one accumulation does not tumble before contact 32; retirement owns SpinAway |
| Cone of Ice row 34, ranks 0..11 | refresh store `0x00549CCF`, handler particle/query loop | `exact-ported` | all 12 authored rows pin cached width, count, speed, half-aperture, and reach |
| Normal Frost transient | ctor/update/render `0x00453550`/`0x00453670`/`0x00457720` | `exact-ported` | rank speed is snapshotted; wall splay and ZAnim ownership remain exact |
| Over Frost transient | ctor/update/render `0x00453840`/`0x00453670`/`0x00457A00` | `exact-ported` | rank speed is snapshotted; direct late-manager ownership remains exact |
| Enhanced Effects On | handler count divisor `-10`, shipped default | `exact-ported` | counts across Cone rows are `2,4,5,6,6,7,7,8,8,9,9,10` |
| Enhanced Effects Off | handler count divisor `-20` | `verified-already-at-parity` as documented product branch | Website still has no settings owner; shipped-default On remains the active browser policy |
| Underpowered Water | `0x005438EC` weak reset and quarter-count branch | `exact-ported` | one Normal particle at speed four, aperture 30, reach 205, mask 2, no push/tumble |
| Hail per-particle visual gate | row 38 branch in `0x00543860` | `exact-ported` | every created Cone-expanded Frost child consumes its own Hail allocation test; gameplay Hail remains separately verified |
| Hub and Boneyard presentation | Frost manager registration and common primary renderer | `exact-ported` | host authors every child; protocol carries its speed; both scenes render the same state |
| Save/resume during active Frost or Arrow state | authoritative slot-0 simulation checkpoint | `exact-ported` | schema 19 requires new state; schema 18 migrates Water speed to four and Arrow accumulation to zero |
| Firebolt/GuidedMissile flag `0x100` | constructors adjacent to Arrow `0x005E1000` | `out-of-system` — callback excludes them | negative actor-mask test |
| Cold Aura, Ring of Ice, Permafrost, Harden | rows 35..39 excluding Hail's per-child gate, and their distinct actors/modifiers | `out-of-system` — no shared cached width/push consumer | existing learned-Water closure remains authoritative |
| Steam, Blizzard, Frost Missile, Hailstones | welded handlers/classes | `out-of-system` — normalized weld-vector ABI owns their fields | existing spell-welding report and tests remain authoritative |

No member is blocked by the browser platform and no native authored row is
left unextracted.

## Native ownership thread

- Player refresh `0x00548B00` is the upstream owner. It writes
  `W=float32(authoredWiden*0.5)` to player `+0x290` and
  `Q=float32(authoredPushback*0.009999999776482582)` to `+0x294`.
- Dispatcher `0x00548A00` is the sole direct caller of pure-Water handler
  `0x00543860`. Each accepted held tick snapshots presentation velocity into
  independent Normal/Over actors and performs one immediate target query.
- Normal and Over share update `0x00453670` but retain different manager/draw
  lanes. Existing children finish their 32..33-tick visual lives after release;
  gameplay contact stops immediately with held input.
- Eligible actor roots receive collision-aware movement through `0x00525800`.
  Eligible Arrow-family projectiles accumulate their target-owned callback
  scalar until their own retirement threshold; the Frost particle is never the
  gameplay collision owner.
- Authority owns rank resolution, child count, speed, obstruction snapshot,
  push, Arrow accumulation, and IDs. Clients render replicated semantic state
  and do not reconstruct current rank from the owner after birth.
- Schema-19 checkpoints persist transient speed and Arrow accumulation. A
  schema-18 Water child was necessarily born on the old fixed-speed path and
  therefore migrates to speed four; any old Arrow surviving a checkpoint had
  not crossed the old immediate-tumble contact and therefore migrates to zero.

## Recovered behavioral contract

For authored Cone width `A` and authored Chill percent `P`:

```text
W = float32(A * 0.5)
Q = float32(P * 0.009999999776482582)

halfAperture = 15 + W/2
reach = 205 + 4*W
speed = 4 * (1 + (W/2.5)*0.05)
shippedCount = 1 - trunc((W + 15)/-10)
phase[0] = float32(worldTick)
phase[n+1] = float32(phase[n] + float32(65/shippedCount))

nearPush = 2.5*Q
outerSquared = 0.75*(180 + 4*W)^2
innerSquared = 0.5*outerSquared
arrowGain = float32(Q*0.3199999928474426)
```

- Between the inner and outer squared thresholds, push uses the linear
  squared-distance taper. At/beyond outer it is zero; target flag `0x40`
  multiplies by float32 `0.1`.
- The complete Cone table produces speeds `4,5.2,6,6.8,7.2,7.6,8,8.4,8.8,
  9.2,9.6,10`, half-apertures `15,22.5,27.5,32.5,35,37.5,40,42.5,45,
  47.5,50,52.5`, and reaches `205,265,305,345,365,385,405,425,445,465,
  485,505`.
- The complete Chill table produces near-contact movement `0,0.25,...,2.5`
  per held tick before attenuation and applicable push-strength modifiers, not
  `0,25,...,250`.
- Chill Wind has no distinct Frost sprite, tint, particle class, density, or
  speed in stock. Its visible feedback is controlled enemy movement and the
  eventual Arrow SpinAway. Cone of Ice owns the visible stream expansion.

## Nearby-system findings

- The same missed cache boundary made Cone gameplay twice the native delta:
  current web `15+A/2` and `205+4A` must become `15+A/4` and `205+2A`.
- Shared movement helper `0x00525800` has 32 direct call sites. Only its pure
  Water caller is in-system; changing the helper or welded scalar semantics
  would be an unrelated regression.
- Native report also updated: the Mod Loader Water/Frost reports own the
  reusable cache-store, particle, geometry, and contact facts without changing
  the live-capture configuration provenance.

## Confidence and open questions

- Confirmed: upstream cache stores and operand widths, complete authored rows,
  particle count/speed, cone geometry, actor taper/movement, Arrow callback,
  Normal/Over ownership, weak branch, and lifecycle.
- Inferred: none material to implementation.
- Unknown: none. The exact retail RNG word sequence remains intentionally
  outside this deterministic-web identity policy and does not affect the
  corrected rank mapping.

## Web implementation consequence

- Replace the raw Water profile fields with explicit native cached
  `widenHalfDegrees` and `pushbackFactor` values. Derive gameplay geometry and
  both contact branches from those fields so the falsified raw-scalar
  assumption disappears everywhere.
- Derive shipped Frost particle count and birth speed from cached Cone width.
  Snapshot speed on each authoritative transient, use it for obstruction and
  iterative motion, carry it through strict protocol 99, and allow every
  authored per-tick ordinal through nine.
- Expand the Hail visual-allocation sweep from the rank-one pair to every child
  emitted by the current Cone count; do not change its target/gameplay branch.
- Bump the save schema to 19 and perform the lossless schema-18 migration above;
  current documents missing either authoritative field must fail closed.
- Keep Chill from inventing a particle variant. Retain actor movement and Arrow
  SpinAway as its stock feedback, now at normalized strength.
- Preserve underpowered Water, existing Normal/Over renderer passes, audio,
  Hail/Aura ownership, release, and expiry.

## Validation contract

- Focused kernels: drain every Cone row and assert cached width, count, speed,
  half-aperture, reach, per-ordinal phase, and rank-speed iterative motion;
  preserve rank-one, weak, Normal/Over, obstruction, and expiry cases.
- Combat: drain every Chill row at near range, inner/outer/taper boundaries,
  flag `0x40`, push-strength modifier, and blocked movement; prove rank-one
  Arrow survives 31 contacts and tumbles on 32 while weak Water never pushes.
- Protocol/presentation: strict protocol 99 requires bounded speed `4..10`,
  accepts ordinals `0..9`, rejects incompatible/malformed values, and preserves
  speed through interpolation/copy and local/observer state.
- Save lifecycle: schema 19 round-trips live speed/accumulator state, schema 18
  restores the exact historical defaults, and malformed schema-19 omissions or
  out-of-range values fail closed.
- Browser journey: in one real Boneyard run compare base Frost against Cone
  rank 11 at the same held interval, measuring live child count, maximum
  ordinal, speed, and visible plume; exercise rank-one Chill accumulation and
  replicated/rendered Arrow SpinAway. The focused combat contracts own exact
  actor displacement. Capture page, console, failed-response, and protocol
  errors.
- Canonical gate: the byte-identical rebased candidate passes
  `/opt/homebrew/bin/bash ./scripts/validate.sh` on the Mac mini.

## Implementation validation receipt

- Implementation: `native-primary-skill-profile.ts` now owns cached
  `widenHalfDegrees`/`pushbackFactor`; `primary-spells.ts` and
  `primary-spell-water.ts` own dynamic birth count, iterative float32 phase,
  snapshotted speed, obstruction, and Normal/Over motion; Boneyard combat/store
  own normalized actor movement and persistent Arrow accumulation. Protocol 99
  carries speed/ordinals, schema 19 persists the new authority with an exact
  schema-18 migration, and the backend inspector accepts the same version.
- Candidate identity: rebased Website base
  `e3eff7b4152c0709aeee107dd366236bf63e077c`, rebased Mod Loader base
  `32682cdfec09044d97f673332486917b6e1a6ae8`; local and Mac changed-file
  manifests were byte-identical before every validation run. The retained Mac
  worktrees are under
  `/Users/jarrett/codex-acceptance/frost-stream-upgrades-20260828-root-r2/`.
- Native/static gate: Mac arm64 `python3 tests/re/run_static_re_tests.py --ci`
  passed `525/525`. Its stdout SHA-256 is
  `02f52eba693ed6d4f5d41098d442b2ace4b06c0e88959e9c4b003a13363ce616`.
- Website gate: the complete Mac gate passed after implementation, including
  backend build/integration, formatting/lint, all frontend and desktop suites,
  production build, bundle budget, and media policy. The rebased pre-receipt
  stdout SHA-256 is
  `dfc5c2bcb7798ea304b6e7e6aa0c2731e59bb86ac4d30e6d98442f9fb775e183`.
  After this receipt joins the candidate, the exact final tree repeats
  `/opt/homebrew/bin/bash ./scripts/validate.sh`; that final hash belongs in
  the task handoff rather than recursively changing this document again.
- Browser environment: macOS `26.6.2`, arm64, Google Chrome
  `151.0.7922.174`, production frontend, protocol 99. The final deterministic
  Boneyard journey returned `status: ok` with empty page/console errors,
  failed responses, and wire errors; its stdout SHA-256 is
  `4dcee1d8329e2d5e845b39d851eb75566696612865e67a89cc9550696d386c71`.
- Frost/Cone visual proof: base birth IDs `7,8` had variants `0,1` and speeds
  `4,4`; after the matched 120 ms hold the renderer owned 24 live particles.
  Cone rank 11 birth IDs `149..158` had variants `0..9` and ten speed-`10`
  children; the matched frame owned 130 live particles. Visual inspection
  confirms a short cyan-white base spray versus the denser, longer Cone plume.
- Chill proof: rank-one Arrow state retained accumulator
  `0.9920001029968262` before strict-threshold retirement; the final effect was
  BadGuys record `2`, alpha `5.900390625`, replicated on the wire and rendered
  as effect ID `1`. Focused contracts separately prove contacts 1..31 retain
  the Arrow and contact 32 creates SpinAway, every authored push row maps to
  `0..2.5` near displacement, squared-distance taper/flag/collision branches,
  and Firebolt/GuidedMissile exclusion.
- Visual evidence under
  `/Users/jarrett/codex-evidence/frost-stream-upgrades-20260828-root-r2/`:
  base Frost
  `67b5b652a48c703e6353ef1913e4037cbfd4ab418e980a97d28bc151d21d6a8a`,
  Cone rank 11
  `0997a6fc47092306e4dde2b94c01de8810708ed553e8ef9995b743b53a7c4403`,
  and Arrow SpinAway
  `9f2bade19979d807ec6bc9a745266fbb5dba45e98148450efeffb416f87b7c04`.
- Browser constraints, inferred implementation facts, and remaining in-system
  omissions: none. Publication and deployment remain separate receipts; this
  entry records the pre-publication candidate.

## 2026-08-28 — reopened Frost visual-heading amplitude and x87 recurrence

### Reported smell and parity question

- Reported web behavior: Frost Jet upgrades still do not affect the stream VFX
  correctly, and the stream is missing native math that gives stock its shape.
- Reproduced current behavior: base Frost and Cone rank 11 both cap their born
  heading offset at approximately one degree. Cone changes only density and
  speed, leaving the plume nearly axial.
- Stock behavior to recover: the complete heading producer shared by Normal,
  Over, underpowered, and Hail-allocating Frost births, including the cached
  Cone operand, mutable phase, x87 float stores, direction helper, and rank
  refresh owner.
- Process failure in the earlier closure: the prior pass treated raw stack
  offsets as stable across branch-local `PUSH` instructions. It therefore
  resolved the heading multiply to the player-stat result at pre-push stack
  `+0x68`. Both branches actually resolve to the cached `W + 15` value at
  pre-push stack `+0x64`. The earlier browser proof asserted count and speed but
  never measured born direction, so it could not falsify the one-degree path.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | `SolomonDark.exe` 0.72.5, 4,723,200 bytes, preferred base `0x00400000`, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` | Same retail image as the preceding Water closures. | high |
| Raw instructions | canonical Ghidra 12.0.3 replica; handler `0x00543860`; operand store `0x0054394F..0x00543959`; Over heading `0x00543A86..0x00543AD6`; Normal heading `0x00543BA3..0x00543C5C`; Hail child heading `0x00544002..0x0054405D`; direction helper `0x00410500`; Mod Loader tool revision `08bfba9ef367f7b863848030d0a289dc31e33192` used read-only | `float32(player+0x290 + 15)` is stored at pre-push stack `+0x64`. Over pushes once before `FMUL [ESP+0x68]`; Normal pushes twice before `FMUL [ESP+0x6C]`; both therefore multiply by that same `W+15` value. Hail repeats the one-push form. | high |
| Raw instructions | `0x00543895..0x005438B3`, `0x00544258..0x00544262` | The `FUN_00656580(class=3)` result stored at pre-push `+0x68` is the Water damage multiplier later applied to `player+0x28C`. It is not a visual cast-speed amplitude. | high |
| Direction helper | `0x00410500..0x0041054C` | Heading is passed in degrees. The helper float32-stores `piFloat*heading/180`, then float32-stores `sin` and negative `cos`. | high |
| Injected-loader diagnostic | task-owned PID `5520`, image base `0x00410000`, preferred/runtime trace target `0x00453800 -> 0x00463800`, Lua pipe `SolomonDarkFrostJet20260828Root`; loader DLL SHA-256 `43a87f813813d570521558f4880593d560f3a0d88824ba3ba2724ae2f321639f` | At cached width `W=0`, 256 constructor hits spanned `-15.000000..+15.022354` degrees around a steady aim; exact endpoints `-15/+15` recurred. After progression row 34 active/visible rank was set to 11, refresh held `W=75` and 256 hits spanned `-89.999954..+90.000000`. Normal runtime vtable was `0x00794E84` and Over was `0x00794EB4`, the same `+0x10000` ASLR delta as the traced function. | high supporting diagnostic |
| Existing semantic/live ledger | read-only `docs/lua-memory-tooling.md`, April 29 Water trace | Level-one query observed total cone `30`, range `205`, and `actor+0x290=0`; the recovered field was already identified as the upgraded width owner. | high for query/cache ownership |
| Current web differential | Website `5257a20ee62b95f4e4087de15637c348bb599ad1`; Mac arm64 direct kernel import | Across 100 ticks, both `W=0` and `W=75` maxed at `1.000000053` degrees. The instruction-derived stock envelopes were `15` and `90` degrees. | high |
| Current browser baseline | isolated Mac Chrome Boneyard Chill/Cone journey; base screenshot SHA-256 `ca6732c264daae6485ff50883bb086d18d1c92fd7b93d12a13f93c1ff6d9761e`; Cone screenshot SHA-256 `925b22755e4bbc740ff5eeb24d28da43dadc8a4c939fd2ee50fe9eb067d6185e` | Rank 11 is denser and longer but remains a narrow axial beam. The journey had no page, response, wire, or console errors. | high for current pixels |

The live run was diagnostic rather than clean stock because the loader owned
the trace. Material conclusions are independently instruction-derived. The
task altered only the disposable run's row-34 rank/cache, restored both rank
fields to zero, disarmed the trace, and stopped the exact task process.

### System boundary and membership inventory

Native system: pure player Water rows 32..34 from rank refresh into the shared
Frost heading producer, Normal/Over construction, optional Hail child velocity,
replication, rendering, release, and expiry.

| Member | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Frost Jet row 32 | handler `0x00543860` | `exact-ported` | base `W=0` envelope is exactly `+/-15` degrees; existing damage, mana, cold, audio, and lifetime remain unchanged |
| Chill Wind row 33 | cache `player+0x294`, contact branch | `verified-already-at-parity` | no invented Frost sprite/math; normalized push and Arrow tumble contracts remain green |
| Cone of Ice row 34, ranks 0..11 | refresh `0x00549CCF`, handler stack `+0x64` | `exact-ported` | all 12 cached widths own amplitudes `15,30,40,50,55,60,65,70,75,80,85,90` degrees in addition to existing density/speed/query effects |
| Normal Frost | ctor `0x00453550`, vtable `0x00784E84` | `exact-ported` | raw Normal branch and live vtable/endpoint trace |
| Over Frost | ctor `0x00453840`, vtable `0x00784EB4` | `exact-ported` | raw Over branch and live vtable/endpoint trace |
| Underpowered Frost | weak reset `0x005438EC` | `exact-ported` | forced `W=0`, one Normal child, native `+/-15` degree amplitude |
| Hail per-Frost allocation child | `0x00543F02..0x005440A0` | `exact-ported` | Hail horizontal velocity inherits the corrected Frost direction for every Cone-expanded child |
| Enhanced Effects On | count divisor `-10` | `verified-already-at-parity` | existing all-row count table remains exact; direction coverage is added |
| Enhanced Effects Off | count divisor `-20` | `verified-already-at-parity` as documented product branch | no Website setting owner; exact phase math remains parameterized by count |
| Hub and Boneyard | common authoritative transient producer/renderer | `exact-ported` | both scenes consume the same born direction and painter lanes |
| Multiplayer observer | existing Water transient direction field | `verified-already-at-parity` | strict protocol already carries the authoritative unit direction; no rank reconstruction or protocol bump |
| Save/resume | existing Water transient direction snapshot | `verified-already-at-parity` | no new persistent field or migration; live children retain their born direction |
| Water+Air Blizzard | `0x00541870` | `out-of-system` — separate welded handler/class | existing welded Frost contract |
| Fire+Water Steam | `0x00542D20` | `out-of-system` — separate Steam actors and scalars | existing welded Steam contract |
| Other `0x00453800` / `0x00641B10` callers | `0x00643CA0`, `0x005F6410`, `0x005F3B50` | `out-of-system` — shared direction/query utilities without pure-Frost cache ownership | xref census and focused negative coverage |

No member is blocked by the browser platform.

### Native ownership thread and corrected contract

- Player refresh owns `W=float32(authoredWiden*0.5)` at `player+0x290`.
  A one-shot live cache write is overwritten on the next refresh; changing row
  34 rank makes the refreshed value persist. Presentation must therefore take
  the profile's cached width, not a renderer-local rank lookup.
- `0x0054394F..0x00543959` computes
  `amplitude=float32(W+15)`. The same mutable float32 phase feeds Normal, Over,
  and Hail construction.
- The exact heading recurrence is:

```text
phase[0] = float32(worldTick)
phaseStep = float32(65 / particleCount)
phase[n+1] = float32(phase[n] + phaseStep)
phaseDegrees = float32(phase[n] * 65)
phaseRadians = float32(phaseDegrees * piFloat32 / 180)
wave = float32(sin(phaseRadians))
amplitudeDegrees = float32(W + 15)
headingDegrees = float32(casterHeadingDegrees + wave * amplitudeDegrees)
directionRadians = float32(piFloat32 * headingDegrees / 180)
direction = (float32(sin(directionRadians)), float32(-cos(directionRadians)))
```

- Birth jitter remains independent: radius `U[0,10]` along caster heading plus
  signed `U[0,45]` degrees. Cone width does not widen the jitter origin.
- Existing Cone count, speed, gameplay half-angle, reach, contact, and Chill
  formulas remain correct. This reopening changes only the falsified visual
  heading model and its inherited Hail velocity.
- Authority snapshots the resulting unit direction on every child. Clients
  interpolate/copy it and never recompute the phase or current rank.

### Web implementation consequence

- Pass cached `widenHalfDegrees` into the authoritative Water birth helper.
- Replace the rank-independent one-degree radian multiplier with the recovered
  degree-space amplitude and intermediate float32 stores above.
- Run birth jitter through the same degree-to-direction helper so both stock
  heading paths share the recovered `0x00410500` recurrence.
- Preserve every existing count, speed, obstruction, class split, painter,
  audio, contact, protocol, save, and teardown branch. No schema or protocol
  change is warranted.
- Extend the existing browser proof to measure born angular offsets; count and
  speed alone are no longer an acceptable Frost/Cone visual receipt.

### Validation contract

- Focused Water kernel: base and underpowered emissions hit the 15-degree
  envelope; all 12 Cone rows pin amplitude, phase recurrence, and representative
  float32 direction words; radial jitter remains within the independent
  10-unit/45-degree bounds.
- Spell integration: every Cone row continues to pin count/speed and now also
  pins each born direction against its cached width; interleaved casters retain
  the common world phase.
- Hail: a successful per-child allocation inherits the corrected Frost unit
  direction without changing RNG order.
- Browser: the real Boneyard base cohort stays within `+/-15` degrees and max
  Cone reaches the `+/-90` degree envelope while retaining ten speed-10
  children, Normal/Over rendering, clean diagnostics, release, and expiry.
- The exact candidate must pass focused tests and
  `/opt/homebrew/bin/bash ./scripts/validate.sh` on the isolated Mac worktree.

### Implementation validation receipt

- Implementation: `primary-spell-water.ts` now receives the authoritative
  cached width, reproduces the degree-space phase/amplitude and float32
  direction-helper stores, and keeps radial jitter on its independent
  45-degree/10-unit lane. `primary-spells.ts` passes the cached width at birth;
  existing replicated direction, Hail inheritance, renderer, collision,
  protocol, save, and teardown owners remain unchanged.
- Regression coverage: `primary-spell-water.test.ts` first failed at the exact
  reported seam (`1.000000053` degrees instead of `15/90`), then passed all 19
  Water contracts. The rebased focused system run passed `141/141`, covering
  every Cone width, Normal/Over and underpowered construction, Hail inheritance,
  spell integration, contact, and Chill branches.
- Candidate identity: pre-receipt Website validation base
  `6d71222742ef6a28d30d2be2b06fcf8bf9064028`; focused pre-receipt commit
  `6de9084ac36133acbf1618e2058fe8cb55d502a0`. The detached Mac worktree at
  `/Users/jarrett/codex-acceptance/frost-jet-vfx-math-20260828-root-r2/`
  contained the same five-file patch; every changed-file SHA-256 matched the
  local candidate before validation.
- Complete Mac gate: macOS `26.6.2` arm64 passed
  `/opt/homebrew/bin/bash ./scripts/validate.sh`, including backend build and
  integration, formatting, lint/import boundaries, generated-content checks,
  all frontend and desktop suites, type checks, production frontend/game-host
  builds, bundle budget, and media policy. The 17,013-line stdout SHA-256 was
  `47ec5f0ffc0b33070d4dd198886e4d14a2b4a4ef1291aae73287b3227862fe77`.
- Production browser environment: Google Chrome `151.0.7922.174`, production
  frontend, isolated Boneyard host. The journey returned `status: ok` with
  empty page errors, failed responses, and wire errors; stdout SHA-256
  `a936e6c82d35189e6ffdb937219701bca83d75a2714503eced60d10d785623e5`.
- Base Frost proof: birth IDs `3,4`, variants `0,1`, speeds `4,4`; measured
  offsets `-14.999561,-10.139015` degrees and maximum absolute offset
  `14.999561`. The matched rendered frame retained 26 live primary actors.
- Cone rank-11 proof: birth IDs `179..188`, variants `0..9`, ten speed-`10`
  children; measured offsets include `-90.000002` and `+89.231985` degrees.
  The matched rendered frame retained 130 live primary actors.
- Chill proof remained exact: Arrow accumulation reached
  `0.9920001029968262`; replicated/rendered SpinAway used record `2` with
  initial alpha `5.7998046875`, then retired from host and wire ownership.
- Production screenshots: base Frost SHA-256
  `cf42a7ff327a9176a86564fdb56766dec895bbee0ee3e63b18fe617a525b4453`;
  Cone rank 11 SHA-256
  `115fdca392535f7e08743d6e8ebe21953255f8177b12d1484c00354a9174c0f6`;
  SpinAway SHA-256
  `f767cc7eb48e9164dcfb8f10492fd0d4731a1ee658461b3e6a63e622330098f5`.
- Unknowns and browser constraints: none. Publication and deployment were not
  requested and remain separate from this validated local candidate. After
  this receipt joins the candidate and any final non-overlapping rebase, the
  exact final tree repeats the complete gate; those non-recursive identities
  belong in the task completion receipt.
