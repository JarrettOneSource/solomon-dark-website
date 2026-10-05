# 2026-08-29 — Complete Region world-painter layering audit

## 2026-09-04 — retain the Hub Region planner

At Website `3c5e76d6`, the Courtyard and all private College rooms called
`buildNativeRegionPainterOrder` every display frame. That immutable convenience
entry constructed a planner, gathered arrays and maps, and froze every output
row. The Boneyard already owned a reusable `NativeRegionPainterPlanner` with
the same native queue contract. A Mac M2 Chrome profile at 1600x900, 128
Students, and fourfold CPU throttling attributed 436 ms of a ten-second sample
to the old planner and 410 ms to the Hub adapter. These are browser adapter
costs; the native queue evidence below remains authoritative.

The implementation boundary is Region queue planning and its Hub adapter.
`region-painter-order.ts` owns the single queue algorithm and the immutable
one-shot entry used by editor/contract consumers. `hub-painter-order.ts` owns
one reusable planner and target map per scene. The Courtyard and private-room
scene classes only create, call, and clear that owner. Their actor construction,
updates, painter membership, and rendering stay in the existing scene owners.

| Member | Disposition | Contract |
| --- | --- | --- |
| Courtyard fixed actors, Students, players, teacher releases | `exact-ported` | Same registrations, row rounding, visibility, and target depth assignment. |
| Every private College room and its dynamic actors | `exact-ported` | Independent scene planner; region changes replace its input population. |
| Primary/secondary spells, nested insertion roots, invisible emitters | `exact-ported` | Preserve actor/scenery/transient lane order, same-row FIFO, future-row insertions, and duplicate/missing-target errors. |
| Boneyard retained planning and static bands | `verified-already-at-parity` | Continue through the existing canonical retained queue. |
| Editor and immutable Region/Boneyard helper results | `exact-ported` | Freeze a one-shot canonical planner result; later builds cannot mutate it. |
| Scene clear, reuse, and destruction | `exact-ported` | Clear the planner and target map; no cross-scene state or growing cache. |
| Actor simulation, assets, sound, and native membership | `out-of-system` | No behavior or presentation-content change. |

Remove the superseded `NativeRegionPainterOrderPlanner` and update its tests
to the canonical planner. Gather initial row keys and sort once before flush;
insert future rows in order only when render-time insertions require it.
Validate each entry once when it enters the queue. Validation must cover
ordering, hidden/nested entries, invalid identities/coordinates, clear/reuse,
scene independence, and immutable results, followed by Mac full validation
and production-bundle Chrome before/after measurements.

Teardown drops the private slot pool after clearing the live arrays; resetting
fields on the discarded slots is redundant. A row is inserted into the sorted
pending list only after the row map establishes that it is new, so the binary
insertion needs no second duplicate check.

A tested removal of provisional actor-depth writes was rejected. Although
Pixi's `sortMixin.depthOfChildModified` invalidates the render group's
structure on those writes, dense moving-crowd Chrome measurements got slower
when they were removed (about 191–202 FPS versus a restored 226 FPS sample
under CPU throttling). That experiment does not justify changing Pixi's
invalidation behavior. The final candidate retains the writes and overlay
order. The redundant `HubPlayerView` alias is removed; its existing
`PlayerWorldView` name serves all three scene consumers.

### Validation receipt

The focused patch on `132774b6992fc766c255e319cdbbdcddeef8135b` passed the full
Mac `./scripts/validate.sh` gate. The final browser journey passed Storeroom,
Mortuary, Office, and Library entry/return, all eight Courtyard obstacle/Student
crossings, player sort biases, Useful Thyngs child layering, and Teacher
release ordering. Page/console errors, failed responses, and request failures
were empty. Screenshots of the Storeroom and Courtyard crossing were inspected.

The isolated Node benchmark used 60 moving-row inputs, 6,000 measured frames,
and before/candidate/restored calls to the actual implementations. Every
frame's placement result matched before timing. At 128 roots, the adapter
fell from `48.44/48.14 us` before/restored to `39.80 us` per frame (17.3% below
restored). At 512 roots it fell from `203.55/196.57 us` to `169.23 us` (13.9%).
This measures planner CPU cost, not whole-frame rendering throughput.

Final production-bundle Chrome on hardware Apple M2/Metal, 1600x900, 128
Students, no CPU throttling, and browser vsync disabled measured 386.74 FPS,
3.3 ms p99 frame intervals, and 20.00 Hz snapshots. All 128 Students remained
present; no page/console errors or failed responses occurred. Broader FPS
comparisons varied enough that a general client FPS gain is not established.

Desloppification removed the duplicate planner, its root-slot wrappers and
unused row bookkeeping, redundant validation/reset work, duplicate collision
selection type, and `HubPlayerView` alias. No dependency was added. The three
substantively changed production modules are 93, 262, and 350 lines; their
cyclomatic complexity passes an Oxlint maximum of 21. The existing Courtyard
scene remains 1,294 lines; this patch changes only planner ownership and the
player-view type references there, not its separate actor responsibilities.

Scoped Node coverage is 100% lines, branches, and functions for the Hub
adapter, Region planner, and collision adapter. Admission regressions cover
invalid coordinates/registrations, duplicate ids, fixed-actor reservation
order, failed-build recovery, and reads after clear. Statement coverage,
cognitive complexity,
Halstead difficulty, CRAP, mutation survival, and dedicated dead-code/duplicate
analysis have no configured analyzer here and remain unmeasured. Source and
consumer review found no obsolete production references or explicit
`any`/`unknown` types in the changed planner/collision scope.

> **2026-08-31 advanced-effect birth-edge reopening.** The actor-manager census
> below did not follow pure-primary Fire/Ether contacts that create their Burn
> modifier parent after the common secondary-step enrollment barrier. That
> omitted lifecycle edge produced same-frame empty painter membership in
> production protocol 113. Entry 210 now owns the complete causal trace,
> sibling inventory, correction, and validation contract for that branch.

> **2026-08-29 second reopening — prior closure refuted.** The user-visible
> Solomon Dig burial error and a Courtyard arch painting below Students prove
> that this entry's earlier “complete” census was not complete. It recovered
> the shared queue machinery but did not enumerate every concrete Region's
> actual actor-manager contents, class-local clip scopes, or collision/query
> classification. The final-closure and “no remaining discrepancy” statements later
> in this historical entry are superseded by the reopening below.

## Second reopening: concrete manager membership, clip, and collision

### Why the first audit missed both reported failures

The first pass started at `Region::Present`, counted the three manager lanes,
and followed proxy insertion. It did not walk backward through every Region
initializer and population callback to recover the objects stored in those
lanes. Consequently, it accepted Website labels such as `scenery` and
`depth-prop` as evidence of native ownership. It also treated a parent actor's
queue row as sufficient proof even though a class renderer can clip only some
children inside that root. Both assumptions are false:

- `CollegeObstacle` and `CollegeStatue` are ordinary actor-manager objects.
  Several of their visual records were flattened into the Courtyard base or
  omitted, making any later actor—including a Student—paint above that art
  regardless of world Y.
- Solomon's parent queue root was correct, but state 0 clips only the body to a
  `200 x 100` grave rectangle and then draws DeadHawg record 13 outside the
  clip. The Website drew the entire `200 x 200` body sheet.

This reopening therefore treats the concrete object list, actor fields,
class-local draw program, collision/query classification, and
construction/destruction path as one layering contract.

### Fresh evidence

