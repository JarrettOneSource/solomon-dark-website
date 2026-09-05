# Player wizard rendering

## Runtime object validation

- Preferred gameplay-global address `0x0081C264`; runtime address in this run
  `0x010CC264`.
- Runtime gameplay pointer observed: `0x02E87AD8`.
- Player field is at gameplay object `+0x1358`; runtime actor pointer observed:
  `0x16260410`.
- Selector bytes at actor `+0x23c..+0x240` were
  `00 00 00 00 01` in the hub.
- Those bytes belong to the generic source-wizard descriptor path. They do not
  select the equipped local player's robe-frame index.

## Native painter split

Relevant functions:

- Wizard body renderer: `0x00621780`.
- Wizard attachment compositor: `0x0061AF10`.
- Staff attachment renderer: `0x00578D20`.

A clean one-shot debugger trace on the stock local player additionally resolved
the active attachment renderer at `0x00538B80`. Its return chain includes the
animation/body driver `0x0054BA80`. This path exposes the equipped-item decision
more clearly than the generic `0x0061AF10` decompile.

`0x00621780` paints a generic/source wizard in this order:

1. attachment compositor, back pass (`pass = 1`);
2. dynamic primary and secondary robe/body layers;
3. fixed selector primary layers (`+0x64c`, `+0x66c`);
4. fixed selector secondary layers (`+0x65c`, `+0x67c`);
5. attachment compositor, front pass (`pass = 0`);
6. native movement bob transform;
7. hat/head tables (`+0x6b0`, `+0x6bc`).

The exact Clothes builder map confirms the four fixed banks are
`1612..2019`, `2428..2835`, `2020..2427`, and `2836..3243`: each bank is
`17 poses x 24 headings`, not the ten poses owned by the separate Staff/Wand
attachment tables. The dynamic robe banks are selected separately; default
style zero maps to records `868..987` and `1228..1347`.

This generic renderer is not the authority for the equipped local-player
robe. The actual local route is
`0x0054BA80 -> 0x00538B80 -> equipped item vtable +0x20`, with the robe landing
in `0x00577DA0`. Its five arguments are, exactly, robe object, style-selected
frame index, fixed-bank frame index, actor scale, and an optional transform
pointer. The call site builds the style-selected frame as
`heading + trunc(actor + 0x220) * 24` and the fixed-bank frame as
`heading + trunc(actor + 0x238) * 24`. A clean right-facing runtime snapshot showed
heading `6`, actor `+0x220 = 0.0`, and actor `+0x238 = 0.0`, while the gait
phase at `+0x228` remained independent. That snapshot proves the standing
frame is `6`, selecting fixed records `1618`, `2434`, `2026`, and `2842`--not
the previously forced pose-12 records `1906`, `2722`, `2314`, and `3130`. It
does not prove that `+0x220` stays zero while walking.

The forced pose-12 interpretation was the anatomy bug: it put a down-facing
white cuff beside the correctly right-facing staff and body. Pose zero remains
the correct standing frame. The later instruction-level ABI audit below
corrects which Clothes banks ordinary walking advances; that correction is an
ownership result, not a hand-offset or CSS adjustment.

A read-only scan of the only live `Robe` item (`vtable 0x00785704`) in the same
clean process also recovered style `0`, primary color
`(0.657653, 0.837074, 0.821034, 1.0)`, and white secondary color. This validates
the equipped item and default dynamic-bank selection directly; element-specific
palette generation remains a separate loadout input.

The body palette is also a renderer input, not a cosmetic approximation.
`Skills_Wizard_GetPrimaryColor (0x00660760)` returns the descriptor-facing
element color after the native robe mix. The exact default vectors are Air
`(0.628921,0.763921,0.763921)`, Earth
`(0.566191,0.701191,0.566191)`, Ether
`(0.533809,0.398809,0.533809)`, Fire
`(0.600576,0.503076,0.465576)`, and Water
`(0.369926,0.429926,0.504926)`. The previous extractor started from guessed
saturated colors and applied the `0x0040FC60` mix itself, which produced the
wrong cyan value and could not preserve stock element identity. Static web
sheets must tint the primary banks with these descriptor colors once and keep
the default trim white.

