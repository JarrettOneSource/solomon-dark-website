# 2026-08-25 — Durable party leadership, disconnected roster, and dead-row presentation

## Reported smell and parity question

- Reported web behavior: disconnect removes the player from `PartyMembership`,
  promotes a remaining member when the leader drops, and removes the ally HUD
  row because the actor is no longer present in `snapshot.players`. After a
  whole-process update, the first returning member is likewise elected leader.
- Required behavior: transport loss must not be a party leave. The original
  leader keeps the leadership role, including when a nonleader is first to
  recover an update-drained run. Every party ally remains in the fixed HUD
  roster while dead or disconnected. Death adds a red bar tint; disconnect
  adds a separate signal-loss treatment. A reconnecting actor remains absent
  from the live world while personal catch-up choices are open, and neither
  that picker nor later stacked choices pauses the live simulation.
- Stock question: does retail retain or decorate an ally row after death or
  disconnect, and is process-loss leader migration native behavior?
- Reproduction matrix: connected alive/dying/dead, connected detached picker,
  disconnected alive/dead, leader/nonleader loss, same-host and coordinated
  supervisor replacement, either return order, global Hub/private College,
  explicit party leave/kick, terminal run, Golem row, and reduced motion.

The answer separates parity from product policy. Retail's player producer at
`0x0052C910` publishes only a nonlocal durable *living connected* participant;
its row is removed on authoritative death or disconnect. Retail process-loss
authority migration remains unrecovered. Keeping those rows and preserving the
Website leader are therefore explicit multiplayer extensions. The native
50-by-5 ratio ownership, name/glyph lane, Golem membership, and frame-local
ordering remain the presentation base.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Clean retail | Beta 0.72.5 `SolomonDark.exe`, preferred base `0x00400000`, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; settled two-participant receipt `two-participant-ally-bar.png` SHA-256 `529a6f7fec4d973bada2140d57d542428d7e6eb4d25df5b152b7b2c69a8c7fe9` | Stock presents the compact live remote-participant row; no retained dead/disconnected row was observed. | high |
| Instructions/xrefs | append `0x005CF480`; player producer/call `0x0052C910`/`0x0052D2A4`; Golem producer/call `0x00615CD0`/`0x00617804`; renderer `0x005D2520` | The complete two-xref producer census admits living nonlocal players and live Golems only. Eligibility belongs to each producer; the renderer receives `{glyph, health_ratio}` and has no dead/disconnected branch. | high |
| Current Website trace | exact base `69397270b627e9cca665d7a210e789438ff1fe88`; `game-host.ts`, `shared-game-worlds.ts`, `party-system.ts`, `party-recovery-claim.ts`, `ally-hud.ts`, `AllyHud.tsx` | Socket release calls actor plus membership removal, `removePartyPlayer` elects the first remainder, schema-12 recovery carries only member count, and HUD derivation filters dead/missing actors. | high |
| Existing native reports | `native-ally-roster-hud-2026-08-14.md`, `native-hud.md`, `native-session-flow.md` | Durable identity is not an actor pointer, but stock eligibility still ends on death/disconnect. Late Arena materialization permits a returning actor without making Website leadership election native. | high |

No new retail address was required. The prior complete producer/xref census
directly falsifies a hidden stock tint or disconnected-row branch.

## System boundary and membership inventory

Native system: frame-local remote-player/Golem ally-row publication and shared
HUD rendering. Website extension: durable party membership/leadership,
restart-bound roster recovery, connection/life presentation, and detached
catch-up composition.

| Member (class/variant/scene/branch) | Native/web source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Connected, living nonlocal party player | player producer plus authoritative progression | `exact-ported` | native identity and current/max ratio remain unchanged |
| Connected player in `dying` or `dead` life state | stock producer exclusion; Website product requirement | `out-of-system` (explicit Website extension) | row remains, ratio reaches zero, red tint is present, disconnect effect absent |
| Disconnected living party player | stock disconnect exclusion; detached host record | `out-of-system` (explicit Website extension) | membership and row remain, last authoritative ratio remains, signal-loss effect is present |
| Disconnected dead party player | orthogonal Website connection/life state | `out-of-system` (explicit Website extension) | red tint and signal-loss treatment compose without conflation |
| Local player | stock local exclusion | `verified-already-at-parity` | never appears in its own ally list in any state |
| Live Golem | Golem producer `0x00615CD0` | `verified-already-at-parity` | existing row, HP, ordering, and label unchanged |
| Dead/retired Golem | Golem death flag `+0x94` | `verified-already-at-parity` | remains excluded; player-only extension does not generalize to summons |
| Leviathan, Good Imp, world-space nameplates | complete append-xref census | `out-of-system` (different producer/lane) | no new fixed-HUD row |
| Same-host nonleader disconnect/rejoin | active recovery slot plus actor detach/import | `exact-ported` for native actor lifetime with Website roster extension | actor leaves world, membership stays, same player returns once |
| Same-host leader disconnect/rejoin | Website party owner | `out-of-system` (retail migration unknown) | leader ID never changes; peers receive no leader-only action |
| Final materialized actor disconnects | existing empty-run retirement contract | `exact-ported` | party run and every recovery capability retire atomically; ordinary owner-save resume remains available |
| Coordinated update, nonleader returns first | signed recovery lineage | `out-of-system` (Website process recovery) | full ordered roster and original leader restore before later actors |
| Coordinated update, leader returns first | same signed lineage | `out-of-system` (Website process recovery) | same party/leader result independent of return order |
| Detached catch-up with zero/one/many or later-stacked offers | existing detached progression transaction | `exact-ported` actor-private choice semantics | no public actor until complete and live run ticks throughout |
| Explicit Leave Party or leader Kick | party action transaction | `verified-already-at-parity` | remains the membership-removal boundary; no reconnect reservation survives removal |
| Game Over/loadout/Hub/replaced run | recovery-lineage retirement | `verified-already-at-parity` | active-run recovery and disconnected combat-row records retire rather than fork |

