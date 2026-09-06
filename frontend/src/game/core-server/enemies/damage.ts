import { receiveNativePuppetHit } from '../../core-kernels/native-puppet-hit.ts'
import { nextBoneyardWaveRandom } from '../../core-kernels/boneyard-wave-timeline.ts'
import { cancelNativeBossNarration } from '../../core-kernels/native-boss-audio.ts'
import { queueNativeDemonSkullHealthTriggers } from '../../core-kernels/native-demon-skull.ts'
import { reactNativeSpiderToDamage } from '../../core-kernels/native-spider.ts'
import type { RegisterNativeWorldPainter } from '../../core-kernels/native-world-manager-order.ts'
import { createNativeWorldManagerOrder } from '../../core-kernels/native-world-manager-order.ts'
import { damageCocoon } from './cocoon.ts'
import type { DeathEffectOwner } from './death-effects.ts'
import { deathBrain } from './deaths.ts'
import type { BoneyardEnemyActor, BoneyardEnemyActorId, BoneyardEnemyDamageSound, BoneyardEnemyDeathEffect, BoneyardEnemySemanticEvent, BoneyardEnemyStore, BoneyardMaggotActor, DamageBoneyardEnemyRequest, DamageBoneyardEnemyResult, WorkingStep } from './model.ts'
import { validateTick } from './model.ts'
import { positiveModulo } from './movement.ts'
import { NATIVE_ENEMY_HIT_LATCH_TICKS } from './programs.ts'
import { standaloneEnemyWorldManagerOrderState } from './registration.ts'
interface DamagePresentationWork {
  deathEffects: BoneyardEnemyDeathEffect[]
  events: BoneyardEnemySemanticEvent[]
  nextDeathEffectId: number
  nextEventId: number
  registerWorldPainter: RegisterNativeWorldPainter
  rngState: number
}

