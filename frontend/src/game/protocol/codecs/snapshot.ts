import {
  GAME_OVER_AUTOMATIC_ACCEPT_TICK,
  GAME_OVER_AUTOMATIC_EXIT_FADE_TICKS,
  GAME_OVER_EXIT_KINDS,
  GAME_OVER_INPUT_ACCEPT_TICK,
  GAME_OVER_INPUT_EXIT_FADE_TICKS,
  GAME_RUN_PHASES,
  type GameOverExitKind,
  type GameRunLifecycleState,
  type GameRunPhase,
} from '../../core-kernels/game-run.ts'
import { MAX_PLAYERS } from '../game-protocol-limits.ts'
import type {
  GameSnapshot,
  GameSnapshotFrame,
  ProtocolHubParticipantState,
  ProtocolModEffect,
  ProtocolPlayerSnapshotFrame,
  ProtocolPlayerState,
} from '../game-state.ts'
import { playerSnapshotFrame, playerState } from './players.ts'
import {
  primarySpellFrameState,
  primarySpellState,
  validatePrimarySpellFrameOwners,
  validatePrimarySpellOwners,
} from './primary.ts'
import { nativeSecondaryState } from './secondary.ts'
import {
  GameProtocolError,
  array,
  finite,
  limitedArray,
  limitedString,
  nonnegativeFinite,
  nonnegativeInteger,
  onlyKeys,
  positiveInteger,
  record,
  validatedPlayerId,
} from './values.ts'
import {
  gameWorldSnapshot,
  gameWorldSnapshotFrame,
  validateHallOfFameArchivePhase,
  validateHallOfFameRunOwners,
} from './world.ts'

function playerLevelUpBarrier(
  value: unknown,
  field: string,
  players: Readonly<Record<string, ProtocolPlayerSnapshotFrame>>,
  run: GameRunLifecycleState,
): NonNullable<GameSnapshot['levelUpBarrier']> {
  const source = record(value, field)
  onlyKeys(source, field, [
    'barrierId',
    'milestoneExperience',
    'milestoneLevel',
    'participantIds',
    'pendingPlayerIds',
    'runId',
    'sourcePlayerId',
  ])
  const participantIds = validatedBarrierPlayerIds(
    source.participantIds,
    `${field}.participantIds`,
    players,
  )
  if (participantIds.length === 0) {
    throw new GameProtocolError(`${field}.participantIds must not be empty`)
  }
  const pendingPlayerIds = validatedBarrierPlayerIds(
    source.pendingPlayerIds,
    `${field}.pendingPlayerIds`,
    players,
  )
  if (pendingPlayerIds.length === 0) {
    throw new GameProtocolError(`${field}.pendingPlayerIds must not be empty`)
  }
  if (pendingPlayerIds.some((playerId) => !participantIds.includes(playerId))) {
    throw new GameProtocolError(`${field}.pendingPlayerIds must belong to the cohort`)
  }
  for (const playerId of pendingPlayerIds) {
    if (players[playerId]?.progression.pendingOffer === null) {
      throw new GameProtocolError(`${field} pending player has no skill offer`)
    }
  }
  const sourcePlayerId = validatedPlayerId(source.sourcePlayerId, `${field}.sourcePlayerId`)
  if (!participantIds.includes(sourcePlayerId)) {
    throw new GameProtocolError(`${field}.sourcePlayerId must belong to the cohort`)
  }
  const runId = source.runId === null
    ? null
    : limitedString(source.runId, `${field}.runId`, 256)
  const expectedRunId = run.phase === 'active' ? run.runId : null
  if (runId !== expectedRunId) {
    throw new GameProtocolError(`${field}.runId does not match the active run`)
  }
  const milestoneExperience = nonnegativeFinite(
    source.milestoneExperience,
    `${field}.milestoneExperience`,
  )
  if (milestoneExperience > 10_000_000) {
    throw new GameProtocolError(`${field}.milestoneExperience is out of range`)
  }
  const milestoneLevel = positiveInteger(source.milestoneLevel, `${field}.milestoneLevel`)
  if (milestoneLevel > 75) {
    throw new GameProtocolError(`${field}.milestoneLevel is out of range`)
  }
  return {
    barrierId: positiveInteger(source.barrierId, `${field}.barrierId`),
    milestoneExperience,
    milestoneLevel,
    participantIds,
    pendingPlayerIds,
    runId,
    sourcePlayerId,
  }
}

