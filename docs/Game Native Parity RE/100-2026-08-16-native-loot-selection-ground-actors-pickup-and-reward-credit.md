# 2026-08-16 — Native loot selection, ground actors, pickup, and reward credit

## Reported smell and parity question

- Reported web behavior: enemy death retires the actor and grants XP, but the
  Boneyard owns no Gold, Potion, Item, Powerup, or health/mana Orb actors. There
  is consequently no drop selection, ground presentation, pickup audio,
  authoritative contention, inventory transfer, or reward effect.
- Stock behavior to recover: one actor-private six-category death selector
  materializes one of four ground actor classes, while Goodies and explicit
  Boneyard actions enter the same materializers. Each actor then owns its native
  art, clock, strict-radius pickup, sound, credit, and teardown.
- Reproduction scenes: the default generated Boneyard's eight wave families,
  every Goodie selector, two players competing for one drop, all four Hagatha
  drop modifiers, run reset, and a full inventory.
- Falsifiers: a uniform picker, client-side roll, nearest-player arbitration,
  despawning Gold/Sacks, magnetized non-Orb loot, one RNG domain, item-icon
  ground art, or a category-only screenshot would disprove parity.

## Evidence and provenance

| Retail artifact | 4,723,200-byte `SolomonDarkAbandonware/SolomonDark.exe`, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, reverified 2026-08-16 | same preserved retail 0.72.5 image as the current web ledger | high |
| Live retail pair | Mod Loader `tests/fixtures/webgame/loot-goldens.json`, reviewed SHA-256 `dabdd9cdd87dc78b4b800477d2765a1afd63f86da22cf19427b5eb077cc6be26` | 100 deaths retain complete private/shared RNG boundaries; outcomes are 84 none, 10 Orb, 6 Gold; three Orb trajectories and the farther-host first-retirement case are live | high |
| Static instructions | `0x0047C070`, `0x0046A360`, `0x0046AA90`, `0x0046AE20`, `0x005E62E0`, `0x005E66B0`, `0x005E6B50`, `0x006039C0`, `0x0061F4C0`, placement `0x00645910/0x00645820`, item transfer `0x0055FF20`, random FX `0x0057A000/0x00579E90`, message insert/update/draw `0x005CA7C0/0x005D7EF0/0x005CF000`, plus the Goodie writer chain `0x00646D00 -> 0x00552A10/0x005601B0 -> 0x005F0E50`, decompiled read-only from Ghidra replica slot 6 | fixes candidate order, two RNG domains, collision placement, materializers, motion/lifetimes, full-inventory transfer, generated-equipment metadata, notification lifecycle, recursive key consumption, Goodie unlock geometry/rows, and pickup/application | high |
| Static presentation | `0x0060FC10`, `0x0060FFE0`, `0x006104F0`, `0x006105F0`, `0x0061A260`, atlas manifests | drains every Orb/Gold/Sack/Bonus record and frame branch | high |
| Static modifiers | `Skills_FinalizePass 0x0067C360` | Item Charm `0.75`, Gold Charm amount `1.25`/bound `0.75`, Scatter Curse Orb bound `0.5`/value `1.25`, Arcane Attractor `0.800000011920929` | high |
| Audio registry | Mod Loader `native-audio-events.md` and stock WAV hashes | Gold, Sack/Potion, and Orb drop/pickup cues have distinct registry ownership | high |
| Web baseline | Website `origin/main` `6826e62`; `boneyard-enemy-store.ts`, `boneyard-world.ts`, protocol 29, inventory/economy modules | XP rewards and participant-owned inventory exist, but no ground-loot owner or replicated family exists | high |

Injected-loader captures are supporting runtime evidence; the decision tables,
render functions, assets, and modifiers are independently instruction/data
derived from the clean retail image.

## System boundary and membership inventory

Native system: from enemy death, Goodie timer, or explicit drop action through
selection/materialization, authoritative ground lifetime, presentation,
pickup, credit, and scene teardown. The dispositions below are the publication
contract; no row may remain unproved when the receipt is finalized.

