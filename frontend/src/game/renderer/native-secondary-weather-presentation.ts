import { drawNativeFloat } from '../core-kernels/native-rng.ts'
import type { NativeSecondaryActorState } from '../core-kernels/native-secondary-abilities.ts'
import type { Vector2 } from '../core-kernels/vector.ts'
import type { NativeSecondaryAtlas } from './native-secondary-assets.ts'
import {
  degreesToRadians,
  WHITE,
} from './native-secondary-draws.ts'
import {
  NATIVE_SECONDARY_RAINDROP_GRADIENTS,
  type NativeSecondaryGradientDraw,
  type NativeSecondarySpriteDraw,
  type NativeStormWeatherComposite,
} from './native-secondary-presentation-types.ts'

export function stormCloudDraws(
  actor: NativeSecondaryActorState,
  presentationFrame: number,
  draw: (
    atlas: NativeSecondaryAtlas,
    entry: number,
    options?: Partial<Omit<NativeSecondarySpriteDraw, 'atlas' | 'entry'>>,
  ) => NativeSecondarySpriteDraw,
): NativeSecondarySpriteDraw[] {
  if (actor.variant !== 1 || !actor.enhanced || actor.presentationRng === null) return []
  let rng = actor.presentationRng
  const visualPhase = drawNativeFloat(rng, 1, true)
  rng = visualPhase.state
  const angles: number[] = []
  const speeds: number[] = []
  for (let index = 0; index < 15; index += 1) {
    const angle = drawNativeFloat(rng, 360)
    const speed = drawNativeFloat(angle.state, 2)
    rng = speed.state
    angles.push(angle.value)
    speeds.push(Math.fround(
      (1 - index / 15 * 0.95) * (2 + speed.value) * 4,
    ))
  }

  const middleAngle = presentationFrame * 0.5 * Math.PI / 180
  const spline = naturalSpline3(
    { x: 0, y: 0 },
    { x: Math.cos(middleAngle) * 30, y: -Math.sin(middleAngle) * 30 },
    { x: 0, y: -175 },
  )
  const draws: NativeSecondarySpriteDraw[] = []
  let scale = 0.2
  for (let index = 0; index < 15; index += 1) {
    const t = index * 0.2
    const first = spline(t)
    const second = spline(t + 0.1)
    const angle = Math.fround(angles[index]! + speeds[index]! * actor.ageTicks)
    draws.push(
      draw('BadGuys', 84, {
        alpha: actor.alpha,
        offset: first,
        role: `storm-cloud-arc-${index}-a`,
        rotationRadians: angle * Math.PI / 180,
        scaleX: scale,
        scaleY: scale * 0.8,
        tint: 0xccffff,
      }),
      draw('BadGuys', 84, {
        alpha: actor.alpha,
        offset: second,
        role: `storm-cloud-arc-${index}-b`,
        rotationRadians: angle * 1.35 * Math.PI / 180,
        scaleX: scale,
        scaleY: scale * 0.8,
        tint: 0xccffff,
      }),
    )
    scale = scale * 1.1 + 0.1
  }
  const cloudScale = actor.scale * 3.75
  draws.push(draw('BadGuys', 78, {
    alpha: actor.alpha * 0.5,
    offset: { x: 0, y: actor.scale * -50 },
    role: 'storm-cloud-core',
    rotationRadians: actor.ageTicks * 0.5 * visualPhase.value * 15 * Math.PI / 180,
    scaleX: cloudScale,
    scaleY: cloudScale,
  }))
  return draws
}

export function stormAuxiliaryDraws(
  actor: NativeSecondaryActorState,
  draw: (
    atlas: NativeSecondaryAtlas,
    entry: number,
    options?: Partial<Omit<NativeSecondarySpriteDraw, 'atlas' | 'entry'>>,
  ) => NativeSecondarySpriteDraw,
): NativeSecondarySpriteDraw[] {
  const phase = stormVisualPhase(actor)
  const draws: NativeSecondarySpriteDraw[] = []
  if (actor.variant === 1) {
    const scale = actor.scale * 3.75
    draws.push(draw('BadGuys', 78, {
      alpha: actor.alpha * 0.5,
      blend: 'add',
      offset: { x: 0, y: -175 - actor.scale * 50 },
      role: 'storm-weather-moving-composite',
      rotationRadians: degreesToRadians(actor.ageTicks / 48 * phase),
      scaleX: scale,
      scaleY: scale,
      tint: 0xccffff,
    }))
  }
  if (actor.frame > 0) {
    draws.push(draw('BadGuys', 78, {
      alpha: actor.alpha * 0.75,
      colorMode: 'alpha-mask',
      offset: { x: 0, y: -175 },
      role: 'storm-weather-strike-flash',
      rotationRadians: degreesToRadians(actor.ageTicks * 0.0625 * phase),
      scaleX: actor.scale * 4,
      scaleY: actor.scale * 0.8 * 4,
      tint: WHITE,
    }))
  }
  return draws
}

