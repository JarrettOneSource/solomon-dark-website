# 2026-08-23 — Active wizard, saved Boneyard run, and title replacement lifecycle

> This is a second reopening of the browser-save system. The preceding pass
> repaired schema and profile lifetime, but it still treated a host-local
> checkpoint sequence as page-global, routed New Game around the stock active-
> wizard confirmation, preserved Hub coordinates, called every continuation a
> run, and retained the port's invented 10,000-gold fresh-player grant.

## Reported smell and parity question

- A deployment/save edge reports `Game save checkpoint 3 is not the latest
  accepted sequence.`
- Last Game must be enabled whenever the selected save contains a resumable
  wizard. Choosing New Game while that wizard exists must ask whether to resume
  it or kill it before Create starts.
- A Hub checkpoint is a saved wizard/game, not an active Boneyard run. Loading
  it must regenerate the Hub and place the wizard at the Hub spawn rather than
  preserving the departure coordinate.
- A genuinely fresh profile must not receive the web port's 10,000-gold test
  grant. The later tutorial port needs one explicit fresh-profile handoff and
  must not be forced to undo save migration or title-menu policy.

Falsifiers: checkpoint sequences are global across independently provisioned
hosts; stock New Game silently replaces a current wizard; native Last Game and
the per-level resume prompt share one state bit; Hub scene-local position is a
durable profile field; or the retail fresh-profile initializer writes 10,000.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail image | `SolomonDark.exe` 0.72.5, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Same canonical image as the save/profile corpus. | high |
| New Game instructions/text | read-only Ghidra replica 1; `0x0058E260`, sole caller `0x0058E600`; strings `0x00798408` and `0x00798474` | An existing-current-wizard flag gates a common MsgBox. Exact copy: `Kill character?` and `Starting a new game will kill off your current game and character (Lucritius will scavenge his equipment)!`. The affirmative branch archives/resets before Create; refusal aborts the transition. | high |
| Separate saved-level prompt | `0x0058F500`; two dispatch references in `0x005A5530`; strings `0x007984F8` and `0x00798540` | A different branch asks `RESUME PREVIOUS GAME?` / `Do you want to resume the previous game you were playing in this level?`; acceptance calls Last Game loader `0x005AAA30`, refusal clears the prior level cache and starts the requested level. This is not the title active-wizard test. | high |
| Last Game/load path | `0x005AAA30 -> 0x005CC210`; run path builder `0x005BA1C0` | The front end loads one current wizard game. File existence/run namespace and the selected-level timeline remain distinct owners. | high |
| Fresh profile | `0x005A8390`, raw instruction/decompile; existing G10 40-sample `fresh_profile` golden | Retail writes profile gold `+0x58 = 500` and tutorial-pending byte `+0x104 = 1`; the Website's 10,000 is falsified. Tutorial behavior beyond these constructor fields remains intentionally unclaimed until the user's next RE pass. | high |
| Web causal trace | `GameSaveCoordinator`, `Game`, `GameClientSession`, `MainMenuScene`, schema 5 | Each new host starts save sequence numbering again, while the page coordinator retains one `lastSequence`. `waitFor(n)` also rejects an already accepted checkpoint merely because `n+1` arrived. The exact reported text has no storage/API producer. | high |

## System boundary and membership inventory

Native/web system: title selection of a current wizard, current-wizard save
existence, optional active Boneyard run, Hub scene reconstruction, fresh-profile
construction, checkpoint-stream persistence, replacement, and teardown.

| Member | Owner/source | Disposition | Proof contract |
| --- | --- | --- | --- |
| durable profile row | schema profile / retail `darkdata.cfg` | `verified-already-at-parity`, retained | survives resume, kill, Game Over, and New Game |
| resumable current wizard | schema continuation / `0x005AAA30` | `exact-ported` | Last Game enabled for valid Hub or Boneyard wizard continuation |
| active Boneyard run | Boneyard continuation/run identity | `exact-ported` as an explicit state distinct from the game save | schema and browser assert true only for active Boneyard |
| Hub saved game | Hub continuation, no active Boneyard run | `exact-ported` | save remains resumable; active-run flag false |
| Hub departure position/region transition | Hub scene-local locomotion/participant state | `exact-ported` by regeneration | resume creates fresh Courtyard participant at `HUB_SPAWN`; saved coordinates ignored |
| New Game with current wizard | `0x0058E260`, `0x0058E600` | `exact-ported` with requested direct Resume/Kill labels | prompt owns input; resume loads unchanged document; kill persists profile-only before Create |
| killed-wizard carried inventory | `0x0058E260` copy plus completed-wizard archive owner | `exact-ported` | current equipment/backpack is host-authored into the latent scavenged profile and retained on kill |
| per-level previous-run prompt | `0x0058F500` | `out-of-system` for the current Website world picker; recorded for the Boneyard timeline reopening | no conflation with title Last Game or Hub checkpoints |
| checkpoint order inside one host stream | server sequence and client session | `exact-ported` browser transaction rule | duplicates share one outcome; accepted older checkpoint remains awaitable after a newer one |
| sequence restart across provisioned hosts | client-local stream identity | `exact-ported` browser authority adaptation | sequence 1 in a second session persists after sequence N in the first |
| fresh profile gold | `0x005A8390`, profile `+0x58` | `exact-ported` at 500 | every fresh-player surface observes 500, while existing saves retain their amount |
| future tutorial mutations and entry scene | proven pending bit plus upcoming user RE | `out-of-system` for this pass, with an explicit integration seam | persist the proven pending bit; no guessed reward, dialogue, scene, completion transition, or other flag; fresh construction remains one owner |
| corrupt/unknown save | strict codec | `out-of-system` safety boundary | no prompt, resume, kill, or overwrite |
| abrupt browser death before acknowledgement | browser persistence platform | `blocked-by-platform` | same bounded checkpoint window as the preceding entry |