| Member (class/variant/scene/branch) | Native source | Closure disposition | Required proof |
| --- | --- | --- | --- |
| Skeleton, Archer, Mage seed rewrites and all other hostile constructor seeds | `0x00473390`, `0x00473980`, `0x00473B40`, `0x00478290`, `0x00490860` | `exact-ported` | constructor/scheduler seed-order tests |
| Enemy early exits, null recipe, disable mask, special suppression, emergency health potion | `0x0047C070` | `exact-ported` | one assertion per branch |
| key -> Orb -> Gold -> Item -> Potion -> Powerup candidate order and biased choice weights for counts 1..6 | `0x0047C070`, private `Integer` | `exact-ported` | live-golden replay plus forced table cases |
| eight shipped web wave families | common hostile death path | `exact-ported` | each family emits one selector source; Coffin child Maggots do not |
| GoodImp, Crow, Maggot, Cocoon | native family death census | `out-of-system` (not drop-bearing hostile members; Maggot/Cocoon explicitly return early) | negative family tests |
| Gold tiers 0/1/2/3, sentinel/explicit amount, >25 chunking, policy 5 | `0x0046AA90`, `0x005E13C0` | `exact-ported` | every tier, total, and randomized chunk invariant |
| health and mana Orb, Scatter value branch | `0x005E1220` | `exact-ported` | kind weights, float32 endpoints, value scaling |
| health/mana enemy Potions | `0x0046AE20` | `exact-ported` | subtype 0/1 and scene-force branch |
| named definition Item, 110-placeholder random equipment, all six equipment classes/selectors | `0x0046A360`, `0x004699B0`, `0x004645B0` | `exact-ported` at loot identity/art/transfer boundary | candidate, ownership filter, class bias, selector/icon/color tests |
| Wizard Key and next-key level bands | load `0x0046DC60`, gate `0x00463500`, materializer `0x00468440` | `exact-ported` | initial shared `Integer(8)+5`, unopened count, bands 15..25/30..40/50..70, Item_Misc subtype 1 carrier/credit test |
| Bonus skill point, random learned rank, DAMAGE x4 | `0x005E2D90`, `0x005D5910` | `exact-ported` | each kind, eligibility, effect, modal/barrier test |
| Goodie selectors 0..17 and phases 0/1/2 | `0x0061F4C0` | `exact-ported` from the activation edge through materialization | all eighteen rows, timer 100/200/250, phase/art/teardown tests |
| Goodie unlock, recursive Wizard Key consumption, and unopened counter | Region `MyCollider` `0x00646D00`, key check/remove `0x00552A10`/`0x005601B0`, activation `0x005F0E50` | `exact-ported` | local-player facing probe at +25, strict radius 50, nearest eligible Goodie, nested key removal, no-key negative case |
| explicit/random Item, Gold, Potion, Key actions and drop limit/enable actions | IDs 1008,1015,1016,1017,1018,1059,1086,1087; helpers `0x00469FE0`, `0x00466D20`, `0x00466D90`, `0x00466DF0`, `0x00462690`, `0x00466B50`, `0x0046A0F0`, `0x00463520` | `exact-ported` materializer/range/mask API; arbitrary script predicate execution is `out-of-system` with the geometry-only importer | all six action materializers plus limit/mask contract tests |
| Solomon Dig direct reward and implicit wave-end reward | eight live Dig trials and Bonus xref census | `out-of-system` (stock has neither producer) | zero-producer tests |
| Orb pull/capture/decay | `0x005E62E0` | `exact-ported` | three recorded trajectories, strict boundaries, 1024..1250 lifetime |
| Gold scatter/persistence/pickup | `0x005E66B0` | `exact-ported` | 17 half-unit scatter updates through 8.5, strict 37.5 stock radius, no despawn |
| Potion/Item/Key/nested Sack bounce/pickup | `0x005E6B50`, inventory insertion `0x0055FF20` | `exact-ported` | float32 bounce, recursive identity, potion stacking, and native hidden overflow beyond the 88 visible cells |
| Bonus lifetime/pickup | `0x006039C0` | `exact-ported` | 1200 countdown plus 101-update float32 fade (retire update 1300), strict 25-unit stock radius |
| world allocation IDs 1..2047/full field | `0x0063E750`, `0x0063F6D0` | `exact-ported` | fail without eviction/replacement |
| first valid retirement across host/guests | loader live golden plus retail slot facts | `exact-ported` | simultaneous two-client deterministic order, no nearest arbitration |
| Orb/Gold/Sack/Bonus/Goodie art and painter branches | render functions above | `exact-ported` | per-record render-plan tests and inspected browser frame |
| drop/pickup sound families | registry 2,25,26,68,69,185,186 | `exact-ported` | exact WAV hashes, pitch/gain, once-only event consumption |
| scene exit, new run, disconnect, snapshot gaps | world/run authority | `exact-ported` | complete retirement and no stale replay |

No member is `blocked-by-platform`: Canvas/WebGL, Web Audio, the authoritative
Node host, and the existing inventory/skill state can represent every recovered
mechanism. Retail's process-global RNG starting position is replaced only at
the run-input boundary by one host-owned native RNG seeded from the authoritative
Boneyard seed; all subsequent words, private actor seeds, bounds, float32
rounding, and draw order inside this system remain native.

## Native ownership thread

- Owner and construction: `Badguy_Ctor` draws `Integer(10000000)` into
  `actor+0x1C0`; three Skeleton-family schedulers replace it. Death constructs
  a private 0xE8-byte RNG from that value. Category materializers continue on
  the active shared stream and register actors in the world allocator.
- State transitions: ground actors are preselected outcomes. Orb decays after
  900 ticks; Gold/Sack persist; Bonus begins its fade after the 1200 countdown
  and retires on update 1300; Goodie phases at exact timers 100/200/250.
- Downstream consumers: strict center-distance pickup applies participant-owned
  Gold, HP/MP, inventory object, or Bonus effect, emits feedback/audio, and
  retires the actor once.
- Siblings: Goodie, explicit Boneyard actions, Hagatha selectors 3/4/9/23,
  Item recipe/random-equipment stores, inventory stacking, skill offers, and
  run teardown all share this boundary.