export function damageBoneyardEnemy(
  source: BoneyardEnemyStore,
  request: DamageBoneyardEnemyRequest,
): DamageBoneyardEnemyResult {
  validateTick(request.tick)
  if (request.tick < source.lastStepTick) {
    throw new RangeError('enemy damage tick must not precede the store clock')
  }
  if (!Number.isFinite(request.amount) || request.amount <= 0) {
    throw new RangeError('enemy damage must be finite and positive')
  }
  if (request.hitStrength !== undefined && (!Number.isFinite(request.hitStrength) || request.hitStrength < 0)) {
    throw new RangeError('enemy hit strength must be finite and nonnegative')
  }
  const index = source.actors.findIndex((actor) => actor.id === request.actorId)
  const actor = source.actors[index]
  if (!actor) return damageBoneyardMaggot(source, request)
  if (actor.lifeState !== 'alive') {
    return { accepted: false, events: [], healthDamage: 0, killed: false, store: source }
  }
  if (actor.brain.family === 'cocoon') return damageCocoon(source, actor, request)

  const work: DamagePresentationWork = {
    deathEffects: [...source.deathEffects],
    events: [],
    nextDeathEffectId: source.nextDeathEffectId,
    nextEventId: source.nextEventId,
    registerWorldPainter: request.registerWorldPainter
      ?? createNativeWorldManagerOrder(standaloneEnemyWorldManagerOrderState(source)).register,
    rngState: source.rngState,
  }
  if (actor.shieldHealth > 0) {
    let shieldPulse = actor.shieldPulse
    let shieldSoundCooldownTicks = actor.shieldSoundCooldownTicks
    if (shieldSoundCooldownTicks <= 0) {
      emitDamageSound(
        work,
        actor,
        request.tick,
        'hit-shield',
        0.8 + drawDamageUnit(work) * 0.05,
      )
      shieldPulse = 2
      shieldSoundCooldownTicks = 10
    }
    const shieldHealth = Math.max(0, actor.shieldHealth - request.amount)
    const broke = shieldHealth === 0
    const nextActor: BoneyardEnemyActor = {
      ...actor,
      shieldHealth,
      shieldMaximumHealth: broke ? 0 : actor.shieldMaximumHealth,
      shieldPulse,
      shieldSoundCooldownTicks,
    }
    if (broke) {
      emitDamageSound(work, actor, request.tick, 'pop-shield', 0.8)
      spawnShieldBreakParticles(work, actor, request.tick)
    }
    const actors = [...source.actors]
    actors[index] = nextActor
    return finishDamage(source, actors, work, false, 0)
  }

  const hurtSound = enemyHurtSound(actor)
  const hurtPresentationReady = actor.brain.family === 'portal'
    ? actor.brain.hurtTicksRemaining === 0
    : actor.lastDamageTick === null
      || request.tick - actor.lastDamageTick >= NATIVE_ENEMY_HIT_LATCH_TICKS
  if (
    hurtSound !== null
    && request.suppressHurtSound !== true
    && hurtPresentationReady
  ) {
    emitDamageSound(
      work,
      actor,
      request.tick,
      hurtSound,
      0.9 + drawDamageUnit(work) * 0.2,
    )
  }
  let damageBrain = actor.brain.family === 'portal' && hurtPresentationReady
    ? {
        ...actor.brain,
        hurtTicksRemaining: 10 + Math.min(14, Math.floor(drawDamageUnit(work) * 15)),
      }
    : actor.brain
  let steeringRngState = source.steeringRngState
  if (damageBrain.family === 'spider') {
    const reaction = reactNativeSpiderToDamage(damageBrain, request.magic === true, steeringRngState)
    damageBrain = { ...reaction.state, family: 'spider', phase: damageBrain.phase }
    steeringRngState = reaction.rngState
  }

  const currentHealth = actor.currentHealth - request.amount
  const healthDamage = Math.min(Math.max(actor.currentHealth, 0), request.amount)
  const killed = currentHealth <= 0
  if (actor.config.classification !== 'normal') {
    source = { ...source, featuredBossId: killed ? null : actor.id,
      demonSkullEncounter: queueNativeDemonSkullHealthTriggers(source.demonSkullEncounter,
        actor.currentHealth / actor.config.maximumHealth, currentHealth / actor.config.maximumHealth) }
  }
  const nextActor: BoneyardEnemyActor = killed
    ? {
        ...actor,
        brain: damageBrain.family === 'spider' && request.etherDrainCapture === true
          ? { ...damageBrain, phase: 'captured' }
          : deathBrain(damageBrain),
        currentHealth,
        deathEpoch: source.nextDeathEpoch,
        deathStartedTick: request.tick,
        deathTick: 0,
        headFacingOffset: 0,
        lastDamagedByPlayerId: request.sourcePlayerId,
        lastDamageTick: request.tick,
        hitFeedback: receiveNativePuppetHit(request.tick, request.hitStrength),
        lethalMagicDamage: request.hasMagicDamage === true,
        lifeState: 'dying',
        lighting: actor.config.enemyToken === 'SKELETONARCHER'
          ? {
              ...actor.lighting,
              charge: 0,
              providerCopies: 0,
            }
          : actor.lighting,
        shieldHealth: 0,
        shieldMaximumHealth: 0,
        shieldPulse: 0,
        shieldSoundCooldownTicks: 0,
      }
    : {
        ...actor,
        brain: damageBrain,
        currentHealth,
        lastDamagedByPlayerId: request.sourcePlayerId,
        lastDamageTick: request.tick,
        hitFeedback: receiveNativePuppetHit(request.tick, request.hitStrength),
      }
  const actors = [...source.actors]
  actors[index] = nextActor
  if (killed && actor.config.enemyToken === 'DIREFACULTY') {
    source = { ...source, bossNarration: cancelNativeBossNarration(source.bossNarration) }
    work.events.push({ actorId: actor.id, eventId: work.nextEventId++, tick: request.tick, type: 'enemy-dialogue-stop' })
  }
  if (killed) {
    request.lethalObserver?.onReward({
      enemy: actor.config,
      playerId: request.sourcePlayerId,
    })
  }
  notifyAttributedHealthDamage(request, actor.id, actor.config.maximumHealth, healthDamage)
  return finishDamage({ ...source, steeringRngState }, actors, work, killed, healthDamage)
}

/** Damage from an enemy action updates the shared list before later actors take their turns. */
export function damageWorkingBoneyardEnemy(work: WorkingStep, request: DamageBoneyardEnemyRequest): void {
  const result = damageBoneyardEnemy({ ...work, lastStepTick: request.tick }, {
    ...request, registerWorldPainter: work.registerWorldPainter,
  })
  if (!result.accepted) return
  work.actors = [...result.store.actors]
  work.maggots = [...result.store.maggots]
  work.deathEffects = [...result.store.deathEffects]
  work.bossNarration = result.store.bossNarration
  work.demonSkullEncounter = result.store.demonSkullEncounter
  work.featuredBossId = result.store.featuredBossId
  work.nextDeathEffectId = result.store.nextDeathEffectId
  work.nextDeathEpoch = result.store.nextDeathEpoch
  work.nextEventId = result.store.nextEventId
  work.rngState = result.store.rngState
  work.steeringRngState = result.store.steeringRngState
  work.events.push(...result.events)
}

