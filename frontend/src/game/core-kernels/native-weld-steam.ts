import { actorHeadingFromVector } from './actor-heading.ts'
import {
  drawNativeFloat,
  drawNativeInteger,
  type NativeRngState,
} from './native-rng.ts'
import { directionFromHeading } from './primary-spell-targeting.ts'
import type { Vector2 } from './vector.ts'

export interface NativeWeldSteamActorState {
  readonly ageTicks: number
  readonly alphaMultiplier: number
  readonly birthTick: number
  readonly blue: number
  readonly buildId: 1005
  readonly colorRise: number
  readonly direction: Vector2
  readonly id: number
  readonly kind: 'weld-steam'
  readonly life: number
  readonly lifeLoss: number
  readonly lightRegistration: null
  readonly origin: Vector2
  readonly ownerId: string
  readonly phase: number
  readonly position: Vector2
  readonly rotationDegrees: number
  readonly scale: number
  readonly stretch: number
  readonly tintFade: number
  readonly variant: 'normal' | 'over'
  readonly vector: readonly number[]
  readonly velocity: Vector2
  readonly worldKey: string
}

export function spawnNativeWeldSteamActor(input: {
  readonly direction: Vector2
  readonly id: number
  readonly origin: Vector2
  readonly ownerId: string
  readonly rng: NativeRngState
  readonly tick: number
  readonly underpowered: boolean
  readonly vector: readonly number[]
  readonly worldKey: string
}): {
  readonly actor: NativeWeldSteamActorState | null
  readonly rng: NativeRngState
} {
  // 0x00542F02 gates particle construction to the even native update lane.
  if ((input.tick & 1) !== 0) return { actor: null, rng: input.rng }
  let rng = input.rng
  const variantGate = drawNativeInteger(rng, 7); rng = variantGate.state
  const variant = variantGate.value === 1 && !input.underpowered ? 'over' : 'normal'

  const lifeDraw = drawNativeFloat(rng, Math.fround(0.05)); rng = lifeDraw.state
  const lossDraw = drawNativeFloat(rng, Math.fround(0.1)); rng = lossDraw.state
  const scaleDraw = drawNativeFloat(rng, Math.fround(0.75)); rng = scaleDraw.state
  const stretchDraw = drawNativeFloat(rng, 1); rng = stretchDraw.state
  const blueDraw = drawNativeFloat(rng, Math.fround(0.1)); rng = blueDraw.state
  const contactClock = drawNativeInteger(rng, 10); rng = contactClock.state
  const offsetDistance = drawNativeFloat(rng, 10); rng = offsetDistance.state
  const offsetHeading = drawNativeFloat(rng, 45, true); rng = offsetHeading.state
  void contactClock

  const headingDegrees = actorHeadingFromVector(input.direction.x, input.direction.y)
  const offsetDirection = directionFromHeading(headingDegrees + offsetHeading.value)
  const movementDirection = directionFromHeading(headingDegrees)
  const movementSpeed = variant === 'over' ? 6 : Math.fround(5.4)
  let life = Math.fround(
    Math.fround(Math.fround(lifeDraw.value + 1.25) + 1) * 0.5,
  )
  let colorRise = Math.fround(0.15)
  let blue = Math.fround(1 + blueDraw.value)
  if (variant === 'over') {
    life = Math.fround(life * Math.fround(0.65))
    colorRise = Math.fround(colorRise * 0.5)
    blue = 0
  }
  const scale = Math.fround(scaleDraw.value + Math.fround(0.65))
  return {
    actor: Object.freeze({
      ageTicks: 0,
      alphaMultiplier: 1,
      birthTick: input.tick,
      blue,
      buildId: 1005,
      colorRise,
      direction: Object.freeze({ ...input.direction }),
      id: input.id,
      kind: 'weld-steam',
      life,
      lifeLoss: Math.fround(Math.fround(lossDraw.value + 0.1) * 0.5),
      lightRegistration: null,
      origin: Object.freeze({ ...input.origin }),
      ownerId: input.ownerId,
      phase: 0,
      position: Object.freeze({
        x: Math.fround(input.origin.x + offsetDirection.x * offsetDistance.value),
        y: Math.fround(input.origin.y + offsetDirection.y * offsetDistance.value),
      }),
      rotationDegrees: headingDegrees,
      scale,
      stretch: Math.fround(Math.fround(stretchDraw.value + 2) * scale),
      tintFade: 1,
      variant,
      vector: Object.freeze([...input.vector]),
      velocity: Object.freeze({
        x: Math.fround(movementDirection.x * movementSpeed),
        y: Math.fround(movementDirection.y * movementSpeed),
      }),
      worldKey: input.worldKey,
    }),
    rng,
  }
}

export function stepNativeWeldSteamActor(
  actor: NativeWeldSteamActorState,
): NativeWeldSteamActorState | null {
  let life = Math.fround(actor.life - actor.lifeLoss)
  if (life < 0) return null
  let scale = actor.scale
  let stretch = actor.stretch
  const velocityFactor = life >= 1 ? Math.fround(0.96) : Math.fround(0.88)
  if (life < 1) {
    stretch = Math.fround(stretch * Math.fround(0.95))
    scale = Math.fround(scale + Math.fround(0.01))
    life = Math.fround(life + Math.fround(actor.lifeLoss * 0.5))
  }
  return Object.freeze({
    ...actor,
    ageTicks: actor.ageTicks + 1,
    blue: Math.max(0, Math.fround(actor.blue - Math.fround(0.25))),
    life,
    phase: Math.fround(actor.phase + actor.colorRise),
    position: Object.freeze({
      x: Math.fround(actor.position.x + actor.velocity.x),
      y: Math.fround(actor.position.y + actor.velocity.y),
    }),
    scale,
    stretch,
    tintFade: Math.fround(actor.tintFade - Math.fround(0.125)),
    velocity: Object.freeze({
      x: Math.fround(actor.velocity.x * velocityFactor),
      y: Math.fround(actor.velocity.y * velocityFactor),
    }),
  })
}
