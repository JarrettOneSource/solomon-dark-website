import { actorHeadingFromVector } from '../core-kernels/actor-heading.ts'
import { NATIVE_DEMON_BOMB_CONTROLLER_POSES, nativeDemonArticulationSample } from '../core-kernels/boneyard-demon-articulation.ts'
import { nativeImpEffectFrame } from '../core-kernels/boneyard-imp-flight.ts'
import { nativeZombieArticulationPose, nativeZombieBeatPose } from '../core-kernels/boneyard-zombie-beat.ts'
import type { BoneyardPoint } from '../core-kernels/boneyard.ts'
import { roundHalfToEven } from '../core-kernels/native-rounding.ts'
import type { NativeSpiderOutlineTarget } from '../core-kernels/native-spider-appearance.ts'
import { nativeSpiderAppearance } from '../core-kernels/native-spider-appearance.ts'
import { nativeWraithContactActionProgress } from '../core-kernels/native-wraith-flight.ts'
import type { BoneyardEnemyActor, BoneyardEnemyBrain, BoneyardEnemyDeathEffect, BoneyardEnemyStore, BoneyardMageLightningPulse, BoneyardMaggotActor } from '../core-server/enemies/model.ts'
import { nativePuppetHitAlpha } from '../core-kernels/native-puppet-hit.ts'
import { NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS, NATIVE_MAGGOT_PROGRAM } from '../core-server/enemies/programs.ts'
import type { BoneyardEnemyAction, BoneyardEnemyAnimationSnapshot, BoneyardEnemyAnimationState, BoneyardEnemyCoffinState, BoneyardEnemyDeathEffectSnapshot, BoneyardEnemyEffectSnapshot, BoneyardEnemyProjectileEffectSnapshot, BoneyardEnemyProjectileSnapshot, BoneyardEnemySnapshot, BoneyardMageLightningPulseSnapshot, BoneyardMaggotSnapshot } from '../protocol/game-state.ts'
import { projectBoneyardCrows } from './project-boneyard-crows.ts'
export function projectBoneyardEnemyDeathEffects(
  store: BoneyardEnemyStore,
): readonly BoneyardEnemyDeathEffectSnapshot[] {
  return [...store.deathEffects.filter((effect) => (
    effect.kind !== 'black-smoky-bouncer' && effect.spawnTick <= store.lastStepTick
  )).map(projectBoneyardEnemyDeathEffect), ...projectBoneyardCrows(store)]
}

export function projectBoneyardEnemyDeathEffect(
  effect: BoneyardEnemyDeathEffect,
): BoneyardEnemyDeathEffectSnapshot {
  if (effect.kind === 'black-smoky-bouncer') throw new Error('a smoke emitter has no native draw')
  return {
    ...(effect.painterSortBias === undefined ? {} : { painterSortBias: effect.painterSortBias }),
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
    scaleY: effect.scaleY,
    shadow: effect.shadow,
    spawnTick: effect.spawnTick,
    tint: effect.tint,
  }
}

