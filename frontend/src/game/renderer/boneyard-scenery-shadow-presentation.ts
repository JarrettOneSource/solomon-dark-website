import { Container, MeshSimple, type ContainerChild, type Texture } from 'pixi.js'
import type { MainLayer } from '../../editor/native-render-plan.ts'
import type { BoneyardGoodieSnapshot } from '../protocol/game-state.ts'
import type { BoneyardComplexShadowStaticCaster } from './boneyard-complex-shadow-presentation.ts'
import type { ResidentTexture } from './boneyard-renderer-model.ts'
import { destroyOwnedMeshGeometry } from './destroy-owned-mesh-geometry.ts'
import { nativePackedColor, setNativeVertexColors } from './native-material-batch.ts'
import {
  nativeGoodieShadowPlan, nativeSceneryShadowPlan, nativeWallSkirtPlan,
  type NativeSceneryShadowQuad,
} from './native-scenery-shadow.ts'

export interface NativeGoodieShadowOwner {
  readonly goodie: BoneyardGoodieSnapshot
  readonly depthOwner: ContainerChild
}

export interface BoneyardSceneryShadowFrame {
  activeMeshCount: number
  casterCount: number
  pooledMeshCount: number
  quadCount: number
  zOrderMismatchCount: number
  familyQuads: Record<string, number>
  directionalFamilyCasters: Record<string, number>
  directionalCasterIds: readonly string[]
  goodies: readonly { id: number; phase: number; mode: 'directional' | 'glyph'; owner: string }[]
}

interface ShadowPart {
  readonly mesh: MeshSimple
  readonly positions: Float32Array
  readonly uvs: Float32Array
  readonly colors: Uint32Array
}

interface ShadowView {
  readonly container: Container
  readonly parts: ShadowPart[]
  plan: readonly NativeSceneryShadowQuad[] | null
  goodieKey: { phase: number; subtype: number; x: number; y: number } | null
}

interface StaticPlan {
  readonly on: readonly NativeSceneryShadowQuad[]
  readonly off: readonly NativeSceneryShadowQuad[]
  readonly family: string
}

/** Native class masks own their original pixels and the same painter slot as the main owner. */
export class BoneyardSceneryShadowPresentation {
  private readonly plans = new Map<ContainerChild, StaticPlan>()
  private readonly directionalIds = new Map<ContainerChild, string>()
  private readonly active = new Map<ContainerChild, ShadowView>()
  private readonly free: ShadowView[] = []
  private readonly live = new Set<ContainerChild>()
  private readonly texture: (key: NativeSceneryShadowQuad['texture']) => Texture

  constructor(
    mainLayers: readonly MainLayer[],
    residents: ReadonlyMap<number, ResidentTexture>,
    staticCasters: readonly BoneyardComplexShadowStaticCaster[],
    texture: (key: NativeSceneryShadowQuad['texture']) => Texture,
  ) {
    this.texture = texture
    for (const [index, resident] of residents) {
      const layer = mainLayers[index]!
      if (layer.kind === 'object' && layer.object.typeId === 2061) continue
      const on = nativeSceneryShadowPlan(layer, true)
      const off = nativeSceneryShadowPlan(layer, false)
      if (on.length === 0 && off.length === 0) continue
      this.plans.set(resident.sprite, { on, off, family: familyFor(layer) })
    }
    for (const { caster, depthOwner } of staticCasters) {
      this.directionalIds.set(depthOwner, caster.id)
      if (caster.program?.kind !== 'wall') continue
      const plan = [nativeWallSkirtPlan(caster.program.start, caster.program.end)]
      this.plans.set(depthOwner, { on: plan, off: plan, family: 'Wall' })
    }
  }

  render(
    visibleOwners: readonly ContainerChild[],
    complexShadows: boolean,
    goodies: readonly NativeGoodieShadowOwner[],
  ): BoneyardSceneryShadowFrame {
    const frame: BoneyardSceneryShadowFrame = {
      activeMeshCount: 0, casterCount: 0, pooledMeshCount: 0, quadCount: 0,
      zOrderMismatchCount: 0, familyQuads: {},
      directionalFamilyCasters: {}, directionalCasterIds: [],
      goodies: goodies.map(({ goodie, depthOwner }) => ({
        id: goodie.id, phase: goodie.phase,
        mode: complexShadows ? 'directional' : 'glyph', owner: depthOwner.label,
      })),
    }
    this.live.clear()
    for (const owner of visibleOwners) {
      const plans = this.plans.get(owner)
      if (plans) this.paint(owner, complexShadows ? plans.on : plans.off, plans.family, frame)
    }
    for (const { goodie, depthOwner } of goodies) {
      const previous = this.active.get(depthOwner)
      const key = previous?.goodieKey
      const unchanged = !complexShadows && key !== null && key !== undefined
        && key.subtype === goodie.subtype && key.phase === goodie.phase
        && key.x === goodie.position.x && key.y === goodie.position.y
      const plan = unchanged ? previous!.plan! : nativeGoodieShadowPlan(goodie, complexShadows)
      const view = this.paint(depthOwner, plan, 'Goodie', frame, `goodie:${goodie.id}`)
      if (view && !unchanged) {
        view.goodieKey = { phase: goodie.phase, subtype: goodie.subtype,
          x: goodie.position.x, y: goodie.position.y }
      }
    }
    for (const [owner, view] of this.active) {
      if (this.live.has(owner)) continue
      view.container.removeFromParent()
      view.container.renderable = false
      view.goodieKey = null
      this.free.push(view)
      this.active.delete(owner)
    }
    frame.pooledMeshCount = this.free.reduce((count, view) => count + view.parts.length, 0)
    return frame
  }

