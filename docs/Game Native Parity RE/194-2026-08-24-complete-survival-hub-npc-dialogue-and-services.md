# 2026-08-24 — Complete survival-Hub NPC dialogue and services

## Reported smell and parity question

- Reported web behavior: named NPCs open a flat intro followed by Done.
  Provokatus has story-phase copy and no Boast menu; the same model drops the
  Machinimbus and Semicus selectors, ordinary questions/dismissals, and all
  downstream state effects.
- Stock behavior to recover: every named survival-Hub actor and Painting,
  complete `Chat` graphs, `Boast`, `BookReview`, `SellSpell`, exact content and
  prices, state/authority/persistence, optional Skorcha, and teardown.
- Reproduction: all named Courtyard/private-room actors, ten Paintings, five
  Boasts, 26 books, eight Teacher rows, insufficient gold, Lace one-shot,
  representative Boast failures, automatic choice, and Wave 30 success.
## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail image | `SolomonDark.exe` 0.72.5, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, base `0x00400000` | Canonical analyzed executable. | high |
| Runtime data | `survival.txt` SHA-256 `5e792f4dc692667d0ecaa4e7304202f11d2d1cdc664820b97be83145fa3b2d67`; `books.txt` `d7ca0a36c2fe6af90a4a950d5ff3dab7638f43640de97684eb6a7583a02b24a1`; `spellfacts.txt` `1d78d408664ea830465e7e5a8b56df2c6373cb4f6685dc025a1a6d0f90ab0e17`; `narration.txt` `5a80f605f8fcac7fc634f8234d5b0a0173d3d4aa563dc076cc6d1b4dbc649174` | Complete runtime graph and selector/eulogy content. | high |
| Instructions | `0x005CC800`, `0x005CDC70`, `0x0050B720`, `0x00501800`, `0x004FB890`; Chat `0x004F5D90/0x004FFB00/0x004F9380`; selector and downstream functions in the native report | Construction, live rows, mutations, generated population, interruption, and teardown. | high |
| Native report | Mod Loader `docs/reverse-engineering/native-hub-npc-interactions.md` | Full causal trace and membership; supersedes the formerly open G6 content. | high |
| Current web trace | base `d35a1e54`; `hub-inventory-presentation.ts`, `HubInventoryUi.tsx`, renderer, simulation/protocol/save/Hall modules | Only `intro -> choices`, one action and one price answer exist; all three selector classes/effects and Skorcha are absent. | high |

## System boundary and membership inventory

Native system: named survival-Hub interaction from actor/Painting hit through
Chat, selector/service replacement, response and downstream mutation. Rows
marked exact-ported are the required closing disposition; the completed proof
is summarized in the implementation receipt below.

| Member | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| Hagatha intro/price/PerkShop | `WITCH_INTRO/WITCH_Q`, `!BUYPERKS` | exact-ported | catalog, graph tests, Mac browser |
| Fomentius intro/Shop | `POTIONGUY_INTRO`, `!BUYPOTIONS` | exact-ported | catalog, graph tests, Mac browser |
| Provokatus intro/five Boasts | `ANNAL_INTRO`; `0x004F7D20/0x004F99F0/0x004FC340` | exact-ported | five-row tests and Mac selector/auto-choice journey |
| Luthacus intro/InventoryShop | `SCAVENGER_INTRO`, `!INVENTORY` | exact-ported | catalog, graph tests, Mac browser |
| optional Skorcha, three placements/gestures/dismissals | type 5007; `0x0050B720/0x0050B1F0/0x0051C560`; College 510..516 | exact-ported | absent/present/three-placement tests and Mac variant-2 receipt |
| Machinimbus question/eight SellSpell rows | `TEACHER_INTRO/TEACHER_Q`; `0x004F82D0/0x004F8480/0x004F91D0` | exact-ported | row/price/rejection tests and Mac purchase/omission receipt |
| Declarius intro/two questions/dismissal | `MEMORATOR_INTRO/Q1/Q2/DISMISS` | exact-ported | graph tests and Mac room journey |
| Paintings `0,1,100,3,4,5,6,7,8,9` | `0x00506190/0x00506100`; narration | exact-ported | complete speech tests and ten-target Mac room journey |
| Semicus and 26 BookReview rows | `LIBRARIAN_INTRO`; `0x004FA090/0x004FC550/0x004FA290` | exact-ported | 26-row tests and Mac Lace present/absent receipt |
| Shlorio intro/price/Dowsing | `DOWSER_INTRO/DOWSER_Q`, `!DOWSE` | exact-ported | catalog, graph tests, Mac browser |
| Archchancellor intro/question/dismissal | `ARCH_INTRO/ARCH_Q/ARCH_DISMISS` | exact-ported | graph tests and Mac room journey |
| all five Boast failures, automatic choice, Wave-30 1.1 award | `0x005CB110`, `0x005CB810`, `0x00577760`, `0x0054CC50`, `0x0052B150`, `0x0066F920`, `0x005BC400` | exact-ported | kernel/integration tests and Mac automatic-choice receipt |
| Lace one-shot; Teacher unlocks 72..79 | profile `+0x105`; `0x00B3BDD8..DF` | exact-ported | save/protocol/action tests and Mac mutation receipts |
| Students / StoreRoom | no-op action / no actor | out-of-system (native noninteractive/no producer) | existing census |
| Solomon Dig / recipe `GameNPC` | separate Arena prelude / Boneyard scripting | out-of-system (separate systems) | existing reports |
| story Polisher/Annalist2/Arch variants | alternate builder `0x00513BE0` | out-of-system (Website survival mode) | static census |
| `ANNAL_Q`, `!RANDOMEQUIP`, targeted Dowsing | dormant data with no normal producer | out-of-system (unreachable retail behavior) | caller/dispatcher sweep |

