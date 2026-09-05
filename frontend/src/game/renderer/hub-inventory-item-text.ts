import { NATIVE_SKILL_CATALOG } from '../core-kernels/player-progression.ts'
import {
  DOWSING_EQUIPMENT_RECIPES,
  HAGATHA_PERKS,
  nativeEquipmentMeetsLevelRequirement,
  nativeEquipmentRequiredLevel,
  type HubInventoryItem,
  type NativeEquipmentEffect,
} from '../core-kernels/hub-economy.ts'
import {
  nativeEquipmentRecipeDescription,
  nativeEquipmentRecipeEffects,
  nativeEquipmentTooltipSetForRecipe,
} from '../core-kernels/native-equipment-effects.ts'
import {
  NATIVE_TUTORIAL_AMULET_DESCRIPTION,
  nativeTutorialAmuletIdentityMatches,
} from '../core-kernels/native-tutorial.ts'

export const HAGATHA_NATIVE_TOOLTIP_LINES: readonly (readonly string[])[] = [
  ['Maximum life is always increased by 25%.'],
  ['Maximum mana is always increased by 25%.'],
  ['Walking and casting speed is increased by 10%.'],
  ['Odds of finding useful items to equip is increased.'],
  ['Odds of finding gold is increased.', 'Quantity of gold found is increased.'],
  ['Lines of force indicate the locations of gold, items, and magic upgrades.'],
  ['New skills automatically become level 2 when you learn them.'],
  ['Survive one killing blow by recovering half of your health.'],
  ['Offers more skill choices when you level up, and decreases level requirements of all skills and items by two.'],
  ['Killed monsters scatter more and larger orbs'],
  ['All offensive spells cost 25% less to cast.'],
  ['Poison damage reduced by 50%.'],
  ['Explode on death, dealing massive damage to everything near and far.  Luthacus will scavenge any treasures dropped during the final conflagration.'],
  ['Welded spells recombine any time the compenent spells are improved.'],
  ['Grants a new secondary attack and biases skill choices toward secondary skills.'],
  ['Drink potions automatically when needed.'],
  ['Do double damage.  Take double damage.'],
  ['Allows the wizard to re-roll skills once at level-up, or save the skill point to spend on the next level.'],
  ['All spell cooldowns reduced by 25%.'],
  ['Tweaks your aura so that you can effectively use three rings.'],
  ['Improve damage and lower mana cost by 15% when casting bare-handed.'],
  ['Concentrate on two skills at once.'],
  ['Bosses take triple damage.'],
  ['Odds of finding magical upgrades is greatly increased.'],
  ['Until you are hurt, all spells do three times as much damage.'],
  ['Until you are hurt, all spells cost no mana.'],
  ["Increases wizard's physical strength.", 'Melee damage increased 200%, pushing power increased 100%.'],
  ['Loosens your mind enough to hold more charms or curses.  Limit two per customer.'],
] as const

export type HubTooltipFont = 'body' | 'menu'

export interface HubTooltipLine {
  readonly font: HubTooltipFont
  readonly text: string
  readonly tint: number
}

export interface HubTooltipOptions {
  readonly creativityRank?: number
  readonly ownedRecipeIndexes?: readonly number[]
  readonly playerLevel?: number
  readonly price?: number | null
}

export interface HagathaTooltipOptions {
  readonly bundleSelectors?: readonly number[]
  readonly cheatDeathCharges: number | null
  readonly firstMixed: boolean
  readonly price: number | null
  readonly selector: number
}

export interface HubInventoryItemInfoText {
  readonly description: string | null
  readonly instruction: string | null
  readonly title: string
}

