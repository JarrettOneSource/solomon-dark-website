import {
  BONEYARD_WAVE_IGNORED_SOURCE_FLAGS,
  type WaveDef,
  type WaveGroupEntry,
} from './boneyard-wave-schema.ts'

export type BoneyardSpawnLocationPolicy = 'anywhere' | 'near-player'

export interface BoneyardCompiledSpawnBurst {
  afterDelayTicks: number
  count: number
  entries: readonly WaveGroupEntry[]
  groupIndex: number
  locationPolicy: BoneyardSpawnLocationPolicy
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
  rngState: number
  section: BoneyardCompiledWaveSection
}

export const NATIVE_OPENING_RELEASE_THRESHOLD = 4
export const NATIVE_WAVE_LABEL_TO_FIRST_SPAWN_TICKS = 10
export const NATIVE_PAUSE_NODE_GAP_TICKS = 25
export const NATIVE_LULL_RELEASE_TO_NEXT_SPAWN_TICKS = 85

const OPENING_FLAGS = ['FLAG_WEAK', 'FLAG_HPDOWN', 'FLAG_XPBONUS'] as const
const IGNORED_SOURCE_FLAGS = new Set<string>(BONEYARD_WAVE_IGNORED_SOURCE_FLAGS)

export const NATIVE_SOLOMON_OPENING_BURSTS: readonly BoneyardCompiledSpawnBurst[] = [
  {
    afterDelayTicks: 0,
    count: 10,
    entries: [{ enemy: 'SKELETON', flags: [...OPENING_FLAGS] }],
    groupIndex: -1,
    locationPolicy: 'near-player',
    spreadTicks: 0,
    startDelayTicks: 0,
    steady: true,
  },
  {
    afterDelayTicks: 0,
    count: 5,
    entries: [{ enemy: 'SKELETON', flags: [...OPENING_FLAGS] }],
    groupIndex: -1,
    locationPolicy: 'near-player',
    spreadTicks: 400,
    startDelayTicks: 500,
    steady: true,
  },
]

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
  sourceRngState: number,
): BoneyardWaveCompileResult {
  if (!Number.isInteger(waveOrdinal) || waveOrdinal < 1) {
    throw new Error('wave ordinal must be a positive integer')
  }

  let rngState = sourceRngState
  const halfBudget = Math.trunc(wave.spawn / 2)
  const budgetRoll = randomInteger(rngState, Math.max(halfBudget, 1))
  rngState = budgetRoll.state
  let remainingBudget = wave.spawn + halfBudget + budgetRoll.value

  // The retail compiler samples these parsed ranges before selecting groups.
  // Their values are retained/dead in the generated graph, but the draws are
  // part of the seeded stream and therefore remain authoritative.
  const waveDelayDraw = randomRange(rngState, wave.waveDelay)
  rngState = waveDelayDraw.state
  const singletonSpawnDraw = randomInteger(rngState, 1)
  rngState = singletonSpawnDraw.state

  const bursts: BoneyardCompiledSpawnBurst[] = []
  while (remainingBudget > 0) {
    const groupDraw = randomInteger(rngState, wave.groups.length)
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
    const bonusDraw = randomInteger(rngState, bonusBound)
    rngState = bonusDraw.state
    let count = groupCost + bonusDraw.value + 1
    if (waveOrdinal >= 4) count += Math.trunc(count / 3)
    if (waveOrdinal >= 9) count += Math.trunc(count / 3)
    if (coffinMode) count = Math.min(count, Math.trunc(waveOrdinal / 5))

    let spreadTicks = 0
    for (let member = 0; member < groupCost; member += 1) {
      const delayDraw = randomRange(rngState, wave.spawnDelay)
      rngState = delayDraw.state
      spreadTicks += coffinMode ? 25 : delayDraw.value * 0.5
    }

    const locationPolicy = coffinMode ? 'near-player' : 'anywhere'
    const prior = bursts[bursts.length - 1]
    if (prior && prior.groupIndex === groupIndex && prior.locationPolicy === locationPolicy) {
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
  const releaseDraw = randomInclusiveRange(rngState, 10, releaseUpper)
  rngState = releaseDraw.state
  const lullUpper = Math.max(4, Math.trunc(waveOrdinal / 2))
  const lullDraw = randomInclusiveRange(rngState, 2, lullUpper)
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

function randomRange(
  state: number,
  range: readonly [number, number],
): { state: number; value: number } {
  return randomInclusiveRange(state, range[0], range[1])
}

function randomInclusiveRange(
  state: number,
  minimum: number,
  maximum: number,
): { state: number; value: number } {
  const sample = randomInteger(state, maximum - minimum + 1)
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
