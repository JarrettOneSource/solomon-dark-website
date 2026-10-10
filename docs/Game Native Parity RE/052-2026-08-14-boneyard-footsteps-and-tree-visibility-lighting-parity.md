# 2026-08-14 — Boneyard footsteps and Tree visibility/lighting parity

> The 2026-10-10 reopening at the end of this entry supersedes the historical
> Tree uniform-alpha, forty-tick, all-edge exclusion and camera-independent
> scan claims. The old receipts remain historical observations of the earlier
> web implementation, not proof of the now-recovered native painter branch.
> The unrelated footstep and Terrain sections retain their recorded scope.

## Reported smell and parity questions

Three visible symptoms were reported together: Boneyard footsteps did not
sound like stock, Tree lighting appeared suspect, and Tree art stayed opaque
when it covered the local player. They share presentation ownership but not
one guessed material rule. The investigation therefore traced the native
footstep surface virtual, the complete Tree tick, both Tree painters, the
Region-light dispatcher, and the current browser scene/audio and resident
texture owners before changing code.

The implementation is falsified if it plays footsteps from client velocity
inference, classifies wood from a generic Road or Terrain overlap, lets a
remote participant fade the viewer's Tree, uses image-alpha pixels as the
occlusion shape, fades only one Tree pass, or leaves the Tree secondary pass
white while the main pass receives Region lighting.

## Evidence and provenance

| Evidence class | Exact source | Recovered result | Confidence |
| --- | --- | --- | --- |
| Retail executable | `SolomonDark.exe` SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; read-only Ghidra project | Player cadence and surface path; RegionLayout bridge derivation; Tree constructor, setup, fixed tick, main painter, secondary painter, bounds, polygon test, and Region-light dispatch. | high |
| Initialized retail data | Read-only live float32 dump of preferred table `0x0081C480` after static initializer `0x005BF6A0` | Exact eight Tree-local secondary polygons, including the native radial expansion and Y translations. | high |
| Stock audio | `sounds/woodstep.wav`, `sounds/Step/Step 1.wav`, and `sounds/Step/Step 2.wav`; native audio registry and wrappers | Ordinary Boneyard ground uses Step1/Step2 at gain `0.5`; exact derived river bridges use woodstep at gain `0.5` and pitch `[0.9,1.25)`. | high |
| Stock-generated web bank | All twelve checked `native-generated-boneyards.ts` templates | Every template contains `terrain: []`; none can materialize the style-zero river mesh or derived bridge predicate. | high |
| Browser source | `BoneyardScene.tsx`, `MainMenuScene.tsx`, `game-audio-native.ts`, `boneyard-world-renderer.ts`, `editor/render.ts`, and `native-render-plan.ts` at analyzed baseline `a272433` | Boneyard never consumed authoritative `footstepTick`; main Tree residents sampled root lighting, while all Tree/Building foreground art was flattened into one permanently white, permanently opaque texture. | high |

The exact initialized polygon vertices are retained in the companion native
ledger at
`../Mod Loader/docs/reverse-engineering/native-boneyards-and-world.md` under
“Tree local occlusion alpha and secondary lighting.” A second read-only dump
of table `0x0081C2F0` proved every native `(x,y,w,h)` record is exactly the
corresponding expanded polygon's float32 bounding box. These are initialized
retail values, not vertices or bounds inferred from the sprite crop.

## Native footstep ownership and surface contract

`PlayerActor::Tick 0x00548B00` owns footsteps inside the movement branch. The
per-tick squared displacement must be strictly greater than `0.01`; player
byte `+0x5C` must be zero; and the shared 100 Hz tick must be divisible by 25.
The event is therefore local-player-only and at most 4 Hz. Collision does not
cancel a request that already passed the movement gate. State `+0x154 == 2`
selects splash registry 216..219. Otherwise Region vtable slot `+0x118`
selects either registry 104 `woodstep` or registry 214..215 Step1/Step2. Both
ordinary paths multiply Region attenuation by the global scalar `0.5`.

Arena implements that virtual at `0x004679B0`. It returns true only when the
player root lies strictly inside one of RegionLayout's derived bridge quads.
Rebuild owner `0x00653BF0` clears and recreates the bridge list from Roads
crossing the central mesh band of style-zero river Terrain. Terrain helper
`0x00651BF0` consumes the randomized vertex mesh built by `0x0064FA90`, not
the serialized control line or a painted stroke. Each crossing uses exact
DeadHawg record 319, a `72 x 135` crop on a `200 x 200` logical canvas, local
quad `(-36,-67.5)..(36,67.5)`, scale `(1,0.9,1)`, Road rotation, and recovered
crossing placement.

The current web host's twelve exact generated scenes contain no Terrain, so
stock takes the Step1/Step2 branch for every supported ordinary Boneyard
footstep. The reported browser failure is earlier in the ownership chain:
simulation already latches authoritative `footstepTick`, Hub consumes it, but
`BoneyardScene` has no audio owner or subscription and plays nothing. The
correct bounded fix is to consume the local player's changed event tick once
and reuse the exact Step1/Step2 cue/gain contract. An approximate generic
wood-surface classifier is explicitly excluded. Exact wood support remains a
future scene-format seam that must preserve the Terrain private RNG, river
mesh, Road intersections, and derived bridge quads together.

## Native Tree visibility-alpha lifecycle

Tree constructor `0x005E46D0` initializes `+0x148` to a random integer in
`0..24`, target alpha `+0x14C` to `1.0`, and current alpha `+0x150` to `1.0`.
`Tree::Tick 0x005F1C50` enables the system only when secondary visibility
byte `+0x144` is true and main variant `+0x140 <= 5`. On each enabled 100 Hz
tick it first approaches current alpha toward target by exactly `0.015` and
clamps, then decrements the countdown. A result below one resets the countdown
to 25, resets target to `1.0`, and scans the Tree's registered spatial cells.

An eligible actor must satisfy `(actor+0x14 & 3) != 0` and local/player byte
`actor+0x5C == 0`. Its root, expressed relative to the Tree, must pass strict
bounds helper `0x00403DA0` and then exact polygon helper `0x00405160` using the
secondary-variant shape selected by `0x005F1A40`. A match changes target alpha
to `0.4`. Because the alpha approach occurs before the scan, fading starts on
the next tick. Forty ticks produce the complete `1.0 -> 0.4` fade; scans
refresh every 25 ticks and recovery follows the same `0.015` step after a scan
no longer finds the local player.

Both Tree halves consume this one current alpha. Main painter `0x00608480`
uses `+0x150`, and secondary foreground painter `0x00608830` submits the same
alpha. The fade is presentation-only, per viewer, and per renderer lifetime.
It does not belong in authoritative simulation, snapshots, collision, camera,
or multiplayer state. Native constructor phase depends on the process-global
RNG consumption order; the deterministic browser replacement may distribute
initial phases from stable Tree identity within the exact `0..24` domain, but
must preserve every scan, step, threshold, and local-player rule.

## Tree lighting correction

The lighting concern is confirmed narrowly rather than as a failure of the
recovered Region-light formula. Common dispatcher `0x00624B40` samples the
analytic maximum scalar at the Tree root and stores it at object `+0xCC`
before main painter `0x00608480`. The browser already samples main Tree
residents at that same root, so their lighting point and falloff are correct.

