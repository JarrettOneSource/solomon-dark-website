# 2026-08-21 — Inventory unforge target, transaction, and permanent bonuses

## Reported smell and parity question

- Reported web behavior: the anvil control at the bottom-right of Inventory is
  visually wrong and does not perform its stock item action.
- Reproduced current-main behavior: Windows Chrome on Website SHA `1cf60d2`
  exposes UI record 75 as a semantic `Done` button over
  `(1510,830,85,65)`. Clicking it closes Inventory. There is no `unforge`
  action, no eligible-item drag sink, no confirmation/result state, no item
  destruction, and no permanent bonus consumer. The pre-fix Hub trader smoke
  passed while deliberately clicking that false `Done` action.
- Stock behavior to recover: the complete Inventory unforge system: animated
  target, drag eligibility and source ownership, confirmation/cancel, empty
  Sack and recipe-less transmutation, every recipe-backed outcome and retry,
  permanent stat ownership, cooldown/full-rejuvenation side effects, result
  presentation, audio, replication, saving, interruption, and teardown.
- Reproduction: fresh Ether/Arcane wizard, standalone Inventory, drag the
  starter Staff from its equipment sink to backpack slot 2, then into the
  bottom-right corner. A right-edge-only release and a bottom-edge-only release
  both reject; `(1550,850)` opens the stock confirmation. Direct equipped Hat
  release at the same point retains the required-clothing branch.
- Falsifiers: record 75 being a close control; the target being clickable; any
  consumable being eligible; an equipped Hat/Robe bypassing their invariant;
  cancellation or a nonempty Sack mutating state; a failed spellbreak retaining
  the item; a recipe-less item entering the bonus table; or any bonus being
  presentation-only.

