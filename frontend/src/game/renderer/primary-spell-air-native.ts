import {
  nativeRandomFloatFromSemanticWord,
  nativeRandomIntFromSemanticWord,
} from '../core-kernels/native-random-domain.ts'

export const AIR_LIGHTNING_BODY_LIFETIME_TICKS = 2
export const AIR_LIGHTNING_CONTACT_LIFETIME_TICKS = 5
export const AIR_LIGHTNING_ENHANCED_SAMPLE_SPACING = 15
export const AIR_LIGHTNING_SPLINE_DURATION = 2
export const AIR_LIGHTNING_MAX_PARAMETER_STEP = 0.5
export const AIR_LIGHTNING_FAST_INVERSE_SQRT_MAGIC = 0x5f3759df
export const AIR_LIGHTNING_CORONA_CIRCLE_RECORD = 110
export const AIR_LIGHTNING_CORONA_FORK_RECORDS = [1836, 1837, 1838, 1839] as const
export const AIR_LIGHTNING_BRANCH_RECORDS = [375, 376] as const
export const AIR_LIGHTNING_CONTACT_LIGHT_BASE_RADIUS = 1
export const AIR_LIGHTNING_CONTACT_LIGHT_RADIUS_JITTER = 0.75
export const AIR_LIGHTNING_CONTACT_LIGHT_BASE_INTENSITY = 1
export const AIR_LIGHTNING_CONTACT_LIGHT_INTENSITY_DELTA = Math.fround(-0.05)
export const AIR_LIGHTNING_PATH_STEP = 100
export const AIR_LIGHTNING_PATH_REMAINDER = 50
export const AIR_LIGHTNING_PATH_MINIMUM_DISTANCE = 220
export const AIR_LIGHTNING_PATH_Y_OFFSET = 35

const AIR_LIGHTNING_RIBBON_RECORD = 44
const AIR_LIGHTNING_BASE_WIDTH = 25
const AIR_LIGHTNING_PRIMARY_WAVE = 25
const AIR_LIGHTNING_SECONDARY_WAVE = 12
const AIR_LIGHTNING_RANDOM_ANGLE_DEGREES = 65
const AIR_LIGHTNING_RANDOM_RADIUS = 30
const CONTACT_ALPHA_LEVELS = [1, 0.8, 0.6, 0.4, 0.2] as const
const UNDERPOWERED_CONTACT_ALPHA_LEVELS = [0.5, 0.3, 0.1] as const
const CONTACT_OFFSET_RADIUS = 10
const CORONA_ANGLE_STEP_RADIANS = Math.PI / 180
const SPLINE_NORMAL_DELTA = 0.001
const FLOAT_BITS = new DataView(new ArrayBuffer(4))
const AIR_LIGHTNING_BRANCH_GEOMETRY = [
  [
    { x: -38, y: -64 }, { x: 1, y: -64 },
    { x: -38, y: 9 }, { x: 1, y: 9 },
  ],
  [
    { x: -40, y: -170 }, { x: 0, y: -170 },
    { x: -40, y: 15 }, { x: 0, y: 15 },
  ],
] as const

export interface NativeAirPoint {
  x: number
  y: number
}

export interface NativeAirRibbonLayer {
  alpha: number
  branch: NativeAirBranchPlan | null
  indices: Uint32Array
  parameterSamples: Float32Array
  phaseDegrees: number
  phaseOffset: number
  textureRecord: 44
  tint: number
  uvs: Float32Array
  vertices: Float32Array
  width: number
}

export interface NativeAirBranchPlan {
  geometryRecord: typeof AIR_LIGHTNING_BRANCH_RECORDS[number]
  indices: Uint32Array
  mirrorX: boolean
  scale: number
  textureRecord: typeof AIR_LIGHTNING_BRANCH_RECORDS[number]
  uvs: Float32Array
  vertices: Float32Array
}

export interface NativeAirCoronaCircle {
  alpha: number
  record: 110
  scale: number
  tint: number
}

export interface NativeAirCoronaFork {
  alpha: number
  record: typeof AIR_LIGHTNING_CORONA_FORK_RECORDS[number]
  rotation: number
  scale: number
  tint: number
}

export interface NativeAirCoronaPlan {
  alpha: number
  center: NativeAirPoint
  circles: readonly NativeAirCoronaCircle[]
  forks: readonly NativeAirCoronaFork[]
}

