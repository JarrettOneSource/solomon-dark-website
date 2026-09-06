import {
  advanceNativeRngWords,
  drawNativeFloat,
  drawNativeInteger,
  drawNativeSign,
} from '../core-kernels/native-rng.ts'
import type {
  NativeSecondaryActorState,
  NativeSecondaryPlayerState,
} from '../core-kernels/native-secondary-abilities.ts'
import type { NativeSecondaryAtlas } from './native-secondary-assets.ts'
import {
  repeatedFloatDecay,
  WHITE,
} from './native-secondary-draws.ts'
import {
  NATIVE_LEVIATHAN_RENDER_TARGET_SIZE,
  type NativeLeviathanCompositePlan,
  type NativeSecondaryMeshDraw,
  type NativeSecondarySpriteDraw,
} from './native-secondary-presentation-types.ts'

export function nativeSecondaryCompositeOwnerEntries(
  actors: readonly NativeSecondaryActorState[],
  worldKey: string,
): readonly (readonly [actorId: number, ownerId: number])[] {
  const liveIds = new Set(actors
    .filter((actor) => actor.worldKey === worldKey)
    .map(({ id }) => id))
  return actors.flatMap((actor) => {
    if (actor.worldKey !== worldKey || actor.kind !== 'leviathan-appendage') return []
    const parentId = actor.hitTargetIds[0]
    return parentId !== undefined && liveIds.has(parentId)
      ? [[actor.id, parentId] as const]
      : []
  })
}

export function nativeLeviathanCompositePlan(scale: number): NativeLeviathanCompositePlan {
  return {
    clear: {
      blend: 'multiply',
      color: 0x000000,
      height: 1_000,
      width: NATIVE_LEVIATHAN_RENDER_TARGET_SIZE,
      x: 0,
      y: NATIVE_LEVIATHAN_RENDER_TARGET_SIZE / 2 + 64 * scale,
    },
    mask: {
      blend: 'multiply',
      clipTop: NATIVE_LEVIATHAN_RENDER_TARGET_SIZE / 2,
      entry: 39,
      scale,
    },
    outputs: [
      { alpha: 1, blend: 'normal' },
      { alpha: 0.5, blend: 'add' },
    ],
  }
}

export const NATIVE_PLAYER_MAGIC_SHIELD = Object.freeze({
  atlas: 'Clothes',
  entry: 2,
  offsetY: -35,
  scale: Math.fround(2.15),
} as const)

export interface NativePlayerMagicShieldPlan {
  readonly alpha: number
  readonly scale: number
  readonly tint: number
  readonly visible: boolean
}

export function nativePlayerMagicShieldPlan(
  state: NativeSecondaryPlayerState | undefined,
  tick: number,
): NativePlayerMagicShieldPlan {
  const visible = (state?.magicShieldAbsorb ?? 0) > 0
  if (!visible || !state) {
    return { alpha: 0, scale: NATIVE_PLAYER_MAGIC_SHIELD.scale, tint: WHITE, visible: false }
  }
  const pulse = state.magicShieldPulseTicks * 0.05
  return {
    alpha: 0.5 * (Math.max(pulse, 1) - 1) + 0.25,
    scale: Math.fround(NATIVE_PLAYER_MAGIC_SHIELD.scale
      + Math.fround(0.1) * Math.sin(tick * 20 * Math.PI / 180) * Math.min(pulse, 1)),
    tint: WHITE,
    visible: true,
  }
}

export function planeOrbMesh(
  actor: NativeSecondaryActorState,
  presentationFrame: number,
): NativeSecondaryMeshDraw {
  const segmentCount = actor.enhanced ? 15 : 7
  const vertices: number[] = [0, 0]
  const uvs: number[] = [actor.position.x / 192, actor.position.y / 192]
  const indices: number[] = []
  const vertexColors: number[] = [0xffffffff]
  const initialHeading = presentationFrame % 360
  for (let segment = 0; segment < segmentCount; segment += 1) {
    const heading = initialHeading + segment * 360 / segmentCount
    const radians = heading * Math.PI / 180
    const x = Math.fround(Math.sin(radians))
    const y = Math.fround(-Math.cos(radians))
    const radii = [25 * actor.scale, 50 * actor.scale] as const
    for (let radiusIndex = 0; radiusIndex < radii.length; radiusIndex += 1) {
      const radius = radii[radiusIndex]!
      const localX = Math.fround(x * radius)
      const localY = Math.fround(y * radius * 0.8)
      vertices.push(localX, localY)
      vertexColors.push(radiusIndex === 0 ? 0xffffffff : 0)
      uvs.push(
        Math.fround((actor.position.x + localX) / 192),
        Math.fround((actor.position.y + localY) / 192),
      )
    }
  }
  for (let segment = 0; segment < segmentCount; segment += 1) {
    const inner = 1 + segment * 2
    const outer = inner + 1
    const nextInner = 1 + ((segment + 1) % segmentCount) * 2
    const nextOuter = nextInner + 1
    indices.push(
      0, inner, nextInner,
      inner, outer, nextInner,
      outer, nextInner, nextOuter,
    )
  }
  return {
    alpha: actor.alpha,
    blend: 'normal',
    indices,
    role: 'plane-orb-ether-plane-mesh',
    texture: 'ether-plane',
    tint: WHITE,
    uvs,
    vertexColors,
    vertices,
  }
}

