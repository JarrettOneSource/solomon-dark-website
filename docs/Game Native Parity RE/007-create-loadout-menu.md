# Create/loadout menu

## Native functions

- Update: `0x0058A820`
- Render: `0x0059AD40`
- Build/constructor path: `0x00593C30`
- Choice application: `0x005D0290`
- Player-start finalizer: `0x005CFA80`

## Hand state and timing

Direct decompilation and 60 fps capture establish that each hand displays one
discrete sprite at a time. The native game does not alpha-blend two poses.

- `DAT_00819990 + 0x72c`: closed fist.
- `DAT_00819990 + 0x73c`: cupped/opening pose.
- `DAT_00819990 + 0x74c`: raised/open pose.
- Pose selection is threshold-based: speed/state `< 10` selects cupped and
  `< 1` selects raised.
- Initial entry, active left hand: after the Create scene becomes visible, the
  state machine retains the fist through its 120-count anticipation and travel,
  swaps fist to cupped when the damped vector falls below `10`, then swaps to
  raised below `1`. Exact fixed-state replay puts those boundaries at updates
  `132` and `134` after Create construction; scene fades determine their
  wall-clock position in a capture.
- Initial entry, inactive right hand: remains a fist.
- After selecting the left-side element: left raised to cupped at approximately
  `500 ms` after the click.
- The right hand goes fist to cupped at fixed update `63` after it becomes
  active, then cupped to raised at update `66`, coincident with the discipline
  reveal/flash.

Confidence: high. These are visible at frame cadence in lossless 60 fps capture
and agree with the decompiled state thresholds.

## Inactive right-hand lifecycle

The Create renderer owns both hands for the full lifetime of the loadout scene;
the active-hand flag advances a hand's state machine but does not determine
whether that hand is drawn. In the element phase, the right hand is already
present as the closed-fist sprite at native base center `(1200,560)` plus its
inactive travel offset `(50,300)`. It stays visible in that lower-right resting
position until the left hand finishes closing around the selected element.
Control then passes to the right-hand state machine, which consumes the same
travel offset while changing fist to cupped to raised for discipline selection.

Evidence:

- `0x0059BC42`, the recovered right-hand draw path, renders the current discrete
  pose from the persistent Create object rather than gating the draw on the
  right-active flag.
- `%LOCALAPPDATA%/Temp/native-water-discipline-60fps-0811.mkv`, beginning with
  the first captured element-phase frames, visibly retains the closed right
  fist at the bottom-right before its discipline-opening motion begins.
- The read-only Create-state sample documented below records base center
  `(1200,560)` and travel `(50,300)` as separate renderer inputs. The travel
  vector must therefore be applied once, not baked into a phase-specific base
  position and applied again as motion.

Implementation consequence: the web right-hand layer must keep the native
`(1200,560)` base center in both element and discipline phases. Entry motion
owns the `(50,300)` closed offset, so phase CSS must not include a second copy.
The hand remains mounted as a fist before element selection and naturally rises
when the existing selection state machine starts.

Confidence: high from the complete draw-path recovery, live state fields, and
lossless stock capture. The allocator-derived idle-phase difference between the
two hands remains intentionally unspecified; it does not affect visibility,
base ownership, or transition geometry.

## Hand transform and idle clocks

Complete instruction recovery of the right-hand draw path at `0x0059BC42`
shows that the native game does not add a rotation to the right hand. It builds
an explicit transform through `0x004030A0` with X scale `-1.5`, Y scale `+1.5`,
and Z scale `1`. The negative X scale is a pure horizontal reflection. The
left-hand path uses the uniform `1.5` draw helper at `0x00414EA0`. Therefore the
web's right-hand geometry must stay horizontally mirrored at the same scale as
the left; adding a corrective angle would diverge from the native renderer.

Both hands have independent phase fields and identical updates: left phase is
at Create state `+0xdc`, right phase at `+0x210`, and each advances by `0.5`
degrees per native fixed update. A subsequent clean live sample corrected the
initial frame-rate assumption: the phases advanced `79.5` degrees over
`1.5955 s`, or about `49.83 degrees/second`, proving the stock update cadence
is `100 Hz`, not the capture cadence of `60 Hz`. The constructor does not
explicitly initialize these two phase words, and clean runs showed different
constant offsets between them; that is allocator residue rather than a game
rule. The web initializes both phases deterministically while preserving the
native update and renderer. The render path applies these exact offsets in
native screen pixels:

`x = sin(phase) * 5`

`y = sin(phase * 0.5) * 2.5`

This gives a `7.2 s` horizontal period and `14.4 s` vertical period. The prior
web polygonal CSS keyframe happened to use the horizontal period but not the
native sinusoidal path, Y period, or transform ownership, and must be removed.
Idle displacement belongs on the hand sprite inside the entry/selection
translation wrapper so it cannot replace or restart the transition transform.

