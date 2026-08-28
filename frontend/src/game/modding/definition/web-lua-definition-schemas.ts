import {
  WEB_LUA_RULE_EVENT_NAMES,
  type WebLuaAssetDefinition,
  type WebLuaContentDefinition,
  type WebLuaDefinitionValue,
  type WebLuaIntentDefinition,
  type WebLuaModDefinition,
  type WebLuaRuleDefinition,
  type WebLuaSchemaDefinition,
} from './web-lua-definition-types.ts'
import {
  webLuaDefinitionIssue,
  type WebLuaDefinitionIssue,
} from './web-lua-definition-error.ts'

interface ContentSchema {
  readonly allowed: ReadonlySet<string>
  readonly required: ReadonlySet<string>
}

const common = [
  'description',
  'name',
] as const

const schema = (
  allowed: readonly string[],
  required: readonly string[] = [],
): ContentSchema => ({
  allowed: new Set([...common, ...allowed]),
  required: new Set(required),
})

const CONTENT_SCHEMAS: Readonly<Record<WebLuaContentDefinition['contentKind'], ContentSchema>> = {
  affix: schema(['applies_to', 'modifiers'], ['name', 'modifiers']),
  'affix-pool': schema([
    'applies_to',
    'entries',
    'rng_domain',
    'rolls',
  ], ['entries']),
  boneyard: schema([
    'anchors',
    'art',
    'environment',
    'roster',
    'source',
    'triggers',
    'waves',
  ], ['name', 'source']),
  enemy: schema([
    'art',
    'loot',
    'stats',
  ], ['name']),
  item: schema(['art', 'equipment', 'stack', 'use'], ['name']),
  potion: schema([
    'art',
    'duration',
    'loot',
    'on_use',
    'presentation',
    'status',
  ], ['duration', 'name', 'on_use']),
  powerup: schema([
    'art',
    'effect',
    'pickup',
  ], ['effect', 'name']),
  room: schema(['art', 'geometry', 'props'], ['geometry']),
  scene: schema([
    'art',
    'rooms',
  ], ['rooms']),
  'scene-extension': schema(['features', 'scene'], ['features', 'scene']),
  shop: schema([
    'art',
    'mount',
    'npc',
    'restock',
    'services',
    'stock',
    'stock_scope',
  ], ['name', 'stock']),
  skill: schema([
    'art',
    'grants',
    'maximum_rank',
    'offer',
    'parent',
    'prerequisites',
    'ranks',
  ], ['name', 'ranks']),
  spell: schema([
    'art',
    'behavior',
    'cooldown',
    'mana',
    'slot',
  ], ['behavior', 'name', 'slot']),
  status: schema(['duration', 'modifiers', 'stacking']),
  ui: schema(['accessible_name', 'actions', 'bindings', 'mount', 'view', 'visible'], ['mount', 'view']),
}

export const WEB_LUA_CONTENT_SCHEMA_FIELDS = Object.freeze(Object.fromEntries(
  Object.entries(CONTENT_SCHEMAS).map(([kind, definition]) => [kind, Object.freeze({
    allowed: Object.freeze([...definition.allowed].sort()),
    required: Object.freeze([...definition.required].sort()),
  })]),
)) as Readonly<Record<WebLuaContentDefinition['contentKind'], Readonly<{
  allowed: readonly string[]
  required: readonly string[]
}>>>

const ASSET_FIELDS: Readonly<Record<WebLuaAssetDefinition['assetKind'], ReadonlySet<string>>> = {
  boneyard: new Set(['path']),
  music: new Set(['bus', 'loop', 'path', 'volume']),
  scene: new Set(['path']),
  sheet: new Set(['animations', 'frame', 'headings', 'image']),
  sound: new Set(['bus', 'path', 'volume']),
  sprite: new Set(['frame', 'frames', 'path']),
}

const DURATION = /^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:ms|s|m|h)$/
const STACKING = new Set(['ignore', 'refresh', 'replace', 'stack'])