The prior 2026-08-15/16 inventory closure is reopened because it classified
the visible anvil as an exit control without following the record's input xref
through `InventoryDragger::PointerRelease`, and it left the unforge writer's
progression fields undispositioned. That violated the system-membership and
extractable-truth rules; this pass replaces the false close path everywhere.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Clean stock | unmodified retail Beta 0.72.5 `SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; directly launched as PID 8312 from isolated `solomon-stock-reforge-qNVdT6`, with no loader or injected module | Exact Staff drag, corner acceptance, confirmation, 4-gold result, item destruction, gold `698 -> 702`, and equipped-Hat rejection | high |
| Clean captures | Mod Loader `inventory-unforge-confirm.png` SHA-256 `eea3d09bf56a38b352d2c4eb53b47f29e45ff9eb8d941ef9ef0b3f857c4cca7a`; `inventory-unforge-result-recipeless-staff.png` SHA-256 `5da6181a98edb94bd5c0e9fa70e17aa37f311020781ea2e1514e82d4a8dfd4f4` | Native 1600x900 client-area confirmation and result composition | high |
| Instructions | `0x0056E950`, `0x0056EC30`, `0x00550450`, `0x005D6DF0`, `0x00568B90`, `0x00556940`, `0x005C4530`, `0x005BCCB0`, `0x005AB2C0` | Target state, complete type gate, transaction, roll table, renderer, first-use hint, and content-sized MsgBox family | high |
| Static data | UI record 75; strings `0x007948CC`, `0x00795524`, `0x007954C8`, `0x0079545C`, `0x00795448`; audio registry 32 and 100 | Exact anvil art, copy, fizzle and unforge assets | high |
| Current web | Windows Chrome `151.0.7922.138`, `smoke-hub-traders.mjs`, pre-fix capture SHA-256 `d0b9cfddf0b90b87bc15e1a3ddf0ece296b09a2561fedc22a843719214d94efc` | UI 75 has no pulse/action model and is falsely bound to close | high |

All native addresses are preferred-image addresses for the byte-verified retail
file with image base `0x00400000`; no ASLR runtime address is reused.

## System boundary and membership inventory

Native system: participant-owned Inventory unforge, beginning when a backpack
object crosses the InventoryDragger's lower-boundary state and is released in
the authored bottom-right sink, and ending after cancel/invalid restore or the
authoritative destruction, result dialog, derived-stat refresh, save dirtiness,
and modal teardown.

| Member (class/variant/scene/branch) | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| UI record 75 anvil, settled centre `(1562,868)`, red-channel pulse | `0x00568B90`; UI `+0x39A4`; `sin(tick*pi/180)*0.2+0.6` | exact-ported | renderer contract and timed browser pixels |
| Bottom-right `100x100` drag sink; no click action | drag boundary `0x0056E950`; release `0x0056EC30`; clean corner matrix | exact-ported | three rejection/acceptance coordinates and semantic-target test |
| Backpack source ownership | Dragger `+0x99/+0x9A`; `0x0056E950` | exact-ported | backpack accepts; direct equipped Hat remains required-clothing |
| Ring 7002, Amulet 7003, Staff 7004, Hat 7005, Robe 7006, Item_Sack 7008, Wand 7011 | exhaustive `0x00550450` comparisons | exact-ported | one assertion per type |
| Potion 7001, placeholder 7000, Perk 7009, Map 7010, Misc 7012 | fall-through of exhaustive type gate | verified-already-at-parity (invalid release restores) | one assertion per ineligible type family |
| Nonempty Item_Sack rejection | `0x00570C10`, `0x00552170` at `0x0056ECBC..0x0056ECE8` | exact-ported | nested contents unchanged and no action |
| Empty Item_Sack immediate transmutation without confirmation | Sack branch at `0x0056ECEA`; `0x005D6E4A` | exact-ported | direct result and 2..5 gold range |
| Recipe-less eligible equipment | item `+0x74 == 0` at `0x005D6E67` | exact-ported | confirmation, 2..5 gold, destruction |
| Recipe-backed fixed and generated equipment | item `+0x74 != 0`; web fixed recipe or generated effect payload | exact-ported | both identities enter roll table |
| Confirmation and atomic cancel | `0x0056ED70..0x0056EF29`; primary `unforge`, secondary `cancel` | exact-ported | exact copy, two controls, zero cancel mutation |
| Full rejuvenation | case 0 `0x005D6F7D` | exact-ported | health/mana maximum plus category-2/global cooldown reset |
| Offensive spell damage +1/+2 | case 1 `0x005D7063`; progression `+0x84` | exact-ported | flat damage consumer test |
| All-spell mana-cost reduction +1/+2 | case 2 `0x005D7126`; progression `+0x88` | exact-ported | pre-multiplier cost consumer test |
| Mind Dredge deferred skill choice | case 3 `0x005D71EA`; progression `+0x48` | exact-ported | exact 1-in-100 retry and later choice ownership |
| Base maximum health +5/+10 | case 4 `0x005D7253`; progression `+0x6C` | exact-ported | derived maximum/current-ratio test |
| Base maximum mana +10/+20 | case 5 `0x005D7323`; progression `+0x78` | exact-ported | derived maximum/current-ratio test |
| Experience gain +1/+2/+5/+10 percent | case 6 `0x005D7403`; progression `+0x8C` | exact-ported | enemy reward consumer test |
| Gold +10..60 | case 7 `0x005D74FB` | exact-ported | all six authored amounts |
| Spellbreaking fizzle | `0x005D759A`; string `0x007954A0` | exact-ported | no bonus, item still destroyed, failure result/audio |
| Success and failure result MsgBoxes | `0x0056EF69..0x0056F393`; `Dialog_AddLine 0x005BCCB0`; `MsgBox` vtable `+0xB4 -> 0x005AB2C0` | exact-ported | widest-line sizing across short and generated long item names, one-button layouts, and every result copy variant |
| `sounds\\unforge` | registry 100, member `+0x1148`, SHA-256 `173db629737f50f3a958358dc9f88fb3b25528ee93298f2f95416517747fa9e2` | exact-ported | accepted one-shot browser event |
| `sounds\\fizzle` | registry 32, member `+0x598`, SHA-256 `938420950d859ebc00a9b1a37e548c7c2183a8504689b32aab3de3c683899e76` | verified-already-at-parity asset; exact-ported event | fizzle one-shot browser event |
| Participant authority, replication, save/resume, and owner book pause | local progression owner plus dirty byte at `0x0056F3FC`; Website host/economy/save and source-qualified pause owner | exact-ported | two-player isolation, paused-owner Unforge admission, strict decode, save round trip |
| Standalone Inventory `I`/Escape close | toggle `0x005C6F10`, close `0x00555810` | exact-ported | anvil cannot close; `I` and Escape do |
| InventoryDragger equipment/backpack/Luthacus siblings | existing `0x0056DE50`, `0x0056FC90`, `0x0056CD00` contract | verified-already-at-parity | retained trader/inventory smoke |
| Belt binding and nested-Sack insertion siblings | separate destination owners reached by ordinary release before/after this branch | out-of-system (separate hotbar/container systems; no unforge state consumed) | boundary trace retained as nearby finding |
| One-shot service-companion help flag | `DAT_0081A3D0`, render `0x00557066`, clear/save `0x005684C0` | out-of-system (persisted first-use tutorial system, not transaction state) | exact copy and lifecycle recorded below |

No member is `blocked-by-platform`; every unforge mechanism is representable in
the browser.

## Native ownership thread and recovered behavioral contract

- `InventoryDragger` (`0x00794294`) is constructed at `0x00550990`. Its update
  at `0x0056E950` sets the lower-boundary state only for an ordinary backpack
  source; release `0x0056EC30` additionally requires the rightmost 100 pixels.
  The resulting sink is the intersection `(1500,800,100,100)` at 1600x900.
  UI record 75 is presentation only and has no pointer callback.
- The exhaustive eligible type predicate is `0x00550450`. A nonempty Sack is
  restored. An empty Sack skips confirmation. Every other eligible item opens
  `REALLY UNFORGE THIS?` with the exact body, `UNFORGE`, and `CANCEL`.
- Cancel returns the same live object to its source with no RNG, counter, stat,
  gold, inventory, or revision change. Confirm calls `0x005D6DF0`; the item is
  destroyed after either success or fizzle, the inventory view is rebuilt,
  progression is refreshed, and gameplay is dirtied.
- Empty Sacks and eligible objects without a recipe pointer consume
  `Integer(4)` and grant `value+2` gold. They do not increment the unforge
  attempt counter or enter the bonus table.
- A recipe-backed attempt increments progression `+0x874` once per selection
  pass. Counts 1..4 draw `Integer(7)`; count 5 draws `Integer(8)`; later counts
  draw `Integer(count+3)`. Values 0..7 select the eight rows. A value above 7
  consumes `Integer(6)`: exactly value 3 redirects to the gold row; every other
  value is a destructive fizzle.
- Full rejuvenation retries while both health and mana are already full through
  count 5, then becomes unconditional. Mind Dredge retries unless
  `Integer(100)==25`. Every retry increments `+0x874` and repeats the complete
  selector, so it changes future odds in the same invocation.
- Damage and mana-cost amounts are 2 only when count is below 5 and
  `Integer(3)==1`, otherwise 1. Health is 10 before count 5, then 10 only on
  `Integer(4)==1` and otherwise 5. Mana is 20 before count 5, then 20 only on
  the same one-in-four condition and otherwise 10. Experience is 5 or 10 with
  equal probability through count 4, then 1 or 2 with equal probability. Gold
  is `(Integer(6)+1)*10`.
- The permanent consumers are native base HP `+0x6C`, base MP `+0x78`, global
  offensive flat damage `+0x84`, global mana-cost reduction `+0x88`, and XP
  bonus fraction `+0x8C`. Mind Dredge increments deferred choices `+0x48`.
  Full rejuvenation copies maxima into current HP/MP, zeros the global cooldown,
  and zeros every category-2 row cooldown before the common refresh.
- The target's native red tint is
  `sin(nativeTick*pi/180)*0.2+0.6`; green, blue, and alpha multipliers remain
  one. This produces the observed green-gold pulse instead of a static yellow
  icon. The shared inventory reveal alpha still multiplies the whole surface.
- Success plays registry 100 once; destructive failure plays registry 32 once.
  The result is `%s UNFORGED`, then `Unforging bonus:`, then the exact outcome;
  failure is `FAILED UNFORGING!`, `Spellbreaking fizzles!`, `No bonus`.
- `Dialog_AddLine 0x005BCCB0` retains the widest rendered line at MsgBox
  `+0x80`; finalizer `0x005AB2C0` centers the content-sized HoverBox. At
  1600x900 the inner width is `max(rendered line widths) + 141`, centered at
  x `801.5`. The 373-pixel widest confirmation line yields the captured width
  514, while 249-pixel `STAFF UNFORGED` yields width 390. Generated long names
  widen the one-button result instead of reusing that Staff exemplar.
- The first service-companion Inventory may pulse `DROP ITEMS HERE / TO UNFORGE
  THEM` for 100 of each 120 ticks while profile tutorial flag `DAT_0081A3D0`
  remains set. Destroying that companion clears and saves the flag. It is a
  nearby tutorial owner, not an eligibility or transaction gate.

## Web implementation consequence

- `HubEconomyState` owns the item, shared participant RNG, unforge count,
  permanent bonus ledger, and exact outcome feedback. The host performs the
  entire confirm transaction atomically; the client only owns the pending
  confirmation UI.
- Derived player stats consume base HP/MP, flat offensive damage, mana-cost
  reduction, and XP bonus from that ledger. Mind Dredge updates the existing
  deferred-choice component. Full rejuvenation also resets authoritative
  secondary cooldown state.
- `InventoryActions` must treat `(1500,800,100,100)` as a drop sink only for a
  backpack source. It must remove the false `Done` target, retain invalid
  restore and required Hat/Robe handling, and let `I`/Escape own close.
- The renderer must animate UI 75, render the stock two-button confirmation and
  content-sized one-button success/failure MsgBox layouts, preserve the item
  dragger above the base inventory until release, and expose semantic controls
  only where stock has controls.
- Exact untouched `unforge.wav` enters the existing game-audio manifest. The
  already shipped `fizzle.wav` is reused without duplication.
- Protocol decoding and save restore must reject malformed new outcome/bonus
  shapes while normalizing pre-field schema-3 saves to the native zero ledger.
  Source-qualified book pauses already consume protocol 47 on current main, so
  the combined incompatible wire shape advances to protocol 48.
- The host's owner-inventory pause admission must include `unforge`; otherwise
  the visible confirmation accepts locally while the frozen host silently
  drops the transaction. Foreign players and non-inventory pause sources remain
  unable to submit it.

## Confidence and open questions

- Confirmed: system owner, all function xrefs, exhaustive type membership,
  source/target geometry, complete RNG tree, all constants and strings, every
  stat writer and consumer class, item destruction, modal branches, and audio.
- Inferred only: the descriptive name of the persisted `+0x874` counter;
  instructions prove its role in unforge odds. The web name
  `recipeAttemptCount` records that narrow meaning without asserting a broader
  native label.
- Unknown: none material inside the unforge boundary. Belt and nested-container
  destination semantics are separately owned systems and explicitly
  dispositioned above, not hidden unforge unknowns.

## Validation contract

- Focused kernel tests must cover all seven eligible types, all five ineligible
  families, empty/nonempty Sack, recipe-less gold, every selector row, the
  retry/counter boundary at 4/5/6, forced-gold and fizzle tails, cancellation,
  destruction, bonus consumers, cooldown reset, two-owner isolation, protocol,
  and save normalization/round trip.
- Render tests must pin target rect/centre/art, the exact pulse extrema and
  period, both dialog control geometries/copy/colors, absence of a `Done`
  action, the widest-line panel formula for short and generated long names,
  and all success/failure result variants.
- Windows Playwright must start from the real menu, open Inventory, prove anvil
  click is inert, move Staff to backpack, reject right-only and bottom-only
  releases, cancel once, confirm once, observe item destruction/gold or bonus,
  capture confirmation/result pixels and both audio events, prove the peer sees
  the source-qualified Inventory wait state, close with `I`, await authoritative
  pause release, and report empty page/console errors. A second player must
  remain unchanged.
- The exact final tree must pass focused tests and `./scripts/validate.sh` from
  Windows. Stock-versus-web dialog regions use the committed clean 1600x900
  captures and zero-offset comparison; raw raster deltas remain descriptive.

## Implementation validation receipt

- Implemented the complete participant-owned unforge transaction in
  `hub-economy.ts`, including the seven-type gate, empty Sack and recipe-less
  gold branches, all eight recipe selectors, retries, destructive fizzle,
  permanent bonus ledger, item destruction, and exact outcome copy. The
  authoritative consumers cover base HP/MP, offensive flat damage, all-spell
  flat mana reduction, XP gain, Mind Dredge, and full-rejuvenation cooldowns.
- Protocol 48 strictly carries the source-qualified book pause plus unforge
  action, bonus ledger, and result;
  schema-3 saves normalize the absent legacy fields to the native zero state.
  The exact stock `unforge.wav` is shipped at SHA-256
  `173db629737f50f3a958358dc9f88fb3b25528ee93298f2f95416517747fa9e2`;
  the existing exact `fizzle.wav` owns destructive failure.
- Removed the false semantic `Done` control from standalone Inventory. UI 75
  is now an inert animated drop marker; `I`/Escape close the screen. The
  renderer uses the exact confirmation geometry and the recovered widest-line
  result sizing rule, including a 601-pixel inner panel for the live
  `BUG-MASTER'S WAND UNFORGED` title instead of overflowing the 390-pixel Staff
  exemplar.
