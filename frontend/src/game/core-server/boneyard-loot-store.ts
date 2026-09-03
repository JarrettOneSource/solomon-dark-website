import type { BoneyardBounds, BoneyardPoint } from '../core-kernels/boneyard.ts'
import type { HubInventoryItem } from '../core-kernels/hub-economy.ts'
import { seedBoneyardWaveRng } from '../core-kernels/boneyard-wave-timeline.ts'
import {
  NATIVE_LOOT_ACTOR_SEED_BOUND,
  NATIVE_LOOT_DEFAULT_MODIFIERS,
  createNativeLootItemIds,
  initialNativeKeyDropLevel,
  materializeNativeLootScriptAction,
  resolveNativeGoodieContents,
  rollNativeEnemyLoot,
  type NativeBonusKind,
  type NativeLootDropSource,
  type NativeLootDropSpec,
  type NativeLootItem,
  type NativeLootArenaInput,
  type NativeLootModifiers,
  type NativeLootPlacement,
  type NativeLootPolicies,
  type NativeLootSelectionInput,
  type NativeOrbKind,
} from '../core-kernels/native-loot.ts'
import {
  createNativeRng,
  drawNativeFloat,
  drawNativeFloatRange,
  drawNativeInteger,
  type NativeRngState,
} from '../core-kernels/native-rng.ts'
import {
  selectNativeMinibossDieReward,
  type NativeSurvivalOnDeathProgram,
} from '../core-kernels/native-survival-miniboss.ts'
import {
  createNativeWorldManagerOrder,
  type NativeWorldManagerRegistration,
  type RegisterNativeWorldPainter,
} from '../core-kernels/native-world-manager-order.ts'
import type { BoneyardEnemyDeathEffect } from './boneyard-enemy-store.ts'

export const NATIVE_LOOT_WORLD_ID_MINIMUM = 1
export const NATIVE_LOOT_WORLD_ID_MAXIMUM = 2_047
export const NATIVE_ORB_DECAY_DELAY_TICKS = 900
export const NATIVE_ORB_DECAY_PER_TICK = Math.fround(0.0020000000949949026)
export const NATIVE_ORB_ACTIVE_VALUE_FLOOR = Math.fround(0.01)
export const NATIVE_ORB_MOVE_PER_TICK = Math.fround(1.5)
export const NATIVE_BONUS_LIFETIME_TICKS = 1_200
export const NATIVE_BONUS_FADE_PER_TICK = Math.fround(0.009999999776482582)
export const NATIVE_SACK_INITIAL_HEIGHT = Math.fround(-25)
export const NATIVE_SACK_INITIAL_VELOCITY = Math.fround(0.10000000149011612)
export const NATIVE_SACK_BOUNCE_MULTIPLIER = Math.fround(1.5)
export const NATIVE_GOLD_SCATTER_INCREMENT = Math.fround(0.5)
export const NATIVE_GOLD_SCATTER_END = Math.fround(8)
export const NATIVE_LOOT_EVENT_RETENTION_TICKS = 100
export const NATIVE_GOODIE_KEY_FEEDBACK_INTERVAL_TICKS = 200
export const NATIVE_GOODIE_EFFECT_ID_START = 1_000_000

export type BoneyardLootSound =
  | 'drop-bag-1'
  | 'drop-bag-2'
  | 'drop-coins'
  | 'drop-potion'
  | 'goto-orb'
  | 'pickup-bag'
  | 'pickup-coin'

export type BoneyardLootEventType =
  | 'goodie-key-needed'
  | 'goodie-phase'
  | 'loot-drop-sound'
  | 'loot-pickup'

export interface BoneyardLootActor {
  readonly activationDelayTicks: number
  readonly ageTicks: number
  readonly alpha: number
  readonly amount: number
  readonly animationPhase: number
  readonly bonusKind: NativeBonusKind | null
  readonly bounceHeight: number
  readonly bounceVelocity: number
  readonly framePhase: number
  readonly id: number
  readonly item: NativeLootItem | null
  readonly kind: 'bonus' | 'gold' | 'orb' | 'sack'
  readonly lastStepTick: number
  readonly lifetimeTicksRemaining: number | null
  readonly nativeTypeId: 2011 | 2012 | 2013 | 2038
  readonly orbKind: NativeOrbKind | null
  readonly orbValue: number
  readonly painterRegistration: NativeWorldManagerRegistration
  readonly position: Readonly<BoneyardPoint>
  readonly rotationDeg: number
  readonly scatterSeed: number
  readonly scatterActive: boolean
  readonly scatterProgress: number
  readonly settledSoundEmitted: boolean
  readonly source: NativeLootDropSource
  readonly spawnTick: number
  readonly tier: number
}

export interface BoneyardGoodieInput {
  readonly eid: string
  readonly position: Readonly<BoneyardPoint>
  readonly rewardSeed?: number
  readonly sceneryRegistrationOrdinal?: number
  readonly subtype?: number
}

export interface BoneyardGoodieState {
  readonly active: boolean
  readonly activatedByPlayerId: string | null
  readonly eid: string
  readonly exhausted: boolean
  readonly id: number
  readonly phase: 0 | 1 | 2
  readonly position: Readonly<BoneyardPoint>
  readonly rewardSeed: number
  readonly sceneryRegistrationOrdinal: number
  readonly subtype: number
  readonly timer: number
}

export interface BoneyardLootStore {
  readonly actors: readonly BoneyardLootActor[]
  readonly effects: readonly BoneyardEnemyDeathEffect[]
  readonly goodies: readonly BoneyardGoodieState[]
  readonly lastStepTick: number
  readonly lastKeyNeededTick: number
  readonly lastSuccessfulItemLevel: number
  readonly nextActorId: number
  readonly nextEventId: number
  readonly nextEffectId: number
  readonly nextGoodieId: number
  readonly nextItemId: number
  readonly nextKeyDropLevel: number
  readonly sharedRng: NativeRngState
}

export interface BoneyardLootParticipant {
  readonly advancedUnlocks: readonly boolean[]
  readonly alive: boolean
  readonly connected: boolean
  readonly headingIndex: number
  readonly level: number
  readonly modifiers: NativeLootModifiers
  readonly ownedRecipeIndexes: readonly number[]
  readonly playerId: string
  readonly position: Readonly<BoneyardPoint>
}