export function validateWebLuaAssetSchema(
  definition: WebLuaAssetDefinition,
  index: number,
  issues: WebLuaDefinitionIssue[],
): void {
  const path = `assets[${index}].fields`
  validateUnknownFields(definition.fields, ASSET_FIELDS[definition.assetKind], path, definition, issues)
  const file = definition.assetKind === 'sheet'
    ? definition.fields.image
    : definition.fields.path
  if (typeof file !== 'string' || file.length === 0) {
    issues.push(webLuaDefinitionIssue(
      'E_ASSET', path, `${definition.assetKind} asset requires an owned package path`,
      { source: definition.source },
    ))
  }
}

export function validateWebLuaContentSchema(
  definition: WebLuaContentDefinition,
  index: number,
  issues: WebLuaDefinitionIssue[],
): void {
  const contentSchema = CONTENT_SCHEMAS[definition.contentKind]
  const path = `content[${index}].fields`
  validateUnknownFields(definition.fields, contentSchema.allowed, path, definition, issues)
  for (const field of contentSchema.required) {
    if (definition.fields[field] === undefined || definition.fields[field] === null) {
      issues.push(webLuaDefinitionIssue(
        'E_SCHEMA', `${path}.${field}`, `${definition.contentKind} requires ${field}`,
        { source: definition.source },
      ))
    }
  }
  if (definition.fields.name !== undefined) {
    validateText(definition.fields.name, `${path}.name`, definition, issues)
  }
  if (definition.fields.description !== undefined) {
    validateText(definition.fields.description, `${path}.description`, definition, issues, 1_024)
  }
  if (definition.fields.duration !== undefined) {
    validateDuration(definition.fields.duration, `${path}.duration`, definition, issues)
  }
  if (definition.fields.cooldown !== undefined) {
    validateDuration(definition.fields.cooldown, `${path}.cooldown`, definition, issues)
  }
  if (definition.fields.stacking !== undefined && (
    typeof definition.fields.stacking !== 'string' || !STACKING.has(definition.fields.stacking)
  )) {
    issues.push(webLuaDefinitionIssue(
      'E_SCHEMA',
      `${path}.stacking`,
      'expected "refresh", "stack", "replace", or "ignore"',
      { source: definition.source },
    ))
  }
  validateLootProbabilities(definition.fields.loot, `${path}.loot`, definition, issues)
}

export function validateWebLuaDefinitionNodes(
  definition: WebLuaModDefinition,
  issues: WebLuaDefinitionIssue[],
): void {
  const seen = new Set<object>()
  const assetKinds = new Map(definition.assets.map(asset => [asset.key, asset.assetKind]))
  const visit = (value: unknown, path: string): void => {
    if (!value || typeof value !== 'object' || seen.has(value)) return
    seen.add(value)
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, `${path}[${index}]`))
      return
    }
    const token = value as Readonly<{ kind?: unknown }>
    if (token.kind === 'rule-definition') {
      const rule = value as WebLuaRuleDefinition
      validateRule(rule, path, issues)
      if (rule.operation === 'effect.present' && isAssetReference(rule.fields.sound)) {
        const key = (rule.fields.sound as Readonly<{ key?: unknown }>).key
        if (typeof key === 'string' && assetKinds.get(key) !== 'sound') issues.push(webLuaDefinitionIssue(
          'E_SCHEMA', `${path}.fields.sound`, 'effect.present requires an sd.art.sound reference',
          { source: rule.source },
        ))
      }
    }
    if (token.kind === 'schema-definition') validateSchema(value as WebLuaSchemaDefinition, path, issues)
    if (token.kind === 'intent-definition') validateIntent(value as WebLuaIntentDefinition, path, issues)
    Object.entries(value).forEach(([key, child]) => {
      if (typeof child !== 'function') visit(child, `${path}.${key}`)
    })
  }
  definition.content.forEach((entry, index) => visit(entry.fields, `content[${index}].fields`))
  definition.rules.forEach((rule, index) => visit(rule, `rules[${index}]`))
  definition.reducers.forEach((reducer, index) => visit(reducer.state, `reducers[${index}].state`))
}

