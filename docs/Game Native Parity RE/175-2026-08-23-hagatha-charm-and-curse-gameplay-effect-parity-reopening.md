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
| 6 Revelation | rank writers `0x00660320/0x00660580` clamp raised ranks to at least two; purchase refresh also fixes selected A/B | missing | Historical field ownership was wrong here: selected A/B are the creation starter primary/secondary, not concentrations. See the 2026-09-02 reopening below. |
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
- Revelation clamps a skill routed through the native increment/set writers,
  plus the two creation starter rows during purchase refresh. The earlier
  concentration interpretation was falsified and is superseded by the
  2026-09-02 field-writer reopening below. Buying it still does not sweep the
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
- Progression matrix: Revelation increment/set/starter-pair purchase, negative
  selected-concentration coverage, all ten
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
| 6 Revelation | superseded by the 2026-09-02 reopening below | purchase-time creation starter rows, later learned/Weird rows, and effective-rank equipment grants clamp to rank two; selected concentrations do not receive a purchase-time rewrite |
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

## 2026-08-31 — Six-slot/one-Tonic full-mind report and Button handoff

### Reported smell and parity question

- Reported state: six visible outcomes include one Tonic; the pane still paints
  `DRINK TONIC`; Hagatha rejects another Tonic and every ordinary charm with
  `YOUR MIND IS FULL!`. The side glyphs on that message's `OKAY` button are
  visibly misplaced.
- Parity question: distinguish a broken Tonic projection from the authored
  capacity dead-end, then hand the independently observed shared-Button defect
  to its owning presentation system rather than changing Hagatha authority.
- Falsifiers: selector 27 does not consume one outcome cell; capacity grows
  before direct-purchase admission; the capacity-six plaque is absent; or the
  full-mind branch mutates gold/outcomes/capacity.

This is a secondary report in the Hagatha system. The 2026-08-30 admission pass
did recover this boundary, but the resulting behavior is counterintuitive
enough that the exact six-slot/one-Tonic state must be explicit rather than
mistaken for a regression. The button-ornament issue is a separate secondary
report against the reusable stock-Button system in entry 183.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail instructions | `PerkShop::Purchase 0x0056C340`, precheck `0x0056C3D5..0x0056C3F1`; apply `0x0066EF70`; capacity write `0x0056CA2E..0x0056CA7D` | Direct purchase requires current ordered outcome count `<` current capacity. Selector 27 is appended to that same vector before capacity rises by three. | high |
| Retail renderer | `InventoryScreen::Render 0x00562520`, capacity branch `0x00564EFA..0x00564FA0` | Legal capacity six paints six bright cells and record 5 `DRINK TONIC` at `[253,318]`; only capacity nine omits it. The plaque is not a control. | high |
| Current web authority | Website `41e15254`; `perksFitCapacity`, `buyHagathaPerk`, `hubHagathaTonicPromptCenter` | The host performs the same pre-append full check and the renderer derives the same capacity-six plaque. Rejection preserves the economy and emits the selector-specific full-mind notice. | high |
| Fresh retail identity | `SolomonDark.exe` 0.72.5, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Re-confirms the sealed image behind the existing addresses. | high |

### System boundary and membership inventory

Native system: Hagatha direct-purchase admission and capacity presentation for
the exact one-Tonic/full-six-outcome state. Shared Button art and input are
owned by entry 183.

| Member / branch | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| one Tonic plus zero to four ordinary outcomes | ordered vector and capacity six | `verified-already-at-parity` | another ordinary row or the second Tonic can fit while count is below six |
| one Tonic plus five ordinary outcomes | direct precheck at `0x0056C3D5` | `verified-already-at-parity` | count equals six, so both an ordinary row and the second Tonic reject before debit/apply |
| capacity-six `DRINK TONIC` plaque | `0x00564F4E..0x00564F8D` | `verified-already-at-parity` | visible at `[253,318]` despite the full state; no hit target |
| Tonic-specific full-mind copy | PerkShop selector-27 rejection strings | `verified-already-at-parity` | `YOUR MIND IS FULL!`, head-explosion paragraph, `OKAY` |
| ordinary full-mind copy | non-27 rejection strings | `verified-already-at-parity` | meridian paragraph and Tonic explanation, no mutation |
| ordinary-perk removal Website extension | prior owner-authorized extension | `verified-already-at-parity` | removing one ordinary outcome creates the free cell required to buy the second Tonic |
| `OKAY` body/end/edge/label composition and pressed state | shared `Button` / MsgBox presentation | transferred to entry 183 | one correction covers this and every Hub sibling using the same primitive |

No Hagatha member is browser-blocked and no authority, protocol, save, price,
offer, effect, or lifecycle change follows from this report.

### Web implementation consequence and validation contract

- Preserve the current Hagatha capacity rule and capacity-six plaque. Do not
  special-case selector 27, infer capacity from visible art, or move the
  capacity write ahead of admission.
- Correct the `OKAY` button through entry 183's shared Button composition only.
- Focused authority coverage must keep the six-outcome/one-Tonic rejection,
  unchanged gold/vector/capacity, and successful second Tonic after one ordinary
  removal. Mac Chrome must reproduce both selector-27 and ordinary full-mind
  messages while proving the corrected shared Button geometry.

### Implementation validation receipt

- Hagatha authority and presentation code did not change. Focused Mac economy
  coverage now explicitly proves `[27,0,1,2,3,4]` at capacity six rejects a
  second Tonic without changing object identity, then accepts it after selector
  4 is removed. The complete 50-test economy file passes.
- Real Mac Chrome used the built production bundle and authoritative loopback
  host. It bought one Tonic plus selectors `0..4`, reached `6 / 6`, retained the
  lower `DRINK TONIC` plaque, rejected selector 27 at unchanged 90,550 gold with
  the exact head-explosion copy, removed selector 4, then bought the second
  Tonic. It finished with ordered outcomes `[27,0,1,2,3,27,4,5,6]`, capacity
  nine, and an ordinary selector-9 rejection at unchanged 86,050 gold.
- The Tonic and ordinary notices both expose the exact body action rectangle
  `[702,397.5,196,69]`. Idle/pressed connector probes found nonzero pixels in
  both top and bottom middle strips and both full ends; the shared Button
  implementation and sibling receipts are owned by entry 183.
- Browser page/console errors, failed requests/responses, WebGL losses, wire
  errors, and host errors were empty; the final frame reported 59 FPS. The
  structured browser receipt SHA-256 is
  `909d7bc35ab03369586c38028fffea0be4d2cb57b7b107e91ab55dddca67ed5e`.
  Idle/pressed Tonic full-mind captures hash to
  `b9a7b664a8cde6a085930812e8e00eb7cdfbb541878143041716df727e438df1`
  and `9eda51e721cf76f23d6db9856e2c80f453368e2f7bda8ad4e49ffaa3af0ee6dc`;
  the ordinary rejection hashes to
  `1937f17211725cc5a086d1a2624c5b4471afacd3425641234c6f0a8aedbe36cb`.
- No protocol, schema, price, offer, capacity, effect, replication, or lifecycle
  behavior changed. No Hagatha member is browser-blocked and no material
  unknown remains. Commit, push, deployment, and production restart were not
  performed.

## 2026-09-02 — Revelation creation-starter and rank-writer ownership correction

