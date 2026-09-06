import type { PlayerCharacterInput } from '../core-kernels/player-character.ts'
import { NATIVE_SKILL_CATALOG } from '../core-kernels/player-progression.ts'
import {
  getPlayerCharacter, getPlayerProgression, getPlayerSkillBook,
  selectGameSimulationPlayerSkill, type GameSimulationState,
} from '../core-server/game-simulation.ts'
import { playerEntityIndex } from '../core-server/player-entity-store.ts'
import type { ModIntent, ModIntentExecutionContext } from '../modding/runtime/index.ts'
import { decodePlayerCharacterInput } from '../protocol/codecs/input.ts'
import type { LuaConsoleObject } from '../protocol/codecs/lua.ts'
import { BoneyardEntranceNavigator } from './boneyard-entrance-navigation.ts'

const DECISION_INTERVAL_MS = 100
const INPUT_LIFETIME_MS = 250
const MAXIMUM_OBSERVATION_ROWS = 64

export function usesPlayerControlRule(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false
  if ('operation' in value && value.operation === 'rules.on' && 'fields' in value
    && value.fields !== null && typeof value.fields === 'object'
    && 'event' in value.fields && value.fields.event === 'player.control') return true
  return Object.values(value).some(usesPlayerControlRule)
}

interface ControlLease {
  readonly expiresAtMs: number
  readonly input: PlayerCharacterInput
  readonly modId: string
  readonly owner: string
}

export class ModPlayerControl {
  private readonly entrances = new Map<string, BoneyardEntranceNavigator>()
  private leases = new Map<string, ControlLease>()
  private nextDecisionAtMs = 0
  private nowMs = 0
  private runId: string | null = null

  beginFrame(state: GameSimulationState, inputs: Readonly<Record<string, PlayerCharacterInput>>, nowMs: number): string[] {
    if (!Number.isFinite(nowMs)) throw new Error('player control time must be finite')
    this.nowMs = nowMs
    const runId = state.world.kind === 'boneyard' && state.run.phase === 'active'
      ? state.run.runId : null
    if (runId !== this.runId) {
      this.clear()
      this.runId = runId
    }
    const players = runId === null ? [] : state.playerEntities.identities.flatMap(({ playerId }, index) => (
      inputs[playerId] && state.playerEntities.progressions[index]!.lifeState === 'alive'
        ? [playerId] : []
    ))
    for (const [playerId, lease] of this.leases) {
      if (!players.includes(playerId) || nowMs >= lease.expiresAtMs) this.leases.delete(playerId)
    }
    for (const playerId of this.entrances.keys()) {
      if (!players.includes(playerId)) this.entrances.delete(playerId)
    }
    if (nowMs < this.nextDecisionAtMs) return []
    this.nextDecisionAtMs = nowMs + DECISION_INTERVAL_MS
    return players
  }

  apply(inputs: Record<string, PlayerCharacterInput>): void {
    for (const [playerId, lease] of this.leases) {
      const human = inputs[playerId]
      if (!human) continue
      inputs[playerId] = { ...lease.input,
        viewportHeight: human.viewportHeight, viewportWidth: human.viewportWidth }
    }
  }

  observe(state: GameSimulationState, playerId: string): LuaConsoleObject {
    let entrance = this.entrances.get(playerId)
    if (!entrance) {
      entrance = new BoneyardEntranceNavigator()
      this.entrances.set(playerId, entrance)
    }
    const entryInput = entrance.input(state, playerId)
    return { ...modPlayerControlObservation(state, playerId),
      entry: entryInput === null ? null : { movement: { ...entryInput.movement } } }
  }

  accept(state: GameSimulationState, intent: ModIntent, context: ModIntentExecutionContext): void {
    const playerId = controlParticipant(state, context)
    const previous = this.leases.get(playerId)
    if (previous && (previous.modId !== intent.modId || previous.owner !== intent.owner)) {
      throw new Error('player input is already owned by another Lua controller')
    }
    if (intent.fields.release === true) {
      onlyFields(intent.fields, ['release'])
      this.leases.delete(playerId)
      return
    }
    onlyFields(intent.fields, ['aim', 'movement', 'primary', 'quickbar'])
    const input = decodePlayerCharacterInput({
      aim: intent.fields.aim ?? null,
      cast: { primary: intent.fields.primary ?? false, quickbar: intent.fields.quickbar ?? null },
      movement: intent.fields.movement,
      viewportHeight: 900,
      viewportWidth: 1600,
    }, 'mod player input')
    this.leases.set(playerId, { expiresAtMs: this.nowMs + INPUT_LIFETIME_MS,
      input, modId: intent.modId, owner: intent.owner })
  }

