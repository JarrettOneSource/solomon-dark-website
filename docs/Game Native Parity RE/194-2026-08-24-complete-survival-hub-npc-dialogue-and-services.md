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

## 2026-08-29 — Boast Notebox notification lifecycle correction

### Reported smell and parity question

- Reported web behavior: Provokatus's Boast instruction and failure are shown
  as a full-screen `alertdialog` with an `OKAY` button. The surface blocks the
  player's local controls until clicked while authoritative gameplay continues.
- Stock behavior to recover: Boast creates a transient `Notebox` notification
  over the live game. It expires automatically, never acquires the gameplay
  suspension owner, and uses a short red/buzzer failure variant.
- This is a secondary report against the earlier complete-Hub-NPC entry. That
  pass recovered Boast state and every failure producer but stopped at the text
  payload, labeled a guessed modal Notebox as parity, and did not trace the
  native `Notebox` constructor/update/render/input/audio xrefs. The skipped
  presentation/lifecycle owner caused the defect.
- Falsifiers: any native modal-loop or `Gameplay+0x80` suspension call; a
  required acknowledgement; no automatic expiry; a generic HTML panel/font;
  failure without the buzzer; replaying an old failure after rejoin; or one of
  the four failure producers retaining the blocking path.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| User stock/web comparison | feature report, 2026-08-29 | The original is a non-invasive live-game overlay/notification; the Website requires a click while the game does not pause. | authoritative |
| Retail identity | `SolomonDark.exe` 0.72.5, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Exact pinned retail image used for every address below. | high |
| Fresh read-only instructions | canonical Ghidra `SolomonDark/SolomonDark.exe`; Mod Loader tool revision `08bfba9ef367f7b863848030d0a289dc31e33192`; wrapper SHA-256 `b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49` | `Notebox` vtable `0x007906DC`; ctor `0x004F63D0`; layout `0x004F6530`; update `0x004F5370`; render `0x004F6740`; pointer-down shortener `0x004F6470`. No modal runner or gameplay suspension call appears in the owner thread. | high |
| Instruction producer | `Chat` teardown `0x004FCB40`, string `0x00791378` | A selected Boast spawns a standard Notebox containing `To succeed at your boast, you must\nsurvive until at least Wave 30`. It has the full native hold and no buzzer. | high |
| Failure owner/xref sweep | common failure `0x005CB110`; all refs from `0x0052B150`, `0x0054CC50`, `0x00577760`, `0x005CB810` | Mana underflow, secondary cast, potion use, and magical-equipment paths all enter the same one-shot failure constructor. It formats `FAILED \"%s\"`, sets the red variant, halves the hold, and plays one stream. No fifth caller exists. | high |
| Timing instructions/data | `0x004F6530`, `0x004F5370`; timing scale `0x00820230=100`; doubles `10`, `0.1`, `0.05` | Standard hold starts at 1,000 ticks; failure arithmetic-shifts it to 500. Alpha rises by 0.1 for 10 ticks, then after the hold falls by 0.05 for 20 ticks: approximately 10.2 s standard and 5.2 s failure. Pointer down sets the hold to zero; it is optional because expiry is automatic. | high |
| Geometry/render instructions | `0x004F6530`, `0x004F6740`; UI record `64`; Fonts group 3 | Text bounds are centered at native `(800,250)` and expanded by 35 px on every side. UI.64 is drawn by the mirrored nine-slice helper in 0.85 and 0.15 passes. Standard text is RGB `(0.85,0.73,0.44)`; failure multiplies panel/text by `(1,0.25,0.25)`. Text uses the exact 92-glyph/210-kerning menu font. | high |
| Exact assets | `UI.bundle` SHA-256 `1db00ea8826e787ca9a320c90a33e726991cae00906baddfdc8bde31da697498`, UI.64 atlas frame `(213,392,28,28)`; `Fonts.bundle` SHA-256 `048aa22cc715ee633f5e31f0400b4a3a9c0a8c8b49d681419e19d5ff676c214a`; audio registry `DAT_008199D8+0x133C` | The Website already owns exact UI.64 and Fonts group 3. Failure plays `sounds\\buzzer__stream.wav`, `SoundStream`, SHA-256 `19c010bb56690b3f7808a0f71ae639ab8d033e0ea1e31637ac688da957f3e844`, at gain 1/restart semantics. | high |
| Current Website trace | exact base `0c5f1577c9cce0bfab5ad188e5830d992848a051`; `HubInventoryUi.tsx`, `HubScene.tsx`, `BoneyardScene.tsx`, `hub-inventory.css` | One string state portals a full-screen pointer-active dialog, publishes `onBlockingOverlayChange`, adds the notice to both scenes' modal predicates, exposes a focusable button, never auto-expires, and plays no failure stream. | high |

All Ghidra addresses are preferred-image VAs. The wrapper leased a read-only
replica with `-noanalysis`; no Mod Loader file or canonical project was changed.

### System boundary and membership inventory

Native system: **Boast-owned Notebox notification**, from instruction/failure
production through exact transient presentation, optional early dismissal,
audio, automatic expiry, save/rejoin behavior, and teardown.

| Member / branch | Native source | Disposition | Required proof |
| --- | --- | --- | --- |
| Post-selection Boast instruction | `0x004FCB40`, string `0x00791378` | `exact-ported` | gold UI.64/group-3 Notebox, 10.2-s automatic lifetime, no sound or blocking owner |
| Potion-use failure, Boast 0 | `0x00577760 -> 0x005CB110` | `exact-ported` | red five-second failure notification plus buzzer, once |
| Magical-equipment failure, Boast 1 | `0x005CB810 -> 0x005CB110` | `exact-ported` | same shared presentation/audio/lifetime |
| Secondary-cast failure, Boast 2 | `0x0054CC50 -> 0x005CB110` | `exact-ported` | same shared presentation/audio/lifetime |
| Automatic-choice Boast 3 | selection/picker path, no `0x005CB110` caller | `verified-already-at-parity`, no failure Notebox | automatic selection remains; instruction Notebox still applies after selection |
| Mana-underflow failure, Boast 4 | `0x0052B150 -> 0x005CB110` | `exact-ported` | strict negative-underflow producer retains one shared notification |
| Wave-30 success and 1.1 score award | `0x005BC400`, no Notebox call | `verified-already-at-parity`, out of notification branch | success remains silent and score-owned |
| Standard panel/text style | UI.64, Fonts group 3, normal color path | `exact-ported` | exact nine-slice/font/geometry and 100-ms reveal |
| Failure panel/text style and audio | red branch at `0x005CB173`; audio `+0x133C` | `exact-ported` | exact red multiplier, 500-tick hold, 200-ms fade, buzzer stream restart |
| Optional pointer-down lifetime shortening | vtable slot `+0x64 -> 0x004F6470` | `exact-ported` within the small panel | may begin fade early; no full-screen hit target or required click |
| Hub instruction over live world | `Chat` teardown owner | `exact-ported` | dialogue closes; Hub movement/presence continues beneath notification |
| Arena failure over live world | common gameplay producers | `exact-ported` | simulation and ordinary gameplay input continue; notification is presentation-only |
| Persisted failed Boast on save/rejoin | native flags serialize, Notebox object does not | `verified-already-at-parity` with corrected presentation | current failure sequence seeds the client baseline and does not replay old transient UI/audio |
| New Boast/run reset, scene/route teardown | native one-shot/reset and CPU destruction | `exact-ported` | pending timer/audio owner retires without blocking or leaking into the next wizard |

No member is blocked by the browser platform.

### Native ownership thread and recovered behavioral contract