The Clothes builder at `0x004E4CA0` gives the definitive field-to-record map.
Closer control-flow recovery corrects an earlier interpretation of records
`484..603` and `676..795`: `0x00538B80` draws those generic pose-dependent
attachment banks only when no item is equipped or the animation selection is
`-1`. A valid equipped staff takes the mutually exclusive staff branch instead.
The staff renderer at `0x00578D20` draws pose-dependent hand banks
`3244..3483` and `3484..3723` around its generated staff body. Adding the
generic banks to the normal staff branch would duplicate limbs and would not
match stock.

For heading `6` (right), the first normal-walk pose in the staff-hand banks:

- first pose bank, point 0: `(89.0, 38.5)` — foreground side;
- second pose bank, point 0: `(133.0, -23.5)` — background side.

The original web extractor split the two staff-hand banks independently and
flattened them around the shaft in the wrong order. The runtime web simulation
also advanced every robe and staff lane through five Clothes poses on travel
distance. Together those facts caused the visibly detached hand and flailing
staff while facing right. The equipped renderer instead advances only the four
fixed robe banks. The extractor must submit the heading-only staff composite
on one side of the body while independently selecting the fixed robe pose.

The apparent depth baseline is `0.5`, matching Clothes record `316`, point 0
`(0, 0.5)`. Confidence: medium-high inference pending an explicit confirmation
of the comparison operand in all compositor branches.

Direct `0x00538B80` decompilation confirms that record `316` point 0 Y is loaded
as the comparison baseline. Its no-item/fallback branch selects generic
attachment index `heading + animationPose * 24`, reads point 0 Y from both
`484..603` and `676..795`, and paints each on the matching side of that
baseline. Its normal equipped-staff branch does not enter that fallback.

Confidence for the generic-bank split, branch exclusivity, and `0.5` baseline
is high.

The call sites in `0x0054BA80` pass `1` before the body and `0` after it.
Instruction and decompiler evidence agree on the comparisons:

- pass `1` paints a fallback attachment when `point0.y <= 0.5`;
- pass `0` paints it when `point0.y > 0.5`;
- the equipped staff composite is assigned to the same two passes by the
  point-0 Y returned by `Staff_GetAttachmentPoint (0x005795E0)`.

`0x005795E0` returns an arbitrary serialized point from the selected Clothes
record. `Staff_RenderAttachment (0x00578D20)` can receive the full
`heading + animationPose * 24` record index, uses points 1 and 2 as shaft
endpoints, draws the generated shaft, skips its optional Clothes `11..12` glow
branch when the fifth argument is null, and finally draws both matching hand
records from banks `3244..3483` and `3484..3723`. A clean default-staff trace
had pose record `6`, selector `-1`, scale `1.0`, and a null optional-glow
argument. Thus both hands and the shaft are one pose-dependent item composite,
submitted wholly behind or wholly in front of the body; the two hand banks must
not be split independently.

A clean live read additionally corrected the source-of-truth wording for staff
geometry. `Staff_RenderAttachment` reads the active 240-record runtime table
through `DAT_00B2E984`; it does not dereference the serialized bundle directly.
For the default kit, all recovered runtime points match Clothes records
`3244..3483` exactly (right heading points are `(89,38.5)`, `(38.5,-61.5)`, and
`(-3.5,17.5)`). The web may therefore derive its static default sheet from
those bundle records, but the match is a validated content equivalence rather
than ownership by the bundle parser. The generated staff shaft and both hand
records remain one attachment pass.

The complete `0x00578D20` instruction stream also closes the remaining raster
registration gap. It computes `point1 - point2`, normalizes that vector through
`0x004035D0`, rotates it ninety degrees, and multiplies the perpendicular by
`sprite.logical_width * 0.5 * actorScale`. The resulting four corners are sent
directly to the normal textured-quad painter `0x00414710`; the source sprite is
not first stretched into an integer rectangle and then rotated. That distinction
is visible at right heading: the approximate web raster left the fixed white cuff
uncovered and made the arm look detached. Static extraction must inverse-map the
staff material into the recovered endpoint quad with bilinear sampling, then
composite both hand records in the same attachment pass.

