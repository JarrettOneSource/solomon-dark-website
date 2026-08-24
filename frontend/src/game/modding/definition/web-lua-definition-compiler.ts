import { createHash } from 'node:crypto'

import {
  DEFAULT_WEB_LUA_DEFINITION_LIMITS,
  WEB_LUA_DEFINITION_API_VERSION,
  type CompiledWebLuaAsset,
  type CompiledWebLuaContent,
  type CompiledWebLuaMod,
  type CompiledWebLuaReducer,
  type ResolvedWebLuaContentReference,
  type WebLuaAssetDefinition,
  type WebLuaAssetReference,
  type WebLuaContentDefinition,
  type WebLuaContentReference,
  type WebLuaDefinitionLimits,
  type WebLuaDefinitionSource,
  type WebLuaDefinitionValue,
  type WebLuaModDefinition,
  type WebLuaModIdentity,
} from './web-lua-definition-types.ts'
import {
  WebLuaDefinitionError,
  webLuaDefinitionIssue,
  type WebLuaDefinitionIssue,
} from './web-lua-definition-error.ts'
import {
  stableWebLuaContentId,
  validWebLuaContentKey,
} from './web-lua-content-identity.ts'
import {
  validateWebLuaAssetSchema,
  validateWebLuaContentSchema,
} from './web-lua-definition-schemas.ts'

export interface WebLuaDefinitionDependency {
  readonly content: readonly Readonly<{
    contentId: string
    contentKind: WebLuaContentDefinition['contentKind']
    key: string
  }>[]
  readonly id: string
}

export interface CompileWebLuaDefinitionOptions {
  readonly dependencies?: readonly WebLuaDefinitionDependency[]
  readonly limits?: WebLuaDefinitionLimits
  readonly stockContent?: readonly Readonly<{
    contentId: string
    contentKind: WebLuaContentDefinition['contentKind']
    key: string
  }>[]
}

interface CompileContext {
  readonly assets: ReadonlyMap<string, WebLuaAssetDefinition>
  readonly content: ReadonlyMap<string, Readonly<{
    contentId: string
    definition: WebLuaContentDefinition
    modId: string
  }>>
  readonly dependencies: ReadonlyMap<string, WebLuaDefinitionDependency>
  readonly identity: WebLuaModIdentity
  readonly issues: WebLuaDefinitionIssue[]
  readonly limits: WebLuaDefinitionLimits
  readonly stockContent: ReadonlyMap<string, Readonly<{
    contentId: string
    contentKind: WebLuaContentDefinition['contentKind']
    key: string
  }>>
}

export function compileWebLuaDefinition(
  identity: WebLuaModIdentity,
  definition: WebLuaModDefinition,
  options: CompileWebLuaDefinitionOptions = {},
): CompiledWebLuaMod {
  const limits = options.limits ?? DEFAULT_WEB_LUA_DEFINITION_LIMITS
  const issues: WebLuaDefinitionIssue[] = []
  if (definition.api !== WEB_LUA_DEFINITION_API_VERSION) {
    issues.push(webLuaDefinitionIssue(
      'E_API_VERSION',
      'api',
      `expected ${WEB_LUA_DEFINITION_API_VERSION}, received ${String(definition.api)}`,
    ))
  }
  validateCount(definition.assets, limits.maximumAssets, 'assets', issues)
  validateCount(definition.content, limits.maximumContent, 'content', issues)
  validateCount(definition.rules, limits.maximumRules, 'rules', issues)
  validateCount(definition.reducers, limits.maximumReducers, 'reducers', issues)

  const assets = definitionsByKey(definition.assets, 'asset', issues)
  const content = contentByKey(identity, definition.content, issues)
  const dependencies = uniqueDependencies(options.dependencies ?? [], issues)
  const stockContent = new Map((options.stockContent ?? []).map(entry => [
    `${entry.contentKind}:${entry.key}`,
    entry,
  ]))
  const context: CompileContext = {
    assets,
    content,
    dependencies,
    identity,
    issues,
    limits,
    stockContent,
  }

  definition.assets.forEach((asset, index) => validateWebLuaAssetSchema(asset, index, issues))
  definition.content.forEach((entry, index) => validateWebLuaContentSchema(entry, index, issues))
  validateDefinitionBudgets(definition, context)
  validateContentCycles(definition.content, context)
  validateExclusiveMounts(definition.content, context)

  const compiledAssets: CompiledWebLuaAsset[] = definition.assets.map((asset, index) => ({
    assetKind: asset.assetKind,
    fields: resolveRecord(asset.fields, `assets[${index}].fields`, asset.source, context),
    key: asset.key,
  })).sort((left, right) => left.key.localeCompare(right.key))
  const compiledContent: CompiledWebLuaContent[] = definition.content.map((entry, index) => ({
    contentId: stableWebLuaContentId(identity.id, entry.key),
    contentKind: entry.contentKind,
    fields: resolveRecord(entry.fields, `content[${index}].fields`, entry.source, context),
    key: entry.key,
  })).sort((left, right) => left.key.localeCompare(right.key))
  const compiledReducers: CompiledWebLuaReducer[] = definition.reducers.map(reducer => ({
    key: reducer.key,
    on: [...reducer.on],
    schemaVersion: reducer.schemaVersion,
    scope: reducer.scope,
    state: reducer.state,
  })).sort((left, right) => left.key.localeCompare(right.key))
  if (issues.length > 0) throw new WebLuaDefinitionError(issues)

  const canonical = canonicalGraph({
    apiVersion: WEB_LUA_DEFINITION_API_VERSION,
    assets: compiledAssets,
    content: compiledContent,
    identity,
    reducers: compiledReducers,
    rules: definition.rules,
  })
  const canonicalJson = JSON.stringify(canonical)
  return Object.freeze({
    apiVersion: WEB_LUA_DEFINITION_API_VERSION,
    assets: Object.freeze(compiledAssets),
    canonicalJson,
    capabilities: Object.freeze(inferCapabilities(definition)),
    content: Object.freeze(compiledContent),
    graphSha256: createHash('sha256').update(canonicalJson).digest('hex'),
    identity: Object.freeze({ ...identity }),
    reducers: Object.freeze(compiledReducers),
    rules: Object.freeze([...definition.rules]),
  })
}

