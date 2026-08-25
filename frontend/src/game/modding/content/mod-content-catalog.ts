import type {
  HubInventoryItem,
  ModConsumableCatalogEntry,
  ModConsumableContent,
  ModItemCatalogEntry,
  ModItemContent,
} from '../../core-kernels/hub-economy.ts'
import type {
  CompiledWebLuaContent,
  CompiledWebLuaMod,
  ResolvedWebLuaContentReference,
  WebLuaContentKind,
  WebLuaDefinitionValue,
  WebLuaRuleDefinition,
} from '../definition/index.ts'
import {
  PreparedModAssetCatalog,
  type PreparedModAsset,
} from '../assets/index.ts'

const FIRST_CUSTOM_POTION_SUBTYPE = 6
const MAXIMUM_CATALOG_CONTENT = 4_096
const MAXIMUM_DESCRIPTION_BYTES = 1_024
const MAXIMUM_DURATION_MS = 24 * 60 * 60 * 1_000
const MAXIMUM_LOOT_ROWS = 1_024
const STACKING = new Set<ModStatusStacking>(['ignore', 'refresh', 'replace', 'stack'])
const textEncoder = new TextEncoder()

export type ModStatusStacking = 'ignore' | 'refresh' | 'replace' | 'stack'

export interface PreparedModArtBinding {
  readonly assetId: string
  readonly assetKind: PreparedModAsset['assetKind']
  readonly key: string
  readonly path: string
}

export interface PreparedModContentEntry {
  readonly art: Readonly<Record<string, PreparedModArtBinding>>
  readonly contentId: string
  readonly contentKind: WebLuaContentKind
  readonly description: string
  readonly fields: Readonly<Record<string, WebLuaDefinitionValue>>
  readonly key: string
  readonly modId: string
  readonly name: string
}

export interface PreparedModStatusDefinition extends PreparedModContentEntry {
  readonly contentKind: 'status'
  readonly durationMs: number
  readonly modifiers: Readonly<Record<string, WebLuaDefinitionValue>>
  readonly scope: string
  readonly stacking: ModStatusStacking
}

export interface PreparedModPotionDefinition extends PreparedModContentEntry {
  readonly catalog: ModConsumableCatalogEntry
  readonly contentKind: 'potion'
  readonly loot: Readonly<{ boss: number; ordinary: number }> | null
  readonly onUse: WebLuaRuleDefinition
  readonly status: ResolvedWebLuaContentReference | null
}

export interface PreparedModItemDefinition extends PreparedModContentEntry {
  readonly catalog: ModItemCatalogEntry
  readonly contentKind: 'item'
  readonly stackMaximum: number
  readonly use: WebLuaRuleDefinition | null
}

export interface PreparedModPowerupDefinition extends PreparedModContentEntry {
  readonly contentKind: 'powerup'
  readonly durationMs: number
  readonly effect: WebLuaRuleDefinition
  readonly pickupRadius: number
  readonly scope: string
  readonly stacking: ModStatusStacking
}

export interface PreparedModAffixDefinition extends PreparedModContentEntry {
  readonly appliesTo: readonly string[]
  readonly contentKind: 'affix'
  readonly modifiers: Readonly<Record<string, WebLuaDefinitionValue>>
}

export interface PreparedModAffixPoolDefinition extends PreparedModContentEntry {
  readonly appliesTo: readonly string[]
  readonly contentKind: 'affix-pool'
  readonly entries: readonly Readonly<{
    affix: ResolvedWebLuaContentReference
    weight: number
  }>[]
  readonly rngDomain: string
  readonly rolls: number
}

export interface PreparedModSkillDefinition extends PreparedModContentEntry {
  readonly contentKind: 'skill'
  readonly maximumRank: number
  readonly minimumLevel: number
  readonly offerWeight: number
  readonly parent: ResolvedWebLuaContentReference | null
  readonly prerequisites: readonly ResolvedWebLuaContentReference[]
  readonly ranks: readonly Readonly<Record<string, WebLuaDefinitionValue>>[]
}

export interface PreparedModSpellDefinition extends PreparedModContentEntry {
  readonly behavior: WebLuaRuleDefinition
  readonly contentKind: 'spell'
  readonly cooldownMs: number
  readonly mana: number
  readonly slot: 'primary' | 'secondary'
  readonly subskills: Readonly<Record<string, Readonly<Record<string, WebLuaDefinitionValue>>>>
  readonly targeting: Readonly<Record<string, WebLuaDefinitionValue>>
}

export interface PreparedModEnemyDefinition extends PreparedModContentEntry {
  readonly attacks: readonly ResolvedWebLuaContentReference[]
  readonly base: string
  readonly behavior: WebLuaRuleDefinition | null
  readonly contentKind: 'enemy'
  readonly health: number
  readonly scale: number
  readonly speed: number
}

export interface PreparedModBoneyardDefinition extends PreparedModContentEntry {
  readonly contentKind: 'boneyard'
  readonly source: string
}

export interface PreparedModShopDefinition extends PreparedModContentEntry {
  readonly contentKind: 'shop'
  readonly currency: string
  readonly mount: Readonly<Record<string, WebLuaDefinitionValue>> | null
  readonly stock: readonly Readonly<{
    item: ResolvedWebLuaContentReference
    price: number
    quantity: number
  }>[]
}

export interface PreparedModUiDefinition extends PreparedModContentEntry {
  readonly actions: readonly string[]
  readonly contentKind: 'ui'
  readonly mount: string
  readonly view: WebLuaRuleDefinition
}

