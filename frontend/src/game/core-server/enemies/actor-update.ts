import {
  NATIVE_SKELETON_HEAD_FACING_OFFSETS,
  NATIVE_SKELETON_HEAD_TURN_ROLL_COUNT,
  NATIVE_SKELETON_HEAD_TURN_ROLL_WINNER,
} from '../../core-kernels/boneyard-skeleton-family-animation.ts'
import { NATIVE_HURRICANE_DEFAULT_MOVEMENT_STEP } from '../../core-kernels/native-hurricane.ts'
import { drawNativeInteger } from '../../core-kernels/native-rng.ts'
import { stepCoffin } from './coffin.ts'
import { snapDemonRootToExtremities, stepDemon } from './demon.ts'
import { stepImp } from './imp.ts'
import type {
  BoneyardEnemyActor,
  BoneyardEnemyLightingState,
  BoneyardEnemyStoreStepContext,
  WorkingStep,
} from './model.ts'
import {
  interruptNativeSecondaryAction,
  moveTowardTarget,
  nativeSecondaryActorSpeedScale,
  withNativeSecondaryTickScalars,
} from './movement.ts'
import { stepPortal } from './portal.ts'
import { NATIVE_ENEMY_BURN_GLOW_PER_TICK, NATIVE_ENEMY_CHARGE_PER_TICK, NATIVE_IMP_GLOW_PER_TICK } from './programs.ts'
import {
  applyMageProviderGateAfterAction,
  magePoseIsFour,
  stepArcher,
  stepMage,
  stepSkeleton,
} from './skeleton-family.ts'
import { stepCocoonActor, stepSpider } from './spider.ts'
import { refreshTarget, reorientEnemyTowardTarget } from './targeting.ts'
import { stepWraith } from './wraith.ts'
import { advanceZombieVisual, stepZombie } from './zombie.ts'

export function stepDamagePresentationTimers(
  actor: BoneyardEnemyActor,
  elapsedTicks: number,
): BoneyardEnemyActor {
  if (elapsedTicks <= 0) return actor
  if (actor.brain.family === 'spider') {
    actor = { ...actor, brain: { ...actor.brain, spitTicksRemaining: Math.max(0, actor.brain.spitTicksRemaining - elapsedTicks) } }
  }
  const hurricaneContactCooldown = Math.max(
    0,
    actor.hurricaneContactCooldown
      - elapsedTicks * NATIVE_HURRICANE_DEFAULT_MOVEMENT_STEP,
  )
  const shieldPulse = Math.max(0, actor.shieldPulse - elapsedTicks * 0.05)
  const shieldSoundCooldownTicks = Math.max(
    0,
    actor.shieldSoundCooldownTicks - elapsedTicks,
  )
  return shieldPulse === actor.shieldPulse
    && shieldSoundCooldownTicks === actor.shieldSoundCooldownTicks
    && hurricaneContactCooldown === actor.hurricaneContactCooldown
    ? actor
    : { ...actor, hurricaneContactCooldown, shieldPulse, shieldSoundCooldownTicks }
}

