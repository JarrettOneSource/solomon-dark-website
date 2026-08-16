import type { BoneyardBounds, BoneyardPoint } from './boneyard.ts'
import {
  BONEYARD_WAVE_ENEMY_TYPES,
  type BoneyardWaveEnemyToken,
  type WaveDef,
  type WaveGroupEntry,
} from './boneyard-wave-schema.ts'
import {
  compileBoneyardWaveSection,
  NATIVE_LULL_RELEASE_TO_NEXT_SPAWN_TICKS,
  NATIVE_OPENING_RELEASE_THRESHOLD,
  NATIVE_PAUSE_NODE_GAP_TICKS,
  NATIVE_SOLOMON_OPENING_BURSTS,
  NATIVE_WAVE_LABEL_TO_FIRST_SPAWN_TICKS,
  nextBoneyardWaveRandom,
  randomBoneyardWaveInteger,
  seedBoneyardWaveRng,
  type BoneyardCompiledSpawnBurst,
  type BoneyardCompiledWaveSection,
  type BoneyardSpawnLocationPolicy,
} from './boneyard-wave-timeline.ts'
import { NATIVE_RETAIL_WAVES } from './native-retail-wave-schedule.ts'
import { nativeRandomFloatFromSemanticWord } from './native-random-domain.ts'

export { BONEYARD_WAVE_ENEMY_TYPES } from './boneyard-wave-schema.ts'

export const BONEYARD_WAVE_DIRECTOR_PHASES = [
  'dormant',
  'opening',
  'opening-threshold',
  'spawning',
  'wave-threshold',
  'wave-lull-delay',
  'wave-lull',
  'interwave',
] as const

export type BoneyardWaveDirectorPhase = typeof BONEYARD_WAVE_DIRECTOR_PHASES[number]

export interface BoneyardEnemySpawnIntent {
  enemyToken: BoneyardWaveEnemyToken
  flags: readonly string[]
  id: number
  locationPolicy: BoneyardSpawnLocationPolicy
  nativeTypeId: number
  position: BoneyardPoint
  spawnTick: number
  waveOrdinal: number
}

export interface BoneyardWaveDirectorState {
  activeBurstIndex: number | null
  activeBursts: readonly BoneyardCompiledSpawnBurst[]
  activeGroupIndex: number | null
  activeGroupMemberIndex: number
  burstStarted: boolean
  burstSpawnRemaining: number
  burstSpreadTicksRemaining: number
  compiledSchedule: readonly BoneyardCompiledWaveSection[]
  interwaveDelayTicks: number
  lullThreshold: number
  lowPopulationTicks: number
  nextSpawnIntentId: number
  nextScheduleIndex: number | null
  pendingSpawnBudget: number
  phase: BoneyardWaveDirectorPhase
  populationThreshold: number
  rngState: number
  schedule: readonly WaveDef[]
  scheduleIndex: number
  spawnCountdown: number
  spawnDelayTicks: number
  waveEventId: number
  waveOrdinal: number
}

export type BoneyardWavePlayers = Readonly<
  Record<string, { position: BoneyardPoint }>
>

export interface BoneyardWaveDirectorTickContext {
  bounds: BoneyardBounds
  liveEnemyCount: number
  players: BoneyardWavePlayers
  tick: number
}

export interface BoneyardWaveDirectorTickResult {
  director: BoneyardWaveDirectorState
  spawnIntents: readonly BoneyardEnemySpawnIntent[]
}

const SPAWN_RADIUS = 100
const LULL_RELEASE_TO_NEXT_LABEL_TICKS = (
  NATIVE_LULL_RELEASE_TO_NEXT_SPAWN_TICKS
  - NATIVE_WAVE_LABEL_TO_FIRST_SPAWN_TICKS
)
const ADVANCE_TO_NEXT_LABEL_TICKS = 50

