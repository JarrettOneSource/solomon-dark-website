# 2026-08-23 — Hagatha charm and curse gameplay-effect parity reopening

## Reported smell and parity question

- Reported web behavior: Hagatha sells the complete visible catalog, debits
  gold, and records ownership, but a live current-main audit found only ten of
  the twenty-seven obtainable outcomes reach the gameplay effect claimed by
  their native HoverBox copy. Seventeen purchases become inert ownership
  flags.
- Stock behavior to recover: the complete participant-owned Hagatha effect
  system, not the already-ported merchant transaction: derived stats, loot,
  owner-local guidance, skill progression, lethal recovery, damage modifiers,
  death burst/archive, automatic potion use, level-up actions, equipment
  capacity, until-hurt state, boss classification, melee/push strength, and
  capacity Tonics.
- Reproduction inputs/scenes: buy each visible selector from Hagatha; exercise
  Hub movement/equipment/skill state, Boneyard casting/incoming damage/poison/
  death/loot, level-up choices, welded components, low resources, boss and
  nonboss targets, game-over ticks 200 and 300, save/restore, two participants,
  and return to Hub.
- Falsifiers: a purchase which only changes `ownedPerkSelectors`; an effect
  active without its charm; owner state leaking to another participant; a
  one-shot flag rearming after damage/save; a Last Word effect before tick 200
  or archival before tick 300; Seeker lines to Orbs/enemies; or any catalog row
  without its own assertion.
## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | unmodified `SolomonDarkAbandonware/SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Same sealed 0.72.5 image as the catalog, progression, loot, Mindblast, and completed-run reports. | high |
| Existing native runtime | retained two-owner Steam Hagatha perk, derived-stat, combat-modifier, and runtime-correction receipts | Life/Mana `1.25`; Speed `1.10`; War `0.75`; Focus recharge `1.25`; Bare Hands damage/mana `1.15/0.85`; Brute melee/push `3/2`; Curing poison `0.5`; Glass outgoing/incoming `2`; Curse Bosses `3`; Cheat Death and until-hurt fields converge under host authority. | high-live |
| Read-only instructions | canonical Ghidra replica; apply `0x0066EF70`, refresh `0x0067C360`, cache refresh `0x006623F0`, damage `0x0052F540`, skill increase/set `0x00660320/0x00660580`, offer builder `0x0067CB70`, player tick `0x00533520`, Mindblast `0x00645B50`, run archive `0x005C9670 -> 0x005BE320`, resource writers `0x0052AC80/0x0052B150` | Closes all missing flag readers, factors, strict thresholds, clocks, RNG ownership, target families, and teardown. | high |
| Current web audit | Mac Chrome/WebGL2 at Website `d2fc7c38`; one accepted purchase and claim probe per row | `10 works / 17 no gameplay effect / 1 native-dormant`, with empty page/console/failed-response arrays. | high |
| Static data | `native-hagatha-perk-catalog.json`, progression/skill and equipment catalogs, loot actor schema | Exact selector/name/copy/price, complete secondary membership, ten Weld component tables, and supported loot/boss identities. | high |

No injected runtime address is used for the new instruction findings. All
addresses above are preferred-image addresses. The live Steam receipts are
supporting behavior evidence against the same byte-identified retail image.

## System boundary and pre-implementation membership audit

Native system: `ActorProgression`'s ordered Hagatha selector list and runtime
fields, from `PerkShop` purchase through every refresh/update/render/combat/
inventory/archive consumer and save/replication teardown. Perky selector 8 is
the one catalog member excluded by the stock and web offer builders.

This is the pre-code audit required by the parity workflow. Before publication,
the final receipt below must replace every `missing` row with an allowed final
disposition.

| Selector/member | Native owner/consequence | Pre-change web status | Required proof |
| ---: | --- | --- | --- |
| 0 Life | refresh `+0x74 *= 1.25`, preserving life ratio | verified working | final maximum/HUD and save |
| 1 Mana | refresh `+0x80 *= 1.25`, preserving mana ratio | verified working | final maximum/HUD and save |
| 2 Speed | `+0x90/+0x94 *= 1.10` | missing | movement and cast clocks |
| 3 Item | item candidate bound `*= 0.75` | verified working | seeded drop branch |
| 4 Gold | Gold bound `*= 0.75`; amount `*= 1.25` | verified working | chance and exact amount |
| 5 Seeker's | player vslot `+0x24`, `0x0052A640`; procedural gold lines to ground Gold/Sacks/Bonus | missing | exact membership, geometry, pulse, painter/teardown |
| 6 Revelation | rank writers `0x00660320/0x00660580` clamp raised ranks to at least two; purchase refresh also fixes selected A/B | missing | learn/set/purchase-concentration branches |
| 7 Cheat Death | one charge at `+0x820`; lethal path restores `0.5 * max HP` before death and consumes it | missing | Drinker ordering, one-use/save/replication/VFX |
| 8 Perky | catalog row exists; retail offer builder excludes it | native-dormant | out-of-system builder proof |
| 9 Scatter | Orb bound `*= 0.5`; larger-value flag | verified working | chance/value seeded branch |
| 10 War | offensive mana factor `*= 0.75` | missing | every offensive spell, nonoffensive exclusion |
| 11 Curing | poison lane `*= 0.5` only | missing | poison versus physical/magic matrix |
| 12 Last Word | local death tick 200 invokes common Mindblast with scale 15, radius `15*55=825`, damage `10000*0.5=5000`; tick 300 archival sweeps ground Sacks/Gold | missing | damage/VFX/audio, exact ticks, ground removal and Luthacus storage |
| 13 Spellwelder's | cache refresh rebuilds the active Weld only while flag `+0x7D9` is set | missing; web currently recomputes for everyone | frozen no-charm vector and all ten charmed rebuilds |
| 14 Weird Caster | purchase grants one random unlearned category-2 row when fewer than two are learned; offer builder enables/doubles discipline-root bias | missing; dormant bias field exists | RNG order, Revelation composition, offer distribution |
| 15 Drinker's | HP writer auto-consumes one Health Potion only at `HP <= -10`; mana writer auto-consumes one Mana Potion only when a cost would underflow and `cost < max MP` | missing | strict edges, one-potion retry, inventory/audio |
| 16 Glass Cannon | outgoing spell/melee and incoming physical/magic/poison lanes `*= 2` | missing | full outgoing/incoming matrix and shield order |
| 17 Sorceror's | one current-offer reroll or deferred choice | verified working | retained authoritative browser journey |
| 18 Focus | secondary recharge rate `*= 1.25` | missing | row/common cooldown recurrence |
| 19 Disfiguring | unlocks ring sink 2 | verified working | equip/unequip/save |
| 20 Bare Hands | without weapon only: spell damage `*= 1.15`, mana `*= 0.85` | missing | armed/unarmed/restored matrix |
| 21 Split Mind | two independent concentration slots | verified working | A/B selection and save |
| 22 Curse Bosses | damage `*= 3` for native types `1008..1011` only | missing | Demon plus synthetic complete ID/nonboss matrix |
| 23 Arcane Attractor | magical-upgrade bound `*= 0.800000011920929` | verified working | seeded powerup branch |
| 24 Serendipity | active byte `+0x73C`; spell damage `*= 3` until positive remaining damage clears it | missing | fresh/hurt/save/replication |
| 25 Reverie | active byte `+0x73D`; offensive mana factor becomes zero until the same hurt edge | missing | free cast/hurt/save/replication |
| 26 Brute's | melee damage `*= 3`; Player `+0x2C` actor-push strength `*= 2`; direct spell handlers do not read that field | missing | Staff contact, Hub/Boneyard player physics, and negative sustained-spell push coverage |
| 27 Tonic | appends one ordinary counted outcome, then raises capacity `+3`, maximum 9, exactly two direct purchases | corrected by the 2026-08-30 reopening below | `3 -> 6 -> 9`; the two visible Tonic rows consume two of the nine final cells, leaving seven ordinary cells; third/full-mind rejection |