export function applyBoneyardStaffDisable(
  source: BoneyardEnemyStore,
  actorId: BoneyardEnemyActorId,
): BoneyardEnemyStore {
  const actorIndex = source.actors.findIndex(({ id }) => id === actorId)
  if (actorIndex >= 0) {
    const actor = source.actors[actorIndex]!
    if (actor.lifeState !== 'alive') return source
    const actors = [...source.actors]
    actors[actorIndex] = {
      ...actor,
      staffActionFactor: Math.fround(actor.staffActionFactor * 0.5),
      staffMovementFactor: Math.fround(actor.staffMovementFactor * 0.75),
    }
    return { ...source, actors }
  }
  const maggotIndex = source.maggots.findIndex(({ id }) => id === actorId)
  if (maggotIndex < 0) return source
  const maggot = source.maggots[maggotIndex]!
  if (maggot.lifeState !== 'alive') return source
  const maggots = [...source.maggots]
  maggots[maggotIndex] = {
    ...maggot,
    staffActionFactor: Math.fround(maggot.staffActionFactor * 0.5),
    staffMovementFactor: Math.fround(maggot.staffMovementFactor * 0.75),
  }
  return { ...source, maggots }
}

export function applyBoneyardStaffHeadingPerturbation(
  source: BoneyardEnemyStore,
  actorId: BoneyardEnemyActorId,
  deltaDegrees: number,
): BoneyardEnemyStore {
  if (!Number.isFinite(deltaDegrees)) {
    throw new RangeError('staff heading perturbation must be finite')
  }
  const actorIndex = source.actors.findIndex(({ id }) => id === actorId)
  if (actorIndex >= 0) {
    const actor = source.actors[actorIndex]!
    if (actor.lifeState !== 'alive') return source
    const actors = [...source.actors]
    actors[actorIndex] = {
      ...actor,
      headingDeg: positiveModulo(actor.headingDeg + deltaDegrees, 360),
    }
    return { ...source, actors }
  }
  const maggotIndex = source.maggots.findIndex(({ id }) => id === actorId)
  if (maggotIndex < 0) return source
  const maggot = source.maggots[maggotIndex]!
  if (maggot.lifeState !== 'alive') return source
  const maggots = [...source.maggots]
  maggots[maggotIndex] = {
    ...maggot,
    headingDeg: positiveModulo(maggot.headingDeg + deltaDegrees, 360),
  }
  return { ...source, maggots }
}

export function applyBoneyardStaffImpactVerticalVelocity(
  source: BoneyardEnemyStore,
  actorId: BoneyardEnemyActorId,
  verticalVelocity: number,
): BoneyardEnemyStore {
  if (!Number.isFinite(verticalVelocity)) {
    throw new RangeError('staff impact vertical velocity must be finite')
  }
  const actorIndex = source.actors.findIndex(({ id }) => id === actorId)
  if (actorIndex < 0) return source
  const actor = source.actors[actorIndex]!
  if (actor.lifeState !== 'alive' || actor.brain.family !== 'imp') return source
  const actors = [...source.actors]
  actors[actorIndex] = {
    ...actor,
    brain: { ...actor.brain, verticalVelocity: Math.fround(verticalVelocity) },
  }
  return { ...source, actors }
}

export function breakBoneyardSkeletonPike(
  source: BoneyardEnemyStore,
  actorId: BoneyardEnemyActorId,
): Readonly<{ broke: boolean; store: BoneyardEnemyStore }> {
  const actorIndex = source.actors.findIndex(({ id }) => id === actorId)
  if (actorIndex < 0) return { broke: false, store: source }
  const actor = source.actors[actorIndex]!
  if (
    actor.lifeState !== 'alive'
    || actor.brain.family !== 'skeleton'
    || actor.config.enemyToken !== 'SKELETON'
    || actor.config.family.weapon !== 'pike'
  ) return { broke: false, store: source }
  const weaponFlags = new Set([
    'FLAG_SWORD', 'FLAG_MACE', 'FLAG_FLAIL', 'FLAG_AXE', 'FLAG_PIKE',
  ])
  const actors = [...source.actors]
  actors[actorIndex] = {
    ...actor,
    bodyPose: 0,
    brain: {
      ...actor.brain,
      action: 'claw',
      actionProgress: 0,
      contactTargetPlayerId: null,
      markerEmitted: false,
      phase: 'approach',
    },
    config: {
      ...actor.config,
      family: { ...actor.config.family, weapon: 'claw' },
      flags: Object.freeze(actor.config.flags.filter((flag) => !weaponFlags.has(flag))),
    },
  }
  return { broke: true, store: { ...source, actors } }
}