export function createBoneyardWaveDirector(
  seed: string,
  schedule: readonly WaveDef[] = NATIVE_RETAIL_WAVES,
): BoneyardWaveDirectorState {
  validateSchedule(schedule)
  const compiledSchedule = compileSchedule(schedule, `${seed}:wave-compiler`)
  return {
    activeBurstIndex: null,
    activeBursts: [],
    activeGroupIndex: null,
    activeGroupMemberIndex: 0,
    burstStarted: false,
    burstSpawnRemaining: 0,
    burstSpreadTicksRemaining: 0,
    compiledSchedule,
    interwaveDelayTicks: 0,
    lullThreshold: 0,
    lowPopulationTicks: 0,
    nextSpawnIntentId: 1,
    nextScheduleIndex: null,
    pendingSpawnBudget: 0,
    phase: 'dormant',
    populationThreshold: 0,
    rngState: seedBoneyardWaveRng(`${seed}:wave-runtime`),
    schedule,
    scheduleIndex: 0,
    spawnCountdown: 0,
    spawnDelayTicks: 0,
    waveEventId: 0,
    waveOrdinal: 0,
  }
}

export function startBoneyardWaveDirector(
  source: BoneyardWaveDirectorState,
): BoneyardWaveDirectorState {
  if (source.phase !== 'dormant') return source
  return beginBursts(source, NATIVE_SOLOMON_OPENING_BURSTS, 'opening', {
    lullThreshold: 0,
    lowPopulationTicks: 0,
    populationThreshold: NATIVE_OPENING_RELEASE_THRESHOLD,
    scheduleIndex: 0,
  })
}

export function stepBoneyardWaveDirector(
  source: BoneyardWaveDirectorState,
  context: BoneyardWaveDirectorTickContext,
): BoneyardWaveDirectorTickResult {
  validateLiveEnemyCount(context.liveEnemyCount)
  if (source.phase === 'dormant') return tickResult(source)
  const state = stepArenaLowPopulationTimer(source, context.liveEnemyCount)
  switch (state.phase) {
    case 'dormant': return tickResult(state)
    case 'opening': return stepSpawnerGraph(state, context)
    case 'opening-threshold': return tickResult(
      context.liveEnemyCount < state.populationThreshold
        ? beginScheduleRow(state, 0)
        : state,
    )
    case 'spawning': return stepSpawnerGraph(state, context)
    case 'wave-threshold': return tickResult(stepPopulationThreshold(
      state,
      context.liveEnemyCount,
    ))
    case 'wave-lull-delay': return tickResult(stepLullDelay(state))
    case 'wave-lull': return tickResult(stepLullThreshold(state, context.liveEnemyCount))
    case 'interwave': return tickResult(stepInterwave(state))
  }
}

function stepSpawnerGraph(
  source: BoneyardWaveDirectorState,
  context: BoneyardWaveDirectorTickContext,
): BoneyardWaveDirectorTickResult {
  if (Object.keys(context.players).length === 0) return tickResult(source)
  let state = advanceSpawnerCountdown(source)
  if (!state.burstStarted && state.spawnCountdown > 0) return tickResult(state)
  if (
    state.burstStarted
    && state.spawnCountdown > 0
    && state.burstSpreadTicksRemaining > 0
  ) return tickResult(state)

  const spawnIntents: BoneyardEnemySpawnIntent[] = []
  while (state.burstSpawnRemaining > 0) {
    const spawned = spawnOneEnemy(state, context.players, context.bounds, context.tick)
    state = spawned.director
    spawnIntents.push(spawned.spawnIntent)
    if (state.burstSpawnRemaining <= 0) {
      state = advanceBurst(state)
      if (state.phase !== 'opening' && state.phase !== 'spawning') {
        return { director: state, spawnIntents }
      }
      if (state.spawnCountdown > 0) return { director: state, spawnIntents }
      continue
    }
    if (state.burstSpreadTicksRemaining > 0) {
      return { director: resetSpawnerInterval(state), spawnIntents }
    }
  }
  return { director: finishBursts(state), spawnIntents }
}

function advanceSpawnerCountdown(
  source: BoneyardWaveDirectorState,
): BoneyardWaveDirectorState {
  if (source.spawnCountdown <= 0) return source
  const spawnCountdown = Math.max(0, source.spawnCountdown - 1)
  const burstSpreadTicksRemaining = source.burstStarted
    ? Math.max(0, source.burstSpreadTicksRemaining - 1)
    : source.burstSpreadTicksRemaining
  return {
    ...source,
    burstSpreadTicksRemaining,
    spawnCountdown,
    spawnDelayTicks: Math.ceil(spawnCountdown),
  }
}

