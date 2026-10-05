# 2026-08-15 — Inventory and hub-trader native contract

## 2026-10-04 — Report61: InventoryScreen Game-owned run-stat preview recovery

### Reported smell and 2026-10-04 intake evidence

The reported missing Wave line reopens the central wizard/run-stat preview,
not the gameplay HUD or the left SwipePages statistics. The earlier Inventory
pass recovered the preview art and interaction family but left its two text
lines as constants. It did not close the Game-owned summary producer, positive
wave gate, or formatting contract. Those unfinished members require recovery
and verification together before this entry can claim their parity.

The exact original Discord message `1554289976458350723` was re-read with a
13-message surrounding window on 2026-10-04 through account
`600774060439371807`. Its text and edited timestamp
`2026-09-29T04:22:35.353000+00:00` are unchanged; no nearby linked correction
or withdrawal changes this report. The full original attachment is a
912-by-571 PNG, 294447 bytes, SHA-256
`6f820244b29fe42730a0fae1982e6a5ff2b342aec9b502c69c37305a61c7e2e0`.
It visibly shows Wave: 1, Kills: 0, and Awesomeness: 0 under the wizard.
The reporter identifies it as original Solomon Dark. The cropped image does
not independently establish executable identity, scene, inputs, or lifecycle.
Report84's separate menu-XP allegation is not adopted by this investigation.

