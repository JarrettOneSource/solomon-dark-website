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
import {
  nativeRoadMeshPlan,
  webArenaGroundMeshPlan,
} from './native-boneyard-surface.ts'

export interface NativeBoneyardSurfaceTextures {
  readonly ground: Texture
  readonly roads: readonly Texture[]
}

interface WebArenaGroundMeshView {
  readonly mesh: Mesh<MeshGeometry, Shader>
  destroy(): void
}

interface NativeRoadMeshView {
  readonly mesh: Mesh<MeshGeometry, Shader>
  readonly sourceKey: string
  destroy(): void
}

const BONEYARD_SURFACE_PROGRAM = compileHighShaderGlProgram({
  bits: [
    colorBitGl,
    localUniformBitGl,
    textureBitGl,
    roundPixelsBitGl,
    NATIVE_ARENA_UNPREMULTIPLIED_SATURATION_BIT_GL,
  ],
  name: 'boneyard-surface',
})

export class NativeBoneyardSurfaceView {
  readonly container = new Container({ label: 'native-boneyard-surface' })
  readonly roadIndexCount: number
  readonly roadMeshCount: number
  readonly roadVertexCount: number

  private readonly ground: WebArenaGroundMeshView
  private readonly roadRoot = new Container({ label: 'native-road-meshes' })
  private readonly roads: readonly NativeRoadMeshView[]

  constructor(
    parent: Container,
    scene: Pick<BoneyardScene, 'bounds' | 'roads'>,
    textures: NativeBoneyardSurfaceTextures,
  ) {
    this.ground = createWebArenaGroundMeshView(textures.ground, scene.bounds)
    this.container.eventMode = 'none'
    this.roadRoot.eventMode = 'none'
    this.container.addChild(this.ground.mesh, this.roadRoot)
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
    this.ground.destroy()
    for (const road of this.roads) road.destroy()
    this.container.parent?.removeChild(this.container)
    this.container.destroy({ children: true })
  }
}

function createWebArenaGroundMeshView(
  texture: Texture,
  bounds: BoneyardScene['bounds'],
): WebArenaGroundMeshView {
  const plan = webArenaGroundMeshPlan(bounds)
  const colorBuffer = new Buffer({
    data: plan.colors,
    label: 'web-arena-ground-colors',
    shrinkToFit: false,
    usage: BufferUsage.VERTEX | BufferUsage.COPY_DST,
  })
  const shader = createSurfaceShader(texture)
  const geometry = createSurfaceGeometry(plan, colorBuffer)
  const mesh = new Mesh({ geometry, shader, texture })
  mesh.eventMode = 'none'
  mesh.label = 'web-arena-ground'
  return {
    mesh,
    destroy() {
      mesh.parent?.removeChild(mesh)
      shader.destroy()
      geometry.destroy(true)
    },
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
  const shader = createSurfaceShader(texture)
  const geometry = createSurfaceGeometry(plan, colorBuffer)
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

function createSurfaceShader(texture: Texture): Shader {
  return new Shader({
    glProgram: BONEYARD_SURFACE_PROGRAM,
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
}

function createSurfaceGeometry(
  plan: Readonly<{
    colors: Uint8Array
    indices: Uint32Array
    positions: Float32Array
    uvs: Float32Array
  }>,
  colorBuffer: Buffer,
): MeshGeometry {
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
  return geometry
}