## Native ownership thread and recovered contract

- `0x0058E600` owns the title/profile selection transition. Only its current-
  wizard branch calls `0x0058E260`; refusal returns without changing selection.
  Affirmative replacement performs profile/item archival and run cleanup before
  moving toward Create.
- `0x0058F500` belongs to selected-level timeline replacement. Its existence
  check and prompt are not evidence that a Hub checkpoint is an active run.
- Retail profile initialization is a separate constructor boundary. It writes
  500 gold before any tutorial behavior established in this pass. Existing
  saves are never normalized back to that value.
- In the Website, server checkpoint sequence is scoped to one
  `GameClientSession`. IndexedDB/cloud revision is scoped to the durable slot.
  These are independent order domains: transport sequence selects an operation;
  store revision serializes that operation against other tabs/devices.
- The authoritative host continues to author the saved state. Every active
  checkpoint also contains the exact profile projection used if the wizard is
  retired, so the title can invalidate the continuation without reconstructing
  gameplay from a presentation snapshot.
- Hub resume preserves wizard/profile/progression state but creates a fresh Hub
  world, participant region, locomotion placement, and idle cast at the existing
  canonical `HUB_SPAWN` seam.

## Nearby-system findings

- `GameSaveCheckpoint.sequence` cannot identify a durable write without the
  client-session stream that produced it. The prior coordinator test covered
  only one monotonic stream and therefore blessed the reported failure.
- Schema 5 names `continuation` but lacks a semantic active-run bit. Schema 6
  must add that bit while migrating schema 5's envelope and schemas 1-4's old
  root shape directionally.
- The tutorial port should attach at fresh player construction before the
  current direct-Hub entry. Save parsing, killed-wizard archival, and existing-
  profile hydration must remain downstream and should not encode speculative
  tutorial rewards or completion flags.

## Confidence and open questions

- Confirmed: prompt copy, New Game owner/caller, separate level-run prompt,
  Last Game loader, retail 500-gold initializer, web sequence failure producer,
  current Hub-coordinate restore, and schema-5 lifetime collapse.
- Inferred from current authored world ownership plus the user's stock report:
  a resumed Hub scene is reconstructed at the established Hub spawn rather than
  treated as an active Boneyard run.
- Intentionally unknown and non-blocking: tutorial entry, rewards, dialogue,
  completion transition, and fields beyond the proven pending bit. No
  placeholder behavior is invented.

## Web implementation consequence

- Advance to schema 6 with an explicit `activeRun` summary member. Migrate
  schema 5 as an envelope and schemas 1-4 from their legacy root form; derive
  the bit only from validated world/run state.
- Give every client session a local checkpoint-stream identity. Make coordinator
  acceptance return the exact persistence promise for `(stream, sequence)`;
  never define completion as `sequence === latest`.
- Host-author the latent killed-wizard profile in every active document. Title
  kill converts the validated document to profile-only and commits it before
  entering Create; Resume leaves it untouched.
- Regenerate Hub world/participant state and relocate the restored wizard to
  `HUB_SPAWN`. Preserve Boneyard state exactly.
- Replace 10,000 with the instruction-proven 500 fresh-profile value and retain
  the proven tutorial-pending bit. Legacy web schemas migrate that bit false;
  genuinely fresh construction sets it true. Keep `createHubEconomy`/player
  construction as the single documented tutorial handoff; do not add guessed
  tutorial logic.

## Validation contract

- Coordinator: two streams reuse sequences 1..N; duplicate final checkpoint;
  wait for checkpoint N after N+1; sealed/stale streams cannot overwrite title
  replacement; settled history stays bounded; revision conflict remains
  observable.
- Codec/host: schemas 1-5 migrate to 6; active-run bit cannot drift from world;
  Hub resumes at spawn with a fresh participant/world; Boneyard position/run is
  retained; killed wizard becomes profile-only with scavenged carried items.
- Title: valid continuation enables Last Game; New Game opens the prompt;
  Resume connects the old wizard; Kill persists retirement before Create;
  cancel/error cannot silently replace the row.