Tree secondary painter `0x00608830` is an explicit exception to the generic
late-foreground rule. With Complex Lighting active it multiplies Tree color
scalar `+0xD0` by the stored root scalar `+0xCC`, installs that RGB together
with current alpha `+0x150`, draws the secondary sprite, and restores white.
The stock Tree foreground is consequently both lit and faded exactly like the
main Tree even though it paints later. The browser's single flattened
Tree/Building foreground texture erased per-object ownership and was the Tree
defect fixed in this historical pass. The claim made here that Building upper
art remained caller-white was incomplete; the 2026-08-22 Building grid trace
below reopens and corrects it.

## Nearby-system inventory and implementation consequence

- Tree collision remains the small native movement circle selected by the
  main variant. The large secondary polygon is visibility-only and must never
  become collision geometry.
- Tree main art remains in the shared effective-Y population. Secondary art
  remains above the complete population in original foreground source order;
  fading does not change either painter key.
- Tree bounds/shadow art remains in its existing pre-main lane. No evidence
  makes the static shadow part of the alpha pair.
- Building upper art shares the late pass but not Tree's root tint or local
  alpha state. It reuses Building main's specialized packed vertex colors;
  per-object foreground residents remain required to preserve that difference.
- Remote participants, Solomon Dig, enemies, gates, camera visibility, and
  snapshot frequency cannot drive Tree alpha. Only the local player's current
  presentation position is queried at native fixed ticks.
- Audio remains owned by the scene-level `GameAudioDirector`. Boneyard should
  consume the existing authoritative event latch, not create another cadence
  clock or surface state in React.

The renderer cutover therefore needs one resident per native foreground
object in existing source order, with Tree residents retaining Tree identity
and root. The local Tree presentation owner advances exact fixed-tick alpha
state from the initialized polygons. Each visible Tree's main and secondary
residents receive the same alpha and analytic root tint. The historical
Building-white clause is superseded by the 2026-08-22 vertex-grid correction.
The static base, main painter bands, Region multiply boundary,
environment darkness compositor, HUD, collision, protocol, and host simulation
remain unchanged.

## Pre-implementation validation contract

Focused pure tests must pin all eight float32 polygon tables, strict boundary
behavior, the 25-tick scan cadence, one-tick detection delay, 40-tick fade to
exactly `0.4`, delayed recovery, disabled variants/secondary state, stable
presentation phase domain, and remote-player exclusion by interface. Renderer
contract tests must prove that Tree main and secondary residents share alpha
and tint while Building foreground remains independent and foreground source
order is retained.

A real Chromium WebGL run must place the local player outside and inside a
known Tree polygon, observe both Tree passes reach matched alpha/tint, and
show an actual pixel change without changing collision or painter depth. The
real Title -> Create -> Hub -> Boneyard journey must dispatch only stock
Step1/Step2 sources at gain `0.5`, on changed authoritative 25-tick events,
with no replay burst after release. Both journeys require zero page, console,
and failed-response errors, followed by the canonical `./scripts/validate.sh`
gate.

Confidence is high for every ownership boundary, address, field, constant,
polygon, lighting consumer, active-bank surface result, and immediate browser
divergence above. The only retained approximation is the initial per-Tree
scan phase because the retail process-global RNG consumption sequence is not
portable; it does not alter the recovered state machine or acceptance limits.

## Implementation and validation receipt

The browser now gives each native foreground object its own cropped resident
in source order. Eligible Trees retain a shared main/secondary identity and a
renderer-local fixed-tick presentation owner. That owner uses the initialized
retail polygons and bounds, strict containment, the 25-tick scan, `0.015`
alpha step, and `0.4` target. Both Tree residents receive the same current
alpha and Tree-root Region-light tint. At this historical revision Building
foreground remained white; the 2026-08-22 entry below records why that shipped
state was not native and replaces it.
`BoneyardScene` now consumes only the matching run's changed local
`footstepTick` and sends the existing Step1/Step2 cue contract to the shared
audio director at gain `0.5`.

Focused TypeScript coverage passed all 366 current-main Boneyard/game tests, including the
eight polygon/bounds records, strict edges, scan and alpha lifecycle, local
ownership, foreground residency, shared Tree alpha/tint, and scene audio
wiring. App type-checking and lint/import-boundary checks passed; lint emitted
only the repository's pre-existing Fast Refresh warnings.

The isolated Chromium proof used Pixi WebGL2. Moving from just outside to just
inside polygon zero produced one faded Tree at alpha `0.4`, one Tree
foreground resident, zero alpha/tint mismatches, and a framebuffer difference
of 90,676 pixels, total RGB delta 4,530,316, and maximum channel delta 100.
After the local player left, alpha returned to `1.0`; the remaining 5,203
changed pixels were below one fifth of the faded difference. The faded frame
was visually inspected with the wizard visible through the canopy. Receipts:

- `/tmp/solomon-dark-tree-opaque-20260814.png`
- `/tmp/solomon-dark-tree-faded-20260814.png`
- `/tmp/solomon-dark-tree-recovered-20260814.png`

The real Title -> Create -> Hub -> Boneyard audio journey captured Boneyard
semantic ticks `16250,16275,16300,16325,16350,16375`, proving five exact `+25`
deltas. Every held event used Step1/Step2, gain `0.5`, and playback rate `1`.
Dispatch intervals under headless software WebGL were
`11.8,5.5,348.0,712.2,0.9 ms`, averaging `215.68 ms`; the authoritative
semantic ticks remained exact while the headless wave renderer delivered some
snapshots in main-thread bursts. Stopped movement
became silent after the finite release tail. Prelude replaced Academy on
entry, and the journey reported no page, console, or failed-response errors.

Finally, `./scripts/validate.sh` passed the Release backend build with zero
warnings/errors, 23 backend/Website contracts, all 366 frontend tests, all 5
desktop tests, production frontend and game-host builds, and the deployment
media/CSP policy. Its only build diagnostic was the existing Vite chunk-size
warning.

## 2026-10-07 imported Terrain surface reopening

The editor can now import nonempty Terrain, invalidating this entry's historical
empty-generated-bank scope. This reopening owns the pure geometry consumed by
Arena `004677A0`: style-zero Terrain registration, inner river cross-sections,
first-crossing Road bridge subtraction, and their precedence over the existing
compact 25..29/DeadSpider surface grid. It does not change Terrain painting,
movement, footstep routing, or the style-one bank renderer.

Membership and pre-port dispositions:

- `006534B0` constructs a QuickSpline from Terrain control points in authored
  order. `0064FA90` style-zero mesh seeds a private native RNG from serialized
  UID `+CC`; four inclusive `[0,16.25]` draws per selected sample interval feed
  its six-vertex cross-section. The two surface vertices use draws two/three,
  width `32.5 + draw * 0.5`. The first two sections share the first four draws.
  Recovered, pending port and Mac tests.
- `0062B520` builds native arc-length lookup with float32 cursor step `0.025`
  and minimum chord `2.5`; `0062B8E0` maps requested length to spline cursor.
  `0062BFF0` selects sections with cosine threshold float32 `0.995`, length
  step `20`, and maximum gap `120`. Normal `00529010` uses the backward
  float32 `0.001` finite difference and rotates `(dx,dy)` to `(dy,-dx)`.
  Recovered, pending port and Mac tests.
