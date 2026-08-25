import {
  BONEYARD_WAVE_ENEMY_TYPES,
  type BoneyardEnemySpawnIntent,
} from '../core-kernels/boneyard-wave-director.ts'
import type { BoneyardWaveEnemyToken } from '../core-kernels/boneyard-wave-schema.ts'
import {
  GAME_TICK_RATE,
  getPlayerCharacter,
  getPlayerEconomy,
  getPlayerProgression,
  grantGameSimulationPlayerExperience,
  type GameSimulationExtensions,
  type GameSimulationModConsumption,
  type GameSimulationState,
} from '../core-server/game-simulation.ts'
import {
  grantPlayerEntityInventoryItems,
  playerEntityIndex,
  replacePlayerEconomy,
  restorePlayerEntityHealth,
  restorePlayerEntityMana,
  setPlayerEntityMana,
} from '../core-server/player-entity-store.ts'
import {
  compileModAssets,
  type PreparedModAssetCatalog,
} from '../modding/assets/index.ts'
import {
  compileModContentCatalog,
  ModPowerupEngine,
  ModSpellEngine,
  ModStatusEngine,
  modConsumableInventoryItem,
  modItemInventoryItem,
  type ModPowerupCheckpoint,
  type ModSpellCheckpoint,
  type ModStatusCheckpoint,
  type PreparedModContentCatalog,
} from '../modding/content/index.ts'
import type { ResolvedWebLuaContentReference } from '../modding/definition/index.ts'
import {
  prepareModSession,
  type ModIntent,
  type ModIntentAdapter,
  type ModIntentExecutionContext,
  type PreparedModCheckpoint,
  type PreparedModStepResult,
} from '../modding/runtime/index.ts'
import type {
  LuaConsoleObject,
  LuaConsoleValue,
  ModContentProjection,
} from '../protocol/game-protocol.ts'
import type { MaterializedWebSessionContent } from './web-mod-content.ts'
import type { WebLuaDerivedEvent } from './lua/web-lua-game-api.ts'
import {
  decodePreparedModSaveState,
  encodePreparedModSaveState,
  type PreparedModSaveState,
} from './prepared-mod-save.ts'

const MAXIMUM_PRESENTATION_INTENTS = 1_024
const SPAWN_ID_BASE = 0x5000_0000
const SPAWN_ID_RANGE = 0x0fff_ffff
const enemyTokens = new Set<string>(Object.keys(BONEYARD_WAVE_ENEMY_TYPES))

export interface PreparedModHostStateAccess {
  read(): GameSimulationState
  write(state: GameSimulationState): void
}

export interface PreparedModHostCheckpoint {
  readonly powerups: ModPowerupCheckpoint
  readonly spells: ModSpellCheckpoint
  readonly session: PreparedModCheckpoint
  readonly statuses: ModStatusCheckpoint
}

export interface PreparedModPresentationIntent {
  readonly fields: LuaConsoleObject
  readonly kind: 'emit' | 'present'
  readonly modId: string
  readonly sequence: number
  readonly tick: number
}

export interface PreparedModHost {
  readonly assets: PreparedModAssetCatalog
  readonly content: PreparedModContentCatalog
  readonly extensions: GameSimulationExtensions
  checkpoint(): PreparedModHostCheckpoint
  cast(input: Readonly<{
    contentId: string
    context?: LuaConsoleObject
    playerId: string
    requestId: number
  }>): PreparedModStepResult
  close(): void
  consume(consumption: GameSimulationModConsumption): PreparedModStepResult
  drainEnemySpawns(): readonly BoneyardEnemySpawnIntent[]
  drainPresentation(): readonly PreparedModPresentationIntent[]
  project(): ModContentProjection
  projectionRevision(): number
  restore(checkpoint: PreparedModHostCheckpoint): void
  restoreSaveState(state: PreparedModSaveState): void
  saveState(): PreparedModSaveState
  step(
    events: readonly WebLuaDerivedEvent[],
    tick: number,
    scopeId: string,
    context?: LuaConsoleObject,
  ): PreparedModStepResult
  tick(tick: number): boolean
}

