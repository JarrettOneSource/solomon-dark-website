import {
  gameSimulationPlayerRecords,
  getPlayerProgression,
  getPlayerSkillBook,
  type GameSimulationState,
} from '../core-server/game-simulation.ts'
import { hubStudentSnapshotStates } from '../core-server/hub-students.ts'
import { boneyardGateSnapshot } from '../core-kernels/boneyard-gate.ts'
import { playerEntityDisplayHealth } from '../core-server/player-entity-store.ts'
import type { BoneyardEnemySemanticEvent } from '../core-server/boneyard-enemy-store.ts'
import type {
  BoneyardEnemyEventSnapshot,
  GameSnapshot,
  ProtocolPlayerState,
  ProtocolStudentState,
} from '../protocol/game-state.ts'
import {
  projectBoneyardEnemies,
  projectBoneyardEnemyProjectiles,
  projectBoneyardMaggots,
} from './project-boneyard-enemies.ts'

export function createGameSnapshot(
  state: GameSimulationState,
  hostPlayerId: string | null,
): GameSnapshot {
  const players = Object.fromEntries(Object.entries(gameSimulationPlayerRecords(state)).map(
    ([playerId, player]) => [playerId, protocolPlayerState(state, playerId, player)],
  ))
  switch (state.world.kind) {
    case 'hub':
      return {
        hostPlayerId,
        players,
        primarySpells: state.primarySpells,
        run: state.run,
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
    case 'boneyard': {
      const runId = state.world.runId
      return {
        hostPlayerId,
        players,
        primarySpells: state.primarySpells,
        run: state.run,
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
          enemies: projectBoneyardEnemies(state.world.enemies, state.tick),
          enemyEvents: state.world.enemyEvents.map((event) => (
            protocolBoneyardEnemyEvent(event, runId)
          )),
          enemyProjectiles: projectBoneyardEnemyProjectiles(state.world.enemies),
          maggots: projectBoneyardMaggots(state.world.enemies, state.tick),
          gateLeaves: state.world.gateLeaves.map(boneyardGateSnapshot),
          kind: 'boneyard',
          runId,
          waves: state.world.waves === null ? null : {
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
}

function protocolBoneyardEnemyEvent(
  event: BoneyardEnemySemanticEvent,
  runId: string,
): BoneyardEnemyEventSnapshot {
  return {
    actorId: event.actorId,
    eventId: event.eventId,
    runId,
    tick: event.tick,
    type: event.type,
    ...(event.count === undefined ? {} : { count: event.count }),
    ...(event.output === undefined ? {} : { output: event.output }),
    ...(event.projectileId === undefined ? {} : { projectileId: event.projectileId }),
    ...(event.targetPlayerId === undefined ? {} : { targetPlayerId: event.targetPlayerId }),
  }
}

function protocolPlayerState(
  state: GameSimulationState,
  playerId: string,
  player: Omit<ProtocolPlayerState, 'progression'>,
): ProtocolPlayerState {
  const progression = getPlayerProgression(state, playerId)
  const skillBook = getPlayerSkillBook(state, playerId)
  const learnedSkills: Array<readonly [number, number, number]> = []
  for (let skillId = 0; skillId < skillBook.permanentRanks.length; skillId += 1) {
    const permanentRank = skillBook.permanentRanks[skillId] ?? 0
    const effectiveRank = skillBook.effectiveRanks[skillId] ?? 0
    if (permanentRank > 0 || effectiveRank > 0) {
      learnedSkills.push([skillId, permanentRank, effectiveRank])
    }
  }
  return {
    ...player,
    progression: {
      activeWeldBuildId: skillBook.activeWeldBuildId,
      currentHealth: playerEntityDisplayHealth(state.playerEntities, playerId) ?? 0,
      currentMana: progression.currentMana,
      deathEpoch: progression.deathEpoch,
      deathTick: progression.deathTick,
      experience: progression.experience,
      learnedSkills,
      level: progression.level,
      maximumHealth: progression.maximumHealth,
      maximumMana: progression.maximumMana,
      lifeState: progression.lifeState,
      nextThreshold: progression.nextThreshold,
      pendingOffer: progression.pendingOffer,
      poisonDamagePerTick: progression.poisonDamagePerTick,
      poisonTicksRemaining: progression.poisonTicksRemaining,
      previousThreshold: progression.previousThreshold,
      revision: progression.revision,
    },
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