- Multiplayer: only the host rolls. Clients receive stable IDs/state and send
  movement through the existing host simulation; canonical participant order,
  not client proximity ranking, decides simultaneous valid pickups.

## Recovered behavioral contract

- Candidate and amount tables are the complete tables in Mod Loader
  `native-loot-selector.md`; they are inputs to code, not prose approximations.
- Pickup factor is 1.25. Orb pull/capture radii are 75/25 and motion is exactly
  1.5 units per 100 Hz actor tick. Gold/Sack capture is 37.5; Bonus is 25.
- Sack bounce starts `height=-25`, `velocity=0.10000000149011612`, then
  `height+=velocity; velocity*=1.5` until positive, where both clamp to zero.
- Gold/Sack have no despawn. Bonus stays full-alpha through its 1200 countdown,
  then subtracts float32 `0.009999999776482582` for 101 updates and retires on
  update 1300. Orb untouched life is value-dependent and uses float32
  subtraction `0.0020000000949949026`.
- Render art is BadGuys Orb 434..435, Gold 188..201/73/83, Sack 33/67/436..445,
  Bonus 7/61/122..157, Goodie break 377..380, and DeadHawg Goodie 145..147.
- Inventory objects preserve native type/subtype/recipe/selector/icon/color and
  potion stack count. Ground Sacks draw the carrier family, never the inventory
  icon as a replacement shell.
- Key eligibility is authoritative arena state. The next threshold begins at
  shared `Integer(8)+5`, requires at least one unopened Goodie, and advances to
  random bands 15..25, 30..40, then 50..70 after successful key drops.
- Goodie timer 100 is part of shared loot entropy: the BadGuys-52 flash and all
  twenty BadGuys 377..380 `Anim_Bouncer` children consume their native
  constructor/customization draw program before any later reward selection.

## 2026-08-20 residual closure

- Emergency Potion density is not a 500-radius query. `0x0047C070` passes a
  500-unit diameter to `0x00642280`, which halves it; the strict mask-2 census
  therefore counts other hostile actors within radius 250 and excludes the
  dying actor. Both the global `>79` and local `>49` thresholds remain strict.
- Carrier placement is the shared `0x00645910` radial search. Potion and Item
  use one radius-15, mask-4 pass; Key uses two; Gold draws `Float(3)+1` and uses
  mask `0x404`, adding the actor-overlap ellipse from `0x00645820`. A blocked
  ring starts at a shared `Float(360)`, uses
  `trunc(pi*(searchRadius+baseRadius)/searchRadius)` angular samples, scales Y
  by float32 `0.800000011920929`, and grows successive rings by the cumulative
  `(1+Float(1))` factor.
- `Arena_CreateGold` constructs each actor before placement, increments a
  cumulative delay by `trunc(100*(Float(0.04)+0.009999999776482582))` after
  chunks six onward, constructs one otherwise-unused stack Gold (spending its
  four constructor words), stable-sorts actors by world Y, then assigns every
  remaining zero delay as `trunc(100*Float(0.25))`. Those draws, the sort, and
  the delays are authoritative state rather than decorative scatter.
- Explicit Gold is not clamped upward: a post-multiplier total at or below zero
  emits no actors, while the unused sorter-probe constructor still spends its
  four shared words.
- `0x0057A000` has three separate target pools: row `+0x28` for Wielding,
  `+0x28 || category==3` for Ingenious, and every enabled row 8..79 for the
  dynamic skill affix. Advanced rows 72..79 remain gated by their eight native
  unlock bytes. The item level byte begins at zero, becomes 8 for a two-affix
  item, and selector 8 raises it to at least the target row's compiled minimum
  level. Dynamic affixes use the native skill name, not a numeric placeholder.
  The two-affix path exists only above requested level 18 and short-circuits
  `Integer(2)==1`, then `Integer(5)==3`, then `Integer(10)==3`; lower levels
  spend none of those words. Wearable halving applies only in the switch
  branches that contain the compiled half-and-round block.
- Random Hat/Robe colors use the exact nine-row palette
  `(red, orange, yellow, pale-green, cyan, blue, magenta, .4 gray, .8 gray)`,
  optional signed per-channel `Float(.1)`, optional `*1.85`, clamping, then an
  80-percent luminance blend with weights
  `.3086000085/.6093999743/.0820000023`; layer two remains native white.
- Living equipment uses the same item-owned selectors and colors as death;
  it is not permanently baked into the wizard's element skin. The equipped
  path `0x0054BA80 -> 0x00538B80` invokes Hat/Robe/Staff item painters. Hat
  selectors choose Clothes primary `316 + 24*s` and secondary `412 + 24*s`;
  Robe selectors choose dynamic primary `868 + 120*s` and secondary
  `1228 + 120*s`, while the shared fixed banks remain
  `1612/2428` primary and `2020/2836` secondary. Staff selectors choose
  Clothes `5..10` and preserve the item-owned back/front attachment pass;
  Wand uses Clothes record 15 at the same recovered endpoints. The starter
  Hat/Robe use selector zero with the descriptor element palette, generated
  Hat/Robe items use their serialized two-color state, and an empty weapon
  slot owns neither shaft nor Staff orb.
