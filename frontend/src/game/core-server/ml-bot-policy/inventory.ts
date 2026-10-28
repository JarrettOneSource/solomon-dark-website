import {
  economyHasWizardKey,
  projectInventoryItems,
  type HubEquipmentState,
  type HubInventoryItem,
} from '../../core-kernels/hub-economy.ts'
import {
  nativeEquipmentRecipeEffects,
  nativeEquipmentTooltipSetForRecipe,
  resolveNativeEquipmentEffects,
  type NativeEquipmentModifiers,
} from '../../core-kernels/native-equipment-effects.ts'
import { playerCanAcceptInput } from '../../core-kernels/player-combat.ts'
import {
  NATIVE_ANTIDOTE_IMMUNITY_TICKS,
  NATIVE_DAMAGE_X4_POTION_TICKS,
  NATIVE_MIND_CHUG_TICKS,
} from '../../core-kernels/player-progression.ts'
import {
  getPlayerEconomy,
  getPlayerProgression,
  getPlayerSkillBook,
  type GameSimulationState,
} from '../game-simulation.ts'
import { ML_BOT_POLICY_EQUIPMENT_MODIFIER_FAMILIES } from './closed-unions.ts'
import { ML_BOT_POLICY_SCALES } from './spec.ts'

export interface MlBotPolicyPotionRow {
  readonly itemId: number
  readonly legal: boolean
}

export interface MlBotPolicyInventoryObservation {
  readonly blockO: Float32Array
  readonly blockP: Float32Array
  readonly blockQ: Float32Array
  readonly potions: readonly MlBotPolicyPotionRow[]
}

export interface MlBotPolicyInventoryOptions {
  readonly hasConsumable?: (contentId: string) => boolean
}

const POTION_KINDS = new Set<HubInventoryItem['kind']>([
  'antidote',
  'health-potion',
  'mana-potion',
  'mind-chug',
  'mod-potion',
  'rejuvenation-potion',
  'wizard-chug',
])

export function observeMlBotPolicyInventory(
  state: GameSimulationState,
  playerId: string,
  options: MlBotPolicyInventoryOptions = {},
): MlBotPolicyInventoryObservation {
  const economy = getPlayerEconomy(state, playerId)
  const progression = getPlayerProgression(state, playerId)
  const skillBook = getPlayerSkillBook(state, playerId)
  const inventoryItems = projectInventoryItems(economy.backpack).map(({ item }) => item)
  const potionItems = inventoryItems.filter((item) => (
    item.nativeTypeId === 7001 && POTION_KINDS.has(item.kind)
  )).sort((left, right) => (
    right.quantity - left.quantity
    || left.kind.localeCompare(right.kind)
    || left.id - right.id
  ))
  const blockO = new Float32Array(12 * 19 + 2)
  const potions: MlBotPolicyPotionRow[] = []
  let potionTotal = 0
  for (const item of potionItems) potionTotal += Math.max(0, item.quantity)
  for (let slot = 0; slot < Math.min(12, potionItems.length); slot += 1) {
    const item = potionItems[slot]!
    const start = slot * 19
    const stockSubtype = item.kind === 'mod-potion' ? null : item.nativeSubtype
    const identity = item.kind === 'mod-potion' && item.modContent
      ? `${item.modContent.modId}:${item.modContent.contentId}`
      : item.kind
    const [hashA, hashB] = identityHashes(identity)
    blockO[start] = Number(item.quantity > 0)
    blockO[start + 1] = countScaled(item.quantity)
    blockO[start + 2] = Number(stockSubtype === 0)
    blockO[start + 3] = Number(stockSubtype === 1)
    blockO[start + 4] = Number(stockSubtype === 2)
    blockO[start + 5] = Number(stockSubtype === 3)
    blockO[start + 6] = Number(stockSubtype === 4)
    blockO[start + 7] = Number(stockSubtype === 5)
    blockO[start + 8] = Number(item.kind === 'mod-potion')
    blockO[start + 9] = Number(stockSubtype === 0 || stockSubtype === 5)
    blockO[start + 10] = Number(stockSubtype === 1 || stockSubtype === 5)
    blockO[start + 11] = stockSubtype === 2 ? 4 / ML_BOT_POLICY_SCALES.multiplier : 0
    blockO[start + 12] = Number(stockSubtype === 3)
    blockO[start + 13] = stockSubtype === 3
      ? durationScaled(NATIVE_ANTIDOTE_IMMUNITY_TICKS)
      : 0
    blockO[start + 14] = Number(stockSubtype === 4)
    blockO[start + 15] = stockSubtype === 2
      ? durationScaled(NATIVE_DAMAGE_X4_POTION_TICKS)
      : stockSubtype === 3
        ? durationScaled(NATIVE_ANTIDOTE_IMMUNITY_TICKS)
        : stockSubtype === 4
          ? durationScaled(NATIVE_MIND_CHUG_TICKS)
          : item.modContent
            ? scaledUnsigned(
                item.modContent.durationMs / 1_000,
                ML_BOT_POLICY_SCALES.statusDurationSeconds,
              )
            : 0
    blockO[start + 16] = 0
    blockO[start + 17] = hashA
    blockO[start + 18] = hashB
    potions.push({
      itemId: item.id,
      legal: potionLegal(state, progression, item, options),
    })
  }
  blockO[12 * 19] = countScaled(potionItems.length)
  blockO[12 * 19 + 1] = countScaled(potionTotal)

  const blockP = observeEquipment(economy.equipment, skillBook.permanentRanks)
  const blockQ = new Float32Array(9)
  const total = inventoryItems.reduce((sum, item) => sum + Math.max(0, item.quantity), 0)
  const count = (predicate: (item: HubInventoryItem) => boolean) => inventoryItems.reduce(
    (sum, item) => sum + (predicate(item) ? Math.max(0, item.quantity) : 0),
    0,
  )
  blockQ[0] = countScaled(total)
  blockQ[1] = countScaled(count((item) => item.nativeTypeId === 7001))
  blockQ[2] = countScaled(count((item) => item.kind === 'equipment'))
  blockQ[3] = countScaled(count((item) => item.kind === 'sack'))
  blockQ[4] = countScaled(count((item) => item.kind === 'dye'))
  blockQ[5] = countScaled(economy.ownedPerkSelectors.length)
  blockQ[6] = countScaled(count((item) => item.kind === 'mod-potion' && item.modContent !== undefined))
  blockQ[7] = countScaled(count((item) => item.kind === 'key'))
  blockQ[8] = Number(economyHasWizardKey(economy))
  return { blockO, blockP, blockQ, potions: Object.freeze(potions) }
}

