import type { GameSimulationState } from '../core-server/game-simulation.ts'
import { hubStudentSnapshotStates } from '../core-server/hub-students.ts'
import { boneyardGateSnapshot } from '../core-kernels/boneyard-gate.ts'
import type {
  GameSnapshot,
  ProtocolStudentState,
} from '../protocol/game-state.ts'

export function createGameSnapshot(
  state: GameSimulationState,
  hostPlayerId: string | null,
): GameSnapshot {
  switch (state.world.kind) {
    case 'hub':
      return {
        hostPlayerId,
        players: state.players,
        primarySpells: state.primarySpells,
        tick: state.tick,
        world: {
          ambient: state.world.ambient,
          collisionRngState: state.world.collisionRngState,
          kind: 'hub',
          participants: state.world.participants,
          students: hubStudentSnapshotStates(state.world.studentPopulation)
            .map(protocolStudentState),
        },
      }
    case 'boneyard':
      return {
        hostPlayerId,
        players: state.players,
        primarySpells: state.primarySpells,
        tick: state.tick,
        world: {
          gateLeaves: state.world.gateLeaves.map(boneyardGateSnapshot),
          kind: 'boneyard',
          runId: state.world.runId,
        },
      }
  }
}

function protocolStudentState(
  student: ReturnType<typeof hubStudentSnapshotStates>[number],
): ProtocolStudentState {
  return {
    framePhase: student.framePhase,
    gaitDegrees: student.gaitDegrees,
    heading: student.heading,
    headingIndex: student.headingIndex,
    id: student.id,
    position: { ...student.position },
    props: student.props.map((prop) => ({ ...prop })),
    reading: student.reading,
    scale: student.scale,
  }
}