export interface NativeAirContactLightPlan {
  castsDirectionalShadow: false
  intensity: number
  position: NativeAirPoint
  radius: number
}

export interface NativeAirPathLightPlan {
  castsDirectionalShadow: true
  intensity: number
  position: NativeAirPoint
  radius: number
}

export interface NativeAirPathLightInput {
  birthTick: number
  endpoint: NativeAirPoint
  id: number
  midpoint: NativeAirPoint
  origin: NativeAirPoint
  weakCast?: boolean
}

export interface NativeAirLightningPlan {
  body: {
    layers: readonly NativeAirRibbonLayer[]
  } | null
  contactCorona: NativeAirCoronaPlan
  contactLight: NativeAirContactLightPlan | null
  endpoint: NativeAirPoint
  midpoint: NativeAirPoint
  source: NativeAirPoint
  sourceCorona: NativeAirCoronaPlan | null
}

export type NativeAirLightningFactoryPlan = Pick<
  NativeAirLightningPlan,
  'body' | 'endpoint' | 'midpoint' | 'source' | 'sourceCorona'
>

export interface NativeAirLightningInput {
  ageTicks: number
  birthTick: number
  endpoint: NativeAirPoint
  id: number
  midpoint: NativeAirPoint
  underpowered?: boolean
}

export interface NativeAirCoronaInput {
  alpha: number
  angle: number
  center: NativeAirPoint
  randomSalt: number
  scale: number
  seed: number
}

export interface NativeAirContactLightSourceInput {
  ageTicks: number
  endpoint: NativeAirPoint
  id: number
  origin: NativeAirPoint
  underpowered?: boolean
}

interface NativeAirPresentationRandomSource {
  float: (maximum?: number) => number
  int: (exclusiveBound: number) => number
}

type NativeAirRandomSource = NativeAirPresentationRandomSource | (() => number)

export interface NativeAirContactLightInput {
  ageTicks: number
  id: number
  position: NativeAirPoint
  underpowered?: boolean
}

interface NativeAirContactSamples {
  angle: number
  lightRadius: number
  offsetAngle: number
  offsetRadius: number
  scale: number
}

/**
 * Presentation projection of the native Lightning owners recovered at
 * 0x00531640. Retail samples process-global RNG; the web projection derives
 * those cosmetic samples from the replicated transient id so every replica
 * constructs the same bolt.
 */
export function buildNativeAirLightningPlan(
  input: NativeAirLightningInput,
): NativeAirLightningPlan {
  const nativeAge = Math.max(0, Math.floor(input.ageTicks))
  const factory = buildNativeAirLightningFactoryPlan(input)
  const contactSamples = nativeContactSamples(input.id)
  const contactCenter = {
    x: factory.endpoint.x
      + Math.cos(contactSamples.offsetAngle) * contactSamples.offsetRadius,
    y: factory.endpoint.y
      + Math.sin(contactSamples.offsetAngle) * contactSamples.offsetRadius,
  }
  const contactAngle = contactSamples.angle
    + nativeAge * CORONA_ANGLE_STEP_RADIANS
  const contactAlpha = input.underpowered
    ? UNDERPOWERED_CONTACT_ALPHA_LEVELS[nativeAge] ?? 0
    : CONTACT_ALPHA_LEVELS[nativeAge] ?? 0

  return {
    ...factory,
    contactCorona: buildNativeAirCoronaPlan({
      alpha: contactAlpha,
      angle: contactAngle,
      center: contactCenter,
      randomSalt: 0x46414445 ^ nativeAge,
      scale: contactSamples.scale,
      seed: input.id,
    }),
    contactLight: buildNativeAirContactLightPlan({
      ageTicks: nativeAge,
      id: input.id,
      position: contactCenter,
      underpowered: input.underpowered,
    }),
  }
}

/**
 * Common visual owners constructed by the native Air factory. Contact
 * ownership differs between player Air and Mage Air, so it deliberately does
 * not live in this shared plan.
 */
