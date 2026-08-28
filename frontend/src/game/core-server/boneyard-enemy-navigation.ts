import type { BoneyardBounds, BoneyardPoint } from '../core-kernels/boneyard.ts'
import {
  canPlaceBoneyardBody,
  type BoneyardCollisionWorld,
} from './boneyard-collision.ts'

export const NATIVE_BADGUY_NAVIGATION_CLEARANCE = 25
export const NATIVE_DEMON_NAVIGATION_CLEARANCE = 50
export const NATIVE_NAVMESH_COLLISION_EXCLUSION_MASK = 0x80
export const NATIVE_NAVMESH_LATTICE_STEP = 500
export const NATIVE_NAVMESH_BOUNDARY_MARGIN = 200
export const NATIVE_NAVMESH_SPATIAL_LOOKUP_CELL = 200
export const NATIVE_NAVMESH_PORTAL_INSET = 1
export const NATIVE_NAVMESH_ROUTE_ARRIVAL_DOT = 100
export const NATIVE_NAVMESH_SIMPLIFICATION_CLEARANCE_FACTOR = 1.2000000476837158

const TRIANGLE_EPSILON = 1e-7
const CIRCLE_NAVIGATION_SEGMENTS = 8

export interface FindBoneyardEnemyRouteRequest {
  readonly bodyRadius: number
  readonly bounds: Readonly<BoneyardBounds>
  readonly clearance: number
  readonly end: Readonly<BoneyardPoint>
  readonly ignoredSourceIds?: ReadonlySet<string>
  readonly start: Readonly<BoneyardPoint>
  readonly world: BoneyardCollisionWorld
}

interface NativeNavMesh {
  readonly points: readonly Readonly<BoneyardPoint>[]
  readonly triangles: readonly NativeNavTriangle[]
}

interface NativeNavTriangle {
  readonly center: Readonly<BoneyardPoint>
  readonly id: number
  readonly neighbors: readonly number[]
  readonly vertices: readonly [number, number, number]
}

interface MutableNavTriangle {
  readonly center: Readonly<BoneyardPoint>
  readonly id: number
  readonly neighbors: number[]
  readonly vertices: readonly [number, number, number]
}

interface DelaunayTriangle {
  readonly vertices: readonly [number, number, number]
}

interface NavigationConstraint {
  readonly end: Readonly<BoneyardPoint>
  readonly start: Readonly<BoneyardPoint>
}

interface OpenTriangle {
  readonly f: number
  readonly g: number
  readonly id: number
  readonly order: number
}

const NAV_MESH_CACHE = new WeakMap<
  BoneyardCollisionWorld,
  Map<string, NativeNavMesh>
>()

/**
 * Ports the stock Arena-owned NavMesh service: clearance-expanded collision
 * constraints and the authored 500-unit samples feed a Delaunay triangle
 * graph, triangle adjacency feeds A*, and the resulting portal crossings are
 * reduced to the two waypoints retained by Badguy_ResolveNavGoal.
 */
export function findBoneyardEnemyRoute(
  request: FindBoneyardEnemyRouteRequest,
): readonly Readonly<BoneyardPoint>[] | null {
  validateRouteRequest(request)
  const {
    bodyRadius,
    bounds,
    clearance,
    end,
    ignoredSourceIds,
    start,
    world,
  } = request
  if (pathIsClear(start, end, bounds, world, clearance, ignoredSourceIds)) {
    return Object.freeze([
      Object.freeze({ ...start }),
      Object.freeze({ ...end }),
    ])
  }

  const mesh = nativeNavMesh(bounds, world, clearance)
  const startTriangle = resolveEndpointTriangle(
    mesh,
    start,
    bounds,
    world,
    bodyRadius,
    ignoredSourceIds,
  )
  const endTriangle = resolveEndpointTriangle(
    mesh,
    end,
    bounds,
    world,
    bodyRadius,
    ignoredSourceIds,
  )
  if (startTriangle === null || endTriangle === null) return null
  const trianglePath = findTrianglePath(mesh, startTriangle, endTriangle)
  if (trianglePath === null) return null

  const route: Readonly<BoneyardPoint>[] = [Object.freeze({ ...start })]
  appendDistinctRoutePoint(route, mesh.triangles[startTriangle]!.center)
  for (let index = 1; index < trianglePath.length; index += 1) {
    const previous = mesh.triangles[trianglePath[index - 1]!]
    const next = mesh.triangles[trianglePath[index]!]
    if (!previous || !next) throw new Error('enemy route lost a NavMesh triangle')
    const portal = sharedPortal(previous, next)
    if (portal !== null) {
      const crossing = projectToInsetPortal(
        end,
        mesh.points[portal[0]]!,
        mesh.points[portal[1]]!,
      )
      if (
        pathIsClear(previous.center, crossing, bounds, world, clearance)
        && pathIsClear(crossing, next.center, bounds, world, clearance)
      ) appendDistinctRoutePoint(route, crossing)
    }
    appendDistinctRoutePoint(route, next.center)
  }
  route.push(Object.freeze({ ...end }))
  return Object.freeze(simplifyNativeRoutePrefix(
    route,
    bounds,
    world,
    bodyRadius,
    ignoredSourceIds,
  ))
}

