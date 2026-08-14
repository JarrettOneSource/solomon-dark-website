export interface GameFullscreenTarget {
  requestFullscreen(): Promise<void>
}

export interface GameFullscreenDocument {
  documentElement: GameFullscreenTarget
  exitFullscreen(): Promise<void>
  fullscreenElement: unknown | null
  fullscreenEnabled: boolean
}

export function gameFullscreenSupported(document: GameFullscreenDocument): boolean {
  return document.fullscreenEnabled
    && typeof document.documentElement.requestFullscreen === 'function'
    && typeof document.exitFullscreen === 'function'
}

export function gameFullscreenActive(document: GameFullscreenDocument): boolean {
  return document.fullscreenElement === document.documentElement
}

export async function toggleGameFullscreen(document: GameFullscreenDocument): Promise<void> {
  if (!gameFullscreenSupported(document)) {
    throw new Error('Fullscreen is not available in this browser.')
  }
  if (document.fullscreenElement) {
    await document.exitFullscreen()
    return
  }
  await document.documentElement.requestFullscreen()
}
