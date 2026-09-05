import { DOWSING_EQUIPMENT_RECIPES } from './hub-economy.ts'
import {
  createNativeRng,
  drawNativeFloat,
  drawNativeFloatRange,
  drawNativeInteger,
  type NativeRngState,
} from './native-rng.ts'
import type { BoneyardPoint } from './boneyard.ts'
import {
  equipmentRecipeItem,
  miscItem,
  potionItem,
  selectEnemyItem,
  type NativeLootItem,
  type NativeLootItemIds,
} from './native-loot-items.ts'

export const NATIVE_LOOT_CANDIDATE_ORDER = Object.freeze([
  'key', 'orb', 'gold', 'item', 'potion', 'powerup',
] as const)
export type NativeLootCategory = typeof NATIVE_LOOT_CANDIDATE_ORDER[number]
export type NativeLootPolicy = 0 | 1 | 2 | 3 | 4 | 5
export type NativeOrbKind = 'health' | 'mana'
export type NativeBonusKind = 0 | 1 | 2

export const NATIVE_LOOT_ACTOR_SEED_BOUND = 10_000_000
export const NATIVE_LOOT_PICKUP_FACTOR = Math.fround(1.25)
export const NATIVE_LOOT_ORB_PULL_MULTIPLIER = Math.fround(1)
export const NATIVE_LOOT_ORB_VALUE_BONUS = Math.fround(1.25)
export const NATIVE_LOOT_GOLD_AMOUNT_BONUS = Math.fround(1.25)
export const NATIVE_LOOT_ITEM_CHANCE_MULTIPLIER = Math.fround(0.75)
export const NATIVE_LOOT_GOLD_CHANCE_MULTIPLIER = Math.fround(0.75)
export const NATIVE_LOOT_ORB_CHANCE_MULTIPLIER = Math.fround(0.5)
export const NATIVE_LOOT_POWERUP_CHANCE_MULTIPLIER = Math.fround(0.800000011920929)
export const NATIVE_LOOT_CARRIER_PLACEMENT_RADIUS = Math.fround(15)
export const NATIVE_LOOT_PLACEMENT_VERTICAL_SCALE = Math.fround(0.800000011920929)
const NATIVE_LOOT_PLACEMENT_PI = 3.141592502593994 // GMath +4, authored float at 0x007DE8A8.

export interface NativeLootModifiers {
  readonly goldAmount: number
  readonly goldChance: number
  readonly itemChance: number
  readonly orbChance: number
  readonly orbPull: number
  readonly orbValueBonus: boolean
  readonly pickupFactor: number
  readonly powerupChance: number
}

export interface NativeLootAttractionModifiers {
  readonly goldAmount: number
  readonly orbPull: number
  readonly pickupFactor: number
}

export const NATIVE_LOOT_DEFAULT_MODIFIERS: NativeLootModifiers = Object.freeze({
  goldAmount: Math.fround(1),
  goldChance: Math.fround(1),
  itemChance: Math.fround(1),
  orbChance: Math.fround(1),
  orbPull: NATIVE_LOOT_ORB_PULL_MULTIPLIER,
  orbValueBonus: false,
  pickupFactor: NATIVE_LOOT_PICKUP_FACTOR,
  powerupChance: Math.fround(1),
})

export interface NativeLootPolicies {
  readonly gold: NativeLootPolicy
  readonly item: NativeLootPolicy
  readonly orb: NativeLootPolicy
  readonly potion: NativeLootPolicy
  readonly powerup: NativeLootPolicy
  readonly specificItem: number
}

export interface NativeLootArenaInput {
  readonly disableMask: number
  readonly itemLevelMaximum: number
  readonly itemLevelMinimum: number
  readonly lastSuccessfulItemLevel: number
  readonly level: number
  readonly mode: number
  readonly specialSuppression: boolean
}

export interface NativeLootParticipantInput {
  readonly advancedUnlocks: readonly boolean[]
  readonly level: number
  readonly modifiers: NativeLootModifiers
  readonly ownedRecipeIndexes: readonly number[]
  readonly slot: number
}

export interface NativeLootKeyInput {
  readonly current: number
  readonly level: number
  readonly remaining: number
}

export interface NativeLootPlacement {
  readonly canPlace: (
    position: Readonly<BoneyardPoint>,
    radius: number,
  ) => boolean
}

export const NATIVE_LOOT_OPEN_PLACEMENT: NativeLootPlacement = Object.freeze({
  canPlace: () => true,
})

export type NativeLootDropKind = 'bonus' | 'gold' | 'orb' | 'sack'
export type NativeLootDropSource = 'enemy' | 'goodie' | 'script'