- Fresh player: 500 gold and tutorial-pending true at economy, entity, snapshot,
  host, and Lua surfaces; legacy saves migrate pending false and retain their
  existing 10,000/other gold amount.
- Windows Chrome: anonymous and authenticated Hub/Boneyard journeys, update drain,
  checkpoint stream rollover, prompt ownership, Hub spawn, and empty page/
  console/failed-response/application-error arrays.

## Implementation validation receipt

- The final validated source is Website base `a9969ae1` plus save-lifecycle
  commit `0ae05943` and the independent Windows SQLite-test cleanup
  `8d996d80`; the Mod Loader candidate is `208a32dc` on base `d90f9e87`.
  Protocol 68 is the combined strict wire after upstream protocol 67's Goodie
  action and this pass's required tutorial field. Windows Git `2.51.0`, Node
  `22.17.0`, npm `10.9.2`, Python `3.13.5`, .NET SDK `10.0.302`, and Chrome
  `151.0.7922.170` ran every final check outside WSL.
- The native Windows Mod Loader registry passed `497/497`; log SHA-256 is
  `a4d6feacc0e82888eae09ced64ee0865c2670c256add41f7a8871df171f75443`.
  The complete Website gate passed 20 backend contracts, lint with zero errors
  and the eight existing warnings, frontend suites
  `9/4/45/259/1452/6/61/9/62/12/7/36/33`, desktop `5/5`, TypeScript,
  production build, bundle budget, and media policy. `Game-DxOhu34_.js` is
  `443143` raw / `124554` gzip bytes under `524288` / `131072`; gate-log
  SHA-256 is
  `64e1e12c6f040e33546d4153fbc85052717fb4a204b3cc845ad34c5fef4bef78`.
- An earlier all-suite Windows pass encountered the machine's intermittent
  loopback `ETIMEDOUT` after its long process-backed backend phase. The exact
  unchanged host/supervisor suites then passed `65/65` in a clean process
  (SHA-256
  `4500edbe7427af886d1aa746527d5b4a9f685e92be179f91941855c7118b5dd2`),
  and the subsequent unchanged canonical run above passed. No product source
  changed for that host artifact. The separate SQLite cleanup closes a real
  Windows file-handle defect in the newly upstreamed runtime-event test.
- Exact-head Windows Chrome primary acceptance passed for anonymous and
  authenticated slot zero. Each save advanced `1 -> 2` before restart, Last
  Game became enabled and visibly undimmed, New Game opened the blocking
  Resume/Kill prompt, Resume regenerated the Hub at exactly
  `(950.64,164.04)`, and a second deployment drain from the restarted session
  saved and acknowledged one player at revision `4` with zero unacknowledged
  players. Kill Wizard committed profile-only revision `2`, retained all five
  carried starter items, retained 500 gold, and entered Create; a separate
  profile-only 12,345-gold save kept Last Game disabled and preserved its gold
  through New Game. Page, console, failed-response, and application-error
  arrays were empty. Primary log SHA-256 is
  `3706893605113837a426e92b55a2a3c42e74d2a5e5d8fed807199af39ca90844`.
- Exact-head legacy acceptance migrated schema-1/3 Hub saves as resumable
  games with `activeRun=false` at `(950.64,164.04)` and schema-2/4 Boneyard
  saves with `activeRun=true` while retaining their Boneyards. Its error arrays
  were empty; log SHA-256 is
  `b6c5feb70c22fe3c93046fe7b66c86d9a8b92fddc1e85240b997b31be6868b1c`.
- Reviewed prompt, post-kill Create, Hub-resume, and Boneyard-resume captures
  are retained under
  `C:\Users\user\codex-acceptance\save-menu-sequence-20260823\evidence\browser`.
  Representative SHA-256 values are
  `05de30010dda7111f4bafc90ebaecf2b2684f3b6a3ed599347e48b0cac7596ca`
  (anonymous prompt),
  `bcc3651b9093f79c2b03819eaf6c8dead493fab672e545e10a0dcd8c77d093ac`
  (Kill prompt),
  `ce3ccb24e1f7e0dcee350f6bd6acc50147c71128fee67a52b0f245fd02f0d68c`
  (post-kill Create),
  `5b0f22988c5714a413568b56eec38b3483d1fa0c2f5221365b775717f5c7f6d3`
  (schema-1 Hub), and
  `c9252ff09345df3205e8a5bdbd0af92d7ba2f2086abe1a42ab3febf9c89e212d`
  (schema-2 Boneyard).
- The residual trader journey also observed a real 500-gold start for both
  participants before granting only its host an explicit Lua test bankroll;
  every Fomentius, Luthacus, Hagatha, Shlorio, equip, and unforge branch
  completed. Its already documented dev-server-only missing-media 404s remain
  outside the green production receipt. No save-system residual, platform
  block, or material unknown remains. Push is authorized; deployment was not
  requested and has not been performed.
