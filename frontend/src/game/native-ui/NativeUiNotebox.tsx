import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'

import { subscribeGamePresentationFrames } from '../game-presentation-frame-loop.ts'
import {
  NATIVE_NOTEBOX,
  nativeNoteboxDurationMs,
  nativeNoteboxLayout,
  nativeNoteboxOpacity,
  type NativeNoteboxNotice,
} from './native-ui-notebox.ts'
import NativeBitmapText from './NativeBitmapText.tsx'
import NativeUiNineSlice from './NativeUiNineSlice.tsx'
import './native-ui-notebox.css'

interface NativeUiNoteboxProps {
  readonly notice: NativeNoteboxNotice
  readonly onExpired: (sequence: number) => void
  readonly style: CSSProperties
}

export default function NativeUiNotebox({
  notice,
  onExpired,
  style,
}: NativeUiNoteboxProps) {
  const [dismissedAtMs, setDismissedAtMs] = useState<number | null>(null)
  const dismissedAtMsRef = useRef<number | null>(null)
  const expiredRef = useRef(false)
  const onExpiredRef = useRef(onExpired)
  const [elapsedMs, setElapsedMs] = useState(0)
  const layout = useMemo(() => nativeNoteboxLayout(notice.text), [notice.text])

  useEffect(() => {
    onExpiredRef.current = onExpired
  }, [onExpired])

  useEffect(() => {
    const startedAtMs = performance.now()
    dismissedAtMsRef.current = null
    expiredRef.current = false
    setDismissedAtMs(null)
    setElapsedMs(0)
    return subscribeGamePresentationFrames((nowMs) => {
      const nextElapsedMs = Math.max(0, nowMs - startedAtMs)
      const expiresAtMs = dismissedAtMsRef.current === null
        ? nativeNoteboxDurationMs(notice.kind)
        : dismissedAtMsRef.current + NATIVE_NOTEBOX.fadeMs
      if (nextElapsedMs >= expiresAtMs) {
        if (!expiredRef.current) {
          expiredRef.current = true
          onExpiredRef.current(notice.sequence)
        }
        return
      }
      setElapsedMs(nextElapsedMs)
    })
  }, [notice.kind, notice.sequence])

  const dismiss = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (dismissedAtMsRef.current !== null) return
    dismissedAtMsRef.current = elapsedMs
    setDismissedAtMs(elapsedMs)
  }
  const failure = notice.kind === 'failure'
  const opacity = nativeNoteboxOpacity(notice.kind, elapsedMs, dismissedAtMs)
  const multiplyTint = failure ? NATIVE_NOTEBOX.failureTint : undefined
  const textTint = failure
    ? NATIVE_NOTEBOX.failureTint
    : NATIVE_NOTEBOX.instructionTint

  return (
    <div
      className="native-notebox-overlay"
      data-native-notebox-kind={notice.kind}
      data-native-notebox-opacity={opacity}
      data-native-notebox-sequence={notice.sequence}
      data-native-notebox-text={notice.text}
    >
      <div className="main-menu-native-stage native-notebox-stage" style={style}>
        <div
          className="native-notebox-panel"
          data-native-notebox-dismissed={dismissedAtMs !== null}
          onPointerDown={dismiss}
          style={{
            height: layout.panelHeight,
            left: layout.panelLeft,
            opacity,
            top: layout.panelTop,
            width: layout.panelWidth,
          }}
        >
          <NativeUiNineSlice
            atlas="UI"
            className="native-notebox-frame native-notebox-frame-primary"
            height={layout.panelHeight}
            multiplyTint={multiplyTint}
            record={NATIVE_NOTEBOX.frameRecord}
            width={layout.panelWidth}
          />
          <NativeUiNineSlice
            atlas="UI"
            className="native-notebox-frame native-notebox-frame-secondary"
            height={layout.panelHeight}
            multiplyTint={multiplyTint}
            record={NATIVE_NOTEBOX.frameRecord}
            width={layout.panelWidth}
          />
          <NativeBitmapText
            align="center"
            className="native-notebox-text"
            font="menu"
            style={{ left: layout.textLeft, top: layout.textTop }}
            text={notice.text}
            tint={textTint}
            width={layout.textWidth}
          />
        </div>
      </div>
      <span
        className="native-notebox-status"
        role={failure ? 'alert' : 'status'}
        aria-atomic="true"
      >
        {notice.text}
      </span>
    </div>
  )
}
