import { nativeUiRecord } from './native-ui/native-ui-catalog.ts'
import { measureNativeUiText } from './native-ui/native-ui-text.ts'

export const NATIVE_INVENTORY_GOLD_LEDGER = {
  iconCenter: [38, 868] as const,
  iconRecord: 21,
  textBaselineY: 870,
  textLeft: 48,
} as const

export function nativeInventoryGoldLedgerRight(gold: number): number {
  const icon = nativeUiRecord('UI', NATIVE_INVENTORY_GOLD_LEDGER.iconRecord)
  return Math.max(
    NATIVE_INVENTORY_GOLD_LEDGER.iconCenter[0] + icon.logicalSize[0] / 2,
    NATIVE_INVENTORY_GOLD_LEDGER.textLeft
      + measureNativeUiText(gold.toLocaleString(), 'body'),
  )
}
