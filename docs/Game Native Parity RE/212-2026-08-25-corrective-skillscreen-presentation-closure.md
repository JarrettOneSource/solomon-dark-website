# 2026-08-25 — Corrective SkillScreen presentation closure

## 2026-10-03 — Report62: high-count page extent reopening

The unchanged live report `1554346487985606666` supplies an overflowing web
SkillScreen image and original-game two-row horizontal-navigation footage.
The earlier level75 message is context only. This entry does not reopen level
progression or the accepted Report47 glyph/tooltip correction.

The previous page-layout receipt tested three pages that fit in two rows. It
did not establish the inherited SwipeBox content extent, maximum row count or
horizontal-navigation branch. Calling complete public-row construction
coverage a complete high-count navigation receipt missed those consumers.

### Evidence and current causal trace

- Focused live Discord read at `2026-10-03T09:28:03.039021Z`: the primary,
  context and attachment IDs are unchanged; nine nearby messages contain no
  relevant correction. The context image is not a completion target.
- Retained web image `1554346487092355193__image.png`, 1903 by 1080,
  SHA-256 `a6f74a5d2b31b9a0ff4f9131dc2d7514e6b2700ef5df8e441f57349e006cca39`:
  three dependency-page rows; the third row crosses the bottom chain/belt and
  its quick descriptions extend below the image. This is direct observation,
  not proof of the reporter's complete saved rank vector or input history.
- Current published `49dfb71adeffa910d8d80f3103f8186d3dcf337b`:
  `nativeSkillBookPagePlacements` wraps after width 1590 with no row limit;
  multi-row placement starts at 72 with pitch 300. A third page row occupies
  native y 672..972, beyond both the page region's bottom 810 and the 900-pixel
  stage. The shared renderer consumes every placement; semantic buttons use
  the same x/y; the stage clips overflow. Neither owner has a page scroll
  offset or navigation control. This is confirmed source evidence; no current
  built-client baseline has yet run for this reopening.
- Entry194's recovered `SwipeBox` caller census includes SkillScreen. The
  maintained `native-ui-swipe-box.ts` already owns exact extent clamps and
  previous-minus-current pointer dragging. These established base mechanics
  are reusable; the missing SkillScreen-specific layout, axes, chrome and
  step behavior still require the original clip/native comparison.

### Boundary and provisional membership

System: optional actor-owned SkillScreen dependency-page construction and
its inherited content viewport/navigation, shared by College and Boneyard.
Catalog membership and loadout authority remain their established owners.

| Member | Native/current owner | Investigation disposition and required proof |
| --- | --- | --- |
| All public rows 8..79, effective/item-granted availability and acquisition order | catalog; `0x0066B380`; `nativeSkillBookPages` | Existing membership retained; prove no row loss while navigating and after grant removal. |
| Dependency roots, transitive/shared children and widest page | `0x0065E670`; page width 200 plus 160 per child | Layout/navigation pending native comparison; preserve page and row order. |
| Empty, fitting one/two-row and high-count overflow branches | builder `0x0066B380` | Recover full layout/content extent before implementation. |
| Page clip, translation and navigation bounds | inherited SwipeBox `0x00431400/0x00431860/0x004316D0` | Existing base facts retained; recover SkillScreen axis/extent consumers. |
| Navigation arrow membership, placement, input and retirement | SkillScreen root and inherited controls | Original footage/native evidence pending; no guessed arrow or scrollbar accepted. |
| Mouse/touch background drag, wheel and keyboard reachability | SkillScreen/SwipeBox; browser semantic input | Recover native branches; prove movement, clamping and actionable card hit coordinates. |
| Primary, concentration and category 2 belt drag variants | `HoverButton`; `SkillDragger`; shared host commands | Preserve selection, concentration lock, duplicate belt legality and actor isolation across navigation. |
| Every quick-description and detailed HoverBox variant | page painter; existing exact glyph/box owner | Preserve typography; prove fully reachable source cards and details at both horizontal bounds. |
| GPU pages and semantic hit/focus regions | `skill-book-renderer`; `SkillBook` | One coordinate model must own translation and clipping for both consumers. |
| Tutorial skill-modal callouts | `tutorial-modal-callouts.ts` consumes page placements | Preserve the authored starter/three-page targets; inspect any changed geometry caller. |
| Book open/close, Inventory replacement, input suspension and teardown | shared optional-book lifecycle | Existing contract retained; prove scroll/hover/drag state retires with the screen. |
| Desktop and contained touch/narrow viewport projection | fixed native stage and full-browser curtain | Preserve text size, aspect containment, modality and accessible navigation. |
| Item/shop/Boast/party SwipeBox siblings | distinct content owners | Out of this reopening; reuse the established primitive without changing sibling contracts. |
| Mandatory SkillPicker, mod-skill aside, stat pages and level progression | distinct owners | Out of this page-navigation system; preserve accepted behavior. |
| Rows 80/81 and reserve 82; Report61/63 | nonpublic rows; independent reports | Out of system; no level-cap, wave-counter or set-bonus implementation. |

### Remaining evidence and acceptance

The original clip's exact two-row packing, content extent, arrow step/press
behavior and any inherited-axis override remain unverified in this pass.
Do not select a remedy until verified presented frames and native evidence
settle them. The reporter's exact save is unavailable; a controlled high-count
fixture must be labeled separately from an exact historical replay.

Required acceptance: a meaningful failing high-count regression; complete
shared layout/render/hit correction; keyboard/pointer/touch reachability and
descriptions; both scenes and relevant scale/aspect cases; selection/belt and
book-lifecycle journeys; the unchanged exact-candidate canonical all-mode gate
and real built browser acceptance. All local checks and intensive media/native
work use a granted M5 SSD slot. No implementation or acceptance result is
claimed by this provisional entry.

### Bounded M5 diagnosis and recovered packing

The October 3 M5 diagnostic admitted the exact published commit `3f130d3382bb321dd631aeb4e720ed8e5ed63d06`,
tree `72e35c15968ec5c9cbe5d6ff3ef3d00f48cde236`, index and all 7,254 original
tracked blobs. A genuine shallow Git root imported the unchanged original
commit object; no synthetic Git revision was used. The unmodified production
frontend/host build and bundle budget passed. No canonical all-mode gate ran.

A real built College journey used the existing owned-rank grant and native
Weld 1000 APIs. It produced 27 unique public visible rows and 16 dependency pages,
with no forged rank vector, missing Weld build or mutually exclusive pair.
Actual page rows began at 72/372/672/972. The final four icon hit targets
`8,10,9,52` lay wholly below the 900-pixel stage; third-row quick descriptions
crossed the fixed HUD. Navigation controls were absent. Page, console, HTTP
response and host error arrays were empty. This is a controlled owned-skill
fixture, not a replay of the unavailable reporter save.

