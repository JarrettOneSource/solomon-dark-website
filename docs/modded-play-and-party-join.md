# Modded play and Party join

Status: implemented contract, 2026-08-28.

## Product rules

- The global Hub is vanilla-only. Enabled mods, ordinary cheat mode, or a
  local-only save use a private College and cannot create global leaderboard
  receipts. Server-authenticated developer cheats remain on the ordinary route
  and are score/save neutral.
- New Game decides global versus private before Create, but the actual host
  ticket is minted only after the discipline is committed.
- Every newly created party starts Public. This includes first admission and
  the fresh singleton created by Leave or Kick. Explicit Invite Only or Private
  choices remain authoritative, and signed active-run recovery restores the
  recovered visibility instead of replacing it with the default. The supervisor
  aggregates opted-in singleton and grouped parties from every live host.
  Private parties remain unlisted; private-College rows disclose MODDED and
  CHEATS policy without exposing their Party ID or manifest.
- The Party ID is an eight-character rotatable capability shown only in the
  leader cog. It is not a URL, public listing identifier, or host credential.
- Play and Dark Cloud both expose the party directory through distinct UI
  wrappers over the same headless directory/join module.
- Public and invite-only parties remain listed while their run is in progress.
  Both directory wrappers show `IN GAME`, the current Boneyard name, and the
  current squad size/capacity, but expose no join or request action until the
  party returns to the College. Private parties remain unlisted in every state.
- Public parties join directly. Invite-only parties accept guest and signed-in
  requests; the leader accepts or denies them in the cog. The leader can invite
  any other Courtyard wizard from their Player Card regardless of visibility.
- Effective Global Chat is supervisor-wide, not shared-Hub-only. Opted-in
  participants in the resident Hub, every private College, and their Boneyards
  exchange live Global/activity messages. Party and Boneyard channels retain
  their existing exact membership; no transcript or offline queue is added.
- Every authoritative chat sender/recipient carries one opaque live player
  reference. Activating a chat name resolves the current Player Card from the
  target host on demand. A private-College leader may invite that live remote
  Hub participant; the targeted offer carries no admission credential and is
  re-resolved through the Party-ID control plane before consent.
- A private College owns its exact content. Signed-in joiners can Sync Mods and
  Join, which subscribes/enables missing host mods without disabling unrelated
  subscriptions. Guests can Download and Join Once without creating account
  subscriptions. The room ignores unrelated personal mods.
- Ordinary cheat mode is likewise room-owned in a private College. The first
  authority establishes it, only the current authority may change it, every
  join resolution/consent/welcome discloses it, and enabling it keeps the run
  conservatively local-only even if presentation is later disabled.
- Subscribing or re-enabling a mod in the Dark Cloud warms the same verified
  content cache in the background and reports progress in its footer.

## Runtime ownership

- The supervisor owns the ephemeral cross-host social broker, aggregated safe
  party directory, live Party-ID resolution, listing/request lookup,
  ten-minute join intents, short-lived reservations, and single-use host
  tickets. An accepted request is consumed with its admission, and a visibility
  change revokes stale public intents. A restart invalidates all of them with no
  database cleanup.
- The GameHost owns membership, visibility, codes, request decisions, leader
  transfer, Leave/Kick, and final admission into the party. Internal party ID,
  public listing ID, Party ID, request token, reservation, and credential are
  separate values.
- Chat messages retain only display copy, same-host actor identity, and an
  opaque player reference. Current Player Card fields resolve on demand. Remote
  College invitations expire after ten minutes and are revoked by dismissal,
  online opt-out, Party-ID rotation, run start, disconnect, or host teardown.
- Shared-Hub admission rejects nonempty content and cheats at both Website and
  host seams. Private sessions use ticket authentication and are destroyed when
  their final authenticated player and proxy leave.
- Protocol 101 retains protocol 100 in full, including protocol 98's session
  kind, party access state/actions,
  request views, cross-host player references, Player Card request/results,
  College invitation snapshots, authoritative room cheat mode, and
  content-addressed assets. Host
  and client deploy together; protocol 100 additionally accepts the exact inclusive
  native endpoints in replicated welded-primary presentation state and accepts
  the quantized closed endpoint of Coffin-owned Maggot emergence phase. It adds
  Web Lua's run-qualified Boneyard renderer-ready receipt and expanded authored
  action/runtime projections. Protocol 102 retains protocol 101 and restricts
  fresh `game-started` renderer readiness to a nullable
  wait that clears directly; positive resume grace remains reserved for
  returning to an existing run or releasing an eligible in-game pause.

## Content and saves

- The Website persists validated PNG bytes below `game-content/` by SHA-256 and
  serves `/api/game/content/{sha256}` with immutable caching. The browser
  streams, hashes, and caches the exact references before joining.
- Server-side Lua files, bundles, and Boneyards remain in the sealed host
  content and never become client authority.
- Save schema 4 carries `global-clean` or `local-only`. Every connected wizard
  receives an owner-only checkpoint; Game Over clears all current checkpoints.
  Legacy schema-3 saves migrate to local-only.
- A live private College accepts a saved profile only through a current reserved
  `new-game` party admission. The host creates one new member from that profile
  without replacing existing room simulation, content, cheat policy, or
  session-global mod state. Unreserved save-backed admissions retain the
  fresh-host-only rule.

## Acceptance

The release gate includes strict party/protocol/host/supervisor tests, backend
integration for guest request and account sync, content hash/cache tests, both
UI wrappers, mobile Party ID input/copy targets, private-session teardown, and
the repository's complete `./scripts/validate.sh` contract. Hardware-Mac
browser acceptance connects a resident-Hub guest and two separate private
Colleges, then proves Global, Whisper, Player Card, invitation, source-save
transfer, room content/cheats, Dark Cloud disclosure, and zero-session teardown.
