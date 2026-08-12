import type { HubSnapshot } from '../protocol/game-state.ts'
import type { HubSimulationState } from '../core-server/hub-simulation.ts'

export function createHubSnapshot(state: HubSimulationState): HubSnapshot {
  return {
    ambient: state.ambient,
    collisionRngState: state.collisionRngState,
    players: state.players,
    students: state.students,
    tick: state.tick,
  }
}
