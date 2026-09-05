import {
  BatchGeometry,
  DefaultBatcher,
  ImageSource,
  Matrix,
  Shader,
  Texture,
  compileHighShaderGlProgram,
  generateTextureBatchBitGl,
  getBatchSamplersUniformGroup,
  localUniformBitGl,
  roundPixelsBitGl,
  textureBitGl,
  type GlMeshAdaptor,
  type InstructionSet,
  type Mesh,
  type MeshPipe,
  type GlBatchAdaptor,
  type Renderer,
  type WebGLRenderer,
} from 'pixi.js'
import { installNativeTextureColorSync, NATIVE_TEXTURE_COLOR_HEADER, NATIVE_TEXTURE_COLOR_UNIFORMS } from './native-texture-color.ts'

export const NATIVE_STOCK_TEXTURE_SOURCE_OPTIONS = Object.freeze({
  addressMode: 'repeat' as const,
  alphaMode: 'no-premultiply-alpha' as const,
  scaleMode: 'linear' as const,
})
export const NATIVE_STOCK_POINT_TEXTURE_SOURCE_OPTIONS = Object.freeze({
  ...NATIVE_STOCK_TEXTURE_SOURCE_OPTIONS,
  scaleMode: 'nearest' as const,
})
export const NATIVE_STOCK_FRAMED_TEXTURE_SOURCE_OPTIONS = Object.freeze({
  ...NATIVE_STOCK_TEXTURE_SOURCE_OPTIONS,
  addressMode: 'clamp-to-edge' as const,
})
export const NATIVE_COMPOSITED_TEXTURE_SOURCE_OPTIONS = Object.freeze({
  addressMode: 'clamp-to-edge' as const,
  alphaMode: 'premultiply-alpha-on-upload' as const,
  scaleMode: 'linear' as const,
})

type NativeBlendFactors = readonly [
  sourceRgb: number,
  destinationRgb: number,
  sourceAlpha: number,
  destinationAlpha: number,
]

interface NativeGlBlendConstants {
  readonly ONE: number
  readonly ONE_MINUS_SRC_ALPHA: number
  readonly SRC_ALPHA: number
  readonly SRC_COLOR: number
  readonly ZERO: number
}

interface NativeFixedFunctionRenderPipelineOptions {
  readonly installTextureAlphaShaders?: boolean
  readonly preserveBrowserCompositingAlpha?: boolean
}

interface NativeWebGlRendererInternals {
  readonly gl?: NativeGlBlendConstants
  readonly runners?: {
    readonly contextChange?: {
      add(listener: { contextChange(gl: NativeGlBlendConstants): void }): void
    }
  }
  readonly state?: {
    readonly blendModesMap?: Record<string, number[]>
    resetState(): void
  }
}

type NativeBatchMeshElement = Parameters<DefaultBatcher['packAttributes']>[0]
type NativeBatchQuadElement = Parameters<DefaultBatcher['packQuadAttributes']>[0]
type NativeBatchOptions = ConstructorParameters<typeof DefaultBatcher>[0]
const nativeFixedFunctionVertexColors = new WeakMap<object, Uint32Array>()

export type NativeFixedFunctionRgba = readonly [
  red: number,
  green: number,
  blue: number,
  alpha: number,
]

// Pixi uniforms carry premultiplied group color. Recover that uniform tint
// before interpolating the native, independently packed vertex RGB and alpha.
export const NATIVE_STRAIGHT_VERTEX_COLOR_BIT_GL = {
  name: 'native-straight-vertex-color',
  vertex: {
    header: 'in vec4 aColor;',
    end: `
      float nativeGroupAlpha = vColor.a;
      vec3 nativeGroupColor = nativeGroupAlpha > 0.0
        ? vColor.rgb / nativeGroupAlpha
        : vec3(0.0);
      vColor = vec4(aColor.rgb * nativeGroupColor, aColor.a * nativeGroupAlpha);
    `,
  },
}

export const NATIVE_STRAIGHT_UNIFORM_COLOR_BIT_GL = {
  name: 'native-straight-uniform-color',
  vertex: {
    end: 'if (vColor.a > 0.0) vColor.rgb /= vColor.a;',
  },
}

