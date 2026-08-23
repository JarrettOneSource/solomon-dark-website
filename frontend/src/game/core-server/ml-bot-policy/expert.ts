import { getPlayerCharacter, getPlayerEconomy, getPlayerProgression, type GameSimulationState } from '../game-simulation.ts'
import {
  resolveMlBotPolicyDecision,
  type MlBotPolicyActionIndices,
} from './actions.ts'
import type { MlBotPolicyEnemyRow } from './enemies.ts'
import type { MlBotPolicyFrame } from './observer.ts'

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

export function selectMlBotPolicyExpertAction(
  state: GameSimulationState,
  playerId: string,
  frame: MlBotPolicyFrame,
): MlBotPolicyActionIndices {
  const target = selectTarget(frame)
  const base = resolveMlBotPolicyDecision(state, playerId, frame, {
    ability: 0,
    aim: 0,
    movement: 0,
    target: target.action,
  })
  const ability = selectAbility(state, playerId, frame, target.row, base.masks.ability)
  const aimed = resolveMlBotPolicyDecision(state, playerId, frame, {
    ability,
    aim: 0,
    movement: 0,
    target: target.action,
  })
  const movement = selectMovement(state, playerId, frame, target.row, base.masks.movement)
  const aim = selectAim(target.row, aimed.masks.aim)
  return { ability, aim, movement, target: target.action }
}

function selectTarget(frame: MlBotPolicyFrame): Readonly<{
  action: number
  row: MlBotPolicyEnemyRow | null
}> {
  if (frame.targetId !== null) {
    const current = frame.enemyRows.find(({ id }) => id === frame.targetId)
    if (current) return { action: 0, row: current }
  }
  const row = frame.enemyRows[0] ?? null
  return { action: row === null ? 0 : 1, row }
}

function selectAbility(
  state: GameSimulationState,
  playerId: string,
  frame: MlBotPolicyFrame,
  target: MlBotPolicyEnemyRow | null,
  mask: Uint8Array,
): number {
  const progression = getPlayerProgression(state, playerId)
  const economy = getPlayerEconomy(state, playerId)
  const hpRatio = ratio(progression.currentHealth, progression.maximumHealth)
  const manaRatio = ratio(progression.currentMana, progression.maximumMana)
  const preferredPotionKind = hpRatio < 0.4
    ? 'health-potion'
    : manaRatio < 0.25
      ? 'mana-potion'
      : null
  if (preferredPotionKind !== null) {
    const potionSlot = frame.inventory.potions.findIndex(({ itemId, legal }) => (
      legal && economy.backpack.some(({ id, kind }) => id === itemId && kind === preferredPotionKind)
    ))
    if (potionSlot >= 0 && mask[potionSlot + 10] === 1) return potionSlot + 10
  }

  const ownMinionCount = frame.minions.blockS[4 * 15] ?? 0
  if (ownMinionCount === 0) {
    const golemSlot = frame.player.secondarySlots.findIndex(({ skillId }) => skillId === 45)
    if (golemSlot >= 0 && mask[golemSlot + 2] === 1) return golemSlot + 2
  }
  if (target === null) return 0
  for (let action = 2; action <= 9; action += 1) {
    if (mask[action] === 1) return action
  }
  if (mask[1] === 1) return 1
  return 0
}