- `Notebox` is an ordinary transient CPU/presentation object. Construction and
  render do not enter `0x004281F0`, `0x005CBD40`, or any modal exclusion owner.
- Both producers configure one centered text box at offset `(0,-200)` from the
  1600x900 center. The shared renderer uses UI.64 mirrored nine-slice bounds
  and Fonts group 3; failure changes tint/lifetime/audio, not ownership.
- Application presentation ticks drive reveal, hold, and fade while the world
  continues. The notification owns no network state beyond the already
  replicated Boast failure sequence and cannot block authoritative input.
- Only the notification's own compact bounds accept optional early dismissal.
  There is no `OKAY` action, keyboard focus owner, curtain, or full-screen hit
  surface. Automatic expiry is always sufficient.
- Save documents retain Boast selection/failure/success, never the transient
  Notebox or buzzer channel. A new client baselines the current sequence and
  observes only a later failure edge.

### Confidence and open questions

- Confirmed: complete constructor/update/render/vtable thread, every producer,
  all five Boast rows, timing, geometry, tint, exact UI/font/audio assets,
  pointer behavior, non-modal ownership, persistence, and teardown.
- Inferred: none used for implementation.
- Unknown: none material.

### Web implementation consequence

- Replace the full-screen `NativeNpcNotebox` dialog with one reusable
  transient Notebox presentation that uses `NativeUiNineSlice` UI.64 and
  `NativeBitmapText` menu font at native geometry.
- Store notice kind/sequence, drive the exact automatic lifetime and optional
  panel-local early fade, and expose noninteractive status semantics instead
  of `alertdialog`/`OKAY`.
- Remove `onBlockingOverlayChange`, both scene-local Notebox modal flags, and
  every resulting input/modal gate. Boast notification must not request or
  simulate pause.
- Add the exact buzzer WAV as a resident `SoundStream` cue and play it only on
  a newly observed failure sequence. Do not replay persisted failure state.
- Remove the superseded invented full-screen panel/button CSS and smoke steps.

### Validation contract

- Focused tests: exact timing/envelope/geometry/style contracts; all four
  failure producers and automatic/success negatives; one-shot sequence; exact
  UI/font/audio registry/hash; no full-screen hit/modal callback/button; old
  failure baseline suppression; route/reset cleanup.
- Mac Chrome: select a Boast and let its instruction expire without clicking
  while Hub ticks/movement continue; trigger one Arena failure and prove the
  red panel, buzzer restart, local input, player/enemy/wave ticks, automatic
  expiry, and no page/console/network errors. Optional panel click may shorten
  only that notice.
- Stock-versus-web comparison: match native 1600x900 position, panel bounds,
  colors, reveal/fade frames, text, and audio using the pinned retail contract.
- Exact candidate: byte-identical Mac worktree and canonical
  `/opt/homebrew/bin/bash ./scripts/validate.sh` before completion.

### Notebox implementation validation receipt

- `NativeNotebox` now owns the shared stock presentation contract: UI.64
  mirrored nine-slice, exact group-3 bitmap text, native `(800,250)` center and
  35-pixel expansion, normal gold versus `(1,0.25,0.25)` failure tint,
  100-ms reveal, 10.2/5.2-second automatic lifetimes, 200-ms fade, and optional
  panel-local pointer shortening. The full-screen `alertdialog`, `OKAY` button,
  invented CSS panel, and both scene modal/input flags are removed.
- A newly observed Boast failure restarts the resident
  `sounds\\buzzer__stream` channel at registry offset `0x133C`. The tracked
  `buzzer.wav` is byte-identical to retail at SHA-256
  `19c010bb56690b3f7808a0f71ae639ab8d033e0ea1e31637ac688da957f3e844`;
  the extraction script and registered test pin that identity. Existing
  sequence baselining prevents save/rejoin replay.
- Focused contracts cover exact geometry/envelope/colors, UI/font/audio rows,
  all four existing failure producers, the automatic/success negatives, and
  source scans that forbid reintroducing a blocking callback, dialog, button,
  or full-screen hit surface. The registered Hub UI group and complete
  canonical Mac gate pass with the new test and binary asset.
- Mac Chrome 151 selected potion Boast 0 through Provokatus, closed Chat, and
  rendered the standard Notebox while Hub tick, presentation, movement, and
  the interaction prompt remained live. It expired without a click. The same
  wizard entered a real Arena, drank the starter potion, rendered the red
  `FAILED` Notebox, restarted the exact buzzer buffer once, accepted ordinary
  gameplay input, advanced the authoritative world throughout, and expired
  automatically. Page, console, failed-response, and host-error arrays were
  empty.
- Visual inspection confirms the compact stock-style panels over retained
  worlds with no curtain or modal chrome. Instruction/failure frame SHA-256
  values are `ad3eb65108ba0b7cf1f4a990af64b9cd23949474702a5a44aa0389cb313ccd60`
  and `8aa6f509e45512a195c119674529326039fcfa181edc5821547d18175e99b5ee`.
  Every Notebox/Boast member is dispositioned; no platform exception or open
  question remains. Push to `main` is authorized; deployment is not implied.

## 2026-08-30 — Boast failure-title payload correction, third reopen

### Reported smell and parity question

- The supplied Website frame still shows the pre-correction blocking
  acknowledgement, while the supplied stock footage shows a compact red
  failure Notebox over continuously live Arena play.
- Fresh production testing establishes that deployed revision
  `984f07e2449993a0595b435f653f1257563e8a98` now owns the corrected non-modal
  Notebox lifecycle, but exposes a second defect: failure text is the long
  selector statement instead of the short authored Boast title visible in
  stock.
- This is the third report against the Boast system. The 2026-08-29 pass traced
  Notebox ownership, timing, geometry, input, and audio, but accepted
  `nativeBoastFailureText -> boast.statement` without tracing which of the
  three native Boast string arrays feeds `Game+0x1D48`. That incomplete field
  trace made the validation screenshot look stock-like while its payload was
  wrong.
- Falsifiers: `0x005CB110` reading the long-statement array directly; any
  failure producer selecting a different payload field; Boast 3 owning a
  failure path; or stock rendering the selector statement rather than the
  title.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Supplied Website frame | `boast 1 - image.png`, 1438x806, SHA-256 `e85d2ad9e7195328987f692777e928c507dece6da2bb2aed94cefe1378d79ba4` | Pre-correction Website failure used the blocking `OKAY` acknowledgement and the long mana statement. | high |