| Evidence class | Exact source | Observation and qualification | Confidence |
| --- | --- | --- | --- |
| Published source at intake | clean Website `59443b078bf72ee729b4cf982933d8fa236aa605`, tree `c3352f924e24710d310b8ee5f76b8deb881535b1`; HEAD, fresh origin/main, and FETCH_HEAD agreed at intake | `renderer/hub-inventory/equipment.ts::addPlayerPreview` paints fixed `KILLS: 0` at `(800,337)` and `AWESOMENESS: 0` at `(800,359)`, tint `0xe7cc71`; no run-stat input exists | high |
| Published build at intake | no-store live `deployment.json` returned the same `59443b0`; `/game` entry `index-CIvEDLQF.js`; actual shared `use-coarse-pointer-C8mK_mXH.js`, 383003 bytes, SHA-256 `33ae944b845bbb029f9c6f50ff297111e879d71f2af1ef01ba8c0e6998cd09c1` | compiled preview contains those same two fixed strings/coordinates/tint in one painter body; this is static served-byte proof, not browser acceptance | high |
| Retained decompiler evidence | read-only Mod Loader `runtime/ghidra_progression_derived_offsets_current.txt`, SHA-256 `880c9b09d086db36561dcac7aeb4b42a47112a88eb8a6483bc0c39556b84638d`, `FUN_00568b90` block at lines 21559–22687 | Inventory root painter gates the live wizard preview on `InventoryScreen+0x160 == 0` and non-null `Game+0x1358`. It draws cached strings at `Game+0x1C3C/+0x1C58/+0x1C74`; the first additionally requires signed short `Game+0x1C30 > 0`. Decompiled font/call arguments remain incomplete | high for retained branch/field leads; raw-instruction verification pending |
| Retained native font-wrapper lead | `Decompiled Game/callers_text_render.log`, `FUN_004a58b0` | the three summary calls use this common wrapper after copying the corresponding Game string; the export loses material argument flow, so font/alignment/scale must be verified from instructions | incomplete |
| Immutable native binary/data | retail executable, 4723200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000`; standard-library PE section reads | exact literals are `Wave: %d` at `0x0079B180`, `Kills: %d` at `0x0079B18C`, and `Awesomeness: %d` at `0x0079964C`. Referenced double offsets are `0x00785690 = 80`, `0x00791480 = 95`, `0x007948F0 = 115`; referenced RGB floats are `.85`, `.73`, `.44`. These bytes establish data, not a complete instruction/placement contract | high for literal/scalar bytes |
| Existing settled upstream recovery | entry118, `Game` counters `0x005C9430/0x005C94E0`, contact `0x0063E7D0`; entry051 wave director; current `host/game-snapshot.ts` | authority already publishes actor-specific `hallOfFameRuns` kills/Awesomeness and world `waves.waveOrdinal`; Tutorial also has its own authored wave state. No new gameplay counter is justified by this display defect | high |

The old `inventory-screen.png` witness cited above remains explicitly
**debugger-instrumented/runtime-staged**; it supports native appearance and
must not be reclassified as a new clean-stock observation. The manually
simplified `00560380__InventoryScreen_Ctor.c` is marked inferred/manual and
omits the preview rectangle, so it cannot settle rectangle or mode semantics.

### Initial system boundary and provisional membership

Native system: the standalone InventoryScreen's central local-wizard preview
and three Game-owned run-summary strings, from Game value/cache production to
the optional book's shared painter and teardown. The owning root is
`0x00568B90`; `0x00562520` is the separate left STATS painter. Recover the
cache writers and every native branch before treating this inventory as closed.

| Member or branch | Owner/source | Intake disposition | Required proof |
| --- | --- | --- | --- |
| Wave literal/value/cache and positive-value visibility | Game `+0x1C30/+0x1C3C`; root `0x00568B90` | retained-recovery pending instruction verification and port | all cache writers/xrefs, zero/positive wave branch, exact current wave source |
| Kills literal/value/cache | Game `+0x1C58`; native kill producer `0x005C9430` | retained-recovery pending cache-writer verification and port | independent nonzero kills and live updates |
| Awesomeness literal/value/cache | Game `+0x1C74`; score producer `0x005C94E0` | retained-recovery pending cache-writer verification and port | independent nonzero score, ordinary/maximum bonus/reset/archive boundaries reuse entry118 |
| Shared three-line bitmap formatting, placement and tint | root `0x00568B90`, wrapper `0x004A58B0`, native data above | unresolved extractable instruction/rectangle evidence | font, alignment, scale, baselines, exact color and complete literal census |
| Standalone with live local wizard | root `+0x160 == 0`, non-null `Game+0x1358`; current `pages.ts` | recovered branch pending constructor/mode verification and port | exact preview rectangle; standalone mode membership |
| Companion inventories: Fomentius, Hagatha, Luthacus, Shlorio pre-roll/result | same native root mode and current companion `buildInventory` callers | current preview suppressed; native mode mapping pending | complete constructor/caller census, no accidental preview/stat introduction |
| Hub standalone; survival before/after first wave; authored Tutorial | one shared book/root plus Game wave/cache writers | scene-specific value/reset contract unresolved | zero-wave/positive-wave behavior, Tutorial mapping and return/new-run resets |
| Local owner, party peers, actor/run replacement, open-book refresh | native local Game/player binding; current Boneyard snapshot subscriber and shared renderer model | current projection missing; reuse existing authority | correct addressed actor's metrics, shared wave, no stale values after replacement/restore |
| Nested Sack, selection, notices and Painting child lifetime | established parent InventoryScreen model | existing behavior to preserve; no separate statistic owner found | parent stat values survive child overlays; close/replacement tears down the model |
| Left identity/primary/attribute/perk SwipePages, menu XP, HUD and completed Hall row | separate painters and existing entries295/118/164/051 | out-of-system: this pass changes the central preview consumer only | preserve established contracts; shared upstream facts may be reused without reopening their implementation |

This was the provisional intake inventory. The instruction and retained-evidence
reconciliation below supersede its native recovery questions; the subsequent
parent review accepted the eleven-member implementation boundary. No member is
claimed `exact-ported` before candidate execution and observable acceptance.

### Actual native-only instruction phase — 2026-10-04 21:47 UTC

The distinct `report61-native-stats-20261004-2145` phase actually admitted at
21:47:37.023022 UTC, exported ten bounded LLVM instruction ranges, and ended
native exit 0 at 21:47:38.841194. Automatic cleanup completed at
21:47:39.786570: native group93333 empty, own M5 root removed, exact lease
released; M2 SSH84464 exit0 and actual post-drain rows empty. All ten stdout
and stderr hashes were checked. The 512000-byte export SHA-256 is
`ebbfa523cff9a5633f1f902040a4960b6256cf66274e753496ad53d9915192d9`.
The earlier 2139 phase was refused before acquisition and produced no native
result. Both clocks are closed. These are static instruction facts, not a
native runtime, browser, Website gate or report-acceptance receipt.

| Recovered member | Exact instruction evidence | Contract and remaining qualification |
| --- | --- | --- |
| standalone/non-null player gate | root `0x00568DD8..0x00568DF7` | `InventoryScreen+0x160 == 0`, with non-null `Game+0x1358`; incoming third constructor argument is stored at `+0x160` at `0x005606E1`; complete caller/mode reconciliation remains open |
| positive Wave visibility | `0x005690D3..0x005690DC` | signed 16-bit word `Game+0x1C30 > 0`; zero/negative values omit only Wave |
| Wave producer and cache | actual direct Arena call `0x00465D3D -> 0x005C9370`; `0x005C9396..0x005C93CC` | adds a sign-extended byte delta to the word, formats exact `Wave: %d` using `0x0079B180`, and stores cache `+0x1C3C` |
| Kills producer and cache | `0x005C9456..0x005C9489` | adds a sign-extended byte delta to 32-bit `Game+0x1C34`, formats exact `Kills: %d` at `0x0079B18C`, and stores `+0x1C58`; no positive-value render gate |
| Awesomeness cache | `0x005C95E4..0x005C960C` | settled scoring producer updates 32-bit `Game+0x1C38`, formats exact `Awesomeness: %d` at `0x0079964C`, and stores `+0x1C74`; scoring formula remains owned by entry118 |
| all three font bindings | calls `0x0056914A/0x005691BE/0x00569231` | each selects `Application+0x4D530`, the already recovered medium group1 font, then wrapper `0x004A58B0 -> 0x004A57C0 -> 0x0043AFC0`; no per-call scale argument. Default-centre primitive reuse still needs final reconciliation |
| literal case, text offsets and gold | `0x005690DE..0x00569231`; verified binary scalars | x is preview player's centre x; y is preview player y plus 80/95/115. The gold inputs are native float RGB `.85/.73/.44`, rounding to `0xD9BA70`, rather than the current `0xe7cc71`. Case is exact mixed case; medium glyphs supply small-cap appearance |
| fresh Game values/cache | constructor `0x005CC800`, counter initialization `0x005CCF00/07/0D`; cache refresh through `0x005CD2AB` | counters initialize at zero; Wave/Kills strings are formatted from their fields, and score delta0 initializes its cache through the same producer |
| serialized values/cache | `0x005CE3D0`, field paths `0x005CE84D/0x005CE85B/0x005CE91D`, refresh through `0x005CEF9C` | native Wave/Kills/score fields are serialized, then caches rebuilt from the current values; score delta0 refreshes its cache. This is a separate method after the SwitchRegion body, not proof that SwitchRegion resets counters |

Seven direct in-system literal address-byte candidates now have actual
instruction associations (the eighth is the separate, previously settled Hall
consumer). The Wave helper was selected from an actual decoded Arena call,
not by aligning backwards from a byte occurrence. Fixed-range names alone
do not establish exclusive function ownership.

The preview y anchor comes from the centre of rectangle `InventoryScreen
+0x430` (`+0x434 + .5*+0x43C`) at `0x00568F5E..0x00568F6A`; the constructor
passes its pane rectangle to `0x00551610` at `0x00560936/0x00560A2B`.
The current recovered paneTop89/height320 predicts centre249, but the setter
link still needs direct or retained authoritative proof before final layout
constants are treated as recovered. Root additionally stages native heading135 and the raw `Actor+0x74` value1.15.
The retained actor-layout authority identifies `+0x74` as `move_speed_scale`,
reused by animation advance, not composed preview render scale. Do not infer
a wizard art correction from this raw movement-field value.

Game construction, field serialization and the ordinary SwitchRegion body
are now separated. Current `returnGameSimulationToHub` explicitly creates
fresh player/run state, while Tutorial/College transitions have their own
boundary. Continue that mapping, native constructor/caller membership and
pane setter/default font reconciliation before implementation. Existing
Boneyard values remain reusable candidates, not proof of every scene's lifetime.

### Retained evidence reconciliation after the closed 2145 phase

The existing read-only `native-hub-trader-catalog.json` (schema8, exact retail
SHA above) records standalone right pane `(1230,89,320,320)` and wizard centre
`(800,249)`, with all service companion previews suppressed. It also records
standalone heading index9/native135 degrees and a composed preview scale1.25.
Those geometry/capture findings are authoritative retained evidence, not a new
clean-stock capture. Combined with the new raw root offsets80/95/115, the three
stat anchors are `(800,329)`, `(800,344)`, `(800,364)`. The raw actor-field1.15
is a movement/animation scalar (`Actor+0x74`), while composed preview scale1.25
belongs to the draw representation. The retained actor layout and current
preview resolve that distinction; no scale/pose art change is required.

Entry295's complete ExactText ABI already identifies `0x004A57C0` as the
centre wrapper and native mode0 as half-width subtraction. The newly read
`0x004A58B0 ->0x004A57C0 ->0x0043AFC0` chain therefore resolves alignment
without another extraction. Medium glyph advance, kerning, point sampler and
native text primitive remain verified already at parity. Reuse the existing
native-ui text/Pixi path for these three mixed-case strings in `0xD9BA70`.

The native Book opener `0x005C6F10` already has a complete three-producer
census in entry115: configured keyboard, HUD and authored action dispatcher,
shared by Hub/Boneyard and reciprocal Skills replacement. The retained trader
catalog independently supplies the four companion consumers and their parent
Inventory relationship. A new immutable raw E8/rel32 scan finds nine Inventory
constructor candidates: four in builder `0x004FB890`, four in NPC owner
`0x00514A20`, one in Book opener `0x005C6F10`; plus three pane-setter candidates
(two already decoded in the constructor, one in its update). These raw byte
occurrences are explicitly not new instruction/xref proof; retain prior
canonical native caller evidence and extract a missing caller only when it can
change the supported contract.

Current host `returnGameSimulationToHub` callers are a missing-mod continuation
fallback and empty private-run retirement. Post-run loadout uses a separate
fresh-generation rebuild of character/run/clock state, with Tutorial/College
intro staged afterwards. Existing ordinary Hub values are fresh-Game zeros;
active/restored survival and authored Tutorial require their current own-player
counter records and world wave source. A new shared display projection must
bind to the current addressed actor/world and reject stale scene-era values.
The Game serializer confirms numerical fields are saved and formatted caches
are derived; it does not authorize persisting renderer strings or changing
save/authority behaviour for a display defect. Final Game-generation mapping,
constructor/caller mapping and observable final display/lifetime acceptance
remain the proof frontier; source recovery does not waive browser acceptance.

### Historical baseline causal trace and closed native follow-up

At the original `59443b0` baseline, `BoneyardScene` subscribes to current
authoritative snapshots, while its initial snapshot is retained for scene setup.
Neither it nor `HubScene` passes
run-summary values into `HubInventoryUi` → `NativeHubSurface` →
`HubInventoryRendererModel` → `pages.ts::buildInventory` → `addPlayerPreview`.
The last function always substitutes two zero strings. Companion pages skip
that function. `useHubInventoryRenderer` already rebuilds on model changes,
so the accepted candidate below reuses current snapshot values and this existing
presentation invalidation path.

The closed 2145 instruction phase and retained-evidence reconciliation established
the Game cache writers, constructor/restore boundaries, font, geometry, caller
membership and existing scene-generation mapping before implementation. The
accepted eleven-member contract governs the shared projection below; no additional
native extraction is pending for these already reviewed facts.

Raw little-endian address-byte matches in the exact PE provide finite leads,
not proven xrefs: Wave at `0x005C93B0/0x005CD156/0x005CEE05`, Kills at
`0x005C946D/0x005CD209/0x005CEECC`, Awesomeness at `0x005C95F6` (plus the
separate Hall consumer at `0x005A1C76`). The closed native phase resolved the
in-system instruction associations described above. These initial byte leads
remain historical evidence and do not assign a new diagnostic or waive browser
acceptance.

### Shared implementation and public regression preparation

Parent contract review accepted the eleven-member boundary on 2026-10-04.
The M2 candidate now uses `projectInventoryRunSummary` at the shared UI-model
boundary to consume the current addressed actor's authoritative values.
Tutorial chooses its authored `waveOrdinal`; survival chooses its wave
snapshot; an absent actor/run record or replaced run yields no stale summary.
Fresh Hub is the already established new-generation zero state. No numeric
counter, save string/cache, authority mutation, protocol or art change is added.
Both scene subscribers also clear the projected preview when the addressed
actor disappears or that scene's world/run is replaced; retained economy data
cannot keep the central actor and summary visible after that boundary.

Affected source callers are `BoneyardScene` current subscription and initial
snapshot, `HubScene` fresh generation/subscription, `HubInventoryUi`,
`NativeHubSurface` in `HubInventorySurface.tsx`,
both inventory/service renderer model variants, shared `buildInventory`, and
`addPlayerPreview`. The projector/equality keep unrelated snapshots from
rebuilding the book; every relevant wave/kill/score change invalidates the model.
Companion pages still suppress the preview. The painter consumes one canonical
three-line plan in recovered centred medium text at329/344/364, goldD9BA70,
using the existing native-ui primitive and exact mixed-case format strings.

The tests were prepared first in the existing public presentation/renderer
contract suites. They cover exact owner versus peer, independent nonzero
changes, Tutorial with no survival director, retired actor/run, new generation,
restored numerical input, zero/negative wave omission, null/companion suppression,
and native case/positions/font/tint. The 0600 results below qualify public tests
on candidate `99c123d1`; 0648 also qualifies public tests, lint and production
build on corrected candidate `e92f7f24`. Its source-module renderer image was
captured, but the witness required the diagnosis below. Built-scene and network
journeys remain unexecuted. Source preparation is not a verified fix.

The maintained `smoke-inventory-run-summary.mjs` drives the production book
painter in a declared read-only renderer-model fixture, saving actual PNG and
raw observations before its assertion. It can exercise the exact old Git
baseline renderer with a helper outside that checkout; that baseline's wrong
zero labels/missing Wave must be visually inspected and recorded as the genuine
behavior failure, separately from the absence of new diagnostic output. Unit
imports missing on an old revision do not prove the old behavior. Candidate
checks repeat nonzero/live/zero/restored/retired display states. This fixture
cannot replace real current-built scene/subscription, save/restoration,
Tutorial, party-owner and desktop/touch journeys, nor the unchanged full gate.

The baseline helper now samples opaque glyph ink from the existing native font
atlas and compares the actual PNG pixels with independently specified native
strings, anchors and gold. The first nonzero case must fail those pixels before
new candidate diagnostics are checked. Candidate cases also test actual absence
of the retired Wave/actor text. All PNGs and raw pixel observations are retained
before assertions; this preparation has not executed on M2.

`smoke-inventory-run-summary-scenes.mjs` prepares an exact built-client and real
host/save/UI journey for restored survival and Tutorial values, updates while
the book stays open, a second actor with different counters, zero Wave,
Skills-to-Inventory replacement, fresh Hub and all four merchant companions,
including Shlorio before and after an authoritative dowsing roll. The Hub
fixture explicitly funds that roll while preserving fresh-Game zero counters.
It declares its numerical fixtures and Mac Chrome touch emulation. The second
actor fixture proves addressed-state isolation; it does not claim a network
party or physical-device journey. The existing built inventory-stat journeys
remain in the executable desktop/touch acceptance plan. None is recorded as
passing before actual execution and retained-image review.

`smoke-inventory-run-summary-network.mjs` prepares a separate built-client
journey with two real ticket-authenticated WebSocket peers, public invitation
and acceptance, and a shared Boneyard run. Declared authority-side numerical
fixtures give each actual member different kills/Awesomeness and a shared
Wave; independently updating either member must preserve the other's display.
It records actual peer IDs, sockets, shared run, screenshots and errors. This
opens each member's book sequentially, honoring the existing party pause owner
and release grace rather than trying to keep both books open together. The peer
then leaves through the public menu and rejoins with its saved party claim via
the established local provisioning fixture. The resumed shared run must retain
the leader's intervening values, display the peer's current values, and accept
a new live update without restoring stale pre-disconnect state. It is currently
unrun. The fixture maps a declared remote endpoint to the real local socket and
routes local admission/rejoin requests, as in the existing party-rejoin journey.
A successful local network journey would not substitute
for public managed-service/live evidence or a physical-device claim.

### Validation contract and current acceptance frontier

On 2026-10-05 the accepted Report61 changes were reconciled onto fetched
published main `d1161e0b97ae41659b5ea437f1c8000310a0cad0`. Report60 changed
only its Acid Rain presentation, tests and ledger; its files are disjoint from
this implementation. The original `59443b0` baseline and corrected external
helper remain sealed for the genuine pre-fix pixel comparison. The earlier 0141
phase admitted that baseline and built it successfully, then stopped on a helper
syntax error before Chrome, PNG or behavior receipt. That failure is unqualified
as a red; the one-parenthesis correction and early private Node parser gate have
only been prepared at that checkpoint. The later 0600 results below supersede
that preparation-only state.

The distinct 2026-10-05 0600 phase admitted the original `59443b0` baseline
with all 7258 tracked blobs/modes, built it, and preserved that exact source
after the external renderer comparison. The retained 1600-by-900 PNG SHA-256
`607bdd17d606d3f5fd6c7cf9f28939136d7e85e0892d3e90ffd603e3537b0de0`
visibly has Kills: 0, Awesomeness: 0 and no Wave for declared inputs 6/17/91.
The independent native-gold witness matched zero of 824 opaque glyph pixels;
console/page/response errors were empty. Its assertion precedes candidate
diagnostics, so missing new APIs did not substitute for this genuine pixel red.
The PNG uses Vite `createServer` and `/src` module imports in a declared model
fixture exercising production renderer source. It is not a dist-served gameplay
image. Successful production builds are separate evidence; real built-scene,
network and physical-device acceptance remain distinct. The original baseline
and this witness are retained for subsequent
candidate acceptance; an unrelated adapter correction does not require replay.

Candidate `99c123d1` was separately admitted with all 7260 original blob/mode
records. Its public hub/native suites passed 131/133 tests and lint exited 0.
Production build then exited 2 on TS2345: the companion object in
`hub-inventory/services.ts::buildService` omitted required `runSummary`.
The complete `buildInventory` caller audit found only that object and the
normal renderer's typed inventory model, which already carries the field.
The companion producer was corrected to explicit `runSummary: null`, preserving
the reviewed companion suppression and required type instead of making the
contract optional. The later `e92f7f24` public suites, lint and production build
passed; corrected-witness renderer and built-scene acceptance remain required.

The phase closed at 06:02:50.988275 UTC with all owned groups drained,
output durably exported/acknowledged, root and exact lease removed, and no new
home children. The sole home difference was an unchanged-byte Chrome Crashpad
settings mtime touch. No candidate painter or built-scene journey ran before
the build failure. The closed phase has no remaining execution authority.

### 2026-10-05 — Source-module pixel witness diagnosis

The 0648 `e92f7f24` image SHA-256
`679f83927ea280d4eff93fc432e47b69e8be9850ef4a85ab6dad23b7cb072f95`
visibly has Wave: 6, Kills: 17 and Awesomeness: 91 at the recovered anchors,
but the first witness matched only 549/824 samples. This was not evidence to
alter the production font, tint or geometry. The closed 0857 M5 diagnostic
reproduced that ratio from the same retained PNG, then measured coordinate and
texture-alpha controls without repainting either renderer or rerunning a build.
Both source admission and final readback verified all 7260 original `e92f7f24`
blobs/modes. Its numeric receipt SHA-256 is
`770cb4dabde278b2d25043e6e232ae6e6f6eb06c09685053d686d4189f84564e`.

Wave: 6 has even width 68 and integer glyph x bounds; Kills: 17 and
Awesomeness: 91 have odd widths 75/155 and half-integral x bounds. All y bounds
are integral. The production POINT-filtered sprites retain those authored
positions. `Math.round` in the witness incorrectly chose the next column for
the half-origin glyphs; pixel-centre coverage uses `ceil(position - .5)`.
Its mask also called 51 source texels with alpha 250–254 opaque, then compared
their composited colour against an unattenuated tint. All source RGB values
were white. Exact fully opaque white texels avoid that composition assumption.

With corrected coverage and fully opaque white texels, all 773/773 samples and
all five numeric glyphs matched. The same method left the accepted old baseline
at 0/773. Wrong Wave: 7 still matched 756/772 aggregate samples, but its changed
digit matched only 8/24; stale Awesomeness: 92 matched 757/778 aggregate samples,
but the changed digit matched only 9/30. Thus the canonical witness must retain
the 0.9 aggregate requirement and also require 0.9 for every numeric glyph.
Wrong/stale expected values keep font, tint and anchors fixed and use the actual
retained pixels; diagnostics remain secondary. These are confirmed witness
errors, not a production-renderer correction or a gameplay pass.

The 0857 diagnostic passed and closed at 08:59:17.415386 UTC with all 46 stage
groups and eight M2 transport/job groups drained, 92 stream hashes verified,
durable export/ACK, root/exact lease removal and the previously qualified
unchanged-byte Crashpad settings mtime touch. Parent numeric acceptance on
2026-10-05 authorizes the witness repair with the original 0.9 requirement.
The actual repaired helper and remaining renderer/built/member/network journeys
still need their own acceptance; no baseline or unchanged product replay is
required solely because the witness changes.

- Meaningful public presentation regressions: zero/positive wave; independent
  nonzero kills and score; addressed-owner projection; open-book snapshot
  updates; Hub/Tutorial/survival entry and run/actor replacement; companion
  exclusion; exact native literal/layout contract after recovery.
- Real M5 browser journey through supported native member states, comparing
  current-built display and native/retained original evidence with provenance
  and physical-device limits explicit. The original crop is not a fixture of
  a full native scene.
- The final exact candidate must pass unchanged all-mode Website validation,
  normal publication, managed PRIMARY deployment/live checks, original-only
  completion reaction/readback and all-own cleanup before this investigation
  gains final dispositions.


## 2026-08-16 parity reopening

The presentation/interaction row below is reopened. The prior closure proved
the broad class family and replaced the original DOM modal, but it did not run
a literal stock-versus-browser pixel comparison for every InventoryScreen
sub-owner and it did not exercise the companion InventoryScreen after a
purchase in every service. Current-main SHA `6826e62bc981c53b7c1f9800a6de1c97c6da18db`
completed the full existing Mac mini trader smoke at a 1600 by 900 browser
viewport with no browser errors, but that receipt exposes three residuals:

- the PRIMARY SPELL content uses four evenly spaced browser rows ending at
  baseline y=312, so `MANA HEAL: 10 / SEC` crosses the pane's y=310 lower
  boundary; the retail witness keeps the whole row inside its authored inset;
- Fomentius, Hagatha, and Shlorio draw the companion backpack but do not expose
  its semantic object hit targets, so an object bought into that backpack
  cannot immediately enter the stock InventoryScreen select, ItemInfo,
  double-activation, or drag lifecycle while the service remains open;
- the right EQUIP pane still treats the robe as a generic rectangular sink and
  its preview as a separately synthesized wizard composition. Those are not
  yet proven against the native class-owned Hat/Robe/Staff painters, the seven
  sink aliases, or the settled retail pixel geometry.

The reference set is not in question. All 18 rows in Mod Loader
`tests/fixtures/webgame/native-hub-trader-ui-captures.json` and the standalone
`inventory-screen.png` witness revalidated at 1600 by 900 with their committed
SHA-256 digests. The 4,723,200-byte retail executable independently revalidated
on Windows and the Mac mini as
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`.
The corrective gate is therefore stricter: recover each affected native
renderer/input owner, revise this ledger before implementation, add immediate
post-purchase companion-inventory coverage for every purchasing service, and
report deterministic region-level pixel deltas rather than accepting visual
inspection alone.

