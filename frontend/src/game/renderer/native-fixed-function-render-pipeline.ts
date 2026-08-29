import {
  BatchGeometry,
  DefaultBatcher,
  ImageSource,
  Matrix,
  Shader,
  Texture,
  colorBitGl,
  compileHighShaderGlProgram,
  generateTextureBatchBitGl,
  getBatchSamplersUniformGroup,
  localUniformBitGl,
  roundPixelsBitGl,
  textureBitGl,
  type Renderer,
} from 'pixi.js'

export const NATIVE_STOCK_TEXTURE_SOURCE_OPTIONS = Object.freeze({
  addressMode: 'repeat' as const,
  alphaMode: 'no-premultiply-alpha' as const,
  scaleMode: 'linear' as const,
})
export const NATIVE_STOCK_POINT_TEXTURE_SOURCE_OPTIONS = Object.freeze({
  ...NATIVE_STOCK_TEXTURE_SOURCE_OPTIONS,
  scaleMode: 'nearest' as const,
})
export const NATIVE_COMPOSITED_TEXTURE_SOURCE_OPTIONS = Object.freeze({
  ...NATIVE_STOCK_TEXTURE_SOURCE_OPTIONS,
  alphaMode: 'premultiply-alpha-on-upload' as const,
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
  }
}

type NativeBatchMeshElement = Parameters<DefaultBatcher['packAttributes']>[0]
type NativeBatchQuadElement = Parameters<DefaultBatcher['packQuadAttributes']>[0]
type NativeBatchShader = DefaultBatcher['shader']
type NativeBatchOptions = ConstructorParameters<typeof DefaultBatcher>[0]

interface NativeInstructionSet {
  readonly uid: number
}

interface NativeBatchPipe {
  readonly _batchersByInstructionSet: Record<number, Record<string, DefaultBatcher>>
  buildStart(instructionSet: NativeInstructionSet): void
}

interface NativeMeshRenderable {
  readonly _shader: Shader | null
  readonly texture: Texture
}

interface NativeMeshAdaptor {
  _shader: Shader | null
  destroy(): void
  execute(meshPipe: unknown, mesh: NativeMeshRenderable): void
}

interface NativeTextureAlphaRendererInternals {
  readonly limits?: { readonly maxBatchableTextures: number }
  readonly renderPipes?: {
    readonly batch?: NativeBatchPipe
    readonly mesh?: { readonly _adaptor?: NativeMeshAdaptor }
  }
}

export type NativeFixedFunctionRgba = readonly [
  red: number,
  green: number,
  blue: number,
  alpha: number,
]

