import type {
  GameSimulationDamageFilterInput,
  GameSimulationExtensions,
  GameSimulationManaFilterInput,
  GameSimulationModConsumption,
} from '../../core-server/game-simulation.ts'
import type { LuaConsoleObject } from '../../protocol/game-protocol.ts'
import type { WebLuaContentRegistry } from './web-lua-content-registry.ts'
import type { WebLuaRuntime } from './web-lua-runtime.ts'

export function createWebLuaGameExtensions(
  content: WebLuaContentRegistry,
  runtimes: readonly WebLuaRuntime[],
): GameSimulationExtensions {
  return Object.freeze({
    createLootItems: (input: Parameters<GameSimulationExtensions['createLootItems']>[0]) => (
      content.createLootItems(input.actorSeed, input.enemyToken)
    ),
    filterDamage: (input: GameSimulationDamageFilterInput) => filterDamage(runtimes, input),
    filterMana: (input: GameSimulationManaFilterInput) => filterMana(runtimes, input),
    hasConsumable: (contentId: string) => content.consumable(contentId) !== null,
  })
}

export function dispatchWebLuaConsumption(
  content: WebLuaContentRegistry,
  runtimes: readonly WebLuaRuntime[],
  consumption: GameSimulationModConsumption,
): void {
  const payload: LuaConsoleObject = {
    content_id: consumption.content.contentId,
    duration_ms: consumption.content.durationMs,
    event: 'item.consumed',
    key: consumption.content.key,
    local_owner: true,
    mod_id: consumption.content.modId,
    participant_id: consumption.playerId,
    use_id: consumption.useId,
  }
  for (const runtime of runtimes) {
    runtime.dispatch('item.consumed', payload, consumption.playerId)
  }
  content.invokeOwnerConsume(
    consumption.content.contentId,
    payload,
    consumption.playerId,
  )
}

function filterDamage(
  runtimes: readonly WebLuaRuntime[],
  input: GameSimulationDamageFilterInput,
): number {
  const lanes = [
    input.damageKind === 'physical' || input.damageKind === 'poison' ? input.amount : 0,
    input.damageKind === 'magic' ? input.amount : 0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
  ]
  let payload: LuaConsoleObject = {
    event: 'damage.taken',
    flags: 0,
    lanes,
    magic_damage: lanes[1]!,
    projectile_damage: lanes[0]!,
    source_actor_id: input.sourceActorId,
    source_participant_id: null,
    target_actor_id: input.targetPlayerId,
    target_participant_id: input.targetPlayerId,
    total_damage: input.amount,
  }
  for (const runtime of runtimes) {
    const outcome = runtime.applyFilter('damage.taken', payload, input.targetPlayerId)
    if (outcome.canceled) return 0
    payload = outcome.payload
  }
  const total = payload.total_damage
  if (typeof total !== 'number' || !Number.isFinite(total)) {
    throw new Error('Lua damage filter produced an invalid total')
  }
  return Math.max(0, total)
}

function filterMana(
  runtimes: readonly WebLuaRuntime[],
  input: GameSimulationManaFilterInput,
): number {
  let payload: LuaConsoleObject = {
    allow_prompt: false,
    current_mana: input.currentMana,
    delta: input.delta,
    event: 'mana.changing',
    maximum_mana: input.maximumMana,
    participant_id: input.playerId,
    resulting_mana: input.currentMana + input.delta,
    source: input.source,
  }
  for (const runtime of runtimes) {
    const outcome = runtime.applyFilter('mana.changing', payload, input.playerId)
    if (outcome.canceled) return 0
    payload = outcome.payload
  }
  const delta = payload.delta
  if (typeof delta !== 'number' || !Number.isFinite(delta)) {
    throw new Error('Lua mana filter produced an invalid delta')
  }
  return delta
}