export async function prepareModHost(options: Readonly<{
  content: MaterializedWebSessionContent
  log?: (message: string) => void
  state: PreparedModHostStateAccess
  wasmPath: string
}>): Promise<PreparedModHost> {
  if (options.content.modSources.length !== options.content.compiledMods.length) {
    throw new Error('admitted Web Lua source and compiled graph counts disagree')
  }
  const assets = compileModAssets({
    assets: options.content.assets,
    mods: options.content.compiledMods,
    sources: options.content.modSources,
  })
  const content = compileModContentCatalog(options.content.compiledMods, assets)
  for (const definition of content.all().filter(entry => entry.contentKind === 'boneyard')) {
    const source = definition.fields.source
    if (typeof source !== 'string' || !options.content.assets.some(asset => (
      asset.modId === definition.modId && asset.path === source && asset.kind === 'boneyard'
    ))) throw new Error(`${definition.modId}:${definition.key} Boneyard source is not packaged`)
  }
  const powerups = new ModPowerupEngine(content)
  const spells = new ModSpellEngine(content, GAME_TICK_RATE)
  const statuses = new ModStatusEngine(content, GAME_TICK_RATE)
  const enemySpawns: BoneyardEnemySpawnIntent[] = []
  const presentation: PreparedModPresentationIntent[] = []
  let closed = false
  const adapter = createHostIntentAdapter({
    content,
    enemySpawns,
    powerups,
    presentation,
    state: options.state,
    statuses,
  })
  const session = await prepareModSession({
    adapter,
    mods: options.content.modSources.map((source, index) => ({
      compiled: options.content.compiledMods[index]!,
      entryScript: source.entryScript,
      entryScriptPath: 'scripts/main.lua',
      identity: source.identity,
    })),
    wasmPath: options.wasmPath,
  })
  const requireOpen = (): void => {
    if (closed) throw new Error('prepared mod host is closed')
  }
  const report = (result: PreparedModStepResult): PreparedModStepResult => {
    for (const error of result.errors) options.log?.(error)
    return result
  }
  const extensions: GameSimulationExtensions = {
    createLootItems: ({ actorSeed, enemyToken }) => content.createLootItems(
      actorSeed,
      enemyToken === 'DEMON',
    ),
    filterDamage: input => statuses.filterDamage(input.targetPlayerId, input.amount, input.tick),
    filterMana: input => statuses.filterMana(input.playerId, input.delta, input.tick),
    hasConsumable: contentId => content.potion(contentId) !== null,
  }
  const host: PreparedModHost = {
    assets,
    content,
    extensions: Object.freeze(extensions),
    checkpoint() {
      requireOpen()
      return Object.freeze({
        powerups: powerups.checkpoint(),
        session: session.checkpoint(),
        spells: spells.checkpoint(),
        statuses: statuses.checkpoint(),
      })
    },
    cast(input) {
      requireOpen()
      const source = options.state.read()
      const spellCheckpoint = spells.checkpoint()
      const progression = getPlayerProgression(source, input.playerId)
      const admission = spells.admit(
        input.playerId,
        input.contentId,
        source.tick,
        progression.currentMana,
      )
      options.state.write({
        ...source,
        playerEntities: setPlayerEntityMana(
          source.playerEntities,
          input.playerId,
          progression.currentMana + statuses.filterMana(
            input.playerId,
            -admission.manaCost,
            source.tick,
          ),
        ),
      })
      try {
        const result = report(session.act({
          action: 'content.cast',
          context: { ...input.context, participant_id: input.playerId },
          event: 'spell.cast',
          payload: { content_id: input.contentId, participant_id: input.playerId },
          requestId: input.requestId,
          scope: {
            id: `${input.playerId}:${source.run.runId ?? 'profile'}`,
            kind: 'participant-run',
          },
          tick: source.tick,
        }))
        if (!result.accepted) {
          options.state.write(source)
          spells.restore(spellCheckpoint)
        }
        return result
      } catch (error) {
        options.state.write(source)
        spells.restore(spellCheckpoint)
        throw error
      }
    },
    close() {
      if (closed) return
      closed = true
      enemySpawns.length = 0
      presentation.length = 0
      session.close()
    },
    consume(consumption) {
      requireOpen()
      if (!content.potion(consumption.content.contentId)) {
        throw new Error(`consumed mod content is unavailable: ${consumption.content.contentId}`)
      }
      return report(session.act({
        action: 'content.use',
        context: {
          content_id: consumption.content.contentId,
          participant_id: consumption.playerId,
          use_id: consumption.useId,
        },
        event: 'item.consumed',
        payload: {
          content_id: consumption.content.contentId,
          duration_ms: consumption.content.durationMs,
          participant_id: consumption.playerId,
          use_id: consumption.useId,
        },
        requestId: consumption.useId,
        scope: {
          id: `${consumption.playerId}:${options.state.read().run.runId ?? 'profile'}`,
          kind: 'participant-run',
        },
        tick: consumption.tick,
      }))
    },
    drainEnemySpawns() {
      requireOpen()
      return Object.freeze(enemySpawns.splice(0))
    },
    drainPresentation() {
      requireOpen()
      return Object.freeze(presentation.splice(0))
    },
    project() {
      requireOpen()
      return Object.freeze({
        content: Object.freeze(content.all().map(entry => Object.freeze({
          art: Object.freeze(Object.entries(entry.art)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([slot, art]) => Object.freeze({
              path: art.path,
              slot,
            }))),
          contentId: entry.contentId,
          contentKind: entry.contentKind,
          description: entry.description,
          key: entry.key,
          modId: entry.modId,
          name: entry.name,
          presentation: entry.contentKind === 'ui'
            && entry.fields.view
            && typeof entry.fields.view === 'object'
            && !Array.isArray(entry.fields.view)
            && 'operation' in entry.fields.view
            && typeof entry.fields.view.operation === 'string'
            ? entry.fields.view.operation
            : null,
        }))),
        manifestSha256: options.content.manifest.manifestSha256,
        powerups: Object.freeze(powerups.project().map(({ modId: _modId, ...powerup }) => powerup)),
        revision: statuses.revision + powerups.revision,
        statuses: Object.freeze(statuses.project().map(({ modId: _modId, ...status }) => status)),
      })
    },
    projectionRevision() {
      requireOpen()
      return statuses.revision + powerups.revision
    },
    restore(checkpoint) {
      requireOpen()
      const previous = host.checkpoint()
      try {
        powerups.restore(checkpoint.powerups)
        spells.restore(checkpoint.spells)
        statuses.restore(checkpoint.statuses)
        session.restore(checkpoint.session)
      } catch (error) {
        powerups.restore(previous.powerups)
        spells.restore(previous.spells)
        statuses.restore(previous.statuses)
        session.restore(previous.session)
        throw error
      }
    },
    restoreSaveState(state) {
      host.restore(decodePreparedModSaveState(options.content.compiledMods, state))
    },
    saveState() {
      return encodePreparedModSaveState(options.content.compiledMods, host.checkpoint())
    },
    step(events, tick, scopeId, context = {}) {
      requireOpen()
      return report(session.step({
        events: events.map(event => ({
          context: Object.freeze({ ...context, event: event.name }),
          event: event.name,
          payload: event.payload,
          scope: { id: scopeId, kind: 'party-run' },
        })),
        tick,
      }))
    },
    tick(tick) {
      requireOpen()
      const revision = statuses.revision + powerups.revision
      statuses.tick(tick)
      const state = options.state.read()
      const players = state.playerEntities.identities.map(({ playerId }, index) => ({
        id: playerId,
        x: state.playerEntities.locomotions[index]!.position.x,
        y: state.playerEntities.locomotions[index]!.position.y,
      }))
      for (const candidate of powerups.candidates(players)) {
        const result = session.act({
          action: 'content.pickup',
          context: { participant_id: candidate.playerId, powerup_id: candidate.instance.id },
          event: 'powerup.collected',
          payload: {
            content_id: candidate.instance.contentId,
            participant_id: candidate.playerId,
            powerup_id: candidate.instance.id,
          },
          requestId: candidate.instance.id,
          scope: {
            id: `${candidate.playerId}:${state.run.runId ?? 'profile'}`,
            kind: 'participant-run',
          },
          tick,
        })
        if (result.accepted) powerups.collect(candidate.instance.id, candidate.playerId)
      }
      return statuses.revision + powerups.revision !== revision
    },
  }
  return Object.freeze(host)
}

