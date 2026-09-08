import { nextBoneyardWaveRandom } from '../../core-kernels/boneyard-wave-timeline.ts'
import { NATIVE_ZOMBIE_BEAT_ACTION_PROGRAM } from '../../core-kernels/boneyard-zombie-beat.ts'
import { nativeDesaturateColor } from '../../core-kernels/native-color.ts'
import { spawnSimpleDeathEffect } from './death-effects.ts'
import { attackMarker, directContactPlayerDamage } from './combat.ts'
import type { BoneyardEnemyActor, BoneyardEnemyStoreStepContext, BoneyardZombieBrain, WorkingStep } from './model.ts'
import { moveTowardTarget, positiveModulo, staffAttackSpeed } from './movement.ts'
import { BOUNDED_ENEMY_ATTACK_REACH } from './programs.ts'
import { drawEnemyFloat, drawEnemyInteger, drawUnit, radialVector, signedUnit } from './random.ts'
import { targetWithinAttackReach, trackEnemyActionHeading } from './targeting.ts'

export function stepZombie(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  brain: BoneyardZombieBrain,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  if (actor.targetPlayerId === null) {
    const reset = resetZombie(actor, brain)
    return moveTowardTarget(work, reset, reset.brain, context, 1)
  }
  if (brain.phase === 'knockback') {
    const remaining = Math.max(0, brain.phaseTicksRemaining - 1)
    return {
      ...actor,
      brain: remaining === 0
        ? {
            ...brain,
            actionProgress: 0,
            actionRate: 0,
            contactTargetPlayerId: null,
            impactStateTicksRemaining: 0,
            markerEmitted: false,
            phase: 'approach',
            phaseTicksRemaining: 0,
          }
        : { ...brain, phaseTicksRemaining: remaining },
    }
  }
  if (brain.phase === 'swipe') {
    const tracked = trackEnemyActionHeading(actor, context.players)
    const previousProgress = brain.actionProgress
    const impactStateTicksRemaining = Math.max(
      0,
      brain.impactStateTicksRemaining - 1,
    )
    const nextProgress = previousProgress
      + brain.actionRate * (brain.impactStateTicksRemaining === 0 ? 2 : 1)
    let markerEmitted = brain.markerEmitted
    let nextImpactStateTicksRemaining = impactStateTicksRemaining
    if (
      !markerEmitted
      && previousProgress < NATIVE_ZOMBIE_BEAT_ACTION_PROGRAM.markerProgress
      && nextProgress >= NATIVE_ZOMBIE_BEAT_ACTION_PROGRAM.markerProgress
    ) {
      const eventId = attackMarker(work, tracked, context.tick, brain.contactTargetPlayerId)
      directContactPlayerDamage(
        work,
        tracked,
        brain.contactTargetPlayerId,
        context.players,
        BOUNDED_ENEMY_ATTACK_REACH.ZOMBIE,
        eventId,
      )
      markerEmitted = true
      nextImpactStateTicksRemaining = NATIVE_ZOMBIE_BEAT_ACTION_PROGRAM.impactStateTicks
    }
    if (nextProgress >= NATIVE_ZOMBIE_BEAT_ACTION_PROGRAM.completionProgress) {
      return {
        ...tracked,
        brain: {
          ...brain,
          actionProgress: 0,
          actionRate: 0,
          contactTargetPlayerId: null,
          impactStateTicksRemaining: nextImpactStateTicksRemaining,
          markerEmitted: false,
          phase: 'knockback',
          phaseTicksRemaining: nextImpactStateTicksRemaining,
        },
      }
    }
    return {
      ...tracked,
      gaitPose: previousProgress < NATIVE_ZOMBIE_BEAT_ACTION_PROGRAM.locomotionEndProgress
        ? positiveModulo(tracked.gaitPose - 0.025, 8)
        : tracked.gaitPose,
      brain: {
        ...brain,
        actionProgress: nextProgress,
        impactStateTicksRemaining: nextImpactStateTicksRemaining,
        markerEmitted,
      },
    }
  }
  if (targetWithinAttackReach(actor, context.players, BOUNDED_ENEMY_ATTACK_REACH.ZOMBIE)) {
    const attackRate = (
      NATIVE_ZOMBIE_BEAT_ACTION_PROGRAM.minimumRate
      + drawUnit(work) * NATIVE_ZOMBIE_BEAT_ACTION_PROGRAM.randomRateRange
    ) * staffAttackSpeed(actor)
    return {
      ...actor,
      brain: {
        ...brain,
        actionProgress: 0,
        actionRate: attackRate,
        attackSide: brain.attackSide === 0 ? 1 : 0,
        contactTargetPlayerId: actor.targetPlayerId,
        impactStateTicksRemaining: 0,
        markerEmitted: false,
        phase: 'swipe',
      },
    }
  }
  return moveTowardTarget(work, actor, brain, context, 1)
}