- Ground Sack pickup calls `0x0055FF20` with forced insertion. It stacks a
  matching Potion, replaces the first Item_None cell when one exists, and
  otherwise appends past the 88 visible cells. The actor still retires; dropping
  the item merely because the web grid is full is not native behavior.
- Gold pickup creates two additive BadGuys-83 fades (gold `.05` loss and white
  `.1` loss); Orb pickup creates the normal scale-1.5 BadGuys-15 `.05` fade.
  Orb's `gotorb` playback rate is fixed `1`; Gold and Sack alone consume the
  signed `.1` pickup-pitch draw. The shared notification manager starts at
  lifetime `1.5`, loses float32 `.005` per update (300 updates), rises from
  offset `-18`, merges an active `GOLD` suffix above lifetime one, and draws the
  extracted body bitmap font at native screen center/Y 67 with its black +2
  shadow and per-message color. The decompiled draw uses the offset only in
  `1-max(0,offset)/250`; ordered text rows, not another Y translation, own the
  vertical stack.

## Nearby-system findings

- `Skills_FinalizePass 0x0067C360` is the missing exact writer for all four
  purchased drop modifiers; the current Hub catalog descriptions were not
  enough to implement them.
- The previously unnamed Goodie activation edge is not an authored script or
  damage predicate. Region `MyCollider` owns it: local-player class 101 probes
  25 units along facing with a strict radius-50 nearest query, recursively
  consumes one Wizard Key, and activates the unopened Goodie. There is no
  keyboard-interact input in this path.
- The existing `HubInventoryItem` representation already owns native type,
  subtype, recipe and icon identity. Random Hat/Robe drops additionally require
  their live two-color state instead of falling back to the starter element
  palette.
- Native report updated: Mod Loader
  `docs/reverse-engineering/native-loot-selector.md` now owns the complete
  presentation/modifier/membership closure.

## Confidence and open questions

- Confirmed: every selector/category/amount row, actor seed lifecycle, Goodie
  row, ground clock, pickup radius, art record, audio cue, purchased modifier,
  credit owner, and non-producer named above.
- Inferred: none used for implementation constants. The web-only starting seed
  for the one authoritative shared stream remains the declared run-input policy.
- Unknowns: none inside the declared boundary. Downstream equipment-FX
  application remains the separately documented equipment system, not a silent
  loot row.

## Web implementation consequence

- Correct owner: a pure native loot kernel plus one authoritative Boneyard loot
  store under `core-server`; the renderer and audio director consume replicated
  outcomes and never roll.
- Shared model: hostile actors retain their current native loot seed; world
  state retains the shared loot RNG, actor allocator, Goodie states, drops,
  events, and last successful Item level.
- Participant state: economy/progression helpers apply one serialized pickup;
  no client-local currency or inventory mutation is accepted.
- Protocol: compact Loot/Goodie entity registrations, recursively validated
  item identity/effects/colors, and one ordered loot event lane are carried by
  wire version 31 after the authoritative gameplay-pause lane is composed.
- Obsolete path: enemy death's XP-only terminal output is extended at its owner;
  no renderer inference or CSS pickup substitute is added.
- Living presentation: the player renderer resolves Hat/Robe/Staff/Wand from
  replicated `economy.equipment`, selects the extracted native banks, applies
  item primary/secondary tints before world/secondary material tint, and
  mirrors that exact composed pose into the native-red hit redraw. Death keeps
  its separate nine-layer and bouncer owners. No item identity or palette is
  inferred from the element after a generated item is equipped.

## Validation contract

- Focused tests: replay the reviewed live cases; exhaust category weights,
  policies, modifiers, amounts, all Goodie selectors, four ground families,
  all Bonus kinds, strict boundaries, collision order, capacity, and teardown.
- Protocol tests: reject every unknown kind/cue/shape, round-trip keyframes and
  deltas, retire once, and reset baselines between runs.
- Renderer/audio tests: assert every atlas membership row, frame/phase branch,
  lighting/painter lane, WAV hash, and once-only semantic event.
- Playwright: two real clients enter a deterministic Boneyard, witness all five
  requested families in the native renderer, collect them, inspect Gold,
  potion/item inventory, HP/MP, Bonus effect, audio plays, first-retirement,
  screenshots, and empty page/console/network error arrays.
- The executable acceptance harness is
  `npm --prefix frontend run smoke:game:loot-drops`; it uses two isolated
  browser contexts and the real local host, not a DOM-only renderer fixture.
- Final gates: exact-tree `./scripts/validate.sh` and the focused browser journey
  must pass on the Mac mini before publication is accepted; production is a
  separate post-push SHA/service/browser verification.

## Implementation validation receipt

Closed on 2026-08-20.

### Implemented ownership

- `core-kernels/native-loot.ts` and `native-random-equipment.ts` own the pure
  selector, materializers, collision search, two RNG domains, all stock item
  identities, exact generated FX, action helpers, and Goodie rows.
- `core-server/boneyard-loot-store.ts`, `boneyard-world.ts`,
  `boneyard-enemy-store.ts`, and `game-simulation.ts` own seed writers, ground
  clocks, Goodie activation/effects, canonical multiplayer pickup, participant
  credit, Bonus application, and run teardown.