Confidence: high, from the complete `0x0059AD40` instruction stream, direct
numeric dumps of `DAT_00795444 = -1.5`, `DAT_007847A0 = 1.5`,
`DAT_007DE8D8 = 5.0`, and `DAT_00784750 = 2.5`, plus read-only live phase
sampling. The earlier 60 Hz conversion was explicitly disproved by that sample.

## Selection travel state

A clean direct-stock run with no loader or proxy modules was sampled through
read-only process memory on 2026-08-11. The Create object was found from its
relocated vtable and the fields below were recorded about every 5 ms across an
element click. This confirms the transition is stateful fixed-update movement,
not a CSS-style interpolation between two screen poses.

- The selected-element click sets the element immediately but keeps the left
  hand raised and stationary for roughly the first `500 ms`.
- The left travel fields then depart from `(0,0)`, follow the native recurrence,
  cross the discrete cupped-pose threshold, and settle at approximately
  `(-125.91,+200)` native pixels relative to the raised position.
- Only after that settlement does control pass from the left active flag to the
  right active flag.
- The right hand starts at `(50,300)` relative to its final raised position and
  ultimately settles at `(0,0)`. Its state changes fist to cupped to raised as
  recovered from the velocity thresholds; it does not rotate during that rise.
- Native base centers are left `(400,560)` and right `(1200,560)`. These are
  combined with the travel fields and the shared sine drift in the renderer.

The clean sample also resolves the left recurrence exactly. After the native
delay expires, each `10 ms` fixed update executes its movement substep twice:

`x -= y / 30`

`y = min(200, (y + 0.25) * 1.05)`

Starting at `(0,0)`, fixed update 38 produces `(-125.91012,200)`, matching the
live endpoint within float precision. This is why a generic cubic ease makes
the closing hand look wrong. The web may encapsulate the recurrence as a pure
sampled function, but it must not replace it with another authored curve.

The web must therefore keep position and pose as outputs of one transition
clock, hard-swap one raster at each state boundary, and keep idle drift on a
separate inner transform. Independent outer CSS animation and React pose clocks
can disagree by one frame and were the source of the visible shaking.

Confidence: high for field ownership, endpoints, ordering, and absence of
rotation, from `0x0058A820`, `0x0059AD40`, the direct object dump, and clean
lossless captures. Sub-frame randomness in the native travel recurrence is
visual noise and need not be copied into browser layout.

## Painter order

Native render order is:

1. left hand;
2. selected element effects and glyphs;
3. right hand;
4. discipline glyphs and selection foreground.

Consequences:

- The right hand must not cover discipline runes.
- The left hand must not incorrectly cover the selected element foreground.
- Web transitions must hard-swap sprite poses at recovered thresholds; CSS
  crossfades or independent animations cause the observed shake/double hand.

Confidence: high, from `0x0059AD40` and reference frames.

## Exact Create geometry, wheel clock, and entry anticipation

A second clean direct-stock process (`SolomonDark.exe`, no loader/proxy/mod
modules) resolved the remaining layout fields from the live Create object and
the complete constructor/render instruction streams.

- Create record `7`, the `276 x 276` arcane wheel, is drawn at native center
  `(800,800)`, opacity `0.05`, and scale `3`, so its authored frame is exactly
  `828 x 828` pixels. The web's previous `621 px` frame was not a responsive
  variant; it was simply underscaled.
- The renderer uses integer tick field `+0x28 / 50` as the wheel angle. Two
  read-only samples separated by `2.30 s` advanced that field by `1124`,
  consistent with the shared renderer clock at about `500 Hz`; division by
  `50` therefore yields about `10 degrees/second`, or a `36 s` revolution.
  A `900 s` CSS revolution is not native.
- The five settled element centers in constructor order are
  `(826.303,369.046)`, `(924.909,515.235)`, `(816.346,654.189)`,
  `(650.644,593.879)`, and `(656.798,417.651)`. The switch and glyph order map
  those to Ether, Fire, Air, Water, and Earth respectively.
- The discipline centers are exact constructor constants: Arcane
  `(1025,460)`, Body `(875,460)`, and Mind `(725,460)`. Their native Create
  records retain their authored dimensions: `218 x 238`, `238 x 229`, and
  `227 x 241`. A uniform `144 px` DOM width discarded both native size and
  per-discipline proportions.
- The settled selected-element anchor is the left-hand effect position at
  `(450,660)`. The selected painter is the same
  element-specific VFX dispatcher. Its caller starts from Create scale `2`
  and multiplies by the settled selected-scale field `3`, so the painter entry
  receives `6`; it is not a second enlarged DOM glyph.

The selected effect does not teleport from its picker to that anchor. The
element-click path at `0x0058BCE0` stores the clicked picker center in Create
fields `+0x1ac/+0x1b0`, initializes a 50-update hold at `+0x1a8`, zeroes path
cursor `+0x1f0`, and builds a three-point natural cubic through:

1. the selected picker center;
2. `(650,685)`;
3. `(450,660)`.

