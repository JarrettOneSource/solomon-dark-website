import type { NativeSecondaryActorState } from '../core-kernels/native-secondary-abilities.ts'
import type { Vector2 } from '../core-kernels/vector.ts'
import {
  NATIVE_SECONDARY_RAINDROP_GRADIENTS,
  type NativeSecondaryGradientDraw,
  type NativeSecondaryMeshDraw,
  type NativeSecondaryPresentationPlan,
  type NativeSecondaryQuadDraw,
  type NativeSecondarySpriteDraw,
  type NativeStormWeatherComposite,
} from './native-secondary-presentation-types.ts'
import {
  EMPTY_SECONDARY_DRAWS,
  EMPTY_SECONDARY_MESHES,
  EMPTY_SECONDARY_QUADS,
  ZERO_SECONDARY_DRAW_OFFSET,
} from './native-secondary-presentation.ts'

export type MutableSecondarySpriteDraw = {
  -readonly [Field in keyof NativeSecondarySpriteDraw]: NativeSecondarySpriteDraw[Field]
}

type MutableSecondaryGradientDraw = {
  -readonly [Field in keyof NativeSecondaryGradientDraw]: NativeSecondaryGradientDraw[Field]
}

type MutableSecondaryPresentationPlan = {
  -readonly [Field in keyof NativeSecondaryPresentationPlan]: NativeSecondaryPresentationPlan[Field]
}

export type NativeAcidActorState = NativeSecondaryActorState & {
  readonly kind: 'acid-drop' | 'acid-splash'
}

export type NativeStormDropActorState = NativeSecondaryActorState & {
  readonly kind: 'storm-drop'
}

export class NativeSecondaryPresentationScratch {
  private drawCursor = 0
  private readonly drawPool: MutableSecondarySpriteDraw[] = []
  private readonly gradientStorage = {
    topLeft: { x: 0, y: 0 },
  } as MutableSecondaryGradientDraw
  private readonly planStorage = {} as MutableSecondaryPresentationPlan
  private readonly singleDraws: MutableSecondarySpriteDraw[] = []
  private readonly singleGradients: MutableSecondaryGradientDraw[] = []

  reset(): void {
    this.drawCursor = 0
  }

  nextDraw(): MutableSecondarySpriteDraw {
    const index = this.drawCursor
    this.drawCursor += 1
    const draw = this.drawPool[index] ?? ({} as MutableSecondarySpriteDraw)
    if (index === this.drawPool.length) this.drawPool.push(draw)
    return draw
  }

  writeAcidPlan(
    actor: NativeAcidActorState,
  ): NativeSecondaryPresentationPlan {
    const draw = this.nextDraw()
    draw.atlas = 'BadGuys'
    if (draw.colorMode !== undefined) delete draw.colorMode
    draw.offset = ZERO_SECONDARY_DRAW_OFFSET
    draw.scaleX = actor.scale
    draw.scaleY = actor.scale
    this.singleDraws[0] = draw
    this.singleGradients.length = 0
    if (actor.kind === 'acid-splash') {
      draw.alpha = Math.min(1, actor.alpha / ACID_SPLASH_INITIAL_LIFE)
      draw.blend = 'add'
      draw.entry = 10
      draw.role = 'acid-rain-splash'
      draw.rotationRadians = actor.rotationRadians
      draw.tint = 0x80ff80
    } else if (actor.phase < 0) {
      draw.alpha = 0.25
      draw.blend = 'normal'
      draw.entry = 0
      draw.role = 'acid-raindrop-falling'
      draw.rotationRadians = 0
      draw.scaleX = 1
      draw.scaleY = 1
      draw.tint = 0xb3f2bf
      const gradient = this.gradientStorage
      gradient.bottomAlpha = NATIVE_SECONDARY_RAINDROP_GRADIENTS.acid.bottomAlpha
      gradient.bottomColor = NATIVE_SECONDARY_RAINDROP_GRADIENTS.acid.bottomColor
      gradient.height = actor.quantity
      gradient.role = 'acid-raindrop-streak'
      gradient.topAlpha = NATIVE_SECONDARY_RAINDROP_GRADIENTS.acid.topAlpha
      gradient.topColor = NATIVE_SECONDARY_RAINDROP_GRADIENTS.acid.topColor
      gradient.topLeft.x = -1
      gradient.topLeft.y = actor.phase
      gradient.width = NATIVE_SECONDARY_RAINDROP_GRADIENTS.acid.width
      this.singleGradients[0] = gradient
    } else {
      draw.alpha = Math.max(0, 1 - actor.scale * actor.scale)
      draw.blend = 'normal'
      draw.entry = 63
      draw.role = 'acid-raindrop-ground'
      draw.rotationRadians = 0
      draw.tint = 0xccffcc
    }
    return this.writePlan(
      this.singleDraws,
      this.singleGradients,
      EMPTY_SECONDARY_MESHES,
      EMPTY_SECONDARY_QUADS,
      'zanim',
      actor.position,
      0,
      null,
      EMPTY_SECONDARY_DRAWS,
      actor.position.y,
    )
  }