### Reported smell and parity question

- Reported web behavior: buying Revelation makes later learned skills start at
  rank two, but the two skills created with the wizard remain rank one. A Fire
  wizard therefore keeps Fireball and Ring of Fire at rank one.
- Stock behavior to recover: Revelation's complete permanent/effective-rank
  floor, including its purchase-time targets, every later rank writer, the
  complete authored equipment skill-effect table, Tutorial setup, authority,
  persistence, and removal/rebuy boundaries.
- Reproduction inputs/scenes: all five creation elements; Fireball/Ring of Fire
  as the reported pair; a pre-existing nonstarter skill; selected concentration
  A/B; normal and Insight level choices; Weird Caster; Tutorial Acid Rain;
  every authored equipment kind-4/7 row; save/resume; and two participants.
- Falsifiers: `+0x86C/+0x870` are concentration fields; purchase refresh walks
  every learned row; one of the five creation pairs does not pass through those
  fields; `0x00660580` omits selector flag `+0x7D2`; or the web purchase already
  changes either starter rank.

This is a secondary report in a covered system. The 2026-08-23 pass stopped at
the reads in `0x0067C360` and labeled `+0x86C/+0x870` as concentration A/B
without sweeping their writers. That skipped the ownership and membership
rules: fresh-character setup `0x005D0290` proves they are the creation starter
primary and secondary, while concentration selection lives on a separate
surface. The same pass named both rank writers but did not compose Revelation
with the authored equipment effects routed through `0x00660580`. This reopening
replaces both falsified assumptions across the complete rank-floor system.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Player stock/web comparison | issue report, 2026-09-02 | Stock raises Fireball and Ring of Fire to rank two when Revelation is acquired; current web leaves both at one while later acquisitions use rank two. | high for the observed pair |
| Retail identity | unmodified `SolomonDarkAbandonware/SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Same sealed 0.72.5 image as the prior Hagatha, skill, equipment, and Tutorial entries. | high |
| Creation instructions | `0x005D0290`, raw `0x005D0468..0x005D04C8` | The five element branches call increment writer `0x00660320` for root, starting primary, and starting secondary, then write the primary to `+0x86C` and the secondary to `+0x870`. Fire writes `16` and `21`. | high |
| Revelation refresh instructions | selector apply `0x0066EF70`; refresh `0x0065F9A0`; Skills vslot `+0x60 -> 0x0067C360`; raw `0x0067C541..0x0067C645` | Selector flag 6 is byte `+0x7D2`. When set, refresh reads the two IDs at `+0x86C/+0x870` and writes `max(2, permanentRank)` to each addressed row. It does not scan the skill table or read concentration actions. | high |
| Rank-writer xref sweep | `0x00660320`: 19 refs in seven functions; `0x00660580`: two refs in `0x00576AA0`; `0x0067C360`: two Skills vtable entries at `0x0079FF5C/0x007A0D34` | Covers fresh setup, normal/Insight choices, Weird Caster, Tutorial/script/Book paths, and the two equipment set/grant calls. Both writers enforce the same selector-6 minimum. | high |
| Tutorial instructions | `0x005D5CF0` | Tutorial grants skill 72 through `0x00660320`, then replaces `+0x870` with 72 before refresh. A pre-owned Revelation therefore composes with the authored Tutorial grant. | high |
| Equipment instructions and static catalog | effect dispatcher `0x00576AA0`; setter `0x00660580`; Website `native-equipment-effects-catalog.json` | Exactly 30 authored skill-effect rows exist: kinds 4/5/6/7/8 count `2/6/2/19/1`. Only the 21 kind-4/7 rows route a zero-rank set/grant through the Revelation-aware setter; nine add/class/all-learned rows do not. | high |
| Current web causal trace | Website `252ad560`; `applyPlayerEntityHagathaPurchaseEffects`, `applyNativeRevelationToConcentrations`, `applyPlayerSkillChoice`, `grantNativeWeirdCasterSkill`, `resolveNativeEquipmentEffects`, `preparePlayerEntityTutorialLoadout` | Purchase incorrectly sends selected concentration IDs to the two-row helper. Ordinary and Weird acquisitions already floor permanent rank. Tutorial and equipment one-rank grants do not consume Revelation ownership. | high |

Fresh static queries used canonical project `SolomonDark/SolomonDark.exe`
through the read-only replica wrapper from dirty, unmodified Mod Loader revision
`08bfba9ef367f7b863848030d0a289dc31e33192`. Wrapper SHA-256 is
`b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`.
The queried `decompile_targets.py`, `refs_to_addr_decompile.py`,
`find_offset_accesses.py`, `find_writes_to_offset.py`, and
`dump_insns_around.py` hashes are respectively
`899167ca42624e09f26d22233365631a6ee8b3d106e337e20b77574894e97465`,
`c6844b842ccd87aa70d290ae34553d874a8f90866eb234425f7c51fd8a438c4b`,
`b66a0ddd1dc1fe1304156189c14700b394b9e87f845dfa616541ebc769f93738`,
`500ace7391799ef3a93cc2c3b11828dde18c5eefd55c2f64694d29051b1538c4`,
and `79249e8ea5eb04115bb284f1bef9b90d81cd74f2c5301a747d08908a36032b40`.
No Mod Loader file was changed.

### System boundary and membership inventory

Native system: selector-6 Revelation's participant-owned minimum-rank rule,
from PerkShop apply/refresh through the two retained creation-starter IDs, every
permanent/effective rank writer, authored equipment rows, Tutorial override,
derived refresh, replication, persistence, removal, and generation teardown.

| Member / branch | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| selector-6 direct or bundle purchase | `0x0056C340 -> 0x0066EF70 -> 0x0065F9A0` | `exact-ported` by this reopening | accepted first acquisition floors only the two retained starter targets; rejection/removal/rebuy cannot add ranks above two |
| Ether: Magic Missile 8 + Call Leviathan 11 | `0x005D0290` case 0 | `exact-ported` by this reopening | both permanent/effective ranks become two |
| Fire: Fireball 16 + Ring of Fire 21 | `0x005D0290` case 1 | `exact-ported` by this reopening | reported pair both become two |
| Air: Lightning 24 + Magic Storm 27 | `0x005D0290` case 2 | `exact-ported` by this reopening | both become two |
| Water: Frost Jet 32 + Ring of Ice 35 | `0x005D0290` case 3 | `exact-ported` by this reopening | both become two |
| Earth: Boulder 40 + Raise Golem 45 | `0x005D0290` case 4 | `exact-ported` by this reopening | both become two |
| element/discipline roots 0..7 | separate `+0x82C/+0x830` fields and root rows | `out-of-system` — they are eligibility roots, not `+0x86C/+0x870` starter targets | remain rank one on purchase |
| pre-existing learned nonstarter rows | no loop in `0x0067C541..0x0067C645` | `verified-already-at-parity` | buying Revelation does not bulk-promote the old skill book |
| selected concentration A/B | separate Game/SettingsControl actions; no `0x0067C360` read | `exact-ported` by removal of the false web path | rank-one selected concentrations remain one at purchase; later acquisition still uses the common writer |
| normal and Creativity Insight choices | `0x00671470 -> 0x00660320` | `verified-already-at-parity` | a newly learned row starts at two; an Insight double increment remains two or higher and respects maximum |
| Weird Caster random secondary | `0x0067C360 -> 0x00660320` | `verified-already-at-parity` | selected unlearned category-2 row starts at two when selector 6 is already/in the same bundle |
| random Book/increment paths | `0x0056D1B0`, `0x005D5910`, `0x00689750` xrefs to `0x00660320` | `verified-already-at-parity` | only a learned row can be incremented; rank one naturally becomes two and no purchase-time sweep is introduced |
| Tutorial Acid Rain 72 | `0x005D5CF0 -> 0x00660320`, then `+0x870=72` | `exact-ported` by this reopening | a profile already owning Revelation receives Tutorial rank two; neutral Tutorial remains rank one |
| equipment kinds 5, 6, and 8: 6/2/1 authored rows | direct learned/class/all-learned add branches in `0x00576AA0` | `verified-already-at-parity` | they never call the set writer; learned rank-one additions already produce at least two |
| Website developer `sd.dev.grant_skill`/Weld grants | explicit account-bound Website extension in entry 202 | `out-of-system` — no retail entitlement or command exists | retains its requested exact bounded rank count and does not infer Hagatha semantics |
| save, protocol, portable import, Hall, run replacement | existing skill/economy owners | `verified-already-at-parity` | changed permanent/effective ranks and selector ownership already replicate and persist; no schema/protocol field is added |
| participant authority and peers | player entity/economy owner | `verified-already-at-parity` | one participant's purchase/equipment/Tutorial refresh never changes another book |
| Revelation removal and Game Over/new generation | requested removal extension; fresh `0x005D0290` equivalent | `verified-already-at-parity` | removal does not downgrade historical ranks; a new generation reconstructs rank-one starters until Revelation is acquired again |

Every authored equipment row routed through the Revelation-aware native setter
has an explicit disposition below. `kind` is the catalog effect number.

| Authored equipment effect row | kind / target / magnitude | Disposition | Proof contract |
| --- | --- | --- | --- |
| recipe 0 Pentaclostic Ring effect 0 | 7 / 11 / 1 | `exact-ported` | neutral 1, Revelation 2 |
| recipe 1 Arcanoric Robe effect 0 | 7 / 27 / 1 | `exact-ported` | neutral 1, Revelation 2 |
| recipe 1 Arcanoric Robe effect 1 | 7 / 28 / 1 | `exact-ported` | neutral 1, Revelation 2 |
| recipe 2 Cosmofluxic Wand effect 0 | 7 / 49 / 1 | `exact-ported` | neutral 1, Revelation 2 |
| recipe 2 Cosmofluxic Wand effect 1 | 7 / 51 / 1 | `exact-ported` | neutral 1, Revelation 2 |
| recipe 3 Theptoplasmar Amulet effect 0 | 7 / 21 / 1 | `exact-ported` | neutral 1, Revelation 2 |
| recipe 4 Synertauxic Ring effect 0 | 7 / 35 / 1 | `exact-ported` | neutral 1, Revelation 2 |
| recipe 5 Sublunarous Hat effect 0 | 7 / 45 / 1 | `exact-ported` | neutral 1, Revelation 2 |
| recipe 5 Sublunarous Hat effect 1 | 7 / 41 / 1 | `exact-ported` | neutral 1, Revelation 2 |
| recipe 13 Bug-Master's Wand effect 0 | 7 / 11 / 1 | `exact-ported` | neutral 1, Revelation 2 |
| recipe 15 Pan-Dimensional Strangler effect 0 | 4 / 11 / 1 | `exact-ported` | neutral 1, Revelation 2 |
| recipe 19 Storm Choker effect 0 | 7 / 27 / 1 | `exact-ported` | neutral 1, Revelation 2 |
| recipe 26 Clayshaper's Ring effect 0 | 7 / 45 / 1 | `exact-ported` | neutral 1, Revelation 2 |
| recipe 27 Claybaker's Ring effect 0 | 7 / 45 / 1 | `exact-ported` | neutral 1, Revelation 2 |
| recipe 28 Kiln effect 0 | 7 / 16 / 2 | `verified-already-at-parity` with composed coverage | already two; Revelation is idempotent |
| recipe 33 Absolox's Boomstick effect 0 | 7 / 16 / 2 | `verified-already-at-parity` with composed coverage | already two; Revelation is idempotent |
| recipe 33 Absolox's Boomstick effect 1 | 7 / 40 / 2 | `verified-already-at-parity` with composed coverage | already two; Revelation is idempotent |
| recipe 35 Ringwall effect 0 | 4 / 54 / 2 | `verified-already-at-parity` with composed coverage | already two; Revelation is idempotent |
| recipe 40 Yzmar's Handicap effect 0 | 7 / 64 / 1 | `exact-ported` | neutral 1, Revelation 2 |
| recipe 40 Yzmar's Handicap effect 1 | 7 / 56 / 1 | `exact-ported` | neutral 1, Revelation 2 |
| set 3 Tempest Kit effect 1 | 7 / 29 / 1 | `exact-ported` | neutral 1, Revelation 2 |

No member is blocked by the browser platform.

### Native ownership thread

- Owner and construction: `Skills_Wizard` owns the 0x70-byte rank rows and the
  retained creation IDs. `0x005D0290` derives all five pairs, increments them,
  and stores primary at `+0x86C` and secondary at `+0x870`. Current selection,
  concentrations, belt bindings, and Weld identity are separate owners.
- Upstream producers: PerkShop appends selector 6 and sets byte `+0x7D2` through
  `0x0066EF70`; accepted single and bundle purchases then invoke the common
  refresh. Normal choices, Tutorial/script/Book grants, Weird Caster, and
  equipment effects feed one of the two rank writers.
- State transitions: purchase refresh floors only the two retained IDs.
  `0x00660320` floors the permanent rank it increments; `0x00660580` floors the
  effective rank it sets for equipment kind 4/7. The floor is monotonic and
  idempotent: ranks above two are unchanged and removal never downgrades them.
- Downstream consumers: derived skill runtime, spell damage/mana/cooldowns,
  SkillScreen/HUD/quickbar, Weld caches, protocol snapshots, browser/native
  saves, Hall data, and peer presentation already consume the same ranks.
- Entry/reset/teardown: save/resume and ordinary run replacement retain the
  ranks. Tutorial temporarily writes skill 72 into the exceptional secondary
  field. Game Over/Create establishes a new pair at rank one and retains only
  durable profile ownership according to the existing generation boundary.

### Recovered behavioral contract

- On accepted Revelation acquisition, exactly the creation element's two
  starter rows become `max(currentPermanentRank, 2)` in both permanent and
  refreshed effective state. No current-primary, concentration, learned-order,
  category, or whole-book scan selects those targets.
- Subsequent permanent-rank acquisitions and the Tutorial grant go through
  `0x00660320`; a newly learned rank one is immediately two while any higher
  result is retained and bounded by its authored maximum.
- Equipment kind 4 and the unlearned branch of kind 7 go through `0x00660580`.
  Selector 6 floors their effective result to two for the lifetime of the
  equipment source. Unequipping reverts to permanent rank; no permanent grant
  or learned-order entry is invented.
- The setter clamps to the skill's authored maximum before applying the
  selector-6 floor. Dampen 51 therefore reaches effective rank two from the
  Cosmofluxic Wand even though its authored maximum is one. The web preserves
  that stock ordering rather than re-clamping Revelation away.
- Equipment kinds 5, 6, and 8 do not read Revelation. They add only to learned
  effective rows, so a rank-one row already reaches at least two through the
  authored magnitude. All 30 authored skill-effect rows are accounted for.
- Purchase, rank, equipment, Tutorial, replication, and persistence state are
  participant-owned. There is no timing, RNG, presentation, audio, collision,
  protocol, or browser approximation in this correction.

### Nearby-system findings

- `+0x82C/+0x830` retain the creation element and discipline roots;
  `+0x86C/+0x870` retain the creation primary and secondary/exceptional grant.
  The four fields are serialized together, which explains the misleading old
  `appearance_primary_*` labels but does not make them concentration actions.
- Tutorial `0x005D5CF0` overwrites `+0x870` with Acid Rain 72 after granting it.
  This is a real sibling of the same Revelation refresh, not a reason to infer
  the currently selected secondary or concentration in ordinary play.
- The equipment catalog contains 30 rank effects in the exact `2/6/2/19/1`
  kind distribution above. The 21 set/grant rows are the only equipment members
  requiring explicit Revelation ownership.

### Confidence and open questions

- Confirmed: retail/tool identity; all writers of the four retained fields;
  raw creation and floor instructions; every xref of both rank writers and the
  Revelation refresh; all five starter pairs; all 30 equipment rows; current
  web call graph; authority and lifecycle owners.
- Inferred: none required for implementation.
- Unknown: none material.

### Web implementation consequence

- Replace the concentration-named helper with one creation-config-owned starter
  helper. Derive the exact pair from the stored character element and call it
  only when selector 6 is newly accepted.
- Delete the purchase-time concentration read. Keep normal/Insight and Weird
  acquisition on the existing shared minimum-rank helper.
- Thread the participant's owned selectors into equipment rank resolution and
  apply the same minimum only to kind 4/7 set/grant branches. Keep modifiers,
  source ordering, permanent ranks, learned order, and neutral callers intact.
- Compose Tutorial skill 72 with the same minimum when a retained profile owns
  Revelation. No protocol/save schema or renderer change is required.

### Validation contract

- Focused progression coverage: all five exact starter pairs; rank-one to two;
  ranks already two/higher; nonstarter and selected-concentration negatives;
  ordinary, Insight, Weird Caster, and removal nonregressions.
- Equipment coverage: enumerate all 30 authored kind-4..8 rows; assert exact
  `2/6/2/19/1` membership; every one-rank kind-4/7 result becomes two only with
  selector 6; magnitude-two and kinds 5/6/8 remain unchanged; unequip restores
  permanent rank.
- Authority coverage: accepted Fire purchase changes 16/21, not selected
  concentration or another participant; bundle composition and Tutorial 72
  use the same rule; snapshot/save round trip retains the result.
- Complete Mac mini `/opt/homebrew/bin/bash ./scripts/validate.sh` against the
  exact candidate tree.
- Real Mac Chrome production-bundle journey: create a Fire wizard, buy
  Revelation, open the Skill Book, and prove Fireball/Ring of Fire both show
  level two. Focused authority coverage owns the nonstarter/concentration
  negatives; page, console, failed-response, WebGL, and wire-error arrays must
  be empty and the authoritative host must close cleanly.

### Implementation validation receipt

- Website authority now derives the purchase-time targets from the stored
  character element through `applyNativeRevelationToStartingSkills`; the false
  selected-concentration read is gone. The helper floors the exact five
  creation pairs in place, refreshes effective rank, preserves higher ranks,
  and runs only after an accepted selector-6 acquisition.
- The participant's owned Hagatha selectors now reach equipment resolution.
  Kind 4 and unlearned kind 7 use the native set-writer ordering: authored-max
  clamp first, Revelation floor second. Tutorial Acid Rain 72 uses the same
  selector-owned minimum. Kinds 5/6/8, permanent rank, learned order, source
  ordering, neutral callers, protocol, and save schema are unchanged.
- The Mac mini red run had 45 tests: 41 passed and the four missing contracts
  failed at the one-rank equipment grant, all starter pairs, accepted Fire
  purchase, and Tutorial Acid Rain. After implementation, the expanded focused
  progression/equipment/entity/runtime set passed 217/217 and
  `npx tsc -p tsconfig.test.json --noEmit` passed.
- After `origin/main` advanced during acceptance and publication preparation,
  the isolated candidate rebased cleanly through both non-overlapping changes
  to `8efce567d5fb88506580a78bdd181b1407c0e8fb`. The final exact-tree Mac mini
  `/opt/homebrew/bin/bash ./scripts/validate.sh` passed: backend build had zero
  warnings/errors; all 19 backend/contract tests,
  the 1,802-test main frontend suite, supplemental portal/cheat/HUD/weather/
  party/level-up/Tutorial/diagnostics/Hall/Hub UI suites, and 4/4 desktop tests
  passed. Formatting, lint, architecture, production build, and media policy
  gates passed. `Game-DTIQbzKb.js` measured 265,203 raw / 80,818 gzip bytes,
  below the 524,288 / 134,144-byte limits.
- Real Mac Chrome exercised the built production bundle and authoritative
  loopback host through Hagatha selector-6 purchase, then opened the rendered
  Skill Book. Its semantic receipt returned `Fireball, rank 2, assign to
  selected belt slot` and `Ring of Fire, rank 2, assign to selected belt slot`;
  visual inspection showed `FIREBALL 2` and `RING OF FIRE 2`. Browser/console
  errors, failed and aborted requests/responses, WebGL losses, and wire errors
  were empty. The websocket opened, the final Hub renderer was ready, and the
  focused harness disconnected Chrome before host shutdown, exited zero, and
  released both task ports.
  The receipt SHA-256 is
  `9910e2ee4f7ccdc2f9c8add1d284fa1f46db259094d9e43f2825d8012792b131`;
  the inspected 1600x900 frame hashes to
  `bffa38a6d7c2797ef6908e33a38bc778d74fd511f9352cb33ea64e1f7849b5f5`.
- Focused authority tests carry the negative proof: a pre-existing nonstarter,
  selected concentrations, another participant, rejection, removal/rebuy, and
  save/snapshot round trips are not incorrectly rewritten. All native members
  are accounted for, none is browser-blocked, and no material unknown remains.
  Publication is authorized by the follow-up request; deployment and production
  restart remain out of scope and were not performed.
## 2026-09-02 — Seeker's Charm moving-gradient and pulse correction

### Reported smell and parity question

- Reported web behavior: Seeker's Charm rays are flat, bright rectangular
  strokes. They do not grow faint toward the indicated object like retail.
- Stock behavior to recover: the complete owner-local Seeker painter, including
  target membership, distance branches, pulse range, endpoint colors, exact
  line tessellation, motion, painter state, and teardown.
- Reproduction inputs/scenes: a selector-5 local player in Boneyard with Gold,
  Sack, Bonus, and Orb actors; targets at, below, and above the 100/300-unit
  boundaries; a moving player and moving/retired targets; zero, one, and
  multiple eligible targets; a remote participant; run exit and view teardown.
- Falsifiers: a ray becomes fully opaque; RGB/alpha are constant along either
  segment; the gradient remains at an earlier world position after movement;
  an Orb or remote participant produces a ray; an endpoint is rounded/capped;
  or a retained gradient resource survives teardown.

This is a secondary report in a system that the 2026-08-23 pass declared
closed. That pass stopped at a four-segment diagnostic count and did not test
rendered pixel alpha, endpoint color, or movement after the first frame. It
also failed to inspect the raw double operands at `0x0052AA44` and
`0x0052AA53`; the earlier recorded `0.75 + 0.5*sin(...)` pulse is false and is
superseded below.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Player captures | `seeker's charm - web port.png`, 1107 by 619 RGBA, SHA-256 `4908e34b60d8b89fdc91fe4c7420b23d55e9434125ab864d039c2a64a5606fd3`; `seeker's charm - original.png`, 1005 by 659 RGBA, SHA-256 `e79bb6d5f3c0c8f713caba97f9d739b5dd422de223204658ab5a816785bafbbc`, both supplied in Windows Downloads | The web rays are solid gold bars. Nineteen samples across the upper-left ray's interior retain RGB within `206..216 / 185..195 / 137..145` despite changing scenery. Retail shows a soft ray whose outer half diminishes into the ground before the target. | high for the reported rendered difference |
| Retail identity | unmodified `SolomonDarkAbandonware/SolomonDark.exe` 0.72.5, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000`, re-hashed 2026-09-02 | Sealed native oracle used by the existing Hagatha ledger. | high |
| Player draw instructions | `Player/PlayerTarget::Draw 0x0052A640`, raw `0x0052A9C6..0x0052AC25` | Distance must be strictly above double `100`; it is capped at float `300`. Phase is `2 * globalTick + 35 * actorId`. The stored float alpha is `0.25 + 0.1 * sin(float(phase * pi / 180))`, so it remains about `0.15..0.35`. Two width-3 gradient lines cover radii `35 -> 50` and `50 -> 0.5 * cappedDistance`. | high |
| Endpoint-color instructions | color constructors `0x0040F9C0/0x0040F9E0`; calls at `0x0052AB44/0x0052AC25`; constants `0x00784D60=0.85f`, `0x00788BDC=0.73f`, `0x00788BE0=0.44f` | The inner line interpolates transparent white to pulsing gold; the outer line interpolates pulsing gold to transparent white. Native byte packing truncates the visible RGB to `216,186,112` (`0xD8BA70`), not the web's rounded red `217`. | high |
| Shared line primitive | color-multiplying wrapper `0x00455840`; quad builder `0x0041FB90` | The wrapper packs both endpoint colors independently. The builder uses a normalized perpendicular scaled by `width / 2`, emits start-minus/start-plus/end-minus/end-plus, duplicates the start color for the first pair and the end color for the second pair, then submits one four-vertex quad with butt ends. | high |
| Shared-helper xref sweep | all ten xrefs to `0x00455840`: `0x00459CAB`, `0x0052AB44`, `0x0052AC25`, `0x005A4F7D`, `0x005A5053`, `0x00611BC9`, `0x004588AB`, `0x0060F75E`, `0x0045ACF4`, `0x0045AD8D` | Seven callers consume the primitive: `Anim_WeatherRaindrop`, Player/PlayerTarget Seeker, HallOfFameBox, Hailstones, Anim_Line, Arrow/Silk, and Anim_FadeLine. Only Player's two calls consume selector 5, the Goodie list, and the Seeker clock. No hidden Seeker variant or table row exists. | high |
| Current web causal trace | Website `1cb1463b`; `native-hagatha-effects.ts`, `native-hagatha-seeker-view.ts`, and `smoke-hagatha-effects.mjs`; pinned PixiJS 8.19.0 `FillGradient.mjs` | The kernel uses the false `0.75/0.5` pulse. The view gives both gradient stops RGB `217,186,112`, mutates `FillGradient.start/end`, and increments `_tick`. Pixi's `buildLinearGradient()` returns immediately once `texture` exists, so its transform remains at the first submitted world endpoints; later moving strokes clamp to one edge texel and become flat. The browser smoke asserts only segment count. | high |

