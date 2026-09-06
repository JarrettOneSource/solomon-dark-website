/** Puppet +0x78/+0x7C, sampled on the owner's fixed update clock. */
export interface NativePuppetHitState {
  readonly strength: number
  readonly tick: number
  readonly timer: number
}

export const NATIVE_WORLD_PUPPET_HIT_KINDS = ['scenery', 'goodie', 'arrow', 'firebolt', 'meteor', 'leviathan'] as const
export type NativeWorldPuppetHitKind = typeof NATIVE_WORLD_PUPPET_HIT_KINDS[number]

export interface NativeWorldPuppetHit {
  readonly feedback: NativePuppetHitState
  readonly hitTick: number
  readonly kind: NativeWorldPuppetHitKind
  readonly targetId: string
}

const TIMER_STEP = Math.fround(.05)

export function createNativePuppetHit(tick = 0): NativePuppetHitState {
  return { strength: 1, tick, timer: 0 }
}

export function receiveNativePuppetHit(tick: number, strength = 1): NativePuppetHitState {
  return { strength, tick, timer: 1 }
}

export function stepNativePuppetHit(source: NativePuppetHitState, tick: number, elapsedTicks = 1): NativePuppetHitState {
  if (source.timer === 0) return source
  let timer = source.timer
  for (let index = 0; index < Math.min(20, elapsedTicks) && timer > 0; index += 1) {
    timer = Math.max(0, Math.fround(timer - TIMER_STEP))
  }
  return { ...source, tick, timer }
}

export function nativePuppetHitTimer(source: Pick<NativePuppetHitState, 'tick' | 'timer'>, tick: number): number {
  const elapsed = Math.max(0, tick - source.tick)
  let timer = source.timer
  const whole = Math.min(20, Math.floor(elapsed))
  for (let index = 0; index < whole && timer > 0; index += 1) {
    timer = Math.max(0, Math.fround(timer - TIMER_STEP))
  }
  timer = Math.max(0, timer - (elapsed - Math.floor(elapsed)) * TIMER_STEP)
  return timer
}

export function nativePuppetHitAlpha(source: NativePuppetHitState, tick: number, cached = false): number {
  const timer = nativePuppetHitTimer(source, tick)
  return Math.min(1, Math.fround(source.strength * (cached ? timer ** 3 : timer)))
}