| Evidence | Exact source | Result | Confidence |
| --- | --- | --- | --- |
| Canonical image | retail 0.72.5 `SolomonDark.exe`, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` | Same sealed executable as the first audit. | high |
| Courtyard population and player bias | `0x0050B720`, `Courtyard::Tick 0x0050C970`, writes `0x0050D2F8/0x0050D3CE` | Fomentius receives `sortBias=-5`. Each live player is reset to zero, then receives `+20/-20` only inside the strict north-arch rectangle. | high |
| Courtyard fixed objects | `Courtyard::Init 0x00514EE0`; `CollegeObstacle` ctor/render `0x005013F0/0x0051AB20`; `CollegeStatue` ctor `0x00501440` | Eight obstacle actors are constructed in selector order `0..7`, then the statue, before players and Students. | high |
| Private rooms | initializers `0x00515290`, `0x00517A30`, `0x00517F60`, `0x00517D50`; Painting/CustomObject renderers `0x00518280/0x00505E50` | Mortuary has ten Painting interaction actors followed by ten distinct CustomObject visual actors. StoreRoom, Library, and Office props are also CustomObject actor roots. | high |
| Ordinary region reattachment | `Gameplay_SwitchRegion 0x005CDDD0`; `Region +0xD0/+0xD4 -> 0x00641090/0x00641130`; `Region::ClearLive 0x0063E510`; `PuppetManager` add/remove `0x004013C0/0x00402450`; isolated live manager census | `+0xD4` removes a player from the outgoing `PuppetManager`; sleep then drains both live manager lists. Wake rebuilds the incoming fixed population and `+0xD0` adds target-region player slots in slot order. | high |
| Fomentius child painter stack | `PotionGuy::Present 0x0051C1A0`; shadow callback `0x00502420`; records `34`, `160..164`, `32`, `54..58`; Website residual scan | One Fomentius queue callback paints counter, body, front, and balloons contiguously. The shadow is the separate pre-queue callback. Row-derived global depths became invalid once actor roots moved to sequential queue depths. | high |
| Teacher dynamic roots | release `0x00505560`; two calls to transient registration helper `0x0063E5B0`; Region transient manager `+0x8B70`; Website residual scan | Column/ZAnimLit registers first, SpriteArray wrapper registers second, both at `teacher.y+15`. Flare/core remain direct pre/post-world roots. The browser's one raw-row container was outside the shared queue. | high |
| NPC marker tails | common marker renderer `0x00518280`; ten named marker actors from entry 201; Website residual scan | Each ordinary marker is painted at the tail of its NPC callback. Raw row-derived sibling depths separated markers from their resolved sequential actor roots. | high |
| Pristine walk-to-talk card | Courtyard render `0x0051EB60`, call block `0x00520012..0x0052032D`; Website residual scan | Direct Courtyard UI is submitted after queue/player/foreground records and before southern architecture, not at Provokatus's actor row. | high |
| Solomon state painters | `0x004902C0`, `0x00490420`, `0x00490640`, `0x00490790`; clip save/set/restore `0x00427300/0x00420EC0/0x00421380` | State-specific body clips, planted offset, grave-mark interval, and retreat-root ownership are exact. | high |
| Solomon state/lifecycle | ctor `0x00481C20`; state ticks `0x0047D0F0/0x0047D450/0x0047D570`; render dispatcher `0x004A2610` | `+0x21C` begins at `5`, becomes `15` for retreat hold, resets to zero for acceleration, and `+0x210/+0x214` retain the retreat clip root. | high |
| Isolated live checks | task-owned retail process; write watch on player `+0xA0`; Solomon field sample/contact | Heading `90` wrote `+20`, heading `359` wrote `-20`; state-0 Solomon sampled `+0x21C=5`, and contact copied the current actor position into `+0x210/+0x214`. | high-supporting |

### Exact Courtyard actor-manager chronology

The active survival branch constructs and registers:

1. Hagatha, type `5001`;
2. Fomentius/PotionGuy, type `5004`, with `Puppet+0xA0=-5`;
3. Annalist/Provokatus, type `5003`;
4. Luthacus/ItemsGuy, type `5005`;
5. optional Skorcha/Tyrannia, type `5007`, when the population draw succeeds;
6. Teacher/Machinimbus, type `5008`;
7. `CollegeObstacle` type `2007`, selectors `0..7` in ascending order;
8. `CollegeStatue` type `2008`;
9. current player slots in slot order; and
10. the live Student population in construction order.

The Website prefix previously used Hagatha, Annalist, Fomentius, Luthacus,
Skorcha, Teacher, then unrelated private-room NPCs. It also warmed and
registered Students before creating the initial player. Both stable-tie orders
are false. Skorcha's later 20–40 minute shared-Hub schedule remains the
explicit user-directed Website policy recorded in entry 194; when she is
visible, her painter occupies the recovered optional-population position.

The eight obstacles are:

| Selector | Root `(x,y)` | College record program | Radius | Bias |
| ---: | ---: | --- | ---: | ---: |
| `0` | `(1458.5,320.5)` | `148..159`, one twelve-piece composite | `40` | `0` |
| `1` | `(955.5,239.5)` | `25` | `40` | `0` |
| `2` | `(749.5,162.5)` | `23` | `40` | `0` |
| `3` | `(1893,490)` | `28` | `40` | `0` |
| `4` | `(1746,534)` | `29` | `40` | `0` |
| `5` | `(1840,715)` | `27` | `40` | `0` |
| `6` | `(628,215)` | `20` | `40` | `0` |
| `7` | `(956,169)` | `24` | `40` | `0` |

Selector 0 is the large east Courtyard tower/arch/banner composition implicated
by the report. Records `27..29` were irreversibly flattened into the Website
base, and records `148..159` had no actor root at all. The correct extraction
is eight registration-preserving `2000 x 1000` College logical frames, with records
`27..29` removed from the base. `CollegeStatue` follows at `(961,834)`, radius
`50`, bias `0`; its visual body and aura remain children of that one actor root.
The Courtyard's 129 static contour segments remain the movement collision bank.
Although the obstacle/statue constructors carry shared world-object radii and
category fields, the native Hub motion census includes only the five named
fixed Courtyard actors, optional Skorcha, and conditional Polisher. The eight
obstacles and statue do **not** enter the player/Student push solver. Adding
their radii as movement bodies overlaps the stock spawn, blocks the StoreRoom
portal, changes Student collision RNG, and deadlocks the College spline at the
selector-7 arch. Their radii remain class/query metadata; their required fix in
this system is actor-manager painter ownership, not phantom movement collision.

### Contextual Courtyard player bias

`Courtyard::Tick` first writes player `+0xA0=0`. It then uses the stock strict
rectangle predicate (`0x00403DA0`) for:

```text
x > 874 && x < 1031 && y > 34 && y < 181
```

Inside that rectangle, heading selects:

```text
-20  when heading <= 0, heading == 180, or heading >= 345
+20  when 0 < heading < 180 or 180 < heading < 345
```

The Website stores 24-way heading indices, so the exact representable mapping
is `-20` for indices `0`, `12`, and `23`, and `+20` for every other index.
Outside the rectangle the bias is zero. This is a Courtyard tick rule, not a
global PlayerWizard constructor value and not a fixed doorway overlay.

### Ordinary switch teardown, wake, and shared-Hub adaptation

The manager chronology above describes a newly active Courtyard. Ordinary
native switches additionally have a destructive live-registry lifecycle:

1. `Gameplay_SwitchRegion` calls outgoing slot `+0xD4` for the player. Common
   `0x00641130 -> 0x0063F600` removes it from the Region's `PuppetManager`.
2. `Region::GoToSleep 0x00649F90` serializes the cache and calls slot `+0xF0`.
   Common clear `0x0063E510` repeats detach for all four player slots, drains
   both live object managers through `0x00402220`, clears the spatial grid,
   and zeros the actor lookup bank.
3. Incoming wake/create rebuilds that Region's fixed population. After attach
   and UI binding, `0x005CBA00` calls slot `+0xD0` for target-region players in
   slot order. Common `0x00641090` appends each nonduplicate player to the
   `PuppetManager` and restores its Region/spatial bindings.
4. Courtyard Students subsequently join through their already recovered
   transient ticker lifecycle. The constructor's asserted first request and
   the covered transition mean a first visible sample can contain one or two
   Students on either side of the player; this is timing, not a fixed roster.

The isolated retail census made the list mutation concrete. A fresh settled
Courtyard contained `14` fixed actors, the player at index `14`, then `10`
Students. After switching to Mortuary, the Courtyard manager count was `0` and
Mortuary contained its `21` fixed actor roots followed by the player at index
`21`. On return, one early sample contained the `14` fixed roots, two live
Students, the player, then later Students; after those two route lifetimes
ended, list compaction placed the player immediately after the fixed roots and
new Students remained later. Absolute Student count/order is deliberately
transient, while add/remove ordering is deterministic.

The Website's multi-participant Hub has an explicit policy difference already
recorded in entries 024 and 180: the shared Courtyard keeps simulating while a
participant visits a private room, because another participant may remain
there. It therefore must not destructively clear the shared Student population
on one participant's switch. Instead, the moving player's actor registration
is replaced at the covered region edge; on return it appends after the still
live Courtyard Students. This is an explicit shared-Hub extension of the
native per-process sleep boundary, not an accidental stock-parity claim.
Whole-world return from a Boneyard still rebuilds fixed actors, players, then
the newly warmed Student lifecycle. Regression coverage pins both branches.

### Residual child-stack correction: Useful Thyngs

The recursive renderer scan found one additional actionable layering defect.
The first world-painter cutover correctly made Region queue Z values a compact
sequential order, but Useful Thyngs retained older row-derived global depths
`1331/1349.5/1350.5`. Fomentius itself now received a sequential depth near
`1000 + queue index`, so those values no longer bracketed his actor root.
They could force record 34, record 32, and balloons into unrelated global
intervals even though their native producer is one actor callback.

`PotionGuy::Present 0x0051C1A0` submits College record 34, the selected
`160..164` actor frame, College record 32, then the selected `54..58` balloon
frame without returning to the Region queue. They are one painter root with
internal child order `0/1/2/3`. The `0x00502420` record-33 shadow callback is
separate and remains in the pre-queue interval. The interaction marker remains
a sibling immediately after the completed Fomentius stack, not a child hidden
by record 32 and not a fixed global row. The Website must therefore target the
whole stack with Fomentius's actor registration and `-5` bias, then place the
marker at that resolved root depth plus a sub-root offset.

### Residual dynamic-root correction: Teacher release

The same root-level scan found that Teacher's `worldRelease` still assigned
`hubWorldDepthForActor(releaseY)` directly. That is another obsolete raw-row Z
value and, more importantly, collapses two native transient-manager objects
into one browser container. The complete `0x00505560` release sequence is:

1. core `Anim_Fade` enters direct post-world manager `Region+0x22C`;
2. flare `Anim_Fade` enters direct pre-world manager `Region+0x278`;
3. the column is wrapped by `ZAnimLit` and registered through `0x0063E5B0`;
4. the additive frame bank is wrapped separately and registered through a
   second `0x0063E5B0` call.

The two shared-world roots have the same point `teacher.y+15`, zero bias, and
stable transient order column then frames. Their registrations are born at the
release tick and never collapse into the Teacher actor registration. The
authoritative Hub ambient state must therefore own a Hub-local Teacher tick
plus two transient registrations for the live release. Protocol/interpolation
carry that discrete ownership; the renderer submits two queue targets. Hub
construction/load resets the clock, while the explicitly continuously live
shared Courtyard keeps advancing it during participant-local room visits.

### Residual child-tail correction: NPC markers

All ten ordinary NPC bubbles shared the same stale-depth problem. Native common
marker renderer `0x00518280` runs from the owning NPC presentation callback;
the body/prop stack and its bubble complete before the Region queue advances
to the next same-row actor. The Website instead kept marker sprites as root
siblings at `hubWorldDepthForActor(actorY)+0.1`, which no longer tracks compact
queue Z values.

Courtyard Hagatha, Annalist, Fomentius, Luthacus, Skorcha, and Teacher markers,
plus Mortuary Memorator, Library Librarian/Shlorio, and Office Archchancellor,
must resolve from their actual actor/stack target each frame and use the
immediate sub-root interval after that target. Story Polisher follows the same
rule only while materialized. Painting roots still have no ordinary marker.
The pristine walk-to-talk card and clamped directional arrows are separate
Courtyard/screen-space onboarding producers and do not inherit this actor-tail
change.

The pristine walk-to-talk card has its own direct ordering. Fresh Courtyard
render decompilation places the block after queue flush, player embedded
passes, and the five authored Courtyard foreground records, but before the
southern battlement/Astronomer bank. Its Website root therefore occupies the
bounded interval between Courtyard foreground and southern architecture. The
two follow-up arrows remain the already-dispositioned clamped screen-space UI
projection; they do not enter the Region world queue.

### Private-room actor lists and visual ownership

- Mortuary: Memorator; ten Painting type-`5018` actors at the authored talk
  roots with radius `15`; ten CustomObject type-`2041` selectors `0..9` at the
  same X and `y-2`, radius `40`; then players. `Painting::Present 0x00518280`
  normally draws no portrait—it owns the contextual interaction animation.
  The CustomObject Region callback `0x00518620` draws the easel, portrait,
  front, and marker. The Website portrait compositor therefore belongs to the
  CustomObject's `y-2` painter row, while the Painting remains a separate
  interaction root.
- StoreRoom: CustomObject selectors `0..2` at `(538,324)`, `(537.5,434)`, and
  `(536,542.5)`, then players.
- Library: CustomObject selectors `0..2` at `(239.5,788)`, `(258.5,678.5)`, and
  `(762,732.5)`; population selector `100` at `(831,620.5)`; Librarian at
  `(512,595)`; Shlorio at `(900,642.5)`; then players.
- Office: CustomObject selector `0` at `(517.5,681)`; Archchancellor at
  `(514,467)`; then players. The Website story Polisher remains a separately
  dispositioned story-policy actor.

Every listed CustomObject is actor-lane, bias zero, radius `40`. Treating room
props as scenery changed same-row precedence and hid the Painting/CustomObject
pairing. Room flames, Library black masks, and room foreground fragments retain
their recovered direct post-queue ownership; this reopening found no change in
their counts or lane.

### Exact Solomon child program

- State 0 saves the renderer clip, sets
  `(actor.x-100, actor.y-100, 200, 100)`, draws the dig body at
  `actor.y + bodyBob + actor+0x21C`, restores the clip, then draws DeadHawg
  record 13 at `actor+(-10,-113)` outside it.
- States 1/2 and the state-3 hold use
  `(actor.x-1000, actor.y-1000, 2000, 1000)` for body/mouth, restore, then draw
  record 13.
- State 3 acceleration retains the `2000 x 1000` clip only while acceleration
  is negative, using stored retreat root `+0x210/+0x214`; it omits record 13
  after the hold branch.
- State 4 has no clip and no record 13.
- Constructor field `+0x21C` is exactly `5`. It stays `5` while planted,
  becomes `15` during retreat hold after state 2 adds `10`, resets to `0` when
  acceleration begins, and stays movement-owned afterward.
- `Solomon_Dig::Render 0x004A2610` paints body/mouth/record 13 before installing
  the Region multiplier sampled at `(x-22,y-62)`. That multiplier owns only
  the embedded Flydirt manager; the Website's Solomon-local tint on body,
  mouth, and grave mark is false. Lantern lighting remains independently
  sampled by its own actor renderer.

### Required closure for this reopening

The authoritative docs, extraction, painter catalog, collision catalog
(including the obstacle/statue movement exclusion),
initial registration chronology, private-room actor ownership, Solomon clip
rectangles/offset/lighting, and browser diagnostics must all change together.
Acceptance must put players and Students on both sides of every obstacle row,
exercise both player-bias signs and the zero branch, traverse all private-room
CustomObjects, and capture Solomon in state 0 plus dialogue/retreat clipping.
Unit-only or a screenshot taken away from the reported crossings is not a
closure receipt.

### Second-reopening implementation disposition

- The Courtyard now owns all eight `CollegeObstacle` callbacks and the
  `CollegeStatue` as fixed actor-manager roots in their recovered constructor
  order. The new eight-frame `hub-courtyard-depth-props.png` removes records
  `27..29` from the flat base and restores selector 0's complete `148..159`
  tower/arch composition. The extraction and atlas packers reproduce the
  checked-in bytes deterministically; `pack-hub-visual-atlas.py --check`
  reports `582` frames, `87` sources, and `3` pages.
- Courtyard fixed registration is now Hagatha, Fomentius, Annalist, Luthacus,
  optional Skorcha, Teacher, obstacles `0..7`, statue, players, then Students.
  Every obstacle remains excluded from the movement-body census. Player rows
  apply the strict north-arch rectangle and the exact `-20/+20/0` heading
  branches instead of a global or visual-only doorway layer.
- Solomon's state-0 body uses only the recovered `200 x 100` grave clip;
  dialogue/retreat use the distinct `2000 x 1000` clip and retreat-root rules.
  The planted body offset is `+5`. Body, mouth, and grave mark remain white;
  only the Flydirt manager consumes Solomon's local multiplier, while the
  lantern remains an independently registered actor/light owner.
- All `48` fixed Hub roots now have explicit actor registrations, including
  Mortuary's separate Painting interaction and CustomObject visual roots and
  every StoreRoom, Library, and Office CustomObject. Region reattachment
  replaces the moving player registration. The shared-Hub extension preserves
  live Courtyard Students during participant-local room visits and appends the
  returning player after that live population; whole-world construction keeps
  fixed actors, players, then newly warmed Students.
- The recursive residual sweep also corrected four non-reported members that
  shared the same broken seam: Useful Thyngs is one Fomentius queue callback
  with local child order `0/1/2/3` and a separate pre-queue shadow; Teacher's
  release owns two same-row transient roots in column-then-frame registration
  order; all ten ordinary NPC markers follow the resolved actor/stack tail;
  and the pristine walk-to-talk card occupies its recovered direct interval
  between the Courtyard foreground and southern architecture.
- Combined protocol `108` carries both the Teacher release clock/two transient
  registrations and the concurrently landed protocol-107 enemy construction,
  scale, and death-owner fields. Save schema `22` persists the corrected
  registration ownership and migrates schema `21` without inferring painter
  authority from renderer cadence. Backend inspection, interpolation, reconnect, region-edge,
  and shared-Hub reattachment contracts were updated with the same cutover.

### Second-reopening acceptance and residual closure

- The first Mac runs (`job_20260829T234041Z_08e5a82a44`,
  `job_20260829T235452Z_1b3cac929f`,
  `job_20260829T234848Z_ee81b44e88`, and
  `job_20260829T235128Z_ccf6e3bde2`) remain useful implementation-stage
  evidence, but they are not the final exact-tree receipt. A whole-worktree
  manifest check discovered that candidate was detached at ancestor
  `ceaabf2863581e9c5e2659bc1afcbbd67e3fa4df` while the Linux worktree used
  `13d5987966a58a31f362ac047ef126e21912ae78`. Acceptance was reopened rather
  than treating a changed-file overlay as whole-tree equality.
- During that reopening, current `origin/main`
  `8044e97eca6baa6a867d33aa7cee9cdae1dbf398` landed the enemy construction and
  death-presentation closure. It adds world-sorted death registrations and had
  independently consumed protocol `107`; the Teacher branch had also consumed
  `107`. The one textual fixture conflict was resolved by preserving both
  field families and advancing the combined strict wire to protocol `108`.
  Enemy transient/death roots continue through the same shared manager order;
  no new direct or queue lane escaped the original census.
- The final current-main candidate proved exact Linux/Mac identity at HEAD
  `8044e97e`: its `43` non-documentation code/asset files have manifest
  SHA-256
  `a5d00b67fe037aabf37bcbacb4f8b640321afa6b0f95becaa073cf79e4874f91`
  (`job_20260830T002508Z_721b386fae`); the eight authoritative document edits
  were synchronized separately. TypeScript plus `344` focused protocol,
  save, enemy-owner, Solomon, Hub, Teacher, atlas, and simulation tests passed
  in `job_20260830T001020Z_3d5a354588`.
- The complete supported validation entrypoint passed the exact integrated
  source in `job_20260830T001050Z_4d49f6ab6e` (exit `0`): backend contracts,
  strict lint, both TypeScript builds, the complete frontend and desktop test
  corpus, production build, bundle budget, and media policy. Node test-file
  concurrency was serialized by a task-owned wrapper because unrelated Mac
  evaluation jobs were consuming the machine and caused unchanged ten-second
  WebSocket fixtures to miss readiness deadlines when run in parallel.
- The authoritative current-main Hub Chrome journey passed in
  `job_20260830T001844Z_b6fb036dc4` (exit `0`). It sampled a Student above and
  below every one of the eight obstacle rows, including selector 0's reported
  east arch; exercised player biases `-20`, `+20`, and `0`; asserted the
  Useful Thyngs root and all child/tail depths; captured Teacher's two
  consecutive same-row roots; entered and returned from all four private
  rooms; and found empty console, page, response, and request-error sets. The
  selector-0 screenshots are SHA-256
  `2aead11b7e8a5179bae557d14b022ef23f16c98deb446eec142184fe22cdb438`
  above and
  `d58a1c29d8d34f2adbfa912440d3c17575c02509a462c31027946ea1fed2240f`
  below. The Teacher receipt is
  `80e4c3308c5b6ec54d36fdf8d109e49b0b92edf6d401b179ccfd161a0b016072`.
- The authoritative current-main Solomon Chrome journey passed in
  `job_20260830T002110Z_f8e0c597da` (exit `0`). The lantern occupied queue
  slot `41` and Solomon slot `42`; digging and speaking each retained exactly
  one grave-mark pass, while retirement retained none. State-specific clips,
  planted offset, dirt retirement, lighting ownership, and combat suppression
  all passed with empty browser, response, and wire errors. The state-0 dirt
  and speaking screenshots are SHA-256
  `b944f5f87b90856d34995df4ccbb5e7509856e8c651d09f731f4dc970b9e1bbc`
  and
  `c136bab68974c58e8a633a76a74c1fb44ce6f3e47320bd9c3d33e25189ac3e85`.
- The first final Hub attempt correctly stopped on an acceptance-tool error:
  a new assertion compared absolute Pixi depth to the queue's intentionally
  relative diagnostic `zIndex`. Inspection proved a constant `1000` domain
  difference rather than a renderer defect. Every stack and marker assertion
  now converts through the shared painter base, and the complete journey above
  passed afterward.
- The first current-main Hub rerun stopped after the arch assertions because
  its fixed 15-unit A* began `0.2` units inside a collision-expanded grid edge
  left by the preceding bias probe. The target itself was traversable and no
  Hub collision source changed. The independent Teacher proof now stages its
  verified traversable point authoritatively, as the same tool already does
  for bias and Student samples; all four room seams still use real movement.
- A post-implementation search walked every recovered Region builder,
  registration lane, class-local callback, direct pre/post owner, proxy/split
  insertion, marker tail, transition edge, protocol/save carrier, renderer
  target, diagnostic, extraction source, and acceptance tool. No additional
  actionable discrepancy remains inside the concrete Website world-painter
  boundary. RainOfBones and Faculty lightning remain the same explicitly
  absent gameplay owners recorded by the first audit, not hidden layers of a
  currently implemented actor. This disposition does not claim publication,
  deployment, or live-production acceptance.

## Reported smell and parity question

- Reported request: audit the stock game's complete layering system and identify
  every remaining Website discrepancy.
- Triggering evidence: the 2026-08-28 Solomon Dig correction proved that the
  earlier Boneyard closure had recovered the shared row formula without
  recording the native list order between two ordinary actors. That is a
  system-level falsifier: a queue can have correct depths and still paint the
  wrong object on every stable tie.
- Stock behavior to recover: every world-painter producer from the concrete
  `Region` presentation roots through direct managers, the shared row queue,
  dynamically inserted proxy/split painters, post-world lanes, screen-space
  player indicators, and the HUD boundary.
- Reproduction scenes: Courtyard, Mortuary, StoreRoom, Library, Office, Arena,
  Tutorial, and Bonedit; ordinary actors, scenery, transient `ZAnim` objects,
  Tree/Building upper art, Acid/Storm clouds, Goodies, player Air, Flame Lash,
  Blizzard Beam, direct pre/post-world effects, multiplayer joins, wave births,
  and same-row ties.
- Falsifiers: another caller of the queue insertion/flush helpers; another
  `PuppetPointer`, `AnimPointer`, or `ZAnimSplit` installer; a concrete Region
  that bypasses the shared queue; a Website world renderer that already uses
  the native two-unit/reference-relative row and cross-family registration
  order; or a browser constraint that prevents clipped or dynamically inserted
  WebGL painter roots.

This entry records both the native audit and its completed Website cutover.
The inventory's audit-result column is the pre-implementation falsifier
snapshot; the final dispositions and receipts below supersede it.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | `SolomonDarkAbandonware/SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; preferred image base `0x00400000` | Matches the canonical analyzed 0.72.5 image. | high |
| Canonical static analysis | Ghidra 12.0.3 read-only replica pool through `Invoke-GhidraHeadless.ps1` SHA-256 `b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`; Mod Loader tool revision `08bfba9ef367f7b863848030d0a289dc31e33192` | Fresh caller, instruction, vtable, constant, and field sweeps below. Mod Loader remained read-only. | high |
| Queue xref closure | insertion `0x0068C3B0`, flush `0x0068C480`, visible append `0x0068C090`, overflow insert `0x0068C0F0`, draw/retention walk `0x0068C1C0` | Exactly 23 insertion references and seven flush references. All concrete gameplay Regions and Bonedit use queue lane zero; the only non-Region insertion callers are the two proxy helpers. | high |
| Concrete Region roots | Arena `0x0046EC80`; Courtyard `0x0051EB60`; Mortuary `0x0050EAC0`; StoreRoom `0x00519070`; Library `0x00511320`; Office `0x00519E40`; Bonedit `0x004D5F40` | Arena and four fixed rooms gather actor `+0x318/+0x324`, scenery `+0x87CC/+0x87D8`, then transient `+0x8B78/+0x8B84`. Mortuary has the same order with one reachable actor-filter branch. Bonedit uses its two editor-owned lists. | high |
| Shared direct lanes | all six Region roots; `ObjectManager::Render 0x004023F0`; common offsets `+0x2C4`, `+0x278`, queue `+0x17C`, `+0x22C`, player embedded managers, and `+0x1E0`; Arena adds `+0x8DA4`, optional `+0x4B4`, and other named late owners | Direct managers bracket the queue; they are not extreme-Y members of it. Arena's queue, player-attached, and later manager intervals are distinct. | high |
| Puppet proxy closure | helper `0x0064E910`, render delegate `0x0063ED70`; exactly five callers: Acid `0x005E3600`, RainOfBones `0x005E37F0`, Storm `0x005E8970`, Tree `0x00608480`, Building `0x0060E940` | The proxy copies the owner root, adds Y `350/350/350/100/200`, enters the live shared queue, then delegates only owner slot `+0x24`. Tree is gated to selectors `0..5`; Building uses all four variants. | high |
| Split proxy closure | `ZAnimSplit::vftable 0x00784664`; draw `0x005E0230`; `AnimPointer` helper `0x0064EB30`; clipped delegate `0x006298A0`; constants `0x007DE968=25`, `0x00784CF8=50`, `0x00786C08=10000` | `ZAnimSplit` emits multiple clipped queue roots across its vertical extent: 25-unit bands with Enhanced Effects, 50 otherwise, each using a 10,000-unit-wide clip. It does not paint one unsplit midpoint/origin root. | high |
| Complete split installers | Faculty cast-lightning action `0x00451DC0`; player Air factory `0x00531640`; Flame Lash factory `0x00531F00`; Blizzard factory `0x005328D0` | Four and only four vtable installers consume the split mechanism. Air, Flame Lash, and Blizzard are active Website members; Faculty lightning is not materialized by the current web game. | high |
| Existing authoritative chronology | `Region::Tick 0x0063EFC0`; `ObjectManager::Tick/Add/Remove 0x004022A0/0x00402720/0x00402450`; prior lighting closure | Manager arrays are stable insertion-ordered lists. Wave enemies can register before same-tick player spell children; reconnects append. Existing `{managerLane,registrationOrdinal}` data already proves category buckets are not equivalent. | high |
| Current Website source | audited world-painter base `acad2d24cd7d82550cb6ad3b6e54e62ab0026f76`; implementation was re-integrated without conflict through bases `41ec3c8f38899b8da88fd11d66bbbb03858ce20d`, `e7addc2b9ec7dfeed88d2208853150e976ab7979`, `8702fb2908fc9ea8746ff09a7a03c5d9f2484a78`, `b4239a26c9f7887ac44bf76eb20d63ea2e5f5897`, `cc8ce79698f0888c9dba393b91f340fbcce26004`, and final current `origin/main` `d43def16dd0df9558bb295ebf3359985bc1a40d8`; `hub-depth.ts`, `hub-world-scene.ts`, `hub-private-room-scene.ts`, `boneyard-painter-order.ts`, `boneyard-world-renderer.ts`, `native-render-plan.ts`, primary/secondary/loot painter adapters and tests | The audit base used `Math.round(y)` in Hub, rebuilt Boneyard source order by category, treated visible Goodies as ordinary actors, flattened Tree/Building proxies into one global foreground, mislabeled Acid/Storm proxies as `zanim`, collapsed split beams, and allowed dynamic pre-world containers to share the Region-composite depth. The final implementation sections below supersede that snapshot. | high |

No injected runtime address or stale PID is used for a new native claim. The
earlier isolated Solomon list observation remains corroborating evidence for
stable actor membership, but the findings above are instruction/xref-derived.

## System boundary and complete membership inventory

