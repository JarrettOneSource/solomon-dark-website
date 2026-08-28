# 2026-08-23 — Durable profile, historical save migration, and update-safe resume

> This reopens and supersedes the Game Over deletion and schema-compatibility
> portions of the 2026-08-20 save entry. That pass explicitly discarded
> completed-run profile archival and treated deletion of the whole browser row
> as equivalent to invalidating Last Game. The reported failure demonstrates
> why the native profile/run lifetime split was not optional.

## Reported smell and parity question

- Reported web behavior: after the game updated and reloaded, Last Game appeared
  disabled; an attempted resume ended at `Disconnected From Server`. The same
  report clarified that one save must outlive one run and retain picked-up gold,
  permanent stats, and related profile progression.
- Stock behavior to recover: `darkdata.cfg` persists one participant profile
  across runs; one independently named `gamestate.sav` plus region caches owns
  only the resumable run. Completed-run archival writes the profile, then clears
  the active resume namespace. Last Game disappears; the profile does not.
- Reproduction boundaries: schema-1/2/3/4 anonymous and authenticated records;
  title-only update, active-session deployment drain, clean leave, Hub resume,
  Boneyard resume, Game Over, post-run New Game, mods/cheats/private College,
  shared-Hub participant projection, and corrupt/unknown input.
- Falsifiers: the model is wrong if retail deletes `darkdata.cfg` with the run;
  if a known historical web schema cannot be migrated deterministically; if
  title parsing and host restore validate the same depth; or if New Game must
  discard rather than consume the selected slot's durable profile.
## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail corpus | `SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; `native-save-format.md`; three G10 goldens | Durable gold/storage/Hagatha/Shlorio/profile fields live in `darkdata.cfg`; active gameplay and region graphs have a different lifetime. | high |
| Existing static census | profile writer `0x005BE0B0` (11 callers), completed-run processor `0x005BE320`, wrapper `0x005C9670`, run writer `0x005CBE10` (2 callers), loader `0x005CC210` (1 caller), cleanup `0x00423120` (7 references) | Game Over archives the profile and invalidates the run name/caches; clean destruction writes profile and continuation separately. | high |
| Fresh targeted instructions | canonical read-only `SolomonDark` Ghidra replica 1; `0x0052A500`, `0x00533520`, `0x005C9670`, `0x005BE320`, `0x005EE840` | Player `+0x1C0` starts clear; `0x005C9670` passes `(+0x1C0 == 0)` as the carried-item archive gate. Ether Drain capture sets it, so the exceptional branch is consumed-corpse suppression. Progression `+0x7D8` independently gates Last Word ground Sack/Gold collection. | high |
| Current source/history | production/current `70b935e0e9a742fedeef8b5b4cb454725ad4eb16`; save schemas introduced by `28c1927a` (1), `9b9adf1a` (2), `17d69dd9` (3), `a10496c2` (4); current `game-save-contract.ts`, `game-save-document.ts`, `game-host.ts` | Current parsing accepts only 3/4; the focused test explicitly rejects schema 2. Schema 4 serializes raw implementation state, but later code added run and primary-cast fields without changing the schema or migrating the old shape. Title parsing checks only the envelope; host restore consumes the complete graph. | high |
| Genuine historical browser replay | Mac Chrome against commit-authentic schema-1/2/3/4 Hub/Boneyard documents | Schema-1 initially exposed an invalid derived learned-skill root; schema-2 Boneyard reached proxy close code 1009 because the supervisor accepted only 64 KiB while the host/save contract allowed 8 MiB. Both are deterministic migration/transport defects, not corrupt fixtures. | high |
| Live production | `https://solomondarker.com/deployment.json` and NFO journals, observed 2026-08-23 15:42 EDT | Production serves `70b935e0…`. The 13:51 EDT drain reported zero connected players, then restarted at protocol 60. A later title/session therefore had no deployment-final checkpoint to repair an older local record. | high for server state; medium for tying that exact anonymous browser to the report |

The two visible failure branches are both reachable. Schema 1/2 is rejected on
page load, so Last Game is disabled. A schema-3/4 envelope can pass the title
parser but contain a pre-update runtime graph; the fresh host then rejects or
fails while materializing it, yielding a disconnect after selection. A dimmed
button and a resume disconnect are therefore sibling symptoms of one missing
migration/lifetime owner, not evidence for a CSS or pointer fix.

## System boundary and membership inventory

Native system: participant persistence from semantic mutation through durable
profile write, active continuation write/load, deployment/leave interruption,
completed-run archival, title routing, new-run construction, and teardown.
The dispositions below are required outcomes; closure is not claimed until the
implementation receipt is filled.

