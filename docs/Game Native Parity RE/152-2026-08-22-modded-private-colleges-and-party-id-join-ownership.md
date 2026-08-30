# 2026-08-22 — Modded private Colleges and Party-ID join ownership

- Classification: the stock executable supplies no Website account,
  subscription, global leaderboard, public directory, Party ID, or browser
  private-session owner. This slice is an explicit `out-of-system` web product
  policy and does not claim retail parity for those surfaces.
- The native-informed ownership that remains binding is one authoritative host,
  host-selected content, leader-gated run launch, participant-local character
  state, and teardown when membership ends. The web implementation preserves
  those seams rather than introducing client-authoritative content or scores.
- The global Hub now admits only empty manifests, cheats-off clients, and
  global-clean saves. Mods, cheats, and local-only saves provision a private
  College. Private sessions use per-player single-use tickets and receive no
  leaderboard receipt secret.
- Party visibility, an unlisted rotatable Party ID, guest-capable join requests,
  Leave/Kick, and typed action results are protocol-54 web extensions. Play and
  Dark Cloud retain separate visual owners over one headless directory/join
  module. Opted-in singleton parties are listed, and only the current leader
  issues Player Card invitations. No URL carries join intent.
- A private College owns the exact sealed host manifest. Signed-in joiners may
  atomically subscribe/enable the host set; guests use it for one session.
  Unrelated personal mods never enter that room. Client PNGs travel by immutable
  SHA-256 reference while Lua, bundle validation, and Boneyards stay on the
  authoritative host.
- Save schema 4 records clean/local-only integrity and the host checkpoints each
  participant's one-wizard projection. Schema-3 input migrates conservatively to
  local-only. Game Over clears every current participant's resume slot.

## 2026-08-30 — Reopened: newly created parties defaulted Private

### Reported smell and parity question

- Reported web behavior: a newly admitted player receives a Private singleton,
  so the party is absent from public discovery until the leader changes the
  visibility manually.
- Requested behavior: every newly created party starts Public. Invite Only and
  Private remain explicit leader choices.
- Stock boundary: retail Beta 0.72.5 has no Website party visibility or public
  directory. This remains an `out-of-system` Website product rule; the native
  authority boundary only requires the host to own the state and its lifetime.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Authoritative construction trace | `party-system.ts` `registerPartyPlayer` -> `membership` at Website `6063da56` | The sole membership factory writes `visibility: 'private'`. Initial shared-Hub/private-College admission and fresh Leave/Kick singletons all consume it. | high |
| Preservation trace | `restorePartyMembership`, `joinPartyPlayer`, `removePartyPlayer`, `setPartyVisibility` | Recovery explicitly restores signed visibility; joining and leader transfer retain destination visibility; settings are leader-owned. None should be overwritten by a construction default change. | high |
| Discovery trace | `public-party-directory.ts`, supervisor aggregation, `GameSessionProvisioner.ValidatePartyDirectory` | The host excludes exactly `private`; both safe directory layers already accept Public singleton and grouped rows. There is no separate singleton filter. | high |
| Presentation trace | `PartySettingsDialog.tsx` and `server-party-state` projection | The checked radio follows authoritative host state. No client-side default exists. | high |

No executable instruction, runtime address, asset, or reusable retail fact is
implicated, so no native probe or Mod Loader artifact is required.

### System boundary and membership inventory

System: **authoritative party-visibility initialization and preservation**, from
new membership construction through explicit mutation, recovery, projection,
directory filtering, and party teardown.

| Member (branch/lifecycle) | Owner | Disposition | Proof contract |
| --- | --- | --- | --- |
| Fresh shared-Hub admission | `addSharedHubPlayer` -> `registerPartyPlayer` | `out-of-system` (Website product policy) | Singleton is Public without a settings action and appears in the safe directory. |
| Fresh private-College admission | private `GameHost` -> `registerPartyPlayer` | `out-of-system` (Website product policy) | The room party starts Public and keeps MODDED/CHEATS disclosure rules. |
| Restored singleton without active-party recovery | `restoreSharedGamePlayer` -> `registerPartyPlayer` | `out-of-system` (Website product policy) | A resumed standalone membership receives the Public construction default. |
| Developer-summoned bot singleton | `processPendingBotSummons` -> `addSharedHubPlayer` | `out-of-system` (Website developer extension) | The ordinary party participant consumes the same Public construction default until it joins another party. |
| Leave-created singleton | `leaveParty` -> `registerPartyPlayer` | `out-of-system` (Website product policy) | Departing member receives a fresh Public identity. |
| Kick-created singleton | `kickPartyPlayer` -> `registerPartyPlayer` | `out-of-system` (Website product policy) | Kicked member receives a fresh Public identity. |
| Invitation/direct-join source singleton | `joinPartyPlayer` | `verified-already-at-requested-policy` | Temporary source membership is retired; destination visibility is unchanged. |
| Leader disconnect/promotion | `removePartyPlayer` | `verified-already-at-requested-policy` | Remaining party retains its explicit visibility. |
| Signed active-run recovery | `restorePartyMembership` | `verified-already-at-requested-policy` | Recovered Public, Invite Only, or Private is restored exactly. |
| Explicit Public/Invite Only/Private setting | `setPartyVisibility` | `verified-already-at-requested-policy` | Current leader remains the only writer; choosing Private clears pending requests. |
| Host/client projection and settings radio | `projectPartyState`, `PartySettingsDialog` | `verified-already-at-requested-policy` | Echoes the authoritative visibility without a second default. |
| Public directory and backend relay | `projectPublicPartyDirectory`, supervisor, backend validator | `verified-already-at-requested-policy` | Public defaults are listed; explicit Private remains absent; capability secrets remain excluded. |
| Party removal and host/supervisor teardown | existing lifecycle owners | `verified-already-at-requested-policy` | Listings disappear with membership/host destruction; no visibility persistence is added. |

