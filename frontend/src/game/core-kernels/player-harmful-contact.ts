import { drawNativeFloat, drawNativeInteger, type NativeRngState } from './native-rng.ts'
import { NATIVE_HARDEN_CHIP_THRESHOLD } from './native-harden.ts'
import { createNativeHardenChip, type NativeHardenChip } from './native-harden-effects.ts'
import type { PlayerProgressionComponent } from './player-progression.ts'
import {
  isPlayerSkillConcentrated,
  type PlayerSkillDerivedStats,
  type PlayerSkillRuntimeComponent,
} from './player-skill-runtime.ts'
import type { Vector2 } from './vector.ts'

export const NATIVE_CONCENTRATED_DEFLECT_DAMAGE_FACTOR = 5
export const NATIVE_DEFLECT_REFLECTION_PADDING = 25
export const NATIVE_FLASH_RESPONSE_RADIUS = 100

export interface PlayerHarmfulContactResult {
  readonly damage: number
  readonly deflectPitch: number | null
  readonly deflected: boolean
  readonly flash: PlayerFlashResponse | null
  readonly hardenChip: NativeHardenChip | null
  readonly reflectedDamage: number
  readonly rng: NativeRngState
}

export interface PlayerFlashResponse {
  readonly cameraDisplacement: Readonly<{ x: number; y: number }>
  readonly durationTicks: number
  readonly growScales: readonly number[]
  readonly pitch: number
}

export function resolvePlayerHarmfulContact(
  runtime: PlayerSkillRuntimeComponent,
  derived: PlayerSkillDerivedStats,
  progression: Pick<PlayerProgressionComponent, 'mindChugTicksRemaining'>,
  damage: number,
  kind: 'magic' | 'physical',
  deflectable: boolean,
  reflectionSourceInRange: boolean,
  sourceRng: NativeRngState,
  position: Vector2,
): PlayerHarmfulContactResult {
  if (!Number.isFinite(damage) || damage < 0) {
    throw new RangeError('incoming player damage must be finite and non-negative')
  }
  let rng = sourceRng
  let flash: PlayerFlashResponse | null = null
  if (damage > 0 && derived.flashChancePercent > 0) {
    const chance = drawNativeInteger(rng, 100)
    rng = chance.state
    if (
      chance.value > 0
      && chance.value <= Math.round(derived.flashChancePercent)
    ) {
      const pitch = drawNativeFloat(rng, Math.fround(0.2))
      const heading = drawNativeInteger(pitch.state, 100_001)
      rng = heading.state
      const headingDegrees = Math.fround(
        Math.fround(heading.value / 100_000) * 360,
      )
      const headingRadians = headingDegrees * Math.PI / 180
      const growScales: number[] = []
      for (let index = 0; index < 8; index += 1) {
        const scale = drawNativeFloat(rng, 1)
        rng = scale.state
        growScales.push(Math.fround(2 - scale.value))
      }
      flash = Object.freeze({
        cameraDisplacement: Object.freeze({
          x: Math.fround(Math.sin(headingRadians) * 3),
          y: Math.fround(-Math.cos(headingRadians) * 3),
        }),
        durationTicks: derived.flashDurationTicks,
        growScales: Object.freeze(growScales),
        pitch: Math.fround(1 + pitch.value),
      })
    }
  }
  if (deflectable) {
    const draw = drawNativeInteger(rng, 100)
    rng = draw.state
    if (draw.value < derived.deflectChancePercent) {
      const pitch = drawNativeFloat(rng, 1, true)
      return Object.freeze({
        damage: 0,
        deflectPitch: Math.fround(1 + pitch.value),
        deflected: true,
        flash,
        hardenChip: null,
        reflectedDamage: kind === 'physical'
          && reflectionSourceInRange
          && isPlayerSkillConcentrated(runtime, progression, 68)
          ? damage * NATIVE_CONCENTRATED_DEFLECT_DAMAGE_FACTOR
          : 0,
        rng: pitch.state,
      })
    }
  }
  let hardenChip: NativeHardenChip | null = null
  if (kind === 'physical' && damage > 0 && runtime.harden.coating > NATIVE_HARDEN_CHIP_THRESHOLD) {
    const chipped = createNativeHardenChip(position, rng)
    hardenChip = chipped.chip
    rng = chipped.rng
  }
  const resistedDamage = damage * (1 - (kind === 'magic'
      ? derived.magicResistance
      : derived.damageResistance))
  return Object.freeze({
    damage: Math.max(0, resistedDamage - (kind === 'physical' ? runtime.harden.armor : 0)),
    deflectPitch: null,
    deflected: false,
    flash,
    hardenChip,
    reflectedDamage: 0,
    rng,
  })
}

export function playerDeflectReflectionSourceInRange(
  playerPosition: Readonly<{ x: number; y: number }>,
  playerRadius: number,
  sourcePosition: Readonly<{ x: number; y: number }>,
  sourceRadius: number,
): boolean {
  if (
    !Number.isFinite(playerRadius)
    || playerRadius < 0
    || !Number.isFinite(sourceRadius)
    || sourceRadius < 0
  ) throw new RangeError('reflection radii must be finite and non-negative')
  const deltaX = sourcePosition.x - playerPosition.x
  const deltaY = sourcePosition.y - playerPosition.y
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) {
    throw new RangeError('reflection positions must be finite')
  }
  const reach = playerRadius + sourceRadius + NATIVE_DEFLECT_REFLECTION_PADDING
  return deltaX * deltaX + deltaY * deltaY < reach * reach
}
