# 2026-08-28 — Gold amount, removable perks, overlapping casts, InventoryScreen pages, and completed-run scavenging reopening

## 2026-08-28 — Assigned wizard class-title secondary-report reopening

### Reported smell and parity question

- A player reports that InventoryScreen's top-left wizard identity prints raw
  pairs such as `AIR ARCANE` or `ETHER BODY`, while stock assigns one title to
  each element/discipline combination.
- This reopens the page-0 identity row below, which was called
  `verified-already-at-parity`. The skipped rule was to follow the renderer's
  direct native callee: the 2026-08-28 implementation reconstructed a label
  from the two web enum names even though `InventoryScreen` calls the shared
  class-title lookup and the complete lookup had already been extracted for
  Hall of Fame.
- The report recalls examples including Gypsy, Astronomer, and Clairvoyant.
  Those recollections are falsifiers, not source data: the byte-verified retail
  title table and executable string census must decide the shipped names.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | unmodified `SolomonDark.exe` 0.72.5, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Same executable and canonical analyzed program as the existing Hall and Inventory ledgers. | high |
| Instructions and complete static table | `WizardClassTitle 0x00658B40` | Element ids `0..4` are Ether, Fire, Air, Water, Earth; discipline ids `5..7` are Body, Mind, Arcane. The function returns all 15 titles enumerated below and `WIZARD` only for an invalid pair. | high |
| Complete xref sweep | all references to `0x00658B40` in canonical Ghidra program `SolomonDark.exe` | Exactly two native consumers exist: `InventoryScreen::Render 0x00562520` at `0x00562C51` and Hall loading `0x005A13A0` at `0x005A1B46`. | high |
| Inventory instructions | `0x00562C2A..0x00562DB3`; format string `Level %d\n%s` at `0x00795144` | Inventory reads the live wizard's element at `+0x82C`, discipline at `+0x830`, and level at `+0x30`; calls the lookup; formats the level and assigned title as one two-line string; and draws it with medium Fonts group 1 at `Fonts + 0x4D530`. | high |
| Executable string census | retail file offsets `0x39EA00..0x39EAA8` | The contiguous authored bank is `WIZARD`, then the exact 15 strings below. `GYPSY` and `CLAIRVOYANT` are absent. `ASTRONOMER` occurs only as RTTI for the separate Courtyard ambient class; the wizard title is `ASTROLOGER`. | high |
| Current web causal trace | Website base `213d34d6`; `hub-inventory-renderer.ts`, `hall-of-fame.ts`, `HallOfFameScene.tsx`, `PlayerCardDialog.tsx`, and `hub-npc-dialogue.ts` | Hall, the Website player-card extension, and memorial inspection consume the extracted table, but Inventory page 0 bypasses it and paints ``${element.toUpperCase()} ${discipline.toUpperCase()}``. The table is incorrectly owned by the Hall module rather than shared wizard identity. | high |

The instruction queries used the canonical read-only replica workflow and the
existing Mod Loader checkout only as tooling: tool revision
`08bfba9ef367f7b863848030d0a289dc31e33192`, wrapper SHA-256
`b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`,
`decompile_targets.py` SHA-256
`899167ca42624e09f26d22233365631a6ee8b3d106e337e20b77574894e97465`,
and `refs_to_addr_decompile.py` SHA-256
`c6844b842ccd87aa70d290ae34553d874a8f90866eb234425f7c51fd8a438c4b`.

### System boundary and membership inventory

Native system: the pure wizard class-title lookup from a valid creation
element and discipline, plus every native and Website presentation surface
that claims to show that assigned title.

