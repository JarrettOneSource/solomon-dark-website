# 2026-08-24 — Active-party Boneyard rejoin and synchronized catch-up choices

## Reported smell and parity question

- Reported web behavior: leaving an in-progress party run deletes the wizard
  from both the live Boneyard and its party. `LAST GAME` then restores the
  browser's owner-only checkpoint as a new singleton run instead of returning
  to the still-live party.
- Required behavior: when that exact party run is still active, `LAST GAME`
  must return the same wizard to it. If the party crossed levels while the
  wizard was absent, the returner must resolve one personal native offer for
  every missed level while the existing party-run level barrier holds the
  other participants.
- Reproduction inputs/scenes: global-Hub and private-College parties; leader
  and nonleader disconnect; clean `MAIN MENU`, transport loss, same-tab
  replacement, one and several missed levels, a choice already pending at
  disconnect, an already-open peer cohort, an ordinary gameplay pause, active
  loading, Game Over/loadout/Hub, run/server teardown, mods/cheats, guests,
  scoring provenance, full capacity, and forged/replayed credentials.
- Falsifiers: stock/native multiplayer forbids authenticated Arena late
  materialization; participant progression is a shared book; browser save
  state is more authoritative than the live host; a rejoin may insert a new
  member into the frozen launch roster; missed elapsed ticks should be replayed;
  or a terminal run can still accept an actor.

The earlier active-run directory entry deliberately enforced the then-current
product rule that every playing party was nonjoinable. This reopening changes
that product rule only for a former member holding its host-issued run/player
capability. New public, request, and Party-ID joins remain barred while the
party is playing.
## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail/native session identity | retail Beta 0.72.5 `SolomonDark.exe`, preferred base `0x00400000`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; durable G13 report | Arena is native region 5 under a retained nonzero run nonce. An authenticated late join is permitted after the retained map digest and host run intent resolve; it materializes a new actor binding without restarting the authority's run. | high |
| Native room/actor lifecycle | `Gameplay_SwitchRegion 0x005CDDD0`, attach `0x005CBA00`, full reset `0x005CF920`; `native-session-flow.md` participant mid-action and join/leave tables | Durable identity/loadout/progression/vitals survive, while queued input, casts, targets, equip work, replicated transient bindings, and scene-local effects are cleared before a new materialization. A nonauthority departure retires run membership; a dead/terminal nonce rejects late entry. | high |
| Native progression and picker | `0x0067C250`, offer builder `0x0067CB70`, apply `0x00671470`, ActorWorld dispatcher `0x004022A0`; `native-progression-and-skills.md`; `skill-picker-re.md` | Every actor owns its level/XP, offer seed, ranks, and HP/MP. A shared milestone synchronizes level/XP but rolls and applies each participant's own ordered choices. An unresolved cohort ticks only PlayerActor lanes and holds enemies, projectiles, pickups, and effects. | high |
| Current Website causal trace | exact base `0d95bc27d9a9d71a80c96f9881969041f4adb6ac`; `MainMenuScene.tsx`, `game-bootstrap.ts`, `game-session-supervisor.ts`, `game-host.ts`, `shared-game-worlds.ts`, `game-save-document.ts` | `LAST GAME` chooses a fresh global/private ticket. Disconnect calls `removeSharedGamePlayer`, which removes the actor and `PartyMembership`; the save contains one owner projection only. The supervisor rejects every playing target, and the existing connection `resumeToken` can replace only a still-live socket with the same player already present. | high |
| Current level authority | `grantSharedPlayerEntityExperience`, `synchronizePlayerLevelMilestone`, `PlayerLevelUpBarrierState`, `MainMenuScene` picker/waiting surfaces | A crossed shared milestone already creates actor-private pending offers, freezes the addressed run, presents the owner picker, and shows peers the waiting surface. Disconnect already removes a waiter and releases the barrier. The missing seam is importing the detached actor and reconstructing/expanding that barrier. | high |

