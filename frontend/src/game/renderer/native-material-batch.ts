import {
  Batch, BatchGeometry, Batcher, BatcherPipe, Buffer, BufferUsage, DefaultBatcher, Shader,
  compileHighShaderGlProgram, generateTextureBatchBitGl, getAdjustedBlendModeBlend, getBatchSamplersUniformGroup,
  roundPixelsBitGl, type BatchableGraphics, type BatchableMesh, type BatchableSprite,
  type BatchableElement, type Container, type GlBatchAdaptor, type InstructionSet,
  type Mesh, type Renderer, type RenderOptions, type Texture, type WebGLRenderer,
} from 'pixi.js'
import { installNativeTextureColorSync, NATIVE_TEXTURE_COLOR_UNIFORMS, usesNativeDiffuseColor } from './native-texture-color.ts'

type NativeBatchMeshElement = Parameters<DefaultBatcher['packAttributes']>[0]
type NativeBatchQuadElement = Parameters<DefaultBatcher['packQuadAttributes']>[0]
type NativeBatchElement = NativeBatchMeshElement | NativeBatchQuadElement
type NativeBatchOptions = ConstructorParameters<typeof DefaultBatcher>[0]
export interface NativeBatchMaterial {
  readonly name: string
  readonly fragment: { readonly header?: string; readonly end: string }
}
const nativeVertexColors = new WeakMap<object, Uint32Array>()

// Pixi uniforms carry premultiplied group color. Recover that uniform tint
// before interpolating the native, independently packed vertex RGB and alpha.
export const NATIVE_STRAIGHT_VERTEX_COLOR_BIT_GL = {
  // Stryker disable next-line StringLiteral: Equivalent: shader bit names only delimit comments in generated GLSL.
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
  // Stryker disable next-line StringLiteral: Equivalent: shader bit names only delimit comments in generated GLSL.
  name: 'native-straight-uniform-color',
  vertex: {
    end: 'if (vColor.a > 0.0) vColor.rgb /= vColor.a;',
  },
}

const NATIVE_TEXTURE_MODE_BIT_GL = {
  // Stryker disable next-line StringLiteral: Equivalent: shader bit names only delimit comments in generated GLSL.
  name: 'native-texture-alpha-mode',
  vertex: {
    header: `
      in float aNativeTextureMode;
      out float nativeTextureModeValue;
    `,
    main: 'nativeTextureModeValue = aNativeTextureMode;',
  },
  fragment: {
    header: 'in float nativeTextureModeValue;',
  },
}

class NativeTextureAlphaBatchGeometry extends BatchGeometry {
  constructor() {
    super()
    const stride = 7 * 4
    for (const attribute of Object.values(this.attributes)) attribute.stride = stride
    this.addAttribute('aNativeTextureMode', {
      buffer: this.buffers[0]!,
      offset: 6 * 4,
      stride,
    })
  }
}

class NativeMaterialBatchShader extends Shader {
  constructor(maxTextures: number, material: NativeBatchMaterial) {
    super({
      glProgram: compileHighShaderGlProgram({
        name: material.name,
        bits: [
          NATIVE_STRAIGHT_VERTEX_COLOR_BIT_GL,
          generateTextureBatchBitGl(maxTextures),
          roundPixelsBitGl,
          NATIVE_TEXTURE_MODE_BIT_GL,
          material,
        ],
      }),
      resources: {
        nativeTextureColor: NATIVE_TEXTURE_COLOR_UNIFORMS,
        batchSamplers: getBatchSamplersUniformGroup(maxTextures),
      },
    })
  }
}

class NativeMaterialBatcher extends Batcher {
  override readonly name = DefaultBatcher.extension.name
  protected override vertexSize = 7
  override geometry = new NativeTextureAlphaBatchGeometry()
  override shader: NativeMaterialBatchShader
  readonly material: NativeBatchMaterial

