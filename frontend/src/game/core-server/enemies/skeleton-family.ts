import type { BoneyardSkeletonWeapon } from '../../core-kernels/boneyard-enemy-config-model.ts'
import { BOUNDED_MAGE_ALLY_SHIELD_RANGE, boundedMageShieldIntervalTicks } from '../../core-kernels/boneyard-enemy-modifiers.ts'
import { NATIVE_MAGE_CAST_BODY_POSES, nativeMageLightningDurationTicks } from '../../core-kernels/boneyard-mage-lightning.ts'
import { NATIVE_ARCHER_SHOT_BODY_POSES, NATIVE_SKELETON_CLAW_BODY_POSES, NATIVE_SKELETON_PIKE_BODY_POSES, NATIVE_SKELETON_WEAPON_BODY_POSES, nativeSkeletonFamilyBodyPose } from '../../core-kernels/boneyard-skeleton-family-animation.ts'
import { nextBoneyardWaveRandom } from '../../core-kernels/boneyard-wave-timeline.ts'
import { stepNativeArcherStrafe } from '../../core-kernels/native-archer-strafe.ts'
import { NATIVE_ENEMY_ACTION_SEED_BOUND, restoreNativeRangeEasyAfterVolley } from '../../core-kernels/native-enemy-targeting.ts'
import { nextEnemyLootSeed } from '../boneyard-enemy-loot-seed.ts'
import { withEnemyLighting } from './actor-update.ts'
import { attackMarker, directContactPlayerDamage } from './combat.ts'
import type { ActionProgram, BoneyardArcherBrain, BoneyardEnemyActor, BoneyardEnemyStoreStepContext, BoneyardMageBrain, BoneyardSkeletonBrain, WorkingStep } from './model.ts'
import { moveTowardTarget, staffAttackSpeed, staffMovementSpeed } from './movement.ts'
import { BOUNDED_ENEMY_ATTACK_REACH, NATIVE_ARCHER_ACTION_PROGRAM, NATIVE_MAGE_ACTION_PROGRAMS, NATIVE_SKELETON_ACTION_PROGRAMS, NATIVE_SKELETON_CLAW_MARKERS, NATIVE_SKELETON_WEAPON_MARKERS } from './programs.ts'
import type { MageLightningDispatch } from './projectile-emission.ts'
import { emitArcherVolley, emitMageAttack, stepMageLightningPulse } from './projectile-emission.ts'
import { enemyTargetLineOfSightIsClear, targetDistance, targetWithinAttackReach, trackEnemyActionHeading } from './targeting.ts'
export function stepMageShields(
  work: WorkingStep,
  context: BoneyardEnemyStoreStepContext,
): void {
  for (let index = 0; index < work.actors.length; index += 1) {
    const source = work.actors[index]!
    const effect = context.abilityEffects?.[source.id]
    if (
      source.lifeState !== 'alive'
      || (effect?.disruptedTicks ?? 0) > 0
      || source.brain.family !== 'mage'
      || source.config.enemyToken !== 'SKELETONMAGE'
      || source.config.family.shieldInterval <= 0
    ) continue
    const remaining = Math.max(0, source.brain.shieldTicksRemaining - 1)
    if (remaining > 0 || source.brain.disabledPrimaryTicks > 0) {
      work.actors[index] = {
        ...source,
        brain: { ...source.brain, shieldTicksRemaining: remaining },
      }
      continue
    }

    let mage = source
    if (source.config.family.selfShield && source.config.family.selfShieldHealth > 0) {
      mage = withRefreshedShield(mage, source.config.family.selfShieldHealth)
    }
    mage = {
      ...mage,
      brain: {
        ...(mage.brain as BoneyardMageBrain),
        shieldTicksRemaining: boundedMageShieldIntervalTicks(
          source.config.family.shieldInterval,
        ),
      },
    }
    work.actors[index] = mage

    if (!source.config.family.otherShield || source.config.family.otherShieldHealth <= 0) continue
    const allyIndex = nearestShieldAllyIndex(work.actors, source, index)
    if (allyIndex >= 0) {
      work.actors[allyIndex] = withRefreshedShield(
        work.actors[allyIndex]!,
        source.config.family.otherShieldHealth,
      )
    }
  }
}

