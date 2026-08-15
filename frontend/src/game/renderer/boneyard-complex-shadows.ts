import type { Vec2 } from '../../editor/model.ts'
import {
  NATIVE_LIGHT_OUTER_DISTANCE,
  NATIVE_LIGHT_VERTICAL_SCALE,
  nativeBoneyardLightScalar,
  type NativeBoneyardLightLookup,
  type NativeBoneyardLightSamples,
  type NativeBoneyardLightSource,
} from './boneyard-lighting.ts'

export interface NativeBoneyardComplexShadowCaster {
  id: string
  /** Object-local native authored vertices in their original order. */
  outline: readonly Vec2[]
  position: Vec2
  program?: NativeBoneyardShadowProgram
}

export type NativeBoneyardShadowProgram =
  | {
      construction: 'gate' | 'intact'
      end: Vec2
      kind: 'fence-grate'
      start: Vec2
    }
  | {
      end: Vec2
      kind: 'rails'
      start: Vec2
    }
  | {
      end: Vec2
      kind: 'wall'
      start: Vec2
    }

export interface NativeBoneyardComplexShadowRecord {
  baseAlpha: number
  behindScalar: number
  direction: Vec2
  distanceFraction: number
  projectionDistance: number
  sourcePosition: Vec2
  sourceRadius: number
}

export interface NativeBoneyardProjectedShadowEdge {
  baseAlpha: number
  baseEnd: Vec2
  baseStart: Vec2
  tipAlpha: number
  tipEnd: Vec2
  tipStart: Vec2
}

export interface NativeBoneyardProjectedShadowMesh {
  alphas: Float32Array
  indices: Uint32Array
  vertices: Float32Array
}

export interface NativeBoneyardFenceGrateShadowPlan {
  bars: readonly NativeBoneyardProjectedShadowEdge[]
  rail: {
    alpha: number
    end: Vec2
    start: Vec2
    width: 4
  }
}

export interface NativeBoneyardRailShadowPlan {
  alpha: number
  end: Vec2
  start: Vec2
  width: 10
}

interface NativeBoneyardLineShadowPlan {
  alpha: number
  end: Vec2
  start: Vec2
  width: number
}

export function nativeBoneyardPackedShadowAlpha(alpha: number): number {
  return Math.trunc(Math.min(1, Math.max(0, alpha)) * 255) / 255
}

export function nativeBoneyardShadowAlphaUv(alpha: number): number {
  const packedByte = Math.trunc(Math.min(1, Math.max(0, alpha)) * 255)
  return (packedByte + 0.5) / 256
}

export function nativeBoneyardShadowAlphaRampPixels(): Uint8Array {
  const pixels = new Uint8Array(256 * 4)
  for (let alpha = 0; alpha < 256; alpha += 1) {
    pixels[alpha * 4 + 3] = alpha
  }
  return pixels
}

export class NativeBoneyardShadowMeshBuffers {
  indexRevision = 0
  indices: Uint32Array
  positions: Float32Array
  quadCapacity: number
  quadCount = 0
  uvs: Float32Array

  constructor(initialQuadCapacity = 1) {
    this.quadCapacity = nextPowerOfTwo(Math.max(1, initialQuadCapacity))
    this.positions = new Float32Array(this.quadCapacity * 8)
    this.uvs = new Float32Array(this.quadCapacity * 8)
    this.indices = new Uint32Array(this.quadCapacity * 6)
  }

