import {
  PLAYER_COMBAT_TICKS_PER_SECOND,
  PLAYER_MANA_RECOVERY_PER_TICK,
} from '../core-kernels/player-combat.ts'
import {
  NATIVE_SKILL_CATALOG,
  playerStatBook,
} from '../core-kernels/player-progression.ts'
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
  innerPanelTint: 0x1a1a17,
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
  interiorBackgroundRecord: null,
  interiorFill: null,
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
] as const

export function hubInventorySlotPosition(index: number): { x: number; y: number } {
  if (!Number.isInteger(index) || index < 0 || index >= HUB_INVENTORY_GRID.capacity) {
    throw new RangeError('native inventory slot index must be within [0, 87]')
  }
  return {
    x: HUB_INVENTORY_GRID.left + Math.floor(index / HUB_INVENTORY_GRID.rows) * HUB_INVENTORY_GRID.pitch,
    y: HUB_INVENTORY_GRID.top + (index % HUB_INVENTORY_GRID.rows) * HUB_INVENTORY_GRID.pitch,
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

export function hubInventoryPrimarySpellLines(
  element: WizardElement,
  learnedSkills: readonly (readonly [number, number, number])[],
): readonly string[] {
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
    : `DAMAGE: ${damage}${channelled ? ' / SECOND' : ''}`
  const manaLine = `MANA COST: ${nativeStatNumber(manaCost)}${channelled || element === 'earth' ? ' / SEC' : ''}`
  const manaHeal = PLAYER_MANA_RECOVERY_PER_TICK * PLAYER_COMBAT_TICKS_PER_SECOND
  return [
    NATIVE_SKILL_CATALOG[skillId]!.name.toUpperCase(),
    damageLine,
    manaLine,
    `MANA HEAL: ${nativeStatNumber(manaHeal)} / SEC`,
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
