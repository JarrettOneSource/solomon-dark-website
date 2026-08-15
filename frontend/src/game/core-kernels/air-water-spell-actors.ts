import {
  drawNativeFloat,
  drawNativeInteger,
  type NativeRngState,
} from './native-rng.ts'
import {
  PRIMARY_SPELL_PRISMATIC_LIFETIME_TICKS,
  type PrimarySpellAirPrismaticState,
  type PrimarySpellAirStormState,
  type PrimarySpellWaterFreezeWaveState,
  type PrimarySpellWaterHailState,
} from './primary-spells.ts'
import type { Vector2 } from './vector.ts'

export const NATIVE_STORM_QUERY_RADIUS = 500
export const NATIVE_STORM_FADE_PER_TICK = 0.01
export const NATIVE_STORM_FADE_TICKS = 101
export const NATIVE_STORM_ALPHA_GAIN_PER_TICK = 0.05
export const NATIVE_STORM_SCALE_FACTOR = 1.2
export const NATIVE_TORNADO_MOVEMENT_PER_TICK = Math.fround(0.349999994)
export const NATIVE_TORNADO_HEADING_STEP_MAXIMUM = 2
export const NATIVE_STORM_STRIKE_DELAY_MINIMUM = 30
export const NATIVE_STORM_STRIKE_DELAY_MAXIMUM = 120
export const NATIVE_FREEZE_WAVE_INITIAL_LIFE = Math.fround(0.924)
export const NATIVE_FREEZE_WAVE_LIFE_PER_TICK = 0.01
export const NATIVE_FREEZE_WAVE_FADE_THRESHOLD = 0.12375
export const NATIVE_FREEZE_WAVE_ALPHA_FACTOR = 0.9
export const NATIVE_FREEZE_WAVE_INITIAL_RADIUS = 75
export const NATIVE_FREEZE_WAVE_RADIUS_PER_TICK = 6
export const NATIVE_FREEZE_WAVE_QUERY_INTERVAL_TICKS = 10
export const NATIVE_FREEZE_WAVE_LIFETIME_TICKS = 93
export const NATIVE_HAIL_INITIAL_LIFE = Math.fround(2)
export const NATIVE_HAIL_LIFE_PER_TICK = Math.fround(0.015)
export const NATIVE_HAIL_BOUNCE_PROGRESS_PER_TICK = Math.fround(0.02)
export const NATIVE_HAIL_BOUNCE_ACCELERATION = Math.fround(0.4)
export const NATIVE_HAIL_BOUNCE_RESTITUTION = Math.fround(0.65)
export const NATIVE_HAIL_STOP_VELOCITY = Math.fround(-0.75)
export const NATIVE_HAIL_BASE_SPEED = Math.fround(4)
export const NATIVE_HAIL_ANGLE_DIVISIONS = 100_000

export interface NativeAirStormSkillProfile {
  readonly activeTicks: number
  readonly damageMaximum: number
  readonly damageMinimum: number
  readonly firstStrikeTicks: number
  readonly frequencyFactor: number
  readonly kind: 'air-storm'
  readonly manaCost: number
  readonly moving: boolean
  readonly rank: number
  readonly skillId: 27
}

export interface NativeAirPrismaticSkillProfile {
  readonly durationTicks: number
  readonly kind: 'air-prismatic'
  readonly manaCost: number
  readonly radius: number
  readonly rank: number
  readonly skillId: 30
}

export interface NativeWaterRingSkillProfile {
  readonly freezeDurationTicks: number
  readonly kind: 'water-ring'
  readonly manaCost: number
  readonly rank: number
  readonly skillId: 35
}

export interface NativeStormActorTickResult {
  readonly actor: PrimarySpellAirStormState | null
  readonly rng: NativeRngState
  readonly strikeDue: boolean
}

export function createNativeAirStormActor(
  id: number,
  ownerId: string,
  worldKey: string,
  birthTick: number,
  position: Readonly<Vector2>,
  profile: NativeAirStormSkillProfile,
  headingDegrees: number,
): PrimarySpellAirStormState {
  return {
    activeTicksRemaining: profile.activeTicks,
    ageTicks: 0,
    alpha: 0,
    birthTick,
    damageMaximum: profile.damageMaximum,
    damageMinimum: profile.damageMinimum,
    frequencyFactor: profile.frequencyFactor,
    headingDegrees: normalizeDegrees(headingDegrees),
    id,
    kind: 'air-storm',
    moving: profile.moving,
    ownerId,
    position: { ...position },
    scale: Math.fround(0.01),
    strikeTicksRemaining: profile.firstStrikeTicks,
    worldKey,
  }
}