function definitionsByKey<T extends { readonly key: string; readonly source: WebLuaDefinitionSource }>(
  definitions: readonly T[],
  label: string,
  issues: WebLuaDefinitionIssue[],
): ReadonlyMap<string, T> {
  const result = new Map<string, T>()
  definitions.forEach((definition, index) => {
    validateKey(definition.key, `${label}s[${index}].key`, definition.source, issues)
    if (result.has(definition.key)) {
      issues.push(webLuaDefinitionIssue(
        'E_DUPLICATE',
        `${label}s[${index}].key`,
        `duplicate ${label} key: ${definition.key}`,
        { source: definition.source },
      ))
    } else result.set(definition.key, definition)
  })
  return result
}

function contentByKey(
  identity: WebLuaModIdentity,
  definitions: readonly WebLuaContentDefinition[],
  issues: WebLuaDefinitionIssue[],
): ReadonlyMap<string, Readonly<{
  contentId: string
  definition: WebLuaContentDefinition
  modId: string
}>> {
  const result = new Map<string, Readonly<{
    contentId: string
    definition: WebLuaContentDefinition
    modId: string
  }>>()
  const ids = new Map<string, string>()
  definitions.forEach((definition, index) => {
    validateKey(definition.key, `content[${index}].key`, definition.source, issues)
    const contentId = stableWebLuaContentId(identity.id, definition.key)
    const existingKey = ids.get(contentId)
    if (existingKey && existingKey !== definition.key) {
      issues.push(webLuaDefinitionIssue(
        'E_DUPLICATE',
        `content[${index}].key`,
        `content identity collision between ${existingKey} and ${definition.key}`,
        { source: definition.source },
      ))
    }
    ids.set(contentId, definition.key)
    if (result.has(definition.key)) {
      issues.push(webLuaDefinitionIssue(
        'E_DUPLICATE',
        `content[${index}].key`,
        `content key is already used by another family: ${definition.key}`,
        { source: definition.source },
      ))
    } else {
      result.set(definition.key, Object.freeze({ contentId, definition, modId: identity.id }))
    }
  })
  return result
}

function uniqueDependencies(
  dependencies: readonly WebLuaDefinitionDependency[],
  issues: WebLuaDefinitionIssue[],
): ReadonlyMap<string, WebLuaDefinitionDependency> {
  const result = new Map<string, WebLuaDefinitionDependency>()
  dependencies.forEach((dependency, index) => {
    if (result.has(dependency.id)) {
      issues.push(webLuaDefinitionIssue(
        'E_DUPLICATE',
        `dependencies[${index}].id`,
        `duplicate dependency: ${dependency.id}`,
      ))
    } else result.set(dependency.id, dependency)
  })
  return result
}

