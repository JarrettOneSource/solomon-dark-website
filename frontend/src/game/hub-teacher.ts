// The phase counter crosses 20 after 267 fixed 60 Hz ticks; retain that
// discretisation instead of replacing the native cycle with continuous math.
export const HUB_TEACHER_CAST_SECONDS = 267 / 60
export const HUB_TEACHER_RELEASE_SECONDS = 80 / 60
export const HUB_TEACHER_IDLE_SECONDS = 500 / 60
export const HUB_TEACHER_CYCLE_SECONDS = (
  HUB_TEACHER_CAST_SECONDS
  + HUB_TEACHER_RELEASE_SECONDS
  + HUB_TEACHER_IDLE_SECONDS
)

// Teacher::Cast spawns its core at actor + (-38, 40 - 25). Teacher's auxiliary
// vtable pass separately paints College[13] beneath the actor.
export const HUB_TEACHER_CAST_ORIGIN = { x: -38, y: 15 } as const

// Auxiliary Teacher painter 0x00505480 centers College[13] at this actor-local
// point, then restores opaque color before drawing the ground shadow.
export const HUB_TEACHER_RUNE_CENTER = { x: -40, y: 30 } as const
export const HUB_TEACHER_RUNE_ALPHA = 0.25

export type HubTeacherPhase = 'cast' | 'idle' | 'release'

const HUB_TEACHER_CAST_TIMER_PER_TICK = 0.075

export function hubTeacherPhaseAt(elapsedSeconds: number): HubTeacherPhase {
  const time = (
    (elapsedSeconds % HUB_TEACHER_CYCLE_SECONDS)
    + HUB_TEACHER_CYCLE_SECONDS
  ) % HUB_TEACHER_CYCLE_SECONDS
  if (time < HUB_TEACHER_CAST_SECONDS) return 'cast'
  if (time < HUB_TEACHER_CAST_SECONDS + HUB_TEACHER_RELEASE_SECONDS) return 'release'
  return 'idle'
}

export function hubTeacherFrameAt(elapsedSeconds: number): number {
  const time = (
    (elapsedSeconds % HUB_TEACHER_CYCLE_SECONDS)
    + HUB_TEACHER_CYCLE_SECONDS
  ) % HUB_TEACHER_CYCLE_SECONDS
  if (time < HUB_TEACHER_CAST_SECONDS) {
    const fixedTicks = Math.floor(time * 60 + 1e-6)
    const nativeTimer = Math.fround(fixedTicks * HUB_TEACHER_CAST_TIMER_PER_TICK)
    return Math.trunc(nativeTimer) % 2
  }
  if (time < HUB_TEACHER_CAST_SECONDS + HUB_TEACHER_RELEASE_SECONDS) return 2
  return 3
}