function nearestShieldAllyIndex(
  actors: readonly BoneyardEnemyActor[],
  source: BoneyardEnemyActor,
  sourceIndex: number,
): number {
  let selectedIndex = -1
  let selectedDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index < actors.length; index += 1) {
    if (index === sourceIndex) continue
    const actor = actors[index]!
    if (actor.lifeState !== 'alive') continue
    if (!canReceiveNativeMageAllyShield(actor)) continue
    const distance = Math.hypot(
      actor.position.x - source.position.x,
      actor.position.y - source.position.y,
    )
    if (distance > BOUNDED_MAGE_ALLY_SHIELD_RANGE) continue
    if (
      distance < selectedDistance
      || (
        distance === selectedDistance
        && (selectedIndex < 0 || actor.id < actors[selectedIndex]!.id)
      )
    ) {
      selectedDistance = distance
      selectedIndex = index
    }
  }
  return selectedIndex
}

function canReceiveNativeMageAllyShield(actor: BoneyardEnemyActor): boolean {
  switch (actor.config.enemyToken) {
    case 'SKELETON':
    case 'SKELETONARCHER':
    case 'ZOMBIE':
      return true
    case 'DEMONSKULL':
    case 'DIREFACULTY':
    case 'HEARTMONGER':
    case 'SKELETONMAGE':
    case 'IMP':
    case 'PORTAL':
    case 'WRAITH':
    case 'DEMON':
    case 'COFFIN':
    case 'SPIDER':
    case 'COCOON':
      return false
  }
}

function withRefreshedShield(
  actor: BoneyardEnemyActor,
  strength: number,
): BoneyardEnemyActor {
  const shieldHealth = Math.max(actor.shieldHealth, strength)
  return {
    ...actor,
    shieldHealth,
    shieldMaximumHealth: Math.max(actor.shieldMaximumHealth, shieldHealth),
    shieldPulse: 3,
  }
}

export function applyMageProviderGateAfterAction(
  actor: BoneyardEnemyActor,
): BoneyardEnemyActor {
  if (actor.config.burning || actor.lighting.charge > 0) return actor
  return withEnemyLighting(actor, { ...actor.lighting, providerCopies: 0 })
}

export function magePoseIsFour(actor: BoneyardEnemyActor): boolean {
  return actor.brain.family === 'mage' && Math.floor(actor.bodyPose) === 4
}

export function stepSkeleton(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  brain: BoneyardSkeletonBrain,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  if (actor.targetPlayerId === null) {
    const reset = resetSkeleton(actor, brain)
    return moveTowardTarget(work, reset, reset.brain, context, 1)
  }
  if (brain.phase === 'attack') {
    const tracked = trackEnemyActionHeading(actor, context.players)
    if (brain.action === 'claw') {
      return stepSkeletonClawAction(work, tracked, brain, context)
    }
    if (brain.action === 'weapon') {
      return stepSkeletonWeaponAction(work, tracked, brain, context)
    }
    const program = NATIVE_SKELETON_ACTION_PROGRAMS[brain.action]
    return stepProgressAction(
      work,
      tracked,
      brain,
      program,
      NATIVE_SKELETON_PIKE_BODY_POSES,
      context.tick,
      brain.contactTargetPlayerId,
      (eventId) => {
        directContactPlayerDamage(
          work,
          actor,
          brain.contactTargetPlayerId,
          context.players,
          BOUNDED_ENEMY_ATTACK_REACH.SKELETON,
          eventId,
        )
      },
    )
  }
  if (targetWithinAttackReach(
    actor,
    context.players,
    BOUNDED_ENEMY_ATTACK_REACH.SKELETON,
  )) {
    const bodyPose = brain.action === 'claw'
      ? NATIVE_SKELETON_CLAW_BODY_POSES[
          actor.config.enemyToken === 'SKELETON' && actor.config.family.armor
            ? 'armored'
            : 'unarmored'
        ][0]!
      : brain.action === 'weapon'
        ? NATIVE_SKELETON_WEAPON_BODY_POSES[0]!
        : NATIVE_SKELETON_PIKE_BODY_POSES[0]!
    return {
      ...actor,
      bodyPose,
      brain: {
        ...brain,
        actionProgress: 0,
        contactTargetPlayerId: actor.targetPlayerId,
        markerEmitted: false,
        phase: 'attack',
      },
      lootSeed: nextEnemyLootSeed(work, context.rollLootSeed, NATIVE_ENEMY_ACTION_SEED_BOUND),
    }
  }
  return moveTowardTarget(work, actor, brain, context, 1)
}

