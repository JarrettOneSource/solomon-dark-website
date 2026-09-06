import type {
  BoneyardPoint,
} from '../../core-kernels/boneyard.ts'
import {
  nativeFacultyColor,
} from '../../core-kernels/native-faculty.ts'
import {
  drawNativeFloat,
  drawNativeInteger,
  drawNativeSign,
} from '../../core-kernels/native-rng.ts'
import {
  spawnSimpleDeathEffect,
  type DeathEffectOwner,
} from './death-effects.ts'
import {
  type WorkingStep,
} from './model.ts'
import { drawEnemyFloat, drawEnemyInteger } from './random.ts'

export function spawnTragicCircleEffects(work: WorkingStep, owner: DeathEffectOwner, tick: number,
  remainingTicks: number): void {
  const float = (maximum: number, signed = false) => {
    const draw = drawNativeFloat(work.steeringRngState, maximum, signed)
    work.steeringRngState = draw.state
    return draw.value
  }
  const integer = (maximum: number) => {
    const draw = drawNativeInteger(work.steeringRngState, maximum)
    work.steeringRngState = draw.state
    return draw.value
  }
  // The base MagicCircle light provider consumes one signed flicker before the subclass callback.
  float(.25, true)
  const color = nativeFacultyColor([Math.fround(.75 + float(.5)), 0, 0, 1], .5)
  const tint = (Math.round(color[0] * 255) << 16) | (Math.round(color[1] * 255) << 8) | Math.round(color[2] * 255)
  for (let pair = 0; pair < 1 + (tick & 1); pair += 1) {
    for (const shadow of [false, true]) {
      const alpha = Math.fround(Math.min(remainingTicks / 100, 1) * Math.fround(.5 + float(.5)))
      let scale = Math.fround(4 * Math.fround(.9750000238418579 + float(.02500000037252903)))
      if (shadow) scale = Math.fround(scale * 1.034999966621399)
      const magnitude = Math.fround(.5 + float(1))
      const sign = drawNativeSign(work.steeringRngState, magnitude)
      work.steeringRngState = sign.state
      spawnSimpleDeathEffect(work, owner, tick, { alpha, alphaLossPerTick: .05,
        angularVelocityDeg: sign.value, atlas: 'BadGuys', blendMode: 'normal', entry: 48,
        kind: 'move-fade-perspective', lifetimeTicks: 20, presentationOwner: 'pre-world-queue',
        role: shadow ? 'tragic-circle-shadow' : 'tragic-circle-ring', rotationDeg: float(360),
        scale, tint: shadow ? 0 : tint, velocityDamping: 1 })
    }
  }
  const phase = float(360)
  for (let angle = 0; angle <= 90; angle += 10) {
    const entry = 10 + integer(2)
    const positionDirection = direction(angle + phase)
    const position = { x: Math.fround(owner.position.x + positionDirection.x * 200),
      y: Math.fround(owner.position.y + positionDirection.y * 200 * .800000011920929) }
    const speed = Math.fround(3 + float(3))
    let velocity = scaled(direction(angle + phase + 90 + float(3, true)), speed)
    let velocityDamping = integer(6) === 3 ? .8500000238418579 : .5
    let alphaLossPerTick = Math.fround(float(.019999999552965164) + .009999999776482582)
    if (integer(2) === 1) {
      const inwardSpeed = Math.fround(1 + float(2))
      velocity = scaled(direction(angle + phase + float(3, true)), -inwardSpeed)
      velocityDamping = .9800000190734863
      alphaLossPerTick = Math.fround(alphaLossPerTick * 3)
    }
    const rotationDeg = float(360)
    const scale = Math.fround(float(.19999998807907104) + .6000000238418579)
    const red = float(.15000000596046448)
    const worldSorted = integer(5) === 1
    spawnSimpleDeathEffect(work, owner, tick, { alpha: 1, opacityTimer: 2, alphaLossPerTick,
      atlas: 'BadGuys', blendMode: 'normal', entry, kind: 'move-fade', lifetimeTicks: 1000,
      position, presentationOwner: worldSorted ? 'world-sorted' : 'pre-world-queue',
      role: 'tragic-circle-smoke', rotationDeg, scale, tint: Math.round(red * 255) << 16,
      velocity, velocityDamping })
  }
}

function direction(degrees: number): BoneyardPoint {
  const angle = degrees * Math.PI / 180
  return { x: Math.fround(Math.sin(angle)), y: Math.fround(-Math.cos(angle)) }
}

function scaled(direction: BoneyardPoint, magnitude: number): BoneyardPoint {
  return { x: Math.fround(direction.x * magnitude), y: Math.fround(direction.y * magnitude) }
}

