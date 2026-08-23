// Coarse-pointer (touch) placement for the unified skill quickbar and the
// virtual joysticks. Every number is a HUD-root pixel: the HUD root is
// `viewport / uiScale` wide and scaled by `uiScale` about the viewport centre,
// and each joystick scales itself by `uiScale` from its own bottom corner, so
// root pixels and joystick pixels share one coordinate system. Ledger:
// docs/game-native-parity-re.md, 2026-08-22 compact touch HUD entry.

export const MOBILE_JOYSTICK_BASE = 237.5
export const MOBILE_JOYSTICK_KNOB = 100
export const MOBILE_JOYSTICK_EDGE_INSET = 48
export const MOBILE_JOYSTICK_BOTTOM_INSET = 56

export const MOBILE_QUICKBAR_SLOT_COUNT = 8
export const MOBILE_QUICKBAR_SLOT_SIZE = 100
export const MOBILE_QUICKBAR_SLOT_MIN_SIZE = 56
export const MOBILE_QUICKBAR_SLOT_GAP = 8
// Joystick edge inset + base + a 24.5 px thumb gap.
export const MOBILE_QUICKBAR_BANK_INSET = 310
export const MOBILE_QUICKBAR_BANK_BOTTOM = 62
// The dock's outer potion sits at `calc(50% - 215px)` (2026-08-21 contract).
export const MOBILE_DOCK_HALF_WIDTH = 215
export const MOBILE_QUICKBAR_DOCK_GAP = 16

export type MobileQuickbarBank = 'left' | 'right'

export interface MobileQuickbarSlotPlacement {
  readonly bank: MobileQuickbarBank
  /** Root pixels from the HUD root bottom to the slot's bottom edge. */
  readonly bottom: number
  /** Root pixels from the bank's own screen edge to the slot's outer edge. */
  readonly inset: number
  readonly size: number
}

function assertFinitePositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number, received ${value}`)
  }
}

/**
 * Slot edge length that lets joystick, bank, and dock coexist on one half of
 * the screen. Full size unless the half-width cannot host all three; then the
 * bank shrinks (never below the minimum) instead of overlapping a neighbour.
 */
export function mobileQuickbarSlotSize(logicalViewportWidth: number, uiScale: number): number {
  assertFinitePositive(logicalViewportWidth, 'logicalViewportWidth')
  assertFinitePositive(uiScale, 'uiScale')
  const rootHalfWidth = logicalViewportWidth / uiScale / 2
  const bankWidth = rootHalfWidth
    - MOBILE_DOCK_HALF_WIDTH
    - MOBILE_QUICKBAR_DOCK_GAP
    - MOBILE_QUICKBAR_BANK_INSET
  const fitted = (bankWidth - MOBILE_QUICKBAR_SLOT_GAP) / 2
  return Math.min(MOBILE_QUICKBAR_SLOT_SIZE, Math.max(MOBILE_QUICKBAR_SLOT_MIN_SIZE, fitted))
}

/**
 * Slots `0..3` form the left bank `[0 1 / 2 3]`, slots `4..7` the right bank
 * `[4 5 / 6 7]`. Columns are measured from each bank's own screen edge, so the
 * right bank's inboard column (slot 4 / 6) carries the larger inset and native
 * slot order still reads left-to-right across the screen.
 */
export function mobileQuickbarSlotPlacement(slot: number, size: number): MobileQuickbarSlotPlacement {
  if (!Number.isInteger(slot) || slot < 0 || slot >= MOBILE_QUICKBAR_SLOT_COUNT) {
    throw new RangeError(`quickbar slot must be an integer in 0..${MOBILE_QUICKBAR_SLOT_COUNT - 1}, received ${slot}`)
  }
  assertFinitePositive(size, 'size')
  const bank: MobileQuickbarBank = slot < MOBILE_QUICKBAR_SLOT_COUNT / 2 ? 'left' : 'right'
  const index = slot % 4
  const column = index % 2
  const row = Math.floor(index / 2)
  const pitch = size + MOBILE_QUICKBAR_SLOT_GAP
  const outboardColumn = bank === 'left' ? column : 1 - column
  return {
    bank,
    bottom: MOBILE_QUICKBAR_BANK_BOTTOM + (1 - row) * pitch,
    inset: MOBILE_QUICKBAR_BANK_INSET + outboardColumn * pitch,
    size,
  }
}
