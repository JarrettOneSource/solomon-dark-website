# 2026-08-15 — Generated Dig sites and stock opening placement

## Reported smell and parity question

- Reported web behavior: the default Boneyard chooses Solomon's qualifying
  overlay-8 grave from seed bytes `4..7`, independently of player spawn. The
  committed templates themselves carry candidate zero.
- Stock behavior to recover: identify how the generator authors Dig sites,
  which site the generated opening script selects, and whether the apparent
  RNG in resident builder `0x00465920` actually owns opening placement.
- Reproduction inputs: the preserved retail executable; exact generated file
  `Generated Boneyards/random seed.boneyard`; the twelve committed native
  geometry templates; `project-boneyard.ts`; and `boneyard-catalog.ts`.
- Falsifiers: uniform choice among all overlay-8 graves at `START GAME`, an
  axis-scaled or square-root distance, last-wins ties, a synthetic position
  near spawn, seed-dependent opening movement within one template, or offsets
  other than grave `(0,0)`, Lantern `(-55,+73)`, and Solomon `(+10,+113)`.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Clean stock | `SolomonDarkAbandonware/SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; generated Boneyard, 266,811 bytes, SHA-256 `dda683d9f9e34649b3a510b2790650fc99103e51316d4b95eb6593fe98d7d448` | The generated file has 14 selector-8 graves. Spawn is `(1323.68310546875,3310.110107421875)`; serialized candidate 12 at `(1014.7630615234375,2513.224609375)` is the strict nearest. | high |
| Instructions | read-only Ghidra replica; generator `0x006388B0`, promotion `0x0063B468..0x0063B732`, nearest/clear path `0x0063B739..0x0063BB40`, action emission `0x0063CAE0..0x0063CAEC` | The generator promotes a nominal 9..14 eligible interior graves to overlay 8, reserves the first spawn-nearest one, clears Trees covering it, and emits action 1048 with operand 10. | high |
| Instructions | dispatcher `0x00689750`; candidate owner `0x00467230`; squared-distance helper `0x00403B90`; resident builder `0x00465920`; duplicate gate `0x00467160` | Mode 10 passes a singleton containing the first strict-nearest qualifying grave. Builder RNG cannot alter a singleton. Existing types 5009 or 5020 suppress another placement. | high |
| Asset/data | `tools/decode_boneyard_scripts.py` over the exact generated file | `on START GAME` UID 37451 runs `PLACE SOLOMON DIGGING(10)`. A distinct one-trip `START WAVE` trigger UID 37398, `Random Solomon`, uses mode 2 behind `RANDOM ROLL(1,0,5)`. | high |
| Current Website | `project-boneyard.ts`, `boneyard-catalog.ts`, and the native bank at `4f92c93` | Projection stores candidate zero, then catalog materialization replaces it with `candidates[seedWord2 % count]`. Four of twelve stored candidate-zero roots are not even spawn-nearest, and every template can move with the second seed word. | high |

All binary work was static, read-only analysis of the preserved executable in
a pooled Ghidra project replica. No loader injection or debugger mutation was
used for the new placement claims.

## Native ownership thread

- Owner and construction path: generator `0x006388B0` constructs normal
  Gravestones, collects only roots strictly within the Boneyard bounds inset
  300 on every edge, and promotes a nominal `RandomInt(6) + 9` of them by
  writing the final overlay selector, 8, at `0x0063B6CF`.
- Upstream producers: RegionLayout bounds and spawn, the generated scenery
  serialization order, the nine-entry grave-overlay bank, and seeded native
  generator RNG.
- Generator adjacency: each promoted site passes the last-overlay collision
  rectangle trimmed to `x + 10, width - 20`. After 100 failed attempts the
  generator collects and removes blockers. It then finds the first strict
  spawn-nearest promoted grave, clears Trees whose variant polygon contains
  that root, and gives that site a dedicated compact-decoration branch.
- Serialized state: generator `0x0063CAE0` authors action 1048 operand 10 in
  the `START GAME` Script, followed by `START NEXT WAVE WHEN(3)`.
- Runtime owner: `0x00467230` interprets placement mode, filters live
  selector-8 graves, and passes the result to `0x00465920`. Mode 10 compares
  unscaled squared Euclidean distance against local player zero, substituting
  authored spawn while `Arena +0x28 < 20`.
- Downstream consumers: `0x00465920` creates grave dirt, Lantern 5010, and
  Solomon_Dig 5009 at the recovered roots. Renderer and encounter simulation
  consume those shared actor roots; they do not select a site.
- Entry/interruption/teardown: generated `START GAME` owns the opening. The
  existing-type scan for Solomon_Dig or Solomon_DriveBy prevents duplicates.
  A later one-trip wave trigger may use mode 2 after both are absent; that is a
  separate replacement lifecycle, not an opening policy.

## Recovered behavioral contract

- Opening candidates are exactly live type-2029 graves with
  `overlayVariant === 8`.
- Origin is the local player root or authored spawn under the early-Arena
  branch. At generated scene entry those positions coincide; the Website
  therefore uses the authoritative scene spawn.
- Distance is `(grave.x - origin.x)^2 + (grave.y - origin.y)^2`. A candidate
  replaces the current selection only on strict `<`; equal-distance ties keep
  the first serialized grave.
- The opening choice consumes no meaningful selection entropy. Although
  `0x00465920` invokes integer RNG, mode 10 supplies exactly one candidate.
- Zero candidates yields no grave dirt, Lantern, or Solomon actor. No fallback
  site is synthesized.
- The set-piece roots remain grave `(gx,gy)`, Lantern `(gx-55,gy+73)`, and
  Solomon `(gx+10,gy+113)`.
- Multiplayer authority remains host-owned: one projected scene and geometry
  hash are replicated to every peer. Clients never reroll placement.

## Nearby-system findings

- Durable finding: the generator itself reserves the same nearest site used by
  the runtime opening, including Tree clearing and special decoration. The
  placement rule is therefore also a scenery-readability contract, not merely
  an actor-distance preference.
- Durable finding: modes 2, 3, 4, 5, and 10 are distinct candidate policies;
  jump-table modes 6..9 build no candidates. The later stock wave action uses
  mode 2 and remains legitimately random.
- Native reports updated before web code:
  `boneyard-system.md`,
  `native-boneyards-and-world.md`,
  `native-default-boneyard-load-seed-and-decor.md`, and
  `native-solomon-dig-and-wave-director.md`, with static RE contracts pinning
  the new anchors, complete phase chart, and negative output boundaries. The
  runtime layout file was deliberately left unchanged because no loader code
  consumes these static-analysis addresses.

## Whole-generator closure audit

The follow-up audit charted every one of the 6,165 instructions in generator
`0x006388B0` across fourteen contiguous phases from seed construction through
the returning teardown, and reviewed all 70 direct call targets plus the
indirect insertion/destruction sites. The phase boundaries cover RNG and old
state reset, topology/environment/Road construction, shuffled cell population,
entrance selection and its recursive reroll, Dig-site promotion/reservation,
promoted-grave decoration, perimeter Trees and Road finalization, WaveData and
script construction, Fence/gate generation, entrance Trees, both compact
scatter passes, RNG copy-back, and complete scratch cleanup.

The construction census is closed rather than inferred from a few captures:

- exactly seven general-factory calls emit Road `3004` at three sites and one
  each of Goodie `2061`, Gravestone `2029`, Building `2040`, and Fence `3005`;
- all fifteen Tree insertion sites route through helper `0x0062CB00`;
- compact output is exactly Tree-helper types `0..6`, promoted-grave types
  `7..8`, global-rock types `21..24`, and environment types `25..28`; and
- the routine has no construction path for compact types `9..20`, `29`, or
  `30`, Terrain `3009`, or Monument `2009`.

The twelve retained native templates independently match that native census:
their scenery union is exactly `2001`, `2029`, `2040`, and `2061`; their
compact union is exactly `0..8` and `21..28`; all environment modes `0..2`
are represented; every template has Roads and Fences; and every Terrain array
is empty. A focused bank test now pins those positive and negative boundaries.
The remaining generator tail after script construction contains Fence,
entrance-Tree, and compact-decoration work only; it has no later resident or
grave-selection path capable of overriding the recovered opening placement.

## Confidence and open questions

- Confirmed: promotion range and overlay write; strict interior candidate
  collection; collision/retry behavior; generator nearest-site reservation;
  action mode emission; mode-10 origin, metric, strict tie rule, and singleton
  handoff; resident offsets; duplicate gate; both decoded stock actions.
- Inferred but immaterial: the web's authored spawn is the correct mode-10
  origin because authoritative players are constructed there before the
  opening encounter. Both native origin branches converge at that lifecycle
  edge.
- Unknown and out of scope: the browser does not execute arbitrary mod
  Boneyard script modes or the later `Random Solomon` wave trigger. This pass
  does not invent a generic action-1048 interpreter.

## Web implementation consequence

- Correct owner: `project-boneyard.ts` projects the one opening set piece from
  scene objects and spawn. `boneyard-catalog.ts` owns only template selection;
  it must stop spending seed word two on Solomon placement.
- Replace modulo candidate selection with one ordered strict-minimum scan in
  world coordinates. Preserve `null` for no candidates and the existing
  recovered resident offsets/frame program.
- Rebuild the committed native bank projection so every stored scene and
  geometry hash contains the spawn-nearest opening root. Do not edit source
  object coordinates or reorder scenery.
- Keep selection host-authored and immutable for the run. Different seed bytes
  that select the same template must produce the same Solomon root and geometry
  hash.
- Mod-specific script semantics remain outside the supported geometry-only
  projection rather than gaining guessed implementations of modes 2..5.

## Validation contract

- Focused unit tests: later nearer candidate wins; an equal-distance later
  candidate does not replace the first; unrelated objects are ignored; zero
  candidates remains null; all twelve bank entries contain 9..14 sites and
  store their first strict-nearest site; the complete retained-bank scenery,
  compact, environment, Road, Fence, and zero-Terrain census stays pinned.
- Determinism test: hold template seed word one constant, vary seed word two,
  and require identical Solomon state and geometry hash.
- Browser journey: enter a real default Boneyard, identify the selected native
  template by geometry hash, compare the rendered grave root to every overlay-8
  object in the served bank module, and require the selected index to equal the
  first strict minimum on host and client with no page/console errors.
- Full acceptance: focused tests, static Mod Loader RE contracts, the supported
  Playwright runtime journey, and Website `./scripts/validate.sh` all pass on
  the exact final trees.

## Preserved pre-implementation failure receipt

The unchanged bank at `4f92c93` was inspected with the production projection
types. Every template stored candidate index zero. Templates 0, 3, 4, and 9
had another spawn-nearest candidate. For source
`2118053783606f5ef9dc848671d6eecd8e87aa0a3610c8c2119f08452e15a22f`,
spawn is `(392.74249267578125,150)`: the stored grave
`(1719.501953125,2128.44189453125)` is 2382.126 units away, while serialized
candidate one at `(921.10498046875,2166.613037109375)` is the strict nearest
at 2084.681 units. `Buffer.alloc(16)` selects the former through modulo-zero,
directly falsifying the recovered mode-10 contract before implementation.

## Implementation validation receipt

`project-boneyard.ts` now owns one ordered strict-minimum scan over live type
2029, overlay-8 graves, using the projected scene spawn and squared world-space
distance. It retains the first serialized grave on a tie and returns `null`
when there is no qualifying grave. The recovered grave, Lantern, and Solomon
roots and the existing animation program are unchanged.

`boneyard-catalog.ts` now spends only seed word one on native-template
selection. It no longer interprets seed word two as Solomon placement entropy.
The twelve-entry generated bank was mechanically rebuilt from the unchanged
source objects. Four entries whose old candidate-zero site was not nearest now
carry a different opening set piece and geometry hash; the other eight remain
semantically unchanged.

The focused host tests passed 15/15. They cover a later nearer candidate, a
first-wins equal-distance tie, exact resident roots and animation state, no
candidate, all twelve native templates at 9..14 qualifying graves, every
stored first strict-nearest root, second-seed-word invariance, and the complete
native-bank output-family census. The full
Website `./scripts/validate.sh` exited 0 on the exact final code tree: backend
build/integration and architecture gates passed, all 691 frontend tests and all
five desktop tests passed, and the production frontend, authoritative game
host, and CSP media-policy builds completed. `git diff --check` also passed.

The focused real-browser journey used Google Chrome `150.0.7871.124` at
1600 x 900 against the isolated authoritative dev host. It deliberately
selected native template source SHA-256
`2118053783606f5ef9dc848671d6eecd8e87aa0a3610c8c2119f08452e15a22f`,
the known pre-change failure case. The served module and rendered scene agreed
on nine qualifying graves, spawn `(392.74249267578125,150)`, strict-nearest
index 1 at `(921.10498046875,2166.613037109375)`, and geometry SHA-256
`a1428eba06ba6812ec6f5bb9c635e2d77bad85b4b3dd716a02e31e922b1a7bf2`.
Both browser page-error and console-error arrays were empty. The inspected
artifact is
`/tmp/solomon-dark-boneyard-nearest-opening-focused-20260815.png`, 1600 x 900,
SHA-256 `c58e4355c2553e7b3c9ed8cac5b00ab386f45933ea10427fe67159985c3887a7`.

The new Mod Loader placement and whole-generator closure contracts and the
historical class-loadout provenance contract all pass. The complete static RE
run finished 483/487;
its four failures come from unchanged default-Boneyard, animation-facing,
Tree-lighting, and audio-document contracts. None reads the new Solomon
placement claims, and the added contract passed in that full run.

One broader three-client smoke attempt with the correct `dev:game` wrapper
reached the synchronized Boneyard but exceeded its existing 30-second
renderer-ready gate under concurrent SwiftShader load, before executing the new
placement receipt. It is not counted as a pass. The narrower renderer-ready
Chrome journey above is the browser acceptance for this placement-specific
change; host/client selection equality remains structurally guaranteed by the
single host-authored projected scene and geometry hash rather than a claimed
new multiplayer browser receipt.

## 2026-08-28 — Opening set-piece ground-clutter clearance

### Reported smell and boundary correction

The user asked for another Solomon Dig placement review and for a visible
"rock" at the set piece to be removed. A deterministic Website template-zero
journey makes the object concrete: the large dark patch directly under
Solomon is generated compact entry `7`, DeadHawg record `121`, whose maintained
catalogue name is **dark dirt patch**. It is not Solomon record 13, Flydirt,
the grave underlay, the Lantern, or an actor shadow.

The fixed stock placement remains correct. Fresh review of `0x00465920` and
`0x00467230` confirms that mode 10 still selects the first strict
spawn-nearest overlay-8 grave and builds Solomon/Lantern at `(+10,+113)` and
`(-55,+73)`. The builder does not delete the serialized compact patch. The
exact stock-generator source also contains it, so the requested removal is a
deliberate Website readability override rather than a newly recovered retail
deletion. That predicted stock difference is recorded explicitly instead of
being disguised as native parity.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail instructions | canonical read-only Ghidra replica; placement builder `0x00465920`, candidate owner `0x00467230`, duplicate gate `0x00467160` | The selected grave survives; the builder creates type `5009` and `5010` at the established offsets and has no compact-sprite deletion path. | high |
| Exact stock-generated data | template-zero `play.boneyard`, SHA-256 `2118053783606f5ef9dc848671d6eecd8e87aa0a3610c8c2119f08452e15a22f`; projected sprite `196` | Compact entry `7` is centered at `(951.7761840820312,2293.22265625)`, rotated `8.779399871826172` degrees, scale `1.1761225461959839`, flags `1`; its transformed record-121 rectangle contains Solomon root `(931.10498046875,2279.613037109375)`. | high |
| Asset/data | Website DeadHawg manifest and palette; generated compact entry maps as `114+entry` | Ground-clutter membership is entry `6/7/8/21/22/23/24` = records `120/121/122/135/136/137/138`; exact centered dimensions are `260x178`, `89x89`, `62x62`, `64x56`, `70x58`, `80x62`, `69x59`. Record 121 is catalogued `dark dirt patch`; record 137 is a rock. | high |
| Complete retained-bank sweep | all twelve exact stock-generator sources and current projected scenes | Exact inverse-rotated containment finds four covering ground-clutter sprites: template 0 record 121; template 5 records 120 and 121; template 6 record 137. The other nine templates contain none. | high |
| Current Mac reproduction | Website `0c94685e`, template-zero seed, Mac Chrome 151, 1600x900 | The dark record-121 patch is visibly centered under digging/speaking Solomon. Dirt-frame SHA-256 `1a64f891cfba0f11789f50d191f5bc2e0f80bce0a25dd6b0acdf80623a924315`; speaking frame `ee3525e043cad3e21cc932310d506ac6fbf8f1c5e33290db091c79075cff5860`. The journey later failed an unrelated retired-entry movement assertion and is baseline evidence, not a passing acceptance receipt. | high |
| User product direction | explicit 2026-08-28 report | Clear the rock/patch from Solomon Dig while reviewing placement. | authoritative |

### System boundary and membership inventory

Native/product system: **opening Solomon set-piece projection**, from exact
grave selection through fixed resident roots and the narrow Website clearance
of generated ground clutter that covers the Solomon actor root.

| Member / branch | Source | Disposition | Proof contract |
| --- | --- | --- | --- |
| mode-10 qualifying graves, strict nearest, first-wins ties, zero-candidate branch | `0x00467230`; existing projection | `verified-already-at-parity` | no selection or tie-rule change |
| grave root and serialized grave actor/underlay | type `2029`, overlay `8` | `verified-already-at-parity` | grave remains in objects and normal painter passes |
| Solomon root `grave+(10,113)` | `0x00465920` | `verified-already-at-parity` | all twelve roots unchanged |
| Lantern root `grave+(-55,73)` | `0x00465920` | `verified-already-at-parity` | all twelve roots unchanged |
| DeadHawg record-13 co-rooted Solomon pass | `0x004A2610` | `verified-already-at-parity` | remains visible through digging/dialogue and retires with established phase |
| template 0 entry-7 / record-121 covering patch | exact source `21180537...` | `out-of-system` (explicit Website readability removal) | excluded because its exact transformed rectangle contains Solomon root |
| template 5 entry-6/7 / records 120/121 covering patches | exact source `ec2b27a1...` | `out-of-system` (same product rule) | both excluded by the same geometry predicate |
| template 6 entry-23 / record-137 covering rock | exact source `624b79ae...` | `out-of-system` (same product rule) | excluded by the same geometry predicate |
| ground-clutter entries `6/7/8/21..24` not covering Solomon | exact seven-row footprint table | `verified-already-at-parity` | byte-identical sprite rows survive |
| compact foliage `0..5`, environment `25..28`, promoted-grave decoration not in the covering ground-clutter set | complete generator census | `verified-already-at-parity` | no broad radius filter or template-specific deletion |
| other nine retained templates | complete bank sweep | `verified-already-at-parity` | sprite count/rows unchanged |
| custom projected Boneyard with an overlay-8 opening grave | Website projection boundary | `exact-ported` placement plus the same explicit product clearance | no hard-coded template hash or sprite EID |
| later random mode-2 replacement, modes 3..5, unsupported 6..9 | native script/runtime branches | `out-of-system` (browser does not execute these script policies) | no new generic script interpreter |

No browser member is blocked. The predicted visible stock difference is the
intentional absence of a compact dirt/rock sprite only when its transformed
ground-clutter rectangle covers the opening Solomon root.

### Recovered/product contract and implementation consequence

- Preserve exact compact transform semantics: position is the registered
  center; rotation is `s0`; Y scale is `max(0,s1)`; X scale additionally uses
  the native `0.8` factor when flags bit zero is set.
- Footprints are the seven exact DeadHawg centered record dimensions above.
  Transform the Solomon point into sprite-local space and use inclusive
  half-width/half-height containment. A distance-only radius, axis-aligned
  approximation, template hash, or sprite EID is forbidden.
- Apply the filter only after the opening grave and fixed roots are known.
  Preserve all noncovering compact rows byte-for-byte.
- Rebuild the checked-in twelve-template bank from the same exact read-only
  stock-generated source files. Source SHA-256 values stay fixed; projected
  geometry hashes change only for templates 0, 5, and 6.
- Keep selection, objects, roads, fences, terrain, collision, actor state,
  record-13 pass, Flydirt, Lantern art/light, and multiplayer ownership
  unchanged.

### Validation contract

- Red/green projection tests must pin all seven footprint rows, inverse-rotated
  containment including the flags-bit X scale, four removed members across
  exactly three retained templates, unchanged source hashes/roots, and
  identity preservation for every other sprite.
- The complete stock-generator census remains `0..8,21..28`; filtering a
  projected opening does not rewrite the source-data truth or invent another
  generator family.
- Mac Chrome must enter deterministic template zero, reach Solomon, prove
  record 121 is absent from the served scene and frame while record 13, the
  remaining promoted-grave patches, grave, Lantern, body, and Flydirt remain;
  page/console/failed-response arrays must be empty.
- The exact final candidate must pass `/opt/homebrew/bin/bash
  ./scripts/validate.sh` on the Mac mini.

### Implementation validation receipt

- `materializeOpeningSolomonSetPiece` still performs the same strict-nearest
  grave selection and fixed resident placement, then tests only generated
  ground-clutter entries `6/7/8/21..24` against the Solomon root in exact local
  sprite coordinates. The predicate preserves centered record dimensions,
  `s0` rotation, `s1` scale, and flags-bit X factor; it has no template hash,
  sprite EID, distance-radius, or renderer-only exception.
- The twelve-template bank was regenerated from the same read-only stock files.
  Every source SHA-256 and Solomon/grave/Lantern state is unchanged. Template 0
  removes only `sprite-196` and changes geometry hash to
  `bb6072ba6adedba364d36a004d6622e7610df848456c1c3ac92b6e372b4ba4c0`
  with 327 sprites; template 5 removes `sprite-131/142`, hash
  `ffaacb41b92345b1816c0a49c5b0585ac6da7b7ab8153ad162bb833473620750`
  with 271; template 6 removes `sprite-34`, hash
  `a026e733247fe03510a517288a6f04f47f41bec54cf16ecbf1926303a529d2b6`
  with 303. The other nine scene hashes and sprite arrays are identity-equal.
- Focused coverage includes all seven dirt/rock rows, direct-record mapping,
  a rotation-discriminating rock, flags-bit X scaling, non-ground foliage,
  noncovering patches, zero-candidate behavior, all twelve computed geometry
  hashes, exact three-template receipts, fixed roots, and the complete
  generator-family census. These contracts participated in the complete green
  Mac gate recorded above.
- Built production Mac Chrome selected deterministic template-zero source
  `2118053783606f5ef9dc848671d6eecd8e87aa0a3610c8c2119f08452e15a22f`.
  The served scene omitted `sprite-196` while retaining neighboring
  `sprite-193/194/195/197`. Record-13 pass count was one while digging and
  speaking and zero after Solomon ran. Flydirt retained two passes across ages
  `1..28` and retired naturally; the run reached 11 opening enemies. Wire,
  page, console, and failed-response arrays were empty.
- Reviewed corrected dirt and speaking frames are SHA-256
  `967c734098f2cb204bcb50f16f3170afb8ff301ac8acd1545bee28361f6f3901`
  and
  `adaa5ba940d467e7f6681112cd47cae71adad622d9a3808409834dbb41691415`.
  They retain the grave, neighboring authored dirt, record-13 strip, body,
  Flydirt, and Lantern while the actor-covering dark patch is absent.
- This is an explicit four-sprite Website readability difference from the
  sealed stock-generated files, not a retail-parity claim. No browser member is
  blocked and no placement unknown remains. Publication/deployment were not
  requested or performed.
