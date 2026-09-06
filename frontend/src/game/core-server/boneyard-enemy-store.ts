import {
  NATIVE_MAGE_LIGHTNING_MAX_PULSE_AGES,
} from '../core-kernels/boneyard-mage-lightning.ts'
import { seedBoneyardWaveRng } from '../core-kernels/boneyard-wave-timeline.ts'
import type { BoneyardPoint } from '../core-kernels/boneyard.ts'
import { createNativeRng } from '../core-kernels/native-rng.ts'
import { createNativeWorldManagerOrder } from '../core-kernels/native-world-manager-order.ts'
import { stepBoneyardTransientEffects } from './boneyard-transient-effects.ts'
import { stepDamagePresentationTimers, stepLivingActor } from './enemies/actor-update.ts'
import { materializeSpawnIntents } from './enemies/construction.ts'
import { stepDyingActor } from './enemies/deaths.ts'
import { stepMaggots } from './enemies/maggots.ts'
import {
  type BoneyardEnemyActor,
  type BoneyardEnemyActorId,
  type BoneyardEnemyStore,
  type BoneyardEnemyStoreStepContext,
  type BoneyardEnemyStoreStepResult,
  type PositionBoneyardEnemyResult,
  type WorkingStep,
  validateTick,
} from './enemies/model.ts'
import { stepProjectiles } from './enemies/projectiles.ts'
import { drawUnit } from './enemies/random.ts'
import {
  bindEnemyTargets,
  nativePrimaryCellChanged,
  standaloneEnemyWorldManagerOrderState,
  withNativeCellRebindOrder,
} from './enemies/registration.ts'
import { stepMageShields } from './enemies/skeleton-family.ts'

export function createBoneyardEnemyStore(
  seed: string,
  nativeRegistrationBase = 0,
): BoneyardEnemyStore {
  if (!Number.isSafeInteger(nativeRegistrationBase) || nativeRegistrationBase < 0) {
    throw new RangeError('native enemy registration base must be a non-negative safe integer')
  }
  return {
    actors: [],
    deathEffects: [],
    headFacingRngState: createNativeRng(
      seedBoneyardWaveRng(`${seed}:skeleton-head-facing`),
    ),
    lastStepTick: -1,
    locomotionRngState: createNativeRng(
      seedBoneyardWaveRng(`${seed}:enemy-locomotion`),
    ),
    mageLightningPulses: [],
    maggots: [],
    nextActorId: 1,
    nextDeathEpoch: 1,
    nextDeathEffectId: 1,
    nextEventId: 1,
    nextMageLightningPulseId: 1,
    nextNativeCellBindingOrder: nativeRegistrationBase,
    nextNativeRegistrationOrder: nativeRegistrationBase,
    nextProjectileId: 1,
    nextProjectileEffectId: 1,
    nextSyntheticSpawnIntentId: 1,
    projectiles: [],
    projectileEffects: [],
    projectileKnockbacks: [],
    targetCellBindings: {},
    rngState: seedBoneyardWaveRng(`${seed}:enemy-actors`),
    steeringRngState: createNativeRng(
      seedBoneyardWaveRng(`${seed}:enemy-steering`),
    ),
  }
}

/** Includes every actor throughout its terminal presentation interval. */
export function boneyardEnemyLiveCount(source: BoneyardEnemyStore): number {
  return source.actors.length
}

/**
 * Commits a collision-resolved spell impulse to the target-owned enemy row.
 * The spell system owns the impulse formula; the active world owns collision
 * resolution and passes only the accepted final root position here.
 */
export function positionBoneyardEnemy(
  source: BoneyardEnemyStore,
  actorId: BoneyardEnemyActorId,
  position: Readonly<BoneyardPoint>,
): PositionBoneyardEnemyResult {
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
    throw new RangeError('enemy spell-impulse position must be finite')
  }
  const actorIndex = source.actors.findIndex((actor) => actor.id === actorId)
  const actor = source.actors[actorIndex]
  if (actor) {
    if (actor.lifeState !== 'alive') return { accepted: false, store: source }
    const actors = [...source.actors]
    const rebound = nativePrimaryCellChanged(actor.position, position)
    actors[actorIndex] = {
      ...actor,
      nativeCellBindingOrder: rebound
        ? source.nextNativeCellBindingOrder
        : actor.nativeCellBindingOrder,
      position: Object.freeze({ ...position }),
    }
    return {
      accepted: true,
      store: {
        ...source,
        actors,
        nextNativeCellBindingOrder: source.nextNativeCellBindingOrder + Number(rebound),
      },
    }
  }
  const maggotIndex = source.maggots.findIndex((maggot) => maggot.id === actorId)
  const maggot = source.maggots[maggotIndex]
  if (!maggot || maggot.lifeState !== 'alive' || !maggot.combatActive) {
    return { accepted: false, store: source }
  }
  const maggots = [...source.maggots]
  const rebound = nativePrimaryCellChanged(maggot.position, position)
  maggots[maggotIndex] = {
    ...maggot,
    nativeCellBindingOrder: rebound
      ? source.nextNativeCellBindingOrder
      : maggot.nativeCellBindingOrder,
    position: Object.freeze({ ...position }),
  }
  return {
    accepted: true,
    store: {
      ...source,
      maggots,
      nextNativeCellBindingOrder: source.nextNativeCellBindingOrder + Number(rebound),
    },
  }
}

