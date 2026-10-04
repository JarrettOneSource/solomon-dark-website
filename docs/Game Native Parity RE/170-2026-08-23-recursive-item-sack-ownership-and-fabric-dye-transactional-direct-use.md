# 2026-08-23 — Recursive Item_Sack ownership and Fabric Dye transactional direct-use

## 2026-09-24 — Report 24: Book of Skill result ownership reopening

The previous book closure proved consumption and rank mutation, but did not
recover the complete caller tail, confirmation, acquisition stream, or the
native distinction between effective and permanent eligibility. This reopening
covers both Item_Misc books and the shared random-rank selector, not general
sack navigation (report 22 is separate).

### Evidence and recovered contract

Report `1552401881559732317` and its unchanged video are retained in the M2
archive `2026-09-23/24-skill-book-no-notification`. Video SHA-256:
`017dd522b995ae4df494c625d617cad1ae65b78071e585b0e8902dc0a151be85`.
The submitted clip lacks a save or readable before/after skill census, so it
cannot establish lost progression. A fresh unchanged-build Chrome reproduction
in College consumed subtype 3 and increased Frost Jet from rank 1 to 2, then
closed Inventory with no confirmation dialog. Page/console/HTTP/host errors
were empty. The first two multiplayer fixtures did not open Inventory and are
not accepted evidence of this defect; their setup is being corrected separately.

Retail 0.72.5, preferred base `00400000`, 4,723,200 bytes, executable SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, was read
on M2 through the existing `sdr-ghidra-headless` unique read-only replica wrapper.
Its SHA-256 is `26015c74981f7bc23556808b42eed2801e09c554357b8da57c8480c2aa2f9da3`.
Raw range listings, constant bytes, complete dispatcher xrefs and shared helper
instructions are task scratch, not changes to Mod Loader. The decompiler's
incorrect Array<int> nonreturn inference hides the caller tail; the actual
instructions at `0056D531..0056D857` are the evidence, not that incomplete C.
No new clean-stock runtime recording is claimed.

* Both books are type 7012. Subtype 2 uses Inventory record 44 and subtype 3
  record 45; names are both `Book of Skill`. Root and nested item lookup share
  dispatcher `0056D1B0` and exact-ID consumption. Dye/key siblings are unchanged.
* Both branches remove the book, play `SoundStream +13BC` at gain one
  (`0056D471`, `0056D828`), and close Inventory. The fresh binder at
  `004F0A90..004F0AAC` identifies `sounds\magicbookget__stream.wav`, registry
  129, 185,716 bytes, SHA-256
  `ab0ac9b19633d93575673f61893c5e7ba509ec315263a9b39378a494ed575999`.
  The neighboring magicbook stream 130 is world-Bonus birth, not book use.
* Subtype 2 calls `0067C320`: increment pending skill count, instantiate the
  existing picker if absent, retain its native acquisition/offer clocks. It
  does not create a rank-result dialog.
* Subtype 3 scans every skill ID 8..81 in ascending order. Entry effective
  rank `+22` must be positive and permanent rank `+20` must be strictly below
  definition maximum `+58`. Thus equipment-only effective grants can qualify.
  The fully extracted native skill/stat catalog already owns every row and cap;
  no new guessed per-skill table is introduced. Empty eligibility still consumes
  the book and plays the stream, but creates no grant, random draw or dialog.
* With a nonempty list, `0056D549` selects one ID using the existing shared
  native Integer routine. This is random, **not a player-selected improvement**.
  The shared world Bonus-kind-1 branch `005D5910` has the same effective/base
  eligibility and random grant, but only the world text (no confirmation).
* Before `00660320(id,1)` / refresh `0065F9A0`, the book caller queues
  `<skill name> +1` via `005CA7C0` with RGB `(0.5,0.5,1)` and creates a MsgBox.
  It contains `Skill improved` (menu font, RGB `.7,.7,1`, gap 10), then the
  same `<skill name> +1` (medium font, same tint, gap zero), and one `OKAY`
  button. Strings are at `0079542C`, `0079543C`, `007930D8`. The message uses
  the shared auto-sized single-action layout centered at `(800,450)` in the
  canonical 1600x900 stage. `00461E60` derives half-width/half-height and
  MsgBox vtable `00788E04 +B4 -> 005AB2C0` takes padding 25, not a Y offset.
* Authority must publish the actual selected skill alongside accepted action
  feedback. Presentation cannot guess it from a later rank diff or perform
  another random draw. The result owns the existing Inventory pause until
  acknowledged, so closing the inventory cannot start multiplayer Resuming
  before the result is visible. College remains locally modal, never globally
  paused. Stale/replayed/rejected/other-player receipts do not replay results.

### Recovered membership and implemented dispositions

