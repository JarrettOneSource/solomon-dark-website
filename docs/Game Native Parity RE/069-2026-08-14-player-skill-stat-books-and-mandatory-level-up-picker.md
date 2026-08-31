# 2026-08-14 — Player skill/stat books and mandatory level-up picker

## Reported smell and parity question

- The rebuilt runtime currently owns players as whole
  `PlayerCharacterState` records. It has no player-owned progression object,
  permanent/effective rank book, stat metadata book, experience curve, or
  level-up choice state. The HUD paints a constant `45%` XP fill and no stock
  path can open the level-up picker.
- The requested slice is bookkeeping-first: give every player independent
  skill and stat books, move player ownership to an ECS, and reproduce the
  stock picker. Learned skills remain deliberately inert until their runtime
  effects are implemented.
- The parity questions were whether rank/stat data is shared or actor-owned,
  which state survives world transitions, how creation seeds a new book, who
  owns offer randomness and application, whether the picker can be skipped,
  and which exact art/font records compose its stable frame.

## Evidence and provenance

| Clean stock | `Mod Loader/tests/fixtures/webgame/menu-reference-captures/skill-picker.png`; captured `2026-08-09T13:54:14.9453312Z` from pristine profile state | Settled 1600x900 picker over a dim live Hub, with three ordered cards, mandatory `SELECT A SKILL`, native HUD beneath, and animated cyan circle/corner families | high-live |
| Capture contract | `Mod Loader/tests/fixtures/webgame/menu-layouts/skill-picker.json`, schema `solomon-dark-native-menu-layout-v3` | Exact structural draw order, card rectangles, icon anchors, repeated-icon offset, ambient membership, and capture provenance | high-live |
| Instructions | preferred-base VAs `0x006594E0`, `0x00658620`, `0x0065F480`, `0x0066F920`, `0x00671470`, `0x0067C250`, `0x0067CB70`; retail image base `0x00400000` | Per-actor progression construction, screen creation/build, choice apply, level-up, and two-stream offer construction | high |
| Picker renderer | `LevelupScreen` render `0x0067DF80`; shared `UiPanel_Render` `0x005C3F40`; read-only Ghidra project for the same retail executable | Settled panel rectangle, stock background/card nine-slices, border/corner records, ambient transforms, heading positions, and exact level-line font wrapper | high |
| Runtime/data | `Mod Loader/tests/fixtures/webgame/progression-goldens.json`; `Mod Loader/docs/reverse-engineering/native-skill-catalog.json` | Independent player/bot books and seeds; exact three-level seed-79225 offers; 82 public skill entries and their exact CFG-backed caps/descriptions/properties | high-live |
| Asset | retail `images/UI.png/.bundle`, `Skills.png/.bundle`, `Fonts.png/.bundle`; executable SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` | Picker uses shipped atlases and compiled bitmap-font wrappers, not substitute CSS art or an operating-system face | high |

No new injected process or debugger address is used by this entry. Function
addresses above are preferred-image virtual addresses. The clean capture is
sealed to base commit `405bb0f697fcdf484f304f0d5f38224d39a6ae70`, source tree
`b6aaa8f1f9752963b570384a29a6082228c2cbfa`, and loader DLL SHA-256
`f9c3357ddce217c4f6b0c13ad2511ec4cfcbf909974c335c865f21dfae53d289`.

## Native ownership thread

- Every player and bot owns a progression pointer at actor `+0x200` and a
  participant-facing handle at actor `+0x300`. The pointed object owns the
  level/XP tuple, HP/MP, selected roots, rank-table pointer/count, pending local
  picks, and actor-private offer seed. It is not a process-global spellbook.
- The rank table pointer/count is progression `+0x20/+0x24`. Retail allocates
  `83` rows of stride `0x70`; public skill IDs occupy `0..81`, while the final
  row is internal/reserved and must remain allocated but unavailable.
- A row stores internal/root ID at `+0x1C`, permanent rank at `+0x20`,
  effective rank at `+0x22`, category at `+0x26`, cooldown current/cap at
  `+0x64/+0x68`, and a `StatBook*` at `+0x6C`. Stat metadata owns the maximum
  rank at `+0x5C`, name at `+0x1C`, and numeric-property list at `+0x64`.
  Mutable ranks and immutable catalog/stat data are distinct native objects.
- Creation registers all eight root rows in native order
  `0,2,1,3,4,6,5,7`, but grants rank one only to the selected element and
  discipline roots, followed by the selected element's primary and secondary.
  Element mappings are Ether `0/8/11`, Fire `1/16/21`, Air
  `2/24/27`, Water `3/32/35`, and Earth `4/40/45`; discipline roots are Body
  `5`, Mind `6`, and Arcane `7`.
- `0x0067C250` advances each crossed XP threshold, refills that actor's HP/MP,
  and increments pending local picks. `0x0065F480` materializes the screen;
  `0x0066F920` asks that same progression for its ordered offer;
  `0x00671470` decrements pending state and applies the chosen permanent rank;
  refresh copies permanent ranks to effective ranks before rebuilding derived
  state.
- The participant/profile progression survives Hub-region and
  Hub-to-Boneyard transitions. Picker screen/focus objects are presentation
  transients; the ordered pending offer, learned permanent ranks, and the
  actor-private seed are authoritative progression state.

## Recovered behavioral contract

### Level and book state

- A fresh player begins at level `1`, cumulative XP `0`, previous threshold
  `0`, next threshold `90`, base/current/max HP `50`, and base/current/max MP
  `100`.
- The 76-entry cumulative threshold table ends at level `75`: entering level
  75 requires `8,500,000` XP and the threshold to leave it is `10,000,000`.
  Stock reads beyond the table after that point. The browser compatibility
  rule is the already-recorded safe clamp at level 75/10,000,000, with no
  further offers.
- One large XP award consumes every crossed threshold and queues one mandatory
  choice per crossed level. Normal play stays paused for the owner while any
  local choice remains. The ordinary picker has no unconditional skip or
  reroll; owned Sorceror's Charm selector 17 adds the native one-use ROLL AGAIN
  or SAVE SKILL sibling actions documented by the 2026-08-16 superseding
  entry below.
- Applying a choice increments only the addressed player's permanent row,
  refreshes that player's effective row, and consumes one pending choice.
  This bookkeeping slice intentionally does not execute the skill's passive,
  cast, projectile, status, stat-refresh, or concentration effect.

### Offer ownership and order

- Construction stores one actor-private seed at progression `+0x834`. Every
  offer call creates a fresh 55-word lagged-additive RNG from that seed and the
  builder does not mutate it. Superseding 2026-08-27 evidence proves that every
  actual acquisition rewrites `+0x834` through `0x00660320` before the next
  offer; only a replay with no intervening acquisition keeps the same seed.
  Welding build identity and final order additionally require the same incoming
  active-gameplay-RNG state.
- Construction sets the Spell Welding schedule marker `+0x840` to `9999` and
  offer cycle `+0x848` to zero. The level-up screen increments the cycle before
  every builder call. Refresh changes the sentinel marker to the current cycle
  as soon as an unlearned row 52 has two learned elemental primaries and passes
  its other gates. Welding is then injected on the next cycle, or every fifth
  cycle if it was offered but not selected. Applying it books row 52 at rank
  one and persists the exact synthetic build `1000..1009`; it is not an
  ordinary repeatable rank.
- The ordinary scan is IDs `8..81`, skips Spell Welding `52`, rejects runtime
  IDs `80/81`, enforces native level/root/category/dependency/cap/unlock gates,
  and applies the recovered focus, weighting, full-range swap, pruning,
  with-replacement fill, and final-shuffle sequence. Spell Welding has its
  separate learned-primary injection gate.
- Fill has two distinct collision rules. Vtable `+0x30 -> 0x0067BFA0`
  identifies category 4 and never permits a second category-4 row. A separate
  category-byte comparison retries a second category-1 row for the first 50
  such collisions, then permits it so the outer 200-attempt loop can finish.
  The selected-result container independently suppresses every repeated skill
  ID. Category-0/2/3 rows may repeat as candidate-pool weights but never as
  displayed cards.
- Choice count is three, or four when Creativity `63` is learned. Creativity's
  concentrated Insight roll is a later gameplay-RNG branch; concentration is
  not part of this bookkeeping slice and therefore must not be synthesized.
- The seed-`79225` machine golden produced level-2/3/4 pools `48,49,57`,
  `65,49,9`, and `49,56,9` on a loader-created Ether/Arcane bot with the custom
  `8/8` primary pair and secondary loadout `15,48`. Its recorder captured only
  five unrelated rank rows, not the bot's complete pre-offer book, and its
  source tree was dirty. It is therefore a high-live ownership/RNG witness but
  is not a valid expected sequence for the Website's stock fresh-player book.
  The browser test instead pins the fresh book assembled from the recovered
  creation contract and the statically recovered `0x0067CB70` control flow.
- The client submits the displayed offer identity and chosen skill ID. The host
  validates both against that player's current authoritative offer before
  mutating the book; another participant's offer cannot be selected.

### Picker composition and input

- The picker is a modal Pixi/WebGL presentation above the current gameplay
  scene. It dims but does not replace the live world/HUD frame.
- `0x0067DF80` centers an option-count-dependent panel of
  `count * 200 + 60` by `355`. For three choices its settled bounds are
  `(470,272.5,660,355)`. It clips a `5 x 2` draw of `UI.49` to that rectangle,
  then calls `UiPanel_Render` once. That shared renderer repeats `UI.10`
  horizontally and `UI.79` vertically and draws `UI.107..110` at the four
  corners. Omitting this panel is not an ambient-phase approximation.
- Each option owns a `200 x 295` `Skills.0` nine-slice beginning at
  `(500 + index * 200,302.5)` in the three-choice layout. The stable icon art
  is drawn above those card panels in this order per frame center
  `600/800/1000`: `Skills.13`, `Skills.164`, `Skills.5`; exact outer
  rectangles are `[556.5,338.5,643.5,426.5]`,
  `[756.5,338.5,843.5,426.5]`, and
  `[956.5,338.5,1043.5,426.5]`.
- Each chosen skill icon is drawn twice at anchors `(604,386.5)`,
  `(804,386.5)`, `(1004,386.5)`, with the second copy offset `(-4,-4)`.
- The eight `UI.3` arc members share center `(800,450)`, scale `1.9`, and
  rotations separated by 45 degrees. The two `UI.62` rings use scale `1.6`,
  centers `(800,350)` and `(800,550)`, and the same half-rate rotation.
  Capture-first rectangles for `UI.37` and `UI.59` are
  `[593.5,174.5,1006.5,249.5]` and `[594,627.5,1006,687.5]`; the four
  animated corner rectangles remain within the fixture envelopes around the
  panel, not the screen edges.
- Picker-owned art therefore comes from
  `UI.3,10,37,49,56,57,59,62,79,107,108,109,110` and
  `Skills.0,5,13,164` plus the dynamic icon rows. The underlying HUD remains
  visible and contributes the
  captured `UI.42,47,48,51,82,100` and `Skills.43,48` rows; those records are
  not duplicate picker-owned HUD state.
- `UI.37` is the exact `LEVEL UP` raster and `UI.59` is the exact
  `SELECT A SKILL` raster. The level line is the exact spaced string
  `Y O U   A R E   N O W   L E V E L   %d`, drawn by the menu/dialog wrapper
  `Fonts.216-307` (`+0x0E7D98`); this wrapper includes digits. Card text uses
  the compiled medium `Fonts.93-184` and uppercase-only `Fonts.350-375`
  wrappers according to the native card branch. No OS-font substitution is
  authorized.
- Pointer selection uses the card bounds. Designed controller/keyboard focus
  is left-to-right, wraps on previous/next, starts at the first offer, confirms
  the focused offer, and ignores Back because the picker is mandatory. The
  focus policy is explicitly designed rather than falsely labeled a captured
  stock keyboard traversal. Hover/focus movement is silent.
- Confirmation uses the existing native `pickskill.wav` cue and first sends a
  stopped gameplay input so a held movement/cast cannot leak through the modal
  boundary.

## Nearby-system findings

| Lane | Finding | Consequence |
| --- | --- | --- |
| ECS | Player identity, config, locomotion, primary cast, progression, skill book, and stat book have different lifetimes and mutation rates | use separate dense component stores; whole-player records become transient system/protocol projections |
| World transition | Position/heading are respawned for a Boneyard, but progression is not | world placement updates only locomotion components |
| Multiplayer | Native packets revision-gate each participant's independent book and offer | protocol exposes owner-local progression snapshots and validates owner/offer identity |
| HUD | Existing web XP is a constant and secondary spell art is not proof of a learned/effected skill | drive XP fill from progression; do not mark combat effects implemented |
| Assets | Three whole stock atlases are only about 1.6 MiB and preserve exact sprite/font metadata | load source atlases once and create subtextures, including the panel/card nine-slices and both chain directions; do not export 100+ hand-cropped approximations |
| Audio | picker open/close, card activation, queued rebuild, reroll, and save have separate recovered dispatches | use `openpanel`, `pickskill`, `unlockskill`, pitch-0.8 `summon`, and `click` only at their native lifecycle edges; hover/focus is silent |

The reusable native ownership and picker-art summary is also recorded in
`Mod Loader/docs/reverse-engineering/native-progression-and-skills.md`; the
machine-readable skill catalog remains owned by that report and is copied
byte-for-byte into the Website runtime slice with its source hash.

## Confidence and open questions

- Confirmed high: actor-private ownership; row fields/count; roots and initial
  grants; complete level curve/cap rule; ordinary eligibility and draw order;
  mandatory pending/apply semantics; exact stable art IDs, card/icon geometry,
  bitmap-font identity, and multiplayer separation.
- Confirmed high-live: three seed-79225 bot offers and independent player/bot
  book writes; the settled picker frame and its persistent
  eight-circle/two-ring ambient families. The bot fixture is not promoted into
  a fresh-player offer golden because it lacks the complete input book.
- Bounded visual unknown: capture envelopes prove the ambient members and
  their motion ranges, but do not recover one closed-form native phase equation
  for every `UI.3`, `UI.62`, and corner oscillation. The web may reproduce the
  observed persistent rotation/pulse within those envelopes, must honor
  reduced motion, and must not claim tick-identical ambient phase.
- Row 82's standalone meaning remains unknown. It is allocated as a zeroed,
  non-catalog, non-offerable reserve; no name, art, or effect is invented.

## Web implementation consequence

- `core-kernels` owns the immutable native stat catalog, level curve, rank-book
  operations, explicit private/shared-RNG offer builder, and inert apply rule.
- The same kernel owns actor-private forced-prefix IDs, offer cycle, welding
  marker/current build, discipline weighting, and welding-bias flags. Their
  fresh defaults preserve the ordinary offer golden; their non-default paths
  must remain selectable without borrowing presentation state.
- `core-server` owns a dense player ECS. Stable entity IDs index separate
  identity, character config, locomotion, primary-cast, progression,
  skill-book, and stat-book component arrays. Worlds query character
  projections and commit only locomotion/cast changes; no world owns or clones
  progression.
- The protocol projects compact learned-rank rows, level/XP thresholds,
  revision, and the current ordered offer. The catalog/stat metadata remains a
  protocol-versioned client asset instead of being resent every snapshot.
- The client owns only focus/hover and Pixi presentation state. It cannot roll,
  reroll, defer, apply, or dismiss an offer locally; it may send a typed request
  which the host validates against the current offer and charm state.
- The picker uses exact source atlas rectangles and bitmap glyph records. React
  contributes transparent semantic buttons and focus routing only.
- The obsolete authoritative `players` record and the HUD's constant XP value
  are removed rather than retained as parallel compatibility state.

## Validation contract

- Kernel tests lock the 83-row allocation, exact root/loadout grants, catalog
  caps, independent books, level-75 clamp, paired-RNG offer reproduction,
  native RNG fixture values, category-1/category-4 collision behavior, cap
  rejection, forced-prefix order, welding cadence/build art, and one-row inert
  apply.
- ECS tests lock stable entity IDs, dense removal, component separation,
  progression persistence across Boneyard placement, and snapshot projection.
- Protocol/host tests lock version 11 decoding, bounded unique rank rows,
  exact offer identity, wrong/stale/other-player rejection, stopped movement
  during a pending choice, and independent two-client results.
- Render/asset tests lock source hashes, atlas dimensions, required native
  record IDs, three/four-card geometry, double-icon offset, bitmap-font use,
  and absence of CSS/system-font visual text.
- A real Chromium journey must enter the Hub with a test-awarded level, observe
  a ready Pixi WebGL picker, verify that movement is paused, select one exact
  offered skill, observe its rank/revision increment and picker closure, and
  repeat with two clients to prove owner isolation. Console and page errors
  must be empty.
- The final tree must pass `./scripts/validate.sh` and a residual scan for
  whole-player authoritative records, constant XP, unvalidated choice paths,
  substitute picker art/fonts, stale protocol 10 claims, and unlisted inert
  skills.

## Implementation receipt (2026-08-14)

- The rebased protocol-11 tree passes all `331/331` frontend game tests and the
  canonical `./scripts/validate.sh` gate, including the Release backend build,
  backend/contract tests, formatting, lint, game-boundary checks, desktop
  suite/build, production frontend/game-host build, and media-policy check.
- The real Chromium skill-picker journey rendered at `1600 x 900` through a
  `WebGL2RenderingContext`, presented native-art offer centers at `600`, `800`,
  and `1000`, selected skill row `21`, and observed its authoritative rank
  become `2`. The same journey proved modal movement stop/resume, mandatory
  Escape handling, and independent two-client ownership with no console or
  page errors. Its captured frame is `/tmp/solomon-dark-skill-picker-smoke.png`.
- The historical 2026-08-14 receipt also recorded a read-only static check of
  the then-current external report and sealed fixture metadata; it is not a
  maintained Website validation gate.

## 2026-08-28 — Player-reported first-presented card reopening

### Reported smell and process failure

- A player reports that the level-up screen's first selection differs from
  retail: cards lack colored icons and descriptions, although the full Skills
  screen exposes the information after selection.
- This reopens the card-composition rows above. The earlier pass verified one
  generic three-card frame and source record presence, but did not table-test
  the 72 public rows, eight roots, rank wrapping, or ten Welding variants. It
  left the exact palette helper unused and accepted generic family colors,
  records `81..90` for Welding, fixed name anchors, and transformed quick copy.
  One screenshot could not prove that complete membership.

### Evidence refresh

| Evidence class | Exact source | Recovered fact | Confidence |
| --- | --- | --- | --- |
| Retail identity | Beta 0.72.5 `SolomonDark.exe`, preferred base `0x00400000`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, re-hashed 2026-08-28 | Canonical image; no runtime/ASLR address is used. | high |
| Stock cards | `Mod Loader/tests/fixtures/webgame/menu-reference-captures/skill-picker.png`, SHA-256 `96fa5827e56de2a274b44eb9e6ccc10ad6da27fe973c946d76febbb9f7612556`; native Insight frame SHA-256 `a299c649f5e4a9c66302dc9cd6704ab0626d421d955075bb9a427469ada20023` | Root treatment, wrapped names/families, and quick descriptions are visible before hover. Insight is a second pass and does not replace copy. | high-live |
| Instructions | card renderer `0x006720F0`, Welding override `0x00671810`, LevelupScreen render `0x0067DF80` | Painter/text order, exact anchors, palette, shadows, and Welding domains. | high |
| Authored data | `native-skill-catalog.json`, `native-skills-and-spells.md`, `spell-welding.md` | All public rows `8..79` have nonempty quick/full description data; executable rules assign roots/categories; ten Welding rows own synthetic names/pairs/records. | high |
| Current web | `origin/main` `0c94685e`; `skill-picker-render-contract` and renderer | `skillPickerRootTint` is unused; Skills 164 stays white; family approximations replace roots; Welding uses the wrong icon domain/generic copy; names do not wrap; descriptions are uppercased, narrowed to 110, and misanchored. | high |

### Reopened boundary and authored-row inventory

Native system: **first-presented LevelupScreen card composition**, from each
ordered authoritative offer option through every visible layer before pointer,
keyboard, or controller selection. Every authored public row has one explicit
disposition below. `root` is the executable color root and `cat` is its compiled
category byte.

| ID / skill | root | cat | Disposition |
| --- | ---: | ---: | --- |
| 8 Magic Missile | 0 | 1 | exact-ported by the table-driven card contract |
| 9 Smart Missiles | 0 | 0 | exact-ported by the table-driven card contract |
| 10 More Missiles | 0 | 0 | exact-ported by the table-driven card contract |
| 11 Call Leviathan | 0 | 2 | exact-ported by the table-driven card contract |
| 12 Planewalker | 0 | 2 | exact-ported by the table-driven card contract |
| 13 Piercing | 0 | 4 | exact-ported by the table-driven card contract |
| 14 Ether Blast | 0 | 4 | exact-ported by the table-driven card contract |
| 15 Phasing | 0 | 2 | exact-ported by the table-driven card contract |
| 16 Fireball | 1 | 1 | exact-ported by the table-driven card contract |
| 17 Embers | 1 | 0 | exact-ported by the table-driven card contract |
| 18 Explode | 1 | 0 | exact-ported by the table-driven card contract |
| 19 Embers to Imps | 1 | 4 | exact-ported by the table-driven card contract |
| 20 Immolate | 1 | 4 | exact-ported by the table-driven card contract |
| 21 Ring of Fire | 1 | 2 | exact-ported by the table-driven card contract |
| 22 Burn | 1 | 0 | exact-ported by the table-driven card contract |
| 23 Firewalker | 1 | 2 | exact-ported by the table-driven card contract |
| 24 Lightning | 2 | 1 | exact-ported by the table-driven card contract |
| 25 Chaining | 2 | 0 | exact-ported by the table-driven card contract |
| 26 Stun | 2 | 0 | exact-ported by the table-driven card contract |
| 27 Magic Storm | 2 | 2 | exact-ported by the table-driven card contract |
| 28 Magic Tornado | 2 | 0 | exact-ported by the table-driven card contract |
| 29 Hurricane | 2 | 4 | exact-ported by the table-driven card contract |
| 30 Prismatic Shock | 2 | 2 | exact-ported by the table-driven card contract |
| 31 Disintegrate | 2 | 4 | exact-ported by the table-driven card contract |
| 32 Frost Jet | 3 | 1 | exact-ported by the table-driven card contract |
| 33 Chill Wind | 3 | 0 | exact-ported by the table-driven card contract |
| 34 Cone of Ice | 3 | 0 | exact-ported by the table-driven card contract |
| 35 Ring of Ice | 3 | 2 | exact-ported by the table-driven card contract |
| 36 Harden | 3 | 4 | exact-ported by the table-driven card contract |
| 37 Cold Aura | 3 | 4 | exact-ported by the table-driven card contract |
| 38 Hail | 3 | 0 | exact-ported by the table-driven card contract |
| 39 Permafrost | 3 | 0 | exact-ported by the table-driven card contract |
| 40 Boulder | 4 | 1 | exact-ported by the table-driven card contract |
| 41 Earthquake | 4 | 2 | exact-ported by the table-driven card contract |
| 42 Hasten Rocks | 4 | 0 | exact-ported by the table-driven card contract |
| 43 Bind Rocks | 4 | 0 | exact-ported by the table-driven card contract |
| 44 Rock Surge | 4 | 4 | exact-ported by the table-driven card contract |
| 45 Raise Golem | 4 | 2 | exact-ported by the table-driven card contract |
| 46 Stoneskin | 4 | 2 | exact-ported by the table-driven card contract |
| 47 Gargantuan | 4 | 4 | exact-ported by the table-driven card contract |
| 48 Teleport | 7 | 2 | exact-ported by the table-driven card contract |
| 49 Magic Circle | 7 | 2 | exact-ported by the table-driven card contract |
| 50 Magic Trap | 7 | 2 | exact-ported by the table-driven card contract |
| 51 Dampen | 7 | 2 | exact-ported by the table-driven card contract |
| 52 Spell Welding | 7 | 1 | exact-ported through all ten special builds below |
| 53 Flash | 7 | 0 | exact-ported by the table-driven card contract |
| 54 Magic Shield | 7 | 2 | exact-ported by the table-driven card contract |
| 55 Explosive Shield | 7 | 0 | exact-ported by the table-driven card contract |
| 56 Mana Up | 6 | 0 | exact-ported by the table-driven card contract |
| 57 Channel Mana | 6 | 3 | exact-ported by the table-driven card contract |
| 58 Meditation | 6 | 3 | exact-ported by the table-driven card contract |
| 59 Battle Mage | 6 | 3 | exact-ported by the table-driven card contract |
| 60 Focus | 6 | 3 | exact-ported by the table-driven card contract |
| 61 Siege Mage | 6 | 3 | exact-ported by the table-driven card contract |
| 62 Resist Magic | 6 | 3 | exact-ported by the table-driven card contract |
| 63 Creativity | 6 | 3 | exact-ported by the table-driven card contract |
| 64 Health Up | 5 | 0 | exact-ported by the table-driven card contract |
| 65 Enchant Staff | 5 | 3 | exact-ported by the table-driven card contract |
| 66 Telekinesis | 5 | 3 | exact-ported by the table-driven card contract |
| 67 Rush | 5 | 3 | exact-ported by the table-driven card contract |
| 68 Deflect | 5 | 3 | exact-ported by the table-driven card contract |
| 69 Resist Poison | 5 | 3 | exact-ported by the table-driven card contract |
| 70 Faster Caster | 5 | 3 | exact-ported by the table-driven card contract |
| 71 Fortunate Flailing | 5 | 3 | exact-ported by the table-driven card contract |
| 72 Acid Rain | 2 | 2 | exact-ported by the table-driven card contract |
| 73 Fire Wall | 1 | 2 | exact-ported by the table-driven card contract |
| 74 Ether Drain | 0 | 2 | exact-ported by the table-driven card contract |
| 75 Iron Golem | 4 | 0 | exact-ported by the table-driven card contract |
| 76 Call Comet | 3 | 2 | exact-ported by the table-driven card contract |
| 77 Turn Undead | 7 | 2 | exact-ported by the table-driven card contract |
| 78 Mindstar | 6 | 2 | exact-ported by the table-driven card contract |
| 79 Regenerate | 5 | 2 | exact-ported by the table-driven card contract |

### Cross-row and special-variant inventory

| Member | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| root 0 Ether `#FFE5FF` / ` ETHER` | `0x006720F0` | exact-ported | every root-0 row |
| root 1 Fire `#FFCBCB` / ` FIRE` | same | exact-ported | every root-1 row |
| root 2 Air `#E5FFFF` / ` AIR` | same | exact-ported | every root-2 row |
| root 3 Water `#CBCBFF` / ` WATER` | same | exact-ported | every root-3 row |
| root 4 Earth `#CBFFCB` / ` EARTH` | same | exact-ported | every root-4 row |
| root 5 Body `#FFE5CB` / `BODY ` | same | exact-ported | every root-5 row |
| root 6 Mind `#CBD8FF` / `MIND ` | same | exact-ported | every root-6 row |
| root 7 Arcane `#E5E5E5` / `ARCANE ` | same | exact-ported | every root-7 row |
| white record 13, root-tinted record 164, frame 5, black/main icon | card painter order | exact-ported | exact layer/tint assertions |
| ordinary uppercase name/rank, width 140 | centered text wrapper | exact-ported | every row plus rank-up wrapping |
| no-break word branch (`PLANEWALK-\nER`) | `0x0043D17D..0x0043D1A6` | exact-ported by this reopening | insert hyphen then rendered newline instead of throwing |
| family after measured wrapped name | same | exact-ported | exact eight labels/spaces |
| authored-case description, white/no shadow, width 140, center Y 532.5 | CFG plus card painter | exact-ported | all 71 ordinary public cards nonempty |
| hidden classification lane | same-SHA Ring-of-Fire pixels | verified-already-at-parity | no invented footer pixels |
| build 1000 Burning Bolt / record 108 | `0x00671810` | exact-ported | split 0/1, exact pair copy |
| build 1001 Frost Missile / record 109 | same | exact-ported | split 0/3, exact pair copy |
| build 1002 Ball Lightning / record 110 | same | exact-ported | split 0/2, exact pair copy |
| build 1003 Flame Lash / record 111 | same | exact-ported | split 2/1, retail `Lighting` spelling |
| build 1004 Blizzard Beam / record 112 | same | exact-ported | split 2/3, exact pair copy |
| build 1005 Steam Jet / record 113 | same | exact-ported | split 3/1, exact pair copy |
| build 1006 Ethereal Boulder / record 114 | same | exact-ported | split 0/4, exact pair copy |
| build 1007 Meteor Swarm / record 115 | same | exact-ported | split 4/1, exact pair copy |
| build 1008 Hailstones / record 116 | same | exact-ported | split 4/3, exact pair copy |
| build 1009 Crawling Shock / record 117 | same | exact-ported | split 4/2, exact pair copy |
| three/four cards | LevelupScreen panel builder | verified-already-at-parity after shared-card correction | exact centers/bounds |
| Creativity Insight on ordinary/Welding | `0x0067EA49..0x0067EDD0` | verified-already-at-parity above corrected base card | gold pass/label never hides description |
| Sorceror SAVE/ROLL | UI 57/56 | verified-already-at-parity | unchanged actions |
| automatic, queued, reconnect presentations | authoritative offer identity | verified-already-at-parity after shared renderer correction | identical first-presented copy |
| runtime rows 80/81 and reserve 82 | offer exclusion | out-of-system: never public picker cards | complete domain assertion |

