export type NativeOptionalBookKind = 'inventory' | 'skills'

export interface NativeOptionalBookBindings {
  readonly inventory: string
  readonly menu: string
  readonly skills: string
}

export type NativeOptionalBookKeyAction =
  | Readonly<{ type: 'close' }>
  | Readonly<{ target: NativeOptionalBookKind; type: 'replace' }>

const CLOSE_ACTION = Object.freeze({ type: 'close' } as const)
const REPLACE_INVENTORY = Object.freeze({ target: 'inventory', type: 'replace' } as const)
const REPLACE_SKILLS = Object.freeze({ target: 'skills', type: 'replace' } as const)

/**
 * Shared optional-book key routing recovered from the InventoryScreen and
 * SkillScreen openers. The current screen's binding closes it; the sibling's
 * binding begins an immediate reciprocal replacement.
 */
export function nativeOptionalBookKeyAction(
  code: string,
  current: NativeOptionalBookKind,
  bindings: NativeOptionalBookBindings,
): NativeOptionalBookKeyAction | null {
  if (code === bindings.menu) return CLOSE_ACTION
  if (current === 'inventory') {
    if (code === bindings.inventory) return CLOSE_ACTION
    if (code === bindings.skills) return REPLACE_SKILLS
    return null
  }
  if (code === bindings.skills) return CLOSE_ACTION
  if (code === bindings.inventory) return REPLACE_INVENTORY
  return null
}

/** Native HUD writer `0x005C7200` forces the settled slide while both books exist. */
export function nativeOptionalBookHudProgress(progress: number, siblingActive: boolean): number {
  if (!Number.isFinite(progress) || progress < 0 || progress > 1) {
    throw new RangeError('native optional-book progress must be within [0, 1]')
  }
  return siblingActive ? 1 : progress
}

/**
 * A locally owned optional-menu pause remains valid while the host changes its
 * replicated source label from the retiring book to Inventory.
 */
export function nativeOptionalBookOwnsInventoryPause(
  ownsModalPause: boolean,
  inventoryScreenOpen: boolean,
): boolean {
  return ownsModalPause && inventoryScreenOpen
}