export const NATIVE_FIXED_FUNCTION_FRAGMENT_SHADER_SOURCE = `
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

const NATIVE_TEXTURE_ALPHA_MODE_BIT_GL = {
  name: 'native-texture-alpha-mode',
  vertex: {
    header: `
      in float aTexturePremultiplied;
      out float texturePremultiplied;
    `,
    main: 'texturePremultiplied = aTexturePremultiplied;',
  },
  fragment: {
    header: 'in float texturePremultiplied;',
  },
}

const NATIVE_FIXED_FUNCTION_COLOR_BIT_GL = {
  name: 'native-fixed-function-color',
  fragment: {
    header: NATIVE_TEXTURE_COLOR_HEADER,
    end: NATIVE_FIXED_FUNCTION_FRAGMENT_SHADER_SOURCE,
  },
}

const installedRenderers = new WeakSet<object>()

export function nativeFixedFunctionMultiplyBlendFactors(
  gl: NativeGlBlendConstants,
): NativeBlendFactors {
  return [gl.ZERO, gl.SRC_COLOR, gl.ZERO, gl.SRC_ALPHA]
}

export function nativeFixedFunctionNormalBlendFactors(
  gl: NativeGlBlendConstants,
  premultiplied: boolean,
): NativeBlendFactors {
  return [
    premultiplied ? gl.ONE : gl.SRC_ALPHA,
    gl.ONE_MINUS_SRC_ALPHA,
    gl.SRC_ALPHA,
    gl.ONE_MINUS_SRC_ALPHA,
  ]
}

export function nativeFixedFunctionAdditiveBlendFactors(
  gl: NativeGlBlendConstants,
  premultiplied: boolean,
): NativeBlendFactors {
  return [
    premultiplied ? gl.ONE : gl.SRC_ALPHA,
    gl.ONE,
    gl.SRC_ALPHA,
    gl.ONE,
  ]
}

export function nativeFixedFunctionMultiplyRgb(
  destination: readonly [number, number, number],
  source: readonly [number, number, number],
): readonly [number, number, number] {
  return [
    destination[0] * source[0],
    destination[1] * source[1],
    destination[2] * source[2],
  ]
}

export function nativeFixedFunctionFragmentRgba(
  texture: NativeFixedFunctionRgba,
  vertex: NativeFixedFunctionRgba,
  premultiplied: boolean,
): NativeFixedFunctionRgba {
  const textureAlpha = texture[3]
  const vertexAlpha = vertex[3]
  const textureColor = premultiplied && textureAlpha > 0
    ? [
        texture[0] / textureAlpha,
        texture[1] / textureAlpha,
        texture[2] / textureAlpha,
      ] as const
    : texture
  const alpha = textureAlpha * vertexAlpha
  const color = [
    textureColor[0] * vertex[0],
    textureColor[1] * vertex[1],
    textureColor[2] * vertex[2],
  ] as const
  return premultiplied
    ? [color[0] * alpha, color[1] * alpha, color[2] * alpha, alpha]
    : [color[0], color[1], color[2], alpha]
}

export function installNativeFixedFunctionRenderPipeline(
  renderer: Renderer,
  options: NativeFixedFunctionRenderPipelineOptions = {},
): void {
  if (installedRenderers.has(renderer)) return
  const internals = renderer as Renderer & NativeWebGlRendererInternals
  const state = internals.state
  const blendModes = state?.blendModesMap
  const gl = internals.gl
  const contextChange = internals.runners?.contextChange
  if (!state || !blendModes || !gl || !contextChange) {
    throw new Error('Native fixed-function rendering requires Pixi WebGL state internals.')
  }
  installNativeBlendModes(blendModes, gl, options.preserveBrowserCompositingAlpha === true)
  state.resetState()
  if (options.installTextureAlphaShaders !== false) {
    installNativeTextureAlphaShaders(renderer)
  }
  contextChange.add({
    contextChange(restoredGl: NativeGlBlendConstants) {
      const restoredBlendModes = internals.state?.blendModesMap
      if (!restoredBlendModes) {
        throw new Error('Pixi WebGL state was not restored before native fixed-function state.')
      }
      installNativeBlendModes(
        restoredBlendModes,
        restoredGl,
        options.preserveBrowserCompositingAlpha === true,
      )
      state.resetState()
    },
  })
  installedRenderers.add(renderer)
}

class NativeTextureAlphaBatchGeometry extends BatchGeometry {
  constructor() {
    super()
    const stride = 7 * 4
    for (const attribute of Object.values(this.attributes)) attribute.stride = stride
    this.addAttribute('aTexturePremultiplied', {
      buffer: this.buffers[0]!,
      format: 'float32',
      offset: 6 * 4,
      stride,
    })
  }
}

class NativeFixedFunctionBatchShader extends Shader {
  readonly maxTextures: number

  constructor(maxTextures: number) {
    super({
      glProgram: compileHighShaderGlProgram({
        name: 'native-fixed-function-batch',
        bits: [
          NATIVE_STRAIGHT_VERTEX_COLOR_BIT_GL,
          generateTextureBatchBitGl(maxTextures),
          roundPixelsBitGl,
          NATIVE_TEXTURE_ALPHA_MODE_BIT_GL,
          NATIVE_FIXED_FUNCTION_COLOR_BIT_GL,
        ],
      }),
      resources: {
        nativeTextureColor: NATIVE_TEXTURE_COLOR_UNIFORMS,
        batchSamplers: getBatchSamplersUniformGroup(maxTextures),
      },
    })
    this.maxTextures = maxTextures
  }
}

class NativeFixedFunctionBatcher extends DefaultBatcher {
  private destroyed = false

  constructor(options: NativeBatchOptions) {
    super(options)
    this.geometry.destroy(true)
    this.geometry = new NativeTextureAlphaBatchGeometry()
    this.vertexSize = 7
    this.shader = new NativeFixedFunctionBatchShader(
      options.maxTextures,
    )
  }

  override packAttributes(
    element: NativeBatchMeshElement,
    float32View: Float32Array,
    uint32View: Uint32Array,
    index: number,
    textureId: number,
  ): void {
    const textureIdAndRound = textureId << 16 | element.roundPixels & 0xffff
    const transform = element.transform
    const { positions, uvs } = element
    const vertexColors = nativeFixedFunctionVertexColors.get(
      (element as NativeBatchMeshElement & { readonly renderable?: object }).renderable ?? element,
    )
    const end = element.attributeOffset + element.attributeSize
    const texturePremultiplied = nativeTextureIsPremultiplied(element.texture)
    for (let vertex = element.attributeOffset; vertex < end; vertex += 1) {
      const coordinate = vertex * 2
      const x = positions[coordinate]!
      const y = positions[coordinate + 1]!
      float32View[index++] = transform.a * x + transform.c * y + transform.tx
      float32View[index++] = transform.d * y + transform.b * x + transform.ty
      float32View[index++] = uvs[coordinate]!
      float32View[index++] = uvs[coordinate + 1]!
      const vertexColor = vertexColors?.[vertex - element.attributeOffset]
      uint32View[index++] = vertexColor === undefined
        ? element.color
        : multiplyNativeFixedFunctionPackedColors(vertexColor, element.color)
      uint32View[index++] = textureIdAndRound
      float32View[index++] = texturePremultiplied
    }
  }

  override packQuadAttributes(
    element: NativeBatchQuadElement,
    float32View: Float32Array,
    uint32View: Uint32Array,
    index: number,
    textureId: number,
  ): void {
    const texture = element.texture
    const transform = element.transform
    const bounds = element.bounds
    const uvs = texture.uvs
    const textureIdAndRound = textureId << 16 | element.roundPixels & 0xffff
    const texturePremultiplied = nativeTextureIsPremultiplied(texture)
    const write = (x: number, y: number, u: number, v: number): void => {
      float32View[index++] = transform.a * x + transform.c * y + transform.tx
      float32View[index++] = transform.d * y + transform.b * x + transform.ty
      float32View[index++] = u
      float32View[index++] = v
      uint32View[index++] = element.color
      uint32View[index++] = textureIdAndRound
      float32View[index++] = texturePremultiplied
    }
    write(bounds.minX, bounds.minY, uvs.x0, uvs.y0)
    write(bounds.maxX, bounds.minY, uvs.x1, uvs.y1)
    write(bounds.maxX, bounds.maxY, uvs.x2, uvs.y2)
    write(bounds.minX, bounds.maxY, uvs.x3, uvs.y3)
  }

  override _updateMaxTextures(maxTextures: number): void {
    const current = this.shader as NativeFixedFunctionBatchShader
    if (current.maxTextures === maxTextures) return
    current.destroy(true)
    this.shader = new NativeFixedFunctionBatchShader(
      maxTextures,
    )
  }

  override destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    const shader = this.shader as NativeFixedFunctionBatchShader
    shader.destroy(true)
    super.destroy()
  }
}

export function nativeFixedFunctionPackedColor(color: number, alpha: number): number {
  const blueGreenRed = color >> 16 | color & 0x00ff00 | (color & 0xff) << 16
  return (blueGreenRed + (Math.trunc(Math.min(1, Math.max(0, alpha)) * 255) << 24)) >>> 0
}

export function setNativeFixedFunctionVertexColors(
  renderable: object,
  colors: Uint32Array,
): void {
  nativeFixedFunctionVertexColors.set(renderable, colors)
}

function multiplyNativeFixedFunctionPackedColors(vertex: number, group: number): number {
  const red = (vertex & 0xff) * (group & 0xff) / 0xff | 0
  const green = (vertex >> 8 & 0xff) * (group >> 8 & 0xff) / 0xff | 0
  const blue = (vertex >> 16 & 0xff) * (group >> 16 & 0xff) / 0xff | 0
  const alpha = (vertex >>> 24) * (group >>> 24) / 0xff | 0
  return (red | green << 8 | blue << 16 | alpha << 24) >>> 0
}

function installNativeTextureAlphaShaders(renderer: Renderer): void {
  const nativeRenderer = renderer as WebGLRenderer
  const batchPipe = nativeRenderer.renderPipes?.batch
  const maxTextures = nativeRenderer.limits?.maxBatchableTextures
  if (!batchPipe?.['_batchersByInstructionSet'] || !batchPipe['_adaptor']?.start || !maxTextures) {
    throw new Error('Native fixed-function rendering requires a Pixi WebGL batch owner.')
  }

  // Pixi uploads custom batch uniforms only on a shader's first bind. Native
  // capture mode changes between render targets, so it must sync at each start.
  installNativeTextureColorSync(batchPipe['_adaptor'] as GlBatchAdaptor, nativeRenderer.shader)

  const originalBuildStart = batchPipe.buildStart
  batchPipe.buildStart = function buildNativeFixedFunctionBatch(
    instructionSet: InstructionSet,
  ): void {
    let batchers = this['_batchersByInstructionSet'][instructionSet.uid]
    if (!batchers) {
      batchers = {}
      this['_batchersByInstructionSet'][instructionSet.uid] = batchers
    }
    if (!(batchers.default instanceof NativeFixedFunctionBatcher)) {
      batchers.default?.destroy()
      batchers.default = new NativeFixedFunctionBatcher({ maxTextures })
    }
    originalBuildStart.call(this, instructionSet)
  }

  const meshAdaptor = nativeRenderer.renderPipes.mesh?.['_adaptor'] as GlMeshAdaptor | undefined
  if (!meshAdaptor) return
  if (!meshAdaptor['_shader']) {
    throw new Error('Native fixed-function rendering requires the Pixi WebGL mesh shader owner.')
  }
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
    if (mesh._shader === null) {
      this['_shader'] = nativeTextureIsPremultiplied(mesh.texture)
        ? premultipliedMeshShader
        : unpremultipliedMeshShader
    }
    originalMeshExecute.call(this, meshPipe, mesh)
  }
  meshAdaptor.destroy = function destroyNativeFixedFunctionMeshAdaptor(): void {
    const activeShader = this['_shader']
    originalMeshDestroy.call(this)
    if (premultipliedMeshShader !== activeShader) premultipliedMeshShader.destroy(true)
    if (unpremultipliedMeshShader !== activeShader) unpremultipliedMeshShader.destroy(true)
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

function nativeTextureIsPremultiplied(texture: Texture): 0 | 1 {
  return texture.source.alphaMode === 'no-premultiply-alpha' ? 0 : 1
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

function installNativeBlendModes(
  blendModes: Record<string, number[]>,
  gl: NativeGlBlendConstants,
  preserveBrowserCompositingAlpha: boolean,
): void {
  blendModes.multiply = [...nativeFixedFunctionMultiplyBlendFactors(gl)]
  if (preserveBrowserCompositingAlpha) return
  blendModes.normal = [...nativeFixedFunctionNormalBlendFactors(gl, true)]
  blendModes['normal-npm'] = [...nativeFixedFunctionNormalBlendFactors(gl, false)]
  blendModes.add = [...nativeFixedFunctionAdditiveBlendFactors(gl, true)]
  blendModes['add-npm'] = [...nativeFixedFunctionAdditiveBlendFactors(gl, false)]
}