| Member | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Ether + Body = `SAGE` | `0x00658B40`, ids `0/5` | `exact-ported` | complete shared-table assertion |
| Ether + Mind = `SEER` | `0x00658B40`, ids `0/6` | `exact-ported` | complete shared-table assertion |
| Ether + Arcane = `OCCULTIST` | `0x00658B40`, ids `0/7` | `exact-ported` | complete shared-table assertion |
| Fire + Body = `WARLOCK` | `0x00658B40`, ids `1/5` | `exact-ported` | complete shared-table assertion |
| Fire + Mind = `PYROMANCER` | `0x00658B40`, ids `1/6` | `exact-ported` | complete shared-table assertion |
| Fire + Arcane = `FIRE MAGE` | `0x00658B40`, ids `1/7` | `exact-ported` | complete shared-table assertion |
| Air + Body = `STORMCALLER` | `0x00658B40`, ids `2/5` | `exact-ported` | complete shared-table assertion |
| Air + Mind = `ASTROLOGER` | `0x00658B40`, ids `2/6` | `exact-ported` | complete shared-table assertion |
| Air + Arcane = `STORM MAGE` | `0x00658B40`, ids `2/7` | `exact-ported` | complete shared-table assertion |
| Water + Body = `ICEBINDER` | `0x00658B40`, ids `3/5` | `exact-ported` | complete shared-table assertion |
| Water + Mind = `THAUMATURGE` | `0x00658B40`, ids `3/6` | `exact-ported` | complete shared-table assertion |
| Water + Arcane = `FROST MAGE` | `0x00658B40`, ids `3/7` | `exact-ported` | complete shared-table assertion |
| Earth + Body = `RITUALIST` | `0x00658B40`, ids `4/5` | `exact-ported` | complete shared-table assertion |
| Earth + Mind = `CHANNELER` | `0x00658B40`, ids `4/6` | `exact-ported` | complete shared-table assertion |
| Earth + Arcane = `EARTH MAGE` | `0x00658B40`, ids `4/7` | `exact-ported` | complete shared-table assertion |
| Invalid-pair `WIZARD` fallback | final branch of `0x00658B40` | `out-of-system` — Website character configuration is strictly decoded to the five elements and three disciplines before presentation | type/codec coverage retains the closed domain; no invented fallback title |
| InventoryScreen page-0 identity | `0x00562520`, xref `0x00562C51`, `Level %d\n%s` | `exact-ported` by this corrective pass | Air/Arcane and Ether/Body identity assertions plus real Inventory browser capture |
| Hall of Fame row title | `0x005A13A0`, xref `0x005A1B46`; row renderer `0x005A2C80` | `verified-already-at-parity` | existing populated-row and complete-table coverage, now using the shared owner |
| Website player-card class | Website social extension | `exact-ported` extension | same shared lookup; no second title table |
| Website memorial-inspection class | Website social/memorial extension | `exact-ported` extension | same shared lookup; no Hall-owned wrapper |
| Create element/discipline selectors | no lookup xref in Create | `out-of-system` — this is the input surface for the two components, before an assigned-title consumer | Create continues to expose the actual choices |
| Native save-transfer preview | Website import/export extension | `out-of-system` — intentionally reports serialized component values, not a stock class-title surface | no change to portability diagnostics |

No member is blocked by the browser platform.

### Native ownership thread and recovered contract

- Creation and save state own the element/discipline pair. The lookup is pure,
  immutable, and has no clock, random, audio, input, destruction, or teardown
  state. All consumers derive the title when rendering; no title is serialized
  or replicated separately.
- InventoryScreen and Hall are the only native xrefs. Inventory uses one
  newline-separated `Level %d\n%s` medium-font value; Hall uses the same title
  in its row-specific `Level %d %s` string. Raw component names are never a
  class-title fallback for a valid retail wizard.
- Website authority already replicates the same typed character configuration
  to Inventory, Hall records, and player cards. The correction is therefore a
  shared presentation lookup, not a protocol, save, or host-state change.
- The top-left Inventory page geometry, clipping, tint, medium font, and
  16-pixel native line height were already correct. Only the content owner was
  wrong; replacing it must not disturb the three-page SwipePages lifecycle.

### Nearby-system findings

- The player's examples correctly identify the kind of missing feature but do
  not match retail 0.72.5 data. In particular, `ASTRONOMER` names a Courtyard
  ambient class; `ASTROLOGER` is the shipped Air/Mind wizard title. Adding
  Gypsy, Astronomer, or Clairvoyant would create a new table rather than restore
  stock behavior.
- Housing the table under Hall of Fame allowed the later Inventory port to miss
  it. Assigned wizard identity belongs in a shared core kernel consumed by Hall,
  Inventory, and explicit Website extensions.

### Web implementation consequence

- Move the complete exact-uppercase table and lookup into a shared
  `native-wizard-class.ts` owner. Delete the Hall-owned duplicate and wrapper;
  all class-title consumers import the shared function directly.
- Make Inventory page 0 build the exact two-line `LEVEL <n>\n<TITLE>` value
  through a tested render-contract function and submit it as one medium-font
  text node. Remove the raw element/discipline label path completely.
