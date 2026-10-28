import { Container, type Sprite } from 'pixi.js'
import type { NativeGroundGlyphPlan } from '../core-kernels/native-ground-auxiliary.ts'

/** One +28 product; its owner updates/disposes it independently of body art. */
export class NativeGroundGlyphView {
  readonly container = new Container({ label: 'native-ground-glyph', eventMode: 'none' })
  private readonly sprite: Sprite

  constructor(sprite: Sprite) {
    this.sprite = sprite
    this.container.zIndex = 1
    this.container.addChild(sprite)
  }

  update(plan: NativeGroundGlyphPlan | null): void {
    this.container.visible = plan !== null
    if (plan === null) return
    this.container.position.copyFrom(plan.position)
    this.sprite.scale.set(plan.scaleX, plan.scaleY)
    this.sprite.alpha = plan.alpha
  }

  prepareForPool(): void {
    this.container.visible = false
  }

  destroy(): void {
    this.container.destroy({ children: true })
  }
}
