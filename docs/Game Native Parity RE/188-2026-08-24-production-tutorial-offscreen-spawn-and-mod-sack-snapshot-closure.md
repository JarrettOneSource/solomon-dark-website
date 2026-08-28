# 2026-08-24 — Production Tutorial offscreen-spawn and mod-Sack snapshot closure

## Reported smell and parity question

- Reported request: inspect the live server logs, correct confirmed Solomon
  Dark failures, and publish the focused fix to `main`.
- NFO production at Website `f7e09723cabbfa216fec9d050fa52aab63897fcd`
  emitted an authoritative `simulation.tick_failed` followed by
  `process.uncaught_exception` at `2026-08-24T10:33:02Z`. The exact failure was
  `Boneyard has no offscreen collision-safe spawn placement for radius
  16.374996887519956 from (1455.7955322265625, 1313.0782470703125)`; systemd
  restarted the shared host five seconds later.
- At `2026-08-24T10:33:09Z`, the restarted host admitted a browser into the
  retained Boneyard and immediately closed it with code 4008 because
  `snapshot.world.loot[0].itemContentId is not allowed`.
- Stock behavior to preserve: Tutorial wave 2 and wave 3 deliberately request
  offscreen Skeleton groups and always hand a legal result through the common
  collision placement owner. A content-identified mod potion remains a normal
  Sack payload through ground state, a late join/full snapshot, compact
  replication, pickup, inventory, save, and teardown.
- Falsifiers: an authored Tutorial row using a different position policy; a
  world caller already supplying the predicate; a full snapshot which does not
  project `itemContentId`; or a malformed/non-mod Sack being accepted after
  adding the declared field would disprove the causal model.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Live production | NFO `journalctl -u solomon-dark-game.service`; prior deployment `f7e09723`; protocol 70; Node 22.17.0 | One offscreen-placement exception killed the host; the following admission rejected the declared mod-Sack content field. | high-live |
