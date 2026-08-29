# Staff and orb rendering

`0x00578D20` supports an optional two-system staff composition:

1. generated four-vertex staff-body/glow quads along the attachment endpoints,
   using Clothes records `5..10` as base materials and `11..12` as the secondary
   glow materials;
2. an element-specific VFX invoked by `0x0061AF10` at the computed attachment
   endpoint.

Other relevant records:

- staff base-material selectors use Clothes records `5..10`;
- Clothes record `11`: crop approximately `10 x 36`, logical `12 x 38`;
- Clothes record `12`: crop/logical approximately `15 x 119`;
- staff body records `5..10`: approximately `6..9` pixels wide and
  `46..53` pixels tall before scene scale.

Records `11` and `12` are not independently registered orb sprites. The Clothes
builder loads them into the two-entry material array at object field `0x420`,
and `0x00578D20` submits their texture/material data on the generated quad.
Records `3244..3723` live at fields `0x690` and `0x6A0`; they are the two
directional hand banks emitted by the staff renderer.

The superseded web implementation enlarged one generic core before composing
the staff. It has been removed: the attachment endpoint comes from Clothes
record `3244` point 1, and the five element painters below now receive the
stock equipped-staff scale `1` directly. Air's complementary record pair is
part of that same recovered painter rather than an extra CSS glow.

Clean runtime trace at right-facing heading `6` entered `0x00578D20` with:

- `param2 / heading = 6`;
- `param3 / staff selector = -1`;
- `param4 / scale = 1.0`;
- `param5 / optional glow color = null`.

Therefore the rank-zero stock default loadout does **not** execute the optional
colored secondary quad branch. Its visible orb comes from the element-specific
renderer around the staff endpoint. That observation proves only the rank-zero
branch: it does not justify omitting Clothes `11/12` after Enchant Staff becomes
effective. The optional quad is a staff-shaft treatment, not an orb layer.

## 2026-08-29 — Enchant Staff persistent attachment glow reopening

### Reported smell and parity question

- Reported web behavior: learning Enchant Staff does not add the Staff glow;
  the player expects the learned effect to remain active rather than appearing
  only during a melee action or concentration.
- Stock behavior to recover: identify the exact rank source and lifetime of the
  optional fifth `Staff_RenderAttachment` argument, then drain its complete
  material, geometry, color, selector, scene, item, and teardown membership.
- Reproduction boundary: effective rank zero/nonzero; permanent learning,
  equipment/Mindstar effective ranks, concentration on/off, all six native
  Staff selectors, all ten attachment poses and 24 headings, every selected
  pure/Weld/Plane primary, Hub and Boneyard local/remote players, death,
  selected-primary `-1`, Wand/empty/mod weapons, and UI-owned wizard previews.
- Falsifiers: the fifth argument remaining null at effective rank one; a
  melee-action or concentration gate; a world-light registration; glow records
  beyond Clothes `11..12`; an item selector remap; or another native caller
  supplying the learned-rank color to a generic/UI wizard.

