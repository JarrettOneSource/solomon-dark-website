import type {
  BoneyardBounds,
  BoneyardPoint,
  BoneyardRoad,
} from '../core-kernels/boneyard.ts'

export const WEB_ARENA_GROUND_TEXTURE_SIZE = 512

export interface WebArenaGroundMeshPlan {
  readonly colors: Uint8Array
  readonly indices: Uint32Array
  readonly positions: Float32Array
  readonly uvs: Float32Array
}

export function webArenaGroundMeshPlan(
  bounds: Readonly<BoneyardBounds>,
): WebArenaGroundMeshPlan {
  if (bounds.w <= 0 || bounds.h <= 0) {
    throw new RangeError('Web Arena ground requires positive bounds')
  }
  const left = Math.fround(bounds.x)
  const top = Math.fround(bounds.y)
  const right = Math.fround(bounds.x + bounds.w)
  const bottom = Math.fround(bounds.y + bounds.h)
  return Object.freeze({
    colors: new Uint8Array(16).fill(255),
    indices: Uint32Array.from([0, 1, 2, 1, 3, 2]),
    positions: Float32Array.from([
      left, top,
      right, top,
      left, bottom,
      right, bottom,
    ]),
    uvs: Float32Array.from([
      Math.fround(left / WEB_ARENA_GROUND_TEXTURE_SIZE),
      Math.fround(top / WEB_ARENA_GROUND_TEXTURE_SIZE),
      Math.fround(right / WEB_ARENA_GROUND_TEXTURE_SIZE),
      Math.fround(top / WEB_ARENA_GROUND_TEXTURE_SIZE),
      Math.fround(left / WEB_ARENA_GROUND_TEXTURE_SIZE),
      Math.fround(bottom / WEB_ARENA_GROUND_TEXTURE_SIZE),
      Math.fround(right / WEB_ARENA_GROUND_TEXTURE_SIZE),
      Math.fround(bottom / WEB_ARENA_GROUND_TEXTURE_SIZE),
    ]),
  })
}

export const NATIVE_ROAD_STYLE_PROGRAMS = Object.freeze([
  Object.freeze({ edgeInset: 30, halfWidth: 55, textureSize: 128, verticalUvScale: 0.800000011920929 }),
  Object.freeze({ edgeInset: 20, halfWidth: 45, textureSize: 128, verticalUvScale: 0.800000011920929 }),
  Object.freeze({ edgeInset: 20, halfWidth: 55, textureSize: 256, verticalUvScale: 0.800000011920929 }),
  Object.freeze({ edgeInset: 10, halfWidth: 45, textureSize: 128, verticalUvScale: 0.800000011920929 }),
  Object.freeze({ edgeInset: 10, halfWidth: 55, textureSize: 128, verticalUvScale: 0.800000011920929 }),
] as const)

export interface NativeRoadMeshPlan {
  readonly colors: Uint8Array
  readonly indices: Uint32Array
  readonly positions: Float32Array
  readonly sourceVertexCount: 18
  readonly style: number
  readonly uvs: Float32Array
}

interface NativeRoadSourceVertex extends BoneyardPoint {
  readonly alpha: number
}

export function nativeRoadEndpointAlphas(
  linkMask: BoneyardRoad['linkMask'],
): readonly [start: number, end: number] {
  if (linkMask === 0) return Object.freeze([1, 1])
  return Object.freeze([
    linkMask & 1 ? 1 : 0,
    linkMask & 2 ? 1 : 0,
  ])
}

