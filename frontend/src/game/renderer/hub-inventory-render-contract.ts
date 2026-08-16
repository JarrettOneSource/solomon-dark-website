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
export const HUB_NATIVE_LOGICAL_SIZE = { height: 720, width: 1280 } as const
export const HUB_NATIVE_UI_SCALE = 1.25

export const HUB_INVENTORY_GRID = {
  capacity: 88,
  cellSize: 67.5,
  columns: 22,
  left: 27.5,
  pitch: 75,
  rows: 4,
  top: 497.5,
} as const

export const HUB_SHOP_GRID = {
  columns: 4,
  pageSize: 8,
  retainedCapacity: 28,
  rows: 2,
} as const

export const HUB_DOWSING_GRID = {
  columns: 3,
  pageSize: 9,
  retainedCapacity: 9,
  rows: 3,
} as const

export const HUB_SHOP_PANEL = {
  height: 500,
  settledLeft: 422.5,
  settledTop: -25,
  slideDistance: 125,
  width: 755,
} as const

export const HUB_NATIVE_UI_TIMING = {
  inventoryRevealPerTick: 0.025,
  messageBoxCurtainAlpha: 0.75,
  messageBoxRevealPerTick: 0.035,
} as const

export const HUB_DOWSING_FLASH = {
  decrementPerTick: 0.05,
  durationMs: 200,
  durationTicks: 20,
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