- Preserve Create and save-transfer component labels because they do not claim
  to be assigned-title consumers.

### Validation contract

- Exhaustively assert every one of the 15 table rows and the two reported
  combinations: Air/Arcane must be `STORM MAGE`; Ether/Body must be `SAGE`.
- Assert Inventory's exact multiline value, medium-font line geometry, and no
  raw component fallback; retain Hall populated-row coverage and player-card
  type coverage through the same shared import.
- On the Mac mini, run focused native-UI and Hall suites, the canonical
  `/opt/homebrew/bin/bash ./scripts/validate.sh`, and a real production-bundle
  Chrome journey from Create into Hub Inventory. The capture must visibly show
  the assigned title and return empty page, console, failed-response, WebGL,
  and host-error arrays.

### Implementation validation receipt

- `native-wizard-class.ts` now owns the exact uppercase 15-row table and the
  single typed lookup. Hall, Inventory, player cards, and memorial inspection
  consume that owner directly; the Hall-owned table/wrapper and Inventory's raw
  element/discipline concatenation were removed. Inventory submits one
  `LEVEL <n>\n<TITLE>` medium-font node at the existing native baseline, so the
  default 16-pixel group-1 line height preserves the recovered geometry.
- The Mac red pass failed exactly at the two new seams: Hall could not resolve
  `native-wizard-class.ts`, and native UI could not import
  `hubInventoryWizardIdentityText`. After implementation, focused Mac suites
  passed Hall `36/36`, native UI `55/55`, and Hub UI `80/80`. The complete
  table assertion covers every authored row; focused Inventory assertions pin
  Air/Arcane to `LEVEL 7\nSTORM MAGE` and Ether/Body to `LEVEL 3\nSAGE`.
- The first canonical run encountered one transient failure in the broad
  1,684-test Boneyard process after 1,683 siblings passed. The unchanged exact
  suite immediately reran `1,684/1,684`; no product edit was made. A clean
  second canonical `/opt/homebrew/bin/bash ./scripts/validate.sh` then passed:
  28 backend contracts, lint with 17 existing warnings and zero errors, every
  frontend suite including Hall `36/36` and Hub UI `80/80`, desktop `5/5`,
  Release backend and production frontend/game-host builds, bundle budget, and
  media policy. The production Game entry was 262,618 raw / 79,651 gzip bytes
  under 524,288 / 134,144. Pre-receipt full-gate log SHA-256 was
  `37e131c19d24b81958b1b1f03de0342cc8947c47b382fb329575207c71e80c8a`.
  The final post-receipt run uses this exact documented tree as its candidate.
- A real Mac Chrome journey used the built production bundle and built
  authoritative host, selected Air then Arcane through Create, entered the
  Hub, and opened settled Inventory. Visual inspection shows `STORM MAGE`
  directly below `LEVEL 1`; no raw `AIR ARCANE` label remains. Page errors,
  console errors, failed responses, request failures, WebGL context losses, and
  structured host errors were all empty. Full-stage and identity-crop SHA-256
  values were `086fedae458cde24bc485667260bafad293b898f3d123b85bf2baff4d354bc8c`
  and `21d5e4be8c6745ab02c39e1ac14498c71a4006d67f7b92c2c65b9b414821bac3`.
- No protocol, save-schema, authority, timing, input, or platform adaptation was
  required. No material in-system unknown or `blocked-by-platform` member
  remains.

## Reported smell and parity question

- Reported web behavior: Gold piles appear capped at 8 while Gold Charm is
  owned; owned charms cannot be removed; a secondary cannot begin while the
  primary button is held; the arrows beneath STATS do not change the page; and
  Luthacus does not retain carried potion bottles after Game Over.
- This reopens three ledger entries previously called exact: native loot,
  category-2 input/action ownership, and the common InventoryScreen. The earlier
  inventory pass stopped at the initially visible STATS slice and Hagatha's
  service-only owned-perk pane instead of enumerating the enclosing SwipePages
  owner. The earlier secondary pass mapped native `PlayerWizard+0x1EC` to the
  broader web primary-action predicate without proving the field equivalence.
  The completed-run entry intentionally retained a Website-only no-carried-item
  policy which this report now supersedes.
