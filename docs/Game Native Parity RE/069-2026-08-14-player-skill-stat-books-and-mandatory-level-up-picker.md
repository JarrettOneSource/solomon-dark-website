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
- Welding uses `skillScreenIconRecord` `108..117`, frame 14, split-color Skills
  164, synthetic Title Case name, exact `Welded ...` pair description, and
  `ARCANE `. `skillsAtlasIconRecord` `81..90` belongs another display domain.
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