function nativeNavMesh(
  bounds: Readonly<BoneyardBounds>,
  world: BoneyardCollisionWorld,
  clearance: number,
): NativeNavMesh {
  const key = [bounds.x, bounds.y, bounds.w, bounds.h, clearance].join(':')
  let entries = NAV_MESH_CACHE.get(world)
  if (!entries) {
    entries = new Map()
    NAV_MESH_CACHE.set(world, entries)
  }
  const cached = entries.get(key)
  if (cached) return cached
  const built = buildNativeNavMesh(bounds, world, clearance)
  entries.set(key, built)
  return built
}

function buildNativeNavMesh(
  bounds: Readonly<BoneyardBounds>,
  world: BoneyardCollisionWorld,
  clearance: number,
): NativeNavMesh {
  const navigationWorld = withoutNativeNavMeshExcludedCollision(world)
  const constraints = navigationConstraints(navigationWorld, clearance)
  const candidates: Readonly<BoneyardPoint>[] = []
  for (const constraint of constraints) {
    candidates.push(constraint.start, constraint.end)
  }
  appendConstraintIntersections(candidates, constraints)
  appendNativeLattice(candidates, bounds, clearance)

  const candidateBounds = {
    x: bounds.x - NATIVE_NAVMESH_BOUNDARY_MARGIN - clearance,
    y: bounds.y - NATIVE_NAVMESH_BOUNDARY_MARGIN - clearance,
    w: bounds.w + (NATIVE_NAVMESH_BOUNDARY_MARGIN + clearance) * 2,
    h: bounds.h + (NATIVE_NAVMESH_BOUNDARY_MARGIN + clearance) * 2,
  }
  const points = uniqueNavigationPoints(candidates).filter((point) => (
    canPlaceBoneyardBody({ ...point }, candidateBounds, navigationWorld, clearance)
  ))
  const delaunay = delaunayTriangles(points)
  const centerAccepted = delaunay.filter((triangle) => canPlaceBoneyardBody(
    triangleCenter(triangle.vertices.map((vertex) => points[vertex]!)),
    { ...bounds },
    navigationWorld,
    clearance,
  ))
  return connectTriangles(points, centerAccepted, bounds, navigationWorld, clearance)
}

function withoutNativeNavMeshExcludedCollision(
  world: BoneyardCollisionWorld,
): BoneyardCollisionWorld {
  return Object.freeze({
    circles: Object.freeze(world.circles.filter(({ nativeLineMask }) => (
      !excludedFromNativeNavMesh(nativeLineMask)
    ))),
    polygons: Object.freeze(world.polygons.filter(({ nativeLineMask }) => (
      !excludedFromNativeNavMesh(nativeLineMask)
    ))),
    segments: Object.freeze(world.segments.filter(({ nativeLineMask }) => (
      !excludedFromNativeNavMesh(nativeLineMask)
    ))),
  })
}

function navigationConstraints(
  world: BoneyardCollisionWorld,
  clearance: number,
): readonly NavigationConstraint[] {
  const constraints: NavigationConstraint[] = []
  for (const polygon of world.polygons) {
    if (excludedFromNativeNavMesh(polygon.nativeLineMask)) continue
    for (let index = 0; index < polygon.points.length; index += 1) {
      appendCapsuleConstraints(
        constraints,
        polygon.points[index]!,
        polygon.points[(index + 1) % polygon.points.length]!,
        clearance,
      )
    }
  }
  for (const segment of world.segments) {
    if (excludedFromNativeNavMesh(segment.nativeLineMask)) continue
    appendCapsuleConstraints(
      constraints,
      segment.start,
      segment.end,
      clearance + segment.radius,
    )
  }
  for (const circle of world.circles) {
    if (excludedFromNativeNavMesh(circle.nativeLineMask)) continue
    const radius = circle.radius + clearance
    const ring = Array.from({ length: CIRCLE_NAVIGATION_SEGMENTS }, (_, index) => {
      const radians = index * Math.PI * 2 / CIRCLE_NAVIGATION_SEGMENTS
      return Object.freeze({
        x: Math.fround(circle.center.x + Math.cos(radians) * radius),
        y: Math.fround(circle.center.y + Math.sin(radians) * radius),
      })
    })
    appendPolygonConstraints(constraints, ring)
  }
  return constraints
}

function excludedFromNativeNavMesh(nativeLineMask: number | undefined): boolean {
  return ((nativeLineMask ?? 0) & NATIVE_NAVMESH_COLLISION_EXCLUSION_MASK) !== 0
}

function appendCapsuleConstraints(
  constraints: NavigationConstraint[],
  start: Readonly<BoneyardPoint>,
  end: Readonly<BoneyardPoint>,
  clearance: number,
): void {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy)
  if (length === 0) return
  const radius = clearance
  const alongX = dx / length * radius
  const alongY = dy / length * radius
  const acrossX = dy / length * radius
  const acrossY = -dx / length * radius
  appendPolygonConstraints(constraints, [
    { x: start.x - alongX, y: start.y - alongY },
    { x: start.x + acrossX, y: start.y + acrossY },
    { x: end.x + acrossX, y: end.y + acrossY },
    { x: end.x + alongX, y: end.y + alongY },
    { x: end.x - acrossX, y: end.y - acrossY },
    { x: start.x - acrossX, y: start.y - acrossY },
  ].map(frozenFloatPoint))
}