export function hubInventoryItemInfoText(item: HubInventoryItem): HubInventoryItemInfoText {
  switch (item.kind) {
    case 'health-potion': return potionInfo(item, 'Restores your health to maximum')
    case 'mana-potion': return potionInfo(item, 'Restores your mana to maximum')
    case 'wizard-chug': return potionInfo(item, 'Quadruples the damage of all attacks for 60 seconds')
    case 'antidote': return potionInfo(item, 'Cures poisoning and grants immunity to poison for 10 seconds')
    case 'mind-chug': return potionInfo(item, 'Grants concentration of all skills (at once) for 60 seconds')
    case 'mod-potion': {
      if (!item.modContent) throw new Error('mod potion is missing its content identity')
      return potionInfo(item, item.modContent.description)
    }
    case 'mod-item': {
      if (!item.modItemContent) throw new Error('mod item has no content')
      return {
        description: item.modItemContent.description,
        instruction: null,
        title: item.name,
      }
    }
    case 'rejuvenation-potion': return potionInfo(item, 'Restores your health and mana to maximum')
    case 'dye': return {
      description: 'Double click to dye an article of clothing',
      instruction: null,
      title: 'Fabric Dye Kit',
    }
    case 'key': return {
      description: 'Bursts non-magical locks',
      instruction: null,
      title: 'Wizard Key',
    }
    case 'sack': {
      const count = item.contents?.length ?? 0
      return {
        description: count === 0
          ? 'Currently empty'
          : count === 1
            ? 'Contains 1 item'
            : `Contains ${count} items`,
        instruction: null,
        title: item.name,
      }
    }
    case 'skill-book': return {
      description: item.nativeSubtype === 2
        ? 'Double click to learn a new skill'
        : 'Double click to improve a learned skill',
      instruction: null,
      title: item.name,
    }
    case 'equipment': return {
      description: item.modAffixes?.map(affix => affix.name).join(' · ') ?? null,
      instruction: null,
      title: item.name,
    }
  }
}

function potionInfo(item: HubInventoryItem, description: string): HubInventoryItemInfoText {
  return { description, instruction: 'Double-click to drink', title: item.name }
}

const HUB_TOOLTIP_TINT = {
  body: 0xbfbfbf,
  completeSet: 0x80ff80,
  epic: 0xffbf80,
  gold: 0xd9ba70,
  rare: 0xffff80,
  warning: 0xff8080,
  white: 0xffffff,
} as const

export function hubHagathaTooltipLines(
  options: HagathaTooltipOptions,
): readonly HubTooltipLine[] {
  const { selector } = options
  if (!Number.isInteger(selector) || selector < -1 || selector >= HAGATHA_PERKS.length) {
    throw new RangeError('native Hagatha tooltip selector must be within [-1, 27]')
  }
  if (options.price !== null && (!Number.isSafeInteger(options.price) || options.price < 0)) {
    throw new RangeError('native Hagatha tooltip price must be a nonnegative safe integer')
  }
  if (options.cheatDeathCharges !== null && (
    !Number.isSafeInteger(options.cheatDeathCharges) || options.cheatDeathCharges < 0
  )) {
    throw new RangeError('native Cheat Death charges must be a nonnegative safe integer')
  }

  const lines: HubTooltipLine[] = []
  if (selector === -1) {
    lines.push(tooltipTitle('BARGAIN BUNDLE'))
    lines.push(tooltipBody('Get everything the last wizard got.'))
    for (const member of options.bundleSelectors ?? []) {
      const perk = HAGATHA_PERKS[member]
      if (!perk) throw new RangeError(`unknown Hagatha bundle selector ${member}`)
      lines.push(tooltipBody(`        ${perk.name}`))
    }
  } else {
    lines.push(tooltipTitle(HAGATHA_PERKS[selector]!.name))
    lines.push(...HAGATHA_NATIVE_TOOLTIP_LINES[selector]!.map(tooltipBody))
    if (selector === 7 && options.cheatDeathCharges !== null) {
      lines.push(tooltipBody(options.cheatDeathCharges > 0
        ? `   Cheats remaining: ${options.cheatDeathCharges}`
        : '   Used up!'))
    }
  }

  if (options.price !== null) {
    lines.push(tooltipBody(''))
    lines.push(tooltipGold(`    Price: ${options.price}`))
    if (selector === -1) lines.push(tooltipGold('    Bulk discount: 50%'))
    else if (!options.firstMixed) {
      lines.push(tooltipGold('    High price due to first mixing.'))
    }
  }
  return Object.freeze(lines)
}

