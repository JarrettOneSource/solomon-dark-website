import { Container, type Texture } from 'pixi.js'

import type { BoneyardScene } from '../core-kernels/boneyard.ts'
import {
  createNativeArenaFieldLattice,
  nativeArenaFieldDescriptor,
  nativeArenaFieldMeshPlan,
  nativeArenaFieldRecord,
  nativeArenaFieldVisibleRange,
  type NativeArenaFieldBounds,
  type NativeArenaFieldLattice,
  type NativeArenaFieldRange,
  type NativeArenaFieldRecord,
} from '../native-arena-field.ts'
import { createNativeSurfaceMesh, type NativeStaticSurfaceMesh } from './boneyard-building-surface-view.ts'
import { createNativeArenaFieldSurface, type NativeArenaFieldSurface } from './native-arena-field-surface.ts'
import {
  nativeRoadMeshPlan,
} from './native-boneyard-surface.ts'

export interface NativeBoneyardSurfaceTextures {
  readonly ground: Texture
  readonly roads: readonly Texture[]
}

interface NativeRoadMeshView {
  readonly surface: NativeStaticSurfaceMesh
  readonly sourceKey: string
}

export class NativeBoneyardSurfaceView {
  // Stryker disable next-line StringLiteral,ObjectLiteral: Equivalent: this scene label has no runtime lookup consumer.
  readonly container = new Container({ label: 'native-boneyard-surface' })
  readonly roadIndexCount: number
  readonly roadMeshCount: number
  readonly roadVertexCount: number
  readonly fieldRecord: NativeArenaFieldRecord

  private readonly ground: NativeArenaFieldSurface
  private readonly fieldLattice: NativeArenaFieldLattice
  private readonly fieldMode: number
  private fieldRange: NativeArenaFieldRange = { xStart: 0, xEnd: 0, yStart: 0, yEnd: 0, tileCount: 0 }
  private fieldGeometryUpdates = 0
  // Stryker disable next-line StringLiteral,ObjectLiteral: Equivalent: this scene label has no runtime lookup consumer.
  private readonly roadRoot = new Container({ label: 'native-road-meshes' })
  private readonly roads: readonly NativeRoadMeshView[]

  constructor(
    parent: Container,
    scene: Pick<BoneyardScene, 'bounds' | 'roads' | 'environmentMode'>,
    textures: NativeBoneyardSurfaceTextures,
  ) {
    const descriptor = nativeArenaFieldDescriptor(scene.environmentMode)
    const frame = textures.ground.frame
    if (frame.x !== 0 || frame.y !== 0
      || frame.width !== descriptor.page.width || frame.height !== descriptor.page.height
      || textures.ground.source.width !== descriptor.page.width
      || textures.ground.source.height !== descriptor.page.height) {
      throw new RangeError('Native Arena field requires the original full atlas page')
    }
    const plans = scene.roads.map((road) => {
      const plan = nativeRoadMeshPlan(road)
      const texture = textures.roads[plan.style]
      if (!texture) throw new Error(`Native Road style ${plan.style} texture is unavailable`)
      return { eid: road.eid, plan, texture }
    })
    this.fieldMode = scene.environmentMode
    this.fieldRecord = nativeArenaFieldRecord(this.fieldMode)
    this.fieldLattice = createNativeArenaFieldLattice(scene.bounds)
    this.ground = createNativeArenaFieldSurface(textures.ground,
      nativeArenaFieldMeshPlan(this.fieldLattice, this.fieldRange, this.fieldMode))
    this.ground.mesh.renderable = false
    // Stryker disable next-line StringLiteral: Equivalent: this scene label has no runtime lookup consumer.
    this.ground.mesh.label = 'native-arena-field'
    this.container.eventMode = 'none'
    this.roadRoot.eventMode = 'none'
    this.container.addChild(this.ground.mesh, this.roadRoot)
    parent.addChild(this.container)

    const roads = plans.map(({ eid, plan, texture }) => {
      const surface = createNativeSurfaceMesh(texture, plan)
      // Stryker disable next-line StringLiteral: Equivalent: this scene label has no runtime lookup consumer.
      surface.mesh.label = `native-road:${eid}`
      return { surface, sourceKey: `road:${eid}` }
    })
    for (const road of roads) this.roadRoot.addChild(road.surface.mesh)
    this.roads = Object.freeze(roads)
    this.roadMeshCount = roads.length
    this.roadVertexCount = roads.length * 8
    this.roadIndexCount = roads.length * 18
  }

  get activeRoadMeshCount(): number {
    return this.roads.reduce((count, road) => count + Number(road.surface.mesh.renderable), 0)
  }

  get groundTileCount(): number { return this.fieldRange.tileCount }

  get groundGeometryUpdateCount(): number { return this.fieldGeometryUpdates }

  /** Prepare the current full target immediately before its native-phase render. */
  prepareFieldRender(resolution: number): boolean { return this.ground.prepareRender(resolution) }

  /** Native field uses the unpadded primary view, unlike resident scenery. */
  updateField(view: Readonly<NativeArenaFieldBounds>): void {
    const next = nativeArenaFieldVisibleRange(this.fieldLattice, view)
    const old = this.fieldRange
    if (next.xStart === old.xStart && next.xEnd === old.xEnd
      && next.yStart === old.yStart && next.yEnd === old.yEnd) return
    this.ground.setGeometry(nativeArenaFieldMeshPlan(this.fieldLattice, next, this.fieldMode))
    this.ground.mesh.renderable = next.tileCount > 0
    this.fieldRange = next
    this.fieldGeometryUpdates += 1
  }

  applyOffCameraCleanup(retiredSourceKeys: ReadonlySet<string>): void {
    for (const road of this.roads) {
      if (retiredSourceKeys.has(road.sourceKey)) road.surface.mesh.renderable = false
    }
  }

  destroy(): void {
    this.ground.destroy()
    for (const road of this.roads) road.surface.destroy()
    this.container.parent?.removeChild(this.container)
    this.container.destroy({ children: true })
  }
}