function appendPolygonConstraints(
  constraints: NavigationConstraint[],
  points: readonly Readonly<BoneyardPoint>[],
): void {
  for (let index = 0; index < points.length; index += 1) {
    constraints.push(Object.freeze({
      end: points[(index + 1) % points.length]!,
      start: points[index]!,
    }))
  }
}

function appendConstraintIntersections(
  candidates: Readonly<BoneyardPoint>[],
  constraints: readonly NavigationConstraint[],
): void {
  for (let left = 0; left < constraints.length; left += 1) {
    for (let right = left + 1; right < constraints.length; right += 1) {
      const intersection = segmentIntersection(
        constraints[left]!,
        constraints[right]!,
      )
      if (intersection) candidates.push(Object.freeze(intersection))
    }
  }
}

function segmentIntersection(
  left: NavigationConstraint,
  right: NavigationConstraint,
): BoneyardPoint | null {
  const leftX = left.end.x - left.start.x
  const leftY = left.end.y - left.start.y
  const rightX = right.end.x - right.start.x
  const rightY = right.end.y - right.start.y
  const denominator = cross(leftX, leftY, rightX, rightY)
  if (Math.abs(denominator) <= TRIANGLE_EPSILON) return null
  const offsetX = right.start.x - left.start.x
  const offsetY = right.start.y - left.start.y
  const leftProgress = cross(offsetX, offsetY, rightX, rightY) / denominator
  const rightProgress = cross(offsetX, offsetY, leftX, leftY) / denominator
  if (
    leftProgress <= TRIANGLE_EPSILON
    || leftProgress >= 1 - TRIANGLE_EPSILON
    || rightProgress <= TRIANGLE_EPSILON
    || rightProgress >= 1 - TRIANGLE_EPSILON
  ) return null
  return frozenFloatPoint({
    x: left.start.x + leftX * leftProgress,
    y: left.start.y + leftY * leftProgress,
  })
}

function appendNativeLattice(
  candidates: Readonly<BoneyardPoint>[],
  bounds: Readonly<BoneyardBounds>,
  clearance: number,
): void {
  const horizontal = axisSamples(bounds.x, bounds.x + bounds.w)
  const vertical = axisSamples(bounds.y, bounds.y + bounds.h)
  for (const x of horizontal) {
    for (const y of vertical) candidates.push(Object.freeze({ x, y }))
  }

  const outerLeft = bounds.x - NATIVE_NAVMESH_BOUNDARY_MARGIN
  const outerRight = bounds.x + bounds.w + NATIVE_NAVMESH_BOUNDARY_MARGIN
  const outerTop = bounds.y - NATIVE_NAVMESH_BOUNDARY_MARGIN
  const outerBottom = bounds.y + bounds.h + NATIVE_NAVMESH_BOUNDARY_MARGIN
  for (const x of horizontal) {
    candidates.push(Object.freeze({ x, y: outerTop }))
    candidates.push(Object.freeze({ x, y: outerBottom }))
  }
  for (const y of vertical) {
    candidates.push(Object.freeze({ x: outerLeft, y }))
    candidates.push(Object.freeze({ x: outerRight, y }))
  }
  candidates.push(
    Object.freeze({ x: outerLeft, y: outerTop }),
    Object.freeze({ x: outerRight, y: outerTop }),
    Object.freeze({ x: outerRight, y: outerBottom }),
    Object.freeze({ x: outerLeft, y: outerBottom }),
  )

  const left = bounds.x + clearance
  const right = bounds.x + bounds.w - clearance
  const top = bounds.y + clearance
  const bottom = bounds.y + bounds.h - clearance
  if (left > right || top > bottom) return
  for (const x of axisSamples(left, right)) {
    candidates.push(Object.freeze({ x, y: top }))
    candidates.push(Object.freeze({ x, y: bottom }))
  }
  for (const y of axisSamples(top, bottom)) {
    candidates.push(Object.freeze({ x: left, y }))
    candidates.push(Object.freeze({ x: right, y }))
  }
}

function axisSamples(start: number, end: number): readonly number[] {
  const samples: number[] = [Math.fround(start)]
  for (
    let value = start + NATIVE_NAVMESH_LATTICE_STEP;
    value < end;
    value += NATIVE_NAVMESH_LATTICE_STEP
  ) samples.push(Math.fround(value))
  if (end !== start) samples.push(Math.fround(end))
  return samples
}

function uniqueNavigationPoints(
  candidates: readonly Readonly<BoneyardPoint>[],
): readonly Readonly<BoneyardPoint>[] {
  const retained: Readonly<BoneyardPoint>[] = []
  const keys = new Set<string>()
  for (const candidate of candidates) {
    if (!Number.isFinite(candidate.x) || !Number.isFinite(candidate.y)) continue
    const point = frozenFloatPoint(candidate)
    const key = `${Math.round(point.x * 1000)}:${Math.round(point.y * 1000)}`
    if (keys.has(key)) continue
    keys.add(key)
    retained.push(point)
  }
  return retained
}

