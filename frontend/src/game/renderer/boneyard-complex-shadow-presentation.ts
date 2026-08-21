import {
  BufferImageSource,
  Container,
  MeshSimple,
  Texture,
  type ContainerChild,
} from 'pixi.js'

import { nativeGatePainterRoot } from '../../editor/native-fence-geometry.ts'
import type { BoneyardGateLeafSnapshot } from '../core-kernels/boneyard.ts'
import {
  NativeBoneyardShadowMeshBuffers,
  nativeBoneyardComplexShadowRecords,
  nativeBoneyardFenceGrateShadows,
  nativeBoneyardLineShadowEdge,
  nativeBoneyardProjectedShadowEdges,
  nativeBoneyardRailsShadows,
  nativeBoneyardShadowAlphaRampPixels,
  nativeBoneyardWallShadow,
  type NativeBoneyardComplexShadowCaster,
  type NativeBoneyardProjectedShadowEdge,
} from './boneyard-complex-shadows.ts'
import type { NativeBoneyardLightSamples } from './boneyard-lighting.ts'

export interface BoneyardComplexShadowStaticCaster {
  caster: NativeBoneyardComplexShadowCaster
  depthOwner: ContainerChild
}

export interface BoneyardComplexShadowFrame {
  activeMeshCount: number
  allocatedQuadCapacity: number
  casterCount: number
  pooledMeshCount: number
  quadCount: number
  recordCount: number
  zOrderMismatchCount: number
}

interface ActiveShadowView {
  buffers: NativeBoneyardShadowMeshBuffers
  mesh: MeshSimple
  uploadedIndexRevision: number
}

interface CasterGeometry {
  edges: NativeBoneyardProjectedShadowEdge[]
  recordCount: number
}

export class BoneyardComplexShadowPresentation {
  private readonly activeViews = new Map<string, ActiveShadowView>()
  private readonly alphaRamp: Texture
  private readonly freeViews: ActiveShadowView[] = []
  private readonly liveIds = new Set<string>()
  private readonly root: Container
  private readonly staticCastersByOwner = new Map<ContainerChild, NativeBoneyardComplexShadowCaster>()

  constructor(
    root: Container,
    staticCasters: readonly BoneyardComplexShadowStaticCaster[],
  ) {
    this.root = root
    for (const { caster, depthOwner } of staticCasters) {
      this.staticCastersByOwner.set(depthOwner, caster)
    }
    this.alphaRamp = shadowAlphaRampTexture()
  }

  render(
    sources: NativeBoneyardLightSamples,
    presentationFrame: number,
    gateLeaves: readonly BoneyardGateLeafSnapshot[],
    gateDepthOwners: ReadonlyMap<string, ContainerChild>,
    visibleStaticDepthOwners: readonly ContainerChild[],
    enabled = true,
  ): BoneyardComplexShadowFrame {
    const liveIds = this.liveIds
    liveIds.clear()
    let casterCount = 0
    let quadCount = 0
    let recordCount = 0
    let zOrderMismatchCount = 0

    if (!enabled) {
      for (const id of this.activeViews.keys()) this.release(id)
      return {
        activeMeshCount: 0,
        allocatedQuadCapacity: this.allocatedQuadCapacity,
        casterCount: 0,
        pooledMeshCount: this.freeViews.length,
        quadCount: 0,
        recordCount: 0,
        zOrderMismatchCount: 0,
      }
    }

    for (const depthOwner of visibleStaticDepthOwners) {
      const caster = this.staticCastersByOwner.get(depthOwner)
      if (!caster) continue
      if (!depthOwner.renderable || depthOwner.parent !== this.root) continue
      const geometry = casterGeometry(caster, sources, presentationFrame)
      recordCount += geometry.recordCount
      if (geometry.edges.length === 0) continue
      casterCount += 1
      quadCount += geometry.edges.length
      const view = this.activate(caster.id, geometry.edges)
      positionBeforeOwner(this.root, view.mesh, depthOwner)
      if (!ownsNativeShadowSlot(this.root, view.mesh, depthOwner)) {
        zOrderMismatchCount += 1
      }
      liveIds.add(caster.id)
    }

    for (const gate of gateLeaves) {
      const key = `${gate.fenceEid}:${gate.side}`
      const depthOwner = gateDepthOwners.get(key)
      if (!depthOwner?.renderable || depthOwner.parent !== this.root) continue
      const id = `gate:${key}`
      const geometry = casterGeometry(
        gateCaster(id, gate),
        sources,
        presentationFrame,
      )
      recordCount += geometry.recordCount
      if (geometry.edges.length === 0) continue
      casterCount += 1
      quadCount += geometry.edges.length
      const view = this.activate(id, geometry.edges)
      positionBeforeOwner(this.root, view.mesh, depthOwner)
      if (!ownsNativeShadowSlot(this.root, view.mesh, depthOwner)) {
        zOrderMismatchCount += 1
      }
      liveIds.add(id)
    }

    for (const id of this.activeViews.keys()) {
      if (!liveIds.has(id)) this.release(id)
    }
    return {
      activeMeshCount: this.activeViews.size,
      allocatedQuadCapacity: this.allocatedQuadCapacity,
      casterCount,
      pooledMeshCount: this.freeViews.length,
      quadCount,
      recordCount,
      zOrderMismatchCount,
    }
  }