Fresh static queries used canonical program `SolomonDark/SolomonDark.exe` in a
read-only replica through Mod Loader revision
`08bfba9ef367f7b863848030d0a289dc31e33192`. Wrapper SHA-256 is
`b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`;
`decompile_targets.py`, `dump_function_instructions.py`,
`dump_insns_around.py`, `dump_floats_at.py`, and
`refs_to_addr_decompile.py` were used. The dirty Mod Loader checkout was not
changed.

### System boundary and membership inventory

Native system: Player/PlayerTarget's selector-5 owner-local Boneyard guidance,
from the participant's durable Hagatha flag and Arena Goodie membership through
fixed-tick planning, two-color line submission, post-main painter ordering, and
view teardown. The generic line primitive's independent callers are swept
below but do not share Seeker state or lifetime.

| Member / branch | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| local Player or PlayerTarget with selector 5 | local-player equality and `Skills+0x7D1` at `0x0052A8EC..0x0052A92E` | `exact-ported` | owner-local mesh and pulse contracts plus Mac pixels |
| local player without selector 5 | same gate | `verified-already-at-parity` | zero retained rays |
| remote participants | local-player equality gate | `verified-already-at-parity` | another participant's flag never creates a local view |
| Gold | Arena Goodie list consumed from Player's Region | `exact-ported` | one two-segment ray and browser profile |
| Sack | same Goodie list | `exact-ported` | one two-segment ray and browser profile |
| Bonus | same Goodie list | `exact-ported` | focused Goodie-family census |
| Orb and all non-Goodie actors | absent from the native list | `verified-already-at-parity` | equal-distance Orb remains excluded in browser and kernel tests |
| distance `<= 100` | strict compare at `0x0052A9C6` | `verified-already-at-parity` | no segment at exactly 100 |
| distance `(100,300)` | uncapped distance branch | `exact-ported` | `35 -> 50 -> distance/2` geometry assertions |
| distance `>= 300` | cap at `0x0052A9DB..0x0052A9F4` | `exact-ported` | `35 -> 50 -> 150` geometry assertions |
| inner transparent-white to gold segment | first `0x00455840` call | `exact-ported` | two-texel forward ramp and rising pixel samples |
| outer gold to transparent-white segment | second `0x00455840` call | `exact-ported` | reversed ramp and monotonically falling objectward samples |
| fixed-tick target phase | `2*tick + 35*actorId` | `exact-ported` | final float and truncated byte stay within `0.15..0.35` |
| stationary endpoints | shared quad builder | `exact-ported` | current-frame two-way fade measured on both axes |
| moving player or target | per-draw rebuilt quad | `exact-ported` | rotated targets retain the same measured fade without a cached transform |
| zero/one/many target add/remove order | Goodie list traversal | `exact-ported` | exactly two retained meshes per eligible actor and tail removal |
| Boneyard exit, charm removal, run replacement, and destroy | owner/view lifecycle | `exact-ported` | inactive updates remove meshes; destroy releases the one shared ramp source |