function stepSkeletonWeaponAction(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  brain: BoneyardSkeletonBrain,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  const program = NATIVE_SKELETON_ACTION_PROGRAMS.weapon
  const previousProgress = brain.actionProgress
  const actionProgress = previousProgress
    + program.progressPerTick * staffAttackSpeed(actor)
  let markerEmitted = brain.markerEmitted
  for (const marker of NATIVE_SKELETON_WEAPON_MARKERS) {
    if (previousProgress >= marker || actionProgress < marker) continue
    const eventId = attackMarker(
      work,
      actor,
      context.tick,
      brain.contactTargetPlayerId,
    )
    directContactPlayerDamage(
      work,
      actor,
      brain.contactTargetPlayerId,
      context.players,
      BOUNDED_ENEMY_ATTACK_REACH.SKELETON,
      eventId,
    )
    markerEmitted = true
  }
  if (actionProgress > program.strictEnd) {
    return {
      ...actor,
      bodyPose: NATIVE_SKELETON_WEAPON_BODY_POSES[0]!,
      brain: {
        ...brain,
        actionProgress: 0,
        contactTargetPlayerId: null,
        markerEmitted: false,
        phase: 'approach',
      },
    }
  }
  return {
    ...actor,
    bodyPose: nativeSkeletonFamilyBodyPose(
      NATIVE_SKELETON_WEAPON_BODY_POSES,
      actionProgress,
    ),
    brain: { ...brain, actionProgress, markerEmitted },
  }
}

function stepSkeletonClawAction(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  brain: BoneyardSkeletonBrain,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  const program = NATIVE_SKELETON_ACTION_PROGRAMS.claw
  const previousProgress = brain.actionProgress
  const rawProgress = previousProgress
    + program.progressPerTick * staffAttackSpeed(actor)
  const completed = rawProgress > program.strictEnd
  const wrappedProgress = completed
    ? rawProgress - (program.strictEnd + 1)
    : rawProgress
  let markerEmitted = brain.markerEmitted
  for (const marker of NATIVE_SKELETON_CLAW_MARKERS) {
    if (!inclusiveCircularMarkerCrossed(
      previousProgress,
      wrappedProgress,
      marker,
      completed,
    )) continue
    const eventId = attackMarker(
      work,
      actor,
      context.tick,
      brain.contactTargetPlayerId,
    )
    directContactPlayerDamage(
      work,
      actor,
      brain.contactTargetPlayerId,
      context.players,
      BOUNDED_ENEMY_ATTACK_REACH.SKELETON,
      eventId,
    )
    markerEmitted = true
  }
  if (completed) {
    const bodyPoses = actor.config.enemyToken === 'SKELETON'
      && actor.config.family.armor
      ? NATIVE_SKELETON_CLAW_BODY_POSES.armored
      : NATIVE_SKELETON_CLAW_BODY_POSES.unarmored
    return {
      ...actor,
      bodyPose: bodyPoses[0]!,
      brain: {
        ...brain,
        actionProgress: 0,
        contactTargetPlayerId: null,
        markerEmitted: false,
        phase: 'approach',
      },
    }
  }
  const bodyPoses = actor.config.enemyToken === 'SKELETON'
    && actor.config.family.armor
    ? NATIVE_SKELETON_CLAW_BODY_POSES.armored
    : NATIVE_SKELETON_CLAW_BODY_POSES.unarmored
  return {
    ...actor,
    bodyPose: nativeSkeletonFamilyBodyPose(bodyPoses, rawProgress),
    brain: { ...brain, actionProgress: rawProgress, markerEmitted },
  }
}

function inclusiveCircularMarkerCrossed(
  previousProgress: number,
  currentProgress: number,
  marker: number,
  wrapped: boolean,
): boolean {
  return wrapped
    ? marker >= previousProgress || marker <= currentProgress
    : previousProgress <= marker && marker <= currentProgress
}

export function stepArcher(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  brain: BoneyardArcherBrain,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  const stepped = stepArcherAction(work, actor, brain, context)
  if (stepped.brain.family !== 'archer') throw new Error('Archer action changed brain family')
  const target = stepped.targetPlayerId === null ? null : context.players[stepped.targetPlayerId]
  const strafe = stepNativeArcherStrafe(stepped.brain.strafe, {
    attacking: stepped.brain.phase === 'attack',
    enabled: stepped.config.enemyToken === 'SKELETONARCHER' && stepped.config.family.strafing,
    headingDeg: stepped.headingDeg,
    movementScalar: Math.fround(
      stepped.config.chaseSpeed * staffMovementSpeed(stepped) * stepped.config.scale,
    ),
    pathIsClear: (end) => !context.projectileWorldBlocked({
      kind: 'line', nativeExclusionMask: 0,
      end,
      projectileId: stepped.id,
      radius: 0,
      start: stepped.position,
    }),
    position: stepped.position,
    targetPosition: target?.position ?? null,
  })
  const updated = { ...stepped, brain: { ...stepped.brain, strafe: strafe.state } }
  if (strafe.delta === null) return updated
  const position = context.resolveMovement({
    actorId: stepped.id,
    delta: strafe.delta,
    position: stepped.position,
    purpose: 'movement',
    radius: stepped.config.collisionRadius,
    requestedPosition: {
      x: Math.fround(stepped.position.x + strafe.delta.x),
      y: Math.fround(stepped.position.y + strafe.delta.y),
    },
  })
  const gait = Math.fround(stepped.gaitPose + strafe.gaitAdvance)
  return {
    ...updated,
    gaitPose: gait > 8 ? Math.fround(gait - 8) : gait,
    lastMovementTick: context.tick,
    position,
    stridePhaseDeg: Math.fround(stepped.stridePhaseDeg + strafe.strideAdvance),
  }
}


