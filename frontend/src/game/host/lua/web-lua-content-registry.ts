import type {
  HubInventoryItem,
  ModConsumableCatalogEntry,
  ModConsumableContent,
  ModSpriteFrame,
} from '../../core-kernels/hub-economy.ts'
import type { BoneyardWaveEnemyToken } from '../../core-kernels/boneyard-wave-schema.ts'
import type { LuaConsoleValue } from '../../protocol/game-protocol.ts'
import type { WebLuaModSource } from './web-lua-contract.ts'

const CONTENT_KEY = /^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/
const CONTENT_ID = /^[1-9][0-9]{0,18}$/
const MAX_CONSUMABLES = 256
const MAX_ITEMS_PER_MOD = 256
const MAX_SPRITES_PER_MOD = 32
const MAX_SPRITES = 128
const MAX_FRAMES_PER_ATLAS = 4_096
const MAX_GLOBAL_FRAMES = 32_768
const MAX_IMAGE_DIMENSION = 4_096
const MAX_FRAME_GEOMETRY = 16_384
const MAX_DESCRIPTION_BYTES = 1_024
const MAX_DURATION_MS = 24 * 60 * 60 * 1_000
const FIRST_CUSTOM_POTION_SUBTYPE = 6
const PNG_SIGNATURE = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
const textEncoder = new TextEncoder()

export interface WebLuaContentRuntimeCallbacks {
  invoke(
    callback: (...args: unknown[]) => unknown,
    owner: string,
    payload: LuaConsoleValue,
    activePlayerId: string,
  ): boolean
}

export interface WebLuaSpriteDescriptor {
  readonly bundle: string
  readonly frame_count: number
  readonly id: string
  readonly image: string
  readonly image_height: number
  readonly image_width: number
  readonly key: string
  readonly local_only: true
  readonly revision: number
}

interface RegisteredSprite {
  readonly bundlePath: string
  readonly descriptor: WebLuaSpriteDescriptor
  readonly frames: readonly ModSpriteFrame[]
  readonly imagePath: string
  readonly modId: string
}

interface RegisteredConsumable {
  readonly catalog: ModConsumableCatalogEntry
  readonly key: string
  readonly modId: string
  readonly onConsume: (...args: unknown[]) => unknown
  readonly owner: WebLuaContentModBinding
}

interface RegisteredLoot {
  readonly bossChance: number
  readonly chance: number
  readonly contentId: string
  readonly modId: string
}

export class WebLuaContentRegistry {
  readonly #bindings: WebLuaContentModBinding[] = []
  readonly #consumables = new Map<string, RegisteredConsumable>()
  readonly #loot: RegisteredLoot[] = []
  readonly #sprites = new Map<string, RegisteredSprite>()
  #closed = false
  #nextNativeSubtype = FIRST_CUSTOM_POTION_SUBTYPE
  #nextSpriteRevision = 1