export function buildNativeAirLightningFactoryPlan(
  input: NativeAirLightningInput,
): NativeAirLightningFactoryPlan {
  const nativeAge = Math.max(0, Math.floor(input.ageTicks))
  const source = { x: 0, y: 0 }
  const endpoint = { ...input.endpoint }
  const midpoint = { ...input.midpoint }
  const points = [source, midpoint, endpoint] as const
  const basePhaseDegrees = -3 * input.birthTick
  return {
    body: nativeAge < AIR_LIGHTNING_BODY_LIFETIME_TICKS
      ? {
          layers: [
            buildRibbon(
              points,
              input.id,
              input.birthTick,
              input.underpowered ? 0.75 : 1,
              basePhaseDegrees,
              0,
              input.underpowered ? 0x80ffff : 0xffffff,
              input.underpowered ? 0.5 : 1,
            ),
            buildRibbon(
              points,
              input.id,
              input.birthTick,
              input.underpowered ? 0.5625 : 0.75,
              basePhaseDegrees,
              15,
              0x00ffff,
              input.underpowered ? 0.25 : 0.5,
            ),
          ],
        }
      : null,
    endpoint,
    midpoint,
    source,
    sourceCorona: nativeAge < 1
      ? sourceCorona(input.id, source)
      : null,
  }
}

export function buildNativeAirCoronaPlan(
  input: NativeAirCoronaInput,
): NativeAirCoronaPlan {
  return buildCorona(
    input.center,
    input.alpha,
    input.scale,
    input.angle,
    nativeAirPresentationRandomSource(input.seed, input.randomSalt),
  )
}

/**
 * Pure projection of the contact fade's outbound ZAnimLit source. Position is
 * local to the spell origin, matching the rest of this Air render plan; the
 * world-light collector owns translation and enrollment.
 */
export function buildNativeAirContactLightPlan(
  input: NativeAirContactLightInput,
): NativeAirContactLightPlan | null {
  const nativeAge = Math.max(0, Math.floor(input.ageTicks))
  const lifetimeTicks = input.underpowered
    ? UNDERPOWERED_CONTACT_ALPHA_LEVELS.length
    : AIR_LIGHTNING_CONTACT_LIFETIME_TICKS
  if (nativeAge >= lifetimeTicks) return null

  const maximumIntensity = input.underpowered
    ? AIR_LIGHTNING_CONTACT_LIGHT_BASE_INTENSITY * 0.5
    : AIR_LIGHTNING_CONTACT_LIGHT_BASE_INTENSITY
  let intensity = Math.fround(maximumIntensity)
  for (let tick = 0; tick < nativeAge; tick += 1) {
    intensity = Math.fround(intensity + AIR_LIGHTNING_CONTACT_LIGHT_INTENSITY_DELTA)
  }

  return {
    castsDirectionalShadow: false,
    intensity: Math.min(intensity, maximumIntensity),
    position: input.position,
    radius: nativeContactSamples(input.id).lightRadius * (input.underpowered ? 0.5 : 1),
  }
}

export function buildNativeAirContactLightSource(
  input: NativeAirContactLightSourceInput,
): NativeAirContactLightPlan | null {
  const samples = nativeContactSamples(input.id)
  const light = buildNativeAirContactLightPlan({
    ageTicks: input.ageTicks,
    id: input.id,
    position: {
      x: input.endpoint.x + Math.cos(samples.offsetAngle) * samples.offsetRadius,
      y: input.endpoint.y + Math.sin(samples.offsetAngle) * samples.offsetRadius,
    },
    underpowered: input.underpowered,
  })
  if (!light) return null
  return {
    ...light,
    position: {
      x: input.origin.x + light.position.x,
      y: input.origin.y + light.position.y,
    },
  }
}