export function stormWeatherComposite(
  actor: NativeSecondaryActorState,
  draw: (
    atlas: NativeSecondaryAtlas,
    entry: number,
    options?: Partial<Omit<NativeSecondarySpriteDraw, 'atlas' | 'entry'>>,
  ) => NativeSecondarySpriteDraw,
): NativeStormWeatherComposite | null {
  if (actor.variant === 1) return null
  const phase = stormVisualPhase(actor)
  const age = actor.ageTicks
  const alphaWave = 0.5 + Math.sin(degreesToRadians(age * 0.5)) * 0.5
  const scaleWave = 0.5 + Math.sin(degreesToRadians(age / 6)) * 0.25
  return {
    draws: [
      draw('BadGuys', 78, {
        alpha: actor.alpha * 2,
        offset: { x: 0, y: 0 },
        role: 'storm-weather-static-inner',
        rotationRadians: degreesToRadians(age * 0.03125 * phase),
        scaleX: actor.scale,
        scaleY: actor.scale * 0.8,
      }),
      draw('BadGuys', 78, {
        alpha: actor.alpha * 0.75,
        offset: { x: 0, y: actor.scale * -10 },
        role: 'storm-weather-static-middle',
        rotationRadians: degreesToRadians(age / 48 * phase),
        scaleX: actor.scale * 0.75,
        scaleY: actor.scale * 0.8 * 0.75,
        tint: 0xccffff,
      }),
      draw('BadGuys', 78, {
        alpha: actor.alpha * alphaWave * 0.75,
        offset: { x: 0, y: actor.scale * -6 },
        role: 'storm-weather-static-outer',
        rotationRadians: degreesToRadians(age * 0.125 * phase),
        scaleX: actor.scale * 0.5,
        scaleY: actor.scale * 0.8 * scaleWave,
        tint: 0xccffff,
      }),
    ],
    offset: { x: 0, y: -175 },
    scale: 5,
  }
}

function stormVisualPhase(actor: NativeSecondaryActorState): number {
  if (actor.presentationRng === null) {
    throw new TypeError('Storm presentation requires its pre-consumption RNG state')
  }
  const phase = drawNativeFloat(actor.presentationRng, 1, true).value
  return actor.variant === 1 ? phase * 15 : phase
}

