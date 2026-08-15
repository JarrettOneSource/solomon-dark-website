import {
  BOUNDED_MAGGOT_PROGRAM,
  NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS,
  type BoneyardEnemyActor,
  type BoneyardEnemyBrain,
  type BoneyardMaggotActor,
  type BoneyardEnemyStore,
} from '../core-server/boneyard-enemy-store.ts'
import { BOUNDED_MAGE_LIGHTNING_EFFECT_TICKS } from '../core-kernels/boneyard-enemy-modifiers.ts'
import { boundedImpFlightAnimationSample } from '../core-kernels/boneyard-imp-flight.ts'
import type {
  BoneyardEnemyAction,
  BoneyardEnemyAnimationSnapshot,
  BoneyardEnemyAnimationState,
  BoneyardEnemyCoffinState,
  BoneyardEnemyEffectSnapshot,
  BoneyardEnemyProjectileSnapshot,
  BoneyardEnemySnapshot,
  BoneyardMaggotSnapshot,
} from '../protocol/game-state.ts'

export function projectBoneyardEnemies(
  store: BoneyardEnemyStore,
  tick: number,
): readonly BoneyardEnemySnapshot[] {
  return store.actors.map((actor) => ({
    animation: projectAnimation(actor, tick),
    armored: actor.config.enemyToken === 'SKELETON' && actor.config.family.armor,
    currentHealth: Math.min(actor.config.maximumHealth, actor.currentHealth),
    enemyToken: actor.config.enemyToken,
    flags: actor.config.flags,
    headingDeg: actor.headingDeg,
    id: actor.id,
    maximumHealth: actor.config.maximumHealth,
    nativeTypeId: actor.config.nativeTypeId,
    position: { ...actor.position },
    shieldHealth: actor.shieldHealth,
    shieldMaximumHealth: actor.shieldMaximumHealth,
    spawnTick: actor.spawnTick,
  }))
}

export function projectBoneyardEnemyProjectiles(
  store: BoneyardEnemyStore,
): readonly BoneyardEnemyProjectileSnapshot[] {
  return store.projectiles.map((projectile) => ({
    ageTicks: projectile.ageTicks,
    contactRadius: projectile.contactRadius,
    headingDeg: projectile.headingDeg,
    homing: projectile.homing,
    id: projectile.id,
    kind: projectile.kind,
    lifetimeTicks: projectile.lifetimeTicks,
    nativeTypeId: projectile.nativeTypeId,
    ownerActorId: projectile.ownerActorId,
    payload: projectile.payload,
    position: { ...projectile.position },
    spawnTick: projectile.spawnTick,
  }))
}

export function projectBoneyardMaggots(
  store: BoneyardEnemyStore,
  tick: number,
): readonly BoneyardMaggotSnapshot[] {
  return store.maggots.map((maggot) => {
    const hitAge = maggot.lastDamageTick === null
      ? Number.POSITIVE_INFINITY
      : Math.max(0, tick - maggot.lastDamageTick)
    return {
      alpha: 1,
      currentHealth: maggot.currentHealth,
      deathEpoch: maggot.deathEpoch ?? 0,
      deathTick: maggot.deathTick,
      emergenceTick: maggot.emergenceTick,
      headingDeg: maggot.headingDeg,
      hitFlash: Math.max(0, 1 - hitAge / 5),
      id: maggot.id,
      launchTrajectory: maggot.launchTrajectory,
      maximumHealth: maggot.maximumHealth,
      ownerCoffinActorId: maggot.ownerCoffinActorId,
      pose: maggot.gaitPose,
      position: { ...maggot.position },
      spawnTick: maggot.spawnTick,
      state: maggot.lastAttackTick !== null
        && tick - maggot.lastAttackTick < BOUNDED_MAGGOT_PROGRAM.bitePresentationTicks
        ? 'bite'
        : maggot.lifeState === 'dying'
          ? 'death'
          : maggot.movementPhase === 'emerging'
            ? 'emerging'
            : 'crawl',
      verticalOffset: maggotVerticalOffset(maggot),
    }
  })
}