No member is blocked by the browser platform.

### Corrected behavioral contract and implementation consequence

- The reported colored icon is the exact root-tinted Skills-164 glow behind the
  icon. Skills 13, frame 5, and the main icon remain white; the opaque black
  icon copy sits at `(+4,+4)`. Coloring only text is insufficient.
- Ordinary painter order is aura, root glow, frame, black/main icon, shadow/main
  name, shadow/main exact family, then unshadowed description. All lanes exist
  on the first frame and never depend on hover/focus.
- Ordinary names are uppercase with rank suffix and exact 140-pixel wrapping.
  The reachable no-break branch inserts `-\n` before the final overflowing
  pair; authored `PLANEWALKER` therefore renders as `PLANEWALK-\nER` rather
  than throwing or overflowing.
  Descriptions select `mQDescription` then `mDescription`, preserve authored
  case, wrap at 140, and center their measured 16/17-pixel block around 532.5.
  Lowercase source glyphs look like small caps but have distinct advances.
- Root is `nativeSkillColorRoot(skillId)`, not catalog family; advanced rows
  `72..79` therefore inherit Air, Fire, Ether, Earth, Water, Arcane, Mind, and
  Body respectively.
- Welding uses authored Skills records `108..117`, frame 14, split-color Skills
  164, synthetic Title Case name, exact `Welded ...` pair description, and
  `ARCANE `. The native compact-display alias `81..90` is deliberately not a
  second Website icon domain after the user-reported correction in entry 171.
