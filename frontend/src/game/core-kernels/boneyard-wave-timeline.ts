import {
  BONEYARD_WAVE_IGNORED_SOURCE_FLAGS,
  type WaveDef,
  type WaveGroupEntry,
} from './boneyard-wave-schema.ts'
import {
  drawNativeInteger,
  type NativeRngState,
} from './native-rng.ts'

export type BoneyardSpawnLocationPolicy = 'anywhere' | 'near-player'
export type BoneyardSpawnPositionPolicy = 'dark' | 'direct' | 'edge' | 'light' | 'offscreen'

export interface BoneyardCompiledSpawnBurst {
  afterDelayTicks: number
  count: number
  entries: readonly WaveGroupEntry[]
  groupIndex: number
  locationPolicy: BoneyardSpawnLocationPolicy
  positionPolicy: BoneyardSpawnPositionPolicy
  spreadTicks: number
  startDelayTicks: number
  steady: boolean
}

export interface BoneyardCompiledWaveSection {
  bursts: readonly BoneyardCompiledSpawnBurst[]
  lullThreshold: number
  releaseThreshold: number
}

export interface BoneyardWaveCompileResult {
  rngState: NativeRngState
  section: BoneyardCompiledWaveSection
}

export interface BoneyardOpeningCompileResult {
  bursts: readonly BoneyardCompiledSpawnBurst[]
  releaseThreshold: number
  rngState: NativeRngState
}

export const NATIVE_OPENING_IMMEDIATE_COUNT = Object.freeze({ minimum: 8, randomCount: 5 })
export const NATIVE_OPENING_SPREAD_COUNT = Object.freeze({ minimum: 3, randomCount: 3 })
export const NATIVE_OPENING_RELEASE_THRESHOLD = Object.freeze({ minimum: 1, randomCount: 4 })
export const NATIVE_WAVE_LABEL_TO_FIRST_SPAWN_TICKS = 10
export const NATIVE_PAUSE_NODE_GAP_TICKS = 25
export const NATIVE_LULL_RELEASE_TO_NEXT_SPAWN_TICKS = 85

const OPENING_FLAGS = ['FLAG_WEAK', 'FLAG_HPDOWN', 'FLAG_XPBONUS'] as const
const IGNORED_SOURCE_FLAGS = new Set<string>(BONEYARD_WAVE_IGNORED_SOURCE_FLAGS)

export function compileBoneyardOpening(
  sourceRngState: NativeRngState,
): BoneyardOpeningCompileResult {
  const immediate = drawNativeInteger(
    sourceRngState,
    NATIVE_OPENING_IMMEDIATE_COUNT.randomCount,
  )
  const spread = drawNativeInteger(
    immediate.state,
    NATIVE_OPENING_SPREAD_COUNT.randomCount,
  )
  const release = drawNativeInteger(
    spread.state,
    NATIVE_OPENING_RELEASE_THRESHOLD.randomCount,
  )
  return {
    bursts: Object.freeze([
      Object.freeze({
        afterDelayTicks: 0,
        count: NATIVE_OPENING_IMMEDIATE_COUNT.minimum + immediate.value,
        entries: Object.freeze([{ enemy: 'SKELETON', flags: [...OPENING_FLAGS] }]),
        groupIndex: -1,
        locationPolicy: 'near-player',
        positionPolicy: 'dark',
        spreadTicks: 0,
        startDelayTicks: 0,
        steady: true,
      }),
      Object.freeze({
        afterDelayTicks: 0,
        count: NATIVE_OPENING_SPREAD_COUNT.minimum + spread.value,
        entries: Object.freeze([{ enemy: 'SKELETON', flags: [...OPENING_FLAGS] }]),
        groupIndex: -1,
        locationPolicy: 'near-player',
        positionPolicy: 'dark',
        spreadTicks: 400,
        startDelayTicks: 500,
        steady: true,
      }),
    ]),
    releaseThreshold: NATIVE_OPENING_RELEASE_THRESHOLD.minimum + release.value,
    rngState: release.state,
  }
}

/**
 * Compile one retail wave.txt row into the ordinary TimeLine spawn bursts.
 *
 * Native `GenerateTimeline` treats SPAWN as a group-cost budget. It expands
 * that budget, samples complete GROUPs, scales each emitted burst by the
 * one-based wave number, merges consecutive samples of the same group, and
 * derives the spread from one SPAWNDELAY draw per consumed group member.
 */
