# 2026-08-28 — Standalone stock gamestate import and dynamic Game bindings

## Reported smell and parity question

- Reported web behavior: a user-supplied base-game ZIP containing only
  `gamestate.sav` is rejected with a demand for either launcher `manifest.json`
  or `darkdata.cfg` plus `gamestate.sav`.
- Stock behavior to recover: retail stores the current wizard/run in
  `gamestate.sav`, separately from the cross-run `darkdata.cfg` profile, and
  does not put a native manifest beside either file.
- Reproduction input: Windows Downloads
  `SolomonDarkStockSaveWaterMage.zip`, one root `gamestate.sav`; direct inner
  file selection is the sibling input form.
- Falsifiers: a native manifest/profile dependency inside `gamestate.sav`; an
  unstable portable binding index; a semantic decoder failure after following
  all embedded counts; or a defaulted profile field presented as supplied
  stock state would falsify the intended bridge.
- Process correction: the 2026-08-26 pass sampled only settled-Hub binding
  tables and generalized their 24-int population into a schema constant. It
  also closed launcher archives and paired loose files without enumerating the
  standalone native file that retail itself writes. This pass reopens both
  omitted membership branches rather than adding a picker-only exception.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| User-supplied stock corpus | ZIP 63,484 bytes, SHA-256 `c3e6f06447558afd2dded422cc71449b9f482dc4b10674d1f0852460a75e2bd6`; inner save 525,926 bytes, SHA-256 `7a195e2f5735d8cec773443b0414176e89c4f217faab314c23da0e9dfa875f67` | The ZIP has exactly one root `gamestate.sav`, no `manifest.json`, no `darkdata.cfg`, and passes ZIP CRC/integrity. Source was identified by the user as unmodified base-game output; the exact producing EXE was not independently captured. | medium-high provenance; high bytes |