export interface BoneyardLootPickup {
  readonly actorId: number
  readonly amount: number
  readonly bonusKind: NativeBonusKind | null
  readonly item: NativeLootItem | null
  readonly kind: BoneyardLootActor['kind']
  readonly orbKind: NativeOrbKind | null
  readonly orbValue: number
  readonly playerId: string
  readonly sourcePosition: Readonly<BoneyardPoint>
  readonly tick: number
}

export interface BoneyardLootEvent {
  readonly actorId: number
  readonly eventId: number
  readonly goodieId?: number
  readonly phase?: 0 | 1 | 2
  readonly playbackRate?: number
  readonly playerId?: string
  readonly position: Readonly<BoneyardPoint>
  readonly sound?: BoneyardLootSound
  readonly text?: string
  readonly tick: number
  readonly type: BoneyardLootEventType
}

export interface BoneyardLootStoreStepContext {
  readonly participants: readonly BoneyardLootParticipant[]
  readonly placement: NativeLootPlacement
  readonly registerWorldPainter?: RegisterNativeWorldPainter
  readonly tick: number
}

export interface BoneyardLootStoreStepResult {
  readonly events: readonly BoneyardLootEvent[]
  readonly pickups: readonly BoneyardLootPickup[]
  readonly store: BoneyardLootStore
}

export interface BoneyardGoodieKeyNeededResult {
  readonly event: BoneyardLootEvent | null
  readonly store: BoneyardLootStore
}

export interface SpawnBoneyardLootResult {
  readonly rejectedCount: number
  readonly store: BoneyardLootStore
}

export interface NativeHagathaLastWordLoot {
  readonly actorIds: readonly number[]
  readonly gold: number
  readonly items: readonly HubInventoryItem[]
}

export interface BoneyardEnemyLootMaterializationInput {
  readonly advancedUnlocks: readonly boolean[]
  readonly actorSeed: number
  readonly arena: Omit<NativeLootArenaInput, 'lastSuccessfulItemLevel'>
  readonly inventoryHasHealthPotion: boolean
  readonly modifiers: NativeLootModifiers
  readonly nearbyMaskTwoCount: number
  readonly onDeathProgram: NativeSurvivalOnDeathProgram | null
  readonly ownedRecipeIndexes: readonly number[]
  readonly participantLevel: number
  readonly participantSlot: number
  readonly placement: NativeLootPlacement
  readonly policies: NativeLootPolicies
  readonly position: Readonly<BoneyardPoint>
  readonly tick: number
  readonly sceneForcesHealthPotion: boolean
  readonly worldBadguyCount: number
  readonly worldHasHealthPotionSack: boolean
}

interface WorkingLootStep {
  actors: BoneyardLootActor[]
  effects: BoneyardEnemyDeathEffect[]
  events: BoneyardLootEvent[]
  goodies: BoneyardGoodieState[]
  lastSuccessfulItemLevel: number
  nextActorId: number
  nextEventId: number
  nextEffectId: number
  nextGoodieId: number
  nextItemId: number
  nextKeyDropLevel: number
  pickups: BoneyardLootPickup[]
  rejectedCount: number
  registerWorldPainter: RegisterNativeWorldPainter
  sharedRng: NativeRngState
  lastKeyNeededTick: number
}

export function createBoneyardLootStore(
  seed: string,
  sourceGoodies: readonly BoneyardGoodieInput[] = [],
): BoneyardLootStore {
  let sharedRng = createNativeRng(seedBoneyardWaveRng(`${seed}:native-loot`))
  let nextGoodieId = 1
  const goodies = sourceGoodies.map((source, sourceOrder): BoneyardGoodieState => {
    let rewardSeed = source.rewardSeed
    if (rewardSeed === undefined) {
      const draw = drawNativeInteger(sharedRng, 1_000)
      sharedRng = draw.state
      rewardSeed = draw.value
    }
    if (!Number.isSafeInteger(rewardSeed) || rewardSeed < 0 || rewardSeed >= 1_000) {
      throw new RangeError('Goodie reward seed must be within [0,999]')
    }
    const subtype = source.subtype ?? 0
    if (!Number.isInteger(subtype) || subtype < 0) {
      throw new RangeError('Goodie subtype must be a non-negative integer')
    }
    const sceneryRegistrationOrdinal = source.sceneryRegistrationOrdinal ?? sourceOrder
    if (!Number.isSafeInteger(sceneryRegistrationOrdinal)
        || sceneryRegistrationOrdinal < 0) {
      throw new RangeError('Goodie scenery registration ordinal must be non-negative')
    }
    return Object.freeze({
      active: false,
      activatedByPlayerId: null,
      eid: source.eid,
      exhausted: false,
      id: nextGoodieId++,
      phase: 0,
      position: Object.freeze({ ...source.position }),
      rewardSeed,
      sceneryRegistrationOrdinal,
      subtype,
      timer: 0,
    })
  })
  const keyLevel = initialNativeKeyDropLevel(sharedRng)
  sharedRng = keyLevel.sharedRng
  return {
    actors: Object.freeze([]),
    effects: Object.freeze([]),
    goodies: Object.freeze(goodies),
    lastKeyNeededTick: -NATIVE_GOODIE_KEY_FEEDBACK_INTERVAL_TICKS - 1,
    lastSuccessfulItemLevel: -1,
    lastStepTick: -1,
    nextActorId: NATIVE_LOOT_WORLD_ID_MINIMUM,
    nextEventId: 1,
    nextEffectId: NATIVE_GOODIE_EFFECT_ID_START,
    nextGoodieId,
    nextItemId: 1,
    nextKeyDropLevel: keyLevel.level,
    sharedRng,
  }
}

export function rollBoneyardLootSeed(
  source: BoneyardLootStore,
): { readonly seed: number; readonly store: BoneyardLootStore } {
  const draw = drawNativeInteger(source.sharedRng, NATIVE_LOOT_ACTOR_SEED_BOUND)
  return {
    seed: draw.value,
    store: { ...source, sharedRng: draw.state },
  }
}

export function nativeHagathaLastWordLoot(
  source: BoneyardLootStore,
): NativeHagathaLastWordLoot {
  const actors = source.actors.filter(({ nativeTypeId }) => (
    nativeTypeId === 2012 || nativeTypeId === 2013
  ))
  return Object.freeze({
    actorIds: Object.freeze(actors.map(({ id }) => id)),
    gold: actors.reduce((sum, actor) => (
      actor.nativeTypeId === 2012 ? sum + actor.amount : sum
    ), 0),
    items: Object.freeze(actors.flatMap((actor) => (
      actor.nativeTypeId === 2013 && actor.item !== null ? [actor.item] : []
    ))),
  })
}

