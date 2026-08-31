import {
  NATIVE_UI_SIMPLE_MENU,
  planNativeUiSimpleMenu,
} from './native-ui/core.ts'
import type { GameplayPauseState } from './protocol/game-protocol.ts'
import type { FixedGameViewportLayout } from './renderer/game-viewport.ts'

export type NativePauseAction = 'leave' | 'resume' | 'settings'
/**
 * Every row result the shared native SimpleMenu surface carries. Gameplay's
 * pause authors the three `NativePauseAction` rows; the Dark Cloud's Esc menu
 * (dispatcher `0x005A5530`, the same `SimpleMenu` chrome) adds SIGN OUT and
 * labels its title exit MAIN MENU, which still leaves through `'leave'`.
 */
export type NativeSimpleMenuAction = NativePauseAction | 'cheats' | 'sign-out'
export type NativePausePhase = 'closing' | 'opening'

export interface NativeSimpleMenuRow {
  readonly action: NativeSimpleMenuAction
  readonly label: string
}

export interface NativePauseBounds {
  readonly height: number
  readonly left: number
  readonly top: number
  readonly width: number
}

export interface NativePauseMenuStagePlacement {
  /** `native-stage` reuses the gameplay stage verbatim; `touch-fit` re-scales it for a phone host. */
  readonly mode: 'native-stage' | 'touch-fit'
  readonly scale: number
  readonly x: number
  readonly y: number
}

export const NATIVE_PAUSE_REVEAL_MS = 29 * 10
export const NATIVE_PAUSE_CLOSE_MS = 20 * 10
/**
 * Logical atlas sizes of the chrome art that reaches past the frame box: the
 * header (record 18, drawn rotated π/2 so it lies 262 wide × 86 tall on screen)
 * above it and the three arrows (record 8) below it.
 */
export const NATIVE_PAUSE_CHROME_ART_SIZES = Object.freeze({
  arrow: Object.freeze({ height: 112, width: 49 }),
  header: Object.freeze({ height: 262, width: 86 }),
})
/** A viewport-laid-out host keeps every pressable row at least this tall on screen (CSS px). */
export const NATIVE_PAUSE_TOUCH_ROW_MIN_PX = 44
/** ...and keeps at least this much viewport around the whole menu art (CSS px). */
export const NATIVE_PAUSE_TOUCH_MARGIN_PX = 12

const NATIVE_PAUSE_REVEAL_STEP = 0.03500000014901161
const NATIVE_PAUSE_CLOSE_STEP = 0.05000000074505806
const NATIVE_PAUSE_TICK_MS = 10

/** Gameplay's pause rows, exactly as `0x0058EA50` authors them. */
export const NATIVE_PAUSE_MENU_ROWS: readonly NativeSimpleMenuRow[] = Object.freeze([
  Object.freeze({ action: 'resume', label: 'RESUME GAME' }),
  Object.freeze({ action: 'settings', label: 'GAME SETTINGS' }),
  Object.freeze({ action: 'leave', label: 'LEAVE GAME' }),
] as const)

/** Gameplay's native rows plus the explicit Website debugging extension. */
export const CHEAT_PAUSE_MENU_ROWS: readonly NativeSimpleMenuRow[] = Object.freeze([
  Object.freeze({ action: 'resume', label: 'RESUME GAME' }),
  Object.freeze({ action: 'cheats', label: 'CHEAT MENU' }),
  Object.freeze({ action: 'settings', label: 'GAME SETTINGS' }),
  Object.freeze({ action: 'leave', label: 'LEAVE GAME' }),
] as const)

/**
 * The Dark Cloud's Esc menu rows, exactly as `0x005A5530` authors them for a
 * signed-in account: `RESUME[0]|GAME SETTINGS[1]|SIGN OUT[2]|MAIN MENU[3]`.
 */