export function spawnRottenZombieParticle(work: WorkingStep, actor: BoneyardEnemyActor, tick: number): void {
  if (actor.lifeState !== 'alive' || actor.config.enemyToken !== 'ZOMBIE'
    || !actor.config.family.rotten || drawEnemyInteger(work, 75) !== 3) return
  const radius = drawEnemyFloat(work, 8)
  const displacement = radialVector(drawEnemyFloat(work, 360), radius)
  const entry = drawEnemyInteger(work, 2) === 1 ? 10 : 11
  const phaseSpeed = Math.fround(1 + drawEnemyFloat(work, 1))
  const speed = Math.fround(.10000000149011612 + drawEnemyFloat(work, .25 - .10000000149011612))
  const velocity = radialVector(drawEnemyFloat(work, 360), speed)
  const scale = Math.fround(1 + drawEnemyFloat(work, 2))
  const color = nativeDesaturateColor([Math.fround(.1), Math.fround(.3), Math.fround(.1), 1], Math.fround(.65))
  const tint = (Math.trunc(color[0] * 255) << 16) | (Math.trunc(color[1] * 255) << 8) | Math.trunc(color[2] * 255)
  spawnSimpleDeathEffect(work, actor, tick, {
    alpha: 1, alphaLossPerTick: 0, atlas: 'BadGuys', blendMode: 'normal', entry,
    frameVelocity: phaseSpeed, kind: 'move-fade-sin', lifetimeTicks: 181,
    position: { x: Math.fround(actor.position.x + displacement.x), y: Math.fround(actor.position.y - 15 + displacement.y) },
    presentationOwner: 'pre-world-queue', role: 'zombie-rotten-particle', scale, tint,
    velocity: { x: Math.fround(velocity.x), y: Math.fround(velocity.y) },
  })
}

export function advanceZombieVisual(
  source: BoneyardEnemyActor,
  stepped: BoneyardEnemyActor,
): BoneyardEnemyActor {
  if (source.brain.family !== 'zombie' || stepped.brain.family !== 'zombie') return stepped
  const sourceBrain = source.brain
  let visualRngState = sourceBrain.visualRngState
  const random = (): number => {
    const draw = nextBoneyardWaveRandom(visualRngState)
    visualRngState = draw.state
    return draw.value
  }
  const randomInteger = (count: number): number => Math.min(
    count - 1,
    Math.floor(random() * count),
  )
  let bodyPhaseDeg = sourceBrain.bodyPhaseDeg
  let headPhaseDeg = sourceBrain.headPhaseDeg
  let headBaseRotationDeg = sourceBrain.headBaseRotationDeg
  let rearArmBaseRotationDeg = sourceBrain.rearArmBaseRotationDeg
  let frontArmBaseRotationDeg = sourceBrain.frontArmBaseRotationDeg
  let actionSwing = sourceBrain.actionSwing
  let verticalOffset = sourceBrain.verticalOffset
  let verticalVelocity = sourceBrain.verticalVelocity

  if (sourceBrain.phase !== 'swipe') {
    bodyPhaseDeg += random() * 1.5
    headPhaseDeg += random() * 0.75
    if (randomInteger(100) === 5) {
      if (randomInteger(2) === 1) {
        rearArmBaseRotationDeg = random() * 45
      } else {
        frontArmBaseRotationDeg = random() * 45
      }
      if (randomInteger(15) === 3) {
        headBaseRotationDeg = signedUnit(random()) * 65
      }
      if (sourceBrain.bodyType === 3) {
        rearArmBaseRotationDeg /= 3
        frontArmBaseRotationDeg /= 3
        headBaseRotationDeg *= 0.5
      }
    }
  } else {
    const progressIncrement = sourceBrain.actionRate
      * (sourceBrain.impactStateTicksRemaining === 0 ? 2 : 1)
    const nextProgress = sourceBrain.actionProgress + progressIncrement
    actionSwing += sourceBrain.actionRate
      * (sourceBrain.impactStateTicksRemaining === 0 ? 0.5 : 0.25)
    if (sourceBrain.actionProgress < 50 && nextProgress >= 50) {
      verticalOffset = -0.1
      verticalVelocity = -(3 + random() * 0.5)
    }
    if (
      sourceBrain.actionProgress < NATIVE_ZOMBIE_BEAT_ACTION_PROGRAM.markerProgress
      && nextProgress >= NATIVE_ZOMBIE_BEAT_ACTION_PROGRAM.markerProgress
    ) {
      bodyPhaseDeg = 0
      actionSwing = 0
      verticalOffset = -0.1
      verticalVelocity = -(1 + random() * 0.5)
    }
  }

  if (sourceBrain.phase !== 'swipe' && stepped.brain.phase === 'swipe') {
    actionSwing = 0
  }
  if (verticalOffset < 0) {
    verticalOffset += verticalVelocity
    verticalVelocity += 0.4
    if (verticalOffset > 0) verticalOffset = 0
  }
  return {
    ...stepped,
    brain: {
      ...stepped.brain,
      actionSwing,
      angularOffsetDeg: sourceBrain.angularOffsetDeg * 0.95,
      bodyPhaseDeg,
      frontArmBaseRotationDeg,
      headBaseRotationDeg,
      headPhaseDeg,
      rearArmBaseRotationDeg,
      verticalOffset,
      verticalVelocity,
      visualRngState,
    },
  }
}

export function resetZombie(
  actor: BoneyardEnemyActor,
  brain: BoneyardZombieBrain,
): BoneyardEnemyActor {
  return brain.phase === 'approach' ? actor : {
    ...actor,
    brain: {
      ...brain,
      actionProgress: 0,
      actionRate: 0,
      contactTargetPlayerId: null,
      impactStateTicksRemaining: 0,
      markerEmitted: false,
      phase: 'approach',
      phaseTicksRemaining: 0,
    },
  }
}