export const NATIVE_FIXED_FUNCTION_FRAGMENT_SHADER_SOURCE = `
  float textureAlpha = outColor.a;
  float vertexAlpha = vColor.a;
  vec3 textureColor = texturePremultiplied > 0.5 && textureAlpha > 0.0
    ? outColor.rgb / textureAlpha
    : outColor.rgb;
  vec3 vertexColor = vertexAlpha > 0.0
    ? vColor.rgb / vertexAlpha
    : vec3(0.0);
  vec3 nativeColor = textureColor * vertexColor;
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
  const vertexColor = vertexAlpha > 0
    ? [
        vertex[0] / vertexAlpha,
        vertex[1] / vertexAlpha,
        vertex[2] / vertexAlpha,
      ] as const
    : [0, 0, 0] as const
  const alpha = textureAlpha * vertexAlpha
  const color = [
    textureColor[0] * vertexColor[0],
    textureColor[1] * vertexColor[1],
    textureColor[2] * vertexColor[2],
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
  const internals = renderer as unknown as NativeWebGlRendererInternals
  const blendModes = internals.state?.blendModesMap
  const gl = internals.gl
  const contextChange = internals.runners?.contextChange
  if (!blendModes || !gl || !contextChange) {
    throw new Error('Native fixed-function rendering requires Pixi WebGL state internals.')
  }
  installNativeBlendModes(blendModes, gl, options.preserveBrowserCompositingAlpha === true)
  if (options.installTextureAlphaShaders !== false) {
    installNativeTextureAlphaShaders(renderer)
  }
  contextChange.add({
    contextChange(restoredGl) {
      const restoredBlendModes = internals.state?.blendModesMap
      if (!restoredBlendModes) {
        throw new Error('Pixi WebGL state was not restored before native fixed-function state.')
      }
      installNativeBlendModes(
        restoredBlendModes,
        restoredGl,
        options.preserveBrowserCompositingAlpha === true,
      )
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
          colorBitGl,
          generateTextureBatchBitGl(maxTextures),
          roundPixelsBitGl,
          NATIVE_TEXTURE_ALPHA_MODE_BIT_GL,
          NATIVE_FIXED_FUNCTION_COLOR_BIT_GL,
        ],
      }),
      resources: {
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
    ) as unknown as NativeBatchShader
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
      uint32View[index++] = element.color
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
    const current = this.shader as unknown as NativeFixedFunctionBatchShader
    if (current.maxTextures === maxTextures) return
    current.destroy(true)
    this.shader = new NativeFixedFunctionBatchShader(
      maxTextures,
    ) as unknown as NativeBatchShader
  }

  override destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    const shader = this.shader as unknown as NativeFixedFunctionBatchShader
    shader.destroy(true)
    super.destroy()
  }
}

function installNativeTextureAlphaShaders(renderer: Renderer): void {
  const nativeRenderer = renderer as unknown as NativeTextureAlphaRendererInternals
  const batchPipe = nativeRenderer.renderPipes?.batch
  const maxTextures = nativeRenderer.limits?.maxBatchableTextures
  if (!batchPipe?._batchersByInstructionSet || !maxTextures) {
    throw new Error('Native fixed-function rendering requires a Pixi WebGL batch owner.')
  }

  const originalBuildStart = batchPipe.buildStart
  batchPipe.buildStart = function buildNativeFixedFunctionBatch(
    instructionSet: NativeInstructionSet,
  ): void {
    let batchers = this._batchersByInstructionSet[instructionSet.uid]
    if (!batchers) {
      batchers = {}
      this._batchersByInstructionSet[instructionSet.uid] = batchers
    }
    if (!(batchers.default instanceof NativeFixedFunctionBatcher)) {
      batchers.default?.destroy()
      batchers.default = new NativeFixedFunctionBatcher({ maxTextures })
    }
    originalBuildStart.call(this, instructionSet)
  }

  const meshAdaptor = nativeRenderer.renderPipes?.mesh?._adaptor
  if (!meshAdaptor) return
  if (!meshAdaptor._shader) {
    throw new Error('Native fixed-function rendering requires the Pixi WebGL mesh shader owner.')
  }
  const premultipliedMeshShader = createNativeFixedFunctionMeshShader(true)
  const unpremultipliedMeshShader = createNativeFixedFunctionMeshShader(false)
  const originalMeshShader = meshAdaptor._shader
  const originalMeshExecute = meshAdaptor.execute
  const originalMeshDestroy = meshAdaptor.destroy
  originalMeshShader.destroy(true)
  meshAdaptor._shader = unpremultipliedMeshShader
  meshAdaptor.execute = function executeNativeFixedFunctionMesh(
    meshPipe: unknown,
    mesh: NativeMeshRenderable,
  ): void {
    if (mesh._shader === null) {
      this._shader = nativeTextureIsPremultiplied(mesh.texture)
        ? premultipliedMeshShader
        : unpremultipliedMeshShader
    }
    originalMeshExecute.call(this, meshPipe, mesh)
  }
  meshAdaptor.destroy = function destroyNativeFixedFunctionMeshAdaptor(): void {
    const activeShader = this._shader
    originalMeshDestroy.call(this)
    if (premultipliedMeshShader !== activeShader) premultipliedMeshShader.destroy(true)
    if (unpremultipliedMeshShader !== activeShader) unpremultipliedMeshShader.destroy(true)
  }
}

function createNativeFixedFunctionMeshShader(premultiplied: boolean): Shader {
  const nativeColorBit = {
    name: `native-fixed-function-${premultiplied ? 'pma' : 'npm'}`,
    fragment: {
      end: NATIVE_FIXED_FUNCTION_FRAGMENT_SHADER_SOURCE.replace(
        /texturePremultiplied/g,
        premultiplied ? '1.0' : '0.0',
      ),
    },
  }
  return new Shader({
    glProgram: compileHighShaderGlProgram({
      name: `native-fixed-function-mesh-${premultiplied ? 'pma' : 'npm'}`,
      bits: [localUniformBitGl, textureBitGl, roundPixelsBitGl, nativeColorBit],
    }),
    resources: {
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
