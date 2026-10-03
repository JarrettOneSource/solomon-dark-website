# Teacher and courtyard rune

Native functions:

- Teacher constructor: `0x00502570`.
- Teacher update: `0x0050B260`.
- Teacher renderer: `0x0051C710`.
- Cast helper: `0x00505560`.

`0x0051C710` draws exactly one frame from College records `501..504`. It does
not draw College record `13` in that frame function. The Teacher vtable at
`0x007919AC` resolves slot `+0x28` directly to auxiliary function
`0x00505480`; this is an owned Teacher painter, not an optional or dormant
helper.

The exact auxiliary pass is:

- set RGBA to `(1, 1, 1, 0.25)`;
- draw College record `13` centered at `actor + (-40, +30)`;
- restore white/opaque RGBA;
- draw BadGuys record `67`, the stock black 25x25 ground shadow, centered at
  the actor at scale `1.25`.

## Corrected ownership of the secondary black symbol

A 2026-08-12 browser layer-isolation pass supersedes the earlier assumption
that every mark seen around the Teacher came from a Teacher-owned painter.
Hiding every child of `.hub-teacher` leaves the reported secondary black
symbol completely intact. The pixels are baked into the web
`hub-courtyard.png`, and an atlas-record montage identifies them as the
thirteen-part College bank `93..105`.

Those records do belong to the native Courtyard presentation, but the web
extractor had moved the whole bank by `(-432,-54)` before flattening it. That
translation is not present in the compiled renderer. In `Courtyard::Present`
(`0x0051EB60`), the loop at `0x0051F9C0..0x0051FA0B` walks the College array at
singleton field `+0x2498` and submits every record through `0x004142E0` with
draw coordinates `(0,0)`. The bank's own `2000x1000` logical registration is
therefore authoritative: its record origins span approximately X `681..1219`
and Y `675..954`. Applying `(-432,-54)` relocates the assembled symbol under
the Teacher; retaining the registered origins leaves it in the native
lower-Courtyard placement, mostly below the initial camera/HUD boundary.

Implementation consequence: keep College `93..105` in the Courtyard raster,
but composite them at their bundle registration with no additional offset.
Do not delete the bank, paint over its pixels, or attach it to the Teacher.
This is separate from the Teacher-local College `13` ring and from the
independently animated College `106..118`/`12` seal painters.

Evidence: live browser crops `/tmp/teacher-variant-1-all-live.png`,
`/tmp/teacher-variant-2-courtyard-only.png`, and
`/tmp/teacher-variant-3-courtyard-plus-ring.png`; atlas montage
`/tmp/college-93-118-montage.png`; clean stock capture
`%LOCALAPPDATA%/Temp/native-teacher-rune-a.png`; and the complete native
Courtyard decompilation in
`../Decompiled Game/ghidra_outputs/chase_field_offsets_20260413.txt`.

Confidence: high for pixel ownership, source records, and native placement
from the user-confirmed layer differential, bundle metadata, stock capture,
and the compiled draw operands. The earlier `(-432,-54)` web placement is
superseded.

Subsequent visual verification against the running stock scene corrected the
ownership inference above. The Teacher's actual ground mark is the
College-record-`13` ring drawn by `0x00505480`. The web's assembled records
`106..118` plus record `12` became a second Teacher rune only because those
world-registered Courtyard painters had been relocated to the actor. They do
exist in stock, but they belong at their independent Courtyard registration
near the lower statue. That distinction explains why deleting the assembled
seal fixed the Teacher while also removing the real statue-area feature.

Initial-Hub parity therefore requires one Teacher-local record-13 pass at
`actor + (-40,+30)` with alpha `0.25`, plus the helper's shadow. It also
requires the separately owned records-106..118/record-12 Courtyard painters at
their native world registration, never under the Teacher. The separate
College[13] lower-campus registration at `(1500,1000)` remains a different
world feature embedded in the Courtyard raster.

The Teacher update at `0x0050B260` and its exact operands also recover the
four-frame cadence. The action timer starts at `0`, advances by `0.075` per
fixed 60 Hz tick while below `20`, and selects `trunc(timer) mod 2`, yielding
alternating College frames `501/502` about every `0.2222 s`. The conversion is
confirmed by the SSE path in `0x00747360` (`cvttsd2si`), not inferred from the
decompiler. At `20` the timer advances by `1` per tick: frame `503` is the
release/cast interval until timer `100`, then frame `504` is held until the
timer passes `600` and resets. This is a `267 + 80 + 500 = 847` tick cycle.
The web's `83.333 ms` cast flicker is therefore too fast. At all points the
native renderer selects one full Teacher raster; it never composites two pose
frames.

Confidence: high for the Teacher cadence, vtable ownership, and local-rune
geometry from complete instruction streams and direct visual confirmation.
The earlier "dormant helper" conclusion and the later omission of the
independent Courtyard painters are both superseded.

