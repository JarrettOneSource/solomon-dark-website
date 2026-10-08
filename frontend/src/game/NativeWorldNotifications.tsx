import type { NativeLootMessageVisual } from './loot-message-presentation.ts'
import NativeLootBitmapText from './NativeLootBitmapText.tsx'

// Game notification draw 0x005CF000 clips at the translated Y50 origin,
// then adds the native 17-pixel text baseline before each rounded row offset.
const NATIVE_NOTIFICATION_CLIP_TOP = 50
const NATIVE_NOTIFICATION_BASELINE = 17

export default function NativeWorldNotifications({ messages, visible = true, uiScale = 1 }: {
  readonly messages: readonly NativeLootMessageVisual[]
  readonly visible?: boolean
  readonly uiScale?: number
}) {
  if (!visible) return null
  return <div className="boneyard-loot-messages" aria-live="polite" aria-atomic="false"
    data-native-notification-clip={NATIVE_NOTIFICATION_CLIP_TOP}
    style={{ top: NATIVE_NOTIFICATION_CLIP_TOP * uiScale }}>
    {messages.filter(message => message.alpha > 0 && message.scale > 0).map(message => <span key={message.key} aria-label={message.text}
      style={{
        opacity: message.alpha,
        top: (NATIVE_NOTIFICATION_BASELINE + Math.round(message.offset)) * uiScale,
        transform: `scale(${uiScale})`,
      }}>
      <span className="boneyard-loot-message-shadow">
        <NativeLootBitmapText text={message.text} tint={0} scale={message.scale} />
      </span>
      <NativeLootBitmapText text={message.text} tint={message.tint} scale={message.scale} />
    </span>)}
  </div>
}