function validateRule(
  rule: WebLuaRuleDefinition,
  path: string,
  issues: WebLuaDefinitionIssue[],
): void {
  const fields = rule.fields
  const exact = (allowed: readonly string[]) => validateUnknownFields(
    fields,
    new Set(allowed),
    `${path}.fields`,
    rule,
    issues,
  )
  const required = (...names: string[]) => names.forEach((name) => {
    if (fields[name] === undefined || fields[name] === null) issues.push(webLuaDefinitionIssue(
      'E_SCHEMA', `${path}.fields.${name}`, `${rule.operation} requires ${name}`, { source: rule.source },
    ))
  })
  switch (rule.operation) {
    case 'rules.on':
      exact(['event', 'node']); required('event', 'node')
      requireText(fields.event, `${path}.fields.event`, rule, issues)
      validateEventName(fields.event, `${path}.fields.event`, rule, issues)
      requireRule(fields.node, `${path}.fields.node`, rule, issues)
      return
    case 'rules.all':
    case 'rules.first':
      exact(['nodes']); required('nodes')
      requireRules(fields.nodes, `${path}.fields.nodes`, rule, issues)
      return
    case 'rules.when':
      exact(['no', 'predicate', 'yes']); required('predicate', 'yes')
      validatePredicate(fields.predicate, `${path}.fields.predicate`, rule, issues)
      requireRule(fields.yes, `${path}.fields.yes`, rule, issues)
      if (fields.no !== undefined) requireRule(fields.no, `${path}.fields.no`, rule, issues)
      return
    case 'rules.after':
      exact(['duration', 'node']); required('duration', 'node')
      validateDuration(fields.duration, `${path}.fields.duration`, rule, issues)
      requireRule(fields.node, `${path}.fields.node`, rule, issues)
      return
    case 'rules.every':
      exact(['interval', 'node', 'times']); required('interval', 'node', 'times')
      validateDuration(fields.interval, `${path}.fields.interval`, rule, issues)
      requireRule(fields.node, `${path}.fields.node`, rule, issues)
      if (!Number.isSafeInteger(fields.times) || Number(fields.times) < 1 || Number(fields.times) > 1_024) {
        issues.push(webLuaDefinitionIssue(
          'E_SCHEMA', `${path}.fields.times`, 'rules.every times must be an integer within 1..1024',
          { source: rule.source },
        ))
      }
      return
    case 'prefab.area':
      validatePrefab(rule, path, ['duration', 'effects', 'every', 'radius'], ['duration', 'effects', 'every', 'radius'], issues)
      return
    case 'prefab.channel':
      validatePrefab(rule, path, ['duration', 'effects', 'every', 'width'], ['duration', 'effects', 'every', 'width'], issues)
      return
    case 'prefab.projectile':
      validatePrefab(rule, path, ['duration', 'effects', 'radius', 'speed'], ['duration', 'effects', 'radius', 'speed'], issues)
      return
    case 'prefab.minimap':
      exact(['layers', 'range', 'size']); required('range', 'size')
      validateMinimap(fields, path, rule, issues)
      return
    case 'prefab.portal':
      exact(['destination', 'policy', 'prompt', 'selector']); required('destination', 'selector')
      validatePortal(fields, path, rule, issues)
      return
    case 'effect.damage': validateEffectFields(rule, path, ['amount', 'modifier', 'target'], ['amount', 'target'], issues); return
    case 'effect.resource': validateEffectFields(rule, path, ['experience', 'gold', 'health', 'mana', 'target'], ['target'], issues); return
    case 'effect.status': validateEffectFields(rule, path, ['status', 'target'], ['status', 'target'], issues); return
    case 'effect.spawn': validateEffectFields(rule, path, ['content', 'enemy', 'token', 'x', 'y'], [], issues); return
    case 'effect.grant': validateEffectFields(rule, path, ['item', 'quantity', 'target'], ['item', 'target'], issues); return
    case 'effect.state': validateEffectFields(rule, path, ['clear', 'key', 'value'], ['key'], issues); return
    case 'effect.present': validateEffectFields(rule, path, ['sound'], ['sound'], issues); return
    default:
      issues.push(webLuaDefinitionIssue(
        'E_SCHEMA', path, `unsupported Web Lua rule operation: ${rule.operation}`, { source: rule.source },
      ))
  }
}