function createHostIntentAdapter(options: Readonly<{
  content: PreparedModContentCatalog
  enemySpawns: BoneyardEnemySpawnIntent[]
  powerups: ModPowerupEngine
  presentation: PreparedModPresentationIntent[]
  state: PreparedModHostStateAccess
  statuses: ModStatusEngine
}>): ModIntentAdapter {
  return {
    prepare(intents, context) {
      const source = options.state.read()
      const statusCheckpoint = options.statuses.checkpoint()
      const powerupCheckpoint = options.powerups.checkpoint()
      let candidate = source
      const spawns: BoneyardEnemySpawnIntent[] = []
      const projected: PreparedModPresentationIntent[] = []
      try {
        for (const intent of intents) {
          const result = applyIntent(
            candidate,
            intent,
            context,
            options.content,
            options.statuses,
            options.powerups,
          )
          candidate = result.state
          if (result.spawn) spawns.push(result.spawn)
          if (result.presentation) projected.push(result.presentation)
        }
      } catch (error) {
        options.statuses.restore(statusCheckpoint)
        options.powerups.restore(powerupCheckpoint)
        throw error
      }
      let committed = false
      return {
        commit() {
          if (options.state.read() !== source) throw new Error('authoritative game state changed during a mod transaction')
          if (options.presentation.length + projected.length > MAXIMUM_PRESENTATION_INTENTS) {
            throw new Error('pending mod presentation intent limit reached')
          }
          options.state.write(candidate)
          options.enemySpawns.push(...spawns)
          options.presentation.push(...projected)
          committed = true
        },
        rollback() {
          options.statuses.restore(statusCheckpoint)
          options.powerups.restore(powerupCheckpoint)
          if (!committed) return
          options.state.write(source)
          options.enemySpawns.splice(Math.max(0, options.enemySpawns.length - spawns.length), spawns.length)
          options.presentation.splice(Math.max(0, options.presentation.length - projected.length), projected.length)
        },
      }
    },
  }
}

