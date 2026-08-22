import type { PlayerCharacterInput } from '../../core-kernels/player-character.ts'
import type { Vector2 } from '../../core-kernels/vector.ts'
import {
  gameSimulationPlayerRecords,
  getPlayerProgression,
  getPlayerSkillBook,
  type GameSimulationState,
} from '../game-simulation.ts'
import { playerSkillDerivedStatsAt } from '../player-entity-store.ts'
import type { MlBotPolicyEnemyRow } from './enemies.ts'
import { ML_BOT_POLICY_SCALES } from './spec.ts'

export interface MlBotPolicyCommittedAction {
  readonly abilityAction: number
  readonly movement: Readonly<Vector2>
  readonly targetAction: number
  readonly targetSwitched: boolean
}

export interface MlBotPolicyWorldMemory {
  readonly lastCastTick: number | null
  readonly lastEnemyCount: number | null
  readonly lastHpRatio: number | null
  readonly lastManaRatio: number | null
  readonly lastMoveTick: number | null
  readonly lastTargetHpRatio: number | null
  readonly lastTargetId: number | null
}

export interface MlBotPolicyHostContext {
  readonly activeInputs: Readonly<Record<string, PlayerCharacterInput>>
  readonly controllers: Readonly<Record<string, 'bot' | 'human'>>
  readonly memory: MlBotPolicyWorldMemory
  readonly previousAction: MlBotPolicyCommittedAction | null
  readonly targetId: number | null
}

export interface MlBotPolicyWorldObservation {
  readonly blockG: Float32Array
  readonly blockH: Float32Array
  readonly blockI: Float32Array
  readonly blockJ: Float32Array
  readonly nextMemory: MlBotPolicyWorldMemory
}

export function createMlBotPolicyWorldMemory(): MlBotPolicyWorldMemory {
  return {
    lastCastTick: null,
    lastEnemyCount: null,
    lastHpRatio: null,
    lastManaRatio: null,
    lastMoveTick: null,
    lastTargetHpRatio: null,
    lastTargetId: null,
  }
}

