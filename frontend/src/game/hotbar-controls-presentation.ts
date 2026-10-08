import type { NativeHudRect } from './native-hud-layout.ts'

export interface ModalHotbarPresentation {
  readonly bank: number
  readonly disabled: boolean
  readonly hovered: number | null
  readonly focused: number | null
}

export interface ModalHotbarRenderer {
  setHotbarControls(presentation: ModalHotbarPresentation | null): void
}

/** The approved web bank controls use the same geometry in both optional books. */
export function modalHotbarLayout(belt: readonly NativeHudRect[]) {
  return {
    top: belt[0]!.y + 10,
    previous: belt[0]!.x - 46,
    next: belt[7]!.x + belt[7]!.width + 12,
    dotsTop: belt[0]!.y - 19,
  }
}