function delaunayTriangles(
  sourcePoints: readonly Readonly<BoneyardPoint>[],
): readonly DelaunayTriangle[] {
  if (sourcePoints.length < 3) return []
  const points = [...sourcePoints]
  const extent = pointExtent(sourcePoints)
  const span = Math.max(extent.maximumX - extent.minimumX, extent.maximumY - extent.minimumY, 1)
  const centerX = (extent.minimumX + extent.maximumX) * 0.5
  const centerY = (extent.minimumY + extent.maximumY) * 0.5
  const firstSuperVertex = points.length
  points.push(
    Object.freeze({ x: centerX - span * 32, y: centerY - span }),
    Object.freeze({ x: centerX, y: centerY + span * 32 }),
    Object.freeze({ x: centerX + span * 32, y: centerY - span }),
  )
  let triangles: DelaunayTriangle[] = [orientedTriangle(
    firstSuperVertex,
    firstSuperVertex + 1,
    firstSuperVertex + 2,
    points,
  )]

  for (let pointIndex = 0; pointIndex < sourcePoints.length; pointIndex += 1) {
    const bad = new Set<number>()
    const boundary = new Map<string, Readonly<[number, number]>>()
    const counts = new Map<string, number>()
    for (const [triangleIndex, triangle] of triangles.entries()) {
      if (!circumcircleContains(triangle, points, points[pointIndex]!)) continue
      bad.add(triangleIndex)
      for (const edge of triangleEdges(triangle.vertices)) {
        const key = edgeKey(edge[0], edge[1])
        counts.set(key, (counts.get(key) ?? 0) + 1)
        if (!boundary.has(key)) boundary.set(key, edge)
      }
    }
    triangles = triangles.filter((_, triangleIndex) => !bad.has(triangleIndex))
    for (const [key, edge] of boundary) {
      if (counts.get(key) !== 1) continue
      const triangle = orientedTriangle(edge[0], edge[1], pointIndex, points)
      if (triangleArea(triangle, points) > TRIANGLE_EPSILON) triangles.push(triangle)
    }
  }
  return triangles.filter(({ vertices }) => vertices.every((vertex) => (
    vertex < firstSuperVertex
  )))
}

function pointExtent(points: readonly Readonly<BoneyardPoint>[]): Readonly<{
  maximumX: number
  maximumY: number
  minimumX: number
  minimumY: number
}> {
  let maximumX = Number.NEGATIVE_INFINITY
  let maximumY = Number.NEGATIVE_INFINITY
  let minimumX = Number.POSITIVE_INFINITY
  let minimumY = Number.POSITIVE_INFINITY
  for (const point of points) {
    maximumX = Math.max(maximumX, point.x)
    maximumY = Math.max(maximumY, point.y)
    minimumX = Math.min(minimumX, point.x)
    minimumY = Math.min(minimumY, point.y)
  }
  return { maximumX, maximumY, minimumX, minimumY }
}

function orientedTriangle(
  first: number,
  second: number,
  third: number,
  points: readonly Readonly<BoneyardPoint>[],
): DelaunayTriangle {
  const a = points[first]!
  const b = points[second]!
  const c = points[third]!
  const vertices: [number, number, number] = (
    cross(b.x - a.x, b.y - a.y, c.x - a.x, c.y - a.y) >= 0
      ? [first, second, third]
      : [first, third, second]
  )
  return Object.freeze({ vertices: Object.freeze(vertices) })
}

function circumcircleContains(
  triangle: DelaunayTriangle,
  points: readonly Readonly<BoneyardPoint>[],
  point: Readonly<BoneyardPoint>,
): boolean {
  const a = points[triangle.vertices[0]]!
  const b = points[triangle.vertices[1]]!
  const c = points[triangle.vertices[2]]!
  const ax = a.x - point.x
  const ay = a.y - point.y
  const bx = b.x - point.x
  const by = b.y - point.y
  const cx = c.x - point.x
  const cy = c.y - point.y
  const determinant = (ax * ax + ay * ay) * cross(bx, by, cx, cy)
    - (bx * bx + by * by) * cross(ax, ay, cx, cy)
    + (cx * cx + cy * cy) * cross(ax, ay, bx, by)
  return determinant > TRIANGLE_EPSILON
}

function triangleArea(
  triangle: DelaunayTriangle,
  points: readonly Readonly<BoneyardPoint>[],
): number {
  const a = points[triangle.vertices[0]]!
  const b = points[triangle.vertices[1]]!
  const c = points[triangle.vertices[2]]!
  return Math.abs(cross(b.x - a.x, b.y - a.y, c.x - a.x, c.y - a.y)) * 0.5
}