  release(playerId: string): void { this.leases.delete(playerId) }

  checkpoint(): ReadonlyMap<string, ControlLease> { return new Map(this.leases) }

  restore(checkpoint: ReadonlyMap<string, ControlLease>): void { this.leases = new Map(checkpoint) }

  clear(): void {
    this.leases.clear()
    this.entrances.clear()
    this.nextDecisionAtMs = 0
    this.runId = null
  }
}

export function selectModPlayerSkill(
  state: GameSimulationState,
  fields: LuaConsoleObject,
  context: ModIntentExecutionContext,
): GameSimulationState {
  onlyFields(fields, ['choice_index', 'offer_sequence', 'skill_id'])
  const playerId = controlParticipant(state, context)
  const selected = selectGameSimulationPlayerSkill(state, playerId, {
    choiceIndex: integer(fields.choice_index, 'choice_index'),
    offerSequence: integer(fields.offer_sequence, 'offer_sequence'),
    skillId: integer(fields.skill_id, 'skill_id'),
  })
  if (!selected) throw new Error('Lua skill choice does not match the current player offer')
  return selected
}

export function modPlayerControlObservation(state: GameSimulationState, playerId: string): LuaConsoleObject {
  if (state.world.kind !== 'boneyard') throw new Error('player control requires a Boneyard')
  const player = getPlayerCharacter(state, playerId)
  const progression = getPlayerProgression(state, playerId)
  const skillBook = getPlayerSkillBook(state, playerId)
  const offer = progression.pendingOffer
  const enemies = nearest(state.world.enemies.actors.filter(enemy => (
    enemy.currentHealth > 0 && enemy.lifeState !== 'dying'
  )), player.position)
  const loot = nearest(state.world.loot.actors, player.position)
  return {
    bounds: { ...(state.world.arenaTransition?.combatBounds ?? state.world.bounds) },
    enemies: enemies.map(enemy => ({
      id: enemy.id, health: enemy.currentHealth, maximum_health: enemy.config.maximumHealth,
      position: { ...enemy.position }, kind: enemy.config.enemyToken,
    })),
    enemy_count: state.world.enemies.actors.length,
    loot: loot.map(actor => ({ id: actor.id, kind: actor.kind, orb_kind: actor.orbKind,
      position: { ...actor.position } })),
    player: {
      id: playerId, position: { ...player.position },
      health: progression.currentHealth, maximum_health: progression.maximumHealth,
      mana: progression.currentMana, maximum_mana: progression.maximumMana,
      level: progression.level, primary_skill_id: skillBook.primarySkillId,
      offer: offer === null ? null : {
        sequence: offer.sequence,
        options: offer.options.map((option, choiceIndex) => ({
          choice_index: choiceIndex, skill_id: option.skillId, rank: option.targetRank,
          name: NATIVE_SKILL_CATALOG[option.skillId]?.name ?? '',
        })),
      },
    },
    run_id: state.run.runId,
    wave: state.world.waves?.waveOrdinal ?? 0,
  }
}

function controlParticipant(state: GameSimulationState, context: ModIntentExecutionContext): string {
  const playerId = context.context.participant_id
  if (typeof playerId !== 'string' || playerEntityIndex(state.playerEntities, playerId) < 0
    || context.scope.kind !== 'participant-run'
    || context.scope.id !== playerId + ':' + state.run.runId
    || state.world.kind !== 'boneyard' || state.run.phase !== 'active') {
    throw new Error('player control intent must belong to the active participant run')
  }
  return playerId
}

function nearest<T extends { readonly id: number; readonly position: Readonly<{ x: number; y: number }> }>(
  rows: readonly T[], center: Readonly<{ x: number; y: number }>,
): T[] {
  const distance = (row: T): number => (row.position.x - center.x) ** 2 + (row.position.y - center.y) ** 2
  return [...rows].sort((left, right) => distance(left) - distance(right) || left.id - right.id)
    .slice(0, MAXIMUM_OBSERVATION_ROWS)
}

function onlyFields(value: LuaConsoleObject, allowed: readonly string[]): void {
  const unknown = Object.keys(value).find(key => !allowed.includes(key))
  if (unknown) throw new Error('unknown player control field: ' + unknown)
}

function integer(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error('player control ' + field + ' must be a nonnegative integer')
  }
  return value
}