function projectAnimation(
  actor: BoneyardEnemyActor,
  tick: number,
): BoneyardEnemyAnimationSnapshot {
  const action = actor.lifeState === 'alive' ? brainAction(actor) : null
  const state: BoneyardEnemyAnimationState = actor.lifeState === 'dying'
    ? 'death'
    : action !== null
      ? 'action'
      : actor.lastMovementTick !== null
        && tick - actor.lastMovementTick <= NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS
        ? 'locomotion'
        : 'idle'
  const spawnAge = Math.max(0, tick - actor.spawnTick)
  const gaitPose = actor.gaitPose
  const gaitRadians = gaitPose / 8 * Math.PI * 2
  const coffin = coffinPresentation(actor.brain)
  const impFlight = actor.config.enemyToken === 'IMP' && actor.lifeState === 'alive'
    ? boundedImpFlightAnimationSample(spawnAge)
    : null
  const hitAge = actor.lastDamageTick === null
    ? Number.POSITIVE_INFINITY
    : Math.max(0, tick - actor.lastDamageTick)
  return {
    action,
    actionProgress: actionProgress(actor.brain),
    alpha: actor.brain.family === 'wraith'
      ? actor.brain.alpha
      : impFlight?.alpha ?? 1,
    bodyPose: impFlight?.bodyPose ?? Math.floor(gaitPose),
    coffinPose: coffin.pose,
    coffinSecondaryPose: null,
    coffinState: coffin.state,
    deathEpoch: actor.deathEpoch ?? 0,
    deathTick: actor.deathTick,
    demonFrontJointRotationRadians: Math.sin(gaitRadians + Math.PI) * 0.12,
    demonFrontLimbRotationRadians: Math.sin(gaitRadians) * 0.18,
    demonRearJointRotationRadians: Math.sin(gaitRadians) * 0.12,
    demonRearLimbRotationRadians: Math.sin(gaitRadians + Math.PI) * 0.18,
    effects: projectEnemyEffects(actor, tick),
    gaitPose,
    hitFlash: Math.max(0, 1 - hitAge / 5),
    impEffectFrame: impFlight?.impEffectFrame ?? -1,
    maggots: [],
    state,
    verticalOffset: impFlight?.verticalOffset ?? coffin.verticalOffset,
    zombieAngularOffsetDeg: actor.brain.family === 'zombie'
      ? Math.sin(gaitRadians) * 3
      : 0,
    zombieFrontArmPose: Math.floor(positiveModulo(gaitPose + 1, 5)),
    zombieFrontArmRotationRadians: Math.sin(gaitRadians) * 0.16,
    zombieRearArmPose: Math.floor(positiveModulo(gaitPose + 3, 5)),
    zombieRearArmRotationRadians: Math.sin(gaitRadians + Math.PI) * 0.16,
  }
}

function projectEnemyEffects(
  actor: BoneyardEnemyActor,
  tick: number,
): readonly BoneyardEnemyEffectSnapshot[] {
  if (actor.lifeState !== 'alive') return []
  const effects: BoneyardEnemyEffectSnapshot[] = []
  if (actor.config.burning) {
    effects.push({
      alpha: 1,
      atlas: 'DeadHawg',
      blendMode: 'normal',
      entry: 46 + positiveModulo(tick - actor.spawnTick, 32),
      id: actor.id * 4 + 1,
      offset: { x: 0, y: 0 },
      role: 'burning-fire',
      rotationRadians: 0,
      scale: 1,
    })
  }
  const lightning = actor.lightningEffect
  if (
    lightning !== null
    && tick - lightning.startedTick < BOUNDED_MAGE_LIGHTNING_EFFECT_TICKS
  ) {
    const ageTicks = Math.max(0, tick - lightning.startedTick)
    const alpha = Math.max(0, 1 - ageTicks / BOUNDED_MAGE_LIGHTNING_EFFECT_TICKS)
    effects.push({
      alpha,
      atlas: 'BadGuys',
      blendMode: 'add',
      entry: 381,
      id: lightning.eventId * 4 + 2,
      offset: { x: 0, y: 0 },
      role: 'mage-lightning-source',
      rotationRadians: 0,
      scale: 1,
    }, {
      alpha,
      atlas: 'BadGuys',
      blendMode: 'add',
      entry: 382,
      id: lightning.eventId * 4 + 3,
      offset: {
        x: lightning.targetPosition.x - actor.position.x,
        y: lightning.targetPosition.y - actor.position.y,
      },
      role: 'mage-lightning-target',
      rotationRadians: 0,
      scale: 1,
    })
  }
  return effects
}

