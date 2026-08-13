import type { GameSimulationState } from '../core-server/game-simulation.ts'
import type { GameSnapshot } from '../protocol/game-state.ts'

export function createGameSnapshot(
  state: GameSimulationState,
  hostPlayerId: string | null,
): GameSnapshot {
  switch (state.world.kind) {
    case 'hub':
      return {
        hostPlayerId,
        players: state.players,
        tick: state.tick,
        world: {
          ambient: state.world.ambient,
          collisionRngState: state.world.collisionRngState,
          kind: 'hub',
          students: state.world.studentPopulation.students,
        },
      }
    case 'boneyard':
      return {
        hostPlayerId,
        players: state.players,
        tick: state.tick,
        world: {
          kind: 'boneyard',
          runId: state.world.runId,
        },
      }
  }
}