function spawnOneEnemy(
  source: BoneyardWaveDirectorState,
  players: BoneyardWavePlayers,
  bounds: BoneyardBounds,
  tick: number,
): { director: BoneyardWaveDirectorState; spawnIntent: BoneyardEnemySpawnIntent } {
  const burst = activeBurst(source)
  const entrySample = randomBoneyardWaveInteger(source.rngState, burst.entries.length)
  const entry = burst.entries[entrySample.value]
  const placed = placeEnemy(
    entrySample.state,
    burst.locationPolicy,
    players,
    bounds,
  )
  const enemyToken = entry.enemy as BoneyardWaveEnemyToken
  const nativeTypeId = BONEYARD_WAVE_ENEMY_TYPES[enemyToken]
  if (nativeTypeId === undefined) {
    throw new Error(`wave director cannot spawn unknown enemy ${entry.enemy}`)
  }
  return {
    director: {
      ...source,
      activeGroupMemberIndex: entrySample.value,
      burstStarted: true,
      burstSpawnRemaining: source.burstSpawnRemaining - 1,
      nextSpawnIntentId: source.nextSpawnIntentId + 1,
      pendingSpawnBudget: source.pendingSpawnBudget - 1,
      rngState: placed.rngState,
      spawnCountdown: 0,
      spawnDelayTicks: 0,
    },
    spawnIntent: {
      enemyToken,
      flags: Object.freeze([...entry.flags]),
      id: source.nextSpawnIntentId,
      locationPolicy: burst.locationPolicy,
      nativeTypeId,
      position: Object.freeze({ ...placed.position }),
      spawnTick: tick,
      waveOrdinal: source.waveOrdinal,
    },
  }
}

function resetSpawnerInterval(
  source: BoneyardWaveDirectorState,
): BoneyardWaveDirectorState {
  const burst = activeBurst(source)
  const baseInterval = burst.spreadTicks / Math.max(burst.count - 1, 1)
  if (burst.steady) {
    return {
      ...source,
      spawnCountdown: baseInterval,
      spawnDelayTicks: Math.ceil(baseInterval),
    }
  }
  const jitterBound = Math.max(1, Math.trunc(baseInterval / 2))
  const jitter = randomBoneyardWaveInteger(source.rngState, jitterBound)
  const spawnCountdown = baseInterval + jitter.value
  return {
    ...source,
    rngState: jitter.state,
    spawnCountdown,
    spawnDelayTicks: Math.ceil(spawnCountdown),
  }
}

function advanceBurst(
  source: BoneyardWaveDirectorState,
): BoneyardWaveDirectorState {
  const current = activeBurst(source)
  const nextIndex = (source.activeBurstIndex ?? 0) + 1
  const next = source.activeBursts[nextIndex]
  if (!next) return finishBursts(source)
  const spawnCountdown = current.afterDelayTicks + next.startDelayTicks
  return {
    ...source,
    activeBurstIndex: nextIndex,
    activeGroupIndex: next.groupIndex,
    activeGroupMemberIndex: 0,
    burstStarted: false,
    burstSpawnRemaining: next.count,
    burstSpreadTicksRemaining: next.spreadTicks,
    spawnCountdown,
    spawnDelayTicks: Math.ceil(spawnCountdown),
  }
}

function finishBursts(
  source: BoneyardWaveDirectorState,
): BoneyardWaveDirectorState {
  if (source.phase !== 'opening' && source.phase !== 'spawning') return source
  return {
    ...source,
    activeBurstIndex: null,
    activeGroupIndex: null,
    burstSpawnRemaining: 0,
    burstStarted: false,
    burstSpreadTicksRemaining: 0,
    phase: source.phase === 'opening' ? 'opening-threshold' : 'wave-threshold',
    spawnCountdown: 0,
    spawnDelayTicks: 0,
  }
}