No member is blocked by the browser platform.

## Native ownership thread

- Owner and construction: profile/PerkShop chooses selectors; participant
  `ActorProgression` owns flags `+0x7CC+selector`, selector array/count
  `+0x7C0/+0x7C4`, capacity `+0x800`, Cheat Death charges `+0x820`, and
  Serendipity/Reverie active bytes `+0x73C/+0x73D`.
- Upstream producers: PerkShop purchase `0x0056C340` first rejects when the
  complete ordered outcome count `+0x7C4` is greater than or equal to capacity
  `+0x800`. `0x0066EF70` then rejects duplicate non-Tonics, appends the
  selector, sets its flag, initializes selectors 7/24/25, and invokes refresh.
  Hagatha purchase is participant-local; host authority in the web port owns
  the corresponding mutation and RNG.
- State transitions: refresh applies scalar/conditional effects; skill rank
  writers enforce Revelation; cache refresh conditionally recombines Welds;
  offer construction consumes Weird Caster; HP/MP writers consume Drinker;
  damage clears both until-hurt bytes on positive remaining damage and then
  resolves Drinker before Cheat Death; player death ticks own Last Word.
- Downstream consumers: locomotion/cast cadence, primary/secondary spell
  resolution, Staff damage, actor push physics, poison/direct damage, loot
  selection, skill offers/ranks/Weld vectors, inventory, owner-local renderer,
  game-over enemy/loot world, Luthacus storage, snapshots, and saves.
- Entry/reset/teardown: durable ownership and spent one-shot fields survive
  region/run replacement and save/restore. Seeker is Boneyard-local
  presentation and submits no synchronized gameplay RNG. Last Word emits once
  per death epoch and archives once at the later native tick.

## Recovered behavioral contract

- All scalar factors use native float32 results. Speed is `1.10`; War `0.75`;
  Focus recharge `1.25`; Bare Hands `1.15/0.85`; Glass `2`; Serendipity `3`;
  Brute `3/2`; Curing `0.5`; Curse Bosses `3`.
- Seeker draws only for distance strictly above 100. Distance is capped at
  300. A normalized direction produces a transparent-to-gold segment from
  radii 35 to 50 and a gold-to-transparent segment from 50 to
  `0.5 * cappedDistance`, width 3. Gold is `(0.85,0.73,0.44)` and alpha is
  `0.75 + 0.5*sin((2*tick + 35*actorId) degrees)`. It is owner-local,
  source-alpha, and paints in the player post-main vslot before later managers.
- Revelation clamps only a skill being raised/set, plus the two selected
  concentration rows during purchase refresh; buying it does not upgrade the
  entire old skill book.
- A Weld records its component ranks at construction. Without Spellwelder that
  vector stays frozen; with the charm, refresh rebuilds from current effective
  component ranks. This applies to all ten authored Weld builds.
- Weird Caster's grant uses the shared authoritative integer RNG over the
  ascending unlearned category-2 rows. If Revelation is already present or in
  the same purchase, the granted row starts at rank two. The existing
  discipline-offer-bias algorithm is the recovered stock branch and must be
  enabled only by selector 14.
- Drinker consumes at most one matching potion per triggering writer call.
  The health branch runs at the native lethal threshold before Cheat Death;
  the mana branch retries the same cost once.
- Last Word reuses the complete common Mindblast VFX/audio family
  (`magicshieldexplode`, `bigfire` at pitch 1 and 0.8), but with scale 15,
  radius 825, and 5,000 damage. At archive, Gold is credited and ground Sack
  items are moved into one native-named retained Sack in Luthacus storage;
  claimed actors are removed so peers cannot duplicate them.
- Glass scales incoming damage before resistance/shield lanes. Until-hurt flags
  clear only when positive damage remains after those defenses. Drinker and
  Cheat Death then resolve in that order.
- Curse Bosses recognizes exactly type IDs 1008 DemonSkull, 1009 Demon, 1010
  DireFaculty, and 1011 Heartmonger. The web can support all four IDs at the
  damage seam even where a separate enemy materializer is not yet present.

## Web implementation consequence

- Add one cohesive native Hagatha effect kernel for selectors, factors,
  one-shot transitions, Seeker plans, Last Word constants, boss membership,
  and strict Drinker rules. Merchant UI remains a transaction producer.
- Store Cheat Death/Serendipity/Reverie state in authoritative progression.
  Store the frozen six component ranks beside an active Weld build. Extend
  protocol/save normalization and equality rather than hiding state in a
  renderer or host-only side map.
- Separate spell damage from melee damage in derived stats. Feed player push
  strength only into native consumers of Player `+0x2C`; direct Water, Steam,
  and Blizzard handler push operands remain authored spell values. Apply
  incoming Glass before defenses and clear until-hurt state after defenses.
- Reuse the existing Mindblast actors, renderer, lighting, and audio for Last
  Word with recovered overrides. Add an owner-local retained Seeker view; do
  not replicate visual phase or spend gameplay RNG.
- Remove the current unconditional Weld recomputation path by consuming the
  frozen component snapshot unless Spellwelder refreshes it.