| Supplied stock menu | `boast 2 - image.png`, 532x457, SHA-256 `7e97c6ff9a5d626667677c029650eb689fa796170b9cb053b74f52e08417c02b` | Stock distinguishes the short uppercase title from the quoted long selector statement for every visible row. | high |
| Supplied clean-stock failure | `boast 3 - SolomonDark 2026-08-29 21-54-45.mp4`, 1600x900, 4.5759 s, SHA-256 `33f1804f879577a154a23dc1070a4d23102fd9be0ac64293ee2fa0be132bc29e` | Drinking the potion produces `FAILED "POTIONS ARE FOR PEASANTS!"` at native center `(800,250)` while actors continue updating beneath it. It does not display the long potion statement. | authoritative |
| Fresh production Chrome | Mac Chrome 151 against `https://solomondarker.com/game`, deployed revision `984f07e2`, 2026-08-30 | A production-safe anonymous journey selected Boast 0, proved the instruction Notebox was non-modal, accepted movement, and auto-expired. In the Arena the potion failure reached the red Notebox with `data-native-notebox-text='FAILED "I can do this entire mission without drinking a single potion of any kind!"'`, directly reproducing the residual payload defect. Page, console, and failed-response arrays were empty on that reproducing run. | high |
| Retail identity and tooling | `SolomonDark.exe` 0.72.5, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; preferred base `0x00400000`; read-only replica 3; Mod Loader revision `08bfba9ef367f7b863848030d0a289dc31e33192`; wrapper SHA-256 `b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49` | Canonical project and wrapper provenance for the fresh instruction trace. | high |
| Authored Boast arrays | `FUN_004F99F0`; title strings `0x0079115C`, `0x00791140`, `0x00791128`, `0x0079110C`, `0x007910F0`; statements `0x007910A0`, `0x00791050`, `0x00791014`, `0x00790FD0`, `0x00790F88` | `BoastBox+0xDC` is the complete five-title array; the separate `+0xEC` array owns the five quoted selector statements. | high |
| Selection field write | `FUN_004FC340`, instructions `0x004FC395..0x004FC3B4`; BoastBox subobject at Boast `+0x140` | Selected index reads Boast `+0x21C/+0x220` (`+0x140 + title-array +0xDC/+0xE0`) and assigns that title String to `Game+0x1D48`. Response-key dispatch is a separate switch. | high |
| Shared failure formatter | `FUN_005CB110`, instructions `0x005CB197..0x005CB1C5`; callers `0x0052B150`, `0x0054CC50`, `0x00577760`, `0x005CB810` | The formatter reads the String payload at `Game+0x1D4C` and applies `FAILED "%s"`. Therefore all four failure producers use the selected short title and add their own quotes. | high |

One intervening production attempt received an unrelated `/api/game/hub` 502
and was excluded from Boast evidence; the reproducing run above had empty
network-error arrays.

### System boundary and membership inventory

Native system: **Boast failure payload selection**, from the complete authored
title/statement tables through selected-title storage and the shared Notebox
formatter for every failure producer.

| Member / branch | Native source | Disposition | Required proof |
| --- | --- | --- | --- |
| Boast 0 potion failure | title `0x0079115C`; `0x00577760 -> 0x005CB110` | `exact-ported` | `FAILED "POTIONS ARE FOR PEASANTS!"` |
| Boast 1 magical-equipment failure | title `0x00791140`; `0x005CB810 -> 0x005CB110` | `exact-ported` | `FAILED "I'M TOO MACHO FOR MAGIC!"` |
| Boast 2 secondary-cast failure | title `0x00791128`; `0x0054CC50 -> 0x005CB110` | `exact-ported` | `FAILED "SECONDARIES ARE SISSY!"` |
| Boast 3 automatic choice | title `0x0079110C`; no `0x005CB110` caller | `verified-already-at-parity`, no failure payload | automatic choice and silent failure branch remain unchanged |
| Boast 4 mana-underflow failure | title `0x007910F0`; `0x0052B150 -> 0x005CB110` | `exact-ported` | `FAILED "I NEVER RUN OUT OF MANA!"` |
| Five quoted selector statements | `0x007910A0..0x00790F88`, BoastBox `+0xEC` | `verified-already-at-parity` | remain selector detail/speech content and never feed failure text |
| Instruction Notebox, success/score, persistence, reset, presentation, audio | prior complete membership | `verified-already-at-parity` | payload correction does not alter lifecycle, replication, save, or rendering owners |

No member is blocked by the browser platform.

### Native ownership thread and recovered contract

- `FUN_004F99F0` constructs parallel title, quoted-statement, and explanation
  arrays. `FUN_004FC340` copies only the selected title into the Gameplay-owned
  String at `+0x1D48`, independently dispatches `ANNAL_*BOAST`, and retains the
  existing instruction-Notebox handoff.
- Each of the four failure triggers enters `FUN_005CB110` once. That common
  owner reads the selected title, wraps it with `FAILED "..."`, marks the
  one-shot state, applies the red/short-lifetime Notebox variant, and starts
  the buzzer stream. Boast 3 has no failure caller.
- Title and statement are both authored truth, but have different consumers.
  The Website catalog remains correct; only its failure-text consumer crossed
  those fields.

### Confidence and open questions

- Confirmed: all five titles, all five statements, selected-title field write,
  common formatting string, all four callers, stock visual payload, current
  production mismatch, and the unchanged Notebox lifecycle.
- Inferred: none used for implementation.
- Unknown: none material.

### Web implementation consequence

- Keep `statement` as selector detail and change the shared failure formatter
  to quote `label` exactly once.
- Replace the statement-based expectation for every producer, not only the
  reported potion row. Strengthen the browser smoke to assert the exact short
  potion title while retaining non-modal movement, buzzer, and expiry checks.
- Do not change Boast state, protocol/save shape, presentation geometry,
  timing, audio, or success scoring.

### Validation contract

- Focused Mac tests must assert exact title-based output for all four failure
  producers and prove Boast 3 still has no failure path.
- Mac Chrome must select Boast 0, let the instruction expire while moving,
  enter a real Arena, drink the starter potion, observe the exact short-title
  failure, buzzer, unblocked input/world progress, and automatic expiry.
- The exact candidate must pass `/opt/homebrew/bin/bash ./scripts/validate.sh`;
  production remains separately uncorrected until an authorized publication
  and deployment.

### Implementation validation receipt

- `nativeBoastFailureText` now quotes the selected Boast `label`; the five
  quoted `statement` rows remain unchanged as selector detail. The existing
  all-row producer loop now pins the exact title output for potion,
  magical-equipment, secondary-cast, and mana-underflow failures and retains
  the no-failure Boast-3 branch.
- The registered browser smoke now asserts
  `data-native-notebox-text='FAILED "POTIONS ARE FOR PEASANTS!"'` before its
  existing buzzer, unblocked-input, advancing-tick, screenshot, and automatic
  expiry checks.
- The candidate was rebased onto `origin/main`
  `a554ea7368a1c93c07661f9ad01e7a93b528f888` and transferred to a detached Mac
  worktree with byte-identical SHA-256 manifests for all changed files.
- Mac focused receipt: `npm run test:hub-ui` passed all 85 tests. The first
  canonical `/opt/homebrew/bin/bash ./scripts/validate.sh` receipt exited zero;
  its broad frontend suite passed 1,779 tests, production frontend/game-host
  builds passed, the game entry was 266,211 raw / 80,891 gzip bytes within
  budget, and production media policy passed.
- Mac Chrome `151.0.7922.174` completed the full registered Hub/Arena journey
  with `status: ok` and `failedResponses: []`. The instruction remained
  non-modal and auto-expired over live Hub movement. Potion use then rendered
  the exact short-title red failure Notebox, restarted the buzzer, kept
  gameplay input and authoritative ticks live, and auto-expired.
- The 1600x900 instruction and failure frames were visually inspected. Their
  SHA-256 values are
  `aac78e78c54d7f72a0bed83896e78dcfee5e43be0090661df91918cc761125cf`
  and
  `89d919fe6566b139a7c711563fd4a674684a3187cb5c21a17abd8545c9f726d7`.
  The failure frame matches the supplied stock title, centered compact panel,
  retained live world, and absence of acknowledgement chrome.
- No browser-platform exception or material unknown remains. The implementation
  is local and uncommitted; it has not been pushed or deployed. The deployed
  `origin/main` tree therefore still carries the long-statement payload until
  a separately authorized publication and deployment.

## 2026-08-31 — BoastBox visual-owner recovery and mod-extension reopening

### Reported smell and parity question

- The Website currently routes `Boast`, `BookReview`, and `SellSpell` through
  one generic five-row Chat selector. That preserves the five Boast choices and
  their downstream mutations, but it omits the stock Boast-specific button
  chrome, paired silhouette art, two-font row treatment, hover/selection tint,
  outer frame geometry, title placement, and selection fade.
