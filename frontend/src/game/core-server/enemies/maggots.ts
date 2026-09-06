import { actorHeadingFromVector } from '../../core-kernels/actor-heading.ts'
import type { BoneyardPoint } from '../../core-kernels/boneyard.ts'
import {
  buildNativeEnemySteering,
  clearNativeEnemyRoute,
  nativeEnemySteeringGoal,
  nativeEnemyTargetRefreshTicks,
  resolveNativeEnemyPathGoal,
  stepNativeEnemyPathRecovery,
  stepNativeEnemyReorientation,
} from '../../core-kernels/native-enemy-pathfinding.ts'
import { NATIVE_HURRICANE_DEFAULT_MOVEMENT_STEP } from '../../core-kernels/native-hurricane.ts'
import { NATIVE_BADGUY_NAVIGATION_CLEARANCE } from '../boneyard-enemy-navigation.ts'
import { spawnBouncer, spawnSimpleDeathEffect } from './death-effects.ts'
import type { DeathEffectOwner } from './death-effects.ts'
import { emitEnemyDeathSound, emitEvent } from './events.ts'
import { validatePoint } from './model.ts'
import type {
  BoneyardEnemyActor,
  BoneyardEnemyActorId,
  BoneyardEnemyStoreStepContext,
  BoneyardMaggotActor,
  WorkingStep,
} from './model.ts'
import { nativeSecondaryActorSpeedScale, positiveModulo } from './movement.ts'
import { NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS, NATIVE_MAGGOT_PROGRAM } from './programs.ts'
import { drawInteger, drawUnit, radialVector } from './random.ts'
import { nearestEligibleTarget, refreshMaggotTarget, targetHeading } from './targeting.ts'

export function nativeMaggotDeathOffsets(
  work: WorkingStep,
): readonly Readonly<BoneyardPoint>[] {
  const count = drawInteger(work, 3)
  return Object.freeze(Array.from({ length: count }, () => {
    const radius = drawUnit(work) * 30
    const direction = radialVector(drawUnit(work) * 360, radius)
    return Object.freeze(direction)
  }))
}

interface NativeMaggotAdmissionCount {
  active: number
  inactive: number
}

function nativeMaggotAdmissionCounts(
  maggots: readonly BoneyardMaggotActor[],
): Map<BoneyardEnemyActorId, NativeMaggotAdmissionCount> {
  const counts = new Map<BoneyardEnemyActorId, NativeMaggotAdmissionCount>()
  for (const maggot of maggots) {
    if (maggot.lifeState !== 'alive' || maggot.movementPhase !== 'crawl') continue
    const count = counts.get(maggot.ownerCoffinActorId) ?? { active: 0, inactive: 0 }
    if (maggot.combatActive) count.active += 1
    else count.inactive += 1
    counts.set(maggot.ownerCoffinActorId, count)
  }
  return counts
}

function admitNativeMaggot(
  work: WorkingStep,
  source: BoneyardMaggotActor,
  context: BoneyardEnemyStoreStepContext,
  admissionCounts: Map<BoneyardEnemyActorId, NativeMaggotAdmissionCount>,
): BoneyardMaggotActor | null {
  const owner = work.actors.find((actor) => (
    actor.id === source.ownerCoffinActorId
    && actor.lifeState === 'alive'
    && actor.config.enemyToken === 'COFFIN'
  ))
  if (!owner || owner.config.enemyToken !== 'COFFIN') {
    retireMaggot(work, source, context.tick)
    return null
  }
  const counts = admissionCounts.get(owner.id) ?? { active: 0, inactive: 0 }
  counts.inactive += 1
  if (
    counts.active < owner.config.family.maximumMaggots
    && drawInteger(work, 5) === 3
  ) {
    counts.inactive -= 1
    counts.active += 1
    admissionCounts.set(owner.id, counts)
    return {
      ...source,
      combatActive: true,
      nextAttackTick: context.tick + NATIVE_MAGGOT_PROGRAM.attackDelayAfterEmergenceTicks,
      targetPlayerId: nearestEligibleTarget(source.position, context.players),
    }
  }
  if (counts.inactive > NATIVE_MAGGOT_PROGRAM.maximumInactiveChildren) {
    counts.inactive -= 1
    admissionCounts.set(owner.id, counts)
    retireMaggot(work, source, context.tick)
    return null
  }
  admissionCounts.set(owner.id, counts)
  return { ...source, combatActive: false, targetPlayerId: null }
}

