import type {
  PlayerCharacterState,
  WizardElement,
} from './core-kernels/player-character.ts'
import type { Vector2 } from './core-kernels/vector.ts'
import { nativePlayerStaffActionPose } from './core-kernels/native-player-staff-action.ts'
import {
  primaryCastPresentationPose,
  primarySpellEmitterOffset,
  staffAttachmentEmitterOffset,
  playerStaffAttachmentOffset,
  type PlayerStaffAttachmentPose,
  type PrimarySpellTransientState,
} from './core-kernels/primary-spells.ts'

export {
  isPlayerModEquipmentAppearance,
  playerDeathEquipmentAppearance,
  playerLivingEquipmentAppearance,
  playerLivingNativeEquipmentAppearance,
  type PlayerDeathEquipmentAppearance,
  type PlayerEquipmentTintedSelector,
  type PlayerLivingEquipmentAppearance,
  type PlayerRenderableEquipmentAppearance,
} from './core-kernels/player-equipment-appearance.ts'

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

const MELEE_ALT_STAFF_FRONT: readonly boolean[] = [
  false, false, false, false, false, false,
  false, true, true, true, true, true,
  true, true, true, true, true, true,
  true, false, false, false, false, false,
]

export interface PlayerCharacterDrawPlan {
  attachmentPose: PlayerStaffAttachmentPose
  bareAttachmentPose: 0 | null
  fixedRobeOffset: Vector2
  frontAttachmentOffset: Vector2
  headOffset: Vector2
  headingSheetOffsetY: number
  moving: boolean
  orbPasses: PlayerStaffOrbPasses
  orbOffset: Vector2
  robePose: number
  staffFront: boolean
  unselectedPrimaryAttachment: boolean
}

export interface PlayerStaffOrbPasses {
  readonly frontBase: boolean
  readonly frontOverlay: boolean
}

export const NATIVE_PLAYER_ELEMENT_EFFECT_FRONT_PULSE_THRESHOLD =
  0.10000000149011612
export const NATIVE_PLAYER_ROBE_FIXED_POSE_COUNT = 17
export const NATIVE_UNSELECTED_PRIMARY_ATTACHMENT_POSE = 4
export const NATIVE_UNSELECTED_PRIMARY_ROBE_FIXED_POSE = 13

export type PlayerRobeFixedPose = PlayerStaffAttachmentPose
  | 10 | 11 | 12 | 13 | 14 | 15 | 16

export interface PlayerDeathDrawPlan {
  facing: number
  frame: number
  heading: number
  shadow: boolean
  visible: boolean
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

export function createPlayerCharacterDrawPlan(
  state: Pick<
    PlayerCharacterState,
    'config' | 'gaitDegrees' | 'headingIndex' | 'primaryCast' | 'velocity' | 'walkCyclePrimary'
  >,
  scale = 1,
  staffActionPose: PlayerStaffAttachmentPose | null = null,
  secondaryCastActive = false,
  elementEffectPhase = state.primaryCast.weaponPulse,
): PlayerCharacterDrawPlan {
  const castElement = selectedPrimaryCastElement(
    state.primaryCast.selectedPrimaryId,
    state.config.element,
  )
  const attachmentPose = secondaryCastActive
    ? 9
    : staffActionPose ?? primaryCastPresentationPose(state.primaryCast, castElement)
  const unselectedPrimaryAttachment = state.primaryCast.selectedPrimaryId === -1
  const bareAttachmentPose: 0 | null = !unselectedPrimaryAttachment
    && staffActionPose === null
    && !secondaryCastActive
    && state.primaryCast.actionTick < 0
    && !state.primaryCast.channelActive
    && !state.primaryCast.oneShotAttackPoseHeld
    ? 0
    : null
  const staffFront = playerCharacterStaffIsFront(state.headingIndex, attachmentPose)
  return {
    attachmentPose,
    bareAttachmentPose,
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
    orbPasses: playerCharacterStaffOrbPasses(
      state.headingIndex,
      attachmentPose,
      elementEffectPhase,
    ),
    orbOffset: secondaryCastActive
      ? staffAttachmentEmitterOffset(state.headingIndex, 9)
      : playerStaffAttachmentOffset(state.headingIndex, attachmentPose),
    robePose: playerCharacterRobePose(state.walkCyclePrimary),
    staffFront,
    unselectedPrimaryAttachment,
  }
}

export function playerEquippedElementEffectScale(
  effectPhase: number,
): number {
  return Math.fround(1 + 10 * effectPhase)
}

function selectedPrimaryCastElement(
  skillId: number,
  fallback: WizardElement,
): WizardElement {
  if (skillId === 8) return 'ether'
  if (skillId === 16) return 'fire'
  if (skillId === 24) return 'air'
  if (skillId === 32) return 'water'
  if (skillId === 40) return 'earth'
  if (skillId >= 1000 && skillId <= 1009) return 'fire'
  return fallback
}

export function playerCharacterStaffOrbOffset(headingIndex: number): Vector2 {
  return primarySpellEmitterOffset(headingIndex, -1)
}

export function playerCharacterStaffOrbPasses(
  headingIndex: number,
  attachmentPose: PlayerStaffAttachmentPose,
  elementEffectPhase: number,
): PlayerStaffOrbPasses {
  const headingDegrees = normalizedIndex(headingIndex, 24) * 15
  const backAngle = headingDegrees <= 90 || headingDegrees > 270
  return {
    frontBase: attachmentPose !== 9
      && headingDegrees >= 90
      && headingDegrees <= 270,
    frontOverlay: attachmentPose === 9
      || backAngle
      || elementEffectPhase > NATIVE_PLAYER_ELEMENT_EFFECT_FRONT_PULSE_THRESHOLD,
  }
}

export function playerStaffActionPose(
  transients: readonly PrimarySpellTransientState[],
  ownerId: string,
  worldKey: string,
): PlayerStaffAttachmentPose | null {
  const action = transients.find((effect) => (
    effect.ownerId === ownerId
    && effect.worldKey === worldKey
    && (effect.kind === 'player-staff-melee' || effect.kind === 'player-staff-spin')
  ))
  return action?.kind === 'player-staff-melee' || action?.kind === 'player-staff-spin'
    ? nativePlayerStaffActionPose(action) as PlayerStaffAttachmentPose
    : null
}

export function playerCharacterStaffIsFront(
  headingIndex: number,
  attachmentPose: PlayerStaffAttachmentPose = 0,
): boolean {
  const bank = attachmentPose === 7 || attachmentPose === 8 || attachmentPose === 9
    ? CAST_STAFF_FRONT
    : attachmentPose === 4
        || attachmentPose === 5
        || attachmentPose === 6
      ? MELEE_ALT_STAFF_FRONT
      : STAFF_FRONT
  return bank[normalizedIndex(headingIndex, bank.length)]
}

export function playerCharacterRobePose(walkCyclePrimary: number): number {
  return Math.trunc(walkCyclePrimary)
}

export function playerCharacterRobeFixedPose(
  attachmentPose: PlayerStaffAttachmentPose,
  unselectedPrimaryAttachment: boolean,
  nativeRobe: boolean,
): PlayerRobeFixedPose {
  return unselectedPrimaryAttachment && nativeRobe
    ? NATIVE_UNSELECTED_PRIMARY_ROBE_FIXED_POSE
    : attachmentPose
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
