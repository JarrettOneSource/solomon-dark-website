import type { NativeWeldFlameLashFadeState } from '../../core-kernels/native-weld-flame-lash.ts'
import {
  nativeFlameLashBirthPhase,
  nativeFlameLashFactoryGeometry,
  nativeFlameLashPathPoints,
  nativeFlameLashRibbonPairCount,
} from '../../core-kernels/native-weld-flame-ribbon.ts'
import {
  nativeFlameFadeAlpha,
  type NativeFlameChannelVisual,
  type NativeFlameFadeVisual,
} from '../../core-kernels/native-weld-flame-state.ts'
import type { NativeWorldManagerRegistration } from '../../core-kernels/native-world-manager-order.ts'
import {
  absentNativeActorLight,
  nativeWorldManagerRegistration,
  vector,
} from './native-state.ts'
import {
  GameProtocolError,
  finite,
  finiteWithin,
  limitedArray,
  nonnegativeInteger,
  onlyKeys,
  positiveFinite,
  record,
  unitInterval,
} from './values.ts'

const MAX_FLAME_PATH_POINTS = 1_024
const MAX_FLAME_RIBBON_PAIRS = 4_096

export function flameChannelVisual(
  value: unknown,
  field: string,
  actor: Readonly<{ birthTick: number; enhancedEffects: boolean; underpowered: boolean }>,
): NativeFlameChannelVisual {
  const source = record(value, field)
  if (source.kind === 'legacy-suppressed') {
    onlyKeys(source, field, ['kind'])
    return { kind: 'legacy-suppressed' }
  }
  if (source.kind !== 'native-birth-v1') throw new GameProtocolError(`${field}.kind is not a Flame birth contract`)
  onlyKeys(source, field, ['kind', 'role', 'cameraDisplacement', 'start', 'control', 'end', 'offset', 'width', 'ribbon', 'path'])
  const role = source.role
  if (role !== 'main' && role !== 'chain') throw new GameProtocolError(`${field}.role is not a Flame factory role`)
  let cameraDisplacement = null
  if (role === 'main' && !actor.underpowered) {
    cameraDisplacement = vector(source.cameraDisplacement, `${field}.cameraDisplacement`)
    for (const coordinate of ['x', 'y'] as const) nativeFloat(cameraDisplacement[coordinate], `${field}.cameraDisplacement.${coordinate}`, -4, 4)
    if (Math.fround(cameraDisplacement.x ** 2 + cameraDisplacement.y ** 2) > Math.fround(16.000004)) {
      throw new GameProtocolError(`${field}.cameraDisplacement exceeds the native magnitude`)
    }
  } else if (source.cameraDisplacement !== null) throw new GameProtocolError(`${field}.cameraDisplacement is forbidden for weak/chain births`)
  const width = nativeFloat(source.width, `${field}.width`, .5, 1)
  if ((role === 'main' && width !== (actor.underpowered ? .75 : 1))
    || (role === 'chain' && (actor.underpowered || width > Math.fround(.8)))) {
    throw new GameProtocolError(`${field}.width does not match its Flame role`)
  }
  const start = vector(source.start, `${field}.start`)
  const control = vector(source.control, `${field}.control`)
  const end = vector(source.end, `${field}.end`)
  const offset = vector(source.offset, `${field}.offset`)
  if (offset.x !== 0 || (offset.y !== 0 && offset.y !== -20) || (role === 'chain' && offset.y !== -20)) {
    throw new GameProtocolError(`${field}.offset does not match its native caller`)
  }
  if ([start, control, end].some(point => point.x !== Math.fround(point.x) || point.y !== Math.fround(point.y))) {
    throw new GameProtocolError(`${field} requires stored native Flame coordinates`)
  }
  // Bound work before running native recurrences. These are allocation/iteration
  // budgets, not new world-coordinate limits. The factory itself has no loops.
  const firstLeg = Math.hypot(control.x - start.x, control.y - start.y)
  const secondLeg = Math.hypot(end.x - control.x, end.y - control.y)
  const spacing = actor.enhancedEffects ? 7 : 30
  if (!Number.isFinite(firstLeg) || !Number.isFinite(secondLeg)
    || firstLeg > MAX_FLAME_RIBBON_PAIRS * spacing * 2
    || firstLeg > (MAX_FLAME_PATH_POINTS + 1) * 100
    || secondLeg + 15 > (MAX_FLAME_PATH_POINTS + 1) * 100) {
    throw new GameProtocolError(`${field} exceeds the Flame geometry work budget`)
  }
  let geometry: ReturnType<typeof nativeFlameLashFactoryGeometry>
  try {
    geometry = nativeFlameLashFactoryGeometry({ start, control, end, offset })
  } catch (error) {
    if (error instanceof RangeError) throw new GameProtocolError(`${field} has invalid native Flame geometry`)
    throw error
  }
  if (![geometry.span, geometry.extendedEnd.x, geometry.extendedEnd.y,
    geometry.bodyEnd.x, geometry.bodyEnd.y, geometry.splitBounds.x, geometry.splitBounds.y,
    geometry.splitBounds.width, geometry.splitBounds.height].every(Number.isFinite)) {
    throw new GameProtocolError(`${field} has non-finite native Flame geometry`)
  }
  const ribbonSource = record(source.ribbon, `${field}.ribbon`)
  let ribbon: Extract<NativeFlameChannelVisual, { kind: 'native-birth-v1' }>['ribbon']
  if (ribbonSource.kind !== geometry.kind) {
    throw new GameProtocolError(`${field}.ribbon.kind does not match its native span`)
  }
  if (ribbonSource.kind === 'short') {
    onlyKeys(ribbonSource, `${field}.ribbon`, ['kind', 'widthFactor'])
    ribbon = { kind: 'short', widthFactor: nativeFloat(ribbonSource.widthFactor, `${field}.ribbon.widthFactor`, .75, 1) }
  } else {
    onlyKeys(ribbonSource, `${field}.ribbon`, ['kind', 'phaseDegrees'])
    const phaseDegrees = finite(ribbonSource.phaseDegrees, `${field}.ribbon.phaseDegrees`)
    if (phaseDegrees !== nativeFlameLashBirthPhase(actor.birthTick)) {
      throw new GameProtocolError(`${field}.ribbon.phaseDegrees does not match its birth clock`)
    }
    ribbon = { kind: 'long', phaseDegrees }
  }
  const pathSource = record(source.path, `${field}.path`)
  onlyKeys(pathSource, `${field}.path`, ['intensity', 'radiusFactors', 'creatorRegistration', 'miscAppendOrdinal'])
  const intensity = nativeFloat(pathSource.intensity, `${field}.path.intensity`,
    actor.underpowered ? .0625 : .25, actor.underpowered ? .25 : 1)
  const radiusFactors = limitedArray(pathSource.radiusFactors, `${field}.path.radiusFactors`, MAX_FLAME_PATH_POINTS)
    .map((sample, index) => nativeFloat(sample, `${field}.path.radiusFactors[${index}]`, .75, 1))
  const creatorRegistration = nativeWorldManagerRegistration(pathSource.creatorRegistration, `${field}.path.creatorRegistration`, 'actor')
  if (!Number.isSafeInteger(creatorRegistration.registrationOrdinal)) {
    throw new GameProtocolError(`${field}.path.creatorRegistration must use a safe ordinal`)
  }
  const miscAppendOrdinal = nonnegativeInteger(pathSource.miscAppendOrdinal, `${field}.path.miscAppendOrdinal`)
  if (!Number.isSafeInteger(miscAppendOrdinal) || (role === 'main' ? miscAppendOrdinal !== 0 : miscAppendOrdinal === 0)) {
    throw new GameProtocolError(`${field}.path.miscAppendOrdinal does not match its factory role`)
  }
  try {
    nativeFlameLashRibbonPairCount(geometry, actor.enhancedEffects, MAX_FLAME_RIBBON_PAIRS)
    const points = nativeFlameLashPathPoints(geometry)
    if (points.length !== radiusFactors.length) {
      throw new GameProtocolError(`${field}.path.radiusFactors must match the admitted native path points`)
    }
  } catch (error) {
    if (error instanceof RangeError) throw new GameProtocolError(`${field} exceeds the Flame geometry work budget`)
    throw error
  }
  return { kind: 'native-birth-v1', role, cameraDisplacement, start, control, end, offset, width, ribbon,
    path: { intensity, radiusFactors, creatorRegistration, miscAppendOrdinal } }
}