- Windows Node 22.17.0 focused acceptance passed 38 merged protocol/derived
  tests, 38 host tests including paused-owner Unforge, and 16 Hub render tests.
  The exact final tree passed Windows `./scripts/validate.sh`: 13 backend
  integration tests, frontend suites of 2, 41, 225, 1,238, 17, 10, 7, 17,
  and 16 tests, five desktop tests, lint and architecture boundaries, Release
  backend build, production frontend and game-host builds, 98,290-byte-gzip
  Game entry budget, and media policy.
- Windows Chrome two-client Hub acceptance returned `status: ok` with no page
  or console errors. It proved the inert click, animated tint, right-only and
  bottom-only rejection, peer Inventory wait state, cancel, paused-owner
  admission, confirmed destruction, participant isolation, permanent `+10
  maximum health` application, exact `unforge.wav` buffer start, and balanced
  pause release before the next Inventory edge. Final confirmation/result
  captures are SHA-256
  `7960795a323eb8ccdeb463a162d79b361bb2d4bb3816f75b46791fde6e19a0df`
  and `86d16019630fe4c899a37543e5c7647576e426948572a42a890a015a3119a454`.
  Stock-versus-web confirmation comparison selected best offset `(0,0)`.
- All five native Hub/economy static contracts pass against the updated
  catalog and clean capture manifest. No material in-system unknown or
  `blocked-by-platform` member remains. Direct `main` publication is authorized
  by the user; deployment and production verification were not requested.

## 2026-10-05 — Report67 animated Unforge target preparation

### Reopening and evidence boundary

Report67 reopens the target-presentation row above. The earlier closure proved
UI record 75 and its red-channel pulse, but did not record the complete root
suffix or compare the orange presentation through a full animation period.
Whether that presentation comes from UI75 art/pulse or an additional dynamic
draw remains open. Accepting the one-sprite target as a complete contract
without that trace skipped the presentation membership check. The previously
recovered Unforge transaction, eligibility, dialogue and authority contracts remain
retained evidence; this preparation changes no runtime or transaction code.

The current original Discord message `1554349667230416936` was read again on
October 5 through the existing account `600774060439371807`, with two bounded
eight-message reads around it. Its edit remains September 29
`04:31:22.895 UTC`; the forge-fire clause is unchanged, has no strikethrough,
and is not withdrawn. No nearby forge-specific correction was found. “Fire
gif” is reporter terminology and does not establish the native asset format
or algorithm. Report22 bag navigation in the same message is a separately
owned decision hold. A whole-message completion reaction requires both actual
acceptances and remains held.