export function hubItemTooltipLines(
  item: HubInventoryItem,
  options: HubTooltipOptions = {},
): readonly HubTooltipLine[] {
  const info = hubInventoryItemInfoText(item)
  const recipeIndex = item.recipeIndex
  const set = recipeIndex === null ? null : nativeEquipmentTooltipSetForRecipe(recipeIndex)
  const ownedRecipeIndexes = new Set(options.ownedRecipeIndexes ?? [])
  const completeSet = set !== null && set.memberRecipeIndices.every(
    (member) => ownedRecipeIndexes.has(member),
  )
  const titleTint = completeSet
    ? HUB_TOOLTIP_TINT.completeSet
    : item.rarity === 'Epic'
      ? HUB_TOOLTIP_TINT.epic
      : item.rarity === 'Rare'
        ? HUB_TOOLTIP_TINT.rare
        : HUB_TOOLTIP_TINT.white
  const lines: HubTooltipLine[] = [{ font: 'menu', text: info.title, tint: titleTint }]

  if (item.kind !== 'equipment') {
    if (info.description) lines.push(tooltipBody(info.description))
    if (info.instruction) lines.push(tooltipBody(info.instruction))
    appendTooltipPrice(lines, options.price ?? null)
    return Object.freeze(lines)
  }

  const description = item.modItemContent?.description ?? (recipeIndex === null
    ? nativeTutorialAmuletIdentityMatches(item)
      ? NATIVE_TUTORIAL_AMULET_DESCRIPTION
      : ''
    : nativeEquipmentRecipeDescription(recipeIndex))
  if (description) lines.push(tooltipBody(description))
  const affixNames = item.modAffixes?.map(affix => affix.name).join(' · ')
  if (affixNames) lines.push(tooltipBody(affixNames))
  const requiredLevel = nativeEquipmentRequiredLevel(item)
  if (
    options.playerLevel !== undefined
    && !nativeEquipmentMeetsLevelRequirement(item, {
      creativityRank: options.creativityRank ?? 0,
      playerLevel: options.playerLevel,
    })
  ) {
    lines.push({
      font: 'body',
      text: `Requires Player Level ${requiredLevel}`,
      tint: HUB_TOOLTIP_TINT.warning,
    })
  }

  const effects = item.nativeEffects
    ?? (recipeIndex === null ? [] : nativeEquipmentRecipeEffects(recipeIndex))
  lines.push(...effects.map((effect) => tooltipBody(hubNativeEquipmentEffectText(effect))))

  if (set) {
    lines.push(tooltipBody(''))
    lines.push(tooltipGold('Item Set:'))
    lines.push({ font: 'body', text: set.name, tint: HUB_TOOLTIP_TINT.completeSet })
    for (const memberRecipeIndex of set.memberRecipeIndices) {
      const member = DOWSING_EQUIPMENT_RECIPES[memberRecipeIndex]
      if (!member) throw new RangeError(`unknown native set member recipe ${memberRecipeIndex}`)
      lines.push({
        font: 'body',
        text: `  ${member.name}`,
        tint: ownedRecipeIndexes.has(memberRecipeIndex)
          ? HUB_TOOLTIP_TINT.completeSet
          : HUB_TOOLTIP_TINT.body,
      })
    }
    lines.push(tooltipBody(''))
    lines.push(tooltipGold('Complete Set Bonus:'))
    lines.push(...set.effects.map((effect) => tooltipBody(hubNativeEquipmentEffectText(effect))))
  }

  appendTooltipPrice(lines, options.price ?? null)
  return Object.freeze(lines)
}

