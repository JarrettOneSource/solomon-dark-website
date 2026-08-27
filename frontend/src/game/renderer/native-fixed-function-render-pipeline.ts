import {
  ImageSource,
  Texture,
  type Renderer,
} from 'pixi.js'

export const NATIVE_STOCK_TEXTURE_SOURCE_OPTIONS = Object.freeze({
  alphaMode: 'no-premultiply-alpha' as const,
  scaleMode: 'linear' as const,
})

type NativeAddressMode = 'clamp-to-edge' | 'repeat'
type NativeBlendFactors = readonly [
  sourceRgb: number,
  destinationRgb: number,
  sourceAlpha: number,
  destinationAlpha: number,
]

interface NativeGlBlendConstants {
  readonly SRC_ALPHA: number
  readonly SRC_COLOR: number
  readonly ZERO: number
}

interface NativeWebGlRendererInternals {
  readonly gl?: NativeGlBlendConstants
  readonly state?: {
    readonly blendModesMap?: Record<string, number[]>
  }
}

const installedRenderers = new WeakSet<object>()

export function nativeFixedFunctionMultiplyBlendFactors(
  gl: NativeGlBlendConstants,
): NativeBlendFactors {
  return [gl.ZERO, gl.SRC_COLOR, gl.ZERO, gl.SRC_ALPHA]
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

export function installNativeFixedFunctionRenderPipeline(renderer: Renderer): void {
  if (installedRenderers.has(renderer)) return
  const internals = renderer as unknown as NativeWebGlRendererInternals
  const blendModes = internals.state?.blendModesMap
  const gl = internals.gl
  if (!blendModes || !gl) {
    throw new Error('Native fixed-function rendering requires Pixi WebGL state internals.')
  }
  blendModes.multiply = [...nativeFixedFunctionMultiplyBlendFactors(gl)]
  installedRenderers.add(renderer)
}

export function nativeStockTextureFromImage(
  image: HTMLImageElement,
  addressMode: NativeAddressMode = 'clamp-to-edge',
): Texture {
  return new Texture({
    source: new ImageSource({
      ...NATIVE_STOCK_TEXTURE_SOURCE_OPTIONS,
      addressMode,
      resource: image,
    }),
  })
}
