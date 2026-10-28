import { Container, FillGradient, Graphics } from 'pixi.js'
import { PLAYER_HOTBAR_COUNT } from '../core-kernels/native-belt.ts'
import { modalHotbarLayout, type ModalHotbarPresentation } from '../hotbar-controls-presentation.ts'
import { NATIVE_HUD_BACKBUFFER, nativeHudModalSlideLayout } from '../native-hud-layout.ts'

/** Canvas decoration stays in the belt painter lane; DOM owns only its hit targets. */
export class ModalHotbarControlsView {
  readonly container = new Container({ label: 'modal-hotbar-controls', eventMode: 'none' })
  private readonly art = new Graphics()
  private readonly gradient = new FillGradient({
    colorStops: [{ color: 0x29261b, offset: 0 }, { color: 0x090a08, offset: 1 }],
    start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, textureSpace: 'local',
  })

  constructor() {
    this.container.addChild(this.art)
    this.container.visible = false
  }

  setPresentation(presentation: ModalHotbarPresentation | null): void {
    this.container.visible = presentation !== null
    this.art.clear()
    if (!presentation) return
    const layout = modalHotbarLayout(nativeHudModalSlideLayout(
      NATIVE_HUD_BACKBUFFER.width, NATIVE_HUD_BACKBUFFER.height, 0,
    ).belt)
    for (const direction of [-1, 1]) {
      const x = direction === -1 ? layout.previous : layout.next
      const y = layout.top
      const highlighted = !presentation.disabled
        && (presentation.hovered === direction || presentation.focused === direction)
      const alpha = presentation.disabled ? 0.4 : 1
      this.art.roundRect(x + 0.5, y + 0.5, 33, 31, 3)
        .fill({ color: highlighted ? 0x302a19 : 0xffffff, fill: highlighted ? undefined : this.gradient, alpha })
        .stroke({ color: highlighted ? 0xf0d78f : 0xb89b57, width: 1, alpha })
      if (!highlighted) this.art.roundRect(x + 2, y + 2, 30, 28, 2)
        .stroke({ color: 0x17160f, width: 2, alpha })
      this.art.moveTo(x + 17 - direction * 3, y + 10)
        .lineTo(x + 17 + direction * 3, y + 16)
        .lineTo(x + 17 - direction * 3, y + 22)
        .stroke({ color: 0xe9d293, width: 3, alpha })
      if (!presentation.disabled && presentation.focused === direction) {
        this.art.roundRect(x - 4, y - 4, 42, 40, 6).stroke({ color: 0xf0d78f, width: 2 })
      }
    }
    for (let bank = 0; bank < PLAYER_HOTBAR_COUNT; bank += 1) {
      const x = NATIVE_HUD_BACKBUFFER.width / 2 + (bank - 1) * 20
      const y = layout.dotsTop + 5.5
      const active = bank === presentation.bank
      if (active) {
        this.art.circle(x, y, 9).fill({ color: 0xd0ae64, alpha: 0.08 })
          .circle(x, y, 7).fill({ color: 0xd0ae64, alpha: 0.12 })
      }
      this.art.circle(x, y, 5).fill(active ? 0xd0ae64 : 0x0c0d09)
        .stroke({ color: 0xb89b57, width: 1 })
    }
  }

  destroy(): void {
    this.container.destroy({ children: true })
    this.gradient.destroy()
  }
}