- Preserve the existing Insight second pass, special actions, authority,
  selection, queue, and close lifecycle; repair the shared base card rather
  than adding report-specific DOM copy.

### Validation contract and receipt

- Table tests iterate IDs `8..79`, all eight roots/categories, rank one/rank up,
  name/description wrapping, exact labels/shadows/anchors, three/four cards,
  every Welding build, and Insight over ordinary/Welding cards.
- Mac Chrome must show an ordinary rank-up, advanced-root, four-card Insight,
  and Welding offer with root color and description present on the first frame;
  compare 1600x900 pixels and require empty page/console/failed-response arrays.
- Implementation and exact-tree Mac receipts are recorded below. Publication
  and deployment were not requested.

### 2026-08-28 implementation receipt

- `skill-picker-render-contract.ts` now produces one immutable visible-card
  plan from each authoritative option. All 71 ordinary public cards resolve
  exact root, packed tint, label, record, uppercase/rank wrapping, authored-case
  description, measured anchors, and shadows; row 52 resolves all ten synthetic
  Welding plans instead of entering the ordinary branch.
- `skill-picker-renderer.ts` consumes that plan before any focus/hover state. It
  tints Skills 164, keeps the main icon white over its black `(+4,+4)` copy,
  uses name/family black shadows, renders the unshadowed 140-pixel authored
  description block, and draws Welding frame 14, records 108..117, and the
  split two-root mesh. The existing Insight pass remains a later gold overlay.