- Two reports are explicit product requests rather than stock behavior. Retail
  gives the gold tier-3 actor one art family for every amount at least 8, and
  retail provides no owned-perk removal writer or action. The Website must keep
  the native amount formula and disclose the visual-tier fact, while adding the
  requested no-refund perk removal as a named web extension.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | unmodified `SolomonDark.exe` 0.72.5, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | same executable and canonical analyzed project as the established loot, Hub, input, and Game Over reports | high |
| Gold instructions | `Arena_CreateGold 0x0046AA90`; arena level writers `0x00465149`, `0x00465C6C`, `0x0046E0C7`, `0x005091BA`; `Skills_FinalizePass 0x0067C421/0x0067C65A` | sentinel amount uses live Arena wave ordinal; Gold Charm multiplies final amount by float32 1.25 and candidate bound by 0.75; tier 3 begins at amount 8 but does not cap the amount | high |
| Hagatha writer census | `ActorProgression_ApplyHagathaPerk 0x0066EF70`; writes to `+0x7C4/+0x7CC`; `InventoryScreen::PointerRelease 0x0056FC90`; renderer `0x00562520` | the sole active flag writer sets `+0x7CC+selector` to one; the only zeroing owner is fresh progression construction. Owned cells build HoverBox state only. Click, double-click, and drag leave the Gold Charm row and flag intact. Retail has no removal action | high |
| Secondary input instructions | `Game_BeltActivate 0x005D5600`; PlayerWizard secondary dispatcher `0x0054CC50`; browser-input native report `0x00429820/0x00548B00` | category-2 activation checks Game input seal `+0x1ABE`, PlayerWizard no-interrupt byte `+0x1EC`, common cooldown `Skills+0x64`, and row cooldown `Skill+0x64`. It does not read the primary action at PlayerWizard `+0x270` or the primary held level. Left and right levels remain independent | high |
| Inventory static instructions | `InventoryScreen` ctor `0x00560380`, common rebuild `0x00555810`, STATS renderer `0x00562520`, `SwipePages` vtable `0x0079457C`, pointer down/move/up `0x00431C80/0x0043A1E0/0x00431DA0`, wheel/page step `0x00431E60`, owned-perk hover tail `0x005707A8..0x00570A6D` | STATS is one clipped 320 by 320 viewport over 960 pixels of content, exactly three 320-pixel pages. Wheel and a pointer drag over ten pixels change pages; the gold triangles are painter-owned indicators with no native click callback | high |
| Injected supporting observation | task-owned temporary-profile retail process PID 7000, staged retail hash above, loader Lua exec plus real Win32 input; no production/profile data | live InventoryScreen at `DAT_00819E58` measured viewport `[50,89,320,320]`, content height 960, page step 320, and settled offsets 0/320/640. Clicking the down indicator left offset zero; dragging upward changed 0 to 320 and then 640. Page 1 showed ATTRIBUTES and RESISTANCES; page 2 showed CHARMS/CURSES. Adding selector 4 through the known native apply helper painted its exact icon; click, double activation, and drag did not remove it | high for state/geometry, supporting rather than clean-stock evidence because the loader was injected |
| Existing clean capture | `tests/fixtures/webgame/menu-reference-captures/inventory-screen.png`, SHA-256 `0d99c6bb3f1815aa061fd4ee49e7bfccbd0ee058ea69b0e8936155c7e5156d8b` | page 0 at settled offset zero shows identity, primary spell, melee damage, and the down indicator | high |
| Temporary page captures | task-owned screen captures `/tmp/solomon-stats.StB1cx/page1.png` SHA-256 `296cef38e74c0bd227b01077e3b4df31df9309617097e6f5b47028d4cb11fa01`, `page2.png` `70a05b33d790556266b8e3ec0141c528023860912b8a1af038939a086c367fc1`, and `page2-charm.png` `fc040e2501db7326aa5b6d2f4f8fd6b1faf60661669d5eabe65f258a9b8dfe63` | page 1 exact labels are HEALTH, MANA, CAST SPEED, WALK SPEED, PAIN, MAGIC, POISON; page 2 is the nine-cell owned-perk pane plus DRINK TONIC | medium for durable appearance until replaced by task-owned Mac/clean-stock acceptance evidence |
| Completed-run instructions | `GameOver::Tick 0x005CF4F0 -> 0x005C9670 -> 0x005BE320`; `Player+0x1C0`, inventory `Gameplay+0x13B8`, seven equipment sinks `+0x1410`, Last Word `Skills+0x7D8` | an unconsumed corpse transfers every eligible equipped object and backpack root, including both potion subtypes, into one named Sack in Luthacus profile storage. Last Word independently adds ground Sacks/Gold. Fresh starter loadout construction is downstream and separate | high |
| Web baseline | Website `origin/main` `a24bb5d0` | Gold formula and amount credit are already exact, but no wave-boundary integration receipt exists; owned-perk actions only inspect; `castAbility` rejects `playerPrimaryCastOwnsFacing`; STATS hardcodes page 0; durable Game Over calls `transferCarriedItems: false` while explicit New Game retirement uses true | high |