/**
 * Commits a collision-resolved spell impulse to the target-owned enemy row.
 * The spell system owns the impulse formula; the active world owns collision
 * resolution and passes only the accepted final root position here.
 */
export function setBoneyardEnemyHurricaneContactCooldown(
  source: BoneyardEnemyStore,
  actorId: BoneyardEnemyActorId,
  cooldown: number,
): BoneyardEnemyStore {
  if (!Number.isSafeInteger(cooldown) || cooldown < 0 || cooldown > 0xffff) {
    throw new RangeError('enemy Hurricane cooldown must be an unsigned short')
  }
  const actorIndex = source.actors.findIndex((actor) => actor.id === actorId)
  if (actorIndex >= 0) {
    const actors = [...source.actors]
    actors[actorIndex] = { ...actors[actorIndex]!, hurricaneContactCooldown: cooldown }
    return { ...source, actors }
  }
  const maggotIndex = source.maggots.findIndex((maggot) => maggot.id === actorId)
  if (maggotIndex < 0) return source
  const maggots = [...source.maggots]
  maggots[maggotIndex] = { ...maggots[maggotIndex]!, hurricaneContactCooldown: cooldown }
  return { ...source, maggots }
}

export function setBoneyardEnemyBlizzardPushState(
  source: BoneyardEnemyStore,
  actorId: BoneyardEnemyActorId,
  accumulator: number,
  lastTick: number,
): BoneyardEnemyStore {
  if (!Number.isFinite(accumulator) || accumulator < 0) {
    throw new RangeError('enemy Blizzard push accumulator must be finite and non-negative')
  }
  if (!Number.isSafeInteger(lastTick) || lastTick < 0) {
    throw new RangeError('enemy Blizzard push tick must be a non-negative safe integer')
  }
  const actorIndex = source.actors.findIndex((actor) => actor.id === actorId)
  if (actorIndex >= 0) {
    const actors = [...source.actors]
    actors[actorIndex] = {
      ...actors[actorIndex]!,
      blizzardPushAccumulator: accumulator,
      blizzardPushLastTick: lastTick,
    }
    return { ...source, actors }
  }
  const maggotIndex = source.maggots.findIndex((maggot) => maggot.id === actorId)
  if (maggotIndex < 0) return source
  const maggots = [...source.maggots]
  maggots[maggotIndex] = {
    ...maggots[maggotIndex]!,
    blizzardPushAccumulator: accumulator,
    blizzardPushLastTick: lastTick,
  }
  return { ...source, maggots }
}

function damageBoneyardMaggot(
  source: BoneyardEnemyStore,
  request: DamageBoneyardEnemyRequest,
): DamageBoneyardEnemyResult {
  const index = source.maggots.findIndex((maggot) => maggot.id === request.actorId)
  const maggot = source.maggots[index]
  if (!maggot || maggot.lifeState !== 'alive' || !maggot.combatActive) {
    return { accepted: false, events: [], healthDamage: 0, killed: false, store: source }
  }
  const currentHealth = maggot.currentHealth - request.amount
  const healthDamage = Math.min(Math.max(maggot.currentHealth, 0), request.amount)
  const killed = currentHealth <= 0
  const nextMaggot: BoneyardMaggotActor = {
    ...maggot,
    currentHealth,
    deathEpoch: killed ? source.nextDeathEpoch : maggot.deathEpoch,
    deathStartedTick: killed ? request.tick : maggot.deathStartedTick,
    lastDamagedByPlayerId: request.sourcePlayerId,
    lastDamageTick: request.tick,
        hitFeedback: receiveNativePuppetHit(request.tick, request.hitStrength),
    lifeState: killed ? 'dying' : 'alive',
  }
  const maggots = [...source.maggots]
  maggots[index] = nextMaggot
  notifyAttributedHealthDamage(request, maggot.id, maggot.maximumHealth, healthDamage)
  return {
    accepted: true,
    events: [],
    healthDamage,
    killed,
    store: {
      ...source,
      maggots,
      nextDeathEpoch: source.nextDeathEpoch + (killed ? 1 : 0),
    },
  }
}