- `00651DF0` registers quads `[8,9,2,3]` at mesh stride six, only for style 0
  and at least twelve vertices. Style 1 and all other styles cannot enter
  this query. Profile samples and sideSign are serialized/normalized by
  `00651720`, but never read by style-zero mesh generation; retaining them
  does not change this surface. Recovered, pending port and exclusion tests.
- `00653BF0` and `00651BF0` derive bridge subtraction from Roads and the first
  intersecting Terrain inner quad in native order. Exact bridge placement and
  transform remain under extraction before implementation.
- `004677A0` queries Terrain grid first. A Terrain hit followed by a bridge's
  strict bounds and quad hit returns false immediately, even if compact ground
  also covers the point. Otherwise a Terrain hit returns true; only a miss
  reaches compact ground. `004118B0` uses triangles `[0,1,2]` and `[1,3,2]`
  and `004119C0` compares three signed cross-product `<0` results, including
  native winding-dependent boundary behavior. Recovered, pending port/tests.
- Existing compact 25..29 and dynamic DeadSpider record membership is already
  covered by `native-compact-ground-surface.test.ts`; preserve it unchanged.

Evidence: retail SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`,
read-only canonical Ghidra replica extraction on 2026-10-07. Function addresses
above and raw PE constants are direct binary evidence. Focused tests must cover
native sample order, private RNG width, style/profile/sideSign gates, triangle
boundaries, first crossing, subtraction precedence, and compact/remains fallback.

### Recovered dependency corrections

Direct `00629EF0`/`0062A9E0` extraction establishes that Terrain uses QuickSpline's
fixed-quarter tangent recurrence, not the generic natural cubic solver. For each
axis and more than two controls, the forward values are `3*(p1-p0)/4`, interior
`(3*(p[i+1]-p[i-1])-forward[i-1])/4`, and the analogous one-sided final value;
back substitution subtracts a quarter of the next tangent. Hermite polynomial
coefficients and stored intermediates are float32. Two controls are linear.
This is isolated in `core-kernels/native-terrain-surface.ts`; unrelated spline
consumers are outside this surface-query reopening.

Bridge recovery is complete: loop Terrain then Roads, admit each Road's first
quad only, compare both endpoints against triangles 012/132 and then strict
segment/triangle edge crossing (`00411BF0`, `00411A70`, `00410820`). Intersections
use `00410900`, scanning quad edges 01,23,02,13. Nearest intersections to each
Road endpoint use strict `<` updates with distance sentinel `1e9` and midpoint
fallback. The mean gives center; equal nearest-distance values instead use the
nearest-start point plus 15 times the normalized Road direction. Always add
another 5 times that direction. DeadHawg319 local quad is 72x135. The Road angle
is float32 atan2(dx,-dy) converted through native PI to degrees; the matrix
rotates, scales world Y by float32 0.9, then translates. Only the resulting
`+20` quad and strict `+10` bounds subtract from this surface query. The lower
bridge decorative/collision quads are out-of-system for this predicate.

Triangle instruction stores (`004119C0`) round each of the three cross products
to float32 before comparing `<0`. All-zero degenerate triangles therefore
accept; ordinary boundaries depend on winding. The compact-grid border mapping
and compact/DeadSpider contours retain their existing implementation.


Final bounds audit: `00403DA0` instructions `403DA8..403DDE` prove half-open
rectangles: left/top inclusive, right/bottom exclusive, with upper-coordinate
sums retained in x87 precision until comparison. The earlier word "strict"
above refers only to the upper limits. The dedicated bridge-boundary regression
pins all four edges and a sum lying between representable float32 coordinates.
`0040FD90` stores min XY and float32(max-min) WH without padding.

The actual imported Shrike Gardens 2 fixture was independently parsed and
projected on M5: it has zero Terrain and 59 Roads, so no river/derived-bridge
surfaces and no change to that map's compact-only classification. Original
fixture bytes were read only. Curved, long/short straight, and style-variant
contracts exercise the newly supported nonempty Terrain path separately.

### Focused implementation receipt

`native-terrain-surface.ts` now owns recovered style-zero QuickSpline selection,
private UID RNG width, inner quad registration geometry, exact triangle signs,
Road bridge derivation, and half-open subtraction bounds. The renderer's shared
`NativeCompactGroundSurface` applies these before its unchanged compact and
DeadSpider grid. Profiles, sideSign, and unsupported Terrain styles have explicit
exclusion assertions; no fixed-width stroke or geometric tolerance is used.

Mac mini M5, 2026-10-07 22:28 UTC: 14/14 focused Node contracts passed across
`native-terrain-surface.test.ts` and `native-compact-ground-surface.test.ts`.
Targeted oxlint passed with zero warnings/errors before the final half-open-bound
helper/test addition. The new pure suite is in `test:arena-render`, already part
of canonical validation. Full combined application type/build/gate and real
editor browser acceptance remain with the integration coordinator; this receipt
is not a native-versus-browser pixel comparison or a publication claim.

Current membership disposition: recovered geometry and query branches are
implemented and focused-validated; the integration acceptance boundary remains
pending. Terrain paint, style-one bank visuals, bridge decorative/collision
extras, and unrelated spline users remain explicitly outside this query's scope.


## 2026-10-10 — Tree occlusion material and lifecycle reopening

### Reported smell, scope and current status

The user reported that standing directly next to a Tree fades it differently
in stock and the web port (user message
`Sentinel_43958196ceb0819193a18ee0b0bce363`). This reopens the complete Tree
local occlusion owner: constructor and state writers, all main/secondary
variants, actor eligibility, authored visibility polygons, scan camera gate,
clock and restoration, normal and hit-redraw materials, lighting, painter and
shadow interactions, residency and teardown. Other scenery and shared hit
consumers are being enumerated, rather than presumed to share Tree alpha.

The earlier pass skipped the full main-painter branch and treated a successful
web fade demonstration as evidence that both native halves used uniform
alpha. It also omitted the offscreen scan branch and instruction precision.
Those assumptions are withdrawn across the Tree owner. This is an active
recovery ledger, not a completed implementation or release receipt.

The web baseline is commit `c73eca2104ef12986979609e7c008d89fd7fbf4e`, tree
`831bae3b65fa66288bec267dfb3dd580223699d0`. Product code is unchanged while the
recovery and actual baseline capture finish. The maintained old smoke failed
before drawing because its renderer fixture omitted required mod metadata;
that failure is preserved, and fixture repair must not add a product fallback
or weaken runtime error checks.

### Evidence and provenance

- Static retail instructions: executable SHA-256
  `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, version
  0.72.5, preferred image base `0x00400000`. Constructor `0x005E46D0`,
  Tick `0x005F1C50`, main painter `0x00608480`, secondary painter `0x00608830`,
  bounds `0x00403DA0`, polygon `0x00405160`, gradient helper `0x0041EAE0`,
  common lit/hit draw `0x00624B40` / `0x00628AD0`.
- Static reconstruction of all eight initialized visibility polygons gives
  57 vertices matching the retained retail float32 table exactly. Existing
  glyph records and initialized polygon data are independent evidence;
  neither comes from a tight alpha crop or a traced screenshot.
- Independent M2 web audit used actual production classes, not only a copied
  formula. Existing five tests pass while source-derived float32 endpoint and
  left-boundary cases fail. A separate delivered-history experiment reports
  alpha 1 for per-tick movement entering at tick 30 versus about .565 when the
  same owner catches up using only the latest position.