- The requested target is the complete stock `Boast` presentation plus a
  Website-owned extension seam that lets admitted Web Lua mods add Boasts
  without changing the retail numeric `0..4` ABI or pretending that arbitrary
  mod content is portable to a retail save.
- Falsifiers: a caller-independent generic selector renderer; a different UI
  sprite bank; one icon instead of mirrored left/right copies; one text array
  or font for both row lines; a row pitch other than 90; selection committing
  immediately; or more than five stock rows in retail.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | `SolomonDark.exe` 0.72.5, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, image base `0x00400000` | Canonical executable for every address and constant below. | high |
| Read-only analysis | Mod Loader `08bfba9ef367f7b863848030d0a289dc31e33192`; `scripts/Invoke-GhidraHeadless.ps1` SHA-256 `b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`; replica 3; `decompile_targets.py`, `dump_function_instructions.py`, `dump_function_data_refs.py`, `dump_floats_at.py`, `trace_call_arguments.py` | Fresh constructor, vtable, callsite, instruction, scalar, and asset-consumer recovery without modifying the shared Ghidra project. | high |
| Stock construction | `Boast::Boast 0x004F7D20`; `BoastBox::BoastBox 0x004F6C00`; row builder `0x004F99F0`; factory/callsite `0x004FB890` | The outer `Boast` owns an embedded `BoastBox` at `+0x140`, five Button children, three parallel authored String arrays, and fixed `700x560` outer geometry. | high |
| Stock rendering | outer `0x004F7BA0/0x004F7DC0`; `BoastBox::Render 0x004FDEC0`; shared nine-slice `0x00417760`; UI assets at singleton fields `+0x08A4`, `+0x2680`, and array `+0x40BC` | Outer frame is UI 11, every row frame is UI 50, and row `i` draws UI `90+i` at both ends with the right copy mirrored. | high |
| Asset construction/census | UI builder `0x004F3590`; Mod Loader `docs/reverse-engineering/native-atlas-consumers.json`; Website `native-ui-assets.json` | `+0x40BC` is an eight-entry authored bank, UI records 90..97. Retail currently constructs five rows and consumes records 90..94. | high |
| Interaction/lifecycle | `BoastBox` vtable `0x00790794`; `Boast` vtable `0x00790A24`; box action `0x004F7FE0`; outer action `0x004FC340`; update `0x004FFD50` | Hover/selection is box-owned; selection copies the row index, dispatches the matching `ANNAL_*BOAST`, latches 100 ticks and a full-screen fade, then completes through the existing Chat/Notebox lifecycle. | high |
| Existing supplied visual | `boast 2 - image.png`, 532x457, SHA-256 `7e97c6ff9a5d626667677c029650eb689fa796170b9cb053b74f52e08417c02b`, documented in the 2026-08-30 reopening above | Confirms the distinct uppercase title, quoted statement, framed rows, and per-row silhouette presentation recovered statically. | high |

### Complete presentation membership

Native owning system: `Boast` outer modal and embedded `BoastBox`, from
Provokatus command replacement through row construction, pointer state,
rendering, delayed acceptance, response Chat, instruction Notebox, Arena
failure/success, score mutation, and teardown.

| Member / branch | Native source | Required disposition |
| --- | --- | --- |
| Outer `700x560` frame | `0x004FB890`, `0x004F7BA0`, UI 11 | exact-ported through the shared native nine-slice primitive |
| `Select a Boast` title | `0x004F7DC0`, menu font group 3 | exact-ported with authored case and gold tint |
| `DONE` action | `0x004F7BA0`, menu font group 3 | exact-ported semantic action and teardown |
| Five `490x85` row Buttons at pitch 90 | `0x004F99F0`, UI 50 | exact-ported for the stock page |
| Five short uppercase titles | BoastBox `+0xDC`, special-uppercase font group 2 | exact-ported independently of statements |
| Five quoted statements | BoastBox `+0xEC`, medium font group 1 | exact-ported independently of titles |
| Paired row silhouettes | `0x004FDEC0`, UI 90..94 | exact-ported left copy plus horizontally mirrored right copy |
| Dormant authored silhouettes | `0x004F3590`, UI 95..97 | supported stock-style choices for Website mod rows; no claim that retail constructs rows 5..7 |
| Idle gold treatment | RGB `(0.85,0.73,0.44)`, alpha `1` | exact-ported |
| Hover/current-row treatment | Button hover byte or selected index; green transform blended at `0.6` | exact-ported across background, art, and text |
| Selection delay/fade | `+0x254=100`, `+0x25C=1`; decrement `0.100000001` per update; full-screen `-1000..3000` overlay | exact-ported |
| Response/Notebox/audio | `0x004FC340` and the already recovered Chat/Notebox owners | retained; visual cutover must not fork lifecycle |
| Mod-added rows beyond five | no retail producer | web-adapted pagination using the same five-row stock page rather than shrinking stock geometry |
| Mod content identity/behavior | no retail Lua system | web-adapted through admitted `sd.content.v1` definitions and host authority |

No presentation member is browser-blocked. Custom mod art is a Website
extension and must stay visibly inside the stock row composition; it is not
evidence about retail content.

### Exact geometry, draw order, fonts, and assets

- The factory writes outer size `(700,560)` and centers it relative to the
  owning Chat surface as:
  `left = parent.left + parent.width/2 - 350` and
  `top = parent.top + parent.height/2 + 70 - 280`. On the stock `1600x900`
  surface this is `(450,240)`.
- Outer resize places the embedded `BoastBox` at outer `(90,80)` with width
  `outer.width - 180 = 520` and initial height `outer.height - 160 = 400`.
  The builder then gives row `i` local bounds
  `(15, 25 + 90*i, box.width - 30, 85)` and sets box content height to the last
  row bottom plus 25. These relative equations, rather than screenshot-fitted
  offsets, are authoritative.
- The title center is `(outer.width/2, 64)` relative to the outer frame. `DONE`
  is centered at outer X and rendered 50 pixels above the outer bottom.
- Each row draws UI 50 as the shared `0.95`-origin native nine-slice, then UI
  `90+i` with its logical edge inset 15 pixels from the left and the same
  record inset 15 pixels from the right with X mirrored. The short title is
  centered 15 pixels above row center; the statement is centered 5 pixels
  below row center.
- UI records 90..97 are exact unrotated logical/frame rectangles:

| Record | Frame `(x,y,w,h)` |
| ---: | --- |
| 90 | `(86,946,35,61)` |
| 91 | `(198,719,41,66)` |
| 92 | `(212,923,48,60)` |
| 93 | `(984,62,39,55)` |
| 94 | `(30,958,45,60)` |
| 95 | `(212,328,34,62)` |
| 96 | `(0,958,29,58)` |
| 97 | `(122,946,30,57)` |

### Web-owned mod-extension contract

- Preserve native stock selections as numeric IDs `0..4`. A mod selection is
  a discriminated value carrying its stable `contentId` and owning `modId`;
  it never occupies or renumbers the retail byte.
- Add one bounded Web Lua `boast` content family. Its admitted definition owns
  name, quoted statement, response, instruction, failure-producer set,
  random-skill-choice flag, success wave, score multiplier, and exactly one
  icon source: authored stock style `0..7` or one owned sprite frame.
- Mod Boasts reuse the existing authoritative failure producers
  (`potion-use`, `magical-equipment`, `secondary-cast`, `mana-underflow`),
  fixed-tick automatic-choice owner, completed-wave boundary, Hall score owner,
  reset, replication, and failure Notebox. Definition data chooses behavior;
  the browser never decides success, failure, or reward.