| Current deployment | NFO revision `6a5432ea14d402c7c8a549ea7be8c309e50a47ff`, started `2026-08-24T10:35:07Z` | The intervening release changes the selected ML checkpoint, not either failing contract; both services are active with zero post-start restarts. | high-live |
| Existing retail instructions | pinned Beta 0.72.5 `SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; `SpawnPositionPolicy 0x00466200`, placement `0x00463D30` | Policy 2 is offscreen; the policy result then enters the shared actor-radius, random-angle, 0.8-Y collision search. | high |
| Exact authored Tutorial | `native-tutorial.ts`; retail `tutorial.boneyard` SHA-256 `97802f2ca45d9bc6f90a497e7c12a55926298161e191fa70eee5e666b90106ed` | Wave 2 schedules three group-10052 offscreen batches; wave 3 schedules four group-10010 offscreen batches. | high |
| Current authoritative caller | `boneyard-world.ts`, `boneyard-collision.ts` | `nativeSpawnPolicyAccepts` requires `context.isOffscreen` for policy 2, while the sole world caller supplies only `lightAt`; every offscreen candidate therefore returns false and the finite host search must throw. | high |
| Current loot wire | `game-snapshot.ts`, `game-protocol.ts`, `boneyard-loot-replication.ts`, `native-loot-view.ts` | Snapshot projection emits `itemContentId`; its parser already validates decimal identity and mod/native subtype pairing, and the compact descriptor carries both 32-bit halves, but `boneyardLootSnapshot` omits the field only from `onlyKeys`. | high |
| Submitted browser diagnostics | private reports `f37970b9-b7b2-42c5-994f-42eea862a3c0` and `1105b7ef-0309-4c55-ad33-25db5dd2cad8`; iPhone browser; protocol 70 | The first report records the Tutorial host loss at `10:46:43Z`; the follow-up receives `shared-game restore requires one unique matching player` after an existing connection for the same saved owner remained live. | high-live |
| Current resume path | `game-host.ts`, `shared-game-worlds.ts`, `game-client-session.ts`, `MainMenuScene.tsx` | A restored owner is rejected whenever that player ID already exists. The protocol already carries a `resumeToken`, but the host emits a predictable placeholder, never validates it, and the menu neither retains nor supplies it. | high |

The existing Mod Loader reports already own the native facts: Tutorial
mechanics and `native-solomon-dig-and-wave-director.md` enumerate the forced
offscreen rows and addresses, while `native-items-equipment-and-loot.md` owns
the native Sack family. This pass recovers no new retail fact and therefore
does not duplicate those reports.

## System boundary and membership inventory

Native system A: Spawner position-policy selection through authoritative web
candidate geometry, collision admission, enemy registration, and failure.

| Member | Native/current owner | Disposition | Proof contract |
| --- | --- | --- | --- |
| direct policy 3 | `0x00466200`; shared resolver | verified-already-at-parity | valid roots remain identity placements; obstructed roots retain ring search |
| dark policy 0 | same; default opening/ordinary waves | verified-already-at-parity within the documented headless-light projection | existing dark retry/fallback and generated-Arena tests remain unchanged |
| light policy 1 | same; Coffin and Tutorial rows | verified-already-at-parity within the same projection | existing light predicate tests plus Tutorial light batches |
| offscreen policy 2 | same; Tutorial waves 2/3 | exact-ported web projection in this closure | world-level exact log-pattern regression, all seven authored batches, collision-safe root outside the native policy view |
| edge policy 4 | same; authored rectangle path | out-of-system for current Website producers: opaque custom TimeLines remain unsupported and no built-in/default/Tutorial row emits it | negative producer census; resolver retains explicit injected-context contract rather than inventing rectangle metadata |
| actor-radius rings, fresh angle per ring, sample count, 0.8 Y | `0x00463D30` | verified-already-at-parity | existing exact candidate/RNG tests stay green |
| generated active-bounds projection and mobility probe | documented Website safety adaptation | verified-already-at-parity | all 12 generated templates and saturated-world strict error remain |
| Skeleton, Archer, Mage, Imp, Zombie, Wraith, Demon, Coffin | shared enemy materializer | verified-already-at-parity; all consume the corrected policy context | existing family construction plus offscreen Skeleton integration |
| living-player view ownership | native local camera; multiplayer browser host | web-adapted | one stable native 1600x900/1.35 policy view per living participant, clamped to active bounds; candidate must be outside every such view |
| zero-living-player fallback | native camera-center Spawner fallback | web-adapted | active-bounds center supplies one deterministic policy view |
| impossible/saturated bounds | finite Website safety boundary | verified-already-at-parity | explicit throw remains; only legal offscreen inputs are made total |
| run replacement/host teardown | world and supervisor owners | verified-already-at-parity | no retained policy or actor state |

Native/web system B: native Sack identity plus the mod-content extension from
authoritative item through both wire forms and every downstream consumer.

| Member | Current owner | Disposition | Proof contract |
| --- | --- | --- | --- |
| native potion subtypes 0..5 | loot/item catalogs | verified-already-at-parity | null content ID remains mandatory |
| registered mod-potion subtype 6..261 | content registry and Sack carrier | exact-ported web extension | positive decimal content ID remains mandatory and round-trips losslessly |
| equipment, key, sack, skill-book and other native Sack payloads | native item catalog | verified-already-at-parity | any content ID remains rejected |
| authoritative ground projection | `game-snapshot.ts` | verified-already-at-parity | immutable content ID is emitted from `item.modContent` |
| full welcome/resume snapshot | `game-protocol.ts:boneyardLootSnapshot` | exact-ported in this closure | declared key is accepted, then existing kind/type/subtype/content validation runs |
| compact keyframe/delta descriptor | `boneyard-loot-replication.ts` | verified-already-at-parity; coverage expanded | high/low 32-bit words reconstruct the same positive 63-bit decimal string |
| renderer and catalog lookup | `native-loot-view.ts` | verified-already-at-parity | late join renders the registered ground frame; unknown content still fails closed |
| pickup, inventory, save, consume, effect | economy/content registry | verified-already-at-parity | existing Invincibility Potion lifecycle remains unchanged |
| malformed/extra fields and inconsistent identities | strict protocol boundary | verified-already-at-parity | only the one declared field is added; all unrelated unknown keys and invalid pairings still reject |
| pickup/run/world/party/host teardown | loot/economy/runtime owners | verified-already-at-parity | no ground descriptor, catalog view, or effect survives its owner |

Web system C: save-owner reconnection from a still-live browser authority to a
replacement transport without duplicating or rolling back the player.

| Member | Current owner | Disposition | Proof contract |
| --- | --- | --- | --- |
| normal resume after host restart/no live owner | save parser plus `restoreSharedGamePlayer` | verified-already-at-parity | exact saved player/world/run restores once |
| same-tab reload while the former socket remains live | protocol resume token, client storage, host client map | exact-ported in this closure | valid opaque token atomically replaces only the transport and preserves newer live authority state |
| second tab or forged save naming a live player | same owner | exact-ported rejection | missing/wrong token cannot evict or control the live player |
| old replaced browser | transport close lifecycle | exact-ported | explicit replaced-session close reason; no removal of the preserved player/party/run |
| new replacement browser | normal welcome/baseline/checkpoint owners | exact-ported | fresh token, keyframe baseline, idle input, same player/party/run identity |
| Hub, Boneyard, Tutorial, Game Over/loadout | shared `stateForPlayer` path | exact-ported | takeover is transport-only in every phase; no saved-state rollback or scene reconstruction |
| authenticated and anonymous saves | cloud/local save coordinators plus one-use admission | exact-ported | token is tab-session local and never sent in diagnostics or persisted inside the save document |
| active party, pause, Lua/mod runtime, leaderboard eligibility | existing player-owned runtime state | verified-already-at-parity and preserved | transport replacement does not recreate or transfer these owners |
| old-tab close/error race after takeover | socket release owner | exact-ported | superseded close cannot delete the replacement player's world or checkpoint state |
| ordinary disconnect, explicit leave, timeout, deployment drain | existing release owners | verified-already-at-parity | unchanged removal/checkpoint semantics when no authenticated takeover occurred |

No member is blocked by the browser platform. Exact native offscreen identity
cannot be reproduced on a headless multiplayer host because retail queries one
render-local camera while browser participants may have distinct responsive
views and FOV settings. The already documented web projection uses the stock
logical surface/zoom and requires offscreen status for every living player; it
does not claim pixel identity for non-default FOVs.

## Native ownership thread and recovered behavioral contract

- Tutorial scripts create the offscreen intents; the enemy materializer owns
  randomized collision radius; Boneyard world owns active bounds/collision and
  player positions; the placement resolver alone consumes policy predicates
  and authoritative RNG before actor registration.
- The missing callback is an ownership break, not an exhausted geometry. With
  no callback, `context.isOffscreen?.(candidate) ?? false` rejects every
  candidate independently of bounds, obstacles, radius, or RNG. Supplying the
  complete world context makes the existing finite ring search total for the
  logged legal Tutorial input while preserving strict failure for a genuinely
  saturated arena.
- The native logical view is 1600x900 at Boneyard zoom 1.35. Each focus is
  clamped exactly like the Boneyard camera before strict point-outside tests;
  multiplayer admission requires the root outside every living participant's
  native policy rectangle. With no living participant, active-bounds center is
  the deterministic native camera-center analogue.
- A mod potion's positive 63-bit content identity is authoritative item data,
  not an optional presentation hint. Full JSON snapshots and compact entity
  descriptors are two encodings of the same field. The parser must admit the
  declared key before applying its already strict identity rules.
- A live shared-world player is authoritative and may be newer than the save
  presented by a reconnecting browser. A valid reconnect therefore replaces
  only the old socket/client bookkeeping and sends a fresh keyframe from the
  live state; it must not remove/recreate the party or overwrite live state
  with the possibly older document. Possession of a structurally valid save is
  not sufficient to evict a live player because player IDs are observable.
- The already-declared `resumeToken` becomes a random 256-bit bearer bound to
  one live client. The browser retains it only in same-tab `sessionStorage`,
  keyed by saved player ID, and supplies it only with a resume request. A new
  successful connection rotates it. Missing/stale tokens remain harmless when
  no live player exists, which preserves ordinary post-crash restoration.
- Disconnect, run replacement, pickup, actor retirement, and process teardown
  remove the relevant state through existing owners; neither fix adds retained
  fallback state or a protocol compatibility branch.

## Nearby-system findings

- Since local midnight the old deployment also emitted 214
  `replication.baseline_missing` warnings. They arrived in short bursts from
  clients roughly one retained 64-snapshot window behind, with no paired
  process failure. The acknowledged baseline remains retained, the host
  requests a keyframe, and the clients recover. This is the previously
  documented severe-browser-stall diagnostic, not a third causal failure, so
  its semantics and warning level remain unchanged.
- Ordinary 1000/1001/1006 browser closes and the matching proxy/host close
  rows are lifecycle consequences, not code faults.

## Web implementation consequence

- Add one pure Boneyard policy-view helper beside collision placement and pass
  the world-owned offscreen predicate from the sole authoritative caller.
  Keep edge metadata absent until a supported producer owns its rectangle.
- Add `itemContentId` to the full Boneyard-loot snapshot allowlist. Do not
  weaken decimal, subtype, kind, catalog, or unknown-key validation and do not
  add a legacy decoder.
- Complete the existing reconnect-token seam: issue a random token, retain it
  per tab, require constant-time equality before replacing a live saved owner,
  detach the superseded socket without running player teardown, preserve the
  live shared state, rotate the token, and give the old browser an explicit
  replacement close reason. Do not permit save-only takeover or add a second
  player identity.
- Turn the live log inputs into regressions at the real seams: world-level
  offscreen materialization, full welcome decode with a mod Sack, compact
  entity round-trip, and a late-join built-browser mod-loot journey.

## Validation contract

- First run the new focused cases red on a clean exact Mac candidate: the
  world call throws the logged offscreen error and the full snapshot rejects
  `itemContentId`.
- After the fix, cover strict camera edges, clamped small/large bounds,
  multiple living players, zero-player fallback, all five position-policy
  dispositions, collision mobility, exact RNG handoff, native/mod Sack
  identity matrices, full welcome, compact keyframe/delta, renderer catalog
  lookup, pickup, and teardown.
- Cover resume with no live owner, valid same-tab live takeover in Hub and
  Boneyard/Tutorial, invalid/missing token rejection, token rotation, preserved
  tick/run/party state, and the late old-socket close race. Verify the browser
  retains the token in session storage but diagnostics/save JSON do not.
- Run `/opt/homebrew/bin/bash ./scripts/validate.sh` on the exact Mac tree.
- Extend the real Mac Invincibility Potion Chrome journey with a third browser
  admitted while the content-identified Sack is on the ground; require the
  same item ID/frame on all clients and empty page/console/network/host-error
  arrays. Run a real Tutorial/offscreen Boneyard journey or an equivalent
  browser-host receipt that materializes the authored policy through the
  authoritative world seam without an exception.

## Implementation validation receipt

- The Boneyard world now supplies one complete offscreen policy context to the
  existing placement owner. Its stock 1600x900/1.35 view is clamped per living
  player; a candidate must be outside every view, with active-bounds center as
  the no-player fallback. Direct/dark/light behavior, native ring/RNG order,
  collision mobility, generated combat confinement, and impossible-world
  errors remain unchanged.
- The full Boneyard snapshot allowlist now admits its already-declared
  `itemContentId`; all existing decimal, kind, native type/subtype, compact
  descriptor, catalog, unknown-key, pickup, and teardown checks remain strict.
- Shared-Hub welcomes now issue random 256-bit resume tokens. The browser
  stores the rotated token only in same-tab `sessionStorage` and supplies it
  with a saved resume. A matching live-owner reconnect replaces only the old
  socket/client baseline and preserves the newer player/party/run state. A
  wrong or absent token still rejects, and the superseded close cannot remove
  the replacement player. Close code 4002 gives the old tab the explicit
  `This wizard resumed in another browser tab.` explanation.
- The final behavioral red Mac run compiled against untouched production
  owners and failed exactly four new cases while the other 1,475 broad game
  tests passed: strict offscreen view geometry, world-level Tutorial placement,
  full-snapshot mod Sack parsing, and live Tutorial transport replacement.
  All four pass after the implementation, alongside the compact loot and
  invalid-token matrices.
- Exact code candidate `3b6f30a3e4e738b4bf3b5cd564e893fdf7221395`, tree
  `16c81a6158973cf3b86f54125df3603fd91a469d`, was byte-identical across the
  local and Mac 19-file manifests. Apple arm64 macOS 26.6.2 used Node 22.17.0,
  npm 10.9.2, .NET 10.0.302, and Chrome 151.0.7922.170. The complete supported
  Mac gate passed: 22 backend/repository contracts; frontend groups
  `9/4/45/264/1480/6/77/9/63/12/14/7/36/33`; five desktop tests; formatting,
  lint and architecture fences; production frontend/GameHost builds; media
  policy; and bundle budget (`458,583` raw / `128,659` gzip). Log SHA-256 is
  `ee19a86e1f1e3c517f4422bd4c0b2cf462514b72467bac29279491c519bdea2e`.
- Real Mac Chrome/WebGL acceptance materialized one policy-2 Skeleton at
  `(1193.74169921875,558.2372436523438)`, radius
  `17.563040409237146`, outside both participant views, exposed it to both
  browser snapshot timelines, and retired it cleanly. The same run admitted a
  third browser while content-identified Sack `8068156596081641415` was live,
  rendered the registered ground frame from its full welcome, then proved
  pickup, inventory, consume, mana/damage filters, and owner-only effect on two
  WebGL2 clients. Page, console, failed-response, and host-error arrays were
  empty; log SHA-256 is
  `6bd05ee0a8092e710b4adbeda0493753c8279b836e14d69bfa1a3154045d6c30`.
  Offscreen and late-join captures hash to
  `bac80f1a7be3f1fc47c8f8793cf028207619dd57fb329215944f591b27c15cad`
  and `df65f01637179a5a3e3057c65787b9b221afee056cb328b861c10c0809ffca5a`.
- A separate built-site global-Hub Chrome journey kept tab A live, copied only
  its tab-scoped token into tab B, and resumed the same save. Both welcomes had
  player ID `player-iDeeh-sR5XYTBvdI`; occupancy remained one, the second
  connection logged `replacedConnection=true`, and tab A received the expected
  replacement explanation. No unexpected console, page, or network error
  remained. Log SHA-256 is
  `be7fe6a58d990be2b7787d5319f2217936470385075877994f98302898f607b4`.
- No native report changed because this closure discovered no new retail fact;
  it corrected three Website ownership handoffs against the already complete
  native records. Publication, automatic deployment observation, and final
  production log verification remain pending and are reported separately.