The temporary native process and its exact staged executable were stopped after
the bounded probe. No user save, shared runtime, or production process was used.

## System boundary and membership inventory

Native/web systems: Gold selection/materialization through pickup credit;
participant-owned Hagatha outcome list and its requested web removal edge;
independent primary/right-belt levels through secondary action takeover;
InventoryScreen's complete three-page STATS viewport; and completed-run carried
item archival through Luthacus storage and fresh-run replacement.

### Gold amount and presentation

| Member / branch | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| sentinel level formula at waves 0..3 | `0x0046AA90`, Arena `+0x8FF0` | `verified-already-at-parity`; visual report explained | exact distributions; Gold Charm maximum is 7 at levels 0/1 and 8 at levels 2/3 |
| wave 4 and later sentinel totals | same | `verified-already-at-parity`, browser proof required | deterministic charmed total greater than 8 at wave 4 and later |
| Gold Charm quantity/chance | `0x0067C421/0x0067C65A` | `verified-already-at-parity` | owner modifier is float32 1.25/0.75 and survives Hub-to-run transition |
| equipment `FX_GOLDBONUS` composition | Gold `+0xC0` consumer | `verified-already-at-parity` | equipment factor composes before truncation without replacing Charm |
| explicit Goodie/script Gold | same spawner, explicit amount | `verified-already-at-parity` | multiplier, chunk total, and randomization stay exact |
| actor amounts 1..25 | Gold type 2012 `+0x140` | `verified-already-at-parity` | amount and pickup text/credit retain the full integer |
| art tiers 0/1/2/3 | `0x0060FFE0`, thresholds `<3/<5/<8/else` | `verified-already-at-parity` | amounts 8..25 intentionally share tier-3 art; no invented larger pile sprite |
| multiplayer roll/pickup authority | host roll plus first valid retirement | `verified-already-at-parity` | selected amount is authoritative; collector alone receives exact credit |

There is no native or web integer cap at 8. The predicted visible difference
the reporter noticed is stock behavior: the pile sprite stops increasing after
tier 3 even while amount/text/credit continue above 8.

### Hagatha ownership and requested removal

| Member / branch | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| selectors 0..26 ordinary ownership | `+0x7C0/+0x7C4`, flags `+0x7CC+selector` | `verified-already-at-parity` for purchase; `out-of-system` for stock removal | unique ordered row, capacity, save, replication |
| selector 27 Tonic, at most two | same list plus capacity `+0x800` | `verified-already-at-parity`; not removable by the extension | duplicate Tonic rows and capacity 3/6/9 remain valid |
| owned pane, nine row-major cells | `0x00562520`, `0x0056FC90` | `exact-ported` in Hagatha service; missing from standalone page 2 | icon `Skills[127+selector]`, hover detail, empty cells |
| first-mix history | profile first-mix bytes | requested extension preserves it | removed selector returns as a base-price offer, never a new triple-price first mix |
| derived/status charms and curses | complete 0..26 effect matrix | requested extension deactivates ongoing ownership and refreshes shared derived state | one regression per selector family |
| Cheat Death / Serendipity / Reverie runtime | selectors 7/24/25 | requested extension clears retained one-shot/until-hurt runtime on removal | no orphaned charge or active multiplier |
| Revelation and Weird Caster acquisition | selectors 6/14 | first-purchase side effects remain historical | remove/rebuy cannot repeatedly raise ranks or grant multiple secondaries |
| Split Mind | selector 21 | shared refresh drops concentration slot B on removal | no inaccessible second concentration survives |
| Last Word | selector 12 | ownership removed only in Hub/Inventory state | later deaths do not burst/archive through a removed charm |
| refund | no retail producer | owner-directed policy: none | gold unchanged by removal |
| participant/network ownership | existing host action seam | requested extension is host-authoritative and participant-private | another participant remains byte-for-byte unchanged |