The five possible first points are the exact centers above. After the hold,
each native fixed update executes two selection substeps. A substep advances
the left-hand recurrence, evaluates the natural cubic at the previous cursor,
then assigns `cursor = leftY / 200 * 2` and
`selectedScale = leftY / 200 * 2 + 1`. This one-substep ordering is observable:
the effect initially remains centered on the clicked picker, then follows the
curved hand-closing path while growing continuously from painter scale `2` to
`6`, and finally lands exactly at `(450,660)`. A clean no-mod Air sequence at
`/tmp/native-create-air-0000.png` through
`/tmp/native-create-air-1200.png` independently shows the hold, curved travel,
growth, and hand closure. Rendering the selected VFX at its final anchor from
the first React frame therefore bypasses native state rather than merely
having different easing.

The initial hand movement is likewise a native state sequence, not an ease.
Both fists begin at offsets left `(-50,+200)` and right `(+50,+300)`, with a
shared `120`-tick countdown on initial Create entry. Between countdown values
`99..1`, while each hand is still in state `0`, stock generates a small random
direction impulse, increments Y by `1`, and applies the X recurrence
`x = (x - 0.01) * 1.01`. The `0.01` is the double at `0x00784D08` used by the
`FSUB` at `0x0058B056/0x0058B8D7`; the decompiler's nearby float view of the
overlapping constant pool incorrectly suggested `2`. Native float32 replay is
decisive: the discipline-side hand reaches exactly `(81.58047,350)` after its
50 pre-open updates, matching the clean live sample. At countdown zero it
starts a deterministic recoil:

`bobY = sin(recoilPhase degrees) * 150`

`recoilPhase = max(0, recoilPhase - 0.025)`

The phase begins at `0.5`, so this is a short decaying downward anticipation
whose peak is about `1.31 px`, layered over the fist travel and ordinary idle
sine. On every countdown-zero-and-later update, stock first shortens vector
magnitude by `3.5`, then applies anisotropic damping (`x *= 0.7`, `y *= 0.8`)
and hard-swaps fist to cupped below speed `10`, then cupped to raised below
speed `1`. The pre-open recurrence remains active only while state is fist.
The right hand is activated with timer `51`, so its first update produces
`(50.48990,301)` at timer `50`; update 50 produces `(81.58047,350)`, update 51
begins damping at `(57.10561,278.27310)`, update 63 swaps cupped, and update 66
settles raised at `(0,0)`. Random impulse direction is presentation noise; the
web should preserve the recovered countdown/travel/recoil envelope
deterministically, with one state sampler owning position and pose. Independent
CSS shake and sprite timers recreate the old visible jitter and are forbidden.

Confidence: high for dimensions, centers, selected-effect path/clock/scale,
draw scale, countdown, recurrence, recoil, and state thresholds from
`0x0058BCE0`, `0x0062B2F0`, `0x0062BCA0`, `0x00593C30`, `0x0058A820`, `0x0059AD40`,
the exact instructions at `0x0058AFDE..0x0058B06A` and
`0x0058B852..0x0058B8EB`, direct numeric dumps, float32 replay, and the clean
live object trace. Wheel speed confidence is high within scheduler sampling
tolerance. The exact native RNG stream is intentionally not presentation
state.

## Element VFX projection and Create context scale

Bundle metadata confirms that BadGuys element frames already occupy native
logical cells (`27 x 26` core, `40 x 40` spark/ray, `50 x 50` Earth,
`32 x 54` Fire, `38 x 36` Water, `55 x 59` Air). There is no hidden 2x atlas
density to compensate for. The painter call `0x00414EA0` receives its recovered
scale directly. A clean runtime breakpoint also exposes the common-core quad
vertices as `(-13.5,-13) .. (+13.5,+13)`, exactly matching the `27 x 26`
source cell. Therefore the web VFX canvas must project one canvas pixel to one
virtual-stage pixel. There is no hidden reciprocal sprite-density scale.

The Create caller has two distinct scale contexts which an earlier pass had
collapsed into one:

- each of the five settled picker effects receives `menuScale * 2 = 2`;
- the effect held after selection receives `menuScale * 2 * selectedScale`;
  `selectedScale` is initialized to `1`, then the selection recurrence assigns
  `selectedScale = selectedY / 200 * 2 + 1`. At the recovered `selectedY = 200`
  endpoint it is `3`, so the settled held effect is `6`.

A clean breakpoint at Ether entry `0x00535A30` on the discipline screen
captured `scale = 6` on the settled discipline screen, independently verifying
the recurrence and caller formula. This is the source of the native large held
orb. The web must keep picker `2`, held `6`, and staff `1`; scaling the whole VFX system to
quiet the picker would break both the held and staff contexts. Picker buttons
also must not apply a second CSS drop shadow around an already self-lit native
effect.

