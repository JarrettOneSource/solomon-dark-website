import {
  EARTH_BOULDER_LIT_RECORDS,
  earthImpactFragmentsAtAge,
} from '../core-kernels/primary-spell-earth.ts'

export const EARTH_BOULDER_AURA_RECORD = 15
export const EARTH_BOULDER_OPENING_FLASH_RECORD = 86
export const EARTH_BOULDER_MAIN_RECORDS = [168, 169, 170, 171] as const
export { EARTH_BOULDER_LIT_RECORDS }
export const EARTH_BOULDER_OPENING_FADE_PER_TICK = 0.03500000014901161
export const EARTH_BOULDER_AURA_SCALE = 4.099999904632568
export const EARTH_BOULDER_OPENING_FLASH_SCALE = 2.5
export const EARTH_BOULDER_DEPTH_PLANE = -40
export const EARTH_BOULDER_DRAW_SCALE_MINIMUM = Math.fround(0.45)

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
const ORIENTATION_AXIS = normalize3({ x: 0, y: -0.8, z: 1 })
const ORIENTATION_DEGREES_PER_TICK = 0.75

export interface EarthBoulderPresentationState {
  ageTicks: number
  assemblyCharge: number
  charge: number
  flightTicks: number
  id: number
  phase: 'flight' | 'held'
}

export interface EarthBoulderRockPlan {
  local: Vector3
  position: { x: number, y: number }
  record: typeof EARTH_BOULDER_MAIN_RECORDS[number]
  rotation: number
  scale: number
  shellIndex: number | null
  storedScale: number
  transformed: Vector3
}

export interface EarthBoulderPresentationPlan {
  aura: {
    alpha: number
    record: typeof EARTH_BOULDER_AURA_RECORD
    scale: number
  }
  bodyAlpha: number
  jitter: { x: number, y: number }
  openingFlash: {
    alpha: number
    record: typeof EARTH_BOULDER_OPENING_FLASH_RECORD
    rotation: number
    scale: number
  }
  orientationTicks: number
  rocks: readonly EarthBoulderRockPlan[]
  sortBias: number
  visualOffset: { x: number, y: number }
}

export interface EarthBoulderImpactState {
  ageTicks: number
  birthTick: number
  charge: number
  id: number
}

export interface EarthBoulderFragmentPlan {
  alpha: number
  height: number
  index: number
  position: { x: number, y: number }
  record: typeof EARTH_BOULDER_LIT_RECORDS[number]
  rotation: number
  scale: number
}

export interface EarthBoulderImpactPlan {
  fragments: readonly EarthBoulderFragmentPlan[]
}

interface Vector3 {
  x: number
  y: number
  z: number
}

export function earthBoulderPresentationPlan(
  state: EarthBoulderPresentationState,
  renderTick = state.ageTicks,
): EarthBoulderPresentationPlan {
  const openingMix = clamp01(1 - state.ageTicks * EARTH_BOULDER_OPENING_FADE_PER_TICK)
  const orientationTicks = Math.max(0, state.ageTicks - state.flightTicks)
  const visualTick = Math.max(0, Math.floor(renderTick))
  const jitterRadius = unitRandom(state.id, 0x3000 + visualTick * 2) * 3
  const jitterAngle = unitRandom(state.id, 0x3001 + visualTick * 2) * Math.PI * 2
  const jitter = {
    x: Math.cos(jitterAngle) * jitterRadius,
    y: Math.sin(jitterAngle) * jitterRadius,
  }
  const rocks = earthBoulderBody(state.id, state.assemblyCharge, orientationTicks)
  return {
    aura: {
      alpha: 0.35 + unitRandom(state.id, 0x4000 + visualTick) * 0.25,
      record: EARTH_BOULDER_AURA_RECORD,
      scale: EARTH_BOULDER_AURA_SCALE * state.charge,
    },
    bodyAlpha: 1 - openingMix,
    jitter,
    openingFlash: {
      alpha: openingMix,
      record: EARTH_BOULDER_OPENING_FLASH_RECORD,
      rotation: renderTick * 6 * Math.PI / 180,
      scale: EARTH_BOULDER_OPENING_FLASH_SCALE * openingMix,
    },
    orientationTicks,
    rocks,
    sortBias: (20 + 10 * state.charge) * state.charge * 1.5,
    visualOffset: {
      x: jitter.x,
      y: -20 - 32.5 * state.charge + jitter.y,
    },
  }
}