The second-pass RE closes the three residual owners before browser changes:

- `0x00562520` owns the stats pane. It submits spell name, damage, mana cost,
  and mana heal at native local y=205, 226, 239, and 252. The settled companion
  transform `(-10,+46)` makes the exact browser-stage baselines y=251, 273,
  286, and 299; visible `MANA HEAL` glyphs end at y=300. `/ SEC` and
  `/ SECOND` are inline ExactText continuations appended by `0x00663b30`, not
  full-size text: scale 0.7, offset `(0,1)`, italic. The heading uses the
  26-square font group. Content uses natural-size 32-square glyph quads with
  horizontal cursor/kerning advance 0.9, so the nested unit run advances at
  0.63. Standalone content submits at x=95 and first appears at x=96;
  companion content submits at x=148 and first appears at x=149. The heading
  and body are distinct opaque primitives at `(86,207,227,24)` and
  `(86,230,227,79)`, shifted 53 pixels right in companion mode, preserving the
  native divider.
- `0x00561300`, `0x005504d0`, and `0x00575450` own all seven equipment sinks,
  their rectangles, and the class-painter clipping boundary. Companion centres
  are hat `(1337,179)`, robe `(1337,277)`, weapon `(1257,259)` and
  `(1417,259)`, amulet `(1270,192)`, and rings `(1270,326)` and
  `(1404,326)`. Hat/weapon sinks are 72-square `Inventory.10`, amulet/rings are
  46-square `Inventory.9`, and robe is the 72 by 108 tall primitive at
  `(1301,223)`. Each begins with native opaque `(0.1,0.1,0.09,1)` and clips
  its natural-size class painter. The tall outline is `0x004a2ff0` through
  `0x004153b0`; `0x0041dd70` fills the sink and `DAT_00819e5e` brackets the
  robe class paint. Backpack, store, storage, and dowsing grids
  apply the same item clip; the detached dragger does not. Green accepting
  sinks appear only for a compatible held object, never for selection alone.