- The full authored sweep exposed and closed the shared native no-break branch:
  `0x0043D17D..0x0043D1A6` produces `PLANEWALK-\nER` instead of the former web
  exception. Both full SkillScreen and LevelupScreen consume the corrected
  wrapper.
- Mac focused coverage iterates every ID `8..79`, all roots/categories, rank-up
  wrapping, every nonempty description, all ten Welding builds, Insight, both
  card counts, records `108..117`, and exact geometry. Production/test
  TypeScript and the three focused behavior suites passed; the complete
  Boneyard group passed on the same Mac candidate.
- Chrome `151.0.7922.174` on Apple M2/macOS `26.6.2` rendered WebGL2 at
  `1600x900`. Its ordinary first frame exposed nonempty authored descriptions
  and exact roots for Magic Circle (`slows time, boosts life and mana`,
  `#E5E5E5`), Health Up (`increases maximum health`, `#FFE5CB`), and Enchant
  Staff (`enchant staff for melee fighting`, `#FFE5CB`). The inspected frame
  SHA-256 is
  `74c0c68cf81ea5b0926445835f6d3ebbfdcc83ebb0eb5cac692d9ad5b41c7af6`.
- The same real Boneyard journey published a four-card authoritative first
  frame: rank-two Ring of Fire, Insight Acid Rain, Welding build 1003 Flame
  Lash, and Regenerate. Semantic roots were `1/2/7/5`; descriptions were
  `blast all surrounding enemies`, `spawn a shower of hot acid`, retail
  `Welded Lighting + Fireball`, and `boosts health recovery`. Direct visual
  review confirmed the four distinct root treatments, Insight's separate gold
  pass, the split Welding glow/frame, and unclipped copy. The frame SHA-256 is
  `e829336572796b07f9c1c7f067c0728e7dd17cfaf8f973ef2bef1d054066dd5c`.
  Page, console, and failed-response arrays were empty in both scenes.