export function earthBoulderImpactPlan(
  state: EarthBoulderImpactState,
): EarthBoulderImpactPlan {
  return {
    fragments: earthImpactFragmentsAtAge(state, state.ageTicks).map((fragment) => ({
      alpha: clamp01(fragment.alpha),
      height: fragment.height,
      index: fragment.index,
      position: fragment.position,
      record: fragment.record,
      rotation: fragment.rotation * Math.PI / 180,
      scale: fragment.scale,
    })),
  }
}

function earthBoulderBody(
  id: number,
  charge: number,
  orientationTicks: number,
): EarthBoulderRockPlan[] {
  const n = 30 * charge
  const radius = n
  const rebuildBucket = Math.floor(n)
  const localRocks: Omit<
    EarthBoulderRockPlan,
    'position' | 'rotation' | 'scale' | 'transformed'
  >[] = [{
    local: { x: 0, y: 0, z: 0 },
    record: 171,
    shellIndex: null,
    storedScale: 4 * charge,
  }]
  for (let index = 0; index < Math.ceil(n); index += 1) {
    const y = 2 * index / n - 1 + 1 / n
    const radial = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = index * GOLDEN_ANGLE
    localRocks.push({
      local: {
        x: Math.cos(theta) * radial * radius,
        y: y * radius,
        z: Math.sin(theta) * radial * radius,
      },
      record: EARTH_BOULDER_MAIN_RECORDS[randomInt(
        id,
        0x1000 + rebuildBucket * 64 + index,
        3,
      )],
      storedScale: Math.min(
        1,
        (unitRandom(id, 0x2000 + rebuildBucket * 64 + index) * 0.75 + 0.5)
          * Math.min(charge, 1),
      ),
      shellIndex: index,
    })
  }

  const angle = orientationTicks * ORIENTATION_DEGREES_PER_TICK * Math.PI / 180
  return localRocks.map((rock) => {
    const transformed = rotateAroundAxis(rock.local, ORIENTATION_AXIS, angle)
    return {
      ...rock,
      position: { x: transformed.x, y: transformed.y },
      rotation: 0,
      scale: Math.max(EARTH_BOULDER_DRAW_SCALE_MINIMUM, rock.storedScale),
      transformed,
    }
  }).filter((rock) => rock.transformed.z > EARTH_BOULDER_DEPTH_PLANE)
    .sort((left, right) => (
    left.transformed.z - right.transformed.z
    || (left.shellIndex ?? -1) - (right.shellIndex ?? -1)
  ))
}

function rotateAroundAxis(point: Vector3, axis: Vector3, angle: number): Vector3 {
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)
  const dot = point.x * axis.x + point.y * axis.y + point.z * axis.z
  return {
    x: point.x * cosine
      + (axis.y * point.z - axis.z * point.y) * sine
      + axis.x * dot * (1 - cosine),
    y: point.y * cosine
      + (axis.z * point.x - axis.x * point.z) * sine
      + axis.y * dot * (1 - cosine),
    z: point.z * cosine
      + (axis.x * point.y - axis.y * point.x) * sine
      + axis.z * dot * (1 - cosine),
  }
}

function normalize3(vector: Vector3): Vector3 {
  const length = Math.hypot(vector.x, vector.y, vector.z)
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length }
}

function unitRandom(id: number, salt: number): number {
  return hash(id, salt) / 0x1_0000_0000
}

function randomInt(id: number, salt: number, exclusiveMax: number): number {
  return Math.floor(unitRandom(id, salt) * exclusiveMax)
}

function hash(id: number, salt: number): number {
  let value = (id ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d) >>> 0
  value ^= value >>> 15
  value = Math.imul(value, 0x846ca68b) >>> 0
  value ^= value >>> 16
  return value >>> 0
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}
