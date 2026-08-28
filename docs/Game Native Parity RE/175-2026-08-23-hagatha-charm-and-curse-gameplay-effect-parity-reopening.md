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
| 26 Brute's | melee damage `*= 3`; actor push strength `*= 2` | missing | Staff contact and Hub/Boneyard collision |
| 27 Tonic | capacity `+3`, maximum 9, exactly two purchases | verified working | `3 -> 6 -> 9`, third rejection |

No member is blocked by the browser platform.

## Native ownership thread

- Owner and construction: profile/PerkShop chooses selectors; participant
  `ActorProgression` owns flags `+0x7CC+selector`, selector array/count
  `+0x7C0/+0x7C4`, capacity `+0x800`, Cheat Death charges `+0x820`, and
  Serendipity/Reverie active bytes `+0x73C/+0x73D`.
- Upstream producers: `0x0066EF70` rejects duplicate non-Tonics, appends the
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
  strength into both Hub and Boneyard actor physics. Apply incoming Glass before
  defenses and clear until-hurt state after defenses.
- Reuse the existing Mindblast actors, renderer, lighting, and audio for Last
  Word with recovered overrides. Add an owner-local retained Seeker view; do
  not replicate visual phase or spend gameplay RNG.
- Remove the current unconditional Weld recomputation path by consuming the
  frozen component snapshot unless Spellwelder refreshes it.

## Validation contract

- One table-driven contract row per selector 0..27, plus bundle composition,
  Tonics, and Perky exclusion.
- Derived matrix: neutral/charmed/composed factors; armed/unarmed Bare Hands;
  spell versus melee Glass/Serendipity/Brute; Hub/Boneyard push contacts.
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
| 22 Curse Bosses | verified implemented | IDs 1008..1011 are tripled at primary, secondary, Staff, and Last Word damage seams; nonbosses remain one |
| 23 Arcane Attractor | verified retained | seeded magical-upgrade bound |
| 24 Serendipity | verified implemented | accepted purchase arms triple spell damage; zero/shielded damage preserves it and positive remaining damage clears it |
| 25 Reverie | verified implemented | accepted purchase arms free offensive casts and shares the same defended hurt edge |
| 26 Brute's | verified implemented | Staff damage consumes factor three and Staff/primary/secondary pushes consume factor two |
| 27 Tonic | verified retained | exact `3 -> 6 -> 9` capacity and third-purchase rejection |

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