## Native ownership thread

- The authoritative party membership owns social identity and leader role.
  Transport/socket presence owns only `connected`; the simulation player store
  owns materialized actor state; a detached rejoin slot owns the actor-private
  durable projection while no actor exists.
- Disconnect first captures the last authoritative config/vitals, marks the
  slot disconnected, and detaches the actor. It does not call party removal for
  an active recoverable run. Explicit leave/kick continues to call party
  removal and may perform deterministic promotion only because the leader
  intentionally relinquished membership.
- A versioned signed recovery claim owns the full ordered member roster,
  original leader, visibility, and each member's last authoritative HUD
  projection in addition to the existing player/run/content/provenance and
  normalized-document bindings. The first valid claimant restores that
  membership before exposing the run; it does not acquire leadership.
- Live party members project current config/vitals from the simulation.
  Detached members project the retained host state. Members not yet returned
  after a process replacement project the signed recovery row. Connection and
  life state stay orthogonal.
- Final catch-up import replaces only the returning actor. It neither rewrites
  party membership nor changes the leader. Terminal lineage teardown removes
  the recovery-only records.

## Recovered behavioral contract

- Stock geometry/color/ratio and Golem behavior remain unchanged for eligible
  live rows. The Website adds state decoration over the existing player row;
  it does not invent another health owner or smooth the ratio.
- `dead` means `lifeState !== 'alive'` or authoritative current HP is zero.
  `disconnected` means no connected browser/bot owns that party player. A
  staged catch-up browser is connected even though it has no public actor.
- The dead treatment is a translucent red overlay over the health bar. The
  disconnected treatment is a distinct desaturated/dim signal-loss stripe or
  scan treatment and an accessible `disconnected` label. Both can coexist;
  reduced-motion keeps a static striped treatment.
- The original leader remains the party and leader-only-action identity while
  offline and another materialized actor keeps the run live. The dedicated host
  process continues fixed ticks for that nonempty run; no member is promoted
  merely to keep simulation authority alive. If the final actor disconnects,
  the empty run retires instead of preserving leadership in a world with no
  authority. A nonleader cannot
  start the next run, rotate the Party ID, decide requests, kick, or confirm a
  leader-only portal until the leader returns or explicitly leaves.
- Disconnected members continue consuming party/host recovery capacity. A new
  admission cannot take their reserved slot. Connected staged members consume
  their ordinary connection slot, not a second detached slot.
- Detached skill selection runs through the existing private transaction and
  advances shared RNG only at each native offer action. The active world never
  enters a level barrier for that returner; later milestones append choices to
  the detached queue while the picker is open.

## Nearby-system findings

- `hostPlayerId` was serving both party-leader UX and actor-presence
  validation. Durable leadership requires the protocol to permit that ID to
  name an absent party member; clients compare it for permissions and must not
  dereference it as a live actor.
- Party-state profile projection previously enumerated connected clients only.
  Disconnected identity therefore needs an explicit bounded roster projection,
  not a fallback to opaque player IDs.
- The native ally vector is frame-local. Retention belongs in party/recovery
  state and is projected into rows; the HUD must not become a persistence
  owner.
- Native reports updated: `native-ally-roster-hud-2026-08-14.md`,
  `native-session-flow.md`, and `native-save-format.md`.

## Confidence and open questions

- Confirmed: stock producer membership and exclusion; current Website removal
  and election causes; all same-host/restart recovery owners; exact place where
  actor absence invalidates `hostPlayerId`; and user-specified extension states.
- Inferred: leadership remains intentionally unavailable rather than delegated
  while its owner is offline. This follows “maintain their leadership role” and
  preserves every existing leader-only permission check.
- Unknown: retail authority behavior after total process loss remains unknown
  and is not claimed. It cannot change the explicitly requested Website policy.

## Web implementation consequence

- Split actor detachment from party-member removal in shared and private host
  release paths. Preserve membership/leader only while the active run has a
  valid recovery lineage; keep explicit leave/kick behavior unchanged.
- Replace first-return election with strict restoration of the signed leader,
  ordered roster, visibility, and bounded ally state. Rejoin accepts a player
  already belonging to the destination party and never rejoins membership a
  second time.
