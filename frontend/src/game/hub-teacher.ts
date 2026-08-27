export const HUB_TEACHER_TICKS_PER_SECOND = 100
export const HUB_TEACHER_CAST_TICKS = 268
export const HUB_TEACHER_IDLE_START_TICK = 347
export const HUB_TEACHER_CYCLE_TICKS = 847
export const HUB_TEACHER_CAST_SECONDS = (
  HUB_TEACHER_CAST_TICKS / HUB_TEACHER_TICKS_PER_SECOND
)
export const HUB_TEACHER_RELEASE_SECONDS = (
  (HUB_TEACHER_IDLE_START_TICK - HUB_TEACHER_CAST_TICKS)
  / HUB_TEACHER_TICKS_PER_SECOND
)
export const HUB_TEACHER_CYCLE_SECONDS = (
  HUB_TEACHER_CYCLE_TICKS / HUB_TEACHER_TICKS_PER_SECOND
)

// Teacher::Cast spawns its children at actor + (-38, 40 - 25). Teacher's
// auxiliary vtable pass separately paints College[13] beneath the actor.
export const HUB_TEACHER_CAST_ORIGIN = { x: -38, y: 15 } as const

// Auxiliary Teacher painter 0x00505480 centers College[13] at this actor-local
// point, then restores opaque color before drawing the ground shadow.
export const HUB_TEACHER_RUNE_CENTER = { x: -40, y: 30 } as const
export const HUB_TEACHER_RUNE_ALPHA = 0.25

export type HubTeacherPhase = 'cast' | 'idle' | 'release'

interface HubTeacherBurstMember {
  readonly alpha: number
  readonly scaleX: number
  readonly scaleY: number
  readonly visible: boolean
}

interface HubTeacherBurstFrames extends HubTeacherBurstMember {
  readonly frame: number
}

export interface HubTeacherBurstPresentation {
  readonly ageTicks: number
  readonly column: HubTeacherBurstMember
  readonly core: HubTeacherBurstMember
  readonly flare: HubTeacherBurstMember
  readonly frames: HubTeacherBurstFrames
  readonly releaseIndex: number
  readonly visible: boolean
}

export function hubTeacherPhaseAt(elapsedSeconds: number): HubTeacherPhase {
  const tick = teacherCycleTick(elapsedSeconds)
  if (tick < HUB_TEACHER_CAST_TICKS) return 'cast'
  if (tick < HUB_TEACHER_IDLE_START_TICK) return 'release'
  return 'idle'
}

export function hubTeacherFrameAt(elapsedSeconds: number, seed = 0): number {
  const absoluteTick = teacherAbsoluteTick(elapsedSeconds)
  const tick = absoluteTick % HUB_TEACHER_CYCLE_TICKS
  if (tick === 0) return 0
  if (tick < HUB_TEACHER_CAST_TICKS) {
    return teacherWord(seed, absoluteTick, 0) & 1
  }
  return tick < HUB_TEACHER_IDLE_START_TICK ? 2 : 3
}

export function hubTeacherBurstAt(
  elapsedSeconds: number,
  seed = 0,
): HubTeacherBurstPresentation {
  const absoluteTick = teacherAbsoluteTick(elapsedSeconds)
  const cycleTick = absoluteTick % HUB_TEACHER_CYCLE_TICKS
  const releaseIndex = Math.floor(absoluteTick / HUB_TEACHER_CYCLE_TICKS)
  if (cycleTick < HUB_TEACHER_CAST_TICKS) return hiddenBurst(releaseIndex)

  const ageTicks = cycleTick - HUB_TEACHER_CAST_TICKS
  const flareScale = Math.fround(
    1 + teacherFloat(seed, releaseIndex, 1, 0.1),
  )
  const frameScale = Math.fround(
    2 - teacherFloat(seed, releaseIndex, 2, 0.5),
  )
  const frameFactor = Math.fround(
    1 + teacherFloat(seed, releaseIndex, 3, 0.2),
  )
  const frameStep = Math.fround(0.75 * frameFactor)
  const frameAlphaLoss = Math.fround(0.02 * frameFactor)
  const frame = Math.trunc(Math.fround(frameStep * ageTicks))
  const mirror = (teacherWord(seed, releaseIndex, 4) & 1) === 1

  const core = member(nativeDecay(1, 0.1, ageTicks), 6, 4)
  const flare = member(nativeDecay(1, 0.0075, ageTicks), flareScale, flareScale)
  const column = member(nativeDecay(2, 0.04, ageTicks), 1, 1)
  const frames = Object.freeze({
    alpha: nativeDecay(1, frameAlphaLoss, ageTicks),
    frame: Math.min(10, Math.max(0, frame)),
    scaleX: mirror ? -frameScale : frameScale,
    scaleY: frameScale,
    visible: frame >= 0 && frame < 11,
  })
  const visible = core.visible || flare.visible || column.visible || frames.visible
  return Object.freeze({
    ageTicks,
    column,
    core,
    flare,
    frames,
    releaseIndex,
    visible,
  })
}

function teacherAbsoluteTick(elapsedSeconds: number): number {
  return Math.max(0, Math.floor(elapsedSeconds * HUB_TEACHER_TICKS_PER_SECOND + 1e-6))
}

function teacherCycleTick(elapsedSeconds: number): number {
  return teacherAbsoluteTick(elapsedSeconds) % HUB_TEACHER_CYCLE_TICKS
}

function member(
  rawAlpha: number,
  scaleX: number,
  scaleY: number,
): HubTeacherBurstMember {
  return Object.freeze({
    alpha: Math.min(1, Math.max(0, rawAlpha)),
    scaleX,
    scaleY,
    visible: rawAlpha > 0,
  })
}

function hiddenBurst(releaseIndex: number): HubTeacherBurstPresentation {
  const hidden = Object.freeze({ alpha: 0, scaleX: 1, scaleY: 1, visible: false })
  return Object.freeze({
    ageTicks: -1,
    column: hidden,
    core: hidden,
    flare: hidden,
    frames: Object.freeze({ ...hidden, frame: 0 }),
    releaseIndex,
    visible: false,
  })
}

function nativeDecay(initial: number, loss: number, ageTicks: number): number {
  let value = Math.fround(initial)
  const nativeLoss = Math.fround(loss)
  for (let tick = 0; tick < ageTicks && value > 0; tick += 1) {
    value = Math.fround(value - nativeLoss)
  }
  return value
}

function teacherFloat(
  seed: number,
  releaseIndex: number,
  channel: number,
  magnitude: number,
): number {
  const word = teacherWord(seed, releaseIndex, channel) & 0x7fff
  return Math.fround(Math.fround(word / 0x7fff) * magnitude)
}

function teacherWord(seed: number, tick: number, channel: number): number {
  let value = (seed ^ Math.imul(tick + 1, 0x9e3779b1) ^ Math.imul(channel + 1, 0x85ebca6b)) >>> 0
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d) >>> 0
  value ^= value >>> 15
  value = Math.imul(value, 0x846ca68b) >>> 0
  return (value ^ value >>> 16) >>> 0
}