## Validation contract

- One table-driven contract row per selector 0..27, plus ordered bundle
  composition, Tonic-inclusive total capacity, and Perky exclusion.
- Derived matrix: neutral/charmed/composed factors; armed/unarmed Bare Hands;
  spell versus melee Glass/Serendipity/Brute; Hub/Boneyard player-push contacts;
  negative Water/Steam/Blizzard direct-handler push cases.
- Runtime matrix: direct/poison/shielded hurt, Drinker-before-Cheat, spent flags,
  save/restore, and two-owner isolation.
- Progression matrix: Revelation increment/set/concentration purchase, all ten
  frozen/rebuilt Welds, Weird Caster RNG/bias/Revelation composition, and
  Sorceror/Split Mind nonregression.
- Last Word: exact death ticks, 825/5,000 target boundary, complete Mindblast
  birth/audio, ground Gold/Sack archival, noneligible loot exclusion, and
  idempotence.
- Seeker: eligible families only, strict 100/cap-300 geometry, pulse phase,
  painter ownership, local-only multiplayer view, and teardown.
- Mac acceptance: complete `./scripts/validate.sh`, complete Mod Loader static
  RE suite, and a Chrome/WebGL2 journey which purchases/exercises every row in
  Hub and Boneyard with empty page/console/failed-response arrays.

## Implementation validation receipt

The system is closed. The transaction producer now hands accepted selector
members to one authoritative Hagatha runtime; progression stores the three
one-shot fields, skill books store the six frozen Weld component ranks, and
protocol 64 replicates both through strict validation. Schema-3/4 saves retain
their existing admission rules and normalize the two new state families; new
documents fail closed on malformed charges or Weld caches.

| Selector | Final disposition | Decisive implementation/acceptance proof |
| ---: | --- | --- |
| 0 Life | verified retained | final maximum-vital derivation and save round trip |
| 1 Mana | verified retained | final maximum-vital derivation and save round trip |
| 2 Speed | verified implemented | movement and cast factors consume `1.100000023841858` without changing the neutral arithmetic path |
| 3 Item | verified retained | seeded item candidate bound |
| 4 Gold | verified retained | seeded Gold bound and `1.25` amount |
| 5 Seeker's | verified implemented | Mac WebGL2 rendered four segments for two eligible actors while the Orb was excluded; exact 100/300/35/50 geometry is table-tested |
| 6 Revelation | verified implemented | purchase concentration and new learned/Weird rows clamp to rank two |
| 7 Cheat Death | verified implemented | one charge restores half maximum HP; Drinker wins first; spent state saves and replicates |
| 8 Perky | exact native dormant | both offer builders exclude the catalog row |
| 9 Scatter | verified retained | seeded Orb chance/value branches |
| 10 War | verified implemented | offensive mana factor `0.75` reaches primary and secondary authority |
| 11 Curing | verified implemented | authoritative poison tick alone consumes factor `0.5` |
| 12 Last Word | verified implemented | death ticks 200/300, scale-15 Mindblast, 825/5,000 contract, three stock audio requests, Gold/Sack archive, and Orb exclusion pass in Mac Chrome |
| 13 Spellwelder's | verified implemented | active Weld stays frozen without the charm and refreshes its six captured ranks with it |
| 14 Weird Caster | verified implemented | shared-RNG secondary grant, Revelation composition, and discipline offer bias pass |
| 15 Drinker's | verified implemented | exact HP/MP predicates consume one nested matching potion and retry once |
| 16 Glass Cannon | verified implemented | outgoing spell/melee and pre-defense incoming physical/magic/poison lanes consume factor two |
| 17 Sorceror's | verified retained | current reroll and deferred-choice paths remain authoritative |
| 18 Focus | verified implemented | common secondary recharge consumes factor `1.25` |
| 19 Disfiguring | verified retained | third ring equip/unequip and persistence remain gated by selector 19 |
| 20 Bare Hands | verified implemented | no-weapon damage/mana factors are `1.15/0.85`; Staff and Wand both disable them |
| 21 Split Mind | verified retained | independent A/B concentration, transition, protocol, and save tests remain green |
| 22 Curse Bosses | verified implemented after the 2026-08-29 Frost reopening | IDs 1008..1011 are tripled at primary and learned-primary child contacts (including Hail), secondary, Staff, and Last Word damage seams; nonbosses remain one |
| 23 Arcane Attractor | verified retained | seeded magical-upgrade bound |
| 24 Serendipity | verified implemented | accepted purchase arms triple spell damage; zero/shielded damage preserves it and positive remaining damage clears it |
| 25 Reverie | verified implemented | accepted purchase arms free offensive casts and shares the same defended hurt edge |
| 26 Brute's | verified implemented after the 2026-08-29 Frost reopening | Staff damage consumes factor three and Player `+0x2C` push consumers use factor two; direct Water/Steam/Blizzard handler operands do not |
| 27 Tonic | corrected by the 2026-08-30 reopening below | exact `3 -> 6 -> 9` capacity; each Tonic remains in and counts toward the ordered list, so two Tonics admit seven ordinary outcomes; full-mind and third-purchase rejection |

Residual source sweeps found no obtainable selector left as ownership-only and
no alternative Hagatha state owner. The neutral skill-runtime regression found
by the first Mac gate was corrected by float32-rounding only when a Hagatha
factor is active. Browser acceptance then found and closed two integration
issues absent from unit tests: Seeker now accepts fractional presentation
ticks, and the wire validator admits only the exact Last Word scale-15,
rank-10,000 Mindblast sibling alongside the ordinary scale-9 form.

- Mac Mod Loader static RE: `496/496`, including the schema-3 effect catalog and
  complete downstream contract.
- Mac Website canonical gate: backend build/integration/formatting; lint and
  architecture boundaries; frontend suites `9/4/45/250/1420/6/61/9/43/12/7/36/23`;
  desktop `5/5`; production TypeScript/Vite/game-host build, bundle budget, and
  media policy. The candidate game entry is `439715` raw / `123809` gzip bytes,
  below `524288` / `131072`.
- Mac Chrome/WebGL2 at `1600x900`: Seeker reported four segments for Gold and
  Sack with an equidistant Orb excluded; Last Word published both common
  Mindblast actors, played `magicshieldexplode` then `bigfire` at 1 and 0.8,
  credited 7 Gold, created one native-suffix Luthacus Sack, and left the Orb on
  the ground. Page errors, console errors, and failed responses were empty.
  Reviewed capture SHA-256 values are
  `1d02b7ab9b8c4432684eda28ae8d87a184c19956793669dfa5d601117bc5f69d`
  (Seeker) and
  `ee783c45cd33b258f2eabed94a2ecd3c19d28ef94921de6f09ec3c884793adc6`
  (Last Word).

