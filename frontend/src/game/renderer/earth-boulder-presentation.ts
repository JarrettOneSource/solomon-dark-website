export const EARTH_BOULDER_GLIMMER_RECORD = 86
export const EARTH_BOULDER_MAIN_RECORDS = [168, 169, 170, 171] as const
export const EARTH_BOULDER_LIT_RECORDS = [2008, 2009, 2010] as const
export const EARTH_BOULDER_OPENING_FADE_PER_TICK = 0.03500000014901161
export const EARTH_BOULDER_GLIMMER_SCALE = 4.099999904632568
export const EARTH_BOULDER_FRAGMENT_FADE_PER_TICK = 0.02500000037252903
export const EARTH_BOULDER_FRAGMENT_LIFETIME_TICKS = 40
export const EARTH_BOULDER_DEPTH_PLANE = -40
export const EARTH_BOULDER_DRAW_SCALE_MINIMUM = Math.fround(0.45)

const EARTH_INITIAL_CHARGE = Math.fround(0.18)
const EARTH_CHARGE_STEP = Math.fround(0.00125)
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
const ORIENTATION_AXIS = normalize3({ x: 0, y: -0.8, z: 1 })
const ORIENTATION_DEGREES_PER_TICK = 0.75
const CALLED_ROCK_REMOVE_DISTANCE = 5
const CALLED_ROCK_SPEED_START = 0.1
const CALLED_ROCK_SPEED_MULTIPLIER = 1.1
const CALLED_ROCK_SPEED_CAP = 5
const CALLED_ROCK_FALL_TICKS = 12
const MAX_CALLED_ROCK_TRAVEL_TICKS = 48

