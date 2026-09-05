import { Container, Matrix, RenderTexture, Sprite, type Renderer, type Texture } from 'pixi.js'
import { playerCharacterHeadOffset } from '../player-character-presentation.ts'
import type { ProtocolPlayerState } from '../protocol/game-state.ts'
import { renderNativeDiffuseMask } from './native-texture-color.ts'

export const NATIVE_HARDEN_TARGET_SIZE = 256
export const NATIVE_HARDEN_COMPOSITE_SCALE = 1.1200000047683716
export const NATIVE_HARDEN_COMPOSITE_TINT = 0x3fbfff

/** PlayerWizard::DrawSpecial captures the current articulated draw, including equipment. */
export class PlayerHardenView {
  readonly container = new Container({ label: 'player-harden-coating' })
  private readonly iceSource = new Container({ label: 'player-harden-ice-multiply' })
  private readonly ice: Sprite
  private readonly captureTransform = new Matrix(1, 0, 0, 1, 128, 153)
  private readonly renderer: Pick<Renderer, 'render'>
  private readonly composites: Sprite[] = []
  private target: RenderTexture | null = null

  constructor(ice: Texture, renderer: Pick<Renderer, 'render'>) {
    this.renderer = renderer
    this.container.visible = false
    this.container.eventMode = 'none'
    this.container.zIndex = 8
    this.iceSource.eventMode = 'none'
    this.ice = new Sprite(ice)
    this.ice.anchor.set(0.5)
    this.ice.blendMode = 'multiply'
    this.iceSource.addChild(this.ice)
  }

  update(player: ProtocolPlayerState, source: Container, excluded: readonly Container[], stoneskin: boolean): void {
    this.container.visible = false
    const coating = player.progression.hardenCoating
    if (coating <= 0 || stoneskin || player.progression.lifeState === 'dying'
      || player.progression.lifeState === 'spectating') return
    if (this.target === null) {
      this.target = RenderTexture.create({
        alphaMode: 'no-premultiply-alpha',
        dynamic: true,
        height: NATIVE_HARDEN_TARGET_SIZE,
        resolution: 1,
        scaleMode: 'linear',
        width: NATIVE_HARDEN_TARGET_SIZE,
      })
      for (let index = 0; index < 3; index += 1) {
        const composite = new Sprite(this.target)
        composite.anchor.set(0.5)
        composite.blendMode = 'add'
        composite.eventMode = 'none'
        composite.label = `player-harden-coating:${index}`
        composite.position.set(0, -25)
        composite.scale.set(NATIVE_HARDEN_COMPOSITE_SCALE)
        composite.tint = NATIVE_HARDEN_COMPOSITE_TINT
        this.container.addChild(composite)
        this.composites.push(composite)
      }
    }
    const visibility = excluded.map((child) => child.visible)
    for (const child of excluded) child.visible = false
    try {
      renderNativeDiffuseMask(this.renderer, {
        clear: true,
        clearColor: [1, 1, 1, 0],
        container: source,
        target: this.target,
        transform: this.captureTransform,
      })
    } finally {
      excluded.forEach((child, index) => { child.visible = visibility[index]! })
    }
    const headOffset = playerCharacterHeadOffset(player.headingIndex, player.gaitDegrees)
    this.ice.position.set(128 + headOffset.x, 128 + headOffset.y)
    this.ice.angle = player.headingIndex * 24
    this.renderer.render({ clear: false, container: this.iceSource, target: this.target })
    for (const composite of this.composites) {
      composite.alpha = Math.fround(coating * 0.699999988079071)
    }
    this.container.visible = true
  }

  destroy(): void {
    this.container.destroy({ children: true })
    this.iceSource.destroy({ children: true })
    this.target?.destroy(true)
    this.target = null
    this.composites.length = 0
  }
}