function stepPopulationThreshold(
  source: BoneyardWaveDirectorState,
  liveEnemyCount: number,
): BoneyardWaveDirectorState {
  if (liveEnemyCount >= source.populationThreshold) return source
  return {
    ...source,
    interwaveDelayTicks: NATIVE_PAUSE_NODE_GAP_TICKS,
    phase: 'wave-lull-delay',
  }
}

function stepLullDelay(
  source: BoneyardWaveDirectorState,
): BoneyardWaveDirectorState {
  if (source.interwaveDelayTicks > 1) {
    return {
      ...source,
      interwaveDelayTicks: source.interwaveDelayTicks - 1,
    }
  }
  return {
    ...source,
    interwaveDelayTicks: 0,
    phase: 'wave-lull',
  }
}

function stepLullThreshold(
  source: BoneyardWaveDirectorState,
  liveEnemyCount: number,
): BoneyardWaveDirectorState {
  if (
    source.lowPopulationTicks <= 1
    && liveEnemyCount >= source.lullThreshold
  ) return source
  return {
    ...source,
    interwaveDelayTicks: LULL_RELEASE_TO_NEXT_LABEL_TICKS,
    nextScheduleIndex: null,
    phase: 'interwave',
  }
}

function stepInterwave(
  source: BoneyardWaveDirectorState,
): BoneyardWaveDirectorState {
  const interwaveDelayTicks = Math.max(0, source.interwaveDelayTicks - 1)
  let state = { ...source, interwaveDelayTicks }
  if (
    state.nextScheduleIndex === null
    && interwaveDelayTicks <= ADVANCE_TO_NEXT_LABEL_TICKS
  ) state = selectNextScheduleRow(state)
  if (interwaveDelayTicks > 0) return state
  return beginScheduleRow(state, state.nextScheduleIndex ?? state.scheduleIndex)
}

function selectNextScheduleRow(
  source: BoneyardWaveDirectorState,
): BoneyardWaveDirectorState {
  const wave = source.schedule[source.scheduleIndex]
  const edge = randomBoneyardWaveInteger(source.rngState, wave.next.length)
  return {
    ...source,
    nextScheduleIndex: source.scheduleIndex + wave.next[edge.value],
    rngState: edge.state,
  }
}

function beginScheduleRow(
  source: BoneyardWaveDirectorState,
  scheduleIndex: number,
): BoneyardWaveDirectorState {
  const section = source.compiledSchedule[scheduleIndex]
  if (!section) throw new Error(`wave schedule has no row ${scheduleIndex}`)
  return beginBursts(source, section.bursts, 'spawning', {
    lullThreshold: section.lullThreshold,
    lowPopulationTicks: 0,
    populationThreshold: section.releaseThreshold,
    scheduleIndex,
    waveEventId: source.waveEventId + 1,
    waveOrdinal: source.waveOrdinal + 1,
  })
}

function beginBursts(
  source: BoneyardWaveDirectorState,
  bursts: readonly BoneyardCompiledSpawnBurst[],
  phase: 'opening' | 'spawning',
  patch: Partial<BoneyardWaveDirectorState>,
): BoneyardWaveDirectorState {
  const first = bursts[0]
  if (!first) throw new Error('compiled wave section has no spawn bursts')
  return {
    ...source,
    ...patch,
    activeBurstIndex: 0,
    activeBursts: bursts,
    activeGroupIndex: first.groupIndex,
    activeGroupMemberIndex: 0,
    burstStarted: false,
    burstSpawnRemaining: first.count,
    burstSpreadTicksRemaining: first.spreadTicks,
    interwaveDelayTicks: 0,
    nextScheduleIndex: null,
    pendingSpawnBudget: bursts.reduce((total, burst) => total + burst.count, 0),
    phase,
    spawnCountdown: first.startDelayTicks,
    spawnDelayTicks: first.startDelayTicks,
  }
}

function activeBurst(source: BoneyardWaveDirectorState): BoneyardCompiledSpawnBurst {
  const burst = source.activeBurstIndex === null
    ? undefined
    : source.activeBursts[source.activeBurstIndex]
  if (!burst) throw new Error('wave director has no active spawn burst')
  return burst
}

