import NativeUiButton from './NativeUiButton.tsx'
import NativeUiMessageBox from './NativeUiMessageBox.tsx'
import { nativeUiRect } from './native-ui-plan.ts'

export default function NativeUiDomWorkbenchPreview() {
  return (
    <>
      <NativeUiMessageBox
        body="Every panel, glyph, button, and tab in this preview is composed from the stock atlas record and bitmap-font ABI."
        bounds={nativeUiRect(500, 105, 600, 430)}
        dimAlpha={0.55}
        title="STOCK UI BUILDING BLOCKS"
      >
        <NativeUiButton name="accept">ACCEPT</NativeUiButton>
        <NativeUiButton name="cancel">CANCEL</NativeUiButton>
      </NativeUiMessageBox>
      <NativeUiButton
        disabled
        name="disabled-example"
        nativeBounds={nativeUiRect(623.5, 790, 353, 69)}
        style={{ zIndex: 2 }}
      >
        DISABLED STOCK ACTION
      </NativeUiButton>
    </>
  )
}