The sealed 4,723,200-byte retail image retained SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` at preferred
base `0x00400000`. Private installed Apple LLVM instruction extraction plus
standard-library PE mapping established these rules:

- `0x006576C0` embeds a SwipeBox at SkillScreen `+0xA4`; its rectangle is
  `(0,50,screenWidth,screenHeight-140)` in opener `0x0067CAC0`.
- Builder `0x0066B380`, especially `0x0066B6C3..0x0066B799`, initially packs
  pages in acquisition order until a page would exceed viewport width minus 10.
  It wraps into row two at local y 300. When another wrap would exceed 300, it
  permanently stops adding rows and appends to the shorter row extent. Equal
  extents choose row two. It preserves the original page list order.
- Row pitch/page height is 300 (`0x00784898`, `0x007858F8`); dependent width is
  160 (`0x0078BFB8`). Two rows receive the 22-pixel inset (`0x00786C58`). A
  single row is vertically centered; the common 22-pixel addition cancels the
  single-row adjustment. Horizontal centering clamps at zero, so overflow
  starts at the left edge rather than at a negative centered origin.
- Builder `0x0066B90B/0x0066B917` writes the widest content extent and zero
  vertical extent into the embedded SwipeBox. `0x004316D0` therefore clamps
  horizontal offset to `0..max(0,contentWidth-viewportWidth)` and vertical
  offset to zero. `0x004315F0` moves every child by the actual clamped delta;
  `0x00431860` clips/translates the same children while preserving outer HUD.
- `0x00431C80/0x00431CD0/0x00431520/0x00431DA0` recover background pointer
  down, previous-minus-current drag, tick consumption and release. This is a
  continuous content viewport, not a third/fourth vertical page or scrollbar.
- Builder `0x0066B7F9..0x0066B802` sets the second-row flag; overlay
  `0x0065C677` suppresses the instructional help branch for two-row content.
  The current always-painted help text is another missing consumer of layout.

Full original playback used the existing campaign presented-video helper under
private Chrome. The 15.582233-second clip ended after 467 frames with zero
drops; 18 nonblack `requestVideoFrameCallback` captures and browser error
arrays were checked. Settled 11.011/15.5155-second frames show exactly two
rows, horizontally clipped content and a stationary belt/HUD. Earlier failed
file-viewer/HTTP setup attempts yielded no usable menu evidence and are not
acceptance receipts. No clicked-arrow step or exact input history is inferred
from the successful frames.

The owning navigation-lifetime contract is still open: `0x0067CB4D` reads the addressed actor-owned skill book
`+0x7A0` and submits it to the SwipeBox setter before the builder runs. Whether
the saved value survives that clamp, who writes it on close, and its reset
scope require the destructor/opener/actor initialization thread. Do not add
persistence fields or default to component reset from this read alone. A
dedicated native arrow action is also unproved; retain the reported claim
without inventing a paging step or guessed visual control.

Two existing-interface packing regressions are prepared from the recovered
instructions and the captured 16-page width inventory. They have not run yet;
the M2 has no Website validation receipt. GPU/semantic translation, focus,
selection, descriptions, lifecycle and touch/scale acceptance remain pending.
The actual M5 lease was released at 14:48:19.327801 UTC with zero owned
processes and unchanged 24-entry real-home/immediate-child snapshot. The private
SSD source/tool/evidence root remains inactive for the pending remedy.

### Narrow lifetime closure and intended regressions

The short M5 loan acquired at15:43:54.129656 UTC extracted only the four
planned destructor/wrapper/opener/book-constructor ranges and three directly
called attachment/rectangle functions. It released at15:51:09.080111 with
zero owned processes and unchanged24-entry home/immediate-child snapshot.
No original-media, build or full-gate replay ran.

- `0x0066B267..0x0066B27C` reads SkillScreen `+0x128`, the embedded SwipeBox
  `+0x84` horizontal offset, dereferences the actor-owned book handle at
  `+0x78`, and stores the offset in that book's `+0x7A0`. The write precedes
  page destruction and reference release; it is not a raw actor-field write.
- Book constructor `0x006594E0`, write `0x006595F5`, initializes `+0x7A0`
  from `FLDZ`. Deleting wrapper `0x0067CAA0` calls the same screen destructor.
- Game opener `0x005CA6AD..0x005CA721` allocates a fresh screen when the
  optional-book pointer is absent. `0x004277E0` binds the destruction backlink;
  `0x004280E0` registers the child and its parent. These calls do not construct
  skill pages. The fresh embedded SwipeBox constructor initializes content
  extent to zero. Its rectangle setter `0x00427770` invokes the SwipeBox's
  no-op slot `+0x1C`; it does not set a page extent.
- Open `0x0067CAC0` submits the saved book offset to `0x004315F0` before
  builder `0x0066B380` assigns content extent. That initial zero-extent clamp
  clears the requested offset; the builder then retains the clamped origin.
  The native saved field therefore does not establish restored visible scroll
  on a fresh screen. The port starts a fresh viewport at the left edge and
  keeps its offset local to that screen; it adds no protocol/save persistence
  field from the attempted native bookmark.

The two prepared public `nativeSkillBookPagePlacements` cases ran against the
unchanged runtime with pinned Node22.17.0. Both failed with `ERR_ASSERTION`,
exactly2 failures and0 skips, exposing third/fourth rows and wrong overflow
centering. These are intended regression reds, not a successful gate. The
source overlay contained only35 test lines; no runtime remedy ran on M5.

Implementation now updates the shared native packing/extent model, the one
SkillBook content viewport and its renderer/semantic translation, background
pointer/touch drag, and browser keyboard/focus reachability. Fixed chrome,
HUD/belt, native glyphs, book transitions and host-authoritative selections
retain their existing owners. The native input evidence proves background
drag; no paging-arrow producer or nonzero horizontal wheel-axis writer was
found in these constructors/openers. A guessed arrow or scrollbar is not part
of the remedy. Browser keyboard focus/scroll remains an accessibility input
into the same bounded content viewport, as in existing SwipeBox menus.

### Prepared complete remedy and next verification

The current unvalidated candidate puts packing, row count, content extent and
complete-column focus reveal in `skill-book-model.ts`, using the existing
SwipeBox clamp/drag primitives. `SkillBook` owns one clipped horizontal viewport
and its pointer identity, offset, hover page and focus. Semantic controls and
the GPU page layer consume the same transform; shared-dependency copies keep
their own HoverBox source. Fixed HUD and book transitions retain their existing
owners. Tutorial pointers consume the published viewport offset and reset it
with the screen. The maintained tutorial browser helper now supplies that
coordinate field. Page glyphs stay retained during panning; two-row help is
omitted at its producer.

`smoke-skill-book-navigation.mjs` is prepared for the next granted M5 phase.
It uses the actual production client/host and valid grant/Weld APIs, separates
the five mutually exclusive branch pairs into two fixtures, and covers their
complete public-row union. Desktop and contained touch cases exercise College
and Boneyard, background pan and keyboard bounds, every semantic entry/detail
owner, primary/concentration selection, belt drag and reciprocal Inventory
replacement. It samples real WebGL HoverBox gutter pixels at each visible
source to detect missing or wrongly anchored descriptions, including repeated
dependency rows. No new native arrow, scrollbar, wheel action, rank cap or
text scaling is introduced.

The model-capacity interruption at16:59:34 was an agent execution error; the
sealed11-file partial candidate was recovered unchanged before further edits.
All additional implementation/tests/helpers remain unvalidated. Focused green,
typing/lint/build, complete built journeys and the final exact-candidate
canonical all-mode gate still require actual M5/main-lock ownership.

### October 4 scoped acceptance and final integration checks

The admitted `d6446f4d` source passed 59 focused tests (no failures/skips),
TypeScript, normal lint and the production frontend/host build and bundle budget.
The helper-only `eabda806` correction preserves all runtime blobs. Its exact
7,257-blob source admission and separately identified compiled `d6446f4d` runtime
passed helper lint, corrected quick navigation, the full eight-case matrix and
four authored tutorial viewport cases. The automatic terminal release was
2026-10-04T01:50:18.981652Z before interpretation.

Desktop/touch, legal alternate branches and Hub/Boneyard each exercised 67 owned
IDs and 71 semantic copies; their union contains every public ID 8–79. Real pan,
keyboard bounds, every visible column and GPU detailed-box owner, fixed HUD,
primary/concentration authority, duplicate belt assignment and reciprocal
Inventory retirement/reopening at offset zero passed with empty error arrays.
Stock/wide/tall/touch tutorial geometry, opening/settled states, backpack and
third-page concentration targets and blinking duty cycle passed unchanged.
The first reopening timeout remains failed evidence; the successful correction
waits for actual outgoing owner retirement, rather than a filtered settled
selector disappearing upon entry into its closing phase.

Two narrow integration cases complete the newly changed consumers. The maintained
navigation helper's `--item-removal` case uses the native named Strangler grant
for Call Leviathan, permanently unlearned, appended to a fitting learned layout.
It pans the real overflow and removes the provider through the established
revisioned economy API. A supported primary choice publishes the changed paused
owner; the open screen must clamp to zero, remove the temporary row and retain
all remaining reachable columns. Its desktop/touch fixtures are controlled API
cases, not an exact historical-save replay.

The maintained tutorial helper's `--scroll-translation` case uses the stock
Tutorial restore and legal learned-rank grants. A real 100-pixel pan must move
both lesson targets by exactly that offset, keep fixed HUD geometry stationary,
and restore the unshifted targets when the screen is closed and reopened. Their
source-qualified results, final unchanged canonical all-mode gate and deployment
receipts are recorded by the report campaign; no unexecuted outcome is asserted
by this source freeze. No arrow/wheel producer, persistence field, level cap or
Report47/61/63 behavior is added.

## 2026-09-27 — Report 47: inline skill-stat unit typography reopening

The edited report identifies the damage and mana-cost `/ second` suffixes in
Frost Jet's level-up detail box. Its preserved 861-by-805 screenshot shows
the small units drawn across the `5.5` and `18.50` values. This is a separate
failure from Report 33's outer HoverBox width: the box contains the ink, but
two runs within each stat line overlap.

### Evidence and causal trace

| Evidence class | Source | Observation | Confidence |
| --- | --- | --- | --- |
| Reporter image | `2026-09-25/47-level-up-stat-text-misaligned/attachments/1553073787686355174__image.png`, SHA-256 `3980bb9d5956b77c01f81b42db6d8a9a8a08ee033a7ebd663782b4c710f782e1` in the retained report archive | Frost Jet rank three has overlapping damage and mana-cost suffix ink. | high, visual |
| Authored data | tracked `native-skill-catalog.json`, Frost Jet row 32 and complete public-row sweep | Both strings append `_s(.7)_o(0,1)_i / second`; 19 catalog rows contain 25 stat/bonus lines with this same inline command family. Multi-rank titles use the same scale/offset parser. | high, static |
| Retail instructions already recovered | 0.72.5 `SolomonDark.exe`, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; entry 287 `ExactText_Render 0x0043AFC0 -> Glyph_Draw 0x004143D0`; entry 212 HoverBox `0x005C3A60` | The shared native pen advances glyph by glyph and applies italic to glyph geometry; skill detail uses this ExactText owner. No fresh stock runtime recording is claimed. | high, instruction-derived |
| Current Website reconstruction | published base `8ecf4f8b`; Chromium 150 WebGL probe on WSL at 1600 by 900; task-only Frost Jet rank-three render probe | Damage suffix starts 29.68 pixels before the value's ink ends; mana suffix starts 32.54 pixels before it ends. `native-skill-hover-box.ts` measures a logical run advance, then skews the entire suffix container around its stage origin; its child glyphs have no italic skew. The large local Y coordinate shifts the whole suffix left. Baseline image SHA-256 `696b9f6ec21ca79d12120e56d3adbfacedde0e08a723fce3b022cd3187a8b933`. | high, live/static |

The earlier presentation pass ported the shared HoverBox and text commands but
skipped the final glyph-transform ownership: a Pixi container skew is not a
native per-glyph italic. Report 33's frame-containment probe could pass while
two runs on one line still collided. The existing `nativeUiPixiFor(...).textRuns`
already implements the recovered continuous pen, run scale/offset, and
per-glyph italic; the skill painter hand-rolls those operations instead.

System boundary: the shared SkillScreen/LevelupScreen skill-detail ExactText
painting path from catalog semantic lines through command runs to glyph ink.
The same box painter serves Hub and Boneyard SkillScreen hover and the
LevelupScreen's read-only desktop/touch detail extension. It owns painted
line layout and teardown, not skill progression, offered choices or authority.

| Member | Final disposition | Proof |
| --- | --- | --- |
| Frost Jet's two rank-three stat suffixes | `exact-ported` | Exact built desktop/touch browser captures show the small italic units following their values; the browser render probe finds positive native ink gaps. |
| All 19 authored styled stat rows (25 lines), including other per-second units | `exact-ported` | One shared painter and 148 rank/row inline browser cases have zero failures; no item-specific offsets remain. |
| Multi-rank title suffixes and other command runs | `exact-ported` | The same continuous pen preserves parsed scale/offset commands; 422 rendered cases retain title/rank order with zero frame overflow. |
| HoverBox semantic line builder, 380/400 wrapping and box geometry | `verified-already-at-parity` | Report 33's width and overflow checks remain green. |
| Hub/Boneyard SkillScreen, LevelupScreen detail, desktop/touch and teardown | `exact-ported` | Both scenes and menus call the same corrected painter; exact built desktop/touch LevelupScreen journeys, a current Hub SkillScreen capture, the 422-case render/retirement sweep, and Report 33's earlier Boneyard book acceptance cover the scene/lifecycle membership. |
| Other native UI text consumers, item/shop/dialogue boxes and gameplay authority | `out-of-system` | Different text producers/painters; no catalog or simulation mutation. |

The falsifying acceptance is a real Frost Jet rank-three render with positive
suffix-to-value ink gaps on both lines, followed by the complete styled-row
render sweep, the mandatory picker and optional book journeys, and the WSL
canonical Website gate. A change to generic glyph metrics or a Frost-only
spacing constant would contradict the recovered ownership.

Implementation preflight: the skill painter now submits each parsed line to
the existing shared `textRuns` glyph path instead of skewing each suffix
container. The WSL browser render check failed before that change on all 148
styled cases; afterward it painted 422 public-row/build cases and 59,116 glyphs
with zero frame overflows, zero inline failures, and no retained children.
Thirty-nine focused typography/skill tests, lint, and production build passed.
The built Hub LevelupScreen displayed rank-three Frost Jet on desktop and
touch; both screenshots were inspected, the detail remained read-only and
silent, and page/console/response errors were empty. The shared SkillScreen
painter also reached a real Hub Call Leviathan tooltip in a separate browser
journey. That broader book smoke later timed out in its two-second belt
pull-off effect wait, after the relevant tooltip capture; this is not recorded
as a complete book-journey pass. Earlier Report 33 acceptance already covered
Hub/Boneyard optional-book and level-up detail call sites.

The exact source candidate `79fd695e3213626fb0ceb6d8b9bc73c5aa2d9de9`
passed the WSL canonical gate: 3,943 Node tests and 24 Python tests with no
failures or skips, 100 percent renderer quality coverage and no quality
failures (gate log SHA-256
`b95279515d1840d6611e76089ce4183577c181f2376c6d84ca03d3231c0a0059`).
The same exact tree repeated the 422-case/59,116-glyph browser render sweep,
including 148 inline checks and zero errors (log SHA-256
`dc6b4d6a2dc6014497460bc3581e2c05bea71cffcf173328f58fe118b3b726a5`),
and the built desktop/touch Frost Jet journeys with read-only/silent detail
and empty browser error lists (log SHA-256
`9de02a547d3781436dcd6de11ac9f31ab25acd6503c4fffd703295c4782a68b1`).
No browser platform approximation or catalog/rank change is involved. The
separate full optional-book smoke's later belt-effect timeout remains a limit
of that broader journey, not a pass claim for it.

### September 28 supplemental: optional-book smoke failures

The published inline-text correction remains accepted. Two later, broader
SkillBook journeys stopped outside that text owner: the long tooltip smoke
could not retain a Hub Skills dialog immediately after selecting a level-up
offer, and a separate full SkillBook smoke waited two seconds for the brief
belt pull-off burst after a drag. These are tested as separate menu-lifecycle
and transient-effect questions; neither invalidates the 422-case text sweep.

On base `ab72d149`, the unchanged built WSL tooltip journey reproduced the
first failure. A task-only browser trace shows the post-picker click setting
`skillBookOpen=true` with resume grace `none`, Hub input blocked, a living
level-two player and progression revision four in both host and replicated
snapshot, but no Skills dialog or SkillBook component mount. The module's
manual prefetch and its later React.lazy load both resolved without a page,
console or failed-response error. A static-import control passed the same
picker-to-book journey; keeping React.lazy and removing only the separate
`void loadSkillBook()` prefetch also passed. The actionable boundary is the
duplicate preload/lazy handoff in `MainMenuScene.tsx`, not player progression,
native skill ranks, the shared text painter, or an ignored button click.
The no-prefetch path needs full Hub/Boneyard and touch/browser acceptance before
it is permanent.

The belt burst is a smoke timing defect, not a missing game effect. On the
unchanged WSL runtime, a browser `MutationObserver` armed before the gesture
saw the burst mount with exactly 24 smoke and four move-fade members, then
retire. The 16-step Playwright mouse move took 7,957 ms under software
rendering; the burst existed for about 767 ms during that move, with a first
member's CSS duration of 140 ms. The script began its RAF wait only after
the entire move, so its two-second timeout could never observe the already
removed node. The poof cue fired once, the UI showed Belt 2 empty, the host
belt entry was `null`, and browser/network error arrays were empty. Arm the
wait before pointer movement and capture the observed member counts while the
node is mounted. Preserve the native 50-unit pull-off threshold, transient
visual lifetime and strict 24-member contract; do not lengthen the product
animation to satisfy a late test wait. The WSL screenshot taken after the
long gesture did not capture the already-retired burst and is not claimed as
a pixel receipt; the pre-armed DOM observation and game/audio state are the
acceptance evidence for this transient edge.

The independent dev-server SkillBook smoke also has a software-rendered stage
readiness boundary before the gesture. At the original 30-second timeout the
DOM contained a settled, visible, non-inert `.skill-book-stage` with exact
`role="dialog"` and `aria-label="Skills"`, a ready WebGL canvas and all
ancestors visible. A direct-selector control could likewise time out at 30
seconds; giving that unchanged stage assertion 60 seconds measured its
visibility at 30,133 ms and advanced through the verified pull-off receipt.
That falsifies a role-query-only explanation and justifies increasing only
the initial dev-server smoke readiness limit. No selector or gameplay/UI
change is retained. The broad control later stopped at its separate Primary
Attack selector wait, so it is not claimed as a complete journey pass.

The exact no-prefetch candidate then passed the maintained long built-client
tooltip journey on WSL: eight desktop/touch receipts covering Hub picker,
Hub SkillBook, Boneyard SkillBook and Boneyard picker, with empty page,
console and response errors (log SHA-256
`3929554ac8dfb5facfa5e511f4ac47025fbe0b33db522a6f4dde98aad6ba154e`).
With the initial dev-server smoke readiness limit measured and extended to
60 seconds, the unmodified semantic role query reached the pull-off gesture.
The pre-armed RAF wait captured the exact 24-smoke/three-or-four-fade burst;
the smoke advanced through poof audio, saved empty Belt 2, subsequent
concentration drags and Fireball drag. The broader journey then timed out at
its later `Select Primary Attack` selector; this pass does not claim that
unrelated tail succeeded. It does prove both supplemental stopping edges on
the exact candidate. The remaining full gate, publication and cleanup are
separate acceptance receipts.

## 2026-09-26 — Report 33: shared skill HoverBox text-width ownership

The Meditation concentration bonus overruns the right border in the reported
LevelupScreen screenshot. The earlier closure checked authored text presence
but did not exercise the native line-add width boundary. Its 380-pixel maximum
was applied to the whole box while only descriptions were wrapped. That
assumption is superseded here for both SkillScreen and the requested
LevelupScreen detail projection; changing Meditation's copy or shrinking its
font is not the native fix.

### Native evidence and causal trace

The retail image and canonical Ghidra program are SolomonDark.exe 0.72.5,
preferred base `00400000`, SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`.
Fresh read-only M2 replica queries recovered the complete skill detail builder,
stat/bonus formatters, line insertion, measurement, wrapping, positioning and
render owners. The canonical project and Mod Loader are unchanged. This is
instruction/data evidence, not a fresh clean-stock gameplay recording.