| Member | Native source | Final disposition and proof |
| --- | --- | --- |
| Both book definitions, root/nested consumption and stale-ID rejection | 7012 subtypes2/3, `0056D1B0` | exact-ported: atomic consumption, actual outcome, both browser flows |
| All74 rows8..81, absent/effective-only/permanent/capped states | `0056D4B6..0056D52F`, complete native catalog | exact-ported: per-row assertions, equipped-only grant and provider-removal test |
| Random rank selection and acquisition RNG | `0056D549`, `00660320` | verified-already-at-parity: exact selection/order retained; book and Bonus helper RNG agree |
| Empty rank candidates | `0056D531 -> 0056D7CA` | exact-ported: book consumed, explicit empty outcome, no fabricated rank/message/RNG |
| Bonus skill point and ordinary picker | `0067C320` | verified-already-at-parity for grant; exact-ported acquisition stream, existing picker verified |
| World Bonus-kind1 random skill | `005D5910` | exact-ported shared eligibility; existing world text/no-MsgBox unchanged |
| Book acquisition stream129 | binder `004F0A90..004F0AAC` | exact-ported: identical WAV hash, actual BufferSource starts at rate1 |
| Bonus birth stream130 | separate native sound owner | out-of-system: unchanged |
| Named rank confirmation and world text | `0056D570..0056D7A0` | exact-ported: all-row MsgBox layout, common text clock, inspected mouse/touch frames |
| Owner-only receipt, duplicate/stale snapshots and teardown | native owner fields, web authority | exact-ported: strict wire, sequence cursor, scene/owner/session reset |
| Boneyard result hold and College local modal | caller close+MsgBox, existing web pause | exact-ported: two-client tick held through result, one OKAY resumes; College stays local |
| Current/legacy feedback persistence | existing save migration | exact-ported: schema42 strict outcome; old presentation retired, ranks/items/RNG preserved |
| Dye, keys, sacks, ordinary Skills panel and book-ineligible belt | distinct subtype/type gates | out-of-system: preserve existing behavior and report22 changes |

No new browser-platform approximation is required. The authoritative action
receipt carries the selected skill; presentation does not infer rank changes
or draw randomness. The complete table above replaces the earlier provisional
inventory. Final integrated full-gate and publication receipts follow below.

### Implementation and browser acceptance

Protocol136 adds a strict `skillBookOutcome` to the existing player-owned action
receipt: `choice`, or `rank` with the actual selected ID/null. It is finalized
in the same transaction as removal and skill grant. Non-book actions carry
null; malformed combinations are rejected. Save schema42 reuses the strict
decoder. Earlier book receipts are retired, never assigned a guessed historical
skill. That migration changes no rank, inventory object, or saved gameplay RNG.

The root scene owns the result independently of Inventory. Its existing
Inventory pause remains active until OKAY, and only the recipient's receipt
can trigger the result/audio. Initial/restored or repeated receipts do not
replay. Scene/owner/session teardown clears the result and stream. The common
world-text owner supplies the native clock/color. Its unchanged CSS is now
loaded by the shared bitmap-text component so College does not depend on a
Boneyard-only lazy chunk. The result uses the existing MsgBox/DataLine/Button
owners; its button has the same active pointer seam as other native controls.

Before final integrated validation, Chrome153.0.8010.53 on M2 passed College
1600x900, nested two-client Boneyard1600x900, and nested touch844x390 journeys.
Every journey consumed both book types. Rank books changed exactly the named
skill once, emitted one native acquisition buffer, showed the confirmation,
and accepted real OKAY clicks/taps. Choice books used the ordinary picker and
granted the chosen skill only on selection. Each journey observed exactly two
book audio starts and empty page/console/HTTP/request/wire/host error arrays.

The Boneyard test entered through ordinary College and Solomon interactions.
While the guest's rank result was displayed, authoritative tick stayed fixed
and resume grace stayed `none`; OKAY released the pause and gameplay advanced.
The other player received no result, audio or rank mutation. The fixture only
adds exact stock book items and replenishes health during inspection; it does
not alter grant/offer RNG, caps, spell or loot behavior. Touch is Mac Chrome
emulation, not physical-device acceptance. Desktop and touch result frames
were visually inspected.

Two acceptance findings were corrected before this passed receipt: the audio
probe initially expected HTML media whereas native streams use WebAudio; it
now observes real buffer starts at rate1/positive gain. The first modal also
inherited a pointer-inert stage; its native OKAY hit target now works without
weakening modal isolation. The failed fixtures are not successful evidence.

Maintained command, from frontend after a production build:

```sh
SDR_ITEM_SKILL_BOOK_OUTPUT=/tmp/solomon-item-skill-books \
node --experimental-strip-types tools/smoke-item-skill-books.mjs
```

No fresh clean-stock runtime/pixel capture or production deployment is claimed.
The original report does not contain enough state to prove a lost rank; the
unchanged-build reproduction verifies an actual grant with missing feedback.



### Integrated acceptance fixture correction

The first integrated candidate `084b1a2271b68aefc88814c6354bd022b2307f88`
passed the complete canonical M2 gate with exit0, including24 backend/Website
and3,808 frontend/desktop tests. Its post-gate browser then exposed an
out-of-band test setup race: the second injected book existed in authority,
but Inventory paused before that book reached the owner's cached snapshot.
The book was not lost and no grant had occurred. A diagnostic that allowed the
next authority update passed without changing runtime.

The maintained acceptance helper now waits for the injected item's actual
owner-only replicated inventory before opening Inventory. It uses the existing
wire reconstructor, not a guessed delay or a production compatibility path.
All three journeys subsequently passed, including the exact prior failing
Boneyard sequence. This correction changes only the browser helper and ledger;
all runtime, asset, protocol, save and unit-test bytes remain identical to084b1a22.
The final exact-tree gate is repeated below for the corrected helper candidate.


### Final integrated M2 acceptance and resumed closeout

Candidate `713b9e62eee31f39a23e14dd44c988bb10dd7c91` completed the canonical
`/opt/homebrew/bin/bash ./scripts/validate.sh` with exit zero on M2. All
7,188 tracked files matched the candidate's frozen SHA-256 manifest both
after the gate and during resumed review by Fleet `c48vi697` (original task
`qbpltokc`). The gate passed 24 Website/backend integration tests and
3,808 frontend/desktop tests, backend/frontend production builds, format/lint/
type/boundary checks, production media policy, and full renderer quality and
mutation checks. The renderer report contains no failures or surviving mutants.
The preceding focused book/progression/protocol/save/text/audio suite passed
446 tests; those results are not additional disjoint full-gate coverage.