export function prismaticWaveDraws(
  actor: NativeSecondaryActorState,
  presentationFrame: number,
  draw: (
    atlas: NativeSecondaryAtlas,
    entry: number,
    options?: Partial<Omit<NativeSecondarySpriteDraw, 'atlas' | 'entry'>>,
  ) => NativeSecondarySpriteDraw,
): NativeSecondarySpriteDraw[] {
  if (actor.presentationRng === null) {
    throw new TypeError('Prismatic presentation requires its post-cast RNG state')
  }
  const age = Math.max(0, Math.trunc(actor.ageTicks))
  const completedEmissionTicks = Math.min(age, 100)
  const initialHeading = Math.fround(
    actor.phase - actor.slowFactor * 6 * completedEmissionTicks,
  )
  const draws: NativeSecondarySpriteDraw[] = []
  if (age < 100) {
    const flickerRng = advanceNativeRngWords(
      actor.presentationRng,
      completedEmissionTicks * 19 + Math.max(0, Math.trunc(presentationFrame)),
    )
    const flicker = drawNativeFloat(flickerRng, 0.5)
    draws.push(draw('BadGuys', 58, {
      alpha: Math.fround(
        0.5 * actor.alpha * Math.fround(0.5 + flicker.value),
      ),
      blend: 'add',
      role: 'prismatic-spray-core',
      rotationRadians: actor.phase * actor.slowFactor * Math.PI / 180,
      scaleX: actor.slowFactor * actor.scale * 1.5,
      scaleY: actor.scale * 1.2,
    }))
  }

  const firstEmission = Math.max(1, age - 66)
  const lastEmission = Math.min(age, 100)
  if (firstEmission > lastEmission) return draws
  let rng = advanceNativeRngWords(
    actor.presentationRng,
    (firstEmission - 1) * 19,
  )
  for (let emission = firstEmission; emission <= lastEmission; emission += 1) {
    rng = drawNativeFloat(rng, 5, true).state
    const radius = prismaticRadiusAtEmission(emission)
    const heading = Math.fround(
      initialHeading + actor.slowFactor * 6 * emission,
    )
    const headingRadians = heading * Math.PI / 180
    const direction = {
      x: Math.fround(Math.sin(headingRadians)),
      y: Math.fround(-Math.cos(headingRadians)),
    }
    const elapsed = age - emission

    for (let child = 0; child < 2; child += 1) {
      const color = drawNativeInteger(rng, 5)
      const distance = drawNativeFloat(color.state, radius * 60)
      const rotation = drawNativeFloat(distance.state, 360)
      const scale = drawNativeFloat(rotation.state, 0.75)
      const life = drawNativeFloat(scale.state, 1)
      rng = life.state
      const alpha = repeatedFloatDecay(
        Math.fround(0.25 + life.value),
        0.025,
        elapsed,
      )
      if (alpha <= 0) continue
      const radialDistance = Math.fround(radius * 30 + distance.value)
      const spriteScale = Math.fround(0.25 + scale.value)
      draws.push(draw('BadGuys', 111, {
        alpha: Math.min(alpha, 1),
        blend: 'add',
        offset: {
          x: Math.fround(direction.x * radialDistance),
          y: Math.fround(direction.y * radialDistance),
        },
        role: `prismatic-radial-${emission}-${child}`,
        rotationRadians: rotation.value * Math.PI / 180,
        scaleX: spriteScale,
        scaleY: spriteScale,
        tint: PRISMATIC_CHILD_TINTS[color.value]!,
      }))
    }

    const color = drawNativeInteger(rng, 5)
    const distance = drawNativeFloat(color.state, radius * 30)
    const selector = drawNativeInteger(distance.state, 2)
    const rotation = drawNativeFloat(selector.state, 360)
    const scale = drawNativeFloat(rotation.state, 2)
    const speed = drawNativeFloat(scale.state, 0.85)
    const life = drawNativeFloat(speed.state, 0.5)
    rng = life.state
    const alpha = repeatedFloatDecay(
      Math.fround(0.5 + life.value),
      0.015,
      elapsed,
    )
    if (alpha <= 0) continue
    const radialDistance = Math.fround(radius * 50 + distance.value)
    const velocity = Math.fround(0.15 + speed.value)
    const spriteScale = Math.fround(1 + scale.value)
    draws.push(draw('BadGuys', selector.value === 1 ? 10 : 11, {
      alpha: Math.min(alpha, 1),
      blend: 'add',
      offset: {
        x: Math.fround(direction.x * Math.fround(radialDistance + velocity * elapsed)),
        y: Math.fround(direction.y * Math.fround(radialDistance + velocity * elapsed)),
      },
      role: `prismatic-moving-${emission}`,
      rotationRadians: rotation.value * Math.PI / 180,
      scaleX: spriteScale,
      scaleY: Math.fround(spriteScale * 0.8),
      tint: PRISMATIC_CHILD_TINTS[color.value]!,
    }))
  }
  return draws
}

