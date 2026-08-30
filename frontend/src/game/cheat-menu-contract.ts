import type { LuaConsoleValue } from './protocol/game-protocol.ts'

export const CHEAT_MENU_TABS = Object.freeze(['cheats', 'console'] as const)
export type CheatMenuTab = typeof CHEAT_MENU_TABS[number]

export const CHEAT_MENU_CONSOLE_HISTORY_LIMIT = 50
export const CHEAT_MENU_EXPERIENCE_MAX = 10_000_000
export const CHEAT_MENU_GOLD_MAX = 10_000_000
export const CHEAT_MENU_RUN_SEED_MAX = 0x3fff_ffff
export const CHEAT_MENU_SPAWN_COUNT_MAX = 20

export const CHEAT_MENU_BOT_DISCIPLINES = Object.freeze(['arcane', 'body', 'mind'] as const)
export const CHEAT_MENU_BOT_ELEMENTS = Object.freeze([
  'air',
  'earth',
  'ether',
  'fire',
  'water',
] as const)

export const CHEAT_MENU_CATALOG_QUERY = `local developer = type(sd.dev) == 'table'
return sd.enemies.list(),
  developer and sd.dev.list_items() or {},
  developer and sd.dev.list_skills() or {},
  developer and sd.dev.list_welds() or {}`

export interface CheatMenuAuthorityState {
  readonly cheatsEnabled: boolean
  readonly developerAccess: boolean
  readonly isHost: boolean
}

export interface CheatMenuEnemyDescriptor {
  readonly base: string
  readonly key: string
  readonly nativeTypeId: number
}

export interface CheatMenuItemDescriptor {
  readonly key: string
  readonly kind: string
  readonly name: string
  readonly nativeTypeId: number
}

export interface CheatMenuSkillDescriptor {
  readonly family: string
  readonly id: number
  readonly maximumRank: number
  readonly name: string
  readonly weldOnly: boolean
}

export interface CheatMenuWeldDescriptor {
  readonly componentSkillIds: readonly number[]
  readonly id: number
  readonly name: string
}

export interface CheatMenuCatalogs {
  readonly enemies: readonly CheatMenuEnemyDescriptor[]
  readonly items: readonly CheatMenuItemDescriptor[]
  readonly skills: readonly CheatMenuSkillDescriptor[]
  readonly welds: readonly CheatMenuWeldDescriptor[]
}

export type CheatMenuAction =
  | Readonly<{ kind: 'restore-health' | 'restore-mana'; playerId: string }>
  | Readonly<{ gold: number; kind: 'set-gold'; playerId: string }>
  | Readonly<{ amount: number; kind: 'grant-experience'; playerId: string }>
  | Readonly<{ kind: 'set-run-seed'; seed: number }>
  | Readonly<{
      count: number
      enemyKey: string
      kind: 'spawn-enemy'
      playerId: string
    }>
  | Readonly<{
      itemKey: string
      kind: 'grant-item'
      playerId: string
      quantity: number
    }>
  | Readonly<{
      kind: 'grant-skill'
      playerId: string
      ranks: number
      skillId: number
    }>
  | Readonly<{ buildId: number; kind: 'grant-weld'; playerId: string }>
  | Readonly<{
      discipline: typeof CHEAT_MENU_BOT_DISCIPLINES[number]
      element: typeof CHEAT_MENU_BOT_ELEMENTS[number]
      kind: 'summon-bot'
    }>

export function gameCheatMenuAvailable(state: CheatMenuAuthorityState): boolean {
  return state.developerAccess || (state.cheatsEnabled && state.isHost)
}

export function compileCheatMenuAction(action: CheatMenuAction): string {
  switch (action.kind) {
    case 'restore-health':
      return `return sd.player.restore_health(10000000, ${luaStringLiteral(action.playerId)})`
    case 'restore-mana':
      return `return sd.player.set_mana(10000000, ${luaStringLiteral(action.playerId)})`
    case 'set-gold':
      return `return sd.player.set_gold(${integerWithin(
        action.gold,
        'Gold',
        0,
        CHEAT_MENU_GOLD_MAX,
      )}, ${luaStringLiteral(action.playerId)})`
    case 'grant-experience':
      return `return sd.player.grant_experience(${integerWithin(
        action.amount,
        'experience',
        0,
        CHEAT_MENU_EXPERIENCE_MAX,
      )}, ${luaStringLiteral(action.playerId)})`
    case 'set-run-seed':
      return `return sd.rng.set_seed(${integerWithin(
        action.seed,
        'run seed',
        1,
        CHEAT_MENU_RUN_SEED_MAX,
      )})`
    case 'spawn-enemy': {
      const count = integerWithin(
        action.count,
        'enemy count',
        1,
        CHEAT_MENU_SPAWN_COUNT_MAX,
      )
      return `local player = sd.player.get_state(${luaStringLiteral(action.playerId)})
for index = 1, ${count} do
  sd.enemies.spawn(${luaStringLiteral(action.enemyKey)}, {
    x = player.x + 80 + ((index - 1) % 5) * 32,
    y = player.y + math.floor((index - 1) / 5) * 32
  })
end
return ${count}`
    }
    case 'grant-item':
      return `return sd.dev.grant_item(${luaStringLiteral(action.itemKey)}, ${integerWithin(
        action.quantity,
        'item quantity',
        1,
        100,
      )}, ${luaStringLiteral(action.playerId)})`
    case 'grant-skill':
      return `return sd.dev.grant_skill(${integerWithin(
        action.skillId,
        'skill id',
        8,
        79,
      )}, ${integerWithin(action.ranks, 'skill ranks', 1, 100)}, ${luaStringLiteral(
        action.playerId,
      )})`
    case 'grant-weld':
      return `return sd.dev.grant_weld(${integerWithin(
        action.buildId,
        'Weld build id',
        1000,
        1009,
      )}, ${luaStringLiteral(action.playerId)})`
    case 'summon-bot':
      if (!CHEAT_MENU_BOT_DISCIPLINES.includes(action.discipline)) {
        throw new RangeError(`unsupported bot discipline: ${action.discipline}`)
      }
      if (!CHEAT_MENU_BOT_ELEMENTS.includes(action.element)) {
        throw new RangeError(`unsupported bot element: ${action.element}`)
      }
      return `return sd.bots.summon({discipline = ${luaStringLiteral(
        action.discipline,
      )}, element = ${luaStringLiteral(action.element)}})`
  }
}

