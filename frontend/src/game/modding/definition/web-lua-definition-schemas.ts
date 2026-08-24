import type {
  WebLuaAssetDefinition,
  WebLuaContentDefinition,
  WebLuaDefinitionValue,
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
  'art',
  'description',
  'name',
  'presentation',
  'tags',
] as const

const schema = (
  allowed: readonly string[],
  required: readonly string[] = [],
): ContentSchema => ({
  allowed: new Set([...common, ...allowed]),
  required: new Set(required),
})

const CONTENT_SCHEMAS: Readonly<Record<WebLuaContentDefinition['contentKind'], ContentSchema>> = {
  affix: schema(['applies_to', 'equipment', 'modifiers', 'outcome', 'persistence'], ['name', 'modifiers']),
  'affix-pool': schema([
    'applies_to',
    'entries',
    'exclude_equipment_types',
    'include',
    'rng_domain',
    'rolls',
  ], ['entries']),
  boneyard: schema([
    'ambience',
    'anchors',
    'environment',
    'roster',
    'source',
    'triggers',
    'waves',
  ], ['name', 'source']),
  enemy: schema([
    'attacks',
    'base',
    'behavior',
    'brain',
    'loot',
    'stats',
  ], ['name', 'base']),
  item: schema(['equipment', 'stack', 'use'], ['name']),
  potion: schema([
    'duration',
    'loot',
    'on_use',
    'stacking',
    'status',
  ], ['duration', 'name', 'on_use']),
  powerup: schema([
    'duration',
    'effect',
    'pickup',
    'scope',
    'stacking',
  ], ['effect', 'name']),
  room: schema(['ambience', 'anchors', 'encounter', 'geometry', 'props'], ['geometry']),
  scene: schema([
    'entry',
    'form',
    'instance',
    'return_policy',
    'return_to',
    'rooms',
    'world',
  ], ['instance', 'rooms']),
  'scene-extension': schema(['extend', 'features', 'scene'], ['features', 'scene']),
  shop: schema([
    'currency',
    'mount',
    'npc',
    'restock',
    'services',
    'stock',
    'stock_scope',
  ], ['name', 'stock']),
  skill: schema([
    'grants',
    'max_rank',
    'maximum_rank',
    'offer',
    'parent',
    'prerequisites',
    'ranks',
  ], ['name', 'ranks']),
  spell: schema([
    'behavior',
    'cast',
    'casters',
    'cooldown',
    'mana',
    'program',
    'school',
    'slot',
    'subskills',
    'targeting',
  ], ['behavior', 'name', 'slot']),
  status: schema(['duration', 'modifiers', 'scope', 'stacking']),
  ui: schema(['accessible_name', 'actions', 'bindings', 'mount', 'view', 'visible'], ['mount', 'view']),
}

const ASSET_FIELDS: Readonly<Record<WebLuaAssetDefinition['assetKind'], ReadonlySet<string>>> = {
  boneyard: new Set(['path', 'source']),
  music: new Set(['bus', 'file', 'loop', 'path', 'volume']),
  scene: new Set(['path', 'source']),
  sheet: new Set(['animations', 'frame', 'image', 'path']),
  sound: new Set(['bus', 'file', 'path', 'volume']),
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
  const file = definition.fields.path ?? definition.fields.file ?? definition.fields.image ?? definition.fields.source
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