- The audit also exposed raw `snapshot.tick` versus constructor
  `gameRunWorldTick` clock inconsistency. Its proposed Game Over freeze is
  **not yet proved native**: ordinary pause is source-proved, but the complete
  Arena/Game Over dispatch is still under recovery. Do not adopt the failed
  frozen-clock test as native authority until that call chain closes.
- Authoritative raw evidence is retained on M2 in the dated Tree-fade report
  archive. The independent web-audit custody manifest SHA-256 is
  `e5bfdd050bf3bf8223f88abd33e9b046862d3adb3b56b045d13fb651df136754`.
  Final native report/catalog hashes and accepted comparison receipts will be
  recorded here before qualification. No new clean-stock fade sequence has
  yet been acquired for this reopening.

### Recovered main and secondary material contract

The original glyph quad is ordered TL, TR, BR, BL. Main `0x00608480` uses its
ordinary caller material when `currentAlpha >= 0.5`; it does **not** submit the
Tree's current alpha on that path. When `currentAlpha < 0.5`, it uses the
native two-color vertex-gradient helper. With ordinary whole color 1 and
caller alpha 1, the top endpoints are `f32(currentAlpha * 0.5)` and the bottom
endpoints are 1. At settled `f32(.4)`, the packed alpha bytes are 51 at the top
and 255 at the bottom. The gradient spans the **original glyph quad**, not its
visible alpha silhouette. Secondary `0x00608830` remains uniformly current
alpha, with ordinary plateau byte 102.

The full callback rule is required for hit redraws. Let W be whole color at
renderer `+0x1EC`, C callback color at `+0x20C`, and a the Tree state. The main
path first obtains `P = f32(W*C)`, replaces top P.a with `f32(a*.5)`, retains
bottom P.a, and helper `0x0041EAE0` multiplies each supplied endpoint by W again
before packing. Therefore RGB is `f32(W*f32(W*C))`; top alpha is
`f32(W.a*f32(a*.5))`; bottom alpha is `f32(W.a*f32(W.a*C.a))`.
The ordinary browser route has W=1. A synthetic nonunit W test is a helper
contract control, not evidence that ordinary gameplay sets a nonunit W.

Lit callback RGB/alpha 1 is installed at `0x00624DD9..0x00624E68`.
Uncached Puppet hit draw `0x00628DE5..0x00628EBC` sets additive mode, constructs
callback alpha `min(1, f32(strength*timer))`, applies helper `0x004A2F90` with
root light and then 1, installs the callback, calls the same main virtual, and
restores white/mode. `0x004A2F90` multiplies **all RGBA**, not RGB alone. In the
Tree gradient branch, the top alpha overwrites callback alpha while the
bottom retains it. Reusing the ordinary gradient and then multiplying a hit
child's global alpha is consequently incorrect. The redraw needs independent
per-draw endpoint colors. Secondary hit submission duplicates its ordinary
material; it does not retain the main hit callback.

### Recovered state, geometry and camera contract

- Constructor initializes countdown to an integer in 0..24, target/current
  alpha to 1. Native process-global random consumption is not reproduced by
  the current browser's stable identity phase; this existing difference must
  remain explicit, rather than be presented as an exact random trace.
- Tick returns before all state updates unless secondary visibility is true
  and main variant is at most 5. Disabling the owner freezes its current
  alpha/countdown; it does not reset them. Main's gradient branch does not
  re-check that eligibility gate. Re-enable/reset writers remain under audit.
- Each enabled 100 Hz tick approaches the old target first, using stored
  float32 values and `f32(.015)`, then decrements the countdown. A result below
  one resets countdown to 25. A successful scan changes only the subsequent
  tick's approach target, to `f32(.4)` or 1.
- There are **41** approach ticks between endpoints. Down tick 33 is
  `.5050004720687866`, tick 34 `.49000048637390137`, tick 40
  `.40000057220458984`, tick 41 `f32(.4)`. Recovery tick 6 is
  `.489999920129776`, tick 7 `.5049999356269836`, tick 40
  `.999999463558197`, tick 41 is 1. No easing function or wall-clock fade
  timer is present.
- After reset to 25, the scan requires positive-area overlap between the
  translated authored secondary bounds and Region camera rectangle
  `+0x8BCC..+0x8BD8`. On a miss, the old target is retained. Alpha still
  approaches that old target and countdown still resets. Do not replace this
  gate with padded resident culling or the main glyph's bounds.
- An actor must pass `(flags & 3) != 0` and byte `+0x5C == 0`. No additional
  distance, painter depth or life-state gate was found inside Tree Tick.
  Complete registration/lifetime and local/spectator ownership remain under
  recovery before choosing the web actor interface.
- Root-relative actor subtraction and translated bounds origins are float32.
  Bounds are left/top inclusive and right/bottom exclusive. Polygon helper
  uses the ordinary asymmetric ray crossing; it does not reject every edge.
- Ordinary application precision is supported by stock Direct3D CreateDevice
  flags `0x80` (no FPU-preserve bit) at `0x004401E1..0x004401EA`, plus the
  isolated library precision guard and restored rounding-control sites.
  This supports single-precision, round-nearest intermediate arithmetic for
  the ordinary Tree path. It supersedes the independent web audit's initial
  'unknown x87 precision' caveat. Final precision/call-chain provenance is
  pending the native report; no forbidden runtime settings read was used.

### Membership inventory and implementation boundary

Current rows are provisional, with exact selector ranges, shared caller xrefs
and writer/lifetime proof to be appended by the final native sweep before
product implementation:

| Member | Recovered contract | Current disposition |
| --- | --- | --- |
| Tree constructor, enabled Tick, freeze/re-enable and teardown | Constructor/state and early eligibility return above; remaining writers under recovery | recovered-pending-port; writer audit open |
| Main variants 0, 1, 2, 3, 4, 5 | Eligible local fade, normal/gradient threshold and per-draw callback semantics | recovered-pending-port |
| Other main variants and secondary-hidden branch | No Tick state advancement; existing faded main remains gradient | recovered-pending-port; full selector inventory open |
| Secondary polygon rows 0..7 | All 57 initialized f32 vertices recovered; exact bounds and ray crossing | recovered-pending-port |
| Secondary foreground and ordinary duplicate | Uniform current alpha, root lighting, original foreground order | recovered-pending-port |
| Normal lit/unlit main draw | Ordinary material at/above .5, original-glyph gradient below | recovered-pending-port |
| Uncached Tree hit draw | Per-draw callback-aware endpoints, all-RGBA light multiplication | recovered-pending-port |
| Shared scenery hit receivers and cached branches | Complete concrete receiver inventory still under recovery | investigation open |
| Camera scan gate and offscreen retention | Secondary bounds versus unpadded Region camera; reset cadence preserved | recovered-pending-port |
| Ordinary pause and Arena/Game Over clock | Pause suspension proved; Game Over dispatch not yet closed | investigation open |
| Network/presentation history | Retained eight delivered snapshots can sample a presentation path; exact untransmitted 100 Hz native input history unavailable | design and constraint disposition pending |
| Tree simple/directional shadows | Independent sibling owners; no alpha-parent inheritance | verification pending |
| Earthquake wobble | Transform-only; original glyph-local gradient rotates with art | verification pending |
| Building/Wall vertex lighting and unrelated scenery | Shared material integration requires no accidental Tree-alpha adoption | membership audit open |
| Footsteps, Terrain surface and collision geometry | No Tree fade state consumer | out-of-system for this reopening |

