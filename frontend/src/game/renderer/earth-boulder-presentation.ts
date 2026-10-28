import {
  EARTH_BOULDER_LIT_RECORDS,
  earthImpactFragmentsAtAge,
} from '../core-kernels/primary-spell-earth.ts'
import {
  earthBoulderTransformPoint,
  type EarthBoulderOrientation,
  type EarthBoulderVector3,
} from '../core-kernels/primary-spell-earth-orientation.ts'

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
export interface EarthBoulderPresentationState {
  ageTicks: number
  assemblyCharge: number
  charge: number
  flightTicks: number
  id: number
  orientation: EarthBoulderOrientation
  phase: 'flight' | 'held'
  shellCharge: number
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
  orientation: EarthBoulderOrientation
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

type Vector3 = EarthBoulderVector3

export function earthBoulderPresentationPlan(
  state: EarthBoulderPresentationState,
  renderTick = state.ageTicks,
): EarthBoulderPresentationPlan {
  const openingMix = clamp01(1 - state.ageTicks * EARTH_BOULDER_OPENING_FADE_PER_TICK)
  const visualTick = Math.max(0, Math.floor(renderTick))
  const jitterRadius = unitRandom(state.id, 0x3000 + visualTick * 2) * 3
  const jitterAngle = unitRandom(state.id, 0x3001 + visualTick * 2) * Math.PI * 2
  const jitter = {
    x: Math.cos(jitterAngle) * jitterRadius,
    y: Math.sin(jitterAngle) * jitterRadius,
  }
  const rocks = earthBoulderBody(
    state.id,
    state.assemblyCharge,
    state.shellCharge,
    state.orientation,
  )
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
    orientation: [...state.orientation],
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
  assemblyCharge: number,
  shellCharge: number,
  orientation: EarthBoulderOrientation,
): EarthBoulderRockPlan[] {
  const n = 30 * assemblyCharge
  const radius = 30 * shellCharge
  const rebuildBucket = Math.floor(n)
  const localRocks: Omit<
    EarthBoulderRockPlan,
    'position' | 'rotation' | 'scale' | 'transformed'
  >[] = [{
    local: { x: 0, y: 0, z: 0 },
    record: 171,
    shellIndex: null,
    storedScale: 4 * assemblyCharge,
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
          * Math.min(assemblyCharge, 1),
      ),
      shellIndex: index,
    })
  }

  return localRocks.map((rock) => {
    const transformed = earthBoulderTransformPoint(rock.local, orientation)
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
