# 2026-08-15 — Inventory and hub-trader native contract

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
| Targeted dowsing | `DowsingShop+0x344`; constructor/xrefs and set/type helpers | out-of-system (no retail hub producer) | constructor/xref/writer sweep |
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
500..950. Closing a paid result loses those offers without refund. The dormant
targeted branch would deterministically union every eligible same-set and
same-type recipe, but the constructor writes its target pointer null and both
retail hub constructor call sites leave it null. It is omitted because no
retail hub producer reaches it, not because its cardinality is unknown.

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
combat effects, dormant random outfitting, unreachable targeted dowsing,
selling, and persistent account storage are not silently invented by this
milestone.