function stepArcherAction(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  brain: BoneyardArcherBrain,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  if (actor.targetPlayerId === null) {
    const reset = resetArcher(actor, brain)
    return moveTowardTarget(work, reset, reset.brain, context, 1)
  }
  if (brain.phase === 'attack') {
    const tracked = trackEnemyActionHeading(actor, context.players)
    let attackRange = brain.attackRange
    let rangeEasyPending = brain.rangeEasyPending
    const stepped = stepProgressAction(
      work,
      tracked,
      brain,
      NATIVE_ARCHER_ACTION_PROGRAM,
      NATIVE_ARCHER_SHOT_BODY_POSES,
      context.tick,
      actor.targetPlayerId,
      () => {
        const restored = restoreNativeRangeEasyAfterVolley(
          attackRange,
          rangeEasyPending,
        )
        attackRange = restored.range
        rangeEasyPending = restored.pending
        emitArcherVolley(work, tracked, brain.aimSeed, context)
      },
    )
    if (stepped.brain.family !== 'archer') throw new Error('Archer action changed brain family')
    return {
      ...stepped,
      brain: { ...stepped.brain, attackRange, rangeEasyPending },
    }
  }
  const distance = targetDistance(actor, context.players)
  if (
    distance < brain.attackRange
    && enemyTargetLineOfSightIsClear(actor, context)
  ) {
    const aimSeed = nextEnemyLootSeed(work, context.rollLootSeed, NATIVE_ENEMY_ACTION_SEED_BOUND)
    return {
      ...actor,
      bodyPose: NATIVE_ARCHER_SHOT_BODY_POSES[0]!,
      brain: {
        ...brain,
        actionProgress: 0,
        aimSeed,
        markerEmitted: false,
        phase: 'attack',
      },
      lootSeed: aimSeed,
    }
  }
  return moveTowardTarget(work, actor, brain, context, 1)
}