export function removeBoneyardLootActors(
  source: BoneyardLootStore,
  actorIds: readonly number[],
): BoneyardLootStore {
  if (actorIds.length === 0) return source
  const removed = new Set(actorIds)
  const actors = source.actors.filter(({ id }) => !removed.has(id))
  const effects = source.effects.filter(({ ownerActorId }) => !removed.has(ownerActorId))
  return actors.length === source.actors.length && effects.length === source.effects.length
    ? source
    : { ...source, actors: Object.freeze(actors), effects: Object.freeze(effects) }
}

export function retireBoneyardGoodiesOutsideBounds(
  source: BoneyardLootStore,
  bounds: Readonly<BoneyardBounds>,
): BoneyardLootStore {
  const goodies = source.goodies.filter(({ position }) => (
    position.x >= bounds.x
    && position.y >= bounds.y
    && position.x <= bounds.x + bounds.w
    && position.y <= bounds.y + bounds.h
  ))
  return goodies.length === source.goodies.length
    ? source
    : { ...source, goodies: Object.freeze(goodies) }
}

export function activateBoneyardGoodie(
  source: BoneyardLootStore,
  eid: string,
  playerId: string,
): BoneyardLootStore {
  let changed = false
  const goodies = source.goodies.map((goodie) => {
    if (goodie.eid !== eid || goodie.active || goodie.exhausted) return goodie
    changed = true
    return Object.freeze({
      ...goodie,
      active: true,
      activatedByPlayerId: playerId,
      timer: 0,
    })
  })
  return changed ? { ...source, goodies: Object.freeze(goodies) } : source
}

export function boneyardGoodieKeyNeeded(
  source: BoneyardLootStore,
  goodieId: number,
  playerId: string,
  tick: number,
): BoneyardGoodieKeyNeededResult {
  validateTick(tick)
  const goodie = source.goodies.find(({ id }) => id === goodieId)
  if (!goodie || tick <= source.lastKeyNeededTick + NATIVE_GOODIE_KEY_FEEDBACK_INTERVAL_TICKS) {
    return { event: null, store: source }
  }
  const event = Object.freeze({
    actorId: goodie.id,
    eventId: source.nextEventId,
    goodieId: goodie.id,
    playerId,
    position: goodie.position,
    text: 'I need a key!',
    tick,
    type: 'goodie-key-needed' as const,
  })
  return {
    event,
    store: {
      ...source,
      lastKeyNeededTick: tick,
      nextEventId: source.nextEventId + 1,
    },
  }
}

export function spawnBoneyardLootSpecs(
  source: BoneyardLootStore,
  specs: readonly NativeLootDropSpec[],
  tick: number,
  registerWorldPainter?: RegisterNativeWorldPainter,
): SpawnBoneyardLootResult {
  validateTick(tick)
  const work = working(source, registerWorldPainter)
  spawnSpecs(work, specs, tick)
  return {
    rejectedCount: work.rejectedCount,
    store: finishWorking(source.lastStepTick, work),
  }
}

export function spawnBoneyardCustomLootItems(
  source: BoneyardLootStore,
  items: readonly HubInventoryItem[],
  position: Readonly<BoneyardPoint>,
  tick: number,
  registerWorldPainter?: RegisterNativeWorldPainter,
): SpawnBoneyardLootResult {
  validateTick(tick)
  const work = working(source, registerWorldPainter)
  const specs = items.map((item): NativeLootDropSpec => ({
    activationDelayTicks: 0,
    id: 0,
    item: { ...item, id: work.nextItemId++ },
    kind: 'sack',
    nativeTypeId: 2013,
    phase: 0,
    position,
    source: 'enemy',
  }))
  spawnSpecs(work, specs, tick)
  return {
    rejectedCount: work.rejectedCount,
    store: finishWorking(source.lastStepTick, work),
  }
}

export function materializeBoneyardEnemyLoot(
  source: BoneyardLootStore,
  input: BoneyardEnemyLootMaterializationInput,
  registerWorldPainter?: RegisterNativeWorldPainter,
): SpawnBoneyardLootResult {
  const itemIds = createNativeLootItemIds(source.nextItemId)
  const rolled = rollNativeEnemyLoot(enemyLootSelectionInput(source, input, itemIds))
  let prepared = {
    ...source,
    lastSuccessfulItemLevel: rolled.lastSuccessfulItemLevel,
    nextItemId: itemIds.peek(),
    nextKeyDropLevel: rolled.nextKeyDropLevel,
    sharedRng: rolled.sharedRng,
  }
  const drops = [...rolled.drops]
  if (input.onDeathProgram === 'miniboss-die') {
    const selected = selectNativeMinibossDieReward(prepared.sharedRng)
    const scriptItemIds = createNativeLootItemIds(prepared.nextItemId)
    const scripted = materializeNativeLootScriptAction(
      enemyLootSelectionInput(prepared, input, scriptItemIds, selected.rngState),
      selected.action,
    )
    prepared = {
      ...prepared,
      lastSuccessfulItemLevel: scripted.lastSuccessfulItemLevel,
      nextItemId: scriptItemIds.peek(),
      nextKeyDropLevel: scripted.nextKeyDropLevel,
      sharedRng: scripted.sharedRng,
    }
    drops.push(...scripted.drops)
  }
  return spawnBoneyardLootSpecs(prepared, drops, input.tick, registerWorldPainter)
}

function enemyLootSelectionInput(
  source: BoneyardLootStore,
  input: BoneyardEnemyLootMaterializationInput,
  itemIds: ReturnType<typeof createNativeLootItemIds>,
  sharedRng = source.sharedRng,
): NativeLootSelectionInput {
  return {
    actorSeed: input.actorSeed,
    arena: {
      ...input.arena,
      lastSuccessfulItemLevel: source.lastSuccessfulItemLevel,
    },
    explicitGoldAmount: null,
    dropDelayContext: 0,
    inventoryHasHealthPotion: input.inventoryHasHealthPotion,
    itemIds,
    key: {
      current: source.nextKeyDropLevel,
      level: input.arena.level,
      remaining: source.goodies.filter(({ active, exhausted }) => !active && !exhausted).length,
    },
    nearbyMaskTwoCount: input.nearbyMaskTwoCount,
    participant: {
      advancedUnlocks: input.advancedUnlocks,
      level: input.participantLevel,
      modifiers: input.modifiers,
      ownedRecipeIndexes: input.ownedRecipeIndexes,
      slot: input.participantSlot,
    },
    placement: input.placement,
    policies: input.policies,
    sceneForcesHealthPotion: input.sceneForcesHealthPotion,
    sharedRng,
    sourcePosition: input.position,
    worldBadguyCount: input.worldBadguyCount,
    worldHasHealthPotionSack: input.worldHasHealthPotionSack,
  }
}