  write(edges: readonly NativeBoneyardProjectedShadowEdge[]): boolean {
    const previousQuadCount = this.quadCount
    const grew = this.ensureCapacity(edges.length)
    const topologyChanged = grew || previousQuadCount !== edges.length
    this.quadCount = edges.length
    edges.forEach((edge, quadIndex) => {
      const vertexOffset = quadIndex * 8
      this.positions[vertexOffset] = edge.baseStart.x
      this.positions[vertexOffset + 1] = edge.baseStart.y
      this.positions[vertexOffset + 2] = edge.baseEnd.x
      this.positions[vertexOffset + 3] = edge.baseEnd.y
      this.positions[vertexOffset + 4] = edge.tipStart.x
      this.positions[vertexOffset + 5] = edge.tipStart.y
      this.positions[vertexOffset + 6] = edge.tipEnd.x
      this.positions[vertexOffset + 7] = edge.tipEnd.y
      const baseUv = nativeBoneyardShadowAlphaUv(edge.baseAlpha)
      const tipUv = nativeBoneyardShadowAlphaUv(edge.tipAlpha)
      this.uvs[vertexOffset] = baseUv
      this.uvs[vertexOffset + 1] = 0.5
      this.uvs[vertexOffset + 2] = baseUv
      this.uvs[vertexOffset + 3] = 0.5
      this.uvs[vertexOffset + 4] = tipUv
      this.uvs[vertexOffset + 5] = 0.5
      this.uvs[vertexOffset + 6] = tipUv
      this.uvs[vertexOffset + 7] = 0.5
      if (topologyChanged) {
        const indexOffset = quadIndex * 6
        const vertexIndex = quadIndex * 4
        this.indices[indexOffset] = vertexIndex
        this.indices[indexOffset + 1] = vertexIndex + 1
        this.indices[indexOffset + 2] = vertexIndex + 2
        this.indices[indexOffset + 3] = vertexIndex + 1
        this.indices[indexOffset + 4] = vertexIndex + 3
        this.indices[indexOffset + 5] = vertexIndex + 2
      }
    })
    const usedPositions = edges.length * 8
    const fillX = edges[0]?.baseStart.x ?? 0
    const fillY = edges[0]?.baseStart.y ?? 0
    for (let index = usedPositions; index < this.positions.length; index += 2) {
      this.positions[index] = fillX
      this.positions[index + 1] = fillY
      this.uvs[index] = 0.5 / 256
      this.uvs[index + 1] = 0.5
    }
    if (topologyChanged) {
      this.indices.fill(0, edges.length * 6)
      this.indexRevision += 1
    }
    return grew
  }

  private ensureCapacity(required: number): boolean {
    if (required <= this.quadCapacity) return false
    this.quadCapacity = nextPowerOfTwo(required)
    this.positions = new Float32Array(this.quadCapacity * 8)
    this.uvs = new Float32Array(this.quadCapacity * 8)
    this.indices = new Uint32Array(this.quadCapacity * 6)
    return true
  }
}

export function nativeBoneyardLineShadowEdge(
  line: NativeBoneyardLineShadowPlan,
): NativeBoneyardProjectedShadowEdge {
  const dx = line.end.x - line.start.x
  const dy = line.end.y - line.start.y
  const length = Math.hypot(dx, dy)
  const halfWidthScale = length > 0 ? line.width / 2 / length : 0
  const perpendicular = {
    x: -dy * halfWidthScale,
    y: dx * halfWidthScale,
  }
  return {
    baseAlpha: line.alpha,
    baseEnd: {
      x: line.start.x + perpendicular.x,
      y: line.start.y + perpendicular.y,
    },
    baseStart: {
      x: line.start.x - perpendicular.x,
      y: line.start.y - perpendicular.y,
    },
    tipAlpha: line.alpha,
    tipEnd: {
      x: line.end.x + perpendicular.x,
      y: line.end.y + perpendicular.y,
    },
    tipStart: {
      x: line.end.x - perpendicular.x,
      y: line.end.y - perpendicular.y,
    },
  }
}