### Shared primitive xref dispositions

| Caller family | Relation to Seeker | Disposition for this reopening |
| --- | --- | --- |
| `Anim_WeatherRaindrop::Draw 0x00459B60` | same native quad helper, independent weather state and same-RGB alpha ramp | `verified-already-at-parity` under entries 111/148 through its retained unpremultiplied ramp texture |
| `Anim_Line::Draw 0x00458800` | generic authored endpoints/colors, no selector/Goodie/Player owner | `out-of-system` — independent animation instances retain their owning VFX contracts |
| `Anim_FadeLine::Draw 0x0045AC40` | generic two-line fading actor, no Seeker owner | `out-of-system` — independent animation instances retain their owning VFX contracts |
| `HallOfFameBox::Render 0x005A2C80` | two menu separator calls | `out-of-system` — fixed UI system with no Arena or Seeker lifecycle |
| `Arrow/Silk::Draw 0x0060F590` | projectile trail call | `out-of-system` — enemy-projectile state and renderer are owned by entries 098/273 |
| `Hailstones::Draw 0x00611160` | Weld rock/contact line call | `out-of-system` — Hail authority and presentation are owned by entries 123/268/279 |
| Player/PlayerTarget `0x0052A640` | both Seeker calls | `exact-ported` through the complete in-system inventory above |