export function compileBoneyardWaveSection(
  wave: WaveDef,
  waveOrdinal: number,
  sourceRngState: NativeRngState,
): BoneyardWaveCompileResult {
  if (!Number.isInteger(waveOrdinal) || waveOrdinal < 1) {
    throw new Error('wave ordinal must be a positive integer')
  }

  let rngState = sourceRngState
  const halfBudget = Math.trunc(wave.spawn / 2)
  const budgetRoll = drawNativeInteger(rngState, Math.max(halfBudget, 1))
  rngState = budgetRoll.state
  let remainingBudget = wave.spawn + halfBudget + budgetRoll.value

  // The retail compiler samples these parsed ranges before selecting groups.
  // Their values are retained/dead in the generated graph, but the draws are
  // part of the seeded stream and therefore remain authoritative.
  const waveDelayDraw = drawNativeRange(rngState, wave.waveDelay)
  rngState = waveDelayDraw.state
  const singletonSpawnDraw = drawNativeInteger(rngState, 1)
  rngState = singletonSpawnDraw.state

  const bursts: BoneyardCompiledSpawnBurst[] = []
  while (remainingBudget > 0) {
    const groupDraw = drawNativeInteger(rngState, wave.groups.length)
    rngState = groupDraw.state
    const groupIndex = groupDraw.value
    const group = wave.groups[groupIndex]
    const first = group.entries[0]

    if (waveOrdinal < 28 && first.enemy === 'ZOMBIE') remainingBudget -= 2
    const coffinMode = first.enemy === 'COFFIN'
    if (coffinMode) {
      remainingBudget = wave.spawn
    }
    if (first.enemy === 'DEMON') remainingBudget -= 2
    if (first.enemy === 'SKELETON' && group.entries.some((entry) => (
      entry.flags.includes('FLAG_PIKE')
    ))) remainingBudget = wave.spawn
    if (waveOrdinal < 37 && first.enemy === 'IMP') {
      const splits = group.entries.some((entry) => (
        entry.flags.includes('FLAG_SPLIT') || entry.flags.includes('FLAG_SPLITMANY')
      ))
      if (splits) remainingBudget = wave.spawn
      else remainingBudget -= 2
    }

    const groupCost = Math.min(remainingBudget, group.entries.length)
    if (groupCost <= 0) break

    const bonusBound = clampInteger(Math.trunc(waveOrdinal / 3), 1, 4)
    const bonusDraw = drawNativeInteger(rngState, bonusBound)
    rngState = bonusDraw.state
    let count = groupCost + bonusDraw.value + 1
    if (waveOrdinal >= 4) count += Math.trunc(count / 3)
    if (waveOrdinal >= 9) count += Math.trunc(count / 3)
    if (coffinMode) count = Math.min(count, Math.trunc(waveOrdinal / 5))

    let spreadTicks = 0
    for (let member = 0; member < groupCost; member += 1) {
      const delayDraw = drawNativeRange(rngState, wave.spawnDelay)
      rngState = delayDraw.state
      spreadTicks += coffinMode ? 25 : delayDraw.value * 0.5
    }

    const locationPolicy = coffinMode ? 'near-player' : 'anywhere'
    const positionPolicy = coffinMode ? 'light' : 'dark'
    const prior = bursts[bursts.length - 1]
    if (
      prior
      && prior.groupIndex === groupIndex
      && prior.locationPolicy === locationPolicy
      && prior.positionPolicy === positionPolicy
    ) {
      bursts[bursts.length - 1] = {
        ...prior,
        count: prior.count + count,
        spreadTicks: prior.spreadTicks + spreadTicks,
      }
    } else {
      bursts.push({
        afterDelayTicks: coffinMode ? 100 : 0,
        count,
        entries: group.entries.map((entry) => ({
          enemy: entry.enemy,
          flags: entry.flags.filter((flag) => !IGNORED_SOURCE_FLAGS.has(flag)),
        })),
        groupIndex,
        locationPolicy,
        positionPolicy,
        spreadTicks,
        startDelayTicks: bursts.length === 0
          ? NATIVE_WAVE_LABEL_TO_FIRST_SPAWN_TICKS
          : 0,
        steady: true,
      })
    }
    remainingBudget -= groupCost
  }

  const releaseUpper = Math.max(10, Math.trunc(waveOrdinal / 2))
  const releaseDraw = drawNativeInclusiveRange(rngState, 10, releaseUpper)
  rngState = releaseDraw.state
  const lullUpper = Math.max(4, Math.trunc(waveOrdinal / 2))
  const lullDraw = drawNativeInclusiveRange(rngState, 2, lullUpper)
  rngState = lullDraw.state

  return {
    rngState,
    section: {
      bursts,
      lullThreshold: lullDraw.value + 1,
      releaseThreshold: releaseDraw.value,
    },
  }
}

export function seedBoneyardWaveRng(seed: string): number {
  let state = 0x811c9dc5
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index)
    state = Math.imul(state, 0x01000193)
  }
  return state >>> 0 || 0x6d2b79f5
}

export function nextBoneyardWaveRandom(
  state: number,
): { state: number; value: number } {
  let value = state >>> 0
  value ^= value << 13
  value ^= value >>> 17
  value ^= value << 5
  value >>>= 0
  const nextState = value || 0x6d2b79f5
  return { state: nextState, value: nextState / 0x100000000 }
}

export function randomBoneyardWaveInteger(
  state: number,
  count: number,
): { state: number; value: number } {
  return randomInteger(state, count)
}

function drawNativeRange(
  state: NativeRngState,
  range: readonly [number, number],
): { state: NativeRngState; value: number } {
  return drawNativeInclusiveRange(state, range[0], range[1])
}

function drawNativeInclusiveRange(
  state: NativeRngState,
  minimum: number,
  maximum: number,
): { state: NativeRngState; value: number } {
  const sample = drawNativeInteger(state, maximum - minimum + 1)
  return { state: sample.state, value: minimum + sample.value }
}

function randomInteger(
  state: number,
  count: number,
): { state: number; value: number } {
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error('random range must be a positive integer')
  }
  const sample = nextBoneyardWaveRandom(state)
  return {
    state: sample.state,
    value: Math.min(count - 1, Math.floor(sample.value * count)),
  }
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
