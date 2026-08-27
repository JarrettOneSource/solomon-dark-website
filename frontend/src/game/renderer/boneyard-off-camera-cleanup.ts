import type {
  BoneyardBounds,
  BoneyardObject,
  BoneyardPoint,
  BoneyardSprite,
  BoneyardTerrain,
} from '../core-kernels/boneyard.ts'

export interface BoneyardOffCameraCleanupSources {
  readonly objects: readonly BoneyardObject[]
  readonly roads: readonly Readonly<{
    eid: string
    points: readonly BoneyardPoint[]
    quad?: readonly BoneyardPoint[]
  }>[]
  readonly sprites: readonly BoneyardSprite[]
  readonly terrain: readonly BoneyardTerrain[]
}

export interface BoneyardOffCameraCleanupPlan {
  readonly retainedCounts: Readonly<{
    objects: number
    roads: number
    sprites: number
    terrain: number
  }>
  readonly retiredSourceKeys: ReadonlySet<string>
}

export function boneyardCleanupBoundsOverlap(
  source: Readonly<BoneyardBounds>,
  target: Readonly<BoneyardBounds>,
): boolean {
  return source.x < target.x + target.w
    && source.y < target.y + target.h
    && source.x + source.w > target.x
    && source.y + source.h > target.y
}

export function boneyardOffCameraCleanupPlan(
  scene: BoneyardOffCameraCleanupSources,
  target: Readonly<BoneyardBounds>,
  visualBoundsBySource: ReadonlyMap<string, Readonly<BoneyardBounds>> = new Map(),
): BoneyardOffCameraCleanupPlan {
  const retiredSourceKeys = new Set<string>()
  let retainedObjects = 0
  let retainedRoads = 0
  let retainedSprites = 0
  let retainedTerrain = 0

  for (const object of scene.objects) {
    const key = `object:${object.eid}`
    const bounds = visualBoundsBySource.get(key)
    if (bounds === undefined || boneyardCleanupBoundsOverlap(bounds, target)) {
      retainedObjects += 1
    } else {
      retiredSourceKeys.add(key)
    }
  }
  for (const sprite of scene.sprites) {
    const key = `sprite:${sprite.eid}`
    const bounds = visualBoundsBySource.get(key)
    if (bounds === undefined || boneyardCleanupBoundsOverlap(bounds, target)) {
      retainedSprites += 1
    } else {
      retiredSourceKeys.add(key)
    }
  }
  for (const road of scene.roads) {
    const key = `road:${road.eid}`
    const bounds = pointsBounds(road.quad ?? road.points)
    if (bounds === null || boneyardCleanupBoundsOverlap(bounds, target)) {
      retainedRoads += 1
    } else {
      retiredSourceKeys.add(key)
    }
  }
  for (const terrain of scene.terrain) {
    const key = `terrain:${terrain.eid}`
    const bounds = pointsBounds(terrain.points ?? [terrain.pos])
    if (bounds === null || boneyardCleanupBoundsOverlap(bounds, target)) {
      retainedTerrain += 1
    } else {
      retiredSourceKeys.add(key)
    }
  }

  return Object.freeze({
    retainedCounts: Object.freeze({
      objects: retainedObjects,
      roads: retainedRoads,
      sprites: retainedSprites,
      terrain: retainedTerrain,
    }),
    retiredSourceKeys,
  })
}

export function boneyardTransformedArtBounds(
  position: Readonly<BoneyardPoint>,
  art: Readonly<{
    anchorX: number
    anchorY: number
    h: number
    w: number
  }>,
  rotationDegrees = 0,
  scaleX = 1,
  scaleY = 1,
): BoneyardBounds {
  const corners = [
    { x: -art.anchorX * scaleX, y: -art.anchorY * scaleY },
    { x: (art.w - art.anchorX) * scaleX, y: -art.anchorY * scaleY },
    { x: -art.anchorX * scaleX, y: (art.h - art.anchorY) * scaleY },
    { x: (art.w - art.anchorX) * scaleX, y: (art.h - art.anchorY) * scaleY },
  ]
  const radians = rotationDegrees * Math.PI / 180
  const sine = Math.sin(radians)
  const cosine = Math.cos(radians)
  return requiredPointsBounds(corners.map((corner) => ({
    x: position.x + corner.x * cosine - corner.y * sine,
    y: position.y + corner.x * sine + corner.y * cosine,
  })))
}

function pointsBounds(points: readonly Readonly<BoneyardPoint>[]): BoneyardBounds | null {
  return points.length === 0 ? null : requiredPointsBounds(points)
}

function requiredPointsBounds(points: readonly Readonly<BoneyardPoint>[]): BoneyardBounds {
  const xs = points.map(({ x }) => x)
  const ys = points.map(({ y }) => y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return {
    x,
    y,
    w: Math.max(...xs) - x,
    h: Math.max(...ys) - y,
  }
}
