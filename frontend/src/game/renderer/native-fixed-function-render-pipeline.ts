import {
  ImageSource,
  Texture,
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

function nativeStockTextureFromImageWithOptions(
  image: HTMLImageElement,
  options:
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