- The final exact-tree Website gate on base `0c94685e` passed backend/Website
  contracts, formatting, lint, every frontend suite, desktop tests, production
  builds, bundle budget, and media policy. Mod Loader remained read-only
  evidence tooling and was not a validation or publication target.
- Publication and deployment were not requested and were not performed.

## 2026-08-28 — SkillPicker icon-owned detailed information projection

### Reported smell and parity question

- Reported behavior: the mandatory SkillPicker exposes each whole card as one
  selection button. Hovering the painted skill icon has no distinct information
  behavior, and a mobile tap on that icon immediately picks the skill.
- Requested behavior: desktop hover or keyboard focus on the painted icon, and
  a deliberate mobile tap on that icon, display the skill's detailed catalog
  metadata. A mobile icon tap must not submit the authoritative choice; the
  remainder of the card remains the pick target.
- Falsifiers: an icon tap sends `selectSkill`, an icon-sized action uses guessed
  geometry, metadata omits authored `mStats`/category-3 `mBonus`, card-body taps
  stop selecting, focus/hover changes play selection audio, or offer rebuilds
  retain stale details from the prior option.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | Beta 0.72.5 `SolomonDark.exe`, preferred base `0x00400000`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; size/hash reverified 2026-08-28 | Canonical image and extracted catalog remain unchanged. | high |
| Native LevelupScreen | card painter/hit family already recovered above; icon frame `87 x 88` centered at card X / Y `382.5` | Stock cards expose quick descriptions on their face and whole-card activation. Stock does not supply this second icon-popup interaction. | high |
| Shared native detail owner | SkillScreen `HoverButton +0x98 -> 0x00656CE0`, line builder `0x0066B990`, formatters `0x0065D7F0/0x0065DEF0`, shared `HoverBox` `0x005C38F0/0x005C3A60/0x005AB060` | The Website already owns complete native title/category/description/rank/`mStats`/`mBonus` metadata and the native bitmap HoverBox visual. It can be reused without inventing a second catalog or tooltip language. | high |
| Current web causal trace | Website `origin/main` `6220c5a7`; `SkillPicker.tsx`, `skill-picker.css`, `skill-picker-renderer.ts` | One transparent `200 x 295` `.skill-picker-action` spans each card and directly calls `choose(index)`. No icon action or detail state exists; touch therefore resolves to the selection owner. | high |

This explicit Website interaction request supersedes only ledger 229's earlier
"no second invented popup" product disposition. The stock first-frame quick
description remains exact and visible; the new detail surface reuses extracted
native SkillScreen data and rendering and is labeled as a browser extension,
not misreported as stock LevelupScreen behavior.

### System boundary and membership inventory

Native/web system: mandatory LevelupScreen card presentation and input, extended
with an icon-owned read-only projection of the already recovered native skill
detail catalog and HoverBox visual.

| Member | Native/web source | Disposition | Proof contract |
| --- | --- | --- | --- |
| three-card icon hit rectangles | exact card centers plus Skills frame `87 x 88` / Y `382.5` | exact-ported geometry for requested extension | all three independent icon actions align with painted frames |
| four-card icon hit rectangles | same shared table | exact-ported geometry for requested extension | all four align and remain inside card actions |
| ordinary rows `8..79` except Welding | immutable catalog, `mStats`, native formatter | exact-ported into requested detail projection | complete row sweep, target-rank values, no unresolved tokens |
| category-3 concentration rows | fourteen authored `mBonus` arrays | exact-ported | bonuses follow stats in native order |
| Welding builds `1000..1009` | synthetic names/icons/pair copy plus row-52 catalog | exact-ported shared data into requested projection | every build shows its identity without stale ordinary details |
| Creativity Insight option | existing authoritative option flag/target rank | verified-already-at-parity with detail extension | detail uses offered target rank; gold pass remains unchanged |
| desktop icon enter/leave | pointer-capable Website projection | exact requested extension | enter shows and silently selects visual card; leave clears details |
| keyboard icon focus/blur | semantic browser focus projection | exact requested extension | focus shows read-only details; activation never chooses |
| coarse-pointer icon tap | browser has no durable hover | exact requested extension | tap pins details and does not call `onSelect` or play `pickskill` |
| ordinary card body mouse/touch/keyboard activation | LevelupScreen card action | verified-already-at-parity | still chooses exactly once and runs existing close/audio/authority path |
| Reroll, Save, automatic choice | existing modal branches | verified-already-at-parity | details clear on rebuild/close; automatic path remains timer-owned |
| queued offer/reconnect replacement | authoritative offer sequence | exact-ported lifecycle extension | stale detail index is cleared before new content appears |
| full metadata visual | shared native SkillScreen HoverBox | exact-ported as explicit cross-owner Website extension | same bitmap fonts, wrapping, tints, margins, flip/clamp, and authored lines |
| protocol, host, save, replication | authoritative `selectSkill` family | verified-already-at-parity and unchanged | detail state remains client-local presentation only |
| rows 80/81 and reserve 82 | offer exclusion | out-of-system (never public SkillPicker options) | existing domain assertion |

No member is blocked by the browser platform.

### Recovered/requested behavioral contract and implementation consequence

- Split each card's transparent input geometry into the existing full card
  selection action plus an icon-sized read-only action layered exactly over the
  painted `87 x 88` frame. Sibling buttons, not nested controls, preserve valid
  semantics and ensure the icon wins pointer hit testing.
