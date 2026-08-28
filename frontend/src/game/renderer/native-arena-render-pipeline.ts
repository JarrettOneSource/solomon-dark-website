import {
  BatchGeometry,
  DefaultBatcher,
  GlProgram,
  Matrix,
  Shader,
  Texture,
  TextureStyle,
  UniformGroup,
  colorBitGl,
  compileHighShaderGlProgram,
  generateTextureBatchBitGl,
  getBatchSamplersUniformGroup,
  localUniformBitGl,
  roundPixelsBitGl,
  textureBitGl,
  type Renderer,
} from 'pixi.js'

export const NATIVE_ARENA_SATURATION = 0.65

export type NativeArenaRgba = readonly [
  red: number,
  green: number,
  blue: number,
  alpha: number,
]

export const NATIVE_ARENA_FRAGMENT_SHADER_SOURCE = `
  float textureAlpha = outColor.a;
  float vertexAlpha = vColor.a;
  vec3 sampledTextureColor = texturePremultiplied > 0.5 && textureAlpha > 0.0
    ? outColor.rgb / textureAlpha
    : outColor.rgb;
  vec3 vertexColor = vertexAlpha > 0.0
    ? vColor.rgb / vertexAlpha
    : vec3(0.0);
  vec3 textureColor = sampledTextureColor;
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

const NATIVE_ARENA_ALPHA_MODE_BIT_GL = {
  name: 'native-arena-alpha-mode',
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

export const NATIVE_ARENA_SATURATION_BIT_GL = {
  name: 'native-arena-saturation',
  fragment: {
    end: NATIVE_ARENA_FRAGMENT_SHADER_SOURCE,
  },
}

export const NATIVE_ARENA_UNPREMULTIPLIED_SATURATION_BIT_GL = {
  name: 'native-arena-unpremultiplied-saturation',
  fragment: {
    end: NATIVE_ARENA_FRAGMENT_SHADER_SOURCE.replace(
      /texturePremultiplied/g,
      '0.0',
    ),
  },
}

const NATIVE_ARENA_PREMULTIPLIED_SATURATION_BIT_GL = {
  name: 'native-arena-premultiplied-saturation',
  fragment: {
    end: NATIVE_ARENA_FRAGMENT_SHADER_SOURCE.replace(
      /texturePremultiplied/g,
      '1.0',
    ),
  },
}

export interface NativeArenaRenderPipeline {
  destroy(): void
}

type DefaultMeshElement = Parameters<DefaultBatcher['packAttributes']>[0]
type DefaultQuadElement = Parameters<DefaultBatcher['packQuadAttributes']>[0]
type BatchShader = DefaultBatcher['shader']
type BatchOptions = ConstructorParameters<typeof DefaultBatcher>[0]
const nativeArenaVertexColors = new WeakMap<object, Uint32Array>()

interface NativeInstructionSet {
  readonly uid: number
}

interface NativeBatchPipe {
  readonly _batchersByInstructionSet: Record<number, Record<string, DefaultBatcher>>
  buildStart(instructionSet: NativeInstructionSet): void
}

interface NativeGraphicsPipe {
  readonly _adaptor: { shader: Shader }
}

interface NativeMeshRenderable {
  readonly _shader: Shader | null
  readonly texture: Texture
}

interface NativeMeshAdaptor {
  _shader: Shader
  execute(meshPipe: unknown, mesh: NativeMeshRenderable): void
}

interface NativeMeshPipe {
  readonly _adaptor: NativeMeshAdaptor
}

interface NativeArenaRendererInternals {
  readonly limits: { readonly maxBatchableTextures: number }
  readonly renderPipes: {
    readonly batch: NativeBatchPipe
    readonly graphics: NativeGraphicsPipe
    readonly mesh: NativeMeshPipe
  }
}

class NativeArenaBatchGeometry extends BatchGeometry {
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

class NativeArenaBatchShader extends Shader {
  readonly maxTextures: number

  constructor(maxTextures: number) {
    super({
      glProgram: compileHighShaderGlProgram({
        name: 'native-arena-batch',
        bits: [
          colorBitGl,
          generateTextureBatchBitGl(maxTextures),
          roundPixelsBitGl,
          NATIVE_ARENA_ALPHA_MODE_BIT_GL,
          NATIVE_ARENA_SATURATION_BIT_GL,
        ],
      }),
      resources: {
        batchSamplers: getBatchSamplersUniformGroup(maxTextures),
      },
    })
    this.maxTextures = maxTextures
  }
}

class NativeArenaBatcher extends DefaultBatcher {
  private destroyed = false

  constructor(options: BatchOptions) {
    super(options)
    this.geometry.destroy(true)
    this.geometry = new NativeArenaBatchGeometry()
    this.vertexSize = 7
    this.shader = new NativeArenaBatchShader(options.maxTextures) as unknown as BatchShader
  }

  override packAttributes(
    element: DefaultMeshElement,
    float32View: Float32Array,
    uint32View: Uint32Array,
    index: number,
    textureId: number,
  ): void {
    const textureIdAndRound = textureId << 16 | element.roundPixels & 0xffff
    const transform = element.transform
    const { positions, uvs } = element
    const vertexColors = nativeArenaVertexColors.get(
      (element as DefaultMeshElement & { readonly renderable?: object }).renderable ?? element,
    )
    const texturePremultiplied = nativeArenaTextureIsPremultiplied(element.texture)
    const end = element.attributeOffset + element.attributeSize
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
        : multiplyNativeArenaPackedColors(vertexColor, element.color)
      uint32View[index++] = textureIdAndRound
      float32View[index++] = texturePremultiplied
    }
  }

  override packQuadAttributes(
    element: DefaultQuadElement,
    float32View: Float32Array,
    uint32View: Uint32Array,
    index: number,
    textureId: number,
  ): void {
    const texture = element.texture
    const transform = element.transform
    const bounds = element.bounds
    const uvs = texture.uvs
    const color = element.color
    const textureIdAndRound = textureId << 16 | element.roundPixels & 0xffff
    const texturePremultiplied = nativeArenaTextureIsPremultiplied(texture)
    const write = (x: number, y: number, u: number, v: number): void => {
      float32View[index++] = transform.a * x + transform.c * y + transform.tx
      float32View[index++] = transform.d * y + transform.b * x + transform.ty
      float32View[index++] = u
      float32View[index++] = v
      uint32View[index++] = color
      uint32View[index++] = textureIdAndRound
      float32View[index++] = texturePremultiplied
    }
    write(bounds.minX, bounds.minY, uvs.x0, uvs.y0)
    write(bounds.maxX, bounds.minY, uvs.x1, uvs.y1)
    write(bounds.maxX, bounds.maxY, uvs.x2, uvs.y2)
    write(bounds.minX, bounds.maxY, uvs.x3, uvs.y3)
  }

  override _updateMaxTextures(maxTextures: number): void {
    const current = this.shader as unknown as NativeArenaBatchShader
    if (current.maxTextures === maxTextures) return
    current.destroy(true)
    this.shader = new NativeArenaBatchShader(maxTextures) as unknown as BatchShader
  }

  override destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    const shader = this.shader as unknown as NativeArenaBatchShader
    shader.destroy(true)
    super.destroy()
  }
}

export function installNativeArenaRenderPipeline(
  renderer: Renderer,
): NativeArenaRenderPipeline {
  const nativeRenderer = renderer as unknown as NativeArenaRendererInternals
  const batchPipe = nativeRenderer.renderPipes.batch
  const graphicsAdaptor = nativeRenderer.renderPipes.graphics?._adaptor
  const meshAdaptor = nativeRenderer.renderPipes.mesh?._adaptor
  if (
    !batchPipe?._batchersByInstructionSet
    || !graphicsAdaptor?.shader
    || !meshAdaptor?._shader
  ) {
    throw new TypeError('Pixi WebGL renderer does not expose the required Arena shader owners')
  }

  const graphicsShader = createNativeArenaGraphicsShader(
    nativeRenderer.limits.maxBatchableTextures,
  )
  const premultipliedMeshShader = createNativeArenaMeshShader(true)
  const unpremultipliedMeshShader = createNativeArenaMeshShader(false)
  graphicsAdaptor.shader.destroy(true)
  graphicsAdaptor.shader = graphicsShader

  const originalMeshShader = meshAdaptor._shader
  const originalMeshExecute = meshAdaptor.execute
  originalMeshShader.destroy(true)
  meshAdaptor._shader = unpremultipliedMeshShader
  meshAdaptor.execute = function executeNativeArenaMesh(
    meshPipe: unknown,
    mesh: NativeMeshRenderable,
  ): void {
    if (mesh._shader === null) {
      this._shader = nativeArenaTextureIsPremultiplied(mesh.texture)
        ? premultipliedMeshShader
        : unpremultipliedMeshShader
    }
    originalMeshExecute.call(this, meshPipe, mesh)
  }

  const originalBuildStart = batchPipe.buildStart
  const ownedBatchers = new Set<NativeArenaBatcher>()
  let destroyed = false

  batchPipe.buildStart = function buildNativeArenaBatch(
    instructionSet: NativeInstructionSet,
  ): void {
    let batchers = this._batchersByInstructionSet[instructionSet.uid]
    if (!batchers) {
      batchers = {}
      this._batchersByInstructionSet[instructionSet.uid] = batchers
    }
    if (!(batchers.default instanceof NativeArenaBatcher)) {
      batchers.default?.destroy()
      const nativeBatcher = new NativeArenaBatcher({
        maxTextures: nativeRenderer.limits.maxBatchableTextures,
      })
      batchers.default = nativeBatcher
      ownedBatchers.add(nativeBatcher)
    }
    originalBuildStart.call(this, instructionSet)
  }

  return {
    destroy() {
      if (destroyed) return
      destroyed = true
      batchPipe.buildStart = originalBuildStart
      meshAdaptor.execute = originalMeshExecute
      for (const batcher of ownedBatchers) batcher.destroy()
      ownedBatchers.clear()
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

export function nativeArenaPackedColor(color: number, alpha: number): number {
  const blueGreenRed = color >> 16 | color & 0x00ff00 | (color & 0xff) << 16
  return (blueGreenRed + (Math.trunc(Math.min(1, Math.max(0, alpha)) * 255) << 24)) >>> 0
}

export function setNativeArenaVertexColors(
  renderable: object,
  colors: Uint32Array,
): void {
  nativeArenaVertexColors.set(renderable, colors)
}

function nativeArenaTextureIsPremultiplied(texture: Texture): 0 | 1 {
  return texture.source.alphaMode === 'no-premultiply-alpha' ? 0 : 1
}

function multiplyNativeArenaPackedColors(vertex: number, group: number): number {
  const red = (vertex & 0xff) * (group & 0xff) / 0xff | 0
  const green = (vertex >> 8 & 0xff) * (group >> 8 & 0xff) / 0xff | 0
  const blue = (vertex >> 16 & 0xff) * (group >> 16 & 0xff) / 0xff | 0
  const alpha = (vertex >>> 24) * (group >>> 24) / 0xff | 0
  return (red | green << 8 | blue << 16 | alpha << 24) >>> 0
}

function createNativeArenaGraphicsShader(maxTextures: number): Shader {
  return new Shader({
    glProgram: compileHighShaderGlProgram({
      name: 'native-arena-graphics',
      bits: [
        colorBitGl,
        generateTextureBatchBitGl(maxTextures),
        localUniformBitGl,
        roundPixelsBitGl,
        NATIVE_ARENA_PREMULTIPLIED_SATURATION_BIT_GL,
      ],
    }),
    resources: {
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
        textureBitGl,
        roundPixelsBitGl,
        premultiplied
          ? NATIVE_ARENA_PREMULTIPLIED_SATURATION_BIT_GL
          : NATIVE_ARENA_UNPREMULTIPLIED_SATURATION_BIT_GL,
      ],
    }),
    resources: {
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
  vColor = vec4(aColor.rgb * aColor.a, aColor.a) * uColor;
}
`

const NATIVE_ARENA_PARTICLE_FRAGMENT_SHADER_SOURCE = `
varying vec2 vUV;
varying vec4 vColor;
uniform sampler2D uTexture;

void main(void) {
  vec4 textureColor = texture2D(uTexture, vUV);
  float vertexAlpha = vColor.a;
  vec3 vertexColor = vertexAlpha > 0.0 ? vColor.rgb / vertexAlpha : vec3(0.0);
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