Confidence: high from the three `0x0054BA80` call sites, `0x00538B80` branch
instructions, full `0x00578D20` decompilation and instruction stream, and the
clean runtime call trace.

## Normal hub walk frame selection

A read-only `8 ms` sampler against the clean direct stock process held physical
scan code `0x20` (D) for `1.4 s`. The local player moved and faced exactly
`90 degrees`/heading `6`, while these fields stayed fixed for the full sample:

- `actor +0x238` render phase: `0.0`;
- `actor +0x22c` discrete frame: `0`;
- `actor +0x234` advance rate: `0.0`;
- `actor +0x1bc` move-duration ticks: `0`.

The earlier conclusion drawn from that trace was incomplete. It correctly
separated `+0x238` from ordinary walking and correctly found a heading-only
staff call, but it treated the changing `+0x220` as transform-only state even
though `0x0054BFD4..0x0054BFE6` converts it directly into the style-selected
robe/body frame.

The complete stock update at `0x0054B592..0x0054B66E` resolves the three walk
accumulators. For movement magnitude `distance` in one fixed update:

- `actor +0x220 += distance / 10`, then wraps by subtracting `5` when greater
  than or equal to `5`;
- `actor +0x224 += distance / 25`, then wraps by subtracting `4` when greater
  than or equal to `4`;
- `actor +0x228 += distance * 5` without the local wrap in this block.

The constants are the executable doubles at `0x007DE810 = 10`,
`0x007DE960 = 25`, `0x007DE8D8 = 5`, and `0x007DE8C8 = 4`, plus the float at
`0x007DE970 = 5`. The local renderer `0x0054BA80` consumes these lanes as
follows:

- `trunc(+0x220)` selects the style-selected robe/body pose at
  `0x0054BFD4..0x0054BFE6`. Steady float32 travel cycles through `0..4`; the
  `>= 5` wrap makes `5` an excluded boundary;
- `+0x228` drives the half-frequency robe/front-attachment offset at
  `0x0054BB27..0x0054BB7C` and the final head/hat bob at
  `0x0054C35D..0x0054C50B`;
- `+0x224` is not read anywhere in this local renderer;
- `+0x238` remains zero during ordinary Hub walking with a nonnegative primary,
  so the four large fixed robe banks remain on pose zero in that branch;
- both calls to the equipped attachment compositor, at `0x0054BC2E` and
  `0x0054C071`, receive the quantized heading in `EBP`, not `+0x220`. The staff
  shaft and its two item-owned hand records therefore remain on pose zero and
  move only when their complete depth pass receives the recovered transform.

The two style-selected Clothes arrays at records `868..987` and `1228..1347`
are exactly five poses by 24 headings and contain the ordinary robe/body walk
cycle. The four fixed arrays at `1612`, `2428`, `2020`, and `2836` contain 17
poses by 24 headings. Ordinary Staff rendering indexes poses `0..9`; the
empty-hand wrapper maps into `9..12`; selected primary `-1` forces pose `13`;
and Wand rendering clamps into `14..16`. The clean ordinary Hub walk trace
selects fixed pose zero. The staff item, shaft, and its two hand sprites also
stay on pose zero there; they move with their owning painter transforms instead
of swapping walk frames.

Implementation consequence: retain the two native-owned authoritative phases
rather than inventing a client animation clock. The existing `gaitDegrees`
models `+0x228`; retain `walkCyclePrimary` for `+0x220`, advance it by requested
distance divided by `10`, and wrap it at `5`. This separate field is necessary
because `gaitDegrees` is bounded modulo `360`, while the two native phases have
different periods and cannot be reconstructed from that bounded value after a
wrap. Emit five columns for the style-selected robe/body sheet, all 17 columns
for the four common compiled-Robe fixed arrays, ten columns for Staff/Wand
attachment sheets and the legacy generic fixed-body view, and heading-only
head/special sheets. Never reuse the ten-pose Staff selector as the compiled
Robe fixed selector. Keep the continuous renderer-local transforms already
recovered.