- `0x00514a20` attaches a separate InventoryScreen beneath every service.
  `0x0056f760` keeps that companion grid selectable and double-activatable while
  Shop, PerkShop, InventoryShop, or either DowsingShop state is open. Ordinary
  `0x0056bf70` and dowsing `0x0056d110` purchases insert the purchased live
  object through `0x0055ff20` and rebuild the companion screen; Hagatha's
  `0x0056c340` applies the perk and rebuilds the charm pane instead. Shop,
  companion-inventory, and Luthacus-storage selections are separate native
  owners and therefore require separate web state.

The corrective implementation was compared literally at 1600 by 900 against
the standalone retail witness using a matching Air/Arcane browser profile.
`frontend/tools/compare-native-ui-captures.mjs` decodes both PNGs, searches a
bounded translation, and writes raw JSON plus half-overlay and threshold-diff
PNGs. With channel threshold 16 and a +/-3-pixel search, every reviewed region
settled at offset `(0,0)`:

| Region | Mean absolute channel delta | Pixels over threshold |
| --- | ---: | ---: |
| PRIMARY SPELL pane | 21.4277 | 41.5253% |
| PRIMARY SPELL body | 25.0412 | 38.8780% |
| EQUIP pane | 10.2722 | 40.5203% |
| robe sink | 10.5521 | 25.9398% |
| backpack/grid | 4.8741 | 8.7542% |

