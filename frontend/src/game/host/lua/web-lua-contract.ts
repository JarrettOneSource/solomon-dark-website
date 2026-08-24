import { BONEYARD_WAVE_ENEMY_TYPES } from '../../core-kernels/boneyard-wave-director.ts'
import type { BoneyardWaveEnemyToken } from '../../core-kernels/boneyard-wave-schema.ts'
import type {
  WizardDiscipline,
  WizardElement,
} from '../../core-kernels/player-character.ts'
import type { LuaConsoleValue } from '../../protocol/game-protocol.ts'

export const WEB_LUA_API_VERSION = '0.2.0'
export const WEB_LUA_DEV_CONSOLE_MOD = Object.freeze({
  id: 'web.dev-console',
  name: 'Browser Dev Console',
  version: WEB_LUA_API_VERSION,
})
export const WEB_LUA_VM_MEMORY_BYTES = 16 * 1024 * 1024
export const WEB_LUA_EXECUTION_TIMEOUT_MS = 4
export const WEB_LUA_CALLBACK_TIMEOUT_MS = 2
export const WEB_LUA_TICK_BUDGET_MS = 4
export const WEB_LUA_MAX_PENDING_EXECUTIONS = 8
export const WEB_LUA_MAX_CALLBACKS = 128
export const WEB_LUA_MAX_CALLBACK_INVOCATIONS_PER_TICK = 64
export const WEB_LUA_MAX_COMMANDS_PER_TICK = 256
export const WEB_LUA_MAX_TIMERS = 256
export const WEB_LUA_MAX_STATE_BYTES = 64 * 1024
export const WEB_LUA_MAX_STATE_KEYS = 256
export const WEB_LUA_MAX_STATE_KEY_LENGTH = 128

export const WEB_LUA_EVENT_NAMES = [
  'enemy.death',
  'enemy.spawned',
  'gold.changed',
  'item.consumed',
  'level.up',
  'run.ended',
  'run.started',
  'runtime.tick',
  'wave.completed',
  'wave.started',
] as const

export type WebLuaEventName = typeof WEB_LUA_EVENT_NAMES[number]

export const WEB_LUA_FILTER_NAMES = [
  'damage.taken',
  'mana.changing',
] as const

export type WebLuaFilterName = typeof WEB_LUA_FILTER_NAMES[number]

export const WEB_LUA_CAPABILITIES = [
  'enemies.read',
  'enemies.spawn',
  'events.filters.damage',
  'events.filters.resources',
  'events.read',
  'gameplay.read',
  'hub.read',
  'items.consumables.register',
  'loot.register',
  'player.read',
  'player.resources.write',
  'player.resources.owner',
  'rng.run.seed',
  'runtime.read',
  'scene.read',
  'state.session',
  'sprites.local.read',
  'sprites.local.register',
  'timer.local.scheduler',
  'timer.session',
  'waves.read',
  'world.read',
] as const

export type WebLuaCapability = typeof WEB_LUA_CAPABILITIES[number]

export interface WebLuaModIdentity {
  readonly id: string
  readonly name: string
  readonly version: string
}

export interface WebLuaModSource {
  readonly entryScript: string
  readonly files: Readonly<Record<string, Uint8Array>>
  readonly identity: WebLuaModIdentity
  readonly requiredCapabilities: readonly WebLuaCapability[]
}

export const WEB_LUA_STOCK_ENEMIES = [
  { base: 'coffin', key: 'coffin', native_type_id: BONEYARD_WAVE_ENEMY_TYPES.COFFIN, token: 'COFFIN' },
  { base: 'demon', key: 'demon', native_type_id: BONEYARD_WAVE_ENEMY_TYPES.DEMON, token: 'DEMON' },
  { base: 'imp', key: 'imp', native_type_id: BONEYARD_WAVE_ENEMY_TYPES.IMP, token: 'IMP' },
  { base: 'skeleton', key: 'skeleton', native_type_id: BONEYARD_WAVE_ENEMY_TYPES.SKELETON, token: 'SKELETON' },
  { base: 'skeleton_archer', key: 'skeleton_archer', native_type_id: BONEYARD_WAVE_ENEMY_TYPES.SKELETONARCHER, token: 'SKELETONARCHER' },
  { base: 'skeleton_mage', key: 'skeleton_mage', native_type_id: BONEYARD_WAVE_ENEMY_TYPES.SKELETONMAGE, token: 'SKELETONMAGE' },
  { base: 'wraith', key: 'wraith', native_type_id: BONEYARD_WAVE_ENEMY_TYPES.WRAITH, token: 'WRAITH' },
  { base: 'zombie', key: 'zombie', native_type_id: BONEYARD_WAVE_ENEMY_TYPES.ZOMBIE, token: 'ZOMBIE' },
] as const satisfies readonly Readonly<{
  base: string
  key: string
  native_type_id: number
  token: BoneyardWaveEnemyToken
}>[]

export interface WebLuaPlayerState {
  readonly currentHealth: number
  readonly currentMana: number
  readonly deathTick: number
  readonly discipline: string
  readonly displayName: string
  readonly element: string
  readonly gold: number
  readonly id: string
  readonly level: number
  readonly lifeState: string
  readonly maximumHealth: number
  readonly maximumMana: number
  readonly pendingLevelUp: boolean
  readonly position: Readonly<{ x: number; y: number }>
  readonly experience: number
}

export interface WebLuaEnemyState {
  readonly health: number
  readonly id: number
  readonly lifeState: string
  readonly maximumHealth: number
  readonly position: Readonly<{ x: number; y: number }>
  readonly token: string
}

export interface WebLuaFrameState {
  readonly authorityPlayerId: string | null
  readonly boneyardSeed: string | null
  readonly enemies: readonly WebLuaEnemyState[]
  readonly multiplayer: boolean
  readonly phase: string
  readonly playerCount: number
  readonly players: readonly WebLuaPlayerState[]
  readonly runId: string | null
  readonly scene: string
  readonly tick: number
  readonly waves: Readonly<Record<string, LuaConsoleValue>> | null
  readonly world: 'boneyard' | 'hub'
}

export type WebLuaCommand =
  | Readonly<{ amount: number; playerId: string; type: 'grant-experience' }>
  | Readonly<{ amount: number; playerId: string; type: 'restore-health' }>
  | Readonly<{ amount: number; playerId: string; type: 'restore-mana' }>
  | Readonly<{ playerId: string; type: 'set-gold'; value: number }>
  | Readonly<{ playerId: string; type: 'set-mana'; value: number }>
  | Readonly<{ seed: number; type: 'set-next-run-seed' }>
  | Readonly<{
      requestId: number
      token: BoneyardWaveEnemyToken
      type: 'spawn-enemy'
      x: number
      y: number
    }>

export interface WebLuaExecutionResult {
  readonly error: string | null
  readonly ok: boolean
  readonly output: readonly string[]
  readonly values: readonly LuaConsoleValue[]
}

export interface WebLuaExecutionRequest {
  readonly code: string
  readonly playerId: string
  readonly respond: (result: WebLuaExecutionResult) => void
}

export interface WebLuaRuntimeBindings {
  getAuthorityPlayerId(): string | null
  getFrame(): WebLuaFrameState
}

export interface WebLuaDeveloperBindings {
  summonBot(config: WebLuaBotConfig): Readonly<{
    display_name: string
    player_id: string
  }>
}

export interface WebLuaBotConfig {
  readonly discipline: WizardDiscipline
  readonly element: WizardElement
}

export interface WebLuaRuntimeLog {
  (level: 'debug' | 'info' | 'warning', event: string, detail: string): void
}
