import {
  damageBoneyardEnemy,
} from '../core-server/boneyard-enemy-store.ts'
import {
  resolveBoneyardMovement,
  resolveBoneyardSpawnPosition,
  withBoneyardGateCollision,
} from '../core-server/boneyard-collision.ts'
import {
  BONEYARD_WAVE_ENEMY_TYPES,
  type BoneyardEnemySpawnIntent,
} from '../core-kernels/boneyard-wave-director.ts'
import { isBoneyardPlayerCombatEnabled } from '../core-kernels/boneyard-encounter.ts'
import type { BoneyardWaveEnemyToken } from '../core-kernels/boneyard-wave-schema.ts'
import {
  findInventoryItem,
  reforgeModEquipment,
} from '../core-kernels/hub-economy.ts'
import {
  GAME_TICK_RATE,
  getPlayerCharacter,
  getPlayerEconomy,
  getPlayerProgression,
  grantGameSimulationPlayerExperience,
  replaceGameSimulationPlayerSkillWithMod,
  type GameSimulationExtensions,
  type GameSimulationModConsumption,
  type GameSimulationState,
} from '../core-server/game-simulation.ts'
import {
  creditPlayerEntityLootGold,
  damagePlayerEntity,
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
  type PreparedModSpriteAsset,
} from '../modding/assets/index.ts'
import {
  compileModContentCatalog,
  ModAffixEngine,
  ModEnemyEngine,
  ModPortalEngine,
  ModPowerupEngine,
  ModSceneEngine,
  ModSemanticStateEngine,
  ModShopEngine,
  ModSkillEngine,
  ModSpellEngine,
  ModSpellEffectEngine,
  ModStatusEngine,
  modConsumableInventoryItem,
  modItemInventoryItem,
  type ModEnemyCheckpoint,
  type ActiveModEnemy,
  type ModPowerupCheckpoint,
  type ActiveModPowerup,
  type ModPowerupCollectionEvent,
  type ModSceneCheckpoint,
  type ModSemanticStateCheckpoint,
  type ModShopCheckpoint,
  type ModSkillCheckpoint,
  type ModSpellCheckpoint,
  type ModSpellEffectCheckpoint,
  type ModStatusCheckpoint,
  type ActiveModSpellEffect,
  type ActiveModScene,
  type PreparedModContentCatalog,
  type PreparedModUiDefinition,
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
  readonly enemies: ModEnemyCheckpoint
  readonly powerups: ModPowerupCheckpoint
  readonly scenes: ModSceneCheckpoint
  readonly semanticState: ModSemanticStateCheckpoint
  readonly shops: ModShopCheckpoint
  readonly skills: ModSkillCheckpoint
  readonly spells: ModSpellCheckpoint
  readonly spellEffects: ModSpellEffectCheckpoint
  readonly session: PreparedModCheckpoint
  readonly statuses: ModStatusCheckpoint
}

export interface PreparedModPresentationIntent {
  readonly fields: LuaConsoleObject
  readonly kind: 'present'
  readonly modId: string
  readonly sequence: number
  readonly tick: number
}