No member is blocked by the browser platform and no material unknown remains.
Publication and deployment remain separate operations; this receipt proves the
candidate tree and does not claim a deployment.

## 2026-08-30 — Tonic-inclusive outcome capacity and ordered bundle correction

### Reported smell and parity question

- Reported web behavior: with ordinary Website cheat mode enabled, a player
  bought two Tonics and nine ordinary upgrades. The left CHARMS/CURSES pane
  still has only nine cells, so it showed the two Tonics and the first seven
  ordinary outcomes while the final two accepted outcomes had no cell.
- Stock behavior to recover: the complete PerkShop admission rule, ordered
  outcome vector, Tonic capacity transition, previous-wizard Bargain Bundle,
  nine-cell render/hover consumers, participant authority, and every
  protocol/save/portable boundary which admits that state.
- Reproduction inputs/scenes: capacities 3, 6, and 9; zero, one, and two
  Tonics in multiple purchase orders; all ordinary selectors; a full mind;
  removal followed by replacement; ordered Bargain Bundles containing both
  Tonics; ordinary cheat mode; save/resume; stock import/export; and two
  participants.
- Falsifiers: an instruction which subtracts Tonic rows from `+0x7C4`; a
  renderer with more than nine owned cells; a direct Tonic purchase allowed
  at `count == capacity`; a native bundle serializer which sorts or removes a
  repeated Tonic; or a cheat-mode branch around PerkShop admission.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Player report | `/mnt/c/Users/User/Downloads/tonics - image.png`, 1336 by 557 RGBA PNG, SHA-256 `02ad9ae2d792cae9987e6f361f6ea48ce6862c3eabb6796e1b346f6c2751855d` | The web pane contains two visible Tonic icons followed by seven ordinary icons. The shop still exposes ordinary offers. This is the exact shape produced when an 11-entry state is accepted but a nine-cell painter consumes only indices 0..8. | high for the reported web presentation; purchase count is reporter testimony until reproduced in the candidate browser |
| Retail identity | unmodified `SolomonDark.exe` 0.72.5, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred image base `0x00400000` | Same sealed image as the existing Hagatha catalog/effect/save entries. | high |
| Purchase instructions | `PerkShop::Purchase 0x0056C340`, raw `0x0056C3D5..0x0056C3F1`; apply `0x0066EF70` | Purchase reads the complete vector count `Skills+0x7C4` and capacity `Skills+0x800`, then takes the full-mind branch unless `count < capacity`. Apply appends selector 27 to the same vector; it never uses a separate non-Tonic count. | high |
| Tonic transition instructions | `0x0056C90D..0x0056C958` and `0x0056CA2E..0x0056CA7D` | After selector 27 has been applied, PerkShop writes `capacity = min(capacity + 3, 9)`. The first comparison already counted the Tonic's required cell. Full-mind Tonic text explicitly says it is unsafe when already at capacity. | high |
| Construction/reset instructions | `Skills` constructor `0x006594E0`, writes at `+0x800`; clear `0x0066F020` | Fresh capacity is three. The outcome vector and 50 ownership bytes are distinct from the capacity scalar. | high |
| Bundle ownership instructions | PerkShop successful-close owner `0x0056C230`; profile vector `0x0081A390/+0x0081A394`; save/read owners already mapped at profile `+0x60/+0x64` | A successful shop close copies the complete current outcome vector in order into the next Bargain Bundle. It does not sort, set-deduplicate, or remove the second Tonic. | high |
| Renderer and hit-test instructions | `InventoryScreen::Render 0x00562520`, raw owned-page loop `0x00564C67..0x00564ECF`; pointer owner `0x0056FC90`, raw loop from `0x005707A8` | Render iterates exactly a 3 by 3 grid. Each index below `+0x7C4` loads the matching ordered selector; remaining cells use the empty art. Hover scans the same ordered count/cells. The native invariant keeps the count at or below nine. | high |
| Serializer instructions | `Skills` disk serializer `0x0065EE80`, raw vector `0x0065F18B..0x0065F1DF`, capacity `0x0065F43D..0x0065F446`; Hall `0x005A2C80` | Count, every ordered selector, flags, and capacity serialize separately; no serialization path subtracts Tonics. Hall consumes the same ordered vector. | high |
| Current web causal trace | Website `origin/main` `a554ea7368a1c93c07661f9ad01e7a93b528f888`; `hub-economy.ts`, protocol 111, save schema 23, portable profile v1, Hub Inventory renderer | `perksFitCapacity` counts only non-Tonics; `nativeHagathaOutcomeStateIsValid` allows ordinary count up to capacity; protocol and portable codecs allow 11 outcomes. The renderer correctly owns nine cells and therefore cannot show the two illegal tail entries. `stableSelectors` also sorts/deduplicates the native ordered Bargain Bundle. | high |

Static queries used canonical project `SolomonDark/SolomonDark.exe` through the
read-only replica wrapper from Mod Loader revision
`08bfba9ef367f7b863848030d0a289dc31e33192`. Wrapper SHA-256 is
`b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`;
`decompile_targets.py`, `dump_insns_around.py`, and
`find_offset_accesses.py` were used against preferred-image addresses. The
dirty Mod Loader checkout was not changed.

### System boundary and membership inventory

Native system: participant-owned Hagatha admission from the selected Perk or
Bargain Bundle through the ordered `ActorProgression` outcome vector, Tonic
capacity, nine-cell presentation, effects, replication, persistence, and
teardown. The selector-by-selector effect membership remains the complete
0..27 table above; this reopening corrects the shared admission invariant
consumed by every row.

