import {
  PLAYER_COMBAT_TICKS_PER_SECOND,
  PLAYER_MANA_RECOVERY_PER_TICK,
} from '../core-kernels/player-combat.ts'
import {
  NATIVE_SKILL_CATALOG,
  playerStatBook,
} from '../core-kernels/player-progression.ts'
import {
  DOWSING_EQUIPMENT_RECIPES,
  HAGATHA_PERKS,
  type EquipmentSlot,
  type HubInventoryItem,
  type NativeEquipmentEffect,
} from '../core-kernels/hub-economy.ts'
import {
  nativeEquipmentRecipeEffects,
  nativeEquipmentTooltipSetForRecipe,
} from '../core-kernels/native-equipment-effects.ts'
import type { WizardElement } from '../core-kernels/player-character.ts'

export const HUB_NATIVE_UI_SIZE = { height: 900, width: 1600 } as const

export const HUB_INVENTORY_GRID = {
  capacity: 88,
  cellSize: 72,
  columns: 22,
  left: 24,
  pitch: 75,
  rows: 4,
  slotAlpha: 0.4,
  top: 496,
} as const

export const HUB_INVENTORY_INTERACTION = {
  doubleActivationMs: 500,
  doubleActivationTicks: 50,
  dragThresholdPixels: 10,
  itemInfoDelayMs: 200,
  itemInfoDelayTicks: 20,
  selectionTint: 0x00c020,
} as const

export const HUB_HOVER_BOX = {
  contentMargin: 25,
  contentMaxWidth: 300,
  lineGap: 10,
  ownedPerkDelayTicks: 0,
  ownedPerkSourceExclusionSize: 60,
  ownedPerkSourceGap: 25,
  shopDelayTicks: 0,
  shopSourceExclusionSize: 70,
  shopSourceGap: 35,
  viewportMargin: 25,
} as const

export const HUB_UNFORGE_TARGET = {
  center: [1562, 868] as const,
  rect: [1500, 800, 100, 100] as const,
  redAmplitude: 0.2,
  redBase: 0.6,
  periodTicks: 360,
} as const

export const HUB_UNFORGE_CONFIRMATION = {
  bodyLeft: 614,
  bodyMaxWidth: 376,
  bodyTextBaselineY: 511,
  innerPanelRect: [544.5, 387.5, 514, 326] as const,
  primaryButtonRect: [589, 567, 209, 85] as const,
  secondaryButtonRect: [805, 567, 209, 85] as const,
  titleTextBaselineY: 478,
} as const

export const HUB_UNFORGE_RESULT = {
  bodyLeft: 677,
  bodyLeftOffset: 70.5,
  centerX: 801.5,
  horizontalChrome: 141,
  innerPanelRect: [606.5, 396.5, 390, 308] as const,
  outcomeTextBaselineY: 537,
  primaryButtonRect: [697, 558, 209, 85] as const,
  summaryTextBaselineY: 520,
  titleTextBaselineY: 485,
} as const

export function hubUnforgeResultLayout(maxLineWidth: number): {
  readonly bodyLeft: number
  readonly innerPanelRect: readonly [number, number, number, number]
  readonly primaryButtonRect: typeof HUB_UNFORGE_RESULT.primaryButtonRect
} {
  if (!Number.isFinite(maxLineWidth) || maxLineWidth < 0) {
    throw new RangeError('unforge result line width must be finite and nonnegative')
  }
  const width = maxLineWidth + HUB_UNFORGE_RESULT.horizontalChrome
  const left = HUB_UNFORGE_RESULT.centerX - width / 2
  return {
    bodyLeft: left + HUB_UNFORGE_RESULT.bodyLeftOffset,
    innerPanelRect: [
      left,
      HUB_UNFORGE_RESULT.innerPanelRect[1],
      width,
      HUB_UNFORGE_RESULT.innerPanelRect[3],
    ],
    primaryButtonRect: HUB_UNFORGE_RESULT.primaryButtonRect,
  }
}

export function hubUnforgeTargetTint(nativeTick: number): number {
  const red = Math.round((
    Math.sin(nativeTick * Math.PI / 180) * HUB_UNFORGE_TARGET.redAmplitude
    + HUB_UNFORGE_TARGET.redBase
  ) * 255)
  return (red << 16) | 0x00ffff
}