function applyIntent(
  source: GameSimulationState,
  intent: ModIntent,
  context: ModIntentExecutionContext,
  content: PreparedModContentCatalog,
  statuses: ModStatusEngine,
  powerups: ModPowerupEngine,
): Readonly<{
  presentation: PreparedModPresentationIntent | null
  spawn: BoneyardEnemySpawnIntent | null
  state: GameSimulationState
}> {
  switch (intent.kind) {
    case 'resource':
      return outcome(applyResource(source, intent.fields, context))
    case 'grant':
      return outcome(applyGrant(source, intent.fields, context, content))
    case 'status': {
      const targetId = targetPlayer(source, intent.fields.target, context)
      const reference = contentReference(intent.fields.status, 'status', `${intent.modId}:${intent.owner} status`)
      statuses.apply(reference.contentId, targetId, context.tick)
      return outcome(source)
    }
    case 'spawn':
      return spawnOutcome(source, intent, context, powerups)
    case 'emit':
    case 'present':
      return outcome(source, null, Object.freeze({
        fields: intent.fields,
        kind: intent.kind,
        modId: intent.modId,
        sequence: intent.sequence,
        tick: context.tick,
      }))
    default:
      throw new Error(`unsupported Web Lua intent: ${intent.kind}`)
  }
}

