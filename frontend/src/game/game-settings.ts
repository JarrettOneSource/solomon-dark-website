import type { GameOnlinePreferences } from './protocol/game-chat.ts'

export const CAMERA_FOV_MIN_PERCENT = 75
export const CAMERA_FOV_MAX_PERCENT = 125
export const UI_SCALE_MIN_PERCENT = 75
export const UI_SCALE_MAX_PERCENT = 150
export const LIGHT_QUALITY_MIN_PERCENT = 24
export const LIGHT_QUALITY_MAX_PERCENT = 100
export const NATIVE_CAPABLE_LIGHT_QUALITY = 0.25
export const NATIVE_BROWSER_ENHANCED_EFFECTS = true

export const GAME_BINDING_ACTIONS = Object.freeze([
  'moveUp',
  'moveDown',
  'moveLeft',
  'moveRight',
  'openMenu',
  'openInventory',
  'openSkills',
  'openChat',
  'belt1',
  'belt2',
  'belt3',
  'belt4',
  'belt5',
  'belt6',
  'belt7',
  'belt8',
] as const)

export type GameBindingAction = typeof GAME_BINDING_ACTIONS[number]
export type GameControlBindings = Readonly<Record<GameBindingAction, string>>

export interface GameSettings {
  readonly cameraFovPercent: number
  readonly castSecondariesAtMouse: boolean
  readonly complexLighting: boolean
  readonly complexShadows: boolean
  readonly controls: GameControlBindings
  readonly enableActivityMessages: boolean
  readonly enableCheats: boolean
  readonly enableGlobalChat: boolean
  readonly enableOnlineFeatures: boolean
  readonly enableSharedHub: boolean
  readonly lightQualityPercent: number
  readonly musicVolumePercent: number
  readonly multipleShadows: boolean
  readonly soundVolumePercent: number
  readonly submitRunsToServer: boolean
  readonly uiScalePercent: number
  readonly zoomEffects: boolean
}

export interface GameSettingsStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export const GAME_SETTINGS_STORAGE_KEY = 'solomon-dark-game-settings-v1'

export const DEFAULT_GAME_CONTROL_BINDINGS: GameControlBindings = Object.freeze({
  belt1: 'Mouse2',
  belt2: 'Digit1',
  belt3: 'Digit2',
  belt4: 'Digit3',
  belt5: 'Digit4',
  belt6: 'Digit5',
  belt7: 'Digit6',
  belt8: 'Digit7',
  moveDown: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  moveUp: 'KeyW',
  openInventory: 'KeyI',
  openMenu: 'Escape',
  openSkills: 'KeyK',
  openChat: 'KeyT',
})

export const DEFAULT_GAME_SETTINGS: GameSettings = Object.freeze({
  cameraFovPercent: 100,
  castSecondariesAtMouse: true,
  complexLighting: true,
  complexShadows: true,
  controls: DEFAULT_GAME_CONTROL_BINDINGS,
  enableActivityMessages: true,
  enableCheats: false,
  enableGlobalChat: true,
  enableOnlineFeatures: true,
  enableSharedHub: true,
  lightQualityPercent: 100,
  musicVolumePercent: 100,
  multipleShadows: true,
  soundVolumePercent: 100,
  submitRunsToServer: true,
  uiScalePercent: 100,
  zoomEffects: true,
})

const GAME_SETTINGS_KEYS = Object.freeze([
  'cameraFovPercent',
  'castSecondariesAtMouse',
  'complexLighting',
  'complexShadows',
  'controls',
  'enableActivityMessages',
  'enableCheats',
  'enableGlobalChat',
  'enableOnlineFeatures',
  'enableSharedHub',
  'lightQualityPercent',
  'musicVolumePercent',
  'multipleShadows',
  'soundVolumePercent',
  'submitRunsToServer',
  'uiScalePercent',
  'zoomEffects',
] as const)

const DEPLOYED_GAME_SETTINGS_KEYS = Object.freeze(GAME_SETTINGS_KEYS.filter((key) => ![
  'enableActivityMessages',
  'enableGlobalChat',
  'enableOnlineFeatures',
  'enableSharedHub',
  'submitRunsToServer',
].includes(key)))

const listeners = new Set<(settings: GameSettings) => void>()

export function readGameSettings(
  storage: GameSettingsStorage = window.localStorage,
): GameSettings {
  return parseGameSettings(storage.getItem(GAME_SETTINGS_STORAGE_KEY))
}