| Evidence class | Source | Finding | Confidence / limitation |
| --- | --- | --- | --- |
| Reporter stock media | Original bag-mechanics MP4, attachment `1554349666370326598`, 692779 bytes, SHA-256 `d76176255f7aab8d771fd18bfafd2421e088e8c1220f0549e102f5daeff0bae8`; unchanged bytes re-hashed October 5 | Retained Report22 frame 64 at PTS `2.160588888888889` seconds shows orange fire around the anvil | Direct visual observation; the clip's executable/version and input timestamps are unsealed; this frame cannot prove lifetime or phase |
| Clean retail capture | Retained `inventory-unforge-confirm.png`, SHA-256 `eea3d09bf56a38b352d2c4eb53b47f29e45ff9eb8d941ef9ef0b3f857c4cca7a`, with `native-inventory-unforge-captures.json` provenance | Anvil and orange effect remain visible under the dimmed confirmation surface | Direct retained observation; byte-verified direct retail 0.72.5, no loader/debugger; one still does not prove timing |
| Existing native class catalog | `InventoryScreen` vtable `0x00794F54`: constructor `0x00560380`, update `+0x08 -> 0x00551A10`, root draw `+0x0C -> 0x00568B90`, detail/help `+0x28 -> 0x00556940`, close `0x00555810`, destructor `0x005684C0` | Identifies the native screen owner and the bounded lifecycle trace | Retained native catalog, same pinned image; the anvil effect's call and arguments are still unextracted |
| Existing atlas-consumer catalog | Root `0x00568B90` has UI record 75 / object `+0x39A4` at decompiler line 1094; the UI/Inventory/Fonts use list contains no recovered fire call | The atlas-reference list is not a complete dynamic painter contract | Retained decompiler-derived catalog; absence from its matched atlas uses cannot prove absence of a helper call |
| Existing Fire painter evidence | Entries [010](010-staff-and-orb-rendering.md), [237](237-2026-08-26-selected-primary-staff-orb-program.md), [287](287-2026-08-27-complete-stock-renderer-and-game-wide-vfx-reflection-reopening.md) | Shared painter `0x005360C0` owns core 110, all flame rows 255..266, frame `floor(tick/5)%12`, additive then normal half-alpha flame | Recovered native helper contract; its use by the anvil is a hypothesis until the root call is inspected |
| Current Website source | Published base `29764a0e0c561fb1297f41e2ec18023f5b603b0c`, `buildInventory`, `buildService`, `createHubInventoryRenderer` | Inventory builds only the inert UI75 marker for this target; `renderItemEffects` changes its tint; no forge-fire view/model/update exists | Static source finding, not a current built-browser reproduction or pixel acceptance |

