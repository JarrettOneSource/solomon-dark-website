import type { Vector2 } from './vector.ts'

export const NATIVE_GOODIE_FACING_PROBE_DISTANCE = 25
export const NATIVE_GOODIE_QUERY_RADIUS = 50

interface GoodieInteractionActor {
  readonly headingIndex: number
  readonly position: Vector2
}

interface GoodieInteractionTarget {
  readonly active: boolean
  readonly exhausted: boolean
  readonly phase: 0 | 1 | 2
  readonly position: Vector2
}

export function nearestBoneyardGoodie<T extends GoodieInteractionTarget>(
  goodies: readonly T[],
  actor: GoodieInteractionActor,
): T | null {
  const heading = actor.headingIndex * Math.PI / 12
  const queryPoint = {
    x: Math.fround(
      actor.position.x + Math.sin(heading) * NATIVE_GOODIE_FACING_PROBE_DISTANCE,
    ),
    y: Math.fround(
      actor.position.y - Math.cos(heading) * NATIVE_GOODIE_FACING_PROBE_DISTANCE,
    ),
  }
  let nearest: T | null = null
  let nearestDistanceSquared = NATIVE_GOODIE_QUERY_RADIUS * NATIVE_GOODIE_QUERY_RADIUS
  for (const goodie of goodies) {
    if (goodie.active || goodie.exhausted || goodie.phase !== 0) continue
    const dx = goodie.position.x - queryPoint.x
    const dy = goodie.position.y - queryPoint.y
    const distanceSquared = dx * dx + dy * dy
    if (!(distanceSquared < nearestDistanceSquared)) continue
    nearest = goodie
    nearestDistanceSquared = distanceSquared
  }
  return nearest
}