- The host projects only validated Boast presentation/behavior fields needed by
  clients. Arbitrary Lua tables and callbacks do not cross the wire.
- Website saves may retain an admitted mod selection. Package reconciliation
  clears it when the owning mod is removed. Retail export clears a mod
  selection to native `null` and emits an explicit portability warning; it must
  never hash, truncate, or alias the mod selection into native `0..4`.
- More than five admitted rows paginate in deterministic stock-then-mod order.
  Every page retains the exact five-row geometry; page navigation is a
  documented Website adaptation and is absent when the stock five rows are the
  complete membership.

### Confidence and remaining proof

- Confirmed statically: constructors, object membership, vtables, exact five
  strings in all three arrays, outer/box/row geometry equations, title/Done
  placement, UI 11/50/90..97, mirrored draw, font groups, idle and selected
  tint setup, response dispatch, 100-tick latch, and fade decrement.
- Confirmed visually by the retained supplied stock frame: framed two-line rows
  with distinct silhouette art and title/statement separation.
- Web adaptation requiring implementation proof: custom icon texture framing,
  deterministic pagination, namespaced selection replication/save
  reconciliation, and native-export clearing.
- Material unknown: none for the five-row stock visual. Mod pagination and
  custom art are explicit Website policy rather than inferred native behavior.

### Implementation and validation contract

- Build the Boast surface as a reusable native UI Kit plan consumed by Pixi and
  DOM/workbench adapters. Do not add another Hub-only pile of raw sprite and
  text calls or make HTML the visible renderer.
- Keep BookReview and SellSpell on their separately recovered selector
  presentation until their own native render owners are reopened; only Boast
  leaves the generic selector in this change.
- Unit tests must pin every geometry equation, UI record, frame, font, tint,
  mirrored icon, row ordering, stock absence of pagination, all eight stock
  icon styles, mod schema bounds, projection shape, custom sprite frame,
  authoritative lifecycle branch, package removal, wire parsing, Website save,
  and retail-portability warning.
- Mac Chrome on the exact candidate must capture the complete stock page and a
  mod-expanded second page, exercise hover/focus/selection, receive the correct
  response and instruction Notebox, and report empty page-error, console-error,
  and failed-response arrays. The stock frame must be visually inspected
  against the supplied reference and exact static geometry.
- The exact changed manifest must pass focused Hub/UI Kit/Web Lua/protocol/save
  tests and the canonical Mac `./scripts/validate.sh`. Publication and
  production deployment remain separate authorization steps.

### BoastBox implementation validation receipt

- The extracted stock catalog is schema v4 and now owns the complete Boast
  presentation record: UI 11 outer frame, UI 50 rows, UI 90..97 icon bank,
  three exact fonts, idle/selected tints, five-row geometry, title/Done
  placement, and selection/fade timing. The shared UI Kit plan feeds both the
  real Pixi Hub renderer and the semantic DOM workbench; BookReview and
  SellSpell remain on their separate generic selector owner.
- The five retail choices keep numeric IDs `0..4`. Admitted Web Lua Boasts use
  namespaced `{ kind: "mod", modId, contentId }` identity and define one stock
  icon style `0..7` or one owned sprite frame, exact failure producers,
  random-choice policy, success wave, and score multiplier. Extra art slots,
  duplicate/unknown producers, oversized frames, and ambiguous icon sources
  fail admission.
- The authoritative host resolves mod definitions for selection, potion and
  magical-equipment use, secondary casts, mana underflow, completed-wave
  success, automatic choices, Hall scoring, developer grants, and every
  detached/rejoin transaction. Package removal clears an orphaned selection.
  Protocol 114 projects only bounded presentation/behavior fields; Website
  save schema 25 persists the namespaced selection while retaining schema 24
  migration, and retail export clears it with an explicit warning.
- The showcase package includes `EMPTY HANDS, FULL GLORY!` with an owned custom
  sprite, Wave 25 success, 1.25 score multiplier, and potion/equipment failure.
  Its canonical content graph is
  `ff6ee22044ae76a52f7ae69c8f61b4fb4102b021368e577ec65d462fdc1a7528`.
- Local focused closure passed Web Lua `63/63`, Hub UI `90/90`, UI Kit `67/67`,
  protocol/save `89/89`, the new detached mod-Boast regression, 18 Lua/shared
  world tests, two staged-rejoin host journeys, lint/generated checks, and the
  production build/budget (`264,039` raw / `80,406` gzip bytes).
- Mac Chrome 151 on Apple M2 Metal completed the exact final stock-courtyard
  and full mod-showcase journeys with empty page, console, and failed-response
  arrays. Stock page/hover captures hash to
  `1bb314548ce43eaa2af0048df5cf9761ee0ada6fa821a2ea25a7f74ee4c3c911`
  and `6d07db69fc79b783e21516ed93191e3c3ba6b608d3a7c9f9b9ec482992e9ca30`;
  expanded stock/mod/instruction captures hash to
  `cf1391f399cc428595a1ebe9729e1ae270069db2ff1ecac221db1289afbc99ac`,
  `2ec8ddc69a1ec4f602a438d5665dd84e543ee60471d4f121d41088182017aa86`,
  and `c2b1c15d1e628179a833f1918f1a5888da41a36c796f5b49c29720e5ee1d250c`.
  The frames visibly confirm paired stock/custom art, green hover, text-only
  pagination with no top `UI.8`, and the fully opaque Wave 25 Notebox.
- The exact source/test manifest
  `1354e942dbcc3e113faa3363423baf51a05313a455ba489ef4d7b1d5245289df`
  passed the canonical Mac gate: .NET Release build, 28 backend/contracts,
  zero lint errors, 340 prerequisite tests, 1,807 broad game tests, every
  focused suite, desktop tests, production build, media policy, and budget.
  One all-section NPC retry passed the Boast section and then hit the existing
  Skorcha seed assertion; the final registered courtyard run and an immediately
  preceding all-section run both completed successfully, with no Boast failure.
- No material presentation or authority unknown remains. At receipt time the
  work was local, uncommitted, unpushed, and undeployed. A later Git publication
  does not imply production deployment.

## 2026-08-31 — Native selector-row presentation reopening

### Reported smell and parity question

- The supplied clean-stock Machinimbus capture shows a dense, clipped
  `SELECT A SPELL` surface with framed art rows, authored descriptions,
  affordability tint, hover outline, and smooth scrolling. The Website renders
  the same eight actions as a flat five-line Chat list with `MORE` and
  `PREVIOUS` page jumps.
- This report reopens the presentation and input half of all three selector
  families. The 2026-08-24 pass correctly recovered row content, order,
  actions, authority, persistence, and teardown, but stopped at those data
  contracts and reused one generic Website list. Stock owns three distinct row
  renderer classes inside a shared `SwipeBox`; the earlier `exact-ported`
  disposition therefore did not cover the visible selector system.
- The immediately preceding BoastBox pass recovered its row chrome and Web Lua
  extension policy while leaving BookReview and SellSpell generic by design.
  This reopening preserves that namespaced mod identity and custom-art seam,
  then closes the shared stock SwipeBox input/clipping owner and the remaining
  two native row renderers without restoring the generic page-jump path.
- Falsifiers: a native discrete-page control; a common text-only renderer for
  all three selectors; Book rows displaying their full response body; spell
  rows lacking skill art, descriptions, or affordability state; or any normal
  selector path outside the three recovered box classes.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Supplied clean-stock footage | `Machinimbus - SolomonDark 2026-08-31 02-18-33.mp4`, 1600x900, 4.715633 s, SHA-256 `f2bea20e41af10d32b8bb7d4a81f84d3797aedc67df469b8915467ad55964303` | Eight ordered spell rows; four full rows plus clipped fragments during smooth scroll; framed skill art, gold name/description, right-aligned price, red unaffordable price, green hovered outline, gold balance, and `DONE`. | authoritative |