The intermediate browser receipt taken before the independent Courtyard
painters were restored contained exactly one decoded Teacher-local rune at
alpha `0.25` and no assembled seal node. Its CSS transform placed the native
`(-40,+30)` logical center at `(-48.6,+35.4)` screen pixels under the global
Courtyard scale `1.2`, as expected. That receipt confirms the Teacher-local
pass only; it is superseded for world-layer presence by the final receipt
below. Screenshot: `/tmp/web-hub-current-0812.png`; trace:
`/tmp/check-hub-current-result.json`.

## 2026-10-03 — Report 55: auxiliary rune pass ownership reopened

The current original Discord message `1554265808480247809` was rechecked with
account `600774060439371807` at `2026-10-03T13:57:08Z`, together with nine nearby
messages. Its text, edit timestamp, and single attachment are unchanged. The
retained `1287x849` image has SHA-256
`74df9bca4cd4e7fe0596b1e5ade8da18276e03f9fb771a0018c6dfb510068aab`.
It shows the yellow-hatted Teacher and his pale College-record-13 ring, with a
maroon wizard crossing its upper edge. The Teacher's four-frame asset confirms
the actor identity. The still alone neither identifies the deployed revision
nor measures native painter order.

### Evidence before implementation

The retained retail executable was read directly on the M2: SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred
image base `0x00400000`. Its Teacher vtable at `0x007919AC` still contains
`+0x0C -> 0x00518280`, `+0x1C -> 0x0051C710`, and
`+0x28 -> 0x00505480`. This is a file read, not a new stock-runtime observation.

The already retained native decompilations establish the missing ordering
relationship:

- `Decompiled Game/refs_dat819978.log`, function `0x00505480`, lines
  `21126..21154`, draws the record-13 rune, restores opaque color, then draws
  the ground shadow. The raw documented constants confirm alpha `.25`,
  float64 offsets `40` and `30`, and shadow scale `1.25`.
- `Decompiled Game/ghidra_outputs/chase_field_offsets_20260413.txt`,
  `Courtyard::Present 0x0051EB60`, lines `6771..6789`, traverses the stored
  actor list and calls each vslot `+0x28` at return address `0x0051FA67`.
  The same function flushes the main Region queue later at return address
  `0x0051FD2D`, lines `6880..6885`. The independent additive Courtyard seal
  program is between these two intervals.
- Fresh published main `3f130d3382bb321dd631aeb4e720ed8e5ed63d06` constructs
  the rune, shadow, and Teacher body as children of one depth-sorted
  `HubTeacherView.container`. `HubWorldScene.applyPainterOrder` places that
  entire container at Teacher's body row. The current source therefore allows
  the rune to cover a different actor that precedes the Teacher in that queue.

The original recovery correctly separated the body and auxiliary native
functions but kept both callbacks in one browser actor composite. Earlier
validation of the rune's presence and opacity did not test its overlap with a
different world actor.

### System boundary and provisional membership

The owning system is Teacher's `+0x28` auxiliary callback and its relationship
to the existing Teacher body, release children, and Courtyard intervals. No
new gameplay, replication, or native art extraction is required by the traced
cause. Product code has not changed; current built behavior still requires an
admitted M5 baseline.

| Member | Native source | Current disposition and required proof |
| --- | --- | --- |
| Teacher-local rune | `0x00505480`, College `13`, alpha `.25`, local `(-40,+30)` | `recovered-pending-port`; verify the current failure, then preserve pixels/geometry while restoring the auxiliary interval |
| Teacher ground shadow | same callback, BadGuys `67`, scale `1.25`, actor origin | `recovered-pending-port`; remains immediately after the rune in the same auxiliary owner |
| Teacher body frames `501`, `502`, `503`, `504` | `0x0051C710`, current frame selector | unchanged owner; verify each pose still sorts in the Region body queue |
| Teacher flare, column, SpriteArray frames, and core | `0x00505560`, existing pre-world/two-transient/post-world roots | unchanged owners; preserve the previously recovered release program and validate release crossings |
| Courtyard scene and party/private-College reuse | type `5008` construction; current shared `HubWorldScene` | one rendering path; verify local/remote players, Students, camera changes, and region leave/return |
| Independent animated Courtyard seals | College `106..118` and `12`, `0x0051EB60` | separate owner; preserve their recovered later ground interval and authored registration |
| Lower-campus static College `13` | `(1500,1000)` Courtyard raster registration | `out-of-system`: static raster occurrence is not the Teacher callback |
| Secondary Magic Circle `49` | `0x005E1BA0/0x005E1C20`, BadGuys `48`/`7` | `out-of-system`: separate cast actor, art, lifecycle, and Region/light ownership |
| Other actors' ground callbacks and Report 56 shadow occlusion | other vtables and caster/scenery contracts | `out-of-system`: this report traces the Teacher callback only; inspect a concrete shared overlap before expanding scope |

### Validation contract and open questions