export function stepMaggots(
  work: WorkingStep,
  context: BoneyardEnemyStoreStepContext,
  elapsedTicks: number,
): void {
  const retained: BoneyardMaggotActor[] = []
  const admissionCounts = nativeMaggotAdmissionCounts(work.maggots)
  for (const stored of work.maggots) {
    let source = stored.hurricaneContactCooldown <= 0
      ? stored
      : {
          ...stored,
          hurricaneContactCooldown: Math.max(
            0,
            stored.hurricaneContactCooldown
              - elapsedTicks * NATIVE_HURRICANE_DEFAULT_MOVEMENT_STEP,
          ),
        }
    const effect = context.abilityEffects?.[source.id]
    if (!hasLiveCoffinOwner(work.actors, source.ownerCoffinActorId)) {
      retireMaggot(work, source, context.tick)
      continue
    }
    if (source.lifeState === 'dying') {
      const deathStartedTick = source.deathStartedTick ?? context.tick
      const deathTick = Math.max(0, context.tick - deathStartedTick)
      if (
        source.lastAttackTick !== null
        && deathTick < NATIVE_MAGGOT_PROGRAM.bitePresentationTicks
      ) {
        retained.push({ ...source, deathTick })
        continue
      }
      emitEvent(work, context.tick, 'enemy-death', source.id)
      emitMaggotDeathSounds(work, source, context.tick)
      spawnMaggotDeathEffects(work, source, context.tick)
      const eventId = emitEvent(work, context.tick, 'enemy-retired', source.id)
      work.retired.push(Object.freeze({ actorId: source.id, eventId }))
      continue
    }

    if ((effect?.disruptedTicks ?? 0) > 0 || effect?.timeScale === 0) {
      retained.push(source)
      continue
    }

    if (source.movementPhase === 'emerging') {
      const emerged = stepEmergingMaggot(source, context)
      if (emerged.movementPhase === 'emerging') {
        retained.push(emerged)
        continue
      }
      const admitted = admitNativeMaggot(
        work,
        emerged,
        context,
        admissionCounts,
      )
      if (admitted === null) continue
      source = admitted
    }

    if (!source.combatActive) {
      retained.push(source.targetPlayerId === null
        ? source
        : { ...source, targetPlayerId: null })
      continue
    }

    const targetSelection = refreshMaggotTarget(source, context)
    if (targetSelection.targetPlayerId !== source.targetPlayerId) {
      source = { ...source, path: clearNativeEnemyRoute(source.path) }
    }
    const targetPlayerId = targetSelection.targetPlayerId
    const target = targetPlayerId === null ? null : context.players[targetPlayerId] ?? null
    if (source.path.reorientationTicksRemaining > 0) {
      const reoriented = stepNativeEnemyReorientation(
        source.path,
        source.headingDeg,
        source.position,
        target?.position ?? null,
      )
      retained.push({
        ...source,
        ...targetSelection,
        headingDeg: reoriented.headingDeg,
        path: reoriented.state,
      })
      continue
    }
    const distance = target === null
      ? Number.POSITIVE_INFINITY
      : Math.hypot(
          target.position.x - source.position.x,
          target.position.y - source.position.y,
        )
    const fleeing = (effect?.fleeTicks ?? 0) > 0
    if (target !== null && targetPlayerId !== null && !fleeing && distance <= Math.max(
      NATIVE_MAGGOT_PROGRAM.attackReach,
      source.collisionRadius + target.collisionRadius,
    )) {
      if (context.tick >= source.nextAttackTick) {
        const eventId = emitEvent(work, context.tick, 'attack-marker', source.id, {
          targetPlayerId,
        })
        work.playerDamage.push(Object.freeze({
          actorId: source.id,
          physicalDamage: source.damage * (effect?.weakenFactor ?? 1),
          magicDamage: 0,
          coldSlowTicks: 0,
          dazzleTicks: 0,
          eventId,
          playerId: targetPlayerId,
          poisonDamage: source.poisonDamage,
          poisonDuration: source.poisonDuration,
        }))
        work.nextDeathEpoch += 1
        const counts = admissionCounts.get(source.ownerCoffinActorId)
        if (counts) counts.active = Math.max(0, counts.active - 1)
        retained.push({
          ...source,
          deathEpoch: work.nextDeathEpoch - 1,
          deathStartedTick: context.tick,
          deathTick: 0,
          headingDeg: targetHeading(source.position, targetPlayerId, context.players),
          lastAttackTick: context.tick,
          lifeState: 'dying',
          nextTargetRefreshTick: targetSelection.nextTargetRefreshTick,
          targetPlayerId,
          terminalEmitted: false,
        })
      } else {
        retained.push({ ...source, ...targetSelection })
      }
      continue
    }
    if (context.tick < source.nextMovementTick) {
      retained.push({ ...source, ...targetSelection })
      continue
    }
    const direction = fleeing ? -1 : 1
    const speedScale = nativeSecondaryActorSpeedScale(effect)
    const targetVelocity = target?.velocityPerTick ?? { x: 0, y: 0 }
    const targetHeadingDeg = Math.hypot(targetVelocity.x, targetVelocity.y) === 0
      ? target?.headingDeg ?? 0
      : actorHeadingFromVector(targetVelocity.x, targetVelocity.y)
    const steeringRequest = {
      actorHeadingDeg: source.headingDeg,
      actorPosition: source.position,
      cadenceTicks: NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS,
      movementPerTick: NATIVE_MAGGOT_PROGRAM.movementStep
        / NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS
        * speedScale
        * source.staffMovementFactor
        * source.path.speedFactor,
      radialDirection: direction,
      statusFactor: speedScale,
      tangentDirection: 0,
      targetHeadingDeg,
      targetPosition: target?.position ?? null,
    } as const
    let path = source.path
    let actorHeadingDeg = source.headingDeg
    let goalPosition = nativeEnemySteeringGoal(path, steeringRequest)
    if (!fleeing && context.navigation) {
      const routed = resolveNativeEnemyPathGoal(path, {
        actorPosition: source.position,
        bodyRadius: source.collisionRadius,
        cadenceTicks: NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS,
        directPathClear: (start, end) => context.navigation!.isPathClear({
          actorId: source.id,
          bodyRadius: source.collisionRadius,
          end,
          navigationClearance: NATIVE_BADGUY_NAVIGATION_CLEARANCE,
          radius: 0,
          start,
        }),
        findRoute: (start, end, clearance, bodyRadius) => (
          context.navigation!.findRoute({
            actorId: source.id,
            bodyRadius,
            end,
            navigationClearance: clearance,
            radius: clearance,
            start,
          })
        ),
        navigationClearance: NATIVE_BADGUY_NAVIGATION_CLEARANCE,
        rawGoal: goalPosition,
        targetPosition: target?.position ?? null,
        targetRefreshTicks: nativeEnemyTargetRefreshTicks(1),
      })
      path = routed.state
      actorHeadingDeg = routed.turnAround
        ? positiveModulo(actorHeadingDeg + 180, 360)
        : actorHeadingDeg
      goalPosition = routed.goal
    }
    const steering = buildNativeEnemySteering(path, {
      ...steeringRequest,
      actorHeadingDeg,
      goalPosition,
    })
    const delta = steering.delta
    const requestedPosition = Object.freeze({
      x: source.position.x + delta.x,
      y: source.position.y + delta.y,
    })
    const position = context.resolveMovement({
      actorId: source.id,
      delta,
      position: source.position,
      purpose: 'movement',
      radius: source.collisionRadius,
      requestedPosition,
    })
    validatePoint(position, 'resolved Maggot position')
    const traveled = Math.hypot(
      position.x - source.position.x,
      position.y - source.position.y,
    )
    const recovery = stepNativeEnemyPathRecovery(
      steering.state,
      work.steeringRngState,
      {
        flankingEnabled: true,
        requestedDistance: Math.hypot(delta.x, delta.y),
        statusFactor: source.staffMovementFactor * speedScale,
        tick: context.tick,
        traveledDistance: traveled,
      },
    )
    work.steeringRngState = recovery.rngState
    retained.push({
      ...source,
      gaitPose: traveled === 0
        ? source.gaitPose
        : positiveModulo(
            source.gaitPose + traveled / NATIVE_MAGGOT_PROGRAM.gaitDistancePerPose,
            2,
          ),
      headingDeg: steering.headingDeg,
      lastMovementTick: traveled === 0 ? source.lastMovementTick : context.tick,
      nextMovementTick: context.tick + NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS,
      nextTargetRefreshTick: targetSelection.nextTargetRefreshTick,
      path: recovery.state,
      position: Object.freeze({ ...position }),
      targetPlayerId,
    })
  }
  work.maggots = retained
}