export interface PreparedModHost {
  readonly assets: PreparedModAssetCatalog
  readonly content: PreparedModContentCatalog
  readonly extensions: GameSimulationExtensions
  activeScene(ownerId: string): ActiveModScene | null
  activateBoneyard(contentId: string | null, restoreExisting?: boolean): void
  bindModQuickbar(playerId: string, slot: number, contentId: string | null): void
  checkpoint(): PreparedModHostCheckpoint
  cast(input: Readonly<{
    contentId: string
    context?: LuaConsoleObject
    playerId: string
    requestId: number
  }>): PreparedModStepResult
  chooseSkill(
    playerId: string,
    contentId: string,
    modOfferSequence: number,
    nativeOfferSequence: number,
  ): void
  close(): void
  consume(consumption: GameSimulationModConsumption): PreparedModStepResult
  drainEnemySpawns(): readonly BoneyardEnemySpawnIntent[]
  drainPresentation(): readonly PreparedModPresentationIntent[]
  project(): ModContentProjection
  projectionRevision(): number
  purchaseShop(playerId: string, shopContentId: string, row: number): void
  reforgeShop(playerId: string, shopContentId: string, service: number, itemId: number): void
  restore(checkpoint: PreparedModHostCheckpoint): void
  restoreSaveState(state: PreparedModSaveState): void
  returnScene(ownerId: string): ActiveModScene | null
  runtimeProjection(viewerId?: string): Readonly<{ projection: LuaConsoleObject; revision: number }>
  saveState(): PreparedModSaveState
  selectSceneRoom(ownerId: string, roomIndex: number): ActiveModScene
  enterPortal(input: Readonly<{
    actorKind: string
    confirmedByLeader: boolean
    ownerId: string
    playerId: string
    portalId: string
    scene: string
  }>): void
  step(
    events: readonly WebLuaDerivedEvent[],
    tick: number,
    scopeId: string,
    context?: LuaConsoleObject,
  ): PreparedModStepResult
  tick(tick: number): boolean
  uiAction(input: Readonly<{
    action: string
    arguments: LuaConsoleObject
    contentId: string
    playerId: string
    requestId: number
  }>): PreparedModStepResult
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
  const affixes = new ModAffixEngine(content)
  const enemies = new ModEnemyEngine(content, GAME_TICK_RATE)
  const scenes = new ModSceneEngine(content)
  const semanticState = new ModSemanticStateEngine(
    options.content.compiledMods.map(mod => mod.identity.id),
  )
  const portals = new ModPortalEngine(content, scenes)
  const shops = new ModShopEngine(content, GAME_TICK_RATE)
  const skills = new ModSkillEngine(content)
  const spells = new ModSpellEngine(content, GAME_TICK_RATE)
  const spellEffects = new ModSpellEffectEngine(GAME_TICK_RATE)
  const statuses = new ModStatusEngine(content, GAME_TICK_RATE)
  const enemySpawns: BoneyardEnemySpawnIntent[] = []
  const presentation: PreparedModPresentationIntent[] = []
  const reportedEnemyHealth = new Map<number, number>()
  let activeBoneyardContentId: string | null = null
  let closed = false
  const adapter = createHostIntentAdapter({
    content,
    enemies,
    enemySpawns,
    powerups,
    presentation,
    scenes,
    semanticState,
    skills,
    spellEffects,
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
  const initialized = session.step({
    events: [{
      context: {},
      event: 'session.started',
      payload: { event: 'session.started' },
      scope: { id: 'session', kind: 'session' },
    }],
    tick: options.state.read().tick,
  })
  for (const error of initialized.errors) options.log?.(error)
  if (!initialized.accepted) {
    session.close()
    throw new Error(initialized.errors.join('; ') || 'Web Lua session initialization failed')
  }
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
    filterDamage: input => filterEquipmentModifiers(
      options.state.read(),
      input.targetPlayerId,
      'incoming_damage',
      skills.filter(
        input.targetPlayerId,
        'incoming_damage',
        statuses.filterDamage(input.targetPlayerId, input.amount, input.tick),
      ),
    ),
    filterMana: input => {
      const filtered = statuses.filterMana(input.playerId, input.delta, input.tick)
      return filtered >= 0 ? filtered : -filterEquipmentModifiers(
        options.state.read(),
        input.playerId,
        'mana_spend',
        skills.filter(input.playerId, 'mana_spend', -filtered),
      )
    },
    hasConsumable: contentId => content.potion(contentId) !== null,
  }
  const host: PreparedModHost = {
    assets,
    content,
    extensions: Object.freeze(extensions),
    activeScene(ownerId) {
      requireOpen()
      return scenes.project().find(scene => scene.ownerId === ownerId) ?? null
    },
    activateBoneyard(contentId, restoreExisting = false) {
      requireOpen()
      reportedEnemyHealth.clear()
      if (restoreExisting) {
        if (contentId !== null && !content.boneyard(contentId)) {
          throw new Error('restored Web Lua Boneyard is unavailable')
        }
        activeBoneyardContentId = contentId
        return
      }
      const checkpoint = enemies.checkpoint()
      const spawnCount = enemySpawns.length
      try {
        enemies.clear()
        activeBoneyardContentId = contentId
        if (contentId !== null) spawnBoneyardRoster(
          contentId,
          content,
          enemies,
          enemySpawns,
          options.state.read(),
          options.state.read().tick,
        )
      } catch (error) {
        enemies.restore(checkpoint)
        enemySpawns.splice(spawnCount)
        activeBoneyardContentId = null
        throw error
      }
    },
    bindModQuickbar(playerId, slot, contentId) {
      requireOpen()
      skills.bind(playerId, slot, contentId)
    },
    checkpoint() {
      requireOpen()
      return Object.freeze({
        enemies: enemies.checkpoint(),
        powerups: powerups.checkpoint(),
        scenes: scenes.checkpoint(),
        semanticState: semanticState.checkpoint(),
        session: session.checkpoint(),
        shops: shops.checkpoint(),
        skills: skills.checkpoint(),
        spells: spells.checkpoint(),
        spellEffects: spellEffects.checkpoint(),
        statuses: statuses.checkpoint(),
      })
    },
    cast(input) {
      requireOpen()
      const source = options.state.read()
      if (!skills.spellUnlocked(input.playerId, input.contentId)) {
        throw new Error('mod spell has not been unlocked')
      }
      const spellCheckpoint = spells.checkpoint()
      const progression = getPlayerProgression(source, input.playerId)
      const spell = content.spell(input.contentId)
      if (!spell) throw new Error('mod spell is unavailable')
      const statusDelta = statuses.filterMana(input.playerId, -spell.mana, source.tick)
      const manaCost = statusDelta >= 0 ? 0 : filterEquipmentModifiers(
        source,
        input.playerId,
        'mana_spend',
        skills.filter(input.playerId, 'mana_spend', -statusDelta),
      )
      const admission = spells.admit(
        input.playerId,
        input.contentId,
        source.tick,
        progression.currentMana,
        manaCost,
      )
      options.state.write({
        ...source,
        playerEntities: setPlayerEntityMana(
          source.playerEntities,
          input.playerId,
          progression.currentMana - admission.manaCost,
        ),
      })
      try {
        const result = report(session.act({
          action: 'content.cast',
          context: { ...input.context, participant_id: input.playerId },
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
    chooseSkill(playerId, contentId, modOfferSequence, nativeOfferSequence) {
      requireOpen()
      const source = options.state.read()
      const checkpoint = skills.checkpoint()
      try {
        skills.choose(playerId, contentId, modOfferSequence)
        const selected = replaceGameSimulationPlayerSkillWithMod(
          source,
          playerId,
          nativeOfferSequence,
        )
        if (!selected) throw new Error('native skill offer is stale')
        options.state.write(selected)
        const progression = getPlayerProgression(selected, playerId)
        if (progression.pendingOffer) {
          skills.offer(playerId, progression.level, progression.pendingOffer.sequence)
        }
      } catch (error) {
        skills.restore(checkpoint)
        options.state.write(source)
        throw error
      }
    },
    close() {
      if (closed) return
      closed = true
      enemySpawns.length = 0
      presentation.length = 0
      reportedEnemyHealth.clear()
      activeBoneyardContentId = null
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
        revision: statuses.revision + powerups.revision + skills.revision
          + semanticState.revision + spellEffects.revision,
        statuses: Object.freeze(statuses.project().map(({ modId: _modId, ...status }) => status)),
      })
    },
    projectionRevision() {
      requireOpen()
      return statuses.revision + powerups.revision + skills.revision
        + semanticState.revision + spellEffects.revision
    },
    purchaseShop(playerId, shopContentId, row) {
      requireOpen()
      const source = options.state.read()
      const shopCheckpoint = shops.checkpoint()
      const economy = getPlayerEconomy(source, playerId)
      const purchase = shops.purchase(playerId, shopContentId, row, economy.gold, source.tick)
      const definition = content.item(purchase.itemContentId) ?? content.potion(purchase.itemContentId)
      if (!definition) {
        shops.restore(shopCheckpoint)
        throw new Error('mod shop item is unavailable')
      }
      const item = definition.contentKind === 'item'
        ? modItemInventoryItem(definition.catalog, purchase.quantity)
        : { ...modConsumableInventoryItem(definition.catalog), quantity: purchase.quantity }
      const debited = replacePlayerEconomy(source.playerEntities, playerId, {
        ...economy,
        gold: economy.gold - purchase.price,
        revision: economy.revision + 1,
      })
      const granted = grantPlayerEntityInventoryItems(debited, playerId, [item])
      if (!granted.accepted) {
        shops.restore(shopCheckpoint)
        throw new Error('inventory cannot accept the mod shop purchase')
      }
      options.state.write({ ...source, playerEntities: granted.store })
      const result = report(session.act({
        action: 'shop.purchase',
        context: {
          participant_id: playerId,
          shop_content_id: shopContentId,
        },
        payload: {
          item_content_id: purchase.itemContentId,
          participant_id: playerId,
          price: purchase.price,
          quantity: purchase.quantity,
          row: purchase.row,
          shop_content_id: shopContentId,
        },
        requestId: shops.revision,
        scope: { id: playerId, kind: 'participant-profile' },
        tick: source.tick,
      }))
      if (!result.accepted) {
        shops.restore(shopCheckpoint)
        options.state.write(source)
        throw new Error(result.errors.join('; ') || 'mod shop purchase rule failed')
      }
    },
    reforgeShop(playerId, shopContentId, serviceIndex, itemId) {
      requireOpen()
      const source = options.state.read()
      const economy = getPlayerEconomy(source, playerId)
      const service = content.shop(shopContentId)?.services[serviceIndex]
      const item = findInventoryItem(economy.backpack, itemId)
      if (!service || !item?.equipmentType || economy.gold < service.price) {
        throw new Error('mod reforge service is unavailable')
      }
      const rolls = affixes.roll(service.pool.contentId, item.equipmentType, (
        source.tick ^ item.id ^ Number(BigInt(service.pool.contentId) & 0xffff_ffffn)
      ) >>> 0)
      const materialized = rolls.map(roll => {
        const definition = content.affix(roll.contentId)!
        return Object.freeze({
          contentId: roll.contentId,
          modId: definition.modId,
          modifiers: Object.freeze(Object.entries(roll.modifiers).flatMap(([key, value]) => {
            if (typeof value === 'number' && Number.isFinite(value)) {
              return [{ key, operation: 'multiply' as const, value }]
            }
            if (!value || typeof value !== 'object' || Array.isArray(value)) return []
            return Object.entries(value).flatMap(([operation, amount]) => (
              (operation === 'add' || operation === 'multiply' || operation === 'set')
              && typeof amount === 'number' && Number.isFinite(amount)
                ? [{
                    key,
                    operation: operation as 'add' | 'multiply' | 'set',
                    value: amount,
                  }]
                : []
            ))
          })),
          name: roll.name,
        })
      })
      if (materialized.length === 0) throw new Error('mod reforge produced no applicable affix')
      const reforged = reforgeModEquipment(economy, itemId, materialized)
      if (!reforged.accepted) throw new Error('mod reforge item is invalid')
      options.state.write({
        ...source,
        playerEntities: replacePlayerEconomy(source.playerEntities, playerId, {
          ...reforged.state,
          gold: reforged.state.gold - service.price,
          revision: reforged.state.revision + 1,
        }),
      })
    },
    restore(checkpoint) {
      requireOpen()
      const previous = host.checkpoint()
      try {
        if (checkpoint.spellEffects.effects.some(effect => !content.spell(effect.contentId))) {
          throw new Error('mod spell effect checkpoint references unavailable content')
        }
        enemies.restore(checkpoint.enemies)
        powerups.restore(checkpoint.powerups)
        scenes.restore(checkpoint.scenes)
        semanticState.restore(checkpoint.semanticState)
        shops.restore(checkpoint.shops)
        skills.restore(checkpoint.skills)
        spells.restore(checkpoint.spells)
        spellEffects.restore(checkpoint.spellEffects)
        statuses.restore(checkpoint.statuses)
        session.restore(checkpoint.session)
        reportedEnemyHealth.clear()
      } catch (error) {
        enemies.restore(previous.enemies)
        powerups.restore(previous.powerups)
        scenes.restore(previous.scenes)
        semanticState.restore(previous.semanticState)
        shops.restore(previous.shops)
        skills.restore(previous.skills)
        spells.restore(previous.spells)
        spellEffects.restore(previous.spellEffects)
        statuses.restore(previous.statuses)
        session.restore(previous.session)
        throw error
      }
    },
    restoreSaveState(state) {
      host.restore(decodePreparedModSaveState(options.content.compiledMods, state))
    },
    returnScene(ownerId) {
      requireOpen()
      return scenes.return(ownerId)
    },
    runtimeProjection(viewerId) {
      requireOpen()
      const checkpoint = host.checkpoint()
      const runtimeTick = options.state.read().tick
      const projection: LuaConsoleObject = {
        active_boneyard: activeBoneyardContentId === null ? null : {
          anchors: content.boneyard(activeBoneyardContentId)!.anchors as unknown as LuaConsoleObject,
          content_id: activeBoneyardContentId,
          environment: content.boneyard(activeBoneyardContentId)!.environment as unknown as LuaConsoleObject,
        },
        audio_loops: projectModAudioLoops(
          activeBoneyardContentId,
          checkpoint,
          content,
          assets,
        ),
        enemies: checkpoint.enemies.enemies.map(enemy => projectModEnemy(
          enemy,
          content,
          assets,
          runtimeTick,
        )),
        portals: portals.portals().map(portal => ({
          id: portal.id,
          policy: portal.policy,
          prompt: portal.prompt,
          scene: portal.scene,
        })),
        powerup_actors: checkpoint.powerups.instances.map(powerup => projectModPowerup(
          powerup,
          content,
          assets,
          runtimeTick,
        )),
        powerup_events: powerups.projectCollections().map(event => projectModPowerupCollection(
          event,
          content,
          assets,
        )),
        presentation_events: presentation.flatMap(event => projectPresentationAudio(event, assets)),
        scenes: checkpoint.scenes.scenes.map((scene) => {
          const definition = content.scene(scene.sceneContentId)!
          return {
            epoch: scene.epoch,
            mod_id: definition.modId,
            owner_id: scene.ownerId,
            parent_content_id: scene.parentContentId,
            room_index: scene.roomIndex,
            rooms: definition.rooms.map((reference) => {
              const room = content.room(reference.contentId)!
              return {
                content_id: room.contentId,
                description: room.description,
                geometry: room.geometry as unknown as LuaConsoleObject,
                name: room.name,
                props: (room.fields.props ?? []) as unknown as LuaConsoleValue,
              }
            }),
            scene_content_id: scene.sceneContentId,
          }
        }),
        state_values: semanticState.project(viewerId).map(row => ({
          key: row.key,
          mod_id: row.modId,
          scope_id: row.scope.id,
          scope_kind: row.scope.kind,
          value: row.value,
        })),
        shops: content.all().filter(entry => entry.contentKind === 'shop').map(entry => ({
          content_id: entry.contentId,
          icon_path: entry.art.npc?.path ?? entry.art.icon?.path ?? null,
          mod_id: entry.modId,
          mount: content.shop(entry.contentId)!.mount as unknown as LuaConsoleValue,
          name: entry.name,
          npc: content.shop(entry.contentId)!.npc as unknown as LuaConsoleValue,
          restock_ms: content.shop(entry.contentId)!.restockMs,
          services: content.shop(entry.contentId)!.services.map(service => ({
            pool_content_id: service.pool.contentId,
            price: service.price,
            type: service.type,
          })),
          stock: content.shop(entry.contentId)!.stock.map(stock => ({
            item_content_id: stock.item.contentId,
            price: stock.price,
            quantity: stock.quantity,
          })),
        })),
        shop_stock: (viewerId ? shops.project(viewerId) : checkpoint.shops.stock).map(stock => ({
          player_id: stock.playerId,
          remaining: stock.remaining,
          restock_tick: stock.restockTick,
          row: stock.row,
          shop_content_id: stock.shopContentId,
        })),
        skills: content.skills().map(skill => ({
          content_id: skill.contentId,
          description: skill.description,
          icon_path: skill.art.icon?.path ?? null,
          maximum_rank: skill.maximumRank,
          minimum_level: skill.minimumLevel,
          mod_id: skill.modId,
          name: skill.name,
          parent_content_id: skill.parent?.contentId ?? null,
        })),
        skill_ranks: (viewerId ? skills.project(viewerId) : checkpoint.skills.ranks).map(rank => ({
          content_id: rank.contentId,
          player_id: rank.playerId,
          rank: rank.rank,
        })),
        skill_offers: (viewerId ? skills.offers(viewerId) : checkpoint.skills.offers).map(offer => ({
          content_ids: offer.contentIds,
          player_id: offer.playerId,
          sequence: offer.sequence,
        })),
        spells: content.spells().filter(spell => (
          !viewerId || skills.spellUnlocked(viewerId, spell.contentId)
        )).map(spell => ({
          content_id: spell.contentId,
          icon_path: spell.art.icon?.path ?? null,
          mana: spell.mana,
          mod_id: spell.modId,
          name: spell.name,
          slot: spell.slot,
        })),
        mod_quickbar: (viewerId
          ? skills.projectBindings(viewerId)
          : checkpoint.skills.bindings).map(binding => ({
            content_id: binding.contentId,
            player_id: binding.playerId,
            slot: binding.slot,
          })),
        spell_cooldowns: (viewerId ? spells.project(viewerId) : checkpoint.spells.cooldowns).map(row => ({
          content_id: row.contentId,
          player_id: row.playerId,
          ready_tick: row.readyTick,
        })),
        spell_effects: checkpoint.spellEffects.effects.map(effect => projectSpellEffect(
          effect,
          content,
          assets,
          runtimeTick,
        )),
        ui_surfaces: content.uis().filter(definition => uiVisible(
          definition,
          options.state.read(),
          viewerId,
          scenes,
          semanticState,
        )).map(definition => ({
          accessible_name: definition.accessibleName,
          actions: definition.actions,
          bindings: uiBindings(definition, viewerId, semanticState),
          content_id: definition.contentId,
          mount: definition.mount,
          view: {
            fields: definition.view.fields as unknown as LuaConsoleObject,
            operation: definition.view.operation,
          },
        })),
      }
      return Object.freeze({
        projection: Object.freeze(projection),
        revision: checkpoint.enemies.revision
          + checkpoint.scenes.nextEpoch
          + checkpoint.semanticState.revision
          + checkpoint.skills.revision
          + checkpoint.spells.revision
          + checkpoint.spellEffects.revision
          + checkpoint.shops.revision,
      })
    },
    saveState() {
      return encodePreparedModSaveState(options.content.compiledMods, host.checkpoint())
    },
    selectSceneRoom(ownerId, roomIndex) {
      requireOpen()
      const checkpoint = scenes.checkpoint()
      const active = scenes.selectRoom(ownerId, roomIndex)
      const result = report(session.act({
        action: 'scene.room',
        context: {
          scene_content_id: active.sceneContentId,
          scene_owner_id: ownerId,
        },
        payload: {
          room_index: active.roomIndex,
          scene_content_id: active.sceneContentId,
        },
        requestId: active.epoch,
        scope: { id: ownerId, kind: 'scene' },
        tick: options.state.read().tick,
      }))
      if (!result.accepted) {
        scenes.restore(checkpoint)
        throw new Error(result.errors.join('; ') || 'mod scene room rule failed')
      }
      return active
    },
    enterPortal(input) {
      requireOpen()
      const checkpoint = scenes.checkpoint()
      const active = portals.activate(input)
      const result = report(session.act({
        action: 'portal.enter',
        context: {
          participant_id: input.playerId,
          portal_id: input.portalId,
          scene_owner_id: input.ownerId,
        },
        payload: {
          portal_id: input.portalId,
          scene_content_id: active.sceneContentId,
        },
        requestId: active.epoch,
        scope: { id: input.ownerId, kind: 'party-run' },
        tick: options.state.read().tick,
      }))
      if (!result.accepted) {
        scenes.restore(checkpoint)
        throw new Error(result.errors.join('; ') || 'mod portal rule failed')
      }
    },
    step(events, tick, scopeId, context = {}) {
      requireOpen()
      for (const event of events) {
        if (event.name === 'level.up' && event.payload && typeof event.payload === 'object' &&
            !Array.isArray(event.payload)) {
          const payload = event.payload as LuaConsoleObject
          if (typeof payload.player_id === 'string' && typeof payload.level === 'number' &&
              Number.isSafeInteger(payload.level) && payload.level > 0) {
            skills.offer(payload.player_id, payload.level, tick)
          }
        }
        if (event.name === 'wave.started' && activeBoneyardContentId !== null &&
            event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload)) {
          const wave = (event.payload as LuaConsoleObject).wave
          if (Number.isSafeInteger(wave)) spawnBoneyardRoster(
            activeBoneyardContentId,
            content,
            enemies,
            enemySpawns,
            options.state.read(),
            tick,
            Number(wave),
          )
        }
      }
      const result = report(session.step({
        events: events.map(event => ({
          context: Object.freeze({
            ...context,
            active_boneyard_content_id: activeBoneyardContentId,
            event: event.name,
          }),
          event: event.name,
          payload: event.payload,
          scope: { id: scopeId, kind: 'party-run' },
        })),
        tick,
      }))
      if (events.some(event => event.name === 'run.ended')) session.closeRun(scopeId)
      return result
    },
    tick(tick) {
      requireOpen()
      const revision = statuses.revision + powerups.revision + skills.revision
        + semanticState.revision + shops.revision + spellEffects.revision
      statuses.tick(tick)
      while (presentation[0] && tick - presentation[0].tick >= GAME_TICK_RATE) presentation.shift()
      shops.tick(tick)
      powerups.tick(tick)
      const state = options.state.read()
      const players = state.playerEntities.identities.flatMap(({ playerId }, index) => {
        if (state.playerEntities.progressions[index]!.lifeState !== 'alive') return []
        return [{
          id: playerId,
          x: state.playerEntities.locomotions[index]!.position.x,
          y: state.playerEntities.locomotions[index]!.position.y,
        }]
      })
      if (state.world.kind !== 'boneyard') {
        enemies.clear()
        powerups.clear()
        activeBoneyardContentId = null
      }
      else {
        const world = state.world
        const collision = withBoneyardGateCollision(world.collision, world.gateLeaves)
        const attacks = isBoneyardPlayerCombatEnabled(world.encounter)
          ? enemies.tick({
              move: (start, requested, radius) => resolveBoneyardMovement(
                start,
                requested,
                world.bounds,
                collision,
                radius,
              ),
              players,
              tick,
            })
          : []
        const beforeAttacks = options.state.read()
        let attackedState = beforeAttacks
        for (const attack of attacks) {
          const amount = filterPlayerDamage(
            attackedState,
            attack.playerId,
            attack.amount,
            tick,
            statuses,
            skills,
          )
          attackedState = {
            ...attackedState,
            playerEntities: damagePlayerEntity(
              attackedState.playerEntities,
              attack.playerId,
              amount,
              tick,
            ),
          }
        }
        if (attackedState !== beforeAttacks) options.state.write(attackedState)
      }
      const playerPositions = new Map(players.map(player => [player.id, player]))
      const nativeTargets = state.world.kind === 'boneyard'
        ? state.world.enemies.actors.filter(actor => actor.lifeState === 'alive').map(actor => ({
            id: actor.id,
            kind: 'native-enemy' as const,
            x: actor.position.x,
            y: actor.position.y,
          }))
        : []
      const modTargets = enemies.project().filter(enemy => enemy.lifeState === 'alive').map(enemy => ({
        id: enemy.id,
        kind: 'mod-enemy' as const,
        x: enemy.x,
        y: enemy.y,
      }))
      for (const batch of spellEffects.tick({
        players: playerPositions,
        targets: [...nativeTargets, ...modTargets],
        tick,
      })) {
        if (batch.intents.length === 0) continue
        const transaction = adapter.prepare(batch.intents, {
          context: batch.context,
          scope: batch.scope,
          tick,
        })
        try {
          transaction.commit()
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error)
          transaction.rollback(reason)
          const effectId = batch.context.effect_id
          if (typeof effectId === 'number') spellEffects.retire(effectId)
          options.log?.(`${batch.scope.kind}:${batch.scope.id}: ${reason}`)
        }
      }
      for (const candidate of powerups.candidates(players)) {
        const result = session.act({
          action: 'content.pickup',
          context: { participant_id: candidate.playerId, powerup_id: candidate.instance.id },
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
        if (result.accepted) powerups.collect(candidate.instance.id, candidate.playerId, tick)
      }
      const projectedEnemies = enemies.project()
      for (const enemy of projectedEnemies) {
        const previousHealth = reportedEnemyHealth.get(enemy.id)
        if (previousHealth !== undefined && enemy.currentHealth < previousHealth) {
          const events = [{
            context: Object.freeze({
              ...(enemy.lastDamagedByPlayerId
                ? { participant_id: enemy.lastDamagedByPlayerId }
                : {}),
              mod_enemy_id: enemy.id,
            }),
            event: 'mod.enemy.damaged',
            payload: Object.freeze({
              content_id: enemy.contentId,
              current_health: enemy.currentHealth,
              enemy_id: enemy.id,
              maximum_health: enemy.maximumHealth,
            }),
            scope: { id: `${enemy.contentId}:${enemy.id}`, kind: 'entity' as const },
          }]
          if (enemy.currentHealth === 0) events.push({
            ...events[0]!,
            event: 'mod.enemy.died',
          })
          report(session.step({ events, tick }))
        }
        reportedEnemyHealth.set(enemy.id, enemy.currentHealth)
      }
      const liveEnemyIds = new Set(projectedEnemies.map(enemy => enemy.id))
      for (const enemyId of reportedEnemyHealth.keys()) {
        if (!liveEnemyIds.has(enemyId)) reportedEnemyHealth.delete(enemyId)
      }
      return statuses.revision + powerups.revision + skills.revision
        + semanticState.revision + shops.revision + spellEffects.revision !== revision
    },
    uiAction(input) {
      requireOpen()
      const definition = content.ui(input.contentId)
      if (!definition || !definition.actions.includes(input.action) || !uiVisible(
        definition,
        options.state.read(),
        input.playerId,
        scenes,
        semanticState,
      )) throw new Error('mod UI action is unavailable')
      const state = options.state.read()
      return report(session.act({
        action: 'ui.action',
        context: {
          action: input.action,
          participant_id: input.playerId,
          ui_content_id: input.contentId,
        },
        payload: {
          action: input.action,
          arguments: input.arguments,
          content_id: input.contentId,
          participant_id: input.playerId,
        },
        requestId: input.requestId,
        scope: {
          id: `${input.playerId}:${state.run.runId ?? 'profile'}`,
          kind: 'participant-run',
        },
        tick: state.tick,
      }))
    },
  }
  return Object.freeze(host)
}

function createHostIntentAdapter(options: Readonly<{
  content: PreparedModContentCatalog
  enemies: ModEnemyEngine
  enemySpawns: BoneyardEnemySpawnIntent[]
  powerups: ModPowerupEngine
  presentation: PreparedModPresentationIntent[]
  scenes: ModSceneEngine
  semanticState: ModSemanticStateEngine
  skills: ModSkillEngine
  spellEffects: ModSpellEffectEngine
  state: PreparedModHostStateAccess
  statuses: ModStatusEngine
}>): ModIntentAdapter {
  return {
    prepare(intents, context) {
      const source = options.state.read()
      const statusCheckpoint = options.statuses.checkpoint()
      const powerupCheckpoint = options.powerups.checkpoint()
      const enemyCheckpoint = options.enemies.checkpoint()
      const sceneCheckpoint = options.scenes.checkpoint()
      const semanticStateCheckpoint = options.semanticState.checkpoint()
      const spellEffectCheckpoint = options.spellEffects.checkpoint()
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
            options.enemies,
            options.semanticState,
            options.skills,
            options.spellEffects,
          )
          candidate = result.state
          if (result.spawn) spawns.push(result.spawn)
          if (result.presentation) projected.push(result.presentation)
        }
      } catch (error) {
        options.statuses.restore(statusCheckpoint)
        options.powerups.restore(powerupCheckpoint)
        options.enemies.restore(enemyCheckpoint)
        options.scenes.restore(sceneCheckpoint)
        options.semanticState.restore(semanticStateCheckpoint)
        options.spellEffects.restore(spellEffectCheckpoint)
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
          options.enemies.restore(enemyCheckpoint)
          options.scenes.restore(sceneCheckpoint)
          options.semanticState.restore(semanticStateCheckpoint)
          options.spellEffects.restore(spellEffectCheckpoint)
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
  enemies: ModEnemyEngine,
  semanticState: ModSemanticStateEngine,
  skills: ModSkillEngine,
  spellEffects: ModSpellEffectEngine,
): Readonly<{
  presentation: PreparedModPresentationIntent | null
  spawn: BoneyardEnemySpawnIntent | null
  state: GameSimulationState
}> {
  switch (intent.kind) {
    case 'damage':
      exactObjectKeys(intent.fields, intentFields(intent, ['amount', 'modifier', 'target']), 'damage intent')
      return outcome(applyDamage(
        source,
        intent.fields,
        context,
        statuses,
        enemies,
        skills,
        content,
      ))
    case 'resource':
      exactObjectKeys(intent.fields, intentFields(intent, ['experience', 'gold', 'health', 'mana', 'target']), 'resource intent')
      return outcome(applyResource(source, intent.fields, context))
    case 'grant':
      exactObjectKeys(intent.fields, intentFields(intent, ['item', 'quantity', 'target']), 'grant intent')
      return outcome(applyGrant(source, intent.fields, context, content))
    case 'status': {
      exactObjectKeys(intent.fields, intentFields(intent, ['status', 'target']), 'status intent')
      const targetId = targetPlayer(source, intent.fields.target, context)
      const reference = contentReference(intent.fields.status, 'status', `${intent.modId}:${intent.owner} status`)
      statuses.apply(reference.contentId, targetId, context.tick)
      return outcome(source)
    }
    case 'spawn':
      exactObjectKeys(intent.fields, intentFields(intent, ['content', 'enemy', 'token', 'x', 'y']), 'spawn intent')
      return spawnOutcome(source, intent, context, powerups, enemies)
    case 'spell-effect': {
      const ownerPlayerId = targetPlayer(source, 'caster', context)
      const origin = getPlayerCharacter(source, ownerPlayerId).position
      const spellContentId = text(intent.fields.spell_content_id, 'spell effect content id')
      if (!content.spell(spellContentId)) throw new Error('spell effect content is unavailable')
      spellEffects.spawn({
        contentId: spellContentId,
        fields: intent.fields,
        modId: intent.modId,
        origin,
        ownerPlayerId,
        scope: intent.scope,
        target: {
          x: finite(context.context.target_x, origin.x, 'spell target x'),
          y: finite(context.context.target_y, origin.y, 'spell target y'),
        },
        tick: context.tick,
      })
      return outcome(source)
    }
    case 'state': {
      exactObjectKeys(intent.fields, intentFields(intent, ['clear', 'key', 'value']), 'state intent')
      const key = text(intent.fields.key, 'state key')
      if ((intent.fields.clear === true) === (intent.fields.value !== undefined)) {
        throw new Error('state intent requires exactly one of value or clear')
      }
      if (intent.fields.clear === true) semanticState.clear(intent.modId, intent.scope, key)
      else {
        if (intent.fields.value === undefined) throw new Error('state intent requires value or clear')
        semanticState.set(intent.modId, intent.scope, key, intent.fields.value)
      }
      return outcome(source)
    }
    case 'present':
      exactObjectKeys(intent.fields, intentFields(intent, ['sound']), 'present intent')
      if (intent.fields.sound === undefined) throw new Error('present intent requires sound')
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

function applyDamage(
  source: GameSimulationState,
  fields: LuaConsoleObject,
  context: ModIntentExecutionContext,
  statuses: ModStatusEngine,
  enemies: ModEnemyEngine,
  skills: ModSkillEngine,
  content: PreparedModContentCatalog,
): GameSimulationState {
  const amount = positive(fields.amount, 'damage amount')
  const target = fields.target
  const playerTarget = damagePlayerTarget(source, target, context)
  if (playerTarget !== null) {
    const filtered = filterPlayerDamage(source, playerTarget, amount, context.tick, statuses, skills)
    return {
      ...source,
      playerEntities: damagePlayerEntity(
        source.playerEntities,
        playerTarget,
        filtered,
        context.tick,
      ),
    }
  }
  const descriptor = damageEnemyTarget(target, context)
  const sourcePlayerId = typeof context.context.participant_id === 'string'
    && playerEntityIndex(source.playerEntities, context.context.participant_id) >= 0
    ? context.context.participant_id
    : null
  const modifier = typeof fields.modifier === 'string' && fields.modifier.length > 0
    ? fields.modifier
    : 'outgoing_damage'
  const outgoingAmount = sourcePlayerId === null
    ? amount
    : skills.filter(sourcePlayerId, modifier, amount)
  if (descriptor.kind === 'mod-enemy') {
    const damaged = enemies.damage(descriptor.id, outgoingAmount, context.tick, sourcePlayerId)
    if (!damaged) throw new Error('mod damage target is unavailable')
    if (damaged.lifeState !== 'dying' || sourcePlayerId === null) return source
    const definition = content.enemy(damaged.contentId)!
    const span = definition.goldMaximum - definition.goldMinimum + 1
    const gold = definition.goldMinimum + (Math.imul(damaged.id, 0x9e3779b1) >>> 0) % span
    const rewarded = {
      ...source,
      playerEntities: creditPlayerEntityLootGold(source.playerEntities, sourcePlayerId, gold),
    }
    return definition.experience === 0
      ? rewarded
      : grantGameSimulationPlayerExperience(rewarded, sourcePlayerId, definition.experience)
  }
  if (source.world.kind !== 'boneyard') throw new Error('enemy damage requires an active Boneyard')
  const damaged = damageBoneyardEnemy(source.world.enemies, {
    actorId: descriptor.id,
    amount: outgoingAmount,
    sourcePlayerId,
    tick: context.tick,
  })
  if (!damaged.accepted) throw new Error('enemy damage target is unavailable')
  return { ...source, world: { ...source.world, enemies: damaged.store } }
}

function filterPlayerDamage(
  source: GameSimulationState,
  playerId: string,
  amount: number,
  tick: number,
  statuses: ModStatusEngine,
  skills: ModSkillEngine,
): number {
  const statusFiltered = statuses.filterDamage(playerId, amount, tick)
  const skillFiltered = skills.filter(playerId, 'incoming_damage', statusFiltered)
  return filterEquipmentModifiers(source, playerId, 'incoming_damage', skillFiltered)
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
  enemies: ModEnemyEngine,
) {
  const content = intent.fields.content
  if (content !== undefined) {
    const reference = resolvedContentReference(content, 'spawn content')
    if (reference.targetKind !== 'powerup') {
      throw new Error('spawn content must reference a powerup')
    }
    const position = intentPosition(source, intent.fields, context)
    powerups.spawn(reference.contentId, position.x, position.y, context.tick)
    return outcome(source)
  }
  if (intent.fields.enemy && typeof intent.fields.enemy === 'object') {
    const reference = resolvedContentReference(intent.fields.enemy, 'spawn enemy')
    if (reference.targetKind !== 'enemy') throw new Error('spawn enemy must reference an enemy')
    if (source.world.kind !== 'boneyard') throw new Error('custom enemy spawn requires an active Boneyard')
    const requested = intentPosition(source, intent.fields, context)
    const position = resolveBoneyardSpawnPosition(
      requested,
      source.world.bounds,
      withBoneyardGateCollision(source.world.collision, source.world.gateLeaves),
      enemies.collisionRadius(reference.contentId),
    )
    enemies.spawn(reference.contentId, position.x, position.y, context.tick)
    return outcome(source)
  }
  return outcome(source, spawnIntent(source, intent, context))
}

function spawnBoneyardRoster(
  contentId: string,
  content: PreparedModContentCatalog,
  enemies: ModEnemyEngine,
  enemySpawns: BoneyardEnemySpawnIntent[],
  state: GameSimulationState,
  tick: number,
  wave?: number,
): void {
  if (state.world.kind !== 'boneyard') throw new Error('Boneyard roster requires an active Boneyard')
  const world = state.world
  const definition = content.boneyard(contentId)
  if (!definition) throw new Error('active Web Lua Boneyard is unavailable')
  const roster = wave === undefined
    ? definition.roster
    : definition.waves.filter(row => row.wave === wave || row.ordinal === wave).flatMap((row) => {
        if (!Array.isArray(row.roster)) throw new Error('Boneyard wave roster is invalid')
        return row.roster
      })
  const anchor = boneyardAnchor(
    definition.anchors.entry as unknown as LuaConsoleValue,
    world.spawn,
  )
  const collision = withBoneyardGateCollision(world.collision, world.gateLeaves)
  roster.forEach((entry, index) => {
    const angle = index / Math.max(1, roster.length) * Math.PI * 2
    const requested = {
      x: anchor.x + Math.cos(angle) * (48 + Math.floor(index / 8) * 42),
      y: anchor.y + Math.sin(angle) * (48 + Math.floor(index / 8) * 42),
    }
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      const reference = resolvedContentReference(entry as LuaConsoleValue, 'Boneyard roster enemy')
      if (reference.targetKind !== 'enemy') throw new Error('Boneyard roster entry must reference an enemy')
      const position = resolveBoneyardSpawnPosition(
        requested,
        world.bounds,
        collision,
        enemies.collisionRadius(reference.contentId),
      )
      enemies.spawn(reference.contentId, position.x, position.y, tick)
      return
    }
    const token = stockEnemyToken(entry)
    enemySpawns.push(Object.freeze({
      enemyToken: token,
      flags: Object.freeze([]),
      id: SPAWN_ID_BASE + (tick * 131 + index + enemySpawns.length) % SPAWN_ID_RANGE,
      locationPolicy: 'anywhere' as const,
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES[token],
      position: Object.freeze(requested),
      spawnTick: tick + 1,
      waveOrdinal: wave ?? world.waves?.waveOrdinal ?? 0,
    }))
  })
}

function boneyardAnchor(
  value: LuaConsoleValue | undefined,
  fallback: Readonly<{ x: number; y: number }>,
): Readonly<{ x: number; y: number }> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback
  const row = value as LuaConsoleObject
  return typeof row.x === 'number' && Number.isFinite(row.x) &&
    typeof row.y === 'number' && Number.isFinite(row.y)
    ? Object.freeze({ x: row.x, y: row.y })
    : fallback
}

function stockEnemyToken(value: LuaConsoleValue | undefined): BoneyardWaveEnemyToken {
  if (typeof value !== 'string') throw new Error('Boneyard roster entry is invalid')
  const token = value.replace(/^stock\./, '').replace(/_/g, '').toUpperCase()
  if (!enemyTokens.has(token)) throw new Error(`Boneyard stock enemy is unavailable: ${value}`)
  return token as BoneyardWaveEnemyToken
}

function spawnIntent(
  source: GameSimulationState,
  intent: ModIntent,
  context: ModIntentExecutionContext,
): BoneyardEnemySpawnIntent {
  if (source.world.kind !== 'boneyard') throw new Error('enemy spawn requires an active Boneyard')
  const tokenValue = intent.fields.token ?? intent.fields.enemy
  if (typeof tokenValue !== 'string' || !enemyTokens.has(tokenValue)) {
    throw new Error('enemy spawn requires a stock token or resolved enemy reference')
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

function damagePlayerTarget(
  state: GameSimulationState,
  value: LuaConsoleValue | undefined,
  context: ModIntentExecutionContext,
): string | null {
  const contextual = context.context.participant_id
  const candidate = value === undefined || value === 'user' || value === 'collector' || value === 'caster'
    ? contextual
    : value === 'target_player'
      ? context.context.target_player_id
      : typeof value === 'string'
        ? value
        : value && typeof value === 'object' && !Array.isArray(value)
          ? (value as LuaConsoleObject).participant_id
          : null
  return typeof candidate === 'string' && playerEntityIndex(state.playerEntities, candidate) >= 0
    ? candidate
    : null
}

function damageEnemyTarget(
  value: LuaConsoleValue | undefined,
  context: ModIntentExecutionContext,
): Readonly<{ id: number; kind: 'mod-enemy' | 'native-enemy' }> {
  const object = value && typeof value === 'object' && !Array.isArray(value)
    ? value as LuaConsoleObject
    : null
  const contextualModId = context.context.mod_enemy_id
  const contextualNativeId = context.context.enemy_id ?? context.context.actor_id
  const id = typeof value === 'number'
    ? value
    : typeof object?.id === 'number'
      ? object.id
      : value === 'mod_enemy' || value === 'target_enemy' && typeof contextualModId === 'number'
        ? contextualModId
        : contextualNativeId
  if (!Number.isSafeInteger(id) || Number(id) < 1) throw new Error('mod damage target is unavailable')
  const kind = object?.kind === 'mod-enemy' || value === 'mod_enemy'
    || value === 'target_enemy' && typeof contextualModId === 'number'
    ? 'mod-enemy'
    : 'native-enemy'
  return Object.freeze({ id: Number(id), kind })
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

function projectSpellEffect(
  effect: ActiveModSpellEffect,
  content: PreparedModContentCatalog,
  assets: PreparedModAssetCatalog,
  tick: number,
): LuaConsoleObject {
  const spell = content.spell(effect.contentId)
  if (!spell) throw new Error('active mod spell effect references unavailable content')
  const imageBinding = spell.art.effect ?? spell.art.icon
  const image = assets.get(spell.modId, imageBinding.key)
  if (!image || image.kind !== 'image') throw new Error('mod spell effect image is unavailable')
  const frame = spellEffectFrame(image, effect, tick)
  const sound = spell.art.sound
    ? assets.get(spell.modId, spell.art.sound.key)
    : null
  if (sound && sound.kind !== 'audio') throw new Error('mod spell effect sound is unavailable')
  return Object.freeze({
    content_id: effect.contentId,
    expires_tick: effect.expiresTick,
    frame_height: frame.height,
    frame_width: frame.width,
    frame_x: frame.x,
    frame_y: frame.y,
    id: effect.id,
    image_height: image.height,
    image_path: image.path,
    image_width: image.width,
    kind: effect.kind,
    mod_id: effect.modId,
    owner_player_id: effect.ownerPlayerId,
    radius: effect.radius,
    sound_path: sound?.path ?? null,
    sound_volume: sound?.volume ?? 0,
    started_tick: effect.startedTick,
    target_x: effect.targetX,
    target_y: effect.targetY,
    x: effect.x,
    y: effect.y,
  })
}

function projectModAudioLoops(
  activeBoneyardContentId: string | null,
  checkpoint: PreparedModHostCheckpoint,
  content: PreparedModContentCatalog,
  assets: PreparedModAssetCatalog,
): readonly LuaConsoleObject[] {
  const owners: Array<Readonly<{
    bindings: Readonly<Record<string, { key: string }>>
    id: string
    modId: string
  }>> = []
  if (activeBoneyardContentId) {
    const definition = content.boneyard(activeBoneyardContentId)!
    owners.push({ bindings: definition.art, id: `boneyard:${definition.contentId}`, modId: definition.modId })
  }
  for (const scene of checkpoint.scenes.scenes) {
    const definition = content.scene(scene.sceneContentId)!
    const room = content.room(definition.rooms[scene.roomIndex]!.contentId)!
    owners.push({ bindings: definition.art, id: `scene:${scene.ownerId}`, modId: definition.modId })
    owners.push({ bindings: room.art, id: `room:${scene.ownerId}:${scene.roomIndex}`, modId: room.modId })
  }
  for (const status of checkpoint.statuses.instances) {
    const definition = content.status(status.contentId)!
    owners.push({ bindings: definition.art, id: `status:${status.instanceId}`, modId: definition.modId })
  }
  return Object.freeze(owners.flatMap(owner => ['music', 'ambience', 'loop'].flatMap((slot) => {
    const binding = owner.bindings[slot]
    if (!binding) return []
    const asset = assets.get(owner.modId, binding.key)
    if (!asset || asset.kind !== 'audio') throw new Error('mod audio loop is unavailable')
    return [Object.freeze({
      bus: asset.bus,
      loop: true,
      owner: `${owner.id}:${slot}`,
      path: asset.path,
      mod_id: owner.modId,
      volume: asset.volume,
    })]
  })))
}

function projectPresentationAudio(
  event: PreparedModPresentationIntent,
  assets: PreparedModAssetCatalog,
): readonly LuaConsoleObject[] {
  const sound = event.fields.sound
  if (!sound || typeof sound !== 'object' || Array.isArray(sound) ||
      (sound as LuaConsoleObject).kind !== 'asset-reference' ||
      typeof (sound as LuaConsoleObject).key !== 'string') return []
  const asset = assets.get(event.modId, (sound as LuaConsoleObject).key as string)
  if (!asset || asset.kind !== 'audio' || asset.assetKind !== 'sound') {
    throw new Error('mod presentation sound is unavailable')
  }
  return [Object.freeze({
    owner: `${event.modId}:presentation:${event.sequence}`,
    path: asset.path,
    mod_id: event.modId,
    sequence: event.sequence,
    tick: event.tick,
    volume: asset.volume,
  })]
}

function uiVisible(
  definition: PreparedModUiDefinition,
  state: GameSimulationState,
  viewerId: string | undefined,
  scenes: ModSceneEngine,
  semanticState: ModSemanticStateEngine,
): boolean {
  const activeScene = scenes.project().some(scene => (
    scene.ownerId === (state.run.runId ?? viewerId)
  ))
  const scene = activeScene ? 'room' : state.world.kind
  const allowed = Array.isArray(definition.visible.scenes) ? definition.visible.scenes : []
  if (allowed.length > 0 && !allowed.includes(scene)) return false
  const condition = definition.visible.state
  if (!condition || typeof condition !== 'object' || Array.isArray(condition)) return true
  const row = condition as Record<string, unknown>
  const key = typeof row.key === 'string' ? row.key : typeof row.state === 'string' ? row.state : null
  if (!key) return true
  const value = semanticState.project(viewerId).find(candidate => (
    candidate.modId === definition.modId && candidate.key === key
  ))?.value
  return row.equals === undefined ? Boolean(value) : value === row.equals
}

function uiBindings(
  definition: PreparedModUiDefinition,
  viewerId: string | undefined,
  semanticState: ModSemanticStateEngine,
): LuaConsoleObject {
  const values = semanticState.project(viewerId).filter(row => row.modId === definition.modId)
  return Object.freeze(Object.fromEntries(Object.entries(definition.bindings).map(([name, binding]) => {
    const key = binding && typeof binding === 'object' && !Array.isArray(binding)
      && typeof (binding as Record<string, unknown>).state === 'string'
      ? (binding as Record<string, unknown>).state as string
      : null
    return [name, key === null ? null : values.find(row => row.key === key)?.value ?? null]
  })))
}

function projectModEnemy(
  enemy: ActiveModEnemy,
  content: PreparedModContentCatalog,
  assets: PreparedModAssetCatalog,
  tick: number,
): LuaConsoleObject {
  const definition = content.enemy(enemy.contentId)
  if (!definition) throw new Error('active mod enemy references unavailable content')
  const image = assets.get(definition.modId, definition.art.atlas.key)
  if (!image || image.kind !== 'image') throw new Error('mod enemy image is unavailable')
  const frame = modEnemyFrame(image, enemy, tick)
  const soundBinding = enemy.lifeState === 'dying'
    ? definition.art.death_sound ?? definition.art.sound
    : enemy.lastAttackTick !== null
      ? definition.art.attack_sound ?? definition.art.sound
      : null
  const sound = soundBinding ? assets.get(definition.modId, soundBinding.key) : null
  if (sound && sound.kind !== 'audio') throw new Error('mod enemy sound is unavailable')
  return Object.freeze({
    content_id: enemy.contentId,
    current_health: enemy.currentHealth,
    death_tick: enemy.deathTick,
    frame_height: frame.height,
    frame_width: frame.width,
    frame_x: frame.x,
    frame_y: frame.y,
    heading_index: enemy.headingIndex,
    id: enemy.id,
    image_height: image.height,
    image_path: image.path,
    image_width: image.width,
    last_attack_tick: enemy.lastAttackTick,
    life_state: enemy.lifeState,
    light_color: 0x9c7ad9,
    light_radius: 72 * definition.scale,
    maximum_health: enemy.maximumHealth,
    mod_id: definition.modId,
    moving: enemy.moving,
    name: definition.name,
    scale: definition.scale,
    sound_event_tick: enemy.lifeState === 'dying' ? enemy.deathTick : enemy.lastAttackTick,
    sound_path: sound?.path ?? null,
    sound_volume: sound?.volume ?? 0,
    target_player_id: enemy.targetPlayerId,
    x: enemy.x,
    y: enemy.y,
  })
}

function projectModPowerup(
  powerup: ActiveModPowerup,
  content: PreparedModContentCatalog,
  assets: PreparedModAssetCatalog,
  tick: number,
): LuaConsoleObject {
  const definition = content.powerup(powerup.contentId)
  if (!definition) throw new Error('active mod powerup references unavailable content')
  const image = assets.get(definition.modId, definition.art.world.key)
  if (!image || image.kind !== 'image') throw new Error('mod powerup image is unavailable')
  const animation = image.animations.active ?? image.animations.idle
    ?? Object.values(image.animations)[0] ?? image.frames.map((_, index) => index)
  const frameIndex = animation[Math.floor(Math.max(0, tick - powerup.spawnedTick) / 8) % animation.length] ?? 0
  const frame = image.frames[frameIndex]!
  return Object.freeze({
    content_id: powerup.contentId,
    frame_height: frame.height,
    frame_width: frame.width,
    frame_x: frame.x,
    frame_y: frame.y,
    id: powerup.id,
    image_height: image.height,
    image_path: image.path,
    image_width: image.width,
    mod_id: definition.modId,
    name: definition.name,
    spawned_tick: powerup.spawnedTick,
    x: powerup.x,
    y: powerup.y,
  })
}

function projectModPowerupCollection(
  event: ModPowerupCollectionEvent,
  content: PreparedModContentCatalog,
  assets: PreparedModAssetCatalog,
): LuaConsoleObject {
  const definition = content.powerup(event.contentId)
  if (!definition) throw new Error('mod powerup collection references unavailable content')
  const soundBinding = definition.art.sound
  const sound = soundBinding ? assets.get(definition.modId, soundBinding.key) : null
  if (sound && sound.kind !== 'audio') throw new Error('mod powerup sound is unavailable')
  return Object.freeze({
    content_id: event.contentId,
    id: event.id,
    mod_id: definition.modId,
    player_id: event.playerId,
    sound_path: sound?.path ?? null,
    sound_volume: sound?.volume ?? 0,
    tick: event.tick,
    x: event.x,
    y: event.y,
  })
}

function modEnemyFrame(
  image: PreparedModSpriteAsset,
  enemy: ActiveModEnemy,
  tick: number,
) {
  const names = enemy.lifeState === 'dying'
    ? ['death']
    : enemy.lastAttackTick !== null && tick - enemy.lastAttackTick < 20
      ? ['attack', 'punch']
      : enemy.moving
        ? ['move', 'run', 'walk']
        : ['idle']
  const animation = names.map(name => image.animations[name]).find(Boolean)
    ?? Object.values(image.animations)[0]
    ?? image.frames.map((_, index) => index)
  const startedTick = enemy.lifeState === 'dying'
    ? enemy.deathTick!
    : names[0] === 'attack'
      ? enemy.lastAttackTick!
      : enemy.spawnedTick
  const ordinal = Math.floor(Math.max(0, tick - startedTick) / 8)
  const base = enemy.lifeState === 'dying'
    ? animation[Math.min(ordinal, animation.length - 1)] ?? 0
    : animation[ordinal % animation.length] ?? 0
  const heading = image.headingCount === null
    ? 0
    : Math.floor(enemy.headingIndex * image.headingCount / 16) % image.headingCount
  return image.frames[base + heading] ?? image.frames[0]!
}

function spellEffectFrame(
  image: PreparedModSpriteAsset,
  effect: ActiveModSpellEffect,
  tick: number,
) {
  const animation = image.animations[effect.kind]
    ?? image.animations.active
    ?? image.animations.idle
    ?? Object.values(image.animations)[0]
    ?? image.frames.map((_, index) => index)
  const frameIndex = animation[Math.floor(Math.max(0, tick - effect.startedTick) / 8) % animation.length] ?? 0
  return image.frames[frameIndex]!
}

function outcome(
  state: GameSimulationState,
  spawn: BoneyardEnemySpawnIntent | null = null,
  presentation: PreparedModPresentationIntent | null = null,
) {
  return Object.freeze({ presentation, spawn, state })
}

function exactObjectKeys(
  source: LuaConsoleObject,
  allowed: readonly string[],
  field: string,
): void {
  const accepted = new Set(allowed)
  const unknown = Object.keys(source).filter(key => !accepted.has(key))
  if (unknown.length > 0) throw new Error(`${field} contains unknown fields: ${unknown.join(', ')}`)
}

function intentFields(intent: ModIntent, fields: readonly string[]): readonly string[] {
  return intent.owner.startsWith('spell-effect.')
    ? [...fields, 'effect_id', 'x', 'y']
    : fields
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

function positive(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 1_000_000_000) {
    throw new Error(`${field} must be finite within 0..1000000000`)
  }
  return value
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 128) {
    throw new Error(`${field} must be 1..128 text characters`)
  }
  return value
}

function finite(value: unknown, fallback: number, field: string): number {
  if (value === undefined) return fallback
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${field} must be finite`)
  return value
}

function filterEquipmentModifiers(
  state: GameSimulationState,
  playerId: string,
  key: string,
  source: number,
): number {
  const equipment = getPlayerEconomy(state, playerId).equipment
  const items = [equipment.amulet, equipment.hat, ...equipment.rings, equipment.robe, equipment.weapon]
  let value = source
  for (const item of items) for (const affix of item?.modAffixes ?? []) {
    for (const modifier of affix.modifiers) {
      if (modifier.key !== key) continue
      if (modifier.operation === 'add') value += modifier.value
      else if (modifier.operation === 'multiply') value *= modifier.value
      else value = modifier.value
    }
  }
  return Math.max(0, value)
}