function validateKey(
  key: string,
  path: string,
  source: WebLuaDefinitionSource,
  issues: WebLuaDefinitionIssue[],
): void {
  if (validWebLuaContentKey(key)) return
  issues.push(webLuaDefinitionIssue(
    'E_CONTENT_KEY',
    path,
    'use 1..128 lowercase letters, digits, periods, underscores, or hyphens without edge separators',
    { source },
  ))
}

function validateCount(
  values: readonly unknown[],
  maximum: number,
  path: string,
  issues: WebLuaDefinitionIssue[],
): void {
  if (values.length <= maximum) return
  issues.push(webLuaDefinitionIssue(
    'E_BUDGET',
    path,
    `${path} has ${values.length} entries; maximum is ${maximum}`,
  ))
}

function validateDefinitionBudgets(
  definition: WebLuaModDefinition,
  context: CompileContext,
): void {
  const root = {
    assets: definition.assets,
    content: definition.content,
    rules: definition.rules,
    reducers: definition.reducers.map(reducer => ({
      key: reducer.key,
      on: reducer.on,
      schemaVersion: reducer.schemaVersion,
      scope: reducer.scope,
      state: reducer.state,
    })),
  }
  let nodes = 0
  const seen = new Set<object>()
  const visit = (value: unknown, path: string, depth: number): void => {
    nodes += 1
    if (nodes > context.limits.maximumNodes) return
    if (depth > context.limits.maximumDepth) {
      context.issues.push(webLuaDefinitionIssue(
        'E_BUDGET', path, `definition nesting exceeds ${context.limits.maximumDepth}`,
      ))
      return
    }
    if (typeof value === 'string') {
      if (Buffer.byteLength(value, 'utf8') > context.limits.maximumStringBytes) {
        context.issues.push(webLuaDefinitionIssue(
          'E_BUDGET', path, `string exceeds ${context.limits.maximumStringBytes} bytes`,
        ))
      }
      return
    }
    if (typeof value === 'function') {
      context.issues.push(webLuaDefinitionIssue(
        'E_GRAPH', path, 'functions are allowed only as registered advanced reducer callbacks',
      ))
      return
    }
    if (!value || typeof value !== 'object') return
    if (seen.has(value)) {
      context.issues.push(webLuaDefinitionIssue('E_CYCLE', path, 'definition value contains a cycle'))
      return
    }
    seen.add(value)
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, `${path}[${index}]`, depth + 1))
    } else {
      Object.entries(value).forEach(([key, entry]) => visit(entry, `${path}.${key}`, depth + 1))
    }
    seen.delete(value)
  }
  visit(root, 'definition', 0)
  if (nodes > context.limits.maximumNodes) {
    context.issues.push(webLuaDefinitionIssue(
      'E_BUDGET', 'definition', `definition exceeds ${context.limits.maximumNodes} nodes`,
    ))
  }
}

function validateContentCycles(
  definitions: readonly WebLuaContentDefinition[],
  context: CompileContext,
): void {
  const edges = new Map<string, Set<string>>()
  for (const definition of definitions) {
    const references = new Set<string>()
    collectLocalReferences(definition.fields, context.identity.id, references)
    edges.set(definition.key, references)
  }
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const path: string[] = []
  const visit = (key: string): void => {
    if (visited.has(key)) return
    if (visiting.has(key)) {
      const start = path.indexOf(key)
      const cycle = [...path.slice(Math.max(0, start)), key]
      context.issues.push(webLuaDefinitionIssue(
        'E_CYCLE', `content.${key}`, `content reference cycle: ${cycle.join(' -> ')}`,
      ))
      return
    }
    visiting.add(key)
    path.push(key)
    for (const target of edges.get(key) ?? []) {
      if (edges.has(target)) visit(target)
    }
    path.pop()
    visiting.delete(key)
    visited.add(key)
  }
  for (const key of edges.keys()) visit(key)
}

function collectLocalReferences(
  value: unknown,
  modId: string,
  references: Set<string>,
): void {
  if (isContentReference(value)) {
    if (value.modId === null || value.modId === modId) references.add(value.key)
    return
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectLocalReferences(entry, modId, references)
    return
  }
  if (!value || typeof value !== 'object') return
  for (const entry of Object.values(value)) collectLocalReferences(entry, modId, references)
}