function placeEnemy(
  rngState: number,
  policy: BoneyardSpawnLocationPolicy,
  players: BoneyardWavePlayers,
  bounds: BoneyardBounds,
): {
  position: BoneyardPoint
  rngState: number
} {
  const entries = Object.entries(players)
  if (policy === 'near-player') {
    const playerSample = randomBoneyardWaveInteger(rngState, entries.length)
    const [, placementPlayer] = entries[playerSample.value]
    const angleSample = nextBoneyardWaveRandom(playerSample.state)
    const angle = nativeRandomFloatFromSemanticWord(
      angleSample.state,
      360,
    ) * Math.PI / 180
    return {
      position: {
        x: Math.fround(
          placementPlayer.position.x + Math.cos(angle) * SPAWN_RADIUS,
        ),
        y: Math.fround(
          placementPlayer.position.y + Math.sin(angle) * SPAWN_RADIUS,
        ),
      },
      rngState: angleSample.state,
    }
  }
  const xSample = nextBoneyardWaveRandom(rngState)
  const ySample = nextBoneyardWaveRandom(xSample.state)
  return {
    position: {
      x: Math.fround(bounds.x + nativeRandomFloatFromSemanticWord(
        xSample.state,
        bounds.w,
      )),
      y: Math.fround(bounds.y + nativeRandomFloatFromSemanticWord(
        ySample.state,
        bounds.h,
      )),
    },
    rngState: ySample.state,
  }
}

function compileSchedule(
  schedule: readonly WaveDef[],
  seed: string,
): readonly BoneyardCompiledWaveSection[] {
  let rngState = seedBoneyardWaveRng(seed)
  return schedule.map((wave, index) => {
    const result = compileBoneyardWaveSection(wave, index + 1, rngState)
    rngState = result.rngState
    return result.section
  })
}

function validateSchedule(schedule: readonly WaveDef[]): void {
  if (schedule.length === 0) throw new Error('wave schedule must not be empty')
  for (const [index, wave] of schedule.entries()) {
    if (!Number.isInteger(wave.spawn) || wave.spawn <= 0) {
      throw new Error(`wave ${index} has invalid spawn budget`)
    }
    if (!Number.isInteger(wave.maxEnemies) || wave.maxEnemies <= 0) {
      throw new Error(`wave ${index} has invalid MAXENEMIES directive`)
    }
    if (wave.groups.length === 0 || wave.groups.some((group) => group.entries.length === 0)) {
      throw new Error(`wave ${index} has an empty group set`)
    }
    if (wave.next.length === 0 || wave.next.some((offset) => (
      !Number.isInteger(offset) || index + offset < 0 || index + offset >= schedule.length
    ))) throw new Error(`wave ${index} has an invalid signed NEXT edge`)
    for (const range of [wave.spawnDelay, wave.waveDelay]) {
      if (
        !Number.isInteger(range[0])
        || !Number.isInteger(range[1])
        || range[0] < 0
        || range[1] < range[0]
      ) throw new Error(`wave ${index} has an invalid delay range`)
    }
    for (const group of wave.groups) {
      for (const entry of group.entries) validateEnemyEntry(entry, index)
    }
  }
}

function stepArenaLowPopulationTimer(
  source: BoneyardWaveDirectorState,
  liveEnemyCount: number,
): BoneyardWaveDirectorState {
  if (liveEnemyCount >= 11) return source
  let lowPopulationTicks = source.lowPopulationTicks + 1
  if (lowPopulationTicks > 10 && liveEnemyCount === 0) {
    lowPopulationTicks = 999_999_999
  }
  return { ...source, lowPopulationTicks }
}

function tickResult(director: BoneyardWaveDirectorState): BoneyardWaveDirectorTickResult {
  return { director, spawnIntents: [] }
}

function validateLiveEnemyCount(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError('wave live enemy count must be a non-negative safe integer')
  }
}

function validateEnemyEntry(entry: WaveGroupEntry, waveIndex: number): void {
  if (BONEYARD_WAVE_ENEMY_TYPES[entry.enemy as BoneyardWaveEnemyToken] === undefined) {
    throw new Error(`wave ${waveIndex} has unknown enemy ${entry.enemy}`)
  }
}
