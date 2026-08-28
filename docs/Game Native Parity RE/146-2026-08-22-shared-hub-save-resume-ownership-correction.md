# 2026-08-22 — Shared-Hub save resume ownership correction

## Reported smell and parity question

- Live protocol-53 acceptance stored an authoritative Hub checkpoint whose
  owner position advanced beyond spawn, then resumed the same saved player ID
  at exact spawn X `950.64` on two independent production journeys.
- The save/load system was previously marked complete, so this is a secondary
  report. The missed rule was the shared-Hub merge boundary: document decode
  and private-host restore were tested, but the process-wide Hub import was not
  required to preserve locomotion plus participant region/transition.
- Falsifiers: if the stored document held spawn, if resume created a new player
  ID, or if `mergeGameSimulationPlayersIntoHub` imported the saved character and
  participant, the merge would not own the reset.

## Evidence and system boundary

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Live production | protocol 53 at `43a0454a`; two `smoke-game-saves.mjs` journeys; supervisor journal | Save JSON passed `position.x > 950.64`; resume reused the exact saved player ID; the first ready frame was spawn X both times. | high |
| Current instructions | `game-simulation.ts::mergeGameSimulationPlayersIntoHub` | The merge constructs `createPlayerCharacter(config, hubSpawnPoint())` and passes it to `importPlayerEntity`, overwriting saved locomotion/primary-cast state. | high |
| Current world merge | same function plus `hub-world.ts::addHubParticipant` | The merge also creates the default Courtyard participant instead of importing the saved Hub region/transition. | high |
| Save contract | `game-save-document.ts`, 2026-08-20 entry | The owner-only document already preserves locomotion and serialized Hub participant state; storage and decode are not the reset owner. | high |

System boundary: importing one decoded owner-only Hub simulation into the
resident shared Hub, including player character locomotion/cast state,
participant region/transition, fresh shared-host light registration, and the
unchanged post-run/new-player branches.

| Member | Source | Disposition | Proof contract |
| --- | --- | --- | --- |
| saved Hub position, velocity, facing, gait, and primary-cast state | source player entity projection | `exact-ported` | deterministic restore imports the source character rather than constructing spawn |
| saved Hub region and optional transition | source `world.participants[playerId]` | `exact-ported` | Library/private-room and in-flight transition state survive as an owned copy |
| fresh shared-host light registration and entity ID | target stores | `verified-already-at-parity` | import still allocates target-owned identity/light rows |
| economy, progression, skill/stat books | `importPlayerEntity` | `verified-already-at-parity` | existing source-component import remains unchanged |
| new unsaved Hub admission | `addSharedHubPlayer` | `verified-already-at-parity` | still constructs at Courtyard spawn with a default participant |
| post-run loadout confirmation | `enterPostRunLoadout` then merge | `verified-already-at-parity` | source intentionally resets to Hub spawn before merge |
| saved Boneyard resume | `restoreSharedGamePlayer` Boneyard branch | `verified-already-at-parity` | separate run insertion already retains its complete state |

No browser approximation is needed. `HubWorldRuntime` remains target-owned and
is not serialized; only the semantic participant record is copied.

## Web implementation and validation contract

- `importPlayerEntity` already defaults to the source character projection when
  no replacement character is supplied. The shared-Hub merge must use that
  path and add an owned copy of the source participant instead of defaulting it.
- Add a focused `restoreSharedGamePlayer` regression with a moved player in a
  private Hub region. It must fail at both position and region before the fix,
  then pass without changing new-admission or post-run tests.
- Re-run the production anonymous save/reload/Last Game journey and require the
  resumed position to remain beyond spawn with the same player ID.

## Implementation validation receipt

- Pending focused implementation, canonical gate, publication, and live retry.
