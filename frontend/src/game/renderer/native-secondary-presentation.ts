import type {
  NativeSecondaryActorState,
  NativeSecondaryEventState,
  NativeSecondaryPlayerState,
} from '../core-kernels/native-secondary-abilities.ts'
import {
  nativeLeviathanAppendageLocalRoot,
  nativeLeviathanAppendageRecord,
} from '../core-kernels/native-secondary-leviathan.ts'
import {
  advanceNativeRngWords,
  drawNativeFloat,
  drawNativeInteger,
  drawNativeSign,
  type NativeRngState,
} from '../core-kernels/native-rng.ts'
import type { Vector2 } from '../core-kernels/vector.ts'
import type { PrimarySpellEtherBlastState } from '../core-kernels/primary-spells.ts'
import type { BoneyardEnemyProjectileSnapshot } from '../protocol/game-state.ts'
import {
  NATIVE_ETHER_BLAST_SCREEN_FLASH_DECAY,
  NATIVE_ETHER_BLAST_SCREEN_GREEN,
} from '../core-kernels/native-ether-blast.ts'
import { roundHalfToEven } from './native-enemy-presentation.ts'
import { nativeEnemyProjectilePlan } from './native-enemy-projectile-presentation.ts'
import type { NativeSecondaryAtlas } from './native-secondary-assets.ts'
import {
  ETHER_PRIMARY_FLIGHT_RECORDS,
  etherPrimaryCompositorPlan,
} from './primary-spell-ether-native.ts'
import {
  nativeFireEmberPlan,
  nativeFireExplosionPlan,
  type NativeFireActorDraw,
} from './primary-spell-fire-native.ts'

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

type MutableSecondarySpriteDraw = {
  -readonly [Field in keyof NativeSecondarySpriteDraw]: NativeSecondarySpriteDraw[Field]
}

type MutableSecondaryGradientDraw = {
  -readonly [Field in keyof NativeSecondaryGradientDraw]: NativeSecondaryGradientDraw[Field]
}

type MutableSecondaryPresentationPlan = {
  -readonly [Field in keyof NativeSecondaryPresentationPlan]: NativeSecondaryPresentationPlan[Field]
}

type NativeAcidActorState = NativeSecondaryActorState & {
  readonly kind: 'acid-drop' | 'acid-splash'
}

