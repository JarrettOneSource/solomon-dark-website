export const AIR_LIGHTNING_BODY_LIFETIME_TICKS = 2
export const AIR_LIGHTNING_CONTACT_LIFETIME_TICKS = 5
export const AIR_LIGHTNING_ENHANCED_SAMPLE_SPACING = 15
export const AIR_LIGHTNING_SPLINE_DURATION = 2
export const AIR_LIGHTNING_MAX_PARAMETER_STEP = 0.5
export const AIR_LIGHTNING_FAST_INVERSE_SQRT_MAGIC = 0x5f3759df
export const AIR_LIGHTNING_CORONA_CIRCLE_RECORD = 110
export const AIR_LIGHTNING_CORONA_FORK_RECORDS = [1836, 1837, 1838, 1839] as const
export const AIR_LIGHTNING_CONTACT_LIGHT_BASE_RADIUS = 1
export const AIR_LIGHTNING_CONTACT_LIGHT_RADIUS_JITTER = 0.75
export const AIR_LIGHTNING_CONTACT_LIGHT_BASE_INTENSITY = 1
export const AIR_LIGHTNING_CONTACT_LIGHT_INTENSITY_DELTA = Math.fround(-0.05)

const AIR_LIGHTNING_RIBBON_RECORD = 44
const AIR_LIGHTNING_BASE_WIDTH = 25
const AIR_LIGHTNING_PRIMARY_WAVE = 25
const AIR_LIGHTNING_SECONDARY_WAVE = 12
const AIR_LIGHTNING_RANDOM_ANGLE_DEGREES = 65
const AIR_LIGHTNING_RANDOM_RADIUS = 30
const CONTACT_ALPHA_LEVELS = [1, 0.8, 0.6, 0.4, 0.2] as const
const CONTACT_OFFSET_RADIUS = 10
const CORONA_ANGLE_STEP_RADIANS = Math.PI / 180
const SPLINE_NORMAL_DELTA = 0.001
const FLOAT_BITS = new DataView(new ArrayBuffer(4))

export interface NativeAirPoint {
  x: number
  y: number
}

export interface NativeAirRibbonLayer {
  alpha: number
  indices: Uint32Array
  parameterSamples: Float32Array
  phaseOffset: number
  textureRecord: 44
  tint: number
  uvs: Float32Array
  vertices: Float32Array
  width: number
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
  intensity: number
  multipleShadows: false
  position: NativeAirPoint
  radius: number
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

export interface NativeAirLightningInput {
  ageTicks: number
  direction: NativeAirPoint
  id: number
  reach: number
}

export interface NativeAirContactLightSourceInput extends NativeAirLightningInput {
  origin: NativeAirPoint
}

export interface NativeAirContactLightInput {
  ageTicks: number
  id: number
  position: NativeAirPoint
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
  const direction = normalized(input.direction)
  const source = { x: 0, y: 0 }
  const endpoint = {
    x: direction.x * input.reach,
    y: direction.y * input.reach,
  }
  const midpoint = {
    x: endpoint.x * 0.5,
    y: endpoint.y * 0.5,
  }
  const points = [source, midpoint, endpoint] as const
  const basePhaseDegrees = -3 * input.id
  const contactSamples = nativeContactSamples(input.id)
  const contactCenter = {
    x: endpoint.x + Math.cos(contactSamples.offsetAngle) * contactSamples.offsetRadius,
    y: endpoint.y + Math.sin(contactSamples.offsetAngle) * contactSamples.offsetRadius,
  }
  const contactAngle = contactSamples.angle
    + nativeAge * CORONA_ANGLE_STEP_RADIANS

  return {
    body: nativeAge < AIR_LIGHTNING_BODY_LIFETIME_TICKS
      ? {
          layers: [
            buildRibbon(points, input.id, 1, basePhaseDegrees, 0, 0xffffff, 1),
            buildRibbon(points, input.id, 0.75, basePhaseDegrees, 15, 0x00ffff, 0.5),
          ],
        }
      : null,
    contactCorona: buildCorona(
      contactCenter,
      CONTACT_ALPHA_LEVELS[nativeAge] ?? 0,
      contactSamples.scale,
      contactAngle,
      randomStream(input.id, 0x46414445 ^ nativeAge),
    ),
    contactLight: buildNativeAirContactLightPlan({
      ageTicks: nativeAge,
      id: input.id,
      position: contactCenter,
    }),
    endpoint,
    midpoint,
    source,
    sourceCorona: nativeAge < 1
      ? sourceCorona(input.id, source)
      : null,
  }
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
  if (nativeAge >= AIR_LIGHTNING_CONTACT_LIFETIME_TICKS) return null