export function observeMlBotPolicyWorldState(
  state: GameSimulationState,
  playerId: string,
  enemies: readonly MlBotPolicyEnemyRow[],
  context: MlBotPolicyHostContext,
): MlBotPolicyWorldObservation {
  const players = gameSimulationPlayerRecords(state)
  const self = players[playerId]
  if (!self) throw new Error(`ML bot policy world has no player ${playerId}`)
  const progression = getPlayerProgression(state, playerId)
  const skillBook = getPlayerSkillBook(state, playerId)
  const derived = playerSkillDerivedStatsAt(state.playerEntities, playerId)
  if (!derived) throw new Error(`ML bot policy world has no derived stats for ${playerId}`)
  const target = context.targetId === null
    ? null
    : enemies.find(({ id }) => id === context.targetId) ?? null

  const blockG = observePickups(state, self.position)
  const blockI = observeAllies(state, playerId, self.position, context)
  const blockJ = new Float32Array([
    statusTime(progression.damageX4TicksRemaining),
    statusTime(progression.poisonImmunityTicksRemaining),
    statusTime(progression.mindChugTicksRemaining),
  ])
  const blockH = new Float32Array(43)
  const threats = enemies.filter(({ position }) => (
    Math.hypot(position.x - self.position.x, position.y - self.position.y)
      <= ML_BOT_POLICY_SCALES.threatRadiusWorld
  ))
  appendNearest(blockH, 2, enemies[0], self.position)
  appendNearest(blockH, 5, threats[0], self.position)
  if (threats[0]) {
    const direction = normalized(
      threats[0].position.x - self.position.x,
      threats[0].position.y - self.position.y,
    )
    blockH[8] = -direction.x
    blockH[9] = -direction.y
  }
  blockH[0] = scaledUnsigned(enemies.length, ML_BOT_POLICY_SCALES.enemyCount)
  blockH[1] = scaledUnsigned(threats.length, ML_BOT_POLICY_SCALES.threatCount)
  if (state.world.kind === 'boneyard') {
    const center = {
      x: state.world.bounds.x + state.world.bounds.w / 2,
      y: state.world.bounds.y + state.world.bounds.h / 2,
    }
    const centerDelta = { x: center.x - self.position.x, y: center.y - self.position.y }
    blockH[10] = scaledSigned(centerDelta.x, ML_BOT_POLICY_SCALES.range)
    blockH[11] = scaledSigned(centerDelta.y, ML_BOT_POLICY_SCALES.range)
    blockH[12] = scaledUnsigned(Math.hypot(centerDelta.x, centerDelta.y), ML_BOT_POLICY_SCALES.range)
    blockH[13] = clampSigned((self.position.x - state.world.bounds.x) / state.world.bounds.w)
    blockH[14] = clampSigned((self.position.y - state.world.bounds.y) / state.world.bounds.h)
    const edgeDistance = Math.min(
      self.position.x - state.world.bounds.x,
      state.world.bounds.x + state.world.bounds.w - self.position.x,
      self.position.y - state.world.bounds.y,
      state.world.bounds.y + state.world.bounds.h - self.position.y,
    )
    blockH[15] = 1 - scaledUnsigned(edgeDistance, ML_BOT_POLICY_SCALES.edgePressureRange)
  }
  const elementIndex = { fire: 16, water: 17, earth: 18, air: 19, ether: 20 }[self.config.element]
  const disciplineIndex = { mind: 21, body: 22, arcane: 23 }[self.config.discipline]
  blockH[elementIndex] = 1
  blockH[disciplineIndex] = 1
  const hpRatio = ratio(progression.currentHealth, progression.maximumHealth)
  const manaRatio = ratio(progression.currentMana, progression.maximumMana)
  const targetHpRatio = target ? ratio(target.currentHealth, target.maximumHealth) : 0
  blockH[24] = context.memory.lastHpRatio === null ? 0 : clampSigned(hpRatio - context.memory.lastHpRatio)
  blockH[25] = context.memory.lastManaRatio === null ? 0 : clampSigned(manaRatio - context.memory.lastManaRatio)
  blockH[26] = target && context.memory.lastTargetId === target.id
    && context.memory.lastTargetHpRatio !== null
    ? clampSigned(targetHpRatio - context.memory.lastTargetHpRatio)
    : 0
  blockH[27] = context.memory.lastEnemyCount === null
    ? 0
    : scaledSigned(enemies.length - context.memory.lastEnemyCount, ML_BOT_POLICY_SCALES.enemyCount)
  const previousAction = context.previousAction
  blockH[28] = previousAction?.movement.x ?? 0
  blockH[29] = previousAction?.movement.y ?? 0
  blockH[30] = Number(previousAction?.abilityAction === 1)
  blockH[31] = Number(
    previousAction !== null
    && previousAction.abilityAction >= 2
    && previousAction.abilityAction <= 9,
  )
  const lastCastTick = previousAction && previousAction.abilityAction >= 1
    && previousAction.abilityAction <= 9
    ? state.tick
    : context.memory.lastCastTick
  const lastMoveTick = previousAction
    && (previousAction.movement.x !== 0 || previousAction.movement.y !== 0)
    ? state.tick
    : context.memory.lastMoveTick
  blockH[32] = progression.lastDamageTick === null
    ? 1
    : historyTime(state.tick - progression.lastDamageTick)
  blockH[33] = lastCastTick === null ? 1 : historyTime(state.tick - lastCastTick)
  blockH[34] = lastMoveTick === null ? 1 : historyTime(state.tick - lastMoveTick)
  blockH[35] = previousAction === null
    ? 0
    : scaledUnsigned(previousAction.targetAction, ML_BOT_POLICY_SCALES.targetAction)
  blockH[36] = Number(previousAction?.targetSwitched ?? false)
  blockH[37] = Number((skillBook.effectiveRanks[52] ?? 0) > 0)
  blockH[38] = Number(progression.pendingOffer?.options.some(({ weldBuildId }) => (
    weldBuildId !== undefined
  )) ?? false)
  blockH[39] = scaledSigned(derived.offensiveDamageFactor, ML_BOT_POLICY_SCALES.multiplier)
  blockH[40] = scaledSigned(derived.offensiveManaCostFactor, ML_BOT_POLICY_SCALES.multiplier)
  blockH[41] = scaledSigned(derived.castProgressFactor, ML_BOT_POLICY_SCALES.multiplier)
  blockH[42] = scaledSigned(derived.secondaryRechargeFactor, ML_BOT_POLICY_SCALES.multiplier)

  return {
    blockG,
    blockH,
    blockI,
    blockJ,
    nextMemory: {
      lastCastTick,
      lastEnemyCount: enemies.length,
      lastHpRatio: hpRatio,
      lastManaRatio: manaRatio,
      lastMoveTick,
      lastTargetHpRatio: target?.currentHealth === undefined ? null : targetHpRatio,
      lastTargetId: target?.id ?? null,
    },
  }
}

