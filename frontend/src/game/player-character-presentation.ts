import type {
  HubEquipmentState,
  HubInventoryItem,
} from './core-kernels/hub-economy.ts'
import type {
  PlayerCharacterState,
  WizardElement,
} from './core-kernels/player-character.ts'
import type { Vector2 } from './core-kernels/vector.ts'
import {
  primaryCastPose,
  primarySpellEmitterOffset,
} from './core-kernels/primary-spells.ts'

const STAFF_FRONT: readonly boolean[] = [
  false, false, false, false, false, true,
  true, true, true, true, true, true,
  true, true, true, true, true, false,
  false, false, false, false, false, false,
]

const CAST_STAFF_FRONT: readonly boolean[] = [
  false, false, false, false, false, false,
  false, true, true, true, true, true,
  true, true, true, true, true, true,
  false, false, false, false, false, false,
]

export interface PlayerCharacterDrawPlan {
  attachmentPose: 0 | 1 | 7 | 8
  fixedRobeOffset: Vector2
  frontAttachmentOffset: Vector2
  headOffset: Vector2
  headingSheetOffsetY: number
  moving: boolean
  orbOffset: Vector2
  orbZIndex: number
  robePose: number
  staffFront: boolean
}

export interface PlayerDeathDrawPlan {
  facing: number
  frame: number
  heading: number
  shadow: boolean
  visible: boolean
}

interface PlayerDeathTintedSelector {
  readonly primaryTint: number
  readonly secondaryTint: number
  readonly selector: number
}

export interface PlayerDeathEquipmentAppearance {
  readonly hat: PlayerDeathTintedSelector
  readonly robe: PlayerDeathTintedSelector
  readonly weapon: {
    readonly kind: 'staff' | 'wand'
    readonly selector: number
  }
}

const ELEMENT_DEATH_PALETTES: Readonly<Record<WizardElement, readonly [number, number]>> = {
  air: [0xa0c3c3, 0xffffff],
  earth: [0x90b390, 0xffffff],
  ether: [0x886688, 0xffffff],
  fire: [0x998077, 0xffffff],
  water: [0x5e6e81, 0xffffff],
}

const ROBE_DEATH_APPEARANCES: Readonly<Record<number, PlayerDeathTintedSelector>> = {
  1: { primaryTint: 0x191919, secondaryTint: 0x80ffff, selector: 1 },
  7: { primaryTint: 0xc0c0c0, secondaryTint: 0xffffff, selector: 2 },
  12: { primaryTint: 0xff19ff, secondaryTint: 0xffffff, selector: 0 },
  17: { primaryTint: 0x19ffff, secondaryTint: 0xffffff, selector: 2 },
  21: { primaryTint: 0xff0000, secondaryTint: 0xffffff, selector: 0 },
  25: { primaryTint: 0x19ff19, secondaryTint: 0xc8ffc8, selector: 2 },
  46: { primaryTint: 0xffffff, secondaryTint: 0xffffff, selector: 0 },
}

const HAT_DEATH_APPEARANCES: Readonly<Record<number, PlayerDeathTintedSelector>> = {
  5: { primaryTint: 0x191919, secondaryTint: 0xff80ff, selector: 0 },
  6: { primaryTint: 0xc0c0c0, secondaryTint: 0xffffff, selector: 2 },
  11: { primaryTint: 0xff19ff, secondaryTint: 0xffffff, selector: 0 },
  16: { primaryTint: 0x19ffff, secondaryTint: 0xffffff, selector: 3 },
  20: { primaryTint: 0xff0000, secondaryTint: 0xffffff, selector: 2 },
  40: { primaryTint: 0xffffff, secondaryTint: 0xffffff, selector: 3 },
}

const WEAPON_DEATH_APPEARANCES: Readonly<Record<number, {
  readonly kind: 'staff' | 'wand'
  readonly selector: number
}>> = {
  2: { kind: 'wand', selector: 2 },
  8: { kind: 'staff', selector: 1 },
  13: { kind: 'wand', selector: 4 },
  18: { kind: 'staff', selector: 3 },
  28: { kind: 'wand', selector: 3 },
  33: { kind: 'staff', selector: 0 },
  34: { kind: 'staff', selector: 2 },
  41: { kind: 'wand', selector: 5 },
  42: { kind: 'wand', selector: 5 },
  43: { kind: 'wand', selector: 5 },
  44: { kind: 'wand', selector: 5 },
  45: { kind: 'wand', selector: 5 },
}

export function createPlayerDeathDrawPlan(
  headingIndex: number,
  lifeState: 'alive' | 'lethal-pending' | 'dying' | 'spectating',
  deathTick: number,
): PlayerDeathDrawPlan {
  const frame = deathTick >= 159 ? 3 : deathTick >= 156 ? 2 : deathTick >= 153 ? 1 : 0
  const visible = lifeState === 'dying' || lifeState === 'spectating'
  return {
    facing: normalizedIndex(Math.floor((headingIndex + 2) / 4), 6),
    frame,
    heading: normalizedIndex(headingIndex, 24),
    shadow: visible && frame === 3,
    visible,
  }
}