const NATIVE_LIGHT_OUTER_DISTANCE_SQUARED = NATIVE_LIGHT_OUTER_DISTANCE ** 2
export const NATIVE_FENCE_SHADOW_END_INSET = 12
export const NATIVE_FENCE_SHADOW_BAR_STEP = 13.333333015441895
export const NATIVE_GATE_SHADOW_END_INSET = 4
export const NATIVE_GATE_SHADOW_BAR_DIVISOR = 4.5
export const NATIVE_FENCE_SHADOW_NEAR_HALF_WIDTH = 2
export const NATIVE_FENCE_SHADOW_FAR_HALF_WIDTH = 8
export const NATIVE_FENCE_SHADOW_RAIL_WIDTH = 4
export const NATIVE_RAIL_SHADOW_END_INSET = 4
export const NATIVE_RAIL_SHADOW_WIDTH = 10
const NATIVE_TREE_COMPLEX_SHADOW_OUTLINES: readonly (readonly Vec2[])[] = [
  [{ x: -2, y: 12 }, { x: 18, y: 9 }, { x: 17, y: -8 }, { x: -5, y: -4 }],
  [{ x: 3, y: 14 }, { x: 14, y: -3 }, { x: -4, y: -13 }, { x: -19, y: 3 }],
  [{ x: 1, y: 9 }, { x: 15, y: -2 }, { x: 7, y: -13 }, { x: -15, y: -3 }],
  [{ x: 7, y: 7 }, { x: 27, y: 1 }, { x: 24, y: -16 }, { x: 4, y: -11 }],
  [{ x: 5, y: 10 }, { x: 12, y: -8 }, { x: -3, y: -17 }, { x: -20, y: -1 }],
  [{ x: -20, y: 8 }, { x: -12, y: -2 }, { x: 7, y: 6 }, { x: 0, y: 17 }],
  [
    { x: -19.5, y: 12.5 },
    { x: -19.5, y: -12.5 },
    { x: 19.5, y: -12.5 },
    { x: 19.5, y: 12.5 },
  ],
  [{ x: -6, y: 10 }, { x: -6, y: -1 }, { x: 7, y: -1 }, { x: 8, y: 10 }],
  [{ x: -6, y: 10 }, { x: -6, y: -1 }, { x: 7, y: -1 }, { x: 8, y: 10 }],
  [
    { x: -1.5, y: 1.5 },
    { x: -1.5, y: -1.5 },
    { x: 1.5, y: -1.5 },
    { x: 1.5, y: 1.5 },
  ],
  [
    { x: -1.5, y: 1.5 },
    { x: -1.5, y: -1.5 },
    { x: 1.5, y: -1.5 },
    { x: 1.5, y: 1.5 },
  ],
  [
    { x: 0.5, y: 2.5 },
    { x: -2.5, y: -0.5 },
    { x: 0.5, y: -3.5 },
    { x: 3.5, y: -0.5 },
  ],
  [
    { x: 0.5, y: 2.5 },
    { x: -2.5, y: -0.5 },
    { x: 0.5, y: -3.5 },
    { x: 3.5, y: -0.5 },
  ],
  [
    { x: -1.5, y: 1.5 },
    { x: -1.5, y: -1.5 },
    { x: 1.5, y: -1.5 },
    { x: 1.5, y: 1.5 },
  ],
  [
    { x: -1.5, y: 1.5 },
    { x: -1.5, y: -1.5 },
    { x: 1.5, y: -1.5 },
    { x: 1.5, y: 1.5 },
  ],
]

/** Exact Tree shape selected by `0x0081B910 + mainVariant * 0x34`. */
export function nativeBoneyardTreeComplexShadowOutline(mainVariant: number): Vec2[] {
  const outline = NATIVE_TREE_COMPLEX_SHADOW_OUTLINES[mainVariant]
  if (!outline) {
    throw new RangeError(
      `Unsupported native Tree complex-shadow variant ${mainVariant}.`,
    )
  }
  return outline.map((point) => ({ ...point }))
}

export function nativeBoneyardComplexShadowRecords(
  caster: NativeBoneyardComplexShadowCaster,
  sources: NativeBoneyardLightSamples,
  presentationFrame: number,
): NativeBoneyardComplexShadowRecord[] {
  const records: NativeBoneyardComplexShadowRecord[] = []
  const casterSeed = stableStringHash(caster.id)
  const lookup = nativeLightLookup(sources)
  const sourceIndices = lookup?.sourceIndicesAt(caster.position)
  const sourceCount = sourceIndices?.length ?? (sources as readonly NativeBoneyardLightSource[]).length
  for (let ordinal = 0; ordinal < sourceCount; ordinal += 1) {
    const sourceIndex = sourceIndices?.[ordinal] ?? ordinal
    const source = lookup
      ? lookup.acceptedSources[sourceIndex]!
      : (sources as readonly NativeBoneyardLightSource[])[sourceIndex]!
    if (!source.castsDirectionalShadow || source.radius <= 0) continue
    const worldDx = caster.position.x - source.position.x
    const worldDy = caster.position.y - source.position.y
    const dx = worldDx / source.radius
    const dy = worldDy / (NATIVE_LIGHT_VERTICAL_SCALE * source.radius)
    const distanceSquared = dx * dx + dy * dy
    if (distanceSquared >= NATIVE_LIGHT_OUTER_DISTANCE_SQUARED) continue

    const worldDistance = Math.hypot(worldDx, worldDy)
    const direction = worldDistance === 0
      ? { x: 0, y: 0 }
      : { x: worldDx / worldDistance, y: worldDy / worldDistance }
    const behindPosition = {
      x: caster.position.x + direction.x,
      y: caster.position.y + direction.y,
    }
    records.push({
      baseAlpha: 1,
      behindScalar: nativeBoneyardLightScalar(behindPosition, sources),
      direction,
      distanceFraction: distanceSquared / NATIVE_LIGHT_OUTER_DISTANCE_SQUARED,
      projectionDistance: (
        NATIVE_LIGHT_OUTER_DISTANCE
        - presentationRandom(casterSeed, source, sourceIndex, presentationFrame)
      ) * source.radius,
      sourcePosition: { ...source.position },
      sourceRadius: source.radius,
    })
  }

  if (records.length > 1) {
    for (let recordIndex = 0; recordIndex < records.length; recordIndex += 1) {
      const record = records[recordIndex]
      for (let otherIndex = 0; otherIndex < records.length; otherIndex += 1) {
        if (otherIndex === recordIndex) continue
        const other = records[otherIndex]
        const directionDot = (
          record.direction.x * other.direction.x
          + record.direction.y * other.direction.y
        )
        record.baseAlpha *= Math.max(directionDot, other.distanceFraction)
      }
      record.baseAlpha = clampUnit(record.baseAlpha)
    }
  }
  return records
}