  destroy(): void {
    for (const view of [...this.active.values(), ...this.free]) {
      view.container.removeFromParent()
      for (const part of view.parts) {
        destroyOwnedMeshGeometry(part.mesh)
        part.mesh.destroy()
      }
      view.container.destroy()
    }
    this.active.clear()
    this.free.length = 0
    this.plans.clear()
    this.directionalIds.clear()
    this.live.clear()
  }

  private paint(owner: ContainerChild, plan: readonly NativeSceneryShadowQuad[], family: string,
    frame: BoneyardSceneryShadowFrame,
    directionalId = this.directionalIds.get(owner),
  ): ShadowView | null {
    const parent = owner.parent
    if (plan.length === 0 || !parent || !owner.renderable) return null
    this.live.add(owner)
    let view = this.active.get(owner)
    if (!view) {
      view = this.free.pop() ?? { container: new Container({ eventMode: 'none' }), parts: [], plan: null, goodieKey: null }
      view.plan = null
      view.goodieKey = null
      this.active.set(owner, view)
    }
    while (view.parts.length < plan.length) {
      const part = createPart(this.texture(plan[view.parts.length]!.texture))
      view.parts.push(part)
      view.container.addChild(part.mesh)
    }
    if (view.plan !== plan) {
      view.goodieKey = null
      for (let index = 0; index < view.parts.length; index += 1) {
        const part = view.parts[index]!, quad = plan[index]
        part.mesh.renderable = quad !== undefined
        if (!quad) continue
        part.mesh.texture = this.texture(quad.texture)
        part.mesh.label = `${quad.role}:${quad.texture}`
        for (let vertex = 0; vertex < 4; vertex += 1) {
          part.positions[vertex * 2] = quad.vertices[vertex]!.x
          part.positions[vertex * 2 + 1] = quad.vertices[vertex]!.y
          part.uvs[vertex * 2] = quad.uvs[vertex]!.x
          part.uvs[vertex * 2 + 1] = quad.uvs[vertex]!.y
          part.colors[vertex] = nativePackedColor(quad.tint, quad.alphas[vertex]!)
        }
        part.mesh.geometry.getBuffer('aPosition').update()
        part.mesh.geometry.getBuffer('aUV').update()
        part.mesh.geometry.getBuffer('aColor').update()
      }
      view.plan = plan
    }
    const container = view.container
    container.label = `scenery-shadow:${family}:${owner.label}`
    container.renderable = true
    container.zIndex = owner.zIndex
    const ownerIndex = parent.getChildIndex(owner)
    const previous = parent.children[ownerIndex - 1]
    const directional = previous?.label === `complex-shadow:${directionalId}`
    const targetIndex = ownerIndex - (directional ? 1 : 0)
    if (container.parent !== parent) {
      container.removeFromParent()
      parent.addChildAt(container, targetIndex)
    } else {
      const index = parent.getChildIndex(container)
      if (index !== targetIndex - 1) parent.setChildIndex(container, index < targetIndex ? targetIndex - 1 : targetIndex)
    }
    frame.activeMeshCount += plan.length
    frame.casterCount += 1
    frame.quadCount += plan.length
    for (const quad of plan) {
      const key = `${family}:${quad.role}`
      frame.familyQuads[key] = (frame.familyQuads[key] ?? 0) + 1
    }
    const boundary = directional ? parent.getChildIndex(previous!) : parent.getChildIndex(owner)
    if (container.zIndex !== owner.zIndex || parent.getChildIndex(container) !== boundary - 1) {
      frame.zOrderMismatchCount += 1
    }
    return view
  }
}

function createPart(texture: Texture): ShadowPart {
  const positions = new Float32Array(8), uvs = new Float32Array(8), colors = new Uint32Array(4)
  const mesh = new MeshSimple({ texture, vertices: positions, uvs,
    indices: new Uint32Array([0, 1, 2, 1, 3, 2]), topology: 'triangle-list' })
  mesh.autoUpdate = false
  mesh.eventMode = 'none'
  setNativeVertexColors(mesh, colors)
  return { mesh, positions, uvs, colors }
}

function familyFor(layer: MainLayer): string {
  if (layer.kind === 'fence') return layer.part === 'post' ? 'Fencepost'
    : (layer.fence.segmentCode ?? layer.fence.style ?? 0) === 4 ? 'Rails' : 'FenceGrate'
  return ({ 2001: 'Tree', 2029: 'Gravestone', 2009: 'Monument', 2040: 'Building' } as Record<number, string>)[layer.object.typeId] ?? 'Scenery'
}
