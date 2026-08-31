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

## 2026-08-31 reopening — same-tick advanced-Burn painter enrollment

### Reported smell and parity question

- Reported web behavior: production protocol 113 repeatedly disconnects a
  resumed private Boneyard with code `4008` and
  `frame.secondaryAbilities.actors[0].painterRegistrations must contain exactly 1 roots`.
  Five consecutive sessions failed between `2026-08-31T19:39:40Z` and
  `19:44:39Z`; the resident supervisor stayed active with `NRestarts=0`.
- Earlier closure skipped: this entry proved advanced-effect actor identity and
  lifetime, while the later Region painter audit added strict manager roots but
  did not sweep secondary actors born after `stepNativeSecondaryAbilities`
  returns. The claim that every advanced-effect actor was snapshot-valid on its
  birth tick was therefore false.
- Stock behavior to preserve: `Mod_Burn` and `Mod_EtherBurn` are target-owned
  live modifier actors. Their painter root exists for the first visible frame;
  their separate target light registration supplies the ordered Region
  `MiscLight` tail.
- Falsifiers: Flash or a persisted invalid actor in the affected profile; a
  compact-only failure; a native zero-root Burn parent; or another post-step
  actor factory without explicit or subsequent enrollment. The profile,
  common full/frame decoder, existing native manager evidence, and complete
  caller sweep falsify those alternatives.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Live production diagnostics | NFO `DiagnosticLogs` 100/101, browser-game protocol 113, deployed Website `41e1525491649235c00e82207f67803084138943` | Both bounded reports contain the exact actor-root rejection after a successful private resume. | high-live |
| Live production lifecycle | `solomon-dark-game.service` journal and `RuntimeEvents`, `2026-08-31T19:39:40Z..19:44:39Z` | Five independent private sessions close on the same code-4008 reason. Website/game units remain active, health is idle on protocol 113, and the supervisor has zero restarts. | high-live |
| Bounded affected-save query | `WebGameSaves` slot 0, schema/format 24, revision 2618, saved tick 66000 | The active Fire/Arcane Boneyard has zero persisted secondary actors, Flash rank `0`, and Burn rank `2`. This falsifies Flash and malformed persisted-actor explanations without exposing the save document or rejoin token. | high-live |
| Existing native instructions | `Mod_Burn 0x00629A40`, `Mod_EtherBurn 0x00623960/0x00629CD0`; complete Region manager evidence in entry 090 | Burn and EtherBurn are live target modifier actors with target-registered `MiscLight`; neither has a native zero-root presentation branch. | high |
| Web causal trace | `finishGameSimulationTick`, `stepNativeSecondaryAbilities`, `applyNativeSecondaryFireBurn`, `applyNativeSecondaryEtherBurn`, `protocolSecondaryAbilities`, `nativeSecondaryActor` | The secondary step enrolls all actors known at its return. Pure-primary `spellCombat.burns` and `etherBurns` then create parent actors with `painterRegistrations: []`; the same tick projects that raw state and the decoder correctly rejects it. | high |
| Introduction boundary | Website `ceaabf2863581e9c5e2659bc1afcbbd67e3fa4df`, 2026-08-29 Region painter cutover | The cutover made one secondary painter root mandatory and added end-of-secondary-step enrollment, but left the later pure-primary Burn creation phase outside that barrier. | high |

### System boundary and membership inventory

Native/web system: advanced Burn parent construction from accepted pure or
category-2 contact through target modifier merge, Region painter/light-manager
enrollment, fixed-tick child emission, full/compact replication, save, expiry,
and owner teardown.