export interface PreparedModRoomDefinition extends PreparedModContentEntry {
  readonly anchors: Readonly<Record<string, WebLuaDefinitionValue>>
  readonly contentKind: 'room'
  readonly geometry: Readonly<Record<string, WebLuaDefinitionValue>>
}

export interface PreparedModSceneDefinition extends PreparedModContentEntry {
  readonly contentKind: 'scene'
  readonly instance: 'party' | 'player' | 'session'
  readonly rooms: readonly ResolvedWebLuaContentReference[]
}

export interface PreparedModSceneExtensionDefinition extends PreparedModContentEntry {
  readonly contentKind: 'scene-extension'
  readonly features: readonly WebLuaRuleDefinition[]
  readonly scene: string
}

interface PreparedLootRow {
  readonly bossChance: number
  readonly catalog: ModConsumableCatalogEntry
  readonly chance: number
}

export class PreparedModContentCatalog {
  readonly #byId: ReadonlyMap<string, PreparedModContentEntry>
  readonly #affixes: ReadonlyMap<string, PreparedModAffixDefinition>
  readonly #affixPools: ReadonlyMap<string, PreparedModAffixPoolDefinition>
  readonly #content: readonly PreparedModContentEntry[]
  readonly #loot: readonly PreparedLootRow[]
  readonly #items: readonly PreparedModItemDefinition[]
  readonly #potions: readonly PreparedModPotionDefinition[]
  readonly #powerups: ReadonlyMap<string, PreparedModPowerupDefinition>
  readonly #statuses: ReadonlyMap<string, PreparedModStatusDefinition>
  readonly #skills: ReadonlyMap<string, PreparedModSkillDefinition>
  readonly #spells: ReadonlyMap<string, PreparedModSpellDefinition>
  readonly #enemies: ReadonlyMap<string, PreparedModEnemyDefinition>
  readonly #boneyards: ReadonlyMap<string, PreparedModBoneyardDefinition>
  readonly #rooms: ReadonlyMap<string, PreparedModRoomDefinition>
  readonly #scenes: ReadonlyMap<string, PreparedModSceneDefinition>
  readonly #sceneExtensions: readonly PreparedModSceneExtensionDefinition[]
  readonly #shops: ReadonlyMap<string, PreparedModShopDefinition>
  readonly #ui: ReadonlyMap<string, PreparedModUiDefinition>

  constructor(options: Readonly<{
    content: readonly PreparedModContentEntry[]
    affixes: readonly PreparedModAffixDefinition[]
    affixPools: readonly PreparedModAffixPoolDefinition[]
    items: readonly PreparedModItemDefinition[]
    loot: readonly PreparedLootRow[]
    potions: readonly PreparedModPotionDefinition[]
    powerups: readonly PreparedModPowerupDefinition[]
    statuses: readonly PreparedModStatusDefinition[]
    skills: readonly PreparedModSkillDefinition[]
    spells: readonly PreparedModSpellDefinition[]
    enemies: readonly PreparedModEnemyDefinition[]
    boneyards: readonly PreparedModBoneyardDefinition[]
    rooms: readonly PreparedModRoomDefinition[]
    scenes: readonly PreparedModSceneDefinition[]
    sceneExtensions: readonly PreparedModSceneExtensionDefinition[]
    shops: readonly PreparedModShopDefinition[]
    ui: readonly PreparedModUiDefinition[]
  }>) {
    const byId = new Map<string, PreparedModContentEntry>()
    for (const entry of options.content) {
      if (byId.has(entry.contentId)) throw new Error(`prepared mod content is duplicated: ${entry.contentId}`)
      byId.set(entry.contentId, entry)
    }
    this.#content = Object.freeze([...options.content].sort(compareContent))
    this.#byId = byId
    this.#affixes = new Map(options.affixes.map(affix => [affix.contentId, affix]))
    this.#affixPools = new Map(options.affixPools.map(pool => [pool.contentId, pool]))
    this.#loot = Object.freeze([...options.loot])
    this.#items = Object.freeze([...options.items].sort(compareContent))
    this.#potions = Object.freeze([...options.potions].sort(compareContent))
    this.#powerups = new Map(options.powerups.map(powerup => [powerup.contentId, powerup]))
    this.#statuses = new Map(options.statuses.map(status => [status.contentId, status]))
    this.#skills = new Map(options.skills.map(skill => [skill.contentId, skill]))
    this.#spells = new Map(options.spells.map(spell => [spell.contentId, spell]))
    this.#enemies = new Map(options.enemies.map(enemy => [enemy.contentId, enemy]))
    this.#boneyards = new Map(options.boneyards.map(entry => [entry.contentId, entry]))
    this.#rooms = new Map(options.rooms.map(entry => [entry.contentId, entry]))
    this.#scenes = new Map(options.scenes.map(entry => [entry.contentId, entry]))
    this.#sceneExtensions = Object.freeze([...options.sceneExtensions].sort(compareContent))
    this.#shops = new Map(options.shops.map(entry => [entry.contentId, entry]))
    this.#ui = new Map(options.ui.map(entry => [entry.contentId, entry]))
  }

  all(): readonly PreparedModContentEntry[] {
    return this.#content
  }

  affix(contentId: string): PreparedModAffixDefinition | null {
    return this.#affixes.get(contentId) ?? null
  }

  affixPool(contentId: string): PreparedModAffixPoolDefinition | null {
    return this.#affixPools.get(contentId) ?? null
  }

