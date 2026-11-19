import type { Vector2 } from './vector.ts'
import type { NativeSecondaryActorState } from './native-secondary-abilities.ts'
import { buildNativeAirCoronaPlan, buildNativeAirRibbonLayer, nativeAirPresentationRandom,
  type NativeAirLightningPlan, type NativeAirContactLightPlan } from './native-air-presentation.ts'

// StormCloud 006021A0 retains five emissions after each accepted damage contact.
export interface NativeStormBurst {
  readonly remainingTicks: number
  readonly source: Vector2
  readonly midpoint: Vector2
  readonly endpoint: Vector2
  readonly targetId: number
}

function samples(actor: NativeSecondaryActorState) {
  const random = nativeAirPresentationRandom(actor.id, 0x53544f52)
  const sourceAngle = random(360) * Math.PI / 180
  const sourceScale = Math.fround(.5 + random(1))
  const contactAngle = random(360) * Math.PI / 180
  const offsetRadius = random(10)
  const offsetAngle = random(360) * Math.PI / 180
  const contactCenter = {
    x: Math.fround(actor.endpoint.x + Math.cos(offsetAngle) * offsetRadius),
    y: Math.fround(actor.endpoint.y + Math.sin(offsetAngle) * offsetRadius),
  }
  return { sourceAngle, sourceScale, contactAngle, contactCenter,
    contactScale: Math.fround(1 + random(.5)), lightRadius: Math.fround(.75 + random(.75)) }
}

function fade(age: number): number {
  let alpha = 1
  // Float32 .2 subtraction leaves a positive residue at update five.
  for (let tick = 0; tick < Math.min(age, 6); tick += 1) alpha = Math.fround(alpha - Math.fround(.2))
  return Math.max(0, alpha)
}

export function nativeStormContactLight(
  actor: NativeSecondaryActorState, ageTicks: number,
): NativeAirContactLightPlan | null {
  const age = Math.max(0, Math.floor(ageTicks))
  if (age >= 6) return null
  const sampled = samples(actor)
  let intensity = 1
  for (let tick = 0; tick < age; tick += 1) intensity = Math.fround(intensity - Math.fround(.05))
  return { castsDirectionalShadow: false, intensity, position: sampled.contactCenter,
    radius: sampled.lightRadius }
}

// Geometry is relative to the source; the independently registered light is world-space.
export function nativeStormLightningPlan(
  actor: NativeSecondaryActorState, ageTicks: number,
): NativeAirLightningPlan {
  const age = Math.max(0, Math.floor(ageTicks))
  const source = { x: 0, y: 0 }
  const midpoint = { x: actor.midpoint.x - actor.position.x, y: actor.midpoint.y - actor.position.y }
  const endpoint = { x: actor.endpoint.x - actor.position.x, y: actor.endpoint.y - actor.position.y }
  const ribbon = { source, midpoint, endpoint, id: actor.id, birthTick: actor.phase,
    basePhaseDegrees: -3 * actor.phase, width: .5, tint: 0xffffff, alpha: 1, enhancedEffects: actor.enhanced }
  const body = age < 2 ? { layers: [buildNativeAirRibbonLayer(ribbon),
    buildNativeAirRibbonLayer({ ...ribbon, width: .375, phaseOffset: 15, tint: 0x00ffff, alpha: .5 })] } : null
  const sampled = samples(actor)
  const alpha = fade(age)
  const angleStep = age * Math.PI / 180
  const sourceCorona = alpha > 0 ? buildNativeAirCoronaPlan({ alpha,
    angle: sampled.sourceAngle + angleStep, center: source,
    randomSalt: 0x53524345 ^ age, scale: sampled.sourceScale, seed: actor.id }) : null
  const contactCorona = buildNativeAirCoronaPlan({ alpha,
    angle: sampled.contactAngle + angleStep,
    center: { x: sampled.contactCenter.x - actor.position.x, y: sampled.contactCenter.y - actor.position.y },
    randomSalt: 0x46414445 ^ age, scale: sampled.contactScale, seed: actor.id })
  return { body, contactCorona, sourceCorona, contactLight: nativeStormContactLight(actor, age),
    source, midpoint, endpoint }
}
