import { findInventoryItem, inventoryItemsAtSackPath, type HubInventoryItem } from './core-kernels/hub-economy.ts'
import { nativeUiFont } from './native-ui/core.ts'

/** Compact stock chrome stays above the first Sack row, at its normal right edge. */
export const INVENTORY_SACK_RENAME_BUTTON = Object.freeze({
  bounds: { left: 1310, top: 440, width: 250, height: 44 },
  label: 'RENAME SACK',
  scale: 44 / 69,
})

/** The stock menu atlas silently skips missing glyphs; custom names must not. */
export function inventorySackNameNeedsBrowserFont(name: string): boolean {
  const font = nativeUiFont('menu')
  return [...name].some(character => character !== ' ' && !font.glyphs[String(character.codePointAt(0))])
}

/** A selection owns the command, even when its item cannot be renamed. */
export function inventorySackRenameTarget(
  economy: { readonly backpack: readonly HubInventoryItem[]; readonly storage: readonly HubInventoryItem[] },
  selection: { readonly id: number; readonly owner: 'backpack' | 'storage' | 'equipment' | null } | null,
  sackPath: readonly number[],
): HubInventoryItem | null {
  let item: HubInventoryItem | null = null
  if (selection !== null) {
    if (selection.owner !== 'backpack' && selection.owner !== 'storage') return null
    item = findInventoryItem(economy[selection.owner], selection.id)
  } else if (sackPath.length > 0) {
    item = inventoryItemsAtSackPath(economy.backpack, sackPath.slice(0, -1))
      ?.find(candidate => candidate.id === sackPath.at(-1)) ?? null
  }
  return item?.kind === 'sack' && item.nativeTypeId === 7008 ? item : null
}