function validateIntent(
  intent: WebLuaIntentDefinition,
  path: string,
  issues: WebLuaDefinitionIssue[],
): void {
  const wrapper: WebLuaRuleDefinition = {
    fields: intent.fields,
    kind: 'rule-definition',
    operation: `effect.${intent.intentKind}`,
    source: intent.source,
  }
  validateRule(wrapper, path, issues)
}

function validateSchema(
  schema: WebLuaSchemaDefinition,
  path: string,
  issues: WebLuaDefinitionIssue[],
): void {
  const allowed: Readonly<Record<string, readonly string[]>> = {
    array: ['item', 'max_items'],
    boolean: ['default'],
    enum: ['values'],
    integer: ['default', 'max', 'min'],
    number: ['default', 'max', 'min'],
    object: ['fields'],
    string: ['default', 'max_bytes'],
  }
  const fields = allowed[schema.schemaKind]
  if (!fields) {
    issues.push(webLuaDefinitionIssue(
      'E_SCHEMA', path, `unsupported schema kind: ${schema.schemaKind}`, { source: schema.source },
    ))
    return
  }
  validateUnknownFields(schema.fields, new Set(fields), `${path}.fields`, schema, issues)
  if (schema.schemaKind === 'array' && !isSchema(schema.fields.item)) {
    issues.push(webLuaDefinitionIssue('E_SCHEMA', `${path}.fields.item`, 'array schema requires item', { source: schema.source }))
  }
  if (schema.schemaKind === 'object' && (!schema.fields.fields || typeof schema.fields.fields !== 'object' || Array.isArray(schema.fields.fields))) {
    issues.push(webLuaDefinitionIssue('E_SCHEMA', `${path}.fields.fields`, 'object schema requires fields', { source: schema.source }))
  }
  if (schema.schemaKind === 'enum' && (!Array.isArray(schema.fields.values) || schema.fields.values.length === 0)) {
    issues.push(webLuaDefinitionIssue('E_SCHEMA', `${path}.fields.values`, 'enum schema requires values', { source: schema.source }))
  }
}

function validatePrefab(
  rule: WebLuaRuleDefinition,
  path: string,
  allowed: readonly string[],
  required: readonly string[],
  issues: WebLuaDefinitionIssue[],
): void {
  validateUnknownFields(rule.fields, new Set(allowed), `${path}.fields`, rule, issues)
  required.forEach((name) => {
    if (rule.fields[name] === undefined || rule.fields[name] === null) issues.push(webLuaDefinitionIssue(
      'E_SCHEMA', `${path}.fields.${name}`, `${rule.operation} requires ${name}`, { source: rule.source },
    ))
  })
  if (rule.fields.duration !== undefined) validateDuration(rule.fields.duration, `${path}.fields.duration`, rule, issues)
  if (rule.fields.every !== undefined) validateDuration(rule.fields.every, `${path}.fields.every`, rule, issues)
  for (const name of ['radius', 'speed', 'width']) {
    const value = rule.fields[name]
    if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)) {
      issues.push(webLuaDefinitionIssue(
        'E_SCHEMA', `${path}.fields.${name}`, `${rule.operation} ${name} must be positive`,
        { source: rule.source },
      ))
    }
  }
  requireRules(rule.fields.effects, `${path}.fields.effects`, rule, issues, true)
}