- The icon action owns only local detail/focus state. Desktop enter/focus also
  updates the silent visual selection; mobile activation pins the detail. It
  never calls `choose`, `onSelect`, `beginClose`, or selection audio.
- Reuse the shared native HoverBox drawing seam and catalog line builder. Do not
  duplicate metadata in React, fabricate property labels, or replace the
  existing card quick description.
- Reset details on offer commit, Reroll/Save/choice close, automatic choice,
  queued replacement, and unmount. Card-body activation and all authoritative
  state transitions remain unchanged.

### Validation contract

- Focused tests must pin all icon rectangles, all 71 ordinary public rows, all
  fourteen concentration bonus families, all ten Welding builds, target ranks,
  exact shared HoverBox input, and the absence of unresolved format tokens.
- Mac Chrome desktop journey: hover/focus each icon, observe the matching
  detail identity and WebGL HoverBox, leave/blur to clear, then select through
  the card body with one existing audio/authority transition.
- Mac Chrome `844 x 390` touch journey: tap an icon and prove the same offer
  sequence, pending choice, open phase, and `pickskill` count remain unchanged;
  then tap the same card outside the icon and prove one selection/close.
- Repeat an offer rebuild and a four-card/Welding/Insight presentation, require
  no stale detail, WebGL2, empty page/console/failed-response arrays, focused
  suites, and the complete supported Website gate.
- Implementation, browser, gate, publication, and deployment receipts remain
  pending below this investigation entry.

### Implementation validation receipt

- `SkillPicker` now layers one exact `87 x 88` semantic information action over
  each painted icon while retaining the existing `200 x 295` card-body choice
  action. Icon hover/focus/tap owns only local detail state; card-body activation
  still owns the unchanged sound, authority, close, queue, and resume path.
- `native-skill-hover-box.ts` is now the single shared bitmap HoverBox renderer
  for SkillScreen and SkillPicker. `skillPickerDetailPresentation` projects the
  offered target rank through the complete catalog formatter, all authored
  `mStats`, all fourteen concentration `mBonus` families, and all ten synthetic
  Welding identities/pair descriptions. Offer rebuild, Reroll, Save, choice,
  automatic choice, and teardown clear the local detail.
- The table-driven contract covers exact three/four-card icon bounds, every
  ordinary public row, unresolved-token absence, offered rank/Insight, all
  concentration bonuses, and all Welding builds. The complete supported Mac
  gate passed these contracts and all existing picker/SkillScreen/runtime
  suites on current-main base `5257a20e`.
- Mac Chrome `151.0.7922.174` at `844 x 390` tapped a real icon whose browser
  bounds were `37.70 x 38.13` inside its scaled card. The WebGL HoverBox showed
  the matching skill identity and authored detail while offer sequence, rank,
  settled phase, and `pickskill` count remained unchanged. A later tap near the
  bottom of that same card selected exactly once and cleared detail. Its visual
  receipt SHA-256 was
  `b0df6a85524eb6a2002d6581438f0925baf657a1cb38480ed5d1206f17ed50fc`.
- Desktop Chrome proved exact native icon centers `(600|800|1000, 382.5)` and
  `87 x 88` bounds, hover/detail identity, silent selection focus, clear-on-leave,
  queued reset, and the four-card Ring of Fire / Insight Acid Rain / Welding
  Flame Lash / Regenerate matrix. The inspected four-card receipt SHA-256 was
  `89e5b7a7ae15ebafc3bf2033e617bddab77b4b0ad2c86c235b89c5772b05e3eb`;
  desktop and touch log SHA-256 values were
  `874b9c7190b1e1b613fe47879c7868e2143137cd5a548324b1f386d464f34cb9`
  and `58a4ef8392b8f7877384903f23e1d2ca27ec11907aa24a3222ee18bfc37ea39e`.
- All browser journeys used WebGL2 with empty page, console, and failed-response
  arrays. The detail popup remains an explicit Website interaction extension;
  the stock first-frame quick description and every native picker lifecycle
  member remain unchanged. Publication and deployment were not requested and
  were not performed.

## 2026-08-29 — Reopened: desktop icon activation versus touch metadata

### Reported smell and parity question

- Reported web behavior: the icon-owned details now appear, but the invisible
  icon action consumes every click. A desktop player cannot choose the skill by
  clicking its painted icon even though the rest of the card chooses normally.
- Requested behavior: keep hover-driven details on desktop, let a desktop mouse
  click on the painted icon choose the card, and reserve metadata-only icon
  activation for mobile touch where no durable hover exists.
- This reopens the 2026-08-28 entry because that pass collapsed mouse and touch
  activation into one read-only branch. The shared metadata projection itself,
  its exact geometry, and the authoritative card-choice lifecycle remain valid.
- Falsifiers: a mouse icon click leaves the offer open, a touch icon tap sends
  `selectSkill`, either branch plays the wrong audio count, hover stops showing
  details, card-body activation changes, or pointer classification depends on a
  user-agent/device-name guess instead of the activating pointer.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | Beta 0.72.5 `SolomonDark.exe`, preferred base `0x00400000`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; size/hash reverified 2026-08-29 | The recovered stock LevelupScreen whole-card activation contract and `87 x 88` painted icon frame are unchanged. | high |
| Current web causal trace | Website `origin/main` `e7addc2b`; `SkillPicker.tsx` icon sibling above the whole-card action | `.skill-picker-info-action` has `z-index: 1`; its unconditional `onClick` stops propagation and calls only `setSelection`/`updateDetail`. The underlying `.skill-picker-action -> choose(index)` therefore never receives an icon click on any pointer class. | high |
| Existing desktop acceptance | `frontend/tools/smoke-skill-picker.mjs` detail and choice journeys | Desktop hover proves metadata, but the later authoritative choice deliberately clicks `.skill-picker-action` outside the icon. The journey omitted the reported mouse-icon activation branch. | high |
| Existing touch acceptance | same smoke with `SDR_SKILL_PICKER_TOUCH_DETAILS_ONLY=1`, Chrome `844 x 390` | A real touch pointer taps the icon, retains the offer/rank/phase/audio count, then selects through the card body. This remains the requested mobile contract. | high |

No new stock behavior is inferred: the mouse/touch split is an explicit Website
interaction requirement over the already recovered stock whole-card action and
shared SkillScreen detail projection.

### System boundary and membership inventory

Native/web system: LevelupScreen card input plus the Website icon-owned detail
projection. This reopening changes only activation routing at their overlap.

| Member | Native/web source | Disposition | Proof contract |
| --- | --- | --- | --- |
| three-card and four-card icon rectangles | recovered `87 x 88` frame at Y `382.5`; `skillPickerIconBounds` | verified-already-at-parity | all icon actions remain exactly inside their card actions |
| desktop mouse enter/leave | icon `pointerenter`/`pointerleave` and shared HoverBox | verified-already-at-parity | enter shows matching metadata without audio/authority; leave clears it |
| desktop mouse icon activation | stock whole-card action plus requested Website overlap rule | exact-ported requested correction | one mouse click calls the existing `choose(index)` path exactly once |
| touch icon activation | Website no-hover extension | verified-already-at-parity | tap pins metadata and changes no offer sequence, rank, phase, or `pickskill` count |
| pen and keyboard icon activation | existing read-only detail semantics; neither is a desktop mouse click | verified-already-at-parity | focus/direct activation remains metadata-only and never submits accidentally |
| ordinary card body, all input classes | native LevelupScreen card action | verified-already-at-parity | still chooses once through the existing close/audio/authority path |
| all ordinary, concentration, Insight, and Welding metadata members | complete catalog and shared native HoverBox owner enumerated in the 2026-08-28 entry | verified-already-at-parity | content and renderer inputs are unchanged |
| Reroll, Save, automatic choice, queued/reconnect replacement | existing picker lifecycle branches | verified-already-at-parity | details still clear on every rebuild/close boundary |
| protocol, host, save, and replication | `MainMenuScene -> session.selectSkill -> client-select-skill` | verified-already-at-parity and unchanged | input classification remains local; only `choose` can submit |
| rows 80/81 and reserve 82 | offer exclusion | out-of-system (never public SkillPicker options) | existing domain assertion |

