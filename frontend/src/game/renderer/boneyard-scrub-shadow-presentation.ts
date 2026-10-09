import { Container, MeshSimple, type Texture } from 'pixi.js'
import type { Vec2 } from '../../editor/model.ts'
import type { MainLayer } from '../../editor/native-render-plan.ts'
import type { BoneyardComplexShadowFrame } from './boneyard-complex-shadow-presentation.ts'
import { nativeBoneyardComplexShadowRecords } from './boneyard-complex-shadows.ts'
import type { NativeBoneyardLightSamples } from './boneyard-lighting.ts'
import type { ResidentTexture } from './boneyard-renderer-model.ts'
import { destroyOwnedMeshGeometry } from './destroy-owned-mesh-geometry.ts'
import { nativePackedColor, setNativeVertexColors } from './native-material-batch.ts'
import {
  NativeScrubShadowState, nativeScrubGlyph, nativeScrubShadowPlan,
  type NativeScrubGlyph, type NativeScrubShadowQuad,
} from './native-scrub-shadow.ts'

interface ScrubMesh {
  readonly colors: Uint32Array
  readonly mesh: MeshSimple
  readonly positions: Float32Array
  readonly uvs: Float32Array
}

interface ScrubView {
  readonly container: Container
  readonly glyph: NativeScrubGlyph
  readonly id: string
  readonly meshes: ScrubMesh[]
  readonly position: Vec2
  readonly resident: ResidentTexture
  readonly state: NativeScrubShadowState
}

/** Scrub::RenderShadow00620120 owns textured quads immediately before its main glyph. */
export class BoneyardScrubShadowPresentation {
  private readonly reflectionTexture: Texture
  private readonly root: Container
  private readonly views = new Map<ResidentTexture, ScrubView>()

  constructor(root: Container, mainLayers: readonly MainLayer[], residents: ReadonlyMap<number, ResidentTexture>, initialTick: number, reflectionTexture: Texture) {
    this.root = root
    this.reflectionTexture = reflectionTexture
    for (const [index, resident] of residents) {
      const layer = mainLayers[index]!
      if (layer.kind !== 'object' || layer.object.typeId !== 2062) continue
      this.views.set(resident, {
        container: new Container({ eventMode: 'none', label: `scrub-shadow:${layer.object.eid}` }),
        glyph: nativeScrubGlyph(layer.object.variant ?? 0),
        id: `scrub:${layer.object.eid}`,
        meshes: [],
        position: { ...layer.pos },
        resident,
        state: new NativeScrubShadowState(index, initialTick),
      })
    }
  }

  render(sources: NativeBoneyardLightSamples, presentationFrame: number, worldTick: number,
    visibleResidents: readonly ResidentTexture[], complexShadows: boolean, complexLighting: boolean,
    specialSurfaceAt: (point: Readonly<Vec2>) => boolean,
  ): BoneyardComplexShadowFrame {
    const frame: BoneyardComplexShadowFrame = {
      familyCasters: {}, casterIds: [],
      activeMeshCount: 0, allocatedQuadCapacity: 0, casterCount: 0,
      pooledMeshCount: 0, quadCount: 0, recordCount: 0, zOrderMismatchCount: 0,
    }
    const visible = new Set(visibleResidents)
    for (const view of this.views.values()) {
      view.state.advanceTo(worldTick)
      const owner = view.resident.sprite
      const live = visible.has(view.resident) && owner.renderable && owner.parent === this.root
      const records = live && complexLighting && complexShadows
        ? nativeBoneyardComplexShadowRecords({ id: view.id, position: view.position, outline: [] }, sources, presentationFrame)
        : []
      const plan = live
        ? nativeScrubShadowPlan(view.glyph, view.position, view.state, records, complexShadows, specialSurfaceAt)
        : []
      frame.recordCount += records.length
      if (plan.length === 0) {
        view.container.removeFromParent()
        view.container.renderable = false
      } else {
        view.container.position.set(view.position.x, view.position.y)
        view.container.renderable = true
        for (const [index, quad] of plan.entries()) {
          let mesh = view.meshes[index]
          if (!mesh) {
            mesh = createScrubMesh(view.resident.texture)
            view.meshes.push(mesh)
            view.container.addChild(mesh.mesh)
          }
          mesh.mesh.texture = quad.role === 'scrub-surface-reflection' ? this.reflectionTexture : view.resident.texture
          updateScrubMesh(mesh, quad)
        }
        for (let index = plan.length; index < view.meshes.length; index += 1) {
          view.meshes[index]!.mesh.renderable = false
        }
        this.positionBeforeOwner(view)
        frame.casterCount += 1
        if (records.length > 0) {
          frame.familyCasters.Scrub = (frame.familyCasters.Scrub ?? 0) + 1
          frame.casterIds = [...frame.casterIds, view.id]
        }
        frame.quadCount += plan.length
        frame.activeMeshCount += plan.length
        if (view.container.zIndex !== owner.zIndex
          || this.root.getChildIndex(view.container) !== this.root.getChildIndex(owner) - 1) {
          frame.zOrderMismatchCount += 1
        }
      }
      frame.allocatedQuadCapacity += view.meshes.length
      frame.pooledMeshCount += view.meshes.length - plan.length
    }
    return frame
  }

  destroy(): void {
    for (const view of this.views.values()) {
      for (const mesh of view.meshes) destroyOwnedMeshGeometry(mesh.mesh)
      view.container.removeFromParent()
      view.container.destroy({ children: true })
    }
    this.views.clear()
  }

  private positionBeforeOwner(view: ScrubView): void {
    const owner = view.resident.sprite
    const container = view.container
    container.zIndex = owner.zIndex
    const ownerIndex = this.root.getChildIndex(owner)
    if (container.parent !== this.root) this.root.addChildAt(container, ownerIndex)
    else {
      const index = this.root.getChildIndex(container)
      if (index !== ownerIndex - 1) this.root.setChildIndex(container, index < ownerIndex ? ownerIndex - 1 : ownerIndex)
    }
  }
}

function createScrubMesh(texture: Texture): ScrubMesh {
  const positions = new Float32Array(8)
  const uvs = new Float32Array(8)
  const colors = new Uint32Array(4)
  const mesh = new MeshSimple({ texture, vertices: positions, uvs,
    indices: new Uint32Array([0, 1, 2, 1, 3, 2]), topology: 'triangle-list' })
  mesh.eventMode = 'none'
  setNativeVertexColors(mesh, colors)
  return { colors, mesh, positions, uvs }
}

function updateScrubMesh(view: ScrubMesh, quad: NativeScrubShadowQuad): void {
  view.mesh.label = quad.role
  view.mesh.renderable = true
  for (let vertex = 0; vertex < 4; vertex += 1) {
    view.positions[vertex * 2] = quad.vertices[vertex]!.x
    view.positions[vertex * 2 + 1] = quad.vertices[vertex]!.y
    view.uvs[vertex * 2] = quad.uvs[vertex]!.x
    view.uvs[vertex * 2 + 1] = quad.uvs[vertex]!.y
    view.colors[vertex] = nativePackedColor(quad.tint, quad.alphas[vertex]!)
  }
  view.mesh.geometry.getBuffer('aUV').update()
}
