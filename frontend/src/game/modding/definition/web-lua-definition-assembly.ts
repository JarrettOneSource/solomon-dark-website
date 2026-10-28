import { WEB_LUA_CONTENT_SCHEMA_FIELDS } from './web-lua-definition-schemas.ts'
import {
  WEB_LUA_CONTENT_ART_SLOTS,
  WEB_LUA_CONTENT_KINDS,
  type WebLuaAssetDefinition,
  type WebLuaAssetKind,
  type WebLuaAssetReference,
  type WebLuaContentDefinition,
  type WebLuaContentKind,
  type WebLuaContentReference,
  type WebLuaDefinitionSource,
  type WebLuaDefinitionValue,
  type WebLuaModIdentity,
  type WebLuaRuleDefinition,
} from './web-lua-definition-types.ts'
import {
  webLuaDefinitionIssue,
  type WebLuaDefinitionErrorCode,
  type WebLuaDefinitionIssue,
} from './web-lua-definition-error.ts'
import { didYouMean, suggestWebLuaName } from './web-lua-suggestions.ts'
import {
  isWebLuaRecord as isRecord,
  isWebLuaToken as isToken,
} from './web-lua-definition-values.ts'

const contentKinds = new Set<string>(WEB_LUA_CONTENT_KINDS)

export interface WebLuaExplicitLists {
  readonly assets: ReadonlyArray<Readonly<{ key: string; node: number }>>
  readonly content: readonly number[]
  readonly rules: readonly number[]
  readonly systems: readonly string[]
}

type SlotResolver = (
  value: string,
  assembly: WebLuaAssembly,
  path: string,
  source: WebLuaDefinitionSource,
) => WebLuaDefinitionValue | null

const contentSlot = (targetKind: WebLuaContentKind): SlotResolver => (value, assembly) => (
  assembly.reference(targetKind, value)
)
const potionOrItemSlot: SlotResolver = (value, assembly) => (
  assembly.unionReference(value, ['item', 'potion'], 'item')
)
const boneyardEnemySlot: SlotResolver = (value, assembly, path, source) => (
  assembly.enemy(value, path, source, true)
)
const spawnEnemySlot: SlotResolver = (value, assembly, path, source) => (
  assembly.enemy(value, path, source, false)
)
const stockEnemySlot: SlotResolver = (value, assembly, path, source) => (
  assembly.stockEnemy(value, path, source)
)
const grantSlot: SlotResolver = (value, assembly) => (
  assembly.unionReference(value, ['spell', 'ui'], 'spell')
)
const soundAssetSlot: SlotResolver = (value, assembly, _path, source) => (
  assembly.declareAutoAsset('sound', { path: value }, source)
)

/** Where a bare string inside content stands for a reference to another definition. */
const CONTENT_REFERENCE_SLOTS: Readonly<Partial<Record<WebLuaContentKind, Readonly<Record<string, SlotResolver>>>>> = {
  'affix-pool': { 'entries[].affix': contentSlot('affix') },
  boneyard: { 'roster[]': boneyardEnemySlot, 'waves[].roster[]': boneyardEnemySlot },
  potion: { status: contentSlot('status') },
  scene: { 'rooms[]': contentSlot('room') },
  shop: { 'services[].pool': contentSlot('affix-pool'), 'stock[].item': potionOrItemSlot },
  skill: {
    'grants[]': grantSlot,
    parent: contentSlot('skill'),
    'prerequisites[]': contentSlot('skill'),
    'ranks[].grant': grantSlot,
    'ranks[].grants[]': grantSlot,
  },
}

/** Where a bare string inside a rule stands for a reference or an asset. */
const RULE_REFERENCE_SLOTS: Readonly<Record<string, Readonly<Record<string, SlotResolver>>>> = {
  'effect.grant': { item: potionOrItemSlot },
  'effect.present': { sound: soundAssetSlot },
  'effect.spawn': { content: contentSlot('powerup'), enemy: spawnEnemySlot, token: stockEnemySlot },
  'effect.status': { status: contentSlot('status') },
  'prefab.portal': { destination: contentSlot('scene') },
}

/** Content fields that take one rule node; a plain list there becomes sd.all(...). */
const CONTENT_SINGLE_RULE_FIELDS: Readonly<Partial<Record<WebLuaContentKind, ReadonlySet<string>>>> = {
  item: new Set(['use']),
  potion: new Set(['on_use']),
  powerup: new Set(['effect']),
}

