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
- The Mod Loader static native-progression contract check passes against the
  reusable report and sealed fixture metadata.