export function drawNativeStormInitialHeading(
  source: NativeRngState,
): { readonly rng: NativeRngState; readonly value: number } {
  const draw = drawNativeFloat(source, 360)
  return { rng: draw.state, value: draw.value }
}

export function stepNativeAirStormActor(
  source: PrimarySpellAirStormState,
  sourceRng: NativeRngState,
): NativeStormActorTickResult {
  if (source.activeTicksRemaining <= 0) {
    const alpha = Math.fround(source.alpha - NATIVE_STORM_FADE_PER_TICK)
    return {
      actor: alpha <= 0
        ? null
        : { ...source, ageTicks: source.ageTicks + 1, alpha },
      rng: sourceRng,
      strikeDue: false,
    }
  }

  let rng = sourceRng
  let headingDegrees = source.headingDegrees
  let position = source.position
  if (source.moving) {
    const turn = drawNativeFloat(rng, NATIVE_TORNADO_HEADING_STEP_MAXIMUM)
    rng = turn.state
    headingDegrees = normalizeDegrees(Math.fround(headingDegrees + turn.value))
    const radians = headingDegrees * Math.PI / 180
    position = {
      x: Math.fround(position.x + Math.cos(radians) * NATIVE_TORNADO_MOVEMENT_PER_TICK),
      y: Math.fround(position.y + Math.sin(radians) * NATIVE_TORNADO_MOVEMENT_PER_TICK),
    }
  }
  const strikeTicksRemaining = source.strikeTicksRemaining - 1
  return {
    actor: {
      ...source,
      activeTicksRemaining: source.activeTicksRemaining - 1,
      ageTicks: source.ageTicks + 1,
      alpha: Math.min(1, Math.fround(source.alpha + NATIVE_STORM_ALPHA_GAIN_PER_TICK)),
      headingDegrees,
      position,
      scale: Math.min(1, Math.fround(source.scale * NATIVE_STORM_SCALE_FACTOR)),
      strikeTicksRemaining,
    },
    rng,
    strikeDue: strikeTicksRemaining <= 0,
  }
}

export function resetNativeStormStrikeDelay(
  source: PrimarySpellAirStormState,
  sourceRng: NativeRngState,
): { readonly actor: PrimarySpellAirStormState; readonly rng: NativeRngState } {
  const draw = drawNativeInteger(
    sourceRng,
    NATIVE_STORM_STRIKE_DELAY_MAXIMUM - NATIVE_STORM_STRIKE_DELAY_MINIMUM + 1,
  )
  return {
    actor: {
      ...source,
      strikeTicksRemaining: Math.trunc(
        (NATIVE_STORM_STRIKE_DELAY_MINIMUM + draw.value) / source.frequencyFactor,
      ),
    },
    rng: draw.state,
  }
}

export function drawNativeSpellDamage(
  source: NativeRngState,
  minimum: number,
  maximum: number,
): { readonly rng: NativeRngState; readonly value: number } {
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || maximum < minimum) {
    throw new RangeError('native spell damage range is invalid')
  }
  const draw = drawNativeFloat(source, maximum - minimum)
  return { rng: draw.state, value: Math.fround(minimum + draw.value) }
}

export function drawNativePercentile(
  source: NativeRngState,
  chance: number,
): { readonly rng: NativeRngState; readonly success: boolean } {
  if (!Number.isInteger(chance) || chance < 0 || chance > 100) {
    throw new RangeError('native percentile chance must be an integer within [0,100]')
  }
  const draw = drawNativeInteger(source, 100)
  return { rng: draw.state, success: draw.value < chance }
}

/**
 * Lightning's Disintegrate branch uses the retail high-tail percentile test.
 * It is intentionally separate from low-tail callers such as Hail.
 */
export function drawNativeDisintegratePercentile(
  source: NativeRngState,
  chance: number,
): { readonly rng: NativeRngState; readonly success: boolean } {
  if (!Number.isInteger(chance) || chance < 0 || chance > 100) {
    throw new RangeError('native Disintegrate chance must be an integer within [0,100]')
  }
  const draw = drawNativeInteger(source, 100)
  return { rng: draw.state, success: draw.value >= 100 - chance }
}

