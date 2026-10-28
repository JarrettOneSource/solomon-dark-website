export interface GameFullscreenTarget {
  requestFullscreen?(options?: FullscreenOptions): Promise<void>
  webkitRequestFullscreen?(): Promise<void> | void
}

export interface GameFullscreenDocument {
  documentElement: GameFullscreenTarget
  exitFullscreen?(): Promise<void>
  fullscreenElement?: unknown | null
  fullscreenEnabled?: boolean
  webkitExitFullscreen?(): Promise<void> | void
  webkitFullscreenElement?: unknown | null
  webkitFullscreenEnabled?: boolean
}

export interface GameDisplayWindow {
  matchMedia(query: string): { matches: boolean }
  navigator: {
    readonly standalone?: boolean
    readonly userAgent?: string
  }
}

export type GameFullscreenControlMode = 'fullscreen' | 'hidden' | 'install'

export const GAME_FULLSCREEN_CHANGE_EVENTS = [
  'fullscreenchange',
  'webkitfullscreenchange',
] as const

export function gameFullscreenSupported(document: GameFullscreenDocument): boolean {
  return standardFullscreenSupported(document) || webkitFullscreenSupported(document)
}

export function gameFullscreenActive(document: GameFullscreenDocument): boolean {
  return currentFullscreenElement(document) === document.documentElement
}

export function gameFullscreenControlMode(
  document: GameFullscreenDocument,
  installed: boolean,
): GameFullscreenControlMode {
  if (gameFullscreenSupported(document)) return 'fullscreen'
  return installed ? 'hidden' : 'install'
}

export function gameInstalledDisplayMode(window: GameDisplayWindow): boolean {
  return window.navigator.standalone === true
    || window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: fullscreen)').matches
}

export async function toggleGameFullscreen(document: GameFullscreenDocument): Promise<void> {
  if (!gameFullscreenSupported(document)) {
    throw new Error('Fullscreen is not available in this browser.')
  }
  if (currentFullscreenElement(document)) {
    if (document.fullscreenElement && document.exitFullscreen) {
      await document.exitFullscreen()
      return
    }
    if (document.webkitFullscreenElement && document.webkitExitFullscreen) {
      await document.webkitExitFullscreen()
      return
    }
    if (document.exitFullscreen) {
      await document.exitFullscreen()
      return
    }
    await document.webkitExitFullscreen?.()
    return
  }
  if (standardFullscreenSupported(document)) {
    await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' })
    return
  }
  await document.documentElement.webkitRequestFullscreen?.()
}

function currentFullscreenElement(document: GameFullscreenDocument): unknown | null {
  return document.fullscreenElement ?? document.webkitFullscreenElement ?? null
}

function standardFullscreenSupported(document: GameFullscreenDocument): boolean {
  return document.fullscreenEnabled !== false
    && typeof document.documentElement.requestFullscreen === 'function'
    && typeof document.exitFullscreen === 'function'
}

function webkitFullscreenSupported(document: GameFullscreenDocument): boolean {
  return document.webkitFullscreenEnabled !== false
    && typeof document.documentElement.webkitRequestFullscreen === 'function'
    && typeof document.webkitExitFullscreen === 'function'
}
