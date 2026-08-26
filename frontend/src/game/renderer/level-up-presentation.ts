export const NATIVE_GAME_TICKS_PER_SECOND = 100
export const NATIVE_SKILL_PICKER_REVEAL_TICKS = 40
export const NATIVE_LEVEL_UP_EFFECT_TICKS = 180
export const NATIVE_LEVEL_UP_PARTICLE_MAX_TICKS = 60
export const NATIVE_LEVEL_UP_PRESENTATION_DURATION_MS = (
  NATIVE_LEVEL_UP_EFFECT_TICKS + NATIVE_LEVEL_UP_PARTICLE_MAX_TICKS - 1
) * (1000 / NATIVE_GAME_TICKS_PER_SECOND)

const NATIVE_TICK_MS = 1000 / NATIVE_GAME_TICKS_PER_SECOND
const NATIVE_LEVEL_UP_PARTICLE_TIMER = 180
const NATIVE_LEVEL_UP_PARTICLE_DECAY = 3
const NATIVE_LEVEL_UP_PARTICLE_DECAY_RANGE = 2
const NATIVE_LEVEL_UP_SPREAD = 30
const NATIVE_RANDOM_FLOAT_BOUND = 100_001
const NATIVE_RANDOM_FLOAT_DIVISOR = 100_000
const NATIVE_RANDOM_FLOAT_MASK = 0x1ffff
const NATIVE_SPARKLE_RISE_PER_TICK = Math.fround(0.1)

export interface NativeSkillPickerReveal {
  readonly ambientAlpha: number
  readonly curtainAlpha: number
  readonly interactive: boolean
  readonly panelAlpha: number
  readonly revealAlpha: number
}

export type NativeSkillPickerCloseDirection = -1 | -0.75

export interface NativeLevelUpParticle {
  readonly alpha: number
  readonly atlas: 'BadGuys'
  readonly entry: 73
  readonly offsetX: number
  readonly offsetY: number
  readonly rotationRadians: number
  readonly scale: number
}

export interface NativeLevelUpPresentationFrame {
  readonly emitting: boolean
  readonly lightRadius: number
  readonly particles: readonly NativeLevelUpParticle[]
  readonly tick: number
}

export const LEVEL_UP_PICKER_BACKGROUND_VISIBILITY = Object.freeze({
  enemyDeathEffects: true,
  enemyLightning: true,
  enemyProjectiles: true,
  enemies: true,
  localPlayer: true,
  localPlayerLevelUpEffect: true,
  maggots: true,
  nonPlayerActors: true,
  playerDeathBursts: true,
  primarySpells: true,
  remotePlayers: true,
  scenery: true,
})

export function nativeSkillPickerReveal(elapsedMs: number): NativeSkillPickerReveal {
  const tick = nativeElapsedTick(elapsedMs)
  const revealAlpha = Math.min(1, tick / NATIVE_SKILL_PICKER_REVEAL_TICKS)
  return nativeSkillPickerFrame(revealAlpha, revealAlpha === 1)
}

export function nativeSkillPickerClose(
  elapsedMs: number,
  direction: NativeSkillPickerCloseDirection,
): NativeSkillPickerReveal {
  const tick = nativeElapsedTick(elapsedMs)
  const revealAlpha = Math.max(0, 1 + direction * 0.025 * tick)
  return nativeSkillPickerFrame(revealAlpha, false)
}

export function skillPickerWorldPresentationFrame(
  worldTick: number,
  presentationFrame: number,
  levelUpBarrierActive: boolean,
): number {
  return levelUpBarrierActive ? worldTick : presentationFrame
}

function nativeSkillPickerFrame(
  revealAlpha: number,
  interactive: boolean,
): NativeSkillPickerReveal {
  return {
    ambientAlpha: revealAlpha * 0.1,
    curtainAlpha: revealAlpha * 0.5,
    interactive,
    panelAlpha: revealAlpha ** 3,
    revealAlpha,
  }
}

