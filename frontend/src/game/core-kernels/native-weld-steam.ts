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
  readonly contactDamage: number
  readonly contactDue: boolean
  readonly contactEnabled: boolean
  readonly contactTicksRemaining: number
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
  readonly remainingDistance: number
  readonly rotationDegrees: number
  readonly scale: number
  readonly stretch: number
  readonly terminalPosition: Vector2
  readonly tintFade: number
  readonly variant: 'normal' | 'over'
  readonly vector: readonly number[]
  readonly velocity: Vector2
  readonly worldKey: string
}

export function spawnNativeWeldSteamActor(input: {
  readonly direction: Vector2
  readonly damage: number
  readonly id: number
  readonly origin: Vector2
  readonly ownerId: string
  readonly rng: NativeRngState
  readonly queryOrigin: Vector2
  readonly tick: number
  readonly underpowered: boolean
  readonly vector: readonly number[]
  readonly worldKey: string
  readonly obstructionPoint?: (
    start: Readonly<Vector2>,
    end: Readonly<Vector2>,
  ) => Vector2 | null
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
  const offsetHeading = drawNativeFloat(rng, Math.fround(4.5), true); rng = offsetHeading.state

  const headingDegrees = actorHeadingFromVector(input.direction.x, input.direction.y)
  const offsetDirection = directionFromHeading(headingDegrees + offsetHeading.value)
  const movementDirection = directionFromHeading(headingDegrees)
  const widen = input.underpowered ? 0 : input.vector[2]!
  const movementFactor = Math.fround(1 + widen * Math.fround(0.02))
  const movementSpeed = Math.fround(
    (variant === 'over' ? 6 : Math.fround(5.4)) * movementFactor,
  )
  let life = Math.fround(
    Math.fround(Math.fround(lifeDraw.value + 1.25) + 1) * 0.5,
  )
  const lifeLoss = Math.fround(
    Math.fround(lossDraw.value + Math.fround(0.01)) * 0.5,
  )
  let colorRise = Math.fround(0.15)
  let tintFade = Math.fround(1 + blueDraw.value)
  if (variant === 'over') {
    life = Math.fround(life * Math.fround(0.65))
    colorRise = Math.fround(colorRise * 0.5)
    tintFade = 0
  }
  const scale = Math.fround(scaleDraw.value + Math.fround(0.65))
  const baseOrigin = {
    x: Math.fround(input.origin.x - input.direction.x * 15),
    y: Math.fround(input.origin.y - input.direction.y * 15),
  }
  const position = Object.freeze({
    x: Math.fround(baseOrigin.x + offsetDirection.x * offsetDistance.value),
    y: Math.fround(baseOrigin.y + offsetDirection.y * offsetDistance.value),
  })
  const velocity = Object.freeze({
    x: Math.fround(movementDirection.x * movementSpeed),
    y: Math.fround(movementDirection.y * movementSpeed),
  })
  const predictedEnd = {
    x: Math.fround(input.queryOrigin.x + velocity.x * (life / lifeLoss)),
    y: Math.fround(input.queryOrigin.y + velocity.y * (life / lifeLoss)),
  }
  const terminal = input.obstructionPoint?.(input.queryOrigin, predictedEnd) ?? null
  let remainingDistance = 9_999_999
  if (terminal !== null) {
    remainingDistance = Math.fround(Math.hypot(
      terminal.x - position.x,
      terminal.y - position.y,
    ))
    if (squaredDistance(input.queryOrigin, terminal) < squaredDistance(
      input.queryOrigin,
      position,
    )) remainingDistance = 0
  }
  return {
    actor: Object.freeze({
      ageTicks: 0,
      alphaMultiplier: input.underpowered ? Math.fround(0.25) : 1,
      birthTick: input.tick,
      blue: Math.fround(0.75),
      buildId: 1005,
      colorRise,
      contactDamage: input.damage,
      contactDue: false,
      contactEnabled: variant === 'normal' && !input.underpowered,
      contactTicksRemaining: contactClock.value,
      direction: Object.freeze({ ...input.direction }),
      id: input.id,
      kind: 'weld-steam',
      life,
      lifeLoss,
      lightRegistration: null,
      origin: Object.freeze({ ...input.origin }),
      ownerId: input.ownerId,
      phase: 0,
      position,
      remainingDistance,
      rotationDegrees: normalizeDegrees(headingDegrees + offsetHeading.value),
      scale,
      stretch: Math.fround(Math.fround(stretchDraw.value + 2) * scale),
      terminalPosition: Object.freeze({ ...(terminal ?? position) }),
      tintFade,
      variant,
      vector: Object.freeze([...input.vector]),
      velocity,
      worldKey: input.worldKey,
    }),
    rng,
  }
}

export function stepNativeWeldSteamActor(
  actor: NativeWeldSteamActorState,
): NativeWeldSteamActorState | null {
  const speed = Math.hypot(actor.velocity.x, actor.velocity.y)
  let remainingDistance = Math.fround(actor.remainingDistance - speed)
  let velocity = actor.velocity
  let position = actor.position
  if (remainingDistance < 0) {
    velocity = Object.freeze({ x: 0, y: 0 })
    position = Object.freeze({ ...actor.terminalPosition })
    remainingDistance = 999_999
  }
  position = Object.freeze({
    x: Math.fround(position.x + velocity.x),
    y: Math.fround(position.y + velocity.y),
  })
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
  let contactDue = false
  let contactTicksRemaining = actor.contactTicksRemaining
  if (life > Math.fround(0.5) && actor.contactEnabled) {
    contactTicksRemaining -= 1
    if (contactTicksRemaining < 1) {
      contactDue = true
      contactTicksRemaining = 10
    }
  }
  return Object.freeze({
    ...actor,
    ageTicks: actor.ageTicks + 1,
    blue: Math.fround(actor.blue - Math.fround(0.125)),
    contactDue,
    contactTicksRemaining,
    life,
    phase: Math.fround(actor.phase + actor.colorRise),
    position,
    remainingDistance,
    scale,
    stretch,
    tintFade: Math.max(0, Math.fround(actor.tintFade - Math.fround(0.25))),
    velocity: Object.freeze({
      x: Math.fround(velocity.x * velocityFactor),
      y: Math.fround(velocity.y * velocityFactor),
    }),
  })
}

function squaredDistance(first: Readonly<Vector2>, second: Readonly<Vector2>): number {
  const dx = first.x - second.x
  const dy = first.y - second.y
  return dx * dx + dy * dy
}

function normalizeDegrees(value: number): number {
  return (value % 360 + 360) % 360
}
