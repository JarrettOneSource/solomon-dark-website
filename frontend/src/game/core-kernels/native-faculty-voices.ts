import type { NativeFacultyVoiceCue } from './native-boss-audio.ts'
import { drawNativeInteger, type NativeRngState } from './native-rng.ts'

export interface NativeFacultyVoiceController {
  readonly line: number
  readonly ticksRemaining: number
}

export function createNativeFacultyVoiceController(rng: NativeRngState): {
  rng: NativeRngState; state: NativeFacultyVoiceController
} {
  const delay = drawNativeInteger(rng, 500)
  return { rng: delay.state, state: { line: 0, ticksRemaining: 200 + delay.value } }
}

/** Faculty_Banter 0x00467B30; membership ends on the first dying tick. */
export function stepNativeFacultyVoices(source: NativeFacultyVoiceController, rng: NativeRngState,
  members: readonly Readonly<{ female: boolean }>[], busy: boolean): {
  cues: readonly NativeFacultyVoiceCue[]; rng: NativeRngState; state: NativeFacultyVoiceController | null
} {
  if (members.length === 0) return { cues: [], rng, state: null }
  if (busy) return { cues: [], rng, state: source }
  const ticksRemaining = source.ticksRemaining - 1
  if (ticksRemaining >= 0) return { cues: [], rng, state: { ...source, ticksRemaining } }
  const male = members.some(member => !member.female)
  const female = members.some(member => member.female)
  const cues: NativeFacultyVoiceCue[] = []
  let line = source.line + 1
  const delay = drawNativeInteger(rng, 700)
  rng = delay.state
  let cooldown = 500 + delay.value
  const enqueue = (stem: 'join-us-1' | 'join-us-2' | 'dead-is-better-1' | 'dead-is-better-2', allowReply = false) => {
    cues.push(`faculty-${stem}${male ? '' : '-female'}`)
    if (male && female && allowReply) {
      const reply = drawNativeInteger(rng, 2)
      rng = reply.state
      if (reply.value !== 0) cues.push(`faculty-${stem}-female`)
    }
  }
  switch (line) {
    case 1: enqueue('join-us-1', true); break
    case 2: enqueue('dead-is-better-1'); break
    case 3: enqueue('join-us-2'); cooldown = 30; break
    case 4: {
      enqueue('dead-is-better-2', true)
      const shorter = drawNativeInteger(rng, 50)
      rng = shorter.state
      cooldown = 100 + shorter.value
      break
    }
    case 5: {
      const repeat = drawNativeInteger(rng, 4)
      rng = repeat.state
      if (repeat.value === 3 && male) cues.push('faculty-dead-is-better-1')
      break
    }
    default: {
      line = 0
      const reset = drawNativeInteger(rng, 1000)
      rng = reset.state
      cooldown = 1000 + reset.value
    }
  }
  return { cues, rng, state: { line, ticksRemaining: cooldown * 2 } }
}
