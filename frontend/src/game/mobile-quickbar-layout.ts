// Coarse-pointer (touch) placement for the unified skill quickbar and the
// virtual joysticks. Every number is a HUD-root pixel: the HUD root is
// `viewport / uiScale` wide and scaled by `uiScale` about the viewport centre,
// and each joystick scales itself by `uiScale` from its own bottom corner, so
// root pixels and joystick pixels share one coordinate system.

export const MOBILE_JOYSTICK_BASE = 237.5
export const MOBILE_JOYSTICK_KNOB = 100
export const MOBILE_JOYSTICK_EDGE_INSET = 48
export const MOBILE_JOYSTICK_BOTTOM_INSET = 56

export const MOBILE_QUICKBAR_SLOT_COUNT = 8
export const MOBILE_QUICKBAR_SLOT_SIZE = 100
// Touch floor for a slot. 52 keeps the bank edge (293.5 + 2 * 52 + 8 = 405.5)
// inboard of the 230 dock with a 4.5 px margin at the narrowest supported
// case, 1600 logical px at uiScale 1.25 (root half width 640, dock edge 410);
// the 16 px dock gap is the yield budget there.
export const MOBILE_QUICKBAR_SLOT_MIN_SIZE = 52
export const MOBILE_QUICKBAR_SLOT_GAP = 8
// Joystick edge inset + base + a 24.5 px thumb gap.
export const MOBILE_QUICKBAR_BANK_INSET = 310
// The thumb gap yields down to 8 px before the slots shrink.
export const MOBILE_QUICKBAR_BANK_MIN_INSET = MOBILE_JOYSTICK_EDGE_INSET + MOBILE_JOYSTICK_BASE + 8
export const MOBILE_QUICKBAR_BANK_BOTTOM = 62
// The dock's outer potion sits at `calc(50% - 230px)` (2026-08-23 owner pick B).
export const MOBILE_DOCK_HALF_WIDTH = 230
export const MOBILE_QUICKBAR_DOCK_GAP = 16

export type MobileQuickbarBank = 'left' | 'right'

export interface MobileQuickbarBankLayout {
  /** Root pixels from each bank's own screen edge to its outer column. */
  readonly inset: number
  /** Slot edge length in root pixels. */
  readonly size: number
}

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
 * Bank geometry that lets joystick, bank, and dock coexist on one half of the
 * screen. Full slots at the preferred inset whenever the half-width hosts all
 * three. Otherwise the thumb gap beside the joystick yields first (down to
 * `MOBILE_QUICKBAR_BANK_MIN_INSET`) and the slots shrink second (never below
 * `MOBILE_QUICKBAR_SLOT_MIN_SIZE`), so touch targets outlive the comfort gap.
 * Past that floor the screen cannot host the chosen UI scale; the bank keeps
 * its minimum instead of vanishing.
 */
export function mobileQuickbarBankLayout(logicalViewportWidth: number, uiScale: number): MobileQuickbarBankLayout {
  assertFinitePositive(logicalViewportWidth, 'logicalViewportWidth')
  assertFinitePositive(uiScale, 'uiScale')
  const rootHalfWidth = logicalViewportWidth / uiScale / 2
  const available = rootHalfWidth - MOBILE_DOCK_HALF_WIDTH - MOBILE_QUICKBAR_DOCK_GAP
  const fullBankWidth = 2 * MOBILE_QUICKBAR_SLOT_SIZE + MOBILE_QUICKBAR_SLOT_GAP
  if (MOBILE_QUICKBAR_BANK_INSET + fullBankWidth <= available) {
    return { inset: MOBILE_QUICKBAR_BANK_INSET, size: MOBILE_QUICKBAR_SLOT_SIZE }
  }
  const yieldedInset = available - fullBankWidth
  if (yieldedInset >= MOBILE_QUICKBAR_BANK_MIN_INSET) {
    return { inset: yieldedInset, size: MOBILE_QUICKBAR_SLOT_SIZE }
  }
  const fitted = (available - MOBILE_QUICKBAR_BANK_MIN_INSET - MOBILE_QUICKBAR_SLOT_GAP) / 2
  return {
    inset: MOBILE_QUICKBAR_BANK_MIN_INSET,
    size: Math.max(MOBILE_QUICKBAR_SLOT_MIN_SIZE, fitted),
  }
}

/**
 * Slots `0..3` form the left bank `[0 1 / 2 3]`, slots `4..7` the right bank
 * `[4 5 / 6 7]`. Columns are measured from each bank's own screen edge, so the
 * right bank's inboard column (slot 4 / 6) carries the larger inset and native
 * slot order still reads left-to-right across the screen.
 */
export function mobileQuickbarSlotPlacement(
  slot: number,
  { inset, size }: MobileQuickbarBankLayout,
): MobileQuickbarSlotPlacement {
  if (!Number.isInteger(slot) || slot < 0 || slot >= MOBILE_QUICKBAR_SLOT_COUNT) {
    throw new RangeError(`quickbar slot must be an integer in 0..${MOBILE_QUICKBAR_SLOT_COUNT - 1}, received ${slot}`)
  }
  assertFinitePositive(inset, 'inset')
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
    inset: inset + outboardColumn * pitch,
    size,
  }
}