Those are raw raster deltas, not a subjective score or a pass threshold. They
retain Direct3D-versus-WebGL sampling/color differences and the independently
timed player preview, while the zero best offsets prove that the compared pane,
sink, and grid geometry no longer drifts. The associated Mac browser run also
exercised selection, delayed ItemInfo, second activation, drag, equip, and
restoration on newly purchased objects before closing each applicable trader.

## Reported smell and parity question

- Reported web behavior: `/game` has no usable inventory, gold ledger, merchant
  dialogue, merchant screens, or authoritative purchase/transfer path; three of
  the four trader actors are also static.
- Stock behavior to recover: the complete participant-owned inventory and hub
  merchant service system, including every authored catalog member, lifecycle
  branch, interaction geometry, dialogue, screen layout, and actor animation.
- Reproduction scenes: a new Survival College profile, Courtyard Hagatha,
  Fomentius, and Luthacus, plus Library Shlorio; a second participant falsifies
  shared-ledger behavior.
- Falsifiable questions: whether stock is participant- or world-owned; whether
  reopening restocks; whether rejection is atomic; whether Luthacus charges or
  copies; whether dowsing close refunds; whether dormant rows are reachable;
  and whether each apparent still actor owns a larger animation bank.

## Evidence and provenance

| Clean stock | committed G8 hub-trader fixture, three clean retail instances and two-owner transaction runs | initial stock/fees and participant-local mutation | high |
| Instructions | retail functions `0x004fb890`, `0x00501610`, `0x00505010`, `0x0050b720`, `0x0055faf0`, `0x0056bf70`, `0x0056c340`, `0x0056cd00`, `0x0056d110`, `0x005c8960` | constructors, reachability, animation, range, stock, debit, transfer, dowsing, teardown | high |
| Runtime | prior injected-loader `sd.debug` G8 captures against retail 0.72.5 | gold/backpack/storage changes remain local to the initiating native profile | high |
| Asset/data | retail dialogue files; College 10, 45, 54..58, 89..92, 126..129, 160..164, 517..524; Library 21..24; Inventory/Skills/UI records; complete perk/item catalogs | exact copy, animation membership, item identity, and UI art membership | high |