| Supplied Boast still/footage | `boast 2 - image.png`, SHA-256 `7e97c6ff9a5d626667677c029650eb689fa796170b9cb053b74f52e08417c02b`; `boast 3 - SolomonDark 2026-08-29 21-54-45.mp4`, SHA-256 `33f1804f879577a154a23dc1070a4d23102fd9be0ac64293ee2fa0be132bc29e` | The sibling Boast selector uses the same shell and clipped scrolling but its own mirrored figure art, title, and quoted statement rows. | high |
| Retail identity and tooling | `SolomonDark.exe` 0.72.5, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; preferred base `0x00400000`; read-only Ghidra replica 3; Mod Loader revision `08bfba9ef367f7b863848030d0a289dc31e33192` | Canonical binary and read-only analysis provenance. | high |
| Three selector classes | Boast/BoastBox `0x004F7D20/0x004F6C00/0x004FDEC0`; BookReview/BookBox `0x004FA090/0x004F6DE0/0x004FE6F0`; SellSpell/SellSpellBox `0x004F82D0/0x004F6FA0/0x004FECB0` | Each selector owns a distinct inner row renderer and population data while all inherit the same clipped swipe behavior and whole-selector shell. | high |
| Shared geometry and input | setup `0x004F6210/0x004F62F0`; SwipeBox clamp `0x004316D0`; pointer down/move/up `0x00431C80/0x00431CD0/0x00431DA0`; wheel `0x00431E60`; tick instructions `0x00431520..0x004315EB` | Rows start at local `(15,25)`, measure `(box width - 30)x85`, and repeat every 90 px. Wheel direction is normalized and advances exactly 25 px. Direct drag accumulates inverse pointer delta, applies it on tick, clamps, and zeroes it; the subsequent `0.95` multiply operates on zero and creates no post-release inertia. | high |
| Renderer-owned art | SellSpell uses `Skills` records by native skill ID plus `UI.21`; Boast uses `UI.90..97`; BookBox uses `Library.13..16` | Spell rows own element/skill art and the balance icon; Boast rows mirror their figure art; Book rows deterministically select one of four book sprites from the authored title hash. | high |
| Retail Library assets | `Library.bundle`, 33 records, SHA-256 `028308e108b779963cffc1cc506e63a37dfe2a1d931cb25eef02074e86d96f1a`; `Library.png`, 1024x1024, SHA-256 `66fe50d1a29015446b27e32f096a3887c8c6a9a3d0525f6de6459934260a3457` | The maintained native UI kit omitted an atlas consumed by a normal selector renderer; records 13..16 must join the complete extracted vocabulary. | high |
| Pre-reopen Website trace | `HubInventoryUi.tsx`, `hub-inventory-renderer.ts`, `hub-inventory-render-contract.ts` at rebased base `90cfe09e` | The immediately preceding change gives Boast its recovered UI 50/art/text renderer and preserves explicit pagination only for mod-expanded rows. BookReview and SellSpell still draw `label + price` through generic Chat, while every stock selector still lacks shared continuous SwipeBox input/clipping. | high |

### System boundary and membership inventory

Native system: **the complete survival-Hub selector surface**, from shared
whole-window layout and SwipeBox input through selector-specific row content,
art, highlighting, affordability, clipping, empty state, and return action.

| Member / branch | Native source | Closing disposition | Proof |
| --- | --- | --- | --- |
| Shared selector shell, title, clipped box, `DONE` | `0x004F7BA0`, `0x004F6210/0x004F62F0` | exact-ported | exact geometry, UI 11/50, retained-world Pixi frames |
| Continuous wheel, drag, per-tick delta, bounds | `0x00431400..0x00431E60` | exact-ported | 25 px wheel, direct drag, continuous clamp, clipped partial rows, no stock page buttons or release glide |
| Machinimbus spell rows | `0x004F8480`, `0x004FECB0` | exact-ported | all eight Skills icons, record-164 root plates, authored descriptions/prices, hover, affordability, purchase omission |
| Provokatus Boast rows | `0x004F99F0`, `0x004FDEC0` | exact-ported for row art; the pagination disposition is superseded by the immediately following reopening | five UI 50/mirrored-art/title/statement rows in the shared retail SwipeBox |
| Semicus Book rows | `0x004FC550`, `0x004FE6F0` | exact-ported | 26 deterministic `Library.13..16` title-only rows and Lace omission at recomputed bounds |
| Gold balance | `UI.21`, SellSpell whole renderer | exact-ported | current participant balance beside exact icon |
| Teacher all-bought state | `ALL SPELLS\nALREADY BOUGHT!` | exact-ported | centered native empty state with no phantom row actions |
| Selector action/authority/persistence/teardown | prior complete membership | verified-already-at-parity | all eight purchases, Boast selection, Lace one-shot, response and return flow remain authoritative |

No member is browser-blocked.

### Native ownership thread and recovered contract

- The whole Boast, BookReview, and SellSpell objects construct different box
  subclasses, populate parallel authored arrays, and mount the box into the
  same centered selector shell. Their vtables converge only for shared
  SwipeBox movement/clamping and whole-window `DONE` behavior; row drawing is
  intentionally polymorphic.
- Content begins 25 px below the box origin. Every row is 85 px high, starts
  15 px from each horizontal edge, and advances by 90 px. The renderer clips
  the translated content, so scroll can expose partial rows at both edges.
- `SwipeBox` stores continuous X/Y content offsets. Wheel input reduces any
  nonzero delta to its sign and adds 25 px on the vertical axis. Pointer move
  accumulates inverse pointer delta; `0x00431520` applies that delta on the next
  tick, clamps it through the virtual offset setter, and zeroes both axes. Raw
  instructions prove the later multiply by the constructor's `0.95` field acts
  on those zeros, so release does not glide. There are no `MORE` or `PREVIOUS`
  producers.
- SellSpellBox draws a framed dark row and green selection outline, derives
  backing/icon art from the offered skill ID, draws uppercase name and authored
  quick description, and right-aligns price. Price is gold when current gold is
  sufficient and pink-red otherwise. The whole owner draws the `UI.21` balance.
- BoastBox draws the same frame/selection language with one authored
  `UI.90..97` figure mirrored on both sides, then the short title and quoted
  statement. BookBox draws title only and deterministically maps the native
  title hash modulo four to `Library.13..16`; selecting a row owns the response
  body later.

### Confidence and open questions

- Confirmed: class membership, all normal producers, exact row dimensions and
  pitch, continuous clipping, wheel step, drag direction and tick consumption, content/order,
  selector-specific text membership, relevant atlas records, affordability
  branch, all-bought state, and current Website mismatch.
- Inferred for implementation: anti-aliased subpixel settling below one display
  pixel may be rounded by the browser renderer while preserving the recovered
  continuous offset and absence of post-release glide.
- Unknown: none material to implementation or acceptance.

### Web implementation consequence and validation contract

- Replace the generic paged selector branch with one shared deep selector
  presentation/input contract and three explicit row variants. Keep mutations
  in the existing authority layer. Semantic controls must follow translated,
  clipped row bounds and remain keyboard accessible without inventing visible
  paging chrome.
- Preserve the preceding namespaced Web Lua Boast selection/custom-art seam.
  The immediately following reopening supersedes this pass's mod-page model
  with one continuous BoastBox content extent.