export function projectBoneyardEnemies(
  store: BoneyardEnemyStore,
  tick: number,
  spiderContext?: BoneyardSpiderPresentationContext,
): readonly BoneyardEnemySnapshot[] {
  return store.actors.filter((actor) => (
    actor.brain.family !== 'spider' || actor.brain.phase !== 'captured'
  )).map((actor) => ({
    ...(actor.brain.family === 'demon-skull' ? { demonSkull: {
      bodyHeadingDeg: actor.brain.bodyHeadingDeg, bodyOffset: actor.brain.bodyOffset,
      bodyPhaseDeg: actor.brain.bodyPhaseDeg, bodyPose: actor.brain.bodyPose,
      chargeGlow: actor.brain.chargeGlow, eyeCharge: actor.brain.eyeCharge, flairGlow: actor.brain.flairGlow,
      flickerPhaseDeg: actor.brain.flickerPhaseDeg, jitter: actor.brain.jitter,
      lightIntensity: actor.brain.lightIntensity, spin: actor.brain.spin,
    } } : {}),
    ...(actor.config.enemyToken === 'DIREFACULTY' && actor.brain.family === 'faculty' ? {
      faculty: { bodyColor: actor.config.family.bodyColor, headColor: actor.config.family.headColor,
        bodyHeadingDeg: actor.brain.bodyHeadingDeg,
        female: actor.config.family.female, handMask: actor.brain.handMask, lightningActive: actor.brain.lightningActive,
        lightIntensity: actor.brain.lightIntensity, lightPhase: actor.brain.lightPhase },
    } : {}),
    animation: projectAnimation(actor, tick, spiderContext),
    armored: actor.config.enemyToken === 'SKELETON' && actor.config.family.armor,
    arrowType: actor.config.enemyToken === 'SKELETONARCHER' ? actor.config.family.arrowType : 'normal',
    burning: actor.config.burning,
    classification: actor.config.classification,
    currentHealth: Math.min(actor.config.maximumHealth, actor.currentHealth),
    enemyToken: actor.config.enemyToken,
    flags: actor.config.flags,
    headgear: 'headgear' in actor.config.family ? actor.config.family.headgear : 0,
    headingDeg: actor.headingDeg,
    id: actor.id,
    lightRegistration: actor.lightRegistration,
    lighting: { ...actor.lighting },
    mageCloak: actor.config.enemyToken === 'SKELETONMAGE'
      && actor.config.family.cloak,
    mageElement: actor.config.enemyToken === 'SKELETONMAGE' ? actor.config.family.element : 'fire',
    maximumHealth: actor.config.maximumHealth,
    name: actor.config.recipeName,
    nativeTypeId: actor.config.nativeTypeId,
    position: { ...actor.position },
    rotten: actor.config.enemyToken === 'ZOMBIE' && actor.config.family.rotten,
    scale: actor.config.scale,
    shieldHealth: actor.shieldHealth,
    shieldMaximumHealth: actor.shieldMaximumHealth,
    spawnTick: actor.spawnTick,
    weapon: actor.config.enemyToken === 'SKELETON' ? actor.config.family.weapon : 'claw',
  }))
}