Native system: **Region world-painter topology**, from a concrete Region's
frame entry through authored direct lanes, one shared two-unit world queue,
per-frame proxy insertion, late player/manager passes, post-scene indicators,
and the HUD boundary. Low-level texture/blend/shader behavior and child-local
sprite composition remain owned by entry 287 and the individual class entries;
this audit checks their parent roots and relative submission intervals.

`Required final disposition` states the only valid parity end state.
`Pre-implementation audit result` records what the audited base did before this
entry's implementation.

| Member / branch | Native source | Required final disposition | Pre-implementation audit result |
| --- | --- | --- | --- |
| Queue storage, visible rows, negative/positive overflow, reset, flush, teardown | `0x0068C090/0F0/1C0/3B0/480` | `verified-already-at-parity` in a shared Region queue module | Boneyard visible-row math is exact; Hub/editor and proxy insertion keep this row open |
| Arena gameplay Region | `0x0046EC80` | `exact-ported` through every lane | open through D2..D7 below |
| Courtyard | `0x0051EB60` | `exact-ported` through every lane | open through D1, D2, and D5 |
| Mortuary, including `+0x8F10` actor-filter branch | `0x0050EAC0` | `exact-ported` or branch dispositioned with its owner | row algorithm is open; the native-only portrait/GameOver filter remains outside ordinary shared-Hub presentation |
| StoreRoom | `0x00519070` | `exact-ported` through every lane | open through D1, D2, and D5 |
| Library | `0x00511320` | `exact-ported` through every lane | open through D1, D2, and D5 |
| Office | `0x00519E40` | `exact-ported` through every lane | open through D1, D2, and D5 |
| Bonedit | `0x004D5F40` | `exact-ported` for the maintained Website editor | open through D8 |
| Actor manager main entries | Region `+0x318/+0x324` | `exact-ported` in stable manager registration order | correct family assignment for most actors; cross-family order is open D2 |
| Scenery manager main entries | Region `+0x87CC/+0x87D8`; RegionLayout scenery row | `exact-ported` in materialization order | static rows are mostly exact; visible Goodie is open D3 |
| Transient/ZAnim manager main entries | Region `+0x8B78/+0x8B84` | `exact-ported` in stable transient registration order | individual family labels exist; cross-family order is open D2 |
| Direct manager `+0x2C4` | all six Region render roots | `verified-already-at-parity` for mapped ambient/background members | no new member discrepancy found |
| Direct pre-world manager `+0x278` | all six Region render roots | `exact-ported` before Region multiply and queue | member programs exist; physical composition order is open D6 |
| Direct post-world manager `+0x22C` | all six Region render roots | `exact-ported` after the complete queue | member programs exist; proxy-relative interval is open D7 |
| Per-player embedded manager | Arena player vslot `+0x24`; player `+0x16C` | `verified-already-at-parity` | Mage target-contact lane remains after queue/proxies and before later managers |
| Arena late managers and Water Over | Arena `+0x8D90/+0x8DA4`, optional `+0x4B4`, `+0x1E0` | `verified-already-at-parity` per existing member entries | no new member discrepancy found; their anchor depends on correcting D4/D7 |
| Screen-space remote name/health indicators | post-scene PlayerWizard/Arena lane | `verified-already-at-parity` | shared nameplate layer remains after world and before fixed HUD |
| Native HUD and modal surfaces | `0x005D2520` and owning screen renderers | `verified-already-at-parity` | no new parent-layer discrepancy found |
| Tree selectors `0..5` upper proxy | `0x00608480 -> 0x0064E910`, `Y+100` | `exact-ported` as a dynamically inserted queue proxy | open D4; currently global foreground |
| Tree selectors `6..18` | no `PuppetPointer` call | `verified-already-at-parity` with no upper proxy | current foreground gate correctly omits them |
| Building variants `0..3` roof proxy | `0x0060E940 -> 0x0064E910`, `Y+200` | `exact-ported` as dynamically inserted queue proxies | open D4; currently global foreground |
| Acid Rain cloud proxy | `0x005E3600 -> 0x0064E910`, `Y+350` | `exact-ported` as actor-owned Puppet proxy | open D4; currently mislabeled `zanim` |
| StormCloud proxy | `0x005E8970 -> 0x0064E910`, `Y+350` | `exact-ported` as actor-owned Puppet proxy | open D4; currently mislabeled `zanim` |
| RainOfBones proxy | `0x005E37F0 -> 0x0064E910`, `Y+350` | `out-of-system` until its gameplay owner is materialized; no inferred layer | absent from current Website actor union; native membership is fully recorded |
| Air `ZAnimSplit` body | `0x00531640 -> 0x005E0230/0x0064EB30` | `exact-ported` as clipped 25/50-unit queue slices | open D5; currently one midpoint container |
| Flame Lash `ZAnimSplit` body | `0x00531F00 -> 0x005E0230/0x0064EB30` | `exact-ported` as clipped 25/50-unit queue slices | open D5; currently one origin-root mesh container |
| Blizzard Beam `ZAnimSplit` body | `0x005328D0 -> 0x005E0230/0x0064EB30` | `exact-ported` as clipped 25/50-unit queue slices | open D5; currently one origin-root mesh container |
| Faculty cast-lightning `ZAnimSplit` | action tick `0x00451DC0` | `out-of-system` until Faculty gameplay is materialized; no inferred layer | native installer and split behavior are recorded |
| Goodie base/active indicator | RegionLayout scenery index zero; type 2061 | `exact-ported` at its original scenery-list position | open D3; invisible static placeholder plus visible ordinary actor |
| Ordinary actor families: players, enemies, Lantern/Solomon, loot, Maggots, actor-owned projectiles/spells/effects, death weapon | actor manager and class entries | `exact-ported` with shared registration ordinal | individual geometry/biases are retained; combined order is open D2 |
| Transient families: ZAnim spell/effect/projectile children | transient manager and class entries | `exact-ported` with shared registration ordinal | individual lanes/biases are retained; combined order is open D2 |
| Direct pre-world members: Acid residue, Imp landing flare, Teacher flare, mapped siblings | class slot/direct-manager evidence | `exact-ported` in their distinct pre-queue interval | open D6 where dynamic insertion follows the Region composite |
| Direct post-world members: Demon raw burst/death siblings and mapped effects | class slot/direct-manager evidence | `exact-ported` after queue-inserted proxies | open D7 where they currently precede global Tree/Building foreground |
| Website chat, party/activity, diagnostics, mod effects, accessibility overlays | no retail world-painter member | `out-of-system` with explicit browser/mod ownership | retained only when their feature is active |

There is no `blocked-by-platform` member. WebGL2/Pixi can express stable rows,
clipped bands, masks/scissors, dynamic containers, and every required ordering
interval.

## Native ownership thread and recovered behavioral contract

- Every gameplay Region uses the same queue object at `Region+0x17C` and lane
  zero. The concrete renderer gathers current actor, scenery, and transient
  lists in that order before flushing it.
- For a visible entry, native computes:

  ```text
  relative = trunc(worldY) + trunc(sortBias) - trunc(referenceY)
  row      = queueOrigin + trunc(relative / 2)
  ```

  Visible rows paint low to high. `0x0068C090` appends; it does not sort a row.
  Same-row order is therefore the causal insertion order. Offscreen overflow
  lists use stable raw-world-Y insertion through `0x0068C0F0`.
- `ObjectManager` preserves stored order: add appends, remove shifts survivors,
  reconnect/recreation appends, and movement/cell rebinding does not reorder the
  owner manager. A snapshot object's type or array is not a native order key.
- Queue flush invokes member vslot `+0x0C`. A draw may insert a later root into
  the same not-yet-finished queue. `PuppetPointer` does this for exactly five
  owners. `ZAnimSplit` does it through one `AnimPointer` helper for exactly four
  installers.
- `PuppetPointer` copies owner position, adds its authored Y extent, and later
  calls only owner vslot `+0x24`. Tree/Building upper art and Acid/Storm clouds
  are therefore world-sorted future roots, not one unconditional foreground
  canvas and not ordinary `ZAnim` children.
- `ZAnimSplit` asks the child for its transformed bounds, partitions the
  vertical interval into 25-unit bands when Enhanced Effects is on or 50-unit
  bands when off, creates one queue entry per band, clips it to a 10,000-unit
  horizontal rectangle in `0x006298A0`, draws the shared child, and restores
  clipping. Intervening actors/scenery can therefore occlude different parts of
  one beam.
- Direct managers are physical intervals, not numeric sort biases. `+0x278`
  paints before the shared queue; `+0x22C` paints after it. Arena then owns
  player-attached and later manager intervals before environment feedback and
  the HUD.
- Queue reset is presentation-frame local. Persistent object registration is
  region lifetime state; `PuppetPointer`/`AnimPointer` pools and queue contents
  are per-frame scratch. Teardown destroys managers and proxy pools with the
  Region.

## Baseline discrepancies closed by this entry

### D1 — Hub and private rooms do not use the native Region row algorithm

`hubActorDepth(y)` returns `1000 + Math.round(y)`. Native truncates object Y and
bias, subtracts the truncated reference player Y, and quantizes to two-unit
rows. The Website therefore orders fractional positions that stock treats as a
stable tie, and its tie boundaries do not shift with the reference player.
Every Courtyard/private-room player, Student, NPC, depth prop, and world-sorted
spell consumes this mismatch.

Predicted visible difference: close overlaps can flip which robe, prop, NPC, or
spell pixels are on top, especially at `.5` authored coordinates or while the
reference player crosses an integer boundary.

### D2 — Boneyard and Hub rebuild manager order from presentation categories

`boneyard-world-renderer.ts` concatenates players, death weapons, primaries,
Mage pulses, secondaries, enemies, loot, Goodies, mod effects, death effects,
projectiles, auxiliary effects, Maggots, and the Solomon set piece. Native has
one actor list and one transient list, each ordered by registration chronology.
The existing lighting model already carries registrations for many of these
objects and explicitly proves that players-then-enemies-then-spells is not
equivalent, but painter construction ignores those registrations. Several
non-light owners expose no general painter registration at all.

Predicted visible difference: equal-row simultaneous births, wave enemies,
player spells, enemy projectiles, reconnects, death fragments, and loot can
paint in a class-bucket order that stock never uses.

### D3 — visible Goodie art is assigned to the actor family

Goodie is serialized in RegionLayout scenery list index zero and is gathered
with `+0x87CC/+0x87D8`. The Website retains an alpha-zero static Goodie at that
scenery position, then paints the live Goodie through
`nativeGoodiePainterLayer(... queueFamily: 'ordinary-dynamic')`.

Predicted visible difference: on a two-unit tie, the visible crypt can paint
before scenery because actor-family precedence wins, while stock preserves its
original scenery-list position. Activation does not move the native owner to a
different manager.

### D4 — the complete `PuppetPointer` family is not represented

Tree and Building upper art is placed in one `foreground` container after the
entire main population. Acid and Storm proxies are labeled `zanim`. Native
inserts all four active families into the shared queue at owner-relative
`Y+100`, `Y+200`, or `Y+350`, preserving causal insertion order; RainOfBones is
the fifth native owner.

Predicted visible difference: a sufficiently lower actor can paint over a
Tree canopy or Building roof in stock but can never do so on the Website;
Acid/Storm clouds can resolve same-row ties against transient effects in the
wrong family/order.

### D5 — `ZAnimSplit` beams are collapsed to one unsliced root

Air exposes one body container at midpoint Y. Flame Lash and Blizzard expose
one weld container at origin Y. Native creates clipped `AnimPointer` bands
across each beam's transformed vertical extent at 25/50-unit intervals.

Predicted visible difference: an Air, Flame Lash, or Blizzard beam that crosses
multiple actor/scenery rows is wholly behind or wholly in front on the Website;
stock can weave its lower and upper bands around different intervening roots.
The current three-root Air test proves source/body/contact separation, but it
incorrectly treats the body itself as one root.

### D6 — dynamically created pre-world art can paint after Region multiply

The Region-light composite is added to the Boneyard root after
`BoneyardDynamicScene` construction. Later Acid underlay and enemy auxiliary
containers are appended dynamically and receive the same `zIndex = 0.5` as the
composite. Pixi stable ordering therefore places those later children after the
multiply, even though native direct/pre-world painters complete before the
Complex-Lighting composite and queue.

Predicted visible difference: Acid residue, Imp landing flare, and any sibling
using that dynamic pre-world path can remain too bright/unmultiplied and can
reverse order against other pre-main effects.

### D7 — direct post-world effects precede the Website's false global foreground

Enemy auxiliary/death direct-post roots use `foregroundZIndex - 0.5`, while
Tree/Building upper art uses `foregroundZIndex`. Native Tree/Building
`PuppetPointer` roots are part of the completed shared queue; direct `+0x22C`
and later post-world managers follow them.

Predicted visible difference: Demon raw burst/death effects and mapped
post-world siblings can paint below a Tree canopy or Building roof on the
Website where stock paints the direct post-world effect afterward.

### D8 — Bonedit/editor preview uses raw Y sorting and a global foreground

`buildNativeRenderPlan` sorts `sortKey = worldY + sortBias` directly and emits
Tree/Building upper art into an unconditional foreground array. Native Bonedit
uses the shared two-unit queue and its own two source lists; the same
`PuppetPointer` class contract applies to eligible object renderers.

Predicted visible difference: editor previews can disagree with gameplay on
two-unit ties and upper-art occlusion, so an authored scene may look correct in
the Website editor but layer differently in stock.

## Confirmed non-discrepancies in this audit

- The fixed-function/WebGL pixel pipeline, texture representation, sampler
  policy, blend selectors, and Arena saturation owner remain closed by entry
  287 and its later edge/alpha reopenings.
- Boneyard's base visible-row formula, integer truncation, actor/scenery/
  transient family precedence, static source order, Gate `-15` bias/root,
  Solomon/Lantern roots, and the corrected Lantern-before-Solomon actor order
  are instruction-equivalent when no open proxy/registration issue participates.
- Child-local player, enemy, equipment, Staff/orb, loot, weather, UI, and VFX
  draw stacks remain as dispositioned in their owning entries. This audit found
  no additional child-local blend or sprite-order member outside D5's split
  parent mechanism.
- Remote world nameplates/health bars remain post-scene and the semantic HUD
  remains after the world/environment passes.
- No platform approximation was required for any audited discrepancy.

## Nearby-system findings

- Entry 090 already proved and serialized cross-family registration order for
  Region lighting. The missing painter contract is broader: every visible
  actor/transient/scenery root needs a painter registration even when it emits
  no light. Reusing nullable light-provider metadata would leave Goodie, normal
  Arrow, loot, and several animation families unordered.
- The queue's per-frame dynamic insertion is the reason a static `sort()` over
  predeclared roots is insufficient. Proxy order depends on the owner root's
  actual draw position, not merely its class or birth ID.
- The pre-implementation tests encoded several incomplete assumptions: Hub tests check broad
  inequalities rather than native row equivalence; Goodie tests never assert
  scenery ownership; Air tests require one body root; Acid tests assert depth
  `0.5` but not child order relative to the Region composite; no test replays
  all manager/proxy families together.

## Final implementation disposition

- D1 and D2 are `exact-ported`. `region-painter-order.ts` is the shared
  reference-relative two-unit queue, and `native-world-manager-order.ts`
  supplies stable actor/transient registration chronology. Courtyard, every
  private room, Arena, Tutorial, and Bonedit now consume that shared contract.
  The fixed Courtyard actor prefix follows the native builder chronology:
  Hagatha, Provokatus, Fomentius, Luthacus, optional Skorcha, then
  Machinimbus. The Astronomer helper remains correctly in its authored late
  southern direct block rather than receiving a phantom actor registration.
- D3 is `exact-ported`. A live Goodie carries its original RegionLayout scenery
  ordinal through simulation, protocol, interpolation, and schema-21 save
  migration; its alpha-zero base placeholder no longer competes in the queue.
- D4 is `exact-ported`. Tree `0..5`, every Building, Acid Rain, and Storm use
  causal queue insertions at `+100/+200/+350`; Tree `6..18` remain without a
  proxy. RainOfBones stays explicitly `out-of-system` until its gameplay owner
  exists.
- D5 is `exact-ported`. Air, Flame Lash, and Blizzard bodies render through
  clipped `AnimPointer` roots using the recovered 25/50-unit bands, 10,000-unit
  clip width, bottom-Y painter point, and clip restoration. Faculty lightning
  remains explicitly `out-of-system`.
- D6 and D7 are `exact-ported`. Boneyard direct pre-world children have a
  parent below the Region multiply composite; direct post-world children are
  placed after the completed shared queue and its inserted proxies. Browser
  mod effects remain a named out-of-system later interval.
- D8 is `exact-ported`. The Website editor uses the same rows and causal proxy
  insertion trace while retaining a separate runtime proxy-asset inventory;
  proxy sprites are never flattened back into the runtime base bands.
- Protocol `106` and save schema `21` carry every new registration owner.
  Schema `20` and earlier migrate the former `lightProviderOrder`, fixed-Hub
  prefix, visible-root registrations, Goodie scenery identity, and Solomon
  set-piece owner without rebuilding authority from presentation cadence.

## Regression and acceptance coverage

- Pure contracts cover manager gather order, stable same-row ties, negative and
  positive rows, duplicate registration rejection, backwards insertion
  rejection, multiple causal proxies, exact ZAnimSplit bands, Goodie scenery
  ownership, every actor/transient family, protocol failure boundaries,
  entity codecs, interpolation, reconnect/world transitions, and schema-20
  Hub/Boneyard migration. A combat-boundary invariant additionally rejects any
  newly born primary-spell root that leaves its native manager membership until
  a later tick.
- The deterministic Bonedit Chrome fixture paints the exact trace
  `main:0, main:1, main:2, proxy:1, main:3, main:4, proxy:4`, including the
  same-row Monument-before-Tree-proxy tie, with empty page and console errors
  (`job_20260829T185839Z_7de25fe49c`; screenshot SHA-256
  `613647d26f07a0fdc7cdc201b70645dfbf6267d28bfee82e6e24a7e94b3d3bb2`).
- The Mac Air journey reached live Boneyard combat and atomically sampled a
  three-band live bolt from rows `18` through `43`. Every planned band `zIndex`
  equaled its actual Pixi container depth; 103 Tree proxy residents were live,
  and page/console errors were empty (`job_20260829T185853Z_dae5ee9a59`;
  screenshot SHA-256
  `535f38f576152f2093e80ca59e15536da4139ef5878bc550eb3ea127f31dbf78`).
- Acid Rain and Magic Storm exercised their actor-owned `+350` proxy paths.
  Acid retained a separate `0.5` ground-residue pass, sampled 181 frames with
  p99 `16.8 ms` and no long tasks, and matched actual child depth to planned
  proxy depth (`job_20260829T185941Z_15d0ae3352`; screenshot SHA-256
  `fae80618e1ae184c5e7ddda5b2ec4356f804b9be95924926396b096765095e94`).
  Storm produced row `275` with empty errors
  (`job_20260829T190036Z_bdc65ede4c`).