export function stepLivingActor(
  work: WorkingStep,
  source: BoneyardEnemyActor,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  if (source.brain.family === 'cocoon') return stepCocoonActor(work, source, context)
  const effect = context.abilityEffects?.[source.id]
  work.pathStatusFactors.set(
    source.id,
    source.staffMovementFactor * nativeSecondaryActorSpeedScale(effect),
  )
  const affected = effect === undefined
    ? source
    : withNativeSecondaryTickScalars(source, effect)
  let actor = affected.brain.family === 'portal'
    ? affected
    : refreshTarget(affected, context)
  if (actor.brain.family === 'demon') actor = snapDemonRootToExtremities(actor)
  if (actor.brain.family === 'portal') {
    return (effect?.timeScale ?? 1) === 0
      ? stepEnemyLighting(actor)
      : stepEnemyLighting(stepPortal(work, actor, actor.brain, context))
  }
  if ((effect?.disruptedTicks ?? 0) > 0) {
    const interrupted = clearSkeletonFamilyHeadFacing(
      interruptNativeSecondaryAction(actor),
    )
    const lit = stepEnemyLighting(interrupted)
    return lit.brain.family === 'mage'
      ? applyMageProviderGateAfterAction(lit)
      : lit
  }
  if (effect?.timeScale === 0) {
    const lit = stepEnemyLighting(actor)
    return lit.brain.family === 'mage'
      ? applyMageProviderGateAfterAction(lit)
      : lit
  }
  if (
    actor.path.reorientationTicksRemaining > 0
    && actor.brain.family !== 'coffin'
  ) {
    const reoriented = reorientEnemyTowardTarget(actor, context.players)
    const lit = stepEnemyLighting(reoriented)
    return lit.brain.family === 'mage'
      ? applyMageProviderGateAfterAction(lit)
      : lit
  }
  if ((effect?.fleeTicks ?? 0) > 0 && actor.brain.family !== 'coffin') {
    const interrupted = clearSkeletonFamilyHeadFacing(
      interruptNativeSecondaryAction(actor),
    )
    const fled = moveTowardTarget(
      work,
      interrupted,
      interrupted.brain,
      context,
      -1,
    )
    return stepEnemyLighting(fled)
  }
  const articulated = rollSkeletonFamilyHeadFacing(work, actor)
  if (articulated.brain.family === 'mage') {
    const enrolled = stepEnemyLighting(articulated)
    return applyMageProviderGateAfterAction(
      finalizeSkeletonFamilyHeadFacing(
        articulated,
        stepMage(work, enrolled, articulated.brain, context),
      ),
    )
  }
  const stepped = (() => {
    switch (articulated.brain.family) {
      case 'spider': return stepSpider(work, articulated, articulated.brain, context)
      case 'cocoon': return stepCocoonActor(work, articulated, context)
      case 'skeleton': return stepSkeleton(work, articulated, articulated.brain, context)
      case 'archer': return stepArcher(work, articulated, articulated.brain, context)
      case 'imp': return stepImp(work, articulated, articulated.brain, context)
      case 'portal': return stepPortal(work, articulated, articulated.brain, context)
      case 'zombie': return advanceZombieVisual(
        articulated,
        stepZombie(work, articulated, articulated.brain, context),
      )
      case 'wraith': return stepWraith(work, articulated, articulated.brain, context)
      case 'demon': return stepDemon(work, articulated, articulated.brain, context)
      case 'coffin': return stepCoffin(work, articulated, articulated.brain, context)
    }
  })()
  return stepEnemyLighting(finalizeSkeletonFamilyHeadFacing(articulated, stepped))
}

function rollSkeletonFamilyHeadFacing(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
): BoneyardEnemyActor {
  if (
    (actor.brain.family !== 'skeleton' && actor.brain.family !== 'mage')
    || actor.targetPlayerId === null
  ) return actor
  const gate = drawNativeInteger(
    work.headFacingRngState,
    NATIVE_SKELETON_HEAD_TURN_ROLL_COUNT,
  )
  work.headFacingRngState = gate.state
  if (gate.value !== NATIVE_SKELETON_HEAD_TURN_ROLL_WINNER) return actor
  const offset = drawNativeInteger(
    work.headFacingRngState,
    NATIVE_SKELETON_HEAD_FACING_OFFSETS.length,
  )
  work.headFacingRngState = offset.state
  const headFacingOffset = NATIVE_SKELETON_HEAD_FACING_OFFSETS[
    offset.value
  ]!
  return headFacingOffset === actor.headFacingOffset
    ? actor
    : { ...actor, headFacingOffset }
}

function finalizeSkeletonFamilyHeadFacing(
  source: BoneyardEnemyActor,
  stepped: BoneyardEnemyActor,
): BoneyardEnemyActor {
  if (
    stepped.brain.family === 'skeleton'
    && stepped.brain.phase === 'attack'
  ) return stepped
  if (
    source.brain.family === 'mage'
    && source.brain.phase === 'cast'
    && stepped.brain.family === 'mage'
    && stepped.brain.phase === 'cast'
  ) return stepped
  return clearSkeletonFamilyHeadFacing(stepped)
}

