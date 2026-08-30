import {
  NATIVE_MAGGOT_PROGRAM,
  NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS,
  nativeEnemyHitOverlay,
  type BoneyardEnemyActor,
  type BoneyardEnemyBrain,
  type BoneyardEnemyDeathEffect,
  type BoneyardMaggotActor,
  type BoneyardMageLightningPulse,
  type BoneyardEnemyStore,
} from '../core-server/boneyard-enemy-store.ts'
import { actorHeadingFromVector } from '../core-kernels/actor-heading.ts'
import {
  NATIVE_DEMON_BOMB_CONTROLLER_POSES,
  nativeDemonArticulationSample,
} from '../core-kernels/boneyard-demon-articulation.ts'
import { nativeImpEffectFrame } from '../core-kernels/boneyard-imp-flight.ts'
import {
  nativeZombieArticulationPose,
  nativeZombieBeatPose,
} from '../core-kernels/boneyard-zombie-beat.ts'
import type {
  BoneyardEnemyAction,
  BoneyardEnemyAnimationSnapshot,
  BoneyardEnemyAnimationState,
  BoneyardEnemyCoffinState,
  BoneyardEnemyEffectSnapshot,
  BoneyardEnemyDeathEffectSnapshot,
  BoneyardEnemyProjectileSnapshot,
  BoneyardEnemyProjectileEffectSnapshot,
  BoneyardEnemySnapshot,
  BoneyardMageLightningPulseSnapshot,
  BoneyardMaggotSnapshot,
} from '../protocol/game-state.ts'

export function projectBoneyardEnemyDeathEffects(
  store: BoneyardEnemyStore,
): readonly BoneyardEnemyDeathEffectSnapshot[] {
  return store.deathEffects.filter((effect) => (
    effect.spawnTick <= store.lastStepTick
  )).map(projectBoneyardEnemyDeathEffect)
}

export function projectBoneyardEnemyDeathEffect(
  effect: BoneyardEnemyDeathEffect,
): BoneyardEnemyDeathEffectSnapshot {
  return {
    ageTicks: effect.ageTicks,
    alpha: effect.alpha,
    atlas: effect.atlas,
    blendMode: effect.blendMode,
    entry: effect.entry,
    height: effect.height,
    id: effect.id,
    kind: effect.kind,
    ownerActorId: effect.ownerActorId,
    painterRegistration: effect.painterRegistration,
    presentationOwner: effect.presentationOwner,
    position: { ...effect.position },
    rotationRadians: effect.rotationDeg * Math.PI / 180,
    scale: effect.scale,
    shadow: effect.shadow,
    spawnTick: effect.spawnTick,
    tint: effect.tint,
  }
}

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
    lightRegistration: actor.lightRegistration,
    lighting: { ...actor.lighting },
    mageCloak: actor.config.enemyToken === 'SKELETONMAGE'
      && actor.config.family.cloak,
    maximumHealth: actor.config.maximumHealth,
    nativeTypeId: actor.config.nativeTypeId,
    position: { ...actor.position },
    scale: actor.config.scale,
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
    lightRegistration: projectile.lightRegistration,
    lifetimeTicks: projectile.lifetimeTicks,
    nativeTypeId: projectile.nativeTypeId,
    ownerActorId: projectile.ownerActorId,
    painterRegistration: projectile.painterRegistration,
    payload: projectile.payload,
    position: { ...projectile.position },
    speed: projectile.speed,
    spawnTick: projectile.spawnTick,
    verticalOffset: projectile.verticalOffset,
    visualPhaseDeg: ((projectile.visualPhaseDeg % 720) + 720) % 720,
    visualScale: projectile.visualScale,
  }))
}

export function projectBoneyardEnemyProjectileEffects(
  store: BoneyardEnemyStore,
): readonly BoneyardEnemyProjectileEffectSnapshot[] {
  return store.projectileEffects.map((effect) => ({
    ageTicks: effect.ageTicks,
    alpha: effect.alpha,
    atlas: effect.atlas,
    blendMode: effect.blendMode,
    entry: effect.entry,
    id: effect.id,
    kind: effect.kind,
    lightRegistration: effect.lightRegistration,
    lifetimeTicks: effect.lifetimeTicks,
    ownerActorId: effect.ownerActorId,
    ownerProjectileId: effect.ownerProjectileId,
    painterRegistration: effect.painterRegistration,
    phaseOriginTicks: effect.phaseOriginTicks,
    position: { ...effect.position },
    rotationRadians: effect.rotationDeg * Math.PI / 180,
    scale: effect.scale,
    spawnTick: effect.spawnTick,
    tint: effect.tint,
  }))
}

export function projectBoneyardMageLightningPulses(
  store: BoneyardEnemyStore,
): readonly BoneyardMageLightningPulseSnapshot[] {
  return store.mageLightningPulses.map(projectBoneyardMageLightningPulse)
}