This is a process reopening. The earlier pass captured one clean rank-zero call
and correctly rejected an invented always-on **orb** layer, but it skipped the
rank writer immediately upstream in `PlayerWizard_RenderAttachment
0x00538B80`. It then generalized a single null sample into the false all-ranks
claims in entries 020, 101, and 123. The missing native system is the learned
Staff-shaft compositor, not the already-complete element orb.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | unmodified Beta 0.72.5 `SolomonDarkAbandonware/SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred image base `0x00400000` | Same pinned image as the rank-zero Staff trace and complete player painter reports. | high |
| Existing clean stock | direct, mod-free right-facing call recorded above, `0x00578D20`, effective Enchant rank zero | Fifth argument is null and the learned branch is absent at rank zero. This is retained as the negative branch, not generalized to learned state. | high |
| Fresh caller instructions | canonical Ghidra 12.0.3 replica; `0x00538C62..0x00538E83` in `PlayerWizard_RenderAttachment 0x00538B80` | Exact Staff type `0x1B5C`; row count is expanded to 66; row-65 effective-rank short at `skillArray + 0x1C92` is compared to zero. Strictly positive rank stores a pointer to the current selected-primary color; zero or negative stores null. The same pointer is passed in both depth branches. | high |
| Fresh color ownership | `Skills_Wizard::vftable 0x007A0CD4`, slot `+0x88 -> 0x00660760`; selection resolver `0x0052DA40`; class resolver slot `+0x1C -> 0x00656430` | Color is resolved on every draw from the current selected-primary row or active Weld build, then passed unchanged to Staff. Plane Orb row 80 has default class/root zero and therefore uses Ether color. | high |
| Fresh Staff instructions | complete `Staff_RenderAttachment 0x00578D20`; learned block `0x00579037..0x00579488` | Non-null color selects additive blend, redraws the exact shaft quad, extends point 2 by five units, consumes one endpoint-inclusive `Float(1.5)`, widens by `2 + draw`, draws one colored four-vertex gradient, restores normal blend, then paints both hand records. | high |
| Complete xref/vtable sweep | only xref to `0x00578D20` is `Item_Staff::vftable 0x007857BC +0x20`; vtable refs are constructors/materializers `0x00462050`, `0x005CFA80`, and `0x005E3080`; generic attachment owner `0x0061AF10` | The live PlayerWizard route is the sole producer of the learned effective-rank pointer. Generic/source/UI wizard rendering passes literal null and does not inherit Enchant presentation. | high |
| Authored Clothes data | retail `Clothes.bundle`/`Clothes.png`; builder `0x004E4CA0` | Base array has six rows `5..10`; optional glow array has exactly two rows `11..12`. Record 11 is crop `10x36`, logical `12x38`; record 12 is crop/logical `15x119`. All rows were parsed, not estimated. | high |
| Missing-row behavior | array grower `0x0043A6B0`, Sprite default constructor `0x004138A0`, Staff access `0x00579240..0x00579271` | Selectors `2..5` grow the two-row glow array with zero/default Sprites. They still receive the additive shaft redraw, but their colored material quad is empty. | high |
| Current web causal trace | Website `e7addc2b`; `hub-actors.ts`, `player-character-presentation.ts`, packed player atlas, and strict protocol progression | Live player rendering consumes no row-65 rank, has no Clothes `5..12` material textures or learned gradient, and uses a precomposed shaft-plus-hands sprite. Rank-zero and rank-one frames are therefore identical apart from unrelated orb animation. | high |

Ghidra was invoked only through the read-only Mod Loader wrapper against the
canonical replica pool. Tool checkout revision was
`08bfba9ef367f7b863848030d0a289dc31e33192`; unrelated dirty Mod Loader docs
were not touched. Wrapper SHA-256 was
`b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`;
material scripts were `decompile_targets.py`
`899167ca42624e09f26d22233365631a6ee8b3d106e337e20b77574894e97465`,
`dump_function_instructions.py`
`273f6426824849790041dcd0f7a0b25ad9e700458827f3a9db3c34ec3ad50cef`,
and `vtable_slot_lookup.py` from that revision.

### System boundary and membership inventory

Native system: **effective-rank-owned enchanted Staff attachment compositor**,
from progression refresh and selected-primary color resolution through the
equipped Staff's normal/additive shaft, optional authored glow material,
hands, PlayerWizard depth pass, scene replication, reset, and teardown. The
element orb, Staff melee contact effects, UI-only generic wizard previews, and
Region world lighting are adjacent systems with explicit dispositions below.

The dispositions below are the complete system contract. The implementation
and Mac receipts at the end of this section confirm each required outcome.

| Member | Native source | Required disposition | Proof contract |
| --- | --- | --- | --- |
| rank zero | row 65 `+0x22 <= 0` | `verified-already-at-parity` | no additive shaft or colored material |
| permanent learned rank | row 65 `+0x20 -> +0x22` refresh | `exact-ported` | rank one makes the effect continuously visible without an action |
| equipment grant/boost and Mindstar | shared effective-rank refresh into row 65 `+0x22` | `exact-ported` | effective-only rank activates; removal deactivates on the next authoritative snapshot |
| concentration selected/unselected | no read in `0x00538D61..0x00538D76` or `0x00578D20` | `exact-ported` | both states produce identical attachment plans at equal tick/color |
| Staff action, cast, idle, and movement poses `0..9` | complete `3244..3483` / `3484..3723` pose banks and point table | `exact-ported` | all 240 pose/heading rows preserve body, learned pass, then hands |
| Hub Courtyard/private rooms, local and remote players | shared live `PlayerWorldView` and strict rank/selection wire fields | `exact-ported` | same rank transition and selected color for every addressed player |
| Boneyard, local and remote players | same live view under Arena saturation | `exact-ported` | same membership with the existing Arena shader/blend owner |
| death/spectator | `PlayerWizard +0x160` living-render bypass | `out-of-system` — death painter owns separate corpse art | learned meshes are hidden and destroyed with the living view |
| selected-primary `-1` / College pre-Create | `0x00538B80` fallback attachment branch | `out-of-system` — equipped Staff vslot is not called | no hidden glow while ordinary Staff is suppressed |
| Wand and empty weapon | types `0x1B63` / no equipped item | `out-of-system` — no `Item_Staff` vslot | negative visibility assertions |
| Website mod Staff | Web-content wearable without a retail Clothes selector/material row | `out-of-system` — no stock authored glow ABI | native rows are not guessed onto mod art |
| generic/source wizard, Create, Inventory preview, Hall/Memorial portrait | `0x0061AF10` passes literal null or captured UI data without row-65 effective state | `out-of-system` — different native caller/lifetime | existing UI orb/portrait programs remain unchanged |
| element orb and selected-primary VFX | `0x0053B1D0`, entries 010/237 | `verified-already-at-parity` | orb membership/scale/copies remain independent of row 65 |
| Staff melee/proc presentation | entry 101 action/contact actors | `verified-already-at-parity` | no action-owned substitute or duplicate glow |
| Region/player world light | no light-provider call or Region write in learned block | `out-of-system` — the effect is additive geometry, not a light | light-provider count stays unchanged |
| audio, collision, damage, and hit testing | no consumer in learned block | `out-of-system` — presentation-only branch | gameplay outputs remain equivalent |

All six authored Staff selector rows are closed explicitly:

| Selector | Base Clothes row | Colored glow row | Required disposition |
| ---: | ---: | ---: | --- |
| 0 | 5 (`6x49`) | 11 (crop `10x36`, logical `12x38`) | `exact-ported`: additive base plus colored gradient |
| 1 | 6 (`6x49`) | 12 (`15x119`) | `exact-ported`: additive base plus colored gradient |
| 2 | 7 (`6x46`) | default/empty grown Sprite | `exact-ported`: additive base only |
| 3 | 8 (`6x49`) | default/empty grown Sprite | `exact-ported`: additive base only |
| 4 | 9 (`8x52`) | default/empty grown Sprite | `exact-ported`: additive base only |
| 5 | 10 (`9x53`) | default/empty grown Sprite | `exact-ported`: additive base only |

The selected-color table is also complete. Every base RGB below is transformed
by `Color::Saturate(base, 0.85)`, meaning
`0.85*luminance + 0.15*channel`, with luminance weights
`0.30860000848770142/0.6093999743461609/0.0820000022649765`:

| Selected ID/program | Unsaturated native RGB | Resulting 8-bit tint | Required disposition |
| ---: | --- | ---: | --- |
| 8 Ether | `(1,.1,1)` | `#886688` | `exact-ported` |
| 16 Fire | `(1,.35,.1)` | `#998077` | `exact-ported` |
| 24 Air | `(.1,1,1)` | `#A0C3C3` | `exact-ported` |
| 32 Water | `(.1,.5,1)` | `#5E6E81` | `exact-ported` |
| 40 Earth | `(.1,1,.1)` | `#90B390` | `exact-ported` |
| 80 Plane Orb | row-root zero, Ether `(1,.1,1)` | `#886688` | `exact-ported` |
| 1000 Burning Bolt | `(1,.1,.5)` | `#7F5D6C` | `exact-ported` |
| 1001 Frost Missile | `(1,.5,1)` | `#BDAABD` | `exact-ported` |
| 1002 Ball Lightning | `(1,.75,1)` | `#DED4DE` | `exact-ported` |
| 1003 Flame Lash | `(1,.75,.5)` | `#D5CCC2` | `exact-ported` |
| 1004 Blizzard Beam | `(1,.75,1)` | `#DED4DE` | `exact-ported` |
| 1005 Steam Jet | `(.75,.75,.75)` | `#BFBFBF` | `exact-ported` |
| 1006 Ethereal Boulder | `(1,.75,1)` | `#DED4DE` | `exact-ported` |
| 1007 Meteor Swarm | `(1,.75,.5)` | `#D5CCC2` | `exact-ported` |
| 1008 Hailstones | `(.8,1,1)` | `#EAF2F2` | `exact-ported` |
| 1009 Crawling Shock | `(.9,1,1)` | `#F4F8F8` | `exact-ported` |
| 1010 internal Ether program | `(1,.1,.5)` | `#7F5D6C` | `exact-ported` in the pure planner; `out-of-system` at wire input |
| 1011 internal Fire program | `(1,.35,.1)` | `#998077` | `exact-ported` in the pure planner; `out-of-system` at wire input |
| 1012 internal Water program | `(.1,.5,1)` | `#5E6E81` | `exact-ported` in the pure planner; `out-of-system` at wire input |
| 1013 internal Air program | `(.1,1,1)` | `#A0C3C3` | `exact-ported` in the pure planner; `out-of-system` at wire input |
| 1014 internal Earth program | `(.1,1,.1)` | `#90B390` | `exact-ported` in the pure planner; `out-of-system` at wire input |