function validateEffectFields(
  rule: WebLuaRuleDefinition,
  path: string,
  allowed: readonly string[],
  required: readonly string[],
  issues: WebLuaDefinitionIssue[],
): void {
  validateUnknownFields(rule.fields, new Set(allowed), `${path}.fields`, rule, issues)
  required.forEach((name) => {
    if (rule.fields[name] === undefined || rule.fields[name] === null) issues.push(webLuaDefinitionIssue(
      'E_SCHEMA', `${path}.fields.${name}`, `${rule.operation} requires ${name}`, { source: rule.source },
    ))
  })
  if (rule.operation === 'effect.resource' && !['experience', 'gold', 'health', 'mana'].some(name => rule.fields[name] !== undefined)) {
    issues.push(webLuaDefinitionIssue('E_SCHEMA', `${path}.fields`, 'effect.resource requires a resource value', { source: rule.source }))
  }
  if (rule.operation === 'effect.spawn' && !['content', 'enemy', 'token'].some(name => rule.fields[name] !== undefined)) {
    issues.push(webLuaDefinitionIssue('E_SCHEMA', `${path}.fields`, 'effect.spawn requires content, enemy, or token', { source: rule.source }))
  }
  if (rule.operation === 'effect.state') {
    const hasValue = rule.fields.value !== undefined
    const clears = rule.fields.clear === true
    if (hasValue === clears) issues.push(webLuaDefinitionIssue(
      'E_SCHEMA', `${path}.fields`, 'effect.state requires exactly one of value or clear = true', { source: rule.source },
    ))
  }
  if (rule.operation === 'effect.damage' && (
    typeof rule.fields.amount !== 'number' || !Number.isFinite(rule.fields.amount) || rule.fields.amount <= 0
  )) issues.push(webLuaDefinitionIssue('E_SCHEMA', `${path}.fields.amount`, 'effect.damage amount must be positive', { source: rule.source }))
  if (rule.operation === 'effect.status' && !isContentReference(rule.fields.status, 'status')) {
    issues.push(webLuaDefinitionIssue('E_SCHEMA', `${path}.fields.status`, 'effect.status requires a status reference', { source: rule.source }))
  }
  if (rule.operation === 'effect.grant' && !isContentReference(rule.fields.item, 'item', 'potion')) {
    issues.push(webLuaDefinitionIssue('E_SCHEMA', `${path}.fields.item`, 'effect.grant requires an item or potion reference', { source: rule.source }))
  }
  if (rule.operation === 'effect.present' && !isAssetReference(rule.fields.sound)) {
    issues.push(webLuaDefinitionIssue('E_SCHEMA', `${path}.fields.sound`, 'effect.present requires a sound asset reference', { source: rule.source }))
  }
  if (rule.operation === 'effect.spawn') {
    const content = rule.fields.content
    const enemy = rule.fields.enemy
    if (content !== undefined && !isContentReference(content, 'powerup')) {
      issues.push(webLuaDefinitionIssue('E_SCHEMA', `${path}.fields.content`, 'effect.spawn content requires a powerup reference', { source: rule.source }))
    }
    if (enemy !== undefined && typeof enemy !== 'string' && !isContentReference(enemy, 'enemy')) {
      issues.push(webLuaDefinitionIssue('E_SCHEMA', `${path}.fields.enemy`, 'effect.spawn enemy requires an enemy reference or stock token', { source: rule.source }))
    }
  }
}

function validatePredicate(
  value: WebLuaDefinitionValue | undefined,
  path: string,
  owner: Pick<WebLuaRuleDefinition, 'source'>,
  issues: WebLuaDefinitionIssue[],
): void {
  if (typeof value === 'boolean') return
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    issues.push(webLuaDefinitionIssue('E_SCHEMA', path, 'rules.when predicate must be boolean or a predicate table', { source: owner.source }))
    return
  }
  const fields = value as Readonly<Record<string, WebLuaDefinitionValue>>
  validateUnknownFields(fields, new Set(['context', 'equals', 'event']), path, owner, issues)
  const hasEvent = typeof fields.event === 'string' && fields.event.length > 0
  const hasContext = typeof fields.context === 'string' && fields.context.length > 0
  if (hasEvent === hasContext || (hasEvent && fields.equals !== undefined)) issues.push(webLuaDefinitionIssue(
    'E_SCHEMA', path, 'predicate requires exactly one of event or context; equals is valid only with context',
    { source: owner.source },
  ))
}