export const NATIVE_DARK_CLOUD_MENU_ROWS: readonly NativeSimpleMenuRow[] = Object.freeze([
  Object.freeze({ action: 'resume', label: 'RESUME' }),
  Object.freeze({ action: 'settings', label: 'GAME SETTINGS' }),
  Object.freeze({ action: 'sign-out', label: 'SIGN OUT' }),
  Object.freeze({ action: 'leave', label: 'MAIN MENU' }),
] as const)

/**
 * Web adaptation for a browser guest: there is no account session to end and
 * the account band already offers SIGN IN, so the SIGN OUT row is omitted
 * rather than shown inert.
 */
export const NATIVE_DARK_CLOUD_GUEST_MENU_ROWS: readonly NativeSimpleMenuRow[] = Object.freeze(
  NATIVE_DARK_CLOUD_MENU_ROWS.filter((row) => row.action !== 'sign-out'),
)

/** One SimpleMenu row body (`UI.101` / `UI.102`) and the pitch between stacked rows. */
export const NATIVE_SIMPLE_MENU_ROW_SIZE = Object.freeze({
  height: NATIVE_UI_SIMPLE_MENU.rowHeight,
  width: NATIVE_UI_SIMPLE_MENU.rowWidth,
})

const NATIVE_PAUSE_STAGE = Object.freeze({ height: 900, width: 1600 })

export function nativeSimpleMenuRowBounds(rowCount: number): readonly NativePauseBounds[] {
  if (!Number.isInteger(rowCount) || rowCount < 1) {
    throw new RangeError(`A SimpleMenu needs at least one row; got ${rowCount}.`)
  }
  return planNativeUiSimpleMenu({
    height: NATIVE_PAUSE_STAGE.height,
    rows: Array.from({ length: rowCount }, (_, index) => ({
      id: `${index}`,
      label: '',
    })),
    width: NATIVE_PAUSE_STAGE.width,
  }).actions.map(({ bounds }) => bounds)
}

const [pauseResumeBounds, pauseSettingsBounds, pauseLeaveBounds] = nativeSimpleMenuRowBounds(3)

export const PAUSE_MENU_ACTION_BOUNDS = Object.freeze({
  resume: Object.freeze(pauseResumeBounds!),
  settings: Object.freeze(pauseSettingsBounds!),
  leave: Object.freeze(pauseLeaveBounds!),
})

export function nativePauseMenuReveal(phase: NativePausePhase, elapsedMs: number): number {
  const ticks = Math.max(0, Math.floor(elapsedMs / NATIVE_PAUSE_TICK_MS))
  if (phase === 'opening') {
    let reveal = 0
    for (let tick = 0; tick < Math.min(ticks, 29); tick += 1) {
      reveal = Math.fround(reveal + NATIVE_PAUSE_REVEAL_STEP)
      if (reveal > 1) return 1
    }
    return reveal
  }

  let reveal = 1
  for (let tick = 0; tick < Math.min(ticks, 20); tick += 1) {
    reveal = Math.fround(reveal - NATIVE_PAUSE_CLOSE_STEP)
    if (reveal < 0) return 0
  }
  return reveal
}

export type GameplayPausePresentation =
  | { kind: 'owner'; label: 'Game paused' }
  | { detail: string; kind: 'waiting'; label: string }

export function gameplayPausePresentation(
  pause: GameplayPauseState,
  playerId: string,
): GameplayPausePresentation {
  if (pause.ownerPlayerId === playerId) return { kind: 'owner', label: 'Game paused' }
  const activity = pause.source === 'inventory'
    ? 'Inventory'
    : pause.source === 'skill-book'
      ? 'the Skill Book'
      : pause.source === 'skill-selector'
        ? 'the skill selector'
        : null
  return {
    detail: activity
      ? `Waiting for ${pause.ownerDisplayName} to close ${activity}.`
      : `Waiting for ${pause.ownerDisplayName} to resume.`,
    kind: 'waiting',
    label: activity
      ? `${pause.ownerDisplayName} is using ${activity}.`
      : `${pause.ownerDisplayName} has paused the game.`,
  }
}

/**
 * Settled on-screen extent of the whole menu — header top through the large
 * arrow's bottom — in 1600×900 stage units.
 */