function validatedBarrierPlayerIds(
  value: unknown,
  field: string,
  players: Readonly<Record<string, ProtocolPlayerSnapshotFrame>>,
): readonly string[] {
  const playerIds = limitedArray(value, field, MAX_PLAYERS).map((entry, index) => (
    validatedPlayerId(entry, `${field}[${index}]`)
  ))
  if (playerIds.some((playerId, index) => (
    !players[playerId] || (index > 0 && playerId <= playerIds[index - 1]!)
  ))) {
    throw new GameProtocolError(`${field} must be sorted, unique, and present in players`)
  }
  return playerIds
}

function validatedMaterializingPlayerIds(
  value: unknown,
  field: string,
  players: Readonly<Record<string, unknown>>,
): readonly string[] {
  const playerIds = limitedArray(value, field, MAX_PLAYERS).map((entry, index) => (
    validatedPlayerId(entry, `${field}[${index}]`)
  ))
  if (playerIds.some((playerId, index) => (
    !players[playerId] || (index > 0 && playerId <= playerIds[index - 1]!)
  ))) {
    throw new GameProtocolError(`${field} must be sorted, unique, and present in players`)
  }
  return playerIds
}

export function gameSnapshot(value: unknown): GameSnapshot {
  const source = record(value, 'snapshot')
  onlyKeys(source, 'snapshot', [
    'hostPlayerId', 'levelUpBarrier', 'materializingPlayerIds', 'modEffects', 'players',
    'primarySpells', 'run', 'secondaryAbilities', 'tick', 'world',
  ])
  const rawPlayers = record(source.players, 'snapshot.players')
  if (Object.keys(rawPlayers).length > MAX_PLAYERS) {
    throw new GameProtocolError(`snapshot.players may contain at most ${MAX_PLAYERS} entries`)
  }
  const players: Record<string, ProtocolPlayerState> = {}
  for (const [rawPlayerId, state] of Object.entries(rawPlayers)) {
    const playerId = validatedPlayerId(rawPlayerId, 'snapshot player id')
    players[playerId] = playerState(
      state,
      `snapshot.players.${playerId}`,
    )
  }
  const hostPlayerId = source.hostPlayerId === null
    ? null
    : validatedPlayerId(source.hostPlayerId, 'snapshot.hostPlayerId')
  const tick = nonnegativeInteger(source.tick, 'snapshot.tick')
  const modEffects = protocolModEffects(source.modEffects, 'snapshot.modEffects', players, tick)
  const world = gameWorldSnapshot(source.world, 'snapshot.world', tick)
  const run = gameRunLifecycle(source.run, 'snapshot.run')
  const levelUpBarrier = source.levelUpBarrier === null
    ? null
    : playerLevelUpBarrier(source.levelUpBarrier, 'snapshot.levelUpBarrier', players, run)
  const materializingPlayerIds = validatedMaterializingPlayerIds(
    source.materializingPlayerIds,
    'snapshot.materializingPlayerIds',
    players,
  )
  validateGameRunWorld(run, world, 'snapshot')
  validateHallOfFameArchivePhase(run, world, 'snapshot')
  const primarySpells = primarySpellState(source.primarySpells, 'snapshot.primarySpells')
  validatePrimarySpellOwners(primarySpells, players, 'snapshot.primarySpells')
  const secondaryAbilities = nativeSecondaryState(
    source.secondaryAbilities,
    'snapshot.secondaryAbilities',
    players,
  )
  if (world.kind === 'hub') {
    const participantIds = Object.keys(world.participants).sort()
    const playerIds = Object.keys(players).sort()
    if (
      participantIds.length !== playerIds.length
      || participantIds.some((id, index) => id !== playerIds[index])
    ) {
      throw new GameProtocolError(
        'snapshot.world.participants must match snapshot.players exactly',
      )
    }
  } else {
    validateHallOfFameRunOwners(world.hallOfFameRuns, players, 'snapshot')
  }
  return {
    hostPlayerId,
    levelUpBarrier,
    materializingPlayerIds,
    modEffects,
    players,
    primarySpells,
    secondaryAbilities,
    run,
    tick,
    world,
  }
}