The preferred image base is `0x00400000`; those are preferred image addresses,
not ASLR runtime addresses. The settled InventoryScreen witness described
below came from a process whose executable independently matches the retail
digest above.

## System boundary and membership inventory

Native system: participant-owned inventory/equipment state and the four hub
merchant actors/services that inspect or mutate it, from world activation
through modal teardown. Item use, combat-stat effect application, ground loot,
and persistence production are downstream or upstream systems, not merchant
transactions.

| Member (class/variant/scene/branch) | Native source | Shipping disposition | Proof required or retained |
| --- | --- | --- | --- |
| Player gold, backpack, storage, stable objects, starter stacks | profile/inventory roots; `0x0055ff20` | exact-ported | fresh-player, stack, and two-owner tests |
| Fomentius nine-row stock generator and ordinary buy | `0x005c8960`, `0x0056bf70` | exact-ported | complete rows, seeded stock, atomic tests |
| Hagatha 28 catalog rows, visible 27, bundle -1, prices/capacity | perk catalog; `0x0056c340` | exact-ported; selector 8 out-of-system because native excludes it | catalog, price, rebuild, bundle tests |
| Luthacus backpack/storage transfer | `0x0056cd00` | exact-ported | two-way/no-gold/no-copy tests |
| Shlorio fee, untargeted offers, buy, clear, close | `0x0055faf0`, `0x0056d110` | exact-ported | complete 47-recipe lifecycle tests |
| Six equipment classes and seven equip sinks | item catalog; `0x00570cd0`, `0x00575850`, `0x00570d80`, `0x0066f020` | exact-ported | per-class/per-sink tests |
| Shop/PerkShop/InventoryShop, both Dowsing states, InventoryScreen, trader Chat, and trader MsgBox presentation | full vtable/renderer family recorded below; Inventory/Skills/UI/Fonts/Clothes art | exact-ported; second-pass closure 2026-08-20 | owner-level render/input tests, per-service post-purchase activation, zero-offset deterministic pixel receipt, and full Mac browser acceptance |
| Four reachable introductions and commands | survival dialogue data; `0x0050b720`, `0x004fb890` | exact-ported | exact-copy and reachability tests |
| Fomentius actor/balloon | `0x0050b110`, `0x0051c1a0`; College 54..58, 160..164 | verified-already-at-parity | existing presentation/render tests |
| Hagatha body, accessory, and cross-fades | `0x0051adc0`, `0x0051b1d0`; College 45, 89..92, 517..524 | exact-ported | every-bank-member animation tests |
| Luthacus common animation composite | `0x0050a4c0`, `0x00501610`; College 10, 126..129 | exact-ported | four-frame composite test |
| Shlorio common animation strip | `0x0050a4c0`, `0x00501610`; Library 21..24 | exact-ported | four-frame private-room test |
| Range/fade/region interruption and modal/input teardown | `0x00505010`, `0x00514a20` | exact-ported | authority and UI lifecycle tests |
| `Outfit me Randomly` / `!RANDOMEQUIP` | dormant scavenger data row, absent executable literal/dispatcher branch | out-of-system (not wired by retail builder) | builder and full literal/xref sweep |
| Targeted dowsing | `DowsingShop+0x344`; drop virtual slot `+0xC8 -> 0x00568080` | exact-ported; earlier unreachable disposition superseded by report39 | September 27 native trace, regressions and built desktop/touch acceptance in ledger203 |
| Item use, ground loot, archival and account persistence | separate inventory/save consumers | out-of-system (separate gameplay/save systems) | ownership boundary trace |
| 86 equipment FX declarations and Clothes attachments | item catalog and downstream consumers | out-of-system (separate combat/stat/render systems) | complete catalog retained |
| Annalist, Librarian, Arch Chancellor, Painting animator siblings | remaining common-animator xrefs | out-of-system (non-trader actors/props) | complete shared-function xref sweep |

The 2026-08-15 trader pass uses retail `0.72.5` `SolomonDark.exe`, SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`.
Static evidence comes from the checked-in Ghidra project and exact retail data
files; the prior G8 live fixture corroborates the initial trader state and
transactions. A byte-identical retail process supplied the settled
1600x900 InventoryScreen witness now committed in Mod Loader as
`tests/fixtures/webgame/menu-reference-captures/inventory-screen.png`, SHA-256
`0d99c6bb3f1815aa061fd4ee49e7bfccbd0ee058ea69b0e8936155c7e5156d8b`.
The complete trader/Chat witness set is recorded in Mod Loader
`tests/fixtures/webgame/native-hub-trader-ui-captures.json`. Those later images
are explicitly debugger-instrumented/runtime-staged: a temporary helper invoked
stock constructors and staged gold/dialogue state, while the byte-identical
retail executable and native renderers produced every visible surface.

## Full stock UI correction and recovered screen family

The first implementation pass correctly ported the participant economy and
transaction lifecycle but rendered it through `ModalFrame`, visible HTML
headings/buttons, CSS-generated leather/gold framing, and a 28-cell backpack.
Calling that presentation exact was wrong. The new stock witness and complete
class sweep show that inventory, shops, dowsing, and trader dialogue are a
single native presentation family with distinct owners:

| Surface | Native owner and vtable | Required renderer/lifecycle closure |
| --- | --- | --- |
| Fomentius | `Shop`, `0x00794D7C` | ctor `0x0055E800`; alpha/slide `0x00550D80`; root `0x00557D40`; grid `0x00550DB0`; item detail `0x00565E00`; action `0x0055EF40` |
| Hagatha | `PerkShop`, `0x00790374` | common Shop plus rebuild `0x0055F270`, detail suffix `0x00554690`, purchase `0x0056C340` |
| Luthacus | `InventoryShop`, `0x0079044C` | common Shop plus two-owner transfer `0x0056CD00` |
| Shlorio | `DowsingShop`, `0x00790524` | ctor `0x004F5AB0`; update `0x005512F0`; rebuild `0x0055F9F0`; pre/result root `0x00558160`; grid `0x00554E20`; flash `0x00551350` |
| Inventory | `InventoryScreen`, `0x00794F54`, with `InventoryGrid`, `0x00794C64` | ctor `0x00560380`; update `0x00551A10`; close `0x00555810`; root `0x00568B90`; detail/help `0x00556940`; grid `0x0055A070` |
| Trader talk | `Chat`, `0x0079061C` | ctor `0x004F5D90`; init/update `0x004FFEC0`/`0x004FFEE0`; render `0x004F9380`; pointer/action `0x004FFBC0`/`0x004FFC40`; advance `0x004FFB00`; close `0x004FCB40` |
| Trader error branch | `MsgBox`, `0x00788E04` | ctor `0x004A98E0`; fade `0x005AB710`; root `0x005C4530`; line/primary/secondary builders `0x005BCCB0`/`0x005AB7E0`/`0x005AB980` |

All browser surfaces render in one fixed 1600x900 native stage using the exact
Fonts, Inventory, Skills, UI, and player/Clothes art. HTML remains only as a
transparent semantic input layer aligned to native controls. The common Shop
settles from a 100-stage-pixel vertical slide at `(498,-20,604,430)`; its
UI-49 background pass alone is 400 pixels high. Every
service dispatcher branch separately constructs and attaches a full
InventoryScreen beneath its class-specific overlay. Its retained capacity is
28 and its visible StoreGrid is seven columns by four rows, filled
column-major. The `4,2` call at `0x00550DB0` is the repeat count passed to
texture helper `0x00416020` for UI record 49; it is not grid geometry and does
not justify paging. Dowsing switches result layout to three columns and retains
nine offers.

The renderer-state passes are part of that contract. Backpack
Inventory-record-10 cells are white at alpha `0.4`; common StoreGrid and
Dowsing result cells use alpha `0.6`, while contained item sprites remain at
their own opacity. Affordable prices and shared gold labels use native
`(0.85,0.73,0.44,1)` (`#D9BA70`), and unaffordable prices use
`(1,0.5,0.5,1)` (`#FF8080`). The DONE stack draws UI 72 white, UI 12 at
alpha `0.85`, UI 86 tinted `(0.75,1,0.75)`, then white text. Hagatha's
companion pane paints `(139,129,227,238)` opaque `(0.1,0.1,0.09)` with a
one-pixel white outline instead of UI 49; empty 0.8-scale cells are 50-percent
gray, occupied cells are white, and owned Skills record `127 + selector`
sprites occupy them.