export function buildNativeAirPathLightSources(
  input: NativeAirPathLightInput,
  random = nativeAirPresentationRandom(
    input.id,
    semanticSeed(input.id, input.birthTick, 0x4d495343),
  ),
): readonly NativeAirPathLightPlan[] {
  const intensityJitter = Math.fround(random() * Math.fround(0.75))
  const intensity = Math.fround(
    Math.fround(Math.fround(0.25) + intensityJitter)
      * Math.fround(input.weakCast === true ? 0.25 : 1),
  )
  const result: NativeAirPathLightPlan[] = []
  const tryAppend = (candidate: NativeAirPoint) => {
    const dx = Math.fround(candidate.x - input.origin.x)
    const dy = Math.fround(candidate.y - input.origin.y)
    const distanceSquared = Math.fround(dx * dx + dy * dy)
    if (distanceSquared < AIR_LIGHTNING_PATH_MINIMUM_DISTANCE ** 2) return
    result.push({
      castsDirectionalShadow: true,
      intensity,
      position: {
        x: Math.fround(candidate.x),
        y: Math.fround(candidate.y + AIR_LIGHTNING_PATH_Y_OFFSET),
      },
      radius: Math.fround(
        Math.fround(0.75) + Math.fround(random() * Math.fround(0.25)),
      ),
    })
  }

  for (const [start, end] of [
    [input.origin, input.midpoint],
    [input.midpoint, input.endpoint],
  ] as const) {
    const current = { x: Math.fround(start.x), y: Math.fround(start.y) }
    const delta = {
      x: Math.fround(end.x - start.x),
      y: Math.fround(end.y - start.y),
    }
    let remaining = Math.fround(Math.sqrt(Math.fround(
      delta.x * delta.x + delta.y * delta.y,
    )))
    const inverseLength = remaining > 0 ? Math.fround(1 / remaining) : 0
    const step = {
      x: Math.fround(Math.fround(inverseLength * delta.x) * AIR_LIGHTNING_PATH_STEP),
      y: Math.fround(Math.fround(inverseLength * delta.y) * AIR_LIGHTNING_PATH_STEP),
    }
    while (remaining > AIR_LIGHTNING_PATH_REMAINDER) {
      tryAppend(current)
      current.x = Math.fround(current.x + step.x)
      current.y = Math.fround(current.y + step.y)
      remaining = Math.fround(remaining - AIR_LIGHTNING_PATH_STEP)
    }
    tryAppend({ x: Math.fround(end.x), y: Math.fround(end.y) })
  }
  return result
}

function buildRibbon(
  points: readonly [NativeAirPoint, NativeAirPoint, NativeAirPoint],
  id: number,
  birthTick: number,
  width: number,
  basePhaseDegrees: number,
  phaseOffset: number,
  tint: number,
  alpha: number,
): NativeAirRibbonLayer {
  const parameterSamples = nativeParameterSamples(points[0], points[1])
  const pairCount = parameterSamples.length
  const segmentCount = pairCount - 1
  const vertices = new Float32Array(pairCount * 4)
  const uvs = new Float32Array(pairCount * 4)
  const indices = new Uint32Array(segmentCount * 6)
  const phaseDegrees = basePhaseDegrees + phaseOffset
  let ribbonRandomState = semanticSeed(id, birthTick, 0x52494242 ^ phaseOffset)

  for (let pair = 0; pair < pairCount; pair += 1) {
    const parameter = parameterSamples[pair]
    const appendedEndpoint = pair === pairCount - 1
    const point = quickSplinePoint(points, parameter)
    const normal = quickSplineNormal(points, parameter)
    let centerX = point.x
    let centerY = point.y
    let halfWidth = width * AIR_LIGHTNING_BASE_WIDTH * 0.5

    if (!appendedEndpoint) {
      const progress = parameter / AIR_LIGHTNING_SPLINE_DURATION
      const envelope = Math.sin(progress * Math.PI)
      const primaryWave = envelope
        * Math.sin(degreesToRadians(parameter * 360 + phaseDegrees))
        * AIR_LIGHTNING_PRIMARY_WAVE
      const secondaryWave = envelope
        * Math.sin(degreesToRadians(phaseDegrees * 2.5 - parameter * 90))
        * AIR_LIGHTNING_SECONDARY_WAVE
      const normalOffset = primaryWave + secondaryWave
      centerX += normal.x * normalOffset
      centerY += normal.y * normalOffset

      const randomSample = nativeAirRibbonRandomSample(ribbonRandomState)
      ribbonRandomState = randomSample.nextState
      const randomAngle = randomSample.angleDegrees
      const randomRadius = randomSample.radius * envelope
      centerX += Math.sin(degreesToRadians(randomAngle)) * randomRadius
      centerY -= Math.cos(degreesToRadians(randomAngle)) * randomRadius
      halfWidth *= (1 - envelope) * 0.75 + 0.5
    }

    const vertex = pair * 4
    vertices[vertex] = centerX + normal.x * halfWidth
    vertices[vertex + 1] = centerY + normal.y * halfWidth
    vertices[vertex + 2] = centerX - normal.x * halfWidth
    vertices[vertex + 3] = centerY - normal.y * halfWidth

    // Record 44's horizontal cyan-white ramp spans the ribbon width; its
    // vertical edge alternates along the strip to repeat the 17 x 14 glyph.
    const v = pair === 0 || pair === pairCount - 1
      ? 0
      : pair % 2 === 1 ? 1 : 0.5
    uvs[vertex] = 0
    uvs[vertex + 1] = v
    uvs[vertex + 2] = 1
    uvs[vertex + 3] = v
  }

  for (let segment = 0; segment < segmentCount; segment += 1) {
    const left = segment * 2
    const next = left + 2
    const index = segment * 6
    indices[index] = left
    indices[index + 1] = left + 1
    indices[index + 2] = next
    indices[index + 3] = left + 1
    indices[index + 4] = next + 1
    indices[index + 5] = next
  }

  return {
    alpha,
    branch: buildNativeAirBranchPlan(
      points,
      nativeAirPresentationRandomSource(
        id,
        semanticSeed(id, birthTick, 0x4252414e ^ phaseOffset),
      ),
    ),
    indices,
    parameterSamples,
    phaseDegrees,
    phaseOffset,
    textureRecord: AIR_LIGHTNING_RIBBON_RECORD,
    tint,
    uvs,
    vertices,
    width,
  }
}

