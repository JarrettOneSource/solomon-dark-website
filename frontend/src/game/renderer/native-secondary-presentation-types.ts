import type { Vector2 } from '../core-kernels/vector.ts'
import type { NativeSecondaryAtlas } from './native-secondary-assets.ts'

export interface NativeSecondarySpriteDraw {
  readonly alpha: number
  readonly atlas: NativeSecondaryAtlas
  readonly blend: 'add' | 'normal'
  readonly colorMode?: 'alpha-mask' | 'texture'
  readonly entry: number
  readonly offset: Vector2
  readonly role: string
  readonly rotationRadians: number
  readonly scaleX: number
  readonly scaleY: number
  readonly tint: number
}

export interface NativeSecondaryQuadDraw {
  readonly alpha: number
  readonly atlas: NativeSecondaryAtlas | null
  readonly blend: 'add' | 'normal'
  readonly entry: number | null
  readonly role: string
  /** Local XY pairs ordered top-left, top-right, bottom-left, bottom-right. */
  readonly vertices: readonly number[]
  readonly tint: number
}

export interface NativeSecondaryMeshDraw {
  readonly alpha: number
  readonly blend: 'add' | 'normal'
  readonly indices: readonly number[]
  readonly role: string
  readonly texture: 'ether-plane'
  readonly tint: number
  readonly uvs: readonly number[]
  readonly vertexColors: readonly number[]
  readonly vertices: readonly number[]
}

export const NATIVE_LEVIATHAN_RENDER_TARGET_SIZE = 256

export interface NativeLeviathanCompositePlan {
  readonly clear: Readonly<{
    blend: 'multiply'
    color: number
    height: number
    width: number
    x: number
    y: number
  }>
  readonly mask: Readonly<{
    blend: 'multiply'
    clipTop: number
    entry: 39
    scale: number
  }>
  readonly outputs: readonly Readonly<{
    alpha: number
    blend: 'add' | 'normal'
  }>[]
}

export interface NativeSecondaryGradientDraw {
  readonly bottomAlpha: number
  readonly bottomColor: number
  readonly height: number
  readonly role: string
  readonly topAlpha: number
  readonly topColor: number
  readonly topLeft: Vector2
  readonly width: number
}

export const NATIVE_SECONDARY_RAINDROP_GRADIENTS = {
  acid: {
    bottomAlpha: 0.5,
    bottomColor: 0xb3f2bf,
    topAlpha: 0,
    topColor: 0x66f280,
    width: 3,
  },
  storm: {
    bottomAlpha: 0.5,
    bottomColor: 0xccf2ff,
    topAlpha: 0,
    topColor: 0x66f2ff,
    width: 2,
  },
} as const

export interface NativeSecondaryPresentationPlan {
  readonly draws: readonly NativeSecondarySpriteDraw[]
  readonly gradients: readonly NativeSecondaryGradientDraw[]
  readonly meshes: readonly NativeSecondaryMeshDraw[]
  readonly quads: readonly NativeSecondaryQuadDraw[]
  readonly queueFamily: 'ordinary-dynamic' | 'zanim'
  readonly root: Vector2
  readonly sortBias: number
  readonly stormComposite: NativeStormWeatherComposite | null
  readonly underlayDraws: readonly NativeSecondarySpriteDraw[]
  readonly worldY: number
}

export interface NativeStormWeatherComposite {
  readonly draws: readonly NativeSecondarySpriteDraw[]
  readonly offset: Vector2
  readonly scale: number
}

export interface NativeSecondaryWorldShake {
  readonly x: number
  readonly y: number
}

export interface NativeSecondaryScreenOverlay {
  readonly alpha: number
  readonly color: number
}

export interface NativeSecondaryScreenFeedbackContext {
  readonly cameraCenter: Vector2
  readonly localPlayerAlternate: boolean
  readonly visibleWorldWidth: number
}