export function projectBoneyardEnemyProjectiles(
  store: BoneyardEnemyStore,
): readonly BoneyardEnemyProjectileSnapshot[] {
  return store.projectiles.map((projectile) => ({
    ageTicks: projectile.ageTicks,
    contactRadius: projectile.contactRadius,
    headingDeg: projectile.kind === 'arrow' && projectile.speed > 0
      ? actorHeadingFromVector(projectile.velocity.x, projectile.velocity.y) : projectile.headingDeg,
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
  return store.projectileEffects.map((effect) => {
    const base = {
    ageTicks: effect.ageTicks,
    alpha: effect.alpha,
    atlas: effect.atlas,
    blendMode: effect.blendMode,
    entry: effect.entry,
    id: effect.id,
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
    }
    return effect.kind === 'demon-fire' ? {
      ...base, kind: effect.kind,
      entry: 46 + roundHalfToEven(effect.fire.atlasPhase) % 32,
      fireFadeAlpha: effect.fire.fadeAlpha,
      fireHorizontalSign: effect.fire.horizontalSign,
    } : { ...base, kind: effect.kind }
  })
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
      hitFlash: nativePuppetHitAlpha(maggot.hitFeedback, tick),
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
  spiderContext: BoneyardSpiderPresentationContext | undefined,
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
    ? nativeDemonArticulationSample(
        demonBrain.articulation,
        demonSampleTick,
        actor.spawnTick,
        demonControllerPose,
        actor.position,
        actor.config.scale,
      )
    : null
  const pike = actor.brain.family === 'skeleton' ? actor.brain.pike : null
  const pikePosition = pike === null ? null
    : spiderContext?.players[pike.playerId]?.position ?? pike.position
  return {
    spider: actor.brain.family === 'spider' ? nativeSpiderAppearance(
      actor.brain.bodyHeadingDeg, actor.position, spiderContext?.lightAt(actor.position) ?? 0,
      actor.targetPlayerId === null ? null : spiderContext?.players[actor.targetPlayerId] ?? null,
    ) : null,
    action,
    actionProgress: actionProgress(actor.brain),
    alpha: actor.brain.family === 'portal' ? actor.brain.alpha : 1,
    bodyGaitPhase: actor.bodyGaitPhase,
    mageChargeSuppressed: actor.brain.family === 'mage' && actor.brain.disabledPrimaryTicks > 0,
    pikeTargetOffset: pikePosition === null ? null : {
      x: pikePosition.x - actor.position.x, y: pikePosition.y - actor.position.y,
    },
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
    demonFrontExtremityOffset: demonArticulation?.frontExtremityOffset ?? { x: 0, y: 0 },
    demonFrontRotationRadians: demonArticulation?.frontRotationRadians ?? 0,
    demonRearExtremityOffset: demonArticulation?.rearExtremityOffset ?? { x: 0, y: 0 },
    demonRearRotationRadians: demonArticulation?.rearRotationRadians ?? 0,
    demonShadowOffset: demonBrain ? {
      x: (demonBrain.articulation.front.current.x + demonBrain.articulation.rear.current.x) * .5 - actor.position.x,
      y: (demonBrain.articulation.front.current.y + demonBrain.articulation.rear.current.y) * .5 - actor.position.y,
    } : { x: 0, y: 0 },
    shadowLateralOffset: actor.shadowLateralOffset,
    effects: projectEnemyEffects(actor, tick),
    gaitPose: actor.brain.family === 'heartmonger' ? Math.trunc(actor.brain.legPhase)
      : actor.brain.family === 'faculty' ? actor.brain.gaitPhase : gaitPose,
    headFacingOffset: actor.headFacingOffset,
    hitFlash: actor.brain.family === 'portal'
      ? Math.min(1, actor.brain.hurtTicksRemaining / 24)
      : nativePuppetHitAlpha(actor.hitFeedback, tick),
    impBodyRotationRadians: (impBrain?.bodyRotationDeg ?? 0) * Math.PI / 180,
    impEffectAlpha: impBrain?.effectAlpha ?? 0,
    impEffectFrame: impBrain ? nativeImpEffectFrame(impBrain.effectPhase) : -1,
    headVariant: actor.brain.family === 'heartmonger' ? actor.brain.headVariant : 0,
    limbHeadingDeg: actor.brain.family === 'archer' ? actor.brain.strafe.limbHeadingDeg : null,
    maggots: [],
    state,
    stridePhaseDeg: actor.stridePhaseDeg,
    verticalOffset: demonBrain
      ? actor.lifeState === 'dying' ? 0 : demonArticulation?.verticalOffset ?? 0
      : impBrain?.verticalOffset
      ?? zombieBrain?.verticalVelocity
      ?? (actor.brain.family === 'skeleton' || actor.brain.family === 'archer' || actor.brain.family === 'mage'
        ? actor.brain.verticalOffset : undefined)
      ?? (actor.brain.family === 'spider' ? actor.brain.verticalOffset : undefined)
      ?? coffin.verticalOffset,
    zombieAngularOffsetDeg: zombieBrain?.angularOffsetDeg ?? 0,
    zombieAttackSide: zombieBrain?.attackSide ?? 0,
    zombieBodyType: zombieBrain?.bodyType ?? -1,
    zombieFrontArmPose: zombieBeat?.frontArmPose ?? 0,
    zombieBodyRotationRadians: zombieArticulation?.bodyRotationRadians ?? 0,
    zombieArmSocketRotationRadians: zombieArticulation?.armSocketRotationRadians ?? 0,
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
    case 'demon-skull': return brain.actions.length === 0 ? null : `demon-skull-${brain.actions[0]!.kind}`
    case 'faculty': return brain.action === null ? null : `faculty-${brain.action.kind}`
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
    case 'heartmonger': return null
    case 'imp': return null
    case 'portal': return null
    case 'zombie': return brain.phase === 'swipe' ? 'zombie-beat' : null
    case 'wraith': return brain.contactCooldownTicks > 0 ? 'wraith-drain' : null
    case 'demon': return brain.phase === 'bomb' ? 'demon-bomb' : null
    case 'coffin': return null
    case 'spider': return null
    case 'cocoon': return null
  }
}

function actionProgress(brain: BoneyardEnemyBrain): number {
  switch (brain.family) {
    case 'demon-skull': {
      const action = brain.actions[0]
      return action?.kind === 'bite' ? action.progress : 0
    }
    case 'faculty': return brain.action?.progress ?? 0
    case 'skeleton':
    case 'archer':
    case 'mage': return brain.actionProgress
    case 'heartmonger': return 0
    case 'imp': return 0
    case 'spider': return 0
    case 'cocoon': return 0
    case 'portal': return 0
    case 'wraith': return nativeWraithContactActionProgress(brain.contactCooldownTicks)
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

export interface BoneyardSpiderPresentationContext {
  readonly lightAt: (position: Readonly<BoneyardPoint>) => number
  readonly players: Readonly<Record<string, NativeSpiderOutlineTarget>>
}
