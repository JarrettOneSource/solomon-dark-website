import {
  NATIVE_ARROW_POISON_DURATION_SECONDS,
  NATIVE_MAGE_COLD_SLOW_TICKS,
  NATIVE_MAGE_POISON_DURATION_SECONDS,
  projectilePayloadForArrow,
} from '../../core-kernels/boneyard-enemy-modifiers.ts'
import type { BoneyardEnemyProjectilePayload } from '../../core-kernels/boneyard-enemy-modifiers.ts'
import {
  NATIVE_MAGE_LIGHTNING_BASE_TICKS,
  nativeMageBodyPose,
  nativeMageLightningSource,
} from '../../core-kernels/boneyard-mage-lightning.ts'
import type { BoneyardPoint } from '../../core-kernels/boneyard.ts'
import { buildNativeArcherVolley, nativeEnemyProjectileVelocity } from '../../core-kernels/native-enemy-targeting.ts'
import type { NativeWorldManagerLane } from '../../core-kernels/native-world-manager-order.ts'
import { emitEnemyActionSound, emitEvent } from './events.ts'
import { validatePoint } from './model.ts'
import type {
  BoneyardEnemyActor,
  BoneyardEnemyProjectile,
  BoneyardEnemyProjectileBase,
  BoneyardEnemyProjectileKind,
  BoneyardEnemyStoreStepContext,
  BoneyardMageLightningPulse,
  WorkingStep,
} from './model.ts'
import { staffAttackSpeed } from './movement.ts'
import { BOUNDED_ENEMY_PROJECTILE_PROGRAMS, NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS } from './programs.ts'
import { drawEnemyFloat, drawEnemyInteger, randomRadialDisplacement } from './random.ts'
import { targetEligible } from './targeting.ts'

function enemyProjectileLightManagerLane(
  kind: BoneyardEnemyProjectileKind,
  payload: BoneyardEnemyProjectilePayload,
): NativeWorldManagerLane | null {
  switch (kind) {
    case 'arrow': return payload === 'fire' ? 'transient' : null
    case 'firebolt': return 'transient'
    case 'demon-bomb':
    case 'guided-missile': return 'actor'
    case 'poison-pool': return null
  }
}

export function emitArcherVolley(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  privateSeed: number,
  context: BoneyardEnemyStoreStepContext,
): void {
  if (actor.config.enemyToken !== 'SKELETONARCHER' || actor.targetPlayerId === null) {
    return
  }
  const target = context.players[actor.targetPlayerId]
  if (!target || !targetEligible(target)) return
  const volley = buildNativeArcherVolley({
    accuracyMode: actor.config.family.accuracyMode,
    arrowType: actor.config.family.arrowType,
    extraArrows: actor.config.family.extraArrows,
    multiArrowMode: actor.config.family.multiArrowMode,
    origin: actor.position,
    privateSeed,
    targetPosition: target.position,
    targetVelocityPerTick: target.velocityPerTick,
  }, work.steeringRngState)
  work.steeringRngState = volley.sharedRngState
  emitEnemyActionSound(
    work,
    context.tick,
    actor,
    'shoot-arrow',
    volley.shotPitch,
  )
  for (const arrow of volley.arrows) {
    const poison = arrow.arrowType === 'poison'
    spawnProjectile(
      work,
      actor,
      context.tick,
      'arrow',
      actor.config.primaryDamage ?? 0,
      {
        headingDeg: arrow.headingDeg,
        lifetimeTicks: arrow.lifetimeTicks,
        minimumSpeed: arrow.speed,
        payload: projectilePayloadForArrow(arrow.arrowType),
        poisonDamage: poison ? actor.config.secondaryDamage / NATIVE_ARROW_POISON_DURATION_SECONDS : 0,
        poisonDuration: poison ? NATIVE_ARROW_POISON_DURATION_SECONDS : 0,
        position: arrow.position,
        secondaryDamage: arrow.arrowType === 'fire'
          ? actor.config.secondaryDamage
          : 0,
        speed: arrow.speed,
        visualPhaseDeg: arrow.visualHeadingDeg,
      },
    )
  }
}

