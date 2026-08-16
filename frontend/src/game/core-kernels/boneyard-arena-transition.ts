import type { BoneyardBounds, BoneyardPoint } from './boneyard.ts'

export const BONEYARD_ARENA_ENTRANCE_EXTENSION = 400
export const BONEYARD_ARENA_NORTH_TARGET_INSET = 375
export const BONEYARD_ARENA_SEAL_TICKS = 400
export const BONEYARD_ARENA_LOCK_INITIAL_BLEND = Math.fround(0.01)
export const BONEYARD_ARENA_LOCK_BLEND_GROWTH = 1.01

export const BONEYARD_ARENA_TRANSITION_PHASES = [
  'open',
  'locking',
  'sealed',
] as const

export type BoneyardArenaTransitionPhase = (
  typeof BONEYARD_ARENA_TRANSITION_PHASES[number]
)

export interface BoneyardArenaTransitionState {
  blendFactor: number
  cameraBounds: BoneyardBounds
  combatBounds: BoneyardBounds
  entrySide: 'north' | 'south'
  fullBounds: BoneyardBounds
  phase: BoneyardArenaTransitionPhase
  sealTicksRemaining: number
}

export function createBoneyardArenaTransition(
  bounds: Readonly<BoneyardBounds>,
  spawn: Readonly<BoneyardPoint>,
): BoneyardArenaTransitionState {
  if (bounds.h <= BONEYARD_ARENA_ENTRANCE_EXTENSION) {
    throw new RangeError('generated Boneyard is too short for its entrance extension')
  }
  const entrySide = spawn.y < bounds.y + bounds.h / 2 ? 'north' : 'south'
  const fullBounds = copyBounds(bounds)
  const combatBounds = {
    x: Math.fround(bounds.x),
    y: Math.fround(bounds.y + (
      entrySide === 'north' ? BONEYARD_ARENA_NORTH_TARGET_INSET : 0
    )),
    w: Math.fround(bounds.w),
    h: Math.fround(bounds.h - BONEYARD_ARENA_ENTRANCE_EXTENSION),
  }
  return {
    blendFactor: 0,
    cameraBounds: copyBounds(fullBounds),
    combatBounds,
    entrySide,
    fullBounds,
    phase: 'open',
    sealTicksRemaining: 0,
  }
}

export function startBoneyardArenaTransition(
  source: BoneyardArenaTransitionState,
): BoneyardArenaTransitionState {
  if (source.phase !== 'open') return source
  return {
    ...source,
    blendFactor: BONEYARD_ARENA_LOCK_INITIAL_BLEND,
    phase: 'locking',
    sealTicksRemaining: BONEYARD_ARENA_SEAL_TICKS,
  }
}

export function stepBoneyardArenaTransition(
  source: BoneyardArenaTransitionState,
): BoneyardArenaTransitionState {
  if (source.phase === 'open') return source
  const cameraBounds = interpolateBounds(
    source.cameraBounds,
    source.combatBounds,
    source.blendFactor,
  )
  const blendFactor = Math.fround(Math.min(
    1,
    source.blendFactor * BONEYARD_ARENA_LOCK_BLEND_GROWTH,
  ))
  const sealTicksRemaining = Math.max(0, source.sealTicksRemaining - 1)
  return {
    ...source,
    blendFactor,
    cameraBounds,
    phase: sealTicksRemaining === 0 ? 'sealed' : source.phase,
    sealTicksRemaining,
  }
}

export function boneyardActiveBounds(
  transition: BoneyardArenaTransitionState,
): BoneyardBounds {
  return transition.phase === 'open'
    ? transition.fullBounds
    : transition.combatBounds
}

function interpolateBounds(
  source: Readonly<BoneyardBounds>,
  target: Readonly<BoneyardBounds>,
  blend: number,
): BoneyardBounds {
  return {
    x: interpolateFloat(source.x, target.x, blend),
    y: interpolateFloat(source.y, target.y, blend),
    w: interpolateFloat(source.w, target.w, blend),
    h: interpolateFloat(source.h, target.h, blend),
  }
}

function interpolateFloat(source: number, target: number, blend: number): number {
  return Math.fround(source + (target - source) * blend)
}

function copyBounds(bounds: Readonly<BoneyardBounds>): BoneyardBounds {
  return {
    h: Math.fround(bounds.h),
    w: Math.fround(bounds.w),
    x: Math.fround(bounds.x),
    y: Math.fround(bounds.y),
  }
}