export interface NativeLootDropSpec {
  readonly activationDelayTicks: number
  readonly amount?: number
  readonly bonusKind?: NativeBonusKind
  readonly id: number
  readonly item?: NativeLootItem
  readonly kind: NativeLootDropKind
  readonly nativeTypeId: 2011 | 2012 | 2013 | 2038
  readonly orbKind?: NativeOrbKind
  readonly phase: number
  readonly position: Readonly<BoneyardPoint>
  readonly rotationDeg?: number
  readonly scatterSeed?: number
  readonly source: NativeLootDropSource
  readonly tier?: number
  readonly value?: number
}

export interface NativeLootSelectionInput {
  readonly actorSeed: number
  readonly arena: NativeLootArenaInput
  readonly explicitGoldAmount: number | null
  readonly dropDelayContext: number
  readonly inventoryHasHealthPotion: boolean
  readonly itemIds: NativeLootItemIds
  readonly key: NativeLootKeyInput
  readonly nearbyMaskTwoCount: number
  readonly participant: NativeLootParticipantInput
  readonly placement: NativeLootPlacement
  readonly policies: NativeLootPolicies
  readonly sceneForcesHealthPotion: boolean
  readonly sharedRng: NativeRngState
  readonly sourcePosition: Readonly<BoneyardPoint>
  readonly worldBadguyCount: number
  readonly worldHasHealthPotionSack: boolean
}

export interface NativeLootSelectionResult {
  readonly drops: readonly NativeLootDropSpec[]
  readonly emergencyPotionAttempted: boolean
  readonly itemIds: NativeLootItemIds
  readonly lastSuccessfulItemLevel: number
  readonly nextKeyDropLevel: number
  readonly selectedCategory: NativeLootCategory | null
  readonly sharedRng: NativeRngState
}

export interface NativeLootMaterializationResult {
  readonly drops: readonly NativeLootDropSpec[]
  readonly lastSuccessfulItemLevel: number
  readonly nextKeyDropLevel: number
  readonly sharedRng: NativeRngState
}

export type NativeLootScriptAction =
  | Readonly<{ amount: number; kind: 'drop-gold' }>
  | Readonly<{ kind: 'drop-item'; recipeIndex: number }>
  | Readonly<{ kind: 'drop-key' }>
  | Readonly<{ kind: 'drop-potion'; subtype: number }>
  | Readonly<{ kind: 'drop-random-gold'; maximum: number; minimum: number }>
  | Readonly<{ kind: 'drop-random-item'; mode: number }>

export interface NativeLootArenaDropLimits {
  readonly itemLevelMaximum: number
  readonly itemLevelMinimum: number
  readonly mode: number
}

export function nativeLootCandidateWeights(count: number): readonly number[] {
  if (!Number.isInteger(count) || count < 1 || count > 6) {
    throw new RangeError('native loot candidate count must be within [1,6]')
  }
  let width = 2
  while (width < count) width *= 2
  const weights = Array.from({ length: count }, (_, result) => (
    Math.floor((width - 1 - result) / count) + 1
  ))
  const divisor = weights.reduce(greatestCommonDivisor)
  return Object.freeze(weights.map((weight) => weight / divisor))
}

export function nativeLootModifiers(
  ownedPerkSelectors: readonly number[],
  attraction: NativeLootAttractionModifiers = NATIVE_LOOT_DEFAULT_MODIFIERS,
): NativeLootModifiers {
  if (!Number.isFinite(attraction.pickupFactor) || attraction.pickupFactor < 0) {
    throw new RangeError('native pickup factor must be finite and non-negative')
  }
  if (!Number.isFinite(attraction.orbPull) || attraction.orbPull < 0) {
    throw new RangeError('native Orb pull factor must be finite and non-negative')
  }
  if (!Number.isFinite(attraction.goldAmount) || attraction.goldAmount < 0) {
    throw new RangeError('native Gold amount factor must be finite and non-negative')
  }
  const owned = new Set(ownedPerkSelectors)
  return Object.freeze({
    goldAmount: Math.fround(
      attraction.goldAmount
        * (owned.has(4) ? NATIVE_LOOT_GOLD_AMOUNT_BONUS : Math.fround(1)),
    ),
    goldChance: owned.has(4) ? NATIVE_LOOT_GOLD_CHANCE_MULTIPLIER : Math.fround(1),
    itemChance: owned.has(3) ? NATIVE_LOOT_ITEM_CHANCE_MULTIPLIER : Math.fround(1),
    orbChance: owned.has(9) ? NATIVE_LOOT_ORB_CHANCE_MULTIPLIER : Math.fround(1),
    orbPull: Math.fround(attraction.orbPull),
    orbValueBonus: owned.has(9),
    pickupFactor: Math.fround(attraction.pickupFactor),
    powerupChance: owned.has(23)
      ? NATIVE_LOOT_POWERUP_CHANCE_MULTIPLIER
      : Math.fround(1),
  })
}

