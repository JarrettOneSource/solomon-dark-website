import {
  Buffer, BufferUsage, Matrix, Shader, UniformGroup, compileHighShaderGlProgram,
  localUniformBitGl, roundPixelsBitGl, textureBitGl, type Texture,
} from 'pixi.js'

import {
  createNativeSurfaceMesh, type NativeStaticSurfaceMesh, type NativeSurfaceGeometry,
} from './boneyard-building-surface-view.ts'
import {
  NATIVE_ARENA_PREMULTIPLIED_SATURATION_BIT_GL,
  NATIVE_ARENA_UNPREMULTIPLIED_SATURATION_BIT_GL,
} from './native-arena-render-pipeline.ts'
import { NATIVE_STRAIGHT_VERTEX_COLOR_BIT_GL } from './native-material-batch.ts'
import { NATIVE_TEXTURE_COLOR_UNIFORMS } from './native-texture-color.ts'

const FIELD_COVERAGE_BIT = {
  name: 'native-arena-field-coverage',
  vertex: {
    header: `
      in vec2 aFieldUvPerWorld;
      uniform float uFieldCoverageEnabled;
      uniform mat3 uFieldPhysicalAffine;
    `,
    end: `
      if (uFieldCoverageEnabled > 0.5) {
        vec2 fieldDevice = (uFieldPhysicalAffine * vec3(position, 1.0)).xy;
        vec2 fieldDevicePerWorld = vec2(uFieldPhysicalAffine[0][0], uFieldPhysicalAffine[1][1]);
        vec2 fieldCoverageOffset = ceil(fieldDevice) - fieldDevice - vec2(0.5);
        vec2 fieldProjection = vec2(uProjectionMatrix[0][0], uProjectionMatrix[1][1]);
        gl_Position.xy += fieldCoverageOffset * (2.0 / uResolution) * sign(fieldProjection);
        vUV += fieldCoverageOffset * aFieldUvPerWorld / fieldDevicePerWorld;
      }
    `,
  },
}

const FIELD_PROGRAMS = [
  NATIVE_ARENA_UNPREMULTIPLIED_SATURATION_BIT_GL,
  NATIVE_ARENA_PREMULTIPLIED_SATURATION_BIT_GL,
].map(saturation => compileHighShaderGlProgram({
  name: 'native-arena-field',
  bits: [NATIVE_STRAIGHT_VERTEX_COLOR_BIT_GL, localUniformBitGl, textureBitGl,
    roundPixelsBitGl, saturation, FIELD_COVERAGE_BIT],
}))

export interface NativeArenaFieldSurface extends NativeStaticSurfaceMesh {
  /** Call only for a full target with native pixel-center projection installed. */
  prepareRender(resolution: number): boolean
}

/** Field quads share native top-left coverage without changing their sampled UV plane. */
export function createNativeArenaFieldSurface(
  texture: Texture,
  plan: NativeSurfaceGeometry,
): NativeArenaFieldSurface {
  const physicalAffine = new Matrix()
  const logicalAffine = new Matrix()
  const coverage = new UniformGroup({
    uFieldCoverageEnabled: { value: 0, type: 'f32' },
    uFieldPhysicalAffine: { value: physicalAffine, type: 'mat3x3<f32>' },
  })
  const shader = new Shader({
    glProgram: FIELD_PROGRAMS[texture.source.alphaMode === 'no-premultiply-alpha' ? 0 : 1]!,
    resources: {
      fieldCoverageUniforms: coverage,
      nativeTextureColor: NATIVE_TEXTURE_COLOR_UNIFORMS,
      textureUniforms: { uTextureMatrix: { type: 'mat3x3<f32>', value: texture.textureMatrix.mapCoord } },
      uTexture: texture.source,
    },
  })
  const surface = createNativeSurfaceMesh(texture, plan, shader)
  let slopes = fieldUvSlopes(plan)
  const slopeBuffer = new Buffer({
    data: slopes.values,
    label: 'native-arena-field-uv-world-slope',
    usage: BufferUsage.VERTEX | BufferUsage.COPY_DST,
  })
  surface.mesh.geometry.addAttribute('aFieldUvPerWorld', {
    buffer: slopeBuffer, format: 'float32x2', offset: 0, stride: 8,
  })

  return {
    get colors() { return surface.colors },
    mesh: surface.mesh,
    destroy: () => surface.destroy(),
    update: scalars => surface.update(scalars),
    setGeometry(next) {
      surface.setGeometry(next)
      slopes = fieldUvSlopes(next)
      slopeBuffer.data = slopes.values
      slopeBuffer.update()
    },
    prepareRender(resolution) {
      // The cached worldTransform is stale until Pixi traverses the render tree.
      // Explicitly update all ancestors after camera feedback and before render.
      surface.mesh.getGlobalTransform(logicalAffine, false)
      physicalAffine.set(logicalAffine.a * resolution, logicalAffine.b * resolution,
        logicalAffine.c * resolution, logicalAffine.d * resolution,
        logicalAffine.tx * resolution, logicalAffine.ty * resolution)
      texture.textureMatrix.update()
      const supported = slopes.valid && !surface.mesh.roundPixels && positiveAxisAligned(physicalAffine)
        && identityTextureMatrix(texture.textureMatrix.mapCoord)
      if (!supported) physicalAffine.identity()
      coverage.uniforms.uFieldCoverageEnabled = Number(supported)
      return supported
    },
  }
}

function fieldUvSlopes(plan: NativeSurfaceGeometry): { values: Float32Array; valid: boolean } {
  const values = new Float32Array(plan.positions.length)
  let valid = true
  for (let i = 0; i < values.length; i += 8) {
    const dx = plan.positions[i + 2]! - plan.positions[i]!
    const dy = plan.positions[i + 5]! - plan.positions[i + 1]!
    const du = (plan.uvs[i + 2]! - plan.uvs[i]!) / dx
    const dv = (plan.uvs[i + 5]! - plan.uvs[i + 1]!) / dy
    if (!(dx > 0 && dy > 0 && Number.isFinite(du) && Number.isFinite(dv))) {
      valid = false
      continue
    }
    for (let corner = 0; corner < 8; corner += 2) {
      values[i + corner] = du
      values[i + corner + 1] = dv
    }
  }
  return { values, valid }
}

function positiveAxisAligned(matrix: Matrix): boolean {
  return Math.fround(matrix.a) > 0 && Math.fround(matrix.d) > 0
    && matrix.b === 0 && matrix.c === 0
    && [matrix.a, matrix.d, matrix.tx, matrix.ty].every(value => Number.isFinite(Math.fround(value)))
}

function identityTextureMatrix(matrix: Matrix): boolean {
  return matrix.a === 1 && matrix.d === 1 && matrix.b === 0 && matrix.c === 0
    && matrix.tx === 0 && matrix.ty === 0
}
