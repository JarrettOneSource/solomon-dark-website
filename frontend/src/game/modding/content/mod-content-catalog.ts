import type {
  HubInventoryItem,
  ModConsumableCatalogEntry,
  ModConsumableContent,
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

interface PreparedLootRow {
  readonly bossChance: number
  readonly catalog: ModConsumableCatalogEntry
  readonly chance: number
}

export class PreparedModContentCatalog {
  readonly #byId: ReadonlyMap<string, PreparedModContentEntry>
  readonly #content: readonly PreparedModContentEntry[]
  readonly #loot: readonly PreparedLootRow[]
  readonly #potions: readonly PreparedModPotionDefinition[]
  readonly #statuses: ReadonlyMap<string, PreparedModStatusDefinition>

  constructor(options: Readonly<{
    content: readonly PreparedModContentEntry[]
    loot: readonly PreparedLootRow[]
    potions: readonly PreparedModPotionDefinition[]
    statuses: readonly PreparedModStatusDefinition[]
  }>) {
    const byId = new Map<string, PreparedModContentEntry>()
    for (const entry of options.content) {
      if (byId.has(entry.contentId)) throw new Error(`prepared mod content is duplicated: ${entry.contentId}`)
      byId.set(entry.contentId, entry)
    }
    this.#content = Object.freeze([...options.content].sort(compareContent))
    this.#byId = byId
    this.#loot = Object.freeze([...options.loot])
    this.#potions = Object.freeze([...options.potions].sort(compareContent))
    this.#statuses = new Map(options.statuses.map(status => [status.contentId, status]))
  }

  all(): readonly PreparedModContentEntry[] {
    return this.#content
  }

  consumables(): readonly ModConsumableCatalogEntry[] {
    return Object.freeze(this.#potions.map(potion => potion.catalog))
  }

  content(contentId: string): PreparedModContentEntry | null {
    return this.#byId.get(contentId) ?? null
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

  status(contentId: string): PreparedModStatusDefinition | null {
    return this.#statuses.get(contentId) ?? null
  }
}

export function compileModContentCatalog(
  mods: readonly CompiledWebLuaMod[],
  assets: PreparedModAssetCatalog,
): PreparedModContentCatalog {
  const count = mods.reduce((total, mod) => total + mod.content.length, 0)
  if (count > MAXIMUM_CATALOG_CONTENT) throw new Error(`prepared mod catalog exceeds ${MAXIMUM_CATALOG_CONTENT} content entries`)
  const content: PreparedModContentEntry[] = []
  const statuses: PreparedModStatusDefinition[] = []
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
  content.push(...potions)
  const loot = potions.flatMap((potion): PreparedLootRow[] => potion.loot ? [{
    bossChance: potion.loot.boss,
    catalog: potion.catalog,
    chance: potion.loot.ordinary,
  }] : [])
  if (loot.length > MAXIMUM_LOOT_ROWS) throw new Error(`prepared mod loot exceeds ${MAXIMUM_LOOT_ROWS} rows`)
  return new PreparedModContentCatalog({ content, loot, potions, statuses })
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

function number(value: unknown, minimum: number, maximum: number, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${field} must be finite within ${minimum}..${maximum}`)
  }
  return value
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