| Member | Native/web source | Required disposition | Proof contract |
| --- | --- | --- | --- |
| durable gold | profile `+0x58`; every profile writer | `exact-ported` | profile-only and continuation round trips across Game Over/New Game |
| Luthacus storage and stable item identity | profile `+0x8C`; archive `0x005BE320` | `exact-ported` | retained inventory survives terminal invalidation and reload |
| Hagatha bundle, first-mix, ownership, and capacity | profile `+0x60/+0x6C`; progression ownership | `exact-ported` | every represented selector/capacity field survives a new run |
| Shlorio fee | profile `+0x100` | `exact-ported` | fee survives continuation removal |
| permanent unforge/stat bonuses | progression fields recovered in the unforge pass | `exact-ported` | health, mana, damage, mana-cost, XP, and attempt count survive |
| active backpack/equipment archival | `0x005BE320`; seven equipment sinks plus inventory | `exact-ported` for the represented web item tree | completed-run profile retains picked-up items rather than deleting them |
| Ether-Drain-consumed corpse suppression | Player `+0x1C0`; `0x00533520`; `0x005EE840` | `out-of-system` for this persistence pass (the current web Ether Drain target set contains enemies, not player corpses, so no corresponding web writer exists) | no invented save flag; native fact recorded for the Ether Drain target-system reopening |
| Last Word ground Sack/Gold sweep | progression `+0x7D8`; Arena actor types 2013/2012 | `exact-ported` where the represented web ground-loot actors exist | selector-12 terminal archive test |
| live Hub continuation | sole run writer/loader family | `exact-ported` | complete current Hub simulation restore |
| live Boneyard continuation and loaded scene | run writer/loader plus region identity | `exact-ported` | complete Boneyard/run/RNG restore |
| title Last Game availability | Play branch and active run name | `exact-ported` | enabled iff a valid continuation exists, not iff any profile row exists |
| title New Game with an existing profile | native global profile plus new run constructor | `exact-ported` | new character/run consumes durable profile without reviving old world |
| schema 1 | Website `28c1927a` | `exact-ported` through explicit migration | historical Hub and Boneyard fixtures |
| schema 2 | Website `9b9adf1a` | `exact-ported` through explicit migration | historical mod-envelope fixtures |
| schema 3 | Website `17d69dd9` | `exact-ported` through explicit migration | conservative local-only integrity plus runtime normalization |
| schema 4 before later runtime fields | Website `a10496c2` through pre-Game-Over/loadout commits | `exact-ported` through explicit migration | genuine pre-update fixture resumes on current host |
| current profile-plus-continuation schema | new normalized envelope | `exact-ported` | strict codec/profile-only/continuation tests |
| outer supervisor and inner host save transport | supervisor/host WebSocket `maxPayload` | `exact-ported` | both layers share one save-sized payload bound; genuine 613-KiB schema-2 Boneyard hello |
| authenticated account slot zero | conditional cloud row | `verified-already-at-parity` with schema acceptance extended | API revision/hash/migration journey |
| anonymous slot zero | IndexedDB row | `verified-already-at-parity` with schema migration extended | browser reload/update journey |
| clean in-game leave | `0x005CD3A0` dual write | `exact-ported` | acknowledged profile+continuation before teardown |
| responsive deployment drain | same dual-write semantic boundary | `exact-ported` browser adaptation | old revision saves, reloads, then resumes on new revision |
| title-only revision reload | no live native Game owner | `exact-ported` | stored row remains untouched and migratable |
| Game Over completion | `0x005C9670 -> 0x005BE320`, run-name clear | `exact-ported` | profile remains, continuation becomes null, Last Game disables |
| participant-private multiplayer persistence | retail process-local profile projected per web participant | `exact-ported` | leader and guest retain distinct profile/continuation documents |
| mod/private-College profile | browser integrity/content boundary | `exact-ported` | content mismatch remains explicit; local-only state never silently becomes global-clean |
| unknown/corrupt future schema | no native version analogue; browser safety boundary | `out-of-system` (not a known authored schema) | fail closed without deleting or overwriting the row |
| abrupt tab/process loss after the last checkpoint | native synchronous destructor unavailable in browser | `blocked-by-platform` (asynchronous IndexedDB/HTTP cannot be guaranteed after process death) | bounded by semantic and 30-second checkpoints |

## Native ownership thread and recovered contract

- Native constructs the durable profile independently of any active run. Last
  Game consumes the run namespace; New Game still observes the profile.
- `0x005C9670` archives eligible carried/Last Word output through `0x005BE320`,
  whose terminal `0x005BE0B0` call persists the profile. Run invalidation and
  `._cache` cleanup happen afterward; orphan `gamestate.sav` bytes do not make
  Last Game available.
- The web host remains the only save-content author. The page/store may parse a
  bounded summary and route bytes, but it may not manufacture profile state
  from presentation snapshots.
- One atomic web row is still preferable to retail's partial multi-file writes.
  Atomic storage does not collapse the two lifetimes: the row contains a durable
  profile and either one continuation or null.
