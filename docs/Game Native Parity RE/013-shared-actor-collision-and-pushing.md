# Shared actor collision and pushing

Relevant native functions:

- `PlayerActor_MoveStep`: `0x00525800`.
- movement/collision helpers: `0x00522c00`, `0x00522b20`, `0x00522a30`,
  `0x00522500`.

`0x00522c00` and `0x00522b20` are static/hazard overlap resolution paths.
The dynamic formula is the later `0x00526520` path, which is called by the same
`PlayerActor_MoveStep` lifecycle for the player and Students when controller
flag `+0x121` is set. Students set grid/collision membership flags (`+0x36`,
dynamically `+0x37`) and separately slow near other Students.

No native evidence supports a one-off “player pushes Student” branch. The web
translation therefore needs one shared actor-body solver: both player and
Students submit intended motion, world collision constrains the same bodies,
and iterative contact resolution produces mutual displacement. The player
overpowering Students must emerge from recovered drive/speed/body parameters,
not an explicit special case.

Complete decompilation of `0x00526520` and its two separation helpers recovers
the remaining rules:

- a root movement epoch copies actor `pushStrength (+0x2C)` into
  `currentStrength (+0x4C)` and stamps recursively moved recipients at `+0x48`;
- contact candidates come from the dynamic actor grid and are culled first by
  circle AABB overlap, collision-enabled byte `+0x36`, remove byte `+0x05`,
  and the native `+0x3C/+0x40` masks;
- when the mover is not push-enabled (`+0x44 == 0`) or the move is recursive,
  or when `currentStrength < other.pushResistance`, the mover receives the
  full circle separation from `0x00521E00`;
- otherwise `0x00521EF0` computes weighted separation with exact factor
  `(distanceSquared / radiusSumSquared)^4 * 0.99 + 0.01`;
- the recipient factor is clamped from
  `currentStrength / (2 * other.pushResistance)`, with controller bounds
  `0..1`; its `currentStrength` and recursive correction are multiplied by
  that factor;
- the mover then receives its own freshly recomputed weighted separation.

The strict comparison matters: equal strength and resistance take the push
path. NPC constructors place the five fixed Courtyard characters in the same
dynamic list with resistance `90`, strength `0`, and radii `15`, `30`, `8`,
`25`, and `25`; the player cannot move them. Clean live Student values confirm
dynamic resistance at `distanceToSplineTarget / 5.5`, strength `11..16`, and
radius `12..17`, while the player has resistance `10`, strength `12`, radius
`25`. Thus a Student can nudge an idle player, but sustained player intent can
overpower lower-resistance Students without a player-only branch.

Evidence: complete decompilation and instruction stream for `0x00526520`,
`0x00521E00`, `0x00521EF0`, and `0x00521090`; live actor-list dump in
`/tmp/native-hub-collision-exact-25336.json`.

Confidence: high for shared lifecycle, comparison branch, weighting,
recipient transfer, fixed NPC bodies, and emergent player/Student behavior.
# September 21, 2026: non-pushing crowd broadphase

The archived wave-37 population contains 277 ordinary actors and 2,140
Maggots. A current-core CPU capture attributes the majority of movement work
to the non-pushing solver scanning the entire crowd for every root move.
The earlier clone-elimination fast path preserved the native solver but did
not index those repeated searches.

This representation-only boundary covers all non-pushing Boneyard roots:
ordinary enemies, living Maggots, emerging/newly materialized Maggots, and
post-manager spawns. Players and the Lantern remain indexed collision
recipients; their own pushing solver is unchanged. The existing stable grid
supplies candidate body indices in ascending source order. Every successful
correction re-queries at the corrected position, resumes strictly after the
last visited index, and never revisits earlier actors. The exact swept move,
overlap equation, coincidence/tangency comparisons, placement rejection and
floating-point operations remain in the shared kernel. Each completed move
updates the index, and appended bodies acquire a new membership immediately.
No collision, spawn, RNG, population, or gameplay rule is removed.

The unindexed path remains the reference oracle. Verification covers dense
and sparse crowds, correction across grid boundaries, rejected placement,
new actor insertion, sequential moves, and complete archived-state equality.


## October 3, 2026: fixed Hub actor prediction reopening (Report57)

The original report says the player can pass between the yellow/orange-hatted
NPC and the bench, and that escape is possible but difficult. A permanent
softlock/reset is tentative. The focused original-plus-nine-nearby Discord
read at13:46:04UTC found unchanged text, no edit, and no relevant correction
or follow-up. Preserve the reporter's name Boasticus; current NPC data calls
this annalist Provokatus. The retained clip's alcove and yellow/orange annalist
art match `HubWorldScene` registration `(895.5,455.5)`; the gameplay clip is
web evidence, not a clean stock receipt.

