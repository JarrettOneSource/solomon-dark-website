import type { NativeSecondaryScreenFlashState } from '../../core-kernels/native-secondary-abilities.ts'
import { boolean, GameProtocolError, onlyKeys, positiveFinite, record, unitInterval } from './values.ts'

export function nativeScreenFlash(
  value: unknown,
  field: string,
): NativeSecondaryScreenFlashState {
  const source = record(value, field)
  onlyKeys(source, field, [
    'alpha', 'blue', 'decayPerTick', 'green', 'pointAttenuated', 'red',
  ])
  const decayPerTick = positiveFinite(source.decayPerTick, `${field}.decayPerTick`)
  if (decayPerTick > 1) {
    throw new GameProtocolError(`${field}.decayPerTick must be between zero and one`)
  }
  return {
    alpha: unitInterval(source.alpha, `${field}.alpha`),
    blue: unitInterval(source.blue, `${field}.blue`),
    decayPerTick,
    green: unitInterval(source.green, `${field}.green`),
    pointAttenuated: boolean(source.pointAttenuated, `${field}.pointAttenuated`),
    red: unitInterval(source.red, `${field}.red`),
  }
}