No fresh binary table or address was required: the canonical session and
progression campaigns already disposition the native late-materialization and
cohort mechanics. The Mod Loader reports receive a dated integration addendum
so this reuse does not become an undocumented web inference.

## System boundary and membership inventory

Native system: authenticated Arena participant materialization and actor-
private progression synchronization. Web extension boundary: issuance,
persistence, resolution, reservation, claim, reattachment, catch-up barrier,
and invalidation of one active-party rejoin capability. The dispositions below
are the required closure state; their proof remains pending until the receipt.

| Member (class/variant/scene/branch) | Native/web source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Shared-Hub party nonleader leaves an active Boneyard | G13 nonauthority departure; shared run owner | `exact-ported` | live actor and membership retire; bounded player/run slot remains while another member keeps the nonce active |
| Shared-Hub party leader leaves | existing deterministic leader promotion | `exact-ported` | earliest remaining member becomes leader/authority; returner rejoins as a member and cannot reclaim authority implicitly |
| Private-College leader or guest leaves | private host plus degenerate party projection | `exact-ported` | same run/player capability and host-transfer rules as shared parties |
| Singleton/last-human departure | empty-run/private-session teardown | `verified-already-at-parity` | no live target remains; capability invalidates and ordinary owner-save resume is used |
| Connected same-player browser takeover | existing session-scoped `resumeToken` | `verified-already-at-parity` | still-live tab replacement remains separate; active-party capability cannot replace a connected slot |
| Clean `MAIN MENU` leave | final host checkpoint and browser acknowledgement | `exact-ported` | schema-10 document containing the active capability is durable before close |
| Abrupt transport loss after a persisted run checkpoint | last accepted owner checkpoint | `exact-ported` | rejoin succeeds from the already persisted capability and server-held state |
| Browser/process death before any capability checkpoint persists | asynchronous browser storage boundary | `blocked-by-platform` (a dead browser cannot commit IndexedDB or cloud HTTP after it has stopped) | most recent accepted checkpoint bounds the loss; no invented server-to-account write or credential recovery |
| Active run, no level crossed while absent | detached actor state plus current run | `exact-ported` | spawn materialization occurs without a synthetic offer or barrier |
| One missed level | latest shared milestone | `exact-ported` | returning actor receives one personal offer and all current run participants freeze until it resolves |
| Several missed levels in one or several awards | ordered crossed-level range | `exact-ported` | exactly one queued choice per crossed level; native ten-tick offer handoffs remain intact |
| Offer already pending when the player leaves | detached actor progression | `exact-ported` | unresolved offer survives the detached durable projection and reconstructs the barrier on return |
| Peer cohort already unresolved at rejoin | current `PlayerLevelUpBarrierState` | `exact-ported` | returner joins the same barrier with the latest milestone; existing participant/pending order remains stable |
| Rejoin while ESC/book/selector pause exists | independent gameplay-pause owner | `verified-already-at-parity` with composition coverage | level barrier and source-qualified pause coexist; resolving picks never releases another owner's pause |
| Rejoiner disconnects during catch-up | existing barrier participant removal plus retained slot | `exact-ported` | peers resume immediately; the next return reconstructs only that player's still-unresolved choices |
| Actor durable state | config, economy, progression, skill/stat books, vitals, Hall row, persistent toggles | `exact-ported` | imported from host-held owner state, never from editable browser simulation bytes |
| Actor transient state | position/action/cast/target, projectiles, secondary actors/modifiers, queued input, light/entity registration | `exact-ported` by native teardown/rematerialization | return at authored Boneyard spawn with neutral action lanes and fresh target-owned registration |
| Active run world | current enemies/waves/loot/RNG/weather/scripts/mod VM | `verified-already-at-parity` | rejoin imports one player only; current live world is neither restored nor forked |
| Run loading presentation after host `active` state exists | retained Boneyard/run identity | `exact-ported` | return follows the existing loaded-content path; it does not reopen the frozen start roster |
| Game Over, loadout, returned Hub, replaced run, or server restart | terminal/missing run nonce | `verified-already-at-parity` with explicit invalidation | rejoin endpoint reports inactive and `LAST GAME` falls back to ordinary saved-wizard resume |
| Public listing, invite request, or Party-ID admission of a new member during play | preceding Website product policy | `out-of-system` (not a former-member rejoin) | all existing `IN GAME` controls and every public admission race remain rejected |
| Party visibility and code rotation | discoverability/capability owners | `verified-already-at-parity` | the private rejoin capability is independent; rotating Party ID neither grants nor revokes it |
| Host and party capacity | supervisor tickets plus detached slots | `exact-ported` | each detached wizard reserves one host/party slot; ordinary admissions cannot strand it; claim consumes exactly that slot |
| Capability guessing, replay, duplicate admission, expiry, wrong player/character/content/run | supervisor/host authentication | `exact-ported` | 256-bit token, one live reservation, exact bindings, constant credential comparison where applicable, fail-closed errors, and no state mutation |
| Global-score provenance | detached `HostClient` lineage and active run taint | `exact-ported` | authoritative rejoin preserves the original eligibility/local-only state and does not taint a fresh run merely because the browser supplied its checkpoint |
| Vanilla global content and modded private content | detached sealed manifest | `exact-ported` | rejoin ticket uses the run's original content, ignores changed subscriptions for that continuation, and never injects the browser's current mod set |
| Chat, party state, directory, player cards, roster, snapshots, saves | existing projections after actor import | `exact-ported` | returner reappears once under the same player ID; live squad count increments; no disconnected ghost is publicly projected |
| Bots, Tutorial-only solo runs, and developer observers | nonbrowser participant/read-only owners | `out-of-system` (no browser `LAST GAME` party member) | their existing lifecycle remains unchanged |
| Save schemas 1..9, profile-only rows, retired wizard | strict save migration/lifetime | `verified-already-at-parity` | missing capability parses as null; profile/Game Over/Kill Wizard cannot retain a live-party secret |