export function playerDeathEquipmentAppearance(
  element: WizardElement,
  equipment: Pick<HubEquipmentState, 'hat' | 'robe' | 'weapon'>,
): PlayerDeathEquipmentAppearance {
  const [primaryTint, secondaryTint] = ELEMENT_DEATH_PALETTES[element]
  return {
    hat: equipment.hat === null || equipment.hat.recipeIndex === null
      ? { primaryTint, secondaryTint, selector: 0 }
      : requiredDeathAppearance(equipment.hat, 'hat', HAT_DEATH_APPEARANCES),
    robe: equipment.robe === null || equipment.robe.recipeIndex === null
      ? { primaryTint, secondaryTint, selector: 0 }
      : requiredDeathAppearance(equipment.robe, 'robe', ROBE_DEATH_APPEARANCES),
    weapon: equipment.weapon === null || equipment.weapon.recipeIndex === null
      ? { kind: 'staff', selector: 0 }
      : requiredWeaponDeathAppearance(equipment.weapon),
  }
}

export function createPlayerCharacterDrawPlan(
  state: Pick<
    PlayerCharacterState,
    'config' | 'gaitDegrees' | 'headingIndex' | 'primaryCast' | 'velocity' | 'walkCyclePrimary'
  >,
  scale = 1,
): PlayerCharacterDrawPlan {
  const attachmentPose = primaryCastPose(
    state.primaryCast.actionTick,
    state.primaryCast.channelActive,
    state.config.element,
  )
  const staffFront = playerCharacterStaffIsFront(state.headingIndex, attachmentPose)
  return {
    attachmentPose,
    fixedRobeOffset: playerCharacterFixedRobeOffset(state.gaitDegrees, scale),
    frontAttachmentOffset: playerCharacterFrontAttachmentOffset(
      state.gaitDegrees,
      scale,
    ),
    headOffset: playerCharacterHeadOffset(
      state.headingIndex,
      state.gaitDegrees,
      scale,
    ),
    headingSheetOffsetY: -state.headingIndex * 170,
    moving: Math.hypot(state.velocity.x, state.velocity.y) > 0.01,
    orbOffset: primarySpellEmitterOffset(
      state.headingIndex,
      state.primaryCast.actionTick,
      state.primaryCast.channelActive,
      state.config.element,
    ),
    orbZIndex: staffFront ? 6 : 2,
    robePose: playerCharacterRobePose(state.walkCyclePrimary),
    staffFront,
  }
}

export function playerCharacterStaffOrbOffset(headingIndex: number): Vector2 {
  return primarySpellEmitterOffset(headingIndex, -1)
}

export function playerCharacterStaffIsFront(
  headingIndex: number,
  attachmentPose: 0 | 1 | 7 | 8 = 0,
): boolean {
  const bank = attachmentPose === 7 || attachmentPose === 8
    ? CAST_STAFF_FRONT
    : STAFF_FRONT
  return bank[normalizedIndex(headingIndex, bank.length)]
}

export function playerCharacterRobePose(walkCyclePrimary: number): number {
  return Math.trunc(walkCyclePrimary)
}

export function playerCharacterFixedRobeOffset(
  gaitDegrees: number,
  scale = 1,
): Vector2 {
  const halfGaitRadians = gaitDegrees * 0.5 * Math.PI / 180
  return {
    x: Math.abs(Math.sin(halfGaitRadians)) * scale * scale,
    y: 0,
  }
}

export function playerCharacterFrontAttachmentOffset(
  gaitDegrees: number,
  scale = 1,
): Vector2 {
  return {
    x: playerCharacterFixedRobeOffset(gaitDegrees, scale).x,
    y: scale,
  }
}

export function playerCharacterHeadOffset(
  headingIndex: number,
  gaitDegrees: number,
  scale = 1,
): Vector2 {
  const gaitRadians = gaitDegrees * Math.PI / 180
  const perpendicularRadians = (headingIndex * 15 + 90) * Math.PI / 180
  const lateral = -Math.cos(gaitRadians) * 0.5 * scale
  return {
    x: Math.sin(perpendicularRadians) * lateral,
    y: -Math.cos(perpendicularRadians) * lateral
      - Math.abs(Math.sin(gaitRadians)) * 1.5 * scale,
  }
}

function normalizedIndex(value: number, length: number): number {
  return ((Math.round(value) % length) + length) % length
}

function requiredDeathAppearance(
  item: HubInventoryItem,
  expectedType: 'hat' | 'robe',
  appearances: Readonly<Record<number, PlayerDeathTintedSelector>>,
): PlayerDeathTintedSelector {
  const appearance = item.recipeIndex === null ? undefined : appearances[item.recipeIndex]
  if (item.equipmentType !== expectedType || appearance === undefined) {
    throw new Error(`Unsupported native ${expectedType} death appearance recipe ${item.recipeIndex}`)
  }
  return appearance
}

function requiredWeaponDeathAppearance(item: HubInventoryItem): {
  readonly kind: 'staff' | 'wand'
  readonly selector: number
} {
  const appearance = item.recipeIndex === null
    ? undefined
    : WEAPON_DEATH_APPEARANCES[item.recipeIndex]
  if (
    appearance === undefined
    || item.equipmentType !== appearance.kind
  ) throw new Error(`Unsupported native death weapon recipe ${item.recipeIndex}`)
  return appearance
}