### Evidence and limits

- The M5-only private diagnostic source is published
  `3f130d3382bb321dd631aeb4e720ed8e5ed63d06`, tree
  `72e35c15968ec5c9cbe5d6ff3ef3d00f48cde236`, protocol145/save48. All7,254
  tracked paths match independently computed Git blob hashes. No product
  behavior changed for these observations.
- Retained attachment1554266706967269436 hashes to
  `18a4055c09d0a6e02b466479abffdf5ba617a34d4fc125d2246f7484452f82d6`.
  Actual Chrome video playback yielded16 distinct nonblack presented samples
  through7.722467seconds of the7.939366-second stream, with empty errors.
  Inspected0/3/7.7-second samples show the red-hatted player already inside
  the left fountain alcove and moving there. They do not demonstrate the
  original entry or escape, or establish a permanent softlock. This is not an
  exhaustive per-frame/input replay.
- The public `stepHubWorldTick`/`predictPlayerCharacterInHub` diagnostic uses
  normal held, released and reversed inputs from48 authored traversable
  starts, with Students disabled and Skorcha absent to isolate fixed circles
  and scenery.26routes disagree in their one-tick prediction; the maximum
  disagreement is0.9920064788410426world unit. Open-loop prediction approaches
  within2.5430942068481794units of the annalist center, whereas authority
  stays at least33.000440446502814units away. No NPC overlap occurred on any
  of these authoritative routes. Reverse input produced movement; no
  permanent-softlock finding follows. These are controlled fixture inputs,
  not recovered historical inputs.
- For north input from `(874,500)`, authority settles near
  `(874.9736147741492,481.4668540558916)`, at33.1units from the annalist.
  Open-loop prediction continues through the fixed circle and around the
  bench. The source explains this disagreement: ordinary prediction invokes
  only Region scenery movement, while authority submits fixed circles through
  the shared actor solver. Scripted College prediction already submits the
  permanent fixed circles.
- The earlier root-movement-retained/invalid-separation hypothesis is not
  reproduced by this bounded matrix. The native full-candidate placement
  contract above remains authoritative; no kernel/clamp/map/speed remedy is
  justified by these observations. Students, alternate input sequences,
  actual snapshot reconciliation and historical state are still material
  variables for the reported passage.
- The standard production build passes on this unchanged diagnostic source.
  The initial archive-only build failed because Vite requires real Git
  metadata; native Git recreated the verified same tree and original commit
  object in a private shallow detached checkout before the successful retry.
  The prepared built journey was refused by its remaining-time guard and was
  never launched. A build is not a gameplay reproduction or report acceptance.

All tools/checks ran under the exclusive M5 SSD lease,13:47:13..14:17:27UTC.
Heavy work ended14:01:02. The monitored24home entries are unchanged, no new
same-depth children or owned processes remain, and the exact lease is absent.
Release was14seconds after its declared bound when an initial cleanup probe
incorrectly classified pre-existing deeper children; no unrelated file was
deleted. The private source/tools/media/probes are temporary pending task
resources. Durable conclusions remain here after their required cleanup.

### System boundary and provisional membership

The owning native system is Region/player movement through scenery and
registered immovable NPC/prop circles, consumed by authoritative Hub movement
and the client's ordinary/scripted participant prediction. The native owner
and data are the recovered `0x00525800 -> 0x00526520` lifecycle, the129neutral
Courtyard segments (bench record128), four complete transformed room contours,
and registered fixed circles with resistance90/strength0. Native evidence
above and in ledgers012/025/289 is reused; no fresh retail process or new
instruction extraction is claimed by this web diagnostic.

The27permanent bodies and conditional Office body below are constructed by
`hub-participant-movement.ts` from the same canonical room layout that the
server consumes. Each row's geometry is recovered already; ordinary client
contact behavior now has individual passing focused evidence as recorded below.