type NativeStormDropActorState = NativeSecondaryActorState & {
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

const REDUCED_SCREEN_FLASH_ALPHA_SCALE = 0.2

export function presentNativeSecondaryScreenOverlay(
  overlay: NativeSecondaryScreenOverlay | null,
  reducedScreenFlashes: boolean,
): NativeSecondaryScreenOverlay | null {
  if (overlay === null || !reducedScreenFlashes) return overlay
  return {
    alpha: overlay.alpha * REDUCED_SCREEN_FLASH_ALPHA_SCALE,
    color: overlay.color,
  }
}

export interface NativeSecondaryScreenFeedbackContext {
  readonly cameraCenter: Vector2
  readonly localPlayerAlternate: boolean
  readonly visibleWorldWidth: number
}

export function nativeSecondaryCompositeOwnerEntries(
  actors: readonly NativeSecondaryActorState[],
  worldKey: string,
): readonly (readonly [actorId: number, ownerId: number])[] {
  const liveIds = new Set(actors
    .filter((actor) => actor.worldKey === worldKey)
    .map(({ id }) => id))
  return actors.flatMap((actor) => {
    if (actor.worldKey !== worldKey || actor.kind !== 'leviathan-appendage') return []
    const parentId = actor.hitTargetIds[0]
    return parentId !== undefined && liveIds.has(parentId)
      ? [[actor.id, parentId] as const]
      : []
  })
}

export function nativeLeviathanCompositePlan(scale: number): NativeLeviathanCompositePlan {
  return {
    clear: {
      blend: 'multiply',
      color: 0x000000,
      height: 1_000,
      width: NATIVE_LEVIATHAN_RENDER_TARGET_SIZE,
      x: 0,
      y: NATIVE_LEVIATHAN_RENDER_TARGET_SIZE / 2 + 64 * scale,
    },
    mask: {
      blend: 'multiply',
      clipTop: NATIVE_LEVIATHAN_RENDER_TARGET_SIZE / 2,
      entry: 39,
      scale,
    },
    outputs: [
      { alpha: 1, blend: 'normal' },
      { alpha: 0.5, blend: 'add' },
    ],
  }
}

const WHITE = 0xffffff
const GOLEM_IRON_TINT = 0x595959
const GOLEM_DRAW_SCALE = 1.1109999418258667
const GOLEM_HALF_DRAW_SCALE = 0.5554999709129333
const GOLEM_STAR_TINT = 0xa6ffa6
const ACID_SPLASH_INITIAL_LIFE = Math.fround(0.25)
const MAGIC_SHIELD_EXPLOSION_CAMERA_DECAY = Math.fround(0.94)
const MAGIC_SHIELD_EXPLOSION_CAMERA_CUTOFF = Math.fround(0.001)
const MAGIC_TRAP_FULL_DRAW_THRESHOLD = Math.fround(0.9900000095367432)
const MAGIC_TRAP_SELECTOR_COLORS = Object.freeze([
  Object.freeze([1, 0.1, 1] as const),
  Object.freeze([1, 0.35, 0.1] as const),
  Object.freeze([0.1, 1, 1] as const),
  Object.freeze([0.1, 0.5, 1] as const),
  Object.freeze([0.1, 1, 0.1] as const),
  Object.freeze([1, 0.5, 0.1] as const),
  Object.freeze([0.1, 0.5, 0.5] as const),
  Object.freeze([0.75, 0.75, 0.75] as const),
  Object.freeze([1, 1, 1] as const),
])
const EMPTY_GOLEM_FRONT_GLOW_RECORDS = new Set([81, 83, 84, 94, 96])
const FIRE_DRAW_SCALE = 1.100000023841858

export interface NativePlayerMagicShieldPlan {
  readonly scale: number
  readonly tint: number
  readonly visible: boolean
}

export function nativePlayerMaterialTint(
  worldTint: number,
  state: NativeSecondaryPlayerState | undefined,
): number {
  if ((state?.stoneskinTicksRemaining ?? 0) <= 0) return worldTint
  const half = (shift: number): number => Math.round(((worldTint >> shift) & 0xff) * 0.5)
  return (half(16) << 16) | (half(8) << 8) | half(0)
}

export function nativePlayerMagicShieldPlan(
  state: NativeSecondaryPlayerState | undefined,
  tick: number,
): NativePlayerMagicShieldPlan {
  const visible = (state?.magicShieldAbsorb ?? 0) > 0
  if (!visible || !state) return { scale: 1.5, tint: WHITE, visible: false }
  const pulse = state.magicShieldPulseTicks * 0.05
  const brightness = 0.5 * (Math.max(pulse, 1) - 1) + 0.25
  return {
    scale: 1.5 + 0.1 * Math.sin(tick * 20 * Math.PI / 180) * Math.min(pulse, 1),
    tint: (Math.round(Math.min(1, brightness) * 255) << 16) | 0x00ffff,
    visible: true,
  }
}

export function nativeSecondaryWorldShake(
  actors: readonly NativeSecondaryActorState[],
  worldKey: string,
  current: Readonly<Vector2> = { x: 0, y: 0 },
): NativeSecondaryWorldShake {
  let selected: NativeSecondaryWorldShake = {
    x: Math.fround(current.x),
    y: Math.fround(current.y),
  }
  let selectedMagnitudeSquared = selected.x * selected.x + selected.y * selected.y
  for (const actor of actors) {
    if (actor.worldKey !== worldKey) continue
    if (actor.kind === 'earthquake') {
      const magnitudeSquared = actor.velocity.x * actor.velocity.x
        + actor.velocity.y * actor.velocity.y
      if (magnitudeSquared > selectedMagnitudeSquared) {
        selected = { x: actor.velocity.x, y: actor.velocity.y }
        selectedMagnitudeSquared = magnitudeSquared
      }
      continue
    }
  }
  return selected
}

export function nativeRegionPointGain(
  position: Vector2,
  cameraCenter: Vector2,
  visibleWorldWidth: number,
  localPlayerAlternate: boolean,
): number {
  if (!(visibleWorldWidth > 0)) return 0
  const width = Math.fround(visibleWorldWidth)
  const distance = Math.fround(Math.hypot(
    Math.fround(position.x - cameraCenter.x),
    Math.fround(position.y - cameraCenter.y),
  ))
  const fullGainDistance = Math.fround(width * Math.fround(0.25))
  const zeroGainDistance = Math.fround(width * Math.fround(1.1))
  const gain = distance <= fullGainDistance
    ? 1
    : distance >= zeroGainDistance
      ? 0
      : Math.fround(
          Math.fround(zeroGainDistance - distance)
          / Math.fround(zeroGainDistance - fullGainDistance),
        )
  return localPlayerAlternate
    ? Math.fround(gain * Math.fround(0.1))
    : gain
}

export class NativeSecondaryScreenFeedbackPresentation {
  private alpha = 0
  private blue = 1
  private cameraDisplacementX = 0
  private cameraDisplacementY = 0
  private cameraMagnitude = 0
  private green = 1
  private lastEventId = 0
  private lastPrimaryImpactId = 0
  private lastPrimaryFeedbackId = 0
  private lastPrimaryMagnitudeId = 0
  private lastTick: number
  private red = 1
  private decayPerTick = 0
  private readonly worldKey: string

  constructor(
    initialTick: number,
    worldKey: string,
  ) {
    this.lastTick = Math.max(0, Math.trunc(initialTick))
    this.worldKey = worldKey
  }

  consume(
    event: NativeSecondaryEventState,
    context: NativeSecondaryScreenFeedbackContext,
  ): void {
    if (event.eventId <= this.lastEventId) return
    this.lastEventId = event.eventId
    if (event.worldKey !== this.worldKey) return

    const eventTick = Math.max(0, Math.trunc(event.tick))
    if (eventTick > this.lastTick) this.advanceTo(eventTick)
    if (event.cameraMagnitude > 0) {
      this.cameraMagnitude = Math.fround(event.cameraMagnitude)
      if (eventTick < this.lastTick) {
        this.cameraMagnitude = repeatedFloatMultiply(
          this.cameraMagnitude,
          MAGIC_SHIELD_EXPLOSION_CAMERA_DECAY,
          this.lastTick - eventTick,
        )
      }
    }
    if (event.cameraDisplacement !== null) {
      let x = Math.fround(event.cameraDisplacement.x)
      let y = Math.fround(event.cameraDisplacement.y)
      if (eventTick < this.lastTick) {
        x = repeatedFloatMultiply(x, Math.fround(0.75), this.lastTick - eventTick)
        y = repeatedFloatMultiply(y, Math.fround(0.75), this.lastTick - eventTick)
      }
      const currentSquared = this.cameraDisplacementX * this.cameraDisplacementX
        + this.cameraDisplacementY * this.cameraDisplacementY
      const incomingSquared = x * x + y * y
      if (incomingSquared >= currentSquared) {
        this.cameraDisplacementX = x
        this.cameraDisplacementY = y
      }
    }
    const flash = event.screenFlash
    if (flash === null) return
    const pointGain = flash.pointAttenuated
      ? nativeRegionPointGain(
          event.position,
          context.cameraCenter,
          context.visibleWorldWidth,
          context.localPlayerAlternate,
        )
      : 1
    this.alpha = Math.fround(flash.alpha * pointGain)
    this.blue = flash.blue
    this.decayPerTick = flash.decayPerTick
    this.green = flash.green
    this.red = flash.red
    if (eventTick < this.lastTick) {
      this.alpha = repeatedFloatDecay(
        this.alpha,
        this.decayPerTick,
        this.lastTick - eventTick,
      )
    }
  }

  consumePrimaryCameraDisplacement(input: Readonly<{
    displacement: Readonly<{ x: number; y: number }>
    eventId: number
    tick: number
    worldKey: string
  }>): void {
    if (input.eventId <= this.lastPrimaryImpactId) return
    this.lastPrimaryImpactId = input.eventId
    if (input.worldKey !== this.worldKey) return
    const eventTick = Math.max(0, Math.trunc(input.tick))
    if (eventTick > this.lastTick) this.advanceTo(eventTick)
    let x = Math.fround(input.displacement.x)
    let y = Math.fround(input.displacement.y)
    if (eventTick < this.lastTick) {
      x = repeatedFloatMultiply(x, Math.fround(0.75), this.lastTick - eventTick)
      y = repeatedFloatMultiply(y, Math.fround(0.75), this.lastTick - eventTick)
    }
    const currentSquared = this.cameraDisplacementX * this.cameraDisplacementX
      + this.cameraDisplacementY * this.cameraDisplacementY
    if (x * x + y * y >= currentSquared) {
      this.cameraDisplacementX = x
      this.cameraDisplacementY = y
    }
  }

  consumePrimaryEtherBlast(
    effect: PrimarySpellEtherBlastState,
    context: NativeSecondaryScreenFeedbackContext,
  ): void {
    if (effect.id <= this.lastPrimaryFeedbackId) return
    this.lastPrimaryFeedbackId = effect.id
    if (effect.worldKey !== this.worldKey) return
    const eventTick = Math.max(0, Math.trunc(effect.birthTick))
    if (eventTick > this.lastTick) this.advanceTo(eventTick)
    this.cameraMagnitude = Math.fround(effect.charges * Math.fround(0.1))
    this.alpha = nativeRegionPointGain(
      effect.origin,
      context.cameraCenter,
      context.visibleWorldWidth,
      context.localPlayerAlternate,
    )
    this.blue = 1
    this.decayPerTick = NATIVE_ETHER_BLAST_SCREEN_FLASH_DECAY
    this.green = NATIVE_ETHER_BLAST_SCREEN_GREEN
    this.red = 1
    if (eventTick < this.lastTick) {
      const elapsed = this.lastTick - eventTick
      this.alpha = repeatedFloatDecay(this.alpha, this.decayPerTick, elapsed)
      this.cameraMagnitude = repeatedFloatMultiply(
        this.cameraMagnitude,
        MAGIC_SHIELD_EXPLOSION_CAMERA_DECAY,
        elapsed,
      )
    }
  }

  consumePrimaryCameraMagnitude(input: Readonly<{
    eventId: number
    magnitude: number
    tick: number
    worldKey: string
  }>): void {
    if (input.eventId <= this.lastPrimaryMagnitudeId) return
    this.lastPrimaryMagnitudeId = input.eventId
    if (input.worldKey !== this.worldKey) return
    const eventTick = Math.max(0, Math.trunc(input.tick))
    if (eventTick > this.lastTick) this.advanceTo(eventTick)
    this.cameraMagnitude = Math.fround(input.magnitude)
    if (eventTick < this.lastTick) {
      this.cameraMagnitude = repeatedFloatMultiply(
        this.cameraMagnitude,
        MAGIC_SHIELD_EXPLOSION_CAMERA_DECAY,
        this.lastTick - eventTick,
      )
    }
  }

  sample(tick: number): NativeSecondaryScreenOverlay | null {
    this.advanceTo(Math.max(0, Math.trunc(tick)))
    if (this.alpha <= 0) return null
    return {
      alpha: this.alpha,
      color: packNormalizedRgb(this.red, this.green, this.blue),
    }
  }

  sampleCameraMagnitude(tick: number): number {
    this.advanceTo(Math.max(0, Math.trunc(tick)))
    return this.cameraMagnitude
  }

  sampleCameraDisplacement(tick: number): Vector2 {
    this.advanceTo(Math.max(0, Math.trunc(tick)))
    return {
      x: this.cameraDisplacementX,
      y: this.cameraDisplacementY,
    }
  }

  private advanceTo(tick: number): void {
    if (tick <= this.lastTick) return
    const elapsedTicks = tick - this.lastTick
    if (this.alpha > 0 && this.decayPerTick > 0) {
      this.alpha = repeatedFloatDecay(
        this.alpha,
        this.decayPerTick,
        elapsedTicks,
      )
    }
    this.cameraMagnitude = repeatedFloatMultiply(
      this.cameraMagnitude,
      MAGIC_SHIELD_EXPLOSION_CAMERA_DECAY,
      elapsedTicks,
    )
    if (this.cameraMagnitude < MAGIC_SHIELD_EXPLOSION_CAMERA_CUTOFF) {
      this.cameraMagnitude = 0
    }
    this.cameraDisplacementX = repeatedFloatMultiply(
      this.cameraDisplacementX,
      Math.fround(0.75),
      elapsedTicks,
    )
    this.cameraDisplacementY = repeatedFloatMultiply(
      this.cameraDisplacementY,
      Math.fround(0.75),
      elapsedTicks,
    )
    if (
      this.cameraDisplacementX * this.cameraDisplacementX
        + this.cameraDisplacementY * this.cameraDisplacementY
      <= Math.fround(0.25)
    ) {
      this.cameraDisplacementX = 0
      this.cameraDisplacementY = 0
    }
    this.lastTick = tick
  }
}

export function nativeSecondaryPresentationPlan(
  actor: NativeSecondaryActorState,
  presentationFrame = actor.ageTicks,
  pointGain = 1,
): NativeSecondaryPresentationPlan {
  return buildNativeSecondaryPresentationPlan(actor, presentationFrame, pointGain, null)
}

export function updateNativeSecondaryPresentationPlan(
  scratch: NativeSecondaryPresentationScratch,
  actor: NativeSecondaryActorState,
  presentationFrame = actor.ageTicks,
  pointGain = 1,
): NativeSecondaryPresentationPlan {
  scratch.reset()
  if (actor.kind === 'acid-drop' || actor.kind === 'acid-splash') {
    return scratch.writeAcidPlan(actor as NativeAcidActorState)
  }
  if (actor.kind === 'storm-drop') {
    return scratch.writeStormDropPlan(actor as NativeStormDropActorState)
  }
  return buildNativeSecondaryPresentationPlan(actor, presentationFrame, pointGain, scratch)
}

const EMPTY_SECONDARY_DRAWS: readonly NativeSecondarySpriteDraw[] = []
const EMPTY_SECONDARY_MESHES: readonly NativeSecondaryMeshDraw[] = []
const EMPTY_SECONDARY_QUADS: readonly NativeSecondaryQuadDraw[] = []
const EMPTY_SECONDARY_DRAW_OPTIONS: Partial<
  Omit<NativeSecondarySpriteDraw, 'atlas' | 'entry'>
> = {}
const PHASE_BURST_SORT_BIAS = 15
const ZERO_SECONDARY_DRAW_OFFSET: Readonly<Vector2> = { x: 0, y: 0 }

function buildNativeSecondaryPresentationPlan(
  actor: NativeSecondaryActorState,
  presentationFrame: number,
  pointGain: number,
  scratch: NativeSecondaryPresentationScratch | null,
): NativeSecondaryPresentationPlan {
  const root = actor.position
  const draw = (
    atlas: NativeSecondaryAtlas,
    entry: number,
    options: Partial<Omit<NativeSecondarySpriteDraw, 'atlas' | 'entry'>> = (
      EMPTY_SECONDARY_DRAW_OPTIONS
    ),
  ): NativeSecondarySpriteDraw => {
    const target = scratch?.nextDraw() ?? ({} as MutableSecondarySpriteDraw)
    target.alpha = options.alpha ?? actor.alpha
    target.atlas = atlas
    target.blend = options.blend ?? 'normal'
    if (options.colorMode === undefined) {
      if (target.colorMode !== undefined) delete target.colorMode
    } else target.colorMode = options.colorMode
    target.entry = entry
    target.offset = options.offset ?? (
      scratch === null ? { x: 0, y: 0 } : ZERO_SECONDARY_DRAW_OFFSET
    )
    target.role = options.role ?? `${actor.kind}-${atlas}-${entry}`
    target.rotationRadians = options.rotationRadians ?? 0
    target.scaleX = options.scaleX ?? actor.scale
    target.scaleY = options.scaleY ?? actor.scale
    target.tint = options.tint ?? WHITE
    return target
  }
  const plan = (
    draws: readonly NativeSecondarySpriteDraw[],
    queueFamily: NativeSecondaryPresentationPlan['queueFamily'] = 'zanim',
    sortBias = 0,
    quads: readonly NativeSecondaryQuadDraw[] = [],
    gradients: readonly NativeSecondaryGradientDraw[] = [],
    stormComposite: NativeStormWeatherComposite | null = null,
    meshes: readonly NativeSecondaryMeshDraw[] = [],
    underlayDraws: readonly NativeSecondarySpriteDraw[] = EMPTY_SECONDARY_DRAWS,
    worldY = root.y,
  ): NativeSecondaryPresentationPlan => scratch?.writePlan(
    draws,
    gradients,
    meshes,
    quads,
    queueFamily,
    root,
    sortBias,
    stormComposite,
    underlayDraws,
    worldY,
  ) ?? {
    draws,
    gradients,
    meshes,
    quads,
    queueFamily,
    root,
    sortBias,
    stormComposite,
    underlayDraws,
    worldY,
  }

  switch (actor.kind) {
    case 'leviathan':
      return plan([
        draw('BadGuys', 75, {
          alpha: 1,
          blend: 'add',
          role: 'leviathan-plane-galaxy',
          rotationRadians: (presentationFrame % 120) * 3 * Math.PI / 180,
          scaleX: -0.8 * actor.scale,
          scaleY: 0.64 * actor.scale,
          tint: 0xff80ff,
        }),
        draw('BadGuys', 38, {
          alpha: 1,
          role: 'leviathan-plane-shimmer',
          scaleX: actor.scale,
          scaleY: actor.scale,
        }),
      ], 'ordinary-dynamic', -0.11)
    case 'leviathan-appendage': {
      const headingDegrees = actor.rotationRadians * 180 / Math.PI
      const wobble = Math.sin(actor.rotationRadians) * 5 * Math.PI / 180
      const localRoot = nativeLeviathanAppendageLocalRoot(
        actor.endpoint,
        actor.midpoint,
        actor.velocity.x,
        actor.slowFactor,
      )
      const parentY = actor.position.y - actor.scale * localRoot.y
      return plan([draw('BadGuys', nativeLeviathanAppendageRecord(
          actor.phase,
          headingDegrees,
        ), {
          rotationRadians: wobble,
          scaleX: actor.radius * actor.scale,
          scaleY: actor.radius * actor.scale,
        })], 'ordinary-dynamic', parentY + (actor.frame - 100) * 0.001 - actor.position.y)
    }
    case 'leviathan-mote':
      return plan([draw('BadGuys', 11, {
        alpha: actor.alpha,
        blend: 'add',
        rotationRadians: actor.rotationRadians,
        scaleX: actor.scale,
        scaleY: actor.scale * 0.8,
        tint: packNormalizedRgb(1, actor.quantity, 1),
      })])
    case 'ether-bolt':
      return plan([draw('BadGuys', 22, {
        alpha: 0.5 + 0.5 * hashUnit(actor.id, Math.floor(presentationFrame)),
        blend: 'add',
        offset: { x: 0, y: -25 },
        rotationRadians: actor.rotationRadians,
        scaleX: 1,
        scaleY: 1,
      })])
    case 'ether-fade': {
      const fade = nativeEtherFadeScalar(
        actor.alpha,
        actor.slowFactor,
        presentationFrame,
      )
      const ether = etherPrimaryCompositorPlan(
        actor.id,
        Math.floor(actor.quantity + presentationFrame),
        actor.quantity + presentationFrame,
        actor.scale,
        fade,
      )
      return plan(ether.draws.map((operation) => ({
        alpha: operation.alpha,
        atlas: 'BadGuys' as const,
        blend: operation.blend,
        entry: ETHER_PRIMARY_FLIGHT_RECORDS[operation.sprite],
        offset: { x: operation.x, y: operation.y },
        role: `ether-fade-${operation.pass}-${operation.role}`,
        rotationRadians: operation.rotationDegrees * Math.PI / 180,
        scaleX: operation.scale,
        scaleY: operation.scale,
        tint: operation.tint,
      })), 'zanim', actor.variant === 1 ? 100 : 0)
    }
    case 'plane-orb-shot':
      return plan([
        draw('BadGuys', 75, {
          blend: 'add',
          rotationRadians: (presentationFrame % 360) * 1.5 * Math.PI / 180,
          scaleX: -0.75 * actor.scale,
          scaleY: 0.6 * actor.scale,
        }),
      ], 'zanim', 0, [], [], null, [planeOrbMesh(actor, presentationFrame)])
    case 'plane-orb-particle':
      return plan([draw('BadGuys', actor.variant, {
        alpha: actor.alpha,
        blend: 'add',
        rotationRadians: actor.rotationRadians,
        scaleX: actor.scale,
        scaleY: actor.scale * 0.8,
        tint: packNormalizedRgb(1, actor.quantity, 1),
      })])
    case 'phase-burst':
      return plan([draw('BadGuys', 53, {
        alpha: Math.min(actor.alpha, 1),
        blend: 'add',
        rotationRadians: actor.rotationRadians + Math.PI / 2,
      })], 'zanim', PHASE_BURST_SORT_BIAS)
    case 'moving-fire':
    case 'fire-patch':
      {
        const scale = FIRE_DRAW_SCALE * actor.scale * actor.radius
        return plan([draw('DeadHawg', clampEntry(actor.frame, 46, 77), {
          alpha: Math.min(actor.alpha * actor.slowFactor, 1),
          blend: 'add',
          offset: { x: 0, y: -20 },
          scaleX: scale * actor.quantity,
          scaleY: scale,
        })], 'ordinary-dynamic')
      }
    case 'fire-burn':
      return plan([])
    case 'fire-burn-flame':
      return plan([draw('BadGuys', clampEntry(actor.frame, 333, 342), {
        alpha: actor.alpha,
        blend: 'add',
        scaleX: actor.scale,
        scaleY: actor.scale,
      })])
    case 'ether-burn':
      return plan([])
    case 'ether-burn-flare':
      return plan([draw('BadGuys', clampEntry(actor.frame, 246, 250), {
        alpha: actor.alpha,
        blend: 'add',
        scaleX: actor.scale,
        scaleY: actor.scale,
      })])
    case 'shockwave':
    case 'mindblast-shockwave':
      return plan([])
    case 'mindblast-burst':
      return plan(mindblastBurstDraws(actor, draw))
    case 'storm-cloud':
      return {
        ...plan(
        [
          ...stormCloudDraws(actor, presentationFrame, draw),
          ...stormAuxiliaryDraws(actor, draw),
        ],
        'zanim',
        0,
        [],
        [],
          stormWeatherComposite(actor, draw),
        ),
        worldY: actor.position.y + 350,
      }
    case 'storm-drop':
      return actor.phase < 0
        ? plan([], 'zanim', 0, [], [raindropGradient(actor, false)])
        : plan([draw('BadGuys', 63, {
            alpha: Math.max(0, 1 - actor.scale * actor.scale),
            role: 'storm-raindrop-ground',
            scaleX: actor.scale,
            scaleY: actor.scale,
            tint: 0xccffff,
          })])
    case 'storm-strike':
      return plan([], 'ordinary-dynamic')
    case 'prismatic-wave':
      return plan(prismaticWaveDraws(actor, presentationFrame, draw))
    case 'freeze-wave':
      return plan([])
    case 'freeze-wave-visual':
      return plan(freezeWaveVisualDraws(actor, draw))
    case 'frost-burn-flare':
      return plan([draw('BadGuys', clampEntry(actor.frame, 10, 11), {
        alpha: actor.alpha,
        blend: 'add',
        rotationRadians: actor.rotationRadians,
        scaleX: actor.scale,
        scaleY: actor.scale,
        tint: Math.trunc(actor.quantity),
      })])
    case 'flash-response-grow':
      return plan([draw('BadGuys', 16, {
        alpha: Math.min(actor.alpha, 1),
        blend: 'add',
        role: 'flash-response-grow-perspective',
        scaleX: actor.scale,
        scaleY: Math.fround(actor.scale * Math.fround(0.8)),
      })])
    case 'flash-response-fade':
      return plan([draw('BadGuys', 15, {
        alpha: Math.min(actor.alpha, 1),
        blend: 'add',
        role: 'flash-response-fade',
        scaleX: actor.scale,
        scaleY: actor.scale,
      })])
    case 'ice-blast':
      return plan([])
    case 'earthquake':
      {
        const draws: NativeSecondarySpriteDraw[] = [draw('DeadHawg', 200, {
          alpha: actor.alpha * 0.75,
          rotationRadians: actor.rotationRadians,
          scaleX: 1.5,
          scaleY: 1.2,
        })]
        if (actor.phase > 0.6) draws.push(draw('DeadHawg', 201, {
          alpha: actor.alpha * 0.75,
          rotationRadians: actor.rotationRadians + 170 * Math.PI / 180,
          scaleX: 1.5,
          scaleY: 1.2,
        }))
        if (actor.phase > 3) draws.push(draw('DeadHawg', 202, {
          alpha: actor.alpha * 0.75,
          rotationRadians: actor.rotationRadians + 305 * Math.PI / 180,
          scaleX: 1.5,
          scaleY: 1.2,
        }))
        if (actor.quantity > 0) {
          draws.push(...draws.map((source) => ({
            ...source,
            alpha: source.alpha * Math.min(actor.quantity, 1),
            tint: 0x00ff00,
          })))
        }
        return plan(draws, 'ordinary-dynamic')
      }
    case 'earthquake-scenery-wobble':
      return plan([])
    case 'earthquake-quake':
      return plan([draw('BadGuys', 62, {
        alpha: Math.min(1, actor.alpha * Math.abs(
          Math.sin(actor.phase * Math.PI / 180),
        )),
        role: 'earthquake-quake-child',
        rotationRadians: actor.rotationRadians,
        scaleX: actor.scale,
        scaleY: actor.slowFactor,
      })])
    case 'earthquake-dust':
      return plan([draw('BadGuys', 10, {
        alpha: Math.min(1, actor.alpha),
        role: 'earthquake-scenery-dust',
        rotationRadians: actor.rotationRadians,
        scaleX: actor.scale,
        scaleY: actor.scale,
        tint: 0x1e1100,
      })], 'zanim')
    case 'earthquake-debris': {
      const draws: NativeSecondarySpriteDraw[] = []
      if (actor.enhanced) {
        draws.push(draw('BadGuys', 2008 + actor.variant, {
          alpha: Math.min(1, actor.alpha),
          offset: { x: 1, y: actor.phase + 2 },
          role: 'earthquake-boulder-dark-underlay',
          rotationRadians: actor.rotationRadians,
          scaleX: actor.scale * 0.75,
          scaleY: actor.scale * 0.75,
          tint: 0x000000,
        }))
      }
      draws.push(draw('BadGuys', 2008 + actor.variant, {
        alpha: Math.min(1, actor.alpha),
        offset: { x: 0, y: actor.phase },
        role: 'earthquake-boulder-bit',
        rotationRadians: actor.rotationRadians,
        scaleX: actor.scale,
        scaleY: actor.scale,
      }))
      return plan(draws, 'zanim', -15)
    }
    case 'golem': {
      const golem = nativeGolemPresentationPlan(actor, presentationFrame)
      return scratch?.copyPlan(golem) ?? golem
    }
    case 'golem-death': {
      const death = nativeGolemDeathPresentationPlan(actor)
      return scratch?.copyPlan(death) ?? death
    }
    case 'teleport-burst':
      return plan([draw('BadGuys', 90, {
        alpha: Math.min(actor.alpha, 1),
        blend: 'add',
        rotationRadians: actor.rotationRadians,
        scaleX: actor.scale,
        scaleY: actor.scale,
      })])
    case 'magic-circle':
      return plan(magicCircleRingDraws(actor, draw))
    case 'magic-circle-player-flash':
      return plan([draw('BadGuys', 7, {
        alpha: Math.min(actor.alpha, 1),
        blend: 'add',
        role: 'magic-circle-player-recovery-pulse',
        rotationRadians: actor.rotationRadians,
        scaleX: actor.scale,
        scaleY: actor.scale,
        tint: 0x80ffff,
      })])
    case 'magic-trap': {
      const ageRadians = actor.ageTicks * Math.PI / 180
      const sine = Math.sin(ageRadians)
      const bob = Math.fround(5 * sine - 12)
      const chargeMultiplier = actor.scale < MAGIC_TRAP_FULL_DRAW_THRESHOLD
        ? Math.fround(0.75)
        : 1
      const chargeScale = Math.fround(
        Math.fround(0.5 + Math.fround(0.5 * actor.scale)) * chargeMultiplier,
      )
      const haloAlpha = Math.fround(
        Math.fround(0.5 - Math.fround(0.125 * sine)) * chargeMultiplier,
      )
      const selectorAlpha = Math.fround(
        Math.fround(0.375 - Math.fround(0.125 * sine)) * chargeMultiplier,
      )
      return plan([
        draw('BadGuys', 15, {
          alpha: 0.5,
          role: 'magic-trap-shadow',
          scaleX: 0.75,
          scaleY: 0.75,
          tint: 0x000000,
        }),
        draw('BadGuys', 111, {
          alpha: haloAlpha,
          blend: 'add',
          offset: { x: 0, y: bob },
          role: 'magic-trap-clockwise-halo',
          rotationRadians: actor.ageTicks * 2 * Math.PI / 180,
          scaleX: chargeScale,
          scaleY: Math.fround(chargeScale * Math.fround(0.8)),
        }),
        draw('BadGuys', 112, {
          alpha: haloAlpha,
          blend: 'add',
          offset: { x: 0, y: bob },
          role: 'magic-trap-counterclockwise-halo',
          rotationRadians: actor.ageTicks * -3 * Math.PI / 180,
          scaleX: chargeScale,
          scaleY: Math.fround(chargeScale * Math.fround(0.8)),
        }),
        draw('BadGuys', 15, {
          alpha: selectorAlpha,
          blend: 'add',
          role: 'magic-trap-selector-glow',
          scaleX: 2,
          scaleY: 2,
          tint: magicTrapTint(actor.variant),
        }),
        draw('BadGuys', 85, {
          alpha: 1,
          offset: { x: 0, y: bob },
          role: 'magic-trap-body',
          scaleX: Math.fround(1 - Math.fround(0.1 * Math.sin(ageRadians * 2))),
          scaleY: Math.fround(1 + Math.fround(0.1 * Math.cos(ageRadians))),
        }),
      ])
    }
    case 'magic-trap-shimmer':
      return plan([draw('BadGuys', 16, {
        alpha: actor.alpha,
        role: 'magic-trap-shimmer',
        rotationRadians: actor.rotationRadians,
        scaleX: actor.scale,
        scaleY: Math.fround(actor.scale * Math.fround(0.8)),
        tint: magicTrapTint(actor.variant),
      })])
    case 'magic-trap-burst':
      return plan(magicTrapBurstDraws(actor, draw))
    case 'electric-burn':
      return plan([])
    case 'dampen-wave':
      return plan(dampenDraws(actor, draw), 'zanim')
    case 'dampened-projectile':
      return plan(dampenedProjectileDraws(actor, draw))
    case 'shield-break':
      return plan([draw('BadGuys', 68, {
        alpha: actor.alpha,
        blend: 'add',
        rotationRadians: actor.rotationRadians,
        scaleX: actor.scale,
        scaleY: actor.scale,
      })])
    case 'shield-explosion':
      return plan(shieldExplosionDraws(actor, draw))
    case 'ring-fire-explosion': {
      return plan(nativeFireExplosionPlan({
        ageTicks: actor.ageTicks,
        id: actor.id,
        origin: actor.position,
        presentation: 'fire',
        visualScale: actor.scale,
      }, pointGain).draws.map(secondaryFireDraw))
    }
    case 'ring-fire-fragment': {
      const ember = nativeFireEmberPlan({
        ageTicks: actor.ageTicks,
        height: actor.phase,
        id: actor.id,
        life: actor.alpha,
        phase: actor.frame,
        position: actor.position,
      }, presentationFrame)
      const groundGlow = ember.groundGlow
      return plan(
        ember.draws.map(secondaryFireDraw),
        'ordinary-dynamic',
        0,
        groundGlow === null
          ? []
          : [{
              alpha: groundGlow.alpha,
              atlas: null,
              blend: groundGlow.blend,
              entry: null,
              role: 'ring-fire-fragment-enhanced-ground-glow',
              tint: groundGlow.tint,
              vertices: [
                -groundGlow.width / 2, -groundGlow.height / 2,
                groundGlow.width / 2, -groundGlow.height / 2,
                -groundGlow.width / 2, groundGlow.height / 2,
                groundGlow.width / 2, groundGlow.height / 2,
              ],
            }],
      )
    }
    case 'acid-rain': {
      const fieldScale = Math.fround(actor.scale)
      const cloudAlpha = Math.max(0, Math.min(1, Math.fround(actor.phase)))
      const constructorPhase = Math.fround(actor.rotationRadians)
      const age = Math.fround(actor.ageTicks)
      const firstScaleX = Math.fround(fieldScale * 5)
      const secondBaseScale = Math.fround(Math.fround(fieldScale * Math.fround(3.75)) * 2)
      const cloudDraws: NativeSecondarySpriteDraw[] = cloudAlpha > 0 ? [
        draw('BadGuys', 78, {
          alpha: Math.fround(cloudAlpha * Math.fround(0.75)),
          offset: { x: 0, y: -175 },
          role: 'acid-rain-cloud-mottled-source-over',
          rotationRadians: Math.fround(Math.fround(age * Math.fround(0.03125)) * constructorPhase) * Math.PI / 180,
          scaleX: firstScaleX,
          scaleY: Math.fround(firstScaleX * Math.fround(0.8)),
          tint: 0x698c52,
        }),
        draw('BadGuys', 78, {
          alpha: Math.fround(cloudAlpha * Math.fround(0.75)),
          blend: 'add',
          offset: { x: 0, y: -175 },
          role: 'acid-rain-cloud-mottled-additive',
          rotationRadians: Math.fround(Math.fround(age * Math.fround(0.03125)) * constructorPhase) * Math.PI / 180,
          scaleX: firstScaleX,
          scaleY: Math.fround(firstScaleX * Math.fround(0.8)),
          tint: 0x698c52,
        }),
        draw('BadGuys', 10, {
          alpha: cloudAlpha,
          blend: 'add',
          offset: { x: 0, y: Math.fround(-175 + fieldScale * -50) },
          role: 'acid-rain-cloud-circle-additive',
          rotationRadians: Math.fround(age * Math.fround(-0.5)) * Math.PI / 180,
          scaleX: Math.fround(secondBaseScale * constructorPhase),
          scaleY: Math.fround(secondBaseScale * Math.fround(0.8)),
          tint: 0x407326,
        }),
      ] : []
      const underlayDraws: NativeSecondarySpriteDraw[] = []
      if (actor.alpha > 0) {
        underlayDraws.push(draw('DeadHawg', 4, {
          alpha: Math.max(0, Math.min(1, actor.alpha)),
          role: 'acid-rain-ground-residue',
          scaleX: 4.5,
          scaleY: 4.5,
          tint: 0x0d1a0d,
        }))
      }
      return plan(
        cloudDraws,
        'zanim',
        0,
        [],
        [],
        null,
        [],
        underlayDraws,
        actor.position.y + 350,
      )
    }
    case 'acid-drop':
      return actor.phase < 0
        ? plan([draw('BadGuys', 0, {
            alpha: 0.25,
            offset: { x: 0, y: 0 },
            role: 'acid-raindrop-falling',
            scaleX: 1,
            scaleY: 1,
            tint: 0xb3f2bf,
          })], 'zanim', 0, [], [raindropGradient(actor, true)])
        : plan([draw('BadGuys', 63, {
            alpha: Math.max(0, 1 - actor.scale * actor.scale),
            role: 'acid-raindrop-ground',
            scaleX: actor.scale,
            scaleY: actor.scale,
            tint: 0xccffcc,
          })])
    case 'acid-splash':
      return plan([draw('BadGuys', 10, {
        alpha: Math.min(1, actor.alpha / ACID_SPLASH_INITIAL_LIFE),
        blend: 'add',
        role: 'acid-rain-splash',
        rotationRadians: actor.rotationRadians,
        scaleX: actor.scale,
        scaleY: actor.scale,
        tint: 0x80ff80,
      })])
    case 'ether-drain': {
      const shimmerScale = actor.scale * 0.25 * (
        0.9800000190734863 + hashUnit(actor.id, Math.trunc(presentationFrame)) * 0.06999993324279785
      )
      return plan([
        draw('BadGuys', 75, {
          alpha: 1,
          blend: 'add',
          role: 'ether-drain-galaxy-near',
          rotationRadians: actor.rotationRadians * 1.5,
          scaleX: actor.scale * -0.8,
          scaleY: actor.scale * 0.64,
          tint: 0xff80ff,
        }),
        draw('BadGuys', 75, {
          alpha: actor.alpha * 0.5,
          blend: 'add',
          offset: { x: 0, y: -5 },
          role: 'ether-drain-galaxy-middle-near',
          rotationRadians: actor.rotationRadians * 0.5,
          scaleX: -1.5,
          scaleY: 1.2,
        }),
        draw('BadGuys', 75, {
          alpha: actor.alpha * 0.25,
          blend: 'add',
          offset: { x: 0, y: -10 },
          role: 'ether-drain-galaxy-middle-far',
          rotationRadians: actor.rotationRadians * 0.25,
          scaleX: -2.5,
          scaleY: 2,
        }),
        draw('BadGuys', 75, {
          alpha: actor.alpha * 0.1,
          blend: 'add',
          offset: { x: 0, y: -20 },
          role: 'ether-drain-galaxy-far',
          rotationRadians: actor.rotationRadians * 0.125,
          scaleX: -4.5,
          scaleY: 3.6,
        }),
        draw('BadGuys', 38, {
          alpha: 1,
          role: 'ether-drain-shimmer',
          scaleX: shimmerScale,
          scaleY: shimmerScale,
          tint: 0xff4080,
        }),
        ...(actor.slowFactor > 0 ? [draw('BadGuys', 38, {
          alpha: actor.slowFactor,
          role: 'ether-drain-capture-pulse',
          scaleX: actor.slowFactor * actor.scale,
          scaleY: actor.slowFactor * actor.scale,
        })] : []),
      ])
    }
    case 'ether-drain-cloud':
      return plan([draw('BadGuys', 10 + actor.variant, {
        alpha: Math.max(0, Math.sin(actor.phase * Math.PI / 180) * actor.alpha),
        blend: 'add',
        role: 'ether-drain-suck-cloud',
        rotationRadians: actor.rotationRadians,
        scaleX: actor.scale,
        scaleY: actor.scale,
      })])
    case 'ether-drain-debris':
      return plan([draw('DeadHawg', 177 + actor.variant, {
        role: 'ether-drain-suck-debris',
        rotationRadians: actor.rotationRadians,
        scaleX: 1,
        scaleY: 1,
      })])
    case 'ether-drain-capture-flare':
      return plan([draw('BadGuys', 36, {
        alpha: actor.alpha,
        blend: 'add',
        role: 'ether-drain-capture-flare',
        scaleX: actor.scale,
        scaleY: actor.scale,
      })])
    case 'comet': {
      const distance = (400 - actor.ageTicks) * 20 + 70
      return plan([draw('DeadHawg', 5, {
        offset: {
          x: Math.cos(actor.rotationRadians) * distance,
          y: -Math.sin(actor.rotationRadians) * distance,
        },
        role: 'comet-body',
        rotationRadians: actor.rotationRadians + 150 * Math.PI / 180,
        scaleX: 2,
        scaleY: 2,
      })], 'ordinary-dynamic')
    }
    case 'comet-trail':
      return plan([draw('BadGuys', 51, {
        alpha: Math.min(1, actor.phase / 0.5),
        blend: 'add',
        role: 'comet-trail',
        rotationRadians: actor.rotationRadians,
        scaleX: actor.scale,
        scaleY: actor.scale,
        tint: packGray(actor.alpha),
      })])
    case 'comet-impact':
      {
        const additiveLife = Math.max(0, 5 - actor.ageTicks * 0.01)
        const ringLife = Math.max(0, 10 - actor.ageTicks * 0.01)
        return plan([
          ...(additiveLife > 0 ? [draw('BadGuys', 15, {
            alpha: Math.min(additiveLife, 1),
            blend: 'add',
            role: 'comet-impact-additive',
            scaleX: 10,
            scaleY: 10,
            tint: 0xbfbfbf,
          })] : []),
          ...(ringLife > 0 ? [draw('DeadHawg', 6, {
            alpha: Math.min(ringLife, 1),
            role: 'comet-impact-ring',
            scaleX: 2,
            scaleY: 2,
          })] : []),
        ])
      }
    case 'comet-debris':
      return plan([draw('DeadHawg', 203 + actor.variant, {
        alpha: Math.min(actor.alpha, 1),
        offset: { x: 0, y: actor.phase },
        role: 'comet-impact-debris',
        rotationRadians: actor.rotationRadians,
        scaleX: actor.scale,
        scaleY: actor.scale,
      })])
    case 'turn-undead':
      return plan([draw('BadGuys', 48, {
        alpha: actor.alpha,
        rotationRadians: actor.rotationRadians,
        scaleX: actor.scale,
        scaleY: actor.scale * 0.8,
        tint: 0x808080,
      })])
  }
}

function planeOrbMesh(
  actor: NativeSecondaryActorState,
  presentationFrame: number,
): NativeSecondaryMeshDraw {
  const segmentCount = actor.enhanced ? 15 : 7
  const vertices: number[] = [0, 0]
  const uvs: number[] = [actor.position.x / 192, actor.position.y / 192]
  const indices: number[] = []
  const vertexColors: number[] = [0xffffffff]
  const initialHeading = presentationFrame % 360
  for (let segment = 0; segment < segmentCount; segment += 1) {
    const heading = initialHeading + segment * 360 / segmentCount
    const radians = heading * Math.PI / 180
    const x = Math.fround(Math.sin(radians))
    const y = Math.fround(-Math.cos(radians))
    const radii = [25 * actor.scale, 50 * actor.scale] as const
    for (let radiusIndex = 0; radiusIndex < radii.length; radiusIndex += 1) {
      const radius = radii[radiusIndex]!
      const localX = Math.fround(x * radius)
      const localY = Math.fround(y * radius * 0.8)
      vertices.push(localX, localY)
      vertexColors.push(radiusIndex === 0 ? 0xffffffff : 0)
      uvs.push(
        Math.fround((actor.position.x + localX) / 192),
        Math.fround((actor.position.y + localY) / 192),
      )
    }
  }
  for (let segment = 0; segment < segmentCount; segment += 1) {
    const inner = 1 + segment * 2
    const outer = inner + 1
    const nextInner = 1 + ((segment + 1) % segmentCount) * 2
    const nextOuter = nextInner + 1
    indices.push(
      0, inner, nextInner,
      inner, outer, nextInner,
      outer, nextInner, nextOuter,
    )
  }
  return {
    alpha: actor.alpha,
    blend: 'normal',
    indices,
    role: 'plane-orb-ether-plane-mesh',
    texture: 'ether-plane',
    tint: WHITE,
    uvs,
    vertexColors,
    vertices,
  }
}

function prismaticWaveDraws(
  actor: NativeSecondaryActorState,
  presentationFrame: number,
  draw: (
    atlas: NativeSecondaryAtlas,
    entry: number,
    options?: Partial<Omit<NativeSecondarySpriteDraw, 'atlas' | 'entry'>>,
  ) => NativeSecondarySpriteDraw,
): NativeSecondarySpriteDraw[] {
  if (actor.presentationRng === null) {
    throw new TypeError('Prismatic presentation requires its post-cast RNG state')
  }
  const age = Math.max(0, Math.trunc(actor.ageTicks))
  const completedEmissionTicks = Math.min(age, 100)
  const initialHeading = Math.fround(
    actor.phase - actor.slowFactor * 6 * completedEmissionTicks,
  )
  const draws: NativeSecondarySpriteDraw[] = []
  if (age < 100) {
    const flickerRng = advanceNativeRngWords(
      actor.presentationRng,
      completedEmissionTicks * 19 + Math.max(0, Math.trunc(presentationFrame)),
    )
    const flicker = drawNativeFloat(flickerRng, 0.5)
    draws.push(draw('BadGuys', 58, {
      alpha: Math.fround(
        0.5 * actor.alpha * Math.fround(0.5 + flicker.value),
      ),
      blend: 'add',
      role: 'prismatic-spray-core',
      rotationRadians: actor.phase * actor.slowFactor * Math.PI / 180,
      scaleX: actor.slowFactor * actor.scale * 1.5,
      scaleY: actor.scale * 1.2,
    }))
  }

  const firstEmission = Math.max(1, age - 66)
  const lastEmission = Math.min(age, 100)
  if (firstEmission > lastEmission) return draws
  let rng = advanceNativeRngWords(
    actor.presentationRng,
    (firstEmission - 1) * 19,
  )
  for (let emission = firstEmission; emission <= lastEmission; emission += 1) {
    rng = drawNativeFloat(rng, 5, true).state
    const radius = prismaticRadiusAtEmission(emission)
    const heading = Math.fround(
      initialHeading + actor.slowFactor * 6 * emission,
    )
    const headingRadians = heading * Math.PI / 180
    const direction = {
      x: Math.fround(Math.sin(headingRadians)),
      y: Math.fround(-Math.cos(headingRadians)),
    }
    const elapsed = age - emission

    for (let child = 0; child < 2; child += 1) {
      const color = drawNativeInteger(rng, 5)
      const distance = drawNativeFloat(color.state, radius * 60)
      const rotation = drawNativeFloat(distance.state, 360)
      const scale = drawNativeFloat(rotation.state, 0.75)
      const life = drawNativeFloat(scale.state, 1)
      rng = life.state
      const alpha = repeatedFloatDecay(
        Math.fround(0.25 + life.value),
        0.025,
        elapsed,
      )
      if (alpha <= 0) continue
      const radialDistance = Math.fround(radius * 30 + distance.value)
      const spriteScale = Math.fround(0.25 + scale.value)
      draws.push(draw('BadGuys', 111, {
        alpha: Math.min(alpha, 1),
        blend: 'add',
        offset: {
          x: Math.fround(direction.x * radialDistance),
          y: Math.fround(direction.y * radialDistance),
        },
        role: `prismatic-radial-${emission}-${child}`,
        rotationRadians: rotation.value * Math.PI / 180,
        scaleX: spriteScale,
        scaleY: spriteScale,
        tint: PRISMATIC_CHILD_TINTS[color.value]!,
      }))
    }

    const color = drawNativeInteger(rng, 5)
    const distance = drawNativeFloat(color.state, radius * 30)
    const selector = drawNativeInteger(distance.state, 2)
    const rotation = drawNativeFloat(selector.state, 360)
    const scale = drawNativeFloat(rotation.state, 2)
    const speed = drawNativeFloat(scale.state, 0.85)
    const life = drawNativeFloat(speed.state, 0.5)
    rng = life.state
    const alpha = repeatedFloatDecay(
      Math.fround(0.5 + life.value),
      0.015,
      elapsed,
    )
    if (alpha <= 0) continue
    const radialDistance = Math.fround(radius * 50 + distance.value)
    const velocity = Math.fround(0.15 + speed.value)
    const spriteScale = Math.fround(1 + scale.value)
    draws.push(draw('BadGuys', selector.value === 1 ? 10 : 11, {
      alpha: Math.min(alpha, 1),
      blend: 'add',
      offset: {
        x: Math.fround(direction.x * Math.fround(radialDistance + velocity * elapsed)),
        y: Math.fround(direction.y * Math.fround(radialDistance + velocity * elapsed)),
      },
      role: `prismatic-moving-${emission}`,
      rotationRadians: rotation.value * Math.PI / 180,
      scaleX: spriteScale,
      scaleY: Math.fround(spriteScale * 0.8),
      tint: PRISMATIC_CHILD_TINTS[color.value]!,
    }))
  }
  return draws
}

const PRISMATIC_CHILD_TINTS = Object.freeze([
  0xff8080,
  0xffbf80,
  0xffff80,
  0x80ff80,
  0x80ffff,
])

function prismaticRadiusAtEmission(emission: number): number {
  let radius = Math.fround(2)
  for (let tick = 1; tick <= emission; tick += 1) {
    radius = Math.fround(radius + (tick <= 50
      ? Math.fround(0.065)
      : -Math.fround(0.075)))
  }
  return radius
}

function magicCircleRingDraws(
  actor: NativeSecondaryActorState,
  draw: (
    atlas: NativeSecondaryAtlas,
    entry: number,
    options?: Partial<Omit<NativeSecondarySpriteDraw, 'atlas' | 'entry'>>,
  ) => NativeSecondarySpriteDraw,
): NativeSecondarySpriteDraw[] {
  if (actor.presentationRng === null) {
    throw new TypeError('Magic Circle presentation requires its pre-tick RNG state')
  }
  const age = Math.max(0, Math.trunc(actor.ageTicks))
  const lastEmission = Math.min(age, 1_499)
  const firstEmission = Math.max(0, lastEmission - 19)
  let rng = advanceNativeRngWords(
    actor.presentationRng,
    magicCircleRngWordsBefore(Math.trunc(actor.phase), firstEmission),
  )
  const draws: NativeSecondarySpriteDraw[] = []
  for (let emission = firstEmission; emission <= lastEmission; emission += 1) {
    rng = drawNativeFloat(rng, 0.25, true).state
    const globalTick = Math.trunc(actor.phase) + emission
    const childCount = 1 + (globalTick & 1)
    const remainingFactor = Math.min(Math.max(1_499 - emission, 0) / 100, 1)
    for (let child = 0; child < childCount; child += 1) {
      const life = drawNativeFloat(rng, 0.5)
      const scaleJitter = drawNativeFloat(life.state, 0.025)
      const angularMagnitude = drawNativeFloat(scaleJitter.state, 1)
      const angularVelocity = drawNativeSign(
        angularMagnitude.state,
        Math.fround(0.5 + angularMagnitude.value),
      )
      const rotation = drawNativeFloat(angularVelocity.state, 360)
      rng = rotation.state
      const elapsed = age - emission
      const alpha = repeatedFloatDecay(
        Math.fround(remainingFactor * Math.fround(0.5 + life.value)),
        0.05,
        elapsed,
      )
      if (alpha <= 0) continue
      const scaleFactor = Math.fround(0.975 + scaleJitter.value)
      const scaleX = Math.fround(actor.scale * scaleFactor)
      const scaleY = Math.fround(
        Math.fround(actor.scale * Math.fround(0.8)) * scaleFactor,
      )
      let rotationDegrees = rotation.value
      for (let tick = 0; tick < elapsed; tick += 1) {
        rotationDegrees = Math.fround(rotationDegrees + angularVelocity.value)
      }
      draws.push(draw('BadGuys', 48, {
        alpha: Math.min(alpha, 1),
        blend: 'add',
        role: `magic-circle-ring-${emission}-${child}`,
        rotationRadians: rotationDegrees * Math.PI / 180,
        scaleX,
        scaleY,
      }))
    }
  }
  return draws
}

function magicCircleRngWordsBefore(baseGlobalTick: number, updates: number): number {
  let words = 0
  for (let update = 0; update < updates; update += 1) {
    words += 2 + (1 + ((baseGlobalTick + update) & 1)) * 5
  }
  return words
}

function stormCloudDraws(
  actor: NativeSecondaryActorState,
  presentationFrame: number,
  draw: (
    atlas: NativeSecondaryAtlas,
    entry: number,
    options?: Partial<Omit<NativeSecondarySpriteDraw, 'atlas' | 'entry'>>,
  ) => NativeSecondarySpriteDraw,
): NativeSecondarySpriteDraw[] {
  if (actor.variant !== 1 || !actor.enhanced || actor.presentationRng === null) return []
  let rng = actor.presentationRng
  const visualPhase = drawNativeFloat(rng, 1, true)
  rng = visualPhase.state
  const angles: number[] = []
  const speeds: number[] = []
  for (let index = 0; index < 15; index += 1) {
    const angle = drawNativeFloat(rng, 360)
    const speed = drawNativeFloat(angle.state, 2)
    rng = speed.state
    angles.push(angle.value)
    speeds.push(Math.fround(
      (1 - index / 15 * 0.95) * (2 + speed.value) * 4,
    ))
  }

  const middleAngle = presentationFrame * 0.5 * Math.PI / 180
  const spline = naturalSpline3(
    { x: 0, y: 0 },
    { x: Math.cos(middleAngle) * 30, y: -Math.sin(middleAngle) * 30 },
    { x: 0, y: -175 },
  )
  const draws: NativeSecondarySpriteDraw[] = []
  let scale = 0.2
  for (let index = 0; index < 15; index += 1) {
    const t = index * 0.2
    const first = spline(t)
    const second = spline(t + 0.1)
    const angle = Math.fround(angles[index]! + speeds[index]! * actor.ageTicks)
    draws.push(
      draw('BadGuys', 84, {
        alpha: actor.alpha,
        offset: first,
        role: `storm-cloud-arc-${index}-a`,
        rotationRadians: angle * Math.PI / 180,
        scaleX: scale,
        scaleY: scale * 0.8,
        tint: 0xccffff,
      }),
      draw('BadGuys', 84, {
        alpha: actor.alpha,
        offset: second,
        role: `storm-cloud-arc-${index}-b`,
        rotationRadians: angle * 1.35 * Math.PI / 180,
        scaleX: scale,
        scaleY: scale * 0.8,
        tint: 0xccffff,
      }),
    )
    scale = scale * 1.1 + 0.1
  }
  const cloudScale = actor.scale * 3.75
  draws.push(draw('BadGuys', 78, {
    alpha: actor.alpha * 0.5,
    offset: { x: 0, y: actor.scale * -50 },
    role: 'storm-cloud-core',
    rotationRadians: actor.ageTicks * 0.5 * visualPhase.value * 15 * Math.PI / 180,
    scaleX: cloudScale,
    scaleY: cloudScale,
  }))
  return draws
}

function stormAuxiliaryDraws(
  actor: NativeSecondaryActorState,
  draw: (
    atlas: NativeSecondaryAtlas,
    entry: number,
    options?: Partial<Omit<NativeSecondarySpriteDraw, 'atlas' | 'entry'>>,
  ) => NativeSecondarySpriteDraw,
): NativeSecondarySpriteDraw[] {
  const phase = stormVisualPhase(actor)
  const draws: NativeSecondarySpriteDraw[] = []
  if (actor.variant === 1) {
    const scale = actor.scale * 3.75
    draws.push(draw('BadGuys', 78, {
      alpha: actor.alpha * 0.5,
      blend: 'add',
      offset: { x: 0, y: -175 - actor.scale * 50 },
      role: 'storm-weather-moving-composite',
      rotationRadians: degreesToRadians(actor.ageTicks / 48 * phase),
      scaleX: scale,
      scaleY: scale,
      tint: 0xccffff,
    }))
  }
  if (actor.frame > 0) {
    draws.push(draw('BadGuys', 78, {
      alpha: actor.alpha * 0.75,
      colorMode: 'alpha-mask',
      offset: { x: 0, y: -175 },
      role: 'storm-weather-strike-flash',
      rotationRadians: degreesToRadians(actor.ageTicks * 0.0625 * phase),
      scaleX: actor.scale * 4,
      scaleY: actor.scale * 0.8 * 4,
      tint: WHITE,
    }))
  }
  return draws
}

function stormWeatherComposite(
  actor: NativeSecondaryActorState,
  draw: (
    atlas: NativeSecondaryAtlas,
    entry: number,
    options?: Partial<Omit<NativeSecondarySpriteDraw, 'atlas' | 'entry'>>,
  ) => NativeSecondarySpriteDraw,
): NativeStormWeatherComposite | null {
  if (actor.variant === 1) return null
  const phase = stormVisualPhase(actor)
  const age = actor.ageTicks
  const alphaWave = 0.5 + Math.sin(degreesToRadians(age * 0.5)) * 0.5
  const scaleWave = 0.5 + Math.sin(degreesToRadians(age / 6)) * 0.25
  return {
    draws: [
      draw('BadGuys', 78, {
        alpha: actor.alpha * 2,
        offset: { x: 0, y: 0 },
        role: 'storm-weather-static-inner',
        rotationRadians: degreesToRadians(age * 0.03125 * phase),
        scaleX: actor.scale,
        scaleY: actor.scale * 0.8,
      }),
      draw('BadGuys', 78, {
        alpha: actor.alpha * 0.75,
        offset: { x: 0, y: actor.scale * -10 },
        role: 'storm-weather-static-middle',
        rotationRadians: degreesToRadians(age / 48 * phase),
        scaleX: actor.scale * 0.75,
        scaleY: actor.scale * 0.8 * 0.75,
        tint: 0xccffff,
      }),
      draw('BadGuys', 78, {
        alpha: actor.alpha * alphaWave * 0.75,
        offset: { x: 0, y: actor.scale * -6 },
        role: 'storm-weather-static-outer',
        rotationRadians: degreesToRadians(age * 0.125 * phase),
        scaleX: actor.scale * 0.5,
        scaleY: actor.scale * 0.8 * scaleWave,
        tint: 0xccffff,
      }),
    ],
    offset: { x: 0, y: -175 },
    scale: 5,
  }
}

function stormVisualPhase(actor: NativeSecondaryActorState): number {
  if (actor.presentationRng === null) {
    throw new TypeError('Storm presentation requires its pre-consumption RNG state')
  }
  const phase = drawNativeFloat(actor.presentationRng, 1, true).value
  return actor.variant === 1 ? phase * 15 : phase
}

function freezeWaveVisualDraws(
  actor: NativeSecondaryActorState,
  draw: (
    atlas: NativeSecondaryAtlas,
    entry: number,
    options?: Partial<Omit<NativeSecondarySpriteDraw, 'atlas' | 'entry'>>,
  ) => NativeSecondarySpriteDraw,
): NativeSecondarySpriteDraw[] {
  if (actor.presentationRng === null) {
    throw new TypeError('FreezeWave presentation requires its pre-consumption RNG state')
  }
  let rng = actor.presentationRng
  const age = Math.max(0, Math.trunc(actor.ageTicks))
  const draws: NativeSecondarySpriteDraw[] = []
  const burstFactors = [1.02, 1.015, 1.01] as const
  for (let index = 0; index < burstFactors.length; index += 1) {
    const rotation = drawNativeFloat(rng, 360)
    rng = rotation.state
    const life = Math.max(0, Math.fround(4.5 - age * 0.05))
    if (life <= 0) continue
    const scale = Math.fround(burstFactors[index]! ** age)
    draws.push(draw('DeadHawg', 114, {
      alpha: Math.min(life, 1),
      blend: 'add',
      role: `freeze-wave-burst-${index}`,
      rotationRadians: rotation.value * Math.PI / 180,
      scaleX: scale,
      scaleY: Math.fround(scale * 0.8),
    }))
  }
  const ringLife = Math.max(0, Math.fround(1.75 - age * 0.01))
  if (ringLife > 0) {
    draws.push(draw('DeadHawg', 121, {
      alpha: Math.min(ringLife, 1),
      role: 'freeze-wave-ring',
      scaleX: 1.5,
      scaleY: 1.5,
    }))
  }

  const snowCount = actor.enhanced ? 200 : 100
  for (let index = 0; index < snowCount; index += 1) {
    const initialAngle = drawNativeFloat(rng, 360)
    const initialAngularVelocity = drawNativeFloat(initialAngle.state, 10)
    const initialRadius = drawNativeFloat(initialAngularVelocity.state, 40)
    const radialVelocity = drawNativeFloat(initialRadius.state, 4)
    const initialHeight = drawNativeFloat(radialVelocity.state, 250)
    const scaleDraw = drawNativeFloat(initialHeight.state, 0.5)
    const initialRotation = drawNativeFloat(scaleDraw.state, 360)
    const lifeDraw = drawNativeFloat(initialRotation.state, 1.5)
    rng = lifeDraw.state

    let angle = initialAngle.value
    let angularVelocity = Math.fround(10 + initialAngularVelocity.value)
    let radius = Math.fround(20 + initialRadius.value)
    let height = Math.fround(50 + initialHeight.value)
    let rotation = initialRotation.value
    let life = Math.fround(2 + lifeDraw.value)
    for (let tick = 0; tick < age && life > 0; tick += 1) {
      angle = Math.fround(angle + angularVelocity)
      angularVelocity = Math.fround(Math.fround(angularVelocity * 0.975) * 0.975)
      height = Math.fround(height * 0.99)
      radius = Math.fround(
        radius + Math.fround(1 + radialVelocity.value) * Math.min(angularVelocity, 1),
      )
      rotation = Math.fround(rotation + angularVelocity)
      life = Math.fround(life - 0.02)
    }
    if (life <= 0) continue
    const radians = angle * Math.PI / 180
    const scale = Math.fround(1 - scaleDraw.value)
    draws.push(draw('BadGuys', 72, {
      alpha: Math.min(life, 1),
      offset: {
        x: Math.cos(radians) * radius,
        y: Math.sin(radians) * radius * 0.8 - height,
      },
      role: `freeze-wave-snow-${index}`,
      rotationRadians: rotation * Math.PI / 180,
      scaleX: scale,
      scaleY: scale,
    }))
  }
  return draws
}

function raindropGradient(
  actor: NativeSecondaryActorState,
  acid: boolean,
): NativeSecondaryGradientDraw {
  const gradient = acid
    ? NATIVE_SECONDARY_RAINDROP_GRADIENTS.acid
    : NATIVE_SECONDARY_RAINDROP_GRADIENTS.storm
  return {
    ...gradient,
    height: actor.quantity,
    role: acid ? 'acid-raindrop-streak' : 'storm-raindrop-streak',
    topLeft: { x: acid ? -1 : 0, y: actor.phase },
  }
}

function naturalSpline3(
  first: Vector2,
  second: Vector2,
  third: Vector2,
): (time: number) => Vector2 {
  const axis = (a: number, b: number, c: number): readonly number[] => {
    const provisional0 = (b - a) * 0.75
    const provisional1 = ((c - a) * 3 - provisional0) * 0.25
    const provisional2 = ((c - b) * 3 - provisional1) * 0.25
    const tangent2 = provisional2
    const tangent1 = provisional1 - tangent2 * 0.25
    const tangent0 = provisional0 - tangent1 * 0.25
    return [tangent0, tangent1, tangent2]
  }
  const xs = [first.x, second.x, third.x] as const
  const ys = [first.y, second.y, third.y] as const
  const xTangents = axis(...xs)
  const yTangents = axis(...ys)
  const sampleAxis = (
    points: readonly number[],
    tangents: readonly number[],
    time: number,
  ): number => {
    if (time <= 0) return points[0]!
    if (time >= 2) return points[2]!
    const segment = Math.floor(time)
    const fraction = time - segment
    const start = points[segment]!
    const end = points[segment + 1]!
    const startTangent = tangents[segment]!
    const endTangent = tangents[segment + 1]!
    const quadratic = (end - start) * 3 - startTangent * 2 - endTangent
    const cubic = (start - end) * 2 + startTangent + endTangent
    return start + fraction * (
      startTangent + fraction * (quadratic + fraction * cubic)
    )
  }
  return (time) => ({
    x: sampleAxis(xs, xTangents, time),
    y: sampleAxis(ys, yTangents, time),
  })
}

export function nativeGolemPresentationPlan(
  actor: NativeSecondaryActorState,
  presentationFrame = actor.ageTicks,
): NativeSecondaryPresentationPlan {
  if (actor.kind !== 'golem' || actor.golem === null) {
    throw new TypeError('Native Golem presentation requires authoritative Golem state')
  }
  const pose = nativeGolemPose(actor)
  const baseHeadingDegrees = actor.rotationRadians * 180 / Math.PI
  const drawHeadingDegrees = baseHeadingDegrees + pose.headingOffsetDegrees
  const facing = nativeGolemFacing(drawHeadingDegrees)
  const oppositeFacing = nativeGolemFacing(drawHeadingDegrees + 180)
  const elevation = actor.ageTicks < 100 ? 0 : actor.ageTicks < 200 ? -20 : -40
  const tint = actor.golem.iron ? GOLEM_IRON_TINT : WHITE
  const leftFoot = {
    x: actor.golem.leftFoot.x + actor.golem.leftFootBob.x - actor.position.x,
    y: actor.golem.leftFoot.y + actor.golem.leftFootBob.y - actor.position.y,
  }
  const rightFoot = {
    x: actor.golem.rightFoot.x + actor.golem.rightFootBob.x - actor.position.x,
    y: actor.golem.rightFoot.y + actor.golem.rightFootBob.y - actor.position.y,
  }
  const center = {
    x: (leftFoot.x + rightFoot.x) * 0.5,
    y: (leftFoot.y + rightFoot.y) * 0.5,
  }
  const records: GolemDrawRecord[] = []
  const part = (
    entry: number,
    role: string,
    forward: number,
    lateral: number,
    vertical: number,
    options: Readonly<{
      rotationDegrees?: number
      scale?: number
      tint?: number
    }> = {},
  ): NativeSecondarySpriteDraw => {
    const offset = golemPoint(
      center,
      drawHeadingDegrees,
      forward,
      lateral,
      elevation + vertical,
    )
    return secondarySprite(actor, 'Golem', entry, role, {
      offset,
      rotationRadians: degreesToRadians(options.rotationDegrees ?? 0),
      scaleX: actor.scale * GOLEM_DRAW_SCALE * (options.scale ?? 1),
      scaleY: actor.scale * GOLEM_DRAW_SCALE * (options.scale ?? 1),
      tint: options.tint ?? tint,
    })
  }
  const addRecord = (
    sortYOffset: number,
    ...draws: NativeSecondarySpriteDraw[]
  ): void => {
    records.push({
      draws,
      sortY: draws[0]!.offset.y + sortYOffset,
      sourceOrder: records.length,
    })
  }

  const front = part(
    113 + facing,
    'golem-chassis-front',
    pose.leftMode === 3 ? 10 : 15,
    0,
    pose.leftMode === 3 ? -5 : 0,
  )
  const frontDraws = [front]
  const frontGlowEntry = 81 + facing
  if (hasGolemRecord(frontGlowEntry)) {
    frontDraws.push(secondarySprite(actor, 'Golem', frontGlowEntry, 'golem-chassis-front-additive', {
      alpha: actor.alpha,
      blend: 'add',
      offset: front.offset,
      scaleX: actor.scale * GOLEM_DRAW_SCALE,
      scaleY: actor.scale * GOLEM_DRAW_SCALE,
      tint: nativeGolemGreenTint(cosmeticGolemUnit(actor, presentationFrame, 1)),
    }))
  }
  addRecord(0, ...frontDraws)
  addRecord(0, part(129 + facing, 'golem-chassis-rear', -5, 0, 0))

  const sideLeft = part(145 + facing, 'golem-chassis-left', -5, -30, 5)
  addRecord(
    0,
    sideLeft,
    ...(actor.golem.iron
      ? [part(177 + facing, 'iron-golem-left-overlay', -5, -30, 5, { tint: WHITE })]
      : []),
  )
  const sideRight = part(161 + facing, 'golem-chassis-right', -5, 30, 5)
  addRecord(
    0,
    sideRight,
    ...(actor.golem.iron
      ? [part(193 + facing, 'iron-golem-right-overlay', -5, 30, 5, { tint: WHITE })]
      : []),
  )

  if (actor.ageTicks >= 100) {
    const coreOffset = golemPoint(center, drawHeadingDegrees, 0, 0, elevation + 10)
    const coreRed = cosmeticGolemUnit(actor, presentationFrame, 2)
    addRecord(
      -50,
      secondarySprite(actor, 'BadGuys', 15, 'golem-core-lower', {
        offset: coreOffset,
        scaleX: actor.scale * (2 + cosmeticGolemUnit(actor, presentationFrame, 3) * 0.25),
        scaleY: actor.scale * (2 + cosmeticGolemUnit(actor, presentationFrame, 3) * 0.25),
        tint: nativeGolemGreenTint(coreRed),
      }),
      secondarySprite(actor, 'BadGuys', 15, 'golem-core-upper', {
        offset: { x: coreOffset.x, y: coreOffset.y + 5 },
        scaleX: actor.scale * (1.5 + cosmeticGolemUnit(actor, presentationFrame, 4) * 0.25),
        scaleY: actor.scale * (1.5 + cosmeticGolemUnit(actor, presentationFrame, 4) * 0.25),
        tint: nativeGolemGreenTint(coreRed),
      }),
    )

    addRecord(
      -50,
      part(
        (pose.leftMode > 1 ? 17 : 1) + facing,
        'golem-limb-left',
        -5,
        -38,
        5,
        { rotationDegrees: pose.leftRotationDegrees },
      ),
    )
    addRecord(
      -50,
      part(
        (pose.rightMode > 1 ? 49 : 33) + facing,
        'golem-limb-right',
        -5,
        38,
        5,
        { rotationDegrees: pose.rightRotationDegrees },
      ),
    )
    addRecord(-50, part(65 + facing, 'golem-piece-forward-right', -20, 12, 5))
    addRecord(-50, part(65 + facing, 'golem-piece-forward-left', -20, -12, 8, {
      rotationDegrees: 10,
    }))
    addRecord(-70, part(65 + facing, 'golem-piece-center', -15, 0, 15, { scale: 0.8 }))
    addRecord(-50, part(65 + oppositeFacing, 'golem-piece-rear-right', 1, 12, 15))
    addRecord(-50, part(65 + oppositeFacing, 'golem-piece-rear-left', 1, -12, 12))
  }

  const sortedBody = records
    .sort((left, right) => left.sortY - right.sortY || left.sourceOrder - right.sourceOrder)
    .flatMap(({ draws }) => draws)
  const connectors = actor.ageTicks >= 200
    ? nativeGolemConnectorDraws(
        actor,
        presentationFrame,
        leftFoot,
        rightFoot,
        drawHeadingDegrees,
        facing,
        tint,
      )
    : []
  const quads: NativeSecondaryQuadDraw[] = actor.ageTicks < 200
    ? [{
        alpha: actor.alpha * Math.sin((200 - actor.ageTicks) / 200 * Math.PI) * 0.5,
        atlas: 'BadGuys',
        blend: 'normal',
        entry: 36,
        role: 'golem-assembly-beam',
        tint: 0x80ff80,
        vertices: [-35, -200, 35, -200, -40, 25, 40, 25],
      }]
    : []
  return {
    draws: [...connectors, ...sortedBody],
    gradients: [],
    meshes: [],
    quads,
    queueFamily: 'ordinary-dynamic',
    root: { ...actor.position },
    sortBias: 0,
    stormComposite: null,
    underlayDraws: [],
    worldY: actor.position.y + center.y,
  }
}

function nativeGolemDeathPresentationPlan(
  actor: NativeSecondaryActorState,
): NativeSecondaryPresentationPlan {
  if (actor.kind !== 'golem-death' || actor.presentationRng === null) {
    throw new TypeError('Native Golem death presentation requires its pre-consumption RNG state')
  }
  const created = createGolemDeathParticles(actor.presentationRng)
  const stepped = stepGolemDeathParticles(created.particles, created.rng, actor.ageTicks)
  const tint = actor.variant === 1 ? GOLEM_IRON_TINT : WHITE
  const draws = stepped.particles.flatMap((particle, index) => {
    const alpha = Math.max(0, Math.min(1, particle.life))
    return alpha <= 0 ? [] : [secondarySprite(
      actor,
      'DeadHawg',
      78 + index % 10,
      `golem-death-rock-${index}`,
      {
        alpha,
        offset: {
          x: particle.position.x,
          y: particle.position.y + particle.height,
        },
        rotationRadians: degreesToRadians(particle.rotation),
        tint,
      },
    )]
  })
  if (actor.ageTicks < 15) {
    draws.push(secondarySprite(actor, 'BadGuys', 86, 'golem-death-star', {
      alpha: 0.75 - actor.ageTicks * 0.05,
      blend: 'add',
      offset: { x: 0, y: -15 },
      rotationRadians: degreesToRadians(created.starRotation + created.starStep * actor.ageTicks),
      scaleX: 2,
      scaleY: 2,
      tint: GOLEM_STAR_TINT,
    }))
  }
  return {
    draws,
    gradients: [],
    meshes: [],
    quads: [],
    queueFamily: 'ordinary-dynamic',
    root: { ...actor.position },
    sortBias: 0,
    stormComposite: null,
    underlayDraws: [],
    worldY: actor.position.y,
  }
}

export function nativeGolemFacing(headingDegrees: number): number {
  const normalized = positiveModulo(headingDegrees, 360)
  return positiveModulo(Math.floor((roundHalfToEven(normalized) + 9) / 22), 16)
}

interface GolemDrawRecord {
  readonly draws: readonly NativeSecondarySpriteDraw[]
  readonly sortY: number
  readonly sourceOrder: number
}

interface GolemPose {
  readonly headingOffsetDegrees: number
  readonly leftMode: number
  readonly leftRotationDegrees: number
  readonly rightMode: number
  readonly rightRotationDegrees: number
}

function nativeGolemPose(actor: NativeSecondaryActorState): GolemPose {
  const golem = actor.golem!
  return {
    headingOffsetDegrees: golem.actionHeadingOffsetDegrees,
    leftMode: golem.leftLimbMode,
    leftRotationDegrees: golem.leftLimbMode === 1 ? 45 : golem.leftFootRotationDegrees,
    rightMode: golem.rightLimbMode,
    rightRotationDegrees: golem.rightLimbMode === 1 ? -45 : golem.rightFootRotationDegrees,
  }
}

function nativeGolemConnectorDraws(
  actor: NativeSecondaryActorState,
  presentationFrame: number,
  leftFoot: Vector2,
  rightFoot: Vector2,
  drawHeadingDegrees: number,
  facing: number,
  tint: number,
): NativeSecondarySpriteDraw[] {
  const golem = actor.golem!
  const center = {
    x: (leftFoot.x + rightFoot.x) * 0.5,
    y: (leftFoot.y + rightFoot.y) * 0.5,
  }
  const headingRadians = degreesToRadians(drawHeadingDegrees)
  const lateral = {
    x: -Math.cos(headingRadians),
    y: -Math.sin(headingRadians),
  }
  const leftEndpoint = {
    x: leftFoot.x + golem.leftConnectorOffset.x,
    y: leftFoot.y + golem.leftConnectorOffset.y,
  }
  const rightEndpoint = {
    x: rightFoot.x + golem.rightConnectorOffset.x,
    y: rightFoot.y + golem.rightConnectorOffset.y,
  }
  const leftJoint = {
    x: golem.leftConnectorOffset.x
      + (leftFoot.x + center.x + lateral.x * -10) * 0.5,
    y: golem.leftConnectorOffset.y
      + (leftFoot.y + center.y + lateral.y * -10) * 0.5 - 15,
  }
  const rightJoint = {
    x: golem.rightConnectorOffset.x
      + (rightFoot.x + center.x + lateral.x * 10) * 0.5,
    y: golem.rightConnectorOffset.y
      + (rightFoot.y + center.y + lateral.y * 10) * 0.5 - 15,
  }
  const endpoint = (
    offset: Vector2,
    side: string,
  ): NativeSecondarySpriteDraw => secondarySprite(
    actor,
    'Golem',
    97 + facing,
    `golem-connector-endpoint-${side}`,
    {
      offset,
      scaleX: actor.scale * GOLEM_DRAW_SCALE,
      scaleY: actor.scale * GOLEM_DRAW_SCALE,
      tint,
    },
  )
  const glow = (
    joint: Vector2,
    connectorEndpoint: Vector2,
    side: string,
    salt: number,
  ): NativeSecondarySpriteDraw => {
    const scale = 0.75 + cosmeticGolemUnit(actor, presentationFrame, salt + 1) * 0.5
    return secondarySprite(actor, 'BadGuys', 15, `golem-connector-glow-${side}`, {
      offset: {
        x: (joint.x * 3 + connectorEndpoint.x) * 0.25,
        y: (joint.y * 3 + connectorEndpoint.y) * 0.25,
      },
      scaleX: actor.scale * scale,
      scaleY: actor.scale * scale,
      tint: nativeGolemGreenTint(cosmeticGolemUnit(actor, presentationFrame, salt)),
    })
  }
  const cap = (offset: Vector2, side: string): NativeSecondarySpriteDraw => secondarySprite(
    actor,
    'Golem',
    65 + facing,
    `golem-connector-cap-${side}`,
    {
      offset,
      scaleX: actor.scale * GOLEM_HALF_DRAW_SCALE,
      scaleY: actor.scale * GOLEM_HALF_DRAW_SCALE,
      tint,
    },
  )
  const leftFirst = leftFoot.y < rightFoot.y
  return [
    ...(leftFirst
      ? [
          endpoint(leftEndpoint, 'left'),
          endpoint(rightEndpoint, 'right'),
        ]
      : [
          endpoint(rightEndpoint, 'right'),
          endpoint(leftEndpoint, 'left'),
        ]),
    glow(leftJoint, leftEndpoint, 'left', 10),
    glow(rightJoint, rightEndpoint, 'right', 12),
    ...(leftFirst
      ? [cap(leftJoint, 'left'), cap(rightJoint, 'right')]
      : [cap(rightJoint, 'right'), cap(leftJoint, 'left')]),
  ]
}

function golemPoint(
  center: Vector2,
  headingDegrees: number,
  forward: number,
  lateral: number,
  vertical: number,
): Vector2 {
  const radians = degreesToRadians(headingDegrees)
  const forwardX = Math.sin(radians)
  const forwardY = -Math.cos(radians)
  const lateralX = forwardY
  const lateralY = -forwardX
  return {
    x: center.x + forwardX * forward + lateralX * lateral,
    y: center.y + forwardY * forward + lateralY * lateral + vertical,
  }
}

function secondarySprite(
  actor: NativeSecondaryActorState,
  atlas: NativeSecondaryAtlas,
  entry: number,
  role: string,
  options: Partial<Omit<NativeSecondarySpriteDraw, 'atlas' | 'entry' | 'role'>> = {},
): NativeSecondarySpriteDraw {
  return {
    alpha: actor.alpha,
    atlas,
    blend: 'normal',
    entry,
    offset: { x: 0, y: 0 },
    role,
    rotationRadians: 0,
    scaleX: actor.scale,
    scaleY: actor.scale,
    tint: WHITE,
    ...options,
  }
}

function hasGolemRecord(entry: number): boolean {
  return !EMPTY_GOLEM_FRONT_GLOW_RECORDS.has(entry)
}

function cosmeticGolemUnit(
  actor: NativeSecondaryActorState,
  presentationFrame: number,
  salt: number,
): number {
  return hashUnit(actor.id, Math.floor(presentationFrame) * 31 + salt)
}

function nativeGolemGreenTint(unit: number): number {
  return (Math.round((0.5 + unit * 0.3) * 255) << 16) | 0x00ff80
}

interface GolemDeathParticle {
  bounceProgress: number
  bounceVelocity: number
  height: number
  life: number
  position: Vector2
  rotation: number
  rotationStep: number
  velocity: Vector2
  verticalVelocity: number
}

function createGolemDeathParticles(sourceRng: NativeRngState): Readonly<{
  particles: readonly GolemDeathParticle[]
  rng: NativeRngState
  starRotation: number
  starStep: number
}> {
  const shuffled = nativeFullRangeShuffle(
    Array.from({ length: 30 }, (_, index) => index * 18),
    sourceRng,
  )
  let rng = shuffled.rng
  const particles: GolemDeathParticle[] = []
  for (let index = 0; index < 30; index += 1) {
    const fall = drawNativeFloat(rng, 3)
    rng = fall.state
    const height = drawNativeFloat(rng, 20)
    rng = height.state
    const rotation = drawNativeFloat(rng, 360)
    rng = rotation.state
    const rotationStep = drawNativeFloat(rng, 10)
    rng = rotationStep.state
    const speed = drawNativeFloat(rng, 1)
    rng = speed.state
    const radius = drawNativeFloat(rng, 10)
    rng = radius.state
    const angular = drawNativeFloat(rng, 20, true)
    rng = angular.state
    const radians = degreesToRadians(shuffled.values[index]!)
    const magnitude = 1.5 * (speed.value + 0.5)
    const velocity = { x: Math.sin(radians) * magnitude, y: -Math.cos(radians) * magnitude }
    const positionFactor = radius.value + 17
    particles.push({
      bounceProgress: 0,
      bounceVelocity: -(fall.value + 2),
      height: -height.value,
      life: 2,
      position: {
        x: velocity.x * positionFactor,
        y: velocity.y * positionFactor,
      },
      rotation: rotation.value,
      rotationStep: angular.value,
      velocity,
      verticalVelocity: -(fall.value + 2),
    })
  }
  const starRotation = drawNativeFloat(rng, 360)
  rng = starRotation.state
  const starPitch = drawNativeFloat(rng, 5)
  rng = starPitch.state
  const starSample = drawNativeInteger(rng, 10)
  rng = starSample.state
  return {
    particles,
    rng,
    starRotation: starRotation.value,
    starStep: (starSample.value + starPitch.value) * 0.5,
  }
}

function stepGolemDeathParticles(
  source: readonly GolemDeathParticle[],
  sourceRng: NativeRngState,
  ageTicks: number,
): Readonly<{ particles: readonly GolemDeathParticle[]; rng: NativeRngState }> {
  const particles = source.map((particle) => ({
    ...particle,
    position: { ...particle.position },
    velocity: { ...particle.velocity },
  }))
  let rng = sourceRng
  for (let tick = 0; tick < Math.floor(ageTicks); tick += 1) {
    for (const particle of particles) {
      if (particle.life <= 0) continue
      if (particle.height !== 0) {
        particle.position.x += particle.velocity.x
        particle.position.y += particle.velocity.y
        particle.height += 2 * particle.verticalVelocity
        particle.verticalVelocity += 2 * particle.bounceProgress * 0.4
        particle.bounceProgress = Math.min(1, particle.bounceProgress + 0.02)
        if (particle.height > 0) {
          const rotationStep = drawNativeFloat(rng, 10)
          rng = rotationStep.state
          particle.rotationStep = rotationStep.value + 1
          particle.bounceVelocity *= 0.65
          particle.verticalVelocity = particle.bounceVelocity
          const sound = drawNativeInteger(rng, 3)
          rng = sound.state
          if (sound.value === 1) {
            rng = drawNativeFloat(rng, 0.2).state
            rng = drawNativeInteger(rng, 4).state
          }
          const damp = drawNativeInteger(rng, 2)
          rng = damp.state
          if (damp.value === 1) {
            particle.velocity.x *= 0.65
            particle.velocity.y *= 0.65
          }
          if (particle.verticalVelocity > -0.75) {
            particle.bounceVelocity = 0
            particle.bounceProgress = 0
            particle.verticalVelocity = 0
            particle.velocity.x = 0
            particle.velocity.y = 0
            particle.rotationStep = 0
          }
          particle.height = particle.verticalVelocity
        }
      }
      particle.rotation += particle.rotationStep
      particle.life -= 0.015
    }
  }
  return { particles, rng }
}

function nativeFullRangeShuffle<T>(
  source: readonly T[],
  sourceRng: NativeRngState,
): Readonly<{ rng: NativeRngState; values: readonly T[] }> {
  const values = [...source]
  let rng = sourceRng
  for (let index = 0; index < values.length; index += 1) {
    const draw = drawNativeInteger(rng, values.length)
    rng = draw.state
    const swap = values[index]!
    values[index] = values[draw.value]!
    values[draw.value] = swap
  }
  return { rng, values }
}

function positiveModulo(value: number, divisor: number): number {
  return (value % divisor + divisor) % divisor
}

function repeatedFloatDecay(initial: number, decay: number, ticks: number): number {
  let value = Math.fround(initial)
  const floatDecay = Math.fround(decay)
  for (let tick = 0; tick < Math.max(0, Math.trunc(ticks)); tick += 1) {
    value = Math.max(0, Math.fround(value - floatDecay))
    if (value === 0) break
  }
  return value
}

function repeatedFloatMultiply(initial: number, factor: number, ticks: number): number {
  let value = Math.fround(initial)
  const floatFactor = Math.fround(factor)
  for (let tick = 0; tick < Math.max(0, Math.trunc(ticks)); tick += 1) {
    value = Math.fround(value * floatFactor)
  }
  return value
}

function packNormalizedRgb(red: number, green: number, blue: number): number {
  const byte = (channel: number): number => Math.round(
    Math.max(0, Math.min(1, channel)) * 255,
  )
  return (byte(red) << 16) | (byte(green) << 8) | byte(blue)
}

function degreesToRadians(degrees: number): number {
  return degrees * Math.PI / 180
}

export function nativeEtherFadeScalar(
  initialLife: number,
  decrement: number,
  ageTicks: number,
): number {
  let life = Math.fround(initialLife)
  for (let tick = 0; tick <= Math.floor(ageTicks); tick += 1) {
    life = Math.fround(life - Math.fround(decrement))
  }
  return Math.max(0, life)
}

function dampenDraws(
  actor: NativeSecondaryActorState,
  draw: (
    atlas: NativeSecondaryAtlas,
    entry: number,
    options?: Partial<Omit<NativeSecondarySpriteDraw, 'atlas' | 'entry'>>,
  ) => NativeSecondarySpriteDraw,
): NativeSecondarySpriteDraw[] {
  if (actor.presentationRng === null) {
    throw new TypeError('Dampen presentation requires its post-gameplay RNG state')
  }
  const age = Math.max(0, Math.trunc(actor.ageTicks))
  const draws: NativeSecondarySpriteDraw[] = []
  let rng = actor.presentationRng
  for (let heading = 0; heading < 360; heading += 1) {
    const record = drawNativeInteger(rng, 2)
    const speed = drawNativeFloat(record.state, 4)
    const dragRoll = drawNativeInteger(speed.state, 6)
    const rotation = drawNativeFloat(dragRoll.state, 360)
    const scale = drawNativeFloat(rotation.state, 0.5)
    const loss = drawNativeFloat(scale.state, 0.02)
    const gray = drawNativeFloat(loss.state, 0.25)
    const registration = drawNativeInteger(gray.state, 5)
    rng = registration.state

    const alpha = repeatedFloatDecay(
      1,
      Math.fround(0.01 + loss.value),
      age,
    )
    if (alpha <= 0 || heading % 10 !== 0) continue
    const drag = dragRoll.value === 3
      ? Math.fround(0.93)
      : Math.fround(0.96)
    let distance = 0
    let velocity = Math.fround(6 + speed.value)
    for (let tick = 0; tick < age; tick += 1) {
      distance = Math.fround(distance + velocity)
      velocity = Math.fround(velocity * drag)
    }
    const headingRadians = heading * Math.PI / 180
    const spriteScale = Math.fround(1.5 + scale.value)
    const x = distance === 0
      ? 0
      : Math.fround(Math.sin(headingRadians) * distance)
    const y = distance === 0
      ? 0
      : Math.fround(-Math.cos(headingRadians) * distance)
    draws.push(draw('BadGuys', 10 + record.value, {
      alpha,
      blend: 'normal',
      offset: { x, y },
      role: `dampen-move-fade-${heading}`,
      rotationRadians: rotation.value * Math.PI / 180,
      scaleX: spriteScale,
      scaleY: spriteScale,
      tint: packNormalizedRgb(gray.value, gray.value, gray.value),
    }))
  }

  for (let index = 0; index < 30; index += 1) {
    const rotation = drawNativeFloat(rng, 360)
    const scale = drawNativeFloat(rotation.state, 4.75)
    const life = drawNativeFloat(scale.state, 1)
    rng = life.state
    const alpha = repeatedFloatDecay(
      Math.fround(0.5 + life.value),
      0.1,
      age,
    )
    if (alpha <= 0 || index % 10 !== 0) continue
    const spriteScale = Math.fround(0.75 + scale.value)
    draws.push(draw('BadGuys', 48, {
      alpha: Math.min(alpha, 1),
      blend: 'add',
      role: `dampen-additive-${index}`,
      rotationRadians: rotation.value * Math.PI / 180,
      scaleX: spriteScale,
      scaleY: Math.fround(spriteScale * 0.8),
    }))
  }
  return draws
}

function dampenedProjectileDraws(
  actor: NativeSecondaryActorState,
  draw: (
    atlas: NativeSecondaryAtlas,
    entry: number,
    options?: Partial<Omit<NativeSecondarySpriteDraw, 'atlas' | 'entry'>>,
  ) => NativeSecondarySpriteDraw,
): NativeSecondarySpriteDraw[] {
  const guided = actor.variant !== 0
  const projectile: BoneyardEnemyProjectileSnapshot = {
    ageTicks: Math.max(0, Math.trunc(actor.frame)),
    contactRadius: 0,
    headingDeg: actor.rotationRadians * 180 / Math.PI,
    homing: false,
    id: actor.targetId ?? actor.id,
    kind: guided ? 'guided-missile' : 'firebolt',
    lightRegistration: null,
    lifetimeTicks: 400,
    nativeTypeId: guided ? 0x7ec : 0x7eb,
    ownerActorId: 0,
    painterRegistration: actor.painterRegistrations?.[0] ?? {
      managerLane: 'transient',
      registrationOrdinal: actor.id,
    },
    payload: actor.variant === 1
      ? 'poison'
      : actor.variant === 2
        ? 'cold'
        : 'fire',
    position: { x: 0, y: 0 },
    speed: Math.hypot(actor.velocity.x, actor.velocity.y),
    spawnTick: 0,
    verticalOffset: 0,
    visualPhaseDeg: actor.phase,
    visualScale: actor.scale,
  }
  return nativeEnemyProjectilePlan(projectile, actor.ageTicks).layers.map((layer) => {
    if (layer.atlas === 'Demon') {
      throw new TypeError('Dampened projectiles cannot use the Demon atlas')
    }
    return draw(layer.atlas, layer.entry, {
      alpha: layer.alpha,
      blend: layer.blendMode,
      offset: layer.offset,
      role: `dampened-projectile-${layer.role}`,
      rotationRadians: layer.rotationRadians,
      scaleX: layer.scale,
      scaleY: layer.scaleY,
      tint: layer.tint,
    })
  })
}

function shieldExplosionDraws(
  actor: NativeSecondaryActorState,
  draw: (
    atlas: NativeSecondaryAtlas,
    entry: number,
    options?: Partial<Omit<NativeSecondarySpriteDraw, 'atlas' | 'entry'>>,
  ) => NativeSecondarySpriteDraw,
): NativeSecondarySpriteDraw[] {
  if (actor.presentationRng === null) {
    throw new TypeError('Explosive Shield presentation requires its construction RNG state')
  }
  const age = Math.max(0, Math.trunc(actor.ageTicks))
  const draws: NativeSecondarySpriteDraw[] = []

  const flashAlpha = repeatedFloatDecay(1, 0.1, age)
  if (flashAlpha > 0) {
    draws.push(draw('BadGuys', 15, {
      alpha: Math.min(flashAlpha, 1),
      offset: { x: 0, y: -25 },
      role: 'explosive-shield-center-flash',
      scaleX: 12,
      scaleY: 12,
    }))
  }

  const ringAlpha = repeatedFloatDecay(1.5, 0.05, age)
  if (ringAlpha > 0) {
    const ringScale = repeatedFloatMultiply(2.5, 1.01, age)
    draws.push(draw('DeadHawg', 2, {
      alpha: Math.min(ringAlpha, 1),
      blend: 'add',
      offset: { x: 0, y: -35 },
      role: 'explosive-shield-expanding-ring',
      scaleX: ringScale,
      scaleY: ringScale,
    }))
  }

  draws.push(...fuzzySpearBurstDraws(
    actor,
    draw,
    actor.presentationRng,
    'explosive-shield',
  ))
  return draws
}

function magicTrapBurstDraws(
  actor: NativeSecondaryActorState,
  draw: (
    atlas: NativeSecondaryAtlas,
    entry: number,
    options?: Partial<Omit<NativeSecondarySpriteDraw, 'atlas' | 'entry'>>,
  ) => NativeSecondarySpriteDraw,
): NativeSecondarySpriteDraw[] {
  if (actor.presentationRng === null) {
    throw new TypeError('Magic Trap presentation requires its construction RNG state')
  }
  const draws: NativeSecondarySpriteDraw[] = []
  const flashAlpha = repeatedFloatDecay(1, 0.1, actor.ageTicks)
  if (flashAlpha > 0) {
    draws.push(draw('BadGuys', 15, {
      alpha: Math.min(flashAlpha, 1),
      offset: { x: 0, y: -25 },
      role: 'magic-trap-center-flash',
      scaleX: 6,
      scaleY: 6,
    }))
  }
  draws.push(...fuzzySpearBurstDraws(
    actor,
    draw,
    actor.presentationRng,
    'magic-trap',
  ))
  return draws
}

function mindblastBurstDraws(
  actor: NativeSecondaryActorState,
  draw: (
    atlas: NativeSecondaryAtlas,
    entry: number,
    options?: Partial<Omit<NativeSecondarySpriteDraw, 'atlas' | 'entry'>>,
  ) => NativeSecondarySpriteDraw,
): NativeSecondarySpriteDraw[] {
  if (actor.presentationRng === null) {
    throw new TypeError('Mindblast presentation requires its construction RNG state')
  }
  const age = Math.max(0, Math.trunc(actor.ageTicks))
  const draws: NativeSecondarySpriteDraw[] = []
  const coreAlpha = repeatedFloatDecay(1, Math.fround(0.025), age)
  if (coreAlpha > 0) {
    draws.push(draw('BadGuys', 15, {
      alpha: Math.min(coreAlpha, 1),
      offset: { x: 0, y: -25 },
      role: 'mindblast-center-flash',
      scaleX: 54,
      scaleY: 54,
    }))
  }

  for (let index = 0; index < 3; index += 1) {
    const alpha = repeatedFloatDecay(1.5, Math.fround(0.025), age)
    if (alpha <= 0) continue
    const growth = [1.1, 1.05, 1.025][index]!
    draws.push(draw('Clothes', 2, {
      alpha: Math.min(alpha, 1),
      blend: 'add',
      offset: { x: 0, y: -35 },
      role: `mindblast-expanding-ring-${index}`,
      scaleX: repeatedFloatMultiply(4.5, growth, age),
      scaleY: repeatedFloatMultiply(4.5, growth, age),
      tint: 0x00ffff,
    }))
  }

  let rng = actor.presentationRng
  for (let index = 0; index < 2; index += 1) {
    const rotation = drawNativeFloat(rng, 360)
    rng = rotation.state
    const frameRate = Math.fround(index === 0 ? 0.075 : 0.1125)
    let frame = Math.fround(0)
    for (let tick = 0; tick < age; tick += 1) frame = Math.fround(frame + frameRate)
    if (frame >= 10) continue
    draws.push(draw('BadGuys', 158 + Math.floor(frame), {
      alpha: 1,
      blend: 'add',
      role: `mindblast-sprite-array-${index}`,
      rotationRadians: rotation.value * Math.PI / 180,
      scaleX: 10,
      scaleY: 10,
    }))
  }

  for (let index = 0; index < 100; index += 1) {
    const heading = drawNativeFloat(rng, 360)
    const speed = drawNativeFloat(heading.state, 2)
    const doubleSpeed = drawNativeInteger(speed.state, 5)
    const alpha = drawNativeFloat(doubleSpeed.state, 1)
    const scale = drawNativeFloat(alpha.state, 1.5)
    rng = scale.state
    const life = repeatedFloatDecay(
      Math.fround(1 + alpha.value),
      Math.fround(0.00875),
      age,
    )
    if (life <= 0) continue
    const headingRadians = heading.value * Math.PI / 180
    const direction = {
      x: Math.fround(Math.sin(headingRadians)),
      y: Math.fround(-Math.cos(headingRadians)),
    }
    const speedFactor = doubleSpeed.value === 2 ? 2 : 1
    let velocity = {
      x: Math.fround(direction.x * Math.fround(3 + speed.value) * speedFactor),
      y: Math.fround(direction.y * Math.fround(3 + speed.value) * speedFactor),
    }
    const offset = {
      x: Math.fround(direction.x * 75),
      y: Math.fround(direction.y * 75),
    }
    for (let tick = 0; tick < age; tick += 1) {
      offset.x = Math.fround(offset.x + velocity.x)
      offset.y = Math.fround(offset.y + velocity.y)
      velocity = {
        x: Math.fround(velocity.x * Math.fround(0.95)),
        y: Math.fround(velocity.y * Math.fround(0.95)),
      }
    }
    const horizontalSign = hashUnit(actor.id + index, age * 101 + index) < 0.5 ? -1 : 1
    const shared = {
      alpha: Math.min(life, 1),
      blend: 'add' as const,
      offset,
      rotationRadians: headingRadians,
      tint: 0x00ffff,
    }
    draws.push(
      draw('BadGuys', 17, {
        ...shared,
        role: `mindblast-fuzzy-spear-base-${index}`,
        scaleX: horizontalSign,
        scaleY: 1,
      }),
      draw('BadGuys', 74, {
        ...shared,
        role: `mindblast-fuzzy-spear-glow-${index}`,
        scaleX: Math.fround(2 + scale.value),
        scaleY: Math.fround(2 + scale.value),
      }),
    )
  }
  return draws
}

function fuzzySpearBurstDraws(
  actor: NativeSecondaryActorState,
  draw: (
    atlas: NativeSecondaryAtlas,
    entry: number,
    options?: Partial<Omit<NativeSecondarySpriteDraw, 'atlas' | 'entry'>>,
  ) => NativeSecondarySpriteDraw,
  sourceRng: NativeRngState,
  rolePrefix: 'explosive-shield' | 'magic-trap',
): NativeSecondarySpriteDraw[] {
  const age = Math.max(0, Math.trunc(actor.ageTicks))
  const draws: NativeSecondarySpriteDraw[] = []
  let rng = sourceRng
  for (let index = 0; index < 2; index += 1) {
    const rotation = drawNativeFloat(rng, 360)
    rng = rotation.state
    const frameRate = Math.fround(Math.fround(index * 0.1 + 0.2) * Math.fround(0.75))
    let frame = Math.fround(0)
    for (let tick = 0; tick < age; tick += 1) {
      frame = Math.fround(frame + frameRate)
    }
    if (frame >= 10) continue
    draws.push(draw('BadGuys', 158 + Math.floor(frame), {
      alpha: 1,
      blend: 'add',
      offset: { x: 0, y: -35 },
      role: `${rolePrefix}-sprite-array-${index}`,
      rotationRadians: rotation.value * Math.PI / 180,
      scaleX: 6,
      scaleY: 6,
    }))
  }

  for (let index = 0; index < 100; index += 1) {
    const heading = drawNativeFloat(rng, 360)
    const speed = drawNativeFloat(heading.state, 2)
    const doubleSpeed = drawNativeInteger(speed.state, 5)
    const alpha = drawNativeFloat(doubleSpeed.state, 1)
    const scale = drawNativeFloat(alpha.state, 1.5)
    rng = scale.state

    const life = repeatedFloatDecay(
      Math.fround(1 + alpha.value),
      0.035,
      age,
    )
    if (life <= 0) continue
    const headingRadians = heading.value * Math.PI / 180
    const direction = {
      x: Math.fround(Math.sin(headingRadians)),
      y: Math.fround(-Math.cos(headingRadians)),
    }
    const speedFactor = doubleSpeed.value === 2 ? 2 : 1
    let velocity = {
      x: Math.fround(direction.x * Math.fround(3 + speed.value) * speedFactor),
      y: Math.fround(direction.y * Math.fround(3 + speed.value) * speedFactor),
    }
    const offset = {
      x: Math.fround(direction.x * 75),
      y: Math.fround(direction.y * 75),
    }
    for (let tick = 0; tick < age; tick += 1) {
      offset.x = Math.fround(offset.x + velocity.x)
      offset.y = Math.fround(offset.y + velocity.y)
      velocity = {
        x: Math.fround(velocity.x * Math.fround(0.95)),
        y: Math.fround(velocity.y * Math.fround(0.95)),
      }
    }
    const drawAlpha = Math.min(life, 1)
    const horizontalSign = hashUnit(actor.id + index, age * 101 + index) < 0.5 ? -1 : 1
    draws.push(
      draw('BadGuys', 17, {
        alpha: drawAlpha,
        blend: 'add',
        offset,
        role: `${rolePrefix}-fuzzy-spear-base-${index}`,
        rotationRadians: headingRadians,
        scaleX: horizontalSign,
        scaleY: 1,
      }),
      draw('BadGuys', 74, {
        alpha: drawAlpha,
        blend: 'add',
        offset,
        role: `${rolePrefix}-fuzzy-spear-glow-${index}`,
        rotationRadians: headingRadians,
        scaleX: Math.fround(2 + scale.value),
        scaleY: Math.fround(2 + scale.value),
      }),
    )
  }
  return draws
}

function magicTrapTint(selector: number): number {
  const color = MAGIC_TRAP_SELECTOR_COLORS[selector]
  if (color === undefined) throw new RangeError(`invalid native Magic Trap selector ${selector}`)
  return packNormalizedRgb(color[0], color[1], color[2])
}

function secondaryFireDraw(draw: NativeFireActorDraw): NativeSecondarySpriteDraw {
  return {
    alpha: draw.alpha,
    atlas: draw.atlas,
    blend: draw.blend,
    entry: draw.entry,
    offset: { ...draw.offset },
    role: draw.role,
    rotationRadians: draw.rotation,
    scaleX: draw.scaleX ?? draw.scale,
    scaleY: draw.scaleY ?? draw.scale,
    tint: draw.tint,
  }
}

function hashUnit(first: number, second: number): number {
  let value = Math.imul(first ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(second, 0xc2b2ae35)
  value ^= value >>> 16
  return (value >>> 0) / 0x1_0000_0000
}

function packGray(value: number): number {
  const channel = Math.max(0, Math.min(255, Math.round(value * 255)))
  return channel << 16 | channel << 8 | channel
}

function clampEntry(value: number, first: number, last: number): number {
  return Math.max(first, Math.min(last, Math.round(value)))
}