- `protocol/boneyard-loot-replication.ts`,
  `boneyard-goodie-replication.ts`, `entity-replication.ts`, and
  `game-protocol.ts` carry fail-closed compact state plus the ordered event
  lane at protocol 30. Recursive item trees retain generated selectors, FX,
  colors, and hidden overflow.
- `renderer/native-loot-assets.ts`, `native-loot-presentation.ts`,
  `native-loot-view.ts`, the Boneyard renderer, `NativeLootBitmapText.tsx`, and
  the audio owner consume replicated outcomes. They do not roll or credit.
- `tools/smoke-loot-drops.mjs` is the two-client real-host acceptance journey;
  `scripts/validate.sh` includes the 40-test focused loot family.

### Exact-tree and Mac acceptance

The implementation was rebased onto Website `dd4f87e`, producing
`2caee0e91e2e4ae7a55a04a716126a56b013e336`; the native report was rebased
onto Mod Loader `190a1573`, producing
`4307dfa6d8da2fa0eb28c3437de8843d4a302885`. Both were clean and exactly
`0 1` relative to their then-current `origin/main`. Linux
`./scripts/validate.sh` exited zero: 24 backend contracts, 40 loot tests, 972
Boneyard tests, 5 level-up tests, 6 diagnostics tests, 14 Hub UI tests, 5
desktop tests, both production builds, bundle budget, and media policy passed.
The complete Mod Loader CI-safe static suite passed `489/489`.

The commits were transferred to the Mac mini as verified Git bundles. Website
bundle SHA-256 was
`555c6aa4b73391b6fc178aa2c0c7533f2043f927230a75b872086a4a9dbb80c7`;
Mod Loader bundle SHA-256 was
`b1af0b6b6d8c0b47dd95795d3a858372390a33bd10be7483d09e650337fac663`.
The clean detached trees were
`/Users/jarrett/codex-acceptance/loot-drops-native-parity-20260820/website`
and `.../mod-loader` on arm64 macOS 26.4.1, Node 22.17.0, npm 10.9.2,
.NET 10.0.302, and Chrome 151.0.7922.138.

Mac `./scripts/validate.sh` exited zero on that exact Website commit. Its log
SHA-256 is
`d7fcbdf7a7cfa293ef2ef904a9e9ab95865414778f3c25b023af5bc89b6e937b`.
All five loot-specific Mod Loader contracts passed on the exact evidence tree.

The follow-up Mac toolchain pass replaced that earlier generic-gate caveat.
Python.org's signed and notarized universal2 Python 3.12.10 package was
installed at `/usr/local/bin/python3.12`; its verified package SHA-256 is
`8373e58da4ea146b3eb1c1f9834f19a319440b6b679b06050b1f9ee3237aa8e4`.
Pillow 12.2.0, matching CI, was installed in that interpreter's user site.
Fresh-process probes confirmed both `zip(strict=...)` and
`Image.get_flattened_data()`. Apple's `/usr/bin/python3` remains 3.9.6 and is
not the validation interpreter.

The first newly enabled broad run exposed one macOS-only test expectation:
the harness intentionally canonicalized temporary paths while the assertion
compared `/private/var/...` with macOS's `/var/...` alias. Mod Loader
`452a021448a11204a958e3f631fc474fec58fe8c` made that assertion compare the
canonical path. The same pass found that the concurrently landed gameplay-
pause layout additions had not refreshed the class-loadout fixture's required
whole-layout provenance hash; `8128d34298b4e0035d5b6f55cd95a1b1a0f85d56`
restored the established provenance contract without changing captured class
data.

The final verified bundle SHA-256 is
`f48ce3c5636d5ba34377df5f271035e3d9e3d8884ab4f86c132087dce94c6684`.
Its clean detached Mac tree is
`/Users/jarrett/codex-acceptance/loot-drops-native-parity-20260820/mod-loader-python312-final-8128d342`.
On that exact tree, `tests/re/run_static_re_tests.py --ci` passed `489/489`;
the log SHA-256 is
`b299086e06d4e442bf3efee5ca26a816322c066419452a596dba5408346023c8`.
The broader `tests/run_python_suite.py` passed all `87/87` runnable modules
and `795` tests, with the declared eight machine-dependent modules excluded;
its log SHA-256 is
`f65840fd8a8a85431dee685df3aa8cb53aa452d8a88cd45bdabedc55c19a37b0`.

