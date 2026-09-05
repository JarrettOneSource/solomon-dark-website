import { Container, type Texture } from 'pixi.js'

import type { BoneyardScene } from '../core-kernels/boneyard.ts'
import { createNativeSurfaceMesh, type NativeStaticSurfaceMesh } from './boneyard-building-surface-view.ts'
import {
  nativeRoadMeshPlan,
  webArenaGroundMeshPlan,
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
  readonly container = new Container({ label: 'native-boneyard-surface' })
  readonly roadIndexCount: number
  readonly roadMeshCount: number
  readonly roadVertexCount: number

  private readonly ground: NativeStaticSurfaceMesh
  private readonly roadRoot = new Container({ label: 'native-road-meshes' })
  private readonly roads: readonly NativeRoadMeshView[]

  constructor(
    parent: Container,
    scene: Pick<BoneyardScene, 'bounds' | 'roads'>,
    textures: NativeBoneyardSurfaceTextures,
  ) {
    const plans = scene.roads.map((road) => {
      const plan = nativeRoadMeshPlan(road)
      const texture = textures.roads[plan.style]
      if (!texture) throw new Error(`Native Road style ${plan.style} texture is unavailable`)
      return { eid: road.eid, plan, texture }
    })
    this.ground = createNativeSurfaceMesh(textures.ground, webArenaGroundMeshPlan(scene.bounds))
    this.ground.mesh.label = 'web-arena-ground'
    this.container.eventMode = 'none'
    this.roadRoot.eventMode = 'none'
    this.container.addChild(this.ground.mesh, this.roadRoot)
    parent.addChild(this.container)

    const roads = plans.map(({ eid, plan, texture }) => {
      const surface = createNativeSurfaceMesh(texture, plan)
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
