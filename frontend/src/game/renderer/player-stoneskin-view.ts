import { Container, Mesh, MeshGeometry, Sprite, type Renderer, type Texture } from 'pixi.js'
import { nativeStoneskinGeometry } from '../core-kernels/native-stoneskin.ts'
import { playerCharacterHeadOffset } from '../player-character-presentation.ts'
import type { ProtocolPlayerState } from '../protocol/game-state.ts'
import { NativePlayerDiffuseCapture } from './native-player-diffuse-capture.ts'
import { destroyOwnedMeshGeometry } from './destroy-owned-mesh-geometry.ts'

/** PlayerWizard::DrawSpecial 0x546D99 changes only the retained material's painter. */
export class PlayerStoneskinView {
  readonly container = new Container({ label: 'player-stoneskin', eventMode: 'none' })
  private readonly material = new Container({ label: 'player-stoneskin-material', eventMode: 'none' })
  private readonly stone: Sprite
  private readonly capture: NativePlayerDiffuseCapture
  private readonly renderer: Pick<Renderer, 'render'>
  private readonly composites: Mesh[] = []
  private geometry: MeshGeometry | null = null
  private positions: readonly number[] | null = null
  private enhancedEffects = true

  constructor(texture: Texture, renderer: Pick<Renderer, 'render'>) {
    this.renderer = renderer
    this.capture = new NativePlayerDiffuseCapture(renderer)
    this.container.visible = false
    this.container.zIndex = 8
    this.stone = new Sprite(texture)
    this.stone.anchor.set(.5)
    this.stone.blendMode = 'multiply'
    this.material.addChild(this.stone)
  }

  update(player: ProtocolPlayerState, source: Container, excluded: readonly Container[],
    active: boolean, positions: readonly number[] | null, enhancedEffects: boolean): void {
    this.container.visible = false
    if (!active || player.progression.lifeState !== 'alive') return
    if (positions === null) throw new Error('active native Stoneskin has no shared birth grid')
    const target = this.capture.render(source, excluded)
    if (this.geometry === null || this.enhancedEffects !== enhancedEffects
      || this.positions === null || positions.some((value, index) => value !== this.positions![index])) {
      const previous = this.geometry
      this.geometry = new MeshGeometry(nativeStoneskinGeometry(positions, enhancedEffects))
      this.positions = positions
      this.enhancedEffects = enhancedEffects
      if (this.composites.length === 0) {
        for (let pass = 0; pass < 2; pass++) {
          const mesh = new Mesh({ geometry: this.geometry, texture: target })
          mesh.label = `player-stoneskin-pass:${pass}`
          mesh.eventMode = 'none'
          mesh.position.set(0, -25)
          this.composites.push(mesh)
          this.container.addChild(mesh)
        }
      } else {
        for (const mesh of this.composites) mesh.geometry = this.geometry
      }
      if (previous) destroyOwnedMeshGeometry({ geometry: previous })
    }
    const offset = playerCharacterHeadOffset(player.headingIndex, player.gaitDegrees)
    this.stone.position.set(128 + offset.x, 128 + offset.y)
    this.stone.angle = player.headingIndex * 24
    this.renderer.render({ clear: false, container: this.material, target })
    this.container.visible = true
  }

  destroy(): void {
    this.container.destroy({ children: true })
    if (this.geometry) destroyOwnedMeshGeometry({ geometry: this.geometry })
    this.material.destroy({ children: true })
    this.capture.destroy()
    this.geometry = null
    this.positions = null
    this.composites.length = 0
  }
}