- Add one party-state roster projection containing player ID, display name,
  element, connected flag, life state, and current/maximum HP. Boneyard and Hub
  pass it to the common ally-row derivation; snapshots remain the live source
  whenever the actor exists.
- Let `hostPlayerId` remain an absent durable leader ID and remove assumptions
  that it must index the current player snapshot.
- Add semantic `data-ally-dead` and `data-ally-connected` states plus accessible
  status text; keep the player-only decoration out of Golem rows.

## Validation contract

- Focused party tests: transport detach preserves membership and original
  leader; either player can rejoin; explicit removal still promotes; rejoin of
  an existing same-party member is idempotent; capacity counts disconnected
  roster members once.
- Claim/save tests: version/prefix, full-roster/leader/visibility seal, size and
  every malformed/tampered field, exact cross-member lineage equality, and
  nonleader-first replacement recovery.
- Protocol/UI tests: strict roster parsing, absent durable host ID, alive/dead/
  disconnected/dead-plus-disconnected derivation, accessible labels, semantic
  DOM attributes, CSS effects, Golem nonregression, and reduced motion.
- Host tests: peer snapshot continues ticking after leader loss; final-actor
  loss retires the run and its recovery lineage; party state
  retains both IDs and the original leader; disconnected/dead row carries last
  authoritative HP; staged return is connected but unspawned; later choices
  stack without a shared pause; terminal invalidation remains fail closed.
- Mac Chrome/WebGL: global and private two-client active runs, kill one ally,
  disconnect each role, inspect distinct/composed row states, restore a whole
  update with the nonleader first, drain stacked choices while peer/world ticks
  advance, rejoin the leader, and prove leader-only controls never transfer.
  Require visible frames and empty page/console/network/host error arrays.
- Exact-candidate gates: Website `/opt/homebrew/bin/bash ./scripts/validate.sh`
  and Mod Loader `python3 tests/re/run_static_re_tests.py --ci` on the Mac mini.

## Implementation validation receipt

- The Website implementation is based on upstream
  `4688e31b5bf860693d49a9283ffa2ded7cc91b91`. Protocol 77 adds the bounded
  local party-roster projection and permits `hostPlayerId` to retain an absent
  leader identity. Versioned `sdrpr2` claims seal the ordered roster, original
  leader, visibility, and last authoritative ally rows beside the existing
  run/content/provenance/document bindings. Disconnect detaches only the actor;
  explicit leave/kick remains the party-removal edge. Live, detached, and
  process-recovered roster sources converge through one projection.
- The exact pre-receipt Mac candidate
  `d5980f005b9534b8fb4f908aef9be567fc5a8a04` passed
  `/opt/homebrew/bin/bash ./scripts/validate.sh` on arm64 macOS 26.6.2 with
  Node 22.17.0, npm 10.9.2, and .NET 10.0.302. The gate completed a zero-
  warning/error backend build, `22/22` Website/backend contracts, formatting,
  lint/import/generated checks, `275/275` save/prerequisite tests,
  `1551/1551` broad gameplay/Boneyard tests, `77/77` ML tests, `66/66` party
  tests, every remaining frontend/desktop group, production builds, media
  policy, and bundle budget. `Game-CN_E9NqR.js` is 472,401 raw / 132,438 gzip
  bytes against 524,288 / 133,120.
- Focused host and supervisor coverage proves same-host leader detach without
  promotion, disconnected capacity counted once, same-party actor import,
  strict roster projection, and nonleader-first replacement recovery under the
  original leader. The update-recovery test restores both signed actors into
  one run and asserts the old leader before and after its later return.
- Chrome 151.0.7922.174/WebGL2 completed exact-tree global-Hub and private-
  College three-client journeys. Global run
  `68965dde94e810397bd5a6527cb9f8fc` advanced from tick `2788` to `3691`;
  private run `b683b6c593711943544f17071416f550` advanced from `2183` to `2862`.
  Both resolved detached offer sequences `[4,6,8,10,12,14,16,18]` while the
  live world continued, then materialized the returner once. Both kept the
  disconnected original leader in party order and leadership, observed the
  red dead overlay plus `ally-signal-loss` scan, and reported empty page,
  console, failed-response, failed-request, and host-error arrays.
- Reviewed dead-plus-disconnected frames are
  `party-roster-dead-disconnected-global-hub.png` SHA-256
  `d5c85a08136ad841ae68c992a83a4ec289123b87bade9df5b1dd58a323276660`
  and `party-roster-dead-disconnected-private-college.png` SHA-256
  `b2b9c0f29a2afa7d75e052c385341381b117aa2037eb39e0c5662859b1d246c8`.
  They visibly retain the dimmed/striped dead leader row above the connected
  peer while the native picker overlays a still-rendered Boneyard. Evidence is
  retained under Mac path
  `/Users/jarrett/codex-acceptance/durable-party-roster-20260825-final2/evidence/`.
- The rebased Mod Loader documentation candidate
  `00541fee374c9faffa2db15cbaf79d4fe3412f8e` passed the complete registered
  Mac static-RE suite `501/501`. No new retail address or stock retained-row /
  authority-migration behavior is asserted. Deployment remains separate and
  unauthorized.
