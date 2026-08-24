import {
  BONEYARD_WAVE_ENEMY_TYPES,
  type BoneyardEnemySpawnIntent,
} from '../../core-kernels/boneyard-wave-director.ts'
import {
  getPlayerCharacter,
  getPlayerEconomy,
  getPlayerProgression,
  grantGameSimulationPlayerExperience,
  type GameSimulationState,
} from '../../core-server/game-simulation.ts'
import {
  grantPlayerEntityInventoryItems,
  grantPlayerEntitySkillRanks,
  grantPlayerEntityWeldBuild,
  playerEntityIndex,
  replacePlayerEconomy,
  restorePlayerEntityHealth,
  restorePlayerEntityMana,
  setPlayerEntityMana,
} from '../../core-server/player-entity-store.ts'
import type { LoadedBoneyard } from '../../core-kernels/boneyard.ts'
import type { LuaConsoleValue } from '../../protocol/game-protocol.ts'
import {
  type WebLuaCommand,
  type WebLuaEventName,
  type WebLuaFrameState,
} from './web-lua-contract.ts'
import {
  createWebLuaDeveloperGrantItems,
  webLuaDeveloperSkill,
  webLuaDeveloperWeld,
} from './web-lua-developer-grants.ts'

export interface AppliedWebLuaCommands {
  readonly enemySpawnIntents: readonly BoneyardEnemySpawnIntent[]
  readonly nextRunSeed: number | null
  readonly state: GameSimulationState
}

export interface WebLuaDerivedEvent {
  readonly name: WebLuaEventName
  readonly payload: LuaConsoleValue
}

export function createWebLuaFrameState(
  state: GameSimulationState,
  authorityPlayerId: string | null,
  loadedBoneyard: LoadedBoneyard | null,
): WebLuaFrameState {
  const players = state.playerEntities.identities.map(({ playerId }) => {
    const player = getPlayerCharacter(state, playerId)
    const progression = getPlayerProgression(state, playerId)
    const economy = getPlayerEconomy(state, playerId)
    return {
      currentHealth: progression.currentHealth,
      currentMana: progression.currentMana,
      deathTick: progression.deathTick,
      discipline: player.config.discipline,
      displayName: player.config.displayName,
      element: player.config.element,
      experience: progression.experience,
      gold: economy.gold,
      id: playerId,
      level: progression.level,
      lifeState: progression.lifeState,
      maximumHealth: progression.maximumHealth,
      maximumMana: progression.maximumMana,
      pendingLevelUp: progression.pendingOffer !== null,
      position: { ...player.position },
    }
  })
  const enemies = state.world.kind === 'boneyard'
    ? state.world.enemies.actors.map((enemy) => ({
        health: enemy.currentHealth,
        id: enemy.id,
        lifeState: enemy.lifeState,
        maximumHealth: enemy.config.maximumHealth,
        position: { ...enemy.position },
        token: enemy.config.enemyToken,
      }))
    : []
  const authorityRegion = authorityPlayerId && state.world.kind === 'hub'
    ? state.world.participants[authorityPlayerId]?.region ?? 'courtyard'
    : null
  return {
    authorityPlayerId,
    boneyardSeed: state.world.kind === 'boneyard' ? loadedBoneyard?.seed ?? null : null,
    enemies,
    multiplayer: players.length > 1,
    phase: state.run.phase,
    playerCount: players.length,
    players,
    runId: state.run.runId,
    scene: state.world.kind === 'hub'
      ? `hub.${authorityRegion ?? 'courtyard'}`
      : loadedBoneyard?.choice.name ?? 'boneyard',
    tick: state.tick,
    waves: state.world.kind === 'boneyard' && state.world.waves !== null
      ? {
          live_enemy_count: state.world.enemies.actors.length,
          pending_spawn_budget: state.world.waves.pendingSpawnBudget,
          phase: state.world.waves.phase,
          schedule_index: state.world.waves.scheduleIndex,
          wave_event_id: state.world.waves.waveEventId,
          wave_ordinal: state.world.waves.waveOrdinal,
        }
      : null,
    world: state.world.kind,
  }
}