The native painters draw into the full `1600 x 900` backbuffer; they do not own
a local clipping rectangle. A browser canvas used as an implementation surface
must therefore be sized for the maximum registered sprite extent in its
context. The settled held core alone can reach approximately
`27 * (3.5 + 0.15) * 6 = 591.3` pixels wide, before Ether particles or ray
rotation. A `360 x 360` canvas clips that native scale into a visible square.
Use a centered `720 x 720` backing surface for the held context and preserve
one backing pixel per virtual-stage pixel; picker and staff contexts can retain
`360 x 360`. This is a backing-surface correction, not a new draw scale.

The subsequent oversized opaque Air disk was not evidence for another scale.
The web animation loop called `clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)`, where
`CANVAS_SIZE` was the complete variant-to-size object. Canvas numeric coercion
turned both dimensions into `NaN`, so the clear was a no-op. Air's four
additive common-core passes accumulated on the same backing pixels every 60 Hz
tick until most of the held extent saturated white. Native submits a fresh set
of quads into the newly cleared frame and retains no prior element pixels.
Every web VFX tick must therefore clear the selected canvas's actual backing
dimensions before drawing the current plan. A valid regression must sample
after multiple seconds, not just the first frame: the held Air center may be
bright, but its alpha footprint and average opacity must remain bounded rather
than converging toward an opaque disk.

Confidence: high from all participating bundle records, the shared painter
call sites, the live quad/entry breakpoint values, clean native/web 1600x900
comparison captures, and direct inspection of the browser backing pixels after
the failed clear had accumulated for several seconds.

## 2026-08-28 element-fork/ray cadence reopening

The dedicated [Create element-fork and ray cadence correction](<296-2026-08-28-create-element-ray-cadence-correction.md>)
supersedes the web phase source implicit in the first WebGL port. All five
Create element painters read the free-running 100 Hz application tick
`0x0081F658`; they do not advance at a scene-local 60 Hz conversion. This
restores Air's eight-tick fork bank to 80 ms, corrects Ether record-112 opacity
to `8` degrees per tick, and retains Water's separate `11`-degree row.
Geometry, scale, assets, pass count, blend, and painter order above remain
authoritative.

## 2026-08-29 — Create hand page-boundary sampling reopening

### Reported smell and parity question

- Reported web behavior: after the Title Solomon edge correction, the Create
  loadout hands still expose straight texture boundaries.
- Stock behavior to recover: each pose is an ordered draw of exact
  `Create.png` records on the shared retail page. The logical `420 x 469` hand
  canvas is placement metadata; it is not a new repeating texture page.
- Reproduction: Website `41ec3c8f38899b8da88fd11d66bbbb03858ce20d`,
  production Chrome `151.0.7922.174` through ANGLE Metal on Apple M2,
  `1600 x 900`, settled element and Fire-discipline screens. The element frame
  visibly contains a straight line at the raised left-hand top boundary.
- Falsifiers: changing hand centers, scale, mirror, pose clocks, pose painter
  order, or masking the line; fixing raised while fist/cupped retain the same
  flattened repeating-page path; or accepting source-policy assertions without
  the matching built frame.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail data | byte-identical `native-ui-create-atlas.png`, Create atlas SHA-256 `9c629ccd3d859384446363ac50e90c19e55f8d5ef8cd17d25604f5a67f3d08eb`; records 14..23 | Fist is ordered records 14/15, cupped is 16..19, raised is 20..23. Every record owns logical size `420 x 469` and exact trim placement. | high |
| Website extractor | `compose_logical_records` in `tools/extract-main-menu-assets.py` | The web flattens each pose onto a new transparent `420 x 469` bitmap, discarding the retail page neighborhood. | high |
| Pixel census | `create-hand-{fist,cupped,raised}.png` at `41ec3c8f` | Fist/cupped top rows have zero alpha while their bottom rows contain 169/180 nonzero-alpha pixels; raised has 3 top and 170 bottom. Opposite-edge PMA deltas reach 255. | high |
| Web renderer | `create-menu-renderer.ts`, `CREATE_COMPOSITED_ASSET_SOURCES`, PMA/linear/repeat source policy | Every pose is drawn as one `420 x 469` repeating source at scale `1.5`; bilinear samples at the logical top can read the unrelated bottom sleeve/skin edge. | high |
| Built browser | `/tmp/texture-edge-net-baseline-element.png`, SHA-256 `1d57845ccdfd39beabb13b69079dc681037401f41dd8d85213c2f43af39f4302` | Rows 211/212 across the left-hand bounds have mean adjacent RGB deltas `5.4619/5.8683`; surrounding rows remain below `1`. Page/console arrays were empty. | high |

No injected runtime or stale address is used. Native record membership and
draw order were already instruction/data-closed above; this report adds the
missing page-domain evidence.

### System boundary and membership inventory

Native system: **Create page records through hand-pose assembly** — every
active Create atlas record, the two UI records used by Create chrome, pose
selection, left/right submission, reflection, and scene teardown.