Before changing product code, capture a deterministic current renderer case
with a local or remote wizard crossing the Teacher ring's upper edge and
compare rune-enabled versus rune-hidden pixels on an opaque actor-body mask.
The ring must still change exposed ground pixels. A real rendered control at
the opposite side of the Teacher row distinguishes auxiliary ownership from
a guessed body-depth adjustment. Check Students and overlapping scenery, all
four Teacher poses and release phases, camera/FOV changes, and Courtyard
leave/return through the same public renderer.

After a proved remedy, run the meaningful public regression and a built game
journey on the actual M5 lease, then the unchanged exact-source canonical
gate. Preserve Report 09's native material batching and all renderer quality
gates. No current build, browser, native runtime, acceptance, publication, or
deployment result is claimed by this investigation entry. The reporter's exact
historical revision and encounter timing remain unknown.

### Current rendered cause — 2026-10-03

The exact `3f130d33` product source was admitted on the actual M5 lease at
`15:53:22Z`: original commit/tree/index and all `7,254` tracked working files
matched the M2 manifest
`5d0ee83c88102d87fe29895ca9b390a409fb5c242dc16eef3c6bbdc3031a2582`.
Only this pending ledger differed from the committed main tree.

The real public `createHubWorldRenderer` WebGL renderer, real simulation and
snapshot/timeline fixture, held Teacher at idle tick `500` and one Fire wizard
at seven upper-arc and seven opposite-row points. An independently rendered
transparent actor mask supplied `1,623` or `1,639` opaque pixels per case.
Toggling only the actual rune altered `23..252` opaque wizard pixels in six
upper-arc cases, with maximum RGB-channel differences `39..58`. All seven
opposite-row controls altered zero opaque pixels above the two-channel
rounding tolerance; their maxima were `0..1`. Every case retained nonempty
exposed rune pixels (`12,194..13,682` changed ground pixels).

The corrected receipt at `16:06:47Z` snapshots the retained planner rows:
upper-arc Teacher row `20`, sequential depth `13`, follows player row `0`,
depth `12`; opposite-row Teacher row `-40`, depth `12`, precedes player row
`0`, depth `14`. Rune alpha is `.25` and the actual packed original frame is
`268x208`. Browser-error and failed-response arrays are empty. A subsequent
public regression asserting that the rune cannot alter opaque wizard pixels
failed before the product fix at `16:08:46Z` for that exact behavior.

Two diagnostic qualifications are retained: attempt one stopped before pixels
because its selector incorrectly guessed the frame dimensions; attempt two's
pixel results are valid but its row references were retained across later
planner calls. Attempt three corrected those metadata copies and reproduced
the same pixel results. These are probe corrections, not product remedies.
This source-imported renderer fixture establishes the current cause; it does
not replace the later built game journey, full gate, or release acceptance.

The implementation must retain rune-then-shadow as one Teacher auxiliary
root in the canonical ground interval after the static Courtyard raster and
before its independent seal banks and main Region queue. Teacher's body and
marker keep their original actor registration and the release children keep
their established owners. A numeric interval label represents that recovered
pass boundary; it is not a new rune Y bias or authored sort key.

### Focused remedy receipt and remaining acceptance

`HubTeacherView.ground` now owns the unchanged rune followed by its unchanged
shadow. `HubWorldScene` attaches that root to the canonical Courtyard world;
`HUB_WORLD_DEPTH.teacherGround` identifies the recovered interval after the
raster and before seals. The Teacher body and marker retain their original
row and the release children retain their pre-world/transient/post-world
owners. Camera and region visibility remain owned by the same scene parents.

The two-file candidate and pending ledger matched all `7,254` tracked M2/M5
working files, manifest
`6ab82b989717c64c98fa28da6314361f818f4b4a0a28f907bc7230f3364a2f87`.
The same actual public renderer regression passed all `14` cases at
`2026-10-03T16:14:19Z`: zero changed opaque actor pixels above tolerance,
maximum channel difference `0..1`, and the exact same nonempty exposed-ground
counts as baseline. The body planner rows are unchanged. All `45` focused
Hub/render-contract Node tests and full TypeScript checking passed by
`16:14:29Z`. Browser errors and failed responses remain empty.

The diagnostic lease was cleaned and released at `16:18:08Z`, before its
`16:23:22Z` bound: no owned processes, all `24` monitored real-home entries
and immediate children unchanged, and private temporary/profile data cleared.
The private candidate/tools/pixel evidence remain inactive for later acceptance.

The maintained public regression is `tools/teacher-circle-layering-probe.mjs`,
invoked by `npm run smoke:game:teacher-circle` with
`SDR_GAME_TEACHER_LAYERING_EVIDENCE_ROOT` pointing to private evidence storage.
It uses real simulation/snapshot/timeline data and native renderer output;
it does not mock actors or expose a test-only production API. The maintained
helper version still requires the next admitted M5 execution.

Remaining acceptance includes Teacher's other poses and release phases,
remote/Student/scenery overlaps, camera/settings and region-return behavior,
a real built game journey, the final current-main exact all-mode gate,
normal publication and managed live deployment, and both-device cleanup.
This focused result is not a final report completion or a production claim.
