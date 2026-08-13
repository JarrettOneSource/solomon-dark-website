import type { GameSimulationState } from '../core-server/game-simulation.ts'
import { boneyardGateSnapshot } from '../core-kernels/boneyard-gate.ts'
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
          participants: state.world.participants,
          students: state.world.studentPopulation.students,
        },
      }
    case 'boneyard':
      return {
        hostPlayerId,
        players: state.players,
        tick: state.tick,
        world: {
          gateLeaves: state.world.gateLeaves.map(boneyardGateSnapshot),
          kind: 'boneyard',
          runId: state.world.runId,
        },
      }
  }
}
