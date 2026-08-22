# Modded play and Party join

Status: implemented contract, 2026-08-22.

## Product rules

- The global Hub is vanilla-only. Enabled mods, cheats, or a local-only save use
  a private College and cannot create global leaderboard receipts.
- New Game decides global versus private before Create, but the actual host
  ticket is minted only after the discipline is committed.
- Every party starts private. Global-Hub leaders may choose Public, Invite Only,
  or Private. Opted-in singleton parties are listed; private Colleges remain
  unlisted.
- The Party ID is an eight-character rotatable capability shown only in the
  leader cog. It is not a URL, public listing identifier, or host credential.
- Play and Dark Cloud both expose the party directory through distinct UI
  wrappers over the same headless directory/join module.
- Public parties join directly. Invite-only parties accept guest and signed-in
  requests; the leader accepts or denies them in the cog. The leader can invite
  any other Courtyard wizard from their Player Card regardless of visibility.
- A private College owns its exact content. Signed-in joiners can Sync Mods and
  Join, which subscribes/enables missing host mods without disabling unrelated
  subscriptions. Guests can Download and Join Once without creating account
  subscriptions. The room ignores unrelated personal mods.
- Subscribing or re-enabling a mod in the Dark Cloud warms the same verified
  content cache in the background and reports progress in its footer.

## Runtime ownership

- The supervisor owns live Party-ID resolution, listing/request lookup,
  ten-minute join intents, short-lived reservations, and single-use host
  tickets. An accepted request is consumed with its admission, and a visibility
  change revokes stale public intents. A restart invalidates all of them with no
  database cleanup.
- The GameHost owns membership, visibility, codes, request decisions, leader
  transfer, Leave/Kick, and final admission into the party. Internal party ID,
  public listing ID, Party ID, request token, reservation, and credential are
  separate values.
- Shared-Hub admission rejects nonempty content and cheats at both Website and
  host seams. Private sessions use ticket authentication and are destroyed when
  their final authenticated player and proxy leave.
- Protocol 54 carries session kind, party access state/actions, request views,
  and content-addressed assets. Host and client deploy together.

## Content and saves

- The Website persists validated PNG bytes below `game-content/` by SHA-256 and
  serves `/api/game/content/{sha256}` with immutable caching. The browser
  streams, hashes, and caches the exact references before joining.
- Server-side Lua files, bundles, and Boneyards remain in the sealed host
  content and never become client authority.
- Save schema 4 carries `global-clean` or `local-only`. Every connected wizard
  receives an owner-only checkpoint; Game Over clears all current checkpoints.
  Legacy schema-3 saves migrate to local-only.

## Acceptance

The release gate includes strict party/protocol/host/supervisor tests, backend
integration for guest request and account sync, content hash/cache tests, both
UI wrappers, mobile Party ID input/copy targets, private-session teardown, and
the repository's complete `./scripts/validate.sh` contract.