export function stepBoneyardLootStore(
  source: BoneyardLootStore,
  context: BoneyardLootStoreStepContext,
): BoneyardLootStoreStepResult {
  validateTick(context.tick)
  if (context.tick <= source.lastStepTick) {
    throw new RangeError('loot store ticks must advance monotonically')
  }
  validateParticipants(context.participants)
  const work = working(source, context.registerWorldPainter)
  const firstTick = source.lastStepTick < 0 ? context.tick : source.lastStepTick + 1
  for (let tick = firstTick; tick <= context.tick; tick += 1) {
    stepLootEffects(work, context.placement, tick)
    stepGoodies(
      work,
      context.participants,
      context.placement,
      tick,
    )
    const nextActors: BoneyardLootActor[] = []
    for (const actor of work.actors) {
      const stepped = stepActor(work, actor, context.participants, tick)
      if (stepped) nextActors.push(stepped)
    }
    work.actors = nextActors
  }
  return {
    events: Object.freeze(work.events),
    pickups: Object.freeze(work.pickups),
    store: finishWorking(context.tick, work),
  }
}

function stepActor(
  work: WorkingLootStep,
  source: BoneyardLootActor,
  participants: readonly BoneyardLootParticipant[],
  tick: number,
): BoneyardLootActor | null {
  let actor: BoneyardLootActor = {
    ...source,
    ageTicks: source.ageTicks + 1,
    lastStepTick: tick,
  }
  if (actor.kind === 'orb') return stepOrb(work, actor, participants, tick)
  if (actor.kind === 'bonus') return stepBonus(work, actor, participants, tick)

  const activationDelayTicks = actor.activationDelayTicks - 1
  actor = { ...actor, activationDelayTicks }
  if (activationDelayTicks < 1 && actor.kind === 'gold') {
    if (actor.scatterActive) {
      const scatterProgress = Math.fround(actor.scatterProgress + NATIVE_GOLD_SCATTER_INCREMENT)
      if (scatterProgress > NATIVE_GOLD_SCATTER_END) {
        actor = { ...actor, scatterActive: false, scatterProgress }
        if (!actor.settledSoundEmitted) {
          emitSound(work, actor, tick, 'drop-coins', drawLootPitch(work))
          actor = { ...actor, settledSoundEmitted: true }
        }
      } else {
        actor = { ...actor, scatterProgress }
      }
    } else {
      actor = { ...actor, animationPhase: Math.fround(actor.animationPhase + 2) }
    }
  }
  if (
    activationDelayTicks < 1
    && actor.kind === 'sack'
    && actor.bounceVelocity !== 0
  ) {
    const bounceHeight = Math.fround(actor.bounceHeight + actor.bounceVelocity)
    const bounceVelocity = Math.fround(actor.bounceVelocity * NATIVE_SACK_BOUNCE_MULTIPLIER)
    if (bounceHeight > 0) {
      actor = { ...actor, bounceHeight: 0, bounceVelocity: 0 }
      if (!actor.settledSoundEmitted) {
        const sound = sackDropSound(work, actor)
        emitSound(work, actor, tick, sound)
        actor = { ...actor, settledSoundEmitted: true }
      }
    } else {
      actor = { ...actor, bounceHeight, bounceVelocity }
    }
  }
  if (activationDelayTicks >= 1) return actor
  const participant = firstCaptureParticipant(work, actor, participants)
  if (!participant) return actor
  acceptPickup(work, actor, participant, tick)
  return null
}

function stepOrb(
  work: WorkingLootStep,
  source: BoneyardLootActor,
  participants: readonly BoneyardLootParticipant[],
  tick: number,
): BoneyardLootActor | null {
  const delay = (source.lifetimeTicksRemaining ?? NATIVE_ORB_DECAY_DELAY_TICKS) - 1
  const alpha = Math.min(1, Math.fround(source.alpha + Math.fround(0.05)))
  const animationPhase = Math.fround(source.animationPhase + Math.fround(2.5))
  let orbValue = source.orbValue
  if (delay < 1) orbValue = Math.fround(orbValue - NATIVE_ORB_DECAY_PER_TICK)
  if (orbValue <= 0) return null
  let actor: BoneyardLootActor = {
    ...source,
    alpha,
    animationPhase,
    lifetimeTicksRemaining: delay,
    orbValue,
  }
  if (orbValue <= NATIVE_ORB_ACTIVE_VALUE_FLOOR) return actor
  for (const participant of participants) {
    if (!participant.alive || !participant.connected) continue
    const deltaX = participant.position.x - actor.position.x
    const deltaY = participant.position.y - actor.position.y
    const distanceSquared = deltaX * deltaX + deltaY * deltaY
    const pullRadius = Math.fround(
      60 * participant.modifiers.pickupFactor * participant.modifiers.orbPull,
    )
    if (!(distanceSquared < pullRadius * pullRadius)) continue
    const captureRadius = Math.fround(20 * participant.modifiers.pickupFactor)
    if (distanceSquared < captureRadius * captureRadius) {
      acceptPickup(work, actor, participant, tick)
      return null
    }
    const distance = Math.sqrt(distanceSquared)
    if (distance > 0) actor = {
      ...actor,
      position: Object.freeze({
        x: Math.fround(actor.position.x + deltaX / distance * NATIVE_ORB_MOVE_PER_TICK),
        y: Math.fround(actor.position.y + deltaY / distance * NATIVE_ORB_MOVE_PER_TICK),
      }),
    }
  }
  return actor
}

