import { drawNativeFloat, type NativeRngState } from './native-rng.ts'
import { createNativeWeldFlameLashFade } from './native-weld-flame-lash.ts'
import { nativeFlameLashBirthPhase, nativeFlameLashFactoryGeometry, nativeFlameLashPathPoints, type NativeFlameLashFactoryInput } from './native-weld-flame-ribbon.ts'
import { createNativeWeldChannelActor } from './native-weld-primary-runtime.ts'
import { registerNativeWorldPainterRoots, type NativeWorldManagerRegistration, type RegisterNativeWorldPainter } from './native-world-manager-order.ts'
import type { NativeFlameChannelBirth } from './native-weld-flame-state.ts'
import type { NativeBoneyardLightSource } from './native-boneyard-light-model.ts'
import type { PrimarySpellChannelEmission, PrimarySpellSimulationState, PrimarySpellTransientState } from './primary-spells.ts'

/** 0x531F00: source five words, short-only width, path intensity, ordered radii. */
export function createNativeFlameLashFactory(input: Readonly<{
  channel: Parameters<typeof createNativeWeldChannelActor>[0]
  sourceFadeId: number
  geometry: NativeFlameLashFactoryInput
  role: 'main' | 'chain'
  cameraDisplacement: NativeFlameChannelBirth['cameraDisplacement']
  width: number
  creatorRegistration: NativeWorldManagerRegistration
  miscAppendOrdinal: number
  registerWorldPainter: RegisterNativeWorldPainter
  rng: NativeRngState
}>) {
  if ((input.role === 'main' && !input.channel.underpowered) !== (input.cameraDisplacement !== null)) {
    throw new Error('Flame camera birth sample does not match its caller')
  }
  const source = createNativeWeldFlameLashFade({
    ...input.channel, id: input.sourceFadeId, origin: input.geometry.start,
    registerWorldPainter: input.registerWorldPainter, rng: input.rng, variant: 'source',
  })
  let rng = source.rng
  const geometry = nativeFlameLashFactoryGeometry(input.geometry)
  let ribbon: NativeFlameChannelBirth['ribbon']
  if (geometry.kind === 'short') {
    const width = drawNativeFloat(rng, Math.fround(.25)); rng = width.state
    ribbon = Object.freeze({ kind: 'short', widthFactor: Math.fround(.75 + width.value) })
  } else ribbon = Object.freeze({ kind: 'long', phaseDegrees: nativeFlameLashBirthPhase(input.channel.tick) })
  const pathIntensity = drawNativeFloat(rng, Math.fround(.75)); rng = pathIntensity.state
  let intensity = Math.fround(.25 + pathIntensity.value)
  if (input.channel.underpowered) intensity = Math.fround(intensity * .25)
  const radiusFactors = nativeFlameLashPathPoints(geometry).map(() => {
    const radius = drawNativeFloat(rng, Math.fround(.25)); rng = radius.state
    return Math.fround(.75 + radius.value)
  })
  const flameVisual: NativeFlameChannelBirth = Object.freeze({
    kind: 'native-birth-v1', role: input.role, width: input.width,
    cameraDisplacement: input.cameraDisplacement === null ? null : Object.freeze({ ...input.cameraDisplacement }),
    start: Object.freeze({ ...geometry.start }), control: Object.freeze({ ...geometry.control }),
    end: Object.freeze({ x: Math.fround(input.geometry.end.x), y: Math.fround(input.geometry.end.y) }),
    offset: Object.freeze({ x: Math.fround(input.geometry.offset.x), y: Math.fround(input.geometry.offset.y) }),
    ribbon,
    path: Object.freeze({ intensity, radiusFactors: Object.freeze(radiusFactors),
      creatorRegistration: input.creatorRegistration, miscAppendOrdinal: input.miscAppendOrdinal }),
  })
  const channel = Object.freeze({ ...createNativeWeldChannelActor({ ...input.channel, flameVisual }),
    painterRegistrations: registerNativeWorldPainterRoots(input.registerWorldPainter, 'actor') })
  return Object.freeze({ channel, source: source.actor, rng })
}

export function nativeFlameLashPathLights(birth: NativeFlameChannelBirth, enhancedEffects: boolean): readonly NativeBoneyardLightSource[] {
  const points = nativeFlameLashPathPoints(nativeFlameLashFactoryGeometry(birth))
  if (points.length !== birth.path.radiusFactors.length) throw new Error('Flame path lost a birth radius')
  return points.map((position, index) => ({ position,
    intensity: birth.path.intensity, radius: birth.path.radiusFactors[index]!,
    castsDirectionalShadow: enhancedEffects }))
}

/** Hub has no hostile dispatcher, but the unconditional factory still belongs to its cast. */
export function finalizeHubFlameLashVisuals(
  spells: PrimarySpellSimulationState,
  emissions: readonly PrimarySpellChannelEmission[],
  tick: number,
  rng: NativeRngState,
  enhancedEffects: boolean,
  registerWorldPainter: RegisterNativeWorldPainter,
) {
  let nextId = spells.nextId
  const births: PrimarySpellTransientState[] = []
  for (const emission of emissions) {
    const main = emission.flameLashPresentation
    if (emission.primarySkill.kind !== 'weld' || emission.primarySkill.buildId !== 1003
      || !main?.nativeGeometry || !main.creatorRegistration || main.cameraDisplacement === undefined) continue
    const channel = { buildId: 1003 as const, direction: emission.direction,
      endpoint: emission.endpoint, enhancedEffects, id: emission.id, midpoint: main.midpoint,
      origin: emission.origin, ownerId: emission.ownerId, targetId: main.targetId, tick,
      underpowered: emission.underpowered, vector: emission.primarySkill.vector.values, worldKey: emission.worldKey }
    const endpoint = main.preclipEndpoint ?? emission.endpoint
    if (endpoint && endpoint.x > -9999) {
      const faded = createNativeWeldFlameLashFade({ ...channel, origin: endpoint,
        id: nextId++, alpha: emission.underpowered ? .5 : 1, rng,
        variant: 'endpoint', registerWorldPainter })
      rng = faded.rng; births.push(faded.actor)
    }
    const factory = createNativeFlameLashFactory({ channel, sourceFadeId: nextId++,
      geometry: main.nativeGeometry, role: 'main', width: emission.underpowered ? .75 : 1,
      cameraDisplacement: main.cameraDisplacement ?? null,
      creatorRegistration: main.creatorRegistration, miscAppendOrdinal: 0, registerWorldPainter, rng })
    rng = factory.rng; births.push(factory.source, factory.channel)
  }
  return { spells: births.length === 0 ? spells : { ...spells, nextId, transients: [...spells.transients, ...births] }, rng }
}