  attach(
    source: WebLuaModSource,
    callbacks: WebLuaContentRuntimeCallbacks,
  ): WebLuaContentModBinding {
    if (this.#closed) throw new Error('Lua content registry is closed')
    if (this.#bindings.some(binding => binding.modId === source.identity.id)) {
      throw new Error(`Lua content mod is already attached: ${source.identity.id}`)
    }
    const binding = new WebLuaContentModBinding(this, source, callbacks)
    this.#bindings.push(binding)
    return binding
  }

  catalog(): readonly ModConsumableCatalogEntry[] {
    return Object.freeze([...this.#consumables.values()].map(({ catalog }) => catalog))
  }

  consumable(contentId: string): ModConsumableCatalogEntry | null {
    return this.#consumables.get(contentId)?.catalog ?? null
  }

  createLootItems(
    actorSeed: number,
    enemyToken: BoneyardWaveEnemyToken,
  ): readonly HubInventoryItem[] {
    if (!Number.isSafeInteger(actorSeed) || actorSeed < 0) {
      throw new RangeError('mod loot actor seed must be a non-negative safe integer')
    }
    const boss = enemyToken === 'DEMON'
    return Object.freeze(this.#loot.flatMap((entry, index) => {
      const chance = boss ? entry.bossChance : entry.chance
      if (modLootUnitRoll(actorSeed, entry.contentId, index) >= chance) return []
      const registered = this.#consumables.get(entry.contentId)
      if (!registered) throw new Error(`mod loot item is not registered: ${entry.contentId}`)
      return [inventoryItem(registered.catalog)]
    }))
  }

  invokeOwnerConsume(
    contentId: string,
    payload: LuaConsoleValue,
    activePlayerId: string,
  ): boolean {
    const registered = this.#consumables.get(contentId)
    if (!registered) return false
    return registered.owner.invoke(
      registered.onConsume,
      `${registered.modId}:${registered.key} on_consume`,
      payload,
      activePlayerId,
    )
  }

  close(): void {
    if (this.#closed) return
    this.#closed = true
    for (const binding of this.#bindings) binding.close()
    this.#bindings.length = 0
    this.#consumables.clear()
    this.#loot.length = 0
    this.#sprites.clear()
  }

  registerSprite(
    binding: WebLuaContentModBinding,
    keyValue: unknown,
    imageValue: unknown,
    bundleValue: unknown,
  ): WebLuaSpriteDescriptor {
    this.#requireOpen(binding)
    const key = contentKey(keyValue, 'sprite key')
    const imagePath = packagePath(imageValue, 'sprite image', '.png')
    const bundlePath = packagePath(bundleValue, 'sprite bundle', '.bundle')
    const image = binding.file(imagePath)
    const bundle = binding.file(bundlePath)
    const dimensions = pngDimensions(image)
    const frames = spriteFrames(bundle, dimensions.width, dimensions.height)
    const id = `${binding.modId}:${key}`
    const previous = this.#sprites.get(id)
    if (!previous && binding.spriteCount >= MAX_SPRITES_PER_MOD) {
      throw new Error(`sd.sprites.register exceeds the per-mod limit of ${MAX_SPRITES_PER_MOD}`)
    }
    if (!previous && this.#sprites.size >= MAX_SPRITES) {
      throw new Error(`sd.sprites.register exceeds the global limit of ${MAX_SPRITES}`)
    }
    const otherFrames = [...this.#sprites.entries()].reduce(
      (count, [candidateId, atlas]) => count + (candidateId === id ? 0 : atlas.frames.length),
      0,
    )
    if (otherFrames + frames.length > MAX_GLOBAL_FRAMES) {
      throw new Error(`sd.sprites.register exceeds the global frame limit of ${MAX_GLOBAL_FRAMES}`)
    }
    const descriptor = Object.freeze({
      bundle: bundlePath,
      frame_count: frames.length,
      id,
      image: imagePath,
      image_height: dimensions.height,
      image_width: dimensions.width,
      key,
      local_only: true as const,
      revision: this.#nextSpriteRevision++,
    })
    this.#sprites.set(id, Object.freeze({
      bundlePath,
      descriptor,
      frames,
      imagePath,
      modId: binding.modId,
    }))
    binding.rememberSprite(id)
    return descriptor
  }

  unregisterSprite(binding: WebLuaContentModBinding, keyValue: unknown): boolean {
    this.#requireOpen(binding)
    const id = `${binding.modId}:${contentKey(keyValue, 'sprite key')}`
    const registered = this.#sprites.get(id)
    if (!registered || registered.modId !== binding.modId) return false
    this.#sprites.delete(id)
    binding.forgetSprite(id)
    return true
  }

  sprite(binding: WebLuaContentModBinding, keyValue: unknown): WebLuaSpriteDescriptor | null {
    const id = `${binding.modId}:${contentKey(keyValue, 'sprite key')}`
    return this.#sprites.get(id)?.descriptor ?? null
  }