export function nativePowerupLevelBase(level: number): number | null {
  if (!Number.isInteger(level) || level < 0) {
    throw new RangeError('native loot participant level must be non-negative')
  }
  if (level <= 1 || level % 5 === 0) return null
  if (level <= 10) return 75
  if (level <= 15) return 77
  if (level <= 20) return 82
  if (level <= 25) return 92
  if (level <= 30) return 102
  if (level <= 35) return 117
  return 137
}

export function nativeGoldTier(amount: number): 0 | 1 | 2 | 3 {
  if (!Number.isSafeInteger(amount) || amount < 1) {
    throw new RangeError('native Gold amount must be a positive safe integer')
  }
  if (amount < 3) return 0
  if (amount < 5) return 1
  if (amount < 8) return 2
  return 3
}

export function rollNativeEnemyLoot(
  input: NativeLootSelectionInput,
): NativeLootSelectionResult {
  validateSelectionInput(input)
  let sharedRng = input.sharedRng
  if (usesEmergencyPotionLane(input.policies)) {
    const first = drawNativeInteger(sharedRng, 2)
    sharedRng = first.state
    if (first.value === 0) {
      const second = drawNativeInteger(sharedRng, 10)
      sharedRng = second.state
      if (second.value === 1) {
        const canCreate = input.worldBadguyCount > 79
          && !input.inventoryHasHealthPotion
          && !input.worldHasHealthPotionSack
          && input.nearbyMaskTwoCount > 49
        const potion = canCreate
          ? materializePotion(input, sharedRng, 0, 'enemy')
          : null
        if (potion !== null) sharedRng = potion.sharedRng
        return {
          drops: potion?.drops ?? [],
          emergencyPotionAttempted: true,
          itemIds: input.itemIds,
          lastSuccessfulItemLevel: input.arena.lastSuccessfulItemLevel,
          nextKeyDropLevel: input.key.current,
          selectedCategory: canCreate ? 'potion' : null,
          sharedRng,
        }
      }
    }
  }

  let privateRng = createNativeRng(input.actorSeed)
  const candidates: NativeLootCategory[] = []
  if ((input.arena.disableMask & (1 << 4)) === 0) {
    const keyBound = Math.trunc((Math.trunc((input.arena.level - 20) / 5) + 10) * 100)
    if (input.key.current <= input.key.level && input.key.remaining > 0) {
      const draw = keyBound <= 0 ? null : drawNativeInteger(privateRng, keyBound)
      if (draw) privateRng = draw.state
      if (keyBound <= 0 || draw?.value === 2) candidates.push('key')
    }
  }

  privateRng = appendPolicyCandidate(
    candidates,
    'orb',
    input.policies.orb,
    input.arena.disableMask & (1 << 3),
    policyBound(input.policies.orb, 8, 16, 4, input.participant.modifiers.orbChance),
    privateRng,
  )
  privateRng = appendPolicyCandidate(
    candidates,
    'gold',
    input.policies.gold,
    input.arena.disableMask & 1,
    policyBound(input.policies.gold, 22, 44, 11, input.participant.modifiers.goldChance),
    privateRng,
    input.arena.specialSuppression || input.policies.gold === 5,
  )
  privateRng = appendPolicyCandidate(
    candidates,
    'item',
    input.policies.item,
    input.arena.disableMask & (1 << 5),
    itemCandidateBound(input),
    privateRng,
    input.arena.specialSuppression,
  )
  privateRng = appendPolicyCandidate(
    candidates,
    'potion',
    input.policies.potion,
    input.arena.disableMask & (1 << 1),
    policyBound(input.policies.potion, 400, 800, 200, 1),
    privateRng,
    input.policies.potion === 3 && !input.sceneForcesHealthPotion,
  )
  const powerupBase = nativePowerupLevelBase(input.participant.level)
  privateRng = appendPolicyCandidate(
    candidates,
    'powerup',
    input.policies.powerup,
    input.arena.disableMask & (1 << 2),
    input.policies.powerup === 3
      ? 0
      : powerupBase === null
        ? null
        : powerupCandidateBound(powerupBase, input.policies.powerup, input.participant.modifiers),
    privateRng,
  )

  if (candidates.length === 0) {
    return {
      drops: [],
      emergencyPotionAttempted: false,
      itemIds: input.itemIds,
      lastSuccessfulItemLevel: input.arena.lastSuccessfulItemLevel,
      nextKeyDropLevel: input.key.current,
      selectedCategory: null,
      sharedRng,
    }
  }
  const choice = drawNativeInteger(privateRng, candidates.length)
  privateRng = choice.state
  const selectedCategory = candidates[choice.value]!
  if (
    input.participant.slot !== 0
    && selectedCategory !== 'key'
    && selectedCategory !== 'orb'
  ) {
    return {
      drops: [],
      emergencyPotionAttempted: false,
      itemIds: input.itemIds,
      lastSuccessfulItemLevel: input.arena.lastSuccessfulItemLevel,
      nextKeyDropLevel: input.key.current,
      selectedCategory,
      sharedRng,
    }
  }

  const materialized = materializeSelected(
    selectedCategory,
    input,
    privateRng,
    sharedRng,
  )
  sharedRng = materialized.sharedRng
  let drops = [...materialized.drops]
  if (
    input.policies.gold === 5
    && selectedCategory !== 'gold'
    && !input.arena.specialSuppression
  ) {
    const scatter = drawNativeFloatRange(sharedRng, Math.fround(0.9), Math.fround(1.1))
    sharedRng = scatter.state
    const extra = materializeGold(input, sharedRng, 1_000, 'enemy')
    sharedRng = extra.sharedRng
    drops = [...drops, ...extra.drops]
  }
  return {
    drops: Object.freeze(drops),
    emergencyPotionAttempted: false,
    itemIds: input.itemIds,
    lastSuccessfulItemLevel: materialized.lastSuccessfulItemLevel,
    nextKeyDropLevel: materialized.nextKeyDropLevel,
    selectedCategory,
    sharedRng,
  }
}