No native mechanism needed by the browser is unextractable. The one platform
block is the already-established inability of a dead browser to finish an
asynchronous local/cloud write.

## Native ownership thread and recovered behavioral contract

- The native authority fixes selection, content digest, participant intent,
  and nonzero run nonce before Arena materialization. Late materialization
  follows that retained authority; it is not another MapPicker/start edge.
- A departure removes materialized actor membership. The Website therefore
  must not leave an idle, damageable, XP-receiving ghost in the Boneyard.
  Instead, the host freezes one owner-only actor projection beside a random
  256-bit capability scoped to player, party, run, session, and sealed content.
- The token is minted at active-run entry, included only in that player's
  owner continuation, and becomes claimable only after the matching socket
  detaches. It is not the visible Party ID, internal party ID, save player ID,
  or session takeover token. A successful claim rotates it in the next
  checkpoint. Terminal/empty/replaced runs erase it.
- `LAST GAME` attempts the active-party claim before ordinary global/private
  admission. Only a definitive inactive/not-found response may fall back. A
  busy reservation, capacity conflict, authentication failure, or unavailable
  supervisor must not fork the still-live run from the browser save.
- The browser document proves which saved wizard is asking and supplies the
  capability, but the live host supplies the actual actor data. It verifies
  the same player ID, character, Boneyard/run, and sealed content, then imports
  durable actor columns and the saved Hall row. It assigns a fresh entity/light
  registration and the current map's authored spawn; action/cast/input and all
  world-owned effects stay cleared.
- While a player is detached, the slot records the latest shared level/XP
  milestone for that run. Reattachment compares the host-held actor level with
  that milestone and appends the strictly ordered crossed levels. The existing
  actor-private offer builder supplies each card list from that wizard's roots,
  ranks, perks, seed, and Hagatha state.
