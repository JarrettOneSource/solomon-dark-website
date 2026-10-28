import { layoutNativeUiText } from './native-ui-text.ts'

export type NativeNoteboxKind = 'failure' | 'instruction'

export interface NativeNoteboxNotice {
  readonly kind: NativeNoteboxKind
  readonly sequence: number
  readonly text: string
}

export interface NativeNoteboxLayout {
  readonly panelHeight: number
  readonly panelLeft: number
  readonly panelTop: number
  readonly panelWidth: number
  readonly textHeight: number
  readonly textLeft: number
  readonly textBaseline: number
  readonly textWidth: number
}

export const NATIVE_NOTEBOX = Object.freeze({
  centerX: 800,
  centerY: 250,
  failureHoldMs: 5_000,
  failureTint: 0xff4040,
  fadeMs: 200,
  frameRecord: 64,
  instructionHoldMs: 10_000,
  instructionTint: 0xd9ba70,
  padding: 35,
  revealMs: 100,
  textBaselineOffset: 18,
})

export function nativeNoteboxDurationMs(kind: NativeNoteboxKind): number {
  return nativeNoteboxHoldMs(kind) + NATIVE_NOTEBOX.fadeMs
}

export function nativeNoteboxOpacity(
  kind: NativeNoteboxKind,
  elapsedMs: number,
  dismissedAtMs: number | null = null,
): number {
  const elapsed = Math.max(0, elapsedMs)
  const reveal = Math.min(1, elapsed / NATIVE_NOTEBOX.revealMs)
  const normalFade = Math.min(1, Math.max(
    0,
    (nativeNoteboxDurationMs(kind) - elapsed) / NATIVE_NOTEBOX.fadeMs,
  ))
  const dismissedFade = dismissedAtMs === null || elapsed <= dismissedAtMs
    ? 1
    : Math.min(1, Math.max(
        0,
        1 - (elapsed - dismissedAtMs) / NATIVE_NOTEBOX.fadeMs,
      ))
  return reveal * Math.min(normalFade, dismissedFade)
}

export function nativeNoteboxLayout(text: string): NativeNoteboxLayout {
  const textLayout = layoutNativeUiText({
    align: 'center',
    font: 'menu',
    text,
    x: 0,
    y: 0,
  })
  const textWidth = textLayout.width
  const textHeight = textLayout.height
  const panelWidth = textWidth + NATIVE_NOTEBOX.padding * 2
  const panelHeight = textHeight + NATIVE_NOTEBOX.padding * 2
  return {
    panelHeight,
    panelLeft: NATIVE_NOTEBOX.centerX - panelWidth / 2,
    panelTop: NATIVE_NOTEBOX.centerY - panelHeight / 2,
    panelWidth,
    textHeight,
    textLeft: NATIVE_NOTEBOX.padding,
    textBaseline: NATIVE_NOTEBOX.padding + NATIVE_NOTEBOX.textBaselineOffset,
    textWidth,
  }
}

function nativeNoteboxHoldMs(kind: NativeNoteboxKind): number {
  return kind === 'failure'
    ? NATIVE_NOTEBOX.failureHoldMs
    : NATIVE_NOTEBOX.instructionHoldMs
}