export function stepBoneyardEnemyStore(
  source: BoneyardEnemyStore,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyStoreStepResult {
  validateTick(context.tick)
  if (context.tick <= source.lastStepTick) {
    throw new RangeError('enemy store ticks must advance monotonically')
  }
  if (context.paused) return stepPausedBoneyardEnemyStore(source, context)
  const registerWorldPainter = context.registerWorldPainter
    ?? createNativeWorldManagerOrder(standaloneEnemyWorldManagerOrderState(source)).register
  const work: WorkingStep = {
    actors: [],
    deathEffects: [],
    events: [],
    headFacingRngState: source.headFacingRngState,
    impActorCount: source.actors.filter(({ config }) => config.enemyToken === 'IMP').length,
    locomotionRngState: source.locomotionRngState,
    mageLightningPulses: source.mageLightningPulses.filter((pulse) => (
      context.tick - pulse.tick < NATIVE_MAGE_LIGHTNING_MAX_PULSE_AGES
    )),
    maggots: [...source.maggots],
    nextActorId: source.nextActorId,
    nextDeathEpoch: source.nextDeathEpoch,
    nextDeathEffectId: source.nextDeathEffectId,
    nextEventId: source.nextEventId,
    nextMageLightningPulseId: source.nextMageLightningPulseId,
    nextNativeCellBindingOrder: source.nextNativeCellBindingOrder,
    nextNativeRegistrationOrder: source.nextNativeRegistrationOrder,
    nextProjectileId: source.nextProjectileId,
    nextProjectileEffectId: source.nextProjectileEffectId,
    nextSyntheticSpawnIntentId: source.nextSyntheticSpawnIntentId,
    playerDamage: [],
    playerKnockbacks: [],
    projectileKnockbacks: [...source.projectileKnockbacks],
    targetCellBindings: source.targetCellBindings,
    pathStatusFactors: new Map(),
    pendingSpawnIntents: [],
    projectiles: [...source.projectiles],
    projectileEffects: [],
    registerWorldPainter,
    registerProjectileWorldPainter: context.registerProjectileWorldPainter ?? registerWorldPainter,
    retired: [],
    rewards: [],
    rngState: source.rngState,
    steeringRngState: source.steeringRngState,
    spawnedActorIds: [],
  }
  bindEnemyTargets(work, context.players)
  const transients = stepBoneyardTransientEffects(
    source.deathEffects,
    source.projectileEffects,
    context.tick,
    () => drawUnit(work),
    work.nextDeathEffectId,
    work.registerWorldPainter,
  )
  work.deathEffects = transients.deathEffects
  work.nextDeathEffectId = transients.nextDeathEffectId
  work.projectileEffects = transients.projectileEffects
  for (const actor of source.actors) {
    const timedActor = stepDamagePresentationTimers(
      actor,
      context.tick - source.lastStepTick,
    )
    const stepped = timedActor.lifeState === 'dying'
      ? stepDyingActor(work, timedActor, context)
      : stepLivingActor(work, timedActor, context)
    if (stepped) {
      const rebound = withNativeCellRebindOrder(work, actor, stepped)
      // Native 0x00625680 rebuilds status scalars from 1.0 every tick. The
      // affected config is a current-tick view, never the next authored row.
      work.actors.push(rebound.config === timedActor.config
        ? rebound
        : { ...rebound, config: timedActor.config })
    } else if (timedActor.config.enemyToken === 'IMP') {
      work.impActorCount -= 1
    }
  }
  work.actors.push(...materializeSpawnIntents(work, context, work.pendingSpawnIntents))
  stepMageShields(work, context)
  const maggotsBeforeStep = new Map(work.maggots.map((maggot) => [maggot.id, maggot]))
  stepMaggots(work, context, context.tick - source.lastStepTick)
  work.maggots = work.maggots.map((maggot) => {
    const before = maggotsBeforeStep.get(maggot.id)
    return before ? withNativeCellRebindOrder(work, before, maggot) : maggot
  })
  const projectilesBeforeStep = new Map(work.projectiles.map((projectile) => [
    projectile.id,
    projectile,
  ]))
  stepProjectiles(work, context)
  work.projectiles = work.projectiles.map((projectile) => {
    const before = projectilesBeforeStep.get(projectile.id)
    return before ? withNativeCellRebindOrder(work, before, projectile) : projectile
  })
  const spawnIntents = context.resolveSpawnIntents(
    work.actors.length,
    liveZombieCount(work.actors),
    liveBossCount(work.actors),
  )
  work.actors.push(...materializeSpawnIntents(work, context, spawnIntents))
  return finishBoneyardEnemyStoreStep(work, context.tick)
}

function stepPausedBoneyardEnemyStore(
  source: BoneyardEnemyStore,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyStoreStepResult {
  const registerWorldPainter = context.registerWorldPainter
    ?? createNativeWorldManagerOrder(standaloneEnemyWorldManagerOrderState(source)).register
  const work: WorkingStep = {
    actors: [...source.actors],
    deathEffects: [...source.deathEffects],
    events: [],
    headFacingRngState: source.headFacingRngState,
    impActorCount: source.actors.filter(({ config }) => config.enemyToken === 'IMP').length,
    locomotionRngState: source.locomotionRngState,
    mageLightningPulses: [...source.mageLightningPulses],
    maggots: [...source.maggots],
    nextActorId: source.nextActorId,
    nextDeathEpoch: source.nextDeathEpoch,
    nextDeathEffectId: source.nextDeathEffectId,
    nextEventId: source.nextEventId,
    nextMageLightningPulseId: source.nextMageLightningPulseId,
    nextNativeCellBindingOrder: source.nextNativeCellBindingOrder,
    nextNativeRegistrationOrder: source.nextNativeRegistrationOrder,
    nextProjectileId: source.nextProjectileId,
    nextProjectileEffectId: source.nextProjectileEffectId,
    nextSyntheticSpawnIntentId: source.nextSyntheticSpawnIntentId,
    pathStatusFactors: new Map(),
    pendingSpawnIntents: [],
    playerDamage: [],
    playerKnockbacks: [],
    projectileKnockbacks: source.projectileKnockbacks.map(row => ({ ...row, lastStepTick: context.tick })),
    targetCellBindings: source.targetCellBindings,
    projectiles: source.projectiles.map(row => ({ ...row, lastStepTick: context.tick })),
    projectileEffects: source.projectileEffects.map(row => ({ ...row, lastStepTick: context.tick })),
    registerWorldPainter,
    registerProjectileWorldPainter: context.registerProjectileWorldPainter ?? registerWorldPainter,
    retired: [],
    rewards: [],
    rngState: source.rngState,
    steeringRngState: source.steeringRngState,
    spawnedActorIds: [],
  }
  bindEnemyTargets(work, context.players)
  const spawnIntents = context.resolveSpawnIntents(
    work.actors.length,
    liveZombieCount(work.actors),
    liveBossCount(work.actors),
  )
  work.actors.push(...materializeSpawnIntents(work, context, spawnIntents))
  work.events = []
  return finishBoneyardEnemyStoreStep(work, context.tick)
}

function finishBoneyardEnemyStoreStep(
  work: WorkingStep,
  tick: number,
): BoneyardEnemyStoreStepResult {
  return {
    events: Object.freeze(work.events),
    playerDamage: Object.freeze(work.playerDamage),
    playerKnockbacks: Object.freeze(work.playerKnockbacks),
    retired: Object.freeze(work.retired),
    rewards: Object.freeze(work.rewards),
    spawnedActorIds: Object.freeze(work.spawnedActorIds),
    store: {
      actors: work.actors,
      deathEffects: work.deathEffects,
      headFacingRngState: work.headFacingRngState,
      lastStepTick: tick,
      locomotionRngState: work.locomotionRngState,
      mageLightningPulses: work.mageLightningPulses,
      maggots: work.maggots,
      nextActorId: work.nextActorId,
      nextDeathEpoch: work.nextDeathEpoch,
      nextDeathEffectId: work.nextDeathEffectId,
      nextEventId: work.nextEventId,
      nextMageLightningPulseId: work.nextMageLightningPulseId,
      nextNativeCellBindingOrder: work.nextNativeCellBindingOrder,
      nextNativeRegistrationOrder: work.nextNativeRegistrationOrder,
      nextProjectileId: work.nextProjectileId,
      nextProjectileEffectId: work.nextProjectileEffectId,
      nextSyntheticSpawnIntentId: work.nextSyntheticSpawnIntentId,
      projectiles: work.projectiles,
      projectileEffects: work.projectileEffects,
      projectileKnockbacks: work.projectileKnockbacks,
      targetCellBindings: work.targetCellBindings,
      rngState: work.rngState,
      steeringRngState: work.steeringRngState,
    },
  }
}

function liveZombieCount(actors: readonly BoneyardEnemyActor[]): number {
  return actors.filter(({ config }) => config.enemyToken === 'ZOMBIE').length
}

function liveBossCount(actors: readonly BoneyardEnemyActor[]): number {
  return actors.filter(({ config }) => config.classification !== 'normal').length
}