function validateExclusiveMounts(
  definitions: readonly WebLuaContentDefinition[],
  context: CompileContext,
): void {
  const owners = new Map<string, WebLuaContentDefinition>()
  definitions.forEach((definition, index) => {
    const mount = definition.fields.mount
    if (!mount || Array.isArray(mount) || typeof mount !== 'object') return
    if (mount.exclusive === false) return
    const scene = typeof mount.scene === 'string' ? mount.scene : null
    const anchor = typeof mount.anchor === 'string' ? mount.anchor : null
    if (!scene || !anchor) return
    const claim = `${scene}:${anchor}`
    const previous = owners.get(claim)
    if (previous) {
      context.issues.push(webLuaDefinitionIssue(
        'E_MOUNT_CONFLICT',
        `content[${index}].fields.mount`,
        `${definition.key} and ${previous.key} both claim exclusive mount ${claim}`,
        { source: definition.source },
      ))
    } else owners.set(claim, definition)
  })
}

function resolveRecord(
  value: Readonly<Record<string, WebLuaDefinitionValue>>,
  path: string,
  source: WebLuaDefinitionSource,
  context: CompileContext,
): Readonly<Record<string, WebLuaDefinitionValue>> {
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
    key,
    resolveValue(entry, `${path}.${key}`, source, context),
  ]))
}

function resolveValue(
  value: WebLuaDefinitionValue,
  path: string,
  source: WebLuaDefinitionSource,
  context: CompileContext,
): WebLuaDefinitionValue {
  if (isContentReference(value)) {
    return resolveContentReference(value, path, source, context) as unknown as WebLuaDefinitionValue
  }
  if (isAssetReference(value)) {
    if (!context.assets.has(value.key)) {
      context.issues.push(webLuaDefinitionIssue(
        'E_REFERENCE', path, `unknown asset: ${value.key}`, { source },
      ))
    }
    return value
  }
  if (Array.isArray(value)) {
    return Object.freeze(value.map((entry, index) => resolveValue(
      entry,
      `${path}[${index}]`,
      source,
      context,
    )))
  }
  if (value && typeof value === 'object') {
    return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [
      key,
      resolveValue(entry as WebLuaDefinitionValue, `${path}.${key}`, source, context),
    ])))
  }
  return value
}

function resolveContentReference(
  reference: WebLuaContentReference,
  path: string,
  source: WebLuaDefinitionSource,
  context: CompileContext,
): ResolvedWebLuaContentReference {
  const modId = reference.modId ?? context.identity.id
  const resolved = (() => {
    if (modId === context.identity.id) {
      const candidate = context.content.get(reference.key)
      return candidate && candidate.definition.contentKind === reference.targetKind
        ? { contentId: candidate.contentId, key: reference.key, modId }
        : null
    }
    if (modId === 'stock') {
      const candidate = context.stockContent.get(`${reference.targetKind}:${reference.key}`)
      return candidate ? { contentId: candidate.contentId, key: candidate.key, modId } : null
    }
    const dependency = context.dependencies.get(modId)
    const candidate = dependency?.content.find(entry => (
      entry.key === reference.key && entry.contentKind === reference.targetKind
    ))
    return candidate ? { contentId: candidate.contentId, key: candidate.key, modId } : null
  })()
  if (!resolved) {
    context.issues.push(webLuaDefinitionIssue(
      'E_REFERENCE',
      path,
      `unknown ${reference.targetKind} reference ${modId}:${reference.key}`,
      { source },
    ))
    return Object.freeze({
      contentId: '0',
      key: reference.key,
      kind: 'resolved-content-reference',
      modId,
      targetKind: reference.targetKind,
    })
  }
  return Object.freeze({
    contentId: resolved.contentId,
    key: resolved.key,
    kind: 'resolved-content-reference',
    modId: resolved.modId,
    targetKind: reference.targetKind,
  })
}

function inferCapabilities(definition: WebLuaModDefinition): string[] {
  const values = new Set<string>()
  for (const asset of definition.assets) values.add(`assets.${asset.assetKind}`)
  for (const content of definition.content) values.add(`content.${content.contentKind}`)
  for (const rule of definition.rules) values.add(`rules.${rule.operation}`)
  if (definition.reducers.length > 0) values.add('reducers.authority')
  return [...values].sort()
}

function canonicalGraph(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalGraph)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => key !== 'source' && key !== 'callback')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => [key, canonicalGraph(entry)]))
}

function isContentReference(value: unknown): value is WebLuaContentReference {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) &&
    (value as { kind?: unknown }).kind === 'content-reference')
}

function isAssetReference(value: unknown): value is WebLuaAssetReference {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) &&
    (value as { kind?: unknown }).kind === 'asset-reference')
}
