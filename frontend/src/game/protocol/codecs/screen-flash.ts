import type { NativeSecondaryScreenFlashState } from '../../core-kernels/native-secondary-abilities.ts'
import type { NativeScreenFlashState } from '../../core-kernels/native-screen-flash.ts'
import { vector } from './native-state.ts'
import { array, boolean, GameProtocolError, limitedString, nonnegativeInteger, onlyKeys, positiveFinite, positiveInteger, record, unitInterval } from './values.ts'

export function nativeScreenFlashes(value: unknown, field: string, snapshotTick: number): NativeScreenFlashState {
  const source = record(value, field)
  onlyKeys(source, field, ['epoch', 'nextOrder', 'writes'])
  const epoch = nonnegativeInteger(source.epoch, `${field}.epoch`)
  const nextOrder = positiveInteger(source.nextOrder, `${field}.nextOrder`)
  let previousOrder = 0
  let previousTick = 0
  const writes = array(source.writes, `${field}.writes`).map((value, index) => {
    const entryField = `${field}.writes[${index}]`
    const write = record(value, entryField)
    onlyKeys(write, entryField, ['order', 'tick', 'worldKey', 'position', 'flash', 'onlyIfClear'])
    const order = positiveInteger(write.order, `${entryField}.order`)
    const tick = nonnegativeInteger(write.tick, `${entryField}.tick`)
    if (order <= previousOrder || order >= nextOrder || tick < previousTick || tick > snapshotTick) {
      throw new GameProtocolError(`${entryField} must preserve authority order and snapshot time`)
    }
    previousOrder = order
    previousTick = tick
    return { order, tick, worldKey: limitedString(write.worldKey, `${entryField}.worldKey`, 256),
      position: vector(write.position, `${entryField}.position`),
      flash: nativeScreenFlash(write.flash, `${entryField}.flash`),
      onlyIfClear: boolean(write.onlyIfClear, `${entryField}.onlyIfClear`) }
  })
  return { epoch, nextOrder, writes }
}

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