No member is blocked by the browser platform.

### Native ownership thread and recovered behavioral contract

- Owner and lifetime: `PlayerWizard_RenderAttachment 0x00538B80`, not the
  skill tick or Staff action actor, owns the learned-state decision on every
  living-player draw. Progression refresh owns effective rank; PlayerWizard
  destruction/living-render bypass owns teardown.
- State transition: exactly `effectiveRank > 0` selects the non-null branch.
  Rank magnitude does not scale opacity, width, cadence, or color. There is no
  concentration, action, cooldown, damage, or wall-clock latch.
- Painter order: normal shaft quad; additive copy of that same shaft; optional
  colored gradient quad; both pose-matched hand records; restore normal blend.
  The glow must not be painted over the hands and must not be baked into the
  element orb.
- Geometry: points 1 and 2 of each complete Clothes `3244..3483` row own the
  shaft. Base half-width is `base.logicalWidth * 0.5 * actorScale`. Glow keeps
  point 1, extends point 2 five native units along the shaft, and multiplies
  the base half-width by endpoint-inclusive `2 + Float(1.5)` (`2..3.5`).
- Color/timing: the two point-1 vertices use alpha
  `0.5 + 0.2*sin(globalTick*5 degrees)` (`0.3..0.7`); the two point-2 vertices
  use exactly `0.35` of that alpha (`0.105..0.245`). RGB is the current
  selected-primary color above. The pulse uses the 100 Hz application tick and
  does not restart when rank or selection changes.