Evidence: fresh no-analysis Ghidra instruction dumps of
`0x0054BFC7..0x0054BFF1` and decompilation of `Robe_RenderAttachment`
(`0x00577DA0`). The x86 right-to-left pushes prove that the computed
`heading + trunc(+0x220) * 24` value is argument 1, while the previously built
`heading + trunc(+0x238) * 24` value is argument 2. Inside the robe renderer,
argument 1 indexes the two style-selected arrays and argument 2 indexes all
four fixed arrays. The update instructions at `0x0054B624..0x0054B643`
compare literal `5` against the advanced `+0x220` value and subtract on both
equal and greater results. The exact five-pose size of records `868..987` and
`1228..1347` independently agrees with that excluded upper boundary.

Confidence: high. Argument ownership, bank lengths, and wrap comparison agree
at the call site, callee, updater, and serialized Clothes tables. The clean
right-walk capture is visually consistent with this ownership, but the binary
evidence is decisive without relying on subjective frame matching.

Unknowns: `+0x224` may feed another presentation or gameplay subsystem outside
`0x0054BA80`. The fixed-bank selector membership is no longer unknown: raw
instructions and the Hand/Wand action arrays account for every pose `0..16`.

## 2026-09-04 — Wand equipment and one-handed presentation reopening

The supplied `SDB - Wand Incorrect Features.mp4` (Windows Downloads,
1920 by 1080, 15.043011 seconds) shows a Wand of Searing in both equipment
hand boxes and a Staff-shaped player pose. The absence of Wand melee is
correct. This reopens the weapon presentation portion of this entry: the
earlier extraction knew that Wand fixed-Robe poses were `14..16`, but neither
selected them nor extracted their separate hand and endpoint banks.

### Evidence and system boundary

The target remains retail `SolomonDark.exe` 0.72.5, SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred
base `0x00400000`. Evidence comes from the canonical Ghidra project through
the read-only Mod Loader replica wrapper, and the stock Clothes bundle.
Wrapper SHA-256:
`b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`.
No injected observation is presented as a clean-stock capture.

