import { Container, Matrix, Sprite, type Renderer, type Texture } from 'pixi.js'
import { nativeCocoonTilt, type NativeWebbedState } from '../core-kernels/native-webbed.ts'
import type { ProtocolPlayerState } from '../protocol/game-state.ts'
import { nativeEnemySpriteRegistration } from './native-enemy-sprite-registration.ts'
import { NativePlayerDiffuseCapture } from './native-player-diffuse-capture.ts'

export class PlayerWebbedView {
  readonly container = new Container({ label: 'player-webbed', eventMode: 'none', zIndex: 8 })
  private readonly capture: NativePlayerDiffuseCapture
  private readonly composites: Sprite[] = []
  private readonly cocoon: Sprite
  private readonly hit: Sprite
  private readonly record = nativeEnemySpriteRegistration('DeadHawg', 29)

  constructor(cocoon: Texture, renderer: Pick<Renderer, 'render'>) {
    this.capture = new NativePlayerDiffuseCapture(renderer)
    this.container.visible = false
    this.cocoon = new Sprite({ texture: cocoon, label: 'player-cocoon', eventMode: 'none' })
    this.hit = new Sprite({ texture: cocoon, label: 'player-cocoon-hit', tint: 0xff0000, eventMode: 'none' })
    for (const sprite of [this.cocoon, this.hit]) {
      sprite.anchor.set(this.record.anchorX / this.record.width, this.record.anchorY / this.record.height)
      sprite.visible = false
      this.container.addChild(sprite)
    }
  }

  update(
    player: ProtocolPlayerState,
    web: NativeWebbedState | undefined,
    source: Container,
    excluded: readonly Container[],
    higherPriorityMaterial: boolean,
  ): void {
    this.container.visible = false
    if (web === undefined || higherPriorityMaterial || player.progression.lifeState === 'dying'
      || player.progression.lifeState === 'spectating') return
    const target = this.capture.render(source, excluded)
    if (this.composites.length === 0) {
      for (let index = 0; index < 3; index += 1) {
        const composite = new Sprite({ texture: target, label: `player-webbed:${index}`, eventMode: 'none' })
        composite.anchor.set(0.5)
        composite.position.set(0, -25)
        composite.scale.set(Math.fround(1 + Math.fround(0.05) * index))
        composite.blendMode = 'add'
        this.composites.push(composite)
        this.container.addChildAt(composite, index)
      }
    }
    for (let index = 0; index < this.composites.length; index += 1) {
      this.composites[index].alpha = Math.max(0, Math.min(1, web.severity - index))
      this.composites[index].visible = index < web.severity
    }
    this.cocoon.visible = web.severity >= 3
    this.hit.visible = this.cocoon.visible && web.hitPulse > 0
    if (this.cocoon.visible) {
      const tilt = nativeCocoonTilt(player.headingIndex * 15)
      const bottom = this.record.height - this.record.anchorY
      const matrix = new Matrix(
        1, 0, -tilt.x / this.record.height, 1 - tilt.y / this.record.height,
        tilt.x * bottom / this.record.height, -20 + tilt.y * bottom / this.record.height,
      )
      this.cocoon.setFromMatrix(matrix)
      this.hit.setFromMatrix(matrix)
      this.hit.alpha = web.hitPulse
    }
    this.container.visible = true
  }

  destroy(): void {
    this.container.destroy({ children: true })
    this.capture.destroy()
    this.composites.length = 0
  }
}
