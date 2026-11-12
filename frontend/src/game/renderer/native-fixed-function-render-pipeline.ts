import {
  ImageSource,
  Matrix,
  Rectangle,
  Shader,
  Texture,
  compileHighShaderGlProgram,
  localUniformBitGl,
  roundPixelsBitGl,
  type GlMeshAdaptor,
  type GlProgram,
  type Renderer,
  type WebGLRenderer,
} from 'pixi.js'
import { NATIVE_TEXTURE_COLOR_HEADER, NATIVE_TEXTURE_COLOR_UNIFORMS } from './native-texture-color.ts'
import { installNativePixelCenterProjection } from './native-pixel-center-projection.ts'
import { NATIVE_RECORD_TEXTURE_BIT_GL } from './native-record-sampling.ts'
import { textureSampleBounds } from './texture-sample-bounds.ts'
import { nativeSpriteRecordTexture } from './native-sprite-record-texture.ts'

import {
  NATIVE_STRAIGHT_UNIFORM_COLOR_BIT_GL, NATIVE_STRAIGHT_VERTEX_COLOR_BIT_GL, installNativeBatchMaterial,
  createNativeMeshExecutor, requireNativeWebGlRenderer,
} from './native-material-batch.ts'

const NATIVE_STOCK_TEXTURE_SOURCE_OPTIONS = Object.freeze({
  addressMode: 'repeat' as const,
  alphaMode: 'no-premultiply-alpha' as const,
  scaleMode: 'linear' as const,
})
const NATIVE_STOCK_POINT_TEXTURE_SOURCE_OPTIONS = Object.freeze({
  ...NATIVE_STOCK_TEXTURE_SOURCE_OPTIONS,
  scaleMode: 'nearest' as const,
})
const NATIVE_STOCK_FRAMED_TEXTURE_SOURCE_OPTIONS = Object.freeze({
  ...NATIVE_STOCK_TEXTURE_SOURCE_OPTIONS,
  addressMode: 'clamp-to-edge' as const,
})

interface NativeFixedFunctionRenderPipelineOptions {
  readonly installTextureAlphaShaders?: boolean
  readonly preserveBrowserCompositingAlpha?: boolean
  readonly nativeWorldPixelCenters?: boolean
}

const NATIVE_FIXED_FUNCTION_FRAGMENT_SHADER_SOURCE = `
  float textureAlpha = outColor.a;
  float vertexAlpha = vColor.a;
  vec3 textureColor = mod(nativeTextureModeValue, 2.0) > 0.5 && textureAlpha > 0.0
    ? outColor.rgb / textureAlpha
    : outColor.rgb;
  if ((uIgnoreTextureColor > 0.5 || nativeTextureModeValue > 1.5)) textureColor = vec3(1.0);
  vec3 nativeColor = textureColor * vColor.rgb;
  float finalAlpha = textureAlpha * vertexAlpha;
  finalColor = vec4(
    mod(nativeTextureModeValue, 2.0) > 0.5 ? nativeColor * finalAlpha : nativeColor,
    finalAlpha
  );
`

const NATIVE_FIXED_FUNCTION_COLOR_BIT_GL = {
  // Stryker disable next-line StringLiteral: Equivalent: shader bit names only delimit comments in generated GLSL.
  name: 'native-fixed-function-color',
  fragment: {
    header: NATIVE_TEXTURE_COLOR_HEADER,
    end: NATIVE_FIXED_FUNCTION_FRAGMENT_SHADER_SOURCE,
  },
}

const installedRenderers = new WeakSet<object>()
// Two immutable RGB programs are shared; per-view shaders own texture bindings.
const texturedVertexMeshPrograms = new Map<number, GlProgram>()

export function installNativeFixedFunctionRenderPipeline(
  renderer: Renderer,
  options: NativeFixedFunctionRenderPipelineOptions = {},
): void {
  if (installedRenderers.has(renderer)) return
  const webgl = requireNativeWebGlRenderer(renderer)
  if (options.nativeWorldPixelCenters) installNativePixelCenterProjection(webgl)
  const preserveAlpha = options.preserveBrowserCompositingAlpha === true
  installNativeBlendModes(webgl, preserveAlpha)
  if (options.installTextureAlphaShaders !== false) installNativeTextureAlphaShaders(webgl)
  webgl.runners.contextChange.add({
    contextChange() { installNativeBlendModes(webgl, preserveAlpha) },
  })
  installedRenderers.add(renderer)
}

function installNativeTextureAlphaShaders(nativeRenderer: WebGLRenderer): void {
  installNativeBatchMaterial(nativeRenderer, NATIVE_FIXED_FUNCTION_COLOR_BIT_GL)

  const meshAdaptor = nativeRenderer.renderPipes.mesh?.['_adaptor'] as GlMeshAdaptor | undefined
  if (!meshAdaptor) return
  const meshShaders = [0, 1, 2, 3, 4, 5, 6, 7].map(mode => createNativeFixedFunctionMeshShader(mode))
  const originalMeshShader = meshAdaptor['_shader']
  const originalMeshExecute = meshAdaptor.execute
  const originalMeshDestroy = meshAdaptor.destroy
  originalMeshShader.destroy(true)
  meshAdaptor['_shader'] = meshShaders[0]!
  meshAdaptor.execute = createNativeMeshExecutor(meshShaders, originalMeshExecute)
  meshAdaptor.destroy = function destroyNativeFixedFunctionMeshAdaptor(): void {
    originalMeshDestroy.call(this)
    for (const shader of meshShaders) shader.destroy(true)
  }
}

