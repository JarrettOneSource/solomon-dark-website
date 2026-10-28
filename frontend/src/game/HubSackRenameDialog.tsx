import { useEffect, useRef, useState } from 'react'
import {
  INVENTORY_SACK_NAME_MAX_LENGTH,
  normalizeInventorySackName,
  type HubActionFeedback,
  type HubInventoryAction,
  type HubInventoryItem,
} from './core-kernels/hub-economy.ts'
import { NativeUiButton, NativeUiControlPanelField } from './native-ui/react.ts'
import { NativeUiPlanView, useNativeUiElementSize } from './native-ui/react-raw.ts'
import { inventorySackRenameDialogLayout } from './hub-sack-rename-dialog-layout.ts'

export default function HubSackRenameDialog({ item, feedback, onAction, onClose }: {
  item: HubInventoryItem
  feedback: HubActionFeedback | null
  onAction: (action: HubInventoryAction) => void
  onClose: () => void
}) {
  const [value, setValue] = useState(item.name)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pendingSequence = useRef<number | null>(null)
  const root = useRef<HTMLElement>(null)
  const size = useNativeUiElementSize(root, { width: 1600, height: 900 })
  const layout = inventorySackRenameDialogLayout(size)
  const name = normalizeInventorySackName(value)

  useEffect(() => {
    const prior = document.activeElement
    const input = root.current?.querySelector('input')
    input?.focus({ preventScroll: true })
    input?.setSelectionRange(0, input.value.length)
    return () => {
      if (prior instanceof HTMLElement && prior.isConnected) prior.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    if (pendingSequence.current === null || !feedback
      || feedback.sequence <= pendingSequence.current || feedback.action !== 'rename-sack') return
    pendingSequence.current = null
    setPending(false)
    if (feedback.accepted) onClose()
    else setError('That Sack could not be renamed. Please try again.')
  }, [feedback, onClose])

  const submit = () => {
    if (name === null || pendingSequence.current !== null) return
    pendingSequence.current = feedback?.sequence ?? 0
    setPending(true)
    setError(null)
    onAction({ type: 'rename-sack', itemId: item.id, name })
  }

  return (
    <section
      aria-label="Rename Sack"
      aria-modal="true"
      className="hub-sack-rename-dialog"
      data-sack-rename-dialog={item.id}
      ref={root}
      role="dialog"
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Escape') {
          event.preventDefault()
          if (!pending) onClose()
        } else if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
          event.preventDefault()
          if (!event.repeat && !event.nativeEvent.isComposing) submit()
        } else if (event.key === 'Tab') {
          const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('input:not(:disabled), button:not(:disabled)')]
          const edge = event.shiftKey ? controls[0] : controls.at(-1)
          if (document.activeElement === edge) {
            event.preventDefault()
            ;(event.shiftKey ? controls.at(-1) : controls[0])?.focus({ preventScroll: true })
          }
        }
      }}
    >
      <NativeUiPlanView className="hub-sack-rename-art" plan={layout.art}
        style={{ transform: `scale(${layout.artScale})`, transformOrigin: '0 0' }} />
      <NativeUiPlanView plan={layout.text} />
      <div className="hub-sack-rename-field" style={{
        left: layout.field.left, top: layout.field.top, width: layout.field.width,
      }}>
        <NativeUiControlPanelField
          autoComplete="off"
          disabled={pending}
          label="Sack name"
          maxLength={INVENTORY_SACK_NAME_MAX_LENGTH}
          onChange={(event) => { setValue(event.currentTarget.value); setError(null) }}
          type="text"
          value={value}
        />
        <p aria-live="polite" className="hub-sack-rename-error">
          {error ?? (name === null ? 'Enter a name using 1–32 characters.' : '\u00a0')}
        </p>
      </div>
      <NativeUiButton disabled={pending || name === null}
        nativeBounds={layout.save} scale={layout.buttonScale} onClick={submit}>SAVE</NativeUiButton>
      <NativeUiButton data-game-back disabled={pending}
        nativeBounds={layout.cancel} scale={layout.buttonScale} onClick={onClose}>CANCEL</NativeUiButton>
    </section>
  )
}