export function applyWebLuaCommands(
  source: GameSimulationState,
  commands: readonly WebLuaCommand[],
): AppliedWebLuaCommands {
  let state = source
  let nextRunSeed: number | null = null
  const enemySpawnIntents: BoneyardEnemySpawnIntent[] = []
  for (const command of commands) {
    if ('playerId' in command && playerEntityIndex(state.playerEntities, command.playerId) < 0) {
      continue
    }
    switch (command.type) {
      case 'grant-experience':
        state = grantGameSimulationPlayerExperience(state, command.playerId, command.amount)
        break
      case 'grant-gold': {
        if (!Number.isSafeInteger(command.amount) || command.amount < 1) break
        const economy = getPlayerEconomy(state, command.playerId)
        if (economy.gold >= 10_000_000) break
        const gold = Math.min(10_000_000, economy.gold + command.amount)
        if (gold === economy.gold) break
        state = {
          ...state,
          playerEntities: replacePlayerEconomy(
            state.playerEntities,
            command.playerId,
            { ...economy, gold, revision: economy.revision + 1 },
          ),
        }
        break
      }
      case 'grant-item': {
        const items = createWebLuaDeveloperGrantItems(command.itemKey, command.quantity)
        if (!items) break
        const granted = grantPlayerEntityInventoryItems(
          state.playerEntities,
          command.playerId,
          items,
        )
        if (granted.accepted) state = { ...state, playerEntities: granted.store }
        break
      }
      case 'grant-skill': {
        const skill = webLuaDeveloperSkill(command.skillId)
        if (
          !skill
          || skill.weld_only
          || !Number.isSafeInteger(command.ranks)
          || command.ranks < 1
        ) break
        state = {
          ...state,
          playerEntities: grantPlayerEntitySkillRanks(
            state.playerEntities,
            command.playerId,
            command.skillId,
            command.ranks,
          ),
        }
        break
      }
      case 'grant-weld':
        if (!webLuaDeveloperWeld(command.buildId)) break
        state = {
          ...state,
          playerEntities: grantPlayerEntityWeldBuild(
            state.playerEntities,
            command.playerId,
            command.buildId,
          ),
        }
        break
      case 'restore-health':
        state = {
          ...state,
          playerEntities: restorePlayerEntityHealth(
            state.playerEntities,
            command.playerId,
            command.amount,
          ),
        }
        break
      case 'restore-mana':
        state = {
          ...state,
          playerEntities: restorePlayerEntityMana(
            state.playerEntities,
            command.playerId,
            command.amount,
          ),
        }
        break
      case 'set-gold': {
        const economy = getPlayerEconomy(state, command.playerId)
        state = {
          ...state,
          playerEntities: replacePlayerEconomy(
            state.playerEntities,
            command.playerId,
            { ...economy, gold: command.value, revision: economy.revision + 1 },
          ),
        }
        break
      }
      case 'set-mana':
        state = {
          ...state,
          playerEntities: setPlayerEntityMana(
            state.playerEntities,
            command.playerId,
            Math.min(
              command.value,
              getPlayerProgression(state, command.playerId).maximumMana,
            ),
          ),
        }
        break
      case 'set-next-run-seed':
        nextRunSeed = command.seed
        break
      case 'spawn-enemy':
        if (state.world.kind !== 'boneyard') break
        enemySpawnIntents.push({
          enemyToken: command.token,
          flags: [],
          id: 0x4000_0000 + command.requestId,
          locationPolicy: 'anywhere',
          nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES[command.token],
          position: { x: command.x, y: command.y },
          spawnTick: state.tick + 1,
          waveOrdinal: state.world.waves?.waveOrdinal ?? 0,
        })
        break
    }
  }
  return { enemySpawnIntents, nextRunSeed, state }
}