function createNativeFixedFunctionMeshShader(mode: number, textureColor = false): Shader {
  const nativeColorBit = {
    // Stryker disable next-line StringLiteral: Equivalent: shader bit names only delimit comments in generated GLSL.
    name: `native-fixed-function-${mode}`,
    fragment: {
      header: NATIVE_TEXTURE_COLOR_HEADER,
      end: NATIVE_FIXED_FUNCTION_FRAGMENT_SHADER_SOURCE.replace(
        /nativeTextureModeValue/g,
        `${mode % 4}.0`,
      ).replace('uIgnoreTextureColor > 0.5', textureColor ? 'false' : 'uIgnoreTextureColor > 0.5'),
    },
  }
  let glProgram = textureColor ? texturedVertexMeshPrograms.get(mode) : undefined
  if (glProgram === undefined) {
    glProgram = compileHighShaderGlProgram({
      // Stryker disable next-line StringLiteral: Equivalent: SHADER_NAME is diagnostic and is never read by the shader.
      name: `native-fixed-function-mesh-${mode}`,
      bits: [
        localUniformBitGl,
        NATIVE_RECORD_TEXTURE_BIT_GL,
        roundPixelsBitGl,
        mode < 4 ? NATIVE_STRAIGHT_UNIFORM_COLOR_BIT_GL : NATIVE_STRAIGHT_VERTEX_COLOR_BIT_GL,
        nativeColorBit,
      ],
    })
    if (textureColor) texturedVertexMeshPrograms.set(mode, glProgram)
  }
  return new Shader({
    glProgram,
    resources: {
      nativeTextureColor: NATIVE_TEXTURE_COLOR_UNIFORMS,
      nativeRecordSampling: {
        uNativeRecordBounds: { type: 'vec4<f32>', value: textureSampleBounds(Texture.EMPTY) },
      },
      uTexture: Texture.EMPTY.source,
      textureUniforms: {
        uTextureMatrix: { type: 'mat3x3<f32>', value: new Matrix() },
      },
    },
  })
}

/** Texture-RGB draw with owned bindings and a borrowed, shared compiled program. */
export function createNativeTexturedVertexMeshShader(texture: Texture): Shader & { texture: Texture } {
  const mode = texture.source.alphaMode === 'no-premultiply-alpha' ? 4 : 5
  const shader = Object.assign(createNativeFixedFunctionMeshShader(mode, true), { texture })
  shader.resources.uTexture = texture.source
  shader.resources.uSampler = texture.source.style
  shader.resources.nativeRecordSampling.uniforms.uNativeRecordBounds = textureSampleBounds(texture)
  shader.resources.textureUniforms.uniforms.uTextureMatrix = texture.textureMatrix.mapCoord
  return shader
}

export function nativeStockTextureFromImage(
  image: HTMLImageElement,
): Texture {
  return nativeTextureFromImage(image, NATIVE_STOCK_TEXTURE_SOURCE_OPTIONS)
}

export function nativeStockPointTextureFromImage(
  image: HTMLImageElement,
): Texture {
  return nativeTextureFromImage(
    image,
    NATIVE_STOCK_POINT_TEXTURE_SOURCE_OPTIONS,
  )
}

export function nativeStockFramedTextureFromImage(
  image: HTMLImageElement,
): Texture {
  const source = new ImageSource({ ...NATIVE_STOCK_FRAMED_TEXTURE_SOURCE_OPTIONS, resource: image })
  return nativeSpriteRecordTexture({ source, frame: new Rectangle(0, 0, source.width, source.height) })
}

export function nativeCompositedTextureFromImage(
  image: HTMLImageElement,
): Texture {
  return nativeTextureFromImage(image)
}

function nativeTextureFromImage(
  image: HTMLImageElement,
  options?:
    | typeof NATIVE_STOCK_TEXTURE_SOURCE_OPTIONS
    | typeof NATIVE_STOCK_POINT_TEXTURE_SOURCE_OPTIONS,
): Texture {
  return new Texture({
    source: new ImageSource({
      ...options,
      resource: image,
    }),
  })
}

function installNativeBlendModes(renderer: WebGLRenderer, preserveBrowserAlpha: boolean): void {
  const { ZERO, ONE, SRC_ALPHA, SRC_COLOR, ONE_MINUS_SRC_ALPHA } = renderer.gl
  const blendModes = renderer.state['blendModesMap']
  blendModes.multiply = [ZERO, SRC_COLOR, ZERO, SRC_ALPHA]
  if (!preserveBrowserAlpha) {
    for (const [mode, destination] of [['normal', ONE_MINUS_SRC_ALPHA], ['add', ONE]] as const) {
      blendModes[mode] = [ONE, destination, SRC_ALPHA, destination]
      blendModes[`${mode}-npm`] = [SRC_ALPHA, destination, SRC_ALPHA, destination]
    }
  }
  renderer.state.resetState()
}