No member is blocked by the browser platform.

### Native ownership thread and recovered behavioral contract

- `ActorProgression` selector 5 is durable participant state. The render branch
  additionally requires the drawn Player/PlayerTarget to be the active local
  player. It spends no gameplay RNG and writes no protocol state.
- Player draw traverses the Arena Goodie list in stable order. Gold, Sack, and
  Bonus are admitted by that list; Orb and enemy registries are not lateral
  target families.
- Distance is computed from current player and target positions every draw.
  Values at or below 100 submit nothing. Longer rays stop halfway toward a
  target, with the source distance capped at 300 before halving.
- Each eligible target owns two contiguous width-3 butt-ended quads. The first
  covers 35 to 50 units and fades transparent-white to gold. The second starts
  at the same gold midpoint and fades to transparent-white at half the capped
  target distance. Four independent endpoint vertices preserve the fade under
  translation, rotation, and length changes.
- The visible endpoint alpha is the final float result of
  `0.25 + 0.1*sin(float((2*tick + 35*actorId)*pi/180))`, then native color
  packing truncates each channel after multiplying by 255. The pulse is subtle
  and never reaches opacity one.
- Arena saturation `0.65` and selector-0 source-alpha blending consume the
  unpremultiplied interpolated RGB/alpha. A two-texel unpremultiplied ramp with
  transparent-white and opaque `0xD8BA70`, sampled between texel centers and
  multiplied by the packed pulse alpha, is algebraically identical to the
  retail per-vertex line under the existing Arena shader.
