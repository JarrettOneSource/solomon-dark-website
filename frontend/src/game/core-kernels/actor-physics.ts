import type { Vector2 } from './vector.ts'
import type { ActorMotionBroadphase } from './dynamic-actor-grid.ts'

export interface ActorPhysicsBody {
  delta: Vector2
  driven?: boolean
  id: string
  position: Vector2
  pushEnabled?: boolean
  pushResistance: number
  pushStrength: number
  radius: number
}

export interface ActorPhysicsWorld {
  canPlace: (bodyId: string, position: Vector2, radius: number) => boolean
  move: (
    bodyId: string,
    position: Vector2,
    delta: Vector2,
    radius: number,
  ) => Vector2
}

export type ActorBodyPairFilter = (
  mover: Readonly<ActorPhysicsBody>,
  other: Readonly<ActorPhysicsBody>,
) => boolean

export type ActorRootContactObserver = (
  moverId: string,
  otherId: string,
) => void

export const NATIVE_ACTOR_SEPARATION_EPSILON = 0.1
const NATIVE_WEIGHT_MINIMUM = 0.01
const NATIVE_WEIGHT_RANGE = 0.99
const NATIVE_PUSH_FACTOR_MINIMUM = 0
const NATIVE_PUSH_FACTOR_MAXIMUM = 1

interface WorkingBody extends ActorPhysicsBody {
  currentPushStrength: number
}

function separation(
  mover: Readonly<WorkingBody>,
  other: Readonly<WorkingBody>,
  weighted: boolean,
): Vector2 {
  const dx = mover.position.x - other.position.x
  const dy = mover.position.y - other.position.y
  const distanceSquared = dx * dx + dy * dy
  const radiusSum = mover.radius + other.radius
  const radiusSumSquared = radiusSum * radiusSum
  if (distanceSquared >= radiusSumSquared || distanceSquared === 0) {
    return { x: 0, y: 0 }
  }

  const distance = Math.sqrt(distanceSquared)
  const overlap = radiusSum + NATIVE_ACTOR_SEPARATION_EPSILON - distance
  const weight = weighted
    ? (distanceSquared / radiusSumSquared) ** 4 * NATIVE_WEIGHT_RANGE
      + NATIVE_WEIGHT_MINIMUM
    : 1
  return {
    x: dx / distance * overlap * weight,
    y: dy / distance * overlap * weight,
  }
}

function applyCorrection(
  bodyIndex: number,
  body: WorkingBody,
  correction: Vector2,
  world: ActorPhysicsWorld,
  bodies: readonly WorkingBody[],
  broadphase?: ActorMotionBroadphase,
): boolean {
  if (correction.x === 0 && correction.y === 0) return false
  const candidate = {
    x: body.position.x + correction.x,
    y: body.position.y + correction.y,
  }
  if (!world.canPlace(body.id, candidate, body.radius)) return false
  body.position = candidate
  broadphase?.update(bodyIndex, bodies)
  return true
}

/**
 * Replays the stock PlayerActor movement epoch and circle-response solver.
 * Root moves use swept world collision. Pair separation uses full-candidate
 * placement, and recursive recipients are marked once per root epoch.
 */
export function resolveActorMotion(
  sourceBodies: readonly ActorPhysicsBody[],
  world: ActorPhysicsWorld,
  shouldCollide: ActorBodyPairFilter,
  broadphase?: ActorMotionBroadphase,
  observeRootContact?: ActorRootContactObserver,
): ActorPhysicsBody[] {
  const bodies: WorkingBody[] = sourceBodies.map((body) => ({
    ...body,
    currentPushStrength: body.pushStrength,
    delta: { ...body.delta },
    position: { ...body.position },
  }))
  broadphase?.rebuild(bodies)

  const moveBody = (
    bodyIndex: number,
    delta: Vector2,
    epochRecipients: Set<number>,
    recursive: boolean,
  ): void => {
    const mover = bodies[bodyIndex]
    if (recursive) {
      if (epochRecipients.has(bodyIndex)) return
      epochRecipients.add(bodyIndex)
    } else {
      mover.currentPushStrength = mover.pushStrength
    }

    mover.position = world.move(mover.id, mover.position, delta, mover.radius)
    broadphase?.update(bodyIndex, bodies)

    const resolvePair = (otherIndex: number): void => {
      if (otherIndex === bodyIndex) return
      const other = bodies[otherIndex]
      if (!shouldCollide(mover, other)) return

      if (
        (!recursive && mover.pushEnabled === false)
        || mover.currentPushStrength < other.pushResistance
      ) {
        const contacted = applyCorrection(
          bodyIndex,
          mover,
          separation(mover, other, false),
          world,
          bodies,
          broadphase,
        )
        if (!recursive && contacted) observeRootContact?.(mover.id, other.id)
        return
      }

      const otherCorrection = separation(other, mover, true)
      if (otherCorrection.x !== 0 || otherCorrection.y !== 0) {
        if (!recursive) observeRootContact?.(mover.id, other.id)
        const pushFactor = Math.min(
          NATIVE_PUSH_FACTOR_MAXIMUM,
          Math.max(
            NATIVE_PUSH_FACTOR_MINIMUM,
            other.pushResistance > 0
              ? mover.currentPushStrength / (other.pushResistance * 2)
              : NATIVE_PUSH_FACTOR_MAXIMUM,
          ),
        )
        other.currentPushStrength = mover.currentPushStrength * pushFactor
        moveBody(otherIndex, {
          x: otherCorrection.x * pushFactor,
          y: otherCorrection.y * pushFactor,
        }, epochRecipients, true)
      }
      applyCorrection(bodyIndex, mover, separation(mover, other, true), world, bodies, broadphase)
    }

    if (!broadphase) {
      for (let otherIndex = 0; otherIndex < bodies.length; otherIndex += 1) {
        resolvePair(otherIndex)
      }
      return
    }

    let minimumCandidateIndex = 0
    let candidateRevision = -1
    let candidates: readonly number[] = []
    while (minimumCandidateIndex < bodies.length) {
      if (candidateRevision !== broadphase.revision) {
        candidates = [...broadphase.candidateIndices(bodyIndex, bodies)]
        candidateRevision = broadphase.revision
      }
      let otherIndex = -1
      for (const candidateIndex of candidates) {
        if (candidateIndex >= minimumCandidateIndex && candidateIndex !== bodyIndex) {
          otherIndex = candidateIndex
          break
        }
      }
      if (otherIndex < 0) break
      minimumCandidateIndex = otherIndex + 1
      resolvePair(otherIndex)
    }
  }

  for (let bodyIndex = 0; bodyIndex < bodies.length; bodyIndex += 1) {
    if (bodies[bodyIndex].driven === false) continue
    moveBody(bodyIndex, bodies[bodyIndex].delta, new Set(), false)
  }
  return bodies.map(({ currentPushStrength: _, ...body }) => body)
}