export function deriveWebLuaEvents(
  previous: GameSimulationState,
  current: GameSimulationState,
  includes: (name: Exclude<WebLuaEventName, 'runtime.tick'>) => boolean = () => true,
): readonly WebLuaDerivedEvent[] {
  const events: WebLuaDerivedEvent[] = []
  if (
    includes('run.started')
    && previous.run.runId !== current.run.runId
    && current.run.runId !== null
  ) {
    events.push({
      name: 'run.started',
      payload: { event: 'run.started', run_id: current.run.runId, tick: current.tick },
    })
  }
  if (
    includes('run.ended')
    && previous.run.runId !== null
    && current.run.runId === null
    && (current.run.phase === 'loadout' || current.run.phase === 'hub')
  ) {
    events.push({
      name: 'run.ended',
      payload: {
        event: 'run.ended',
        reason: previous.run.phase === 'game-over' ? 'game-over' : 'ended',
        run_id: previous.run.runId,
        tick: current.tick,
      },
    })
  }
  if (previous.world.kind === 'boneyard' && current.world.kind === 'boneyard') {
    const previousWaves = previous.world.waves
    const currentWaves = current.world.waves
    if (
      includes('wave.started')
      &&
      currentWaves !== null
      && (previousWaves === null || currentWaves.waveEventId > previousWaves.waveEventId)
    ) {
      events.push({
        name: 'wave.started',
        payload: {
          event: 'wave.started',
          tick: current.tick,
          wave_event_id: currentWaves.waveEventId,
          wave_ordinal: currentWaves.waveOrdinal,
          wave: currentWaves.waveOrdinal,
        },
      })
    }
    if (
      includes('wave.completed')
      &&
      previousWaves?.phase === 'wave-threshold'
      && currentWaves?.phase === 'wave-lull-delay'
    ) {
      events.push({
        name: 'wave.completed',
        payload: {
          event: 'wave.completed',
          tick: current.tick,
          wave: currentWaves.waveOrdinal,
          wave_ordinal: currentWaves.waveOrdinal,
        },
      })
    }
    if (includes('enemy.spawned') || includes('enemy.death')) {
      const previousEventId = previous.world.enemyEvents.at(-1)?.eventId ?? 0
      for (const event of current.world.enemyEvents) {
        if (event.eventId <= previousEventId) continue
        if (event.type !== 'enemy-spawned' && event.type !== 'enemy-death') continue
        const name = event.type === 'enemy-spawned' ? 'enemy.spawned' : 'enemy.death'
        if (!includes(name)) continue
        const actor = current.world.enemies.actors.find(({ id }) => id === event.actorId)
          ?? previous.world.enemies.actors.find(({ id }) => id === event.actorId)
        events.push({
          name,
          payload: {
            actor_id: event.actorId,
            content_id: 0,
            enemy_type: actor?.config.nativeTypeId ?? 0,
            event: name,
            event_id: event.eventId,
            target_player_id: event.targetPlayerId ?? null,
            tick: event.tick,
            x: event.sourcePosition?.x ?? actor?.position.x ?? 0,
            y: event.sourcePosition?.y ?? actor?.position.y ?? 0,
          },
        })
      }
    }
  }
  if (!includes('gold.changed') && !includes('level.up')) return events
  for (const { playerId } of current.playerEntities.identities) {
    if (playerEntityIndex(previous.playerEntities, playerId) < 0) continue
    const previousEconomy = getPlayerEconomy(previous, playerId)
    const currentEconomy = getPlayerEconomy(current, playerId)
    if (includes('gold.changed') && previousEconomy.gold !== currentEconomy.gold) {
      events.push({
        name: 'gold.changed',
        payload: {
          delta: currentEconomy.gold - previousEconomy.gold,
          event: 'gold.changed',
          gold: currentEconomy.gold,
          player_id: playerId,
          source: 'web-authority',
        },
      })
    }
    const previousProgression = getPlayerProgression(previous, playerId)
    const currentProgression = getPlayerProgression(current, playerId)
    if (includes('level.up') && currentProgression.level > previousProgression.level) {
      events.push({
        name: 'level.up',
        payload: {
          event: 'level.up',
          level: currentProgression.level,
          player_id: playerId,
          xp: currentProgression.experience,
        },
      })
    }
  }
  return events
}