- Known schema migrations are directional and explicit. Each historical schema
  is normalized before authority changes; current output is rewritten in the
  newest schema after the first accepted checkpoint. Unknown fields/versions do
  not receive best-effort defaults.
- Game Over is a profile checkpoint, not a row delete. New Game uses the profile
  with a fresh character/run/world; Last Game requires and revives the nullable
  continuation directly.

## Nearby-system findings

- The old schema number tracked feature landings while the serialized payload
  was a raw `GameSimulationState`. Schema 2 added mod state; schema 3 changed
  only the number; schema 4 added integrity. Later runtime fields changed under
  schema 4. A raw implementation graph therefore needs versioned normalization
  at every persisted boundary or a deeper stable projection; TypeScript types
  alone provide no on-disk compatibility.
- The deployment drain worked as authored for its actual membership: the live
  journal recorded zero players. Title-only update detection cannot create a
  missing final checkpoint and must instead rely on stored-schema migration.
- The consumed-corpse flag is now durably assigned to Ether Drain capture. It
  must not be relabeled as alive/won/insured in save code.
- The supervisor's former 64-KiB WebSocket cap contradicted both the 8-MiB save
  codec and the inner host's save-sized cap. A valid historical Boneyard could
  therefore be rejected with code 1009 before protocol decoding. One exported
  transport bound now owns both WebSocket layers.
- The sacks/dyes pass's 16-child participant guard was sufficient for ordinary
  hand-managed Sacks but contradicted completed-run processor `0x005BE320`,
  which can place the hidden 2,048-row backpack lane plus seven equipment sinks
  in one retained Sack. The shared strict bound is therefore 2,055 children;
  the document byte/node/depth and WebSocket caps remain the outer safety gates.
- `Mod Loader/docs/reverse-engineering/native-save-format.md` is updated with
  the corrected browser consequence and the new `+0x1C0` trace.

## Confidence and open questions

- Confirmed: executable identity, profile/run lifetime split, all existing
  saver/loader/cleanup counts, the completed-run boolean producer, historical
  web schema lineage, current unsupported-schema branch, schema-4 shape drift,
  current production revision, and zero-player deployment receipt.
- Inferred: the reported anonymous browser likely exercised one of the two
  proven legacy branches; no submitted browser diagnostic archive identifies
  its exact stored bytes.
- Unknown but non-blocking: if the user already started a replacement anonymous
  New Game, IndexedDB may have overwritten the only old row; the server cannot
  recover client-local bytes it never received. The fix must not claim recovery
  of an already-overwritten local record.

## Web implementation consequence

- Introduce one strict current envelope with durable `profile` and nullable
  `continuation`; retain one conditional store revision and one slot.
- Parse and migrate schemas 1 through 4, including defaults for every runtime
  field added after their respective commits. Preserve their active Hub or
  Boneyard continuation when it is structurally valid; do not downgrade a
  restorable run to profile-only merely to make parsing easy.
- Replace terminal `save:null` with a profile-only document. Last Game derives
  from `continuation !== null`; New Game can carry the profile document to a
  fresh host under an explicit new-run intent.
- Keep resume and new-run intents distinct in the strict protocol. Resume must
  match the saved character and world; new-run profile hydration must use the
  newly selected character and construct a fresh world/run.
- Use the same save-sized maximum payload at the public supervisor proxy and
  inner authoritative host; neither may reject a document the strict codec
  promises to carry.
- Remove the obsolete whole-row Game Over clear tests and the assertion that
  schema 2 must fail.

## Validation contract

- Generate genuine Hub and Boneyard documents with source at each historical
  schema commit; current code must parse, restore, snapshot, checkpoint, and
  rewrite all of them without disconnect.
- Cover profile extraction/hydration for gold, storage/items, every represented
  Hagatha field, Shlorio fee, and all permanent unforge bonuses.
- Cover Game Over -> profile-only -> browser reload -> Last Game disabled -> New
  Game -> same profile, plus subsequent live continuation creation.
- Cover anonymous IndexedDB and authenticated cloud update journeys, responsive
  deployment drain and title-only reload, clean leave, mod mismatch, shared-Hub
  participant isolation, corrupt unknown schema, and save-write conflicts.
- Run focused contracts, the complete `/opt/homebrew/bin/bash
  ./scripts/validate.sh` gate, and real Mac Chrome journeys with empty page,
  console, failed-response, and application-error arrays.

## Implementation validation receipt

- The authoritative host now emits schema 5 as one durable `profile` plus a
  nullable `continuation`. Known schemas 1/2/3/4 migrate explicitly into that
  envelope; corrupt and unknown schemas fail closed. Protocol 65 carries an
  explicit `resume` or `new-game` intent alongside the Hagatha/Weld state added
  on current main, and both WebSocket layers use the shared save-sized payload
  limit.