| Member | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Arcane/Body/Mind, prompts, stars, dice, wheel, five element glyphs | Create 0..13 | `exact-ported` from the complete Create page | exact frame map and element/discipline captures |
| fist | Create 14/15 | `exact-ported` as two ordered page-record sprites | entry and inactive-right capture |
| cupped | Create 16..19 | `exact-ported` as four ordered page-record sprites | left close/right open threshold captures |
| raised | Create 20..23 | `exact-ported` as four ordered page-record sprites | settled element/discipline captures |
| left and mirrored right consumers | `0x0059AD40`, left scale `+1.5`, right X scale `-1.5` | `verified-already-at-parity` after shared record cutover | both hands, all poses, exact centers and mirror |
| Back skull and name frame/end/rail | UI 42/80 and record-80 rightmost-column slice | `exact-ported` from the complete UI page | exact source/frame and responsive capture |
| rendered `WIZARD NAME` and clear glyph | Fonts group 1 Website-composed labels | `verified-already-at-parity` as true PMA composites | composite clamp policy and name-field capture |
| five element VFX painters | exact BadGuys records | `verified-already-at-parity`; separate page owner | existing all-five Create VFX receipt |

### Recovered contract and implementation consequence

- Load the exact Create and UI pages for the scene. Records 0..13 remain
  ordinary page subtextures. Each hand owns four reusable child sprites;
  switching pose assigns the ordered record row and hides unused children.
- Every hand child uses its record's native logical size/trim, shares the hand
  center, and receives the existing container scale/mirror. This reproduces the
  native multi-record painter without changing motion or geometry.
- Retire loose Create-record crops from active `/game` source membership.
  Only the two genuinely rendered text labels remain Website composites.
- The renderer source-policy contract, not a hand-specific mask, owns the
  broader prevention rule documented in renderer ledger 287.

### Validation contract

- Focused tests pin all 24 Create records, the three hand rows, UI 42/80,
  complete pose order, logical size, left/right mirror, and absence of loose
  hand/Create crops from active scene sources.
- Built Mac Chrome captures entry fist, cupped transitions, settled raised,
  inactive right fist, and mirrored right cupped/raised. The former row-211/212
  interval must agree with neighboring rows and every error array must be empty.
- Repeat the element and all three discipline screens at stock and non-integral
  responsive scale, then run the canonical Mac gate on the exact candidate.

### Implementation and browser receipt

- Create now loads the complete Create and UI pages. Records 0..13 and UI
  42/80 are framed from those pages, while each hand is a four-child container
  that submits the exact ordered pose row: fist 14/15, cupped 16..19, raised
  20..23. Pose thresholds, `420 x 469` logical size, centers, `1.5` scale,
  right-hand reflection, motion clocks, and painter order are unchanged.
- Active Create WebGL source membership is closed at six pages: exact Create, exact
  UI, exact combat page 0, exact point-font page, and the two rendered name
  labels. No loose Create record or flattened hand source is loaded.
- The production responsive journey passed in Chrome `151.0.7922.174` at
  `1600 x 900`, `896 x 414`, `2560 x 1080`, and `1200 x 1000`, covering both
  settled element and Fire-discipline hand poses. Every receipt reports Create
  and native pages as repeat/NPM, rendered labels as clamp/PMA, and empty
  page/console/response error arrays.
- In the former stock left-hand seam interval x `85..714`, the row-211 adjacent
  RGB delta fell from `5.4619` with `228` pixels over threshold to `0.0079`
  with none; row 212 fell from `5.8683` to `0.4042`. The baseline image hashes
  to `1d57845ccdfd39beabb13b69079dc681037401f41dd8d85213c2f43af39f4302`;
  corrected stock element/discipline images hash to
  `f3ddb8c4896663c9dbaf3e4cf6025d7147e13550d2dfeca112209bd79727ee57`
  and `814ae0362309da89aeaa6622bb029422ed5b238edc53ac93ae0e3b90d2a4900e`.
- Fractional/aspect coverage is independently retained by the mobile element
  image `8b3575eef4a279ba2e26c75cc5435bccb333c02cbe9764ccb215cdcb6a5dce90`
  and tall discipline image
  `bc0af8c0f91db52907871b20cfdbf3d5bebe4fac5ec05227b732ab508dccbb6c`.

## 2026-08-30 — Create element-VFX record-edge reopening

The reported straight lines over Water and Ether reproduce in the settled
Create element screen; Fire shares the same record constructor and had shown
the artifact on other animation frames. This is not a hand-page recurrence or
a Region-layering error. All five element views are sibling
`NativeElementVfxView` instances in one Create painter stack, and the residual
lies exactly on registered BadGuys texture edges.

Untouched `a554ea73`, Chrome `151.0.7922.174`, `1600 x 900`, application tick
`513` shows Water's two-row horizontal residual at Y `555..556`. Across X
`560..709`, adjacent-row mean RGB deltas are `17.9933/16.8267`; surrounding
rows remain below `3.66`. Ether shows the same top-edge class. Screenshot
SHA-256 is
`a9fc1a5f8b1f1e3360a9fb92148b64da26d3e1d4939bbfa2e3e5c30e77f321e3`.

