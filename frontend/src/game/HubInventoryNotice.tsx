import { NativeAction } from './HubNativeAction.tsx'
import { hubStandardNoticeActionRect, type HubInventoryUiNotice } from './hub-inventory-notices.ts'
import {
  HUB_UNFORGE_CONFIRMATION,
  HUB_UNFORGE_RESULT,
} from './renderer/hub-inventory-render-contract.ts'
import type {
  HubInventoryPressedControl,
} from './renderer/hub-inventory/model.ts'

export function HubInventoryNotice({ notice, onCommit, onDismiss, onPressedControl }: {
  notice: HubInventoryUiNotice
  onCommit: () => void
  onDismiss: () => void
  onPressedControl: (control: HubInventoryPressedControl) => void
}) {
  return (
    <>
      <span className="hub-native-ui-semantic" role="alert">
        {notice.title} {'summary' in notice && notice.summary ? `${notice.summary} ` : ''}{notice.body}
      </span>
      <NativeAction
        label={notice.actionLabel}
        rect={notice.variant === 'standard'
          ? hubStandardNoticeActionRect(notice)
          : notice.variant === 'unforge-confirmation'
            ? HUB_UNFORGE_CONFIRMATION.primaryButtonRect
            : HUB_UNFORGE_RESULT.primaryButtonRect}
        onClick={onCommit}
        onPressedChange={(pressed) => onPressedControl(pressed ? 'message-primary' : null)}
      />
      {notice.variant === 'unforge-confirmation' ? (
        <NativeAction
          gameBack
          label={notice.secondaryActionLabel ?? 'CANCEL'}
          rect={HUB_UNFORGE_CONFIRMATION.secondaryButtonRect}
          onClick={onDismiss}
          onPressedChange={(pressed) => onPressedControl(pressed ? 'message-secondary' : null)}
        />
      ) : null}
    </>
  )
}
