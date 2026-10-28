import { NATIVE_BOSS_STREAM_TICKS, NATIVE_FACULTY_VOICE_CUES, type NativeBossNarration } from '../../core-kernels/native-boss-audio.ts'
import {
  GameProtocolError,limitedArray,memberString,nonnegativeInteger,onlyKeys,positiveInteger,
  record,unitInterval
} from './values.ts'

export function nativeBossNarration(value: unknown, field: string, tick: number): NativeBossNarration {
  const source = record(value, field)
  onlyKeys(source, field, ['current', 'idleTicks', 'mix', 'nextEventId', 'pending', 'ticksRemaining'])
  const nextEventId = positiveInteger(source.nextEventId, `${field}.nextEventId`)
  const ticksRemaining = nonnegativeInteger(source.ticksRemaining, `${field}.ticksRemaining`)
  const current = source.current === null ? null : (() => {
    const item = record(source.current, `${field}.current`)
    onlyKeys(item, `${field}.current`, ['cue', 'eventId', 'startedTick'])
    const cue = memberString(item.cue, `${field}.current.cue`, NATIVE_FACULTY_VOICE_CUES)
    const eventId = positiveInteger(item.eventId, `${field}.current.eventId`)
    const startedTick = nonnegativeInteger(item.startedTick, `${field}.current.startedTick`)
    if (eventId >= nextEventId || startedTick > tick || ticksRemaining === 0 || ticksRemaining > NATIVE_BOSS_STREAM_TICKS[cue]) {
      throw new GameProtocolError(`${field}.current has an invalid voice clock`)
    }
    return { cue, eventId, startedTick }
  })()
  if (current === null && ticksRemaining !== 0) throw new GameProtocolError(`${field} has a clock without a voice`)
  const idleTicks = nonnegativeInteger(source.idleTicks, `${field}.idleTicks`)
  if (idleTicks > 25) throw new GameProtocolError(`${field}.idleTicks exceeds its completed hold`)
  return { current, idleTicks, mix: unitInterval(source.mix, `${field}.mix`), nextEventId,
    pending: limitedArray(source.pending, `${field}.pending`, 16).map((item, index) =>
      memberString(item, `${field}.pending[${index}]`, NATIVE_FACULTY_VOICE_CUES)), ticksRemaining }
}