function stepBonus(
  work: WorkingLootStep,
  source: BoneyardLootActor,
  participants: readonly BoneyardLootParticipant[],
  tick: number,
): BoneyardLootActor | null {
  const lifetimeTicksRemaining = (source.lifetimeTicksRemaining ?? NATIVE_BONUS_LIFETIME_TICKS) - 1
  const alpha = lifetimeTicksRemaining < 1
    ? Math.fround(source.alpha - NATIVE_BONUS_FADE_PER_TICK)
    : source.alpha
  if (alpha <= 0) return null
  const framePhase = Math.fround(source.framePhase + Math.fround(0.20000000298023224))
  const actor: BoneyardLootActor = {
    ...source,
    alpha,
    animationPhase: Math.fround(source.animationPhase + Math.fround(2.5)),
    framePhase: framePhase > 18 ? 0 : framePhase,
    lifetimeTicksRemaining,
    rotationDeg: Math.fround(source.rotationDeg + 1),
  }
  const participant = firstCaptureParticipant(work, actor, participants)
  if (!participant) return actor
  acceptPickup(work, actor, participant, tick)
  return null
}

function firstCaptureParticipant(
  work: WorkingLootStep,
  actor: BoneyardLootActor,
  participants: readonly BoneyardLootParticipant[],
): BoneyardLootParticipant | null {
  for (const participant of participants) {
    if (!participant.alive || !participant.connected) continue
    const dx = participant.position.x - actor.position.x
    const dy = participant.position.y - actor.position.y
    const radiusBase = actor.kind === 'bonus' ? 20 : 30
    const radius = Math.fround(radiusBase * participant.modifiers.pickupFactor)
    if (!(dx * dx + dy * dy < radius * radius)) continue
    if (actor.kind === 'gold' && participant.modifiers.pickupFactor > 1.25999999) {
      const gate = drawNativeInteger(work.sharedRng, 15)
      work.sharedRng = gate.state
      if (gate.value !== 1) continue
    }
    return participant
  }
  return null
}

function acceptPickup(
  work: WorkingLootStep,
  actor: BoneyardLootActor,
  participant: BoneyardLootParticipant,
  tick: number,
): void {
  if (actor.kind === 'gold') spawnGoldPickupEffects(work, actor, tick)
  else if (actor.kind === 'orb') spawnOrbPickupEffect(work, actor, tick)
  work.pickups.push(Object.freeze({
    actorId: actor.id,
    amount: actor.amount,
    bonusKind: actor.bonusKind,
    item: actor.item,
    kind: actor.kind,
    orbKind: actor.orbKind,
    orbValue: actor.orbValue,
    playerId: participant.playerId,
    sourcePosition: Object.freeze({ ...actor.position }),
    tick,
  }))
  const sound = actor.kind === 'gold'
    ? 'pickup-coin'
    : actor.kind === 'orb'
      ? 'goto-orb'
      : actor.kind === 'sack'
        ? 'pickup-bag'
        : undefined
  const playbackRate = sound === undefined
    ? undefined
    : sound === 'goto-orb'
      ? 1
      : drawLootPitch(work)
  const text = actor.kind === 'gold'
    ? `${actor.amount} GOLD`
    : actor.kind === 'sack'
      ? actor.item?.name
      : actor.kind === 'bonus'
        ? actor.bonusKind === 0
          ? 'BONUS SKILL POINT'
          : actor.bonusKind === 2
            ? 'DAMAGE x4'
            : undefined
        : undefined
  emit(work, {
    actorId: actor.id,
    playerId: participant.playerId,
    position: actor.position,
    ...(sound ? { sound } : {}),
    ...(playbackRate === undefined ? {} : { playbackRate }),
    ...(text ? { text } : {}),
    tick,
    type: 'loot-pickup',
  })
}

function spawnGoldPickupEffects(
  work: WorkingLootStep,
  actor: BoneyardLootActor,
  tick: number,
): void {
  for (const [index, alphaLossPerTick, tint] of [
    [0, Math.fround(0.05000000074505806), 0xd9ba70],
    [1, Math.fround(0.10000000149011612), 0xffffff],
  ] as const) {
    work.effects.push(createLootFadeEffect(
      work,
      actor,
      tick,
      83,
      `gold-pickup-${index}`,
      alphaLossPerTick,
      1,
      tint,
      { x: actor.position.x, y: actor.position.y - 10 },
      'add',
    ))
  }
}

function spawnOrbPickupEffect(
  work: WorkingLootStep,
  actor: BoneyardLootActor,
  tick: number,
): void {
  work.effects.push(createLootFadeEffect(
    work,
    actor,
    tick,
    15,
    'orb-pickup',
    Math.fround(0.05000000074505806),
    Math.fround(1.5),
    0xffffff,
    actor.position,
    'normal',
  ))
}

function createLootFadeEffect(
  work: WorkingLootStep,
  actor: BoneyardLootActor,
  tick: number,
  entry: number,
  role: string,
  alphaLossPerTick: number,
  scale: number,
  tint: number,
  position: Readonly<BoneyardPoint>,
  blendMode: BoneyardEnemyDeathEffect['blendMode'],
): BoneyardEnemyDeathEffect {
  return Object.freeze({
    ageTicks: 0,
    alpha: 1,
    alphaMultiplier: 1,
    alphaLossPerTick,
    angularVelocityDeg: 0,
    atlas: 'BadGuys',
    blendMode,
    bounceRetention: 0,
    bounceVelocity: 0,
    entry,
    firstEntry: entry,
    frameCount: 1,
    framePhase: 0,
    frameVelocity: 0,
    frameVelocityDamping: 1,
    frameTicks: 1,
    height: 0,
    id: work.nextEffectId++,
    kind: 'fade',
    lastStepTick: tick,
    lifetimeTicks: 100,
    opacityTimer: 1,
    ownerActorId: actor.id,
    painterRegistration: work.registerWorldPainter('actor'),
    presentationOwner: 'world-sorted',
    position: Object.freeze({ ...position }),
    role,
    rotationDeg: 0,
    scale,
    scaleMultiplier: 1,
    shadow: false,
    spawnTick: tick,
    tint,
    verticalVelocity: 0,
    velocity: Object.freeze({ x: 0, y: 0 }),
    velocityDamping: 1,
  })
}