| Member / branch | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| capacity 3, no Tonic | constructor `0x006594E0`; admission `0x0056C3D5` | `exact-ported` | three total outcomes accept; the fourth ordinary row and a Tonic both reject when already full |
| capacity 6, one Tonic | apply plus `0x0056CA2E..0x0056CA63` | `exact-ported` | the visible Tonic plus five ordinary outcomes fill all six cells |
| capacity 9, two Tonics | same transition capped at nine | `exact-ported` | two visible Tonics plus seven ordinary outcomes fill all nine cells; every eighth ordinary selector rejects |
| ordinary selectors 0..7 and 9..26 | complete authored table above; shared admission | `exact-ported` after this correction | one table-driven rejection row per member at the nine-cell boundary; existing per-effect assertions remain unchanged |
| selector 8 Perky | native builder exclusion | `verified-already-at-parity` | never appears as an offer or outcome |
| selector 27 Tonic | `0x0066EF70`, PerkShop capacity writer | `exact-ported` after this correction | outcome list contains one row per drink; direct third purchase and full-mind drink reject |
| purchase order and ordinary uniqueness | vector `+0x7C0/+0x7C4`; apply | `exact-ported` | order survives; ordinary duplicate is a no-op/unavailable offer; only two valid Tonic rows may repeat |
| Bargain Bundle `-1` membership | profile `0x0081A390/+0x0081A394`; `0x0056C230` | `exact-ported` after this correction | original order and two Tonic entries survive profile/save/portable paths and replay atomically |
| native bundle corrupt-state loophole | `0x0056C340` performs one precheck before replaying all bundle members | `out-of-system` — incidental retail debt contradicts the authored two-Tonic/nine-cell contract and can only produce an unrenderable state; the clean web authority preflights the complete projected outcome | invalid/disjoint/repeated-Tonic bundles reject without debit or partial effects |
| first-mix price history and debit | profile flags plus common purchase | `verified-already-at-parity` | capacity rejection preserves gold/history; accepted bundle retains current price formula |
| requested ordinary-perk removal | Website extension in the prior reopening | `verified-already-at-parity` | removal frees one counted cell; Tonic remains non-removable and capacity is unchanged |
| all 27 obtainable gameplay effect consumers | complete table and final receipt above | `verified-already-at-parity` | effects derive only from retained legal selectors; illegal migrated tail effects disappear with ownership |
| Cheat Death/Serendipity/Reverie runtime | progression runtime siblings | `exact-ported` for repaired saves | dropping an illegal legacy tail clears its matching retained runtime lane; retained owned lanes remain byte-for-byte |
| Split Mind concentration B and derived vitals/stats | shared skill/runtime refresh | `exact-ported` for repaired saves | repair runs the same ownership refresh as removal, so no orphaned concentration or cached factor survives |
| Hagatha service pane | `0x00562520` fixed replacement page | `verified-already-at-parity` | exactly nine row-major cells, two Tonic icons plus seven ordinary at final capacity |
| standalone/ordinary companion page 2 | same InventoryScreen owner | `verified-already-at-parity` | same ordered nine-cell plan and hover indices |
| owned-cell HoverBox | `0x0056FC90` | `verified-already-at-parity` | every retained occupied index is inspectable; no hidden legal tail exists |
| protocol snapshot and Hall projection | current economy codec/Hall record | `exact-ported` after this correction | protocol 112 admits at most nine outcomes and rejects count/capacity disagreement |
| browser save profile/continuation/Tutorial baseline | schema 23 and earlier generated state | `exact-ported` through schema 24 migration | retain both Tonics and earliest ordinary purchase-order entries up to capacity; current schema 24 malformed states fail closed |
| old invalid web debit/first-mix history | impossible-native schema 23 and earlier state | `out-of-system` deterministic repair | preserve gold and first-mix history because old saves contain no transaction-price history; never invent a refund or replay irreversible acquisition grants |
| stock import/export and portable profile | native codec plus portable v1 | `exact-ported` after this correction | legal stock vector/bundle order and duplicate Tonics round-trip; over-cap portable outcome lists reject |
| ordinary Website cheat mode | Website Settings/session policy | `verified-already-at-parity` | cheat mode supplies no bypass around the same participant transaction |
| multiplayer participants | authenticated player economy | `verified-already-at-parity` | one player's acceptance/rejection and repair never mutate another player |
| close, save, resume, Game Over, and replacement lifecycle | existing economy/profile owners | `verified-already-at-parity` | legal outcome order/capacity and bundle survive each existing boundary without a second owner |

No member is blocked by the browser platform.

### Native ownership thread

- Owner and construction: `Skills` constructs the vector empty and capacity
  three. `ActorProgression` owns the ordered vector/count, 50 selector flags,
  capacity, and three retained one-shot lanes.
- Upstream producers: PerkShop owns the only ordinary purchase admission. It
  checks total count before funds debit/apply. `0x0066EF70` appends the selected
  outcome. Tonic then raises capacity by three, capped at nine. A successful
  shop close copies that exact vector into the profile-owned next bundle.
- State transitions: ordinary removal is a Website extension which deletes one
  ordinary ordered entry and refreshes all downstream state. Tonic is never
  removed. Save migration may delete only impossible web-created overflow
  tail members while protecting the recorded Tonic rows.
- Downstream consumers: shared derived/runtime effects, InventoryScreen and
  PerkShop panes/HoverBoxes, Hall records, protocol snapshots, browser saves,
  and native portable import/export all consume the same bounded vector.
- Authority and lifecycle: the host transaction is participant-private.
  Ordinary cheat mode changes neither capacity nor authority. Existing
  save/resume, run, and replacement owners retain the corrected vector; no
  renderer or client infers or mutates membership.

### Recovered behavioral contract

- A purchase can begin only when `outcomeCount < charmCapacity`. Capacity is
  one of 3, 6, or 9 and equals `3 + 3 * TonicCount` for legal web state.
- Every appended selector, including 27, consumes one outcome/cell. The first
  and second Tonics therefore have net capacity gains of two cells each:
  `3 ordinary`, `1 Tonic + 5 ordinary`, `2 Tonics + 7 ordinary`.
- A Tonic attempted after the existing count already fills capacity rejects;
  it cannot retroactively open a full mind. Capacity rejection is atomic and
  does not debit gold, set first-mix history, apply runtime effects, or revise
  another participant.
- The owned pane is exactly nine row-major cells and reads the ordered vector
  directly. Tonics remain visible members. No legal state has a hidden tenth
  or eleventh effect.
- The next Bargain Bundle is the complete ordered outcome vector, not a sorted
  set. Both Tonic rows remain present. The web preflights the projected final
  vector atomically so the retail bundle loophole cannot manufacture a state
  which violates the authored two-Tonic/nine-cell contract.
- Schemas through 23 could create impossible 10/11-entry states. Schema 24
  retains all recorded Tonics and the earliest ordinary entries in order up to
  the stored capacity, then refreshes every ownership-derived/runtime consumer.
  It preserves gold and first-mix history; those old documents do not contain
  enough transaction history to invent an exact refund. New malformed states
  fail closed.

### Nearby-system findings

- The older portability entry correctly recovered that Tonic is an ordered
  list member, but its validators counted only ordinary selectors against
  capacity. That contradiction let protocol, browser saves, portable profiles,
  and the renderer disagree. All references to the old 11-entry bound must be
  removed together.