export interface EarthBoulderPresentationState {
  ageTicks: number
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

export interface EarthCalledRockPlan {
  alpha: number
  distance: number
  falling: boolean
  position: { x: number, y: number }
  record: typeof EARTH_BOULDER_LIT_RECORDS[number]
  rotation: number
  scale: number
  spawnDistance: number
  spawnTick: number
  speed: number
}

export interface EarthBoulderPresentationPlan {
  bodyAlpha: number
  calledRocks: readonly EarthCalledRockPlan[]
  glimmer: {
    alpha: number
    record: typeof EARTH_BOULDER_GLIMMER_RECORD
    scale: number
  }
  orientationTicks: number
  rocks: readonly EarthBoulderRockPlan[]
}

export interface EarthBoulderImpactState {
  ageTicks: number
  charge: number
  id: number
}

export interface EarthBoulderFragmentPlan {
  position: { x: number, y: number }
  record: typeof EARTH_BOULDER_LIT_RECORDS[number]
  rotation: number
  scale: number
}

export interface EarthBoulderImpactPlan {
  alpha: number
  fragments: readonly EarthBoulderFragmentPlan[]
}

interface Vector3 {
  x: number
  y: number
  z: number
}

export function earthBoulderPresentationPlan(
  state: EarthBoulderPresentationState,
): EarthBoulderPresentationPlan {
  const openingMix = clamp01(1 - state.ageTicks * EARTH_BOULDER_OPENING_FADE_PER_TICK)
  const orientationTicks = Math.max(0, state.ageTicks - state.flightTicks)
  const rocks = earthBoulderBody(state.id, state.charge, orientationTicks)
  return {
    bodyAlpha: 1 - openingMix,
    calledRocks: earthCalledRocks(state, orientationTicks),
    glimmer: {
      alpha: openingMix,
      record: EARTH_BOULDER_GLIMMER_RECORD,
      scale: EARTH_BOULDER_GLIMMER_SCALE * state.charge,
    },
    orientationTicks,
    rocks,
  }
}

export function earthBoulderImpactPlan(
  state: EarthBoulderImpactState,
): EarthBoulderImpactPlan {
  const count = Math.floor(Math.max(8, 30 * state.charge))
  const startAngle = unitRandom(state.id, 0x8000) * Math.PI * 2
  const age = Math.max(0, state.ageTicks)
  const fragments = Array.from({ length: count }, (_, index) => {
    const angleJitter = signedRandom(state.id, 0x8100 + index) * Math.PI / count
    const angle = startAngle + index * Math.PI * 2 / count + angleJitter
    const direction = { x: Math.cos(angle), y: Math.sin(angle) * 0.8 }
    const speed = 1.5 + unitRandom(state.id, 0x8200 + index) * state.charge * 1.5
    const spawnRadius = unitRandom(state.id, 0x8300 + index) * 45 * state.charge
    const rotationStep = signedRandom(state.id, 0x8400 + index) * 30
    return {
      position: {
        x: direction.x * (spawnRadius + speed * age),
        y: direction.y * (spawnRadius + speed * age) + age * age * 0.035,
      },
      record: EARTH_BOULDER_LIT_RECORDS[randomInt(state.id, 0x8500 + index, 3)],
      rotation: (unitRandom(state.id, 0x8600 + index) * 360 + rotationStep * age)
        * Math.PI / 180,
      scale: 0.75 + unitRandom(state.id, 0x8700 + index) * state.charge * 1.5,
    }
  })
  return {
    alpha: clamp01(1 - age * EARTH_BOULDER_FRAGMENT_FADE_PER_TICK),
    fragments,
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

function earthCalledRocks(
  state: EarthBoulderPresentationState,
  heldTicks: number,
): EarthCalledRockPlan[] {
  const releaseFallTicks = state.phase === 'flight' ? state.flightTicks : 0
  if (releaseFallTicks > CALLED_ROCK_FALL_TICKS) return []
  const plans: EarthCalledRockPlan[] = []
  const lastHeldTick = Math.floor(heldTicks)
  const firstPossibleActiveTick = Math.max(1, lastHeldTick - MAX_CALLED_ROCK_TRAVEL_TICKS)
  let charge = chargeAtTick(firstPossibleActiveTick - 1)
  for (let tick = firstPossibleActiveTick; tick <= lastHeldTick; tick += 1) {
    charge = Math.min(1, Math.fround(charge + EARTH_CHARGE_STEP))
    if (charge >= 1) continue
    const emits = charge < 0.25 || randomInt(state.id, 0x3000 + tick, 3) === 1
    if (!emits) continue
    const angle = unitRandom(state.id, 0x4000 + tick) * Math.PI * 2
    const spawnDistance = unitRandom(state.id, 0x5000 + tick)
      * Math.max(5, Math.min(120, 50 * charge))
    let distance = spawnDistance
    let speed = CALLED_ROCK_SPEED_START
    const travelTicks = Math.max(0, Math.floor(heldTicks) - tick)
    let removed = false
    for (let step = 0; step < travelTicks; step += 1) {
      if (distance < CALLED_ROCK_REMOVE_DISTANCE) {
        removed = true
        break
      }
      speed = Math.min(CALLED_ROCK_SPEED_CAP, speed * CALLED_ROCK_SPEED_MULTIPLIER)
      distance = Math.max(0, distance - speed)
    }
    if (removed || (distance < CALLED_ROCK_REMOVE_DISTANCE && releaseFallTicks > 0)) continue

    const tangent = signedRandom(state.id, 0x6000 + tick)
      * Math.sin(travelTicks * 0.2) * Math.min(3, distance * 0.2)
    const fallOffset = releaseFallTicks * releaseFallTicks * 0.075
    plans.push({
      alpha: releaseFallTicks === 0 ? 1 : clamp01(1 - releaseFallTicks / CALLED_ROCK_FALL_TICKS),
      distance,
      falling: releaseFallTicks > 0,
      position: {
        x: Math.cos(angle) * distance - Math.sin(angle) * tangent,
        y: Math.sin(angle) * distance + Math.cos(angle) * tangent + fallOffset,
      },
      record: EARTH_BOULDER_LIT_RECORDS[randomInt(state.id, 0x7000 + tick, 3)],
      rotation: (
        unitRandom(state.id, 0x7100 + tick) * 360
        + signedRandom(state.id, 0x7200 + tick) * 30 * (travelTicks + releaseFallTicks)
      ) * Math.PI / 180,
      scale: 0.75 * Math.min(charge, 0.75),
      spawnDistance,
      spawnTick: tick,
      speed,
    })
  }
  return plans
}

function chargeAtTick(tick: number): number {
  let charge = EARTH_INITIAL_CHARGE
  for (let age = 0; age < tick; age += 1) {
    charge = Math.min(1, Math.fround(charge + EARTH_CHARGE_STEP))
  }
  return charge
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

function signedRandom(id: number, salt: number): number {
  return unitRandom(id, salt) * 2 - 1
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