- `0066B990`, reached through Skills_Wizard vtable cell `007A0D78`, first
  wraps the description through `0043D230` at float `0078E934 = 380`.
- Every resulting title/category/description/stat/bonus line goes through
  `Dialog_AddLine 005BCCB0`. It measures ExactText via `0043C870`, compares
  against **double** `0078E600 = 400`, and wraps an over-width line through
  `0043D030` before storing it. The generic limit is distinct from the
  description's narrower preparatory wrap.
- The line-add tail updates HoverBox `+80` to the maximum measured stored
  line width. It does not clamp the box independently of the rendered text.
  `005AB060` adds the requested margins; the SkillScreen opener `00656CE0`
  supplies source gap 50 and margin 25.
- `005C3A60` consumes those stored strings with ExactText; indentation, explicit
  breaks and inline rank/scale commands must not be replaced by CSS wrapping.
- The complete public-row/rank scan of the existing extracted catalog finds
  Meditation's bonus at 424 logical pixels. Its current box allocates only
  380 content pixels. No other non-description authored row in that scan
  exceeds 380; the correction nevertheless belongs to all semantic line kinds.

The full xref sweep found only `0066B990` and `004FD6A0` using the specialized
description wrapper `0043D230`. HoverBox constructor callers are `004A98E0`,
`00553B80`, `0055E2C0`, `0056FC90`, and `0066B990`. All line-add callers were
enumerated; the skill builder's own calls, including both current/next-rank
branches and all Welding cases, share the same width owner. Other item,
message, and shop builders do not use the Website skill tooltip compositor.