export function nativeAirRibbonRandomSample(state: number): {
  angleDegrees: number
  nextState: number
  radius: number
} {
  const seed = state >>> 0
  const angleMagnitude = (seed % 360_000) / 360_000 * AIR_LIGHTNING_RANDOM_ANGLE_DEGREES
  const signedState = nativeSignedAbs32(nativeAirMixRaw(seed))
  const radiusState = nativeSignedAbs32(nativeAirMixRaw(signedState))
  return {
    angleDegrees: signedState % 2 === 1 ? -angleMagnitude : angleMagnitude,
    nextState: nativeSignedAbs32(nativeAirMixRaw(radiusState)),
    radius: (radiusState % 360_000) / 360_000 * AIR_LIGHTNING_RANDOM_RADIUS,
  }
}

export function buildNativeAirBranchPlan(
  points: readonly [NativeAirPoint, NativeAirPoint, NativeAirPoint],
  random: NativeAirRandomSource,
): NativeAirBranchPlan | null {
  if (airRandomInt(random, 2) !== 1) return null
  const attachment = quickSplinePoint(
    points,
    airRandomFloat(random, AIR_LIGHTNING_SPLINE_DURATION),
  )
  let scale = Math.fround(0.25 + airRandomFloat(random, 0.5))
  if (airRandomInt(random, 30) === 1) scale = 1
  const mirrorX = airRandomInt(random, 2) === 1
  const geometryIndex = airRandomInt(random, 2) as 0 | 1
  const textureIndex = airRandomInt(random, 2) as 0 | 1
  const geometryRecord = AIR_LIGHTNING_BRANCH_RECORDS[geometryIndex]
  const geometry = AIR_LIGHTNING_BRANCH_GEOMETRY[geometryIndex]
  const first = geometry[0]
  const baseDegrees = normalizeDegrees(Math.atan2(-first.y, first.x) * 180 / Math.PI)
  const radians = (baseDegrees + airRandomFloat(random, 45)) * Math.PI / 180
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)
  const xScale = (mirrorX ? -1 : 1) * scale
  const vertices = new Float32Array(8)
  for (const [index, point] of geometry.entries()) {
    const x = point.x * xScale
    const y = point.y * scale
    vertices[index * 2] = attachment.x + x * cosine - y * sine
    vertices[index * 2 + 1] = attachment.y + x * sine + y * cosine
  }
  return {
    geometryRecord,
    indices: Uint32Array.from([0, 1, 2, 1, 3, 2]),
    mirrorX,
    scale,
    textureRecord: AIR_LIGHTNING_BRANCH_RECORDS[textureIndex],
    uvs: Float32Array.from([0, 0, 1, 0, 0, 1, 1, 1]),
    vertices,
  }
}

function nativeParameterSamples(
  source: NativeAirPoint,
  midpoint: NativeAirPoint,
): Float32Array {
  const deltaX = Math.fround(Math.fround(midpoint.x) - Math.fround(source.x))
  const deltaY = Math.fround(Math.fround(midpoint.y) - Math.fround(source.y))
  const squaredDistance = Math.fround(deltaX * deltaX + deltaY * deltaY)
  const inverseDistance = nativeFastInverseSquareRoot(squaredDistance)
  const firstLegDistance = Math.fround(1 / inverseDistance)
  const spacingRatio = Math.fround(
    firstLegDistance / AIR_LIGHTNING_ENHANCED_SAMPLE_SPACING,
  )
  const rawStep = Math.fround(AIR_LIGHTNING_SPLINE_DURATION / spacingRatio)
  const step = Math.min(AIR_LIGHTNING_MAX_PARAMETER_STEP, rawStep)
  const samples: number[] = []
  let parameter = Math.fround(0)
  while (parameter < AIR_LIGHTNING_SPLINE_DURATION - step) {
    samples.push(parameter)
    parameter = Math.fround(parameter + step)
  }
  samples.push(AIR_LIGHTNING_SPLINE_DURATION)
  return Float32Array.from(samples)
}