/** Rule fields that take one rule node; a plain list there becomes sd.all(...). */
const RULE_SINGLE_RULE_FIELDS: Readonly<Record<string, ReadonlySet<string>>> = {
  'rules.after': new Set(['node']),
  'rules.every': new Set(['node']),
  'rules.on': new Set(['node']),
  'rules.when': new Set(['no', 'yes']),
}

interface WalkSpec {
  readonly path: string
  readonly singles: ReadonlySet<string> | null
  readonly slots: Readonly<Record<string, SlotResolver>> | null
  readonly source: WebLuaDefinitionSource
}

interface AssemblyInput {
  readonly stockEnemies: ReadonlyMap<string, string>
  readonly assets: ReadonlyMap<number, WebLuaAssetDefinition>
  readonly content: ReadonlyMap<number, WebLuaContentDefinition>
  readonly identity: WebLuaModIdentity
  readonly issues: WebLuaDefinitionIssue[]
  readonly rules: ReadonlyMap<number, WebLuaRuleDefinition>
}

/**
 * Turns the creation-order registry plus the optional sd.mod lists into the
 * explicit 1.0 graph: keys every asset, lowers nested tokens and bare strings
 * to references, wraps loose lists, and attaches free rules.
 */
export function assembleWebLuaDefinition(
  input: AssemblyInput,
  explicit: WebLuaExplicitLists | null,
): Readonly<{
  assets: WebLuaAssetDefinition[]
  content: WebLuaContentDefinition[]
  rules: WebLuaRuleDefinition[]
}> {
  return new WebLuaAssembly(input).build(explicit)
}

class WebLuaAssembly {
  readonly #input: AssemblyInput
  readonly #assets: WebLuaAssetDefinition[] = []
  readonly #assetKeys = new Map<number, string>()
  readonly #assetsByKey = new Map<string, string>()
  readonly #assetsByShape = new Map<string, string>()
  readonly #consumed = new Set<number>()
  readonly #local = new Map<string, WebLuaContentDefinition>()

  constructor(input: AssemblyInput) {
    this.#input = input
  }