### Boundary and membership before implementation

This correction owns the shared **skill-detail text-to-box width pipeline**,
from authored semantic lines through wrapped text and measured extents to
the existing fixed-stage HoverBox placement. It does not change progression,
offered ranks, copy, fonts, colors, line gaps, interaction, audio or gameplay.
Existing native catalog rows/assets are reused in full, not re-authored.

| Member | Native source | Disposition / acceptance required |
| --- | --- | --- |
| All public skill rows 8–79, every authored rank and boosted/item-granted titles | existing complete catalog; `0066B990` | exact-ported: exhaustive layout checks |
| All fourteen concentration bonus families, including Meditation 58 | `0065DEF0`, `0066EDDC` | exact-ported: 400-pixel line-add wrapping and unchanged text |
| Current-rank stats, scalar/vector formatting, explicit newlines | `0065D7F0`, shared line-add | exact-ported: line measurement and frame containment |
| Description preliminary wrapping | `0066BE48`, `0043D230`, 380 float | exact-ported: reuse native in-place wrapper for plain catalog descriptions |
| Title/category/boost/level/spacer lines and ExactText directives | `0043C870`, shared line-add | exact-ported: no width clamp independent of rendered strings |
| All ten exposed Welding detail identities | existing row52/1000–1009 projection | exact-ported: same width and extent owner |
| SkillScreen Hub/Boneyard and LevelupScreen desktop/touch details | two callers of `drawNativeSkillHoverBox` | exact-ported: built-client journeys, silent read-only details, dismissal |
| Empty details, left/right edges, above/below flip and viewport clamp | `005AB060`, existing fixed-stage projection | exact-ported: focused layout boundaries |
| Inventory/item/shop/MsgBox builders | other enumerated HoverBox/line-add callers | out-of-system: separate text producers/compositors; existing native MsgBox wrapper is reused without changing it |
| Progression, combat, network/save state, hotbar model | independent authoritative owners | out-of-system: no mutation needed for tooltip width |
| Root selectors 0–7 and internal Plane Orb/Reserved rows 80/81 | complete catalog boundary | out-of-system: roots are page headings; rows80/81 have no category or authored tooltip config |

