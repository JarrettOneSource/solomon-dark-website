import { useLayoutEffect, useRef, type DialogHTMLAttributes } from 'react'

import './native-ui.css'

interface NativeUiDialogProps extends Omit<DialogHTMLAttributes<HTMLDialogElement>, 'onCancel' | 'onMouseDown' | 'open'> {
  readonly onDismiss: () => void
}

/** The browser owns focus containment, inert background content, and restoration. */
export default function NativeUiDialog({ children, className, onDismiss, ...props }: NativeUiDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  useLayoutEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    // React's autoFocus runs while the dialog is hidden; apply its target once open.
    dialog.querySelector<HTMLElement>('[data-game-default-focus="true"]')?.focus()
    return () => dialog.close()
  }, [])
  return (
    <dialog
      {...props}
      aria-modal="true"
      className={['native-ui-dialog', className].filter(Boolean).join(' ')}
      onCancel={event => {
        event.preventDefault()
        onDismiss()
      }}
      onMouseDown={event => {
        if (event.target !== event.currentTarget) return
        const bounds = event.currentTarget.getBoundingClientRect()
        if (event.clientX < bounds.left || event.clientX > bounds.right
          || event.clientY < bounds.top || event.clientY > bounds.bottom) onDismiss()
      }}
      ref={ref}
      role="dialog"
    >
      {children}
    </dialog>
  )
}