function projectBoneyardMageLightningPulse(
  pulse: BoneyardMageLightningPulse,
): BoneyardMageLightningPulseSnapshot {
  return {
    contact: pulse.contact.kind === 'world'
      ? { kind: 'world', position: { ...pulse.contact.position } }
      : {
          kind: 'target-attached',
          localOffset: { ...pulse.contact.localOffset },
          targetPlayerId: pulse.contact.targetPlayerId,
        },
    endpoint: { ...pulse.endpoint },
    id: pulse.id,
    midpoint: { ...pulse.midpoint },
    ownerActorId: pulse.ownerActorId,
    painterRegistrations: pulse.painterRegistrations.map((registration) => ({
      ...registration,
    })),
    seed: pulse.seed,
    source: { ...pulse.source },
    tick: pulse.tick,
  }
}

export function projectBoneyardMaggots(
  store: BoneyardEnemyStore,
  tick: number,
): readonly BoneyardMaggotSnapshot[] {
  return store.maggots.map((maggot) => {
    return {
      alpha: 1,
      currentHealth: maggot.currentHealth,
      deathEpoch: maggot.deathEpoch ?? 0,
      deathTick: maggot.deathTick,
      emergencePhase: maggot.emergencePhase,
      emergenceTick: maggot.emergenceTick,
      emergenceOrientation: maggotEmergenceOrientation(maggot),
      headingDeg: maggot.headingDeg,
      hitFlash: nativeEnemyHitOverlay(maggot.lastDamageTick, tick),
      id: maggot.id,
      launchTrajectory: maggot.launchTrajectory,
      lightRegistration: maggot.lightRegistration,
      maximumHealth: maggot.maximumHealth,
      ownerCoffinActorId: maggot.ownerCoffinActorId,
      pose: maggot.gaitPose,
      position: { ...maggot.position },
      spawnTick: maggot.spawnTick,
      state: maggot.lastAttackTick !== null
        && tick - maggot.lastAttackTick < NATIVE_MAGGOT_PROGRAM.bitePresentationTicks
        ? 'bite'
        : maggot.lifeState === 'dying'
          ? 'death'
          : maggot.movementPhase === 'emerging'
            ? 'emerging'
            : 'crawl',
      verticalOffset: maggotVerticalOffset(maggot),
      visualScale: maggot.visualScale,
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
  const gaitPose = actor.gaitPose
  const coffin = coffinPresentation(actor.brain)
  const impBrain = actor.brain.family === 'imp' ? actor.brain : null
  const zombieBrain = actor.brain.family === 'zombie' ? actor.brain : null
  const zombieBeat = zombieBrain?.phase === 'swipe'
    ? nativeZombieBeatPose(zombieBrain.actionProgress, zombieBrain.attackSide)
    : null
  const zombieArticulation = zombieBrain
    ? nativeZombieArticulationPose({
        actionActive: zombieBrain.phase === 'swipe',
        actionSwing: zombieBrain.actionSwing,
        attackSide: zombieBrain.attackSide,
        bodyPhaseDeg: zombieBrain.bodyPhaseDeg,
        frontArmBaseRotationDeg: zombieBrain.frontArmBaseRotationDeg,
        headBaseRotationDeg: zombieBrain.headBaseRotationDeg,
        headPhaseDeg: zombieBrain.headPhaseDeg,
        rearArmBaseRotationDeg: zombieBrain.rearArmBaseRotationDeg,
      })
    : null
  const demonBrain = actor.brain.family === 'demon' ? actor.brain : null
  const demonControllerPose = demonBrain?.phase === 'bomb'
    ? NATIVE_DEMON_BOMB_CONTROLLER_POSES[Math.min(
        Math.floor(demonBrain.actionProgress),
        NATIVE_DEMON_BOMB_CONTROLLER_POSES.length - 1,
      )]!
    : 0
  const demonSampleTick = actor.lifeState === 'dying'
    ? actor.deathStartedTick ?? tick
    : tick
  const demonArticulation = demonBrain
    ? nativeDemonArticulationSample(demonSampleTick, actor.spawnTick, demonControllerPose)
    : null
  return {
    action,
    actionProgress: actionProgress(actor.brain),
    alpha: actor.brain.family === 'portal' ? actor.brain.alpha : 1,
    bodyPose: impBrain
      ? impBrain.bodyVariant
      : demonBrain
        ? demonControllerPose
        : actor.bodyPose,
    coffinPose: coffin.pose,
    coffinRotationRadians: actor.brain.family === 'coffin'
      ? actor.brain.launchRotationDeg * Math.PI / 180
      : 0,
    coffinScaleX: actor.brain.family === 'coffin' ? actor.brain.launchScale : 1,
    coffinSecondaryPose: null,
    coffinState: coffin.state,
    deathEpoch: actor.deathEpoch ?? 0,
    deathTick: actor.deathTick,
    demonFrontJointRotationRadians: demonArticulation?.frontRotationRadians ?? 0,
    demonFrontLimbRotationRadians: demonArticulation?.frontRotationRadians ?? 0,
    demonRearJointRotationRadians: demonArticulation?.rearRotationRadians ?? 0,
    demonRearLimbRotationRadians: demonArticulation?.rearRotationRadians ?? 0,
    effects: projectEnemyEffects(actor, tick),
    gaitPose,
    headFacingOffset: actor.headFacingOffset,
    hitFlash: actor.brain.family === 'portal'
      ? Math.min(1, actor.brain.hurtTicksRemaining / 24)
      : nativeEnemyHitOverlay(actor.lastDamageTick, tick),
    impBodyRotationRadians: (impBrain?.bodyRotationDeg ?? 0) * Math.PI / 180,
    impEffectAlpha: impBrain?.effectAlpha ?? 0,
    impEffectFrame: impBrain ? nativeImpEffectFrame(impBrain.effectPhase) : -1,
    maggots: [],
    state,
    stridePhaseDeg: actor.stridePhaseDeg,
    verticalOffset: impBrain?.verticalOffset
      ?? zombieBrain?.verticalOffset
      ?? demonArticulation?.verticalOffset
      ?? coffin.verticalOffset,
    zombieAngularOffsetDeg: zombieBrain?.angularOffsetDeg ?? 0,
    zombieAttackSide: zombieBrain?.attackSide ?? 0,
    zombieBodyType: zombieBrain?.bodyType ?? -1,
    zombieFrontArmPose: zombieBeat?.frontArmPose ?? 0,
    zombieBodyRotationRadians: zombieArticulation?.bodyRotationRadians ?? 0,
    zombieFrontArmRotationRadians: zombieArticulation?.frontArmRotationRadians ?? 0,
    zombieHeadRotationRadians: zombieArticulation?.headRotationRadians ?? 0,
    zombieHeadType: zombieBrain?.headType ?? -1,
    zombieRearArmPose: zombieBeat?.rearArmPose ?? 0,
    zombieRearArmRotationRadians: zombieArticulation?.rearArmRotationRadians ?? 0,
  }
}

function projectEnemyEffects(
  actor: BoneyardEnemyActor,
  tick: number,
): readonly BoneyardEnemyEffectSnapshot[] {
  if (actor.lifeState !== 'alive') return []
  const effects: BoneyardEnemyEffectSnapshot[] = []
  if (actor.shieldHealth > 0) {
    const wobble = Math.min(actor.shieldPulse, 1)
    effects.push({
      alpha: 0.5 * (Math.max(actor.shieldPulse, 1) - 1) + 0.25,
      atlas: 'BadGuys',
      blendMode: 'add',
      entry: 49,
      id: actor.id * 4,
      offset: { x: 0, y: -30 },
      role: 'magic-shield',
      rotationRadians: 0,
      scale: 1.5 + 0.1 * Math.sin(tick * 20 * Math.PI / 180) * wobble,
    })
  }
  return effects
}

function maggotVerticalOffset(maggot: BoneyardMaggotActor): number {
  return maggot.verticalOffset
}

function brainAction(actor: BoneyardEnemyActor): BoneyardEnemyAction | null {
  const brain = actor.brain
  switch (brain.family) {
    case 'skeleton':
      if (brain.phase !== 'attack') return null
      if (brain.action === 'pike') return 'skeleton-pike'
      if (brain.action === 'weapon') return 'skeleton-weapon'
      return actor.config.enemyToken === 'SKELETON' && actor.config.family.armor
        ? 'skeleton-claw-b'
        : 'skeleton-claw-a'
    case 'archer': return brain.phase === 'attack' ? 'archer-shot' : null
    case 'mage': return brain.phase === 'cast'
      ? brain.castProgram === 'long' ? 'mage-cast-long' : 'mage-cast-short'
      : null
    case 'imp': return null
    case 'portal': return null
    case 'zombie': return brain.phase === 'swipe' ? 'zombie-beat' : null
    case 'wraith': return brain.phase === 'drain' ? 'wraith-drain' : null
    case 'demon': return brain.phase === 'bomb' ? 'demon-bomb' : null
    case 'coffin': return null
  }
}

function actionProgress(brain: BoneyardEnemyBrain): number {
  switch (brain.family) {
    case 'skeleton':
    case 'archer':
    case 'mage': return brain.actionProgress
    case 'imp': return 0
    case 'portal': return 0
    case 'wraith': return brain.actionTick
    case 'zombie':
    case 'demon': return brain.actionProgress
    case 'coffin': return brain.phase === 'opening'
      ? Math.min(12, 3 + brain.phaseTick * 0.2)
      : 0
  }
}

function maggotEmergenceOrientation(maggot: BoneyardMaggotActor): number {
  const heading = actorHeadingFromVector(
    maggot.launchVelocity.x,
    maggot.launchVelocity.y,
  )
  return positiveModulo(Math.floor((heading + 18) / 36), 10)
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
    case 'opening': return {
      pose: Math.min(12, 3 + brain.phaseTick * 0.2),
      state: 'opening',
      verticalOffset: 0,
    }
    case 'open': return { pose: 12, state: 'open', verticalOffset: 0 }
    case 'death': return { pose: 12, state: 'open', verticalOffset: 0 }
  }
}

function positiveModulo(value: number, period: number): number {
  return ((value % period) + period) % period
}