- All four private Hub rooms entered and returned with sorted Region traces and
  empty errors (`job_20260829T190502Z_c2fc713820`). Goodie scenery ownership,
  the full loot family, multiplayer pickup, terminal fade, and Goodie opening
  passed with a clean process exit (`job_20260829T190134Z_6b076653a4`).
- The stock Tutorial completed Boneyard, College admission, acknowledged-save
  reload, Create, and returned-Hub transitions on schema 21 with empty errors
  (`job_20260829T190250Z_da3c2faf88`). Blizzard proved registered source,
  contact, Frost-fade, and chain-Frost roots; direct and chained targets were
  affected while the outside witness remained untouched; 26 split bands had
  exact actual depths (`job_20260829T190351Z_3faff9c3de`; screenshot SHA-256
  `fe83a7ef5b341c71605bb791410c5219b40370f183f79325a841008a5b5c1b7b`).
- The broad fresh-host smoke passed multiplayer Hub and Boneyard, two-player
  painter traces, Goodies, proxy residents, Apple M2 Metal WebGL, mobile
  projection, and every console/page error set
  (`job_20260829T190739Z_e4e49027eb`). Validation, commit, push, deployment,
  and live production health remain separate receipts; this task authorizes
  validation only.
- The canonical full Mac validation passed on exact current `origin/main`
  `d43def16dd0df9558bb295ebf3359985bc1a40d8`, including backend contracts,
  strict lint and both TypeScript builds, the complete frontend test corpus,
  desktop tests, production build, bundle budget, and media policy
  (`job_20260829T192408Z_531ae256ff`, exit `0`).
- Post-rebase browser canaries on `cc8ce79698f0888c9dba393b91f340fbcce26004`
  reproduced the editor's
  seven-root causal trace (`job_20260829T192033Z_2bddd78e39`), a live
  three-band Air body with empty errors (`job_20260829T192046Z_5a9041acb0`),
  and Blizzard's 26 bands plus direct/chain Frost membership
  (`job_20260829T192140Z_f6317b70f1`). The concurrently merged Enchant Staff
  compositor remained a child of the one retained player root in both Hub and
  Boneyard; its dedicated browser journey observed active aura record `11`, a
  1,752-pixel activation delta, and empty browser, host, and request failures
  (`job_20260829T192224Z_8dea6b98ad`).
- After the final HUD-only upstream merge, exact-`d43def16` browser acceptance
  again reproduced the editor trace (`job_20260829T192733Z_6cd62f3fb8`). The
  native HUD journey proved the fixed HUD root's exact health, Magic Shield,
  poison, mana-reserve, and repeated-strip composition in Hub and Boneyard
  with empty console, page, and network errors
  (`job_20260829T192710Z_6a8064f128`).

## Native and implementation audit receipt

- Fresh read-only native queries closed all `23` insertion references, all `7`
  flush references, all `5` `PuppetPointer` callers, the sole `AnimPointer`
  helper, and all `4` `ZAnimSplit` installers. Existing native reports also
  confirm the fixed Courtyard factory sequence and the Astronomer's separate
  late render ownership.
- The implementation residual sweep found and corrected one browser-only
  integration regression before initial acceptance: moving editor proxies into
  the shared trace had temporarily starved the runtime Tree/Building proxy
  asset pass. Runtime base owners, editor proxy order, and proxy resident assets
  are now distinct explicit products.
- Browser depth comparison then found that the planner positioned inserted Air,
  Blizzard, Acid, and Storm roots while their child containers retained owner
  depth. Recursive inserted-depth application now makes the visible child
  depth equal the queue trace, and the browser fixtures assert that equality.
- Save/reload acceptance found that Hub restoration rebuilt transient Students
  without the persisted world-manager allocator, causing `student:0` to
  collide with fixed Hagatha. Rebuilt Students now allocate after the saved
  cursor; current-schema and schema-20 tests include the fixed actor prefix.
- Strict protocol/browser acceptance found that combat-created Blizzard contact
  and chain children—and the broader Air, Fire, Weld, Boulder, Hail, Steam, and
  Flame Lash contact family—could survive one tick before generic enrollment.
  Every combat birth now enrolls at its causal creation point, and the runtime
  invariant closed 11 previously untested branches across all 51 combat tests.
- Acceptance tools that directly mutate authoritative state now consume the
  shared manager for loot, Goodies, tutorial sacks, Blizzard enemies, and
  optional Maggots. Their cleanup closes browser clients before hosts and
  cancels child journeys on failure, so a printed receipt cannot masquerade as
  an exit-zero result. The Air fixture also settles scripted movement and
  samples one live ephemeral band family atomically.
- The final visual review found no split-band seams or proxy starvation. The
  web and stock Acid screenshots both show the authored broad overhead green
  cloud; because their random arenas and phases differ, the exact queue/depth
  trace—not pixel identity—is the authoritative comparison.
- Re-auditing the later `cc8ce796` Enchant Staff merge found no new world
  painter: body, additive body, aura, and hands are child-local pieces inside
  `HubPlayerView.container`, so they inherit the existing player manager
  registration and Region row. Their internal `zIndex` values do not create a
  second Region queue member.
- Re-auditing the later `d43def16` vital-strip merge likewise found no world
  painter or boundary move. `NativeUiStrip` replaces child markup inside the
  existing `.hub-hud` DOM root at `z-index: 10000`; it remains after the world
  and post-scene indicators and never enters a Pixi Region queue.
- No platform blocker, guessed offset, UI-only patch, runtime injection, Mod
  Loader write, commit, push, deployment, or production mutation is part of
  this closure.
- After the post-implementation recursive scan and exact-base validation, no
  remaining discrepancy was found inside the Region world-painter system
  boundary. RainOfBones and Faculty lightning remain explicit absent gameplay
  owners, not unimplemented layers of an existing Website actor.


## 2026-09-20 — Ground-fluid and compact-mask ownership reopened

The poison-puddle and Spider death-fluid reports reopen the ground-effect
boundary. Previous receipts checked isolated mask contents and projectile
plans, but did not overlap those outputs with a player in the complete world.
The earlier claim that the compact mask belongs after the world queue is
refuted by its concrete Arena caller. This skipped the owner-to-caller trace
and composited-pixel acceptance required by the system recovery workflow.

### Evidence before implementation

- Fresh Mac Chrome/WebGL reproduction at `82cc95d7` places a Spider decal under
  the player but its second `native-compact-player-mask` at depth 3 above the
  player at depth 1. The latter paints an opaque white shape over the wizard.
  A mature PoisonPool alone paints below the wizard in this exact revision;
  its existing underlay ownership is correct. Zombie DeadHawg 30 remains
  incorrectly world-sorted, so relative Y determines whether it covers actors.
- Retail 0.72.5 SHA-256
  `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`,
  preferred image base `0x00400000`. Read-only canonical Ghidra replica queries
  recover Arena vtable `0x00785934` and Bonedit vtable `0x0078C184`; both slot
  `+0x110` entries (`0x00785A44`, `0x0078C294`) point to `0x00470EE0`.
  Raw instructions `0x0046F6B2..0x0046F6C6` call this slot, then the background
  manager `Region+0x2C4`, well before `0x0046FDAF` flushes the sorted world.
  Thus compact glyphs, the mode-1/2 direct record-18 light, and the conditional
  compact-mask targets are ground content. Confidence: instruction-confirmed.
- Zombie death `0x004947B0` constructs `Anim_Fade_Perspective_Clipped` with
  DeadHawg 30 and inserts it into `Region+0x2C4`, not a ZAnim manager.
  The existing delayed DeadHawg-31 splats use `Region+0x278`.
  PoisonPool `0x005EDFA0` remains the actor `+0x28` ground callback; its bubbles
  remain direct `+0x278`. Confidence: high, fresh binary plus existing entry 091.
- Raw `0x0046F9AC..0x0046F9B2` renders `Region+0x278`; the Region multiply
  follows, then the world queue. Existing growth, contact, poison, corpse,
  death-fragment, fade, save, and replication clocks are independent of these
  rendering owners. Existing extracted atlas records and tables are reused.

### Boundary and complete affected membership

The boundary is the ground-fluid painter path: Arena compact glyphs and their
per-player light targets, Zombie ground stains, and PoisonPool ground draws.
It is not the entire actor sorter, enemy AI, or combat damage system.

| Member | Recovered owner | Final disposition / proof |
| --- | --- | --- |
| Authored compact selector 25 / DeadHawg 139 | Arena slot +0x110, mask grid +0x8F84 | exact-ported; per-record full-scene overlap pixels in all three environment modes and both lighting settings |
| Authored compact selector 26 / DeadHawg 140 | same | exact-ported; per-record full-scene overlap pixels in all three environment modes and both lighting settings |
| Authored compact selector 27 / DeadHawg 141 | same | exact-ported; per-record full-scene overlap pixels in all three environment modes and both lighting settings |
| Authored compact selector 28 / DeadHawg 142 | same | exact-ported; per-record full-scene overlap pixels in all three environment modes and both lighting settings |
| Authored compact selector 29 / DeadHawg 143 | same | exact-ported; per-record full-scene overlap pixels in all three environment modes and both lighting settings |
| Spider decal DeadHawg 140 | same ground and compact-mask grids | exact-ported; overlapping wizard pixels, native lifetime tests, built-game birth/fade/retirement and cleanup |
| Spider decal DeadHawg 141 | same | exact-ported; per-record overlapping wizard pixels and cleanup |
| Spider decal DeadHawg 142 | same | exact-ported; per-record overlapping wizard pixels and cleanup |
| Environment mode 0 | no direct record-18 aperture; conditional masks still run | exact-ported; no aperture and unchanged wizard pixels with masks enabled |
| Environment modes 1 and 2 | record-18 aperture then optional mask per player in +0x110 | exact-ported; both beneath actors, measured aperture alpha in the existing explicit 14-percent Website brightness interval |
| Multiple players, materialization, departure and scene teardown | slot-ordered ground-light ownership | exact-ported; joined and materializing players, departed mask-target destruction, and renderer teardown |
| Normal and rotten Zombie DeadHawg-30 stain | background manager +0x2C4 | exact-ported; normal/rotten producer assertions, schema-35 migration, current-save round trip, both relative-Y pixel cases and real host replication |
| Rotten Zombie delayed DeadHawg-31 splats | pre-world manager +0x278 | verified-already-at-parity; binary/producer evidence, full-scene overlap pixels and built-game retirement |
| PoisonPool growing/live/fading DeadHawg-0 pair and bubbles | actor +0x28 / direct +0x278 | verified-already-at-parity; growing/live/fading overlap pixels plus actual movement, poison status, health loss and retirement through the built client |
| Flying Zombie fragments and Unbind | world queue / later direct owner | out-of-system: airborne actors are not ground fluid; retain their existing ownership |
| Terrain shape-mask rasterization | separate +0x8F24 geometry producer | out-of-system: existing unimplemented shape contribution, absent from all twelve stock survival templates; no new terrain contract inferred |

### Implementation and acceptance contract

Keep the existing ground parent and native ordering: compact glyphs, per-player
aperture/mask pairs, background stains/corpses, auxiliary ground effects,
Region lighting, then sorted actors. Move the existing DOM aperture into this
GPU ground owner so it cannot independently cover actors. Preserve the current
brightness policy. Correct Zombie stain ownership at production and save
restoration; legacy saves must migrate without losing an active stain.

Use the existing renderer and host/browser harnesses. First prove the regression
fails on Mac, then verify all eight mask records, both Zombie variants and both
sides of the player, PoisonPool contact/status and fade, multiple players,
settings, and teardown. Run the exact candidate's full Mac validation and a
built `/game` journey before the authorized fast-forward main push. No new
browser approximation is needed for the changed ordering. Fresh clean-stock
interactive capture is not claimed; native ordering is instruction-derived,
and overlapping browser pixels are measured directly.


### Implementation validation receipt

- Runtime, tests and browser harnesses are commit
  `7e7afebe7940429bb27768490c1d22db8b029f6a`, based on
  `82cc95d713f464c31d4ffa4a7c7c2ad16970883b`. The local and detached Mac
  worktrees had byte-identical SHA-256 manifests for all 28 changed files.
  The built frontend's `deployment.json` identifies that candidate. This
  receipt update changes only this ledger, after validation.
- Mac regression-first evidence: the original Zombie owner assertion failed
  (`world-sorted` instead of `background`), and save restoration rejected the
  correct ground owner. The original full-scene Zombie overlap changed wizard
  body channels by up to 32; the Spider mask visibly covered the wizard in
  white. After the fix, all six focused terminal/save tests passed.
- Mac Chrome/WebGL `smoke-ground-effect-layering.mjs`: **84 cases passed**,
  including all five authored compact selectors, all three Spider decals,
  growing/live/fading PoisonPool, both sides of the Zombie stain, and delayed
  splats. All run in modes 0/1/2 with complex lighting off/on. Maximum change
  to the sampled opaque wizard pixels with the ground pass enabled was **0**
  in every case, while each effect produced changed ground pixels. Player
  arrival, materialization exclusion and complete renderer teardown passed.
  Browser error and failed-response arrays were empty.
- Existing `smoke-spider-masks.mjs`: all eight shape/alpha cases passed,
  including authored rows, DeadSpider, combined masks and cell boundaries.
  The combined target retains 10,271 nonzero-alpha pixels; ordinary cases have
  transparent corners. Two-player targets reduce to one on departure, the
  departed target is destroyed, and teardown leaves no retained children.
- Built `/game` journey via `smoke-boneyard-waves.mjs --ground-effects-only`
  with `SDR_GAME_WAVES_SMOKE_PRODUCTION=1`: normal and rotten Zombie deaths
  produced two background-owned stains, Spider death replicated its decal,
  and real keyboard movement into the pool applied **1,000 poison ticks**.
  Health changed from **50 to 49.930999999701974**, with continued damage
  visible in the client. Pause held tick 1,055; pool fade, stain/decal
  retirement and return-to-title renderer teardown passed. The screenshot
  was visually inspected. Page/console/response error arrays were empty.
- Full Mac gate: `/opt/homebrew/bin/bash ./scripts/validate.sh` exited **0**.
  Backend integration, formatting/lint, all configured frontend/desktop tests,
  production build, media policy and renderer quality gates passed. The final
  quality report at `2026-09-20T11:33:58.423Z` reports no failures, 100-percent
  coverage in its eight configured renderer targets, and no mutation
  survivors: 375 killed, 24 timeouts, 142 compile-invalid and 23 existing
  reviewed equivalents. No threshold, test selection or gate was weakened.
- Native tooling provenance: read-only Mod Loader wrapper
  `scripts/Invoke-GhidraHeadless.ps1` SHA-256
  `b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`;
  `tools/ghidra-scripts/decompile_targets.py` SHA-256
  `899167ca42624e09f26d22233365631a6ee8b3d106e337e20b77574894e97465`.
  The canonical source project and its replica pool were used without editing
  Mod Loader. Raw captures and logs are disposable after this durable receipt.

The changed ground-ordering system has no unresolved browser constraint.
The pre-existing Terrain-mask omission and explicit direct-aperture brightness
policy remain the separate dispositions listed above. Production deployment
or live production behavior is not established by these local Mac receipts.

## 2026-09-22 — Report 12: ground stains across run and account boundaries

### Evidence before implementation

The original report `1551777701390721136` and its attachment
`1551777701063426099__image.png` show a pale patch near the wizard during the
opening Solomon encounter, described as a Spider puddle surviving a previous
run and a Guest-to-account change. The attachment alone cannot identify its
producer. The report archive remains unmodified.

The native ownership recovered in entry 091 distinguishes two producers of
the same DeadHawg art. `Arena::Initialize 0x00470A90` admits authored compact
rows 25–29 to its mask grid. `Anim_DeadSpider::Tick 0x00461740` instead inserts
one temporary row into both grids at `0x00461A0A/0x00461A3C` and removes both
at `0x00461AF4/0x00461B22`. Its twenty-second lifetime includes growth after
0.8 seconds and fading during the final second. These are existing
instruction-derived facts for retail 0.72.5, SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, image
base `0x00400000`; no new clean-stock GUI capture is claimed.
The local `SolomonDarkAbandonware/SolomonDark.exe` SHA-256 was rechecked in
this investigation. Fresh GNU objdump output at `0x00461AD0..0x00461B35`
confirms both removal calls to `0x00588260`, with owner offsets `+0x8F84`
and `+0x8AF4`, against that same executable.

Fresh Mac inspection of the current generated bank confirms compact-row
counts by template index 0–11: **57, 0, 47, 0, 19, 37, 0, 0, 50, 0, 39, 41**.
The stock Tutorial additionally contains eleven authored compact rows.
Therefore a stain visible before the first Spider spawn does not itself
establish leaked state. Preserve authored content unless browser evidence
identifies an incorrect owner.

### Boundary and final membership

This reopening covers compact ground-content lifetime from map construction
through enemy death, retirement, same-run continuation, new run, and account
replacement. It does not reopen already recovered AI, damage, art, or painter
geometry. The earlier ground-layer receipt retired effects before leaving;
it did not test leaving while those effects were still alive.