export const HUB_STARTER_EQUIPMENT_PRIMARY_TINT: Readonly<Record<WizardElement, number>> = {
  air: 0xa0c3c3,
  earth: 0x90b390,
  ether: 0x886688,
  fire: 0x998077,
  water: 0x5e6e81,
}

export const HUB_ITEM_ICON_TRANSFORMS = {
  amulet: { rotationDegrees: 0, translation: [0, -5] },
  hat: { rotationDegrees: 0, translation: [0, 0] },
  ring: { rotationDegrees: 0, translation: [0, 0] },
  robe: { rotationDegrees: 0, translation: [0, 0] },
  staff: { rotationDegrees: 35, translation: [-22.94306, 32.76608] },
  wand: { rotationDegrees: 45, translation: [0, 0] },
} as const

export const HUB_EQUIPMENT_SINK_RENDER = {
  interiorTint: 0x191916,
  normalFrameRecord: 10,
  smallFrameRecord: 9,
  tallPrimitiveOutline: true,
} as const

export const HUB_PRIMARY_SPELL_PANE = {
  bodyRect: [86, 230, 227, 79] as const,
  companionShift: 53,
  contentAdvanceScale: 0.9,
  contentFont: 'medium',
  contentTextBaselines: [251, 273, 286, 299] as const,
  headingRect: [86, 207, 227, 24] as const,
  headingFont: 'body',
  headingTextBaselineY: 226,
  inlineUnit: {
    italic: true,
    offset: [0, 1] as const,
    scale: 0.7,
  },
  textLeft: 95,
  textTint: 0xc8f3f3,
} as const

export const HUB_SHOP_GRID = {
  cellSize: 72,
  columns: 7,
  left: 539,
  pitchX: 75,
  pitchY: 75,
  retainedCapacity: 28,
  rows: 4,
  slotAlpha: 0.6,
  top: 56.5,
} as const

export const HUB_DOWSING_GRID = {
  cellSize: 72,
  columns: 3,
  left: 689,
  pitchX: 75,
  pitchY: 75,
  retainedCapacity: 9,
  rows: 3,
  slotAlpha: 0.6,
  top: 94,
} as const

export const HUB_SHOP_PANEL = {
  backgroundBlendModes: ['normal', 'add'] as const,
  backgroundTileExtent: [264, 264] as const,
  backgroundHeight: 400,
  backgroundRepeat: [4, 2] as const,
  doneInnerTint: 0xbfffbf,
  doneMiddleAlpha: 0.85,
  doneRect: [714.5, 358, 171, 58] as const,
  height: 430,
  settledLeft: 498,
  settledTop: -20,
  slideDistance: 100,
  width: 604,
} as const

export const HUB_CHAT_PANEL = {
  actionTextTint: 0x8cbf8c,
  contentHeight: 250,
  contentLeft: 561.5,
  contentTop: 111,
  contentWidth: 477,
  doneRect: [730, 370, 140, 45] as const,
  doneTextBaselineY: 396,
  edgeUvOrigin: 0.95,
  height: 420,
  left: 476.5,
  primaryChoiceRect: [590, 195, 420, 43] as const,
  primaryChoiceTextBaselineY: 226,
  secondaryChoiceRect: [690, 235, 220, 32] as const,
  secondaryChoiceTextBaselineY: 256,
  top: 26,
  titleCenterX: 800,
  titleCenterY: 90,
  titleTextBaselineY: 90,
  textTint: 0xd9ba70,
  uiRecord: 11,
  width: 647,
} as const

export const HUB_CHAT_INLINE_EMPHASIS = {
  exactTextCommand: 'i',
  exactTextMarker: '_',
  fontLineHeight: 24,
  glyphBottomDelta: -3,
  glyphTopDelta: 3,
  italicFactor: 0.125,
  sourceDelimiter: '*',
} as const

export interface HubChatTextRun {
  readonly italic: boolean
  readonly text: string
}

export function hubChatTextRuns(source: string): readonly HubChatTextRun[] {
  const runs: HubChatTextRun[] = []
  let italic = false
  let text = ''
  const flush = (): void => {
    if (!text) return
    runs.push({ italic, text })
    text = ''
  }
  for (const character of source) {
    if (character === HUB_CHAT_INLINE_EMPHASIS.sourceDelimiter) {
      flush()
      italic = !italic
    } else {
      text += character
    }
  }
  flush()
  return runs
}

