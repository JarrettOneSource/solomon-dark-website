import type { BoneyardBounds, BoneyardPoint } from '../core-kernels/boneyard.ts'
import { solomonContactContains } from '../core-kernels/boneyard-encounter.ts'
import {
  PLAYER_CHARACTER_RADIUS,
  createIdlePlayerCharacterInput,
  type PlayerCharacterInput,
} from '../core-kernels/player-character.ts'
import {
  resolveBoneyardMovement,
  type BoneyardCollisionWorld,
} from '../core-server/boneyard-collision.ts'
import {
  gameSimulationPlayerRecords,
  type GameSimulationState,
} from '../core-server/game-simulation.ts'

const GRID_STEP = 40
const MAXIMUM_GRID_NODES = 25_000
const REPLAN_INTERVAL_TICKS = 100
const WAYPOINT_TOLERANCE = 20
const DIRECTIONS = Object.freeze([
  { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
  { x: -1, y: 0 }, { x: 1, y: 0 },
  { x: -1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 1 },
])

export class MlBotEntranceNavigator {
  private plannedAtTick = Number.NEGATIVE_INFINITY
  private route: readonly BoneyardPoint[] = []
  private runId: string | null = null

  input(state: GameSimulationState, playerId: string): PlayerCharacterInput | null {
    if (
      state.world.kind !== 'boneyard'
      || state.world.encounter === null
      || state.world.encounter.runEventId > 0
    ) {
      this.reset()
      return null
    }
    if (state.world.encounter.phase !== 'digging') return createIdlePlayerCharacterInput()
    const player = gameSimulationPlayerRecords(state)[playerId]
    if (!player) throw new Error(`ML bot entrance navigation has no player ${playerId}`)
    if (
      this.runId !== state.world.runId
      || this.route.length < 2
      || state.tick - this.plannedAtTick >= REPLAN_INTERVAL_TICKS
    ) {
      this.runId = state.world.runId
      this.plannedAtTick = state.tick
      this.route = planEntranceRoute(
        player.position,
        state.world.encounter.position,
        state.world.arenaTransition?.fullBounds ?? state.world.bounds,
        state.world.collision,
      )
    }
    let waypointIndex = 1
    while (
      waypointIndex < this.route.length - 1
      && distance(player.position, this.route[waypointIndex]!) <= WAYPOINT_TOLERANCE
    ) waypointIndex += 1
    const waypoint = this.route[waypointIndex]
    if (!waypoint) return createIdlePlayerCharacterInput()
    const dx = waypoint.x - player.position.x
    const dy = waypoint.y - player.position.y
    const length = Math.hypot(dx, dy)
    return {
      aim: null,
      cast: { primary: false, quickbar: null },
      movement: length > 0
        ? { x: dx / length, y: dy / length }
        : { x: 0, y: 0 },
    }
  }

  reset(): void {
    this.plannedAtTick = Number.NEGATIVE_INFINITY
    this.route = []
    this.runId = null
  }
}

function planEntranceRoute(
  start: Readonly<BoneyardPoint>,
  solomon: Readonly<BoneyardPoint>,
  bounds: Readonly<BoneyardBounds>,
  collision: BoneyardCollisionWorld,
): readonly BoneyardPoint[] {
  const startKey = '0,0'
  const parents = new Map<string, string | null>([[startKey, null]])
  const points = new Map<string, BoneyardPoint>([[startKey, { ...start }]])
  const queue = [startKey]
  for (let cursor = 0; cursor < queue.length && cursor < MAXIMUM_GRID_NODES; cursor += 1) {
    const key = queue[cursor]!
    const point = points.get(key)!
    if (solomonContactContains(solomon, point)) {
      return simplifyRoute(reconstructRoute(key, parents, points), bounds, collision)
    }
    const [gridX, gridY] = key.split(',').map(Number) as [number, number]
    const ordered = DIRECTIONS.toSorted((left, right) => (
      distance({
        x: start.x + (gridX + left.x) * GRID_STEP,
        y: start.y + (gridY + left.y) * GRID_STEP,
      }, solomon) - distance({
        x: start.x + (gridX + right.x) * GRID_STEP,
        y: start.y + (gridY + right.y) * GRID_STEP,
      }, solomon)
    ))
    for (const direction of ordered) {
      const nextGridX = gridX + direction.x
      const nextGridY = gridY + direction.y
      const nextKey = `${nextGridX},${nextGridY}`
      if (parents.has(nextKey)) continue
      const next = {
        x: start.x + nextGridX * GRID_STEP,
        y: start.y + nextGridY * GRID_STEP,
      }
      if (!traverses(point, next, bounds, collision)) continue
      parents.set(nextKey, key)
      points.set(nextKey, next)
      queue.push(nextKey)
    }
  }
  throw new Error(`ML bot found no collision-safe route to Solomon from ${JSON.stringify(start)}`)
}

function reconstructRoute(
  goalKey: string,
  parents: ReadonlyMap<string, string | null>,
  points: ReadonlyMap<string, BoneyardPoint>,
): readonly BoneyardPoint[] {
  const reversed: BoneyardPoint[] = []
  let key: string | null = goalKey
  while (key !== null) {
    reversed.push(points.get(key)!)
    key = parents.get(key) ?? null
  }
  return reversed.reverse()
}

function simplifyRoute(
  route: readonly BoneyardPoint[],
  bounds: Readonly<BoneyardBounds>,
  collision: BoneyardCollisionWorld,
): readonly BoneyardPoint[] {
  const simplified = [route[0]!]
  let currentIndex = 0
  while (currentIndex < route.length - 1) {
    let nextIndex = route.length - 1
    while (
      nextIndex > currentIndex + 1
      && !traverses(route[currentIndex]!, route[nextIndex]!, bounds, collision)
    ) nextIndex -= 1
    simplified.push(route[nextIndex]!)
    currentIndex = nextIndex
  }
  return simplified
}

function traverses(
  start: Readonly<BoneyardPoint>,
  target: Readonly<BoneyardPoint>,
  bounds: Readonly<BoneyardBounds>,
  collision: BoneyardCollisionWorld,
): boolean {
  const length = distance(start, target)
  const steps = Math.ceil(length / 8)
  let current = { ...start }
  for (let step = 1; step <= steps; step += 1) {
    const requested = {
      x: start.x + (target.x - start.x) * step / steps,
      y: start.y + (target.y - start.y) * step / steps,
    }
    const resolved = resolveBoneyardMovement(
      current,
      requested,
      bounds,
      collision,
      PLAYER_CHARACTER_RADIUS,
    )
    if (distance(resolved, requested) > 0.25) return false
    current = resolved
  }
  return true
}

function distance(left: Readonly<BoneyardPoint>, right: Readonly<BoneyardPoint>): number {
  return Math.hypot(right.x - left.x, right.y - left.y)
}