- The existing post-main Player painter position remains authoritative. Scene
  exit, charm removal, and target retirement remove the associated meshes;
  renderer destruction owns the single shared ramp texture and source.

### Nearby-system findings

- Pixi 8.19.0's `FillGradient._tick` invalidates a style key; it does not rebuild
  the cached texture transform after `start/end` mutation. No other Website
  renderer mutates those fields, so the falsified moving-gradient assumption is
  isolated to Seeker.
- The current Arena unpremultiplied texture/shader path already represents the
  native hidden RGB beneath alpha zero. Reusing that path avoids a custom
  shader and avoids changing the independently accepted global renderer.
- The prior browser screenshot was retained as a receipt despite asserting no
  pixel slope. Future visual acceptance must make the claimed property
  machine-measurable, not infer it from object counts.

### Confidence and open questions

- Confirmed: retail identity; exact double/float constants; threshold/cap;
  target phase; both endpoint-color orders; quad tessellation; width; all xrefs;
  local-player gate; current Pixi cache behavior; captured flat pixels.
- Inferred: none required for implementation.
- Unknown: none material. Browser raster coverage and background composition
  vary by camera/frame, so acceptance compares alpha/luminance ordering across
  the ray rather than demanding identical final screenshot bytes.

### Web implementation consequence

- Correct the fixed-tick alpha base/amplitude in the Hagatha effect kernel and
  pin the exact computed values in focused tests.
- Replace the mutable global `FillGradient`/`Graphics` strokes with retained
  four-vertex meshes matching `0x0041FB90`.
- Give all meshes one two-texel, linear, clamp-to-edge, unpremultiplied ramp:
  `[255,255,255,0] -> [216,186,112,255]`. Map each endpoint to its texel center
  and reverse the U coordinates for the outer segment. Quantize the per-mesh
  pulse to the same truncated alpha byte before Pixi packs it.
- Preserve target selection, segment planning, painter depth, participant
  authority, protocol, saves, and all other Hagatha effects. Remove the stale
  `FillGradient` resources completely.

### Validation contract

- Focused kernel coverage: exact pulse at multiple tick/actor phases, range
  `0.15..0.35`, strict 100 and cap-300 branches, all three target kinds, Orb
  exclusion, and two segments per eligible actor.
- Focused renderer contract: exact two ramp texels, texel-center forward/reverse
  UVs, native perpendicular quad vertices for horizontal/vertical/diagonal
  segments, truncated alpha byte, shared texture ownership, and no
  `FillGradient` dependency.
- Existing Hagatha authority/effect suites remain green for every selector and
  two-participant isolation.
- Real Mac Chrome/WebGL2 production journey: render Gold and Sack with an
  equidistant Orb, sample both rays on a controlled background, translate and
  rotate their target endpoints after the first rendered frame, and prove the current
  inner rise/outer fall remains measurable. Retire targets, remove the charm,
  close the renderer, and prove no stale meshes or WebGL resources. Page, console,
  failed-response, WebGL, wire, and host-error arrays must remain empty.
- Run `/opt/homebrew/bin/bash ./scripts/validate.sh` on the exact byte-identical
  candidate tree on the Mac mini.

### Implementation validation receipt

- `native-hagatha-effects.ts` now owns the corrected `100/300/35/50/0.5/3`
  geometry program, final-float `0.25 + 0.1*sin(...)` pulse, truncated
  `0xD8BA70` visible color, transparent-white endpoint, and exact perpendicular
  quad plan. Focused tests pin every Goodie kind, the strict cutoff, capped and
  uncapped lengths, both ramp directions, horizontal/vertical geometry, and
  alpha-byte truncation.
- `NativeHagathaSeekerView` no longer creates or mutates `FillGradient` or
  `Graphics` strokes. It retains one two-texel `rgba8unorm`, linear,
  clamp-to-edge, no-premultiply texture and one four-vertex `MeshSimple` per
  native segment. Vertices and packed pulse alpha update in place; add/remove,
  inactive-scene, and destroy paths own all meshes and the shared texture.
- The Hagatha browser harness now has an explicit Seeker pixel/lifecycle path,
  follows current Tutorial and first-College admission, waits for actual
  replicated loot births instead of sleeping, and supplies the current death-
  weapon painter registration to its retained Last Word half. Both
  `--seeker-only` and the complete Seeker/Last Word journey exit cleanly.
- On the Mac mini, focused Hagatha coverage passed `12/12`; TypeScript and the
  production Vite/game-host build passed; frontend lint reported zero errors
  and the same eleven pre-existing warnings. The complete
  `/opt/homebrew/bin/bash ./scripts/validate.sh` gate on the final
  `f03d1d3a2cb9b5643476b32fa807f0c426822566`-based candidate exited zero:
  backend build/19 contracts, formatting, architecture, all configured frontend
  suites, desktop `4/4`, production build, bundle budget, and media policy all
  passed. `Game-BMOn24k2.js` measured 265,203 raw / 80,823 gzip bytes, below
  the 524,288 / 134,144-byte limits.
