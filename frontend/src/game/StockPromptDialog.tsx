import type { CSSProperties, KeyboardEvent } from 'react'

import {
  STOCK_PROMPT_BOUNDS,
  STOCK_PROMPT_PRIMARY_BOUNDS,
  STOCK_PROMPT_SECONDARY_BOUNDS,
  TITLE_MENU_PROMPT_COPY,
  type TitleMenuPromptAction,
  type TitleMenuPromptKind,
} from './title-menu-prompt.ts'
import { NativeUiButton, NativeUiMessageBox } from './native-ui/react.ts'
import './stock-prompt-dialog.css'

interface StockPromptDialogProps {
  readonly busy: boolean
  readonly kind: TitleMenuPromptKind
  readonly onHighlight: (action: TitleMenuPromptAction | null) => void
  readonly onPress: () => void
  readonly onPressState: (action: TitleMenuPromptAction | null) => void
  readonly onPrimary: () => void
  readonly onSecondary: () => void
  readonly style: CSSProperties
}

export default function StockPromptDialog({
  busy,
  kind,
  onHighlight,
  onPress,
  onPressState,
  onPrimary,
  onSecondary,
  style,
}: StockPromptDialogProps) {
  const copy = TITLE_MENU_PROMPT_COPY[kind]
  const activate = (action: TitleMenuPromptAction) => {
    if (busy) return
    if (action === 'prompt-primary') onPrimary()
    else onSecondary()
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (busy) return
    if (event.key === 'Escape') {
      event.preventDefault()
      onSecondary()
    }
  }

  return (
    <>
      <div aria-hidden className="stock-prompt-curtain" />
      <div className="main-menu-native-stage stock-prompt-stage" data-prompt-kind={kind} style={style}>
        <NativeUiMessageBox
          accessibleBody={copy.accessibleBody}
          accessibleTitle={copy.accessibleTitle}
          body={copy.body}
          bounds={STOCK_PROMPT_BOUNDS}
          className="stock-prompt-dialog"
          dimAlpha={0}
          onKeyDown={handleKeyDown}
          title={copy.title}
        >
          <NativeUiButton
            autoFocus
            data-game-action="prompt-primary"
            data-game-default-focus="true"
            disabled={busy}
            name="prompt-primary"
            nativeBounds={STOCK_PROMPT_PRIMARY_BOUNDS}
            onBlur={() => {
              onHighlight(null)
              onPressState(null)
            }}
            onClick={() => {
              onPressState(null)
              onPress()
              activate('prompt-primary')
            }}
            onFocus={() => onHighlight('prompt-primary')}
            onPointerCancel={() => onPressState(null)}
            onPointerDown={(event) => {
              if (!busy && event.button === 0) onPressState('prompt-primary')
            }}
            onPointerEnter={() => onHighlight('prompt-primary')}
            onPointerLeave={() => {
              onHighlight(null)
              onPressState(null)
            }}
            onPointerUp={() => onPressState(null)}
          >
            {copy.primaryLabel}
          </NativeUiButton>
          <NativeUiButton
            aria-label={copy.secondaryLabel}
            data-game-action="prompt-secondary"
            data-game-back="true"
            disabled={busy}
            name="prompt-secondary"
            nativeBounds={STOCK_PROMPT_SECONDARY_BOUNDS}
            onBlur={() => {
              onHighlight(null)
              onPressState(null)
            }}
            onClick={() => {
              onPressState(null)
              onPress()
              activate('prompt-secondary')
            }}
            onFocus={() => onHighlight('prompt-secondary')}
            onPointerCancel={() => onPressState(null)}
            onPointerDown={(event) => {
              if (!busy && event.button === 0) onPressState('prompt-secondary')
            }}
            onPointerEnter={() => onHighlight('prompt-secondary')}
            onPointerLeave={() => {
              onHighlight(null)
              onPressState(null)
            }}
            onPointerUp={() => onPressState(null)}
          >
            {copy.secondaryLabel}
          </NativeUiButton>
        </NativeUiMessageBox>
      </div>
    </>
  )
}