The missing source-log paths named by the older atlas catalog are not present
at their translated retained locations. Reuse the durable findings above;
do not silently treat a missing raw log as fresh instruction proof. All
preferred addresses refer to the retained 0.72.5 image at base `0x00400000`,
4,723,200 bytes, SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`.

### Provisional owner boundary and checkable membership

Boundary: the InventoryScreen bottom-right animated Unforge presentation,
including its native root call, all screen variants sharing that call, clock,
transforms, reveal/curtain order and teardown. If it delegates to the shared
Fire painter, that helper's complete xref census must establish all genuine
shared consumers before an algorithm change. No runtime implementation is
ready while the extractable caller contract remains open.

| Member or branch | Native / current source | Preparation disposition |
| --- | --- | --- |
| UI75 marker, pulse, inert click and 100x100 drop sink | Earlier contract above; current `pages.ts` and render contract | Recovered existing behavior; final composite acceptance reopened |
| Orange effect adjacent to UI75 | Retained stock frame and clean confirmation capture | Supported visible member; caller/helper/constants pending native recovery |
| Standalone Inventory in Hub Courtyard and private rooms | InventoryScreen; `HubScene -> HubInventoryUi` | Supported owner variant; effect-specific native branch pending |
| Standalone Boneyard Inventory with world held | InventoryScreen; `BoneyardScene -> HubInventoryUi` | Supported owner variant; effect clock versus held region pending |
| Fomentius Shop companion Inventory | Native service attachment `0x00514A20`; `buildService -> buildInventory` | Supported shared screen consumer; effect visibility/phase pending |
| Hagatha PerkShop companion Inventory | Same native attachment; Hagatha left-pane branch | Supported shared screen consumer; effect visibility/phase pending |
| Luthacus InventoryShop companion Inventory | Same native attachment and two inventory owners | Supported shared screen consumer; effect visibility/phase pending |
| Shlorio DowsingShop before roll and after roll | Same native attachment; both current service branches | Two supported shared screen variants; effect/flash ordering pending |
| Root backpack, nested Sack and moving Sack pages | One InventoryScreen plus InventoryGrid page owners | Same target owner; effect must be checked independently of page rebuilding; Report22 behavior is protected |
| Hover, pointer press, no item, selected item and active drag | Inert UI75; lower-boundary Dragger gate above | Known negative click contract; any effect response to drag/eligibility remains unproven |
| Eligible/ineligible/required clothing, empty/nonempty Sack, confirmation/cancel, success/fizzle | Earlier exhaustive transaction membership above | Retained transaction contracts; fire-through-notice/drag ordering and lifetime need acceptance |
| Inventory opening, closing, book switch, notice, dye surface, repeated `setModel` | Native constructor/update/root/destructor; current renderer rebuild | Effect phase/reset/order must be recovered; current rebuild destroys every surface child |
| Resize, display projection, pause, hidden presentation and renderer destruction | Native screen/graphics owner; retained Website presentation scheduler/canvas owner | Explicit lifecycle/coordinate unknowns until native caller is inspected |
| Shared Fire painter core 110 and every flame row 255..266 | `0x005360C0`, entries 010/287 | Fully recovered candidate helper/assets; anvil membership not yet proven |
| Create, equipped Staff/Wand, selected-primary/Weld, inventory wizard preview, Memorial and world element views | Existing Fire/element helper consumers, entries 010/237/287 | Supported separate caller contexts; preserve current contracts; include any actual shared-helper correction across its census |
| Dialogue without InventoryScreen, SkillScreen without InventoryScreen, Title/Loader | Separate scene owners; current dialogue does not call `buildInventory` | Negative screen membership; no anvil to animate |
| Unforge economy/RNG/stat/save/protocol writers and audio registries 32/100 | Existing transaction owner above | Separate from this presentation correction; no evidence of new writer or sound |
| Mod-provided UI replacing stock Inventory and unsupported native-only surfaces | Distinct authored surface ownership | Separate/unknown reachability; do not invent a stock fire consumer |
| All root/helper xrefs, dormant/default branches and any other authored tables reached by the call | Not present in retained complete form | Explicit unresolved membership; must be drained before implementation acceptance |

These are preparation statuses, not final shipping dispositions. In particular,
the unknown xref/table row prevents claiming a native-complete inventory.

### Current ownership, readiness and reuse consequence

`HubInventoryUi` owns a retained renderer promise for its scene lifetime.
`useHubInventoryRenderer` waits for `get()`, installs the current model, mounts
the canvas, and subscribes to the shared presentation frames; closing a modal
detaches/unsubscribes, while the scene owner destroys the retained renderer.
`setModel` destroys and rebuilds surface children for both standalone Inventory
and service companion Inventory. Therefore a cosmetic owner added only to one
builder, or an effect phase stored in a disposable model child, would omit
shared members or restart on ordinary model changes.

The renderer already waits for the combat atlas's page zero and creates the
registered native element textures before its promise resolves. Core 110 and
all twelve candidate Fire rows 255..266 are on that loaded page. Its existing
`NativeElementVfxView` preserves per-operation blending and registered frame
geometry. `game-webgl` installs the recovered fixed-function shader; reuse
those owners if native caller evidence proves the same program. No new GIF,
decoded sprite strip, image generator, asset loader or rendering library is
justified by current evidence.

Current inventory time is the presentation `nowMs` passed to `render`, with
the anvil tint and wizard preview reading `nowMs/10`; reveal multiplies the
surface alpha, service overlay is above its companion Inventory, and notices
are added afterward. This records current code, not a recovered anvil fire
clock. The native call must establish phase source, anchor/scale, color/alpha,
order, pause/reset and default branches before selecting the implementation.

Likely affected owners, conditional on that proof: inventory `pages.ts`,
`model.ts`, `services.ts`, and `hub-inventory-renderer.ts`; reuse the existing
element draw plan/view/textures and render contract. Integrate Report61's
published inventory-summary work before affected checks; preserve Report65's
owned protocol work, public protocol147/save49 and Report56 facing fields.

### Finite next phase and acceptance

One parent-granted M5 native-only phase should inspect bounded constructor,
update, root and destructor instruction spans, then run one complete original
`.text` direct-call census plus bounded preferred-pointer candidates for those
owners and the retained Fire helper. Dump exact static operands reached by the
instructions and enumerate any new table spans needing complete recovery before
porting; label linear-disassembly/code-data ambiguities and any
unrecovered function tail explicitly. Reuse existing retained Fire algorithm,
asset, shader and Report22 clip receipts. No Website/media/runtime computation
belongs to this initial phase. Its sealed inputs, commands, deadlines,
private tool staging, PGID cleanup and artifact ACK live in the task's native
readiness packet; they do not grant execution.

After native closure: record every final member disposition, reproduce the
missing fire through a meaningful public renderer/browser regression, then
implement the recovered shared owner. Verify actual built Hub/Boneyard and
all four service companions, both Dowsing states, complete native frame/pulse
periods, idle/hover/press/drag, open/close/reopen/model rebuild, pause, resize,
notice/dye layering and teardown. Compare each supported member against native
evidence; a sparse clip frame or generic Fire helper test is insufficient.
The exact integrated candidate must pass the unchanged M5 focused checks and
canonical all-mode gate before coordinated publication/deployment. No test,
build, browser, native execution, publication, deployment, reaction or Report67
completion is claimed by this M2 preparation.

### Closed native phase 1751 — the authored strip, mask and target path

The fresh native-only phase admitted at `17:52:58.012396 UTC` and ended at
`17:53:05.181243 UTC`, October 5. It ran the sealed retail image through four
bounded owner spans and one complete `.text` direct-call census on the M5
external Drive. The full native and SSH terminals exited zero; the complete
440320-byte export has SHA-256
`be032e7aae0dc1a1e9006637c2c94e8e67cbf2e2dde65869850acfb503aaba4f`,
was durably acknowledged, and all owned process groups, the entire private M5
root and exact lease were removed. Parent independently verified closure at
`17:57:02 UTC`. These are native evidence/resource receipts, not product
acceptance. No Website, media or stock-runtime execution occurred.

Raw owner evidence is now complete through actual returns: constructor
`0x00560380..0x00560BAC`, update `0x00551A10..0x00551DA8`, root
`0x00568B90..0x0056AE23`, destructor `0x005684C0..0x00568B84`.
Neighboring instructions in the deliberately wider probes are not assigned to
these owners. Root output SHA-256 is
`59bbe05850e8385cc19bd862063842b82261c047fa453f2f36441b1c3a4cb013`;
the complete call-context output is
`055a460c18d64dfd663dc3104f568f3c0e2853625dcb9781234d0f18397f01df`.
The census covered all 3680256 original `.text` bytes and found eighteen
decoded direct calls to the five declared entries. Four preferred-address
byte candidates reconcile with the constructor/destructor vtable stores and
the retained InventoryScreen update/root slots; no candidate is silently
treated as an independently proved xref.

**The provisional Fire-helper hypothesis is falsified.** The complete
InventoryScreen root does not call `0x005360C0`. Its eight census callers are
the already recovered element/selected-primary/Create/actor contexts, all
`out-of-system` for this forge correction. Do not modify the settled Fire
algorithm, add a Fire orb, derive another sprite strip, or assume GIF playback.

The actual owner is a screen-root program using three authored UI records and
the shared temporary render target:

| Member | Authored data / native producer | Recovered disposition |
| --- | --- | --- |
| Anvil/arrow UI75 | frame `(502,775,68,57)`, logical `68x57`, no trim/rotation/points; builder `0x004F4161 -> UI+0x39A4` | `recovered-pending-port` as the complete composite; existing standalone marker retained |
| Multiply mask UI76 | frame `(160,983,51,39)`, logical `51x39`, no trim/rotation/points; builder `0x004F4186 -> UI+0x3A68` | `recovered-pending-port` |
| Scrolling color image UI77 | frame `(959,130,55,55)`, logical `55x55`, no trim/rotation/points; builder `0x004F41AB -> UI+0x3B2C` | `recovered-pending-port` |
| Shared scratch sprite `0x00B3BEFC`, dimensions at `+0x94/+0x98` | root bind/clear/composite plus retained 256x256 target evidence in entries 022/084 | Root use recovered; specific resource producer/reset/teardown/global-xref closure still pending |
| Fire helper and core/BadGuys flame bank | no call from root; independent census callers | `out-of-system`; unchanged retained exact program |

All three UI rows are already fully extracted in
`frontend/src/assets/game/native-ui-assets.json` (SHA-256
`b9c051f8c7bab2b58cb6d7584cde74f30a3f9c382bc10ad3ab70a32e765a5029`).
The current shipped `skill-picker-ui-atlas.png` and original retail `UI.png`
are byte-identical: 1139167 bytes, SHA-256
`37d5e8fc543af12a9d8019e738dbe1e29b648211144a3782c3a32e71f76cd2eb`.
The 113-row UI bundle identity remains
`1db00ea8826e787ca9a320c90a33e726991cae00906baddfdc8bde31da697498`.
The retained UI asset-consumer join has exactly one consumer for each of
UI75/76/77: InventoryScreen root `0x00568B90`. Same-numbered BadGuys rows
belong to another atlas and are not siblings of this UI program.

The raw suffix establishes this order and these operands:

1. `0x0056A7D7..0x0056A814` computes common target/marker anchor
   `x = screenWidth - 38 + (1 - reveal)*25`, `y = screenHeight - 32`, then
   binds `0x00B3BEFC`. Exact qword bytes recover `38`, `32` and `25`.
   Settled 1600x900 therefore yields `(1562,868)`; opening/closing also moves
   the complete marker/composite by the authored 25-pixel X term.
2. `0x0056A819..0x0056A8A8` clears the target to transparent black, zeros
   its translation and installs unit scale around the target center. The
   retained shared target is 256x256, centered at `(128,128)`.
3. `0x0056A8AD..0x0056A9CE` derives the bounded capture clip from the full
   UI76 dimensions. The native conversion receives
   `(cx - width/2 + .5, cy - height/2 + .5, width, height)`;
   at 256x256 and 51x39 this is `(103,109,51,39)` after integer conversion.
   Preserve the instruction-defined rounding and frame registration.
4. `0x0056A9D3..0x0056AA68` reads signed application tick
   `0x0081F658`, divides by eight with truncation toward zero and takes signed
   remainder modulo UI77's logical height. For ordinary nonnegative ticks,
   `p = floor(appTick/8)%55`. The first UI77 draw is centered at
   `(cx, cy-p)`; `0x0056AA73..0x0056AAF3` draws it again at
   `(cx, cy+55-p-1)`. The one-pixel overlap is authored, not a seam adjustment.
5. `0x0056AAF8..0x0056AB5A` switches selector to `2` and draws UI76 at
   the target center. Native `ZERO/SRCCOLOR` multiplies the destination by
   the exact mask; this is not an ordinary visible white sprite or an
   alpha-only guessed silhouette. `0x0056AB5F..0x0056AC82` restores selector
   zero, previous target, matrix and clip state.
6. `0x0056AC82..0x0056ACCC` replaces the color multiplier with white RGB
   and InventoryScreen reveal alpha, then draws the completed target at the
   common anchor. `0x0056ACD1..0x0056AD5F` submits UI75 afterward with its
   retained red-channel sine pulse and the same reveal/anchor. White state
   is restored locally, and `0x0056AD95` invokes the retained color/multiplier
   helper `0x00483350` before the root returns; its exact saved-state body
   remains to reconcile. Confirmation/help/registered child
   surfaces are separate later surface-tree owners.

The clock is closed by retained entries [217](217-2026-08-25-tutorial-modal-teaching-overlay-stage-10-13-callout-and-pointer-geometry-reopens-2026-08.md)
and [296](296-2026-08-28-create-element-ray-cadence-correction.md):
`0x0081F658 == App+0x28`, incremented at 100 Hz by `0x00427824` under
`0x0040D1B0`. Inventory/world pause does not freeze it. Opening, Sack traversal,
selection, service rebuild and notice changes do not reset the application
phase. The strip advances one pixel every eight ticks and repeats after
440 ticks (4.4 seconds); the separate marker pulse retains 360 ticks. Browser
process-start phase cannot reconstruct a historical native recording's
absolute phase; use the established `nativeApplicationTick` projection and
compare complete cycles without inventing a scene-local timer.

### Membership, lifecycle and remaining extraction after 1751

The nine constructor census sites reconcile with three retained callers:
four service branches of `0x004FB890` (`0x004FB984`, `0x004FBAC5`,
`0x004FBBFB`, `0x004FBD24`), four service branches of `0x00514A20`
(`0x00514B9C`, `0x00514C93`, `0x00514D90`, `0x00514E79`), and standalone
Inventory open `0x005C6F10` (`0x005C6FAA`). Service companions and standalone
Hub/Boneyard therefore share the same root suffix. The sole direct destructor
call at `0x0056D903` belongs to its deleting-destructor wrapper. Update/root
are dispatched through the retained vtable, not omitted because their direct
CALL census is empty.

The complete suffix has no conditional admission based on selected item,
drag eligibility, Sack depth, service kind, mouse hover, button press,
Enhanced Effects, or a successful Unforge. Those are either consumers of the
same root presentation or separate transaction/input owners. Existing UI75
inert-click/drop behavior remains required. The constructor/update/destructor
spans create and retire the InventoryScreen and its own child state without
constructing a private Fire actor or altering the App counter. The shared
target is rebuilt/cleared during root painting; it is not a persisted gameplay
effect, audio emitter, save field or replication field.

Read-only Git recovery found the settled generic pipeline/asset facts at
Mod Loader commit `80df2ed5dcaba3d5e5be50820a83259193ce6c15`, avoiding a replay
of the old native renderer investigation. `native-full-render-pipeline.md`,
its xref/membership catalogs and `native-asset-system.md` retain the matching
retail hash and the exact normal/additive/multiply RGB/alpha equations,
frame wrap/linear sampling, begin/end target helpers, Sprite 0xC4-byte
lifetime and persistent texture-slot restoration. `0x00441420` creates the
persistent slot; `0x00440520 -> 0x00441330` recreates it after device loss;
`0x00440450` tears down device resources. No Mod Loader file or branch changed.
Retained catalog dispositions are evidence for these generic seams, not proof
that every call uses the particular `0x00B3BEFC` scratch object.

Known other users of that scratch object are game HUD composition
`0x00512060`, StormCloud `0x00602C30`, Leviathan `0x006151D0`, and Arena's
auxiliary target use `0x00470EE0`; retained evidence records their separate
programs. They are `out-of-system` for the UI75/76/77 fill program and must
retain their own capture/color/alpha state. The larger generic target-binder
caller list also includes item/status/portrait/world helpers with other
targets; it must not be mislabelled as a complete `B3BEFC` reference census.

Remaining extractable unknowns are narrow and explicit: the exact global
scratch object's construction/creation arguments and release/reset xrefs,
the complete references to its 0xC4-byte descriptor and dimensions, any
default/degraded branches of that specific resource, and the full saved-color
restore body at `0x00483350` (the retained pipeline only identifies its
`0x0041FF60/0x0041FE50` calls). Generic primitive and
device-lifecycle semantics are already retained. The three authored UI rows,
strip algorithm, native App clock, screen anchor, owner tails, root input
independence and current source omission are recovered; no new Fire/native
media investigation is justified. Close the specific resource references
before parent acceptance of the native contract or runtime porting.

Implementation consequence now supersedes the provisional element-view reuse:
reuse the exact already-loaded UI atlas, application tick, native primitive
blend/target owners and retained Inventory renderer lifetime. Build the full
strip/mask capture below the anvil and return that presentation owner through
both Inventory and service construction. Preserve its global phase across
`setModel`, its 25-pixel reveal anchor, mask rounding, one-pixel strip overlap,
native intermediate alpha and full state restoration. No generic Fire view,
GIF, new image, new dependency or protocol/save field belongs to this program.
Exact browser acceptance and publication remain future gates.

### Closed native target phase 1842 — specific resource and color restoration

The distinct target phase admitted `18:43:33.434413 UTC` and ended
`18:43:42.204218 UTC`, October 5. Complete output is 348160 bytes, SHA-256
`eb42f5b55ff12f2c8b7856408c0bb028d11d2b27adbc035d7a92a0b2f696e682`.
All three helper probes and the single original `.text` reference census
returned zero. The durable export/ACK, twelve members, process-group drains,
whole private-root removal and exact lease release were checked locally and
independently by the parent at `18:50:42 UTC`. The old phase's unused clock
was not reused. No Website/media/runtime execution or port occurred.

`0x00B3BEFC` is the embedded **RenderToSprite** member
`MyApp+0x31C8CC`, not an InventoryScreen-owned Fire object. The complete
absolute/relative census found 89 operand references, including the two
previously proven root sites. Its construction, initialization and destruction
sites reconcile with retained MyApp vtable `0x0079A004` and RenderToSprite
vtable `0x007DC668`:

| Specific member | Instruction evidence | Disposition / remaining limit |
| --- | --- | --- |
| MyApp constructor `0x005BA6E0` | `0x005BAA23..0x005BAA2E`: `ecx = MyApp+0x31C8CC`, calls `0x004171F0` | Specific subtype constructor identified; body pending |
| MyApp resource initialization virtual `+0xBC -> 0x005B69D0` | `0x005B69D7..0x005B69FA`: pushes `0,1,256,256`, invokes `0x00417310` on that member | Exact persistent scratch creation arguments `(256,256,1,0)` recovered; do not reinterpret the two flag operands without their existing backend contract |
| Actual MyApp destructor `0x005B6500` | `0x005B65E6..0x005B65F1`: same member, calls `0x00417290` | Specific subtype destruction identified; body pending |
| Exception cleanup sites | `0x00775C45..0x00775C4B`, `0x0077686E..0x00776874` | `MyApp+0x31C8CC` then tail-jump to the same destructor; genuine cleanup, not unrelated code/data discarded from the census |
| Generic image creation wrapper `0x00417310..0x004174CE` | full body; forwards four arguments to `0x00420700`, writes handle `+0x08`, logical width/height `+0x94/+0x98`, full 0..1 UVs, centered registered quad and ownership flag `+0x04 = 1` | Recovered generic contract; width/height <=0 is a no-allocation return and is not a stock 256x256 target branch |
| Generic explicit release `0x004174E0..0x00417503` | if `+0x04 != 0`, calls `0x00420760` with handle `+0x08`, then clears `+0x04` | Recovered separate explicit-release API; it is not the actual RenderToSprite destructor |

This narrows the residual honestly: the particular instance uses subtype
constructor/destructor `0x004171F0/0x00417290`, whereas the preceding probe
inspected the generic create/explicit-release pair. Retained class and pipeline
catalogs identify that destructor's texture-release call at `0x004172DC` but
do not retain its whole body. No raw body exists in the checked retained
Decompiled Game logs. The required remaining native span is only
`0x004171F0..0x00417310` (288 bytes), covering subtype construction, deleting
destructor `0x00417200` and ordinary destructor `0x00417290`. Do not replay
the root, resource census, generic wrappers, settled Fire program or media.

The 89 reference sites partition completely as follows. Each render family
uses the same temporary target resource but has its own fill program:

| Consumer / resource branch | Reference count | Report67 disposition |
| --- | ---: | --- |
| Arena auxiliary painter `0x00470EE0` | 2 | `out-of-system`: separate world mask/light program, entry 022 |
| Game HUD `0x00512060` | 14 | `out-of-system`: HUD composition, distinct authored records |
| Painting/easel `0x00518620` | 7 | `out-of-system`: portrait/eulogy capture, entries 118/204/297 |
| Memorator `0x0051E270` | 4 | `out-of-system`: sixteen-heading NPC program, entries 024/118 |
| PlayerWizard `0x005468C0` | 23 | `out-of-system`: status/body compositing, no UI75/76/77 use |
| InventoryScreen `0x00568B90` | 10 | `recovered-pending-port`: sole authored UI75/76/77 fill consumer, all standalone/service variants |
| MyApp subtype destruction / resource init / construction | 1 / 1 / 1 | Specific resource lifecycle; pending only the 288-byte subtype body |
| StormCloud `0x00602C30` | 8 | `out-of-system`: separate storm target program |
| Leviathan `0x006151D0` | 12 | `out-of-system`: appendage/mask capture, entry 084; no change to Report76 |
| Puppet shared presentation `0x00628AD0` | 4 | `out-of-system`: family render/hit compositing, entries 091/301 |
| Two MyApp exception cleanup sites | 1 / 1 | Same destructor lifetime, not new animation variants |

No reference is silently left in an unidentified family. The classification
uses the actual instruction sites plus retained class/render/atlas contracts;
membership of a shared scratch resource does not imply membership of the
Unforge fill algorithm. Generic target/device behavior remains the recovered
pipeline contract, with a new private Website-owned capture lifetime permitted
instead of copying stock's incidental global scratch aliasing.

The final color-pop ambiguity is closed by the complete body
`0x00483350..0x0048342C` (output SHA-256
`194f6feabaad27354d3797599975a00f63ea6cb777ce2e6b1fb36a5d0e6cd7bf`).
It decrements/clamps the multiplier-stack index `Graphics+0x198`, reads the
four saved float channels from the 16-byte record in `+0x18C`, and restores
them through `0x0041FF60`. It then reapplies the current local color
`Graphics+0x1EC/+0x1F0/+0x1F4/+0x1F8` through `0x0041FE50`. Therefore the
root's reveal multiplier is scoped and cannot leak into the next surface.
The body contains no new authored table, random draw, effect lifetime or
alternative UI mask. Existing color-stack/default behavior is retained;
the Unforge path has the matching saved entry before its final pop.

After the specific subtype constructor/destructor body is reconciled, the
recovered presentation predicts all enumerated Unforge variants without a
guessed asset, clock, geometry, opacity or global-state fallback. Native
contract acceptance remains with the parent; no runtime implementation begins
from the incomplete lifecycle inference.

### 19:13 subtype closure — ready for the recovered port

Standing end-to-end authority allowed the final single 288-byte subtype
query. The first attempt declined before admission on a transient foreign
lease and created no native process/root; a fresh phase admitted at
`19:13:20.976859 UTC` after actual lease absence. It exported 30720 bytes at
SHA-256 `7fa8d3214e87c5acb057a5f273c0238dfacefea62ce7e670b67d2ae672f31580`,
exited zero and released its root/lease/groups at `19:13:25.966236 UTC`,
with SSH drained at `19:13:26.122186 UTC`. This was a worker-prepared bounded
record under standing authority, not an independent parent review.

The exact subtype bodies close the last lifecycle inference. Constructor
`0x004171F0..0x004171FF` delegates to retained Sprite initialization
`0x004138A0`, then installs RenderToSprite vtable `0x007DC668`. Ordinary
destructor `0x00417290..0x00417302` releases handle `+0x08` through
`0x00420760` only when ownership byte `+0x04` is set, clears that byte, and
invokes base Sprite destruction `0x00413990`. Deleting destructor
`0x00417200..0x00417283` performs the same owned-handle/base cleanup and
deallocates the object only when its deleting flag has bit zero set. The
embedded MyApp resource uses the ordinary destructor, including its two
exception cleanup tails. There is no private Fire owner, timer, new authored
table or hidden presentation branch. The previously enumerated generic
create/explicit-release and all specific lifetime/consumer references remain
the canonical model.

The native contract is now ready for implementation: the exact UI strip/mask,
application clock, target/marker anchor and reveal movement, per-draw blending,
intermediate target alpha, scoped color/matrix/clip restoration, resource
reset/destruction and full member/negative-consumer census are recovered.
Absolute process-start phase remains the established browser constraint;
there is no unextracted in-system fact justifying an approximation. Shipping
dispositions await the public regression, integrated implementation, required
M5 gate and actual built per-member visual/lifecycle acceptance.


### Recovered Website presentation owner and regression

The M5 initial regression ran against the exact two tracked source blobs of
`aba0947f2c2860b9e359fafe58ed88119f643189`. All three public geometry, scroll
and reveal assertions failed at the intentionally unimplemented contract;
there was no import/tool failure. The private Node check released its root,
lease and process groups at `19:38:21.820128 UTC`; the complete 20480-byte
export was durably hash-ACKed and its M2 transport drained. This focused red
establishes the recovered contract before its implementation; it is not a
claim that the original renderer executed that missing program.

`native-unforge-target.ts` now projects the actual UI records and signed
application tick into the two image centers, integer clip, viewport/reveal
anchor and existing marker pulse. `NativeUnforgeTargetView` owns one private
256-square non-premultiplied linear target and two UI77 source sprites. It
clears transparent black, applies the exact rectangle clip, paints UI76 with
the existing native multiply pipeline, then presents the normal target before
UI75. Its composite uses the retained RenderToSprite half-pixel quad bias.
The capture is redrawn on every visible root draw, so context restoration
and model changes cannot leave cached blank target contents.

The inventory renderer owns that view across surface rebuilds. Each shared
`buildInventory` invocation attaches the same retained presentation after the
belt and before flybys, item inspection and dragger; standalone and all four
service companions therefore use the same complete program. Rebuild detaches
it before destroying the previous surface; dialogue leaves it detached.
Current application time is sampled on model and render updates, and surface
reveal is applied once to both target and marker. Final renderer teardown
releases the view's containers and target before borrowed UI atlas textures.
Inventory input, drop geometry, unforge transactions and Sack behavior retain
their existing contracts. Shipping dispositions remain pending actual M5
type/focused checks, unchanged canonical gate and built per-member journeys.


The existing transparent inventory canvas requests
`preserveBrowserCompositingAlpha` from the fixed-function renderer. Its normal
mode therefore uses browser compositing alpha for that renderer, including
an ordinary offscreen draw. The recovered Unforge intermediate instead needs
native `SRCALPHA / INVSRCALPHA` on both RGB and alpha (the alpha square already
recorded above). The new private capture scopes the normal/PMA and normal/NPM
blend arrays to the existing native factors, flushes the state cache, renders
its target and restores both previous arrays in `finally`. Screen compositing
retains the established transparent-canvas contract; shared renderer setup
and other scratch consumers are unchanged. The independent stock-record GPU
oracle checks all 55 scroll steps, wrap, composed marker/reveal, clipping and
state restoration, plus retained target/borrowed texture ownership.


### First exact candidate GPU verification — October 6

The `15b39638` candidate, cleanly based on published `aa27c24a`, passed its
M5 type check, all 40 focused contracts, frontend lint and production build.
The independent stock-record GPU oracle compared all 55 strip positions plus
wrap, all intermediate RGBA channels and five composed marker/reveal cases.
No channel exceeded the two-byte rounding tolerance (maximum error 2), every
strip position contained 1049–1050 visible pixels, clipping/state restoration
passed, the target remained identical across reparenting, teardown destroyed
it and all three borrowed UI textures remained alive. Chrome page/console/
request/response error arrays were empty. This validates the recovered source
program against the exact stock atlas data, not an absolute stock-video phase.

The built scene run reached Hub, Hagatha and Fomentius but stopped on a helper
readiness assertion: the retained canvas still exposed its preceding model's
settled marker when the next model began opening. The first Fomentius corner
capture was black; later captures changed 3078 green/blue pixels, with browser
error arrays empty. The helper now lets the new model receive its presentation
frames before awaiting settled reveal, so an opening frame cannot serve as its
stationary motion baseline. The source effect was not tuned to that transient.
Remaining built member/interaction journeys and the canonical final gate are
still pending. Actual lease/group/native-registration cleanup closed at
`00:41:24.899185 UTC`; source remained clean and home metadata changed only the
known same-byte 40-byte Crashpad setting timestamp. Task-owned source and
private tools/cache are retained across checks under standing authority.


### Built shared inventory ownership verified

After the paint-readiness correction, the exact `0341b06a` production build
passed the GPU oracle again and the built Hub inventory plus all four service
companions. Each had 2058–2148 painted corner pixels and 1041–1046 changing
green/blue pixels across six samples. The red-only UI75 pulse cannot produce
that motion. Hagatha, Fomentius, Luthacus and Shlorio also retained the same
scene renderer and native backpack resume control; no browser page/console/
request/response errors or context losses were observed.

The subsequent book journey stopped at the helper's polling observer for the
short Inventory/Skills overlap. That observer is now armed as a DOM mutation
observer before the switch action; it retains the same actual simultaneous
surface and native target assertions, without increasing its timeout. This
preserves the transition evidence rather than relying on polling to see a
brief shared lifetime. Boneyard/book and complete transaction/notice journeys
remain pending. This phase released its exact lease/groups at
`01:20:10.832148 UTC`, with native registration cleaned and the candidate
worktree clean. Task-owned worktree/tools/cache remain inactive for reuse.


### Integrated book helper readiness

The clean `60fccbc9` candidate integrates published `221a03e0`. Its M5
production build passed. Hub standalone and resized inventory pixel receipts,
both Hub Inventory/Skills overlap observations, and potion consumption passed
before the Boneyard inventory activation timed out. The mutation observer
correction therefore closes the earlier missed Hub overlap; this new stop is
at a separate entry action. `BoneyardScene` guards the belt inventory callback
with `!inputBlocked` and publishes `data-gameplay-input-blocked`. The helper
was clicking at renderer readiness alone, without establishing that the input
guard had cleared. It now awaits both established readiness attributes using the existing
90-second scene bound, as other Boneyard acceptance tools already do. No
product behavior, effect parameter or timeout was changed. Pixel receipts are
emitted as each member completes so a later independent failure preserves
completed observations. Boneyard and the full trader journey remain pending.
Actual phase cleanup released the lease at `02:31:28.286308 UTC`; five M5
stage groups, native registration and all eight M2 transport groups plus the
runner were absent, source was clean and only the qualified same-byte Crashpad
setting timestamp changed.
