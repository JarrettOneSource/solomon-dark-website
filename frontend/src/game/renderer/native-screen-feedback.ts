import type { NativeScreenFlashState } from '../core-kernels/native-screen-flash.ts'
import { NativeScreenFlashPresentation } from './native-screen-flash.ts'
import {
  nativeRegionHitPointGain,
  nativeRegionPointGain,
} from '../core-kernels/native-region-point-gain.ts'
import type {
  NativeSecondaryActorState,
  NativeSecondaryEventState,
} from '../core-kernels/native-secondary-abilities.ts'
import type {
  PrimarySpellEtherBlastState,
} from '../core-kernels/primary-spells.ts'
import type {
  Vector2,
} from '../core-kernels/vector.ts'
import type {
  BoneyardEnemyEventSnapshot,
} from '../protocol/game-state.ts'
import {
  repeatedFloatMultiply,
} from './native-secondary-draws.ts'
import type {
  NativeSecondaryScreenFeedbackContext,
  NativeSecondaryScreenOverlay,
  NativeSecondaryWorldShake,
} from './native-secondary-presentation-types.ts'

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

const MAGIC_SHIELD_EXPLOSION_CAMERA_DECAY = Math.fround(0.94)

const MAGIC_SHIELD_EXPLOSION_CAMERA_CUTOFF = Math.fround(0.001)

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

export class NativeSecondaryScreenFeedbackPresentation {
  private cameraDisplacementX = 0
  private cameraDisplacementY = 0
  private cameraMagnitude = 0
  private lastEnemyEventId = 0
  private lastEventId = 0
  private lastPrimaryImpactId = 0
  private lastPrimaryFeedbackId = 0
  private lastPrimaryMagnitudeId = 0
  private lastTick: number
  private readonly flashes: NativeScreenFlashPresentation
  private readonly worldKey: string

  constructor(
    initialTick: number,
    worldKey: string,
  ) {
    this.lastTick = Math.max(0, Math.trunc(initialTick))
    this.worldKey = worldKey
    this.flashes = new NativeScreenFlashPresentation(initialTick, worldKey)
  }

  consume(
    event: NativeSecondaryEventState,
    _context: NativeSecondaryScreenFeedbackContext,
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
    if (event.cameraDisplacement !== null) this.writeCameraDisplacement(event.cameraDisplacement, eventTick)
  }

  consumeEnemy(event: BoneyardEnemyEventSnapshot, context: NativeSecondaryScreenFeedbackContext): void {
    if (event.eventId <= this.lastEnemyEventId) return
    this.lastEnemyEventId = event.eventId
    if (`boneyard:${event.runId}` !== this.worldKey) return
    this.advanceTo(event.tick)
    if (event.cameraShake) {
      if (event.sourcePosition === undefined) throw new Error('Boss camera shake requires its world position')
      const attenuation = event.cameraShake.attenuation
      const gain = attenuation === 'fixed' ? 1 : (attenuation === 'point' ? nativeRegionPointGain : nativeRegionHitPointGain)(
        event.sourcePosition, context.cameraCenter, context.visibleWorldWidth, context.localPlayerAlternate,
      )
      const scale = attenuation === 'hit-squared' ? Math.fround(gain * gain) : gain
      this.writeCameraDisplacement({ x: Math.fround(event.cameraShake.displacement.x * scale),
        y: Math.fround(event.cameraShake.displacement.y * scale) }, event.tick)
    }
  }

  consumeScreenFlashes(state: NativeScreenFlashState, context: NativeSecondaryScreenFeedbackContext): void {
    this.flashes.consume(state, context)
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
    this.writeCameraDisplacement(input.displacement, eventTick)
  }

  private writeCameraDisplacement(displacement: Vector2, eventTick: number): void {
    let x = Math.fround(displacement.x)
    let y = Math.fround(displacement.y)
    if (eventTick < this.lastTick) {
      x = repeatedFloatMultiply(x, Math.fround(.75), this.lastTick - eventTick)
      y = repeatedFloatMultiply(y, Math.fround(.75), this.lastTick - eventTick)
    }
    const currentSquared = this.cameraDisplacementX * this.cameraDisplacementX
      + this.cameraDisplacementY * this.cameraDisplacementY
    if (x * x + y * y > currentSquared) {
      this.cameraDisplacementX = x
      this.cameraDisplacementY = y
    }
  }

  consumePrimaryEtherBlast(
    effect: PrimarySpellEtherBlastState,
    _context: NativeSecondaryScreenFeedbackContext,
  ): void {
    if (effect.id <= this.lastPrimaryFeedbackId) return
    this.lastPrimaryFeedbackId = effect.id
    if (effect.worldKey !== this.worldKey) return
    const eventTick = Math.max(0, Math.trunc(effect.birthTick))
    if (eventTick > this.lastTick) this.advanceTo(eventTick)
    this.cameraMagnitude = Math.fround(effect.charges * Math.fround(0.1))
    if (eventTick < this.lastTick) {
      this.cameraMagnitude = repeatedFloatMultiply(this.cameraMagnitude,
        MAGIC_SHIELD_EXPLOSION_CAMERA_DECAY, this.lastTick - eventTick)
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
    return this.flashes.sample(tick)
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