function nativeLightLookup(
  sources: NativeBoneyardLightSamples,
): NativeBoneyardLightLookup | null {
  return !Array.isArray(sources) && 'sourceIndicesAt' in sources
    ? sources
    : null
}

export function nativeBoneyardProjectedShadowEdges(
  caster: NativeBoneyardComplexShadowCaster,
  record: NativeBoneyardComplexShadowRecord,
): NativeBoneyardProjectedShadowEdge[] {
  if (caster.outline.length < 3) return []
  const tipAlpha = clampUnit(
    ((1 - record.behindScalar) * (1 - record.distanceFraction)) ** 3,
  )
  const edges: NativeBoneyardProjectedShadowEdge[] = []
  for (let index = 0; index < caster.outline.length; index += 1) {
    const localStart = caster.outline[index]
    const localEnd = caster.outline[(index + 1) % caster.outline.length]
    const baseStart = add(caster.position, localStart)
    const baseEnd = add(caster.position, localEnd)
    const edgeX = baseEnd.x - baseStart.x
    const edgeY = baseEnd.y - baseStart.y
    const edgeLength = Math.hypot(edgeX, edgeY)
    if (edgeLength === 0) continue
    const outward = { x: edgeY / edgeLength, y: -edgeX / edgeLength }
    const midpoint = {
      x: (baseStart.x + baseEnd.x) / 2,
      y: (baseStart.y + baseEnd.y) / 2,
    }
    const sourceDirection = {
      x: midpoint.x - record.sourcePosition.x,
      y: midpoint.y - record.sourcePosition.y,
    }
    if (sourceDirection.x * outward.x + sourceDirection.y * outward.y <= 0) continue
    edges.push({
      baseAlpha: record.baseAlpha,
      baseEnd,
      baseStart,
      tipAlpha,
      tipEnd: projectAway(baseEnd, record.sourcePosition, record.projectionDistance),
      tipStart: projectAway(baseStart, record.sourcePosition, record.projectionDistance),
    })
  }
  return edges
}

export function nativeBoneyardProjectedShadowMesh(
  edge: NativeBoneyardProjectedShadowEdge,
): NativeBoneyardProjectedShadowMesh {
  return {
    alphas: Float32Array.from([
      edge.baseAlpha,
      edge.baseAlpha,
      edge.tipAlpha,
      edge.tipAlpha,
    ]),
    indices: Uint32Array.from([0, 1, 2, 1, 3, 2]),
    vertices: Float32Array.from([
      edge.baseStart.x, edge.baseStart.y,
      edge.baseEnd.x, edge.baseEnd.y,
      edge.tipStart.x, edge.tipStart.y,
      edge.tipEnd.x, edge.tipEnd.y,
    ]),
  }
}