  sprites(binding: WebLuaContentModBinding): readonly WebLuaSpriteDescriptor[] {
    return Object.freeze([...this.#sprites.values()]
      .filter(sprite => sprite.modId === binding.modId)
      .sort((left, right) => left.descriptor.id.localeCompare(right.descriptor.id))
      .map(({ descriptor }) => descriptor))
  }

  registerItem(binding: WebLuaContentModBinding, value: unknown): Record<string, unknown> {
    this.#requireOpen(binding)
    const source = record(value, 'sd.items.register descriptor')
    exactKeys(source, [
      'consume_vfx',
      'description',
      'duration_ms',
      'icon',
      'key',
      'name',
      'on_consume',
      'type',
    ], 'sd.items.register descriptor')
    if (source.type !== 'potion') {
      throw new Error('the web content registry currently accepts type potion')
    }
    const key = contentKey(source.key, 'item key')
    if (binding.itemCount >= MAX_ITEMS_PER_MOD) {
      throw new Error(`sd.items.register exceeds the per-mod limit of ${MAX_ITEMS_PER_MOD}`)
    }
    if (this.#consumables.size >= MAX_CONSUMABLES) {
      throw new Error(`sd.items.register exceeds the global consumable limit of ${MAX_CONSUMABLES}`)
    }
    const contentId = stableWebLuaContentId(binding.modId, key)
    if (this.#consumables.has(contentId) || binding.hasItemKey(key)) {
      throw new Error(`sd.items.register content identity is already registered: ${key}`)
    }
    const name = text(source.name, 'item name', 128)
    const description = text(source.description, 'item description', MAX_DESCRIPTION_BYTES, true)
    const durationMs = integer(source.duration_ms, 'item duration_ms', 0, MAX_DURATION_MS)
    if (typeof source.on_consume !== 'function') {
      throw new Error('sd.items.register potion on_consume must be a function')
    }
    const icon = record(source.icon, 'item icon')
    exactKeys(icon, ['atlas', 'frame'], 'item icon')
    const atlasKey = contentKey(icon.atlas, 'item icon atlas')
    const atlas = this.#sprites.get(`${binding.modId}:${atlasKey}`)
    if (!atlas) throw new Error('sd.items.register potion icon.atlas is not registered by this mod')
    const frameIndex = integer(icon.frame, 'item icon frame', 0, atlas.frames.length - 1)
    const consumeVfx = consumableVfx(source.consume_vfx)
    const content: ModConsumableContent = Object.freeze({
      consumeVfx,
      contentId,
      description,
      durationMs,
      icon: Object.freeze({
        atlasId: atlas.descriptor.id,
        frame: atlas.frames[frameIndex]!,
        frameIndex,
        imagePath: atlas.imagePath,
      }),
      key,
      modId: binding.modId,
    })
    const catalog: ModConsumableCatalogEntry = Object.freeze({
      content,
      name,
      nativeSubtype: this.#nextNativeSubtype++,
    })
    const registered: RegisteredConsumable = Object.freeze({
      catalog,
      key,
      modId: binding.modId,
      onConsume: source.on_consume as (...args: unknown[]) => unknown,
      owner: binding,
    })
    this.#consumables.set(contentId, registered)
    binding.rememberItem(key, contentId)
    return itemDescriptor(catalog)
  }

  item(binding: WebLuaContentModBinding, identity: unknown): Record<string, unknown> | null {
    const registered = this.#resolveItem(binding, identity)
    return registered ? itemDescriptor(registered.catalog) : null
  }

  items(): readonly Record<string, unknown>[] {
    return Object.freeze([...this.#consumables.values()].map(({ catalog }) => itemDescriptor(catalog)))
  }

  registerLoot(binding: WebLuaContentModBinding, value: unknown): Record<string, unknown> {
    this.#requireOpen(binding)
    const source = record(value, 'sd.loot.register descriptor')
    exactKeys(source, ['boss_chance', 'chance', 'item'], 'sd.loot.register descriptor')
    const item = this.#resolveItem(binding, source.item)
    if (!item || item.modId !== binding.modId) {
      throw new Error('sd.loot.register item must be an owned registered consumable')
    }
    if (this.#loot.some(entry => entry.modId === binding.modId &&
        entry.contentId === item.catalog.content.contentId)) {
      throw new Error('sd.loot.register item is already registered by this mod')
    }
    const registered = Object.freeze({
      bossChance: finite(source.boss_chance, 'loot boss_chance', 0, 1),
      chance: finite(source.chance, 'loot chance', 0, 1),
      contentId: item.catalog.content.contentId,
      modId: binding.modId,
    })
    this.#loot.push(registered)
    binding.rememberLoot(registered)
    return lootDescriptor(registered)
  }

  loot(): readonly Record<string, unknown>[] {
    return Object.freeze(this.#loot.map(lootDescriptor))
  }

  rollback(binding: WebLuaContentModBinding): void {
    for (const id of binding.spriteIds) this.#sprites.delete(id)
    for (const id of binding.itemIds) this.#consumables.delete(id)
    for (const entry of binding.lootEntries) {
      const index = this.#loot.indexOf(entry)
      if (index >= 0) this.#loot.splice(index, 1)
    }
  }

  #resolveItem(
    binding: WebLuaContentModBinding,
    identity: unknown,
  ): RegisteredConsumable | null {
    if (typeof identity !== 'string') {
      throw new Error('item identity must be an owned key or decimal content id')
    }
    const ownedId = binding.itemIdForKey(identity)
    if (ownedId) return this.#consumables.get(ownedId) ?? null
    if (!CONTENT_ID.test(identity)) return null
    return this.#consumables.get(identity) ?? null
  }

  #requireOpen(binding: WebLuaContentModBinding): void {
    if (this.#closed || !binding.registrationOpen) {
      throw new Error('Lua content registration is available only while the entry script loads')
    }
  }
}

export class WebLuaContentModBinding {
  readonly #callbacks: WebLuaContentRuntimeCallbacks
  readonly #files: Readonly<Record<string, Uint8Array>>
  readonly #itemIdsByKey = new Map<string, string>()
  readonly #registry: WebLuaContentRegistry
  readonly itemIds = new Set<string>()
  readonly lootEntries: RegisteredLoot[] = []
  readonly spriteIds = new Set<string>()
  #closed = false
  #registrationOpen = false
  readonly modId: string