export function materializeNativeLootScriptAction(
  input: NativeLootSelectionInput,
  action: NativeLootScriptAction,
): NativeLootMaterializationResult {
  validateSelectionInput(input)
  if (action.kind === 'drop-gold') {
    if (!Number.isSafeInteger(action.amount)) {
      throw new RangeError('native fixed-Gold amount must be integral')
    }
    return materializeGold(input, input.sharedRng, action.amount, 'script')
  }
  if (action.kind === 'drop-random-gold') {
    if (
      !Number.isSafeInteger(action.minimum)
      || !Number.isSafeInteger(action.maximum)
      || action.maximum < action.minimum
    ) throw new RangeError('native random-Gold bounds are invalid')
    let rng = input.sharedRng
    let amount = action.minimum
    if (action.minimum !== action.maximum) {
      const selected = drawNativeInteger(rng, action.maximum - action.minimum + 1)
      rng = selected.state
      amount += selected.value
    }
    return materializeGold(input, rng, amount, 'script')
  }
  if (action.kind === 'drop-potion') {
    if (!Number.isInteger(action.subtype) || action.subtype < 0 || action.subtype > 5) {
      throw new RangeError('native script Potion subtype must be within [0,5]')
    }
    return materializePotion(
      input,
      input.sharedRng,
      input.sceneForcesHealthPotion ? 0 : action.subtype,
      'script',
    )
  }
  if (action.kind === 'drop-key') {
    const first = resolveNativeLootPlacement(
      input.sharedRng,
      input.placement,
      input.sourcePosition,
      NATIVE_LOOT_CARRIER_PLACEMENT_RADIUS,
    )
    const second = resolveNativeLootPlacement(
      first.sharedRng,
      input.placement,
      first.position,
      NATIVE_LOOT_CARRIER_PLACEMENT_RADIUS,
    )
    return {
      drops: [sackDrop(input, miscItem(input.itemIds, 1), 'script', second.position)],
      lastSuccessfulItemLevel: input.arena.lastSuccessfulItemLevel,
      nextKeyDropLevel: input.key.current,
      sharedRng: second.sharedRng,
    }
  }
  if (action.kind === 'drop-item') {
    const recipe = DOWSING_EQUIPMENT_RECIPES.find(({ sourceIndex }) => (
      sourceIndex === action.recipeIndex
    ))
    if (!recipe) {
      return {
        drops: [],
        lastSuccessfulItemLevel: input.arena.lastSuccessfulItemLevel,
        nextKeyDropLevel: input.key.current,
        sharedRng: input.sharedRng,
      }
    }
    const placement = resolveNativeLootPlacement(
      input.sharedRng,
      input.placement,
      input.sourcePosition,
      NATIVE_LOOT_CARRIER_PLACEMENT_RADIUS,
    )
    return {
      drops: [sackDrop(
        input,
        equipmentRecipeItem(recipe, input.itemIds),
        'script',
        placement.position,
      )],
      lastSuccessfulItemLevel: input.arena.level,
      nextKeyDropLevel: input.key.current,
      sharedRng: placement.sharedRng,
    }
  }

  if (!Number.isInteger(action.mode) || action.mode < 0 || action.mode > 4) {
    throw new RangeError('native random-Item mode must be within [0,4]')
  }
  const selected = selectEnemyItem(input.sharedRng, {
    ...input,
    policies: { ...input.policies, specificItem: action.mode },
  })
  const placement = selected.item === null
    ? null
    : resolveNativeLootPlacement(
        selected.sharedRng,
        input.placement,
        input.sourcePosition,
        NATIVE_LOOT_CARRIER_PLACEMENT_RADIUS,
      )
  return {
    drops: selected.item && placement
      ? [sackDrop(input, selected.item, 'script', placement.position)]
      : [],
    // DROP RANDOM ITEM's action wrapper writes +0x9064 after the virtual,
    // even if the selected mode could not materialize a candidate.
    lastSuccessfulItemLevel: input.arena.level,
    nextKeyDropLevel: input.key.current,
    sharedRng: placement?.sharedRng ?? selected.sharedRng,
  }
}

