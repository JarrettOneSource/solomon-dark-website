export const WEB_LUA_DEFINITION_API_VERSION = '1.0.0'

export const WEB_LUA_CONTENT_KINDS = [
  'affix',
  'affix-pool',
  'boneyard',
  'boast',
  'enemy',
  'item',
  'potion',
  'powerup',
  'room',
  'scene',
  'scene-extension',
  'shop',
  'skill',
  'spell',
  'status',
  'ui',
] as const

export type WebLuaContentKind = typeof WEB_LUA_CONTENT_KINDS[number]

export const WEB_LUA_ASSET_KINDS = [
  'boneyard',
  'music',
  'scene',
  'sheet',
  'sound',
  'sprite',
] as const

export type WebLuaAssetKind = typeof WEB_LUA_ASSET_KINDS[number]

export const WEB_LUA_SCOPE_KINDS = [
  'entity',
  'participant-profile',
  'participant-run',
  'party-run',
  'scene',
  'session',
] as const

export type WebLuaScopeKind = typeof WEB_LUA_SCOPE_KINDS[number]

export const WEB_LUA_RULE_EVENT_NAMES = [
  'action.content.cast',
  'action.content.pickup',
  'action.content.use',
  'action.portal.enter',
  'action.scene.room',
  'action.shop.purchase',
  'action.ui.action',
  'enemy.death',
  'enemy.spawned',
  'gold.changed',
  'level.up',
  'mod.enemy.damaged',
  'mod.enemy.died',
  'run.ended',
  'run.started',
  'session.started',
  'wave.completed',
  'wave.started',
] as const

export interface WebLuaModIdentity {
  readonly id: string
  readonly name: string
  readonly version: string
}

export interface WebLuaContentReference {
  readonly key: string
  readonly kind: 'content-reference'
  readonly modId: string | null
  readonly targetKind: WebLuaContentKind
}

export interface WebLuaAssetReference {
  readonly key: string
  readonly kind: 'asset-reference'
}

export interface WebLuaDefinitionSource {
  readonly column: number | null
  readonly file: string
  readonly line: number | null
}

export interface WebLuaAssetDefinition {
  readonly assetKind: WebLuaAssetKind
  readonly fields: Readonly<Record<string, WebLuaDefinitionValue>>
  readonly key: string
  readonly kind: 'asset-definition'
  readonly source: WebLuaDefinitionSource
}

export interface WebLuaContentDefinition {
  readonly contentKind: WebLuaContentKind
  readonly fields: Readonly<Record<string, WebLuaDefinitionValue>>
  readonly key: string
  readonly kind: 'content-definition'
  readonly source: WebLuaDefinitionSource
}

export interface WebLuaRuleDefinition {
  readonly fields: Readonly<Record<string, WebLuaDefinitionValue>>
  readonly kind: 'rule-definition'
  readonly operation: string
  readonly source: WebLuaDefinitionSource
}

export interface WebLuaSchemaDefinition {
  readonly fields: Readonly<Record<string, WebLuaDefinitionValue>>
  readonly kind: 'schema-definition'
  readonly schemaKind: string
  readonly source: WebLuaDefinitionSource
}

export interface WebLuaIntentDefinition {
  readonly fields: Readonly<Record<string, WebLuaDefinitionValue>>
  readonly intentKind: string
  readonly kind: 'intent-definition'
  readonly source: WebLuaDefinitionSource
}

export interface WebLuaReducerToken {
  readonly key: string
  readonly kind: 'reducer-token'
}

export type WebLuaDefinitionToken =
  | WebLuaAssetDefinition
  | WebLuaAssetReference
  | WebLuaContentDefinition
  | WebLuaContentReference
  | WebLuaIntentDefinition
  | WebLuaReducerToken
  | WebLuaRuleDefinition
  | WebLuaSchemaDefinition

export interface WebLuaDefinitionArray extends ReadonlyArray<WebLuaDefinitionValue> {}

export interface WebLuaDefinitionObject {
  readonly [key: string]: WebLuaDefinitionValue
}

export type WebLuaDefinitionValue =
  | boolean
  | null
  | number
  | string
  | WebLuaDefinitionToken
  | WebLuaDefinitionArray
  | WebLuaDefinitionObject

export interface WebLuaReducerRegistration {
  readonly callback: (...args: unknown[]) => unknown
  readonly key: string
  readonly migrations: Readonly<Record<number, (...args: unknown[]) => unknown>>
  readonly on: readonly string[]
  readonly schemaVersion: number
  readonly scope: WebLuaScopeKind
  readonly source: WebLuaDefinitionSource
  readonly state: WebLuaSchemaDefinition
}

export interface WebLuaModDefinition {
  readonly api: typeof WEB_LUA_DEFINITION_API_VERSION
  readonly assets: readonly WebLuaAssetDefinition[]
  readonly content: readonly WebLuaContentDefinition[]
  readonly reducers: readonly WebLuaReducerRegistration[]
  readonly rules: readonly WebLuaRuleDefinition[]
}

export interface ResolvedWebLuaContentReference {
  readonly contentId: string
  readonly key: string
  readonly kind: 'resolved-content-reference'
  readonly modId: string
  readonly targetKind: WebLuaContentKind
}

export interface CompiledWebLuaAsset {
  readonly assetKind: WebLuaAssetKind
  readonly fields: Readonly<Record<string, WebLuaDefinitionValue>>
  readonly key: string
}

export interface CompiledWebLuaContent {
  readonly contentId: string
  readonly contentKind: WebLuaContentKind
  readonly fields: Readonly<Record<string, WebLuaDefinitionValue>>
  readonly key: string
}

export interface CompiledWebLuaReducer {
  readonly key: string
  readonly on: readonly string[]
  readonly schemaVersion: number
  readonly scope: WebLuaScopeKind
  readonly state: WebLuaSchemaDefinition
}

export interface CompiledWebLuaMod {
  readonly apiVersion: typeof WEB_LUA_DEFINITION_API_VERSION
  readonly assets: readonly CompiledWebLuaAsset[]
  readonly canonicalJson: string
  readonly capabilities: readonly string[]
  readonly content: readonly CompiledWebLuaContent[]
  readonly graphSha256: string
  readonly identity: WebLuaModIdentity
  readonly reducers: readonly CompiledWebLuaReducer[]
  readonly rules: readonly WebLuaRuleDefinition[]
}

export interface WebLuaDefinitionLimits {
  readonly maximumAssets: number
  readonly maximumContent: number
  readonly maximumDepth: number
  readonly maximumNodes: number
  readonly maximumReducers: number
  readonly maximumRules: number
  readonly maximumStringBytes: number
}

export const DEFAULT_WEB_LUA_DEFINITION_LIMITS: WebLuaDefinitionLimits = Object.freeze({
  maximumAssets: 256,
  maximumContent: 4_096,
  maximumDepth: 32,
  maximumNodes: 65_536,
  maximumReducers: 128,
  maximumRules: 4_096,
  maximumStringBytes: 16 * 1024,
})