function validateMinimap(
  fields: Readonly<Record<string, WebLuaDefinitionValue>>,
  path: string,
  owner: Pick<WebLuaRuleDefinition, 'source'>,
  issues: WebLuaDefinitionIssue[],
): void {
  if (fields.layers !== undefined && (!Array.isArray(fields.layers) || fields.layers.some(layer => (
    layer !== 'party' && layer !== 'visible_hostiles' && layer !== 'powerups'
  )))) issues.push(webLuaDefinitionIssue(
    'E_SCHEMA', `${path}.fields.layers`, 'minimap layers support party, visible_hostiles, and powerups',
    { source: owner.source },
  ))
  if (typeof fields.range !== 'number' || !Number.isFinite(fields.range) || fields.range <= 0) {
    issues.push(webLuaDefinitionIssue('E_SCHEMA', `${path}.fields.range`, 'minimap range must be positive', { source: owner.source }))
  }
  if (fields.size && typeof fields.size === 'object' && !Array.isArray(fields.size)) {
    validateUnknownFields(
      fields.size as Readonly<Record<string, WebLuaDefinitionValue>>,
      new Set(['height', 'width']),
      `${path}.fields.size`,
      owner,
      issues,
    )
    const size = fields.size as Readonly<Record<string, unknown>>
    if (typeof size.width !== 'number' || !Number.isFinite(size.width) || size.width <= 0 ||
        typeof size.height !== 'number' || !Number.isFinite(size.height) || size.height <= 0) {
      issues.push(webLuaDefinitionIssue('E_SCHEMA', `${path}.fields.size`, 'minimap width and height must be positive', { source: owner.source }))
    }
  } else if (typeof fields.size !== 'number' || !Number.isFinite(fields.size) || fields.size <= 0) {
    issues.push(webLuaDefinitionIssue('E_SCHEMA', `${path}.fields.size`, 'minimap size must be a number or width/height table', { source: owner.source }))
  }
}

function validatePortal(
  fields: Readonly<Record<string, WebLuaDefinitionValue>>,
  path: string,
  owner: Pick<WebLuaRuleDefinition, 'source'>,
  issues: WebLuaDefinitionIssue[],
): void {
  const selector = fields.selector
  if (!selector || typeof selector !== 'object' || Array.isArray(selector)) {
    issues.push(webLuaDefinitionIssue('E_SCHEMA', `${path}.fields.selector`, 'portal selector must be a table', { source: owner.source }))
  } else {
    validateUnknownFields(
      selector as Readonly<Record<string, WebLuaDefinitionValue>>,
      new Set(['object_kind']),
      `${path}.fields.selector`,
      owner,
      issues,
    )
    if ((selector as Readonly<Record<string, unknown>>).object_kind !== 'monument') issues.push(webLuaDefinitionIssue(
      'E_SCHEMA', `${path}.fields.selector.object_kind`, 'Web Lua 1.0 portals attach to monument objects',
      { source: owner.source },
    ))
  }
  if (fields.policy !== undefined && fields.policy !== 'leader_confirms' && fields.policy !== 'any_member') {
    issues.push(webLuaDefinitionIssue('E_SCHEMA', `${path}.fields.policy`, 'portal policy must be leader_confirms or any_member', { source: owner.source }))
  }
  if (fields.prompt !== undefined && (typeof fields.prompt !== 'string' || fields.prompt.length === 0)) {
    issues.push(webLuaDefinitionIssue('E_SCHEMA', `${path}.fields.prompt`, 'portal prompt must be nonempty text', { source: owner.source }))
  }
}

function requireText(
  value: WebLuaDefinitionValue | undefined,
  path: string,
  owner: Pick<WebLuaRuleDefinition, 'source'>,
  issues: WebLuaDefinitionIssue[],
): void {
  if (typeof value !== 'string' || value.length === 0) issues.push(webLuaDefinitionIssue(
    'E_SCHEMA', path, 'expected nonempty text', { source: owner.source },
  ))
}

function validateEventName(
  value: WebLuaDefinitionValue | undefined,
  path: string,
  owner: Pick<WebLuaRuleDefinition, 'source'>,
  issues: WebLuaDefinitionIssue[],
): void {
  if (typeof value === 'string' && WEB_LUA_RULE_EVENT_NAMES.includes(
    value as typeof WEB_LUA_RULE_EVENT_NAMES[number],
  )) return
  issues.push(webLuaDefinitionIssue(
    'E_SCHEMA',
    path,
    `unknown event; expected one of ${WEB_LUA_RULE_EVENT_NAMES.join(', ')}`,
    { source: owner.source },
  ))
}