function observeEquipment(
  equipment: HubEquipmentState,
  permanentRanks: readonly number[],
): Float32Array {
  const block = new Float32Array(7 * 15)
  const slots = [
    equipment.hat,
    equipment.robe,
    equipment.weapon,
    equipment.rings[0],
    equipment.rings[1],
    equipment.rings[2],
    equipment.amulet,
  ]
  const equippedRecipeIndexes = new Set(slots.flatMap((item) => (
    item?.recipeIndex === null || item?.recipeIndex === undefined ? [] : [item.recipeIndex]
  )))
  for (let slot = 0; slot < slots.length; slot += 1) {
    const item = slots[slot]
    if (!item) continue
    const start = slot * 15
    const identity = item.recipeIndex === null
      ? `${item.nativeTypeId}:${item.name}`
      : `${item.nativeTypeId}:${item.recipeIndex}`
    const [hashA, hashB] = identityHashes(identity)
    const effects = item.nativeEffects ?? nativeEquipmentRecipeEffects(item.recipeIndex ?? -1)
    const resolution = resolveNativeEquipmentEffects(permanentRanks, [{
      effects,
      recipeIndex: null,
    }])
    const tooltipSet = item.recipeIndex === null
      ? null
      : nativeEquipmentTooltipSetForRecipe(item.recipeIndex)
    const setComplete = tooltipSet !== null
      && tooltipSet.memberRecipeIndices.every((recipeIndex) => equippedRecipeIndexes.has(recipeIndex))
    const familyTotals = equipmentFamilyTotals(resolution.modifiers)
    const targeted = effects.find(({ target }) => target !== 0)
    block[start] = 1
    block[start + 1] = Number(item.recipeIndex !== null)
    block[start + 2] = hashA
    block[start + 3] = hashB
    block[start + 4] = item.rarity === 'Epic' ? 1 : item.rarity === 'Rare' ? 0.5 : 0
    block[start + 5] = scaledUnsigned(item.generatedLevel ?? 0, ML_BOT_POLICY_SCALES.level)
    block[start + 6] = Number(setComplete)
    block[start + 7] = scaledSigned(familyTotals.offense, ML_BOT_POLICY_SCALES.equipmentEffect)
    block[start + 8] = scaledSigned(familyTotals.resource, ML_BOT_POLICY_SCALES.equipmentEffect)
    block[start + 9] = scaledSigned(familyTotals.mobility, ML_BOT_POLICY_SCALES.equipmentEffect)
    block[start + 10] = scaledSigned(familyTotals.defense, ML_BOT_POLICY_SCALES.equipmentEffect)
    block[start + 11] = Number(targeted !== undefined)
    block[start + 12] = targeted
      ? scaledUnsigned(targeted.target, ML_BOT_POLICY_SCALES.equipmentTargetKind)
      : 0
    block[start + 13] = targeted
      ? scaledSigned(targeted.magnitude, ML_BOT_POLICY_SCALES.equipmentEffect)
      : 0
    block[start + 14] = Number(resolution.modifiers.featureBits !== 0)
  }
  return block
}