function spawnGoodieBreakEffects(
  work: WorkingLootStep,
  goodie: BoneyardGoodieState,
  tick: number,
): void {
  const flash = createGoodieBouncer(work, goodie, tick, 52, 'goodie-break-flash')
  const flashAngle = drawLootFloat(work, 45, true) + 180
  const flashDirection = radialVector(flashAngle, 1.5)
  const flashFactor = drawLootFloatRange(work, 2, 1)
  const flashVelocity = {
    x: Math.fround(flashDirection.x * flashFactor),
    y: Math.fround(flashDirection.y * flashFactor),
  }
  work.effects.push(Object.freeze({
    ...flash,
    position: Object.freeze({
      x: Math.fround(
        goodie.position.x
        + flashDirection.x * 25
        + flashVelocity.x * 2,
      ),
      y: Math.fround(goodie.position.y + flashDirection.y * 25),
    }),
    velocity: Object.freeze(flashVelocity),
  }))
  work.effects.push(Object.freeze({
    ageTicks: 0,
    alpha: 1,
    alphaMultiplier: 1,
    alphaLossPerTick: Math.fround(0.07500000298023224),
    angularVelocityDeg: 0,
    atlas: 'BadGuys',
    blendMode: 'add',
    bounceRetention: 0,
    bounceVelocity: 0,
    entry: 15,
    firstEntry: 15,
    frameCount: 1,
    framePhase: 0,
    frameVelocity: 0,
    frameVelocityDamping: 1,
    frameTicks: 1,
    height: 0,
    id: work.nextEffectId++,
    kind: 'fade',
    lastStepTick: tick,
    lifetimeTicks: 100,
    opacityTimer: 1,
    ownerActorId: goodie.id,
    painterRegistration: work.registerWorldPainter('actor'),
    presentationOwner: 'world-sorted',
    position: Object.freeze({ x: goodie.position.x, y: goodie.position.y - 20 }),
    role: 'goodie-break-additive',
    rotationDeg: 0,
    scale: 4,
    scaleMultiplier: 1,
    shadow: false,
    spawnTick: tick,
    tint: 0xffffff,
    verticalVelocity: 0,
    velocity: Object.freeze({ x: 0, y: 0 }),
    velocityDamping: 1,
  }))

  for (let index = 0; index < 20; index += 1) {
    const particle = createGoodieBouncer(
      work,
      goodie,
      tick,
      377,
      `goodie-break-particle-${index}`,
    )
    const entry = 377 + drawLootInteger(work, 4)
    const angle = drawLootFloat(work, 10, true) + drawLootInteger(work, 4) * 90 + 45
    const direction = radialVector(angle, 1.5)
    const factor = Math.fround(drawLootFloat(work, 0.5) + 0.5)
    const velocity = {
      x: Math.fround(direction.x * factor),
      y: Math.fround(direction.y * factor),
    }
    work.effects.push(Object.freeze({
      ...particle,
      entry,
      firstEntry: entry,
      position: Object.freeze({
        x: Math.fround(goodie.position.x + direction.x * 25 + velocity.x * 2),
        y: Math.fround(goodie.position.y + direction.y * 25),
      }),
      velocity: Object.freeze(velocity),
    }))
  }
}

function createGoodieBouncer(
  work: WorkingLootStep,
  goodie: BoneyardGoodieState,
  tick: number,
  entry: number,
  role: string,
): BoneyardEnemyDeathEffect {
  const bounceVelocity = Math.fround(-(drawLootFloat(work, 3) + 2))
  const height = Math.fround(-drawLootFloat(work, 20))
  const rotationDeg = drawLootFloat(work, 360)
  const angularVelocityDeg = Math.fround(drawLootFloat(work, 10) + 1)
  return Object.freeze({
    ageTicks: 0,
    alpha: 1,
    alphaMultiplier: 1,
    alphaLossPerTick: Math.fround(0.014999999664723873),
    angularVelocityDeg,
    atlas: 'BadGuys',
    blendMode: 'normal',
    bounceRetention: Math.fround(0.6499999761581421),
    bounceVelocity,
    entry,
    firstEntry: entry,
    frameCount: 1,
    framePhase: 0,
    frameVelocity: 0,
    frameVelocityDamping: 1,
    frameTicks: 1,
    height,
    id: work.nextEffectId++,
    kind: 'bouncer',
    lastStepTick: tick,
    lifetimeTicks: 1_000,
    opacityTimer: 2,
    ownerActorId: goodie.id,
    painterRegistration: work.registerWorldPainter('actor'),
    presentationOwner: 'world-sorted',
    position: Object.freeze({ ...goodie.position }),
    role,
    rotationDeg,
    scale: 1,
    scaleMultiplier: 1,
    shadow: true,
    spawnTick: tick,
    tint: 0xffffff,
    verticalVelocity: bounceVelocity,
    velocity: Object.freeze({ x: 0, y: 0 }),
    velocityDamping: 1,
  })
}

function stepLootEffects(
  work: WorkingLootStep,
  placement: NativeLootPlacement,
  tick: number,
): void {
  const effects: BoneyardEnemyDeathEffect[] = []
  for (const source of work.effects) {
    const effect = stepLootEffect(work, source, placement, tick)
    if (effect !== null) effects.push(effect)
  }
  work.effects = effects
}

function stepLootEffect(
  work: WorkingLootStep,
  source: BoneyardEnemyDeathEffect,
  placement: NativeLootPlacement,
  tick: number,
): BoneyardEnemyDeathEffect | null {
  const ageTicks = source.ageTicks + 1
  if (source.kind !== 'bouncer') {
    const opacityTimer = Math.fround(source.opacityTimer - source.alphaLossPerTick)
    if (opacityTimer <= 0) return null
    return Object.freeze({
      ...source,
      ageTicks,
      alpha: opacityTimer < 1 ? opacityTimer : 1,
      lastStepTick: tick,
      opacityTimer,
    })
  }
  if (source.height !== 0 && tick % 3 === 0) {
    return Object.freeze({ ...source, ageTicks, lastStepTick: tick })
  }
  let position = { ...source.position }
  let velocity = { ...source.velocity }
  let height = source.height
  let verticalVelocity = source.verticalVelocity
  let bounceVelocity = source.bounceVelocity
  let angularVelocityDeg = source.angularVelocityDeg
  let rotationDeg = source.rotationDeg
  if (height !== 0) {
    position = {
      x: Math.fround(position.x + velocity.x),
      y: Math.fround(position.y + velocity.y),
    }
    height = Math.fround(height + verticalVelocity)
    verticalVelocity = Math.fround(verticalVelocity + Math.fround(0.40000000596046448))
    if (height > 0) {
      if (!placement.canPlace(position, 0.01, false)) return null
      angularVelocityDeg = Math.fround(drawLootFloat(work, 10) + 1)
      bounceVelocity = Math.fround(bounceVelocity * Math.fround(0.6499999761581421))
      verticalVelocity = bounceVelocity
      if (drawLootInteger(work, 2) === 1) {
        velocity = {
          x: Math.fround(velocity.x * Math.fround(0.6499999761581421)),
          y: Math.fround(velocity.y * Math.fround(0.6499999761581421)),
        }
      }
      if (verticalVelocity > -0.75) {
        bounceVelocity = 0
        verticalVelocity = 0
        angularVelocityDeg = 0
        velocity = { x: 0, y: 0 }
      }
      height = verticalVelocity
    }
    rotationDeg = Math.fround(rotationDeg + angularVelocityDeg)
  }
  const opacityTimer = Math.fround(source.opacityTimer - source.alphaLossPerTick)
  if (opacityTimer <= 0) return null
  return Object.freeze({
    ...source,
    ageTicks,
    alpha: opacityTimer < 1 ? opacityTimer : 1,
    angularVelocityDeg,
    bounceVelocity,
    height,
    lastStepTick: tick,
    opacityTimer,
    position: Object.freeze(position),
    rotationDeg,
    verticalVelocity,
    velocity: Object.freeze(velocity),
  })
}