- If any pending choice exists, the host creates or expands the one run-owned
  `levelUpBarrier`. Every current participant receives the frozen snapshot;
  only the returner sees its own picker unless peers also have pending offers.
  Choice, reroll, save, queued rebuild, audio, actor VFX, and final release keep
  their existing native owners. No disconnected wall time becomes fixed ticks.
- Ordinary party leadership remains live-membership policy. A departed leader
  is promoted away exactly once; its return does not roll back decisions made
  by the remaining party.

## Nearby-system findings

- `sharedPartySaveStateForPlayer` intentionally produces all current party
  state before `createGameSaveDocument` removes everyone except the owner. It
  is suitable for durable checkpoints but cannot be used as live rejoin
  authority after peers continue ticking.
- `GameSaveSummary.activeRun` describes the saved document, not proof that its
  host/run is still live. The random capability plus supervisor lookup owns
  that distinction; no route may infer it from player ID, Party ID, or run ID.
- The current host treats every save-bearing admission as globally ineligible.
  That remains correct for an ordinary restore but is wrong for a capability-
  authenticated return to the same host-owned lineage. Rejoin must restore the
  detached eligibility record rather than trusting the document's integrity
  string.
- Capacity currently counts only materialized participants and pending join
  tickets. Detached rejoin slots must enter that count or unrelated Hub
  admissions can consume the only place reserved for a returning member.

## Confidence and open questions

- Confirmed: native late-Arena materialization boundary, durable/transient
  actor split, independent progression books, shared milestone and barrier,
  current web delete/fork cause, save authority, supervisor playing-state
  rejection, and all current projection/teardown seams.
- Explicit web policy: only a former member may enter an already active party;
  new members remain blocked. The return spawn is the current authored
  Boneyard spawn, matching the existing cold materialization seam and avoiding
  stale collision/action replay.
- Unknown but nonmaterial: retail authority migration after its host process
  disconnects remains unproved. The Website already has deterministic leader
  promotion and preserves it; this pass does not claim that election as a new
  retail fact.

## Web implementation consequence

- Add schema 10's nullable `partyRejoinToken` to the strict owner summary and
  migrations. Never serialize party/session IDs or host state with it.
- Add a `resume` browser admission that tries `/api/game/rejoin` first and
  falls back only on an inactive capability. The backend and supervisor mint a
  one-use ticket from the detached slot's exact content/identity/provenance.
- Add cohesive host-owned active-run slots, reservation/expiry/rotation,
  capacity accounting, milestone updates, terminal pruning, and redacted
  runtime events. Never log the token.
- Add one core-server actor-import operation and one shared-world rejoin
  operation. Reuse `importPlayerEntity`, authored Boneyard spawn, native light
  registration, party membership mutation, progression milestone/offer
  builder, and level barrier; do not deserialize the saved live world into the
  current run.
- Keep ordinary active-run directory and Party-ID/request admission unchanged.
  Remove no current same-tab takeover or ordinary save fallback.

## Validation contract

- Save contracts: schema 10 exact keys/token bounds; schemas 1..9 migrate null;
  Hub/profile/Game Over/Kill Wizard contain no token; tampered/unknown tokens
  cannot mutate a run.
- Core contracts: one-player import preserves every durable component and Hall
  row, allocates fresh entity/light identity, clears all transient owners,
  spawns exactly at the active map spawn, retains the current world, and
  rejects wrong/terminal runs.
- Progression contracts: zero/one/many missed levels, pre-existing pending
  choice, existing peer barrier, actor-private options, exact pending order,
  disconnect release/reconstruct, gameplay-pause composition, and no tick
  catch-up.
- Party/host contracts: shared/private, leader/nonleader, visibility/code
  rotation, exact player ID, content and scoring lineage, host/party capacity,
  duplicate reservation, replay, ticket expiry, terminal/empty/server teardown,
  and unchanged rejection for every new-member active-run admission.
