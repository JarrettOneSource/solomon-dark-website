import {
  MOD_ITEM_NATIVE_TYPE_ID,
  type HubInventoryItem,
  type ModItemIcon,
  type ModConsumableCatalogEntry,
  type ModConsumableContent,
  type ModItemCatalogEntry,
  type ModItemContent,
  type ModSpriteFrame,
} from '../../core-kernels/hub-economy.ts'
import {
  createModBoastSelection,
  type BoastFailureProducer,
  type ModBoastSelection,
} from '../../core-kernels/boast.ts'
import {
  WEB_LUA_CONTENT_ART_SLOTS,
  type CompiledWebLuaContent,
  type CompiledWebLuaMod,
  type ResolvedWebLuaContentReference,
  type WebLuaContentKind,
  type WebLuaDefinitionValue,
  type WebLuaRuleDefinition,
} from '../definition/index.ts'
import {
  PreparedModAssetCatalog,
  type PreparedModAsset,
  type PreparedModSpriteAsset,
} from '../assets/index.ts'

const FIRST_CUSTOM_POTION_SUBTYPE = 6
const MAXIMUM_CATALOG_CONTENT = 4_096
const MAXIMUM_DESCRIPTION_BYTES = 1_024
const MAXIMUM_DURATION_MS = 24 * 60 * 60 * 1_000
const MAXIMUM_LOOT_ROWS = 1_024
const BOAST_FAILURE_PRODUCERS = new Set<BoastFailureProducer>([
  'magical-equipment',
  'mana-underflow',
  'potion-use',
  'secondary-cast',
])
const STACKING = new Set<ModStatusStacking>(['ignore', 'refresh', 'replace', 'stack'])
const EQUIPMENT_TYPES = new Set(['amulet', 'hat', 'ring', 'robe', 'staff', 'wand'])
const textEncoder = new TextEncoder()
const CONTENT_ART_SLOTS = WEB_LUA_CONTENT_ART_SLOTS

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
  readonly effect: WebLuaRuleDefinition
  readonly pickupRadius: number
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
  readonly grants: readonly ResolvedWebLuaContentReference[]
  readonly maximumRank: number
  readonly minimumLevel: number
  readonly offerWeight: number
  readonly parent: ResolvedWebLuaContentReference | null
  readonly prerequisites: readonly ResolvedWebLuaContentReference[]
  readonly rankGrants: readonly (readonly ResolvedWebLuaContentReference[])[]
  readonly ranks: readonly Readonly<Record<string, WebLuaDefinitionValue>>[]
}

export interface PreparedModSpellDefinition extends PreparedModContentEntry {
  readonly behavior: WebLuaRuleDefinition
  readonly contentKind: 'spell'
  readonly cooldownMs: number
  readonly mana: number
  readonly slot: 'primary' | 'secondary'
}

export interface PreparedModEnemyDefinition extends PreparedModContentEntry {
  readonly attackCooldownMs: number
  readonly attackDamage: number
  readonly attackRange: number
  readonly contentKind: 'enemy'
  readonly health: number
  readonly collisionRadius: number
  readonly goldMaximum: number
  readonly goldMinimum: number
  readonly experience: number
  readonly scale: number
  readonly speed: number
}

export interface PreparedModBoneyardDefinition extends PreparedModContentEntry {
  readonly anchors: Readonly<Record<string, WebLuaDefinitionValue>>
  readonly contentKind: 'boneyard'
  readonly environment: Readonly<Record<string, WebLuaDefinitionValue>>
  readonly roster: readonly WebLuaDefinitionValue[]
  readonly source: string
  readonly triggers: readonly WebLuaRuleDefinition[]
  readonly waves: readonly Readonly<Record<string, WebLuaDefinitionValue>>[]
}

export type PreparedModBoastIcon =
  | Readonly<{
      kind: 'mod'
      frame: ModSpriteFrame
      imageHeight: number
      imagePath: string
      imageWidth: number
    }>
  | Readonly<{
      kind: 'stock'
      record: number
      style: number
    }>

export interface PreparedModBoastDefinition extends PreparedModContentEntry {
  readonly contentKind: 'boast'
  readonly failureProducers: readonly BoastFailureProducer[]
  readonly icon: PreparedModBoastIcon
  readonly instruction: string
  readonly label: string
  readonly randomSkillChoices: boolean
  readonly response: string
  readonly scoreMultiplier: number
  readonly selection: ModBoastSelection
  readonly statement: string
  readonly successWave: number
}

export interface PreparedModShopDefinition extends PreparedModContentEntry {
  readonly contentKind: 'shop'
  readonly mount: Readonly<Record<string, WebLuaDefinitionValue>> | null
  readonly npc: Readonly<Record<string, WebLuaDefinitionValue>> | null
  readonly restockMs: number
  readonly services: readonly Readonly<{
    pool: ResolvedWebLuaContentReference
    price: number
    type: 'reforge'
  }>[]
  readonly stock: readonly Readonly<{
    item: ResolvedWebLuaContentReference
    price: number
    quantity: number
  }>[]
  readonly stockScope: 'party' | 'player' | 'session'
}

export interface PreparedModUiDefinition extends PreparedModContentEntry {
  readonly accessibleName: string
  readonly actions: readonly string[]
  readonly bindings: Readonly<Record<string, WebLuaDefinitionValue>>
  readonly contentKind: 'ui'
  readonly mount: string
  readonly visible: Readonly<Record<string, WebLuaDefinitionValue>>
  readonly view: WebLuaRuleDefinition
}

