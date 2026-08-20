export interface GameSettings {
  readonly enableCheats: boolean
}

export interface GameSettingsStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export const GAME_SETTINGS_STORAGE_KEY = 'solomon-dark-game-settings-v1'
export const DEFAULT_GAME_SETTINGS: GameSettings = Object.freeze({ enableCheats: false })

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
  const normalized = Object.freeze({ enableCheats: settings.enableCheats === true })
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

export function resetGameSettingsListenersForTests(): void {
  listeners.clear()
}

function parseGameSettings(serialized: string | null): GameSettings {
  if (serialized === null) return DEFAULT_GAME_SETTINGS
  try {
    const value: unknown = JSON.parse(serialized)
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return DEFAULT_GAME_SETTINGS
    }
    const source = value as Record<string, unknown>
    if (Object.keys(source).some((key) => key !== 'enableCheats')) {
      return DEFAULT_GAME_SETTINGS
    }
    return Object.freeze({ enableCheats: source.enableCheats === true })
  } catch {
    return DEFAULT_GAME_SETTINGS
  }
}