  build(explicit: WebLuaExplicitLists | null): Readonly<{
    assets: WebLuaAssetDefinition[]
    content: WebLuaContentDefinition[]
    rules: WebLuaRuleDefinition[]
  }> {
    for (const { key, node } of explicit?.assets ?? []) this.#declareAsset(node, key)
    for (const node of this.#input.assets.keys()) this.#declareAsset(node, '')

    const contentNodes: number[] = []
    const seen = new Set<number>()
    for (const node of [...(explicit?.content ?? []), ...this.#input.content.keys()]) {
      if (seen.has(node)) continue
      seen.add(node)
      contentNodes.push(node)
    }
    for (const node of contentNodes) {
      const definition = this.#input.content.get(node) as WebLuaContentDefinition
      const id = `${definition.contentKind}:${definition.key}`
      if (!this.#local.has(id)) this.#local.set(id, definition)
    }
    const content = contentNodes.map(node => (
      this.#lowerContent(this.#input.content.get(node) as WebLuaContentDefinition)
    ))

    const rules: WebLuaRuleDefinition[] = []
    const roots = new Set<number>()
    for (const node of explicit?.rules ?? []) {
      if (roots.has(node)) continue
      roots.add(node)
      rules.push(this.#lowerRule(this.#input.rules.get(node) as WebLuaRuleDefinition, 'rules'))
    }
    for (const [node, rule] of this.#input.rules) {
      if (roots.has(node) || this.#consumed.has(node) || rule.operation !== 'rules.on') continue
      roots.add(node)
      rules.push(this.#lowerRule(rule, 'rules'))
    }
    for (const [node, rule] of this.#input.rules) {
      if (roots.has(node) || this.#consumed.has(node)) continue
      this.#issue(
        'E_GRAPH',
        'rules',
        `${luaRuleName(rule.operation)} was created but never attached to anything; put it inside sd.on(event, ...), a potion's on_use, or another rule, or list it under sd.mod rules`,
        rule.source,
      )
    }
    return { assets: this.#assets, content, rules }
  }

  hasLocal(kind: WebLuaContentKind, key: string): boolean {
    return this.#local.has(`${kind}:${key}`)
  }

  reference(targetKind: WebLuaContentKind, key: string): WebLuaContentReference {
    return Object.freeze({
      key,
      kind: 'content-reference',
      modId: this.#input.identity.id,
      targetKind,
    })
  }

  unionReference(
    value: string,
    kinds: readonly WebLuaContentKind[],
    defaultKind: WebLuaContentKind,
  ): WebLuaContentReference {
    const exact = kinds.find(kind => this.hasLocal(kind, value))
    if (exact) return this.reference(exact, value)
    const candidates = [...this.#local.values()]
      .filter(definition => kinds.includes(definition.contentKind))
      .map(definition => definition.key)
    const suggestion = suggestWebLuaName(value, candidates)
    const suggestedKind = suggestion === null
      ? undefined
      : kinds.find(kind => this.hasLocal(kind, suggestion))
    return this.reference(suggestedKind ?? defaultKind, value)
  }

  enemy(
    value: string,
    path: string,
    source: WebLuaDefinitionSource,
    preserveStockName: boolean,
  ): WebLuaDefinitionValue {
    if (!value.startsWith('stock.') && this.hasLocal('enemy', value)) {
      return this.reference('enemy', value)
    }
    const token = this.#input.stockEnemies.get(value)
    if (token !== undefined) return preserveStockName ? value : token
    if (value.startsWith('stock.') || /^[A-Z][A-Z0-9_]*$/.test(value)) {
      this.#unknownStockEnemy(value, path, source)
      return value
    }
    return this.reference('enemy', value)
  }

  stockEnemy(
    value: string,
    path: string,
    source: WebLuaDefinitionSource,
  ): WebLuaDefinitionValue {
    const token = this.#input.stockEnemies.get(value)
    if (token !== undefined) return token
    this.#unknownStockEnemy(value, path, source)
    return value
  }

  declareAutoAsset(
    assetKind: WebLuaAssetKind,
    fields: Record<string, WebLuaDefinitionValue>,
    source: WebLuaDefinitionSource,
  ): WebLuaAssetReference {
    const frozen = Object.freeze({ ...fields })
    const shape = assetShape(assetKind, frozen)
    const existing = this.#assetsByShape.get(shape)
    if (existing !== undefined) return Object.freeze({ key: existing, kind: 'asset-reference' })
    const key = this.#deriveAssetKey(assetKind, frozen)
    this.#pushAsset(Object.freeze({
      assetKind,
      fields: frozen,
      key,
      kind: 'asset-definition',
      source: withoutNode(source),
    }), shape)
    return Object.freeze({ key, kind: 'asset-reference' })
  }

  #declareAsset(node: number, requestedKey: string): void {
    if (this.#assetKeys.has(node)) return
    const definition = this.#input.assets.get(node)
    if (!definition) return
    const shape = assetShape(definition.assetKind, definition.fields)
    let key = requestedKey || definition.key
    if (!key) {
      const existing = this.#assetsByShape.get(shape)
      if (existing !== undefined) {
        this.#assetKeys.set(node, existing)
        return
      }
      key = this.#deriveAssetKey(definition.assetKind, definition.fields)
    } else {
      const existingShape = this.#assetsByKey.get(key)
      if (existingShape !== undefined) {
        if (existingShape !== shape) {
          this.#issue(
            'E_DUPLICATE',
            `assets.${key}`,
            `two different assets use the key ${key}; give one of them another key`,
            definition.source,
          )
        }
        this.#assetKeys.set(node, key)
        return
      }
    }
    this.#assetKeys.set(node, key)
    this.#pushAsset(Object.freeze({
      assetKind: definition.assetKind,
      fields: definition.fields,
      key,
      kind: 'asset-definition',
      source: definition.source,
    }), shape)
  }

  #pushAsset(definition: WebLuaAssetDefinition, shape: string): void {
    this.#assets.push(definition)
    this.#assetsByKey.set(definition.key, shape)
    if (!this.#assetsByShape.has(shape)) this.#assetsByShape.set(shape, definition.key)
  }

  #deriveAssetKey(assetKind: WebLuaAssetKind, fields: Readonly<Record<string, WebLuaDefinitionValue>>): string {
    const path = typeof fields.image === 'string'
      ? fields.image
      : typeof fields.path === 'string' ? fields.path : ''
    const base = path.split('/').pop() ?? ''
    const stem = base.replace(/\.[^.]*$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 96)
    const root = stem || assetKind
    const candidates = [root, `${root}.${assetKind}`]
    for (const candidate of candidates) {
      if (!this.#assetsByKey.has(candidate)) return candidate
    }
    for (let ordinal = 2; ; ordinal += 1) {
      const candidate = `${root}.${assetKind}.${ordinal}`
      if (!this.#assetsByKey.has(candidate)) return candidate
    }
  }

  #assetReference(token: Record<string, unknown>, path: string, source: WebLuaDefinitionSource): WebLuaAssetReference {
    const node = isRecord(token.source) ? token.source.node : undefined
    const key = typeof node === 'number' ? this.#assetKeys.get(node) : undefined
    if (key === undefined) {
      this.#issue('E_REFERENCE', path, 'this asset was not created by sd.art inside this script', source)
      return Object.freeze({ key: typeof token.key === 'string' ? token.key : '', kind: 'asset-reference' })
    }
    return Object.freeze({ key, kind: 'asset-reference' })
  }

  #contentReference(token: Record<string, unknown>, path: string, source: WebLuaDefinitionSource): WebLuaDefinitionValue {
    const targetKind = token.contentKind
    if (typeof targetKind !== 'string' || !contentKinds.has(targetKind) || typeof token.key !== 'string') {
      this.#issue('E_REFERENCE', path, 'this content token was not created by sd.kit inside this script', source)
      return null
    }
    return this.reference(targetKind as WebLuaContentKind, token.key)
  }