The post-gate production Chrome `153.0.8010.53` journey also exited zero.
College desktop, two-client Boneyard, and touch-emulated College each consumed
both stock book variants, with root and nested inventory coverage. Each rank
book reported the actual selected skill, changed exactly that permanent rank
once, played one registry129 stream, displayed the native confirmation and
accepted a real OKAY click/tap. Choice books used the existing picker and
played the second acquisition stream. In the two-client case, the result held
the authoritative tick and prevented premature Resuming until acknowledgment;
the other player received no grant, result or acquisition sound. Every
host/page/console/HTTP/request/protocol error array was empty. Final multiplayer
and touch result screenshots were inspected during closeout. Touch acceptance
is Chrome emulation on M2, not a physical mobile-device claim.

The source Discord message still matched its archived text and attachment ID;
the original video SHA-256 remained unchanged. The report does not provide a
save or before/after ranks, so this receipt does not retroactively establish a
lost historical skill grant. The baseline reproduced an actual rank grant
with missing feedback. Native behavior is grounded in the verified retail
instructions, tables and original audio bytes, not a new clean-stock recording.
No new browser-platform approximation is introduced.

Full-gate log SHA-256: `0eedf9d50a6676995b04e91afa778eb16e3d5d5d5e30db523a0bd2137b63e016`.
Post-gate browser receipt SHA-256: `b150401e6b454d24fd88bafd607e099b334e13e8d9816f0379b5a0321d80c6f2`.
This final documentation follow-up changes no runtime, test, asset, protocol,
save or build-input bytes from the accepted candidate. Publication, authorized
Discord reaction and task-cleanup outcomes are recorded separately in the M2
archive `STATUS.md`; local acceptance is not a production deployment claim.


## Reopened system and parity question

Issue 18 reported that sacks and dyes do not work. This reopens the complete
inventory tree: the earlier Inventory/Unforge pass left recursive Sack
movement outside its boundary, while the ItemInfo pass treated `Item_Misc`
subtype 0 as presentation-only. One native ownership tree feeds projection,
drag/drop, direct-use, DyeClothing, serialization, participant replication,
HUD potion lookup, storage, and bot observation. The web port must preserve a
live item's identity at every admitted depth and complete a cancel-safe Fabric
Dye transaction against recursively owned Hat/Robe items.

The 2026-08-23 implementation audit also found four integration failures in
the first candidate and reopens them before code changes:

- `/game` requests an authoritative `inventory` pause while the screen is
  open, but the host allowlist omitted `move-inventory-item` and `dye`, so the
  production host silently discarded both headline actions even though a
  direct-simulation fixture accepted them;
- a move validated only its source tree and could combine two admitted trees
  into a result deeper than the protocol's 32-level replication bound;
- DyeClothing retained the selected-swatch outline after the native 20-update
  pulse expired;
- the browser fixture bypassed the host, omitted the presentation-frame-loop
  import, clicked only two swatches, and committed only Cloth while claiming
  all 18 swatches and both layer transactions.

## Evidence, ownership, and provenance

- Retail source: stock Solomon Dark 0.72.5, 4,723,200 bytes, preferred image
  base `0x00400000`, SHA-256
  `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`.
- Static addresses were recovered through the read-only Ghidra replica
  workflow against the canonical `SolomonDark.gpr`; no task worktree owns a
  second imported project.
- `Item_Sack` is type 7008 / `0x1B60`. Constructor `0x005A7520` embeds its
  child `SdItemListRoot` at `+0x88`; accessor `0x00570C10` returns that root;
  serializer `0x00570C20` serializes it.
- `InventoryScreen_Ctor` `0x00560380` recursively walks every Sack child root.
  Recursive lookup `0x00552650` descends only type `0x1B60`.
  `Inventory_InsertOrStackItem` `0x0055FF20` relinks the exact live object;
  only Potion 7001 merges a matching subtype stack.
- Drag owner `0x0056DE50` detaches and relinks between root and Sack lists.
  `0x0056EC30` is the Unforge release path: its non-empty-Sack rejection does
  not prohibit ordinary Sack movement.
- Direct-use owner `0x0056D1B0` resolves recursively. `Item_Misc` 7012 subtype
  0 opens DyeClothing without consuming the kit; subtype 1 is consumed only by
  the recursive lock owner; subtypes 2/3 remove their books and enter the
  new-skill / one-draw learned-skill flows.
- DyeClothing owns constructor `0x0055AFD0`, update/close helpers `0x00550E50`
  and `0x00551100`, screen/update/render roots `0x005665C0` / `0x005666F0`,
  selection/commit callbacks `0x0055BF80` / `0x0055F410`, vtable `0x00794924`,
  and hot-rect-list vtable `0x007944BC`.
- Stock confirmation audio is `sounds/dye__Stream.wav`, SHA-256
  `113708c96aafc98bae7c0d449d9d639e9f5290c0109d7bab0b4c781af2976e`,
  registry index 120 / audio member `+0x1374`.

## Exhaustive DyeClothing authored table and state machine

The two visible 3-by-3 banks are fixed swatches; eligible clothing is a
separate dynamic recursive Hat/Robe list. The 18 contiguous float4 rows at
`+0xD0..+0x1E0`, in row-major selection order, are:

| Index | RGBA | Index | RGBA |
| ---: | --- | ---: | --- |
| 0 | `(1, 1, 1, 1)` | 9 | `(0, 0, 1, 1)` |
| 1 | `(1, 0, 0, 1)` | 10 | `(0.5, 0, 1, 1)` |
| 2 | `(1, 0.5, 0, 1)` | 11 | `(1, 0.5, 1, 1)` |
| 3 | `(1, 1, 0, 1)` | 12 | `(1, 0, 1, 1)` |
| 4 | `(0.5, 1, 0, 1)` | 13 | `(1, 0, 0.5, 1)` |
| 5 | `(0, 1, 0, 1)` | 14 | `(0.75, 0.75, 0.75, 1)` |
| 6 | `(0, 1, 0.5, 1)` | 15 | `(0.5, 0.5, 0.5, 1)` |
| 7 | `(0, 1, 1, 1)` | 16 | `(0.25, 0.25, 0.25, 1)` |
| 8 | `(0, 0.5, 1, 1)` | 17 | `(0.1, 0.1, 0.1, 1)` |

The tub begins at alpha `0.2` with no selection. The first swatch copies its
RGBA; later selections perform `current = current*0.875 + incoming*0.125` for
RGB. Selected index `+0x1F8` and pulse `+0x1F4` begin at one, decrement by
`0.05` each update, and reset the index to `-1` after exactly 20 updates. Open
opacity advances by `0.01` per update; close opacity falls by `0.1`.

Commit computes luminance with `(0.308600008, 0.609399974, 0.0820000023)`,
moves every channel 75 percent toward it, and clamps. DyeWhat splits its
80-pixel Hat/Robe control at `top+40`: return 1 writes Cloth `+0x88`, return 2
writes Trim `+0x98`. Cancel returns 0 and mutates neither target nor kit. Only
a successful layer result writes the tint and plays the dye stream. The first
such result removes the initiating kit from its recursive owner and clears the
parent's kit pointer; later results reuse the same open painting session without
another kit. DyeWhat closes its child choice, while DyeClothing remains open
until its separate Done/close path. The earlier per-layer teardown interpretation
is superseded by the Report69 instruction and presented-media evidence below.

## Complete membership and current disposition

| Member | Native owner / branch | Current disposition |
| --- | --- | --- |
| recursive root and child ownership | `SdItemListRoot`, `0x0055FF20` | exact-ported |
| one Item_Sack type and icon rows 70/71 | type 7008, item `+0x1C` | exact-ported |
| depth-first projection and lookup | `0x00560380`, `0x00552650` | exact-ported |
| root-to-Sack, Sack-to-root, sibling and nested relink | `0x0056DE50`, `0x0055FF20` | exact-ported |
| Potion-only subtype merge | `0x0055FF20` | exact-ported |
| duplicate, alias, self and descendant-cycle rejection | ownership invariant | exact-ported web integrity guard |
| non-empty Sack Unforge rejection | `0x0056EC30` | verified-already-at-parity |
| recursive consume/equip/direct-use/key/HUD/bot lookup | `0x0056D1B0`, lookup family | exact-ported |
| recursive Luthacus storage transfer/presentation | shared item-list ownership | exact-ported |
| Fabric Dye open/cancel/commit/consume | DyeClothing family | reopened by Report69; recovered-pending-port |
| all 18 swatches, mixing, pulse and opacity | DyeClothing table/update | exact-ported |
| recursive Hat/Robe target list and Cloth/Trim choice | `0x0055F410`, DyeWhat | target/color data retained; painting-session lifetime reopened by Report69 |
| Hat/Robe two-tint persistence and character/icon rendering | `+0x88`, `+0x98` | exact-ported |
| stock dye stream | registry member `+0x1374` | exact-ported |
| Item_Misc book subtypes 2/3 | `0x0056D1B0`, skill flows | exact-ported |
| protocol, save, snapshot and participant replication | item serializers | exact-ported, protocol 62 |
| world Sack carrier 2013 | separate world actor | out-of-system: not an inventory transaction |

No browser constraint blocks a member. The web limits of 16 direct children
per Sack and 32 admitted recursive levels are replication guards, not claimed
retail gameplay constants; every authoritative mutation must preserve them.

## Required validation contract

The authoritative kernel and production host must resolve every item by
recursive ID, preserve live-node ownership, merge only matching Potion
subtypes, preserve non-empty contents, reject duplicates/cycles/stale IDs and
post-move over-depth trees, and serialize the result. The real paused `/game`
path must admit Sack moves and dye commits. UI and renderer coverage must prove
all movement directions, nested direct-use/storage/HUD/bot discovery, all 18
interactive swatches, exact blend/desaturation vectors, 20-update pulse
teardown, both Cloth and Trim transactions, cancel with zero mutation, exactly
one kit consumed and one stock audio event on success, snapshot round-trip,
participant replication, and zero page/console/network errors in Mac Chrome.

## Web implementation consequence and validation receipt

- `hub-economy.ts` owns recursive projection, exact-ID lookup, detach/relink,
  Potion-only merge, recursive consume/equip/unforge/direct-use, DyeClothing
  math, tree integrity, the 16-child guard, and the depth-32 post-mutation
  admission guard. A legal depth-32 empty Sack remains legal; a move that would
  introduce a depth-33 item fails atomically.
- `game-protocol.ts` advances the strict wire to protocol 62, admits the two
  new actions, validates all action fields, recursively reconstructs inventory
  and tint state, and shares the Sack bounds with the kernel.
- `game-save-document.ts` validates the same tree before serialization and
  after restoration. The JSON envelope bound is 80 so every legal 32-level
  Sack tree fits while the item-tree validator still rejects level 33.
- `game-host.ts` admits `move-inventory-item` and `dye` only for the owner of
  the authoritative inventory pause. Rejected IDs still return explicit
  feedback; they are no longer silently discarded.
- `HubInventoryUi` and the WebGL renderer expose one recursive projection,
  both fixed 3-by-3 swatch banks, the mixed tub, recursive Hat/Robe targets,
  Cloth/Trim hot-rect split, native open/close rates, and a selected index that
  clears after the exact 20-update pulse. Confirmation plays the pinned dye
  stream only after authoritative success.