- Add the complete hash-pinned `Library` atlas to the maintained extractor and
  native UI manifest. Use the existing `Skills`, `UI`, and bitmap-font assets;
  do not substitute CSS icons or recreated book art.
- Focused tests must pin every recovered constant, full-row membership and art
  mapping, book-title hash, price tint boundary, visible clipped controls,
  continuous wheel/drag clamp with no release glide, empty state, and the
  absence of page controls.
- Mac Chrome must traverse Machinimbus, Provokatus, and Semicus in one retained
  Hub, visually prove each native row family plus wheel and drag scrolling,
  exercise purchase/read/select actions and Teacher all-bought state, and end
  with empty page-error, console-error, failed-response, and host-error arrays.
  The exact rebased candidate must then pass `./scripts/validate.sh` on the M2
  Mac before any publication claim.

### Selector-row implementation validation receipt

- The shared selector contract now owns the observed `(450,27,700,560)` outer
  surface, `(540,107,520,400)` clip, UI 50 rows at local `(15,25)` with
  `490x85` size and 90-pixel pitch, 25-pixel signed wheel steps, inverse direct
  drag, exact content clamp, partial-row hit rectangles, and no post-release
  glide. Stock rows have no `MORE/PREVIOUS`; the immediately following reopening
  also removes the disproven page adaptation from admitted mod content.
- SellSpell renders Skills record 164 with the native root tint behind exact
  skill records 99..106 and the scaled Skills 5 frame. Its recovered 0.75
  description scale and 333-pixel wrap boundary reproduce every supplied
  stock line break. Current gold drives the exact gold/pink-red boundary and
  UI 21 balance. BookBox uses the native title hash modulo four for complete
  `Library.13..16` art and uppercase title-only rows; the maintained UI kit is
  now 13 atlases / 1,292 records with the hash-pinned retail Library atlas.
- Pure contracts pin outer/viewport/row geometry, 5/8/26-row bounds, content
  extents, maximum scroll, wheel sign normalization, drag/clamp, visible
  intersections, UI 50/Skills 5/164 records, all relevant art rows, book hash
  outputs, uppercase book text, price equality, and invalid inputs. The Hub UI
  registered group passed `93/93` on the final candidate rebased onto
  `41336d3017fed0967769afc1d051abba2c0ff7b2`.
- The final M2 Mac `/opt/homebrew/bin/bash ./scripts/validate.sh` exited zero:
  28 backend/contracts tests, every registered frontend and desktop group,
  production frontend and game-host builds, CSP media policy, and the game
  entry budget (`263,967` raw / `80,383` gzip bytes) all passed.
- Chrome `151.0.7922.174` on Apple M2 Metal completed one targeted retained-Hub
  journey through Provokatus, Machinimbus, and Semicus with `status: ok`.
  It proved the five stock Boast rows, wheel scroll 25, direct drag scroll 100,
  red unaffordable rows, all eight spell purchases, the all-bought surface,
  26 books, bottom-scroll Lace selection, and later 25-row omission. Page,
  console, failed-response, and host-error arrays were empty.
- Final visually inspected 1600x900 frame SHA-256 values are
  `34759da2939ac7699021ad9cabeae985eac613a370385da0d4674db437d42b25`
  (Boast), `f8b010b4b9dffc7cc5264cf7ec676a38005e0ef80412210b8b434b4c160301a3`
  (Boast hover), `aae025f0a9cbcdb97a941645b010270901726d30068802661f34a8795603e2b4`
  (Machinimbus top), `c987555dec8075cc982543afe0f1ee6b6f06558fe2f37a95c92c957f59968ae6`
  (Machinimbus bottom), `a55c62bae6ba2c93d27e821228ad7e9bc9e6921416a569091a7a5982f2e4e626`
  (all bought), and `24fb99646e9bae5aecd98f6a8762f998875436ec036038568fe47ad440d07797`
  (Semicus/Lace). The frames were compared to the supplied stock spell and
  Boast captures; icon plates, line breaks, prices, clipping, chrome, and row
  membership match the recovered contract.
- Two excluded retry failures were environmental/unrelated: the registered
  courtyard-only harness twice drew stock-absent Skorcha before Machinimbus,
  and one later retry began after its task-owned server reached its declared
  30-minute cap. Both had empty arrays before their named precondition failure;
  neither is used as acceptance evidence. No selector member remains unknown or
  browser-blocked. The implementation is local, committed, unpushed, and
  undeployed pending separate publication authorization.

## 2026-08-31 — Second reopening: wrapped statements and inherited SwipeBox

### Reported smell and parity question

- Owner report: the published Boast surface is substantially closer, but each
  statement runs through both sides of its row and all five rows paint through
  the `DONE` action. The supplied `boast 2 - image.png` instead shows bounded
  two-line statements and four complete rows plus only the top of row five.
- This is a secondary report in a system already marked complete. The previous
  pass stopped at `BoastBox`'s overrides. It did not follow the base constructor
  into `SwipeBox`, and it treated `0x0043D030` in the statement-construction
  path as an incidental String copy instead of the native width-bounded wrapper.
  It consequently documented overflow as authentic and invented page actions
  for mod rows. Those assumptions are withdrawn for every Boast row.
- Parity question: recover the complete text-preparation, clipped viewport,
  content extent, scroll transform, hit testing, input, and sibling membership
  that `BoastBox` inherits, then replace the whole disproven page model.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Reported web frame | Windows Downloads `boast 1 - image.png`, 1438x806 RGBA, SHA-256 `e85d2ad9e7195328987f692777e928c507dece6da2bb2aed94cefe1378d79ba4` | Records the older web failure-dialog defect; it is not BoastBox chrome and must not be used to infer selector geometry. | high |
| Reported stock selector | Windows Downloads `boast 2 - image.png`, 532x457 RGB, SHA-256 `7e97c6ff9a5d626667677c029650eb689fa796170b9cb053b74f52e08417c02b` | All four complete visible statements wrap to two centered lines inside the silhouettes. The 400px list viewport clips row five to a 15px top strip while `DONE` remains outside the clip. No scrollbar or page action is visible. | high |
| Reported stock failure sequence | Windows Downloads `boast 3 - SolomonDark 2026-08-29 21-54-45.mp4`, 1600x900 H.264/AAC, 4.5759s, 138 video frames, SHA-256 `33f1804f879577a154a23dc1070a4d23102fd9be0ac64293ee2fa0be132bc29e` | Confirms Boast failure remains the separate transient red native Notebox path; it adds no selector scroll chrome. | high |
| Current-web reproduction | clean Mac worktree at Website `41336d3017fed0967769afc1d051abba2c0ff7b2`; Chrome component workbench, 1600x900, SHA-256 `f69f91b0cb866488f7ddc100d3360dc7a058819e62b752b7735492376f1ebaf4` | Current plan emits one unbounded detail line, has no content clip or scroll offset, draws row five over `DONE`, and exposes invented pagination for added rows. | authoritative web defect |
| Text preparation | `BoastBox` builder `0x004F99F0`, calls `0x004F9B3A/0x004F9BF1/0x004F9CB0/0x004F9D6F/0x004F9E2E`; native wrapper `0x0043D030`; scalar `0x00785D90=150.0` | Every authored statement is copied through the medium-font wrapper at `BoastBox.width - 150`. With the 520px box this is exactly 370px. The wrapper replaces a prior space/hyphen with newline on overflow. | high |
| Text rendering | exact text renderer `0x0043AFC0`; medium-font line metric | Embedded newlines advance by font line height plus one, exactly 17px for the medium wrapper. The five recovered statements break at the same words visible in the supplied stock frame. | high |
| Scroll owner and layout | `BoastBox` ctor `0x004F6C00 -> SwipeBox 0x00431400`; outer layout `0x004F6210`; row builder `0x004F99F0`; SwipeBox vtable `0x007DD17C`; BoastBox vtable `0x00790794` | Outer layout gives the embedded box `(90,80,520,400)`. Rows begin at `(15,25)`, are 490x85 at 90px pitch, and content height becomes `lastBottom + 25 = 495`, producing maximum vertical offset 95. | high |
| Clip/render path | inherited `SwipeBox::Render 0x00431860`; derived draw `0x004FDEC0`; clamp `0x004316D0`; offset setter `0x004315F0` | SwipeBox installs a scissor for its own rectangle, translates descendants by negative scroll offset, renders BoastBox plus child Buttons, restores transform/scissor, and clamps offset to `0..content-viewport`. | high |
| Pointer/input path | SwipeBox down/move/up `0x00431C80/0x00431CD0/0x00431DA0`; tick `0x00431520`; wheel handler `0x00431E60`; wheel scalar `0x007DE968=25`, retention `0x007DE96C=0.95` | Pointer drag records previous position, applies previous-current delta on the next tick, moves children with the clamped content transform, and clears drag on release. Wheel direction is normalized and advances the vertical offset by 25px; the tick clears its delta before retention, so release has no glide. | high |
| Sibling sweep | 12 direct callers of `SwipeBox` ctor `0x00431400`; RTTI/class catalog | Direct derived/embedded users are `CPanelRollout`, `TimeLineBox`, `SwipeList<DataPair<int>>`, `BoastBox`, `BookBox`, `SellSpellBox`, item/store `SwipeList`s, `SwipePages`/Inventory, `DarkCloudSwipebox`, `HallOfFameBox`, and `SkillScreen`. | high |

