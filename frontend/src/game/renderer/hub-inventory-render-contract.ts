import {
  PLAYER_COMBAT_TICKS_PER_SECOND,
  PLAYER_MANA_RECOVERY_PER_TICK,
} from '../core-kernels/player-combat.ts'
import {
  NATIVE_SKILL_CATALOG,
  playerStatBook,
} from '../core-kernels/player-progression.ts'
import type { EquipmentSlot, HubInventoryItem } from '../core-kernels/hub-economy.ts'
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
  itemInfoOffset: 40,
  itemInfoPadding: 20,
  itemInfoViewportMargin: 25,
  selectionTint: 0x00c020,
} as const

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
  'inventory-dragger',
  'inventory-required-clothing-message',
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