Mac `npm --prefix frontend run smoke:game:loot-drops` exited zero with two
isolated Chrome contexts and one real authoritative host. The WebGL2 frame
contained one 10-Gold actor, a Health Potion Sack, a Pentaclostic Ring Sack,
health and mana Orbs, and Damage x4. Collection credited Gold `10000 -> 10010`,
stacked the Potion to quantity 2, inserted the named Item, restored both
resources, armed Damage x4, allocated exact pickup-effect counts `2/1/1`, and
played drop-bag, drop-coins, drop-potion, goto-orb, pickup-bag, and pickup-coin
at counts `1/1/1/2/2/1`. Bitmap-font messages for `10 GOLD`, `Health Potion`,
`Pentaclostic Ring`, and `DAMAGE x4` all used the extracted mask atlas.
A seventh contested Gold actor retired once and credited canonical player 1;
player 2 remained at 10000. Page, console, and failed-response arrays were
empty. The log SHA-256 is
`951349dbc103393d0b972e9c51827114074be68d31c10ff62d0ea8142b3facca`.
Visual inspection confirmed all requested families in the native light field;
visible/collected screenshot SHA-256 values are
`6d63c71fa429e9fc498d00eebcefac4329af31579cab4250398766b2c77b2e98`
and `940d0eff84762f257f6adc6cb8e20a149d00386d70bf664ae39d7a90252b7757`.
No task-owned browser, Vite, host, or listener remained.

### Publication and production

Website `2caee0e` and Mod Loader `4307dfa6` reached `main` by fast-forward.
GitHub Actions Website run `32380162505` and Mod Loader run `32380161527`
completed successfully. The configured deployment worker independently
validated and deployed exact Website SHA `2caee0e`. Production retained
rollback `/opt/solomon-dark-revived.rollback-pre-2caee0e91e2e-20260820T143031Z`
and SQLite backup
`/var/backups/solomon-dark-revived/pre-2caee0e91e2e-20260820T143031Z/sdr.db`.
Website, game supervisor, and Caddy were active with zero restarts; live and
backup SQLite integrity checks returned `ok`; supervisor health returned
`solomon-dark/30`, zero sessions, and zero lobbies.

Public and loopback root/`/game` returned 200 and all four index bodies were
byte-identical at SHA-256
`0cc1fb0c97cd3fca8bab8faf362722994c4067f29a26db81af2cd02fd04b50ed`.
Public `Game-CDLDwlc0.js` and `BoneyardScene-BHfOqnXS.js` matched the deployed
files at SHA-256
`caca0e6e2fe607798e8158d62088d7c1bd2f9a70fa7256236385bbc44d9c0b42`
and `34c0fcaadda2093c2d428faab8e39ee95892be6449ae3f56956145414cfe232d`.
The public bundle contained the loot entity/event code, and all seven public
loot WAVs matched their recorded stock hashes.

A public provisioned `wss://solomondarker.com/game-sessions/...` authority
completed protocol 30 and moved player X from `950.64` to
`951.9544100084901`. A separate Mac public-browser journey used three real
clients, entered shared Hub and Boneyard, crossed the authored gate, rendered
WebGL2 at resolution 1, and returned `status: ok` with empty errors; pings were
30--49 ms. Its log SHA-256 is
`1bcc0c219eea9210c9b00e9d84c71229fad3ecdd2409287c18910868508d08f9`.
The final supervisor sample again reported zero sessions/lobbies. Production
behavior is coupled to the deterministic loot proof by the exact deployed SHA
and byte-matched runtime chunks; no debug mutation was added to production.
The Mac-toolchain follow-up also reached publication. Mod Loader path and
provenance corrections `452a0214` and `8128d342` reached `main`; GitHub Actions
run `32385457541` completed successfully. Website receipt `4755003` reached
`main`; run `32385476579` completed successfully, and the deployment worker
validated and deployed exact SHA
`47550034e7f3c1484ee4fe0c41c279c3b569b00a`. Production retained rollback
`/opt/solomon-dark-revived.rollback-pre-47550034e7f3-20260820T152335Z` and
database backup
`/var/backups/solomon-dark-revived/pre-47550034e7f3-20260820T152335Z/sdr.db`.
Website, game supervisor, and Caddy were active with zero restarts; both live
and backup SQLite integrity checks returned `ok`; supervisor health returned
`solomon-dark/31` with zero sessions and zero lobbies. Public and loopback
root/`/game` returned 200, and all four bodies were byte-identical at SHA-256
`480b42b4c6b92512085fbcb9f3c778a52095fcd6cea49dd9e013aa2d8b3a1d5c`.
No loot implementation, evidence, validation, publication, or production gap
remains open.

## 2026-08-22 enemy-equipment drop source re-audit

### Reported smell and parity question

- Reported concern: verify that ordinary enemy deaths can drop equippable Items,
  specifically rings and clothing, rather than only Gold, Potions, Orbs, or
  scripted rewards.
- Stock question: does `Badguy` retirement enter the Item lane, which equipment
  families can that lane materialize, and does the exact live item survive the
  Sack/pickup/inventory boundary?
- Falsifiers: an Item branch reachable only from a script action; a ground Sack
  with no held item identity; a random-equipment factory that omits a compiled
  class; or pickup that renders an item but does not insert it into authoritative
  inventory.

### Evidence and causal trace

- The preserved 4,723,200-byte PE32 retail image is still
  `SolomonDarkAbandonware/SolomonDark.exe`, SHA-256
  `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`,
  preferred image base `0x00400000`. The preserved 14,755-byte
  `data/items.cfg` is SHA-256
  `28e26243457b246ce48ed7f37d4c14820f9e4a67d1ddf5d328e3a0783a641963`.
