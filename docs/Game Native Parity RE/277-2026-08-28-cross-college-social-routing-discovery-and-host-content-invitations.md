# 2026-08-28 — Cross-College social routing, discovery, and host-content invitations

## Reported smell and parity question

- Reported web behavior: a private College always projects its party as
  `private`, `PartySettingsDialog` replaces the visibility controls with
  `PRIVATE · PARTY ID ONLY`, and `/admin/hub/parties` reads only the resident
  shared-Hub host. A modded or ordinary-cheat College therefore cannot opt in
  to either public party browser even though Party-ID resolution and final
  admission already search every live host and already seal the private
  session's content for the joiner.
- Reported web behavior: effective Global Chat is offered only for
  `global-hub` sessions. `GameHost.chatRecipients` and activity publication
  are confined to one host, so an opted-in private-College player cannot send,
  receive, or appear in Global. Whisper target ids are likewise meaningful
  only inside one host.
- Requested behavior: Public and Invite Only remain explicit leader choices in
  modded and ordinary-cheat Colleges. Opted-in parties from every live host
  appear in Dark Cloud -> Parties and Play -> Join Party, with clear modded and
  cheats disclosure. Private remains unlisted. Every admission seam continues
  to revalidate visibility, hub state, capacity, and the exact target session.
- Requested behavior: when Online Features and Global Chat are effectively
  enabled, Global text and lifecycle activity cross the resident Hub and all
  private Colleges, including their Boneyards. Chat names open the existing
  Player Card presentation. A private-College leader may invite that live
  remote identity; acceptance previews the target mods/cheat policy, saves and
  leaves the invitee's current session, and enters the leader's College using
  the leader room's sealed manifest and cheat policy.
- Reproduction inputs: exact Website investigation base
  `4c608b42118d487a3eb2c6e1a8cb29c020df6479`; private College with one mod or
  ordinary cheats; leader opens Party settings; two browser clients connected
  to different host paths with Online Features and Global Chat enabled; Global
  send, chat-name activation, Player Card Invite, consent, and target admission.