function clearSkeletonFamilyHeadFacing(
  actor: BoneyardEnemyActor,
): BoneyardEnemyActor {
  return actor.headFacingOffset === 0
    ? actor
    : { ...actor, headFacingOffset: 0 }
}

function stepEnemyLighting(actor: BoneyardEnemyActor): BoneyardEnemyActor {
  const prior = actor.lighting
  const active = actor.config.scale !== 0
  switch (actor.config.enemyToken) {
    case 'SPIDER':
    case 'COCOON': return actor
    case 'SKELETON': {
      const burning = active && actor.config.burning
      return withEnemyLighting(actor, {
        ...prior,
        glow: burning
          ? Math.min(1, prior.glow + NATIVE_ENEMY_BURN_GLOW_PER_TICK)
          : prior.glow,
        providerCopies: burning ? 1 : 0,
      })
    }
    case 'SKELETONARCHER': {
      if (!active) return withEnemyLighting(actor, { ...prior, providerCopies: 0 })
      const burning = actor.config.burning
      return withEnemyLighting(actor, {
        charge: Math.min(1, prior.charge + NATIVE_ENEMY_CHARGE_PER_TICK),
        glow: burning
          ? Math.min(1, prior.glow + NATIVE_ENEMY_BURN_GLOW_PER_TICK)
          : prior.glow,
        providerCopies: (
          Number(actor.config.family.arrowType === 'fire') + Number(burning)
        ) as 0 | 1 | 2,
      })
    }
    case 'SKELETONMAGE': {
      if (!active) return withEnemyLighting(actor, { ...prior, providerCopies: 0 })
      const burning = actor.config.burning
      const once = burning
        ? Math.min(1, prior.glow + NATIVE_ENEMY_BURN_GLOW_PER_TICK)
        : prior.glow
      const glow = burning
        ? Math.min(1, once + NATIVE_ENEMY_BURN_GLOW_PER_TICK)
        : once
      const charge = magePoseIsFour(actor)
        ? prior.charge
        : Math.min(1, prior.charge + NATIVE_ENEMY_CHARGE_PER_TICK)
      return withEnemyLighting(actor, {
        charge,
        glow,
        providerCopies: burning ? 2 : charge > 0 ? 1 : 0,
      })
    }
    case 'IMP': {
      const glow = Math.min(1, prior.glow + NATIVE_IMP_GLOW_PER_TICK)
      return withEnemyLighting(actor, {
        charge: prior.charge,
        glow,
        providerCopies: active ? 1 : 0,
      })
    }
    case 'PORTAL':
      return withEnemyLighting(actor, {
        charge: actor.brain.family === 'portal' ? actor.brain.alpha : prior.charge,
        glow: actor.brain.family === 'portal' ? actor.brain.alpha : prior.glow,
        providerCopies: active ? 1 : 0,
      })
    case 'WRAITH': {
      const burning = actor.config.burning
      return withEnemyLighting(actor, {
        ...prior,
        glow: burning
          ? Math.min(1, prior.glow + NATIVE_ENEMY_BURN_GLOW_PER_TICK)
          : prior.glow,
        providerCopies: burning ? 1 : 0,
      })
    }
    case 'DEMON':
      return withEnemyLighting(actor, { ...prior, providerCopies: 1 })
    case 'COFFIN':
      return withEnemyLighting(actor, {
        ...prior,
        providerCopies: actor.brain.family === 'coffin'
          && actor.brain.phase !== 'hidden'
          ? 1
          : 0,
      })
    case 'ZOMBIE':
      return withEnemyLighting(actor, { ...prior, providerCopies: 0 })
  }
}

export function withEnemyLighting(
  actor: BoneyardEnemyActor,
  lighting: BoneyardEnemyLightingState,
): BoneyardEnemyActor {
  return { ...actor, lighting }
}