Fresh decompilation of the one common retail record constructor
`0x00413DE0`, called by record reader `0x00413B10`, falsifies the earlier
assumption that Pixi's default frame UVs are the native record UVs. For record
rectangle `(x,y,w,h)` on page `(W,H)`, every shipped unrotated record stores
`(x+0.5)/W`, `(y+0.5)/H`, `(x+w+0.25)/W`, and `(y+h+0.25)/H` at descriptor
`+0x4C`; `0x004143D0/0x00414540 -> 0x0041E990` submit those values unchanged.
The full 10,498-record rotation census is zero, so this formula covers the
complete retail table.

Create's complete element membership remains Ether `110..112`, Fire
`110/255..266`, Air `110/1836..1839`, Water `110/112/271..282`, and Earth
`110/238..245`. Their timing, transforms, scale, color, blend, and painter
order remain unchanged. The shared retail-record texture owner now applies the
native UV domain to every member; the fix is not a Water mask or line eraser.
At candidate tick `517`, which retains Water record `275`, the former row
deltas fall to `3.3044/3.4467`; Water and Ether have no visible straight edge,
and Fire remains stable. Candidate screenshot SHA-256 is
`c541417b860ffa21c54c6d84be279a05c437909256c2f371e17963ed147d6aae`.

Acceptance extends the responsive Title/Create browser journey with exact
runtime UV diagnostics for Ether core/ray, Fire record `258`, and Water record
`275`, plus a live mobile-to-tall Create resize on the same mounted canvas.
The complete renderer-wide source/page membership, sibling migration, and
final gate receipt remain owned by renderer entry 287.

Production Chrome `151.0.7922.174` passes the expanded journey at stock,
mobile, ultrawide, and tall layouts. The same mounted Create canvas survives a
mobile-to-tall-to-mobile resize with its exact UV tuples unchanged, all five
element views visually clean, and empty page/console/response error arrays.
The inspected stock and live-resize frames hash to
`54f48bb7f9de3167e763b93286a774f5adc1ca75cc8f7d3951212684d1ef7978`
and `74d3a81941a64aca6b9b1b93dd66c060c8f2b541aecba8fa615a87d67e7c2c05`.


## 2026-10-11 — Report 108: Create Randomize and complete secondary-root domain

### Reopening, evidence and boundary

The previous record-6 membership row proved only artwork. It did not follow
its native input owner into character finalization, so the visible dice had no
semantic web control. This reopening closes Create's missing-choice
finalization and its actual downstream character consumers. It adds neither a
preview reroll nor a new name generator.

Fresh static evidence uses retail 0.72.5, SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred
base `0x00400000`. The complete causal functions, relevant vtable, literal
strings and constants were read directly with the installed LLVM objdump and
Capstone 5.0.7 on Mac. No new native runtime recording is claimed. The fresh
Discord recheck at 2026-10-11 05:11:13 UTC retained report message
`1558622450021834843` unchanged.

Native system: **Create commit of manual or missing primary/secondary choices**,
from scene construction, all input/phase branches and teardown through the
Game finalizer, eight progression roots, character identity, and persistence
or replication of that identity. Existing garment construction is a shared
consumer, not a second randomizer. The implementation and focused built
acceptance below are complete. Canonical exact-commit validation and final
independent receipt review remain release gates, not implied by these results.