function requireRule(
  value: WebLuaDefinitionValue | undefined,
  path: string,
  owner: Pick<WebLuaRuleDefinition, 'source'>,
  issues: WebLuaDefinitionIssue[],
): void {
  if (!isRule(value)) issues.push(webLuaDefinitionIssue('E_SCHEMA', path, 'expected an sd.rules, sd.effect, or sd.prefab node', { source: owner.source }))
}

function requireRules(
  value: WebLuaDefinitionValue | undefined,
  path: string,
  owner: Pick<WebLuaRuleDefinition, 'source'>,
  issues: WebLuaDefinitionIssue[],
  effectsOnly = false,
): void {
  if (!Array.isArray(value) || value.length === 0 || value.some(node => (
    !isRule(node) || (effectsOnly && !(node as WebLuaRuleDefinition).operation.startsWith('effect.'))
  ))) issues.push(webLuaDefinitionIssue(
    'E_SCHEMA', path, effectsOnly ? 'expected a nonempty array of sd.effect nodes' : 'expected a nonempty array of rule nodes',
    { source: owner.source },
  ))
}

function isRule(value: unknown): value is WebLuaRuleDefinition {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && (value as { kind?: unknown }).kind === 'rule-definition')
}

function isSchema(value: unknown): value is WebLuaSchemaDefinition {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && (value as { kind?: unknown }).kind === 'schema-definition')
}

function isAssetReference(value: unknown): boolean {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) &&
    (value as { kind?: unknown }).kind === 'asset-reference')
}

function isContentReference(value: unknown, ...kinds: string[]): boolean {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) &&
    (value as { kind?: unknown }).kind === 'content-reference' &&
    kinds.includes(String((value as { targetKind?: unknown }).targetKind)))
}

function validateUnknownFields(
  fields: Readonly<Record<string, WebLuaDefinitionValue>>,
  allowed: ReadonlySet<string>,
  path: string,
  definition: Pick<WebLuaContentDefinition, 'source'>,
  issues: WebLuaDefinitionIssue[],
): void {
  for (const key of Object.keys(fields)) {
    if (allowed.has(key)) continue
    issues.push(webLuaDefinitionIssue(
      'E_UNKNOWN_FIELD',
      `${path}.${key}`,
      `field is not supported by this 1.0 definition`,
      { source: definition.source },
    ))
  }
}

function validateText(
  value: WebLuaDefinitionValue,
  path: string,
  definition: Pick<WebLuaContentDefinition, 'source'>,
  issues: WebLuaDefinitionIssue[],
  maximum = 128,
): void {
  if (typeof value === 'string' && value.length > 0 && Buffer.byteLength(value, 'utf8') <= maximum) {
    return
  }
  issues.push(webLuaDefinitionIssue(
    'E_SCHEMA', path, `expected nonempty text of at most ${maximum} bytes`,
    { source: definition.source },
  ))
}

function validateDuration(
  value: WebLuaDefinitionValue,
  path: string,
  definition: Pick<WebLuaContentDefinition, 'source'>,
  issues: WebLuaDefinitionIssue[],
): void {
  if ((typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) || (
    typeof value === 'string' && DURATION.test(value)
  )) return
  issues.push(webLuaDefinitionIssue(
    'E_SCHEMA', path, 'expected nonnegative milliseconds or a duration such as "180s" or "3m"',
    { source: definition.source },
  ))
}

function validateLootProbabilities(
  value: WebLuaDefinitionValue | undefined,
  path: string,
  definition: Pick<WebLuaContentDefinition, 'source'>,
  issues: WebLuaDefinitionIssue[],
): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return
  const loot = value as Readonly<Record<string, WebLuaDefinitionValue>>
  for (const field of ['ordinary', 'boss']) {
    const candidate = loot[field]
    if (candidate === undefined) continue
    if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0 && candidate <= 1) {
      continue
    }
    issues.push(webLuaDefinitionIssue(
      'E_SCHEMA', `${path}.${field}`, 'expected a probability from 0 through 1',
      { source: definition.source },
    ))
  }
}