| Generic native decode | current `native_save_format.py`, strict `SyncBuffer` parse/encode | Physical EOF is consumed and re-encoded byte-identically: eight root children, 19,353 nodes, 371,098 payload bytes, depth eight. | high |
| Semantic corpus decode | same source after removing only the falsified exact-24 check | Recovers all 83 rows and level-50 Water/Body `GRANTABLES`; selected primary 32 agrees in both owners, concentration A is 60, B is null, and Magic Shield row 54 is visible/belted at permanent/effective rank `0/2`. | high structural; medium-high producer identity |
| Effective-only order instructions | `0x00660580`, sole caller equipment dispatcher `0x00576AA0`, refresh `0x006623F0`; progression `+0x850/+0x854` | Direct/conditional equipment skill grants append a row with zero permanent rank after setting a positive effective rank; refresh removes it only when effective rank becomes zero. The order is live visibility membership, not a duplicate permanent ledger. | high |
| Retail instructions | canonical 0.72.5 `SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; `0x005CE3D0`, call `0x005CE4DF`, serializer `0x00589140`, global owner `0x00819E70` | Game passes the global six-vector binding owner to a serializer that writes each live count and loops over exactly that many members. Integer storage/count are `0x00819E84/+0x00819E88`; no 24 constant owns serialization. | high |
| Existing stock profile evidence | controlled first-persisted `darkdata.cfg` in `portable-profile-template.json`; native save report | Missing profile state cannot be recovered from a gamestate. The exact template is a legal export base and carries stock first-persisted values. | high |
| Current web causal trace | `native-save-files.ts`, `native-save-archive.ts`, `native-save-bridge.ts`, portability/import/export callers at base `f974f268` | File selection rejects one loose save; ZIP parsing requires the launcher manifest; the bridge rejects any integer binding count other than 24 before reaching otherwise valid wizard data. | high |

## System boundary and membership inventory

Native system: one-current-wizard stock-to-web portability, from user-selected
file/container through strict native decode, missing-profile policy, local-only
browser-slot materialization, retained source attachment, and stock archive
export.

| Member | Native/product source | Disposition required by this pass | Proof contract |
| --- | --- | --- | --- |
| Loose `darkdata.cfg` + `gamestate.sav` | existing paired-file bridge | `verified-already-at-parity` | existing functional contract remains green |
| Launcher manifest archive | existing archive bridge | `verified-already-at-parity` | manifest/hash/retained-file tests remain green |
| One loose `gamestate.sav` | retail current-run writer | `exact-ported` | supplied wizard decodes; default-profile warning is visible |
| ZIP containing exactly one `gamestate.sav` | user-supplied container | `exact-ported` | the exact source ZIP reaches the same preview |
| Manifestless ZIP with zero, multiple, or non-gamestate files | no unambiguous single-wizard contract | `out-of-system` (ambiguous input) | fail closed before profile creation |
| Missing `darkdata.cfg` profile | separate retail lifetime | `exact-ported` as explicit stock-default initialization | preview identifies every defaulted family; no supplied-value claim |
| Safe run namespace | native directory name absent from standalone bytes | `exact-ported` bridge policy | `_survival` used only when no path parent exists |
| Settled-Hub 24-int binding vector | controlled stock template | `verified-already-at-parity` | existing selected/concentration tests |
| Active-run variable integer vector | `0x00589140`; supplied count 113 | `exact-ported` | require indices through 20, parse to exhaustion, preserve 24..end |
| Bool/float/String/vector2/range binding siblings | same six-vector serializer | `verified-already-at-parity` | all embedded counts remain strict and bounded |
| Wizard header, 83 progression rows, extension, Belt, footer, Boast | existing native bridge | `verified-already-at-parity` for both 24- and 113-int populations | sample-derived semantic assertions |
| Permanent learned-order rows | permanent ranks plus native order | `verified-already-at-parity` | native relative order survives import/export |
| Effective-only learned/visible rows, including sample Magic Shield 54 | equipment dispatcher/setter; source equipment is outside web authority | `exact-ported` as retained-and-reported omission | source bytes survive; row is not promoted to permanent web progression; preview warning names it |
| Active Arena/Region object graph and omitted region caches | different engine/world authority | `out-of-system` (semantic cross-engine resume) | source bytes retained; web starts in settled Hub |
| Standalone-derived stock export | existing manifest archive exporter | `exact-ported` | default profile plus patched original gamestate decode; opaque extra bindings survive |
| Multiple-save/bulk selection | user-deferred scope | `out-of-system` (no requested selection policy) | no archive wizard chooser or batch write |

No member is blocked by the browser platform. Raw user save bytes remain
external evidence and are not committed.

## Native ownership thread and recovered behavioral contract

- Retail `0x005CBE10` owns `gamestate.sav`; profile writer `0x005BE0B0` owns
  `darkdata.cfg`. Neither file contains a native manifest or embeds the other.
- `Game` serializer `0x005CE3D0` calls six-vector serializer `0x00589140` with
  global owner `0x00819E70`. The owner stores live vector data/count pairs at
  `+0x04/+0x08` through `+0x54/+0x58`. The supplied active save has counts
  `0/113/0/0/0/4`; the controlled settled Hub has `0/24/0/0/0/4`.
- Portable integer semantics remain indices 12, 16, and 20. Strict bridge
  admission therefore requires a count greater than 20, validates all six
  embedded vectors through payload exhaustion, and treats later integers as
  opaque retained state. Export changes only those three positions.
- The learned/visible vector may contain a row whose permanent rank is zero
  while its effective equipment rank is positive. A settled web import keeps
  the relative order of permanent rows, retains the full native bytes, reports
  effective-only row IDs, and refuses to invent the missing equipment grant.
- A standalone save supplies wizard/run state only. The bridge copies and
  hashes those bytes, pairs them with the exact controlled first-persisted
  profile template, and warns that profile state was defaulted. Imported web
  authority remains `local-only` and starts in the Hub.
- A manifestless ZIP is accepted only when its CRC-checked expanded membership
  is exactly one path whose final component is `gamestate.sav`. This is one
  save, not bulk inference. A safe parent path may provide the run name;
  otherwise `_survival` is used.
- Export continues to produce the existing launcher archive with manifest,
  `darkdata.cfg`, and `gamestate.sav`. For standalone-derived saves it patches
  the defaulted/then-web-owned profile and the retained genuine gamestate while
  preserving unprojected binding members byte-for-byte.

## Confidence and open questions

- Confirmed: container membership and hashes; generic byte-exact parse; dynamic
  serializer counts; stable portable indices; complete sample semantic decode;
  profile/run lifetime separation.
- Inferred: the supplied file was written by the canonical-compatible retail
  lineage because every recovered 0.72.5 layout agrees. The user's base-game
  provenance is trusted, but the exact producer binary hash is unavailable.
- Unknown but non-material: semantics of active integer bindings 24..112.
  They are outside web authority and remain opaque, so accepting/preserving
  them needs no guessed labels.
- Confirmed nearby correction: learned/visible order is not independently
  permanent. Effective-only entries have exact producer/removal instructions
  and a deterministic retained-and-reported disposition.

## Web implementation consequence

- Replace exact-24 validation in both canonical decoders with a minimum that
  proves indices 12/16/20 exist; retain the existing payload bounds and
  exhaustion checks.
- Extend the one-save selection owner, not page callers, to recognize a direct
  `gamestate.sav` and a manifestless ZIP containing exactly that one file.
- Load the controlled profile template only for the standalone branch and add
  one precise missing-profile warning to the validated portable profile.
- Filter learned/visible order to permanently ranked rows during portable
  construction, while rejecting inactive rows and warning with every retained
  effective-only row ID. Keep the strict portable invariant that its projected
  learned order contains only permanent progression.
- Keep paired-file and launcher-manifest behavior unchanged. Do not add batch
  enumeration, fallback parsing, schema shims, or raw-save fixtures.

## Validation contract

- Native tool: synthetic 113-int active binding decodes, patches only
  12/16/20, preserves later members, and round-trips.
- Frontend contract: direct and one-entry-ZIP selections use stock defaults,
  retain the gamestate hash, expose the warning, reject ambiguous ZIPs, and
  export a stock-decodable archive without losing extra bindings.
- Effective-order contract: synthetic and real row 54 permanent/effective
  `0/2` is retained in native bytes, omitted from web permanent order and Belt,
  warned explicitly, and remains stock-exportable.
- Source evidence: the exact external ZIP and inner file decode to level 50,
  Water/Body, selected 32, concentration 60, 83 rows, and count 113.
- Browser: Mac Chrome imports the exact manifestless ZIP through `/game`, shows
  the expected preview/default warning, writes slot I, resumes the settled Hub,
  exports a launcher archive, and reports empty page/console/response errors.
- Complete Website gate: `/opt/homebrew/bin/bash ./scripts/validate.sh` on the
  byte-identical Mac candidate.

## Implementation validation receipt

- Implementation: `native-save-files.ts` now accepts one direct
  `gamestate.sav` or a CRC-checked manifestless ZIP containing exactly that one
  path, while retaining paired loose files and launcher-manifest archives.
  Standalone input uses the controlled first-persisted `darkdata.cfg`, safe
  `_survival` namespace, and an explicit profile-default warning. Ambiguous
  manifestless archives still fail closed; no bulk selector was added.
- Native bridge correction: Website and canonical Python decoders require the
  portable binding indices through 20 rather than a settled-Hub count of 24,
  parse all six vector families to exhaustion, and preserve active entries
  24..end. Portable construction retains permanent learned order, filters and
  reports effective-only equipment rows, and keeps its strict nonpermanent-row
  rejection. Export patches only recovered fields and preserves opaque source
  membership.
- Exact external evidence: the user-supplied 63,484-byte ZIP remained SHA-256
  `c3e6f06447558afd2dded422cc71449b9f482dc4b10674d1f0852460a75e2bd6`.
  Its 525,926-byte inner save remained SHA-256
  `7a195e2f5735d8cec773443b0414176e89c4f217faab314c23da0e9dfa875f67`,
  byte-round-tripped, and decoded as level-50 Water/Body `GRANTABLES`, 83 rows,
  selected primary 32, concentration 60/null, 113 integer bindings, and
  effective-only/belted Magic Shield 54 at permanent/effective `0/2`.
- Native validation: Mac `python3 tests/re/run_static_re_tests.py --ci` passed
  `531/531`, including 113-entry decode/patch preservation, effective-only
  learned-order projection, strict portable rejection, and report evidence.
- Website candidate: the focused tree was rebased onto current main
  `a1ae89af2df5a82c3a10e29a911d118da716c6e1`; six changed files matched the
  Mac `r3` worktree byte-for-byte. The canonical Mac
  `/opt/homebrew/bin/bash ./scripts/validate.sh` gate exited zero across backend
  build/integration/formatting, lint/boundaries/generated contracts, affected
  `316/316` prerequisites, the complete expanded Boneyard/host and remaining
  registered suites, production frontend/game-host builds, bundle budget, and
  media/CSP policy. The production game entry measured 261,906 raw / 79,460
  gzip bytes. One earlier concurrent-gate observer timing sample shifted
  five ticks; the unchanged test and full gate passed when run without a
  competing validation controller.
- Mac Chrome acceptance used the exact source ZIP and a task-owned localhost
  game host. Anonymous IndexedDB and authenticated cloud each rendered the
  missing-profile and row-54 warnings, wrote revision 1, resumed level-50
  `GRANTABLES` in the settled Hub, persisted revision 2, exported, reloaded,
  and resumed again. Page errors, console errors, HTTP responses `>=400`, and
  non-navigation network failures were empty; intentional MP3 cancellations
  during explicit navigation were classified only as `net::ERR_ABORTED`.
- Anonymous and cloud exports were each 526,853 bytes with identical SHA-256
  `30669a9a230221c00aacf26a8f8c98f66007daf2dd0db9bbfc9dbb2422277201`;
  both decoded with binding count 113 and the expected wizard/profile
  projection. Reviewed anonymous/cloud preview SHA-256 values are
  `a654f8d53d2d5442310b54167365c7eb1c9c4c86c43520afbfe4591c640490b6`
  and `5cf24a743f248a2d3879277fc80d2eda07749493b23145d853d6c26aed5a3794`;
  reviewed resumed-Hub values are
  `8e69120687f4da0f78aeec69ce1d9e1f006e83c6b4cf90093f0110518a6805d3`
  and `07ebe6e4c3e087797a432d9cb1db7319cd3abc55d9ce3cd1bd39e5b0a680b9f2`.
- After the `r3` success receipt, the in-process host close lingered. Only the
  exact task-owned controller/backend process group was interrupted; port 4217
  and its validated `/tmp/solomon-stock-save-storage.*` directory were absent
  afterward. No unrelated validation or browser process was stopped.
- The raw user save remains external evidence and is not committed. Task
  branches/worktrees and Mac evidence are retained because push, deployment,
  and post-push cleanup were not requested. Publication and deployment are
  separate and have not occurred.