| Member | Native owner and recovered contract | Disposition |
| --- | --- | --- |
| Fresh entry and scene reentry | ctor `0058A500`, called by Office `00504B4E` and Game `005D087D`; fresh selections `+1A4/+22C=-1`, fade `+78=1` | implemented; fresh/retained/Back/route reentry browser proof |
| Top-right dice input and art | Build `00593C30`; child `+49C` at `(width-84,0)`, size `84x60`; record 6 is `80x54`, centered by `0059C05A..0059C0A4` | implemented; exact geometry test and desktop/touch screenshots |
| Entry input exclusion | callback `0058EA50`, manual click `0058BCE0`, hover `0058BB50` all reject while `+78>0`; 20 updates reach zero | implemented; native fade test and semantic ready guard |
| Unselected primary | `005D0300..005D03FA`: ordered eligible pool Ether, Fire, Air, Water, Earth, filtering Game disabled flags for primary skills 8,16,24,32,40 | implemented; complete ordered-pool kernel assertions |
| Already selected primary | `005D02F7..005D040B`: retain it with no primary RNG draw, including when dice is pressed during the hand transition | implemented; no-draw tests and all five mid-transition browser choices |
| Empty eligible-primary pool | Integer(0) consumes no word; native zero-filled list extension selects root 0/Ether | implemented; exact fallback/no-draw assertion |
| Unselected secondary, ordinary branch | Integer(3) result other than 1 consumes another Integer(3): 0 Arcane/root7, 1 Body/root5, 2 Mind/root6 | implemented; all 15 ordinary pairs and exact RNG vectors |
| Unselected secondary, elemental branch | Integer(3)==1 repeatedly draws Integer(5) until distinct from primary; this secondary draw does not use the disabled-primary pool | implemented; all 20 distinct pairs and rejection/draw-count assertions |
| Every manual primary by discipline | five primary roots × three authored choices, existing root/starting-spell mappings and ordinary selection choreography | unchanged picker; 15-pair domain assertions and all five manual primaries in browser host/peer journeys |
| All mixed roots and labels | 20 distinct elemental pairs reachable by dice; all 25 elemental-secondary pairs resolve to literal WIZARD in class lookup `00658B40` | implemented; all 25 fallback labels and 40 accepted codec/save pairs |
| All 15 named classes | existing table in `native-wizard-class.ts`, recovered function `00658B40`, literal range `0079FE08..0079FEA8`; unchanged membership recorded in ledgers 118/295 | unchanged table; complete existing class-title regression |
| Name draft and empty-name default | update `0058A8B3..0058A983` copies the same TextBox; empty uses Genericus; no dice name write | retained ledger 108; dice/manual name, reroll, account and Genericus browser assertions |
| Dice completion and cue | callback plays click and clears `+BD/+BE`; update's separate fade exits in 23 ticks/230 ms; bypasses catch-it | implemented; exact unit timing and eleven measured browser commits, one click/no catch each |
| Ordinary completion and cue | selected-right-hand recurrence calls catch-it at `0058BAF7`, then clears phases; existing web commit/loading policy in ledger 054 remains | unchanged 880 ms web choreography; helper cue/timing test and manual browser regression |
| Interruption, repeated input and teardown | virtual destructor `0058EA30 -> 0058A730`; child controls and Create streams die with the scene; pending web submission must not escape unmount | implemented; cancellation/late-failure tests, repeat guard and actual browser Back during pending commit |
| Ordinary, retained next-wizard and first College confirmation | same choices and authoritative commit, different retained connection/garment lifetimes; ready peers cannot recommit | implemented; authoritative-confirmation tests, both peer orders, retry/save browser proof; existing College replacement tests |
| Starter clothes and downstream appearance | shared `005CFA80`, only callers `005D0756/005D24FF`; complete five-family, College guard and Tutorial contracts already in ledger 284 | unchanged owner; expanded 40-pair fresh-generation matrix and existing College/Tutorial regression |
| Protocol, save, social identity, Inventory and Hall | eight-root identity is consumed by existing web boundaries; native class lookup callers `00562C51/005A1B46` | implemented; protocol 152, real-host 151 rejection, 40-pair round trips, signed backend and Hall migration tests |
| Automatic/restored startup and test/Tutorial/College bypass flags | finalizer sibling call `005D0840`, startup sibling `005D24FF`; existing non-Create scene owners select their explicit startup mode | out-of-system for new behavior; do not alter their established policy |
| Name-only reroll, account identity, bot selection menu and mod authoring | separate existing web conveniences or caller-owned choices | out-of-system for adding controls or changing defaults |

The Create vtable starts at `00797B7C`: deleting destructor `0058EA30`, build
`00593C30`, update `0058A820`, render `0059AD40`, child callback `0058EA50`,
manual click slot `+64=0058BCE0`, hover slot `+68=0058BB50`. The only direct
`005D0290` calls are `0058A96D` and `005D0840`. This distinguishes the actual
constructor from the old ledger's imprecise constructor/build label.

### Exact random selection, timing and compatibility

The native finalizer supplies only missing choices. Primary IDs 0/1/2/3/4 map
to Ether/Fire/Air/Water/Earth, starter primary skills 8/16/24/32/40 and starter
secondary skills 11/21/27/35/45. Ordinary secondary choice IDs 0/1/2 map to
Arcane/Body/Mind and roots 7/5/6. Both roots are stored independently; elemental
secondaries do not replace the starter primary or grant its starting spell.
The existing progression root filters must admit later offers from both roots.
All eight base roots still initialize to rank 1.

Use the existing `native-rng.ts` owner. Integer `00401170` shifts a lagged
30-bit word by six, masks to the next-power-of-two range and takes modulo N.
Thus `Integer(3)==1` is the exact branch, not an unbiased one-third shortcut.
Keep draw order, selected-choice no-draw branches and distinct-secondary
rejection. Native application RNG history is not a portable Create input;
new browser scenes may seed their own stream, using the same range algorithm.
Stock web scenes currently expose all five starting choices. Eligibility
filter behavior belongs in the recovered pure finalizer, without adding new
settings or disabling ordinary manual choices.