### Overlapping primary and secondary casting

| Member / branch | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| browser left/right simultaneous levels | native input report, `mousedown/up` | `verified-already-at-parity` | second button edge survives while first remains held |
| Game input seal | `Game+0x1ABE` | `verified-already-at-parity` | pause/modal/transition still blocks both lanes |
| native no-interrupt byte | `PlayerWizard+0x1EC` | `verified-already-at-parity` through general eligibility, not the primary action | no reintroduction of an active-primary guard |
| common and row cooldowns | `Skills+0x64`, row `+0x64` | `verified-already-at-parity` | unchanged silent/common and fizzle/private rejection branches |
| all 23 category-2 IDs `11,12,15,21,23,27,30,35,41,45,46,48,49,50,51,54,72,73,74,76,77,78,79` | dispatcher `0x0054CC50` | `exact-ported` after removing the disproven web-only primary guard | every row accepts from the same active-primary starting state when its own prerequisites pass |
| ordinary StaffCast2 rows | action callback | `verified-already-at-parity` after activation | secondary takeover suppresses primary output during occupancy, then held primary may resume |
| Dampen CastSpin | skill 21 | `verified-already-at-parity` | specialized spin takeover remains |
| Firewalker/Mindstar/Regenerate and other actionless state branches | dispatcher switches | `verified-already-at-parity` | toggle transition may coexist with the held primary without invented StaffCast |
| Planewalker/Plane Orb | dispatcher/modifier primary override | `verified-already-at-parity` | native override still owns the primary after accepted activation |

### InventoryScreen SwipePages

| Member / branch | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| standalone left viewport `[50,89,320,320]` | InventoryScreen/SwipePages | `exact-ported` after this pass | hard clipping and page-local painter order |
| companion viewport `[103,89,320,320]` | same owner shifted 53 right | `exact-ported` for ordinary companions | same pages/inputs beneath Fomentius, Luthacus, and Shlorio |
| Hagatha companion replacement | PerkShop | `verified-already-at-parity` | fixed CHARMS/CURSES pane remains, no nested scroller |
| page 0 identity/level/discipline | `LEVEL/NEXTLEVEL` rows | `verified-already-at-parity` | exact visible page retained |
| page 0 primary spell | `DAMAGETYPE/DAMAGE/MANACOST/MANARECOVERY` | `verified-already-at-parity` | current selected primary output retained |
| page 0 melee | `MELEEDAMAGE` | `verified-already-at-parity` | native range/unit retained |
| page 1 attributes | `HP/MANA`, derived cast/walk speed | missing | current/max values and derived percentages |
| page 1 resistances | `RESISTDAMAGE/RESISTMAGIC/RESISTPOISON` | missing | pain/magic/poison percentages from authoritative derived state |
| page 2 ordinary owned selectors and empty cells | progression list/count | missing from standalone/ordinary companion | nine row-major cells, icon/hover membership |
| page 2 DRINK TONIC decoration | renderer data/atlas | missing | exact text/art remains non-transactional |
| drag threshold and capture | `0x00431C80/0x0043A1E0/0x00431DA0` | missing | more than 10 pixels, pointer capture, bounded page snap |
| wheel step | `0x00431E60` | missing | one 320-pixel page per signed wheel action |
| up/down indicators | Inventory record 13 inside content | painter missing beyond first pair | exact visibility at page boundaries |
| indicator click | no retail control/hit callback; live click no-op | owner-directed Website extension | click changes exactly one page and remains keyboard/touch accessible |
| close, Sack navigation, service replacement, teardown | InventoryScreen owner | `verified-already-at-parity`, regression expanded | page input/state does not leak across unrelated surface owners |

### Completed-run Luthacus archival