No browser constraint requires a visible approximation. The per-member checks and built-client results below establish the implemented
width contract. The final integrated release remains gated on canonical Mac validation. Original report text, screenshot and source metadata remain
in the named archive; execution probes and captures are task scratch.

### Implemented width contract and per-member checks

Single-fix candidate `cd93627843d7f3442b8b6a5dd8fa6c595697c9c8` passed 31 focused
skill-book/typography contracts, strict test TypeScript checking, lint, and a
production build. The new red regression first demonstrated the 424-pixel
Meditation line against the old 380-pixel content cap. The corrected generic
line-add split is `   Concentrate: Can Meditate while walking (lesser` followed
by `effect)`. A separate 381-pixel row stays unwrapped and sizes its own frame;
the description-specific 380-pixel boundary is not applied to other kinds.

The actual native bitmap renderer exercised 422 cases and 59,116 glyphs with
no ink outside the painted frame. Coverage includes every public skill, native
maximum and boosted/granted titles, all ten exposed Welding identities,
left/right placement, above/below placement, empty details, and disposal.
Every public description was checked to contain no native inline directives;
reusing the existing plain native wrapper therefore loses no authored control.
Pure layout tests additionally enumerate every authored rank plus four bonus
ranks, permanent versus item-granted sources, all semantic line kinds,
explicit line breaks, inline rank commands, and empty content.