- The profile Bargain Bundle was also incorrectly normalized through a sorted
  set in `createHubEconomy` and rejected duplicate Tonics in the portable
  parser. Native `0x0056C230` proves it is an ordered vector copy.
- Retail's bundle replay has no per-member capacity guard. That is executable
  debt rather than a second capacity model: it contradicts its own direct
  admission, full-mind copy, two-Tonic text, and fixed nine-cell consumers.

### Confidence and open questions

- Confirmed: retail image/tool identity; total-count comparison; append order;
  post-append Tonic capacity change; fresh capacity; fixed renderer/hit-test
  membership; serializer fields; ordered bundle copy; current web causal path.
- Inferred: none required for the implementation.
- Unknown: none material. The historical price of an already-saved illegal web
  purchase was never persisted; schema 24 defines a deterministic no-refund
  repair rather than claiming a native transaction occurred.

### Web implementation consequence

- Make one Hagatha outcome invariant own total count, ordinary uniqueness,
  Tonic count, and 3/6/9 capacity. Consume it from purchase preflight,
  protocol, save, portable import/export, and tests.
- Count Tonics in `perksFitCapacity`; preflight the entire bundle atomically.
  Preserve bundle order and its two Tonic entries instead of sorting/set-
  deduplicating.
- Change the wire maximum from 11 to 9 and advance exact-match protocol 111 to
  112. Advance browser save schema 23 to 24 and repair only older invalid web
  states; schema 24 remains strict.
- Refresh runtime, concentrations, derived stats/vitals, belt/effect consumers,
  and Hall/snapshot projection after a migrated overflow is removed. Delete all
  independent ordinary-only capacity checks.

### Validation contract

- Focused kernels: every selector 0..27, all 3/6/9 boundaries, full-mind
  Tonic, removal/replacement, order, duplicate rules, ordered two-Tonic bundle,
  invalid bundle atomicity, gold/history preservation, and participant
  isolation.
- Codecs/saves: protocol 112 maximum nine; capacity/count mismatch rejection;
  schema-23 overflow migration in profile, continuation, and Tutorial baseline;
  schema-24 fail-closed behavior; runtime/derived refresh; portable/native
  ordered bundle and two-Tonic round trip.
- Renderer: two Tonics plus seven ordinary icons fill exactly all nine cells;
  every cell has the correct ordered hover target and no hidden legal member.
- Browser: in a real Mac Chrome production bundle with ordinary cheat mode,
  purchase both Tonics and seven ordinary rows, attempt an eighth, and prove
  nine retained outcomes, unchanged gold/effects on rejection, both Tonic
  icons, seven ordinary icons, visible full-capacity feedback, and empty page,
  console, failed-response, WebGL, wire, and host-error arrays.
- Run the complete Mac mini `/opt/homebrew/bin/bash ./scripts/validate.sh`
  against the exact candidate tree.

### Implementation validation receipt

- One invariant in `hub-economy.ts` now validates the complete ordered outcome
  count, ordinary uniqueness, two-Tonic membership, and capacity 3/6/9.
  Purchase preflight counts Tonics, rejects a full mind before debit, and
  atomically checks the whole bundle. `closeHagathaShop` and the authenticated
  `close-hagatha` action copy the final ordered outcome vector, including both
  Tonics, only after a successful service session.
- Protocol 112 bounds player outcomes at nine and gives Bargain Bundle `-1`
  its ordered/repeated-Tonic decoder while keeping every ordinary offer an
  exact singleton. Save schema 24 and the backend inspector migrate schemas
  through 23 by retaining both Tonics plus the earliest ordinary rows up to
  capacity, refreshing runtime/concentration/derived state, and preserving
  gold/first-mix history. New malformed documents fail closed. The native
  bridge and portable profile now preserve and validate the same ordered
  outcome and bundle contracts.
- The native full-mind MsgBox is restored with exact title and ordinary/Tonic
  copy. The fixed nine-cell pane remains the sole renderer; it no longer has a
  legal hidden tail. Ordinary Website cheat mode uses this same transaction
  and has no capacity bypass.
- Focused Mac tests passed the six directly affected kernel/simulation/
  protocol/save/portable files (`211/211`), native UI/type coverage (`61/61`),
  the corrected protocol suite, every ordinary selector at the two-Tonic
  boundary, full-mind Tonic, ordered bundle replay, participant isolation,
  schema-23 repair/schema-24 rejection, and stock-web-stock round trip. On the
  final rebased base, the broad game suite's first canonical invocation had one
  transient failure after 1,780 siblings; the unchanged exact suite reran
  `1,781/1,781`, so no product edit was made for it.
- The publication candidate is rebased on Website
  `78c51c36195e5cdc57d1f7e033560a33f40aa84a`. Its complete Mac gate passes 28
  backend/contracts, backend formatting, frontend architecture/lint with 19
  existing warnings and zero errors, all frontend suites, desktop `5/5`,
  production frontend/game-host builds, bundle budget, and media policy. The
  production Game entry is 266,278 raw / 80,897 gzip bytes under 524,288 /
  134,144.
- Real Mac Chrome used that rebased production bundle, a task-owned loopback
  host/static server, and an ordinary cheats-on local session. Starting at
  100,000 gold, it bought Tonic for 3,000, Tonic for 1,000, then selectors
  `0..6` for `600,600,750,3000,1500,600,2400`, reaching exactly 86,550 and
  outcomes `[27,27,0,1,2,3,4,5,6]`. Attempting selector 9 retained 86,550 and
  all nine outcomes, displayed the settled `YOUR MIND IS FULL!` MsgBox, and
  left both Tonics plus seven ordinary icons visible. Close/reopen exposed
  `BARGAIN BUNDLE` with the same ordered two Tonics and seven ordinary names at
  the native 50-percent price. Aborted requests, page/console errors, failed
  requests/responses, WebGL losses, wire errors, and host errors were all
  empty.
- Pre-publication visual SHA-256 receipts on the already validated `b023703c`
  base are
  `8186bebcc1e155ec0b71bd7bc8d296d741e6c506dcb436f820d50d278cdfb8ed`
  (settled full-mind rejection),
  `33beebebf4ab9d17573cc0a23aa16b1dab9939b60288dc5e44f54cd8e57dfe54`
  (bright nine-cell pane), and
  `48e46ca5d4b7438b1554b9d17164ff8a26a4e57ce34407597c4edcb25a025182`
  (ordered bundle HoverBox); the structured browser receipt is
  `251c7dccbde41e085d8071dae89980b24f8a5599707ddcca5e4cdeadec35823f`.