function nativeFastInverseSquareRoot(squaredDistance: number): number {
  const halfSquaredDistance = Math.fround(squaredDistance * 0.5)
  FLOAT_BITS.setFloat32(0, squaredDistance, true)
  const squaredDistanceBits = FLOAT_BITS.getUint32(0, true)
  FLOAT_BITS.setUint32(
    0,
    (AIR_LIGHTNING_FAST_INVERSE_SQRT_MAGIC - (squaredDistanceBits >>> 1)) >>> 0,
    true,
  )
  const estimate = FLOAT_BITS.getFloat32(0, true)
  return Math.fround(
    estimate * (1.5 - halfSquaredDistance * estimate * estimate),
  )
}

function quickSplinePoint(
  points: readonly [NativeAirPoint, NativeAirPoint, NativeAirPoint],
  parameter: number,
): NativeAirPoint {
  const x = quickSplineAxis([points[0].x, points[1].x, points[2].x], parameter)
  const y = quickSplineAxis([points[0].y, points[1].y, points[2].y], parameter)
  return { x, y }
}

function quickSplineAxis(
  points: readonly [number, number, number],
  parameter: number,
): number {
  const firstForward = (points[1] - points[0]) * 3 * 0.25
  const secondForward = ((points[2] - points[0]) * 3 - firstForward) * 0.25
  const thirdForward = ((points[2] - points[1]) * 3 - secondForward) * 0.25
  const thirdTangent = thirdForward
  const secondTangent = secondForward - thirdTangent * 0.25
  const firstTangent = firstForward - secondTangent * 0.25
  const tangents = [firstTangent, secondTangent, thirdTangent] as const
  const segment = Math.min(1, Math.floor(parameter))
  const local = parameter - segment
  const a = tangents[segment]
  const b = 3 * (points[segment + 1] - points[segment])
    - 2 * tangents[segment]
    - tangents[segment + 1]
  const c = 2 * (points[segment] - points[segment + 1])
    + tangents[segment]
    + tangents[segment + 1]
  return points[segment] + local * (a + local * (b + local * c))
}

function quickSplineNormal(
  points: readonly [NativeAirPoint, NativeAirPoint, NativeAirPoint],
  parameter: number,
): NativeAirPoint {
  const currentParameter = Math.max(SPLINE_NORMAL_DELTA, parameter)
  const previous = quickSplinePoint(points, currentParameter - SPLINE_NORMAL_DELTA)
  const current = quickSplinePoint(points, currentParameter)
  return normalized({
    x: current.y - previous.y,
    y: previous.x - current.x,
  })
}

function sourceCorona(id: number, source: NativeAirPoint): NativeAirCoronaPlan {
  const random = nativeAirPresentationRandom(id, 0x534f5552)
  const scale = Math.fround(1 + random(0.5))
  const angle = random(Math.PI * 2)
  return buildNativeAirCoronaPlan({
    alpha: 1,
    angle,
    center: source,
    randomSalt: 0x474c4f57,
    scale,
    seed: id,
  })
}