The untouched production client reproduced the reported right-border overrun.
The corrected built client completed eight real journeys: desktop 1600x900 and
Chrome touch-emulated 844x390, each with SkillPicker in College and Boneyard,
and learned SkillBook in both scenes. Meditation rank-one and rank-two previews,
mouse/keyboard focus/tap, sibling replacement, real selection, dismissal, and
reopening passed. Detail inspection did not grant a rank or play acquisition
audio; the real selection granted exactly once and played once. Browser,
HTTP, and wire error arrays were empty. Before/after desktop and compact-touch
frames were visually inspected. Physical-mobile and fresh clean-stock runtime
capture are not claimed.

The maintained smoke tools are `frontend/tools/smoke-skill-tooltip.mjs` and
`frontend/tools/smoke-skill-tooltip-render.mjs`. The first uses a private
standalone test host and deterministic native offers. Like the existing
SkillPicker smoke, it supplies a new input edge after preparing the barrier;
waiting for paused ticks cannot publish a manually prepared fixture. No
production timing workaround or host modification was added.

The final integrated candidate includes the separately owned report32 commit.
Its complete canonical gate, exact-source manifest, repeated post-build
browser/render checks, publication, and cleanup are recorded in the canonical
M2 archive receipt `_source/20260926-report33-9dfnkrb2-release.json` and STATUS.md.
That receipt starts explicitly pending and is completed only after those
steps succeed. Keeping release bookkeeping there leaves the fully qualified
Website source tree unchanged. All in-system membership above uses the same
measured/wrapped compositor; no extractable width fact or platform-blocked
member remains. Original source/media evidence is preserved separately from
disposable execution logs and captures.

## Reported smell and parity question

- Reported web behavior: the Skill Book “looks goofy.” The settled web frame
  shows full wizard statues inside the upper leather field, tiny bright title /
  help copy, hard rectangular per-skill cards, a fixed oversized tooltip over
  the instructions, and a bright numbered belt.
- Stock behavior to recover: the complete optional actor-owned `SkillScreen`
  renderer family—not only its page-region overlay—including root chrome,
  ambient seal motion, dependency-page panels, every row/frame/font variant,
  the shared `HoverBox`, live eight-slot HUD rendering, both gameplay scenes,
  and the 40-tick lifecycle.
- Reproduction inputs/scenes: fresh Ether/Arcane Hub SkillScreen, hover Call
  Leviathan, duplicate Call Leviathan into a second belt slot, mixed
  pure-primary/concentration/Weld pages, wrapped dependency pages, then repeat
  in Boneyard at `1600 x 900`.
- Falsifiers: a separate card background per dependency row, Skills record `5`
  stretched beyond `87 x 88`, whole top statues, body/medium fonts for the root
  instructions, a fixed six-property tooltip, missing CFG `mBonus` lines,
  static ambient arcs, scene-owned copies, or unique-only quickbar bindings.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Clean stock | unmodified retail Beta 0.72.5 `SolomonDark.exe`, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; `Mod Loader/tests/fixtures/webgame/menu-reference-captures/skill-screen.png` SHA-256 `5b2423d5daf56e6bb5d154dd2ce0abc80d947286f087c8f81134b01686bb1c87`; duplicate-belt capture SHA-256 `e934a18512ef5ed92753be150f5a37e5182751c8ed25644f5030a5d63b87f05d` | partial off-screen top ornaments, menu-sized gray copy, soft root-tinted page panels, muted live belt, and duplicate-slot result | high |
| Current Mac web | retained Chrome/WebGL2 receipts from Website `981fec5a6888af5b714456e9a5ce7762c6f2735c`: `/Users/jarrett/codex-acceptance/solomon-skill-book-mac-981fec5-tooltip.png` SHA-256 `4bec1635aaf9481e8913bcc53320130b6742b0f887d4218046bac4e0d5eafbd2` and mixed quickbar SHA-256 `af5ce43440854b694c65330882b8b5b04c177343dc0e95a79d31cd29332bade3` | reproduces the large top statues, small copy, hard stretched frames, fixed tooltip, and bright numbered belt | high-live |
| Root instructions | canonical read-only Ghidra replica, `SkillScreen` vtable `0x0079F72C`; root `+0x0C -> 0x0065B550`, overlay `+0x28 -> 0x0065BEF0`; preferred image base `0x00400000` | the earlier pass stopped at the overlay and omitted the true root; fixes all root records, transforms, fades, motion, field clipping, and live-HUD call | high |
| Page instructions | builder `0x0066B380`, page render `0x006720F0`, open/hits `0x00673EE0`, Welding helper `0x00671810` | one page-wide Skills `0` panel; exact selected/unselected alpha; records `13/164`, `5/14`, `6`, authored icons, +4/+4 shadow, and font ownership | high |
| Hover instructions/data | `HoverButton +0x98 -> 0x00656CE0`; `Skills_Wizard +0xA4 -> 0x0066B990`; formatter `0x0065D7F0`; bonus formatter `0x0065DEF0`; `HoverBox` `0x005C38F0/0x005C3A60/0x005AB060`; 72 public CFG rows in `native-skill-catalog.json` | shared vertically flipping box, 50 source gap, 25 margin, authored `mStats` and category-3 `mBonus` order, exact D/F/X/N formats and ExactText commands | high |
| Asset/font data | `native-ui-assets.json`, Skills/UI/Fonts atlases and `native-asset-object-map.json` | UI `3,4,10,30,31,32,33,49,71`; Skills `0,5,6,13,14,27..122,164..165`; Fonts groups `0,1,3,5` plus live-HUD group | high |

The static project/program is the canonical
`Decompiled Game/ghidra_project/SolomonDark.gpr` / `SolomonDark.exe` retail
image above. No injected runtime conclusion is promoted here. A loader sandbox
launch attempted during investigation did not advance past its initial dialog;
its pixels and empty semantic snapshot are explicitly excluded from evidence.

## System boundary and membership inventory

Native system: **optional actor-owned SkillScreen presentation**—the root and
overlay render passes, dependency pages, row variants, shared contextual
HoverBox, live belt/HUD composition, input/lifetime edges, and Hub/Boneyard
consumers. Progression offer mechanics and the compact selected-skill selector
remain sibling systems already closed separately.