- The earlier direct-simulation HTML fixture was deleted. Registered
  `smoke:game:sacks-dyes` serves the production bundle, starts a real host,
  loads its inventory through the normal slot-0 save/restore path, opens the
  real paused `/game` inventory, and owns/cleans up its static server, host,
  Chrome, and temporary profile.

Pre-rebase Mac validation from the detached candidate
`/Users/jarrett/codex-acceptance/sacks-dyes-native-parity-fix-20260823/website`
on base `70b935e0`:

| Run | Result | Disposition |
| --- | --- | --- |
| gate r1 | failed `247/248` in the new save-depth test | caught an empty depth-32 Sack being mistaken for a depth-33 child; guard corrected, no limit loosened |
| gate r2 | `248/248` save/pretest and `1400/1400` main game suite, every remaining suite zero failures, production build/media policy exit 0; Game chunk `435216` raw / `122516` gzip | application tree green; bundle below `524288` / `131072` limits |
| browser r1-r4 | runner-only locator/receipt corrections | production actions already reached success; no product workaround added |
| browser r5 | full journey exit 0 | first complete behavioral receipt |
| browser r6 | full journey plus seven screenshots exit 0 | all visual members captured; Trim screenshot exposed native fade-in timing |
| browser r7 | full journey, settled visual captures, errors `[]` | final browser receipt |
| gate r3 | exact 34-file documented tree: `248/248`, `1400/1400`, ML `61/61`, Hub UI `23/23`, every suite zero failures, build/media exit 0 | final canonical gate receipt |
| browser r8 | r7 journey repeated against the production bundle rebuilt by gate r3; errors `[]`, seven captures | final exact-bundle browser receipt |

Browser r7 proves root-to-Sack, Sack-to-Sack, nested-Sack, and Sack-to-root
movement; Potion merge `2+3=5`; all swatch rows `0..17` interactive; pulse zero
and selection cleared after 20 updates; layer and session cancel with unchanged
stored tints, both kits retained, and zero dye audio; Cloth commit then Trim
commit with persisted tints `[8288385,7157310]`; two commits consume two exact
kits and emit exactly two dye stream starts; the dyed robe equips and renders
on the Hub character; recursive Luthacus storage transfers its nested key while
retaining the empty Sack. Page errors, console errors, and failed responses are
all empty. Reviewed evidence is retained under
`/Users/jarrett/codex-acceptance/sacks-dyes-native-parity-fix-20260823/evidence/r8/`.

No member is blocked by the browser platform. Commit, push, and deployment:
none authorized; the focused worktrees are retained.

### Current-main rebase receipt (2026-08-23)

`origin/main` moved during the final sweep from `70b935e0` to `31bd858d`
(`Match stock primary spell collision priority`). The Sack/Dye tree was
transplanted onto that commit in a fresh worktree; the collision system was
preserved in every overlapping simulation, host, and protocol file. Upstream
had already consumed protocol 61, so the combined strict wire advances to
protocol 62. The only manual merge resolution was the protocol-version test
name/assertion plus append-only ledger ordering; no gameplay compromise or
compatibility path was added.

Final candidate paths:

- local: `/home/user/.codex-worktrees/solomon-website-sacks-dyes-fix-20260823-rebased`;
- Mac: `/Users/jarrett/codex-acceptance/sacks-dyes-native-parity-fix-20260823-rebased/website`.

The two 34-file changed-file manifests were byte-identical before validation.
The rebased Mac gate passed: save/pretest `248/248`, main game `1408/1408`, ML
`61/61`, weather `9/9`, parties `43/43`, level-up `11/11`, diagnostics `7/7`,
Hall `33/33`, Hub UI `23/23`, desktop `5/5`, and the remaining suites all zero
failures. Production build and media policy exited zero; Game chunk
`Game-Bzjp5Iq9.js` was `435439` raw / `122577` gzip under the `524288` /
`131072` limits.

The production-bundle `/game` browser journey then passed on the rebased tree
with the same complete membership, `audioEvents: 2`, swatches `0..17`, persisted
tints `[8288385,7157310]`, and empty page/console/failed-response arrays. Seven
reviewed captures are retained under
`/Users/jarrett/codex-acceptance/sacks-dyes-native-parity-fix-20260823-rebased/evidence/r1/`.
This receipt supersedes the pre-rebase base/path as the completion candidate.

### Final main refresh receipt (2026-08-23)

`origin/main` advanced once more to `b57eab6f` (`Fix Hall highest-skill root
projection`). That system changes Hall ownership plus this append-only ledger;
the Sack/Dye code applied without a gameplay conflict and protocol remains 62.
The final retained candidate paths are:

- local: `/home/user/.codex-worktrees/solomon-website-sacks-dyes-fix-20260823-latest`;
- Mac: `/Users/jarrett/codex-acceptance/sacks-dyes-native-parity-fix-20260823-latest/website`.

The latest local/Mac 34-file manifests were byte-identical. The Mac gate
passed: save/pretest `248/248`, main game `1408/1408`, ML `61/61`, Hall
`36/36`, Hub UI `23/23`, and every other suite with zero failures. Production
build and media policy passed; Game chunk `Game-BDj0GOBe.js` was `435587` raw /
`122626` gzip under budget. The production-bundle `/game` journey then passed
again with `audioEvents: 2`, all swatches `0..17`, final tints
`[8288385,7157310]`, and empty page/console/failed-response arrays. Seven
captures are retained under
`/Users/jarrett/codex-acceptance/sacks-dyes-native-parity-fix-20260823-latest/evidence/r1/`.
This latest-base receipt supersedes both earlier candidate paths.