export function gameSnapshotFrame(value: unknown): GameSnapshotFrame {
  const source = record(value, 'frame')
  onlyKeys(source, 'frame', [
    'hostPlayerId', 'levelUpBarrier', 'materializingPlayerIds', 'modEffects', 'players',
    'primarySpells', 'run', 'secondaryAbilities', 'tick', 'world',
  ])
  const rawPlayers = record(source.players, 'frame.players')
  if (Object.keys(rawPlayers).length > MAX_PLAYERS) {
    throw new GameProtocolError(`frame.players may contain at most ${MAX_PLAYERS} entries`)
  }
  const players: Record<string, ProtocolPlayerSnapshotFrame> = {}
  for (const [rawPlayerId, state] of Object.entries(rawPlayers)) {
    const playerId = validatedPlayerId(rawPlayerId, 'frame player id')
    players[playerId] = playerSnapshotFrame(state, `frame.players.${playerId}`)
  }
  const hostPlayerId = source.hostPlayerId === null
    ? null
    : validatedPlayerId(source.hostPlayerId, 'frame.hostPlayerId')
  const tick = nonnegativeInteger(source.tick, 'frame.tick')
  const modEffects = protocolModEffects(source.modEffects, 'frame.modEffects', players, tick)
  const world = gameWorldSnapshotFrame(source.world, 'frame.world', tick)
  const run = gameRunLifecycle(source.run, 'frame.run')
  const levelUpBarrier = source.levelUpBarrier === null
    ? null
    : playerLevelUpBarrier(source.levelUpBarrier, 'frame.levelUpBarrier', players, run)
  const materializingPlayerIds = validatedMaterializingPlayerIds(
    source.materializingPlayerIds,
    'frame.materializingPlayerIds',
    players,
  )
  validateGameRunWorld(run, world, 'frame')
  validateHallOfFameArchivePhase(run, world, 'frame')
  const primarySpells = primarySpellFrameState(
    source.primarySpells,
    'frame.primarySpells',
    tick,
  )
  validatePrimarySpellFrameOwners(primarySpells, players, 'frame.primarySpells')
  const secondaryAbilities = nativeSecondaryState(
    source.secondaryAbilities,
    'frame.secondaryAbilities',
    players,
  )
  if (world.kind === 'hub') {
    validateParticipantOwnership(world.participants, players, 'frame')
  } else {
    validateHallOfFameRunOwners(world.hallOfFameRuns, players, 'frame')
  }
  return {
    hostPlayerId,
    levelUpBarrier,
    materializingPlayerIds,
    modEffects,
    players,
    primarySpells,
    secondaryAbilities,
    run,
    tick,
    world,
  }
}

function protocolModEffects(
  value: unknown,
  field: string,
  players: Readonly<Record<string, ProtocolPlayerSnapshotFrame>>,
  tick: number,
): readonly ProtocolModEffect[] {
  return limitedArray(value, field, 256).map((value, index) => {
    const effectField = `${field}[${index}]`
    const source = record(value, effectField)
    onlyKeys(source, effectField, [
      'color', 'contentId', 'expiresTick', 'playerId', 'startedTick', 'useId',
    ])
    const contentId = limitedString(source.contentId, `${effectField}.contentId`, 19)
    if (!/^[1-9][0-9]{0,18}$/.test(contentId)) {
      throw new GameProtocolError(`${effectField}.contentId is invalid`)
    }
    const playerId = validatedPlayerId(source.playerId, `${effectField}.playerId`)
    if (!players[playerId]) throw new GameProtocolError(`${effectField}.playerId is not present`)
    const startedTick = nonnegativeInteger(source.startedTick, `${effectField}.startedTick`)
    const expiresTick = positiveInteger(source.expiresTick, `${effectField}.expiresTick`)
    if (startedTick > tick || expiresTick <= tick || expiresTick <= startedTick) {
      throw new GameProtocolError(`${effectField} has an invalid active interval`)
    }
    const rawColor = array(source.color, `${effectField}.color`)
    if (rawColor.length !== 4) throw new GameProtocolError(`${effectField}.color must contain RGBA`)
    const color = rawColor.map((component, colorIndex) => {
      const value = finite(component, `${effectField}.color[${colorIndex}]`)
      if (value < 0 || value > 1) {
        throw new GameProtocolError(`${effectField}.color[${colorIndex}] must be within 0..1`)
      }
      return value
    }) as [number, number, number, number]
    return {
      color,
      contentId,
      expiresTick,
      playerId,
      startedTick,
      useId: positiveInteger(source.useId, `${effectField}.useId`),
    }
  })
}