  #lowerContent(definition: WebLuaContentDefinition): WebLuaContentDefinition {
    const kind = definition.contentKind
    const path = `content.${definition.key}`
    const fields: Record<string, WebLuaDefinitionValue> = { ...definition.fields }
    const schemaFields = new Set<string>(WEB_LUA_CONTENT_SCHEMA_FIELDS[kind].allowed)
    const art: Record<string, WebLuaDefinitionValue> = isRecord(fields.art) ? { ...fields.art } : {}
    let artTouched = false
    for (const slot of WEB_LUA_CONTENT_ART_SLOTS[kind]) {
      if (schemaFields.has(slot) || !(slot in fields)) continue
      if (art[slot] !== undefined) {
        this.#issue('E_SCHEMA', `${path}.${slot}`, `${slot} is set both at the top level and inside art; keep one of them`, definition.source)
      }
      art[slot] = fields[slot]
      delete fields[slot]
      artTouched = true
    }
    if (kind === 'boneyard' && typeof fields.source === 'string' && art.layout === undefined) {
      art.layout = fields.source
      artTouched = true
    }
    if (artTouched && fields.art !== undefined && !isRecord(fields.art)) {
      this.#issue(
        'E_SCHEMA',
        `${path}.art`,
        'art must be a table when shorthand art fields such as icon or sound are also used',
        definition.source,
      )
    }
    if (artTouched || isRecord(fields.art)) {
      for (const [slot, value] of Object.entries(art)) {
        if (typeof value === 'string') {
          const lowered = this.#artAssetFromPath(kind, slot, value, `${path}.art.${slot}`, definition.source)
          if (lowered) art[slot] = lowered
        } else if (isToken(value, 'asset-definition')) {
          art[slot] = this.#assetReference(value, `${path}.art.${slot}`, definition.source)
        }
      }
      fields.art = art
    }
    const spec: WalkSpec = {
      path,
      singles: CONTENT_SINGLE_RULE_FIELDS[kind] ?? null,
      slots: CONTENT_REFERENCE_SLOTS[kind] ?? null,
      source: definition.source,
    }
    const lowered: Record<string, WebLuaDefinitionValue> = {}
    for (const [field, value] of Object.entries(fields)) {
      lowered[field] = field === 'art' ? value : this.#lowerValue(value, [field], spec)
    }
    if (kind === 'potion') {
      const status = lowered.status
      if (isToken(status, 'content-reference') && status.targetKind === 'status' && typeof status.key === 'string') {
        if (lowered.on_use === undefined) {
          lowered.on_use = syntheticRule('effect.status', { status, target: 'user' }, definition.source)
        }
        const local = this.#local.get(`status:${status.key}`)
        if (lowered.duration === undefined && local && local.fields.duration !== undefined) {
          lowered.duration = local.fields.duration
        }
      }
    }
    return Object.freeze({
      contentKind: kind,
      fields: Object.freeze(lowered),
      key: definition.key,
      kind: 'content-definition',
      source: definition.source,
    })
  }

  #artAssetFromPath(
    kind: WebLuaContentKind,
    slot: string,
    value: string,
    path: string,
    source: WebLuaDefinitionSource,
  ): WebLuaAssetReference | null {
    switch (slot) {
      case 'atlas':
        this.#issue(
          'E_SCHEMA',
          path,
          `${kind} atlas needs sd.sheet(path, {frame = {width = ..., height = ...}, animations = {...}}) so the game knows its animation frames`,
          source,
        )
        return null
      case 'worn':
      case 'worn_trim':
        return this.declareAutoAsset('sheet', {
          animations: { wearable: [1] },
          frame: { height: 170, width: 170 },
          image: value,
        }, source)
      case 'sound':
      case 'attack_sound':
      case 'death_sound':
        return this.declareAutoAsset('sound', { path: value }, source)
      case 'ambience':
      case 'loop':
      case 'music':
        return this.declareAutoAsset('music', { path: value }, source)
      case 'layout':
        return this.declareAutoAsset(value.endsWith('.boneyard') ? 'boneyard' : 'scene', { path: value }, source)
      default:
        return this.declareAutoAsset('sprite', { path: value }, source)
    }
  }

  #lowerRule(token: object, path: string): WebLuaRuleDefinition {
    const rule = token as Record<string, unknown>
    const source = isRecord(rule.source) ? rule.source as unknown as WebLuaDefinitionSource : undefined
    if (source && typeof source.node === 'number') this.#consumed.add(source.node)
    const operation = typeof rule.operation === 'string' ? rule.operation : ''
    const spec: WalkSpec = {
      path,
      singles: RULE_SINGLE_RULE_FIELDS[operation] ?? null,
      slots: RULE_REFERENCE_SLOTS[operation] ?? null,
      source: source ?? Object.freeze({ column: 0, file: '', line: 0 }),
    }
    const fields: Record<string, WebLuaDefinitionValue> = {}
    for (const [field, value] of Object.entries(isRecord(rule.fields) ? rule.fields : {})) {
      fields[field] = this.#lowerValue(value as WebLuaDefinitionValue, [field], spec)
    }
    return Object.freeze({
      fields: Object.freeze(fields),
      kind: 'rule-definition',
      operation,
      source: spec.source,
    })
  }

  #lowerValue(value: WebLuaDefinitionValue, segments: readonly string[], spec: WalkSpec): WebLuaDefinitionValue {
    const slot = slotKey(segments)
    if (isToken(value, 'content-definition')) return this.#contentReference(value, `${spec.path}.${slot}`, spec.source)
    if (isToken(value, 'asset-definition')) return this.#assetReference(value, `${spec.path}.${slot}`, spec.source)
    if (isToken(value, 'rule-definition')) return this.#lowerRule(value, `${spec.path}.${slot}`)
    if (typeof value === 'string') {
      const resolve = spec.slots?.[slot]
      if (resolve) {
        const lowered = resolve(value, this, `${spec.path}.${slot}`, spec.source)
        if (lowered !== null) return lowered
      }
      return value
    }
    if (Array.isArray(value)) {
      if (spec.singles?.has(slot) && value.length > 0 && value.every(entry => isToken(entry, 'rule-definition'))) {
        return this.#lowerRule(
          syntheticRule('rules.all', { nodes: value as unknown as WebLuaDefinitionValue }, spec.source),
          `${spec.path}.${slot}`,
        )
      }
      return value.map(entry => this.#lowerValue(entry, [...segments, '[]'], spec))
    }
    if (isRecord(value)) {
      const lowered: Record<string, WebLuaDefinitionValue> = {}
      for (const [key, entry] of Object.entries(value)) {
        lowered[key] = this.#lowerValue(entry, [...segments, key], spec)
      }
      return lowered
    }
    return value
  }

  #unknownStockEnemy(value: string, path: string, source: WebLuaDefinitionSource): void {
    this.#issue(
      'E_REFERENCE',
      path,
      `unknown stock enemy ${value}${didYouMean(value, this.#input.stockEnemies.keys())}`,
      source,
    )
  }

  #issue(
    code: WebLuaDefinitionErrorCode,
    path: string,
    message: string,
    source: WebLuaDefinitionSource,
  ): void {
    this.#input.issues.push(webLuaDefinitionIssue(code, path, message, { source: withoutNode(source) }))
  }
}

function syntheticRule(
  operation: string,
  fields: Record<string, WebLuaDefinitionValue>,
  source: WebLuaDefinitionSource,
): WebLuaRuleDefinition {
  return Object.freeze({
    fields: Object.freeze(fields),
    kind: 'rule-definition',
    operation,
    source: withoutNode(source),
  })
}

function withoutNode(source: WebLuaDefinitionSource): WebLuaDefinitionSource {
  return Object.freeze({ column: source.column, file: source.file, line: source.line })
}

function assetShape(assetKind: string, fields: Readonly<Record<string, WebLuaDefinitionValue>>): string {
  return `${assetKind}\n${canonicalText(fields)}`
}

function canonicalText(value: WebLuaDefinitionValue): string {
  if (Array.isArray(value)) return `[${value.map(canonicalText).join(',')}]`
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalText(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function slotKey(segments: readonly string[]): string {
  let key = ''
  for (const segment of segments) {
    if (segment === '[]') key += '[]'
    else key += key ? `.${segment}` : segment
  }
  return key
}

function luaRuleName(operation: string): string {
  if (operation.startsWith('rules.')) return `sd.${operation.slice('rules.'.length)}`
  return `sd.${operation}`
}