  destroy(): void {
    for (const id of this.activeViews.keys()) this.release(id)
    for (const view of this.freeViews) view.mesh.destroy()
    this.freeViews.length = 0
    this.alphaRamp.destroy(true)
    this.liveIds.clear()
  }

  private activate(
    id: string,
    edges: readonly NativeBoneyardProjectedShadowEdge[],
  ): ActiveShadowView {
    let view = this.activeViews.get(id)
    if (!view) {
      view = this.freeViews.pop() ?? shadowView(this.alphaRamp, edges.length)
      this.activeViews.set(id, view)
    }
    view.mesh.label = `complex-shadow:${id}`
    const grew = view.buffers.write(edges)
    if (grew) {
      view.mesh.vertices = view.buffers.positions
      view.mesh.geometry.getBuffer('aUV').data = view.buffers.uvs
      view.mesh.geometry.getIndex().data = view.buffers.indices
    }
    view.mesh.geometry.getBuffer('aPosition').update()
    view.mesh.geometry.getBuffer('aUV').update()
    if (view.uploadedIndexRevision !== view.buffers.indexRevision) {
      view.mesh.geometry.getIndex().update()
      view.uploadedIndexRevision = view.buffers.indexRevision
    }
    view.mesh.renderable = true
    return view
  }

  private release(id: string): void {
    const view = this.activeViews.get(id)
    if (!view) return
    this.activeViews.delete(id)
    if (view.mesh.parent === this.root) this.root.removeChild(view.mesh)
    view.mesh.renderable = false
    this.freeViews.push(view)
  }

  private get allocatedQuadCapacity(): number {
    let capacity = 0
    for (const view of this.activeViews.values()) capacity += view.buffers.quadCapacity
    for (const view of this.freeViews) capacity += view.buffers.quadCapacity
    return capacity
  }
}

function casterGeometry(
  caster: NativeBoneyardComplexShadowCaster,
  sources: NativeBoneyardLightSamples,
  presentationFrame: number,
): CasterGeometry {
  const records = nativeBoneyardComplexShadowRecords(caster, sources, presentationFrame)
  const edges: NativeBoneyardProjectedShadowEdge[] = []
  for (const record of records) {
    if (caster.program?.kind === 'fence-grate') {
      const grate = nativeBoneyardFenceGrateShadows(caster.program, record)
      edges.push(...grate.bars, nativeBoneyardLineShadowEdge(grate.rail))
      continue
    }
    if (caster.program?.kind === 'rails') {
      edges.push(...nativeBoneyardRailsShadows(caster.program, record).map(
        nativeBoneyardLineShadowEdge,
      ))
      continue
    }
    if (caster.program?.kind === 'wall') {
      edges.push(nativeBoneyardWallShadow(caster.program, record))
      continue
    }
    edges.push(...nativeBoneyardProjectedShadowEdges(caster, record))
  }
  return { edges, recordCount: records.length }
}

function shadowView(texture: Texture, initialQuadCapacity: number): ActiveShadowView {
  const buffers = new NativeBoneyardShadowMeshBuffers(initialQuadCapacity)
  const mesh = new MeshSimple({
    indices: buffers.indices,
    texture,
    topology: 'triangle-list',
    uvs: buffers.uvs,
    vertices: buffers.positions,
  })
  mesh.autoUpdate = false
  mesh.eventMode = 'none'
  return { buffers, mesh, uploadedIndexRevision: 0 }
}

function shadowAlphaRampTexture(): Texture {
  return new Texture({
    label: 'native-shadow-alpha-ramp',
    source: new BufferImageSource({
      alphaMode: 'premultiply-alpha-on-upload',
      height: 1,
      label: 'native-shadow-alpha-ramp-source',
      resource: nativeBoneyardShadowAlphaRampPixels(),
      scaleMode: 'linear',
      width: 256,
    }),
  })
}

function positionBeforeOwner(
  root: Container,
  mesh: MeshSimple,
  owner: ContainerChild,
): void {
  mesh.zIndex = owner.zIndex
  const ownerIndex = root.getChildIndex(owner)
  if (mesh.parent !== root) {
    root.addChildAt(mesh, ownerIndex)
    return
  }
  const meshIndex = root.getChildIndex(mesh)
  if (meshIndex === ownerIndex - 1) return
  root.setChildIndex(mesh, meshIndex < ownerIndex ? ownerIndex - 1 : ownerIndex)
}

function ownsNativeShadowSlot(
  root: Container,
  mesh: MeshSimple,
  owner: ContainerChild,
): boolean {
  return mesh.zIndex === owner.zIndex
    && root.getChildIndex(mesh) === root.getChildIndex(owner) - 1
}

function gateCaster(
  id: string,
  state: BoneyardGateLeafSnapshot,
): NativeBoneyardComplexShadowCaster {
  return {
    id,
    outline: [],
    position: nativeGatePainterRoot(state.hinge, state.tip),
    program: {
      construction: 'gate',
      end: { ...state.tip },
      kind: 'fence-grate',
      start: { ...state.hinge },
    },
  }
}