function spawnMaggotDeathEffects(
  work: WorkingStep,
  maggot: BoneyardMaggotActor,
  tick: number,
): void {
  const positions = [
    maggot.position,
    ...maggot.deathOffsets.map((offset) => ({
      x: maggot.position.x + offset.x,
      y: maggot.position.y + offset.y,
    })),
  ]
  const rootOwner: DeathEffectOwner = { id: maggot.id, position: positions[0]! }
  spawnMaggotFragmentBouncer(work, rootOwner, tick, 1, 'maggot-fragment:root')
  spawnMaggotPerspectiveFade(work, rootOwner, tick, 'maggot-perspective-fade:root')
  for (let index = 1; index < positions.length; index += 1) {
    const owner: DeathEffectOwner = { id: maggot.id, position: positions[index]! }
    spawnMaggotPerspectiveFade(
      work,
      owner,
      tick,
      `maggot-perspective-fade:${index}`,
    )
    spawnMaggotFragmentBouncer(
      work,
      owner,
      tick,
      1,
      `maggot-fragment:${index}`,
    )
  }
}

function spawnMaggotFragmentBouncer(
  work: WorkingStep,
  owner: DeathEffectOwner,
  tick: number,
  speedScale: number,
  role: string,
): void {
  spawnBouncer(
    work,
    owner,
    tick,
    () => 2013 + drawInteger(work, 50),
    role,
    () => {
      const speed = (0.5 + drawUnit(work) * 0.5) * speedScale
      const direction = radialVector(drawUnit(work) * 360, speed)
      const velocity = { x: direction.x * 1.5, y: direction.y }
      const distance = 15 + drawUnit(work) * 10
      return {
        position: {
          x: owner.position.x + velocity.x * (distance + 2),
          y: owner.position.y + velocity.y * distance,
        },
        velocity,
      }
    },
  )
}

