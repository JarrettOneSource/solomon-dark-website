import { actorHeadingVector } from '../../core-kernels/actor-heading.ts'
import type { HubInventoryAction } from '../../core-kernels/hub-economy.ts'
import {
  createIdlePlayerCharacterInput,
  type PlayerCharacterInput,
} from '../../core-kernels/player-character.ts'
import { playerCanAcceptInput } from '../../core-kernels/player-combat.ts'
import {
  gameSimulationPlayerRecords,
  getPlayerProgression,
  getPlayerSkillBook,
  type GameSimulationState,
} from '../game-simulation.ts'
import type { MlBotPolicyEnemyRow } from './enemies.ts'
import type { MlBotPolicyFrame } from './observer.ts'
import { ML_BOT_POLICY_SCALES } from './spec.ts'
import type { MlBotPolicyCommittedAction } from './world-state.ts'

export const ML_BOT_POLICY_ACTION_STRIDE = 4

export interface MlBotPolicyActionIndices {
  readonly ability: number
  readonly aim: number
  readonly movement: number
  readonly target: number
}

export interface MlBotPolicyActionMasks {
  readonly ability: Uint8Array
  readonly aim: Uint8Array
  readonly movement: Uint8Array
  readonly target: Uint8Array
}

export interface MlBotPolicyDecision {
  readonly committedAction: MlBotPolicyCommittedAction
  readonly hubAction: HubInventoryAction | null
  readonly input: PlayerCharacterInput
  readonly masks: MlBotPolicyActionMasks
  readonly targetId: number | null
}

const INVERSE_SQRT_TWO = 1 / Math.sqrt(2)
const DIRECTIONS = Object.freeze([
  { x: 1, y: 0 },
  { x: INVERSE_SQRT_TWO, y: INVERSE_SQRT_TWO },
  { x: 0, y: 1 },
  { x: -INVERSE_SQRT_TWO, y: INVERSE_SQRT_TWO },
  { x: -1, y: 0 },
  { x: -INVERSE_SQRT_TWO, y: -INVERSE_SQRT_TWO },
  { x: 0, y: -1 },
  { x: INVERSE_SQRT_TWO, y: -INVERSE_SQRT_TWO },
])
const FREE_PRIMARY_IDS = new Set([16, 40])
const FREE_WELD_BUILD_IDS = new Set([1_006, 1_007, 1_008, 1_009])
const FREE_SECONDARY_IDS = new Set([11, 15, 16, 27, 45, 48, 49, 50, 72, 73, 74, 76, 77])