export const HUB_SHOP_TEXT = {
  affordableTint: 0xd9ba70,
  goldTint: 0xd9ba70,
  normalBackgroundTint: 0xd9ffd9,
  priceFont: 'body',
  priceTextBaselineOffsetY: 67,
  priceTextRightOffsetX: 67,
  doneTextBaselineY: 392,
  titleTextBaselineY: 32,
  unaffordableTint: 0xff8080,
} as const

export const HUB_HAGATHA_PERK_PANE = {
  bundleCenter: [253, 288] as const,
  columns: 3,
  emptySlotTint: 0x808080,
  innerHeight: 238,
  innerPanelTint: 0x191916,
  innerWidth: 227,
  left: 139,
  rows: 3,
  slotCenterOrigin: [193, 198] as const,
  slotPitch: 60,
  slotScale: 0.8,
  titleTint: 0xd9ba70,
  titleCenterX: 253,
  titleTextBaselineY: 152.5,
  top: 129,
} as const

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
  readonly ownedPerkSelectors?: readonly number[]
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

export const HUB_DOWSING_PREROLL = {
  buttonCenter: [800, 300] as const,
  buttonRect: [623.5, 265.5, 353, 69] as const,
  buttonSideCenters: [[704, 302], [896, 302]] as const,
  feeTextBaselineY: 322.5,
  labelTextBaselineY: 302,
  mirrorPromptRect: [693, 54.5, 214, 41] as const,
  referenceDropRect: [750, 101, 100, 149] as const,
} as const

export const HUB_DOWSING_MSGBOX = {
  arrowCentersAndScales: [[800, 592, 1], [725, 579, 0.75], [875, 579, 0.75]] as const,
  bodyLeft: 609,
  bodyMaxWidth: 382,
  bodyTextBaselineY: 287.5,
  horizontalEdgeRecord: 10,
  interiorBackgroundRecord: 49,
  interiorClipRect: [535.5, 158, 529, 384] as const,
  interiorFill: 'tiled-clipped',
  innerPanelEdgeUvOrigin: 0.95,
  innerPanelRecord: 17,
  innerPanelRect: [540.5, 163, 519, 374] as const,
  innerCornerCenters: [[580.5, 204.5], [1019.5, 204.5], [580.5, 495.5], [1019.5, 495.5]] as const,
  outerCornerCenters: [[564.5, 190], [1035.5, 190], [564.5, 510], [1035.5, 510]] as const,
  primaryButtonCenter: [800, 432] as const,
  primaryButtonRect: [623.5, 397.5, 353, 69] as const,
  primaryButtonSideCenters: [[731, 434], [869, 434]] as const,
  primaryButtonTextBaselineY: 440,
  primaryButtonTextTint: 0xd9ba70,
  skullHeaderCenter: [800, 121] as const,
  titleTextBaselineY: 252,
  verticalEdgeRecord: 79,
} as const

export const HUB_NATIVE_UI_TIMING = {
  chatAcceleratedScrollPerTick: 0.8,
  chatRevealPerTick: 0.05,
  chatScrollPerTick: 0.125,
  inventoryRevealPerTick: 0.025,
  messageBoxCurtainAlpha: 0.75,
  messageBoxRevealPerTick: 0.035,
} as const

export const HUB_DOWSING_FLASH = {
  decrementPerTick: 0.05,
  durationMs: 200,
  durationTicks: 20,
} as const

export const HUB_DOWSING_FIELD = {
  greenAmplitude: 0.1,
  greenBase: 0.7,
  phaseDegreesPerTick: 0.5,
  periodTicks: 720,
} as const

export const HUB_DOWSING_INSUFFICIENT_GOLD = {
  actionLabel: 'OKAY',
  body: 'Peering into the mirror at the endless, swirling, impossible colors of the ether is debilitating.  It is unthinkable that anyone would do so without just compensation, plus a little extra.',
  title: 'NOT ENOUGH GOLD!',
} as const

export const HUB_HAT_REMOVAL_MSGBOX = {
  actionLabel: 'OKAY',
  body: "A wizard might switch hats.  A wizard might even wear his hat at a jaunty angle.  But a wizard would never, under any circumstances, remove his hat altogether.\n\nAfter all, if you're not wearing a wizard hat, how would people know to be awed by the presence of a wizard?",
  title: 'A WIZARD WOULD NEVER REMOVE HIS HAT!',
} as const