export interface MageLightningDispatch {
  readonly targetPlayerId: string
  readonly targetPosition: Readonly<BoneyardPoint>
}

export function emitMageAttack(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  context: BoneyardEnemyStoreStepContext,
): MageLightningDispatch | null {
  if (actor.config.enemyToken !== 'SKELETONMAGE') return null
  if (actor.config.family.element !== 'lightning') {
    const fire = actor.config.family.element === 'fire'
    emitEnemyActionSound(work, context.tick, actor, fire ? 'throw-fire' : 'throw-spell',
      fire ? 1.25 : Math.fround(1 + drawEnemyFloat(work, 0.25, true)))
  }
  switch (actor.config.family.element) {
    case 'fire':
      spawnProjectile(
        work,
        actor,
        context.tick,
        'firebolt',
        actor.config.primaryDamage ?? 0,
        { payload: 'fire' },
      )
      return null
    case 'frost':
      spawnProjectile(
        work,
        actor,
        context.tick,
        'guided-missile',
        actor.config.primaryDamage ?? 0,
        { coldSlowTicks: NATIVE_MAGE_COLD_SLOW_TICKS, payload: 'cold' },
      )
      return null
    case 'poison':
      spawnProjectile(
        work,
        actor,
        context.tick,
        'guided-missile',
        1,
        {
          payload: 'poison',
          poisonDamage: (actor.config.primaryDamage ?? 0) / NATIVE_MAGE_POISON_DURATION_SECONDS,
          poisonDuration: NATIVE_MAGE_POISON_DURATION_SECONDS,
        },
      )
      return null
    case 'lightning': {
      const targetPlayerId = actor.targetPlayerId
      if (targetPlayerId === null) return null
      const target = context.players[targetPlayerId]
      if (!target || !targetEligible(target)) return null
      return Object.freeze({
        targetPlayerId,
        targetPosition: Object.freeze({ ...target.position }),
      })
    }
  }
}

export function stepMageLightningPulse(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  const brain = actor.brain
  if (brain.family !== 'mage' || brain.lightningTicksRemaining <= 0) return actor
  const targetPlayerId = brain.lightningTargetPlayerId
  const target = targetPlayerId === null ? undefined : context.players[targetPlayerId]
  const attachedTarget = target && targetEligible(target) ? target : null
  const targetPosition = attachedTarget?.position ?? brain.lightningTargetPosition
  if (targetPosition === null) {
    throw new Error('active Mage lightning is missing its preserved target position')
  }
  const pose = nativeMageBodyPose({
    actionProgress: brain.actionProgress,
    bodyPose: actor.bodyPose,
    castProgram: brain.castProgram,
    phase: brain.phase,
  })
  const source = nativeMageLightningSource(actor.position, pose, actor.headingDeg)
  if (!context.clipSpellSegment) {
    throw new Error('Mage lightning requires the exact spell-segment clip seam')
  }
  const clipped = context.clipSpellSegment({ end: targetPosition, start: source })
  validatePoint(clipped, 'clipped Mage lightning endpoint')
  const clearTarget = attachedTarget !== null
    && clipped.x === targetPosition.x
    && clipped.y === targetPosition.y
  if (clearTarget) {
    work.playerDamage.push(Object.freeze({
      actorId: actor.id,
      physicalDamage: 0,
      magicDamage: Math.fround(
        (actor.config.primaryDamage ?? 0) / NATIVE_MAGE_LIGHTNING_BASE_TICKS
          * staffAttackSpeed(actor),
      ),
      coldSlowTicks: 0,
      dazzleTicks: 0,
      suppressFlash: true,
      eventId: emitEvent(work, context.tick, 'mage-lightning-contact', actor.id, { targetPlayerId }),
      playerId: targetPlayerId!,
      poisonDamage: 0,
      poisonDuration: 0,
    }))
  }
  const endpointBase = clearTarget ? targetPosition : clipped
  const endpointOffset = randomRadialDisplacement(work, 10)
  const contactOffset = randomRadialDisplacement(work, 15)
  const seed = work.rngState >>> 0
  const pulse: BoneyardMageLightningPulse = Object.freeze({
    contact: clearTarget
      ? Object.freeze({
          kind: 'target-attached' as const,
          localOffset: Object.freeze({ ...contactOffset }),
          targetPlayerId: targetPlayerId!,
        })
      : Object.freeze({
          kind: 'world' as const,
          position: Object.freeze({
            x: clipped.x + contactOffset.x,
            y: clipped.y + contactOffset.y,
          }),
        }),
    endpoint: Object.freeze({
      x: endpointBase.x + endpointOffset.x,
      y: endpointBase.y + endpointOffset.y,
    }),
    id: work.nextMageLightningPulseId,
    midpoint: Object.freeze({
      x: (actor.position.x + targetPosition.x) * 0.5,
      y: (actor.position.y + targetPosition.y) * 0.5,
    }),
    ownerActorId: actor.id,
    painterRegistrations: Object.freeze([
      work.registerWorldPainter('actor'),
      work.registerWorldPainter('actor'),
      ...(clearTarget ? [] : [work.registerWorldPainter('actor')]),
    ]),
    seed,
    source: Object.freeze({ ...source }),
    tick: context.tick,
  })
  work.mageLightningPulses.push(pulse)
  work.nextMageLightningPulseId += 1
  const lightningTicksRemaining = brain.lightningTicksRemaining - 1
  return {
    ...actor,
    brain: {
      ...brain,
      lightningTargetPlayerId: lightningTicksRemaining === 0 ? null : targetPlayerId,
      lightningTargetPosition: lightningTicksRemaining === 0
        ? null
        : Object.freeze({ ...targetPosition }),
      lightningTicksRemaining,
    },
  }
}