function spawnMaggotPerspectiveFade(
  work: WorkingStep,
  owner: DeathEffectOwner,
  tick: number,
  role: string,
): void {
  const rotationDeg = drawUnit(work) * 360
  const scale = 0.65 + drawUnit(work) * 0.35
  const alphaMultiplier = 0.25 + drawUnit(work) * 0.25
  const opacityTimer = 2.5
  spawnSimpleDeathEffect(work, owner, tick, {
    alpha: alphaMultiplier,
    alphaLossPerTick: 0.01,
    alphaMultiplier,
    atlas: 'DeadHawg',
    blendMode: 'normal',
    entry: 28,
    kind: 'fade-perspective',
    lifetimeTicks: 250,
    opacityTimer,
    role,
    rotationDeg,
    scale,
    tint: 0x828c6b,
  })
}

function emitMaggotDeathSounds(
  work: WorkingStep,
  maggot: BoneyardMaggotActor,
  tick: number,
): void {
  const squishPitch = 1 + drawUnit(work) * 0.2
  const squish = [
    'maggot-squish-1',
    'maggot-squish-2',
    'maggot-squish-3',
  ] as const
  emitEnemyDeathSound(
    work,
    tick,
    maggot,
    squish[drawInteger(work, squish.length)]!,
    squishPitch,
  )

  const squeakPitch = 1 + drawUnit(work) * 0.2
  const squeakGainScale = 0.25 + drawUnit(work) * 0.25
  const squeak = ['maggot-squeak-1', 'maggot-squeak-2'] as const
  emitEnemyDeathSound(
    work,
    tick,
    maggot,
    squeak[drawInteger(work, squeak.length)]!,
    squeakPitch,
    squeakGainScale,
  )
}