export function nativeLootArenaDropLimits(
  mode: number,
  rangeMode: 0 | 1 | 2,
  first = 0,
  second = first,
): NativeLootArenaDropLimits {
  if (!Number.isInteger(mode)) throw new RangeError('native Arena drop mode must be integral')
  if (rangeMode === 0) {
    return { itemLevelMaximum: 9_999, itemLevelMinimum: -9_999, mode }
  }
  if (!Number.isInteger(first) || !Number.isInteger(second)) {
    throw new RangeError('native Arena item-level limits must be integral')
  }
  return rangeMode === 1
    ? { itemLevelMaximum: first, itemLevelMinimum: first, mode }
    : { itemLevelMaximum: second, itemLevelMinimum: first, mode }
}

export function nativeLootDisableMask(
  current: number,
  enableOperand: number,
  mask: number,
): number {
  if (!Number.isInteger(current) || !Number.isInteger(mask) || current < 0 || mask < 0) {
    throw new RangeError('native drop masks must be non-negative integers')
  }
  const disabled = current | mask
  return enableOperand === 0 ? disabled ^ mask : disabled
}

function materializeSelected(
  category: NativeLootCategory,
  input: NativeLootSelectionInput,
  privateRng: NativeRngState,
  sourceSharedRng: NativeRngState,
): NativeLootMaterializationResult {
  let sharedRng = sourceSharedRng
  if (category === 'key') {
    const nextLevel = advanceNativeKeyDropLevel(sharedRng, input.key.current)
    const firstPlacement = resolveNativeLootPlacement(
      nextLevel.sharedRng,
      input.placement,
      input.sourcePosition,
      NATIVE_LOOT_CARRIER_PLACEMENT_RADIUS,
    )
    const secondPlacement = resolveNativeLootPlacement(
      firstPlacement.sharedRng,
      input.placement,
      firstPlacement.position,
      NATIVE_LOOT_CARRIER_PLACEMENT_RADIUS,
    )
    return {
      drops: [sackDrop(input, miscItem(input.itemIds, 1), 'enemy', secondPlacement.position)],
      lastSuccessfulItemLevel: input.arena.lastSuccessfulItemLevel,
      nextKeyDropLevel: nextLevel.level,
      sharedRng: secondPlacement.sharedRng,
    }
  }
  if (category === 'orb') {
    // The constructor's shared defaults remain consumed before the private overwrite.
    let constructor = drawNativeInteger(sharedRng, 3)
    sharedRng = constructor.state
    const constructorValue = drawNativeFloat(sharedRng, Math.fround(0.45))
    sharedRng = constructorValue.state
    const constructorPhase = drawNativeFloat(sharedRng, 360)
    sharedRng = constructorPhase.state
    const kind = drawNativeInteger(privateRng, 3)
    const value = drawNativeFloat(kind.state, Math.fround(0.45))
    const phase = drawNativeFloat(value.state, 360)
    const raw = Math.fround(Math.fround(value.value) + Math.fround(0.25))
    return {
      drops: [{
        activationDelayTicks: 0,
        id: input.itemIds.next(),
        kind: 'orb',
        nativeTypeId: 2011,
        orbKind: kind.value === 1 ? 'health' : 'mana',
        phase: phase.value,
        position: Object.freeze({ ...input.sourcePosition }),
        source: 'enemy',
        value: input.participant.modifiers.orbValueBonus
          ? Math.fround(raw * NATIVE_LOOT_ORB_VALUE_BONUS)
          : raw,
      }],
      lastSuccessfulItemLevel: input.arena.lastSuccessfulItemLevel,
      nextKeyDropLevel: input.key.current,
      sharedRng,
    }
  }
  if (category === 'gold') {
    return materializeGold(
      input,
      sharedRng,
      input.explicitGoldAmount,
      'enemy',
    )
  }
  if (category === 'potion') {
    const subtype = input.sceneForcesHealthPotion
      ? { state: sharedRng, value: 0 }
      : drawNativeInteger(sharedRng, 2)
    return materializePotion(input, subtype.state, subtype.value, 'enemy')
  }
  if (category === 'powerup') {
    const first = drawNativeInteger(sharedRng, 3)
    const overwrite = drawNativeInteger(first.state, 2)
    const phase = drawNativeFloat(overwrite.state, 360)
    const bonusKind = (overwrite.value === 1 ? 2 : first.value) as NativeBonusKind
    return {
      drops: [{
        activationDelayTicks: 0,
        bonusKind,
        id: input.itemIds.next(),
        kind: 'bonus',
        nativeTypeId: 2038,
        phase: phase.value,
        position: Object.freeze({ ...input.sourcePosition }),
        source: 'enemy',
      }],
      lastSuccessfulItemLevel: input.arena.lastSuccessfulItemLevel,
      nextKeyDropLevel: input.key.current,
      sharedRng: phase.state,
    }
  }
  const selected = selectEnemyItem(sharedRng, input)
  const placement = selected.item === null
    ? null
    : resolveNativeLootPlacement(
        selected.sharedRng,
        input.placement,
        input.sourcePosition,
        NATIVE_LOOT_CARRIER_PLACEMENT_RADIUS,
      )
  return {
    drops: selected.item && placement
      ? [sackDrop(
          input,
          selected.item,
          'enemy',
          placement.position,
          Math.trunc(input.dropDelayContext * 1.100000023841858),
        )]
      : [],
    lastSuccessfulItemLevel: selected.item
      ? input.arena.level
      : input.arena.lastSuccessfulItemLevel,
    nextKeyDropLevel: input.key.current,
    sharedRng: placement?.sharedRng ?? selected.sharedRng,
  }
}