export function freezeWaveVisualDraws(
  actor: NativeSecondaryActorState,
  draw: (
    atlas: NativeSecondaryAtlas,
    entry: number,
    options?: Partial<Omit<NativeSecondarySpriteDraw, 'atlas' | 'entry'>>,
  ) => NativeSecondarySpriteDraw,
): NativeSecondarySpriteDraw[] {
  if (actor.presentationRng === null) {
    throw new TypeError('FreezeWave presentation requires its pre-consumption RNG state')
  }
  let rng = actor.presentationRng
  const age = Math.max(0, Math.trunc(actor.ageTicks))
  const draws: NativeSecondarySpriteDraw[] = []
  const burstFactors = [1.02, 1.015, 1.01] as const
  for (let index = 0; index < burstFactors.length; index += 1) {
    const rotation = drawNativeFloat(rng, 360)
    rng = rotation.state
    const life = Math.max(0, Math.fround(4.5 - age * 0.05))
    if (life <= 0) continue
    const scale = Math.fround(burstFactors[index]! ** age)
    draws.push(draw('DeadHawg', 114, {
      alpha: Math.min(life, 1),
      blend: 'add',
      role: `freeze-wave-burst-${index}`,
      rotationRadians: rotation.value * Math.PI / 180,
      scaleX: scale,
      scaleY: Math.fround(scale * 0.8),
    }))
  }
  const ringLife = Math.max(0, Math.fround(1.75 - age * 0.01))
  if (ringLife > 0) {
    draws.push(draw('DeadHawg', 121, {
      alpha: Math.min(ringLife, 1),
      role: 'freeze-wave-ring',
      scaleX: 1.5,
      scaleY: 1.5,
    }))
  }

  const snowCount = actor.enhanced ? 200 : 100
  for (let index = 0; index < snowCount; index += 1) {
    const initialAngle = drawNativeFloat(rng, 360)
    const initialAngularVelocity = drawNativeFloat(initialAngle.state, 10)
    const initialRadius = drawNativeFloat(initialAngularVelocity.state, 40)
    const radialVelocity = drawNativeFloat(initialRadius.state, 4)
    const initialHeight = drawNativeFloat(radialVelocity.state, 250)
    const scaleDraw = drawNativeFloat(initialHeight.state, 0.5)
    const initialRotation = drawNativeFloat(scaleDraw.state, 360)
    const lifeDraw = drawNativeFloat(initialRotation.state, 1.5)
    rng = lifeDraw.state

    let angle = initialAngle.value
    let angularVelocity = Math.fround(10 + initialAngularVelocity.value)
    let radius = Math.fround(20 + initialRadius.value)
    let height = Math.fround(50 + initialHeight.value)
    let rotation = initialRotation.value
    let life = Math.fround(2 + lifeDraw.value)
    for (let tick = 0; tick < age && life > 0; tick += 1) {
      angle = Math.fround(angle + angularVelocity)
      angularVelocity = Math.fround(Math.fround(angularVelocity * 0.975) * 0.975)
      height = Math.fround(height * 0.99)
      radius = Math.fround(
        radius + Math.fround(1 + radialVelocity.value) * Math.min(angularVelocity, 1),
      )
      rotation = Math.fround(rotation + angularVelocity)
      life = Math.fround(life - 0.02)
    }
    if (life <= 0) continue
    const radians = angle * Math.PI / 180
    const scale = Math.fround(1 - scaleDraw.value)
    draws.push(draw('BadGuys', 72, {
      alpha: Math.min(life, 1),
      offset: {
        x: Math.cos(radians) * radius,
        y: Math.sin(radians) * radius * 0.8 - height,
      },
      role: `freeze-wave-snow-${index}`,
      rotationRadians: rotation * Math.PI / 180,
      scaleX: scale,
      scaleY: scale,
    }))
  }
  return draws
}

export function raindropGradient(
  actor: NativeSecondaryActorState,
  acid: boolean,
): NativeSecondaryGradientDraw {
  const gradient = acid
    ? NATIVE_SECONDARY_RAINDROP_GRADIENTS.acid
    : NATIVE_SECONDARY_RAINDROP_GRADIENTS.storm
  return {
    ...gradient,
    height: actor.quantity,
    role: acid ? 'acid-raindrop-streak' : 'storm-raindrop-streak',
    topLeft: { x: acid ? -1 : 0, y: actor.phase },
  }
}

function naturalSpline3(
  first: Vector2,
  second: Vector2,
  third: Vector2,
): (time: number) => Vector2 {
  const axis = (a: number, b: number, c: number): readonly number[] => {
    const provisional0 = (b - a) * 0.75
    const provisional1 = ((c - a) * 3 - provisional0) * 0.25
    const provisional2 = ((c - b) * 3 - provisional1) * 0.25
    const tangent2 = provisional2
    const tangent1 = provisional1 - tangent2 * 0.25
    const tangent0 = provisional0 - tangent1 * 0.25
    return [tangent0, tangent1, tangent2]
  }
  const xs = [first.x, second.x, third.x] as const
  const ys = [first.y, second.y, third.y] as const
  const xTangents = axis(...xs)
  const yTangents = axis(...ys)
  const sampleAxis = (
    points: readonly number[],
    tangents: readonly number[],
    time: number,
  ): number => {
    if (time <= 0) return points[0]!
    if (time >= 2) return points[2]!
    const segment = Math.floor(time)
    const fraction = time - segment
    const start = points[segment]!
    const end = points[segment + 1]!
    const startTangent = tangents[segment]!
    const endTangent = tangents[segment + 1]!
    const quadratic = (end - start) * 3 - startTangent * 2 - endTangent
    const cubic = (start - end) * 2 + startTangent + endTangent
    return start + fraction * (
      startTangent + fraction * (quadratic + fraction * cubic)
    )
  }
  return (time) => ({
    x: sampleAxis(xs, xTangents, time),
    y: sampleAxis(ys, yTangents, time),
  })
}