export function setGameSettings(
  settings: GameSettings,
  storage: GameSettingsStorage = window.localStorage,
): GameSettings {
  const browserStorage = typeof window === 'undefined' ? null : window.localStorage
  const normalized = normalizedGameSettings(settings)
  storage.setItem(GAME_SETTINGS_STORAGE_KEY, JSON.stringify(normalized))
  if (storage === browserStorage) {
    for (const listener of listeners) listener(normalized)
  }
  return normalized
}

export function subscribeGameSettings(
  listener: (settings: GameSettings) => void,
): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function gameCheatsEnabled(): boolean {
  return readGameSettings().enableCheats
}

export function gameOnlinePreferences(
  settings: Pick<
    GameSettings,
    | 'enableActivityMessages'
    | 'enableGlobalChat'
    | 'enableOnlineFeatures'
    | 'submitRunsToServer'
  >,
): GameOnlinePreferences {
  const globalChat = settings.enableOnlineFeatures && settings.enableGlobalChat
  return Object.freeze({
    activityMessages: globalChat && settings.enableActivityMessages,
    globalChat,
    submitRuns: settings.enableOnlineFeatures && settings.submitRunsToServer,
  })
}

export function gameSharedHubEnabled(
  settings: Pick<GameSettings, 'enableOnlineFeatures' | 'enableSharedHub'>,
): boolean {
  return settings.enableOnlineFeatures && settings.enableSharedHub
}

export function resetGameSettingsListenersForTests(): void {
  listeners.clear()
}

export function cameraZoomForFov(nativeZoom: number, fovPercent: number): number {
  return nativeZoom / (boundedInteger(
    fovPercent,
    CAMERA_FOV_MIN_PERCENT,
    CAMERA_FOV_MAX_PERCENT,
  ) / 100)
}

export function gameUiScale(settings: Pick<GameSettings, 'uiScalePercent'>): number {
  return boundedInteger(
    settings.uiScalePercent,
    UI_SCALE_MIN_PERCENT,
    UI_SCALE_MAX_PERCENT,
  ) / 100
}

export function gameLightQuality(
  settings: Pick<GameSettings, 'lightQualityPercent'>,
): number {
  return Math.fround(
    NATIVE_CAPABLE_LIGHT_QUALITY * boundedInteger(
      settings.lightQualityPercent,
      LIGHT_QUALITY_MIN_PERCENT,
      LIGHT_QUALITY_MAX_PERCENT,
    ) / 100,
  )
}

export function gameVolume(percent: number): number {
  return boundedInteger(percent, 0, 100) / 100
}

export function rebindGameControl(
  controls: GameControlBindings,
  action: GameBindingAction,
  code: string,
): GameControlBindings {
  if (!validBindingCode(code) || controls[action] === code) return controls
  const displacedAction = GAME_BINDING_ACTIONS.find((candidate) => controls[candidate] === code)
  const next = { ...controls, [action]: code }
  if (displacedAction) next[displacedAction] = controls[action]
  return Object.freeze(next)
}

export function gameBindingLabel(code: string): string {
  if (code === 'Mouse0') return 'Left Mouse'
  if (code === 'Mouse1') return 'Middle Mouse'
  if (code === 'Mouse2') return 'Right Mouse'
  if (code === 'Escape') return 'Escape'
  if (code === 'Space') return 'Space'
  if (code.startsWith('Key') && code.length === 4) return code.slice(3)
  if (code.startsWith('Digit') && code.length === 6) return code.slice(5)
  if (code.startsWith('Numpad')) return `Numpad ${code.slice(6)}`
  if (code.startsWith('Arrow')) return code.slice(5)
  return code.replace(/([a-z])([A-Z])/g, '$1 $2')
}

export function quickbarSlotForBinding(
  controls: GameControlBindings,
  code: string,
): number | null {
  for (let slot = 0; slot < 8; slot += 1) {
    if (controls[`belt${slot + 1}` as GameBindingAction] === code) return slot
  }
  return null
}