The Mac Chrome reproduction on Website
`a2197bf4a6b8bf8a5328030c63b555b269c65e65` granted and equipped recipe 13
(Bug-Master's Wand) through the existing developer and inventory interfaces.
Both hand controls referenced the same item ID, and the live shared player
renderer reported fixed-Robe pose `0`. The assertion that a Wand occupies one
hand failed with `2 !== 1`. Page, console, and request-failure arrays were
empty. This is the original failing browser scenario for the correction.

Native system: **equipped weapon presentation**, from the single weapon sink
and existing authoritative action state to inventory hand occupancy, living
wizard hand/body composition, Inventory preview, and Memorial portrait.
Spell damage, costs, grants, loot weighting, and cast admission are separate
owners. In particular, the quoted speculation about a future off-hand item
does not establish a second native equipment sink or authorize a new item
system. Staff's documented held-pose Website override in entry 163 remains
its own contract.

| Member | Source | Disposition and proof contract |
| --- | --- | --- |
| Staff selectors `0..5` | Item_Staff `7004` / `0x1B5C`, renderer `0x00578D20` | `verified-already-at-parity`; retain both hand icons, ten action poses, Staff hand banks, shaft, orb, and melee |
| Wand selectors `0..5` | Item_Wand `7011` / `0x1B63`, renderer `0x00579820` | `exact-ported`; one held item, common Clothes 15 material and three authored poses for all selectors |
| Cosmofluxic Wand, Bug-Master's Wand, Kiln | recipe indices `2`, `13`, `28` | `exact-ported`; item identity selects the shared Wand presentation |
| Qubar's Ether, Fire, Air, Water, Earth | recipe indices `41..45` | `exact-ported`; same presentation with unchanged recipe FX and level requirements |
| Wand idle, travel, and Constant cast | `0x0054BF02..0x0054BF7E`, `0x0044E260/0x0044C810` | `exact-ported`; fixed-Robe pose 14, attachment pose 0, independent five-frame walking body |
| Wand Cast 1 and Cast 2 | `0x0044DF60/0x0044E0D0`, action tick `0x0044B580/0x0044B770` | `exact-ported`; select Wand action art rather than indexing a Staff sheet |
| All 24 headings, three Wand poses, both hand records and endpoints | Clothes `604..675` and `796..867`; `0x004E4CA0`, `0x00539424..0x00539635` | `exact-ported`; drain all 72 rows, both banks, and both endpoint coordinates |
| All three native Robe styles and item colors | Clothes fixed banks `1612`, `2428`, `2020`, `2836`, each 17 by 24 | `exact-ported`; same Wand fixed pose with each equipped Robe's existing tints |
| Empty weapon and unselected primary | `0x00538B80` fallback and selected-primary `-1` branch | `verified-already-at-parity`; preserve the existing bare/prop distinction |
| Mod Staff wearables | Website wearable slot `staff` | `verified-already-at-parity`; retain the Staff contract |
| Local and remote players in College, Tutorial, and Boneyard | shared living player renderer and strict equipment snapshots | `exact-ported`; no client-owned equipment state |
| Standalone/companion Inventory, selection, hover, drag, swap | InventoryScreen and one weapon sink | `exact-ported`; drawing and pointer ownership agree about the occupied hand |
| Inventory preview and Memorial portrait | equipment-derived static wizard composition | `exact-ported`; display the equipped Wand and the same idle body pose |
| Death and weapon bouncers | separate four-frame death bank and Clothes 15 bouncer | `verified-already-at-parity`; living pose changes do not alter death assets |
| Wand/no-weapon automatic melee | Staff admission `0x00537AA0` checks `0x1B5C` | `verified-already-at-parity`; existing negative movement-contact tests must stay green |

The `exact-ported` rows above are the implementation targets; the final
validation receipt must establish them before this entry is closed.

### Recovered native composition

`0x0054BA80` calls the local attachment compositor `0x00538B80` before and
after the body (third call in the hit-overlay path). The equipped Wand branch
clamps the fixed Robe selector to `14..16`. Raw constants are double
`0x0078C560 = 14`, double `0x007870D8 = 16`, float `0x00784C0C = 14`, and
float `0x00784B20 = 16`.

The Wand attachment branch subtracts 14 from actor `+0x238`, clamps to `0..2`,
and indexes the two three-pose hand banks at Clothes `604..675` and
`796..867`. It draws those hand records and builds the Wand quad from points
0 and 1 of the latter bank. `Item_Wand::RenderAttachment 0x00579820` uses
Clothes 15, logical width 4, and the normalized perpendicular to those exact
endpoints. It does not use Staff points 1/2, Staff depth membership, or either
Staff hand bank. All six Wand inventory selectors share this held material.
At heading 6, idle endpoint coordinates are `(24.5,-3.5)` and `(39.5,-5)`;
the first-cast row uses `(22,-2.5)` and `(28.5,-11)`; the second-cast row uses
`(8.5,4)` and `(9.5,-2)`.

The Wand Cast 1 constructor's authored phase rows are
`[15,15,14,14,14,14]`; Cast 2 rows are `[15,16,16,16,16,16,16]`; Constant
writes 0, which the Wand renderer clamps to idle 14. These facts identify
the native art program; the authoritative Website spell clock and existing
Staff-only held-burst override remain separate from equipment drawing.

Fresh equipment-pane evidence closes the mirrored-hand rule:
`InventoryScreen -> Equip_Render 0x00561300`, specifically
`0x00561AB6..0x00561B41`, checks the current weapon for type `0x1B63` before
the translated second-hand pass. A Wand takes empty-sink renderer
`0x005756F0`; every other weapon/empty branch uses ordinary sink renderer
`0x00575450`. The empty renderer keeps the frame and omits the item.
The Website must therefore retain the second hand's empty frame and make its
item, selection, hover, and drag source empty. Removing the hand box itself
would be a different behavior.

### Review closure: action phase and missing garment

Fresh raw instructions recover distinct Wand clocks: Cast 1 starts with
float32 rate `0.1` (Fire applies the same `0.75` family modifier), Cast 2
uses float32 rate `0.095`, marker 1, and strict end above 6. The shared action
tick advances `p = f32(p + liveFactor * storedRate)` before selecting the
pose table. Neutral Wand Cast 2 therefore shows pose 15 on updates 1..10 and
pose 16 starting at update 11. A countdown inferred from the current skill
rank loses this information if equipment changes the factor during the cast.
The secondary action must retain its weapon kind and float32 progress at
authority and replicate that state; the former Staff-only remaining-ticks
field is superseded, not retained as a second clock.

CastSpin/Dampen is a separate action: mode 21, constructor `0x00448860`,
tick `0x00448DF0`, writes raw K=9 with any held weapon and K=3 without one.
The Wand renderer clamps K=9 to its idle pose 14. It must never reuse Wand
Cast 2 pose 16. Its existing 73-update lifetime remains independent.
Constructors do not write K, so an insertion frame retains the prior pose;
the first action update supplies the new pose.

Removing a mod robe package can leave the robe slot empty while retaining a
native Wand. That valid state must use the complete, tinted native fixed-Robe
banks for poses 14..16 in gameplay and Memorial, rather than indexing the
older ten-frame precolored fallback. Inventory's living preview must consume
custom wearable artwork; native death-shape selectors remain the separate
Memorial/death contract.

The shared spell origin also consumes this equipment choice. Fresh
`0x0053B830` instructions select Staff virtual slot `+0x24`, Wand endpoint
point 1 from Clothes `796 + heading + 24 * clamp(K-14,0,2)`, or point 1
from the heading-only bare-hand bank `484..507`. Ether and Fire call it at
`0x0053DA5E` and `0x0053E50C` before their separate `(0,+10)` launch shift.
The Website's former Staff-only socket assumption must therefore be removed
for Wand and empty-hand emitters while retaining the per-spell launch shift.
All 72 Wand endpoint rows and 24 bare-hand origins are extracted into the
shared weapon attachment program.

Hand Cast 2 constructor `0x0044B5E0` shares Wand's `0.095`, end 6 clock;
only Staff Cast 2 retains `0.1`, end 5. The new authoritative action state
and its wire validation use these distinct limits, including live speed
changes. Saved action state remains transient and resets on disk restoration.

### Validation contract

Re-run the original Mac browser journey after the change. Cover Staff and
Wand swaps, empty weapon, generated selectors and all eight Wand recipes,
idle/travel/primary/secondary pose selection, each heading, both Inventory
modes, and the equipment-derived previews. Run the focused presentation and
equipment tests, the existing no-melee Wand contact regression, generated
atlas checks, and the complete Mac `./scripts/validate.sh` gate on the same
candidate. Record browser page/console/failed-response arrays and the final
changed-file manifest match here.

### 2026-09-05 implementation and validation receipt

The implementation candidate is
`5378997c7326a324f39daeb7085d9d9839367a73`, based on main
`1c75c829813b6c9f54bec7f702bd174db636383d`. This receipt is a subsequent
documentation-only change. All 66 changed files matched byte-for-byte in the
authoring worktree and the detached Mac acceptance worktree; the manifest's
SHA-256 was
`3a2d223232ca76310ff89c9708a1eb7dfd6c74dae70ae9c2f53e8826df59aa09`.

Inventory rendering, selection, hover, and dragging now share the occupied-hand
rule. The second Wand hand frame stays empty. Living players and equipment
previews use the recovered Wand banks, fixed-Robe poses, and item colors;
the empty-Robe case uses the complete native fixed bank. Primary spell
authority selects the equipped weapon's extracted emitter. Secondary casting
replicates the weapon kind and native float32 action progress under protocol
120, with transient action state discarded when restoring a save. Staff and
bare-hand behavior keep their separate native contracts, including Wand's
existing inability to melee.

The inventory action/surface responsibilities and asset extractor were split
into cohesive owners. The inventory renderer uses main's current typography
modules and canvas lifecycle. Mod wearable frame selection has one shared
implementation, and previews consume the equipped living wearable art.
Obsolete inventory renderer copies and the retired HUD font-subset extraction
path were removed. The maintained weapon smoke fixture loads the packed
combat atlas and supplies the current renderer constructor arguments.

Final Mac results:

- `/opt/homebrew/bin/bash ./scripts/validate.sh`: exit 0; 20 Python
  backend/contract tests and 2,837 Node frontend/desktop tests passed, with
  zero failures or skips. Backend formatting/build, frontend lint/type checks,
  production frontend and game-host builds, bundle budget, and production
  media policy passed. Oxlint reported 10 existing warnings and zero errors.
- Chrome `152.0.7977.76`, built client and supervisor, protocol
  `solomon-dark/120`: all eight named Wands occupied one hand; Staff occupied
  both aliases; Wand drag/unequip/swap, standalone and Fomentius companion
  Inventory, equipment preview, and Hub travel passed. The journey crossed
  the native entry gate, approached Solomon, and entered active Boneyard
  combat. Frost held fixed pose 14; primary casting produced 14/15;
  Call Leviathan produced 14/15/16; Dampen held 14 through its spin, with 73
  remaining spin ticks observed. Page errors, console errors, failed requests,
  and failed responses were all empty. The final journey exited 0 and
  completed browser, socket, supervisor, server, and temporary-file teardown.
- `smoke:game:player-weapon`: exit 0; all 1,728 combinations of six Wand
  selectors, three native Robe styles plus no Robe, 24 headings, and three
  action poses matched their rendered body/attachment frames. All 1,728 damage
  overlays used the matching frames. Screenshots were inspected; all error
  arrays were empty.
- Two-client Web Lua wearable smoke: exit 0; custom Hat, Robe, and Staff
  equipped through Inventory and rendered to the observer. The observer image
  contained 4,713 primary and 934 trim pixels; all five walking poses appeared.
  Page, console, and failed-response assertions passed.
- Production Inventory tooltip smoke: exit 0; College and Boneyard covered
  all nine occupied cells, 27/8 perk variants, overlay pixels, and modal
  teardown. Page, console, and network error arrays were empty.
- The focused regression includes every named Wand and all six generated
  selectors making hostile movement contact without starting melee, emitting
  a melee transient, or consuming melee RNG. Cast boundary, live Faster
  Caster, extracted emitter, strict wire decoding, and save restoration
  assertions run in the canonical gate.
- The extractor/packed-atlas check passed: 12,067 frames, 100 sheets, three
  2048-pixel pages. The extractor split was also compared with the original:
  249 outputs were identical and only the two intended Wand sheets changed
  before the separate retirement of unused font subsets. Existing Staff
  extraction differences appeared in both versions; committed Staff art was
  retained.

Measured quality limits: Oxlint's cyclomatic-complexity rule at maximum 21
passed for 23 new/refactored TypeScript owners and the selected presentation
modules, with zero warnings/errors in that scoped run. New owners and the
substantially reorganized Inventory/extractor files are below 1,000 source
lines. Existing large simulation, protocol, and save integration files received
the required wiring changes and remain above that size; this is not a claim
that every touched file meets the file-size gate. No explicit `any` or
`unknown` type was introduced in the new owners.

V8 measured `native-player-weapon.ts` and `native-secondary-cast-action.ts` at
100% lines, branches, and functions. The broader existing
`hub-inventory-presentation.ts` measured 97.36% lines, 94.83% branches, and
91.43% functions; `player-character-presentation.ts` measured 100% lines,
97.59% branches, and 100% functions. Those broader-file gaps remain; full
statement and browser/UI coverage were not measured. Cognitive complexity,
Halstead Difficulty, CRAP, mutation, general dead-code/export analysis, and
duplication analysis remain unmeasured because their analyzers were not
configured/available. No analyzer dependencies or exclusions were added.

The recovered equipment-presentation members above are implemented and have
the stated behavioral evidence. The quantitative limitations are separate
from that parity result. Publication does not deploy or restart production.
Task-owned captures, raw probes, test outputs, and worktrees are disposable
after verified publication; the original supplied video is retained.
