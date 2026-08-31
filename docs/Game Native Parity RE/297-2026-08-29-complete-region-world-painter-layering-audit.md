# 2026-08-29 — Complete Region world-painter layering audit

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