- Game Over checkpoints profile-only state instead of deleting slot zero. The
  archive retains gold, Luthacus storage, represented Hagatha/Shlorio and
  unforge progression, exact Hagatha one-shot runtime, eligible
  backpack/equipment items, and the represented Last Word ground Sack/Gold
  family. Last Game is disabled for that document; New Game creates a fresh
  character/world while hydrating the retained profile. Clean leave and
  deployment drain still write a live continuation.
- The focused branch was rebased onto Website `d2fc7c38a68f90c6c3a92290bb6fc2613a872e04` and copied byte-for-byte to
  `/Users/jarrett/codex-acceptance/save-resume-rebased-20260823/website` on the
  Mac mini. The canonical gate passed: backend build zero warnings/errors and
  `17/17` backend tests; all frontend/desktop TAP suites passed (`1919/1919` in
  aggregate); both production builds and media policy passed. The Game chunk
  was `438451` bytes raw / `123440` gzip, below the `524288` / `131072` limits.
  The gate log is
  `/Users/jarrett/codex-acceptance/save-resume-rebased-20260823/gate2.log`.
- Eight genuine commit-authentic schema-1/2/3/4 Hub/Boneyard documents restored
  and stepped on the current Mac host. The production-bundle Chrome acceptance
  then passed anonymous and authenticated update/replacement-supervisor resume,
  profile-only reload -> disabled Last Game -> New Game retaining `12345` gold,
  and representative schema-1 Hub, schema-2 Boneyard (`613485` bytes), schema-3
  Hub, and schema-4 Boneyard resumes. The runner requires empty page, console,
  failed-response, and application-error arrays; all seven journeys exited
  cleanly and produced the `/tmp/solomon-*-resume.png` / update/profile captures.
- The Loader RE correction was copied byte-for-byte to
  `/Users/jarrett/codex-acceptance/save-resume-rebased-20260823/loader`; its
  static RE suite passed `495/495`. No product deployment, production restart,
  or remote publication was authorized or performed.
- Dispositions remain explicit: the current web Ether Drain cannot target a
  player corpse, so native `+0x1C0` consumed-corpse suppression is
  `out-of-system`; an uncheckpointed hard tab/process death is
  `blocked-by-platform`. Neither changes the completed profile/update-resume
  behavior proven here. An anonymous IndexedDB row already overwritten before
  this fix cannot be reconstructed from server state that never received it.

### Current-main publication refresh receipt

- The authorized publication refresh found Website main had advanced through
  `ee7f8d44a1896b21bbdd7ce53cc1dbde5557c6bb` and Loader main through
  `d4e37b2c` after a second concurrent documentation landing. The save commit
  was rebased normally; the Loader report rebased twice without conflict. Both
  focused branches remain one commit ahead of their current bases.
- The overlapping Website work independently used protocol 64 for Hagatha/Weld
  state. The combined strict wire is therefore protocol 65: it carries those
  fields and the explicit save intent without advertising two incompatible
  protocol-64 shapes. Schema 5 now also stores the exact Hagatha one-shot
  runtime in the durable profile, and legacy schema 1-4 profiles derive or
  retain it explicitly. This prevents a profile-backed New Game from silently
  losing or rearming spent state.
- The changed-file manifests were byte-identical on the Mac mini: 31 Website
  files and one Loader report file under
  `/Users/jarrett/codex-acceptance/save-resume-publish-20260823/`. The first
  canonical Website pass caught two test fixtures still addressing the old
  root-level schema-4 shape; the fixtures were corrected to exercise the
  intended legacy and schema-5 envelopes. The complete r2 gate then passed:
  backend build zero warnings/errors and `17/17` integration tests; all
  frontend/desktop TAP suites passed (`1943/1943` aggregate); production builds
  and media policy passed. `Game-BKAzm_9S.js` was `441338` bytes raw / `124316`
  gzip, below `524288` / `131072`. Gate-log SHA-256 is
  `fc47aecb573010c2db59d8248a8c5f393373eb0ec0fa1cdfff3a913f83692400`.
- Loader static RE passed `496/496`; log SHA-256 is
  `025b9e40d646558425a03b5e97aeaf19aee504886a1b62ddb91d8d2951c50a62`.
  Production-bundle Chrome then passed anonymous and authenticated update/
  replacement-supervisor resumes, profile-only New Game retaining `12345`
  gold, and representative schema-1 Hub, schema-2 Boneyard, schema-3 Hub, and
  schema-4 Boneyard resumes. Browser-log SHA-256 is
  `733116e1a5bc1c59021275b466c897205cf07a3f39a3620d12566a84150d0812`;
  all seven captures are retained under the receipt's `evidence/` directory.
- This refresh authorizes a normal fast-forward publication only. It does not
  authorize or claim a production deployment or runtime restart.