const PRISMATIC_CHILD_TINTS = Object.freeze([
  0xff8080,
  0xffbf80,
  0xffff80,
  0x80ff80,
  0x80ffff,
])

function prismaticRadiusAtEmission(emission: number): number {
  let radius = Math.fround(2)
  for (let tick = 1; tick <= emission; tick += 1) {
    radius = Math.fround(radius + (tick <= 50
      ? Math.fround(0.065)
      : -Math.fround(0.075)))
  }
  return radius
}

export function magicCircleRingDraws(
  actor: NativeSecondaryActorState,
  draw: (
    atlas: NativeSecondaryAtlas,
    entry: number,
    options?: Partial<Omit<NativeSecondarySpriteDraw, 'atlas' | 'entry'>>,
  ) => NativeSecondarySpriteDraw,
): NativeSecondarySpriteDraw[] {
  if (actor.presentationRng === null) {
    throw new TypeError('Magic Circle presentation requires its pre-tick RNG state')
  }
  const age = Math.max(0, Math.trunc(actor.ageTicks))
  const lastEmission = Math.min(age, 1_499)
  const firstEmission = Math.max(0, lastEmission - 19)
  let rng = advanceNativeRngWords(
    actor.presentationRng,
    magicCircleRngWordsBefore(Math.trunc(actor.phase), firstEmission),
  )
  const draws: NativeSecondarySpriteDraw[] = []
  for (let emission = firstEmission; emission <= lastEmission; emission += 1) {
    rng = drawNativeFloat(rng, 0.25, true).state
    const globalTick = Math.trunc(actor.phase) + emission
    const childCount = 1 + (globalTick & 1)
    const remainingFactor = Math.min(Math.max(1_499 - emission, 0) / 100, 1)
    for (let child = 0; child < childCount; child += 1) {
      const life = drawNativeFloat(rng, 0.5)
      const scaleJitter = drawNativeFloat(life.state, 0.025)
      const angularMagnitude = drawNativeFloat(scaleJitter.state, 1)
      const angularVelocity = drawNativeSign(
        angularMagnitude.state,
        Math.fround(0.5 + angularMagnitude.value),
      )
      const rotation = drawNativeFloat(angularVelocity.state, 360)
      rng = rotation.state
      const elapsed = age - emission
      const alpha = repeatedFloatDecay(
        Math.fround(remainingFactor * Math.fround(0.5 + life.value)),
        0.05,
        elapsed,
      )
      if (alpha <= 0) continue
      const scaleFactor = Math.fround(0.975 + scaleJitter.value)
      const scaleX = Math.fround(actor.scale * scaleFactor)
      const scaleY = Math.fround(
        Math.fround(actor.scale * Math.fround(0.8)) * scaleFactor,
      )
      let rotationDegrees = rotation.value
      for (let tick = 0; tick < elapsed; tick += 1) {
        rotationDegrees = Math.fround(rotationDegrees + angularVelocity.value)
      }
      draws.push(draw('BadGuys', 48, {
        alpha: Math.min(alpha, 1),
        blend: 'add',
        role: `magic-circle-ring-${emission}-${child}`,
        rotationRadians: rotationDegrees * Math.PI / 180,
        scaleX,
        scaleY,
      }))
    }
  }
  return draws
}

function magicCircleRngWordsBefore(baseGlobalTick: number, updates: number): number {
  let words = 0
  for (let update = 0; update < updates; update += 1) {
    words += 2 + (1 + ((baseGlobalTick + update) & 1)) * 5
  }
  return words
}