Trader conversation is not a MsgBox. `Chat` uses the UI-record-11 nine-slice
at `(476.5,26,647,420)`, content rect `(561.5,111,477,250)`, and no full-screen
curtain. Helper `0x00417760` mirrors the full quadrant at the four corners,
stretches the rightmost 5-percent UV strip across the horizontal edges, the
bottom 5-percent strip across the vertical edges, and the bottom-right
5-percent square across the interior. It is not four sprites over a generic
black rectangle. Chat's default text uses `#D9BA70`; the primary action keeps
the authored `_c(.55f,.75f,.55f)_s(1.25)` color and scale. Alpha advances
`0.05` per 100 Hz tick. Intro copy scrolls at 0.125
pixels per tick, or 0.8 while accelerated; natural completion or SKIP reveals
questions. A price answer starts another scrolling intro and returns to the
same questions. A command answer replaces Chat with the service. The distinct
MsgBox still advances `0.035` and draws a `0.75 * alpha` curtain for the
insufficient-dowsing branch.

The settled InventoryScreen witness proves an opaque black screen, STATS and
EQUIP upper corners, a central seal and live wizard/equipment preview, Kills
and Awesomeness, an 88-slot 22-by-4 BACKPACK, bottom gold ledger, belt, and
exit control. Those 88 slots are authored column-major: indices 0 and 1 occupy
the first column's first two rows. Its reveal advances by `0.025` per native
tick. Trader MsgBox
surfaces advance by `0.035` and draw a `0.75 * alpha` black curtain. The full
mandatory state membership is: four introduction/choice dialogues and the
Hagatha/Shlorio price explanations; Fomentius 28-cell grid/detail/buy/reject;
Hagatha 28-cell grid/detail/first-mix/bundle/capacity; Luthacus both owners and both
transfer directions; Shlorio pre-roll, insufficient funds, result, roll flash,
and close-discard; Inventory selection/detail, seven equip
sinks, unequip, belt, and close; affordability/selection/focus; and
range/region/fade teardown. No responsive modal or visible generic browser
control substitutes for those members.

The closing Website renderer uses Pixi/WebGL for every visible member above.
Its fixed stage loads all 84 Inventory, 166 Skills, and 113 UI records plus the
native bitmap fonts and player/Clothes sources. The HTML tree is limited to
transparent, stage-aligned semantic hit targets and accessibility text. The
inventory stat pane resolves the equipped elemental primary from the recovered
skill rows for all five elements, including the native damage, mana-cost, and
10-per-second mana-heal lines; it no longer substitutes current health/mana or
the element-root skill name.

The Dowsing flash belongs to both accepted state-changing actions.
`0x0055FD99` writes `1.0` to `DowsingShop+0x360` after an accepted roll and
`0x0056D194` writes the same value after an accepted offer purchase.
`0x005512F0` subtracts the image double `0.05` each 100 Hz tick, and
`0x00551350` draws a full-screen `(1,0,0,alpha)` rectangle. Each trigger
therefore lasts 20 ticks, or 200 ms. The fee
rejection is an actionable native branch rather than a disabled button:
`0x0055FAF0` builds a MsgBox titled `NOT ENOUGH GOLD!`, adds the recovered
compensation paragraph, and uses executable literal `OKAY` at `0x007930D8`
without mutating the participant economy.

The Dowsing result field is deterministic renderer time, not per-frame noise:
UI 49 keeps red and blue at 1 and computes green as
`sin(nativeTick * 0.5 * pi / 180) * 0.1 + 0.7`, spanning 0.6..0.8 over 720
ticks. Its pre-roll UI-101 body and mirrored UI-54 ends stay white; only DOWSE
and `%d gold` are gold. `UiPanel_Render` `0x005C3F40` builds the MsgBox frame
from horizontal UI 10, vertical UI 79, and UI 107..110 corners, but that base
pass is not the entire MsgBox composition. `HoverBox` construction at
`0x005C38F0` enables object byte `+0xB8`; the MsgBox constructor leaves it set,
so render branch `0x005C46E5..0x005C4818` repeats UI 49 into the clipped rectangle
`(535.5,158,529,384)` and then calls nine-slice helper `0x00417760` with UI 17
over `(540.5,163,519,374)`. The UI atlas array starts at object offset `+0x38`
with stride `0xC4`, making the branch operands `+0x25BC` and `+0x0D3C` records
49 and 17 exactly. Stock therefore owns the textured interior and continuous
gold inner rails; the companion InventoryScreen/service only remains visible
outside that interior beneath the curtain. The MsgBox button art is white and
only its label is gold.

## Participant-owned inventory and temporary gold override

