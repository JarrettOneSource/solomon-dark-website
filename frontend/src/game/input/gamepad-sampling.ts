import type { GamepadLike } from './movement-input.ts'

type GamepadSample = readonly (GamepadLike | null)[]
type GamepadSampleListener = (gamepads: GamepadSample) => void

export interface MenuGamepadSampler {
  destroy(): void
  sample(): GamepadSample
  setActive(active: boolean): void
}

export interface GamepadSampling {
  createMenuSampler(): MenuGamepadSampler
  sampleBlockedGameplay(): GamepadSample
  sampleGameplay(): GamepadSample
  subscribe(listener: GamepadSampleListener): () => void
}

/**
 * Own the browser's native gamepad read across gameplay and menu consumers.
 * The active menu is the sampling owner; otherwise gameplay is the owner and
 * menu navigation may fill a missing frame when gameplay has not published.
 */
export function createGamepadSampling(
  getGamepads: () => GamepadSample,
): GamepadSampling {
  const activeMenuSamplers = new Set<symbol>()
  const listeners = new Set<GamepadSampleListener>()
  let latest: GamepadSample = []

  const sample = (): GamepadSample => {
    latest = getGamepads()
    for (const listener of listeners) listener(latest)
    return latest
  }

  return {
    createMenuSampler() {
      const owner = Symbol('menu-gamepad-sampler')
      let active = false
      let destroyed = false
      return {
        destroy() {
          if (destroyed) return
          destroyed = true
          activeMenuSamplers.delete(owner)
        },
        sample,
        setActive(nextActive) {
          if (destroyed || active === nextActive) return
          active = nextActive
          if (active) activeMenuSamplers.add(owner)
          else activeMenuSamplers.delete(owner)
        },
      }
    },
    sampleBlockedGameplay() {
      return activeMenuSamplers.size > 0 ? latest : sample()
    },
    sampleGameplay: sample,
    subscribe(listener) {
      listeners.add(listener)
      listener(latest)
      return () => listeners.delete(listener)
    },
  }
}

export const browserGamepadSampling = createGamepadSampling(() => (
  typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function'
    ? navigator.getGamepads()
    : []
))
