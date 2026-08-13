import type { Vector2 } from './vector.ts'

export interface HubSegment {
  readonly x1: number
  readonly y1: number
  readonly x2: number
  readonly y2: number
}

const NATIVE_SWEEP_FRACTION = 0.5
const NATIVE_SWEEP_ITERATIONS = 8
const NATIVE_SWEEP_STOP_DISTANCE_SQUARED = 0.01
const NATIVE_SURFACE_CLEARANCE = 0.1

/**
 * Exact Courtyard segment records dumped from the clean stock movement
 * controller. Their order is retained because the first overlapping record
 * becomes the native slide surface.
 */
const SEGMENT_COORDINATES: readonly (readonly [number, number, number, number])[] = [
  [0, 0, 2000, 0],
  [0, 0, 0, 1100],
  [1996, -28, 1998, 352],
  [1999, 586, 1997, 1158],
  [0, 1100, 2000, 1100],
  [1112, 457, 1123, 410],
  [1123, 410, 1126, 343],
  [1126, 343, 1108, 273],
  [1108, 273, 1093, 227],
  [1093, 227, 1079, 219],
  [1079, 219, 1014, 246],
  [1014, 246, 914, 248],
  [914, 248, 838, 221],
  [838, 221, 817, 234],
  [817, 234, 800, 282],
  [800, 282, 787, 347],
  [787, 347, 790, 418],
  [790, 418, 802, 447],
  [790, 418, 807, 359],
  [807, 359, 829, 332],
  [829, 332, 867, 348],
  [867, 348, 871, 378],
  [871, 378, 890, 408],
  [890, 408, 920, 427],
  [920, 427, 977, 430],
  [977, 430, 1019, 410],
  [1019, 410, 1036, 380],
  [1036, 380, 1041, 348],
  [1041, 348, 1080, 332],
  [1080, 332, 1107, 361],
  [1107, 361, 1123, 410],
  [1196, 496, 1212, 462],
  [1212, 462, 1225, 398],
  [1225, 398, 1224, 344],
  [1224, 344, 1213, 287],
  [1213, 287, 1181, 216],
  [1181, 216, 1156, 183],
  [1156, 183, 1125, 141],
  [1125, 141, 1058, 162],
  [1058, 162, 1034, 167],
  [1034, 167, 995, 125],
  [995, 125, 1000, -27],
  [1000, -27, 910, -26],
  [910, -26, 927, 126],
  [927, 126, 887, 167],
  [887, 167, 843, 159],
  [843, 159, 781, 152],
  [781, 152, 767, 165],
  [767, 165, 756, 185],
  [756, 185, 734, 210],
  [734, 210, 717, 240],
  [717, 240, 696, 297],
  [696, 297, 687, 369],
  [687, 369, 694, 434],
  [694, 434, 715, 491],
  [704, 273, 680, 236],
  [680, 236, 675, 188],
  [675, 188, 656, 158],
  [656, 158, 658, -38],
  [658, -38, 595, -38],
  [595, -38, 597, 159],
  [597, 159, 577, 198],
  [577, 198, 578, 344],
  [578, 344, 561, 370],
  [561, 370, 532, 369],
  [532, 369, 511, 346],
  [511, 346, 484, 344],
  [484, 344, 476, 334],
  [476, 334, 382, 336],
  [382, 336, 365, 348],
  [365, 348, 346, 347],
  [346, 347, 346, 375],
  [346, 375, 359, 406],
  [359, 406, 351, 447],
  [351, 447, 318, 476],
  [318, 476, 262, 472],
  [262, 472, 226, 451],
  [226, 451, 201, 425],
  [201, 425, 162, 441],
  [162, 441, 14, 97],
  [14, 97, -164, 282],
  [-164, 282, -34, 408],
  [-34, 408, 59, 495],
  [59, 495, -19, 554],
  [1215, 300, 1246, 285],
  [1246, 285, 1288, 293],
  [1288, 293, 1321, 193],
  [1321, 193, 1320, 138],
  [1320, 138, 1422, 120],
  [1422, 120, 1490, 81],
  [1490, 81, 1514, 26],
  [1514, 26, 1513, -30],
  [2016, 799, 1985, 704],
  [1985, 704, 1923, 725],
  [1923, 725, 1911, 767],
  [1911, 767, 1806, 797],
  [1806, 797, 1778, 731],
  [1778, 731, 1874, 697],
  [1874, 697, 2083, 524],
  [2083, 524, 2022, 387],
  [2022, 387, 1796, 567],
  [1729, 602, 1703, 540],
  [1703, 540, 1799, 489],
  [1799, 489, 1875, 446],
  [1875, 446, 1855, 408],
  [1855, 408, 1855, 372],
  [1855, 372, 1827, 363],
  [1827, 363, 1791, 389],
  [1791, 389, 1731, 391],
  [1796, 567, 1729, 602],
  [1731, 391, 1681, 372],
  [1681, 372, 1629, 364],
  [1629, 364, 1654, 245],
  [1654, 245, 1753, 234],
  [1753, 234, 1857, 169],
  [1857, 169, 1934, 63],
  [1934, 63, 1949, -41],
  [961, 888, 1009, 871],
  [1009, 871, 1025, 818],
  [1025, 818, 991, 781],
  [991, 781, 929, 779],
  [929, 779, 896, 819],
  [896, 819, 909, 864],
  [909, 864, 961, 888],
  [1435, 694, 1342, 655],
  [1342, 655, 1382, 591],
  [1382, 591, 1492, 628],
  [1492, 628, 1435, 694],
  [821, 467, 856, 465],
  [573.5, 180, 681.5, 180],
]