function connectTriangles(
  points: readonly Readonly<BoneyardPoint>[],
  triangles: readonly DelaunayTriangle[],
  bounds: Readonly<BoneyardBounds>,
  world: BoneyardCollisionWorld,
  clearance: number,
): NativeNavMesh {
  const retained: MutableNavTriangle[] = triangles.map(({ vertices }, id) => ({
    center: Object.freeze(triangleCenter(vertices.map((vertex) => points[vertex]!))),
    id,
    neighbors: [],
    vertices,
  }))
  const ownerByEdge = new Map<string, number>()
  for (const triangle of retained) {
    for (const edge of triangleEdges(triangle.vertices)) {
      const key = edgeKey(edge[0], edge[1])
      const owner = ownerByEdge.get(key)
      if (owner === undefined) {
        ownerByEdge.set(key, triangle.id)
        continue
      }
      triangle.neighbors.push(owner)
      const ownerTriangle = retained[owner]!
      if (!pathIsClear(
        triangle.center,
        ownerTriangle.center,
        bounds,
        world,
        clearance,
      )) continue
      retained[owner]!.neighbors.push(triangle.id)
    }
  }
  connectVisibleTriangleCenters(retained, bounds, world, clearance)
  return Object.freeze({
    points: Object.freeze(points),
    triangles: Object.freeze(retained.map((triangle) => Object.freeze({
      ...triangle,
      neighbors: Object.freeze(triangle.neighbors),
    }))),
  })
}

function connectVisibleTriangleCenters(
  triangles: MutableNavTriangle[],
  bounds: Readonly<BoneyardBounds>,
  world: BoneyardCollisionWorld,
  clearance: number,
): void {
  // Stock's constrained triangulator retains these local free-space
  // adjacencies. Browser collision arrives as overlapping polygon/circle/
  // capsule primitives, so their overlapping constraint samples can split the
  // same free region into components. Restore only native-lattice-local links
  // accepted by the exact clearance query; this cannot cross collision or
  // invent another goal.
  const cells = new Map<string, number[]>()
  for (const triangle of triangles) {
    const key = triangleCellKey(triangle.center)
    const members = cells.get(key) ?? []
    members.push(triangle.id)
    cells.set(key, members)
  }
  const cellRadius = Math.ceil(
    NATIVE_NAVMESH_LATTICE_STEP / NATIVE_NAVMESH_SPATIAL_LOOKUP_CELL,
  )
  const maximumDistanceSquared = NATIVE_NAVMESH_LATTICE_STEP ** 2
  const parent = triangles.map(({ id }) => id)
  let componentCount = triangles.length
  const find = (source: number): number => {
    let root = source
    while (parent[root] !== root) root = parent[root]!
    let current = source
    while (parent[current] !== current) {
      const next = parent[current]!
      parent[current] = root
      current = next
    }
    return root
  }
  const union = (left: number, right: number): boolean => {
    const leftRoot = find(left)
    const rightRoot = find(right)
    if (leftRoot === rightRoot) return false
    parent[rightRoot] = leftRoot
    componentCount -= 1
    return true
  }
  for (const triangle of triangles) {
    for (const neighbor of triangle.neighbors) union(triangle.id, neighbor)
  }
  if (componentCount <= 1) return

  const links: { distanceSquared: number; left: number; right: number }[] = []
  for (const triangle of triangles) {
    const cellX = Math.floor(triangle.center.x / NATIVE_NAVMESH_SPATIAL_LOOKUP_CELL)
    const cellY = Math.floor(triangle.center.y / NATIVE_NAVMESH_SPATIAL_LOOKUP_CELL)
    for (let offsetY = -cellRadius; offsetY <= cellRadius; offsetY += 1) {
      for (let offsetX = -cellRadius; offsetX <= cellRadius; offsetX += 1) {
        const candidates = cells.get(`${cellX + offsetX}:${cellY + offsetY}`) ?? []
        for (const candidateId of candidates) {
          if (candidateId <= triangle.id || triangle.neighbors.includes(candidateId)) continue
          const candidate = triangles[candidateId]!
          const distanceSquared = squaredDistance(triangle.center, candidate.center)
          if (distanceSquared > maximumDistanceSquared) continue
          links.push({ distanceSquared, left: triangle.id, right: candidateId })
        }
      }
    }
  }
  links.sort((left, right) => left.distanceSquared - right.distanceSquared)
  for (const link of links) {
    if (componentCount <= 1) return
    if (find(link.left) === find(link.right)) continue
    const left = triangles[link.left]!
    const right = triangles[link.right]!
    if (!pathIsClear(left.center, right.center, bounds, world, clearance)) continue
    left.neighbors.push(right.id)
    right.neighbors.push(left.id)
    union(left.id, right.id)
  }
}

function triangleCellKey(point: Readonly<BoneyardPoint>): string {
  return `${Math.floor(point.x / NATIVE_NAVMESH_SPATIAL_LOOKUP_CELL)}:${
    Math.floor(point.y / NATIVE_NAVMESH_SPATIAL_LOOKUP_CELL)
  }`
}

function appendDistinctRoutePoint(
  route: Readonly<BoneyardPoint>[],
  point: Readonly<BoneyardPoint>,
): void {
  const previous = route[route.length - 1]
  if (previous && previous.x === point.x && previous.y === point.y) return
  route.push(Object.freeze({ ...point }))
}