This table does not claim full inventory closure yet. Existing Tree polygons
are also consumed by Ether Drain placement; that consumer must retain the
unchanged authored data and must not inherit a visibility predicate change.

### Web implementation and validation contract

Use a cohesive retained Tree material owner with straight packed vertex RGBA,
original glyph positions/UVs, and per-draw hit colors. Do not regenerate atlas
textures, add a low-resolution intermediate canvas, multiply main alpha twice,
change shadow opacity, or classify Trees as Buildings just to reuse a writer.
The current equal-main/proxy-alpha diagnostic and tests encode the disproved
assumption; replace them with explicit branch/endpoints/proxy invariants.

Test every authored polygon and enabled selector, all bounds/edge conventions,
scan phases 0/1/24, 41-step down/up thresholds, reversal, offscreen retention,
overlapping Trees, local actor eligibility, pause/terminal ownership after
source closure, reconstruction and teardown. Delivered-history tests must
use the same retained input history and distinguish missing history from an
observed native tick path. Main/hit/proxy material tests must inspect actual
resident vertex colors and real WebGL pixels, including alpha .5 and adjacent
float32 values, settled .4, fractional camera transforms, root lighting,
enhanced-effects changes, shadow toggles, and repeated retained updates.

Real Mac acceptance must include the normal game journey and walking beside,
under and away from Trees, with browser errors captured. Match clean-stock
scene/camera/glyph/viewport/timing where safely possible; transient native
screenshots must be bracketed and threshold-spanning frames marked ambiguous.
The exact final candidate also requires canonical M5 validation and independent
review before authorized normal publication. No current test count, failed
fixture, static theorem or screenshot establishes whole-scene parity.


### Closed dispatch and selector inventory — 2026-10-10 13:24 UTC

The native report now closes the core class membership. The 598-class catalog
assigns the proximity Tick/main/secondary owners only to Tree (id 2001,
vtable `0x0079D584`). Main registry at art-singleton `[0x819994]+0x1AAC`
has 19 glyphs, DeadHawg 264..282. Secondary registry `+0x1A9C` has 21 glyphs,
DeadHawg 243..263. Auxiliary/shadow registry `+0x1A8C` has 15 glyphs,
DeadHawg 228..242. The loaded registry count is not an occlusion-polygon count.

| Exact member | Native disposition / required web behavior | Implementation state |
| --- | --- | --- |
| Main 0 | Tree state enabled when secondary enabled; main gradient contract | recovered-pending-port |
| Main 1 | Same shared Tree contract | recovered-pending-port |
| Main 2 | Same shared Tree contract | recovered-pending-port |
| Main 3 | Same shared Tree contract | recovered-pending-port |
| Main 4 | Same shared Tree contract | recovered-pending-port |
| Main 5 | Same shared Tree contract | recovered-pending-port |
| Main 6..14, each of nine selectors | Native Tree glyph/hit/shadow, no proximity Tick | recovered-pending-port ordinary-material regression |
| Loaded main 15..18, each of four selectors | Authored loading converts to Scrub before Tree shadow indexing | out-of-system for Tree state; preserve Scrub owner |
| Polygon 0, 8 vertices | Exact initialized float32 table | recovered-pending-port predicate |
| Polygon 1, 6 vertices | Exact initialized float32 table | recovered-pending-port predicate |
| Polygon 2, 7 vertices | Exact initialized float32 table | recovered-pending-port predicate |
| Polygon 3, 10 vertices | Exact initialized float32 table | recovered-pending-port predicate |
| Polygon 4, 7 vertices | Exact initialized float32 table | recovered-pending-port predicate |
| Polygon 5, 7 vertices | Exact initialized float32 table | recovered-pending-port predicate |
| Polygon 6, 6 vertices | Exact initialized float32 table | recovered-pending-port predicate |
| Polygon 7, 6 vertices | Exact initialized float32 table | recovered-pending-port predicate |
| Secondary art 0..7 | Draw and visibility shape available | recovered-pending-port |
| Secondary art 8..20 | Loaded glyphs, but no corresponding proximity polygon | out-of-system as supported fade selectors; no guessed shape |
| Auxiliary/shadow 0..14 | Independent main-selected glyph and caster; no fade-state reads | unchanged owner, regression pending |
| Invalid negative/out-of-table selectors | Native signed indexing lacks safe lower-bound validation | not a supported feature; preserve explicit web input validation |

Clock closure supersedes the earlier open question. Player death `0x005344CA`
reaches Arena `0x004633D0`, constructs GameOver through `0x005CB570` /
`0x005CAD40`, and App `0x004280E0` appends the overlay. Disabling Game input
bytes does not suspend Region. App child loop `0x004284B0` continues enabled
scenes. Arena `0x0046E68D` calls Region `0x0063EFC0`; at `0x0063F160`, its
embedded layout ticks list `+0x2B4` (Region `+0x87C4`) through `0x004022A0`,
and list dispatch `0x00402346` calls each Tree's Tick. Therefore **Tree fading
continues underneath Game Over**. Ordinary pause separately sets Region
`+0x68=-1` through `0x005CBD40`; dispatcher `0x00427800` skips its Tick.
The web must use raw continuing snapshot ticks consistently for Tree
construction/advancement. It must not switch Tree to the terminal-frozen
`gameRunWorldTick` clock. Existing host pause returns before fixed simulation
steps, and the scene's paused presentation loop does not render catch-up.
The general frozen-world comment and other actor consumers are not evidence
that this scenery list freezes.

Dynamic Tree eligibility writers are constructor, stream serializer,
generated/editor creation, and editor-only enable toggle `0x004C24EE`.
No ordinary Boneyard in-place selector/enable writer was found. The pure
state owner must preserve freeze/resume semantics; live gameplay normally
has immutable Tree inputs. Editor toggling is not a reason to reset state.

The hit receiver catalog includes 116 classes sharing `0x00628AD0`. Concrete
scenery receivers are Tree, Monument, Gravestone, Fencepost, Scrub, Building,
Wall, CollegeObstacle, CollegeStatue, CustomObject, FenceGrate,
FenceGrate_Broken, FenceGrate_Rails and Gate. Their inspected constructors
retain default uncached byte `+0xF8=0`; the common complex-light hit callback
multiplies **all RGBA by raw CC**. Wall main is a no-op. Cached PlayerWizard,
Arena temporary actor highlights and story-NPC cached draws are distinct
render-target owners outside this scenery-fade change; the 116-member
catalog is ownership evidence, not a claim to close every actor material.
Current scene consumers must all be checked for the falsified RGB-only hit
attenuation assumption. The current concrete renderer has ordinary Sprite,
Tree quad and Building/Wall surface cases, each requiring its own test.

Deferred proxy ownership is closed: `0x0064E910` stores only object pointer
and ordering, no RGBA; PuppetPointer `0x0063ED70` calls Tree secondary.
Ordinary and hit wrappers restore callback white before that deferred pass.
Consequently both lighting modes draw an ordinary duplicate Tree secondary
when a hit invokes main twice. The simple-light direct helper can observe a
synthetic incoming callback, but that is not the reachable queued hit path.

Two upstream material/input details remain bounded active recovery:
1. Tree scans **any** candidate with `(flags & 3)!=0` and byte `+0x5C==0`.
   The old 'only selected local player' interpretation is not proved by this
   predicate alone. Concrete actor defaults, registration and field writers
   are being closed before selecting the complete web trigger set.