### Publication authorization receipt (2026-08-23)

The owner explicitly authorized a push to `main` after the latest-base Mac
gate and production-bundle browser receipt. The focused code/RE commit is
`d8ca75363afd416ef75527cec1d2192116b3411f` (`fix(game): restore native sacks
and fabric dye`) on parent `b57eab6f4410b8cc80b4692654659135fdda5e2e`.
This docs-only receipt accompanies that commit in the same normal fast-forward
publication. Deployment was not requested and remains a separate owner action.

## 2026-10-03 — Report69: one kit owns the open painting session

### Reopened cause and boundary

The earlier pass recovered the palette, target tint writes and recursive item
removal, but treated a successful **DyeWhat child** result as termination of the
**DyeClothing parent**. It did not retain the parent kit-pointer guard and
independent close flag as one lifetime. Its per-layer tests and browser receipts
therefore confirmed the implemented transaction while missing the native
session contract. Their historical results remain recorded above; they do not
establish the now-refuted per-layer kit rule.

The reopened system is the kit-authorized painting parent and its color/target/
layer child operations, first successful application, subsequent applications,
Done/back/cancel/interruption, authority and persistence. The shared Inventory
and four companion service entry points, Hub and paused Boneyard consumers,
recursive Hat/Robe targets, and existing supported mod dyeable wearables belong
to the implementation membership. Price, bucket/vial styling and unrelated
commerce/customization changes are outside this remedy.

### Exact diagnostic evidence

- Own scoped source refresh at `2026-10-03T14:45:20.436323+00:00` verified the
  original Report69 message unchanged and unedited, with its original attachment
  identity and no relevant correction in ten narrowly surrounding messages.