function buildCorona(
  center: NativeAirPoint,
  alpha: number,
  scale: number,
  angle: number,
  random: NativeAirRandomSource,
): NativeAirCoronaPlan {
  const pulseScale = (Math.abs(Math.sin(angle * 15)) * 0.15 + 3.5) * scale
  const firstForkIndex = airRandomInt(random, AIR_LIGHTNING_CORONA_FORK_RECORDS.length)
  const secondForkIndex = AIR_LIGHTNING_CORONA_FORK_RECORDS.length - 1 - firstForkIndex
  return {
    alpha,
    center,
    circles: [
      {
        alpha: Math.fround(0.2 + airRandomFloat(random, 0.25)),
        record: 110,
        scale: pulseScale,
        tint: 0x80bfbf,
      },
      { alpha: 0.5, record: 110, scale: pulseScale * 0.75, tint: 0x80bfbf },
      { alpha: 0.5, record: 110, scale: pulseScale * 0.5, tint: 0x80bfbf },
      {
        alpha: 0.25,
        record: 110,
        scale: pulseScale * Math.fround(0.2 + airRandomFloat(random, 0.2)),
        tint: 0x80bfbf,
      },
    ],
    forks: [
      {
        alpha: 1,
        record: AIR_LIGHTNING_CORONA_FORK_RECORDS[firstForkIndex],
        rotation: angle,
        scale: scale * Math.fround(0.75 + airRandomFloat(random, 0.25)),
        tint: 0xffffff,
      },
      {
        alpha: 1,
        record: AIR_LIGHTNING_CORONA_FORK_RECORDS[secondForkIndex],
        rotation: angle + Math.PI / 2,
        scale,
        tint: 0xffffff,
      },
    ],
  }
}

function nativeContactSamples(id: number): NativeAirContactSamples {
  const random = nativeAirPresentationRandom(id, 0x434f4e54)
  return {
    offsetRadius: random(CONTACT_OFFSET_RADIUS),
    offsetAngle: random(Math.PI * 2),
    scale: Math.fround(1 + random(0.5)),
    angle: random(Math.PI * 2),
    lightRadius: Math.fround(
      Math.fround(AIR_LIGHTNING_CONTACT_LIGHT_BASE_RADIUS)
        + random(AIR_LIGHTNING_CONTACT_LIGHT_RADIUS_JITTER),
    ),
  }
}

function degreesToRadians(degrees: number): number {
  return degrees * Math.PI / 180
}

function normalizeDegrees(degrees: number): number {
  return (degrees % 360 + 360) % 360
}

function normalized(direction: NativeAirPoint): NativeAirPoint {
  const length = Math.hypot(direction.x, direction.y)
  return length > 0
    ? { x: direction.x / length, y: direction.y / length }
    : { x: 1, y: 0 }
}

export function nativeAirPresentationRandom(
  id: number,
  salt: number,
): (maximum?: number) => number {
  const source = nativeAirPresentationRandomSource(id, salt)
  return (maximum = 1) => source.float(maximum)
}

function nativeAirPresentationRandomSource(
  id: number,
  salt: number,
): NativeAirPresentationRandomSource {
  let value = mix32((id ^ salt) >>> 0)
  const nextWord = () => {
    value ^= value << 13
    value ^= value >>> 17
    value ^= value << 5
    value >>>= 0
    return value
  }
  return {
    float: (maximum = 1) => nativeRandomFloatFromSemanticWord(nextWord(), maximum),
    int: (exclusiveBound) => nativeRandomIntFromSemanticWord(nextWord(), exclusiveBound),
  }
}

function airRandomFloat(random: NativeAirRandomSource, maximum = 1): number {
  return typeof random === 'function'
    ? Math.fround(Math.fround(random()) * Math.fround(maximum))
    : random.float(maximum)
}

function airRandomInt(random: NativeAirRandomSource, exclusiveBound: number): number {
  return typeof random === 'function'
    ? boundedRandomIndex(random(), exclusiveBound)
    : random.int(exclusiveBound)
}

function boundedRandomIndex(sample: number, exclusiveBound: number): number {
  return Math.min(exclusiveBound - 1, Math.floor(sample * exclusiveBound))
}

function mix32(value: number): number {
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d) >>> 0
  value ^= value >>> 15
  value = Math.imul(value, 0x846ca68b) >>> 0
  return (value ^ (value >>> 16)) >>> 0
}

function semanticSeed(id: number, birthTick: number, salt: number): number {
  return nativeSignedAbs32(nativeAirMixRaw(
    (id ^ Math.imul(birthTick + 1, 0x9e3779b1) ^ salt) >>> 0,
  ))
}

function nativeAirMixRaw(value: number): number {
  let mixed = value >>> 0
  mixed = (mixed ^ (mixed << 21)) >>> 0
  mixed = (mixed ^ (mixed >>> 11)) >>> 0
  mixed = (mixed ^ (mixed << 4)) >>> 0
  return Math.imul(mixed, 0x0a67cfcf) >>> 0
}

function nativeSignedAbs32(value: number): number {
  return (value | 0) >= 0
    ? value >>> 0
    : (0x80000000 - (value & 0x7fffffff)) >>> 0
}