- No native member is blocked by the browser platform and no material unknown
  remains. No commit, push, deployment, or production claim is made.

## 2026-08-31 — Tonic capacity-affordance renderer reopening

### Reported smell and parity question

- Reported web behavior: the purple `DRINK TONIC` plaque remains at one fixed
  location after both Tonics have been purchased. The existing parity ledger
  called it non-transactional decoration without recovering the capacity branch
  that owns its placement and lifetime.
- Stock behavior to recover: the complete `Skills+0x800` capacity presentation
  in the shared nine-cell CHARMS/CURSES pane: unlocked-versus-locked cell alpha,
  the plaque's zero/one-Tonic positions, its two-Tonic absence, painter order,
  input ownership, every InventoryScreen/service surface, and persistence and
  participant boundaries.
- Reproduction inputs/scenes: legal capacities 3, 6, and 9 in standalone Hub
  and Boneyard Inventory page 2, Fomentius/Luthacus/Shlorio companion page 2,
  and Hagatha's fixed replacement pane; purchase, close/reopen, save/resume,
  Game Over/replacement, and two participants.
- Falsifiers: an unconditional draw of Inventory record 5; identical alpha for
  an unlocked empty cell and a locked cell; a plaque at capacity 9; a plaque
  hit target; or a surface that paints the pane through a second implementation.

This is a secondary report in a covered system. The 2026-08-28 InventoryScreen
pass stopped after identifying the plaque asset and failed to follow the
post-grid `Skills+0x800` reads at `0x00564EFF` and `0x00564F4E`. The 2026-08-30
Tonic correction recovered admission and persistence but accepted that
incomplete renderer claim. This reopening replaces the falsified unconditional
decoration model everywhere the shared pane is used.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | unmodified `SolomonDark.exe` 0.72.5, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Same sealed image as the existing Hagatha and InventoryScreen entries. | high |
| Renderer instructions | `InventoryScreen::Render 0x00562520`; grid `0x00564C67..0x00564ECF`; plaque branch `0x00564EFA..0x00564FA0` | Every cell below capacity is painted at alpha 1 and every later cell at float32 0.5. Capacity below 4 draws glyph `DAT_008199B0+0x40C` at the first authored center; capacity 4..7 draws it at the second; capacity at least 8 skips the draw. Legal capacity is only 3/6/9. | high |
| Raw constants | `0x007DE870=0.5f`; doubles `0x007849A0=60`, `0x00784D50=30`, `0x00784CC8=32`, `0x007870D8=16`; slot icon scale `0x00785368=0.8f` | The existing fixed-stage projection maps the two native plaque centers to `[253,288]` at capacity 3 and `[253,318]` at capacity 6. Slot pitch and icon scale remain 60 and 0.8. | high |
| Asset | tracked stock Inventory atlas record 5, frame `[429,0,92,50]`, atlas SHA-256 `527b52fb30453ae9d2bf5a0e1d3b0ee9f822eb7591452a11084e1cf4e2626265` | Exact purple `DRINK TONIC` plaque used by the conditional glyph draw. | high |
| Input instructions | `InventoryScreen::PointerRelease 0x0056FC90`, occupied-cell hover tail `0x005707A8..0x00570A6D` | Owned cells can construct HoverBoxes; the plaque has no control or transaction edge. | high |
| Current web causal trace | Website `f1c46c02`; `hub-inventory-renderer.ts`, `hub-inventory-render-contract.ts` | `addHagathaInventoryPane` unconditionally draws Inventory record 5 at `bundleCenter [253,288]`; every empty slot is tinted `0x808080` without consulting `charmCapacity`. The same function feeds both fixed Hagatha and scrolled page-2 surfaces. | high |

Fresh read-only queries used canonical project `SolomonDark/SolomonDark.exe`
through Mod Loader revision `08bfba9ef367f7b863848030d0a289dc31e33192`.
Wrapper SHA-256 is
`b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`;
`decompile_targets.py`, `dump_insns_around.py`, and `dump_floats_at.py` were
used against preferred-image addresses. The dirty Mod Loader checkout was not
changed.

### System boundary and membership inventory

Native system: InventoryScreen's participant-owned Hagatha capacity
presentation, from the authoritative ordered outcome count/capacity through the
shared nine-cell painter, exact plaque asset, hover-only input, and every scene
and lifecycle that renders the pane.

| Member / branch | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| capacity 3, zero Tonics | `0x00564EFF..0x00564F4C` | exact-ported | cells 0..2 alpha 1, cells 3..8 alpha 0.5, plaque center `[253,288]` |
| capacity 6, one Tonic | `0x00564F4E..0x00564F8D` | exact-ported | cells 0..5 alpha 1, cells 6..8 alpha 0.5, plaque center `[253,318]` |
| capacity 9, two Tonics | `0x00564F4E..0x00564FA5` | exact-ported | all cells alpha 1 and no plaque |
| occupied outcome icons, including repeated selector 27 | `0x00564E1F..0x00564EAA` | verified-already-at-parity | ordered icon `Skills[127+selector]`, scale 0.8, painted before the plaque |
| standalone Hub/Boneyard Inventory page 2 | common InventoryScreen SwipePages | exact-ported through shared painter | correct state immediately after purchase and after close/reopen |
| Fomentius, Luthacus, and Shlorio companion page 2 | common InventoryScreen with +53 x projection | exact-ported through shared painter | same state with companion offset and clipping |
| Hagatha fixed replacement pane | PerkShop/InventoryScreen common pane | exact-ported through shared painter | no nested page; purchase transition updates the same participant's pane |
| desktop, responsive, and authored mobile HUD layouts | one fixed 1600x900 native renderer | exact-ported through shared painter | no breakpoint-specific state or duplicate label |
| hover, click, drag, wheel, and page arrows | `0x0056FC90`, SwipePages input | verified-already-at-parity | plaque remains non-transactional; occupied cells alone own HoverBoxes |
| save/resume, Game Over/replacement, stock import/export | serialized `Skills+0x800` and ordered vector | verified-already-at-parity | presentation derives from restored capacity without stored UI state |
| multiplayer participants | participant-private progression/economy | verified-already-at-parity | one participant's purchase never moves another participant's plaque |
| malformed capacity outside 3/6/9 | executable threshold debt versus strict web protocol/save invariant | out-of-system | malformed current web state fails closed before rendering |

No member is blocked by the browser platform.

### Native ownership thread

