import type { CSSProperties, RefObject } from 'react'

import { hub } from '../lib/assets'
import { activateMenuBack } from './input/gamepad-menu-navigation.ts'

export type GameMenuSkullScene = 'boneyard' | 'dark-cloud' | 'hub'

/**
 * What the scene's HUD painter and OPEN MENU gate say about the skull: `hidden` while
 * stock paints no skull at all (the tutorial before its combat HUD unlocks), `inert`
 * while the sprite is painted but the scene would ignore OPEN MENU (modal open, input
 * blocked, transition), `available` when a press opens the scene menu.
 */
export type GameMenuAvailability = 'available' | 'hidden' | 'inert'

interface GameMenuSkullProps {
  availability: GameMenuAvailability
  /** Screen px per HUD px (display scale × UI scale); 1 where the scene is not a scaled frame. */
  frameScale: number
  onOpenMenu: () => void
  scene: GameMenuSkullScene
  /** The stage whose open modal the skull backs out of (MainMenuScene's stage). */
  stage: RefObject<HTMLElement | null>
}

/**
 * The one menu skull, mounted on the stage over every scene that has a menu (Hub,
 * Boneyard, Dark Cloud). Stock paints the sprite in the HUD at (11, 7) / 31 px and opens
 * the menu from a keyboard edge only; here the same sprite is a control with one rule
 * everywhere: with a menu or dialog open it presses that surface's back owner (the element
 * gamepad B presses), otherwise it opens the scene menu behind the scene's own gates.
 * Touch gets a 44 px box at (4, 4) with 36 px art (main-menu.css).
 */
export default function GameMenuSkull({
  availability,
  frameScale,
  onOpenMenu,
  scene,
  stage,
}: GameMenuSkullProps) {
  if (availability === 'hidden') return null
  const menuAvailable = availability === 'available'
  const activate = () => {
    const root = stage.current
    if (!root) return
    if (activateMenuBack(root) !== 'no-modal') return
    if (menuAvailable) onOpenMenu()
  }
  return (
    <button
      type="button"
      className="game-menu-skull"
      aria-label="Menu"
      data-game-menu-available={menuAvailable}
      data-game-menu-scene={scene}
      onClick={activate}
      style={{ '--game-menu-skull-scale': frameScale } as CSSProperties}
    >
      <img src={hub.hud.skull} alt="" />
    </button>
  )
}