export function nativeLevelUpPresentationFrame(
  presentationId: number,
  elapsedMs: number,
  playerScreenY: number,
): NativeLevelUpPresentationFrame {
  const tick = nativeElapsedTick(elapsedMs)
  const latestBirthTick = Math.min(tick, NATIVE_LEVEL_UP_EFFECT_TICKS - 1)
  const verticalSpan = Number.isFinite(playerScreenY) ? Math.max(0, playerScreenY) : 0
  const particles: NativeLevelUpParticle[] = []
  for (let birthTick = 0; birthTick <= latestBirthTick; birthTick += 1) {
    const ageTicks = tick - birthTick
    if (ageTicks >= NATIVE_LEVEL_UP_PARTICLE_MAX_TICKS) continue
    const spawnY = Math.fround(
      -20 - nativePresentationRandomFloat(presentationId, birthTick, 0, verticalSpan),
    )
    const spawnX = nativePresentationSignedRandomFloat(
      presentationId,
      birthTick,
      1,
      2,
      NATIVE_LEVEL_UP_SPREAD,
    )
    const rotationDegrees = nativePresentationRandomFloat(
      presentationId,
      birthTick,
      3,
      360,
    )
    const rotationRadians = rotationDegrees * Math.PI / 180
    const decay = Math.fround(
      NATIVE_LEVEL_UP_PARTICLE_DECAY
        + nativePresentationRandomFloat(
          presentationId,
          birthTick,
          4,
          NATIVE_LEVEL_UP_PARTICLE_DECAY_RANGE,
        ),
    )
    let remainingTimer = NATIVE_LEVEL_UP_PARTICLE_TIMER
    let offsetY = spawnY
    for (let ageTick = 0; ageTick < ageTicks; ageTick += 1) {
      remainingTimer = Math.fround(remainingTimer - decay)
      offsetY = Math.fround(offsetY - NATIVE_SPARKLE_RISE_PER_TICK)
    }
    if (remainingTimer <= 0) continue
    const lateralFade = 1 - Math.abs(spawnX) / NATIVE_LEVEL_UP_SPREAD
    const emitterTimer = NATIVE_LEVEL_UP_EFFECT_TICKS - birthTick - 1
    const birthAlpha = Math.sin(
      emitterTimer * Math.PI / 180,
    )
    particles.push({
      alpha: Math.max(0, birthAlpha) * lateralFade * 0.75,
      atlas: 'BadGuys',
      entry: 73,
      offsetX: spawnX,
      offsetY,
      rotationRadians,
      scale: Math.sin(remainingTimer * Math.PI / 180),
    })
  }
  const emitterTimer = Math.max(0, NATIVE_LEVEL_UP_EFFECT_TICKS - tick - 1)
  return {
    emitting: tick < NATIVE_LEVEL_UP_EFFECT_TICKS,
    lightRadius: 2.6 + Math.sin(emitterTimer * Math.PI / 180),
    particles,
    tick,
  }
}

function nativeElapsedTick(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0
  return Math.floor(elapsedMs / NATIVE_TICK_MS)
}

function nativePresentationSignedRandomFloat(
  presentationId: number,
  tick: number,
  magnitudeLane: number,
  signLane: number,
  magnitude: number,
): number {
  const value = nativePresentationRandomFloat(
    presentationId,
    tick,
    magnitudeLane,
    magnitude,
  )
  const signWord = nativePresentationRandomWord(presentationId, tick, signLane)
  return ((signWord >>> 6) & 1) === 1 ? -value : value
}

function nativePresentationRandomFloat(
  presentationId: number,
  tick: number,
  lane: number,
  magnitude: number,
): number {
  const word = nativePresentationRandomWord(presentationId, tick, lane)
  const integer = ((word >>> 6) & NATIVE_RANDOM_FLOAT_MASK) % NATIVE_RANDOM_FLOAT_BOUND
  const quotient = Math.fround(Math.fround(integer) / NATIVE_RANDOM_FLOAT_DIVISOR)
  return Math.fround(quotient * Math.fround(magnitude))
}

function nativePresentationRandomWord(
  presentationId: number,
  tick: number,
  lane: number,
): number {
  let value = Math.imul(presentationId | 0, 0x9e3779b1)
    ^ Math.imul(tick | 0, 0x85ebca77)
    ^ Math.imul(lane | 0, 0xc2b2ae3d)
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad)
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97)
  return (value ^ (value >>> 15)) >>> 0
}
