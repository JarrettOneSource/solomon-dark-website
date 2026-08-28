# 2026-08-20 — Native save/load lifecycle and first browser cloud slot

## Reported smell and parity question

- Reported web behavior: `/game` has no persistence owner. `LAST GAME` is
  permanently disabled, Game Over cannot invalidate a stored run, anonymous
  play is ephemeral, and the title omits any identity text when signed out.
- Stock behavior to recover: one active resume namespace, native save writers
  at profile/run lifecycle boundaries, `LAST GAME` resume, and terminal
  invalidation before the stock front end returns.
- Reproduction inputs/scenes: authenticated and anonymous title -> Play; New
  Game -> Create -> Hub; Hub economy/progression; Hub -> Boneyard; active-run
  reload; authoritative Game Over; browser reload and a fresh game host.
- Falsifiable questions: whether clients or the host own save contents; whether
  Game Over merely hides or actually invalidates `LAST GAME`; whether stock
  periodically writes the active run; whether account identity is encoded in
  native bytes; whether a party guest may overwrite an owner's slot.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Existing native corpus | retail `SolomonDark.exe` SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; `Mod Loader/docs/reverse-engineering/native-save-format.md`; three G10 live goldens | Retail splits durable `darkdata.cfg` from one named resumable `gamestate.sav` plus sleeping-region caches; no account id, slot, version, checksum, transaction, or mod list exists in native bytes. | high |
| Fresh read-only instructions | Ghidra `SolomonDark.gpr`, preferred image base addresses `0x00423120`, `0x005BE0B0`, `0x005CBE10`, `0x005CC210`, `0x005CD3A0`, `0x005CF4F0` | Exact xref census: 11 profile writers, two run writers, one run loader, and seven cache-cleanup references in six functions. Game Over archives profile state, clears the active run lineage, and removes caches before returning to the front end. | high |
| Native menus | `native-menus-and-boot.md`; profile/save golden and `0x0058E8C0` / `0x005AAA30` | The Play branch owns `LAST GAME`, `NEW GAME`, `HALL of FAME`, `BACK`; Last Game is enabled only for a resumable namespace and loads through the sole run loader. | high |
| Current web authority | Website `e94ec7cee67e54a95f7cc0112047e89f9dcb9493`; `game-host.ts`, `game-simulation.ts`, protocol 33 | Node owns the full simulation; browser snapshots are projections and cannot safely be used as save state. The current host always starts fresh and the client hello has no save document. | high |
| Existing website account storage | `SaveEndpoints.cs`, `CloudSaveArchiveInspector.cs`, `CloudSave` entity | Existing `/api/saves` rows are launcher-native ZIP attachments and require Steam linkage. Reusing them for normalized browser state would conflate incompatible formats and can damage launcher restore behavior. | high |

The static pass used the existing analyzed retail image and no injected loader
process. Prior G10 clean-stock captures remain the live provenance. No ASLR
runtime address is used in this entry.

## System boundary and membership inventory

Native system: retail profile/run persistence from semantic mutation through
save, title resume, Game Over invalidation, and teardown; web boundary: one
host-authored normalized slot routed to account storage or browser disk.