function nativeFloat(value: unknown, field: string, minimum: number, maximum: number): number {
  const result = finiteWithin(value, field, minimum, maximum)
  if (result !== Math.fround(result)) throw new GameProtocolError(`${field} must be a native float`)
  return result
}

function flameFadeVisual(value: unknown, field: string): NativeFlameFadeVisual {
  const source = record(value, field)
  if (source.kind === 'legacy-suppressed') {
    onlyKeys(source, field, ['kind'])
    return { kind: 'legacy-suppressed' }
  }
  if (source.kind !== 'native-birth-v1') throw new GameProtocolError(`${field}.kind is not a Flame birth contract`)
  onlyKeys(source, field, ['kind', 'birthAlpha'])
  if (source.birthAlpha !== .5 && source.birthAlpha !== 1) {
    throw new GameProtocolError(`${field}.birthAlpha is not a native Flame strength`)
  }
  return { kind: 'native-birth-v1', birthAlpha: source.birthAlpha }
}

export function flameFadePayload(
  source: Record<string, unknown>, field: string, ageTicks: number,
): Pick<NativeWeldFlameLashFadeState,
  'alpha' | 'alphaStep' | 'baseScale' | 'colorGreen' | 'flameVisual' | 'lightRegistration'
  | 'position' | 'record' | 'rotationDegrees' | 'variant' | 'wrapperScalar'