- Real Mac Chrome/WebGL2 served the built production bundle at `1600x900` and
  rendered four meshes for Gold and Sack while the equidistant Orb remained
  excluded. On the initial right/down rays,
  luma samples at world radii `38/47/55/75/95` were respectively
  `17/35/34/23/7` and `13/27/27/20/11`. After rotating the same targets to
  up/left, they were `12/26/27/18/6` and `12/26/27/21/12`. Thus each inner
  segment rises into the 50-unit join and each outer segment fades toward the
  object side after motion. Per-target mesh alpha remained in the native packed
  range (`0.1529..0.1922` in the captured frames), and removing/re-adding the
  charm changed retained mesh count exactly `4 -> 0 -> 4`.
- The complete browser journey also retained Last Word's Mindblast siblings and
  archive behavior. Page errors, console errors, failed responses, WebGL/wire
  errors, and host errors were empty. The inspected initial/moved Seeker frames
  hash to `43b9fed5dc00eb3b62197df94bd0c7cfb8242e15a8dfbf7a97922c4ae8d74d6c`
  and `13e650b928ca05a821cbbac0e8e21b346657e58c226c0e59be74eaa4ce9e33ca`.
- Every in-system member has a final disposition, no member is browser-blocked,
  and no material unknown remains. The local task worktree and Mac acceptance
  worktree remain focused and retained because publication was not requested.
  One local focused commit records the validated tree; no push, deployment, or
  production restart is claimed by this receipt.

## 2026-09-02 — participant-scoped Hagatha effect ownership correction

### Reported smell and parity question

- Reported web behavior: one player's charms affect the whole party instead of
  only the player who owns them.
- Stock behavior to preserve: Hagatha flags and retained one-shot fields belong
  to one participant's `ActorProgression`; no party union or first-member proxy
  may stand in for that owner.
- Reproduction inputs/scenes: two participants with disjoint charm sets; Hub
  purchase/removal; derived stats; skill and equipment refresh; incoming and
  outgoing combat; an enemy killed by the second participant; a Goodie opened
  by the second participant; pickup contention; death, save/rejoin, and exit.
- Falsifiers: changing the first party member's selectors changes a second
  member's derived state, cast, damage, reward roll, or opened Goodie; changing
  party insertion order changes an attributed reward; or a missing/disconnected
  owner silently inherits another participant's modifiers.

This is a secondary report in the Hagatha system. The 2026-08-23 pass proved
participant-owned flags and tested purchase-state isolation, but its membership
sweep stopped before the two world-level loot consumers. Those consumers
continued to select `Object.keys(nextPlayers)[0]` or `participants[0]`, so the
first party member's Item, Gold, Scatter, and Arcane Attractor modifiers could
govern another participant's enemy reward, and the first member's Gold Charm
could govern a Goodie opened by a peer. This reopening removes that proxy owner
and re-audits every selector.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Owner report | 2026-09-02 request | Charm consequences must remain with the player who owns the charm, not the party. | high for required Website behavior |
| Existing retail instructions | sealed retail 0.72.5 image SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; apply `0x0066EF70`; refresh `0x0067C360`; complete consumer census above | Selector flags, capacity, and retained one-shot lanes live on one participant's `ActorProgression`; the prior ledger already rejects owner state leaking to a peer. | high |
| Current web enemy-reward trace | Website `a2b19c2f`; `boneyard-enemy-store.ts` terminal reward plus `boneyard-world.ts` reward materialization | Terminal rewards retain `lastDamagedByPlayerId`, but materialization discards it and feeds every reward the first enumerated participant's level, unlocks, inventory context, recipes, and `NativeLootModifiers`. | high |
| Current web Goodie trace | Website `a2b19c2f`; `interactWithBoneyardGoodie`, `activateBoneyardGoodie`, `stepBoneyardLootStore`, `stepGoodies` | Key consumption knows the opener, but activation stores no player identity; delayed materialization always consumes `context.participants[0]`. | high |
| Complete web consumer sweep | `nativeHagathaDerivedModifiers`, `player-entity-store.ts`, `game-simulation.ts`, `player-staff-combat-system.ts`, `native-hagatha-seeker-view.ts`, `native-loot.ts` | All non-loot effect paths already resolve an explicit player index/ID or local-player snapshot. Only enemy reward selection and delayed Goodie Gold materialization use a first-party-member proxy. | high |

No new injected-runtime evidence is used. The retail image and instruction
addresses are inherited from the byte-identified system evidence above; this
reopening corrects the web multiplayer owner that consumes those facts.

### System boundary and membership inventory

Native system: participant-scoped Hagatha ownership from purchase and retained
runtime through every derived, combat, progression, loot, presentation,
persistence, replication, and teardown consumer. Shared world consequences may
still be visible or contestable, but the modifier that creates them must come
from the actor who owns the charm.

| Selector/member | Ownership disposition | Decisive proof |
| ---: | --- | --- |
| 0 Life | `verified-already-at-parity` | maximum health derives from the addressed participant economy only |
| 1 Mana | `verified-already-at-parity` | maximum mana derives from the addressed participant economy only |
| 2 Speed | `verified-already-at-parity` | movement/cast factors are projected by player ID |
| 3 Item | `exact-ported` by this reopening | enemy Item chance consumes the attributed killer's modifier, never party slot zero |
| 4 Gold | `exact-ported` by this reopening | enemy Gold chance/amount use the attributed killer; delayed Goodie Gold uses the opener latched at activation |
| 5 Seeker's | `verified-already-at-parity` | renderer requires the local player snapshot and that player's selector 5 |
| 6 Revelation | `verified-already-at-parity` | purchase/rank/equipment writers mutate only the addressed player entity |
| 7 Cheat Death | `verified-already-at-parity` | charge and lethal recovery live in the damaged participant progression |
| 8 Perky | `out-of-system` — retail and web offer builders exclude the dormant row | no player or party can acquire it |
| 9 Scatter | `exact-ported` by this reopening | enemy Orb chance/value consume the attributed killer's modifier |
| 10 War | `verified-already-at-parity` | offensive mana derives from the caster's economy/runtime |
| 11 Curing | `verified-already-at-parity` | poison factor derives from the damaged participant |
| 12 Last Word | `verified-already-at-parity` | death milestones and Mindblast/archive source are keyed by dead owner ID |
| 13 Spellwelder's | `verified-already-at-parity` | Weld cache refresh uses the owning skill book and economy index |
| 14 Weird Caster | `verified-already-at-parity` | grant RNG, skill book, and offer bias mutate only the purchaser |
| 15 Drinker's | `verified-already-at-parity` | HP/MP predicates and potion removal use the addressed participant inventory |
| 16 Glass Cannon | `verified-already-at-parity` | outgoing source and incoming target resolve their own derived factors |
| 17 Sorceror's | `verified-already-at-parity` | reroll/defer availability is checked at the offer owner's index |
| 18 Focus | `verified-already-at-parity` | secondary recharge derives from the casting participant |
| 19 Disfiguring | `verified-already-at-parity` | third-ring admission uses the addressed participant economy |
| 20 Bare Hands | `verified-already-at-parity` | weapon state and spell factors come from the casting participant |
| 21 Split Mind | `verified-already-at-parity` | concentration B is admitted and saved per participant |
| 22 Curse Bosses | `verified-already-at-parity` | primary, secondary, Staff, and Last Word damage look up the source owner ID |
| 23 Arcane Attractor | `exact-ported` by this reopening | enemy Powerup chance consumes the attributed killer's modifier |
| 24 Serendipity | `verified-already-at-parity` | armed/cleared state and outgoing factor live in one progression |
| 25 Reverie | `verified-already-at-parity` | armed/cleared state and mana debit live in one progression |
| 26 Brute's | `verified-already-at-parity` | melee and push factors resolve the acting player's owner ID |
| 27 Tonic | `verified-already-at-parity` | capacity changes only the purchaser's ordered outcome vector |

