import type { BoneyardBounds, BoneyardPoint } from '../core-kernels/boneyard.ts'
import { solomonContactContains } from '../core-kernels/boneyard-encounter.ts'
import { BONEYARD_GATE_INITIAL_SWAY } from '../core-kernels/boneyard-gate.ts'
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
const GATE_APPROACH_MARGIN = PLAYER_CHARACTER_RADIUS + BONEYARD_GATE_INITIAL_SWAY + 15
const GATE_CROSSED_MARGIN = PLAYER_CHARACTER_RADIUS + 35
const DIRECTIONS = Object.freeze([
  { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
  { x: -1, y: 0 }, { x: 1, y: 0 },
  { x: -1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 1 },
])

export class MlBotEntranceNavigator {
  private plannedAtTick = Number.NEGATIVE_INFINITY
  private route: readonly BoneyardPoint[] = []
  private routeTargetKey: string | null = null

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
    const bounds = state.world.arenaTransition?.fullBounds ?? state.world.bounds
    const gate = entryGate(state)
    if (gate) {
      const direction = state.world.arenaTransition?.entrySide === 'south' ? -1 : 1
      const crossed = (player.position.y - gate.y) * direction > GATE_CROSSED_MARGIN
      if (!crossed) {
        const remaining = (gate.y - player.position.y) * direction
        if (remaining <= GATE_APPROACH_MARGIN + 10 && Math.abs(gate.x - player.position.x) <= 40) {
          return movementInput(player.position, {
            x: gate.x,
            y: gate.y + direction * GATE_CROSSED_MARGIN,
          })
        }
        return this.routeInput(
          state.tick,
          player.position,
          {
            x: gate.x,
            y: gate.y - direction * GATE_APPROACH_MARGIN,
          },
          bounds,
          state.world.collision,
          `gate:${gate.fenceEid}`,
          false,
        )
      }
    }
    return this.routeInput(
      state.tick,
      player.position,
      state.world.encounter.position,
      bounds,
      state.world.collision,
      `solomon:${state.world.runId}`,
      true,
    )
  }

  private routeInput(
    tick: number,
    position: Readonly<BoneyardPoint>,
    target: Readonly<BoneyardPoint>,
    bounds: Readonly<BoneyardBounds>,
    collision: BoneyardCollisionWorld,
    targetKey: string,
    solomon: boolean,
  ): PlayerCharacterInput {
    if (
      this.routeTargetKey !== targetKey
      || this.route.length < 2
      || tick - this.plannedAtTick >= REPLAN_INTERVAL_TICKS
    ) {
      this.routeTargetKey = targetKey
      this.plannedAtTick = tick
      this.route = solomon
        ? planSolomonRoute(position, target, bounds, collision)
        : planPointRoute(position, target, bounds, collision)
    }
    let waypointIndex = 1
    while (
      waypointIndex < this.route.length - 1
      && distance(position, this.route[waypointIndex]!) <= WAYPOINT_TOLERANCE
    ) waypointIndex += 1
    const waypoint = this.route[waypointIndex]
    if (!waypoint) return createIdlePlayerCharacterInput()
    return movementInput(position, waypoint)
  }

  reset(): void {
    this.plannedAtTick = Number.NEGATIVE_INFINITY
    this.route = []
    this.routeTargetKey = null
  }
}

function planSolomonRoute(
  start: Readonly<BoneyardPoint>,
  solomon: Readonly<BoneyardPoint>,
  bounds: Readonly<BoneyardBounds>,
  collision: BoneyardCollisionWorld,
): readonly BoneyardPoint[] {
  return planRoute(
    start,
    solomon,
    bounds,
    collision,
    point => solomonContactContains(solomon, point) ? [] : null,
    'Solomon',
  )
}

function planPointRoute(
  start: Readonly<BoneyardPoint>,
  target: Readonly<BoneyardPoint>,
  bounds: Readonly<BoneyardBounds>,
  collision: BoneyardCollisionWorld,
): readonly BoneyardPoint[] {
  return planRoute(
    start,
    target,
    bounds,
    collision,
    point => distance(point, target) <= GRID_STEP && traverses(
      point,
      target,
      bounds,
      collision,
    ) ? [{ ...target }] : null,
    JSON.stringify(target),
  )
}

function planRoute(
  start: Readonly<BoneyardPoint>,
  target: Readonly<BoneyardPoint>,
  bounds: Readonly<BoneyardBounds>,
  collision: BoneyardCollisionWorld,
  finish: (point: Readonly<BoneyardPoint>) => readonly BoneyardPoint[] | null,
  targetLabel: string,
): readonly BoneyardPoint[] {
  const startKey = '0,0'
  const parents = new Map<string, string | null>([[startKey, null]])
  const points = new Map<string, BoneyardPoint>([[startKey, { ...start }]])
  const queue = [startKey]
  for (let cursor = 0; cursor < queue.length && cursor < MAXIMUM_GRID_NODES; cursor += 1) {
    const key = queue[cursor]!
    const point = points.get(key)!
    const tail = finish(point)
    if (tail !== null) {
      return simplifyRoute(
        [...reconstructRoute(key, parents, points), ...tail],
        bounds,
        collision,
      )
    }
    const [gridX, gridY] = key.split(',').map(Number) as [number, number]
    const ordered = DIRECTIONS.toSorted((left, right) => (
      distance({
        x: start.x + (gridX + left.x) * GRID_STEP,
        y: start.y + (gridY + left.y) * GRID_STEP,
      }, target) - distance({
        x: start.x + (gridX + right.x) * GRID_STEP,
        y: start.y + (gridY + right.y) * GRID_STEP,
      }, target)
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
  throw new Error(
    `ML bot found no collision-safe route to ${targetLabel} from ${JSON.stringify(start)}`,
  )
}

function entryGate(state: GameSimulationState): Readonly<{
  fenceEid: string
  x: number
  y: number
}> | null {
  if (state.world.kind !== 'boneyard' || state.world.gateLeaves.length === 0) return null
  const groups = new Map<string, typeof state.world.gateLeaves>()
  for (const leaf of state.world.gateLeaves) {
    groups.set(leaf.fenceEid, [...(groups.get(leaf.fenceEid) ?? []), leaf])
  }
  const centers = [...groups].flatMap(([fenceEid, leaves]) => leaves.length === 2
    ? [{
        fenceEid,
        x: (leaves[0]!.hinge.x + leaves[1]!.hinge.x) / 2,
        y: (leaves[0]!.hinge.y + leaves[1]!.hinge.y) / 2,
      }]
    : [])
  return centers.toSorted((left, right) => (
    distance(left, state.world.spawn) - distance(right, state.world.spawn)
  ))[0] ?? null
}

function movementInput(
  position: Readonly<BoneyardPoint>,
  target: Readonly<BoneyardPoint>,
): PlayerCharacterInput {
  const dx = target.x - position.x
  const dy = target.y - position.y
  const length = Math.hypot(dx, dy)
  return {
    aim: null,
    cast: { primary: false, quickbar: null },
    movement: length > 0
      ? { x: dx / length, y: dy / length }
      : { x: 0, y: 0 },
  }
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