  writeStormDropPlan(
    actor: NativeStormDropActorState,
  ): NativeSecondaryPresentationPlan {
    this.singleDraws.length = 0
    this.singleGradients.length = 0
    if (actor.phase < 0) {
      const gradient = this.gradientStorage
      gradient.bottomAlpha = NATIVE_SECONDARY_RAINDROP_GRADIENTS.storm.bottomAlpha
      gradient.bottomColor = NATIVE_SECONDARY_RAINDROP_GRADIENTS.storm.bottomColor
      gradient.height = actor.quantity
      gradient.role = 'storm-raindrop-streak'
      gradient.topAlpha = NATIVE_SECONDARY_RAINDROP_GRADIENTS.storm.topAlpha
      gradient.topColor = NATIVE_SECONDARY_RAINDROP_GRADIENTS.storm.topColor
      gradient.topLeft.x = 0
      gradient.topLeft.y = actor.phase
      gradient.width = NATIVE_SECONDARY_RAINDROP_GRADIENTS.storm.width
      this.singleGradients[0] = gradient
    } else {
      const draw = this.nextDraw()
      draw.alpha = Math.max(0, 1 - actor.scale * actor.scale)
      draw.atlas = 'BadGuys'
      draw.blend = 'normal'
      if (draw.colorMode !== undefined) delete draw.colorMode
      draw.entry = 63
      draw.offset = ZERO_SECONDARY_DRAW_OFFSET
      draw.role = 'storm-raindrop-ground'
      draw.rotationRadians = 0
      draw.scaleX = actor.scale
      draw.scaleY = actor.scale
      draw.tint = 0xccffff
      this.singleDraws[0] = draw
    }
    return this.writePlan(
      this.singleDraws,
      this.singleGradients,
      EMPTY_SECONDARY_MESHES,
      EMPTY_SECONDARY_QUADS,
      'zanim',
      actor.position,
      0,
      null,
      EMPTY_SECONDARY_DRAWS,
      actor.position.y,
    )
  }

  copyPlan(source: NativeSecondaryPresentationPlan): NativeSecondaryPresentationPlan {
    const target = this.planStorage
    target.draws = source.draws
    target.gradients = source.gradients
    target.meshes = source.meshes
    target.quads = source.quads
    target.queueFamily = source.queueFamily
    target.root = source.root
    target.sortBias = source.sortBias
    target.stormComposite = source.stormComposite
    target.underlayDraws = source.underlayDraws
    target.worldY = source.worldY
    return target
  }

  writePlan(
    draws: readonly NativeSecondarySpriteDraw[],
    gradients: readonly NativeSecondaryGradientDraw[],
    meshes: readonly NativeSecondaryMeshDraw[],
    quads: readonly NativeSecondaryQuadDraw[],
    queueFamily: NativeSecondaryPresentationPlan['queueFamily'],
    root: Vector2,
    sortBias: number,
    stormComposite: NativeStormWeatherComposite | null,
    underlayDraws: readonly NativeSecondarySpriteDraw[],
    worldY: number,
  ): NativeSecondaryPresentationPlan {
    const target = this.planStorage
    target.draws = draws
    target.gradients = gradients
    target.meshes = meshes
    target.quads = quads
    target.queueFamily = queueFamily
    target.root = root
    target.sortBias = sortBias
    target.stormComposite = stormComposite
    target.underlayDraws = underlayDraws
    target.worldY = worldY
    return target
  }
}

export const ACID_SPLASH_INITIAL_LIFE = Math.fround(0.25)