- Randomness: one learned visible Staff composite consumes one
  endpoint-inclusive `Float(1.5)` presentation draw. The Website keeps this
  cosmetic sampling outside authoritative gameplay RNG while preserving the
  exact one-sample range and per-player retained-view ownership.
- Blend/lighting: both learned passes use selector-one additive
  `SRCALPHA/ONE`; the normal shaft and hands remain selector zero. No Region
  light, shadow, collision, audio, or protocol message is born.
- Authority/replication: `learnedSkills` already publishes the effective rank
  as tuple field two, and selected-primary identity is already atomic. Clients
  consume those authoritative fields; no new client-owned skill state or
  protocol version is legal.

### Nearby-system findings

- The two-row glow table is intentionally narrower than the six-row base table.
  Correct parity is not to copy record 11 across selectors `2..5`; native grows
  zero/default Sprite rows and retains only the additive base redraw there.
- The current packed player sheet fuses shaft and hands. Exact learned painter
  order requires a cohesive live attachment view (normal shaft, learned
  passes, hands), backed by raw Clothes materials and the full point table;
  overlaying a glow on the fused sheet would brighten hands and is rejected.
- Entry 237 remains authoritative for the independent selected-primary orb.
  This branch reuses its atomic selected identity but not its painter stack or
  orb scale.