export function nativePauseMenuExtent(
  rows: readonly NativeSimpleMenuRow[] = NATIVE_PAUSE_MENU_ROWS,
): NativePauseBounds {
  const rowBounds = nativeSimpleMenuRowBounds(rows.length)
  const first = rowBounds[0]!
  const last = rowBounds.at(-1)!
  const frameLeft = first.left - NATIVE_UI_SIMPLE_MENU.chromePadding
  const frameTop = first.top - NATIVE_UI_SIMPLE_MENU.chromePadding
  const frameRight = first.left + first.width + NATIVE_UI_SIMPLE_MENU.chromePadding
  const frameBottom = last.top + last.height + NATIVE_UI_SIMPLE_MENU.chromePadding
  const { arrow, header } = NATIVE_PAUSE_CHROME_ART_SIZES
  // The header sprite is centre-anchored and rotated π/2, so its atlas height lies along x.
  const headerLeft = NATIVE_PAUSE_STAGE.width / 2 - header.height / 2
  const headerRight = NATIVE_PAUSE_STAGE.width / 2 + header.height / 2
  const headerTop = frameTop - NATIVE_UI_SIMPLE_MENU.headerOffset - header.width / 2
  const arrowBottom = frameBottom + NATIVE_UI_SIMPLE_MENU.largeArrowOffset + arrow.height / 2
  const left = Math.min(frameLeft, headerLeft)
  const right = Math.max(frameRight, headerRight)
  const top = Math.min(frameTop, headerTop)
  const bottom = Math.max(frameBottom, arrowBottom)
  return { height: bottom - top, left, top, width: right - left }
}

/**
 * Where a host that lays itself out at viewport size (the Dark Cloud) puts the
 * 1600×900 pause stage. The stage is always centred on the viewport, exactly as
 * gameplay's fixed stage is. It keeps gameplay's display scale while that keeps
 * a row at or above the touch floor, so the menu lands pixel-for-pixel where the
 * gameplay Esc menu does on desktop and tablet viewports. Once that scale would
 * shrink a row under the floor (phones), the stage takes the largest scale —
 * never above native 1:1 — that keeps the whole menu art inside the margin.
 * The fit follows the rows the host authors: more rows mean taller art.
 */
export function nativePauseMenuStagePlacement(
  viewport: Pick<FixedGameViewportLayout, 'displayScale' | 'height' | 'width'>,
  rows: readonly NativeSimpleMenuRow[] = NATIVE_PAUSE_MENU_ROWS,
): NativePauseMenuStagePlacement {
  const viewportWidth = viewport.width * viewport.displayScale
  const viewportHeight = viewport.height * viewport.displayScale
  const touchFloor = NATIVE_PAUSE_TOUCH_ROW_MIN_PX / NATIVE_SIMPLE_MENU_ROW_SIZE.height
  let mode: NativePauseMenuStagePlacement['mode'] = 'native-stage'
  let scale = viewport.displayScale
  if (scale < touchFloor) {
    const extent = nativePauseMenuExtent(rows)
    const stageCentreX = NATIVE_PAUSE_STAGE.width / 2
    const stageCentreY = NATIVE_PAUSE_STAGE.height / 2
    const reachX = Math.max(stageCentreX - extent.left, extent.left + extent.width - stageCentreX)
    const reachY = Math.max(stageCentreY - extent.top, extent.top + extent.height - stageCentreY)
    const roomX = Math.max(0, viewportWidth / 2 - NATIVE_PAUSE_TOUCH_MARGIN_PX)
    const roomY = Math.max(0, viewportHeight / 2 - NATIVE_PAUSE_TOUCH_MARGIN_PX)
    mode = 'touch-fit'
    scale = Math.min(1, roomX / reachX, roomY / reachY)
  }
  return {
    mode,
    scale,
    x: (viewportWidth - NATIVE_PAUSE_STAGE.width * scale) / 2,
    y: (viewportHeight - NATIVE_PAUSE_STAGE.height * scale) / 2,
  }
}
