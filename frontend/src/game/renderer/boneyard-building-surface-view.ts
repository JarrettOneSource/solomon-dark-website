import {
  Buffer,
  BufferUsage,
  Mesh,
  MeshGeometry,
  Shader,
  compileHighShaderGlProgram,
  localUniformBitGl,
  roundPixelsBitGl,
  textureBitGl,
  type Texture,
} from 'pixi.js'
import { NATIVE_TEXTURE_COLOR_UNIFORMS } from './native-texture-color.ts'

import { NATIVE_STRAIGHT_VERTEX_COLOR_BIT_GL } from './native-material-batch.ts'

import {
  nativeBuildingMeshGrid,
  writeNativeStaticSurfaceVertexColors,
} from './boneyard-static-surface-lighting.ts'
import {
  NATIVE_ARENA_UNPREMULTIPLIED_SATURATION_BIT_GL,
} from './native-arena-render-pipeline.ts'

export interface NativeStaticSurfaceMesh {
  readonly colors: Uint8Array
  readonly mesh: Mesh<MeshGeometry, Shader>
  destroy(): void
  update(scalars: ArrayLike<number>): void
}

const NATIVE_STATIC_SURFACE_PROGRAM = compileHighShaderGlProgram({
  bits: [
    NATIVE_STRAIGHT_VERTEX_COLOR_BIT_GL,
    localUniformBitGl,
    textureBitGl,
    roundPixelsBitGl,
    NATIVE_ARENA_UNPREMULTIPLIED_SATURATION_BIT_GL,
  ],
  name: 'native-static-surface',
})

interface NativeSurfaceGeometry {
  readonly colors: Uint8Array
  readonly indices: Uint32Array
  readonly positions: Float32Array
  readonly uvs: Float32Array
}

export function createNativeLitSurfaceGrid(
  texture: Texture,
  width: number,
  height: number,
  enhancedEffects: boolean,
): NativeStaticSurfaceMesh {
  const grid = nativeBuildingMeshGrid(width, height, enhancedEffects)
  const colors = new Uint8Array(grid.positions.length * 2)
  colors.fill(255)
  return createNativeSurfaceMesh(texture, { ...grid, colors })
}

export function createNativeSurfaceMesh(texture: Texture, plan: NativeSurfaceGeometry): NativeStaticSurfaceMesh {
  const colors = plan.colors
  const colorBuffer = new Buffer({
    data: colors,
    label: 'native-static-surface-colors',
    shrinkToFit: false,
    usage: BufferUsage.VERTEX | BufferUsage.COPY_DST,
  })
  const shader = new Shader({
    glProgram: NATIVE_STATIC_SURFACE_PROGRAM,
    resources: {
      nativeTextureColor: NATIVE_TEXTURE_COLOR_UNIFORMS,
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
  const mesh = new Mesh({
    geometry,
    shader,
    texture,
  })
  mesh.eventMode = 'none'

  return {
    colors,
    mesh,
    destroy() {
      mesh.destroy()
      shader.destroy()
      geometry.destroy(true)
    },
    update(scalars) {
      if (writeNativeStaticSurfaceVertexColors(colors, scalars)) colorBuffer.update()
    },
  }
}