No member is blocked by the browser platform.

### Native ownership thread and recovered behavioral contract

- `ActorProgression` remains the sole charm owner. Purchases, runtime flags,
  skill books, equipment, vitals, input cadence, combat, snapshots, and saves
  are already indexed by authenticated `playerId`.
- A hostile's lethal path retains `lastDamagedByPlayerId` in its terminal
  reward. Enemy loot selection must resolve the complete participant context
  from that ID. The first party entry is ordering, not ownership.
- Goodie key consumption already has an authenticated opener. Activation must
  latch that ID across the 100/200/250-tick presentation and resolve the same
  participant at materialization. If that participant no longer exists, the
  Goodie uses neutral defaults; it never borrows a peer's charm state.
- `NativeLootModifiers` stays one indivisible participant value. Item, Gold,
  Scatter, Arcane Attractor, equipment attraction, level/unlocks, inventory
  health-potion context, and owned recipes must all come from the same reward
  owner so no hybrid party context is constructed.
- Ground actors remain shared authoritative world objects and retain native
  first-valid pickup contention. A peer collecting an existing drop is not a
  charm grant; the drop's selection and amount were already fixed by the
  attributed killer or Goodie opener.
- Disconnect, owner removal, run exit, and Goodie exhaustion clear or neutralize
  delayed ownership. No client-visible protocol field or replicated charm union
  is added.

### Nearby-system findings

- The first-participant proxy also selected non-Hagatha loot inputs (level,
  advanced unlocks, inventory health-potion presence, owned recipes). Routing
  the complete context through one attributed owner prevents those fields from
  disagreeing with the corrected charm owner.
- Loot attraction during ground-actor updates already evaluates each candidate
  participant's own modifiers. It is not part of the leak and remains unchanged.
- Last Word and Curse Bosses can affect shared enemies or ground actors, just as
  an ordinary player attack can; their initiating state remains owner-local and
  is not copied to peers.

### Confidence and open questions

- Confirmed: prior retail participant ownership; complete selector membership;
  terminal killer attribution; Goodie opener authority; both first-participant
  proxy call sites; all other web consumers and lifecycle boundaries.
- Inferred: none required for the Website correction. Attributed killer and
  authenticated opener are the only existing actor identities at the two
  delayed world seams.
- Unknown: none material.

### Web implementation consequence

- Replace enemy reward `authorityCombat` with the participant context selected
  by `reward.playerId`; null or absent attribution receives neutral loot input.
- Add an activation-owner field to server-side Goodie state, set it from the
  authenticated interaction, consume it at tick 250, and clear it on
  exhaustion. Keep it out of the client snapshot because it owns no pixels or
  input after activation.
- Preserve the shared RNG stream, candidate tables, drop actors, pickup order,
  protocol DTO, and every non-loot charm consumer.

### Validation contract

- Focused enemy-reward regression: with a charmed first participant and an
  uncharmed second-participant killer, output equals the uncharmed baseline;
  moving the same charm to the killer changes only that attributed reward.
- Focused Goodie regression: changing a non-opener's Gold Charm cannot alter
  delayed Gold; changing the opener's charm does, regardless of participant
  insertion order. Missing opener lookup uses neutral modifiers.
- Existing per-selector Hagatha kernel/entity/combat/save/renderer suites stay
  green, including two-participant purchase/runtime isolation and all four loot
  modifier fields.
- Complete Mac mini `/opt/homebrew/bin/bash ./scripts/validate.sh` on the exact
  candidate tree.
- Real two-client Mac Chrome journey: give only one client Gold Charm, prove
  the other client's attributed enemy reward and opened Goodie stay neutral,
  then prove the owner's equivalent paths receive the modifier. Both clients'
  snapshots must retain disjoint selector lists and derived stats, with empty
  page/console/failed-response/WebGL/wire/host-error arrays.

### Implementation validation receipt

- Enemy terminal reward materialization now selects the complete loot context
  through `reward.playerId`. Null, unknown, or disconnected attribution uses
  neutral defaults instead of the first party entry. The same selected context
  supplies all four Hagatha loot fields plus level, unlocks, inventory Potion
  state, and recipes, so a hybrid party reward cannot be constructed.
- `BoneyardGoodieState` now latches `activatedByPlayerId` when the authenticated
  key interaction succeeds. The 100/200/250-tick sequence retains that owner,
  tick 250 resolves only the matching participant, and exhaustion clears the
  field. A missing owner is neutral. Client Goodie snapshots, shared RNG,
  painter order, and first-valid ground pickup remain unchanged.
- The Mac red run proved both defects before implementation: a Gold Charm on
  party slot zero changed a second player's attributed enemy reward from six to
  seven Gold, and changed peer-opened Goodie Gold from 800 to 1,000. After the
  correction, the expanded 91-test focused loot/simulation run passes. Its
  enemy matrix covers Item selector 3, Gold 4, Scatter 9, and Arcane Attractor
  23 with neutral/charmed owner, charmed peer, and missing-owner branches. The
  Goodie matrix covers opener, non-opener, insertion order, missing owner,
  owner retention, and exhaustion cleanup. Test TypeScript and focused lint
  both pass with zero errors.
- The candidate was rebased onto Website `de814b462d5609e90fbf571f2ade7b373e9241b1`
  and materialized byte-for-byte in a clean Mac worktree. The complete
  `/opt/homebrew/bin/bash ./scripts/validate.sh` gate passed: backend build with
  zero warnings/errors, 19 backend/integration contracts, backend formatting,
  frontend lint/architecture/generated-content checks, every configured
  frontend suite, desktop tests, production frontend/game-host builds, bundle
  budget, and media policy. Lint retained the repository's 11 pre-existing
  warnings and introduced no error. `Game-CGrgqk2q.js` measured 265,203 raw /
  80,820 gzip bytes under the 524,288 / 134,144 limits.
- Real Mac Chrome ran the production bundle with two independent browser
  contexts and the authoritative host. With Life Charm only on player one,
  maximum health was `62.5` for its owner and `50` for player two. With Gold
  Charm only on player one, player two's attributed kill remained six Gold and
  player-two-opened Goodie remained 800; moving the charm to player two changed
  only those owner paths to seven and 1,000. Both canvases reported
  `WebGL2RenderingContext`, two players, and the same 65 final ground actors.
  Page errors, console errors, failed requests/responses, and surfaced runtime
  errors were empty.
- All 28 selector rows have a final disposition above. No browser-specific
  approximation, protocol field, save-schema change, or material unknown
  remains. Commit is local and focused; push, deployment, and production
  restart were not requested or performed.