function resolveEndpointTriangle(
  mesh: NativeNavMesh,
  point: Readonly<BoneyardPoint>,
  bounds: Readonly<BoneyardBounds>,
  world: BoneyardCollisionWorld,
  radius: number,
  ignoredSourceIds?: ReadonlySet<string>,
): number | null {
  const ranked = mesh.triangles.map((triangle) => {
    const vertices = triangle.vertices.map((vertex) => mesh.points[vertex]!)
    return {
      contains: pointInTriangle(point, vertices),
      distance: pointTriangleDistanceSquared(point, vertices),
      id: triangle.id,
    }
  }).sort((left, right) => (
    Number(right.contains) - Number(left.contains)
    || left.distance - right.distance
    || left.id - right.id
  ))
  return ranked.find(({ id }) => pathIsClear(
    point,
    mesh.triangles[id]!.center,
    bounds,
    world,
    radius,
    ignoredSourceIds,
  ))?.id ?? null
}

function findTrianglePath(
  mesh: NativeNavMesh,
  start: number,
  end: number,
): readonly number[] | null {
  if (start === end) return Object.freeze([start])
  const scores = new Map<number, number>([[start, 0]])
  const cameFrom = new Map<number, number>()
  const open = new TriangleMinHeap()
  let order = 0
  open.push({
    f: triangleHeuristic(mesh.triangles[start]!, mesh.triangles[end]!),
    g: 0,
    id: start,
    order: order++,
  })
  while (open.length > 0) {
    const current = open.pop()!
    if (scores.get(current.id) !== current.g) continue
    if (current.id === end) return reconstructTrianglePath(end, cameFrom)
    for (const neighbor of mesh.triangles[current.id]!.neighbors) {
      const tentative = current.g + 1
      if (tentative >= (scores.get(neighbor) ?? Number.POSITIVE_INFINITY)) continue
      scores.set(neighbor, tentative)
      cameFrom.set(neighbor, current.id)
      open.push({
        f: tentative + triangleHeuristic(mesh.triangles[neighbor]!, mesh.triangles[end]!),
        g: tentative,
        id: neighbor,
        order: order++,
      })
    }
  }
  return null
}

function reconstructTrianglePath(
  end: number,
  cameFrom: ReadonlyMap<number, number>,
): readonly number[] {
  const reversed = [end]
  let current = cameFrom.get(end)
  while (current !== undefined) {
    reversed.push(current)
    current = cameFrom.get(current)
  }
  return Object.freeze(reversed.reverse())
}

function triangleHeuristic(left: NativeNavTriangle, right: NativeNavTriangle): number {
  return Math.hypot(
    right.center.x - left.center.x,
    right.center.y - left.center.y,
  ) / NATIVE_NAVMESH_SPATIAL_LOOKUP_CELL
}

function sharedPortal(
  left: NativeNavTriangle,
  right: NativeNavTriangle,
): readonly [number, number] | null {
  const shared = left.vertices.filter((vertex) => right.vertices.includes(vertex))
  if (shared.length !== 2) return null
  const portal: [number, number] = [shared[0]!, shared[1]!]
  return Object.freeze(portal)
}

function projectToInsetPortal(
  destination: Readonly<BoneyardPoint>,
  start: Readonly<BoneyardPoint>,
  end: Readonly<BoneyardPoint>,
): BoneyardPoint {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy)
  if (length === 0) return frozenFloatPoint(start)
  const insetProgress = Math.min(NATIVE_NAVMESH_PORTAL_INSET / length, 0.5)
  const projected = (
    (destination.x - start.x) * dx + (destination.y - start.y) * dy
  ) / (length * length)
  const progress = Math.min(1 - insetProgress, Math.max(insetProgress, projected))
  return frozenFloatPoint({
    x: start.x + dx * progress,
    y: start.y + dy * progress,
  })
}

function simplifyNativeRoutePrefix(
  route: readonly Readonly<BoneyardPoint>[],
  bounds: Readonly<BoneyardBounds>,
  world: BoneyardCollisionWorld,
  bodyRadius: number,
  ignoredSourceIds?: ReadonlySet<string>,
): readonly Readonly<BoneyardPoint>[] {
  if (route.length < 3) return route
  let firstIndex = 1
  let secondIndex = 2
  let clearance = bodyRadius
  for (let index = 2; index < route.length - 1; index += 1) {
    if (!pathIsClear(
      route[0]!,
      route[index]!,
      bounds,
      world,
      clearance,
      ignoredSourceIds,
    )) break
    firstIndex = index
    secondIndex = index + 1
    clearance *= NATIVE_NAVMESH_SIMPLIFICATION_CLEARANCE_FACTOR
  }
  return Object.freeze([
    route[0]!,
    route[firstIndex]!,
    route[secondIndex]!,
  ])
}

