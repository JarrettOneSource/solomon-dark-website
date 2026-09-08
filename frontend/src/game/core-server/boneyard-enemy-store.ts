import { stepBoneyardPuppetHits } from './enemies/puppet-hits.ts'
import { seedBoneyardWaveRng } from '../core-kernels/boneyard-wave-timeline.ts'
import type { BoneyardPoint } from '../core-kernels/boneyard.ts'
import { createNativeBossNarration, enqueueNativeBossNarration, stepNativeBossNarration } from '../core-kernels/native-boss-audio.ts'
import { createNativeDemonSkullEncounter } from '../core-kernels/native-demon-skull.ts'
import { stepNativeFacultyVoices } from '../core-kernels/native-faculty-voices.ts'
import { createNativeRng } from '../core-kernels/native-rng.ts'
import { stepBoneyardTransientEffects } from './boneyard-transient-effects.ts'
import { stepDamagePresentationTimers, stepLivingActor } from './enemies/actor-update.ts'
import { stepBossSpells } from './enemies/boss-spells.ts'
import { materializeSpawnIntents } from './enemies/construction.ts'
import { spawnDampenedMageSmoke } from './enemies/dampen.ts'
import { stepDyingActor } from './enemies/deaths.ts'
import { stepDetachedCrows } from './enemies/heartmonger.ts'
import { stepMaggots } from './enemies/maggots.ts'
import type { BoneyardEnemyActor, BoneyardEnemyActorId, BoneyardEnemyStore, BoneyardEnemyStoreStepContext, BoneyardEnemyStoreStepResult, PositionBoneyardEnemyResult, WorkingStep } from './enemies/model.ts'
import { validateTick } from './enemies/model.ts'
import { stepProjectiles } from './enemies/projectiles.ts'
import { drawUnit } from './enemies/random.ts'
import { bindEnemyTargets, bindNativeQueryTarget, bindWorldPuppetTargets, nativePrimaryCellChanged, withNativeCellRebindOrder } from './enemies/registration.ts'
import { stepSilkFragments } from './enemies/silk-force.ts'
import { stepMageShields } from './enemies/skeleton-family.ts'
import { stepSpiderRemains } from './enemies/spider-remains.ts'
import { stepSilks, stepSpiderWebs } from './enemies/spider.ts'
import { createEnemyWork, finishEnemyStore } from './enemies/work.ts'
import { spawnRottenZombieParticle } from './enemies/zombie.ts'
import { spawnBurningSkeletonFire } from './enemies/skeleton-body.ts'
import { spawnWraithWisp } from './enemies/wraith.ts'
export function createBoneyardEnemyStore(
  seed: string,
  nativeRegistrationBase = 0,
): BoneyardEnemyStore {
  if (!Number.isSafeInteger(nativeRegistrationBase) || nativeRegistrationBase < 0) {
    throw new RangeError('native enemy registration base must be a non-negative safe integer')
  }
  return {
    silkFragments: [],
    spiderRemains: [],
    silks: [],
    webbedPlayers: {},
    spiderSpitTicksRemaining: 0,
    demonSkullEncounter: createNativeDemonSkullEncounter(),
    featuredBossId: null,
    bossNarration: createNativeBossNarration(),
    facultyVoiceController: null,
    bossSpells: [],
    puppetHits: [],
    detachedCrows: [],
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
export function boneyardEnemyLiveCount(source: Pick<BoneyardEnemyStore, 'actors'>): number {
  return source.actors.filter(({ config }) => config.enemyToken !== 'COCOON').length
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
  const work = createEnemyWork(source, context, false)
  work.playerTargets = { ...context.players }
  context = { ...context, players: work.playerTargets }
  bindEnemyTargets(work, context.players)
  bindWorldPuppetTargets(work, context.puppetTargets ?? [])
  for (const spell of work.bossSpells) {
    if (spell.kind === 'skull-missile') bindNativeQueryTarget(work, `boss-spell:${spell.id}`, spell.position)
  }
  stepSpiderWebs(work, context)
  stepSilkFragments(work)
  stepSpiderRemains(work)
  const dialogueBusy = context.dialogueBusy ?? false
  work.bossNarration = stepNativeBossNarration(work.bossNarration, context.tick, dialogueBusy)
  if (work.facultyVoiceController !== null) {
    const members = source.actors.flatMap(actor => actor.lifeState === 'alive' && actor.config.enemyToken === 'DIREFACULTY'
      ? [{ female: actor.config.family.female }] : [])
    const voices = stepNativeFacultyVoices(work.facultyVoiceController, work.steeringRngState, members,
      dialogueBusy || work.bossNarration.current !== null || work.bossNarration.pending.length > 0)
    work.facultyVoiceController = voices.state
    work.steeringRngState = voices.rng
    work.bossNarration = enqueueNativeBossNarration(work.bossNarration, voices.cues, context.tick, dialogueBusy)
  }
  stepDetachedCrows(work, context)
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
  const pendingCapabilities = work.demonSkullEncounter.pendingCapabilities
  work.demonSkullEncounter = { ...work.demonSkullEncounter, pendingCapabilities: 0,
    deathStreamTicksRemaining: Math.max(0, work.demonSkullEncounter.deathStreamTicksRemaining - 1),
    screamStreamTicksRemaining: Math.max(0, work.demonSkullEncounter.screamStreamTicksRemaining - 1) }
  for (let actorIndex = 0; actorIndex < work.actors.length; actorIndex += 1) {
    const sourceActor = work.actors[actorIndex]!
    const actor = sourceActor.brain.family === 'demon-skull' && pendingCapabilities !== 0
      ? { ...sourceActor, brain: { ...sourceActor.brain, capabilities: sourceActor.brain.capabilities | pendingCapabilities } }
      : sourceActor
    const timedActor = stepDamagePresentationTimers(
      actor,
      context.tick - source.lastStepTick,
      context.tick,
    )
    const stepped = timedActor.lifeState === 'dying'
      ? stepDyingActor(work, timedActor, context)
      : stepLivingActor(work, timedActor, context)
    if (stepped) {
      spawnDampenedMageSmoke(work, stepped, context.tick)
      spawnRottenZombieParticle(work, stepped, context.tick)
      spawnBurningSkeletonFire(work, stepped, context.tick)
      spawnWraithWisp(work, stepped, context)
      const rebound = withNativeCellRebindOrder(work, actor, stepped)
      // Native 0x00625680 rebuilds status scalars from 1.0 every tick. The
      // affected config is a current-tick view, never the next authored row.
      work.actors[actorIndex] = rebound.config === timedActor.config
        ? rebound
        : { ...rebound, config: timedActor.config }
    } else {
      work.actors.splice(actorIndex, 1)
      actorIndex -= 1
      if (timedActor.config.enemyToken === 'IMP') work.impActorCount -= 1
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
  stepSilks(work, context)
  stepBossSpells(work, context)
  work.projectiles = work.projectiles.map((projectile) => {
    const before = projectilesBeforeStep.get(projectile.id)
    return before ? withNativeCellRebindOrder(work, before, projectile) : projectile
  })
  const spawnIntents = context.resolveSpawnIntents(
    boneyardEnemyLiveCount(work),
    liveZombieCount(work.actors),
    liveBossCount(work.actors),
  )
  work.actors.push(...materializeSpawnIntents(work, context, spawnIntents))
  stepBoneyardPuppetHits(work, context)
  return finishBoneyardEnemyStoreStep(work, context.tick)
}

function stepPausedBoneyardEnemyStore(
  source: BoneyardEnemyStore,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyStoreStepResult {
  const work = createEnemyWork(source, context, true)
  work.actors = work.actors.map(actor => actor.hitFeedback.timer === 0 ? actor
    : { ...actor, hitFeedback: { ...actor.hitFeedback, tick: context.tick } })
  work.maggots = work.maggots.map(actor => actor.hitFeedback.timer === 0 ? actor
    : { ...actor, hitFeedback: { ...actor.hitFeedback, tick: context.tick } })
  work.puppetHits = work.puppetHits.map(hit => ({ ...hit, feedback: { ...hit.feedback, tick: context.tick } }))
  work.projectileKnockbacks = source.projectileKnockbacks.map(row => ({ ...row, lastStepTick: context.tick }))
  work.projectiles = source.projectiles.map(row => ({ ...row, lastStepTick: context.tick }))
  work.projectileEffects = source.projectileEffects.map(row => ({ ...row, lastStepTick: context.tick }))
  bindEnemyTargets(work, context.players)
  bindWorldPuppetTargets(work, context.puppetTargets ?? [])
  for (const spell of work.bossSpells) {
    if (spell.kind === 'skull-missile') bindNativeQueryTarget(work, `boss-spell:${spell.id}`, spell.position)
  }
  const spawnIntents = context.resolveSpawnIntents(
    boneyardEnemyLiveCount(work),
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
    playerPositions: Object.freeze(work.playerPositions),
    retired: Object.freeze(work.retired),
    rewards: Object.freeze(work.rewards),
    spawnedActorIds: Object.freeze(work.spawnedActorIds),
    store: finishEnemyStore(work, tick),
  }
}

function liveZombieCount(actors: readonly BoneyardEnemyActor[]): number {
  return actors.filter(({ config }) => config.enemyToken === 'ZOMBIE').length
}

function liveBossCount(actors: readonly BoneyardEnemyActor[]): number {
  return actors.filter(({ config }) => config.classification !== 'normal').length
}