The callback's fade guard and update use double constant `007DE8A0 =
0.05000000074505806`, with float32 storage each tick. Entry from 1 reaches
zero at update 20. Completion from zero first exceeds float32
`00785150 = 1.100000023841858` at update 23. Do not reuse the web's 880 ms
manual hand-catch duration or emit catch-it for dice. The established web
loading barrier begins at accepted commit and owns the loading art, as in
ledger 054; this does not expose a new preview or change name-only reroll.

Character secondary typing and all validators must admit eight known roots,
while the ordinary manual picker stays three choices. Protocol 151 cannot
read these new enum values, so the release must move to protocol 152. Existing
ordinary save shapes remain readable, and portable/native root integers are
0..7. A save version bump alone would not protect older web readers, which
accept compatible future versions. Local Hall storage needs an isolated new
namespace with preserved legacy import: its old reader rejects a whole array
containing an elemental secondary and later overwrites it. Public Hall output
also needs explicit backward-readable handling for stale non-gameplay clients.

The trained bot observation shape must not expand: its three discipline bits
mean exactly Mind/Body/Arcane. Elemental-secondary configurations leave these
bits zero while retaining the existing primary element one-hot. Human allies
have no discipline bit fields. No model training or policy schema change is
part of this repair.

### Acceptance obligations

First reproduce failing existing type/guard, progression, class and semantic
control boundaries. Then verify native RNG vectors and draw counts, all five
primary roots, three ordinary secondaries, twenty distinct mixed pairs,
selected-choice preservation, eligible/empty pools and every class label.
Exercise authoritative fresh/replaced loadouts, both-root offers, unchanged
starter spells/garments, strict unknown-value rejection, client hello/input/
confirmation/social/snapshot codecs, local/cloud saves, portable/native
round trips, Hall merge/storage and signed backend leaderboard admission.

Built Mac browser acceptance must use actual dice hit targets with mouse,
keyboard and touch, fresh and mid-transition phases, each chosen primary,
ordinary and mixed results, untouched name/Genericus, repeated input,
unmount, failed-start retry, retained creation and ready/unready peers.
Verify the authoritative ready snapshot rather than treating a local
confirmation send as acceptance. Check exact responsive art/hit alignment,
cue ownership and commitment timing; run ordinary manual regression journeys.
The exact final source requires the canonical Mac validate.sh gate, a complete
independent diff review and fresh built acceptance before coordinated release.
No live release is claimed by this ledger.

### Implemented boundary and pre-freeze evidence

`native-create-loadout.ts` owns only the recovered missing-choice rules and
the native RNG stream. `CreateMenuScene.tsx` captures one configuration and
uses a shared cancellable finalization owner for manual and dice paths.
The browser's animation-frame functions are called through window-bound
wrappers: a first headed run caught the invalid receiver of bare native
functions, and the narrow binding fix passed the complete replay.
Retained confirmation remains pending until an authoritative matching ready
snapshot, with duplicate, disconnect, destroy, send failure and timeout
ownership explicit in `game-client-session.ts`.

The schema keeps ordinary saves readable and accepts the full native 5×8
domain, including equal elemental roots imported from native saves. This is
different from dice's 35 eligible results. Old protocol-151 player and observer
hellos were sent to the real host: both received protocol-mismatch and close
1008 with “Protocol 152 is required.” before ticket claim or player admission.
The existing client failure mapper supplies the refresh-required explanation.
Local Hall writes use v3, while independently importing v2 read-only on every
read; public Hall GET defaults to ordinary disciplines unless the caller
explicitly requests `mixedRoots=true`. Filtering precedes top-100 selection.
Signed receipt verification, unknown-value rejection, idempotency and account
ownership remain enforced by real-backend tests.

Mac mini M2 headed Chrome 154.0.8037.98 loaded the built Website against the
real local game host. `smoke-create-randomize.mjs` passed eight journeys:
ordinary fresh entry, both random branches, all five selected primaries during
motion, keyboard/mouse/touch, retained next-wizard composition, ready/unready
peers in both orders, Genericus, duplicate input and saved mixed identity.
Actual Create Back/reentry and browser Back during finalization produced no
host admission; Forward/reentry then started successfully. Eleven accepted
dice commits measured 230.9–257.5 ms from click to send, each with one click
cue and no catch-it cue. Page, console, HTTP, host and unexpected-API error
arrays were empty. Stock/touch hit bounds and rendered dice were inspected.

These are production composition journeys, with explicit test controls:
local authentication/API fixtures, fixed Create entropy and host seed, and
accelerated run completion through the production damage/death owner.
Only the retry case injects one WebSocket send exception; it then verifies
the real ready snapshot and persisted save after retry. No UI phase,
selection or loadout-ready flags are assigned by the harness. Separate
`smoke-create-wizard-name.mjs` headed journeys passed ordinary anonymous and
fixture-account creation, retained manual selection, all five primary choices
across host/peer, clear/name-only reroll, repeated entry and local/cloud
checkpoint identity. No real cloud account was used.

Raw receipts, screenshots, red/green tests and the failed first browser run
are retained in the task-owned `solomon-create-randomize-sh9aksle-20261011`
acceptance roots. `candidate-focused-acceptance.json` binds these receipts to
the frozen commit and complete source manifest. The independent M5 canonical
`scripts/validate.sh` receipt and final independent review must match that
same identity before coordinator integration; neither gate is replaced by
the focused tests or these screenshots.