| Body | Region | Center | Radius | Focused disposition |
| --- | --- | --- | ---: | --- |
| perk-witch | courtyard | `(1340,280)` |15| exact-ported |
| potion-trader | courtyard | `(1397,664)` |30| exact-ported |
| annalist | courtyard | `(895.5,455.5)` |8| exact-ported |
| items-trader | courtyard | `(1700.5,449.5)` |25| exact-ported |
| teacher | courtyard | `(576.5,710.5)` |25| exact-ported |
| memorator | mortuary | `(628,770)` |25| exact-ported |
| painting-0 | mortuary | `(512,695)` |40| exact-ported |
| painting-1 | mortuary | `(350,681)` |40| exact-ported |
| painting-2 | mortuary | `(673,681)` |40| exact-ported |
| painting-3 | mortuary | `(744,538)` |40| exact-ported |
| painting-4 | mortuary | `(590,538)` |40| exact-ported |
| painting-5 | mortuary | `(434,538)` |40| exact-ported |
| painting-6 | mortuary | `(279,538)` |40| exact-ported |
| painting-7 | mortuary | `(354,398)` |40| exact-ported |
| painting-8 | mortuary | `(512,398)` |40| exact-ported |
| painting-9 | mortuary | `(670,398)` |40| exact-ported |
| librarian | library | `(512,595)` |55| exact-ported |
| dowser | library | `(900,642.5)` |25| exact-ported |
| library-prop-0 | library | `(239.5,788)` |40| exact-ported |
| library-prop-1 | library | `(258.5,678.5)` |40| exact-ported |
| library-prop-2 | library | `(762,732.5)` |40| exact-ported |
| library-prop-3 | library | `(831,620.5)` |40| exact-ported |
| storeroom-prop-0 | storeroom | `(538,324)` |40| exact-ported |
| storeroom-prop-1 | storeroom | `(537.5,434)` |40| exact-ported |
| storeroom-prop-2 | storeroom | `(536,542.5)` |40| exact-ported |
| arch-chancellor | office | `(514,467)` |55| exact-ported |
| office-prop-0 | office | `(517.5,681)` |40| exact-ported |
| story-office-polisher | pending admission in office | `(566,735)` |15| exact-ported; preserve admission gate |

Skorcha is another immovable actor with three authored placement variants,
radius10 and present/absent/appearing/disappearing lifetime. Its position is
already represented in Hub snapshots. Determine and validate the same fixed
contact membership rather than silently preserving an omitted sibling.

Ordinary input, released inertia, keyboard/touch, region changes, College
held/scripted/Office/dialogue branches, portal outgoing/incoming movement,
NPC interaction, save/reload and party/reentry remain acceptance branches.
Students/other players and the general Boneyard pushing callers consume the
shared solver; do not change their recovered response to repair a client
fixed-body omission. Preserve the existing scripted onboarding exemption.

### Next falsifying checks and implementation boundary

Replay targeted ordinary input sequences at the actual gap and reverse them;
use current built gameplay to record authoritative, predicted and presented
positions under normal snapshot correction. A zero-Student fixture does not
exclude crowd-assisted entry. Retain any occurrence that cannot be confirmed
and separate a reachable pocket, difficult navigation and a permanent lock.

One first public regression should compare ordinary annalist/bench prediction
against the recovered authoritative fixed-circle response through contact
and reversed input. Prepare it at the established interface, then obtain an
actual M5 slot to confirm the intended failure before the behavior change.
If causal built evidence supports the prediction remedy, reuse the existing
actor solver and fixed layout for ordinary prediction and qualify every
registered fixed member, including conditional actors and lifecycle branches.
Do not invent a teleport/reset, guessed clamp or alternate geometry.

Final acceptance/publication/deployment, all member dispositions and task
cleanup are pending. These observations alone do not resolve Report57.


### Phase2: public red, authoritative gap and real presentation

On unchanged3f130, the first public annalist/bench regression failed at
`approach tick28`: prediction committed `(875.3768065,480.9546034)` while
authority committed `(874.9725260,481.4659934)`. The three existing College/
portal prediction tests passed. This is the intended position assertion, not
a test setup or type failure.

The new36directional-pulse cases reproduce a different authority behavior.
From `(898,500)`, north180ticks, west40ticks, north120ticks, release40ticks
and south180ticks enter the alcove in both zero-Student and normal native
Student populations. The annalist-center distance reaches7.56908064267906,
and the final position is `(842.9961464554825,440.6021311517868)`. This is a
controlled public-world fixture, not recovered historical input.

A second public actor/world boundary trace exactly equals every real
`stepHubWorldTick` position and collision RNG state for that sequence. It
records92full circle separations rejected by scenery while the moved
overlapping position stays committed. The first rejection is west-pulse
tick13: proposed annalist separation `(928.4613645,452.4737073)`, at33.1units
from the NPC, intersects fountain contour24 `(920,427)-(977,430)`. Root
movement `(927.7249718,452.5413180)` stays committed at32.36051units from
the NPC. The later trace reaches the deep overlap and the bench-side pocket.
This confirms the placement branch above; it is not evidence for a guessed
bench-only clamp or a general Boneyard solver rewrite.