export const HUB_COURTYARD_SEGMENTS: readonly HubSegment[] =
  SEGMENT_COORDINATES.map(([x1, y1, x2, y2]) => ({ x1, y1, x2, y2 }))

function nearestPointOnSegment(point: Vector2, segment: HubSegment): Vector2 {
  const segmentX = segment.x2 - segment.x1
  const segmentY = segment.y2 - segment.y1
  const lengthSquared = segmentX * segmentX + segmentY * segmentY
  if (lengthSquared === 0) return { x: segment.x1, y: segment.y1 }
  const projection = (
    (point.x - segment.x1) * segmentX
    + (point.y - segment.y1) * segmentY
  ) / lengthSquared
  const clamped = Math.min(1, Math.max(0, projection))
  return {
    x: segment.x1 + segmentX * clamped,
    y: segment.y1 + segmentY * clamped,
  }
}

function circleOverlapsSegment(
  position: Vector2,
  radius: number,
  segment: HubSegment,
): boolean {
  const nearest = nearestPointOnSegment(position, segment)
  const dx = nearest.x - position.x
  const dy = nearest.y - position.y
  return dx * dx + dy * dy < radius * radius
}

function firstOverlappingSegment(
  position: Vector2,
  radius: number,
  excluded?: HubSegment,
): HubSegment | undefined {
  return HUB_COURTYARD_SEGMENTS.find((segment) => (
    segment !== excluded && circleOverlapsSegment(position, radius, segment)
  ))
}

function separateFromSegment(
  position: Vector2,
  radius: number,
  segment: HubSegment,
): Vector2 {
  const nearest = nearestPointOnSegment(position, segment)
  const dx = position.x - nearest.x
  const dy = position.y - nearest.y
  const distanceSquared = dx * dx + dy * dy
  if (distanceSquared >= radius * radius || distanceSquared === 0) return position
  const distance = Math.sqrt(distanceSquared)
  const separation = radius + NATIVE_SURFACE_CLEARANCE
  return {
    x: nearest.x + dx / distance * separation,
    y: nearest.y + dy / distance * separation,
  }
}

interface SweepResult {
  hit?: HubSegment
  position: Vector2
}

export interface HubCollisionMove {
  position: Vector2
  rngState: number
}