| Member | Native ownership and required outcome | Final disposition / proof |
| --- | --- | --- |
| Authored selector 25 / DeadHawg 139 | Map-owned | verified-already-at-parity; selector-25 mask remains after temporary effects retire |
| Authored selector 26 / DeadHawg 140 | Map-owned | verified-already-at-parity; selector-26 mask and exact report sprite-63 in three fresh run generations |
| Authored selector 27 / DeadHawg 141 | Map-owned | verified-already-at-parity; selector-27 mask remains after temporary effects retire |
| Authored selector 28 / DeadHawg 142 | Map-owned | verified-already-at-parity; selector-28 mask remains after temporary effects retire |
| Authored selector 29 / DeadHawg 143 | Map-owned | verified-already-at-parity; selector-29 mask remains after temporary effects retire |
| Generated template 0 | 57 authored rows | verified-already-at-parity; complete bank census and catalog geometry-hash test |
| Generated template 1 | 0 authored rows | verified-already-at-parity; same census and hash test |
| Generated template 2 | 47 authored rows | verified-already-at-parity; same census and hash test |
| Generated template 3 | 0 authored rows | verified-already-at-parity; same census and hash test |
| Generated template 4 | 19 authored rows | verified-already-at-parity; same census/hash test and exact attachment match |
| Generated template 5 | 37 authored rows | verified-already-at-parity; same census and hash test |
| Generated template 6 | 0 authored rows | verified-already-at-parity; same census and hash test |
| Generated template 7 | 0 authored rows | verified-already-at-parity; same census and hash test |
| Generated template 8 | 50 authored rows | verified-already-at-parity; same census and hash test |
| Generated template 9 | 0 authored rows | verified-already-at-parity; same census and hash test |
| Generated template 10 | 39 authored rows | verified-already-at-parity; same census and hash test |
| Generated template 11 | 41 authored rows | verified-already-at-parity; same census and hash test |
| Stock Tutorial | 11 authored rows | verified-already-at-parity; complete source census and existing catalog test |
| Spider temporary DeadHawg 140 | Paired ground/mask lifetime | verified-already-at-parity; DeadSpider-140 removal and texture teardown |
| Spider temporary DeadHawg 141 | Paired ground/mask lifetime | verified-already-at-parity; DeadSpider-141 removal and texture teardown |
| Spider temporary DeadHawg 142 | Paired ground/mask lifetime | verified-already-at-parity; DeadSpider-142 removal and texture teardown |
| Corpse banks 208–227 and empty index 20 | Twenty-unit effect with separate body visibility | verified-already-at-parity; complete direction-bank and retirement unit tests |
| New Game after leaving live effects | New enemy store and renderer | verified-already-at-parity; built browser journey without reloading the page |
| Fresh account after Guest | New account save owner, enemy store and renderer | verified-already-at-parity; real local API registration/login and built browser journey |
| Last game in the same run | Preserve saved effects and remaining clocks | verified-already-at-parity; live Spider, pool, two stains and delayed splats restored |
| Terminal Game Over to Create/College, then next Boneyard | The completed Arena is discarded; the next Arena constructs its own enemy store | verified-already-at-parity; entry 235, existing all-dead/loadout simulation test in the canonical gate, and shared renderer disposal |
| Ordinary Zombie DeadHawg-30 stain | Run-owned background effect | verified-already-at-parity; native death producer, save/resume and both new-generation boundaries |
| Rotten Zombie DeadHawg-30 stain | Same owner, distinct producer | verified-already-at-parity; same per-producer journey |
| Rotten Zombie delayed DeadHawg-31 splats | Run-owned pre-world effect | verified-already-at-parity; six restored splats and zero in new generations |
| PoisonPool | Run-owned ground callback | verified-already-at-parity; contact, poison, save/resume, and zero in new generations |
| Weather rain/splash particles | Separate weather owner; scene disposal is checked, no puddle-lifetime inference | out-of-system |

### Acceptance contract

Use the existing Mac host/browser and mask harnesses to distinguish authored
patches from actual death effects, exercise new-run and account boundaries
with effects alive, and preserve same-run continuation. Record observed
dispositions before delivery. Run the exact candidate's canonical Mac gate
and built `/game` journey under the campaign publication lock.

### Report attachment identification

A fresh Mac Chrome/WebGL render of template index **4**, with no prior game
and `spiderRemains: []`, reproduces the attachment's complete local scene:
the Tree above the wizard, both grave rows, Solomon's hole and lantern, and
the pale patch between the two upper gravestones. The patch is authored
**`sprite-63`, selector 26 / DeadHawg 140**, at
`(849.0390014648438, 1112.963623046875)`, rotation
`15.861599922180176` degrees, `s1 = s2 = 1`, flags `1`.
It is already in the source scene, independently of any enemy store.
The template's original generated-file SHA-256 is
`bec9377cf539bb193e8af6ad72fa78a5e47e44206a1fef4d6bf3bfbda3f04a08`.
Solomon's root is `(827.8855590820312, 1333.528564453125)`.
The 2026-09-22 disposable `map-4.png` was visually compared with the original
attachment. This identifies native authored content, not an observed
cross-game Spider-decal leak. Native appearance and lifetime remain unchanged.

### Mac implementation and investigation receipt

Report disposition: **native_behavior**. No runtime, authored data, asset,
save policy, or native lifetime was changed. Changes are limited to this
ledger and reusable browser acceptance tooling. A native-behavior finding
does not authorize the report's Discord fixed reaction.

- `native-dead-spider.test.ts`, `spider-save.test.ts`, and
  `boneyard-catalog.test.ts`: **13/13 passed** on Mac. These cover both corpse
  banks, decal admission/retirement, current and legacy continuation, all
  generated-source geometry identities, and Tutorial projection.
- `smoke-spider-masks.mjs`: **10/10 cases passed**, expanded from one sampled
  death record to all three. Authored targets remain after temporary records
  disappear; temporary sprites are destroyed; the departing player's target
  is destroyed; every case leaves zero retained children at teardown.
  Page/console/failed-response arrays are empty.
- `smoke-ground-effect-lifecycle.mjs` uses the built `/game` client, a private
  host, a real .NET account API, isolated SQLite storage and a new Chrome
  profile. It reproduces actual Spider and ordinary/rotten Zombie deaths,
  keyboard movement onto the pool, 1,000 poison ticks and health loss, then
  leaves while the Spider decal still has over eighteen seconds remaining.
  Last game restores the same run with one Spider remains, one pool, two
  background stains and six delayed splats. New Game without a page reload
  and a real Guest-to-account login each create a distinct run containing
  **zero temporary remains/pools/stains/splats**, while authored sprite-63
  remains identical. The original and signed-in screenshots were inspected.
- The focused journey at `2026-09-22T15:56:33Z` has empty page, console,
  failed-response, unexpected-request-failure and wire-error arrays. Four
  static media/favicon requests canceled by explicit full-page navigation
  are separately recorded as expected `net::ERR_ABORTED` events. This is not
  a production-account or production-deployment test.
- Final publication requires the campaign lock, rebase to current main,
  byte-identical local/Mac candidate files, the complete
  `/opt/homebrew/bin/bash ./scripts/validate.sh`, and this built lifecycle
  journey again. The publication outcome records the exact candidate and
  final gate/browser results. Disposable databases, profiles, screenshots,
  probe source, logs and worktrees are removed after publication.

There is no unresolved behavior or platform approximation within this
reopened lifetime boundary. A different report with actual retained dynamic
records would reopen it; this attachment's patch is positively identified as
authored native content.

The terminal-path sweep confirms `enterPostRunLoadout` replaces the completed
Boneyard with `createHubWorld`; subsequent `createBoneyardWorld` constructs
`createBoneyardEnemyStore`. `BoneyardScene` disposes its renderer (including
the compact grids) on unmount or a changed `loaded` world. No player/profile
owner carries those transient records across Game Over.

## 2026-10-03 — Report 56: auxiliary ground shadows and occluder ownership

### Investigation state and reported contrast

This is an investigation entry, not an implementation or acceptance receipt.
Report 56 compares a wizard beside Useful Thyngs, the north arch, and the
College statue: “Shadow does NOT display behind Circus tent or Arch, but DOES
display behind statue.” The exact original `1554266192884146226` in thread
`1542255501855825960` was rechecked under account `600774060439371807` on
2026-10-03. Its wording, null edited timestamp, and three attachment IDs are
unchanged; a bounded eight-message surrounding window contains no related
withdrawal or correction. No completion reaction has been added.

All three retained images were directly inspected. Their different positions,
headings, camera crops, and scenery silhouettes do not establish an identical
shadow comparison. The historical build and exact input state are unknown.
Attachment `1554266191776714782` remains a 658-by-510 PNG, 353,076 bytes,
SHA-256 `5ee9b9c3c9d5723256790a7f9d276069f18cde9f00de7177a614b4c609697c39`;
its source declares WebP and 287,966 bytes, so encoding/byte equivalence is not
claimed. Attachments `1554266192141746176` and `1554266192552665118` remain
1164-by-740 / 1,217,854 bytes / SHA-256
`8020fe22359d66cb23b51d39cfcf3ef43f9eb69c6e73edc3a380575a5306b271`
and 1489-by-781 / 1,700,497 bytes / SHA-256
`f6956ec12cda394b44a8e7a0bf6ff8936f55e945281c1d2e19d7d236a55678c9`.
Original media and older archive snapshots are preserved.

The maintained source was freshly fetched at
`ae26c65e76d5392257cabdb1ac346432f2aac547`, tree
`0e449d360ad45f00e01ff98b1edb4e294a9cdc3e`. Report 55's accepted Teacher
ground owner remains present. No Website check, build, browser, stock-runtime
probe, new disassembly, or new decompilation has run in this Report 56 phase.
This M2 phase uses retained text/stock inputs and light PE header/RTTI/vtable
reads only. Current-renderer pixels and the historical report's causal
attribution remain unmeasured until an admitted M5 diagnostic phase.

### Native evidence before product changes

