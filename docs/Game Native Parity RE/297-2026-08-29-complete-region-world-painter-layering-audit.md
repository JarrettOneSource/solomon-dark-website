# 2026-08-29 — Complete Region world-painter layering audit

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
