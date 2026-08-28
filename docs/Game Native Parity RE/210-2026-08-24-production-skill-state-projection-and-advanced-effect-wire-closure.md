# 2026-08-24 — Production skill-state projection and advanced-effect wire closure

## Reported smell and parity question

- Reported request: inspect every captured/reported production server fault,
  correct the remaining bugs, validate the exact result, and publish it to
  `main`.
- Current production at Website `0d95bc27d9a9d71a80c96f9881969041f4adb6ac`,
  protocol `solomon-dark/73`, stored eight new client reports between
  `2026-08-25T02:18:51Z` and `02:37:56Z`. Two peers were disconnected by each
  of three strict state-to-wire failures:
  `primaryCast.selectedPrimaryId does not match progression`,
  `progression.concentrationSkillIds[0] is not eligible`, and
  `secondaryAbilities.actors[1].skillId is not a native secondary ability`.
- Stock behavior to preserve: a selected primary and its live cast component
  change as one refresh operation; selected primary/concentration rows are
  validated against the post-equipment/post-Mindstar effective rank; and
  primary advanced effects retain their native source skill identity through
  every parent and child actor without becoming ordinary category-2 casts.
- Falsifiers: a full welcome snapshot that is valid while only a delta fails;
  retail refresh reading permanent rank `+0x20` rather than effective rank
  `+0x22`; an exceptional actor family whose child deliberately drops the
  source skill; or an unrelated baseline-recovery failure at the same tick.
  The live/full-snapshot and retail-instruction evidence falsify none of the
  three causal paths below and separately falsify baseline corruption.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Live client reports | NFO private `DiagnosticLogs` rows 30..37 and their bounded archives; Chrome protocol 73 | Paired peers failed on the same remote player's selected-primary state, then the same concentration state; later paired peers failed on one secondary actor. One concentration failure occurred in `snapshot.players...`, proving the authoritative full state was invalid rather than only a compact delta. | high-live |
