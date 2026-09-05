import {
  BatchGeometry, Batcher, BatcherPipe, DefaultBatcher, Shader,
  compileHighShaderGlProgram, generateTextureBatchBitGl, getBatchSamplersUniformGroup,
  roundPixelsBitGl, type BatchableGraphics, type BatchableMesh, type BatchableSprite,
  type GlBatchAdaptor, type Mesh, type Renderer, type Texture, type WebGLRenderer,
} from 'pixi.js'
import { installNativeTextureColorSync, NATIVE_TEXTURE_COLOR_UNIFORMS } from './native-texture-color.ts'

type NativeBatchMeshElement = Parameters<DefaultBatcher['packAttributes']>[0]
type NativeBatchQuadElement = Parameters<DefaultBatcher['packQuadAttributes']>[0]
type NativeBatchOptions = ConstructorParameters<typeof DefaultBatcher>[0]
export interface NativeBatchMaterial {
  readonly name: string
  readonly fragment: { readonly header?: string; readonly end: string }
}
const nativeVertexColors = new WeakMap<object, Uint32Array>()

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

class NativeTextureAlphaBatchGeometry extends BatchGeometry {
  constructor() {
    super()
    const stride = 7 * 4
    for (const attribute of Object.values(this.attributes)) attribute.stride = stride
    this.addAttribute('aTexturePremultiplied', {
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
          NATIVE_TEXTURE_ALPHA_MODE_BIT_GL,
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
    const vertexColors = nativeVertexColors.get(
      (element as BatchableMesh | BatchableGraphics).renderable,
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
      // Registered colors belong to Mesh; Pixi's BatchableMesh starts at vertex zero.
      const vertexColor = vertexColors?.[vertex]
      uint32View[index++] = vertexColor === undefined
        ? element.color
        : multiplyNativePackedColors(vertexColor, element.color)
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

  override destroy(): void {
    this.shader?.destroy(true)
    super.destroy({ shader: true })
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
}

function multiplyNativePackedColors(vertex: number, group: number): number {
  const red = (vertex & 0xff) * (group & 0xff) / 0xff | 0
  const green = (vertex >> 8 & 0xff) * (group >> 8 & 0xff) / 0xff | 0
  const blue = (vertex >> 16 & 0xff) * (group >> 16 & 0xff) / 0xff | 0
  const alpha = (vertex >>> 24) * (group >>> 24) / 0xff | 0
  return (red | green << 8 | blue << 16 | alpha << 24) >>> 0
}

export function nativeTextureIsPremultiplied(texture: Texture): 0 | 1 {
  return texture.source.alphaMode === 'no-premultiply-alpha' ? 0 : 1
}

export function installNativeBatchMaterial(renderer: WebGLRenderer, material: NativeBatchMaterial): () => void {
  const pipe = renderer.renderPipes.batch
  const batchersByInstructionSet = pipe['_batchersByInstructionSet'] as Record<number, Record<string, Batcher>>
  const previous = pipe.buildStart
  for (const batchers of Object.values(batchersByInstructionSet)) {
    invalidateBatchRenderGroups(batchers.default)
  }
  const restoreTextureColor = installNativeTextureColorSync(pipe['_adaptor'] as GlBatchAdaptor, renderer.shader)
  pipe.buildStart = function buildNativeMaterialBatch(instructionSet): void {
    const batchers = batchersByInstructionSet[instructionSet.uid] ??= {}
    const current = batchers.default
    if (!(current instanceof NativeMaterialBatcher) || current.material !== material) {
      current?.destroy()
      batchers.default = new NativeMaterialBatcher({ maxTextures: renderer.limits.maxBatchableTextures }, material)
    }
    BatcherPipe.prototype.buildStart.call(this, instructionSet)
  }
  const lifetime = {
    destroy(): void {
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
