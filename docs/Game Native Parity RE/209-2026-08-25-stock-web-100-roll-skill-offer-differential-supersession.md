# 2026-08-25 — Stock/web 100-roll skill-offer differential supersession

## Reported smell and controlled reproduction

The reported smell was that low-level offers omit many subskills. One exact
Ether/Arcane loadout was held at stock level 2 / XP 100 with starting skills
Magic Missile 8 and Call Leviathan 11. The retail harness generated 100
actor-private seeds with the sealed native RNG, invoked the untouched retail
`Skills_Wizard vtable +0x74 -> 0x0067CB70` builder 100 times, applied no
choice, and proved that ranks, roots, level, mana, forced list, feature flags,
and offer cycle did not change. The oracle remains the 4,723,200-byte retail
executable SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`.

The same frozen state and 100 private seeds were replayed in the current web
kernel. All 72 public rows matched stock metadata for cap, maximum, category,
root, minimum level, and dependency IDs. Exhaustive ready/minimum/any/
forbidden/cap/advanced-unlock predicate mutations also produced zero
failures. Stock exposed 12 distinct eligible rows at this boundary:
`8,9,10,11,48,49,50,56,57,64,65,67`. The low-level membership table is not
missing a sibling family after the prior cap correction.

The draw result was nevertheless not native. Eighty-five web rolls matched
the stock unordered three-card set, while 15 had only two cards in common.
Those same 15 web rolls contained a repeated skill ID; stock contained zero
repeated-ID rolls across all 100. Seed `929799` is the minimal witness: the
private stream consumes focus `1`, general swaps `4,4,0,4,0`, root index `1`,
then fill indices `6,0,7`. Stock displays the unique membership
`{9,65,10}`; the old web kernel accepted the first repeated 9 and stopped at
`{9,9,65}`.

Ordered equality is not a valid private-seed-only comparison. Live call-site
tracing shows that final card order belongs to the active gameplay RNG, whose
incoming state was intentionally not reset in the first capture. A paired
global-state capture is required for exact ordered regression.

## Corrected native ownership and full membership

| Member / branch | Native owner | Current web disposition before this fix | Required regression |
| --- | --- | --- | --- |
| Focus and category counts | private RNG in `0x0067CB70` | exact | exact draw sequence |
| Root-priority scan and Welding bias pool | private RNG | exact | root/related membership and order |
| General scan, weighting, and pre-shuffle | private RNG | exact | all 72 rows plus full-range swaps |
| Forced-prefix insertion | unique result container | incomplete; repeated IDs can enter | repeated forced IDs collapse without consuming another RNG word |
| Root-priority insertion | unique result container | incomplete; can duplicate forced ID | duplicate insertion leaves count unchanged |
| Spell Welding build choice | active gameplay RNG at `0x0067DA4B` | wrong stream; private RNG | ten builds and exact shared-stream advance |
| Learned-skill pruning | private RNG | exact | thresholds 8/12/20 and overwrite order |
| Fill candidate draw | private RNG, with-replacement candidate list | exact weighting | exact candidate index stream |
| Exact-ID insertion | unique result container | missing | no displayed duplicate in any category |
| Category-4 collision | `0x0067BFA0` predicate | exact | at most one category-4 row |
| Category-1 collision | raw category byte and 50 counter | exact | first 50 cross-ID collisions retry |
| Attempt-100 pool growth / attempt-200 exit | builder loop | structurally exact | weights grow; undersized escape remains bounded |
| Final full-range shuffle | active gameplay RNG from `0x00818B08` | wrong stream; private RNG | one shared word per card and exact order under paired state |
| Three cards / Creativity four | desired-count branch | exact count | both counts use uniqueness and shared final shuffle |
| Initial/shared level, active-run catch-up, reroll, queued choice, save/defer, automatic choice, bonus book, and pending-offer rebuild | authoritative progression + gameplay RNG | stream state not propagated through offer build | every issuing path returns and stores advanced host RNG |
| Host/client replication and apply | host offer identity | exact authority | clients never reroll or reorder locally |

The key native owner is the selected-result container initialized at
`0x0067D1F8..0x0067D21F` with vtable `0x007846CC` and uniqueness byte
`+0x04 = 1`. Insert dispatch `0x00402720` reaches
`0x004013C0/0x004013E0`; its `vtable +0x24 -> 0x00401510` lookup suppresses
an already-present skill pointer without increasing result count. Candidate
lists still retain repeated pointers as probability weights and fill still
draws with replacement. The selected result is unique. This supersedes every
earlier ledger statement that non-category-4 duplicates are displayable or
that the single eligible category-1 row can fill all four slots.

Raw instruction enumeration and live return tracing also supersede the old
single-stream claim. Private RNG owns focus, general pre-shuffle, root/bias,
pruning, and fill. The active gameplay RNG owns the optional Welding build
draw and final display shuffle. Thus equal book/private seed fixes ordinary
membership but not Welding build identity or card order unless the gameplay
state also matches.

## Web implementation and validation contract

- Make offer construction return both the authoritative offer and the advanced
  gameplay RNG. Thread it through every path that can issue or rebuild an
  offer; do not hide a second RNG in presentation or protocol state.
- Preserve candidate-pool weighting and private draw counts. Insert each
  forced, root, Welding, and fill option through one exact-ID uniqueness seam.
  A suppressed duplicate consumes the candidate draw but not a result slot.
- Select a Welding build and perform the final full-range swap with the shared
  gameplay stream, in that order. Creativity Insight remains its later,
  separately owned gameplay/concentration draw.
- Replace the old four-duplicate category-1 fixture with duplicate-suppression
  coverage across forced/root/fill and three/four-card offers. Keep category-1
  and category-4 cross-ID collision tests.
- Gate a paired 100-roll stock/web replay on zero metadata failures, zero
  predicate failures, zero duplicate offers, exact unordered membership for
  every private seed, exact order for every paired gameplay state, and exact
  final gameplay RNG state.
- Run the canonical Website validation only on the Mac mini, then perform a
  real WebGL picker acceptance covering initial, queued, rerolled, deferred,
  automatic, Welding, three-card, and Creativity-four-card issuance with
  empty page/console/network errors.

## Implementation validation receipt

- `buildPlayerSkillOffer` now keeps actor-private candidate construction and
  active-gameplay presentation draws separate, inserts every option through
  one exact-ID uniqueness seam, and returns the advanced gameplay state. That
  state is threaded through initial/shared XP, active-party catch-up, queued
  apply, reroll, Save Skill, bonus books, automatic selection, and explicit
  pending-offer rebuilds. Welding pair selection precedes the shared final
  shuffle exactly as stock does.
- The controlled stock capture is SHA-256
  `d9716cf2fde89c8f29b822bf5d6e8f42f2e736d7868ce0f4b679b8e83ec0b81a`.
  Its untouched retail builder produced 100 three-card offers, zero repeated
  IDs, 12 distinct eligible skill IDs, and no progression mutation. The
  rebased Mac replay report is SHA-256
  `ba6029a79c4ebd3be87de7431ce0afd1d25258deddfe62061ea6947a2aa992cc`:
  ordered matches `100/100`; unordered, metadata, predicate, duplicate, and
  final-gameplay-RNG mismatches are all zero.
- The exact Website candidate is based on current-main active-party commit
  `6c52d7589e3c172b0b11ab51cb902e8a503319cd`. The canonical Mac gate passed
  backend build/contracts, strict format/lint/import boundaries, the complete
  frontend/game/UI/diagnostic/desktop suite, production builds, media policy,
  and bundle budget. `Game-BWf4uLs4.js` is 465,199 raw / 130,468 gzip bytes
  against 524,288 / 131,072.
- The exact Mod Loader candidate is based on
  `7607716943a13dd9e456f43b85d32f634e40b342`; its complete registered Mac
  static-RE suite passed `500/500`. Live RNG tracing separately records the
  seed-`929799` private results `1; 4,4,0,4,0; 1; 6,0,7` followed by three
  active-gameplay final-shuffle calls; trace SHA-256 is
  `8952124149b5d32c9880075ec10c4ac5a17ce6d996dfda1d4ce67f133047e9ef`.
- Chrome 151/WebGL2 at 1600 by 900 completed the rebased Hub/Boneyard journey.
  The Hub displayed distinct `48,67,57` cards, reroll advanced the exact four
  expected gameplay words, queued and deferred offers remained duplicate-free,
  and the authoritative player stayed on one frozen tick. Hub/Boneyard reveal
  alpha included zero and intermediate samples before one; actor particles
  reached 48/44. Audio retained the stock level/open/unlock rates, and page,
  console, failed-request, and failed-response arrays were empty.
- Reviewed rebased reveal/settled/Boneyard frames have SHA-256 values
  `76d55f9612f1ac0a9904be83aee969b802eb11536263196befaa6ced5178c94f`,
  `279ccf1d253cc15484c20c118112b54c77d812eef44897a0ca749e86d627cb34`,
  and `6a22c008d45596135a2e87a31269ec9b467f0fcc5ec5df25f6c10b888ad9b074`.
  No member is browser-blocked and no material native unknown remains.
  Publication is authorized separately from deployment; this receipt does not
  claim a production restart.