function hasLiveCoffinOwner(
  actors: readonly BoneyardEnemyActor[],
  ownerCoffinActorId: BoneyardEnemyActorId,
): boolean {
  return actors.some((actor) => (
    actor.id === ownerCoffinActorId
    && actor.lifeState === 'alive'
    && actor.config.enemyToken === 'COFFIN'
  ))
}

function retireMaggot(
  work: WorkingStep,
  maggot: BoneyardMaggotActor,
  tick: number,
): void {
  const eventId = emitEvent(work, tick, 'enemy-retired', maggot.id)
  work.retired.push(Object.freeze({ actorId: maggot.id, eventId }))
}

function stepEmergingMaggot(
  source: BoneyardMaggotActor,
  context: BoneyardEnemyStoreStepContext,
): BoneyardMaggotActor {
  const requestedTicks = Math.max(0, context.tick - source.spawnTick - source.emergenceTick)
  if (requestedTicks === 0) return source
  let elapsedTicks = 0
  let verticalOffset = source.verticalOffset
  let verticalVelocity = source.verticalVelocity
  let emergencePhase = source.emergencePhase
  let launchVelocity = source.launchVelocity
  let landingBounceVelocity = source.landingBounceVelocity
  let settled = false
  const delta = { x: 0, y: 0 }
  while (elapsedTicks < requestedTicks) {
    delta.x += launchVelocity.x
    delta.y += launchVelocity.y
    verticalOffset = Math.fround(verticalOffset + verticalVelocity)
    verticalVelocity = Math.fround(
      verticalVelocity + NATIVE_MAGGOT_PROGRAM.gravityPerTick,
    )
    emergencePhase = Math.fround(emergencePhase + 0.25)
    if (emergencePhase >= 5) emergencePhase = Math.fround(emergencePhase - 5)
    elapsedTicks += 1
    if (verticalOffset <= 0) continue
    verticalVelocity = landingBounceVelocity
    launchVelocity = Object.freeze({
      x: Math.fround(launchVelocity.x * 0.5),
      y: Math.fround(launchVelocity.y * 0.5),
    })
    landingBounceVelocity = Math.fround(landingBounceVelocity * 0.5)
    if (landingBounceVelocity > -0.25) {
      settled = true
      verticalOffset = 0
      break
    }
  }
  const requestedPosition = Object.freeze({
    x: source.position.x + delta.x,
    y: source.position.y + delta.y,
  })
  const position = context.resolveMovement({
    actorId: source.id,
    delta,
    position: source.position,
    purpose: 'movement',
    radius: source.collisionRadius,
    requestedPosition,
  })
  validatePoint(position, 'resolved emerging Maggot position')
  const traveled = Math.hypot(
    position.x - source.position.x,
    position.y - source.position.y,
  )
  const movementPhase = settled
    ? 'crawl' as const
    : 'emerging' as const
  return {
    ...source,
    emergencePhase,
    emergenceTick: source.emergenceTick + elapsedTicks,
    landingBounceVelocity,
    lastMovementTick: traveled === 0 ? source.lastMovementTick : context.tick,
    launchVelocity,
    movementPhase,
    nextMovementTick: context.tick + (
      movementPhase === 'crawl' ? NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS : 1
    ),
    position: Object.freeze({ ...position }),
    verticalOffset,
    verticalVelocity,
  }
}