| Member (class/variant/scene/branch) | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| LACE selector one-shot profile flag | saver xref `0x004FA290` | `out-of-system` (the web port has no LACE selector owner) | absence documented; no placeholder field |
| inventory/stat one-shot milestone | saver xref `0x00562520` | `exact-ported` | progression revision checkpoint round trip |
| dirty Inventory close | saver xref `0x005684C0` | `exact-ported` | accepted inventory action checkpoint |
| dirty PerkShop close | saver xref `0x0056C230` | `exact-ported` | accepted perk action checkpoint |
| accepted perk first-mix mutation | saver xref `0x0056C340` | `exact-ported` | economy flags survive resume |
| InventoryShop close | saver xref `0x0056CCA0` | `exact-ported` | gold/backpack/storage survive resume |
| completed-run durable archival | saver xref `0x005BE320` | `out-of-system` (explicit product rule deletes the whole browser slot on Game Over) | no post-Game-Over save recreation |
| legacy PlayAccount destruction | saver xref `0x005C3DB0` | `out-of-system` (website JWT identity replaces stock legacy account object) | native credential strings never enter document |
| every requested region switch | saver xref `0x005CDDD0` | `exact-ported` | Hub/Boneyard transition checkpoint |
| clean Game destruction | saver xref `0x005CD3A0` | `exact-ported` | latest bounded checkpoint resumes through a fresh host |
| synchronous crash/power-loss destructor | same `0x005CD3A0` edge | `blocked-by-platform` (a browser cannot guarantee final IndexedDB/network completion after process loss) | periodic checkpoint bounds predicted loss |
| Boneyard Game Over completion | saver xref `0x005CF4F0` | `exact-ported` to requested web rule | clear emitted on active -> Game Over, before later snapshots |
| MapPicker/run-entry gameplay writer | run-writer xref `0x0050E5E0` | `exact-ported` | Boneyard-entry document includes loaded scene/run |
| Game destructor gameplay writer | run-writer xref `0x005CD3A0` | `exact-ported` | full simulation codec round trip |
| sole resume loader | loader xref `0x005AAA30` -> `0x005CC210` | `exact-ported` | Last Game fresh-host handshake |
| full reset cache cleanup | cleanup caller `0x005CF920` | `exact-ported` | New Game replaces active slot only with a valid checkpoint |
| Mortuary cleanup | cleanup caller `0x00509200` | `out-of-system` (story Mortuary is not implemented in the current web world set) | no invented Mortuary branch |
| retry/new-game cleanup | cleanup caller `0x0058F500` | `exact-ported` | new document supersedes old revision |
| normal/Boneyard Game Over cleanup | two calls in `0x005CF4F0` | `exact-ported` | one ordered delete, no stale rewrite |
| Survival new-run cleanup | cleanup caller `0x0058E8C0` | `exact-ported` | start-match checkpoint owns the new run id |
| recursive cleanup implementation | self xref in `0x00423120` | `out-of-system` (one transactional document has no region-cache tree) | atomic row/object deletion |
| title Play/profile branch | `profile-save-select` golden | `exact-ported` | Last Game enabled iff a valid slot exists; New Game remains available |
| authenticated account slot zero | no retail account/slot equivalent; website ownership adapter | `exact-ported` | JWT owner isolation, revision/hash integration test |
| anonymous slot zero | no retail account/slot equivalent; browser disk adapter | `exact-ported` | IndexedDB reload/write/delete test |
| account username and signed-out title state | website identity adaptation | `exact-ported` | exact username or `Not logged in` at title top-right |
| future mod list | no schema-v1 member | `out-of-system` (explicitly deferred by request) | schema rejects an undeclared mod-list field |
| party guest writes | native participant-private profile vs shared run authority | `exact-ported` for deployment teardown | ordinary semantic/periodic continuation remains leader-owned; a deployment-final checkpoint projects and persists each connected participant independently |

The predicted platform-visible difference is limited to abrupt browser/process
loss: the most recent bounded active-run checkpoint survives, but work after it
may not. Ordinary semantic progression and world transitions checkpoint
immediately; no synchronous unload API can make a final cloud write reliable.

## Native ownership thread

- Owner and construction path: native `Game`/profile objects own run/profile
  serialization; title resume constructs gameplay through `0x005AAA30` and
  calls the sole loader `0x005CC210`. Web `game-host` owns the normalized
  document; the page owns only a storage coordinator.
- Upstream state producers/callers: the eleven `0x005BE0B0` xrefs above,
  MapPicker, region switches, clean destruction, and Game Over.
- State representation and transitions: native durable profile plus one named
  run/cache tree; web schema v1 stores one owner-only authoritative simulation
  and optional loaded Boneyard in slot zero. `available -> Game Over` is an
  ordered transition to `absent`.
- Downstream consumers/callees: native title Last Game and region wake; web
  title summary parser and fresh-host resume validation.
- Sibling systems sharing ownership or data: economy, inventory, skill book,
  player combat, run lifecycle, Boneyard world/RNG, account auth, and lobby host
  authority.
- Entry, interruption, reset, and teardown: New Game does not destroy the old
  slot before a replacement host checkpoint exists; invalid/corrupt documents
  remain stored but cannot enable Last Game; Game Over deletes; clean leave
  uses the latest checkpoint. Ordinary party checkpoints remain leader-owned;
  coordinated deployment teardown gives every connected participant an
  owner-only final continuation.

## Recovered behavioral contract

- Native has no periodic whole-run writer. The web product adds a bounded
  active-run checkpoint because browser termination cannot run a reliable
  destructor; semantic mutation and world-transition edges remain immediate.
- Storage contents are produced from authoritative state, never reconstructed
  from `GameSnapshot` presentation data.
- Schema, byte size, JSON depth/node budget, owner cardinality, run/world
  pairing, character summary, and loaded-Boneyard pairing fail closed before a
  host changes state.
- Cloud and IndexedDB use the same document. Account rows use JWT user id only;
  native run names, website usernames, Steam ids, and legacy settings tokens
  are not storage keys inside the document.
- A cloud write is revision-conditional and returns the new revision, size,
  SHA-256, and UTC receipt. Game Over delete is serialized after pending writes
  and revision-conditional.
- Semantic and periodic checkpoints go to each independent party leader. A
  coordinated deployment additionally checkpoints every connected participant.
  Each owner-only projection removes peer actors while preserving the shared
  world at that checkpoint, so every resulting slot resumes as one owner.

