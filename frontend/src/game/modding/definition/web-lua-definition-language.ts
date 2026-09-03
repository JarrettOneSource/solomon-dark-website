export const WEB_LUA_RULE_NAMES = Object.freeze([
  'on',
  'all',
  'first',
  'when',
  'after',
  'every',
] as const)

export const WEB_LUA_EFFECT_NAMES = Object.freeze([
  'damage',
  'resource',
  'status',
  'spawn',
  'grant',
  'state',
  'present',
] as const)

export const WEB_LUA_PREFAB_NAMES = Object.freeze([
  'projectile',
  'area',
  'channel',
  'minimap',
  'portal',
] as const)

export const WEB_LUA_SCHEMA_NAMES = Object.freeze([
  'boolean',
  'integer',
  'number',
  'string',
  'enum',
  'array',
  'object',
] as const)

export const WEB_LUA_ART_ALIAS_NAMES = Object.freeze([
  'sprite',
  'sheet',
  'wearable',
  'sound',
  'music',
] as const)

export const WEB_LUA_PREDICATE_FIELDS = Object.freeze([
  'above',
  'all',
  'any',
  'at_least',
  'at_most',
  'below',
  'context',
  'equals',
  'event',
  'none',
  'not_equals',
] as const)

export const WEB_LUA_PREDICATE_COMPARISONS = Object.freeze([
  'above',
  'at_least',
  'at_most',
  'below',
  'equals',
  'not_equals',
] as const)

export const WEB_LUA_NUMERIC_PREDICATE_COMPARISONS = Object.freeze([
  'above',
  'at_least',
  'at_most',
  'below',
] as const)

export const WEB_LUA_PREDICATE_GROUPS = Object.freeze(['all', 'any', 'none'] as const)
export const WEB_LUA_MAXIMUM_PREDICATE_DEPTH = 8