function finishDamage(
  source: BoneyardEnemyStore,
  actors: readonly BoneyardEnemyActor[],
  work: DamagePresentationWork,
  killed: boolean,
  healthDamage: number,
): DamageBoneyardEnemyResult {
  return {
    accepted: true,
    events: Object.freeze(work.events),
    healthDamage,
    killed,
    store: {
      ...source,
      actors,
      deathEffects: work.deathEffects,
      nextDeathEpoch: source.nextDeathEpoch + (killed ? 1 : 0),
      nextDeathEffectId: work.nextDeathEffectId,
      nextEventId: work.nextEventId,
      rngState: work.rngState,
    },
  }
}

function notifyAttributedHealthDamage(
  request: DamageBoneyardEnemyRequest,
  actorId: number,
  maximumHealth: number,
  amount: number,
): void {
  if (request.sourcePlayerId === null || amount <= 0) return
  const observer = request.attributionObserver ?? request.lethalObserver?.attributionObserver
  observer?.onEnemyHealthDamage({
    actorId,
    amount,
    maximumHealth,
    playerId: request.sourcePlayerId,
  })
}

function enemyHurtSound(
  actor: BoneyardEnemyActor,
): BoneyardEnemyDamageSound | null {
  switch (actor.config.enemyToken) {
    case 'DIREFACULTY':
    case 'HEARTMONGER':
    case 'SKELETON':
    case 'SKELETONARCHER':
    case 'SKELETONMAGE':
      return 'bone-crack'
    case 'ZOMBIE':
      return 'zombie-ouch'
    case 'PORTAL':
      return 'portal-hurt'
    case 'COFFIN':
    case 'SPIDER':
    case 'COCOON':
    case 'DEMONSKULL':
    case 'DEMON':
    case 'IMP':
    case 'WRAITH':
      return null
  }
}

function emitDamageSound(
  work: DamagePresentationWork,
  actor: DeathEffectOwner,
  tick: number,
  sound: BoneyardEnemyDamageSound,
  pitch: number,
): void {
  work.events.push(Object.freeze({
    actorId: actor.id,
    eventId: work.nextEventId,
    gainScale: 1,
    pitch,
    sound,
    sourcePosition: Object.freeze({ ...actor.position }),
    tick,
    type: 'enemy-damage-sound',
  }))
  work.nextEventId += 1
}

function spawnShieldBreakParticles(
  work: DamagePresentationWork,
  actor: DeathEffectOwner,
  tick: number,
): void {
  for (let index = 0; index < 20; index += 1) {
    const rotationDeg = drawDamageUnit(work) * 360
    const alpha = 0.5 + drawDamageUnit(work) * 0.75
    const scale = 1.5 + drawDamageUnit(work) * 0.25
    work.deathEffects.push(Object.freeze({
      ageTicks: 0,
      alpha,
      alphaMultiplier: 1,
      alphaLossPerTick: 0.05,
      angularVelocityDeg: 0,
      atlas: 'BadGuys',
      blendMode: 'add',
      bounceRetention: 0,
      bounceVelocity: 0,
      entry: 69,
      firstEntry: 69,
      frameCount: 1,
      framePhase: 0,
      frameVelocity: 0,
      frameVelocityDamping: 1,
      frameTicks: 1,
      height: 0,
      id: work.nextDeathEffectId,
      kind: 'fade',
      lastStepTick: tick,
      lifetimeTicks: Math.ceil(alpha / 0.05),
      opacityTimer: alpha,
      ownerActorId: actor.id,
      painterRegistration: work.registerWorldPainter('transient'),
      presentationOwner: 'world-sorted',
      position: Object.freeze({ x: actor.position.x, y: actor.position.y - 30 }),
      role: 'shield-break-particle',
      rotationDeg,
      scale,
      scaleY: scale,
      scaleMultiplier: 1,
      shadow: false,
      spawnTick: tick,
      tint: 0xffffff,
      verticalVelocity: 0,
      velocity: Object.freeze({ x: 0, y: 0 }),
      velocityDamping: 1,
    }))
    work.nextDeathEffectId += 1
  }
}

function drawDamageUnit(work: DamagePresentationWork): number {
  const draw = nextBoneyardWaveRandom(work.rngState)
  work.rngState = draw.state
  return draw.value
}
