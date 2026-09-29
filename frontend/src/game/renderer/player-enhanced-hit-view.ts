import { Container, Sprite, type Renderer } from 'pixi.js'
import { nativePuppetHitAlpha } from '../core-kernels/native-puppet-hit.ts'
import type { ProtocolPlayerState } from '../protocol/game-state.ts'
import { NativePlayerDiffuseCapture } from './native-player-diffuse-capture.ts'
import { multiplyNativeTints, nativePuppetHitTint } from './native-texture-color.ts'

/** Scene player vslot 0x5C calls Puppet::Present(0.45) only with FastCPU. */
export class PlayerEnhancedHitView {
  readonly container = new Container({ label: 'player-enhanced-hit', eventMode: 'none' })
  private readonly capture: NativePlayerDiffuseCapture
  private sprite: Sprite | null = null

  constructor(renderer: Pick<Renderer, 'render'>) {
    this.capture = new NativePlayerDiffuseCapture(renderer)
    this.container.visible = false
  }

  update(player: ProtocolPlayerState, tick: number, source: Container, excluded: readonly Container[],
    enhancedEffects: boolean, stoneskin: boolean, complexLighting: boolean, worldTint: number): void {
    this.container.visible = false
    if (!enhancedEffects || stoneskin || player.progression.lifeState !== 'alive') return
    const alpha = nativePuppetHitAlpha(player.progression.hitFeedback, tick, true)
    if (alpha <= 0) return
    const target = this.capture.render(source, excluded)
    if (this.sprite === null) {
      this.sprite = new Sprite({ texture: target, label: 'player-enhanced-hit-capture', eventMode: 'none' })
      this.sprite.anchor.set(.5)
      this.sprite.position.set(0, -25)
      this.container.addChild(this.sprite)
    }
    // 0x628D42 and 0x628D60 multiply every RGBA component, not only opacity.
    const gain = Math.fround(.45)
    this.sprite.tint = multiplyNativeTints(nativePuppetHitTint(complexLighting, worldTint), 0x737373)
    this.sprite.alpha = Math.fround(alpha * gain)
    this.container.position.copyFrom(source.position)
    this.container.visible = true
  }

  destroy(): void {
    this.container.destroy({ children: true })
    this.capture.destroy()
    this.sprite = null
  }
}