export interface PreparedModRoomDefinition extends PreparedModContentEntry {
  readonly contentKind: 'room'
  readonly geometry: Readonly<Record<string, WebLuaDefinitionValue>>
}

export interface PreparedModSceneDefinition extends PreparedModContentEntry {
  readonly contentKind: 'scene'
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
  readonly #boasts: ReadonlyMap<string, PreparedModBoastDefinition>
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
    boasts: readonly PreparedModBoastDefinition[]
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
    this.#boasts = new Map(options.boasts.map(entry => [entry.contentId, entry]))
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
  boast(contentId: string) { return this.#boasts.get(contentId) ?? null }
  boasts() { return Object.freeze([...this.#boasts.values()].sort(compareContent)) }
  room(contentId: string) { return this.#rooms.get(contentId) ?? null }
  scene(contentId: string) { return this.#scenes.get(contentId) ?? null }
  sceneExtensions() { return this.#sceneExtensions }
  shop(contentId: string) { return this.#shops.get(contentId) ?? null }
  ui(contentId: string) { return this.#ui.get(contentId) ?? null }
  uis() { return Object.freeze([...this.#ui.values()].sort(compareContent)) }
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
  const boastCandidates: PreparedModContentEntry[] = []
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
      } else if (definition.contentKind === 'boast') {
        boastCandidates.push(common)
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
  const declaredIds = new Set(mods.flatMap(mod => mod.content.map(entry => entry.contentId)))
  const skills = skillCandidates.sort(compareContent).map(common => compileSkill(
    common,
    skillIds,
    declaredIds,
  ))
  const spells = spellCandidates.sort(compareContent).map(common => compileSpell(common))
  const enemies = enemyCandidates.sort(compareContent).map(common => compileEnemy(common))
  const boneyards = boneyardCandidates.sort(compareContent).map(compileBoneyard)
  const boasts = boastCandidates.sort(compareContent).map(common => compileBoast(common, assets))
  const rooms = roomCandidates.sort(compareContent).map(compileRoom)
  const roomIds = new Set(rooms.map(room => room.contentId))
  const scenes = sceneCandidates.sort(compareContent).map(common => compileScene(common, roomIds))
  const sceneExtensions = sceneExtensionCandidates.sort(compareContent).map(compileSceneExtension)
  const itemIds = new Set([...items, ...potions].map(item => item.contentId))
  const wearableItemIds = new Set(items.filter(item => item.catalog.content.wearable).map(item => item.contentId))
  const shops = shopCandidates.sort(compareContent).map(common => compileShop(
    common,
    itemIds,
    wearableItemIds,
    new Set(affixPools.map(pool => pool.contentId)),
  ))
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
    ...boasts,
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
    boasts,
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
  const wearable = catalog.content.wearable
  if (wearable && quantity !== 1) throw new Error('mod wearable quantity must be one')
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > catalog.content.stackMaximum) {
    throw new Error(`mod item quantity must be within 1..${catalog.content.stackMaximum}`)
  }
  return Object.freeze({
    equipmentType: wearable?.slot ?? null,
    iconRecords: Object.freeze([]),
    ...(catalog.iconTints === undefined ? {} : { iconTints: catalog.iconTints }),
    id: 0,
    kind: wearable ? 'equipment' as const : 'mod-item' as const,
    modItemContent: catalog.content,
    name: catalog.name,
    nativeSubtype: null,
    nativeTypeId: MOD_ITEM_NATIVE_TYPE_ID,
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
  if (definition.fields.art !== undefined) {
    exactObjectKeys(
      object(definition.fields.art, `${mod.identity.id}:${definition.key}.art`),
      CONTENT_ART_SLOTS[definition.contentKind],
      `${mod.identity.id}:${definition.key}.art`,
    )
  }
  const art = compileArt(mod.identity.id, definition.fields.art, assets, `${mod.identity.id}:${definition.key}.art`)
  for (const slot of ['ambience', 'loop', 'music'] as const) {
    if (art[slot] && art[slot]!.assetKind !== 'music' && art[slot]!.assetKind !== 'sound') {
      throw new Error(`${mod.identity.id}:${definition.key} art.${slot} must be audio`)
    }
  }
  return Object.freeze({
    art,
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
  const modifiers = optionalObject(common.fields.modifiers, `${common.key}.modifiers`)
  exactObjectKeys(modifiers, ['incoming_damage', 'mana_spend'], `${common.key}.modifiers`)
  validateModifierMap(modifiers, `${common.key}.modifiers`)
  return Object.freeze({
    ...common,
    contentKind: 'status' as const,
    durationMs: durationMs(common.fields.duration ?? 0, `${common.key}.duration`),
    modifiers,
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
  exactObjectKeys(stack, ['maximum'], `${common.key}.stack`)
  const stackMaximum = stack.maximum === undefined
    ? 1
    : integer(stack.maximum, 1, 9_999, `${common.key}.stack.maximum`)
  const equipment = common.fields.equipment === undefined
    ? null
    : object(common.fields.equipment, `${common.key}.equipment`)
  const wearable = equipment === null
    ? null
    : compileWearable(common, equipment, assets)
  if (wearable && stackMaximum !== 1) {
    throw new Error(`${common.modId}:${common.key} wearable equipment cannot stack`)
  }
  const iconTrim = common.art.icon_trim
  const iconTrimAsset = iconTrim ? assets.image(common.modId, iconTrim.key) : null
  if ((iconTrimAsset === null) !== (wearable?.wornTrim === null || wearable === null)) {
    throw new Error(`${common.modId}:${common.key} wearable icon and worn trim layers must be paired`)
  }
  if (iconTrimAsset && !sameIconFrame(sprite.frames[0]!, iconTrimAsset.frames[0]!)) {
    throw new Error(`${common.modId}:${common.key} wearable icon layers must have identical frames`)
  }
  if (!wearable && (common.art.worn || common.art.worn_trim || common.art.icon_trim)) {
    throw new Error(`${common.modId}:${common.key} wearable art requires equipment`)
  }
  const iconContent = (asset: PreparedModSpriteAsset): ModItemIcon => Object.freeze({
    atlasId: asset.id,
    frame: asset.frames[0]!,
    frameIndex: 0,
    imagePath: asset.path,
  })
  const itemContent: ModItemContent = Object.freeze({
    contentId: common.contentId,
    description: common.description,
    icon: iconContent(sprite),
    ...(iconTrimAsset ? { iconTrimImagePath: iconTrimAsset.path } : {}),
    key: common.key,
    modId: common.modId,
    stackMaximum,
    ...(wearable ? { wearable: wearable.content } : {}),
  })
  const use = common.fields.use
  if (use !== undefined && !isRule(use)) throw new Error(`${common.modId}:${common.key} item use must be a rule`)
  if (wearable && use !== undefined) throw new Error(`${common.modId}:${common.key} wearable equipment cannot be consumed`)
  return Object.freeze({
    ...common,
    catalog: Object.freeze({
      content: itemContent,
      ...(wearable?.iconTints ? { iconTints: wearable.iconTints } : {}),
      name: common.name,
    }),
    contentKind: 'item' as const,
    stackMaximum,
    use: use ?? null,
  })
}

function compileWearable(
  common: PreparedModContentEntry,
  equipment: Record<string, WebLuaDefinitionValue>,
  assets: PreparedModAssetCatalog,
): Readonly<{
  content: NonNullable<ModItemContent['wearable']>
  iconTints: readonly [number, number] | null
  wornTrim: PreparedModSpriteAsset | null
}> {
  exactObjectKeys(equipment, ['death_shape', 'dyeable', 'slot', 'tints'], `${common.key}.equipment`)
  const slot = equipment.slot
  if (slot !== 'hat' && slot !== 'robe' && slot !== 'staff') {
    throw new Error(`${common.modId}:${common.key} equipment slot must be hat, robe, or staff`)
  }
  const wornBinding = common.art.worn
  if (!wornBinding) throw new Error(`${common.modId}:${common.key} wearable equipment requires art.worn`)
  const worn = assets.image(common.modId, wornBinding.key)
  const maximumRows = slot === 'hat' ? 1 : slot === 'robe' ? 5 : 10
  validateWearableSheet(worn, maximumRows, `${common.modId}:${common.key}.art.worn`)
  const wornTrimBinding = common.art.worn_trim
  const wornTrim = wornTrimBinding ? assets.image(common.modId, wornTrimBinding.key) : null
  if (wornTrim) {
    validateWearableSheet(wornTrim, maximumRows, `${common.modId}:${common.key}.art.worn_trim`)
    if (worn.width !== wornTrim.width || worn.height !== wornTrim.height) {
      throw new Error(`${common.modId}:${common.key} wearable worn layers must have identical dimensions`)
    }
  }
  const dyeable = equipment.dyeable === undefined
    ? false
    : boolean(equipment.dyeable, `${common.key}.equipment.dyeable`)
  if (slot === 'staff' && (dyeable || wornTrim)) {
    throw new Error(`${common.modId}:${common.key} staff equipment cannot declare dye layers`)
  }
  if (dyeable && !wornTrim) {
    throw new Error(`${common.modId}:${common.key} dyeable equipment requires worn and icon trim layers`)
  }
  const maximumDeathShape = slot === 'hat' ? 3 : slot === 'robe' ? 2 : 5
  const deathShape = equipment.death_shape === undefined
    ? 0
    : integer(equipment.death_shape, 0, maximumDeathShape, `${common.key}.equipment.death_shape`)
  const iconTints = slot === 'staff'
    ? null
    : (() => {
        const tints = equipment.tints === undefined
          ? {}
          : object(equipment.tints, `${common.key}.equipment.tints`)
        exactObjectKeys(tints, ['cloth', 'trim'], `${common.key}.equipment.tints`)
        return Object.freeze([
          tints.cloth === undefined
            ? 0xffffff
            : integer(tints.cloth, 0, 0xffffff, `${common.key}.equipment.tints.cloth`),
          tints.trim === undefined
            ? 0xffffff
            : integer(tints.trim, 0, 0xffffff, `${common.key}.equipment.tints.trim`),
        ] as const)
      })()
  if (slot === 'staff' && equipment.tints !== undefined) {
    throw new Error(`${common.modId}:${common.key} staff equipment cannot declare tints`)
  }
  return Object.freeze({
    content: Object.freeze({
      deathShape,
      dyeable,
      slot,
      wornImagePath: worn.path,
      ...(wornTrim ? { wornTrimImagePath: wornTrim.path } : {}),
    }),
    iconTints,
    wornTrim,
  })
}

function validateWearableSheet(
  asset: PreparedModSpriteAsset,
  maximumRows: number,
  field: string,
): void {
  if (asset.assetKind !== 'sheet' || asset.width !== 24 * 170 || asset.height % 170 !== 0) {
    throw new Error(`${field} must be a 24-column sheet of 170 px frames`)
  }
  const rows = asset.height / 170
  if (rows < 1 || rows > maximumRows || asset.frames.length !== rows * 24) {
    throw new Error(`${field} must contain 1..${maximumRows} pose rows`)
  }
}

function sameIconFrame(left: ModItemIcon['frame'], right: ModItemIcon['frame']): boolean {
  return left.width === right.width
    && left.height === right.height
    && left.logicalWidth === right.logicalWidth
    && left.logicalHeight === right.logicalHeight
    && left.centerOffsetX === right.centerOffsetX
    && left.centerOffsetY === right.centerOffsetY
}

function compilePowerup(common: PreparedModContentEntry): PreparedModPowerupDefinition {
  if (!common.art.world || (common.art.world.assetKind !== 'sprite' && common.art.world.assetKind !== 'sheet')) {
    throw new Error(`${common.modId}:${common.key} powerup requires image art.world`)
  }
  if (common.art.sound && common.art.sound.assetKind !== 'sound') {
    throw new Error(`${common.modId}:${common.key} powerup art.sound must be a sound`)
  }
  const effect = common.fields.effect
  if (!isRule(effect)) throw new Error(`${common.modId}:${common.key} powerup requires an effect rule`)
  const pickup = common.fields.pickup === undefined
    ? {}
    : object(common.fields.pickup, `${common.key}.pickup`)
  exactObjectKeys(pickup, ['radius'], `${common.key}.pickup`)
  return Object.freeze({
    ...common,
    contentKind: 'powerup' as const,
    effect,
    pickupRadius: pickup.radius === undefined
      ? 32
      : number(pickup.radius, 1, 256, `${common.key}.pickup.radius`),
  })
}

function compileAffix(common: PreparedModContentEntry): PreparedModAffixDefinition {
  const modifiers = optionalObject(common.fields.modifiers, `${common.key}.modifiers`)
  exactObjectKeys(modifiers, ['incoming_damage', 'mana_spend'], `${common.key}.modifiers`)
  validateModifierMap(modifiers, `${common.key}.modifiers`)
  const appliesTo = textArray(common.fields.applies_to ?? [], `${common.key}.applies_to`)
  if (appliesTo.some(type => !EQUIPMENT_TYPES.has(type))) {
    throw new Error(`${common.modId}:${common.key} affix applies_to contains an unknown equipment type`)
  }
  return Object.freeze({
    ...common,
    appliesTo,
    contentKind: 'affix' as const,
    modifiers,
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
    exactObjectKeys(entry, ['affix', 'weight'], `${common.key}.entries[${index}]`)
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
  const appliesTo = textArray(common.fields.applies_to ?? [], `${common.key}.applies_to`)
  if (appliesTo.some(type => !EQUIPMENT_TYPES.has(type))) {
    throw new Error(`${common.modId}:${common.key} affix pool applies_to contains an unknown equipment type`)
  }
  return Object.freeze({
    ...common,
    appliesTo,
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
  declaredIds: ReadonlySet<string>,
): PreparedModSkillDefinition {
  if (!common.art.icon || (common.art.icon.assetKind !== 'sprite' && common.art.icon.assetKind !== 'sheet')) {
    throw new Error(`${common.modId}:${common.key} skill requires image art.icon`)
  }
  if (!Array.isArray(common.fields.ranks) || common.fields.ranks.length === 0 ||
      common.fields.ranks.length > 99) {
    throw new Error(`${common.modId}:${common.key} skill requires 1..99 rank definitions`)
  }
  const ranks = common.fields.ranks.map((rank, index) => Object.freeze(object(
    rank,
    `${common.key}.ranks[${index}]`,
  )))
  ranks.forEach((rank, index) => exactObjectKeys(
    rank,
    ['grant', 'grants', 'modify'],
    `${common.key}.ranks[${index}]`,
  ))
  ranks.forEach((rank, index) => {
    if (rank.modify !== undefined) validateModifierMap(
      object(rank.modify, `${common.key}.ranks[${index}].modify`),
      `${common.key}.ranks[${index}].modify`,
    )
  })
  const maximumRank = common.fields.maximum_rank ?? ranks.length
  const maximum = integer(maximumRank, 1, ranks.length, `${common.key}.maximum_rank`)
  const offer = common.fields.offer === undefined
    ? {}
    : object(common.fields.offer, `${common.key}.offer`)
  exactObjectKeys(offer, ['minimum_level', 'weight'], `${common.key}.offer`)
  const parent = optionalReference(common.fields.parent, 'skill', `${common.key}.parent`)
  const prerequisites = common.fields.prerequisites === undefined
    ? []
    : referenceArray(common.fields.prerequisites, 'skill', `${common.key}.prerequisites`)
  if ((parent && !skillIds.has(parent.contentId)) || prerequisites.some(ref => !skillIds.has(ref.contentId))) {
    throw new Error(`${common.modId}:${common.key} skill dependency is unavailable`)
  }
  const grants = skillGrants(common.fields.grants, declaredIds, `${common.key}.grants`)
  const rankGrants = ranks.slice(0, maximum).map((rank, index) => skillGrants(
    rank.grants ?? rank.grant,
    declaredIds,
    `${common.key}.ranks[${index}].grant`,
  ))
  return Object.freeze({
    ...common,
    contentKind: 'skill' as const,
    grants,
    maximumRank: maximum,
    minimumLevel: offer.minimum_level === undefined
      ? 1
      : integer(offer.minimum_level, 1, 999, `${common.key}.offer.minimum_level`),
    offerWeight: offer.weight === undefined
      ? 1
      : number(offer.weight, Number.EPSILON, 1_000_000, `${common.key}.offer.weight`),
    parent,
    prerequisites,
    rankGrants: Object.freeze(rankGrants),
    ranks: Object.freeze(ranks.slice(0, maximum)),
  })
}

function skillGrants(
  value: WebLuaDefinitionValue | undefined,
  declaredIds: ReadonlySet<string>,
  field: string,
): readonly ResolvedWebLuaContentReference[] {
  if (value === undefined || value === null) return Object.freeze([])
  const values = Array.isArray(value) ? value : [value]
  if (values.length > 32 || values.some(entry => !isResolvedReference(entry))) {
    throw new Error(`${field} must contain resolved content references`)
  }
  const grants = values as ResolvedWebLuaContentReference[]
  if (grants.some(grant => !declaredIds.has(grant.contentId) || (
    grant.targetKind !== 'spell' && grant.targetKind !== 'ui'
  ))) throw new Error(`${field} may grant only declared spells or UI`)
  return Object.freeze([...grants])
}

function compileSpell(common: PreparedModContentEntry): PreparedModSpellDefinition {
  if (!common.art.icon || (common.art.icon.assetKind !== 'sprite' && common.art.icon.assetKind !== 'sheet')) {
    throw new Error(`${common.modId}:${common.key} spell requires image art.icon`)
  }
  if (common.art.effect && common.art.effect.assetKind !== 'sprite' && common.art.effect.assetKind !== 'sheet') {
    throw new Error(`${common.modId}:${common.key} spell art.effect must be an image`)
  }
  if (common.art.sound && common.art.sound.assetKind !== 'sound') {
    throw new Error(`${common.modId}:${common.key} spell art.sound must be a sound`)
  }
  const behavior = common.fields.behavior
  if (!isRule(behavior)) throw new Error(`${common.modId}:${common.key} spell requires a behavior prefab`)
  const slot = common.fields.slot
  if (slot !== 'primary' && slot !== 'secondary') {
    throw new Error(`${common.modId}:${common.key} spell slot must be primary or secondary`)
  }
  return Object.freeze({
    ...common,
    behavior,
    contentKind: 'spell' as const,
    cooldownMs: durationMs(common.fields.cooldown ?? 0, `${common.key}.cooldown`),
    mana: common.fields.mana === undefined
      ? 0
      : number(common.fields.mana, 0, 1_000_000, `${common.key}.mana`),
    slot,
  })
}

function compileEnemy(common: PreparedModContentEntry): PreparedModEnemyDefinition {
  if (!common.art.atlas || (common.art.atlas.assetKind !== 'sprite' && common.art.atlas.assetKind !== 'sheet')) {
    throw new Error(`${common.modId}:${common.key} enemy requires image art.atlas`)
  }
  for (const slot of ['attack_sound', 'death_sound', 'sound'] as const) {
    if (common.art[slot] && common.art[slot]!.assetKind !== 'sound') {
      throw new Error(`${common.modId}:${common.key} enemy art.${slot} must be a sound`)
    }
  }
  const stats = common.fields.stats === undefined
    ? {}
    : object(common.fields.stats, `${common.key}.stats`)
  exactObjectKeys(stats, [
    'attack_cooldown',
    'attack_range',
    'collision_radius',
    'damage',
    'health',
    'scale',
    'speed',
  ], `${common.key}.stats`)
  const loot = common.fields.loot === undefined
    ? {}
    : object(common.fields.loot, `${common.key}.loot`)
  exactObjectKeys(loot, ['experience', 'gold'], `${common.key}.loot`)
  const gold = loot.gold === undefined
    ? {}
    : object(loot.gold, `${common.key}.loot.gold`)
  exactObjectKeys(gold, ['maximum', 'minimum'], `${common.key}.loot.gold`)
  const goldMinimum = gold.minimum === undefined
    ? 0
    : integer(gold.minimum, 0, 1_000_000, `${common.key}.loot.gold.minimum`)
  const goldMaximum = gold.maximum === undefined
    ? goldMinimum
    : integer(gold.maximum, goldMinimum, 1_000_000, `${common.key}.loot.gold.maximum`)
  const experience = loot.experience === undefined
    ? 0
    : number(loot.experience, 0, 1_000_000, `${common.key}.loot.experience`)
  return Object.freeze({
    ...common,
    attackCooldownMs: durationMs(stats.attack_cooldown ?? '1s', `${common.key}.stats.attack_cooldown`),
    attackDamage: stats.damage === undefined
      ? 10
      : number(stats.damage, 0, 1_000_000, `${common.key}.stats.damage`),
    attackRange: stats.attack_range === undefined
      ? 36
      : number(stats.attack_range, 1, 2_048, `${common.key}.stats.attack_range`),
    collisionRadius: stats.collision_radius === undefined
      ? 24
      : number(stats.collision_radius, 4, 128, `${common.key}.stats.collision_radius`),
    contentKind: 'enemy' as const,
    experience,
    goldMaximum,
    goldMinimum,
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
  if (common.art.layout?.assetKind !== 'boneyard' || common.art.layout.path !== source) {
    throw new Error(`${common.modId}:${common.key} Boneyard art.layout must declare its source file`)
  }
  const roster = common.fields.roster === undefined ? [] : common.fields.roster
  const waves = common.fields.waves === undefined ? [] : common.fields.waves
  const triggers = common.fields.triggers === undefined ? [] : common.fields.triggers
  if (!Array.isArray(roster) || roster.length > 64 || roster.some(entry => (
    typeof entry !== 'string' && !isResolvedReference(entry)
  ))) throw new Error(`${common.modId}:${common.key} Boneyard roster is invalid`)
  if (!Array.isArray(waves) || waves.length > 256 || waves.some(entry => (
    !entry || typeof entry !== 'object' || Array.isArray(entry)
  ))) throw new Error(`${common.modId}:${common.key} Boneyard waves are invalid`)
  if (!Array.isArray(triggers) || triggers.length > 64 || !triggers.every(isRule)) {
    throw new Error(`${common.modId}:${common.key} Boneyard triggers are invalid`)
  }
  const environment = optionalObject(common.fields.environment, `${common.key}.environment`)
  exactObjectKeys(environment, ['mode'], `${common.key}.environment`)
  if (environment.mode !== undefined) integer(environment.mode, 0, 2, `${common.key}.environment.mode`)
  const anchors = optionalObject(common.fields.anchors, `${common.key}.anchors`)
  exactObjectKeys(anchors, ['entry'], `${common.key}.anchors`)
  if (anchors.entry !== undefined) point(anchors.entry, `${common.key}.anchors.entry`)
  const preparedWaves = waves.map((entry, index) => {
    const wave = object(entry, `${common.key}.waves[${index}]`)
    exactObjectKeys(wave, ['ordinal', 'roster', 'wave'], `${common.key}.waves[${index}]`)
    if (wave.wave === undefined && wave.ordinal === undefined) {
      throw new Error(`${common.modId}:${common.key} wave requires wave or ordinal`)
    }
    const roster = wave.roster
    if (!Array.isArray(roster) || roster.length > 64 || roster.some(candidate => (
      typeof candidate !== 'string' && !isResolvedReference(candidate)
    ))) throw new Error(`${common.modId}:${common.key} wave roster is invalid`)
    return Object.freeze(wave)
  })
  return Object.freeze({
    ...common,
    anchors,
    contentKind: 'boneyard' as const,
    environment,
    roster: Object.freeze([...roster]),
    source,
    triggers: Object.freeze([...triggers]),
    waves: Object.freeze(preparedWaves),
  })
}

function compileBoast(
  common: PreparedModContentEntry,
  assets: PreparedModAssetCatalog,
): PreparedModBoastDefinition {
  const stockIconValue = common.fields.stock_icon
  const iconBinding = common.art.icon
  if ((stockIconValue === undefined) === (iconBinding === undefined)) {
    throw new Error(`${common.modId}:${common.key} Boast requires exactly one icon source`)
  }
  const icon: PreparedModBoastIcon = iconBinding === undefined
    ? (() => {
        const style = integer(stockIconValue, 0, 7, `${common.key}.stock_icon`)
        return Object.freeze({ kind: 'stock' as const, record: 90 + style, style })
      })()
    : (() => {
        if (iconBinding.assetKind !== 'sprite') {
          throw new Error(`${common.modId}:${common.key} Boast art.icon must be a sprite`)
        }
        const asset = assets.image(common.modId, iconBinding.key)
        if (asset.assetKind !== 'sprite' || asset.frames.length < 1) {
          throw new Error(`${common.modId}:${common.key} Boast art.icon has no sprite frame`)
        }
        const frame = asset.frames[0]!
        if (frame.logicalWidth > 128 || frame.logicalHeight > 128) {
          throw new Error(`${common.modId}:${common.key} Boast art.icon exceeds 128 logical pixels`)
        }
        return Object.freeze({
          frame,
          imageHeight: asset.height,
          imagePath: asset.path,
          imageWidth: asset.width,
          kind: 'mod' as const,
        })
      })()
  const failureProducers = common.fields.fail_on === undefined
    ? Object.freeze([] as BoastFailureProducer[])
    : Object.freeze(textArray(common.fields.fail_on, `${common.key}.fail_on`).map((producer) => {
        if (!BOAST_FAILURE_PRODUCERS.has(producer as BoastFailureProducer)) {
          throw new Error(`${common.modId}:${common.key} has an unsupported Boast failure producer`)
        }
        return producer as BoastFailureProducer
      }))
  return Object.freeze({
    ...common,
    contentKind: 'boast' as const,
    failureProducers,
    icon,
    instruction: requiredText(common.fields.instruction, 1_024, `${common.key}.instruction`),
    label: common.name,
    randomSkillChoices: common.fields.random_skill_choices === undefined
      ? false
      : boolean(common.fields.random_skill_choices, `${common.key}.random_skill_choices`),
    response: requiredText(common.fields.response, 1_024, `${common.key}.response`),
    scoreMultiplier: common.fields.score_multiplier === undefined
      ? 1.100000023841858
      : number(common.fields.score_multiplier, 1, 10, `${common.key}.score_multiplier`),
    selection: createModBoastSelection(common.contentId, common.modId),
    statement: requiredText(common.fields.statement, 1_024, `${common.key}.statement`),
    successWave: common.fields.success_wave === undefined
      ? 30
      : integer(common.fields.success_wave, 1, 10_000, `${common.key}.success_wave`),
  })
}

function compileRoom(common: PreparedModContentEntry): PreparedModRoomDefinition {
  const geometry = optionalObject(common.fields.geometry, `${common.key}.geometry`)
  exactObjectKeys(geometry, ['floor', 'height', 'kind', 'walls', 'width'], `${common.key}.geometry`)
  if (geometry.kind !== 'inline') throw new Error(`${common.modId}:${common.key} room geometry kind must be inline`)
  number(geometry.width, 64, 4_096, `${common.key}.geometry.width`)
  number(geometry.height, 64, 4_096, `${common.key}.geometry.height`)
  if (typeof geometry.floor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(geometry.floor)) {
    throw new Error(`${common.modId}:${common.key} room floor must be a six-digit hex color`)
  }
  const walls = geometry.walls
  if (walls !== undefined && (!Array.isArray(walls) || walls.some((entry, index) => {
    const wall = object(entry, `${common.key}.geometry.walls[${index}]`)
    exactObjectKeys(wall, ['color', 'height', 'width', 'x', 'y'], `${common.key}.geometry.walls[${index}]`)
    for (const field of ['height', 'width', 'x', 'y']) number(
      wall[field],
      field === 'height' || field === 'width' ? 1 : -4_096,
      4_096,
      `${common.key}.geometry.walls[${index}].${field}`,
    )
    return false
  }))) throw new Error(`${common.modId}:${common.key} room walls are invalid`)
  const props = common.fields.props
  if (props !== undefined && (!Array.isArray(props) || props.some((entry, index) => {
    const prop = object(entry, `${common.key}.props[${index}]`)
    exactObjectKeys(prop, ['color', 'kind', 'label', 'radius', 'x', 'y'], `${common.key}.props[${index}]`)
    for (const field of ['radius', 'x', 'y']) number(
      prop[field],
      field === 'radius' ? 1 : -4_096,
      4_096,
      `${common.key}.props[${index}].${field}`,
    )
    return false
  }))) throw new Error(`${common.modId}:${common.key} room props are invalid`)
  return Object.freeze({
    ...common,
    contentKind: 'room' as const,
    geometry,
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
  if (common.art.layout?.assetKind !== 'scene') {
    throw new Error(`${common.modId}:${common.key} scene requires art.layout`)
  }
  return Object.freeze({ ...common, contentKind: 'scene' as const, rooms })
}

function compileSceneExtension(common: PreparedModContentEntry): PreparedModSceneExtensionDefinition {
  if (common.fields.scene !== 'stock.boneyard' ||
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
  wearableItemIds: ReadonlySet<string>,
  affixPoolIds: ReadonlySet<string>,
): PreparedModShopDefinition {
  if (!Array.isArray(common.fields.stock) || common.fields.stock.length === 0) {
    throw new Error(`${common.modId}:${common.key} shop requires stock`)
  }
  const stock = common.fields.stock.map((value, index) => {
    const row = object(value, `${common.key}.stock[${index}]`)
    exactObjectKeys(row, ['item', 'price', 'quantity'], `${common.key}.stock[${index}]`)
    const item = resolvedReference(row.item, `${common.key}.stock[${index}].item`)
    if (!itemIds.has(item.contentId) || (item.targetKind !== 'item' && item.targetKind !== 'potion')) {
      throw new Error(`${common.modId}:${common.key} shop item is unavailable`)
    }
    const quantity = row.quantity === undefined
      ? 1
      : integer(row.quantity, 1, 9_999, `${common.key}.stock[${index}].quantity`)
    if (wearableItemIds.has(item.contentId) && quantity !== 1) {
      throw new Error(`${common.modId}:${common.key} wearable shop stock quantity must be one`)
    }
    return Object.freeze({
      item,
      price: integer(row.price, 0, 10_000_000, `${common.key}.stock[${index}].price`),
      quantity,
    })
  })
  const services = common.fields.services === undefined
    ? []
    : (() => {
        if (!Array.isArray(common.fields.services) || common.fields.services.length > 32) {
          throw new Error(`${common.modId}:${common.key} shop services are invalid`)
        }
        return common.fields.services.map((value, index) => {
          const service = object(value, `${common.key}.services[${index}]`)
          exactObjectKeys(service, ['pool', 'price', 'type'], `${common.key}.services[${index}]`)
          const pool = resolvedReference(service.pool, `${common.key}.services[${index}].pool`)
          if (service.type !== 'reforge' || pool.targetKind !== 'affix-pool' ||
              !affixPoolIds.has(pool.contentId)) {
            throw new Error(`${common.modId}:${common.key} reforge service is invalid`)
          }
          return Object.freeze({
            pool,
            price: integer(service.price, 0, 10_000_000, `${common.key}.services[${index}].price`),
            type: 'reforge' as const,
          })
        })
      })()
  const mount = common.fields.mount === undefined ? null : optionalObject(common.fields.mount, `${common.key}.mount`)
  if (mount) {
    exactObjectKeys(mount, ['radius', 'scene', 'x', 'y'], `${common.key}.mount`)
    if (mount.scene !== 'hub.courtyard' && mount.scene !== 'boneyard') {
      throw new Error(`${common.modId}:${common.key} shop mount scene is invalid`)
    }
    number(mount.x, -100_000, 100_000, `${common.key}.mount.x`)
    number(mount.y, -100_000, 100_000, `${common.key}.mount.y`)
    if (mount.radius !== undefined) number(mount.radius, 1, 2_048, `${common.key}.mount.radius`)
  }
  const npc = common.fields.npc === undefined ? null : optionalObject(common.fields.npc, `${common.key}.npc`)
  if (npc) {
    exactObjectKeys(npc, ['name'], `${common.key}.npc`)
    optionalText(npc.name, common.name, 128, `${common.key}.npc.name`)
  }
  return Object.freeze({
    ...common,
    contentKind: 'shop' as const,
    mount,
    npc,
    restockMs: durationMs(common.fields.restock ?? 0, `${common.key}.restock`),
    services: Object.freeze(services),
    stock: Object.freeze(stock),
    stockScope: (() => {
      const scope = common.fields.stock_scope ?? 'player'
      if (scope !== 'player' && scope !== 'party' && scope !== 'session') {
        throw new Error(`${common.modId}:${common.key} shop stock scope is invalid`)
      }
      return scope
    })(),
  })
}

function compileUi(common: PreparedModContentEntry): PreparedModUiDefinition {
  const mounts = new Set(['hud.bottom_left', 'hud.bottom_right', 'hud.overlay', 'hud.top_left', 'hud.top_right'])
  if (typeof common.fields.mount !== 'string' || !mounts.has(common.fields.mount) ||
      !isRule(common.fields.view) || common.fields.view.operation !== 'prefab.minimap') {
    throw new Error(`${common.modId}:${common.key} UI mount or view is invalid`)
  }
  const bindings = optionalObject(common.fields.bindings, `${common.key}.bindings`)
  for (const [name, binding] of Object.entries(bindings)) {
    const row = object(binding, `${common.key}.bindings.${name}`)
    exactObjectKeys(row, ['state'], `${common.key}.bindings.${name}`)
    if (typeof row.state !== 'string' || row.state.length === 0) {
      throw new Error(`${common.modId}:${common.key} UI binding ${name} requires state`)
    }
  }
  const visible = optionalObject(common.fields.visible, `${common.key}.visible`)
  exactObjectKeys(visible, ['scenes', 'state'], `${common.key}.visible`)
  if (visible.scenes !== undefined && (
    !Array.isArray(visible.scenes) || visible.scenes.length === 0 || visible.scenes.some(scene => (
      scene !== 'hub' && scene !== 'boneyard' && scene !== 'room'
    ))
  )) throw new Error(`${common.modId}:${common.key} UI visible.scenes is invalid`)
  if (visible.state !== undefined) {
    const condition = object(visible.state, `${common.key}.visible.state`)
    exactObjectKeys(condition, ['equals', 'state'], `${common.key}.visible.state`)
    if (typeof condition.state !== 'string' || condition.state.length === 0) {
      throw new Error(`${common.modId}:${common.key} UI visible.state requires state`)
    }
  }
  return Object.freeze({
    ...common,
    accessibleName: optionalText(
      common.fields.accessible_name,
      common.name,
      128,
      `${common.key}.accessible_name`,
    ),
    actions: common.fields.actions === undefined ? Object.freeze([]) : textArray(common.fields.actions, `${common.key}.actions`),
    bindings,
    contentKind: 'ui' as const,
    mount: common.fields.mount,
    visible,
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

function requiredText(value: unknown, maximumBytes: number, field: string): string {
  const result = optionalText(value, '', maximumBytes, field)
  if (result.length === 0) throw new Error(`${field} must be nonempty text`)
  return result
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

function boolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${field} must be boolean`)
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

function point(value: unknown, field: string): void {
  const source = object(value, field)
  exactObjectKeys(source, ['x', 'y'], field)
  number(source.x, -100_000, 100_000, `${field}.x`)
  number(source.y, -100_000, 100_000, `${field}.y`)
}

function validateModifierMap(
  source: Readonly<Record<string, WebLuaDefinitionValue>>,
  field: string,
): void {
  for (const [lane, value] of Object.entries(source)) {
    if (typeof value === 'number' && Number.isFinite(value)) continue
    const modifier = object(value, `${field}.${lane}`)
    exactObjectKeys(modifier, ['add', 'multiply', 'set'], `${field}.${lane}`)
    if (Object.keys(modifier).length !== 1) throw new Error(`${field}.${lane} requires one modifier operation`)
    const amount = Object.values(modifier)[0]
    if (typeof amount !== 'number' || !Number.isFinite(amount)) {
      throw new Error(`${field}.${lane} modifier must be finite`)
    }
  }
}

function exactObjectKeys(
  source: Readonly<Record<string, WebLuaDefinitionValue>>,
  allowed: readonly string[],
  field: string,
): void {
  const accepted = new Set(allowed)
  const unknown = Object.keys(source).filter(key => !accepted.has(key))
  if (unknown.length > 0) throw new Error(`${field} contains unknown fields: ${unknown.join(', ')}`)
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
