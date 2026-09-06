import { Container, Graphics, Sprite, type Texture } from 'pixi.js'
import { nativeCrowBlindnessOpacity } from '../core-kernels/native-crow-blindness.ts'
import { createNativeRng, drawNativeFloat } from '../core-kernels/native-rng.ts'
import { nativeEnemySpriteRecord } from './native-enemy-assets.ts'

export class NativeCrowBlindnessView {
  private readonly container = new Container({ label: 'crow-blindness' })
  private readonly cover = new Graphics({ label: 'crow-blindness-cover' })
  private readonly stamp: Sprite
  private width = 0
  private height = 0

  constructor(root: Container, texture: Texture) {
    this.container.eventMode = 'none'
    this.container.visible = false
    this.stamp = new Sprite(texture)
    const record = nativeEnemySpriteRecord('DeadHawg', 1)
    this.stamp.anchor.set(record.anchorX / record.width, record.anchorY / record.height)
    this.stamp.scale.set(1.25)
    this.container.addChild(this.cover, this.stamp)
    root.addChild(this.container)
  }

  update(ticksRemaining: number, frame: number, viewport: Readonly<{ width: number; height: number }>): void {
    const opacity = nativeCrowBlindnessOpacity(ticksRemaining)
    this.container.visible = opacity.cover > 0
    if (!this.container.visible) return
    if (viewport.width !== this.width || viewport.height !== this.height) {
      this.width = viewport.width
      this.height = viewport.height
      this.cover.clear().rect(0, 0, this.width, this.height).fill(0)
    }
    const flicker = drawNativeFloat(createNativeRng(Math.floor(frame)), .19999998807907104)
    const radius = drawNativeFloat(flicker.state, 2)
    const angle = drawNativeFloat(radius.state, 360)
    const radians = angle.value * Math.PI / 180
    this.cover.alpha = opacity.cover
    this.stamp.alpha = opacity.stamp * (.800000011920929 + flicker.value)
    this.stamp.position.set(this.width / 2 + Math.sin(radians) * radius.value,
      this.height / 2 - Math.cos(radians) * radius.value)
  }

  destroy(): void {
    this.container.removeFromParent()
    this.container.destroy({ children: true })
  }
}
