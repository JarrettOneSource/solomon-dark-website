import { Container, MeshSimple, Texture } from 'pixi.js'
import type { Vector2 } from '../core-kernels/vector.ts'
import { nativeLineColor, nativeLineVertices } from '../core-kernels/native-line.ts'
import { createNativeRng } from '../core-kernels/native-rng.ts'
import { nativeSilkMesh } from '../core-kernels/native-silk-presentation.ts'
import type { NativeFadeLineActor, NativeFadeLineState } from '../core-kernels/native-silk-force.ts'
import type { BoneyardSilkSnapshot } from '../protocol/spider-state.ts'
import { setNativeVertexColors } from './native-material-batch.ts'

interface GradientMeshPlan {
  readonly vertices: readonly number[]
  readonly colors: readonly number[]
  readonly indices: readonly number[]
}

export class NativeSpiderWebViews {
  private readonly root: Container
  private readonly views = new Map<string, GradientMeshView>()
  private readonly liveIds = new Set<string>()

  constructor(root: Container) {
    this.root = root
  }

  update(
    silks: readonly BoneyardSilkSnapshot[],
    fragments: readonly NativeFadeLineActor[],
    presentationFrame: number,
    lightAt: (position: Readonly<Vector2>) => number,
  ): void {
    this.liveIds.clear()
    for (const silk of silks) {
      const plan = nativeSilkMesh(silk.state, lightAt, createNativeRng(silk.id ^ Math.trunc(presentationFrame)))
      this.updateMesh(`silk:${silk.id}`, this.root, plan)
    }
    for (const fragment of fragments) {
      this.updateMesh(`silk-fragment:${fragment.id}`, this.root, fadeLineMesh(fragment.state))
    }
    for (const [id, view] of this.views) {
      if (this.liveIds.has(id)) continue
      view.destroy()
      this.views.delete(id)
    }
  }

  setSilkDepth(id: number, depth: number): void {
    const view = this.views.get(`silk:${id}`)
    if (view) view.mesh.zIndex = depth
  }

  setFragmentDepth(depth: number): void {
    for (const [id, view] of this.views) if (id.startsWith('silk-fragment:')) view.mesh.zIndex = depth
  }

  destroy(): void {
    for (const view of this.views.values()) view.destroy()
    this.views.clear()
    this.liveIds.clear()
  }

  private updateMesh(id: string, root: Container, plan: GradientMeshPlan): void {
    this.liveIds.add(id)
    let view = this.views.get(id)
    if (!view) {
      view = new GradientMeshView(root, id)
      this.views.set(id, view)
    }
    view.update(plan)
  }
}

class GradientMeshView {
  readonly mesh: MeshSimple
  private vertices = new Float32Array(8)
  private colors = new Uint32Array(4)
  private indices = new Uint32Array(6)

  constructor(root: Container, label: string) {
    this.mesh = new MeshSimple({
      label, texture: Texture.WHITE, topology: 'triangle-list',
      vertices: this.vertices, indices: this.indices, uvs: new Float32Array(8),
    })
    this.mesh.eventMode = 'none'
    this.mesh.zIndex = 0.5
    setNativeVertexColors(this.mesh, this.colors)
    root.addChild(this.mesh)
  }

  update(plan: GradientMeshPlan): void {
    if (plan.vertices.length > this.vertices.length) {
      let capacity = this.vertices.length
      while (capacity < plan.vertices.length) capacity *= 2
      this.vertices = new Float32Array(capacity)
      this.colors = new Uint32Array(capacity / 2)
      this.indices = new Uint32Array(capacity / 8 * 6)
      this.mesh.vertices = this.vertices
      this.mesh.geometry.getBuffer('aUV').data = new Float32Array(capacity)
      this.mesh.geometry.getIndex().data = this.indices
      setNativeVertexColors(this.mesh, this.colors)
    }
    this.vertices.set(plan.vertices)
    this.colors.set(plan.colors)
    this.indices.fill(0)
    this.indices.set(plan.indices)
    this.mesh.geometry.getIndex().update()
    this.mesh.visible = plan.indices.length !== 0
  }

  destroy(): void {
    this.mesh.removeFromParent()
    this.mesh.destroy()
  }
}

function fadeLineMesh(state: NativeFadeLineState): GradientMeshPlan {
  const vertices: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  const transparent = nativeLineColor(1, 1, 1, 0)
  append(state.start, state.middle, transparent, nativeLineColor(1, 1, 1, Math.min(1, state.opacity)))
  append(state.middle, state.end, nativeLineColor(1, 1, 1, state.opacity), transparent)
  return { vertices, colors, indices }

  function append(start: Readonly<Vector2>, end: Readonly<Vector2>, first: number, second: number): void {
    if (start.x === end.x && start.y === end.y) return
    const offset = vertices.length / 2
    vertices.push(...nativeLineVertices(start, end, 2))
    colors.push(first, first, second, second)
    indices.push(offset, offset + 1, offset + 2, offset + 1, offset + 2, offset + 3)
  }
}