2. D0 defaults 1 but may be written through light helper `0x0057F0E0`; CC is
   its separate returned value. Ordinary callback uses D0*CC, hit uses CC
   alone. The port must keep these inputs distinct until the helper's exact
   relationship to web radial/elevated light is established. Object RGB
   defaults white; ordinary main clamps component results before packing.

### Retained input-history seam — pre-port contract

The client presentation owner retains at most eight delivered snapshots. Add
a pure read-only player-position query at raw delivered `snapshot.tick`, using
the same bracketing, linear XY interpolation and player membership as the
ordinary presentation path. An older-only player remains at its older
position through that interval's end; a newer-only player appears at the end.
Return a fresh position, or null for an absent player, nonfinite tick or a tick
outside the retained range, without extrapolation, clock clamping to
`gameRunWorldTick`, or calling stateful `sample(now)`. Session exposes this
only during Boneyard ownership; scene forwards the optional renderer seam.
This removes latest-position catch-up substitution where delivered history is
retained. Evicted history and untransmitted 100 Hz movement remain unavailable
and must not be reconstructed or claimed exact. Camera epochs and any
additional source-proved eligible actor history still require integration.

The current baseline is independently sealed: 1,447 payload hashes verified,
zero mismatches, manifest SHA-256
`f4b263fa7dbcd2b8eb16c9d06447374042e771386da4fd76d708980ca6d57b37`.
Actual M2 Chrome154/WebGL2 renders original atlas records264/243 at 1600x900,
DPR1. Repaired direct and instrumented smoke screenshots are byte-identical;
all 6,564 runtime/assets/package inputs match c73. The raw recovered frame
has native frame-sampled light flicker; a matching-frame opaque control is
pixel-identical. Earlier missing-mod-metadata and unmatched-light-phase
failures remain preserved rather than relabeled as successful tests.

Three new maintained pre-fix tests fail against the old owner, as expected:
first float32 approach store, the exact native-included leftmost vertex, and
disable/resume preservation. The old five tests still pass. This is a RED
baseline, not validation of a corrected candidate.

Native report snapshot SHA-256 at this ledger update: `be53618bd0602c1b395d0f8e91dd3f54d6cb2ca56b1f242185bb9d21ae36ad30`. The bounded upstream addendum remains pending.


### Shared callback and actor-membership corrections — pre-port

The remaining upstream audit establishes two material omissions beyond the
uniform Tree fade. Light helper `0x0057F0E0` initializes D0 to 0, returns
CC as the maximum of ambient/radial sources, and writes D0 as the maximum of
elevated radial contributions. These are genuinely different live values:
a half-intensity source at the Tree root produces CC=.5 and D0=.5, hence
ordinary RGB=.25 before object color. Default D6=1 consumers include Tree,
Monument, Gravestone, Fencepost, Scrub, FenceGrate and its Gate/Broken/Rails
subclasses. Their ordinary callback uses both factors. Building explicitly
sets D6=0 and the dispatcher resets its D0 to1; preserve its specialized
surface implementation. Wall ordinary main is a no-op. The existing web
radial-only generic tint is therefore insufficient for the first group.
Independent equation review is qualifying exact coordinate/radius/precision
and ambient correspondence before selecting the existing surface sampler.

Use a shared retained original-glyph material for supported Tree, Monument,
Gravestone, Fencepost and Scrub main glyphs. Each batchable shaderless mesh
has identity group alpha/tint and explicit packed ordinary RGBA. Tree alone
adds its native current-alpha gradient branch. Hit children use independent
quad geometry and color buffers, so their raw-CC callback is not multiplied
by an ordinary parent D0*CC tint or by an already quantized light byte.
Building/Wall keep specialized surfaces, and FenceGrate/Gate keep their
specialized stretched/line geometry while consuming the correct common
incoming light factor. Original textures, UVs, glyph anchors and shadow
siblings remain independently owned. Optional native callback RGB remains
an explicit material input; white is the stock constructor default, not a
claim that arbitrary script/serialized nonwhite colors cannot exist.

A terminology correction is important: renderer byte `+0x223` selects
**diffuse color instead of texture RGB**, not additive blending. Its consumer
`0x00420982..0x004209F0` sets texture-stage COLOROP=SELECTARG1 and
COLORARG1=DIFFUSE; the ordinary branch is MODULATE/TEXTURE. Actual blend mode
is a separate `+0x221` branch. Earlier 'additive flag' wording in this
reopening/native report is withdrawn. Preserve ordinary hit alpha blending
and use the native diffuse-RGB shader path; do not set add blending.

Independent material oracle v2 records `trunc(f32(component*255))` packing
and the simple-light hit callback `(1,0,0,H)`, which ignores raw CC. The
complex route remains `(.65,0,0,H)*CC`. The corrected oracle/report preserves
its superseded version rather than silently editing prior evidence:
`a827f537c368c40096f275ac48981517a742796eed7a9947780e785ec3b44b59`.
A source-derived `.4` Tree at hitH=.2, CC=.35 has top `[58,0,0,51]` and
bottom `[58,0,0,17]` in complex mode, versus both `[255,0,0,51]` in simple
mode. The old parent-alpha/tint implementation fails these controls.

Actor bank `+0x5C` is not a local/remote boolean. Native PlayerWizard slots
0..3 are stored and explicitly assigned that bank at `0x005CB907..0x005CB90E`;
only primary slot0 passes the Tree gate. The web's selected viewer maps to
that primary slot; network peers must not all be assigned native bank0.
Ordinary Badguy instances use flags2 and Arena explicitly registers bank0,
so they also trigger Tree fading. Golem flags `0x800` and ordinary NPC/GoodGuy
flags0 fail the category mask. Wraith and Maggot physical collision disable
is independent of spatial query membership. Cocoon likewise has flags2 and
an explicit grid-attach path despite disabled physical collisions. Coffin
is flags0 while hidden and switches to2 while rising/attached. A dead primary
player clears physical collision but retains flags/bank/cell until actual
removal; do not exclude it merely because the UI says dead/spectating.
Enemy death and Solomon final lifecycle rows remain with the native sweep.

For retained-history integration, add a copied minimal aggregate
`BoneyardSceneryActorPoses`: players `{id,position}`; enemies
`{id,position,enemyToken,nativeTypeId,animationState,coffinState}`; maggots
`{id,position,state}`; encounter `{position,phase}` or null. The pure raw-tick
query uses existing delivered bracketing and XY interpolation, preserving
discrete metadata/membership policy. Enemy/maggot departures disappear at
blend1; player membership keeps its existing interval-end policy. It does
not decide native eligibility; the renderer's source-qualified predicate
does. It returns null outside retained history without extrapolation or
advancing stateful presenters. The session and scene forward this optional
sampler beside the player-position sampler. Seven new player/session
contracts were RED on missing APIs; after that seam's implementation the
full focused timeline/session suites pass82/82 with zero lint diagnostics.
The aggregate extension is not yet implemented at this entry.

Secondary Tree rendering has an additional source-proved camera transform:
compute the center of unpadded Region camera bounds in float32, subtract it
from Tree root, multiply each displacement by
`1.024999976158142`, then add the center back with float32 stores. Render the
original secondary glyph at that root with the same Tree rotation. Fade
trigger bounds remain at the original root. Current web has no equivalent
secondary parallax; the material correction must preserve this distinct
main/proxy transform rather than continue assigning identical roots.