| Member / branch | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Health and Mana Potion roots | backpack `+0x13B8` | missing at terminal Game Over | both bottles enter the retained Sack exactly once |
| other Potion subtypes and stack quantity | common item tree | missing at terminal Game Over | identity/quantity preserved |
| seven equipment sinks | Gameplay `+0x1410`, marker `item+0x58` | missing at terminal Game Over | every eligible occupied sink transfers |
| arbitrary backpack items, nested/empty Sacks | common inventory tree | missing at terminal Game Over | exact recursive object identity, no flattening except existing replication-depth packing policy |
| consumed-corpse branch | Player `+0x1C0` through `SETZ` | existing web model has no corpse-consumption producer | `out-of-system` until Ether Drain corpse consumption exists; ordinary web death uses unconsumed branch |
| Last Word ground Sacks/Gold | selector 12 | `verified-already-at-parity` | composes with carried archive into one retirement outcome |
| one of five retained Sack suffixes | `Integer(5)` | `verified-already-at-parity` | exact RNG and name |
| empty archive | `0x005BE320` | `verified-already-at-parity` | no empty Sack |
| 28-root storage boundary | profile `+0x8C` | existing bounded consolidation policy retained | no loss or invalid tree |
| fresh starter equipment/potions | `0x005CFA80` | `verified-already-at-parity` | active loadout is fresh and archived objects remain storage-only |
| pre-existing storage and persistent profile state | durable profile | `verified-already-at-parity` | storage appends/consolidates without resetting gold/perks/unforge/NPC flags |
| explicit Kill/New Game retirement | existing true branch | `verified-already-at-parity` | continues to scavenge carried bottles/equipment |
| terminal Game Over profile checkpoint | existing false branch | missing; prior Website-only policy superseded by this report | now uses the same native carried-item archive owner |
| multiplayer participants | one economy/profile per player | missing terminal matrix | each completed participant receives only that participant's carried tree |

No native member is blocked by the browser platform. The two deliberate web
extensions are removable ordinary perks and clickable page indicators; both are
explicitly user-directed and do not replace the recovered native drag/wheel or
purchase/archive contracts.

## Native ownership thread

- Gold: Arena wave ordinal `+0x8FF0` and finalized progression Gold scalar
  `+0xC0` produce the integer total. The actor retains the amount independently
  from its four-row art tier, so appearance cannot be used as an amount meter.
- Perks: progression owns the ordered selector list, capacity, flags, and
  first-mix state. Retail creates only an apply edge and an owned-cell HoverBox.
  The requested removal therefore belongs beside `buyHagathaPerk` and must
  refresh the same authoritative player state, not delete a renderer icon.
- Casting: device levels are independent. Belt activation reaches the category
  switch before primary dispatch for the tick; accepted secondary action state
  then owns any primary suppression/override. An active primary is not an
  activation prerequisite or rejection state.
- STATS: InventoryScreen owns one nested SwipePages object. It clips and offsets
  three authored 320-pixel pages; input changes that owner state, while the gold
  triangles only report whether another page exists.
- Scavenging: completed-run processor owns both ordinary carried transfer and
  Last Word ground recovery before fresh starter construction. Luthacus stores
  the resulting named Sack as participant-private durable profile data.

## Web implementation consequence

- Keep `native-loot.ts` amount/tier behavior. Add wave-boundary regression and
  browser receipts which distinguish tier-3 appearance from amount/text/credit.
- Add `remove-hagatha` as a strict host action for ordinary selectors only.
  Preserve first-mix history and gold, clear ongoing runtime state, suppress
  repeat irreversible acquisition grants, and refresh all derived consumers.
- Delete only the `playerPrimaryCastOwnsFacing` activation guard. Preserve
  secondary-owned StaffCast2/CastSpin/Planewalker primary takeover after an
  accepted cast.
- Add the three-page stats state to the shared InventoryScreen model, replicate
  the four missing derived percentages, render pages 1/2 under a hard clip, and
  expose native drag/wheel plus requested arrow actions across standalone and
  ordinary companion screens.
- Change the durable completed-run profile path to transfer carried items. Do
  not inject archived contents into the fresh active backpack.

## Validation contract

- Gold: deterministic level 2/3 maximum 8 and level 4 maximum 10 with Charm;
  amount 10 must retain tier 3, pickup text `10 GOLD`, and exact credit.
- Perks: remove every ordinary effect family, reject Tonic/unknown/unowned
  removal, preserve first-mix price/history and gold, prevent repeat Revelation/
  Weird Caster grants, clear runtime one-shots, drop Split Mind slot B, and
  prove participant isolation plus save round trip.
- Casting: left/right input overlap plus all 23 category-2 rows from both a
  sustained and one-shot primary state; ordinary/special takeover and resume;
  unchanged cooldown, fizzle, mana, audio, facing, and teardown.
- STATS: page values 0/1/2, exact 320/960 geometry, clipped visibility, every
  label/value row, wheel/drag/click/keyboard/touch bounds, standalone plus all
  companion families, Hagatha replacement, close/reopen/reset, and no stale
  pointer capture.