- Native `Badguy` retirement reaches the common selector `0x0047C070`; its Item
  candidate dispatches through `Arena_SelectAndDropItem (0x0046A360)`. A named
  recipe is cloned by `0x004699B0`; one of the 110 ordinary placeholder rows
  dispatches random equipment through `0x004645B0`. Both results are held by a
  type-2013 Sack and transferred as the same live item by `0x005E6B50 ->
  0x0055FF20`.
- The authored catalog remains 47 named definitions across all six compiled
  equipment classes: 13 Rings, 9 Amulets, 4 Staffs, 6 Hats, 7 Robes, and 8
  Wands. Random equipment independently reaches the same six classes, so it
  does not require a matching authored recipe.
- Current Website `stepDyingActor` emits one reward with the actor-private loot
  seed for every drop-bearing hostile retirement. `boneyard-world.ts` passes
  each reward to `materializeBoneyardEnemyLoot`; `rollNativeEnemyLoot` enters
  `selectEnemyItem`; the resulting source-`enemy` Sack is owned by
  `BoneyardLootStore`; and `game-simulation.ts` inserts its held item through
  `insertPlayerEntityLootItem` after the first authoritative pickup.
- Exact ordinary-policy replay, without a forced category or script action,
  uses actor seed `110` at Arena level 10 with last successful Item level 10.
  Shared native RNG seeds `3,6,1,9,7,17` respectively produce Hat, Robe, Staff,
  Wand, Ring, and Amulet carriers. This is a deterministic reachability proof,
  not a claim that ordinary Item drops are frequent.

The earlier browser receipt used explicit script action `drop-item` for its
Pentaclostic Ring. That proved named-item Sack rendering, pickup, replication,
audio, and inventory credit, but by itself did not prove the enemy-selector
source. The implementation causal path is present; this re-audit tightens the
regression and browser evidence at that source boundary.

### System boundary and membership disposition

Native system: the Item member of enemy death selection, from private category
eligibility through shared recipe/random-equipment materialization, Sack
ownership, replication, pickup, and inventory insertion.

| Equipment member | Native identity and authored/random membership | Disposition | Exact web owner/proof |
| --- | --- | --- | --- |
| Hat clothing | type 7005; 6 authored recipes; random selectors 0..3; class weight 2/8 | `verified-already-at-parity` | `native-loot.ts` type/selector/color materialization; protocol and inventory renderer accept Hat identity |
| Robe clothing | type 7006; 7 authored recipes; random selectors 0..2; class weight 2/8 | `verified-already-at-parity` | `native-loot.ts` type/selector/color materialization; living equipment and inventory renderers consume the serialized colors |
| Staff | type 7004; 4 authored recipes; random selectors 0..5; class weight 1/8 | `verified-already-at-parity` | source-`enemy` Sack retains type, selector, FX, and weapon identity through pickup |
| Wand | type 7011; 8 authored recipes; random selectors 0..5; class weight 1/8 | `verified-already-at-parity` | source-`enemy` Sack retains type, selector, FX, and weapon identity through pickup |
| Ring | type 7002; 13 authored recipes; random selectors 0..11; class weight 1/8 | `verified-already-at-parity` | source-`enemy` Sack retains type, selector, FX, and ring-slot identity through pickup |
| Amulet | type 7003; 9 authored recipes; random selectors 0..11; class weight 1/8 | `verified-already-at-parity` | source-`enemy` Sack retains type, selector, FX, and amulet-slot identity through pickup |
| Named recipe versus generated placeholder | `0x004699B0` clone versus `0x004645B0` synthesized item | `verified-already-at-parity` | recipe identity/rarity and generated selector/colors/FX remain distinct on the wire and in inventory |
| Eight shipped hostile wave families | common reward handoff from Skeleton, Archer, Mage, Imp, Zombie, Wraith, Demon, and Coffin | `verified-already-at-parity` | every terminal reward enters the same world-owned materializer; Coffin Maggots remain the recorded non-drop-bearing child exception |

No member is `blocked-by-platform`; the browser host, replication schema,
WebGL carrier painter, and authoritative inventory can represent every member.
The native selector probability remains deliberately low at early Arena levels,
especially before level 5, so a short play sample with no equipment is not a
failure by itself.

### Validation contract and implementation consequence

- Add a deterministic ordinary-policy regression that reaches all six equipment
  classes through `rollNativeEnemyLoot`, asserting source `enemy`, type-2013
  Sack ownership, native type, selector, and generated identity.
- Change the browser loot journey's Item proof from scripted recipe materialization
  to enemy-selector generated Ring and Robe carriers; collect both through the
  real authoritative host and assert inventory, bitmap messages, Sack audio,
  replication, and empty browser error arrays.
- Retain the existing category, recipe, random-FX, protocol, ground-art,
  pickup, and full-inventory coverage. Run the canonical exact-tree gate plus
  the focused browser journey before finalizing this receipt.
- No behavior change or native-report rewrite is justified by the audit so far;
  `Mod Loader/docs/reverse-engineering/native-loot-selector.md` and
  `native-items-equipment-and-loot.md` already own the recovered native facts.

### Mac-only acceptance findings