  constructor(options: NativeBatchOptions, material: NativeBatchMaterial) {
    super(options)
    this.material = material
    this.shader = new NativeMaterialBatchShader(
      options.maxTextures, material,
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
    const drawable = (element as BatchableMesh | BatchableGraphics).renderable
    const vertexColors = nativeVertexColors.get(drawable)
    const end = element.attributeOffset + element.attributeSize
    const nativeTextureModeValue = nativeTextureMode(element.texture, drawable) + this.blendFlag(element)
    for (let vertex = element.attributeOffset; vertex < end; vertex += 1) {
      const coordinate = vertex * 2
      const x = positions[coordinate]!
      const y = positions[coordinate + 1]!
      float32View[index++] = transform.a * x + transform.c * y + transform.tx
      float32View[index++] = transform.d * y + transform.b * x + transform.ty
      float32View[index++] = uvs[coordinate]!
      float32View[index++] = uvs[coordinate + 1]!
      // Registered colors belong to Mesh; Pixi's BatchableMesh starts at vertex zero.
      const vertexColor = vertexColors?.[vertex]
      uint32View[index++] = vertexColor === undefined
        ? element.color
        : multiplyNativePackedColors(vertexColor, element.color)
      uint32View[index++] = textureIdAndRound
      float32View[index++] = nativeTextureModeValue
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
    const nativeTextureModeValue = nativeTextureMode(texture, (element as BatchableSprite | BatchableGraphics).renderable)
      + this.blendFlag(element)
    float32View[index++] = transform.a * bounds.minX + transform.c * bounds.minY + transform.tx
    float32View[index++] = transform.d * bounds.minY + transform.b * bounds.minX + transform.ty
    float32View[index++] = uvs.x0
    float32View[index++] = uvs.y0
    uint32View[index++] = element.color
    uint32View[index++] = textureIdAndRound
    float32View[index++] = nativeTextureModeValue
    float32View[index++] = transform.a * bounds.maxX + transform.c * bounds.minY + transform.tx
    float32View[index++] = transform.d * bounds.minY + transform.b * bounds.maxX + transform.ty
    float32View[index++] = uvs.x1
    float32View[index++] = uvs.y1
    uint32View[index++] = element.color
    uint32View[index++] = textureIdAndRound
    float32View[index++] = nativeTextureModeValue
    float32View[index++] = transform.a * bounds.maxX + transform.c * bounds.maxY + transform.tx
    float32View[index++] = transform.d * bounds.maxY + transform.b * bounds.maxX + transform.ty
    float32View[index++] = uvs.x2
    float32View[index++] = uvs.y2
    uint32View[index++] = element.color
    uint32View[index++] = textureIdAndRound
    float32View[index++] = nativeTextureModeValue
    float32View[index++] = transform.a * bounds.minX + transform.c * bounds.maxY + transform.tx
    float32View[index++] = transform.d * bounds.maxY + transform.b * bounds.minX + transform.ty
    float32View[index++] = uvs.x3
    float32View[index++] = uvs.y3
    uint32View[index++] = element.color
    uint32View[index++] = textureIdAndRound
    float32View[index] = nativeTextureModeValue
  }

  protected blendFlag(_element: BatchableElement): number { return 0 }

  override destroy(): void {
    this.shader?.destroy(true)
    super.destroy({ shader: true })
  }
}

/** Opaque screen RGB is observable; alpha in every intermediate target still is. */
class NativeOpaquePass {
  enabled = false
  readonly root: Container
  private readonly renderer: WebGLRenderer

  constructor(renderer: WebGLRenderer, root: Container) {
    this.renderer = renderer
    this.root = root
  }

  prerender({ container, target }: RenderOptions): void {
    let belongsToRender = false
    let alphaConsumer = false
    for (let node: Container | null = this.root; node; node = node.parent) {
      belongsToRender ||= node === container
      alphaConsumer ||= consumesNativeAlpha(node)
    }
    if (!belongsToRender) return
    const enabled = !alphaConsumer && target === this.renderer.view.renderTarget
      && this.renderer.gl.getContextAttributes()?.alpha === false
    if (enabled === this.enabled) return
    this.enabled = enabled
    if (this.root.renderGroup) this.root.renderGroup.structureDidChange = true
  }

  accepts(element: NativeBatchElement): boolean {
    if (!this.enabled || !supportsNativeOpaqueBlend(element)) return false
    let node: Container | null = (element as BatchableMesh | BatchableSprite | BatchableGraphics).renderable
    while (node) {
      if (consumesNativeAlpha(node)) return false
      if (node === this.root) return true
      node = node.parent
    }
    return false
  }
}

function consumesNativeAlpha(node: Container): boolean {
  return (node.effects?.length ?? 0) > 0 || node.renderGroup?.isCachedAsTexture === true
}

function supportsNativeOpaqueBlend(element: NativeBatchElement): boolean {
  if (element.topology !== 'triangle-list') return false
  const mode = element.blendMode
  if (mode === 'normal' || mode === 'add') return true
  // Explicit NPM factors on a PMA source apply alpha twice in the old draw.
  // Keep that equation and strip/line primitive boundaries outside H1.
  return element.texture.source.alphaMode === 'no-premultiply-alpha'
    && (mode === 'normal-npm' || mode === 'add-npm')
}

class NativeOpaqueBatch extends Batch {
  declare opaque: boolean
}

/** Own the batch records; never alter Pixi's global pool or a drawable's blend mode. */
class NativeOpaqueMaterialBatcher extends NativeMaterialBatcher {
  readonly pass: NativeOpaquePass
  private readonly pending: NativeBatchElement[] = []

  constructor(options: NativeBatchOptions, material: NativeBatchMaterial, pass: NativeOpaquePass) {
    super(options, material)
    this.pass = pass
  }

  override begin(): void {
    for (const batch of this.batches) {
      batch.textures.clear()
      batch.elements.length = 0
    }
    this.indexSize = this.attributeSize = this.batchIndex = 0
    this.pending.length = 0
  }

  override add(element: BatchableElement): void {
    this.pending.push(element as NativeBatchElement)
    element._indexStart = this.indexSize
    element._attributeStart = this.attributeSize
    element._batcher = this
    this.indexSize += element.indexSize
    this.attributeSize += element.attributeSize * this.vertexSize
  }

  override break(instructionSet: InstructionSet): void {
    this.ensureAttributeBuffer(this.attributeSize)
    this.ensureIndexBuffer(this.indexSize)
    let batch: NativeOpaqueBatch | null = null
    for (const element of this.pending) {
      const source = element.texture.source
      const opaque = this.pass.accepts(element)
      const blendMode: Batch['blendMode'] = opaque ? 'normal' : getAdjustedBlendModeBlend(element.blendMode, source)
      if (!batch || batch.blendMode !== blendMode || batch.opaque !== opaque
        || batch.topology !== element.topology
        || (batch.textures.ids[source.uid] == null && batch.textures.count >= this.maxTextures)) {
        const action: Batch['action'] = batch ? 'renderBatch' : 'startBatch'
        batch = (this.batches[this.batchIndex++] ??= new NativeOpaqueBatch()) as NativeOpaqueBatch
        batch.action = action
        batch.batcher = this
        batch.blendMode = blendMode
        batch.opaque = opaque
        batch.topology = element.topology
        batch.start = element._indexStart
        batch.size = 0
        batch.elements ??= []
        instructionSet.add(batch)
      }
      let textureId = batch.textures.ids[source.uid]
      if (textureId == null) {
        textureId = batch.textures.count++
        batch.textures.ids[source.uid] = textureId
        batch.textures.textures[textureId] = source
      }
      element._textureId = textureId
      element._batch = batch
      batch.elements.push(element)
      batch.size += element.indexSize
      this.updateElement(element)
      const vertexStart = element._attributeStart / this.vertexSize
      if (element.packAsQuad) this.packQuadIndex(this.indexBuffer, element._indexStart, vertexStart)
      else this.packIndex(element, this.indexBuffer, element._indexStart, vertexStart)
    }
    this.pending.length = 0
  }

  protected override blendFlag(element: BatchableElement): number {
    if (!(element._batch as NativeOpaqueBatch).opaque) return 0
    return element.blendMode === 'add' || element.blendMode === 'add-npm' ? 8 : 4
  }

  override destroy(): void {
    if (!this.batches) return
    for (const batch of this.batches) batch.destroy()
    this.batchIndex = 0
    this.pending.length = 0
    super.destroy()
  }
}

export function nativePackedColor(color: number, alpha: number): number {
  const blueGreenRed = color >> 16 | color & 0x00ff00 | (color & 0xff) << 16
  return (blueGreenRed + (Math.trunc(Math.min(1, Math.max(0, alpha)) * 255) << 24)) >>> 0
}

export function setNativeVertexColors(
  renderable: Mesh,
  colors: Uint32Array,
): void {
  nativeVertexColors.set(renderable, colors)
  const buffer = renderable.geometry.attributes.aColor?.buffer
  if (buffer) buffer.data = colors
  else renderable.geometry.addAttribute('aColor', {
    buffer: new Buffer({ data: colors, usage: BufferUsage.VERTEX | BufferUsage.COPY_DST }),
    format: 'unorm8x4', offset: 0, stride: 4,
  })
}

/** Registered arrays are mutable; standalone draws must upload their current channels too. */
export function updateNativeMeshVertexColors(renderable: Mesh): boolean {
  if (!nativeVertexColors.has(renderable)) return false
  renderable.geometry.getBuffer('aColor').update()
  return true
}

function multiplyNativePackedColors(vertex: number, group: number): number {
  switch (group) {
    // Stryker disable next-line ConditionalExpression: Equivalent: omitting the white identity case performs the same channel multiplication below.
    case 0xffffffff: return vertex
  }
  const red = (vertex & 0xff) * (group & 0xff) / 0xff | 0
  const green = (vertex >> 8 & 0xff) * (group >> 8 & 0xff) / 0xff | 0
  const blue = (vertex >> 16 & 0xff) * (group >> 16 & 0xff) / 0xff | 0
  const alpha = (vertex >>> 24) * (group >>> 24) / 0xff | 0
  return (red | green << 8 | blue << 16 | alpha << 24) >>> 0
}

/** Low bit is texture alpha format; high bit selects diffuse RGB. */
export function nativeTextureMode(texture: Texture, drawable: object): number {
  return (texture.source.alphaMode === 'no-premultiply-alpha' ? 0 : 1) + (usesNativeDiffuseColor(drawable) ? 2 : 0)
}

export function installNativeBatchMaterial(
  renderer: WebGLRenderer, material: NativeBatchMaterial, opaqueRoot?: Container,
): () => void {
  const pipe = renderer.renderPipes.batch
  const batchersByInstructionSet = pipe['_batchersByInstructionSet'] as Record<number, Record<string, Batcher>>
  const previous = pipe.buildStart
  const opaquePass = opaqueRoot ? new NativeOpaquePass(renderer, opaqueRoot) : null
  if (opaquePass) renderer.runners.prerender.add(opaquePass)
  for (const batchers of Object.values(batchersByInstructionSet)) {
    invalidateBatchRenderGroups(batchers.default)
  }
  const restoreTextureColor = installNativeTextureColorSync(pipe['_adaptor'] as GlBatchAdaptor, renderer.shader)
  pipe.buildStart = function buildNativeMaterialBatch(instructionSet): void {
    const batchers = batchersByInstructionSet[instructionSet.uid] ??= {}
    const current = batchers.default
    const pass = opaquePass?.root.renderGroup?.instructionSet === instructionSet ? opaquePass : null
    const currentPass = current instanceof NativeOpaqueMaterialBatcher ? current.pass : null
    if (!(current instanceof NativeMaterialBatcher) || current.material !== material || currentPass !== pass) {
      current?.destroy()
      const options = { maxTextures: renderer.limits.maxBatchableTextures }
      batchers.default = pass ? new NativeOpaqueMaterialBatcher(options, material, pass)
        : new NativeMaterialBatcher(options, material)
    }
    BatcherPipe.prototype.buildStart.call(this, instructionSet)
  }
  const lifetime = {
    destroy(): void {
      if (opaquePass) renderer.runners.prerender.remove(opaquePass)
      for (const [uid, batchers] of Object.entries(batchersByInstructionSet)) {
        const current = batchers.default
        if (!(current instanceof NativeMaterialBatcher) || current.material !== material) continue
        invalidateBatchRenderGroups(current)
        for (const name of Object.keys(batchers)) {
          batchers[name]!.destroy()
          delete batchers[name]
        }
        delete batchersByInstructionSet[Number(uid)]
      }
    },
  }
  renderer.runners.destroy.add(lifetime)
  return () => {
    renderer.runners.destroy.remove(lifetime)
    lifetime.destroy()
    restoreTextureColor()
    pipe.buildStart = previous
  }
}

function invalidateBatchRenderGroups(batcher: Batcher): void {
  for (let index = 0; index < batcher.batchIndex; index += 1) {
    const elements = batcher.batches[index]!.elements as (BatchableMesh | BatchableGraphics | BatchableSprite)[]
    for (const { renderable } of elements) {
      const group = renderable?.renderGroup ?? renderable?.parentRenderGroup
      if (group) group.structureDidChange = true
    }
  }
}

export function requireNativeWebGlRenderer(renderer: Renderer): WebGLRenderer {
  const webgl = renderer as WebGLRenderer
  if (!webgl.gl) {
    throw new TypeError('Native materials require an initialized WebGL renderer')
  }
  return webgl
}