All addresses are preferred-image VAs for retail 0.72.5
`SolomonDark.exe`, SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`,
image base `0x00400000`. Static queries used read-only Ghidra replica 3 through
Mod Loader revision `08bfba9ef367f7b863848030d0a289dc31e33192` and wrapper SHA-256
`b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`;
the dirty Mod Loader checkout was not modified.

### System boundary and membership inventory

Native system: **BoastBox statement preparation and its inherited SwipeBox
viewport**, from authored strings through wrap, content layout, clip, scroll,
pointer hit/action coordinates, and teardown.

| Member / branch | Native source | Disposition | Required proof |
| --- | --- | --- | --- |
| Five statement wrappers | `0x004F99F0 -> 0x0043D030`, width 370 | `exact-ported` | exact two-line arrays and 17px advance |
| Embedded viewport | `0x004F6210`, 520x400 | `exact-ported` | plan clip bounds `(540,320,520,400)` at 1600x900 |
| Five stock rows/content extent | `0x004F99F0`, 495px content | `exact-ported` | initial four rows plus 15px of row five; max offset 95 |
| SwipeBox scissor/translation | `0x00431860` | `exact-ported` | Pixi and DOM use the same nested clip plan |
| Pointer drag and clamp | `0x00431C80..0x00431DA0`, `0x00431520/0x004316D0` | `exact-ported` | drag changes offset continuously and never exceeds bounds |
| Row hit regions under scroll | child Buttons rendered under inherited transform | `exact-ported` | actions use viewport intersections and select the transformed row |
| Wheel branch | `0x00431E60`, signed 25px vertical step | `exact-ported` | continuous bounded movement with no visible scrollbar/page action or release glide |
| Outer frame/title/Done | prior `Boast` owner | `verified-already-at-parity` | remain outside the list clip and stationary |
| Row frames/icons/tint | prior `0x004FDEC0` recovery | `verified-already-at-parity` | move and clip with row content |
| Mod-added rows | no retail producer | `web-adapted` through the same continuous SwipeBox extent | deterministic stock-then-mod order, no page controls |
| BookBox and SellSpellBox | `0x004F6DE0/0x004F6FA0` | `out-of-system`: separately recovered in the immediately preceding selector reopening | retain their own row renderers and shared continuous SwipeBox input |
| Other nine SwipeBox callers | caller/RTTI sweep above | `out-of-system`: distinct screen content and existing owners | reusable clip/scroll primitive must not mutate those screens in this pass |
| Failure/success/score/save/protocol | prior Boast lifecycle | `verified-already-at-parity` | selector correction changes no authority or wire state |

No member is blocked by the browser platform.

### Native ownership thread and recovered behavioral contract

- `Boast::OnLayout 0x004F6210` lays out its embedded `BoastBox` before adding it
  as a child. `BoastBox::Build 0x004F99F0` wraps all five statements at 370px,
  constructs every Button, and sets the SwipeBox content height to 495px.
- `SwipeBox::Render 0x00431860` owns clipping and content translation. The
  derived `0x004FDEC0` still draws every row; the scissor, not row omission or
  outer-frame clipping, produces the visible 400px list window.
- At offset zero, row bounds are `25..110`, `115..200`, `205..290`,
  `295..380`, and `385..470` in box coordinates. Therefore row five intersects
  the viewport only at `385..400`. At maximum offset 95, row one retains the
  reciprocal 15px bottom strip and rows two through five are complete.
- Drag uses content-space delta `previousPointer - currentPointer`; clamping is
  exact on both axes. Boast only overflows vertically. The outer frame,
  `Select a Boast`, and `DONE` never move.
- The previous `PREVIOUS`/`MORE` controls have no native producer. Added mod
  rows extend `contentHeight` by the same 90px pitch and remain inside the same
  continuous viewport.

### Confidence and open questions

- Confirmed: all five wrap callsites, 370px width, exact line breaks, 17px line
  advance, SwipeBox inheritance, viewport/content dimensions, 95px stock range,
  scissor order, scroll transform, pointer lifecycle, sibling constructors,
  and absence of visible scroll/page chrome.
- Inferred: none required for the stock five-row implementation.
- Unknown: none material. Wheel and direct drag share the same bounded content
  offset and neither introduces visible scroll chrome.

### Web implementation consequence

- Extend the UI Kit plan/adapters with one nested clipped-content primitive and
  one pure bounded SwipeBox offset model; do not add Boast-only CSS clipping.
- Change `planNativeUiBoastMenu` to accept all rows plus a continuous `scrollY`,
  wrap details at 370px with 17px advance, compute native content/max extents,
  and expose only viewport-intersecting semantic action bounds.
- Remove Boast pagination and its top labels completely. Stock and mod content
  use the same continuous scrolled list. Keep outer chrome and authority
  unchanged.
- Add drag ownership to the semantic DOM adapter and real Hub action surface;
  inject custom mod icons into the same clipped Pixi/DOM content layer.

### Validation contract

- Mac red test before implementation: current stock plan has no clip node,
  emits one line per statement, exposes row five at full height, and reports no
  95px scroll range.
- Focused plan tests: exact wrap arrays, 520x400 clip, 495 content, 95 max,
  reciprocal 15px edge rows, stationary chrome, translated icons/text/actions,
  and mod row extension without page actions.
- Adapter tests/journey: DOM and Pixi clip partial nine-slices/text/icons;
  pointer drag reaches max and back; visible row actions follow the transform;
  custom icons remain clipped and selectable.
- Mac Chrome stock comparison: initial selector matches `boast 2` membership
  and line breaks, then dragging reveals row five without moving `DONE`.
  Mod showcase must drag to its added row rather than page, select it, and keep
  empty page/console/failed-response arrays.
- Exact candidate must pass `/opt/homebrew/bin/bash ./scripts/validate.sh` on
  the Mac mini. Publication/deployment require separate authorization.