function materializeGold(
  input: NativeLootSelectionInput,
  sourceRng: NativeRngState,
  explicitAmount: number | null,
  source: NativeLootDropSource,
): NativeLootMaterializationResult {
  let rng = sourceRng
  let total: number
  if (explicitAmount === null || explicitAmount === -1) {
    const addend = Math.max(1, Math.trunc(input.arena.level / 5))
    const amount = drawNativeInteger(rng, Math.trunc(input.arena.level / 2) + 6)
    rng = amount.state
    let raw = amount.value + addend
    if (raw === 1) {
      const correction = drawNativeInteger(rng, 3)
      rng = correction.state
      if (correction.value !== 2) raw = 2
    }
    total = Math.trunc(Math.fround(input.participant.modifiers.goldAmount * raw))
  } else {
    total = Math.trunc(Math.fround(input.participant.modifiers.goldAmount * explicitAmount))
  }
  let remaining = total
  let nextActivationDelayTicks = input.dropDelayContext
  let constructedCount = 0
  const constructed: NativeLootDropSpec[] = []
  while (remaining > 0) {
    const identity = drawNativeInteger(rng, 100_000)
    const phase = drawNativeFloat(identity.state, 360)
    const motion = drawNativeFloat(phase.state, 20, true)
    const radius = drawNativeFloat(motion.state, Math.fround(3))
    const placement = resolveNativeLootPlacement(
      radius.state,
      input.placement,
      input.sourcePosition,
      Math.fround(radius.value + 1),
      constructed,
    )
    rng = placement.sharedRng
    let chunk = Math.min(remaining, 25)
    if (explicitAmount !== null && explicitAmount > 25) {
      const randomize = drawNativeInteger(rng, 2)
      rng = randomize.state
      if (randomize.value === 1) {
        const replacement = drawNativeInteger(rng, Math.floor(chunk / 2))
        rng = replacement.state
        chunk = replacement.value + 1
      }
    }
    constructed.push({
      activationDelayTicks: nextActivationDelayTicks,
      amount: chunk,
      id: input.itemIds.next(),
      kind: 'gold',
      nativeTypeId: 2012,
      phase: phase.value,
      position: placement.position,
      rotationDeg: motion.value,
      scatterSeed: identity.value,
      source,
      tier: nativeGoldTier(chunk),
    })
    remaining -= chunk
    constructedCount += 1
    if (constructedCount > 5) {
      const delay = drawNativeFloat(rng, Math.fround(0.04))
      rng = delay.state
      nextActivationDelayTicks += Math.trunc(Math.fround(
        Math.fround(delay.value + 0.009999999776482582) * 100,
      ))
    }
  }

  // Arena_CreateGold constructs one stack Gold solely to recover its +0x1c
  // sort-field offset. Its constructor draws remain part of the shared stream.
  const dummyIdentity = drawNativeInteger(rng, 100_000)
  const dummyPhase = drawNativeFloat(dummyIdentity.state, 360)
  const dummyRotation = drawNativeFloat(dummyPhase.state, 20, true)
  rng = dummyRotation.state

  const drops: NativeLootDropSpec[] = []
  for (const drop of [...constructed].sort((left, right) => left.position.y - right.position.y)) {
    if (drop.activationDelayTicks !== 0) {
      drops.push(drop)
      continue
    }
    const delay = drawNativeFloat(rng, Math.fround(0.25))
    rng = delay.state
    drops.push({
      ...drop,
      activationDelayTicks: Math.trunc(Math.fround(delay.value * 100)),
    })
  }
  return {
    drops: Object.freeze(drops),
    lastSuccessfulItemLevel: input.arena.lastSuccessfulItemLevel,
    nextKeyDropLevel: input.key.current,
    sharedRng: rng,
  }
}