- The complete 240-frame depth comparison found one stale analytic sibling:
  pose 9, heading 18 has primary-hand point 0 Y `12.5`, so it belongs to the
  front attachment pass. Pose 9 now owns a distinct Cast-2 depth table while
  poses 7/8 retain the authored back member at that heading; every other
  analytic pose/heading result already matches the extracted Clothes row.

### Confidence and open questions

- Confirmed: rank field and strict gate, current-color producer, all pure/Weld/
  Plane color rows, complete selector/material rows, array fallback behavior,
  240 pose/heading geometry membership, order, blend, pulse, random range,
  scenes, negative items/callers, and teardown owner.
- Inferred: exact native global RNG sequence is presentation incidental state;
  the browser projection preserves one sample and its endpoint-inclusive range
  without coupling rendering to host gameplay RNG.
- Unknown: none material. No authored row or caller remains unextracted.

### Web implementation consequence

- Add one pure attachment planner/catalog owning all 240 point pairs, six base
  records, two glow records, color rows, pulse, random-width range, and negative
  branches.
- Render native living Staffs as an ordered body mesh, learned additive body
  mesh, optional per-vertex colored glow mesh, then hand-only sheet. Keep
  mod/Wand/fallback attachments on their existing independent paths.
- Extend both Hub fixed-function and Boneyard Arena mesh batching to accept the
  native per-vertex color gradient; do not split it into two flat-alpha quads.
- Consume row-65 effective rank and selected-primary identity already present
  on `ProtocolPlayerState`; no protocol or architecture change.
- Remove the false no-presentation assumptions in entries 020, 101, and 123.

### Validation contract

- Focused planner tests: rank zero/nonzero/magnitude/concentration, the full
  six-row material table, all 240 geometry rows, exact endpoint extension,
  inclusive width endpoints `2/3.5`, alpha extrema and gradient factor, five
  pure colors, Plane Orb, all fifteen Weld colors, and invalid selections.
- View tests: exact body/additive/glow/hands order; selectors `0/1` colored,
  `2..5` additive-only; effective-only rank; live deactivation; native versus
  mod/Wand/empty; idle/cast/melee/spin poses; world tint isolation; death and
  teardown.
- Renderer tests: per-vertex colors survive fixed-function Hub and Arena
  batching with selector-one blending and no Region-light registration.
- Browser journey on Mac Chrome: capture the same player/heading/pose/tick
  before and after `sd.dev.grant_skill(65,1)`, prove a shaft-region pixel delta,
  additive and colored members, unchanged orb program/light count, persistence
  while idle/moving/casting in Hub and Boneyard, a selected-primary color swap,
  selector-2 additive-only behavior, and empty page/console/network error arrays.
- Run `/opt/homebrew/bin/bash ./scripts/validate.sh` on the byte-identical Mac
  candidate after the focused journey.

### Implementation validation receipt

- Website extraction now drains the complete Staff program into
  `player-staff-attachment-program.json`: 240 point/depth rows, body records
  `5..10`, logical widths `6/6/6/6/8/9`, and aura rows `11/12/null/null/null/null`.
  It emits exact selector-specific body sheets, four ordered hand-bank sheets,
  and untouched aura crops. `verify_player_staff_split` proves body plus hand
  bank 1 plus hand bank 2 reconstructs every prior combined sheet byte-for-byte
  before generation; the earlier two-hand precomposition was rejected because
  8-bit alpha rounding is not associative over the shaft.