The sealed retail 0.72.5 executable is 4,723,200 bytes, SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`,
preferred image base `00400000`. These file addresses are not fresh runtime
pointers or ASLR observations.

| Evidence | Exact source | Established fact | Confidence |
| --- | --- | --- | --- |
| Light PE/RTTI read | `SolomonDarkAbandonware/SolomonDark.exe`, PlayerWizard vtable `00793F74` | Body `+1C=0054BA80`, auxiliary `+28=00528AD0`, light provider `+30=005299A0`; these are separate callbacks. | high |
| Retained instructions | `Decompiled Game/dump_vt7_vt10.log`, lines 1747–1906, `00528AD0..00528D09` | The ordinary auxiliary calls the BadGuys glyph at manager offset `3384`, record 67, at `position - 5*headingVector` and scale `1.25*actorScale`. | high |
| Retained Courtyard decompilation | `Decompiled Game/ghidra_outputs/chase_field_offsets_20260413.txt`, lines 6771–6789 and 6880–6885 | The actor-manager walk calls every `+28` at return `0051FA67`, before seals and the main queue flush at `0051FD2D`. | high for call relationship; existing decompiler interpretation for surrounding presentation |
| Retained Arena decompilation | same export, lines 10806–10876 | Scenery, actor, and transient managers invoke `+28` at returns `0046F8FE`, `0046F947`, and `0046F98C`, before Region multiply and the main queue. | high for call relationship |
| Light PE/RTTI read and retained callback | Student vtable `007916DC`, `refs_dat819978.log` lines 20887–20904 | Student `+28=00502090`; its retained formula uses the same ordinary heading offset and actor-scale multiplication. The omitted glyph-register binding still needs instruction confirmation. | high for callback/formula; glyph identity pending |
| Light PE/RTTI read and existing entry 018 | CollegeStatue vtable `00791584`, `+1C=00501490`, `+28=00501510` | College 39 is body art; College 41 is a separate multiply ground shadow with the already recovered common phase. | high for vtable and retained contract; a fresh operand read remains pending |
| Authored bundle metadata | stock `College.bundle` (543 rows), `BadGuys.bundle` (2,509 rows); maintained `native_bundle_art.py` schema | Record 67 has a 25-by-25 logical canvas, zero center, and no outline points. Reported occluders consume registered College artwork; they do not use an inferred hull/mask. | high |
| Current source, corrected 2026-10-04 | `world-player-view.ts`, `hub-actors.ts`, `hub-world-scene.ts`, `hub-private-room-scene.ts` | Player/Student and several NPC shadows are nested in body painter roots; `applyPainterOrder` reassigns statue shadow to `statueBody.zIndex - .25`. Its constructor's raw depth does not persist through the actual render update. | high, complete source path and actual rows |

The `00414EA0` helper is a generic glyph transform/draw entry, also used by
unrelated elements and effects. Its callers do not all become members of this
ground-shadow system. Membership follows the concrete auxiliary callback,
selected glyph, owning manager, and scene consumer, rather than address
adjacency or every use of a generic renderer helper.

### Boundary and complete current inventory

The reopened boundary is native pre-world `Puppet +28` ground presentation
consumed by College scenes, together with PlayerWizard's shared Arena consumer
and the artwork that occludes those ground pixels. Body/attachment/death
compositors, light-source submission, directional silhouette projection, and
late direct Astronomer rendering retain their separate owners. The field and
callback sweep below includes negative and dormant siblings so that a future
fix cannot silently leave another supported auxiliary member in a body row.
The inventory is not yet a final disposition table.

| Native class/member | Vtable / `+28` | Current Website consumer or branch | Investigation disposition |
| --- | --- | --- | --- |
| PlayerWizard, all five element appearances, all 24 headings, local and remote | `00793F74 / 00528AD0` | Shared `PlayerWorldView` in Courtyard, all four private rooms, Arena/Tutorial Boneyards | Ordinary native contract recovered; ground ownership/position/opacity and early-death branch need measured diagnosis and port. |
| Student, walking/reading, all headings and authored constructor scales | `007916DC / 00502090` | `HubStudentView`, live/pool/retirement branches | Separate callback/formula recovered; exact glyph/operand confirmation remains pending; current body-owned fixed-size shadow is a sibling mismatch. |
| CollegeStatue | `00791584 / 00501510` | `HubWorldScene.statueAura`, College 41 multiply | Separate native ground owner recovered; current body-row depth minus .25 is measured in supported cases below. The original stale-constructor-depth interpretation is withdrawn. |
| PerkWitch / Hagatha | `00791664 / 00501990` | `HubHagathaView` | Callback and actor membership recovered; exact glyph binding/transform operand widths need retained or admitted instruction confirmation. |
| Annalist / Provokatus | `00791754 / 00502180` | Courtyard `addNpc` | Same ground interval; callback sets half alpha and a distinct transform. Exact selected glyph/operands remain pending. |
| Illuminator | `007917CC / 005022F0` | No maintained survival snapshot member | Dormant native sibling; confirm builder reachability and selected glyph before a final reasoned out-of-system disposition. |
| PotionGuy / Fomentius | `00791844 / 00502420` | Useful Thyngs shadow College 33; body stack College 34 / 160–164 / 32 / 54–58 | Ground callback and authored kit already recovered; preserve all kit registrations and ground order. |
| Tyrannia / Skorcha | `007918BC / 005053E0` | Optional/shared scheduled `HubSkorchaView`, both placements | Callback/body split recovered; exact glyph/scale/offset and mirroring need instruction confirmation. |
| ItemsGuy / Luthacus | `00791934 / 00502520` | `HubCommonTraderView` | Callback/body split recovered; exact auxiliary draw remains pending. |
| Teacher / Machinimbus | `007919AC / 00505480` | Report 55's accepted `HubTeacherView.ground`, College 13 followed by BadGuys 67 | Reuse accepted native/render evidence; preserve rune, shadow and artwork. Additional sibling integration must retain this ground interval and lifetime. |
| CustomObject, all 18 private-room rows listed below | `00791A94 / 00505E80` | Authored room props/portraits | Callback exists separately from body `00505E50`; its actual delegation/negative branches and each region's ground caller must be recovered before changing props. |
| ArchChancellorStanding | `00791B74 / 00506050` | Native variant; standing reachability differs from maintained seated Office actor | Record-67 helper call recovered; scale operand width and concrete population reachability pending. |
| Dowser / Shlorio | `00791CDC / 00502CF0` | Library actor | Auxiliary transform is separate; current body-only construction has no explicit ground owner. Exact glyph selection remains pending. |
| Memorator | `00791D54 / 00502E60` | Mortuary actor | Auxiliary heading-sensitive transform is separate; exact glyph selection and private-room order remain pending. |
| Annalist2 | `00791EB4 / 00503060` | Native alternate/story builder | Dormant sibling; concrete reachability and selected glyph remain pending. |
| Polisher | `00792DB4 / 00502980` | Maintained story Office policy actor | Separate ground transform; preserve policy admission/visibility and recover exact selected glyph/caller. |
| NPC base | `007915EC / 0055C300` | Common base only | Auxiliary is a no-op, so no invented shadow. |
| CollegeObstacle selectors 0–7 | `0079151C / 0055C300` | Eight Courtyard artwork actor roots | Auxiliary is a no-op; occluder artwork remains in its body painter. |
| ArchChancellor / ArchChancellorDesk | `00791AFC / 0055C300`; `00791BEC / 0055C300` | Office seated actor and native desk sibling | No auxiliary shadow; body/desk art is not a substitute ground caster. |
| Librarian | `00791C64 / 0055C300` | Library counter/body stack | No auxiliary shadow. |
| Painting interaction actors 0, 1, 100, 3–9 | `00791DCC / 0055C300` | Mortuary dialogue roots, separate from CustomObject portrait presentation | No auxiliary shadow. Dynamic memorial portraits require their own recovered presenter classification. |
| Astronomer/helper/assistants | direct late Courtyard program `0051C790 / 0051DBB0` | Southern render bank | Separate direct presentation after the shared Region queue, not an ordinary actor-manager `+28` member. Preserve existing shadows there. |
| Player terminal nine-layer corpse shadow and death-weapon shadow | Player body/death compositor and registered bouncer | `PlayerWorldView.deathShadowLayers`, `PlayerDeathWeaponView` | Separate class-local/actor draw programs, already recovered in entry 097; overlap with the ordinary auxiliary lifetime must be checked without moving these passes into the ground lane. |
| Boneyard directional scenery/enemy projections and light-provider records | entries 064 / 078 / 090 | Indexed meshes, analytic/raster lights, enemy underlays | Separate class-specific owners, not College occluder masks. Preserve Report 09 batching/performance and existing exact outline tables. |

The complete reported occluder artwork inventory is the existing eight
CollegeObstacle selectors plus the tent kit and statue body. Selector 7 is the
north arch in Report 56's third attachment; selector 0 is the distinct large
east arch/banner composition from the earlier layering report.

| Occluder/member | World root | Authored College body program |
| --- | --- | --- |
| CollegeObstacle 0 | `(1458.5,320.5)` | `148..159`, all twelve registered pieces |
| CollegeObstacle 1 | `(955.5,239.5)` | `25` |
| CollegeObstacle 2 | `(749.5,162.5)` | `23` |
| CollegeObstacle 3 | `(1893,490)` | `28` |
| CollegeObstacle 4 | `(1746,534)` | `29` |
| CollegeObstacle 5 | `(1840,715)` | `27` |
| CollegeObstacle 6 | `(628,215)` | `20` |
| CollegeObstacle 7 / north arch | `(956,169)` | `24` |
| Useful Thyngs / Fomentius | `(1397,664)`, bias `-5` | Contiguous body callback `34`, actor `160..164`, front `32`, balloons `54..58`; shadow `33` is auxiliary |
| CollegeStatue | `(961,834)` | Body `39`; multiply `41` is auxiliary |

Every private CustomObject row also remains enumerated while its auxiliary
delegation is unresolved: Mortuary `0..9`; StoreRoom `0`, `1`, `2`; Library
`0`, `1`, `2`, `100`; Office `0`. The complete roots and room callback programs
are retained in this entry's private-room section and
`core-kernels/hub-private-room-layout.ts`. An absent/null visual at Library
selector 100 is not evidence that its native auxiliary callback is a no-op.

### Recovered PlayerWizard contract and pending native reads

The exact retained instruction branch first rejects consumed corpse byte
`+1C0`. If drive `+160` is zero, or drive timer `+1BC <= 150`, it draws the
ordinary ground glyph. The ordinary branch offsets opposite the continuous
native heading by five world units and multiplies actor scale `+74` by the
double `00784740 = 1.25`. Special surface state `+154 == 2` instead uses
offset two (`007DE838`), scale multiplier
`1.2000000476837158` (`00785360`), and alpha `0.5` (`007DE870`), then restores
opaque diffuse color. When drive is active and timer exceeds 150, it draws no
ordinary glyph and writes the six-sector terminal vector at `+1F4/+1F8`;
the vector constants are 150, 9, and 55 at `00785D90`, `00786970`, and
`00785AA8`. Those vector writes belong to the existing death compositor,
not a shadow animation to invent.

Current `PlayerWorldView` constructs a zero-offset, scale-1.25, alpha-0.72
sprite under the body and hides it as soon as the death draw plan is visible.
The native offset, auxiliary owner, opacity producer and early-death interval
therefore require separate checks. Corpse consumption already exists in schema
48 and must continue suppressing both eligible presentations. Native timer
writers, casting gates, special-surface reachability and private-room ground
callers must be reconciled with current authoritative fields before a shared
implementation is chosen. An inferred field name in old pseudo-source is not
sufficient evidence for that mapping.

The statue auxiliary is also distinct from the body queue root. The earlier
sentence in this entry saying body and aura remain children of one actor root
does not describe the native `+28/+1C` split and is superseded for the ground
shadow by this evidence. Current body queue depth is assigned by
`NativeHubPainterPlanner`; the complete source path then assigns
`statueAura.zIndex = statueBody.zIndex - .25` in `applyPainterOrder`. The initial
M2 trace missed that per-frame assignment and incorrectly treated the
constructor's `hubActorDepth(834)-1` as the actual final depth. That assumption
is withdrawn. The mismatch is body-row auxiliary ownership, not a lingering
raw constructor value. The accepted Report 55 code provides a concrete shared
Courtyard ground interval, but does not prove another callback's constants.

### Diagnostic and completion contract

Before product changes, use the existing public renderer/real-texture harness
pattern from `teacher-circle-layering-probe.mjs` to compare all three reported
occluders across both sides of their actual queue rows. Capture each ordinary
ground glyph and each occluder's actual opaque-alpha mask independently.
Measure exposed ground, opaque occluder/body pixels, source eligibility and
the parent/order/position of the actual shadow. A ground reference must use
the same authored glyph and geometry in the recovered auxiliary interval;
guessed hulls, screenshots alone and broad depth inequalities are not oracles.
Verify whether the reported contrast is expected artwork coverage, misplaced
ground submission, missing state/geometry, or a combination.

Recover the pending glyph/operand/caller branches for every enumerated native
auxiliary, then select the smallest complete remedy. Per-member acceptance
must retain local/guest/Student presentation, all supported College rooms,
Arena's pre-multiply interval, camera 80/100/130, Enhanced Effects branches,
death/consumption/materialization, pool reuse, departure and teardown. Native
complex-lighting/shadow settings gate directional products separately; they
must not become an invented ordinary-circle visibility switch. Preserve
authored alpha, registered shape, animation and the accepted indexed renderer.

All Website execution and intensive recovery wait for explicit M5 grant and
fresh actual admission. Final delivery still requires a supported final
disposition for every row, actual built scenes, the unchanged all-mode
canonical gate on immutable exact bytes, normal publication/current-main
reconciliation, managed live verification and both-device scoped cleanup.
No Report 56 resolution is claimed by this entry.

### 2026-10-04 — targeted native operands recovered; pixel control still open

The first admitted M5 setup timed out before staging-ready and ran no native
or renderer command. Its automatic clean release was `01:06:37.384371Z`.
The remaining original phase admitted exact `513b6a7b` / tree `1e715e1c`,
clean index and all 7,256 tracked-file bytes before execution. Private Node
22.17.0, Chrome and matching-lock dependencies were copied read-only from
coordinated stable sources. The private installed Apple LLVM copy has SHA-256
`83b32f39e5475ee168927eb1509c82978e08e0100ec8c6fafeca588d9960773c`.
The unchanged sealed retail executable above passed identity checks.

The bounded `llvm-objdump --disassemble --x86-asm-syntax=intel` extraction
completed all 25 declared ranges from `01:15:53.736772Z` through
`01:16:02.359674Z`, exit zero. Each range's exact start/stop, command, raw
instruction hash and typed absolute operands are retained in the task's
native receipt. Range bounds sometimes include adjacent constructors; only
the cited callback instructions below are used as native facts. No new Ghidra
project or Windows runtime was involved.

The previously omitted ECX bindings are now instruction-confirmed. The glyph
manager has a `0x38` header and `0xC4` records, so offsets `3384`, `197C`,
`08A4` and `040C` identify records 67, 33, 11 and 5 respectively.

| Auxiliary member | Exact binding / draw evidence | Recovered result |
| --- | --- | --- |
| Student | `005020B4..005020C1`, draw `0050210C`; typed operands `007DE8D8`, `00784740` | BadGuys 67; opposite-heading offset 5; scale `1.25*actorScale`. This supersedes the pending glyph identity in the first inventory. |
| Hagatha / PerkWitch | `005019D8..005019E3`, `00501A12`; second binding `00501AFC..00501B02`, draw `00501B08` | BadGuys 67 at `actor+(-18,+7)` under matrix arguments `(1.25,1.0499999523162842,1)`; the same auxiliary additionally draws additive College 5 at `actor+(11,8)` under scale `1.2000000476837158`, with its own diffuse/random program. Preserve that sibling output when separating the ground owner. |
| Annalist / Provokatus | `0050218E..005021B7`, `005021F3..005021FE`, draw `0050222D` | Half-alpha BadGuys 67 at `actor+(-2,0)` under the same three matrix arguments; diffuse opaque state is restored. |
| Illuminator | binding `0050233B..00502346`, draw `00502380` | BadGuys 67; X offset uses mutable `+140 * .25`, Y offset zero; same matrix arguments. Population reachability remains open. |
| Fomentius / PotionGuy | `00502426..00502442` | College 33 at `(10,60)`, with float32 operands `007DE984=10`, `007867F0=60`. |
| Luthacus / ItemsGuy | `00502523..0050255B`, binding `00502536..00502542` | Authored College 11 at `actor+(15,8)`, not a generic BadGuys-67 oval. Constants are doubles `00784D80=15` and `007847A8=8`. |
| Polisher | binding `005029C8..005029D3`, draw `00502A02` | BadGuys 67 at `actor+(5,10)`, same matrix arguments. |
| Shlorio / Dowser | binding `00502D38..00502D43`, draw `00502D72` | BadGuys 67 at `actor+(-3,+4)`, same matrix arguments. |
| Memorator | binding `00502EC6..00502ECC`, draw `00502F23` | BadGuys 67 with the recovered heading-sensitive opposite-five translation plus `(0,5)`, same matrix arguments. |
| Annalist2 | binding `005030A8..005030B3`, draw `005030E2` | BadGuys 67 at `actor+(-7,0)`, same matrix arguments; alternate population reachability remains open. |
| Skorcha / Tyrannia | binding `0050543A..00505449`, draw `0050545F` | BadGuys 67 under the same matrix arguments; actor-origin translation. Mirroring and all optional placements still need renderer evidence. |
| Standing ArchChancellor | `0050606A..00506092` | BadGuys 67 at actor origin, float32 `00785590=1.75`; standing-population reachability remains open. |

Newly consumed authored inputs are fully read for College 5 (50-by-46 logical
canvas) and College 11 (67-by-54); both have zero center and no outline points.
They must be retained as the native artwork, not replaced by a hull or oval.
This is native recovery, not a claim that the current Website already consumes
the correct fields or pixels.

Private-room ground invocation is also instruction-confirmed: Mortuary
`0050F105` (return `0050F107`), Library `00511935` (return `00511937`),
StoreRoom `0051996A` (return `0051996C`) and Office `0051A485` (return
`0051A487`) invoke each actor's `+28` before the pre-world animation/main
queue intervals. Thus the shared player auxiliary has all four room consumers.

CustomObject `00505E80` delegates `(selector,x,y)` to Region `+120`; body
`00505E50` separately delegates to `+11C`. Fresh light reads of the same
sealed PE show Mortuary `007927DC`, StoreRoom `0079294C`, Office `00792AB4`
and Library `00792C04` all have `+120=00508910`, whose bytes are
`C2 0C 00` (`ret 12`). All 18 current CustomObject auxiliary rows are therefore
native no-ops. Each is `out-of-system` for auxiliary shadow production:
Mortuary 0,1,2,3,4,5,6,7,8,9; StoreRoom 0,1,2; Library 0,1,2,100; Office 0.
Their authored body artwork remains relevant occluder content; this negative
callback does not authorize changing its painter or image.

The fresh statue instructions refute additional details of the earlier entry
018 summary. Body `005014BA` and auxiliary `00501574` multiply the common
trig result by double `007DE8D8=5`, not 2. The auxiliary at
`005015A1..005015B5` **adds** the 60-degree helper components to the negative
wave X and `0.800000011920929` times positive-wave Y; it does not multiply
the entire wave by the direction vector. College 39 / 41 binding and multiply
mode 2 followed by restoration to 0 are confirmed. The exact common trig
helper semantic and registered transform still need reconciliation before a
replacement formula is implemented. Current `hubStatueOffsets` retains the
older `-2*sin` / vector-multiplication approximation. No product correction
is made from a partially recovered formula.

Player reset `0052A500` clears drive `+160` and timer `+1BC` at
`0052A597/0052A5AF`; the targeted tick range recovers reads but not the
timer's complete increment/casting writers. Special surface `+154==2` is read
in movement/footstep branches at `0054AD81`, `0054AE9D`, `0054B369`.
Its writer/admission, complete timer mapping, statue trig helper and dormant
population reachability remain specific native gaps, not platform exemptions.

### Actual initial renderer failure and recovery boundary

The actual public current renderer started at `01:16:02.446685Z`. Scene/glyph
selection and earlier mask checks reached the final exposed-circle control,
which failed with “An exposed ordinary shadow control has no pixels” at
`01:17:18.755Z`; the process exited one at `01:17:22.017607Z`. Browser,
failed-response and request-failure arrays were empty. The initial helper
threw before returning its rows/images, so no numerical differential result
or meaningful red regression is retained or claimed. Whether that control
was covered by artwork, by the wizard body, or exposes the actual position/
opacity defect remains unresolved.

Automatic cleanup released at `01:17:26.015645Z`: no owned processes, private
temp/profiles cleared, no new home children; the only home difference was the
pre-existing 40-byte same-SHA Chrome settings mtime touch, preserved. The
corrected diagnostic writes rows/images before rejecting exactly the same
failed controls. A pixel-only retry admitted at `01:26:14.155299Z` but its
timing guard refused to start inside the original `01:28:08.336784Z` heavy
cutoff. It automatically released at `01:26:31.841015Z`; no pixel retry ran,
all tracked bytes matched before/after, and its 31-entry home scope was
unchanged. The original `01:33:08.336784Z` release bound was not extended.

The next stage reuses the admitted source/tools and these native outputs,
freshens actual main/source/resource admission, and runs the retained-row
public-renderer discriminator with enough bounded time. Keep all nonempty
controls; persist failed measurements rather than treating a missing exposed
circle as a passed test. Source is still ledger-only; final native membership,
meaningful pixel proof, implementation, checks/built/full acceptance,
publication/deployment/reaction and final cleanup remain pending.

### 2026-10-04 — short loan: retained supported cases and one failed control

The one new loan acquired at `02:59:06.329286Z`, with explicit heavy cutoff
`03:06:03.487384Z` and release bound `03:11:03.487384Z`, at most twelve
minutes from acquisition including cleanup. The minimal 122,880-byte ledger
delta reconstructed exact `bcf1414d` / tree `dac4557b`; all 7,256 tracked
bytes and index matched before and after. Existing private tools/dependencies
and the prior 25 native ranges were reused. Only eight missing native ranges
ran, exit zero at `02:59:19.702584Z`.

The real public WebGL renderer retained all 76 rows and seven representative
images before rejecting the sole `statue-exposed-control` at `(1140,860)`.
It exited one at `02:59:31.840892Z`. Both current and native-parameter
circle contributions are zero at that point despite nonempty isolated masks;
the alleged exposed comparison is unsupported. Its precise coverage by other
late artwork still needs measurement. This is not a whole-scope meaningful
red or passed diagnostic. Browser, HTTP and request errors are empty.

The supported rows remain useful independently of that failed control:

| Supported case | Actual nonempty masks and observation | Same-art ground reference |
| --- | --- | --- |
| Tent `(1397,664)` | Source alpha 1,147 pixels, opaque wizard 1,576, opaque tent stack 23,386. The current body-owned circle changes 341 opaque stack pixels, maximum RGB difference 135. Actor depth 1012 is after tent stack 1011. | Zero opaque stack/body changes; the fully covered ground glyph correctly contributes no exposed pixels at this overlap. |
| Tent exposed `(1520,684)` | Same real glyph changes 340 exposed pixels; the native-parameter reference changes 385. Opaque stack/body changes zero. | Positive visible-ground control is supported; masking all circles to hide the bug would fail it. |
| North arch: 25 samples plus exposed `(1100,215)` | Opaque arch changes zero across the current samples. The exposed control changes 298 ground pixels, native-parameter reference 200; all three isolated masks are nonempty. | Current disappearance on covered artwork is not proof of a dropped source or a need to draw shadows over the arch. These rows do not establish every arch/state branch. |
| Statue `(1050,765)` | Source alpha 1,147, opaque wizard 1,576, opaque statue 17,536. Ordinary circle contributes 323 exposed pixels. College 41 at actual depth 1014.75 multiplies all 1,576 opaque wizard pixels, maximum RGB difference 171; wizard is at 1014 and statue body at 1015. | Moving only the unchanged College-41 pass into the native ground interval changes zero opaque wizard pixels, maximum difference 1; exposed ground remains present. |
| Statue positive `(1080,735)` | Ordinary current/native-parameter exposed contributions 317/346, source/body/statue masks 1,147/1,576/17,536; the current multiply pass affects 1,224 opaque wizard pixels. | Zero opaque wizard changes with identical authored multiply artwork in ground interval. This is a supported positive control for the next discriminator. |

Inspected current/ground PNG pairs show the darkened wizard beside the statue
and the tent-stack overlap. The supported observations separate the wizard's
BadGuys-67 circle from the statue's College-41 multiplier. They establish
body-row auxiliary ownership defects in these controlled cases, not the
historical screenshot's exact cause or final membership acceptance.

The actual row depths and the complete source at
`hub-world-scene.ts:700` also falsify the earlier stale-raw-depth assumption.
`applyPainterOrder` assigns `statueAura = statueBody.zIndex - .25` every
frame. Its constructor value is overwritten; all current guidance above now
records body-row ownership. Old task receipts preserve the superseded initial
trace as history, not a current fact. No product patch follows from that
incorrect assumption or the unsupported `(1140,860)` control.

New native instructions close several narrower questions: Player maintenance
`00533520` increments `+1BC` at `005339E7` only while `+160` is nonzero;
it queries Region `+114` at `00533F45`, writes surface value 2 at
`0053401C`, and restores 0 at `005340FE`. Courtyard and all four private
rooms resolve `+114` to `005088E0`, bytes `32 C0 C2 0C 00`, returning false.
Arena resolves it to `004677A0`; its live Terrain predicate still needs full
source/model reconciliation. Matrix helper `004030A0` stores arguments into
the diagonal X/Y/Z lanes before composition, confirming the recovered
auxiliary three-axis scale arguments. Registered College glyph helper
`004142E0` adds half logical canvas dimensions plus caller X/Y before the
quad and restores the transform afterward.

Bounded reads also disclose precise remaining gaps. The trig wrapper jumps
at `00747106` to `00752330`; the fallback after `0074710B` continues beyond
the captured endpoint, so a sin/cos semantic is not yet claimed. Registry
`005B7080` dispatches IDs above 3002 to `005B8369`; the captured prefix does
not reach the dormant NPC cases. The requested constructor start `005022A0`
was inside an instruction and is disqualified as a complete constructor read.
Already retained aligned `annalist-ground` output does contain the subsequent
Illuminator type assignment `005022A3 -> 138E` (5006); that type alone does
not prove factory reachability. Follow only these missing branches rather
than repeating the completed recovery. Casting/drive writer semantics and
supported special-surface admission must also remain explicit before porting
their state branches.

Automatic terminal cleanup released at `02:59:32.747102Z`, independently
verified with no owned processes, exact lease absent, all tracked source bytes
matching, private temp/profiles cleared and no new home children. Only the
known pre-existing 40-byte same-SHA Chrome settings mtime touch was preserved.
Parent and Report 62 received the immediate actual handoff. No second compute
attempt, product patch, main lock, full gate or publication was performed.

The next minimal discriminator must preserve the rejected row and identify
its actual late-art coverage; use the already nonempty `(1080,735)` row as a
separate positive control. Keep nonempty controls and supported-case evidence
distinct from whole-test acceptance. All extractable applicable native gaps,
per-member/built acceptance and the report's later delivery gates remain open.

### 2026-10-04 — recovered terminal coverage and native ownership correction

The bounded phase admitted exact `53493bc8` / tree `129c447a`, clean index
and all 7,257 original tracked-file bytes on published `3c32f09c`. Its three
actual stages completed: owned-PGID cleanup preflight zero at
`08:41:31.468071Z`, five missing native reads zero at `08:41:32.433927Z`,
and real public WebGL late-art coverage zero at `08:42:00.852788Z`.
Automatic cleanup released at `08:42:02.343867Z`, before the worker's
`usage_limit_exceeded` terminal at `08:42:10Z`. The usage error does not
erase these completed results. Parent recovered the final receipts and
independently observed no owned process or lease. No diagnostic was replayed.

The replacement M2 continuation copied only the five existing native text
outputs and sixteen retained PNGs. Every byte count and SHA-256 matches the
completed native/pixel receipts; all sixteen images were directly inspected.
The original Discord message was freshly rechecked under the authorized
account: same wording, null edit timestamp, same three attachments, and an
eight-message surrounding window with no related correction or withdrawal.

| Controlled current-source case | Measured source and actual late-art coverage | Causal result |
| --- | --- | --- |
| Previous failed `(1140,860)` | Source alpha 1,150 pixels; opaque body 1,573; opaque statue 17,574. All 1,150 source pixels overlap opaque southern-bank art; foreground overlap is zero. | Original source contribution zero. Temporarily omitting only the late artwork exposes 348 circle pixels, 497 total changed pixels. Restored frame differs at zero pixels and every visible/renderable flag is restored. |
| Separate positive `(1080,735)` | Source alpha 1,147 pixels; opaque body 1,576; opaque statue 17,536; no late opaque source overlap. | 317 exposed circle pixels with or without late art, 434 total changes in each comparison. Restoration differs at zero pixels; all flags restored. |

The actual frames show the southern stone bank hiding the wizard and its
ground circle together at the previously failed point. This closes that
control's missing-coverage explanation; it supplies no reason to alter circle
geometry or make it paint over scenery. The prior failed whole diagnostic
remains failed history, while its other supported tent/statue observations
remain valid and separate. Both new controls and browser, response and
request error arrays are empty. These two controlled snapshots do not claim
complete member/state or built-journey acceptance.

The five new ranges reuse the same sealed retail executable and private LLVM
identities documented above. Their raw text SHA-256 values are:

| Native range | SHA-256 | New instruction-derived fact |
| --- | --- | --- |
| `00752330..00752600` | `b5612b607930044101b0a2f06afd349eb568764d7a84f4f745f484e2f669a4f5` | The wrapper's fast path receives the x87 argument and returns its SSE reduction/polynomial result through x87; its exceptional branch returns to `0074711F`. |
| `0074710B..00747160` | `cd86ba65a75b428ab38734956bfd5b4248947d64f9ec4b367759e17b3b9a9aa1` | Fallback `0074713D` executes `fsin`. Together with the previously captured wrapper, this identifies the common finite game-phase wave as sine, rather than cosine or a guessed waveform. Exceptional math-library branches outside the bound are not game-phase behavior claims. |
| `005B8369..005B8900` | `026195c0bb1697db407604e9306352ac1c76c06f7be9171453efe7895cbd679f` | The later NPC family dispatch at `005B8848..005B8856` subtracts 5002, admits indices 0..22 and jumps through `005B9774`. The fixed range ends before all target constructors and does not by itself close dormant reachability. |
| `0046791E..004679B0` | `72b43421b04c4b95fcf74a214ea63a12307b5f8c4a742ebf5243cd1c4be29ac7` | The retained Arena prefix now reaches both terminal returns. After bounds check, the final branch tests local coordinates against the terrain record at `0081BD20 + 60*(selector-25)` through `00405160`; true returns one and optionally writes zero to the supplied byte pointer. Failed/exhausted membership returns zero. Terrain identity and maintained admission still need reconciliation. |
| `00533350..00533520` | `b6d9a2b38feb433f4ba1365d1d0b43e99b45c88156d5e33a6abf68d34381fd89` | This cleanup routine directly changes `+208/+20C/+210`, releases the identified companion and matching type-2058 transient objects, and clears the `+214/+216` identity. It contains no direct `+160/+1BC` write. The shown call cannot justify inventing a drive-timer reset. |

Re-reading the complete existing player tick instructions also falsifies a
previous task-note inference about `0054B4F8`. At `0054B39A`, the current
player in ESI requests factory type `07EE` (2030), and `0054B3AF` assigns
that new result to EDI. `0054B4F8` writes `[EDI+160]` from the global
`00819E54` zero predicate; it does **not** write PlayerWizard `[ESI+160]`.
The retained `refs_dat819978.log` decompilation independently agrees on the
separate allocated owner. Calling this a PlayerWizard primary-cast producer
or evidence that its death timer runs during casting is withdrawn. Existing
PlayerWizard maintenance still increments `+1BC` only when its own `+160`
is nonzero. Close the owning PlayerWizard transition/caller before selecting
an authoritative shadow lifetime field; do not reuse the Website light-drive
union solely because of its name.

The sine semantic now supports completing the previously recovered statue
amplitude-five/additive-component formula. The current `-2*sin` and
direction-vector multiplication are superseded approximations, but no product
change or complete member disposition is claimed in this continuation.
Misaligned `005022A0` remains disqualified; the aligned constructor evidence
and the withdrawn stale constructor-depth theory remain unchanged. M2 retained
text/source reconciliation continues before any new resource request.

The retained full factory export
`ghidra_outputs/factory_7e2_20260414.txt:1151..1160` closes Illuminator's
compiled reachability: case `138E` (5006) allocates `174` bytes and calls
the already aligned `00502270` constructor. This is factory reachability,
not a live survival population claim. The same retained export maps `139E`
(5022) to `00503000`, and `13A0` (5024) to `00502B20`. The independent
retained `actor_1391_1392_cluster_20260415.txt:321..345` assigns that latter
constructor `ArchChancellorStanding::vftable` and type `13A0`. Actual
alternate population instructions `00513F5B..00513FA3` require story phase
one, request `13A0`, and register the returned actor. Standing therefore has
an established story construction path; entries 194/201 retain the maintained
survival boundary. Its recovered record-67 auxiliary remains documented
without adding a standing actor to the seated Office presenter.

Case `1393` (5011) instead calls `0050B4F0`, and the captured alternate
builder requests it at `005142BC`. Do not call this Annalist2, Standing, or a
dormant ground caster before binding its actual constructor/vtable. The
existing Annalist2 story census in entries 118/194/201/204 and its known
`00503060` auxiliary are retained; its exact `00503000` constructor link
remains an explicit small gap. Bounded range absence is not a full producer
census.

Arena's first surface-query path owns Terrain grid `+8F24` with bridge/hole
exclusion; the final path owns compact grid `+8F84`. Entry 091's complete
mask census supersedes the old entries 090/106 shorthand: authored selectors
25..29 and dynamic DeadSpider records are active compact producers, while
all twelve native survival templates have zero Terrain rows. Current
`NativeCompactMaskView` already consumes all five authored selectors and the
replicated Spider decal. Reuse these memberships and authored data when
closing the ordinary auxiliary's surface predicate; no water-only admission
or always-false Arena surface branch is justified by the absent Terrain rows.

The M2 preparation now bounds five genuinely new native targets: direction
helper `00410500`, contour predicate `00405160`, Terrain predicate
`004118B0`, constructors `00503000` and `0050B4F0`; plus the complete
five 60-byte compact contour rows at `0081BD20` and 23 NPC dispatch entries
at `005B9774`. A direct-store byte-pattern census for `+160/+1BC` supplies
candidate addresses only, not aligned instructions, ownership, an exclusive
writer set, or a casting/death conclusion. Only missing owning/caller context
may need a subsequent bounded read. Existing 38 native ranges, 76 qualified
renderer rows, and the passed two-point coverage are reused. This preparation
has not executed; no product patch, new M5 grant, acceptance, or publication
is claimed.

### 2026-10-04 — native-only partial failure; five retained functions recovered

The new one-phase clock was fixed at `16:12:22.930464Z`, heavy cutoff
`16:19:22.930464Z`, release bound `16:24:22.930464Z`. Actual lease acquisition
was `16:12:23.957625Z`. Fresh scoped Discord source remained unchanged,
current main remained `3c32f09c`, and exact `8e47b5fd` / tree `20a48a8d`,
clean index and all 7,257 original tracked-file bytes admitted at
`16:12:35.846949Z`. The automatic supervisor started before minimal staging.
Only the sixty-second `only-final-native-gaps` stage ran; no old native range,
pixel/preflight, Node/Chrome, Website, publication or main-lock stage ran.

All five new function commands returned zero and wrote their text outputs.
The containing stage then failed one at `16:12:36.100840Z` with
`Unmapped native data 0081BD20+300`. The 300-byte read, following 92-byte NPC
table and direct-store census did not produce data or a receipt. Neither a
whole diagnostic pass nor a completed census is claimed. The five retained
texts were copied read-only and individually hashed on M2 after release;
the sealed binary/private LLVM identity checks preceded all five commands.
Command/range/hash provenance is in the partial function readback receipt.

| Retained function | Raw text SHA-256 | Supported instruction result |
| --- | --- | --- |
| `00410500..00410720` | `351ac6f914a3fb9945e65ae2a1b2a3d5a05ad32d2dc40ba21e04490e02f99cf6` | Completed direction helper `00410500..0041054C` forms a float32 angle from `[Math+4]*degrees/180`; X calls the now-proved sine `007470D0`, Y calls `00748330` and negates its float32 result. The X direction is not the current cosine-based component. The second callee and Math-field producer remain to establish before claiming a complete numeric replacement. |
| `00405160..00405500` | `d0e8da55be3b585e7a98ae251c0187ec5b377ca6582d14e45b5040fac0be3019` | Completed contour predicate ends at `00405432`. Its object owns a point-buffer pointer at `+4` and count at `+38`; counts below two reject. The edge walk uses strict Y-side and X-intersection parity comparisons, without a guessed hull or epsilon. The five 60-byte objects are not five coordinate arrays; their producer and pointed-to authored buffers must be recovered. |
| `004118B0..00411B00` | `bf1133b094f1df0e9ed8875e31061a706ea3a4e61695b77696aff766b9441a7f` | Completed quad predicate `004118B0..004118EB` calls captured triangle helper `004119C0..00411A6B` for `(p0,p1,p2)`, then `(p1,p3,p2)`, using four XY records at offsets 0/8/16/24. Its return is their triangle-membership union. Arena's already captured bridge/hole exclusion and current scene admission still belong to the owning query. |
| `00503000..00503060` | `8f7d3de79de374985af51aa572a7788a6b0b7530d81de54838f1af2f6ea726a1` | Constructor `00503033` assigns vtable `00791EB4`; `00503039` assigns type `139E` (5022); it returns at `00503058`. Retained RTTI now conclusively binds the full factory case to Annalist2. Its documented story-only census and absent maintained producer support `out-of-system` for this Website auxiliary consumer, while its exact record-67 native contract is preserved. |
| `0050B4F0..0050B720` | `b195fd8bd84f3e3eb1a710103ef35d18026dcaa2b7ab05a13660539d062b23d7` | Constructor `0050B52E` assigns vtable `00792DB4`; `0050B54A` assigns type `1393` (5011); it returns at `0050B633`. Retained RTTI binds this to Polisher. Its `+1BC` write at `0050B5DA` is float zero in that separate Polisher object, not a PlayerWizard timer reset. |

The earlier preparation's unbound 5011 row is therefore closed as Polisher,
already in the affected inventory. Current `HubPrivateRoomScene` owns its
conditional Office body/marker and `createHubPolisherClock(... ^ 5011, ...)`;
its ground callback `00502980` remains `recovered-pending-port`. The older
interaction census's story-only description does not remove a presenter that
the maintained Website currently admits. Preserve the existing Office policy
and visibility lifetime when adding its native record-67 ground owner.
Annalist2 and Standing retain their reasoned unsupported-story dispositions;
Illuminator's compiled factory reachability is established separately from
any current Website population. No new NPC is invented from a factory case.

The failed reader requested a fixed 300-byte file-backed span for `0081BD20`.
That span did not map under the sealed PE's actual section/raw bounds. Do not
fill it with zeros, call a header/pointer dump an extracted contour table, or
repeat the unchanged raw read. Follow the contour object's construction and
its point-buffer producer. The unproduced store census remains no evidence
at all; the EDI/type2030 ownership correction and PlayerWizard `+160/+1BC`
mapping uncertainty are unchanged. A distinct future missing-producer/callee/
census slice must reuse all 43 retained ranges and prior controlled pixels.

Automatic terminal cleanup released at `16:12:36.625678Z`, with PGID57467
fully drained, no unresolved groups/processes/cleanup errors, all 31 scoped
home entries unchanged, no new home children, private TMP/profile clear,
source-after error null and exact lease absent. Every original tracked byte
still matched the admitted tree at `16:12:36.624915Z`. Parent received the
actual handoff before M2 interpretation. This phase closed on failure despite
unused clock time; no second attempt, clock reset or extension followed.
The actual failure and all partial outputs remain retained. Report56 remains
unfinished; no product fix, full member/built acceptance or publication is
claimed by this receipt.

### 2026-10-04 — producer slice completed; cosine and complete NPC dispatch

The new clock was fixed at `20:29:52.607174Z`, heavy cutoff
`20:36:52.607174Z`, release bound `20:41:52.607174Z`. Fresh original/source,
mounted SSD, known pipeline/compiler absence, released own root and sealed
executable/private LLVM identities passed. Atomic acquisition was
`20:29:53.304316Z`. Exact `f4dffc4d` / tree `512996f3`, clean index and all
7,258 original tracked-file bytes admitted at `20:30:03.004498Z`. The only
stage, `only-new-native-producer-candidates`, ran `20:30:03.006690Z` through
`20:30:03.258381Z`, exit zero. It retained one new function, the unreached
92-byte NPC table, 74 direct-store byte candidates and 1,101 absolute-word
candidates. No failed300 span, old43 ranges, pixels/preflight, Node/Chrome or
Website command ran. Success of this finite slice is not complete recovery.

The retained `00748330..007484E0` text hash is
`4173be53d61d11620c4852eecf846c9d130da5dd3714fc143fa51e124caab47e`.
It executes `fcos` at `0074839D`, with another at `007483D4` after argument
reduction. The shared direction helper therefore returns float32 sine for X
and negated float32 cosine for Y. This refutes the current component ordering.
Math+4 initialization is still a separate scalar question; byte words near
`004100D8` are not decoded proof. Retained startup `0040C690` independently
calls aligned `004100D0` (`ghidra_decomp_darkcloud_owner_funcs.log:419`),
providing its next genuine entry. The SSE numerical implementation is not
claimed bit-identical to browser math from fallback semantics alone.

Complete NPC table `005B9774`, SHA-256
`8e90f8e31826104cd5e5febe3c4203c8229d90dc1067308d636f8cfcc8aed2bf`:

| Type | Target | Type | Target |
| --- | --- | --- | --- |
| 5002 | `005B8A2D` | 5014 | `005B95E5` |
| 5003 | `005B8A67` | 5015 | `005B8CAB` |
| 5004 | `005B8ADB` | 5016 | `005B89F3` |
| 5005 | `005B8B4F` | 5017 | `005B897F` |
| 5006 | `005B8AA1` | 5018 | `005B89B9` |
| 5007 | `005B8B15` | 5019 | `005B8BFD` |
| 5008 | `005B8B89` | 5020 | `005B8C37` |
| 5009 | `005B8BC3` | 5021 | `005B8CE5` |
| 5010 | `005B8C71` | 5022 | `005B8D1F` |
| 5011 | `005B885D` | 5023 | `005B88D1` |
| 5012 | `005B8897` | 5024 | `005B890B` |
| 5013 | `005B8945` | | |

All23 entries, including default5014, are retained. Combine them with the
already recovered factory/constructor links; a target alone adds neither a
current population nor a ground caster.

Actual PE metadata proves `.data` begins at `00804000`, virtual size3,398,208,
raw size88,576: file-backed bytes end at `00819A00`. Both five contour objects
`0081BD20..0081BE4C` and Math globals `00B40278/+4` are runtime zero-fill
locations whose initialized contents require their producer. They are not
file coordinate rows. Operand leads cluster at `005C328E..005C3828`, with
array construction/destruction leads `0078212F/007835AA`; they remain
unaligned until canonical boundaries/callers establish actual instructions.
Do not dump zeros, derive a hull, or repeat the known failed raw span.

The store census matched qualified resets `0052A45B/0052A597`, timer reset
`0052A5AF`, death writes `005341B7/005344E0` and separate type2030 write
`0054B4F8`. New neighborhood candidates are `0053DBAC`, `0053E5CC`,
`0053ECE3`, `0053F31C`, `0053F8FD`; neighborhood and byte patterns are not
PlayerWizard ownership or exclusive-writer proof. Existing canonical entries
`0053CFE0`, `0053DC60`, `0053E6A0`, `0053EDB0`, `0053F3C0`, followed by
`0053F9C0`, bound new context reads; the retained Air contract contains the
corresponding dispatch family. Existing animation/death documents corroborate
terminal+160/+1BC while separating queued actions, but the contradictory old
cast-drive shorthand still needs owning-instruction reconciliation.

Automatic release was `20:30:04.243012Z`: PGID77067 drained, process/group/
error arrays empty, all31 home entries unchanged, no new children, TMP/profile
clear, source-after exact at `20:30:04.238870Z`, lease absent. Parent read and
independently accepted the full release before M2 interpretation. This one
phase closed despite unused time; no reset, extension or second attempt.
The16:12 failure and all its valid partial functions remain preserved.
Initialized contours/Math scalar and player-owning contexts remain to prove;
no product fix, final member acceptance or Report56 completion is claimed.

### 2026-10-04 — owning contexts passed; exact scalar and allocated-object owners

The distinct owning-context clock began at `22:12:21.095058Z`, with heavy
cutoff `22:19:21.095058Z` and release bound `22:24:21.095058Z`. The original
Discord message and three attachments remained unchanged; actual published
main was `59443b078bf72ee729b4cf982933d8fa236aa605`. Fresh mounted-SSD,
global pipeline/compiler, own-root release and executable/private-LLVM checks
preceded atomic acquisition at `22:12:21.708447Z`. The proved supervisor
started before the one-ledger delta was staged. Exact `0e23029d` / tree
`e4645838`, clean index and all 7,258 original blobs admitted at
`22:12:31.099776Z`. Sole stage `only-new-native-owning-contexts` ran
`22:12:31.105292Z` through `22:12:31.297701Z`, exit zero. Seven genuinely new
contexts and 89 typed file operands were retained; none of the old44 ranges,
tables, byte censuses, pixels, preflight, Website or browser stages replayed.

| New retained context | Raw text SHA-256 |
| --- | --- |
| `004100D0..00410300` | `b072f3f844a5caf2ca0598c8bc979b1ac7cd2a72de1ea32b272ba67ad74876f1` |
| `0053CFE0..0053DC60` | `75293eb4ffd4be19dbeb4147dd88b3ea71e01bdfc2a552037e8a08c964fe010c` |
| `0053DC60..0053E6A0` | `2fd73714b7c753b3adefa33774348c6bddecc0ff579bfd2b0c83a097094f386e` |
| `0053E6A0..0053EDB0` | `f772da8e33d9fa0842dad57878209bc41d634a66f2f09ed62ebe8b49d320c9c0` |
| `0053EDB0..0053F3C0` | `ec556a6d83722760a20a85706f97c3ca0017f427495f95124bf411767312db15` |
| `0053F3C0..0053F9C0` | `92a46f462e06d624e104a32afc77d490db1df83d9ee2698138d9c2d7d3d9ebda` |
| `005BDB50..005C38F0` boundary discovery | `c57ea6ef8292322d89f70070ac0019082ff3aab61f9cf24b0d41ad7e5fafcfaa` |

`004100D0` loads float32 `[007DE8A8]`; `004100D6` stores it into Math+4
at `00B4027C`. The independently captured file bytes are `da 0f 49 40`,
exactly **3.141592502593994**. This is neither JavaScript `Math.PI` nor
`Math.fround(Math.PI)`. Combined with the already completed `00410500`
helper and proved sine/cosine callees, the native direction uses
`theta = float32(nativePi32 * degrees / 180)`, then stores float32 sine to X
and negated float32 cosine to Y. Its explicit angle/result stores belong to
the contract; fallback semantics do not claim browser/SSE bit identity. The
separate Math+0 epsilon loop is not the angle scalar. Retained startup
`0040C690 -> 004100D0` corroborates this initialized-global ownership.

The five new store neighborhoods now have actual canonical instruction and
register ownership. The factory call is `005B7080` in every row:

| Entry; current actor register | Factory type push / call | Returned object binding | Captured `+160` store |
| --- | --- | --- | --- |
| `0053CFE0`; ESI at `0053D00D` | 2003 at `0053DA40` / `0053DA4A` | EDI=EAX at `0053DA52` | byte `[EDI+160]` at `0053DBAC` |
| `0053DC60`; ESI at `0053DC87` | 2004 at `0053E4EE` / `0053E4F8` | EDI=EAX at `0053E500` | dword `[EDI+160]` at `0053E5CC` |
| `0053E6A0`; EDI at `0053E6B2` | 2014 at `0053EB90` / `0053EB9A` | ESI=EAX at `0053EBA2` | byte `[ESI+160]` at `0053ECE3` |
| `0053EDB0`; EDI at `0053EDC2` | 2015 at `0053F1C7` / `0053F1D1` | ESI=EAX at `0053F1D6` | byte `[ESI+160]` at `0053F31C` |
| `0053F3C0`; EDI at `0053F3D2` | 2016 at `0053F7B6` / `0053F7C0` | ESI=EAX at `0053F7C8` | byte `[ESI+160]` at `0053F8FD` |

No direct rebinding of the returned object's callee-saved register intervenes
before its captured store. These are separate allocated objects, not writes
to the current PlayerWizard. The prior EDI/type2030 correction remains in
force. The unaligned pattern census still supplies candidates only; this
scoped recovery does not establish an exclusive writer set or exclude alias,
indirect or uncaptured writes. In particular it supplies no evidence that
primary casting sets PlayerWizard's own `+160`.

The already captured PlayerWizard path establishes its own terminal use
without those false ownership assumptions: `0052A597/0052A5AF` reset its
drive/timer; canonical death receiver ESI at `00534147` owns both
`005341B7/005344E0` writes of drive=1. Tick `005339D4..005339E7` increments
own `+1BC` only while own `+160` is nonzero. Auxiliary `00528AD4` binds its
current actor, rejects consumed `+1C0`, and selects its distinct terminal
vector path only when own drive is nonzero **and timer >150**. The ordinary
ground glyph still draws through timer150. Existing animation/death evidence
corroborates the terminal mapping and separates queued casts. The current
`lighting.driveActive` contract also includes primary casting, so that field
must not be adopted as this ground auxiliary's eligibility solely by name.
Its light-system behavior and the separate corpse layers remain outside this
Report56 ownership correction.

The broad new window discovers the enclosing producer at actual prologue
`005BF6A0` (`sub esp,20h; push esi; mov esi,ecx`). Its continuous captured
body reaches the contour setup at `005C3280` and ends in tail paths
`005C38E2 -> 005B6C90` or `005C38EB -> 005A7D90`. Retained MyApp vtable
`0079A004`, slot `+C4`, independently corroborates `005BF6A0`; this is not
a new exhaustive caller census. Runtime objects remain distinct from raw
file bytes. The 89 typed operands and an M2 symbolic FPU/stack trace recover
the following **outgoing call arguments only**:

| ECX object | Ordered `(esp,esp+4)` pairs passed to `00404620` | Final pair passed to `00404930` |
| --- | --- | --- |
| `0081BD20` | `(26,21),(52,9),(91,40),(82,58),(59,67),(45,83),(26,88),(5,72),(13,52),(36,43)` | `(-50,-46)` |
| `0081BD5C` | `(41.5,28.5),(51.5,51.5),(32.5,68.5),(5.5,36.5),(17.5,7.5),(33.5,5.5)` | `(-28,-37)` |
| `0081BD98` | `(47.5,4.5),(88.5,23.5),(97.5,42.5),(91.5,61.5),(55.5,80.5),(9.5,66.5),(8.5,35.5)` | `(-50.5,-42.5)` |
| `0081BDD4` | `(43.5,44.5),(6.5,27.5),(7.5,10.5),(23.5,9.5),(41.5,3.5),(66.5,20.5),(64.5,38.5)` | `(-36,-24.5)` |
| `0081BE10` | `(104.5,1.5),(143.5,10.5),(185.5,44.5),(214.5,105.5),(208.5,142.5),(147.5,205.5),(106.5,216.5),(43.5,199.5),(16.5,169.5),(0.5,109.5),(34.5,38.5)` | `(-108,-108.5)` |

The trace follows all46 calls and preserves `fst` without popping at
`005C3409`; both arguments to that call are 51.5. These are not yet final
vertices, ordered point-buffer contents, or a proved translation. Exact
`00404620` and `00404930` callee bodies remain necessary to establish
mutation/count/buffer behavior. Retained catalogs identify their canonical
entries and field hits through `00404691` / `00404995`, but existing retained
files contain no callee bodies. A distinct two-callee read is the remaining
native evidence slice; all51 prior ranges, typed constants, tables, qualified
pixels and failure receipts are reused. No unchanged 300-byte span is retried.

Automatic release completed at `22:12:32.345901Z`. Source-after matched
every original byte at `22:12:32.345017Z`; process/group/error arrays were
empty, all31 home entries unchanged, no new children, private TMP/profile
clear and exact lease absent. Parent accepted the full receipts and
independently verified clear resources at `22:19:17Z` before this M2-only
interpretation. All seven text hashes match their retained receipt; derived
owner and call-argument receipts preserve raw instruction/value provenance.
The fixed clock closed at release despite unused time. No extra attempt,
extension, new M5 grant, product change, final acceptance or publication is
claimed. The16:12 partial failure, earlier usage error and prior qualifications
remain preserved.

### 2026-10-04 — two callee reads passed; complete translation, partial append

The distinct grant bound actual turn `01a1091f-4cda-79b3-8fcd-fed9eb9accda`
and attempt `report56-retry-1791154375-5e9bb71f`. Fresh original plus eight
nearby messages were unchanged at `22:57:17.407308Z`: null edit, the same
three attachments and no related correction. Actual published main remained
`59443b0`; all frozen helper/package identities matched. Fresh SSD/source/
native/private-LLVM/global pipeline/compiler/CI/lease checks passed before the
clock. LLVM's expected symlink resolves inside the owned SSD tools tree with
the pinned hash; a manual read-only no-symlink assertion was corrected before
any clock, admission, staging or native attempt. Frozen helpers were unchanged.

Clock preparation was `23:01:52.088284Z`, heavy cutoff
`23:08:52.088284Z`, release bound `23:13:52.088284Z`: twelve minutes total
including five cleanup minutes. Actual atomic acquisition was
`23:01:52.850662Z`; supervisor25338 started before minimal staging. Exact
`edf00e22` / tree `f2002da8`, clean index and all 7,258 original tracked-file
bytes admitted at `23:02:04.324229Z`. Sole sixty-second stage
`only-new-native-contour-callees` / PID and PGID25377 ran
`23:02:04.326189Z..23:02:04.516567Z`, exit zero. It retained exactly the
two reviewed ranges; old51 ranges/tables/censuses/pixels/preflight/Website
did not replay. Success of this bounded extraction does not make an
incomplete function body complete.

| Actual retained text | SHA-256 | Semantic coverage |
| --- | --- | --- |
| `00404620..004046A0` | `b0dde312e62b06ad313fddfd2b0563e7d6f45491c95618b66d9e89d5cfc2232b` | Partial append prefix. Last instruction starts at `0040469E`; target `004046A8` and the return/tail lie outside the capture. |
| `00404930..004049B0` | `c6d3969b121f661f067022f37b804b4fcb252fdac5048194214a609277171f62` | Complete translation body, including `ret 8` at `004049A1` and following padding. |

`00404930` loops over unchanged count `+38`. For each index it adds outgoing
argument X to X and argument Y to Y in **both** point buffers, at object `+0`
and `+4`, with explicit float32 stores at `0040496A/76/83/93`. It preserves
the list order and does not write count/capacity. Its `+8..+14` cache reset is
separate from the point arrays; no guessed value is assigned to the additional
`007DE858` cache scalar. The already completed `00405160` membership reader
consumes `+4` and `+38` with its strict parity comparisons. This closes the
five final-pair **translation operation**, not the initialized vertex lists.

The append prefix binds receiver ESI at `00404627`, increments count `+38`
at `00404629`, and compares it with capacity `+34`. On growth it calls actual
entry `00404E20` at `00404639`, passing `2*newCount+1`. The following visible
stores address record `newCount-1` and place the two incoming float32 values
in both buffers. The capture then ends after `fld [eax]` at `0040469E`.
Do not infer the missing tail, a complete return path, growth preservation of
older points, or starting count zero from that prefix. No final polygon table
is claimed yet, despite all outgoing arguments and translation being known.

The remaining bounded semantic slice is the append continuation, actual
growth callee, and constructor/reset evidence for initial count and buffers.
Canonical `004045A0` is retained in the Ghidra function catalog and existing
callers; the `0078212F` global-object word context remains qualified as an
unaligned candidate until actual construction instructions/callers establish
its role. A necessary instruction overlap may join incomplete control flow;
reuse the prefix and complete translation rather than replaying them wholesale.
Use actual boundaries and enough extent to close branches/returns, including
any directly shown construction helper required by that context. No new read
or clock is authorized by this M2 preparation.

Automatic release was `23:02:05.500712Z`, source-after-finally exact at
`23:02:05.499923Z`. PGID25377 drained; owned processes/unresolved groups/
cleanup errors/home changes/new children were empty, all31 home entries
unchanged, TMP/profile cleared and exact lease absent. Fresh own metadata
at `23:07:34.230178Z` independently found supervisor25338 and stage25377/
group absent, source clean `edf00e22/f2002da8`, empty private TMP/profile
and lease absent. Both text hashes match. Full release/source/native receipts
and handoff were sent to parent before M2 interpretation. This phase closed
despite unused time; no second attempt, reset or extension followed. Actual
retained M5 baseline is now `edf00e22/f2002da8`. Earlier failures, usage error,
original evidence and all qualified observations remain preserved. Report56
is unfinished; no product change, final contour coordinates, current-source
acceptance or publication is claimed.

### 2026-10-05 — contour construction recovered; exact authored surface rows

The new distinct phase bound turn `01a1094c-da8f-7802-a186-f05e748dd46d`
and attempt `report56-retry-1791157351-ff85e974`. Fresh original/source,
frozen helpers/package, mounted SSD, sealed native/private LLVM and actual
global build/compiler/CI/lease checks passed. Original plus eight nearby
messages were unchanged at `23:45:42.744807Z`. Clock preparation was
`23:48:11.072076Z`, heavy cutoff `23:55:11.072076Z`, release bound
`2026-10-05T00:00:11.072076Z`: twelve minutes including five cleanup minutes.
Atomic acquisition was `23:48:12.090209Z`. Supervisor33361 preceded staging;
exact `aaa677ee` / tree `85e2a311`, clean index and all 7,258 original bytes
admitted at `23:48:23.029897Z`. Sole sixty-second construction stage,
PID/PGID33399, ran `23:48:23.031815Z..23:48:23.224095Z`, exit zero.

It produced the four fixed missing contexts and the fifth helper only after
validating padding/push bytes and actual decoded `00782133 -> 0074798E`.
The two-byte instruction join is the only old53 overlap; complete translation,
append prefix, tables, censuses, pixels/preflight and Website were not replayed.

| New retained context | Text SHA-256 | Closed control-flow evidence |
| --- | --- | --- |
| `0040469E..00404930` | `454b3a4d23b9a612701c8b8cb7c7031a5e32e10caacf12e91b88e9610436d7ef` | The joined instruction matches the retained prefix; append ends at `ret 8`, `004046C9`. |
| `004045A0..00404620` | `c189a90d8ffe18988fb5fb46e2180bc5ad158de493cadad1b8a95071034c3d00` | Both constructor returns, `004045F6/0040460C`, initialize count/capacity zero and both buffers null. |
| `00404E20..00405160` | `ed93e338ef188cf6dee9ff3735c0f9512dacba42bedaa04e46ed4e9f43284fe8` | Actual growth completes at `ret 4`, `00404F39`; subsequent contexts include the known next entry. |
| `00782120..00782180` | `3cca7b480c46e970e0dfbb8db191fec2df8c5dcaa0dfe6b0685356f79ae89800` | Actual five-object construction call ends at `00782143`; its constructor callback/base/stride/count are decoded. |
| `0074798E..00748330` | `d98d82607ddaf8962cb1c3b38be26e1a1e682c22213a314829bbad24ad0c5808` | Construction loop and normal return `007479D8`, plus its success cleanup return `007479F2`, are complete. |

Constructor `004045A0` explicitly clears capacity `+34`, count `+38`,
buffer `+0`, buffer `+4` and field `+30` on both return paths. Global
initializer `00782120` pushes destructor `00404610`, constructor `004045A0`,
count5, stride `3C` and base `0081BD20`. The actual `0074798E` helper calls
the constructor with current element in ECX at `007479B2`, advances by
the supplied stride at `007479B5`, and repeats from zero through count-1.
Its normal-success cleanup does not destruct the constructed elements.
This establishes the five object identities and initial empty lists from
instructions; it does not substitute file-zero bytes for runtime objects.

The actual growth helper receives the owning object in retained **ESI**, not
ECX. It allocates and zeroes two arrays of eight-byte XY records, copies each
old-capacity record at the same increasing index into the corresponding new
buffer, releases the old buffers and writes new capacity at `00404F32`.
It does not change count. This is the normally successful allocation path;
no live allocator or out-of-memory outcome is claimed. Append's complete
tail copies the new pair into the corresponding original buffer, resets only
the separate `+8..+14` cache and returns. It neither reorders points nor adds
another count increment or point transform. Unknown `007DE858` cache scalar
is not needed by the already complete `+4/+38` membership reader.

Combining this construction with the retained ordered call arguments and
complete float32 translation yields these **exact authored construction
results**, not a live memory dump. All values below are exactly representable
float32 values; authored order and implicit closing edge are preserved.

| Selector / object | Count / final capacity | Ordered translated XY vertices |
| --- | --- | --- |
| 25 / `0081BD20` | 10 / 21 | `(-24,-25),(2,-37),(41,-6),(32,12),(9,21),(-5,37),(-24,42),(-45,26),(-37,6),(-14,-3)` |
| 26 / `0081BD5C` | 6 / 9 | `(13.5,-8.5),(23.5,14.5),(4.5,31.5),(-22.5,-.5),(-10.5,-29.5),(5.5,-31.5)` |
| 27 / `0081BD98` | 7 / 9 | `(-3,-38),(38,-19),(47,0),(41,19),(5,38),(-41,24),(-42,-7)` |
| 28 / `0081BDD4` | 7 / 9 | `(7.5,20),(-29.5,3),(-28.5,-14),(-12.5,-15),(5.5,-21),(30.5,-4),(28.5,14)` |
| 29 / `0081BE10` | 11 / 21 | `(-3.5,-107),(35.5,-98),(77.5,-64),(106.5,-3),(100.5,34),(39.5,97),(-1.5,108),(-64.5,91),(-91.5,61),(-107.5,1),(-73.5,-70)` |

There are41 vertices. Capacity grows from zero at new count1 to3, at4 to9,
and, where reached, at10 to21. Both buffers have the same constructed points.
Detailed instruction/source hashes, offsets, per-point call provenance and
construction proof are retained in `CONTOUR-CONSTRUCTION-PROOF-20261005.json`.
Only this selected construction lead is now instruction-confirmed; the
remaining unaligned census is still not an exclusive writer/xref set.

The already captured Arena branch at `0046794F` computes
`0081BD20 + 60*(type-25)` and calls `00405160` at `00467969`. Its query
is float32 `(worldX-recordX, worldY-recordY)` after the separate rectangle/grid
admission. This branch applies no rotation/scale to the polygon query; do not
invent an inverse render transform or raster-alpha predicate from the visual
compact mask. Preserve its grid/rectangle admission and the separately
recovered Terrain bridge/hole and DeadSpider branches. Private College rooms
remain their confirmed false surface queries; Courtyard retains its owning
query. This closes the declared missing native contour dependencies.

Actual automatic release was `23:48:24.200606Z`, with original source-after
matching at `23:48:24.199839Z`. PGID33399 drained, process/group/error/home-
change/new-child arrays empty, all31 home entries unchanged, TMP/profile
clear and lease absent. Parent independently read the full release/source/
five-range receipt and verified clear resources at `23:50:17.208958Z`.
All five raw hashes match; full handoff preceded M2 interpretation. The phase
closed despite unused time; no extra attempt, extension or reset followed.
Actual retained M5 source is now `aaa677ee/85e2a311`.

Source porting must still honor the continuous angle in native actor `+6C`.
Current `actorHeadingFromVector` returns degrees, but `actorHeadingIndex`
rounds them to24 directions; PlayerCharacter and its codec retain only that
integer. Student already retains continuous internal `heading`/store heading,
while its published snapshot exposes only `headingIndex`. Use existing
authoritative angle ownership and preserve degree/index invariants through
all facing writers and snapshot/codec callers, rather than reconstructing a
continuous angle from a rounded index or client presentation displacement.
The ground eligibility uses the supported own terminal/consumed state;
primary-cast-inclusive `lighting.driveActive` remains a separate light contract.
No new casting/death mapping is inferred from the unaligned census.

Normal construction, scalar, callback/constructor/member and owning interval
evidence is now available for the complete shared ground port. Supported
members remain PlayerWizard, Student, statue, Hagatha including its additive
sibling, Annalist, Fomentius, Luthacus, Skorcha, Dowser, Memorator and
conditional Office Polisher, with accepted Teacher ownership preserved.
The documented dormant/negative/separate-body/light/corpse/direct families
retain their reasoned dispositions. Product changes, all member/current-
source/built acceptance, publication/live verification and both-device cleanup
remain undone. Earlier failure/usage/ownership/original evidence and every
qualified observation are preserved; Report56 is not complete.