| Member (class/variant/scene/branch) | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| opaque root curtain and opening/closing alpha | `0x0065B550`, `0x006567E0` | exact-ported | render-contract alpha assertions and 40-tick browser edges |
| eight UI.3 ambient seal members | `0x0065B550` loop | exact-ported | count, shared centre/scale, 45-degree spacing, jitter envelope, and live frame phase |
| left/right UI.33 top flourishes | `0x0065B830..0x0065B892` | exact-ported | exact two centres and +/-90-degree transforms |
| left/right UI.31 partial top wizards | `0x0065B89D..0x0065B8FB` | exact-ported | exact centres and left mirror; reviewed crop excludes whole in-field statues |
| left/right UI.30 bottom masonry | `0x0065B900..0x0065B958` | exact-ported | exact edge centres |
| left/right UI.32 bottom warriors and clip | `0x0065B9D5..0x0065BA8E` | exact-ported | exact `80`-pixel clip, centres, and right mirror |
| page-region leather and black top/bottom fades | UI.49 and `0x0065BAA4..0x0065BD6D` | exact-ported | fixed `(0,50,1600,760)` black-composited field prevents pre-field fixture bleed through semitransparent atlas texels |
| UI.10 chains, UI.71 endcaps, UI.4 title backing | `0x0065BEF0` | exact-ported | exact record/position inventory and stock-crop comparison |
| `SKILLS`, mouse help, touch help, belt help | `0x0065BEF0`, Fonts group 3 | exact-ported | copy, menu font, RGB `(0.5,0.5,0.5)`, settled help alpha `.75`, pointer-mode branch |
| page construction and wrap for every public row `8..79` | `0x0066B380`, `0x0065E670` | exact-ported | complete 72-row, shared-dependency, duplicate-membership and row-wrap matrix |
| unselected root-tinted page panel | `0x006720F0` | exact-ported | Skills.0, inset 12, alpha `.1`, one additive edge pass |
| selected primary/concentration page panel | `0x00672150..0x006723CE` | exact-ported | first selected row ownership, alpha `.5`, second additive pass |
| root row and every dependent row | `0x006720F0` | exact-ported | centres `100,280,+160`, Skills.13/164 scale `1.15`, record-6 connector |
| ordinary/passive frame | row action byte `+0x32 == 0` | exact-ported | Skills.5 natural `87 x 88` assertion |
| actionable primary/secondary/concentration frame | row action byte `+0x32 != 0` | exact-ported | Skills.14 natural-size assertion across all categories |
| first selected primary/concentration frame and label | `0x00672795..0x00672981` | exact-ported | Skills.5 tint `0x97c797`, recovered from source RGB `(.25,1,.25)` blended `.75` toward luminance, alpha `1`, plus group-0 source `casting` / `concentrate` small caps |
| ordinary icon rows `27..122` | row icon byte `+0x30` | exact-ported | full icon domain and opaque black `(+4,+4)` shadow |
| Spell Welding row 52 and builds `1000..1009` | `0x00671810` | exact-ported | all ten split-root glow/icon/name/description variants |
| name/family/quick-description/category footer | `0x006738C7`, `0x00673996`, `0x00673E06`, `0x00673A2D` | exact-ported | Fonts groups `1/5/1/0`, rank suffix, original-case `FUN_0043D030` wrap at `140`, native line restart/no-break `PLANEWALK-\nER`, shadowless quick description, and dynamic name/description heights |
| shared HoverBox construction/layout/render | `0x00656CE0`, `0x005C38F0`, `0x005C3A60`, `0x005AB060` | exact-ported | opaque black/native edge, 25 margin, 50 source gap, above/below flip and viewport clamp |
| tooltip ordinary rank/title/category/description | `0x0066B990` | exact-ported | case-preserving lines, native scaled rank suffix, every public row |
| tooltip boosted and item-granted effective-rank branches | `0x0066BB0D..0x0066BC33` | exact-ported | both `BOOSTED` / `GRANTED BY ITEM` branches |
| tooltip `mStats` rows and D/F/X/N formats | `0x0065D7F0`, all 72 CFG rows | exact-ported | authored order, literal percent, 0/1/2-decimal and conditional-N fixtures |
| tooltip concentration `mBonus` | category-3 predicate `0x0067BEE0`, `0x0065DEF0` | exact-ported | all fourteen category-3 bonus arrays and inline ExactText directives |
| eight live BeltButton slots, empty/occupied/duplicate/replacement | `0x005C8740`, `0x005D3E10` | exact-ported | muted native frame/key treatment, every slot, duplicate state and one-slot replacement |
| drag target and SkillDragger | `0x00656980`, `0x006564A0` | exact-ported | natural held icon, threshold, target highlight, accepted/rejected release |
| Hub consumer | gameplay `+0x1664`, opener `0x005CA640` | exact-ported | HUD/key open, hover, drag, close, input block browser journey |
| Boneyard consumer | same gameplay/actor screen owner | exact-ported | matching settled composition and state-survival journey |
| open, close, Inventory handoff, interruption and teardown | `0x0067CAC0`, `0x006568E0`, `0x0066B200` | exact-ported by the 2026-08-28 reopening in ledger 115 | 40-tick overlap, silent open, one `openpanel` close cue, reciprocal replacement, no input leak |
| runtime-only 80, reserved 81, allocated reserve 82 | public learned-vector/page admission | out-of-system (no public SkillPage producer) | existing complete row-domain test |
| mandatory SkillPicker and compact HUD selector | separate native modal owners | out-of-system (already closed sibling systems) | their render/authority suites remain unchanged |

No member is blocked by the browser platform.

## Native ownership thread

- Owner and construction path: gameplay owns one `SkillScreen*` at `+0x1664`.
  `0x005CA640 -> 0x006576C0` constructs the actor-addressed screen. Vtable
  `+0x0C` renders the true root; vtable `+0x28` renders the page-region overlay.
- Upstream state producers: actor learned-vector order; row dependencies,
  category/action/icon/root; permanent/effective ranks; selected primary and
  concentration A/B; active Weld build; eight BeltButton entries; render frame
  counter; pointer mode; screen open/close progress.
- State representation and transitions: `closed -> opening -> settled ->
  closing -> destroyed`, `+/-0.025` each 10-ms native tick. Page selection is
  the first row, in page order, matching primary first then A/B. Hover owns a
  transient `HoverBox*` at `HoverButton +0xB8`; leaving/replacing the target
  destroys it. Drag owns a transient `SkillDragger`.
- Downstream consumers: root/background painter, page painter, shared
  HoverBox, BeltButton painter, authoritative primary/concentration/belt
  mutation, save/checkpoint, and gameplay input suppression.
- Siblings: Inventory shares optional-book admission and the live HUD painter;
  LevelupScreen shares Skills.0/5/13/164 but is not a SkillPage; trader/item
  inspection shares HoverBox layout/render but has different line builders.
- Entry/reset/teardown: Hub and Boneyard address the same actor owner; `I`/`T`
  handoff is mutually exclusive; screen close is silent; teardown destroys all
  pages, buttons, hover/dragger state, and releases the local suspension depth.

## Recovered behavioral contract