- The packed player atlas now owns 100 reviewable source sheets and 12,403
  frames across three bounded pages. Exact page `(height, SHA-256)` rows are
  `(2048, 8e1b2f34c3898167e5625d460418f3acf21ba3d0d34ebe6b8dfbd775c8d3b106)`,
  `(2048, d36cb7c00505e2b7a5db8d90b03e5538fe19ee4ad79a1311bc83ab4554429e65)`,
  and `(1750, 2bad6b8b61dc9b9735a866dff45c71838193850fc1842f5d1145f9ceef5296e1)`.
- `player-enchant-staff-presentation.ts` owns the strict effective-rank gate,
  complete pure/Weld/Plane color table, 100 Hz alpha, endpoint-inclusive width
  sample, and exact quad geometry. `PlayerEnchantStaffView` retains normal
  body, additive body, per-vertex aura, then hand bank 1 and hand bank 2.
  Selectors `2..5` keep their
  additive body with no manufactured aura. Mod/Wand/empty/unselected/death
  paths remain independent.
- The shared fixed-function batcher now accepts the same packed per-vertex
  colors already supported by the Arena batcher. Hub and Boneyard consume the
  same live view; strict existing progression/selection fields drive local and
  remote presentation with no protocol, save, audio, collision, damage, or
  light-provider change.
- The Mac red candidate was byte-identical to the local tree and failed the
  canonical gate at TypeScript `TS2307` because the new presentation owner was
  deliberately absent. Focused green coverage closes rank zero/positive/
  effective-only, ranks 1/15, all selectors, all 240 frames, inclusive width
  endpoints, alpha/gradient, every color row, painter order, negative owners,
  material tint isolation, fixed/Arena vertex colors, diagnostics, atlas
  census, and extraction ownership.
- After `origin/main` advanced, the task was rebased onto current remote commit
  `b4239a26c9f7887ac44bf76eb20d63ea2e5f5897`; upstream Phasing,
  skill-picker, targetless Staff-proc, and ML-test-removal changes remained
  intact. Final
  byte-identical Mac mini gate on macOS 26.6.2 arm64, pinned Node
  `22.17.0`, npm `10.9.2`, and .NET `10.0.302` passed
  `/opt/homebrew/bin/bash ./scripts/validate.sh`: 29 Website/backend contracts,
  backend Release build/formatting, lint/import/generated checks, the new
  17-test Arena/Staff group, 321 pretests, all `1729/1729` Boneyard/game tests,
  every later auxiliary suite, desktop tests, production frontend/game-host
  builds, bundle budget, and CSP media policy. The production Game entry is
  `264582` raw / `80323` gzip bytes against `524288/134144`.
- Mac Chrome `151.0.7922.174` at `1600x900`, protocol
  `solomon-dark/105`, ran the real developer-grants journey on that built
  candidate. Rank zero reported inactive/null. `sd.dev.grant_skill(65,1)`
  produced selector-0 aura row 11 and Fire tint `#998077` while idle; the
  isolated shaft crop changed 1,561 pixels / 118,815 RGB-channel units. Weld
  1000 recolored it to `#7F5D6C`; the addressed remote player reported the
  same Weld tint/row; selecting Fire restored `#998077`; Boneyard retained the
  active row-11 glow. Page, console, failed-request, host-error, and
  failed-response arrays were empty. The visually inspected disposable
  Boneyard frame had SHA-256
  `087a84494992eb67c2ec7ea5fa2ed1468a60b696152455edde8b0799704e6c38`.
- The complete 240-row integration audit then found the pose-9/heading-18
  depth mismatch recorded above. Follow-up implementation `e080d3dd` is one
  local commit above current `origin/main` `ceaabf28`, which contains the
  published glow commit `cc8ce796`. Byte-identical Mac candidate `112ce1af`
  passed TypeScript plus 24/24 focused tests, including every extracted row
  against the shared live compositor, and the canonical gate: 16 test groups /
  2,470 tests / zero failures, production build, bundle budget, and CSP media
  policy. The Game entry is `264597` raw / `80328` gzip bytes; canonical log
  SHA-256 is
  `c99318db877e27272387480547a1dbeda0dd6de4a78493f292dff4873178a715`.