Eight normal-input escape cases reconstruct that produced player/collision
state. East input leaves the pocket, reaching `(1087.06849,454.09655)` after
300ticks. South, diagonal and north cases differ; a failed south reversal is
not a permanent lock. No reset/teleport is needed by the observed east escape.
The trace fixture does not establish every historical save/input circumstance.

The real built frontend/private host records224positions with empty page,
console, failed-response and request-failure arrays. Rendered NPC distance
falls to29.07062 while authority remains at least33.04096; maximum displayed/
authority separation is4.03033units. A qualified follow-up uses normal
`Skip`/`Done` NPC conversation dismissal and confirms actual Student count0,
211positions, empty error arrays, rendered distance27.93495 versus authority
minimum33.01910, and maximum separation5.20298. These normal conversations
interrupt the exact public-world west pulse; neither built journey reproduces
the authority entry. The baseline motion-stopping is an interaction gate,
not a permanent-softlock finding.

The corrected fixture starts `GameHost` with zero characters as required by
its public contract; the initial nonempty-character setup failed before a
browser started. The diagnostic source/runtime is unchanged. No old48-case
matrix, original media or canonical gate was repeated. All heavy work ended
17:13:59UTC; actual resource release was17:32:09,419.9seconds after its bound
because terminal evidence was interpreted before handoff. The only scoped
home difference is a pre-existing40-byte Chrome Crashpad settings file's
mtime; its bytes/SHA are unchanged and the file is preserved. No owned
process, new home child or lease remains.

### Implemented candidate and remaining acceptance

The proved remedy stays in client prediction and its existing session caller.
`hub-prediction.ts` now uses the existing fixed-actor layout/shared actor solver
for ordinary movement as well as scripted movement, preserving each branch's
Region wall policy and collision RNG. It includes the admission-only Office
polisher and known snapshot Skorcha body. `game-client-session.ts` copies
Skorcha position/presence on reset and reconciliation and passes it through
the same prediction call. Appearance/removal is authoritative on the next
accepted snapshot; the client does not invent an unreported future spawn
timer. No protocol/save, geometry, speed, interaction or authority/Boneyard
physics rule changes.

Prepared member regressions compare valid normal approaches for all27fixed
bodies, pending/completed Office polisher admission, all three present Skorcha
placements and session-level presence addition/removal. Existing College and
portal tests remain in the focused slice. Green, current built behavior, final
member dispositions, canonical acceptance and publication/deployment are
pending an actual subsequent M5 handoff. The independently reproduced
authority pocket/native placement behavior stays explicitly separate; the
client remedy is not represented as fixing it or a permanent softlock.


### First focused green: fixture reachability correction

Exact clean candidate6d7c5e1a passed121of122focused cases; the sole failure
was the test fixture for `library-prop-1`, not a prediction mismatch. All16
22.5-degree sampled starts were invalid. Its circle `(258.5,678.5),r40`
is beside the authored shelf contour `(182,669.5)-(336,719.5)` after the
Library `(16,102.5)` transform. The25-radius player has a narrow valid strip
between the expanded shelf edge and the sloped outer-wall contour. A radius69
approach at330degrees gives approximately `(318.25575,644)`, in that strip;
the old angle grid misses it. The fixture now samples15-degree intervals,
including that authored approach. Runtime geometry and both validity/contact
assertions are unchanged. This source-derived setup correction awaits M5
confirmation; no new green result is claimed.

The runner stopped before typing/lint/build/built and automatically cleared
private temp/profiles and released the lease at19:47:01UTC, immediately after
the terminal focused result. All31scoped home entries are unchanged and no
owned process or new home child remains. Later stages are still pending.


### Exact d292 focused acceptance on published ae26

The corrected Library fixture passed on exact candidate
`d292cd8acdd7004e25448db517fc1622fccb3653`, tree
`e33c0ac4075cb900fa3e5558348ce49a47125955`, above published `ae26c65e`.
All7,256tracked Git blobs and the five Report57 SHA256s matched before checks;
private Git HEAD/tree and tracked working state were exact and clean.
All122focused prediction/session/actor/region/Skorcha cases passed with
0failures and0skips. This includes actual valid contact for each of the27
permanent fixed bodies, pending/completed Office polisher behavior, all three
Skorcha placements and session presence addition/removal/reconciliation.
The previously failed16-angle Library fixture remains a preserved witness;
the corrected15-degree approach includes its authored narrow330-degree path
without changing geometry or relaxing contact/validity assertions.