  let intensity = Math.fround(AIR_LIGHTNING_CONTACT_LIGHT_BASE_INTENSITY)
  for (let tick = 0; tick < nativeAge; tick += 1) {
    intensity = Math.fround(intensity + AIR_LIGHTNING_CONTACT_LIGHT_INTENSITY_DELTA)
  }

  return {
    intensity: Math.min(intensity, AIR_LIGHTNING_CONTACT_LIGHT_BASE_INTENSITY),
    multipleShadows: false,
    position: input.position,
    radius: nativeContactSamples(input.id).lightRadius,
  }
}

export function buildNativeAirContactLightSource(
  input: NativeAirContactLightSourceInput,
): NativeAirContactLightPlan | null {
  const direction = normalized(input.direction)
  const samples = nativeContactSamples(input.id)
  const light = buildNativeAirContactLightPlan({
    ageTicks: input.ageTicks,
    id: input.id,
    position: {
      x: direction.x * input.reach
        + Math.cos(samples.offsetAngle) * samples.offsetRadius,
      y: direction.y * input.reach
        + Math.sin(samples.offsetAngle) * samples.offsetRadius,
    },
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

function buildRibbon(
  points: readonly [NativeAirPoint, NativeAirPoint, NativeAirPoint],
  id: number,
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
  const random = randomStream(id, 0x52494242 ^ phaseOffset)
  const phaseDegrees = basePhaseDegrees + phaseOffset

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

      let randomAngle = random() * AIR_LIGHTNING_RANDOM_ANGLE_DEGREES
      if (random() < 0.5) randomAngle = -randomAngle
      const randomRadius = random() * AIR_LIGHTNING_RANDOM_RADIUS * envelope
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
    const v = pair % 2
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
    indices,
    parameterSamples,
    phaseOffset,
    textureRecord: AIR_LIGHTNING_RIBBON_RECORD,
    tint,
    uvs,
    vertices,
    width,
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
  const random = randomStream(id, 0x534f5552)
  const scale = 1 + random() * 0.5
  const angle = random() * Math.PI * 2
  return buildCorona(source, 1, scale, angle, randomStream(id, 0x474c4f57))
}

function buildCorona(
  center: NativeAirPoint,
  alpha: number,
  scale: number,
  angle: number,
  random: () => number,
): NativeAirCoronaPlan {
  const pulseScale = (Math.abs(Math.sin(angle * 15)) * 0.15 + 3.5) * scale
  const firstForkIndex = Math.floor(random() * AIR_LIGHTNING_CORONA_FORK_RECORDS.length)
  const secondForkIndex = AIR_LIGHTNING_CORONA_FORK_RECORDS.length - 1 - firstForkIndex
  return {
    alpha,
    center,
    circles: [
      { alpha: 0.2 + random() * 0.25, record: 110, scale: pulseScale, tint: 0x80bfbf },
      { alpha: 0.5, record: 110, scale: pulseScale * 0.75, tint: 0x80bfbf },
      { alpha: 0.5, record: 110, scale: pulseScale * 0.5, tint: 0x80bfbf },
      { alpha: 0.25, record: 110, scale: pulseScale * (0.2 + random() * 0.2), tint: 0x80bfbf },
    ],
    forks: [
      {
        alpha: 1,
        record: AIR_LIGHTNING_CORONA_FORK_RECORDS[firstForkIndex],
        rotation: angle,
        scale: scale * (0.75 + random() * 0.25),
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
  const random = randomStream(id, 0x434f4e54)
  return {
    offsetRadius: random() * CONTACT_OFFSET_RADIUS,
    offsetAngle: random() * Math.PI * 2,
    scale: 1 + random() * 0.5,
    angle: random() * Math.PI * 2,
    lightRadius: Math.fround(
      AIR_LIGHTNING_CONTACT_LIGHT_BASE_RADIUS
        + random() * AIR_LIGHTNING_CONTACT_LIGHT_RADIUS_JITTER,
    ),
  }
}

function degreesToRadians(degrees: number): number {
  return degrees * Math.PI / 180
}

function normalized(direction: NativeAirPoint): NativeAirPoint {
  const length = Math.hypot(direction.x, direction.y)
  return length > 0
    ? { x: direction.x / length, y: direction.y / length }
    : { x: 1, y: 0 }
}

function randomStream(id: number, salt: number): () => number {
  let value = mix32((id ^ salt) >>> 0)
  return () => {
    value ^= value << 13
    value ^= value >>> 17
    value ^= value << 5
    value >>>= 0
    return value / 0x1_0000_0000
  }
}

function mix32(value: number): number {
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d) >>> 0
  value ^= value >>> 15
  value = Math.imul(value, 0x846ca68b) >>> 0
  return (value ^ (value >>> 16)) >>> 0
}
