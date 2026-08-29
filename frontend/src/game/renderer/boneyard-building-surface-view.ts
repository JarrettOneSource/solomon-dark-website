import {
  Buffer,
  BufferUsage,
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
    colorBitGl,
    localUniformBitGl,
    textureBitGl,
    roundPixelsBitGl,
    NATIVE_ARENA_UNPREMULTIPLIED_SATURATION_BIT_GL,
  ],
  name: 'native-static-surface',
})

export function createNativeBuildingSurfaceMesh(
  texture: Texture,
  width: number,
  height: number,
  enhancedEffects: boolean,
): NativeStaticSurfaceMesh {
  return createNativeStaticSurfaceMesh(texture, width, height, enhancedEffects)
}

export function createNativeWallSurfaceMesh(
  texture: Texture,
  width: number,
  height: number,
): NativeStaticSurfaceMesh {
  return createNativeStaticSurfaceMesh(texture, width, height, false)
}

function createNativeStaticSurfaceMesh(
  texture: Texture,
  width: number,
  height: number,
  enhancedEffects: boolean,
): NativeStaticSurfaceMesh {
  const grid = nativeBuildingMeshGrid(width, height, enhancedEffects)
  const colors = new Uint8Array(grid.positions.length * 2)
  colors.fill(255)
  const colorBuffer = new Buffer({
    data: colors,
    label: 'native-static-surface-colors',
    shrinkToFit: false,
    usage: BufferUsage.VERTEX | BufferUsage.COPY_DST,
  })
  const shader = new Shader({
    glProgram: NATIVE_STATIC_SURFACE_PROGRAM,
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
    indices: grid.indices,
    positions: grid.positions,
    topology: 'triangle-list',
    uvs: grid.uvs,
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
      shader.destroy()
      mesh.geometry.destroy(true)
    },
    update(scalars) {
      writeNativeStaticSurfaceVertexColors(colors, scalars)
      colorBuffer.update()
    },
  }
}