function applyResource(
  source: GameSimulationState,
  fields: LuaConsoleObject,
  context: ModIntentExecutionContext,
): GameSimulationState {
  const playerId = targetPlayer(source, fields.target, context)
  let state = source
  if (fields.health !== undefined) {
    const progression = getPlayerProgression(state, playerId)
    const amount = fields.health === 'full'
      ? progression.maximumHealth - progression.currentHealth
      : nonnegative(fields.health, 'resource health')
    state = { ...state, playerEntities: restorePlayerEntityHealth(state.playerEntities, playerId, amount) }
  }
  if (fields.mana !== undefined) {
    const progression = getPlayerProgression(state, playerId)
    state = {
      ...state,
      playerEntities: fields.mana === 'full'
        ? setPlayerEntityMana(state.playerEntities, playerId, progression.maximumMana)
        : restorePlayerEntityMana(state.playerEntities, playerId, nonnegative(fields.mana, 'resource mana')),
    }
  }
  if (fields.gold !== undefined) {
    const amount = integer(fields.gold, 0, 10_000_000, 'resource gold')
    const economy = getPlayerEconomy(state, playerId)
    const gold = Math.min(10_000_000, economy.gold + amount)
    state = {
      ...state,
      playerEntities: replacePlayerEconomy(state.playerEntities, playerId, {
        ...economy,
        gold,
        revision: economy.revision + Number(gold !== economy.gold),
      }),
    }
  }
  if (fields.experience !== undefined) {
    state = grantGameSimulationPlayerExperience(
      state,
      playerId,
      nonnegative(fields.experience, 'resource experience'),
    )
  }
  return state
}

function applyGrant(
  source: GameSimulationState,
  fields: LuaConsoleObject,
  context: ModIntentExecutionContext,
  content: PreparedModContentCatalog,
): GameSimulationState {
  const playerId = targetPlayer(source, fields.target, context)
  const reference = resolvedContentReference(fields.item, 'grant item')
  const quantity = fields.quantity === undefined ? 1 : integer(fields.quantity, 1, 99, 'grant quantity')
  const definition = reference.targetKind === 'potion'
    ? content.potion(reference.contentId)
    : reference.targetKind === 'item'
      ? content.item(reference.contentId)
      : null
  if (!definition) throw new Error(`grant item is unavailable: ${reference.contentId}`)
  const item = definition.contentKind === 'potion'
    ? { ...modConsumableInventoryItem(definition.catalog), quantity }
    : modItemInventoryItem(definition.catalog, quantity)
  const granted = grantPlayerEntityInventoryItems(source.playerEntities, playerId, [item])
  if (!granted.accepted) throw new Error(`inventory cannot accept ${definition.modId}:${definition.key}`)
  return { ...source, playerEntities: granted.store }
}

function spawnOutcome(
  source: GameSimulationState,
  intent: ModIntent,
  context: ModIntentExecutionContext,
  powerups: ModPowerupEngine,
) {
  const content = intent.fields.content ?? intent.fields.powerup
  if (content !== undefined) {
    const reference = resolvedContentReference(content, 'spawn content')
    if (reference.targetKind !== 'powerup') {
      throw new Error('spawn content must reference a powerup')
    }
    const position = intentPosition(source, intent.fields, context)
    powerups.spawn(reference.contentId, position.x, position.y, context.tick)
    return outcome(source)
  }
  return outcome(source, spawnIntent(source, intent, context))
}

