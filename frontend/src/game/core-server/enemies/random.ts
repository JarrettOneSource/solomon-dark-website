import { nextBoneyardWaveRandom, randomBoneyardWaveInteger } from '../../core-kernels/boneyard-wave-timeline.ts'
import type { BoneyardPoint } from '../../core-kernels/boneyard.ts'
import { drawNativeFloat, drawNativeInteger, drawNativeSign } from '../../core-kernels/native-rng.ts'
import type { WorkingStep } from './model.ts'

export function radialVector(angleDeg: number, magnitude: number): { x: number; y: number } {
  const radians = angleDeg * Math.PI / 180
  return { x: Math.sin(radians) * magnitude, y: -Math.cos(radians) * magnitude }
}

export function randomRadialDisplacement(
  work: WorkingStep,
  maximumRadius: number,
): Readonly<BoneyardPoint> {
  const radius = drawUnit(work) * maximumRadius
  return radialVector(drawUnit(work) * 360, radius)
}

export function drawUnit(work: Pick<WorkingStep, 'rngState'>): number {
  const draw = nextBoneyardWaveRandom(work.rngState)
  work.rngState = draw.state
  return draw.value
}

export function randomIntegerFromUnit(random: () => number, count: number): number {
  if (!Number.isSafeInteger(count) || count <= 0) {
    throw new RangeError('random integer count must be a positive safe integer')
  }
  return Math.min(count - 1, Math.floor(random() * count))
}

export function drawLocomotionPhase(work: WorkingStep): number {
  const draw = drawNativeFloat(work.locomotionRngState, 4)
  work.locomotionRngState = draw.state
  return draw.value
}

export function drawLocomotionStridePhase(work: WorkingStep): number {
  const draw = drawNativeFloat(work.locomotionRngState, 360)
  work.locomotionRngState = draw.state
  return draw.value
}

export function drawLocomotionInteger(work: WorkingStep, count: number): number {
  const draw = drawNativeInteger(work.locomotionRngState, count)
  work.locomotionRngState = draw.state
  return draw.value
}

export function drawInteger(work: Pick<WorkingStep, 'rngState'>, count: number): number {
  const draw = randomBoneyardWaveInteger(work.rngState, count)
  work.rngState = draw.state
  return draw.value
}

export function signedUnit(value: number): number {
  return value * 2 - 1
}

export function drawEnemyFloat(work: WorkingStep, maximum: number, signed = false): number {
  const draw = drawNativeFloat(work.steeringRngState, maximum, signed)
  work.steeringRngState = draw.state
  return draw.value
}

export function drawEnemyInteger(work: WorkingStep, count: number): number {
  const draw = drawNativeInteger(work.steeringRngState, count)
  work.steeringRngState = draw.state
  return draw.value
}

export function drawEnemySign(work: WorkingStep, magnitude: number): number {
  const draw = drawNativeSign(work.steeringRngState, magnitude)
  work.steeringRngState = draw.state
  return draw.value
}

export function randomEnemyOffset(work: WorkingStep, radius: number): BoneyardPoint {
  const length = drawEnemyFloat(work, radius)
  const point = radialVector(drawEnemyFloat(work, 360), length)
  return { x: Math.fround(point.x), y: Math.fround(point.y) }
}