export function resolveMlBotPolicyDecision(
  state: GameSimulationState,
  playerId: string,
  frame: MlBotPolicyFrame,
  action: MlBotPolicyActionIndices,
): MlBotPolicyDecision {
  validateActionIndices(action)
  const players = gameSimulationPlayerRecords(state)
  const self = players[playerId]
  if (!self) throw new Error(`ML bot policy action has no player ${playerId}`)
  const progression = getPlayerProgression(state, playerId)
  const skillBook = getPlayerSkillBook(state, playerId)
  const globallyGated = frame.player.blockA[22] === 1
    || frame.player.blockA[23] === 1
    || !playerCanAcceptInput(progression)
  const movement = new Uint8Array(9)
  const target = new Uint8Array(9)
  const ability = new Uint8Array(22)
  const aim = new Uint8Array(9)
  movement[0] = 1
  target[0] = 1
  ability[0] = 1
  aim[0] = 1
  if (!globallyGated) {
    for (let index = 0; index < DIRECTIONS.length; index += 1) {
      movement[index + 1] = Number(
        frame.geometry.patchAndRays[index]!
          > ML_BOT_POLICY_SCALES.rayStep / ML_BOT_POLICY_SCALES.rayRange,
      )
    }
    target[0] = Number(frame.targetId !== null || frame.enemyRows.length === 0)
    for (let index = 0; index < Math.min(8, frame.enemyRows.length); index += 1) {
      target[index + 1] = 1
    }
  }
  requireLegal(movement, action.movement, 'movement')
  requireLegal(target, action.target, 'target')
  const selectedTarget = selectedEnemy(frame, action.target)
  const targetId = selectedTarget?.id ?? null

  const primaryFree = FREE_PRIMARY_IDS.has(skillBook.primarySkillId)
    || (skillBook.primarySkillId === 52
      && skillBook.weldBuildId !== null
      && FREE_WELD_BUILD_IDS.has(skillBook.weldBuildId))
  if (!globallyGated) {
    const targetInPrimaryRange = selectedTarget !== null && Math.max(0, Math.hypot(
      selectedTarget.position.x - self.position.x,
      selectedTarget.position.y - self.position.y,
    ) - selectedTarget.radius) <= frame.player.primaryRange
    ability[1] = Number(
      frame.player.blockA[7] === 1
      && frame.player.primaryAffordable
      && (primaryFree || targetInPrimaryRange),
    )
    for (let slot = 0; slot < 8; slot += 1) {
      const secondary = frame.player.secondarySlots[slot]
      ability[slot + 2] = Number(
        secondary?.occupied === true
        && secondary.ready
        && secondary.affordable,
      )
    }
    for (let slot = 0; slot < 12; slot += 1) {
      ability[slot + 10] = Number(frame.inventory.potions[slot]?.legal ?? false)
    }
  }
  requireLegal(ability, action.ability, 'ability')
  const selectedSecondary = action.ability >= 2 && action.ability <= 9
    ? frame.player.secondarySlots[action.ability - 2]?.skillId ?? null
    : null
  const freeAim = action.ability === 1
    ? primaryFree
    : selectedSecondary !== null && FREE_SECONDARY_IDS.has(selectedSecondary)
  if (!globallyGated && freeAim) aim.fill(1)
  requireLegal(aim, action.aim, 'aim')

  const selectedMovement = action.movement === 0
    ? { x: 0, y: 0 }
    : DIRECTIONS[action.movement - 1]!
  const hubAction = action.ability >= 10
    ? {
        type: 'consume' as const,
        itemId: frame.inventory.potions[action.ability - 10]!.itemId,
      }
    : null
  const input = hubAction ? createIdlePlayerCharacterInput() : {
    aim: action.ability === 0 ? null : aimPoint(self, selectedTarget, action.aim),
    cast: {
      primary: action.ability === 1,
      quickbar: action.ability >= 2 && action.ability <= 9
        ? action.ability - 2
        : null,
    },
    movement: { ...selectedMovement },
  }
  return {
    committedAction: {
      abilityAction: action.ability,
      movement: input.movement,
      targetAction: action.target,
      targetSwitched: targetId !== frame.targetId,
    },
    hubAction,
    input,
    masks: { ability, aim, movement, target },
    targetId,
  }
}

function selectedEnemy(frame: MlBotPolicyFrame, targetAction: number): MlBotPolicyEnemyRow | null {
  if (targetAction === 0) {
    return frame.targetId === null
      ? null
      : frame.enemyRows.find(({ id }) => id === frame.targetId) ?? null
  }
  return frame.enemyRows[targetAction - 1] ?? null
}

function aimPoint(
  self: ReturnType<typeof gameSimulationPlayerRecords>[string],
  target: MlBotPolicyEnemyRow | null,
  aimAction: number,
): { x: number; y: number } {
  if (aimAction > 0) {
    const direction = DIRECTIONS[aimAction - 1]!
    const origin = target?.position ?? self.position
    return {
      x: origin.x + direction.x * ML_BOT_POLICY_SCALES.aimOffsetWorld,
      y: origin.y + direction.y * ML_BOT_POLICY_SCALES.aimOffsetWorld,
    }
  }
  if (target) return { ...target.position }
  const facing = actorHeadingVector(self.headingIndex)
  return {
    x: self.position.x + facing.x * ML_BOT_POLICY_SCALES.aimOffsetWorld,
    y: self.position.y + facing.y * ML_BOT_POLICY_SCALES.aimOffsetWorld,
  }
}

function validateActionIndices(action: MlBotPolicyActionIndices): void {
  for (const [head, value, count] of [
    ['movement', action.movement, 9],
    ['target', action.target, 9],
    ['ability', action.ability, 22],
    ['aim', action.aim, 9],
  ] as const) {
    if (!Number.isInteger(value) || value < 0 || value >= count) {
      throw new RangeError(`ML bot policy ${head} action must be an integer within 0..${count - 1}`)
    }
  }
}

function requireLegal(mask: Uint8Array, action: number, head: string): void {
  if (mask[action] !== 1) throw new Error(`ML bot policy selected illegal ${head} action ${action}`)
}
