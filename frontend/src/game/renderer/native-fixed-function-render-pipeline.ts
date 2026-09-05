import {
  ImageSource,
  Matrix,
  Shader,
  Texture,
  compileHighShaderGlProgram,
  localUniformBitGl,
  roundPixelsBitGl,
  textureBitGl,
  type GlMeshAdaptor,
  type Mesh,
  type MeshPipe,
  type Renderer,
  type WebGLRenderer,
} from 'pixi.js'
import { NATIVE_TEXTURE_COLOR_HEADER, NATIVE_TEXTURE_COLOR_UNIFORMS } from './native-texture-color.ts'

import {
  NATIVE_STRAIGHT_UNIFORM_COLOR_BIT_GL, installNativeBatchMaterial, nativeTextureIsPremultiplied, requireNativeWebGlRenderer,
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
const NATIVE_COMPOSITED_TEXTURE_SOURCE_OPTIONS = Object.freeze({
  addressMode: 'clamp-to-edge' as const,
  alphaMode: 'premultiply-alpha-on-upload' as const,
  scaleMode: 'linear' as const,
})

interface NativeFixedFunctionRenderPipelineOptions {
  readonly installTextureAlphaShaders?: boolean
  readonly preserveBrowserCompositingAlpha?: boolean
}

const NATIVE_FIXED_FUNCTION_FRAGMENT_SHADER_SOURCE = `
  float textureAlpha = outColor.a;
  float vertexAlpha = vColor.a;
  vec3 textureColor = texturePremultiplied > 0.5 && textureAlpha > 0.0
    ? outColor.rgb / textureAlpha
    : outColor.rgb;
  if (uIgnoreTextureColor > 0.5) textureColor = vec3(1.0);
  vec3 nativeColor = textureColor * vColor.rgb;
  float finalAlpha = textureAlpha * vertexAlpha;
  finalColor = vec4(
    texturePremultiplied > 0.5 ? nativeColor * finalAlpha : nativeColor,
    finalAlpha
  );
`

const NATIVE_FIXED_FUNCTION_COLOR_BIT_GL = {
  name: 'native-fixed-function-color',
  fragment: {
    header: NATIVE_TEXTURE_COLOR_HEADER,
    end: NATIVE_FIXED_FUNCTION_FRAGMENT_SHADER_SOURCE,
  },
}

const installedRenderers = new WeakSet<object>()

export function installNativeFixedFunctionRenderPipeline(
  renderer: Renderer,
  options: NativeFixedFunctionRenderPipelineOptions = {},
): void {
  if (installedRenderers.has(renderer)) return
  const webgl = requireNativeWebGlRenderer(renderer)
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
  const premultipliedMeshShader = createNativeFixedFunctionMeshShader(true)
  const unpremultipliedMeshShader = createNativeFixedFunctionMeshShader(false)
  const originalMeshShader = meshAdaptor['_shader']
  const originalMeshExecute = meshAdaptor.execute
  const originalMeshDestroy = meshAdaptor.destroy
  originalMeshShader.destroy(true)
  meshAdaptor['_shader'] = unpremultipliedMeshShader
  meshAdaptor.execute = function executeNativeFixedFunctionMesh(
    meshPipe: MeshPipe,
    mesh: Mesh,
  ): void {
    this['_shader'] = nativeTextureIsPremultiplied(mesh.texture)
      ? premultipliedMeshShader
      : unpremultipliedMeshShader
    originalMeshExecute.call(this, meshPipe, mesh)
  }
  meshAdaptor.destroy = function destroyNativeFixedFunctionMeshAdaptor(): void {
    originalMeshDestroy.call(this)
    premultipliedMeshShader.destroy(true)
    unpremultipliedMeshShader.destroy(true)
  }
}

function createNativeFixedFunctionMeshShader(premultiplied: boolean): Shader {
  const nativeColorBit = {
    name: `native-fixed-function-${premultiplied ? 'pma' : 'npm'}`,
    fragment: {
      header: NATIVE_TEXTURE_COLOR_HEADER,
      end: NATIVE_FIXED_FUNCTION_FRAGMENT_SHADER_SOURCE.replace(
        /texturePremultiplied/g,
        premultiplied ? '1.0' : '0.0',
      ),
    },
  }
  return new Shader({
    glProgram: compileHighShaderGlProgram({
      name: `native-fixed-function-mesh-${premultiplied ? 'pma' : 'npm'}`,
      bits: [
        localUniformBitGl,
        textureBitGl,
        roundPixelsBitGl,
        NATIVE_STRAIGHT_UNIFORM_COLOR_BIT_GL,
        nativeColorBit,
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

export function nativeStockTextureFromImage(
  image: HTMLImageElement,
): Texture {
  return nativeStockTextureFromImageWithOptions(image, NATIVE_STOCK_TEXTURE_SOURCE_OPTIONS)
}

export function nativeStockPointTextureFromImage(
  image: HTMLImageElement,
): Texture {
  return nativeStockTextureFromImageWithOptions(
    image,
    NATIVE_STOCK_POINT_TEXTURE_SOURCE_OPTIONS,
  )
}

export function nativeStockFramedTextureFromImage(
  image: HTMLImageElement,
): Texture {
  return nativeStockTextureFromImageWithOptions(
    image,
    NATIVE_STOCK_FRAMED_TEXTURE_SOURCE_OPTIONS,
  )
}

export function nativeCompositedTextureFromImage(
  image: HTMLImageElement,
): Texture {
  return nativeStockTextureFromImageWithOptions(
    image,
    NATIVE_COMPOSITED_TEXTURE_SOURCE_OPTIONS,
  )
}

function nativeStockTextureFromImageWithOptions(
  image: HTMLImageElement,
  options:
    | typeof NATIVE_STOCK_TEXTURE_SOURCE_OPTIONS
    | typeof NATIVE_STOCK_POINT_TEXTURE_SOURCE_OPTIONS
    | typeof NATIVE_STOCK_FRAMED_TEXTURE_SOURCE_OPTIONS
    | typeof NATIVE_COMPOSITED_TEXTURE_SOURCE_OPTIONS,
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