- Chrome `151.0.7922.174`, protocol `solomon-dark/106`, on that exact follow-up
  kept rank zero inactive; rank 65 active with aura row 11; Fire `#998077`;
  Weld and the remote player `#7F5D6C`; and Boneyard Fire active. The shaft
  crop changed 1,560 pixels / 81,010 RGB-channel units, and every
  page/console/host/request error array
  was empty. The visually inspected frame SHA-256 is
  `f88f5c46e262f04ec89b965f910b87d34a9c946e3ccb56f96a5d26a825012a22`.
- No browser-platform exception or material unknown remains. The primary glow
  implementation is published on `origin/main` as `cc8ce796`; the validated
  pose-depth follow-up is committed separately from deployment, which is not
  part of this receipt. This receipt is the sole post-validation change.

## Element orb painters

The five shared native painters are now mapped conclusively through both the
Create menu's element switch and `0x005e9fc0`, which dispatches the equipped
wizard's orb from actor element byte `+0x23f`:

| Element | Painter | Animated BadGuys records |
| --- | --- | --- |
| Ether | `0x00535a30` | common core/spark/ray `110..112` |
| Fire | `0x005360c0` | `255..266` |
| Air | `0x00536380` | `1836..1839` plus common core `110` |
| Water | `0x005370d0` | `271..282` plus common core/ray `110/112` |
| Earth | `0x005374c0` | `238..245` plus common core `110` |

These are not one generic circle with a color filter. Their recovered painter
stacks are distinct:

- Ether makes two passes of two differently sized purple core pulses, then a
  variable `2..11` field of randomly placed common sparks and one common ray
  per pass.
- Fire draws one orange core pulse, then the same selected 12-frame flame once
  additively and once at half alpha with ordinary blending.
- Air draws four cyan core pulses at full, `0.75`, `0.5`, and randomized small
  scale, then a deterministic pseudo-randomly offset/rotated frame from its
  four-record bank and a second complementary frame (`3 - frame`) rotated by
  another `90 degrees`. This paired secondary sprite is the missing Air layer
  in the web approximation.
- Water draws one selected 12-frame water sprite at `1.8 * scale`, one cyan
  core pulse, and two independently rotating common rays.
- Earth draws complementary indices from its eight-frame ring bank at
  `1.5 * scale` and `1.8 * scale`, then two green core pulses.

Instruction-level operand recovery establishes that the shared core scale is
`abs(sin(phase)) * 0.15 + base`. The nearby literal `2` is the Create caller
context scale and must not be folded into the pulse amplitude. The core bases
are `2.5` and `1.5` for Ether and `3.5` for the ordinary element core. This small `0.15`
breathing range is why native picker and staff orbs read as stable animated
effects instead of large pulsing circles. All element contexts must share the
correct painter amplitude; context size belongs solely in the caller scale.
Relevant literal colors include Air `(0.5, 0.75, 0.75)`, Earth
`(0.5, 0.65, 0.5)` and `(0.75, 0.95, 0.75)`, and Fire `(1, 0.5, 0)`. Frame
selection reads the shared renderer integer tick, using modulo `12`, `8`, or a
hash of `floor(tick / 8)` rather than independent CSS animation clocks. The
native random helper is the game's shared additive lagged-Fibonacci generator;
exact initial random state is not presentation state, but each painter's
recovered count and value ranges are.

The Create painter passes `2 * menuScale` to the five background choices and
`2 * menuScale * selectedScale` to the selected hand effect. A clean,
direct-stock breakpoint on the Water
painter at runtime `0x011170d0` captured the raw entry stack after entering New
Game: return address `0x0117b4e4`, `x = 0x443f434d`,
`y = 0x44012d76`, and `scale = 0x40000000` (`2.0`). This verifies the settled
picker scale directly instead of inferring it from the caller. The selected
scale settles at `6.0`, as documented in the projection/context section. The equipped
wizard path in `0x0061af10 -> 0x005e9fc0` passes actor scale `+0x74`, which is
`1` for the stock local player. Thus native variant scales are exactly Create
picker `2`, selected `6`, and staff `1`; any remaining apparent-size mismatch belongs to sprite
geometry or the canvas-to-CSS projection, not a substitute scale constant.