function parseGameSettings(serialized: string | null): GameSettings {
  if (serialized === null) return DEFAULT_GAME_SETTINGS
  try {
    const value: unknown = JSON.parse(serialized)
    if (!record(value)) return DEFAULT_GAME_SETTINGS
    const source = value as Record<string, unknown>
    const sourceKeys = Object.keys(source).sort()
    if (sourceKeys.length === 1 && sourceKeys[0] === 'enableCheats') {
      return normalizedGameSettings({
        ...DEFAULT_GAME_SETTINGS,
        enableCheats: source.enableCheats === true,
      })
    }
    const migrated = sameKeys(sourceKeys, DEPLOYED_GAME_SETTINGS_KEYS)
      ? {
          ...source,
          enableActivityMessages: true,
          enableGlobalChat: true,
          enableOnlineFeatures: true,
          enableSharedHub: true,
          submitRunsToServer: true,
        }
      : source
    if (!sameKeys(Object.keys(migrated).sort(), GAME_SETTINGS_KEYS)) {
      return DEFAULT_GAME_SETTINGS
    }
    if (
      typeof migrated.castSecondariesAtMouse !== 'boolean'
      || typeof migrated.complexLighting !== 'boolean'
      || typeof migrated.complexShadows !== 'boolean'
      || typeof migrated.enableActivityMessages !== 'boolean'
      || typeof migrated.enableCheats !== 'boolean'
      || typeof migrated.enableGlobalChat !== 'boolean'
      || typeof migrated.enableOnlineFeatures !== 'boolean'
      || typeof migrated.enableSharedHub !== 'boolean'
      || typeof migrated.multipleShadows !== 'boolean'
      || typeof migrated.submitRunsToServer !== 'boolean'
      || typeof migrated.zoomEffects !== 'boolean'
      || !integerInRange(migrated.cameraFovPercent, CAMERA_FOV_MIN_PERCENT, CAMERA_FOV_MAX_PERCENT)
      || !integerInRange(migrated.lightQualityPercent, LIGHT_QUALITY_MIN_PERCENT, LIGHT_QUALITY_MAX_PERCENT)
      || !integerInRange(migrated.musicVolumePercent, 0, 100)
      || !integerInRange(migrated.soundVolumePercent, 0, 100)
      || !integerInRange(migrated.uiScalePercent, UI_SCALE_MIN_PERCENT, UI_SCALE_MAX_PERCENT)
      || !validControls(migrated.controls)
    ) return DEFAULT_GAME_SETTINGS
    return normalizedGameSettings(migrated as unknown as GameSettings)
  } catch {
    return DEFAULT_GAME_SETTINGS
  }
}

function normalizedGameSettings(settings: GameSettings): GameSettings {
  return Object.freeze({
    cameraFovPercent: boundedInteger(
      settings.cameraFovPercent,
      CAMERA_FOV_MIN_PERCENT,
      CAMERA_FOV_MAX_PERCENT,
    ),
    castSecondariesAtMouse: settings.castSecondariesAtMouse === true,
    complexLighting: settings.complexLighting === true,
    complexShadows: settings.complexShadows === true,
    controls: normalizedControls(settings.controls),
    enableActivityMessages: settings.enableActivityMessages === true,
    enableCheats: settings.enableCheats === true,
    enableGlobalChat: settings.enableGlobalChat === true,
    enableOnlineFeatures: settings.enableOnlineFeatures === true,
    enableSharedHub: settings.enableSharedHub === true,
    lightQualityPercent: boundedInteger(
      settings.lightQualityPercent,
      LIGHT_QUALITY_MIN_PERCENT,
      LIGHT_QUALITY_MAX_PERCENT,
    ),
    musicVolumePercent: boundedInteger(settings.musicVolumePercent, 0, 100),
    multipleShadows: settings.multipleShadows === true,
    soundVolumePercent: boundedInteger(settings.soundVolumePercent, 0, 100),
    submitRunsToServer: settings.submitRunsToServer === true,
    uiScalePercent: boundedInteger(
      settings.uiScalePercent,
      UI_SCALE_MIN_PERCENT,
      UI_SCALE_MAX_PERCENT,
    ),
    zoomEffects: settings.zoomEffects === true,
  })
}

function normalizedControls(controls: GameControlBindings): GameControlBindings {
  return Object.freeze(Object.fromEntries(GAME_BINDING_ACTIONS.map((action) => [
    action,
    validBindingCode(controls[action]) ? controls[action] : DEFAULT_GAME_CONTROL_BINDINGS[action],
  ])) as unknown as GameControlBindings)
}

function validControls(value: unknown): value is GameControlBindings {
  if (!record(value) || !sameKeys(Object.keys(value).sort(), GAME_BINDING_ACTIONS)) return false
  const codes = GAME_BINDING_ACTIONS.map((action) => value[action])
  return codes.every(validBindingCode) && new Set(codes).size === codes.length
}

function validBindingCode(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 64
}

function boundedInteger(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Math.round(value)))
}

function integerInRange(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isInteger(value) && Number(value) >= minimum && Number(value) <= maximum
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function sameKeys(actual: readonly string[], expected: readonly string[]): boolean {
  if (actual.length !== expected.length) return false
  const sortedExpected = [...expected].sort()
  return actual.every((key, index) => key === sortedExpected[index])
}
