import type { NativeLootMessageVisual } from './loot-message-presentation.ts'
import NativeLootBitmapText from './NativeLootBitmapText.tsx'

export default function NativeWorldNotifications({ messages, visible = true }: {
  readonly messages: readonly NativeLootMessageVisual[]
  readonly visible?: boolean
}) {
  if (!visible) return null
  return <div className="boneyard-loot-messages" aria-live="polite" aria-atomic="false">
    {messages.filter(message => message.alpha > 0 && message.scale > 0).map(message => <span key={message.key} aria-label={message.text}
      style={{ opacity: message.alpha, top: 0 }}>
      <span className="boneyard-loot-message-shadow">
        <NativeLootBitmapText text={message.text} tint={0} scale={message.scale} />
      </span>
      <NativeLootBitmapText text={message.text} tint={message.tint} scale={message.scale} />
    </span>)}
  </div>
}
