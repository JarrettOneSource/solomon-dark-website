# 2026-08-23 — Recursive Item_Sack ownership and Fabric Dye transactional direct-use

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
a successful layer result writes the tint, removes exactly one initiating kit
from its recursive owner, plays the dye stream once, and tears down the modal.

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
| Fabric Dye open/cancel/commit/consume | DyeClothing family | exact-ported |
| all 18 swatches, mixing, pulse and opacity | DyeClothing table/update | exact-ported |
| recursive Hat/Robe target list and Cloth/Trim choice | `0x0055F410`, DyeWhat | exact-ported |
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