- Falsifiers: the supervisor cannot safely broker authenticated in-process
  hosts; private party resolution does not already use the target session's
  manifest; a browser-provided manifest or cheat flag can override room truth;
  Party ID is required in the public DTO; chat sender identity is already
  globally routable; or accepting an invitation can replace a live session
  without the established save-before-leave acknowledgement.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Settled native negative census | retail Beta 0.72.5 `SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred image base `0x00400000`; Mod Loader `origin/main:docs/reverse-engineering/native-player-chat-boundary.md` | Retail owns no player-authored chat, Website party directory, Player Card, browser invitation, account subscription, or cross-host text transport. These are Website product systems. Native contributes only modal input priority and the established authoritative session/transition boundary. | high |
| Existing Website party/content owner | `docs/modded-play-and-party-join.md`; `game-host.ts` active party system, `partyTarget`, `reserveExternalPartyJoin`; `game-session-supervisor.ts` `resolvePartyTarget`, `handleJoinAdmission` | Code and listing resolution already search Hub plus private sessions. Final private admission ignores caller content and uses `session.content`; it still revalidates hub state, capacity, party identity, and reservation. Only visibility mutation and the directory read suppress private-host discovery. | high |
| Current directory/UI trace | `public-party-directory.ts`; supervisor `/admin/hub/parties`; `GameSessionProvisioner.ValidatePartyDirectory`; `PartySettingsDialog.tsx`; `DarkCloudScene.tsx`; `JoinPartyScene.tsx` | Safe directory projection omits Party ID/content credentials. The supervisor exposes only `hubHost.publicParties()`. The private settings branch hides all visibility choices and the host rejects every nonprivate private-College setting. Neither browser row carries session/mod/cheat disclosure. | high |
| Current chat/client trace | `game-chat.ts`; `GameChat.tsx`; `game-client-session.ts`; `game-host.ts` `chatRecipients`, `publishPlayerActivity`, `client-chat` | Global is excluded from every private session in both UI and authority. Sender `playerId` is host-local and a rendered name is noninteractive. Whisper searches one `clients` map. Chat history is bounded and session-local, which can remain unchanged if a broker supplies only live delivery. | high |
| Current supervisor topology | `game-session-supervisor.ts` session map, resident `hubHost`, private `SessionRecord.host`, proxy and close lifecycle | One Node supervisor process owns references to the resident Hub host and every in-process private host. It already aggregates developer presence/matches across them and closes each private host deterministically. A process-local ephemeral broker fits that lifetime without a database or public credential. | high |
| Current cheat/content trace | `client-hello.cheatsEnabled`; `GameHost` per-client taint; `PartyJoinTarget.content`; `PartyJoinConsentDialog`; private `SessionRecord.content` | Mods are already room-owned for private joins. Ordinary cheat mode remains a client-local hello/update bit, is not disclosed by a listing/resolution, and is not projected authoritatively to later joiners. The host-authority/Lua gate is already separate from global-score taint. | high |
| Current transfer lifecycle | `MainMenuScene.leaveGameplay`; `GameClientSession.saveBeforeLeave`; `GameSaveCoordinator`; browser admission/Create flow | Explicit Leave waits for an owner-only final host checkpoint and durable store write before destroying transport. Party joining already performs content preview/cache/sync and mints a ticket only after Create. A cross-host invite must compose those owners in that order rather than teleporting a socket. | high |

No new executable instruction, runtime address, asset row, or reusable retail
fact is implicated. The closed native player-chat census and native session
flow already disposition the complete applicable stock boundary, so no Mod
Loader report or catalog changes ownership in this pass.

## System boundary and membership inventory

System: **Website live social-session fabric**, beginning with effective online
preferences and an authenticated participant on one supervisor-owned host,
continuing through cross-host Global/Whisper identity and opt-in party
discovery, and ending at invitation dismissal/expiry, successful target-room
admission, disconnect, host closure, or supervisor shutdown. Simulation,
transcript persistence, offline messaging, and client-authored content authority
remain outside this sideband system.

| Member / branch | Owner/source | Disposition | Proof contract |
| --- | --- | --- | --- |
| retail player chat, directory, Player Card invitation, and mod synchronization | settled native negative census | `out-of-system` (Website extension) | no behavior is attributed to retail |
| Online Features master off | normalized browser settings plus authenticated preference update | `verified-already-at-parity` | no cross-host Global/activity/remote social targeting is emitted or received; stored child choices remain |
| Global Chat child off | same effective preference owner | `exact-ported` shared correction | Global, activity, cross-host Whisper targetability, and remote invite delivery are unavailable for that participant |
| shared-Hub singleton/grouped participant | supervisor social broker plus resident host | `exact-ported` requested policy | exchanges one authoritative Global echo with every opted-in live host participant |
| private-College singleton/grouped participant | same broker plus private host | `exact-ported` requested policy | Global is available in Hub and Boneyard without joining the resident Hub |
| standalone/local desktop session | no supervisor broker | `verified-already-at-requested-policy` | remains Party/Boneyard-local and does not fabricate Global connectivity |
| shared-Hub and private-College Boneyards | broker independent of simulation world | `exact-ported` requested policy | Global crosses worlds; Boneyard remains exact-run-only |
| Party channel | each authoritative party system | `verified-already-at-requested-policy` | never crosses a party or host boundary |
| same-host Whisper | explicit opaque player reference mapped back to one live local client | `exact-ported` shared correction | exact sender/recipient only, with same-host actor identity retained for speech |
| cross-host Whisper | supervisor broker live-reference map | `exact-ported` requested policy | exact sender/recipient only; no broadcast, persistence, or offline queue |
| Global activity entered/searching/left | successful host lifecycle edges through broker | `exact-ported` requested policy | exact existing lines cross all opted-in hosts; takeover does not emit a false departure |
| authenticated chat sender identity | host-created opaque player reference attached to the authoritative sender | `exact-ported` requested policy | browser chooses text/target only; it cannot forge sender or replace the server-issued reference |
| on-demand Player Card resolution | client request -> current host/broker member -> host-authored live card projection | `exact-ported` requested policy | message carries no copied stats; activation resolves current class/account/gold/progression/session/activity or reports unavailable |
| same-host chat world speech | recipient-host mapping from player reference to local actor id | `verified-already-at-requested-policy` | local actor keeps bubbles; a remote actor absent from the world produces no bubble |
| remote chat world speech | no actor in recipient simulation | `out-of-system` | transcript and Player Card remain; no ghost actor/nameplate is fabricated |
| ordinary chat author name | `GameChat` semantic button plus reusable Player Card | `exact-ported` requested policy | mouse, touch, keyboard activation opens the author's card |
| own outgoing Whisper recipient name | authoritative recipient reference | `exact-ported` requested policy | `To X` resolves and opens X's card rather than the local sender card |
| activity-line player name | semantic author control plus unchanged activity copy | `exact-ported` requested policy | name opens the card without changing lifecycle text |
| stale/disconnected chat identity | broker lookup on card/message/invite action | `exact-ported` failure policy | historical display copy remains in bounded chat; on-demand Card, live Whisper, and invite reject as unavailable |
| reusable local Hub Player Card | current actor/party/profile projection | `verified-already-at-requested-policy` through shared component | existing stats, class, Message, Invite, and region teardown remain |
| remote chat Player Card | chat-attached opaque reference plus on-demand host projection | `exact-ported` requested policy | shows current class/account/gold/highest wave/playtime/session/activity and current social actions without stale per-message copies |
| shared-Hub private party | existing visibility filter | `verified-already-at-requested-policy` | Private never enters either public browser |
| shared-Hub Public/Invite Only | resident host projection | `verified-already-at-requested-policy` | current directory/join/request behavior remains |
| vanilla private-College Public/Invite Only | private host projection plus supervisor aggregate | `exact-ported` requested policy | opt-in singleton/group appears with PRIVATE COLLEGE disclosure and remains joinable only in Hub |
| modded private-College Public/Invite Only | same plus sealed content summary | `exact-ported` requested policy | appears with MODDED disclosure; resolution previews exact mods; admission uses target `session.content` |
| ordinary-cheat private-College Public/Invite Only | same plus host-owned room cheat policy | `exact-ported` requested policy | appears with CHEATS disclosure; resolution/consent and welcome agree |
| modded-and-cheat College | combined directory flags and same target session | `exact-ported` requested policy | both disclosures appear and both room policies apply |
| private College visibility change | party leader action | `exact-ported` requested policy | Public/Invite Only/Private choices use the existing strict party action and refresh directory naturally |
| private College public direct join | listing resolve -> intent -> reservation -> ticket | `verified-already-at-requested-policy` once discoverable | final seam revalidates public, hub, identity, capacity, and target session |
| private College invite-only request | external request plus leader decision | `verified-already-at-requested-policy` once discoverable | target private host owns request state and accepted intent |
| listed party in Boneyard | existing playing projection/gates | `verified-already-at-requested-policy` | remains visible as IN GAME with no admission until return |
| Party ID secrecy | capability shown only to members/targeted invitee | `verified-already-at-requested-policy` | public DTO contains listing id, never Party ID or host credential |
| remote invite sender | current private-College party leader in Hub | `exact-ported` requested policy | nonleader, shared-Hub, in-run, self, same-party, stale target, full, and duplicate paths reject |
| remote invite recipient | opted-in live remote participant in Hub | `exact-ported` requested policy | receives one bounded invitation snapshot; Boneyard/offline/disabled recipients are unavailable |
| invite dismissal/expiry | broker-owned ephemeral invitation map | `exact-ported` requested policy | target dismissal, timeout, Party-ID rotation, run start, host close, and supervisor close remove the offer |
| invite acceptance preview | live Party-ID resolution plus existing consent owner | `exact-ported` requested policy | re-resolves current leader/session/content/cheats and never trusts the pushed preview as admission authority |
| invitee current-session departure | existing save-before-leave and storage coordinator | `exact-ported` requested policy | current session stays live on save failure; successful durable save precedes destruction and Create |
| invitee mod ownership | target private `SessionRecord.content` | `verified-already-at-requested-policy` | signed-in sync/download is presentation caching; unrelated local subscriptions never enter the room |
| invitee cheat ownership | private host room policy | `exact-ported` requested policy | welcome/live policy comes from the room; a nonleader local setting cannot rewrite it |
| cheat enable after room creation | current room leader authenticated update | `exact-ported` requested policy | live projection/directory changes; score/save taint remains conservative and cannot be undone |
| host/leader disconnect and replacement | existing private party/authority lifecycle plus broker registration | `exact-ported` shared correction | live player reference unregisters, later resolution fails closed, pending offers are reconciled, and room policy/content persist while the session lives |
| private host final-player teardown | supervisor close-on-empty | `verified-already-at-requested-policy` | listing, identities, invitations, tickets, and broker members disappear with the host |
| supervisor deployment/shutdown | supervisor-owned broker and host close sequence | `exact-ported` shared correction | all ephemeral routes/offers are cleared; no database cleanup or replay occurs |
| transcript, invitations, player references, and preferences in saves/snapshots/Lua/database/log content | explicit sideband exclusion | `verified-already-at-requested-policy` | none become simulation/save/content authority; bounded operational events omit message text and Party ID |
| developer observers | existing read-only observed-run projection | `out-of-system` from participant social fabric | do not register as Global participants or receive Player Card invitations |

No member is `blocked-by-platform`. HTML buttons, the existing strict
WebSocket protocol, and the in-process supervisor topology can represent the
requested behavior directly.

## Native ownership thread and recovered behavioral contract

- Native ownership remains unchanged: retail has no social fabric to port.
  The applicable stock constraints are one top input owner and authenticated
  authority over session transitions. Chat/Card/invitation UI must suspend
  gameplay input without mutating the native-style world or menu underneath.
- Website construction: one ephemeral broker is constructed by
  `GameSessionSupervisor` before the resident Hub host and is injected into
  that host and every private host. A successfully authenticated nonobserver
  client registers one supervisor-unique, unguessable, noncredential player
  reference. Host-local player id remains the actor/simulation identity and is
  never used as a cross-host locator.
- Global/Whisper authority: the sending `GameHost` retains normalization and
  flood limits, then asks the broker to resolve opted-in live recipients. The
  recipient host assigns its own monotonic transcript sequence and maps a
  same-host social sender back to the local actor id. Broker state holds no
  message history.
- Player Card authority: a chat sender/recipient carries only display copy,
  same-host actor identity, and the opaque player reference. Activating the
  name sends a bounded correlated request; the target host samples the current
  authenticated client and authoritative player state at resolution time.
  Account metadata keeps its existing presentation-only trust boundary; it
  never grants admission, cheats, content, score, or host authority. Stale or
  disconnected references fail closed instead of opening a copied stale card.
- Directory authority: each host remains the sole projector of its own opted-in
  party. The supervisor concatenates only nonclosing hosts' safe DTOs. The
  backend validates the bounded aggregate. Polling remains the UI freshness
  owner; join resolution/admission independently revalidates every decision.
- Invite authority: the private party leader and live Hub state authorize a
  targeted broker offer. The pushed join code is a capability delivered only
  to that recipient, not a ticket. Accepting it performs a fresh rate-limited
  resolve; Create is followed by the existing just-in-time reservation/ticket.
- Content/cheat authority: private `SessionRecord.content` remains immutable
  room content. Ordinary cheat mode becomes a private-room policy initialized
  by the first authority and mutable only by the current authority; enabling it
  permanently taints relevant score/save lineage even if the presentation flag
  is later disabled. Joined clients receive, but cannot override, room policy.
- Transfer order: `resolve live invitation -> preview/cache/sync target content
  -> force and durably persist current owner-only checkpoint -> destroy old
  session -> Create -> admit target intent -> connect -> host welcome`. Any
  failure before destruction retains the current session; any later failure
  returns to Title with the durable checkpoint available through Last Game.
- Saved-profile import: only a still-valid reserved private-party admission
  with `saveIntent=new-game` may hydrate the joining profile into an already
  live private Hub. The host adds one new player entity and then joins the
  destination party; it never replaces the existing simulation or applies the
  joiner's session-global saved mod state over the room owner. Unreserved and
  resume-style saves retain the fresh-host/rejoin-only restrictions.
- Bounds: existing 180-code-unit/512-byte text and five-per-five-second flood
  limits remain. Client transcript remains 80 messages. Broker participants are
  bounded by supervisor/session capacity; remote invitations are bounded per
  target, deduplicated per source party, expire with the existing ten-minute
  join-intent horizon, and carry no credential.
- Teardown: preference disable unregisters targetability without ending the
  gameplay session; socket release unregisters that live route after the exact
  departure edge; code rotation/run start/party or host destruction revoke
  pending offers; supervisor shutdown closes broker state after hosts stop.

## Nearby-system findings

- The 2026-08-27 Global-chat entry's statement that no cross-host broker was
  required was correct for its then-scoped resident-Hub-only policy. This
  request deliberately widens Global membership to separately hosted private
  Colleges, so that earlier `private College / standalone Global` disposition
  must be superseded for supervisor-backed private sessions while standalone
  remains excluded.
- The existing private admission already has the strongest required mod rule:
  final ticket content comes from the target `SessionRecord`, not the caller.
  Account mod synchronization is cache/subscription preparation, not authority.
- Public directory and Party-ID resolution are intentionally separate. The
  supervisor already searches private hosts for Party IDs; aggregating safe
  opted-in listings does not require exposing or changing the capability.
- A chat-local `playerId` cannot be promoted to a global reference because
  private hosts restart their player ordinal at `player-1`. A distinct opaque
  broker reference is mandatory; replacing simulation ids would corrupt
  save/rejoin and broad deterministic test ownership.
- An invitation cannot safely carry an already-admitted endpoint. Re-resolving
  the capability and minting the single-use ticket only after consent/Create
  preserves expiry, capacity, status, content, and visibility races.
- Native report/catalog update: none. The current native negative census and
  session-flow report already own all applicable retail facts.

## Confidence and open questions

- Confirmed: supervisor/host topology, all current directory and join seams,
  private content sealing, chat routing/sequence behavior, Player Card data
  sources, settings effective gates, cheat/host/Lua separation, and explicit
  leave-save ordering.
- Designed Website policy: cross-host membership, opaque live player
  references, on-demand Player Card resolution, discovery badges, room cheat
  projection, invitation bounds, and live-only delivery.
- Unknown material to implementation: none. Browser acceptance must still
  falsify focus layering, multi-host message ordering, content sync, and
  old-session teardown against the production build.
- Browser-specific approximation: none.

## Web implementation consequence

- Increment the exact-match gameplay protocol. Add one required opaque player
  reference to authoritative chat identities, correlated on-demand Player Card
  request/result messages, host-authored private-room cheat projection, and
  remote invitation snapshot/dismissal messages. Do not copy full Player Card
  metadata into chat messages and do not create a compatibility decoder.
- Add one cohesive supervisor-owned ephemeral social broker. Keep
  normalization/rate limits in `GameHost`, transcript history in
  `GameClientSession`, and all simulation/save state outside the broker.
- Remove the private-host visibility rejection and UI replacement note. Make
  every host project the same safe public DTO with session/mod/cheat flags;
  aggregate nonclosing hosts in the supervisor and preserve every final join
  race check.
- Reuse the existing Player Card presentation for chat identities. Make
  semantic author/recipient controls call Message or the private-leader Invite
  action with the resolved opaque player reference; never infer a target from
  display name.
- Reuse Party-ID resolve, content consent/cache/sync, Create, and just-in-time
  admission for remote accept. Compose the established save-before-leave owner
  before transport destruction; do not add a live socket migration shim.
- Make private-room cheat state authoritative and visible in listing,
  resolution, consent, welcome, and live updates. Preserve leader-only Lua and
  conservative local/global score taint boundaries.
- Update the earlier architecture/docs statements that private Colleges are
  unlisted and Global is resident-host-only. Do not add offline chat/invites,
  persisted transcripts, a database presence table, public Party IDs, direct
  endpoint pushes, client-authored profiles, or cross-supervisor delivery.

## Validation contract

- Protocol/model: strict protocol bump; required bounded sender/recipient
  reference; correlated Player Card request/current result and stale rejection;
  authoritative cheat welcome/update; invitation snapshot/dismiss exact keys;
  private/standalone channel membership; author/recipient card selection and
  own-message behavior.
- Broker unit integration: Hub <-> private, private <-> private, Hub/run <->
  private/run Global; exact Whisper pair; preference opt-outs; duplicate and
  stale target rejection; identity replacement; invite bounds/dismiss/expiry/
  source revocation; broker close.
- Host/supervisor integration: modded, cheat, combined, and vanilla private
  parties select Public/Invite Only/Private; aggregated safe directory flags;
  direct/request/code admission; playing/full/visibility/rotation races;
  target manifest and room cheat welcome; leader/nonleader invite authority;
  run start, disconnect, empty host, and deployment teardown.
- Backend/frontend: DTO validator rejects inconsistent flags/counts/session
  kinds; both directory wrappers show MODDED/CHEATS without Party ID; consent
  lists exact mods and cheats; reusable Player Card retains local branches and
  adds keyboard/touch chat activation.
- Transfer: current-session final checkpoint is durably accepted before
  destroy; save failure retains the live source session; accepted remote invite
  enters target content/policy; stale/full/running/rotated target fails without
  a leaked ticket.
- Mac Chrome: at least three real clients across resident Hub, modded/cheat
  private College, and a second private College. Prove bidirectional Global and
  Whisper, name -> Player Card, private leader Invite, recipient consent,
  source save/teardown, host mods/cheats after join, directory visibility and
  Private removal, plus empty page/console/failed-response/protocol arrays.
- Canonical gate: exact rebased candidate passes
  `/opt/homebrew/bin/bash ./scripts/validate.sh` on the Mac mini.

## Implementation validation receipt

- Browser/host candidate: commit
  `4a0e2d14345e824ea870d9bd91f7955a62f1c91f`, tree
  `e2eb58e4c67d84a3944703ea3d755b9ed0bd4bdd` in the clean Mac acceptance
  worktree. The saved-profile regression first failed on `8bc8b1c0` with
  `server-disconnect` (`A save may load only on a fresh host owner.`), then
  passed on this candidate while an unreserved save remained rejected.
- Hardware/browser: arm64 macOS `26.6.2`, Google Chrome `151.0.7922.174`,
  production frontend, development API, and protocol 98. One resident-Hub
  guest plus two independently provisioned private Colleges exchanged
  supervisor-wide Global messages and bidirectional Whisper. The modded/cheat
  leader opened the remote private-College Player Card from the chat name,
  invited it from the outgoing Whisper recipient, and the target previewed the
  exact mod/cheat policy before leaving its source session.
- Transfer/directory receipt: the target welcome carried manifest
  `87f2c82f25811433fe66215f4b26e7b598b3fd4b781f7a626fa1a90c38ff1c4e`,
  `the-survival-grounds-as-shipped@1.0.0`, and cheats enabled. The source party
  then contained two members and appeared Public in Dark Cloud with `PRIVATE
  COLLEGE`, `MODDED · 1`, and `CHEATS`; its public DTO contained no Party ID,
  credential, manifest digest, or player reference.
- Teardown/errors: final supervisor health reported zero sessions, private
  sessions/players, Hub players, parties, runs, bots, and players. The exact
  smoke also pins the live transition from two private sessions/two private
  players/one Hub player before invitation to one private session/two private
  players/one Hub player after transfer, proving that the invitee's former
  private College retires before final context teardown. Browser console
  errors, page errors, failed responses, and request failures were all empty.
  `smoke-attempt7.log` SHA-256 is
  `2c86fd0fd53a01957fbd6b1ed4800466d2e632d7316a8b6774f2f54167eb22fc`;
  `health-final-attempt7.json` is
  `7b125b7f8bf5c30c879e20b1276bf20fc5ff3ad76e9b4361d642ab62f02a32fa`.
- Visual evidence under
  `/Users/jarrett/codex-evidence/modded-college-social-20260828`: Player Card
  `f2bbdd8741576c9f184272b680121d9c26ded2226dd55745e6f3543acd630af4`,
  invitation
  `6ec5731f09784449a70fa5c7305228cf4dc7e92aa6d6abae97ea0a0a5f75f8d1`,
  consent
  `b3375d8b345d97cc0172a2dd888aa80a7282480476acfb045c83807f1b10ff88`,
  and Dark Cloud row
  `022bd8bdf12c20796ef8531cdd2469646be620eb0484ae2e80c6ae106306cfa3`.