export function stepMage(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  brain: BoneyardMageBrain,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  const lightningDispatches: MageLightningDispatch[] = []
  let stepped: BoneyardEnemyActor
  if (actor.targetPlayerId === null) {
    const reset = resetMage(actor, brain)
    stepped = moveTowardTarget(work, reset, reset.brain, context, 1)
  } else if (brain.phase === 'cast') {
    const tracked = trackEnemyActionHeading(actor, context.players)
    const base = NATIVE_MAGE_ACTION_PROGRAMS[brain.castProgram]
    let attackRange = brain.attackRange
    let rangeEasyPending = brain.rangeEasyPending
    let spellDispatched = false
    stepped = stepProgressAction(
      work,
      tracked,
      brain,
      { ...base, progressPerTick: base.progressPerTick * (1 + brain.castRoll) },
      NATIVE_MAGE_CAST_BODY_POSES[brain.castProgram],
      context.tick,
      actor.targetPlayerId,
      () => {
        spellDispatched = true
        const restored = restoreNativeRangeEasyAfterVolley(
          attackRange,
          rangeEasyPending,
        )
        attackRange = restored.range
        rangeEasyPending = restored.pending
        const dispatch = emitMageAttack(work, tracked, context)
        if (dispatch !== null) lightningDispatches.push(dispatch)
      },
    )
    if (stepped.brain.family !== 'mage') throw new Error('Mage cast changed brain family')
    stepped = {
      ...stepped,
      brain: { ...stepped.brain, attackRange, rangeEasyPending },
    }
    if (spellDispatched && actor.config.enemyToken === 'SKELETONMAGE') stepped = {
      ...stepped,
      lighting: {
        ...stepped.lighting,
        charge: actor.config.family.element === 'lightning' ? 1 : 0,
      },
    }
  } else {
    const distance = targetDistance(actor, context.players)
    if (
      brain.disabledPrimaryTicks === 0
      && distance < brain.attackRange
      && enemyTargetLineOfSightIsClear(actor, context)
    ) {
      const program = nextBoneyardWaveRandom(work.rngState)
      const roll = nextBoneyardWaveRandom(program.state)
      work.rngState = roll.state
      // Mage action scheduling and cast scheduling are separate native writers;
      // the second value is the death-time seed retained by the actor.
      nextEnemyLootSeed(work, context.rollLootSeed, NATIVE_ENEMY_ACTION_SEED_BOUND)
      const lootSeed = nextEnemyLootSeed(work, context.rollLootSeed, NATIVE_ENEMY_ACTION_SEED_BOUND)
      stepped = {
        ...actor,
        bodyPose: NATIVE_MAGE_CAST_BODY_POSES[
          program.value < 0.5 ? 'short' : 'long'
        ][0]!,
        brain: {
          ...brain,
          actionProgress: 0,
          castProgram: program.value < 0.5 ? 'short' : 'long',
          castRoll: roll.value,
          markerEmitted: false,
          phase: 'cast',
        },
        lootSeed,
      }
    } else {
      stepped = moveTowardTarget(work, actor, brain, context, 1)
    }
  }
  const dispatchedLightning = lightningDispatches[0]
  if (dispatchedLightning !== undefined) {
    const steppedBrain = stepped.brain
    if (steppedBrain.family !== 'mage') throw new Error('Mage dispatch changed brain family')
    stepped = {
      ...stepped,
      brain: {
        ...steppedBrain,
        lightningTargetPlayerId: dispatchedLightning.targetPlayerId,
        lightningTargetPosition: dispatchedLightning.targetPosition,
        lightningTicksRemaining: nativeMageLightningDurationTicks(staffAttackSpeed(actor)),
      },
    }
  }
  return stepMageLightningPulse(work, stepped, context)
}

function stepProgressAction<B extends BoneyardSkeletonBrain | BoneyardArcherBrain | BoneyardMageBrain>(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  brain: B,
  program: ActionProgram,
  bodyPoses: readonly number[],
  tick: number,
  markerTargetPlayerId: string | null,
  onMarker: (eventId: number) => void,
): BoneyardEnemyActor {
  const actionProgress = brain.actionProgress
    + program.progressPerTick * staffAttackSpeed(actor)
  let markerEmitted = brain.markerEmitted
  if (!markerEmitted && actionProgress >= program.markerProgress) {
    const eventId = attackMarker(work, actor, tick, markerTargetPlayerId)
    onMarker(eventId)
    markerEmitted = true
  }
  if (actionProgress > program.strictEnd) {
    const completedBrain = brain.family === 'skeleton'
      ? {
          ...brain,
          actionProgress: 0,
          contactTargetPlayerId: null,
          markerEmitted: false,
          phase: 'approach' as const,
        }
      : { ...brain, actionProgress: 0, markerEmitted: false, phase: 'range-control' as const }
    return {
      ...actor,
      brain: completedBrain,
    }
  }
  return {
    ...actor,
    bodyPose: nativeSkeletonFamilyBodyPose(bodyPoses, actionProgress),
    brain: { ...brain, actionProgress, markerEmitted },
  }
}

export function skeletonAction(weapon: BoneyardSkeletonWeapon): 'claw' | 'pike' | 'weapon' {
  if (weapon === 'claw') return 'claw'
  if (weapon === 'pike') return 'pike'
  return 'weapon'
}

export function resetSkeleton(
  actor: BoneyardEnemyActor,
  brain: BoneyardSkeletonBrain,
): BoneyardEnemyActor {
  return brain.phase === 'approach' ? actor : {
    ...actor,
    brain: {
      ...brain,
      actionProgress: 0,
      contactTargetPlayerId: null,
      markerEmitted: false,
      phase: 'approach',
    },
  }
}

export function resetArcher(
  actor: BoneyardEnemyActor,
  brain: BoneyardArcherBrain,
): BoneyardEnemyActor {
  return brain.phase === 'range-control' ? actor : {
    ...actor,
    brain: { ...brain, actionProgress: 0, markerEmitted: false, phase: 'range-control' },
  }
}

export function resetMage(actor: BoneyardEnemyActor, brain: BoneyardMageBrain): BoneyardEnemyActor {
  return brain.phase === 'range-control' ? actor : {
    ...actor,
    brain: { ...brain, actionProgress: 0, markerEmitted: false, phase: 'range-control' },
  }
}