function nativeFallbackSample(state: number): { state: number; value: number } {
  // The stock call site uses the game's shared additive RNG. Keep this lane
  // local and deterministic while preserving the recovered [0, 1] contract.
  let value = state >>> 0
  value ^= value << 13
  value ^= value >>> 17
  value ^= value << 5
  value >>>= 0
  return { state: value || 0x6d2b79f5, value: value / 0xffffffff }
}

function sweepTowardDestination(
  origin: Vector2,
  delta: Vector2,
  radius: number,
  slideSurface?: HubSegment,
): SweepResult {
  let current = { ...origin }
  const target = { x: origin.x + delta.x, y: origin.y + delta.y }
  let accepted: Vector2 | undefined
  let hit: HubSegment | undefined

  for (let iteration = 0; iteration < NATIVE_SWEEP_ITERATIONS; iteration += 1) {
    const remaining = { x: target.x - current.x, y: target.y - current.y }
    if (
      remaining.x * remaining.x + remaining.y * remaining.y
      < NATIVE_SWEEP_STOP_DISTANCE_SQUARED
    ) break

    const midpoint = {
      x: current.x + remaining.x * NATIVE_SWEEP_FRACTION,
      y: current.y + remaining.y * NATIVE_SWEEP_FRACTION,
    }
    const candidate = slideSurface
      ? separateFromSegment(midpoint, radius, slideSurface)
      : midpoint
    const collision = firstOverlappingSegment(candidate, radius, slideSurface)
    if (collision) {
      target.x = midpoint.x
      target.y = midpoint.y
      hit = collision
      continue
    }

    accepted = candidate
    current = midpoint
  }

  return {
    hit,
    position: slideSurface && accepted ? accepted : { ...origin },
  }
}

function sweepStep(
  origin: Vector2,
  delta: Vector2,
  radius: number,
  rngState: number,
): HubCollisionMove {
  const destination = { x: origin.x + delta.x, y: origin.y + delta.y }
  if (!firstOverlappingSegment(destination, radius)) {
    return { position: destination, rngState }
  }

  const firstPass = sweepTowardDestination(origin, delta, radius)
  if (!firstPass.hit) {
    const sample = nativeFallbackSample(rngState)
    return {
      position: {
        x: origin.x + delta.x * NATIVE_SWEEP_FRACTION * sample.value,
        y: origin.y + delta.y * NATIVE_SWEEP_FRACTION * sample.value,
      },
      rngState: sample.state,
    }
  }
  return {
    position: sweepTowardDestination(origin, delta, radius, firstPass.hit).position,
    rngState,
  }
}

export function isHubTraversable(point: Vector2, radius: number): boolean {
  return !firstOverlappingSegment(point, radius)
}

/** Replays the stock controller's collision-triggered two-pass sweep. */
export function moveWithHubCollision(
  position: Vector2,
  delta: Vector2,
  radius: number,
): Vector2 {
  return moveWithHubCollisionState(position, delta, radius, 0x51a7c011).position
}

export function moveWithHubCollisionState(
  position: Vector2,
  delta: Vector2,
  radius: number,
  rngState: number,
): HubCollisionMove {
  if (delta.x === 0 && delta.y === 0) {
    return { position: { ...position }, rngState }
  }

  // The native caller submits small fixed-tick deltas. Keeping that invariant
  // here also makes diagnostic and future gameplay calls independent of their
  // browser frame length, without changing the controller response.
  const distance = Math.hypot(delta.x, delta.y)
  const stepCount = Math.max(1, Math.ceil(distance / radius))
  const step = { x: delta.x / stepCount, y: delta.y / stepCount }
  let current = { ...position }
  let nextRngState = rngState
  for (let index = 0; index < stepCount; index += 1) {
    const moved = sweepStep(current, step, radius, nextRngState)
    current = moved.position
    nextRngState = moved.rngState
  }
  return { position: current, rngState: nextRngState }
}