export function initialNativeKeyDropLevel(
  sourceRng: NativeRngState,
): { readonly level: number; readonly sharedRng: NativeRngState } {
  const draw = drawNativeInteger(sourceRng, 8)
  return { level: draw.value + 5, sharedRng: draw.state }
}

export function advanceNativeKeyDropLevel(
  sourceRng: NativeRngState,
  currentLevel: number,
): { readonly level: number; readonly sharedRng: NativeRngState } {
  if (!Number.isSafeInteger(currentLevel) || currentLevel < 0) {
    throw new RangeError('native next-key level must be a non-negative safe integer')
  }
  if (currentLevel < 13) {
    const draw = drawNativeInteger(sourceRng, 11)
    return { level: draw.value + 15, sharedRng: draw.state }
  }
  if (currentLevel < 26) {
    const draw = drawNativeInteger(sourceRng, 11)
    return { level: draw.value + 30, sharedRng: draw.state }
  }
  if (currentLevel <= 40) {
    const draw = drawNativeInteger(sourceRng, 21)
    return { level: draw.value + 50, sharedRng: draw.state }
  }
  return { level: currentLevel, sharedRng: sourceRng }
}

function materializePotion(
  input: NativeLootSelectionInput,
  sourceRng: NativeRngState,
  subtype: number,
  source: NativeLootDropSource,
): NativeLootMaterializationResult {
  const placement = resolveNativeLootPlacement(
    sourceRng,
    input.placement,
    input.sourcePosition,
    NATIVE_LOOT_CARRIER_PLACEMENT_RADIUS,
  )
  return {
    drops: [sackDrop(input, potionItem(input.itemIds, subtype), source, placement.position)],
    lastSuccessfulItemLevel: input.arena.lastSuccessfulItemLevel,
    nextKeyDropLevel: input.key.current,
    sharedRng: placement.sharedRng,
  }
}

function sackDrop(
  input: Pick<NativeLootSelectionInput, 'itemIds' | 'sourcePosition'>,
  item: NativeLootItem,
  source: NativeLootDropSource,
  position: Readonly<BoneyardPoint> = input.sourcePosition,
  activationDelayTicks = 0,
): NativeLootDropSpec {
  return {
    activationDelayTicks,
    id: input.itemIds.next(),
    item,
    kind: 'sack',
    nativeTypeId: 2013,
    phase: 0,
    position: Object.freeze({ ...position }),
    source,
    tier: 0,
  }
}

