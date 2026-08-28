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