export function nativeBoneyardFenceGrateShadows(
  program: Extract<NativeBoneyardShadowProgram, { kind: 'fence-grate' }>,
  record: NativeBoneyardComplexShadowRecord,
): NativeBoneyardFenceGrateShadowPlan {
  const dx = Math.fround(program.end.x - program.start.x)
  const dy = Math.fround(program.end.y - program.start.y)
  const length = nativeStoredLength(dx, dy)
  const endInset = program.construction === 'gate'
    ? NATIVE_GATE_SHADOW_END_INSET
    : NATIVE_FENCE_SHADOW_END_INSET
  if (length <= endInset * 2) {
    return {
      bars: [],
      rail: { alpha: 0, end: { ...program.end }, start: { ...program.start }, width: 4 },
    }
  }
  const inverseLength = Math.fround(1 / length)
  const along = {
    x: Math.fround(dx * inverseLength),
    y: Math.fround(dy * inverseLength),
  }
  const shortStart = {
    x: Math.fround(program.start.x + Math.fround(along.x * endInset)),
    y: Math.fround(program.start.y + Math.fround(along.y * endInset)),
  }
  const shortEnd = {
    x: Math.fround(program.end.x - Math.fround(along.x * endInset)),
    y: Math.fround(program.end.y - Math.fround(along.y * endInset)),
  }
  const shortDx = Math.fround(shortEnd.x - shortStart.x)
  const shortDy = Math.fround(shortEnd.y - shortStart.y)
  const shortLength = nativeStoredLength(shortDx, shortDy)
  const nominalStep = program.construction === 'gate'
    ? Math.fround(shortLength / NATIVE_GATE_SHADOW_BAR_DIVISOR)
    : NATIVE_FENCE_SHADOW_BAR_STEP
  const step = {
    x: Math.fround(along.x * nominalStep),
    y: Math.fround(along.y * nominalStep),
  }
  const storedStepLength = nativeStoredLength(step.x, step.y)
  const count = Math.max(1, Math.trunc(shortLength / storedStepLength) + 1)
  const bars = Array.from({ length: count }, (_, index) => {
    const center = {
      x: Math.fround(shortStart.x + Math.fround(step.x * (index + 0.5))),
      y: Math.fround(shortStart.y + Math.fround(step.y * (index + 0.5))),
    }
    const away = normalizedFrom(record.sourcePosition, center)
    const perpendicular = { x: -away.y, y: away.x }
    const far = {
      x: center.x + away.x * record.projectionDistance,
      y: center.y + away.y * record.projectionDistance,
    }
    return {
      baseAlpha: record.baseAlpha,
      baseEnd: {
        x: center.x + perpendicular.x * NATIVE_FENCE_SHADOW_NEAR_HALF_WIDTH,
        y: center.y + perpendicular.y * NATIVE_FENCE_SHADOW_NEAR_HALF_WIDTH,
      },
      baseStart: {
        x: center.x - perpendicular.x * NATIVE_FENCE_SHADOW_NEAR_HALF_WIDTH,
        y: center.y - perpendicular.y * NATIVE_FENCE_SHADOW_NEAR_HALF_WIDTH,
      },
      tipAlpha: 0,
      tipEnd: {
        x: far.x + perpendicular.x * NATIVE_FENCE_SHADOW_FAR_HALF_WIDTH,
        y: far.y + perpendicular.y * NATIVE_FENCE_SHADOW_FAR_HALF_WIDTH,
      },
      tipStart: {
        x: far.x - perpendicular.x * NATIVE_FENCE_SHADOW_FAR_HALF_WIDTH,
        y: far.y - perpendicular.y * NATIVE_FENCE_SHADOW_FAR_HALF_WIDTH,
      },
    }
  })
  return {
    bars,
    rail: {
      alpha: clampUnit(0.1 * record.behindScalar + 0.9 * record.baseAlpha),
      end: projectAway(shortEnd, record.sourcePosition, record.projectionDistance * 0.125),
      start: projectAway(shortStart, record.sourcePosition, record.projectionDistance * 0.125),
      width: NATIVE_FENCE_SHADOW_RAIL_WIDTH,
    },
  }
}