interface SpawnEnemyProjectileOptions {
  readonly coldSlowTicks?: number
  readonly headingDeg?: number
  readonly lifetimeTicks?: number
  readonly minimumSpeed?: number
  readonly payload?: BoneyardEnemyProjectilePayload
  readonly poisonDamage?: number
  readonly poisonDuration?: number
  readonly position?: Readonly<BoneyardPoint>
  readonly secondaryDamage?: number
  readonly speed?: number
  readonly visualPhaseDeg?: number
}

export function spawnProjectile(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  tick: number,
  kind: BoneyardEnemyProjectileKind,
  damage: number,
  options: SpawnEnemyProjectileOptions = {},
): BoneyardEnemyProjectile {
  const program = BOUNDED_ENEMY_PROJECTILE_PROGRAMS[kind]
  const zombie = actor.config.enemyToken === 'ZOMBIE' ? actor.config.family : null
  const payload = options.payload ?? (kind === 'poison-pool' ? 'poison' : 'none')
  const lightManagerLane = enemyProjectileLightManagerLane(kind, payload)
  const painterRegistration = work.registerProjectileWorldPainter(
    kind === 'arrow' || kind === 'firebolt' ? 'transient' : 'actor',
  )
  const constructedSettledTicksRemaining = kind === 'demon-bomb'
    ? NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.demonBombSettledCountdownMinimum
      + drawEnemyInteger(
          work,
          NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.demonBombSettledCountdownRandomCount,
        )
    : 0
  const headingDeg = options.headingDeg ?? actor.headingDeg
  const visualPhaseDeg = kind === 'guided-missile'
    ? drawEnemyFloat(work, 360)
    : options.visualPhaseDeg ?? (kind === 'arrow' ? headingDeg : 0)
  const turnSpeed = kind === 'guided-missile'
    ? Math.fround(0.5 + drawEnemyFloat(work, 0.75))
    : 0
  const minimumSpeed = options.minimumSpeed ?? (
    kind === 'guided-missile'
      ? Math.fround(NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.guidedMinimumSpeedBase
        + drawEnemyFloat(work, NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.guidedMinimumSpeedRange))
      : 0
  )
  const visualScale = kind === 'arrow'
    ? NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.arrowInitialOpacity
    : kind === 'guided-missile'
      ? Math.fround(0.8999999761581421 + drawEnemyFloat(work, 0.20000004768371582))
      : kind === 'poison-pool'
        ? NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.poisonPoolInitialScale
        : 1
  const boundedSpeed = 'speed' in program ? program.speed : undefined
  const speed = options.speed ?? (
    kind === 'demon-bomb'
      ? Math.fround(NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.demonBombSpeedMinimum
        + drawEnemyFloat(work, NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.demonBombSpeedRange))
      : boundedSpeed
  )
  if (speed === undefined) throw new Error('Arrow birth requires native speed')
  const boundedLifetime = 'lifetimeTicks' in program
    ? program.lifetimeTicks
    : undefined
  const lifetimeTicks = options.lifetimeTicks ?? (
    kind === 'demon-bomb' ? constructedSettledTicksRemaining : boundedLifetime
  )
  if (lifetimeTicks === undefined) throw new Error('Arrow birth requires native lifetime')
  const origin = options.position ?? actor.position
  const forward = kind === 'firebolt' ? 20 : kind === 'guided-missile' ? 5 : 0
  const radians = headingDeg * Math.PI / 180
  const base: BoneyardEnemyProjectileBase = {
    ageTicks: 0,
    bounceVelocity: kind === 'demon-bomb'
      ? NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.demonBombInitialBounceVelocity
      : 0,
    chillTumbleAccumulator: 0,
    coldSlowTicks: options.coldSlowTicks ?? 0,
    contactRadius: program.contactRadius,
    damage: kind === 'poison-pool' ? 0 : damage,
    secondaryDamage: options.secondaryDamage ?? 0,
    headingDeg,
    hitPlayerIds: Object.freeze([]),
    homing: program.homing,
    id: work.nextProjectileId,
    lastStepTick: tick,
    lightRegistration: lightManagerLane === null ? null : painterRegistration,
    lifetimeTicks,
    minimumSpeed,
    nativeTypeId: projectileNativeTypeId(kind),
    nativeCellBindingOrder: work.nextNativeCellBindingOrder,
    nativeRegistrationOrder: work.nextNativeRegistrationOrder,
    ownerActorId: actor.id,
    painterRegistration,
    payload,
    poisonDamage: kind === 'poison-pool' ? damage : (options.poisonDamage ?? 0),
    poisonDuration: kind === 'poison-pool'
      ? (zombie?.poisonDuration ?? 0)
      : (options.poisonDuration ?? 0),
    position: Object.freeze({
      x: Math.fround(origin.x + Math.sin(radians) * forward),
      y: Math.fround(origin.y - Math.cos(radians) * forward),
    }),
    speed,
    settledTicksRemaining: kind === 'arrow'
      ? lifetimeTicks
      : constructedSettledTicksRemaining,
    spawnTick: tick,
    targetPlayerId: actor.targetPlayerId,
    turnSpeed,
    verticalOffset: kind === 'demon-bomb'
      ? NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.demonBombInitialHeight
      : kind === 'arrow'
        ? NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.arrowInitialHeight
        : 0,
    verticalVelocity: 0,
    visualPhaseDeg,
    visualScale,
  }
  const projectile: BoneyardEnemyProjectile = Object.freeze(kind === 'arrow'
    ? { ...base, kind, velocity: nativeEnemyProjectileVelocity(headingDeg, speed) }
    : { ...base, kind })
  work.nextNativeCellBindingOrder += 1
  work.nextNativeRegistrationOrder += 1
  work.nextProjectileId += 1
  work.projectiles.push(projectile)
  emitEvent(work, tick, 'projectile-spawned', actor.id, {
    projectileId: projectile.id,
    targetPlayerId: actor.targetPlayerId,
  })
  return projectile
}

function projectileNativeTypeId(
  kind: BoneyardEnemyProjectileKind,
): BoneyardEnemyProjectile['nativeTypeId'] {
  switch (kind) {
    case 'arrow': return 0x7da
    case 'firebolt': return 0x7eb
    case 'guided-missile': return 0x7ec
    case 'demon-bomb': return 0x7f7
    case 'poison-pool': return 0x806
  }
}