- Scavenging: both starter bottles, every equipment sink, mixed backpack,
  nested/empty Sacks, existing storage, Last Word composition, empty archive,
  28-root boundary, fresh active starters, save hydration, and two participants.
- The exact Website candidate must pass
  `/opt/homebrew/bin/bash ./scripts/validate.sh` on the Mac mini, followed by a
  real Mac Chrome production-bundle journey with empty page, console,
  failed-response, WebGL-context, wire, and host-error arrays. Mod Loader is a
  read-only RE instrument and is not a parity validation or publication target.

## Implementation validation receipt

- Gold generation required no formula patch: the existing selector already
  retained the full integer independently of its four art tiers. The focused
  regression now pins charmed maxima `8/8/10` at waves `2/3/4`; the production
  browser materialized the wave-4 amount `10`, retained tier-3 art, displayed
  `10 GOLD`, and credited ten.
- Requested perk removal is an authoritative `remove-hagatha` action for
  selectors `0..26`; Tonic `27`, unknown, and unowned rows reject. Removal
  preserves gold and first-mix history, refreshes all derived consumers, clears
  Cheat Death/Serendipity/Reverie runtime, drops Split Mind slot B, and prevents
  Revelation or Weird Caster acquisition grants from repeating on repurchase.
- Secondary admission no longer widens native `PlayerWizard+0x1EC` with the
  primary-facing predicate. All 23 category-2 rows pass from both one-shot and
  sustained primary states. Mac Chrome admitted Ring of Ice while the Fire
  primary remained held, then retained ordinary cooldown, mana, Cast2, audio,
  VFX, and primary-handoff behavior.
- InventoryScreen now owns one clipped `320 x 320` viewport over three
  `320`-pixel pages. Page 1 renders authoritative Health, Mana, Cast Speed,
  Walk Speed, Pain, Magic, and Poison values; page 2 renders the nine-cell
  charms/curses pane. Native drag/wheel and the requested clickable arrow
  actions share the same bounded page owner. Browser proof traversed
  `0 -> 1 -> 2 -> 1 -> 0`, removed Life Charm without a refund, and reopened
  on page 0. The full-stage deselection hit target was moved below the stats
  interaction layer after the first browser run proved it intercepted arrows.
- Completed Boneyard Game Over now enables carried transfer only at the
  completed-run boundary. Each of two participants received one durable named
  Luthacus Sack containing Hat, Robe, Staff, Health Potion, and Mana Potion,
  while the new active wizard separately received fresh starter equipment and
  bottles. The real Luthacus screen transferred and opened that archived Sack
  without flattening or cross-participant leakage.
- Runtime candidate `b13e52da` passed the complete Mac mini Website gate after
  rebasing onto `772f91bc`; log SHA-256
  `e697540fc71d160710302e11634139da69a007a60e6f4002466170c9df770a0c`.
  The later `d6fb96e2` integration changed Website RE documentation only.
  Documentation-rebased candidate `94d3e8bb` passed the single four-stage
  production-bundle Chrome `151.0.7922.174` journey; log SHA-256
  `0b97413c3531fc3f60a32633333d5490d9ee91e1147f62e740a0c14bb1bb115e`.
  Page, console, failed-response, WebGL, wire, and host error arrays were empty.
- Representative inspected Mac frames are stats attributes
  `7d9dd324734f5c806d07b93119a139c3a4031a79ecb150269c99e3f17372fd37`,
  stats perks `47b91b6dcde8fe7857134388db12ac07ed78935b2cfecd1d72ef8537aaf80c38`,
  removed charm `127e34ddb064d07ee37d62fff13c572360e4fb5f17c74af0b100cc6832582e22`,
  overlapping Ring of Ice
  `291bd7fade8335aab08645b19896845f105e575c099ff9293ef90478bf746c62`,
  visible loot `59c3f8482057ae933b7c6eb453f118ae96357be444045c1601787021cc73a8d6`,
  and opened Luthacus archive
  `c1a69717c593ff32b8d868fd938ab613af08b00e8e9c50a25cf88d9a6499b7a9`.
- No platform-blocked member or unresolved native unknown remains. The only
  intentional extensions are no-refund ordinary-perk removal and clickable
  stats arrows; retail itself provides neither action. Publication and
  deployment remain separate and were not requested.
