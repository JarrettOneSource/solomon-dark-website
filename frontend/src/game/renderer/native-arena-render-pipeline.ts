import {
  GlMeshAdaptor,
  GlProgram,
  Matrix,
  Shader,
  Texture,
  TextureStyle,
  UniformGroup,
  compileHighShaderGlProgram,
  generateTextureBatchBitGl,
  getBatchSamplersUniformGroup,
  localUniformBitGl,
  roundPixelsBitGl,
  textureBitGl,
  type GlGraphicsAdaptor,
  type Mesh,
  type MeshPipe,
  type Renderer,
} from 'pixi.js'
import { NATIVE_TEXTURE_COLOR_HEADER, NATIVE_TEXTURE_COLOR_UNIFORMS } from './native-texture-color.ts'

import {
  NATIVE_STRAIGHT_UNIFORM_COLOR_BIT_GL,
  NATIVE_STRAIGHT_VERTEX_COLOR_BIT_GL,
  installNativeBatchMaterial,
  nativeTextureIsPremultiplied,
  requireNativeWebGlRenderer,
} from './native-material-batch.ts'

export const NATIVE_ARENA_SATURATION = 0.65

export type NativeArenaRgba = readonly [
  red: number,
  green: number,
  blue: number,
  alpha: number,
]

const NATIVE_ARENA_FRAGMENT_SHADER_SOURCE = `
  float textureAlpha = outColor.a;
  float vertexAlpha = vColor.a;
  vec3 sampledTextureColor = texturePremultiplied > 0.5 && textureAlpha > 0.0
    ? outColor.rgb / textureAlpha
    : outColor.rgb;
  vec3 vertexColor = vColor.rgb;
  vec3 textureColor = uIgnoreTextureColor > 0.5 ? vec3(1.0) : sampledTextureColor;
  float textureGrey = (textureColor.r + textureColor.g + textureColor.b) / 3.0;
  float vertexGrey = (vertexColor.r + vertexColor.g + vertexColor.b) / 3.0;
  float grey = textureGrey * vertexGrey;
  vec3 realColor = textureColor * vertexColor;
  vec3 nativeColor = mix(vec3(grey), realColor, 0.65);
  float finalAlpha = textureAlpha * vertexAlpha;
  finalColor = vec4(
    texturePremultiplied > 0.5 ? nativeColor * finalAlpha : nativeColor,
    finalAlpha
  );
`

const NATIVE_ARENA_SATURATION_BIT_GL = {
  name: 'native-arena-saturation',
  fragment: {
    header: NATIVE_TEXTURE_COLOR_HEADER,
    end: NATIVE_ARENA_FRAGMENT_SHADER_SOURCE,
  },
}

export const NATIVE_ARENA_UNPREMULTIPLIED_SATURATION_BIT_GL = {
  name: 'native-arena-unpremultiplied-saturation',
  fragment: {
    header: NATIVE_TEXTURE_COLOR_HEADER,
    end: NATIVE_ARENA_FRAGMENT_SHADER_SOURCE.replace(
      /texturePremultiplied/g,
      '0.0',
    ),
  },
}

const NATIVE_ARENA_PREMULTIPLIED_SATURATION_BIT_GL = {
  name: 'native-arena-premultiplied-saturation',
  fragment: {
    header: NATIVE_TEXTURE_COLOR_HEADER,
    end: NATIVE_ARENA_FRAGMENT_SHADER_SOURCE.replace(
      /texturePremultiplied/g,
      '1.0',
    ),
  },
}

export interface NativeArenaRenderPipeline {
  destroy(): void
}