export function nativeRoadMeshPlan(road: Readonly<BoneyardRoad>): NativeRoadMeshPlan {
  const style = road.style ?? 0
  const program = NATIVE_ROAD_STYLE_PROGRAMS[style]
  if (!program) throw new RangeError(`Road ${road.eid} has invalid native style ${style}`)
  const outer = road.quad?.length === 4
    ? road.quad.map(copyPoint)
    : nativeRoadQuad(
        road.points,
        Math.fround(road.startWidthScale ?? 1),
        Math.fround(road.endWidthScale ?? 1),
        program.halfWidth,
      )
  if (outer.length !== 4) throw new RangeError(`Road ${road.eid} requires four outer points`)
  const [startLeft, startRight, endLeft, endRight] = outer
  const [startAlpha, endAlpha] = nativeRoadEndpointAlphas(road.linkMask)
  const startInner = insetPair(startLeft, startRight, program.edgeInset)
  const endInner = insetPair(endLeft, endRight, program.edgeInset)
  const source: readonly NativeRoadSourceVertex[] = [
    vertex(startInner.left, startAlpha),
    vertex(startInner.right, startAlpha),
    vertex(endInner.left, endAlpha),
    vertex(startInner.right, startAlpha),
    vertex(endInner.left, endAlpha),
    vertex(endInner.right, endAlpha),

    vertex(startLeft, 0),
    vertex(startInner.left, startAlpha),
    vertex(endLeft, 0),
    vertex(startInner.left, startAlpha),
    vertex(endLeft, 0),
    vertex(endInner.left, endAlpha),

    vertex(startInner.right, startAlpha),
    vertex(startRight, 0),
    vertex(endInner.right, endAlpha),
    vertex(startRight, 0),
    vertex(endInner.right, endAlpha),
    vertex(endRight, 0),
  ]
  const unique: NativeRoadSourceVertex[] = []
  const indices: number[] = []
  for (const sourceVertex of source) {
    let index = unique.findIndex((candidate) => sameVertex(candidate, sourceVertex))
    if (index < 0) {
      index = unique.length
      unique.push(sourceVertex)
    }
    indices.push(index)
  }
  const positions = new Float32Array(unique.length * 2)
  const uvs = new Float32Array(unique.length * 2)
  const colors = new Uint8Array(unique.length * 4)
  unique.forEach((item, index) => {
    positions[index * 2] = item.x
    positions[index * 2 + 1] = item.y
    uvs[index * 2] = Math.fround(item.x / program.textureSize)
    uvs[index * 2 + 1] = Math.fround(
      Math.fround(item.y / program.textureSize) / program.verticalUvScale,
    )
    colors[index * 4] = 255
    colors[index * 4 + 1] = 255
    colors[index * 4 + 2] = 255
    colors[index * 4 + 3] = Math.round(item.alpha * 255)
  })
  return Object.freeze({
    colors,
    indices: Uint32Array.from(indices),
    positions,
    sourceVertexCount: 18,
    style,
    uvs,
  })
}

function nativeRoadQuad(
  points: readonly BoneyardPoint[],
  startScale: number,
  endScale: number,
  halfWidth: number,
): BoneyardPoint[] {
  if (points.length < 2) return []
  const start = points[0]!
  const end = points[1]!
  const dx = Math.fround(end.x - start.x)
  const dy = Math.fround(end.y - start.y)
  const lengthSquared = Math.fround(
    Math.fround(dx * dx) + Math.fround(dy * dy),
  )
  const length = lengthSquared === 0 ? 0 : Math.fround(Math.sqrt(lengthSquared))
  const unitX = length === 0 ? 0 : Math.fround(dx / length)
  const unitY = length === 0 ? 0 : Math.fround(dy / length)
  const startWidth = Math.fround(halfWidth * startScale)
  const endWidth = Math.fround(halfWidth * endScale)
  return [
    Object.freeze({
      x: Math.fround(start.x - Math.fround(unitY * startWidth)),
      y: Math.fround(start.y + Math.fround(unitX * startWidth)),
    }),
    Object.freeze({
      x: Math.fround(start.x + Math.fround(unitY * startWidth)),
      y: Math.fround(start.y - Math.fround(unitX * startWidth)),
    }),
    Object.freeze({
      x: Math.fround(end.x - Math.fround(unitY * endWidth)),
      y: Math.fround(end.y + Math.fround(unitX * endWidth)),
    }),
    Object.freeze({
      x: Math.fround(end.x + Math.fround(unitY * endWidth)),
      y: Math.fround(end.y - Math.fround(unitX * endWidth)),
    }),
  ]
}

function insetPair(
  left: Readonly<BoneyardPoint>,
  right: Readonly<BoneyardPoint>,
  inset: number,
): Readonly<{ left: BoneyardPoint; right: BoneyardPoint }> {
  const dx = Math.fround(right.x - left.x)
  const dy = Math.fround(right.y - left.y)
  const lengthSquared = Math.fround(
    Math.fround(dx * dx) + Math.fround(dy * dy),
  )
  const length = lengthSquared === 0 ? 0 : Math.fround(Math.sqrt(lengthSquared))
  const factor = length > 0 ? Math.fround(inset / length) : 0
  const insetX = Math.fround(dx * factor)
  const insetY = Math.fround(dy * factor)
  return Object.freeze({
    left: Object.freeze({
      x: Math.fround(left.x + insetX),
      y: Math.fround(left.y + insetY),
    }),
    right: Object.freeze({
      x: Math.fround(right.x - insetX),
      y: Math.fround(right.y - insetY),
    }),
  })
}

function copyPoint(point: Readonly<BoneyardPoint>): BoneyardPoint {
  return Object.freeze({ x: Math.fround(point.x), y: Math.fround(point.y) })
}

function vertex(
  point: Readonly<BoneyardPoint>,
  alpha: number,
): NativeRoadSourceVertex {
  return Object.freeze({ ...copyPoint(point), alpha: Math.fround(alpha) })
}

function sameVertex(
  left: Readonly<NativeRoadSourceVertex>,
  right: Readonly<NativeRoadSourceVertex>,
): boolean {
  return left.x === right.x && left.y === right.y && left.alpha === right.alpha
}