| Member (producer/branch/lifecycle) | Native/current source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Pure Fire primary first Burn contact | `Mod_Burn 0x00629A40`; post-secondary `spellCombat.burns` | exact-ported by this reopening | same birth tick has one transient painter root and decodes |
| Pure Ether Blast first EtherBurn contact | `Mod_EtherBurn 0x00623960/0x00629CD0`; post-secondary `spellCombat.etherBurns` | exact-ported by this reopening | same birth tick has one transient painter root and decodes |
| Existing Fire Burn merge/refresh | shared target/kind lookup | verified-already-at-parity | retains the original root while age, damage, owner, rank, and position refresh |
| Existing EtherBurn merge/refresh | shared target/kind lookup | verified-already-at-parity | retains the original root while age, owner, rank, and position refresh |
| Category-2 Fire Burn producers | skills 21, 23, 50, 73 and shared secondary requests | verified-already-at-parity | births occur inside the secondary step and its existing finalizer enrolls them before return |
| Fire Burn per-tick flame | `Mod_Burn` child; `fire-burn-flame` | verified-already-at-parity | born inside the secondary step, one transient root, exact source skill retained |
| EtherBurn per-tick flare | `Mod_EtherBurn`; `ether-burn-flare` | verified-already-at-parity | born inside the secondary step, one transient root, skill 14 retained |
| Parent painter ownership | native live modifier actor; `nativeSecondaryPainterManagerLane` | exact-ported by this reopening | exactly one `transient` registration allocated at the final actor-birth phase |
| Parent target light and `MiscLight` ordering | entry 090 complete producer census | verified-already-at-parity | target actor registration remains distinct; per-target append ordinal remains ordered |
| Flash response grow/fade | pre-secondary harmful-contact phase | out-of-system — the affected profile has no Flash and these births cross the existing enrollment pass | existing row-53 integration and protocol tests |
| Mindblast/Last Word births | explicit `registerWorldPainter` construction | out-of-system — already registered at construction even when born after the secondary step | existing full/frame and Game Over tests |
| Full snapshot, compact frame, and recovery keyframe | common secondary projection/decoder | exact-ported by one producer invariant | all three carry the same registered parent; strict malformed-state rejection remains |
| Save checkpoint and resume | schema-24 secondary state | exact-ported by the same invariant | no same-tick empty-root parent can be persisted; valid root identity survives restore |
| Target loss, expiry, player removal, run reset, host teardown | existing secondary owner lifecycle | verified-already-at-parity | parent/children and their roots retire with the existing actor owner |

No member is blocked by the browser platform. The existing protocol and save
field can represent the exact native owner; no decoder widening or migration
fallback is needed.

### Native ownership thread and recovered behavioral contract

- `finishGameSimulationTick` has two relevant construction phases. The common
  secondary phase steps category-2 actors and enrolls its complete actor list.
  Primary spell contact resolves later and may add the pure Fire/Ether advanced
  modifier parent. That later phase requires its own shared painter-enrollment
  edge before the state becomes snapshot- or save-observable.
- Every secondary presentation actor owns exactly one painter root. Burn and
  EtherBurn use the transient manager. Their `lightRegistration` is instead
  the struck target's actor-manager registration and must not be reused as the
  transient painter root.
- A merge never allocates a second root. Birth increments `nextActorId` and
  allocates one root; refresh preserves both identities until target loss,
  expiry, owner removal, world reset, or teardown.
- The protocol rejection is correct and remains fail-closed. The producer must
  finish the authoritative state before the common full/frame decoder sees it.

### Nearby-system findings

- Diagnostic row 99 is the earlier schema-24 Road-link restore failure already
  closed by Website `f1c46c02`; it is not part of this actor crash.
- Ordinary code-1000 closes and peer-going-away code 1001 entries in the same
  journal window have no paired decoder failure and are not crash signatures.
- The complete post-secondary mutation sweep found only the pure Fire and Ether
  Burn parents using deferred actor construction. Later Last Word/Mindblast
  already passes the world-manager registrar; target-effect-only mutations do
  not create painter actors.

### Confidence and open questions

- Confirmed: live signature and recurrence; no service process exit; affected
  profile element/discipline/ranks and empty saved actor list; exact producer
  ordering; both sibling late parent factories; strict projection path; native
  painter and target-light ownership; and the pure Fire `fire-burn` causal
  attribution through the exact focused red reproduction.
- Unknown: none material. The bounded production diagnostic omits the raw
  rejected frame, but the affected profile plus exact call-site reproduction
  closes the actor identity without adding production instrumentation.

### Web implementation consequence

- Put one shared secondary painter-enrollment barrier after the final
  cross-system actor-birth phase, using the authoritative
  `worldManagerOrder.register` owner.
- Allocate only missing roots and keep the existing manager-lane assertion, so
  Fire/Ether merges cannot duplicate or reorder roots.
- Preserve strict protocol count/lane validation, target light ownership,
  `MiscLight` order, combat timing, damage, audio, saves, and actor IDs. Do not
  widen the decoder or normalize malformed frames.