export function hubNativeEquipmentEffectText(effect: NativeEquipmentEffect): string {
  if (!Number.isInteger(effect.kind) || effect.kind < 1 || effect.kind > 39) {
    throw new RangeError(`unknown native equipment effect kind ${effect.kind}`)
  }
  if (!Number.isFinite(effect.magnitude)) {
    throw new RangeError('native equipment effect magnitude must be finite')
  }
  if (effect.operator !== 0 && effect.operator !== 1 && effect.operator !== 2) {
    throw new RangeError(`unknown native equipment effect operator ${effect.operator}`)
  }

  const roundedMagnitude = Math.round(effect.magnitude)
  switch (effect.kind) {
    case 4: {
      if (effect.target === 0) return 'Grant Skill'
      const skill = nativeTooltipSkillName(effect.target)
      return effect.magnitude <= 1
        ? `Grant ${skill}`
        : `Grant level ${roundedMagnitude} ${skill}`
    }
    case 5:
      return effect.target === 0
        ? 'Boost Skill'
        : `Boost ${nativeTooltipSkillName(effect.target)} + ${roundedMagnitude}`
    case 6:
      return `Boost ${nativeTooltipClassName(effect.target)} + ${roundedMagnitude}`
    case 7:
      return effect.target === 0
        ? 'Add Skill'
        : `${nativeTooltipSkillName(effect.target)} + ${roundedMagnitude}`
    case 8: return `All Skills + ${roundedMagnitude}`
    case 14: return effect.magnitude < 0
      ? `Find ${Math.abs(roundedMagnitude)}% less gold`
      : `Find ${roundedMagnitude}% more gold`
    case 15: return effect.operator === 1
      ? `Pull orbs from ${effect.magnitude.toFixed(1)}x further away`
      : `Pull orbs from ${roundedMagnitude}% further away`
    case 18: return `Resist Pain +${roundedMagnitude}%`
    case 19: return `Resist Magic +${roundedMagnitude}%`
    case 20: return `Resist Poison +${roundedMagnitude}%`
    case 25: return `${nativeTooltipSkillName(effect.target)} Damage ${nativeEffectValue(effect)}`
    case 26: return 'Always summon max Leviathan tentacles'
    case 27: return 'Double the duration of magic storms'
    case 28: return 'Ring of fire explodes enemies'
    case 29: return 'Allows control of two golems'
    case 30: return 'Ring of Ice does frostburn damage'
    case 31: return 'Doubles the lifetime of imps'
    case 32: return 'Increases the disintegration threshold to 30%'
    case 33: return 'Doubles the rate of Ether Charge accumulation'
    case 34: return 'Harden shell retaliates with projectiles when struck'
    case 35: return 'Rock Surge causes a strong knockback when invoked'
    case 36: return 'Emits a mindblast on levelup'
    case 37: return 'Weld +unlearned components'
    case 38: return `Enhance weld effects ${nativeEffectValue(effect)}`
    case 39: return '+Bias for welding skill picks'
    default: return `${nativeEffectLabel(effect)} ${nativeEffectValue(effect)}`
  }
}

function nativeEffectLabel(effect: NativeEquipmentEffect): string {
  switch (effect.kind) {
    case 1: return 'Spell Damage'
    case 2: return `${nativeTooltipClassName(effect.target)} Damage`
    case 3: return 'Melee Damage'
    case 9: return 'Mana Recovery'
    case 10: return 'Mana Cost'
    case 11: return `${nativeTooltipClassName(effect.target)} Mana Cost`
    case 12: return 'Cast Speed'
    case 13: return `${nativeTooltipClassName(effect.target)} Cast Speed`
    case 16: return 'Health Recovery'
    case 17: return 'Walk Speed'
    case 21: return 'Spell Recharge'
    case 22: return `${nativeTooltipClassName(effect.target)} Spell Recharge`
    case 23: return 'Max Health'
    case 24: return 'Max Mana'
    default: throw new RangeError(`native equipment effect kind ${effect.kind} has no scalar label`)
  }
}

function nativeEffectValue(effect: NativeEquipmentEffect): string {
  if (effect.operator === 1) return `x${effect.magnitude.toFixed(1)}`
  if (effect.operator === 2) return effect.magnitude <= 0
    ? `-${Math.abs(effect.magnitude).toFixed(0)}%`
    : `+${effect.magnitude.toFixed(1)}%`
  return effect.magnitude <= 0
    ? `-${Math.abs(effect.magnitude).toFixed(1)}`
    : `+${effect.magnitude.toFixed(1)}`
}

function nativeTooltipSkillName(skillId: number): string {
  const skill = NATIVE_SKILL_CATALOG.find(({ id }) => id === skillId)
  if (!skill) throw new RangeError(`unknown native tooltip skill ${skillId}`)
  return skill.name
}

function nativeTooltipClassName(classId: number): string {
  const names = ['Ether', 'Fire', 'Air', 'Water', 'Earth', 'Body', 'Mind', 'Arcane'] as const
  const name = names[classId]
  if (!name) throw new RangeError(`unknown native tooltip skill class ${classId}`)
  return name
}

function appendTooltipPrice(lines: HubTooltipLine[], price: number | null): void {
  if (price === null) return
  if (!Number.isSafeInteger(price) || price < 0) {
    throw new RangeError('native tooltip price must be a nonnegative safe integer')
  }
  lines.push(tooltipBody(''))
  lines.push(tooltipGold(`    Price: ${price}`))
}

function tooltipTitle(text: string): HubTooltipLine {
  return { font: 'menu', text, tint: HUB_TOOLTIP_TINT.white }
}

function tooltipBody(text: string): HubTooltipLine {
  return { font: 'body', text, tint: HUB_TOOLTIP_TINT.body }
}

function tooltipGold(text: string): HubTooltipLine {
  return { font: 'body', text, tint: HUB_TOOLTIP_TINT.gold }
}

