import {
  NATIVE_UI_MESSAGE, nativeUiPlan, nativeUiRecord, nativeUiRect, planNativeUiMessageFrame,
} from './native-ui/core.ts'
import { INVENTORY_SACK_NAME_MAX_LENGTH } from './core-kernels/hub-economy.ts'

/** Scale only stock ornament art; editable text and action hit targets stay screen-sized. */
export function inventorySackRenameDialogLayout(size: { readonly width: number; readonly height: number }) {
  const crown = 37 + nativeUiRecord('UI', NATIVE_UI_MESSAGE.headerRecord).logicalSize[0] / 2
  const footer = 50 + nativeUiRecord('UI', NATIVE_UI_MESSAGE.arrowRecord).logicalSize[1] / 2
  const width = Math.min(600, size.width - 32)
  const height = Math.min(400, Math.max(250, size.height - 32 - crown - footer))
  const artScale = Math.min(1, Math.max(0.01, (size.height - 32 - height) / (crown + footer)))
  const left = (size.width - width) / 2
  const top = (size.height - height - (crown + footer) * artScale) / 2 + crown * artScale
  const compact = height < 340
  const field = nativeUiRect(left + 32, top + (compact ? 92 : 165), width - 64, 44)
  const buttonWidth = (width - 72) / 2
  return {
    art: planNativeUiMessageFrame({
      bounds: nativeUiRect(left / artScale, top / artScale, width / artScale, height / artScale),
      height: size.height / artScale, width: size.width / artScale, lines: [],
    }),
    artScale,
    body: nativeUiRect(left, top, width, height),
    buttonScale: Math.min(1, buttonWidth / 260),
    cancel: nativeUiRect(left + width - buttonWidth - 24, top + height - 84, buttonWidth, 56),
    field,
    save: nativeUiRect(left + 24, top + height - 84, buttonWidth, 56),
    text: nativeUiPlan(size.width, size.height, { actions: [], nodes: [
      { kind: 'text', label: 'sack-rename:title', text: {
        align: 'left', font: 'menu', text: 'Rename Sack', tint: 0xffffff,
        x: left + 48, y: top + (compact ? 44 : 95),
      } },
      { kind: 'text', label: 'sack-rename:limit', text: {
        align: 'left', font: 'medium', text: `Up to ${INVENTORY_SACK_NAME_MAX_LENGTH} characters`, tint: 0xffffff,
        x: left + 48, y: top + (compact ? 70 : 130.5),
      } },
    ] }),
  }
}