function observePickups(state: GameSimulationState, position: Readonly<Vector2>): Float32Array {
  const block = new Float32Array(4 * 21 + 1)
  if (state.world.kind !== 'boneyard') return block
  const actors = [...state.world.loot.actors].sort((left, right) => (
    distanceSquared(left.position, position) - distanceSquared(right.position, position)
    || left.id - right.id
  ))
  for (let slot = 0; slot < Math.min(4, actors.length); slot += 1) {
    const actor = actors[slot]!
    const start = slot * 21
    const relative = { x: actor.position.x - position.x, y: actor.position.y - position.y }
    const direction = normalized(relative.x, relative.y)
    const item = actor.item
    block[start] = 1
    block[start + 1] = direction.x
    block[start + 2] = direction.y
    block[start + 3] = scaledUnsigned(Math.hypot(relative.x, relative.y), ML_BOT_POLICY_SCALES.range)
    block[start + 4] = Number(actor.kind === 'gold')
    block[start + 5] = Number(actor.kind === 'orb' && actor.orbKind === 'health')
    block[start + 6] = Number(actor.kind === 'orb' && actor.orbKind === 'mana')
    block[start + 7] = Number(actor.kind === 'sack')
    block[start + 8] = Number(actor.kind === 'bonus')
    block[start + 9] = Number(actor.kind === 'sack' && item !== null)
    block[start + 10] = Number(item?.kind === 'health-potion')
    block[start + 11] = Number(item?.kind === 'mana-potion')
    block[start + 12] = Number(item?.kind === 'wizard-chug')
    block[start + 13] = Number(item?.kind === 'antidote')
    block[start + 14] = Number(item?.kind === 'mind-chug')
    block[start + 15] = Number(item?.kind === 'rejuvenation-potion')
    block[start + 16] = Number(item?.kind === 'mod-potion')
    block[start + 17] = Number(item?.kind === 'equipment')
    block[start + 18] = Number(item?.kind === 'key')
    block[start + 19] = countScaled(item?.quantity ?? 0)
    block[start + 20] = countScaled(actor.amount)
  }
  block[4 * 21] = scaledUnsigned(actors.length, ML_BOT_POLICY_SCALES.pickupCount)
  return block
}

function observeAllies(
  state: GameSimulationState,
  playerId: string,
  selfPosition: Readonly<Vector2>,
  context: MlBotPolicyHostContext,
): Float32Array {
  const block = new Float32Array(4 * 10 + 1)
  const players = gameSimulationPlayerRecords(state)
  const allies = state.run.eligiblePlayerIds.filter((id) => id !== playerId && players[id]).sort((left, right) => (
    distanceSquared(players[left]!.position, selfPosition)
      - distanceSquared(players[right]!.position, selfPosition)
    || left.localeCompare(right)
  ))
  for (let slot = 0; slot < Math.min(4, allies.length); slot += 1) {
    const id = allies[slot]!
    const ally = players[id]!
    const progression = getPlayerProgression(state, id)
    const relative = { x: ally.position.x - selfPosition.x, y: ally.position.y - selfPosition.y }
    const direction = normalized(relative.x, relative.y)
    const start = slot * 10
    block[start] = 1
    block[start + 1] = direction.x
    block[start + 2] = direction.y
    block[start + 3] = scaledUnsigned(Math.hypot(relative.x, relative.y), ML_BOT_POLICY_SCALES.range)
    block[start + 4] = ratio(progression.currentHealth, progression.maximumHealth)
    block[start + 5] = ratio(progression.currentMana, progression.maximumMana)
    block[start + 6] = Number(progression.lifeState === 'alive')
    block[start + 7] = Number(context.controllers[id] === 'human')
    block[start + 8] = context.activeInputs[id]?.movement.x ?? 0
    block[start + 9] = context.activeInputs[id]?.movement.y ?? 0
  }
  block[4 * 10] = scaledUnsigned(allies.length, ML_BOT_POLICY_SCALES.allyCount)
  return block
}

function appendNearest(
  target: Float32Array,
  offset: number,
  enemy: MlBotPolicyEnemyRow | undefined,
  selfPosition: Readonly<Vector2>,
): void {
  if (!enemy) return
  const relative = { x: enemy.position.x - selfPosition.x, y: enemy.position.y - selfPosition.y }
  const direction = normalized(relative.x, relative.y)
  target[offset] = direction.x
  target[offset + 1] = direction.y
  target[offset + 2] = scaledUnsigned(Math.hypot(relative.x, relative.y), ML_BOT_POLICY_SCALES.range)
}

function countScaled(value: number): number {
  return Math.log1p(Math.min(Math.max(0, value), ML_BOT_POLICY_SCALES.inventoryCountSaturation))
    / Math.log(ML_BOT_POLICY_SCALES.inventoryCountSaturation + 1)
}

function historyTime(ticks: number): number {
  return scaledUnsigned(
    Math.max(0, ticks) / ML_BOT_POLICY_SCALES.tickRate,
    ML_BOT_POLICY_SCALES.historySeconds,
  )
}

function statusTime(ticks: number): number {
  return scaledUnsigned(
    ticks / ML_BOT_POLICY_SCALES.tickRate,
    ML_BOT_POLICY_SCALES.statusDurationSeconds,
  )
}

function distanceSquared(left: Readonly<Vector2>, right: Readonly<Vector2>): number {
  return (left.x - right.x) ** 2 + (left.y - right.y) ** 2
}

function normalized(x: number, y: number): Vector2 {
  const length = Math.hypot(x, y)
  return length > 1e-9 ? { x: x / length, y: y / length } : { x: 0, y: 0 }
}

function ratio(value: number, maximum: number): number {
  return maximum > 0 ? Math.max(0, Math.min(1, value / maximum)) : 0
}

function scaledSigned(value: number, scale: number): number {
  return clampSigned(value / scale)
}

function scaledUnsigned(value: number, scale: number): number {
  return Math.max(0, Math.min(1, value / scale))
}

function clampSigned(value: number): number {
  return Math.max(-1, Math.min(1, value))
}
