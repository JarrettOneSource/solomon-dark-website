import type { BoneyardPoint } from './boneyard.ts'
import { createNativeCrow, stepNativeCrow, type NativeCrowState, type NativeCrowTarget } from './native-crow.ts'
import { drawNativeFloat, drawNativeFloatRange, drawNativeInteger, type NativeRngState } from './native-rng.ts'

export const NATIVE_HEARTMONGER_SUMMON_INTERVALS = [0, 350, 250, 150, 75] as const
export const NATIVE_HEARTMONGER_BLIND_CHANCES = [0, 5, 10, 30, 100] as const

export interface NativeHeartmongerState {
  readonly activated: boolean
  readonly crows: readonly NativeCrowState[]
  readonly crowCooldownTicks: number
  readonly headVariant: 0 | 1
  readonly summonTicksRemaining: number
}

export interface NativeHeartmongerContext {
  readonly admitted: boolean
  readonly isVisible: (position: Readonly<BoneyardPoint>) => boolean
  readonly lightIntensity: number
  readonly position: Readonly<BoneyardPoint>
  readonly targets: readonly NativeCrowTarget[]
}

export interface NativeHeartmongerSummon {
  readonly count: number
  readonly enemyToken: 'IMP' | 'SKELETON' | 'SKELETONARCHER'
  readonly flags: readonly string[]
}

export interface NativeHeartmongerSound {
  readonly pitch: number
  readonly position: Readonly<BoneyardPoint>
  readonly sound: 'crow-1' | 'crow-2' | 'wings'
}

export interface NativeHeartmongerStep {
  readonly rng: NativeRngState
  readonly sounds: readonly NativeHeartmongerSound[]
  readonly state: NativeHeartmongerState
  readonly struckTargetIds: readonly string[]
  readonly summons: readonly NativeHeartmongerSummon[]
}

interface HeartmongerWork {
  rng: NativeRngState
  sounds: NativeHeartmongerSound[]
  summons: NativeHeartmongerSummon[]
}

export function createNativeHeartmonger(rng: NativeRngState, crowCount: number, firstCrowId: number): {
  rng: NativeRngState
  state: NativeHeartmongerState
} {
  const phase = drawNativeFloat(rng, 360)
  rng = phase.state
  let orbitPhaseDeg = phase.value
  const crows: NativeCrowState[] = []
  for (let index = 0; index < crowCount; index += 1) {
    const created = createNativeCrow(firstCrowId + index, rng)
    rng = created.rng
    crows.push({ ...created.crow, orbitPhaseDeg })
    orbitPhaseDeg = Math.fround(orbitPhaseDeg + 360 / crowCount)
  }
  return {
    rng,
    state: { activated: false, crowCooldownTicks: 100, crows, headVariant: 0, summonTicksRemaining: 200 },
  }
}

export function stepNativeHeartmonger(
  source: NativeHeartmongerState,
  rng: NativeRngState,
  summonMode: 0 | 1 | 2 | 3 | 4,
  context: NativeHeartmongerContext,
): NativeHeartmongerStep {
  const work: HeartmongerWork = { rng, sounds: [], summons: [] }
  const interval = NATIVE_HEARTMONGER_SUMMON_INTERVALS[summonMode]
  let summonTicksRemaining = source.summonTicksRemaining
  if (source.activated && interval > 0) {
    summonTicksRemaining -= 1
    if (summonTicksRemaining < 0) {
      summonFriends(work)
      summonTicksRemaining = interval
    }
  }
  if (integer(work, 200) === 3) {
    const pitch = range(work, .8999999761581421, 1)
    work.sounds.push({ pitch, position: context.position, sound: integer(work, 2) === 0 ? 'crow-1' : 'crow-2' })
  }
  const headVariant = integer(work, 200) === 5 ? integer(work, 2) as 0 | 1 : source.headVariant
  let crowCooldownTicks = context.admitted ? Math.max(0, source.crowCooldownTicks - 1) : 100
  const crows: NativeCrowState[] = []
  const struckTargetIds: string[] = []
  for (const crow of source.crows) {
    const step = stepNativeCrow(crow, work.rng, context.position, crowCooldownTicks === 0,
      context.targets, context.isVisible)
    work.rng = step.rng
    if (step.crow !== null) crows.push(step.crow)
    if (step.parentCooldownTicks !== null) crowCooldownTicks = step.parentCooldownTicks
    if (step.struckTargetId !== null) {
      struckTargetIds.push(step.struckTargetId)
      work.sounds.push({ pitch: 1, position: step.crow!.position!, sound: 'crow-1' })
    }
    if (step.returnPitch !== null) {
      work.sounds.push({ pitch: step.returnPitch, position: step.crow!.position!, sound: 'wings' })
    }
  }
  return {
    ...work,
    state: {
      activated: source.activated || (context.admitted && context.lightIntensity > .4000000059604645),
      crows,
      crowCooldownTicks,
      headVariant,
      summonTicksRemaining,
    },
    struckTargetIds,
  }
}

export function detachNativeHeartmongerCrows(
  state: NativeHeartmongerState,
  sourceRng: NativeRngState,
  position: Readonly<BoneyardPoint>,
  extraCrowId: number,
): { crows: readonly NativeCrowState[]; rng: NativeRngState } {
  const extra = createNativeCrow(extraCrowId, sourceRng)
  const heading = drawNativeFloat(extra.rng, 360)
  return {
    crows: [...state.crows.map((crow) => ({ ...crow, position: crow.position ?? position })), {
      ...extra.crow, headingDeg: heading.value, height: 60, orbitPhaseDeg: 0, orbitRadius: 0, position, speed: -1,
    }],
    rng: heading.state,
  }
}

function summonFriends(work: HeartmongerWork): void {
  if (integer(work, 5) === 1) {
    work.summons.push({
      count: 1,
      enemyToken: 'SKELETONARCHER',
      flags: integer(work, 5) === 1 ? ['FLAG_HOODED', 'FLAG_LEADING'] : [],
    })
    return
  }
  work.summons.push({ count: 1, enemyToken: 'SKELETON', flags: integer(work, 5) === 1 ? ['FLAG_HELM'] : [] })
  if (integer(work, 10) !== 1) return
  work.summons.push({ count: integer(work, 2) + 1, enemyToken: 'IMP', flags: [] })
  if (integer(work, 10) === 1) {
    work.summons.push({ count: integer(work, 2) + 1, enemyToken: 'IMP', flags: [] })
  }
}

function integer(work: HeartmongerWork, count: number): number {
  const draw = drawNativeInteger(work.rng, count)
  work.rng = draw.state
  return draw.value
}

function range(work: HeartmongerWork, first: number, second: number): number {
  const draw = drawNativeFloatRange(work.rng, first, second)
  work.rng = draw.state
  return draw.value
}