function drawLootFloat(work: WorkingLootStep, maximum: number, signed = false): number {
  const draw = drawNativeFloat(work.sharedRng, Math.fround(maximum), signed)
  work.sharedRng = draw.state
  return draw.value
}

function drawLootFloatRange(work: WorkingLootStep, first: number, second: number): number {
  const draw = drawNativeFloatRange(work.sharedRng, first, second)
  work.sharedRng = draw.state
  return draw.value
}

function drawLootInteger(work: WorkingLootStep, bound: number): number {
  const draw = drawNativeInteger(work.sharedRng, bound)
  work.sharedRng = draw.state
  return draw.value
}

function radialVector(angleDeg: number, speed: number): BoneyardPoint {
  const angle = angleDeg * Math.PI / 180
  return {
    x: Math.fround(Math.sin(angle) * speed),
    y: Math.fround(-Math.cos(angle) * speed),
  }
}

function stepGoodies(
  work: WorkingLootStep,
  participants: readonly BoneyardLootParticipant[],
  placement: NativeLootPlacement,
  tick: number,
): void {
  work.goodies = work.goodies.map((source) => {
    if (!source.active || source.exhausted) return source
    const timer = source.timer + 1
    let goodie: BoneyardGoodieState = { ...source, timer }
    if (timer === 100 || timer === 200) {
      const phase = (timer === 100 ? 1 : 2) as 1 | 2
      goodie = { ...goodie, phase }
      if (timer === 100) spawnGoodieBreakEffects(work, goodie, tick)
      emit(work, {
        actorId: goodie.id,
        goodieId: goodie.id,
        phase,
        position: goodie.position,
        tick,
        type: 'goodie-phase',
      })
    }
    if (timer !== 250) return Object.freeze(goodie)
    const participant = participants.find(({ playerId }) => (
      playerId === source.activatedByPlayerId
    ))
    goodie = {
      ...goodie,
      active: false,
      activatedByPlayerId: null,
      exhausted: true,
      phase: 2,
    }
    materializeGoodie(
      work,
      goodie,
      participant?.level ?? 1,
      participant?.advancedUnlocks ?? new Array<boolean>(8).fill(false),
      participant?.modifiers ?? NATIVE_LOOT_DEFAULT_MODIFIERS,
      participant?.ownedRecipeIndexes ?? [],
      placement,
      tick,
    )
    return Object.freeze(goodie)
  })
}

function materializeGoodie(
  work: WorkingLootStep,
  goodie: BoneyardGoodieState,
  playerLevel: number,
  advancedUnlocks: readonly boolean[],
  modifiers: NativeLootModifiers,
  ownedRecipeIndexes: readonly number[],
  placement: NativeLootPlacement,
  tick: number,
): void {
  const itemIds = createNativeLootItemIds(work.nextItemId)
  const contents = resolveNativeGoodieContents({
    advancedUnlocks,
    itemIds,
    ownedRecipeIndexes,
    playerLevel,
    selector: goodie.rewardSeed % 18,
    sharedRng: work.sharedRng,
  })
  work.nextItemId = itemIds.peek()
  work.sharedRng = contents.sharedRng
  const position = Object.freeze({ x: goodie.position.x, y: goodie.position.y + 25 })
  if (contents.gold > 0) {
    const goldIds = createNativeLootItemIds(work.nextItemId)
    const rolled = rollNativeEnemyLoot({
      actorSeed: 0,
      arena: {
        disableMask: 0,
        itemLevelMaximum: 100,
        itemLevelMinimum: 0,
        lastSuccessfulItemLevel: -1,
        level: 0,
        mode: 0,
        specialSuppression: false,
      },
      explicitGoldAmount: contents.gold,
      dropDelayContext: 0,
      inventoryHasHealthPotion: false,
      itemIds: goldIds,
      key: { current: 1, level: 0, remaining: 0 },
      nearbyMaskTwoCount: 0,
      participant: {
        advancedUnlocks: new Array<boolean>(8).fill(false),
        level: 1,
        modifiers,
        ownedRecipeIndexes: [],
        slot: 0,
      },
      placement,
      policies: { gold: 3, item: 4, orb: 4, potion: 4, powerup: 4, specificItem: 0 },
      sceneForcesHealthPotion: false,
      sharedRng: work.sharedRng,
      sourcePosition: position,
      worldBadguyCount: 0,
      worldHasHealthPotionSack: false,
    })
    work.nextItemId = goldIds.peek()
    work.sharedRng = rolled.sharedRng
    spawnSpecs(work, rolled.drops.map((drop) => ({ ...drop, source: 'goodie' })), tick)
    return
  }
  if (contents.items.length === 0) return
  const bundle: NativeLootItem = {
    contents: contents.items,
    equipmentType: null,
    iconRecords: [70],
    id: work.nextItemId++,
    kind: 'sack',
    name: 'Sack',
    nativeSubtype: 0,
    nativeTypeId: 7008,
    quantity: 1,
    rarity: null,
    recipeIndex: null,
  }
  spawnSpecs(work, [{
    activationDelayTicks: 0,
    id: 0,
    item: bundle,
    kind: 'sack',
    nativeTypeId: 2013,
    phase: 0,
    position,
    source: 'goodie',
  }], tick)
}

