# 2026-08-26 — Native save progression, unlock persistence, and stock/web portability

## Reported smell and parity question

- Reported behavior: inspect the complete stock save system, ensure every
  gameplay-progression/unlock member survives at the correct lifetime in the
  web port, continue through adjacent unported mechanics, and determine whether
  stock and browser saves can be exchanged in both directions.
- Stock behavior to recover: the durable `darkdata.cfg` profile, the current
  wizard in `gamestate.sav`, sleeping `Region<N>._cache` state, Hall/portrait
  siblings, every progression/unlock writer and consumer, title resume
  selection, Game Over archival, clean destruction, and corruption behavior.
- Reproduction inputs: fresh profile, completed first-play profile, Lace read,
  Hagatha purchase, Machinimbus purchase, learned skill/level progression,
  active self toggles, Hub save, Boneyard save, clean close, Last Game, Game
  Over, launcher slot selection, native import, browser resume, and native
  export/load.
- Falsifiers: a native serializer for Machinimbus's eight bytes; a disk path
  that carries all three Firewalker/Mindstar/Regenerate toggles; a retail write
  below the launcher's selected `stage\\savegames` link; or an arbitrary native
  mid-Arena object graph that the web simulation can restore without a semantic
  projection would falsify the recovered boundary.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | `SolomonDark.exe` 0.72.5, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000`; re-hashed 2026-08-26 | The canonical analyzed and probed executable is unchanged. | high |
| Profile instructions | `0x005A8390`, `0x005BC1B0`, `0x005BE0B0`; profile root `0x0081A330` | `darkdata.cfg` carries gold, ten Memoratorium marker bits, first-play byte `+0x104`, ten help bytes, FIFO ages/portrait ids/counters, Lace byte `+0x105`, Luthacus storage, Hagatha bundle/first-mix state, and Shlorio fee. | high |
| Wizard disk serializer | `Skills::vftable +0x14 -> 0x0065EE80`; `Skills_Wizard::vftable +0x14 -> 0x00663AE0`; vtable bases `0x0079FEFC` / `0x007A0CD4` | Base disk payload serializes all 83 rows, level/XP, pending/deferred choices, selected roots/spells, offer seed, learned order, Hagatha ownership/list, vital/stat scalars, and associated vectors. The wizard override adds only meditation idle delay `+0x884`, Firewalker byte `+0x8DC`, and weld-effect scalar `+0x8E0`. | high |
| Network-only serializer | `Skills_Wizard::vftable +0x48 -> 0x0067C830`; sole xref at `0x007A0D1C` | The broader derived-state serializer, including adjacent toggle bytes, is a different virtual lane. It is not the `+0x14` disk serializer and cannot justify disk persistence. | high |
| Advanced-unlock census | `0x004F90C0`, globals `0x00B3BDD8..0x00B3BDDF`; consumers `0x004F8480`, `0x00579E90`, `0x0065E830`, `0x0065EBA0` | Machinimbus sets eight process globals. No profile/progression save call or direct disk serializer reference exists. A purchased-but-unlearned advanced spell has no retail persisted representation; a learned row remains visible in the 83-row book. | high |
| Native save corpus | controlled Hub `gamestate.sav`, 27,788 bytes, SHA-256 `d562fe8ec3db4a6159b6422913b7a0a5f4dfd14c974894af5861ce70e1ff0cfc`; 26 older independent gamestates | Every sampled file has eight root children; root child zero is the local wizard; its first child is the 83-row progression node. Name length varies safely and progression payload length varies with serialized vectors. All parse/re-encode byte-identically. | high-live |
| Live profile diagnostic | task-owned Windows instance `save-unlock-probe-20260826`; injected loader supporting diagnostic | The Machinimbus Acid Rain byte changed `0 -> 1` in memory. A normal WM_CLOSE then persisted a simultaneous gold change `698 -> 777` into `darkdata.cfg`, while the advanced byte has no encoded field. This supports the static boundary; the known launcher routing defect prevented treating the next staged launch as a same-tree restart receipt. | medium-live |
| Launcher source/live route | `StageSandboxCompatibilityLinks.cs`, `StagedGameLauncher.cs`, `CloudSaveBackupCoordinator.cs`; G10 `sav-route` receipt | An override recreates only `stage\\savegames`; retail writes `stage\\sandbox\\savegames`. Native play, watcher backup, restore, and selected-slot claims therefore address different trees. | high |
| Current web save | schema 15, `game-save-contract.ts`, `game-save-document.ts`, `game-host.ts`, cloud/IndexedDB slot zero | The web owns a complete normalized authoritative document but has no native source attachment, importer/exporter, native codec, or launcher routing closure. It also names some current-wizard state more durably than retail can represent. | high |

The native live runs above were isolated task-owned instances. Runtime addresses
were obtained by rebasing preferred addresses through `sd.debug`; no runtime
address is reused as static evidence. The generated Hub template is a stock
writer output observed through an injected loader, not a clean-stock appearance
capture, and is labeled accordingly.

## System boundary and membership inventory

Native system: retail player persistence from profile/current-wizard mutation
through disk encoding, launcher routing, Last Game reconstruction, Game Over
archival, and portable semantic projection into or out of the web authority.

| Member | Native source | Disposition required by this pass | Proof contract |
| --- | --- | --- | --- |
| SyncBuffer container, names, order, bounds | `0x004248F0`, common save files | exact-ported | hostile decode plus byte-identical encode |
| darkdata XOR/marker-LZ wrapper | `0x004258B0`, G10 goldens | exact-ported | all three goldens and mutation corpus |
| durable gold | profile `+0x58` | exact-ported | stock -> web -> stock scalar round trip |
| first-play completion | profile `+0x104` | exact-ported | maps both web onboarding obligations without resetting existing profiles |
| ten Hub help flags | profile `+0x9A..+0xA3` | exact-ported | every row maps to the existing NPC help state |
| Lace one-shot | profile `+0x105`, `0x004FA290` | exact-ported | 26 -> 25 BookReview membership after import/resume/export |
| Memoratorium marker/FIFO/portrait fields | profile `+0x90`, `+0xA4`, `+0xCC`, `+0xF4..+0xFC` | out-of-system for account import (shared Website memorial is process authority); byte-preserved in native attachment/export | import cannot overwrite the shared memorial; untouched bytes remain exact |
| Luthacus polymorphic storage | profile `+0x8C`, darkdata child 1 | exact-preserved, semantically projected only for supported native item members | opaque subtree retained; unsupported materialization is reported, never dropped on export |
| Hagatha bundle selectors | profile `+0x60/+0x64` | corrected by the 2026-08-30 Hagatha reopening | ordered selectors and both repeated Tonic rows survive; no sorted-set normalization |
| Hagatha first-mix flags | profile `+0x6C[30]` | exact-ported | every selector price state survives |
| Shlorio fee | profile `+0x100` | exact-ported | exact fee survives |
| local wizard name/class | gamestate root child 0 plus progression roots | exact-ported | all 15 element/discipline combinations and UTF-8 bounds |
| all eight root rows | Create finalizer `0x005D0290` | exact-ported | roots 0..7 rank one; selected identities remain separate |
| level, XP, thresholds | progression `+0x30..+0x3C` | exact-ported | native levels 1..75 and cap policy |
| permanent/effective rows 0..82 | progression table, disk `0x0065EE80` | exact-ported from permanent ranks; effective ranks rebuilt | every row/cap/rank bound asserted |
| Unforge max-HP/max-MP base bonuses | mutations at progression `+0x6C/+0x78`; omitted by `0x0065EE80`; post-load refresh `0x0065F9A0` | out-of-system for pure retail persistence; stock import rebuilds maxima and preserves saved vital ratios; stock export warns | web bonuses remain web-durable but cannot survive an unmodified retail process restart |
| learned/visible order | progression `+0x850/+0x854` | exact-ported | Hall/SkillScreen tie order retained |
| selected element/discipline/starting spells | `+0x82C/+0x830/+0x86C/+0x870` | exact-ported | immutable class/action defaults survive independently from live selection |
| selected primary | local-wizard trailing `i32` plus Game binding 12 | exact-ported for pure rows; temporary Plane Orb resets; selected Weld resets because its synthetic build is not a disk member | both duplicated native values must agree; learned pure selection survives stock-web-stock |
| concentration A/B and replacement cursor | Game bindings 16/20; Game `+0x1C24` | exact-ported for materially learned rows | A/B uniqueness, Split Mind B, next A/B replacement owner, and stock-web-stock state survive |
| eight BeltButton slots | Game root payload; type 7015 skill rows plus non-skill entries | exact-ported for skill entries; non-skill members exact-preserved | skill order/duplicates/removal survive; potions/items remain byte-identical unless a web skill intentionally replaces that slot |
| active synthetic Weld build | progression `+0x844`; omitted between serialized `+0x840` and `+0x848` | out-of-system for retail disk portability | learned row 52 survives; selected/belted Weld warns and resets to the creation primary for stock/web settled import |
| offer seed, pending/deferred choices | `+0x834`, `+0x44/+0x48` | exact-ported | deterministic next offer and queued-choice count |
| Hagatha ordered outcome list/ownership/capacity | `+0x7C0/+0x7C4`, `+0x7CC[50]`, `+0x800`; admission `0x0056C340`; producer `0x0066EF70` | corrected by the 2026-08-30 Hagatha reopening | purchase order survives; ordinary selectors are unique; repeatable selector 27 Tonic appears up to twice, remains visible, and counts toward total capacity; the complete list has at most 3/6/9 entries |
| selected Boast lifecycle | Game serializer `0x005CE3D0`; `Gameplay+0x1D44/+0x1D48/+0x1D80/+0x1D81`; progression random flag `+0x2D` | exact-ported | selected ID and authored statement, one-shot failure, success, ID-3 random-choice byte, score/eulogy state, and stock-web-stock bytes agree; local XP gate `+0x2C` remains true |
| Serendipity/Reverie active-until-hurt bytes | progression `+0x73C/+0x73D`; purchase producer `0x0066EF70` | out-of-system for stock disk portability; clear on stock import like retail disk restore | ownership persists, but consumed one-shot effects are never resurrected by import |
| Firewalker active state | wizard disk override `0x00663AE0`, `+0x8DC` | exact-ported | native import/export and web resume preserve it |
| Mindstar/Regenerate active state | network serializer `0x0067C830`, no disk member | out-of-system for stock disk portability; web resume resets these nonpersisted toggles | explicit negative disk and reset tests |
| Mind Chug and active casts/UI | no durable disk member in recovered serializers | out-of-system for portable wizard projection | import starts a settled Hub with no replayed transient |
| Machinimbus purchase-only bytes 72..79 | `0x00B3BDD8..DF` | out-of-system for pure retail persistence; learned rows infer availability | purchased-only warning; learned advanced rows survive |
| native selected story path/unlock bitmap | Game `+0x1BD8/+0x1CDC` | out-of-system for web world projection; stock export normalizes the selected path to portable stock Survival while preserving the unlock bitmap | no invented Website/story-map mapping; exported path has no machine-local absolute prefix |
| active native Hub/Arena object graph | `gamestate.sav` and Region caches | out-of-system for semantic cross-engine projection; source bytes preserved | import starts a fresh web Hub; export patches a validated native base/template |
| Hall of Fame and raw portraits | `halloffame.dat`, `Portraits\\portrait<N>.raw` | out-of-system for untrusted Website-global Hall; losslessly retained when supplied | no account/global score injection |
| settings credentials/network fields | `settings.txt` | out-of-system | never imported or uploaded |
| resume selector | `Game.Resume` plus run directory | exact-ported in launcher bridge | valid existing selector kept; one unambiguous exported run materialized |
| launcher selected slot | native `stage\\sandbox\\savegames` | exact-ported | native sentinel write/backup/restore path proof |
| corrupt/truncated/ambiguous input | retail zero-fill vs strict bridge policy | exact-ported safety boundary | copied input fails closed; source remains untouched |
| abrupt browser termination after latest checkpoint | browser process/network constraint | blocked-by-platform | bounded periodic checkpoint remains the predicted difference |

No native profile, Hall, or arbitrary Arena bytes are accepted as account or
leaderboard authority. Native imports are always `local-only`. The portable
unit is a settled wizard/profile projection, not a promise that two different
engines can resume the same in-flight projectile, actor pointer graph, or
browser party capability.

## Native ownership thread and recovered contract

- `0x005BE0B0` writes the durable profile. `0x005CBE10` writes the current
  `Game`; root child zero is the local wizard and reaches the `+0x14` Skills
  disk virtual. Clean `Game` destruction writes profile then game state.
- The current wizard disk payload is self-describing only through native call
  order. It has no tags or version, so the bridge validates the exact root,
  row count, child structure, vector bounds, class roots, thresholds, and
  trailing exhaustion before assigning semantics.
- Effective ranks/stat caches are regenerated from permanent ranks, items,
  perks, and the selected class. Pointer values and runtime caches never cross
  the bridge as authority.
- `Skills_Wizard +0x14` proves that only Firewalker of the three adjacent self
  toggles has a disk byte. The broader `+0x48` serializer remains useful for
  network state but is not save evidence.
- Machinimbus purchase changes session globals. The portable bridge can carry a
  learned advanced row, but no honest unmodified-retail file can encode
  "purchased but not yet learned." The UI must say so before export.
- Stock and web use different world/runtime topologies. The bridge therefore
  preserves the original native files as an attachment, imports understood
  wizard/profile state into a fresh authoritative web Hub, and applies later
  understood web changes back onto a validated native base (or controlled Hub
  template) without rewriting opaque sibling nodes.
- Hagatha `+0x7C0/+0x7C4` is an ordered outcome vector, not a sorted set.
  PerkShop `0x0056C340` first compares the complete `+0x7C4` count against
  `+0x800`; Tonics are not subtracted. `ActorProgression_ApplyHagathaPerk
  0x0066EF70` appends each purchase;
  ordinary selectors reject duplicates, while selector 27 Tonic appends once
  per direct purchase (at most twice), occupies a list cell, and then raises
  capacity 3 -> 6 -> 9. Common apply
  still sets ownership byte 27; only duplicate-list rejection is bypassed. The
  web authority, protocol, save, Hall
  projection, and stock bridge must retain that exact list. Protocol 86 owns
  the ordered/repeated projection; schema 17 owns it directly, while schemas
  1..16 migrate the older sorted ordinary set by appending their recorded
  Tonic count and total list length no greater than capacity. PerkShop close
  `0x0056C230` also copies the ordered current list, including both Tonics,
  into the next profile-owned Bargain Bundle.
- The same serializer audit distinguishes ownership from runtime: purchase
  writes Serendipity/Reverie active bytes at `+0x73C/+0x73D`, but disk
  serializer `0x0065EE80` never emits either offset. A stock import therefore
  clears both active flags instead of reactivating them from ownership.
- Unforge max-health/max-mana bonuses are another retail disk defect. The shop
  mutates base HP/MP `+0x6C/+0x78`; `0x0065EE80` writes current/max
  `+0x70/+0x74/+0x7C/+0x80` but not either base. Post-load `0x0065F9A0`
  snapshots the saved current/max ratios, rebuilds maxima from constructor
  bases, then reapplies those ratios. Stock import must emulate that result;
  stock export can carry the ratio but must warn that a web base-stat bonus
  itself has no retail disk representation.
- The durable Boast is elsewhere in the resumable Game node. Game vslot
  `+0x14 -> 0x005CE3D0` serializes selected signed ID `+0x1D44`, exact statement
  String `+0x1D48`, failure `+0x1D80`, and success `+0x1D81`. Those fields own
  random skill choice (ID 3), failure gates, score bonus, and eulogy. Preserving
  only the opaque Game bytes would make stock-imported web play forget the
  Boast and web changes fail to reach stock, so the bridge must map all four.
  It must also patch serialized progression `+0x2D` to `selected == 3` and
  require the local-wizard XP gate `+0x2C`; otherwise the text and actual
  level-up behavior diverge after stock load.
- Launcher selection must own the path retail actually opens. A compatibility
  alias may remain, but `stage\\sandbox\\savegames` is the writer/watcher/mirror
  source of truth.

## Nearby-system findings

- The earlier save-format label "class availability flags" is stale. Profile
  `+0x90[10]` is the Memoratorium urn-marker array already closed by the
  memorial producer pass.
- The earlier progression persistence statement conflated disk vslot `+0x14`
  with network vslot `+0x48`. It overclaimed all three active toggles as disk
  state and must be corrected in the durable native report.
- The launcher cloud archive loses `settings.txt`, including `Game.Resume`.
  The safe bridge is to derive only one unambiguous exported run when the
  existing selector is absent/invalid; credentials and renderer settings stay
  untouched.
- A native archive can be losslessly round-tripped even when a semantic member
  is not yet materialized in web gameplay, provided its ordered bytes remain in
  the bounded native attachment. Preservation is not a claim that the web
  consumes that mechanic.

## Confidence and open questions

- Confirmed: executable identity; profile field census; exact disk/network
  vtable slots; complete base progression write order; local-wizard tree path
  across 27 gamestates; advanced-global xrefs; launcher path mismatch.
- Inferred but implementation-safe: an already learned advanced row is treated
  as available on web import even though retail's purchase-only byte is absent;
  otherwise the imported learned row would be unusable.
- Explicit platform/product limits: arbitrary in-flight native Arena state is
  preserved but begins as a fresh web Hub; Website-global Hall/memorial state
  cannot be overwritten by an untrusted personal file; abrupt browser loss can
  still miss the post-checkpoint window.
- No extractable native constant/table required by the portable wizard/profile
  mapping remains unnamed. Unsupported polymorphic item materialization must
  remain explicit and byte-preserved rather than guessed.

## Web and launcher implementation consequence

- Add strict TypeScript native codecs and a portable profile/wizard mapper.
  Imported stock sources remain attached with hashes and bounded bytes; schema
  migration keeps older browser saves valid. One semantic gamestate is
  required; non-gamestate launcher members are retained as path/hash/base64
  rows and re-exported byte-identically without becoming Hall or profile
  authority. `settings.txt` is rejected rather than attached because its
  credentials/network/Resume fields are outside the portable trust boundary.
- Build a settled Hub continuation from the mapped local wizard, never from a
  rendered snapshot. Mark it `local-only`, clear nonpersisted selection/action
  state, rebuild derived ranks/stats, and retain deterministic offer ownership.
- Export by patching the known fields of the attached native base, or the
  controlled Hub template for a web-origin wizard. Parse the result again and
  prove every untouched node byte and file hash before packaging it.
- Correct fresh class books to all eight native roots. Preserve Firewalker at
  the save boundary; clear Mindstar, Regenerate, concentration, and other named
  non-disk selection state on disk-style resume.
- Correct launcher routing and Wine mirror ownership, then set `Game.Resume`
  only when one exported run is unambiguous and an existing valid selector is
  unavailable.
- Add Save Manager `Import Save ZIP` for the browser-generated launcher
  archive. It runs the existing manifest/hash/path validator, preserves strict
  source-slot matching for cloud restore, and uses the explicitly selected
  local slot for manual import before normal Resume materialization.
- Account slot I and title Settings -> Save Transfer expose explicit import
  preview/replace and stock export over the same cloud-or-IndexedDB save
  coordinator. No implicit retail-install scan, credential import, silent
  overwrite, or global score eligibility is allowed.

## Validation contract

- Native codecs: every G10 darkdata golden, the controlled Hub gamestate, all
  83 rows, every vector/flag/member, exact encode round trip, malformed counts,
  duplicate names, trailing bytes, compressed bombs, and unsupported item
  materialization.
- Portable mapping: all 15 classes, levels 1/2/75, every learned row, ordered
  ties, pending/deferred choices, 30 first-mix flags, 50 Hagatha flags, Lace,
  help/onboarding, Firewalker, learned advanced rows, and negative purchased-
  only/Mindstar/Regenerate cases.
- Launcher: Windows junction and Wine mirror both route the actual native path,
  cloud close copies the actual mirror, valid Resume is preserved, and one
  exported run is materialized without touching credential rows.
- Schema/storage: schema 17 frontend/backend parity, schemas 1..16 migration,
  source attachment bounds/hash validation, conditional cloud replacement,
  Game Over/wizard retirement retention, and unknown-version rejection.
- Browser: exercise Account/cloud and anonymous title-Settings/IndexedDB import
  preview -> slot replacement -> `/game` Last Game -> exact wizard/level/ranks/
  Lace/Hagatha state -> stock export -> reload, with empty page/console/failed-
  response arrays.
- Stock: use the exact Mac-built Windows launcher candidate to load the exported
  archive in the retail executable and compare the local wizard name, class,
  level/XP, learned-order/ranks, perks, gold, Lace/help/onboarding, and
  Firewalker fields.
- Run the Mod Loader registered portable suite and the Website's complete
  `/opt/homebrew/bin/bash ./scripts/validate.sh` gate on the Mac mini only.

## Implementation validation receipt

- The clean rebased Website candidate passed
  `/opt/homebrew/bin/bash ./scripts/validate.sh` on the Mac mini: backend build
  and integration contracts, formatting, frontend lint/boundaries/generated
  assets, every frontend and desktop suite, production frontend/game-host
  builds, bundle budget, and production media policy all exited zero.
- Real Mac Chrome exercised both storage owners. Anonymous IndexedDB and an
  authenticated cloud account each imported the controlled stock archive,
  previewed POMPONIUS as level 1 Fire/Arcane with 500 gold, wrote revision 1,
  resumed through Last Game, persisted revision 2, exported, reloaded, and
  resumed again. Both downloaded 28,619-byte archives with SHA-256
  `c70859cdb52e709a7e586bde542b200f9dc4c9f32c10bc7f7fa0528e5eb176c8`;
  page/console errors were empty after the standard Vite-only deployment
  manifest route was fulfilled.
- The exact final Mod Loader candidate passed `510/510` registered static RE
  contracts and its managed Windows build on the Mac. That Mac-built x86
  contract executable then passed every launcher contract on Windows plus the
  real browser-produced archive import, including manifest/hash validation,
  destination-slot materialization, and native Resume selection.
- The task-owned Windows stage used the exact retail EXE SHA-256
  `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`,
  all 40 discovered mods disabled, and the browser ZIP as its selected save.
  Stock exposed `RESUME LAST GAME`, loaded POMPONIUS into the Hub, and showed
  Fireball plus Ring of Fire on its native Skills screen. An ordinary close
  rewrote a valid 26,897-byte gamestate with SHA-256
  `0c6d19652ede0e6794b49de40c5d1eb8694f87cf195375d06f35a61dd979bbc9`.
- That retail rewrite exposed two adjacent variants now closed in both codecs:
  the null-Boast statement may become the one-byte `0x01` sentinel, and a
  first-process control-scheme/Create path may emit root rows `0..7` at rank
  zero while retaining the authoritative Fire/Arcane roots and starter spells.
  Strict decoding accepts only the proved sentinel; web import reconstructs
  all eight class roots at rank 1 and keeps public learned order scoped to rows
  `8..79`.
- The iPhone was reported available again, but this Mac has neither the full
  Xcode `devicectl`/`xctrace` utilities nor a libimobiledevice/Appium bridge, so
  no physical-iPhone automation receipt is claimed. That optional device proof
  is separate from the completed real-Chrome, Windows-launcher, and retail
  compatibility gates. No production deployment was performed.

## 2026-09-01 - Pending-offer checkpoint and legacy barrier reopening

### Reported smell and causal evidence

- A live census of all 11 retained production slot-0 documents found one
  current crash candidate: save row 30, revision 125, schema 22. It owns an
  active level-20 Boneyard run and a one-player barrier whose pending player
  has `pendingLevels: [20]` but `pendingOffer: null`.
- On exact current main, the document restores and keyframes, then the real
  protocol decoder fails with
  `frame.levelUpBarrier pending player has no skill offer`. The other ten
  documents across schemas 3, 15, 18, 19, 22, 24, and 27 restore, keyframe,
  decode, checkpoint, reload, and decode; their two active Boneyards contain
  10 and 27 live enemies.
- Causal trace: `createGameSaveDocument` first projects the single owner and
  correctly reconciles the multiplayer barrier through player removal. Its
  `diskPlayerStoreProjection`, introduced by `b1073b1164d0b3ff661038b30e3e6fb6d8e0f658`,
  then unconditionally replaces the authoritative pending offer with null
  while leaving the queued level, barrier, offer seed/cycle, revision, and
  gameplay RNG. Resume preserves that contradiction until the strict client
  decoder rejects the first frame.
- This falsifies the earlier implementation receipt, not the native model.
  The retail `Skills +0x14` disk lane persists pending/deferred choices and
  offer seed, and the later offer-lifecycle ledger already requires an
  already-pending web offer to serialize without rerolling.

### Reopened system boundary and complete membership

Native/web system: player-owned pending skill choice from offer construction
through barrier freeze, owner-only checkpoint, cloud/local storage, restore,
keyframe/full snapshot, selection/defer/reroll, queued follow-up, disconnect,
and teardown.

| Member | Disposition | Proof contract |
| --- | --- | --- |
| current pending offer identity/options/Insight/Weld data | `exact-ported` in schema 28 | writer preserves exact bytes; restore does not reroll |
| queued `pendingLevels` and deferred choices | `verified-already-at-parity` | order/count survive checkpoint |
| offer seed, cycle, revision, gameplay RNG | `verified-already-at-parity` | unchanged for current exact offer |
| one-player Hub/Boneyard barrier | `exact-ported` | save -> restore -> full/keyframe decode retains freeze and picker |
| multiplayer owner-only checkpoint | `exact-ported` | removed peers leave one coherent cohort and owner offer |
| selected owner while peers remain pending | `verified-already-at-parity` | owner projection retires the now-empty local barrier |
| Reroll, Save Skill, automatic choice, queued next offer | `verified-already-at-parity` | existing authoritative transitions remain unchanged |
| legacy schemas 1..27 with queued levels and erased offer | `exact-ported` recovery of a legal pending choice | rebuild once at the persisted sequence/cycle, advance the saved gameplay RNG, then emit schema 28 |
| exact historical cards erased by the old writer | `out-of-system` due irreversible historical data loss | migration makes no claim to recover missing option bytes; it constructs one lawful replacement from retained book/seed/RNG state |
| legacy/current barrier with neither offer nor queued level | `out-of-system` malformed state | fail closed before snapshot publication |
| schema 28 with a missing pending offer | `out-of-system` malformed current state | fail closed; no compatibility repair |
| backend slot storage schemas 1..28 | `exact-ported` bounded admission | current accepted, legacy retained, 29/future rejected |
| Game Over/loadout/profile-only saves | `verified-already-at-parity` separate lifecycle | no active barrier checkpoint is synthesized |

No member is browser-blocked. One historical option set is unknowable because
the old web writer deleted it; that data-loss limitation is confined to the
legacy migration and does not weaken current schema-28 ownership.

### Implementation and validation contract

- Stop deleting `pendingOffer` from the disk player projection. Keep the
  existing explicit resets for nonpersistent combat/toggle state.
- For schemas 1..27 only, rebuild a missing offer when both the barrier and
  nonempty queued levels prove the choice is owed. Preserve offer
  sequence/cycle metadata and advance the persisted gameplay RNG through the
  ordinary builder. Schema 28 and unreconstructible state fail closed.
- Advance the frontend/backend save contract to schema 28 and make the
  backend reject future schemas instead of storing a document the game host
  cannot load. Advance the exact-match game protocol to 116.
- Regress exact current-offer round trip, synthetic schema-27 repair,
  malformed schema-28 rejection, backend current/future admission, and the
  real keyframe decoder. Repeat all 11 retained production saves through
  restore/keyframe and checkpoint/reload on the exact Mac candidate.
- Run the canonical Mac gate and a built Chrome pending-picker save/reload
  journey. Final validation, publication, and cleanup receipts follow after
  those gates complete.

### Implementation validation receipt

- Schema 28 keeps `pendingOffer` in the owner-only disk projection. Schemas
  1..27 rebuild only a missing offer backed by a nonempty queued-level list,
  at the persisted sequence/cycle; current malformed state fails before
  snapshot publication. The backend accepts 1..28 and rejects 29/future.
- Focused Mac coverage passed all 74 save/protocol/kernel tests and the live
  backend slot integration contract. A complete production census then
  restored, keyframed, decoded, checkpointed, rewrote, reloaded, and decoded
  all 11 retained saves across schemas 3, 15, 18, 19, 22, 24, and 27. Row
  30 was the sole repaired document; every output was schema 28 and the
  failure array was empty.
- Built Mac Chrome/WebGL2 created a real level-2 offer with sequence 2 and
  options `67/50/18`, checkpointed it as schema 28, restored it into the live
  host byte-for-byte, retained the modal, selected through the ordinary
  browser action, and released the barrier. Page, console, and failed-response
  arrays were empty under protocol 116. The inspected PNG SHA-256 is
  `8154d09f42081a00f40f93c54397e43c376f2868d9baf005c624ac7e09a4153a`;
  the compact browser log SHA-256 is
  `1de053d7a51968b6995f9c6f67e4133246318714ee10090ff59c4d1b5f46e08b`.
- Two preliminary browser harnesses armed the barrier before post-Create Hub
  input admission and timed out waiting for presentation. Adding the same
  authoritative movement precondition used by the maintained picker smoke
  produced the successful receipt above; no product source changed for that
  harness correction.
- The complete gate and bundle receipt are recorded in entry 081. No current
  offer member is browser-blocked. The exact historical cards erased by the
  old writer remain explicitly unrecoverable; the legal legacy replacement
  is the only bounded data-loss migration. This receipt is the only tracked
  change after the cited gate, so the gate and built journeys are repeated on
  the receipt-bearing tree before publication.

## 2026-09-01 - Browser-continuation support file in stock ZIP exports

### Reported smell and parity question

- The player-facing `solomon-dark-stock-save-*.zip` export was used as a bug
  attachment for an active Boneyard run. Its native files carried the wizard's
  progression but could not replay the reported Arena, actors, or positions.
- The user requested that the same ZIP include the authoritative browser save
  as an extra file so a supplied archive can reproduce the Website run.
- The stock projection and browser continuation must remain separate owners:
  retail still consumes `darkdata.cfg` plus `gamestate.sav`, while support
  diagnostics consume the normalized Website document.
- Falsifiers are that the existing ZIP already contains the normalized
  continuation, the launcher rejects a manifest-listed ordinary savegame file,
  the continuation can be shared without removing its party-rejoin capability,
  or repeated stock -> web -> stock transfer can retain old support state
  without making the attachment stale or recursively larger.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Submitted export | `solomon-dark-stock-save-1788225845832.zip`, SHA-256 `8619d9a29f4678dfc190386a46d5671bc108e412c86db4ff898348a7710f5ac3` | The manifest names only `solomondark/darkdata.cfg` and one `_survival/gamestate.sav`; exact template-patch equality proves neither member carries the live Website Boneyard. | high |
| Current browser document | schema 28 `game-save-document.ts` / `game-save-contract.ts` at Website `78644867` | `continuation.loadedBoneyard` plus the owner-projected simulation carries the materialized scene, run/tick/RNG, player, waves, encounter, enemies, loot, spells, and other authoritative runtime state required by Last Game. | high |
| Current export path | `exportWebGameSaveToNativeArchive` -> `createNativeSaveArchive`; `NativeSaveTransferSettings`, Account slot I | The exporter validates the browser continuation, patches a native base/template, and writes only native semantic and opaque retained files. Both player-facing export surfaces call this same owner. | high |
| Launcher archive reader | read-only `CloudSaveArchive.ValidateAndExtract` in the existing Mod Loader checkout | A manifest-listed file under `savegames/solomondark/` is hash-, size-, path-, count-, and expansion-validated and restored without an allow-list of retail filenames. | high static |
| Capability boundary | schema-28 `summary.partyRejoinToken`; `nativeSource` attachment | The rejoin token is a live signed capability and must not enter a player-shared support artifact. Retaining `nativeSource` would duplicate the native files inside the sidecar and permit recursive growth after import/re-export. | high |

No new stock executable claim is needed. This is a Website support-extension
member carried beside, rather than inside, the byte-compatible retail files.

### Reopened system boundary and complete membership

Native/web system: one player-requested stock ZIP from authoritative browser
slot through native projection, manifest construction, support-sidecar
sanitization, launcher preservation, support extraction, stock import, repeated
export, and exact Website replay.

| Member | Disposition | Proof contract |
| --- | --- | --- |
| `darkdata.cfg` profile projection | `verified-already-at-parity` | bytes and decoded profile remain unchanged by adding the sidecar |
| `gamestate.sav` wizard projection | `verified-already-at-parity` | bytes, bindings, and retail run name remain unchanged |
| launcher manifest membership/hash/size | `exact-ported` for the Website extension | the support file is listed once and its byte hash/size verify |
| support path `solomondark/browser-game-save.json` | `exact-ported` | one compact UTF-8 schema-28 document appears under `savegames/` |
| Hub continuation | `exact-ported` | sidecar restores the same owner/profile state while Hub keeps its existing regeneration contract |
| active Boneyard continuation | `exact-ported` | loaded scene, run id, tick, RNG, player, encounter, waves, enemies, loot, spells, and secondary state survive sidecar restore |
| multiplayer owner projection | `verified-already-at-parity` | no peer player entity is added to the support document |
| signed party-rejoin capability | `out-of-system` for a shareable attachment | sidecar summary always carries `partyRejoinToken: null` |
| account/global integrity authority | `out-of-system` for a shareable attachment | sidecar is always `local-only` and cannot create authoritative leaderboard/account provenance |
| native source attachment | `out-of-system` for the sidecar | `nativeSource: null` prevents duplicated native bytes and recursive archive nesting |
| active mods and bounded mod state | `exact-ported` | identities/state remain present for diagnosis and ordinary mismatch confirmation |
| existing opaque native retained files | `verified-already-at-parity` | all non-sidecar members remain byte-identical |
| stale support file from an imported prior export | `exact-ported` replacement lifecycle | stock import ignores it as web authority; re-export removes it and writes exactly one current sidecar |
| malformed or hostile sidecar in an otherwise stock archive | `out-of-system` for stock semantic import | manifest integrity remains mandatory, but stock import neither executes nor resumes the sidecar |
| automatic player-facing browser-sidecar import | `out-of-system` for this request | the file is a support/replay artifact; the existing explicit stock import continues to create a settled Hub |
| profile-only document without a current wizard | `out-of-system` under the existing exporter contract | no Boneyard/support continuation exists to package |
| archive size/file-count limits | `verified-already-at-parity` fail-closed boundary | the existing 16 MiB ZIP, 64 MiB expanded, and bounded-file contracts still reject overflow without dropping opaque files |

There is no browser-platform block. Abrupt termination can still leave the
ordinary browser slot at its latest acknowledged checkpoint; the export must
carry exactly the document selected by the player, not claim a later tick.

### Ownership thread and recovered behavioral contract

- The game host remains the only producer of authoritative state. Cloud or
  IndexedDB slot zero remains the durable resume owner; the export action reads
  one already-accepted document from that coordinator.
- Native portability still maps only the stock-representable wizard/profile
  fields into `darkdata.cfg` and `gamestate.sav`. The new file does not change
  or reinterpret either native serializer.
- Sidecar construction must restore and re-encode the document through the
  strict current codec. That canonicalizes legacy schemas and proves the
  continuation before any bytes are shared.
- Sanitization removes the signed party-rejoin token, removes `nativeSource`,
  and marks the result `local-only`; it retains the complete owner-projected
  simulation, loaded Boneyard, content identities, and mod state.
- The ZIP manifest owns the sidecar's path, byte count, and SHA-256 alongside
  the native members. A launcher may preserve the unknown ordinary file, while
  retail continues reading only its known native save members.
- Stock import deliberately filters the support path before constructing a
  portable profile. A later export therefore writes current Website state and
  cannot preserve an old sidecar or nest one inside another.

### Nearby-system findings

- The existing export label describes only the native projection even though
  support reports use the entire ZIP as an incident artifact. The settings
  copy must state that a sanitized Website continuation is included for
  support and that stock ignores it.
- A raw authoritative slot is not safe to publish unchanged because its
  Boneyard summary may carry a signed party-rejoin capability. The sanitizer,
  not user instructions, owns that boundary.

### Confidence and open questions

- Confirmed: current archive membership, exact report ZIP contents, schema-28
  Boneyard ownership, both export callers, native retained-file path rules,
  launcher extraction behavior, and the signed capability/source-attachment
  fields that must be removed.
- Inferred: retail ignores the additional ordinary filename because no
  recovered retail save/load path names it; native compatibility remains
  measurable through unchanged semantic-file bytes and launcher acceptance.
- Unknown: none material to the Website support-sidecar implementation.

### Web implementation consequence and validation contract

- Add one archive-owned support path constant and one canonical shareable-save
  encoder. The exporter appends its UTF-8 bytes after filtering any prior
  case-insensitive instance of that path.
- Keep the native archive schema, native files, stock import action, and browser
  save schema unchanged. Do not add an alternate snapshot serializer or embed
  state in `gamestate.sav`.
- Focused Mac tests must prove Hub and active-Boneyard round trips, complete
  authoritative state equality, `local-only`, null capability/source, exact
  native semantic bytes, manifest integrity, stale-sidecar replacement, no
  recursive growth, and stock-import filtering.
- Built Mac Chrome must enter a real Boneyard, force a durable Leave Game
  checkpoint, download the ZIP, extract and validate the support document,
  replace local slot zero with that document, and resume the same run through
  a fresh host with empty page/console/response arrays.
- The exact candidate must pass `/opt/homebrew/bin/bash ./scripts/validate.sh`
  on the Mac mini. Publication and deployment remain separately unauthorized.

### Implementation validation receipt

- `createGameSaveSupportDocument` now restores through the strict current codec
  and re-encodes one `local-only` continuation with `partyRejoinToken: null`
  and `nativeSource: null`. `exportWebGameSaveToNativeArchive` appends those
  UTF-8 bytes at `solomondark/browser-game-save.json`, replacing any prior
  case-insensitive member. Stock import filters that path before constructing
  the portable Hub profile. Native `darkdata.cfg`, `gamestate.sav`, opaque
  sibling files, archive schema, browser schema, and protocol are unchanged.
- Mac red proof passed all 17 existing portability tests and failed only the
  two new contracts: the Boneyard export found zero support files, and an old
  support member remained stale. Combined-log SHA-256 is
  `5635daf728d5ae6eb6e24317b04d6fd811db58a30c71010ce075eeaf712ce538`.
  The final focused suite passed `19/19`, including one authoritative Wraith,
  exact complete-state equality, unchanged native projections, capability and
  source removal, manifest integrity, case-insensitive stale replacement,
  stable repeated-export size, and stock-import filtering. Combined-log
  SHA-256 is
  `9d46790fe1be73fe76336462fbf883d3d908d338f070c7471c58e55a635cf617`.
- Built Mac Chrome/WebGL2 passed the anonymous active-Boneyard and authenticated
  cloud journeys with empty page, console, failed-response, and request-failure
  arrays. The anonymous final Leave Game advanced slot revision `1 -> 4`,
  downloaded a 786,450-byte ZIP, extracted a 757,531-byte schema-28 support
  document at tick 9, replaced IndexedDB slot zero with that exact sidecar, and
  resumed run `135c3088ac460a9ad2a6bbf6e918a929` through a fresh host with its
  authoritative Wraith intact. The cloud journey advanced revision `1 -> 2`
  and exported the same support member from the Account surface. Browser-log
  SHA-256 is
  `17fc583102077542d778de4d5ef3aedce2b2c94c884e415e0b9b8fe74eed1656`.
- Independent archive inspection found exactly `manifest.json`, native
  `darkdata.cfg`, native `_survival/gamestate.sav`, and
  `browser-game-save.json`. The ZIP SHA-256 is
  `b9b589271bde615b7545d47c479658a6f9ed5b9763fbad7697a1058a85568cc4`;
  the manifest hashes the sidecar as
  `4ea3efa6de3b29da504277d3121918fc5bbb0c84c3c4fe41bc0527978f764b17`.
  The three run ids agree, `activeRun` is true, integrity is `local-only`, and
  both capability/source fields are null. The inspected resumed frame is
  visually coherent; screenshot SHA-256 is
  `fe171da33c8cea4b0424f0fd6255bf679749b46515775e8bd7f32fe39d61b0ac`.
- The final receipt-bearing Mac tree passed `/opt/homebrew/bin/bash
  ./scripts/validate.sh`: 19 backend/integration contracts, the complete
  `1,753/1,753` broad Boneyard/runtime suite, every later frontend/desktop
  suite, production frontend and GameHost builds, bundle budget, and media/CSP
  policy. The game entry is 263,678 raw / 80,232 gzip bytes against 524,288 /
  134,144 limits.
- Preliminary browser harnesses exposed and corrected stale test assumptions:
  the Tutorial discriminator belongs to the stage wrapper, Account no longer
  renders revision text, post-load input remains blocked until resume grace
  completes, and test enemies must enter through the simulation's world-manager
  registration lane. Those corrections changed maintained acceptance code,
  not product behavior. No member remains browser-blocked or unknown. The
  implementation is uncommitted and unpushed; deployment was not requested.

## 2026-09-04 — Inventory retention through browser save export/import

### Report and causal trace

The user reports that save exports retain charms, gold, skills, and discipline
but lose found inventory. At Website `5a4a81cc`, ordinary authoritative saves
already serialize the complete economy and belt. ZIP exports also carry that
document at `solomondark/browser-game-save.json`. Both Settings and Account
instead call `readNativeSaveFileSelection`, which discards this file and builds
a fresh Hub from the stock progression projection. That importer is the loss
point. The September 1 support-only boundary deliberately excluded player
re-import; this request now brings that lifecycle into scope.

No new retail serialization claim is required. The unchanged native evidence
and binary identity above continue to own stock-only transfer. This change
restores Website-owned data through its existing strict save codec.

### Boundary and complete membership

System: personal Website save transfer from authoritative checkpoint, through
ZIP download and file selection, to preview, slot replacement, and Last Game.

| Member | Disposition | Proof contract |
| --- | --- | --- |
| Backpack addressed slots, including gaps and overflow | `exact-ported` | exported/re-imported items and slot indices equal the checkpoint |
| All six equipment families and all seven equipped slots | `exact-ported` | exact item IDs, recipes, generated properties, effects, dyes, and equipped locations survive |
| Potion stacks, dyes, keys, both skill books, nested Sacks | `exact-ported` | all stock item kinds, quantities, and recursive contents survive |
| Mod items, potions, affixes, and content identities/state | `verified-already-at-parity` in the full document | no projection drops mod fields; existing resume content checks still apply |
| Luthacus storage and completed-run Sacks | `exact-ported` | complete stored trees survive alongside carried items |
| Eight belt slots, including nested/equipped item references | `exact-ported` | item and skill bindings survive; invalid references reject import |
| Hub and active Boneyard continuations | `exact-ported` | same wizard and inventory; Boneyard run, world, and tick survive |
| Settings/anonymous slot and Account/cloud slot | `exact-ported` | both use the same import preview and require existing replacement confirmation |
| ZIP with browser document; standalone browser JSON | `exact-ported` | full document is validated and restored, including existing September 1 exports |
| ZIP/loose stock files without browser document | `verified-already-at-parity` | existing settled-Hub projection remains; preview states its inventory limitation |
| Native profile/wizard and opaque archive siblings | `verified-already-at-parity` | stock files unchanged; retain non-browser siblings without nesting the browser document |
| Invalid browser document or invalid manifest | `exact-ported` rejection | reject before replacing the slot; never silently fall back to progression-only import |
| Party rejoin capability and global integrity | `out-of-system` for personal imports | re-encode as local-only with no rejoin token |
| Death, Game Over, New Game retirement | `out-of-system` | inventory ownership/reset rules are unchanged |
| Native-only inventory materialization | `out-of-system` | this request concerns Website exports; retail polymorphic item trees are not newly decoded |

### Implementation and validation contract

One file-selection owner returns a validated preview for both UI surfaces.
An archive containing the browser document restores that document; an archive
without it follows the existing native projection. A preview identifies which
source will be restored before the existing replacement action. Browser
imports strip account integrity and party capabilities, and retain archive
native files separately so repeated exports cannot nest prior browser saves.

Regression coverage must perform an actual ZIP download-format round trip for
mixed inventory in both Hub and Boneyard, compare economy/belt/full continuation,
check direct JSON and malformed input, and preserve existing native-only tests.
Mac Chrome acceptance must import the downloaded ZIP through Settings and
Account, reload, use Last Game, and verify the restored inventory on the host
and inventory UI. Run the complete Mac Website gate on the candidate tree.

### Implementation status

`game-save-files.ts` now owns both file formats and the shared preview. It
validates archive membership before reading the browser document, restores it
through the canonical save codec, and re-encodes it as local-only without a
party rejoin token. Native archive siblings remain attached separately.
Settings and Account now expose save import/export with explicit browser or
stock-only previews. The portability regressions cover all thirteen item kinds,
all equipment families/slots, named/generated gear, dyes and mod affixes,
addressed gaps/overflow, recursive Sacks, storage, belt references, Hub/Boneyard,
JSON, invalid documents, older stock-only files, and repeated export. The
maintained browser journey now imports the actual downloaded ZIP through each UI.

Before initial publication, validation was pending. The isolated Mac worktree was created at
`5a4a81cc` and Node 22.17.0/npm 10.9.2 installed its dependencies. The Mac then
went offline: Linux and Windows Tailscale both report `Online: false`, last seen
2026-09-04 20:50:00 UTC; repeated bounded SSH attempts time out. The focused red
test transfer did not complete. No automated tests, builds, or browser checks
had run for this change at that point. The user subsequently
requested a push to main after being informed of the pending validation.
Publication is authorized with that limitation recorded; deployment was not
requested. The follow-up below closes validation after the Mac returned.

### Mac validation follow-up

The Mac returned after publication. The first focused run at `3c5e76d6` passed
19/21 tests. Both failures were test assumptions about Hub regeneration:
`restoreGameSaveDocument` draws a fresh Hub seed and reconstructs world scenery,
so repeated saves need not have identical RNG, Skorcha state, or encoded length.
Inventory/player state must remain exact in the Hub; Boneyard continuations
must retain their complete authoritative state. The regression assertions are
corrected to that existing contract, without changing runtime/save behavior.

The browser harness also now follows Settings -> Online and Account -> Stock /
Browser Save, counts the eight class-root ranks that import normalizes, and
waits for the Inventory renderer's settled reveal before capturing it. Its
found-item fixture has completed Tutorial/College onboarding: otherwise
`armGameSimulationCollegeIntro` correctly changes starter clothes to the
College palette during Hub entry, which is not an inventory-transfer loss.

### Completed validation receipt

- Focused Mac portability tests: **21/21 passed**. The full
  `/opt/homebrew/bin/bash ./scripts/validate.sh` passed 19 backend/integration
  tests, every frontend suite (including 1,835 broad runtime tests), desktop
  tests, lint/type checks, production builds, bundle budget, and media policy.
- Built Mac Chrome passed both actual ZIP re-import journeys: anonymous
  Settings/IndexedDB in an active Boneyard, and Account/cloud in the Hub.
  The checks compare backpack entries/slots, equipped gear including tints,
  Luthacus storage, next item ID, and every belt binding before/after file
  import and after host resume. They also verify the visible Sack and equipped
  ring in the settled Inventory screen.
- The exercised items included equipped Pentaclostic Ring `500001`, nested
  seven-potion stack `500002` in Sack `500003`, stored potion stack `500004`,
  and the ring bound to belt slot 7. The Boneyard run retained its one Wraith,
  run identity, and checkpoint tick. The observed anonymous ZIP was 788,754
  bytes (759,835-byte browser document); cloud ZIP was 85,490 bytes.
- Both journeys ended with empty page-error, console-error, failed-response,
  and request-failure arrays. Native file decoding and archive integrity also
  passed. No runtime correction was needed after `3c5e76d6`; the follow-up
  changes only regression/acceptance assertions and this evidence record.
- The receipt-bearing candidate is checked again on Mac before the authorized
  follow-up push. No production deployment is part of this work. Task-owned
  checkouts, backend, screenshots, archives, database, and logs are removed
  after the remote commit is verified.