export function installNativeArenaRenderPipeline(
  renderer: Renderer,
): NativeArenaRenderPipeline {
  const nativeRenderer = requireNativeWebGlRenderer(renderer)
  const graphicsAdaptor = nativeRenderer.renderPipes.graphics['_adaptor'] as GlGraphicsAdaptor
  const meshAdaptor = nativeRenderer.renderPipes.mesh['_adaptor'] as GlMeshAdaptor
  const particleAdaptor = nativeRenderer.renderPipes.particle.adaptor
  const graphicsShader = createNativeArenaGraphicsShader(
    nativeRenderer.limits.maxBatchableTextures,
  )
  const premultipliedMeshShader = createNativeArenaMeshShader(true)
  const unpremultipliedMeshShader = createNativeArenaMeshShader(false)
  graphicsAdaptor.shader.destroy(true)
  graphicsAdaptor.shader = graphicsShader

  const originalMeshShader = meshAdaptor['_shader']
  const originalMeshExecute = meshAdaptor.execute
  originalMeshShader.destroy(true)
  meshAdaptor['_shader'] = unpremultipliedMeshShader
  meshAdaptor.execute = function executeNativeArenaMesh(
    meshPipe: MeshPipe,
    mesh: Mesh,
  ): void {
    if (mesh._shader === null) {
      this['_shader'] = nativeTextureIsPremultiplied(mesh.texture)
        ? premultipliedMeshShader
        : unpremultipliedMeshShader
    }
    // Arena replaces the application's fixed-function shader selection.
    GlMeshAdaptor.prototype.execute.call(this, meshPipe, mesh)
  }

  const restoreBatchMaterial = installNativeBatchMaterial(nativeRenderer, NATIVE_ARENA_SATURATION_BIT_GL)
  const originalParticleExecute = particleAdaptor.execute
  particleAdaptor.execute = function executeNativeArenaParticles(pipe, container): void {
    if (container.shader) {
      container.shader.groups[100] = nativeRenderer.globalUniforms.bindGroup
    }
    originalParticleExecute.call(this, pipe, container)
  }
  let destroyed = false

  return {
    destroy() {
      if (destroyed) return
      destroyed = true
      restoreBatchMaterial()
      meshAdaptor.execute = originalMeshExecute
      particleAdaptor.execute = originalParticleExecute
      graphicsShader.destroy(true)
      premultipliedMeshShader.destroy(true)
      unpremultipliedMeshShader.destroy(true)
    },
  }
}

export function createNativeArenaUnpremultipliedParticleShader(): Shader {
  return new Shader({
    glProgram: GlProgram.from({
      name: 'native-arena-particle',
      vertex: NATIVE_ARENA_PARTICLE_VERTEX_SHADER_SOURCE,
      fragment: NATIVE_ARENA_PARTICLE_FRAGMENT_SHADER_SOURCE,
    }),
    resources: {
      nativeTextureColor: NATIVE_TEXTURE_COLOR_UNIFORMS,
      uTexture: Texture.WHITE.source,
      uSampler: new TextureStyle({}),
      uniforms: {
        uTranslationMatrix: { value: new Matrix(), type: 'mat3x3<f32>' },
        uColor: { value: new Float32Array([1, 1, 1, 1]), type: 'vec4<f32>' },
        uRound: { value: 1, type: 'f32' },
        uResolution: { value: [0, 0], type: 'vec2<f32>' },
      },
    },
  })
}

export function nativeArenaSaturateSample(
  texture: NativeArenaRgba,
  vertex: NativeArenaRgba,
  saturation = NATIVE_ARENA_SATURATION,
): NativeArenaRgba {
  const textureGrey = (texture[0] + texture[1] + texture[2]) / 3
  const vertexGrey = (vertex[0] + vertex[1] + vertex[2]) / 3
  const grey = textureGrey * vertexGrey
  const inverse = 1 - saturation
  return [
    grey * inverse + texture[0] * vertex[0] * saturation,
    grey * inverse + texture[1] * vertex[1] * saturation,
    grey * inverse + texture[2] * vertex[2] * saturation,
    texture[3] * vertex[3],
  ]
}