  constructor(
    registry: WebLuaContentRegistry,
    source: WebLuaModSource,
    callbacks: WebLuaContentRuntimeCallbacks,
  ) {
    this.#registry = registry
    this.#files = source.files
    this.#callbacks = callbacks
    this.modId = source.identity.id
  }

  openRegistration(): void {
    if (this.#closed || this.#registrationOpen) throw new Error('Lua content registration state is invalid')
    this.#registrationOpen = true
  }

  finishRegistration(success: boolean): void {
    if (!this.#registrationOpen) return
    this.#registrationOpen = false
    if (!success) this.#registry.rollback(this)
  }

  close(): void {
    if (this.#closed) return
    this.#closed = true
    this.#registrationOpen = false
  }

  get registrationOpen(): boolean {
    return this.#registrationOpen && !this.#closed
  }

  get itemCount(): number {
    return this.itemIds.size
  }

  get spriteCount(): number {
    return this.spriteIds.size
  }

  file(path: string): Uint8Array {
    const bytes = this.#files[path]
    if (!bytes) throw new Error(`mod package file is missing: ${path}`)
    return bytes
  }

  registerSprite(key: unknown, image: unknown, bundle: unknown): WebLuaSpriteDescriptor {
    return this.#registry.registerSprite(this, key, image, bundle)
  }

  unregisterSprite(key: unknown): boolean {
    return this.#registry.unregisterSprite(this, key)
  }

  sprite(key: unknown): WebLuaSpriteDescriptor | null {
    return this.#registry.sprite(this, key)
  }

  sprites(): readonly WebLuaSpriteDescriptor[] {
    return this.#registry.sprites(this)
  }

  registerItem(value: unknown): Record<string, unknown> {
    return this.#registry.registerItem(this, value)
  }

  item(identity: unknown): Record<string, unknown> | null {
    return this.#registry.item(this, identity)
  }

  items(): readonly Record<string, unknown>[] {
    return this.#registry.items()
  }

  registerLoot(value: unknown): Record<string, unknown> {
    return this.#registry.registerLoot(this, value)
  }

  loot(): readonly Record<string, unknown>[] {
    return this.#registry.loot()
  }

  invoke(
    callback: (...args: unknown[]) => unknown,
    owner: string,
    payload: LuaConsoleValue,
    activePlayerId: string,
  ): boolean {
    return this.#callbacks.invoke(callback, owner, payload, activePlayerId)
  }

  rememberSprite(id: string): void {
    this.spriteIds.add(id)
  }

  forgetSprite(id: string): void {
    this.spriteIds.delete(id)
  }

  rememberItem(key: string, id: string): void {
    this.#itemIdsByKey.set(key, id)
    this.itemIds.add(id)
  }

  hasItemKey(key: string): boolean {
    return this.#itemIdsByKey.has(key)
  }

  itemIdForKey(key: string): string | null {
    return this.#itemIdsByKey.get(key) ?? null
  }

  rememberLoot(entry: RegisteredLoot): void {
    this.lootEntries.push(entry)
  }
}

export function stableWebLuaContentId(modId: string, key: string): string {
  let hash = 0xcbf29ce484222325n
  const append = (bytes: Uint8Array): void => {
    for (const byte of bytes) {
      hash ^= BigInt(byte)
      hash = BigInt.asUintN(64, hash * 0x100000001b3n)
    }
  }
  append(textEncoder.encode('sd.content.v1'))
  for (const value of [modId, key]) {
    const bytes = textEncoder.encode(value)
    append(Uint8Array.of(
      bytes.length & 0xff,
      bytes.length >>> 8 & 0xff,
      bytes.length >>> 16 & 0xff,
      bytes.length >>> 24 & 0xff,
    ))
    append(bytes)
  }
  return ((hash & ((1n << 62n) - 1n)) | (1n << 62n)).toString()
}

function inventoryItem(catalog: ModConsumableCatalogEntry): HubInventoryItem {
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

function itemDescriptor(catalog: ModConsumableCatalogEntry): Record<string, unknown> {
  const { content } = catalog
  return {
    available: true,
    consumable: true,
    consume_vfx: content.consumeVfx === null ? null : {
      color: [...content.consumeVfx.color],
      kind: content.consumeVfx.kind,
    },
    description: content.description,
    duration_ms: content.durationMs,
    icon: { atlas: content.icon.atlasId, frame: content.icon.frameIndex },
    id: content.contentId,
    key: content.key,
    mod_id: content.modId,
    name: catalog.name,
    native_subtype: catalog.nativeSubtype,
    native_type_id: 7001,
    type: 'potion',
  }
}

function lootDescriptor(entry: RegisteredLoot): Record<string, unknown> {
  return {
    boss_chance: entry.bossChance,
    chance: entry.chance,
    item: entry.contentId,
    mod_id: entry.modId,
  }
}

function consumableVfx(value: unknown): ModConsumableContent['consumeVfx'] {
  if (value === undefined || value === null) return null
  const source = record(value, 'item consume_vfx')
  exactKeys(source, ['color', 'kind'], 'item consume_vfx')
  if (source.kind !== 'spell_glow') throw new Error('item consume_vfx.kind must be spell_glow')
  if (!Array.isArray(source.color) || source.color.length !== 4) {
    throw new Error('item consume_vfx.color must contain four values')
  }
  const color = source.color.map((component, index) => (
    finite(component, `item consume_vfx.color[${index}]`, 0, 1)
  )) as unknown as [number, number, number, number]
  return Object.freeze({ color: Object.freeze(color), kind: 'spell_glow' as const })
}

function pngDimensions(bytes: Uint8Array): { readonly height: number; readonly width: number } {
  if (bytes.length < 24 || PNG_SIGNATURE.some((value, index) => bytes[index] !== value)) {
    throw new Error('sprite image is not a PNG')
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint32(8) !== 13 || textDecoder(bytes.subarray(12, 16)) !== 'IHDR') {
    throw new Error('sprite PNG has no leading IHDR')
  }
  const width = view.getUint32(16)
  const height = view.getUint32(20)
  if (width < 1 || height < 1 || width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    throw new Error(`sprite PNG dimensions must be within 1..${MAX_IMAGE_DIMENSION}`)
  }
  return { height, width }
}

function spriteFrames(
  bytes: Uint8Array,
  imageWidth: number,
  imageHeight: number,
): readonly ModSpriteFrame[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const frames: ModSpriteFrame[] = []
  let offset = 0
  while (offset < bytes.length) {
    if (frames.length >= MAX_FRAMES_PER_ATLAS || offset + 45 > bytes.length) {
      throw new Error('sprite bundle is truncated or exceeds its frame limit')
    }
    const x = view.getFloat32(offset, true)
    const y = view.getFloat32(offset + 4, true)
    const width = view.getFloat32(offset + 8, true)
    const height = view.getFloat32(offset + 12, true)
    const logicalWidth = view.getInt32(offset + 16, true)
    const logicalHeight = view.getUint32(offset + 20, true)
    const contentWidth = view.getFloat32(offset + 24, true)
    const contentHeight = view.getFloat32(offset + 28, true)
    const centerOffsetX = view.getFloat32(offset + 32, true)
    const centerOffsetY = view.getFloat32(offset + 36, true)
    const rotated = view.getUint8(offset + 40)
    const pointCount = view.getUint32(offset + 41, true)
    const next = offset + 45 + pointCount * 8
    if (rotated !== 0 || pointCount > 4_096 || next > bytes.length ||
        !finiteGeometry([x, y, width, height, contentWidth, contentHeight, centerOffsetX, centerOffsetY]) ||
        x < 0 || y < 0 || width <= 0 || height <= 0 || logicalWidth <= 0 || logicalHeight <= 0 ||
        x + width > imageWidth || y + height > imageHeight) {
      throw new Error(`sprite bundle frame ${frames.length} is invalid`)
    }
    frames.push(Object.freeze({
      centerOffsetX,
      centerOffsetY,
      contentHeight,
      contentWidth,
      height,
      logicalHeight,
      logicalWidth,
      width,
      x,
      y,
    }))
    offset = next
  }
  if (frames.length === 0) throw new Error('sprite bundle is empty')
  return Object.freeze(frames)
}

function finiteGeometry(values: readonly number[]): boolean {
  return values.every(value => Number.isFinite(value) && Math.abs(value) <= MAX_FRAME_GEOMETRY)
}

function modLootUnitRoll(actorSeed: number, contentId: string, index: number): number {
  let mixed = BigInt.asUintN(64, BigInt(actorSeed) ^ BigInt(contentId) ^ BigInt(index + 1))
  mixed = BigInt.asUintN(64, mixed + 0x9e3779b97f4a7c15n)
  mixed = BigInt.asUintN(64, (mixed ^ mixed >> 30n) * 0xbf58476d1ce4e5b9n)
  mixed = BigInt.asUintN(64, (mixed ^ mixed >> 27n) * 0x94d049bb133111ebn)
  mixed ^= mixed >> 31n
  return Number(mixed >> 11n) / 0x20_0000_0000_0000
}

function contentKey(value: unknown, field: string): string {
  const normalized = text(value, field, 128)
  if (!CONTENT_KEY.test(normalized)) throw new Error(`${field} is not canonical`)
  return normalized
}

function packagePath(value: unknown, field: string, extension: string): string {
  const path = text(value, field, 240)
  if (!path.startsWith('sprites/') || !path.endsWith(extension) ||
      path.split('/').some(segment => segment === '' || segment === '.' || segment === '..')) {
    throw new Error(`${field} is not an owned sprite package path`)
  }
  return path
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${field} must be a table`)
  }
  return value as Record<string, unknown>
}

function exactKeys(source: Record<string, unknown>, expected: readonly string[], field: string): void {
  const keys = Object.keys(source)
  if (keys.some(key => !expected.includes(key)) || expected.some(key => !(key in source))) {
    throw new Error(`${field} contains invalid fields`)
  }
}

function text(value: unknown, field: string, maximum: number, bytes = false): string {
  if (typeof value !== 'string' || value.length === 0 ||
      (bytes ? textEncoder.encode(value).length : value.length) > maximum || value.includes('\0')) {
    throw new Error(`${field} must contain 1..${maximum} ${bytes ? 'bytes' : 'characters'}`)
  }
  return value
}

function integer(value: unknown, field: string, minimum: number, maximum: number): number {
  if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new Error(`${field} must be an integer within ${minimum}..${maximum}`)
  }
  return Number(value)
}

function finite(value: unknown, field: string, minimum: number, maximum: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${field} must be finite within ${minimum}..${maximum}`)
  }
  return value
}

function textDecoder(bytes: Uint8Array): string {
  return String.fromCharCode(...bytes)
}