function pathIsClear(
  start: Readonly<BoneyardPoint>,
  end: Readonly<BoneyardPoint>,
  bounds: Readonly<BoneyardBounds>,
  world: BoneyardCollisionWorld,
  radius: number,
  ignoredSourceIds?: ReadonlySet<string>,
): boolean {
  if (!pointInsideNavigationBounds(start, bounds, radius)) return false
  if (!pointInsideNavigationBounds(end, bounds, radius)) return false
  for (const polygon of world.polygons) {
    if (polygon.sourceId !== undefined && ignoredSourceIds?.has(polygon.sourceId)) continue
    if (pointInNavigationPolygon(start, polygon.points)) return false
    if (pointInNavigationPolygon(end, polygon.points)) return false
    for (let index = 0; index < polygon.points.length; index += 1) {
      const distanceSquared = segmentDistanceSquared(
        start,
        end,
        polygon.points[index]!,
        polygon.points[(index + 1) % polygon.points.length]!,
      )
      if (navigationSeparationBlocks(distanceSquared, radius)) return false
    }
  }
  for (const circle of world.circles) {
    if (circle.sourceId !== undefined && ignoredSourceIds?.has(circle.sourceId)) continue
    const required = radius + circle.radius
    if (navigationSeparationBlocks(
      pointSegmentDistanceSquared(circle.center, start, end),
      required,
    )) return false
  }
  for (const segment of world.segments) {
    if (segment.sourceId !== undefined && ignoredSourceIds?.has(segment.sourceId)) continue
    const required = radius + segment.radius
    if (navigationSeparationBlocks(
      segmentDistanceSquared(start, end, segment.start, segment.end),
      required,
    )) return false
  }
  return true
}

function pointInsideNavigationBounds(
  point: Readonly<BoneyardPoint>,
  bounds: Readonly<BoneyardBounds>,
  radius: number,
): boolean {
  return point.x >= bounds.x + radius
    && point.x <= bounds.x + bounds.w - radius
    && point.y >= bounds.y + radius
    && point.y <= bounds.y + bounds.h - radius
}

function navigationSeparationBlocks(distanceSquared: number, required: number): boolean {
  return required === 0
    ? distanceSquared <= TRIANGLE_EPSILON
    : distanceSquared < required * required
}

function segmentDistanceSquared(
  leftStart: Readonly<BoneyardPoint>,
  leftEnd: Readonly<BoneyardPoint>,
  rightStart: Readonly<BoneyardPoint>,
  rightEnd: Readonly<BoneyardPoint>,
): number {
  if (navigationSegmentsIntersect(leftStart, leftEnd, rightStart, rightEnd)) return 0
  return Math.min(
    pointSegmentDistanceSquared(leftStart, rightStart, rightEnd),
    pointSegmentDistanceSquared(leftEnd, rightStart, rightEnd),
    pointSegmentDistanceSquared(rightStart, leftStart, leftEnd),
    pointSegmentDistanceSquared(rightEnd, leftStart, leftEnd),
  )
}

function navigationSegmentsIntersect(
  leftStart: Readonly<BoneyardPoint>,
  leftEnd: Readonly<BoneyardPoint>,
  rightStart: Readonly<BoneyardPoint>,
  rightEnd: Readonly<BoneyardPoint>,
): boolean {
  const first = orientation(leftStart, leftEnd, rightStart)
  const second = orientation(leftStart, leftEnd, rightEnd)
  const third = orientation(rightStart, rightEnd, leftStart)
  const fourth = orientation(rightStart, rightEnd, leftEnd)
  if (
    ((first > 0 && second < 0) || (first < 0 && second > 0))
    && ((third > 0 && fourth < 0) || (third < 0 && fourth > 0))
  ) return true
  return (Math.abs(first) <= TRIANGLE_EPSILON && pointOnNavigationSegment(
    rightStart, leftStart, leftEnd,
  )) || (Math.abs(second) <= TRIANGLE_EPSILON && pointOnNavigationSegment(
    rightEnd, leftStart, leftEnd,
  )) || (Math.abs(third) <= TRIANGLE_EPSILON && pointOnNavigationSegment(
    leftStart, rightStart, rightEnd,
  )) || (Math.abs(fourth) <= TRIANGLE_EPSILON && pointOnNavigationSegment(
    leftEnd, rightStart, rightEnd,
  ))
}

function orientation(
  start: Readonly<BoneyardPoint>,
  end: Readonly<BoneyardPoint>,
  point: Readonly<BoneyardPoint>,
): number {
  return cross(end.x - start.x, end.y - start.y, point.x - start.x, point.y - start.y)
}

function pointOnNavigationSegment(
  point: Readonly<BoneyardPoint>,
  start: Readonly<BoneyardPoint>,
  end: Readonly<BoneyardPoint>,
): boolean {
  return point.x >= Math.min(start.x, end.x) - TRIANGLE_EPSILON
    && point.x <= Math.max(start.x, end.x) + TRIANGLE_EPSILON
    && point.y >= Math.min(start.y, end.y) - TRIANGLE_EPSILON
    && point.y <= Math.max(start.y, end.y) + TRIANGLE_EPSILON
}

function pointInNavigationPolygon(
  point: Readonly<BoneyardPoint>,
  polygon: readonly Readonly<BoneyardPoint>[],
): boolean {
  let inside = false
  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index, index += 1
  ) {
    const currentPoint = polygon[index]!
    const previousPoint = polygon[previous]!
    if (
      (currentPoint.y > point.y) !== (previousPoint.y > point.y)
      && point.x < (
        (previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)
        / (previousPoint.y - currentPoint.y)
        + currentPoint.x
      )
    ) inside = !inside
  }
  return inside
}