- Retail 0.72.5 remained 4,723,200 bytes, SHA-256
  `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred
  image base `0x00400000`. Targeted raw instructions and all three relevant
  vtables were extracted on the admitted M5 SSD with a private copy of its
  installed LLVM tool; tool SHA-256
  `83b32f39e5475ee168927eb1509c82978e08e0100ec8c6fafeca588d9960773c`.
  Standard-library PE mapping verified image identity, sections and vtable
  pointers. No new Ghidra import, Windows/WSL work or injected native observation
  was used.
- The complete original 81.610467-second clip, SHA-256
  `eb72e9714eeae507ef0801391f2aca784a25e0eb6da36d933efc5962b83ce6c2`, played
  normally through same-origin HTML/video and `requestVideoFrameCallback`.
  Eighty-three distinct nonblack samples reached media time `81.410256` with
  `2442` presented frames and empty error arrays. All three chronological
  contact sheets and relevant full-size frames were inspected. This is
  presented-session evidence, not paused-seek captures or an every-frame input
  trace.
- In the second visible painting session, frame `73.001678` shows the open
  empty tub and an initiating kit in the inventory. By `80.008867`, the same
  parent is still open with a purple tub, both a Hat and a Robe have changed
  color, and the former kit cell is empty; the pointer is on Done. The menu is
  closed in the later samples. These observations support retained parent and
  multiple targets; exact charge semantics come from the native guard below.
- M5 source was an independent clone of the accepted bare object mirror,
  detached at original published commit
  `3f130d3382bb321dd631aeb4e720ed8e5ed63d06`. Its original tree and index were
  both `72e35c15968ec5c9cbe5d6ff3ef3d00f48cde236`; all 7,254 tracked bytes
  matched the M2 original manifest and status was clean. No foreign working
  overlay or substituted build revision was used.
- The unchanged public `dyeInventoryClothing` baseline accepted the first
  Cloth write and removed its kit. A subsequent Trim or another item's Cloth
  write using that initiating ID rejected `item-not-found`; empty colors left
  state unchanged. This is an actual public-kernel baseline, not a built UI,
  original reporter-save or multiplayer journey.

### Instruction-derived parent/child contract

| Operation | Exact native evidence | Recovered rule |
| --- | --- | --- |
| Entry | `0x0056D85C..0x0056D8BF`, constructor `0x0055AFD0` | Misc subtype 0 constructs/registers the parent; `+0x78` receives the initiating kit and `+0x7C` its inventory owner; entry does not unlink that kit |
| Eligible target and child | `0x0055F704..0x0055F87D` | The parent's hot-rect list resolves clothing and enters DyeWhat; child results `<=0` skip tint and kit mutation |
| Cloth/Trim choice | `0x00551140..0x005511B1`, `0x005511C0..0x005511F6` | A left hit above/below the child midpoint returns 1/2; outside returns 0; the other mouse callback returns 2 for an inside hit and 0 outside |
| Child lifetime | `0x00551200..0x005512E5`, parent call `0x0055F874` | The child runs its modal loop, returns its result and retires; it is distinct from the painting parent |
| Successful write/audio | `0x0055F883..0x0055F923` | Each positive result uses registry audio member `+0x1374` and writes one selected Hat 7005 or Robe 7006 tint channel |
| First kit removal | `0x0055F926..0x0055F95A` | If parent `+0x78` is nonnull, recursive owner lookup `0x00552850` and node removal `0x005528C0` unlink it, then `+0x78` is set to zero |
| Subsequent applications | callback entry `0x0055F439`, continuation `0x0055F961..0x0055F9DE` | Admission checks the close flag, not a still-present kit; the null kit pointer skips later removal and the retained parent accepts another application |
| Mixed color retention | `0x00550F20..0x00550FBD`, `0x0040FC60..0x0040FCC9` | Swatches update parent color `+0xC0`; commit computes a desaturated temporary without writing the parent color, so further mix/application uses the retained bucket |
| Parent Done/back/close | `0x00551100..0x00551132` | The independent close helper sets byte `+0x1F0 = 1`; the successful-application callback does not call it or set that flag |
| Fade/teardown | `0x00550E50..0x00550EA8`, destructor `0x0055BED0..0x0055BF7C` | The flagged parent fades and retires; destruction removes its UI/hot-rect ownership and does not consume an unused kit |

There is no clothing-count cap in the retained application path. One open
session charges on its first successful paint, permits repeated Cloth/Trim and
different eligible items/colors, and ends through the parent lifetime. Closing
before a successful application preserves the kit; closing afterward preserves
the committed tints and never refunds the consumed kit. Reopening requires
another live eligible kit. No historical input sequence, hidden quantity or
server state is inferred from the clip.

### Implementation consequence and current status

The source at `3f130d33` has only a UI-local modal and independent authoritative
dye transactions. The kernel consumes each time; accepted feedback closes the
outer modal after 120ms; the UI's missing-kit effect also assumes the initiating
kit must remain present. Those shared assumptions must be replaced together.
Authority must retain an admitted transient painting session, validate every
target/color mutation through the existing canonical transaction, charge once
on first success, and invalidate continuation at the actual parent/actor/network
lifetime. A caller-supplied free-use flag cannot represent this contract.

The original 18-color table, blend/desaturation helpers, sparse inventory
projection, recursive ownership, supported wearable rules, price 300, 256-row
wire bound, 32-level Sack bound and existing save/input limits remain the
canonical implementations. Native entry/mixing audio was also recovered at
`0x0056D86D` / `0x00550F2F`; an unrelated sound or visual redesign is not included
in this consumption/session remedy.

At this checkpoint the affected session members are `recovered-pending-port`.
No product fix, built UI acceptance, full canonical gate, publication,
deployment or report completion is claimed. The diagnostic M5 lease was cleaned
and released at `2026-10-03T15:20:03.748393+00:00` with zero owned processes and
unchanged 24-entry home/immediate-child scope; its private root is retained
inactive for the pending remedy and later acceptance. Required next checks are
repeat layer/item/color use, unused/used Done and cancel, reopening/no-kit,
rejected targets/colors, stale lifetime and participant ownership, root/nested
and companion entry, paused Boneyard, desktop/touch input, and save/resume/
disconnect behavior before exact final validation and managed publication.

### Prepared implementation and validation boundary

The subsequent M2 candidate replaces the one-shot caller contract with explicit
open/paint/close actions and one transient authority-owned session per actor.
The kernel validates the initiating kit at admission and first paint, consumes
one unit only on first success, and reuses the established recursive target and
color transaction for later paints. Client correlation identities cannot supply
a paid/free-use flag. Owner projection and correlated results cross protocol146;
the durable save shape remains schema48. The session and painting feedback are
omitted from saves, and historical one-shot feedback is validated then retired.

Shared Hub/run/companion UI callers keep the parent and bucket after paint,
close the child target choice, route Back through the current dye control and
close on grant revocation even while awaiting a result. Unmount, movement/cast,
pause/surface change, actor/world replacement and transport loss retire the
authority grant. The client's ordinary stopped-input packet before inventory
actions preserves the session.

The original pre-change public regression produced its intended repeated-layer
`ERR_ASSERTION` on M5 at `2026-10-03T17:34:57.610804+00:00`; the short lease was
cleaned/released at `17:37:01.201244`. Its setup now enters the real session
interface while retaining the native repeat-layer/item assertions. Prepared
coverage includes root/nested and mod wearable callers, unused/used close,
reopen/no-kit/stale close, peer ownership, actual paused host/resume and transport
takeover, idle versus gameplay input, strict wire rejection, historical saves,
and the maintained all-color Sack/Dye browser journey with multiple paints
before Done and a second admitted kit afterward.

These source changes are **unvalidated** at this preparation boundary. No green
test, formatting/lint/type check, build, current candidate browser, full gate,
publication or deployment is claimed. Native/media/intended-red evidence stays
qualified and is not repeated merely because the candidate was prepared.

### 2026-10-04 — first focused candidate check and bounded correction

Exact integrated `055cb04c` on published `ae26c65e` admitted all 7,257 tracked
bytes on M5. Pinned dependency restoration and the migrated repeat witness
passed; the witness ended at `2026-10-03T23:55:32.765447+00:00`. The broader
focused stage ended at `23:55:46.419002` with 368 passes, 97 failures and no
skips. The automatic runner stopped there and cleaned/released its exact lease
at `23:55:47.458365`, with zero owned processes, all 31 monitored home entries
unchanged, no new children and private temporary/profile cleanup.

Ninety-five failures identified one actual integration omission: the common
full tick result builder did not preserve `inventoryDyeSessions`. The prepared
correction explicitly carries that existing field through the tick, without
an optional-state or free-use fallback. The other failures were a positive
welcome fixture missing its required painting correlation ID and a malformed
profile-feedback assertion using the full-continuation consumer. The latter
now exercises `restoreGameSaveProfile` for the profile and independently
`restoreGameSaveDocument` for the continuation; strict rejection remains.

These corrections are unrun. Host-boundary tests, both TypeScript checks,
lint, build, desktop/touch browser stages and the full canonical gate did not
run in this failed phase. Earlier witness/native/media evidence retains its
exact source and observation qualifications; this is not a completed report
or an accepted current candidate.


### 2026-10-04 — focused and built acceptance; final release pending

Corrected runtime `3c060f2a` admitted all 7,257 tracked paths on M5. The six
focused suites passed 465/465 tests and paused/resume host cases passed 2/2,
with zero failures/skips. App/test types, lint, production build and maintained
full desktop Sack/Dye acceptance exited zero. The desktop result covers all
18 swatches, unused Done, cloth/trim/another garment before Done on one admitted
kit, a second fresh kit afterward, four dye audio events, saved/equipped tints
and the existing Sack/companion/Boneyard checks. No browser/console/response
errors were reported.

That phase's touch run stopped at the initial Inventory flyby trailing wait,
before painting. Its retained screenshot shows the occupied-slot flight but
no terminal recorder/host/save state survived. Its cause remains unproven.
The phase cleaned/released at `2026-10-04T02:06:00.670233+00:00` before analysis.

An observation-only maintained helper (`bb3c5aed`) preserves the original input,
screenshot, assertion and timeout while reusing the existing phase recorder and
capturing actual renderer/host/save/error state on failure. Against the unchanged
qualified `3c060f2a` build, the single full touch journey passed at
`2026-10-04T05:09:55.070006+00:00`: all 18 swatches, four dye audio events,
26 Sack transitions and zero browser/console/response errors. Its relevant
cloth/trim/character/flyby frames were inspected. The earlier timeout did not
reproduce; this pass does not prove its cause or a runtime flake fix.

Automatic cleanup checked the confirmed task-created process group before
private-path cleanup, then released at `05:09:55.988029`. Owned processes and
new home children were zero, private TMP/profiles were cleared and the exact
lease was absent. The 31-entry home scope preserves the pre-existing 40-byte
Chrome settings file with identical bytes/SHA and only an mtime touch.

Session admission/first charge/repeat use, cancellation/lifetime, strict wire
and historical-save behavior now have focused and built evidence with explicit
source qualifications. Final immutable current-main canonical validation,
normal publication, managed deployment/live verification and both-device task
cleanup remain pending. No full gate, publication, deployment or Report 69
completion is claimed. Preserve price 300, original limits and unrelated art.

### 2026-10-04 — published modal integration and qualified desktop continuation

Rebased runtime `bd13dd7b` incorporates published `3c32f09c` while preserving all
23 own non-package paths and every published script. Its exact 7,258-path build
passed at `08:19:49.937004`. The first desktop journey then timed out at the
initial occupied Inventory flyby's intermediate-frame predicate, before dye;
touch and the full canonical gate did not run. Automatic cleanup released that
phase at `08:20:45.372406`. The timeout's cause remains unproven.

Observation helper `40f5125a` changes no production input, gesture, predicate,
assertion or timeout. It records phase-edge snapshots and predicate polls and
emits renderer/host/save/error facts before a supplemental failure screenshot.
Those observations are not a complete frame history, and no runtime remedy
was applied.

One maintained desktop journey against the unchanged `bd13dd7b` build passed
at `14:57:00.250935`: all 18 swatches, unused Done, cloth/trim/another garment
before Done on one admitted kit, a fresh second kit afterward, four dye audio
events and saved/equipped tints. Its surrounding Sack/companion/paused Boneyard
checks passed with 26 Sack transitions and empty browser/console/response error
arrays. Cloth choice, trim choice, dyed character and occupied flyby frames
were copied and inspected. This is source-qualified desktop acceptance; the
earlier intermediate-frame timeout did not reproduce, which does not establish
its cause or a flake fix.

The runner drained recorded PGID `40916` and released at `14:57:00.333315`, with
no owned processes/groups or new home children, cleared private TMP/profiles and
an absent exact lease. The 31-entry home scope preserved the known 40-byte
Chrome settings with identical bytes and only an mtime touch. All 126 retained
deployment/index/JavaScript fingerprints matched before and after observation.
No native registration was created in this desktop phase.

Keep the earlier 465 focused and two host tests, native/media/intended-red
proofs and older runtime touch pass with their existing source qualifications.
Current-runtime touch, new helper lint, the unchanged final all-mode canonical
gate and honest final tested-build identity remain pending, followed by normal
publication, managed live verification and both-device cleanup.

### 2026-10-04 — full-gate disconnect ownership regression

Exact candidate `a6d2bfb8` passed changed-helper lint, its production build and
one maintained current-runtime touch journey. The rebuilt files were checked
against the accepted `bd13dd7b` artifacts: the 16 changed path entries are seven
renamed JavaScript pairs plus HTML/deployment metadata. Every remaining byte
matches after replacing only the actual full revision literal and the seven
observed import filenames; the other 117 fingerprints are unchanged.

The unchanged full gate failed at `15:40:52.567549`: its 2,825-test Node block
passed 2,824 and failed the existing public regression, "staged catch-up loses
its capability when the final live peer disconnects." The new unconditional
painting-session cleanup in `game-host.ts` attempted `replaceStateForPlayer`
for the staged actor after its party run ended. `stateForClient` deliberately
uses the Hub after that staging lifetime ends; the actor is absent from the
shared world identity map, so the strict replacement invariant correctly
rejected the write. The transport-replacement cleanup has the same unnecessary
write when session revocation is a no-op.

`closeGameSimulationInventoryDyeSession` already returns its original state
when the actor has no painting grant. Actor removal clears grants, and detached
party catch-up stores only actor/Hall data. Connection-lifetime cleanup must
honor that no-op result and replace authoritative state only when an actual
grant was revoked. The strict shared-world setter and the existing regression
must remain unchanged. This causal correction still needs focused and full
validation; the failed gate is not acceptance or publication.

Automatic cleanup drained the surviving owned Roslyn child and removed the
SSD image/mount/registration link, private TMP/profiles and exact lease at
`15:41:03.550377`. No owned processes/groups or new home children remained.
Passing lint/build/touch and older source-qualified proofs are preserved; the
full quality/mutation tail and final postcanonical build identity are pending.