No member is blocked by the browser platform.

### Recovered/requested behavioral contract and implementation consequence

- Keep sibling buttons and exact icon bounds. The icon remains the topmost hit
  target so it can own hover/focus metadata.
- Classify the activation from the actual pointer event. A mouse activation
  delegates to the existing `choose(index)` owner; touch activation retains the
  existing local `setSelection(index)` plus `updateDetail(index)` behavior.
  Pen and keyboard activation keep the read-only detail behavior.
- Do not duplicate selection audio, close state, or protocol calls in the icon
  handler. Mouse activation must enter `choose` so its guards and lifecycle stay
  authoritative.
- Do not use viewport size, mobile user-agent detection, or a global media query:
  hybrid devices must follow the pointer that performed this activation.

### Validation contract

- Extend the existing Mac desktop Chrome journey so the first authoritative
  selection after a rebuilt offer clicks `.skill-picker-info-action`, then prove
  one rank increment, one `pickskill`, the native close/queue transition, and
  cleared details.
- Preserve the separate Mac Chrome `844 x 390` touch journey that taps the same
  icon and proves unchanged offer sequence, rank, settled phase, and audio count
  before selecting once through the card body.
- Retain the three/four-card geometry and complete metadata contract suites,
  require WebGL2 and empty page/console/failed-response arrays, and run the
  complete supported Website gate.
- Implementation, browser, gate, publication, and deployment receipts remain
  pending below this investigation entry.

### Implementation validation receipt

- `SkillPicker` now records the actual primary pointer class that begins an icon
  activation. The icon click delegates mouse input to the existing
  `choose(index)` owner; touch, pen, and keyboard activation retain the local
  detail projection. The choice guards, sounds, close envelope, queue rebuild,
  protocol call, and card-body input path were not duplicated or changed. The
  desktop icon cursor now advertises activation rather than help-only input.
- The updated desktop browser regression failed against unmodified
  `origin/main` `e7addc2b`: after `.skill-picker-info-action.click()`,
  `observeQueuedWait` timed out because the picker never began closing. The same
  regression passed after the input-router change, selected skill 18 through
  the existing authority path, and measured exactly one new `pickskill` event.
- Chrome `151.0.7922.174` on Apple M2/macOS `26.6.2` rendered WebGL2 at
  `1600 x 900`. Desktop hover still projected the matching detail identity,
  three-card icon bounds remained exactly `87 x 88` at centers
  `(600|800|1000, 382.5)`, the four-card ordinary/Insight/Welding matrix remained
  complete, and the mouse icon selection completed the native close/queued-offer
  lifecycle. Page, console, and failed-response arrays were empty. The inspected
  four-card frame SHA-256 was
  `1a3a26e6515d2332a58d8c2126a197741fb92b213a8195b702fae5fc30addb5e`.
- The independent `844 x 390` touch journey tapped a real `37.70 x 38.13` icon,
  displayed skill 65 metadata, and retained offer sequence 2, rank, settled
  phase, and `pickskill` count. A later tap on the same card outside the icon
  selected once. WebGL2 was active and all error arrays were empty. The inspected
  touch-detail frame SHA-256 was
  `5199138e5498c0548174ced016fb839f3c96445b8dc9574cb6ec9ec403b52cd5`.
- The focused native UI contract passed all 57 tests, including exact
  three/four-card geometry and the complete ordinary/concentration/Insight/
  Welding metadata membership. The complete supported Mac Website gate passed
  backend build/contracts, formatting, lint and architecture boundaries, every
  frontend suite, desktop tests, production build, bundle budget, and media
  policy on current-main base `e7addc2b`.
- There are no platform-blocked members or remaining unknowns in this input
  split. Publication and deployment were not requested and were not performed.

## 2026-08-31 — Reopened: complete Creativity Insight card compositing and detail

### Reported smell and parity question

- Reported web behavior: the marked Creativity Insight card has different
  colors from retail and its icon-owned detail popup omits the Insight boost.
  The supplied web capture is
  `C:\Users\User\Downloads\SDB - insight Bugged Visuals.mp4`, 1,386,977 bytes,
  10.023144 seconds, `1844 x 1080`, SHA-256
  `57fe693d01cbdc7aa1fd7bb9c427555472c2aec597cf40cb2c706ef4b9562ed0`.
  Frames at 0.6, 4.0, and 8.0 seconds show Insight Mana Up 3 with a uniformly
  brown/gold icon treatment; the 0.6-second icon popup ends at
  `MAX MANA: +300` with no Insight line.
- Stock behavior to recover: the complete marked-card painter, including which
  ordinary layers remain untouched, which layers are redrawn, each redraw's
  blend mode/color/alpha, and the exact detail string. The correction must
  cover three- and four-card offers, every ordinary row, every Welding build,
  and every scene using the shared picker.
- This is a secondary report against both the 2026-08-28 first-presented-card
  and icon-detail entries above. Those passes recorded only “gold pass” and
  asserted that Insight metadata was complete. They did not enumerate every
  `screen + 0xFC` render branch or exercise the visible Insight detail line.
  That process failure allowed a normal-alpha blanket tint and an aria-only
  bonus string to be accepted as parity.
- Falsifiers: retail blanket-tints the white aura or actual skill glyph; retail
  retains the ordinary root/white text under the Insight pass; the gold redraws
  use ordinary alpha blending; the detail builder has no Insight-specific line;
  or any ordinary/Welding/scene consumer owns a separate renderer.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Reported web capture | file and SHA-256 above; frames 0.6/4.0/8.0 seconds | The current shared renderer gold-tints the Mana Up glyph and panel while leaving ordinary Mind/white text, and the detail popup omits the bonus. | high-direct |
| Retail identity | Beta 0.72.5 `SolomonDarkAbandonware/SolomonDark.exe`, preferred base `0x00400000`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` | Canonical image; no runtime or ASLR address is used. | high |
| Existing stock evidence | settled stock card fixture SHA-256 `96fa5827e56de2a274b44eb9e6ccc10ad6da27fe973c946d76febbb9f7612556`; historical native Insight frame SHA-256 `a299c649f5e4a9c66302dc9cd6704ab0626d421d955075bb9a427469ada20023` | Insight is an additional marked-card treatment over the same authored card membership. | high-live historical |
| Read-only static tooling | canonical Ghidra 12.0.3 replica slot 03; Mod Loader checkout `08bfba9ef367f7b863848030d0a289dc31e33192`, wrapper SHA-256 `b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`, `decompile_targets.py` SHA-256 `899167ca42624e09f26d22233365631a6ee8b3d106e337e20b77574894e97465`, `dump_insns_around.py` SHA-256 `79249e8ea5eb04115bb284f1bef9b90d81cd74f2c5301a747d08908a36032b40` | Exact provenance for the instruction evidence below. The dirty shared Mod Loader checkout was not changed. | high |
| Panel and label instructions | `LevelupScreen_Render 0x0067DF80`; `0x0067ED01..0x0067EDD0`; nine-slice draw `0x004153B0`; string `Insight` at `0x007A0D94` | A marked card redraws only its Skills.0 panel in pulsing gold under ordinary alpha, then draws the case-sensitive body-font label at logical Y `305.5`. | high |
| Glow instructions/data | `0x0067F91F..0x0067FB13`; Skills vector `+0x0F28`, first/only live member 164 | The ordinary root/split glow is replaced by a constant gold additive draw and a second pulsing gold additive draw of Skills.164. | high |
| Frame and icon instructions/data | `0x0067FC62..0x0067FD17`; Skills.5 ordinary frame and the recovered Skills.14 Welding branch; glyph array `+0x0ED8` at `0x0067FD43..0x0067FE5F` | The white frame remains and receives one pulsing gold additive redraw. The black-offset and white actual skill glyph draws have no Insight branch and remain untouched. | high |
| Text instructions | Insight branch `0x00680084..0x006805E4`; ordinary branch begins `0x006805EE` | A marked card does not use the ordinary root/white text path. Name, family, and authored quick description receive a constant additive RGB `(0.5,0.5,0.5)` pass followed by a pulsing additive gold pass. | high |
| Color/blend instructions | color setter `0x0041FE50`, blend applier `0x004208A0`; floats `0x00784D60=.85`, `0x00788BDC=.73`, `0x00788BE0=.44`, `0x007DE870=.5` | Gold is packed `#D9BA70`; the constant text pass is `#808080`; renderer blend state 1 is additive. Pulse alpha remains `0.5 + 0.5*sin(2*screenAgeTicks degrees)`. | high |
| Detail instructions | pointer/detail builder `0x00670E20`, `0x00671174..0x0067123C`; string `Insight Bonus: Skill +2` at `0x007A0B40` | The marked option appends the exact native line before presenting its detail object. The binary contains no `Boost:` string for this branch. | high |
| Current web causal trace | `skill-picker-renderer.ts`, `skill-picker-render-contract.ts`, `SkillPicker.tsx` at base `41e1525491649235c00e82207f67803084138943` | The web adds normal-alpha gold copies of Skills.13, Skills.164, frame, and the actual icon; it then paints ordinary text above them. `skillPickerDetailPresentation` ignores `option.insight`; only the semantic card aria-label contains the bonus. | high |