## Nearby-system findings

- Existing launcher `/api/saves` is not the browser seam. It preserves native
  ZIP archives and Steam linkage; browser saves require a separate table/route
  so neither client can interpret the other's bytes.
- Retail Game Over invalidates the active namespace but cache cleanup matches
  only `._cache`; physical orphan `gamestate.sav` bytes are incidental native
  debt, not observable resume behavior to copy.
- The direct profile saver census is now durable in
  `Mod Loader/docs/reverse-engineering/native-save-format.md`.

## Confidence and open questions

- Confirmed: stock binary identity, save/load/caller counts, menu route, Game
  Over lineage, current web authority, and existing launcher archive boundary.
- Inferred: none required for implementation ownership.
- Unknown but non-material: opaque native `gamestate.sav` object-to-node field
  offsets remain as recorded in G10; the browser stores its own complete web
  state rather than translating native bytes.

## Web implementation consequence

- Correct owner/module: a host-side save document codec and checkpoint
  publisher; protocol carries bounded opaque checkpoints; a browser coordinator
  routes them to cloud or IndexedDB; backend owns account row concurrency.
- Shared model change: protocol 34 admits an optional resume document in the
  first hello and a server save-checkpoint message. A restored host revives the
  authoritative world before welcome.
- Stock behavior preserved: Play -> Last Game direct resume; New Game remains
  separate; progression/world state resumes; Game Over removes Last Game.
- Browser-specific approximation: periodic active-run checkpoints bound the
  missing synchronous-destructor window. No local fallback is silently used
  for an authenticated account.
- Obsolete path to remove: permanently disabled semantic Last Game and the
  signed-out title omission.

## Validation contract

- Focused automated test: document full-state/Hub-runtime round trip, strict
  corruption/version/owner rejection, owner-only party projection, host
  resume and checkpoint/clear ordering, client checkpoint retention, cloud
  account/concurrency/hash integration, IndexedDB/coordinator ordering, title
  account text, and enabled/disabled Last Game contracts.
- Playwright/runtime journey: anonymous New Game -> progress -> reload -> Last
  Game; authenticated equivalent against the real backend; Game Over -> slot
  absent -> Last Game disabled; exact top-right identity text; no page, console,
  protocol, or request errors.
- Stock-versus-web comparison: compare profile/save menu availability, direct
  Last Game route, Hub/Boneyard phase on resume, and terminal invalidation
  against the preserved native menu/save/Game Over evidence.
- Measurable acceptance criteria: slot zero only; schema v1 <= 8 MiB; exact
  restored player config/economy/progression/world/run id/tick; one delete on
  first Game Over; no progress checkpoint during Game Over/loadout; deployment
  teardown writes one owner-only continuation for each responsive party guest.

## Implementation validation receipt

- Files/modules changed: `game/save/` owns schema, full-state codec,
  coordinator, cloud adapter, and IndexedDB adapter; protocol 34 and
  `game-host` own resume/checkpoint authority; `Game.tsx` and
  `MainMenuScene.tsx` own loading and Last Game routing; `WebGameSaves`,
  `WebGameSaveEndpoints`, and `WebGameSaveInspector` own profile slot zero;
  Account exposes the browser slot separately from launcher ZIP slots. The
  final rebase preserves the concurrent editable Create-wizard name and world
  nameplate/health-bar owners.
- Tests and canonical gate: `./scripts/validate.sh` passed with 25 backend
  integration/contracts, 40 loot tests, 150 prerequisite/save tests, 1,016
  broad game/frontend tests, 5 level-up tests, 6 diagnostics tests, 14 Hub UI
  tests, 5 desktop tests, strict formatting/lint/import boundaries, backend and
  production browser/host builds, bundle budget, and media policy. The eight
  focused Mod Loader native-save static contracts also passed.
- Browser/native evidence: read-only Ghidra re-confirmed all 11 profile-save
  xrefs, both run-writer xrefs, the sole run loader, and all seven cleanup
  references against retail SHA-256
  `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`.
  Headless Chrome at 1600x900 passed the anonymous IndexedDB and authenticated
  account-slot journeys: New Game wrote slot zero, movement produced a later
  revision, reload returned to a fresh host, Last Game restored the saved tick
  and moved position, anonymous title read `Not logged in`, authenticated title
  read the exact account name, and page errors/application console errors and
  unexpected warnings were empty. The final authenticated receipt advanced
  revision 2 -> 3 and resumed saved tick 1000 at X 980.421 after movement from
  X 950.640. Host lifecycle coverage separately proves one Game Over delete and
  zero later checkpoints during the terminal/loadout interval.
- Remaining implementation explicitly out of scope: mod list, multiple browser
  slots, native import/export, launcher-slot unification, and shared-party
  continuation ownership.