export function decodeCheatMenuCatalogs(
  values: readonly LuaConsoleValue[],
): CheatMenuCatalogs {
  if (values.length !== 4) throw new TypeError('cheat catalog query must return four values')
  return Object.freeze({
    enemies: decodeCatalog(values[0], 'enemy', decodeEnemy),
    items: decodeCatalog(values[1], 'item', decodeItem, true),
    skills: decodeCatalog(values[2], 'skill', decodeSkill, true),
    welds: decodeCatalog(values[3], 'Weld', decodeWeld, true),
  })
}

export function appendCheatConsoleHistory(
  history: readonly string[],
  code: string,
): readonly string[] {
  const command = code.trim()
  if (!command || history.at(-1) === command) return history
  return Object.freeze([
    ...history,
    command,
  ].slice(-CHEAT_MENU_CONSOLE_HISTORY_LIMIT))
}

export function formatCheatConsoleValues(values: readonly LuaConsoleValue[]): string {
  return values.map((value) => JSON.stringify(value, null, 2)).join('\n')
}

function decodeCatalog<T>(
  value: LuaConsoleValue | undefined,
  label: string,
  decode: (value: LuaConsoleValue, index: number) => T,
  acceptsEmptyObject = false,
): readonly T[] {
  if (!Array.isArray(value)) {
    if (
      acceptsEmptyObject
      && value !== null
      && typeof value === 'object'
      && Object.keys(value).length === 0
    ) return Object.freeze([])
    throw new TypeError(`${label} catalog must be an array`)
  }
  return Object.freeze(value.map(decode))
}

function decodeEnemy(value: LuaConsoleValue, index: number): CheatMenuEnemyDescriptor {
  const source = record(value, `enemy catalog row ${index}`)
  return Object.freeze({
    base: stringField(source, 'base'),
    key: stringField(source, 'key'),
    nativeTypeId: integerField(source, 'native_type_id'),
  })
}

function decodeItem(value: LuaConsoleValue, index: number): CheatMenuItemDescriptor {
  const source = record(value, `item catalog row ${index}`)
  return Object.freeze({
    key: stringField(source, 'key'),
    kind: stringField(source, 'kind'),
    name: stringField(source, 'name'),
    nativeTypeId: integerField(source, 'native_type_id'),
  })
}

function decodeSkill(value: LuaConsoleValue, index: number): CheatMenuSkillDescriptor {
  const source = record(value, `skill catalog row ${index}`)
  return Object.freeze({
    family: stringField(source, 'family'),
    id: integerField(source, 'id'),
    maximumRank: integerField(source, 'maximum_rank'),
    name: stringField(source, 'name'),
    weldOnly: booleanField(source, 'weld_only'),
  })
}

function decodeWeld(value: LuaConsoleValue, index: number): CheatMenuWeldDescriptor {
  const source = record(value, `Weld catalog row ${index}`)
  const components = source.component_skill_ids
  if (!Array.isArray(components) || !components.every(Number.isInteger)) {
    throw new TypeError(`Weld catalog row ${index}.component_skill_ids must be integers`)
  }
  return Object.freeze({
    componentSkillIds: Object.freeze(components.map(Number)),
    id: integerField(source, 'id'),
    name: stringField(source, 'name'),
  })
}

function record(value: LuaConsoleValue, label: string): Record<string, LuaConsoleValue> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`)
  }
  return value as Record<string, LuaConsoleValue>
}

function stringField(source: Record<string, LuaConsoleValue>, key: string): string {
  const value = source[key]
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${key} must be a nonempty string`)
  }
  return value
}

function integerField(source: Record<string, LuaConsoleValue>, key: string): number {
  const value = source[key]
  if (!Number.isSafeInteger(value)) throw new TypeError(`${key} must be an integer`)
  return Number(value)
}

function booleanField(source: Record<string, LuaConsoleValue>, key: string): boolean {
  const value = source[key]
  if (typeof value !== 'boolean') throw new TypeError(`${key} must be a Boolean`)
  return value
}

function integerWithin(value: number, label: string, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${label} must be within ${minimum}..${maximum}`)
  }
  return value
}

function luaStringLiteral(value: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 128) {
    throw new TypeError('Lua action identity must be a nonempty string of at most 128 characters')
  }
  return `'${value
    .replaceAll('\\', '\\\\')
    .replaceAll("'", "\\'")
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r')
    .replaceAll('\t', '\\t')}'`
}