export interface NativeWaterHailBirthResult {
  readonly actor: PrimarySpellWaterHailState
  readonly rng: NativeRngState
}

export interface NativeWaterHailTickResult {
  readonly actor: PrimarySpellWaterHailState | null
  readonly rng: NativeRngState
}

/**
 * Mirrors Anim_Bouncer followed by Anim_Hail and the Frost-Jet handler's
 * placement/speed draws. The order is gameplay-significant because all eight
 * draws consume the one authoritative combat RNG stream.
 */
export function createNativeWaterHailActor(
  id: number,
  ownerId: string,
  worldKey: string,
  birthTick: number,
  frostPosition: Readonly<Vector2>,
  frostDirection: Readonly<Vector2>,
  sourceRng: NativeRngState,
): NativeWaterHailBirthResult {
  const bounceVelocity = drawNativeFloat(sourceRng, 3)
  const height = drawNativeFloat(bounceVelocity.state, 20)
  const rotation = drawNativeFloat(height.state, 360)
  const rotationStep = drawNativeFloat(rotation.state, 10)
  const scale = drawNativeFloat(rotationStep.state, 1)
  const radialDistance = drawNativeFloat(scale.state, 15)
  const radialHeading = drawNativeInteger(
    radialDistance.state,
    NATIVE_HAIL_ANGLE_DIVISIONS + 1,
  )
  const speed = drawNativeFloat(radialHeading.state, 2)
  const headingDegrees = Math.fround(
    Math.fround(radialHeading.value / NATIVE_HAIL_ANGLE_DIVISIONS) * 360,
  )
  const radians = headingDegrees * Math.PI / 180
  const radial = {
    x: Math.fround(Math.sin(radians) * radialDistance.value),
    y: Math.fround(-Math.cos(radians) * radialDistance.value),
  }
  const horizontalSpeed = Math.fround(NATIVE_HAIL_BASE_SPEED + speed.value)
  return {
    actor: {
      ageTicks: 0,
      birthTick,
      bounceProgress: 0,
      bounceSoundIndex: null,
      bounceSoundPitch: null,
      bounceSoundSequence: 0,
      height: Math.fround(-height.value),
      horizontalVelocity: {
        x: Math.fround(frostDirection.x * horizontalSpeed),
        y: Math.fround(frostDirection.y * horizontalSpeed),
      },
      id,
      kind: 'water-hail',
      life: NATIVE_HAIL_INITIAL_LIFE,
      ownerId,
      position: {
        x: Math.fround(frostPosition.x + radial.x),
        y: Math.fround(frostPosition.y + radial.y),
      },
      rotationDegrees: rotation.value,
      rotationStepDegrees: Math.fround(1 + rotationStep.value),
      savedBounceVelocity: Math.fround(-(2 + bounceVelocity.value)),
      scale: Math.fround(1 + scale.value),
      verticalVelocity: 0,
      worldKey,
    },
    rng: speed.state,
  }
}

