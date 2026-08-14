import type { PlayerCharacterState } from './core-kernels/player-character.ts'
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
  visible: boolean
}

export function createPlayerDeathDrawPlan(
  headingIndex: number,
  lifeState: 'alive' | 'lethal-pending' | 'dying' | 'spectating',
  deathTick: number,
): PlayerDeathDrawPlan {
  return {
    facing: normalizedIndex(Math.floor((headingIndex + 2) / 4), 6),
    frame: deathTick >= 159 ? 3 : deathTick >= 156 ? 2 : deathTick >= 153 ? 1 : 0,
    visible: lifeState === 'dying' || lifeState === 'spectating',
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
