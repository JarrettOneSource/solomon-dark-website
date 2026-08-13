import type { GameSimulationState } from '../core-server/game-simulation.ts'
import type { GameSnapshot } from '../protocol/game-state.ts'

export function createGameSnapshot(state: GameSimulationState): GameSnapshot {
  switch (state.world.kind) {
    case 'hub':
      return {
        players: state.players,
        tick: state.tick,
        world: {
          ambient: state.world.ambient,
          collisionRngState: state.world.collisionRngState,
          kind: 'hub',
          students: state.world.studentPopulation.students,
        },
      }
  }
}