  consumables(): readonly ModConsumableCatalogEntry[] {
    return Object.freeze(this.#potions.map(potion => potion.catalog))
  }

  content(contentId: string): PreparedModContentEntry | null {
    return this.#byId.get(contentId) ?? null
  }

  item(contentId: string): PreparedModItemDefinition | null {
    const content = this.#byId.get(contentId)
    return content?.contentKind === 'item' ? content as PreparedModItemDefinition : null
  }

  items(): readonly ModItemCatalogEntry[] {
    return Object.freeze(this.#items.map(item => item.catalog))
  }

  createLootItems(actorSeed: number, boss: boolean): readonly HubInventoryItem[] {
    if (!Number.isSafeInteger(actorSeed) || actorSeed < 0) {
      throw new RangeError('mod loot actor seed must be a non-negative safe integer')
    }
    return Object.freeze(this.#loot.flatMap((row, index) => (
      modLootUnitRoll(actorSeed, row.catalog.content.contentId, index) < (boss ? row.bossChance : row.chance)
        ? [modConsumableInventoryItem(row.catalog)]
        : []
    )))
  }

  potion(contentId: string): PreparedModPotionDefinition | null {
    const content = this.#byId.get(contentId)
    return content?.contentKind === 'potion' ? content as PreparedModPotionDefinition : null
  }

  powerup(contentId: string): PreparedModPowerupDefinition | null {
    return this.#powerups.get(contentId) ?? null
  }

  status(contentId: string): PreparedModStatusDefinition | null {
    return this.#statuses.get(contentId) ?? null
  }

  skill(contentId: string): PreparedModSkillDefinition | null {
    return this.#skills.get(contentId) ?? null
  }