| Live host journal | `solomon-dark-game.service`, `2026-08-25T02:15Z..02:48Z` | The host logged the exact code-4008 reasons for both peers. A separate stalled peer opened one `replication.baseline_missing` episode at sequence 11178 and closed it at recovery keyframe 11707 after 6.22 seconds before the later Fire-Burn failure. | high-live |
| Current production health | NFO systemd and supervisor health after deployment `0d95bc27` | Website, game, and Caddy are active with zero current-process restarts. No Website warning/error exists; the outstanding defects are strict client rejection of server-authored state. | high-live |
| Retail identity | unmodified `SolomonDarkAbandonware/SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Same pinned Beta 0.72.5 image as the durable skill/rank and primary/secondary effect reports. | high |
| Fresh read-only instructions | canonical Ghidra replica through `Invoke-GhidraHeadless.ps1`; `ActorProgressionRefresh 0x0065F9A0` | Concentration slots 16/20 and selected-primary slot 12 are checked against skill-row short `+0x22`, the effective rank. Zero selects a replacement before dependent refresh; permanent rank is the distinct row `+0x20`. | high |
| Fresh read-only instructions | same replica; category router `0x005D5600` | Accepted category-1 selection writes slot 12 and immediately calls `0x0065F9A0`; category-3 selection writes slot 16/20 and immediately calls the same refresh. State and dependent caches are one native mutation boundary. | high |
| Existing durable native evidence | `native-skills-and-spells.md` rank ABI, concentration, `Mod_EtherBurn`, and dispatcher sections; `native-skill-screen-and-quickbar.md` | The native reports already pin permanent/effective rows, the complete primary/secondary/concentration categories, all 23 category-2 IDs, and the exceptional advanced-effect families. No new Mod Loader fact or catalog row is required. | high |
| Web causal trace | `player-entity-store.ts`, `player-skill-runtime.ts`, `game-snapshot.ts`, `game-protocol.ts`, `native-secondary-abilities.ts` | Direct primary/autofill paths reset the cast, but developer and level-up Weld mutations can change the skill book without an atomic cast reset; new-run placement and active-party rejoin import replace it with sentinel `-1`. Runtime concentration accepts effective rank while protocol checks permanent rank. Fire Burn spawns `fire-burn-flame` with skill 22 while the decoder admits 22 only on its parent. | high |

The earlier protocol-29..72 uploads and all ten historical process exits were
also re-audited. Their real defects already have current-main fixes and
regressions: asset/save migration, Fire/Ember presentation, 8-MiB WebSocket
transport, six protocol-49 host crashes, Tutorial offscreen placement and mod
Sack decoding, enemy-event order, generated equipment identity, and terminal
Bonus replication. Expected policy closes (mod mismatch, cheats in shared Hub,
used credential, stale protocol, and synthetic acceptance) remain non-bugs.

## System boundary and membership inventory

Native/web system A: selected-skill identity from rank/equipment refresh through
primary/concentration mutation, dependent cast/runtime state, snapshot/frame
projection, save/run transitions, and teardown.

| Member (writer/branch/lifecycle) | Native/current source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Permanent learned rank | skill row `+0x20`; `PlayerSkillBook.permanentRanks` | verified-already-at-parity | learned order, acquisition, and save-facing rank continue to use permanent rank |
| Effective current rank | skill row `+0x22`; equipment/Mindstar refresh | verified-already-at-parity; wire coverage expanded | protocol tuples preserve permanent/effective values independently |
| Direct category-1 primary selection | `0x005D5600 -> 0x0065F9A0`; `selectPlayerEntityPrimarySkill` | verified-already-at-parity | accepted selection atomically resets cast identity and transient cast state |
| Level-up Spell Welding selection | row 52/build `1000..1009`; `applyPlayerEntitySkillChoice` | exact-ported in this closure | every build changes book/build/cast identity in one state result |
| Developer Weld grant | typed `sd.dev.grant_weld`; shared player-entity owner | exact-ported in this closure | every build is immediately snapshot-valid even while simulation is paused |
| Automatic invalid-primary replacement | `0x0065FD39` effective-rank scan; `autofillPlayerSkillSelections` | verified-already-at-parity; ownership consolidated | one central mutation boundary resets the cast when identity changes |
| Tutorial prepared primary | authored row 8 plus Tutorial row 72 | exact-ported through the shared mutation boundary | immediate projection is valid before another simulation tick |
| Create/loadout replacement | selected character primary and `replacePlayerLoadout` | verified-already-at-parity; ownership consolidated | supplied character pose and selected identity remain coherent |
| save migration/resume | save normalizer plus runtime refresh | verified-already-at-parity | invalid selections are repaired before a welcome snapshot |
| Hub-to-Boneyard/new-run reset | `resetPlayerEntitiesForNewRun` | exact-ported in this closure | current selected identity survives while cast/runtime clocks reset |
| active-party Boneyard rejoin import | `importPlayerEntity` plus fresh Boneyard placement | exact-ported after upstream rebase | durable selected identity replaces the placement sentinel before the first catch-up snapshot |
| concentration A | slot 16; effective-rank validation | exact-ported at wire boundary | all concentratable IDs `57..63,65..71`, including equipment-effective rows |
| concentration B | slot 20 plus Split Mind | exact-ported at wire boundary | same effective-rank rule, uniqueness, capacity, and replacement cursor preserved |
| selected primary eligibility | slot 12 plus Weld identity | exact-ported at wire boundary | category 1 and positive effective rank; Weld still requires a learned build |
| eight-slot quickbar membership | `0x005C7090`, permanent acquisition/autofill | verified-already-at-parity | null or learned category 1/2, duplicates valid; no effective-only broadening |
| learned order and Weld ownership | permanent acquisition rows | verified-already-at-parity | remain permanent-rank contracts, distinct from active selection validity |
| full welcome/reconnect snapshot | `createGameSnapshot` and strict decoder | exact-ported by the shared invariant | no invalid intermediate state can reach a new/replacing peer |
| ordinary compact frame/keyframe | `createGameSnapshotFrame` | exact-ported by the same invariant | Hub/Boneyard and recovery keyframes carry the same coherent state |
| player leave, run replacement, host teardown | player entity/world/socket owners | verified-already-at-parity | no selected-skill or cast state survives its player owner |

Native/web system B: non-category-2 skill identity carried by the shared
secondary-effect actor/event transport. The ability mechanics themselves stay
owned by their already-closed primary, passive, Hagatha, and category-2
systems; this boundary owns complete wire membership and lifetime only.

| Member (source skill / actor or event family) | Native/current source | Disposition | Proof contract |
| --- | --- | --- | --- |
| all 23 ordinary category-2 IDs | complete `NATIVE_SECONDARY_ABILITY_IDS` table | verified-already-at-parity | table-driven actor/event/player last-skill acceptance remains strict |
| Ether Burn `14` parent | `Mod_EtherBurn 0x00623960`; `ether-burn` | verified-already-at-parity | skill 14 accepted only on the native parent |
| Ether Burn `14` child flare | modifier tick `0x00629CD0`; `ether-burn-flare` | verified-already-at-parity | target-following child retains 14 and decodes |
| category-2 Fire Burn producers | Moving Fire `73`, Fire patch `23`, Ring Fire `21`, fire Magic Trap `50`, and any shared category-2 request | verified-already-at-parity | `fire-burn` and `fire-burn-flame` retain the originating ordinary ability ID |
| Fire Burn `22` parent | Fire advanced modifier; `fire-burn` | verified-already-at-parity | periodic damage owner retains 22 and decodes |
| Fire Burn `22` child flame | same modifier tick family; `fire-burn-flame` | exact-ported in this closure | every live child retains 22 and decodes; unrelated kind+22 remains rejected |
| Flash `53` grow actors | native Flash response; `flash-response-grow` | verified-already-at-parity | skill 53 remains reserved to Flash response feedback |
| Flash `53` fade actors | same response; `flash-response-fade` | verified-already-at-parity | all four native fade children decode |
| common Mindblast burst | common Mindblast effect; `mindblast-burst` | verified-already-at-parity | null skill is required with exact burst contract |
| common Mindblast shockwave | same effect; `mindblast-shockwave` | verified-already-at-parity | null skill is required with exact shockwave contract |
| event skill `22` | Fire impact/burn feedback | verified-already-at-parity | declared primary-advanced event identity remains accepted |
| event skill `53` | Flash impact/screen flash | verified-already-at-parity | cue/kind/screen-flash reservation remains strict |
| null-skill player-effect event | Mindblast/Hagatha player effect | verified-already-at-parity | null remains limited to impact plus screen flash |
| secondary player `lastSkillId` | category-2 activation state | verified-already-at-parity | exceptional primary/passive IDs remain forbidden from the player cast slot |
| actor spawn, child recurrence, expiry, target loss | `native-secondary-abilities.ts` | exact-ported for the complete exceptional matrix | parent/child state validates each live tick and disappears at its existing owner edge |
| Hub/Boneyard, full snapshot, compact frame, recovery keyframe | common snapshot protocol | exact-ported by the same matrix | topology and keyframe kind cannot change accepted identity |

No member is blocked by the browser platform. No compatibility decoder,
normalization fallback, or permissive arbitrary skill ID is allowed.

## Native ownership thread and recovered behavioral contract

- Base refresh copies permanent row `+0x20` into effective row `+0x22`, then
  equipment and Mindstar mutate effective rank. `ActorProgressionRefresh`
  validates the selected primary and both concentration slots against `+0x22`,
  repairs invalid selections, rebuilds dependent caches, and restores/clamps
  resources before returning. The protocol must describe that resulting
  active state, not re-apply a stricter permanent-rank policy.
- A primary identity change also changes cast kind, timing, target ownership,
  Weld audio variant, and presentation. The player-entity mutation owner must
  reset the cast component in the same returned store; waiting for the next
  100-Hz simulation tick creates an invalid observable state at the 20-Hz
  snapshot boundary and while paused.
- Permanent rank still owns learned-order acquisition, automatic belt
  population, and learned Weld identity. Effective rank owns whether the
  current primary/concentration remains active after equipment/Mindstar
  refresh. Those are distinct native fields and must not be collapsed.
- Fire Burn's parent spawns one target-following flame child per active tick.
  Both retain their originating skill: ordinary category-2 producers such as
  Moving Fire carry their already-valid category-2 ID, while the Fire primary
  modifier carries advanced skill 22. The child is presentation state, but its
  source identity remains semantically exact for renderer/audio/debug
  consumers; the strict decoder must enumerate the exceptional 22 pair rather
  than erase the field or admit skill 22 on arbitrary actor kinds.
- The exceptional matrix is closed: Ether Burn 14 parent/flare, Fire Burn 22
  parent/flame, Flash 53 grow/fade, and null Mindblast burst/shockwave. All
  other actor skill IDs remain one of the 23 native category-2 abilities.
- A protocol rejection is still fail-closed code 4008. The fix removes
  server-authored invalid states; it does not weaken malformed-client or
  malformed-server detection.

## Nearby-system findings

- The nine-second client ping episode in report 37 was the intentionally
  exercised long-stall path. The new baseline-recovery state emitted one open
  and one recovered record and did not cause the later actor rejection.
- The current health payload's `hubPlayers`/`hubHumanPlayers` fields count
  different scopes (world residency versus connected human occupancy); their
  differing values during a reconnect are not evidence of another fault.
- Caddy's only retained warning/error pair was one reload timeout on Aug 15;
  current Caddy is active and subsequent guarded reloads/deployments passed.
- The historical server/client archive has no additional unresolved signature
  after current-main regression mapping. Expected authorization/version closes
  remain diagnostics, not code defects.
- Existing Mod Loader documents already contain every native fact used here.
  This pass confirms their effective-rank and exceptional-effect ownership and
  therefore does not create a duplicate native report or catalog row.

## Confidence and open questions

- Confirmed: all live timestamps/reasons; full-snapshot concentration failure;
  current source writers; stock effective-rank offset and refresh ordering;
  every primary-identity writer; complete exceptional actor/event membership;
  and baseline recovery independence.
- Inferred: the exact player action that opened the primary mismatch was a
  Weld-producing mutation. The archive intentionally excludes gameplay command
  payloads, but the state invariant and deterministic direct mutation reproduce
  the exact failure regardless of whether the writer was level-up or developer
  grant.
- Unknown: none material to the state/wire closure. The precise private player
  input sequence is unnecessary once both producer paths are covered at their
  shared owner.

## Web implementation consequence

- Make `replacePlayerSkillState` the one atomic selected-primary invariant
  owner: if primary skill/build identity changes, reset the cast component in
  the same store. Remove redundant caller-only reset choreography.
- Use that same selected-primary reset when new-run placement reconstructs the
  cast component; placement owns position/heading, not learned spell identity.
- Apply the same rule when active-party rejoin imports durable skill state into
  a fresh scene placement; import clears scene-local cast clocks but preserves
  the selected learned primary before any barrier/catch-up snapshot.
- Decode selected primary and concentration eligibility from the projected
  effective-rank tuple. Preserve permanent-rank checks for learned order,
  quickbar acquisition, and Weld ownership.
- Add only `fire-burn-flame` to the skill-22 exceptional actor pair. Keep all
  unrelated kind/skill combinations rejected.
- Keep current protocol 75 and save schema 9 unchanged: no message field
  changed, and a guarded deployment disconnect/reload removes old decoders
  before the new runtime resumes.

## Validation contract

- Red Mac regressions on untouched current main:
  1. apply each Weld build through level-up and developer mutation and decode
     an immediate full snapshot/frame before another simulation tick;
  2. project primary and concentration selections whose permanent rank is zero
     and effective rank is positive, then prove the existing permanent-rank
     decoder rejection;
  3. materialize a real Fire Burn parent and child flame, then prove the child
     trips the exact production decoder error.
- Green domain/wire matrix: direct primary, every Weld build, autofill,
  Tutorial loadout, Create replacement, save restore, run reset, all fourteen
  concentration rows, both Split Mind slots, effective/permanent rank
  distinctions, and strict invalid category/zero-rank cases.
- Green exceptional-effect matrix: all 23 category-2 IDs, including the
  category-2 Fire Burn producers; Ether Burn 14 parent/flare; Fire Burn 22
  parent/flame; Flash 53 grow/fade; null Mindblast burst/shockwave;
  corresponding event reservations; and negative cross-kind substitutions.
- Run `/opt/homebrew/bin/bash ./scripts/validate.sh` on the exact clean Mac
  candidate after focused red/green tests.
- Built Mac Chrome/WebGL journey with a developer browser and independently
  decoded second client: issue the stock item/skill/Weld grants, require the
  target's immediate Hub snapshot and post-entry Boneyard snapshot to retain
  the same selected Weld, and require empty page, console, failed-response,
  disconnect, protocol-error, and host-error arrays. The focused wire matrix
  separately owns effective-only concentration and Fire-Burn child admission.
- After publication, prove local `HEAD`, fetched `origin/main`, and remote main
  are identical; then observe the guarded deployment, exact live revision,
  service health/restarts, and fresh journal/diagnostic archive for recurrence.

## Implementation validation receipt

- `replacePlayerSkillState` now owns one atomic selected-primary transition for
  direct selection, autofill, level-up Weld, developer Weld, Tutorial loadout,
  and Create replacement. `resetPlayerEntitiesForNewRun` reuses the same pure
  cast reset so placement can replace locomotion without replacing learned
  spell identity. The upstream active-party rejoin import now uses that same
  boundary after adding its fresh placement. Caller-only duplicate reset
  choreography was removed.
- Protocol selection validation now reads the projected effective-rank tuple
  member while learned order, quickbar acquisition, and Weld ownership remain
  permanent-rank contracts. The actor decoder adds only skill 22 on
  `fire-burn-flame`; category-2 Fire Burn producers, Ether Burn 14, Flash 53,
  null Mindblast, events, and negative cross-kind cases retain strict tests.
- The corrected untouched-source Mac red gate passed `1511/1516` broad
  Boneyard tests and failed exactly five new assertions: direct/all-build Weld
  state through the player-store and developer paths, effective-rank
  concentration, and the skill-22 flame child. The production strings were
  reproduced verbatim. Red log SHA-256 is
  `d795f0911cca1817e611a0eae7cf94c843e671f825067424de1452a9ad91e3e2`.
- On the rebased implementation, all five regressions pass, including all ten
  Weld builds, Hub-to-Boneyard retention, five pure primary rows, all fourteen
  concentration rows, ordinary category-2 Fire Burn sources, and the complete
  exceptional actor matrix. Two full-gate attempts were explicitly rejected
  as acceptance evidence because unrelated concurrent Mac work caused the
  existing heartbeat/observer timing assertions and Web Lua 20-ms p99 ceiling
  to fail; no task source was changed in response.
- Exact candidate base `d9aab7c1219ab42dbea333154002aad8096cc366` and the
  eight-file local/Mac manifests were byte-identical. The uncontended Mac gate
  passed the backend build and `22/22` contracts, formatting/lint/import and
  generated-Lua checks, frontend groups
  `39/9/2/45/275/1533/6/77/9/65/13/25/7/36/75`, five desktop tests,
  production frontend/GameHost builds, media policy, and bundle budget.
  `Game-CaaJHa7Z.js` is `471,100` raw / `132,187` gzip bytes against
  `524,288` / `133,120`; gate-log SHA-256 is
  `ab1441c4d6f92f5d9b8c897d3e499d889af5190bf208d3336bc6ecc4425d614e`.
- Built Chrome `151.0.7922.174`, WebGL2, protocol 75, and two independent
  clients proved all `58/72/10` developer grant catalogs. The target retained
  Gold `750`, four Health Potions, equipment recipe zero, Acid Rain
  `[72,2,2]`, and selected Weld `1000` in both the Hub snapshot and Boneyard
  run snapshot. Page, console, request-failure, and host-error arrays were
  empty. Log SHA-256 is
  `f2e5d81e6af4975c71be2c318caf39e7bd1b0043e38b4c275589dbd8dd08d10c`;
  the reviewed 1600x900 WebGL frame SHA-256 is
  `1955ff3de50704595142b329f2d5a6bd06c762bf1058d9d8bf6a0fe52cc40f40`.
- No member is browser-blocked and no material unknown remains. Publication,
  guarded deployment observation, and production recurrence sweep remain
  pending.