function potionLegal(
  state: GameSimulationState,
  progression: ReturnType<typeof getPlayerProgression>,
  item: HubInventoryItem,
  options: MlBotPolicyInventoryOptions,
): boolean {
  if (
    item.quantity <= 0
    || item.nativeTypeId !== 7001
    || item.nativeSubtype === null
    || !playerCanAcceptInput(progression)
    || state.levelUpBarrier !== null
  ) return false
  if (item.kind === 'mod-potion') {
    return item.modContent !== undefined
      && options.hasConsumable?.(item.modContent.contentId) === true
  }
  switch (item.nativeSubtype) {
    case 0: return progression.currentHealth < progression.maximumHealth
    case 1: return progression.currentMana < progression.maximumMana
    case 2: return progression.damageX4TicksRemaining < NATIVE_DAMAGE_X4_POTION_TICKS
    case 3: return progression.poisonTicksRemaining > 0
      || progression.poisonImmunityTicksRemaining < NATIVE_ANTIDOTE_IMMUNITY_TICKS
    case 4: return progression.mindChugTicksRemaining < NATIVE_MIND_CHUG_TICKS
    case 5: return progression.currentHealth < progression.maximumHealth
      || progression.currentMana < progression.maximumMana
    default: return false
  }
}

function equipmentFamilyTotals(modifiers: NativeEquipmentModifiers): Record<
  'defense' | 'mobility' | 'offense' | 'resource', number
> {
  const totals = { defense: 0, mobility: 0, offense: 0, resource: 0 }
  for (const [key, family] of Object.entries(ML_BOT_POLICY_EQUIPMENT_MODIFIER_FAMILIES)) {
    if (family === 'feature') continue
    totals[family] += modifierContribution(
      key,
      modifiers[key as keyof NativeEquipmentModifiers],
    )
  }
  return totals
}

function modifierContribution(key: string, value: unknown): number {
  if (typeof value === 'number') return multiplierField(key) ? value - 1 : value
  if (Array.isArray(value)) return value.reduce<number>(
    (sum, entry) => sum + modifierContribution(key, entry),
    0,
  )
  if (value !== null && typeof value === 'object') {
    const transform = value as { offset?: unknown; scale?: unknown }
    return (typeof transform.offset === 'number' ? transform.offset : 0)
      + (typeof transform.scale === 'number' ? transform.scale - 1 : 0)
  }
  return 0
}

function multiplierField(key: string): boolean {
  return key.endsWith('Multiplier') || key === 'goldMultiplier'
    || key === 'orbPullMultiplier' || key === 'weldEffect'
}

function identityHashes(value: string): readonly [number, number] {
  if (value.length === 0) return [0, 0]
  let first = 216_613
  let second = 104_729
  const bytes = new TextEncoder().encode(value)
  for (let index = 0; index < bytes.length; index += 1) {
    const byte = bytes[index]!
    const ordinal = index + 1
    first = (first * 167 + byte + ordinal) % 1_000_003
    second = (second * 257 + byte * 3 + ordinal) % 1_000_033
  }
  return [first / 1_000_003, second / 1_000_033]
}

function countScaled(value: number): number {
  return Math.log1p(Math.min(Math.max(0, value), ML_BOT_POLICY_SCALES.inventoryCountSaturation))
    / Math.log(ML_BOT_POLICY_SCALES.inventoryCountSaturation + 1)
}

function durationScaled(ticks: number): number {
  return scaledUnsigned(
    ticks / ML_BOT_POLICY_SCALES.tickRate,
    ML_BOT_POLICY_SCALES.statusDurationSeconds,
  )
}

function scaledSigned(value: number, scale: number): number {
  return Math.max(-1, Math.min(1, value / scale))
}

function scaledUnsigned(value: number, scale: number): number {
  return Math.max(0, Math.min(1, value / scale))
}