  skills(): readonly PreparedModSkillDefinition[] {
    return Object.freeze([...this.#skills.values()].sort(compareContent))
  }

  spell(contentId: string): PreparedModSpellDefinition | null {
    return this.#spells.get(contentId) ?? null
  }

  spells(): readonly PreparedModSpellDefinition[] {
    return Object.freeze([...this.#spells.values()].sort(compareContent))
  }

  enemy(contentId: string): PreparedModEnemyDefinition | null {
    return this.#enemies.get(contentId) ?? null
  }

  enemies(): readonly PreparedModEnemyDefinition[] {
    return Object.freeze([...this.#enemies.values()].sort(compareContent))
  }

  boneyard(contentId: string) { return this.#boneyards.get(contentId) ?? null }
  room(contentId: string) { return this.#rooms.get(contentId) ?? null }
  scene(contentId: string) { return this.#scenes.get(contentId) ?? null }
  sceneExtensions() { return this.#sceneExtensions }
  shop(contentId: string) { return this.#shops.get(contentId) ?? null }
  ui(contentId: string) { return this.#ui.get(contentId) ?? null }
}

export function compileModContentCatalog(
  mods: readonly CompiledWebLuaMod[],
  assets: PreparedModAssetCatalog,
): PreparedModContentCatalog {
  const count = mods.reduce((total, mod) => total + mod.content.length, 0)
  if (count > MAXIMUM_CATALOG_CONTENT) throw new Error(`prepared mod catalog exceeds ${MAXIMUM_CATALOG_CONTENT} content entries`)
  const content: PreparedModContentEntry[] = []
  const statuses: PreparedModStatusDefinition[] = []
  const itemCandidates: PreparedModContentEntry[] = []
  const powerupCandidates: PreparedModContentEntry[] = []
  const affixCandidates: PreparedModContentEntry[] = []
  const affixPoolCandidates: PreparedModContentEntry[] = []
  const skillCandidates: PreparedModContentEntry[] = []
  const spellCandidates: PreparedModContentEntry[] = []
  const enemyCandidates: PreparedModContentEntry[] = []
  const boneyardCandidates: PreparedModContentEntry[] = []
  const shopCandidates: PreparedModContentEntry[] = []
  const uiCandidates: PreparedModContentEntry[] = []
  const roomCandidates: PreparedModContentEntry[] = []
  const sceneCandidates: PreparedModContentEntry[] = []
  const sceneExtensionCandidates: PreparedModContentEntry[] = []
  const potionCandidates: PreparedModContentEntry[] = []
  for (const mod of mods) {
    for (const definition of mod.content) {
      const common = compileCommon(mod, definition, assets)
      if (definition.contentKind === 'status') {
        const status = compileStatus(common)
        content.push(status)
        statuses.push(status)
      } else if (definition.contentKind === 'potion') {
        potionCandidates.push(common)
      } else if (definition.contentKind === 'item') {
        itemCandidates.push(common)
      } else if (definition.contentKind === 'powerup') {
        powerupCandidates.push(common)
      } else if (definition.contentKind === 'affix') {
        affixCandidates.push(common)
      } else if (definition.contentKind === 'affix-pool') {
        affixPoolCandidates.push(common)
      } else if (definition.contentKind === 'skill') {
        skillCandidates.push(common)
      } else if (definition.contentKind === 'spell') {
        spellCandidates.push(common)
      } else if (definition.contentKind === 'enemy') {
        enemyCandidates.push(common)
      } else if (definition.contentKind === 'boneyard') {
        boneyardCandidates.push(common)
      } else if (definition.contentKind === 'shop') {
        shopCandidates.push(common)
      } else if (definition.contentKind === 'ui') {
        uiCandidates.push(common)
      } else if (definition.contentKind === 'room') {
        roomCandidates.push(common)
      } else if (definition.contentKind === 'scene') {
        sceneCandidates.push(common)
      } else if (definition.contentKind === 'scene-extension') {
        sceneExtensionCandidates.push(common)
      } else content.push(common)
    }
  }
  const statusIds = new Set(statuses.map(status => status.contentId))
  const sortedPotions = [...potionCandidates].sort(compareContent)
  const potions = sortedPotions.map((common, index) => compilePotion(
    common,
    FIRST_CUSTOM_POTION_SUBTYPE + index,
    statusIds,
    assets,
  ))
  const items = itemCandidates.sort(compareContent).map(common => compileItem(common, assets))
  const powerups = powerupCandidates.sort(compareContent).map(common => compilePowerup(common))
  const affixes = affixCandidates.sort(compareContent).map(common => compileAffix(common))
  const affixIds = new Set(affixes.map(affix => affix.contentId))
  const affixPools = affixPoolCandidates.sort(compareContent).map(common => (
    compileAffixPool(common, affixIds)
  ))
  const skillIds = new Set(skillCandidates.map(skill => skill.contentId))
  const skills = skillCandidates.sort(compareContent).map(common => compileSkill(common, skillIds))
  const spells = spellCandidates.sort(compareContent).map(common => compileSpell(common))
  const spellIds = new Set(spells.map(spell => spell.contentId))
  const enemies = enemyCandidates.sort(compareContent).map(common => compileEnemy(common, spellIds))
  const boneyards = boneyardCandidates.sort(compareContent).map(compileBoneyard)
  const rooms = roomCandidates.sort(compareContent).map(compileRoom)
  const roomIds = new Set(rooms.map(room => room.contentId))
  const scenes = sceneCandidates.sort(compareContent).map(common => compileScene(common, roomIds))
  const sceneExtensions = sceneExtensionCandidates.sort(compareContent).map(compileSceneExtension)
  const itemIds = new Set([...items, ...potions].map(item => item.contentId))
  const shops = shopCandidates.sort(compareContent).map(common => compileShop(common, itemIds))
  const ui = uiCandidates.sort(compareContent).map(compileUi)
  content.push(
    ...items,
    ...potions,
    ...powerups,
    ...affixes,
    ...affixPools,
    ...skills,
    ...spells,
    ...enemies,
    ...boneyards,
    ...rooms,
    ...scenes,
    ...sceneExtensions,
    ...shops,
    ...ui,
  )
  const loot = potions.flatMap((potion): PreparedLootRow[] => potion.loot ? [{
    bossChance: potion.loot.boss,
    catalog: potion.catalog,
    chance: potion.loot.ordinary,
  }] : [])
  if (loot.length > MAXIMUM_LOOT_ROWS) throw new Error(`prepared mod loot exceeds ${MAXIMUM_LOOT_ROWS} rows`)
  return new PreparedModContentCatalog({
    affixes,
    affixPools,
    boneyards,
    content,
    enemies,
    items,
    loot,
    potions,
    powerups,
    rooms,
    scenes,
    sceneExtensions,
    shops,
    skills,
    spells,
    statuses,
    ui,
  })
}

export function modConsumableInventoryItem(
  catalog: ModConsumableCatalogEntry,
): HubInventoryItem {
  return Object.freeze({
    equipmentType: null,
    iconRecords: Object.freeze([]),
    id: 0,
    kind: 'mod-potion' as const,
    modContent: catalog.content,
    name: catalog.name,
    nativeSubtype: catalog.nativeSubtype,
    nativeTypeId: 7001,
    quantity: 1,
    rarity: null,
    recipeIndex: null,
  })
}

export function modItemInventoryItem(
  catalog: ModItemCatalogEntry,
  quantity = 1,
): HubInventoryItem {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > catalog.content.stackMaximum) {
    throw new Error(`mod item quantity must be within 1..${catalog.content.stackMaximum}`)
  }
  return Object.freeze({
    equipmentType: null,
    iconRecords: Object.freeze([]),
    id: 0,
    kind: 'mod-item' as const,
    modItemContent: catalog.content,
    name: catalog.name,
    nativeSubtype: null,
    nativeTypeId: 7013,
    quantity,
    rarity: null,
    recipeIndex: null,
  })
}

function compileCommon(
  mod: CompiledWebLuaMod,
  definition: CompiledWebLuaContent,
  assets: PreparedModAssetCatalog,
): PreparedModContentEntry {
  return Object.freeze({
    art: compileArt(mod.identity.id, definition.fields.art, assets, `${mod.identity.id}:${definition.key}.art`),
    contentId: definition.contentId,
    contentKind: definition.contentKind,
    description: optionalText(definition.fields.description, '', MAXIMUM_DESCRIPTION_BYTES, `${definition.key}.description`),
    fields: definition.fields,
    key: definition.key,
    modId: mod.identity.id,
    name: optionalText(definition.fields.name, humanize(definition.key), 128, `${definition.key}.name`),
  })
}

function compileStatus(common: PreparedModContentEntry): PreparedModStatusDefinition {
  return Object.freeze({
    ...common,
    contentKind: 'status' as const,
    durationMs: durationMs(common.fields.duration ?? 0, `${common.key}.duration`),
    modifiers: optionalObject(common.fields.modifiers, `${common.key}.modifiers`),
    scope: optionalText(common.fields.scope, 'participant-run', 64, `${common.key}.scope`),
    stacking: stacking(common.fields.stacking, `${common.key}.stacking`),
  })
}

function compileItem(
  common: PreparedModContentEntry,
  assets: PreparedModAssetCatalog,
): PreparedModItemDefinition {
  const icon = common.art.icon
  if (!icon) throw new Error(`${common.modId}:${common.key} item requires art.icon`)
  const sprite = assets.image(common.modId, icon.key)
  const stack = common.fields.stack === undefined
    ? {}
    : object(common.fields.stack, `${common.key}.stack`)
  const stackMaximum = stack.maximum === undefined
    ? 1
    : integer(stack.maximum, 1, 9_999, `${common.key}.stack.maximum`)
  const itemContent: ModItemContent = Object.freeze({
    contentId: common.contentId,
    description: common.description,
    icon: Object.freeze({
      atlasId: sprite.id,
      frame: sprite.frames[0]!,
      frameIndex: 0,
      imagePath: sprite.path,
    }),
    key: common.key,
    modId: common.modId,
    stackMaximum,
  })
  const use = common.fields.use
  if (use !== undefined && !isRule(use)) throw new Error(`${common.modId}:${common.key} item use must be a rule`)
  return Object.freeze({
    ...common,
    catalog: Object.freeze({ content: itemContent, name: common.name }),
    contentKind: 'item' as const,
    stackMaximum,
    use: use ?? null,
  })
}

function compilePowerup(common: PreparedModContentEntry): PreparedModPowerupDefinition {
  if (!common.art.world) throw new Error(`${common.modId}:${common.key} powerup requires art.world`)
  const effect = common.fields.effect
  if (!isRule(effect)) throw new Error(`${common.modId}:${common.key} powerup requires an effect rule`)
  const pickup = common.fields.pickup === undefined
    ? {}
    : object(common.fields.pickup, `${common.key}.pickup`)
  return Object.freeze({
    ...common,
    contentKind: 'powerup' as const,
    durationMs: durationMs(common.fields.duration ?? 0, `${common.key}.duration`),
    effect,
    pickupRadius: pickup.radius === undefined
      ? 32
      : number(pickup.radius, 1, 256, `${common.key}.pickup.radius`),
    scope: optionalText(common.fields.scope, 'participant-run', 64, `${common.key}.scope`),
    stacking: stacking(common.fields.stacking, `${common.key}.stacking`),
  })
}

function compileAffix(common: PreparedModContentEntry): PreparedModAffixDefinition {
  return Object.freeze({
    ...common,
    appliesTo: textArray(
      common.fields.applies_to ?? common.fields.equipment ?? [],
      `${common.key}.applies_to`,
    ),
    contentKind: 'affix' as const,
    modifiers: optionalObject(common.fields.modifiers, `${common.key}.modifiers`),
  })
}

function compileAffixPool(
  common: PreparedModContentEntry,
  affixIds: ReadonlySet<string>,
): PreparedModAffixPoolDefinition {
  if (!Array.isArray(common.fields.entries) || common.fields.entries.length === 0 ||
      common.fields.entries.length > 256) {
    throw new Error(`${common.modId}:${common.key} affix pool requires 1..256 entries`)
  }
  const entries = common.fields.entries.map((value, index) => {
    const entry = object(value, `${common.key}.entries[${index}]`)
    const affix = optionalReference(entry.affix, 'affix', `${common.key}.entries[${index}].affix`)
    if (!affix || !affixIds.has(affix.contentId)) {
      throw new Error(`${common.modId}:${common.key} affix pool entry is unavailable`)
    }
    return Object.freeze({
      affix,
      weight: entry.weight === undefined
        ? 1
        : number(entry.weight, Number.EPSILON, 1_000_000, `${common.key}.entries[${index}].weight`),
    })
  })
  return Object.freeze({
    ...common,
    appliesTo: textArray(common.fields.applies_to ?? [], `${common.key}.applies_to`),
    contentKind: 'affix-pool' as const,
    entries: Object.freeze(entries),
    rngDomain: optionalText(common.fields.rng_domain, common.key, 128, `${common.key}.rng_domain`),
    rolls: common.fields.rolls === undefined
      ? 1
      : integer(common.fields.rolls, 1, 8, `${common.key}.rolls`),
  })
}

function compileSkill(
  common: PreparedModContentEntry,
  skillIds: ReadonlySet<string>,
): PreparedModSkillDefinition {
  if (!common.art.icon) throw new Error(`${common.modId}:${common.key} skill requires art.icon`)
  if (!Array.isArray(common.fields.ranks) || common.fields.ranks.length === 0 ||
      common.fields.ranks.length > 99) {
    throw new Error(`${common.modId}:${common.key} skill requires 1..99 rank definitions`)
  }
  const ranks = common.fields.ranks.map((rank, index) => Object.freeze(object(
    rank,
    `${common.key}.ranks[${index}]`,
  )))
  const maximumRank = common.fields.maximum_rank ?? common.fields.max_rank ?? ranks.length
  const maximum = integer(maximumRank, 1, ranks.length, `${common.key}.maximum_rank`)
  const offer = common.fields.offer === undefined
    ? {}
    : object(common.fields.offer, `${common.key}.offer`)
  const parent = optionalReference(common.fields.parent, 'skill', `${common.key}.parent`)
  const prerequisites = common.fields.prerequisites === undefined
    ? []
    : referenceArray(common.fields.prerequisites, 'skill', `${common.key}.prerequisites`)
  if ((parent && !skillIds.has(parent.contentId)) || prerequisites.some(ref => !skillIds.has(ref.contentId))) {
    throw new Error(`${common.modId}:${common.key} skill dependency is unavailable`)
  }
  return Object.freeze({
    ...common,
    contentKind: 'skill' as const,
    maximumRank: maximum,
    minimumLevel: offer.minimum_level === undefined
      ? 1
      : integer(offer.minimum_level, 1, 999, `${common.key}.offer.minimum_level`),
    offerWeight: offer.weight === undefined
      ? 1
      : number(offer.weight, Number.EPSILON, 1_000_000, `${common.key}.offer.weight`),
    parent,
    prerequisites,
    ranks: Object.freeze(ranks.slice(0, maximum)),
  })
}

function compileSpell(common: PreparedModContentEntry): PreparedModSpellDefinition {
  if (!common.art.icon) throw new Error(`${common.modId}:${common.key} spell requires art.icon`)
  const behavior = common.fields.behavior
  if (!isRule(behavior)) throw new Error(`${common.modId}:${common.key} spell requires a behavior prefab`)
  const slot = common.fields.slot
  if (slot !== 'primary' && slot !== 'secondary') {
    throw new Error(`${common.modId}:${common.key} spell slot must be primary or secondary`)
  }
  const subskills = common.fields.subskills === undefined
    ? {}
    : object(common.fields.subskills, `${common.key}.subskills`)
  return Object.freeze({
    ...common,
    behavior,
    contentKind: 'spell' as const,
    cooldownMs: durationMs(common.fields.cooldown ?? 0, `${common.key}.cooldown`),
    mana: common.fields.mana === undefined
      ? 0
      : number(common.fields.mana, 0, 1_000_000, `${common.key}.mana`),
    slot,
    subskills: Object.freeze(Object.fromEntries(Object.entries(subskills).map(([key, value]) => [
      key,
      Object.freeze(object(value, `${common.key}.subskills.${key}`)),
    ]))),
    targeting: optionalObject(common.fields.targeting, `${common.key}.targeting`),
  })
}

function compileEnemy(
  common: PreparedModContentEntry,
  spellIds: ReadonlySet<string>,
): PreparedModEnemyDefinition {
  if (!common.art.atlas) throw new Error(`${common.modId}:${common.key} enemy requires art.atlas`)
  if (typeof common.fields.base !== 'string' || common.fields.base.length === 0) {
    throw new Error(`${common.modId}:${common.key} enemy requires a verified base`)
  }
  const stats = common.fields.stats === undefined
    ? {}
    : object(common.fields.stats, `${common.key}.stats`)
  const attacks = common.fields.attacks === undefined
    ? []
    : referenceArray(common.fields.attacks, 'spell', `${common.key}.attacks`)
  if (attacks.some(attack => !spellIds.has(attack.contentId))) {
    throw new Error(`${common.modId}:${common.key} enemy attack is unavailable`)
  }
  const behavior = common.fields.behavior
  if (behavior !== undefined && !isRule(behavior)) {
    throw new Error(`${common.modId}:${common.key} enemy behavior must be a prefab`)
  }
  return Object.freeze({
    ...common,
    attacks,
    base: common.fields.base,
    behavior: behavior ?? null,
    contentKind: 'enemy' as const,
    health: stats.health === undefined
      ? 100
      : number(stats.health, 1, 1_000_000_000, `${common.key}.stats.health`),
    scale: stats.scale === undefined
      ? 1
      : number(stats.scale, 0.1, 10, `${common.key}.stats.scale`),
    speed: stats.speed === undefined
      ? 2
      : number(stats.speed, 0, 100, `${common.key}.stats.speed`),
  })
}

function compileBoneyard(common: PreparedModContentEntry): PreparedModBoneyardDefinition {
  const source = common.fields.source
  if (typeof source !== 'string' || !/^levels\/.+\.boneyard$/.test(source)) {
    throw new Error(`${common.modId}:${common.key} Boneyard source is invalid`)
  }
  return Object.freeze({ ...common, contentKind: 'boneyard' as const, source })
}

function compileRoom(common: PreparedModContentEntry): PreparedModRoomDefinition {
  return Object.freeze({
    ...common,
    anchors: optionalObject(common.fields.anchors, `${common.key}.anchors`),
    contentKind: 'room' as const,
    geometry: optionalObject(common.fields.geometry, `${common.key}.geometry`),
  })
}

function compileScene(
  common: PreparedModContentEntry,
  roomIds: ReadonlySet<string>,
): PreparedModSceneDefinition {
  const rooms = referenceArray(common.fields.rooms ?? [], 'room', `${common.key}.rooms`)
  if (rooms.length === 0 || rooms.some(room => !roomIds.has(room.contentId))) {
    throw new Error(`${common.modId}:${common.key} scene rooms are unavailable`)
  }
  const instance = common.fields.instance
  if (instance !== 'party' && instance !== 'player' && instance !== 'session') {
    throw new Error(`${common.modId}:${common.key} scene instance is invalid`)
  }
  return Object.freeze({ ...common, contentKind: 'scene' as const, instance, rooms })
}

function compileSceneExtension(common: PreparedModContentEntry): PreparedModSceneExtensionDefinition {
  if (typeof common.fields.scene !== 'string' || common.fields.scene.length === 0 ||
      !Array.isArray(common.fields.features) || !common.fields.features.every(isRule)) {
    throw new Error(`${common.modId}:${common.key} scene extension is invalid`)
  }
  return Object.freeze({
    ...common,
    contentKind: 'scene-extension' as const,
    features: Object.freeze(common.fields.features),
    scene: common.fields.scene,
  })
}

function compileShop(
  common: PreparedModContentEntry,
  itemIds: ReadonlySet<string>,
): PreparedModShopDefinition {
  if (!Array.isArray(common.fields.stock) || common.fields.stock.length === 0) {
    throw new Error(`${common.modId}:${common.key} shop requires stock`)
  }
  const stock = common.fields.stock.map((value, index) => {
    const row = object(value, `${common.key}.stock[${index}]`)
    const item = resolvedReference(row.item, `${common.key}.stock[${index}].item`)
    if (!itemIds.has(item.contentId) || (item.targetKind !== 'item' && item.targetKind !== 'potion')) {
      throw new Error(`${common.modId}:${common.key} shop item is unavailable`)
    }
    return Object.freeze({
      item,
      price: integer(row.price, 0, 10_000_000, `${common.key}.stock[${index}].price`),
      quantity: row.quantity === undefined
        ? 1
        : integer(row.quantity, 1, 9_999, `${common.key}.stock[${index}].quantity`),
    })
  })
  return Object.freeze({
    ...common,
    contentKind: 'shop' as const,
    currency: optionalText(common.fields.currency, 'gold', 64, `${common.key}.currency`),
    mount: common.fields.mount === undefined ? null : optionalObject(common.fields.mount, `${common.key}.mount`),
    stock: Object.freeze(stock),
  })
}

function compileUi(common: PreparedModContentEntry): PreparedModUiDefinition {
  if (typeof common.fields.mount !== 'string' || !isRule(common.fields.view)) {
    throw new Error(`${common.modId}:${common.key} UI mount or view is invalid`)
  }
  return Object.freeze({
    ...common,
    actions: common.fields.actions === undefined ? Object.freeze([]) : textArray(common.fields.actions, `${common.key}.actions`),
    contentKind: 'ui' as const,
    mount: common.fields.mount,
    view: common.fields.view,
  })
}

function compilePotion(
  common: PreparedModContentEntry,
  nativeSubtype: number,
  statusIds: ReadonlySet<string>,
  assets: PreparedModAssetCatalog,
): PreparedModPotionDefinition {
  const icon = common.art.icon
  if (!icon) throw new Error(`${common.modId}:${common.key} potion requires art.icon`)
  const sprite = assets.image(common.modId, icon.key)
  const duration = durationMs(common.fields.duration, `${common.key}.duration`)
  const onUse = common.fields.on_use
  if (!isRule(onUse)) throw new Error(`${common.modId}:${common.key} potion requires an on_use rule`)
  const status = optionalReference(common.fields.status, 'status', `${common.key}.status`)
  if (status && !statusIds.has(status.contentId)) {
    throw new Error(`${common.modId}:${common.key} potion status is unavailable: ${status.contentId}`)
  }
  const loot = compileLoot(common.fields.loot, `${common.key}.loot`)
  const content: ModConsumableContent = Object.freeze({
    consumeVfx: consumeVfx(common.fields.presentation),
    contentId: common.contentId,
    description: common.description,
    durationMs: duration,
    icon: Object.freeze({
      atlasId: sprite.id,
      frame: sprite.frames[0]!,
      frameIndex: 0,
      imagePath: sprite.path,
    }),
    key: common.key,
    modId: common.modId,
  })
  const catalog: ModConsumableCatalogEntry = Object.freeze({
    content,
    name: common.name,
    nativeSubtype,
  })
  return Object.freeze({
    ...common,
    catalog,
    contentKind: 'potion' as const,
    loot,
    onUse,
    status,
  })
}

function compileArt(
  modId: string,
  value: WebLuaDefinitionValue | undefined,
  assets: PreparedModAssetCatalog,
  field: string,
): Readonly<Record<string, PreparedModArtBinding>> {
  if (value === undefined || value === null) return Object.freeze({})
  const source = object(value, field)
  const bindings: Record<string, PreparedModArtBinding> = {}
  for (const [slot, candidate] of Object.entries(source)) {
    if (!isAssetReference(candidate)) throw new Error(`${field}.${slot} must reference a declared asset`)
    const asset = assets.get(modId, candidate.key)
    if (!asset) throw new Error(`${field}.${slot} references an unavailable asset: ${candidate.key}`)
    bindings[slot] = Object.freeze({
      assetId: asset.id,
      assetKind: asset.assetKind,
      key: asset.key,
      path: asset.path,
    })
  }
  return Object.freeze(bindings)
}

function consumeVfx(
  value: WebLuaDefinitionValue | undefined,
): ModConsumableContent['consumeVfx'] {
  if (value !== undefined && value !== null) {
    const presentation = object(value, 'potion.presentation')
    const effect = presentation.consume_vfx
    if (effect !== undefined && effect !== null) {
      const descriptor = object(effect, 'potion.presentation.consume_vfx')
      if (descriptor.kind !== 'spell_glow' || !Array.isArray(descriptor.color) || descriptor.color.length !== 4) {
        throw new Error('potion presentation consume_vfx is invalid')
      }
      const color = descriptor.color.map((component, index) => number(
        component,
        0,
        1,
        `potion.presentation.consume_vfx.color[${index}]`,
      )) as unknown as [number, number, number, number]
      return Object.freeze({ color: Object.freeze(color), kind: 'spell_glow' as const })
    }
  }
  return Object.freeze({
    color: Object.freeze([0.15, 1, 0.25, 1] as const),
    kind: 'spell_glow' as const,
  })
}

function compileLoot(
  value: WebLuaDefinitionValue | undefined,
  field: string,
): Readonly<{ boss: number; ordinary: number }> | null {
  if (value === undefined || value === null) return null
  const source = object(value, field)
  return Object.freeze({
    boss: number(source.boss ?? 0, 0, 1, `${field}.boss`),
    ordinary: number(source.ordinary ?? 0, 0, 1, `${field}.ordinary`),
  })
}

function durationMs(value: unknown, field: string): number {
  if (Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= MAXIMUM_DURATION_MS) {
    return Number(value)
  }
  if (typeof value !== 'string') throw new Error(`${field} is not a duration`)
  const match = /^(0|[1-9][0-9]*)(?:\.([0-9]+))?(ms|s|m|h)$/.exec(value)
  if (!match) throw new Error(`${field} is not a duration`)
  const amount = Number(`${match[1]}.${match[2] ?? '0'}`)
  const scale = match[3] === 'ms' ? 1 : match[3] === 's' ? 1_000 : match[3] === 'm' ? 60_000 : 3_600_000
  const result = amount * scale
  if (!Number.isFinite(result) || result < 0 || result > MAXIMUM_DURATION_MS) throw new Error(`${field} exceeds its duration limit`)
  return result
}

function stacking(value: unknown, field: string): ModStatusStacking {
  const result = value === undefined ? 'refresh' : value
  if (typeof result !== 'string' || !STACKING.has(result as ModStatusStacking)) {
    throw new Error(`${field} is not a supported stacking policy`)
  }
  return result as ModStatusStacking
}

function optionalReference(
  value: WebLuaDefinitionValue | undefined,
  kind: WebLuaContentKind,
  field: string,
): ResolvedWebLuaContentReference | null {
  if (value === undefined || value === null) return null
  if (!isResolvedReference(value) || value.targetKind !== kind) throw new Error(`${field} must reference ${kind}`)
  return value
}

function resolvedReference(
  value: WebLuaDefinitionValue | undefined,
  field: string,
): ResolvedWebLuaContentReference {
  if (!isResolvedReference(value)) throw new Error(`${field} must be a resolved content reference`)
  return value
}

function referenceArray(
  value: WebLuaDefinitionValue,
  kind: WebLuaContentKind,
  field: string,
): readonly ResolvedWebLuaContentReference[] {
  if (!Array.isArray(value) || value.length > 64) throw new Error(`${field} must be an array of references`)
  return Object.freeze(value.map((entry, index) => {
    const reference = optionalReference(entry, kind, `${field}[${index}]`)
    if (!reference) throw new Error(`${field}[${index}] requires ${kind}`)
    return reference
  }))
}

function optionalObject(
  value: WebLuaDefinitionValue | undefined,
  field: string,
): Readonly<Record<string, WebLuaDefinitionValue>> {
  return value === undefined || value === null ? Object.freeze({}) : Object.freeze(object(value, field))
}

function optionalText(
  value: unknown,
  fallback: string,
  maximumBytes: number,
  field: string,
): string {
  if (value === undefined) return fallback
  if (typeof value !== 'string' || value.includes('\0') || textEncoder.encode(value).length > maximumBytes) {
    throw new Error(`${field} must contain at most ${maximumBytes} bytes of text`)
  }
  return value
}

function textArray(value: WebLuaDefinitionValue, field: string): readonly string[] {
  if (!Array.isArray(value) || value.length > 64) throw new Error(`${field} must be an array of text`)
  const values = value.map((entry, index) => optionalText(entry, '', 64, `${field}[${index}]`))
  if (values.some(value => value.length === 0) || new Set(values).size !== values.length) {
    throw new Error(`${field} contains invalid or duplicate text`)
  }
  return Object.freeze(values)
}

function number(value: unknown, minimum: number, maximum: number, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${field} must be finite within ${minimum}..${maximum}`)
  }
  return value
}

function integer(value: unknown, minimum: number, maximum: number, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new Error(`${field} must be an integer within ${minimum}..${maximum}`)
  }
  return Number(value)
}

function object(value: unknown, field: string): Record<string, WebLuaDefinitionValue> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${field} must be an object`)
  return value as Record<string, WebLuaDefinitionValue>
}

function isRule(value: unknown): value is WebLuaRuleDefinition {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) &&
    (value as { kind?: unknown }).kind === 'rule-definition')
}

function isAssetReference(value: unknown): value is Readonly<{ key: string; kind: 'asset-reference' }> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) &&
    (value as { kind?: unknown }).kind === 'asset-reference' &&
    typeof (value as { key?: unknown }).key === 'string')
}

function isResolvedReference(value: unknown): value is ResolvedWebLuaContentReference {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) &&
    (value as { kind?: unknown }).kind === 'resolved-content-reference')
}

function compareContent(
  left: Pick<PreparedModContentEntry, 'contentId' | 'modId'>,
  right: Pick<PreparedModContentEntry, 'contentId' | 'modId'>,
): number {
  const byMod = left.modId.localeCompare(right.modId)
  if (byMod !== 0) return byMod
  const leftId = BigInt(left.contentId)
  const rightId = BigInt(right.contentId)
  return leftId < rightId ? -1 : leftId > rightId ? 1 : 0
}

function humanize(key: string): string {
  return key.split(/[._-]+/).filter(Boolean).map(word => `${word[0]?.toUpperCase() ?? ''}${word.slice(1)}`).join(' ')
}

function modLootUnitRoll(actorSeed: number, contentId: string, index: number): number {
  let mixed = BigInt.asUintN(64, BigInt(actorSeed) ^ BigInt(contentId) ^ BigInt(index + 1))
  mixed = BigInt.asUintN(64, mixed + 0x9e3779b97f4a7c15n)
  mixed = BigInt.asUintN(64, (mixed ^ mixed >> 30n) * 0xbf58476d1ce4e5b9n)
  mixed = BigInt.asUintN(64, (mixed ^ mixed >> 27n) * 0x94d049bb133111ebn)
  mixed ^= mixed >> 31n
  return Number(mixed >> 11n) / 0x20_0000_0000_0000
}