- Owner and construction: `Skills` owns ordered outcomes at `+0x7C0/+0x7C4`
  and capacity at `+0x800`; fresh capacity is three.
- Upstream producers: PerkShop appends selector 27 and raises capacity by three,
  capped at nine. Save/import and participant replication preserve the same
  capacity and ordered vector.
- State transitions: capacity 3 paints one unlocked row and the first plaque;
  capacity 6 paints two unlocked rows and the second plaque; capacity 9 paints
  all cells and bypasses the plaque draw. There is no independent UI flag.
- Downstream consumers: the common InventoryScreen renderer paints slot frames,
  ordered icons, then record 5. Hover construction reads only occupied ordered
  cells; it does not consume the plaque.
- Entry/reset/teardown: page navigation and service close discard only painter
  state. Reopen, save/resume, run replacement, and participant replication
  rederive presentation from authoritative capacity.

### Recovered behavioral contract

- Slot index is compared directly with `charmCapacity`: below-capacity frames
  use alpha 1; later locked frames use alpha 0.5. Empty does not imply locked.
- At capacity 3, record 5 is centered at `[253,288]`. At capacity 6 it is
  centered at `[253,318]`. At capacity 9 it is not drawn.
- The plaque paints after all nine slot frames and any owned icons, preserving
  the stock overlap. It is exact atlas art, not bitmap text.
- The plaque has no hit target and does not buy a Tonic. Hagatha's offer and
  host transaction remain the only purchase owner.
- Every surface consumes the authenticated local participant's replicated
  capacity. No browser-local inference, stored presentation flag, or responsive
  branch owns visibility.

### Nearby-system findings

- The web field name `bundleCenter` is false ownership: record 5 is the Tonic
  capacity affordance, not the profile Bargain Bundle.
- The earlier unconditional `emptySlotTint` hid a second capacity discrepancy:
  stock distinguishes unlocked empty cells from locked cells by alpha.
- These findings change presentation only. Admission, prices, ordered outcomes,
  gameplay effects, persistence, Bargain Bundles, and the explicit ordinary-
  perk removal extension remain unchanged.

### Confidence and open questions

- Confirmed: exact retail identity; raw branch thresholds; state field;
  constants; asset record; painter order; input non-ownership; shared web call
  sites; legal 3/6/9 invariant.
- Inferred: none required for implementation.
- Unknown: none material.

### Web implementation consequence

- Replace `bundleCenter` and unconditional empty tint with one shared native
  capacity-presentation contract in `hub-inventory-render-contract.ts`.
- Make `addHagathaInventoryPane` set each slot's alpha from index/capacity and
  draw record 5 only at the recovered capacity-dependent center.
- Consume that single function from standalone, companion, and Hagatha panes;
  add no service, viewport, protocol, save, or responsive exception.

### Validation contract

- Focused contract coverage: all nine slot alphas and plaque centers for legal
  capacities 3, 6, and 9; exact Inventory record-5 frame; invalid indices.
- Existing economy coverage must continue to prove 0/1/2 Tonics, capacity
  3/6/9, full-mind rejection, order, persistence, and participant isolation.
- Complete Mac mini `./scripts/validate.sh` on the exact candidate.
- Real Mac Chrome production-bundle journey: capture standalone page 2 and
  Hagatha service at capacities 3, 6, and 9; prove first-position, second-
  position, then absence, the 3/6/9 slot-alpha pattern, unchanged purchase
  behavior, and empty page/console/failed-response/WebGL/wire/host errors.

### Implementation validation receipt

- `hub-inventory-render-contract.ts` now owns the two plaque centers, record 5,
  locked alpha 0.5, the raw `<4/<8/else` capacity branch, and slot-index alpha.
  `hub-inventory-renderer.ts` consumes that contract once for every fixed and
  scrolled pane. The false `bundleCenter` and unconditional `emptySlotTint`
  paths are removed.
- Contract coverage pins the exact record-5 atlas frame, every slot alpha at
  capacities 3/6/9, both plaque centers, capacity-9 absence, and invalid slot
  indices. The existing authority/save/portable suites continue to cover two-
  Tonic admission, full-mind rejection, participant isolation, ordered bundle
  replay, schema repair, and stock-web-stock round trip.
- The exact six-file candidate was materialized byte-for-byte in a clean
  detached Mac worktree based on Website
  `f1c46c02c60a2a3efa59bffda034c5c687856a11`. The complete Mac mini
  `/opt/homebrew/bin/bash ./scripts/validate.sh` gate passed: 28 backend
  contracts, backend formatting, frontend architecture/lint with 19 existing
  warnings and zero errors, every frontend suite, desktop `5/5`, production
  frontend/game-host builds, bundle budget, and media policy. The Game entry is
  277,279 raw / 83,708 gzip bytes under 524,288 / 134,144.
- Real Mac Chrome ran the built production bundle and authoritative host with
  ordinary cheat mode. Both Hagatha's fixed pane and standalone Inventory page
  2 showed the first plaque at capacity 3, the lower plaque at capacity 6, and
  no plaque at capacity 9; their slot frames followed 3/6/9 bright membership
  with the remainder at alpha 0.5. It then retained outcomes
  `[27,27,0,1,2,3,4,5,6]`, rejected selector 9 without changing 86,550 gold,
  and reopened the ordered Bargain Bundle. Browser errors, failed requests,
  failed responses, WebGL losses, wire errors, and host errors were empty.
- Final inspected 1600 by 900 frame SHA-256 values are
  `47ead2f7fb3a05aefb577e807e799521db954c1f33d2369fb6101cf5cebe9822`,
  `825572a93d31043dacef48dac5ab28b2d9f28aef8cd5200637f221277e799b2e`,
  and `cca127b0abfee10e455e2fe4e79ba2e532e948b9678e73777661abc7da4e327d`
  for Hagatha capacities 3/6/9, plus
  `1d75da2dafd0370ff5b84d53d10a810db155e02f7bf026d6ae2b4fb59dc26e67`,
  `605d04efc207171c1bfc899a51c7ab499407f169b823ba70b5a01f697e0da66a`,
  and `b58b59792105697b536ebb65c8a34fc867d7a188c42476484b01f7fbf1f541e9`
  for standalone Inventory capacities 3/6/9. The structured receipt SHA-256 is
  `d831cf03ea130b9b89146037b47a9aff95731463e2b2b441d95c0b91d85347f5`.
- No protocol, save-schema, gameplay-authority, timing, or platform adaptation
  changed. No native member is blocked and no material unknown remains.
  Publication and production deployment are separate operations and are not
  claimed by this pre-publication receipt.