No member is `blocked-by-platform`.

### Ownership, implementation, and validation contract

- The root cause is the one authoritative `membership` factory, not the UI or
  either directory layer. Change only its construction default from Private to
  Public; do not add a client override, compatibility path, or protocol field.
- Focused coverage must fail on the old constructor and prove Public for initial,
  Leave, and Kick singletons while retaining explicit Private rejection and
  signed recovery visibility.
- Host/supervisor integration must prove shared-Hub and private-College parties
  enter the public safe directory without sending `client-party-settings`.
- Mac Chrome must enter the global Hub, open Party Settings, observe Public
  already selected, and retain empty page/console/failed-response arrays.
- The exact candidate must pass `/opt/homebrew/bin/bash ./scripts/validate.sh`
  on the Mac mini. Publication and deployment are separate and are not
  authorized by this request.

### Implementation validation receipt

- Implementation: `party-system.ts` changes only the authoritative singleton
  factory default from `private` to `public`. Initial shared-Hub and
  private-College admission plus Leave/Kick-created singleton tests now require
  Public, while explicit Private request rejection, Invite Only, signed
  recovery, destination retention, and teardown remain covered. Host/supervisor
  integration no longer sends a settings command to make new parties visible.
- Red proof: on the Mac, the documentation-and-test-only candidate against
  Website base `6063da5607d183115e332b42ddf1bceb27fadd30` failed with actual
  `private` versus expected `public`, zero shared-Hub listings versus three,
  and buffered `server-party-state:1:private` messages. The one-line factory
  change removed that exact failure class.
- Canonical Mac gate: as `origin/main` advanced during the task, the focused
  commit was replayed without conflict and the publication workflow repeated
  exact-tree validation after each rebase. The byte-identical candidate passed
  `/opt/homebrew/bin/bash ./scripts/validate.sh` on arm64 macOS 26.6.2 with
  Node 22.17.0, npm 10.9.2, and .NET 10.0.302. The party group passed `60/60`;
  backend contracts/integration, formatting, lint/import boundaries, every
  frontend group, desktop tests, production builds, media policy, and the game
  bundle budget all passed. The game entry measured 266,211 raw bytes and
  80,891 gzip bytes. The first exact-base attempt hit the unchanged observer
  snapshot-ack timeout at `game-host.test.ts:523`; the immediate complete rerun
  passed that test and the whole gate.
- Browser proof: Chrome 151.0.7922.174 loaded the production bundle through
  isolated Website backends and supervisors. Before any visibility action, the
  Party Settings dialog showed Public selected and
  `/api/game/parties` returned Public singleton rows for both `Aurelia` and
  `Basil`. Page errors, console errors, failed responses, and unexpected request
  failures were empty; final supervisor health reported zero sessions, Hub
  players, parties, runs, bots, and players. The publication workflow repeats
  this journey after every main rebase; final commit and protocol identity
  belong to the separate browser and Git push receipts. The inspected
  pre-rebase 1600x900 capture had
  SHA-256 `110c57d2e8fd7ef645ee82354f2b322e49afb03b7dbe5bf4672291ae156cb955`.
- The broader shared-party smoke was also attempted twice. Both runs passed the
  changed default-visibility step, then failed later at its existing one-second
  Boneyard input-unblocked wait (`smoke-shared-hub-parties.mjs:523`). That
  later timing check is outside party construction/discovery and is not used as
  this task's acceptance receipt; the focused real-browser mode stops after the
  affected system and proves deterministic cleanup.
- No protocol/schema migration, native report/catalog change, platform-blocked
  member, deployment, or production restart was required. Git publication is a
  separate receipt and does not imply deployment.