### Pre-port addendum: actor and surface light query precision (2026-10-10 13:45 UTC)

Independent static/source-vector qualification closes the camera operand: Arena vtable F4 is `4620d0` (world minus camera origin), while `63ed80` belongs to FC and is not this query. Both source and query coordinates are projected with float32 subtraction before the light delta. Neither Region80 nor light-manager C4 scales the query contributions. The literal Y anisotropy is promoted float32 `0.8500000238418579`, not a new double 0.85. Every native PC24 add/subtract/multiply/divide is represented with a float32 store. Radius scales the radial ellipse, but does not divide the independent elevation gap.

Shared API to port: `nativeBoneyardLightFactors(position, sources, { cameraOrigin, ambient })` returns radial CC (ambient seed) and elevated D0 (zero seed). Each accepted light contributes the existing native 75/145 radial falloff, intensity, and `max(0, 1 - positiveProjectedYGap * 1.5 / 145)` elevated factor; maxima are independent. The ordinary Puppet scalar is `f32(CC * D0)`. Surface helper `57e640` instead starts both factors at ambient, so its final scalar is `f32(CC * max(ambient, D0))`. Arena ambient is zero (`46ecbc..46ecf3`). Building and Wall keep their specialized vertex sampling, with this shared query precision and final byte `trunc(f32(f32(clampedScalar) * 255))`; their shape/grid/owner does not change. Tree secondary uses unclamped grayscale `f32(D0 * CC)` independently of optional main objectRGB. Main ordinary color still applies objectRGB and per-component clamp; common complex hit uses raw CC for all RGBA, not the ordinary product. The independent oracle has 58 input vectors, 11 controls, and real scalar/byte RED evidence against the existing all-double helper. These are source and CPU qualifications, with GPU/native acceptance still pending.

### Pre-port addendum: authoritative Tree actor membership (2026-10-10 13:50 UTC)

The pure `nativeTreeActorPositions` adapter consumes selected native-bank-zero player position (including retained corpse), authored enemy token/nativeTypeId pairs with source-qualified lifecycle admission, an explicit Maggot `nativeTreeQueryMember` boolean, and separately source-qualified Solomon phases. It must not infer Maggot spatial membership from animation, `combatActive`, physical collision/body presence, position or health. Strict unknown/mismatched enemy types are excluded. Ordinary accepted lethal damage clears native category flags before its death callback (`48a530 -> 63e7c0 -> 63e7c4`); hidden Coffin has no category/grid admission, while visible rise attaches and sets category2. Living Cocoon remains grid-admitted despite disabled physical collision. Player death clears a physical flag but leaves Tree-query category/bank/grid registration intact until removal.

The explicit Maggot boolean is a necessary authoritative presentation seam, not a new gameplay collision rule. Its exact producer, mark-for-deletion versus next-list-pass removal, external movement and save/restoration contract must be qualified before integration acceptance. Free-motion `525800` admits even with zero displacement; conversion alone does not admit, and host-attached/emerging roots can move without grid admission. A self-consuming bite marks deletion without immediately clearing the category, so testing animation `bite` or `death` alone is invalid. The pending producer/strict wire/compact replication migration is tracked explicitly; no complete actor-membership claim is made until those cases and round trips pass.

### Pre-port addendum: bounded browser history and camera epochs (2026-10-10 13:52 UTC)

The web transport only retains eight delivered snapshots, unlike native per-tick scene ownership. The renderer now has pure pose-at-tick queries, which do not advance spell/enemy presentation owners. Historical Tree scans use those recorded/interpolated poses and a camera reconstructed from the recorded focus position only while the viewport, FOV, focus-player identity, tutorial/arena camera bounds and run remain in the same observed epoch. An epoch change invalidates earlier camera reconstruction. A monotone bounded-history search finds the first usable tick; missing history never substitutes the latest occupant for every old tick. During an unknown scan the old target is retained, while its float32 approach and25-tick scan phase continue. Long unobserved gaps are skipped arithmetically after the at-most41 approach ticks. This is an explicit transport-gap policy, not a claim that missing native history was recovered. Current observed frames remain usable without an optional history provider. Camera changes still update proxy parallax immediately without fabricating a Tree tick. The raw snapshot clock continues Tree state during GameOver and remains paused when native scene ticking is actually paused.

### Pre-port addendum: minimal Maggot membership transport (2026-10-10 13:54 UTC)

Planned authoritative field `nativeTreeQueryMember:boolean` is initialized false at Coffin birth; free-motion commit after resolveMovement sets it true even for zero displacement, as does an accepted external position/rebind operation. Accepted lethal damage clears the category and therefore the query-membership bit. A self-consuming bite retains existing membership on the marking tick; the exact next-pass cleanup clear is still gated on source scheduler qualification, not guessed. Native serialization omits both physical-registration flag and cell pointer; reconstruction starts unbound and first free motion rebinds. Consequently current and legacy web save restoration must normalize this presentation-only bit to false, without changing save schema or outcomes. The projector copies the bit, strict JSON requires a boolean, compact Maggot samples grow17->18 with index17 as0/1, pure history retains the discrete bit, and protocol149->150 prevents silent mixed schemas. Focused producer, wire, compact round-trip, projector, history and save-restore tests are required.

All six active Solomon Dig phases preserve the source category/grid ownership. Web `gone` has no rendered actor and is excluded by the adapter. Its existing timer-based transition is not the native bounds-based deletion event; that surrounding encounter-lifetime difference is an explicit limitation rather than an inferred exact native cleanup. This patch does not rewrite that encounter scheduler.

#### Deferred deletion correction before producer port (13:56 UTC)

The provisional next-pass Maggot wording above is superseded by the complete deferred scheduler trace. A self-bite marks deletion during tick t and retains grid membership at t, t+1 and t+2. The t+1 list pass removes/enqueues into the parity queue after that queue has already been flushed; t+2 flushes the other queue, and t+3 disposes via `641070 -> 63f600 -> +48 detach` before scenery Tick. Tree never tests the deletion byte+05. The existing retained bite presentation therefore keeps its already-admitted `nativeTreeQueryMember` while `deathTick < 3`, and clears it at3. Accepted lethal damage is a different path and still clears category/membership immediately. The same native deferred-disposal fact applies to mark-only Solomon escape, but this patch keeps the separately documented web `gone` renderer-lifetime disposition rather than changing the encounter scheduler.

#### Bounded release disposition for pause-crossing actor cleanup (13:57 UTC)

The exact native deferred queues use global App+28 parity even while a Region is paused. Web world ticking pauses without an equivalent App-parity source, so the uninterrupted three-tick rule does not establish the pause-crossing deadline. The scoped release adopts the source-exact uninterrupted behavior and leaves pause-crossing Maggot deferred disposal as an explicit open regression with a concrete boundary test. No global scheduler rewrite or global actor-fade parity claim is authorized by this qualification. Main Tree gradient, trigger geometry, scan timing, ordinary/free-Maggot admission and recorded history are qualified independently of this rare deferred-removal limitation.


### Implemented bounded Tree/scenery contract and final qualification — 2026-10-10

This entry supersedes the reopening's provisional `recovered-pending-port`
labels for the supported web members below. It does not close the explicitly
listed transport, deferred-cleanup or fresh-stock final-frame limitations.