- Timing: black root alpha follows open progress; page/overlay uses cubic and
  higher-order native fades. At settled state the eight seal members remain
  animated; they do not freeze when React state settles. Open/close remains 40
  fixed ticks with no audio.
- Geometry: full root is `1600 x 900`; page region `(0,50,1600,760)`; page
  `200 x 300`, +160 per dependent; wrap threshold `1590`; row centres
  `100,280,+160`; icon/hit frame `87 x 88` centred at local y 80.
- Render order: curtain -> seal ambient -> top/bottom authored fixtures and
  clipping -> field/fades -> chains/title/help -> root-tinted page panels ->
  row aura/glow/frame/icons/text -> live belt/HUD -> transient HoverBox /
  SkillDragger.
- Assets/fonts: exact membership is listed above. No per-row nine-slice made
  from Skills.5, rounded browser primitive, OS font, white universal help copy,
  or fabricated tooltip property order is permitted.
- Input/authority: transparent React hit targets may route pointer, keyboard,
  focus, drag and close semantics, but all loadout mutations remain
  authenticated host commands. Hover is presentation-local and immediate.
- Boundary behavior: shared dependencies may repeat on multiple pages; the
  first selected row determines page emphasis; duplicate quickbar IDs remain
  legal; touch replaces only the first help verb with `TOUCH AND HOLD`.

## Nearby-system findings

- The earlier report's direct-root membership was incomplete and partly
  misassigned. UI.33 owns the top flourish and UI.71 owns rail endcaps; UI.31
  and UI.32 are not interchangeable corner decorations.
- `HoverButton +0x98` proves SkillScreen uses the same concrete HoverBox class
  as shops/perks. The correct web seam is shared layout/render ownership with a
  Skill-specific line builder, not a second tooltip visual language.
- CFG `mStats` and `mBonus` are already present in the Website's immutable
  native skill catalog. The old tooltip ignored both authored arrays despite
  their being fully extractable.
- Durable native report updated:
  `Mod Loader/docs/reverse-engineering/native-skill-screen-and-quickbar.md`.

## Confidence and open questions

- Confirmed: class/vtable ownership, root/overlay split, all root/page/hover
  functions, complete asset/font membership, transforms, clips, settled
  alpha/tints, page selection, row geometry, icon shadow, all CFG tooltip
  lines/formats, quickbar cardinality, scene/lifecycle ownership, and stock /
  current-web visual discrepancy.
- Inferred: none material. Browser semantic focus is additive and invisible.
- Unknown: none. Presentation-local random seal jitter is reproduced inside
  the recovered 40-pixel native envelope; stock does not promise a cross-run
  RNG-identical frame.

## Web implementation consequence

- Add a pure SkillScreen render contract for root chrome, page panel/selection,
  row/frame/font variants, and the complete tooltip line formatter.
- Split the renderer into persistent root/ambient/chrome/content/HUD/hover
  layers. `render(nowMs)` updates the ambient members while
  `setPresentation(...)` rebuilds state-owned content.
- Replace the stretched per-row Skills.5 nine-slice and fixed purple/gray
  primitives with one Skills.0 page panel using the root tint and exact
  selected/unselected/additive passes.
- Add Skills.13, correct icon shadow/frame colors, and exact font groups.
- Replace the fixed six-stat tooltip with the shared HoverBox geometry and all
  catalog-authored `mStats` / `mBonus` lines. Remove the obsolete helper and
  its guessed label table.
- Replace the bright numbered belt treatment with the muted live-BeltButton
  composition while retaining the existing strict actor-authoritative command
  path and transparent hit targets.

## Validation contract

- Focused pure tests: exact root records/centres/angles/clips/fonts/tints;
  page-wide record-0 panel and selected/unselected passes; every row/action /
  selected/Weld variant; every icon and font group; all 72 `mStats` arrays;
  all fourteen category-3 `mBonus` arrays; D/F/X/N/percent/ExactText parsing;
  HoverBox flip/clamp; eight slot states and duplicate replacement.
- Focused render/integration coverage and browser pixels: no stretched Skills.5
  nine-slice, per-row rounded background, fixed top tooltip, or substitute stat
  line presentation remains.
- Mac full gate: `/opt/homebrew/bin/bash ./scripts/validate.sh` on the exact
  Website candidate tree.
- Mac Chrome/WebGL2: matching `1600 x 900` fresh Ether frame, hover primary and
  secondary, mixed primary/concentration/Weld pages, dependency chain/wrap,
  duplicate drop, Hub/Boneyard, open/close/handoff, touch-copy branch, and
  empty page/console/failed-response arrays.
- Stock comparison: reviewed crops must match partial top fixtures, menu-sized
  gray copy, page panel silhouette/tint, icon frame/shadow, HoverBox placement,
  and muted unnumbered belt. Structural pixel masks exclude only the stock
  presentation-local seal jitter phase.

## Implementation validation receipt

- The clean detached Mac candidate containing the complete source change passed
  `/opt/homebrew/bin/bash ./scripts/validate.sh` with the pinned Node
  `22.17.0` / npm `10.9.2` toolchain. The gate completed the backend build and
  22 integration contracts, backend formatting, frontend lint and generated
  contracts, every frontend suite including the 1,549-test Boneyard group and
  all eleven Skill Book checks, desktop tests, production build, media policy,
  and the game bundle budget (`471608` raw / `132295` gzip bytes).
- The historical 2026-08-25 receipt recorded a matching read-only external RE
  snapshot at `35d0941d6baad59dd7c46907a39d2ba6e6072c09`; that snapshot is provenance,
  not a maintained Website validation gate.
- Mac Chrome completed `npm run smoke:game:skill-book` at `1600 x 900` with
  WebGL2, duplicate Call Leviathan slots, mixed primary/concentration state,
  Hub and Boneyard selector paths, and empty console, page, and failed-response
  arrays. The final settled, tooltip, and mixed screenshots have SHA-256
  `c2dd81e0c025358fa97dc2e5bad5c535f921fcc64a0ef9c1ae465a39134241b9`,
  `1f29324446a2e4eae786c4e5ed41d55fd894bf573425d67aeebe007cd58d47ab`,
  and `de3c5daeeada89b39c2863c52011a62593527f96d3833968042ac7bc98f4d74a`.
- The settled frame was reviewed directly against stock
  `5b2423d5daf56e6bb5d154dd2ce0abc80d947286f087c8f81134b01686bb1c87`.
  Root fixture clipping, title/help baselines, page geometry and tint, icon
  frames/shadows, original-case wrapping, selected treatment, and the clipped
  live HUD align. The presentation-local seal phase is intentionally excluded
  from cross-run structural equality. No member is browser-blocked; deployment
  remains a separate operation outside this validation.