function selectMovement(
  state: GameSimulationState,
  playerId: string,
  frame: MlBotPolicyFrame,
  target: MlBotPolicyEnemyRow | null,
  mask: Uint8Array,
): number {
  const self = getPlayerCharacter(state, playerId)
  const hazard = nearestUrgentHazard(frame)
  if (hazard !== null) {
    return nearestLegalDirection({ x: -hazard.y, y: hazard.x }, mask)
  }

  const pickup = preferredPickup(state, playerId)
  if (pickup !== null) {
    return nearestLegalDirection({
      x: pickup.x - self.position.x,
      y: pickup.y - self.position.y,
    }, mask)
  }

  if (target === null) return 0
  const targetDelta = {
    x: target.position.x - self.position.x,
    y: target.position.y - self.position.y,
  }
  const targetDistance = Math.hypot(targetDelta.x, targetDelta.y)
  const ownMinion = firstOwnMinion(frame)
  if (ownMinion !== null) {
    const minionDistance = Math.hypot(ownMinion.x, ownMinion.y)
    if (minionDistance > 300) return nearestLegalDirection(ownMinion, mask)
  }
  if (targetDistance > 160) return nearestLegalDirection(targetDelta, mask)
  if (targetDistance < 100) {
    return nearestLegalDirection({ x: -targetDelta.x, y: -targetDelta.y }, mask)
  }
  return 0
}

function selectAim(target: MlBotPolicyEnemyRow | null, mask: Uint8Array): number {
  if (target === null || mask.slice(1).every((value) => value === 0)) return 0
  if (target.velocity.x === 0 && target.velocity.y === 0) return 0
  return nearestLegalDirection(target.velocity, mask)
}

function nearestUrgentHazard(frame: MlBotPolicyFrame): { x: number; y: number } | null {
  const block = frame.blocks.find(({ key }) => key === 'N')?.values
  if (!block || block[0] !== 1 || block[13]! > 0.1) return null
  return { x: block[7]!, y: block[8]! }
}

function preferredPickup(state: GameSimulationState, playerId: string): { x: number; y: number } | null {
  if (state.world.kind !== 'boneyard') return null
  const progression = getPlayerProgression(state, playerId)
  const wantsHealth = ratio(progression.currentHealth, progression.maximumHealth) < 0.5
  const wantsMana = ratio(progression.currentMana, progression.maximumMana) < 0.3
  const candidates = state.world.loot.actors.filter((actor) => (
    (wantsHealth && actor.kind === 'orb' && actor.orbKind === 'health')
    || (wantsMana && actor.kind === 'orb' && actor.orbKind === 'mana')
    || (wantsHealth && actor.kind === 'sack' && actor.item?.kind === 'health-potion')
    || (wantsMana && actor.kind === 'sack' && actor.item?.kind === 'mana-potion')
  ))
  const self = getPlayerCharacter(state, playerId)
  candidates.sort((left, right) => (
    distanceSquared(left.position, self.position) - distanceSquared(right.position, self.position)
    || left.id - right.id
  ))
  return candidates[0]?.position ?? null
}

function firstOwnMinion(frame: MlBotPolicyFrame): { x: number; y: number } | null {
  const block = frame.minions.blockS
  for (let slot = 0; slot < 4; slot += 1) {
    const start = slot * 15
    if (block[start] === 1 && block[start + 1] === 1) {
      return { x: block[start + 2]!, y: block[start + 3]! }
    }
  }
  return null
}

function nearestLegalDirection(vector: Readonly<{ x: number; y: number }>, mask: Uint8Array): number {
  const length = Math.hypot(vector.x, vector.y)
  if (length <= 1e-9) return 0
  const unit = { x: vector.x / length, y: vector.y / length }
  let selected = 0
  let score = Number.NEGATIVE_INFINITY
  for (let action = 1; action <= DIRECTIONS.length; action += 1) {
    if (mask[action] !== 1) continue
    const direction = DIRECTIONS[action - 1]!
    const candidate = direction.x * unit.x + direction.y * unit.y
    if (candidate > score) {
      selected = action
      score = candidate
    }
  }
  return selected
}

function ratio(value: number, maximum: number): number {
  return maximum > 0 ? Math.max(0, Math.min(1, value / maximum)) : 0
}

function distanceSquared(
  left: Readonly<{ x: number; y: number }>,
  right: Readonly<{ x: number; y: number }>,
): number {
  return (left.x - right.x) ** 2 + (left.y - right.y) ** 2
}
