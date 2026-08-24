import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react'

import {
  TITLE_MENU_PROMPT_COPY,
  planTitleMenuPrompt,
  type TitleMenuPromptAction,
  type TitleMenuPromptKind,
} from './title-menu-prompt.ts'
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
  const actions = planTitleMenuPrompt({
    busy,
    hoveredAction: null,
    kind,
    pressedAction: null,
  }).actions
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
    <div className="main-menu-native-stage stock-prompt-stage" style={style}>
      <section
        aria-describedby={`stock-prompt-${kind}-body`}
        aria-labelledby={`stock-prompt-${kind}-title`}
        aria-modal="true"
        className="stock-prompt-dialog"
        data-prompt-kind={kind}
        onKeyDown={handleKeyDown}
        role="dialog"
      >
        <h2 className="sr-only" id={`stock-prompt-${kind}-title`}>{copy.accessibleTitle}</h2>
        <p className="sr-only" id={`stock-prompt-${kind}-body`}>{copy.accessibleBody}</p>
        {actions.map((action, index) => (
          <button
            autoFocus={index === 0}
            aria-label={index === 0 ? copy.primaryLabel : copy.secondaryLabel}
            className="stock-prompt-action"
            data-game-back={index === 1 || undefined}
            data-game-action={action.id}
            data-game-default-focus={index === 0 || undefined}
            disabled={busy}
            key={action.id}
            onBlur={() => {
              onHighlight(null)
              onPressState(null)
            }}
            onClick={() => {
              onPressState(null)
              onPress()
              activate(action.id as TitleMenuPromptAction)
            }}
            onFocus={() => onHighlight(action.id as TitleMenuPromptAction)}
            onKeyDown={(event) => {
              if (!busy && !event.repeat && (event.key === 'Enter' || event.key === ' ')) {
                onPressState(action.id as TitleMenuPromptAction)
              }
            }}
            onKeyUp={(event) => {
              if (event.key === 'Enter' || event.key === ' ') onPressState(null)
            }}
            onPointerCancel={() => onPressState(null)}
            onPointerDown={(event: MouseEvent<HTMLButtonElement>) => {
              if (busy || event.button !== 0) return
              onPressState(action.id as TitleMenuPromptAction)
            }}
            onPointerEnter={() => onHighlight(action.id as TitleMenuPromptAction)}
            onPointerLeave={() => {
              onHighlight(null)
              onPressState(null)
            }}
            onPointerUp={() => onPressState(null)}
            style={{
              height: action.bounds.height,
              left: action.bounds.left,
              top: action.bounds.top,
              width: action.bounds.width,
            }}
            type="button"
          />
        ))}
      </section>
    </div>
  )
}