- Canonical Mac gate: `/opt/homebrew/bin/bash ./scripts/validate.sh` on the
  manifest-identical detached candidate. Mod Loader static RE gate on its exact
  documentation candidate.
- Mac Chrome/WebGL: two real clients start one run; client B leaves through
  the saving `MAIN MENU` path; A crosses at least two levels; Title `LAST GAME`
  returns B to the same run/player ID at authored spawn; A's authoritative tick
  and enemies remain frozen across B's two native pickers and advance once
  after the final choice. Repeat with leader departure/promotion and a private
  College. Capture party/run IDs, levels, pending sets, tick/enemy positions,
  save sequence, empty page/console/failed-response arrays, and task-process
  cleanup without exposing the capability.

## Implementation validation receipt

- Website implementation is one focused commit on exact upstream base
  `bfa918c71f16aefc0dee282bbbdff03ff5457f53`. Schema 10 carries only the
  nullable owner capability. `GameHost` owns issuance, detached player state,
  reservations, capacity, milestone capture, provenance, rotation, and
  terminal pruning; `rejoinGameSimulationPlayer` imports only the durable
  actor/Hall columns at authored spawn and reconstructs the existing level
  barrier. The supervisor/backend and `LAST GAME` path claim that slot before
  ordinary restore and fall back only on a definitive inactive response.
- The complete Mac Website gate passed: backend build with zero warnings and
  errors; all backend/contracts and frontend/UI/diagnostic/desktop groups;
  lint/import boundaries; production frontend/GameHost builds; media policy;
  and bundle budget. Focused rows included durable actor/missed-choice import,
  Last Game live-first fallback, same-run host catch-up, and departed-leader
  promotion preservation. The clean retry also passed the unchanged Web Lua
  fixed-tick budget after one load-sensitive p99 sample exceeded it.
- The exact Mod Loader documentation candidate on base
  `9d518f04199e30c588cf9a9e7bbb5e174733900b` passed the complete registered
  Mac static RE suite `500/500`; log SHA-256 is
  `5d8cf814f979083e8f705df4b3a50040293f15f229777b4be83e74ed1db32ac1`.
- Mac Chrome 151/WebGL2 completed the real save/leave/level/rejoin journey for
  both host topologies. The global-Hub member returned with the same opaque
  player and run, held tick `1356`, resolved personal offer sequences
  `2,4,6`, resumed at `1436`, and rotated local save revision `2 -> 7`. The
  private-College member held `1310`, resolved the same three-sequence family,
  resumed at `1391`, and rotated `2 -> 7`. Both runs retained their live enemy
  state throughout the hold and had empty page-error, console-error, failed-
  response, and failed-request arrays. Browser-log SHA-256 values are
  `8f9bf945c762125fafab6b3f9b72b563e2025bc9b026584c6221b7c3fec2659d`
  and `04131688dcee652084f01cb853f4564ddd21b7c5b4405058322a4d9858c28bbc`.
- Reviewed post-release frames are
  `party-rejoin-catch-up-global-hub.png` SHA-256
  `8b434354aa69fabef82206b2b5d41fd4730b878a63a90774430c7d8190a7040f`
  and `party-rejoin-catch-up-private-college.png` SHA-256
  `04f3cc14682461052e7387930422711dbdd7ea1b493a1fcd71675f6fc01b004e`.
  They visibly retain both live peers, current Boneyard lighting/weather, HUD,
  and the returned party world after the final catch-up release.
- The only `blocked-by-platform` member is a browser process that dies before
  any capability-bearing checkpoint reaches IndexedDB/cloud; no code can
  execute that asynchronous write after process death. No native fact remains
  unextracted for this boundary. A normal fast-forward push is authorized;
  deployment and production restart remain unauthorized.
