import { Container, Sprite, type Texture } from 'pixi.js'

import type { Vector2 } from '../core-kernels/vector.ts'
import type { NativeLevelUpPresentationFrame } from './level-up-presentation.ts'
import { nativeEnemySpriteGeometry } from './native-enemy-assets.ts'

export class NativeLevelUpWorldView {
  readonly container = new Container({ label: 'local-player-level-up' })
  private readonly particles: Sprite[] = []
  private readonly texture: Texture

  constructor(texture: Texture) {
    this.texture = texture
    this.container.eventMode = 'none'
    this.container.renderable = false
  }

  get particleCount(): number {
    if (!this.container.renderable) return 0
    return this.particles.filter((particle) => particle.renderable && particle.alpha > 0).length
  }

  update(
    frame: NativeLevelUpPresentationFrame | null,
    position: Vector2,
    depth: number,
  ): void {
    this.container.position.copyFrom(position)
    this.container.zIndex = depth
    this.container.renderable = frame !== null && frame.particles.length > 0
    if (!frame) return
    while (this.particles.length < frame.particles.length) {
      const record = nativeEnemySpriteGeometry('BadGuys', 73)
      const particle = new Sprite(this.texture)
      particle.anchor.set(record.anchorX / record.width, record.anchorY / record.height)
      particle.blendMode = 'add'
      particle.eventMode = 'none'
      this.particles.push(particle)
      this.container.addChild(particle)
    }
    for (let index = 0; index < this.particles.length; index += 1) {
      const particle = this.particles[index]!
      const sample = frame.particles[index]
      particle.renderable = sample !== undefined
      if (!sample) continue
      particle.alpha = sample.alpha
      particle.label = `${sample.atlas}:${sample.entry}`
      particle.position.set(sample.offsetX, sample.offsetY)
      particle.rotation = sample.rotationRadians
      particle.scale.set(sample.scale)
    }
  }

  destroy(): void {
    this.container.destroy({ children: true })
    this.particles.length = 0
  }
}