function spawnIntent(
  source: GameSimulationState,
  intent: ModIntent,
  context: ModIntentExecutionContext,
): BoneyardEnemySpawnIntent {
  if (source.world.kind !== 'boneyard') throw new Error('enemy spawn requires an active Boneyard')
  const tokenValue = intent.fields.token ?? intent.fields.enemy
  if (typeof tokenValue !== 'string' || !enemyTokens.has(tokenValue)) {
    throw new Error('enemy spawn currently requires a stock enemy token')
  }
  const token = tokenValue as BoneyardWaveEnemyToken
  const position = intentPosition(source, intent.fields, context)
  return Object.freeze({
    enemyToken: token,
    flags: Object.freeze([]),
    id: SPAWN_ID_BASE + intent.sequence % SPAWN_ID_RANGE,
    locationPolicy: 'anywhere' as const,
    nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES[token],
    position,
    spawnTick: source.tick + 1,
    waveOrdinal: source.world.waves?.waveOrdinal ?? 0,
  })
}

function intentPosition(
  source: GameSimulationState,
  fields: LuaConsoleObject,
  context: ModIntentExecutionContext,
): Readonly<{ x: number; y: number }> {
  const authority = context.context.participant_id
  const player = typeof authority === 'string' && playerEntityIndex(source.playerEntities, authority) >= 0
    ? getPlayerCharacter(source, authority)
    : null
  return Object.freeze({
    x: finite(fields.x, player?.position.x ?? 0, 'spawn x'),
    y: finite(fields.y, player?.position.y ?? 0, 'spawn y'),
  })
}

function targetPlayer(
  state: GameSimulationState,
  value: LuaConsoleValue | undefined,
  context: ModIntentExecutionContext,
): string {
  const contextual = context.context.participant_id
  const playerId = value === undefined || value === 'user' || value === 'collector' || value === 'caster'
    ? contextual
    : typeof value === 'string'
      ? value
      : value && typeof value === 'object' && !Array.isArray(value)
        ? (value as LuaConsoleObject).participant_id ?? (value as LuaConsoleObject).id
        : null
  if (typeof playerId !== 'string' || playerEntityIndex(state.playerEntities, playerId) < 0) {
    throw new Error('mod intent target player is unavailable')
  }
  return playerId
}

function contentReference(
  value: LuaConsoleValue | undefined,
  targetKind: ResolvedWebLuaContentReference['targetKind'],
  field: string,
): ResolvedWebLuaContentReference {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      (value as LuaConsoleObject).kind !== 'resolved-content-reference' ||
      (value as LuaConsoleObject).targetKind !== targetKind ||
      typeof (value as LuaConsoleObject).contentId !== 'string') {
    throw new Error(`${field} must be a resolved ${targetKind} reference`)
  }
  return value as unknown as ResolvedWebLuaContentReference
}

function resolvedContentReference(
  value: LuaConsoleValue | undefined,
  field: string,
): ResolvedWebLuaContentReference {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      (value as LuaConsoleObject).kind !== 'resolved-content-reference' ||
      typeof (value as LuaConsoleObject).targetKind !== 'string' ||
      typeof (value as LuaConsoleObject).contentId !== 'string') {
    throw new Error(`${field} must be a resolved content reference`)
  }
  return value as unknown as ResolvedWebLuaContentReference
}

function outcome(
  state: GameSimulationState,
  spawn: BoneyardEnemySpawnIntent | null = null,
  presentation: PreparedModPresentationIntent | null = null,
) {
  return Object.freeze({ presentation, spawn, state })
}

function integer(value: unknown, minimum: number, maximum: number, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new Error(`${field} must be an integer within ${minimum}..${maximum}`)
  }
  return Number(value)
}

function nonnegative(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be a nonnegative finite number`)
  }
  return value
}

function finite(value: unknown, fallback: number, field: string): number {
  if (value === undefined) return fallback
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${field} must be finite`)
  return value
}
