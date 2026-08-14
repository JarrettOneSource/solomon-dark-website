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
          encounter: state.world.encounter === null ? null : {
            acceleration: state.world.encounter.acceleration,
            digFrame: state.world.encounter.digFrame,
            escapeSpeed: state.world.encounter.escapeSpeed,
            headingDeg: state.world.encounter.headingDeg,
            lifetimeTicksRemaining: state.world.encounter.lifetimeTicksRemaining,
            mouthPose: state.world.encounter.mouthPose,
            mouthPoseTicksRemaining: state.world.encounter.mouthPoseTicksRemaining,
            motion: state.world.encounter.motion,
            phase: state.world.encounter.phase,
            phaseTicksRemaining: state.world.encounter.phaseTicksRemaining,
            position: { ...state.world.encounter.position },
            runEventId: state.world.encounter.runEventId,
            targetPlayerId: state.world.encounter.targetPlayerId,
            transitionOffsetY: state.world.encounter.transitionOffsetY,
            turnRate: state.world.encounter.turnRate,
            voiceEvents: state.world.encounter.voiceEvents.map((event) => ({ ...event })),
            voiceTicksRemaining: state.world.encounter.voiceTicksRemaining,
            walkCycle: state.world.encounter.walkCycle,
          },
          gateLeaves: state.world.gateLeaves.map(boneyardGateSnapshot),
          kind: 'boneyard',
          runId: state.world.runId,
          waves: state.world.waves === null ? null : {
            enemies: state.world.waves.enemies.map((enemy) => ({
              ...enemy,
              flags: [...enemy.flags],
              position: { ...enemy.position },
            })),
            interwaveDelayTicks: state.world.waves.interwaveDelayTicks,
            pendingSpawnBudget: state.world.waves.pendingSpawnBudget,
            phase: state.world.waves.phase,
            scheduleIndex: state.world.waves.scheduleIndex,
            spawnDelayTicks: state.world.waves.spawnDelayTicks,
            waveEventId: state.world.waves.waveEventId,
            waveOrdinal: state.world.waves.waveOrdinal,
          },
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
