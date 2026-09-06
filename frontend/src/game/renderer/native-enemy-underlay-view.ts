import { Container, MeshSimple } from 'pixi.js'
import type { BoneyardPoint } from '../core-kernels/boneyard.ts'
import type { BoneyardWorldTextures } from './boneyard-textures.ts'
import { nativeEnemySpriteRecord } from './native-enemy-assets.ts'
import type { NativeEnemyUnderlayLayer } from './native-enemy-underlay.ts'
import { nativePackedColor, setNativeVertexColors } from './native-material-batch.ts'

interface UnderlayMesh {
  readonly colors: Uint32Array
  readonly mesh: MeshSimple
  readonly positions: Float32Array
}

export class NativeEnemyUnderlayView {
  readonly container: Container
  private readonly layers: Container
  private readonly meshes: UnderlayMesh[] = []
  private readonly textures: BoneyardWorldTextures
  private count = 0

  constructor(parent: Container, textures: BoneyardWorldTextures, label: string) {
    this.textures = textures
    this.container = new Container({ label })
    this.container.eventMode = 'none'
    this.layers = new Container()
    this.layers.eventMode = 'none'
    this.container.addChild(this.layers)
    parent.addChild(this.container)
  }

  update(position: Readonly<BoneyardPoint>, plan: readonly NativeEnemyUnderlayLayer[], registrationOrdinal: number): void {
    this.container.position.set(position.x, position.y)
    this.container.zIndex = registrationOrdinal
    this.count = plan.length
    for (const [index, layer] of plan.entries()) {
      const source = nativeEnemySpriteRecord(layer.atlas, layer.entry).source
      const texture = this.textures.base[source]
      if (!texture) throw new Error(`Native enemy underlay texture was not loaded: ${source}`)
      let view = this.meshes[index]
      if (!view) {
        const positions = new Float32Array(8)
        const colors = new Uint32Array(4)
        const mesh = new MeshSimple({ texture, vertices: positions,
          uvs: new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
          indices: new Uint32Array([0, 1, 2, 1, 3, 2]), topology: 'triangle-list' })
        mesh.eventMode = 'none'
        setNativeVertexColors(mesh, colors)
        view = { mesh, colors, positions }
        this.meshes.push(view)
        this.layers.addChild(mesh)
      }
      view.mesh.label = layer.role
      view.mesh.texture = texture
      view.mesh.blendMode = layer.blendMode
      view.mesh.renderable = true
      for (let vertex = 0; vertex < 4; vertex += 1) {
        view.positions[vertex * 2] = layer.vertices[vertex]!.x
        view.positions[vertex * 2 + 1] = layer.vertices[vertex]!.y
        view.colors[vertex] = nativePackedColor(layer.tint, layer.alphas[vertex]!)
      }
    }
    for (let index = plan.length; index < this.meshes.length; index += 1) this.meshes[index]!.mesh.renderable = false
  }

  get layerCount(): number { return this.count }

  setRenderable(value: boolean): void { this.container.renderable = value }

  destroy(): void {
    for (const view of this.meshes) view.mesh.geometry.destroy()
    this.container.removeFromParent()
    this.container.destroy({ children: true })
    this.meshes.length = 0
  }
}