### Validation contract

- Red/green focused Fire integration: give a Fire/Arcane player Burn rank 2,
  resolve a real primary contact against a live Boneyard target, and immediately
  round-trip the same authoritative frame. Untouched production source must
  reproduce the exact root-count rejection; the fix must expose one transient
  root on the first Burn frame.
- Sibling Ether contract: materialize the post-secondary EtherBurn parent and
  prove the same first-frame registration, merge retention, and strict
  full/frame decoding.
- Regression matrix: category-2 Burn parents, both per-tick child families,
  target `MiscLight`, root stability, save/restore, expiry, and malformed
  zero/two/wrong-lane registration rejection.
- Mac-only complete gate: `/opt/homebrew/bin/bash ./scripts/validate.sh` against
  the byte-identical candidate.
- Built Mac Chrome: a real Fire/Arcane Burn-rank Boneyard contact must retain the
  session past the first Burn frame with empty page, console, failed-response,
  code-4008, and host-error arrays.
- After push and guarded deployment, prove the exact deployed SHA, service
  health/restarts, public route, and no recurrence in a fresh production
  contact plus a new bounded journal/diagnostic sweep.

### Implementation validation receipt

- `enrollNativeSecondaryPainterOwners` now owns the shared one-root lane
  invariant independently of light enrollment. The ordinary secondary step
  reuses it unchanged; the later pure-primary contact phase invokes it only
  when Fire/Ether contact allocated a new secondary actor. Existing parent
  merges retain their original registration, while new sibling parents receive
  distinct transient ordinals in actor-birth order.
- Protocol 113 and save schema 24 are unchanged. The strict decoder still
  rejects missing, duplicate, surplus, and wrong-lane roots. Target actor-light
  registrations, per-target `MiscLight` append ordinals, damage, timing, RNG,
  audio, actor IDs, and teardown are unchanged.
- The untouched exact-base Mac red gate reached the registered Boneyard group
  with every prior test green, then failed only the new real Fire/Arcane
  Burn-rank-2 contact at `game-simulation.test.ts`. The error was verbatim:
  `frame.secondaryAbilities.actors[0].painterRegistrations must contain exactly 1 roots`.
  Red result was `1808/1809`; log SHA-256 is
  `5a29a42e301bc3e0af0be749ff97522ce044fbd258284962882e063a2169b787`.
- The byte-identical corrected Mac candidate passed
  `/opt/homebrew/bin/bash ./scripts/validate.sh`: backend build and `28/28`
  contracts, formatting/lint/import/generated checks, every registered
  frontend group including `1810/1810` Boneyard/host tests, five desktop tests,
  production frontend/GameHost builds, media policy, and bundle budget.
  `Game-WX6FqkfJ.js` is `277279` raw / `83709` gzip bytes against
  `524288` / `134144`; green log SHA-256 is
  `157d20e2afbd30343c84e0cf1dedd5e8a10c83d309d2ffdc47f5ff7484957f6d`.
- The focused sibling regression creates late Fire Burn and EtherBurn parents,
  enrolls transient ordinals `0/1`, verifies their target actor-light identity,
  refreshes Fire Burn without allocating another root, and leaves the manager
  cursor at two. Existing category-2 parents/children and strict malformed-root
  tests remained green.
- Built Mac Chrome `151.0.7922.174` drove a real Fire/Arcane Boneyard, granted
  authored Burn rank 2 in the task harness, released nine live enemies, cast
  into one target, and decoded the live parent at age 2. The parent retained
  skill 22, rank 2,
  target actor-light registration 3, `MiscLight` ordinal 0, and exactly one
  transient painter registration at ordinal 1. The session remained live with
  empty page/console/failed-response arrays. Browser-log SHA-256 is
  `f33b7e40c84fabd9f3e82b94e14ac22ecb4c1b585cc2ee69f29335d18d961eca`;
  reviewed impact-frame SHA-256 is
  `a612b9eceece3deb6dce5e148f8524c41c4f864b1b668560ab5164de244c7cd9`.
- Temporary browser instrumentation changed no runtime/build byte and was
  removed after capture. No browser-blocked member or material unknown remains.
  Push, deployment, and post-deployment recurrence proof remain separate.