Test TypeScript, frontend lint, normal production build and configured game
bundle budget all passed. The real private-host built journey then passed
its explicit known north/reverse non-penetrating route assertion and all
page/console/failed-response/request-failure arrays are empty.213position
samples have minimum rendered annalist distance33.04627165 (previous
qualified baseline27.93495391), authority minimum33.00251638 and maximum
sampled displayed/authority separation2.00001905. These latter samples use
different instantaneous clocks and are not a zero-lag assertion. Actual
Student count0 and normal `ANNAL_INTRO`/choices/`Skip`/`Done` interaction
gates are recorded. Controlled starting pose and normal keyboard input
remain qualified; historical input and built authority-pocket entry are
not inferred from this successful predictor-correction journey.

The admission-only Office polisher and three known Skorcha positions have
`exact-ported` prediction dispositions. Skorcha animation/window
scheduling remains authority-owned and already verified by its unchanged
control tests; client body presence is adopted from accepted snapshots.
Existing College/portal/private-region shared-solver behavior is verified
unchanged by the focused controls. Students/other players and the general
Boneyard push solver are outside this fixed-body client correction; their
authoritative native rules were not altered. The separate92-rejection
authority-pocket fixture and observed east escape remain as documented
above, not a permanent-softlock fix or a claimed built authority-entry
reproduction.

All focused stages ended23:07:57UTC. Automatic terminal cleanup released
the exact lease immediately at23:07:57.530852, with0owned processes and no
new scoped home children, private temp/profiles cleared. Pre-existing
40-byte Chrome Crashpad settings bytes/SHA are unchanged; its mtime-only
touch is preserved. The runtime was not checked on M2.

Final unchanged canonical all-mode acceptance, remaining supported built
input/lifecycle paths, normal publication/managed deployment/live readback
and complete own task cleanup remain pending. Focused acceptance alone is
not Report57 completion or permission for a premature completion reaction.


## October 8, 2026: current prediction resumption

Report57 was explicitly reopened by the user. The original message
1554266708133417070 and nine nearby messages were reread on October 8
under the expected account; the text and attachment identity are unchanged
and there is no relevant withdrawal. The report states difficult but possible
escape, with a permanent softlock only tentative. Historical recovery and
acceptance above remain scoped to their original exact source revisions.

The current candidate carries the already-recovered fixed-body prediction
contract onto published main `7020dcd80e6c9761a3f8731ec367142b956b9b98`.
Its boundary is ordinary/scripted Hub participant prediction and the snapshot
caller, with the same complete 27-body layout, conditional Office polisher,
three Skorcha positions, and presence/reconciliation lifetimes listed above.
No native geometry, collision kernel, movement speed, protocol, or saved-position
policy changes. Current all-mode and browser validation are pending; historical
122-case acceptance is not represented as acceptance of this rebased source.

A separate retained supported-browser experiment from October 4 entered the
bench pocket with normal inputs after normal conversation dismissal and then
escaped east. This confirms difficult navigation, not a permanent lock. The
root-move/full-correction rejection owner is the recovered stock placement
rule, separate from the client prediction omission. The later unpublished
`3c0fad6d` anti-penetration draft adds a policy that deliberately diverges from
that stock rule and did not establish safe escape from already-retained pocket
positions in its finite probe. It is not part of this prediction candidate.
Any change to that rule requires the user's product decision and independent
retained-state validation; a failed finite route probe is not proof of a
topological or permanent lock.


### October 8 current built-client acceptance

The prediction-only change passed real built-client/private-host journeys on
desktop and Chrome-emulated touch. Desktop revision `11e0c6dc` recorded207
samples, 16 ordinary movement inputs and two normal conversations; the known
north contact route stayed at least 33.0189977 world units from the fixed NPC.
Touch revision `932cf0e3` recorded205 samples, 19 actual joystick transport inputs
and two normal conversations, with minimum 33.0428237 on the same north route.
Both actual north motion and south reversal were required; all page, console,
HTTP and request-error arrays were empty. Prediction/authority source bytes are
unchanged between these revisions. Alternate stock-compatible pocket routes
are not asserted nonpenetrating and the separate bench behavior remains an
unanswered product choice, not a fixed softlock claim.

The touch setup initially exposed desktop pointer media before application
navigation despite Playwright's context options. Explicit Chromium touch
emulation on the same CDP session used to dispatch joystick events corrected
that harness setup; one touch point, coarse pointer and no-hover were asserted
before navigation. The bounded corrected run ended 06:47:28 UTC with exit 0 and
released its exact lease. No product CSS, input gates or source were changed
to make a joystick appear. Touch is browser emulation, not a physical device.
Controlled initial pose, hidden Students/Skorcha, ordinary Skip/Done dismissal
and default real host snapshot timing qualify both journeys. The original
reporter's exact save/input clip was unavailable. Complete canonical gate,
publication, managed deployment and scoped live verification still follow.