export const HUB_ROBE_REMOVAL_MSGBOX = {
  actionLabel: 'OKAY',
  body: "A long, intimidating flowing robe looks debonaire on both a gluttonously fat slob and a pathetically wasted weakling.\n\nStrip away the robe and people might make comments about the kind of physique you get from years in wizarding school.  And then you'd have a completely avoidable disintegration on your conscience.",
  title: 'A WIZARD WOULD NEVER REMOVE HIS ROBE!',
} as const

export const HUB_NATIVE_UI_SURFACES = [
  'dialogue',
  'fomentius-shop',
  'hagatha-perk-shop',
  'luthacus-inventory-shop',
  'shlorio-dowsing-before-roll',
  'shlorio-dowsing-flash',
  'shlorio-dowsing-results',
  'shlorio-insufficient-gold-message',
  'inventory',
  'inventory-item-info',
  'contextual-hover-box',
  'inventory-dragger',
  'inventory-required-clothing-message',
  'inventory-unforge-confirmation',
  'inventory-unforge-result',
] as const

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
    case 'equipment': return { description: null, instruction: null, title: item.name }
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

  const recipe = recipeIndex === null ? null : DOWSING_EQUIPMENT_RECIPES[recipeIndex] ?? null
  const requiredLevel = item.generatedLevel ?? recipe?.level ?? 0
  const effectiveRequiredLevel = Math.max(
    0,
    requiredLevel - ((options.ownedPerkSelectors ?? []).includes(8) ? 2 : 0),
  )
  if (
    options.playerLevel !== undefined
    && options.playerLevel < effectiveRequiredLevel
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

export function hubOwnedPerkSlotRect(
  index: number,
): readonly [number, number, number, number] {
  const capacity = HUB_HAGATHA_PERK_PANE.columns * HUB_HAGATHA_PERK_PANE.rows
  if (!Number.isInteger(index) || index < 0 || index >= capacity) {
    throw new RangeError('native owned-perk slot index must be within [0, 8]')
  }
  const centerX = HUB_HAGATHA_PERK_PANE.slotCenterOrigin[0]
    + (index % HUB_HAGATHA_PERK_PANE.columns) * HUB_HAGATHA_PERK_PANE.slotPitch
  const centerY = HUB_HAGATHA_PERK_PANE.slotCenterOrigin[1]
    + Math.floor(index / HUB_HAGATHA_PERK_PANE.columns) * HUB_HAGATHA_PERK_PANE.slotPitch
  const half = HUB_HOVER_BOX.ownedPerkSourceExclusionSize / 2
  return [centerX - half, centerY - half, half * 2, half * 2]
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

export function hubInventorySlotPosition(index: number): { x: number; y: number } {
  if (!Number.isInteger(index) || index < 0 || index >= HUB_INVENTORY_GRID.capacity) {
    throw new RangeError('native inventory slot index must be within [0, 87]')
  }
  return {
    x: HUB_INVENTORY_GRID.left + Math.floor(index / HUB_INVENTORY_GRID.rows) * HUB_INVENTORY_GRID.pitch,
    y: HUB_INVENTORY_GRID.top + (index % HUB_INVENTORY_GRID.rows) * HUB_INVENTORY_GRID.pitch,
  }
}

export function hubInventoryEquipmentSlotRects(
  slot: EquipmentSlot,
  companion = false,
): readonly (readonly [number, number, number, number])[] {
  const shift = companion ? 0 : 53
  switch (slot) {
    case 'amulet': return [[1247 + shift, 169, 46, 46]]
    case 'hat': return [[1301 + shift, 143, 72, 72]]
    case 'weapon': return [[1221 + shift, 223, 72, 72], [1381 + shift, 223, 72, 72]]
    case 'robe': return [[1301 + shift, 223, 72, 108]]
    case 'ring-0': return [[1247 + shift, 303, 46, 46]]
    case 'ring-1': return [[1381 + shift, 303, 46, 46]]
    case 'ring-2': return [[1381 + shift, 350, 46, 46]]
  }
}

export function hubShopSlotPosition(index: number): { x: number; y: number } {
  if (!Number.isInteger(index) || index < 0 || index >= HUB_SHOP_GRID.retainedCapacity) {
    throw new RangeError('native shop slot index must be within [0, 27]')
  }
  return {
    x: HUB_SHOP_GRID.left + Math.floor(index / HUB_SHOP_GRID.rows) * HUB_SHOP_GRID.pitchX,
    y: HUB_SHOP_GRID.top + (index % HUB_SHOP_GRID.rows) * HUB_SHOP_GRID.pitchY,
  }
}

export function hubDowsingSlotPosition(index: number): { x: number; y: number } {
  if (!Number.isInteger(index) || index < 0 || index >= HUB_DOWSING_GRID.retainedCapacity) {
    throw new RangeError('native dowsing slot index must be within [0, 8]')
  }
  return {
    x: HUB_DOWSING_GRID.left + (index % HUB_DOWSING_GRID.columns) * HUB_DOWSING_GRID.pitchX,
    y: HUB_DOWSING_GRID.top + Math.floor(index / HUB_DOWSING_GRID.columns) * HUB_DOWSING_GRID.pitchY,
  }
}

export function hubDowsingFieldTint(nativeTick: number): number {
  const phaseRadians = nativeTick * HUB_DOWSING_FIELD.phaseDegreesPerTick * Math.PI / 180
  const green = Math.round((
    Math.sin(phaseRadians) * HUB_DOWSING_FIELD.greenAmplitude + HUB_DOWSING_FIELD.greenBase
  ) * 255)
  return (0xff << 16) | (green << 8) | 0xff
}

const PRIMARY_SKILL_BY_ELEMENT: Readonly<Record<WizardElement, number>> = {
  air: 24,
  earth: 40,
  ether: 8,
  fire: 16,
  water: 32,
}

export interface HubInventoryPrimarySpellLine {
  readonly text: string
  readonly unit: ' / SEC' | ' / SECOND' | null
}

export function hubInventoryPrimarySpellLines(
  element: WizardElement,
  learnedSkills: readonly (readonly [number, number, number])[],
): readonly HubInventoryPrimarySpellLine[] {
  const skillId = PRIMARY_SKILL_BY_ELEMENT[element]
  const learned = learnedSkills.find(([candidate]) => candidate === skillId)
  if (!learned) throw new RangeError(`${element} primary skill ${skillId} is not learned`)
  const rank = learned[2]
  const entry = playerStatBook().entries[skillId]
  if (!entry || rank < 1 || rank > entry.maximumLevel) {
    throw new RangeError(`${element} primary skill ${skillId} has invalid rank ${rank}`)
  }
  const damageMinimum = rankedStatValue(
    entry.numericProperties.mDamage ?? entry.numericProperties.mDamage1,
    rank,
  )
  const damageMaximum = rankedStatValue(
    entry.numericProperties.mDamage ?? entry.numericProperties.mDamage2,
    rank,
  )
  const manaCost = rankedStatValue(entry.numericProperties.mManaCost, rank)
  const damage = damageMinimum === damageMaximum
    ? nativeStatNumber(damageMinimum)
    : `${nativeStatNumber(damageMinimum)} - ${nativeStatNumber(damageMaximum)}`
  const channelled = element === 'air' || element === 'water'
  const damageLine = element === 'earth'
    ? `TOTAL DAMAGE: ${damage} X SIZE`
    : `DAMAGE: ${damage}`
  const manaHeal = PLAYER_MANA_RECOVERY_PER_TICK * PLAYER_COMBAT_TICKS_PER_SECOND
  return [
    { text: NATIVE_SKILL_CATALOG[skillId]!.name.toUpperCase(), unit: null },
    { text: damageLine, unit: channelled ? ' / SECOND' : null },
    {
      text: `MANA COST: ${nativeStatNumber(manaCost)}`,
      unit: channelled || element === 'earth' ? ' / SEC' : null,
    },
    { text: `MANA HEAL: ${nativeStatNumber(manaHeal)}`, unit: ' / SEC' },
  ]
}

function rankedStatValue(source: number | readonly number[] | undefined, rank: number): number {
  const value = typeof source === 'number' ? source : source?.[rank]
  if (value === undefined || !Number.isFinite(value)) throw new RangeError(`missing native rank ${rank} stat`)
  return value
}

function nativeStatNumber(value: number): string {
  return Number.isInteger(value) ? `${value}` : `${value}`.replace(/0+$/, '').replace(/\.$/, '')
}