export function spawnBlightningSmoke(work: WorkingStep, owner: DeathEffectOwner, tick: number,
  source: Readonly<BoneyardPoint>, endpoint: Readonly<BoneyardPoint>): void {
  const float = (maximum: number, signed = false) => {
    const draw = drawNativeFloat(work.steeringRngState, maximum, signed)
    work.steeringRngState = draw.state
    return draw.value
  }
  const integer = (bound: number) => {
    const draw = drawNativeInteger(work.steeringRngState, bound)
    work.steeringRngState = draw.state
    return draw.value
  }
  for (let index = 0; index < 3; index += 1) {
    const entry = 10 + integer(2)
    let position: Readonly<BoneyardPoint> = source
    let velocity: BoneyardPoint
    if (index === 0) {
      const speed = float(8)
      velocity = scaled(direction(float(360)), speed)
    } else {
      const t = float(1)
      const dx = endpoint.x - source.x
      const dy = endpoint.y - source.y
      position = { x: Math.fround(source.x + dx * t), y: Math.fround(source.y + dy * t) }
      const speed = float(10, true)
      const length = Math.hypot(dx, dy)
      velocity = length === 0 ? { x: 0, y: 0 }
        : { x: Math.fround(dy / length * speed), y: Math.fround(-dx / length * speed) }
    }
    const rareDamping = integer(6) === 3
    const velocityDamping = index === 0
      ? rareDamping ? .9200000166893005 : .8799999952316284
      : rareDamping ? .8999999761581421 : .8500000238418579
    const rotationDeg = float(360)
    const scale = Math.fround(1.5 + float(.5))
    const alphaLossPerTick = Math.fround(.009999999776482582 + float(.019999999552965164))
    const red = float(.15000000596046448)
    spawnSimpleDeathEffect(work, owner, tick, { alpha: 1, opacityTimer: index === 0 ? 1 : 1.25,
      alphaLossPerTick, atlas: 'BadGuys', blendMode: 'normal', entry, kind: 'move-fade', lifetimeTicks: 1000,
      position, presentationOwner: 'pre-world-queue', role: index === 0 ? 'blightning-source-smoke' : 'blightning-path-smoke',
      rotationDeg, scale, tint: Math.round(red * 255) << 16, velocity, velocityDamping })
  }
}

export function spawnFacultyProjectileSmoke(work: WorkingStep, owner: DeathEffectOwner, tick: number,
  profile: 'skull-trail' | 'dark-trail' | 'skull-impact' | 'dark-impact' | 'dark-ring-impact', arcPhase = 0): void {
  const trail = profile === 'skull-trail' || profile === 'dark-trail'
  const ring = profile === 'dark-ring-impact'
  const count = profile === 'skull-trail' ? 1 : profile === 'dark-trail' ? 2 : ring ? 36 : 72
  for (let index = 0; index < count; index += 1) {
    const entry = 10 + drawEnemyInteger(work, 2)
    let position = owner.position
    if (profile === 'dark-trail') {
      const radius = drawEnemyFloat(work, 10)
      const offset = scaled(direction(drawEnemyFloat(work, 360)), radius)
      position = { x: Math.fround(position.x + offset.x),
        y: Math.fround(position.y + offset.y - 15 - Math.sin(arcPhase * Math.PI / 180) * 50) }
    }
    const speed = trail ? drawEnemyFloat(work, 4) : ring ? drawEnemyFloat(work, 6)
      : Math.fround(3 + drawEnemyFloat(work, 3))
    const heading = trail || ring ? drawEnemyFloat(work, 360) : index * 10 + drawEnemyFloat(work, 3, true)
    const velocity = scaled(direction(heading), speed)
    const rare = drawEnemyInteger(work, 6) === 3
    const velocityDamping = ring ? rare ? .9800000190734863 : .949999988079071
      : rare ? .949999988079071 : .8999999761581421
    const rotationDeg = drawEnemyFloat(work, 360)
    const scale = ring ? Math.fround(1.5 + drawEnemyFloat(work, .5))
      : Math.fround(Math.fround(.6000000238418579 + drawEnemyFloat(work, .19999998807907104))
        * (profile === 'dark-trail' ? 2.5 : 1))
    const alphaLossPerTick = Math.fround(Math.fround(.009999999776482582 + drawEnemyFloat(work, .019999999552965164))
      * (!trail && !ring ? .5 : 1))
    const red = drawEnemyFloat(work, .15000000596046448)
    const worldSorted = drawEnemyInteger(work, 5) === 3
    spawnSimpleDeathEffect(work, owner, tick, { alpha: 1, opacityTimer: ring ? 2 : profile === 'dark-trail' ? 1.25 : 1,
      alphaLossPerTick, atlas: 'BadGuys', blendMode: 'normal', entry, kind: 'move-fade', lifetimeTicks: 1000,
      position, presentationOwner: worldSorted ? 'world-sorted' : 'pre-world-queue', role: profile,
      rotationDeg, scale, tint: Math.round(red * 255) << 16, velocity, velocityDamping })
  }
}