export function stepNativeWaterHailActor(
  source: PrimarySpellWaterHailState,
  sourceRng: NativeRngState,
): NativeWaterHailTickResult {
  let rng = sourceRng
  let bounceProgress = Math.min(
    1,
    Math.fround(source.bounceProgress + NATIVE_HAIL_BOUNCE_PROGRESS_PER_TICK),
  )
  let verticalVelocity = Math.fround(
    source.verticalVelocity
      + Math.fround(
        Math.fround(source.bounceProgress * NATIVE_HAIL_BOUNCE_ACCELERATION) * 2,
      ),
  )
  let height = Math.fround(source.height + Math.fround(source.verticalVelocity * 2))
  let horizontalVelocity = { ...source.horizontalVelocity }
  let rotationStepDegrees = source.rotationStepDegrees
  let savedBounceVelocity = source.savedBounceVelocity
  let bounceSoundIndex = source.bounceSoundIndex
  let bounceSoundPitch = source.bounceSoundPitch
  let bounceSoundSequence = source.bounceSoundSequence

  if (height > 0) {
    const rotationStep = drawNativeFloat(rng, 10)
    rng = rotationStep.state
    rotationStepDegrees = Math.fround(1 + rotationStep.value)
    savedBounceVelocity = Math.fround(
      savedBounceVelocity * NATIVE_HAIL_BOUNCE_RESTITUTION,
    )
    verticalVelocity = savedBounceVelocity

    const soundGate = drawNativeInteger(rng, 3)
    rng = soundGate.state
    if (soundGate.value === 1) {
      const pitch = drawNativeFloat(rng, Math.fround(0.2))
      rng = pitch.state
      const sample = drawNativeInteger(rng, 4)
      rng = sample.state
      bounceSoundIndex = sample.value
      bounceSoundPitch = Math.fround(1 + pitch.value)
      bounceSoundSequence += 1
    }

    const horizontalDamping = drawNativeInteger(rng, 2)
    rng = horizontalDamping.state
    if (horizontalDamping.value === 1) {
      horizontalVelocity = {
        x: Math.fround(horizontalVelocity.x * NATIVE_HAIL_BOUNCE_RESTITUTION),
        y: Math.fround(horizontalVelocity.y * NATIVE_HAIL_BOUNCE_RESTITUTION),
      }
    }
    if (verticalVelocity > NATIVE_HAIL_STOP_VELOCITY) {
      bounceProgress = 0
      horizontalVelocity = { x: 0, y: 0 }
      rotationStepDegrees = 0
      savedBounceVelocity = 0
      verticalVelocity = 0
    }
    height = verticalVelocity
  }

  const life = Math.fround(source.life - NATIVE_HAIL_LIFE_PER_TICK)
  if (life <= 0) return { actor: null, rng }
  return {
    actor: {
      ...source,
      ageTicks: source.ageTicks + 1,
      bounceProgress,
      bounceSoundIndex,
      bounceSoundPitch,
      bounceSoundSequence,
      height,
      horizontalVelocity,
      life,
      position: {
        x: Math.fround(source.position.x + source.horizontalVelocity.x),
        y: Math.fround(source.position.y + source.horizontalVelocity.y),
      },
      rotationDegrees: Math.fround(source.rotationDegrees + rotationStepDegrees),
      rotationStepDegrees,
      savedBounceVelocity,
      verticalVelocity,
    },
    rng,
  }
}

export function createNativeAirPrismaticActor(
  id: number,
  ownerId: string,
  worldKey: string,
  birthTick: number,
  origin: Readonly<Vector2>,
  profile: NativeAirPrismaticSkillProfile,
): PrimarySpellAirPrismaticState {
  return {
    ageTicks: 0,
    birthTick,
    durationTicks: PRIMARY_SPELL_PRISMATIC_LIFETIME_TICKS,
    id,
    kind: 'air-prismatic',
    modifierDurationTicks: profile.durationTicks,
    origin: { ...origin },
    ownerId,
    radius: profile.radius,
    worldKey,
  }
}

export function createNativeWaterFreezeWave(
  id: number,
  ownerId: string,
  worldKey: string,
  birthTick: number,
  origin: Readonly<Vector2>,
  profile: NativeWaterRingSkillProfile,
): PrimarySpellWaterFreezeWaveState {
  return {
    ageTicks: 0,
    alpha: 1,
    birthTick,
    freezeDurationTicks: profile.freezeDurationTicks,
    hitTargetIds: [],
    id,
    kind: 'water-freeze-wave',
    life: NATIVE_FREEZE_WAVE_INITIAL_LIFE,
    origin: { ...origin },
    ownerId,
    radius: NATIVE_FREEZE_WAVE_INITIAL_RADIUS,
    worldKey,
  }
}

export function stepNativeWaterFreezeWave(
  source: PrimarySpellWaterFreezeWaveState,
): {
  readonly actor: PrimarySpellWaterFreezeWaveState | null
  readonly queryDue: boolean
} {
  const ageTicks = source.ageTicks + 1
  const life = Math.fround(source.life - NATIVE_FREEZE_WAVE_LIFE_PER_TICK)
  if (life <= 0) return { actor: null, queryDue: false }
  return {
    actor: {
      ...source,
      ageTicks,
      alpha: life < NATIVE_FREEZE_WAVE_FADE_THRESHOLD
        ? Math.fround(source.alpha * NATIVE_FREEZE_WAVE_ALPHA_FACTOR)
        : source.alpha,
      life,
      radius: Math.fround(source.radius + NATIVE_FREEZE_WAVE_RADIUS_PER_TICK),
    },
    queryDue: ageTicks % NATIVE_FREEZE_WAVE_QUERY_INTERVAL_TICKS === 0,
  }
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360
}
