# 2026-08-27 — Spectator respawn and authoritative wave progress

## Reported smell and parity question

- Reported feedback: while spectating, players cannot tell when they will
  return. A visible respawn timer and/or enemies-left indication was requested.
- Recovered constraint: connected-run respawn is not wall-clock based. It is
  one host-owned scheduled-wave boundary (`wave-threshold ->
  wave-lull-delay`). A fabricated seconds timer would become wrong whenever
  peers stop attacking, scheduled spawns are still incoming, Coffins create
  Maggots, gameplay pauses, or a level/loading barrier freezes the world.
- Required presentation: retain the exact spectator target/click panel and add
  a visible, accessible second native-skinned line that says respawn occurs at
  the next wave and reports current authoritative wave number, active enemies,
  and scheduled incoming enemies.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Existing native/mod death report | Mod Loader `native-player-death-spectator.md`; Website 2026-08-23 death-spectator ledger | Five seconds owns only `dying -> spectating`. Same-player respawn occurs at the authority's completed-wave edge, not after a spectator duration. | high |
| Host simulation | `game-simulation.ts:3661..3680`; `completedBoneyardWaveBoundary`; `respawnPlayerEntityAt` | The one transition restores eligible non-positive-HP entities at the authored spawn before all-dead arbitration. | high |
| Wave authority/projection | `boneyard-wave-director.ts`; `boneyard-world.ts`; `game-snapshot.ts`; protocol 85 `BoneyardWaveSnapshot` | The same director publishes `waveOrdinal` and `pendingSpawnBudget`; the snapshot publishes active actor enemies and Maggots. Director admission counts actors plus Maggots. | high |
| Current presentation | `boneyard-render-contract.ts`, `boneyard-world-renderer.ts`, `NativeSpectatorStatus.tsx` | Target choice is correctly client-local and the exact UI panel exists, but its status contains only target/click help and consumes no wave/enemy projection. | high |

No new native address or table is recovered. This is a truthful Website
product extension over already authoritative replicated state; it does not
alter the death, wave, or respawn mechanism.

## System boundary and membership inventory

| Member / branch | Disposition | Required proof |
| --- | --- | --- |
| Existing target/click status | `verified-already-at-parity` | exact top panel, font, tint, target/waiting strings, either-click cycling, and accessible owner remain |
| Scheduled retail wave | `exact-ported` presentation extension | show wave ordinal, `enemies.length + maggots.length` active count, `pendingSpawnBudget` incoming count, and `RESPAWN NEXT WAVE` |
| Opening wave before ordinal 1 | `exact-ported` | label `OPENING` rather than inventing Wave 0 |
| Zero/one/many active or incoming enemies | `exact-ported` | exact numeric data attributes and grammatical accessible copy; zero remains visible and meaningful |
| Coffin/Maggot child lifecycle | `exact-ported` | Maggots count as active authority and the displayed total may rise honestly when children materialize |
| Custom/modded scheduled Boneyard | `verified-already-at-parity` shared projection | consumes the same strict wave/enemy fields; no parallel mod estimate |
| No scheduled wave state | `exact-ported` explicit fallback | say respawn is waiting for the next wave and show active enemies; do not invent a countdown |
| Paused/loading/level barrier | `verified-already-at-parity` | frozen authoritative snapshots freeze the displayed progress too; render cadence advances nothing |
| Wave respawn before five-second death presentation ends | `verified-already-at-parity` | local player returns alive and both spectator panels remain absent |
| Wave respawn while spectating | `verified-already-at-parity` with UI teardown proof | same snapshot removes target and respawn status once, with no stale frame |
| All-dead Game Over, Tutorial solo, Hub, run replacement, renderer destroy | `out-of-system` or existing teardown | no spectator progress panel survives or appears without active spectating state |

No browser member is blocked. An exact respawn time does not exist in the
authority, so the absence of a seconds estimate is deliberate correctness,
not a platform approximation.

## Ownership and implementation consequence

- Keep target selection/camera client-local, but derive status from the same
  authoritative `GameSnapshot` already rendered. Count active actors and
  Maggots separately from scheduled incoming budget; never decrement a client
  timer or infer kills from effects.
- Preserve the existing exact spectator panel as the top atomic surface. Add a
  second panel below it with the same extracted UI records and bitmap font;
  combine both lines into one accessible live label and publish numeric/wave
  data attributes for browser proof.
- Extend status equality across every new semantic field so React updates only
  when authoritative wave progress changes. Add no protocol or save fields.

## Validation contract

- Presentation tests cover opening, numbered waves, zero/one/many actor and
  Maggot counts, pending spawns, no-wave fallback, target/waiting branches,
  equality, exact panel membership, and teardown.
- Multiplayer browser death journey proves the local five-second handoff,
  visible target plus respawn progress, changing active/incoming counts from
  host snapshots, input/camera nonregression, and immediate removal on the
  existing authoritative wave respawn.
- Canonical Mac gate and the readiness/reconnect browser matrix above remain
  required before publication.

## Implementation validation receipt

- `boneyardSpectatorStatus` now consumes a strictly narrowed Boneyard snapshot
  and derives active actors plus Maggots, scheduled incoming budget, ordinal,
  and phase. Equality includes every new semantic field. The original exact
  target/click panel remains unchanged; one second panel reuses UI
  `10,79,107..110`, the medium bitmap font, gold tint, and an eight-pixel gap.
  One combined accessible live label and explicit numeric/wave data attributes
  own browser inspection.
- Copy is intentionally progress-based: `RESPAWN NEXT WAVE | WAVE n/OPENING |
  a ACTIVE + b INCOMING`, or an explicit no-schedule fallback. No client clock
  claims a respawn time that the host does not own.
- Presentation contracts cover target and empty-target branches, opening and
  numbered waves, actors/Maggots/pending spawns, no-wave fallback, equality,
  exact native panel membership, and lifecycle teardown.
- Mac Chrome 151/WebGL2 focused multiplayer death acceptance observed the
  five-second corpse-to-spectator edge, exact camera/input lock, target
  `Gallus`, and `RESPAWN NEXT WAVE | OPENING | 0 ACTIVE + 0 INCOMING`. The
  combined accessible label reported the same authoritative values. The next
  scheduled-wave edge restored the dead player at the authored spawn on the
  same death epoch and removed both spectator panels; later all-dead Game Over,
  fresh loadouts, and Hub return also passed. Both clients' page/console error
  arrays were empty.
- Reviewed spectator-frame SHA-256 is
  `87aed3fbcc35e6cecfdacc2bcdc6ed36073ed31f5f308f8e2c91139c61125439`.
  No protocol/save expansion or browser-platform approximation was added.
- The rebased focused journey repeated the same contract with target `Oppius`:
  wave respawn restored the owner at authority tick `1840`, later Game Over /
  loadout / Hub return passed, and both clients again had empty page/console
  error arrays. Rebased spectator-frame SHA-256 is
  `87ec766b9fa4687db198997cd5a9b7a0f314860b59a084cb721fd1ec41b735e2`.
- The final protocol-87 tree repeated the focused journey successfully after
  rejecting one pre-game `net::ERR_NETWORK_CHANGED` attempt as environment
  evidence. The clean retry again proved spectator progress, wave respawn,
  Game Over/loadout/Hub return, and empty page/console error arrays. Final
  spectator-frame SHA-256 is
  `b6eabb47eb4f3ccd7f3209f8f9bef6fc8b1495966d6f3800748df44031f1cf08`.
