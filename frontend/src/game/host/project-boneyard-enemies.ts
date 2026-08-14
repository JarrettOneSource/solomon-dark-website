import {
  NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS,
  type BoneyardEnemyActor,
  type BoneyardEnemyBrain,
  type BoneyardEnemyStore,
} from '../core-server/boneyard-enemy-store.ts'
import type {
  BoneyardEnemyAction,
  BoneyardEnemyAnimationSnapshot,
  BoneyardEnemyAnimationState,
  BoneyardEnemyCoffinState,
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
    currentHealth: Math.min(actor.config.maximumHealth, actor.currentHealth),
    enemyToken: actor.config.enemyToken,
    flags: actor.config.flags,
    headingDeg: actor.headingDeg,
    id: actor.id,
    maximumHealth: actor.config.maximumHealth,
    nativeTypeId: actor.config.nativeTypeId,
    position: { ...actor.position },
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
      headingDeg: maggot.headingDeg,
      hitFlash: Math.max(0, 1 - hitAge / 5),
      id: maggot.id,
      maximumHealth: maggot.maximumHealth,
      ownerCoffinActorId: maggot.ownerCoffinActorId,
      pose: maggot.gaitPose,
      position: { ...maggot.position },
      spawnTick: maggot.spawnTick,
      state: maggot.lifeState === 'dying'
        ? 'death'
        : maggot.lastAttackTick !== null && tick - maggot.lastAttackTick < 6
          ? 'bite'
          : 'crawl',
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
  const hitAge = actor.lastDamageTick === null
    ? Number.POSITIVE_INFINITY
    : Math.max(0, tick - actor.lastDamageTick)
  return {
    action,
    actionProgress: actionProgress(actor.brain),
    alpha: actor.brain.family === 'wraith' ? actor.brain.alpha : 1,
    bodyPose: Math.floor(gaitPose),
    coffinPose: coffin.pose,
    coffinSecondaryPose: null,
    coffinState: coffin.state,
    deathEpoch: actor.deathEpoch ?? 0,
    deathTick: actor.deathTick,
    demonFrontJointRotationRadians: Math.sin(gaitRadians + Math.PI) * 0.12,
    demonFrontLimbRotationRadians: Math.sin(gaitRadians) * 0.18,
    demonRearJointRotationRadians: Math.sin(gaitRadians) * 0.12,
    demonRearLimbRotationRadians: Math.sin(gaitRadians + Math.PI) * 0.18,
    effects: [],
    gaitPose,
    hitFlash: Math.max(0, 1 - hitAge / 5),
    impEffectFrame: actor.config.enemyToken === 'IMP' && spawnAge < 10
      ? Math.floor(spawnAge)
      : -1,
    maggots: [],
    state,
    verticalOffset: coffin.verticalOffset,
    zombieAngularOffsetDeg: actor.brain.family === 'zombie'
      ? Math.sin(gaitRadians) * 3
      : 0,
    zombieFrontArmPose: Math.floor(positiveModulo(gaitPose + 1, 5)),
    zombieFrontArmRotationRadians: Math.sin(gaitRadians) * 0.16,
    zombieRearArmPose: Math.floor(positiveModulo(gaitPose + 3, 5)),
    zombieRearArmRotationRadians: Math.sin(gaitRadians + Math.PI) * 0.16,
  }
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
