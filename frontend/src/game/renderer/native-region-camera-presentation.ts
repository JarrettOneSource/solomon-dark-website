import { decayNativeRegionCameraDisplacement, nativeCameraMagnitudeSquared, NATIVE_FLAME_CAMERA_MAX_PRESENTATION_TICKS } from '../core-kernels/native-weld-flame-camera.ts'
import type { Vector2 } from '../core-kernels/vector.ts'
import { repeatedFloatMultiply } from './native-secondary-draws.ts'

const ZERO: Readonly<Vector2> = Object.freeze({ x: 0, y: 0 })

function stronger(current: Readonly<Vector2>, proposal: Readonly<Vector2>): Readonly<Vector2> {
  return nativeCameraMagnitudeSquared(proposal) > nativeCameraMagnitudeSquared(current) ? proposal : current
}

/**
 * Region 0x448590/0x63F1D6: one strict maximum, then one shared decay/cutoff.
 * A late Flame recipe can change a birth-time tie, so retain the short shared
 * history rather than comparing independently aged vectors at delivery time.
 * Each phase compresses to its strict-f32 winner; memory is at most seven
 * Region ticks plus a checkpoint, independent of proposal count.
 */
export class NativeRegionCameraPresentation {
  private checkpointTick: number
  private checkpoint: Readonly<Vector2> = ZERO
  private tick: number
  private value: Readonly<Vector2> = ZERO
  private readonly beforeDecay = new Map<number, { displacement: Readonly<Vector2>; order: number }>()
  private readonly afterDecay = new Map<number, Readonly<Vector2>>()

  constructor(initialTick: number) {
    this.tick = Math.max(0, Math.trunc(initialTick))
    this.checkpointTick = this.tick - NATIVE_FLAME_CAMERA_MAX_PRESENTATION_TICKS
  }

  currentTick(): number { return this.tick }
  sample(): Vector2 { return { ...this.value } }

  reset(tick: number): void {
    this.tick = Math.max(0, Math.trunc(tick))
    this.checkpointTick = this.tick - NATIVE_FLAME_CAMERA_MAX_PRESENTATION_TICKS
    this.checkpoint = ZERO
    this.value = ZERO
    this.beforeDecay.clear()
    this.afterDecay.clear()
  }

  advanceTo(tick: number): void {
    if (tick <= this.tick) return
    this.tick = tick
    const floor = tick - NATIVE_FLAME_CAMERA_MAX_PRESENTATION_TICKS
    if (floor > this.checkpointTick) {
      this.checkpoint = this.replay(floor)
      this.checkpointTick = floor
      for (const at of this.beforeDecay.keys()) if (at <= floor) this.beforeDecay.delete(at)
      for (const at of this.afterDecay.keys()) if (at <= floor) this.afterDecay.delete(at)
    }
    this.value = this.replay(tick)
  }

  /** Existing families retain their represented post-update intake phase. */
  proposeCurrent(displacement: Readonly<Vector2>, eventTick: number): void {
    const elapsed = Math.max(0, this.tick - eventTick)
    const proposal = {
      x: repeatedFloatMultiply(Math.fround(displacement.x), Math.fround(.75), elapsed),
      y: repeatedFloatMultiply(Math.fround(displacement.y), Math.fround(.75), elapsed),
    }
    const previous = this.afterDecay.get(this.tick)
    if (!previous || stronger(previous, proposal) === proposal) this.afterDecay.set(this.tick, proposal)
    this.value = this.replay(this.tick)
  }

  /** Flame submits before its birth pass's Region decay. IDs retain birth order. */
  proposeFlame(displacement: Readonly<Vector2>, birthTick: number, order: number): void {
    if (birthTick <= this.checkpointTick) return
    const proposal = { x: Math.fround(displacement.x), y: Math.fround(displacement.y) }
    const previous = this.beforeDecay.get(birthTick)
    const squared = nativeCameraMagnitudeSquared(proposal)
    const previousSquared = previous ? nativeCameraMagnitudeSquared(previous.displacement) : -1
    if (!previous || squared > previousSquared || (squared === previousSquared && order < previous.order)) {
      this.beforeDecay.set(birthTick, { displacement: proposal, order })
    }
    this.value = this.replay(this.tick)
  }

  private replay(throughTick: number): Readonly<Vector2> {
    let value = this.checkpoint, tick = this.checkpointTick
    const changes = [...new Set([...this.beforeDecay.keys(), ...this.afterDecay.keys()])]
      .filter(at => tick < at && at <= throughTick).sort((left, right) => left - right)
    for (const at of changes) {
      value = decayNativeRegionCameraDisplacement(value, at - tick - 1)
      const before = this.beforeDecay.get(at)
      if (before) value = stronger(value, before.displacement)
      value = decayNativeRegionCameraDisplacement(value, 1)
      const after = this.afterDecay.get(at)
      if (after) value = stronger(value, after)
      tick = at
    }
    return decayNativeRegionCameraDisplacement(value, throughTick - tick)
  }
}