No member is browser-blocked.

## Recovered behavioral contract

- `survival.txt` is runtime authority when retained per-speaker files differ.
  ExactText emphasis, spelling, punctuation, repeated/trailing spaces remain
  unedited.
- Chat scrolls answer -> questions or random dismissal. Regular answers return
  to questions; commands replace Chat; back/range/Region transition destroy the
  current owner.
- Boasts are exact indices 0..4. Potion use, magical equipment, any secondary
  dispatch, and strict mana underflow fail their respective rows once. Exact
  zero mana is not failure. Boast 3 auto-selects `Integer(option_count)` after
  100 ticks. Surviving Wave 30 latches success and Hall score becomes
  `trunc(float(score) * 1.100000023841858)` once.
- BookReview initially exposes 26 rows. Reading `BOOK25_LACE` persists the
  profile flag and removes only that row later.
- SellSpell exposes unowned IDs `72,73,74,75,79,78,77,76` for prices
  `3000,3500,4200,5000,5100,5300,6100,10000`. Purchase unlocks future
  acquisition, not a rank/binding. Empty membership reads
  `ALL SPELLS\nALREADY BOUGHT!`.
- Skorcha is present only on `Integer(3)==1`; the next draw chooses
  `(1437.5,732.5)`, `(1637,403.5)`, or `(669,705.5)`. A distinct one of three
  gestures is chosen every `Integer(10)+20` ticks. Courtyard authority rolls
  once per constructed Courtyard instance.

## Web implementation consequence

- Replace the flat definition with a generated, hash-pinned graph catalog and
  explicit Chat/selector state machine.
- Fresh render disassembly splits Skorcha's College `510..516` sheet exactly:
  gesture `+0x178` selects body records `510..512`, rounded common-animation
  phase `+0x144` selects hat records `513..516`, and actor `+0x17C` flips
  placement variant 1.
  The inherited hat sweep retains its `Integer(200)==2` start, randomized
  `0.45..1.8`-degree rate, sine index `0..4`, and blank index-4 apex.
- Live Mac traversal exposed the Painting ownership distinction already present
  in the stock callbacks: radius-15 Paintings sit behind paired radius-40
  solids, and `0x00506190 -> 0x00506100` starts Memorator speech rather than a
  Painting `Chat`. Pointer hit geometry therefore remains 15 while the web
  controller proximity adapter uses the paired 40; applying the ordinary
  radius-15 Chat teardown rule made every portrait unreachable.
- Keep Boast/Lace with participant economy lifetime, Teacher flags in the
  existing skill book, failures/success in authoritative simulation, Skorcha in
  Hub world state, and Hall bonus in the score owner.
- Render visible surfaces in the Pixi native stage; HTML remains aligned
  semantic controls/accessibility text. Preserve the existing direct trader HUD
  shortcuts and requested useful Provokatus shortcut.

## Validation contract

- Assert every graph line, five Boasts/failures/strict zero/auto choice/success,
  26 books/Lace, eight prices/unlocks/rejection/all-bought, every NPC/Painting,
  three Skorcha placements/gestures, authority/save/protocol, scrolling, return,
  back/range/Region teardown, and Hall receipt.
- Mac Chrome must traverse every named NPC and selector family, representative
  state mutations/failure/success, visible native surfaces, and empty page,
  console, and failed-response arrays.

## Implementation validation receipt

