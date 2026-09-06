import type { NativeFacultyVisualState } from '../../core-kernels/native-faculty.ts'
import { boolean, finite, GameProtocolError, integerWithin, limitedArray, onlyKeys, record, unitInterval } from './values.ts'

export function nativeFacultyVisual(value: unknown, field: string): NativeFacultyVisualState {
  const source = record(value, field)
  onlyKeys(source, field, ['bodyColor', 'bodyHeadingDeg', 'female', 'handMask', 'headColor', 'lightIntensity', 'lightPhase', 'lightningActive'])
  const color = (value: unknown, key: string): readonly [number, number, number, number] => {
    const entries = limitedArray(value, key, 4)
    if (entries.length !== 4) throw new GameProtocolError(`${key} requires four channels`)
    return [unitInterval(entries[0], key), unitInterval(entries[1], key),
      unitInterval(entries[2], key), unitInterval(entries[3], key)]
  }
  return {
    bodyHeadingDeg: finite(source.bodyHeadingDeg, `${field}.bodyHeadingDeg`),
    bodyColor: color(source.bodyColor, `${field}.bodyColor`),
    female: boolean(source.female, `${field}.female`),
    handMask: integerWithin(source.handMask, `${field}.handMask`, 0, 3),
    headColor: color(source.headColor, `${field}.headColor`),
    lightningActive: boolean(source.lightningActive, `${field}.lightningActive`),
    lightIntensity: unitInterval(source.lightIntensity, `${field}.lightIntensity`),
    lightPhase: finite(source.lightPhase, `${field}.lightPhase`),
  }
}
