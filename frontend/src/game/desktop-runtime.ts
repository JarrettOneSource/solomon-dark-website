import type { GameEndpoint } from './engine.ts'

export interface DesktopState {
  readonly build: { readonly revision: string; readonly sourceTimestamp: number }
  readonly mode: 'solo' | 'host' | 'join' | null
  readonly addresses: readonly string[]
  readonly update: { readonly revision: string; readonly url: string } | null
  readonly updateError: string | null
}

export interface DesktopRuntime {
  getState(): Promise<DesktopState>
  returnToLauncher(): Promise<void>
  checkUpdates(): Promise<DesktopState>
  downloadUpdate(): Promise<void>
  openWebsite(): Promise<void>
  onBeforeClose(callback: () => Promise<void>): () => void
  onState(callback: (state: DesktopState) => void): () => void
}

declare global {
  interface Window {
    solomonDarkRuntime?: { readonly gameEndpoint?: GameEndpoint; readonly desktop?: DesktopRuntime }
  }
}

export function desktopRuntime(): DesktopRuntime | null {
  return typeof window === 'undefined' ? null : window.solomonDarkRuntime?.desktop ?? null
}