function createNativeArenaGraphicsShader(maxTextures: number): Shader {
  return new Shader({
    glProgram: compileHighShaderGlProgram({
      name: 'native-arena-graphics',
      bits: [
        NATIVE_STRAIGHT_VERTEX_COLOR_BIT_GL,
        generateTextureBatchBitGl(maxTextures),
        localUniformBitGl,
        roundPixelsBitGl,
        NATIVE_ARENA_PREMULTIPLIED_SATURATION_BIT_GL,
      ],
    }),
    resources: {
      nativeTextureColor: NATIVE_TEXTURE_COLOR_UNIFORMS,
      localUniforms: new UniformGroup({
        uColor: { value: new Float32Array([1, 1, 1, 1]), type: 'vec4<f32>' },
        uTransformMatrix: { value: new Matrix(), type: 'mat3x3<f32>' },
        uRound: { value: 0, type: 'f32' },
      }),
      batchSamplers: getBatchSamplersUniformGroup(maxTextures),
    },
  })
}

function createNativeArenaMeshShader(premultiplied: boolean): Shader {
  return new Shader({
    glProgram: compileHighShaderGlProgram({
      name: `native-arena-mesh-${premultiplied ? 'pma' : 'npm'}`,
      bits: [
        localUniformBitGl,
        NATIVE_STRAIGHT_UNIFORM_COLOR_BIT_GL,
        textureBitGl,
        roundPixelsBitGl,
        premultiplied
          ? NATIVE_ARENA_PREMULTIPLIED_SATURATION_BIT_GL
          : NATIVE_ARENA_UNPREMULTIPLIED_SATURATION_BIT_GL,
      ],
    }),
    resources: {
      nativeTextureColor: NATIVE_TEXTURE_COLOR_UNIFORMS,
      uTexture: Texture.EMPTY.source,
      textureUniforms: {
        uTextureMatrix: { type: 'mat3x3<f32>', value: new Matrix() },
      },
    },
  })
}

const NATIVE_ARENA_PARTICLE_VERTEX_SHADER_SOURCE = `
attribute vec2 aVertex;
attribute vec2 aUV;
attribute vec4 aColor;
attribute vec2 aPosition;
attribute float aRotation;
uniform mat3 uTranslationMatrix;
uniform float uRound;
uniform vec2 uResolution;
uniform vec4 uColor;
uniform vec4 uWorldColorAlpha;
varying vec2 vUV;
varying vec4 vColor;

vec2 roundPixels(vec2 position, vec2 targetSize) {
  return (floor(((position * 0.5 + 0.5) * targetSize) + 0.5) / targetSize) * 2.0 - 1.0;
}

void main(void) {
  float cosRotation = cos(aRotation);
  float sinRotation = sin(aRotation);
  vec2 vertex = vec2(
    aVertex.x * cosRotation - aVertex.y * sinRotation,
    aVertex.x * sinRotation + aVertex.y * cosRotation
  ) + aPosition;
  gl_Position = vec4((uTranslationMatrix * vec3(vertex, 1.0)).xy, 0.0, 1.0);
  if (uRound == 1.0) gl_Position.xy = roundPixels(gl_Position.xy, uResolution);
  vUV = aUV;
  vec4 group = uColor * uWorldColorAlpha;
  vec3 groupColor = group.a > 0.0 ? group.rgb / group.a : vec3(0.0);
  vColor = vec4(aColor.rgb * groupColor, aColor.a * group.a);
}
`

const NATIVE_ARENA_PARTICLE_FRAGMENT_SHADER_SOURCE = `
varying vec2 vUV;
varying vec4 vColor;
uniform sampler2D uTexture;
uniform float uIgnoreTextureColor;

void main(void) {
  vec4 textureColor = texture2D(uTexture, vUV);
  if (uIgnoreTextureColor > 0.5) textureColor.rgb = vec3(1.0);
  float vertexAlpha = vColor.a;
  vec3 vertexColor = vColor.rgb;
  float textureGrey = (textureColor.r + textureColor.g + textureColor.b) / 3.0;
  float vertexGrey = (vertexColor.r + vertexColor.g + vertexColor.b) / 3.0;
  float grey = textureGrey * vertexGrey;
  vec3 realColor = textureColor.rgb * vertexColor;
  gl_FragColor = vec4(
    mix(vec3(grey), realColor, 0.65),
    textureColor.a * vertexAlpha
  );
}
`