function triangleEdges(
  vertices: readonly [number, number, number],
): readonly (readonly [number, number])[] {
  const edges: [number, number][] = [
    [vertices[0], vertices[1]],
    [vertices[1], vertices[2]],
    [vertices[2], vertices[0]],
  ]
  return Object.freeze(edges.map((edge) => Object.freeze(edge)))
}

function edgeKey(first: number, second: number): string {
  return first < second ? `${first}:${second}` : `${second}:${first}`
}

function triangleCenter(
  vertices: readonly Readonly<BoneyardPoint>[],
): BoneyardPoint {
  return frozenFloatPoint({
    x: (vertices[0]!.x + vertices[1]!.x + vertices[2]!.x) / 3,
    y: (vertices[0]!.y + vertices[1]!.y + vertices[2]!.y) / 3,
  })
}

function pointInTriangle(
  point: Readonly<BoneyardPoint>,
  vertices: readonly Readonly<BoneyardPoint>[],
): boolean {
  const first = triangleSide(point, vertices[0]!, vertices[1]!)
  const second = triangleSide(point, vertices[1]!, vertices[2]!)
  const third = triangleSide(point, vertices[2]!, vertices[0]!)
  const negative = first < -TRIANGLE_EPSILON
    || second < -TRIANGLE_EPSILON
    || third < -TRIANGLE_EPSILON
  const positive = first > TRIANGLE_EPSILON
    || second > TRIANGLE_EPSILON
    || third > TRIANGLE_EPSILON
  return !(negative && positive)
}

function triangleSide(
  point: Readonly<BoneyardPoint>,
  start: Readonly<BoneyardPoint>,
  end: Readonly<BoneyardPoint>,
): number {
  return cross(
    point.x - end.x,
    point.y - end.y,
    start.x - end.x,
    start.y - end.y,
  )
}

function pointTriangleDistanceSquared(
  point: Readonly<BoneyardPoint>,
  vertices: readonly Readonly<BoneyardPoint>[],
): number {
  return Math.min(
    pointSegmentDistanceSquared(point, vertices[0]!, vertices[1]!),
    pointSegmentDistanceSquared(point, vertices[1]!, vertices[2]!),
    pointSegmentDistanceSquared(point, vertices[2]!, vertices[0]!),
  )
}

function pointSegmentDistanceSquared(
  point: Readonly<BoneyardPoint>,
  start: Readonly<BoneyardPoint>,
  end: Readonly<BoneyardPoint>,
): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return squaredDistance(point, start)
  const progress = Math.min(1, Math.max(0, (
    (point.x - start.x) * dx + (point.y - start.y) * dy
  ) / lengthSquared))
  return squaredDistance(point, {
    x: start.x + dx * progress,
    y: start.y + dy * progress,
  })
}

function squaredDistance(
  left: Readonly<BoneyardPoint>,
  right: Readonly<BoneyardPoint>,
): number {
  const dx = left.x - right.x
  const dy = left.y - right.y
  return dx * dx + dy * dy
}

function frozenFloatPoint(point: Readonly<BoneyardPoint>): Readonly<BoneyardPoint> {
  return Object.freeze({ x: Math.fround(point.x), y: Math.fround(point.y) })
}

function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx
}

class TriangleMinHeap {
  readonly #nodes: OpenTriangle[] = []

  get length(): number {
    return this.#nodes.length
  }

  push(node: OpenTriangle): void {
    this.#nodes.push(node)
    let index = this.#nodes.length - 1
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2)
      if (triangleBefore(this.#nodes[parent]!, node)) break
      this.#nodes[index] = this.#nodes[parent]!
      index = parent
    }
    this.#nodes[index] = node
  }

  pop(): OpenTriangle | undefined {
    const first = this.#nodes[0]
    const last = this.#nodes.pop()
    if (!first || !last || this.#nodes.length === 0) return first
    let index = 0
    while (true) {
      const left = index * 2 + 1
      if (left >= this.#nodes.length) break
      const right = left + 1
      const child = right < this.#nodes.length
        && triangleBefore(this.#nodes[right]!, this.#nodes[left]!)
        ? right
        : left
      if (triangleBefore(last, this.#nodes[child]!)) break
      this.#nodes[index] = this.#nodes[child]!
      index = child
    }
    this.#nodes[index] = last
    return first
  }
}

function triangleBefore(left: OpenTriangle, right: OpenTriangle): boolean {
  return left.f < right.f || (left.f === right.f && left.order < right.order)
}

function validateRouteRequest(request: FindBoneyardEnemyRouteRequest): void {
  if (!Number.isFinite(request.clearance) || request.clearance <= 0) {
    throw new RangeError('enemy navigation clearance must be positive and finite')
  }
  if (!Number.isFinite(request.bodyRadius) || request.bodyRadius < 0) {
    throw new RangeError('enemy navigation body radius must be non-negative and finite')
  }
  for (const [label, point] of [
    ['start', request.start],
    ['end', request.end],
  ] as const) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      throw new RangeError(`enemy route ${label} must be finite`)
    }
  }
}