### System boundary and membership inventory

Native system: the visible `LevelupScreen` Creativity Insight mark, from the
authoritative option's `insight` identity through the complete panel/card/text
paint sequence and the Website's existing icon-owned detail projection. RNG,
double acquisition, authority, persistence, and offer lifecycle remain owned by
ledger 290 and are re-audited here only at their presentation boundary.

| Member | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Skills.0 card panel | `0x0067ED01..0x0067ED75` | `exact-ported` by this reopening | base panel plus pulsing normal-blend gold panel; no blanket container blend |
| `Insight` label | `0x0067ED75..0x0067EDD0` | `verified-already-at-parity` after separating it from the bad blanket tint | body font, case, X center, logical Y `305.5`, pulse |
| Skills.13 white aura | no `screen + 0xFC` redraw | `exact-ported` by this reopening | one ordinary white draw only |
| Skills.164 ordinary roots / ten split Welding roots | ordinary card path and `0x00671810` | `verified-already-at-parity` for unmarked cards | all eight roots and ten split builds retain their existing treatment |
| Skills.164 marked glow | `0x0067F91F..0x0067FB13` | `exact-ported` by this reopening | replace ordinary root/split draw with constant plus pulsing gold additive draws |
| Skills.5 ordinary frame | `0x0067FC07..0x0067FD17` | `exact-ported` by this reopening | white base plus pulsing gold additive redraw |
| Skills.14 Welding frame | shared Welding override and same Insight branch | `exact-ported` by this reopening | white base plus pulsing gold additive redraw for all builds `1000..1009` |
| actual ordinary glyphs `27..122` | array `+0x0ED8`; `0x0067FD43..0x0067FE5F` | `exact-ported` by this reopening | black `(+4,+4)` shadow and white main draw; no gold glyph copy |
| Welding glyphs `108..117` | same glyph array/override | `exact-ported` by this reopening | same untouched shadow/main rule for all ten builds |
| marked name text | `0x00680084..0x006805E4` | `exact-ported` by this reopening | no ordinary root text; constant gray plus pulsing gold additive text |
| marked family text | same branch | `exact-ported` by this reopening | same two-pass treatment and existing exact family copy/anchor |
| marked quick description | same branch | `exact-ported` by this reopening | same two-pass treatment; authored case/wrap/anchor retained |
| exact Insight detail line | `0x00670E20`, string `0x007A0B40` | `exact-ported` by this reopening | visible popup contains `Insight Bonus: Skill +2`, not only aria copy |
| all 71 ordinary public rows `8..79` except 52 | complete authored inventory above | `exact-ported` through shared plan | each row preserves icon/description while accepting the same Insight treatment |
| all ten Welding builds `1000..1009` | complete build inventory above | `exact-ported` through shared plan | frame/icon/name/pair copy and marked treatment are table-covered |
| three-card and four-card geometry | shared LevelupScreen renderer | `verified-already-at-parity` | treatment follows marked index at every center |
| Hub, Boneyard, detached/reconnect picker | shared `SkillPicker` renderer | `exact-ported` through one owner | identical presentation and popup content in every consumer |
| hover, focus, touch detail | Website icon-detail extension above | `exact-ported` by this reopening | every route consumes the same corrected detail plan |
| Reroll, Save, queued replacement, automatic choice, close/teardown | existing authoritative offer lifecycle | `verified-already-at-parity` | marker replacement/clear semantics and gameplay state are unchanged |
| non-Insight offers | `screen + 0xFC != optionId` | `verified-already-at-parity` | no additive treatment or bonus line leaks to siblings |
| runtime rows 80/81 and reserve 82 | offer exclusion | `out-of-system` (never public picker cards) | existing complete-domain assertion |

There are no browser-platform-blocked members. Pixi/WebGL supports the native
normal/additive blend split and the extracted bitmap fonts/assets directly.

### Native ownership thread and recovered behavioral contract

- `LevelupScreen` owns one marked skill ID at `+0xFC`; the host-authored
  protocol option's `insight: true` is the Website representation. The shared
  renderer consumes it; no scene, hover surface, or React layer may derive a
  second marker.
- The panel is the only pulsing normal-blend image. Skills.164 and the frame use
  additive gold; the aura and actual glyph are not Insight consumers. This
  painter membership, rather than a different gold constant, explains the
  reported brown/washed icon.
- Marked card text enters its own branch instead of painting ordinary text and
  adding gold behind it. The constant `#808080` additive pass and pulsing
  `#D9BA70` additive pass cover name, family, and quick description.
- The native detail builder appends `Insight Bonus: Skill +2` to the marked
  option. The Website icon popup is a documented extension, but once it
  projects the native detail object it must include that native line. Aria text
  is not visible parity.
- Offer replacement, reroll, save/defer, automatic selection, selection,
  double apply, close, and teardown continue to own the marker lifetime already
  documented in ledger 290. Presentation objects are rebuilt from the current
  immutable option and destroyed with the renderer.

### Confidence and open questions

- Confirmed: every material draw branch, asset record, RGB/alpha constant,
  blend transition, text member, detail string/xref, current web violation, and
  shared consumer.
- The user-referenced native visual was not a separate file in the Downloads
  folder at investigation time; visual appearance is therefore reconciled from
  the existing historical native-frame receipt plus fresh canonical
  instructions. No implementation value depends on an unavailable pixel guess.
- No material unknown remains and no browser approximation is required.

### Web implementation consequence

- Replace the blanket `insightTreatment` with explicit constant and pulsing
  members matching the inventory. Use additive blending only where native does.
- Preserve white aura and actual icon; suppress ordinary root/white text for a
  marked card and render the exact gray/gold two-pass text treatment instead.
- Append the exact native bonus line in `skillPickerDetailPresentation` so the
  one shared visual/semantic detail plan serves hover, focus, touch, and smoke
  assertions. Remove the duplicate hand-built aria-only suffix.
- Do not change RNG, protocol, rank application, scene ownership, selection,
  or card geometry.

### Validation contract

- Focused contract tests must pin the complete preserved/constant/pulsing
  member inventory, normal versus additive blend, exact tints, pulse endpoints,
  detail line, non-leakage to ordinary cards, all 71 ordinary rows, all ten
  Welding builds, and both card counts.
- The existing Mac creativity-Insight smoke must open the actual marked icon
  detail in Hub and Boneyard, assert the visible exact bonus line, capture at
  least two pulse phases, select the marked card, and retain the existing
  `+2`, gameplay-RNG, secondary-RNG, queue, and error-array assertions.
- Compare the marked card against the instruction-derived stock membership at
  `1600 x 900`: white aura/icon, additive gold glow/frame/text, pulsing normal
  panel/label, and no gold treatment on an unmarked sibling.
- Run the complete canonical Mac gate on the byte-identical candidate before
  publication. Implementation, Mac receipt, push receipt, and cleanup remain
  pending below this entry.