function gameRunLifecycle(value: unknown, field: string): GameRunLifecycleState {
  const source = record(value, field)
  onlyKeys(source, field, [
    'eligiblePlayerIds',
    'gameOverEventId',
    'gameOverExitKind',
    'gameOverExitTicks',
    'gameOverTicks',
    'lastCompletedRunId',
    'loadoutReadyPlayerIds',
    'nextGameOverEventId',
    'phase',
    'runId',
  ])
  const phase = limitedString(source.phase, `${field}.phase`, 32)
  if (!(GAME_RUN_PHASES as readonly string[]).includes(phase)) {
    throw new GameProtocolError(`${field}.phase is not supported`)
  }
  const eligiblePlayerIds = limitedArray(
    source.eligiblePlayerIds,
    `${field}.eligiblePlayerIds`,
    MAX_PLAYERS,
  ).map((playerId, index) => validatedPlayerId(
    playerId,
    `${field}.eligiblePlayerIds[${index}]`,
  ))
  if (eligiblePlayerIds.some((playerId, index) => (
    index > 0 && playerId <= eligiblePlayerIds[index - 1]!
  ))) throw new GameProtocolError(`${field}.eligiblePlayerIds must be unique and sorted`)
  const loadoutReadyPlayerIds = limitedArray(
    source.loadoutReadyPlayerIds,
    `${field}.loadoutReadyPlayerIds`,
    MAX_PLAYERS,
  ).map((playerId, index) => validatedPlayerId(
    playerId,
    `${field}.loadoutReadyPlayerIds[${index}]`,
  ))
  if (loadoutReadyPlayerIds.some((playerId, index) => (
    index > 0 && playerId <= loadoutReadyPlayerIds[index - 1]!
  ))) throw new GameProtocolError(`${field}.loadoutReadyPlayerIds must be unique and sorted`)
  if (loadoutReadyPlayerIds.some((playerId) => !eligiblePlayerIds.includes(playerId))) {
    throw new GameProtocolError(`${field}.loadoutReadyPlayerIds must be eligible`)
  }
  const runId = source.runId === null
    ? null
    : limitedString(source.runId, `${field}.runId`, 128)
  const lastCompletedRunId = source.lastCompletedRunId === null
    ? null
    : limitedString(source.lastCompletedRunId, `${field}.lastCompletedRunId`, 128)
  const gameOverEventId = nonnegativeInteger(
    source.gameOverEventId,
    `${field}.gameOverEventId`,
  )
  const nextGameOverEventId = positiveInteger(
    source.nextGameOverEventId,
    `${field}.nextGameOverEventId`,
  )
  if (gameOverEventId >= nextGameOverEventId) {
    throw new GameProtocolError(`${field}.gameOverEventId is not allocated`)
  }
  if ((phase === 'active' || phase === 'game-over') !== (runId !== null)) {
    throw new GameProtocolError(`${field}.runId does not match phase`)
  }
  if ((phase === 'hub' || phase === 'active') && gameOverEventId !== 0) {
    throw new GameProtocolError(`${field}.gameOverEventId requires a completed run`)
  }
  const gameOverTicks = nonnegativeInteger(source.gameOverTicks, `${field}.gameOverTicks`)
  const gameOverExitKind = source.gameOverExitKind === null
    ? null
    : limitedString(source.gameOverExitKind, `${field}.gameOverExitKind`, 32)
  if (
    gameOverExitKind !== null
    && !(GAME_OVER_EXIT_KINDS as readonly string[]).includes(gameOverExitKind)
  ) throw new GameProtocolError(`${field}.gameOverExitKind is not supported`)
  const gameOverExitTicks = source.gameOverExitTicks === null
    ? null
    : nonnegativeInteger(source.gameOverExitTicks, `${field}.gameOverExitTicks`)
  if (phase !== 'game-over' && (gameOverExitTicks !== null || gameOverExitKind !== null)) {
    throw new GameProtocolError(`${field}.Game Over exit requires Game Over`)
  }
  if ((gameOverExitTicks === null) !== (gameOverExitKind === null)) {
    throw new GameProtocolError(`${field}.gameOverExitKind does not match exit ticks`)
  }
  const maximumExitTicks = gameOverExitKind === 'input'
    ? GAME_OVER_INPUT_EXIT_FADE_TICKS
    : GAME_OVER_AUTOMATIC_EXIT_FADE_TICKS
  if (gameOverExitTicks !== null && gameOverExitTicks > maximumExitTicks) {
    throw new GameProtocolError(`${field}.gameOverExitTicks exceeds its native fade`)
  }
  if (
    phase === 'game-over'
    && gameOverExitTicks === null
    && gameOverTicks >= GAME_OVER_AUTOMATIC_ACCEPT_TICK
  ) throw new GameProtocolError(`${field}.gameOverExitTicks misses the native automatic fade`)
  if (gameOverExitTicks !== null && gameOverExitTicks < 1) {
    throw new GameProtocolError(`${field}.gameOverExitTicks must begin at one`)
  }
  if (
    gameOverExitKind === 'automatic'
    && gameOverExitTicks !== null
    && gameOverTicks !== GAME_OVER_AUTOMATIC_ACCEPT_TICK + gameOverExitTicks - 1
  ) throw new GameProtocolError(`${field}.automatic Game Over exit is out of step`)
  if (
    gameOverExitKind === 'input'
    && gameOverExitTicks !== null
    && gameOverTicks < GAME_OVER_INPUT_ACCEPT_TICK + gameOverExitTicks - 1
  ) throw new GameProtocolError(`${field}.input Game Over exit precedes its gate`)
  if (phase !== 'loadout' && loadoutReadyPlayerIds.length > 0) {
    throw new GameProtocolError(`${field}.loadoutReadyPlayerIds require loadout`)
  }
  if (phase === 'loadout' && eligiblePlayerIds.length === 0) {
    throw new GameProtocolError(`${field}.loadout requires eligible players`)
  }
  return {
    eligiblePlayerIds,
    gameOverEventId,
    gameOverExitKind: gameOverExitKind as GameOverExitKind | null,
    gameOverExitTicks,
    gameOverTicks,
    lastCompletedRunId,
    loadoutReadyPlayerIds,
    nextGameOverEventId,
    phase: phase as GameRunPhase,
    runId,
  }
}

function validateGameRunWorld(
  run: GameRunLifecycleState,
  world: GameSnapshot['world'] | GameSnapshotFrame['world'],
  field: string,
): void {
  if (run.phase === 'active' || run.phase === 'game-over') {
    if (world.kind !== 'boneyard' || world.runId !== run.runId) {
      throw new GameProtocolError(`${field}.run does not match its Boneyard world`)
    }
  } else if (world.kind !== 'hub') {
    throw new GameProtocolError(`${field}.run requires a Hub world outside a run`)
  }
}

function validateParticipantOwnership(
  participants: Readonly<Record<string, ProtocolHubParticipantState>>,
  players: Readonly<Record<string, ProtocolPlayerSnapshotFrame>>,
  field: string,
): void {
  const participantIds = Object.keys(participants).sort()
  const playerIds = Object.keys(players).sort()
  if (
    participantIds.length !== playerIds.length
    || participantIds.some((id, index) => id !== playerIds[index])
  ) {
    throw new GameProtocolError(
      `${field}.world.participants must match ${field}.players exactly`,
    )
  }
}