function spawnSpecs(
  work: WorkingLootStep,
  specs: readonly NativeLootDropSpec[],
  tick: number,
): void {
  for (const spec of specs) {
    const id = allocateActorId(work)
    if (id === null) {
      work.rejectedCount += 1
      continue
    }
    work.actors.push(Object.freeze({
      activationDelayTicks: spec.activationDelayTicks,
      ageTicks: 0,
      alpha: spec.kind === 'bonus' ? 1 : 0,
      amount: spec.amount ?? 0,
      animationPhase: spec.phase,
      bonusKind: spec.bonusKind ?? null,
      bounceHeight: spec.kind === 'sack' ? NATIVE_SACK_INITIAL_HEIGHT : 0,
      bounceVelocity: spec.kind === 'sack' ? NATIVE_SACK_INITIAL_VELOCITY : 0,
      framePhase: 0,
      id,
      item: spec.item ?? null,
      kind: spec.kind,
      lastStepTick: tick - 1,
      lifetimeTicksRemaining: spec.kind === 'orb'
        ? NATIVE_ORB_DECAY_DELAY_TICKS
        : spec.kind === 'bonus'
          ? NATIVE_BONUS_LIFETIME_TICKS
          : null,
      nativeTypeId: spec.nativeTypeId,
      orbKind: spec.orbKind ?? null,
      orbValue: spec.value ?? 0,
      painterRegistration: work.registerWorldPainter('actor'),
      position: Object.freeze({ ...spec.position }),
      rotationDeg: spec.rotationDeg ?? 0,
      scatterSeed: spec.scatterSeed ?? 0,
      scatterActive: spec.kind === 'gold',
      scatterProgress: 0,
      settledSoundEmitted: false,
      source: spec.source,
      spawnTick: tick,
      tier: spec.tier ?? 0,
    }))
  }
}

function allocateActorId(work: WorkingLootStep): number | null {
  const occupied = new Set(work.actors.map(({ id }) => id))
  for (let attempt = 0; attempt < 2_048; attempt += 1) {
    const candidate = work.nextActorId
    work.nextActorId = candidate >= NATIVE_LOOT_WORLD_ID_MAXIMUM
      ? NATIVE_LOOT_WORLD_ID_MINIMUM
      : candidate + 1
    if (!occupied.has(candidate)) return candidate
  }
  return null
}

function sackDropSound(
  work: WorkingLootStep,
  actor: BoneyardLootActor,
): BoneyardLootSound {
  if (actor.item?.nativeTypeId === 7001) return 'drop-potion'
  const draw = drawNativeInteger(work.sharedRng, 2)
  work.sharedRng = draw.state
  return draw.value === 0 ? 'drop-bag-1' : 'drop-bag-2'
}

function emitSound(
  work: WorkingLootStep,
  actor: BoneyardLootActor,
  tick: number,
  sound: BoneyardLootSound,
  playbackRate = 1,
): void {
  emit(work, {
    actorId: actor.id,
    position: actor.position,
    playbackRate,
    sound,
    tick,
    type: 'loot-drop-sound',
  })
}

function drawLootPitch(work: WorkingLootStep): number {
  const draw = drawNativeFloat(work.sharedRng, Math.fround(0.10000000149011612), true)
  work.sharedRng = draw.state
  return Math.fround(draw.value + 1)
}

function emit(
  work: WorkingLootStep,
  event: Omit<BoneyardLootEvent, 'eventId'>,
): void {
  work.events.push(Object.freeze({ ...event, eventId: work.nextEventId++ }))
}

function working(
  source: BoneyardLootStore,
  registerWorldPainter?: RegisterNativeWorldPainter,
): WorkingLootStep {
  const standaloneOrder = createNativeWorldManagerOrder({
    nextRegistrationOrdinal: {
      actor: source.actors.reduce(
        (next, actor) => Math.max(next, actor.painterRegistration.registrationOrdinal + 1),
        0,
      ),
      transient: 0,
    },
  })
  return {
    actors: [...source.actors],
    effects: [...source.effects],
    events: [],
    goodies: [...source.goodies],
    lastSuccessfulItemLevel: source.lastSuccessfulItemLevel,
    nextActorId: source.nextActorId,
    nextEventId: source.nextEventId,
    nextEffectId: source.nextEffectId,
    nextGoodieId: source.nextGoodieId,
    nextItemId: source.nextItemId,
    nextKeyDropLevel: source.nextKeyDropLevel,
    pickups: [],
    rejectedCount: 0,
    registerWorldPainter: registerWorldPainter ?? standaloneOrder.register,
    sharedRng: source.sharedRng,
    lastKeyNeededTick: source.lastKeyNeededTick,
  }
}

function finishWorking(lastStepTick: number, work: WorkingLootStep): BoneyardLootStore {
  return {
    actors: Object.freeze(work.actors),
    effects: Object.freeze(work.effects),
    goodies: Object.freeze(work.goodies),
    lastKeyNeededTick: work.lastKeyNeededTick,
    lastSuccessfulItemLevel: work.lastSuccessfulItemLevel,
    lastStepTick,
    nextActorId: work.nextActorId,
    nextEventId: work.nextEventId,
    nextEffectId: work.nextEffectId,
    nextGoodieId: work.nextGoodieId,
    nextItemId: work.nextItemId,
    nextKeyDropLevel: work.nextKeyDropLevel,
    sharedRng: work.sharedRng,
  }
}

function validateParticipants(participants: readonly BoneyardLootParticipant[]): void {
  const ids = new Set<string>()
  for (const participant of participants) {
    if (ids.has(participant.playerId)) throw new Error('loot participant order contains a duplicate')
    ids.add(participant.playerId)
    if (!Number.isFinite(participant.position.x) || !Number.isFinite(participant.position.y)) {
      throw new RangeError('loot participant position must be finite')
    }
    if (!Number.isInteger(participant.headingIndex) || participant.headingIndex < 0 || participant.headingIndex >= 24) {
      throw new RangeError('loot participant heading must be within [0,24)')
    }
    if (!Number.isInteger(participant.level) || participant.level < 0) {
      throw new RangeError('loot participant level must be non-negative')
    }
  }
}

function validateTick(tick: number): void {
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new RangeError('loot tick must be a non-negative safe integer')
  }
}
