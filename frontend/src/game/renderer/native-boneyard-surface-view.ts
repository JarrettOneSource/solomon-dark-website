import {
  Buffer,
  BufferUsage,
  Container,
  Mesh,
  MeshGeometry,
  Shader,
  colorBitGl,
  compileHighShaderGlProgram,
  localUniformBitGl,
  roundPixelsBitGl,
  textureBitGl,
  type Texture,
} from 'pixi.js'

import type { BoneyardScene } from '../core-kernels/boneyard.ts'
import { NATIVE_ARENA_UNPREMULTIPLIED_SATURATION_BIT_GL } from './native-arena-render-pipeline.ts'
import { nativeRoadMeshPlan } from './native-boneyard-surface.ts'

export interface NativeBoneyardSurfaceTextures {
  readonly roads: readonly Texture[]
}

interface NativeRoadMeshView {
  readonly mesh: Mesh<MeshGeometry, Shader>
  readonly sourceKey: string
  destroy(): void
}

const NATIVE_ROAD_SURFACE_PROGRAM = compileHighShaderGlProgram({
  bits: [
    colorBitGl,
    localUniformBitGl,
    textureBitGl,
    roundPixelsBitGl,
    NATIVE_ARENA_UNPREMULTIPLIED_SATURATION_BIT_GL,
  ],
  name: 'native-boneyard-road-surface',
})

export class NativeBoneyardSurfaceView {
  readonly container = new Container({ label: 'native-boneyard-surface' })
  readonly roadIndexCount: number
  readonly roadMeshCount: number
  readonly roadVertexCount: number

  private readonly roadRoot = new Container({ label: 'native-road-meshes' })
  private readonly roads: readonly NativeRoadMeshView[]

  constructor(
    parent: Container,
    scene: Pick<BoneyardScene, 'roads'>,
    textures: NativeBoneyardSurfaceTextures,
  ) {
    this.container.eventMode = 'none'
    this.roadRoot.eventMode = 'none'
    this.container.addChild(this.roadRoot)
    parent.addChild(this.container)

    const roads = scene.roads.map((road) => {
      const plan = nativeRoadMeshPlan(road)
      const texture = textures.roads[plan.style]
      if (!texture) throw new Error(`Native Road style ${plan.style} texture is unavailable`)
      return createNativeRoadMeshView(road.eid, texture, plan)
    })
    for (const road of roads) this.roadRoot.addChild(road.mesh)
    this.roads = Object.freeze(roads)
    this.roadMeshCount = roads.length
    this.roadVertexCount = roads.length * 8
    this.roadIndexCount = roads.length * 18
  }

  get activeRoadMeshCount(): number {
    return this.roads.reduce((count, road) => count + Number(road.mesh.renderable), 0)
  }

  applyOffCameraCleanup(retiredSourceKeys: ReadonlySet<string>): void {
    for (const road of this.roads) {
      if (retiredSourceKeys.has(road.sourceKey)) road.mesh.renderable = false
    }
  }

  destroy(): void {
    for (const road of this.roads) road.destroy()
    this.container.parent?.removeChild(this.container)
    this.container.destroy({ children: true })
  }
}

function createNativeRoadMeshView(
  eid: string,
  texture: Texture,
  plan: ReturnType<typeof nativeRoadMeshPlan>,
): NativeRoadMeshView {
  const colorBuffer = new Buffer({
    data: plan.colors,
    label: `native-road-colors:${eid}`,
    shrinkToFit: false,
    usage: BufferUsage.VERTEX | BufferUsage.COPY_DST,
  })
  const shader = new Shader({
    glProgram: NATIVE_ROAD_SURFACE_PROGRAM,
    resources: {
      textureUniforms: {
        uTextureMatrix: {
          type: 'mat3x3<f32>',
          value: texture.textureMatrix.mapCoord,
        },
      },
      uTexture: texture.source,
    },
  })
  const geometry = new MeshGeometry({
    indices: plan.indices,
    positions: plan.positions,
    topology: 'triangle-list',
    uvs: plan.uvs,
  })
  geometry.addAttribute('aColor', {
    buffer: colorBuffer,
    format: 'unorm8x4',
    offset: 0,
    stride: 4,
  })
  const mesh = new Mesh({ geometry, shader, texture })
  mesh.eventMode = 'none'
  mesh.label = `native-road:${eid}`
  return {
    mesh,
    sourceKey: `road:${eid}`,
    destroy() {
      mesh.parent?.removeChild(mesh)
      shader.destroy()
      geometry.destroy(true)
    },
  }
}