| Member | Final implementation disposition |
| --- | --- |
| Tree main selectors 0..5 | Source-exact float32 approach, 25-tick scan, bounds/polygon predicate, main gradient and separately fading/parallax secondary |
| Tree main selectors 6..14 | Retained original ordinary/hit material; no invented proximity state |
| Loaded main selectors 15..18 | Preserve loader conversion to Scrub; not Tree proximity members |
| Eight polygons, all 57 vertices | Extracted authored tables; half-open bounds and asymmetric crossing, with vertex/edge assertions |
| Secondary selectors 0..7 | Supported proximity shapes and distinct original-glyph secondary |
| Secondary selectors 8..20 | Loaded art with no authored proximity polygon; no guessed shape or erroneous validation of a nonfading Tree |
| Auxiliary/shadow selectors 0..14 | Existing independent caster/art owners; main/proxy fade does not attenuate shadow |
| Supported Tree/Monument/Gravestone/Fencepost/Scrub glyphs | Retained independent ordinary and hit vertex-color owners; original texture/UV/anchor lifetime |
| Building/Wall | Specialized surface/grid and hit ownership retained; shared light-query precision corrected |
| FenceGrate/Gate line geometry | Specialized geometry retained with source-qualified incoming ordinary light factor; no claim to add absent hit-target membership |

Native Tree main remains ordinary/opaque at current alpha >= .5. Below that
threshold, its source-derived upper-alpha gradient is independent of the
ordinary base and of the uniform secondary alpha. The float32 .015 approach
needs 41 stores to reach .4. A newly entered full scan interval can therefore
need 25 + 41 ticks to settle. Tree uses raw continuing GameOver ticks, while
ordinary Region pause holds its clock.

Current fractional rendering camera bounds are separate from the recorded
integer-tick scan camera. Rendering-only movement updates secondary parallax
and projected light rounding without advancing alpha or the scan countdown.
Pure pose history stays within eight delivered snapshots and a verified camera
epoch; an unknown past scan retains its old target rather than inventing old
occupants from the latest pose.

The authoritative Maggot query-membership bit is transported through the
projector, strict JSON, compact sample 18/index 17, protocol 150 and pure history.
Birth/restoration are unbound, free movement (including zero displacement) and
accepted external rebind admit, accepted lethal damage clears, and self-bite
retains membership through uninterrupted t+2 before disposal at t+3. Save
schema and gameplay collision rules are unchanged. The explicit pause-crossing
App-parity test preserves a known difference rather than hiding it behind a
global scheduler rewrite. Ordinary enemy and selected primary-player
membership follow the recovered category/bank/lifetime contract.

Independent native-source report: SHA-256
`1ce1b5023825487f7703e44c87e38823cf66679aeb98d8e573585502b5a4d20a`.
The integrated read-only review at 14:16 UTC verified 60 source files without
drift and found no blocking defect; its additional current-camera regression
recommendation is tracked separately below.

Bounded Mac qualification is recorded under the dated Tree-fade archive:
- Final focused job `job_20261010T145409Z_2d146f68df` passed 221 tests,
  including the two independent frozen-tick/current-camera regressions; strict
  test typechecking and oxlint on 52 changed script/type files passed. Earlier
  affected actor/protocol/save/history suites passed 422 tests; counts overlap
  and are not a distinct-test aggregate.
- Real M2 original-atlas GPU tests passed 5,144 samples with maximum one-byte
  channel error and unchanged three-byte tolerance. These cover independent
  raw PNG material/hit/shadow, retention and restoration controls. The preserved
  first run's 12 edge failures came from the Canvas oracle discarding hidden RGB
  at alpha zero; product runtime and tolerances were not relaxed.
- Opaque default-framebuffer qualification passed 90 cases and 4,975,560 pixel
  comparisons, maximum one-byte error. All 42 optimized/reference whole-image
  pairs were byte-identical; actual framebuffer/opaque modes and exact
  screen-to-NPM-target-to-screen restoration were observed. The old uniform
  negative control failed 7,247 pixels, maximum 23. Report SHA-256:
  `aec781cf436103093b4104aaef5dc418464aa8dc134ccc6159ce245f9d4bfd53`.
  This source oracle uses explicit quarter-pixel placement. The original
  integer-phase run remains RED at one coincident top-edge pixel: the GPU
  covers it as background while that CPU oracle included a fragment. Both
  transforms/UVs/source texels and the original discrepancy are retained; this
  material gate does not establish native boundary-coverage parity.
- Headed compiled normal-input acceptance used original glyph 266/245 and six
  trusted S/W/S key events. Actual player X stayed 1560.07373 while Y moved
  244.01528 -> 130.00004 -> 244.01528. After 81 settled raw ticks per endpoint,
  eligible visible overlaps were `[] -> [object-10] -> []`, Tree alpha was
  `1 -> f32(.4) -> 1`, faded count was `0 -> 1 -> 0`, and ownership/tint mismatch
  counts stayed zero. Camera stayed fixed; player lighting and rain phase
  advanced normally. All 972 built files and 7,363 source files were unchanged
  during acceptance. Browser/host errors and GL errors were zero; owned
  processes/profile/lease were verified closed. The first attempt's missing
  automation-flag provenance query failed before navigation and is preserved.
- The ordinary compiled title/Hub/Boneyard/pause/settings/resume/resize journey,
  original-art trajectory, continuing GameOver clock, paused redraws, shadow
  independence, FOV/DPR and resource lifetime checks passed separately.

Maintained manual browser helpers are `smoke-native-tree-material.mjs`,
`smoke-native-opaque-tree.mjs`, `smoke-tree-fade-scene.mjs` and
`smoke-tree-compiled-crossing.mjs`. Use fresh explicit output directories;
the GPU source-texel helpers use installed Python/Pillow. Their readback or
fixture instrumentation must not be relabeled as uninstrumented performance.
The final exact-tree canonical gate, post-commit compiled recheck, publication
and live acceptance have separate per-commit receipts; this ledger entry does
not itself attest to those release steps.

The workload-matched performance check uses exact c73 and candidate compiled
clients with their matching protocol 149/150 hosts and the same seeded scene,
source scene hash and camera. The scene has 1,187 residents, 130 visible and
103 Trees; rainfall varies 561..578 drops, so this is not bit-identical replay.
The ordinary headed M2 Metal runs each advanced 301 renderer frames in about
five seconds (candidate 60.03 fps, c73 60.04 fps). Separate timing yielded full
presentation-plus-renderer callback median/p95 2.70/3.30ms versus 2.60/3.20 ms,
and asynchronous GPU median/p95 1.016/1.163ms versus 1.011/1.169 ms. All 300 GPU
queries resolved without disjoint or browser/GL errors. Both headless modes
had substantially lower rAF cadence; that retained observation is not a
candidate-only regression. These bounded windows do not establish global
combat, high-DPR or all-device frame rates.

Remaining limits are explicit: browser FNV initial scan phase is not the
retail process-global RNG stream; missing delivered history and changed camera
epochs are not reconstructed; pause-crossing Maggot deferred disposal follows
the documented web world clock rather than native global App parity; Solomon
`gone` retains its existing renderer-lifetime disposition; arbitrary native
external admission followed by stale-cell movement has no supported ordinary
web counterexample and is not generally modeled. Fresh stock final-frame
capture is still pending. Static native ownership, independent GPU equations
and compiled integration do not establish whole-scene pixel identity or all
actor-fade parity.