function maggotVerticalOffset(maggot: BoneyardMaggotActor): number {
  const progress = Math.min(
    1,
    Math.max(0, maggot.emergenceTick / BOUNDED_MAGGOT_PROGRAM.emergenceTicks),
  )
  const height = BOUNDED_MAGGOT_PROGRAM.launchTrajectories[
    maggot.launchTrajectory
  ].verticalHeight
  return -4 * height * progress * (1 - progress)
}

function brainAction(actor: BoneyardEnemyActor): BoneyardEnemyAction | null {
  const brain = actor.brain
  switch (brain.family) {
    case 'skeleton':
      if (brain.phase !== 'attack') return null
      if (brain.action === 'pike') return 'skeleton-pike'
      if (brain.action === 'weapon') return 'skeleton-weapon'
      return actor.id % 2 === 0 ? 'skeleton-claw-b' : 'skeleton-claw-a'
    case 'archer': return brain.phase === 'attack' ? 'archer-shot' : null
    case 'mage': return brain.phase === 'cast'
      ? brain.castProgram === 'long' ? 'mage-cast-long' : 'mage-cast-short'
      : null
    case 'imp': return brain.phase === 'contact' ? 'imp-contact' : null
    case 'zombie': return brain.phase === 'swipe' ? 'zombie-swipe' : null
    case 'wraith': return brain.phase === 'drain' ? 'wraith-drain' : null
    case 'demon': return brain.phase === 'bomb' ? 'demon-bomb' : null
    case 'coffin': return brain.phase === 'opening' ? 'coffin-open' : null
  }
}

function actionProgress(brain: BoneyardEnemyBrain): number {
  switch (brain.family) {
    case 'skeleton':
    case 'archer':
    case 'mage': return brain.actionProgress
    case 'imp':
    case 'zombie':
    case 'wraith':
    case 'demon': return brain.actionTick
    case 'coffin': return brain.phase === 'opening'
      ? Math.min(12, 3 + brain.phaseTick * 0.2)
      : 0
  }
}

function coffinPresentation(brain: BoneyardEnemyBrain): {
  pose: number
  state: BoneyardEnemyCoffinState
  verticalOffset: number
} {
  if (brain.family !== 'coffin') return { pose: 0, state: 'closed', verticalOffset: 0 }
  switch (brain.phase) {
    case 'hidden': return { pose: 0, state: 'hidden', verticalOffset: 15 }
    case 'rising': return {
      pose: Math.min(3, brain.phaseTick * 0.3),
      state: 'closed',
      verticalOffset: 15 * brain.phaseTicksRemaining / 10,
    }
    case 'holding': return { pose: 3, state: 'closed', verticalOffset: 0 }
    case 'opening': return { pose: 3, state: 'opening', verticalOffset: 0 }
    case 'open': return { pose: 12, state: 'open', verticalOffset: 0 }
    case 'death': return { pose: 12, state: 'open', verticalOffset: 0 }
  }
}

function positiveModulo(value: number, period: number): number {
  return ((value % period) + period) % period
}