export function resolveNativeLootPlacement(
  sourceRng: NativeRngState,
  placement: NativeLootPlacement,
  sourcePosition: Readonly<BoneyardPoint>,
  radius: number,
  pendingGold: readonly Pick<NativeLootDropSpec, 'position'>[] = [],
): {
  readonly position: Readonly<BoneyardPoint>
  readonly sharedRng: NativeRngState
} {
  if (!Number.isFinite(radius) || radius <= 0) {
    throw new RangeError('native loot placement radius must be positive and finite')
  }
  const origin = Object.freeze({
    x: Math.fround(sourcePosition.x),
    y: Math.fround(sourcePosition.y),
  })
  const nativeRadius = Math.fround(radius)
  const canPlace = (position: Readonly<BoneyardPoint>): boolean => {
    if (!placement.canPlace(position, nativeRadius)) return false
    const horizontal = Math.fround(nativeRadius + NATIVE_LOOT_CARRIER_PLACEMENT_RADIUS)
    const vertical = Math.fround(
      Math.fround(nativeRadius * NATIVE_LOOT_PLACEMENT_VERTICAL_SCALE)
      + Math.fround(NATIVE_LOOT_CARRIER_PLACEMENT_RADIUS * NATIVE_LOOT_PLACEMENT_VERTICAL_SCALE),
    )
    for (const earlier of pendingGold) {
      const dx = Math.fround(Math.fround(position.x - earlier.position.x) * Math.fround(1 / horizontal))
      const dy = Math.fround(Math.fround(position.y - earlier.position.y) * Math.fround(1 / vertical))
      if (Math.fround(dx * dx + dy * dy) < 1) return false
    }
    return true
  }
  if (canPlace(origin)) {
    return { position: origin, sharedRng: sourceRng }
  }

  let rng = sourceRng
  let searchRadius = nativeRadius
  let growth = Math.fround(1)
  for (;;) {
    const sampleCount = Math.trunc(
      Math.fround(2 * NATIVE_LOOT_PLACEMENT_PI * (searchRadius + nativeRadius)) / (2 * searchRadius),
    )
    const angleStep = Math.fround(360 / sampleCount)
    const start = drawNativeFloat(rng, 360)
    rng = start.state
    const verticalRadius = Math.fround(searchRadius * NATIVE_LOOT_PLACEMENT_VERTICAL_SCALE)
    let offset = Math.fround(0)
    while (offset < 360) {
      const radians = Math.fround(Math.fround(start.value + offset) * NATIVE_LOOT_PLACEMENT_PI / 180)
      const candidate = Object.freeze({
        x: Math.fround(origin.x + Math.fround(Math.fround(Math.sin(radians)) * searchRadius)),
        y: Math.fround(origin.y - Math.fround(Math.fround(Math.cos(radians)) * verticalRadius)),
      })
      if (canPlace(candidate)) {
        return { position: candidate, sharedRng: rng }
      }
      offset = Math.fround(offset + angleStep)
    }
    searchRadius = Math.fround(searchRadius + growth * nativeRadius)
    const multiplier = drawNativeFloat(rng, 1)
    rng = multiplier.state
    growth = Math.fround((multiplier.value + 1) * growth)
  }
}

function appendPolicyCandidate(
  candidates: NativeLootCategory[],
  category: NativeLootCategory,
  policy: NativeLootPolicy,
  masked: number,
  bound: number | null,
  sourceRng: NativeRngState,
  suppressed = false,
): NativeRngState {
  if (masked !== 0 || policy === 4 || suppressed || bound === null) return sourceRng
  if (policy === 3) {
    candidates.push(category)
    return sourceRng
  }
  const draw = drawNativeInteger(sourceRng, Math.trunc(bound))
  if (draw.value === 1) candidates.push(category)
  return draw.state
}

function policyBound(
  policy: NativeLootPolicy,
  ordinary: number,
  reduced: number,
  increased: number,
  modifier: number,
): number | null {
  if (policy === 3) return 0
  if (policy === 4) return null
  const base = policy === 1 ? reduced : policy === 2 ? increased : ordinary
  return Math.fround(Math.fround(base) * Math.fround(modifier))
}

function itemCandidateBound(input: NativeLootSelectionInput): number | null {
  const base = policyBound(input.policies.item, 360, 720, 180, 1)
  if (base === null) return null
  if (input.policies.item === 3) return 0
  let result = base
  if (input.arena.level < 5) result = Math.fround(result * 200)
  result = Math.fround(result * 2)
  if (input.arena.level !== input.arena.lastSuccessfulItemLevel) {
    result = Math.fround(result * 2)
  }
  return Math.fround(result * input.participant.modifiers.itemChance)
}

function powerupCandidateBound(
  base: number,
  policy: NativeLootPolicy,
  modifiers: NativeLootModifiers,
): number {
  const policyScale = policy === 1 ? 2 : policy === 2 ? 0.5 : 1
  return Math.fround(Math.fround(Math.fround(base * policyScale) * 9) * modifiers.powerupChance)
}

function usesEmergencyPotionLane(policies: NativeLootPolicies): boolean {
  return policies.orb !== 3
    && policies.gold !== 3
    && policies.item !== 3
    && policies.potion !== 3
    && policies.gold !== 5
}

function validateSelectionInput(input: NativeLootSelectionInput): void {
  if (!Number.isSafeInteger(input.actorSeed)) throw new RangeError('loot actor seed must be integral')
  if (!Number.isInteger(input.participant.slot) || input.participant.slot < 0) {
    throw new RangeError('loot participant slot must be non-negative')
  }
  if (!Number.isInteger(input.arena.disableMask) || input.arena.disableMask < 0) {
    throw new RangeError('loot disable mask must be non-negative')
  }
  if (input.explicitGoldAmount !== null && (
    !Number.isSafeInteger(input.explicitGoldAmount) || input.explicitGoldAmount < 1
  )) throw new RangeError('explicit Gold amount must be a positive safe integer')
  if (!Number.isSafeInteger(input.dropDelayContext)) {
    throw new RangeError('loot drop-delay context must be a safe integer')
  }
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = left
  let b = right
  while (b !== 0) [a, b] = [b, a % b]
  return a
}