The traced process was launched directly from
`SolomonDarkAbandonware/SolomonDark.exe`. Its loaded-module list contained the
stock executable, `BASS.dll`, Windows DirectInput/Direct3D and system DLLs; it
contained no loader, `sdmod`, Lua, or proxy-injection module. This is the
required mod-free oracle path for the rest of this parity pass.

Confidence: high from direct decompilation, raw numeric-value dumps, both
dispatch switches, and the clean stock Create/hub captures.

Confidence: high, from a one-shot breakpoint on the clean stock process.

An instruction-level follow-up removed several phase guesses from the first
web draw-plan pass:

- Both iterations of Ether's outer two-pass loop reuse the same four values
  computed before the loop: `tick * 15`, `tick * 5`, `tick * 8`, and
  `tick * 0.5`. There is no per-pass `37`-tick offset. Its first two core
  scales use the shared `0.15` amplitude with bases `2.5` and `1.5`.
- Fire selects `floor(tick / 5) % 12`.
- Water selects `floor(tick / 8) % 12`. Its two-ray loop also reuses the same
  pre-loop `tick * 11` opacity phase and `tick * 0.5` rotation phase; there is
  no `90`-degree pass offset.
- Air derives `stage = trunc(tick) % 8` and hash seed
  `trunc(tick) / 8`. The first displaced Air record uses opacity
  `sin(stage * pi / 8)` and the complementary `3 - frame` record uses one
  quarter of that opacity. Their rotations differ by exactly `90 degrees`.
  The native hash normalizes a negative mixed 32-bit value to its signed
  magnitude before `% 36000`; treating it as an unsigned JavaScript integer
  changes every derived frame and transform.
- Air's first hashed remainder produces rotation in `[0, 35.999]` degrees;
  the next produces radial displacement in `[0, 1)` native pixels from the
  exact constants `360000` and `10`. Subsequent hashes produce its
  `0.75..1.0` scale and four-record frame index.

These properties come from the complete instruction streams for
`0x00535a30`, `0x005360c0`, `0x00536380`, `0x005370d0`, and `0x005374c0`,
with constants dumped from the analyzed executable. They supersede arbitrary
phase offsets and the earlier one-tick Water frame cadence in the web plan.
The renderer toggles its additive flag around individual draw calls; it does
not screen-blend the completed element effect as one extra layer. The web
canvas must therefore preserve each operation's blend mode and use ordinary
composition for the canvas itself. Create canvas CSS geometry must also scale
with the `1600 x 900` virtual stage, while the Hub canvas remains in fixed
world pixels inside the Hub's already-scaled native frame.

The 2026-08-28 Create element-ray cadence correction is the fresh raw-
instruction authority for the corrected Ether `8` multiplier and the Create
caller's free-running 100 Hz `App+0x28` phase. Water remains `11`; Staff and
actor-owned callers retain their established 100 Hz/actor phase sources.

## 2026-08-29 — Straight-alpha Staff painter correction

The five painter programs, Staff submission counts, selected-primary dispatch,
socket geometry, and `1+10*phase` caller scale remain authoritative. The
reported dull/flat Staff orbs instead reopen the shared renderer: every painter
contains at least one draw whose texture is an exact straight-alpha BadGuys
record and whose texture-factor alpha is fractional. Pixi 8.19's default batch
shader premultiplies that per-draw alpha into RGB, then its NPM blend mode
multiplies the RGB by source alpha again. A native contribution proportional to
`textureAlpha * drawAlpha` therefore became proportional to
`textureAlpha * drawAlpha^2` outside the Arena renderer.

Fresh clean-image Ghidra evidence for Fire painter `0x005360C0` confirms the
required order is core, additive BadGuys `255..266`, then the same record under
ordinary blend with texture-factor alpha `0.5` from `0x007DE870`; the normal
pass must not be removed or retuned. The shared renderer correction and full
context membership are owned by entry 287. Staff acceptance must cover Ether,
Fire, Air, Water, Earth, selected-primary changes, Hub, Create, Hub Inventory,
Memorial portraits, and Boneyard without changing painter data or Staff scale.
