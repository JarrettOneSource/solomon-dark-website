import { useMemo, type CSSProperties } from 'react'
import { type NativeLootMessageVisual } from './loot-message-presentation.ts'
import NativeLootBitmapText from './NativeLootBitmapText.tsx'
import { NativeUiButton, NativeUiDialog } from './native-ui/react.ts'
import { NativeUiPlanView } from './native-ui/react-raw.ts'
import { planNativeUiMessageFrame } from './native-ui/core.ts'
import {
  nativeSkillBookResultLayout,
  nativeSkillBookResultText,
} from './skill-book-feedback.ts'
import './skill-book-feedback.css'

export default function SkillBookFeedback({ skillId, hubMessages, onDismiss, style }: {
  readonly skillId: number | null
  readonly hubMessages: readonly NativeLootMessageVisual[]
  readonly onDismiss: () => void
  readonly style: CSSProperties
}) {
  const layout = useMemo(() => skillId === null ? null : nativeSkillBookResultLayout(skillId), [skillId])
  const frame = useMemo(() => layout === null ? null : planNativeUiMessageFrame({
    bounds: layout.frameBounds, lines: layout.lines, dimAlpha: 0, width: 1600, height: 900,
  }), [layout])
  return <>
    {hubMessages.length > 0 ? <div className="main-menu-native-stage skill-book-hub-messages-stage" style={style}>
      <div className="boneyard-loot-messages" aria-live="polite">
        {hubMessages.map(message => <span key={message.eventId} aria-label={message.text}
          style={{ opacity: message.alpha, transform: `scale(${message.scale})` }}>
          <NativeLootBitmapText text={message.text} tint={message.tint} />
        </span>)}
      </div>
    </div> : null}
    {skillId !== null && layout !== null && frame !== null ? <NativeUiDialog
      aria-label="Skill improved"
      className="skill-book-result-dialog"
      onDismiss={onDismiss}
      onKeyDown={event => event.stopPropagation()}
    >
      <div className="main-menu-native-stage" style={style} data-skill-book-result={skillId}>
        <span className="native-ui-sr-only">{nativeSkillBookResultText(skillId)}</span>
        <NativeUiPlanView plan={frame} />
        <NativeUiButton autoFocus data-game-default-focus="true" data-game-back="true"
          name="skill-book-result-okay" nativeBounds={layout.actionBounds} onClick={onDismiss}>
          OKAY
        </NativeUiButton>
      </div>
    </NativeUiDialog> : null}
  </>
}
