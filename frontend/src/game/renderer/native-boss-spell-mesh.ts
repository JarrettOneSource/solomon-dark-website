import { MeshSimple, Texture } from 'pixi.js'
import type { NativeBossSpell } from '../core-kernels/native-boss-spell.ts'
import { nativePackedColor, setNativeVertexColors } from './native-material-batch.ts'
import { nativeUltraBanishPlan } from './native-ultra-banish-presentation.ts'

type MeshSpell = Extract<NativeBossSpell, { kind: 'ultra-banish' | 'mouth-beam-segment' }>

export class NativeBossSpellMesh {
  readonly mesh: MeshSimple
  private readonly vertices: Float32Array
  private readonly colors: Uint32Array
  private readonly uvs: Float32Array

  constructor(spell: MeshSpell, texture: Texture) {
    const count = spell.kind === 'ultra-banish' ? 12 : 1
    this.vertices = new Float32Array(count * 8)
    this.colors = new Uint32Array(count * 4)
    this.uvs = new Float32Array(count * 8)
    const indices = new Uint32Array(count * 6)
    for (let quad = 0; quad < count; quad += 1) {
      const vertex = quad * 4
      indices.set([vertex, vertex + 1, vertex + 2, vertex + 1, vertex + 3, vertex + 2], quad * 6)
      this.uvs.set([0, 0, 1, 0, 0, 1, 1, 1], quad * 8)
    }
    if (spell.kind === 'mouth-beam-segment') this.uvs.set([
      0, spell.uvOffset, 1, spell.uvOffset, 0, spell.uvOffset + 1, 1, spell.uvOffset + 1,
    ])
    this.mesh = new MeshSimple({ texture: spell.kind === 'ultra-banish' ? Texture.WHITE : texture,
      vertices: this.vertices, uvs: this.uvs, indices, topology: 'triangle-list' })
    this.mesh.label = `boss:${spell.kind}`
    this.mesh.eventMode = 'none'
    this.mesh.blendMode = 'add'
    setNativeVertexColors(this.mesh, this.colors)
  }

  update(spell: MeshSpell, tick: number, viewHeight: number): void {
    if (spell.kind === 'mouth-beam-segment') {
      for (let index = 0; index < 4; index += 1) {
        const vertex = spell.vertices[index]!
        this.vertices[index * 2] = vertex.x - spell.position.x
        this.vertices[index * 2 + 1] = vertex.y - spell.position.y
        this.colors[index] = nativePackedColor(0xffffff, index < 2 ? spell.startAlpha : spell.endAlpha)
      }
      return
    }
    this.vertices.fill(0)
    this.colors.fill(0)
    const { gradients } = nativeUltraBanishPlan(spell, tick, viewHeight)
    for (const [index, rect] of gradients.entries()) {
      this.vertices.set([rect.x, rect.y, rect.x + rect.width, rect.y,
        rect.x, rect.y + rect.height, rect.x + rect.width, rect.y + rect.height], index * 8)
      this.colors.set([nativePackedColor(rect.startColor, rect.startAlpha), nativePackedColor(rect.startColor, rect.startAlpha),
        nativePackedColor(rect.endColor, rect.endAlpha), nativePackedColor(rect.endColor, rect.endAlpha)], index * 4)
    }
  }

  destroy(): void { this.mesh.geometry.destroy() }
}