- Generated authority: `native-hub-npc-catalog.json` SHA-256
  `84a4d018489367bac9e05cafe404a8e42765ed4e3c7a68c24f67fc61010b49f3`;
  extracted `hub-npc-skorcha-frames.png` SHA-256
  `8c1892384b12148013c072a50e31d2ff0a6d16f4ceec6678229ca0862abd52c7`.
- Implementation owners: generated catalog/extractor; pure NPC dialogue and
  Skorcha kernels; economy/progression/simulation authority; protocol 71 and
  save schema 8; Chat/selectors/Notebox/Pixi presentation; extracted art;
  regression and browser acceptance tools.
- Focused Mac proof: all 55 NPC/Hub UI tests; strict primary/secondary mana
  boundaries; all five Boast mutation families; Wave-30/Hall award; protocol,
  replication, save migration, and present/absent Skorcha tests. The complete
  Boneyard group and its prerequisite group passed.
- Hardware-browser proof: arm64 macOS 26.6.2, Chrome 151, WebGL2
  `ANGLE Metal Renderer: Apple M2`. One continuous journey opened all 20
  interaction targets, all three selectors, every question/dismissal, all ten
  Paintings, Skorcha variant 2, a Teacher purchase/row omission, Lace
  present-then-absent, and Provokatus's host-selected automatic card after
  2,106 ms. Page-error, console-error, and failed-response arrays were empty.
- Screenshot family: `/tmp/solomon-dark-hub-npcs-*.png` on the acceptance Mac,
  including Boast, automatic picker, Teacher, Lace, Skorcha, Painting 100, and
  Archchancellor frames. The coordinate correction added independent
  `sdr-npc-coordinate-v{0,1,2}-skorcha.png` frames.
- Canonical gate: the final Mac `./scripts/validate.sh` ran through production
  media policy with no failures: backend/contracts tests; every supported
  frontend and desktop group; production frontend and game-host builds; and a
  game entry below the `131072`-byte gzip budget.
- Explicitly out of scope: story-campaign actors and recipe-authored Boneyard
  `GameNPC`, dispositioned above.

## Skorcha coordinate-order correction

The post-publication residual sweep falsified the first two placement rows.
`0x0050B720` writes actor X at `+0x18` and Y at `+0x1C`, but the earlier table
read each pair in ascending global-address order. Raw float dumps establish:

| Variant | X writer/value | Y writer/value | Correct position |
| ---: | --- | --- | ---: |
| 0 | `0x00792F8C = 1437.5` | `0x00792F88 = 732.5` | `(1437.5,732.5)` |
| 1 | `0x00792F94 = 1637` | `0x00792F90 = 403.5` | `(1637,403.5)` |
| 2 | `0x00792454 = 669` | `0x00792F98 = 705.5` | `(669,705.5)` |

All three are ordinary resident coordinates in the normal Courtyard camera
bank. Implementation must regenerate the catalog, thereby moving authoritative
collision, interaction, snapshot/save state, and Pixi presentation together.
Closure requires explicit non-circular coordinate assertions plus separate
Mac Metal browser conversations at variants 0, 1, and 2; the former variant-2
journey alone is insufficient proof of complete placement membership.

The corrective Mac run used deterministic host seeds `3`, `16`, and `2` for
variants 0, 1, and 2 respectively. Each journey navigated to the replicated
position, exposed the `hub:skorcha` prompt, opened Skorcha's authored Chat, and
captured the matching variant. All three used Pixi WebGL on the Apple M2 Metal
renderer, with empty page-error, console-error, and failed-response arrays.

## Conditional-NPC and Courtyard-lifetime reopening

The follow-up discoverability audit found that the earlier pass recovered
Skorcha's presence draw but stopped at actor construction and assigned it the
whole-Hub/save lifetime. Stock Region ownership disproves that lifetime:
`Courtyard` constructor `0x00514EE0` calls the survival builder `0x0050B720`
whenever the Region is reconstructed, and the builder performs the two
Skorcha draws each time. Region actors are not durable profile state.

Fresh canonical Ghidra evidence closes every apparent normal-Hub actor gate:

| Member | Native gate/lifetime | Required web disposition |
| --- | --- | --- |
| Professor Semicus | Unconditional Library case `0xFA4`, center `(512,595)`; all 26 book rows start available in survival | Always present; only one-shot Lace is later removed |
| Skorcha/Tyrannia | Each Courtyard construction creates her only when `Integer(3)==1`, then draws one of three placements | One host-authoritative Courtyard-instance population, rerolled on reconstruction |
| Professor Machinimbus | Builder call `0x0050BD0C` reaches `0x004736D0`, exactly `MOV AL,1; RET` | Always present; only the eight spell-offer rows are progression-gated |
| Second initializer branch | `0x00461F60` is exactly `XOR AL,AL; RET`; guarded `0x005001E0` is not an actor factory | Not an NPC gate |
| Provokatus/Fomentius/Luthacus flag bytes | `0x0081A3CA..CC` affect action bubbles; wrappers `0x005018A0/B0/C0` clear them and enter common Chat | Presentation hints, not actor or service unlocks |
| Polisher/alternate Annalist/Arch variants | Separate story builder `0x00513BE0`, selected by `Gameplay+0x1CD8` | Out of the normal survival-Hub census; do not inject as unlocks |

The production host already supplies a random authoritative Hub seed, so the
initial web Courtyard and every post-run Hub construction perform the correct
one-in-three draw. The remaining mismatch is lifecycle: `HubWorldState.skorcha`
survives participant room changes, and Hub save restore explicitly preserves
it, even though both paths reconstruct the stock Courtyard.

The first lifecycle browser run then exposed the downstream half of the same
assumption: renderer/controller sampling followed the current replicated
Skorcha, but `HubInventoryUi` received position and dismissal from
`hubInitialSnapshot`. A valid null-to-present reconstruction therefore rendered
and navigated to Skorcha while withholding the semantic interaction prompt.
The UI projection must follow the latest host snapshot as population changes.

The shared-Hub adaptation treats a Courtyard as live while at least one
participant occupies it. Its Skorcha result remains stable and shared during
that occupancy epoch. The last participant leaving destroys the optional
actor; the next zero-to-one Courtyard occupancy edge performs a fresh
host-authoritative draw. Hub resume also reconstructs rather than restores the
serialized optional actor. Snapshots continue to replicate only the current
authoritative result, and clients never draw locally.

Closure requires focused assertions for unconditional Semicus/Machinimbus,
initial absent/present and all three Skorcha placements, multiplayer occupancy
retention, last-exit teardown, return-entry reroll, Hub-resume reconstruction,
dynamic collision/interaction, and current snapshot validation. Mac Chrome
must prove Semicus directions plus absent-to-present Courtyard re-entry and all
three visible Skorcha placements with empty page, console, and network errors.

The closing implementation keeps a private native-RNG population stream on the
host Hub, tracks whether the shared Courtyard population is constructed, and
applies the zero-to-one occupancy rule in participant add/remove and Region
transition paths. Hub resume draws a new Courtyard seed from the saved game RNG
and advances that RNG instead of restoring the serialized optional actor.
`HubScene` now projects Skorcha interaction position/dismissal from current
snapshots, closing the null-to-present prompt defect.

On the manifest-identical Mac candidate, the registered Loader suite passed
`499/499`; `./scripts/validate.sh` passed 22 backend/contracts tests, all
frontend/desktop groups including 59 Hub UI tests and 1,491 Boneyard tests,
production builds, media policy, and bundle budget. Chrome 151 on Apple M2
Metal completed an initial-absent seed-0 journey through the Library and back
to visible/talkable variant 0, a continuous all-20 interaction journey through
Semicus, Machinimbus, Provokatus, every Painting, and the Archchancellor, plus
independent variant-1 and variant-2 conversations. Every final receipt had
empty page-error, console-error, and failed-response arrays; the Semicus,
Provokatus, lifecycle variant-0, variant-1, and variant-2 captures were visually
inspected.

## Timed shared-Hub conditional NPC policy

This user-directed Website policy intentionally supersedes stock Courtyard-
entry timing without reclassifying it as native parity. Skorcha remains the
only conditional named survival-Hub actor. Her initial presence still uses the
stock one-in-three draw, but the long-lived shared Hub then alternates between
visible and absent phases. Each phase independently draws an inclusive
`20..40` minute duration from the host's fixed-tick population RNG, giving a
30-minute midpoint without wall-clock or client ownership.

The timer belongs to the shared Hub world, not Courtyard occupancy or any
participant. It advances while players are in any Hub room and changes phase
on the exact authoritative tick even when someone is standing beside or
talking to Skorcha. A visible-to-absent edge removes render state, collision,
prompt, and every active local Skorcha Chat immediately. An absent-to-visible
edge chooses one of the three recovered placements and publishes it in the
same snapshot. All clients observe the same phase; no client timer or reroll is
permitted. A new Hub/session creates a fresh schedule; player save documents
do not own this shared-world timer.

Progression does not gate actor visibility. Semicus, Machinimbus, and every
other fixed survival-Hub NPC remain visible to all residents. Instead, all
stateful NPC and trader services remain participant-private:

| Owner | Participant-private state |
| --- | --- |
| Hagatha | gold, owned perks, bundle/first-mix flags, one-shot runtime |
| Fomentius | stock, purchases, backpack contents, gold |
| Provokatus | selected Boast, one-shot failure, success and score effect |
| Luthacus | backpack/equipment transfer and Scavenged Goods storage |
| Machinimbus | gold and advanced spell unlock rows; a new player sees the default eight-row state |
| Semicus | Lace-read flag and resulting 26/25-row BookReview membership |
| Shlorio | fee, paid offer list, purchase and gold |

Every action is addressed to the authenticated participant's entity/economy.
Joining an existing shared Hub constructs fresh default state and may not copy
another resident's purchases, unlocks, offers, storage, Boast, or Lace flag.
Dialogue focus remains local presentation state.

Closure requires deterministic minimum/maximum timer tests, both phase edges,
all three appearance placements, shared snapshot equality, immediate mid-Chat
teardown, collision/prompt removal and restoration, and a two-player mutation
matrix covering every stateful service above. Browser acceptance must observe
both instant phase changes under accelerated test windows plus the complete
NPC/trader journey with empty page, console, and failed-response arrays.
The accelerated host fixture must construct `SharedGameWorlds.hub` itself;
configuring an unused standalone simulation while the global Hub selects a
separate random world is a false receipt even if readiness echoes the requested
timer values.

### Timed-policy implementation validation receipt

- The authoritative Hub now owns an alternating Skorcha schedule. The initial
  stock one-in-three result is retained, each later phase draws an inclusive
  `120000..240000` fixed-tick duration, and absent-to-present edges choose one
  of the three recovered positions without another presence veto. Courtyard
  occupancy, player admission, and private-room transitions do not reroll or
  pause the clock. Actor state, fixed collision, snapshot presence, prompt, and
  active local Chat change on the same edge.
- Focused coverage pins both duration endpoints, invalid fixture durations,
  both phase edges, all three placements, animation continuity, zero-player and
  private-room ticking, same-tick collision membership, player-save exclusion,
  and identical per-client Skorcha snapshots. A global-Hub host test proves the
  accelerated fixture constructs `SharedGameWorlds.hub`, closing the false
  standalone-fixture receipt found during browser acceptance.
- The authenticated-player mutation matrix purchases Hagatha and Fomentius
  rows, transfers through Luthacus, selects a Provokatus Boast, reads Semicus's
  Lace row, buys Machinimbus skill 72, and pays Shlorio for offers. Every step
  preserves the second resident's economy, progression, and skill-book objects;
  a later join receives 500 gold, empty purchases/storage/offers/Boast/Lace
  state, and all eight advanced-unlock flags false. A separate real
  three-client `global-hub` host test sends Provokatus and Machinimbus actions
  through the first authenticated socket, observes the first player's mutation
  in both resident snapshots while the second stays default, then proves the
  third player's welcome carries fresh defaults.
- On the manifest-identical candidate rebased over `e35c6369`, the complete Mac
  gate passed 22 backend/contracts tests, every frontend and desktop group,
  1,536 Boneyard tests, 77 Hub UI tests, both production builds, media policy,
  and the `132182`-byte gzip game entry under the `133120`-byte limit.
- Mac Chrome `151.0.7922.174` on Apple M2 Metal observed real `global-hub`
  absent-to-present
  edges for seeds `4`, `0`, and `1`, producing variants `0`, `1`, and `2` at
  their exact positions after 3,000-tick hidden fixture phases. Seed `3` then
  removed variant 0 during an open `ENFORCER_INTRO` Chat after a 6,000-tick
  visible phase; the actor, Chat, and Skorcha prompt were absent in the next
  observed frame.
- A separate production-duration journey, with no timer override, opened all
  20 interaction targets and
  completed every service/selector family: Provokatus's five Boasts and
  1,597-ms host automatic choice, Machinimbus skill-72 purchase/row removal,
  Semicus Lace removal, all traders, Skorcha, Memorator, ten Paintings, and the
  Archchancellor. Every timer and full-census receipt had empty page-error,
  console-error, and failed-response arrays; all three placement frames, the
  before/after disappearance pair, and the stateful selector captures were
  visually inspected. No member is blocked by the browser platform.
- The same production build passed the fresh-profile marker lifecycle through
  interaction, room reconstruction, schema-11 persistence, leave-game, and
  `Last game` resume with help flags `0111111111`. A separate shared-Hub
  memorial journey published portrait 100, rendered it in Mac Chrome, and
  proved a late join received the same portrait at memorial age 1002. Both
  journeys had empty page-error, console-error, and failed-response arrays, and
  their captures were visually inspected.