> {
  const flameVisual = flameFadeVisual(source.flameVisual, `${field}.flameVisual`)
  const variant = source.variant
  if (variant !== 'endpoint' && variant !== 'chain' && variant !== 'source') {
    throw new GameProtocolError(`${field}.variant is not a Flame Lash fade branch`)
  }
  const sourceFlare = variant === 'source'
  const alpha = positiveFinite(source.alpha, `${field}.alpha`)
  const alphaStep = positiveFinite(source.alphaStep, `${field}.alphaStep`)
  const coarse = alphaStep === Math.fround(.4)
  if (!coarse && alphaStep !== Math.fround(sourceFlare ? .1 : .2)) {
    throw new GameProtocolError(`${field}.alphaStep is not a native Flame fade branch`)
  }
  const legacy = flameVisual.kind === 'legacy-suppressed'
  if (legacy) {
    // Do not reinterpret old pre-update clocks as the new birth-update contract.
    if (alpha > (sourceFlare ? .5 : 1) || ageTicks >= (coarse ? 3 : 6)) {
      throw new GameProtocolError(`${field} exceeds the legacy Flame Lash fade clock`)
    }
    if (sourceFlare) {
      let expected = .5
      for (let age = 0; age < ageTicks; age += 1) expected = Math.fround(expected - alphaStep)
      if (alpha !== expected) throw new GameProtocolError(`${field} violates its legacy source flare clock`)
    }
  } else {
    const birthAlpha = flameVisual.birthAlpha
    if ((sourceFlare && birthAlpha !== .5) || (variant === 'chain' && birthAlpha !== 1)
      || ageTicks >= 5 || alpha !== nativeFlameFadeAlpha(birthAlpha, alphaStep, ageTicks)) {
      throw new GameProtocolError(`${field} violates its native Flame birth-update clock`)
    }
  }
  const baseScale = positiveFinite(source.baseScale, `${field}.baseScale`)
  if ((sourceFlare && (baseScale < .75 || baseScale > 1.25))
    || (!sourceFlare && !(legacy && variant === 'chain') && (baseScale < .5 || baseScale > 1))
    || (legacy && variant === 'chain' && (baseScale < Math.fround(.05) || baseScale > Math.fround(.1)))) {
    throw new GameProtocolError(`${field}.baseScale exceeds its Flame Lash branch`)
  }
  const colorGreen = unitInterval(source.colorGreen, `${field}.colorGreen`)
  if ((sourceFlare && colorGreen !== 1) || (variant === 'chain' && colorGreen !== Math.fround(.75))
    || (variant === 'endpoint' && (colorGreen < .5 || colorGreen > 1))) {
    throw new GameProtocolError(`${field}.colorGreen exceeds its Flame Lash branch`)
  }
  const wrapperScalar = positiveFinite(source.wrapperScalar, `${field}.wrapperScalar`)
  if (wrapperScalar < .75 || wrapperScalar > 1.5 || (sourceFlare && wrapperScalar !== 1)) {
    throw new GameProtocolError(`${field}.wrapperScalar exceeds its native Flame branch`)
  }
  if (!legacy && [baseScale, colorGreen, wrapperScalar].some(sample => sample !== Math.fround(sample))) {
    throw new GameProtocolError(`${field} requires native float Flame birth samples`)
  }
  if (source.record !== 35) throw new GameProtocolError(`${field}.record is not BadGuys 35`)
  const lightRegistration = legacy || sourceFlare ? absentNativeActorLight(source, field)
    : nativeWorldManagerRegistration(source.lightRegistration, `${field}.lightRegistration`, 'transient')
  return { alpha, alphaStep, baseScale, colorGreen, flameVisual, lightRegistration,
    position: vector(source.position, `${field}.position`), record: 35 as const,
    rotationDegrees: finite(source.rotationDegrees, `${field}.rotationDegrees`), variant, wrapperScalar }
}

export function validateFlameFadePainterRegistration(
  actor: Pick<NativeWeldFlameLashFadeState, 'flameVisual' | 'lightRegistration' | 'variant'>,
  registrations: readonly NativeWorldManagerRegistration[],
  field: string,
): void {
  if (actor.flameVisual.kind !== 'native-birth-v1') return
  const root = registrations[0]
  if (!root || !Number.isSafeInteger(root.registrationOrdinal)) {
    throw new GameProtocolError(`${field}.painterRegistrations must use a safe ordinal`)
  }
  if (actor.variant !== 'source' && (actor.lightRegistration?.managerLane !== root.managerLane
    || actor.lightRegistration.registrationOrdinal !== root.registrationOrdinal)) {
    throw new GameProtocolError(`${field}.lightRegistration must match its Flame painter root`)
  }
}