- The first diagnostic candidate at Website base
  `52146891c6ac00cd25face69628c1250b826969f` passed the complete canonical
  gate on `Jarretts-Mac-mini.local` (`arm64`, macOS 26.6.2, Node 22.17.0,
  npm 10.9.2, .NET 10.0.302). The focused loot group passed 44/44 and the
  complete Boneyard group passed 1339/1339 before the remaining gates and
  production build also exited zero.
- The first two-client Chrome 151 journey completed the gameplay assertions
  through contention but correctly failed its final error audit. Five revision
  polls returned 404 from the acceptance-only Vite development server at
  `/deployment.json?current=52146891...`; there were no page exceptions.
  Production is not missing this resource: `vite.config.ts` emits
  `deployment.json` during the production build, and `Program.cs` serves it.
- The focused smoke had fallen behind the repository's established browser
  fixture contract. It must intercept `**/deployment.json*` in each isolated
  context and return the requested current full revision with `no-store`, as
  the existing secondary-ability and skeleton acceptance journeys do. This
  keeps the steady-revision contract real and leaves changing-revision/reload
  behavior owned by `smoke-game-deployment-restart.mjs`; suppressing 404s or
  weakening the error audit is not acceptable.
- After that harness correction, rerun both the complete canonical gate and the
  two-client loot journey on the same Mac tree. Only the second clean run may
  finalize the browser receipt below.
- The corrected-resource run then produced a clean gameplay receipt with empty
  error arrays, but exposed a separate teardown defect after printing JSON.
  The original context -> browser -> host order retired Chrome but left the
  host and Vite listeners; moving the host first retired its listener but then
  left Chrome blocked in `browser.close()`. That second run falsified the idea
  that implicit browser-owned context closure was sufficient on headless macOS.
  The resolved ownership order is host -> both explicit contexts -> browser ->
  Vite: clients can acknowledge the host close, context closure retires the
  two page/session owners, and browser close can finish before the asset server
  disappears. A final zero-exit run with no task-owned process/listener residue
  must prove that order rather than relying on the printed JSON alone.

### Latest-main Mac browser receipt

- While the first Mac candidate was running, Website `origin/main` advanced to
  `05c5116f711b2d62b88ac561e2ea4b628f313a62`. The final candidate was rebuilt
  from that exact head at
  `/Users/jarrett/codex-acceptance/enemy-equipment-loot-final-20260822.Pgzb30/website`;
  the intervening enemy pathfinding/world commits leave the terminal
  reward-to-loot handoff intact. The four focused files were byte-identical to
  the local isolated latest-main worktree before acceptance.
- Mac Chrome 151 ran `npm --prefix frontend run smoke:game:loot-drops` with two
  isolated browser contexts and the real authoritative host. It exited zero
  after emitting source-`enemy` type-2013 carriers for generated
  `Channeling Ring` (type 7002) and `Channeling Robe` (type 7006), then
  collecting both into authoritative backpack IDs 15 and 16. The WebGL2
  renderer was live; the two bitmap notifications each contained fourteen
  extracted-atlas glyphs.
- Sack drop audio totaled two, Sack pickup audio totaled three including the
  Potion, Gold/Orb/Bonus effects retained their exact counts, and the contested
  Gold actor credited canonical player 1 once while player 2 remained
  unchanged. Console-error, failed-response, and page-error arrays were all
  empty.
- The zero-exit run also proved the corrected teardown order: no process whose
  command referenced the acceptance root remained, and no task Vite listener
  remained on port 5173. Receipt log SHA-256 is
  `a9b5c7d02207b23c086626172a34af35e8d77a9211a1053a32904394e4dd8074`.
- Visual inspection of the 1600 x 900 Mac screenshots confirmed the stock Sack
  shells among the seven-family ground layout and, after collection, the
  visible `CHANNELING RING` and `CHANNELING ROBE` bitmap rows above the wizard.
  Visible/collected screenshot SHA-256 values are
  `5733aff7fd03844a59873cfc6e8f96f0c43b96242f6e7dca643fa6cb21d55586`
  and `67fb6fcb89f8feea723f8289b2e5cbbeec00bbc0e48962f65cb6bce838ea7fd3`.
- The complete latest-main canonical Mac gate then exited zero: 17 Website/
  backend contracts; 44 loot tests; the 233-test prerequisite group; 1,350
  Boneyard tests; weather 9, parties 43, level-up 11, diagnostics 7, Hall 17,
  Hub UI 21, and desktop 5; both builds; bundle budget; and production media
  policy all passed. Its log SHA-256 is
  `4974420e93459b06c50126d0e49bee3e00f42c00a7a9674af9df04f500996413`.
  Because recording this result changes the ledger file itself, the final
  handoff additionally requires one unchanged-command Mac repetition on the
  receipt-updated tree; that last result is reported with the working-tree
  identity rather than creating an infinite validation/receipt-edit loop.
- Publication fetches are rechecked immediately before push. If `origin/main`
  advances, the focused commit is rebased and the complete Mac gate/browser
  proof is repeated. The final handoff owns that last candidate's exact base,
  commit, acceptance path, and hashes so recording a moving publication SHA in
  this ledger cannot itself invalidate the proven tree.
