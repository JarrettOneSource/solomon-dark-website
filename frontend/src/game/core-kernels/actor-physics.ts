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

function actorSeparation(
  position: Readonly<Vector2>,
  radius: number,
  otherPosition: Readonly<Vector2>,
  otherRadius: number,
  weighted: boolean,
  output: Vector2 = { x: 0, y: 0 },
): Vector2 {
  const dx = position.x - otherPosition.x
  const dy = position.y - otherPosition.y
  const distanceSquared = dx * dx + dy * dy
  const radiusSum = radius + otherRadius
  const radiusSumSquared = radiusSum * radiusSum
  if (distanceSquared >= radiusSumSquared || distanceSquared === 0) {
    output.x = 0
    output.y = 0
    return output
  }

  const distance = Math.sqrt(distanceSquared)
  const overlap = radiusSum + NATIVE_ACTOR_SEPARATION_EPSILON - distance
  const weight = weighted
    ? (distanceSquared / radiusSumSquared) ** 4 * NATIVE_WEIGHT_RANGE
      + NATIVE_WEIGHT_MINIMUM
    : 1
  output.x = dx / distance * overlap * weight
  output.y = dy / distance * overlap * weight
  return output
}

function placedActorCorrection(
  bodyId: string,
  position: Readonly<Vector2>,
  radius: number,
  correction: Readonly<Vector2>,
  world: ActorPhysicsWorld,
): Vector2 | null {
  if (correction.x === 0 && correction.y === 0) return null
  const candidate = {
    x: position.x + correction.x,
    y: position.y + correction.y,
  }
  return world.canPlace(bodyId, candidate, radius) ? candidate : null
}

function applyCorrection(
  bodyIndex: number,
  body: ActorPhysicsBody,
  correction: Vector2,
  world: ActorPhysicsWorld,
  bodies: readonly ActorPhysicsBody[],
  broadphase?: ActorMotionBroadphase,
): boolean {
  const candidate = placedActorCorrection(
    body.id,
    body.position,
    body.radius,
    correction,
    world,
  )
  if (candidate === null) return false
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
  const bodies = sourceBodies.map(cloneActorPhysicsBody)
  const currentPushStrengths = bodies.map((body) => body.pushStrength)
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
      currentPushStrengths[bodyIndex] = mover.pushStrength
    }

    mover.position = world.move(mover.id, mover.position, delta, mover.radius)
    broadphase?.update(bodyIndex, bodies)

    const resolvePair = (otherIndex: number): void => {
      if (otherIndex === bodyIndex) return
      const other = bodies[otherIndex]
      if (!shouldCollide(mover, other)) return

      if (
        (!recursive && mover.pushEnabled === false)
        || currentPushStrengths[bodyIndex]! < other.pushResistance
      ) {
        const contacted = applyCorrection(
          bodyIndex,
          mover,
          actorSeparation(
            mover.position,
            mover.radius,
            other.position,
            other.radius,
            false,
          ),
          world,
          bodies,
          broadphase,
        )
        if (!recursive && contacted) observeRootContact?.(mover.id, other.id)
        return
      }

      const otherCorrection = actorSeparation(
        other.position,
        other.radius,
        mover.position,
        mover.radius,
        true,
      )
      if (otherCorrection.x !== 0 || otherCorrection.y !== 0) {
        if (!recursive) observeRootContact?.(mover.id, other.id)
        const pushFactor = Math.min(
          NATIVE_PUSH_FACTOR_MAXIMUM,
          Math.max(
            NATIVE_PUSH_FACTOR_MINIMUM,
            other.pushResistance > 0
              ? currentPushStrengths[bodyIndex]! / (other.pushResistance * 2)
              : NATIVE_PUSH_FACTOR_MAXIMUM,
          ),
        )
        currentPushStrengths[otherIndex] = currentPushStrengths[bodyIndex]! * pushFactor
        moveBody(otherIndex, {
          x: otherCorrection.x * pushFactor,
          y: otherCorrection.y * pushFactor,
        }, epochRecipients, true)
      }
      applyCorrection(
        bodyIndex,
        mover,
        actorSeparation(
          mover.position,
          mover.radius,
          other.position,
          other.radius,
          true,
        ),
        world,
        bodies,
        broadphase,
      )
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
  return bodies
}

/**
 * Single non-pushing root move. Equivalent to `resolveActorMotion` over
 * `bodies` when only `bodies[moverIndex]` is driven by `delta`, that mover has
 * `pushEnabled === false`, and every pair collides: the root move is swept,
 * then every other body separates the mover in ascending index order with the
 * same unweighted correction and full-candidate placement. Returns the resolved
 * mover position without cloning or mutating the crowd. Both the general and
 * specialized entries use the same separation and placement primitives.
 */
export function resolveUnpushedMoverMotion(
  bodies: readonly Readonly<ActorPhysicsBody>[],
  moverIndex: number,
  delta: Readonly<Vector2>,
  world: ActorPhysicsWorld,
): Vector2 {
  const mover = bodies[moverIndex]
  if (mover === undefined) throw new RangeError('mover index is outside the crowd')
  if (mover.pushEnabled !== false) {
    throw new TypeError('unpushed mover motion requires pushEnabled === false')
  }
  const radius = mover.radius
  let position = world.move(mover.id, mover.position, delta, radius)
  const correction = { x: 0, y: 0 }
  for (let otherIndex = 0; otherIndex < bodies.length; otherIndex += 1) {
    if (otherIndex === moverIndex) continue
    const other = bodies[otherIndex]!
    const candidate = placedActorCorrection(
      mover.id,
      position,
      radius,
      actorSeparation(
        position,
        radius,
        other.position,
        other.radius,
        false,
        correction,
      ),
      world,
    )
    if (candidate !== null) position = candidate
  }
  return position
}

function cloneActorPhysicsBody(source: Readonly<ActorPhysicsBody>): ActorPhysicsBody {
  const body: ActorPhysicsBody = {
    delta: { x: source.delta.x, y: source.delta.y },
    id: source.id,
    position: { x: source.position.x, y: source.position.y },
    pushResistance: source.pushResistance,
    pushStrength: source.pushStrength,
    radius: source.radius,
  }
  if (source.driven !== undefined) body.driven = source.driven
  if (source.pushEnabled !== undefined) body.pushEnabled = source.pushEnabled
  return body
}