export function nativeBoneyardRailsShadows(
  program: Extract<NativeBoneyardShadowProgram, { kind: 'rails' }>,
  record: NativeBoneyardComplexShadowRecord,
): readonly [NativeBoneyardRailShadowPlan, NativeBoneyardRailShadowPlan] {
  const dx = Math.fround(program.end.x - program.start.x)
  const dy = Math.fround(program.end.y - program.start.y)
  const length = nativeStoredLength(dx, dy)
  const inverseLength = length > 0 ? Math.fround(1 / length) : 0
  const along = {
    x: Math.fround(dx * inverseLength),
    y: Math.fround(dy * inverseLength),
  }
  const start = {
    x: Math.fround(program.start.x + Math.fround(along.x * NATIVE_RAIL_SHADOW_END_INSET)),
    y: Math.fround(program.start.y + Math.fround(along.y * NATIVE_RAIL_SHADOW_END_INSET)),
  }
  const shortenedEnd = {
    x: Math.fround(program.end.x - Math.fround(along.x * NATIVE_RAIL_SHADOW_END_INSET)),
    y: Math.fround(program.end.y - Math.fround(along.y * NATIVE_RAIL_SHADOW_END_INSET)),
  }
  const shortenedLength = nativeStoredLength(
    Math.fround(shortenedEnd.x - start.x),
    Math.fround(shortenedEnd.y - start.y),
  )
  const step = {
    x: Math.fround(along.x * NATIVE_FENCE_SHADOW_BAR_STEP),
    y: Math.fround(along.y * NATIVE_FENCE_SHADOW_BAR_STEP),
  }
  const stepLength = nativeStoredLength(step.x, step.y)
  const count = stepLength > 0
    ? Math.trunc(shortenedLength / stepLength) + 1
    : 0
  const farBaseline = {
    x: Math.fround(start.x + Math.fround(count * step.x)),
    y: Math.fround(start.y + Math.fround(count * step.y)),
  }
  const alpha = clampUnit(0.9 * record.baseAlpha + 0.1 * record.behindScalar)
  const line = (divisor: number): NativeBoneyardRailShadowPlan => ({
    alpha,
    end: projectByDivisor(farBaseline, record.sourcePosition, divisor),
    start: projectByDivisor(start, record.sourcePosition, divisor),
    width: NATIVE_RAIL_SHADOW_WIDTH,
  })
  return [line(5), line(1.5)]
}

export function nativeBoneyardWallShadow(
  program: Extract<NativeBoneyardShadowProgram, { kind: 'wall' }>,
  record: NativeBoneyardComplexShadowRecord,
): NativeBoneyardProjectedShadowEdge {
  return {
    baseAlpha: record.baseAlpha,
    baseEnd: { ...program.end },
    baseStart: { ...program.start },
    tipAlpha: clampUnit(
      ((1 - record.behindScalar) * (1 - record.distanceFraction)) ** 3,
    ),
    tipEnd: projectAway(program.end, record.sourcePosition, record.projectionDistance),
    tipStart: projectAway(program.start, record.sourcePosition, record.projectionDistance),
  }
}

function nativeStoredLength(dx: number, dy: number): number {
  return Math.fround(Math.sqrt(Math.fround(
    Math.fround(dx * dx) + Math.fround(dy * dy),
  )))
}

function nextPowerOfTwo(value: number): number {
  return 2 ** Math.ceil(Math.log2(value))
}

function projectAway(point: Vec2, source: Vec2, distance: number): Vec2 {
  const dx = point.x - source.x
  const dy = point.y - source.y
  const length = Math.hypot(dx, dy)
  if (length === 0) return { ...point }
  return {
    x: point.x + dx / length * distance,
    y: point.y + dy / length * distance,
  }
}

function projectByDivisor(point: Vec2, source: Vec2, divisor: number): Vec2 {
  return {
    x: point.x - (source.x - point.x) / divisor,
    y: point.y - (source.y - point.y) / divisor,
  }
}

function normalizedFrom(source: Vec2, destination: Vec2): Vec2 {
  const dx = destination.x - source.x
  const dy = destination.y - source.y
  const length = Math.hypot(dx, dy)
  return length === 0 ? { x: 0, y: 0 } : { x: dx / length, y: dy / length }
}

function presentationRandom(
  casterSeed: number,
  source: NativeBoneyardLightSource,
  sourceIndex: number,
  presentationFrame: number,
): number {
  let value = mixPresentationSeed(casterSeed ^ Math.trunc(presentationFrame))
  value = mixPresentationSeed(value ^ sourceIndex)
  value = mixPresentationSeed(value ^ float32Bits(source.position.x))
  value = mixPresentationSeed(value ^ float32Bits(source.position.y))
  value = mixPresentationSeed(value ^ float32Bits(source.radius))
  return ((value ^ (value >>> 15)) >>> 0) / 0x1_0000_0000
}

const PRESENTATION_FLOAT = new Float32Array(1)
const PRESENTATION_BITS = new Uint32Array(PRESENTATION_FLOAT.buffer)

function float32Bits(value: number): number {
  PRESENTATION_FLOAT[0] = value
  return PRESENTATION_BITS[0]
}

function mixPresentationSeed(seed: number): number {
  let value = Math.imul(seed ^ (seed >>> 16), 0x21f0aaad) >>> 0
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97) >>> 0
  return value ^ (value >>> 15)
}

function stableStringHash(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193) >>> 0
  }
  return hash
}

function add(left: Vec2, right: Vec2): Vec2 {
  return { x: left.x + right.x, y: left.y + right.y }
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value))
}