Native gold and inventory are participant-owned profile state which survives
region replacement. The Website must keep the same ownership boundary in its
authoritative player entity component and replicate a read-only projection to
clients. Hub transaction messages identify an intent only; the server resolves
the authenticated participant, active hub region, target range, current offer,
price, funds, and destination capacity before one atomic mutation.

Protocol 30 carries the complete economy in the welcome and periodic recovery
keyframes, then omits it from ordinary player frames while that player's economy
revision is unchanged. A changed revision carries the complete replacement and
the client reconstructs it against its last accepted baseline. This keeps the
participant-owned state authoritative without repeating the multi-kilobyte
Fomentius/Hagatha catalogs on every 20 Hz movement snapshot.

For this milestone, every newly created Website participant starts with
exactly **10,000 gold**. This is an explicit product override requested on
2026-08-15, not a recovered native starting value. It is intentionally a
single named constant so a later persistence/economy pass can replace it.
Each new participant also starts with the recovered two one-unit potion stacks:
Health Potion in backpack slot 0 and Mana Potion in slot 1.

Backpack entries carry a stable participant-local ID, native item/type identity,
display name, icon record, stack count, and any offer provenance needed by the
UI. Storage is a second participant-owned container. Gold is never represented
as an inventory stack. Potion-like identical entries stack on insertion;
equipment and perk offers do not. Shop views may group equivalent stock for
display, but buying one removes and transfers exactly one native stock object.

## Actors, animation, and interaction

The service actors and recovered hit circles are:

| Actor | Region | Root | Radius | Service title |
| --- | --- | --- | ---: | --- |
| Hagatha | Courtyard | `(1340,280)` | 15 | `HAGATHA'S CHARMS AND CURSES` |
| Fomentius | Courtyard | `(1397,664)` | 30 | `FOMENTIUS' USEFUL THYNGS` |
| Luthacus | Courtyard | `(1700.5,449.5)` | 25 | `LUTHACUS' SCAVENGED GOODS` |
| Shlorio | Library | `(900,642.5)` | 25 | `SHLORIO'S DISCOUNT DOWSING` |

Pointer activation uses those actor circles. Keyboard activation chooses the
nearest in-range service. Both client presentation and server authority use the
native engagement boundary:

```text
distanceSquared(player, actor) <= 5 * actorRadius^2 + 1500
```

Opening a dialogue blocks spell/movement input. Moving outside that boundary,
changing region, or entering a region fade closes it. Service selection
replaces the dialogue with the shop/storage view. The exact introductions and
choice labels come from the runtime-loaded aggregate
`data/dialogue/survival.txt`; retained per-NPC fragments differ in places and
are not runtime authority. No invented merchant copy substitutes for it.

Luthacus renders College record 10 composited with records 126..129, and
Shlorio renders Library records 21..24. Their recovered common idle animator
has a 1-in-200 trigger, a `(Float(3,false)+1)*0.45` phase speed, and a
180-degree easing cycle selecting the four-frame strip. Hagatha continuously
loops College records 517..524 from phase speed
`(Float(0.25,false)+1)*0.05`, wrapping at eight. A native
`Integer(1500)==3` draw persistently reverses that velocity's sign; it does not
double the speed. College 89..92 cross-fade decoration is presentation state
rather than economy state. Multiplayer clients derive the visual loop from
snapshot/tick time and never mutate trader stock from an animation event.

## Service behavior

Fomentius generates stock only for initial hub creation and post-run return.
The exact ordered generator is Health Potion 150 (2..4), Mana Potion 75
(2..7), Rejuvenation Potion 200 (0..2), Dye 300 (2..3), Key 1200 (one on
`Integer(18)==1`), Sack 50 (1..2), Antidote 100 (1..3), Wizard Chug 2500 (one
on `Integer(8)==3`), and Mind Chug 1500 (one on `Integer(8)==3`). Opening and
closing the shop never restocks it.

Hagatha exposes selector IDs 0..27 except 8 from the recovered perk catalog.
Owned selectors disappear on rebuild. A selector's first-ever mix costs three
times its base price; after its persistent first-mix flag is set, a later mix
costs the base price. Capacity and funds are
validated before debit; success advances that participant's owned/rank and
first-mix state. The Website inventory milestone records the recovered perk
progression transaction and exposes it in the inventory. Combat effects that
are not already represented by the player stat/skill model remain separately
gated rather than being guessed.

Luthacus transfers a selected object backpack-to-storage or
storage-to-backpack. The operation neither reads nor changes gold, creates no
copy, and preserves stacking semantics.

Shlorio's initial fee is the live-observed explicit value 650. A DOWSE action
rejects insufficient funds without mutation, otherwise debits once and creates
three or four unique offers from the recovered 47-equipment recipe catalog.
Offer prices are 5000..5700 in 50-gold increments. Buying one uses the common
atomic purchase path, clears all remaining offers, and rolls the next fee in
500..950. Closing a paid result loses those offers without refund. The
targeted branch is reachable through the inventory drop dispatcher and
`DowsingShop` virtual slot `+0xC8 -> 0x00568080`, which writes `+0x344` after
the reference-well hit test. The earlier constructor-only reachability claim
was wrong. Raw instructions also contradict the claimed deterministic union:
each same-set/same-type helper builds an eligible pool and chooses one random
member. The caller requests two same-set choices followed by three or four
same-type choices, then prices the completed offer list. Ledger203's September
27 reopening records the completed correction and its WSL acceptance.

All purchases are buy-only. There is no sale, refund, or buyback action. The
seven-column common shop and three-column dowsing layouts display replicated
participant gold. First activation selects a cell; activating that same cell
again invokes the class callback. Unaffordable cells remain selectable and use
the stock NEED MORE GOLD overlay instead of a disabled browser control; the
server still rejects the second activation atomically. A rejected action
changes neither gold, inventory, offer stock, perk state, nor dowsing state.

## Focused acceptance boundary

Required automated coverage pins 10,000 starting gold, the two starter stacks,
exact Fomentius roll order/ranges, atomic success and rejection, Hagatha price
progression, two-way storage transfer, Shlorio fee/offer/purchase lifecycle,
participant isolation, protocol validation/copying, and recovered animation
frame selection. Browser acceptance must enter the hub as an ordinary player,
open a trader through world interaction, buy an item, observe gold and
inventory update, transfer it through Luthacus, complete one dowsing purchase,
capture the successful full-red roll frame, reach the exact insufficient-gold
MsgBox without mutation, equip and unequip the purchased item, and show that a
second participant's 10,000-gold ledger and starter inventory are unchanged.
`frontend/tools/smoke-hub-traders.mjs` owns that complete browser receipt and
fails on any browser-console/page error. Native-equipment
combat effects, dormant random outfitting,
selling, and persistent account storage are not silently invented by this
milestone.
