import { useState, type ButtonHTMLAttributes } from 'react'

import type { NativeUiButtonState } from './native-ui-plan.ts'

type ButtonEvents = Pick<ButtonHTMLAttributes<HTMLButtonElement>,
  | 'disabled' | 'onBlur' | 'onFocus' | 'onKeyDown' | 'onKeyUp'
  | 'onPointerCancel' | 'onPointerDown' | 'onPointerEnter' | 'onPointerLeave' | 'onPointerUp'
>

/** Every stock button uses the same pointer, keyboard, and cancellation lifetime. */
export function useNativeUiButtonState(props: ButtonEvents, selected = false) {
  const [focused, setFocused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)
  const state: NativeUiButtonState = props.disabled
    ? 'disabled'
    : pressed ? 'pressed' : selected ? 'selected' : focused || hovered ? 'focused' : 'idle'
  const events: ButtonEvents = {
    onBlur(event) {
      setFocused(false)
      setPressed(false)
      props.onBlur?.(event)
    },
    onFocus(event) {
      setFocused(true)
      props.onFocus?.(event)
    },
    onKeyDown(event) {
      if (!props.disabled && !event.repeat && (event.key === 'Enter' || event.key === ' ')) setPressed(true)
      props.onKeyDown?.(event)
    },
    onKeyUp(event) {
      if (event.key === 'Enter' || event.key === ' ') setPressed(false)
      props.onKeyUp?.(event)
    },
    onPointerCancel(event) {
      setPressed(false)
      props.onPointerCancel?.(event)
    },
    onPointerDown(event) {
      if (!props.disabled && event.button === 0) setPressed(true)
      props.onPointerDown?.(event)
    },
    onPointerEnter(event) {
      setHovered(true)
      props.onPointerEnter?.(event)
    },
    onPointerLeave(event) {
      setHovered(false)
      setPressed(false)
      props.onPointerLeave?.(event)
    },
    onPointerUp(event) {
      setPressed(false)
      props.onPointerUp?.(event)
    },
  }
  return { events, state }
}
